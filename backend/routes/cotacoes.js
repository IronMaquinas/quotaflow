// routes/cotacoes.js
const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const { DB } = require("../db");
const tenantMiddleware = require("../middleware/tenantMiddleware");
const { enviarEmailCotacao, enviarEmailResultado } = require("../services/emailService");
const CotacaoService = require('../services/CotacaoService');
const cotacaoService = new CotacaoService(DB);

// ─── HELPERS ───────────────────────────────────────────────

async function gerarNumeroChamado(tenant_id) {
  const ano = new Date().getFullYear();
  const prefix = `RC-${ano}-`;

  // Buscar o maior número usando id DESC
  const result = await DB.raw(`
    SELECT numero FROM chamados
    WHERE tenant_id = $1 AND numero LIKE $2
    ORDER BY id DESC
    LIMIT 1
  `, [tenant_id, `${prefix}%`]);

  let seq = 1;
  if (result.length > 0 && result[0].numero) {
    const match = result[0].numero.match(/(\d+)$/);
    if (match) {
      seq = parseInt(match[1]) + 1;
    }
  }

  let novoNumero = `${prefix}${String(seq).padStart(4, "0")}`;

  // Verificar se existe usando selectOne (mais confiável)
  let existe = await DB.selectOne("chamados", { numero: novoNumero }, tenant_id);
  if (existe) {
    // Se existir, incrementa até achar um livre (mas limitado a 100 tentativas)
    let tentativas = 0;
    while (existe && tentativas < 100) {
      seq++;
      novoNumero = `${prefix}${String(seq).padStart(4, "0")}`;
      existe = await DB.selectOne("chamados", { numero: novoNumero }, tenant_id);
      tentativas++;
    }
  }

  return novoNumero;
}

async function gerarNumeroOS(tenant_id) {
  const ano = new Date().getFullYear();
  const prefix = `OS-${ano}-`;

  const result = await DB.raw(`
    SELECT numero FROM chamados
    WHERE tenant_id = $1 AND numero LIKE $2
    ORDER BY id DESC
    LIMIT 1
  `, [tenant_id, `${prefix}%`]);

  let seq = 1;
  if (result.length > 0 && result[0].numero) {
    const match = result[0].numero.match(/(\d+)$/);
    if (match) {
      seq = parseInt(match[1]) + 1;
    }
  }

  let novoNumero = `${prefix}${String(seq).padStart(4, "0")}`;

  let existe = await DB.selectOne("chamados", { numero: novoNumero }, tenant_id);
  let tentativas = 0;
  while (existe && tentativas < 100) {
    seq++;
    novoNumero = `${prefix}${String(seq).padStart(4, "0")}`;
    existe = await DB.selectOne("chamados", { numero: novoNumero }, tenant_id);
    tentativas++;
  }

  return novoNumero;
}

async function gerarNumeroCotacao(tenant_id) {
  const ano = new Date().getFullYear();
  const prefix = `COT-${ano}-`;

  const result = await DB.raw(`
    SELECT numero FROM cotacoes
    WHERE tenant_id = $1 AND numero LIKE $2
    ORDER BY numero DESC
    LIMIT 1
  `, [tenant_id, `${prefix}%`]);

  let seq = 1;
  if (result.length > 0 && result[0].numero) {
    const match = result[0].numero.match(/(\d+)$/);
    if (match) {
      seq = parseInt(match[1]) + 1;
    }
  }

  let novoNumero = `${prefix}${String(seq).padStart(4, "0")}`;
  let existe = true;
  let tentativas = 0;
  while (existe && tentativas < 100) {
    const check = await DB.raw(`
      SELECT id FROM cotacoes WHERE tenant_id = $1 AND numero = $2
    `, [tenant_id, novoNumero]);
    if (check.length === 0) {
      existe = false;
    } else {
      seq++;
      novoNumero = `${prefix}${String(seq).padStart(4, "0")}`;
      tentativas++;
    }
  }

  return novoNumero;
}

async function gerarNumeroRM(tenant_id) {
  const ano = new Date().getFullYear();
  const prefix = `RC-${ano}-`;

  const todasRM = await DB.select(
    "chamados",
    { tenant_id, tipo_documento: "requisicao_material" },
    tenant_id
  );

  let maiorSeq = 0;
  todasRM.forEach((rm) => {
    if (rm.numero && rm.numero.startsWith(prefix)) {
      const match = rm.numero.match(/(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maiorSeq) maiorSeq = n;
      }
    }
  });

  let seq = maiorSeq + 1;
  let novoNumero = `${prefix}${String(seq).padStart(4, "0")}`;

  // Rede de segurança contra corrida (duas requisições simultâneas
  // calculando o mesmo "próximo número" antes de qualquer uma commitar).
  let existe = await DB.selectOne("chamados", { numero: novoNumero }, tenant_id);
  let tentativas = 0;
  while (existe && tentativas < 100) {
    seq++;
    novoNumero = `${prefix}${String(seq).padStart(4, "0")}`;
    existe = await DB.selectOne("chamados", { numero: novoNumero }, tenant_id);
    tentativas++;
  }

  return novoNumero;
}

