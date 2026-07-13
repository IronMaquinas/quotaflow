// ════════════════════════════════════════════════════════════════════════════════
// frontend/src/hooks/index.js
// HOOKS ESPECÍFICOS - Wrappers do useAPI para cada entidade
// ════════════════════════════════════════════════════════════════════════════════

import { useAPI } from "./useAPI";
import apiService from "../services/apiService";
import { useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────
// HOOK: useChamados
// ─────────────────────────────────────────────────────────────────────

export function useChamados() {
  const api = useAPI("/cotacoes/chamados", {
    autoLoad: false,
    customEndpoints: {
      listar: "/cotacoes/chamados",
      criar: "/cotacoes/chamados",
      atualizar: "/chamados",
      deletar: "/chamados",
    },
  });

  return {
    ...api,
    listarChamados: api.listar,
    criarChamado: api.criar,
    atualizarChamado: api.atualizar,
    deletarChamado: api.deletar,
  };
}

// ─────────────────────────────────────────────────────────────────────
// HOOK: useCotacoes
// ─────────────────────────────────────────────────────────────────────

export function useCotacoes() {
  const api = useAPI("/cotacoes", {
    autoLoad: false,
    customEndpoints: {
      listar: "/cotacoes",
      criar: "/cotacoes",
      atualizar: "/cotacoes",
      deletar: "/cotacoes",
    },
  });

  // Método customizado para finalizar cotação
  const finalizarCotacao = useCallback(
    async (id, payload) => {
      return api.executarAcao("finalizar", id, payload);
    },
    [api]
  );

  return {
    ...api,
    listarCotacoes: api.listar,
    criarCotacao: api.criar,
    atualizarCotacao: api.atualizar,
    deletarCotacao: api.deletar,
    finalizarCotacao,
  };
}

// ─────────────────────────────────────────────────────────────────────
// HOOK: useFornecedores
// ─────────────────────────────────────────────────────────────────────

export function useFornecedores() {
  const api = useAPI("/fornecedores", {
    autoLoad: false,
  });

  return {
    ...api,
    listarFornecedores: api.listar,
    criarFornecedor: api.criar,
    atualizarFornecedor: api.atualizar,
    deletarFornecedor: api.deletar,
  };
}

// ─────────────────────────────────────────────────────────────────────
// HOOK: useEquipamentos
// ─────────────────────────────────────────────────────────────────────

export function useEquipamentos() {
  const api = useAPI("/equipamentos", {
    autoLoad: false,
  });

  return {
    ...api,
    listarEquipamentos: api.listar,
    criarEquipamento: api.criar,
    atualizarEquipamento: api.atualizar,
    deletarEquipamento: api.deletar,
  };
}

// ─────────────────────────────────────────────────────────────────────
// HOOK: useTarefas
// ─────────────────────────────────────────────────────────────────────

export function useTarefas() {
  const api = useAPI("/tarefas", {
    autoLoad: false,
  });

  return {
    ...api,
    listarTarefas: api.listar,
    criarTarefa: api.criar,
    atualizarTarefa: api.atualizar,
    deletarTarefa: api.deletar,
  };
}

// ─────────────────────────────────────────────────────────────────────
// HOOK: useUsuarios
// ─────────────────────────────────────────────────────────────────────

export function useUsuarios() {
  const api = useAPI("/usuarios", {
    autoLoad: false,
  });

  return {
    ...api,
    listarUsuarios: api.listar,
    criarUsuario: api.criar,
    atualizarUsuario: api.atualizar,
    deletarUsuario: api.deletar,
  };
}

// ─────────────────────────────────────────────────────────────────────
// HOOK: useFinanceiro (agregação de dados)
// ─────────────────────────────────────────────────────────────────────

export function useFinanceiro() {
  const chamados = useChamados();
  const cotacoes = useCotacoes();

  return {
    chamados: chamados.dados,
    cotacoes: cotacoes.dados,
    carregando: chamados.carregando || cotacoes.carregando,
    erro: chamados.erro || cotacoes.erro,
  };
}

// ─────────────────────────────────────────────────────────────────────
// HOOK: useInteligencia (agregação de dados para análises)
// ─────────────────────────────────────────────────────────────────────

export function useInteligencia() {
  const chamados = useChamados();
  const cotacoes = useCotacoes();
  const fornecedores = useFornecedores();
  const equipamentos = useEquipamentos();

  return {
    chamados: chamados.dados,
    cotacoes: cotacoes.dados,
    fornecedores: fornecedores.dados,
    equipamentos: equipamentos.dados,
    carregando:
      chamados.carregando ||
      cotacoes.carregando ||
      fornecedores.carregando ||
      equipamentos.carregando,
    erro: chamados.erro || cotacoes.erro || fornecedores.erro || equipamentos.erro,
  };
}

// ─────────────────────────────────────────────────────────────────────
// HOOK: useBenchmark
// ─────────────────────────────────────────────────────────────────────

export function useBenchmark() {
  const chamados = useChamados();

  return {
    chamados: chamados.dados,
    carregando: chamados.carregando,
    erro: chamados.erro,
  };
}

// ─────────────────────────────────────────────────────────────────────
// HOOK: useRelatorio
// ─────────────────────────────────────────────────────────────────────

export function useRelatorio() {
  const chamados = useChamados();
  const cotacoes = useCotacoes();
  const fornecedores = useFornecedores();
  const equipamentos = useEquipamentos();
  const tarefas = useTarefas();

  return {
    chamados: chamados.dados,
    cotacoes: cotacoes.dados,
    fornecedores: fornecedores.dados,
    equipamentos: equipamentos.dados,
    tarefas: tarefas.dados,
    carregando:
      chamados.carregando ||
      cotacoes.carregando ||
      fornecedores.carregando ||
      equipamentos.carregando ||
      tarefas.carregando,
    erro:
      chamados.erro ||
      cotacoes.erro ||
      fornecedores.erro ||
      equipamentos.erro ||
      tarefas.erro,
  };
}

export * from './useEmail';
export * from './useTarefas';
