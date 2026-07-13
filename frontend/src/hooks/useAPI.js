// ════════════════════════════════════════════════════════════════════════════════
// frontend/src/hooks/useAPI.js
// HOOK GENÉRICO PARA CRUD - Reutilizável para qualquer entidade
// ════════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from "react";
import apiService from "../services/apiService";

/**
 * Hook genérico para operações CRUD
 * 
 * @param {string} endpoint - Endpoint da API (ex: "/chamados", "/cotacoes")
 * @param {object} options - Configurações opcionais
 * @returns {object} Estado e métodos para CRUD
 */
export function useAPI(endpoint, options = {}) {
  const {
    autoLoad = true,
    initialData = [],
    customEndpoints = {}, // { listar: "/custom", criar: "/custom-create" }
  } = options;

  // ─────────────────────────────────────────────────────────────────────
  // ESTADO
  // ─────────────────────────────────────────────────────────────────────

  const [dados, setDados] = useState(initialData);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [sucesso, setSucesso] = useState(null);

  // ─────────────────────────────────────────────────────────────────────
  // OPERAÇÕES CRUD
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Listar todos os registros
   */
  const listar = useCallback(async (params = {}) => {
    try {
      setCarregando(true);
      setErro(null);

      const endpointListar = customEndpoints.listar || endpoint;
      const response = await apiService.get(endpointListar, params);

      // Normalizar resposta - pode ser array ou objeto com propriedade data
      const dados_normalizados = Array.isArray(response) ? response : response.data || [];

      setDados(dados_normalizados);
      return dados_normalizados;
    } catch (err) {
      const msg = err.message || "Erro ao carregar dados";
      setErro(msg);
      console.error(`[useAPI] Erro ao listar ${endpoint}:`, err);
      throw err;
    } finally {
      setCarregando(false);
    }
  }, [endpoint, customEndpoints]);

  /**
   * Criar novo registro
   */
  const criar = useCallback(
    async (dados_novo) => {
      try {
        setCarregando(true);
        setErro(null);

        const endpointCriar = customEndpoints.criar || endpoint;
        const response = await apiService.post(endpointCriar, dados_novo);

        // Adicionar novo registro à lista
        const novoReg = response.id ? response : response.data || response;
        setDados((prev) => [...prev, novoReg]);

        setSucesso("Registro criado com sucesso");
        setTimeout(() => setSucesso(null), 3000);

        return novoReg;
      } catch (err) {
        const msg = err.message || "Erro ao criar registro";
        setErro(msg);
        console.error(`[useAPI] Erro ao criar em ${endpoint}:`, err);
        throw err;
      } finally {
        setCarregando(false);
      }
    },
    [endpoint, customEndpoints]
  );

  /**
   * Atualizar registro existente
   */
  const atualizar = useCallback(
    async (id, dados_atualizacao) => {
      try {
        setCarregando(true);
        setErro(null);

        const endpointAtualizar = customEndpoints.atualizar || endpoint;
        const response = await apiService.patch(`${endpointAtualizar}/${id}`, dados_atualizacao);

        // Atualizar na lista
        const regAtualizado = response.id ? response : response.data || response;
        setDados((prev) =>
          prev.map((item) => (item.id === id ? { ...item, ...regAtualizado } : item))
        );

        setSucesso("Registro atualizado com sucesso");
        setTimeout(() => setSucesso(null), 3000);

        return regAtualizado;
      } catch (err) {
        const msg = err.message || "Erro ao atualizar registro";
        setErro(msg);
        console.error(`[useAPI] Erro ao atualizar ${id} em ${endpoint}:`, err);
        throw err;
      } finally {
        setCarregando(false);
      }
    },
    [endpoint, customEndpoints]
  );

  /**
   * Deletar registro
   */
  const deletar = useCallback(
    async (id) => {
      try {
        setCarregando(true);
        setErro(null);

        const endpointDeletar = customEndpoints.deletar || endpoint;
        await apiService.delete(`${endpointDeletar}/${id}`);

        // Remover da lista
        setDados((prev) => prev.filter((item) => item.id !== id));

        setSucesso("Registro deletado com sucesso");
        setTimeout(() => setSucesso(null), 3000);

        return true;
      } catch (err) {
        const msg = err.message || "Erro ao deletar registro";
        setErro(msg);
        console.error(`[useAPI] Erro ao deletar ${id} em ${endpoint}:`, err);
        throw err;
      } finally {
        setCarregando(false);
      }
    },
    [endpoint, customEndpoints]
  );

  /**
   * Operação customizada (por exemplo: finalizar cotação)
   */
  const executarAcao = useCallback(
    async (acao, id, payload = null) => {
      try {
        setCarregando(true);
        setErro(null);

        const endpointAcao = `${endpoint}/${id}/${acao}`;
        const response = payload
          ? await apiService.put(endpointAcao, payload)
          : await apiService.get(endpointAcao);

        setSucesso(`Ação "${acao}" realizada com sucesso`);
        setTimeout(() => setSucesso(null), 3000);

        return response;
      } catch (err) {
        const msg = err.message || `Erro ao executar ${acao}`;
        setErro(msg);
        console.error(`[useAPI] Erro ao executar ${acao}:`, err);
        throw err;
      } finally {
        setCarregando(false);
      }
    },
    [endpoint]
  );

  /**
   * Limpar erros e sucessos
   */
  const limparMensagens = useCallback(() => {
    setErro(null);
    setSucesso(null);
  }, []);

  /**
   * Auto-carregar dados ao montar (se configurado)
   */
  useEffect(() => {
    if (autoLoad) {
      listar().catch(() => {
        // Erro já foi tratado em listar()
      });
    }
  }, [autoLoad, listar]);

  // ─────────────────────────────────────────────────────────────────────
  // RETORNO DO HOOK
  // ─────────────────────────────────────────────────────────────────────

  return {
    // Estado
    dados,
    setDados,
    carregando,
    erro,
    sucesso,

    // Operações CRUD
    listar,
    criar,
    atualizar,
    deletar,
    executarAcao,

    // Utilitários
    limparMensagens,
    isEmpty: dados.length === 0,
    tamanho: dados.length,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// EXEMPLO DE USO:
// ════════════════════════════════════════════════════════════════════════════════
/*

// Em um componente:
import { useAPI } from '@/hooks/useAPI';

function MeuComponente() {
  const chamados = useAPI('/chamados');

  const handleCriar = async () => {
    try {
      await chamados.criar({
        peca: 'Rolamento SKF',
        equipamento_id: 1,
        urgencia: 'alta'
      });
    } catch (err) {
      console.error('Erro:', err);
    }
  };

  return (
    <div>
      {chamados.carregando && <p>Carregando...</p>}
      {chamados.erro && <p style={{color: 'red'}}>{chamados.erro}</p>}
      {chamados.sucesso && <p style={{color: 'green'}}>{chamados.sucesso}</p>}

      <button onClick={handleCriar}>Criar</button>

      <ul>
        {chamados.dados.map(c => (
          <li key={c.id}>{c.peca}</li>
        ))}
      </ul>
    </div>
  );
}

*/
