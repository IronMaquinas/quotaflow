// backend/services/monitorCnpj.js — etapa 14e
//
// MONITOR DE CNPJs (compliance). Uma situação por CNPJ (cnpj_monitor, da plataforma inteira — a Receita é a mesma
// para todo mundo), verificada:
//   • nos CICLOS quinzenais (começam dia 01 e 15; o disparo das 7h verifica até LOTE CNPJs pendentes por dia, até 100%);
//   • NA HORA de enviar cotação, emitir OC ou lançar a nota de um fornecedor (resultado vale 24 h).
//
// Quem vê o quê:
//   • TENANT → a base dele (fornecedores locais + clientes) e, dos fornecedores GLOBAIS, só os irregulares que estão
//     num processo dele em andamento (cotação aberta ou OC pendente/aprovada). Nunca a lista geral de globais.
//   • PLATAFORMA (Console) → todos os fornecedores globais/candidatos irregulares + quantos tenants têm processo com eles.
//
// Travas:
//   • Cotação: fornecedor com CNPJ irregular NÃO recebe a cotação (bloqueado — cotacao_fornecedores.bloqueado_cnpj).
//   • OC e lançamento da nota (pagamento): segue só com JUSTIFICATIVA registrada (cnpj_liberacoes — quem, quando, situação).
//   • Receita fora do ar na hora: vale a última situação conhecida (não trava por falta de consulta).

const R = require('./receitaCnpj');

const so = (v) => String(v || '').replace(/\D/g, '');
const irregular = (s) => !!s && String(s).trim().toUpperCase() !== 'ATIVA';
const VALIDADE_H = 24;
const LOTE = Number(process.env.MONITOR_CNPJ_LOTE || 300);   // por disparo diário
const PAUSA_MS = Number(process.env.MONITOR_CNPJ_PAUSA_MS || 1200); // gentil com a BrasilAPI
const COT_FECHADA = new Set(['finalizada', 'finalizado', 'cancelada', 'cancelado', 'concluida', 'concluido']);
const OC_ABERTA = new Set(['pendente', 'aprovada']);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const fmtCnpj = (d) => (so(d).length === 14 ? so(d).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : d || '');
const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const estado = (row) => ({ documento: row?.documento, situacao: row?.situacao || null, irregular: irregular(row?.situacao), verificado_em: row?.verificado_em || null, mudou_em: row?.mudou_em || null, situacao_anterior: row?.situacao_anterior || null });

async function linha(supabase, doc) { return (await q(supabase.from('cnpj_monitor').select('*').eq('documento', doc)))[0] || null; }

/** Situação de um CNPJ (cache de 24 h; forcar = consulta agora). Nunca lança erro por Receita fora do ar. */
async function verificar(supabase, documento, { forcar = false, validadeH = VALIDADE_H, avisar = true } = {}) {
  const doc = so(documento); if (doc.length !== 14) return { documento: doc, situacao: null, irregular: false, invalido: true };
  let row = null; try { row = await linha(supabase, doc); } catch (e) { return { documento: doc, situacao: null, irregular: false, sem_tabela: true }; }
  if (!forcar && row?.verificado_em && Date.now() - new Date(row.verificado_em).getTime() < validadeH * 3600e3) return estado(row);
  const r = await R.consultarReceita(doc);
  const agora = new Date().toISOString();
  if (r.status !== 'ok' && r.status !== 'nao_encontrado') {
    await supabase.from('cnpj_monitor').upsert({ documento: doc, ultima_falha: `${agora} ${r.motivo || r.status}`.slice(0, 200), ...(row ? {} : { situacao: null }) });
    return { ...estado(row || { documento: doc }), sem_consulta: true };
  }
  const resumo = r.status === 'ok' ? (R.resumoReceita(r.dados) || {}) : {};
  const sit = r.status === 'nao_encontrado' ? 'NÃO ENCONTRADO NA RECEITA' : (resumo.situacao || null);
  const mudou = !!(row?.situacao && sit && String(row.situacao).toUpperCase() !== String(sit).toUpperCase());
  const novo = { documento: doc, situacao: sit, razao_social: resumo.razao_social || row?.razao_social || null, verificado_em: agora, ultima_falha: null,
    situacao_anterior: mudou ? row.situacao : (row?.situacao_anterior || null), mudou_em: mudou ? agora : (row?.mudou_em || (row ? null : (irregular(sit) ? agora : null))) };
  const { error } = await supabase.from('cnpj_monitor').upsert(novo);
  if (error) console.error('⚠️ [monitor cnpj] upsert:', error.message);
  // espelha nos fornecedores com esse CNPJ (telas antigas usam situacao_cnpj)
  try {
    const fs = await q(supabase.from('fornecedores').select('id, cnpj').in('cnpj', [doc, fmtCnpj(doc)]));
    for (const f of fs) await supabase.from('fornecedores').update({ situacao_cnpj: sit, ultima_consulta_cnpj: agora }).eq('id', f.id);
  } catch { /* ok */ }
  if (avisar && mudou && irregular(sit)) notificarMudanca(supabase, doc, sit, row.situacao).catch((e) => console.error('⚠️ [monitor cnpj] aviso:', e.message));
  return { ...estado(novo), mudou };
}

