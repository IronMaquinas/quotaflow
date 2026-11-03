// components/programacao/PainelUtilizacao.jsx — etapa 18f.1: 📊 utilização (passado) × alocação (futuro)
//   Equipamentos da frota e motoristas. Linha divisória = hoje. Base = dias operacionais (⚙️ Configurações › Jornada).
//   💰 receita realizada / prevista / perdida em ociosidade — só aparece para admin e gestor (o backend nem manda).
//   📑 Relatório detalhado → utils/gerarRelatorioUtilizacao.js (por item, com as ATs de cada um)
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import { abrirRelatorioUtilizacao } from "../../utils/gerarRelatorioUtilizacao";

const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const soma = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const fimMes = (d) => { const [y, m] = d.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
export function faixaUtil(k, atual) {
  const h = hoje();
  if (k === "mes") return { k, de: `${h.slice(0, 7)}-01`, ate: fimMes(h) };
  if (k === "prox30") return { k, de: soma(h, 1), ate: soma(h, 30) };
  if (k === "ult30") return { k, de: soma(h, -29), ate: h };
  if (k === "ano") return { k, de: `${h.slice(0, 4)}-01-01`, ate: `${h.slice(0, 4)}-12-31` };
  return { k: "livre", de: atual?.de || `${h.slice(0, 7)}-01`, ate: atual?.ate || fimMes(h) };
}
const PRESETS = [["mes", "Este mês"], ["ult30", "Últimos 30 dias"], ["prox30", "Próximos 30 dias"], ["ano", "Este ano"], ["livre", "Período"]];
export const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }));
export const pc = (v) => (v == null ? "—" : `${String(v).replace(".", ",")}%`);
const dBR = (d) => (d ? d.split("-").reverse().join("/") : "");

