// services/equipamentosService.js
import { API_URL } from '../utils/constants';

export const equipamentosService = {
  async listar(accessToken) {
    const res = await fetch(`${API_URL}/equipamentos`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const erro = await res.json();
      throw new Error(erro.erro || 'Erro ao listar equipamentos');
    }
    return res.json();
  },

  async criar(accessToken, dados) {
    const res = await fetch(`${API_URL}/equipamentos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(dados),
    });
    if (!res.ok) {
      const erro = await res.json();
      throw new Error(erro.erro || 'Erro ao criar equipamento');
    }
    return res.json();
  },

  async atualizar(accessToken, id, dados) {
    const res = await fetch(`${API_URL}/equipamentos/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(dados),
    });
    if (!res.ok) {
      const erro = await res.json();
      throw new Error(erro.erro || 'Erro ao atualizar equipamento');
    }
    return res.json();
  },

  async deletar(accessToken, id) {
    const res = await fetch(`${API_URL}/equipamentos/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const erro = await res.json();
      throw new Error(erro.erro || 'Erro ao deletar equipamento');
    }
    return res.json();
  },
};