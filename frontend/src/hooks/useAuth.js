import { useState, useEffect, useCallback } from "react";

const API_URL = "http://localhost:3001/api";

export function useAuth() {
  const [usuario, setUsuario] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    const restaurarSessao = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        const refresh = localStorage.getItem("refreshToken");

        if (!token) return;

        setAccessToken(token);
        setRefreshToken(refresh);

        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          setUsuario(data.usuario);
          setTenant(data.tenant);
        } else if (res.status === 401) {
          await renovarToken(refresh);
        }
      } catch (err) {
        console.error("Erro ao restaurar sessão:", err);
      }
    };

    restaurarSessao();
  }, []);

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
      logout();
      return null;
    }
  }, []);

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

  const logout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");

    setAccessToken(null);
    setRefreshToken(null);
    setUsuario(null);
    setTenant(null);
    setErro(null);
  }, []);

  return {
    usuario,
    tenant,
    accessToken,
    isLogado: !!usuario,
    loading,
    erro,

    signup,
    login,
    logout,
    mudarSenha,
    renovarToken,

    limparErro: () => setErro(null)
  };
}
