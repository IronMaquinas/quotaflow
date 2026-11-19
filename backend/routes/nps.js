// routes/nps.js — etapa N1: ⭐ NPS (admin, gestor, comercial)
//   GET /painel?de&ate · POST / { cliente_nome, cliente_id?, contato_nome?, email?, origem_ref?, enviar? } · POST /:id/reenviar { email? } · POST /:id/cancelar
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const N = require('../services/nps');
const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));
const pode = (req) => perfisDe(req).some((p) => ['admin', 'gestor', 'comercial'].includes(p));
const quem = async (req) => { try { const { data } = await supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId).eq('id', req.userId); return { id: req.userId, nome: data?.[0]?.nome || 'Usuário' }; } catch { return { id: req.userId, nome: 'Usuário' }; } };
const resp = (fn) => async (req, res) => {
  if (!pode(req)) return res.status(403).json({ erro: 'Sem acesso ao NPS.' });
  try { const r = await fn(req); if (r?.erro) return res.status(r.status || 400).json(r); res.json(r); }
  catch (err) { if (/nps_pesquisas|nps_modelos|does not exist|schema cache/.test(String(err.message))) return res.status(409).json({ erro: 'Falta rodar a migration do NPS (112 / 113).' }); console.error('❌ [nps]', err.message); res.status(500).json({ erro: 'Não consegui agora.' }); }
};
router.get('/painel', resp((req) => N.painel(supabase, req.tenantId, { de: req.query.de || null, ate: req.query.ate || null })));
router.post('/', resp(async (req) => N.criar(supabase, req.tenantId, await quem(req), req.body || {})));
router.post('/:id/reenviar', resp((req) => N.reenviar(supabase, req.tenantId, req.params.id, req.body || {})));
// N1.1: ⚙ modelos de pesquisa
router.get('/modelos', resp(async (req) => ({ modelos: await N.modelos(supabase, req.tenantId), tipos: N.TIPOS })));
router.post('/modelos', resp((req) => N.salvarModelo(supabase, req.tenantId, null, req.body || {})));
router.put('/modelos/:id', resp((req) => N.salvarModelo(supabase, req.tenantId, req.params.id, req.body || {})));
router.delete('/modelos/:id', resp((req) => N.excluirModelo(supabase, req.tenantId, req.params.id)));
router.post('/modelos/:id/padrao', resp((req) => N.definirPadrao(supabase, req.tenantId, req.params.id)));
router.post('/:id/cancelar', resp((req) => N.cancelar(supabase, req.tenantId, req.params.id)));
module.exports = router;
