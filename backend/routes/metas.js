// routes/metas.js — etapa SC2: 🎯 /api/metas (gestor/admin) — Metas do Negócio
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const M = require('../services/metas');
const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));
router.use((req, res, next) => (perfisDe(req).some((p) => ['admin', 'gestor'].includes(p)) ? next() : res.status(403).json({ erro: 'Só gestor ou admin cuidam das metas do negócio.' })));
const falha = (res, err) => { const sem101 = /metas_negocio|metas_fotografias|origem|unidade|responsavel_colaborador_id|informado_por/.test(err.message || '') && /does not exist|schema cache|relation|column/i.test(err.message || ''); res.status(sem101 ? 409 : err.status || 500).json({ erro: sem101 ? 'Rode as migrations 101 e 102 (metas do negócio) no Supabase.' : err.status ? err.message : 'Não consegui agora.' }); if (!err.status) console.error('❌ metas:', err.message); };

router.get('/', async (req, res) => { try { res.json({ metas: await M.listar(supabase, req.tenantId), areas: M.AREAS }); } catch (e) { falha(res, e); } });
router.get('/sugeridas', async (req, res) => { try { const ja = (await supabase.from('metas_negocio').select('chave').eq('tenant_id', req.tenantId)).data || []; res.json({ medidas: M.sugeridas(ja.map((x) => x.chave)), areas: M.AREAS, unidades: M.UNIDADES }); } catch (e) { falha(res, e); } });
router.post('/importar', async (req, res) => { try { res.json(await M.importar(supabase, req.tenantId, req.body?.chaves || [])); } catch (e) { falha(res, e); } });
router.post('/', async (req, res) => { try { res.status(201).json({ meta: await M.criar(supabase, req.tenantId, req.body) }); } catch (e) { falha(res, e); } });
router.put('/:id', async (req, res) => { try { res.json({ meta: await M.atualizar(supabase, req.tenantId, req.params.id, req.body) }); } catch (e) { falha(res, e); } });
router.post('/:id/valor', async (req, res) => { try { let eu = null; try { const { data } = await supabase.from('usuarios').select('nome').eq('id', req.userId).limit(1); eu = data?.[0]?.nome || null; } catch { /* segue */ } res.json(await M.informarValor(supabase, req.tenantId, req.params.id, { valor: req.body?.valor, eu })); } catch (e) { falha(res, e); } }); // SC2.1: meta própria
router.delete('/:id', async (req, res) => { try { res.json(await M.excluir(supabase, req.tenantId, req.params.id)); } catch (e) { falha(res, e); } });

module.exports = router;
