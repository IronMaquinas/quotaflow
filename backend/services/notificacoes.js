// backend/services/notificacoes.js — etapa 18n: 🔔 Central de Notificações
//
// Um lugar só para avisar as pessoas. Cada evento do sistema vira uma linha em `notificacoes` (migration 074):
//   • NA TELA (todos os planos): o 🔔 do sistema e do portal do fornecedor mostra na hora (espera longa, como a conversa).
//   • NO CELULAR (premium — módulo "🔔 Notificações no celular", em breve: Telegram, depois app/PWA): só o que passa na
//     REGRA CONTRA EXCESSO abaixo. Nesta etapa o canal ainda não está ligado: a regra roda e marca o que SAIRIA
//     (push_status 'registrada'), para conferir o comportamento antes de ligar o Telegram.
//
// Regra contra excesso (inspirada no Alibaba — avisar sem incomodar):
//   1. Só sai se continuar SEM LER depois de um tempo: 10 min na 1ª mensagem de uma conversa nova, 60 min nas demais.
//   2. Não sai se a pessoa ESTÁ COM O SISTEMA ABERTO (viu o 🔔 nos últimos 5 min) — ela já está vendo na tela.
//   3. UM aviso por assunto (chave) até a pessoa ler; mensagens seguidas só aumentam a contagem ("enviou 3 mensagens").
//   4. HORÁRIO DE SILÊNCIO 22h–7h (Brasília): fica guardado e sai às 7h, junto, como resumo.
//   5. LIMITE de 5 avisos no celular por pessoa por dia; o resto fica só na tela.
//   6. A pessoa escolhe o que quer e por onde (notificacao_preferencias) — tela de preferências vem com o canal.
const { EventEmitter } = require('events');
const avisos = new EventEmitter(); avisos.setMaxListeners(0);
const ESPERA_MS = 25000;
// 18n.3: quanto tempo fica na lista — lidas 30 dias (conta da leitura), não lidas 90 dias
const GUARDA = { lidas_dias: 30, nao_lidas_dias: 90 };
const noPrazo = (n, agora = Date.now()) => (n.lida_em ? agora - Date.parse(n.lida_em) < GUARDA.lidas_dias * 864e5 : agora - Date.parse(n.criado_em) < GUARDA.nao_lidas_dias * 864e5);
const REGRA = { primeira_min: 10, demais_min: 60, online_min: 5, silencio_ini: 22, silencio_fim: 7, limite_dia: 5 };
const sem074 = (e) => /notificacoes|does not exist|schema cache/i.test(String(e?.message || e));
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const chaveDest = (d) => `${d.tipo}:${d.id}`;

// presença: quando a pessoa olhou o 🔔 pela última vez (em memória — vale para o servidor que atende)
const vistoEm = new Map();
const marcarVisto = (dest) => vistoEm.set(chaveDest(dest), Date.now());
const online = (dest, agora = Date.now()) => agora - (vistoEm.get(chaveDest(dest)) || 0) < REGRA.online_min * 60000;

/** cria (ou agrupa na não lida do mesmo assunto) — dest: { tipo: 'usuario'|'fornecedor', id } */
async function criar(supabase, dest, { tenantId = null, tipo, titulo, texto = null, link = {}, chave = null, primeiraDoAssunto = false } = {}) {
  if (!dest?.id || !tipo || !titulo) return null;
  try {
    const agora = new Date().toISOString();
    if (chave) {
      const aberta = (await q(supabase.from('notificacoes').select('*').eq('destinatario_tipo', dest.tipo).eq('destinatario_id', String(dest.id)).eq('chave', chave))).find((n) => !n.lida_em);
      if (aberta) {
        const qtd = (aberta.quantidade || 1) + 1;
        const r = await supabase.from('notificacoes').update({ titulo, texto, link, quantidade: qtd, atualizado_em: agora }).eq('id', aberta.id).select();
        avisos.emit(chaveDest(dest)); return r.data?.[0] || aberta;
      }
    }
    const r = await supabase.from('notificacoes').insert([{ tenant_id: tenantId != null ? String(tenantId) : null, destinatario_tipo: dest.tipo, destinatario_id: String(dest.id), tipo, titulo, texto, link, chave,
      quantidade: 1, push_status: 'aguardando', push_motivo: primeiraDoAssunto ? 'primeira' : null, criado_em: agora, atualizado_em: agora }]).select();
    if (r.error) throw new Error(r.error.message);
    avisos.emit(chaveDest(dest));
    return r.data?.[0] || null;
  } catch (e) { if (!sem074(e)) console.error('⚠️ [notificacoes] não criou:', e.message); return null; }
}

