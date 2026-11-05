// components/ocorrencias/IndicadoresOcorrencias.jsx — etapa 18h.4: 📊 indicadores das ocorrências (aba ⚠️ Ocorrências de 📑 Contratos)
//   Disponibilidade da locação (o que o cliente paga), ocorrências por período, resolução, dias parados, ranking — relatório A4 e CSV.
//   Perda estimada e cobrável do cliente só aparecem para gestor/admin (o servidor só manda para eles).
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import FiltroPeriodo, { faixaPeriodo } from "../shared/FiltroPeriodo";
import { abrirRelatorioOcorrencias, csvOcorrencias } from "../../utils/gerarRelatorioOcorrencias";
import { prepararJanela } from "../../utils/gerarDossieOcorrencia";
import { dadosEmpresa } from "../../utils/logoEmpresa";

const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const pct = (v) => (v == null ? "—" : `${String(v).replace(".", ",")}%`);
const corDisp = (C, v) => (v == null ? C.muted : v >= 97 ? C.success || "#22c55e" : v >= 90 ? C.warn || "#f59e0b" : C.danger);

export default function IndicadoresOcorrencias({ C, s, onErro, onAbrir }) {
  const [per, setPer] = useState(() => faixaPeriodo("mes"));
  const [d, setD] = useState(null); const [nivel, setNivel] = useState("equipamentos");
  useEffect(() => { setD(null); apiService.get("/ocorrencias/indicadores", { de: per.de, ate: per.ate }).then(setD).catch((e) => { onErro?.(e.message); setD({ erro: true }); }); }, [per.de, per.ate]); // eslint-disable-line
  const R = d?.resumo || {};
  const kpi = (titulo, valor, sub, cor) => <div style={{ ...s.card, padding: "10px 12px", flex: "1 1 150px", minWidth: 140 }}>
    <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.3 }}>{titulo}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: cor || C.text, lineHeight: 1.25 }}>{valor}</div>{sub && <div style={{ fontSize: 11.5, color: C.textSub }}>{sub}</div>}</div>;
  const relatorio = () => { const w = prepararJanela(); try { abrirRelatorioOcorrencias(d, { empresa: dadosEmpresa() }, w); } catch (e) { onErro?.(e.message); } };
  const csv = () => { const url = URL.createObjectURL(new Blob([csvOcorrencias(d)], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `ocorrencias-disponibilidade-${d.periodo?.de}-a-${d.periodo?.ate}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); };
  const lista = d?.[nivel] || [];
  const th = { textAlign: "right", fontSize: 11, color: C.muted, fontWeight: 600, padding: "4px 6px", whiteSpace: "nowrap" }; const td = { textAlign: "right", padding: "5px 6px", whiteSpace: "nowrap" };
  return <div>
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
      <FiltroPeriodo C={C} s={s} valor={per} onChange={setPer} />
      <span style={{ flex: 1 }} />
      {d && !d.erro && !d.sem_migration && <><button type="button" onClick={relatorio} style={{ ...s.btn(false), padding: "6px 12px", fontSize: 12.5, color: C.text, cursor: "pointer" }}>📄 Relatório</button>
        <button type="button" onClick={csv} style={{ ...s.btn(false), padding: "6px 12px", fontSize: 12.5, color: C.text, cursor: "pointer" }}>⬇ CSV</button></>}
    </div>
    {!d ? <div style={{ color: C.muted, fontSize: 13 }}>Calculando…</div> : d.erro ? null : d.sem_migration ? <div style={{ color: C.danger, fontSize: 13 }}>Falta rodar a migration 068.</div> : <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        {kpi("Disponibilidade (locação)", pct(R.disponibilidade), R.dias_contratados ? `${R.dias_indisponiveis} de ${R.dias_contratados} dias contratados indisponíveis` : "sem locação no período", corDisp(C, R.disponibilidade))}
        {kpi("Ocorrências", R.total, `${R.abertas} em aberto hoje${R.paradas_agora ? ` · ${R.paradas_agora} parada(s)` : ""}`)}
        {kpi("Resolução média", R.resolucao_media_dias == null ? "—" : `${String(R.resolucao_media_dias).replace(".", ",")} d`, R.resolucao_max_dias == null ? "nenhuma encerrada" : `máx. ${String(R.resolucao_max_dias).replace(".", ",")} d · ${R.encerradas_no_periodo} encerrada(s)`)}
        {kpi("Dias parados", R.dias_parados, `${R.dias_parados_cliente} por responsabilidade do cliente`)}
        {d.receita && kpi("Perda estimada", brl(R.perda_estimada), "dias indisponíveis × diária", R.perda_estimada ? C.danger : null)}
        {d.receita && kpi("Cobrável do cliente", brl(R.cobravel_cliente), "parado por mau uso")}
      </div>
      <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 14 }}>Disponibilidade = dias contratados − dias parados que <b>não</b> são responsabilidade do cliente. Parada por mau uso do cliente não conta contra a locadora. Valores são estimativas (valor mensal ÷ 30) — nada é descontado sozinho.</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>{[["equipamentos", "Por equipamento"], ["contratos", "Por contrato"], ["clientes", "Por cliente"]].map(([k, l]) => <button key={k} type="button" onClick={() => setNivel(k)} style={{ ...s.btn(nivel === k), padding: "5px 12px", fontSize: 12.5, cursor: "pointer" }}>{l}</button>)}</div>
      <div style={{ ...s.card, padding: 0, overflowX: "auto", marginBottom: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}><th style={{ ...th, textAlign: "left" }}>{nivel === "equipamentos" ? "Equipamento" : nivel === "contratos" ? "Contrato" : "Cliente"}</th>
            {nivel === "clientes" ? <><th style={th}>Ocorrências</th><th style={th}>Resp. do cliente</th><th style={th}>Dias parados</th></>
              : <><th style={th}>Disponibilidade</th><th style={th}>Dias contratados</th><th style={th}>Indisponíveis</th><th style={th}>Parado (cliente)</th><th style={th}>Ocorrências</th>{d.receita && <><th style={th}>Perda est.</th><th style={th}>Cobrável</th></>}</>}</tr></thead>
          <tbody>{lista.length === 0 ? <tr><td colSpan={9} style={{ padding: 12, color: C.muted, textAlign: "center" }}>Sem dados no período.</td></tr>
            : lista.map((x, i) => <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: "5px 6px" }}>{nivel === "equipamentos" ? <><b>{x.tag}</b> <span style={{ color: C.textSub }}>{x.nome}</span></> : nivel === "contratos" ? <><b>{x.numero}</b> <span style={{ color: C.textSub }}>{x.cliente}</span></> : x.cliente}</td>
              {nivel === "clientes" ? <><td style={td}>{x.ocorrencias}</td><td style={td}>{x.do_cliente}</td><td style={td}>{x.dias_parados}</td></>
                : <><td style={{ ...td, fontWeight: 700, color: corDisp(C, x.disponibilidade) }}>{pct(x.disponibilidade)}</td><td style={td}>{x.contratados}</td><td style={td}>{x.indisponiveis}</td><td style={td}>{x.do_cliente}</td><td style={td}>{x.ocorrencias}</td>
                  {d.receita && <><td style={td}>{brl(x.perda)}{x.sem_valor ? <span title="Sem valor mensal cadastrado na locação" style={{ color: C.warn }}> *</span> : null}</td><td style={td}>{brl(x.cobravel)}</td></>}</>}
            </tr>)}</tbody>
        </table>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
        {[["Por tipo", d.por_tipo], ["Por responsabilidade", d.por_responsabilidade], ["Por origem", d.por_origem]].map(([t, l]) => <div key={t} style={{ ...s.card, padding: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{t}</div>
          {(l || []).length === 0 ? <div style={{ fontSize: 12, color: C.muted }}>—</div> : l.map((x) => { const max = Math.max(...l.map((y) => y.n)); return <div key={x.k} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, marginBottom: 4 }}>
            <span style={{ flex: "0 0 120px", color: C.textSub }}>{x.nome}</span><div style={{ flex: 1, background: C.border, borderRadius: 3, height: 8 }}><div style={{ width: `${(x.n / max) * 100}%`, background: C.accent, height: 8, borderRadius: 3 }} /></div><b style={{ width: 24, textAlign: "right" }}>{x.n}</b></div>; })}
        </div>)}
        {(d.abertas_mais_antigas || []).length > 0 && <div style={{ ...s.card, padding: 12 }}><div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Em aberto há mais tempo</div>
          {d.abertas_mais_antigas.map((x) => <div key={x.id} className="qf-clicavel" onClick={() => onAbrir?.(x.id)} style={{ fontSize: 12.5, marginBottom: 4, cursor: "pointer" }}><b>{x.numero}</b> · {x.dias} d · <span style={{ color: C.textSub }}>{x.status}{x.parado ? " · ⛔ parado" : ""}</span></div>)}</div>}
      </div>
    </>}
  </div>;
}
