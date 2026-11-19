// services/nps.js — etapa N1: ⭐ NPS — pesquisa de satisfação do cliente
//   • Nasce sozinha quando um pedido (PV) fica CONCLUÍDO (gatilho em pedidosVenda/execucoes) — uma por pedido; ou manual (qualquer cliente).
//   • Com e-mail do contato: envia o link na hora. Sem e-mail: fica "pendente" com o link para copiar (WhatsApp etc.).
//   • Link público #nps?t=TOKEN (sem login): nota 0–10, o que pesou (motivos) e comentário. Vale 60 dias; responde uma vez.
//   • NPS = % promotores (9–10) − % detratores (0–6). Detrator → aviso ao gestor e TAREFA (tipo CM, alta, 3 dias) para tratar.
//   • Entrada "satisfação do cliente" da Análise Crítica (ISO 9001, 9.3) e do S do ESG.
//   N1.1: MODELOS por empresa (⚙ Modelos): perguntas extras (estrelas 1–5, sim/não, escolha, texto) e itens de pontos 👍 "o que foi bem"
//   / 👎 "o que pode melhorar" (liga/desliga). A pergunta 0–10 é fixa (o NPS continua comparável). A pesquisa guarda uma CÓPIA do modelo
//   no envio (config) — editar o modelo não muda as já enviadas. "Padrão QuotaFlow" = modelo virtual (sem linha no banco).
//   Leitura: cada abertura do link conta (aberturas, ultima_abertura_em); 1ª = aberta_em → "👁 lida".
const crypto = require('crypto');
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const novoToken = () => crypto.randomBytes(24).toString('hex');
const base = () => String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/^FRONTEND_URL=/, '').replace(/\/+$/, '');
const linkDe = (token) => `${base()}/#nps?t=${token}`;
const DIAS = 60;
const MOTIVOS = { prazo: 'Prazo / pontualidade', atendimento: 'Atendimento / comunicação', qualidade: 'Qualidade do serviço', equipamento: 'Equipamento / veículo', seguranca: 'Segurança', preco: 'Preço', documentacao: 'Documentação' };
const TIPOS = { estrelas: 'Nota de 1 a 5 estrelas', sim_nao: 'Sim ou não', escolha: 'Múltipla escolha', texto: 'Texto livre' };
const ITENS_PADRAO = Object.entries(MOTIVOS).map(([chave, nome]) => ({ chave, nome }));
const PADRAO = { id: null, nome: 'Padrão QuotaFlow', descricao: 'Nota 0–10, pontos positivos e negativos e comentário.', padrao: true, pontos: true, itens_pontos: ITENS_PADRAO, perguntas: [], virtual: true };
const slug = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
const semTabela = (m) => /nps_modelos|config|respostas|pontos_|aberturas|modelo_id|does not exist|schema cache|column/.test(String(m || ''));
function limparModelo(d = {}) {
  const nome = String(d.nome || '').trim().slice(0, 80); if (!nome) return { erro: 'Dê um nome ao modelo.' };
  const itens = []; const vistos = new Set(); for (const x of Array.isArray(d.itens_pontos) ? d.itens_pontos : []) { const n = String(x?.nome ?? x ?? '').trim().slice(0, 60); const k = String(x?.chave || slug(n)); if (!n || !k || vistos.has(k)) continue; vistos.add(k); itens.push({ chave: k, nome: n }); if (itens.length >= 15) break; }
  const pergs = []; const ids = new Set();
  for (const x of Array.isArray(d.perguntas) ? d.perguntas : []) {
    const texto = String(x?.texto || '').trim().slice(0, 200); const tipo = TIPOS[x?.tipo] ? x.tipo : null; if (!texto || !tipo) continue;
    let id = String(x.id || `p${pergs.length + 1}`).replace(/[^a-z0-9_]/gi, '').slice(0, 20) || `p${pergs.length + 1}`; while (ids.has(id)) id += 'x'; ids.add(id);
    const opcoes = tipo === 'escolha' ? [...new Set((Array.isArray(x.opcoes) ? x.opcoes : String(x.opcoes || '').split(/[,;\n]/)).map((o) => String(o).trim().slice(0, 60)).filter(Boolean))].slice(0, 10) : [];
    if (tipo === 'escolha' && opcoes.length < 2) return { erro: `A pergunta "${texto}" precisa de pelo menos 2 opções.` };
    pergs.push({ id, tipo, texto, opcoes, multipla: tipo === 'escolha' && !!x.multipla, obrigatoria: !!x.obrigatoria }); if (pergs.length >= 8) break;
  }
  if (d.pontos !== false && !itens.length) return { erro: 'Com pontos positivos e negativos ligados, inclua pelo menos um item.' };
  return { linha: { nome, descricao: d.descricao ? String(d.descricao).trim().slice(0, 300) : null, pontos: d.pontos !== false, itens_pontos: itens, perguntas: pergs } };
}
async function modelos(sb, tenantId) {
  let l = []; try { l = (await q(sb.from('nps_modelos').select('*').eq('tenant_id', tenantId))).filter((m) => m.ativo !== false); } catch (e) { if (!semTabela(e.message)) throw e; }
  const temPadrao = l.some((m) => m.padrao);
  return [{ ...PADRAO, padrao: !temPadrao }, ...l.sort((a, b) => String(a.nome).localeCompare(String(b.nome)))];
}
async function salvarModelo(sb, tenantId, id, d = {}) {
  const r = limparModelo(d); if (r.erro) return { status: 400, erro: r.erro };
  const agora = new Date().toISOString();
  if (id) { const x = await q(sb.from('nps_modelos').update({ ...r.linha, atualizado_em: agora }).eq('tenant_id', tenantId).eq('id', id).select()); if (!x.length) return { status: 404, erro: 'Modelo não encontrado.' }; return { modelo: x[0] }; }
  const x = await q(sb.from('nps_modelos').insert([{ tenant_id: tenantId, ...r.linha, padrao: false, ativo: true, criado_em: agora, atualizado_em: agora }]).select()); return { modelo: x[0] };
}
async function excluirModelo(sb, tenantId, id) { await q(sb.from('nps_modelos').update({ ativo: false, padrao: false }).eq('tenant_id', tenantId).eq('id', id).select()); return { ok: true }; }
/** id null/'padrao' = volta para o Padrão QuotaFlow */
async function definirPadrao(sb, tenantId, id) {
  const l = (await modelos(sb, tenantId)).filter((m) => !m.virtual);
  for (const m of l.filter((x) => x.padrao && String(x.id) !== String(id))) await q(sb.from('nps_modelos').update({ padrao: false }).eq('tenant_id', tenantId).eq('id', m.id).select());
  if (id && id !== 'padrao') { if (!l.some((m) => String(m.id) === String(id))) return { status: 404, erro: 'Modelo não encontrado.' }; await q(sb.from('nps_modelos').update({ padrao: true }).eq('tenant_id', tenantId).eq('id', id).select()); }
  return { ok: true };
}
async function modeloPara(sb, tenantId, modeloId) {
  const l = await modelos(sb, tenantId); const m = (modeloId && modeloId !== 'padrao' && l.find((x) => String(x.id) === String(modeloId))) || l.find((x) => x.padrao) || l[0];
  return { id: m.virtual ? null : m.id, nome: m.nome, config: { pontos: m.pontos !== false, itens_pontos: m.itens_pontos || [], perguntas: m.perguntas || [] } };
}
const configDe = (p) => (p.config && typeof p.config === 'object' ? p.config : { pontos: true, itens_pontos: ITENS_PADRAO, perguntas: [] });

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
  const mod = await modeloPara(sb, tenantId, d.modelo_id); const comModelo = { ...linha, modelo_id: mod.id, modelo_nome: mod.nome, config: mod.config };
  let p; try { p = (await q(sb.from('nps_pesquisas').insert([comModelo]).select()))[0]; } catch (e) { if (!semTabela(e.message)) throw e; p = (await q(sb.from('nps_pesquisas').insert([linha]).select()))[0]; } // sem a 113: pesquisa padrão
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
  const motivos = {}; const nomeItem = (p, k) => (configDe(p).itens_pontos || []).find((x) => x.chave === k)?.nome || MOTIVOS[k] || k;
  const add = (p, k, campo) => { motivos[k] = motivos[k] || { chave: k, nome: nomeItem(p, k), total: 0, elogios: 0, reclamacoes: 0, detratores: 0, promotores: 0 }; motivos[k].total++; motivos[k][campo]++; if (p.nota <= 6) motivos[k].detratores++; if (p.nota >= 9) motivos[k].promotores++; };
  for (const p of resp) {
    const pos = p.pontos_positivos || []; const neg = p.pontos_negativos || [];
    if (pos.length || neg.length) { pos.forEach((k) => add(p, k, 'elogios')); neg.forEach((k) => add(p, k, 'reclamacoes')); }
    else for (const k of p.motivos || []) add(p, k, p.nota >= 7 ? 'elogios' : 'reclamacoes'); // N1: antes dos pontos, o motivo seguia a nota
  }
  // N1.1: perguntas extras — agrupadas por modelo + pergunta
  const pergs = new Map();
  for (const p of resp) for (const pg of configDe(p).perguntas || []) {
    const k = `${p.modelo_nome || 'Padrão QuotaFlow'}|${pg.id}|${pg.texto}`; const x = pergs.get(k) || { modelo: p.modelo_nome || 'Padrão QuotaFlow', id: pg.id, texto: pg.texto, tipo: pg.tipo, opcoes: pg.opcoes || [], respostas: 0, soma: 0, sim: 0, contagem: {}, textos: [] };
    const v = (p.respostas || {})[pg.id]; if (v == null) { pergs.set(k, x); continue; } x.respostas++;
    if (pg.tipo === 'estrelas') x.soma += Number(v) || 0; else if (pg.tipo === 'sim_nao') { if (v === 'sim') x.sim++; } else if (pg.tipo === 'escolha') for (const o of Array.isArray(v) ? v : [v]) x.contagem[o] = (x.contagem[o] || 0) + 1; else if (x.textos.length < 8) x.textos.push({ texto: v, cliente: p.cliente_nome, nota: p.nota });
    pergs.set(k, x);
  }
  const perguntas = [...pergs.values()].map(({ soma, sim, ...x }) => ({ ...x, media: x.tipo === 'estrelas' && x.respostas ? Math.round((soma / x.respostas) * 10) / 10 : null, sim_pct: x.tipo === 'sim_nao' && x.respostas ? Math.round((sim / x.respostas) * 100) : null }));
  return { ...conta(resp), taxa_resposta: enviadas.length ? Math.round((enviadas.filter((p) => p.status === 'respondida').length / enviadas.length) * 100) : null, enviadas: enviadas.length,
    por_mes: meses.map((m) => ({ mes: m, ...conta(todosResp.filter((p) => String(p.respondida_em).slice(0, 7) === m)) })),
    motivos: Object.values(motivos).sort((a, b) => b.total - a.total), MOTIVOS, perguntas, lidas_sem_resposta: l.filter((p) => ['pendente', 'enviada'].includes(p.status) && p.aberta_em).length,
    pesquisas: l.slice(0, 300).map((p) => ({ ...p, token: undefined, link: p.status === 'respondida' || p.status === 'cancelada' ? null : linkDe(p.token), classe: classe(p.nota) })) };
}

