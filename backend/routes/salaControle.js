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

// SC3: 🧠 frase do Analista Sênior (gestor/admin) — separada do painel para não atrasar a tela; 1 por dia, conferida
router.get('/analista', async (req, res) => {
  const perfis = perfisDe(req); if (!perfis.some((p) => ['admin', 'gestor'].includes(p))) return res.json({ texto: null });
  try { const painel = await SC.montar(supabase, { tenantId: req.tenantId, userId: req.userId, perfis }); res.json(await require('../services/salaControle/analista').fraseDoDia(supabase, req.tenantId, painel)); }
  catch (err) { console.warn('⚠️ sala-controle/analista:', err.message); res.json({ texto: null }); }
});

module.exports = router;
