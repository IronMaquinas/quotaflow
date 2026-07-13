// hooks/useFornecedores.js
import { useState, useEffect, useCallback } from "react";
import { fornecedoresService } from "../services/fornecedoresService";

export function useFornecedores() {
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const getToken = () => localStorage.getItem('access_token');

  const listar = useCallback(async () => {
    const token = getToken();
    if (!token) {
      console.warn('Token ausente, abortando listar fornecedores');
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const data = await fornecedoresService.listar(token);
      setFornecedores(data || []);
    } catch (err) {
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
      const novo = await fornecedoresService.criar(token, dados);
      setFornecedores(prev => [...prev, novo]);
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
      const atualizado = await fornecedoresService.atualizar(token, id, dados);
      setFornecedores(prev => prev.map(f => f.id === id ? atualizado : f));
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
      await fornecedoresService.deletar(token, id);
      setFornecedores(prev => prev.filter(f => f.id !== id));
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

  return { fornecedores, loading, erro, listar, criar, atualizar, deletar };
}