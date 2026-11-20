// routes/auditorias.js — etapa A1: 🔎 auditorias (admin, gestor, qualidade)
//   GET /programa?ano · POST / · GET /:id · PUT /:id · POST /:id/constatacoes · DELETE /constatacoes/:id
//   A1.1: PUT /constatacoes/:id (rascunho) · POST /:id/iniciar · /:id/encerrar · /:id/reabrir · /:id/assinar { papel, nome, png } · /:id/cancelar
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const A = require('../services/auditorias');
const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));
const quem = async (req) => { try { const { data } = await supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId).eq('id', req.userId); return { id: req.userId, nome: data?.[0]?.nome || 'Usuário' }; } catch { return { id: req.userId, nome: 'Usuário' }; } };
const r = (fn) => async (req, res) => {
  if (!perfisDe(req).some((p) => ['admin', 'gestor', 'qualidade'].includes(p))) return res.status(403).json({ erro: 'Sem acesso às auditorias.' });
  try { const x = await fn(req); if (x?.erro) return res.status(x.status || 400).json(x); res.json(x); }
  catch (err) { if (/auditoria|does not exist|schema cache/.test(String(err.message))) return res.status(409).json({ erro: 'Falta rodar a migration 114 (auditorias).' }); console.error('❌ [auditorias]', err.message); res.status(500).json({ erro: 'Não consegui agora.' }); }
};
router.get('/programa', r((req) => A.programa(supabase, req.tenantId, req.query.ano)));
router.post('/', r(async (req) => A.criar(supabase, req.tenantId, await quem(req), req.body || {})));
router.delete('/constatacoes/:id', r((req) => A.excluirConstatacao(supabase, req.tenantId, req.params.id)));
router.put('/constatacoes/:id', r((req) => A.editarConstatacao(supabase, req.tenantId, req.params.id, req.body || {}))); // A1.1: rascunho
router.get('/:id', r((req) => A.detalhe(supabase, req.tenantId, req.params.id)));
router.post('/:id/iniciar', r((req) => A.iniciar(supabase, req.tenantId, req.params.id)));
router.post('/:id/encerrar', r((req) => A.encerrar(supabase, req.tenantId, req.params.id)));
router.post('/:id/reabrir', r((req) => A.reabrir(supabase, req.tenantId, req.params.id)));
router.post('/:id/assinar', r(async (req) => A.assinar(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
router.post('/:id/cancelar', r(async (req) => A.cancelar(supabase, req.tenantId, req.params.id, req.body || {}, await quem(req)))); // A1.1.3: { motivo }
router.put('/:id', r((req) => A.atualizar(supabase, req.tenantId, req.params.id, req.body || {})));
router.post('/:id/constatacoes', r(async (req) => A.constatar(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
module.exports = router;
