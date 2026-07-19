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

  // Buscar itens similares
  async function buscarSimilares(termo, limite = 5) {
    try {
      setCarregando(true);
      const response = await fetch(`${API_URL}/cotacoes/buscar-similares`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ termo, limite })
      });

      if (!response.ok) {
        const erro = await response.json();
        throw new Error(erro.erro || 'Erro ao buscar similares');
      }

      const data = await response.json();
      setCarregando(false);
      return data.similares || [];
    } catch (err) {
      setErro(err.message);
      setCarregando(false);
      return [];
    }
  }

  // Criar cotação automática
  async function criarAutomatica(chamadoId, itemCatalogoId) {
    try {
      setCarregando(true);
      const response = await fetch(`${API_URL}/cotacoes/criar-automatica`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ chamadoId, itemCatalogoId })
      });

      if (!response.ok) {
        const erro = await response.json();
        throw new Error(erro.erro || 'Erro ao criar cotação');
      }

      const data = await response.json();
      setCarregando(false);
      return data.cotacao;
    } catch (err) {
      setErro(err.message);
      setCarregando(false);
      throw err;
    }
  }

  // NOVO: Adicionar item à cotação
  async function adicionarItem(cotacaoId, itemCatalogoId, quantidade = 1) {
    try {
      setCarregando(true);
      const response = await fetch(`${API_URL}/cotacoes/${cotacaoId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ itemCatalogoId, quantidade })
      });

      if (!response.ok) {
        const erro = await response.json();
        throw new Error(erro.erro || 'Erro ao adicionar item');
      }

      const data = await response.json();
      setCarregando(false);
      return data.item;
    } catch (err) {
      setErro(err.message);
      setCarregando(false);
      throw err;
    }
  }

  // NOVO: Remover item da cotação
  async function removerItem(cotacaoId, itemId) {
    try {
      setCarregando(true);
      const response = await fetch(`${API_URL}/cotacoes/${cotacaoId}/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const erro = await response.json();
        throw new Error(erro.erro || 'Erro ao remover item');
      }

      setCarregando(false);
      return true;
    } catch (err) {
      setErro(err.message);
      setCarregando(false);
      throw err;
    }
  }

  // NOVO: Confirmar cotação
  async function confirmarCotacao(cotacaoId) {
    try {
      setCarregando(true);
      const response = await fetch(`${API_URL}/cotacoes/${cotacaoId}/confirmar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        const erro = await response.json();
        throw new Error(erro.erro || 'Erro ao confirmar cotação');
      }

      const data = await response.json();
      setCarregando(false);
      return data.resultado;
    } catch (err) {
      setErro(err.message);
      setCarregando(false);
      throw err;
    }
  }

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
    buscarSimilares,
    criarAutomatica,
    adicionarItem,
    removerItem,
    confirmarCotacao,
    limparErro: () => setErro(null),
  };
}
