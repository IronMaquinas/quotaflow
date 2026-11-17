// routes/beta.js — etapa B1: 👋 POST /api/beta — pergunta à Beta (B1.5: todos os perfis internos; cada consulta tem os seus; só consulta)
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const B = require('../services/beta');
const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));

// sugestões do painel conforme o perfil
router.get('/consultas', (req, res) => {
  const perfis = perfisDe(req); const gestor = perfis.some((p) => ['admin', 'gestor'].includes(p));
  res.json({ sugestoes: [...(gestor ? ['Como está minha empresa hoje?'] : []), ...require('../services/betaConsultas').permitidas(perfis).map((c) => c.exemplo)] });
});

router.post('/', async (req, res) => {
  const perfis = perfisDe(req);
  if (!perfis.length || perfis.every((p) => ['fornecedor', 'colaborador', 'tecnico'].includes(p))) return res.status(403).json({ erro: 'A Beta não está disponível para este acesso.' });
  try {
    let nome = ''; try { const { data } = await supabase.from('usuarios').select('nome').eq('id', req.userId).limit(1); nome = data?.[0]?.nome || ''; } catch { /* segue */ }
    const r = await B.perguntar(supabase, { tenantId: req.tenantId, userId: req.userId, perfis, nome, mensagens: req.body?.mensagens });
    if (r.erro) return res.status(r.status || 400).json(r);
    res.json(r);
  } catch (err) { console.error('❌ beta:', err.message); res.status(500).json({ erro: 'A Beta não conseguiu responder agora.' }); }
});

module.exports = router;
