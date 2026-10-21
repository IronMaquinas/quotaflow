// backend/routes/autuacoes.js — etapa 12i
//
// Autuações da empresa (requisito legal) — /api/autuacoes. Ver services/autuacoes.js.
//   GET    /                 lista + listas (órgãos, esferas, situações) + documentos da empresa + frota + usuários
//   POST   /                 cadastra (auto anexo opcional) — cria tarefa no ✅ Plano se houver "quem monitora"
//   PUT    /:id              edita (também liga a NC de causa raiz: { nc_id, nc_numero }); anexa auto/defesa
//   POST   /:id/status       { status, … } — defesa apresentada · em recurso · paga · cancelada
//   GET    /:id/arquivo?qual=auto|defesa   link (1 h) do anexo
//   DELETE /:id              só enquanto "recebida" (cadastro errado)
// Ver: quem vê ⚠️ Não Conformidades (admin, gestor, operação, qualidade). Alterar: admin, gestor, qualidade.

const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const A = require('../services/autuacoes');
const D = require('../services/documentos');

const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));
const VER = ['admin', 'gestor', 'operacao', 'qualidade'];
const EDITAR = ['admin', 'gestor', 'qualidade'];
const podeEditar = (req) => perfisDe(req).some((p) => EDITAR.includes(p));
const exigirVer = (req, res, next) => (perfisDe(req).some((p) => VER.includes(p)) ? next() : res.status(403).json({ erro: 'Sem acesso às autuações' }));
const exigirEditar = (req, res, next) => (podeEditar(req) ? next() : res.status(403).json({ erro: 'Só admin, gestor ou qualidade alteram autuações' }));
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }

const responder = (fn) => async (req, res) => {
  try { const r = await fn(req); if (r && r.erro) return res.status(r.status || 400).json({ erro: r.erro }); res.json(r); }
  catch (err) {
    const m = String(err?.message || '');
    if (err.status) return res.status(err.status).json({ erro: m });
    if (/autuacoes/.test(m) && /does not exist|não existe|schema cache|relation/.test(m)) return res.status(409).json({ erro: 'Rode a migration 039 antes (autuações)' });
    console.error('❌ [autuacoes]', m); res.status(500).json({ erro: 'Erro interno — veja o log do servidor' });
  }
};
const quem = async (req) => { const u = (await q(supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId).eq('id', req.userId)).catch(() => []))[0]; return { usuarioId: req.userId, usuarioNome: u?.nome || req.userEmail || null }; };
const ou404 = async (req) => { const a = await A.doTenant(supabase, req.tenantId, req.params.id); if (!a) throw Object.assign(new Error('Autuação não encontrada'), { status: 404 }); return a; };

router.get('/', exigirVer, responder(async (req) => {
  const docs = await D.listarDocumentos(supabase, req.tenantId, { alvoTipo: 'empresa' }).catch(() => []);
  const eqs = await q(supabase.from('equipamentos').select('*').eq('tenant_id', req.tenantId)).catch(() => []);
  const us = (await q(supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId))).filter((u) => u.ativo !== false && u.ativo !== 0 && u.perfil !== 'colaborador');
  return { autuacoes: await A.listar(supabase, req.tenantId), status: A.STATUS_NOME, esferas: A.ESFERAS, orgaos: A.ORGAOS, pode_editar: podeEditar(req),
    documentos: docs.map((d) => ({ id: d.id, nome: [d.tipo_nome, d.numero].filter(Boolean).join(' nº '), vence_em: d.vence_em, situacao: d.situacao })),
    equipamentos: eqs.filter((e) => e.ativo !== false).map((e) => ({ id: e.id, tag: e.tag, nome: e.nome })),
    usuarios: us.map((u) => ({ id: u.id, nome: u.nome })).sort((a, b) => String(a.nome).localeCompare(String(b.nome))) };
}));
router.post('/', exigirEditar, responder(async (req) => A.criar(supabase, req.tenantId, await quem(req), req.body)));
router.put('/:id', exigirEditar, responder(async (req) => A.editar(supabase, req.tenantId, await quem(req), await ou404(req), req.body)));
router.post('/:id/status', exigirEditar, responder(async (req) => A.mudarStatus(supabase, req.tenantId, await quem(req), await ou404(req), req.body)));
router.get('/:id/arquivo', exigirVer, responder(async (req) => {
  const a = await ou404(req); const k = req.query.qual === 'defesa' ? 'defesa' : 'arquivo';
  if (!a[`${k}_path`]) return { status: 404, erro: 'Sem anexo' };
  return { url: await D.linkArquivo(supabase, a[`${k}_path`]), nome: a[`${k}_nome`] };
}));
router.delete('/:id', exigirEditar, responder(async (req) => {
  const a = await ou404(req);
  if (a.status !== 'recebida') return { status: 400, erro: 'Só dá para excluir enquanto "Recebida" — depois, use Cancelada' };
  if (a.tarefa_id) await supabase.from('tarefas').delete().eq('id', a.tarefa_id).eq('tenant_id', req.tenantId);
  const { error } = await supabase.from('autuacoes').delete().eq('id', a.id).eq('tenant_id', req.tenantId);
  if (error) throw new Error(error.message);
  for (const p of [a.arquivo_path, a.defesa_path]) if (p) await D.removerArquivo(supabase, p);
  return { ok: true };
}));

module.exports = router;
