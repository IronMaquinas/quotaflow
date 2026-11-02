// backend/services/calendarioComercial.js — etapa 18a
//
// 📅 CALENDÁRIO COMERCIAL + 🎪 EVENTOS DE MERCADO (desenho do Marcony, 28/10/2026 — claude/desenho-calendario-comercial.md):
//   • o calendário junta: BIDs abertos pela DECISÃO ESPERADA (previsao_fechamento) e pela VALIDADE (envio + validade);
//     TRANSPORTES com data prevista (itens dos BIDs abertos = negociando; dos pedidos abertos = vendidos); ⏰ TAREFAS do comercial;
//     🎪 EVENTOS de mercado (feira, safra, obra, licitação…) e o dia de começar a PROSPECÇÃO (início − antecedência).
//   • evento que "repete todo ano" aparece em todos os anos (mesmo dia/mês).
//   • LEMBRETE: a faixa 📣 no topo do Funil (calculada na hora). 18b.2: a ⏰ tarefa automática da 18a saiu — cada cliente do evento é
//     uma OPORTUNIDADE que só se encerra com BID criado ou ✕ cancelada (com motivo); delegar cria tarefa no ✅ Plano espelhada.
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

// ─── calendário ─────────────────────────────────────────────────────────────
/** itens entre de e ate: { data, ate, tipo, titulo, sub, fase?, ref } */
async function calendario(supabase, tenantId, { de, ate } = {}) {
  const B = require('./bids');
  const d0 = DATA.test(String(de || '')) ? de : `${hojeBR().slice(0, 7)}-01`;
  const d1 = DATA.test(String(ate || '')) ? ate : somaDias(d0, 41);
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
/** faixa do Funil: eventos na janela de prospecção agora (sem os 🔕 cancelados no ano), com o andamento */
async function alertas(supabase, tenantId) {
  const h = hojeBR();
  const evs = (await listarEventos(supabase, tenantId).catch(() => [])).filter((e) => e.proxima && e.prospeccao <= h && e.proxima.fim >= h);
  const cache = {}; const out = [];
  for (const e of evs) {
    const p = await prospeccao(supabase, tenantId, e.id, cache).catch(() => null);
    if (p && p.cancelado) continue;
    out.push({ id: e.id, nome: e.nome, tipo: e.tipo, cidade: e.cidade, uf: e.uf, inicio: e.proxima.inicio, fim: e.proxima.fim, faltam: e.faltam, clientes_nomes: e.clientes_nomes, resumo: p?.resumo || null });
  }
  return out.sort((a, b) => a.faltam - b.faltam);
}

// ─── 18b: 📣 PROSPECÇÃO POR EVENTO ──────────────────────────────────────────
//   clientes: os LIGADOS ao evento + os 💡 SUGERIDOS (contrataram no mesmo período do ano anterior: pedido com transporte previsto
//             na janela do evento ±30 dias, ou BID com data prevista nessa janela) — com contatos (do cadastro + dos BIDs),
//             último BID/pedido, último contato e a SITUAÇÃO na campanha: a contatar → 💬 contatado → 📝 BID criado.
//   livres: equipamentos sem AT no período do evento (o quanto dá para vender).
const soDig = (v) => String(v || '').replace(/\D/g, '');
async function prospeccao(supabase, tenantId, eventoId, cache = {}) {
  const e = await eventoDoTenant(supabase, tenantId, eventoId); if (!e || e.ativo === false) return { status: 404, erro: 'Evento não encontrado' };
  const o = proximaOcorrencia(e) || { inicio: e.inicio, fim: e.fim || e.inicio, ano: Number(String(e.inicio).slice(0, 4)) };
  const regs = await linhasProspeccao(supabase, tenantId, e.id, o.ano);
  const regEv = regs.find((r) => r.cliente_id == null) || null;
  const regDe = (cid) => regs.find((r) => r.cliente_id != null && String(r.cliente_id) === String(cid)) || null;
  if (!cache.dados) cache.dados = Promise.all([
    q(supabase.from('clientes').select('*').eq('tenant_id', tenantId)).catch(() => []),
    q(supabase.from('bids').select('*').eq('tenant_id', tenantId)).catch(() => []),
    q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId)).catch(() => []),
    q(supabase.from('bid_atividades').select('*').eq('tenant_id', tenantId)).catch(() => []),
    q(supabase.from('execucoes').select('*').eq('tenant_id', tenantId)).catch(() => []),
    q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId)).catch(() => []),
  ]);
  const [cls, bids, pvs, ativs, exs, eqs] = await cache.dados;
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
  const hist = await participacoes(supabase, tenantId, { eventoId: e.id }).catch(() => []); // 18b.6: anos anteriores deste evento
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
    // 18b.4: retorno combinado (⏰ tarefa da campanha) e o histórico da campanha (contatos + retornos + delegar/cancelar/reabrir)
    const retornos = ativs.filter((a) => a.tipo === 'tarefa' && String(a.cliente_id) === String(c.id) && String(a.evento_id) === String(e.id));
    const bidCamp = bc.find((b) => String(b.evento_id) === String(e.id) && Number(String(b.criado_em || '').slice(0, 4)) >= o.ano - 1);
    const rg = regDe(c.id);
    return { id: c.id, nome: c.nome, cidade: c.cidade || null, uf: c.uf || null, ligado: ligados.includes(String(c.id)), sugestao: sugeridos.get(String(c.id)) || null, contatos,
      ultimo_bid: bc[0] ? { id: bc[0].id, numero: bc[0].numero, fase: bc[0].fase, em: bc[0].criado_em } : null, ultimo_pedido: pc[0] ? { id: pc[0].id, numero: pc[0].numero, em: pc[0].criado_em } : null,
      ultimo_contato: ac[0] ? { tipo: ac[0].tipo, em: ac[0].criado_em, texto: ac[0].texto, por: ac[0].usuario_nome } : null,
      // 18b.2: só se ENCERRA com BID criado ou ✕ cancelada (o evento 🔕 cancelado cancela todos os abertos)
      situacao: bidCamp ? 'bid' : (rg?.situacao === 'cancelada' || regEv?.situacao === 'cancelada') ? 'cancelada' : daCampanha.length ? 'contatado' : 'a_contatar',
      contatos_campanha: daCampanha.length, contatado_em: daCampanha[0]?.criado_em || null, bid_campanha: bidCamp ? { id: bidCamp.id, numero: bidCamp.numero, fase: bidCamp.fase } : null,
      cancelamento: !bidCamp && rg?.situacao === 'cancelada' ? { motivo: rg.motivo, por: rg.cancelado_por, em: rg.cancelado_em } : !bidCamp && regEv?.situacao === 'cancelada' ? { motivo: regEv.motivo, por: regEv.cancelado_por, em: regEv.cancelado_em, do_evento: true } : null,
      anteriores: hist.filter((h) => String(h.cliente_id) === String(c.id) && h.ano < o.ano).map((h) => ({ ano: h.ano, resultado: h.resultado, motivo: h.cancelada?.motivo || null, bid: h.bid, contatos: h.contatos })),
      retornos_abertos: retornos.filter((a) => !a.concluida_em).length,
      retorno: (() => { const r = retornos.filter((a) => !a.concluida_em).sort((a, b) => String(a.prevista_para).localeCompare(String(b.prevista_para)))[0]; return r ? { id: r.id, em: r.prevista_para, para: r.atribuido_nome || null } : null; })(),
      campanha: [
        ...daCampanha.map((a) => ({ em: a.criado_em, tipo: a.tipo, texto: a.texto, por: a.usuario_nome || null })),
        ...retornos.map((a) => ({ em: a.criado_em, tipo: 'retorno', texto: a.texto, por: a.usuario_nome || null, prevista: a.prevista_para, feita: a.concluida_em || null })),
        ...(rg?.historico || []).map((h) => ({ em: h.em, tipo: h.acao, texto: [h.para ? `para ${h.para}` : null, h.prazo ? `prazo ${dBR(h.prazo)}` : null, h.obs].filter(Boolean).join(' · ') || null, por: h.por || null })),
      ].sort((a, b) => String(b.em).localeCompare(String(a.em))),
      delegado: rg?.responsavel_nome ? { id: rg.responsavel_id, nome: rg.responsavel_nome, prazo: rg.prazo, tarefa_id: rg.tarefa_id } : null, historico: rg?.historico || [] };
  }).sort((a, b) => (ORD[a.situacao] - ORD[b.situacao]) || (b.ligado - a.ligado) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  // ociosidade: equipamentos sem AT ativa no período do evento
  const ini = new Date(`${o.inicio}T00:00:00-03:00`).toISOString(); const fim = new Date(`${o.fim || o.inicio}T23:59:59-03:00`).toISOString();
  const ocupados = new Set(exs.filter((x) => ['programada', 'em_execucao'].includes(x.status) && x.inicio_previsto && x.inicio_previsto <= fim && (x.fim_previsto || x.inicio_previsto) >= ini).flatMap((x) => (x.conjunto || []).map((c) => String(c.id))));
  const ativosEq = eqs.filter((x) => x.ativo !== false);
  const livres = ativosEq.filter((x) => !ocupados.has(String(x.id)) && !x.bloqueado);
  return { evento: { id: e.id, nome: e.nome, tipo: e.tipo, tipo_nome: TIPOS[e.tipo] || e.tipo, cidade: e.cidade, uf: e.uf, inicio: o.inicio, fim: o.fim, faltam: diasEntre(hojeBR(), o.inicio), observacoes: e.observacoes || null },
    ano: o.ano, cancelado: regEv?.situacao === 'cancelada' ? { motivo: regEv.motivo, por: regEv.cancelado_por, em: regEv.cancelado_em } : null,
    delegado: regEv?.responsavel_nome ? { id: regEv.responsavel_id, nome: regEv.responsavel_nome, prazo: regEv.prazo, tarefa_id: regEv.tarefa_id } : null, historico: regEv?.historico || [],
    clientes: lista, resumo: { total: lista.length, contatados: lista.filter((x) => x.situacao === 'bid' || x.contatos_campanha > 0).length, bids: lista.filter((x) => x.situacao === 'bid').length,
      cancelados: lista.filter((x) => x.situacao === 'cancelada').length, abertos: lista.filter((x) => ['a_contatar', 'contatado'].includes(x.situacao)).length },
    livres: { quantos: livres.length, de: ativosEq.length, tags: livres.slice(0, 12).map((x) => x.tag || x.nome) } };
}

