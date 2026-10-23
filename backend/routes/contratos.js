// backend/routes/contratos.js — etapa 14b.3
//
// 📑 Contratos de locação — /api/contratos (visão da EMPRESA). Ver: admin, gestor, operação, comprador, qualidade.
// Alterar: admin, gestor. O locatário usa /api/locatario (routes/locatario.js), nunca esta rota.
//   GET    /                                 contratos com equipamentos, rotinas e acessos
//   POST   /                                 novo contrato (CL-AAAA-NNNN)
//   PUT    /:id                              editar (cliente, obra, contato, fim previsto, obs)
//   POST   /:id/equipamentos                 { equipamento_id, inicio?, rotina?: { modelo_id, frequencia } } — loca dentro do contrato
//   POST   /:id/equipamentos/:equip/devolver { fim_real }
//   POST   /:id/encerrar                     { fim_real } → { sem_contrato: [usuários sem contrato ativo] }
//   POST   /:id/acessos                      { nome, email, senha, telefone } — cria/liga o usuário Locatário
//   DELETE /:id/acessos/:usuario             tira o acesso deste contrato
//   GET    /clientes · GET /clientes/consulta/:doc (cadastro → Receita) · POST /clientes · PUT /clientes/:id — 14b.3.1
//   POST   /usuarios/:usuario/pausar         { ativo: false|true } — só usuário que é SÓ locatário

const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const CT = require('../services/contratosLocacao');
const CL = require('../services/clientes'); // 14b.3.1

const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));
const VER = ['admin', 'gestor', 'operacao', 'comprador', 'qualidade']; // qualidade: a tela de inspeções lista os contratos ao locar (403 derruba a sessão no front)
const EDITAR = ['admin', 'gestor'];
const exigirVer = (req, res, next) => (perfisDe(req).some((p) => VER.includes(p)) ? next() : res.status(403).json({ erro: 'Sem acesso aos contratos' }));
const exigirEditar = (req, res, next) => (perfisDe(req).some((p) => EDITAR.includes(p)) ? next() : res.status(403).json({ erro: 'Só admin ou gestor' }));
const responder = (fn) => async (req, res) => {
  try { const r = await fn(req); if (r && r.erro) return res.status(r.status || 400).json({ erro: r.erro }); res.json(r); }
  catch (err) {
    const m = String(err?.message || '');
    if (/clientes|cliente_id/.test(m) && /does not exist|schema cache|relation|column/.test(m)) return res.status(409).json({ erro: 'Rode a migration 044 antes (clientes)' });
    if (/locacao_contrato|contrato_id|does not exist|schema cache/.test(m)) return res.status(409).json({ erro: 'Rode a migration 043 antes (contratos de locação)' });
    console.error('❌ [contratos]', m); res.status(500).json({ erro: 'Erro interno — veja o log do servidor' });
  }
};
const quem = async (req) => { const { data } = await supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId).eq('id', req.userId); return { usuarioId: req.userId, usuarioNome: data?.[0]?.nome || req.userEmail || null }; };

router.get('/clientes', exigirVer, responder(async (req) => ({ clientes: await CL.listar(supabase, req.tenantId) })));
router.get('/clientes/consulta/:doc', exigirVer, responder((req) => CL.consultar(supabase, req.tenantId, req.params.doc)));
router.post('/clientes', exigirEditar, responder((req) => CL.criar(supabase, req.tenantId, req.body || {})));
router.put('/clientes/:id', exigirEditar, responder((req) => CL.editar(supabase, req.tenantId, req.params.id, req.body || {})));
router.get('/', exigirVer, responder(async (req) => ({ contratos: await CT.listar(supabase, req.tenantId), pode_editar: perfisDe(req).some((p) => EDITAR.includes(p)) })));
router.post('/', exigirEditar, responder(async (req) => CT.criar(supabase, req.tenantId, await quem(req), req.body || {})));
router.put('/:id', exigirEditar, responder((req) => CT.editar(supabase, req.tenantId, req.params.id, req.body || {})));
router.post('/:id/equipamentos', exigirEditar, responder(async (req) => CT.adicionarEquipamento(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
router.post('/:id/equipamentos/:equip/devolver', exigirEditar, responder(async (req) => CT.devolverEquipamento(supabase, req.tenantId, await quem(req), req.params.id, req.params.equip, req.body || {})));
router.post('/:id/encerrar', exigirEditar, responder(async (req) => CT.encerrar(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
router.post('/:id/acessos', exigirEditar, responder((req) => CT.criarAcesso(supabase, req.tenantId, req.params.id, req.body || {})));
router.delete('/:id/acessos/:usuario', exigirEditar, responder((req) => CT.removerAcesso(supabase, req.tenantId, req.params.id, req.params.usuario)));
router.post('/usuarios/:usuario/pausar', exigirEditar, responder((req) => CT.pausarUsuario(supabase, req.tenantId, req.params.usuario, req.body?.ativo === true)));

module.exports = router;