/** fornecedorIds → [{ fornecedor_id, nome, cnpj, situacao, irregular, sem_consulta }] (verifica na hora, cache 24 h) */
async function checarFornecedores(supabase, fornecedorIds = []) {
  const ids = [...new Set(fornecedorIds.map(String))]; if (!ids.length) return [];
  const fs = await q(supabase.from('fornecedores').select('*').in('id', ids));
  const out = [];
  for (const f of fs) {
    const doc = so(f.cnpj);
    const v = doc.length === 14 ? await verificar(supabase, doc) : { situacao: null, irregular: false, invalido: true };
    out.push({ fornecedor_id: f.id, nome: f.nome_fantasia || f.nome, cnpj: doc || null, tipo: f.tipo, situacao: v.situacao, irregular: !!v.irregular, sem_consulta: !!v.sem_consulta, verificado_em: v.verificado_em || null });
  }
  return out;
}

/** Processos em andamento (cotação aberta, OC pendente/aprovada) dos fornecedores. tenantId opcional. */
async function processosAbertos(supabase, fornecedorIds = [], tenantId = null) {
  const ids = [...new Set(fornecedorIds.map(String))]; if (!ids.length) return [];
  const filtro = (b) => (tenantId != null ? b.eq('tenant_id', tenantId) : b);
  const [cfs, ovs] = await Promise.all([
    q(filtro(supabase.from('cotacao_fornecedores').select('cotacao_id, fornecedor_id, tenant_id').in('fornecedor_id', ids))).catch(() => []),
    q(filtro(supabase.from('ordens_venda').select('id, numero, status, fornecedor_id, tenant_id').in('fornecedor_id', ids))).catch(() => []),
  ]);
  const cotIds = [...new Set(cfs.map((c) => String(c.cotacao_id)))];
  const cots = cotIds.length ? await q(supabase.from('cotacoes').select('id, numero, status, tenant_id').in('id', cotIds)).catch(() => []) : [];
  const cotMap = new Map(cots.map((c) => [String(c.id), c]));
  const out = [];
  for (const c of cfs) { const k = cotMap.get(String(c.cotacao_id)); if (k && !COT_FECHADA.has(String(k.status || '').toLowerCase())) out.push({ tipo: 'cotacao', tenant_id: k.tenant_id, fornecedor_id: c.fornecedor_id, id: k.id, numero: k.numero || `#${k.id}` }); }
  for (const o of ovs) if (OC_ABERTA.has(String(o.status || '').toLowerCase())) out.push({ tipo: 'oc', tenant_id: o.tenant_id, fornecedor_id: o.fornecedor_id, id: o.id, numero: o.numero || `#${o.id}` });
  const vistos = new Set(); return out.filter((p) => { const k = `${p.tipo}:${p.id}:${p.fornecedor_id}`; if (vistos.has(k)) return false; vistos.add(k); return true; });
}

