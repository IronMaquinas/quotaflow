// backend/routes/bidLink.js — etapa 15b
//
// Link do cliente para o BID — /api/bid-link/:token (PÚBLICO, sem login — como o link da cotação do fornecedor).
//   GET  /:token                proposta (versão enviada) + estado; registra o "visualizado"
//   POST /:token/responder      { nome, cargo, geral, itens: { item_id: { decisao, motivo, comentario } } }
//   POST /:token/codigo         código de 6 dígitos por e-mail (para assinar o aceite)
//   POST /:token/aceitar        { codigo, nome, cargo, assinatura_png }
// Limite: 40 chamadas por link + IP a cada hora. Nunca 403 (o front da empresa desloga com 403 — aqui é público, mas por padrão).

const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const BC = require('../services/bidsCliente');

const usos = new Map(); const JANELA = 3600 * 1000, MAX = 40;
function excedeu(k) { const e = usos.get(k); const agora = Date.now(); if (!e || agora - e.desde > JANELA) { usos.set(k, { n: 1, desde: agora }); return false; } e.n++; return e.n > MAX; }
const ip = (req) => String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();

const responder = (fn) => async (req, res) => {
  try {
    const b = await BC.bidPorToken(supabase, req.params.token);
    if (!b) return res.status(404).json({ erro: 'Proposta não encontrada — confira o link do e-mail' });
    if (excedeu(`${b.id}|${ip(req)}`)) return res.status(429).json({ erro: 'Muitos acessos seguidos — espere um pouco e tente de novo.' });
    const r = await fn(req, b);
    if (r && r.erro) return res.status(r.status || 400).json({ erro: r.erro });
    res.json(r);
  } catch (err) {
    const m = String(err?.message || '');
    if (/bid_visualizacoes|token|versao_enviada|does not exist|schema cache/.test(m)) return res.status(409).json({ erro: 'Proposta por link ainda não disponível (migration 052).' });
    console.error('❌ [bid link]', m);
    res.status(500).json({ erro: 'Erro interno' });
  }
};

router.get('/:token', responder((req, b) => BC.paginaCliente(supabase, b, { ip: ip(req), agente: req.headers['user-agent'] })));
router.post('/:token/responder', responder((req, b) => BC.responder(supabase, b, req.body || {})));
router.post('/:token/codigo', responder((req, b) => BC.enviarCodigo(supabase, b)));
router.post('/:token/aceitar', responder((req, b) => BC.aceitar(supabase, b, req.body || {}, { ip: ip(req) })));

module.exports = router;
