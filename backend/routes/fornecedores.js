// backend/routes/fornecedores.js
//
// Cadastro de fornecedores do lado do TENANT (comprador).
//
// Regras (ver doc do projeto "regras-acesso-fornecedores-e-spot.md"):
// - O tenant vê os fornecedores que ele cadastrou (tipo 'local', tenant_id = dele)
//   + os fornecedores GLOBAIS da plataforma (tipo 'global').
// - Fornecedor global é mantido pela plataforma/pelo próprio fornecedor: o tenant
//   NÃO edita nem exclui. Ele só pode "desativar para mim" — isso fica gravado no
//   vínculo tenant_fornecedores, sem afetar os outros tenants.
// - Um tenant nunca vê nem altera fornecedor local de outro tenant.
//
// Compatibilidade: a listagem identifica global pelo campo `tipo`, não pelo
// tenant_id. Assim funciona tanto ANTES quanto DEPOIS de o tenant_id dos globais
// ser zerado — o Global Peças não some em nenhum momento da transição.
//
// Limitações conhecidas do db.js (documentadas no projeto) que este arquivo
// contorna de propósito: DB.select ignora filtro com valor null (não gera IS NULL),
// não aceita array como filtro (IN) e DB.raw só entende alguns padrões fixos.

const express = require("express");
const router = express.Router();
const { DB } = require("../db");
const tenantMiddleware = require("../middleware/tenantMiddleware");
const { normalizarAtuacao, CAMPOS_ATUACAO } = require("../services/atuacao"); // perfil de atuação (etapa 4)
const {
  convidar, convidarNovo, listarConvitesNovos, cancelarConviteNovo, situacaoPortal, temLoginNoPortal,
} = require("../services/convitesFornecedor"); // convites (etapas 10 e 10b)

// ─── Helpers ─────────────────────────────────────────────────────────────

// contatos/categorias/dados_cnpj são jsonb, mas historicamente foram gravados com
// JSON.stringify (ficam como string dentro do jsonb). Aceita os dois formatos.
function lerJson(valor, padrao) {
  if (valor === null || valor === undefined || valor === "") return padrao;
  if (typeof valor !== "string") return valor;
  try {
    return JSON.parse(valor);
  } catch {
    return padrao;
  }
}

const mesmoId = (a, b) => String(a) === String(b);
const ehGlobal = (f) => f && f.tipo === "global";

function formatar(f, extras = {}) {
  // Campos internos do fornecedor que o tenant nunca recebe
  // (descadastro_token desligaria os e-mails dele; preferência é dele)
  const { descadastro_token, recomendacoes_email, ...semInternos } = f || {};
  return {
    ...semInternos,
    contatos: lerJson(f.contatos, []),
    categorias: lerJson(f.categorias, []),
    dados_cnpj: lerJson(f.dados_cnpj, null),
    ...extras,
  };
}

// Global: dados públicos de cadastro + o "ativo" é o do vínculo deste tenant.
// Campos internos do fornecedor (obs, dados de CNPJ) não vão para o tenant.
function formatarGlobal(f, vinculo) {
  const { obs, dados_cnpj, situacao_cnpj, ultima_consulta_cnpj, ...publico } = f;
  return formatar(publico, {
    tenant_id: null,
    ativo: vinculo ? (vinculo.ativo ? 1 : 0) : 1, // sem vínculo = ativo por padrão
    preferido: vinculo ? !!vinculo.preferido : false,
    editavel: false,
  });
}

// Busca um fornecedor que o tenant pode ENXERGAR (local dele ou global).
// Retorna { fornecedor, global } ou null.
async function buscarVisivel(id, tenantId) {
  const f = await DB.selectOne("fornecedores", { id });
  if (!f) return null;
  if (ehGlobal(f)) return { fornecedor: f, global: true };
  if (mesmoId(f.tenant_id, tenantId)) return { fornecedor: f, global: false };
  return null; // local de outro tenant: para este tenant, não existe
}

async function vinculoDe(tenantId, fornecedorId) {
  const lista = await DB.select("tenant_fornecedores", { tenant_id: tenantId, fornecedor_id: fornecedorId });
  return lista && lista.length ? lista[0] : null;
}

