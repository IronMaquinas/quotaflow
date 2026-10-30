// backend/services/pedidosVenda.js — etapa 15c
//
// 🧾 PEDIDO DE VENDA — PV-AAAA-NNNN (decidido com o Marcony, 28/10/2026):
//   • nasce SOZINHO quando o cliente aceita o BID (pelo link ou "aceite fora do sistema"): itens, valores, condições e textos
//     da versão ACEITA, rastreio BID/versão + hash do aceite. Aviso por e-mail ao responsável e aos gestores/admins.
//   • STATUS POR ITEM: a programar → programado → em execução → concluído | cancelado (manual até a AT — etapa 16a).
//     Status do PV calculado: aberto · em execução · concluído (· cancelado, manual, com motivo).
//   • ADITIVO PELO LINK (decisão do Marcony: "item crítico que salvaguarda as duas partes"): é um BID do tipo 'aditivo'
//     (PV-AAAA-NNNN-A1) que começa com os itens atuais do PV e segue o MESMO fluxo da 15b — revisar e enviar, visualizado,
//     resposta por item, código + assinatura. Aceito → aplica no PV (antes × depois, o que mudou, hash) e numera Aditivo 1, 2…
//     Item já programado/em execução/concluído não pode sair num aditivo.
//   • Ver/alterar: admin, gestor, comercial (a operação verá o serviço SEM valores na AT).
// Regras do backend: sem DB.raw; ids com String(); filtros sem null; o mock não aplica default do banco.

const crypto = require('crypto');
const B = require('./bids');
const { q, texto, atividade, hojeBR } = B;

let enviarEmail = async (para, assunto, html) => require('./emailService').enviarEmailFornecedor(para, assunto, html);
function _definirEnvio(fn) { enviarEmail = fn; }

const STATUS_ITEM = { a_programar: 'A programar', programado: 'Programado', em_execucao: 'Em execução', concluido: 'Concluído', cancelado: 'Cancelado' };
const STATUS_PV = { aberto: 'Aberto', em_execucao: 'Em execução', concluido: 'Concluído', cancelado: 'Cancelado' };
const TRAVADOS = ['programado', 'em_execucao', 'concluido']; // não saem num aditivo
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const idOk = (v) => /^\d+$/.test(String(v ?? ''));
const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const frontend = () => String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/^FRONTEND_URL=/, '').replace(/\/+$/, '');

