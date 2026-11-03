// routes/tarefas.js — ✅ Plano de ação · etapa 18g: rastreabilidade (services/tarefas.js)
//   GET    /api/tarefas                         lista (com número TSK-…, tipo, evidências, histórico, vínculos)
//   GET    /api/tarefas/tipos                   tipos (TR · NC · AU · MT · CM · HR · GN)
//   GET    /api/tarefas/:id                     uma tarefa
//   POST   /api/tarefas                         { titulo, detalhe, responsavel, prazo, prioridade, status, tipo, vinculos }
//   PUT    /api/tarefas/:id                     campos acima — cada mudança vai para o histórico (número não muda)
//   DELETE /api/tarefas/:id                     só tarefa sem número (as numeradas se cancelam — auditoria)
//   POST   /api/tarefas/:id/comentario          { texto }
//   POST   /api/tarefas/:id/anexos              { nome, mime, base64 } evidência · GET /:id/anexos/:anexo (link) · DELETE /:id/anexos/:anexo
//   18b.2: tarefa que nasceu de outra tela (ex.: 📣 prospecção) só se encerra lá — 409 (não desloga)
const express = require("express");
const router = express.Router();
const { supabase } = require("../db");
const tenantMiddleware = require("../middleware/tenantMiddleware");
const T = require("../services/tarefas");

const quem = async (req) => { try { const { data } = await supabase.from("usuarios").select("*").eq("tenant_id", req.tenantId).eq("id", req.userId); return { id: req.userId, nome: data?.[0]?.nome || req.userEmail || null, email: req.userEmail || null }; } catch { return { id: req.userId, nome: req.userEmail || null }; } };
const responder = (fn, criado = false) => async (req, res) => {
  try { const r = await fn(req); if (r && r.erro) { const { status, ...resto } = r; return res.status(status || 400).json(resto); } res.status(criado ? 201 : 200).json(r); }
  catch (err) { console.error("❌ [tarefas]", err.message); res.status(500).json({ erro: err.message }); }
};

router.get("/", tenantMiddleware, responder((req) => T.listar(supabase, req.tenantId)));
router.get("/tipos", tenantMiddleware, responder(async () => ({ tipos: T.TIPOS, vinculos: T.VINCULOS })));
router.get("/:id", tenantMiddleware, responder((req) => T.detalhe(supabase, req.tenantId, req.params.id)));
router.post("/", tenantMiddleware, responder(async (req) => T.criar(supabase, req.tenantId, await quem(req), req.body || {}), true));
router.put("/:id", tenantMiddleware, responder(async (req) => T.atualizar(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
router.delete("/:id", tenantMiddleware, responder((req) => T.excluir(supabase, req.tenantId, req.params.id)));
router.post("/:id/comentario", tenantMiddleware, responder(async (req) => T.comentar(supabase, req.tenantId, await quem(req), req.params.id, req.body?.texto)));
router.post("/:id/anexos", tenantMiddleware, responder(async (req) => T.anexar(supabase, req.tenantId, await quem(req), req.params.id, req.body || {})));
router.get("/:id/anexos/:anexo", tenantMiddleware, responder((req) => T.linkAnexo(supabase, req.tenantId, req.params.id, req.params.anexo)));
router.delete("/:id/anexos/:anexo", tenantMiddleware, responder(async (req) => T.removerAnexo(supabase, req.tenantId, await quem(req), req.params.id, req.params.anexo)));

module.exports = router;
