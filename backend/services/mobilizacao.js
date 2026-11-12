// backend/services/mobilizacao.js — etapa 18y: 🚛 contrato de locação → mobilização / desmobilização → AT · 📈 faturamento previsto
//
// • Mobilização = levar as máquinas do contrato até o cliente; desmobilização = trazer de volta. Cada uma vira um TRECHO do
//   pedido de venda de transporte do contrato (um pedido por contrato, origem 'contrato'). A AT é programada pelo fluxo de
//   sempre em 🚛 Programação (motorista, conjunto, documentos, fluxo da viagem) — nada novo para aprender.
// • Faturamento previsto: por mês, a soma do valor mensal de cada equipamento locado, proporcional aos dias dentro do
//   período (início → devolução / término previsto do contrato). Contratos em aberto sem término contam até o fim da janela.
const DIA = 864e5;
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const sem079 = (e) => /contrato_id|origem|base_saida|valor_mobilizacao|does not exist|schema cache/i.test(String(e?.message || e));
const hojeBR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const txt = (v, n = 300) => String(v ?? '').trim().slice(0, n);
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
const TIPOS = { mobilizacao: { titulo: 'Mobilização', emoji: '🚛➡️' }, desmobilizacao: { titulo: 'Desmobilização', emoji: '⬅️🚛' } };
const COLUNAS = [{ chave: 'veiculo', rotulo: 'Equipamento', tipo: 'texto' }, { chave: 'modelo', rotulo: 'Tag / placa', tipo: 'texto' }, { chave: 'data_prevista', rotulo: 'Data prevista', tipo: 'data' }];

async function contratoDo(supabase, tenantId, id) { return /^\d+$/.test(String(id)) ? (await q(supabase.from('locacao_contratos').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] || null : null; }

/** pedidos de transporte do contrato, com os trechos e as ATs */
async function doContrato(supabase, tenantId, id) {
  const c = await contratoDo(supabase, tenantId, id); if (!c) return { status: 404, erro: 'Contrato não encontrado' };
  let pvs; try { pvs = await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId).eq('contrato_id', c.id)); } catch (e) { if (sem079(e)) return { sem_migration: true, movimentos: [] }; throw e; }
  const ats = pvs.length ? (await q(supabase.from('execucoes').select('*').eq('tenant_id', tenantId))).filter((e) => pvs.some((p) => String(p.id) === String(e.pv_id)) && e.status !== 'cancelada' && e.status !== 'rascunho') : [];
  const movimentos = pvs.flatMap((p) => (p.grupos || []).map((g) => ({ pv_id: p.id, pv_numero: p.numero, pv_status: p.status, grupo_id: g.id, tipo: g.mov_tipo || 'mobilizacao', titulo: g.titulo, origem: g.coleta, destino: g.entrega, data: g.data_prevista || null,
    itens: (g.itens || []).length, cancelados: (g.itens || []).filter((i) => i.status === 'cancelado').length,
    ats: ats.filter((e) => String(e.pv_id) === String(p.id) && String(e.grupo_id) === String(g.id)).map((e) => ({ id: e.id, numero: e.numero, status: e.status, inicio_previsto: e.inicio_previsto, motorista_nome: e.motorista_nome })) })));
  return { movimentos: movimentos.sort((a, b) => String(a.data || '').localeCompare(String(b.data || ''))), base_saida: c.base_saida || null, local: c.local || null };
}

