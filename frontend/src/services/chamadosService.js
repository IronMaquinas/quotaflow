// src/services/chamadosService.js
const API_URL = "http://localhost:3001/api/cotacoes";

export const chamadosService = {
  async listar(token) {
    const res = await fetch(`${API_URL}/chamados`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async criar(token, dados) {
    const res = await fetch(`${API_URL}/chamados`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dados),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async atualizar(token, id, dados) {
    const res = await fetch(`${API_URL}/chamados/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dados),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async deletar(token, id) {
    const res = await fetch(`${API_URL}/chamados/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

};