// ─── 18b.2: oportunidades — ✕ cancelar (com motivo), ↩ reabrir, 👤 delegar (tarefa no ✅ Plano espelhada) ───────────
const ORD = { a_contatar: 0, contatado: 1, bid: 2, cancelada: 3 };
const ERRO_061 = { status: 409, erro: 'Rode a migration 061 antes (oportunidades da prospecção)' };
async function linhasProspeccao(supabase, tenantId, eventoId, ano) {
  try { return await q(supabase.from('comercial_prospeccoes').select('*').eq('tenant_id', tenantId).eq('evento_id', eventoId).eq('ano', ano)); } catch { return []; } // sem a 061
}
const hist = (r, o) => [...(Array.isArray(r?.historico) ? r.historico : []), { em: new Date().toISOString(), ...o }].slice(-50);
/** grava (cria ou atualiza) a linha do evento (clienteId nulo) ou do cliente */
async function gravarLinha(supabase, tenantId, e, ano, clienteId, upd) {
  const regs = await q(supabase.from('comercial_prospeccoes').select('*').eq('tenant_id', tenantId).eq('evento_id', e.id).eq('ano', ano));
  const r = regs.find((x) => (clienteId == null ? x.cliente_id == null : String(x.cliente_id) === String(clienteId)));
  const agora = new Date().toISOString();
  if (r) { const { data, error } = await supabase.from('comercial_prospeccoes').update({ ...upd(r), atualizado_em: agora }).eq('id', r.id).eq('tenant_id', tenantId).select(); if (error) throw new Error(error.message); return data[0]; }
  const base = { tenant_id: tenantId, evento_id: e.id, ano, cliente_id: clienteId == null ? null : clienteId, situacao: 'aberta', motivo: null, cancelado_por: null, cancelado_em: null,
    responsavel_id: null, responsavel_nome: null, prazo: null, tarefa_id: null, historico: [], criado_em: agora, atualizado_em: agora };
  const { data, error } = await supabase.from('comercial_prospeccoes').insert([{ ...base, ...upd(base) }]).select(); if (error) throw new Error(error.message); return data[0];
}
async function alvo(supabase, tenantId, eventoId, clienteId) {
  const p = await prospeccao(supabase, tenantId, eventoId); if (p.erro) return { r: p };
  if (clienteId != null && clienteId !== '') { const c = p.clientes.find((x) => String(x.id) === String(clienteId)); if (!c) return { r: { status: 404, erro: 'Cliente não está nesta prospecção' } }; return { p, c }; }
  return { p };
}
async function cancelarProspeccao(supabase, tenantId, quem, eventoId, body = {}) {
  const motivo = texto(body.motivo, 500); if (!motivo) return { status: 400, erro: 'Conte o motivo do cancelamento (ex.: já fechou com outro, não vai à feira)' };
  const { p, c, r } = await alvo(supabase, tenantId, eventoId, body.cliente_id); if (r) return r;
  if (c && c.situacao === 'bid') return { status: 409, erro: `${c.nome} já tem BID desta prospecção (${c.bid_campanha?.numero}) — encerrada pelo BID` };
  if (c ? c.situacao === 'cancelada' : p.cancelado) return { status: 409, erro: 'Já está cancelada' };
  const e = await eventoDoTenant(supabase, tenantId, eventoId); const agora = new Date().toISOString();
  try { await gravarLinha(supabase, tenantId, e, p.ano, c ? c.id : null, (x) => ({ situacao: 'cancelada', motivo, cancelado_por: quem.usuarioNome || null, cancelado_em: agora, historico: hist(x, { acao: 'cancelada', por: quem.usuarioNome || null, obs: motivo }) })); }
  catch (er) { if (/comercial_prospeccoes|does not exist|schema cache/.test(er.message)) return ERRO_061; throw er; }
  // 18b.6: encerra os 📅 retornos abertos (do cliente, ou de todos no 🔕 evento) — padrão sim; o resultado sai preenchido
  let retornos = 0;
  if (body.encerrar_retornos !== false) {
    const abertos = (await q(supabase.from('bid_atividades').select('*').eq('tenant_id', tenantId).eq('tipo', 'tarefa').eq('evento_id', e.id)).catch(() => []))
      .filter((a) => !a.concluida_em && (!c || String(a.cliente_id) === String(c.id)));
    for (const a of abertos) {
      const base = String(a.texto || '').split('\n✓ Resultado')[0];
      await supabase.from('bid_atividades').update({ concluida_em: agora, texto: `${base}\n✓ Resultado${quem.usuarioNome ? ` (${quem.usuarioNome})` : ''}: Encerrada — ${c ? 'prospecção cancelada' : 'evento cancelado no ano'}: ${motivo}`.slice(0, 4000) }).eq('id', a.id).eq('tenant_id', tenantId);
      retornos++;
    }
  }
  return { prospeccao: await sincronizarProspeccao(supabase, tenantId, eventoId), retornos_encerrados: retornos };
}
async function reabrirProspeccao(supabase, tenantId, quem, eventoId, body = {}) {
  const { p, c, r } = await alvo(supabase, tenantId, eventoId, body.cliente_id); if (r) return r;
  if (c && c.cancelamento?.do_evento) return { status: 409, erro: 'O evento inteiro está cancelado — reabra o evento primeiro' };
  if (c ? c.situacao !== 'cancelada' : !p.cancelado) return { status: 409, erro: 'Não está cancelada' };
  const e = await eventoDoTenant(supabase, tenantId, eventoId);
  try { await gravarLinha(supabase, tenantId, e, p.ano, c ? c.id : null, (x) => ({ situacao: 'aberta', motivo: null, cancelado_por: null, cancelado_em: null, historico: hist(x, { acao: 'reaberta', por: quem.usuarioNome || null }) })); }
  catch (er) { if (/comercial_prospeccoes|does not exist|schema cache/.test(er.message)) return ERRO_061; throw er; }
  return { prospeccao: await sincronizarProspeccao(supabase, tenantId, eventoId, { reabrir: true }) };
}
async function delegarProspeccao(supabase, tenantId, quem, eventoId, body = {}) {
  const resp = await responsavelOk(supabase, tenantId, body.responsavel_id); if (resp.erro || !resp.id) return { status: 400, erro: resp.erro || 'Escolha para quem delegar' };
  if (body.prazo && !DATA.test(String(body.prazo))) return { status: 400, erro: 'Prazo inválido' };
  const { p, c, r } = await alvo(supabase, tenantId, eventoId, body.cliente_id); if (r) return r;
  if (c ? ['bid', 'cancelada'].includes(c.situacao) : p.cancelado) return { status: 409, erro: 'Esta prospecção já está encerrada — reabra para delegar' };
  const e = await eventoDoTenant(supabase, tenantId, eventoId);
  const vespera = somaDias(p.evento.inicio, -1); const prazo = body.prazo || (vespera < hojeBR() ? hojeBR() : vespera);
  const obs = texto(body.observacao, 500);
  try { await gravarLinha(supabase, tenantId, e, p.ano, c ? c.id : null, (x) => ({ responsavel_id: resp.id, responsavel_nome: resp.nome, prazo, historico: hist(x, { acao: 'delegada', por: quem.usuarioNome || null, para: resp.nome, prazo, obs }) })); }
  catch (er) { if (/comercial_prospeccoes|does not exist|schema cache/.test(er.message)) return ERRO_061; throw er; }
  return { prospeccao: await sincronizarProspeccao(supabase, tenantId, eventoId, { obs }) };
}
/** espelha cada linha delegada numa tarefa do ✅ Plano: aberta enquanto a oportunidade está aberta; concluída com BID; cancelada com ✕.
 *  A linha do EVENTO conclui quando todos os clientes estão resolvidos (BID ou cancelado). */
