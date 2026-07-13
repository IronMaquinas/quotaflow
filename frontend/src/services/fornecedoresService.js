// services/fornecedoresService.js
import { API_URL } from '../utils/constants';

export const fornecedoresService = {
  async listar(token) {
    const res = await fetch(`${API_URL}/fornecedores`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async criar(token, dados) {
    const res = await fetch(`${API_URL}/fornecedores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(dados),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async atualizar(token, id, dados) {
    const res = await fetch(`${API_URL}/fornecedores/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(dados),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async deletar(token, id) {
    const res = await fetch(`${API_URL}/fornecedores/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};