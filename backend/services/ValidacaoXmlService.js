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

  // M6: buscar chamado_itens pra ter o `codigo` (PN do fabricante) como
  // referência no match por PN. Alguns itens só terão o cProd do fornecedor
  // (ordem_venda_itens.codigo_fornecedor), outros só o código da RC.
  const chamadoItemIdsDaOv = itensOV.map(i => i.chamado_item_id).filter(Boolean);
  const todosChamadoItensVal = await DB.select('chamado_itens', { tenant_id: tenantId }, tenantId);
  const chamadoItemPorIdVal = {};
  todosChamadoItensVal
    .filter(ci => chamadoItemIdsDaOv.includes(ci.id))
    .forEach(ci => { chamadoItemPorIdVal[ci.id] = ci; });

  for (const itemOV of itensOV) {
    const nomeOV = itemOV.nome_item || itemOV.item_nome || '';
    const chamadoItem = chamadoItemPorIdVal[itemOV.chamado_item_id];
    const pnRc = chamadoItem?.codigo ? String(chamadoItem.codigo).trim() : null;
    const pnFornecedor = itemOV.codigo_fornecedor
      ? String(itemOV.codigo_fornecedor).trim()
      : null;

    // M6: match em 5 estágios, com prioridade decrescente de confiança.
    let itemXML = null;
    let tipoMatch = null;

    // Estágio 1 — cProd == vínculo do fornecedor (mais forte).
    if (pnFornecedor) {
      const cand = xmlData.itens_xml.find(
        it => String(it.codigo || '').trim() === pnFornecedor
      );
      if (cand) { itemXML = cand; tipoMatch = 'match_exato_pn_fornecedor'; }
    }

    // Estágio 2 — cProd == PN do fabricante cadastrado na RC.
    // Cobre o caso "fornecedor usou o mesmo código que o comprador" —
    // a maioria dos commodities.
    if (!itemXML && pnRc) {
      const cand = xmlData.itens_xml.find(
        it => String(it.codigo || '').trim() === pnRc
      );
      if (cand) { itemXML = cand; tipoMatch = 'match_exato_pn_rc'; }
    }

    // Estágio 3 — nome normalizado exato.
    if (!itemXML) {
      const descOVNorm = normalizarTexto(nomeOV);
      const cand = xmlData.itens_xml.find(
        it => normalizarTexto(it.descricao || '') === descOVNorm
      );
      if (cand) { itemXML = cand; tipoMatch = 'match_exato_nome'; }
    }

    // Estágio 4 — SKU exato do catálogo.
    if (!itemXML && itemOV.item_catalogo_id) {
      const cand = xmlData.itens_xml.find(
        it => it.codigo === itemOV.item_catalogo_id
      );
      if (cand) { itemXML = cand; tipoMatch = 'match_exato_sku'; }
    }

    // Estágio 5 — Levenshtein ≤ 3 (fuzzy, aceita com alerta).
    if (!itemXML) {
      const descOVNorm = normalizarTexto(nomeOV);
      const cand = xmlData.itens_xml.find(item => {
        const descXML = normalizarTexto(item.descricao || '');
        const jaAssociado = validacoes.some(v =>
          v.item_nfe === item.descricao && v.status !== 'match_fallback'
        );
        if (jaAssociado) return false;
        return calcularLevenshtein(descOVNorm, descXML) <= 3;
      });
      if (cand) { itemXML = cand; tipoMatch = 'match_fuzzy'; }
    }

    // Validação da linha
    if (!itemXML) {
      const itemNFePendente = xmlData.itens_xml.find(item =>
        !validacoes.some(v => v.item_nfe === item.descricao)
      );
      validacoes.push({
        item: nomeOV,
        item_nfe: itemNFePendente?.descricao || 'Não encontrado',
        status: 'match_fallback',
        tipo_match: 'match_fallback',
        pn_rc: pnRc,
        pn_fornecedor: pnFornecedor,
        mensagem: (pnRc || pnFornecedor)
          ? `Nenhum item da NFe tem o código "${pnFornecedor || pnRc}". Associe manualmente ou confirme com o fornecedor.`
          : 'Item não encontrado. Associe manualmente ou peça pro fornecedor informar o código do produto na cotação.',
      });
    } else if (parseInt(itemOV.quantidade || 0) !== parseInt(itemXML.quantidade || 0)) {
      validacoes.push({
        item: nomeOV,
        item_nfe: itemXML.descricao || '',
        status: 'divergencia_quantidade',
        tipo_match: tipoMatch,
        pn_rc: pnRc,
        pn_fornecedor: pnFornecedor,
        mensagem: `Qtd: OC ${itemOV.quantidade} vs NFe ${itemXML.quantidade}`,
      });
    } else if (parseFloat(itemOV.valor_unitario || 0) !== parseFloat(itemXML.valorUnitario || 0)) {
      validacoes.push({
        item: nomeOV,
        item_nfe: itemXML.descricao || '',
        status: 'divergencia_valor',
        tipo_match: tipoMatch,
        pn_rc: pnRc,
        pn_fornecedor: pnFornecedor,
        mensagem: `Valor: OC ${itemOV.valor_unitario} vs NFe ${itemXML.valorUnitario}`,
      });
    } else {
      const mensagens = {
        match_exato_pn_fornecedor: 'Item validado pelo código do fornecedor (cProd).',
        match_exato_pn_rc: 'Item validado pelo PN cadastrado na RC.',
        match_exato_nome: 'Item validado por nome exato.',
        match_exato_sku: 'Item validado por SKU do catálogo.',
        match_fuzzy: 'Nome parecido — confira se é a peça certa.',
      };
      validacoes.push({
        item: nomeOV,
        item_nfe: itemXML.descricao || '',
        status: 'ok',
        tipo_match: tipoMatch,
        pn_rc: pnRc,
        pn_fornecedor: pnFornecedor,
        mensagem: mensagens[tipoMatch] || 'Item validado.',
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