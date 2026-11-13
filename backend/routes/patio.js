// backend/routes/patio.js — etapas 18z/18z.1 (pré-entrada pelo XML, chegada): 📦 propriedade do cliente (pátio). Montada em /api/patio (tenantMiddleware + módulo patio_cliente).
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const P = require('../services/patio');
const PODE = ['admin', 'gestor', 'comprador', 'operacao'];
const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));
const pode = (req) => perfisDe(req).some((p) => PODE.includes(p));
const quem = async (req) => { const u = (await supabase.from('usuarios').select('*').eq('id', req.userId)).data?.[0]; return { id: req.userId, nome: u?.nome || null }; };
const responder = (fn) => async (req, res) => {
  try { if (!pode(req)) return res.status(409).json({ erro: 'Seu perfil não acessa o pátio' }); const r = await fn(req); if (r?.status) return res.status(r.status).json({ erro: r.erro }); res.json(r); }
  catch (e) { console.error('❌ [patio]', e.message); res.status(500).json({ erro: e.message }); }
};
router.get('/', responder((req) => P.listar(supabase, req.tenantId, { status: req.query.status || 'no_patio', busca: req.query.busca, cliente: req.query.cliente })));
router.get('/clientes', responder(async (req) => ({ clientes: (await require('../services/clientes').listar(supabase, req.tenantId)).map((c) => ({ id: c.id, nome: c.nome, razao_social: c.razao_social || null, documento: c.documento || null })) })));
router.post('/xml', express.text({ type: '*/*', limit: '5mb' }), responder((req) => P.lerXmlDoTenant(supabase, req.tenantId, typeof req.body === 'string' ? req.body : String(req.body?.xml || ''))));
router.post('/pre-entradas', responder(async (req) => P.preEntradas(supabase, req.tenantId, await quem(req), req.body || {})));
router.get('/:id', responder((req) => P.detalhe(supabase, req.tenantId, req.params.id)));
router.post('/', responder(async (req) => P.entrada(supabase, req.tenantId, await quem(req), req.body || {})));
router.put('/:id', responder((req) => P.editar(supabase, req.tenantId, req.params.id, req.body || {})));
router.post('/:id/fotos', responder((req) => P.foto(supabase, req.tenantId, req.params.id, req.body || {})));
router.post('/:id/saida', responder(async (req) => P.saida(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
router.post('/:id/chegada', responder(async (req) => P.confirmarChegada(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
router.delete('/:id', responder((req) => P.cancelarPre(supabase, req.tenantId, req.params.id)));
module.exports = router;
