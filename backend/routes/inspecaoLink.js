// backend/routes/inspecaoLink.js — etapa 14b.1
//
// Inspeção de terceiros — /api/inspecao-link/:token (PÚBLICO, sem login). O gestor gera o link em 🔍 Inspeções.
//   GET  /:token?placa=&veiculo=   empresa, modelo e (se o link não fixa o equipamento) pede a placa → dados para começar
//   POST /:token/enviar           { terceiro: { nome, cpf, empresa, telefone, placa, veiculo }, ...mesmo corpo do app }
// Limite: 30 envios por link + IP a cada hora (o envio é idempotente — a fila offline pode reenviar sem duplicar).

const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const I = require('../services/inspecoes');

const usos = new Map(); const JANELA = 3600 * 1000, MAX = 30;
function excedeu(k) { const e = usos.get(k); const agora = Date.now(); if (!e || agora - e.desde > JANELA) { usos.set(k, { n: 1, desde: agora }); return false; } e.n++; return e.n > MAX; }

const responder = (fn) => async (req, res) => {
  try {
    const link = await I.linkPorToken(supabase, req.params.token);
    if (!link) return res.status(404).json({ erro: 'Link de inspeção não encontrado' });
    const r = await fn(req, link);
    if (r && r.erro) return res.status(r.status || 400).json({ erro: r.erro });
    res.json(r);
  } catch (err) {
    const m = String(err?.message || '');
    if (/inspecao_links|does not exist|schema cache/.test(m)) return res.status(409).json({ erro: 'Inspeção por link ainda não disponível (migration 041).' });
    console.error('❌ [inspeção por link]', m);
    res.status(500).json({ erro: 'Erro interno' });
  }
};

router.get('/:token', responder((req, link) => I.prepararLink(supabase, link, { placa: req.query.placa, descricao: req.query.veiculo })));
router.post('/:token/enviar', responder((req, link) => {
  if (excedeu(`${link.id}|${req.ip}`)) return { status: 429, erro: 'Muitos envios seguidos — espere um pouco e tente de novo.' };
  return I.enviarPorLink(supabase, link, req.body || {});
}));

module.exports = router;
