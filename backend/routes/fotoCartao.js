// routes/fotoCartao.js — etapa E1: 📸 foto com cartão
//   GET /modelos · POST /modelos { …campos | exemplo } · PUT /modelos/:id · POST /modelos/:id/ativo { ativo }  (admin, gestor, qualidade)
//   POST /fotos { cliente_uid, imagem (data:image/jpeg), modelo_id, valores, obs, referencia, gps, tirada_em } · GET /fotos?modelo_id&de&ate&busca
//   Tirar e ver fotos: admin, gestor, qualidade, operacao, manutencao, colaborador (técnico de campo).
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const F = require('../services/fotoCartao');
const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));
const quem = async (req) => { try { const { data } = await supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId).eq('id', req.userId); return { id: req.userId, nome: data?.[0]?.nome || 'Usuário' }; } catch { return { id: req.userId, nome: 'Usuário' }; } };
const CAMPO = ['admin', 'gestor', 'qualidade', 'operacao', 'manutencao', 'colaborador'];
const GESTAO = ['admin', 'gestor', 'qualidade'];
const r = (perfis, fn) => async (req, res) => {
  if (!perfisDe(req).some((p) => perfis.includes(p))) return res.status(403).json({ erro: perfis === GESTAO ? 'Só admin, gestor ou qualidade editam os modelos de cartão.' : 'Sem acesso às fotos com cartão.' });
  try { const x = await fn(req); if (x?.erro) return res.status(x.status || 400).json(x); res.json(x); }
  catch (err) { if (/cartao_foto_modelos|fotos_cartao|does not exist|schema cache/.test(String(err.message))) return res.status(409).json({ erro: 'Falta rodar a migration 121 (foto com cartão).' }); console.error('❌ [foto-cartao]', err.message); res.status(500).json({ erro: 'Não consegui agora.' }); }
};
router.get('/modelos', r(CAMPO, (req) => F.listarModelos(supabase, req.tenantId, { todos: req.query.todos === '1' })));
router.post('/modelos', r(GESTAO, async (req) => F.salvarModelo(supabase, req.tenantId, await quem(req), null, req.body || {})));
router.put('/modelos/:id', r(GESTAO, async (req) => F.salvarModelo(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
router.post('/modelos/:id/ativo', r(GESTAO, (req) => F.ativarModelo(supabase, req.tenantId, req.params.id, req.body?.ativo)));
router.post('/fotos', r(CAMPO, async (req) => F.enviarFoto(supabase, req.tenantId, await quem(req), req.body || {})));
router.get('/fotos', r(CAMPO, (req) => F.listarFotos(supabase, req.tenantId, req.query || {})));
module.exports = router;