async function pvDoTenant(supabase, tenantId, id) { return idOk(id) ? (await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] || null : null; }
async function proximoNumero(supabase, tenantId) {
  const pre = `PV-${hojeBR().slice(0, 4)}-`;
  const nums = (await q(supabase.from('pedidos_venda').select('numero').eq('tenant_id', tenantId))).map((p) => String(p.numero || '')).filter((n) => n.startsWith(pre)).map((n) => Number(n.slice(pre.length)) || 0);
  return `${pre}${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
}
/** status do PV pelos itens (cancelado é manual e não muda) */
function statusPV(grupos = [], atual = 'aberto') {
  if (atual === 'cancelado') return 'cancelado';
  const its = grupos.flatMap((g) => g.itens || []).filter((i) => i.status !== 'cancelado');
  if (its.length && its.every((i) => i.status === 'concluido')) return 'concluido';
  if (its.some((i) => ['programado', 'em_execucao', 'concluido'].includes(i.status))) return 'em_execucao';
  return 'aberto';
}
const comStatus = (grupos = [], anteriores = new Map()) => grupos.map((g) => ({ ...g, itens: (g.itens || []).map((i) => ({ ...i, status: anteriores.get(i.id) || i.status || 'a_programar' })) }));
const retratoPV = (pv) => ({ titulo: pv.titulo, referencia: pv.referencia, cliente_nome: pv.cliente_nome, contato_nome: pv.contato_nome, conteudo: pv.conteudo || {}, grupos: (pv.grupos || []).map((g) => ({ ...g, itens: (g.itens || []).map(({ status, ...i }) => i) })),
  condicoes: pv.condicoes || {}, valor_total_manual: pv.valor_total_manual ?? null, valor_total: pv.valor_total ?? null, validade_dias: null, assinante: {} });

/** e-mails: responsável + gestores ativos do tenant (15c.1: admin não recebe — pode ser alguém de TI) */
async function destinatarios(supabase, tenantId, responsavelId) {
  const us = (await q(supabase.from('usuarios').select('*').eq('tenant_id', tenantId))).filter((u) => u.ativo !== false);
  const ups = us.length ? await q(supabase.from('usuario_perfis').select('*').in('usuario_id', us.map((u) => u.id))).catch(() => []) : [];
  const perfis = (u) => new Set([u.perfil, ...ups.filter((p) => String(p.usuario_id) === String(u.id)).map((p) => p.perfil_codigo)]);
  const l = us.filter((u) => String(u.id) === String(responsavelId) || [...perfis(u)].includes('gestor')).map((u) => u.email).filter((e) => e && EMAIL.test(e));
  return [...new Set(l.map((e) => e.toLowerCase()))];
}
async function avisar(supabase, tenantId, responsavelId, assunto, corpo) {
  const emp = (await q(supabase.from('tenants').select('*').eq('id', tenantId)))[0] || {};
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#111;font-size:14px;line-height:1.55"><div style="font-weight:700;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:14px">${esc(emp.nome_fantasia || emp.razao_social || emp.nome || 'QuotaFlow')}</div>${corpo}<p style="margin:20px 0"><a href="${frontend()}" style="background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:700">Abrir o QuotaFlow → 📈 Comercial</a></p></div>`;
  for (const para of await destinatarios(supabase, tenantId, responsavelId)) {
    try { await enviarEmail(para, assunto, html); } catch (e) { console.error('⚠️ [PV] e-mail não enviado:', para, e?.message || e); }
  }
}