// ─────────────────────────────────────────────────────────────────────────
// gerarNumeroRET — mesma lógica de RET-{ano}-000X que já existe em
// routes/estoque/solicitacoes.js (POST /), extraída aqui porque o split
// automático da OS agora também precisa criar RET diretamente, sem passar
// pelo endpoint HTTP daquele arquivo (evita round-trip interno e mantém a
// criação do cabeçalho + item filho atômica dentro da mesma transação de
// salvar a OS). NÃO mexe no gerador original de solicitacoes.js — os dois
// convivem, cada request de retirada (manual ou auto-gerada) recalcula o
// próximo número livre do tenant.
// ─────────────────────────────────────────────────────────────────────────
async function gerarNumeroRET(tenant_id) {
  const ultimas = await DB.select("solicitacoes_retirada", { tenant_id }, tenant_id);
  let ultimaSequencia = 0;
  ultimas.forEach((s) => {
    if (s.numero_solicitacao) {
      const partes = s.numero_solicitacao.split("-");
      const n = parseInt(partes[2]) || 0;
      if (n > ultimaSequencia) ultimaSequencia = n;
    }
  });
  const ano = new Date().getFullYear();
  const sequencia = ultimaSequencia + 1;
  return `RET-${ano}-${String(sequencia).padStart(4, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────
// calcularDisponivel — mesmo cálculo já usado em routes/estoque/reservas.js
// (GET /saldo): físico (itens_consumo.saldo_atual) − soma das reservas
// ativas (estoque_reservas com liberado_em IS NULL, filtrado em JS porque
// DB.select não expressa IS NULL — ver nota em reservas.js). Replicado
// aqui em vez de chamar o endpoint HTTP porque o split acontece dentro da
// mesma transação lógica de salvar a OS.
//
// Retorna null quando o item não tem vínculo físico no almoxarifado
// (sem item_catalogo_id, ou sem linha correspondente em itens_consumo) —
// nesse caso a chamada decide tratar como "sem_estoque" (vai inteiro pra
// RC), mesma decisão de produto já confirmada no item 11 do schema doc.
async function calcularDisponivel(itemCatalogoId, tenantId) {
  if (!itemCatalogoId) return null;

  const itemConsumo = await DB.selectOne(
    "itens_consumo",
    { catalogo_item_id: itemCatalogoId, tenant_id: tenantId },
    tenantId
  );
  if (!itemConsumo) return null;

  const todasReservas = await DB.select(
    "estoque_reservas",
    { item_catalogo_id: itemCatalogoId, tenant_id: tenantId },
    tenantId
  );
  const reservasAtivas = (todasReservas || []).filter(r => !r.liberado_em);
  const reservado = reservasAtivas.reduce((soma, r) => soma + (parseFloat(r.quantidade) || 0), 0);
  const fisico = parseFloat(itemConsumo.saldo_atual) || 0;

  return {
    disponivel: fisico - reservado,
    itemConsumoId: itemConsumo.id,
    // Política de recompra do item (já existiam em itens_consumo, nunca
    // consumidas por nenhuma lógica até agora — ver
    // claude/redesenho-os-rm-rc.md, seção "sugestão de lote de recompra").
    loteMinimoCompra: parseFloat(itemConsumo.lote_minimo_compra) || 0,
    // Usados só pela reposição por saldo baixo (ver
    // calcularQuantidadeReposicao / seção "reposição sem déficit" no doc) —
    // limite_recompra é o gatilho, quantidade_lotes_automatico é quantos
    // lotes comprar de uma vez quando o gatilho dispara.
    limiteRecompra: parseFloat(itemConsumo.limite_recompra) || 0,
    quantidadeLotesAutomatico: parseInt(itemConsumo.quantidade_lotes_automatico) || 1
  };
}

// ─────────────────────────────────────────────────────────────────────────
// calcularSugestaoRecompra — quantidade sugerida de compra pra um item que
// já vai pra RC por déficit (disponivel < quantidade planejada). NUNCA
// substitui o déficit real — só sugere um valor MAIOR, arredondando o
// déficit para cima até o próximo múltiplo de lote_minimo_compra, sempre
// visível ao comprador como sugestão separada e editável (nunca aplicada
// automaticamente na quantidade que vai a cotação). Ver
// claude/redesenho-os-rm-rc.md.
//
// Retorna null quando não há lote_minimo_compra cadastrado (> 0) — nesse
// caso não há sugestão nenhuma, só o déficit puro, como já era.
function calcularSugestaoRecompra(deficit, loteMinimoCompra) {
  if (!loteMinimoCompra || loteMinimoCompra <= 0) return null;
  if (deficit <= 0) return null;

  const lotes = Math.ceil(deficit / loteMinimoCompra);
  const sugestao = lotes * loteMinimoCompra;

  // Só faz sentido mostrar a sugestão quando ela de fato aumenta a
  // quantidade — se o déficit já é um múltiplo exato do lote, sugestão
  // e déficit coincidem, não precisa de UI extra pra isso.
  if (sugestao <= deficit) return null;

  return sugestao;
}

// ─────────────────────────────────────────────────────────────────────────
// calcularQuantidadeReposicao — reposição de estoque SEM déficit na OS (ver
// claude/redesenho-os-rm-rc.md, seção "reposição sem déficit"). Caso
// diferente de calcularSugestaoRecompra: aqui o item foi 100% coberto pela
// RM (a OS não precisa comprar nada), mas a RETIRADA fez o saldo
// remanescente cair abaixo de itens_consumo.limite_recompra — dispara uma
// RC de reposição pura, pro comprador repor o estoque físico antes que
// falte da próxima vez. Sempre revisável/editável pelo comprador (mesma
// trava de bloqueado_em das outras RCs), nunca comprado sozinho de fato.
//
// Quantidade = lote_minimo_compra × quantidade_lotes_automatico (nº de
// lotes a comprar de cada vez que o gatilho dispara — não tenta calcular
// quantos lotes seriam necessários pra voltar acima do limite_recompra,
// mantém simples: 1 disparo = quantidade_lotes_automatico lotes).
//
// Retorna null quando não há limite_recompra ou lote_minimo_compra
// cadastrados (>0), ou quando o remanescente já está no limite ou acima
// (nada a repor).
function calcularQuantidadeReposicao(remanescente, limiteRecompra, loteMinimoCompra, quantidadeLotesAutomatico) {
  if (!limiteRecompra || limiteRecompra <= 0) return null;
  if (!loteMinimoCompra || loteMinimoCompra <= 0) return null;
  if (remanescente >= limiteRecompra) return null;

  const lotes = quantidadeLotesAutomatico && quantidadeLotesAutomatico > 0 ? quantidadeLotesAutomatico : 1;
  return loteMinimoCompra * lotes;
}

// ─────────────────────────────────────────────────────────────────────────
// dividirESalvarMateriais — o split automático em si (ver
// claude/redesenho-os-rm-rc.md no projeto). Roda depois que os itens da OS
// já foram inseridos/atualizados em chamado_itens. Para cada item de
// material ATIVO (ignora serviço e item cancelado):
//
//   - sem item_catalogo_id, ou sem vínculo em itens_consumo -> "sem
//     estoque": quantidade inteira vai pra RC.
//   - disponivel >= quantidade -> quantidade inteira vai pra RM (retirada).
//   - 0 < disponivel < quantidade -> divide: `disponivel` pra RM, o resto
//     pra RC.
//   - disponivel <= 0 -> quantidade inteira vai pra RC.
//
// Cria no máximo 1 RC (chamados, tipo_documento='requisicao_material') e
// no máximo 1 RET (solicitacoes_retirada) por chamada — mesmo padrão de
// "1 cabeçalho, N itens filhos" já usado nos dois fluxos que está
// reaproveitando. Não cria nada se não houver itens pra nenhum dos dois
// lados (ex: OS só de serviço, ou todos os itens já totalmente cobertos
// por uma divisão anterior — não é o caso ainda nesta fase, que só roda
// na criação).
//
// Idempotência: cada item de OS só pode alimentar uma RC/RM ativa por vez
// (mesma trava por chamado_itens.origem_os_item_id que
// POST /chamados/:id/gerar-requisicao-material já usava manualmente) —
// aqui simplesmente não é chamada de novo pro mesmo item enquanto o
// vínculo anterior está ativo, já que quem chama (POST /chamados) só roda
// isso uma vez, na criação.
async function dividirESalvarMateriais(itensMaterialInseridos, os, tenantId) {
  const paraRC = [];
  const paraRM = [];
  // Itens que foram 100% cobertos pela RM (sem déficit nenhum nesta OS),
  // mas cuja retirada derrubou o saldo remanescente abaixo do
  // limite_recompra — geram uma RC de reposição pura, desvinculada da
  // quantidade que a OS pediu (ver calcularQuantidadeReposicao acima).
  const paraReposicao = [];

  for (const item of itensMaterialInseridos) {
    if (item.status === "cancelado") continue;

    const quantidade = parseFloat(item.quantidade) || 0;
    if (quantidade <= 0) continue;

    const calc = await calcularDisponivel(item.item_catalogo_id, tenantId);

    if (calc === null) {
      // Sem vínculo físico — sem_estoque, vai inteiro pra RC. Sem
      // itens_consumo não há lote_minimo_compra pra consultar, então nunca
      // tem sugestão de recompra aqui.
      paraRC.push({ item, quantidade, quantidadeSugerida: null, loteMinimoCompra: null });
      continue;
    }

    const { disponivel, itemConsumoId, loteMinimoCompra, limiteRecompra, quantidadeLotesAutomatico } = calc;

    if (disponivel >= quantidade) {
      paraRM.push({ item, quantidade, itemConsumoId });

      // Sem déficit nesta OS — mas será que a retirada deixou o estoque
      // abaixo do limite de recompra? Só verifica aqui (cobertura 100% por
      // RM); os outros dois braços (split parcial / sem estoque) já geram
      // RC por déficit próprio, não precisa duplicar a checagem.
      const remanescente = disponivel - quantidade;
      const quantidadeReposicao = calcularQuantidadeReposicao(
        remanescente, limiteRecompra, loteMinimoCompra, quantidadeLotesAutomatico
      );
      if (quantidadeReposicao) {
        paraReposicao.push({ item, quantidade: quantidadeReposicao, loteMinimoCompra, itemConsumoId });
      }
    } else if (disponivel > 0) {
      paraRM.push({ item, quantidade: disponivel, itemConsumoId });
      const deficit = quantidade - disponivel;
      paraRC.push({
        item,
        quantidade: deficit,
        quantidadeSugerida: calcularSugestaoRecompra(deficit, loteMinimoCompra),
        loteMinimoCompra: loteMinimoCompra || null
      });
    } else {
      paraRC.push({
        item,
        quantidade,
        quantidadeSugerida: calcularSugestaoRecompra(quantidade, loteMinimoCompra),
        loteMinimoCompra: loteMinimoCompra || null
      });
    }
  }

  let rc = null;
  let ret = null;

  if (paraRC.length > 0 || paraReposicao.length > 0) {
    const numeroRC = await gerarNumeroRM(tenantId); // já gera prefixo RC- (ver acima)
    rc = await DB.insert("chamados", {
      tenant_id: tenantId,
      numero: numeroRC,
      tipo_documento: "requisicao_material",
      origem_os_id: os.id,
      origem_os_numero: os.numero,
      equipamento_id: os.equipamento_id || null,
      urgencia: os.urgencia || "media",
      categoria: os.categoria || "corretiva",
      status: "aguardando_cotacao",
      descricao: `Materiais a comprar da ${os.numero}`,
      servico_nome: os.servico_nome || os.descricao || `Materiais da ${os.numero}`,
      participa_benchmark: 1
    }, tenantId);

    for (const { item, quantidade, quantidadeSugerida, loteMinimoCompra } of paraRC) {
      await DB.insert("chamado_itens", {
        chamado_id: rc.id,
        tenant_id: tenantId,
        tipo: "material",
        origem: "planejado",
        status: "ativo",
        item_nome: item.item_nome,
        codigo: item.codigo,
        quantidade,
        urgencia: item.urgencia,
        categoria: item.categoria,
        tipo_item: item.tipo_item,
        descricao: item.descricao,
        item_catalogo_id: item.item_catalogo_id,
        unidade_medida: item.unidade_medida,
        origem_os_item_id: item.id,
        // Sugestão de lote de recompra (migration 013) — nunca altera
        // `quantidade` (o déficit real, que é o que vai pra cotação por
        // padrão). Só existe quando itens_consumo.lote_minimo_compra está
        // cadastrado e o lote arredondado é maior que o déficit puro. O
        // comprador decide na tela de cotação se quer usar a sugestão ou
        // manter o déficit — ver claude/redesenho-os-rm-rc.md.
        quantidade_sugerida_recompra: quantidadeSugerida,
        lote_minimo_compra_snapshot: loteMinimoCompra,
        // motivo_recompra (migration 014) distingue "precisa comprar pra
        // atender esta OS" de "reposição de estoque, sem urgência da OS" —
        // ver bloco paraReposicao abaixo. Aqui é sempre déficit real.
        motivo_recompra: "deficit"
      }, tenantId);
    }

    for (const { item, quantidade, loteMinimoCompra } of paraReposicao) {
      // Reposição pura (migration 014, ver calcularQuantidadeReposicao):
      // a OS não precisa comprar nada deste item (foi 100% atendido pela
      // RM) — esta linha existe só pra repor o estoque físico que a
      // retirada esvaziou abaixo do limite_recompra. `quantidade` aqui já
      // É o valor proposto (lote × quantidade_lotes_automatico), não um
      // déficit — por isso não tem uma segunda coluna de "sugestão": a
      // quantidade inteira da linha É a sugestão, e o comprador decide se
      // mantém, edita ou remove antes de cotar (mesma trava de
      // bloqueado_em das outras linhas de RC).
      await DB.insert("chamado_itens", {
        chamado_id: rc.id,
        tenant_id: tenantId,
        tipo: "material",
        origem: "planejado",
        status: "ativo",
        item_nome: item.item_nome,
        codigo: item.codigo,
        quantidade,
        urgencia: item.urgencia,
        categoria: item.categoria,
        tipo_item: item.tipo_item,
        descricao: item.descricao,
        item_catalogo_id: item.item_catalogo_id,
        unidade_medida: item.unidade_medida,
        origem_os_item_id: item.id,
        quantidade_sugerida_recompra: null,
        lote_minimo_compra_snapshot: loteMinimoCompra,
        motivo_recompra: "reposicao_estoque"
      }, tenantId);
    }
  }

  if (paraRM.length > 0) {
    const numeroRET = await gerarNumeroRET(tenantId);
    ret = await DB.insert("solicitacoes_retirada", {
      tenant_id: tenantId,
      numero_solicitacao: numeroRET,
      status: "pendente",
      criado_em: new Date(),
      motivo: `Materiais com estoque disponível da ${os.numero}`,
      solicitante_id: os.tecnico_id || null,
      origem_os_id: os.id,
      origem_os_numero: os.numero,
      // Cabeçalho de RET foi desenhado originalmente pra 1 item
      // (item_consumo_id/quantidade no próprio cabeçalho, replicado no
      // item filho). Split automático pode gerar múltiplos itens por OS
      // — grava o primeiro no cabeçalho por compatibilidade com telas que
      // ainda leem esses campos direto do cabeçalho, e TODOS os itens
      // (incluindo o primeiro) em solicitacao_retirada_itens, que é a
      // fonte de verdade pra aprovação (PUT /:id/aprovar itera os itens
      // filhos, não o cabeçalho).
      item_consumo_id: paraRM[0].itemConsumoId,
      quantidade: paraRM[0].quantidade
    }, tenantId);

    for (const { item, quantidade, itemConsumoId } of paraRM) {
      await DB.insert("solicitacao_retirada_itens", {
        tenant_id: tenantId,
        solicitacao_retirada_id: ret.id,
        item_consumo_id: itemConsumoId,
        item_nome: item.item_nome,
        quantidade,
        unidade_medida: item.unidade_medida,
        status: "pendente",
        criado_em: new Date(),
        origem_os_item_id: item.id
      }, tenantId);
    }
  }

  return {
    rc, ret,
    itensParaRC: paraRC.length,
    itensParaRM: paraRM.length,
    itensParaReposicao: paraReposicao.length
  };
}

// ─── ROTAS ─────────────────────────────────────────────────

// GET /api/cotacoes/chamados
router.get("/chamados", tenantMiddleware, async (req, res) => {
  try {

    const origem_os_id = req.query.origem_os_id;

    const tipoDocumentoFiltro = req.query.tipo_documento || "os";
    if (!["os", "requisicao_material"].includes(tipoDocumentoFiltro)) {
      return res.status(400).json({ erro: "tipo_documento inválido — use 'os' ou 'requisicao_material'" });
    }

    const todosChamados = await DB.select('chamados', { tenant_id: req.tenantId }, req.tenantId);
    const chamadosPorId = {};
    todosChamados.forEach(ch => { chamadosPorId[ch.id] = ch; });

    const chamados = todosChamados.filter(ch => (ch.tipo_documento || "os") === tipoDocumentoFiltro);

    // 2. Buscar equipamentos separadamente (para adicionar nome e tag)
    const chamadoIds = todosChamados.map(ch => ch.id);
    const equipamentoIds = chamados.map(ch => ch.equipamento_id).filter(Boolean);

    let equipamentos = [];
    if (equipamentoIds.length > 0) {
      equipamentos = await DB.raw(`
        SELECT id, nome, tag
        FROM equipamentos
        WHERE id = ANY($1) AND tenant_id = $2
      `, [equipamentoIds, req.tenantId]);
    }

    // Agrupar equipamentos por ID
    const equipamentosPorID = {};
    equipamentos.forEach(eq => {
      equipamentosPorID[eq.id] = eq;
    });

    // 3. Buscar itens de todos os chamados
    // Inclui os campos da repaginação (materiais+serviços unificados):
    // tipo/origem/status/numero_base/posicao + campos específicos de serviço.
    // DEPOIS: DB.select + sort em JS. O ORDER BY em SQL era ignorado pelo
    // fallback genérico do DB.raw (mesma classe de bug que já apareceu no
    // reverter/aplicar). Sort em JS não tem custo perceptível (a lista é do
    // tamanho de 1 OS), e é o padrão confiável do projeto.
    let itens = [];
    if (chamadoIds.length > 0) {
      const todosItens = await DB.select(
        "chamado_itens",
        { tenant_id: req.tenantId },
        req.tenantId
      );
      itens = todosItens
        .filter(it => chamadoIds.includes(it.chamado_id))
        .sort((a, b) => {
          if (a.chamado_id !== b.chamado_id) return a.chamado_id - b.chamado_id;
          const pa = a.posicao ?? a.numero_base ?? Number.MAX_SAFE_INTEGER;
          const pb = b.posicao ?? b.numero_base ?? Number.MAX_SAFE_INTEGER;
          if (pa !== pb) return pa - pb;
          return Number(a.id) - Number(b.id);
        });
    }

    const rmPorOrigemItem = {};
    itens.forEach(it => {
      if (it.origem_os_item_id && it.status !== "cancelado") {
        const rm = chamadosPorId[it.chamado_id];
        if (rm) {
          rmPorOrigemItem[it.origem_os_item_id] = { id: rm.id, numero: rm.numero };
        }
      }
    });

    // 3b. Buscar apontamentos (execução real) dos itens de serviço.
    //
    // FIX (2026-09): DB.raw com "chamado_item_id = ANY($1)" caía no fallback
    // genérico do wrapper (só filtrava por tenant_id), retornando apontamentos
    // de TODOS os itens do tenant. Trocado por DB.select + filtro em JS.
    //
    // Múltiplas sessões (migration 018): antes havia 1 apontamento por item
    // (UNIQUE em chamado_item_id), agora cada sessão é uma linha independente.
    // Por isso guardamos o array COMPLETO de sessões ativas por item + um
    // resumo consolidado, em vez de só a última linha.
    const itemIds = itens.map(it => it.id);
    let apontamentos = [];
    if (itemIds.length > 0) {
      const todosApontamentos = await DB.select(
        "chamado_apontamentos",
        { tenant_id: req.tenantId },
        req.tenantId
      );
      apontamentos = todosApontamentos.filter(ap =>
        itemIds.includes(ap.chamado_item_id) && ap.status !== "cancelado"
      );

      // Resolve nomes dos lançadores em batch
      const uuidsLancadores = [...new Set(apontamentos.map(a => a.lancado_por).filter(Boolean))];
      if (uuidsLancadores.length > 0) {
        const usuarios = await DB.select("usuarios", { tenant_id: req.tenantId }, req.tenantId);
        const nomePorId = {};
        usuarios.forEach(u => { nomePorId[u.id] = u.nome; });
        apontamentos = apontamentos.map(a => ({
          ...a,
          lancado_por_nome: a.lancado_por ? (nomePorId[a.lancado_por] || null) : null,
        }));
      }
    }

    // Agrupa sessões por item + monta resumo consolidado
    const apontamentosPorItem = {};
    apontamentos.forEach(ap => {
      const k = ap.chamado_item_id;
      if (!apontamentosPorItem[k]) apontamentosPorItem[k] = [];
      apontamentosPorItem[k].push(ap);
    });

    // Calcula o resumo de cada item de serviço (soma de horas por categoria)
    const resumoApontamentoPorItem = {};
    for (const item of itens) {
      if (item.tipo !== "servico") continue;
      const sessoes = apontamentosPorItem[item.id] || [];
      const soma = (campo) => sessoes.reduce((s, a) => s + (parseFloat(a[campo]) || 0), 0);

      const diurnas = soma("horas_normais_diurnas");
      const noturnas = soma("horas_normais_noturnas");
      const excepcionais = soma("horas_excepcionais");
      const total = diurnas + noturnas + excepcionais;

      // Horas planejadas = qtd_pessoas × duração da janela prevista
      let planejadas = null;
      if (item.data_inicio_prevista && item.data_fim_prevista) {
        const diffMs = new Date(item.data_fim_prevista) - new Date(item.data_inicio_prevista);
        if (!isNaN(diffMs) && diffMs > 0) {
          planejadas = (diffMs / 3600000) * (Number(item.qtd_pessoas_planejada) || 1);
        }
      }

      const concluidoManual = !!item.servico_concluido_manual;
      const concluido = concluidoManual
        || (planejadas != null ? total >= planejadas : sessoes.length > 0);

      resumoApontamentoPorItem[item.id] = {
        total: Number(total.toFixed(2)),
        diurnas: Number(diurnas.toFixed(2)),
        noturnas: Number(noturnas.toFixed(2)),
        excepcionais: Number(excepcionais.toFixed(2)),
        total_sessoes: sessoes.length,
        horas_planejadas: planejadas != null ? Number(planejadas.toFixed(2)) : null,
        servico_concluido: concluido,
        servico_concluido_manual: concluidoManual,
        servico_concluido_em: item.servico_concluido_em || null,
        servico_concluido_por_nome: item.servico_concluido_por_nome || null,
      };
    }

    // Agrupar itens por chamado
    const itensPorChamado = {};
    itens.forEach(item => {
      if (!itensPorChamado[item.chamado_id]) {
        itensPorChamado[item.chamado_id] = [];
      }
      itensPorChamado[item.chamado_id].push({
        ...item,
        // Compat: `apontamento` continua apontando pra última sessão (código
        // legado pode usar). Para o frontend novo, usar `apontamento_resumo`.
        apontamento: (apontamentosPorItem[item.id] || [])[0] || null,
        // Novo: array completo de sessões ativas + resumo consolidado
        apontamentos: apontamentosPorItem[item.id] || [],
        apontamento_resumo: resumoApontamentoPorItem[item.id] || null,
        requisicao_material: item.tipo === "material" ? (rmPorOrigemItem[item.id] || null) : undefined,
        servico_concluido_manual: item.servico_concluido_manual || false,
        servico_concluido_em: item.servico_concluido_em || null,
        servico_concluido_por_nome: item.servico_concluido_por_nome || null,
      });
    });

    // Calcula o % de conclusão pra OSs em andamento (as demais ficam null).
    // Feito em batch: 1 chamada por OS, mas só pra quem precisa.
    const osComPercentual = await Promise.all(chamados.map(async (ch) => {
      const precisaPct = (ch.tipo_documento || "os") === "os"
        && ch.status === "em_andamento";
      const percentual = precisaPct
        ? await calcularPercentualConclusao(ch.id, req.tenantId)
        : null;
      return { ...ch, percentual_conclusao: percentual };
    }));

    const resultado = osComPercentual.map(ch => ({
      ...ch,
      equipamento_nome: equipamentosPorID[ch.equipamento_id]?.nome || '—',
      equipamento_tag: equipamentosPorID[ch.equipamento_id]?.tag || '—',
      origem_os_numero: ch.origem_os_numero || null,
      itens: itensPorChamado[ch.id] || []
    }));

    res.json(resultado);
  } catch (err) {
    console.error("❌ Erro listar chamados:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─── Helpers da repaginação (materiais + serviços unificados) ─────────────
// Convertem um item do formato novo (payload de TelaChamadosNova.jsx) para
// as colunas de chamado_itens. `tipo` decide quais campos específicos são
// gravados; os do tipo oposto ficam null.
function montarChamadoItemData(item, chamadoId, tenantId) {
  const base = {
    chamado_id: chamadoId,
    tenant_id: tenantId,
    tipo: item.tipo === "servico" ? "servico" : "material",
    origem: item.origem === "adicionado" ? "adicionado" : "planejado",
    status: item.status === "cancelado" ? "cancelado" : "ativo",
    numero_base: item.numero_base ?? null,
    posicao: item.posicao ?? item.numero_base ?? null
  };

  if (base.tipo === "servico") {
    return {
      ...base,
      item_nome: item.nome || "",
      descricao: item.descricao || "",
      quantidade: null,
      codigo: null,
      urgencia: null,
      categoria: null,
      tipo_item: null,
      item_catalogo_id: null,
      qtd_pessoas_planejada: parseInt(item.qtd_pessoas_planejada) || 1,
      data_inicio_prevista: item.data_inicio_prevista || null,
      data_fim_prevista: item.data_fim_prevista || null
    };
  }

  return {
    ...base,
    item_nome: item.item_nome || "",
    codigo: item.codigo || "",
    quantidade: parseInt(item.quantidade) || 1,
    urgencia: item.urgencia || null,
    categoria: item.categoria || null,
    tipo_item: item.tipo_item || null,
    descricao: item.descricao || "",
    item_catalogo_id: item.item_catalogo_id || null,
    // FIX (2026-09-11, achado testando POST /chamados/rc-manual): este
    // helper nunca grava unidade_medida — o campo simplesmente não estava
    // no objeto de retorno, então TODO item de material criado ou editado
    // por aqui (POST /chamados, PUT /chamados/:id, e agora rc-manual)
    // sempre caía no default 'UN' da coluna, mesmo quando o frontend
    // mandava outra unidade (CX, L, KG...). Bug pré-existente, não
    // introduzido nesta rodada — só foi notado agora testando o payload
    // novo do rc-manual com unidade_medida != 'UN'.
    unidade_medida: item.unidade_medida || "UN",
    qtd_pessoas_planejada: null,
    data_inicio_prevista: null,
    data_fim_prevista: null,
    // Sugestão de lote de recompra (migration 013): só existe em item de RC
    // gerado pelo split automático (dividirESalvarMateriais grava direto
    // via DB.insert, não passa por aqui). Este helper é usado tanto pra
    // criar item de OS do zero (nunca tem sugestão — vem undefined do
    // payload, cai no `?? null`) quanto pro upsert de PUT /chamados/:id
    // (edição de item de RC já existente) — nesse caso o frontend faz
    // round-trip do que o GET devolveu, então repassar preserva a
    // sugestão calculada na criação em vez de apagá-la a cada save,
    // mesmo que o comprador só tenha editado outro campo do item.
    quantidade_sugerida_recompra: item.quantidade_sugerida_recompra ?? null,
    lote_minimo_compra_snapshot: item.lote_minimo_compra_snapshot ?? null,
    // motivo_recompra (migration 014): 'deficit' | 'reposicao_estoque' |
    // null (item de OS comum, nunca passou pelo split). Mesma lógica de
    // preservar no round-trip do PUT que os dois campos acima.
    motivo_recompra: item.motivo_recompra ?? null
  };
}

// POST /api/cotacoes/chamados
router.post("/chamados", tenantMiddleware, async (req, res) => {
  try {
    const {
      equipamento_id, tecnico_nome, descricao_geral, itens, servico_nome,
      urgencia, categoria, modo_programacao, data_inicio_prevista, data_fim_prevista
    } = req.body;

    let itensArray = itens;

    // Compatibilidade com o formato antigo (payload sem `itens`, um único
    // item avulso via `peca`) — mantido pra não quebrar nenhum chamador
    // que ainda não migrou pro formato novo.
    if (!itensArray || itensArray.length === 0) {
      const { peca, codigo, tipo_item, descricao } = req.body;
      if (!peca) {
        return res.status(400).json({ erro: "É necessário pelo menos um item ou peça" });
      }
      itensArray = [{
        tipo: "material",
        origem: "planejado",
        status: "ativo",
        numero_base: 1,
        item_nome: peca,
        codigo: codigo || "",
        urgencia: urgencia || "media",
        categoria: categoria || "corretiva",
        tipo_item: tipo_item || "",
        descricao: descricao || "",
        quantidade: 1
      }];
    }

    if (!itensArray || itensArray.length === 0) {
      return res.status(400).json({ erro: "Nenhum item informado" });
    }

    for (const item of itensArray) {
      const nome = item.tipo === "servico" ? item.nome : item.item_nome;
      if (!nome) {
        return res.status(400).json({ erro: "Todos os itens devem ter nome" });
      }
    }

    //const numero = await gerarNumeroChamado(req.tenantId);
    const numero = await gerarNumeroOS(req.tenantId);

    const chamadoData = {
      numero,
      tipo_documento: "os",
      equipamento_id: equipamento_id || null,
      tecnico_id: req.userId,
      tecnico_nome: tecnico_nome || req.userEmail || req.userId,
      descricao: descricao_geral || "",
      servico_nome: servico_nome || descricao_geral || "Manutenção",
      // urgencia/categoria agora vivem no nível da OS (não mais por item).
      urgencia: urgencia || "media",
      categoria: categoria || "corretiva",
      // Status OPERACIONAL da OS — nunca mais "aguardando_cotacao" (isso é
      // status de suprimentos, agora vive na RC, não na OS). Ver
      // claude/redesenho-os-rm-rc.md. "aberta" é o estado inicial antes de
      // qualquer execução; a tela de OS decide quando avançar pra
      // em_andamento/concluida.
      status: "aberta",
      origem_os_numero: servico_nome || "Manutenção",
      participa_benchmark: 1,
      // Programação da OS (migration 003): 'nenhuma' | 'geral' | 'detalhada'.
      modo_programacao: modo_programacao || null,
      data_inicio_prevista: data_inicio_prevista || null,
      data_fim_prevista: data_fim_prevista || null
    };

    const chamado = await DB.insert("chamados", chamadoData, req.tenantId);

    const itensInseridos = [];
    for (const item of itensArray) {
      const itemData = montarChamadoItemData(item, chamado.id, req.tenantId);
      const novoItem = await DB.insert("chamado_itens", itemData, req.tenantId);
      itensInseridos.push(novoItem);
    }

    // Split automático OS -> RM (retirada, estoque disponível) / RC (a
    // comprar) — só olha itens de material ativos; serviço nunca entra
    // aqui (OS só-serviço não gera RM nem RC, por design).
    const itensMaterialAtivos = itensInseridos.filter(it => it.tipo === "material" && it.status === "ativo");
    let split = { rc: null, ret: null, itensParaRC: 0, itensParaRM: 0 };
    if (itensMaterialAtivos.length > 0) {
      split = await dividirESalvarMateriais(itensMaterialAtivos, chamado, req.tenantId);
    }

    // Registra evento de criação (assíncrono, não bloqueia a resposta)
    {
      const u = await usuarioAtual(req, req.tenantId);
      await registrarEvento(
        req.tenantId, chamado.id, "criacao",
        `OS criada com ${itensInseridos.length} item(ns)`,
        { total_itens: itensInseridos.length, equipamento_id: chamado.equipamento_id },
        u
      );
    }

    res.status(201).json({
      id: chamado.id,
      numero: chamado.numero,
      status: chamado.status,
      modo_programacao: chamado.modo_programacao,
      itens: itensInseridos,
      requisicao_compra: split.rc ? {
        id: split.rc.id,
        numero: split.rc.numero,
        itens: split.itensParaRC + split.itensParaReposicao,
        itens_deficit: split.itensParaRC,
        itens_reposicao_estoque: split.itensParaReposicao
      } : null,
      requisicao_material: split.ret ? { id: split.ret.id, numero: split.ret.numero_solicitacao, itens: split.itensParaRM } : null,
      mensagem: `Chamado criado com ${itensInseridos.length} item(ns)`
    });

  } catch (err) {
    console.error("❌ Erro criar chamado:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/cotacoes/chamados/rc-manual  (Fase 2 — RC standalone, sem OS)
//
// Cria uma RC (chamados, tipo_documento='requisicao_material') DIRETO —
// sem passar por tipo_documento='os' primeiro. Diferente do split
// automático (dividirESalvarMateriais, chamado de dentro de POST
// /chamados), que sempre nasce a partir de uma OS real: esta rota existe
// pra compra administrativa/avulsa que nunca teve execução de campo
// nenhuma (não faz sentido criar uma "OS fantasma" só pra virar uma RC
// imediatamente) — ver claude/redesenho-os-rm-rc.md, Fase 2, decisão
// "Cria RC direto, sem OS fantasma".
//
// origem_os_id/origem_os_numero ficam null nessas RCs — é assim que o
// frontend (TelaChamadosNova.jsx, agora a tela de RC) distingue "Manual"
// de "gerada a partir de uma OS" na coluna Origem.
//
// Body esperado: { itens: [...], urgencia, categoria, descricao_geral }
// — mesmo formato de item que POST /chamados já aceita pra tipo=material
// (ver montarChamadoItemData). Só material: item tipo=servico no payload
// é rejeitado (RC nunca teve serviço, isso é conteúdo de OS).
// ─────────────────────────────────────────────────────────────────────────
router.post("/chamados/rc-manual", tenantMiddleware, async (req, res) => {
  try {
    const { itens, urgencia, categoria, descricao_geral, servico_nome, equipamento_id } = req.body;

    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ erro: "itens é obrigatório e deve conter ao menos 1 material" });
    }

    for (const item of itens) {
      if (item.tipo && item.tipo !== "material") {
        return res.status(400).json({ erro: "RC manual só aceita itens de material (sem serviço)" });
      }
      if (!item.item_nome) {
        return res.status(400).json({ erro: "Todos os itens devem ter item_nome" });
      }
    }

    const numero = await gerarNumeroRM(req.tenantId); // já gera prefixo RC-

    const rc = await DB.insert("chamados", {
      tenant_id: req.tenantId,
      numero,
      tipo_documento: "requisicao_material",
      origem_os_id: null,
      origem_os_numero: null,
      equipamento_id: equipamento_id || null,
      urgencia: urgencia || "media",
      categoria: categoria || "corretiva",
      status: "aguardando_cotacao",
      descricao: descricao_geral || "",
      servico_nome: servico_nome || descricao_geral || `Requisição de compra manual`,
      participa_benchmark: 1
    }, req.tenantId);

    const itensInseridos = [];
    for (const item of itens) {
      const itemData = montarChamadoItemData({ ...item, tipo: "material" }, rc.id, req.tenantId);
      const novoItem = await DB.insert("chamado_itens", itemData, req.tenantId);
      itensInseridos.push(novoItem);
    }

    res.status(201).json({
      id: rc.id,
      numero: rc.numero,
      status: rc.status,
      itens: itensInseridos,
      mensagem: `${rc.numero} criada com ${itensInseridos.length} item(ns)`
    });
  } catch (err) {
    console.error("❌ Erro ao criar RC manual:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/cotacoes/chamados/:id/gerar-requisicao-material  (Fase B)
//
// MANTIDO como via manual/complementar (ex: item que ficou só na OS porque
// não tinha item_catalogo_id no momento do save e foi vinculado depois, ou
// ajuste do comprador). O caminho PRIMÁRIO agora é o split automático em
// POST /chamados. Continua bloqueando gerar RM duas vezes pro mesmo item
// da OS enquanto o vínculo anterior estiver ativo — o split automático
// também respeita essa trava por construção (só roda 1x, na criação).
//
// Body esperado: { itens: [{ chamado_item_id, quantidade }, ...] }
// ─────────────────────────────────────────────────────────────────────────
router.post("/chamados/:id/gerar-requisicao-material", tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id: osId } = req.params;
    const { itens } = req.body;

    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ erro: "itens é obrigatório e deve conter ao menos 1 item" });
    }

    const os = await DB.selectOne("chamados", { id: osId, tenant_id: tenantId }, tenantId);
    if (!os) {
      return res.status(404).json({ erro: "OS não encontrada" });
    }
    if ((os.tipo_documento || "os") !== "os") {
      return res.status(400).json({ erro: "Requisição de Material só pode ser gerada a partir de uma Ordem de Serviço" });
    }

    // ─── Validar cada item antes de criar qualquer coisa ───────────────
    // (evita criar a RM "pela metade" se um item no meio da lista falhar)
    const itensParaCriar = [];
    for (const entrada of itens) {
      const chamadoItemId = entrada?.chamado_item_id;
      const qtd = parseInt(entrada?.quantidade);

      if (!chamadoItemId) {
        return res.status(400).json({ erro: "chamado_item_id é obrigatório em cada item" });
      }
      if (!qtd || qtd <= 0) {
        return res.status(400).json({ erro: `Quantidade inválida para o item ${chamadoItemId}` });
      }

      const itemOS = await DB.selectOne(
        "chamado_itens",
        { id: chamadoItemId, chamado_id: osId, tenant_id: tenantId },
        tenantId
      );
      if (!itemOS) {
        return res.status(404).json({ erro: `Item ${chamadoItemId} não encontrado nesta OS` });
      }
      if (itemOS.tipo !== "material") {
        return res.status(400).json({ erro: `Item "${itemOS.item_nome}" não é do tipo material` });
      }
      if (itemOS.status === "cancelado") {
        return res.status(400).json({ erro: `Item "${itemOS.item_nome}" está cancelado na OS` });
      }
      if (qtd > itemOS.quantidade) {
        return res.status(400).json({
          erro: `Quantidade solicitada (${qtd}) maior que a planejada na OS (${itemOS.quantidade}) para "${itemOS.item_nome}"`
        });
      }

      // Bloqueia gerar RM duas vezes para o mesmo item, mas só enquanto o
      // vínculo anterior estiver ativo (RM cancelada libera o item de novo).
      const vinculos = await DB.select("chamado_itens", { origem_os_item_id: itemOS.id }, tenantId);
      const vinculoAtivo = vinculos.find(v => v.status !== "cancelado");
      if (vinculoAtivo) {
        const rmExistente = await DB.selectOne("chamados", { id: vinculoAtivo.chamado_id }, tenantId);
        return res.status(400).json({
          erro: `Item "${itemOS.item_nome}" já está vinculado à ${rmExistente?.numero || "uma Requisição de Material"}`
        });
      }

      itensParaCriar.push({ itemOS, qtd });
    }

    // ─── Criar a RM (cabeçalho) ─────────────────────────────────────────
    const numeroRM = await gerarNumeroRM(tenantId);
    const rm = await DB.insert("chamados", {
      tenant_id: tenantId,
      numero: numeroRM,
      tipo_documento: "requisicao_material",
      origem_os_id: os.id,
      origem_os_numero: os.numero,
      equipamento_id: os.equipamento_id || null,
      urgencia: os.urgencia || "media",
      categoria: os.categoria || "corretiva",
      status: "aguardando_cotacao",
      descricao: `Materiais da ${os.numero}`,
      servico_nome: os.servico_nome || os.descricao || `Materiais da ${os.numero}`,
      participa_benchmark: 1
    }, tenantId);

    // ─── Criar os itens filhos da RM ────────────────────────────────────
    const itensCriados = [];
    for (const { itemOS, qtd } of itensParaCriar) {
      const novoItem = await DB.insert("chamado_itens", {
        chamado_id: rm.id,
        tenant_id: tenantId,
        tipo: "material",
        origem: "planejado",
        status: "ativo",
        item_nome: itemOS.item_nome,
        codigo: itemOS.codigo,
        quantidade: qtd,
        urgencia: itemOS.urgencia,
        categoria: itemOS.categoria,
        tipo_item: itemOS.tipo_item,
        descricao: itemOS.descricao,
        item_catalogo_id: itemOS.item_catalogo_id,
        unidade_medida: itemOS.unidade_medida,
        origem_os_item_id: itemOS.id
      }, tenantId);
      itensCriados.push(novoItem);
    }

    res.status(201).json({
      ok: true,
      requisicao_material: rm,
      itens: itensCriados,
      mensagem: `${numeroRM} gerada com ${itensCriados.length} ${itensCriados.length === 1 ? "item" : "itens"}`
    });
  } catch (err) {
    console.error("❌ Erro ao gerar requisição de material:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/cotacoes
router.get("/", tenantMiddleware, async (req, res) => {
  try {
    // 1. Buscar cotações
    const cotacoes = await DB.select('cotacoes', { tenant_id: req.tenantId }, req.tenantId);

    // 2. Buscar chamados separadamente
    const chamadoIds = cotacoes.map(c => c.chamado_id).filter(Boolean);
    let chamados = [];
    if (chamadoIds.length > 0) {
      chamados = await DB.raw(`
        SELECT id, numero, peca, categoria_item, servico_nome, urgencia, descricao, status as chamado_status
        FROM chamados
        WHERE id = ANY($1) AND tenant_id = $2
      `, [chamadoIds, req.tenantId]);
    }

    // Agrupar chamados por ID
    const chamadosPorID = {};
    chamados.forEach(ch => {
      chamadosPorID[ch.id] = ch;
    });

    // 3. Buscar fornecedores de todas as cotações
    const cotacaoIds = cotacoes.map(c => c.id);
    let fornecedores = [];
    if (cotacaoIds.length > 0) {
      fornecedores = await DB.raw(`
        SELECT
          id, cotacao_id, fornecedor_nome, fornecedor_email, status,
          valor, prazo, frete, valor_frete, obs, data_resposta
        FROM cotacao_fornecedores
        WHERE cotacao_id = ANY($1) AND tenant_id = $2
        ORDER BY data_resposta DESC NULLS LAST
      `, [cotacaoIds, req.tenantId]);
    }

    // Agrupar fornecedores por cotação
    const fornecedoresPorCotacao = {};
    fornecedores.forEach(f => {
      if (!fornecedoresPorCotacao[f.cotacao_id]) {
        fornecedoresPorCotacao[f.cotacao_id] = [];
      }
      fornecedoresPorCotacao[f.cotacao_id].push(f);
    });

    // 4. Montar resultado
    const resultado = cotacoes.map(c => ({
      ...c,
      chamado_numero: chamadosPorID[c.chamado_id]?.numero || null,
      chamado_peca: chamadosPorID[c.chamado_id]?.peca || null,
      chamado_servico_nome: chamadosPorID[c.chamado_id]?.servico_nome || null,
      chamado_urgencia: chamadosPorID[c.chamado_id]?.urgencia || null,
      chamado_categoria: chamadosPorID[c.chamado_id]?.categoria_item || null,
      chamado_status: chamadosPorID[c.chamado_id]?.chamado_status || null,
      fornecedores: fornecedoresPorCotacao[c.id] || []
    }));

    res.json(resultado);
  } catch (err) {
    console.error("❌ Erro listar cotações:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/cotacoes
router.post("/", tenantMiddleware, async (req, res) => {
  try {
    const { chamado_id, fornecedores, origem_ov_numero } = req.body;

    if (!chamado_id || !fornecedores || fornecedores.length === 0) {
      return res.status(400).json({ erro: "chamado_id e lista de fornecedores são obrigatórios" });
    }

    const chamado = await DB.selectOne("chamados", { id: chamado_id }, req.tenantId);
    if (!chamado) {
      return res.status(404).json({ erro: "Chamado não encontrado" });
    }

    // Trava de rastreabilidade: uma RC já bloqueada (cotação anterior já
    // disparada) não pode gerar OUTRA cotação nova do zero por aqui — evita
    // duas cotações concorrentes pro mesmo conjunto de itens. Cancelar a
    // cotação anterior é o caminho pra tentar de novo (fora de escopo
    // desta fase).
    if (chamado.bloqueado_em) {
      return res.status(400).json({ erro: `${chamado.numero} já está bloqueada para edição (cotação em andamento desde ${new Date(chamado.bloqueado_em).toLocaleString('pt-BR')})` });
    }

    const numero = await gerarNumeroCotacao(req.tenantId);

    const origem = origem_ov_numero || chamado?.origem_os_numero || chamado?.servico_nome || "Manutenção";

    const cotacao = await DB.insert("cotacoes", {
      chamado_id,
      numero,
      status: "em_curso",
      origem_ov_numero: origem
    }, req.tenantId);

    const linhas = [];
    for (const f of fornecedores) {
      const token = crypto.randomBytes(16).toString("hex");
      const cotacaoForn = await DB.insert("cotacao_fornecedores", {
        cotacao_id: cotacao.id,
        fornecedor_id: f.id || null,
        fornecedor_nome: f.nome,
        fornecedor_email: f.email,
        token,
        status: "pendente"
      }, req.tenantId);
      linhas.push({
        id: cotacaoForn.id,
        fornecedor_nome: f.nome,
        fornecedor_email: f.email,
        token,
        status: "pendente"
      });

      await enviarEmailCotacao(chamado, f, token, process.env.FRONTEND_URL).catch(e => console.error(e.message));
    }

    // Trava a RC pra adição de novos itens a partir de agora — rastreabilidade:
    // depois de enviada pra cotação, o requisitante não pode mais "descobrir"
    // um item novo que precisa entrar retroativamente (ver
    // claude/redesenho-os-rm-rc.md).
    await DB.update("chamados", chamado_id, { status: "cotando", bloqueado_em: new Date() }, req.tenantId);

    res.status(201).json({
      id: cotacao.id,
      numero: cotacao.numero,
      chamado_id,
      status: "em_curso",
      fornecedores: linhas,
      mensagem: `Cotação ${cotacao.numero} enviada para ${linhas.length} fornecedores`
    });

  } catch (err) {
    console.error("❌ Erro criar cotação:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/cotacoes/:id - Buscar cotação completa por ID
router.get('/:id', tenantMiddleware, async (req, res) => {
  try {
    const service = new CotacaoService(DB);
    const cotacao = await service.obterCotacao(req.tenantId, req.params.id);
    res.json({ ok: true, ...cotacao });
  } catch (err) {
    console.error('❌ Erro ao buscar cotação:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// PUT /api/cotacoes/:id/finalizar
router.put("/:id/finalizar", tenantMiddleware, async (req, res) => {
  try {
    const { fornecedor_id, valor_negociado } = req.body;

    if (!fornecedor_id) {
      return res.status(400).json({ erro: "fornecedor_id é obrigatório" });
    }

    const cotacao = await DB.selectOne("cotacoes", { id: req.params.id }, req.tenantId);
    if (!cotacao) {
      return res.status(404).json({ erro: "Cotação não encontrada" });
    }

    const vencedor = await DB.selectOne("cotacao_fornecedores", { id: fornecedor_id }, req.tenantId);
    if (!vencedor) {
      return res.status(404).json({ erro: "Fornecedor não encontrado" });
    }

    const chamado = await DB.selectOne("chamados", { id: cotacao.chamado_id }, req.tenantId);
    const valorFinal = valor_negociado || vencedor.valor || 0;
    const custoTotal = valorFinal + (vencedor.valor_frete || 0);

    await DB.update("cotacoes", req.params.id, { status: "finalizado", finalizado_em: new Date().toISOString() }, req.tenantId);
    await DB.update("chamados", chamado.id, {
      status: "finalizado",
      valor_aprovado: vencedor.valor,
      valor_negociado: valorFinal,
      custo_total_real: custoTotal,
      fornecedor_aprovado: vencedor.fornecedor_nome,
      aprovado_por: req.userEmail,
      aprovado_por_id: req.userId,
      finalizado_em: new Date().toISOString()
    }, req.tenantId);

    const todos = await DB.raw(`SELECT * FROM cotacao_fornecedores WHERE cotacao_id = $1 AND tenant_id = $2`, [req.params.id, req.tenantId]);
    for (const f of todos) {
      const ganhou = f.id === fornecedor_id;
      await enviarEmailResultado(chamado, f, ganhou).catch(e => console.error(e.message));
    }

    res.json({
      ok: true,
      cotacao_id: cotacao.id,
      chamado_id: chamado.id,
      fornecedor_vencedor: vencedor.fornecedor_nome,
      valor_final: valorFinal,
      custo_total: custoTotal,
      mensagem: "Cotação finalizada e fornecedor notificado"
    });

  } catch (err) {
    console.error("❌ Erro finalizar cotação:", err.message);
    res.status(500).json({ erro: err.message });
  }
});


// DELETE /api/cotacoes/chamados/:id - Deletar chamado
router.delete("/chamados/:id", tenantMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o chamado existe e pertence ao tenant
    const chamado = await DB.selectOne("chamados", { id }, req.tenantId);
    if (!chamado) {
      return res.status(404).json({ erro: "Chamado não encontrado" });
    }

    // Deletar chamado (os itens serão deletados em cascata via ON DELETE CASCADE)
    await DB.delete("chamados", id, req.tenantId);

    res.json({
      ok: true,
      mensagem: `Chamado ${chamado.numero} deletado com sucesso`
    });
  } catch (err) {
    console.error("❌ Erro ao deletar chamado:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// PUT /api/cotacoes/chamados/:id - Atualizar chamado
//
// FIX (2026-09): a versão anterior apagava TODOS os chamado_itens e
// reinseria do zero a cada save. Isso destruía a numeração congelada
// (numero_base) e o histórico de itens cancelados (o id do item muda a
// cada save, quebrando qualquer referência futura — requisição de compra,
// apontamento — que dependa desse id permanecer estável). Agora é upsert:
// item com id numérico que já existe em chamado_itens leva UPDATE
// (preserva id/numero_base/histórico); item sem id ainda persistido (id
// temporário do frontend, gerado como Date.now()+Math.random() — ver
// novoMaterial()/novoServico() em TelaChamadosNova.jsx) leva INSERT.
// Nenhum item é fisicamente deletado por aqui — cancelamento é
// status:'cancelado', já vindo assim no payload.
//
// FIX (2026-09, redesenho OS/RM/RC): se o chamado é uma RC já bloqueada
// (bloqueado_em setado — cotação já disparada), rejeita qualquer item do
// payload que não exista ainda em chamado_itens (adição de item novo).
// Edição de item já existente (quantidade, etc) continua permitida — só a
// ADIÇÃO de item novo é travada, por pedido explícito do usuário
// (rastreabilidade/auditoria — ver claude/redesenho-os-rm-rc.md).
router.put("/chamados/:id", tenantMiddleware, async (req, res) => {

  try {
    const { id } = req.params;
    const {
      equipamento_id, descricao_geral, servico_nome, itens,
      urgencia, categoria, modo_programacao, data_inicio_prevista, data_fim_prevista
    } = req.body;
    const tenantId = req.tenantId;

    // Validação crítica
    if (!Array.isArray(itens)) {
      console.error('❌ ERRO CRÍTICO: itens não é um array!', typeof itens);
      return res.status(400).json({
        erro: "itens deve ser um array",
        recebido: typeof itens,
        valor: itens
      });
    }

    // Verifica se o chamado existe
    const chamado = await DB.selectOne("chamados", { id, tenant_id: tenantId }, tenantId);
    if (!chamado) {
      console.error('❌ Chamado não encontrado:', id);
      return res.status(404).json({ erro: "Chamado não encontrado" });
    }

    // Trava de conclusão: OS concluída é imutável.
    if (chamado.concluida_em) {
      return res.status(400).json({
        erro: `${chamado.numero} está concluída desde ${new Date(chamado.concluida_em).toLocaleString('pt-BR')} — não pode ser editada`
      });
    }

    if (chamado.cancelada_em) {
      return res.status(400).json({
        erro: `${chamado.numero} está cancelada desde ${new Date(chamado.cancelada_em).toLocaleString('pt-BR')} — não pode ser editada`
      });
    }

    // Atualiza dados do chamado
    const updateData = {};
    if (equipamento_id !== undefined) updateData.equipamento_id = equipamento_id;
    if (descricao_geral !== undefined) updateData.descricao = descricao_geral;
    if (servico_nome !== undefined) updateData.servico_nome = servico_nome;
    if (urgencia !== undefined) updateData.urgencia = urgencia;
    if (categoria !== undefined) updateData.categoria = categoria;
    if (modo_programacao !== undefined) updateData.modo_programacao = modo_programacao;
    if (data_inicio_prevista !== undefined) updateData.data_inicio_prevista = data_inicio_prevista;
    if (data_fim_prevista !== undefined) updateData.data_fim_prevista = data_fim_prevista;
    updateData.atualizado_em = new Date().toISOString();

    await DB.update("chamados", id, updateData, tenantId);

    // Itens que já existem no banco pra este chamado — usado pra decidir
    // update vs. insert por item do payload.
    //
    // Cuidado: bigint do Postgres costuma voltar como STRING via node-pg
    // (ex: "1", não 1), então não dá pra usar Number.isInteger(item.id)
    // direto — item.id pode ser number ou string vindo do banco. IDs novos
    // do frontend (ver novoMaterial()/novoServico() em TelaChamadosNova.jsx)
    // são sempre Date.now()+Math.random(), ou seja, sempre têm casas
    // decimais — nunca colidem com um id inteiro real por coincidência.
    const itensExistentes = await DB.select("chamado_itens", { chamado_id: id, tenant_id: tenantId }, tenantId);
    const idsExistentes = new Set(itensExistentes.map(it => String(it.id)));

    function normalizarIdExistente(rawId) {
      if (rawId === null || rawId === undefined) return null;
      const n = Number(rawId);
      if (!Number.isFinite(n) || !Number.isInteger(n)) return null; // id temporário do frontend
      return String(n);
    }

    // Trava de RC bloqueada: rejeita item novo (sem id existente) se este
    // chamado já está com bloqueado_em setado. Não afeta OS (bloqueado_em
    // só é setado em RC, nunca em OS) nem edição de item já existente.
    if (chamado.bloqueado_em) {
      const temItemNovo = itens.some(item => {
        const idNormalizado = normalizarIdExistente(item.id);
        return idNormalizado === null || !idsExistentes.has(idNormalizado);
      });
      if (temItemNovo) {
        return res.status(400).json({
          erro: `${chamado.numero} está bloqueada para adição de novos itens (cotação já em andamento desde ${new Date(chamado.bloqueado_em).toLocaleString('pt-BR')})`
        });
      }
    }

    const itensSalvos = [];
    // Mapa dos existentes pra diff
    const itensExistentesPorId = {};
    itensExistentes.forEach(it => { itensExistentesPorId[String(it.id)] = it; });

    for (const item of itens) {
      const itemData = montarChamadoItemData(item, id, tenantId);
      const idNormalizado = normalizarIdExistente(item.id);

      if (idNormalizado !== null && idsExistentes.has(idNormalizado)) {
        const anterior = itensExistentesPorId[idNormalizado];

        // Diff antes do update — registra eventos de alteração
        const diffDescricoes = [];
        if (anterior.item_nome !== itemData.item_nome) {
          diffDescricoes.push(`nome: "${anterior.item_nome}" → "${itemData.item_nome}"`);
        }
        if (Number(anterior.quantidade) !== Number(itemData.quantidade) && itemData.tipo === "material") {
          diffDescricoes.push(`quantidade: ${anterior.quantidade} → ${itemData.quantidade}`);
        }
        if (anterior.status !== itemData.status) {
          diffDescricoes.push(`status: ${anterior.status} → ${itemData.status}`);
        }

        const atualizado = await DB.update("chamado_itens", idNormalizado, itemData, tenantId);
        itensSalvos.push(atualizado);

        if (diffDescricoes.length > 0) {
          const tipoEvento = (anterior.status !== "cancelado" && itemData.status === "cancelado")
            ? "item_cancelado"
            : (anterior.status === "cancelado" && itemData.status === "ativo")
              ? "item_restaurado"
              : "item_alterado";
          const desc = tipoEvento === "item_cancelado"
            ? `Item #${atualizado.numero_base ?? atualizado.id} cancelado: ${atualizado.item_nome}`
            : tipoEvento === "item_restaurado"
              ? `Item #${atualizado.numero_base ?? atualizado.id} restaurado: ${atualizado.item_nome}`
              : `Item #${atualizado.numero_base ?? atualizado.id} alterado: ${diffDescricoes.join(" · ")}`;
          const u = await usuarioAtual(req, tenantId);
          await registrarEvento(tenantId, id, tipoEvento, desc, {
            item_id: atualizado.id,
            diff: diffDescricoes,
          }, u);
        }
      } else {
        const inserido = await DB.insert("chamado_itens", itemData, tenantId);
        itensSalvos.push(inserido);

        const u = await usuarioAtual(req, tenantId);
        await registrarEvento(
          tenantId, id, "item_adicionado",
          `Item #${inserido.numero_base ?? inserido.id} adicionado: ${inserido.item_nome}`,
          { item_id: inserido.id, tipo: inserido.tipo },
          u
        );
      }
    }

    // Buscar chamado atualizado e seus itens (ordenados por posição, igual
    // ao GET, pra devolver a mesma ordem que a tela vai exibir).
    const chamadoAtualizado = await DB.selectOne("chamados", { id }, tenantId);

    // FIX (2026-09, achado durante teste da Fase 1 do redesenho OS/RM/RC):
    // esta query caía no fallback genérico de DB.raw() (só reconhece
    // tenant_id no WHERE, ignora "chamado_id = $1") — devolvia os
    // chamado_itens de TODOS os chamados do tenant, não só deste. Os dados
    // gravados no banco sempre estiveram corretos (o bug era só na
    // resposta HTTP), mas qualquer tela que confiasse nesse retorno pra
    // saber quais itens pertencem a este chamado estaria recebendo lixo de
    // outros chamados junto. Trocado por DB.select, que filtra de verdade.
    const itensAtualizadosBrutos = await DB.select("chamado_itens", { chamado_id: id, tenant_id: tenantId }, tenantId);
    const itensAtualizados = itensAtualizadosBrutos.sort((a, b) => {
      const posA = a.posicao ?? Infinity;
      const posB = b.posicao ?? Infinity;
      if (posA !== posB) return posA - posB;
      return Number(a.id) - Number(b.id);
    });

    res.json({
      ok: true,
      ...chamadoAtualizado,
      itens: itensAtualizados || [],
      itensSalvos: itensSalvos.length,
      mensagem: `Chamado atualizado com ${itensAtualizados.length} item(ns)`
    });

  } catch (err) {
    console.error("❌ ERRO CRÍTICO ao atualizar chamado:", err.message);
    console.error("❌ Stack trace:", err.stack);
    res.status(500).json({
      erro: err.message,
      stack: err.stack,
      detalhe: "Erro ao processar atualização"
    });
  }
});

