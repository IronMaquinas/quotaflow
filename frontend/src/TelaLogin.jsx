import { useState } from "react";

// ══════════════════════════════════════════════════════════════════════════════
// TELA LOGIN - CONECTADA AO BACKEND REAL VIA API
// ══════════════════════════════════════════════════════════════════════════════
// ✅ Chama POST /api/auth/login
// ✅ Valida contra Supabase
// ✅ Recebe e salva JWT
// ✅ 100% integrada com backend real

const C = {
  bg: "#0a0e14",
  surface: "#111722",
  border: "#1e2535",
  text: "#ffffff",
  muted: "#64748b",
  accent: "#3b82f6",
  success: "#22c55e",
};

const s = {
  input: {
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    padding: "10px 12px",
    color: C.text,
    fontFamily: "inherit",
    fontSize: 14,
  },
  label: {
    fontSize: 11,
    color: C.muted,
    letterSpacing: "0.08em",
    display: "block",
    marginBottom: 5,
  },
  btn: (enabled = true) => ({
    background: enabled ? C.accent : C.border,
    border: "none",
    borderRadius: 6,
    padding: "12px 18px",
    color: enabled ? "#fff" : C.muted,
    fontWeight: 600,
    cursor: enabled ? "pointer" : "not-allowed",
    fontFamily: "inherit",
    fontSize: 14,
    transition: "all .2s",
    opacity: enabled ? 1 : 0.5,
  }),
  card: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
  },
};

export default function TelaLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSenha, setShowSenha] = useState(false);

  // ─────────────────────────────────────────────────────────────────────
  // FAZER LOGIN VIA API REAL
  // ─────────────────────────────────────────────────────────────────────
  const entrar = async (e) => {
  if (e) e.preventDefault();

  if (!email || !senha) {
    setErro("Preencha email e senha");
    return;
  }

  setErro("");
  setLoading(true);

  try {
    const response = await fetch("http://localhost:3001/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        senha: senha,
      }),
    });

    const data = await response.json();

    console.log("🔍 Response completa:", data);
    console.log("🔍 Tokens:", data.tokens);  // ← MUDE ISTO
    console.log("🔍 Usuario:", data.usuario);

    if (!response.ok) {
      setErro(data.erro || data.message || "Erro ao fazer login");
      setLoading(false);
      return;
    }

    // ✅ LOGIN BEM-SUCEDIDO
    localStorage.setItem("access_token", data.tokens.accessToken);  // ← accessToken
    localStorage.setItem("refresh_token", data.tokens.refreshToken);  // ← refreshToken

    const usuario = {
      id: data.usuario.id,
      nome: data.usuario.nome,
      email: data.usuario.email,
      perfil: data.usuario.perfil || data.usuario.papel || "comprador",
      ativo: true,
      access_token: data.tokens.accessToken,  // ← accessToken
    };

    onLogin(usuario);

  } catch (e) {
    console.error("Erro de conexão:", e);
    setErro("Erro de conexão com o servidor. Verifique se o backend está rodando.");
    setLoading(false);
  }
};

  // ─────────────────────────────────────────────────────────────────────
  // PREENCHIMENTO RÁPIDO (credenciais de teste)
  // ─────────────────────────────────────────────────────────────────────
  const preencherDemo = (email, senha) => {
    setEmail(email);
    setSenha(senha);
    setErro("");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'DM Sans','Segoe UI',sans-serif",
        padding: 20,
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* LOGO */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 5,
                height: 32,
                background: "#f87171",
                borderRadius: 2,
              }}
            />
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: C.text,
                letterSpacing: "0.02em",
              }}
            >
              QuotaFlow
            </span>
          </div>
          <div style={{ fontSize: 13, color: C.muted }}>
            Gestão inteligente de suprimentos
          </div>
        </div>

        {/* CARD DE LOGIN */}
        <div style={{ ...s.card, padding: "32px 28px", marginBottom: 16 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: C.text,
              marginBottom: 24,
            }}
          >
            Entrar na sua conta
          </div>

          <form onSubmit={entrar}>
            {/* CAMPO EMAIL */}
            <div style={{ marginBottom: 14 }}>
              <label style={s.label}>E-MAIL</label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErro("");
                }}
                onKeyDown={(e) => e.key === "Enter" && entrar()}
                placeholder="seu@email.com"
                style={s.input}
                disabled={loading}
              />
            </div>

            {/* CAMPO SENHA */}
            <div style={{ marginBottom: 20 }}>
              <label style={s.label}>SENHA</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showSenha ? "text" : "password"}
                  value={senha}
                  onChange={(e) => {
                    setSenha(e.target.value);
                    setErro("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && entrar()}
                  placeholder="••••••••"
                  style={{ ...s.input, paddingRight: 44 }}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowSenha((v) => !v)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    color: C.muted,
                    cursor: "pointer",
                    fontSize: 16,
                    padding: 0,
                  }}
                >
                  {showSenha ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {/* MENSAGEM DE ERRO */}
            {erro && (
              <div
                style={{
                  background: "#ef444422",
                  border: `1px solid #ef444444`,
                  borderRadius: 7,
                  padding: "10px 14px",
                  marginBottom: 16,
                  fontSize: 12,
                  color: "#ef4444",
                }}
              >
                ⚠️ {erro}
              </div>
            )}

            {/* BOTÃO ENTRAR */}
            <button
              type="submit"
              disabled={!email || !senha || loading}
              style={{
                ...s.btn(email && senha && !loading),
                width: "100%",
                padding: 13,
                fontSize: 15,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {loading ? (
                <>
                  <span
                    style={{
                      animation: "spin 0.8s linear infinite",
                      display: "inline-block",
                    }}
                  >
                    ⟳
                  </span>
                  Verificando...
                </>
              ) : (
                <>
                  → Entrar
                </>
              )}
            </button>

            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          </form>
        </div>

        {/* CREDENCIAIS DE DEMONSTRAÇÃO */}
        <div style={{ ...s.card, padding: "16px 18px" }}>
          <div
            style={{
              fontSize: 10,
              color: C.muted,
              letterSpacing: "0.1em",
              marginBottom: 10,
            }}
          >
            🔐 CREDENCIAIS DE TESTE
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
            }}
          >
            <button
              type="button"
              onClick={() =>
                preencherDemo("marcony@3fase.com.br", "sua_senha_aqui")
              }
              style={{
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "8px 10px",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
                transition: "all .1s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = C.accent)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = C.border)
              }
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                ⚙️ Admin
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: C.muted,
                  marginTop: 2,
                  fontFamily: "'IBM Plex Mono',monospace",
                }}
              >
                marcony@3fase...
              </div>
            </button>

            <button
              type="button"
              onClick={() => preencherDemo("teste@xyz.com.br", "123456")}
              style={{
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "8px 10px",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
                transition: "all .1s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = C.accent)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = C.border)
              }
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                📋 Teste
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: C.muted,
                  marginTop: 2,
                  fontFamily: "'IBM Plex Mono',monospace",
                }}
              >
                teste@xyz.com.br
              </div>
            </button>
          </div>
          <div
            style={{
              fontSize: 10,
              color: C.muted,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            Clique para preencher automaticamente
          </div>
        </div>
      </div>
    </div>
  );
}