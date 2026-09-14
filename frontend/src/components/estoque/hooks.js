// frontend/src/components/estoque/hooks.js
//
// Hooks customizados da tela de Ordem de Serviço. Extraídos do
// TelaOrdemServico.jsx na Rodada 1 da quebra.

import { useState, useCallback } from "react";
import apiService from "../../services/apiService";

// ─────────────────────────────────────────────────────────────────────────
// useEstoque — consulta saldo e reserva material no estoque.
// ─────────────────────────────────────────────────────────────────────────
export function useEstoque() {
  const [consultando, setConsultando] = useState({});

  const consultarSaldo = useCallback(async (itemCatalogoId, quantidadeNecessaria) => {
    if (!itemCatalogoId) return { status: "nao_verificado", disponivel: null };
    setConsultando(prev => ({ ...prev, [itemCatalogoId]: true }));
    try {
      const resp = await apiService.get('/estoque/saldo', { item_catalogo_id: itemCatalogoId });
      const disponivel = resp?.disponivel ?? 0;
      const qtd = Number(quantidadeNecessaria) || 1;
      let status = "sem_estoque";
      if (disponivel >= qtd) status = "atende";
      else if (disponivel > 0) status = "parcial";
      return { status, disponivel };
    } catch (err) {
      console.warn("⚠️ /estoque/saldo indisponível:", err.message);
      return { status: "nao_verificado", disponivel: null };
    } finally {
      setConsultando(prev => ({ ...prev, [itemCatalogoId]: false }));
    }
  }, []);

  const reservar = useCallback(async (itemCatalogoId, quantidade, chamadoId) => {
    try {
      return await apiService.post('/estoque/reservas', { item_catalogo_id: itemCatalogoId, quantidade, chamado_id: chamadoId });
    } catch (err) {
      console.warn("⚠️ /estoque/reservas indisponível:", err.message);
      return null;
    }
  }, []);

  return { consultando, consultarSaldo, reservar };
}

// ─────────────────────────────────────────────────────────────────────────
// useMaterialAplicacoes — ciclo MIGO-like (aplicar, reverter, histórico).
// ─────────────────────────────────────────────────────────────────────────
export function useMaterialAplicacoes() {
  const [salvando, setSalvando] = useState(false);

  const aplicar = useCallback(async (chamadoId, chamadoItemId, payload) => {
    setSalvando(true);
    try {
      const idemKey = payload._idempotencyKey || crypto.randomUUID();
      const resp = await apiService.post(
        `/cotacoes/chamados/${chamadoId}/materiais/${chamadoItemId}/aplicar`,
        { ...payload, _idempotencyKey: undefined },
        { headers: { "Idempotency-Key": idemKey } }
      );
      return resp;
    } finally {
      setSalvando(false);
    }
  }, []);

  const reverter = useCallback(async (aplicacaoId, motivo) => {
    setSalvando(true);
    try {
      return await apiService.post(
        `/cotacoes/chamados/aplicacoes/${aplicacaoId}/reverter`,
        { motivo }
      );
    } finally {
      setSalvando(false);
    }
  }, []);

  const listarHistorico = useCallback(async (chamadoId, chamadoItemId) => {
    return await apiService.get(
      `/cotacoes/chamados/${chamadoId}/materiais/${chamadoItemId}/aplicacoes`
    );
  }, []);

  return { aplicar, reverter, listarHistorico, salvando };
}