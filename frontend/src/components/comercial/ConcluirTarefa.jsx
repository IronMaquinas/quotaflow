// components/comercial/ConcluirTarefa.jsx — etapa 18b.3: ⏰ concluir tarefa do Comercial pede o RESULTADO
//   o ☐ abre "O que aconteceu?" — sem o resultado não conclui; o texto fica na tarefa (linha do tempo do BID e Cliente 360°)
import { useState } from "react";

export default function ConcluirTarefa({ C, s, onConcluir }) {
  const [aberto, setAberto] = useState(false); const [r, setR] = useState(""); const [ocupado, setOcupado] = useState(false);
  const ok = async () => { if (!r.trim()) return; setOcupado(true); try { await onConcluir(r.trim()); setAberto(false); setR(""); } catch { /* o erro já aparece na tela */ } finally { setOcupado(false); } };
  if (!aberto) return <input type="checkbox" checked={false} onChange={() => setAberto(true)} title="Concluir (conte o resultado)" style={{ marginTop: 3 }} />;
  return <div style={{ flexBasis: "100%", order: 9, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
    <input autoFocus value={r} onChange={(e) => setR(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ok(); if (e.key === "Escape") setAberto(false); }}
      placeholder="O que aconteceu? Ex.: liguei, vai decidir sexta" style={{ ...s.input, flex: "1 1 220px", fontSize: 12.5, padding: "5px 8px" }} />
    <button type="button" onClick={() => { setAberto(false); setR(""); }} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>Voltar</button>
    <button type="button" disabled={ocupado || !r.trim()} onClick={ok} style={{ ...s.btn(true), padding: "5px 12px", fontSize: 12 }}>✓ Concluir</button>
  </div>;
}
