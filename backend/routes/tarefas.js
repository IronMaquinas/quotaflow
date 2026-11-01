// routes/tarefas.js
const express = require("express");
const router = express.Router();
const { DB } = require("../db");
const tenantMiddleware = require("../middleware/tenantMiddleware");

// GET /api/tarefas - Listar tarefas do tenant
router.get("/", tenantMiddleware, async (req, res) => {
  try {
    const tarefas = await DB.select("tarefas", {}, req.tenantId);
    const parsed = tarefas.map(t => {
      let comentarios = [];
      if (t.comentarios) {
        // Se já for array, usa direto; se for string, parse; senão, array vazio
        if (Array.isArray(t.comentarios)) {
          comentarios = t.comentarios;
        } else if (typeof t.comentarios === 'string') {
          try { comentarios = JSON.parse(t.comentarios); } catch (e) { comentarios = []; }
        } else {
          comentarios = [];
        }
      }
      return { ...t, comentarios };
    });
    res.json(parsed || []);
  } catch (err) {
    console.error("❌ GET /tarefas erro:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/tarefas - Criar tarefa
router.post("/", tenantMiddleware, async (req, res) => {
  try {
    const { titulo, detalhe, responsavel, prazo, prioridade, status } = req.body;
    const nova = await DB.insert("tarefas", {
      titulo,
      detalhe: detalhe || "",
      responsavel: responsavel || null,
      prazo: prazo || null,
      prioridade: prioridade || "media",
      status: status || "pendente",
      criado_em: new Date().toISOString()
    }, req.tenantId);
    nova.comentarios = [];
    res.status(201).json(nova);
  } catch (err) {
    console.error("❌ POST /tarefas erro:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// 18b.2: tarefa que nasceu de outra tela (ex.: 📣 prospecção) só se encerra lá — 409 (não desloga)
const ORIGEM_NOME = { prospeccao: "📈 Comercial → 📣 Prospecção (encerra quando o BID for criado ou o comercial cancelar)" };
async function travaOrigem(req, encerrando) {
  const t = await DB.selectOne("tarefas", { id: req.params.id }, req.tenantId).catch(() => null);
  if (!t || !t.origem || !ORIGEM_NOME[t.origem] || !encerrando) return null;
  return `Esta tarefa se resolve em ${ORIGEM_NOME[t.origem]}.`;
}

// PUT /api/tarefas/:id - Atualizar tarefa
router.put("/:id", tenantMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const trava = await travaOrigem(req, ["concluida", "cancelada"].includes(req.body?.status));
    if (trava) return res.status(409).json({ erro: trava });
    if (req.body) { delete req.body.origem; delete req.body.origem_ref; }
    const updated = await DB.update("tarefas", id, req.body, req.tenantId);
    if (!updated) return res.status(404).json({ erro: "Tarefa não encontrada" });
    // Parse comentarios se existir
    let comentarios = [];
    if (updated.comentarios) {
      if (Array.isArray(updated.comentarios)) comentarios = updated.comentarios;
      else if (typeof updated.comentarios === 'string') {
        try { comentarios = JSON.parse(updated.comentarios); } catch (e) { comentarios = []; }
      }
    }
    updated.comentarios = comentarios;
    res.json(updated);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// DELETE /api/tarefas/:id - Deletar tarefa
router.delete("/:id", tenantMiddleware, async (req, res) => {
  try {
    const trava = await travaOrigem(req, true);
    if (trava) return res.status(409).json({ erro: trava });
    await DB.delete("tarefas", req.params.id, req.tenantId);
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ DELETE /tarefas erro:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/tarefas/:id/comentario - Adicionar comentário
router.post("/:id/comentario", tenantMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { texto } = req.body;
    const tarefa = await DB.selectOne("tarefas", { id }, req.tenantId);
    if (!tarefa) return res.status(404).json({ erro: "Tarefa não encontrada" });

    let comentarios = [];
    if (tarefa.comentarios) {
      if (Array.isArray(tarefa.comentarios)) comentarios = tarefa.comentarios;
      else if (typeof tarefa.comentarios === 'string') {
        try { comentarios = JSON.parse(tarefa.comentarios); } catch (e) { comentarios = []; }
      }
    }
    comentarios.push({
      id: Date.now(),
      texto,
      autor: req.userEmail || "Usuário",
      data: new Date().toISOString()
    });

    await DB.update("tarefas", id, {
      comentarios: JSON.stringify(comentarios)
    }, req.tenantId);

    const atualizada = await DB.selectOne("tarefas", { id }, req.tenantId);
    atualizada.comentarios = comentarios;
    res.json(atualizada);
  } catch (err) {
    console.error("❌ POST comentario erro:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;