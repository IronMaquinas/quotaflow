// hooks/useUsuarios.js
// Hook para gerenciar usuários do tenant

import { useState, useEffect, useCallback } from "react";
import { usuariosService } from "../services/usuariosService";

export function useUsuarios(accessToken) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  // ─────────────────────────────────────────────────────────────────────────
  // CARREGAR USUÁRIOS
  // ─────────────────────────────────────────────────────────────────────────

  const carregar = useCallback(async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      setErro(null);
      const dados = await usuariosService.listar(accessToken);
      setUsuarios(dados);
    } catch (err) {
      setErro(err.message);
      console.error("Erro ao carregar usuários:", err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // Carregar ao montar componente
  useEffect(() => {
    carregar();
  }, [carregar]);

  // ─────────────────────────────────────────────────────────────────────────
  // CRIAR USUÁRIO
  // ─────────────────────────────────────────────────────────────────────────

  const criar = useCallback(
    async (dados) => {
      try {
        setErro(null);
        const novo = await usuariosService.criar(accessToken, dados);
        setUsuarios([...usuarios, novo]);
        return novo;
      } catch (err) {
        setErro(err.message);
        throw err;
      }
    },
    [accessToken, usuarios]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // ATUALIZAR USUÁRIO
  // ─────────────────────────────────────────────────────────────────────────

  const atualizar = useCallback(
    async (id, dados) => {
      try {
        setErro(null);
        const updated = await usuariosService.atualizar(accessToken, id, dados);
        setUsuarios(usuarios.map((u) => (u.id === id ? updated : u)));
        return updated;
      } catch (err) {
        setErro(err.message);
        throw err;
      }
    },
    [accessToken, usuarios]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // DELETAR USUÁRIO
  // ─────────────────────────────────────────────────────────────────────────

  const deletar = useCallback(
    async (id) => {
      try {
        setErro(null);
        await usuariosService.deletar(accessToken, id);
        setUsuarios(usuarios.filter((u) => u.id !== id));
      } catch (err) {
        setErro(err.message);
        throw err;
      }
    },
    [accessToken, usuarios]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // ALTERAR PERFIL
  // ─────────────────────────────────────────────────────────────────────────

  const alterarPerfil = useCallback(
    async (id, perfil) => {
      try {
        setErro(null);
        const updated = await usuariosService.alterarPerfil(
          accessToken,
          id,
          perfil
        );
        setUsuarios(usuarios.map((u) => (u.id === id ? updated : u)));
        return updated;
      } catch (err) {
        setErro(err.message);
        throw err;
      }
    },
    [accessToken, usuarios]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // DESATIVAR / ATIVAR USUÁRIO
  // ─────────────────────────────────────────────────────────────────────────

  const desativar = useCallback(
    async (id) => {
      try {
        setErro(null);
        const updated = await usuariosService.desativar(accessToken, id);
        setUsuarios(usuarios.map((u) => (u.id === id ? updated : u)));
        return updated;
      } catch (err) {
        setErro(err.message);
        throw err;
      }
    },
    [accessToken, usuarios]
  );

  const ativar = useCallback(
    async (id) => {
      try {
        setErro(null);
        const updated = await usuariosService.ativar(accessToken, id);
        setUsuarios(usuarios.map((u) => (u.id === id ? updated : u)));
        return updated;
      } catch (err) {
        setErro(err.message);
        throw err;
      }
    },
    [accessToken, usuarios]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // BUSCAR USUÁRIO POR ID
  // ─────────────────────────────────────────────────────────────────────────

  const buscarPorId = useCallback(
    (id) => {
      return usuarios.find((u) => u.id === id);
    },
    [usuarios]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // CONTAR USUÁRIOS POR PERFIL
  // ─────────────────────────────────────────────────────────────────────────

  const contarPorPerfil = useCallback(
    (perfil) => {
      return usuarios.filter((u) => u.perfil === perfil).length;
    },
    [usuarios]
  );

  return {
    usuarios,
    loading,
    erro,
    carregar,
    criar,
    atualizar,
    deletar,
    alterarPerfil,
    desativar,
    ativar,
    buscarPorId,
    contarPorPerfil,
    limparErro: () => setErro(null),
  };
}
