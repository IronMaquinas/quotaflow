// ════════════════════════════════════════════════════════════════════════════════
// routes/auth.js: FLUXO COMPLETO DE AUTENTICAÇÃO (CORRIGIDO PARA SUPABASE)
// ════════════════════════════════════════════════════════════════════════════════

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { DB } = require("../db");
const tenantMiddleware = require("../middleware/tenantMiddleware");

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Gerar tokens JWT
// ─────────────────────────────────────────────────────────────────────────────

function gerarTokens(usuario, tenant, perfisArr = null) {
  const payload = {
    user_id: usuario.id,
    tenant_id: tenant.id,
    email: usuario.email,
    perfil: usuario.perfil,
    // M4.6: array de perfis (multi-perfil). Fallback pro single se o
    // caller não passar — assim os 3 usos continuam funcionando sem mudança.
    perfis: Array.isArray(perfisArr) && perfisArr.length > 0
      ? perfisArr
      : [usuario.perfil].filter(Boolean),
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "24h"
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "30d"
  });

  return { accessToken, refreshToken };
}

// ─────────────────────────────────────────────────────────────────────────────
// "Criar conta" pela tela de login (etapa 11a) — regras em services/cadastroPublico.js
//
// POST /api/auth/signup              → transportadora (CNPJ na Receita, gestor+admin,
//                                      teste de 15 dias, Spot só depois de aprovada)
// POST /api/auth/signup-fornecedor   → fornecedor (CNPJ na Receita, nasce
//                                      'candidato' = aguardando aprovação)
// ─────────────────────────────────────────────────────────────────────────────

const { cadastrarTransportadora, cadastrarFornecedor, situacaoDoTenant } = require("../services/cadastroPublico");

router.post("/signup", async (req, res) => {
  try {
    const b = req.body || {};
    const senha = String(b.senha || "");
    if (senha.length < 6) {
      return res.status(400).json({ erro: "A senha deve ter ao menos 6 caracteres" });
    }

    const r = await cadastrarTransportadora({
      cnpj: b.cnpj,
      empresaNome: b.empresa_nome,
      nome: b.nome || b.nome_responsavel,
      email: b.email || b.email_admin,
      senhaHash: bcrypt.hashSync(senha, 10),
      telefone: b.telefone,
      regiao: b.regiao,
    });
    if (r.erro) return res.status(r.status || 400).json({ erro: r.erro, motivo: r.motivo });

    const { tenant, usuario, perfis } = r;
    const { accessToken, refreshToken } = gerarTokens(usuario, tenant, perfis);
    res.status(201).json({
      ok: true,
      mensagem: "Conta criada! Seu teste grátis já começou.",
      tenant: { id: tenant.id, slug: tenant.slug, nome: tenant.nome, ...situacaoDoTenant(tenant) },
      usuario: { id: usuario.id, email: usuario.email, nome: usuario.nome, perfil: usuario.perfil, perfis },
      tokens: { accessToken, refreshToken },
    });
  } catch (err) {
    console.error("❌ Erro no signup:", err.message);
    res.status(500).json({ erro: "Não foi possível criar a conta agora. Tente de novo em instantes." });
  }
});

