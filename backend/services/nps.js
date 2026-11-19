// services/nps.js — etapa N1: ⭐ NPS — pesquisa de satisfação do cliente
//   • Nasce sozinha quando um pedido (PV) fica CONCLUÍDO (gatilho em pedidosVenda/execucoes) — uma por pedido; ou manual (qualquer cliente).
//   • Com e-mail do contato: envia o link na hora. Sem e-mail: fica "pendente" com o link para copiar (WhatsApp etc.).
//   • Link público #nps?t=TOKEN (sem login): nota 0–10, o que pesou (motivos) e comentário. Vale 60 dias; responde uma vez.
//   • NPS = % promotores (9–10) − % detratores (0–6). Detrator → aviso ao gestor e TAREFA (tipo CM, alta, 3 dias) para tratar.
//   • Entrada "satisfação do cliente" da Análise Crítica (ISO 9001, 9.3) e do S do ESG.
const crypto = require('crypto');
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const novoToken = () => crypto.randomBytes(24).toString('hex');
const base = () => String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/^FRONTEND_URL=/, '').replace(/\/+$/, '');
const linkDe = (token) => `${base()}/#nps?t=${token}`;
const DIAS = 60;
const MOTIVOS = { prazo: 'Prazo / pontualidade', atendimento: 'Atendimento / comunicação', qualidade: 'Qualidade do serviço', equipamento: 'Equipamento / veículo', seguranca: 'Segurança', preco: 'Preço', documentacao: 'Documentação' };
const classe = (n) => (n == null ? null : n >= 9 ? 'promotor' : n >= 7 ? 'neutro' : 'detrator');
let enviarEmail = async (para, assunto, html) => require('./emailService').enviarEmailFornecedor(para, assunto, html);
function _definirEnvio(fn) { enviarEmail = fn; }

