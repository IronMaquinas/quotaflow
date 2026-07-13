// ════════════════════════════════════════════════════════════════════════════════
// routes/fornecedores.js (REFATORADO PARA MULTI-TENANT)
// ════════════════════════════════════════════════════════════════════════════════

const express = require("express");
const router = express.Router();
const { DB } = require("../db");
const tenantMiddleware = require("../middleware/tenantMiddleware");
const axios = require("axios");

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/fornecedores — Listar fornecedores do tenant
// ─────────────────────────────────────────────────────────────────────────────

router.get("/", tenantMiddleware, async (req, res) => {
  try {
    // Buscar fornecedores apenas do tenant logado
    const fornecedores = await DB.select("fornecedores", {}, req.tenantId);
    
    // Parse JSON fields
    const parsed = fornecedores.map(f => ({
      ...f,
      contatos: f.contatos ? JSON.parse(f.contatos) : [],
      categorias: f.categorias ? JSON.parse(f.categorias) : [],
      dados_cnpj: f.dados_cnpj ? JSON.parse(f.dados_cnpj) : null
    }));

    res.json(parsed);
  } catch (err) {
    console.error("❌ Erro ao listar fornecedores:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/fornecedores — Criar novo fornecedor
// ─────────────────────────────────────────────────────────────────────────────

router.post("/", tenantMiddleware, async (req, res) => {
  try {
    const {
      nome,
      razao_social,
      cnpj,
      endereco,
      cidade,
      estado,
      cep,
      contatos,
      categorias,
      obs
    } = req.body;

    if (!nome) {
      return res.status(400).json({ erro: "Nome é obrigatório" });
    }

    // Inserir com tenant_id automaticamente
    const fornecedor = await DB.insert("fornecedores", {
      nome,
      razao_social,
      cnpj,
      endereco,
      cidade,
      estado,
      cep,
      contatos: contatos ? JSON.stringify(contatos) : null,
      categorias: categorias ? JSON.stringify(categorias) : null,
      obs,
      ativo: 1
    }, req.tenantId);  // ← tenant_id injetado aqui

    // Parse JSON
    fornecedor.contatos = fornecedor.contatos ? JSON.parse(fornecedor.contatos) : [];
    fornecedor.categorias = fornecedor.categorias ? JSON.parse(fornecedor.categorias) : [];

    res.status(201).json(fornecedor);
  } catch (err) {
    console.error("❌ Erro ao criar fornecedor:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/fornecedores/:id — Atualizar fornecedor
// ─────────────────────────────────────────────────────────────────────────────

router.put("/:id", tenantMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, contatos, categorias, ...rest } = req.body;

    // Verificar que fornecedor pertence ao tenant
    const fornecedor = await DB.selectOne("fornecedores", { id }, req.tenantId);
    if (!fornecedor) {
      return res.status(404).json({ erro: "Fornecedor não encontrado" });
    }

    // Atualizar
    const updated = await DB.update("fornecedores", id, {
      nome,
      contatos: contatos ? JSON.stringify(contatos) : fornecedor.contatos,
      categorias: categorias ? JSON.stringify(categorias) : fornecedor.categorias,
      ...rest
    }, req.tenantId);  // ← tenant_id validado

    // Parse JSON
    updated.contatos = updated.contatos ? JSON.parse(updated.contatos) : [];
    updated.categorias = updated.categorias ? JSON.parse(updated.categorias) : [];

    res.json(updated);
  } catch (err) {
    console.error("❌ Erro ao atualizar fornecedor:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/fornecedores/:id — Deletar fornecedor
// ─────────────────────────────────────────────────────────────────────────────

router.delete("/:id", tenantMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que fornecedor pertence ao tenant
    const fornecedor = await DB.selectOne("fornecedores", { id }, req.tenantId);
    if (!fornecedor) {
      return res.status(404).json({ erro: "Fornecedor não encontrado" });
    }

    await DB.delete("fornecedores", id, req.tenantId);
    res.json({ ok: true, mensagem: "Fornecedor deletado" });
  } catch (err) {
    console.error("❌ Erro ao deletar fornecedor:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/fornecedores/alertas-cnpj — Alertas de CNPJ
// ─────────────────────────────────────────────────────────────────────────────

router.get("/alertas-cnpj", tenantMiddleware, async (req, res) => {
  try {
    const alertas = await DB.select("cnpj_alertas", {}, req.tenantId);
    res.json(alertas);
  } catch (err) {
    console.error("❌ Erro ao listar alertas:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cnpj/:cnpj — Consultar CNPJ (PROVIDER EXTERNO)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/:cnpj", tenantMiddleware, async (req, res) => {
  try {
    const { cnpj } = req.params;
    const clean = cnpj.replace(/\D/g, "");

    if (clean.length !== 14) {
      return res.status(400).json({ erro: "CNPJ inválido" });
    }

    // Chamar API pública de CNPJ (exemplo: manter.info ou similar)
    // NOTA: Adicione uma API de CNPJ confiável aqui
    const response = await axios.get(`https://api.sintegra.gov.br/v1/cnpj/${clean}`, {
      headers: { "Accept": "application/json" }
    }).catch(() => ({ data: null }));

    if (!response.data) {
      return res.json({ erro: "CNPJ não encontrado", cnpj: clean });
    }

    res.json({
      cnpj: clean,
      nome: response.data.nome || "N/A",
      situacao: response.data.situacao || "N/A",
      dados: response.data
    });
  } catch (err) {
    console.error("❌ Erro ao consultar CNPJ:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