// ─── nasce no aceite ─────────────────────────────────────────────────────────
/** chamado pelo aceite (link ou fora do sistema). Proposta → cria o PV; aditivo → aplica no PV. Nunca derruba o aceite. */
async function aoAceitar(supabase, tenantId, bidId, quem = {}) {
  try {
    const b = (await q(supabase.from('bids').select('*').eq('tenant_id', tenantId).eq('id', bidId)))[0];
    if (!b || b.fase !== 'aceito') return null;
    return b.tipo === 'aditivo' ? await aplicarAditivo(supabase, tenantId, b, quem) : await criarPV(supabase, tenantId, b, quem);
  } catch (e) { console.error('❌ [PV] falha ao gerar a partir do aceite:', e?.message || e); return { erro: e?.message || 'falha' }; }
}
async function criarPV(supabase, tenantId, b, quem = {}) {
  const ja = (await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId).eq('bid_id', b.id)))[0];
  if (ja) return { pv: ja, existente: true };
  const v = (await q(supabase.from('bid_versoes').select('*').eq('tenant_id', tenantId).eq('bid_id', b.id))).find((x) => x.versao === (b.aceite_versao || b.versao_enviada));
  const s = v?.snapshot || B.retrato(b);
  const grupos = comStatus(B.numerarItens(s.grupos || []).grupos); const t = B.totais(grupos, s.valor_total_manual); // 16d: itens numerados
  const agora = new Date().toISOString();
  // 16a: o modelo do BID diz o que o aceite gera (transporte → AT; locação, serviço, venda → etapas futuras)
  const tipoExec = b.modelo_id ? ((await q(supabase.from('bid_modelos').select('*').eq('id', b.modelo_id)).catch(() => []))[0]?.tipo_execucao || 'transporte') : 'transporte';
  const reg = { tenant_id: tenantId, numero: await proximoNumero(supabase, tenantId), tipo_execucao: tipoExec, bid_id: b.id, bid_numero: b.numero, bid_versao: v?.versao || b.aceite_versao || null,
    cliente_id: b.cliente_id, cliente_nome: b.cliente_nome, contato_nome: s.contato_nome || b.contato_nome || null, contato_email: b.envio_para || b.contato_email || null,
    titulo: s.titulo || b.titulo || null, referencia: s.referencia || b.referencia || null, conteudo: s.conteudo || {}, grupos, condicoes: s.condicoes || {},
    valor_total_manual: s.valor_total_manual ?? null, valor_total: t.total, aditivo_atual: 0, status: 'aberto', cancelado_motivo: null,
    aceite_nome: b.aceite_nome || null, aceite_em: b.aceite_em || agora, aceite_hash: b.aceite_hash || null,
    responsavel_id: b.responsavel_id ?? null, responsavel_nome: b.responsavel_nome || null, criado_em: agora, atualizado_em: agora };
  const { data, error } = await supabase.from('pedidos_venda').insert([reg]).select();
  if (error) throw new Error(error.message);
  const pv = data[0];
  await supabase.from('bids').update({ pv_id: pv.id }).eq('id', b.id).eq('tenant_id', tenantId);
  const qtd = grupos.reduce((n, g) => n + (g.itens || []).length, 0);
  await atividade(supabase, tenantId, quem, { bid_id: b.id, cliente_id: b.cliente_id, tipo: 'evento', texto: `🧾 Pedido ${pv.numero} gerado automaticamente — ${B.brl(pv.valor_total) || '—'} · ${grupos.length} grupo(s) · ${qtd} item(ns)` });
  await avisar(supabase, tenantId, b.responsavel_id, `🎉 ${b.numero} aceito! Pedido ${pv.numero} gerado — ${b.cliente_nome}`,
    `<p style="font-size:16px"><b>🎉 Parabéns!</b></p><p>O <b>${esc(b.numero)}</b>${b.titulo ? ` (${esc(b.titulo)})` : ''} foi aceito por <b>${esc(b.aceite_nome || b.cliente_nome)}</b>${b.aceite_canal === 'fora_sistema' ? ' (aceite registrado fora do sistema)' : ''}.</p>
     <p>O pedido <b>${esc(pv.numero)}</b> foi gerado automaticamente: <b>${esc(B.brl(pv.valor_total) || '—')}</b> · ${grupos.length} grupo(s) · ${qtd} item(ns).</p><p>Próximo passo: programar a execução (📈 Comercial → 🧾 Pedidos).</p>`);
  return { pv };
}
/** BID aceito antes da 15c (sem PV): gerar à mão */
async function gerarManual(supabase, tenantId, quem, bidId) {
  const b = (await q(supabase.from('bids').select('*').eq('tenant_id', tenantId).eq('id', bidId)))[0];
  if (!b) return { status: 404, erro: 'BID não encontrado' };
  if (b.fase !== 'aceito') return { status: 409, erro: 'Só um BID aceito vira pedido' };
  if (b.tipo === 'aditivo') return { status: 409, erro: 'Aditivo é aplicado no pedido, não gera outro' };
  return criarPV(supabase, tenantId, b, quem);
}

