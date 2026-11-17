// routes/metas.js — etapa SC2: 🎯 /api/metas (gestor/admin) — Metas do Negócio
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const M = require('../services/metas');
const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));
// SC2.4: gestor/admin fazem tudo; o DONO da meta (qualquer perfil) vê as metas e informa/corrige o resultado da sua
router.use(async (req, res, next) => {
  if (perfisDe(req).some((p) => ['admin', 'gestor'].includes(p))) { req.gestorMetas = true; return next(); }
  if (req.method === 'GET' && (req.path === '/' || /^\/\d+\/historico$/.test(req.path))) return next();
  const m = req.path.match(/^\/(\d+)\/(resultados\/\d{4}-\d{2}|valor|acoes)$/);
  if (m && ['PUT', 'POST'].includes(req.method)) { try { const { data } = await supabase.from('metas_negocio').select('responsavel_usuario_id').eq('id', m[1]).eq('tenant_id', req.tenantId).limit(1); if (data?.[0] && String(data[0].responsavel_usuario_id) === String(req.userId)) return next(); } catch { /* cai no 403 */ } }
  return res.status(403).json({ erro: 'Só gestor, admin ou o dono da meta.' });
});
const falha = (res, err) => { const sem101 = /metas_negocio|metas_fotografias|metas_resultados|origem|unidade|responsavel_colaborador_id|informado_por/.test(err.message || '') && /does not exist|schema cache|relation|column/i.test(err.message || ''); res.status(sem101 ? 409 : err.status || 500).json({ erro: sem101 ? 'Rode as migrations 101, 102 e 103 (metas do negócio) no Supabase.' : err.status ? err.message : 'Não consegui agora.' }); if (!err.status) console.error('❌ metas:', err.message); };

router.get('/', async (req, res) => { try { res.json({ metas: await M.listar(supabase, req.tenantId), areas: M.AREAS, pode_editar: !!req.gestorMetas, eu: req.userId }); } catch (e) { falha(res, e); } });
router.get('/sugeridas', async (req, res) => { try { const ja = (await supabase.from('metas_negocio').select('chave').eq('tenant_id', req.tenantId)).data || []; res.json({ medidas: M.sugeridas(ja.map((x) => x.chave)), areas: M.AREAS, unidades: M.UNIDADES }); } catch (e) { falha(res, e); } });
router.post('/importar', async (req, res) => { try { res.json(await M.importar(supabase, req.tenantId, req.body?.chaves || [])); } catch (e) { falha(res, e); } });
router.post('/', async (req, res) => { try { res.status(201).json({ meta: await M.criar(supabase, req.tenantId, req.body) }); } catch (e) { falha(res, e); } });
router.put('/:id', async (req, res) => { try { res.json({ meta: await M.atualizar(supabase, req.tenantId, req.params.id, req.body) }); } catch (e) { falha(res, e); } });
router.post('/:id/valor', async (req, res) => { try { let eu = null; try { const { data } = await supabase.from('usuarios').select('nome').eq('id', req.userId).limit(1); eu = data?.[0]?.nome || null; } catch { /* segue */ } res.json(await M.informarValor(supabase, req.tenantId, req.params.id, { valor: req.body?.valor, eu })); } catch (e) { falha(res, e); } }); // SC2.1: meta própria
const quem = async (req) => { try { const { data } = await supabase.from('usuarios').select('nome').eq('id', req.userId).limit(1); return { id: req.userId, nome: data?.[0]?.nome || null }; } catch { return { id: req.userId, nome: null }; } };
router.get('/painel-anual', async (req, res) => { try { res.json(await M.painelAnual(supabase, req.tenantId, { ano: /^\d{4}$/.test(String(req.query.ano || '')) ? req.query.ano : null })); } catch (e) { falha(res, e); } }); // SC2.4
router.get('/:id/historico', async (req, res) => { try { res.json(await M.historico(supabase, req.tenantId, req.params.id)); } catch (e) { falha(res, e); } }); // SC2.4
router.put('/:id/resultados/:mes', async (req, res) => { try { res.json({ resultado: await M.gravarResultado(supabase, req.tenantId, req.params.id, req.params.mes, { valor: req.body?.valor, motivo: req.body?.motivo, eu: await quem(req) }) }); } catch (e) { falha(res, e); } }); // SC2.4
router.post('/:id/acoes', async (req, res) => { try { res.status(201).json({ tarefa: await M.criarAcao(supabase, req.tenantId, req.params.id, await quem(req), req.body || {}) }); } catch (e) { falha(res, e); } }); // SC2.5: plano de ação (TSK-KPI)
router.delete('/:id', async (req, res) => { try { res.json(await M.excluir(supabase, req.tenantId, req.params.id)); } catch (e) { falha(res, e); } });

module.exports = router;
