// services/suprimentos.js — etapa R1: 📊 SUPRIMENTOS com números reais (substitui Histórico de Preços / Inteligência da 1ª versão,
//   que liam a lista antiga de "chamados" e ficavam vazias). Fonte: OCs (ordens_venda + ordem_venda_itens) e propostas das cotações
//   (cotacao_fornecedores + cotacao_fornecedor_itens); categoria/urgência do item da requisição (chamado_itens) ou do catálogo.
//   • Gastos: total, por mês (12 meses até o fim do período), categoria, fornecedor, itens.
//   • Saving: NEGOCIAÇÃO da equipe (valor_original − valor final da OC) e MERCADO (mesma regra conservadora do Valor Gerado 5a).
//   • Oportunidades: preço subindo, compra sem concorrência, emergência, concentração em fornecedor, fornecedor que não responde.
//   • Preços: histórico por item (catálogo ou nome), mín/máx/médio/último, tendência.
//   • Fornecedores: convites, respostas, taxa de resposta, vitórias, gasto, NCs — base do "desempenho de provedores externos" (ISO 9.3).
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const seguro = async (p) => { try { return await q(p); } catch { return []; } };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const d10 = (d) => String(d || '').slice(0, 10);
const ym = (d) => String(d || '').slice(0, 7);
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const cancelada = (o) => /cancel/i.test(String(o.status || ''));
const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const URG = /alta|urgent|emerg|critic/i;

function periodo({ de, ate } = {}) {
  const h = hojeBR(); const a = /^\d{4}-\d{2}-\d{2}$/.test(String(ate || '')) ? ate : h;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(de || '')) ? de : `${a.slice(0, 4)}-01-01`;
  return d <= a ? { de: d, ate: a } : { de: a, ate: d };
}
const meses12 = (ate) => { const out = []; let [y, m] = ate.slice(0, 7).split('-').map(Number); for (let i = 0; i < 12; i++) { out.unshift(`${y}-${String(m).padStart(2, '0')}`); m--; if (!m) { m = 12; y--; } } return out; };

async function carregar(sb, tenantId) {
  const [ovs, itens, cfs, cfis, chi, cat, cots, ncs] = await Promise.all([
    seguro(sb.from('ordens_venda').select('*').eq('tenant_id', tenantId)), seguro(sb.from('ordem_venda_itens').select('*').eq('tenant_id', tenantId)),
    seguro(sb.from('cotacao_fornecedores').select('*').eq('tenant_id', tenantId)), seguro(sb.from('cotacao_fornecedor_itens').select('*').eq('tenant_id', tenantId)),
    seguro(sb.from('chamado_itens').select('*').eq('tenant_id', tenantId)), seguro(sb.from('catalogo_itens').select('*').eq('tenant_id', tenantId)),
    seguro(sb.from('cotacoes').select('*').eq('tenant_id', tenantId)), seguro(sb.from('nao_conformidades').select('*').eq('tenant_id', tenantId))]);
  const forn = await seguro(sb.from('fornecedores').select('*'));
  return { ovs: ovs.filter((o) => !cancelada(o)), itens, cfs, cfis, chi, cat, cots, ncs, forn };
}

/** linha de compra (item de OC) com tudo que as análises precisam */
function linhas(D) {
  const ov = new Map(D.ovs.map((o) => [String(o.id), o])); const chi = new Map(D.chi.map((c) => [String(c.id), c])); const cat = new Map(D.cat.map((c) => [String(c.id), c]));
  const nomeF = new Map(); for (const f of D.forn) nomeF.set(String(f.id), f.nome_fantasia || f.razao_social || f.nome); for (const c of D.cfs) if (c.fornecedor_nome && !nomeF.has(String(c.fornecedor_id))) nomeF.set(String(c.fornecedor_id), c.fornecedor_nome);
  const out = [];
  for (const it of D.itens) {
    const o = ov.get(String(it.ordem_venda_id)); if (!o) continue;
    const req = chi.get(String(it.chamado_item_id)) || {}; const c = cat.get(String(it.item_catalogo_id)) || {};
    const qtd = Number(it.quantidade) || 1; const total = Number(it.valor_total) > 0 ? Number(it.valor_total) : (Number(it.valor_unitario) || 0) * qtd; const unit = qtd ? total / qtd : total;
    out.push({ ov: o, data: d10(o.criado_em), item: it.nome_item || c.nome || 'Item', chave: it.item_catalogo_id ? `c${it.item_catalogo_id}` : `n${norm(it.nome_item)}`, cotacao_item_id: it.cotacao_item_id,
      categoria: req.categoria || c.categoria || 'Sem categoria', urgente: URG.test(String(req.urgencia || '')), fornecedor_id: String(o.fornecedor_id || ''), fornecedor: nomeF.get(String(o.fornecedor_id)) || 'Fornecedor', qtd, unit, total });
  }
  return { out, nomeF };
}

