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
  },

  async buscarChamadoComItens(accessToken, chamadoId) {
    const response = await fetch(`${API_URL}/cotacoes/por-chamado/${chamadoId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      const erro = await response.json();
      throw new Error(erro.erro || "Erro ao buscar chamado");
    }
    return response.json();
  },

  async salvarCotacao(accessToken, payload) {
    const response = await fetch(`${API_URL}/cotacoes/salvar`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const erro = await response.json();
      throw new Error(erro.erro || "Erro ao salvar cotação");
    }
    return response.json();
  },

  async enviarCotacao(accessToken, cotacaoId) {
    const response = await fetch(`${API_URL}/cotacoes/enviar`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cotacao_id: cotacaoId }),
    });
    if (!response.ok) {
      const erro = await response.json();
      throw new Error(erro.erro || "Erro ao enviar cotação");
    }
    return response.json();
  },

    async atualizarCotacao(token, cotacaoId, dados) {
    const url = `${API_URL}/cotacoes/${cotacaoId}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  async excluirCotacao(token, cotacaoId) {
    const url = `${API_URL}/cotacoes/${cotacaoId}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  async buscarDetalhes(token, id) {
    const url = `${API_URL}/cotacoes/${id}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  async criarOrdenVenda(accessToken, cotacaoId, fornecedorId) {
    const response = await fetch(`${API_URL}/cotacoes/${cotacaoId}/ordem-venda`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fornecedor_id: fornecedorId }),
    });

    if (!response.ok) {
      const erro = await response.json();
      throw new Error(erro.erro || "Erro ao criar ordem de venda");
    }

    return response.json();
  },

  async obterStatusCotacao(accessToken, cotacaoId) {
  const response = await fetch(`${API_URL}/cotacoes/${cotacaoId}/monitorar`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const erro = await response.json();
      throw new Error(erro.erro || "Erro ao obter status");
    }

    return response.json();
  },

  async atualizarRespostaFornecedor(accessToken, cotacaoId, fornecedorId, dados) {
    const response = await fetch(
      `${API_URL}/cotacoes/${cotacaoId}/fornecedor/${fornecedorId}/atualizar-resposta`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dados),
      }
    );

    if (!response.ok) {
      const erro = await response.json();
      throw new Error(erro.erro || "Erro ao atualizar resposta");
    }

    return response.json();
  }

};