const publica = (n) => ({ id: n.id, tipo: n.tipo, titulo: n.titulo, texto: n.texto, link: n.link || {}, quantidade: n.quantidade || 1, lida: !!n.lida_em, em: n.atualizado_em || n.criado_em });
async function daPessoa(supabase, dest) { return (await q(supabase.from('notificacoes').select('*').eq('destinatario_tipo', dest.tipo).eq('destinatario_id', String(dest.id)))).filter((n) => noPrazo(n)); } // 18n.3: fora do prazo some na hora (a limpeza apaga de madrugada)

/** lista para o 🔔 — com esperar, segura até chegar algo novo (desde = maior "versão" que a tela já tem) */
async function listar(supabase, dest, { desde = 0, esperar = false, limite = 30 } = {}) {
  marcarVisto(dest);
  const versao = (n) => Date.parse(n.atualizado_em || n.criado_em) || 0;
  let todas;
  try { todas = await daPessoa(supabase, dest); } catch (e) { if (sem074(e)) return { notificacoes: [], nao_lidas: 0, versao: 0, sem_migration: true }; throw e; }
  if (esperar && !todas.some((n) => versao(n) > Number(desde || 0))) {
    await new Promise((ok) => { const k = chaveDest(dest); const t = setTimeout(fim, ESPERA_MS); function fim() { clearTimeout(t); avisos.removeListener(k, fim); ok(); } avisos.once(k, fim); });
    todas = await daPessoa(supabase, dest); marcarVisto(dest);
  }
  todas.sort((a, b) => versao(b) - versao(a));
  const v = todas.length ? versao(todas[0]) : Number(desde || 0);
  return { notificacoes: todas.slice(0, limite).map(publica), nao_lidas: todas.filter((n) => !n.lida_em).length, versao: v,
    novas: todas.filter((n) => !n.lida_em && versao(n) > Number(desde || 0)).map(publica) };
}
async function marcarLida(supabase, dest, { id = null, chave = null, todas = false } = {}) {
  try {
    const lista = (await daPessoa(supabase, dest)).filter((n) => !n.lida_em && (todas || (id != null && String(n.id) === String(id)) || (chave && n.chave === chave)));
    const agora = new Date().toISOString();
    for (const n of lista) await supabase.from('notificacoes').update({ lida_em: agora, atualizado_em: agora, ...(n.push_status === 'aguardando' ? { push_status: 'dispensada', push_motivo: 'lida antes' } : {}) }).eq('id', n.id);
    if (lista.length) avisos.emit(chaveDest(dest));
    return { ok: true, marcadas: lista.length };
  } catch (e) { if (sem074(e)) return { ok: true, marcadas: 0 }; throw e; }
}

