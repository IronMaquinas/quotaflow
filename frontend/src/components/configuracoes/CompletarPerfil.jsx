// frontend/src/components/configuracoes/CompletarPerfil.jsx — etapa 14d.5
// Cartão "Complete o perfil da sua empresa" na tela inicial (admin, gestor): barra de progresso + itens que faltam.
// Cada item abre a aba certa de ⚙️ Configurações. Some sozinho quando está tudo completo; dá para minimizar.
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";

const CHAVE = "qf_perfil_minimizado";
const ler = () => { try { return localStorage.getItem(CHAVE) === "1"; } catch { return false; } };
const gravar = (v) => { try { localStorage.setItem(CHAVE, v ? "1" : "0"); } catch { /* ok */ } };

export default function CompletarPerfil({ C, s, onAbrir }) {
  const [st, setSt] = useState(null);
  const [mini, setMini] = useState(ler);
  useEffect(() => { apiService.get("/configuracoes/empresa/status").then(setSt).catch(() => setSt(null)); }, []);
  if (!st || st.completo) return null;
  const pct = Math.round((st.feitos / st.total) * 100);
  const barra = <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden", flex: 1 }}><div style={{ width: `${pct}%`, height: "100%", background: C.accent }} /></div>;

  if (mini) return (
    <div onClick={() => { setMini(false); gravar(false); }} className="qf-clicavel" style={{ ...s.card, padding: "10px 14px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>🏢 Perfil da empresa {st.feitos}/{st.total}</span>{barra}<span style={{ fontSize: 12, color: C.accent }}>completar ›</span>
    </div>
  );
  return (
    <div style={{ ...s.card, padding: "16px 18px", marginBottom: 24, textAlign: "left", border: `1px solid ${C.accent}55` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>🏢 Complete o perfil da sua empresa</div>
        <button type="button" onClick={() => { setMini(true); gravar(true); }} className="qf-clicavel" style={{ background: "none", border: "none", color: C.muted, fontSize: 12 }}>minimizar</button>
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Os dados vão nos contratos, relatórios e no Canal Spot. Leva 2 minutos.</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>{barra}<span style={{ fontSize: 12, color: C.textSub }}>{st.feitos} de {st.total}</span></div>
      {st.itens.map((i) => (
        <div key={i.id} onClick={i.ok ? undefined : () => onAbrir?.(i.aba)} className={i.ok ? undefined : "qf-clicavel"}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 6, fontSize: 13, color: i.ok ? C.muted : C.text }}>
          <span>{i.ok ? "✅" : "⬜"}</span>
          <span style={{ flex: 1, textDecoration: i.ok ? "line-through" : "none" }}>{i.titulo}{!i.ok && i.falta?.length ? <span style={{ fontSize: 11, color: C.muted }}> — falta: {i.falta.join(", ")}</span> : null}</span>
          {!i.ok && <span style={{ fontSize: 12, color: C.accent, whiteSpace: "nowrap" }}>completar ›</span>}
        </div>
      ))}
    </div>
  );
}
