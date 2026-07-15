// hooks/useChamados.js
import { useState, useEffect, useCallback } from "react";
import { chamadosService } from "../services/chamadosService";

export function useChamados() {
  const [chamados, setChamados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const getToken = () => localStorage.getItem('access_token');

  const carregar = useCallback(async (force = false) => {
    const token = getToken();
    if (!token) {
      console.warn('⚠️ Token ausente');
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const dados = await chamadosService.listar(token, force);
      setChamados(dados || []);
    } catch (err) {
      setErro(err.message);
      console.error('❌ Erro ao carregar chamados:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const criar = useCallback(async (dados) => {
    const token = getToken();
    if (!token) throw new Error('Token não disponível');
    setLoading(true);
    try {
      const novo = await chamadosService.criar(token, dados);
      setChamados(prev => [novo, ...prev]);
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
      const atualizado = await chamadosService.atualizar(token, id, dados);
      
      // ✅ Substituir o chamado inteiro pela resposta do servidor
      setChamados(prev => prev.map(ch => {
        if (ch.id === id) {
          return atualizado; // ← Usa resposta COMPLETA do servidor
        }
        return ch;
      }));
      
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
      await chamadosService.deletar(token, id);
      setChamados(prev => prev.filter(ch => ch.id !== id));
    } catch (err) {
      setErro(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, []);

  return { chamados, loading, erro, carregar, criar, atualizar, deletar };
}