/** 📱 regra contra excesso — roda a cada 5 min (cron). Devolve o que foi decidido. */
function horaBrasilia(t) { return Number(new Date(t).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false })) % 24; }
let enviarCelular = async (_dest, _n) => ({ enviado: false, motivo: 'canal ainda não ligado' }); // Telegram/app entram aqui
function _definirCanal(fn) { enviarCelular = fn; }
async function avaliarPush(supabase, agora = Date.now()) {
  let pend; try { pend = (await q(supabase.from('notificacoes').select('*').eq('push_status', 'aguardando'))).filter((n) => !n.lida_em); } catch (e) { if (sem074(e)) return { avaliadas: 0 }; throw e; }
  const h = horaBrasilia(agora); const silencio = h >= REGRA.silencio_ini || h < REGRA.silencio_fim;
  const hojeIni = Date.parse(new Date(agora - 3 * 3600000).toISOString().slice(0, 10) + 'T03:00:00Z');
  const saidasHoje = new Map();
  const res = { avaliadas: pend.length, registradas: 0, enviadas: 0, dispensadas: 0, esperando: 0 };
  for (const n of pend.sort((a, b) => Date.parse(a.criado_em) - Date.parse(b.criado_em))) {
    const dest = { tipo: n.destinatario_tipo, id: n.destinatario_id }; const k = chaveDest(dest);
    const minutos = (agora - Date.parse(n.criado_em)) / 60000;
    if (minutos < (n.push_motivo === 'primeira' ? REGRA.primeira_min : REGRA.demais_min)) { res.esperando++; continue; }
    if (silencio) { res.esperando++; continue; } // sai às 7h
    if (online(dest, agora)) { await supabase.from('notificacoes').update({ push_status: 'dispensada', push_motivo: 'estava com o sistema aberto' }).eq('id', n.id); res.dispensadas++; continue; }
    if (!saidasHoje.has(k)) saidasHoje.set(k, (await daPessoa(supabase, dest).catch(() => [])).filter((x) => ['registrada', 'enviada'].includes(x.push_status) && Date.parse(x.push_em || 0) >= hojeIni).length);
    if (saidasHoje.get(k) >= REGRA.limite_dia) { await supabase.from('notificacoes').update({ push_status: 'dispensada', push_motivo: 'limite do dia' }).eq('id', n.id); res.dispensadas++; continue; }
    const r = await enviarCelular(dest, publica(n)).catch((e) => ({ enviado: false, motivo: e.message }));
    await supabase.from('notificacoes').update({ push_status: r.enviado ? 'enviada' : 'registrada', push_motivo: r.motivo || null, push_em: new Date(agora).toISOString() }).eq('id', n.id);
    saidasHoje.set(k, saidasHoje.get(k) + 1); if (r.enviado) res.enviadas++; else res.registradas++;
  }
  return res;
}

/** 18n.3: 🧹 limpeza diária (cron 3h) — apaga lidas há +30 dias e não lidas há +90 dias */
async function limpar(supabase, agora = Date.now()) {
  try {
    const lidas = await supabase.from('notificacoes').delete().not('lida_em', 'is', null).lt('lida_em', new Date(agora - GUARDA.lidas_dias * 864e5).toISOString()).select();
    const velhas = await supabase.from('notificacoes').delete().is('lida_em', null).lt('criado_em', new Date(agora - GUARDA.nao_lidas_dias * 864e5).toISOString()).select();
    if (lidas.error || velhas.error) throw new Error((lidas.error || velhas.error).message);
    return { apagadas: (lidas.data || []).length + (velhas.data || []).length };
  } catch (e) { if (sem074(e)) return { apagadas: 0 }; throw e; }
}

