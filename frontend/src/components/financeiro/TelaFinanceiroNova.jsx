// components/financeiro/TelaFinanceiroNova.jsx
import { useState } from "react";

const C = {
  bg: "#0a0e14",
  surface: "#111722",
  border: "#1e2535",
  accent: "#3b82f6",
  success: "#22c55e",
  warn: "#f59e0b",
  danger: "#ef4444",
  muted: "#64748b",
  text: "#e2e8f0",
  textSub: "#94a3b8",
  saving: "#a78bfa",
};

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const fmtBRL = (v) => (v != null ? `R$ ${Number(v).toFixed(2).replace(".", ",")}` : "—");

const catCfg = {
  corretiva: { l: "Corretiva", c: "#f87171" },
  preventiva: { l: "Preventiva", c: "#60a5fa" },
  preditiva: { l: "Preditiva", c: "#a78bfa" },
};

// Funções auxiliares (copiadas do App.jsx)
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
        ch.valorNegociado != null && ch.valorAprovado != null
          ? ch.valorAprovado - ch.valorNegociado
          : 0;
      const valorPago = ch.valorNegociado ?? ch.valorAprovado;
      return { ...ch, cot, menor, maior, savingA, savingB, savingTotal: savingA + savingB, valorPago };
    });
};

export default function TelaFinanceiroNova({ chamados, cotacoes, equipamentos }) {
  const [ano, setAno] = useState("2026");
  const [mes, setMes] = useState("todos");

  // Filtragem dos dados (igual ao original)
  const finalizados = chamados.filter((c) => c.status === "finalizado" && c.valorAprovado);

  const porPeriodo = finalizados.filter((c) => {
    const d = new Date(c.abertura);
    const okAno = String(d.getFullYear()) === ano;
    const okMes = mes === "todos" || d.getMonth() === parseInt(mes);
    return okAno && okMes;
  });

  const savings = calcSavings(porPeriodo, cotacoes);
  const totalGasto = savings.reduce((s, c) => s + (c.valorNegociado ?? c.valorAprovado), 0);
  const totalSavingA = savings.reduce((s, c) => s + c.savingA, 0);
  const totalSavingB = savings.reduce((s, c) => s + c.savingB, 0);
  const totalSaving = totalSavingA + totalSavingB;

  const top5Savings = [...savings]
    .filter((c) => c.savingTotal > 0)
    .sort((a, b) => b.savingTotal - a.savingTotal)
    .slice(0, 5);

  const compradores = {};
  savings.forEach((c) => {
    const k = c.aprovadoPor || "(não informado)";
    if (!compradores[k]) compradores[k] = { nome: k, savingA: 0, savingB: 0, total: 0, qtd: 0 };
    compradores[k].savingA += c.savingA;
    compradores[k].savingB += c.savingB;
    compradores[k].total += c.savingTotal;
    compradores[k].qtd++;
  });
  const rankCompradores = Object.values(compradores).sort((a, b) => b.total - a.total);

  const top5Lead = [...porPeriodo]
    .filter((c) => c.leadTime)
    .sort((a, b) => b.leadTime - a.leadTime)
    .slice(0, 5);
  const avgLead = porPeriodo.filter((c) => c.leadTime).reduce((s, c, _, arr) => s + c.leadTime / arr.length, 0);

  const respostas = [];
  cotacoes.forEach((cot) => {
    cot.fornecedores.forEach((f) => {
      if (f.dataResposta && cot.dataEnvio) {
        respostas.push({
          nome: f.nome,
          dias: Math.max(0, Math.floor((new Date(f.dataResposta) - new Date(cot.dataEnvio)) / 86400000)),
        });
      }
    });
  });
  const porForn = {};
  respostas.forEach((r) => {
    if (!porForn[r.nome]) porForn[r.nome] = { nome: r.nome, total: 0, qtd: 0 };
    porForn[r.nome].total += r.dias;
    porForn[r.nome].qtd++;
  });
  const rankForn = Object.values(porForn)
    .map((f) => ({ ...f, media: f.total / f.qtd }))
    .sort((a, b) => a.media - b.media)
    .slice(0, 6);

  const porMes = MESES.map((m, i) => ({
    m,
    total: finalizados
      .filter(
        (c) =>
          new Date(c.abertura).getFullYear() === parseInt(ano) &&
          new Date(c.abertura).getMonth() === i
      )
      .reduce((s, c) => s + (c.valorNegociado ?? c.valorAprovado), 0),
  }));
  const maxMes = Math.max(...porMes.map((m) => m.total), 1);

  const porCat = ["corretiva", "preventiva", "preditiva"].map((cat) => ({
    cat,
    label: catCfg[cat]?.l || cat,
    color: catCfg[cat]?.c || C.muted,
    total: porPeriodo
      .filter((c) => c.categoria === cat)
      .reduce((s, c) => s + (c.valorNegociado ?? c.valorAprovado), 0),
    qtd: porPeriodo.filter((c) => c.categoria === cat).length,
  }));

  const porEquip = equipamentos
    .map((eq) => ({
      ...eq,
      total: porPeriodo
        .filter((c) => c.equipamentoId === eq.id)
        .reduce((s, c) => s + (c.valorNegociado ?? c.valorAprovado), 0),
      qtd: porPeriodo.filter((c) => c.equipamentoId === eq.id).length,
    }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total);

  const SavingBar = ({ label, value, total, color }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: C.textSub }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{fmtBRL(value)}</span>
      </div>
      <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            background: color,
            width: `${total ? Math.min((value / total) * 100, 100) : 0}%`,
            borderRadius: 3,
            transition: "width .4s",
          }}
        />
      </div>
    </div>
  );

  return (
    <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
      {/* Header + filtros */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 22,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>
            PAINEL FINANCEIRO
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Custos de Manutenção</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {["2026", "2025"].map((y) => (
              <button
                key={y}
                onClick={() => setAno(y)}
                style={{
                  background: ano === y ? C.accent : "transparent",
                  border: `1px solid ${ano === y ? C.accent : C.border}`,
                  borderRadius: 6,
                  padding: "6px 14px",
                  color: ano === y ? "white" : C.muted,
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {y}
              </button>
            ))}
          </div>
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            style={{
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: "6px 12px",
              color: C.text,
              fontSize: 12,
              fontFamily: "inherit",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="todos">Todos os meses</option>
            {MESES.map((m, i) => (
              <option key={i} value={i}>
                {m}
              </option>
            ))}
          </select>
          <button
            onClick={() => alert("Exportação disponível na versão com backend.")}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: "6px 14px",
              color: C.textSub,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ↓ Exportar
          </button>
        </div>
      </div>

      {/* KPIs principais */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 18 }}>
        {[
          { l: "Total gasto", v: fmtBRL(totalGasto), c: C.accent },
          { l: "Ordens finalizadas", v: porPeriodo.length, c: C.success },
          { l: "Ticket médio", v: fmtBRL(porPeriodo.length ? totalGasto / porPeriodo.length : 0), c: C.warn },
          { l: "Prazo médio entrega", v: avgLead ? `${avgLead.toFixed(1)} dias` : "—", c: "#f87171" },
        ].map((k) => (
          <div
            key={k.l}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "14px 18px",
              borderLeft: `3px solid ${k.c}`,
            }}
          >
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.07em", marginBottom: 6 }}>
              {k.l.toUpperCase()}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* SAVING CARD — destaque */}
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.saving}44`,
          borderRadius: 10,
          padding: "20px 24px",
          marginBottom: 18,
          backgroundImage: `linear-gradient(135deg, #1a1535 0%, ${C.surface} 60%)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, color: C.saving, letterSpacing: "0.12em", marginBottom: 6 }}>
              💰 SAVING GERADO PELO SISTEMA
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, color: C.saving, marginBottom: 2 }}>
              {fmtBRL(totalSaving)}
            </div>
            <div style={{ fontSize: 12, color: C.textSub }}>economia total no período selecionado</div>
            <div style={{ marginTop: 16 }}>
              <SavingBar
                label="Saving de cotação (comparação de fornecedores)"
                value={totalSavingA}
                total={totalSaving}
                color="#818cf8"
              />
              <SavingBar
                label="Saving de negociação (poder de barganha do comprador)"
                value={totalSavingB}
                total={totalSaving}
                color={C.saving}
              />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 180 }}>
            {[
              { l: "Saving médio/ordem", v: fmtBRL(savings.length ? totalSaving / savings.length : 0), c: "#818cf8" },
              {
                l: "Saving sobre gasto total",
                v: totalGasto ? `${((totalSaving / (totalGasto + totalSaving)) * 100).toFixed(1)}%` : "—",
                c: C.saving,
              },
              { l: "Ordens c/ negociação", v: `${savings.filter((s) => s.savingB > 0).length} de ${savings.length}`, c: C.success },
            ].map((k) => (
              <div
                key={k.l}
                style={{
                  background: `${C.saving}10`,
                  border: `1px solid ${C.saving}22`,
                  borderRadius: 8,
                  padding: "10px 14px",
                }}
              >
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>{k.l.toUpperCase()}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: k.c }}>{k.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top 5 savings + Saving por comprador */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "18px 20px",
          }}
        >
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.08em", marginBottom: 14 }}>
            🏆 TOP 5 MAIORES SAVINGS
          </div>
          {top5Savings.length === 0 && (
            <div style={{ color: C.muted, fontSize: 12, padding: "12px 0" }}>Sem dados suficientes</div>
          )}
          {top5Savings.map((c, i) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, width: 18 }}>#{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: C.text,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.peca}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                  {c.savingA > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "#818cf8",
                        background: "#818cf811",
                        borderRadius: 3,
                        padding: "1px 6px",
                      }}
                    >
                      Cotação: {fmtBRL(c.savingA)}
                    </span>
                  )}
                  {c.savingB > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        color: C.saving,
                        background: `${C.saving}11`,
                        borderRadius: 3,
                        padding: "1px 6px",
                      }}
                    >
                      Negoc.: {fmtBRL(c.savingB)}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.saving, whiteSpace: "nowrap" }}>
                {fmtBRL(c.savingTotal)}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "18px 20px",
          }}
        >
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.08em", marginBottom: 14 }}>
            👤 SAVING POR COMPRADOR
          </div>
          {rankCompradores.length === 0 && (
            <div style={{ color: C.muted, fontSize: 12, padding: "12px 0" }}>Sem dados suficientes</div>
          )}
          {rankCompradores.map((c, i) => (
            <div key={c.nome} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>#{i + 1}</span>
                  <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{c.nome}</span>
                  <span style={{ fontSize: 10, color: C.muted }}>{c.qtd} ordem{c.qtd !== 1 ? "s" : ""}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.saving }}>{fmtBRL(c.total)}</span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {c.savingA > 0 && (
                  <div
                    style={{ flex: c.savingA, height: 5, background: "#818cf8", borderRadius: 3 }}
                    title={`Cotação: ${fmtBRL(c.savingA)}`}
                  />
                )}
                {c.savingB > 0 && (
                  <div
                    style={{ flex: c.savingB, height: 5, background: C.saving, borderRadius: 3 }}
                    title={`Negoc.: ${fmtBRL(c.savingB)}`}
                  />
                )}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                {c.savingA > 0 && (
                  <span style={{ fontSize: 10, color: "#818cf8" }}>Cotação {fmtBRL(c.savingA)}</span>
                )}
                {c.savingB > 0 && (
                  <span style={{ fontSize: 10, color: C.saving }}>Negoc. {fmtBRL(c.savingB)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gráfico mensal + categorias */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14 }}>
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "18px 20px",
          }}
        >
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.08em", marginBottom: 16 }}>
            GASTOS MENSAIS — {ano}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 110 }}>
            {porMes.map((m, i) => {
              const isSel = mes !== "todos" && parseInt(mes) === i;
              return (
                <div
                  key={i}
                  onClick={() => setMes(mes === String(i) ? "todos" : String(i))}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer" }}
                >
                  {m.total > 0 && (
                    <div style={{ fontSize: 8, color: isSel ? C.accent : C.muted, whiteSpace: "nowrap" }}>
                      {fmtBRL(m.total).replace("R$ ", "")}
                    </div>
                  )}
                  <div
                    style={{
                      width: "100%",
                      background: isSel ? C.accent : m.total > 0 ? "#3b82f644" : C.border,
                      borderRadius: "3px 3px 0 0",
                      height: m.total > 0 ? `${Math.max((m.total / maxMes) * 100, 5)}%` : "5px",
                      border: isSel ? `1px solid ${C.accent}` : "none",
                      transition: "all .2s",
                      minHeight: 4,
                    }}
                  />
                  <div style={{ fontSize: 8, color: isSel ? C.accent : C.muted }}>{m.m}</div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 8, textAlign: "center" }}>
            Clique em um mês para filtrar todo o painel
          </div>
        </div>

        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "18px 20px",
          }}
        >
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.08em", marginBottom: 16 }}>
            POR CATEGORIA
          </div>
          {porCat.map((c) => (
            <div key={c.cat} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: C.text }}>{c.label}</span>
                <span style={{ fontSize: 12, color: c.color, fontWeight: 600 }}>{fmtBRL(c.total)}</span>
              </div>
              <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    background: c.color,
                    width: `${totalGasto ? (c.total / totalGasto) * 100 : 0}%`,
                    borderRadius: 3,
                  }}
                />
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{c.qtd} ordem{c.qtd !== 1 ? "s" : ""}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Lead time + prazo resposta fornecedor */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "18px 20px",
          }}
        >
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.08em", marginBottom: 4 }}>
            ⏱ TOP 5 MAIOR LEAD TIME
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginBottom: 14 }}>Dias entre abertura do chamado e recebimento</div>
          {top5Lead.length === 0 && <div style={{ color: C.muted, fontSize: 12, padding: "12px 0" }}>Sem dados</div>}
          {top5Lead.map((c, i) => {
            const maxLead = top5Lead[0]?.leadTime || 1;
            const eq = equipamentos.find((e) => e.id === c.equipamentoId);
            return (
              <div key={c.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: C.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.peca}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted }}>
                      {eq?.tag || "—"} ·{" "}
                      <span
                        style={{
                          fontSize: 10,
                          background: `#${urgCfg[c.urgencia]?.c || "64748b"}22`,
                          border: `1px solid #${urgCfg[c.urgencia]?.c || "64748b"}44`,
                          borderRadius: 4,
                          padding: "2px 8px",
                          color: `#${urgCfg[c.urgencia]?.c || "64748b"}`,
                          letterSpacing: "0.06em",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {urgCfg[c.urgencia]?.l}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: c.leadTime > 5 ? "#f87171" : c.leadTime > 3 ? C.warn : C.success,
                      marginLeft: 12,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.leadTime}d
                  </div>
                </div>
                <div style={{ height: 5, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      background: c.leadTime > 5 ? "#f87171" : c.leadTime > 3 ? C.warn : C.success,
                      width: `${(c.leadTime / maxLead) * 100}%`,
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "18px 20px",
          }}
        >
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.08em", marginBottom: 4 }}>
            📬 PRAZO MÉDIO DE RESPOSTA
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginBottom: 14 }}>Dias entre envio da cotação e resposta do fornecedor</div>
          {rankForn.length === 0 && <div style={{ color: C.muted, fontSize: 12, padding: "12px 0" }}>Sem dados</div>}
          {rankForn.map((f, i) => {
            const maxM = rankForn[rankForn.length - 1]?.media || 1;
            const color = f.media <= 1 ? C.success : f.media <= 3 ? C.warn : "#f87171";
            return (
              <div key={f.nome} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {f.nome}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color, marginLeft: 8, whiteSpace: "nowrap" }}>
                    {f.media.toFixed(1)}d
                  </span>
                </div>
                <div style={{ height: 5, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      background: color,
                      width: `${(f.media / maxM) * 100}%`,
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Por equipamento */}
      {porEquip.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.muted, letterSpacing: "0.08em" }}>
            GASTOS POR EQUIPAMENTO
          </div>
          {porEquip.map((eq, i) => (
            <div
              key={eq.id}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 20px",
                borderBottom: i < porEquip.length - 1 ? `1px solid ${C.border}22` : "none",
                gap: 14,
              }}
            >
              <div style={{ fontSize: 10, color: C.muted, width: 20, textAlign: "right" }}>#{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{eq.nome}</div>
                <div style={{ fontSize: 11, color: C.accent }}>{eq.tag} · {eq.qtd} ordem{eq.qtd !== 1 ? "s" : ""}</div>
              </div>
              <div style={{ width: 180 }}>
                <div style={{ height: 5, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      background: C.accent,
                      width: `${(eq.total / porEquip[0].total) * 100}%`,
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, width: 110, textAlign: "right" }}>
                {fmtBRL(eq.total)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabela detalhada */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.muted, letterSpacing: "0.08em" }}>
          HISTÓRICO DE COMPRAS APROVADAS
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "120px 2fr 1.2fr 90px 90px 90px 110px 90px",
            padding: "10px 20px",
            background: C.bg,
            borderBottom: `1px solid ${C.border}`,
            fontSize: 10,
            color: C.muted,
            letterSpacing: "0.08em",
          }}
        >
          <span>NÚMERO</span>
          <span>PEÇA</span>
          <span>EQUIPAMENTO</span>
          <span>CATEGORIA</span>
          <span>COMPRADOR</span>
          <span>LEAD TIME</span>
          <span style={{ textAlign: "right" }}>VALOR PAGO</span>
          <span style={{ textAlign: "right" }}>SAVING</span>
        </div>
        {savings.map((c, i) => {
          const eq = equipamentos.find((e) => e.id === c.equipamentoId);
          return (
            <div
              key={c.id}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 2fr 1.2fr 90px 90px 90px 110px 90px",
                padding: "12px 20px",
                borderBottom: i < savings.length - 1 ? `1px solid ${C.border}22` : "none",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 11, color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>{c.numero}</span>
              <div>
                <div style={{ fontSize: 13, color: C.text }}>{c.peca}</div>
                {c.fornecedorAprovado && <div style={{ fontSize: 11, color: C.muted }}>{c.fornecedorAprovado}</div>}
              </div>
              <span style={{ fontSize: 12, color: C.textSub }}>{eq?.nome || "—"}</span>
              <span
                style={{
                  fontSize: 10,
                  background: `${catCfg[c.categoria]?.c || C.muted}22`,
                  border: `1px solid ${catCfg[c.categoria]?.c || C.muted}44`,
                  borderRadius: 4,
                  padding: "2px 8px",
                  color: catCfg[c.categoria]?.c || C.muted,
                  letterSpacing: "0.06em",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {catCfg[c.categoria]?.l}
              </span>
              <span style={{ fontSize: 12, color: C.textSub }}>{c.aprovadoPor || "—"}</span>
              <span
                style={{
                  fontSize: 12,
                  color: c.leadTime > 5 ? "#f87171" : c.leadTime > 3 ? C.warn : C.success,
                  fontWeight: 600,
                }}
              >
                {c.leadTime ? `${c.leadTime}d` : "—"}
              </span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.success }}>{fmtBRL(c.valorPago)}</div>
                {c.valorNegociado && c.valorNegociado !== c.valorAprovado && (
                  <div style={{ fontSize: 10, color: C.muted, textDecoration: "line-through" }}>{fmtBRL(c.valorAprovado)}</div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                {c.savingTotal > 0 ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.saving }}>+{fmtBRL(c.savingTotal)}</span>
                ) : (
                  <span style={{ fontSize: 12, color: C.muted }}>—</span>
                )}
              </div>
            </div>
          );
        })}
        {savings.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>Nenhuma compra finalizada no período</div>
        )}
      </div>
    </div>
  );
}

// Definição de urgCfg para uso no componente (já que é referenciado)
const urgCfg = {
  alta: { l: "Alta", c: "#ef4444" },
  media: { l: "Média", c: "#f59e0b" },
  baixa: { l: "Baixa", c: "#22c55e" },
};