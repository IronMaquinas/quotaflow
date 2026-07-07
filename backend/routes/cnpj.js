const express = require("express");
const axios = require("axios");
const db = require("../db");
const { autenticar } = require("./auth");
const router = express.Router();

// GET /api/cnpj/:cnpj — consulta Receita Federal via BrasilAPI
router.get("/:cnpj", autenticar, async (req, res) => {
  const cnpj = req.params.cnpj.replace(/\D/g, "");
  if (cnpj.length !== 14) return res.status(400).json({ erro: "CNPJ deve ter 14 dígitos." });

  try {
    const { data } = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { timeout: 10000 });
    res.json(data);
  } catch (e) {
    if (e.response?.status === 404) return res.status(404).json({ erro: "CNPJ não encontrado na Receita Federal." });
    if (e.code === "ECONNABORTED") return res.status(504).json({ erro: "Timeout na consulta. Tente novamente." });
    res.status(502).json({ erro: "Erro ao consultar a Receita Federal. Tente novamente em instantes." });
  }
});

// POST /api/cnpj/atualizar-todos — job manual (admin)
router.post("/atualizar-todos", autenticar, async (req, res) => {
  const { verificarCNPJsFornecedores } = require("../jobs/cnpjMonitor");
  res.json({ ok: true, mensagem: "Verificação iniciada em background." });
  verificarCNPJsFornecedores().catch(console.error);
});

module.exports = router;
