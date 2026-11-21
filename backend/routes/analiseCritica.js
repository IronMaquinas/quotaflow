// routes/analiseCritica.js — etapa R2: 🧭 análise crítica pela direção (ISO 9001 9.3) — admin e gestor
//   GET / · POST / · GET /:id · PUT /:id (título, período, reunião, participantes, comentários, conclusão)
//   POST /:id/saidas · DELETE /:id/saidas/:sid · POST /:id/encerrar · /:id/reabrir · /:id/assinar { papel, nome, png } · /:id/cancelar { motivo }
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const A = require('../services/analiseCritica');
const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));
const quem = async (req) => { try { const { data } = await supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId).eq('id', req.userId); return { id: req.userId, nome: data?.[0]?.nome || 'Usuário' }; } catch { return { id: req.userId, nome: 'Usuário' }; } };
const r = (fn) => async (req, res) => {
  if (!perfisDe(req).some((p) => ['admin', 'gestor'].includes(p))) return res.status(403).json({ erro: 'A análise crítica é da direção (admin ou gestor).' });
  try { const x = await fn(req); if (x?.erro) return res.status(x.status || 400).json(x); res.json(x); }
  catch (err) { if (/analises_criticas|does not exist|schema cache/.test(String(err.message))) return res.status(409).json({ erro: 'Falta rodar a migration 120 (análise crítica).' }); console.error('❌ [analise-critica]', err.message); res.status(500).json({ erro: 'Não consegui agora.' }); }
};
router.get('/', r((req) => A.listar(supabase, req.tenantId)));
router.post('/', r(async (req) => A.criar(supabase, req.tenantId, await quem(req), req.body || {})));
router.get('/:id', r((req) => A.detalhe(supabase, req.tenantId, req.params.id)));
router.put('/:id', r((req) => A.atualizar(supabase, req.tenantId, req.params.id, req.body || {})));
router.post('/:id/saidas', r(async (req) => A.novaSaida(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
router.delete('/:id/saidas/:sid', r((req) => A.excluirSaida(supabase, req.tenantId, req.params.id, req.params.sid)));
router.post('/:id/encerrar', r((req) => A.encerrar(supabase, req.tenantId, req.params.id)));
router.post('/:id/reabrir', r((req) => A.reabrir(supabase, req.tenantId, req.params.id)));
router.post('/:id/assinar', r(async (req) => A.assinar(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
router.post('/:id/cancelar', r(async (req) => A.cancelar(supabase, req.tenantId, req.params.id, req.body || {}, await quem(req))));
module.exports = router;
