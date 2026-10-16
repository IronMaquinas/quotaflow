// backend/routes/atuacao.js
//
// GET /api/atuacao/opcoes — listas do perfil de atuação (segmento, sistema,
// marca, oferta, uf). Usado pelo portal do fornecedor, pela tela de
// fornecedores do tenant e pelo Canal Spot.
//
// Sem middleware de autenticação de propósito: são listas de referência, sem
// dado de tenant nem de fornecedor, e precisam funcionar nos dois logins
// (JWT do tenant e JWT do portal do fornecedor).

const express = require('express');
const router = express.Router();
const { DB } = require('../db');
const { opcoesAgrupadas } = require('../services/atuacao');

router.get('/opcoes', async (req, res) => {
  try {
    res.json(await opcoesAgrupadas(DB));
  } catch (err) {
    console.error('❌ GET /atuacao/opcoes:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
