// routes/tiposEquipamento.js — etapa B2.0: 🚛 tipos de equipamento/ativo da empresa (Configurações) + revisão rápida dos sem tipo
//   GET qualquer usuário interno · criar/editar/excluir/aplicar: admin e gestor
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const T = require('../services/tiposEquipamento');
const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));
const gestao = (req, res, next) => (perfisDe(req).some((p) => ['admin', 'gestor'].includes(p)) ? next() : res.status(403).json({ erro: 'Só a gestão altera os tipos de equipamento.' }));
const falha = (res, err, onde) => { if (/tipos_equipamento|tipo_id/.test(String(err.message))) return res.status(409).json({ erro: 'Falta rodar a migration 110 (tipos de equipamento) no banco.' }); console.error(`❌ [tipos-equipamento] ${onde}:`, err.message); res.status(500).json({ erro: 'Não consegui salvar.' }); };
const responder = (res, r, ok = 200) => (r.erro ? res.status(r.status || 400).json(r) : res.status(ok).json(r));

router.get('/', async (req, res) => { try { res.json({ tipos: await T.listar(supabase, req.tenantId) }); } catch (err) { falha(res, err, 'listar'); } });
router.get('/sugestoes', gestao, async (req, res) => { try { res.json({ itens: await T.sugestoes(supabase, req.tenantId) }); } catch (err) { falha(res, err, 'sugestoes'); } });
router.post('/aplicar', gestao, async (req, res) => { try { res.json(await T.aplicar(supabase, req.tenantId, req.body?.itens || [])); } catch (err) { falha(res, err, 'aplicar'); } });
router.post('/', gestao, async (req, res) => { try { responder(res, await T.criar(supabase, req.tenantId, req.body || {}), 201); } catch (err) { falha(res, err, 'criar'); } });
router.put('/:id', gestao, async (req, res) => { try { responder(res, await T.atualizar(supabase, req.tenantId, req.params.id, req.body || {})); } catch (err) { falha(res, err, 'editar'); } });
router.delete('/:id', gestao, async (req, res) => { try { responder(res, await T.excluir(supabase, req.tenantId, req.params.id)); } catch (err) { falha(res, err, 'excluir'); } });
module.exports = router;
