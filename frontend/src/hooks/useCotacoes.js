// hooks/useCotacoes.js
// Hook para gerenciar cotações

import { useState, useEffect, useCallback } from "react";
import { cotacoesService } from "../services/cotacoesService";

export function useCotacoes(accessToken) {
  const [cotacoes, setCotacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  // ─────────────────────────────────────────────────────────────────────────
  // CARREGAR COTAÇÕES
  // ─────────────────────────────────────────────────────────────────────────

  const carregar = useCallback(async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      setErro(null);
      const dados = await cotacoesService.listar(accessToken);
      setCotacoes(dados);
    } catch (err) {
      setErro(err.message);
      console.error("Erro ao carregar cotações:", err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // Carregar ao montar componente
  useEffect(() => {
    carregar();
  }, [carregar]);

  // ─────────────────────────────────────────────────────────────────────────
  // CRIAR COTAÇÃO
  // ─────────────────────────────────────────────────────────────────────────

  const criar = useCallback(
    async (chamadoId, fornecedores) => {
      try {
        setErro(null);
        const nova = await cotacoesService.criar(
          accessToken,
          chamadoId,
          fornecedores
        );
        setCotacoes([...cotacoes, nova]);
        return nova;
      } catch (err) {
        setErro(err.message);
        throw err;
      }
    },
    [accessToken, cotacoes]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // BUSCAR COTAÇÃO POR TOKEN (PORTAL FORNECEDOR)
  // ─────────────────────────────────────────────────────────────────────────

  const buscarPorToken = useCallback(async (token) => {
    try {
      const dados = await cotacoesService.buscarPorToken(token);
      return dados;
    } catch (err) {
      throw err;
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // RESPONDER COTAÇÃO (FORNECEDOR)
  // ─────────────────────────────────────────────────────────────────────────

  const responder = useCallback(async (token, resposta) => {
    try {
      const resultado = await cotacoesService.responder(token, resposta);
      return resultado;
    } catch (err) {
      throw err;
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // BUSCAR COTAÇÃO POR ID
  // ─────────────────────────────────────────────────────────────────────────

  const buscarPorId = useCallback(
    (id) => {
      return cotacoes.find((c) => c.id === id);
    },
    [cotacoes]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // FILTRAR COTAÇÕES POR STATUS
  // ─────────────────────────────────────────────────────────────────────────

  const filtrar = useCallback(
    (status) => {
      if (!status || status === "todos") return cotacoes;
      return cotacoes.filter((c) => c.status === status);
    },
    [cotacoes]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // CONTAR RESPOSTAS RECEBIDAS
  // ─────────────────────────────────────────────────────────────────────────

  const contarRespostas = useCallback(
    (cotacaoId) => {
      const cot = cotacoes.find((c) => c.id === cotacaoId);
      if (!cot) return 0;
      return (cot.fornecedores || []).filter((f) => f.status === "respondido")
        .length;
    },
    [cotacoes]
  );

  return {
    cotacoes,
    loading,
    erro,
    carregar,
    criar,
    buscarPorToken,
    responder,
    buscarPorId,
    filtrar,
    contarRespostas,
    limparErro: () => setErro(null),
  };
}
