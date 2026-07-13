// ════════════════════════════════════════════════════════════════════════════════
// routes/fornecedores.js: FORNECEDORES MULTI-TENANT (SUPABASE)
// ════════════════════════════════════════════════════════════════════════════════

const express = require("express");
const router = express.Router();
const { DB } = require("../db");
const tenantMiddleware = require("../middleware/tenantMiddleware");

// ─────────────────────────────────────────────────────────────────────────
// GET /api/fornecedores - Listar fornecedores do tenant
// ─────────────────────────────────────────────────────────────────────────

router.get("/", tenantMiddleware, async (req, res) => {
  try {
    const fornecedores = await DB.select("fornecedores", {}, req.tenantId);
    
    const parsed = fornecedores.map(f => ({
      ...f,
      contatos: f.contatos ? JSON.parse(f.contatos) : [],
      categorias: f.categorias ? JSON.parse(f.categorias) : [],
      dados_cnpj: f.dados_cnpj ? JSON.parse(f.dados_cnpj) : null,
    }));

    res.json(parsed);
  } catch (err) {
    console.error("❌ Erro ao listar fornecedores:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/fornecedores/:id - Buscar fornecedor por ID
// ─────────────────────────────────────────────────────────────────────────

router.get("/:id", tenantMiddleware, async (req, res) => {
  try {
    const fornecedor = await DB.selectOne("fornecedores", { id: req.params.id }, req.tenantId);
    
    if (!fornecedor) {
      return res.status(404).json({ erro: "Fornecedor não encontrado" });
    }

    fornecedor.contatos = fornecedor.contatos ? JSON.parse(fornecedor.contatos) : [];
    fornecedor.categorias = fornecedor.categorias ? JSON.parse(fornecedor.categorias) : [];
    fornecedor.dados_cnpj = fornecedor.dados_cnpj ? JSON.parse(fornecedor.dados_cnpj) : null;

    res.json(fornecedor);
  } catch (err) {
    console.error("❌ Erro ao buscar fornecedor:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/fornecedores - Criar novo fornecedor
// ─────────────────────────────────────────────────────────────────────────

router.post("/", tenantMiddleware, async (req, res) => {
  try {
    const {
      nome,
      razao_social,
      cnpj,
      endereco,
      numero,
      complemento,
      bairro,
      cidade,
      estado,
      cep,
      contatos,
      categorias,
      obs,
      latitude,
      longitude,
    } = req.body;

    if (!nome) {
      return res.status(400).json({ erro: "Nome é obrigatório" });
    }

    // Preparar dados para inserção
    const fornecedorData = {
      nome,
      razao_social: razao_social || null,
      cnpj: cnpj ? cnpj.replace(/\D/g, '') : null,
      endereco: endereco || null,
      numero: numero || null,
      complemento: complemento || null,
      bairro: bairro || null,
      cidade: cidade || null,
      estado: estado || null,
      cep: cep || null,
      contatos: contatos ? JSON.stringify(contatos) : null,
      categorias: categorias ? JSON.stringify(categorias) : null,
      obs: obs || null,
      latitude: latitude || null,
      longitude: longitude || null,
      ativo: 1,
    };

    const fornecedor = await DB.insert("fornecedores", fornecedorData, req.tenantId);

    // Parsear os campos JSON para retornar no formato esperado
    fornecedor.contatos = contatos || [];
    fornecedor.categorias = categorias || [];
    fornecedor.dados_cnpj = null;

    res.status(201).json(fornecedor);
  } catch (err) {
    console.error("❌ Erro ao criar fornecedor:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUT /api/fornecedores/:id - Atualizar fornecedor
// ─────────────────────────────────────────────────────────────────────────

router.put("/:id", tenantMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nome,
      razao_social,
      cnpj,
      endereco,
      numero,
      complemento,
      bairro,
      cidade,
      estado,
      cep,
      contatos,
      categorias,
      obs,
      latitude,
      longitude,
      ativo,
    } = req.body;

    // Verificar que fornecedor pertence ao tenant
    const fornecedor = await DB.selectOne("fornecedores", { id }, req.tenantId);
    if (!fornecedor) {
      return res.status(404).json({ erro: "Fornecedor não encontrado" });
    }

    // Preparar dados para atualização (apenas campos enviados)
    const updateData = {};
    if (nome !== undefined) updateData.nome = nome;
    if (razao_social !== undefined) updateData.razao_social = razao_social;
    if (cnpj !== undefined) updateData.cnpj = cnpj.replace(/\D/g, '');
    if (endereco !== undefined) updateData.endereco = endereco;
    if (numero !== undefined) updateData.numero = numero;
    if (complemento !== undefined) updateData.complemento = complemento;
    if (bairro !== undefined) updateData.bairro = bairro;
    if (cidade !== undefined) updateData.cidade = cidade;
    if (estado !== undefined) updateData.estado = estado;
    if (cep !== undefined) updateData.cep = cep;
    if (contatos !== undefined) updateData.contatos = JSON.stringify(contatos);
    if (categorias !== undefined) updateData.categorias = JSON.stringify(categorias);
    if (obs !== undefined) updateData.obs = obs;
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;
    if (ativo !== undefined) updateData.ativo = ativo ? 1 : 0;

    const updated = await DB.update("fornecedores", id, updateData, req.tenantId);

    // Parsear campos JSON para resposta
    updated.contatos = updated.contatos ? JSON.parse(updated.contatos) : [];
    updated.categorias = updated.categorias ? JSON.parse(updated.categorias) : [];
    updated.dados_cnpj = updated.dados_cnpj ? JSON.parse(updated.dados_cnpj) : null;

    res.json(updated);
  } catch (err) {
    console.error("❌ Erro ao atualizar fornecedor:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// DELETE /api/fornecedores/:id - Deletar fornecedor
// ─────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────
// GET /api/fornecedores/alertas-cnpj - Alertas de CNPJ (mantido)
// ─────────────────────────────────────────────────────────────────────────

router.get("/alertas/cnpj", tenantMiddleware, async (req, res) => {
  try {
    const alertas = await DB.raw(`
      SELECT 
        ca.id, ca.fornecedor_id, ca.situacao_anterior, ca.situacao_nova, 
        ca.detectado_em, ca.lido,
        f.nome as fornecedor_nome
      FROM cnpj_alertas ca
      JOIN fornecedores f ON f.id = ca.fornecedor_id
      WHERE ca.tenant_id = $1
      ORDER BY ca.detectado_em DESC
    `, [req.tenantId]);

    res.json(alertas);
  } catch (err) {
    console.error("❌ Erro ao listar alertas:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUT /api/fornecedores/alertas-cnpj/:id/ler - Marcar alerta como lido
// ─────────────────────────────────────────────────────────────────────────

router.put("/alertas-cnpj/:id/ler", tenantMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    await DB.raw(`
      UPDATE cnpj_alertas 
      SET lido = 1 
      WHERE id = $1 AND tenant_id = $2
    `, [id, req.tenantId]);

    res.json({ ok: true, mensagem: "Alerta marcado como lido" });
  } catch (err) {
    console.error("❌ Erro ao atualizar alerta:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;