// POST /api/cotacoes/gerar-automaticamente
router.post('/gerar-automaticamente', tenantMiddleware, async (req, res) => {
  try {
    const { chamado_id } = req.body;

    // 🔥 PREENCHER A ORIGEM
    const chamado = await DB.selectOne('chamados', { id: chamado_id }, req.tenantId);
    const origem_ov_numero = chamado?.origem_os_numero || null;

    const cotacoes = await cotacaoService.gerarCotacoesPorCategoria(
      req.tenantId,
      chamado_id,
      req.userId,
      origem_ov_numero
    );

    res.status(201).json({
      ok: true,
      cotacoes: cotacoes,
      total: cotacoes.length,
      mensagem: `${cotacoes.length} cotação(ões) criada(s) automaticamente`
    });
  } catch (err) {
    console.error('❌ Erro ao gerar cotações:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// 1. BUSCAR ITENS SIMILARES (Para autocomplete)
// ───────────────────────────────────────────────────────────────────────
router.post('/buscar-similares', tenantMiddleware, async (req, res) => {
  try {
    const { termo, limite = 5 } = req.body;

    if (!termo || termo.trim().length < 2) {
      return res.status(400).json({ erro: 'Termo deve ter pelo menos 2 caracteres' });
    }

    const similares = await cotacaoService.buscarSimilares(
      req.tenantId,
      termo,
      limite
    );

    res.json({
      ok: true,
      similares: similares,
      total: similares.length
    });
  } catch (err) {
    console.error('❌ Erro em buscar-similares:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// 2. CRIAR COTAÇÃO AUTOMÁTICA
// ───────────────────────────────────────────────────────────────────────
router.post('/criar-automatica', tenantMiddleware, async (req, res) => {
  try {
    const { chamadoId, itemCatalogoId } = req.body;

    if (!chamadoId || !itemCatalogoId) {
      return res.status(400).json({ erro: 'chamadoId e itemCatalogoId são obrigatórios' });
    }

    const cotacao = await cotacaoService.criarAutomatica(
      req.tenantId,
      chamadoId,
      itemCatalogoId,
      req.usuarioId
    );

    res.json({
      ok: true,
      cotacao: cotacao
    });
  } catch (err) {
    console.error('❌ Erro em criar-automatica:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// 3. ADICIONAR ITEM À COTAÇÃO
// ───────────────────────────────────────────────────────────────────────
router.post('/:cotacaoId/items', tenantMiddleware, async (req, res) => {
  try {
    const { cotacaoId } = req.params;
    const { itemCatalogoId, quantidade = 1 } = req.body;

    if (!itemCatalogoId) {
      return res.status(400).json({ erro: 'itemCatalogoId é obrigatório' });
    }

    const item = await cotacaoService.adicionarItem(
      req.tenantId,
      cotacaoId,
      itemCatalogoId,
      quantidade
    );

    res.json({
      ok: true,
      item: item
    });
  } catch (err) {
    console.error('❌ Erro em adicionar item:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// 4. REMOVER ITEM DA COTAÇÃO
// ───────────────────────────────────────────────────────────────────────
router.delete('/:cotacaoId/items/:itemId', tenantMiddleware, async (req, res) => {
  try {
    const { cotacaoId, itemId } = req.params;

    const resultado = await cotacaoService.removerItem(
      req.tenantId,
      cotacaoId,
      itemId
    );

    res.json({
      ok: true,
      resultado: resultado
    });
  } catch (err) {
    console.error('❌ Erro em remover item:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// 5. CONFIRMAR COTAÇÃO (Sai de rascunho)
// ───────────────────────────────────────────────────────────────────────
router.put('/:cotacaoId/confirmar', tenantMiddleware, async (req, res) => {
  try {
    const { cotacaoId } = req.params;

    const resultado = await cotacaoService.confirmarCotacao(
      req.tenantId,
      cotacaoId,
      req.usuarioId
    );

    res.json({
      ok: true,
      resultado: resultado
    });
  } catch (err) {
    console.error('❌ Erro em confirmar:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// GET /api/cotacoes/por-chamado/:chamadoId
// Busca chamado com itens agrupados por categoria + top 3 fornecedores
// ───────────────────────────────────────────────────────────────────────
router.get('/por-chamado/:chamadoId', tenantMiddleware, async (req, res) => {
  try {
    const { chamadoId } = req.params;

    if (!chamadoId) {
      return res.status(400).json({ erro: 'chamadoId é obrigatório' });
    }

    const resultado = await cotacaoService.buscarPorChamadoComFornecedores(
      req.tenantId,
      parseInt(chamadoId)
    );

    res.json({
      ok: true,
      ...resultado
    });
  } catch (err) {
    console.error('❌ Erro em por-chamado:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// POST /api/cotacoes/salvar
// Salva cotação em rascunho
// ───────────────────────────────────────────────────────────────────────
router.post('/salvar', tenantMiddleware, async (req, res) => {
  try {
    const { chamado_id, itens, notas, origem_ov_numero } = req.body;

    if (!chamado_id || !itens || itens.length === 0) {
      return res.status(400).json({
        erro: 'chamado_id e itens são obrigatórios'
      });
    }

    const resultado = await cotacaoService.salvarCotacao(req.tenantId, {
      chamado_id,
      itens,
      notas,
      origem_ov_numero: origem_ov_numero || null
    });

    res.json({
      ok: true,
      ...resultado
    });
  } catch (err) {
    console.error('❌ Erro em salvar:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// POST /api/cotacoes/enviar
// Envia cotação aos fornecedores (usando CotacaoService)
// ───────────────────────────────────────────────────────────────────────
router.post('/enviar', tenantMiddleware, async (req, res) => {
  try {
    const { cotacao_id, origem_ov_numero } = req.body;

    if (!cotacao_id) {
      return res.status(400).json({ erro: 'cotacao_id é obrigatório' });
    }

    const resultado = await cotacaoService.enviarCotacao(req.tenantId, cotacao_id, {
      origem_ov_numero: origem_ov_numero || null
    });

    res.json({
      ok: true,
      ...resultado
    });
  } catch (err) {
    console.error('❌ Erro em enviar:', err);
    res.status(500).json({ erro: err.message });
  }
});

// PUT /api/cotacoes/:id - Atualizar cotação
router.put('/:id', tenantMiddleware, async (req, res) => {
  try {
    const { itens, notas } = req.body;
    const cotacaoId = parseInt(req.params.id);

    if (!itens || itens.length === 0) {
      return res.status(400).json({ erro: 'itens são obrigatórios' });
    }

    const resultado = await cotacaoService.atualizarCotacao(req.tenantId, cotacaoId, {
      itens,
      notas
    });

    res.json({ ok: true, ...resultado });
  } catch (err) {
    console.error('❌ Erro em atualizar:', err);
    res.status(500).json({ erro: err.message });
  }
});

// DELETE /api/cotacoes/:id - Excluir (cancelar) cotação
router.delete('/:id', tenantMiddleware, async (req, res) => {
  try {
    const service = new CotacaoService(DB);
    const result = await service.excluirCotacao(req.tenantId, req.params.id);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('❌ Erro ao excluir:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// POST /api/cotacoes/:cotacaoId/ordem-venda
// Cria ordem de venda a partir de uma cotação
// ───────────────────────────────────────────────────────────────────────
router.post('/:cotacaoId/ordem-venda', tenantMiddleware, async (req, res) => {
  try {
    const { cotacaoId } = req.params;
    const { fornecedor_id, valor, frete, valor_original, frete_original, economia, obs } = req.body;

    if (!cotacaoId || !fornecedor_id) {
      return res.status(400).json({
        erro: 'cotacaoId e fornecedor_id são obrigatórios'
      });
    }

    const resultado = await cotacaoService.criarOrdenVenda(
      req.tenantId,
      parseInt(cotacaoId),
      parseInt(fornecedor_id),
      req.userId,
      {
        valor,
        frete,
        valor_original,
        frete_original,
        economia,
        obs
      }
    );

    res.json({ ok: true, ...resultado });
  } catch (err) {
    console.error('❌ Erro ao criar OV:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// GET /api/cotacoes/:cotacaoId/status
// ───────────────────────────────────────────────────────────────────────
router.get('/:cotacaoId/status', tenantMiddleware, async (req, res) => {
  try {
    const { cotacaoId } = req.params;

    if (!cotacaoId) {
      return res.status(400).json({ erro: 'cotacaoId é obrigatório' });
    }

    console.log(`🔍 Obtendo status da cotação ${cotacaoId}`);

    const status = await cotacaoService.obterStatusCotacao(
      req.tenantId,
      parseInt(cotacaoId)
    );

    res.json({
      ok: true,
      ...status
    });

  } catch (err) {
    console.error('❌ Erro ao obter status:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// PUT /api/cotacoes/:cotacaoId/fornecedor/:fornecedorId/atualizar-resposta
// Atualizar resposta manual de um fornecedor
// ───────────────────────────────────────────────────────────────────────
router.put('/:cotacaoId/fornecedor/:fornecedorId/atualizar-resposta', tenantMiddleware, async (req, res) => {
  try {
    const { cotacaoId, fornecedorId } = req.params;
    // 🔥 ADICIONE frete_renegociado
    const { valor, prazo, valor_frete, obs, valor_renegociado, frete_renegociado } = req.body;

    if (!cotacaoId || !fornecedorId) {
      return res.status(400).json({
        erro: 'cotacaoId e fornecedorId são obrigatórios'
      });
    }

    console.log(`📝 Atualizando resposta: cotação ${cotacaoId}, fornecedor ${fornecedorId}`);

    const atualizado = await cotacaoService.atualizarRespostaFornecedor(
      req.tenantId,
      parseInt(cotacaoId),
      parseInt(fornecedorId),
      {
        valor,
        prazo,
        valor_frete,
        obs,
        valor_renegociado,
        frete_renegociado
      }
    );

    res.json({
      ok: true,
      mensagem: 'Resposta atualizada com sucesso',
      ...atualizado
    });
  } catch (err) {
    console.error('❌ Erro ao atualizar resposta:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// POST /api/cotacoes/:cotacaoId/fornecedores
// Vincula fornecedor a uma cotação
// ───────────────────────────────────────────────────────────────────────

router.post('/:cotacaoId/fornecedores', tenantMiddleware, async (req, res) => {
  try {
    const { cotacaoId } = req.params;
    const { fornecedor_id } = req.body;
    const tenantId = req.tenantId;

    if (!fornecedor_id) {
      return res.status(400).json({ erro: 'fornecedor_id é obrigatório' });
    }

    // 1. Verificar se cotação existe
    const cotacao = await DB.selectOne('cotacoes', { id: cotacaoId }, tenantId);
    if (!cotacao) {
      return res.status(404).json({ erro: 'Cotação não encontrada' });
    }

    // 2. Verificar se fornecedor existe
    const fornecedor = await DB.selectOne('fornecedores', { id: fornecedor_id }, tenantId);
    if (!fornecedor) {
      return res.status(404).json({ erro: 'Fornecedor não encontrado' });
    }

    // 3. Gerar token único
    const { v4: uuidv4 } = require('uuid');
    const token = uuidv4();

    // 4. Inserir em cotacao_fornecedores
    const contatos = fornecedor.contatos ? JSON.parse(fornecedor.contatos) : [];
    const emailComercial = contatos?.[0]?.email || fornecedor.email;

    const resultado = await DB.insert(
      'cotacao_fornecedores',
      {
        tenant_id: tenantId,
        cotacao_id: cotacaoId,
        fornecedor_id: fornecedor_id,
        fornecedor_nome: fornecedor.nome,
        fornecedor_email: emailComercial,
        token: token,
        status: 'pendente'
      },
      tenantId
    );

    return res.json({
      ok: true,
      cotacao_fornecedor_id: resultado.id,
      token: token,
      mensagem: `Fornecedor ${fornecedor.nome} vinculado com sucesso`
    });

  } catch (erro) {
    console.error('❌ Erro ao vincular fornecedor:', erro);
    return res.status(500).json({
      erro: 'Erro ao vincular fornecedor',
      detalhes: process.env.NODE_ENV === 'development' ? erro.message : undefined
    });
  }
});

// ───────────────────────────────────────────────────────────────────────
// GET /api/cotacoes/:cotacaoId/monitorar
// Retorna status da cotação estruturado por ITEM (para TelaMonitorarRespostas)
// ───────────────────────────────────────────────────────────────────────

router.get('/:cotacaoId/monitorar', tenantMiddleware, async (req, res) => {
  try {
    const { cotacaoId } = req.params;
    const tenantId = req.tenantId;

    // 1. Buscar cotação
    const cotacao = await DB.selectOne('cotacoes', { id: cotacaoId }, tenantId);
    if (!cotacao) {
      return res.status(404).json({ erro: 'Cotação não encontrada' });
    }

    // 2. Buscar itens da cotação
    const itens = await DB.select('cotacao_itens', { cotacao_id: cotacaoId }, tenantId);

    // 2b. Buscar dados dos itens do chamado (nome, código, etc)
    const chamadoItemIds = itens.map(i => i.chamado_item_id);
    const chamadoItens = chamadoItemIds.length > 0
      ? await DB.select('chamado_itens', {}, tenantId).then(todos =>
          todos.filter(ci => chamadoItemIds.includes(ci.id))
        )
      : [];

    // 2c. Juntar informações
    const itensComDados = itens.map(item => {
      const chamadoItem = chamadoItens.find(ci => ci.id === item.chamado_item_id);
      return {
        ...item,
        item_nome: chamadoItem?.item_nome || 'Sem nome',
        codigo: chamadoItem?.codigo || '',
        categoria: chamadoItem?.categoria || ''
      };
    });

    // 3. Buscar fornecedores vinculados
    const fornecedores = await DB.select('cotacao_fornecedores', { cotacao_id: cotacaoId }, tenantId);

    // ✅ NOVO: Estruturar por ITEM usando fornecedores_ids do próprio item!
    const itensEstruturados = itensComDados.map(item => {
      // 🔥 USAR O fornecedores_ids DO PRÓPRIO ITEM
      const fornecedoresIds = Array.isArray(item.fornecedores_ids)
        ? item.fornecedores_ids
        : JSON.parse(item.fornecedores_ids || '[]');

      const fornecedoresComResposta = fornecedoresIds.map(fornecedorId => {
        const forn = fornecedores.find(f => f.fornecedor_id === fornecedorId);
        return forn ? {
          id: forn.id,
          fornecedor_id: forn.fornecedor_id,
          nome: forn.fornecedor_nome,
          email: forn.fornecedor_email,
          status: forn.status,
          valor: forn.valor || null,
          frete: forn.valor_frete || null,
          prazo: forn.prazo || null,
          obs: forn.obs || null,
          data_resposta: forn.data_resposta,
          total: forn.valor ? (forn.valor + (forn.valor_frete || 0)) : null,
          posicao: null
        } : null;
      }).filter(Boolean);

      // Calcular posições
      const comValor = fornecedoresComResposta.filter(f => f.total !== null);
      if (comValor.length > 0) {
        const ordenado = [...comValor].sort((a, b) => a.total - b.total);
        ordenado.forEach((f, idx) => {
          const fornInArray = fornecedoresComResposta.find(fn => fn.id === f.id);
          if (fornInArray) {
            fornInArray.posicao = idx + 1;
          }
        });
      }

      return {
        id: item.id,
        nome: item.item_nome,
        quantidade: item.quantidade,
        categoria: item.categoria,
        codigo: item.codigo,
        fornecedores: fornecedoresComResposta
      };
    });

    // 6. Calcular resumos
    const respondidos = fornecedores.filter(f => f.status === 'respondido').length;
    const pendentes = fornecedores.length - respondidos;

    // 7. Encontrar melhor proposta geral
    const melhorProposta = fornecedores
      .filter(f => f.status === 'respondido' && f.valor)
      .reduce((a, b) => (a.valor + (a.valor_frete || 0)) < (b.valor + (b.valor_frete || 0)) ? a : b, null);

    return res.json({
      cotacao: {
        id: cotacao.id,
        numero: cotacao.numero,
        status: cotacao.status,
        criado_em: cotacao.criado_em,
        enviado_em: cotacao.enviado_em
      },
      itens: itensEstruturados,
      resumo: {
        total: itensEstruturados.length,
        respondidos: respondidos,
        pendentes: pendentes
      },
      melhorProposta
    });

  } catch (erro) {
    console.error('❌ Erro ao buscar status cotação:', erro);
    return res.status(500).json({
      erro: 'Erro ao carregar status',
      detalhes: process.env.NODE_ENV === 'development' ? erro.message : undefined
    });
  }
});

// POST /api/cotacoes/:cotacaoId/item-fornecedor-selecionado
router.post('/:cotacaoId/item-fornecedor-selecionado', tenantMiddleware, async (req, res) => {
  try {
    const { cotacaoId } = req.params;
    const { cotacao_item_id, fornecedor_id } = req.body;
    const tenantId = req.tenantId;

    if (!cotacao_item_id || !fornecedor_id) {
      return res.status(400).json({ erro: 'cotacao_item_id e fornecedor_id são obrigatórios' });
    }

    await DB.insert(
      'cotacao_fornecedor_item_selecionado',
      {
        tenant_id: tenantId,
        cotacao_id: cotacaoId,
        cotacao_item_id,
        fornecedor_id,
        criado_em: new Date().toISOString()
      },
      tenantId
    );

    return res.json({ ok: true });
  } catch (erro) {
    console.error('❌ Erro ao registrar seleção:', erro);
    return res.status(500).json({ erro: 'Erro ao registrar seleção' });
  }
});

// GET /api/cotacoes/metricas-negociacao
router.get('/metricas-negociacao', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const dados = await DB.raw(`
      SELECT
        COUNT(*) as total_negociacoes,
        SUM(CASE WHEN economia > 0 THEN 1 ELSE 0 END) as negociacoes_sucesso,
        AVG(economia) as economia_media,
        SUM(economia) as economia_total
      FROM cotacao_fornecedores
      WHERE tenant_id = $1 AND valor_renegociado IS NOT NULL
    `, [tenantId]);

    res.json(dados[0]);
  } catch (err) {
    console.error('❌ Erro ao calcular métricas:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/cotacoes/:cotacaoId/fornecedor/:fornecedorId/renegociar
router.post('/:cotacaoId/fornecedor/:fornecedorId/renegociar', tenantMiddleware, async (req, res) => {
  try {
    const { cotacaoId, fornecedorId } = req.params;
    const { valor_renegociado } = req.body;

    const resposta = await DB.selectOne('cotacao_fornecedores', {
      cotacao_id: cotacaoId,
      fornecedor_id: fornecedorId
    }, req.tenantId);

    if (!resposta) {
      return res.status(404).json({ erro: 'Resposta não encontrada' });
    }

    // 🔥 SALVAR O VALOR RENEGOCIADO E CALCULAR ECONOMIA
    const economia = (resposta.valor || 0) - valor_renegociado;

    await DB.update('cotacao_fornecedores', resposta.id, {
      valor_renegociado,
      economia,
      data_renegociacao: new Date()
    }, req.tenantId);

    return res.json({ ok: true, economia });
  } catch (err) {
    console.error('❌ Erro ao renegociar:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/cotacoes/chamados/:id/apontamentos
//
// Insere uma NOVA sessão de execução em um item de serviço. Antes
// substituía (UNIQUE), agora empilha — o serviço é executado em várias
// sessões ao longo do tempo (decisão do usuário, 2026-09).
//
// Body:
//   servico_id,
//   pessoas_reais,
//   data_inicio_real, data_fim_real,
//   horas_normais_diurnas, horas_normais_noturnas, horas_excepcionais,
//   observacoes (opcional)
// ─────────────────────────────────────────────────────────────────────────
router.post("/chamados/:id/apontamentos", tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id: chamadoId } = req.params;
    const {
      servico_id, pessoas_reais,
      data_inicio_real, data_fim_real,
      horas_normais_diurnas, horas_normais_noturnas, horas_excepcionais,
      horas_extras_diurnas, horas_extras_noturnas,
      modo,
      participantes,
      observacoes,
    } = req.body;

    if (!servico_id) {
      return res.status(400).json({ erro: "servico_id é obrigatório" });
    }
    if (!pessoas_reais || pessoas_reais <= 0) {
      return res.status(400).json({ erro: "pessoas_reais deve ser maior que zero" });
    }

    let hD = parseFloat(horas_normais_diurnas) || 0;
    let hN = parseFloat(horas_normais_noturnas) || 0;
    let hE = parseFloat(horas_excepcionais) || 0;
    let hXD = parseFloat(horas_extras_diurnas) || 0;
    let hXN = parseFloat(horas_extras_noturnas) || 0;

    // Modo automático: backend calcula tudo a partir de inicio/fim + config
    if (modo === "auto") {
      if (!data_inicio_real || !data_fim_real) {
        return res.status(400).json({ erro: "Modo auto exige data_inicio_real e data_fim_real" });
      }
      const jornadas = await DB.select("tenant_jornadas", { tenant_id: tenantId, ativo: true }, tenantId);
      const jornada = jornadas.find(j => j.padrao) || jornadas[0] || null;
      const feriados = await DB.select("tenant_feriados", { tenant_id: tenantId }, tenantId);

      if (!jornada) {
        return res.status(400).json({ erro: "Sem jornada configurada — use modo manual" });
      }

      const calc = calcularSessaoAPartirDeHorarios(data_inicio_real, data_fim_real, pessoas_reais, jornada, feriados);
      if (!calc) {
        return res.status(400).json({ erro: "Janela inválida para cálculo automático" });
      }

      hD = calc.normais_diurnas;
      hN = calc.normais_noturnas;
      hE = calc.excepcionais;
      hXD = calc.extras_diurnas;
      hXN = calc.extras_noturnas;
    }

    if (hD + hN + hE + hXD + hXN <= 0) {
      return res.status(400).json({ erro: "Informe ao menos 1 hora em alguma categoria" });
    }

    const item = await DB.selectOne("chamado_itens", {
      id: servico_id, chamado_id: chamadoId, tenant_id: tenantId
    }, tenantId);
    if (!item) return res.status(404).json({ erro: "Item de serviço não encontrado nesta OS" });
    if (item.tipo !== "servico") return res.status(400).json({ erro: "Apontamento só se aplica a itens do tipo serviço" });

    // Guards de estado
    const osAp = await DB.selectOne("chamados", { id: chamadoId, tenant_id: tenantId }, tenantId);
    if (osAp?.concluida_em) return res.status(400).json({ erro: `${osAp.numero} está concluída — não aceita apontamentos` });
    if (osAp?.cancelada_em) return res.status(400).json({ erro: `${osAp.numero} está cancelada — não aceita apontamentos` });

    if (data_inicio_real && data_fim_real && new Date(data_fim_real) < new Date(data_inicio_real)) {
      return res.status(400).json({ erro: "data_fim_real não pode ser anterior a data_inicio_real" });
    }

    // Auto-transição 'aberta' → 'em_andamento' na primeira sessão
    if (osAp?.status === "aberta") {
      await DB.update("chamados", chamadoId, { status: "em_andamento" }, tenantId);
    }

    const u = await usuarioAtual(req, tenantId);
    const agora = new Date();

    const apontamento = await DB.insert("chamado_apontamentos", {
      tenant_id: tenantId,
      chamado_item_id: servico_id,
      pessoas_reais,
      data_inicio_real: data_inicio_real || null,
      data_fim_real: data_fim_real || null,
      horas_normais_diurnas: hD,
      horas_normais_noturnas: hN,
      horas_excepcionais: hE,
      horas_extras_diurnas: hXD,
      horas_extras_noturnas: hXN,
      calculo_automatico: modo === "auto",
      participantes: Array.isArray(participantes) ? participantes : [],
      horas_extras: 0, // campo legado, mantido por compat
      lancado_por: req.userId || null,
      lancado_em: agora,
      observacoes: observacoes || null,
    }, tenantId);

    // Evento na timeline da OS
    const partesHoras = [];
    if (hD > 0) partesHoras.push(`${hD}h diurnas`);
    if (hN > 0) partesHoras.push(`${hN}h noturnas`);
    if (hE > 0) partesHoras.push(`${hE}h excepcionais`);
    if (hXD > 0) partesHoras.push(`${hXD}h extras diurnas`);
    if (hXN > 0) partesHoras.push(`${hXN}h extras noturnas`);

    await registrarEvento(
      tenantId, chamadoId, "apontamento",
      `Sessão lançada em "${item.item_nome}": ${pessoas_reais} pessoa(s) · ${partesHoras.join(", ")}${modo === "auto" ? " (cálculo automático)" : ""}`,
      { apontamento_id: apontamento.id, servico_id, pessoas_reais, hD, hN, hE, hXD, hXN },
      u
    );

    const resumo = await calcularHorasApontadasItem(servico_id, tenantId);
    const concluido = await servicoEstaConcluido(
      await DB.selectOne("chamado_itens", { id: servico_id }, tenantId),
      tenantId
    );

    res.status(201).json({
      ok: true,
      apontamento,
      resumo,
      servico_concluido: concluido,
      mensagem: "Sessão registrada",
    });
  } catch (err) {
    console.error("❌ Erro ao salvar apontamento:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// recalcularAplicacaoItem — deriva quantidade_aplicada e status_aplicacao
// a partir da tabela de eventos (chamado_material_aplicacoes). Nunca
// confia em incrementos parciais: sempre recalcula do zero, porque é
// idempotente e evita drift se algum UPDATE falhar no meio.
// ─────────────────────────────────────────────────────────────────────────
async function recalcularAplicacaoItem(chamadoItemId, tenantId) {
  const eventos = await DB.select(
    "chamado_material_aplicacoes",
    { chamado_item_id: chamadoItemId, tenant_id: tenantId },
    tenantId
  );

  const aplicado = eventos
    .filter(e => e.tipo_evento === "aplicacao")
    .reduce((s, e) => s + (parseFloat(e.quantidade) || 0), 0);
  const revertido = eventos
    .filter(e => e.tipo_evento === "reversao")
    .reduce((s, e) => s + (parseFloat(e.quantidade) || 0), 0);
  const liquido = Math.max(0, aplicado - revertido);

  const item = await DB.selectOne("chamado_itens", { id: chamadoItemId }, tenantId);
  if (!item) return null;

  const planejada = parseFloat(item.quantidade) || 0;

  // 'nao_aplicado' é setado por uma rota específica — se já está assim,
  // respeita a decisão do usuário e não deixa o cálculo sobrescrever.
  if (item.status_aplicacao === "nao_aplicado") {
    await DB.update("chamado_itens", chamadoItemId, {
      quantidade_aplicada: liquido,
    }, tenantId);
    return { quantidade_aplicada: liquido, status_aplicacao: "nao_aplicado" };
  }

  let status;
  if (liquido <= 0) status = "pendente";
  else if (liquido < planejada) status = "parcial";
  else status = "aplicado";

  await DB.update("chamado_itens", chamadoItemId, {
    quantidade_aplicada: liquido,
    status_aplicacao: status,
  }, tenantId);

  return { quantidade_aplicada: liquido, status_aplicacao: status };
}

// ─────────────────────────────────────────────────────────────────────────
// POST /api/cotacoes/chamados/:id/materiais/:itemId/aplicar
//
// Registra a aplicação física de um material na OS. Sem lastro formal
// (compra emergencial), aceita com motivo + valor estimado, mas o registro
// aparece no relatório de divergências. Não bloqueia operação em campo
// por ausência de RM — ver claude/redesenho-os-rm-rc.md, seção
// "aplicação com lastro vs emergencial".
// ─────────────────────────────────────────────────────────────────────────
router.post("/chamados/:id/materiais/:itemId/aplicar", tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id: chamadoId, itemId } = req.params;
  const {
    quantidade, serializado, numeros_serie, lote, observacoes,
    origem_lastro, motivo_emergencia, valor_estimado, evidencia_url,
  } = req.body;
  const idemKey = req.headers["idempotency-key"] || null;

  try {
    // ── Idempotência ──
    if (idemKey) {
      const existentes = await DB.select(
        "chamado_material_aplicacoes",
        { tenant_id: tenantId, idempotency_key: idemKey },
        tenantId
      );
      if (existentes.length > 0) {
        return res.status(200).json({
          ok: true,
          aplicacao: existentes[0],
          idempotente: true,
          mensagem: "Aplicação já registrada (requisição duplicada ignorada).",
        });
      }
    }

    // ── Validações ──
    const os = await DB.selectOne("chamados", { id: chamadoId, tenant_id: tenantId }, tenantId);
    if (!os) return res.status(404).json({ erro: "OS não encontrada" });
    if ((os.tipo_documento || "os") !== "os") {
      return res.status(400).json({ erro: "Só é possível aplicar material em Ordem de Serviço" });
    }

    if (os.concluida_em) {
      return res.status(400).json({ erro: `${os.numero} está concluída — não aceita novas aplicações` });
    }
    if (os.cancelada_em) {
      return res.status(400).json({ erro: `${os.numero} está cancelada — não aceita novas aplicações` });
    }

    // Auto-transição: primeira aplicação muda 'aberta' → 'em_andamento'
    if (os.status === "aberta") {
      await DB.update("chamados", chamadoId, { status: "em_andamento" }, tenantId);
      const u = await usuarioAtual(req, tenantId);
      await registrarEvento(
        tenantId, chamadoId, "status_alterado",
        "Status alterado: Aberta → Em andamento (primeira aplicação registrada)",
        { de: "aberta", para: "em_andamento" },
        u
      );
    }

    const item = await DB.selectOne("chamado_itens", { id: itemId, chamado_id: chamadoId, tenant_id: tenantId }, tenantId);
    if (!item) return res.status(404).json({ erro: "Item não encontrado nesta OS" });
    if (item.tipo !== "material") return res.status(400).json({ erro: "Aplicação só se aplica a material" });
    if (item.status === "cancelado") return res.status(400).json({ erro: "Item cancelado na OS" });

    const q = parseFloat(quantidade);
    if (!q || q <= 0) return res.status(400).json({ erro: "quantidade deve ser maior que zero" });

    const jaAplicado = parseFloat(item.quantidade_aplicada) || 0;
    const planejado = parseFloat(item.quantidade) || 0;
    if (jaAplicado + q > planejado) {
      return res.status(400).json({
        erro: `A quantidade a aplicar (${q}) excede o pendente do item (${planejado - jaAplicado})`,
      });
    }

    const lastroValidos = ["rm", "emergencial", "estoque_proprio"];
    if (!lastroValidos.includes(origem_lastro)) {
      return res.status(400).json({ erro: "origem_lastro inválido — use 'rm', 'emergencial' ou 'estoque_proprio'" });
    }
    if (origem_lastro !== "rm" && !motivo_emergencia) {
      return res.status(400).json({ erro: "motivo_emergencia é obrigatório quando a origem não é RM" });
    }

    // ── Validação de série (antes do RPC) ──
    const ehSerializado = !!serializado || !!item.serializado;
    const series = Array.isArray(numeros_serie)
      ? numeros_serie.map(s => String(s || "").trim().toUpperCase()).filter(Boolean)
      : [];
    if (ehSerializado) {
      if (series.length !== q) {
        return res.status(400).json({ erro: `Quantidade de nºs de série (${series.length}) difere da quantidade aplicada (${q})` });
      }
      if (new Set(series).size !== series.length) {
        return res.status(400).json({ erro: "Há números de série repetidos nesta aplicação" });
      }

      const aplicacoesDoTenant = await DB.select(
        "chamado_material_aplicacoes",
        { tenant_id: tenantId, tipo_evento: "aplicacao" },
        tenantId
      );
      const reversoesDoTenant = await DB.select(
        "chamado_material_aplicacoes",
        { tenant_id: tenantId, tipo_evento: "reversao" },
        tenantId
      );
      const idsRevertidos = new Set(reversoesDoTenant.map(r => String(r.aplicacao_origem_id)));
      const aplicacoesOutrasOs = aplicacoesDoTenant.filter(
        a => String(a.chamado_id) !== String(chamadoId) && !idsRevertidos.has(String(a.id))
      );

      if (aplicacoesOutrasOs.length > 0) {
        const idsAtivos = aplicacoesOutrasOs.map(a => a.id);
        const todasSeries = await DB.select("chamado_material_aplicacao_series", { tenant_id: tenantId }, tenantId);
        const payloadSet = new Set(series.map(s => s.toUpperCase()));
        const conflitos = todasSeries
          .filter(s => idsAtivos.includes(s.aplicacao_id) && payloadSet.has(String(s.numero_serie).toUpperCase()))
          .map(s => {
            const aplic = aplicacoesOutrasOs.find(a => a.id === s.aplicacao_id);
            return { numero_serie: s.numero_serie, chamado_id: aplic?.chamado_id };
          });
        if (conflitos.length > 0) {
          const c = conflitos[0];
          return res.status(400).json({
            erro: `Nº de série ${c.numero_serie} já está aplicado em outra OS (id ${c.chamado_id})`,
          });
        }
      }
    }

    // ── Vínculo com RM ──
    let retiradaItemId = null;
    if (origem_lastro === "rm") {
      const retiradaItens = await DB.select("solicitacao_retirada_itens", { tenant_id: tenantId, origem_os_item_id: itemId }, tenantId);
      const validos = retiradaItens.filter(r => r.status !== "cancelado");
      if (validos.length === 0) {
        return res.status(400).json({
          erro: "Não há RM vinculada a este item. Registre como 'emergencial' ou 'estoque_proprio'.",
        });
      }
      retiradaItemId = validos[0].id;
    }

    // Busca o nome do usuário para gravar junto ao registro de aplicação.
    // A coluna "nome" mora na tabela usuarios (o JWT só carrega id/email).
    let operadorNome = null;
    if (req.userId) {
      try {
        const u = await DB.selectOne("usuarios", { id: req.userId }, tenantId);
        operadorNome = u?.nome || null;
      } catch (_) { /* silencioso — se falhar, fica só email */ }
    }

    // ── RPC atômico (aplicação + séries numa transação) ──
    let aplicacaoId;
    try {
      aplicacaoId = await DB.rpc("aplicar_material", {
        p_tenant_id: tenantId,
        p_chamado_id: parseInt(chamadoId),
        p_chamado_item_id: parseInt(itemId),
        p_quantidade: q,
        p_origem_lastro: origem_lastro,
        p_motivo_emergencia: motivo_emergencia || null,
        p_valor_estimado: valor_estimado != null ? parseFloat(valor_estimado) : null,
        p_evidencia_url: evidencia_url || null,
        p_lote: lote || null,
        p_observacoes: observacoes || null,
        p_operador_id: req.userId || null,
        p_operador_email: req.userEmail || null,
        p_operador_nome: operadorNome,
        p_idempotency_key: idemKey,
        p_series: ehSerializado ? series : null,
      });
    } catch (rpcErr) {
      // O índice único uq_aplic_series_ativo é a última linha de defesa
      // contra race condition (dois técnicos aplicando o mesmo SN ao mesmo
      // tempo). Se chegou aqui, foi isso — a validação amigável acima já
      // tinha passado.
      if (rpcErr.message.includes("uq_aplic_series_ativo")) {
        return res.status(409).json({
          erro: "Um dos números de série foi aplicado por outra requisição simultânea. Recarregue e tente novamente.",
        });
      }
      throw rpcErr;
    }

    // Se veio retiradaItemId, atualiza (fora do RPC — não precisa atomicidade,
    // é só um vínculo informativo; se falhar, não invalida a aplicação)
    if (retiradaItemId) {
      try {
        await DB.update("chamado_material_aplicacoes", aplicacaoId, { retirada_item_id: retiradaItemId }, tenantId);
      } catch (e) { console.warn("⚠ Falha ao vincular RM (não bloqueante):", e.message); }
    }

    {
      const u = await usuarioAtual(req, tenantId);
      await registrarEvento(
        tenantId, chamadoId, "aplicacao",
        `Aplicação registrada: ${q} un de "${item.item_nome}"`,
        {
          item_id: itemId,
          quantidade: q,
          origem_lastro,
          numeros_serie: ehSerializado ? series : [],
        },
        u
      );
    }

    // ── Recalcula e devolve ──
    const status = await recalcularAplicacaoItem(itemId, tenantId);
    const aplicacao = await DB.selectOne("chamado_material_aplicacoes", { id: aplicacaoId }, tenantId);
    const seriesSalvas = ehSerializado
      ? await DB.select("chamado_material_aplicacao_series", { aplicacao_id: aplicacaoId, tenant_id: tenantId }, tenantId)
      : [];

    res.status(201).json({
      ok: true,
      aplicacao,
      series: seriesSalvas.map(s => s.numero_serie),
      item: { id: itemId, ...status },
      mensagem: "Aplicação registrada",
    });
  } catch (err) {
    console.error("❌ Erro ao aplicar material:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/cotacoes/chamados/aplicacoes/:aplicacaoId/reverter
//
// Estorno de uma aplicação. Nunca deleta — insere uma linha tipo
// 'reversao' apontando pra aplicação original (mesmo modelo do SAP, que
// usa movimento 262 para estornar 261). O histórico completo fica
// preservado para garantia/seguradora/auditoria.
// ─────────────────────────────────────────────────────────────────────────
router.post("/chamados/aplicacoes/:aplicacaoId/reverter", tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { aplicacaoId } = req.params;
  const { motivo, observacoes } = req.body;

  try {
    if (!motivo) return res.status(400).json({ erro: "motivo é obrigatório" });

    const original = await DB.selectOne(
      "chamado_material_aplicacoes",
      { id: aplicacaoId, tenant_id: tenantId },
      tenantId
    );
    if (!original) return res.status(404).json({ erro: "Aplicação não encontrada" });
    if (original.tipo_evento !== "aplicacao") {
      return res.status(400).json({ erro: "Só é possível reverter uma aplicação (não uma reversão)" });
    }

    // Trava de conclusão / cancelamento: OS concluída ou cancelada não
    // aceita reversão.
    const osDaAplicacao = await DB.selectOne("chamados", { id: original.chamado_id, tenant_id: tenantId }, tenantId);
    if (osDaAplicacao?.concluida_em) {
      return res.status(400).json({ erro: `${osDaAplicacao.numero} está concluída — não aceita reversão` });
    }
    if (osDaAplicacao?.cancelada_em) {
      return res.status(400).json({ erro: `${osDaAplicacao.numero} está cancelada — não aceita reversão` });
    }

    // Busca o nome do usuário (mesma lógica do handler aplicar).
    let operadorNome = null;
    if (req.userId) {
      try {
        const u = await DB.selectOne("usuarios", { id: req.userId }, tenantId);
        operadorNome = u?.nome || null;
      } catch (_) { /* silencioso */ }
    }


    // RPC atômico (reversão + desativar séries numa transação)
    let reversaoId;
    try {
      reversaoId = await DB.rpc("reverter_aplicacao", {
        p_tenant_id: tenantId,
        p_aplicacao_id: parseInt(aplicacaoId),
        p_motivo: motivo,
        p_observacoes: observacoes || null,
        p_operador_id: req.userId || null,
        p_operador_email: req.userEmail || null,
        p_operador_nome: operadorNome,
      });
    } catch (rpcErr) {
      if (rpcErr.message.includes("já foi revertida")) {
        return res.status(400).json({ erro: "Esta aplicação já foi revertida anteriormente" });
      }
      if (rpcErr.message.includes("Só é possível reverter")) {
        return res.status(400).json({ erro: "Só é possível reverter uma aplicação (não uma reversão)" });
      }
      throw rpcErr;
    }

    const reversao = await DB.selectOne("chamado_material_aplicacoes", { id: reversaoId }, tenantId);
    {
      const u = await usuarioAtual(req, tenantId);
      await registrarEvento(
        tenantId, original.chamado_id, "reversao",
        `Reversão de aplicação: ${original.quantidade} un — motivo: ${motivo}`,
        { aplicacao_origem_id: aplicacaoId, motivo },
        u
      );
    }
    const status = await recalcularAplicacaoItem(original.chamado_item_id, tenantId);

    res.json({
      ok: true,
      reversao,
      item: { id: original.chamado_item_id, ...status },
      mensagem: "Aplicação revertida. Histórico preservado.",
    });
  } catch (err) {
    console.error("❌ Erro ao reverter aplicação:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/cotacoes/chamados/:id/materiais/:itemId/marcar-nao-aplicado
//
// O técnico determina que a peça não foi aplicada (ex: retirou errado,
// descobriu que era outro modelo). Marca o item da OS como 'nao_aplicado'
// e cancela a linha correspondente na RM, devolvendo o saldo ao estoque.
// ─────────────────────────────────────────────────────────────────────────
router.post("/chamados/:id/materiais/:itemId/marcar-nao-aplicado", tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id: chamadoId, itemId } = req.params;
  const { motivo } = req.body;

  try {
    const item = await DB.selectOne(
      "chamado_itens",
      { id: itemId, chamado_id: chamadoId, tenant_id: tenantId },
      tenantId
    );
    if (!item) return res.status(404).json({ erro: "Item não encontrado" });
    if (item.tipo !== "material") return res.status(400).json({ erro: "Só material" });

    // Trava de conclusão: OS concluída não aceita mudança de status do item.
    const osDoItem = await DB.selectOne("chamados", { id: chamadoId, tenant_id: tenantId }, tenantId);
    if (osDoItem?.concluida_em) {
      return res.status(400).json({ erro: `${osDoItem.numero} está concluída — não aceita alterações` });
    }
    if (osDoItem?.cancelada_em) {
      return res.status(400).json({ erro: `${osDoItem.numero} está cancelada — não aceita alterações` });
    }

    const aplicado = parseFloat(item.quantidade_aplicada) || 0;
    if (aplicado > 0) {
      return res.status(400).json({
        erro: "Item já tem aplicação registrada. Reverta as aplicações antes de marcar como não aplicado.",
      });
    }

    // Cancela linha da RM vinculada, se houver (devolve saldo)
    const rmLinks = await DB.raw(`
      SELECT sri.id
      FROM solicitacao_retirada_itens sri
      JOIN solicitacoes_retirada sr ON sr.id = sri.solicitacao_retirada_id
      WHERE sri.tenant_id = $1 AND sri.origem_os_item_id = $2
        AND sr.origem_os_id = $3 AND sri.status != 'cancelado'
    `, [tenantId, itemId, chamadoId]);

    for (const rm of rmLinks) {
      await DB.update("solicitacao_retirada_itens", rm.id, {
        status: "cancelado",
        motivo_cancelamento: motivo || "Marcado como não aplicado na OS",
      }, tenantId);
    }

    await DB.update("chamado_itens", itemId, {
      status_aplicacao: "nao_aplicado",
    }, tenantId);

    res.json({
      ok: true,
      item: { id: itemId, status_aplicacao: "nao_aplicado" },
      rmCanceladas: rmLinks.length,
      mensagem: rmLinks.length > 0
        ? `Item marcado como não aplicado. ${rmLinks.length} linha(s) da RM cancelada(s) — saldo devolvido.`
        : "Item marcado como não aplicado.",
    });
  } catch (err) {
    console.error("❌ Erro ao marcar como não aplicado:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/cotacoes/chamados/:id/materiais/:itemId/aplicacoes
//
// Histórico completo de aplicações e reversões de um item — alimenta o
// painel expandido na tela de detalhe da OS. Devolve cada evento com os
// SNs que ele carrega, em ordem cronológica decrescente.
// ─────────────────────────────────────────────────────────────────────────
router.get("/chamados/:id/materiais/:itemId/aplicacoes", tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id: chamadoId, itemId } = req.params;

  try {
    const todosEventos = await DB.select(
      "chamado_material_aplicacoes",
      { tenant_id: tenantId },
      tenantId
    );
    const eventos = todosEventos
      .filter(e =>
        String(e.chamado_id) === String(chamadoId)
        && String(e.chamado_item_id) === String(itemId)
      )
      .sort((a, b) => {
        const da = new Date(a.data_evento).getTime();
        const db = new Date(b.data_evento).getTime();
        if (db !== da) return db - da;
        return Number(b.id) - Number(a.id);
      });

    // Carrega SNs de cada aplicação
    const aplicacaoIds = eventos.map(e => e.id);
    let series = [];
    if (aplicacaoIds.length > 0) {
      series = await DB.raw(`
        SELECT aplicacao_id, numero_serie
        FROM chamado_material_aplicacao_series
        WHERE tenant_id = $1 AND aplicacao_id = ANY($2)
        ORDER BY id
      `, [tenantId, aplicacaoIds]);
    }

    const seriesPorAplicacao = {};
    series.forEach(s => {
      if (!seriesPorAplicacao[s.aplicacao_id]) seriesPorAplicacao[s.aplicacao_id] = [];
      seriesPorAplicacao[s.aplicacao_id].push(s.numero_serie);
    });

    // Marca quais aplicações já foram revertidas (pra UI esconder o botão)
    const revertidasIds = new Set(
      eventos.filter(e => e.tipo_evento === "reversao" && e.aplicacao_origem_id)
             .map(e => String(e.aplicacao_origem_id))
    );

    const aplicacoes = eventos.map(e => ({
      ...e,
      numeros_serie: seriesPorAplicacao[e.id] || [],
      pode_reverter: e.tipo_evento === "aplicacao" && !revertidasIds.has(String(e.id)),
    }));

    res.json({ ok: true, aplicacoes });
  } catch (err) {
    console.error("❌ Erro ao listar aplicações:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// validarOSNaoConcluida — usado como guard em toda rota que altera a OS
// ou seus itens. Depois de concluída, a OS vira imutável (rastreabilidade
// e auditoria — mesma regra do bloqueado_em das RCs).
// Lança erro que os handlers convertem em 400.
// ─────────────────────────────────────────────────────────────────────────
async function validarOSNaoConcluida(chamadoId, tenantId) {
  const os = await DB.selectOne("chamados", { id: chamadoId, tenant_id: tenantId }, tenantId);
  if (!os) throw new Error("OS não encontrada");
  if (os.concluida_em) {
    throw new Error(`${os.numero} já está concluída desde ${new Date(os.concluida_em).toLocaleString('pt-BR')} — não pode ser editada`);
  }
  if (os.cancelada_em) {
    throw new Error(`${os.numero} está cancelada desde ${new Date(os.cancelada_em).toLocaleString('pt-BR')} — não pode ser editada`);
  }
  return os;
}

// ─────────────────────────────────────────────────────────────────────────
// POST /api/cotacoes/chamados/:id/concluir
//
// Fecha a OS. Valida que todos os materiais foram resolvidos
// (aplicados ou explicitamente marcados como não aplicados) e grava um
// snapshot consolidado — horas planejadas, horas reais, custo de
// materiais. Depois disso, a OS fica imutável.
// ─────────────────────────────────────────────────────────────────────────
router.post("/chamados/:id/concluir", tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id: chamadoId } = req.params;

  try {
    const os = await DB.selectOne("chamados", { id: chamadoId, tenant_id: tenantId }, tenantId);
    if (!os) return res.status(404).json({ erro: "OS não encontrada" });
    if ((os.tipo_documento || "os") !== "os") {
      return res.status(400).json({ erro: "Só Ordens de Serviço podem ser concluídas por aqui" });
    }
    if (os.concluida_em) {
      return res.status(400).json({ erro: `${os.numero} já está concluída` });
    }
    if (os.cancelada_em) {
      return res.status(400).json({ erro: `${os.numero} está cancelada — não pode ser concluída` });
    }

    // ── Bloqueio: NC ativa vinculada a esta OS ──
    // NC "ativa" = status em aberta/em_analise/em_execucao. Depois de
    // resolvida ou cancelada, deixa de bloquear.
    const ncsDaOS = await DB.select("nao_conformidades", { tenant_id: tenantId, chamado_id: chamadoId }, tenantId);
    const ncsBloqueantes = ncsDaOS.filter(nc =>
      ["aberta", "em_analise", "em_execucao"].includes(nc.status)
    );
    if (ncsBloqueantes.length > 0) {
      return res.status(400).json({
        erro: `Não é possível concluir: ${ncsBloqueantes.length} Não Conformidade(s) ativa(s) vinculada(s) a esta OS. Resolva ou cancele antes de fechar.`,
        ncs_bloqueantes: ncsBloqueantes.map(nc => ({
          id: nc.id,
          numero_nc: nc.numero_nc,
          status: nc.status,
          descricao_problema: nc.descricao_problema,
        })),
      });
    }

    // ── Itens da OS ──
    const todosItens = await DB.select("chamado_itens", { chamado_id: chamadoId, tenant_id: tenantId }, tenantId);
    const itensAtivos = todosItens.filter(it => it.status !== "cancelado");
    const materiais = itensAtivos.filter(it => it.tipo === "material");
    const servicos = itensAtivos.filter(it => it.tipo === "servico");

    // ── Bloqueio: material pendente ou parcial ──
    const materiaisPendentes = materiais.filter(m => {
      const aplicado = Number(m.quantidade_aplicada) || 0;
      const planejado = Number(m.quantidade) || 0;
      if (m.status_aplicacao === "nao_aplicado") return false;
      return aplicado < planejado;
    });

    if (materiaisPendentes.length > 0) {
      return res.status(400).json({
        erro: `Não é possível concluir: ${materiaisPendentes.length} material(is) sem confirmação de aplicação. Aplique ou marque como "não aplicado" antes de fechar a OS.`,
        materiais_pendentes: materiaisPendentes.map(m => ({
          id: m.id,
          item_nome: m.item_nome,
          quantidade: m.quantidade,
          quantidade_aplicada: m.quantidade_aplicada,
          status_aplicacao: m.status_aplicacao,
        })),
      });
    }

    // ── Aviso (não bloqueia): serviço sem apontamento ──
    const apontamentos = await DB.select("chamado_apontamentos", { tenant_id: tenantId }, tenantId);
    const idsServicos = servicos.map(s => s.id);
    const apontamentosPorItem = {};
    apontamentos.filter(a => idsServicos.includes(a.chamado_item_id))
      .forEach(a => { apontamentosPorItem[a.chamado_item_id] = a; });

    const servicosSemApontamento = servicos.filter(s => !apontamentosPorItem[s.id]);

    // ── Snapshot: horas ──
    function horasHomem(ini, fim, pessoas) {
      if (!ini || !fim || !pessoas) return 0;
      const diffMs = new Date(fim) - new Date(ini);
      if (isNaN(diffMs) || diffMs <= 0) return 0;
      return (diffMs / 3600000) * Number(pessoas);
    }

    const horasPlanejadas = servicos.reduce((soma, s) =>
      soma + horasHomem(s.data_inicio_prevista, s.data_fim_prevista, s.qtd_pessoas_planejada), 0);

    const horasReais = servicos.reduce((soma, s) => {
      const ap = apontamentosPorItem[s.id];
      if (!ap) return soma;
      const h = horasHomem(ap.data_inicio_real, ap.data_fim_real, ap.pessoas_reais);
      return soma + h + (Number(ap.horas_extras) || 0);
    }, 0);

    // ── Snapshot: custo de materiais ──
    // Soma o valor_estimado das aplicações NÃO revertidas. Obs: só
    // captura compras emergenciais — material via RM não tem preço
    // armazenado aqui ainda (viria do PO). Documentado na UI.
    const aplicacoes = await DB.select("chamado_material_aplicacoes", { chamado_id: chamadoId, tenant_id: tenantId }, tenantId);
    const reversoes = aplicacoes.filter(a => a.tipo_evento === "reversao");
    const idsRevertidos = new Set(reversoes.map(r => String(r.aplicacao_origem_id)));
    const aplicacoesAtivas = aplicacoes.filter(a =>
      a.tipo_evento === "aplicacao" && !idsRevertidos.has(String(a.id))
    );

    const custoMateriais = aplicacoesAtivas.reduce((soma, a) => {
      if (a.valor_estimado == null) return soma;
      return soma + (Number(a.valor_estimado) * Number(a.quantidade));
    }, 0);

    // ── Busca nome do operador ──
    let operadorNome = null;
    if (req.userId) {
      try {
        const u = await DB.selectOne("usuarios", { id: req.userId }, tenantId);
        operadorNome = u?.nome || null;
      } catch (_) {}
    }

    // (Nada a fazer antes — o evento de conclusão é registrado depois do
    // update, junto com o snapshot.)
    // ── Persiste ──
    await DB.update("chamados", chamadoId, {
      status: "finalizado",
      concluida_em: new Date().toISOString(),
      concluida_por: req.userId || null,
      concluida_por_nome: operadorNome,
      snapshot_horas_planejadas: Number(horasPlanejadas.toFixed(2)),
      snapshot_horas_reais: Number(horasReais.toFixed(2)),
      snapshot_custo_materiais: Number(custoMateriais.toFixed(2)),
      snapshot_total_aplicacoes: aplicacoesAtivas.length,
    }, tenantId);

    const osAtualizada = await DB.selectOne("chamados", { id: chamadoId }, tenantId);

    // Registra evento de conclusão
    {
      const u = await usuarioAtual(req, tenantId);
      await registrarEvento(
        tenantId, chamadoId, "conclusao",
        `OS concluída. ${aplicacoesAtivas.length} aplicação(ões), ${Number(horasReais.toFixed(1))}h-homem realizadas.`,
        { total_aplicacoes: aplicacoesAtivas.length, horas_reais: Number(horasReais.toFixed(2)) },
        u
      );
    }

    res.json({
      ok: true,
      chamado: osAtualizada,
      resumo: {
        horas_planejadas: Number(horasPlanejadas.toFixed(2)),
        horas_reais: Number(horasReais.toFixed(2)),
        custo_materiais: Number(custoMateriais.toFixed(2)),
        total_aplicacoes: aplicacoesAtivas.length,
        servicos_sem_apontamento: servicosSemApontamento.map(s => s.item_nome || s.nome),
      },
      mensagem: `${os.numero} concluída com sucesso`,
    });
  } catch (err) {
    console.error("❌ Erro ao concluir OS:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/cotacoes/chamados/:id/salvar-como-template
//
// Snapshot dos itens de uma OS vira um novo template reutilizável.
// Não copia datas, status de aplicação, nem vínculos (RM/RC) — só o
// "esqueleto" do que aquela OS planejou.
// ─────────────────────────────────────────────────────────────────────────
router.post("/chamados/:id/salvar-como-template", tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id: chamadoId } = req.params;
  const { nome, descricao } = req.body;

  try {
    if (!nome || !nome.trim()) {
      return res.status(400).json({ erro: "nome é obrigatório" });
    }

    const os = await DB.selectOne("chamados", { id: chamadoId, tenant_id: tenantId }, tenantId);
    if (!os) return res.status(404).json({ erro: "OS não encontrada" });

    const itens = await DB.select("chamado_itens", { chamado_id: chamadoId, tenant_id: tenantId }, tenantId);
    const ativos = itens.filter(it => it.status !== "cancelado");
    if (ativos.length === 0) {
      return res.status(400).json({ erro: "OS não tem itens ativos para salvar como modelo" });
    }

    // Nome do usuário
    let operadorNome = null;
    if (req.userId) {
      try {
        const u = await DB.selectOne("usuarios", { id: req.userId }, tenantId);
        operadorNome = u?.nome || null;
      } catch (_) {}
    }

    const template = await DB.insert("os_templates", {
      tenant_id: tenantId,
      nome: nome.trim(),
      descricao: descricao || null,
      categoria: os.categoria || null,
      urgencia: os.urgencia || null,
      ativo: true,
      criado_por: req.userId || null,
      criado_por_nome: operadorNome,
    }, tenantId);

    const itensCriados = [];
    for (const it of ativos.sort((a, b) => (a.posicao ?? 0) - (b.posicao ?? 0))) {
      const base = {
        tenant_id: tenantId,
        template_id: template.id,
        tipo: it.tipo,
        numero_base: it.numero_base ?? null,
        posicao: it.posicao ?? null,
        descricao: it.descricao || null,
      };
      const payload = it.tipo === "material" ? {
        ...base,
        item_nome: it.item_nome,
        codigo: it.codigo || null,
        item_catalogo_id: it.item_catalogo_id || null,
        quantidade: it.quantidade,
        tipo_item: it.tipo_item || null,
        serializado: !!it.serializado,
      } : {
        ...base,
        item_nome: it.item_nome || it.nome,
        qtd_pessoas_planejada: it.qtd_pessoas_planejada || 1,
      };
      itensCriados.push(await DB.insert("os_template_itens", payload, tenantId));
    }

    res.status(201).json({
      ok: true,
      template: { ...template, total_itens: itensCriados.length },
      mensagem: `Modelo "${template.nome}" criado com ${itensCriados.length} item(ns)`,
    });
  } catch (err) {
    console.error("❌ Erro ao salvar template:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/cotacoes/chamados/templates
//
// Lista os templates do tenant. Não traz os itens — só o cabeçalho, para
// o seletor ficar leve. Use GET /templates/:id para detalhes.
// ─────────────────────────────────────────────────────────────────────────
router.get("/chamados/templates", tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const templates = await DB.select("os_templates", { tenant_id: tenantId, ativo: true }, tenantId);
    templates.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

    // Conta itens por template
    const todosItens = await DB.select("os_template_itens", { tenant_id: tenantId }, tenantId);
    const contagem = {};
    todosItens.forEach(it => {
      contagem[it.template_id] = (contagem[it.template_id] || 0) + 1;
    });

    res.json(templates.map(t => ({ ...t, total_itens: contagem[t.id] || 0 })));
  } catch (err) {
    console.error("❌ Erro ao listar templates:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

router.get("/chamados/templates/:templateId", tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { templateId } = req.params;
  try {
    const template = await DB.selectOne("os_templates", { id: templateId, tenant_id: tenantId }, tenantId);
    if (!template) return res.status(404).json({ erro: "Template não encontrado" });

    const itens = await DB.select("os_template_itens", { template_id: templateId, tenant_id: tenantId }, tenantId);
    itens.sort((a, b) => {
      const pa = a.posicao ?? a.numero_base ?? Number.MAX_SAFE_INTEGER;
      const pb = b.posicao ?? b.numero_base ?? Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      return Number(a.id) - Number(b.id);
    });

    res.json({ ...template, itens });
  } catch (err) {
    console.error("❌ Erro ao buscar template:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

router.delete("/chamados/templates/:templateId", tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { templateId } = req.params;
  try {
    const t = await DB.selectOne("os_templates", { id: templateId, tenant_id: tenantId }, tenantId);
    if (!t) return res.status(404).json({ erro: "Template não encontrado" });

    await DB.update("os_templates", templateId, { ativo: false, atualizado_em: new Date().toISOString() }, tenantId);
    res.json({ ok: true, mensagem: `Modelo "${t.nome}" removido` });
  } catch (err) {
    console.error("❌ Erro ao remover template:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

router.put("/chamados/templates/:templateId", tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { templateId } = req.params;
  const { nome, descricao, categoria, urgencia } = req.body;
  try {
    const t = await DB.selectOne("os_templates", { id: templateId, tenant_id: tenantId }, tenantId);
    if (!t) return res.status(404).json({ erro: "Template não encontrado" });

    const update = { atualizado_em: new Date().toISOString() };
    if (nome !== undefined) update.nome = nome.trim();
    if (descricao !== undefined) update.descricao = descricao;
    if (categoria !== undefined) update.categoria = categoria;
    if (urgencia !== undefined) update.urgencia = urgencia;

    const atualizado = await DB.update("os_templates", templateId, update, tenantId);
    res.json({ ok: true, template: atualizado });
  } catch (err) {
    console.error("❌ Erro ao atualizar template:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/cotacoes/chamados/templates-globais
//
// Lista os modelos globais do SaaS. Busca fuzzy via pg_trgm — tolera
// erros de digitação ("vollvo" acha "volvo"). Filtros opcionais por
// tipo de equipamento, marca e categoria.
// ─────────────────────────────────────────────────────────────────────────
router.get("/chamados/templates-globais", tenantMiddleware, async (req, res) => {
  try {
    const termo = req.query.q || null;
    const tipoEquip = req.query.tipo_equipamento || null;
    const marca = req.query.marca || null;
    const categoria = req.query.categoria || null;
    const limit = parseInt(req.query.limit) || 100;

    const resultados = await DB.rpc("buscar_templates_globais", {
      p_termo: termo,
      p_tipo_equipamento: tipoEquip,
      p_marca: marca,
      p_categoria: categoria,
      p_limit: limit,
    });

    res.json(resultados || []);
  } catch (err) {
    console.error("❌ Erro ao listar templates globais:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/cotacoes/chamados/templates-globais/:id
//
// Detalhes de um modelo global, com todos os itens.
// ─────────────────────────────────────────────────────────────────────────
router.get("/chamados/templates-globais/:id", tenantMiddleware, async (req, res) => {
  try {
    const template = await DB.selectOne("templates_globais", { id: req.params.id, ativo: true }, null);
    if (!template) return res.status(404).json({ erro: "Modelo não encontrado" });

    const itens = await DB.select("templates_globais_itens", { template_global_id: req.params.id }, null);
    itens.sort((a, b) => {
      const pa = a.posicao ?? a.numero_base ?? Number.MAX_SAFE_INTEGER;
      const pb = b.posicao ?? b.numero_base ?? Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      return Number(a.id) - Number(b.id);
    });

    res.json({ ...template, itens });
  } catch (err) {
    console.error("❌ Erro ao buscar template global:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/cotacoes/chamados/templates-globais-meta/filtros
//
// Lista os valores distintos de tipo_equipamento e marca pra popular
// os dropdowns de filtro no frontend, sem hardcode.
// ─────────────────────────────────────────────────────────────────────────
router.get("/chamados/templates-globais-meta/filtros", tenantMiddleware, async (req, res) => {
  try {
    const todos = await DB.select("templates_globais", { ativo: true }, null);

    const tiposEquip = [...new Set(todos.map(t => t.tipo_equipamento).filter(Boolean))].sort();
    const marcas = [...new Set(todos.map(t => t.marca).filter(Boolean))].sort();

    res.json({ tipos_equipamento: tiposEquip, marcas });
  } catch (err) {
    console.error("❌ Erro ao listar filtros:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/cotacoes/chamados/templates-globais
//
// Cria/atualiza um modelo global. Endpoint ADMIN — só a curadoria do
// SaaS deve usar. Aceita o formato JSON que você gerar com IA.
//
// Body: { nome, descricao, categoria, urgencia, tipo_equipamento, marca,
//         modelo, intervalo_descricao, intervalo_km, itens: [...] }
// ─────────────────────────────────────────────────────────────────────────
router.post("/chamados/templates-globais", tenantMiddleware, async (req, res) => {
  try {
    const {
      nome, descricao, categoria, urgencia,
      tipo_equipamento, marca, modelo,
      ano_inicio, ano_fim,
      intervalo_descricao, intervalo_km, intervalo_dias,
      itens,
    } = req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({ erro: "nome é obrigatório" });
    }
    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ erro: "itens é obrigatório (mínimo 1)" });
    }

    // Busca nome do operador pra registrar quem publicou
    let operadorNome = null;
    if (req.userId) {
      try {
        const u = await DB.selectOne("usuarios", { id: req.userId }, req.tenantId);
        operadorNome = u?.nome || null;
      } catch (_) {}
    }

    const template = await DB.insert("templates_globais", {
      nome: nome.trim(),
      descricao: descricao || null,
      categoria: categoria || null,
      urgencia: urgencia || null,
      tipo_equipamento: tipo_equipamento || null,
      marca: marca || null,
      modelo: modelo || null,
      ano_inicio: ano_inicio || null,
      ano_fim: ano_fim || null,
      intervalo_descricao: intervalo_descricao || null,
      intervalo_km: intervalo_km || null,
      intervalo_dias: intervalo_dias || null,
      origem: "oficial",
      publicado_por_nome: operadorNome || "Curadoria QuotaFlow",
    }, null);

    const itensCriados = [];
    for (const [i, it] of itens.entries()) {
      const base = {
        template_global_id: template.id,
        tipo: it.tipo === "servico" ? "servico" : "material",
        numero_base: it.numero_base ?? (i + 1),
        posicao: it.posicao ?? (i + 1),
        descricao: it.descricao || null,
      };
      const payload = base.tipo === "material" ? {
        ...base,
        item_nome: it.item_nome,
        codigo: it.codigo || null,
        quantidade: it.quantidade || 1,
        tipo_item: it.tipo_item || null,
        serializado: !!it.serializado,
      } : {
        ...base,
        item_nome: it.item_nome,
        qtd_pessoas_planejada: it.qtd_pessoas_planejada || 1,
      };
      itensCriados.push(await DB.insert("templates_globais_itens", payload, null));
    }

    res.status(201).json({
      ok: true,
      template: { ...template, total_itens: itensCriados.length },
      mensagem: `Modelo "${template.nome}" publicado com ${itensCriados.length} item(ns)`,
    });
  } catch (err) {
    console.error("❌ Erro ao criar template global:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/cotacoes/chamados/templates-globais/:id/propor-melhoria
//
// Registra uma sugestão de melhoria do cliente no modelo global.
// Fase 3 do roadmap — endpoint fica pronto, UI vem depois.
// ─────────────────────────────────────────────────────────────────────────
router.post("/chamados/templates-globais/:id/propor-melhoria", tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id: templateId } = req.params;
  const { tipo, mensagem } = req.body;

  try {
    if (!mensagem || !mensagem.trim()) {
      return res.status(400).json({ erro: "mensagem é obrigatória" });
    }

    const template = await DB.selectOne("templates_globais", { id: templateId, ativo: true }, null);
    if (!template) return res.status(404).json({ erro: "Modelo não encontrado" });

    let operadorNome = null;
    if (req.userId) {
      try {
        const u = await DB.selectOne("usuarios", { id: req.userId }, tenantId);
        operadorNome = u?.nome || null;
      } catch (_) {}
    }

    const sugestao = await DB.insert("template_sugestoes", {
      tenant_id: tenantId,
      template_global_id: templateId,
      tipo: tipo || "melhoria",
      mensagem: mensagem.trim(),
      status: "pendente",
      criado_por: req.userId || null,
      criado_por_nome: operadorNome,
    }, tenantId);

    res.status(201).json({
      ok: true,
      sugestao,
      mensagem: "Sugestão registrada. Nossa equipe vai avaliar em breve.",
    });
  } catch (err) {
    console.error("❌ Erro ao registrar sugestão:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// registrarEvento — grava um item na timeline da OS. Chamado sempre que
// algo relevante muda (criação, add/remove de item, aplicação, etc).
// Falha silenciosa: se der erro, loga mas não quebra o fluxo principal.
// ─────────────────────────────────────────────────────────────────────────
async function registrarEvento(tenantId, chamadoId, tipo, descricao, dados, usuario) {
  try {
    await DB.insert("chamado_eventos", {
      tenant_id: tenantId,
      chamado_id: chamadoId,
      tipo,
      descricao,
      dados: dados || null,
      criado_por: usuario?.id || null,
      criado_por_nome: usuario?.nome || null,
    }, tenantId);
  } catch (err) {
    console.warn("⚠ Falha ao registrar evento (não bloqueante):", err.message);
  }
}

// Helper para pegar nome+email+id do usuário atual de forma reutilizável.
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

// ─────────────────────────────────────────────────────────────────────────
// calcularPercentualConclusao — média simples dos itens ativos.
// Material: aplicado/planejado, ou 1 se status='nao_aplicado'.
// Serviço:  1 se tem apontamento, senão 0.
// Itens cancelados não entram na conta.
// Retorna 0 quando não há itens ativos.
// ─────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────
// calcularHorasApontadasItem — soma as horas de todas as sessões ativas
// de um item de serviço. Retorna { total, porCategoria }.
// ─────────────────────────────────────────────────────────────────────────
async function calcularHorasApontadasItem(chamadoItemId, tenantId) {
  const todas = await DB.select("chamado_apontamentos", { tenant_id: tenantId }, tenantId);
  const ativas = todas.filter(a =>
    String(a.chamado_item_id) === String(chamadoItemId)
    && a.status === "ativo"
  );

  const soma = (campo) => ativas.reduce((s, a) => s + (parseFloat(a[campo]) || 0), 0);
  const diurnas = soma("horas_normais_diurnas");
  const noturnas = soma("horas_normais_noturnas");
  const excepcionais = soma("horas_excepcionais");
  const extrasDiurnas = soma("horas_extras_diurnas");
  const extrasNoturnas = soma("horas_extras_noturnas");

  const total = diurnas + noturnas + excepcionais + extrasDiurnas + extrasNoturnas;

  return {
    total: Number(total.toFixed(2)),
    diurnas: Number(diurnas.toFixed(2)),
    noturnas: Number(noturnas.toFixed(2)),
    excepcionais: Number(excepcionais.toFixed(2)),
    extras_diurnas: Number(extrasDiurnas.toFixed(2)),
    extras_noturnas: Number(extrasNoturnas.toFixed(2)),
    totalSessoes: ativas.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// servicoEstaConcluido — regra híbrida (decisão "C"):
//   1. Marcação manual (servico_concluido_manual = true), OU
//   2. Soma de horas apontadas ≥ horas planejadas
//
// Horas planejadas = qtd_pessoas_planejada × duração prevista. Se a
// duração prevista não está preenchida, considera as horas já apontadas
// suficientes se houver pelo menos 1 sessão ativa (fallback seguro).
// ─────────────────────────────────────────────────────────────────────────
function horasPlanejadasServico(item) {
  if (!item.data_inicio_prevista || !item.data_fim_prevista) return null;
  const diffMs = new Date(item.data_fim_prevista) - new Date(item.data_inicio_prevista);
  if (isNaN(diffMs) || diffMs <= 0) return null;
  const horas = diffMs / 3600000;
  return horas * (Number(item.qtd_pessoas_planejada) || 1);
}

async function servicoEstaConcluido(item, tenantId) {
  if (item.servico_concluido_manual) return true;

  const apontado = await calcularHorasApontadasItem(item.id, tenantId);
  const planejado = horasPlanejadasServico(item);

  if (planejado == null) {
    // Sem janela prevista — considera concluído se tem pelo menos 1 sessão
    return apontado.totalSessoes > 0;
  }
  return apontado.total >= planejado;
}

async function calcularPercentualConclusao(chamadoId, tenantId) {
  const itens = await DB.select("chamado_itens", { chamado_id: chamadoId, tenant_id: tenantId }, tenantId);
  const ativos = itens.filter(it => it.status !== "cancelado");
  if (ativos.length === 0) return 0;

  let soma = 0;
  for (const it of ativos) {
    if (it.tipo === "material") {
      if (it.status_aplicacao === "nao_aplicado") { soma += 1; continue; }
      const plan = parseFloat(it.quantidade) || 0;
      const apl = parseFloat(it.quantidade_aplicada) || 0;
      soma += plan > 0 ? Math.min(1, apl / plan) : 0;
    } else {
      // Serviço: híbrido (manual OU horas ≥ planejado)
      const concluido = await servicoEstaConcluido(it, tenantId);
      if (concluido) {
        soma += 1;
      } else {
        // Contribuição parcial proporcional às horas já apontadas
        const apontado = await calcularHorasApontadasItem(it.id, tenantId);
        const planejado = horasPlanejadasServico(it);
        if (planejado && planejado > 0) {
          soma += Math.min(0.99, apontado.total / planejado);
        }
        // Se não tem planejado, fica 0 (não dá pra medir parcial)
      }
    }
  }
  return Math.round((soma / ativos.length) * 100);
}

// ─────────────────────────────────────────────────────────────────────────
// calcularSessaoAPartirDeHorarios — distribui as horas de uma sessão nas
// 5 categorias (normais diurnas/noturnas + extras diurnas/noturnas +
// excepcionais), consultando a jornada configurada do tenant.
//
// Algoritmo:
//  1. Se o dia é feriado OU regra do dia = 'excepcional' → tudo excepcional
//  2. Senão, itera minuto a minuto:
//     - pula intervalo (se descontar_intervalo=true)
//     - classifica diurno (5h-22h) vs noturno (22h-5h)
//     - classifica normal (dentro da janela da jornada) vs extra (fora)
//
// Retorna null se:
//   - fim <= inicio
//   - sessão cruza mais de 24h
// ─────────────────────────────────────────────────────────────────────────
function formatYYYYMMDD(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function calcularSessaoAPartirDeHorarios(inicioStr, fimStr, pessoas, jornada, feriados) {
  const inicio = new Date(inicioStr);
  const fim = new Date(fimStr);
  if (isNaN(inicio) || isNaN(fim) || fim <= inicio) return null;

  const totalMin = Math.floor((fim - inicio) / 60000);
  if (totalMin <= 0 || totalMin > 24 * 60) return null;

  // ── Detecta dia excepcional (usa a data do INÍCIO) ──
  const dia = inicio.getDay();
  const camposRegra = ["regra_domingo", "regra_segunda", "regra_terca",
                       "regra_quarta", "regra_quinta", "regra_sexta", "regra_sabado"];
  const regraDia = jornada?.[camposRegra[dia]] || "normal";
  const dataStr = formatYYYYMMDD(inicio);
  const ehFeriado = (feriados || []).some(f => (f.data || "").slice(0, 10) === dataStr);
  const ehExcepcional = regraDia === "excepcional" || ehFeriado;

  // ── Itera minuto a minuto ──
  let minDiurnasNormal = 0, minNoturnasNormal = 0;
  let minDiurnasExtra = 0, minNoturnasExtra = 0;
  let minExcepcionais = 0;
  let minIntervaloDescontado = 0;

  const cursor = new Date(inicio);
  for (let i = 0; i < totalMin; i++) {
    const minDia = cursor.getHours() * 60 + cursor.getMinutes();

    // Pula intervalo
    if (jornada?.possui_intervalo && jornada?.descontar_intervalo
        && jornada.intervalo_inicio_min != null && jornada.intervalo_fim_min != null
        && minDia >= jornada.intervalo_inicio_min && minDia < jornada.intervalo_fim_min) {
      minIntervaloDescontado++;
      cursor.setMinutes(cursor.getMinutes() + 1);
      continue;
    }

    if (ehExcepcional) {
      minExcepcionais++;
    } else {
      const ehNoturno = minDia >= 1320 || minDia < 300; // 22h-5h
      const foraDaJanela = jornada
        ? (minDia < jornada.hora_inicio_min || minDia >= jornada.hora_fim_min)
        : false;

      if (foraDaJanela) {
        if (ehNoturno) minNoturnasExtra++;
        else minDiurnasExtra++;
      } else {
        if (ehNoturno) minNoturnasNormal++;
        else minDiurnasNormal++;
      }
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  const h = (min) => Number((min / 60).toFixed(2));

  return {
    normais_diurnas:  h(minDiurnasNormal),
    normais_noturnas: h(minNoturnasNormal),
    extras_diurnas:   h(minDiurnasExtra),
    extras_noturnas:  h(minNoturnasExtra),
    excepcionais:     h(minExcepcionais),
    total:            h(minDiurnasNormal + minNoturnasNormal + minDiurnasExtra
                        + minNoturnasExtra + minExcepcionais),
    total_com_intervalo: h(totalMin),
    minutos_intervalo_descontados: minIntervaloDescontado,
    eh_excepcional:   ehExcepcional,
    regra_dia:        regraDia,
    eh_feriado:       ehFeriado,
    pessoas:          Number(pessoas) || 1,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// POST /api/cotacoes/chamados/:id/cancelar
//
// Cancela uma OS com justificativa obrigatória. OS cancelada é imutável
// (mesmos guards das concluídas). Não apaga nada — só marca o estado.
// ─────────────────────────────────────────────────────────────────────────
router.post("/chamados/:id/cancelar", tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id: chamadoId } = req.params;
  const { motivo } = req.body;

  try {
    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ erro: "motivo do cancelamento é obrigatório" });
    }

    const os = await DB.selectOne("chamados", { id: chamadoId, tenant_id: tenantId }, tenantId);
    if (!os) return res.status(404).json({ erro: "OS não encontrada" });
    if ((os.tipo_documento || "os") !== "os") {
      return res.status(400).json({ erro: "Só Ordens de Serviço podem ser canceladas por aqui" });
    }
    if (os.concluida_em) {
      return res.status(400).json({ erro: `${os.numero} já está concluída — não pode ser cancelada` });
    }
    if (os.cancelada_em) {
      return res.status(400).json({ erro: `${os.numero} já está cancelada` });
    }

    const u = await usuarioAtual(req, tenantId);

    await DB.update("chamados", chamadoId, {
      status: "cancelada",
      cancelada_em: new Date().toISOString(),
      cancelada_por: u.id,
      cancelada_por_nome: u.nome,
      motivo_cancelamento: motivo.trim(),
    }, tenantId);

    await registrarEvento(
      tenantId, chamadoId, "cancelamento",
      `OS cancelada. Motivo: ${motivo.trim()}`,
      { motivo: motivo.trim() },
      u
    );

    const atualizada = await DB.selectOne("chamados", { id: chamadoId }, tenantId);
    res.json({ ok: true, chamado: atualizada, mensagem: `${os.numero} cancelada` });
  } catch (err) {
    console.error("❌ Erro ao cancelar OS:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/cotacoes/chamados/:id/eventos
//
// Timeline da OS, ordem cronológica decrescente (mais recente primeiro).
// ─────────────────────────────────────────────────────────────────────────
router.get("/chamados/:id/eventos", tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id: chamadoId } = req.params;
  try {
    const eventos = await DB.select("chamado_eventos", { chamado_id: chamadoId, tenant_id: tenantId }, tenantId);
    eventos.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
    res.json(eventos);
  } catch (err) {
    console.error("❌ Erro ao listar eventos:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/cotacoes/chamados/:id/percentual
//
// Devolve o % de conclusão calculado. Útil pro frontend atualizar o badge
// sem precisar baixar todos os itens.
// ─────────────────────────────────────────────────────────────────────────
router.get("/chamados/:id/percentual", tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id: chamadoId } = req.params;
  try {
    const percentual = await calcularPercentualConclusao(chamadoId, tenantId);
    res.json({ percentual });
  } catch (err) {
    console.error("❌ Erro ao calcular percentual:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/cotacoes/chamados/:id/servicos/:itemId/apontamentos
//
// Lista todas as sessões ativas de um item de serviço, com resumo
// consolidado (horas por categoria, total, planejado, % de conclusão).
// ─────────────────────────────────────────────────────────────────────────
router.get("/chamados/:id/servicos/:itemId/apontamentos", tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id: chamadoId, itemId } = req.params;

  try {
    const item = await DB.selectOne("chamado_itens", { id: itemId, chamado_id: chamadoId, tenant_id: tenantId }, tenantId);
    if (!item) return res.status(404).json({ erro: "Item não encontrado" });

    const todas = await DB.select("chamado_apontamentos", { tenant_id: tenantId }, tenantId);
    let sessoes = todas
      .filter(a => String(a.chamado_item_id) === String(itemId))
      .sort((a, b) => new Date(b.lancado_em || b.criado_em) - new Date(a.lancado_em || a.criado_em));

    // Resolve o nome de quem lançou cada sessão (lancado_por é UUID;
    // gravamos só o ID no banco por questão de integridade referencial).
    // Lookup em batch pra não fazer N queries.
    const uuidsLancadores = [...new Set(sessoes.map(s => s.lancado_por).filter(Boolean))];
    if (uuidsLancadores.length > 0) {
      const usuarios = await DB.select("usuarios", { tenant_id: tenantId }, tenantId);
      const nomePorId = {};
      usuarios.forEach(u => { nomePorId[u.id] = u.nome; });
      sessoes = sessoes.map(s => ({
        ...s,
        lancado_por_nome: s.lancado_por ? (nomePorId[s.lancado_por] || null) : null,
      }));
    }

    const resumo = await calcularHorasApontadasItem(itemId, tenantId);
    const planejado = horasPlanejadasServico(item);
    const concluido = await servicoEstaConcluido(item, tenantId);

    res.json({
      sessoes,
      resumo: {
        ...resumo,
        horas_planejadas: planejado != null ? Number(planejado.toFixed(2)) : null,
        servico_concluido: concluido,
        servico_concluido_manual: !!item.servico_concluido_manual,
        servico_concluido_em: item.servico_concluido_em,
        servico_concluido_por_nome: item.servico_concluido_por_nome,
      },
    });
  } catch (err) {
    console.error("❌ Erro ao listar apontamentos:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUT /api/cotacoes/chamados/apontamentos/:apontamentoId
//
// Edita uma sessão existente. Só permitido enquanto a OS não estiver
// concluída nem cancelada. Registra o evento na timeline.
// ─────────────────────────────────────────────────────────────────────────
router.put("/chamados/apontamentos/:apontamentoId", tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { apontamentoId } = req.params;
  const {
    pessoas_reais, data_inicio_real, data_fim_real,
    horas_normais_diurnas, horas_normais_noturnas, horas_excepcionais,
    horas_extras_diurnas, horas_extras_noturnas,
    participantes,   
    modo, // "auto" | "manual"
    observacoes,
  } = req.body;

  try {
    const ap = await DB.selectOne("chamado_apontamentos", { id: apontamentoId, tenant_id: tenantId }, tenantId);
    if (!ap) return res.status(404).json({ erro: "Apontamento não encontrado" });
    if (ap.status === "cancelado") return res.status(400).json({ erro: "Apontamento já cancelado" });

    const item = await DB.selectOne("chamado_itens", { id: ap.chamado_item_id, tenant_id: tenantId }, tenantId);
    const os = await DB.selectOne("chamados", { id: item?.chamado_id, tenant_id: tenantId }, tenantId);
    if (os?.concluida_em) return res.status(400).json({ erro: `${os.numero} está concluída — não aceita edições` });
    if (os?.cancelada_em) return res.status(400).json({ erro: `${os.numero} está cancelada — não aceita edições` });

    const u = await usuarioAtual(req, tenantId);

    const upd = {
      atualizado_em: new Date(),
      atualizado_por: u.id,
      atualizado_por_nome: u.nome,
    };
    if (pessoas_reais !== undefined) upd.pessoas_reais = parseInt(pessoas_reais) || 1;
    if (data_inicio_real !== undefined) upd.data_inicio_real = data_inicio_real || null;
    if (data_fim_real !== undefined) upd.data_fim_real = data_fim_real || null;
    if (observacoes !== undefined) upd.observacoes = observacoes || null;
    if (participantes !== undefined) upd.participantes = Array.isArray(participantes) ? participantes : [];

    // Modo auto: recalcula tudo a partir da janela + config do tenant.
    // Mesmo comportamento do POST — mantém consistência entre criar e editar.
    if (modo === "auto" && (data_inicio_real || upd.data_inicio_real) && (data_fim_real || upd.data_fim_real)) {
      const inicioFinal = data_inicio_real !== undefined ? data_inicio_real : ap.data_inicio_real;
      const fimFinal = data_fim_real !== undefined ? data_fim_real : ap.data_fim_real;
      const pessoasFinal = pessoas_reais !== undefined ? parseInt(pessoas_reais) : ap.pessoas_reais;

      const jornadas = await DB.select("tenant_jornadas", { tenant_id: tenantId, ativo: true }, tenantId);
      const jornada = jornadas.find(j => j.padrao) || jornadas[0] || null;
      const feriados = await DB.select("tenant_feriados", { tenant_id: tenantId }, tenantId);

      if (!jornada) {
        return res.status(400).json({ erro: "Sem jornada configurada — edite em modo manual" });
      }

      const calc = calcularSessaoAPartirDeHorarios(inicioFinal, fimFinal, pessoasFinal, jornada, feriados);
      if (!calc) {
        return res.status(400).json({ erro: "Janela inválida para cálculo automático" });
      }

      upd.horas_normais_diurnas = calc.normais_diurnas;
      upd.horas_normais_noturnas = calc.normais_noturnas;
      upd.horas_excepcionais = calc.excepcionais;
      upd.horas_extras_diurnas = calc.extras_diurnas;
      upd.horas_extras_noturnas = calc.extras_noturnas;
      upd.calculo_automatico = true;
    } else {
      if (horas_normais_diurnas !== undefined) upd.horas_normais_diurnas = parseFloat(horas_normais_diurnas) || 0;
      if (horas_normais_noturnas !== undefined) upd.horas_normais_noturnas = parseFloat(horas_normais_noturnas) || 0;
      if (horas_excepcionais !== undefined) upd.horas_excepcionais = parseFloat(horas_excepcionais) || 0;
      if (horas_extras_diurnas !== undefined) upd.horas_extras_diurnas = parseFloat(horas_extras_diurnas) || 0;
      if (horas_extras_noturnas !== undefined) upd.horas_extras_noturnas = parseFloat(horas_extras_noturnas) || 0;
      if (modo === "manual") upd.calculo_automatico = false;
    }

    const atualizado = await DB.update("chamado_apontamentos", apontamentoId, upd, tenantId);

    await registrarEvento(
      tenantId, item.chamado_id, "apontamento_editado",
      `Sessão editada em "${item.item_nome}"`,
      { apontamento_id: apontamentoId },
      u
    );

    const resumo = await calcularHorasApontadasItem(ap.chamado_item_id, tenantId);
    res.json({ ok: true, apontamento: atualizado, resumo });
  } catch (err) {
    console.error("❌ Erro ao editar apontamento:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// DELETE /api/cotacoes/chamados/apontamentos/:apontamentoId
//
// Soft delete — marca como cancelado, não apaga. Histórico preservado.
// ─────────────────────────────────────────────────────────────────────────
router.delete("/chamados/apontamentos/:apontamentoId", tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { apontamentoId } = req.params;
  const { motivo } = req.body || {};

  try {
    const ap = await DB.selectOne("chamado_apontamentos", { id: apontamentoId, tenant_id: tenantId }, tenantId);
    if (!ap) return res.status(404).json({ erro: "Apontamento não encontrado" });
    if (ap.status === "cancelado") return res.status(400).json({ erro: "Apontamento já cancelado" });

    const item = await DB.selectOne("chamado_itens", { id: ap.chamado_item_id, tenant_id: tenantId }, tenantId);
    const os = await DB.selectOne("chamados", { id: item?.chamado_id, tenant_id: tenantId }, tenantId);
    if (os?.concluida_em) return res.status(400).json({ erro: `${os.numero} está concluída — não aceita edições` });
    if (os?.cancelada_em) return res.status(400).json({ erro: `${os.numero} está cancelada — não aceita edições` });

    const u = await usuarioAtual(req, tenantId);

    await DB.update("chamado_apontamentos", apontamentoId, {
      status: "cancelado",
      cancelado_em: new Date(),
      cancelado_por: u.id,
      cancelado_por_nome: u.nome,
      motivo_cancelamento: motivo || "Cancelada pelo usuário",
    }, tenantId);

    await registrarEvento(
      tenantId, item.chamado_id, "apontamento_cancelado",
      `Sessão cancelada em "${item.item_nome}"${motivo ? ` — motivo: ${motivo}` : ""}`,
      { apontamento_id: apontamentoId },
      u
    );

    const resumo = await calcularHorasApontadasItem(ap.chamado_item_id, tenantId);
    res.json({ ok: true, resumo });
  } catch (err) {
    console.error("❌ Erro ao cancelar apontamento:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUT /api/cotacoes/chamados/:id/servicos/:itemId/concluir-manual
//
// Marca o serviço como concluído manualmente, mesmo que a soma de horas
// esteja abaixo do planejado (o técnico sabe que acabou antes).
// Body: { concluido: true|false }
// ─────────────────────────────────────────────────────────────────────────
router.put("/chamados/:id/servicos/:itemId/concluir-manual", tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id: chamadoId, itemId } = req.params;
  const { concluido } = req.body;

  try {
    const item = await DB.selectOne("chamado_itens", { id: itemId, chamado_id: chamadoId, tenant_id: tenantId }, tenantId);
    if (!item) return res.status(404).json({ erro: "Item não encontrado" });
    if (item.tipo !== "servico") return res.status(400).json({ erro: "Só se aplica a serviços" });

    const os = await DB.selectOne("chamados", { id: chamadoId, tenant_id: tenantId }, tenantId);
    if (os?.concluida_em) return res.status(400).json({ erro: `${os.numero} está concluída` });
    if (os?.cancelada_em) return res.status(400).json({ erro: `${os.numero} está cancelada` });

    const u = await usuarioAtual(req, tenantId);

    if (concluido === false) {
      await DB.update("chamado_itens", itemId, {
        servico_concluido_manual: false,
        servico_concluido_em: null,
        servico_concluido_por: null,
        servico_concluido_por_nome: null,
      }, tenantId);
      await registrarEvento(tenantId, chamadoId, "servico_reaberto",
        `Serviço "${item.item_nome}" marcado como NÃO concluído`, {}, u);
    } else {
      await DB.update("chamado_itens", itemId, {
        servico_concluido_manual: true,
        servico_concluido_em: new Date(),
        servico_concluido_por: u.id,
        servico_concluido_por_nome: u.nome,
      }, tenantId);
      await registrarEvento(tenantId, chamadoId, "servico_concluido_manual",
        `Serviço "${item.item_nome}" marcado como concluído manualmente`, {}, u);
    }

    const resumo = await calcularHorasApontadasItem(itemId, tenantId);
    const concluidoFinal = await servicoEstaConcluido(
      await DB.selectOne("chamado_itens", { id: itemId }, tenantId),
      tenantId
    );

    res.json({ ok: true, resumo, servico_concluido: concluidoFinal });
  } catch (err) {
    console.error("❌ Erro ao marcar conclusão manual:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/cotacoes/chamados/:id/servicos/:itemId/preview-apontamento
//
// Recebe inicio, fim, pessoas e devolve o cálculo automático sem gravar.
// Usado pelo frontend pra mostrar o preview no modal.
// ─────────────────────────────────────────────────────────────────────────
router.post("/chamados/:id/servicos/:itemId/preview-apontamento", tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId;
  const { id: chamadoId, itemId } = req.params;
  const { inicio, fim, pessoas } = req.body;

  try {
    if (!inicio || !fim) {
      return res.status(400).json({ erro: "inicio e fim são obrigatórios" });
    }

    const item = await DB.selectOne("chamado_itens", { id: itemId, chamado_id: chamadoId, tenant_id: tenantId }, tenantId);
    if (!item) return res.status(404).json({ erro: "Item não encontrado" });
    if (item.tipo !== "servico") return res.status(400).json({ erro: "Só se aplica a serviços" });

    // Carrega jornada + feriados
    const jornadas = await DB.select("tenant_jornadas", { tenant_id: tenantId, ativo: true }, tenantId);
    const jornada = jornadas.find(j => j.padrao) || jornadas[0] || null;
    const feriados = await DB.select("tenant_feriados", { tenant_id: tenantId }, tenantId);

    if (!jornada) {
      return res.json({
        modo: "manual",
        mensagem: "Sem jornada configurada — o apontamento será manual",
        calculo: null,
      });
    }

    const calculo = calcularSessaoAPartirDeHorarios(inicio, fim, pessoas || 1, jornada, feriados);
    if (!calculo) {
      return res.status(400).json({ erro: "Janela inválida (fim deve ser maior que início, máx 24h)" });
    }

    res.json({ modo: "auto", calculo });
  } catch (err) {
    console.error("❌ Erro no preview de apontamento:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;