// ─── E-mail ──────────────────────────────────────────────────────────────
async function enviar(para, assunto, html) {
  if (!para) return false;
  try { await require('./emailService').enviarEmailCotacao(para, assunto, html); return true; } catch (e) { console.error('⚠️ [monitor cnpj] e-mail:', e.message); return false; }
}
async function gestoresDe(tenantId) {
  try { return (await require('./avisosVencimento').destinatariosDoTenant(tenantId)).gestores || []; } catch { return []; }
}
const caixa = (titulo, corpo) => `<div style="font-family:Arial,sans-serif;max-width:640px;color:#111"><h2 style="font-size:18px">${titulo}</h2>${corpo}<p style="font-size:12px;color:#666;margin-top:24px">QuotaFlow · Monitor de CNPJs — situação cadastral na Receita Federal (BrasilAPI / CNPJ.ws). Confira sempre a certidão antes de pagar.</p></div>`;
const tabela = (linhas, cab) => `<table style="border-collapse:collapse;width:100%;font-size:13px"><tr>${cab.map((c) => `<th style="text-align:left;border-bottom:2px solid #111;padding:4px">${c}</th>`).join('')}</tr>${linhas.map((l) => `<tr>${l.map((c) => `<td style="border-bottom:1px solid #ddd;padding:4px">${c}</td>`).join('')}</tr>`).join('')}</table>`;

/** Mudou para irregular fora do ciclo → avisa na hora os tenants com processo em andamento com esse fornecedor */
async function notificarMudanca(supabase, doc, sit, antes) {
  const fs = await q(supabase.from('fornecedores').select('*').in('cnpj', [doc, fmtCnpj(doc)]));
  if (!fs.length) return 0;
  const procs = await processosAbertos(supabase, fs.map((f) => f.id));
  const porTenant = new Map();
  for (const p of procs) { const k = String(p.tenant_id); if (!porTenant.has(k)) porTenant.set(k, []); porTenant.get(k).push(p); }
  const nome = fs[0].nome_fantasia || fs[0].nome;
  let n = 0;
  for (const [tid, ps] of porTenant) {
    const html = caixa(`⚠ CNPJ irregular em processo em andamento`, `<p>O fornecedor <b>${esc(nome)}</b> (CNPJ ${fmtCnpj(doc)}) passou de <b>${esc(antes || '—')}</b> para <b style="color:#dc2626">${esc(sit)}</b> na Receita.</p>
      <p>Processos seus com ele:</p>${tabela(ps.map((p) => [p.tipo === 'oc' ? 'Ordem de compra' : 'Cotação', esc(p.numero)]), ['Tipo', 'Número'])}
      <p><b>Novas cotações para ele ficam bloqueadas.</b> Para emitir OC ou lançar a nota (pagamento), o sistema pede uma justificativa registrada.</p>`);
    for (const g of await gestoresDe(tid)) if (await enviar(g.email, `⚠ CNPJ irregular: ${nome} (${sit})`, html)) n++;
  }
  return n;
}

// ─── Trava com justificativa (OC / nota) ─────────────────────────────────
/**
 * contexto: 'oc' | 'nota'; referencia: 'cotacao:12' | 'oc:34'; liberacoes: { [fornecedor_id]: justificativa }.
 * → null (pode seguir) ou { status: 409, codigo: 'cnpj_irregular', erro, fornecedores: [...] }
 */
