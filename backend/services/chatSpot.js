// backend/services/chatSpot.js — etapa 18l: 💬 conversa na demanda spot (comprador ↔ fornecedor)
//
// Uma conversa por INTERESSE (o fornecedor que respondeu a demanda). Tabela spot_mensagens (migration 072).
// Tempo real por ESPERA LONGA: a tela pergunta "tem algo depois do id X?" e o servidor segura a resposta
// até chegar mensagem nova (aviso em memória, na hora) ou até ~25 s — então a tela pergunta de novo.
// Sem consulta a cada poucos segundos e sem chave do banco no navegador. Com mais de um servidor rodando,
// a mensagem de outro servidor aparece na próxima volta (≤ 25 s).
// Demanda encerrada: a conversa fica só para leitura (409 ao escrever).
const { EventEmitter } = require('events');
const avisos = new EventEmitter(); avisos.setMaxListeners(0);
const ESPERA_MS = 25000;
const MAX_TEXTO = 2000;
const texto = (v) => String(v == null ? '' : v).trim().slice(0, MAX_TEXTO);
const sem072 = (e) => /spot_mensagens|does not exist|schema cache/i.test(String(e?.message || e));
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }

/** o interesse, conferindo que é desta empresa (comprador) ou deste fornecedor */
async function interesseDo(supabase, { interesseId, tenantId = null, fornecedorId = null, demandaId = null }) {
  const it = (await q(supabase.from('interesses_spot').select('*').eq('id', interesseId)))[0];
  if (!it) return null;
  if (tenantId != null && String(it.tenant_id) !== String(tenantId)) return null;
  if (fornecedorId != null && String(it.fornecedor_id) !== String(fornecedorId)) return null;
  if (demandaId != null && String(it.demanda_id) !== String(demandaId)) return null;
  return it;
}
// 18n: 🔔 avisa o outro lado pela Central de Notificações (tela agora; celular premium pela regra contra excesso)
const NOTIF = () => require('./notificacoes');
const destDoOutro = (it, dem, lado) => (lado === 'comprador' ? { tipo: 'fornecedor', id: it.fornecedor_id } : dem.comprador_id != null ? { tipo: 'usuario', id: dem.comprador_id } : null);
const destDeQuemLe = (it, dem, lado) => destDoOutro(it, dem, lado === 'comprador' ? 'fornecedor' : 'comprador');
async function avisarOutroLado(supabase, it, dem, lado, autor, primeira) {
  const dest = destDoOutro(it, dem, lado); if (!dest?.id) return;
  const num = dem.numero || `DSP-${String(dem.id).padStart(4, '0')}`;
  let quem = autor || (lado === 'comprador' ? 'O comprador' : 'O fornecedor');
  try { if (lado === 'fornecedor') { const f = (await q(supabase.from('fornecedores').select('*').eq('id', it.fornecedor_id)))[0]; if (f?.nome) quem = f.nome; }
    else { const t = (await q(supabase.from('tenants').select('*').eq('id', it.tenant_id)))[0]; const nm = t?.nome_fantasia || t?.nome || t?.razao_social; if (nm) quem = `${autor ? `${autor} · ` : ''}${nm}`; } } catch { /* ok */ }
  await NOTIF().criar(supabase, dest, { tenantId: it.tenant_id, tipo: 'spot_mensagem', chave: `spot:${it.id}`, primeiraDoAssunto: primeira,
    titulo: `💬 ${quem} ${lado === 'fornecedor' ? 'respondeu' : 'enviou mensagem'} sobre ${num}`, texto: dem.componente || null,
    link: { tela: lado === 'fornecedor' ? 'spot' : 'oportunidades', demanda_id: dem.id, interesse_id: it.id } });
}

const publico = (m) => ({ id: m.id, lado: m.lado, autor: m.autor_nome || null, texto: m.texto, em: m.criado_em, lida: !!m.lida_em });

async function buscar(supabase, interesseId, desde) {
  const todas = await q(supabase.from('spot_mensagens').select('*').eq('interesse_id', interesseId));
  return todas.filter((m) => Number(m.id) > Number(desde || 0)).sort((a, b) => Number(a.id) - Number(b.id));
}
/** marca como lidas as mensagens do OUTRO lado */
async function marcarLidas(supabase, lista, lado) {
  const ids = lista.filter((m) => m.lado !== lado && !m.lida_em).map((m) => m.id);
  for (const id of ids) await supabase.from('spot_mensagens').update({ lida_em: new Date().toISOString() }).eq('id', id);
}

