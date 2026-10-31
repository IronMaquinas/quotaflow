// backend/services/calendarioComercial.js — etapa 18a
//
// 📅 CALENDÁRIO COMERCIAL + 🎪 EVENTOS DE MERCADO (desenho do Marcony, 28/10/2026 — claude/desenho-calendario-comercial.md):
//   • o calendário junta: BIDs abertos pela DECISÃO ESPERADA (previsao_fechamento) e pela VALIDADE (envio + validade);
//     TRANSPORTES com data prevista (itens dos BIDs abertos = negociando; dos pedidos abertos = vendidos); ⏰ TAREFAS do comercial;
//     🎪 EVENTOS de mercado (feira, safra, obra, licitação…) e o dia de começar a PROSPECÇÃO (início − antecedência).
//   • evento que "repete todo ano" aparece em todos os anos (mesmo dia/mês).
//   • LEMBRETE: chegando o dia da prospecção, entra uma ⏰ tarefa no Comercial ("Faltam N dias para a Feira X — hora de procurar
//     os clientes A, B…"), para o responsável do evento — uma por evento por ano (lembretes: { ano: id }). Gerada quando o Comercial
//     abre (funil, tarefas, calendário) — não depende de rotina agendada.
// Regras do backend: sem DB.raw; ids com String(); o mock não aplica default do banco.

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const texto = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const hojeBR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const somaDias = (d, n) => new Date(new Date(`${d}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
const diasEntre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
const diaBR = (iso) => (iso ? new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10) : null);
const dBR = (d) => String(d || '').slice(0, 10).split('-').reverse().join('/');

const TIPOS = { feira: '🎪 Feira', safra: '🌾 Safra', obra: '🏗 Obra', licitacao: '📜 Licitação', outro: '📌 Outro' };

// ─── eventos ────────────────────────────────────────────────────────────────
function validar(body = {}, parcial = false) {
  const out = {}; const tem = (k) => body[k] !== undefined;
  if (!parcial || tem('nome')) { out.nome = texto(body.nome, 160); if (!out.nome) return { erro: 'Dê um nome ao evento (ex.: Feira de Máquinas — BH)' }; }
  if (tem('tipo')) { if (!TIPOS[body.tipo]) return { erro: 'Tipo inválido' }; out.tipo = body.tipo; } else if (!parcial) out.tipo = 'feira';
  if (!parcial || tem('inicio')) { if (!DATA.test(String(body.inicio || ''))) return { erro: 'Informe a data de início' }; out.inicio = body.inicio; }
  if (tem('fim')) { const f = body.fim || null; if (f && !DATA.test(f)) return { erro: 'Data de fim inválida' }; out.fim = f; }
  if (out.fim && out.inicio && out.fim < out.inicio) return { erro: 'O fim precisa ser depois do início' };
  for (const [k, n] of [['cidade', 80], ['uf', 2], ['observacoes', 2000]]) if (tem(k)) out[k] = k === 'uf' ? (texto(body[k], 2) || '').toUpperCase() || null : texto(body[k], n);
  if (tem('repete_anual')) out.repete_anual = !!body.repete_anual; else if (!parcial) out.repete_anual = true;
  if (tem('antecedencia_dias')) { const n = Number(body.antecedencia_dias); if (!Number.isInteger(n) || n < 0 || n > 365) return { erro: 'Antecedência: de 0 a 365 dias' }; out.antecedencia_dias = n; } else if (!parcial) out.antecedencia_dias = 60;
  if (tem('clientes')) out.clientes = (Array.isArray(body.clientes) ? body.clientes : []).map(String).slice(0, 100);
  else if (!parcial) out.clientes = [];
  return { dados: out };
}
async function listarEventos(supabase, tenantId) {
  const [ev, cls] = await Promise.all([q(supabase.from('comercial_eventos').select('*').eq('tenant_id', tenantId)), q(supabase.from('clientes').select('*').eq('tenant_id', tenantId)).catch(() => [])]);
  const nome = new Map(cls.map((c) => [String(c.id), c.nome]));
  return ev.filter((e) => e.ativo !== false).map((e) => {
    const o = proximaOcorrencia(e);
    return { ...e, tipo_nome: TIPOS[e.tipo] || e.tipo, clientes_nomes: (e.clientes || []).map((id) => nome.get(String(id))).filter(Boolean),
      proxima: o, faltam: o ? diasEntre(hojeBR(), o.inicio) : null, prospeccao: o ? somaDias(o.inicio, -Number(e.antecedencia_dias ?? 60)) : null };
  }).sort((a, b) => String(a.proxima?.inicio || '9').localeCompare(String(b.proxima?.inicio || '9')));
}
async function responsavelOk(supabase, tenantId, id) {
  if (id == null || id === '') return { id: null, nome: null };
  const u = (await require('./bids').responsaveis(supabase, tenantId)).find((x) => String(x.id) === String(id));
  return u ? { id: u.id, nome: u.nome } : { erro: 'Responsável: escolha um usuário comercial, gestor ou admin' };
}
async function criarEvento(supabase, tenantId, quem, body = {}) {
  const v = validar(body); if (v.erro) return { status: 400, erro: v.erro };
  const r = await responsavelOk(supabase, tenantId, body.responsavel_id ?? quem.usuarioId); if (r.erro) return { status: 400, erro: r.erro };
  const agora = new Date().toISOString();
  const { data, error } = await supabase.from('comercial_eventos').insert([{ tenant_id: tenantId, cidade: null, uf: null, fim: null, observacoes: null, ...v.dados,
    responsavel_id: r.id, responsavel_nome: r.nome, lembretes: {}, ativo: true, criado_em: agora, atualizado_em: agora }]).select();
  if (error) throw new Error(error.message);
  return { evento: data[0] };
}
async function eventoDoTenant(supabase, tenantId, id) { return /^\d+$/.test(String(id)) ? (await q(supabase.from('comercial_eventos').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] || null : null; }
async function editarEvento(supabase, tenantId, quem, id, body = {}) {
  const e = await eventoDoTenant(supabase, tenantId, id); if (!e) return { status: 404, erro: 'Evento não encontrado' };
  const v = validar({ inicio: e.inicio, ...body }, true); if (v.erro) return { status: 400, erro: v.erro };
  const upd = { ...v.dados, atualizado_em: new Date().toISOString() };
  if (body.responsavel_id !== undefined) { const r = await responsavelOk(supabase, tenantId, body.responsavel_id); if (r.erro) return { status: 400, erro: r.erro }; upd.responsavel_id = r.id; upd.responsavel_nome = r.nome; }
  // mudou a data ou a antecedência: o lembrete deste ano pode sair de novo
  if ((upd.inicio && upd.inicio !== e.inicio) || (upd.antecedencia_dias != null && upd.antecedencia_dias !== e.antecedencia_dias)) upd.lembretes = {};
  const { data, error } = await supabase.from('comercial_eventos').update(upd).eq('id', e.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return { evento: data[0] };
}
async function removerEvento(supabase, tenantId, id) {
  const e = await eventoDoTenant(supabase, tenantId, id); if (!e) return { status: 404, erro: 'Evento não encontrado' };
  const { error } = await supabase.from('comercial_eventos').update({ ativo: false, atualizado_em: new Date().toISOString() }).eq('id', e.id).eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** ocorrências do evento que tocam [de, ate] — se repete, uma por ano (29/02 vira 28/02) */
function ocorrencias(e, de, ate) {
  const dur = e.fim ? diasEntre(e.inicio, e.fim) : 0;
  if (!e.repete_anual) return (e.fim || e.inicio) >= de && e.inicio <= ate ? [{ inicio: e.inicio, fim: e.fim || e.inicio, ano: Number(e.inicio.slice(0, 4)) }] : [];
  const out = []; const a0 = Math.max(Number(e.inicio.slice(0, 4)), Number(de.slice(0, 4)) - 1); const a1 = Number(ate.slice(0, 4)) + 1;
  for (let a = a0; a <= a1; a++) {
    let md = e.inicio.slice(5); if (md === '02-29' && !(a % 4 === 0 && (a % 100 !== 0 || a % 400 === 0))) md = '02-28';
    const ini = `${a}-${md}`; const fim = somaDias(ini, dur);
    if (fim >= de && ini <= ate) out.push({ inicio: ini, fim, ano: a });
  }
  return out;
}
function proximaOcorrencia(e) { const h = hojeBR(); return ocorrencias(e, h, somaDias(h, 800)).find((o) => o.fim >= h) || null; }

/** ⏰ lembrete: no dia da prospecção (até o fim do evento), uma tarefa por evento por ano */
async function gerarLembretes(supabase, tenantId) {
  let ev; try { ev = (await q(supabase.from('comercial_eventos').select('*').eq('tenant_id', tenantId))).filter((e) => e.ativo !== false); } catch { return 0; } // sem a 059
  const h = hojeBR(); let n = 0; let cls = null;
  for (const e of ev) {
    const o = proximaOcorrencia(e); if (!o) continue;
    const prosp = somaDias(o.inicio, -Number(e.antecedencia_dias ?? 60));
    if (h < prosp || (e.lembretes || {})[String(o.ano)]) continue;
    if (!cls) cls = await q(supabase.from('clientes').select('*').eq('tenant_id', tenantId)).catch(() => []);
    const nomes = (e.clientes || []).map((id) => cls.find((c) => String(c.id) === String(id))?.nome).filter(Boolean);
    const faltam = diasEntre(h, o.inicio);
    const txt = `🎪 ${faltam > 0 ? `Faltam ${faltam} dia(s) para` : 'Começa hoje:'} ${e.nome}${e.cidade ? ` (${e.cidade}${e.uf ? `/${e.uf}` : ''})` : ''}, ${dBR(o.inicio)}${o.fim !== o.inicio ? ` a ${dBR(o.fim)}` : ''} — hora de procurar os clientes${nomes.length ? `: ${nomes.slice(0, 8).join(', ')}${nomes.length > 8 ? '…' : ''}` : ''}.`;
    const reg = { tenant_id: tenantId, bid_id: null, cliente_id: null, tipo: 'tarefa', texto: txt.slice(0, 2000), prevista_para: new Date(`${h}T09:00:00-03:00`).toISOString(), concluida_em: null,
      usuario_id: null, usuario_nome: 'QuotaFlow · 📅 calendário comercial', criado_em: new Date().toISOString() };
    if (e.responsavel_id != null) Object.assign(reg, { atribuido_id: e.responsavel_id, atribuido_nome: e.responsavel_nome || null });
    const { data, error } = await supabase.from('bid_atividades').insert([reg]).select();
    if (error) { console.error('⚠️ [calendário comercial] lembrete:', error.message); continue; }
    await supabase.from('comercial_eventos').update({ lembretes: { ...(e.lembretes || {}), [String(o.ano)]: data[0].id } }).eq('id', e.id).eq('tenant_id', tenantId);
    n++;
  }
  return n;
}

// ─── calendário ─────────────────────────────────────────────────────────────
/** itens entre de e ate: { data, ate, tipo, titulo, sub, fase?, ref } */
async function calendario(supabase, tenantId, { de, ate } = {}) {
  const B = require('./bids');
  const d0 = DATA.test(String(de || '')) ? de : `${hojeBR().slice(0, 7)}-01`;
  const d1 = DATA.test(String(ate || '')) ? ate : somaDias(d0, 41);
  await gerarLembretes(supabase, tenantId);
  const [bids, pvs, ativs, evs] = await Promise.all([
    q(supabase.from('bids').select('*').eq('tenant_id', tenantId)),
    q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId)).catch(() => []),
    q(supabase.from('bid_atividades').select('*').eq('tenant_id', tenantId).eq('tipo', 'tarefa')),
    q(supabase.from('comercial_eventos').select('*').eq('tenant_id', tenantId)).catch(() => []),
  ]);
  const dentro = (d) => d && d >= d0 && d <= d1;
  const itens = [];
  for (const b of bids.filter((x) => B.ABERTAS.includes(x.fase) && x.tipo !== 'aditivo')) {
    const nome = `${b.numero}${b.cliente_nome ? ` · ${b.cliente_nome}` : ''}`;
    if (dentro(b.previsao_fechamento)) itens.push({ data: b.previsao_fechamento, tipo: 'decisao', titulo: `🎯 Decisão: ${nome}`, sub: b.titulo || null, fase: b.fase, ref: { bid_id: b.id } });
    if (b.enviado_em && ['aguardando_cliente', 'aguardando_aceite', 'revisao_solicitada'].includes(b.fase)) {
      const val = somaDias(diaBR(b.enviado_em), Number(b.validade_dias || 0));
      if (Number(b.validade_dias) > 0 && dentro(val)) itens.push({ data: val, tipo: 'validade', titulo: `⌛ Vence a proposta: ${nome}`, sub: b.titulo || null, fase: b.fase, ref: { bid_id: b.id } });
    }
    for (const g of b.grupos || []) for (const i of g.itens || []) if (dentro(i.valores?.data_prevista))
      itens.push({ data: i.valores.data_prevista, tipo: 'transporte_bid', titulo: `🚚 ${g.titulo || 'Trecho'} (negociando)`, sub: nome, fase: b.fase, ref: { bid_id: b.id } });
  }
  for (const p of pvs.filter((x) => ['aberto', 'em_execucao'].includes(x.status)))
    for (const g of p.grupos || []) {
      const datas = [...new Set((g.itens || []).filter((i) => i.status !== 'cancelado').map((i) => i.valores?.data_prevista).filter(dentro))];
      for (const d of datas) itens.push({ data: d, tipo: 'transporte_pv', titulo: `🚛 ${g.titulo || 'Trecho'} (vendido)`, sub: `${p.numero}${p.cliente_nome ? ` · ${p.cliente_nome}` : ''}`, ref: { pv_id: p.id } });
    }
  for (const a of ativs) { const d = diaBR(a.prevista_para); if (dentro(d)) itens.push({ data: d, tipo: 'tarefa', titulo: `⏰ ${a.texto.slice(0, 90)}`, sub: a.atribuido_nome || null, feita: !!a.concluida_em, ref: { atividade_id: a.id, bid_id: a.bid_id || null } }); }
  for (const e of evs.filter((x) => x.ativo !== false)) {
    for (const o of ocorrencias(e, somaDias(d0, -366), somaDias(d1, 366))) {
      const onde = e.cidade ? ` · ${e.cidade}${e.uf ? `/${e.uf}` : ''}` : '';
      if (o.fim >= d0 && o.inicio <= d1) itens.push({ data: o.inicio < d0 ? d0 : o.inicio, ate: o.fim > d1 ? d1 : o.fim, inicio_real: o.inicio, fim_real: o.fim, tipo: 'evento', titulo: `${(TIPOS[e.tipo] || '📌').split(' ')[0]} ${e.nome}`, sub: `${TIPOS[e.tipo] || ''}${onde}`, ref: { evento_id: e.id } });
      const pr = somaDias(o.inicio, -Number(e.antecedencia_dias ?? 60));
      if (Number(e.antecedencia_dias) > 0 && dentro(pr)) itens.push({ data: pr, tipo: 'prospeccao', titulo: `📣 Prospectar: ${e.nome}`, sub: `evento em ${dBR(o.inicio)} (${e.antecedencia_dias} dias antes)`, ref: { evento_id: e.id } });
    }
  }
  itens.sort((x, y) => String(x.data).localeCompare(String(y.data)) || String(x.tipo).localeCompare(String(y.tipo)));
  return { de: d0, ate: d1, itens };
}
/** faixa do Funil: eventos na janela de prospecção agora */
async function alertas(supabase, tenantId) {
  await gerarLembretes(supabase, tenantId);
  const h = hojeBR();
  return (await listarEventos(supabase, tenantId).catch(() => [])).filter((e) => e.proxima && e.prospeccao <= h && e.proxima.fim >= h)
    .map((e) => ({ id: e.id, nome: e.nome, tipo: e.tipo, cidade: e.cidade, uf: e.uf, inicio: e.proxima.inicio, fim: e.proxima.fim, faltam: e.faltam, clientes_nomes: e.clientes_nomes }));
}

// ─── 18b: 📣 PROSPECÇÃO POR EVENTO ──────────────────────────────────────────
//   clientes: os LIGADOS ao evento + os 💡 SUGERIDOS (contrataram no mesmo período do ano anterior: pedido com transporte previsto
//             na janela do evento ±30 dias, ou BID com data prevista nessa janela) — com contatos (do cadastro + dos BIDs),
//             último BID/pedido, último contato e a SITUAÇÃO na campanha: a contatar → 💬 contatado → 📝 BID criado.
//   livres: equipamentos sem AT no período do evento (o quanto dá para vender).
const soDig = (v) => String(v || '').replace(/\D/g, '');
async function prospeccao(supabase, tenantId, eventoId) {
  const e = await eventoDoTenant(supabase, tenantId, eventoId); if (!e || e.ativo === false) return { status: 404, erro: 'Evento não encontrado' };
  const o = proximaOcorrencia(e) || { inicio: e.inicio, fim: e.fim || e.inicio, ano: Number(String(e.inicio).slice(0, 4)) };
  const [cls, bids, pvs, ativs, exs, eqs] = await Promise.all([
    q(supabase.from('clientes').select('*').eq('tenant_id', tenantId)).catch(() => []),
    q(supabase.from('bids').select('*').eq('tenant_id', tenantId)).catch(() => []),
    q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId)).catch(() => []),
    q(supabase.from('bid_atividades').select('*').eq('tenant_id', tenantId)).catch(() => []),
    q(supabase.from('execucoes').select('*').eq('tenant_id', tenantId)).catch(() => []),
    q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId)).catch(() => []),
  ]);
  // janela do ano anterior (±30 dias)
  const menos1 = (d) => `${Number(d.slice(0, 4)) - 1}${d.slice(4)}`;
  const j0 = somaDias(menos1(o.inicio), -30); const j1 = somaDias(menos1(o.fim || o.inicio), 30);
  const datasDe = (grupos) => (grupos || []).flatMap((g) => (g.itens || []).map((i) => i.valores?.data_prevista)).filter(Boolean);
  const sugeridos = new Map();
  for (const p of pvs.filter((x) => x.status !== 'cancelado')) if (p.cliente_id != null && datasDe(p.grupos).some((d) => d >= j0 && d <= j1)) sugeridos.set(String(p.cliente_id), `contratou ${p.numero} no mesmo período de ${Number(o.inicio.slice(0, 4)) - 1}`);
  for (const b of bids.filter((x) => x.fase !== 'perdido')) if (b.cliente_id != null && !sugeridos.has(String(b.cliente_id)) && datasDe(b.grupos).some((d) => d >= j0 && d <= j1)) sugeridos.set(String(b.cliente_id), `cotou ${b.numero} no mesmo período de ${Number(o.inicio.slice(0, 4)) - 1}`);
  const ligados = (e.clientes || []).map(String);
  const ids = [...new Set([...ligados, ...sugeridos.keys()])];
  const desde = somaDias(o.inicio, -Math.max(Number(e.antecedencia_dias ?? 60), 0) - 30);
  const lista = ids.map((id) => cls.find((c) => String(c.id) === id)).filter(Boolean).map((c) => {
    const bc = bids.filter((b) => String(b.cliente_id) === String(c.id)).sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
    const pc = pvs.filter((p) => String(p.cliente_id) === String(c.id)).sort((a, b) => String(b.criado_em || '').localeCompare(String(a.criado_em || '')));
    const ac = ativs.filter((a) => String(a.cliente_id) === String(c.id) && a.tipo !== 'tarefa' && a.tipo !== 'evento').sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
    // contatos: o principal do cadastro + os dos BIDs (sem repetir telefone/e-mail)
    const contatos = []; const vistos = new Set();
    for (const x of [{ nome: c.contato_nome, email: c.contato_email, telefone: c.contato_telefone, de: 'cadastro' }, ...bc.map((b) => ({ nome: b.contato_nome, email: b.contato_email, telefone: b.contato_telefone, de: b.numero }))]) {
      const k = `${soDig(x.telefone)}|${String(x.email || '').toLowerCase()}`; if ((!x.telefone && !x.email) || vistos.has(k)) continue; vistos.add(k); contatos.push(x);
    }
    const daCampanha = ac.filter((a) => String(a.evento_id) === String(e.id) || (a.criado_em >= desde && /evento|feira|safra|obra|licita/i.test(String(a.texto)) && String(a.texto).includes(e.nome)));
    const bidCamp = bc.find((b) => String(b.evento_id) === String(e.id));
    return { id: c.id, nome: c.nome, cidade: c.cidade || null, uf: c.uf || null, ligado: ligados.includes(String(c.id)), sugestao: sugeridos.get(String(c.id)) || null, contatos,
      ultimo_bid: bc[0] ? { id: bc[0].id, numero: bc[0].numero, fase: bc[0].fase, em: bc[0].criado_em } : null, ultimo_pedido: pc[0] ? { id: pc[0].id, numero: pc[0].numero, em: pc[0].criado_em } : null,
      ultimo_contato: ac[0] ? { tipo: ac[0].tipo, em: ac[0].criado_em, texto: ac[0].texto, por: ac[0].usuario_nome } : null,
      situacao: bidCamp ? 'bid' : daCampanha.length ? 'contatado' : 'a_contatar', contatado_em: daCampanha[0]?.criado_em || null, bid_campanha: bidCamp ? { id: bidCamp.id, numero: bidCamp.numero, fase: bidCamp.fase } : null };
  }).sort((a, b) => ({ a_contatar: 0, contatado: 1, bid: 2 }[a.situacao] - { a_contatar: 0, contatado: 1, bid: 2 }[b.situacao]) || (b.ligado - a.ligado) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  // ociosidade: equipamentos sem AT ativa no período do evento
  const ini = new Date(`${o.inicio}T00:00:00-03:00`).toISOString(); const fim = new Date(`${o.fim || o.inicio}T23:59:59-03:00`).toISOString();
  const ocupados = new Set(exs.filter((x) => ['programada', 'em_execucao'].includes(x.status) && x.inicio_previsto && x.inicio_previsto <= fim && (x.fim_previsto || x.inicio_previsto) >= ini).flatMap((x) => (x.conjunto || []).map((c) => String(c.id))));
  const ativosEq = eqs.filter((x) => x.ativo !== false);
  const livres = ativosEq.filter((x) => !ocupados.has(String(x.id)) && !x.bloqueado);
  return { evento: { id: e.id, nome: e.nome, tipo: e.tipo, tipo_nome: TIPOS[e.tipo] || e.tipo, cidade: e.cidade, uf: e.uf, inicio: o.inicio, fim: o.fim, faltam: diasEntre(hojeBR(), o.inicio), observacoes: e.observacoes || null },
    clientes: lista, resumo: { total: lista.length, contatados: lista.filter((x) => x.situacao !== 'a_contatar').length, bids: lista.filter((x) => x.situacao === 'bid').length },
    livres: { quantos: livres.length, de: ativosEq.length, tags: livres.slice(0, 12).map((x) => x.tag || x.nome) } };
}

module.exports = { prospeccao, TIPOS, validar, listarEventos, criarEvento, editarEvento, removerEvento, ocorrencias, proximaOcorrencia, gerarLembretes, calendario, alertas };
