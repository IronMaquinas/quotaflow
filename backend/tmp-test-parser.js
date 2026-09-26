const fs = require('fs');
const { parseNfeXml } = require('./services/NfeXmlParser');

const xml = fs.readFileSync(process.argv[2], 'utf8');
const r = parseNfeXml(xml);
console.log(JSON.stringify({
  chave: r.chave_acesso,
  numero: r.numero_nf,
  emit: r.cnpj_emitente,
  dest: r.cnpj_destinatario,
  total: r.valor_total,
  itens: r.itens.length,
  primeiro_item: r.itens[0],
  warnings: r.warnings,
}, null, 2));