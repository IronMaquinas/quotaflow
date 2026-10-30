// backend/routes/programacao.js — etapa 16a
//
// 🚛 Programação — /api/programacao. Ver e alterar: admin, gestor, operação (o serviço SEM valores).
// Liberar motorista com item VENCIDO no selo: só admin e gestor (o serviço confere).
//   GET  /base                         motoristas (com selo) e equipamentos (com bloqueio)
//   GET  /execucoes?status&de&ate      lista (com conflitos)        GET /agenda?de&ate   agenda da frota
//   GET  /pedidos                      pedidos com trechos a programar (sem valores)
//   GET  /pvs/:id                      ATs e trechos de um pedido
//   POST /pvs/:id/at                   { grupo_id, inicio, fim, origem, destino, motorista_id, cavalo_id, implementos, observacoes, liberacao_justificativa, ignorar_conflito }
//   GET  /execucoes/:id · PUT /execucoes/:id · POST /execucoes/:id/status { acao: iniciar|concluir|cancelar|reabrir, motivo }
//   POST /execucoes/:id/anexos { tipo, nome, mime, base64 } · GET /execucoes/:id/anexos/:anexo · DELETE /execucoes/:id/anexos/:anexo
//   GET  /execucoes/:id/documento      dados do PDF da AT
//   POST /checar { linhas }            16b: conflitos das linhas da mesa antes de salvar
//   16e: POST /execucoes/:id/fluxo/:etapa/liberar { motivo } (gestor/admin) · POST /pvs/:id/at e PUT aceitam { fluxo: [...] }
//   16c: POST /docs { motorista_id, cavalo_id, implementos, inicio, fim } · GET /documentos/:id · DELETE /execucoes/:id (rascunho)
//        POST /pvs/:id/at e PUT /execucoes/:id aceitam { rascunho: true } (salva sem validar) e liberacao_docs_justificativa
// (403 desloga no front — trava de regra responde 409)

const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const E = require('../services/execucoes');

const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));
const PERFIS = ['admin', 'gestor', 'operacao'];
router.use((req, res, next) => (perfisDe(req).some((p) => PERFIS.includes(p)) ? next() : res.status(403).json({ erro: 'Sem acesso à Programação' })));
const responder = (fn) => async (req, res) => {
  try { const r = await fn(req); if (r && r.erro) { const { status, ...resto } = r; return res.status(status || 400).json(resto); } res.json(r); }
  catch (err) {
    const m = String(err?.message || '');
    if (/execucoes|tipo_execucao|token|liberacao_docs|link_visto_em/.test(m) && /does not exist|schema cache|relation|column/.test(m)) return res.status(409).json({ erro: 'Rode as migrations 055 e 056 antes (Programação / AT)' });
    if (/execucoes_status_check|cavalo_id/.test(m)) return res.status(409).json({ erro: 'Rode a migration 056 antes (rascunho da AT)' });
    console.error('❌ [programacao]', m); res.status(500).json({ erro: 'Erro interno — veja o log do servidor' });
  }
};
const quem = async (req) => { const { data } = await supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId).eq('id', req.userId); return { usuarioId: req.userId, usuarioNome: data?.[0]?.nome || req.userEmail || null, perfis: perfisDe(req) }; };

router.get('/base', responder((req) => E.base(supabase, req.tenantId)));
router.get('/execucoes', responder(async (req) => ({ execucoes: await E.listar(supabase, req.tenantId, req.query), status: E.STATUS })));
router.get('/agenda', responder((req) => E.agenda(supabase, req.tenantId, req.query)));
router.get('/pedidos', responder(async (req) => {
  const { data, error } = await supabase.from('pedidos_venda').select('*').eq('tenant_id', req.tenantId); if (error) throw new Error(error.message);
  const ex = await E.listar(supabase, req.tenantId, {}); const docsBase = await E.carregarDocs(supabase, req.tenantId);
  return { pedidos: (data || []).filter((p) => ['aberto', 'em_execucao'].includes(p.status)).map((p) => ({ id: p.id, numero: p.numero, cliente_nome: p.cliente_nome, titulo: p.titulo, referencia: p.referencia, status: p.status, tipo_execucao: p.tipo_execucao || 'transporte',
    colunas: (p.conteudo?.colunas || []).filter((c) => c.chave !== 'data_prevista'), trechos: E.trechosComATs(p, ex.filter((e) => String(e.pv_id) === String(p.id)), docsBase) })).sort((a, b) => String(a.numero).localeCompare(String(b.numero))) };
}));
router.post('/execucoes/:id/fluxo/:etapa/liberar', responder(async (req) => { // 16e: gestor libera etapa reprovada
  const ex = /^\d+$/.test(req.params.id) ? (await supabase.from('execucoes').select('*').eq('tenant_id', req.tenantId).eq('id', req.params.id)).data?.[0] : null;
  if (!ex) return { status: 404, erro: 'AT não encontrada' };
  return require('../services/fluxoViagem').liberar(supabase, req.tenantId, await quem(req), ex, req.params.etapa, req.body?.motivo);
}));
router.post('/docs', responder((req) => E.docsDoConjunto(supabase, req.tenantId, req.body || {}))); // 16c: CNH/CRLV do que foi escolhido
router.get('/documentos/:id', responder((req) => E.linkDocCadastro(supabase, req.tenantId, req.params.id))); // 16c: abrir CNH/CRLV do cadastro
router.delete('/execucoes/:id', responder(async (req) => E.descartar(supabase, req.tenantId, await quem(req), req.params.id))); // 16c: descartar rascunho
router.post('/checar', responder((req) => E.checar(supabase, req.tenantId, req.body?.linhas))); // 16b: mesa
router.get('/pvs/:id', responder((req) => E.doPV(supabase, req.tenantId, req.params.id)));
router.post('/pvs/:id/at', responder(async (req) => E.criar(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
router.get('/execucoes/:id', responder((req) => E.detalhe(supabase, req.tenantId, req.params.id)));
router.put('/execucoes/:id', responder(async (req) => E.editar(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
router.post('/execucoes/:id/status', responder(async (req) => E.mudarStatus(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
router.post('/execucoes/:id/anexos', responder(async (req) => E.anexar(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
router.get('/execucoes/:id/anexos/:anexo', responder((req) => E.linkAnexo(supabase, req.tenantId, req.params.id, req.params.anexo)));
router.delete('/execucoes/:id/anexos/:anexo', responder(async (req) => E.removerAnexo(supabase, req.tenantId, await quem(req), req.params.id, req.params.anexo)));
router.get('/execucoes/:id/documento', responder((req) => E.documento(supabase, req.tenantId, req.params.id)));

module.exports = router;
