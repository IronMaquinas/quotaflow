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
  return { mensagens: lista.map(publico), ultimo: lista.length ? Number(lista[lista.length - 1].id) : Number(desde || 0), encerrada: dem.status === 'encerrada' };
}

async function enviar(supabase, alvo, lado, autor, corpo = {}) {
  const it = await interesseDo(supabase, alvo); if (!it) return { status: 404, erro: 'Conversa não encontrada' };
  const t = texto(corpo.texto); if (!t) return { status: 400, erro: 'Escreva a mensagem' };
  const dem = (await q(supabase.from('demandas_spot').select('*').eq('id', it.demanda_id)))[0] || {};
  if (dem.status === 'encerrada') return { status: 409, erro: 'Demanda encerrada — a conversa fica só para consulta' };
  let m;
  try { const r = await supabase.from('spot_mensagens').insert([{ interesse_id: it.id, demanda_id: it.demanda_id, tenant_id: it.tenant_id, fornecedor_id: it.fornecedor_id, lado, autor_nome: autor || null, texto: t }]).select(); if (r.error) throw new Error(r.error.message); m = r.data[0]; }
  catch (e) { if (sem072(e)) return { status: 409, erro: 'Falta rodar a migration 072 no Supabase.' }; throw e; }
  avisos.emit(`i:${it.id}`);
  return { mensagem: publico(m) };
}

/** não lidas por interesse (para os contadores) — lado = quem vai ler */
async function naoLidas(supabase, { tenantId = null, fornecedorId = null }, lado) {
  let todas;
  try { todas = tenantId != null ? await q(supabase.from('spot_mensagens').select('*').eq('tenant_id', tenantId)) : await q(supabase.from('spot_mensagens').select('*').eq('fornecedor_id', fornecedorId)); }
  catch { return {}; }
  const out = {}; const total = {};
  for (const m of todas) { const k = String(m.interesse_id); total[k] = (total[k] || 0) + 1; if (m.lado !== lado && !m.lida_em) out[k] = (out[k] || 0) + 1; }
  return { naoLidas: out, total };
}

module.exports = { listar, enviar, naoLidas, ESPERA_MS, _avisos: avisos };