async function empresa(sb, tenantId) { return (await q(sb.from('tenants').select('*').eq('id', tenantId)))[0] || {}; }
const nomeEmp = (e) => e.nome_fantasia || e.razao_social || e.nome || '';
function html(emp, p) {
  const url = linkDe(p.token); const n = nomeEmp(emp);
  const notas = Array.from({ length: 11 }, (_, i) => `<a href="${url}&n=${i}" style="display:inline-block;width:30px;line-height:30px;margin:2px;border-radius:5px;text-align:center;text-decoration:none;font-weight:700;color:#fff;background:${i <= 6 ? '#ef4444' : i <= 8 ? '#f59e0b' : '#22c55e'}">${i}</a>`).join('');
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#111;font-size:14px;line-height:1.55">
  <div style="font-weight:700;font-size:15px;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:14px">${esc(n)}</div>
  <p>Olá${p.contato_nome ? `, ${esc(p.contato_nome)}` : ''}!</p>
  <p>Concluímos ${p.origem_ref ? `o serviço <b>${esc(p.origem_ref)}</b>` : 'um serviço para vocês'}. Leva 30 segundos: <b>de 0 a 10, quanto você recomendaria a ${esc(n)} a um colega ou parceiro?</b></p>
  <div style="margin:16px 0">${notas}</div>
  <p style="font-size:12px;color:#666">0 = nada provável · 10 = com certeza. Se os números não abrirem, use: <a href="${url}" style="color:#2563eb;word-break:break-all">${esc(url)}</a></p>
  <div style="color:#888;font-size:11px;margin-top:24px">Enviado pelo QuotaFlow em nome de ${esc(n)}.</div></div>`;
}
async function mandar(sb, tenantId, p) {
  if (!p.email || !EMAIL.test(p.email)) return 'Sem e-mail do contato — copie o link e mande por WhatsApp ou outro canal.';
  try { await enviarEmail(p.email, `Como foi o nosso serviço? — ${nomeEmp(await empresa(sb, tenantId))}`, html(await empresa(sb, tenantId), p)); }
  catch (e) { console.error('⚠️ [nps] e-mail não enviado:', p.email, e?.message || e); return `O e-mail para ${p.email} não foi enviado (${e?.message || 'falha'}). Copie o link e mande por outro canal.`; }
  await sb.from('nps_pesquisas').update({ status: 'enviada', enviada_em: new Date().toISOString() }).eq('id', p.id).eq('tenant_id', tenantId); return null;
}
async function proximoNumero(sb, tenantId) {
  const ano = new Date().getFullYear(); const l = await q(sb.from('nps_pesquisas').select('*').eq('tenant_id', tenantId));
  const n = l.filter((x) => String(x.numero || '').startsWith(`NPS-${ano}-`)).length + 1; return `NPS-${ano}-${String(n).padStart(4, '0')}`;
}
async function criar(sb, tenantId, quem, d = {}) {
  const email = d.email ? String(d.email).trim().slice(0, 200) : null; if (email && !EMAIL.test(email)) return { status: 400, erro: 'E-mail inválido.' };
  const cliente = String(d.cliente_nome || '').trim().slice(0, 200); if (!cliente) return { status: 400, erro: 'Informe o cliente.' };
  const linha = { tenant_id: tenantId, numero: await proximoNumero(sb, tenantId), origem_tipo: d.origem_tipo === 'pv' ? 'pv' : 'manual', origem_id: d.origem_id != null ? String(d.origem_id) : null, origem_ref: d.origem_ref ? String(d.origem_ref).slice(0, 200) : null,
    cliente_id: d.cliente_id != null ? String(d.cliente_id) : null, cliente_nome: cliente, contato_nome: d.contato_nome ? String(d.contato_nome).slice(0, 120) : null, email, token: novoToken(), status: 'pendente',
    expira_em: new Date(Date.now() + DIAS * 864e5).toISOString(), motivos: [], criado_por: quem?.nome || null, criado_em: new Date().toISOString() };
  const p = (await q(sb.from('nps_pesquisas').insert([linha]).select()))[0];
  const aviso = d.enviar === false ? null : await mandar(sb, tenantId, p);
  return { pesquisa: { ...p, status: aviso ? p.status : 'enviada', link: linkDe(p.token) }, aviso };
}
/** gatilho: pedido concluído → pesquisa (uma por PV). Nunca derruba o fluxo do pedido. */
async function aoConcluirPV(sb, tenantId, pv) {
  try {
    if (!pv?.id) return null;
    const ja = (await q(sb.from('nps_pesquisas').select('*').eq('tenant_id', tenantId).eq('origem_tipo', 'pv').eq('origem_id', String(pv.id))))[0]; if (ja) return null;
    const r = await criar(sb, tenantId, { nome: 'automático' }, { origem_tipo: 'pv', origem_id: pv.id, origem_ref: [pv.numero, pv.titulo].filter(Boolean).join(' — '), cliente_id: pv.cliente_id, cliente_nome: pv.cliente_nome || 'Cliente', contato_nome: pv.contato_nome, email: pv.contato_email && EMAIL.test(pv.contato_email) ? pv.contato_email : null });
    console.log(`⭐ [nps] pesquisa ${r.pesquisa?.numero} criada para o pedido ${pv.numero}${r.aviso ? ` (${r.aviso})` : ' e enviada'}`); return r;
  } catch (e) { console.error('⚠️ [nps] não criei a pesquisa do pedido:', e.message); return null; }
}
async function reenviar(sb, tenantId, id, { email } = {}) {
  const p = (await q(sb.from('nps_pesquisas').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!p) return { status: 404, erro: 'Pesquisa não encontrada.' };
  if (p.status === 'respondida') return { status: 409, erro: 'Esta pesquisa já foi respondida.' };
  if (email != null) { if (!EMAIL.test(String(email).trim())) return { status: 400, erro: 'E-mail inválido.' }; p.email = String(email).trim(); await sb.from('nps_pesquisas').update({ email: p.email, expira_em: new Date(Date.now() + DIAS * 864e5).toISOString() }).eq('id', p.id).eq('tenant_id', tenantId); }
  const aviso = await mandar(sb, tenantId, p); return aviso ? { status: 409, erro: aviso } : { ok: true };
}
async function cancelar(sb, tenantId, id) {
  const p = (await q(sb.from('nps_pesquisas').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!p) return { status: 404, erro: 'Pesquisa não encontrada.' };
  if (p.status === 'respondida') return { status: 409, erro: 'Pesquisa respondida não é cancelada.' };
  await sb.from('nps_pesquisas').update({ status: 'cancelada' }).eq('id', p.id).eq('tenant_id', tenantId); return { ok: true };
}

/** painel: NPS do período, por mês (12), motivos, lista */
async function painel(sb, tenantId, { de, ate } = {}) {
  const l = (await q(sb.from('nps_pesquisas').select('*').eq('tenant_id', tenantId))).sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
  const dia = (x) => String(x || '').slice(0, 10); const noP = (x) => (!de || dia(x) >= de) && (!ate || dia(x) <= ate);
  const resp = l.filter((p) => p.status === 'respondida' && noP(p.respondida_em));
  const conta = (arr) => { const pr = arr.filter((p) => p.nota >= 9).length; const de_ = arr.filter((p) => p.nota <= 6).length; const ne = arr.length - pr - de_; return { respostas: arr.length, promotores: pr, neutros: ne, detratores: de_, nps: arr.length ? Math.round(((pr - de_) / arr.length) * 100) : null }; };
  const enviadas = l.filter((p) => p.status !== 'cancelada' && noP(p.criado_em));
  const meses = []; { const a = (ate || new Date().toISOString()).slice(0, 7); let [y, m] = a.split('-').map(Number); for (let i = 0; i < 12; i++) { meses.unshift(`${y}-${String(m).padStart(2, '0')}`); m--; if (!m) { m = 12; y--; } } }
  const todosResp = l.filter((p) => p.status === 'respondida');
  const motivos = {}; for (const p of resp) for (const k of p.motivos || []) { motivos[k] = motivos[k] || { chave: k, nome: MOTIVOS[k] || k, total: 0, detratores: 0, promotores: 0 }; motivos[k].total++; if (p.nota <= 6) motivos[k].detratores++; if (p.nota >= 9) motivos[k].promotores++; }
  return { ...conta(resp), taxa_resposta: enviadas.length ? Math.round((enviadas.filter((p) => p.status === 'respondida').length / enviadas.length) * 100) : null, enviadas: enviadas.length,
    por_mes: meses.map((m) => ({ mes: m, ...conta(todosResp.filter((p) => String(p.respondida_em).slice(0, 7) === m)) })),
    motivos: Object.values(motivos).sort((a, b) => b.total - a.total), MOTIVOS,
    pesquisas: l.slice(0, 300).map((p) => ({ ...p, token: undefined, link: p.status === 'respondida' || p.status === 'cancelada' ? null : linkDe(p.token), classe: classe(p.nota) })) };
}

// ─── link público ───────────────────────────────────────────────────────────
async function porToken(sb, token) { if (!/^[a-f0-9]{48}$/.test(String(token || ''))) return null; return (await q(sb.from('nps_pesquisas').select('*').eq('token', token)))[0] || null; }
async function publico(sb, p) {
  const e = await empresa(sb, p.tenant_id); let logo = null; try { logo = e.logo_url || null; } catch { /* ok */ }
  if (!p.aberta_em) await sb.from('nps_pesquisas').update({ aberta_em: new Date().toISOString() }).eq('id', p.id);
  const vencida = p.status !== 'respondida' && p.expira_em && Date.parse(p.expira_em) < Date.now();
  return { empresa: nomeEmp(e), logo, cliente: p.cliente_nome, contato: p.contato_nome, referencia: p.origem_ref, status: p.status === 'cancelada' || vencida ? 'encerrada' : p.status, nota: p.status === 'respondida' ? p.nota : null, MOTIVOS };
}
async function responder(sb, p, d = {}) {
  if (p.status === 'respondida') return { status: 409, erro: 'Esta pesquisa já foi respondida. Obrigado!' };
  if (p.status === 'cancelada' || (p.expira_em && Date.parse(p.expira_em) < Date.now())) return { status: 410, erro: 'Esta pesquisa foi encerrada.' };
  const nota = Number(d.nota); if (!Number.isInteger(nota) || nota < 0 || nota > 10) return { status: 400, erro: 'Escolha uma nota de 0 a 10.' };
  const motivos = [...new Set((Array.isArray(d.motivos) ? d.motivos : []).filter((k) => MOTIVOS[k]))].slice(0, 7);
  const up = { status: 'respondida', nota, motivos, comentario: d.comentario ? String(d.comentario).trim().slice(0, 2000) : null, respondente: d.nome ? String(d.nome).trim().slice(0, 120) : null, respondida_em: new Date().toISOString() };
  const r = await q(sb.from('nps_pesquisas').update(up).eq('id', p.id).neq('status', 'respondida').select()); if (!r.length) return { status: 409, erro: 'Esta pesquisa já foi respondida. Obrigado!' };
  if (nota <= 6) await tratarDetrator(sb, { ...p, ...up });
  return { ok: true, classe: classe(nota) };
}
async function tratarDetrator(sb, p) {
  try {
    const T = require('./tarefas'); const prazo = new Date(Date.now() + 3 * 864e5 - 3 * 3600e3).toISOString().slice(0, 10);
    const mot = (p.motivos || []).map((k) => MOTIVOS[k]).join(', ');
    const t = await T.criar(sb, p.tenant_id, { nome: 'NPS' }, { tipo: 'CM', titulo: `Tratar cliente insatisfeito — ${p.cliente_nome} deu nota ${p.nota} (${p.numero})`, prioridade: 'alta', prazo, responsavel: 'Gestão',
      detalhe: `Pesquisa ${p.numero}${p.origem_ref ? ` · ${p.origem_ref}` : ''}\nNota: ${p.nota}/10${mot ? `\nO que pesou: ${mot}` : ''}${p.comentario ? `\nComentário: "${p.comentario}"` : ''}${p.respondente ? `\nRespondeu: ${p.respondente}` : ''}\n\nLigue para o cliente, entenda o que houve e registre a ação. Se for falha do processo, abra uma NC.` });
    if (t?.tarefa?.id || t?.id) await sb.from('nps_pesquisas').update({ tarefa_id: String(t?.tarefa?.id || t?.id) }).eq('id', p.id);
    await require('./notificacoes').avisarPerfis(sb, p.tenant_id, ['gestor'], { tipo: 'nps', titulo: `⭐ ${p.cliente_nome} deu nota ${p.nota} no NPS`, texto: p.comentario ? `"${String(p.comentario).slice(0, 140)}"` : 'Cliente insatisfeito — tarefa criada para tratar.', link: { tela: 'nps' }, chave: `nps:${p.id}` });
  } catch (e) { console.error('⚠️ [nps] detrator sem tarefa/aviso:', e.message); }
}

module.exports = { MOTIVOS, classe, criar, aoConcluirPV, reenviar, cancelar, painel, porToken, publico, responder, linkDe, _definirEnvio };