router.post("/signup-fornecedor", async (req, res) => {
  try {
    const b = req.body || {};
    const senha = String(b.senha || "");
    if (senha.length < 6) {
      return res.status(400).json({ erro: "A senha deve ter ao menos 6 caracteres" });
    }

    const r = await cadastrarFornecedor({
      cnpj: b.cnpj,
      nome: b.nome,
      email: b.email,
      senhaHash: bcrypt.hashSync(senha, 10),
      empresa: b.empresa,
    });
    if (r.erro) return res.status(r.status || 400).json({ erro: r.erro, motivo: r.motivo });

    const { fornecedor, usuario } = r;
    // mesmo formato do /login-fornecedor
    const token = jwt.sign(
      { user_id: usuario.id, fornecedor_id: usuario.fornecedor_id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.status(201).json({
      ok: true,
      token,
      aguardando_aprovacao: true,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil || "vendedor",
        fornecedor_id: usuario.fornecedor_id,
        fornecedor_nome: fornecedor.nome_fantasia || fornecedor.nome || "",
      },
    });
  } catch (err) {
    console.error("❌ Erro no signup-fornecedor:", err.message);
    res.status(500).json({ erro: "Não foi possível criar a conta agora. Tente de novo em instantes." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// Login com email + senha
// ─────────────────────────────────────────────────────────────────────────────

router.post("/login", async (req, res) => {
  try {
    const { email, senha, tenant_slug } = req.body;

    if (!email || !senha) {
      return res.status(400).json({
        erro: "Email e senha são obrigatórios"
      });
    }

    // Estratégia: Se passou tenant_slug, buscar nesse tenant específico
    // Se não passou, tentar achar o email em qualquer tenant
    let usuario;
    let tenant;

    if (tenant_slug) {
      // Buscar tenant pelo slug
      tenant = await DB.selectOne("tenants", { slug: tenant_slug });
      if (!tenant) {
        return res.status(404).json({ erro: "Transportadora não encontrada" });
      }

      // Buscar usuário nesse tenant
      usuario = await DB.selectOne("usuarios", { email }, tenant.id);
    } else {
      // Buscar o usuário em qualquer tenant
      const usuarios = await DB.select("usuarios", { email });
      
      if (!usuarios || usuarios.length === 0) {
        return res.status(401).json({ erro: "Email ou senha incorretos" });
      }

      usuario = usuarios[0];
      
      // Buscar o tenant do usuário
      tenant = await DB.selectOne("tenants", { id: usuario.tenant_id });
    }

    if (!usuario) {
      return res.status(401).json({ erro: "Email ou senha incorretos" });
    }

    // Verificar se usuário está ativo
    if (!usuario.ativo) {
      return res.status(403).json({ erro: "Usuário desativado" });
    }

    // Verificar senha
    const senhaValida = bcrypt.compareSync(senha, usuario.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ erro: "Email ou senha incorretos" });
    }

    // M4.6: busca os perfis N:N (usuario_perfis) ANTES de gerar os tokens,
    // pra incluir no JWT. `usuario_perfis` NÃO tem tenant_id — passa `null`.
    let perfisArr = [];
    try {
      const linhas = await DB.select("usuario_perfis", { usuario_id: usuario.id }, null);
      perfisArr = (linhas || []).map(l => l.perfil_codigo);
    } catch (_) {}
    // Fallback: se o N:N estiver vazio, usa o `perfil` (coluna legada)
    if (perfisArr.length === 0 && usuario.perfil) {
      perfisArr = [usuario.perfil];
    }

    // Gerar tokens (com perfis no payload do JWT)
    const { accessToken, refreshToken } = gerarTokens(usuario, tenant, perfisArr);

    // Responder
    res.json({
      ok: true,
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        nome: tenant.nome
      },
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        perfil: usuario.perfil,
        perfis: perfisArr,   // M4.5: array pro frontend (multi-perfil)
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });

  } catch (err) {
    console.error("❌ Erro no login:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// Dados do usuário logado
// ─────────────────────────────────────────────────────────────────────────────

router.get("/me", tenantMiddleware, async (req, res) => {
  try {
    // tenantMiddleware injetou req.userId e req.tenantId
    const usuario = await DB.selectOne("usuarios", { id: req.userId }, req.tenantId);

    if (!usuario) {
      return res.status(404).json({ erro: "Usuário não encontrado" });
    }

    const tenant = await DB.selectOne("tenants", { id: req.tenantId });
    let plano = null;
    if (tenant?.plano) {
      try { plano = await DB.selectOne("planos", { codigo: tenant.plano }); } catch { /* tabela opcional */ }
    }

    res.json({
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        perfil: usuario.perfil,
        ativo: usuario.ativo
      },
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        nome: tenant.nome,
        plano: tenant.plano,
        regiao: tenant.regiao,
        // etapa 11a: teste grátis e aprovação (aviso no topo do sistema)
        ...situacaoDoTenant(tenant, plano),
      }
    });

  } catch (err) {
    console.error("❌ Erro ao buscar /me:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/refresh
// Renovar token com refresh token
// ─────────────────────────────────────────────────────────────────────────────

router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ erro: "Refresh token obrigatório" });
    }

    // Verificar refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ erro: "Refresh token inválido ou expirado" });
    }

    // Buscar usuário para confirmar que ainda existe e está ativo
    const usuario = await DB.selectOne("usuarios", { id: decoded.user_id }, decoded.tenant_id);

    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ erro: "Usuário não encontrado ou desativado" });
    }

    const tenant = await DB.selectOne("tenants", { id: decoded.tenant_id });

    // Gerar novo access token
    const { accessToken, refreshToken: novoRefreshToken } = gerarTokens(usuario, tenant);

    res.json({
      ok: true,
      tokens: {
        accessToken,
        refreshToken: novoRefreshToken
      }
    });

  } catch (err) {
    console.error("❌ Erro no refresh:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/change-password
// Trocar senha (requer estar logado)
// ─────────────────────────────────────────────────────────────────────────────

router.post("/change-password", tenantMiddleware, async (req, res) => {
  try {
    const { senhaAtual, senhaNova } = req.body;

    if (!senhaAtual || !senhaNova) {
      return res.status(400).json({ erro: "Senha atual e nova são obrigatórias" });
    }

    if (senhaNova.length < 6) {
      return res.status(400).json({ erro: "Nova senha deve ter mínimo 6 caracteres" });
    }

    // Buscar usuário
    const usuario = await DB.selectOne("usuarios", { id: req.userId }, req.tenantId);

    if (!usuario) {
      return res.status(404).json({ erro: "Usuário não encontrado" });
    }

    // Verificar senha atual
    const senhaValida = bcrypt.compareSync(senhaAtual, usuario.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ erro: "Senha atual incorreta" });
    }

    // Hash da nova senha
    const novaHash = bcrypt.hashSync(senhaNova, 10);

    // Atualizar
    await DB.update("usuarios", usuario.id, {
      senha_hash: novaHash
    }, req.tenantId);

    res.json({
      ok: true,
      mensagem: "Senha alterada com sucesso"
    });

  } catch (err) {
    console.error("❌ Erro ao mudar senha:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// Logout (função no frontend, servidor só confirma)
// ─────────────────────────────────────────────────────────────────────────────

router.post("/logout", tenantMiddleware, async (req, res) => {
  // Em JWT stateless, logout é só no frontend (remover token)
  // Mas aqui confirmamos que recebemos o pedido
  res.json({
    ok: true,
    mensagem: "Logout realizado com sucesso. Remova o token do localStorage."
  });
});

// ─── LOGIN PARA FORNECEDOR ───
router.post('/login-fornecedor', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
    }

    // Buscar fornecedor_usuarios
    const usuario = await DB.selectOne('fornecedor_usuarios', { email });
    if (!usuario) {
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    // Verificar senha
    const senhaValida = bcrypt.compareSync(senha, usuario.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    // Gerar token JWT
    const token = jwt.sign(
      { user_id: usuario.id, fornecedor_id: usuario.fornecedor_id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Buscar dados do fornecedor
    const fornecedor = await DB.selectOne('fornecedores', { id: usuario.fornecedor_id });

    res.json({
      ok: true,
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil || 'vendedor',
        fornecedor_id: usuario.fornecedor_id,
        fornecedor_nome: fornecedor?.nome || ''
      }
    });

  } catch (err) {
    console.error('❌ Erro no login-fornecedor:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// M4.6 — RESET DE SENHA ("esqueci minha senha")
// ─────────────────────────────────────────────────────────────────────────────

const bcryptReset = require('bcryptjs');
const {
  podeEnviarReset,
  gerarReset,
  validarToken,
  aplicarNovaSenha,
  TTL_MINUTOS,
} = require('../services/PasswordResetService');
const { enviarEmailCotacao } = require('../services/emailService');

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Sempre responde 200 (não vaza se o email existe).
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const email = (req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ erro: 'Email é obrigatório' });

    // Rate limit
    const pode = await podeEnviarReset(email);
    if (!pode) {
      // Responde 200 mesmo assim (não vaza nada)
      return res.json({ ok: true, mensagem: 'Se o email existir, enviaremos um link.' });
    }

    const r = await gerarReset(email);
    if (r) {
      const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
      const link = `${baseUrl}/#/reset-senha?token=${r.token}`;
      const corpo = `
        <h2>Redefinir senha — QuotaFlow</h2>
        <p>Olá <strong>${r.alvo.nome || 'usuário'}</strong>,</p>
        <p>Recebemos um pedido para redefinir sua senha.</p>
        <p>O link abaixo é válido por <strong>${TTL_MINUTOS} minutos</strong>:</p>
        <p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px">🔒 Redefinir senha</a></p>
        <p style="font-size:12px;color:#666">Se você não pediu, ignore este email.</p>
      `;
      try {
        await enviarEmailCotacao(email, 'Redefinir senha — QuotaFlow', corpo);
      } catch (e) {
        console.warn('⚠ Falha ao enviar email de reset:', e.message);
      }
    }

    // Sempre responde 200
    return res.json({ ok: true, mensagem: 'Se o email existir, enviaremos um link.' });
  } catch (err) {
    console.error('❌ Erro em /forgot-password:', err.message);
    // Não vaza erro real — resposta genérica
    return res.json({ ok: true, mensagem: 'Se o email existir, enviaremos um link.' });
  }
});

/**
 * GET /api/auth/reset-password/validar?token=xxx
 */
router.get('/reset-password/validar', async (req, res) => {
  try {
    const token = req.query.token;
    const v = await validarToken(token);
    if (!v) return res.json({ ok: false, motivo: 'invalido' });
    if (v.erro) return res.json({ ok: false, motivo: v.erro });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
});

/**
 * POST /api/auth/reset-password
 * Body: { token, senha }
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, senha } = req.body || {};
    if (!token || !senha) {
      return res.status(400).json({ erro: 'Token e senha são obrigatórios' });
    }
    if (String(senha).length < 6) {
      return res.status(400).json({ erro: 'Senha deve ter mínimo 6 caracteres' });
    }
    const senhaHash = bcryptReset.hashSync(senha, 10);
    const r = await aplicarNovaSenha(token, senhaHash);
    if (!r.ok) {
      const msgs = {
        expirado: 'Este link expirou. Peça um novo.',
        usado: 'Este link já foi usado. Peça um novo.',
        invalido: 'Link inválido.',
        sem_alvo: 'Não foi possível redefinir a senha.',
      };
      return res.status(400).json({ erro: msgs[r.motivo] || 'Erro ao redefinir' });
    }
    return res.json({ ok: true, mensagem: 'Senha redefinida com sucesso' });
  } catch (err) {
    console.error('❌ Erro em /reset-password:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Etapas 10 e 10b — CONVITE PARA O PORTAL DE FORNECEDORES
// O tenant convida um fornecedor local já cadastrado (POST /api/fornecedores/:id/convidar)
// ou um fornecedor novo só pelo e-mail (POST /api/fornecedores/convidar-novo).
// O fornecedor abre <FRONTEND_URL>/#convite?token=..., (no caso do novo, preenche
// CNPJ, dados e atuação), cria nome + senha e já entra no portal.
// ─────────────────────────────────────────────────────────────────────────────

const { carregarConvite, aceitar: aceitarConvite, dadosReceitaParaTela } = require('../services/convitesFornecedor');

const MSG_CONVITE = {
  invalido: 'Este convite não é válido.',
  expirado: 'Este convite expirou. Peça ao seu cliente um novo convite.',
  usado: 'Este convite já foi usado. Entre com seu e-mail e senha.',
  cancelado: 'Este convite foi substituído por um mais novo. Use o link do último e-mail recebido.',
  email_em_uso: 'Este e-mail já tem acesso ao portal. Entre com seu e-mail e senha.',
  // fornecedor novo (etapa 10b)
  cnpj_invalido: 'CNPJ inválido. Confira os 14 dígitos.',
  empresa_incompleta: 'Informe o nome fantasia da empresa.',
  cnpj_global: 'Sua empresa já faz parte da rede de fornecedores QuotaFlow e já pode receber as cotações deste cliente. Entre com seu login (ou use "Esqueci minha senha").',
  cnpj_ja_no_portal: 'Sua empresa já tem acesso ao portal para este cliente. Entre com seu login (ou use "Esqueci minha senha").',
  cnpj_nao_encontrado: 'CNPJ não encontrado na Receita Federal. Confira o número digitado.',
  cnpj_inativo: 'Este CNPJ não está ativo na Receita Federal.',
};

function mensagemConvite(r) {
  if (r.motivo === 'cnpj_inativo' && r.detalhe) {
    return `Este CNPJ consta como "${r.detalhe}" na Receita Federal. Só empresas com situação ATIVA podem se cadastrar.`;
  }
  return MSG_CONVITE[r.motivo] || 'Convite inválido';
}

/**
 * GET /api/auth/convite/validar?token=xxx
 * → { ok, novo, empresa, cliente, email, nome_sugerido, empresa_receita } | { ok:false, motivo, mensagem }
 *   novo = true: fornecedor ainda sem cadastro (a tela pede dados e atuação)
 *   empresa_receita (etapa 10c): CNPJ e dados da Receita escolhidos pelo tenant —
 *     a tela mostra travados; null em convite antigo (o fornecedor informa o CNPJ)
 */
router.get('/convite/validar', async (req, res) => {
  try {
    const r = await carregarConvite(req.query.token);
    if (r.motivo) return res.json({ ok: false, motivo: r.motivo, mensagem: mensagemConvite(r) });
    res.json({
      ok: true,
      novo: !!r.novo,
      empresa: r.fornecedor ? (r.fornecedor.nome_fantasia || r.fornecedor.nome || null) : null,
      nome_sugerido: r.novo ? (r.convite.nome_sugerido || null) : null,
      empresa_receita: r.novo ? dadosReceitaParaTela(r.convite) : null,
      cliente: r.tenant?.nome || null,
      email: r.convite.email,
      expira_em: r.convite.expira_em,
    });
  } catch (err) {
    console.error('❌ Erro em /convite/validar:', err.message);
    res.status(500).json({ erro: 'Erro ao validar convite' });
  }
});

/**
 * POST /api/auth/convite/aceitar
 * Body: { token, nome, senha, empresa? }
 *   empresa (só no convite de fornecedor novo): { cnpj, nome_fantasia, razao_social,
 *     endereco, numero, complemento, bairro, cidade, estado, cep, telefone, whatsapp,
 *     atuacao_* , marca_sugerida }
 * Cria o login do fornecedor e devolve o mesmo formato do /login-fornecedor.
 */
router.post('/convite/aceitar', async (req, res) => {
  try {
    const { token, nome, senha, empresa } = req.body || {};
    if (!token || !nome || !String(nome).trim() || !senha) {
      return res.status(400).json({ erro: 'Nome e senha são obrigatórios' });
    }
    if (String(senha).length < 6) {
      return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres' });
    }
    const r = await aceitarConvite({ token, nome, senhaHash: bcrypt.hashSync(String(senha), 10), empresa });
    if (r.motivo) return res.status(400).json({ erro: mensagemConvite(r), motivo: r.motivo });

    const { usuario, fornecedor } = r;
    const jwtToken = jwt.sign(
      { user_id: usuario.id, fornecedor_id: usuario.fornecedor_id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.status(201).json({
      ok: true,
      token: jwtToken,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil || 'vendedor',
        fornecedor_id: usuario.fornecedor_id,
        fornecedor_nome: fornecedor?.nome_fantasia || fornecedor?.nome || '',
      },
    });
  } catch (err) {
    console.error('❌ Erro em /convite/aceitar:', err.message);
    res.status(500).json({ erro: 'Erro ao criar acesso' });
  }
});

module.exports = router;