// Cria ou atualiza o vínculo tenant ↔ fornecedor (usado para "desativar para mim").
async function salvarVinculo(tenantId, fornecedorId, dados) {
  const atual = await vinculoDe(tenantId, fornecedorId);
  const agora = new Date().toISOString();
  if (atual) {
    return DB.update("tenant_fornecedores", atual.id, { ...dados, atualizado_em: agora });
  }
  return DB.insert("tenant_fornecedores", {
    tenant_id: tenantId,
    fornecedor_id: fornecedorId,
    ativo: true,
    preferido: false,
    ...dados,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// GET /api/fornecedores - Fornecedores do tenant + globais
// ─────────────────────────────────────────────────────────────────────────

router.get("/", tenantMiddleware, async (req, res) => {
  try {
    const [doTenant, globais, vinculos] = await Promise.all([
      DB.select("fornecedores", {}, req.tenantId),
      DB.select("fornecedores", { tipo: "global" }),
      DB.select("tenant_fornecedores", { tenant_id: req.tenantId }),
    ]);

    const vinculoPorFornecedor = {};
    for (const v of vinculos || []) vinculoPorFornecedor[String(v.fornecedor_id)] = v;

    // Locais do tenant (exclui globais que ainda estejam com o tenant_id dele)
    const locaisBrutos = (doTenant || []).filter((f) => !ehGlobal(f));
    // Etapa 10: local que já tem login no portal administra os próprios dados
    const portal = await situacaoPortal(req.tenantId, locaisBrutos.map((f) => f.id));
    const locais = locaisBrutos.map((f) => {
      const p = portal[String(f.id)] || {};
      return formatar(f, {
        editavel: !p.portal_ativo,
        portal_ativo: !!p.portal_ativo,
        convite_pendente_ate: p.convite_pendente_ate || null,
        convite_email: p.convite_email || null,
      });
    });

    const listaGlobais = (globais || []).map((f) => formatarGlobal(f, vinculoPorFornecedor[String(f.id)]));

    // Globais primeiro, depois locais, cada grupo em ordem alfabética
    const porNome = (a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    res.json([...listaGlobais.sort(porNome), ...locais.sort(porNome)]);
  } catch (err) {
    console.error("❌ Erro ao listar fornecedores:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Alertas de CNPJ — declarados ANTES de "/:id" por clareza.
// Reescritos sem DB.raw: o JOIN e o UPDATE caíam no fallback genérico do raw()
// (nome do fornecedor nunca vinha, e "marcar como lido" não gravava nada).
// ─────────────────────────────────────────────────────────────────────────

router.get("/alertas/cnpj", tenantMiddleware, async (req, res) => {
  try {
    const alertas = await DB.select("cnpj_alertas", {}, req.tenantId);
    const ids = new Set((alertas || []).map((a) => String(a.fornecedor_id)));

    const nomes = {};
    if (ids.size) {
      const [doTenant, globais] = await Promise.all([
        DB.select("fornecedores", {}, req.tenantId),
        DB.select("fornecedores", { tipo: "global" }),
      ]);
      for (const f of [...(doTenant || []), ...(globais || [])]) {
        if (ids.has(String(f.id))) nomes[String(f.id)] = f.nome_fantasia || f.nome;
      }
    }

    const resultado = (alertas || [])
      .map((a) => ({
        id: a.id,
        fornecedor_id: a.fornecedor_id,
        situacao_anterior: a.situacao_anterior,
        situacao_nova: a.situacao_nova,
        detectado_em: a.detectado_em,
        lido: a.lido,
        fornecedor_nome: nomes[String(a.fornecedor_id)] || null,
      }))
      .sort((a, b) => new Date(b.detectado_em || 0) - new Date(a.detectado_em || 0));

    res.json(resultado);
  } catch (err) {
    console.error("❌ Erro ao listar alertas:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

const marcarAlertaLido = async (req, res) => {
  try {
    const alerta = await DB.selectOne("cnpj_alertas", { id: req.params.id }, req.tenantId);
    if (!alerta) return res.status(404).json({ erro: "Alerta não encontrado" });
    await DB.update("cnpj_alertas", alerta.id, { lido: 1 }, req.tenantId);
    res.json({ ok: true, mensagem: "Alerta marcado como lido" });
  } catch (err) {
    console.error("❌ Erro ao atualizar alerta:", err.message);
    res.status(500).json({ erro: err.message });
  }
};
// O GET usa "/alertas/cnpj" e o PUT antigo usava "/alertas-cnpj/..." — aceita os dois.
router.put("/alertas/cnpj/:id/ler", tenantMiddleware, marcarAlertaLido);
router.put("/alertas-cnpj/:id/ler", tenantMiddleware, marcarAlertaLido);


// ─────────────────────────────────────────────────────────────────────────
// Convite a fornecedor NOVO, que ainda não está no cadastro (etapa 10b)
//   POST   /api/fornecedores/convidar-novo   { cnpj, email, nome? }  (CNPJ obrigatório — etapa 10c)
//   GET    /api/fornecedores/convites        → convites ainda não concluídos
//   DELETE /api/fornecedores/convites/:id    → cancela
// (declaradas antes de "/:id" para o Express não confundir "convites" com um id)
// ─────────────────────────────────────────────────────────────────────────

router.post("/convidar-novo", tenantMiddleware, async (req, res) => {
  try {
    const r = await convidarNovo({
      tenantId: req.tenantId,
      cnpj: req.body?.cnpj,
      email: req.body?.email,
      nome: req.body?.nome,
      criadoPor: req.userId,
    });
    if (r.erro) return res.status(r.status || 400).json({ erro: r.erro });
    res.json({
      ok: true, expira_em: r.expira_em, email: r.email, empresa: r.empresa || null,
      mensagem: `Convite enviado para ${r.email}${r.empresa ? ` (${r.empresa})` : ""}`,
    });
  } catch (err) {
    console.error("❌ Erro ao convidar fornecedor novo:", err.message || err);
    res.status(500).json({ erro: err.message || "Erro ao enviar convite" });
  }
});

router.get("/convites", tenantMiddleware, async (req, res) => {
  try {
    res.json(await listarConvitesNovos(req.tenantId));
  } catch (err) {
    console.error("❌ Erro ao listar convites:", err.message || err);
    res.status(500).json({ erro: err.message || "Erro ao listar convites" });
  }
});

router.delete("/convites/:conviteId", tenantMiddleware, async (req, res) => {
  try {
    const r = await cancelarConviteNovo(req.tenantId, req.params.conviteId);
    if (r.erro) return res.status(r.status || 400).json({ erro: r.erro });
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Erro ao cancelar convite:", err.message || err);
    res.status(500).json({ erro: err.message || "Erro ao cancelar convite" });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/fornecedores/:id
// ─────────────────────────────────────────────────────────────────────────

router.get("/:id", tenantMiddleware, async (req, res) => {
  try {
    const achado = await buscarVisivel(req.params.id, req.tenantId);
    if (!achado) return res.status(404).json({ erro: "Fornecedor não encontrado" });

    if (achado.global) {
      const vinculo = await vinculoDe(req.tenantId, achado.fornecedor.id);
      return res.json(formatarGlobal(achado.fornecedor, vinculo));
    }
    const p = (await situacaoPortal(req.tenantId, [achado.fornecedor.id]))[String(achado.fornecedor.id)] || {};
    res.json(formatar(achado.fornecedor, {
      editavel: !p.portal_ativo,
      portal_ativo: !!p.portal_ativo,
      convite_pendente_ate: p.convite_pendente_ate || null,
      convite_email: p.convite_email || null,
    }));
  } catch (err) {
    console.error("❌ Erro ao buscar fornecedor:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/fornecedores - Criar fornecedor LOCAL do tenant
// ─────────────────────────────────────────────────────────────────────────

router.post("/", tenantMiddleware, async (req, res) => {
  try {
    const {
      nome, razao_social, cnpj, endereco, numero, complemento, bairro,
      cidade, estado, cep, contatos, categorias, obs, latitude, longitude, email,
    } = req.body;

    if (!nome) {
      return res.status(400).json({ erro: "Nome é obrigatório" });
    }

    const cnpjLimpo = cnpj ? String(cnpj).replace(/\D/g, "") : null;

    if (cnpjLimpo) {
      // Já é fornecedor global? Então já está na lista do tenant — não duplica.
      const global = await DB.selectOne("fornecedores", { cnpj: cnpjLimpo, tipo: "global" });
      if (global) {
        return res.status(409).json({
          erro: `Este CNPJ já pertence a um fornecedor da rede global (${global.nome_fantasia || global.nome}). Ele já aparece na sua lista de fornecedores.`,
          fornecedorExistente: global.id,
          global: true,
        });
      }
      // Já cadastrado por este mesmo tenant?
      const doTenant = await DB.selectOne("fornecedores", { cnpj: cnpjLimpo }, req.tenantId);
      if (doTenant) {
        return res.status(409).json({ erro: "CNPJ já cadastrado", fornecedorExistente: doTenant.id });
      }
    }

    const fornecedor = await DB.insert("fornecedores", {
      nome,
      razao_social: razao_social || null,
      cnpj: cnpjLimpo,
      endereco: endereco || null,
      numero: numero || null,
      complemento: complemento || null,
      bairro: bairro || null,
      cidade: cidade || null,
      estado: estado || null,
      cep: cep || null,
      contatos: contatos ? JSON.stringify(contatos) : null,
      categorias: categorias ? JSON.stringify(categorias) : null,
      obs: obs || null,
      latitude: latitude || null,
      longitude: longitude || null,
      email: email || null,
      ...(await normalizarAtuacao(DB, req.body, { tenantId: req.tenantId })),
      tipo: "local", // tenant nunca cria global — global é cadastrado pela plataforma
      ativo: 1,
    }, req.tenantId);

    res.status(201).json(formatar(fornecedor, { editavel: true }));
  } catch (err) {
    console.error("❌ Erro ao criar fornecedor:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUT /api/fornecedores/:id
//   Local do tenant  → atualiza o cadastro.
//   Global           → só aceita { ativo } (e { preferido }), gravados no vínculo.
// ─────────────────────────────────────────────────────────────────────────

const CAMPOS_EDITAVEIS = [
  "nome", "razao_social", "cnpj", "endereco", "numero", "complemento", "bairro",
  "cidade", "estado", "cep", "contatos", "categorias", "obs", "latitude", "longitude", "email",
];

router.put("/:id", tenantMiddleware, async (req, res) => {
  try {
    const achado = await buscarVisivel(req.params.id, req.tenantId);
    if (!achado) return res.status(404).json({ erro: "Fornecedor não encontrado" });

    const body = req.body || {};

    // ── Global: só preferências do próprio tenant ──
    if (achado.global) {
      const tentouEditarCadastro = [...CAMPOS_EDITAVEIS, ...CAMPOS_ATUACAO, "marca_sugerida"]
        .some((c) => body[c] !== undefined);
      if (tentouEditarCadastro) {
        return res.status(403).json({
          erro: "Fornecedor global: os dados cadastrais são mantidos pela plataforma. Você pode apenas ativá-lo ou desativá-lo para a sua empresa.",
        });
      }
      const dadosVinculo = {};
      if (body.ativo !== undefined) dadosVinculo.ativo = !!body.ativo;
      if (body.preferido !== undefined) dadosVinculo.preferido = !!body.preferido;
      if (Object.keys(dadosVinculo).length) {
        await salvarVinculo(req.tenantId, achado.fornecedor.id, dadosVinculo);
      }
      const vinculo = await vinculoDe(req.tenantId, achado.fornecedor.id);
      return res.json(formatarGlobal(achado.fornecedor, vinculo));
    }

    // ── Local do tenant ──
    const { id } = achado.fornecedor;

    // Etapa 10: local que aceitou o convite é dono dos próprios dados
    if (await temLoginNoPortal(id)) {
      const tentouEditarCadastro = [...CAMPOS_EDITAVEIS, ...CAMPOS_ATUACAO, "marca_sugerida"]
        .some((c) => body[c] !== undefined);
      if (tentouEditarCadastro) {
        return res.status(403).json({
          erro: "Este fornecedor já está no portal e mantém os próprios dados. Você pode apenas ativá-lo ou desativá-lo.",
        });
      }
    }

    if (body.cnpj) {
      const cnpjLimpo = String(body.cnpj).replace(/\D/g, "");
      const global = await DB.selectOne("fornecedores", { cnpj: cnpjLimpo, tipo: "global" });
      if (global) {
        return res.status(409).json({
          erro: `Este CNPJ já pertence a um fornecedor da rede global (${global.nome_fantasia || global.nome}).`,
          fornecedorExistente: global.id,
          global: true,
        });
      }
      const jaExiste = await DB.selectOne("fornecedores", { cnpj: cnpjLimpo }, req.tenantId);
      if (jaExiste && !mesmoId(jaExiste.id, id)) {
        return res.status(409).json({ erro: "CNPJ já cadastrado por outro fornecedor", fornecedorExistente: jaExiste.id });
      }
    }

    const updateData = {};
    for (const campo of CAMPOS_EDITAVEIS) {
      if (body[campo] === undefined) continue;
      if (campo === "cnpj") updateData.cnpj = body.cnpj ? String(body.cnpj).replace(/\D/g, "") : null;
      else if (campo === "contatos" || campo === "categorias") updateData[campo] = JSON.stringify(body[campo]);
      else updateData[campo] = body[campo];
    }
    Object.assign(updateData, await normalizarAtuacao(DB, body, { tenantId: req.tenantId }));
    if (body.ativo !== undefined) updateData.ativo = body.ativo ? 1 : 0;
    // `tipo` e `tenant_id` nunca são alterados por esta rota.

    const updated = Object.keys(updateData).length
      ? await DB.update("fornecedores", id, updateData, req.tenantId)
      : achado.fornecedor;

    res.json(formatar(updated, { editavel: true }));
  } catch (err) {
    console.error("❌ Erro ao atualizar fornecedor:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// DELETE /api/fornecedores/:id - só fornecedor LOCAL do próprio tenant
// ─────────────────────────────────────────────────────────────────────────

router.delete("/:id", tenantMiddleware, async (req, res) => {
  try {
    const achado = await buscarVisivel(req.params.id, req.tenantId);
    if (!achado) return res.status(404).json({ erro: "Fornecedor não encontrado" });

    if (achado.global) {
      return res.status(403).json({
        erro: "Fornecedor global não pode ser excluído. Você pode desativá-lo para a sua empresa.",
      });
    }

    if (await temLoginNoPortal(achado.fornecedor.id)) {
      return res.status(409).json({
        erro: "Este fornecedor já tem acesso ao portal e não pode ser excluído. Você pode desativá-lo.",
      });
    }

    await DB.delete("fornecedores", achado.fornecedor.id, req.tenantId);
    res.json({ ok: true, mensagem: "Fornecedor deletado" });
  } catch (err) {
    console.error("❌ Erro ao deletar fornecedor:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/fornecedores/:id/convidar — convite ao fornecedor LOCAL (etapa 10)
// Body opcional: { email } (padrão: e-mail do cadastro)
// ─────────────────────────────────────────────────────────────────────────

router.post("/:id/convidar", tenantMiddleware, async (req, res) => {
  try {
    const r = await convidar({
      tenantId: req.tenantId,
      fornecedorId: req.params.id,
      email: req.body?.email,
      criadoPor: req.userId,
    });
    if (r.erro) return res.status(r.status || 400).json({ erro: r.erro });
    res.json({ ok: true, expira_em: r.expira_em, email: r.email, mensagem: `Convite enviado para ${r.email}` });
  } catch (err) {
    console.error("❌ Erro ao convidar fornecedor:", err.message || err);
    res.status(500).json({ erro: err.message || "Erro ao enviar convite" });
  }
});

module.exports = router;
