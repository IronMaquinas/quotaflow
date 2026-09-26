// routes/naoConformidades.js
//
// Ecossistema de Não Conformidades (NC) — alinhado com ISO 9001:2015
// cláusula 10.2, mas com fluxo enxuto pra PME.
//
// Origens: 'recebimento' | 'os_material' | 'os_servico' | 'inspecao' | 'pos_venda'
//
// Fluxo único (sem classificação simples/complexa):
//   aberta → em_analise → em_execucao → resolvida
//                                     ↘ cancelada
//
// Bloqueia conclusão da OS enquanto status ∈ {aberta, em_analise, em_execucao}.
// Libera quando status ∈ {resolvida, cancelada}.
//
// Plano de ação 3W é OPCIONAL. Verificação de eficácia fica pra módulo
// separado de Melhoria Contínua (v2+).

const express = require('express');
const router = express.Router();
const { DB } = require('../db');
const tenantMiddleware = require('../middleware/tenantMiddleware');

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

async function usuarioAtual(req, tenantId) {
  let nome = null;
  if (req.userId) {
    try {
      const u = await DB.selectOne("usuarios", { id: req.userId }, tenantId);
      nome = u?.nome || null;
    } catch (_) {}
  }
  return { id: req.userId || null, nome, email: req.userEmail || null };
}

