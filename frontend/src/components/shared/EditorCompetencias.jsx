// components/shared/EditorCompetencias.jsx — etapa 12e.3
// Lista de competências exigidas pela função ("atende / não atende" na Ficha do colaborador) + CNH mínima.
// Usado em Pessoas → 👔 Funções e no Console → 📚 Biblioteca de funções.
// valor = [{ codigo?, nome, reavaliar_meses }] · sugestoes = [texto] · ui = { text, sub, border, accent, danger, input, label, tag(cor) }
import { useState } from "react";

export default function EditorCompetencias({ valor = [], onChange, sugestoes = [], ui }) {
  const [novo, setNovo] = useState("");
  const tem = (n) => valor.some((c) => c.nome.trim().toLowerCase() === n.trim().toLowerCase());
  const add = (n) => { const t = String(n || "").trim(); if (!t || tem(t)) return; onChange([...valor, { nome: t, reavaliar_meses: "" }]); setNovo(""); };
  const livres = sugestoes.filter((x) => !tem(x));
  return (
    <div>
      <span style={ui.label}>COMPETÊNCIAS EXIGIDAS (O GESTOR AVALIA “ATENDE / NÃO ATENDE” NA FICHA)</span>
      {valor.map((c, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
          <input value={c.nome} onChange={(e) => onChange(valor.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)))} style={{ ...ui.input, flex: 1, padding: "5px 10px", fontSize: 12 }} />
          <input type="number" min={1} max={120} value={c.reavaliar_meses ?? ""} onChange={(e) => onChange(valor.map((x, k) => (k === i ? { ...x, reavaliar_meses: e.target.value } : x)))} placeholder="reavaliar (meses)" title="Vazio = não precisa reavaliar" style={{ ...ui.input, width: 130, padding: "5px 8px", fontSize: 12 }} />
          <button type="button" onClick={() => onChange(valor.filter((_, k) => k !== i))} style={{ background: "none", border: "none", color: ui.danger, cursor: "pointer", fontSize: 15 }}>×</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <input value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(novo); } }} placeholder="＋ Outra competência (Enter)" style={{ ...ui.input, flex: 1, padding: "5px 10px", fontSize: 12 }} />
        <button type="button" disabled={!novo.trim()} onClick={() => add(novo)} style={{ background: "none", border: `1px solid ${ui.border}`, borderRadius: 6, color: ui.accent, cursor: "pointer", padding: "4px 10px", fontSize: 12, fontFamily: "inherit" }}>Adicionar</button>
      </div>
      {livres.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          <span style={{ fontSize: 11, color: ui.sub, alignSelf: "center" }}>Sugestões:</span>
          {livres.map((x) => <button type="button" key={x} onClick={() => add(x)} style={{ ...ui.tag(ui.sub), cursor: "pointer", fontFamily: "inherit" }}>＋ {x}</button>)}
        </div>
      )}
    </div>
  );
}

/** Para enviar ao backend */
export const limparCompetencias = (l = []) => l.filter((c) => String(c.nome || "").trim()).map((c) => ({ ...(c.codigo ? { codigo: c.codigo } : {}), nome: c.nome.trim(), reavaliar_meses: c.reavaliar_meses === "" || c.reavaliar_meses == null ? null : Number(c.reavaliar_meses) }));
