// hooks/useTarefas.js
import { useState, useCallback, useEffect } from "react";
import { tarefasService } from "../services/tarefasService";

export function useTarefas() {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const getToken = () => localStorage.getItem('access_token');

  const listar = useCallback(async () => {
    const token = getToken();
    if (!token) {
      console.warn('⚠️ Token ausente, abortando listar tarefas');
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const data = await tarefasService.listar(token);
      setDados(data || []);
    } catch (err) {
      setErro(err.message);
      console.error('❌ Erro ao listar tarefas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const criar = useCallback(async (dadosTarefa) => {
    const token = getToken();
    if (!token) throw new Error('Token não disponível');
    setLoading(true);
    setErro(null);
    try {
      const nova = await tarefasService.criar(token, dadosTarefa);
      setDados(prev => [...prev, nova]);
      return nova;
    } catch (err) {
      setErro(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const atualizar = useCallback(async (id, dadosTarefa) => {
    const token = getToken();
    if (!token) throw new Error('Token não disponível');
    setLoading(true);
    setErro(null);
    try {
      const atualizada = await tarefasService.atualizar(token, id, dadosTarefa);
      setDados(prev => prev.map(t => t.id === id ? atualizada : t));
      return atualizada;
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
    setErro(null);
    try {
      await tarefasService.deletar(token, id);
      setDados(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      setErro(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // 🔥 FUNÇÃO ADICIONAR COMENTÁRIO
  const adicionarComentario = useCallback(async (id, texto) => {
    const token = getToken();
    if (!token) throw new Error('Token não disponível');
    setLoading(true);
    setErro(null);
    try {
      const atualizada = await tarefasService.adicionarComentario(token, id, texto);
      setDados(prev => prev.map(t => t.id === id ? atualizada : t));
      return atualizada;
    } catch (err) {
      setErro(err.message);
      console.error('❌ Erro ao adicionar comentário:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar automaticamente ao montar
  useEffect(() => {
    listar();
  }, []);

  return {
    dados,
    loading,
    erro,
    listar,
    criar,
    atualizar,
    deletar,
    adicionarComentario, // <-- GARANTA QUE ESTÁ AQUI
    limparErro: () => setErro(null),
  };
}