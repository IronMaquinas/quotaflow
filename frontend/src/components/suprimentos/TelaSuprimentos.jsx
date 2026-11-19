// components/suprimentos/TelaSuprimentos.jsx — etapa R1: 📊 SUPRIMENTOS com números reais (OCs e propostas das cotações)
//   Abas: Visão geral · Gastos · Saving · Oportunidades · Preços · Fornecedores. Substitui no menu "Histórico Preços" e "Inteligência"
//   da 1ª versão (liam a lista antiga de chamados e ficavam vazias). Dados: GET /api/suprimentos/painel?de&ate.
import { useEffect, useMemo, useState } from "react";
import apiService from "../../services/apiService";
import FiltroPeriodo, { faixaPeriodo } from "../shared/FiltroPeriodo";

const brl = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const pct = (v) => (v == null ? "—" : `${String(v).replace(".", ",")}%`);
const ABAS = [["geral", "Visão geral"], ["gastos", "Gastos"], ["saving", "Saving"], ["oport", "Oportunidades"], ["precos", "Preços"], ["forn", "Fornecedores"]];

export default function TelaSuprimentos({ C, s }) {
  const [per, setPer] = useState(() => faixaPeriodo("ano")); const [d, setD] = useState(null); const [erro, setErro] = useState(""); const [aba, setAba] = useState("geral");
  const [busca, setBusca] = useState(""); const [sel, setSel] = useState(null);
  useEffect(() => { setD(null); setErro(""); apiService.get(`/suprimentos/painel?de=${per.de || ""}&ate=${per.ate || ""}`).then(setD).catch((e) => setErro(e?.response?.data?.erro || e.message)); }, [per.de, per.ate]);
  const card = { ...s.card, padding: "16px 18px" }; const tit = { fontSize: 12, color: C.textSub, fontWeight: 700, letterSpacing: ".04em", marginBottom: 10 };
  const sevCor = { alta: C.danger || "#ef4444", media: C.warn || "#f59e0b", baixa: C.textSub };
  const Kpi = ({ r, v, sub, cor }) => <div style={{ ...card, flex: "1 1 170px", minWidth: 150 }}><div style={{ fontSize: 11.5, color: C.textSub }}>{r}</div><div style={{ fontSize: 22, fontWeight: 800, color: cor || C.text, marginTop: 4 }}>{v}</div>{sub && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{sub}</div>}</div>;
  const Barra = ({ v, max, cor }) => <div style={{ height: 8, background: C.border, borderRadius: 4, overflow: "hidden", flex: 1 }}><div style={{ width: `${max ? Math.max(2, (v / max) * 100) : 0}%`, height: "100%", background: cor || C.accent }} /></div>;
  const Tabela = ({ linhas, cols }) => <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><thead><tr>{cols.map((c) => <th key={c[0]} style={{ textAlign: c[2] || "left", padding: "6px 8px", color: C.textSub, fontWeight: 600, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{c[0]}</th>)}</tr></thead>
    <tbody>{linhas.map((l, i) => <tr key={i} onClick={l._click} style={{ cursor: l._click ? "pointer" : "default" }}>{cols.map((c) => <td key={c[0]} style={{ textAlign: c[2] || "left", padding: "7px 8px", borderBottom: `1px solid ${C.border}55`, whiteSpace: c[2] ? "nowrap" : "normal" }}>{c[1](l)}</td>)}</tr>)}</tbody></table></div>;
  const precos = useMemo(() => (d?.precos || []).filter((p) => !busca || p.item.toLowerCase().includes(busca.toLowerCase())), [d, busca]);
  const vazio = d && !d.resumo.ocs;

  return (
    <div style={{ padding: "20px clamp(12px, 3vw, 28px)", display: "grid", gap: 16 }}>
      <div><div style={{ fontSize: 22, fontWeight: 800 }}>📊 Suprimentos</div><div style={{ fontSize: 13, color: C.textSub, marginTop: 2 }}>Quanto a empresa gasta, onde dá para gastar menos e quanto a equipe economizou — direto das OCs e das propostas das cotações.</div></div>
      <FiltroPeriodo C={C} s={s} valor={per} onChange={setPer} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", borderBottom: `1px solid ${C.border}` }}>{ABAS.map(([k, r]) => <button key={k} type="button" onClick={() => setAba(k)} style={{ background: "none", border: "none", borderBottom: `2px solid ${aba === k ? C.accent : "transparent"}`, color: aba === k ? C.text : C.textSub, padding: "8px 12px", fontWeight: aba === k ? 700 : 500, cursor: "pointer", fontSize: 13.5 }}>{r}{k === "oport" && d?.oportunidades?.length ? ` (${d.oportunidades.length})` : ""}</button>)}</div>
      {erro && <div style={{ ...card, color: C.danger }}>{erro}</div>}
      {!d && !erro && <div style={{ color: C.muted }}>Carregando…</div>}
      {vazio && <div style={{ ...card, color: C.textSub }}>Nenhuma OC emitida no período. Os números aparecem quando houver compras fechadas (cotação → OC).</div>}

      {d && !vazio && aba === "geral" && <>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Kpi r="Gasto no período" v={brl(d.resumo.gasto)} sub={`${d.resumo.ocs} OC(s) · ${d.resumo.fornecedores} fornecedor(es)`} />
          <Kpi r="Saving da negociação" v={brl(d.resumo.saving_negociacao)} sub="proposta inicial − valor fechado" cor="#22c55e" />
          <Kpi r="Saving de mercado" v={brl(d.resumo.saving_mercado)} sub="mediana das outras propostas − pago" cor="#22c55e" />
          <Kpi r="Economia sobre o gasto" v={pct(d.resumo.saving_pct)} sub={`ticket médio ${brl(d.resumo.ticket_medio)}`} />
          <Kpi r="Compras com concorrência" v={d.resumo.com_concorrencia_pct == null ? "—" : `${d.resumo.com_concorrencia_pct}%`} sub="OC com 2+ propostas" cor={d.resumo.com_concorrencia_pct < 70 ? C.warn : undefined} />
        </div>
        <div style={card}><div style={tit}>GASTO POR MÊS (12 MESES)</div>
          {(() => { const mx = Math.max(...d.por_mes.map((m) => m.total), 1); return <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 150 }}>{d.por_mes.map((m) => <div key={m.mes} title={`${brl(m.total)} · ${m.ocs} OC`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}><div style={{ width: "100%", maxWidth: 36, height: `${(m.total / mx) * 100}%`, minHeight: m.total ? 3 : 0, background: m.mes >= per.de?.slice(0, 7) ? C.accent : `${C.accent}55`, borderRadius: "4px 4px 0 0" }} /><div style={{ fontSize: 10.5, color: C.textSub }}>{MES[Number(m.mes.slice(5)) - 1]}</div></div>)}</div>; })()}
        </div>
        {d.oportunidades.length > 0 && <div style={card}><div style={tit}>PRINCIPAIS OPORTUNIDADES</div>{d.oportunidades.slice(0, 4).map((o, i) => <div key={i} style={{ display: "flex", gap: 10, padding: "6px 0" }}><span style={{ width: 8, height: 8, borderRadius: 4, background: sevCor[o.sev], marginTop: 6, flex: "none" }} /><div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{o.titulo}</div><div style={{ fontSize: 12.5, color: C.textSub }}>{o.detalhe}</div></div></div>)}<button type="button" onClick={() => setAba("oport")} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 0, marginTop: 6, fontSize: 12.5 }}>Ver todas →</button></div>}
      </>}

      {d && !vazio && aba === "gastos" && <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        {[["POR CATEGORIA", d.por_categoria], ["POR FORNECEDOR", d.por_fornecedor], ["ITENS QUE MAIS PESAM", d.top_itens]].map(([t, l]) => <div key={t} style={card}><div style={tit}>{t}</div>
          {l.map((x) => <div key={x.nome} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) 1fr auto", gap: 10, alignItems: "center", padding: "5px 0", fontSize: 13 }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={x.nome}>{x.nome}</span><Barra v={x.total} max={l[0]?.total} /><span style={{ whiteSpace: "nowrap", color: C.textSub }}>{brl(x.total)} · {pct(x.pct)}</span></div>)}
        </div>)}
      </div>}

      {d && !vazio && aba === "saving" && <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><Kpi r="Negociação da equipe" v={brl(d.resumo.saving_negociacao)} cor="#22c55e" sub={`${d.saving.negociacao.length} OC(s) renegociada(s)`} /><Kpi r="Mercado (comparação de propostas)" v={brl(d.resumo.saving_mercado)} cor="#22c55e" sub="só itens com 2+ propostas; dado suspeito é ignorado" /></div>
        <div style={card}><div style={tit}>RENEGOCIAÇÕES (PROPOSTA INICIAL → FECHADO)</div>{d.saving.negociacao.length ? <Tabela linhas={d.saving.negociacao} cols={[["OC", (l) => l.oc], ["Data", (l) => dBR(l.em), "right"], ["Fornecedor", (l) => l.fornecedor], ["Proposta", (l) => brl(l.original), "right"], ["Fechado", (l) => brl(l.final), "right"], ["Economia", (l) => <b style={{ color: "#22c55e" }}>{brl(l.economia)}</b>, "right"]]} /> : <div style={{ color: C.muted, fontSize: 13 }}>Nenhuma renegociação registrada no período.</div>}</div>
        <div style={card}><div style={tit}>ABAIXO DA MEDIANA DO MERCADO</div>{d.saving.mercado.length ? <Tabela linhas={d.saving.mercado} cols={[["Compra", (l) => l.titulo], ["Data", (l) => dBR(l.em), "right"], ["Como", (l) => <span style={{ color: C.textSub, fontSize: 12 }}>{l.detalhe}</span>], ["Economia", (l) => <b style={{ color: "#22c55e" }}>{brl(l.valor)}</b>, "right"]]} /> : <div style={{ color: C.muted, fontSize: 13 }}>Sem compras com 2+ propostas no período.</div>}</div>
      </div>}

      {d && aba === "oport" && <div style={card}>{d.oportunidades.length ? d.oportunidades.map((o, i) => <div key={i} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: i ? `1px solid ${C.border}55` : "none" }}><span style={{ fontSize: 11, fontWeight: 700, color: sevCor[o.sev], border: `1px solid ${sevCor[o.sev]}`, borderRadius: 10, padding: "1px 8px", height: "fit-content", whiteSpace: "nowrap" }}>{{ alta: "ALTA", media: "MÉDIA", baixa: "BAIXA" }[o.sev]}</span><div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{o.titulo}</div><div style={{ fontSize: 12.5, color: C.textSub, marginTop: 2 }}>{o.detalhe}</div>{o.chave && <button type="button" onClick={() => { setSel(o.chave); setAba("precos"); }} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 0, marginTop: 4, fontSize: 12.5 }}>Ver histórico do item →</button>}</div></div>) : <div style={{ color: C.muted }}>Nenhuma oportunidade apontada no período. 👍</div>}</div>}

      {d && aba === "precos" && <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", alignItems: "start" }}>
        <div style={card}><div style={tit}>HISTÓRICO DE PREÇOS POR ITEM</div><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar item…" style={{ ...s.input, width: "100%", marginBottom: 10 }} />
          <div style={{ maxHeight: 520, overflowY: "auto" }}>{precos.map((p) => <div key={p.chave} onClick={() => setSel(p.chave)} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 6px", borderRadius: 6, cursor: "pointer", background: sel === p.chave ? `${C.accent}18` : "transparent" }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.item}</div><div style={{ fontSize: 11.5, color: C.textSub }}>{p.compras} compra(s) · último {brl(p.ultimo)} em {dBR(p.ultima_data)}</div></div>{p.var_pct != null && <span style={{ fontSize: 12, fontWeight: 700, color: p.var_pct >= 10 ? C.danger : p.var_pct <= -5 ? "#22c55e" : C.textSub }}>{p.var_pct > 0 ? "▲" : p.var_pct < 0 ? "▼" : "•"} {pct(Math.abs(p.var_pct))}</span>}</div>)}{!precos.length && <div style={{ color: C.muted, fontSize: 13 }}>Nenhum item.</div>}</div></div>
        {(() => { const p = (d.precos || []).find((x) => x.chave === sel); if (!p) return <div style={{ ...card, color: C.muted, fontSize: 13 }}>Escolha um item para ver a evolução do preço.</div>; const h = p.historico; const mx = Math.max(...h.map((x) => x.unit), 1); const mn = Math.min(...h.map((x) => x.unit)); const W = 320; const H = 120; const px = (i) => (h.length < 2 ? W / 2 : (i / (h.length - 1)) * W); const py = (v) => H - 8 - ((v - mn) / Math.max(mx - mn, 1e-9)) * (H - 16);
          return <div style={card}><div style={{ fontWeight: 700, fontSize: 15 }}>{p.item}</div><div style={{ fontSize: 12, color: C.textSub, marginBottom: 10 }}>{p.categoria}</div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5, marginBottom: 10 }}><span>mín <b>{brl(p.min)}</b></span><span>médio <b>{brl(p.medio)}</b></span><span>máx <b>{brl(p.max)}</b></span><span>último <b>{brl(p.ultimo)}</b></span>{p.var_pct != null && <span>vs. 6 meses <b style={{ color: p.var_pct >= 10 ? C.danger : C.text }}>{p.var_pct > 0 ? "+" : ""}{pct(p.var_pct)}</b></span>}</div>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 130, background: C.bg, borderRadius: 8 }}><polyline fill="none" stroke={C.accent} strokeWidth="2" points={h.map((x, i) => `${px(i)},${py(x.unit)}`).join(" ")} />{h.map((x, i) => <circle key={i} cx={px(i)} cy={py(x.unit)} r="3" fill={C.accent}><title>{`${dBR(x.data)} · ${brl(x.unit)} · ${x.fornecedor}`}</title></circle>)}</svg>
            <Tabela linhas={[...h].reverse()} cols={[["Data", (l) => dBR(l.data)], ["Fornecedor", (l) => l.fornecedor], ["Qtd", (l) => l.qtd, "right"], ["Unitário", (l) => brl(l.unit), "right"], ["OC", (l) => l.oc, "right"]]} /></div>; })()}
      </div>}

      {d && aba === "forn" && <div style={card}><div style={tit}>DESEMPENHO DOS FORNECEDORES NO PERÍODO</div>{d.fornecedores.length ? <Tabela linhas={d.fornecedores} cols={[["Fornecedor", (l) => l.nome], ["Convites", (l) => l.convites, "right"], ["Respostas", (l) => l.respostas, "right"], ["Taxa de resposta", (l) => <span style={{ color: l.taxa_resposta != null && l.taxa_resposta < 50 ? C.danger : C.text }}>{l.taxa_resposta == null ? "—" : `${l.taxa_resposta}%`}</span>, "right"], ["OCs ganhas", (l) => l.vitorias, "right"], ["Gasto", (l) => brl(l.gasto), "right"], ["NCs", (l) => <span style={{ color: l.ncs ? C.danger : C.textSub }}>{l.ncs}</span>, "right"]]} /> : <div style={{ color: C.muted, fontSize: 13 }}>Nenhuma cotação no período.</div>}
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 10 }}>Base do tópico "desempenho de provedores externos" da Análise Crítica (ISO 9001, 9.3).</div></div>}
    </div>
  );
}
