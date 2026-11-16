// services/valorGerado.js — etapa 5a: 💰 VALOR GERADO pelo QuotaFlow (só ganhos MEDIDOS — conservador e com origem)
//   Regra de ouro (Marcony, 16/11): sem "forçar a barra". O número de destaque só soma o que sai direto dos dados:
//   • 🛒 Compras: por item comprado (OC), (mediana das OUTRAS propostas do mesmo item − preço pago) × quantidade — só com 2+ propostas.
//   • ⚡ Spot: (mediana das outras propostas − proposta do vencedor) — só com 2+ propostas com valor.
//   • 🚦 Multas: valor de face − valor pago (desconto por pagar no prazo / SNE).
//   Receita fechada pelo comercial (BIDs aceitos) e atividade (cotações, inspeções, ATs…) aparecem SEPARADAS — não entram no R$ de economia.
//   ROI: economia ÷ assinatura do período (valor mensal do plano do tenant).
//   Travas: preço ≤ 0 ignorado; mediana > 3× o preço pago = dado suspeito → ignorado (não conta).

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const seguro = async (p) => { try { return await q(p); } catch { return []; } };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const mediana = (l) => { const v = l.filter((x) => x > 0).sort((a, b) => a - b); if (!v.length) return null; const m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const ym = (d) => String(d || '').slice(0, 7);
const noPeriodo = (d, de, ate) => { const x = String(d || '').slice(0, 10); return !!x && x >= de && x <= ate; };
const SUSPEITO = 3;

async function compras(supabase, tenantId, de, ate) {
  const ovs = (await seguro(supabase.from('ordens_venda').select('*').eq('tenant_id', tenantId))).filter((o) => !/cancel/i.test(String(o.status || '')) && noPeriodo(o.criado_em, de, ate));
  if (!ovs.length) return { total: 0, ganhos: [], compras: 0, com_concorrencia: 0 };
  const ovIds = new Set(ovs.map((o) => String(o.id)));
  const itens = (await seguro(supabase.from('ordem_venda_itens').select('*').eq('tenant_id', tenantId))).filter((i) => ovIds.has(String(i.ordem_venda_id)) && i.cotacao_item_id != null);
  const cotIds = [...new Set(ovs.map((o) => o.cotacao_id).filter((x) => x != null).map(String))];
  const cfs = (await seguro(supabase.from('cotacao_fornecedores').select('*').eq('tenant_id', tenantId))).filter((c) => cotIds.includes(String(c.cotacao_id)));
  const fornDoCf = new Map(cfs.map((c) => [String(c.id), String(c.fornecedor_id)]));
  const cfIds = new Set(cfs.map((c) => String(c.id)));
  const respostas = (await seguro(supabase.from('cotacao_fornecedor_itens').select('*').eq('tenant_id', tenantId))).filter((r) => cfIds.has(String(r.cotacao_fornecedor_id)));
  const ovPorId = new Map(ovs.map((o) => [String(o.id), o]));
  const ganhos = []; let comConc = 0;
  for (const it of itens) {
    const ov = ovPorId.get(String(it.ordem_venda_id)); const pago = Number(it.valor_unitario); const qtd = Number(it.quantidade) || 1;
    if (!(pago > 0)) continue;
    const outras = respostas.filter((r) => String(r.cotacao_item_id) === String(it.cotacao_item_id) && fornDoCf.get(String(r.cotacao_fornecedor_id)) !== String(ov.fornecedor_id)).map((r) => Number(r.valor));
    const med = mediana(outras); if (med == null) continue;
    comConc++;
    if (med <= pago || med > pago * SUSPEITO) continue;
    const v = r2((med - pago) * qtd);
    if (v > 0) ganhos.push({ area: 'compras', valor: v, em: String(ov.criado_em).slice(0, 10), titulo: `${it.nome_item || 'Item'} — OC ${ov.numero || ov.id}`, detalhe: `pago R$ ${r2(pago)} × ${qtd} · mediana das outras ${outras.filter((x) => x > 0).length} proposta(s) R$ ${r2(med)}`, link: { tela: 'ordensvenda', id: ov.id } });
  }
  return { total: r2(ganhos.reduce((s, g) => s + g.valor, 0)), ganhos, compras: itens.length, com_concorrencia: comConc };
}

async function spot(supabase, tenantId, de, ate) {
  const ds = (await seguro(supabase.from('demandas_spot').select('*').eq('tenant_id', tenantId))).filter((d) => d.status === 'encerrada' && d.fornecedor_vencedor_id != null && noPeriodo(d.encerrada_em, de, ate));
  if (!ds.length) return { total: 0, ganhos: [], encerradas: 0 };
  const ints = await seguro(supabase.from('interesses_spot').select('*').in('demanda_id', ds.map((d) => d.id)));
  const ganhos = [];
  for (const d of ds) {
    const l = ints.filter((i) => String(i.demanda_id) === String(d.id) && Number(i.valor_estimado) > 0);
    const venc = l.find((i) => String(i.fornecedor_id) === String(d.fornecedor_vencedor_id)); if (!venc) continue;
    const pago = Number(venc.valor_estimado); const med = mediana(l.filter((i) => i !== venc).map((i) => Number(i.valor_estimado)));
    if (med == null || med <= pago || med > pago * SUSPEITO) continue;
    ganhos.push({ area: 'spot', valor: r2(med - pago), em: String(d.encerrada_em).slice(0, 10), titulo: `Spot ${d.numero || `DSP-${String(d.id).padStart(4, '0')}`}${d.titulo ? ` — ${d.titulo}` : ''}`, detalhe: `escolhida R$ ${r2(pago)} · mediana das outras ${l.length - 1} proposta(s) R$ ${r2(med)}`, link: { tela: 'spot', id: d.id } });
  }
  return { total: r2(ganhos.reduce((s, g) => s + g.valor, 0)), ganhos, encerradas: ds.length };
}

async function multas(supabase, tenantId, de, ate) {
  const ms = (await seguro(supabase.from('multas').select('*').eq('tenant_id', tenantId))).filter((m) => m.status === 'paga' && noPeriodo(m.finalizada_em || m.atualizado_em, de, ate));
  const ganhos = ms.filter((m) => Number(m.valor) > 0 && Number(m.valor_pago) > 0 && Number(m.valor_pago) < Number(m.valor))
    .map((m) => ({ area: 'multas', valor: r2(Number(m.valor) - Number(m.valor_pago)), em: String(m.finalizada_em || '').slice(0, 10), titulo: `Multa ${m.auto_numero || m.id} paga com desconto`, detalhe: `valor R$ ${r2(m.valor)} · pago R$ ${r2(m.valor_pago)}`, link: { tela: 'pessoas', aba: 'multas', id: m.id } }));
  return { total: r2(ganhos.reduce((s, g) => s + g.valor, 0)), ganhos, pagas: ms.length };
}

async function receita(supabase, tenantId, de, ate) {
  const bs = (await seguro(supabase.from('bids').select('*').eq('tenant_id', tenantId))).filter((b) => b.fase === 'aceito' && noPeriodo(b.ganho_em, de, ate));
  return { bids: bs.length, valor: r2(bs.reduce((s, b) => s + (Number(b.valor_total) || 0), 0)) };
}

async function atividade(supabase, tenantId, de, ate) {
  const conta = async (tab, campo, filtro = () => true) => (await seguro(supabase.from(tab).select('*').eq('tenant_id', tenantId))).filter((x) => filtro(x) && noPeriodo(x[campo], de, ate)).length;
  const [cotacoes, ocs, inspecoes, ats, medicoes] = await Promise.all([
    conta('cotacoes', 'criado_em'), conta('ordens_venda', 'criado_em', (o) => !/cancel/i.test(String(o.status || ''))),
    conta('inspecoes', 'concluida_em'), conta('execucoes', 'criado_em', (x) => !/cancel/i.test(String(x.status || ''))), conta('locacao_medicoes', 'enviado_em')]);
  return { cotacoes, ocs, inspecoes, ats, medicoes };
}

async function assinaturaMensal(supabase, tenantId) {
  try {
    const a = (await q(supabase.from('tenant_assinaturas').select('*').eq('tenant_id', tenantId)))[0];
    if (!a || a.valor == null) return null;
    const liq = Number(a.valor) * (1 - (Number(a.desconto_pct) || 0) / 100);
    return r2(a.modalidade === 'anual_prepago' || (!a.modalidade && a.ciclo === 'anual') ? liq / 12 : liq);
  } catch { return null; }
}

/** ano = 'AAAA' (padrão: ano atual). Devolve tudo pronto para o painel. */
async function calcular(supabase, tenantId, { ano = null } = {}) {
  const hoje = new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
  const A = String(ano || hoje.slice(0, 4)); const de = `${A}-01-01`; const ate = A === hoje.slice(0, 4) ? hoje : `${A}-12-31`;
  const [c, s, m, rec, at, mensal] = await Promise.all([compras(supabase, tenantId, de, ate), spot(supabase, tenantId, de, ate), multas(supabase, tenantId, de, ate), receita(supabase, tenantId, de, ate), atividade(supabase, tenantId, de, ate), assinaturaMensal(supabase, tenantId)]);
  const ganhos = [...c.ganhos, ...s.ganhos, ...m.ganhos];
  const total = r2(c.total + s.total + m.total);
  const meses = Number(ate.slice(5, 7));
  const porMes = Array.from({ length: meses }, (_, i) => { const k = `${A}-${String(i + 1).padStart(2, '0')}`; return { mes: k, valor: r2(ganhos.filter((g) => ym(g.em) === k).reduce((x, g) => x + g.valor, 0)) }; });
  const custo = mensal != null ? r2(mensal * meses) : null;
  return {
    ano: A, de, ate, total,
    areas: { compras: { total: c.total, n: c.ganhos.length, itens_comprados: c.compras, com_concorrencia: c.com_concorrencia }, spot: { total: s.total, n: s.ganhos.length, encerradas: s.encerradas }, multas: { total: m.total, n: m.ganhos.length, pagas: m.pagas } },
    receita: rec, atividade: at, por_mes: porMes,
    roi: custo ? { assinatura_mensal: mensal, custo_periodo: custo, vezes: r2(total / custo) } : null,
    maiores: ganhos.sort((x, y) => y.valor - x.valor).slice(0, 12),
  };
}

module.exports = { calcular, _mediana: mediana };
