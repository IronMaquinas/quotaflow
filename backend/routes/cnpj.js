// ════════════════════════════════════════════════════════════════════════════════
// routes/cnpj.js: CONSULTA E MONITORAMENTO DE CNPJ
// ════════════════════════════════════════════════════════════════════════════════
// Endpoints:
// GET    /api/cnpj/:cnpj            - Consultar CNPJ
// GET    /api/cnpj                  - Listar últimas consultas
// POST   /api/cnpj/monitorar/:id    - Adicionar fornecedor para monitoramento
// ════════════════════════════════════════════════════════════════════════════════

const express = require("express");
const router = express.Router();
const axios = require("axios");
const { DB } = require("../db");
const tenantMiddleware = require("../middleware/tenantMiddleware");

// ─────────────────────────────────────────────────────────────────────────
// GET /api/cnpj/:cnpj - Consultar CNPJ em API pública
// ─────────────────────────────────────────────────────────────────────────

router.get("/:cnpj", tenantMiddleware, async (req, res) => {
  try {
    const { cnpj } = req.params;
    
    // Limpar CNPJ (remover caracteres especiais)
    const cnpjLimpo = cnpj.replace(/\D/g, "");

    if (cnpjLimpo.length !== 14) {
      return res.status(400).json({ erro: "CNPJ deve ter 14 dígitos" });
    }

    // Tentar consultar em API pública (exemplo: Brasil API)
    // Você pode trocar por outra API conforme preferência
    try {
      const response = await axios.get(
        `https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`,
        { timeout: 5000 }
      );

      const dados = response.data;

      res.json({
        ok: true,
        cnpj: cnpjLimpo,
        nome: dados.nome_fantasia || dados.razao_social,
        razao_social: dados.razao_social,
        situacao: dados.descricao || "Ativa",
        atividade_principal: dados.cnae_fiscal_descricao,
        endereco: `${dados.logradouro}, ${dados.numero} - ${dados.bairro}, ${dados.municipio}/${dados.uf}`,
        telefone: dados.ddd_telefone_1 || "N/A",
        email: dados.email || "N/A",
        capital_social: dados.capital_social,
        data_constituicao: dados.data_constituicao,
        natureza_juridica: dados.natureza_juridica_descricao,
        fonte: "Brasil API"
      });

    } catch (apiError) {
      // Se falhar na API pública, retornar mensagem informativa
      console.warn(`⚠️ Falha ao consultar CNPJ ${cnpjLimpo} na API pública:`, apiError.message);
      
      res.status(502).json({
        erro: "Não foi possível consultar este CNPJ",
        detalhes: "O serviço de consulta de CNPJ está temporariamente indisponível",
        cnpj: cnpjLimpo,
        dica: "Tente novamente em alguns minutos ou verifique o CNPJ digitado"
      });
    }

  } catch (err) {
    console.error("❌ Erro ao consultar CNPJ:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/cnpj - Listar histórico de consultas do tenant
// ─────────────────────────────────────────────────────────────────────────

router.get("/", tenantMiddleware, async (req, res) => {
  try {
    const fornecedores = await DB.raw(`
      SELECT 
        id, 
        nome, 
        cnpj, 
        situacao_cnpj, 
        ultima_consulta_cnpj,
        dados_cnpj
      FROM fornecedores
      WHERE tenant_id = $1 AND cnpj IS NOT NULL
      ORDER BY ultima_consulta_cnpj DESC NULLS LAST
      LIMIT 50
    `, [req.tenantId]);

    const resultado = fornecedores.map(f => ({
      fornecedor_id: f.id,
      fornecedor_nome: f.nome,
      cnpj: f.cnpj,
      situacao: f.situacao_cnpj,
      ultima_consulta: f.ultima_consulta_cnpj,
      dados: f.dados_cnpj ? JSON.parse(f.dados_cnpj) : null
    }));

    res.json(resultado);

  } catch (err) {
    console.error("❌ Erro ao listar consultas:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/cnpj/monitorar/:id - Adicionar fornecedor para monitoramento
// ─────────────────────────────────────────────────────────────────────────

router.post("/monitorar/:id", tenantMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que fornecedor pertence ao tenant
    const fornecedor = await DB.selectOne("fornecedores", { id }, req.tenantId);
    
    if (!fornecedor) {
      return res.status(404).json({ erro: "Fornecedor não encontrado" });
    }

    if (!fornecedor.cnpj) {
      return res.status(400).json({ erro: "Fornecedor não tem CNPJ cadastrado" });
    }

    const cnpjLimpo = fornecedor.cnpj.replace(/\D/g, "");

    // Consultar CNPJ na API
    try {
      const response = await axios.get(
        `https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`,
        { timeout: 5000 }
      );

      const dados = response.data;
      const situacao = dados.descricao || "Ativa";

      // Verificar se houve mudança de situação
      let alerta = null;
      if (fornecedor.situacao_cnpj && fornecedor.situacao_cnpj !== situacao) {
        alerta = await DB.insert("cnpj_alertas", {
          fornecedor_id: id,
          situacao_anterior: fornecedor.situacao_cnpj,
          situacao_nova: situacao,
          lido: 0
        }, req.tenantId);
      }

      // Atualizar fornecedor com dados da consulta
      const updated = await DB.update("fornecedores", id, {
        situacao_cnpj: situacao,
        dados_cnpj: JSON.stringify(dados),
        ultima_consulta_cnpj: new Date().toISOString()
      }, req.tenantId);

      res.json({
        ok: true,
        fornecedor: updated.nome,
        situacao,
        alerta_criado: !!alerta,
        mensagem: alerta 
          ? `⚠️ Alerta: Situação do CNPJ mudou de "${fornecedor.situacao_cnpj}" para "${situacao}"`
          : "CNPJ monitorado com sucesso"
      });

    } catch (apiError) {
      console.warn(`⚠️ Falha ao consultar CNPJ ${cnpjLimpo}:`, apiError.message);
      
      res.status(502).json({
        erro: "Não foi possível consultar este CNPJ",
        detalhes: "O serviço de consulta está indisponível"
      });
    }

  } catch (err) {
    console.error("❌ Erro ao monitorar CNPJ:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/cnpj/alertas - Listar alertas de CNPJ do tenant
// ─────────────────────────────────────────────────────────────────────────

router.get("/alertas/listar", tenantMiddleware, async (req, res) => {
  try {
    const alertas = await DB.raw(`
      SELECT 
        ca.id,
        ca.fornecedor_id,
        ca.situacao_anterior,
        ca.situacao_nova,
        ca.detectado_em,
        ca.lido,
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

module.exports = router;