// services/NfeXmlParser.js
//
// Parser server-side de XML de NF-e (modelo 55). Aceita XML cru (string
// ou Buffer) e devolve objeto estruturado com os campos que:
//   • A validação precisa (CNPJs, itens, valores, quantidades)
//   • O armazenamento fiscal precisa (chave de acesso, número, série,
//     data de emissão, valor total)
//
// Por que server-side e não no cliente:
//   1. O XML assinado pelo emissor precisa ser preservado byte-a-byte
//      pra auditoria fiscal. Se o cliente parseia e reenvia JSON, o
//      original se perde (e a assinatura digital junto).
//   2. Cliente pode mentir — parse server-side garante que o que está
//      armazenado bate com o que foi validado.
//   3. Um dia o XML pode chegar por integração servidor-a-servidor
//      (SEFAZ, parceiro, EDI) — a função já funciona.
//
// Compatibilidade: layouts 3.10 e 4.00 (os 2 em circulação no Brasil).
// Cobre namespaces variados via strip de prefixo antes do parse.
//
// Nunca lança em item malformado — devolve `warnings[]` e segue. Só
// lança se o XML não tem `infNFe` (nem é NF-e).

const { XMLParser } = require('fast-xml-parser');

// ─────────────────────────────────────────────────────────────────────────
// CONFIG DO PARSER
//
// `ignoreAttributes: false` — precisamos do `Id` do infNFe (chave de
// acesso). Sem isso, perdemos a chave.
//
// `isArray` força `det`/`dup`/`vol` a virar array mesmo com 1 só —
// sem isso, o código a jusante tem que lidar com "objeto OU array" em
// todo lugar (fonte clássica de bug em NF-e).
//
// `trimValues: true` — remove espaços em volta (emissor às vezes deixa).
// ─────────────────────────────────────────────────────────────────────────
const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => ['det', 'dup', 'vol'].includes(name),
};

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

// Strip de namespaces antes do parse. Emissores variam entre
// `<NFe xmlns="...">`, `<nfe:NFe xmlns:nfe="...">` e sem namespace.
// Removendo o prefixo `<ns:` → `<`, o parser lê tudo consistente.
function stripNamespaces(xml) {
  return String(xml || '').replace(/<\/?[a-zA-Z0-9_-]+:/g, (m) => m.replace(/[a-zA-Z0-9_-]+:/, ''));
}