async function exigirLiberacao(supabase, tenantId, quem, { contexto, referencia, fornecedorIds, liberacoes = {} }) {
  let chk; try { chk = await checarFornecedores(supabase, fornecedorIds); } catch (e) { console.error('⚠️ [monitor cnpj] checagem:', e.message); return null; }
  const irr = chk.filter((c) => c.irregular); if (!irr.length) return null;
  let ja = [];
  try { ja = await q(supabase.from('cnpj_liberacoes').select('fornecedor_id, documento').eq('tenant_id', tenantId).eq('contexto', contexto).eq('referencia', String(referencia))); } catch { /* sem a 050: não trava */ return null; }
  const liberadosAntes = new Set(ja.map((l) => String(l.fornecedor_id)));
  const faltam = [];
  for (const f of irr) {
    if (liberadosAntes.has(String(f.fornecedor_id))) continue;
    const just = String(liberacoes?.[f.fornecedor_id] ?? liberacoes?.[String(f.fornecedor_id)] ?? '').trim();
    if (just.length < 15) { faltam.push(f); continue; }
    const { error } = await supabase.from('cnpj_liberacoes').insert([{ tenant_id: tenantId, fornecedor_id: f.fornecedor_id, documento: f.cnpj, situacao: f.situacao, contexto, referencia: String(referencia),
      justificativa: just.slice(0, 1000), usuario_id: quem?.id != null ? String(quem.id) : null, usuario_nome: quem?.nome || null }]);
    if (error) throw new Error(error.message);
  }
  if (!faltam.length) return null;
  return { status: 409, codigo: 'cnpj_irregular', contexto,
    erro: `CNPJ irregular na Receita: ${faltam.map((f) => `${f.nome} (${f.situacao})`).join(', ')}. Para seguir, registre a justificativa (mín. 15 caracteres).`,
    fornecedores: faltam.map((f) => ({ fornecedor_id: f.fornecedor_id, nome: f.nome, cnpj: f.cnpj, situacao: f.situacao, verificado_em: f.verificado_em })) };
}

/** Cotação: devolve { liberados: ids, bloqueados: [...] } e marca cotacao_fornecedores.bloqueado_cnpj */
async function filtrarEnvioCotacao(supabase, tenantId, cotacaoId, fornecedorIds) {
  let chk; try { chk = await checarFornecedores(supabase, fornecedorIds); } catch (e) { console.error('⚠️ [monitor cnpj] checagem:', e.message); return { liberados: fornecedorIds, bloqueados: [] }; }
  const bloq = chk.filter((c) => c.irregular);
  const ids = new Set(bloq.map((b) => String(b.fornecedor_id)));
  if (cotacaoId != null) for (const b of bloq) {
    try { await supabase.from('cotacao_fornecedores').update({ bloqueado_cnpj: `${b.situacao} · ${new Date().toISOString().slice(0, 10)}` }).eq('tenant_id', tenantId).eq('cotacao_id', cotacaoId).eq('fornecedor_id', b.fornecedor_id); } catch { /* ok */ }
  }
  return { liberados: fornecedorIds.filter((id) => !ids.has(String(id))), bloqueados: bloq.map((b) => ({ fornecedor_id: b.fornecedor_id, nome: b.nome, cnpj: b.cnpj, situacao: b.situacao })) };
}