// ─── lista e detalhe ─────────────────────────────────────────────────────────
function enfeitar(pv) {
  const its = (pv.grupos || []).flatMap((g) => (g.itens || []).map((i) => ({ ...i, grupo: g.titulo })));
  const cont = Object.fromEntries(Object.keys(STATUS_ITEM).map((k) => [k, its.filter((i) => (i.status || 'a_programar') === k).length]));
  const proximas = its.filter((i) => i.valores?.data_prevista && !['concluido', 'cancelado'].includes(i.status)).sort((a, b) => String(a.valores.data_prevista).localeCompare(String(b.valores.data_prevista)))
    .slice(0, 5).map((i) => ({ data: i.valores.data_prevista, grupo: i.grupo, item: i.valores?.modelo || i.valores?.veiculo || 'item', status: i.status || 'a_programar' }));
  return { ...pv, status_nome: STATUS_PV[pv.status] || pv.status, itens_por_status: cont, qtd_itens: its.length, proximas };
}
async function listar(supabase, tenantId) {
  return (await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId))).map(enfeitar).sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
}
async function detalhe(supabase, tenantId, id) {
  const pv = await pvDoTenant(supabase, tenantId, id); if (!pv) return { status: 404, erro: 'Pedido não encontrado' };
  const [adits, bs] = await Promise.all([q(supabase.from('pv_aditivos').select('*').eq('tenant_id', tenantId).eq('pv_id', pv.id)), q(supabase.from('bids').select('*').eq('tenant_id', tenantId).eq('pv_id', pv.id))]);
  const aberto = bs.find((b) => b.tipo === 'aditivo' && B.ABERTAS.includes(b.fase));
  const t = B.totais(B.numerarItens(pv.grupos || []).grupos, pv.valor_total_manual); // 16d: itens numerados (pedido antigo: na ordem)
  return { pv: { ...enfeitar(pv), grupos: t.grupos }, aditivos: adits.map(({ antes, depois, ...a }) => a).sort((a, b) => b.numero - a.numero),
    aditivo_aberto: aberto ? { id: aberto.id, numero: aberto.numero, fase: aberto.fase, fase_nome: B.FASE_NOME[aberto.fase], visto_qtd: aberto.visto_qtd } : null,
    aditivos_recusados: bs.filter((b) => b.tipo === 'aditivo' && b.fase === 'perdido').map((b) => ({ id: b.id, numero: b.numero, motivo: b.perda_obs || b.motivo_perda })) };
}

