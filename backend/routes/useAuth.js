// ════════════════════════════════════════════════════════════════════════════════
// hooks/useAuth.js: HOOK COMPLETO DE AUTENTICAÇÃO
// ════════════════════════════════════════════════════════════════════════════════
// Uso:
// const { login, signup, logout, usuario, tenant, loading, erro } = useAuth();
// ════════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";

const API_URL = "http://localhost:3001/api";

export function useAuth() {
  const [usuario, setUsuario] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  // ─────────────────────────────────────────────────────────────────────────
  // INICIALIZAR: Carregar tokens do localStorage e restaurar sessão
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const restaurarSessao = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        const refresh = localStorage.getItem("refreshToken");

        if (!token) return;

        setAccessToken(token);
        setRefreshToken(refresh);

        // Buscar dados do usuário
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          setUsuario(data.usuario);
          setTenant(data.tenant);
        } else if (res.status === 401) {
          // Token expirado, tentar renovar
          await renovarToken(refresh);
        }
      } catch (err) {
        console.error("Erro ao restaurar sessão:", err);
      }
    };

    restaurarSessao();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // RENOVAR TOKEN
  // ─────────────────────────────────────────────────────────────────────────

  const renovarToken = useCallback(async (refresh) => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh })
      });

      if (!res.ok) {
        throw new Error("Refresh token inválido");
      }

      const data = await res.json();
      const novoAccessToken = data.tokens.accessToken;
      const novoRefreshToken = data.tokens.refreshToken;

      localStorage.setItem("accessToken", novoAccessToken);
      localStorage.setItem("refreshToken", novoRefreshToken);

      setAccessToken(novoAccessToken);
      setRefreshToken(novoRefreshToken);

      return novoAccessToken;
    } catch (err) {
      console.error("Erro ao renovar token:", err);
      logout(); // Fazer logout se refresh falhar
      return null;
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // SIGNUP: Criar nova transportadora
  // ─────────────────────────────────────────────────────────────────────────

  const signup = useCallback(async (dados) => {
    try {
      setLoading(true);
      setErro(null);

      const res = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.erro || "Erro ao criar conta");
      }

      // Salvar tokens
      localStorage.setItem("accessToken", data.tokens.accessToken);
      localStorage.setItem("refreshToken", data.tokens.refreshToken);

      setAccessToken(data.tokens.accessToken);
      setRefreshToken(data.tokens.refreshToken);
      setUsuario(data.usuario);
      setTenant(data.tenant);

      return data;
    } catch (err) {
      setErro(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // LOGIN: Fazer login
  // ─────────────────────────────────────────────────────────────────────────

  const login = useCallback(async (email, senha, tenant_slug = null) => {
    try {
      setLoading(true);
      setErro(null);

      const body = { email, senha };
      if (tenant_slug) body.tenant_slug = tenant_slug;

      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.erro || "Erro ao fazer login");
      }

      // Salvar tokens
      localStorage.setItem("accessToken", data.tokens.accessToken);
      localStorage.setItem("refreshToken", data.tokens.refreshToken);

      setAccessToken(data.tokens.accessToken);
      setRefreshToken(data.tokens.refreshToken);
      setUsuario(data.usuario);
      setTenant(data.tenant);

      return data;
    } catch (err) {
      setErro(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // CHANGE PASSWORD: Trocar senha
  // ─────────────────────────────────────────────────────────────────────────

  const mudarSenha = useCallback(async (senhaAtual, senhaNova) => {
    try {
      setLoading(true);
      setErro(null);

      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ senhaAtual, senhaNova })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.erro || "Erro ao mudar senha");
      }

      return data;
    } catch (err) {
      setErro(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // ─────────────────────────────────────────────────────────────────────────
  // LOGOUT: Sair
  // ─────────────────────────────────────────────────────────────────────────

  const logout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");

    setAccessToken(null);
    setRefreshToken(null);
    setUsuario(null);
    setTenant(null);
    setErro(null);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // RETORNAR ESTADO E FUNÇÕES
  // ─────────────────────────────────────────────────────────────────────────

  return {
    // Estado
    usuario,
    tenant,
    accessToken,
    isLogado: !!usuario,
    loading,
    erro,

    // Funções
    signup,
    login,
    logout,
    mudarSenha,
    renovarToken,

    // Helpers
    limparErro: () => setErro(null)
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// EXEMPLO DE USO:
// ════════════════════════════════════════════════════════════════════════════════

/*
function TelaLogin() {
  const { login, loading, erro, limparErro } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login(email, senha);
      // Redirecionar para dashboard
      window.location.href = "/dashboard";
    } catch (err) {
      // Erro já está em 'erro'
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        placeholder="Senha"
        required
      />
      {erro && <div style={{ color: "red" }}>{erro}</div>}
      <button type="submit" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}

function TelaSignup() {
  const { signup, loading, erro } = useAuth();
  const [dados, setDados] = useState({
    empresa_nome: "",
    email_admin: "",
    senha: "",
    cnpj: "",
    regiao: "SP"
  });

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      await signup(dados);
      window.location.href = "/dashboard";
    } catch (err) {
      // Erro já está em 'erro'
    }
  };

  return (
    <form onSubmit={handleSignup}>
      <input
        type="text"
        value={dados.empresa_nome}
        onChange={(e) => setDados({ ...dados, empresa_nome: e.target.value })}
        placeholder="Nome da Transportadora"
        required
      />
      <input
        type="email"
        value={dados.email_admin}
        onChange={(e) => setDados({ ...dados, email_admin: e.target.value })}
        placeholder="Email Admin"
        required
      />
      <input
        type="password"
        value={dados.senha}
        onChange={(e) => setDados({ ...dados, senha: e.target.value })}
        placeholder="Senha"
        required
      />
      <input
        type="text"
        value={dados.cnpj}
        onChange={(e) => setDados({ ...dados, cnpj: e.target.value })}
        placeholder="CNPJ (opcional)"
      />
      <select
        value={dados.regiao}
        onChange={(e) => setDados({ ...dados, regiao: e.target.value })}
      >
        <option value="SP">São Paulo</option>
        <option value="RJ">Rio de Janeiro</option>
        <option value="MG">Minas Gerais</option>
        <option value="RS">Rio Grande do Sul</option>
      </select>
      {erro && <div style={{ color: "red" }}>{erro}</div>}
      <button type="submit" disabled={loading}>
        {loading ? "Criando..." : "Criar Conta"}
      </button>
    </form>
  );
}
*/
