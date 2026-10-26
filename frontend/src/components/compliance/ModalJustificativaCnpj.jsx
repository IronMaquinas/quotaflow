// frontend/src/components/compliance/ModalJustificativaCnpj.jsx — etapa 14e
// Fornecedor com CNPJ irregular na Receita: para emitir a OC ou lançar a nota (pagamento), o sistema pede uma
// JUSTIFICATIVA por fornecedor (mín. 15 caracteres). Fica registrada (quem, quando, situação) — 🛡 Monitor de CNPJs.
// Uso: <ModalJustificativaCnpj trava={err.body} onConfirmar={(mapa) => ...} onCancelar={() => ...} C={C} />
import { useState } from "react";

const fmt = (d) => (String(d || "").length === 14 ? String(d).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : d || "—");

export default function ModalJustificativaCnpj({ trava, onConfirmar, onCancelar, C = {}, ocupado = false }) {
  const fs = trava?.fornecedores || [];
  const [just, setJust] = useState({});
  if (!fs.length) return null;
  const ok = fs.every((f) => String(just[f.fornecedor_id] || "").trim().length >= 15);
  const cor = { bg: C.surface || "#111722", border: C.border || "#1e2535", text: C.text || "#e2e8f0", muted: C.muted || "#94a3b8", danger: C.danger || "#ef4444", accent: C.accent || "#3b82f6" };
  const acao = trava.contexto === "nota" ? "lançar a nota (pagamento)" : "emitir a ordem de compra";
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: cor.bg, border: `1px solid ${cor.danger}`, borderRadius: 10, padding: 20, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", color: cor.text }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>🛡 CNPJ irregular na Receita</div>
        <div style={{ fontSize: 13, color: cor.muted, lineHeight: 1.6, marginBottom: 14 }}>
          Para {acao}, registre por que é seguro seguir (ex.: "conferi a certidão de hoje, a situação já foi regularizada"). A justificativa fica registrada com o seu nome, a data e a situação na Receita.
        </div>
        {fs.map((f) => (
          <div key={f.fornecedor_id} style={{ border: `1px solid ${cor.border}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>{f.nome}</div>
            <div style={{ fontSize: 12, color: cor.muted, marginBottom: 8 }}>CNPJ {fmt(f.cnpj)} · situação <b style={{ color: cor.danger }}>{f.situacao}</b>{f.verificado_em ? ` · verificado em ${new Date(f.verificado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : ""}</div>
            <textarea rows={3} maxLength={1000} value={just[f.fornecedor_id] || ""} onChange={(e) => setJust({ ...just, [f.fornecedor_id]: e.target.value })}
              placeholder="Justificativa (mínimo 15 caracteres)"
              style={{ width: "100%", boxSizing: "border-box", background: C.bg || "#0a0e14", color: cor.text, border: `1px solid ${cor.border}`, borderRadius: 6, padding: 8, fontFamily: "inherit", fontSize: 13, resize: "vertical" }} />
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
          <button type="button" onClick={onCancelar} disabled={ocupado} style={{ background: "transparent", color: cor.muted, border: `1px solid ${cor.border}`, borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
          <button type="button" disabled={!ok || ocupado} onClick={() => onConfirmar(just)} style={{ background: cor.danger, color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontWeight: 600, cursor: ok ? "pointer" : "not-allowed", opacity: ok && !ocupado ? 1 : 0.5, fontFamily: "inherit" }}>{ocupado ? "Registrando…" : "Registrar e seguir"}</button>
        </div>
      </div>
    </div>
  );
}