// ─── status por item, cancelamento ──────────────────────────────────────────
async function mudarStatusItem(supabase, tenantId, quem, id, itemId, { status } = {}) {
  const pv = await pvDoTenant(supabase, tenantId, id); if (!pv) return { status: 404, erro: 'Pedido não encontrado' };
  if (pv.status === 'cancelado') return { status: 409, erro: 'Pedido cancelado' };
  if (!STATUS_ITEM[status]) return { status: 400, erro: 'Status inválido' };
  let achou = null;
  const grupos = (pv.grupos || []).map((g) => ({ ...g, itens: (g.itens || []).map((i) => { if (String(i.id) !== String(itemId)) return i; achou = { ...i, grupo: g.titulo, grupo_id: g.id }; return { ...i, status }; }) }));
  if (!achou) return { status: 404, erro: 'Item não encontrado' };
  if (status !== 'cancelado') { // 16a: trecho com AT ativa → o status segue a AT
    const { data: ats } = await supabase.from('execucoes').select('*').eq('tenant_id', tenantId).eq('pv_id', pv.id);
    const at = (ats || []).find((e) => !['cancelada', 'rascunho'].includes(e.status) && (e.itens || []).some((x) => String(x.id) === String(itemId)));
    if (at) return { status: 409, erro: `O status deste item é controlado pela ${at.numero} (🚛 Programação)` };
  }
  if ((achou.status || 'a_programar') === status) return { pv };
  const novo = statusPV(grupos, pv.status);
  const { data, error } = await supabase.from('pedidos_venda').update({ grupos, status: novo, atualizado_em: new Date().toISOString() }).eq('id', pv.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  await atividade(supabase, tenantId, quem, { bid_id: pv.bid_id, cliente_id: pv.cliente_id, tipo: 'evento', texto: `🧾 ${pv.numero} · ${achou.grupo ? `${achou.grupo} — ` : ''}${achou.valores?.modelo || achou.valores?.veiculo || 'item'}: ${STATUS_ITEM[achou.status || 'a_programar']} → ${STATUS_ITEM[status]}${novo !== pv.status ? ` · pedido ${STATUS_PV[novo].toLowerCase()}` : ''}` });
  return { pv: data[0] };
}
async function cancelar(supabase, tenantId, quem, id, { motivo } = {}) {
  const pv = await pvDoTenant(supabase, tenantId, id); if (!pv) return { status: 404, erro: 'Pedido não encontrado' };
  if (pv.status === 'cancelado') return { pv };
  const m = texto(motivo, 500); if (!m || m.length < 10) return { status: 400, erro: 'Descreva o motivo do cancelamento (mínimo 10 caracteres)' };
  if ((pv.grupos || []).some((g) => (g.itens || []).some((i) => ['em_execucao', 'concluido'].includes(i.status)))) return { status: 409, erro: 'Há itens em execução ou concluídos — cancele só os itens que faltam' };
  const { data, error } = await supabase.from('pedidos_venda').update({ status: 'cancelado', cancelado_motivo: m, atualizado_em: new Date().toISOString() }).eq('id', pv.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  await atividade(supabase, tenantId, quem, { bid_id: pv.bid_id, cliente_id: pv.cliente_id, tipo: 'evento', texto: `🧾 ${pv.numero} cancelado: ${m}` });
  return { pv: data[0] };
}

// ─── aditivo pelo link ───────────────────────────────────────────────────────
/** ➕ Criar aditivo: um BID do tipo 'aditivo' com os itens atuais do PV (o comercial edita e envia pelo fluxo da 15b) */
async function criarAditivo(supabase, tenantId, quem, id) {
  const pv = await pvDoTenant(supabase, tenantId, id); if (!pv) return { status: 404, erro: 'Pedido não encontrado' };
  if (pv.status === 'cancelado' || pv.status === 'concluido') return { status: 409, erro: `Pedido ${STATUS_PV[pv.status].toLowerCase()} — não aceita aditivo` };
  const bs = await q(supabase.from('bids').select('*').eq('tenant_id', tenantId).eq('pv_id', pv.id));
  const aberto = bs.find((b) => b.tipo === 'aditivo' && B.ABERTAS.includes(b.fase));
  if (aberto) return { bid: aberto, existente: true };
  const orig = pv.bid_id ? (await q(supabase.from('bids').select('*').eq('tenant_id', tenantId).eq('id', pv.bid_id)))[0] : null;
  const n = Math.max(Number(pv.aditivo_atual || 0), ...bs.filter((b) => b.tipo === 'aditivo').map((b) => Number(b.aditivo_numero || 0))) + 1;
  const agora = new Date().toISOString();
  const tituloDoc = `ADITIVO ${n} AO PEDIDO ${pv.numero}${pv.conteudo?.titulo_documento ? ` — ${pv.conteudo.titulo_documento}` : ''}`;
  const reg = { tenant_id: tenantId, numero: `${pv.numero}-A${n}`, titulo: `Aditivo ${n}${pv.titulo ? ` — ${pv.titulo}` : ''}`, referencia: pv.referencia || null,
    cliente_id: pv.cliente_id, cliente_nome: pv.cliente_nome, contato_nome: orig?.contato_nome ?? pv.contato_nome ?? null, contato_email: orig?.contato_email ?? pv.contato_email ?? null, contato_telefone: orig?.contato_telefone ?? null,
    modelo_id: orig?.modelo_id ?? null, modelo_nome: orig?.modelo_nome || null, conteudo: { ...(pv.conteudo || {}), titulo_documento: tituloDoc },
    grupos: retratoPV(pv).grupos, condicoes: pv.condicoes || {}, valor_total_manual: pv.valor_total_manual ?? null, valor_total: pv.valor_total ?? null,
    validade_dias: orig?.validade_dias || 10, valido_ate: null, previsao_fechamento: null, assinante: orig?.assinante || {},
    responsavel_id: orig?.responsavel_id ?? pv.responsavel_id ?? quem.usuarioId ?? null, responsavel_nome: orig?.responsavel_nome || pv.responsavel_nome || quem.usuarioNome || null,
    fase: 'elaboracao', fase_desde: agora, versao_atual: 0, versao_enviada: 0, alterado_desde_versao: true, em_revisao: false, visto_qtd: 0, codigo_tentativas: 0,
    tipo: 'aditivo', pv_id: pv.id, aditivo_numero: n, criado_por_nome: quem.usuarioNome || null, criado_em: agora, atualizado_em: agora };
  const { data, error } = await supabase.from('bids').insert([reg]).select();
  if (error) throw new Error(error.message);
  await atividade(supabase, tenantId, quem, { bid_id: data[0].id, cliente_id: pv.cliente_id, tipo: 'evento', texto: `➕ Aditivo ${n} ao pedido ${pv.numero} criado — ajuste os itens e envie ao cliente` });
  if (pv.bid_id) await atividade(supabase, tenantId, quem, { bid_id: pv.bid_id, cliente_id: pv.cliente_id, tipo: 'evento', texto: `➕ Aditivo ${n} em elaboração (${reg.numero})` });
  return { bid: data[0] };
}
/** 🗑 15c.2: descartar um aditivo que NUNCA foi enviado ao cliente (criado sem querer) — some sem deixar rastro no pedido */
async function descartarAditivo(supabase, tenantId, quem, bidId) {
  const b = idOk(bidId) ? (await q(supabase.from('bids').select('*').eq('tenant_id', tenantId).eq('id', bidId)))[0] : null;
  if (!b || b.tipo !== 'aditivo') return { status: 404, erro: 'Aditivo não encontrado' };
  if (Number(b.versao_enviada || 0) > 0 || b.fase !== 'elaboracao') return { status: 409, erro: 'Este aditivo já foi enviado ao cliente — use ✕ Encerrar aditivo (fica registrado)' };
  for (const t of ['bid_atividades', 'bid_versoes', 'bid_visualizacoes']) { const { error } = await supabase.from(t).delete().eq('tenant_id', tenantId).eq('bid_id', b.id); if (error && !/does not exist|schema cache/.test(error.message)) throw new Error(error.message); }
  const { error } = await supabase.from('bids').delete().eq('id', b.id).eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  const pv = (await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId).eq('id', b.pv_id)))[0];
  if (pv?.bid_id) await atividade(supabase, tenantId, quem, { bid_id: pv.bid_id, cliente_id: pv.cliente_id, tipo: 'evento', texto: `🗑 Aditivo ${b.aditivo_numero} descartado antes do envio (${b.numero})` });
  return { ok: true, pv_id: b.pv_id };
}
/** antes de enviar um aditivo: item já programado/em execução/concluído não pode sair nem mudar de valor */
async function validarAditivo(supabase, b) {
  if (b.tipo !== 'aditivo') return [];
  const pv = (await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', b.tenant_id).eq('id', b.pv_id)))[0];
  if (!pv) return ['Pedido do aditivo não encontrado'];
  const novos = new Map((b.grupos || []).flatMap((g) => (g.itens || []).map((i) => [i.id, i])));
  const erros = [];
  for (const g of pv.grupos || []) for (const i of g.itens || []) {
    if (!TRAVADOS.includes(i.status)) continue;
    const nome = `${g.titulo ? `${g.titulo} — ` : ''}${i.valores?.modelo || i.valores?.veiculo || 'item'}`;
    const n = novos.get(i.id);
    if (!n) erros.push(`${nome} está ${STATUS_ITEM[i.status].toLowerCase()} — não pode sair no aditivo`);
    else if (Number(n.valor ?? -1) !== Number(i.valor ?? -1) || Number(n.quantidade || 1) !== Number(i.quantidade || 1)) erros.push(`${nome} está ${STATUS_ITEM[i.status].toLowerCase()} — o valor/quantidade não pode mudar`);
  }
  if (B.diferencas(retratoPV(pv), B.retrato(b)).every((m) => /Sem mudanças|Textos das seções|^Validade:/.test(m))) erros.push('O aditivo ainda não muda nada no pedido (itens, valores ou condições)');
  return erros;
}
/** o que o aditivo muda em relação ao pedido (para a página do cliente e o e-mail) */
async function mudancasAditivo(supabase, b, snapshot) {
  const pv = (await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', b.tenant_id).eq('id', b.pv_id)))[0];
  if (!pv) return null;
  return { pv_numero: pv.numero, numero: b.aditivo_numero, valor_antes: pv.valor_total, mudancas: B.diferencas(retratoPV(pv), snapshot || B.retrato(b)).filter((m) => !/Textos das seções|^Validade:/.test(m)) };
}
/** aditivo aceito → aplica no PV (status dos itens que continuam são mantidos; novos entram "a programar") */
async function aplicarAditivo(supabase, tenantId, b, quem = {}) {
  const pv = (await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId).eq('id', b.pv_id)))[0];
  if (!pv) throw new Error('Pedido do aditivo não encontrado');
  const ja = (await q(supabase.from('pv_aditivos').select('*').eq('tenant_id', tenantId).eq('pv_id', pv.id))).find((a) => String(a.bid_id) === String(b.id));
  if (ja) return { aditivo: ja, existente: true };
  const v = (await q(supabase.from('bid_versoes').select('*').eq('tenant_id', tenantId).eq('bid_id', b.id))).find((x) => x.versao === (b.aceite_versao || b.versao_enviada));
  const s = v?.snapshot || B.retrato(b);
  const statusAntes = new Map((pv.grupos || []).flatMap((g) => (g.itens || []).map((i) => [i.id, i.status || 'a_programar'])));
  const grupos = comStatus(B.numerarItens(s.grupos || []).grupos, statusAntes); const t = B.totais(grupos, s.valor_total_manual); // 16d: itens numerados
  const antes = retratoPV(pv); const mudancas = B.diferencas(antes, s).filter((m) => !/Textos das seções|^Validade:/.test(m));
  const n = b.aditivo_numero || Number(pv.aditivo_atual || 0) + 1; const agora = new Date().toISOString();
  const { data: ad, error: e1 } = await supabase.from('pv_aditivos').insert([{ tenant_id: tenantId, pv_id: pv.id, numero: n, bid_id: b.id, bid_versao: v?.versao || null, antes: { ...antes, grupos: pv.grupos }, depois: { ...s, grupos },
    mudancas, valor_antes: pv.valor_total, valor_depois: t.total, aceite_nome: b.aceite_nome || null, aceite_em: b.aceite_em || agora, aceite_hash: b.aceite_hash || null, criado_em: agora }]).select();
  if (e1) throw new Error(e1.message);
  const conteudo = { ...(s.conteudo || {}), titulo_documento: pv.conteudo?.titulo_documento || s.conteudo?.titulo_documento };
  const { error: e2 } = await supabase.from('pedidos_venda').update({ grupos, condicoes: s.condicoes || {}, conteudo, valor_total_manual: s.valor_total_manual ?? null, valor_total: t.total,
    aditivo_atual: n, status: statusPV(grupos, pv.status), atualizado_em: agora }).eq('id', pv.id).eq('tenant_id', tenantId);
  if (e2) throw new Error(e2.message);
  const txt = `📎 Aditivo ${n} aceito e aplicado ao ${pv.numero}: ${B.brl(pv.valor_total) || '—'} → ${B.brl(t.total) || '—'} · ${mudancas.length} mudança(s)`;
  await atividade(supabase, tenantId, quem, { bid_id: b.id, cliente_id: pv.cliente_id, tipo: 'evento', texto: txt });
  if (pv.bid_id) await atividade(supabase, tenantId, quem, { bid_id: pv.bid_id, cliente_id: pv.cliente_id, tipo: 'evento', texto: txt });
  await avisar(supabase, tenantId, b.responsavel_id, `📎 Aditivo ${n} ao pedido ${pv.numero} aceito — ${pv.cliente_nome}`,
    `<p><b>${esc(b.aceite_nome || pv.cliente_nome)}</b> aceitou o <b>aditivo ${n}</b> ao pedido <b>${esc(pv.numero)}</b>.</p><p>Valor: ${esc(B.brl(pv.valor_total) || '—')} → <b>${esc(B.brl(t.total) || '—')}</b></p>${mudancas.length ? `<ul>${mudancas.slice(0, 15).map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}<p>O pedido já foi atualizado.</p>`);
  return { aditivo: ad[0], pv: { id: pv.id, numero: pv.numero } };
}

// ─── documento (PDF do pedido) ──────────────────────────────────────────────
async function documento(supabase, tenantId, id) {
  const pv = await pvDoTenant(supabase, tenantId, id); if (!pv) return { status: 404, erro: 'Pedido não encontrado' };
  const [emp, cli, orig] = await Promise.all([q(supabase.from('tenants').select('*').eq('id', tenantId)).then((r) => r[0] || {}),
    pv.cliente_id ? q(supabase.from('clientes').select('*').eq('tenant_id', tenantId).eq('id', pv.cliente_id)).then((r) => r[0] || null) : null,
    pv.bid_id ? q(supabase.from('bids').select('*').eq('tenant_id', tenantId).eq('id', pv.bid_id)).then((r) => r[0] || null) : null]);
  const t = B.totais(B.numerarItens(pv.grupos || []).grupos, pv.valor_total_manual); // 16d: itens numerados (pedido antigo: na ordem)
  return { numero: pv.numero, pedido: true, versao: null, rascunho: false, fase: pv.status, valido_ate: null,
    empresa: { razao_social: emp.razao_social || emp.nome || '', nome_fantasia: emp.nome_fantasia || '', cnpj: emp.cnpj || '', inscricao_estadual: emp.inscricao_estadual || '', opcao_fiscal: emp.opcao_fiscal || '',
      endereco: emp.endereco || '', numero: emp.numero || '', complemento: emp.complemento || '', bairro: emp.bairro || '', cidade: emp.cidade || '', uf: emp.regiao || '', cep: emp.cep || '', telefone: emp.telefone || '', email: emp.email || '' },
    cliente: { nome: cli?.nome || pv.cliente_nome, razao_social: cli?.razao_social || null, documento: cli?.documento || null, contato: pv.contato_nome || null },
    titulo: pv.titulo, referencia: pv.referencia, cliente_nome: pv.cliente_nome, contato_nome: pv.contato_nome,
    conteudo: { ...(pv.conteudo || {}), titulo_documento: `PEDIDO DE VENDA ${pv.numero}`, secoes: [] }, grupos: t.grupos, total: t.total, condicoes: pv.condicoes || {}, validade_dias: null,
    assinante: orig?.assinante || {}, origem: { bid: pv.bid_numero, versao: pv.bid_versao, aditivo: pv.aditivo_atual, aceite_nome: pv.aceite_nome, aceite_em: pv.aceite_em, aceite_hash: pv.aceite_hash },
    status_itens: STATUS_ITEM };
}

async function doCliente(supabase, tenantId, clienteId) {
  try { return (await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId).eq('cliente_id', clienteId))).map(enfeitar).sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em))); } catch { return []; }
}

module.exports = { descartarAditivo, STATUS_ITEM, STATUS_PV, statusPV, aoAceitar, criarPV, gerarManual, listar, detalhe, mudarStatusItem, cancelar, criarAditivo, validarAditivo, mudancasAditivo, aplicarAditivo, documento, doCliente, _definirEnvio };