async function painel(sb, tenantId, opts = {}) {
  const P = periodo(opts); const D = await carregar(sb, tenantId); const { out: L, nomeF } = linhas(D);
  const noP = (d) => d >= P.de && d <= P.ate; const LP = L.filter((l) => noP(l.data)); const ovP = D.ovs.filter((o) => noP(d10(o.criado_em)));
  const gastoOv = (o) => Number(o.valor_total) || 0; const gasto = ovP.reduce((s, o) => s + gastoOv(o), 0);
  // saving de negociação (equipe): valor_original da proposta − valor final, por OC
  const neg = ovP.map((o) => { const orig = Number(o.valor_original) + (Number(o.frete_original) || 0); const fim = gastoOv(o); const e = Number(o.economia) > 0 ? Number(o.economia) : (orig > fim && fim > 0 ? orig - fim : 0); return { o, e: e > 0 && e < orig ? e : 0 }; });
  const savingNeg = neg.reduce((s, x) => s + x.e, 0);
  let savingMerc = 0; let merc = []; try { const VG = require('./valorGerado'); const r = await VG.compras(sb, tenantId, P.de, P.ate); savingMerc = r.total; merc = r.ganhos || []; } catch { /* ok */ }
  const somaPor = (arr, k) => { const m = new Map(); for (const l of arr) { const x = m.get(l[k]) || { nome: l[k], total: 0, compras: 0 }; x.total += l.total; x.compras++; m.set(l[k], x); } return [...m.values()].map((x) => ({ ...x, total: r2(x.total), pct: gasto ? Math.round((x.total / gasto) * 1000) / 10 : 0 })).sort((a, b) => b.total - a.total); };
  const porMes = meses12(P.ate).map((m) => ({ mes: m, total: r2(D.ovs.filter((o) => ym(o.criado_em) === m).reduce((s, o) => s + gastoOv(o), 0)), ocs: D.ovs.filter((o) => ym(o.criado_em) === m).length }));
  const porFornGasto = (() => { const m = new Map(); for (const o of ovP) { const k = String(o.fornecedor_id || ''); const x = m.get(k) || { fornecedor_id: k, nome: nomeF.get(k) || 'Fornecedor', total: 0, ocs: 0 }; x.total += gastoOv(o); x.ocs++; m.set(k, x); } return [...m.values()].map((x) => ({ ...x, total: r2(x.total), pct: gasto ? Math.round((x.total / gasto) * 1000) / 10 : 0 })).sort((a, b) => b.total - a.total); })();

  // histórico de preços por item (todas as compras — tendência precisa de passado)
  const porItem = new Map(); for (const l of L) { const x = porItem.get(l.chave) || { chave: l.chave, item: l.item, categoria: l.categoria, compras: [] }; x.compras.push({ data: l.data, unit: r2(l.unit), qtd: l.qtd, fornecedor: l.fornecedor, oc: l.ov.numero || l.ov.id }); porItem.set(l.chave, x); }
  const precos = [...porItem.values()].map((x) => {
    const c = x.compras.sort((a, b) => a.data.localeCompare(b.data)); const us = c.map((y) => y.unit).filter((v) => v > 0); const ult = c[c.length - 1];
    const ant = c.slice(0, -1).filter((y) => y.unit > 0 && Date.parse(ult.data) - Date.parse(y.data) <= 183 * 864e5); const medAnt = ant.length ? ant.reduce((s, y) => s + y.unit, 0) / ant.length : null;
    const var_pct = medAnt ? Math.round(((ult.unit - medAnt) / medAnt) * 1000) / 10 : null;
    return { chave: x.chave, item: x.item, categoria: x.categoria, compras: c.length, min: us.length ? Math.min(...us) : 0, max: us.length ? Math.max(...us) : 0, medio: us.length ? r2(us.reduce((s, v) => s + v, 0) / us.length) : 0, ultimo: ult.unit, ultima_data: ult.data, ultimo_fornecedor: ult.fornecedor, var_pct, historico: c.slice(-24) };
  }).sort((a, b) => (b.var_pct ?? -999) - (a.var_pct ?? -999) || b.compras - a.compras);

  // fornecedores: convites/respostas/vitórias no período (pela data da cotação)
  const cotP = new Set(D.cots.filter((c) => noP(d10(c.criado_em))).map((c) => String(c.id)));
  const respondeu = (cf) => cf.data_resposta || /respond|aprov|venc|ganh/i.test(String(cf.status || '')) || D.cfis.some((i) => String(i.cotacao_fornecedor_id) === String(cf.id) && Number(i.valor) > 0);
  const fm = new Map(); for (const cf of D.cfs.filter((c) => cotP.has(String(c.cotacao_id)))) { const k = String(cf.fornecedor_id || ''); const x = fm.get(k) || { fornecedor_id: k, nome: nomeF.get(k) || cf.fornecedor_nome || 'Fornecedor', convites: 0, respostas: 0 }; x.convites++; if (respondeu(cf)) x.respostas++; fm.set(k, x); }
  const ncsP = D.ncs.filter((n) => noP(d10(n.criado_em || n.data_abertura)));
  const fornecedores = [...new Set([...fm.keys(), ...porFornGasto.map((f) => f.fornecedor_id)])].map((k) => { const a = fm.get(k) || { fornecedor_id: k, nome: nomeF.get(k) || 'Fornecedor', convites: 0, respostas: 0 }; const g = porFornGasto.find((f) => f.fornecedor_id === k); return { ...a, taxa_resposta: a.convites ? Math.round((a.respostas / a.convites) * 100) : null, vitorias: g?.ocs || 0, gasto: g?.total || 0, ncs: ncsP.filter((n) => String(n.fornecedor_id) === k).length }; }).sort((a, b) => b.gasto - a.gasto || b.convites - a.convites);

  // concorrência por OC (2+ propostas com valor na cotação)
  const propsCot = new Map(); for (const cf of D.cfs) { if (!D.cfis.some((i) => String(i.cotacao_fornecedor_id) === String(cf.id) && Number(i.valor) > 0)) continue; propsCot.set(String(cf.cotacao_id), (propsCot.get(String(cf.cotacao_id)) || 0) + 1); }
  const semConc = ovP.filter((o) => (propsCot.get(String(o.cotacao_id)) || 0) < 2);
  const urg = LP.filter((l) => l.urgente);
  const oportunidades = [];
  for (const p of precos.filter((x) => x.var_pct != null && x.var_pct >= 10 && x.ultima_data >= P.de).slice(0, 8)) oportunidades.push({ tipo: 'preco_subindo', sev: p.var_pct >= 25 ? 'alta' : 'media', titulo: `${p.item}: +${String(p.var_pct).replace('.', ',')}% no último preço`, detalhe: `último R$ ${p.ultimo.toFixed(2)} (${p.ultimo_fornecedor}) × média dos 6 meses anteriores — renegociar ou cotar com mais fornecedores.`, chave: p.chave });
  if (semConc.length) oportunidades.push({ tipo: 'sem_concorrencia', sev: semConc.length / Math.max(ovP.length, 1) > 0.3 ? 'alta' : 'media', titulo: `${semConc.length} de ${ovP.length} OC(s) sem concorrência`, detalhe: `R$ ${r2(semConc.reduce((s, o) => s + gastoOv(o), 0)).toFixed(2)} comprados com menos de 2 propostas — sem comparação não há como medir preço justo.`, valor: r2(semConc.reduce((s, o) => s + gastoOv(o), 0)) });
  if (urg.length) oportunidades.push({ tipo: 'emergencia', sev: urg.length >= 3 ? 'alta' : 'media', titulo: `${urg.length} compra(s) de urgência`, detalhe: `R$ ${r2(urg.reduce((s, l) => s + l.total, 0)).toFixed(2)} — compra urgente costuma sair mais cara; ver plano de manutenção preventiva e estoque mínimo.`, valor: r2(urg.reduce((s, l) => s + l.total, 0)) });
  const top = porFornGasto[0]; if (top && top.pct >= 40 && ovP.length >= 3) oportunidades.push({ tipo: 'concentracao', sev: top.pct >= 60 ? 'alta' : 'media', titulo: `${top.nome} concentra ${String(top.pct).replace('.', ',')}% do gasto`, detalhe: 'Dependência alta de um fornecedor — risco de preço e de abastecimento. Desenvolver alternativas.' });
  for (const f of fornecedores.filter((x) => x.convites >= 3 && x.taxa_resposta != null && x.taxa_resposta < 50).slice(0, 5)) oportunidades.push({ tipo: 'nao_responde', sev: 'baixa', titulo: `${f.nome} respondeu ${f.respostas} de ${f.convites} cotações`, detalhe: 'Revisar o cadastro (contato, linha de produtos) ou substituir nas próximas cotações.' });
  const ordem = { alta: 0, media: 1, baixa: 2 }; oportunidades.sort((a, b) => ordem[a.sev] - ordem[b.sev]);

  return {
    periodo: P,
    resumo: { gasto: r2(gasto), ocs: ovP.length, fornecedores: porFornGasto.length, ticket_medio: ovP.length ? r2(gasto / ovP.length) : 0, itens: LP.length,
      saving_negociacao: r2(savingNeg), saving_mercado: r2(savingMerc), saving_pct: gasto ? Math.round(((savingNeg + savingMerc) / (gasto + savingNeg)) * 1000) / 10 : 0,
      com_concorrencia_pct: ovP.length ? Math.round(((ovP.length - semConc.length) / ovP.length) * 100) : null, urgentes: urg.length },
    por_mes: porMes, por_categoria: somaPor(LP, 'categoria'), por_fornecedor: porFornGasto.slice(0, 20), top_itens: somaPor(LP, 'item').slice(0, 15),
    saving: { negociacao: neg.filter((x) => x.e > 0).map((x) => ({ oc: x.o.numero || x.o.id, em: d10(x.o.criado_em), fornecedor: nomeF.get(String(x.o.fornecedor_id)) || 'Fornecedor', original: r2(Number(x.o.valor_original) + (Number(x.o.frete_original) || 0)), final: r2(gastoOv(x.o)), economia: r2(x.e) })).sort((a, b) => b.economia - a.economia).slice(0, 30),
      mercado: merc.slice(0, 30) },
    oportunidades, precos: precos.slice(0, 200), fornecedores: fornecedores.slice(0, 50),
  };
}

module.exports = { painel, periodo, linhas };
