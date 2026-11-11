// routes/tarefas.js — ✅ Plano de ação · etapa 18g: rastreabilidade (services/tarefas.js)
//   GET    /api/tarefas                         lista (com número TSK-…, tipo, evidências, histórico, vínculos)
//   GET    /api/tarefas/pessoas                 18g.2a: usuários + colaboradores para escolher o responsável ({ eu, pessoas })
//   GET    /api/tarefas/tipos                   tipos (TR · NC · AU · MT · CM · HR · GN)
//   GET    /api/tarefas/:id                     uma tarefa
//   POST   /api/tarefas                         { titulo, detalhe, responsavel | responsavel_ref (c:id / u:id), prazo, prioridade, status, tipo, vinculos }
//   PUT    /api/tarefas/:id                     campos acima — cada mudança vai para o histórico (número não muda)
//   DELETE /api/tarefas/:id                     só tarefa sem número (as numeradas se cancelam — auditoria)
//   POST   /api/tarefas/:id/comentario          { texto }
//   POST   /api/tarefas/:id/anexos              { nome, mime, base64 } evidência · GET /:id/anexos/:anexo (link) · DELETE /:id/anexos/:anexo
//   18g.1 🧾 tarefa fiscal (origem 'fiscal'): POST /:id/fiscal/dispensar { motivo } · POST /:id/fiscal/:item { numero, chave, pdf:{nome,mime,base64}, xml:{nome,base64} }
//   18g.2.4: POST /:id/fiscal/:item/:entrada/substituir { motivo_tipo, motivo, numero, chave, pdf, xml } · POST /:id/fiscal/:item/:entrada/evento { tipo, descricao, pdf }
//   18g.2: POST /:id/fiscal/mdfe/:entrada/programar (AT em rascunho a partir do MDF-e) · POST /:id/fiscal/encerramento { at_id, numero, pdf } (🏁 encerrar MDF-e)
//         (item = nfe | cte | averbacao | mdfe) · 18g.1.1: { entrada, pdf } completa com o PDF a entrada salva só com o XML · DELETE /:id/fiscal/:item/:entrada · GET / sincroniza antes (cria/atualiza a tarefa de cada trecho)
//   18b.2: tarefa que nasceu de outra tela (ex.: 📣 prospecção) só se encerra lá — 409 (não desloga)
const express = require("express");
const router = express.Router();
const { supabase } = require("../db");
const tenantMiddleware = require("../middleware/tenantMiddleware");
const T = require("../services/tarefas");
const TF = require("../services/tarefasFiscais"); // 18g.1

const quem = async (req) => { try { const { data } = await supabase.from("usuarios").select("*").eq("tenant_id", req.tenantId).eq("id", req.userId); return { id: req.userId, nome: data?.[0]?.nome || req.userEmail || null, email: req.userEmail || null }; } catch { return { id: req.userId, nome: req.userEmail || null }; } };
const responder = (fn, criado = false) => async (req, res) => {
  try { const r = await fn(req); if (r && r.erro) { const { status, ...resto } = r; return res.status(status || 400).json(resto); } res.status(criado ? 201 : 200).json(r); }
  catch (err) { console.error("❌ [tarefas]", err.message); res.status(500).json({ erro: err.message }); }
};

router.get("/", tenantMiddleware, responder(async (req) => { await TF.sincronizar(supabase, req.tenantId, { quem: await quem(req) }).catch((e) => console.error("❌ [fiscal] sincronizar", e.message)); return T.listar(supabase, req.tenantId); }));
router.get("/pessoas", tenantMiddleware, responder(async (req) => ({ eu: req.userId != null ? String(req.userId) : null, pessoas: await T.pessoas(supabase, req.tenantId) }))); // 18g.2a
router.get("/tipos", tenantMiddleware, responder(async () => ({ tipos: T.TIPOS, vinculos: T.VINCULOS })));
router.get("/:id", tenantMiddleware, responder((req) => T.detalhe(supabase, req.tenantId, req.params.id)));
router.post("/", tenantMiddleware, responder(async (req) => T.criar(supabase, req.tenantId, await quem(req), req.body || {}), true));
router.put("/:id", tenantMiddleware, responder(async (req) => T.atualizar(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
router.delete("/:id", tenantMiddleware, responder((req) => T.excluir(supabase, req.tenantId, req.params.id)));
router.post("/:id/comentario", tenantMiddleware, responder(async (req) => T.comentar(supabase, req.tenantId, await quem(req), req.params.id, req.body?.texto)));
router.get("/:id/fiscal/ficha-cte", tenantMiddleware, responder((req) => require("../services/fichaCte").ficha(supabase, req.tenantId, req.params.id))); // 18g.3: 📋 ficha do CT-e
router.post("/:id/fiscal/mdfe/:entrada/programar", tenantMiddleware, responder(async (req) => { // 18g.2: AT em rascunho a partir do MDF-e
  const perfis = Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean);
  if (!perfis.some((p) => ["admin", "gestor", "operacao", "fiscal"].includes(p))) return { status: 409, erro: "Sem permissão para programar AT" };
  return TF.programarDoMdfe(supabase, req.tenantId, { ...(await quem(req)), perfis }, req.params.id, req.params.entrada);
}));
router.post("/:id/fiscal/:item/:entrada/substituir", tenantMiddleware, responder(async (req) => TF.substituirDoc(supabase, req.tenantId, { ...(await quem(req)), perfis: Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean) }, req.params.id, req.params.item, req.params.entrada, req.body || {}))); // 18g.2.4
router.post("/:id/fiscal/:item/:entrada/evento", tenantMiddleware, responder(async (req) => TF.eventoDoc(supabase, req.tenantId, await quem(req), req.params.id, req.params.item, req.params.entrada, req.body || {}))); // 18g.2.4
router.post("/:id/fiscal/dispensar", tenantMiddleware, responder(async (req) => TF.dispensar(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
router.post("/:id/fiscal/:item", tenantMiddleware, responder(async (req) => TF.registrarDoc(supabase, req.tenantId, await quem(req), req.params.id, req.params.item, req.body || {})));
router.delete("/:id/fiscal/:item/:entrada", tenantMiddleware, responder(async (req) => TF.removerDoc(supabase, req.tenantId, await quem(req), req.params.id, req.params.item, req.params.entrada)));
router.post("/:id/anexos", tenantMiddleware, responder(async (req) => T.anexar(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
router.get("/:id/anexos/:anexo", tenantMiddleware, responder((req) => T.linkAnexo(supabase, req.tenantId, req.params.id, req.params.anexo)));
router.delete("/:id/anexos/:anexo", tenantMiddleware, responder(async (req) => T.removerAnexo(supabase, req.tenantId, await quem(req), req.params.id, req.params.anexo)));

module.exports = router;
