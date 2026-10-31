// backend/routes/minhasViagens.js — etapa 17a
//
// 🚛 "Minhas viagens" — /api/minhas-viagens (motorista LOGADO: usuário ligado a um colaborador em colaboradores.usuario_id).
//   GET /   { eu, ativas, historico (90 dias), colegas (só a agenda, leitura) }
// A execução das etapas usa o mesmo fluxo do 📲 link (/api/at-link/:token) — o token só vem nas ATs do próprio motorista.
// (403 desloga no front — "não ligado"/"desligado" respondem 409)

const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const E = require('../services/execucoes');
const P = require('../services/provaOnline');

router.get('/', async (req, res) => {
  try {
    const col = await P.colaboradorDoUsuario(supabase, req.tenantId, req.userId);
    if (!col) return res.status(409).json({ erro: 'Seu usuário não está ligado a um colaborador — peça ao RH/gestor para ligar em 👷 Pessoas → Acesso.', codigo: 'sem_colaborador' });
    if (col.situacao === 'desligado') return res.status(409).json({ erro: 'Cadastro desligado' });
    res.json(await E.minhasViagens(supabase, req.tenantId, col));
  } catch (err) {
    const m = String(err?.message || '');
    if (/execucoes/.test(m) && /does not exist|schema cache/.test(m)) return res.status(409).json({ erro: 'Programação ainda não disponível (migrations 055+).' });
    console.error('❌ [minhas viagens]', m); res.status(500).json({ erro: 'Erro interno' });
  }
});

module.exports = router;
