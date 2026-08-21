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
  }, []);

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

  const buscarDetalhesCotacao = useCallback(async (id) => {
      console.log('🔍 buscarDetalhesCotacao - id:', id);

    try {
      setErro(null);
      setLoading(true);
      const data = await cotacoesService.buscarDetalhes(accessToken, id);
      return data;
    } catch (err) {
      setErro(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

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

  // ─────────────────────────────────────────────────────────────────────────
  // NOVO: BUSCAR CHAMADO COM ITENS AGRUPADOS POR CATEGORIA + FORNECEDORES
  // ─────────────────────────────────────────────────────────────────────────

  const buscarChamadoComItens = useCallback(
    async (chamadoId) => {
      try {
        setErro(null);
        setLoading(true);

        const response = await cotacoesService.buscarChamadoComItens(
          accessToken,
          chamadoId
        );

        console.log(`✅ Chamado carregado:`, response);
        return response;
      } catch (err) {
        setErro(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [accessToken]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // NOVO: SALVAR COTAÇÃO (RASCUNHO)
  // ─────────────────────────────────────────────────────────────────────────

  const salvarCotacao = useCallback(
    async (chamadoId, itens, notas = "") => {
     console.log('🔍 [salvarCotacao] chamadoId:', chamadoId, 'itens:', itens);
     
      try {
        setErro(null);
        setLoading(true);

        const payload = {
          chamado_id: chamadoId,
          itens: itens, // array de { item_id, fornecedor_ids }
          notas: notas
        };

        const nova = await cotacoesService.salvarCotacao(accessToken, payload);

        setCotacoes([...cotacoes, nova]);
        console.log(`✅ Cotação salva:`, nova);
        return nova;
      } catch (err) {
        setErro(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [accessToken, cotacoes]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // NOVO: SALVAR & ENVIAR COTAÇÃO
  // ─────────────────────────────────────────────────────────────────────────

  const salvarEEnviarCotacao = useCallback(
    async (chamadoId, itens, notas = "") => {
      try {
        setErro(null);
        setLoading(true);

        // 1. Salvar cotação
        const salva = await salvarCotacao(chamadoId, itens, notas);
        if (!salva.cotacao_id) throw new Error("Erro ao salvar cotação");

        const cotacao_id = salva.cotacao_id;

        // 2. Juntar todos os fornecedores únicos
        const fornecedoresUnicos = new Set();
        for (const item of itens) {
          item.fornecedor_ids.forEach(id => fornecedoresUnicos.add(id));
        }

        // 3. Vincular fornecedores (uma vez por cotação)
        for (const fornecedor_id of fornecedoresUnicos) {
          try {
            const resposta = await fetch(
              `${import.meta.env.VITE_API_URL}/cotacoes/${cotacao_id}/fornecedores`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({ fornecedor_id })
              }
            );
            if (!resposta.ok) throw new Error(`Erro ao vincular fornecedor ${fornecedor_id}`);
          } catch (err) {
            console.error(`Erro ao vincular fornecedor ${fornecedor_id}:`, err);
          }
        }

        // 4. ✅ NOVO: Salvar quais fornecedores foram selecionados pra cada item
        for (const item of itens) {
          for (const fornecedor_id of item.fornecedor_ids) {
            try {
              await fetch(
                `${import.meta.env.VITE_API_URL}/cotacoes/${cotacao_id}/item-fornecedor-selecionado`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                  },
                  body: JSON.stringify({
                    cotacao_item_id: item.item_id,
                    fornecedor_id
                  })
                }
              );
            } catch (err) {
              console.warn(`Aviso ao registrar seleção:`, err);
            }
          }
        }


        // 5. Enviar cotação
        const enviada = await cotacoesService.enviarCotacao(accessToken, cotacao_id);
        console.log(`✅ Cotação enviada:`, enviada);
        return enviada;
      } catch (err) {
        setErro(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [accessToken, salvarCotacao]
  );

  const atualizarCotacao = useCallback(async (cotacaoId, itens, notas = "") => {
    try {
      setErro(null);
      setLoading(true);

      const payload = {
        itens: itens, // array de { item_id, fornecedor_ids }
        notas: notas
      };

      const updated = await cotacoesService.atualizarCotacao(accessToken, cotacaoId, payload);
      setCotacoes(prev => prev.map(c => c.id === cotacaoId ? { ...c, ...updated } : c));
      return updated;
    } catch (err) {
      setErro(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const excluirCotacao = useCallback(async (cotacaoId) => {
    try {
      setErro(null);
      setLoading(true);
      await cotacoesService.excluirCotacao(accessToken, cotacaoId);
      setCotacoes(prev => prev.filter(c => c.id !== cotacaoId));
      return { ok: true };
    } catch (err) {
      setErro(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

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
    buscarChamadoComItens,
    salvarCotacao,
    salvarEEnviarCotacao,
    atualizarCotacao,
    excluirCotacao,
    buscarDetalhesCotacao,
    limparErro: () => setErro(null),
  };
}
