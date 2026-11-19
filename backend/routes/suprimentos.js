// routes/suprimentos.js — etapa R1: 📊 GET /api/suprimentos/painel?de=AAAA-MM-DD&ate=AAAA-MM-DD (admin, gestor, comprador)
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const S = require('../services/suprimentos');
const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));

router.get('/painel', async (req, res) => {
  if (!perfisDe(req).some((p) => ['admin', 'gestor', 'comprador'].includes(p))) return res.status(403).json({ erro: 'Sem acesso às análises de suprimentos.' });
  try { res.json(await S.painel(supabase, req.tenantId, { de: req.query.de, ate: req.query.ate })); }
  catch (err) { console.error('❌ suprimentos:', err.message); res.status(500).json({ erro: 'Não consegui montar as análises agora.' }); }
});

module.exports = router;
