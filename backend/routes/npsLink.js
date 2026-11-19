// routes/npsLink.js — etapa N1: ⭐ link PÚBLICO da pesquisa (sem login) — /api/nps-link/:token
//   GET /:token → empresa, cliente, referência, situação · POST /:token/responder { nota 0–10, motivos[], comentario, nome }
//   Limite: 30 chamadas por link + IP por hora. Nunca 403 (o front da empresa desloga com 403).
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const N = require('../services/nps');
const usos = new Map(); const JANELA = 3600e3; const MAX = 30;
const excedeu = (k) => { const e = usos.get(k); const t = Date.now(); if (!e || t - e.desde > JANELA) { usos.set(k, { n: 1, desde: t }); if (usos.size > 5000) usos.clear(); return false; } e.n++; return e.n > MAX; };
const ip = (req) => String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
const r = (fn) => async (req, res) => {
  try {
    const p = await N.porToken(supabase, req.params.token); if (!p) return res.status(404).json({ erro: 'Pesquisa não encontrada — confira o link.' });
    if (excedeu(`${p.id}|${ip(req)}`)) return res.status(429).json({ erro: 'Muitos acessos seguidos — tente de novo daqui a pouco.' });
    const x = await fn(req, p); if (x?.erro) return res.status(x.status || 400).json({ erro: x.erro }); res.json(x);
  } catch (err) { console.error('❌ [nps link]', err.message); res.status(500).json({ erro: 'Não consegui agora. Tente de novo em instantes.' }); }
};
router.get('/:token', r((req, p) => N.publico(supabase, p)));
router.post('/:token/responder', r((req, p) => N.responder(supabase, p, req.body || {})));
module.exports = router;
