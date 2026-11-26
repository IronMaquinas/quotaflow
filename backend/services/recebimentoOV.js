// services/recebimentoOV.js — etapa Q2: rodadas de recebimento (entrega parcial) e o efeito da NC no estoque
const { baixarEnderecos, somarEndereco, textoEnderecos } = require('./estoqueEnderecos');
const pendenteDe = (item) => Math.max(0, (parseFloat(item.quantidade) || 0) - (parseFloat(item.quantidade_recebida) || 0));
const esperadoRodada = (item) => { const nf = parseFloat(item.quantidade_nf); return nf > 0 ? nf : pendenteDe(item); };
// soma o que entrou; se ainda falta do pedido, abre a próxima rodada (fiscal, contagem e entrada de novo, para a próxima NF)
async function fecharRodada(DB, tenantId, item, entrou, extra = {}) {
  const recebida = Math.round(((parseFloat(item.quantidade_recebida) || 0) + (parseFloat(entrou) || 0)) * 10000) / 10000;
  const falta = (parseFloat(item.quantidade) || 0) - recebida;
  const upd = { quantidade_recebida: recebida, ...extra };
  if (falta > 1e-9) Object.assign(upd, {
    rodada_recebimento: (parseInt(item.rodada_recebimento, 10) || 1) + 1, miro_por: null, miro_em: null, migo_por: null, migo_em: null,
    numero_nota_fiscal: null, quantidade_nf: null, valor_nf: null, quantidade_recebida_fisica: null, tentativa_atual: 0,
    status_contagem: null, contagem_atual_id: null, status_quarentena: 'pendente', motivo_divergencia: null,
  });
  await DB.update('ordem_venda_itens', item.id, upd, tenantId);
  return { recebida, falta: Math.max(0, falta) };
}
async function proximoMov(DB, tenantId) {
  const ano = new Date().getFullYear(); const p = `MOV-${ano}-`;
  const maior = (await DB.select('movimentacoes_estoque', { tenant_id: tenantId }, tenantId)).reduce((m, x) => (String(x.numero_movimento || '').startsWith(p) ? Math.max(m, parseInt(x.numero_movimento.slice(p.length), 10) || 0) : m), 0);
  return `${p}${String(maior + 1).padStart(4, '0')}`;
}
async function statusOV(DB, tenantId, ovId) { // mesmos valores da entrada (movimentacoes /entrada)
  const itens = await DB.select('ordem_venda_itens', { ordem_venda_id: ovId, tenant_id: tenantId }, tenantId);
  const tudo = itens.length && itens.every((i) => (parseFloat(i.quantidade_recebida) || 0) + 1e-9 >= (parseFloat(i.quantidade) || 0));
  const emNC = itens.some((i) => i.status_quarentena === 'nao_conforme');
  await DB.update('ordens_venda', ovId, { status: tudo ? 'recebido' : 'parcial_recebido', status_recebimento: tudo ? 'recebido' : emNC ? 'nao_conforme' : 'parcial', atualizado_em: new Date() }, tenantId);
}

