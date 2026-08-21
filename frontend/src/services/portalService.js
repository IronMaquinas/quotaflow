// frontend/src/services/portalService.js
// Serviço para comunicar com o portal do fornecedor

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const portalService = {
  /**
   * Buscar cotação usando token público
   * @param {string} token - Token de acesso público
   * @returns {Promise<Object>} Dados da cotação
   */
  async buscarCotacao(token) {
    // Pega cotacao_id da URL
    const pathParts = window.location.pathname.split('/');
    const cotacaoId = pathParts[pathParts.length - 2];

    const response = await fetch(
      `${API_URL}/portal/cotacao/${cotacaoId}/${token}`
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Erro ao carregar cotação');
    }

    const data = await response.json();

    // Transformar para formato esperado pela tela
    return {
      id: data.cotacao.id,
      numero_cotacao: data.cotacao.numero,
      itens: (data.itens || []).map(item => ({
        id: item.id,
        peca: item.item_nome,
        nome: item.item_nome,
        codigo: item.codigo,
        quantidade: item.quantidade,
        categoria: item.categoria,
        urgencia: item.urgencia,
      }))
    };
  },

  /**
   * Enviar resposta da cotação
   * @param {string} token - Token de acesso público
   * @param {Object} dados - Dados da resposta
   * @returns {Promise<Object>} Resultado da operação
   */
  async responderCotacao(token, dados) {
    // Pega cotacao_id da URL
    const pathParts = window.location.pathname.split('/');
    const cotacaoId = pathParts[pathParts.length - 2];

    const response = await fetch(
      `${API_URL}/portal/cotacao/${cotacaoId}/${token}/responder`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fornecedorId: '1', // TODO: pegar do token ou contexto
          respostas: dados.itens.map(item => ({
            itemId: item.item_id,
            chamadoItemId: item.id,
            valor: parseFloat(item.valor_unitario || 0),
            prazo: parseInt(dados.prazo_entrega || 0),
            frete: parseFloat(item.valor_frete || 0),
            observacoes: dados.observacoes || ''
          }))
        })
      }
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Erro ao enviar resposta');
    }

    return await response.json();
  }
};