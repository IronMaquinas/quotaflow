// backend/routes/atLink.js — etapa 16c
//
// 📲 Link do motorista — /api/at-link/:token (PÚBLICO, sem login, SEM valores).
//   16e: POST /:token/etapa/:id/marcar { gps, em, por } · GET /:token/etapa/:id/preparar · POST /:token/etapa/:id/inspecao (mesmo corpo do app)
//   GET /:token   dados da viagem (rota, datas, conjunto, carga) + kit de documentos (CNH, CRLV do conjunto, NF-e/CT-e/MDF-e)
//                 com links assinados de 12 h (renovados a cada abertura). Registra a primeira visualização.
// Limite: 60 chamadas por link + IP a cada hora. Nunca 403 (padrão dos links públicos).

const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const E = require('../services/execucoes');
const FV = require('../services/fluxoViagem');

const usos = new Map(); const JANELA = 3600 * 1000, MAX = 60;
function excedeu(k) { const e = usos.get(k); const agora = Date.now(); if (!e || agora - e.desde > JANELA) { usos.set(k, { n: 1, desde: agora }); return false; } e.n++; return e.n > MAX; }
const ip = (req) => String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();

// 16e: 🧭 fluxo da viagem pelo link — a ordem é conferida no servidor
const etapa = (fn) => async (req, res) => {
  try {
    const ex = await E.porToken(supabase, req.params.token);
    if (!ex) return res.status(404).json({ erro: 'AT não encontrada — confira o link que você recebeu' });
    if (excedeu(`${ex.id}|${ip(req)}|etapa`)) return res.status(429).json({ erro: 'Muitos envios seguidos — espere um pouco e tente de novo.' });
    const r = await fn(req, ex);
    if (r && r.erro) { const { status, ...resto } = r; return res.status(status || 400).json(resto); }
    res.json(r);
  } catch (err) {
    const m = String(err?.message || '');
    if (/fluxo|execucao_id|etapa_id/.test(m) && /does not exist|schema cache|column/.test(m)) return res.status(409).json({ erro: 'Fluxo da viagem ainda não disponível (migration 057).' });
    console.error('❌ [at link etapa]', m);
    res.status(500).json({ erro: 'Erro interno' });
  }
};
router.post('/:token/etapa/:etapa/marcar', etapa((req, ex) => FV.marcar(supabase, ex, req.params.etapa, req.body || {})));
router.get('/:token/etapa/:etapa/preparar', etapa((req, ex) => FV.prepararInspecao(supabase, ex, req.params.etapa)));
router.post('/:token/etapa/:etapa/inspecao', etapa((req, ex) => FV.enviarInspecao(supabase, ex, req.params.etapa, req.body || {})));

router.get('/:token', async (req, res) => {
  try {
    const ex = await E.porToken(supabase, req.params.token);
    if (!ex) return res.status(404).json({ erro: 'AT não encontrada — confira o link que você recebeu' });
    if (excedeu(`${ex.id}|${ip(req)}`)) return res.status(429).json({ erro: 'Muitos acessos seguidos — espere um pouco e tente de novo.' });
    const r = await E.paginaMotorista(supabase, ex);
    if (r && r.erro) return res.status(r.status || 400).json({ erro: r.erro });
    res.json(r);
  } catch (err) {
    const m = String(err?.message || '');
    if (/token|does not exist|schema cache/.test(m)) return res.status(409).json({ erro: 'Link do motorista ainda não disponível (migration 056).' });
    console.error('❌ [at link]', m);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

module.exports = router;
