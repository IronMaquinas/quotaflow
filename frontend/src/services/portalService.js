// frontend/src/services/portalService.js
import { API_URL } from '../utils/constants';
import apiService from './apiService';

// ────────────────────────────────────────────────────────────────────────
// Normaliza a resposta do backend (público OU autenticado) pro shape que
// o formulário consome. Extraído pra fora dos métodos pra ser reusado
// pelas 2 portas de carregamento — os 2 endpoints devolvem o mesmo shape,
// mas fica em um lugar só se um dia divergir.
// ────────────────────────────────────────────────────────────────────────
function normalizarRespostaCotacao(data) {
  return {
    // Aliases legados (compatíveis com a tela que já funcionava)
    id: data.cotacao?.id,
    numero_cotacao: data.cotacao?.numero,
    itens: (data.itens || []).map(item => ({
      id: item.id,
      peca: item.item_nome || item.nome,
      nome: item.item_nome || item.nome,
      descricao: item.descricao || '',
      // FIX M6: `item.codigo` (raiz) é do cotacao_itens — normalmente
      // null. O código real do item mora em `chamado_itens.codigo`, no
      // sub-objeto do join. Prioriza o código do chamado.
      codigo: item.chamado_itens?.codigo || item.codigo || null,
      quantidade: item.quantidade,
      categoria: item.categoria,
      urgencia: item.urgencia,
      // M6: propagar os campos do código do fornecedor (cProd). Sem
      // isso, o FormularioRespostaCotacao recebe undefined e o input
      // "SEU CÓDIGO NA NFe" aparece vazio mesmo com o backend
      // devolvendo preenchido.
      codigo_rc: item.codigo_rc || null,
      codigo_fornecedor_aprendido: item.codigo_fornecedor_aprendido || null,
      codigo_fornecedor_sugerido: item.codigo_fornecedor_sugerido || null,
      confianca_aprendizado: item.confianca_aprendizado || null,
    })),

    ja_respondida:
      data.ja_respondida === true || data.cotacao?.ja_respondida === true,
    respondida_em:
      data.respondida_em || data.cotacao?.respondida_em || null,
    itens_respondidos:
      (Array.isArray(data.itens_respondidos) && data.itens_respondidos) ||
      (Array.isArray(data.cotacao?.itens_respondidos) && data.cotacao.itens_respondidos) ||
      [],

     respostasExistentes: data.respostasExistentes || null,

    // Contato do comprador (resolvido por policy do tenant). Vem null
    // quando a cotação está cancelada/finalizada — o backend decide.
    contato: data.contato || null,
  };
}

// Monta o body no formato esperado pelo backend. Mesmo payload nas 2
// portas (público e autenticado) — backend valida igual.
function montarPayloadResposta(dados) {
  return {
    validade_dias: parseInt(dados.validade_dias || 30),
    respostas: dados.itens.map(item => ({
      itemId: item.item_id,
      valor_unitario: parseFloat(item.valor_unitario || 0),
      quantidade: item.quantidade,
      prazo: parseInt(dados.prazo_entrega || 0),
      valor_frete: parseFloat(item.valor_frete || 0),
      frete: item.frete,
      observacoes: dados.observacoes || '',
    })),
  };
}

export const portalService = {
  /**
   * Buscar cotação usando token público
   * @param {string} token - Token de acesso público
   * @returns {Promise<Object>} Dados da cotação
   */
  async buscarCotacao(token) {
    
    if (!token) {
      throw new Error('Token não fornecido');
    }

    // Extrai cotacaoId do hash (formato: #/portal/cotacao/1/token)
    const hashParts = window.location.hash.split('/');
    const cotacaoId = hashParts[hashParts.length - 2];

    if (!cotacaoId || isNaN(cotacaoId)) {
      throw new Error('ID da cotação inválido no link');
    }

    // ✅ Usa a rota correta do portalFornecedor.js
    const response = await fetch(`${API_URL}/portal/cotacao/${cotacaoId}/${token}`);

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || data.erro || 'Erro ao carregar cotação');
    }

    const data = await response.json();

    // Normalização extraída pra função topo-de-arquivo (mesmo shape nas
    // 2 portas: pública e autenticada).
    return normalizarRespostaCotacao(data);
  },

  /**
   * Enviar resposta da cotação
   * @param {string} token - Token de acesso público
   * @param {Object} dados - Dados da resposta
   * @returns {Promise<Object>} Resultado da operação
   */
  async responderCotacao(token, dados) {
    // Extrai cotacaoId do hash
    const hashParts = window.location.hash.split('/');
    const cotacaoId = hashParts[hashParts.length - 2];

    if (!cotacaoId || isNaN(cotacaoId)) {
      throw new Error('ID da cotação inválido no link');
    }

    const response = await fetch(`${API_URL}/portal/cotacao/${cotacaoId}/${token}/responder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(montarPayloadResposta(dados))
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || data.erro || 'Erro ao enviar resposta');
    }

    return await response.json();
  },

  // ────────────────────────────────────────────────────────────────────
  // MODO AUTENTICADO (JWT) — usado pelo hub do fornecedor logado.
  // Mesma semântica de carregar/responder, mas resolve por
  // cotacao_fornecedor_id + JWT (sem token na URL). Ver Patch 3 do
  // refactor do portal (2026-09).
  // ────────────────────────────────────────────────────────────────────

  async buscarCotacaoAutenticado(cotacaoFornecedorId) {
    if (!cotacaoFornecedorId) {
      throw new Error('ID da cotação não fornecido');
    }
    const data = await apiService.get(
      `/fornecedor/cotacoes/${cotacaoFornecedorId}`
    );
    return normalizarRespostaCotacao(data);
  },

  async responderCotacaoAutenticado(cotacaoFornecedorId, dados) {
    if (!cotacaoFornecedorId) {
      throw new Error('ID da cotação não fornecido');
    }
    return await apiService.post(
      `/fornecedor/cotacoes/${cotacaoFornecedorId}/responder`,
      montarPayloadResposta(dados)
    );
  }
};