// components/auditorias/BuscaAuditoria.jsx — etapa A1.2: 🔎 buscas da auditoria
//   BuscaDocumentos: Documentos de Gestão (código, título, revisão vigente) → 📘 auditado / 📎 suporte.
//   BuscaRegistros: registros do sistema (OS, AT, PV, cotação, OC, recebimento, movimentação, NC, tarefa, inspeção, ocorrência,
//   treinamento) — digita o número ou parte da descrição e escolhe; volta { tipo, rotulo, id, numero, descricao, emissor, data, situacao, tela }.
import { useEffect, useRef, useState } from "react";
import apiService from "../../services/apiService";

const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
function useBusca(url, q, extra = "") {
  const [l, setL] = useState([]); const [busy, setBusy] = useState(false); const t = useRef(null);
  useEffect(() => { clearTimeout(t.current); if (String(q).trim().length < 2) { setL([]); return undefined; } t.current = setTimeout(() => { setBusy(true); apiService.get(`${url}?q=${encodeURIComponent(q.trim())}${extra}`).then((r) => setL(r.itens || [])).catch(() => setL([])).finally(() => setBusy(false)); }, 300); return () => clearTimeout(t.current); }, [q, extra]); // eslint-disable-line
  return [l, busy];
}
const caixa = (C) => ({ position: "absolute", zIndex: 20, top: "100%", left: 0, right: 0, marginTop: 4, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, maxHeight: 280, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,.4)" });

export function BuscaDocumentos({ C, s, onEscolher, placeholder = "Buscar documento por código ou título…" }) {
  const [q, setQ] = useState(""); const [l, busy] = useBusca("/auditorias/busca/documentos", q);
  return <div style={{ position: "relative" }}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} style={{ ...s.input, width: "100%" }} />
    {q.trim().length >= 2 && <div style={caixa(C)}>{busy && !l.length ? <div style={{ padding: 10, color: C.muted, fontSize: 12.5 }}>Buscando…</div> : !l.length ? <div style={{ padding: 10, color: C.muted, fontSize: 12.5 }}>Nenhum documento encontrado.</div>
      : l.map((d) => <div key={d.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 10px", borderBottom: `1px solid ${C.border}55` }}>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{d.codigo ? `${d.codigo} · ` : ""}{d.titulo}</div><div style={{ fontSize: 11.5, color: C.textSub }}>{d.tipo || "documento"}{d.revisao != null ? ` · rev. ${d.revisao}` : ""}{d.status ? ` · ${d.status}` : ""}</div></div>
        <button type="button" onClick={() => { onEscolher({ ...d, papel: "auditado" }); setQ(""); }} style={{ ...s.btn(false), cursor: "pointer", fontSize: 11.5, padding: "4px 8px", color: C.text }}>📘 Auditado</button>
        <button type="button" onClick={() => { onEscolher({ ...d, papel: "suporte" }); setQ(""); }} style={{ ...s.btn(false), cursor: "pointer", fontSize: 11.5, padding: "4px 8px", color: C.text }}>📎 Suporte</button>
      </div>)}</div>}</div>;
}

export function BuscaRegistros({ C, s, onEscolher, tipos = {}, placeholder = "＋ Registro — digite o número (OS-2026-…, AT-…, NC-…) ou parte da descrição" }) {
  const [q, setQ] = useState(""); const [tipo, setTipo] = useState(""); const [l, busy] = useBusca("/auditorias/busca/registros", q, tipo ? `&tipos=${tipo}` : "");
  return <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
    <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ ...s.input, flex: "0 1 200px" }}><option value="">Todos os tipos</option>{Object.entries(tipos).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select>
    <div style={{ position: "relative", flex: "1 1 280px" }}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} style={{ ...s.input, width: "100%" }} />
      {q.trim().length >= 2 && <div style={caixa(C)}>{busy && !l.length ? <div style={{ padding: 10, color: C.muted, fontSize: 12.5 }}>Buscando…</div> : !l.length ? <div style={{ padding: 10, color: C.muted, fontSize: 12.5 }}>Nada encontrado.</div>
        : l.map((x) => <button key={`${x.tipo}|${x.id}|${x.numero}`} type="button" onClick={() => { onEscolher(x); setQ(""); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: `1px solid ${C.border}55`, padding: "7px 10px", color: C.text, cursor: "pointer" }}>
          <div style={{ fontSize: 13 }}><b>{x.numero}</b> <span style={{ color: C.textSub, fontSize: 11.5 }}>· {x.rotulo}</span></div>
          <div style={{ fontSize: 11.5, color: C.textSub }}>{[x.descricao, x.emissor, dBR(x.data), x.situacao].filter((v) => v && v !== "—").join(" · ")}</div></button>)}</div>}</div>
  </div>;
}

export function TabelaRegistros({ C, regs, onRemover, onAbrir, constatacoes = [] }) {
  if (!regs.length) return null;
  return <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}><thead><tr>{["Número", "Tipo", "Emissor / responsável", "Data", "Situação", "Constatação", ""].map((h) => <th key={h} style={{ textAlign: "left", padding: "5px 8px", color: C.textSub, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>)}</tr></thead>
    <tbody>{regs.map((x, i) => { const c = constatacoes.find((k) => String(k.id) === String(x.constatacao_id)); return <tr key={`${x.tipo}|${x.id}|${i}`}>
      <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}44`, whiteSpace: "nowrap" }}>{onAbrir && x.tela ? <button type="button" onClick={() => onAbrir(x)} title="Abrir a tela do módulo" style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 0, fontWeight: 700 }}>{x.numero} ↗</button> : <b>{x.numero}</b>}</td>
      <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}44` }}>{x.rotulo || x.tipo}</td><td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}44` }}>{x.emissor || "—"}</td>
      <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}44`, whiteSpace: "nowrap" }}>{dBR(x.data)}</td><td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}44` }}>{x.situacao || "—"}</td>
      <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}44`, color: C.textSub }}>{c ? `${c.tipo_nome}${c.requisito ? ` (${c.requisito})` : ""}` : "—"}</td>
      <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}44` }}>{onRemover && !x.constatacao_id && <button type="button" onClick={() => onRemover(i)} aria-label={`Tirar ${x.numero}`} style={{ background: "none", border: "none", color: C.textSub, cursor: "pointer" }}>×</button>}</td></tr>; })}</tbody></table></div>;
}
