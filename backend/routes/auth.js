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

function gerarTokens(usuario, tenant) {
  const payload = {
    user_id: usuario.id,
    tenant_id: tenant.id,
    email: usuario.email,
    perfil: usuario.perfil
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
// POST /api/auth/signup
// Criar nova transportadora + usuário admin
// ─────────────────────────────────────────────────────────────────────────────

router.post("/signup", async (req, res) => {
  try {
    const {
      empresa_nome,
      cnpj,
      email_admin,
      senha,
      telefone,
      regiao
    } = req.body;

    // Validações
    if (!empresa_nome || !email_admin || !senha) {
      return res.status(400).json({
        erro: "Campo obrigatório faltando",
        campos: ["empresa_nome", "email_admin", "senha"]
      });
    }

    if (senha.length < 6) {
      return res.status(400).json({ erro: "Senha deve ter mínimo 6 caracteres" });
    }

    // Criar slug único para a transportadora
    const slug = empresa_nome
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const slugUnico = slug + "-" + Math.random().toString(36).substr(2, 9);

    // 1. Criar tenant (transportadora)
    let tenant;
    try {
      tenant = await DB.insert("tenants", {
        slug: slugUnico,
        nome: empresa_nome,
        cnpj: cnpj || null,
        email_admin: email_admin,
        plano: "starter",
        status: "ativo",
        regiao: regiao || "SP",
        participa_benchmark: 1
      });
    } catch (err) {
      console.error("Erro ao criar tenant:", err.message);
      return res.status(500).json({ erro: "Erro ao criar transportadora" });
    }

    if (!tenant) {
      return res.status(500).json({ erro: "Erro ao criar transportadora" });
    }

    // 2. Criar usuário admin
    const senhaHash = bcrypt.hashSync(senha, 10);
    let usuario;
    try {
      usuario = await DB.insert("usuarios", {
        nome: empresa_nome + " Admin",
        email: email_admin,
        senha_hash: senhaHash,
        perfil: "admin",
        ativo: 1
      }, tenant.id);
    } catch (err) {
      console.error("Erro ao criar usuário:", err.message);
      // Deletar tenant se falhar ao criar usuário
      try {
        await DB.delete("tenants", tenant.id);
      } catch (delErr) {
        console.error("Erro ao deletar tenant:", delErr.message);
      }
      
      if (err.message.includes("duplicate") || err.message.includes("unique")) {
        return res.status(409).json({ erro: "Este email já está em uso" });
      }
      
      return res.status(500).json({ erro: "Erro ao criar usuário" });
    }

    if (!usuario) {
      return res.status(500).json({ erro: "Erro ao criar usuário" });
    }

    // 3. Gerar tokens
    const { accessToken, refreshToken } = gerarTokens(usuario, tenant);

    // 4. Responder com sucesso
    res.status(201).json({
      ok: true,
      mensagem: "Transportadora criada com sucesso!",
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        nome: tenant.nome
      },
      usuario: {
        id: usuario.id,
        email: usuario.email,
        perfil: usuario.perfil
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });

  } catch (err) {
    console.error("❌ Erro no signup:", err.message);
    res.status(500).json({ erro: err.message });
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

    // Gerar tokens
    const { accessToken, refreshToken } = gerarTokens(usuario, tenant);

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
        perfil: usuario.perfil
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
        regiao: tenant.regiao
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

module.exports = router;