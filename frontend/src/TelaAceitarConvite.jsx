// src/TelaAceitarConvite.jsx
//
// Etapa 10 — o fornecedor abre o link do convite (<FRONTEND_URL>/#convite?token=...),
// cria nome + senha e já entra no portal (#/portal).
// Rota registrada no main.jsx.

import { useState, useEffect } from "react";
import { API_URL } from "./utils/constants";
import apiService from "./services/apiService";

const C = {
  bg: "#0a0e14", surface: "#111722", border: "#1e2535", text: "#e2e8f0",
  muted: "#64748b", accent: "#3b82f6", success: "#22c55e", danger: "#ef4444",
};
const input = {
  width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6,
  padding: "10px 12px", color: C.text, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
const label = { fontSize: 11, color: C.muted, letterSpacing: "0.08em", display: "block", marginBottom: 5, fontWeight: 600 };

function tokenDaUrl() {
  const h = window.location.hash || "";
  const q = h.includes("?") ? h.slice(h.indexOf("?") + 1) : "";
  return new URLSearchParams(q).get("token") || new URLSearchParams(window.location.search).get("token") || "";
}

export default function TelaAceitarConvite() {
  const [token] = useState(tokenDaUrl);
  const [convite, setConvite] = useState(null); // { ok, empresa, cliente, email } | { ok:false, mensagem }
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/auth/convite/validar?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then(setConvite)
      .catch(() => setConvite({ ok: false, mensagem: "Erro de conexão com o servidor." }));
  }, [token]);

  const irParaLogin = () => { window.location.hash = "#login"; };

  const criarAcesso = async (e) => {
    e.preventDefault();
    setErro("");
    if (!nome.trim()) return setErro("Informe seu nome.");
    if (senha.length < 6) return setErro("A senha deve ter ao menos 6 caracteres.");
    if (senha !== confirmar) return setErro("A confirmação não confere com a senha.");
    setEnviando(true);
    try {
      const r = await fetch(`${API_URL}/auth/convite/aceitar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, nome: nome.trim(), senha }),
      });
      const data = await r.json();
      if (!r.ok) { setErro(data.erro || "Não foi possível criar o acesso."); setEnviando(false); return; }

      // Mesmo efeito do login de fornecedor (TelaLogin + App.login)
      const usuario = {
        id: data.usuario.id,
        nome: data.usuario.nome,
        email: data.usuario.email,
        perfil: data.usuario.perfil || "fornecedor",
        ativo: true,
        access_token: data.token,
        fornecedor_id: data.usuario.fornecedor_id,
      };
      localStorage.setItem("access_token", data.token);
      localStorage.setItem("refresh_token", "");
      localStorage.setItem("user_type", "fornecedor");
      localStorage.setItem("usuario", JSON.stringify(usuario));
      if (typeof apiService.setToken === "function") apiService.setToken(data.token);
      window.location.hash = "#/portal";
    } catch {
      setErro("Erro de conexão com o servidor.");
      setEnviando(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 5, height: 30, background: "#f87171", borderRadius: 2 }} />
            <span style={{ fontSize: 22, fontWeight: 700, color: C.text }}>QuotaFlow</span>
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>Portal do fornecedor</div>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "28px 26px" }}>
          {!convite && <div style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>Verificando convite…</div>}

          {convite && !convite.ok && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>Convite indisponível</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 18, lineHeight: 1.5 }}>{convite.mensagem || "Este convite não é válido."}</div>
              <button onClick={irParaLogin} style={{ background: C.accent, border: "none", borderRadius: 6, padding: "10px 18px", color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Ir para o login
              </button>
            </div>
          )}

          {convite && convite.ok && (
            <form onSubmit={criarAcesso}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>Crie seu acesso</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 18, lineHeight: 1.5 }}>
                <b style={{ color: C.text }}>{convite.cliente || "Seu cliente"}</b> convidou <b style={{ color: C.text }}>{convite.empresa || "sua empresa"}</b> para o portal.
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={label}>E-MAIL DE ACESSO</label>
                <input value={convite.email} disabled style={{ ...input, opacity: 0.7 }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={label}>SEU NOME</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como você quer ser chamado" style={input} autoFocus />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={label}>SENHA</label>
                <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" style={input} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={label}>CONFIRMAR SENHA</label>
                <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} style={input} />
              </div>

              {erro && (
                <div style={{ background: "#ef444422", border: "1px solid #ef444444", borderRadius: 7, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: C.danger }}>
                  ⚠️ {erro}
                </div>
              )}

              <button type="submit" disabled={enviando}
                style={{ width: "100%", background: C.accent, border: "none", borderRadius: 6, padding: 13, color: "#fff", fontWeight: 600, fontSize: 15, cursor: enviando ? "not-allowed" : "pointer", opacity: enviando ? 0.6 : 1, fontFamily: "inherit" }}>
                {enviando ? "Criando acesso…" : "Criar acesso e entrar"}
              </button>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 12, textAlign: "center", lineHeight: 1.5 }}>
                O portal é gratuito. Depois de entrar, confira os dados da sua empresa em <b>Meus Dados</b>.
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
