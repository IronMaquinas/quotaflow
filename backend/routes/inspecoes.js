// backend/routes/inspecoes.js — etapa 14a
//
// Inspeções de equipamento — /api/inspecoes (ver services/inspecoes.js).
//   GET  /painel                         equipamentos (bloqueio, última inspeção, modelo padrão) + modelos + listas
//   GET  /                               lista (?equipamento_id&de&ate)
//   GET  /:id                            detalhe (links das fotos e das imagens das vistas)
//   GET  /preparar/:equip?modelo_id=     dados para começar (modelo, última leitura de km/horímetro)
//   POST /enviar                         envia a inspeção (idempotente por cliente_uid — fila offline)
//   POST /:id/resolver                   { ponto_id, texto } — 14b.2: "Resolver sem OS" (libera se era o último que impedia)
//   POST /:id/os                         { ponto_id, os_id, os_numero } — liga a OS aberta ao item não OK
//   POST /equipamentos/:id/liberar       { motivo } — libera equipamento bloqueado (evidência)
//   GET  /equipamentos/:id/liberacoes
//   PUT  /equipamentos/:id/modelo        { modelo_id } — modelo padrão do equipamento
//   Modelos: GET /modelos · GET /modelos/biblioteca · POST /modelos/importar · POST /modelos (novo) · PUT /modelos/:id
//            POST /modelos/:id/atualizar · DELETE /modelos/:id (desativa) · POST /modelos/imagem { base64, mime }
//   14b.1: GET/POST /links · DELETE /links/:id — link de inspeção de terceiros (admin, gestor, qualidade)
// Ver e inspecionar: admin, gestor, operação, qualidade, comprador. Modelos, links e liberar: admin, gestor, qualidade.
// 14b.1 — perfil "colaborador" (sozinho): só painel, preparar, enviar e as PRÓPRIAS inspeções ("Minhas inspeções").

const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const I = require('../services/inspecoes');

const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));
const VER = ['admin', 'gestor', 'operacao', 'qualidade', 'comprador'];
const EDITAR = ['admin', 'gestor', 'qualidade'];
const podeEditar = (req) => perfisDe(req).some((p) => EDITAR.includes(p));
const exigirVer = (req, res, next) => (perfisDe(req).some((p) => VER.includes(p)) ? next() : res.status(403).json({ erro: 'Sem acesso às inspeções' }));
const soColaborador = (req) => { const p = perfisDe(req); return p.length > 0 && p.every((x) => x === 'colaborador'); };
const exigirVerOuColab = (req, res, next) => (soColaborador(req) || perfisDe(req).some((p) => VER.includes(p)) ? next() : res.status(403).json({ erro: 'Sem acesso às inspeções' }));
const meuColaborador = async (req) => (await q(supabase.from('colaboradores').select('*').eq('tenant_id', req.tenantId).eq('usuario_id', req.userId)).catch(() => []))[0] || null;
const exigirEditar = (req, res, next) => (podeEditar(req) ? next() : res.status(403).json({ erro: 'Só admin, gestor ou qualidade' }));
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const responder = (fn) => async (req, res) => {
  try { const r = await fn(req); if (r && r.erro) return res.status(r.status || 400).json({ erro: r.erro }); res.json(r); }
  catch (err) {
    const m = String(err?.message || '');
    if (/inspecao|inspecoes|bloqueado|equipamento_liberacoes|numero|tipo|link_id/.test(m) && /does not exist|não existe|schema cache|relation|column/.test(m)) return res.status(409).json({ erro: 'Rode as migrations 040 e 041 antes (inspeções)' });
    console.error('❌ [inspecoes]', m); res.status(500).json({ erro: 'Erro interno — veja o log do servidor' });
  }
};
const quem = async (req) => { const u = (await q(supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId).eq('id', req.userId)).catch(() => []))[0]; return { usuarioId: req.userId, usuarioNome: u?.nome || req.userEmail || null }; };

router.get('/painel', exigirVerOuColab, responder(async (req) => ({ equipamentos: await I.equipamentos(supabase, req.tenantId), modelos: await I.modelosTenant(supabase, req.tenantId),
  categorias: I.CATEGORIAS, frequencias: I.FREQUENCIAS, tipos: I.TIPOS, campos: I.CAMPOS, esquemas: I.ESQUEMAS, pode_editar: podeEditar(req), colaborador: soColaborador(req) })));

// 14b.1 — links de inspeção de terceiros
router.get('/links', exigirEditar, responder(async (req) => ({ links: await I.listarLinks(supabase, req.tenantId) })));
router.post('/links', exigirEditar, responder(async (req) => I.criarLink(supabase, req.tenantId, await quem(req), req.body || {})));
router.delete('/links/:id', exigirEditar, responder((req) => I.desativarLink(supabase, req.tenantId, req.params.id)));
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

router.get('/preparar/:equip', exigirVerOuColab, responder((req) => I.preparar(supabase, req.tenantId, req.params.equip, req.query.modelo_id || null)));
router.post('/enviar', exigirVerOuColab, responder(async (req) => {
  const u = (await q(supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId).eq('id', req.userId)).catch(() => []))[0];
  const col = (await q(supabase.from('colaboradores').select('*').eq('tenant_id', req.tenantId).eq('usuario_id', req.userId)).catch(() => []))[0];
  return I.enviar(supabase, req.tenantId, col ? { tipo: 'colaborador', colaborador_id: col.id, usuario_id: req.userId, nome: col.nome } : { tipo: 'usuario', usuario_id: req.userId, nome: u?.nome || req.userEmail || 'Usuário' }, req.body);
}));
router.get('/', exigirVerOuColab, responder(async (req) => {
  let l = await I.listar(supabase, req.tenantId, { equipamentoId: req.query.equipamento_id || null, de: req.query.de, ate: req.query.ate });
  if (soColaborador(req)) { const c = await meuColaborador(req); l = c ? l.filter((i) => String(i.colaborador_id) === String(c.id)) : []; }
  return { inspecoes: l };
}));
router.get('/:id', exigirVerOuColab, responder(async (req) => {
  const r = await I.detalhe(supabase, req.tenantId, req.params.id);
  if (!r.erro && soColaborador(req)) { const c = await meuColaborador(req); if (!c || String(r.inspecao.colaborador_id) !== String(c.id)) return { status: 404, erro: 'Inspeção não encontrada' }; }
  return r;
}));
router.post('/:id/resolver', exigirEditar, responder(async (req) => I.resolverSemOS(supabase, req.tenantId, await quem(req), req.params.id, req.body || {}))); // 14b.2
router.post('/:id/os', exigirVer, responder((req) => I.registrarOS(supabase, req.tenantId, req.params.id, req.body || {})));

module.exports = router;
