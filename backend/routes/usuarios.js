// ════════════════════════════════════════════════════════════════════════════════
// routes/usuarios.js: GERENCIAMENTO DE USUÁRIOS MULTI-TENANT
// ════════════════════════════════════════════════════════════════════════════════
// Endpoints:
// GET    /api/usuarios              - Listar usuários do tenant
// GET    /api/usuarios/:id          - Buscar usuário por ID
// POST   /api/usuarios              - Criar novo usuário (admin only)
// PUT    /api/usuarios/:id          - Atualizar usuário
// DELETE /api/usuarios/:id          - Deletar usuário (admin only)
// POST   /api/usuarios/:id/perfil   - Alterar perfil de usuário (admin only)
// ════════════════════════════════════════════════════════════════════════════════

// ⚠️ REGRA MULTI-TENANT — tabelas N:N sem tenant_id
//
// Tabelas como `usuario_perfis`, `cotacao_fornecedores` e outras N:N
// NÃO têm coluna `tenant_id` — o isolamento entre tenants é garantido
// por TRANSITIVIDADE via a tabela principal.
//
// REGRA: nenhuma rota pode consultar uma tabela N:N sem antes validar
// que a entidade principal pertence ao `req.tenantId`.
//
// Exemplo correto:
//   const usuario = await DB.selectOne('usuarios', { id }, req.tenantId);
//   if (!usuario) return 404;  // ← barreira
//   const perfis = await DB.select('usuario_perfis', { usuario_id: id }, null);
//
// Exemplo ERRADO (furo de segurança):
//   const perfis = await DB.select('usuario_perfis', { usuario_id: id }, null);
//   // ← nunca validou que o usuário é do tenant logado

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { DB } = require("../db");
const tenantMiddleware = require("../middleware/tenantMiddleware");

// ─────────────────────────────────────────────────────────────────────────
// HELPER: Verificar se usuário é admin
// ─────────────────────────────────────────────────────────────────────────