// ─── Ciclo quinzenal ─────────────────────────────────────────────────────
function inicioCiclo(d = new Date()) {
  const br = new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dia = br.getDate() >= 15 ? 15 : 1;
  return `${br.getFullYear()}-${String(br.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
/** Universo: todos os CNPJs de fornecedores (locais, globais, candidatos) e de clientes */
async function universo(supabase) {
  const [fs, cs] = await Promise.all([q(supabase.from('fornecedores').select('id, cnpj')), q(supabase.from('clientes').select('id, documento')).catch(() => [])]);
  return [...new Set([...fs.map((f) => so(f.cnpj)), ...cs.map((c) => so(c.documento))].filter((d) => d.length === 14))];
}
/** Disparo diário (7h): verifica até LOTE pendentes do ciclo; ao chegar a 100%, manda os e-mails do ciclo (uma vez) */
async function rodarCiclo(supabase, { lote = LOTE, pausa = PAUSA_MS, agora = new Date() } = {}) {
  const inicio = inicioCiclo(agora);
  try { await supabase.from('cnpj_monitor_ciclos').upsert({ inicio }, { onConflict: 'inicio', ignoreDuplicates: true }); } catch { /* ok */ }
  const ciclo = (await q(supabase.from('cnpj_monitor_ciclos').select('*').eq('inicio', inicio)))[0];
  const docs = await universo(supabase);
  const mon = new Map((await q(supabase.from('cnpj_monitor').select('documento, verificado_em'))).map((m) => [m.documento, m.verificado_em]));
  const pendentes = docs.filter((d) => !mon.get(d) || String(mon.get(d)).slice(0, 10) < inicio);
  let feitos = 0;
  for (const d of pendentes.slice(0, lote)) { await verificar(supabase, d, { forcar: true }); feitos++; if (pausa) await dormir(pausa); }
  const restam = Math.max(0, pendentes.length - feitos);
  let emails = null;
  if (!restam && ciclo && !ciclo.concluido_em) {
    emails = await emailsDoCiclo(supabase, inicio);
    const irr = (await q(supabase.from('cnpj_monitor').select('documento, situacao'))).filter((m) => docs.includes(m.documento) && irregular(m.situacao)).length;
    await supabase.from('cnpj_monitor_ciclos').update({ concluido_em: new Date().toISOString(), total: docs.length, irregulares: irr, emails }).eq('id', ciclo.id);
  }
  return { ciclo: inicio, total: docs.length, verificados_agora: feitos, restam, emails };
}

/** Painel do tenant: base própria + globais irregulares nos processos dele + justificativas */
async function painelTenant(supabase, tenantId) {
  const [locais, clientes, globaisVinc] = await Promise.all([
    q(supabase.from('fornecedores').select('*').eq('tenant_id', tenantId)).then((r) => r.filter((f) => f.tipo !== 'global')),
    q(supabase.from('clientes').select('*').eq('tenant_id', tenantId)).catch(() => []),
    q(supabase.from('fornecedores').select('*').eq('tipo', 'global')),
  ]);
  const docs = [...new Set([...locais.map((f) => so(f.cnpj)), ...clientes.map((c) => so(c.documento)), ...globaisVinc.map((f) => so(f.cnpj))].filter((d) => d.length === 14))];
  const mon = docs.length ? new Map((await q(supabase.from('cnpj_monitor').select('*').in('documento', docs))).map((m) => [m.documento, m])) : new Map();
  const st = (d) => { const m = mon.get(so(d)); return { situacao: m?.situacao || null, irregular: irregular(m?.situacao), verificado_em: m?.verificado_em || null, mudou_em: m?.mudou_em || null, situacao_anterior: m?.situacao_anterior || null }; };
  const base = [
    ...locais.map((f) => ({ tipo: 'fornecedor', id: f.id, nome: f.nome_fantasia || f.nome, documento: so(f.cnpj) || null, ...st(f.cnpj) })),
    ...clientes.filter((c) => so(c.documento).length === 14).map((c) => ({ tipo: 'cliente', id: c.id, nome: c.nome, documento: so(c.documento), ...st(c.documento) })),
  ].sort((a, b) => (b.irregular - a.irregular) || String(a.nome).localeCompare(String(b.nome)));
  const globIrr = globaisVinc.filter((f) => st(f.cnpj).irregular);
  const procs = globIrr.length ? await processosAbertos(supabase, globIrr.map((f) => f.id), tenantId) : [];
  const globais = globIrr.filter((f) => procs.some((p) => String(p.fornecedor_id) === String(f.id)))
    .map((f) => ({ id: f.id, nome: f.nome_fantasia || f.nome, documento: so(f.cnpj), ...st(f.cnpj), processos: procs.filter((p) => String(p.fornecedor_id) === String(f.id)) }));
  let liberacoes = [];
  try { liberacoes = await q(supabase.from('cnpj_liberacoes').select('*').eq('tenant_id', tenantId).order('criado_em', { ascending: false }).limit(100)); } catch { /* sem a 050 */ }
  const nomes = new Map([...locais, ...globaisVinc].map((f) => [String(f.id), f.nome_fantasia || f.nome]));
  const inicio = inicioCiclo();
  const comDoc = base.filter((b) => b.documento);
  return { ciclo: { inicio, verificados: comDoc.filter((b) => b.verificado_em && String(b.verificado_em).slice(0, 10) >= inicio).length, total: comDoc.length },
    base, globais, liberacoes: liberacoes.map((l) => ({ ...l, fornecedor_nome: nomes.get(String(l.fornecedor_id)) || null })) };
}

async function emailsDoCiclo(supabase, inicio) {
  let n = 0;
  const tenants = await q(supabase.from('tenants').select('*'));
  for (const t of tenants.filter((x) => x.status !== 'inativo' && x.status !== 'cancelado')) {
    try {
      const p = await painelTenant(supabase, t.id);
      if (!p.base.length && !p.globais.length) continue;
      const irr = p.base.filter((b) => b.irregular);
      const titulo = irr.length || p.globais.length ? `⚠ Monitor de CNPJs: ${irr.length + p.globais.length} com situação irregular` : '✓ Monitor de CNPJs: 100% da base verificada';
      let corpo = `<p>Ciclo de ${inicio.split('-').reverse().join('/')}: <b>${p.base.length}</b> CNPJ(s) da sua base verificados na Receita.</p>`;
      corpo += irr.length ? `<p><b>Sua base — situação irregular:</b></p>${tabela(irr.map((b) => [b.tipo === 'cliente' ? 'Cliente' : 'Fornecedor', esc(b.nome), fmtCnpj(b.documento), `<b style="color:#dc2626">${esc(b.situacao)}</b>`]), ['Tipo', 'Nome', 'CNPJ', 'Situação'])}` : '<p>Nenhum CNPJ da sua base com situação irregular.</p>';
      if (p.globais.length) corpo += `<p><b>Fornecedores da plataforma em processos seus:</b></p>${tabela(p.globais.map((g) => [esc(g.nome), fmtCnpj(g.documento), `<b style="color:#dc2626">${esc(g.situacao)}</b>`, g.processos.map((x) => `${x.tipo === 'oc' ? 'OC' : 'Cotação'} ${esc(x.numero)}`).join(', ')]), ['Fornecedor', 'CNPJ', 'Situação', 'Processos'])}`;
      corpo += '<p>Detalhes em <b>🛡 Monitor de CNPJs</b> no QuotaFlow.</p>';
      for (const g of await gestoresDe(t.id)) if (await enviar(g.email, titulo, caixa(titulo, corpo))) n++;
    } catch (e) { console.error(`⚠️ [monitor cnpj] e-mail do tenant ${t.id}:`, e.message); }
  }
  // plataforma
  if (process.env.ADMIN_EMAIL) {
    const pl = await painelPlataforma(supabase);
    const titulo = pl.irregulares.length ? `⚠ Monitor de CNPJs (plataforma): ${pl.irregulares.length} fornecedor(es) irregular(es)` : '✓ Monitor de CNPJs (plataforma): nenhum fornecedor irregular';
    const corpo = pl.irregulares.length ? tabela(pl.irregulares.map((f) => [esc(f.nome), fmtCnpj(f.documento), `<b style="color:#dc2626">${esc(f.situacao)}</b>`, String(f.tenants_com_processo), esc(f.revisao_status || '—')]), ['Fornecedor', 'CNPJ', 'Situação', 'Tenants c/ processo', 'Revisão']) + '<p>Revise no Console → 🛡 CNPJs.</p>' : '<p>Todos os fornecedores da plataforma estão ATIVOS na Receita.</p>';
    if (await enviar(process.env.ADMIN_EMAIL, titulo, caixa(titulo, corpo))) n++;
  }
  return n;
}

// ─── Plataforma (Console) ────────────────────────────────────────────────
async function painelPlataforma(supabase) {
  const fs = (await q(supabase.from('fornecedores').select('*'))).filter((f) => ['global', 'candidato'].includes(f.tipo));
  const docs = [...new Set(fs.map((f) => so(f.cnpj)).filter((d) => d.length === 14))];
  const mon = docs.length ? new Map((await q(supabase.from('cnpj_monitor').select('*').in('documento', docs))).map((m) => [m.documento, m])) : new Map();
  const irr = fs.filter((f) => irregular(mon.get(so(f.cnpj))?.situacao));
  const procs = irr.length ? await processosAbertos(supabase, irr.map((f) => f.id)) : [];
  const verificados = docs.filter((d) => mon.get(d)?.verificado_em).length;
  return {
    ciclo: inicioCiclo(), total: docs.length, verificados,
    ultimo_ciclo: (await q(supabase.from('cnpj_monitor_ciclos').select('*').order('inicio', { ascending: false }).limit(3)).catch(() => [])),
    irregulares: irr.map((f) => { const m = mon.get(so(f.cnpj)) || {}; const ps = procs.filter((p) => String(p.fornecedor_id) === String(f.id));
      return { id: f.id, nome: f.nome_fantasia || f.nome, documento: so(f.cnpj), tipo: f.tipo, ativo: f.ativo !== false && f.ativo !== 0, situacao: m.situacao, situacao_anterior: m.situacao_anterior, mudou_em: m.mudou_em, verificado_em: m.verificado_em,
        revisao_status: m.revisao_status || null, revisao_nota: m.revisao_nota || null, revisao_por: m.revisao_por || null, revisao_em: m.revisao_em || null,
        tenants_com_processo: new Set(ps.map((p) => String(p.tenant_id))).size, processos: ps.length }; })
      .sort((a, b) => b.tenants_com_processo - a.tenants_com_processo || String(a.nome).localeCompare(String(b.nome))),
  };
}
/** acao: revisar (nota) | suspender (some para todos os tenants: ativo=false) | reativar */
async function revisarPlataforma(supabase, fornecedorId, admin, { acao, nota } = {}) {
  const f = (await q(supabase.from('fornecedores').select('*').eq('id', fornecedorId)))[0]; if (!f) return { status: 404, erro: 'Fornecedor não encontrado' };
  const doc = so(f.cnpj); if (doc.length !== 14) return { status: 400, erro: 'Fornecedor sem CNPJ' };
  const txt = String(nota || '').trim();
  if (!['revisar', 'suspender', 'reativar'].includes(acao)) return { status: 400, erro: 'Ação inválida' };
  if (acao !== 'reativar' && txt.length < 10) return { status: 400, erro: 'Escreva a nota (mínimo 10 caracteres) — fica registrada' };
  if (acao === 'suspender') await supabase.from('fornecedores').update({ ativo: false }).eq('id', f.id);
  if (acao === 'reativar') await supabase.from('fornecedores').update({ ativo: true }).eq('id', f.id);
  const { error } = await supabase.from('cnpj_monitor').upsert({ documento: doc, revisao_status: { revisar: 'revisado', suspender: 'suspenso', reativar: 'revisado' }[acao], revisao_nota: txt || 'reativado', revisao_por: admin?.email || 'plataforma', revisao_em: new Date().toISOString() });
  if (error) { if (/relation|schema cache/i.test(error.message)) return { status: 409, erro: 'Rode a migration 050 antes' }; throw new Error(error.message); }
  return { ok: true };
}

module.exports = { irregular, inicioCiclo, verificar, checarFornecedores, processosAbertos, exigirLiberacao, filtrarEnvioCotacao, rodarCiclo, painelTenant, painelPlataforma, revisarPlataforma, notificarMudanca, emailsDoCiclo };
