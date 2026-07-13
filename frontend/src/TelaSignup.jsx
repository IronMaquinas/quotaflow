import { useState } from "react";
import { useAuth } from "./hooks/useAuth";

const C = {
  bg: "#0a0e14",
  surface: "#111722",
  border: "#1e2535",
  accent: "#3b82f6",
  success: "#22c55e",
  text: "#e2e8f0",
  textSub: "#94a3b8",
  error: "#ef4444",
};

const s = {
  container: {
    minHeight: "100vh",
    background: C.bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    fontFamily: "inherit",
  },
  card: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 40,
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 24px 48px #00000060",
  },
  header: {
    marginBottom: 32,
    textAlign: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: C.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: C.textSub,
    marginBottom: 0,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  formGroup: {
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    color: C.textSub,
    letterSpacing: "0.08em",
    display: "block",
    marginBottom: 6,
    fontWeight: 600,
    textTransform: "uppercase",
  },
  input: {
    width: "100%",
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    padding: "10px 12px",
    color: C.text,
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    transition: "all 0.15s",
  },
  inputFocus: {
    borderColor: C.accent,
    boxShadow: `0 0 0 3px ${C.accent}22`,
  },
  select: {
    width: "100%",
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    padding: "10px 12px",
    color: C.text,
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    appearance: "none",
    transition: "all 0.15s",
    cursor: "pointer",
  },
  button: {
    background: C.accent,
    border: `1px solid ${C.accent}`,
    borderRadius: 7,
    padding: "11px 18px",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.15s",
    marginTop: 8,
  },
  buttonHover: {
    background: "#2563eb",
    borderColor: "#2563eb",
  },
  buttonDisabled: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    color: C.textSub,
    cursor: "not-allowed",
  },
  errorBox: {
    background: "#3f0f0f",
    border: `1px solid #ef4444`,
    borderRadius: 6,
    padding: 12,
    marginBottom: 20,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
  },
  errorButton: {
    background: "transparent",
    border: "none",
    color: C.textSub,
    cursor: "pointer",
    fontSize: 16,
    padding: 0,
  },
  footer: {
    textAlign: "center",
    marginTop: 24,
    fontSize: 13,
    color: C.textSub,
  },
  footerLink: {
    color: C.accent,
    textDecoration: "none",
    fontWeight: 600,
    cursor: "pointer",
  },
  loading: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
};

export default function TelaSignup({ onSignupSuccess }) {
  const { signup, loading, erro, limparErro } = useAuth();
  const [dados, setDados] = useState({
    empresa_nome: "",
    email_admin: "",
    senha: "",
    cnpj: "",
    regiao: "SP",
  });
  const [focusField, setFocusField] = useState(null);

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      const result = await signup(dados);
      if (onSignupSuccess) {
        onSignupSuccess(result);
      } else {
        window.location.href = "/dashboard";
      }
    } catch (err) {
      // Erro já está em 'erro'
    }
  };

  const handleChange = (field, value) => {
    setDados({ ...dados, [field]: value });
  };

  const isFormValid =
    dados.empresa_nome.trim() &&
    dados.email_admin.trim() &&
    dados.senha.length >= 6;

  return (
    <div style={s.container}>
      <div style={s.card}>
        <div style={s.header}>
          <div style={s.title}>Quotaflow</div>
          <div style={s.subtitle}>Criar sua transportadora</div>
        </div>

        {erro && (
          <div style={s.errorBox}>
            <div style={s.errorText}>{erro}</div>
            <button style={s.errorButton} onClick={limparErro}>
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSignup} style={s.form}>
          <div style={s.formGroup}>
            <label style={s.label}>Nome da Transportadora</label>
            <input
              type="text"
              value={dados.empresa_nome}
              onChange={(e) => handleChange("empresa_nome", e.target.value)}
              placeholder="Ex: Transportadora XYZ Ltda"
              disabled={loading}
              style={{
                ...s.input,
                ...(focusField === "empresa_nome" ? s.inputFocus : {}),
                ...(loading ? s.loading : {}),
              }}
              onFocus={() => setFocusField("empresa_nome")}
              onBlur={() => setFocusField(null)}
              required
            />
          </div>

          <div style={s.formGroup}>
            <label style={s.label}>Email do Administrador</label>
            <input
              type="email"
              value={dados.email_admin}
              onChange={(e) => handleChange("email_admin", e.target.value)}
              placeholder="admin@transportadora.com.br"
              disabled={loading}
              style={{
                ...s.input,
                ...(focusField === "email_admin" ? s.inputFocus : {}),
                ...(loading ? s.loading : {}),
              }}
              onFocus={() => setFocusField("email_admin")}
              onBlur={() => setFocusField(null)}
              required
            />
          </div>

          <div style={s.formGroup}>
            <label style={s.label}>Senha (Mínimo 6 caracteres)</label>
            <input
              type="password"
              value={dados.senha}
              onChange={(e) => handleChange("senha", e.target.value)}
              placeholder="••••••"
              disabled={loading}
              style={{
                ...s.input,
                ...(focusField === "senha" ? s.inputFocus : {}),
                ...(loading ? s.loading : {}),
              }}
              onFocus={() => setFocusField("senha")}
              onBlur={() => setFocusField(null)}
              required
            />
          </div>

          <div style={s.formGroup}>
            <label style={s.label}>CNPJ (Opcional)</label>
            <input
              type="text"
              value={dados.cnpj}
              onChange={(e) => handleChange("cnpj", e.target.value)}
              placeholder="00.000.000/0000-00"
              disabled={loading}
              style={{
                ...s.input,
                ...(focusField === "cnpj" ? s.inputFocus : {}),
                ...(loading ? s.loading : {}),
              }}
              onFocus={() => setFocusField("cnpj")}
              onBlur={() => setFocusField(null)}
            />
          </div>

          <div style={s.formGroup}>
            <label style={s.label}>Região Principal</label>
            <select
              value={dados.regiao}
              onChange={(e) => handleChange("regiao", e.target.value)}
              disabled={loading}
              style={{
                ...s.select,
                ...(focusField === "regiao" ? s.inputFocus : {}),
                ...(loading ? s.loading : {}),
              }}
              onFocus={() => setFocusField("regiao")}
              onBlur={() => setFocusField(null)}
            >
              <option value="SP">São Paulo</option>
              <option value="RJ">Rio de Janeiro</option>
              <option value="MG">Minas Gerais</option>
              <option value="RS">Rio Grande do Sul</option>
              <option value="BA">Bahia</option>
              <option value="SC">Santa Catarina</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || !isFormValid}
            style={{
              ...s.button,
              ...(loading || !isFormValid ? s.buttonDisabled : s.buttonHover),
              ...(loading ? s.loading : {}),
            }}
          >
            {loading ? "Criando conta..." : "Criar Transportadora"}
          </button>
        </form>

        <div style={s.footer}>
          Já tem uma conta?{" "}
          <a
            href="#login"
            style={s.footerLink}
            onClick={(e) => {
              e.preventDefault();
              if (onSignupSuccess) {
                window.location.hash = "#login";
              } else {
                window.location.href = "/login";
              }
            }}
          >
            Fazer login
          </a>
        </div>
      </div>
    </div>
  );
}