function requerAdmin(req, res, next) {
  // M4.6: multi-perfil — aceita se QUALQUER perfil do usuário é admin.
  const perfis = Array.isArray(req.perfis) && req.perfis.length > 0
    ? req.perfis
    : [req.userPerfil].filter(Boolean);
  if (!perfis.includes("admin")) {
    return res.status(403).json({ erro: "Apenas administradores podem fazer isso" });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────
// GET /api/usuarios - Listar usuários do tenant
// ─────────────────────────────────────────────────────────────────────────

router.get("/", tenantMiddleware, async (req, res) => {
  try {
    // M4.5-fix: trocado DB.raw por DB.select. O DB.raw cai no fallback
    // genérico quando a query tem ORDER BY (não reconhece o padrão),
    // e o fallback ignora o SELECT explícito — devolvia usuários sem
    // a coluna `telefone` (que foi adicionada depois). DB.select + sort
    // em JS é o padrão recomendado pelo próprio db.js.
    const usuarios = await DB.select("usuarios", { tenant_id: req.tenantId }, req.tenantId);

    // M4.5: enriquece cada usuário com o array de perfis (usuario_perfis).
    // IMPORTANTE: `usuario_perfis` NÃO tem tenant_id — passa `null` como
    // 3º argumento, senão o DB.select tenta filtrar por coluna inexistente.
    const todosUsuarioPerfis = await DB.select("usuario_perfis", {}, null).catch(() => []);
    const perfisPorUsuario = {};
    (todosUsuarioPerfis || []).forEach(up => {
      if (!perfisPorUsuario[up.usuario_id]) perfisPorUsuario[up.usuario_id] = [];
      perfisPorUsuario[up.usuario_id].push(up.perfil_codigo);
    });

    const usuariosSeguros = (usuarios || [])
      .map(({ senha_hash, ...u }) => ({
        ...u,
        perfis: perfisPorUsuario[u.id] || [u.perfil].filter(Boolean),
      }))
      .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));

    res.json(usuariosSeguros);
  } catch (err) {
    console.error("❌ Erro ao listar usuários:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/usuarios/:id - Buscar usuário por ID
// ─────────────────────────────────────────────────────────────────────────

router.get("/:id", tenantMiddleware, async (req, res) => {
  try {
    const usuario = await DB.selectOne("usuarios", { id: req.params.id }, req.tenantId);

    if (!usuario) {
      return res.status(404).json({ erro: "Usuário não encontrado" });
    }

    // Não retornar senha_hash
    const { senha_hash, ...usuarioSeguro } = usuario;

    // M4.5: enriquece com o array de perfis (usuario_perfis).
    // `usuario_perfis` NÃO tem tenant_id — passa `null`.
    const perfisDoUsuario = await DB.select("usuario_perfis", { usuario_id: req.params.id }, null);
    const perfisArr = (perfisDoUsuario || []).map(p => p.perfil_codigo);

    res.json({
      ...usuarioSeguro,
      perfis: perfisArr.length > 0 ? perfisArr : [usuario.perfil].filter(Boolean),
    });
  } catch (err) {
    console.error("❌ Erro ao buscar usuário:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/usuarios - Criar novo usuário (admin only)
// ─────────────────────────────────────────────────────────────────────────

router.post("/", tenantMiddleware, requerAdmin, async (req, res) => {
  try {
    const { nome, email, senha, perfil, telefone, perfis } = req.body;

    // M4.5: aceita `perfis` (array) do frontend novo. Se não vier, cai no
    // `perfil` (string) por compatibilidade. `perfil` = perfis[0] (principal).
    const perfisFinal = Array.isArray(perfis) && perfis.length > 0
      ? perfis.filter(Boolean)
      : (perfil ? [perfil] : ['comprador']);
    const perfilPrincipal = perfisFinal[0];

    // Validações
    if (!nome || !email || !senha) {
      return res.status(400).json({
        erro: "Nome, email e senha são obrigatórios"
      });
    }

    if (senha.length < 6) {
      return res.status(400).json({
        erro: "Senha deve ter mínimo 6 caracteres"
      });
    }

    // M4.5: valida cada perfil do array contra a lista canônica
    const PERFIS_VALIDOS = ['admin', 'gestor', 'comprador', 'operacao', 'qualidade', 'financeiro'];
    const invalidos = perfisFinal.filter(p => !PERFIS_VALIDOS.includes(p));
    if (invalidos.length > 0) {
      return res.status(400).json({
        erro: `Perfil inválido: ${invalidos.join(', ')}. Válidos: ${PERFIS_VALIDOS.join(', ')}`
      });
    }

    // Verificar se email já existe neste tenant
    const emailEmUso = await DB.selectOne("usuarios", { email }, req.tenantId);
    if (emailEmUso) {
      return res.status(409).json({
        erro: "Este email já está em uso nesta transportadora"
      });
    }

    // Hash da senha
    const senhaHash = bcrypt.hashSync(senha, 10);

    // Criar usuário
    const usuario = await DB.insert("usuarios", {
      nome,
      email,
      senha_hash: senhaHash,
      // M4.5: `perfil` continua sendo a coluna canônica (compatibilidade
      // com os 22 checks legados). É o perfil PRINCIPAL (perfisFinal[0]).
      perfil: perfilPrincipal,
      telefone: (telefone && String(telefone).trim()) || null,
      ativo: 1
    }, req.tenantId);

    // M4.5: grava os N perfis em usuario_perfis
    for (const codigo of perfisFinal) {
      try {
        await DB.insert("usuario_perfis", {
          usuario_id: usuario.id,
          perfil_codigo: codigo,
        }, req.tenantId);
      } catch (e) {
        // Perfil já existe ou inválido — segue
        console.warn(`⚠ Falha ao gravar perfil ${codigo}:`, e.message);
      }
    }

    // Não retornar senha_hash
    const { senha_hash, ...usuarioSeguro } = usuario;

    res.status(201).json({
      ...usuarioSeguro,
      perfis: perfisFinal,
      mensagem: "Usuário criado com sucesso"
    });

  } catch (err) {
    console.error("❌ Erro ao criar usuário:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// M4.7: rotas "meu perfil" — SEMPRE antes de /:id (senão o Express casa
// /me com /:id e tenta UUID "me" → 500). O id é `req.userId` do JWT.

// PUT /api/usuarios/me — atualiza nome e telefone do próprio usuário
// Etapa 14c: logo + dados da empresa para os documentos (qualquer usuário logado — colaborador e locatário também)
router.get("/me/logo", tenantMiddleware, async (req, res) => {
  try { res.json(await require("../services/logoEmpresa").obter(require("../db").supabase, req.tenantId)); }
  catch (err) { console.error("❌ [logo]", err.message); res.json({ logo: null, empresa: null }); }
});

router.put("/me", tenantMiddleware, async (req, res) => {
  try {
    const { nome, telefone } = req.body || {};
    const upd = {};
    if (nome !== undefined) {
      if (!nome.trim()) return res.status(400).json({ erro: "Nome não pode ser vazio" });
      upd.nome = nome.trim();
    }
    if (telefone !== undefined) {
      upd.telefone = (telefone && String(telefone).trim()) || null;
    }
    if (Object.keys(upd).length === 0) {
      return res.status(400).json({ erro: "Nada para atualizar" });
    }
    upd.atualizado_em = new Date().toISOString();

    await DB.update("usuarios", req.userId, upd, req.tenantId);
    const atualizado = await DB.selectOne("usuarios", { id: req.userId }, req.tenantId);
    const { senha_hash, ...seguro } = atualizado;
    res.json({ ok: true, usuario: seguro });
  } catch (err) {
    console.error("❌ Erro em PUT /usuarios/me:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/usuarios/me/trocar-senha — troca a senha (valida a atual)
router.post("/me/trocar-senha", tenantMiddleware, async (req, res) => {
  try {
    const { senhaAtual, senhaNova } = req.body || {};
    if (!senhaAtual || !senhaNova) {
      return res.status(400).json({ erro: "senhaAtual e senhaNova são obrigatórias" });
    }
    if (String(senhaNova).length < 6) {
      return res.status(400).json({ erro: "Nova senha deve ter mínimo 6 caracteres" });
    }
    const usuario = await DB.selectOne("usuarios", { id: req.userId }, req.tenantId);
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado" });

    const ok = bcrypt.compareSync(senhaAtual, usuario.senha_hash);
    if (!ok) return res.status(401).json({ erro: "Senha atual incorreta" });

    const novoHash = bcrypt.hashSync(senhaNova, 10);
    await DB.update("usuarios", req.userId, {
      senha_hash: novoHash,
      atualizado_em: new Date().toISOString(),
    }, req.tenantId);

    res.json({ ok: true, mensagem: "Senha atualizada" });
  } catch (err) {
    console.error("❌ Erro em POST /usuarios/me/trocar-senha:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

router.put("/:id", tenantMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, perfil, ativo, senha, telefone, perfis } = req.body;

    // M4.5: se `perfis` (array) veio, usa ele. Senão cai no `perfil` (string).
    const temPerfisArray = Array.isArray(perfis);
    const perfisFinal = temPerfisArray ? perfis.filter(Boolean) : null;

    const usuario = await DB.selectOne("usuarios", { id }, req.tenantId);
    if (!usuario) {
      return res.status(404).json({ erro: "Usuário não encontrado" });
    }

    // Verificar email único
    if (email && email !== usuario.email) {
      const emailEmUso = await DB.selectOne("usuarios", { email }, req.tenantId);
      if (emailEmUso) {
        return res.status(409).json({ erro: "Este email já está em uso" });
      }
    }

    const dadosAtualizar = {};
    if (nome !== undefined) dadosAtualizar.nome = nome;
    if (email !== undefined) dadosAtualizar.email = email;
    if (perfil !== undefined) dadosAtualizar.perfil = perfil;
    if (ativo !== undefined) dadosAtualizar.ativo = ativo ? 1 : 0;
    // M4.5: telefone — normaliza vazio pra null
    if (telefone !== undefined) {
      dadosAtualizar.telefone = (telefone && String(telefone).trim()) || null;
    }
    if (senha && senha.length > 0) {
      dadosAtualizar.senha_hash = bcrypt.hashSync(senha, 10);
    }
    // M4.5: `perfil` (coluna canônica) = primeiro do array, se array veio
    if (temPerfisArray && perfisFinal.length > 0) {
      dadosAtualizar.perfil = perfisFinal[0];
    }

    await DB.update("usuarios", id, dadosAtualizar, req.tenantId);

    // M4.5: se `perfis` (array) veio, sincroniza usuario_perfis.
    // Apaga os antigos e grava os novos (idempotente).
    // IMPORTANTE: `usuario_perfis` NÃO tem tenant_id — passa `null`
    // como 3º argumento pra não filtrar por coluna inexistente.
    if (temPerfisArray && perfisFinal.length > 0) {
      try {
        await DB.deleteWhere("usuario_perfis", { usuario_id: id }, null);
        for (const codigo of perfisFinal) {
          await DB.insert("usuario_perfis", {
            usuario_id: id,
            perfil_codigo: codigo,
          }, null);
        }
      } catch (e) {
        console.warn(`⚠ Falha ao sincronizar perfis:`, e.message);
      }
    }

    const updated = await DB.selectOne("usuarios", { id }, req.tenantId);
    const { senha_hash, ...usuarioSeguro } = updated;

    // M4.5: retorna também os perfis do N:N
    const perfisDoUsuario = await DB.select("usuario_perfis", { usuario_id: id }, null);
    const perfisArr = (perfisDoUsuario || []).map(p => p.perfil_codigo);

    res.json({
      ...usuarioSeguro,
      perfis: perfisArr,
      mensagem: "Usuário atualizado com sucesso",
    });
  } catch (err) {
    console.error("❌ Erro ao atualizar usuário:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// PATCH /api/usuarios/:id - Atualização parcial (mesma lógica)
router.patch("/:id", tenantMiddleware, async (req, res) => {
  // Reaproveita a mesma função do PUT
  try {
    const { id } = req.params;
    const { nome, email, perfil, ativo, senha, telefone, perfis } = req.body;

    // M4.5: se `perfis` (array) veio, usa ele. Senão cai no `perfil` (string).
    const temPerfisArray = Array.isArray(perfis);
    const perfisFinal = temPerfisArray
      ? perfis.filter(Boolean)
      : null;

    const usuario = await DB.selectOne("usuarios", { id }, req.tenantId);
    if (!usuario) {
      return res.status(404).json({ erro: "Usuário não encontrado" });
    }

    if (email && email !== usuario.email) {
      const emailEmUso = await DB.selectOne("usuarios", { email }, req.tenantId);
      if (emailEmUso) {
        return res.status(409).json({ erro: "Este email já está em uso" });
      }
    }

    const dadosAtualizar = {};
    if (nome !== undefined) dadosAtualizar.nome = nome;
    if (email !== undefined) dadosAtualizar.email = email;
    if (perfil !== undefined) dadosAtualizar.perfil = perfil;
    if (ativo !== undefined) dadosAtualizar.ativo = ativo ? 1 : 0;
    // M4.5: telefone — normaliza vazio pra null
    if (telefone !== undefined) {
      dadosAtualizar.telefone = (telefone && String(telefone).trim()) || null;
    }
    if (senha && senha.length > 0) {
      dadosAtualizar.senha_hash = bcrypt.hashSync(senha, 10);
    }
    // M4.5: `perfil` (coluna canônica) = primeiro do array, se array veio
    if (temPerfisArray && perfisFinal.length > 0) {
      dadosAtualizar.perfil = perfisFinal[0];
    }

    await DB.update("usuarios", id, dadosAtualizar, req.tenantId);

    // M4.5: se `perfis` (array) veio, sincroniza usuario_perfis.
    // `usuario_perfis` NÃO tem tenant_id — passa `null` no 3º argumento.
    if (temPerfisArray && perfisFinal.length > 0) {
      try {
        await DB.deleteWhere("usuario_perfis", { usuario_id: id }, null);
        for (const codigo of perfisFinal) {
          await DB.insert("usuario_perfis", {
            usuario_id: id,
            perfil_codigo: codigo,
          }, null);
        }
      } catch (e) {
        console.warn(`⚠ Falha ao sincronizar perfis:`, e.message);
      }
    }

    const updated = await DB.selectOne("usuarios", { id }, req.tenantId);
    const { senha_hash, ...usuarioSeguro } = updated;

    // M4.5: retorna também os perfis do N:N
    const perfisDoUsuario = await DB.select("usuario_perfis", { usuario_id: id }, null);
    const perfisArr = (perfisDoUsuario || []).map(p => p.perfil_codigo);

    res.json({
      ...usuarioSeguro,
      perfis: perfisArr,
      mensagem: "Usuário atualizado com sucesso",
    });
  } catch (err) {
    console.error("❌ Erro ao atualizar usuário:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

router.delete("/:id", tenantMiddleware, requerAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Não permitir deletar a si mesmo
    if (id === req.userId) {
      return res.status(400).json({
        erro: "Você não pode deletar sua própria conta"
      });
    }

    // Verificar que usuário pertence ao tenant
    const usuario = await DB.selectOne("usuarios", { id }, req.tenantId);
    if (!usuario) {
      return res.status(404).json({ erro: "Usuário não encontrado" });
    }

    await DB.delete("usuarios", id, req.tenantId);

    res.json({
      ok: true,
      mensagem: `Usuário ${usuario.email} deletado com sucesso`
    });

  } catch (err) {
    console.error("❌ Erro ao deletar usuário:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/usuarios/:id/perfil - Alterar perfil (admin only)
// ─────────────────────────────────────────────────────────────────────────

router.post("/:id/perfil", tenantMiddleware, requerAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { perfil } = req.body;

    if (!["tecnico", "comprador", "gestor", "admin"].includes(perfil)) {
      return res.status(400).json({
        erro: "Perfil inválido. Opções: tecnico, comprador, gestor, admin"
      });
    }

    // Verificar que usuário pertence ao tenant
    const usuario = await DB.selectOne("usuarios", { id }, req.tenantId);
    if (!usuario) {
      return res.status(404).json({ erro: "Usuário não encontrado" });
    }

    // Atualizar perfil
    const updated = await DB.update("usuarios", id, { perfil }, req.tenantId);

    const { senha_hash, ...usuarioSeguro } = updated;

    res.json({
      ...usuarioSeguro,
      mensagem: `Perfil alterado para ${perfil}`
    });

  } catch (err) {
    console.error("❌ Erro ao alterar perfil:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/usuarios/:id/desativar - Desativar usuário (admin only)
// ─────────────────────────────────────────────────────────────────────────

router.post("/:id/desativar", tenantMiddleware, requerAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Não permitir desativar a si mesmo
    if (id === req.userId) {
      return res.status(400).json({
        erro: "Você não pode desativar sua própria conta"
      });
    }

    // Verificar que usuário pertence ao tenant
    const usuario = await DB.selectOne("usuarios", { id }, req.tenantId);
    if (!usuario) {
      return res.status(404).json({ erro: "Usuário não encontrado" });
    }

    // Desativar
    const updated = await DB.update("usuarios", id, { ativo: 0 }, req.tenantId);

    res.json({
      ok: true,
      mensagem: `Usuário ${usuario.email} desativado`
    });

  } catch (err) {
    console.error("❌ Erro ao desativar usuário:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/usuarios/:id/ativar - Ativar usuário (admin only)
// ─────────────────────────────────────────────────────────────────────────

router.post("/:id/ativar", tenantMiddleware, requerAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que usuário pertence ao tenant
    const usuario = await DB.selectOne("usuarios", { id }, req.tenantId);
    if (!usuario) {
      return res.status(404).json({ erro: "Usuário não encontrado" });
    }

    // Ativar
    const updated = await DB.update("usuarios", id, { ativo: 1 }, req.tenantId);

    res.json({
      ok: true,
      mensagem: `Usuário ${usuario.email} ativado`
    });

  } catch (err) {
    console.error("❌ Erro ao ativar usuário:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;