export default function PainelUtilizacao({ C, s }) {
  const [per, setPer] = useState(faixaUtil("mes"));
  const [vis, setVis] = useState("equipamentos");
  const [d, setD] = useState(null);
  const [erro, setErro] = useState(null);
  useEffect(() => {
    if (!per.de || !per.ate || per.de > per.ate) return;
    setErro(null);
    apiService.get(`/programacao/utilizacao?de=${per.de}&ate=${per.ate}`).then(setD).catch((e) => setErro(e.message));
  }, [per.de, per.ate]);

  const bloco = d?.[vis];
  const r = bloco?.resumo || {};
  const temPass = (d?.periodo?.dias_operacionais_passado || 0) > 0; const temFut = (d?.periodo?.dias_operacionais_futuro || 0) > 0;
  const card = (rot, val, sub, cor) => <div style={{ ...s.card, padding: "12px 14px", flex: "1 1 160px", minWidth: 150 }}>
    <div style={{ fontSize: 12, color: C.muted }}>{rot}</div><div style={{ fontSize: 24, fontWeight: 800, color: cor || C.text, lineHeight: 1.25 }}>{val}</div>{sub ? <div style={{ fontSize: 12, color: C.textSub }}>{sub}</div> : null}</div>;
  const barra = (v, cor) => <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden", minWidth: 60 }}><div style={{ width: `${Math.min(100, v || 0)}%`, height: "100%", background: cor }} /></div>;
  const corUtil = (v) => (v == null ? C.muted : v >= 70 ? (C.success || "#16a34a") : v >= 40 ? C.warn : C.danger);
  const nome = (x) => (vis === "equipamentos" ? `${x.tag}${x.nome ? ` · ${x.nome}` : ""}` : x.nome);
  const chave = temPass ? "utilizacao_pct" : "alocacao_pct";
  const ranking = [...(bloco?.itens || [])].filter((x) => x[chave] != null).sort((a, b) => b[chave] - a[chave]);
  const mais = ranking.slice(0, 5); const menos = ranking.slice(-5).reverse();
  const listaTop = (tit, l) => <div style={{ ...s.card, padding: 14, flex: "1 1 300px" }}>
    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{tit}</div>
    {!l.length ? <div style={{ fontSize: 12.5, color: C.muted }}>Sem dados no período.</div> : l.map((x) => <div key={String(x.id ?? x.nome)} style={{ display: "grid", gridTemplateColumns: "1fr 90px 52px", gap: 8, alignItems: "center", fontSize: 13, padding: "4px 0" }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={nome(x)}>{nome(x)}{x.bloqueado ? " 🔒" : ""}</span>{barra(x[chave], corUtil(x[chave]))}<b style={{ textAlign: "right", color: corUtil(x[chave]) }}>{pc(x[chave])}</b></div>)}
  </div>;
  const th = (h, dir) => <th key={h} style={{ textAlign: dir || "left", fontSize: 10.5, color: C.muted, padding: "8px 10px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h.toUpperCase()}</th>;
  const td = (v, x = {}) => <td style={{ padding: "7px 10px", borderTop: `1px solid ${C.border}`, ...x }}>{v}</td>;

  return <div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
      {PRESETS.map(([k, rot]) => <button key={k} type="button" onClick={() => setPer(faixaUtil(k, per))} style={{ background: per.k === k ? C.accent : "transparent", color: per.k === k ? "#fff" : C.text, border: `1px solid ${per.k === k ? C.accent : C.border}`, borderRadius: 16, padding: "5px 12px", fontSize: 12.5, cursor: "pointer" }}>{rot}</button>)}
      {per.k === "livre" && <><input type="date" aria-label="De" value={per.de} onChange={(e) => setPer({ ...per, de: e.target.value })} style={{ ...s.input, width: 150 }} /><span style={{ color: C.muted }}>a</span><input type="date" aria-label="Até" value={per.ate} onChange={(e) => setPer({ ...per, ate: e.target.value })} style={{ ...s.input, width: 150 }} /></>}
      <span style={{ flex: 1 }} />
      {["equipamentos", "motoristas"].map((k) => <button key={k} type="button" onClick={() => setVis(k)} style={{ background: vis === k ? C.accent : "transparent", color: vis === k ? "#fff" : C.textSub, border: `1px solid ${vis === k ? C.accent : C.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12.5, cursor: "pointer", fontWeight: 600 }}>{k === "equipamentos" ? "🚛 Equipamentos" : "👤 Motoristas"}</button>)}
      {d && <button type="button" onClick={() => abrirRelatorioUtilizacao(d)} style={{ ...s.btn(false), cursor: "pointer", color: C.text, padding: "6px 12px", fontSize: 12.5 }}>📑 Relatório detalhado</button>}
    </div>
    {erro && <div style={{ color: C.danger, fontSize: 13, marginBottom: 10 }}>{erro}</div>}
    {!d ? <div style={{ color: C.muted }}>Carregando…</div> : <>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 10 }}>
        {dBR(d.periodo.de)} a {dBR(d.periodo.ate)} · hoje {dBR(d.periodo.hoje)} · {d.periodo.dias_operacionais_passado} dia(s) operacional(is) até hoje + {d.periodo.dias_operacionais_futuro} à frente · calendário: {d.calendario} · {d.ats} AT(s)
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {card("📈 Utilização (realizado)", temPass ? pc(r.utilizacao_pct) : "—", temPass ? "dos dias disponíveis até hoje" : "período só no futuro", corUtil(r.utilizacao_pct))}
        {card("🗓 Alocação (reservado)", temFut ? pc(r.alocacao_pct) : "—", temFut ? "dos dias à frente já reservados" : "período só no passado")}
        {card("🔧 Disponibilidade", temPass ? pc(r.disponibilidade_pct) : "—", r.dias_parados ? `${r.dias_parados} dia(s) parado (bloqueio)` : "sem bloqueios")}
        {card("💤 Dias ociosos", temPass ? r.dias_ociosos : "—", "disponível e sem AT", r.dias_ociosos ? C.warn : undefined)}
      </div>
      {d.com_valores && <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {card("💰 Receita realizada", brl(d.receita), "viagens rateadas pelos dias", C.success || "#16a34a")}
        {card("📅 Receita reservada", brl(d.receita_prevista), "ATs programadas à frente")}
        {card("💸 Receita perdida em ociosidade", brl(r.receita_perdida), `estimada: dias ociosos × ${brl(r.receita_dia_media)}/dia (média ${vis === "equipamentos" ? "por equipamento" : "por motorista"})`, r.receita_perdida ? C.danger : undefined)}
      </div>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {ranking.length > 5 ? <>{listaTop(`🏆 Mais ${temPass ? "utilizados" : "alocados"}`, mais)}{listaTop(`⚠️ Menos ${temPass ? "utilizados" : "alocados"}`, menos)}</>
          : listaTop(`🏆 Ranking de ${temPass ? "utilização" : "alocação"}`, ranking)}
      </div>
      {!bloco.itens.length ? <div style={{ ...s.card, padding: 24, textAlign: "center", color: C.muted }}>{vis === "equipamentos" ? "Nenhum equipamento da frota com AT ainda." : "Nenhum motorista cadastrado (função Motorista) nem com AT."}</div> :
        <div style={{ ...s.card, padding: 0, overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>{th(vis === "equipamentos" ? "Equipamento" : "Motorista")}{th("Disponível", "right")}{th("Em uso", "right")}{th("Ocioso", "right")}{th("Parado", "right")}{th("Utilização")}{th("Reservado", "right")}{th("Alocação")}{th("Viagens", "right")}{d.com_valores ? <>{th("Receita", "right")}{th("R$/dia", "right")}{th("Perdida (est.)", "right")}</> : null}</tr></thead>
          <tbody>{bloco.itens.map((x) => <tr key={String(x.id ?? x.nome)}>
            {td(<span>{nome(x)}{x.bloqueado ? <span title={x.bloqueio_motivo || "bloqueado"}> 🔒</span> : null}{x.fora_calendario ? <div style={{ fontSize: 11, color: C.muted }}>+{x.fora_calendario} dia(s) fora do calendário</div> : null}</span>, { fontWeight: 600 })}
            {td(x.disponiveis, { textAlign: "right" })}{td(x.utilizados, { textAlign: "right" })}{td(x.ociosos, { textAlign: "right", color: x.ociosos ? C.warn : C.text })}{td(x.parados || "—", { textAlign: "right", color: x.parados ? C.danger : C.muted })}
            {td(<div style={{ display: "flex", gap: 6, alignItems: "center" }}>{barra(x.utilizacao_pct, corUtil(x.utilizacao_pct))}<b style={{ color: corUtil(x.utilizacao_pct), minWidth: 44 }}>{pc(x.utilizacao_pct)}</b></div>)}
            {td(x.reservados, { textAlign: "right" })}
            {td(<div style={{ display: "flex", gap: 6, alignItems: "center" }}>{barra(x.alocacao_pct, C.accent)}<span style={{ minWidth: 44 }}>{pc(x.alocacao_pct)}</span></div>)}
            {td(x.viagens, { textAlign: "right" })}
            {d.com_valores ? <>{td(brl(x.receita), { textAlign: "right" })}{td(brl(x.receita_dia), { textAlign: "right" })}{td(brl(x.receita_perdida), { textAlign: "right", color: x.receita_perdida ? C.danger : C.muted })}</> : null}
          </tr>)}</tbody></table></div>}
      <details style={{ marginTop: 10, fontSize: 12.5, color: C.textSub }}><summary style={{ cursor: "pointer" }}>Como calculamos</summary>
        <div style={{ padding: "6px 2px", lineHeight: 1.55 }}>
          <b>Hoje é a linha divisória.</b> <b>Em uso</b> = dias operacionais em AT iniciada (do início real à conclusão, ou até hoje se em execução). <b>Reservado</b> = dias operacionais de AT programada/em execução de amanhã até o fim previsto. <b>Disponível</b> = dias operacionais − dias <b>parado</b> (equipamento bloqueado por inspeção reprovada). <b>Ocioso</b> = disponível − em uso. Rodar em domingo/feriado não infla o % (aparece como "fora do calendário").
          {d.com_valores ? <> <b>Receita</b> = valor dos itens da AT no pedido, rateado pelos dias da viagem; num conjunto, cada equipamento e o motorista mostram a receita da viagem (por isso a soma dos itens não é o total). <b>Perdida</b> = dias ociosos × R$/dia em uso do próprio recurso (sem histórico no período, a média).</> : null}
        </div></details>
    </>}
  </div>;
}
