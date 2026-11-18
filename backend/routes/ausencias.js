// routes/ausencias.js — etapa B1.15: 🏖 quem está ausente (férias) num intervalo — para AT, OS, tarefas, turmas e a busca de pessoas.
//   Qualquer usuário interno da empresa (só nome e datas — nada sensível). GET /api/ausencias?de=YYYY-MM-DD&ate=YYYY-MM-DD
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const FE = require('../services/ferias');
const DATA = /^\d{4}-\d{2}-\d{2}$/;
router.get('/', async (req, res) => {
  try {
    const hoje = FE.hojeBR(); const de = DATA.test(req.query.de || '') ? req.query.de : hoje; const ate = DATA.test(req.query.ate || '') ? req.query.ate : FE.somaMeses(hoje, 12);
    res.json({ ausencias: await FE.ausencias(supabase, req.tenantId, de, ate > de ? ate : de) });
  } catch (err) { if (/colaborador_ferias/.test(String(err.message))) return res.json({ ausencias: [] }); console.error('❌ [ausencias]', err.message); res.status(500).json({ erro: 'Não consegui consultar as ausências.' }); }
});
module.exports = router;
