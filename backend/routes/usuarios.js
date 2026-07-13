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

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { DB } = require("../db");
const tenantMiddleware = require("../middleware/tenantMiddleware");

// ─────────────────────────────────────────────────────────────────────────
// HELPER: Verificar se usuário é admin
// ─────────────────────────────────────────────────────────────────────────

function requerAdmin(req, res, next) {
  if (req.userPerfil !== "admin") {
    return res.status(403).json({ erro: "Apenas administradores podem fazer isso" });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────
// GET /api/usuarios - Listar usuários do tenant
// ─────────────────────────────────────────────────────────────────────────

router.get("/", tenantMiddleware, async (req, res) => {
  try {
    const usuarios = await DB.raw(`
      SELECT id, nome, email, perfil, ativo, criado_em
      FROM usuarios
      WHERE tenant_id = $1
      ORDER BY criado_em DESC
    `, [req.tenantId]);

    res.json(usuarios);
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

    res.json(usuarioSeguro);
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
    const { nome, email, senha, perfil } = req.body;

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

    if (!["tecnico", "comprador", "gestor", "admin"].includes(perfil || "tecnico")) {
      return res.status(400).json({
        erro: "Perfil inválido. Opções: tecnico, comprador, gestor, admin"
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
      perfil: perfil || "tecnico",
      ativo: 1
    }, req.tenantId);

    // Não retornar senha_hash
    const { senha_hash, ...usuarioSeguro } = usuario;

    res.status(201).json({
      ...usuarioSeguro,
      mensagem: "Usuário criado com sucesso"
    });

  } catch (err) {
    console.error("❌ Erro ao criar usuário:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUT /api/usuarios/:id - Atualizar usuário
// ─────────────────────────────────────────────────────────────────────────

router.put("/:id", tenantMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email } = req.body;

    // Verificar que usuário pertence ao tenant
    const usuario = await DB.selectOne("usuarios", { id }, req.tenantId);
    if (!usuario) {
      return res.status(404).json({ erro: "Usuário não encontrado" });
    }

    // Se está tentando mudar email, verificar se já existe
    if (email && email !== usuario.email) {
      const emailEmUso = await DB.selectOne("usuarios", { email }, req.tenantId);
      if (emailEmUso) {
        return res.status(409).json({
          erro: "Este email já está em uso nesta transportadora"
        });
      }
    }

    // Atualizar
    const updated = await DB.update("usuarios", id, {
      nome: nome || usuario.nome,
      email: email || usuario.email
    }, req.tenantId);

    const { senha_hash, ...usuarioSeguro } = updated;

    res.json({
      ...usuarioSeguro,
      mensagem: "Usuário atualizado com sucesso"
    });

  } catch (err) {
    console.error("❌ Erro ao atualizar usuário:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// DELETE /api/usuarios/:id - Deletar usuário (admin only)
// ─────────────────────────────────────────────────────────────────────────

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