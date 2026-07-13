// services/chamadosService.js
// API calls para gerenciar chamados (requisições de peças)

import { API_URL } from "../utils/constants";

export const chamadosService = {
  // GET /api/cotacoes/chamados - Listar chamados do tenant
  async listar(accessToken) {
    try {
      const res = await fetch(`${API_URL}/cotacoes/chamados`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || "Erro ao listar chamados");
      }

      return await res.json();
    } catch (err) {
      console.error("❌ Erro ao listar chamados:", err);
      throw err;
    }
  },

  // POST /api/cotacoes/chamados - Criar novo chamado
  async criar(accessToken, dados) {
    try {
      const res = await fetch(`${API_URL}/cotacoes/chamados`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(dados),
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || "Erro ao criar chamado");
      }

      return await res.json();
    } catch (err) {
      console.error("❌ Erro ao criar chamado:", err);
      throw err;
    }
  },

  // PUT /api/cotacoes/:id/finalizar - Aprovar cotação e finalizar chamado
  async finalizar(accessToken, cotacaoId, fornecedorId, valorNegociado) {
    try {
      const res = await fetch(`${API_URL}/cotacoes/${cotacaoId}/finalizar`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          fornecedor_id: fornecedorId,
          valor_negociado: valorNegociado,
        }),
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || "Erro ao finalizar cotação");
      }

      return await res.json();
    } catch (err) {
      console.error("❌ Erro ao finalizar cotação:", err);
      throw err;
    }
  },
};
