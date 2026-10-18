// src/TelaConfirmarEmail.jsx
//
// Link do e-mail de confirmação (etapa 11a.3): <FRONTEND_URL>/#confirmar-email?token=...
// Confirma ao abrir e mostra o resultado. Rota registrada no main.jsx.

import { useState, useEffect } from "react";
import { API_URL } from "./utils/constants";

const C = { bg: "#0a0e14", surface: "#111722", border: "#1e2535", text: "#e2e8f0", muted: "#64748b", accent: "#3b82f6", success: "#22c55e", danger: "#ef4444" };

function tokenDaUrl() {
  const h = window.location.hash || "";
  const q = h.includes("?") ? h.slice(h.indexOf("?") + 1) : "";
  return new URLSearchParams(q).get("token") || "";
}

export default function TelaConfirmarEmail() {
  const [resultado, setResultado] = useState(null); // { ok, tipo } | { ok:false, erro }

  useEffect(() => {
    fetch(`${API_URL}/auth/confirmar-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tokenDaUrl() }),
    })
      .then(async (r) => setResultado(await r.json()))
      .catch(() => setResultado({ ok: false, erro: "Erro de conexão com o servidor." }));
  }, []);

  const fornecedor = resultado?.tipo === "fornecedor_usuario";
  const entrar = () => {
    try { sessionStorage.setItem("qf_login_prefill", JSON.stringify({ fornecedor })); } catch { /* ok */ }
    window.location.hash = "#login"; // a aba Comprador/Fornecedor já vem certa
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 5, height: 30, background: "#f87171", borderRadius: 2 }} />
            <span style={{ fontSize: 22, fontWeight: 700, color: C.text }}>QuotaFlow</span>
          </div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "28px 26px", textAlign: "center" }}>
          {!resultado && <div style={{ color: C.muted, fontSize: 13 }}>Confirmando seu e-mail…</div>}
          {resultado?.ok && (
            <>
              <div style={{ fontSize: 34, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 8 }}>E-mail confirmado!</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>
                Obrigado. Isso ajuda na análise do cadastro da sua empresa.
              </div>
            </>
          )}
          {resultado && !resultado.ok && (
            <>
              <div style={{ fontSize: 34, marginBottom: 8 }}>⚠️</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 8 }}>Não foi possível confirmar</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>{resultado.erro || "Link inválido."}</div>
            </>
          )}
          {resultado && (
            <button type="button" onClick={entrar}
              style={{ width: "100%", background: C.accent, border: "none", borderRadius: 6, padding: 12, color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
              Entrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
