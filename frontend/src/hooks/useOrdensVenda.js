// hooks/useOrdensVenda.js
import { useState } from 'react';
import apiService from '../services/apiService';

export function useOrdensVenda() {
  const [ordens, setOrdens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const listar = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/ordens-venda');
      setOrdens(data);
      setErro(null);
    } catch (err) {
      setErro(err.message);
      console.error('Erro ao listar OVs:', err);
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