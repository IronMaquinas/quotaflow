// hooks/useOrdensVenda.js
import { useState } from 'react';
import apiService from '../services/apiService';

export function useOrdensVenda() {
  const [ordens, setOrdens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const listar = async () => {
    const token = localStorage.getItem('access_token');
    
    // 🔥 SE NÃO HOUVER TOKEN, NÃO FAZ REQUISIÇÃO
    if (!token) {
      console.log('⏳ Token não encontrado, aguardando login...');
      return;
    }

    try {
      setLoading(true);
      setErro(null);
      const data = await apiService.get('/ordens-venda');
      setOrdens(data || []);
    } catch (err) {
      console.error('❌ Erro ao listar OVs:', err);
      // Se for erro de autenticação, não faz nada (o apiService já redireciona)
      if (err.message?.includes('401') || err.message?.includes('unauthorized')) {
        return;
      }
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  };

  const buscarPorId = async (id) => {
    try {
      const data = await apiService.get(`/ordens-venda/${id}`);
      return data;
    } catch (err) {
      console.error('Erro ao buscar OV:', err);
      throw err;
    }
  };

  const atualizarStatus = async (id, status) => {
    try {
      const data = await apiService.put(`/ordens-venda/${id}/status`, { status });
      return data;
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      throw err;
    }
  };

  return { ordens, loading, erro, listar, buscarPorId, atualizarStatus };
}