// Mesma lógica do gerarNumeroNC que existe em routes/estoque/movimentacoes
// — replicado porque NC agora tem casa canônica própria. O antigo continua
// funcionando, este vira a referência pra novas chamadas.
async function gerarNumeroNC(tenantId) {
  const ano = new Date().getFullYear();
  const prefix = `NC-${ano}-`;

  const todasNC = await DB.select('nao_conformidades', { tenant_id: tenantId }, tenantId).catch(() => []);

  let seq = 1;
  const numerosDoAno = (todasNC || [])
    .map(nc => nc.numero_nc)
    .filter(n => n && n.startsWith(prefix))
    .map(n => {
      const match = n.match(/(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    });

  if (numerosDoAno.length > 0) {
    seq = Math.max(...numerosDoAno) + 1;
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function registrarEventoNC(tenantId, ncId, tipo, descricao, dados, usuario) {
  try {
    await DB.insert("nao_conformidade_eventos", {
      tenant_id: tenantId,
      nc_id: ncId,
      tipo,
      descricao,
      dados: dados || null,
      criado_por: usuario?.id || null,
      criado_por_nome: usuario?.nome || null,
    }, tenantId);
  } catch (err) {
    console.warn("⚠ Falha ao registrar evento NC (não bloqueante):", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// POST /api/nao-conformidades
//
// Body:
//   origem, descricao_problema (obrigatório), acao_imediata (opcional),
//   disposicao (opcional, default 'pendente'),
//   responsavel_id, responsavel_nome (opcionais),
//   custo_estimado (opcional),
//   chamado_id, chamado_item_id, equipamento_id, item_catalogo_id (opcionais),
//   anexos: [{ url, nome_arquivo, mime_type, tamanho_bytes }] (opcional)
// ─────────────────────────────────────────────────────────────────────────
router.post('/', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const {
    origem, descricao_problema, acao_imediata,
    disposicao, responsavel_id, responsavel_nome,
    custo_estimado, quantidade_afetada,
    chamado_id, chamado_item_id, equipamento_id, item_catalogo_id,
    anexos,
  } = req.body;

  try {
    if (!descricao_problema || !descricao_problema.trim()) {
      return res.status(400).json({ erro: "descricao_problema é obrigatória" });
    }

    const origensValidas = ["recebimento", "os_material", "os_servico", "inspecao", "pos_venda"];
    const origemFinal = origem && origensValidas.includes(origem) ? origem : "os_material";

    const disposicoesValidas = ["pendente", "devolucao", "retrabalho", "descarte", "uso_como_esta"];
    const disposicaoFinal = disposicao && disposicoesValidas.includes(disposicao) ? disposicao : "pendente";

    // M4: resolver OC/fornecedor uma vez — dentro do try pra capturar
    // erro do DB sem travar o handler.
    const ovParaNC = req.body.ordem_venda_id
      ? await DB.selectOne("ordens_venda", { id: req.body.ordem_venda_id, tenant_id: tenantId }, tenantId)
      : null;

    const u = await usuarioAtual(req, tenantId);
    const numeroNC = await gerarNumeroNC(tenantId);

    // M4: aceita fornecedor_id no body (o frontend do recebimento passa
    // direto da OC). Se não vier e tiver chamado_id, tenta resolver via
    // OC daquele chamado.
    let fornecedorIdFinal = req.body.fornecedor_id || null;
    if (!fornecedorIdFinal && chamado_id) {
      try {
        const cot = await DB.selectOne("cotacoes", { chamado_id, tenant_id: tenantId }, tenantId);
        if (cot) {
          const ov = await DB.selectOne("ordens_venda", { cotacao_id: cot.id, tenant_id: tenantId }, tenantId);
          fornecedorIdFinal = ov?.fornecedor_id || null;
        }
      } catch (_) {}
    }

    const nc = await DB.insert("nao_conformidades", {
      tenant_id: tenantId,
      numero_nc: numeroNC,
      origem: origemFinal,
      descricao_problema: descricao_problema.trim(),
      acao_imediata: acao_imediata?.trim() || null,
      disposicao: disposicaoFinal,
      status: "aberta",
      responsavel_id: responsavel_id || null,
      responsavel_nome: responsavel_nome || null,
      custo_estimado: custo_estimado != null ? parseFloat(custo_estimado) : null,
      chamado_id: chamado_id || null,
      chamado_item_id: chamado_item_id || null,
      equipamento_id: equipamento_id || null,
      item_catalogo_id: item_catalogo_id || null,
      quantidade: quantidade_afetada != null ? parseFloat(quantidade_afetada) : null,
      inspetor_id: u.id,
      criado_por_nome: u.nome,
      motivo_recusa: descricao_problema.trim(),
      fornecedor_id: fornecedorIdFinal,
      fornecedor_tratativa_status: fornecedorIdFinal ? "nao_notificado" : null,
    }, tenantId);

    // Anexos (fotos como data URI)
    const anexosInseridos = [];
    if (Array.isArray(anexos) && anexos.length > 0) {
      for (let i = 0; i < anexos.length; i++) {
        const a = anexos[i];
        if (!a?.url) continue;
        const nomePadrao = a.nome_arquivo || `${numeroNC}-foto-${String(i + 1).padStart(2, '0')}.jpg`;
        const anexo = await DB.insert("nao_conformidade_anexos", {
          tenant_id: tenantId,
          nc_id: nc.id,
          url: a.url,
          nome_arquivo: nomePadrao,
          mime_type: a.mime_type || null,
          tamanho_bytes: a.tamanho_bytes != null ? parseInt(a.tamanho_bytes) : null,
          criado_por: u.id,
          criado_por_nome: u.nome,
        }, tenantId);
        anexosInseridos.push(anexo);
      }
    }

    await registrarEventoNC(
      tenantId, nc.id, "criacao",
      `NC criada (origem: ${origemFinal}) — ${descricao_problema.trim().slice(0, 100)}`,
      { origem: origemFinal, anexos: anexosInseridos.length, visivel_fornecedor: !!fornecedorIdFinal },
      u
    );

    // M4: se tem fornecedor, marca evento como visível e dispara email.
    // Best-effort — não bloqueia resposta.
    if (fornecedorIdFinal) {
      try {
        const forn = await DB.selectOne("fornecedores", { id: fornecedorIdFinal, tenant_id: tenantId }, tenantId);
        const emailDestino = forn?.email;
        if (emailDestino) {
          const { enviarEmailCotacao } = require("../services/emailService");
          const baseUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
          const linkNC = `${baseUrl}/#/portal`;
          const corpo = `
            <h2>Não Conformidade registrada</h2>
            <p>Olá <strong>${forn.nome || "Fornecedor"}</strong>,</p>
            <p>Foi registrada uma <strong>Não Conformidade</strong> contra um recebimento seu:</p>
            <ul>
              <li><strong>NC:</strong> ${numeroNC}</li>
              ${ovParaNC?.numero ? `<li><strong>Pedido:</strong> ${ovParaNC.numero}</li>` : ""}
              ${req.body.numero_nota_fiscal ? `<li><strong>NF:</strong> ${req.body.numero_nota_fiscal}</li>` : ""}
              <li><strong>Motivo:</strong> ${descricao_problema.trim()}</li>
            </ul>
            <p>Acesse o Portal do Fornecedor para ver os detalhes, responder e anexar evidências:</p>
            <p><a href="${linkNC}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;">Abrir Portal do Fornecedor</a></p>
            <hr/>
            <p><small>Mensagem automática do QuotaFlow.</small></p>
          `;
          await enviarEmailCotacao(emailDestino, `Não Conformidade ${numeroNC} — ${forn.nome}`, corpo);
          await DB.update("nao_conformidades", nc.id, {
            fornecedor_tratativa_status: "notificado",
          }, tenantId);
        }
      } catch (mailErr) {
        console.warn("⚠ Falha ao notificar fornecedor (não bloqueante):", mailErr.message);
      }
    }

    res.status(201).json({
      ok: true,
      nc: { ...nc, anexos: anexosInseridos },
      mensagem: `${numeroNC} registrada`,
    });
  } catch (err) {
    console.error("❌ Erro ao criar NC:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/nao-conformidades
//
// Query params: status, origem, chamado_id, equipamento_id, q (busca texto)
// ─────────────────────────────────────────────────────────────────────────
router.get('/', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { status, origem, chamado_id, equipamento_id, q } = req.query;

  try {
    let ncs = await DB.select("nao_conformidades", { tenant_id: tenantId }, tenantId);

    if (status) ncs = ncs.filter(nc => nc.status === status);
    if (origem) ncs = ncs.filter(nc => nc.origem === origem);
    if (chamado_id) ncs = ncs.filter(nc => String(nc.chamado_id) === String(chamado_id));
    if (equipamento_id) ncs = ncs.filter(nc => String(nc.equipamento_id) === String(equipamento_id));

    if (q && q.trim()) {
      const termo = q.trim().toLowerCase();
      ncs = ncs.filter(nc =>
        (nc.numero_nc || "").toLowerCase().includes(termo)
        || (nc.descricao_problema || "").toLowerCase().includes(termo)
        || (nc.fornecedor_nome || "").toLowerCase().includes(termo)
        || (nc.criado_por_nome || "").toLowerCase().includes(termo)
      );
    }

    // Enriquecer com contexto (número da OS + nome do equipamento) pra
    // evitar que o frontend precise fazer N chamadas pra montar a lista.
    const chamadoIds = [...new Set(ncs.map(nc => nc.chamado_id).filter(Boolean))];
    const equipamentoIds = [...new Set(ncs.map(nc => nc.equipamento_id).filter(Boolean))];

    let chamadosPorId = {};
    if (chamadoIds.length > 0) {
      const chamados = await DB.select("chamados", { tenant_id: tenantId }, tenantId);
      chamados
        .filter(c => chamadoIds.includes(c.id))
        .forEach(c => { chamadosPorId[c.id] = c; });
    }

    let equipamentosPorId = {};
    if (equipamentoIds.length > 0) {
      const equipamentos = await DB.select("equipamentos", { tenant_id: tenantId }, tenantId);
      equipamentos
        .filter(e => equipamentoIds.includes(e.id))
        .forEach(e => { equipamentosPorId[e.id] = e; });
    }

    ncs = ncs.map(nc => ({
      ...nc,
      chamado_numero: nc.chamado_id ? (chamadosPorId[nc.chamado_id]?.numero || null) : null,
      equipamento_nome: nc.equipamento_id ? (equipamentosPorId[nc.equipamento_id]?.nome || null) : null,
      equipamento_tag: nc.equipamento_id ? (equipamentosPorId[nc.equipamento_id]?.tag || null) : null,
    }));

    ncs.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
    res.json(ncs);
  } catch (err) {
    console.error("❌ Erro ao listar NCs:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/nao-conformidades/:id
//
// Detalhe completo com anexos, eventos e plano de ação.
// ─────────────────────────────────────────────────────────────────────────
router.get('/:id', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  try {
    const nc = await DB.selectOne("nao_conformidades", { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: "NC não encontrada" });

    const anexos = await DB.select("nao_conformidade_anexos", { nc_id: id, tenant_id: tenantId }, tenantId);
    const eventos = await DB.select("nao_conformidade_eventos", { nc_id: id, tenant_id: tenantId }, tenantId);
    const planoAcao = await DB.select("nao_conformidade_plano_acao", { nc_id: id, tenant_id: tenantId }, tenantId);

    eventos.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
    anexos.sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em));
    planoAcao.sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em));

    // Enriquecer com número da OS e equipamento pra rastreabilidade na UI
    let chamado_numero = null;
    let equipamento_nome = null;
    let equipamento_tag = null;

    if (nc.chamado_id) {
      try {
        const ch = await DB.selectOne("chamados", { id: nc.chamado_id, tenant_id: tenantId }, tenantId);
        chamado_numero = ch?.numero || null;
      } catch (_) {}
    }
    if (nc.equipamento_id) {
      try {
        const eq = await DB.selectOne("equipamentos", { id: nc.equipamento_id, tenant_id: tenantId }, tenantId);
        equipamento_nome = eq?.nome || null;
        equipamento_tag = eq?.tag || null;
      } catch (_) {}
    }

    res.json({
      ...nc,
      anexos, eventos, plano_acao: planoAcao,
      chamado_numero, equipamento_nome, equipamento_tag,
    });
  } catch (err) {
    console.error("❌ Erro ao buscar NC:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUT /api/nao-conformidades/:id
//
// Atualização geral: responsável, custo, ação imediata, 5 porquês, causa raiz.
// Campos imutáveis aqui: numero_nc, origem, chamado_id, criado_em.
// ─────────────────────────────────────────────────────────────────────────
router.put('/:id', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const {
    responsavel_id, responsavel_nome,
    custo_estimado, custo_real,
    acao_imediata, cinco_porques, causa_raiz,
  } = req.body;

  try {
    const nc = await DB.selectOne("nao_conformidades", { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: "NC não encontrada" });

    const upd = { atualizado_em: new Date().toISOString() };
    if (responsavel_id !== undefined) upd.responsavel_id = responsavel_id;
    if (responsavel_nome !== undefined) upd.responsavel_nome = responsavel_nome;
    if (custo_estimado !== undefined) upd.custo_estimado = custo_estimado != null ? parseFloat(custo_estimado) : null;
    if (custo_real !== undefined) upd.custo_real = custo_real != null ? parseFloat(custo_real) : null;
    if (acao_imediata !== undefined) upd.acao_imediata = acao_imediata;
    if (cinco_porques !== undefined) upd.cinco_porques = cinco_porques;
    if (causa_raiz !== undefined) upd.causa_raiz = causa_raiz;

    const atualizada = await DB.update("nao_conformidades", id, upd, tenantId);

    const u = await usuarioAtual(req, tenantId);
    const camposAlterados = Object.keys(upd).filter(k => k !== "atualizado_em");
    if (camposAlterados.length > 0) {
      await registrarEventoNC(
        tenantId, id, "atualizacao",
        `Campos atualizados: ${camposAlterados.join(", ")}`,
        { campos: camposAlterados },
        u
      );
    }

    res.json({ ok: true, nc: atualizada });
  } catch (err) {
    console.error("❌ Erro ao atualizar NC:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUT /api/nao-conformidades/:id/status
//
// Transição de status. Regras:
//   → 'resolvida'  exige solucao_aplicada
//   → 'cancelada'  exige motivo no body
// Body: { status, solucao_aplicada?, motivo? }
// ─────────────────────────────────────────────────────────────────────────
router.put('/:id/status', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { status, solucao_aplicada, motivo, atribuir_a_mim } = req.body;

  try {
    const statusValidos = ["aberta", "em_analise", "em_execucao", "resolvida", "cancelada"];
    if (!status || !statusValidos.includes(status)) {
      return res.status(400).json({ erro: `status inválido. Use: ${statusValidos.join(", ")}` });
    }

    const nc = await DB.selectOne("nao_conformidades", { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: "NC não encontrada" });

    if (nc.status === status) {
      return res.status(400).json({ erro: `NC já está com status "${status}"` });
    }

    const upd = { status, atualizado_em: new Date().toISOString() };

    // Atribuição de responsável: quando o usuário clica em "Pegar para
    // análise", o frontend manda atribuir_a_mim=true e o backend grava
    // o usuário logado como responsável pela tratativa.
    if (atribuir_a_mim) {
      const u = await usuarioAtual(req, tenantId);
      upd.responsavel_id = u.id;
      upd.responsavel_nome = u.nome;
    }

    if (status === "resolvida") {
      if (!solucao_aplicada || !solucao_aplicada.trim()) {
        return res.status(400).json({ erro: "solucao_aplicada é obrigatória ao resolver uma NC" });
      }
      upd.solucao_aplicada = solucao_aplicada.trim();
      upd.resolvida_em = new Date().toISOString();
      upd.resolvida_por = req.userId || null;
      const u = await usuarioAtual(req, tenantId);
      upd.resolvida_por_nome = u.nome;
    }

    if (status === "cancelada") {
      if (!motivo || !motivo.trim()) {
        return res.status(400).json({ erro: "motivo é obrigatório ao cancelar uma NC" });
      }
    }

    await DB.update("nao_conformidades", id, upd, tenantId);

    const u = await usuarioAtual(req, tenantId);
    const desc = status === "resolvida"
      ? `NC resolvida: ${solucao_aplicada.trim()}`
      : status === "cancelada"
        ? `NC cancelada. Motivo: ${motivo.trim()}`
        : `Status alterado: ${nc.status} → ${status}`;
    await registrarEventoNC(
      tenantId, id, status === "resolvida" ? "resolucao" : status === "cancelada" ? "cancelamento" : "status_alterado",
      desc,
      { de: nc.status, para: status, solucao: solucao_aplicada || null, motivo: motivo || null },
      u
    );

    const atualizada = await DB.selectOne("nao_conformidades", { id }, tenantId);
    res.json({ ok: true, nc: atualizada, mensagem: `NC agora está ${status}` });
  } catch (err) {
    console.error("❌ Erro ao alterar status da NC:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUT /api/nao-conformidades/:id/disposicao
// Body: { disposicao }
// ─────────────────────────────────────────────────────────────────────────
router.put('/:id/disposicao', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { disposicao } = req.body;

  try {
    const validos = ["pendente", "devolucao", "retrabalho", "descarte", "uso_como_esta"];
    if (!disposicao || !validos.includes(disposicao)) {
      return res.status(400).json({ erro: `disposicao inválida. Use: ${validos.join(", ")}` });
    }

    const nc = await DB.selectOne("nao_conformidades", { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: "NC não encontrada" });

    await DB.update("nao_conformidades", id, {
      disposicao, atualizado_em: new Date().toISOString(),
    }, tenantId);

    const u = await usuarioAtual(req, tenantId);
    await registrarEventoNC(
      tenantId, id, "disposicao_definida",
      `Disposição definida: ${disposicao}`,
      { de: nc.disposicao, para: disposicao },
      u
    );

    res.json({ ok: true, mensagem: `Disposição: ${disposicao}` });
  } catch (err) {
    console.error("❌ Erro ao alterar disposição:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/nao-conformidades/:id/plano-acao
// Body: { acao, responsavel_id, responsavel_nome, prazo }
// ─────────────────────────────────────────────────────────────────────────
router.post('/:id/plano-acao', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { acao, responsavel_id, responsavel_nome, prazo } = req.body;

  try {
    if (!acao || !acao.trim()) return res.status(400).json({ erro: "acao é obrigatória" });
    if (!prazo) return res.status(400).json({ erro: "prazo é obrigatório" });

    const nc = await DB.selectOne("nao_conformidades", { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: "NC não encontrada" });

    const u = await usuarioAtual(req, tenantId);
    const item = await DB.insert("nao_conformidade_plano_acao", {
      tenant_id: tenantId,
      nc_id: id,
      acao: acao.trim(),
      responsavel_id: responsavel_id || null,
      responsavel_nome: responsavel_nome || null,
      prazo,
      status: "pendente",
      criado_por: u.id,
      criado_por_nome: u.nome,
    }, tenantId);

    await registrarEventoNC(
      tenantId, id, "plano_acao_adicionado",
      `Plano de ação: "${acao.trim()}" (prazo ${prazo})`,
      { plano_acao_id: item.id, responsavel_nome },
      u
    );

    res.status(201).json({ ok: true, plano_acao: item });
  } catch (err) {
    console.error("❌ Erro ao criar plano de ação:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUT /api/nao-conformidades/plano-acao/:planoId
// Body: { acao?, responsavel_id?, responsavel_nome?, prazo?, status?, observacao? }
// ─────────────────────────────────────────────────────────────────────────
router.put('/plano-acao/:planoId', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { planoId } = req.params;
  const { acao, responsavel_id, responsavel_nome, prazo, status, observacao } = req.body;

  try {
    const plano = await DB.selectOne("nao_conformidade_plano_acao", { id: planoId, tenant_id: tenantId }, tenantId);
    if (!plano) return res.status(404).json({ erro: "Plano de ação não encontrado" });

    const upd = { atualizado_em: new Date().toISOString() };
    if (acao !== undefined) upd.acao = acao;
    if (responsavel_id !== undefined) upd.responsavel_id = responsavel_id;
    if (responsavel_nome !== undefined) upd.responsavel_nome = responsavel_nome;
    if (prazo !== undefined) upd.prazo = prazo;
    if (observacao !== undefined) upd.observacao = observacao;

    if (status !== undefined) {
      const validos = ["pendente", "em_andamento", "concluida", "cancelada"];
      if (!validos.includes(status)) return res.status(400).json({ erro: "status inválido" });
      upd.status = status;
      if (status === "concluida") {
        const u = await usuarioAtual(req, tenantId);
        upd.concluida_em = new Date().toISOString();
        upd.concluida_por = u.id;
        upd.concluida_por_nome = u.nome;
        await registrarEventoNC(
          tenantId, plano.nc_id, "plano_acao_concluido",
          `Plano de ação concluído: "${plano.acao}"`,
          { plano_acao_id: planoId },
          u
        );
      }
    }

    const atualizado = await DB.update("nao_conformidade_plano_acao", planoId, upd, tenantId);
    res.json({ ok: true, plano_acao: atualizado });
  } catch (err) {
    console.error("❌ Erro ao atualizar plano de ação:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// DELETE /api/nao-conformidades/plano-acao/:planoId
// ─────────────────────────────────────────────────────────────────────────
router.delete('/plano-acao/:planoId', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { planoId } = req.params;
  try {
    const plano = await DB.selectOne("nao_conformidade_plano_acao", { id: planoId, tenant_id: tenantId }, tenantId);
    if (!plano) return res.status(404).json({ erro: "Plano de ação não encontrado" });
    await DB.delete("nao_conformidade_plano_acao", planoId, tenantId);
    res.json({ ok: true, mensagem: "Plano de ação removido" });
  } catch (err) {
    console.error("❌ Erro ao remover plano de ação:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/nao-conformidades/:id/anexos
// Body: { url, nome_arquivo?, mime_type?, tamanho_bytes? }
// ─────────────────────────────────────────────────────────────────────────
router.post('/:id/anexos', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { url, nome_arquivo, mime_type, tamanho_bytes } = req.body;

  try {
    if (!url) return res.status(400).json({ erro: "url é obrigatória" });

    const nc = await DB.selectOne("nao_conformidades", { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: "NC não encontrada" });

    const anexosExistentes = await DB.select("nao_conformidade_anexos", { nc_id: id, tenant_id: tenantId }, tenantId);
    const seq = anexosExistentes.length + 1;
    const nomeFinal = nome_arquivo || `${nc.numero_nc}-foto-${String(seq).padStart(2, '0')}.jpg`;

    const u = await usuarioAtual(req, tenantId);
    const anexo = await DB.insert("nao_conformidade_anexos", {
      tenant_id: tenantId,
      nc_id: id,
      url,
      nome_arquivo: nomeFinal,
      mime_type: mime_type || null,
      tamanho_bytes: tamanho_bytes != null ? parseInt(tamanho_bytes) : null,
      criado_por: u.id,
      criado_por_nome: u.nome,
    }, tenantId);

    await registrarEventoNC(
      tenantId, id, "anexo_adicionado",
      `Anexo adicionado: ${nomeFinal}`,
      { anexo_id: anexo.id },
      u
    );

    res.status(201).json({ ok: true, anexo });
  } catch (err) {
    console.error("❌ Erro ao adicionar anexo:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// DELETE /api/nao-conformidades/anexos/:anexoId
// ─────────────────────────────────────────────────────────────────────────
router.delete('/anexos/:anexoId', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { anexoId } = req.params;
  try {
    const anexo = await DB.selectOne("nao_conformidade_anexos", { id: anexoId, tenant_id: tenantId }, tenantId);
    if (!anexo) return res.status(404).json({ erro: "Anexo não encontrado" });

    await DB.delete("nao_conformidade_anexos", anexoId, tenantId);

    const u = await usuarioAtual(req, tenantId);
    await registrarEventoNC(
      tenantId, anexo.nc_id, "anexo_removido",
      `Anexo removido: ${anexo.nome_arquivo}`,
      { anexo_id: anexoId },
      u
    );

    res.json({ ok: true, mensagem: "Anexo removido" });
  } catch (err) {
    console.error("❌ Erro ao remover anexo:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/nao-conformidades/:id/comentario
// Body: { descricao }
// ─────────────────────────────────────────────────────────────────────────
router.post('/:id/comentario', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { descricao } = req.body;

  try {
    if (!descricao || !descricao.trim()) return res.status(400).json({ erro: "descricao é obrigatória" });
    const nc = await DB.selectOne("nao_conformidades", { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: "NC não encontrada" });

    const u = await usuarioAtual(req, tenantId);
    await registrarEventoNC(tenantId, id, "comentario", descricao.trim(), null, u);
    res.json({ ok: true, mensagem: "Comentário registrado" });
  } catch (err) {
    console.error("❌ Erro ao adicionar comentário:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUT /api/nao-conformidades/:id/transferir
//
// Transfere a responsabilidade pra outro usuário OU devolve pra fila
// (sem responsável, volta pro status 'aberta'). Registra evento na timeline.
//
// Body:
//   responsavel_id: UUID | null   (null = devolver pra fila)
//   responsavel_nome: string      (obrigatório se responsavel_id != null)
//   observacao: string            (opcional)
// ─────────────────────────────────────────────────────────────────────────
router.put('/:id/transferir', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { responsavel_id, responsavel_nome, observacao } = req.body;

  try {
    const nc = await DB.selectOne("nao_conformidades", { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: "NC não encontrada" });
    if (["resolvida", "cancelada"].includes(nc.status)) {
      return res.status(400).json({ erro: "NC já encerrada — não pode ser transferida" });
    }

    const u = await usuarioAtual(req, tenantId);
    const devolverParaFila = !responsavel_id;

    const upd = { atualizado_em: new Date().toISOString() };

    if (devolverParaFila) {
      upd.responsavel_id = null;
      upd.responsavel_nome = null;
      // Devolver volta pro estado original — qualquer pessoa pode pegar de novo.
      upd.status = "aberta";
    } else {
      if (!responsavel_nome) {
        return res.status(400).json({ erro: "responsavel_nome é obrigatório" });
      }
      upd.responsavel_id = responsavel_id;
      upd.responsavel_nome = responsavel_nome;
      // Se estava 'aberta' e alguém assume via transferência, vira 'em_analise'.
      if (nc.status === "aberta") upd.status = "em_analise";
    }

    await DB.update("nao_conformidades", id, upd, tenantId);

    const descricao = devolverParaFila
      ? `NC devolvida para a fila${observacao ? ` — ${observacao}` : ""}`
      : `NC transferida de ${nc.responsavel_nome || "fila"} para ${responsavel_nome}${observacao ? ` — ${observacao}` : ""}`;

    await registrarEventoNC(
      tenantId, id, "transferencia",
      descricao,
      {
        de: nc.responsavel_nome || null,
        para: devolverParaFila ? null : responsavel_nome,
        observacao: observacao || null,
      },
      u
    );

    const atualizada = await DB.selectOne("nao_conformidades", { id }, tenantId);
    res.json({ ok: true, nc: atualizada, mensagem: devolverParaFila ? "Devolvida para a fila" : `Transferida para ${responsavel_nome}` });
  } catch (err) {
    console.error("❌ Erro ao transferir NC:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// HELPERS DE PERMISSÃO
//
// No MVP, "qualidade" é mapeado pra gestor/admin. Quando virarmos SaaS
// maior, "qualidade" vira papel próprio.
// ─────────────────────────────────────────────────────────────────────────
async function perfilDoUsuario(req, tenantId) {
  try {
    const u = await DB.selectOne("usuarios", { id: req.userId, tenant_id: tenantId }, tenantId);
    return u?.perfil || null;
  } catch (_) { return null; }
}

function podeDirecionar(perfil) {
  return ["gestor", "admin"].includes(perfil);
}

// ─────────────────────────────────────────────────────────────────────────
// PUT /api/nao-conformidades/:id/direcionar
//
// Qualidade revisa e roteia pra uma área. Muda status aberta → em_analise.
// Body: { area_responsavel, responsavel_id, responsavel_nome, observacao? }
// ─────────────────────────────────────────────────────────────────────────
router.put('/:id/direcionar', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { area_responsavel, responsavel_id, responsavel_nome, observacao } = req.body;

  try {
    const perfil = await perfilDoUsuario(req, tenantId);
    if (!podeDirecionar(perfil)) {
      return res.status(403).json({ erro: "Apenas gestor ou admin podem direcionar NCs" });
    }

    const areasValidas = ["qualidade","engenharia","suprimentos","producao","manutencao"];
    if (!area_responsavel || !areasValidas.includes(area_responsavel)) {
      return res.status(400).json({ erro: `area_responsavel obrigatória. Use: ${areasValidas.join(", ")}` });
    }

    const nc = await DB.selectOne("nao_conformidades", { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: "NC não encontrada" });
    if (nc.status !== "aberta") {
      return res.status(400).json({ erro: `NC está "${nc.status}" — só é possível direcionar a partir de "aberta"` });
    }

    const u = await usuarioAtual(req, tenantId);

    await DB.update("nao_conformidades", id, {
      status: "em_analise",
      area_responsavel,
      responsavel_id: responsavel_id || null,
      responsavel_nome: responsavel_nome || null,
      atualizado_em: new Date().toISOString(),
    }, tenantId);

    await registrarEventoNC(
      tenantId, id, "direcionamento",
      `NC direcionada para ${area_responsavel}${responsavel_nome ? ` · responsável: ${responsavel_nome}` : ""}${observacao ? ` — ${observacao}` : ""}`,
      { area: area_responsavel, responsavel_id, responsavel_nome, observacao: observacao || null },
      u
    );

    const atualizada = await DB.selectOne("nao_conformidades", { id }, tenantId);
    res.json({ ok: true, nc: atualizada, mensagem: `NC direcionada para ${area_responsavel}` });
  } catch (err) {
    console.error("❌ Erro ao direcionar NC:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUT /api/nao-conformidades/:id/registrar-disposicao
//
// Responsável da área define o que fazer + atribui executante.
// Muda status em_analise → em_execucao.
// Body: { disposicao, acao_corretiva, executante_id, executante_nome }
// ─────────────────────────────────────────────────────────────────────────
router.put('/:id/registrar-disposicao', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const {
    disposicao, acao_corretiva, executante_id, executante_nome,
    area_responsavel,
  } = req.body;

  try {
    const disposicoesValidas = ["devolucao","retrabalho","descarte","uso_como_esta"];
    if (!disposicao || !disposicoesValidas.includes(disposicao)) {
      return res.status(400).json({ erro: `disposicao obrigatória. Use: ${disposicoesValidas.join(", ")}` });
    }
    if (!acao_corretiva || !acao_corretiva.trim()) {
      return res.status(400).json({ erro: "acao_corretiva é obrigatória" });
    }
    if (!executante_id || !executante_nome) {
      return res.status(400).json({ erro: "executante é obrigatório" });
    }

    const nc = await DB.selectOne("nao_conformidades", { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: "NC não encontrada" });
    if (nc.status !== "em_analise") {
      return res.status(400).json({ erro: `NC está "${nc.status}" — só é possível registrar disposição em "em_analise"` });
    }

    // Validação de permissão: quem registra tem que ser o responsável atual,
    // OU gestor/admin. Técnico "qualquer" não pode.
    const perfil = await perfilDoUsuario(req, tenantId);
    const ehResponsavel = String(nc.responsavel_id) === String(req.userId);
    if (!ehResponsavel && !podeDirecionar(perfil)) {
      return res.status(403).json({ erro: "Só o responsável atual, gestor ou admin podem registrar disposição" });
    }

    const u = await usuarioAtual(req, tenantId);

    // Área pode ser alterada nessa transição (a NC migra entre áreas).
    // Se não vier, mantém a área atual da NC.
    const areasValidas = ["qualidade","engenharia","suprimentos","producao","manutencao"];
    const areaFinal = area_responsavel && areasValidas.includes(area_responsavel)
      ? area_responsavel
      : nc.area_responsavel;

    await DB.update("nao_conformidades", id, {
      status: "em_execucao",
      disposicao,
      acao_corretiva: acao_corretiva.trim(),
      executante_id,
      executante_nome,
      area_responsavel: areaFinal,
      atualizado_em: new Date().toISOString(),
    }, tenantId);

    const mudouArea = areaFinal !== nc.area_responsavel;
    await registrarEventoNC(
      tenantId, id, "disposicao_definida",
      `Disposição registrada: ${disposicao} · Ação: "${acao_corretiva.trim().slice(0, 80)}" · Executor: ${executante_nome}${mudouArea ? ` · Área: ${nc.area_responsavel || "—"} → ${areaFinal}` : ""}`,
      { disposicao, acao_corretiva, executante_id, executante_nome, area_anterior: nc.area_responsavel, area_nova: areaFinal },
      u
    );

    const atualizada = await DB.selectOne("nao_conformidades", { id }, tenantId);
    res.json({ ok: true, nc: atualizada, mensagem: "Disposição registrada" });
  } catch (err) {
    console.error("❌ Erro ao registrar disposição:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUT /api/nao-conformidades/:id/devolver-validacao
//
// Executante termina a ação e devolve pra qualidade validar.
// Muda status em_execucao → aguardando_validacao.
// Body: { observacao? } (o que foi feito na prática)
// ─────────────────────────────────────────────────────────────────────────
router.put('/:id/devolver-validacao', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { observacao } = req.body;

  try {
    const nc = await DB.selectOne("nao_conformidades", { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: "NC não encontrada" });
    if (nc.status !== "em_execucao") {
      return res.status(400).json({ erro: `NC está "${nc.status}" — só é possível devolver em "em_execucao"` });
    }

    const perfil = await perfilDoUsuario(req, tenantId);
    const ehExecutante = String(nc.executante_id) === String(req.userId);
    if (!ehExecutante && !podeDirecionar(perfil)) {
      return res.status(403).json({ erro: "Só o executante, gestor ou admin podem devolver para validação" });
    }

    const u = await usuarioAtual(req, tenantId);

    await DB.update("nao_conformidades", id, {
      status: "aguardando_validacao",
      devolvida_validacao_em: new Date().toISOString(),
      devolvida_validacao_por: u.id,
      devolvida_validacao_por_nome: u.nome,
      atualizado_em: new Date().toISOString(),
    }, tenantId);

    await registrarEventoNC(
      tenantId, id, "devolucao_validacao",
      `Ação executada e devolvida para validação${observacao ? ` — ${observacao}` : ""}`,
      { observacao: observacao || null },
      u
    );

    const atualizada = await DB.selectOne("nao_conformidades", { id }, tenantId);
    res.json({ ok: true, nc: atualizada, mensagem: "Devolvida para validação da qualidade" });
  } catch (err) {
    console.error("❌ Erro ao devolver para validação:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUT /api/nao-conformidades/:id/encerrar
//
// Qualidade encerra com causa raiz. Muda aguardando_validacao → resolvida.
// Body: { causa_raiz, cinco_porques? (array de strings), observacao? }
// ─────────────────────────────────────────────────────────────────────────
router.put('/:id/encerrar', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { causa_raiz, cinco_porques, observacao } = req.body;

  try {
    const perfil = await perfilDoUsuario(req, tenantId);
    if (!podeDirecionar(perfil)) {
      return res.status(403).json({ erro: "Apenas gestor ou admin podem encerrar NCs" });
    }

    if (!causa_raiz || !causa_raiz.trim()) {
      return res.status(400).json({ erro: "causa_raiz é obrigatória para encerrar" });
    }

    const nc = await DB.selectOne("nao_conformidades", { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: "NC não encontrada" });
    if (nc.status !== "aguardando_validacao") {
      return res.status(400).json({ erro: `NC está "${nc.status}" — só é possível encerrar em "aguardando_validacao"` });
    }

    const u = await usuarioAtual(req, tenantId);

    const upd = {
      status: "resolvida",
      causa_raiz: causa_raiz.trim(),
      encerrada_por: u.id,
      encerrada_por_nome: u.nome,
      encerrada_em: new Date().toISOString(),
      resolvida_em: new Date().toISOString(),
      resolvida_por: u.id,
      resolvida_por_nome: u.nome,
      atualizado_em: new Date().toISOString(),
    };
    if (Array.isArray(cinco_porques)) upd.cinco_porques = cinco_porques;

    await DB.update("nao_conformidades", id, upd, tenantId);

    await registrarEventoNC(
      tenantId, id, "encerramento",
      `NC encerrada. Causa raiz: ${causa_raiz.trim().slice(0, 120)}${observacao ? ` — ${observacao}` : ""}`,
      { causa_raiz: causa_raiz.trim(), cinco_porques: cinco_porques || null, observacao: observacao || null },
      u
    );

    const atualizada = await DB.selectOne("nao_conformidades", { id }, tenantId);
    res.json({ ok: true, nc: atualizada, mensagem: "NC encerrada" });
  } catch (err) {
    console.error("❌ Erro ao encerrar NC:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;