/** cria o trecho de mobilização/desmobilização no pedido do contrato (cria o pedido se não houver) */
async function mobilizar(supabase, tenantId, quem = {}, id, body = {}) {
  const c = await contratoDo(supabase, tenantId, id); if (!c) return { status: 404, erro: 'Contrato não encontrado' };
  if (c.status !== 'ativo') return { status: 409, erro: 'Contrato encerrado' };
  const tipo = TIPOS[body.tipo] ? body.tipo : 'mobilizacao'; const T = TIPOS[tipo];
  const locs = (await q(supabase.from('equipamento_locacoes').select('*').eq('tenant_id', tenantId))).filter((l) => String(l.contrato_id) === String(c.id) && l.status === 'ativa');
  const escolhidos = Array.isArray(body.equipamentos) && body.equipamentos.length ? locs.filter((l) => body.equipamentos.map(String).includes(String(l.equipamento_id))) : locs;
  if (!escolhidos.length) return { status: 400, erro: 'O contrato não tem equipamentos ativos para movimentar' };
  const eqs = new Map((await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId))).map((e) => [String(e.id), e]));
  const base = txt(body.base_saida) || c.base_saida || '';
  const origem = txt(body.origem) || (tipo === 'mobilizacao' ? base : c.local || '');
  const destino = txt(body.destino) || (tipo === 'mobilizacao' ? c.local || '' : base);
  if (!origem || !destino) return { status: 400, erro: tipo === 'mobilizacao' ? 'Informe de onde sai (pátio/base) e o local da obra' : 'Informe o local da obra e para onde volta' };
  const data = /^\d{4}-\d{2}-\d{2}$/.test(String(body.data || '')) ? body.data : null;
  const valor = num(body.valor) ?? num(tipo === 'mobilizacao' ? c.valor_mobilizacao : c.valor_desmobilizacao);
  let pv;
  try { pv = (await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId).eq('contrato_id', c.id))).find((p) => !['cancelado', 'concluido'].includes(p.status)); }
  catch (e) { if (sem079(e)) return { status: 409, erro: 'Falta rodar a migration 079 no Supabase.' }; throw e; }
  const gid = `mov-${Date.now().toString(36)}`;
  const itens = escolhidos.map((l, k) => { const e = eqs.get(String(l.equipamento_id)) || {}; return { id: `${gid}-${k + 1}`, valores: { veiculo: e.nome || e.tag || 'Equipamento', modelo: [e.tag, e.placa].filter(Boolean).join(' · '), data_prevista: data }, quantidade: 1, valor: null, status: 'a_programar', equipamento_id: l.equipamento_id }; });
  const grupo = { id: gid, titulo: `${T.emoji} ${T.titulo} — ${c.numero}`, coleta: origem, entrega: destino, data_prevista: data, valor, mov_tipo: tipo, itens }; // 18g.6: g.valor (o subtotal sai da conta do pedido)
  const agora = new Date().toISOString();
  if (base && base !== c.base_saida) await supabase.from('locacao_contratos').update({ base_saida: base }).eq('id', c.id);
  const numerar = (gs) => require('./bids').numerarItens(gs).grupos;
  const totalDe = (gs) => gs.reduce((s, g) => s + (Number(g.valor ?? g.subtotal) || 0), 0) || null;
  if (pv) {
    const grupos = numerar([...(pv.grupos || []), grupo]);
    const r = await supabase.from('pedidos_venda').update({ grupos, valor_total: totalDe(grupos), status: pv.status === 'concluido' ? 'aberto' : pv.status, atualizado_em: agora }).eq('id', pv.id).select(); if (r.error) throw new Error(r.error.message); pv = r.data[0];
  } else {
    const PVS = require('./pedidosVenda');
    const numero = await (PVS._proximoNumero || (async () => `PV-${hojeBR().slice(0, 4)}-${String(Date.now()).slice(-4)}`))(supabase, tenantId);
    const grupos = numerar([grupo]);
    const reg = { tenant_id: tenantId, numero, tipo_execucao: 'transporte', origem: 'contrato', contrato_id: c.id, bid_id: null, cliente_id: c.cliente_id ?? null, cliente_nome: c.cliente,
      contato_nome: c.contato_nome || null, contato_email: c.contato_email || null, titulo: `Movimentação do contrato ${c.numero}`, referencia: c.numero,
      conteudo: { colunas: COLUNAS }, grupos, condicoes: {}, valor_total: totalDe(grupos), aditivo_atual: 0, status: 'aberto', aceite_nome: null, aceite_em: c.aceite_em || agora, criado_em: agora, atualizado_em: agora };
    const r = await supabase.from('pedidos_venda').insert([reg]).select(); if (r.error) { if (sem079(r.error)) return { status: 409, erro: 'Falta rodar a migration 079 no Supabase.' }; throw new Error(r.error.message); } pv = r.data[0];
  }
  return { ok: true, pv: { id: pv.id, numero: pv.numero }, grupo_id: gid, mensagem: `${T.titulo} criada no pedido ${pv.numero} — programe a AT em 🚛 Programação.` };
}

/** 📈 faturamento previsto — próximos N meses (inclui o atual), por contrato e no total */
async function faturamentoPrevisto(supabase, tenantId, { meses = 6, hoje = hojeBR() } = {}) {
  const n = Math.min(Math.max(Number(meses) || 6, 1), 24);
  const ini0 = `${hoje.slice(0, 7)}-01`; const lista = [];
  for (let i = 0; i < n; i++) { const d = new Date(`${ini0}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + i); const a = d.toISOString().slice(0, 7); const fimMes = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10); lista.push({ mes: a, ini: `${a}-01`, fim: fimMes }); }
  const cs = (await q(supabase.from('locacao_contratos').select('*').eq('tenant_id', tenantId))).filter((c) => c.status === 'ativo');
  const locs = await q(supabase.from('equipamento_locacoes').select('*').eq('tenant_id', tenantId));
  const dias = (a, b) => Math.max(0, Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DIA) + 1);
  const totais = lista.map(() => 0); const porContrato = []; let semValor = 0;
  for (const c of cs) {
    const ls = locs.filter((l) => String(l.contrato_id) === String(c.id) && (l.status === 'ativa' || l.fim_real));
    const valores = lista.map((m) => {
      let soma = 0;
      for (const l of ls) {
        if (l.valor_mensal == null) continue;
        const ini = [l.inicio, c.inicio].filter(Boolean).sort().pop() || m.ini; const fim = l.fim_real || l.fim_previsto || c.fim_previsto || m.fim;
        const a = ini > m.ini ? ini : m.ini; const b = fim < m.fim ? fim : m.fim; if (a > b) continue;
        soma += Number(l.valor_mensal) * (dias(a, b) / dias(m.ini, m.fim));
      }
      return Math.round(soma * 100) / 100;
    });
    const sv = ls.filter((l) => l.status === 'ativa' && l.valor_mensal == null).length; semValor += sv;
    if (valores.some((v) => v > 0) || sv) porContrato.push({ id: c.id, numero: c.numero, cliente: c.cliente, valores, sem_valor: sv, fim_previsto: c.fim_previsto || null });
    valores.forEach((v, i) => { totais[i] = Math.round((totais[i] + v) * 100) / 100; });
  }
  return { meses: lista.map((m) => m.mes), totais, contratos: porContrato.sort((a, b) => (b.valores[0] || 0) - (a.valores[0] || 0)), equipamentos_sem_valor: semValor };
}

module.exports = { TIPOS, doContrato, mobilizar, faturamentoPrevisto };