// 18q: ✉️ e-mail quando a conversa fica 4 h SEM LER (uma vez por assunto até ler; nunca 22h–7h; perfil admin não recebe
//   e-mail de rotina). Quem abre a conversa — ou clica em ✉️ Email / WhatsApp do fornecedor — marca como lida e o e-mail não sai.
//   email_em/email_status também alimentam o 📊 indicador de atenção (meta 0%).
const EMAIL = { horas: 4, tipos: ['spot_mensagem'] };
let enviarEmail = async (para, assunto, html) => require('./emailService').enviarEmailFornecedor(para, assunto, html);
function _definirEmail(fn) { enviarEmail = fn; }
async function emailDoDestino(supabase, dest) {
  if (dest.tipo === 'fornecedor') { const f = (await q(supabase.from('fornecedores').select('*').eq('id', dest.id)).catch(() => []))[0]; return { email: f?.email || null, nome: f?.nome || f?.nome_fantasia || '' }; }
  const u = (await q(supabase.from('usuarios').select('*').eq('id', dest.id)).catch(() => []))[0] || {};
  const perfis = Array.isArray(u.perfis) && u.perfis.length ? u.perfis : [u.perfil].filter(Boolean);
  return { email: u.email || null, nome: u.nome || '', admin: perfis.includes('admin') };
}
async function avaliarEmail(supabase, agora = Date.now()) {
  if (horaBrasilia(agora) >= REGRA.silencio_ini || horaBrasilia(agora) < REGRA.silencio_fim) return { avaliadas: 0, silencio: true };
  let pend; try { pend = (await q(supabase.from('notificacoes').select('*').is('email_em', null))).filter((n) => !n.lida_em && EMAIL.tipos.includes(n.tipo) && agora - Date.parse(n.criado_em) >= EMAIL.horas * 3600000); }
  catch (e) { if (sem074(e) || /email_em/.test(e.message)) return { avaliadas: 0, sem_migration: true }; throw e; }
  const res = { avaliadas: pend.length, enviados: 0, sem_email: 0, admin: 0, falhou: 0 };
  const base = String(process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
  for (const n of pend) {
    const dest = { tipo: n.destinatario_tipo, id: n.destinatario_id }; const p = await emailDoDestino(supabase, dest);
    let st = 'enviado';
    if (p.admin) st = 'admin'; else if (!p.email) st = 'sem_email';
    else {
      const horas = Math.floor((agora - Date.parse(n.criado_em)) / 3600000);
      const html = `<p>Olá${p.nome ? `, ${p.nome}` : ''}!</p><p><b>${n.titulo}</b>${n.texto ? ` — ${n.texto}` : ''}</p><p>Está sem resposta há ${horas} h${(n.quantidade || 1) > 1 ? ` (${n.quantidade} mensagens)` : ''}.</p>`
        + (base ? `<p><a href="${base}">Abrir o QuotaFlow</a> e responder pelo 🔔.</p>` : '<p>Abra o QuotaFlow e responda pelo 🔔.</p>') + '<p style="color:#888;font-size:12px">Você recebe este e-mail só quando a conversa fica 4 h sem ler — um por conversa.</p>';
      try { await enviarEmail(p.email, `⏳ ${n.titulo}`, html); } catch (e) { st = 'falhou'; console.error('⚠️ [notificacoes] e-mail:', e.message); }
    }
    await supabase.from('notificacoes').update({ email_em: new Date(agora).toISOString(), email_status: st }).eq('id', n.id);
    res[st === 'enviado' ? 'enviados' : st]++;
  }
  return res;
}
/** 📊 indicador de atenção — das respostas que chegaram aos compradores, quantas passaram de 4 h sem ler (meta 0%) */
async function indicadorAtencao(supabase, tenantId, { dias = 30, agora = Date.now() } = {}) {
  let ns; try { ns = (await q(supabase.from('notificacoes').select('*').eq('tenant_id', String(tenantId)).eq('tipo', 'spot_mensagem').eq('destinatario_tipo', 'usuario'))).filter((n) => agora - Date.parse(n.criado_em) < dias * 864e5); }
  catch (e) { if (sem074(e)) return { sem_migration: true, total: 0 }; throw e; }
  const atrasou = (n) => !!n.email_em || (!n.lida_em && agora - Date.parse(n.criado_em) >= EMAIL.horas * 3600000);
  const porPessoa = new Map();
  for (const n of ns) { const p = porPessoa.get(n.destinatario_id) || { usuario_id: n.destinatario_id, total: 0, atrasos: 0 }; p.total++; if (atrasou(n)) p.atrasos++; porPessoa.set(n.destinatario_id, p); }
  const us = porPessoa.size ? await q(supabase.from('usuarios').select('*').eq('tenant_id', tenantId)).catch(() => []) : [];
  const pessoas = [...porPessoa.values()].map((p) => ({ ...p, nome: us.find((u) => String(u.id) === String(p.usuario_id))?.nome || '—', pct: Math.round((p.atrasos / p.total) * 100) })).sort((a, b) => b.pct - a.pct);
  const total = ns.length; const atrasos = ns.filter(atrasou).length;
  return { dias, horas: EMAIL.horas, total, atrasos, pct: total ? Math.round((atrasos / total) * 100) : 0, meta: 0, pessoas };
}

module.exports = { EMAIL, avaliarEmail, indicadorAtencao, _definirEmail, GUARDA, limpar, REGRA, criar, listar, marcarLida, avaliarPush, online, marcarVisto, _definirCanal, _avisos: avisos };
