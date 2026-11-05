// backend/routes/ocorrencias.js — etapa 18h
//
// ⚠️ Ocorrências / sinistros (SIN-AAAA-NNNN) — /api/ocorrencias (visão da EMPRESA). O locatário usa /api/locatario/ocorrencias.
//   GET  /?contrato_id=&execucao_id=&origem=&status=abertas   lista
//   GET  /:id                                                 detalhe (fotos com link assinado, conversa, histórico, contexto)
//   POST /                                                    { origem:'at'|'contrato', execucao_id | contrato_id+equipamento_id, tipo, parado, ocorrido_em, local, gps, descricao, inspecao_id }
//   PUT  /:id                                                 { status, responsabilidade, parado, motivo } — gestor/admin ou perfil com acesso à origem (18h.4c)
//   POST /:id/mensagens { texto } · POST /:id/anexos { tipo:'foto'|'bo'|'documento', nome, mime, base64, legenda, gps }
// Bloqueio de regra → 409 (403 derruba a sessão no front).
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const OC = require('../services/ocorrencias');

const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));
const VER = ['admin', 'gestor', 'operacao', 'comercial', 'comprador', 'qualidade', 'manutencao', 'fiscal'];
const quem = async (req) => { const { data } = await supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId).eq('id', req.userId); return { usuarioId: req.userId, usuarioNome: data?.[0]?.nome || req.userEmail || null, lado: 'empresa', perfis: perfisDe(req) }; };
const responder = (fn) => async (req, res) => {
  try { const r = await fn(req); if (r && r.erro) return res.status(r.status || 400).json({ erro: r.erro }); res.json(r); }
  catch (err) { console.error('❌ [ocorrencias]', err?.message); res.status(500).json({ erro: 'Erro interno' }); }
};
router.use((req, res, next) => (perfisDe(req).some((p) => VER.includes(p)) ? next() : res.status(403).json({ erro: 'Sem acesso às ocorrências' })));

router.get('/', responder((req) => OC.listar(supabase, req.tenantId, req.query || {}, { perfis: perfisDe(req) }))); // 18h.4c: só as origens que o perfil acessa
router.get('/:id', responder((req) => OC.detalhe(supabase, req.tenantId, req.params.id, { perfis: perfisDe(req) })));
router.post('/', responder(async (req) => OC.criar(supabase, req.tenantId, await quem(req), req.body || {})));
router.put('/:id', responder(async (req) => OC.atualizar(supabase, req.tenantId, await quem(req), req.params.id, req.body || {}))); // 18h.4c: gestor/admin ou perfil com acesso à origem (⚙️ Configurações)
router.post('/:id/mensagens', responder(async (req) => OC.mensagem(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
router.post('/:id/anexos', responder(async (req) => OC.anexar(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));

module.exports = router;