async function sincronizarProspeccao(supabase, tenantId, eventoId, { reabrir = false, obs = null } = {}) {
  const p = await prospeccao(supabase, tenantId, eventoId); if (p.erro) return p;
  const regs = await linhasProspeccao(supabase, tenantId, eventoId, p.ano);
  const ev = p.evento; const quando = `${dBR(ev.inicio)}${ev.fim !== ev.inicio ? ` a ${dBR(ev.fim)}` : ''}`;
  for (const rg of regs.filter((x) => x.responsavel_nome)) {
    const c = rg.cliente_id == null ? null : p.clientes.find((x) => String(x.id) === String(rg.cliente_id));
    if (rg.cliente_id != null && !c) continue;
    let status = 'pendente'; let fim = null;
    if (c) {
      if (c.situacao === 'bid') { status = 'concluida'; fim = `✓ Encerrada: ${c.bid_campanha.numero} criado.`; }
      else if (c.situacao === 'cancelada') { status = 'cancelada'; fim = `✕ Cancelada por ${c.cancelamento.por || '—'}: ${c.cancelamento.motivo}`; }
    } else if (p.cancelado) { status = 'cancelada'; fim = `🔕 Evento cancelado por ${p.cancelado.por || '—'}: ${p.cancelado.motivo}`; }
    else if (p.resumo.total > 0 && p.resumo.abertos === 0) { status = 'concluida'; fim = `✓ Encerrada: ${p.resumo.bids} BID(s), ${p.resumo.cancelados} cancelado(s).`; }
    const titulo = `📣 Prospectar ${c ? c.nome : 'clientes'} — ${ev.nome} (${quando})`.slice(0, 200);
    const andamento = c ? (c.contatos_campanha ? `${c.contatos_campanha} contato(s) registrado(s).` : 'Ainda não contatado.') : `${p.resumo.contatados} de ${p.resumo.total} contatados · ${p.resumo.bids} BID(s) · ${p.resumo.cancelados} cancelado(s).`;
    const detalhe = [fim || `Encerra sozinha quando ${c ? 'o BID for criado' : 'todos os clientes tiverem BID ou forem cancelados'} ou o comercial cancelar.`, andamento,
      obs && !fim ? `Obs.: ${obs}` : null, 'Resolva em 📈 Comercial → 📣 Prospecção (tarefa criada pelo QuotaFlow).'].filter(Boolean).join(' ');
    try {
      if (rg.tarefa_id) {
        const ts = await q(supabase.from('tarefas').select('*').eq('tenant_id', tenantId).eq('id', rg.tarefa_id)).catch(() => []);
        const t = ts[0];
        if (t) {
          const upd = { titulo, detalhe, responsavel: rg.responsavel_nome, prazo: rg.prazo };
          if (status !== 'pendente') upd.status = status; else if (['concluida', 'cancelada'].includes(t.status) || reabrir) upd.status = 'pendente';
          await supabase.from('tarefas').update(upd).eq('id', rg.tarefa_id).eq('tenant_id', tenantId);
          continue;
        }
      }
      if (status !== 'pendente') continue;
      const { data, error } = await supabase.from('tarefas').insert([{ tenant_id: tenantId, titulo, detalhe, responsavel: rg.responsavel_nome, prazo: rg.prazo, prioridade: c ? 'media' : 'alta', status: 'pendente',
        origem: 'prospeccao', origem_ref: String(eventoId), criado_em: new Date().toISOString() }]).select();
      if (error) throw new Error(error.message);
      await supabase.from('comercial_prospeccoes').update({ tarefa_id: String(data[0].id) }).eq('id', rg.id).eq('tenant_id', tenantId);
    } catch (er) { console.warn('⚠️ [prospecção] tarefa do Plano:', er.message); }
  }
  return prospeccao(supabase, tenantId, eventoId);
}

