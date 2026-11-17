// components/metas/FichaMeta.jsx — etapa SC2.4: 📈 ficha da meta — 12 meses em gráfico + tabela, com correção rastreada
//   Origem de cada mês: 📐 calculado (sistema) · ✏️ informado · ✎ ajustado (quem, quando, motivo e o valor original) · ⏳ parcial (mês corrente).
import { useEffect, useState } from "react";
import apiService from "../../services/apiService";
import { COR_SINAL, fmtValor } from "./TelaMetas";
import { STATUS_ACAO, abrirTarefa } from "./PlanoAcaoMeta"; // SC2.5

const ORIGEM = { calculado: "📐 calculado", informado: "✏️ informado", ajustado: "✎ ajustado", parcial: "⏳ parcial do mês" };

export function Grafico({ meses, meta, C, alt = 190 }) {
  const W = 640; const H = alt; const pad = { l: 44, r: 12, t: 12, b: 26 };
  const vs = meses.map((m) => m.valor).filter((v) => v != null); const refs = [meta.meta, meta.limite].filter((v) => v != null).map(Number);
  if (!vs.length) return <div style={{ fontSize: 12.5, color: C.muted, padding: "24px 0", textAlign: "center" }}>Ainda sem resultados para desenhar.</div>;
  let lo = Math.min(...vs, ...refs); let hi = Math.max(...vs, ...refs); if (lo === hi) { lo -= 1; hi += 1; } const folga = (hi - lo) * 0.1; lo -= folga; hi += folga;
  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, meses.length - 1); const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const pts = meses.map((m, i) => (m.valor == null ? null : [x(i), y(m.valor), m]));
  const linha = pts.filter(Boolean).map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {[lo + folga, (lo + hi) / 2, hi - folga].map((v, i) => <text key={i} x={pad.l - 6} y={y(v) + 4} fontSize="10" textAnchor="end" fill={C.muted}>{fmtValor(Math.round(v * 10) / 10, meta.unidade)}</text>)}
      {meta.meta != null && <><line x1={pad.l} x2={W - pad.r} y1={y(Number(meta.meta))} y2={y(Number(meta.meta))} stroke="#22c55e" strokeDasharray="5 4" strokeWidth="1.2" /><text x={W - pad.r} y={y(Number(meta.meta)) - 4} fontSize="10" textAnchor="end" fill="#22c55e">meta</text></>}
      {meta.limite != null && Number(meta.limite) !== Number(meta.meta) && <line x1={pad.l} x2={W - pad.r} y1={y(Number(meta.limite))} y2={y(Number(meta.limite))} stroke="#f59e0b" strokeDasharray="3 4" strokeWidth="1" />}
      <path d={linha} fill="none" stroke={C.textSub} strokeWidth="1.6" />
      {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={p[2].parcial ? 4 : 5} fill={COR_SINAL[p[2].sinal] || C.textSub} stroke={p[2].parcial ? C.text : "none"} strokeDasharray={p[2].parcial ? "2 2" : undefined}><title>{`${p[2].nome}: ${fmtValor(p[2].valor, meta.unidade)}`}</title></circle>)}
      {meses.map((m, i) => <text key={m.mes} x={x(i)} y={H - 8} fontSize="10" textAnchor="middle" fill={C.muted}>{m.nome.split("/")[0]}</text>)}
    </svg>
  );
}

