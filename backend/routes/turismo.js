// routes/turismo.js — etapa T1: 🚌 viagens e embarque (admin, gestor, comercial, operação)
//   /mapas (GET modelos+empresa, POST, PUT /:id) · /viagens (GET, POST, GET/PUT /:id) · /viagens/:id/onibus (POST) · /onibus/:id (PUT, DELETE)
//   /onibus/:id/bloquear { poltrona, bloquear } · /onibus/:id/sugestao?n= · /viagens/:id/reservas (POST) · /reservas/:id (PUT, DELETE)
//   /reservas/:id/passageiros (POST) · /passageiros/:id (PUT, DELETE) · /passageiros/:id/mover { onibus_id, poltrona } · /viagens/:id/importar { linhas }
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const T = require('../services/turismo');
const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));
const quem = async (req) => { try { const { data } = await supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId).eq('id', req.userId); return { id: req.userId, nome: data?.[0]?.nome || 'Usuário' }; } catch { return { id: req.userId, nome: 'Usuário' }; } };
const r = (fn) => async (req, res) => {
  if (!perfisDe(req).some((p) => ['admin', 'gestor', 'comercial', 'operacao'].includes(p))) return res.status(403).json({ erro: 'Sem acesso às viagens.' });
  try { const x = await fn(req); if (x?.erro) return res.status(x.status || 400).json(x); res.json(x); }
  catch (err) { if (/viagens|viagem_|mapas_poltronas|does not exist|schema cache/.test(String(err.message))) return res.status(409).json({ erro: 'Falta rodar a migration 128 (viagens).' }); if (/duplicate|unique/i.test(err.message)) return res.status(409).json({ erro: 'Poltrona já ocupada — atualize a tela.' }); console.error('❌ [turismo]', err.message); res.status(500).json({ erro: 'Não consegui agora.' }); }
};
const b = (req) => req.body || {};
router.get('/mapas', r((req) => T.listarMapas(supabase, req.tenantId)));
router.post('/mapas', r((req) => T.salvarMapa(supabase, req.tenantId, null, b(req))));
router.put('/mapas/:id', r((req) => T.salvarMapa(supabase, req.tenantId, req.params.id, b(req))));
router.get('/viagens', r((req) => T.listarViagens(supabase, req.tenantId, req.query || {})));
router.post('/viagens', r(async (req) => T.salvarViagem(supabase, req.tenantId, await quem(req), null, b(req))));
router.get('/viagens/:id', r((req) => T.detalhe(supabase, req.tenantId, req.params.id)));
router.put('/viagens/:id', r(async (req) => T.salvarViagem(supabase, req.tenantId, await quem(req), req.params.id, b(req))));
router.post('/viagens/:id/onibus', r((req) => T.salvarOnibus(supabase, req.tenantId, req.params.id, null, b(req))));
router.put('/onibus/:id', r((req) => T.salvarOnibus(supabase, req.tenantId, b(req).viagem_id, req.params.id, b(req))));
router.delete('/onibus/:id', r((req) => T.excluirOnibus(supabase, req.tenantId, req.params.id)));
router.post('/onibus/:id/bloquear', r((req) => T.bloquear(supabase, req.tenantId, req.params.id, b(req).poltrona, !!b(req).bloquear)));
router.get('/onibus/:id/sugestao', r((req) => T.sugestao(supabase, req.tenantId, req.params.id, req.query.n)));
router.post('/viagens/:id/reservas', r(async (req) => T.criarReserva(supabase, req.tenantId, await quem(req), req.params.id, b(req))));
router.post('/viagens/:id/importar', r(async (req) => T.importar(supabase, req.tenantId, await quem(req), req.params.id, b(req))));
router.put('/reservas/:id', r((req) => T.editarReserva(supabase, req.tenantId, req.params.id, b(req))));
router.delete('/reservas/:id', r((req) => T.excluirReserva(supabase, req.tenantId, req.params.id)));
router.post('/reservas/:id/passageiros', r((req) => T.adicionarPassageiro(supabase, req.tenantId, req.params.id, b(req))));
router.put('/passageiros/:id', r((req) => T.salvarPassageiro(supabase, req.tenantId, req.params.id, b(req))));
router.delete('/passageiros/:id', r((req) => T.excluirPassageiro(supabase, req.tenantId, req.params.id)));
router.post('/passageiros/:id/mover', r((req) => T.mover(supabase, req.tenantId, req.params.id, b(req))));
module.exports = router;
