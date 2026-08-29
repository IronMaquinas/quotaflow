// frontend/src/services/portalService.js
import { API_URL } from '../utils/constants';

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

    // A resposta do backend tem a estrutura: { cotacao, fornecedor, empresa, itens, respostasExistentes }
    return {
      id: data.cotacao?.id,
      numero_cotacao: data.cotacao?.numero,
      itens: (data.itens || []).map(item => ({
        id: item.id,
        peca: item.item_nome || item.nome,
        nome: item.item_nome || item.nome,
        descricao: item.descricao || '',
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
    // Extrai cotacaoId do hash
    const hashParts = window.location.hash.split('/');
    const cotacaoId = hashParts[hashParts.length - 2];

    if (!cotacaoId || isNaN(cotacaoId)) {
      throw new Error('ID da cotação inválido no link');
    }

    const response = await fetch(`${API_URL}/portal/cotacao/${cotacaoId}/${token}/responder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fornecedorId: '1', // TODO: ajustar se necessário
        respostas: dados.itens.map(item => ({
          itemId: item.item_id,
          chamadoItemId: item.id,
          valor: parseFloat(item.valor_unitario || 0),
          prazo: parseInt(dados.prazo_entrega || 0),
          frete: parseFloat(item.valor_frete || 0),
          observacoes: dados.observacoes || ''
        }))
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || data.erro || 'Erro ao enviar resposta');
    }

    return await response.json();
  }
};