/** lista (e, com esperar, segura até chegar algo novo) — lado = quem está lendo */
async function listar(supabase, alvo, lado, { desde = 0, esperar = false } = {}) {
  let it; try { it = await interesseDo(supabase, alvo); } catch (e) { throw e; }
  if (!it) return { status: 404, erro: 'Conversa não encontrada' };
  const dem = (await q(supabase.from('demandas_spot').select('*').eq('id', it.demanda_id)))[0] || {};
  let lista;
  try { lista = await buscar(supabase, it.id, desde); } catch (e) { if (sem072(e)) return { mensagens: [], sem_migration: true, encerrada: dem.status === 'encerrada' }; throw e; }
  if (!lista.length && esperar) {
    await new Promise((ok) => { const chave = `i:${it.id}`; const t = setTimeout(fim, ESPERA_MS); function fim() { clearTimeout(t); avisos.removeListener(chave, fim); ok(); } avisos.once(chave, fim); });
    lista = await buscar(supabase, it.id, desde);
  }
  await marcarLidas(supabase, lista, lado).catch(() => {});
  { const quem = destDeQuemLe(it, dem, lado); if (quem?.id) await NOTIF().marcarLida(supabase, quem, { chave: `spot:${it.id}` }).catch(() => {}); } // 18n: leu a conversa → o 🔔 dela também
  return { mensagens: lista.map(publico), ultimo: lista.length ? Number(lista[lista.length - 1].id) : Number(desde || 0), encerrada: dem.status === 'encerrada' };
}

async function enviar(supabase, alvo, lado, autor, corpo = {}) {
  const it = await interesseDo(supabase, alvo); if (!it) return { status: 404, erro: 'Conversa não encontrada' };
  const t = texto(corpo.texto); if (!t) return { status: 400, erro: 'Escreva a mensagem' };
  const dem = (await q(supabase.from('demandas_spot').select('*').eq('id', it.demanda_id)))[0] || {};
  if (dem.status === 'encerrada') return { status: 409, erro: 'Demanda encerrada — a conversa fica só para consulta' };
  const primeira = (await q(supabase.from('spot_mensagens').select('*').eq('interesse_id', it.id)).catch(() => [])).length === 0;
  let m;
  try { const r = await supabase.from('spot_mensagens').insert([{ interesse_id: it.id, demanda_id: it.demanda_id, tenant_id: it.tenant_id, fornecedor_id: it.fornecedor_id, lado, autor_nome: autor || null, texto: t }]).select(); if (r.error) throw new Error(r.error.message); m = r.data[0]; }
  catch (e) { if (sem072(e)) return { status: 409, erro: 'Falta rodar a migration 072 no Supabase.' }; throw e; }
  avisos.emit(`i:${it.id}`);
  await avisarOutroLado(supabase, it, dem, lado, autor, primeira).catch((e) => console.error('⚠️ [spot chat] aviso:', e.message)); // 18n
  return { mensagem: publico(m) };
}

/** não lidas por interesse (para os contadores) — lado = quem vai ler */
async function naoLidas(supabase, { tenantId = null, fornecedorId = null }, lado) {
  let todas;
  try { todas = tenantId != null ? await q(supabase.from('spot_mensagens').select('*').eq('tenant_id', tenantId)) : await q(supabase.from('spot_mensagens').select('*').eq('fornecedor_id', fornecedorId)); }
  catch { return {}; }
  const out = {}; const total = {}; const estado = {};
  for (const m of todas.sort((a, b) => Number(a.id) - Number(b.id))) {
    const k = String(m.interesse_id); total[k] = (total[k] || 0) + 1; if (m.lado !== lado && !m.lida_em) out[k] = (out[k] || 0) + 1;
    const e = estado[k] || { lados: new Set() }; e.lados.add(m.lado); e.ultima = m; estado[k] = e;
  }
  // 18n: estado de cada conversa, do ponto de vista de quem lê (lado)
  const agora = Date.now(); const est = {};
  for (const [k, e] of Object.entries(estado)) {
    const ult = e.ultima; const horas = (agora - Date.parse(ult.criado_em)) / 3600000;
    est[k] = out[k] ? 'nova' : ult.lado === lado ? (horas >= 24 ? 'sem_resposta' : 'aguardando') : e.lados.size > 1 && horas <= 72 ? 'ativa' : 'parada';
    est[k] = { estado: est[k], ultima_em: ult.criado_em, ultima_lida: ult.lado === lado ? !!ult.lida_em : null, horas: Math.floor(horas) };
  }
  return { naoLidas: out, total, estado: est };
}

module.exports = { listar, enviar, naoLidas, ESPERA_MS, _avisos: avisos };
