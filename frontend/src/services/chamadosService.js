// services/chamadosService.js
const API_URL = "http://localhost:3001/api/cotacoes";

export const chamadosService = {
  async listar(token, force = false) {
    const url = `${API_URL}/chamados${force ? '?_t=' + Date.now() : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Erro ao listar chamados: ${text}`);
    }
    return res.json();
  },

  async criar(token, dados) {
    const res = await fetch(`${API_URL}/chamados`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dados),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Erro ao criar chamado: ${text}`);
    }
    return res.json();
  },

  async atualizar(token, id, dados) {
    const res = await fetch(`${API_URL}/chamados/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dados),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("❌ Resposta de erro:", text);
      throw new Error(`Erro ao atualizar: ${text}`);
    }
    return JSON.parse(text);
  },

  async deletar(token, id) {
    const res = await fetch(`${API_URL}/chamados/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Erro ao deletar chamado: ${text}`);
    }
    return res.json();
  },
};