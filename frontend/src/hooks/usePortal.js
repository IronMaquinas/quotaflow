// hooks/usePortal.js
// Hook para gerenciar o estado do Portal do Fornecedor

import { useState, useEffect, useCallback } from 'react';
import { portalService } from '../services/portalService';

export function usePortal(token) {
  const [cotacao, setCotacao] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [respondendo, setRespondendo] = useState(false);
  const [respostaEnviada, setRespostaEnviada] = useState(false);

  // Carregar cotação
  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setErro(null);
      const data = await portalService.buscarCotacao(token);
      setCotacao(data);
    } catch (err) {
      // 🔥 SE FOR ERRO DE TOKEN AUSENTE, IGNORA (NÃO MOSTRA ERRO)
      if (err.message === 'Token não fornecido') {
        setLoading(false);
        return;
      }
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Enviar resposta
  const enviarResposta = useCallback(async (dadosResposta) => {
    if (!token) return;
    try {
      setRespondendo(true);
      setErro(null);
      const resultado = await portalService.responderCotacao(token, dadosResposta);
      setRespostaEnviada(true);
      return resultado;
    } catch (err) {
      setErro(err.message);
      throw err;
    } finally {
      setRespondendo(false);
    }
  }, [token]);

  // Carregar na montagem
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    carregar();
  }, [token]);

  return {
    cotacao,
    loading,
    erro,
    respondendo,
    respostaEnviada,
    enviarResposta,
    recarregar: carregar,
  };
}