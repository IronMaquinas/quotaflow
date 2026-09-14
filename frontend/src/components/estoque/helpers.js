// frontend/src/components/estoque/helpers.js
//
// Funções puras e constantes da tela de Ordem de Serviço. Extraídas do
// TelaOrdemServico.jsx na Rodada 1 da quebra (arquivo tinha ~3000 linhas).
// Nada aqui depende de React, hooks, ou estado — só cálculo puro, fácil
// de testar isolado.

// ─────────────────────────────────────────────────────────────────────────
// CONSTANTES DE UI
// ─────────────────────────────────────────────────────────────────────────

export const aplicacaoCfg = {
  pendente:     { icon: "⚪", label: "Pendente",     c: "#6b7280" },
  parcial:      { icon: "🟡", label: "Parcial",      c: "#f59e0b" },
  aplicado:     { icon: "🟢", label: "Aplicado",     c: "#22c55e" },
  nao_aplicado: { icon: "⚫", label: "Não aplicado", c: "#6b7280" },
  revertido:    { icon: "🔁", label: "Revertido",    c: "#a855f7" },
};

export const estoqueCfg = {
  atende:         { icon: "🟢", label: "Estoque atende à demanda" },
  parcial:        { icon: "🟡", label: "Estoque atende parcialmente" },
  sem_estoque:    { icon: "🔴", label: "Sem estoque — necessário comprar" },
  nao_verificado: { icon: "⚪", label: "Selecione um item da lista para verificar o estoque" },
  reconhecido_sem_estoque_local: { icon: "🔵", label: "Item reconhecido — sem controle de estoque local para ele" },
};

export const urgenciaCfgMap = {
  alta:  { l: "Alta",  c: "#ef4444" },
  media: { l: "Média", c: "#f59e0b" },
  baixa: { l: "Baixa", c: "#22c55e" },
};

export const categoriaCfgMap = {
  corretiva:  { l: "Corretiva",  c: "#ef4444" },
  preventiva: { l: "Preventiva", c: "#22c55e" },
  preditiva:  { l: "Preditiva",  c: "#60a5fa" },
};

// ─────────────────────────────────────────────────────────────────────────
// DERIVAÇÕES DE ESTADO
// ─────────────────────────────────────────────────────────────────────────

export function derivarStatusAplicacao(item) {
  const planejada = Number(item.quantidade) || 0;
  const aplicada = Number(item.quantidade_aplicada) || 0;
  if (item.status_aplicacao === "nao_aplicado") return "nao_aplicado";
  if (item.status_aplicacao === "revertido") return "revertido";
  if (aplicada <= 0) return "pendente";
  if (aplicada < planejada) return "parcial";
  return "aplicado";
}

// calcularStatusPrazo — deriva o estado da OS em relação à data_fim_prevista.
// Granularidade adaptativa:
//   |diff| < 24h  → mostra em HORAS (serviços rápidos, mesmo dia)
//   24h ≤ |diff| < 7d → mostra em DIAS
//   |diff| ≥ 7d   → "No prazo" sem número
export function calcularStatusPrazo(chamado, C) {
  if (!chamado?.data_fim_prevista) return null;

  if (chamado.status === "finalizado") {
    return { tipo: "concluida", icon: "✅", c: C.success, label: "Concluída", sub: "no prazo" };
  }
  if (chamado.status === "cancelada") {
    return { tipo: "cancelada", icon: "⚫", c: C.muted, label: "Cancelada", sub: null };
  }

  const agora = new Date();
  const fim = new Date(chamado.data_fim_prevista);
  const diffMs = fim - agora;
  const diffHoras = diffMs / (1000 * 60 * 60);
  const absHoras = Math.abs(diffHoras);
  const absDias = Math.abs(diffHoras / 24);

  function fmtQtd(valorHoras) {
    if (valorHoras < 24) {
      const h = Math.max(1, Math.round(valorHoras));
      return `${h}h`;
    }
    const d = Math.round(valorHoras / 24);
    return `${d} dia${d > 1 ? "s" : ""}`;
  }

  if (diffMs < 0) {
    return { tipo: "atrasada", icon: "🔴", c: "#ef4444", label: fmtQtd(absHoras), sub: "atrasada" };
  }
  if (absHoras <= 24) {
    if (absHoras < 1) {
      const min = Math.max(1, Math.round(absHoras * 60));
      return { tipo: "atencao", icon: "🟡", c: "#f59e0b", label: `${min}min`, sub: "restante(s)" };
    }
    return { tipo: "atencao", icon: "🟡", c: "#f59e0b", label: fmtQtd(absHoras), sub: "restante(s)" };
  }
  if (absDias < 7) {
    return { tipo: "no_prazo", icon: "🟢", c: C.success, label: fmtQtd(absHoras), sub: "restante(s)" };
  }
  return { tipo: "no_prazo", icon: "🟢", c: C.success, label: "No prazo", sub: null };
}

