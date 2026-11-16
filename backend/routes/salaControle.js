// routes/salaControle.js — etapa SC1: 🛰 GET /api/sala-controle — o Início de cada pessoa
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const SC = require('../services/salaControle');
const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));

router.get('/', async (req, res) => {
  try {
    let nome = ''; try { const { data } = await supabase.from('usuarios').select('nome').eq('id', req.userId).limit(1); nome = data?.[0]?.nome || ''; } catch { /* segue */ }
    res.json(await SC.montar(supabase, { tenantId: req.tenantId, userId: req.userId, perfis: perfisDe(req), nome }));
  } catch (err) { console.error('❌ sala-controle:', err.message); res.status(500).json({ erro: 'Não consegui montar a sala de controle agora.' }); }
});

module.exports = router;
