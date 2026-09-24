// services/ValidacaoXmlService.js
//
// Validação de XML de NF-e contra uma Ordem de Compra (ordens_venda).
//
// Extraído do handler POST /estoque/movimentacoes/validar-xml (2026-09)
// pra ser reusável pelas 2 portas:
//   1. Comprador (recebimento — rota atual, comportamento idêntico)
//   2. Fornecedor (upload no hub, em breve)
//
// Contrato: recebe o XML já parseado (xmlData do DOMParser no frontend,
// passado como JSON) + id da OC + tenant, devolve o objeto `validacao`
// no mesmo formato que o handler antigo devolvia — pra não quebrar o
// frontend atual do recebimento.
//
// Não valida assinatura digital, impostos nem CFOP — só:
//   • CNPJ emitente vs fornecedor cadastrado
//   • CNPJ destinatário vs filial/matriz
//   • Match de item (SKU exato → nome → Levenshtein)
//   • Quantidade e valor unitário por item
// Impostos/CFOP ficam pra v2.

const { DB } = require('../db');

// ─────────────────────────────────────────────────────────────────────────
// normalizarEntradaXml
//
// Aceita 2 formatos de XML já parseado:
//   1. Legacy (frontend do recebimento): { cnpj_emitente, cnpj_destinatario,
//      itens_xml: [{ descricao, quantidade, valorUnitario, codigo }] }
//   2. Parser server-side (NfeXmlParser): { cnpj_emitente, cnpj_destinatario,
//      itens: [{ descricao, quantidade, valor_unitario, codigo }] }
//
// Devolve sempre no formato legacy, que é o que o `validarXmlContraOc`
// consome. Assim o frontend antigo continua funcionando sem mudança, e
// o novo fluxo do fornecedor manda o output do parser direto.
// ─────────────────────────────────────────────────────────────────────────
function normalizarEntradaXml(xmlData) {
  const itensBrutos = xmlData.itens_xml || xmlData.itens || [];
  const itens_xml = itensBrutos.map(it => ({
    descricao: it.descricao || '',
    codigo: it.codigo || '',
    quantidade: it.quantidade,
    // `valor_unitario` (parser) vs `valorUnitario` (legacy frontend)
    valorUnitario: it.valorUnitario != null ? it.valorUnitario : it.valor_unitario,
    valorTotal: it.valorTotal != null ? it.valorTotal : it.valor_total,
  }));

  return {
    cnpj_emitente: xmlData.cnpj_emitente || '',
    cnpj_destinatario: xmlData.cnpj_destinatario || '',
    itens_xml,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers locais — antes viviam inline no handler. Ficam no service pra
// o handler não precisar mais deles (o wrapper é fino).
// ─────────────────────────────────────────────────────────────────────────

function normalizarTexto(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

const calcularLevenshtein = (a, b) => {
  a = normalizarTexto(a);
  b = normalizarTexto(b);
  
  // Early return — string idêntica tem distância 0 (evita montar a matriz
  // no caso mais comum de match exato).
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  
  const m = a.length, n = b.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i][j - 1] + 1,
        dp[i - 1][j] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  
  return dp[m][n];
};

// ─────────────────────────────────────────────────────────────────────────
// validarXmlContraOc
//
// Recebe:
//   xmlData      — objeto com { cnpj_emitente, cnpj_destinatario, itens_xml[] }
//   ordemVendaId — id da OC (ordens_venda)
//   tenantId     — tenant do comprador (do JWT no handler público, ou do
//                  próprio fornecedor no fluxo autenticado — resolvido pelo caller)
//
// Devolve: { validacao: { cnpj, cnpj_status, cnpj_destinatario, itens, totalDivergencias } }
// ─────────────────────────────────────────────────────────────────────────
async function validarXmlContraOc(xmlDataRaw, ordemVendaId, tenantId) {
  if (!xmlDataRaw) {
    throw new Error('Dados do XML não recebidos.');
  }
  const xmlData = normalizarEntradaXml(xmlDataRaw);
  if (!xmlData.itens_xml.length) {
    // Sem itens não dá pra validar nada relevante — aceita vazio, mas
    // a validação vai devolver `match_fallback` em todos os itens da OV.
  }

  // 1. Buscar OC e filial
  const ov = await DB.selectOne('ordens_venda', { id: ordemVendaId }, tenantId);
  if (!ov) throw new Error('Ordem de venda não encontrada.');

  const filial = ov.filial_id
    ? await DB.selectOne('tenant_filiais', { id: ov.filial_id }, tenantId)
    : null;
  const tenant = await DB.selectOne('tenants', { id: tenantId });

  // 2. CNPJ destinatário
  const cnpjDestinatario = xmlData.cnpj_destinatario || '';
  const cnpjEsperado = filial?.cnpj_filial || tenant?.cnpj || '';
  const cnpjDestStatus = cnpjDestinatario === cnpjEsperado ? 'ok' : 'divergente';

  // 3. CNPJ emitente vs fornecedor
  const cnpjEmitente = xmlData.cnpj_emitente || '';
  const fornecedor = await DB.selectOne('fornecedores', { id: ov.fornecedor_id }, tenantId);
  const cnpjFornecedor = fornecedor?.cnpj || '';
  const cnpjStatus = cnpjEmitente === cnpjFornecedor ? 'ok' : 'divergente';

  // 4. Itens
  const itensOV = await DB.select('ordem_venda_itens', { ordem_venda_id: ov.id }, tenantId);
  const validacoes = [];

  for (const itemOV of itensOV) {
    // FIX (2026-09): a coluna real em ordem_venda_itens é `nome_item`,
    // não `item_nome`. Suportar os 2 nomes pra não quebrar se um dia
    // o schema mudar de volta.
    const nomeOV = itemOV.nome_item || itemOV.item_nome || '';
    const itemXML = xmlData.itens_xml.find(item => {
      const descXML = normalizarTexto(item.descricao || '');
      const descOV = normalizarTexto(nomeOV);

      const skuMatch = itemOV.item_catalogo_id && item.codigo === itemOV.item_catalogo_id;
      const descMatch = descOV.length > 3 && descXML.includes(descOV);
      const levenshteinMatch = calcularLevenshtein(descOV, descXML) <= 3;

      return skuMatch || descMatch || levenshteinMatch;
    });

    if (!itemXML) {
      const itemNFePendente = xmlData.itens_xml.find(item =>
        !validacoes.some(v => v.item_nfe === item.descricao)
      );
      validacoes.push({
        item: nomeOV,
        item_nfe: itemNFePendente?.descricao || 'Não encontrado',
        status: 'match_fallback',
        mensagem: 'Item não encontrado. Associe manualmente.',
      });
    } else if (parseInt(itemOV.quantidade || 0) !== parseInt(itemXML.quantidade || 0)) {
      validacoes.push({
        item: nomeOV,
        item_nfe: itemXML.descricao || '',
        status: 'divergencia_quantidade',
        mensagem: `Qtd: OV ${itemOV.quantidade} vs XML ${itemXML.quantidade}`,
      });
    } else if (parseFloat(itemOV.valor_unitario || 0) !== parseFloat(itemXML.valorUnitario || 0)) {
      validacoes.push({
        item: nomeOV,
        item_nfe: itemXML.descricao || '',
        status: 'divergencia_valor',
        mensagem: `Valor: OV ${itemOV.valor_unitario} vs XML ${itemXML.valorUnitario}`,
      });
    } else {
      validacoes.push({
        item: nomeOV,
        item_nfe: itemXML.descricao || '',
        status: 'ok',
        mensagem: 'Item validado',
      });
    }
  }

  const totalDivergencias =
    validacoes.filter(v => v.status !== 'ok').length +
    (cnpjStatus !== 'ok' ? 1 : 0) +
    (cnpjDestStatus !== 'ok' ? 1 : 0);

  return {
    validacao: {
      cnpj: cnpjEmitente === cnpjFornecedor
        ? '✅ CNPJ Emitente válido'
        : `❌ CNPJ Emitente divergente (Esperado: ${cnpjFornecedor})`,
      cnpj_status: cnpjStatus,
      cnpj_destinatario: cnpjDestStatus === 'ok'
        ? `✅ CNPJ Destinatário válido (${filial?.nome_filial || 'Matriz'})`
        : `❌ CNPJ Destinatário divergente (Esperado: ${cnpjEsperado})`,
      itens: validacoes,
      totalDivergencias,
    },
  };
}

module.exports = { validarXmlContraOc, normalizarEntradaXml, normalizarTexto, calcularLevenshtein };