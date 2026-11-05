// backend/routes/locatario.js — etapa 14b.3
//
// Área do LOCATÁRIO — /api/locatario. Só o perfil "locatario" (e o tenantMiddleware só deixa esse perfil chamar
// /api/locatario, /api/usuarios/me e /api/auth). TODO escopo vem do usuário logado (req.userId) — services/contratosLocacao.js
// → escopoLocatario(). Nenhum id de contrato/locação vindo da tela é usado para decidir o que ele vê.
//   GET  /painel                        contratos ativos dele → equipamentos, rotinas (em dia/atrasada) + inspeções feitas
//   GET  /preparar/:equip?modelo_id=    modelo para inspecionar (só equipamento de locação ativa dele, modelo das rotinas)
//   POST /enviar                        envia a inspeção (mesmo corpo do app; idempotente — fila offline)
//   POST /contratos/:id/aceite          { assinatura_png, nome } — 14d: aceite do contrato emitido (só contrato dele)
//   18d.2 — 📏 GET /medicoes (as enviadas pela locadora) · GET /medicoes/:id · POST /medicoes/:id/aprovar · POST /medicoes/:id/contestar { itens: [{ locacao_id, comentario }], motivo }
//   18h — ⚠️ GET /ocorrencias · GET /ocorrencias/opcoes · GET /ocorrencias/:id · POST /ocorrencias · POST /ocorrencias/:id/mensagens · POST /ocorrencias/:id/anexos
//   GET  /inspecoes/:id                 detalhe (só inspeção feita numa locação dos contratos dele)

const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const CT = require('../services/contratosLocacao');
const MD = require('../services/medicoes'); // 18d
const OC = require('../services/ocorrencias'); // 18h

const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));
const exigirLocatario = (req, res, next) => (perfisDe(req).includes('locatario') ? next() : res.status(403).json({ erro: 'Área do locatário' }));
const responder = (fn) => async (req, res) => {
  try { const r = await fn(req); if (r && r.erro) return res.status(r.status || 400).json({ erro: r.erro }); res.json(r); }
  catch (err) { console.error('❌ [locatario]', err?.message); res.status(500).json({ erro: 'Erro interno' }); }
};
const eu = async (req) => (await supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId).eq('id', req.userId)).data?.[0] || { id: req.userId, nome: req.userEmail };

router.use(exigirLocatario);
router.get('/painel', responder((req) => CT.painelLocatario(supabase, req.tenantId, req.userId)));
router.get('/preparar/:equip', responder((req) => CT.prepararLocatario(supabase, req.tenantId, req.userId, req.params.equip, req.query.modelo_id || null)));
router.post('/enviar', responder(async (req) => CT.enviarLocatario(supabase, req.tenantId, await eu(req), req.body || {})));
router.post('/contratos/:id/aceite', responder(async (req) => CT.aceitarLocatario(supabase, req.tenantId, await eu(req), req.params.id, req.body || {}))); // 14d
router.get('/medicoes', responder((req) => MD.painelLocatario(supabase, req.tenantId, req.userId)));
router.get('/medicoes/:id', responder(async (req) => MD.acaoLocatario(supabase, req.tenantId, await eu(req), 'ver', { medicaoId: req.params.id })));
router.post('/medicoes/:id/aprovar', responder(async (req) => MD.acaoLocatario(supabase, req.tenantId, await eu(req), 'aprovar', { medicaoId: req.params.id })));
router.post('/medicoes/:id/contestar', responder(async (req) => MD.acaoLocatario(supabase, req.tenantId, await eu(req), 'contestar', { medicaoId: req.params.id, body: req.body || {} })));
const quemLoc = async (req) => { const u = await eu(req); return { usuarioId: req.userId, usuarioNome: u.nome || req.userEmail || null, lado: 'cliente' }; };
router.get('/ocorrencias', responder((req) => OC.listar(supabase, req.tenantId, req.query || {}, { locatarioId: req.userId })));
router.get('/ocorrencias/opcoes', responder((req) => OC.opcoesLocatario(supabase, req.tenantId, req.userId)));
router.get('/ocorrencias/:id', responder((req) => OC.detalhe(supabase, req.tenantId, req.params.id, { locatarioId: req.userId })));
router.post('/ocorrencias', responder(async (req) => OC.criar(supabase, req.tenantId, await quemLoc(req), req.body || {}, { locatarioId: req.userId })));
router.post('/ocorrencias/:id/mensagens', responder(async (req) => OC.mensagem(supabase, req.tenantId, await quemLoc(req), req.params.id, req.body || {}, { locatarioId: req.userId })));
router.post('/ocorrencias/:id/anexos', responder(async (req) => OC.anexar(supabase, req.tenantId, await quemLoc(req), req.params.id, req.body || {}, { locatarioId: req.userId })));
router.get('/inspecoes/:id', responder((req) => CT.detalheLocatario(supabase, req.tenantId, req.userId, req.params.id)));

module.exports = router;