export default function FichaMeta({ C, s, metaId, podeCorrigir, onFechar, onMudou }) {
  const [d, setD] = useState(null); const [erro, setErro] = useState(null); const [ed, setEd] = useState(null); const [ocup, setOcup] = useState(false);
  const carregar = () => apiService.get(`/metas/${metaId}/historico`).then(setD).catch((e) => setErro(e?.response?.data?.erro || "Não consegui carregar."));
  useEffect(() => { carregar(); }, [metaId]); // eslint-disable-line
  const salvar = async () => { setOcup(true); setErro(null); try { await apiService.put(`/metas/${metaId}/resultados/${ed.mes}`, { valor: ed.valor, motivo: ed.motivo }); setEd(null); carregar(); onMudou?.(); } catch (e) { setErro(e?.response?.data?.erro || e.message); } finally { setOcup(false); } };
  const m = d?.meta; const precisaMotivo = ed && (ed.tinha || (m && m.origem !== "manual"));
  return (
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "#000000aa", zIndex: 85, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, padding: 18, width: "min(760px, 100%)" }}>
        {!d ? <div style={{ color: C.muted, padding: 30, textAlign: "center" }}>{erro || "Carregando…"}</div> : <>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 17, fontWeight: 700 }}>{m.nome}</div><div style={{ fontSize: 12, color: C.muted }}>{m.area_nome}{m.responsavel_nome ? ` · 👤 ${m.responsavel_nome}` : ""}</div></div>
            <button type="button" onClick={onFechar} style={{ ...s.btn(true), padding: "6px 14px", cursor: "pointer" }}>Fechar</button>
          </div>
          {m.descricao && <div style={{ fontSize: 12.5, color: C.textSub, margin: "8px 0", whiteSpace: "pre-line" }}>{m.descricao}</div>}
          <div style={{ margin: "8px 0 4px" }}><Grafico meses={d.meses} meta={m} C={C} /></div>
          {erro && <div style={{ color: C.danger, fontSize: 12.5, margin: "6px 0" }}>{erro}</div>}
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr style={{ color: C.textSub, textAlign: "left" }}>{["Mês", "Resultado", "Origem", ""].map((h) => <th key={h} style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>{h}</th>)}</tr></thead>
            <tbody>{[...d.meses].reverse().map((r) => <tr key={r.mes} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>{r.nome}</td>
              <td style={{ padding: "7px 8px", fontWeight: 700, color: COR_SINAL[r.sinal] || C.text, whiteSpace: "nowrap" }}>{ed?.mes === r.mes
                ? <input autoFocus type="number" step="any" value={ed.valor} onChange={(e) => setEd({ ...ed, valor: e.target.value })} style={{ ...s.input, padding: "4px 6px", width: 110 }} />
                : fmtValor(r.valor, m.unidade)}</td>
              <td style={{ padding: "7px 8px", color: C.textSub }}>{ed?.mes === r.mes
                ? <input value={ed.motivo} onChange={(e) => setEd({ ...ed, motivo: e.target.value })} placeholder={precisaMotivo ? "Motivo da correção (obrigatório)" : "Observação (opcional)"} style={{ ...s.input, padding: "4px 6px" }} />
                : <span title={r.origem === "ajustado" ? `ajustado por ${r.por || "—"} em ${r.em ? new Date(r.em).toLocaleDateString("pt-BR") : "—"}\nmotivo: ${r.motivo || "—"}\noriginal: ${fmtValor(r.valor_original, m.unidade)} (${r.origem_original || "—"})` : r.motivo || ""}>
                    {ORIGEM[r.origem] || "—"}{r.origem === "ajustado" && <span style={{ color: C.muted }}> · {r.por || "—"} · era {fmtValor(r.valor_original, m.unidade)} · “{r.motivo}”</span>}</span>}</td>
              <td style={{ padding: "7px 8px", textAlign: "right", whiteSpace: "nowrap" }}>{podeCorrigir && !r.parcial && (ed?.mes === r.mes
                ? <><button type="button" disabled={ocup || ed.valor === "" || (precisaMotivo && String(ed.motivo).trim().length < 5)} onClick={salvar} style={{ ...s.btn(true), padding: "3px 10px", fontSize: 12, cursor: "pointer" }}>Salvar</button>
                    <button type="button" onClick={() => setEd(null)} style={{ background: "none", border: "none", color: C.textSub, cursor: "pointer", marginLeft: 4 }}>×</button></>
                : <button type="button" onClick={() => setEd({ mes: r.mes, valor: r.valor ?? "", motivo: "", tinha: r.valor != null })} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 12 }}>{r.valor == null ? "＋ lançar" : "✏️ corrigir"}</button>)}</td>
            </tr>)}</tbody></table></div>
          <div style={{ marginTop: 14 }}><div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: C.textSub, marginBottom: 4 }}>📋 PLANOS DE AÇÃO ({(d.acoes || []).length})</div>
            {(d.acoes || []).length === 0 ? <div style={{ fontSize: 12.5, color: C.muted }}>{["amarelo", "vermelho"].includes(m.sinal) ? "Fora da meta e sem plano de ação — recomendado abrir um (botão ＋ Plano de ação no cartão)." : "Nenhum plano de ação para esta meta."}</div>
              : d.acoes.map((a) => <div key={a.id} onClick={() => abrirTarefa(a.numero)} style={{ display: "flex", gap: 10, padding: "7px 4px", borderTop: `1px solid ${C.border}`, cursor: a.numero ? "pointer" : "default", fontSize: 12.5 }}>
                <span style={{ color: C.accent, whiteSpace: "nowrap" }}>{a.numero || "tarefa"}</span><span style={{ flex: 1 }}>{a.titulo}{a.responsavel ? <span style={{ color: C.muted }}> · 👤 {a.responsavel}</span> : null}{a.prazo ? <span style={{ color: C.muted }}> · prazo {String(a.prazo).slice(0, 10).split("-").reverse().join("/")}</span> : null}</span><span style={{ color: C.muted, whiteSpace: "nowrap" }}>{STATUS_ACAO[a.status] || a.status}</span></div>)}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>O mês fecha sozinho no dia 1 (📐 calculado). Metas próprias: o dono recebe aviso no 🔔 dia 1 e lembrete dia 5. Toda correção guarda quem, quando, o motivo e o valor original.</div>
        </>}
      </div>
    </div>
  );
}
