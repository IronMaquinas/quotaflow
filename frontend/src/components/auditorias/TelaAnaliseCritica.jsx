// components/auditorias/TelaAnaliseCritica.jsx — etapa R2: 🧭 ANÁLISE CRÍTICA PELA DIREÇÃO (ISO 9001 9.3) — admin e gestor
//   Histórico das análises por período (com o comparativo NPS · NCs · metas) + ＋ Nova análise. A ficha fica em FichaAnaliseCritica.jsx.
import { useEffect, useState } from "react";
import apiService from "../../services/apiService";
import FichaAnaliseCritica from "./FichaAnaliseCritica";

const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
export const COR_ST_AC = { rascunho: "#60a5fa", encerrada: "#f59e0b", concluida: "#22c55e", cancelada: "#64748b" };

export default function TelaAnaliseCritica({ C, s }) {
  const [L, setL] = useState(null); const [erro, setErro] = useState(""); const [msg, setMsg] = useState(""); const [ed, setEd] = useState(null); const [nova, setNova] = useState(null); const [pessoas, setPessoas] = useState(null);
  const carregar = () => apiService.get("/analise-critica").then((r) => { setL(r); setErro(""); }).catch((e) => setErro(e?.response?.data?.erro || e.message));
  useEffect(() => { carregar(); apiService.get("/pessoas/gestao-pessoas").then((r) => setPessoas(r.funcionarios || [])).catch(() => setPessoas([])); }, []);
  const card = { ...s.card, padding: "16px 18px" }; const lab = { fontSize: 11.5, color: C.textSub, display: "block", marginBottom: 3 };
  const criar = async () => { setMsg(""); try { const r = await apiService.post("/analise-critica", nova); setNova(null); setEd(r.analise.id); } catch (e) { setMsg(`⚠ ${e?.response?.data?.erro || e.message}`); } };

  if (ed) return <FichaAnaliseCritica C={C} s={s} id={ed} pessoas={pessoas} onVoltar={(info) => { setEd(null); carregar(); if (info?.msg) setMsg(info.msg); }} />;
  const concl = (L?.analises || []).filter((a) => a.status === "concluida" && a.resumo);
  return (
    <div style={{ padding: "20px clamp(12px, 3vw, 28px)", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div><div style={{ fontSize: 22, fontWeight: 800 }}>🧭 Análise crítica pela direção</div><div style={{ fontSize: 13, color: C.textSub, marginTop: 2 }}>ISO 9001, 9.3 — o sistema monta as entradas com os dados do período; a direção comenta, decide e assina a ata.</div></div>
        <button type="button" onClick={() => L && setNova({ titulo: "", periodo_de: L.periodo_padrao.de, periodo_ate: L.periodo_padrao.ate, data_reuniao: "" })} style={{ ...s.btn(true), cursor: "pointer" }}>＋ Nova análise</button>
      </div>
      {msg && <div style={{ fontSize: 13, color: /^⚠/.test(msg) ? C.warn : "#22c55e" }}>{msg}</div>}
      {erro && <div style={{ ...card, color: C.danger }}>{erro}</div>}
      {!L && !erro && <div style={{ color: C.muted }}>Carregando…</div>}
      {L && !L.concluida_no_ano && !(L.analises || []).some((a) => ["rascunho", "encerrada"].includes(a.status)) && <div style={{ ...card, borderLeft: `4px solid ${C.warn}`, fontSize: 13 }}>Nenhuma análise crítica concluída este ano. A norma pede ao menos uma por ano — clique em <b>＋ Nova análise</b>.</div>}
      {nova && <div onClick={() => setNova(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "min(520px, 100%)", display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>＋ Nova análise crítica</div>
          <div><span style={lab}>TÍTULO</span><input value={nova.titulo} onChange={(e) => setNova({ ...nova, titulo: e.target.value })} placeholder={`Análise crítica pela direção ${new Date().getFullYear()}`} style={{ ...s.input, width: "100%" }} /></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 140px" }}><span style={lab}>PERÍODO — DE</span><input type="date" value={nova.periodo_de} onChange={(e) => setNova({ ...nova, periodo_de: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>
            <div style={{ flex: "1 1 140px" }}><span style={lab}>ATÉ</span><input type="date" value={nova.periodo_ate} onChange={(e) => setNova({ ...nova, periodo_ate: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>
            <div style={{ flex: "1 1 140px" }}><span style={lab}>DATA DA REUNIÃO</span><input type="date" value={nova.data_reuniao} onChange={(e) => setNova({ ...nova, data_reuniao: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>
          </div>
          <div style={{ fontSize: 12, color: C.textSub }}>Padrão: últimos 12 meses. Os números ficam ao vivo enquanto a análise está em preparação e congelam ao encerrar.</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={() => setNova(null)} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button><button type="button" onClick={criar} style={{ ...s.btn(true), cursor: "pointer" }}>Criar e montar as entradas</button></div>
        </div></div>}
      {concl.length > 1 && <div style={card}>
        <div style={{ fontSize: 12, color: C.textSub, fontWeight: 700, letterSpacing: ".04em", marginBottom: 10 }}>COMPARATIVO ENTRE AS ANÁLISES</div>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><thead><tr>{["Análise", "Período", "NPS", "NCs abertas no período", "Metas fora do alvo"].map((h) => <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: C.textSub, borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>{h}</th>)}</tr></thead>
          <tbody>{[...concl].reverse().map((a) => <tr key={a.id}><td style={{ padding: "6px 8px" }}>{a.numero}</td><td style={{ padding: "6px 8px" }}>{dBR(a.periodo_de)} a {dBR(a.periodo_ate)}</td><td style={{ padding: "6px 8px", fontWeight: 700 }}>{a.resumo.nps ?? "—"}</td><td style={{ padding: "6px 8px" }}>{a.resumo.ncs_abertas ?? "—"}</td><td style={{ padding: "6px 8px" }}>{a.resumo.metas_fora ?? "—"}{a.resumo.metas != null ? ` de ${a.resumo.metas}` : ""}</td></tr>)}</tbody></table></div>
      </div>}
      {L && <div style={{ display: "grid", gap: 10 }}>
        {!(L.analises || []).length && <div style={{ ...card, color: C.muted, fontSize: 13 }}>Nenhuma análise ainda.</div>}
        {(L.analises || []).map((a) => <button key={a.id} type="button" onClick={() => setEd(a.id)} style={{ ...card, textAlign: "left", cursor: "pointer", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", color: C.text, borderLeft: `4px solid ${COR_ST_AC[a.status]}` }}>
          <div style={{ flex: "1 1 260px" }}><div style={{ fontWeight: 700 }}>{a.numero} — {a.titulo}</div><div style={{ fontSize: 12.5, color: C.textSub, marginTop: 2 }}>Período {dBR(a.periodo_de)} a {dBR(a.periodo_ate)} · reunião {dBR(a.data_reuniao)} · {(a.participantes || []).length} participante(s) · {a.saidas_n} decisão(ões)</div></div>
          <span style={{ fontSize: 12, fontWeight: 700, color: COR_ST_AC[a.status], border: `1px solid ${COR_ST_AC[a.status]}`, borderRadius: 12, padding: "3px 10px" }}>{L.STATUS[a.status]}</span>
        </button>)}
      </div>}
    </div>
  );
}
