// backend/routes/comercial.js — etapa 15a
//
// 📈 Comercial (mini-CRM + BID) — /api/comercial. Ver e alterar: admin, gestor, comercial.
//   GET  /funil?de&ate                 colunas do kanban (qtd, valor), indicadores, motivos de perda
//   GET  /bids · POST /bids            lista · novo BID { cliente_id, modelo_id, titulo, referencia, responsavel_id, previsao_fechamento }
//   GET  /bids/:id                     BID + versões + atividades
//   PUT  /bids/:id                     editar (itens por grupo, condições, textos, validade, assinatura, responsável)
//   POST /bids/:id/versao { nota }     fecha a versão (v1, v2… com o que mudou)
//   POST /bids/:id/fase { fase, motivo, obs }   move no funil (perdido exige motivo)
//   GET  /bids/:id/documento?versao    dados para o PDF (rascunho ou versão congelada)
//   POST /atividades · POST /atividades/:id/concluir { feita } · GET /tarefas?minhas=1
//   GET  /modelos · GET /modelos/biblioteca · POST /modelos/importar · POST /modelos · PUT /modelos/:id · POST /modelos/:id/atualizar · DELETE /modelos/:id
//   GET  /clientes · GET /clientes/consulta/:doc · POST /clientes · PUT /clientes/:id · GET /clientes/:id/360
//   GET  /responsaveis                 admin, gestor e comercial ativos
// (403 desloga no front — trava de regra responde 409)

const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const B = require('../services/bids');
const CL = require('../services/clientes');

const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));
const PERFIS = ['admin', 'gestor', 'comercial'];
router.use((req, res, next) => (perfisDe(req).some((p) => PERFIS.includes(p)) ? next() : res.status(403).json({ erro: 'Sem acesso ao Comercial' })));
const responder = (fn) => async (req, res) => {
  try { const r = await fn(req); if (r && r.erro) return res.status(r.status || 400).json({ erro: r.erro }); res.json(r); }
  catch (err) {
    const m = String(err?.message || '');
    if (/bid_|bids|inscricao_estadual|opcao_fiscal/.test(m) && /does not exist|schema cache|relation|column/.test(m)) return res.status(409).json({ erro: 'Rode a migration 051 antes (Comercial / BID)' });
    if (/clientes/.test(m) && /does not exist|schema cache|relation/.test(m)) return res.status(409).json({ erro: 'Rode a migration 044 antes (clientes)' });
    console.error('❌ [comercial]', m); res.status(500).json({ erro: 'Erro interno — veja o log do servidor' });
  }
};
const quem = async (req) => { const { data } = await supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId).eq('id', req.userId); return { usuarioId: req.userId, usuarioNome: data?.[0]?.nome || req.userEmail || null }; };

router.get('/funil', responder((req) => B.funil(supabase, req.tenantId, req.query)));
router.get('/responsaveis', responder(async (req) => ({ responsaveis: await B.responsaveis(supabase, req.tenantId), eu: req.userId })));
router.get('/tarefas', responder(async (req) => ({ tarefas: await B.tarefas(supabase, req.tenantId, req.query.minhas === '1' ? req.userId : null) })));
router.post('/atividades', responder(async (req) => B.criarAtividade(supabase, req.tenantId, await quem(req), req.body || {})));
router.post('/atividades/:id/concluir', responder((req) => B.concluirAtividade(supabase, req.tenantId, req.params.id, req.body?.feita !== false)));

router.get('/modelos', responder(async (req) => ({ modelos: await B.modelosTenant(supabase, req.tenantId), campos: B.CAMPOS })));
router.get('/modelos/biblioteca', responder(async (req) => ({ modelos: await B.bibliotecaParaTenant(supabase, req.tenantId) })));
router.post('/modelos/importar', responder((req) => B.importar(supabase, req.tenantId, req.body?.biblioteca_id)));
router.post('/modelos', responder((req) => B.salvarModelo(supabase, req.tenantId, null, req.body || {})));
router.put('/modelos/:id', responder((req) => B.salvarModelo(supabase, req.tenantId, req.params.id, req.body || {})));
router.post('/modelos/:id/atualizar', responder((req) => B.atualizarDaBiblioteca(supabase, req.tenantId, req.params.id)));
router.delete('/modelos/:id', responder((req) => B.salvarModelo(supabase, req.tenantId, req.params.id, { ativo: false })));

router.get('/clientes', responder(async (req) => ({ clientes: await CL.listar(supabase, req.tenantId) })));
router.get('/clientes/consulta/:doc', responder((req) => CL.consultar(supabase, req.tenantId, req.params.doc)));
router.post('/clientes', responder((req) => CL.criar(supabase, req.tenantId, req.body || {})));
router.put('/clientes/:id', responder((req) => CL.editar(supabase, req.tenantId, req.params.id, req.body || {})));
router.get('/clientes/:id/360', responder((req) => B.cliente360(supabase, req.tenantId, req.params.id)));

router.get('/bids', responder(async (req) => ({ bids: await B.listar(supabase, req.tenantId), motivos_perda: B.MOTIVOS_PERDA, fases: B.FASE_NOME })));
router.post('/bids', responder(async (req) => B.criar(supabase, req.tenantId, await quem(req), req.body || {})));
router.get('/bids/:id', responder((req) => B.detalhe(supabase, req.tenantId, req.params.id)));
router.put('/bids/:id', responder(async (req) => B.editar(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
router.post('/bids/:id/versao', responder(async (req) => B.fecharVersao(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
router.post('/bids/:id/fase', responder(async (req) => B.mudarFase(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
router.get('/bids/:id/documento', responder((req) => B.documento(supabase, req.tenantId, req.params.id, req.query.versao ?? null)));

module.exports = router;
