// routes/valorGerado.js — etapa 5a: 💰 GET /api/valor-gerado?ano=AAAA (gestor/admin)
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const VG = require('../services/valorGerado');
const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));

router.get('/', async (req, res) => {
  if (!perfisDe(req).some((p) => ['admin', 'gestor'].includes(p))) return res.status(403).json({ erro: 'Só gestor ou admin veem o valor gerado.' });
  const ano = /^\d{4}$/.test(String(req.query.ano || '')) ? String(req.query.ano) : null;
  try { res.json(await VG.calcular(supabase, req.tenantId, { ano })); }
  catch (err) { console.error('❌ valor-gerado:', err.message); res.status(500).json({ erro: 'Não consegui calcular o valor gerado agora.' }); }
});

module.exports = router;
