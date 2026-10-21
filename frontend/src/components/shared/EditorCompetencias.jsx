// components/shared/EditorCompetencias.jsx — etapa 12e.3
// Lista de competências exigidas pela função ("atende / não atende" na Ficha do colaborador) + CNH mínima.
// Usado em Pessoas → 👔 Funções e no Console → 📚 Biblioteca de funções.
// valor = [{ codigo?, nome, reavaliar_meses, nivel_esperado, treinamentos: [codigo] }] · sugestoes = [texto]
// treinamentos = [{ codigo, nome }] (catálogo, para ligar "treinamentos que sustentam" — 12e.3.1)
// ui = { text, sub, border, accent, danger, input, label, tag(cor) }
import { useState } from "react";

export const NIVEIS = [[1, "1 · Não atende"], [2, "2 · Em desenvolvimento"], [3, "3 · Atende"], [4, "4 · Referência"]];
export default function EditorCompetencias({ valor = [], onChange, sugestoes = [], treinamentos = [], ui }) {
  const [ligando, setLigando] = useState(null);
  const [novo, setNovo] = useState("");
  const tem = (n) => valor.some((c) => c.nome.trim().toLowerCase() === n.trim().toLowerCase());
  const add = (n) => { const t = String(n || "").trim(); if (!t || tem(t)) return; onChange([...valor, { nome: t, reavaliar_meses: "", nivel_esperado: 3, treinamentos: [] }]); setNovo(""); };
  const nomeTr = (c) => treinamentos.find((t) => t.codigo === c)?.nome || c;
  const livres = sugestoes.filter((x) => !tem(x));
  return (
    <div>
      <span style={ui.label}>COMPETÊNCIAS EXIGIDAS (O GESTOR AVALIA “ATENDE / NÃO ATENDE” NA FICHA)</span>
      {valor.map((c, i) => {
        const muda = (campo, v) => onChange(valor.map((x, k) => (k === i ? { ...x, [campo]: v } : x)));
        const trs = c.treinamentos || [];
        return (
          <div key={i} style={{ border: `1px solid ${ui.border}`, borderRadius: 6, padding: 6, marginBottom: 6 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <input value={c.nome} onChange={(e) => muda("nome", e.target.value)} style={{ ...ui.input, flex: "2 1 200px", padding: "5px 10px", fontSize: 12 }} />
              <select value={c.nivel_esperado || 3} onChange={(e) => muda("nivel_esperado", Number(e.target.value))} title="Nota mínima para contar como “atende”" style={{ ...ui.input, width: 170, padding: "5px 8px", fontSize: 12 }}>
                {NIVEIS.map(([n, l]) => <option key={n} value={n}>esperado: {l}</option>)}</select>
              <input type="number" min={1} max={120} value={c.reavaliar_meses ?? ""} onChange={(e) => muda("reavaliar_meses", e.target.value)} placeholder="reavaliar (meses)" title="Vazio = não precisa reavaliar" style={{ ...ui.input, width: 130, padding: "5px 8px", fontSize: 12 }} />
              <button type="button" onClick={() => onChange(valor.filter((_, k) => k !== i))} style={{ background: "none", border: "none", color: ui.danger, cursor: "pointer", fontSize: 15 }}>×</button>
            </div>
            {treinamentos.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 6, fontSize: 11 }}>
                <span style={{ color: ui.sub }}>🎓 sustentada por:</span>
                {trs.map((t) => <span key={t} style={ui.tag("#ec4899")}>{nomeTr(t)} <button type="button" onClick={() => muda("treinamentos", trs.filter((x) => x !== t))} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0 }}>×</button></span>)}
                {ligando === i
                  ? <select autoFocus value="" onChange={(e) => { if (e.target.value) muda("treinamentos", [...trs, e.target.value]); setLigando(null); }} onBlur={() => setLigando(null)} style={{ ...ui.input, width: 240, padding: "3px 6px", fontSize: 11 }}>
                      <option value="">escolha o treinamento…</option>{treinamentos.filter((t) => !trs.includes(t.codigo)).map((t) => <option key={t.codigo} value={t.codigo}>{t.nome}</option>)}</select>
                  : <button type="button" onClick={() => setLigando(i)} style={{ background: "none", border: "none", color: ui.accent, cursor: "pointer", fontSize: 11, padding: 0, fontFamily: "inherit" }}>＋ ligar treinamento</button>}
              </div>
            )}
          </div>
        );
      })}
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
export const limparCompetencias = (l = []) => l.filter((c) => String(c.nome || "").trim()).map((c) => ({ ...(c.codigo ? { codigo: c.codigo } : {}), nome: c.nome.trim(), reavaliar_meses: c.reavaliar_meses === "" || c.reavaliar_meses == null ? null : Number(c.reavaliar_meses), nivel_esperado: Number(c.nivel_esperado || 3), treinamentos: c.treinamentos || [] }));
