// backend/routes/monitorCnpj.js — etapa 14e: 🛡 Monitor de CNPJs (tenant) — /api/monitor-cnpj
//   GET  /                       → painel: base do tenant (fornecedores locais + clientes), globais irregulares nos
//                                  processos dele, justificativas registradas, andamento do ciclo
//   POST /verificar/:documento   → consulta agora na Receita (só CNPJ da base do tenant ou de fornecedor visível)
// Perfis: admin, gestor, comprador. Regras em services/monitorCnpj.js.
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const M = require('../services/monitorCnpj');

const PERFIS = ['admin', 'gestor', 'comprador'];
const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));
const exigir = (req, res, next) => (perfisDe(req).some((p) => PERFIS.includes(p)) ? next() : res.status(403).json({ erro: 'Sem acesso ao Monitor de CNPJs' }));
const responder = (fn) => async (req, res) => {
  try { const r = await fn(req); if (r && r.erro) return res.status(r.status || 400).json(r); res.json(r); }
  catch (err) { console.error('❌ [monitor-cnpj]', err.message); res.status(500).json({ erro: /relation|schema cache/i.test(err.message) ? 'Rode a migration 050 antes (Monitor de CNPJs)' : 'Erro interno — veja o log do servidor' }); }
};

router.get('/', exigir, responder((req) => M.painelTenant(supabase, req.tenantId)));
router.post('/verificar/:documento', exigir, responder(async (req) => {
  const doc = String(req.params.documento || '').replace(/\D/g, '');
  const p = await M.painelTenant(supabase, req.tenantId);
  if (![...p.base, ...p.globais].some((b) => b.documento === doc)) return { status: 404, erro: 'CNPJ fora da sua base' };
  return M.verificar(supabase, doc, { forcar: true });
}));

module.exports = router;
