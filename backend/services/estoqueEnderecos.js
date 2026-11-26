// services/estoqueEnderecos.js — etapa Q2: baixa do saldo POR ENDEREÇO nas saídas que não escolhem endereço
//   (retirada aprovada, saída manual, NC de descarte/devolução). Invariante do M4.4: itens_consumo.saldo_atual = soma
//   de itens_consumo_enderecos.saldo. Regra: tira do endereço indicado; senão do que tem MAIS saldo, e se não bastar
//   continua no próximo. Item antigo sem endereço cadastrado: baixa só o total (nada a fazer aqui).
async function baixarEnderecos(DB, tenantId, itemConsumoId, quantidade, enderecoPreferido = null) {
  let falta = parseFloat(quantidade) || 0; const usados = [];
  if (falta <= 0) return usados;
  const linhas = (await DB.select('itens_consumo_enderecos', { item_consumo_id: itemConsumoId, tenant_id: tenantId }, tenantId))
    .filter((e) => (parseFloat(e.saldo) || 0) > 0)
    .sort((a, b) => (enderecoPreferido && a.endereco === enderecoPreferido ? -1 : enderecoPreferido && b.endereco === enderecoPreferido ? 1 : (parseFloat(b.saldo) || 0) - (parseFloat(a.saldo) || 0)));
  for (const e of linhas) {
    if (falta <= 1e-9) break;
    const tira = Math.min(falta, parseFloat(e.saldo) || 0);
    await DB.update('itens_consumo_enderecos', e.id, { saldo: Math.round(((parseFloat(e.saldo) || 0) - tira) * 10000) / 10000, atualizado_em: new Date() }, tenantId);
    usados.push({ endereco: e.endereco, quantidade: tira }); falta -= tira;
  }
  return usados;
}
async function somarEndereco(DB, tenantId, itemConsumoId, quantidade, endereco = 'RECEBIMENTO') {
  const q = parseFloat(quantidade) || 0; if (q <= 0) return;
  const linha = (await DB.select('itens_consumo_enderecos', { item_consumo_id: itemConsumoId, tenant_id: tenantId }, tenantId)).find((e) => e.endereco === endereco);
  if (linha) await DB.update('itens_consumo_enderecos', linha.id, { saldo: (parseFloat(linha.saldo) || 0) + q, atualizado_em: new Date() }, tenantId);
  else await DB.insert('itens_consumo_enderecos', { tenant_id: tenantId, item_consumo_id: itemConsumoId, endereco, saldo: q, atualizado_em: new Date() }, tenantId);
}
const textoEnderecos = (usados) => (usados.length ? ` [endereço: ${usados.map((u) => `${u.endereco} ${u.quantidade}`).join(', ')}]` : '');
module.exports = { baixarEnderecos, somarEndereco, textoEnderecos };