// ─── link público ───────────────────────────────────────────────────────────
async function porToken(sb, token) { if (!/^[a-f0-9]{48}$/.test(String(token || ''))) return null; return (await q(sb.from('nps_pesquisas').select('*').eq('token', token)))[0] || null; }
async function publico(sb, p) {
  const e = await empresa(sb, p.tenant_id); let logo = null; try { logo = e.logo_url || null; } catch { /* ok */ }
  if (p.status !== 'respondida') { const agora = new Date().toISOString(); const up = { aberta_em: p.aberta_em || agora, aberturas: (Number(p.aberturas) || 0) + 1, ultima_abertura_em: agora };
    const r = await sb.from('nps_pesquisas').update(up).eq('id', p.id); if (r?.error && semTabela(r.error.message) && !p.aberta_em) await sb.from('nps_pesquisas').update({ aberta_em: agora }).eq('id', p.id); }
  const vencida = p.status !== 'respondida' && p.expira_em && Date.parse(p.expira_em) < Date.now();
  const cfg = configDe(p); return { empresa: nomeEmp(e), logo, cliente: p.cliente_nome, contato: p.contato_nome, referencia: p.origem_ref, status: p.status === 'cancelada' || vencida ? 'encerrada' : p.status, nota: p.status === 'respondida' ? p.nota : null, MOTIVOS, pontos: cfg.pontos !== false, itens_pontos: cfg.itens_pontos || [], perguntas: cfg.perguntas || [] };
}
async function responder(sb, p, d = {}) {
  if (p.status === 'respondida') return { status: 409, erro: 'Esta pesquisa já foi respondida. Obrigado!' };
  if (p.status === 'cancelada' || (p.expira_em && Date.parse(p.expira_em) < Date.now())) return { status: 410, erro: 'Esta pesquisa foi encerrada.' };
  const nota = Number(d.nota); if (!Number.isInteger(nota) || nota < 0 || nota > 10) return { status: 400, erro: 'Escolha uma nota de 0 a 10.' };
  const cfg = configDe(p); const validos = new Set((cfg.itens_pontos || []).map((x) => x.chave)); const lim = (arr) => [...new Set((Array.isArray(arr) ? arr : []).map(String).filter((k) => validos.has(k)))].slice(0, 15);
  const pos = cfg.pontos !== false ? lim(d.pontos_positivos) : []; const neg = cfg.pontos !== false ? lim(d.pontos_negativos) : [];
  const legado = [...new Set((Array.isArray(d.motivos) ? d.motivos : []).filter((k) => MOTIVOS[k]))].slice(0, 7);
  const respostas = {}; for (const pg of cfg.perguntas || []) {
    const v = d.respostas?.[pg.id]; let ok = null;
    if (pg.tipo === 'estrelas') { const n = Number(v); if (Number.isInteger(n) && n >= 1 && n <= 5) ok = n; }
    else if (pg.tipo === 'sim_nao') { if (v === true || v === 'sim') ok = 'sim'; else if (v === false || v === 'nao') ok = 'nao'; }
    else if (pg.tipo === 'escolha') { const vs = (Array.isArray(v) ? v : [v]).map(String).filter((o) => pg.opcoes.includes(o)); if (vs.length) ok = pg.multipla ? [...new Set(vs)] : vs[0]; }
    else if (pg.tipo === 'texto') { const s = String(v || '').trim().slice(0, 1000); if (s) ok = s; }
    if (ok == null && pg.obrigatoria) return { status: 400, erro: `Responda: "${pg.texto}"` }; if (ok != null) respostas[pg.id] = ok;
  }
  const motivos = pos.length || neg.length ? [...new Set([...neg, ...pos])] : legado;
  const extra = 'respostas' in p || p.config ? { respostas, pontos_positivos: pos, pontos_negativos: neg } : {}; // sem a 113 as colunas não existem
  const up = { status: 'respondida', nota, motivos, ...extra, comentario: d.comentario ? String(d.comentario).trim().slice(0, 2000) : null, respondente: d.nome ? String(d.nome).trim().slice(0, 120) : null, respondida_em: new Date().toISOString() };
  const r = await q(sb.from('nps_pesquisas').update(up).eq('id', p.id).neq('status', 'respondida').select()); if (!r.length) return { status: 409, erro: 'Esta pesquisa já foi respondida. Obrigado!' };
  if (nota <= 6) await tratarDetrator(sb, { ...p, ...up, motivos: neg.length ? neg : motivos });
  return { ok: true, classe: classe(nota) };
}
async function tratarDetrator(sb, p) {
  try {
    const T = require('./tarefas'); const prazo = new Date(Date.now() + 3 * 864e5 - 3 * 3600e3).toISOString().slice(0, 10);
    const nomes = Object.fromEntries((configDe(p).itens_pontos || []).map((x) => [x.chave, x.nome])); const mot = (p.motivos || []).map((k) => nomes[k] || MOTIVOS[k] || k).join(', ');
    const t = await T.criar(sb, p.tenant_id, { nome: 'NPS' }, { tipo: 'CM', titulo: `Tratar cliente insatisfeito — ${p.cliente_nome} deu nota ${p.nota} (${p.numero})`, prioridade: 'alta', prazo, responsavel: 'Gestão',
      detalhe: `Pesquisa ${p.numero}${p.origem_ref ? ` · ${p.origem_ref}` : ''}\nNota: ${p.nota}/10${mot ? `\nO que pesou: ${mot}` : ''}${p.comentario ? `\nComentário: "${p.comentario}"` : ''}${p.respondente ? `\nRespondeu: ${p.respondente}` : ''}\n\nLigue para o cliente, entenda o que houve e registre a ação. Se for falha do processo, abra uma NC.` });
    if (t?.tarefa?.id || t?.id) await sb.from('nps_pesquisas').update({ tarefa_id: String(t?.tarefa?.id || t?.id) }).eq('id', p.id);
    await require('./notificacoes').avisarPerfis(sb, p.tenant_id, ['gestor'], { tipo: 'nps', titulo: `⭐ ${p.cliente_nome} deu nota ${p.nota} no NPS`, texto: p.comentario ? `"${String(p.comentario).slice(0, 140)}"` : 'Cliente insatisfeito — tarefa criada para tratar.', link: { tela: 'nps' }, chave: `nps:${p.id}` });
  } catch (e) { console.error('⚠️ [nps] detrator sem tarefa/aviso:', e.message); }
}

module.exports = { TIPOS, PADRAO, modelos, salvarModelo, excluirModelo, definirPadrao, limparModelo, MOTIVOS, classe, criar, aoConcluirPV, reenviar, cancelar, painel, porToken, publico, responder, linkDe, _definirEnvio };
