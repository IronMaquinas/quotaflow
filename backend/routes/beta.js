// routes/beta.js — etapa B1: 👋 POST /api/beta — pergunta à Beta (gestor/admin nesta fase; só consulta)
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const B = require('../services/beta');
const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));

router.post('/', async (req, res) => {
  const perfis = perfisDe(req);
  if (!perfis.some((p) => ['admin', 'gestor'].includes(p))) return res.status(403).json({ erro: 'A Beta está disponível para gestores nesta fase.' });
  try {
    let nome = ''; try { const { data } = await supabase.from('usuarios').select('nome').eq('id', req.userId).limit(1); nome = data?.[0]?.nome || ''; } catch { /* segue */ }
    const r = await B.perguntar(supabase, { tenantId: req.tenantId, userId: req.userId, perfis, nome, mensagens: req.body?.mensagens });
    if (r.erro) return res.status(r.status || 400).json(r);
    res.json(r);
  } catch (err) { console.error('❌ beta:', err.message); res.status(500).json({ erro: 'A Beta não conseguiu responder agora.' }); }
});

module.exports = router;
