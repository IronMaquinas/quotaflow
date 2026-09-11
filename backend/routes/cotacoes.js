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
  const prefix = `CHAM-${ano}-`;

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
    let itens = [];
    if (chamadoIds.length > 0) {
      itens = await DB.raw(`
        SELECT chamado_id, id, item_nome, codigo, quantidade, urgencia, categoria, tipo_item, descricao,
               item_catalogo_id, tipo, origem, status, numero_base, posicao,
               qtd_pessoas_planejada, data_inicio_prevista, data_fim_prevista, origem_os_item_id,
               quantidade_sugerida_recompra, lote_minimo_compra_snapshot, motivo_recompra
        FROM chamado_itens
        WHERE chamado_id = ANY($1) AND tenant_id = $2
        ORDER BY chamado_id, posicao NULLS LAST, id
      `, [chamadoIds, req.tenantId]);
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

    // 3b. Buscar apontamentos (execução real) dos itens de serviço — tabela
    // separada (chamado_apontamentos, migration 003) porque representa o
    // REALIZADO, distinto do PLANEJADO que já mora em chamado_itens. Sem
    // isso, o apontamento salvo só existiria na memória do navegador até o
    // próximo F5, quando pareceria ter "sumido" mesmo já estando no banco.
    const itemIds = itens.map(it => it.id);
    let apontamentos = [];
    if (itemIds.length > 0) {
      apontamentos = await DB.raw(`
        SELECT chamado_item_id, pessoas_reais, data_inicio_real, data_fim_real, horas_extras, lancado_por, lancado_em
        FROM chamado_apontamentos
        WHERE chamado_item_id = ANY($1) AND tenant_id = $2
      `, [itemIds, req.tenantId]);
    }
    const apontamentoPorItem = {};
    apontamentos.forEach(ap => { apontamentoPorItem[ap.chamado_item_id] = ap; });

    // Agrupar itens por chamado
    const itensPorChamado = {};
    itens.forEach(item => {
      if (!itensPorChamado[item.chamado_id]) {
        itensPorChamado[item.chamado_id] = [];
      }
      itensPorChamado[item.chamado_id].push({
        ...item,
        apontamento: apontamentoPorItem[item.id] || null,
        // Só faz sentido pra item de material (é o que pode virar RM).
        requisicao_material: item.tipo === "material" ? (rmPorOrigemItem[item.id] || null) : undefined
      });
    });

    // 4. Adicionar equipamento_nome e equipamento_tag
    const resultado = chamados.map(ch => ({
      ...ch,
      equipamento_nome: equipamentosPorID[ch.equipamento_id]?.nome || '—',
      equipamento_tag: equipamentosPorID[ch.equipamento_id]?.tag || '—',
      origem_os_numero: ch.origem_os_numero || null,
      // modo_programacao/data_inicio_prevista/data_fim_prevista já vêm
      // direto do spread de `ch` (colunas da migration 003 em `chamados`).
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

    const numero = await gerarNumeroChamado(req.tenantId);

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
    for (const item of itens) {
      const itemData = montarChamadoItemData(item, id, tenantId);
      const idNormalizado = normalizarIdExistente(item.id);

      if (idNormalizado !== null && idsExistentes.has(idNormalizado)) {
        const atualizado = await DB.update("chamado_itens", idNormalizado, itemData, tenantId);
        itensSalvos.push(atualizado);
      } else {
        const inserido = await DB.insert("chamado_itens", itemData, tenantId);
        itensSalvos.push(inserido);
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

// ───────────────────────────────────────────────────────────────────────
// POST /api/cotacoes/chamados/:id/apontamentos
// Grava a execução real de um item de serviço (chamado_apontamentos,
// migration 003) — distinto do planejado, que fica em chamado_itens
// (qtd_pessoas_planejada, data_inicio/fim_prevista). Substitui o fluxo
// anterior do frontend, que embutia { apontamento: {...} } dentro do item
// e mandava tudo junto pro PUT /chamados/:id genérico (esse PUT nunca leu
// esse campo — o apontamento só existia na memória do navegador até o
// próximo F5).
//
// UPSERT em vez de sempre inserir: a migration criou
// UNIQUE(chamado_item_id) porque o modal de apontamento edita um valor
// único por serviço, sem histórico de versões — reabrir e salvar de novo
// deve atualizar o mesmo registro, não duplicar nem dar erro de
// constraint. Se no futuro quiser rastrear cada edição (não só o valor
// atual), é preciso remover esse UNIQUE e inserir uma linha nova a cada
// lançamento — decisão de produto que ainda não foi tomada.
router.post("/chamados/:id/apontamentos", tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id: chamadoId } = req.params;
    const { servico_id, pessoas_reais, data_inicio_real, data_fim_real, horas_extras } = req.body;

    if (!servico_id) {
      return res.status(400).json({ erro: "servico_id é obrigatório" });
    }
    if (!pessoas_reais || pessoas_reais <= 0) {
      return res.status(400).json({ erro: "pessoas_reais é obrigatório e deve ser maior que zero" });
    }

    // Confirma que o item pertence mesmo a este chamado (e a este tenant) —
    // sem isso, um servico_id de outra OS passaria despercebido.
    const item = await DB.selectOne("chamado_itens", {
      id: servico_id, chamado_id: chamadoId, tenant_id: tenantId
    }, tenantId);
    if (!item) {
      return res.status(404).json({ erro: "Item de serviço não encontrado nesta OS" });
    }
    if (item.tipo !== "servico") {
      return res.status(400).json({ erro: "Apontamento só se aplica a itens do tipo serviço" });
    }

    // Validação de janela, espelhando a mesma regra já aplicada no
    // planejado (fim não pode ser anterior ao início).
    if (data_inicio_real && data_fim_real && new Date(data_fim_real) < new Date(data_inicio_real)) {
      return res.status(400).json({ erro: "data_fim_real não pode ser anterior a data_inicio_real" });
    }

    const dados = {
      tenant_id: tenantId,
      chamado_item_id: servico_id,
      pessoas_reais,
      data_inicio_real: data_inicio_real || null,
      data_fim_real: data_fim_real || null,
      horas_extras: horas_extras || 0,
      lancado_por: req.userId || null,
      lancado_em: new Date()
    };

    const apontamento = await DB.raw(`
      INSERT INTO chamado_apontamentos
        (tenant_id, chamado_item_id, pessoas_reais, data_inicio_real, data_fim_real, horas_extras, lancado_por, lancado_em)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (chamado_item_id) DO UPDATE SET
        pessoas_reais = EXCLUDED.pessoas_reais,
        data_inicio_real = EXCLUDED.data_inicio_real,
        data_fim_real = EXCLUDED.data_fim_real,
        horas_extras = EXCLUDED.horas_extras,
        lancado_por = EXCLUDED.lancado_por,
        lancado_em = EXCLUDED.lancado_em
      RETURNING *
    `, [dados.tenant_id, dados.chamado_item_id, dados.pessoas_reais, dados.data_inicio_real, dados.data_fim_real, dados.horas_extras, dados.lancado_por, dados.lancado_em]);

    res.json({ ok: true, apontamento: apontamento[0], mensagem: "Apontamento salvo com sucesso" });
  } catch (err) {
    console.error("❌ Erro ao salvar apontamento:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;