// ─── NC × estoque (no encerramento) ────────────────────────────────────────────
//   NC do recebimento (material nunca entrou): uso como está / retrabalho → ENTRA no estoque e conta como recebido;
//     devolução / descarte → o item da OC volta a esperar a reposição do fornecedor (nova NF).
//   NC de material que está no estoque (material_no_estoque): descarte / devolução → SAI do estoque.
async function planoEstoqueNC(DB, tenantId, nc) {
  if (nc.estoque_movimentado_em) return null;
  const disp = nc.disposicao; const usa = ['uso_como_esta', 'retrabalho'].includes(disp); const tira = ['descarte', 'devolucao'].includes(disp);
  if (nc.ordem_venda_id && !nc.material_no_estoque) {
    let item = nc.ordem_venda_item_id ? await DB.selectOne('ordem_venda_itens', { id: nc.ordem_venda_item_id, tenant_id: tenantId }, tenantId) : null;
    if (!item) { const cands = (await DB.select('ordem_venda_itens', { ordem_venda_id: nc.ordem_venda_id, tenant_id: tenantId }, tenantId)).filter((i) => i.status_quarentena === 'nao_conforme'); if (cands.length === 1) item = cands[0]; }
    if (!item || item.status_quarentena !== 'nao_conforme') return null;
    const qtd = Math.min(parseFloat(nc.quantidade) || parseFloat(item.quantidade_recebida_fisica) || 0, pendenteDe(item));
    if (usa && qtd > 0) return { tipo: 'entrada', item, qtd };
    if (tira) return { tipo: 'reabrir', item, qtd: 0 };
    return null;
  }
  if (nc.material_no_estoque && nc.item_consumo_id && tira) {
    const ic = await DB.selectOne('itens_consumo', { id: nc.item_consumo_id, tenant_id: tenantId }, tenantId); const qtd = parseFloat(nc.quantidade) || 0;
    if (!ic || qtd <= 0) return null;
    if (qtd > (parseFloat(ic.saldo_atual) || 0) + 1e-9) return { erro: `O estoque de ${ic.nome} tem ${parseFloat(ic.saldo_atual) || 0} e a NC é de ${qtd} — ajuste a quantidade da NC ou o estoque antes de encerrar.` };
    return { tipo: 'saida', ic, qtd };
  }
  return null;
}
async function executarEstoqueNC(DB, tenantId, nc, plano, u) {
  if (!plano) return null; const agora = new Date().toISOString(); const rotulo = `${nc.numero_nc || 'NC'} (${String(nc.disposicao).replace(/_/g, ' ')})`;
  let resumo = null;
  if (plano.tipo === 'entrada') {
    const it = plano.item; let ic = it.item_catalogo_id ? await DB.selectOne('itens_consumo', { catalogo_item_id: it.item_catalogo_id, tenant_id: tenantId }, tenantId) : null;
    if (!ic && it.item_catalogo_id) { const cat = await DB.selectOne('catalogo_itens', { id: it.item_catalogo_id, tenant_id: tenantId }, tenantId); if (cat) ic = await DB.insert('itens_consumo', { tenant_id: tenantId, catalogo_item_id: it.item_catalogo_id, nome: cat.nome || it.nome_item, sku: cat.codigo || null, unidade_medida: cat.unidade || 'UN', saldo_atual: 0, serializado: false }, tenantId); }
    if (ic) {
      await DB.update('itens_consumo', ic.id, { saldo_atual: (parseFloat(ic.saldo_atual) || 0) + plano.qtd, atualizado_em: new Date() }, tenantId);
      await somarEndereco(DB, tenantId, ic.id, plano.qtd, 'RECEBIMENTO');
      await DB.insert('movimentacoes_estoque', { tenant_id: tenantId, numero_movimento: await proximoMov(DB, tenantId), item_consumo_id: ic.id, ordem_venda_item_id: it.id, ordem_venda_id: it.ordem_venda_id, tipo: 'entrada', quantidade: plano.qtd, responsavel_id: u?.id || null, observacao: `Entrada pela ${rotulo}`, criado_em: new Date() }, tenantId);
    }
    await fecharRodada(DB, tenantId, it, plano.qtd, { status_quarentena: 'aprovado', status_contagem: 'concluido' });
    await statusOV(DB, tenantId, it.ordem_venda_id);
    resumo = { tipo: 'entrada', quantidade: plano.qtd, item_consumo_id: ic?.id || null, texto: `Entraram ${plano.qtd} no estoque${ic ? '' : ' (item sem catálogo — só contou como recebido)'}` };
  } else if (plano.tipo === 'reabrir') {
    await fecharRodada(DB, tenantId, plano.item, 0, {}); await statusOV(DB, tenantId, plano.item.ordem_venda_id);
    resumo = { tipo: 'reabrir', texto: `Item da OC volta a aguardar a reposição do fornecedor (${pendenteDe(plano.item)} pendente)` };
  } else if (plano.tipo === 'saida') {
    const ic = plano.ic;
    await DB.update('itens_consumo', ic.id, { saldo_atual: (parseFloat(ic.saldo_atual) || 0) - plano.qtd, atualizado_em: new Date() }, tenantId);
    const ends = await baixarEnderecos(DB, tenantId, ic.id, plano.qtd);
    await DB.insert('movimentacoes_estoque', { tenant_id: tenantId, numero_movimento: await proximoMov(DB, tenantId), item_consumo_id: ic.id, tipo: 'saida', quantidade: plano.qtd, responsavel_id: u?.id || null, observacao: `Baixa pela ${rotulo}${textoEnderecos(ends)}`, criado_em: new Date() }, tenantId);
    resumo = { tipo: 'saida', quantidade: plano.qtd, item_consumo_id: ic.id, texto: `Saíram ${plano.qtd} do estoque` };
  }
  if (resumo) await DB.update('nao_conformidades', nc.id, { estoque_movimentado_em: agora, estoque_movimento: resumo }, tenantId);
  return resumo;
}
module.exports = { pendenteDe, esperadoRodada, fecharRodada, statusOV, planoEstoqueNC, executarEstoqueNC };
