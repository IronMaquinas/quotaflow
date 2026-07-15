// hooks/useEquipamentos.js
import { useState, useCallback, useEffect } from 'react';
import { equipamentosService } from '../services/equipamentosService';

export function useEquipamentos() {
  const [equipamentos, setEquipamentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const getToken = () => localStorage.getItem('access_token');

  const listar = useCallback(async () => {
    const token = getToken();
    if (!token) {
      console.warn('⚠️ Token ausente, abortando listar equipamentos');
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const data = await equipamentosService.listar(token);
      setEquipamentos(data || []);
    } catch (err) {
      console.error('❌ Erro ao listar equipamentos:', err);
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const criar = useCallback(async (dados) => {
    const token = getToken();
    if (!token) throw new Error('Token não disponível');
    setLoading(true);
    try {
      const novo = await equipamentosService.criar(token, dados);
      setEquipamentos(prev => [...prev, novo]);
      return novo;
    } catch (err) {
      setErro(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const atualizar = useCallback(async (id, dados) => {
    const token = getToken();
    if (!token) throw new Error('Token não disponível');
    setLoading(true);
    try {
      const atualizado = await equipamentosService.atualizar(token, id, dados);
      setEquipamentos(prev => prev.map(eq => eq.id === id ? atualizado : eq));
      return atualizado;
    } catch (err) {
      setErro(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deletar = useCallback(async (id) => {
    const token = getToken();
    if (!token) throw new Error('Token não disponível');
    setLoading(true);
    try {
      await equipamentosService.deletar(token, id);
      setEquipamentos(prev => prev.filter(eq => eq.id !== id));
    } catch (err) {
      setErro(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    listar();
  }, []);

  return { equipamentos, loading, erro, listar, criar, atualizar, deletar };
}