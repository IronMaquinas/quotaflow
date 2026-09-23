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

    // FIX (2026-09): versão enxuta — NÃO espalhar `...data.cotacao` nem
    // adicionar `empresa`/`fornecedor` como objetos soltos no retorno.
    // Isso jogava os campos crus do tenant (id, slug, cnpj, plano...)
    // no estado, e algum JSX renderizava `{cotacao.empresa}` direto,
    // quebrando com "Objects are not valid as a React child".
    // Mantemos apenas o que a tela realmente usa + os campos novos do
    // "já respondida" (que são primitivos/array — seguros pro React).
    return {
      // Aliases legados (compatíveis com a tela que já funcionava)
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
      })),

      // Campos do "já respondida" — backend pode retornar em root OU
      // aninhado dentro de `cotacao` dependendo da versão do patch.
      // Aceitamos os dois pra não quebrar em nenhum caso.
      ja_respondida:
        data.ja_respondida === true || data.cotacao?.ja_respondida === true,
      respondida_em:
        data.respondida_em || data.cotacao?.respondida_em || null,
      itens_respondidos:
        (Array.isArray(data.itens_respondidos) && data.itens_respondidos) ||
        (Array.isArray(data.cotacao?.itens_respondidos) && data.cotacao.itens_respondidos) ||
        [],

      // Respostas existentes (pra preencher prazo/obs no modo "já respondida")
      respostasExistentes: data.respostasExistentes || null,
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
        // #4c — Validade da proposta, obrigatória no portal. O backend
        // valida (1..365) e usa default 30 se chegar fora da faixa, mas
        // a UI já bloqueia o "Revisar" sem isso — esse campo só chega
        // preenchido.
        validade_dias: parseInt(dados.validade_dias || 30),
        respostas: dados.itens.map(item => ({
          itemId: item.item_id,
          valor_unitario: parseFloat(item.valor_unitario || 0),
          quantidade: item.quantidade,
          prazo: parseInt(dados.prazo_entrega || 0),
          valor_frete: parseFloat(item.valor_frete || 0),
          frete: item.frete,
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