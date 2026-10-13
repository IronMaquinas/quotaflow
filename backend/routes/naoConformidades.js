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
const { notificarFornecedorNC } = require('../services/NCService');

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

async function registrarEventoNC(tenantId, ncId, tipo, descricao, dados, usuario, opcoes = {}) {
  try {
    await DB.insert("nao_conformidade_eventos", {
      tenant_id: tenantId,
      nc_id: ncId,
      tipo,
      descricao,
      dados: dados || null,
      criado_por: usuario?.id || null,
      criado_por_nome: usuario?.nome || null,
      // M4.4-etapa-9: opções extras (compat: default é false/comprador)
      visivel_fornecedor: opcoes.visivel_fornecedor === true,
      autor_tipo: opcoes.autor_tipo || 'comprador',
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
    // M4.5: campos pra NC avulsa (abertura manual pela tela de NCs).
    // `item_nome_avulso` guarda o texto livre quando o operador não acha
    // o item no catálogo. `item_fora_catalogo` sinaliza pra Qualidade
    // que precisa fazer curadoria. `data_ocorrencia` registra quando o
    // problema aconteceu (≠ `criado_em`, que é quando a NC foi aberta).
    data_ocorrencia, item_nome_avulso,
    numero_nota_fiscal, lote, numero_serie, validade, unidade_medida,
    fornecedor_id,
    item_consumo_id,
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
      item_consumo_id: item_consumo_id || null,
      // M4.5: item avulso — operador não achou no catálogo, digitou texto
      // livre. `item_fora_catalogo` fica true pra Qualidade ver a pendência.
      item_nome_avulso: item_nome_avulso?.trim() || null,
      item_fora_catalogo: !item_catalogo_id && !!item_nome_avulso?.trim(),
      // M4.5: data da ocorrência (≠ criado_em). ISO quer saber QUANDO
      // aconteceu, não só quando foi registrado.
      data_ocorrencia: data_ocorrencia || null,
      // M4.5: campos de rastreabilidade que a criação manual pode trazer.
      numero_nota_fiscal: numero_nota_fiscal?.trim() || null,
      lote: lote?.trim() || null,
      numero_serie: numero_serie?.trim() || null,
      validade: validade || null,
      unidade_medida: unidade_medida?.trim() || null,
      quantidade: quantidade_afetada != null ? parseFloat(quantidade_afetada) : null,
      inspetor_id: u.id,
      criado_por_nome: u.nome,
      motivo_recusa: descricao_problema.trim(),
      fornecedor_id: fornecedorIdFinal,
      // M4.4-etapa-10d-fix: grava o nome do fornecedor junto (ajuda a
      // busca por texto na lista e evita fallback `#7` em modais).
      fornecedor_nome: fornecedorIdFinal
        ? (await DB.selectOne("fornecedores", { id: fornecedorIdFinal, tenant_id: tenantId }, tenantId))?.nome || null
        : null,
      fornecedor_tratativa_status: fornecedorIdFinal ? "nao_enviado" : null,
    }, tenantId);

    // Anexos (fotos como data URI). FIX M4-p: SEMPRE sobrescrever o
    // nome com padrão rastreável `<numeroNC>-evidencia-NN.ext` —
    // ignora o nome do cliente (ex: IMG_1234.jpg) pra manter padrão
    // de busca por NC no futuro.
    const anexosInseridos = [];
    if (Array.isArray(anexos) && anexos.length > 0) {
      for (let i = 0; i < anexos.length; i++) {
        const a = anexos[i];
        if (!a?.url) continue;
        const ext = (a.mime_type === 'image/png') ? 'png'
          : (a.mime_type === 'image/webp') ? 'webp'
          : (a.mime_type === 'application/pdf') ? 'pdf'
          : 'jpg';
        const nomePadrao = `${numeroNC}-evidencia-${String(i + 1).padStart(2, '0')}.${ext}`;
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

    // M4: marca o evento como visível pro fornecedor (se a NC tem FK).
    // Feito num UPDATE separado porque `registrarEventoNC` genérico não
    // passa esse campo. Best-effort — se falhar, não bloqueia.
    await registrarEventoNC(
      tenantId, nc.id, "criacao",
      `NC criada (origem: ${origemFinal}) — ${descricao_problema.trim().slice(0, 100)}`,
      { origem: origemFinal, anexos: anexosInseridos.length },
      u
    );

    if (fornecedorIdFinal) {
      try {
        const eventosRecentes = await DB.select("nao_conformidade_eventos",
          { nc_id: nc.id, tenant_id: tenantId }, tenantId);
        const eventoCriacao = eventosRecentes.find(ev => ev.tipo === "criacao");
        if (eventoCriacao) {
          await DB.update("nao_conformidade_eventos", eventoCriacao.id, {
            visivel_fornecedor: true,
            autor_tipo: "comprador",
          }, tenantId);
        }
      } catch (e) {
        console.warn("⚠ Falha ao marcar evento como visível:", e.message);
      }
    }

    // M4.4-etapa-10d-fix: notificação automática REMOVIDA daqui.
    //
    // Motivo: este bloco (a) montava HTML inline duplicando o email do
    // NCService, (b) setava `fornecedor_tratativa_status = 'notificado'`
    // — valor fora da whitelist STATUS_VISIVEIS_FORNECEDOR, então a NC
    // ficava invisível no portal do fornecedor até o gestor clicar em
    // "Notificar fornecedor". O único caminho de notificação agora é
    // via NCService (idempotente, usa NCEmailTemplates, seta 'enviado').

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

    // M4.5-fix: enriquece com nome/SKU do item vinculado ao catálogo.
    // Itens fora do catálogo usam `item_nome_avulso`/`item_sku_avulso`
    // (que já vêm direto do banco no `...nc`).
    // M4.5: enriquece com item — estoque tem prioridade (tem saldo).
    const itemConsumoIds = [...new Set(ncs.map(nc => nc.item_consumo_id).filter(Boolean))];
    const itemCatalogoIds = [...new Set(ncs.map(nc => nc.item_catalogo_id).filter(Boolean))];

    let estoquePorId = {};
    if (itemConsumoIds.length > 0) {
      const estoques = await DB.select("itens_consumo", { tenant_id: tenantId }, tenantId);
      estoques
        .filter(i => itemConsumoIds.includes(i.id))
        .forEach(i => { estoquePorId[i.id] = i; });
    }
    let catalogoPorId = {};
    if (itemCatalogoIds.length > 0) {
      const cats = await DB.select("catalogo_itens", { tenant_id: tenantId }, tenantId);
      cats
        .filter(c => itemCatalogoIds.includes(c.id))
        .forEach(c => { catalogoPorId[c.id] = c; });
    }

    ncs = ncs.map(nc => {
      let item_nome = null;
      let item_sku = null;
      if (nc.item_consumo_id && estoquePorId[nc.item_consumo_id]) {
        item_nome = estoquePorId[nc.item_consumo_id].nome;
        item_sku = estoquePorId[nc.item_consumo_id].sku;
      } else if (nc.item_catalogo_id && catalogoPorId[nc.item_catalogo_id]) {
        item_nome = catalogoPorId[nc.item_catalogo_id].nome;
        item_sku = catalogoPorId[nc.item_catalogo_id].codigo;
      }
      return {
        ...nc,
        chamado_numero: nc.chamado_id ? (chamadosPorId[nc.chamado_id]?.numero || null) : null,
        equipamento_nome: nc.equipamento_id ? (equipamentosPorId[nc.equipamento_id]?.nome || null) : null,
        equipamento_tag: nc.equipamento_id ? (equipamentosPorId[nc.equipamento_id]?.tag || null) : null,
        item_nome,
        item_sku,
      };
    });

    ncs.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
    res.json(ncs);
  } catch (err) {
    console.error("❌ Erro ao listar NCs:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/nao-conformidades/buscar-item?termo=X&limit=8
//
// M4.5: busca unificada de item pra NC. Une duas fontes:
//   1) itens_consumo (estoque do tenant) — ILIKE em nome/sku
//   2) catalogo_itens (via RPC buscar_itens_catalogo_tenant) — a mesma
//      RPC que a OS/RM/OC já usam
//
// Deduplica por catalogo_item_id: se o item está nas duas, fica só a
// versão de estoque (tem saldo_atual). Ícones definidos no front:
//   🏭 estoque puro (sem catálogo)
//   📦 estoque + catálogo
//   📖 só catálogo (fornecedor oferece, tenant nunca comprou)
// ─────────────────────────────────────────────────────────────────────────
router.get('/buscar-item', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const termo = (req.query.termo || '').trim();
  const limite = Math.min(parseInt(req.query.limit, 10) || 8, 20);

  if (termo.length < 2) {
    return res.json({ resultados: [] });
  }

  try {
    const termoLower = termo.toLowerCase();

    // Fonte 1: estoque do tenant
    const itensEstoque = await DB.select('itens_consumo', { tenant_id: tenantId }, tenantId);
    const estoqueFiltrado = (itensEstoque || [])
      .filter(i => i.ativo !== false)
      .filter(i =>
        (i.nome || '').toLowerCase().includes(termoLower)
        || (i.sku || '').toLowerCase().includes(termoLower)
      );

    // Fonte 2: catálogo (RPC que a OS usa)
    const { supabase } = require('../db');
    const { data: catalogoData, error: catErr } = await supabase.rpc('buscar_itens_catalogo_tenant', {
      p_tenant_id: tenantId,
      p_codigo: termo,
      p_nome: termo,
      p_descricao: '',
      p_limite: limite,
    });
    if (catErr) throw new Error(catErr.message);

    // M4.5: MERGE — 1 linha por item, não 1 linha por origem.
    // Um item pode existir nas duas fontes (estoque aponta pro catálogo
    // via catalogo_item_id). Nesse caso é UM item só — a linha carrega
    // os dois IDs, o usuário não escolhe origem.
    const idsCatalogoNoEstoque = new Set(
      estoqueFiltrado.map(i => i.catalogo_item_id).filter(Boolean)
    );

    const resultadosEstoque = estoqueFiltrado.map(i => ({
      item_consumo_id: i.id,
      catalogo_item_id: i.catalogo_item_id || null,
      nome: i.nome,
      sku: i.sku || null,
      saldo_atual: i.saldo_atual != null ? parseFloat(i.saldo_atual) : null,
      tem_estoque: true,
    }));

    const resultadosCatalogo = (catalogoData || [])
      .filter(c => !idsCatalogoNoEstoque.has(c.catalogo_item_id))
      .map(c => ({
        item_consumo_id: null,
        catalogo_item_id: c.catalogo_item_id,
        nome: c.nome,
        sku: c.codigo || null,
        saldo_atual: null,
        tem_estoque: false,
      }));

    // Ordena: quem tem estoque primeiro (é onde o usuário vai mais
    // provavelmente mexer), depois quem não tem.
    const resultados = [...resultadosEstoque, ...resultadosCatalogo].slice(0, limite);

    res.json({ resultados });
  } catch (err) {
    console.error('❌ Erro na busca de item (NC):', err.message);
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

    // M4.3-j: incluir email do fornecedor no payload — usado pelo modal
    // de confirmação de envio antes do usuário disparar o email.
    let fornecedor_email = null;
    let fornecedor_nome = nc.fornecedor_nome || null;
    if (nc.fornecedor_id) {
      try {
        const forn = await DB.selectOne("fornecedores", { id: nc.fornecedor_id, tenant_id: tenantId }, tenantId);
        fornecedor_email = forn?.email || null;
        // M4.4-etapa-10d-fix: enriquece nome do fornecedor. A coluna
        // `nc.fornecedor_nome` nem sempre está preenchida (a criação
        // não grava), então cai no valor da tabela `fornecedores`.
        fornecedor_nome = fornecedor_nome || forn?.nome || null;
      } catch (_) {}
    }

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

    // M4.5-fix: enriquece com nome e SKU do item quando vinculado ao
    // catálogo. `item_nome_avulso` (item fora do catálogo) já vem do
    // `...nc` — não precisa buscar. O front usa um dos dois.
    let item_nome = null;
    let item_sku = null;
    let item_saldo = null;

    // Prioridade: estoque primeiro (tem saldo real). Se não tiver estoque,
    // busca no catálogo.
    if (nc.item_consumo_id) {
      try {
        const ic = await DB.selectOne("itens_consumo", { id: nc.item_consumo_id, tenant_id: tenantId }, tenantId);
        item_nome = ic?.nome || null;
        item_sku = ic?.sku || null;
        item_saldo = ic?.saldo_atual != null ? parseFloat(ic.saldo_atual) : null;
      } catch (_) {}
    }
    if (!item_nome && nc.item_catalogo_id) {
      try {
        const cat = await DB.selectOne("catalogo_itens", { id: nc.item_catalogo_id, tenant_id: tenantId }, tenantId);
        item_nome = cat?.nome || null;
        item_sku = cat?.codigo || null;
      } catch (_) {}
    }

    // M4.5: enriquece anexos com signed URL do Storage (bucket privado
    // `nc-evidencias`). Anexos antigos gravados como data URI passam
    // inalterados — o helper `gerarSignedUrl` devolve o próprio data URI
    // nesse caso, então o front usa `signed_url` uniformemente.
    const { gerarSignedUrlsEmBatch } = require('../services/StorageNC');
    const pathsAnexos = (anexos || []).map(a => a.url).filter(Boolean);
    const mapaUrls = await gerarSignedUrlsEmBatch(pathsAnexos);
    const anexosEnriquecidos = (anexos || []).map(a => ({
      ...a,
      signed_url: mapaUrls[a.url] || null,
    }));

    // M4.5-fix: tenant estruturado pra rastreabilidade (PDF, relatórios,
    // emails). Fonte única de verdade — o frontend não lê de localStorage.
    let tenant_obj = null;
    try {
      const t = await DB.selectOne("tenants", { id: tenantId }, null);
      if (t) {
        tenant_obj = { nome: t.nome || null, cnpj: t.cnpj || null };
      }
    } catch (_) {}

    res.json({
      ...nc,
      anexos: anexosEnriquecidos, eventos, plano_acao: planoAcao,
      chamado_numero, equipamento_nome, equipamento_tag,
      fornecedor_email,
      fornecedor_nome,
      item_nome,
      item_sku,
      // M4.5: tenant estruturado + usuário (pra PDF).
      tenant: tenant_obj,
      gerado_por: nc.criado_por_nome || null,
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
  // M4.5: dois modos de entrada.
  //   (a) LEGADO: `url` = data URI (`data:image/...`). Anexos antigos,
  //       comportamento inalterado (grava base64 no banco).
  //   (b) NOVO: `base64` (sem prefixo) + `mime_type` → sobe pro Supabase
  //       Storage (bucket `nc-evidencias`) e grava o PATH no banco.
  // O front novo (ModalNovaNC) usa (b); o ModalDetalheNC atual segue
  // usando (a) até a migração M4.x.
  const { url, base64, nome_arquivo, mime_type, tamanho_bytes } = req.body;

  try {
    if (!url && !base64) {
      return res.status(400).json({ erro: "url (data URI) ou base64 é obrigatório" });
    }

    const nc = await DB.selectOne("nao_conformidades", { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: "NC não encontrada" });

    const anexosExistentes = await DB.select("nao_conformidade_anexos", { nc_id: id, tenant_id: tenantId }, tenantId);
    const seq = anexosExistentes.length + 1;
    const nomeFinal = nome_arquivo || `${nc.numero_nc}-evidencia-${String(seq).padStart(2, '0')}`;

    let urlFinal = url || null;
    let tamanhoFinal = tamanho_bytes != null ? parseInt(tamanho_bytes) : null;
    let mimeFinal = mime_type || null;

    // Modo NOVO: sobe pro Storage
    if (base64) {
      const { subirAnexoNC } = require('../services/StorageNC');
      const buffer = Buffer.from(base64, 'base64');
      const up = await subirAnexoNC({
        tenantId,
        ncId: Number(id),
        indice: seq,
        mimeType: mime_type || null,
        buffer,
        nomeOriginal: nome_arquivo || null,
      });
      urlFinal = up.path;              // path no bucket, não URL pública
      tamanhoFinal = up.tamanhoBytes;
      mimeFinal = up.mimeType;
    }

    const u = await usuarioAtual(req, tenantId);
    const anexo = await DB.insert("nao_conformidade_anexos", {
      tenant_id: tenantId,
      nc_id: id,
      url: urlFinal,
      nome_arquivo: nomeFinal,
      mime_type: mimeFinal,
      tamanho_bytes: tamanhoFinal,
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

    // M4.5: remove do Storage também. Best-effort — se falhar, o
    // registro no banco já foi apagado e o arquivo fica órfão (limpeza
    // de órfãos fica pra M4.x).
    const { removerAnexoNC } = require('../services/StorageNC');
    await removerAnexoNC(anexo.url);

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

// ─────────────────────────────────────────────────────────────────────────
// POST /api/nao-conformidades/:id/notificar-fornecedor
//
// Dispara o email de NC pro fornecedor (fluxo de aprovação — policy
// 'aprovacao'). Idempotente: se já foi notificado, retorna ok sem
// reenviar.
//
// Permissão: gestor, admin, ou comprador (o "receiver" em empresas
// pequenas muitas vezes é o próprio comprador com autoridade delegada).
// ─────────────────────────────────────────────────────────────────────────
router.post('/:id/notificar-fornecedor', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  try {
    const nc = await DB.selectOne('nao_conformidades', { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: 'NC não encontrada' });

    if (!nc.fornecedor_id) {
      return res.status(400).json({ erro: 'NC sem fornecedor vinculado — não há quem notificar' });
    }

    const perfil = await perfilDoUsuario(req, tenantId);
    const perfisPermitidos = ['gestor', 'admin', 'comprador'];
    if (!perfisPermitidos.includes(perfil)) {
      return res.status(403).json({
        erro: `Apenas ${perfisPermitidos.join(', ')} podem notificar o fornecedor (seu perfil: ${perfil || '—'})`
      });
    }

    const u = await usuarioAtual(req, tenantId);
    const resultado = await notificarFornecedorNC(id, tenantId, {
      origem: 'manual',
      userId: u.id,
      userNome: u.nome,
    });

    if (resultado.ja_notificado) {
      return res.json({ ok: true, ja_notificado: true, mensagem: 'Esta NC já foi notificada ao fornecedor anteriormente' });
    }

    res.json({
      ok: true,
      email: resultado.email,
      mensagem: `Fornecedor notificado por email (${resultado.email})`,
    });
  } catch (err) {
    console.error("❌ Erro ao notificar fornecedor:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// M4.2 — Ações do comprador sobre a tratativa do fornecedor.
//
// 3 endpoints, cada um disparado por um estado específico do fornecedor:
//   - /validar-resolucao-fornecedor: quando fornecedor marcou 'resolvida_fornecedor'
//   - /aceitar-contestacao:          quando fornecedor marcou 'contestada'
//   - /rejeitar-contestacao:         quando fornecedor marcou 'contestada'
// ─────────────────────────────────────────────────────────────────────────

// POST /api/nao-conformidades/:id/validar-resolucao-fornecedor
// Body: { observacao? }
router.post('/:id/validar-resolucao-fornecedor', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { observacao } = req.body;

  try {
    const nc = await DB.selectOne('nao_conformidades', { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: 'NC não encontrada' });
    if (nc.fornecedor_tratativa_status !== 'resolvida_fornecedor') {
      return res.status(400).json({
        erro: `NC não está aguardando validação de resolução (status atual: ${nc.fornecedor_tratativa_status || '—'})`
      });
    }

    const u = await usuarioAtual(req, tenantId);

    // M4.4-etapa-9g: limpa `fornecedor_tratativa_status` quando a NC
    // encerra. Sem isso, o chip "🎯 Resolvida (validar)" ficaria ao lado
    // do "✅ Resolvida" — dois estados contraditórios.
    await DB.update('nao_conformidades', id, {
      status: 'resolvida',
      fornecedor_tratativa_status: null,
      solucao_aplicada: observacao?.trim() || 'Resolução aceita do fornecedor',
      resolvida_em: new Date().toISOString(),
      resolvida_por: u.id,
      resolvida_por_nome: u.nome,
      encerrada_por: u.id,
      encerrada_por_nome: u.nome,
      encerrada_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    }, tenantId);

    await registrarEventoNC(
      tenantId, id, 'resolucao_fornecedor_aceita',
      `Resolução do fornecedor validada${observacao ? `: ${observacao}` : ''}`,
      { observacao: observacao || null },
      u
    );

    return res.json({ ok: true, mensagem: 'Resolução validada — NC encerrada' });
  } catch (err) {
    console.error('❌ Erro ao validar resolução do fornecedor:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

// POST /api/nao-conformidades/:id/aceitar-contestacao
// Body: { observacao? }
router.post('/:id/aceitar-contestacao', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { observacao } = req.body;

  try {
    const nc = await DB.selectOne('nao_conformidades', { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: 'NC não encontrada' });
    if (nc.fornecedor_tratativa_status !== 'contestada') {
      return res.status(400).json({
        erro: `NC não está com contestação pendente (status atual: ${nc.fornecedor_tratativa_status || '—'})`
      });
    }

    const u = await usuarioAtual(req, tenantId);
    const motivoFinal = `Contestação do fornecedor aceita${observacao ? `: ${observacao}` : ''}`;

    // M4.4-etapa-9g: limpa `fornecedor_tratativa_status` quando a NC
    // encerra (contestação aceita → NC cancelada).
    await DB.update('nao_conformidades', id, {
      status: 'cancelada',
      fornecedor_tratativa_status: null,
      motivo_cancelamento: motivoFinal,
      atualizado_em: new Date().toISOString(),
    }, tenantId);

    await registrarEventoNC(
      tenantId, id, 'contestacao_aceita',
      motivoFinal,
      { observacao: observacao || null },
      u
    );

    return res.json({ ok: true, mensagem: 'Contestação aceita — NC cancelada' });
  } catch (err) {
    console.error('❌ Erro ao aceitar contestação:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

// POST /api/nao-conformidades/:id/rejeitar-contestacao
// Body: { observacao (obrigatório) }
router.post('/:id/rejeitar-contestacao', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { observacao } = req.body;

  try {
    if (!observacao || !observacao.trim()) {
      return res.status(400).json({ erro: 'Justificativa é obrigatória ao rejeitar a contestação' });
    }

    const nc = await DB.selectOne('nao_conformidades', { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: 'NC não encontrada' });
    if (nc.fornecedor_tratativa_status !== 'contestada') {
      return res.status(400).json({
        erro: `NC não está com contestação pendente (status atual: ${nc.fornecedor_tratativa_status || '—'})`
      });
    }

    const u = await usuarioAtual(req, tenantId);

    await DB.update('nao_conformidades', id, {
      fornecedor_tratativa_status: 'enviado', // volta pro ciclo — comprador reassume
      atualizado_em: new Date().toISOString(),
    }, tenantId);

    await registrarEventoNC(
      tenantId, id, 'contestacao_rejeitada',
      `Contestação rejeitada pelo comprador: ${observacao.trim()}`,
      { observacao: observacao.trim() },
      u
    );

    return res.json({ ok: true, mensagem: 'Contestação rejeitada — NC segue em tratativa interna' });
  } catch (err) {
    console.error('❌ Erro ao rejeitar contestação:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/nao-conformidades/:id/devolver-fornecedor
//
// M4.4-etapa-9: comprador devolve a resolução/contestação pro fornecedor
// com motivo. Entra em loop — fornecedor revisa e reenvia.
// Body: { motivo (obrigatório) }
// ─────────────────────────────────────────────────────────────────────────
router.post('/:id/devolver-fornecedor', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { motivo } = req.body;

  try {
    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ erro: 'Motivo é obrigatório ao devolver para o fornecedor' });
    }

    const nc = await DB.selectOne('nao_conformidades', { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: 'NC não encontrada' });

    const statusDevolvivel = ['resolvida_fornecedor', 'contestada'];
    if (!statusDevolvivel.includes(nc.fornecedor_tratativa_status)) {
      return res.status(400).json({
        erro: `NC não está aguardando ação sua (status: ${nc.fornecedor_tratativa_status || '—'})`,
      });
    }

    const u = await usuarioAtual(req, tenantId);
    const rodadaAtual = Number(nc.rodada) || 1;

    // M4.4-etapa-10: guarda contra loop infinito (comprador ↔ fornecedor
    // devolvendo/reenviando). Após 5 rodadas, só resta validar ou cancelar
    // — o time humano precisa conversar fora do sistema.
    const RODADAS_MAX = 5;
    if (rodadaAtual >= RODADAS_MAX) {
      return res.status(400).json({
        erro: `Limite de ${RODADAS_MAX} devoluções atingido. Encaminhe para validação final ou cancelamento.`,
      });
    }

    await DB.update('nao_conformidades', id, {
      fornecedor_tratativa_status: 'devolvida',
      rodada: rodadaAtual + 1,
      tipo_resolucao: null,  // limpa pra próxima rodada
      // M4.4-etapa-10d-fix: ao devolver, o comprador JÁ agiu. A NC volta
      // ao estado 'aberta' porque a bola está com o fornecedor. Sem isso,
      // `status` fica preso em 'aguardando_validacao' e a tela do comprador
      // mostra dois chips conflitantes ("Aguardando validação" + "Devolvida").
      status: 'aberta',
      atualizado_em: new Date().toISOString(),
    }, tenantId);

    await registrarEventoNC(
      tenantId, id, 'devolucao_fornecedor',
      `Devolvido ao fornecedor (rodada ${rodadaAtual + 1}): ${motivo.trim()}`,
      { motivo: motivo.trim(), rodada: rodadaAtual + 1 },
      u,
      { visivel_fornecedor: true, autor_tipo: 'comprador' }
    );

    // M4.4-etapa-10c/d: notificar o fornecedor por email com contexto
    // completo (cliente, item, PN, quantidade, descrição).
    try {
      const fornecedor = nc.fornecedor_id
        ? await DB.selectOne('fornecedores', { id: nc.fornecedor_id, tenant_id: tenantId }, tenantId)
        : null;
      if (fornecedor?.email) {
        const { enviarEmailCotacao } = require('../services/emailService');
        const { corpoParaFornecedor } = require('../services/NCEmailTemplates');
        const ov = nc.ordem_venda_id
          ? await DB.selectOne('ordens_venda', { id: nc.ordem_venda_id, tenant_id: tenantId }, tenantId)
          : null;
        const tenant = await DB.selectOne('tenants', { id: nc.tenant_id }, null).catch(() => null);
        const itemConsumo = nc.item_catalogo_id
          ? await DB.selectOne('itens_consumo', { catalogo_item_id: nc.item_catalogo_id, tenant_id: tenantId }, tenantId)
          : null;
        const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
        const corpo = corpoParaFornecedor({
          nc, ov, fornecedor, tenant,
          itemNome: itemConsumo?.nome || null,
          sku: itemConsumo?.sku || null,
          acao: 'devolvida para revisão',
          motivo: motivo.trim(),
          linkPortal: `${baseUrl}/#portal`,
        });
        await enviarEmailCotacao(
          fornecedor.email,
          `${nc.numero_nc} — resolução devolvida para revisão`,
          corpo
        );
      }
    } catch (mailErr) {
      console.warn('⚠ Falha ao notificar fornecedor (devolução):', mailErr.message);
    }

    return res.json({ ok: true, mensagem: 'Devolvido ao fornecedor' });
  } catch (err) {
    console.error('❌ Erro ao devolver para fornecedor:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/nao-conformidades/:id/marcar-interna
//
// Triagem concluiu que a NC NÃO é problema do fornecedor (ex: dano de
// empilhadeira no recebimento). Zera `fornecedor_id` — a NC vira
// interna comum, com todo o histórico preservado.
//
// Diferente de cancelar: a NC continua ativa, segue o fluxo ISO 9001
// normal (direcionar área, plano de ação, etc). Só sai do radar do
// fornecedor.
//
// Body: { motivo } (opcional)
// ─────────────────────────────────────────────────────────────────────────
router.post('/:id/marcar-interna', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { motivo } = req.body || {};

  try {
    const nc = await DB.selectOne('nao_conformidades', { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: 'NC não encontrada' });

    if (!nc.fornecedor_id) {
      return res.status(400).json({ erro: 'NC já está marcada como interna' });
    }
    if (['resolvida', 'cancelada'].includes(nc.status)) {
      return res.status(400).json({ erro: 'NC já encerrada — não pode mais mudar escopo' });
    }

    const u = await usuarioAtual(req, tenantId);
    const fornecedorAnterior = nc.fornecedor_nome || `#${nc.fornecedor_id}`;

    await DB.update('nao_conformidades', id, {
      fornecedor_id: null,
      fornecedor_nome: null,
      fornecedor_tratativa_status: null,
      fornecedor_ciente_em: null,
      fornecedor_ciente_por_nome: null,
      atualizado_em: new Date().toISOString(),
    }, tenantId);

    await registrarEventoNC(
      tenantId, id, 'marcada_interna',
      `NC desvinculada do fornecedor ${fornecedorAnterior} — tratativa passa a ser interna${motivo ? `: ${motivo}` : ''}`,
      { fornecedor_anterior: fornecedorAnterior, motivo: motivo || null },
      u
    );

    return res.json({
      ok: true,
      mensagem: `NC agora é interna — fornecedor ${fornecedorAnterior} não tem mais acesso.`,
    });
  } catch (err) {
    console.error('❌ Erro ao marcar NC como interna:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/nao-conformidades/:id/vincular-item-catalogo
//
// M4.5: curadoria de item. A Qualidade revisa uma NC aberta com item
// fora do catálogo e vincula a um item real de `itens_consumo`.
//
// Body: { item_catalogo_id, observacao? }
// Efeito:
//   - Seta item_catalogo_id, limpa item_nome_avulso, zera item_fora_catalogo
//   - Registra evento `item_vinculado_catalogo` no histórico
//   - (Se o item já estava vinculado, atualiza só o id — permite trocar
//     caso o operador tenha vinculado errado)
// ─────────────────────────────────────────────────────────────────────────
router.post('/:id/vincular-item-catalogo', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { item_catalogo_id, observacao } = req.body || {};

  if (!item_catalogo_id) {
    return res.status(400).json({ erro: 'item_catalogo_id é obrigatório' });
  }

  try {
    const nc = await DB.selectOne('nao_conformidades', { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: 'NC não encontrada' });

    if (['resolvida', 'cancelada'].includes(nc.status)) {
      return res.status(400).json({ erro: 'NC já encerrada — não pode mais editar item' });
    }

    // Confirma que o item existe e é do tenant
    const item = await DB.selectOne('itens_consumo',
      { catalogo_item_id: item_catalogo_id, tenant_id: tenantId }, tenantId);
    if (!item) {
      return res.status(404).json({ erro: 'Item não encontrado no catálogo' });
    }

    const u = await usuarioAtual(req, tenantId);
    const descricaoAnterior = nc.item_nome_avulso || `#${nc.item_catalogo_id || '—'}`;
    const estavaFora = !!nc.item_fora_catalogo;

    await DB.update('nao_conformidades', id, {
      item_catalogo_id,
      item_nome_avulso: null,
      item_fora_catalogo: false,
      atualizado_em: new Date().toISOString(),
    }, tenantId);

    await registrarEventoNC(
      tenantId, id, 'item_vinculado_catalogo',
      `Item vinculado ao catálogo por ${u.nome}: "${descricaoAnterior}" → "${item.nome}"${estavaFora ? ' (curadoria de item fora do catálogo)' : ''}${observacao ? ` — ${observacao}` : ''}`,
      {
        item_catalogo_id,
        item_nome: item.nome,
        descricao_anterior: descricaoAnterior,
        estava_fora_catalogo: estavaFora,
        observacao: observacao || null,
      },
      u
    );

    return res.json({ ok: true, item: { id: item.catalogo_item_id, nome: item.nome } });
  } catch (err) {
    console.error('❌ Erro ao vincular item ao catálogo:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/nao-conformidades/:id/vincular-item
//
// M4.5: vínculo unificado — aceita item_consumo_id E/OU catalogo_item_id.
// Substitui /vincular-item-catalogo (que só aceitava catálogo).
// Body: { item_consumo_id?, catalogo_item_id? } — pelo menos 1.
// ─────────────────────────────────────────────────────────────────────────
router.post('/:id/vincular-item', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  // M4.5-fix: o campo se chama `item_catalogo_id` (mesmo nome da coluna
  // na tabela e do payload de criação). Antes estava `catalogo_item_id`
  // por engano — o front manda `item_catalogo_id` e o backend lia null.
  const { item_consumo_id, item_catalogo_id } = req.body || {};

  if (!item_consumo_id && !item_catalogo_id) {
    return res.status(400).json({ erro: 'item_consumo_id ou item_catalogo_id é obrigatório' });
  }

  try {
    const nc = await DB.selectOne('nao_conformidades', { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: 'NC não encontrada' });

    if (['resolvida', 'cancelada'].includes(nc.status)) {
      return res.status(400).json({ erro: 'NC já encerrada — não pode mais editar item' });
    }

    // Valida existência dos dois, quando vierem
    let nomeFinal = null;
    let skuFinal = null;

    if (item_consumo_id) {
      const ic = await DB.selectOne('itens_consumo', { id: item_consumo_id, tenant_id: tenantId }, tenantId);
      if (!ic) return res.status(404).json({ erro: 'Item de estoque não encontrado' });
      nomeFinal = ic.nome;
      skuFinal = ic.sku;
    }
    if (item_catalogo_id) {
      const cat = await DB.selectOne('catalogo_itens', { id: item_catalogo_id, tenant_id: tenantId }, tenantId);
      if (!cat) return res.status(404).json({ erro: 'Item do catálogo não encontrado' });
      if (!nomeFinal) {
        nomeFinal = cat.nome;
        skuFinal = cat.codigo;
      }
    }

    const u = await usuarioAtual(req, tenantId);

    await DB.update('nao_conformidades', id, {
      item_consumo_id: item_consumo_id || null,
      item_catalogo_id: item_catalogo_id || null,
      item_nome_avulso: null,
      item_sku_avulso: null,
      item_fora_catalogo: false,
      atualizado_em: new Date().toISOString(),
    }, tenantId);

    await registrarEventoNC(
      tenantId, id, 'item_vinculado',
      `Item vinculado por ${u.nome}: "${nomeFinal}"${skuFinal ? ` (${skuFinal})` : ''}`,
      { item_consumo_id: item_consumo_id || null, item_catalogo_id: item_catalogo_id || null },
      u
    );

    return res.json({ ok: true, item: { nome: nomeFinal, sku: skuFinal } });
  } catch (err) {
    console.error('❌ Erro ao vincular item:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/nao-conformidades/:id/editar-item-avulso
//
// M4.5-fix: curadoria de item avulso. A Qualidade revisa uma NC com item
// fora do catálogo e edita o nome/part number em texto livre — sem
// vincular ao catálogo (isso continua sendo o /vincular-item-catalogo).
//
// Body: { item_nome_avulso (obrigatório), item_sku_avulso (opcional) }
// Efeito:
//   - Seta item_nome_avulso, item_sku_avulso, marca item_fora_catalogo=true
//   - Zera item_catalogo_id (garante que não fica órfão apontando pro nada)
//   - Registra evento `item_editado_avulso` no histórico
//
// Permissão: qualidade, admin, gestor.
// ─────────────────────────────────────────────────────────────────────────
router.post('/:id/editar-item-avulso', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { item_nome_avulso, item_sku_avulso } = req.body || {};

  if (!item_nome_avulso || !item_nome_avulso.trim()) {
    return res.status(400).json({ erro: 'item_nome_avulso é obrigatório' });
  }

  try {
    const nc = await DB.selectOne('nao_conformidades', { id, tenant_id: tenantId }, tenantId);
    if (!nc) return res.status(404).json({ erro: 'NC não encontrada' });

    if (['resolvida', 'cancelada'].includes(nc.status)) {
      return res.status(400).json({ erro: 'NC já encerrada — não pode mais editar item' });
    }

    const perfil = await perfilDoUsuario(req, tenantId);
    const perfisPermitidos = ['qualidade', 'admin', 'gestor'];
    if (!perfisPermitidos.includes(perfil)) {
      return res.status(403).json({
        erro: `Apenas ${perfisPermitidos.join(', ')} podem editar o item (seu perfil: ${perfil || '—'})`
      });
    }

    const u = await usuarioAtual(req, tenantId);
    const nomeAnterior = nc.item_nome_avulso
      || (nc.item_catalogo_id ? `#${nc.item_catalogo_id}` : '—');

    await DB.update('nao_conformidades', id, {
      item_catalogo_id: null,
      item_nome_avulso: item_nome_avulso.trim(),
      item_sku_avulso: item_sku_avulso?.trim() || null,
      item_fora_catalogo: true,
      atualizado_em: new Date().toISOString(),
    }, tenantId);

    await registrarEventoNC(
      tenantId, id, 'item_editado_avulso',
      `Item editado por ${u.nome}: "${nomeAnterior}" → "${item_nome_avulso.trim()}"${item_sku_avulso?.trim() ? ` (PN: ${item_sku_avulso.trim()})` : ''}`,
      {
        nome_anterior: nomeAnterior,
        nome_novo: item_nome_avulso.trim(),
        sku_novo: item_sku_avulso?.trim() || null,
      },
      u
    );

    return res.json({
      ok: true,
      item: { nome: item_nome_avulso.trim(), sku: item_sku_avulso?.trim() || null },
    });
  } catch (err) {
    console.error('❌ Erro ao editar item avulso:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

module.exports = router;