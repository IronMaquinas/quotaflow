const express = require("express");
const { autenticar, requerPerfil } = require("./auth");
const router = express.Router();

// POST /api/email/reenviar — reenviar cotação para fornecedor
router.post("/reenviar", autenticar, requerPerfil("comprador","gestor","admin"), async (req, res) => {
  const { token } = req.body;
  const db = require("../db");
  const { enviarEmailCotacao } = require("../services/emailService");

  const cf = db.prepare(`
    SELECT cf.*, c.peca, c.codigo, c.numero, c.urgencia, c.equipamento_id,
           e.nome as equipamento_nome
    FROM cotacao_fornecedores cf
    JOIN cotacoes co ON co.id = cf.cotacao_id
    JOIN chamados c ON c.id = co.chamado_id
    LEFT JOIN equipamentos e ON e.id = c.equipamento_id
    WHERE cf.token = ?
  `).get(token);

  if (!cf) return res.status(404).json({ erro: "Token não encontrado." });

  try {
    await enviarEmailCotacao(cf, { nome: cf.fornecedor_nome, email: cf.fornecedor_email }, cf.token);
    res.json({ ok: true, mensagem: `E-mail reenviado para ${cf.fornecedor_email}` });
  } catch (e) {
    res.status(500).json({ erro: `Falha no envio: ${e.message}` });
  }
});

module.exports = router;
