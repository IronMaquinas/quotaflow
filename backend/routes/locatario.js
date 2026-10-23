// backend/routes/locatario.js — etapa 14b.3
//
// Área do LOCATÁRIO — /api/locatario. Só o perfil "locatario" (e o tenantMiddleware só deixa esse perfil chamar
// /api/locatario, /api/usuarios/me e /api/auth). TODO escopo vem do usuário logado (req.userId) — services/contratosLocacao.js
// → escopoLocatario(). Nenhum id de contrato/locação vindo da tela é usado para decidir o que ele vê.
//   GET  /painel                        contratos ativos dele → equipamentos, rotinas (em dia/atrasada) + inspeções feitas
//   GET  /preparar/:equip?modelo_id=    modelo para inspecionar (só equipamento de locação ativa dele, modelo das rotinas)
//   POST /enviar                        envia a inspeção (mesmo corpo do app; idempotente — fila offline)
//   GET  /inspecoes/:id                 detalhe (só inspeção feita numa locação dos contratos dele)

const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const CT = require('../services/contratosLocacao');

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
router.get('/inspecoes/:id', responder((req) => CT.detalheLocatario(supabase, req.tenantId, req.userId, req.params.id)));

module.exports = router;