function toNumber(v, fallback = 0) {
  if (v == null || v === '') return fallback;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function toStr(v) {
  return v == null ? '' : String(v).trim();
}

// Percorre caminhos seguros tipo `get(obj, 'a.b.c')` sem estourar em null.
function get(obj, path) {
  return path.split('.').reduce((acc, k) => (acc == null ? null : acc[k]), obj);
}

// ─────────────────────────────────────────────────────────────────────────
// parseNfeXml
//
// Entrada: xmlString (string) ou Buffer
// Saída:   { ok: true, ...campos } ou lança Error se não for NF-e
//
// Nunca lança em item malformado — vai pra `warnings[]`.
// ─────────────────────────────────────────────────────────────────────────
function parseNfeXml(input) {
  const xmlRaw = Buffer.isBuffer(input) ? input.toString('utf8') : String(input || '');
  if (!xmlRaw.trim()) {
    throw new Error('XML vazio.');
  }

  // Strip BOM (emissor às vezes manda).
  const semBom = xmlRaw.replace(/^\uFEFF/, '');
  const limpo = stripNamespaces(semBom);

  const parser = new XMLParser(parserOptions);
  let parsed;
  try {
    parsed = parser.parse(limpo);
  } catch (err) {
    throw new Error(`XML malformado: ${err.message}`);
  }

  // Envelope — alguns emissores embrulham em `nfeProc` (com protocolo
  // SEFAZ), outros mandam `NFe` puro. Ambos têm `infNFe` no mesmo lugar.
  const NFe = parsed?.NFe || parsed?.nfeProc?.NFe;
  if (!NFe) {
    throw new Error('XML não contém NFe (não é NF-e modelo 55?).');
  }
  const infNFe = NFe.infNFe;
  if (!infNFe) {
    throw new Error('XML não contém infNFe.');
  }

  const warnings = [];

  // ─── Chave de acesso ───
  // Vem como atributo `Id="NFe352409..."` — tira o prefixo "NFe".
  const idBruto = infNFe['@_Id'] || '';
  const chave_acesso = String(idBruto).replace(/^NFe/, '').trim();
  if (!chave_acesso || chave_acesso.length !== 44) {
    warnings.push(`Chave de acesso inválida ou ausente (recebido: "${chave_acesso}").`);
  }

  // ─── Versão do layout ───
  const versao_layout = toStr(infNFe['@_versao']);

  // ─── Identificação (ide) ───
  const ide = infNFe.ide || {};
  const numero_nf = toStr(ide.nNF);
  const serie = toStr(ide.serie);
  const modelo = toStr(ide.mod);
  const natureza_operacao = toStr(ide.natOp);
  const data_emissao = toStr(ide.dhEmi || ide.dEmi); // 4.00 usa dhEmi; 3.10 usa dEmi
  const tipo_nf = toStr(ide.tpNF); // 0=entrada, 1=saída
  if (!numero_nf) warnings.push('Número da NF (nNF) ausente.');

  // ─── Emitente ───
  const emit = infNFe.emit || {};
  const cnpj_emitente = toStr(emit.CNPJ || emit.CPF);
  const nome_emitente = toStr(emit.xNome);
  const ie_emitente = toStr(emit.IE);
  if (!cnpj_emitente) warnings.push('CNPJ/CPF do emitente ausente.');

  // ─── Destinatário ───
  const dest = infNFe.dest || {};
  const cnpj_destinatario = toStr(dest.CNPJ || dest.CPF);
  const nome_destinatario = toStr(dest.xNome);
  if (!cnpj_destinatario) warnings.push('CNPJ/CPF do destinatário ausente.');

  // ─── Totais (ICMSTot) ───
  const total = infNFe.total?.ICMSTot || {};
  const valor_produtos = toNumber(total.vProd);
  const valor_frete = toNumber(total.vFrete);
  const valor_seguro = toNumber(total.vSeg);
  const valor_desconto = toNumber(total.vDesc);
  const valor_icms = toNumber(total.vICMS);
  const valor_ipi = toNumber(total.vIPI);
  const valor_pis = toNumber(total.vPIS);
  const valor_cofins = toNumber(total.vCOFINS);
  const valor_total = toNumber(total.vNF);
  if (valor_total <= 0) warnings.push('Valor total (vNF) ausente ou zerado.');

  // ─── Transporte (peso/volumes) ───
  const transp = infNFe.transp || {};
  const peso_bruto = toNumber(get(transp, 'vol.0.pesoB'));
  const peso_liquido = toNumber(get(transp, 'vol.0.pesoL'));
  const qtd_volumes = toNumber(get(transp, 'vol.0.qVol'));

  // ─── Itens (det) ───
  const det = infNFe.det || [];
  const itens = det.map((d, idx) => {
    const nItem = toStr(d['@_nItem']) || String(idx + 1);
    const prod = d.prod || {};
    const imposto = d.imposto || {};

    // ICMS — pode vir em vários sub-nós (ICMS00, ICMS10, ICMS102, etc)
    const icmsNode = imposto.ICMS || {};
    const icmsTipo = Object.keys(icmsNode).find(k => k.startsWith('ICMS')) || null;
    const icms = icmsTipo ? (icmsNode[icmsTipo] || {}) : {};
    // CST pode vir "00", "0", "102", etc. FIX (2026-09): usar `!= null`
    // em vez de `||` — o fast-xml-parser converte "00" em número 0, e
    // `0 || CSOSN` cai no fallback, perdendo o código. Também aplicar
    // padStart(2, '0') pra "0" virar "00" e casar com a tabela oficial
    // de CST da SEFAZ.
    const cstBruto = icms.CST != null ? icms.CST : icms.CSOSN;
    const icms_cst = cstBruto != null ? String(cstBruto).padStart(2, '0') : '';
    const icms_aliquota = toNumber(icms.pICMS);
    const icms_valor = toNumber(icms.vICMS);

    // IPI (opcional)
    const ipiNode = imposto.IPI || {};
    const ipiTipo = Object.keys(ipiNode).find(k => k.startsWith('IPI'));
    const ipi = ipiTipo ? (ipiNode[ipiTipo] || {}) : {};
    const ipi_cst = ipi.CST != null ? String(ipi.CST).padStart(2, '0') : '';
    const ipi_valor = toNumber(get(ipiNode, 'IPITrib.vIPI'));

    const codigo = toStr(prod.cProd);
    const descricao = toStr(prod.xProd);
    const quantidade = toNumber(prod.qCom);
    const valor_unitario = toNumber(prod.vUnCom);
    const valor_total_item = toNumber(prod.vProd);

    if (!descricao) warnings.push(`Item ${nItem}: descrição (xProd) ausente.`);
    if (quantidade <= 0) warnings.push(`Item ${nItem}: quantidade inválida (${prod.qCom}).`);

    return {
      numero: nItem,
      codigo,
      descricao,
      ncm: toStr(prod.NCM),
      cfop: toStr(prod.CFOP),
      unidade: toStr(prod.uCom),
      quantidade,
      valor_unitario,
      valor_total: valor_total_item,
      ean: toStr(prod.cEAN),
      ean_tributavel: toStr(prod.cEANTrib),
      icms: { cst: icms_cst, aliquota: icms_aliquota, valor: icms_valor },
      ipi: { cst: ipi_cst, valor: ipi_valor },
    };
  });

  if (itens.length === 0) warnings.push('NF-e sem itens (det vazio).');

  return {
    ok: true,
    // Identificação
    chave_acesso,
    versao_layout,
    numero_nf,
    serie,
    modelo,
    natureza_operacao,
    data_emissao,
    tipo_nf,
    // Partes
    cnpj_emitente,
    nome_emitente,
    ie_emitente,
    cnpj_destinatario,
    nome_destinatario,
    // Valores
    valor_produtos,
    valor_frete,
    valor_seguro,
    valor_desconto,
    valor_icms,
    valor_ipi,
    valor_pis,
    valor_cofins,
    valor_total,
    // Transporte
    peso_bruto,
    peso_liquido,
    qtd_volumes,
    // Itens
    itens,
    // Metadados
    warnings,
    xml_raw: semBom, // preservado pra storage fiscal (byte-a-byte, sem BOM)
  };
}

module.exports = { parseNfeXml };