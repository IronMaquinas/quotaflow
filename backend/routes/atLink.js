// backend/routes/atLink.js — etapa 16c
//
// 📲 Link do motorista — /api/at-link/:token (PÚBLICO, sem login, SEM valores).
//   GET /:token   dados da viagem (rota, datas, conjunto, carga) + kit de documentos (CNH, CRLV do conjunto, NF-e/CT-e/MDF-e)
//                 com links assinados de 12 h (renovados a cada abertura). Registra a primeira visualização.
// Limite: 60 chamadas por link + IP a cada hora. Nunca 403 (padrão dos links públicos).

const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const E = require('../services/execucoes');

const usos = new Map(); const JANELA = 3600 * 1000, MAX = 60;
function excedeu(k) { const e = usos.get(k); const agora = Date.now(); if (!e || agora - e.desde > JANELA) { usos.set(k, { n: 1, desde: agora }); return false; } e.n++; return e.n > MAX; }
const ip = (req) => String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();

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
