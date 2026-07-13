// components/relatorio/TelaRelatorioNova.jsx
import { useState } from "react";

const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const statusTarefaCfg = {
  pendente:    { l:"Pendente",     c:"#64748b", bg:"#1e2535", icon:"○" },
  em_andamento:{ l:"Em andamento", c:"#3b82f6", bg:"#0f1e35", icon:"◑" },
  concluida:   { l:"Concluída",    c:"#22c55e", bg:"#0f2f1a", icon:"●" },
  cancelada:   { l:"Cancelada",    c:"#ef4444", bg:"#2d1515", icon:"✕" },
};
const prioridadeTarefaCfg = {
  alta:  { l:"Alta",  c:"#ef4444" },
  media: { l:"Média", c:"#f59e0b" },
  baixa: { l:"Baixa", c:"#22c55e" },
};

export default function TelaRelatorioNova({
  chamados,
  cotacoes,
  fornecedores,
  equipamentos,
  onAbrirPlano,
  tarefas = [],
  notasPeriodo = {},
  setNota = () => {},
  C,
  s,
  fmtBRL,
  fmtD,
}) {
  // ══════════════════════════════════════════════════
  // ESTADOS (exatamente iguais ao original)
  // ══════════════════════════════════════════════════

  const now = new Date();
  const [periodo, setPeriodo] = useState("mes");
  const [mesSel, setMesSel] = useState(now.getMonth());
  const [anoSel, setAnoSel] = useState(now.getFullYear());
  const [swotIA, setSwotIA] = useState(null);
  const [loadingSwot, setLoadingSwot] = useState(false);
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const [editandoNota, setEditandoNota] = useState(null);
  const [textoNota, setTextoNota] = useState("");

  // ══════════════════════════════════════════════════
  // HELPERS (copiados do original)
  // ══════════════════════════════════════════════════

  const mesesDoPeriodo = () => {
    if (periodo === "mes") return [mesSel];
    if (periodo === "t1") return [0, 1, 2];
    if (periodo === "t2") return [3, 4, 5];
    if (periodo === "t3") return [6, 7, 8];
    if (periodo === "t4") return [9, 10, 11];
    if (periodo === "ano") return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    return [mesSel];
  };

  const labelPeriodo = () => {
    if (periodo === "mes") return `${MESES_PT[mesSel]} ${anoSel}`;
    if (periodo === "t1") return `1º Trimestre ${anoSel}`;
    if (periodo === "t2") return `2º Trimestre ${anoSel}`;
    if (periodo === "t3") return `3º Trimestre ${anoSel}`;
    if (periodo === "t4") return `4º Trimestre ${anoSel}`;
    if (periodo === "ano") return `Ano ${anoSel}`;
    return "";
  };

  // ── FUNÇÃO calcSavings (copiada do original) ──
  const getMenor = (fs) => {
    const vs = fs.filter((f) => f.valor != null).map((f) => f.valor);
    return vs.length ? Math.min(...vs) : null;
  };
  const getMaior = (fs) => {
    const vs = fs.filter((f) => f.valor != null).map((f) => f.valor);
    return vs.length ? Math.max(...vs) : null;
  };

  const calcSavings = (chamados, cotacoes) => {
    return chamados
      .filter((c) => c.status === "finalizado" && c.valorAprovado)
      .map((ch) => {
        const cot = cotacoes.find((c) => c.chamadoId === ch.id);
        const fs = cot?.fornecedores || [];
        const menor = getMenor(fs);
        const maior = getMaior(fs);
        const savingA = maior != null && menor != null && maior !== menor ? maior - menor : 0;
        const savingB =
          ch.valorNegociado != null && ch.valorAprovado != null ? ch.valorAprovado - ch.valorNegociado : 0;
        const valorPago = ch.valorNegociado ?? ch.valorAprovado;
        return { ...ch, cot, menor, maior, savingA, savingB, savingTotal: savingA + savingB, valorPago };
      });
  };

  // ══════════════════════════════════════════════════
  // DADOS DO PERÍODO (igual ao original)
  // ══════════════════════════════════════════════════

  const finalizados = chamados.filter((c) => {
    const d = new Date(c.abertura);
    return (
      c.status === "finalizado" &&
      c.valorAprovado &&
      mesesDoPeriodo().includes(d.getMonth()) &&
      d.getFullYear() === anoSel
    );
  });
  const totalGasto = finalizados.reduce((s, c) => s + (c.valorNegociado ?? c.valorAprovado), 0);

  const savings = calcSavings(finalizados, cotacoes);
  const savingA = savings.reduce((s, c) => s + c.savingA, 0);
  const savingB = savings.reduce((s, c) => s + c.savingB, 0);
  const savingTotal = savingA + savingB;

  const compradores = {};
  finalizados.forEach((c) => {
    const k = c.aprovadoPor || "Não informado";
    if (!compradores[k]) compradores[k] = { nome: k, ordens: 0, savingB: 0, leadTotal: 0, leadQtd: 0 };
    compradores[k].ordens++;
    compradores[k].savingB += savings.find((s) => s.id === c.id)?.savingB || 0;
    if (c.leadTime) {
      compradores[k].leadTotal += c.leadTime;
      compradores[k].leadQtd++;
    }
  });
  const rankCompradores = Object.values(compradores).sort((a, b) => b.savingB - a.savingB);

  const fornPeriodo = {};
  cotacoes.forEach((cot) => {
    const ch = chamados.find((c) => c.id === cot.chamadoId);
    if (!ch) return;
    const d = new Date(ch.abertura);
    if (!mesesDoPeriodo().includes(d.getMonth()) || d.getFullYear() !== anoSel) return;
    cot.fornecedores.forEach((f) => {
      if (!fornPeriodo[f.nome]) fornPeriodo[f.nome] = { nome: f.nome, cotacoes: 0, respostas: 0, vitorias: 0 };
      fornPeriodo[f.nome].cotacoes++;
      if (f.status === "respondido") fornPeriodo[f.nome].respostas++;
      if (ch.fornecedorAprovado === f.nome) fornPeriodo[f.nome].vitorias++;
    });
  });
  const rankForn = Object.values(fornPeriodo)
    .sort((a, b) => b.respostas - a.respostas)
    .slice(0, 5);

  const alertasPeriodo = [
    finalizados.filter((c) => c.urgencia === "alta").length > 2
      ? {
          sev: "alta",
          txt: `${finalizados.filter((c) => c.urgencia === "alta").length} compras de emergência no período — avaliar planejamento de manutenção preventiva`,
        }
      : null,
    savingTotal < totalGasto * 0.05 && finalizados.length > 2
      ? { sev: "media", txt: "Saving abaixo de 5% do gasto — aumentar número de fornecedores por cotação" }
      : null,
    rankForn.some((f) => f.respostas / f.cotacoes < 0.5)
      ? { sev: "media", txt: `Fornecedores com baixa taxa de resposta no período — revisar cadastro` }
      : null,
  ].filter(Boolean);

  const score = Math.min(
    100,
    Math.max(
      0,
      70 +
        (savingTotal > totalGasto * 0.08 ? 15 : savingTotal > totalGasto * 0.04 ? 8 : 0) -
        alertasPeriodo.filter((a) => a.sev === "alta").length * 12 -
        alertasPeriodo.filter((a) => a.sev === "media").length * 6 +
        rankForn.filter((f) => f.respostas / f.cotacoes >= 0.8).length * 3
    )
  );
  const scoreCfg = score >= 80 ? { c: C.success, l: "Excelente" } : score >= 60 ? { c: C.warn, l: "Atenção" } : { c: "#ef4444", l: "Crítico" };

  // ── SWOT ──
  const gerarSWOT = () => {
    setLoadingSwot(true);
    // ... mantido igual ao original (usei a versão com fallback local)
    setTimeout(() => {
      setSwotIA({
        forcas: [
          `Saving total de ${fmtBRL(savingTotal)} gerado no período (${
            savingTotal > 0 ? ((savingTotal / Math.max(totalGasto + savingTotal, 1)) * 100).toFixed(1) : 0
          }% de economia)`,
          `${finalizados.length} ordens finalizadas com rastreabilidade completa`,
          `${rankForn.filter((f) => f.respostas / f.cotacoes >= 0.8).length} fornecedores com alta taxa de resposta`,
        ],
        fraquezas: [
          finalizados.filter((c) => c.urgencia === "alta").length > 1
            ? `${finalizados.filter((c) => c.urgencia === "alta").length} compras de emergência indicam gargalo em planejamento preventivo`
            : "Histórico de compras ainda em construção — dados insuficientes para benchmarks precisos",
          savingB < savingTotal * 0.3
            ? "Baixo aproveitamento da negociação — saving B representa menos de 30% do total"
            : "Concentração de saving em poucos compradores — distribuição de competência desigual",
          rankForn.length < 3
            ? "Poucos fornecedores avaliados no período — base de comparação limitada"
            : "Alguns fornecedores com taxa de resposta abaixo do ideal",
        ],
        oportunidades: [
          "Benchmark de rede QuotaFlow indica potencial de redução em itens de prateleira",
          "Expansão da base de fornecedores para itens com fonte única reduz risco e cria competição",
          "Automatização do disparo de cotações recorrentes para itens de reposição regular",
        ],
        ameacas: [
          "Variação de preço em insumos industriais acima da inflação geral no período",
          "Concentração de gasto em poucos fornecedores aumenta exposição a riscos externos",
          alertasPeriodo.length > 0 ? alertasPeriodo[0].txt : "Sazonalidade de demanda pode pressionar lead times nos próximos meses",
        ],
      });
      setLoadingSwot(false);
    }, 1200);
  };

  const exportarPDF = () => {
    setGerandoRelatorio(true);
    setTimeout(() => {
      window.print();
      setGerandoRelatorio(false);
    }, 300);
  };

  const recomendacoes = [
    savingB < savingTotal * 0.3
      ? {
          txt: "Treinar compradores em técnicas de negociação",
          detalhe: "Saving de negociação abaixo de 30% do total — realizar workshop de negociação com equipe de compras",
          prazo: 30,
          prioridade: "alta",
        }
      : {
          txt: "Documentar boas práticas de negociação",
          detalhe: "Registrar casos de maior saving para replicar abordagem em outras compras",
          prazo: 45,
          prioridade: "media",
        },
    rankForn.some((f) => f.respostas / f.cotacoes < 0.6)
      ? {
          txt: "Remover fornecedores com baixa taxa de resposta",
          detalhe: "Identificar fornecedores com taxa <60% e prospectar ao menos 2 substitutos por categoria afetada",
          prazo: 21,
          prioridade: "alta",
        }
      : {
          txt: "Expandir base de fornecedores homologados",
          detalhe: "Prospectar 1 fornecedor alternativo para cada item com apenas 1 cotação recebida no período",
          prazo: 30,
          prioridade: "media",
        },
    finalizados.filter((c) => c.urgencia === "alta").length > 1
      ? {
          txt: "Revisar calendário de manutenção preventiva",
          detalhe: `${finalizados.filter((c) => c.urgencia === "alta").length} compras de emergência no período indicam falha em preventiva — revisar plano de manutenção`,
          prazo: 14,
          prioridade: "alta",
        }
      : {
          txt: "Avaliar contratos de fornecimento recorrente",
          detalhe: "Identificar itens comprados 3+ vezes ao ano e negociar contrato de fornecimento com preço fixo",
          prazo: 60,
          prioridade: "baixa",
        },
  ];

  const fmtMes = labelPeriodo();
  const corScore = scoreCfg.c;

  // ══════════════════════════════════════════════════
  // RENDERIZAÇÃO (mesmo JSX do original)
  // ══════════════════════════════════════════════════

  return (
    <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #relatorio-executivo, #relatorio-executivo * { visibility: visible; }
          #relatorio-executivo { position: fixed; top:0; left:0; width:100%; background:white !important; color:#111 !important; padding:32px; }
          .no-print { display: none !important; }
          @page { margin: 1.5cm; }
        }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* Header controles — não imprime */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>GESTÃO ESTRATÉGICA</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Relatório Executivo de Suprimentos</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 4 }}>
            {[
              { id: "mes", l: "Mês" },
              { id: "t1", l: "T1" },
              { id: "t2", l: "T2" },
              { id: "t3", l: "T3" },
              { id: "t4", l: "T4" },
              { id: "ano", l: "Anual" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodo(p.id)}
                style={{
                  background: periodo === p.id ? C.accent : "transparent",
                  border: "none",
                  borderRadius: 5,
                  padding: "5px 10px",
                  color: periodo === p.id ? "#fff" : C.muted,
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: periodo === p.id ? 600 : 400,
                  transition: "all .1s",
                }}
              >
                {p.l}
              </button>
            ))}
          </div>

          {periodo === "mes" && (
            <select
              value={mesSel}
              onChange={(e) => setMesSel(parseInt(e.target.value))}
              style={{
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "7px 12px",
                color: C.text,
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
                cursor: "pointer",
                marginBottom: 0,
              }}
            >
              {MESES_PT.map((m, i) => (
                <option key={i} value={i}>
                  {m}
                </option>
              ))}
            </select>
          )}

          <select
            value={anoSel}
            onChange={(e) => setAnoSel(parseInt(e.target.value))}
            style={{
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: "7px 12px",
              color: C.text,
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
              cursor: "pointer",
              width: 90,
              marginBottom: 0,
            }}
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            onClick={gerarSWOT}
            disabled={loadingSwot}
            style={{
              background: loadingSwot ? C.surface : "#7c3aed",
              border: `1px solid ${loadingSwot ? C.border : "#7c3aed"}`,
              borderRadius: 6,
              padding: "8px 14px",
              color: loadingSwot ? C.muted : "white",
              fontSize: 12,
              cursor: loadingSwot ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: loadingSwot ? 0.5 : 1,
            }}
          >
            {loadingSwot ? (
              <span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>⟳</span>
            ) : (
              "🤖"
            )}
            {loadingSwot ? "Gerando..." : "SWOT com IA"}
          </button>

          <button
            onClick={() => onAbrirPlano(recomendacoes, fmtMes)}
            style={{
              background: "#0891b2",
              border: "none",
              borderRadius: 6,
              padding: "8px 14px",
              color: "white",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            📋 Gerar plano de ação
          </button>

          <button
            onClick={exportarPDF}
            disabled={gerandoRelatorio}
            style={{
              background: gerandoRelatorio ? C.surface : "#238636",
              border: `1px solid ${gerandoRelatorio ? C.border : "#238636"}`,
              borderRadius: 6,
              padding: "8px 14px",
              color: gerandoRelatorio ? C.muted : "white",
              fontSize: 12,
              cursor: gerandoRelatorio ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {gerandoRelatorio ? "Preparando..." : "⬇ PDF"}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* RELATÓRIO — este div é o que vai para o PDF   */}
      {/* ═══════════════════════════════════════════════ */}
      <div id="relatorio-executivo">
        {/* Capa */}
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "28px 32px",
            marginBottom: 16,
            borderLeft: `4px solid ${C.accent}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: C.accent, letterSpacing: "0.12em", marginBottom: 8 }}>QUOTAFLOW · RELATÓRIO EXECUTIVO</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: C.text, marginBottom: 4 }}>Suprimentos & Manutenção</div>
              <div style={{ fontSize: 16, color: C.textSub }}>{fmtMes}</div>
            </div>
            <div
              style={{
                textAlign: "center",
                background: `${corScore}15`,
                border: `2px solid ${corScore}`,
                borderRadius: 12,
                padding: "16px 24px",
              }}
            >
              <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.08em", marginBottom: 4 }}>SCORE DE SAÚDE</div>
              <div style={{ fontSize: 42, fontWeight: 700, color: corScore, lineHeight: 1 }}>{score}</div>
              <div style={{ fontSize: 13, color: corScore, fontWeight: 600, marginTop: 4 }}>{scoreCfg.l}</div>
            </div>
          </div>
        </div>

        {/* 1. RESUMO EXECUTIVO */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 24px", marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 12 }}>1. RESUMO EXECUTIVO</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
            {[
              { l: "Gasto total", v: fmtBRL(totalGasto), c: C.accent },
              { l: "Saving gerado", v: fmtBRL(savingTotal), c: C.saving },
              { l: "Ordens finalizadas", v: finalizados.length, c: C.success },
              { l: "Ticket médio", v: fmtBRL(finalizados.length ? totalGasto / finalizados.length : 0), c: C.warn },
            ].map((k) => (
              <div key={k.l} style={{ background: C.bg, borderRadius: 8, padding: "12px 14px", borderLeft: `3px solid ${k.c}` }}>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{k.l.toUpperCase()}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: k.c }}>{k.v}</div>
              </div>
            ))}
          </div>
          <div
            style={{
              fontSize: 13,
              color: C.textSub,
              lineHeight: 1.8,
              background: C.bg,
              borderRadius: 8,
              padding: "12px 16px",
            }}
          >
            Em {fmtMes}, a operação de suprimentos registrou <strong style={{ color: C.text }}>{finalizados.length} ordens finalizadas</strong> com gasto total de{" "}
            <strong style={{ color: C.text }}>{fmtBRL(totalGasto)}</strong>. O sistema gerou <strong style={{ color: C.saving }}>{fmtBRL(savingTotal)} de economia</strong> — sendo {fmtBRL(savingA)} via comparação de cotações e {fmtBRL(savingB)} via negociação direta dos compradores.{" "}
            {alertasPeriodo.length > 0
              ? `Foram identificados ${alertasPeriodo.length} ponto${alertasPeriodo.length > 1 ? "s" : ""} de atenção que requerem ação.`
              : "Nenhum alerta crítico identificado no período."}
          </div>
        </div>

        {/* 2. CUSTOS E SAVINGS */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 24px", marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 14 }}>2. CUSTOS E SAVINGS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Composição do saving</div>
              {[
                { l: "Saving de cotação (menor fornecedor)", v: savingA, c: "#818cf8", pct: savingTotal ? savingA / savingTotal : 0 },
                { l: "Saving de negociação (comprador)", v: savingB, c: C.saving, pct: savingTotal ? savingB / savingTotal : 0 },
              ].map((k) => (
                <div key={k.l} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: C.textSub }}>{k.l}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: k.c }}>{fmtBRL(k.v)}</span>
                  </div>
                  <div style={{ height: 6, background: C.border, borderRadius: 3 }}>
                    <div style={{ height: "100%", background: k.c, width: `${k.pct * 100}%`, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 12, fontSize: 12, color: C.muted }}>
                Saving sobre gasto total:{" "}
                <strong style={{ color: C.saving }}>{totalGasto > 0 ? ((savingTotal / (totalGasto + savingTotal)) * 100).toFixed(1) : 0}%</strong>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Gasto por categoria</div>
              {["corretiva", "preventiva", "preditiva"].map((cat) => {
                const cfg = { corretiva: { l: "Corretiva", c: "#f87171" }, preventiva: { l: "Preventiva", c: "#60a5fa" }, preditiva: { l: "Preditiva", c: "#a78bfa" } }[cat];
                const v = finalizados
                  .filter((c) => c.categoria === cat)
                  .reduce((s, c) => s + (c.valorNegociado ?? c.valorAprovado), 0);
                return (
                  <div key={cat} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 12, color: C.textSub }}>{cfg?.l}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: cfg?.c }}>{fmtBRL(v)}</span>
                    </div>
                    <div style={{ height: 5, background: C.border, borderRadius: 3 }}>
                      <div style={{ height: "100%", background: cfg?.c, width: `${totalGasto ? (v / totalGasto) * 100 : 0}%`, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. PERFORMANCE DOS COMPRADORES */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 24px", marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 14 }}>3. PERFORMANCE DOS COMPRADORES</div>
          {rankCompradores.length === 0 ? (
            <div style={{ fontSize: 13, color: C.muted }}>Nenhum dado de comprador disponível no período.</div>
          ) : (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 80px 110px 100px 80px",
                  padding: "9px 16px",
                  background: C.bg,
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: 10,
                  color: C.muted,
                  letterSpacing: "0.07em",
                }}
              >
                <span>COMPRADOR</span>
                <span>ORDENS</span>
                <span>SAVING NEGOC.</span>
                <span>TICKET MÉDIO</span>
                <span>PRAZO MÉD.</span>
              </div>
              {rankCompradores.map((c, i) => (
                <div
                  key={c.nome}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 80px 110px 100px 80px",
                    padding: "11px 16px",
                    borderBottom: i < rankCompradores.length - 1 ? `1px solid ${C.border}22` : "none",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>#{i + 1}</span>
                    <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{c.nome}</span>
                    {i === 0 && rankCompradores.length > 1 && (
                      <span style={{
                        fontSize: 10,
                        background: `${C.success}22`,
                        border: `1px solid ${C.success}44`,
                        borderRadius: 4,
                        padding: "2px 8px",
                        color: C.success,
                        letterSpacing: "0.06em",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}>top saving</span>
                    )}
                  </div>
                  <span style={{ fontSize: 13, color: C.text }}>{c.ordens}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.saving }}>{fmtBRL(c.savingB)}</span>
                  <span style={{ fontSize: 12, color: C.textSub }}>
                    {fmtBRL(
                      c.ordens
                        ? finalizados
                            .filter((f) => f.aprovadoPor === c.nome)
                            .reduce((s, f) => s + (f.valorNegociado ?? f.valorAprovado), 0) / c.ordens
                        : 0
                    )}
                  </span>
                  <span style={{ fontSize: 12, color: C.textSub }}>{c.leadQtd ? (c.leadTotal / c.leadQtd).toFixed(1) + "d" : "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. FORNECEDORES DO PERÍODO */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 24px", marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 14 }}>4. FORNECEDORES — TOP 5 POR PARTICIPAÇÃO</div>
          {rankForn.length === 0 ? (
            <div style={{ fontSize: 13, color: C.muted }}>Nenhuma cotação registrada no período.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rankForn.map((f, i) => {
                const taxa = Math.round((f.respostas / Math.max(f.cotacoes, 1)) * 100);
                const cor = taxa >= 80 ? C.success : taxa >= 50 ? C.warn : "#ef4444";
                return (
                  <div
                    key={f.nome}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      background: C.bg,
                      borderRadius: 7,
                      padding: "10px 14px",
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, width: 20 }}>#{i + 1}</span>
                    <span style={{ fontSize: 13, color: C.text, flex: 1, fontWeight: 500 }}>{f.nome}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>{f.cotacoes} cot.</span>
                    <span style={{ fontSize: 11, color: C.muted }}>{f.respostas} resp.</span>
                    <span style={{ fontSize: 11, color: C.muted }}>{f.vitorias} pedido{f.vitorias !== 1 ? "s" : ""}</span>
                    <div style={{ width: 80, height: 6, background: C.border, borderRadius: 3 }}>
                      <div style={{ height: "100%", background: cor, width: `${taxa}%`, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: cor, width: 40, textAlign: "right" }}>{taxa}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. MATRIZ SWOT */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 24px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em" }}>5. MATRIZ SWOT — {fmtMes.toUpperCase()}</div>
            {!swotIA && <div style={{ fontSize: 11, color: C.muted }}>Clique em "Gerar SWOT com IA" para preencher automaticamente</div>}
          </div>
          {loadingSwot && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: C.muted,
                fontSize: 13,
                padding: 20,
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  border: "2px solid #7c3aed",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              Gerando análise SWOT...
            </div>
          )}
          {swotIA && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { key: "forcas", label: "FORÇAS", icon: "💪", c: C.success, bg: "#0f2f1a" },
                { key: "fraquezas", label: "FRAQUEZAS", icon: "⚠", c: "#ef4444", bg: "#2d1515" },
                { key: "oportunidades", label: "OPORTUNIDADES", icon: "🚀", c: C.accent, bg: "#0f1e35" },
                { key: "ameacas", label: "AMEAÇAS", icon: "🔴", c: C.warn, bg: "#3f2a0a" },
              ].map((q) => (
                <div key={q.key} style={{ background: q.bg, border: `1px solid ${q.c}33`, borderRadius: 8, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: q.c, letterSpacing: "0.08em", fontWeight: 700, marginBottom: 10 }}>
                    {q.icon} {q.label}
                  </div>
                  {(swotIA[q.key] || []).map((item, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 12, color: C.textSub, lineHeight: 1.5 }}>
                      <span style={{ color: q.c, flexShrink: 0 }}>•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          {!swotIA && !loadingSwot && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {["💪 FORÇAS", "⚠ FRAQUEZAS", "🚀 OPORTUNIDADES", "🔴 AMEAÇAS"].map((q) => (
                <div
                  key={q}
                  style={{
                    background: C.bg,
                    border: `1px dashed ${C.border}`,
                    borderRadius: 8,
                    padding: "14px 16px",
                    minHeight: 80,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ fontSize: 12, color: C.border }}>{q} — aguardando IA</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 6. ALERTAS E RECOMENDAÇÕES */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 24px", marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 14 }}>6. ALERTAS E RECOMENDAÇÕES PARA O PRÓXIMO MÊS</div>
          {alertasPeriodo.length === 0 ? (
            <div style={{ fontSize: 13, color: C.success }}>✅ Nenhum alerta crítico identificado. Manter o nível atual de gestão.</div>
          ) : (
            alertasPeriodo.map((a, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "10px 14px",
                  background: a.sev === "alta" ? "#2d1515" : "#3f2a0a",
                  border: `1px solid ${a.sev === "alta" ? "#ef444433" : "#f59e0b33"}`,
                  borderRadius: 7,
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{a.sev === "alta" ? "🔴" : "🟡"}</span>
                <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.6 }}>{a.txt}</div>
              </div>
            ))
          )}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.08em", marginBottom: 10 }}>TOP 3 AÇÕES PRIORITÁRIAS</div>
            {recomendacoes.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  marginBottom: 8,
                  padding: "9px 14px",
                  background: C.bg,
                  borderRadius: 6,
                  alignItems: "flex-start",
                }}
              >
                <span style={{ color: C.accent, fontWeight: 700, flexShrink: 0, fontSize: 12 }}>{i + 1}.</span>
                <div>
                  <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{r.txt}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{r.detalhe}</div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    background: `#${
                      { alta: "ef4444", media: "f59e0b", baixa: "22c55e" }[r.prioridade] || "64748b"
                    }22`,
                    border: `1px solid #${
                      { alta: "ef4444", media: "f59e0b", baixa: "22c55e" }[r.prioridade] || "64748b"
                    }44`,
                    borderRadius: 4,
                    padding: "2px 8px",
                    color: `#${{ alta: "ef4444", media: "f59e0b", baixa: "22c55e" }[r.prioridade] || "64748b"}`,
                    letterSpacing: "0.06em",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    marginLeft: "auto",
                  }}
                >
                  {r.prazo}d
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 7. SCORE DE SAÚDE HISTÓRICO — mês a mês do ano */}
        {(() => {
          const historico = MESES_PT.map((nomeMes, mesIdx) => {
            const fin = chamados.filter((c) => {
              const d = new Date(c.abertura);
              return c.status === "finalizado" && c.valorAprovado && d.getMonth() === mesIdx && d.getFullYear() === anoSel;
            });
            if (!fin.length) return { mes: nomeMes.slice(0, 3), mesIdx, score: null, nota: null };
            const gasto = fin.reduce((s, c) => s + (c.valorNegociado ?? c.valorAprovado), 0);
            const sv = calcSavings(fin, cotacoes);
            const svB = sv.reduce((s, c) => s + c.savingB, 0);
            const svT = sv.reduce((s, c) => s + c.savingTotal, 0);
            const urgAlta = fin.filter((c) => c.urgencia === "alta").length;
            const sc = Math.min(
              100,
              Math.max(0, 70 + (svT > gasto * 0.08 ? 15 : svT > gasto * 0.04 ? 8 : 0) - (urgAlta > 2 ? 12 : urgAlta > 0 ? 4 : 0))
            );
            const chave = `${anoSel}-${String(mesIdx + 1).padStart(2, "0")}`;
            return { mes: nomeMes.slice(0, 3), mesIdx, score: Math.round(sc), nota: notasPeriodo[chave] || null, chave, gasto, svT };
          });
          const comDados = historico.filter((h) => h.score !== null);
          if (comDados.length < 2) return null;
          const maxSc = 100,
            minSc = 0;
          const W = 560,
            H = 120,
            PL = 36,
            PR = 16,
            PT = 12,
            PB = 28;
          const toX = (i, total) => PL + (i / (total - 1)) * (W - PL - PR);
          const toY = (v) => PT + (1 - (v - minSc) / (maxSc - minSc)) * (H - PT - PB);
          const pts = comDados.map((h, i) => `${toX(i, comDados.length).toFixed(1)},${toY(h.score).toFixed(1)}`).join(" ");
          return (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 24px", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 14 }}>
                7. EVOLUÇÃO DO SCORE DE SAÚDE — {anoSel}
              </div>
              <div style={{ background: C.bg, borderRadius: 8, padding: "10px 8px", marginBottom: 16 }}>
                <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
                  {[40, 60, 80, 100].map((v) => (
                    <g key={v}>
                      <line x1={PL} y1={toY(v)} x2={W - PR} y2={toY(v)} stroke={C.border} strokeWidth={0.5} />
                      <text x={PL - 4} y={toY(v) + 4} textAnchor="end" fontSize={8} fill={C.muted}>
                        {v}
                      </text>
                    </g>
                  ))}
                  <polyline points={`${toX(0, comDados.length)},${H - PB} ${pts} ${toX(comDados.length - 1, comDados.length)},${H - PB}`} fill={`${C.accent}20`} stroke="none" />
                  <polyline points={pts} fill="none" stroke={C.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {comDados.map((h, i) => {
                    const x = toX(i, comDados.length);
                    const y = toY(h.score);
                    const cor = h.score >= 80 ? C.success : h.score >= 60 ? C.warn : "#ef4444";
                    return (
                      <g key={h.mesIdx}>
                        <circle cx={x} cy={y} r={5} fill={cor} stroke={C.bg} strokeWidth={1.5} />
                        <text x={x} y={y - 9} textAnchor="middle" fontSize={9} fontWeight="bold" fill={cor}>
                          {h.score}
                        </text>
                        <text x={x} y={H - 8} textAnchor="middle" fontSize={8} fill={C.muted}>
                          {h.mes}
                        </text>
                        {h.nota && <circle cx={x + 6} cy={y - 6} r={3} fill={C.warn} title={h.nota} />}
                      </g>
                    );
                  })}
                </svg>
              </div>
              <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.08em", marginBottom: 10 }}>NOTAS DO GESTOR POR PERÍODO</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {comDados.map((h) => {
                  const cor = h.score >= 80 ? C.success : h.score >= 60 ? C.warn : "#ef4444";
                  const isEdit = editandoNota === h.chave;
                  return (
                    <div
                      key={h.mesIdx}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                        background: C.bg,
                        borderRadius: 7,
                        padding: "9px 12px",
                      }}
                    >
                      <div style={{ flexShrink: 0, textAlign: "center", minWidth: 56 }}>
                        <div style={{ fontSize: 10, color: C.muted }}>{h.mes}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: cor }}>{h.score}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        {isEdit ? (
                          <div style={{ display: "flex", gap: 8 }}>
                            <textarea
                              value={textoNota}
                              onChange={(e) => setTextoNota(e.target.value)}
                              rows={2}
                              autoFocus
                              placeholder="Descreva o que impactou o score neste mês..."
                              style={{
                                ...s.input,
                                flex: 1,
                                resize: "none",
                                fontSize: 12,
                              }}
                            />
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <button
                                onClick={() => {
                                  setNota(h.chave, textoNota);
                                  setEditandoNota(null);
                                }}
                                style={{ ...s.btn(true, "#238636"), padding: "5px 12px", fontSize: 11 }}
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setEditandoNota(null)}
                                style={{ ...s.btn(false), padding: "5px 12px", fontSize: 11 }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div
                              style={{
                                fontSize: 12,
                                color: h.nota ? C.textSub : C.border,
                                fontStyle: h.nota ? "normal" : "italic",
                              }}
                            >
                              {h.nota || "Clique para adicionar nota do gestor..."}
                            </div>
                            <button
                              onClick={() => {
                                setTextoNota(h.nota || "");
                                setEditandoNota(h.chave);
                              }}
                              style={{
                                background: "transparent",
                                border: `1px solid ${C.border}`,
                                borderRadius: 5,
                                padding: "3px 8px",
                                color: C.muted,
                                fontSize: 10,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                flexShrink: 0,
                              }}
                            >
                              ✏ Nota
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>💡 Ponto laranja no gráfico indica meses com nota do gestor</div>
            </div>
          );
        })()}

        {/* 8. AÇÕES */}
        {(() => {
          const ehMensal = periodo === "mes";
          const tarefasPeriodo = tarefas.dados
            ? tarefas.dados.filter((t) => {
                if (!t.criacao) return false;
                const d = new Date(t.criacao);
                return mesesDoPeriodo().includes(d.getMonth()) && d.getFullYear() === anoSel;
              })
            : [];
          const emCurso = tarefas.dados
            ? tarefas.dados.filter((t) => t.status === "em_andamento" || t.status === "pendente")
            : [];
          const lista = ehMensal ? emCurso : tarefasPeriodo;
          if (!lista.length && !emCurso.length) return null;
          return (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 24px", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 14 }}>
                {ehMensal ? "8. AÇÕES EM CURSO" : `8. HISTÓRICO DE AÇÕES — ${fmtMes.toUpperCase()}`}
              </div>
              {lista.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>Nenhuma ação registrada para este período.</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lista.map((t) => {
                  const stCfg = statusTarefaCfg[t.status] || { l: t.status, c: C.muted, icon: "•" };
                  const prCfg = prioridadeTarefaCfg[t.prioridade] || { l: t.prioridade, c: C.muted };
                  const ultComent = t.comentarios?.slice(-1)[0];
                  return (
                    <div
                      key={t.id}
                      style={{
                        background: C.bg,
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        padding: "11px 14px",
                        borderLeft: `3px solid ${prCfg.c}`,
                      }}
                    >
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: t.status === "concluida" ? C.muted : C.text,
                                textDecoration: t.status === "concluida" ? "line-through" : "none",
                              }}
                            >
                              {t.titulo}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                background: `${stCfg.c}22`,
                                border: `1px solid ${stCfg.c}44`,
                                borderRadius: 4,
                                padding: "2px 8px",
                                color: stCfg.c,
                                letterSpacing: "0.06em",
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {stCfg.icon} {stCfg.l}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                background: `${prCfg.c}22`,
                                border: `1px solid ${prCfg.c}44`,
                                borderRadius: 4,
                                padding: "2px 8px",
                                color: prCfg.c,
                                letterSpacing: "0.06em",
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {prCfg.l}
                            </span>
                          </div>
                          {t.responsavel && (
                            <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>
                              👤 {t.responsavel}
                              {t.prazo ? ` · Prazo: ${fmtD(t.prazo)}` : ""}
                            </div>
                          )}
                          {ultComent && (
                            <div
                              style={{
                                fontSize: 11,
                                color: C.textSub,
                                background: C.surface,
                                borderRadius: 5,
                                padding: "5px 9px",
                                marginTop: 4,
                              }}
                            >
                              <span style={{ color: C.muted }}>Último log ({fmtD(ultComent.data)}): </span>
                              {ultComent.texto}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>
                          {t.comentarios?.length > 0 && `💬 ${t.comentarios.length} log${t.comentarios.length > 1 ? "s" : ""}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div style={{ textAlign: "center", padding: "16px 0", fontSize: 11, color: C.muted }}>
          Relatório gerado automaticamente pelo QuotaFlow · {new Date().toLocaleDateString("pt-BR")} · Confidencial
        </div>
      </div>
    </div>
  );
}