// ─── 18b.6: 📜 HISTÓRICO DE PARTICIPAÇÃO (evento × ano × cliente) — o que já está gravado, organizado ──────────
//   resultado: 'bid' (BID da campanha, com fase/valor) | 'cancelada' (✕ ou 🔕, com motivo) | 'contatado' (sem resultado) — por ano da ocorrência
function anoDaOcorrencia(e, iso) {
  const d = String(iso || '').slice(0, 10); if (!DATA.test(d)) return null;
  const o = ocorrencias(e, d, somaDias(d, 800)).find((x) => x.fim >= d); return o ? o.ano : Number(d.slice(0, 4));
}
async function participacoes(supabase, tenantId, { clienteId = null, eventoId = null } = {}) {
  const [evs, regs, bids, ativs, cls] = await Promise.all([
    q(supabase.from('comercial_eventos').select('*').eq('tenant_id', tenantId)).catch(() => []),
    q(supabase.from('comercial_prospeccoes').select('*').eq('tenant_id', tenantId)).catch(() => []),
    q(supabase.from('bids').select('*').eq('tenant_id', tenantId)).catch(() => []),
    q(supabase.from('bid_atividades').select('*').eq('tenant_id', tenantId)).catch(() => []),
    q(supabase.from('clientes').select('*').eq('tenant_id', tenantId)).catch(() => []),
  ]);
  const evPor = new Map(evs.map((e) => [String(e.id), e])); const nomeCli = new Map(cls.map((c) => [String(c.id), c.nome]));
  const ok = (eid, cid) => (eventoId == null || String(eid) === String(eventoId)) && (clienteId == null || String(cid) === String(clienteId));
  const mapa = new Map(); // evento|ano|cliente
  const pega = (e, ano, cid) => { const k = `${e.id}|${ano}|${cid}`; if (!mapa.has(k)) mapa.set(k, { evento_id: e.id, evento_nome: e.nome, ano, cliente_id: cid, cliente_nome: nomeCli.get(String(cid)) || null, contatos: 0, bid: null, cancelada: null }); return mapa.get(k); };
  for (const a of ativs.filter((x) => x.evento_id != null && x.cliente_id != null && x.tipo !== 'tarefa' && x.tipo !== 'evento')) {
    const e = evPor.get(String(a.evento_id)); if (!e || !ok(e.id, a.cliente_id)) continue; const ano = anoDaOcorrencia(e, diaBR(a.criado_em)); if (ano) pega(e, ano, a.cliente_id).contatos++;
  }
  for (const b of bids.filter((x) => x.evento_id != null && x.cliente_id != null && x.tipo !== 'aditivo')) {
    const e = evPor.get(String(b.evento_id)); if (!e || !ok(e.id, b.cliente_id)) continue; const ano = anoDaOcorrencia(e, diaBR(b.criado_em)); if (!ano) continue;
    pega(e, ano, b.cliente_id).bid = { id: b.id, numero: b.numero, fase: b.fase, valor: b.valor_total != null ? Number(b.valor_total) : null };
  }
  for (const r of regs.filter((x) => x.situacao === 'cancelada')) {
    const e = evPor.get(String(r.evento_id)); if (!e) continue;
    const alvos = r.cliente_id != null ? [r.cliente_id] : [...new Set([...(e.clientes || []), ...[...mapa.values()].filter((m) => String(m.evento_id) === String(e.id) && m.ano === r.ano).map((m) => m.cliente_id)].map(String))];
    for (const cid of alvos) { if (!ok(e.id, cid)) continue; const m = pega(e, r.ano, cid); if (!m.cancelada || r.cliente_id != null) m.cancelada = { motivo: r.motivo, por: r.cancelado_por, em: r.cancelado_em, do_evento: r.cliente_id == null }; }
  }
  return [...mapa.values()].map((m) => ({ ...m, resultado: m.bid ? 'bid' : m.cancelada ? 'cancelada' : 'contatado' }))
    .sort((a, b) => b.ano - a.ano || String(a.evento_nome).localeCompare(String(b.evento_nome), 'pt-BR') || String(a.cliente_nome).localeCompare(String(b.cliente_nome), 'pt-BR'));
}
/** resumo por evento e ano (lista de eventos): clientes · BIDs (aceitos) · não participaram · sem resposta */
async function resumoAnos(supabase, tenantId) {
  const out = {};
  for (const p of await participacoes(supabase, tenantId)) {
    const k = String(p.evento_id); out[k] = out[k] || {}; const r = out[k][p.ano] = out[k][p.ano] || { ano: p.ano, clientes: 0, bids: 0, aceitos: 0, nao: 0, sem: 0 };
    r.clientes++; if (p.resultado === 'bid') { r.bids++; if (p.bid.fase === 'aceito') r.aceitos++; } else if (p.resultado === 'cancelada') r.nao++; else r.sem++;
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Object.values(v).sort((a, b) => b.ano - a.ano)]));
}

module.exports = { participacoes, resumoAnos, prospeccao, cancelarProspeccao, reabrirProspeccao, delegarProspeccao, sincronizarProspeccao, TIPOS, validar, listarEventos, criarEvento, editarEvento, removerEvento, ocorrencias, proximaOcorrencia, calendario, alertas };
