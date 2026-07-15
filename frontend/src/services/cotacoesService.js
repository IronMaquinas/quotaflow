// services/cotacoesService.js
// API calls para gerenciar cotações

import { API_URL } from "../utils/constants";

export const cotacoesService = {
  // GET /api/cotacoes - Listar cotações do tenant
  async listar(accessToken) {
    try {
      const res = await fetch(`${API_URL}/cotacoes`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || "Erro ao listar cotações");
      }

      return await res.json();
    } catch (err) {
      console.error("❌ Erro ao listar cotações:", err);
      throw err;
    }
  },

  // POST /api/cotacoes - Criar cotação e enviar para fornecedores
  async criar(accessToken, chamadoId, fornecedores) {
    try {
      const res = await fetch(`${API_URL}/cotacoes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          chamado_id: chamadoId,
          fornecedores: fornecedores,
        }),
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || "Erro ao criar cotação");
      }

      return await res.json();
    } catch (err) {
      console.error("❌ Erro ao criar cotação:", err);
      throw err;
    }
  },

  // GET /api/cotacao/:token - Portal fornecedor (público)
  async buscarPorToken(token) {
    try {
      const res = await fetch(`${API_URL}/cotacao/${token}`);

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || "Cotação não encontrada");
      }

      return await res.json();
    } catch (err) {
      console.error("❌ Erro ao buscar cotação:", err);
      throw err;
    }
  },

  // POST /api/cotacao/:token/responder - Fornecedor responder cotação
  async responder(token, resposta) {
    try {
      const res = await fetch(`${API_URL}/cotacao/${token}/responder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resposta),
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || "Erro ao responder cotação");
      }

      return await res.json();
    } catch (err) {
      console.error("❌ Erro ao responder cotação:", err);
      throw err;
    }
  },

  // Gerar cotações automaticamente
  async gerarAutomaticamente(accessToken, chamado_id) {
    try {
      const res = await fetch(`${API_URL}/cotacoes/gerar-automaticamente`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ chamado_id })
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || 'Erro ao gerar cotações');
      }

      return await res.json();
    } catch (err) {
      console.error('❌ Erro ao gerar cotações:', err);
      throw err;
    }
  }

};