// ─────────────────────────────────────────────────────────────────────────
// FÁBRICAS DE ITEM (modelo unificado, discriminado por `tipo`)
// ─────────────────────────────────────────────────────────────────────────

export function novoMaterial(origem) {
  return {
    id: Date.now() + Math.random(),
    tipo: "material",
    origem,
    numero_base: null,
    status: "ativo",
    item_nome: "", codigo: "", item_catalogo_id: null,
    quantidade: 1, tipo_item: "", descricao: "",
    status_estoque: "nao_verificado", saldo_disponivel: null,
    serializado: false,
  };
}

export function novoServico(origem) {
  return {
    id: Date.now() + Math.random(),
    tipo: "servico",
    origem,
    numero_base: null,
    status: "ativo",
    nome: "", descricao: "",
    qtd_pessoas_planejada: 1,
    data_inicio_prevista: "", data_fim_prevista: "",
    apontamento: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// CÁLCULOS DE TEMPO / NUMERAÇÃO
// ─────────────────────────────────────────────────────────────────────────

export function calcularHorasHomem(dataInicio, dataFim, qtdPessoas) {
  if (!dataInicio || !dataFim || !qtdPessoas) return null;
  const ini = new Date(dataInicio);
  const fim = new Date(dataFim);
  const diffMs = fim - ini;
  if (isNaN(diffMs) || diffMs <= 0) return null;
  const horasCorridas = diffMs / (1000 * 60 * 60);
  return {
    horasCorridas: Number(horasCorridas.toFixed(1)),
    horasHomem: Number((horasCorridas * qtdPessoas).toFixed(1)),
  };
}

export function computarNumeracao(itens) {
  let ultimoBase = 0;
  let contadorSufixo = 0;
  return itens.map(item => {
    if (item.origem === "planejado" && item.numero_base != null) {
      ultimoBase = item.numero_base;
      contadorSufixo = 0;
      return { ...item, numeroExibicao: String(item.numero_base) };
    }
    contadorSufixo += 1;
    return { ...item, numeroExibicao: `${ultimoBase}.${contadorSufixo}` };
  });
}

export function numerarRascunho(itens) {
  return itens.map((item, i) => ({ ...item, numeroExibicao: String(i + 1) }));
}

export function calcularJanelaAutomatica(itens) {
  const datas = itens
    .filter(it => it.tipo === "servico" && it.status !== "cancelado")
    .flatMap(it => [it.data_inicio_prevista, it.data_fim_prevista].filter(Boolean));
  if (datas.length === 0) return null;
  return {
    inicio: itens.filter(it => it.tipo === "servico" && it.data_inicio_prevista).map(it => it.data_inicio_prevista).sort()[0] || null,
    fim: itens.filter(it => it.tipo === "servico" && it.data_fim_prevista).map(it => it.data_fim_prevista).sort().slice(-1)[0] || null,
  };
}

export function janelaValida(inicio, fim) {
  if (!inicio || !fim) return true;
  return new Date(fim) >= new Date(inicio);
}

// ─────────────────────────────────────────────────────────────────────────
// DATAS
// ─────────────────────────────────────────────────────────────────────────

export function paraDatetimeLocal(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function paraISOComOffset(datetimeLocalStr) {
  if (!datetimeLocalStr) return null;
  const d = new Date(datetimeLocalStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}