// hooks/useChamados.js
import { useState, useEffect, useCallback } from "react";
import { chamadosService } from "../services/chamadosService";

export function useChamados() {
  const [chamados, setChamados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const getToken = () => localStorage.getItem('access_token');

  // 1. CARREGAR
  const carregar = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      setLoading(true);
      const dados = await chamadosService.listar(token);
      const dadosComCopias = dados.map(ch => ({
        ...ch,
        itens: ch.itens ? ch.itens.map(item => ({ ...item })) : []
      }));
      setChamados(dadosComCopias);
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. CRIAR
  const criar = useCallback(async (dados) => {
    const token = getToken();
    if (!token) throw new Error('Token não disponível');
    try {
      const novo = await chamadosService.criar(token, dados);
      setChamados(prev => [{
        ...novo,
        itens: novo.itens ? novo.itens.map(item => ({ ...item })) : []
      }, ...prev]);
      return novo;
    } catch (err) {
      setErro(err.message);
      throw err;
    }
  }, []);

  // 3. ATUALIZAR
  const atualizar = useCallback(async (id, dados) => {
    const token = getToken();
    if (!token) throw new Error('Token não disponível');
    try {
      const atualizado = await chamadosService.atualizar(token, id, dados);
      setChamados(prev => prev.map(ch =>
        ch.id === id ? { ...atualizado, itens: atualizado.itens ? atualizado.itens.map(item => ({ ...item })) : [] } : ch
      ));
      return atualizado;
    } catch (err) {
      setErro(err.message);
      throw err;
    }
  }, []);

  // 4. DELETAR
  const deletar = useCallback(async (id) => {
    const token = getToken();
    if (!token) throw new Error('Token não disponível');
    try {
      await chamadosService.deletar(token, id);
      setChamados(prev => prev.filter(ch => ch.id !== id));
    } catch (err) {
      setErro(err.message);
      throw err;
    }
  }, []);

  // Carregar dados ao montar
  useEffect(() => {
    carregar();
  }, []);

  return {
    chamados,
    loading,
    erro,
    carregar,
    criar,
    atualizar,
    deletar,
    limparErro: () => setErro(null),
  };
}