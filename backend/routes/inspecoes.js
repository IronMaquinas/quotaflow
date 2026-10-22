// backend/routes/inspecoes.js — etapa 14a
//
// Inspeções de equipamento — /api/inspecoes (ver services/inspecoes.js).
//   GET  /painel                         equipamentos (bloqueio, última inspeção, modelo padrão) + modelos + listas
//   GET  /                               lista (?equipamento_id&de&ate)
//   GET  /:id                            detalhe (links das fotos e das imagens das vistas)
//   GET  /preparar/:equip?modelo_id=     dados para começar (modelo, última leitura de km/horímetro)
//   POST /enviar                         envia a inspeção (idempotente por cliente_uid — fila offline)
//   POST /:id/os                         { ponto_id, os_id, os_numero } — liga a OS aberta ao item não OK
//   POST /equipamentos/:id/liberar       { motivo } — libera equipamento bloqueado (evidência)
//   GET  /equipamentos/:id/liberacoes
//   PUT  /equipamentos/:id/modelo        { modelo_id } — modelo padrão do equipamento
//   Modelos: GET /modelos · GET /modelos/biblioteca · POST /modelos/importar · POST /modelos (novo) · PUT /modelos/:id
//            POST /modelos/:id/atualizar · DELETE /modelos/:id (desativa) · POST /modelos/imagem { base64, mime }
// Ver e inspecionar: admin, gestor, operação, qualidade. Modelos e liberar: admin, gestor, qualidade.

const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const I = require('../services/inspecoes');

const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));
const VER = ['admin', 'gestor', 'operacao', 'qualidade', 'comprador'];
const EDITAR = ['admin', 'gestor', 'qualidade'];
const podeEditar = (req) => perfisDe(req).some((p) => EDITAR.includes(p));
const exigirVer = (req, res, next) => (perfisDe(req).some((p) => VER.includes(p)) ? next() : res.status(403).json({ erro: 'Sem acesso às inspeções' }));
const exigirEditar = (req, res, next) => (podeEditar(req) ? next() : res.status(403).json({ erro: 'Só admin, gestor ou qualidade' }));
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const responder = (fn) => async (req, res) => {
  try { const r = await fn(req); if (r && r.erro) return res.status(r.status || 400).json({ erro: r.erro }); res.json(r); }
  catch (err) {
    const m = String(err?.message || '');
    if (/inspecao|inspecoes|bloqueado|equipamento_liberacoes/.test(m) && /does not exist|não existe|schema cache|relation|column/.test(m)) return res.status(409).json({ erro: 'Rode a migration 040 antes (inspeções)' });
    console.error('❌ [inspecoes]', m); res.status(500).json({ erro: 'Erro interno — veja o log do servidor' });
  }
};
const quem = async (req) => { const u = (await q(supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId).eq('id', req.userId)).catch(() => []))[0]; return { usuarioId: req.userId, usuarioNome: u?.nome || req.userEmail || null }; };

router.get('/painel', exigirVer, responder(async (req) => ({ equipamentos: await I.equipamentos(supabase, req.tenantId), modelos: await I.modelosTenant(supabase, req.tenantId),
  categorias: I.CATEGORIAS, frequencias: I.FREQUENCIAS, campos: I.CAMPOS, esquemas: I.ESQUEMAS, pode_editar: podeEditar(req) })));
router.get('/modelos', exigirVer, responder(async (req) => ({ modelos: await I.modelosTenant(supabase, req.tenantId) })));
router.get('/modelos/biblioteca', exigirVer, responder(async (req) => ({ modelos: await I.bibliotecaParaTenant(supabase, req.tenantId) })));
router.post('/modelos/importar', exigirEditar, responder((req) => I.importar(supabase, req.tenantId, req.body?.biblioteca_id)));
router.post('/modelos/imagem', exigirEditar, responder((req) => I.subirImagemModelo(supabase, `tenant-${req.tenantId}`, req.body || {})));
router.post('/modelos', exigirEditar, responder((req) => I.salvarModeloTenant(supabase, req.tenantId, null, req.body)));
router.put('/modelos/:id', exigirEditar, responder((req) => I.salvarModeloTenant(supabase, req.tenantId, req.params.id, req.body)));
router.post('/modelos/:id/atualizar', exigirEditar, responder((req) => I.atualizarDaBiblioteca(supabase, req.tenantId, req.params.id)));
router.get('/modelos/:id/imagens', exigirVer, responder(async (req) => {
  const m = (await q(supabase.from('inspecao_modelos').select('*').eq('tenant_id', req.tenantId).eq('id', req.params.id)))[0];
  return { imagens: m ? await I.linksImagens(supabase, m) : {} };
}));
router.delete('/modelos/:id', exigirEditar, responder(async (req) => {
  const { data, error } = await supabase.from('inspecao_modelos').update({ ativo: false }).eq('id', req.params.id).eq('tenant_id', req.tenantId).select();
  if (error) throw new Error(error.message);
  if (!data?.length) return { status: 404, erro: 'Modelo não encontrado' };
  return { ok: true };
}));

router.put('/equipamentos/:id/modelo', exigirEditar, responder((req) => I.definirModeloEquipamento(supabase, req.tenantId, req.params.id, req.body?.modelo_id || null)));
router.post('/equipamentos/:id/liberar', exigirEditar, responder(async (req) => I.liberar(supabase, req.tenantId, await quem(req), req.params.id, req.body?.motivo)));
router.get('/equipamentos/:id/liberacoes', exigirVer, responder(async (req) => ({ liberacoes: await I.liberacoes(supabase, req.tenantId, req.params.id) })));

router.get('/preparar/:equip', exigirVer, responder((req) => I.preparar(supabase, req.tenantId, req.params.equip, req.query.modelo_id || null)));
router.post('/enviar', exigirVer, responder(async (req) => {
  const u = (await q(supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId).eq('id', req.userId)).catch(() => []))[0];
  const col = (await q(supabase.from('colaboradores').select('*').eq('tenant_id', req.tenantId).eq('usuario_id', req.userId)).catch(() => []))[0];
  return I.enviar(supabase, req.tenantId, col ? { tipo: 'colaborador', colaborador_id: col.id, usuario_id: req.userId, nome: col.nome } : { tipo: 'usuario', usuario_id: req.userId, nome: u?.nome || req.userEmail || 'Usuário' }, req.body);
}));
router.get('/', exigirVer, responder(async (req) => ({ inspecoes: await I.listar(supabase, req.tenantId, { equipamentoId: req.query.equipamento_id || null, de: req.query.de, ate: req.query.ate }) })));
router.get('/:id', exigirVer, responder((req) => I.detalhe(supabase, req.tenantId, req.params.id)));
router.post('/:id/os', exigirVer, responder((req) => I.registrarOS(supabase, req.tenantId, req.params.id, req.body || {})));

module.exports = router;
