// backend/services/bidsCliente.js — etapa 15b
//
// O BID com o CLIENTE (decidido com o Marcony, 27/10/2026 — claude/desenho-bid-15b.md):
//   • 👁 Revisar e enviar: o comercial vê o documento final + checklist → 📨 Enviar ao cliente (confirmação) → fecha a versão,
//     e-mail com o LINK (token, sem login, como a cotação) + cópia ao responsável → "Aguardando o cliente".
//   • Depois do envio NADA muda em silêncio: ✏ Criar revisão (em_revisao) → editar → Revisar e enviar a v2 (nota obrigatória)
//     → o cliente é avisado e o link passa a mostrar a v2 ("atualizada — o que mudou"). Descartar volta ao que foi enviado.
//   • ✓✓ VISUALIZADO: cada abertura do link (1ª, última, quantas vezes — conta de novo após 10 min). 1ª abertura de cada
//     versão → linha do tempo + e-mail ao responsável.
//   • RESPOSTA POR ITEM: ✅ aprovar · ✏ pedir revisão (motivo + comentário) · ❌ recusar (motivo).
//       tudo aprovado → "Aguardando aceite" · tudo recusado → Perdido (recusado pelo cliente) · resto → "Revisão solicitada".
//   • ACEITE: código de 6 dígitos por e-mail (15 min, 5 tentativas) + nome + assinatura na tela → hash → Aceito (→ PV na 15c).
//     Exceção: "Registrar aceite fora do sistema" (comercial, com justificativa — como o "assinado no papel" do contrato).
// Regras do backend: sem DB.raw; ids com String(); filtros sem null; o mock não aplica default do banco.

const crypto = require('crypto');
const B = require('./bids');
const { q, texto, bidDoTenant, atividade, hojeBR, somaDias } = B;

let enviarEmail = async (para, assunto, html) => require('./emailService').enviarEmailFornecedor(para, assunto, html);
/** testes: troca o envio de e-mail */
function _definirEnvio(fn) { enviarEmail = fn; }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DECISOES = ['aprovado', 'revisar', 'recusado'];
const MOTIVOS_REVISAO = { valor: 'Valor', veiculo: 'Tipo de veículo / conjunto', data: 'Data / prazo', escopo: 'Escopo / condições', outro: 'Outro' };
const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dBR = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
const mascarar = (e) => { const [u, d] = String(e || '').split('@'); return d ? `${u.slice(0, 2)}${'•'.repeat(Math.max(1, u.length - 2))}@${d}` : ''; };
const hashCodigo = (token, codigo) => crypto.createHash('sha256').update(`${token}|${String(codigo).trim()}`).digest('hex');
const novoToken = () => crypto.randomBytes(24).toString('hex');

async function empresaDe(supabase, tenantId) { return (await q(supabase.from('tenants').select('*').eq('id', tenantId)))[0] || {}; }
async function versoesDe(supabase, tenantId, bidId) { return (await q(supabase.from('bid_versoes').select('*').eq('tenant_id', tenantId).eq('bid_id', bidId))).sort((a, b) => a.versao - b.versao); }
async function emailResponsavel(supabase, tenantId, b) {
  if (b.responsavel_id == null) return null;
  const u = (await q(supabase.from('usuarios').select('*').eq('tenant_id', tenantId).eq('id', b.responsavel_id)))[0];
  return u?.email && EMAIL.test(u.email) ? u.email : null;
}
async function upd(supabase, tenantId, b, campos) {
  const { data, error } = await supabase.from('bids').update({ ...campos, atualizado_em: new Date().toISOString() }).eq('id', b.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return data[0];
}
async function updVersao(supabase, tenantId, b, versao, campos) {
  const { error } = await supabase.from('bid_versoes').update(campos).eq('tenant_id', tenantId).eq('bid_id', b.id).eq('versao', versao);
  if (error) throw new Error(error.message);
}
/** e-mail sem derrubar o fluxo: falhou → registra e devolve o aviso */
async function mandar(para, assunto, html) {
  try { await enviarEmail(para, assunto, html); return null; } catch (e) { console.error('⚠️ [bid cliente] e-mail não enviado:', para, e?.message || e); return `O e-mail para ${para} não foi enviado (${e?.message || 'falha no envio'}). Copie o link e mande por outro canal.`; }
}
const casca = (emp, corpo) => `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#111;font-size:14px;line-height:1.55">
  <div style="font-weight:700;font-size:15px;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:14px">${esc(emp.nome_fantasia || emp.razao_social || emp.nome || '')}</div>${corpo}
  <div style="color:#888;font-size:11px;margin-top:24px">Enviado pelo QuotaFlow em nome de ${esc(emp.nome_fantasia || emp.razao_social || emp.nome || '')}.</div></div>`;
const botao = (url, txt) => `<p style="margin:20px 0"><a href="${url}" style="background:#2563eb;color:#fff;text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:700">${esc(txt)}</a></p><p style="font-size:12px;color:#666">Ou copie o endereço: ${esc(url)}</p>`;

// ─── checklist e revisão antes de enviar ────────────────────────────────────
function checklist(b, emp) {
  const erros = []; const avisos = [];
  if (!b.contato_email || !EMAIL.test(b.contato_email)) erros.push('E-mail do contato do cliente (✍ Dados e assinatura) — o link vai para ele');
  const t = B.totais(b.grupos || [], b.valor_total_manual);
  if (t.total == null) erros.push('Valor: informe o valor dos itens, o subtotal de cada grupo ou o valor total');
  if (!(b.grupos || []).some((g) => (g.itens || []).some((i) => Object.keys(i.valores || {}).length))) erros.push('Itens: preencha pelo menos um item');
  const vazios = (b.grupos || []).filter((g) => !String(g.titulo || '').trim()).length;
  if (vazios) avisos.push(`${vazios} ${(b.conteudo?.rotulo_grupo || 'grupo').toLowerCase()}(s) sem nome`);
  if (!emp.inscricao_estadual || !emp.opcao_fiscal) avisos.push('Empresa sem inscrição estadual ou opção fiscal (⚙️ Configurações → 🏢 Empresa) — sai em branco na Identificação');
  if (!b.assinante?.nome) avisos.push('Assinatura sem nome (✍ Dados e assinatura)');
  if (!b.titulo) avisos.push('Proposta sem título (✍ Dados e assinatura) — o assunto do e-mail fica só com o número');
  const semValor = (b.grupos || []).reduce((s, g) => s + (g.itens || []).filter((i) => i.valor == null).length, 0);
  if (semValor && t.total != null && b.valor_total_manual == null && (b.grupos || []).some((g) => g.valor == null)) avisos.push(`${semValor} item(ns) sem valor — o subtotal soma só os que têm`);
  return { erros, avisos };
}
const podeEnviar = (b) => ['elaboracao', 'revisao_solicitada'].includes(b.fase) || (b.em_revisao && B.COM_CLIENTE.includes(b.fase));
/** 👁 Revisar e enviar: o documento como o cliente vai ver + checklist + o que muda em relação à versão enviada */
async function revisao(supabase, tenantId, id) {
  const b = await bidDoTenant(supabase, tenantId, id); if (!b) return { status: 404, erro: 'BID não encontrado' };
  if (!podeEnviar(b)) return { status: 409, erro: 'Nada para enviar agora' };
  const [emp, vers] = await Promise.all([empresaDe(supabase, tenantId), versoesDe(supabase, tenantId, b.id)]);
  const enviada = vers.find((v) => v.versao === b.versao_enviada);
  const mudancas = enviada ? B.diferencas(enviada.snapshot, B.retrato(b)) : null;
  const prox = (b.versao_atual || 0) + (b.alterado_desde_versao || !b.versao_atual ? 1 : 0);
  return { documento: await B.documento(supabase, tenantId, b.id), checklist: checklist(b, emp), para: b.contato_email || null, proxima_versao: prox,
    versao_enviada: b.versao_enviada || 0, mudancas, nada_mudou: !!enviada && !b.alterado_desde_versao, resposta: enviada?.resposta || null,
    email: { assunto: assuntoPadrao(b, prox), texto: textoPadrao(b, prox), assinatura: [...assinaturaEmail(b, b.responsavel_nome), emp.nome_fantasia || emp.razao_social || emp.nome || ''].filter(Boolean),
      validade: `${b.validade_dias} dias (até ${dBR(somaDias(hojeBR(), Number(b.validade_dias || 10)))})` } };
}

// ─── envio ─────────────────────────────────────────────────────────────────
// 15b.1: o e-mail é PADRONIZADO e aparece pré-carregado (editável) no 👁 Revisar e enviar:
//   assunto  "BID-2026-0002 — <título da proposta>" (sem título: a referência do cliente; v2+: "atualizada — versão N")
//   texto    saudação + parágrafo padrão (editável) → [o que mudou] → botão do link → validade → assinatura (fixos)
const assuntoPadrao = (b, v) => `${b.numero}${b.titulo ? ` — ${b.titulo}` : b.referencia ? ` — ${b.referencia}` : ''}${v > 1 ? ` (atualizada — versão ${v})` : ''}`;
function textoPadrao(b, v) {
  const ola = `Olá${b.contato_nome ? `, ${b.contato_nome.split(' ')[0]}` : ''}!`;
  const ref = b.referencia ? ` (${b.referencia})` : '';
  return v > 1
    ? `${ola}\n\nAtualizamos a nossa proposta ${b.numero}${ref} para a versão ${v}, conforme conversamos. Pelo link abaixo você vê o documento completo e responde item por item: aprovar, pedir revisão ou recusar.`
    : `${ola}\n\nSegue a nossa proposta ${b.numero}${b.titulo ? ` — ${b.titulo}` : ''}${ref}. Pelo link abaixo você vê o documento completo e responde item por item: aprovar, pedir revisão ou recusar. Se tudo estiver certo, o aceite é assinado ali mesmo.\n\nQualquer dúvida, estou à disposição.`;
}
const assinaturaEmail = (b, respNome) => [b.assinante?.nome || respNome, b.assinante?.cargo, b.assinante?.registro, b.assinante?.telefones].filter(Boolean);
function emailEnvio(emp, b, v, url, { assunto, texto: corpoTexto, mudancas, nota, respNome } = {}) {
  const nova = v > 1;
  const paragrafos = String(corpoTexto || textoPadrao(b, v)).split(/\n{2,}/).map((x) => x.trim()).filter(Boolean)
    .map((x) => `<p style="white-space:pre-wrap">${esc(x)}</p>`).join('');
  const corpo = `${paragrafos}
    ${nova && (nota || (mudancas || []).length) ? `<p><b>O que mudou:</b>${nota ? ` ${esc(nota)}` : ''}</p>${(mudancas || []).length ? `<ul>${mudancas.slice(0, 12).map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}` : ''}
    ${botao(url, nova ? 'Ver a proposta atualizada' : 'Ver a proposta')}
    <p>Validade: ${b.validade_dias} dias (até ${dBR(somaDias(hojeBR(), Number(b.validade_dias || 10)))}).</p>
    <p>Atenciosamente,<br/>${assinaturaEmail(b, respNome).map(esc).join('<br/>')}<br/><b>${esc(emp.nome_fantasia || emp.razao_social || emp.nome || '')}</b></p>`;
  return { assunto: String(assunto || '').trim() || assuntoPadrao(b, v), html: casca(emp, corpo) };
}
/** 📨 Enviar ao cliente: { assunto, texto (do e-mail — vazio = o padrão), nota (obrigatória a partir da v2) } */
async function enviar(supabase, tenantId, quem, id, { assunto, texto: corpoTexto, mensagem, nota } = {}) {
  corpoTexto = corpoTexto ?? mensagem; // compatível com a 15b
  let b = await bidDoTenant(supabase, tenantId, id); if (!b) return { status: 404, erro: 'BID não encontrado' };
  if (!podeEnviar(b)) return { status: 409, erro: b.fase === 'aceito' || b.fase === 'perdido' ? `BID ${B.FASE_NOME[b.fase].toLowerCase()}` : 'O BID já está com o cliente — use ✏ Criar revisão' };
  const emp = await empresaDe(supabase, tenantId);
  const ck = checklist(b, emp); if (ck.erros.length) return { status: 409, erro: `Falta: ${ck.erros.join(' · ')}` };
  const reenvio = b.versao_enviada > 0;
  if (reenvio && !b.alterado_desde_versao) return { status: 409, erro: `Nada mudou desde a v${b.versao_enviada} — ajuste o documento antes de enviar de novo` };
  if (reenvio && !texto(nota, 500)) return { status: 400, erro: 'Diga ao cliente o que mudou nesta versão' };
  const vers = await versoesDe(supabase, tenantId, b.id); const anterior = vers.find((v) => v.versao === b.versao_enviada);
  if (b.alterado_desde_versao || !b.versao_atual) { const r = await B.fecharVersao(supabase, tenantId, quem, b.id, { nota: reenvio ? nota : 'enviada ao cliente' }, b); if (r.erro) return r; b = await bidDoTenant(supabase, tenantId, b.id); }
  const v = b.versao_atual; const agora = new Date().toISOString(); const token = b.token || novoToken(); const para = b.contato_email;
  const mudancas = anterior ? B.diferencas(anterior.snapshot, B.retrato(b)) : [];
  if (anterior) await updVersao(supabase, tenantId, b, anterior.versao, { substituida_em: agora });
  await updVersao(supabase, tenantId, b, v, { enviada_em: agora, enviada_para: para, mensagem: texto(corpoTexto, 4000), vista_em: null, vista_qtd: 0, respondida_em: null, resposta: null });
  b = await upd(supabase, tenantId, b, { token, fase: 'aguardando_cliente', fase_desde: agora, enviado_em: agora, versao_enviada: v, em_revisao: false, envio_para: para,
    valido_ate: somaDias(hojeBR(), Number(b.validade_dias || 10)), visto_primeiro_em: null, visto_ultimo_em: null, visto_qtd: 0, respondido_em: null, codigo_hash: null, codigo_expira: null, codigo_tentativas: 0 });
  const url = B.linkCliente(token);
  const e = emailEnvio(emp, b, v, url, { assunto: texto(assunto, 200), texto: texto(corpoTexto, 4000), mudancas, nota: texto(nota, 500), respNome: quem.usuarioNome });
  const falhas = [await mandar(para, e.assunto, e.html)];
  const resp = await emailResponsavel(supabase, tenantId, b);
  if (resp && resp.toLowerCase() !== para.toLowerCase()) falhas.push(await mandar(resp, `[cópia] ${e.assunto} — para ${para}`, e.html));
  await atividade(supabase, tenantId, quem, { bid_id: b.id, cliente_id: b.cliente_id, tipo: 'evento', texto: `📨 v${v} enviada para ${para}${reenvio ? ` — ${texto(nota, 200)}` : ''} · válida até ${dBR(b.valido_ate)}` });
  const aviso = falhas.filter(Boolean)[0] || null;
  return { ok: true, versao: v, link: url, para, aviso };
}
/** ↻ Reenviar o e-mail da versão que está com o cliente (mesmo link) */
async function reenviarEmail(supabase, tenantId, quem, id) {
  const b = await bidDoTenant(supabase, tenantId, id); if (!b) return { status: 404, erro: 'BID não encontrado' };
  if (!B.COM_CLIENTE.includes(b.fase) || !b.token) return { status: 409, erro: 'O BID não está com o cliente' };
  const emp = await empresaDe(supabase, tenantId); const url = B.linkCliente(b.token);
  const v = (await versoesDe(supabase, tenantId, b.id)).find((x) => x.versao === b.versao_enviada);
  const e = emailEnvio(emp, b, b.versao_enviada, url, { texto: v?.mensagem, respNome: quem.usuarioNome });
  const aviso = await mandar(b.envio_para || b.contato_email, `Lembrete: ${e.assunto}`, e.html);
  if (!aviso) await atividade(supabase, tenantId, quem, { bid_id: b.id, cliente_id: b.cliente_id, tipo: 'evento', texto: `↻ E-mail reenviado para ${b.envio_para || b.contato_email}` });
  return { ok: !aviso, aviso, link: url };
}
/** ✏ Criar revisão: libera a edição; o cliente segue vendo a versão enviada até o novo envio */
async function iniciarRevisao(supabase, tenantId, quem, id) {
  const b = await bidDoTenant(supabase, tenantId, id); if (!b) return { status: 404, erro: 'BID não encontrado' };
  if (!B.COM_CLIENTE.includes(b.fase)) return { status: 409, erro: 'Só dá para criar revisão de um BID que está com o cliente' };
  if (b.em_revisao) return { bid: b };
  const r = await upd(supabase, tenantId, b, { em_revisao: true });
  await atividade(supabase, tenantId, quem, { bid_id: b.id, cliente_id: b.cliente_id, tipo: 'evento', texto: `✏ Revisão iniciada (o cliente segue vendo a v${b.versao_enviada} até o novo envio)` });
  return { bid: r };
}
/** ✕ Descartar a revisão: o documento volta a ser o que foi enviado */
async function descartarRevisao(supabase, tenantId, quem, id) {
  const b = await bidDoTenant(supabase, tenantId, id); if (!b) return { status: 404, erro: 'BID não encontrado' };
  const naRevisao = b.em_revisao || b.fase === 'revisao_solicitada';
  if (!naRevisao || !b.versao_enviada) return { status: 409, erro: 'Não há revisão para descartar' };
  const v = (await versoesDe(supabase, tenantId, b.id)).find((x) => x.versao === b.versao_enviada); if (!v) return { status: 404, erro: 'Versão enviada não encontrada' };
  const s = v.snapshot || {};
  const campos = { titulo: s.titulo ?? null, referencia: s.referencia ?? null, contato_nome: s.contato_nome ?? null, conteudo: s.conteudo || {}, grupos: s.grupos || [], condicoes: s.condicoes || {},
    valor_total_manual: s.valor_total_manual ?? null, valor_total: s.valor_total ?? null, validade_dias: s.validade_dias, assinante: s.assinante || {}, alterado_desde_versao: v.versao !== b.versao_atual };
  if (b.em_revisao) campos.em_revisao = false;
  const r = await upd(supabase, tenantId, b, campos);
  await atividade(supabase, tenantId, quem, { bid_id: b.id, cliente_id: b.cliente_id, tipo: 'evento', texto: `✕ Alterações descartadas — o documento voltou à v${v.versao}` });
  return { bid: r };
}
/** ✍ Aceite fora do sistema (cliente aceitou por e-mail/papel) — com justificativa */
async function aceiteExterno(supabase, tenantId, quem, id, { justificativa, data } = {}) {
  const b = await bidDoTenant(supabase, tenantId, id); if (!b) return { status: 404, erro: 'BID não encontrado' };
  if (!['aguardando_cliente', 'aguardando_aceite', 'revisao_solicitada'].includes(b.fase) || !b.versao_enviada) return { status: 409, erro: 'Só depois de enviar o BID ao cliente' };
  if (b.em_revisao || b.alterado_desde_versao) return { status: 409, erro: 'Há alterações não enviadas — envie ou descarte antes de registrar o aceite' };
  const j = texto(justificativa, 500); if (!j || j.length < 10) return { status: 400, erro: 'Explique como o cliente aceitou (mínimo 10 caracteres) — fica registrado' };
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(data || '')) ? data : hojeBR(); if (d > hojeBR()) return { status: 400, erro: 'Data do aceite no futuro' };
  const em = new Date(`${d}T12:00:00-03:00`).toISOString();
  const v = (await versoesDe(supabase, tenantId, b.id)).find((x) => x.versao === b.versao_enviada);
  const hash = crypto.createHash('sha256').update(`${v?.hash}|fora_sistema|${j}|${em}|${quem.usuarioNome}`).digest('hex');
  const r = await upd(supabase, tenantId, b, { fase: 'aceito', fase_desde: new Date().toISOString(), ganho_em: em, aceite_canal: 'fora_sistema', aceite_obs: j, aceite_nome: `Registrado por ${quem.usuarioNome || 'usuário'}`, aceite_em: em, aceite_versao: b.versao_enviada, aceite_hash: hash, aceite_png: null, codigo_hash: null });
  await atividade(supabase, tenantId, quem, { bid_id: b.id, cliente_id: b.cliente_id, tipo: 'evento', texto: `✓ Aceite fora do sistema (v${b.versao_enviada}, ${dBR(d)}): ${j}` });
  return { bid: r };
}

// ─── link do cliente (público) ──────────────────────────────────────────────
async function bidPorToken(supabase, token) {
  if (!/^[a-f0-9]{48}$/i.test(String(token || ''))) return null;
  return (await q(supabase.from('bids').select('*').eq('token', token)))[0] || null;
}
const faseCliente = (b) => (b.fase === 'perdido' ? 'encerrado' : b.fase === 'aceito' ? 'aceito' : b.fase === 'aguardando_aceite' ? 'aceite' : b.fase === 'aguardando_cliente' ? 'responder' : 'em_revisao');
/** abertura do link: registra o "visualizado" (conta de novo depois de 10 min) e avisa o responsável na 1ª abertura da versão */
async function registrarVisualizacao(supabase, b, { ip, agente } = {}) {
  if (!b.versao_enviada) return b;
  const agora = new Date(); const ultimo = b.visto_ultimo_em ? new Date(b.visto_ultimo_em) : null;
  const conta = !ultimo || agora - ultimo > 10 * 60000; const primeira = !b.visto_primeiro_em;
  const campos = { visto_ultimo_em: agora.toISOString() };
  if (primeira) campos.visto_primeiro_em = agora.toISOString();
  if (conta) campos.visto_qtd = Number(b.visto_qtd || 0) + 1;
  const { error } = await supabase.from('bids').update(campos).eq('id', b.id).eq('tenant_id', b.tenant_id); if (error) throw new Error(error.message);
  if (conta) {
    await supabase.from('bid_visualizacoes').insert([{ tenant_id: b.tenant_id, bid_id: b.id, versao: b.versao_enviada, ip: texto(ip, 60), agente: texto(agente, 200), em: agora.toISOString() }]);
    const v = (await versoesDe(supabase, b.tenant_id, b.id)).find((x) => x.versao === b.versao_enviada);
    if (v) await updVersao(supabase, b.tenant_id, b, v.versao, { vista_em: v.vista_em || agora.toISOString(), vista_qtd: Number(v.vista_qtd || 0) + 1 });
  }
  if (primeira) {
    await atividade(supabase, b.tenant_id, { usuarioNome: b.contato_nome || 'Cliente' }, { bid_id: b.id, cliente_id: b.cliente_id, tipo: 'evento', texto: `👁 O cliente abriu a v${b.versao_enviada}` });
    const para = await emailResponsavel(supabase, b.tenant_id, b);
    if (para) { const emp = await empresaDe(supabase, b.tenant_id);
      await mandar(para, `👁 ${b.cliente_nome} abriu a proposta ${b.numero}`, casca(emp, `<p><b>${esc(b.cliente_nome)}</b> abriu a proposta <b>${esc(b.numero)}</b> (v${b.versao_enviada}) agora há pouco.</p><p>Bom momento para um contato: "Oi! Vi que você abriu a proposta — ficou alguma dúvida?"</p>`)); }
  }
  return { ...b, ...campos };
}
/** o que a página do cliente mostra */
async function paginaCliente(supabase, b, meta = {}) {
  if (B.COM_CLIENTE.includes(b.fase) || b.fase === 'revisao_solicitada') b = await registrarVisualizacao(supabase, b, meta);
  const vers = await versoesDe(supabase, b.tenant_id, b.id);
  const v = vers.find((x) => x.versao === b.versao_enviada);
  if (!v) return { status: 404, erro: 'Proposta ainda não enviada' };
  const doc = await B.documento(supabase, b.tenant_id, b.id, v.versao);
  const anterior = vers.filter((x) => x.versao < v.versao && x.resposta).pop();
  // sugere a decisão anterior para o item que NÃO mudou desde a resposta anterior
  let sugestao = {};
  if (!v.resposta && anterior?.resposta?.itens) {
    const itensAnt = new Map((anterior.snapshot?.grupos || []).flatMap((g) => g.itens.map((i) => [i.id, JSON.stringify({ g: g.titulo, ...i })])));
    for (const g of v.snapshot?.grupos || []) for (const i of g.itens) { const r = anterior.resposta.itens[i.id]; if (r && itensAnt.get(i.id) === JSON.stringify({ g: g.titulo, ...i })) sugestao[i.id] = r; }
  }
  let logo = null; try { logo = (await require('./logoEmpresa').obter(supabase, b.tenant_id)).logo; } catch { logo = null; }
  const vencido = B.COM_CLIENTE.includes(b.fase) && !!b.valido_ate && b.valido_ate < hojeBR();
  return {
    numero: b.numero, versao: v.versao, fase: faseCliente(b), vencido, valido_ate: b.valido_ate, logo, documento: doc,
    atualizacao: v.versao > 1 ? { em: v.enviada_em, nota: v.nota, mudancas: v.mudancas || [] } : null,
    resposta: v.resposta || null, sugestao, mensagem: v.mensagem || null, email_mascarado: mascarar(b.envio_para || b.contato_email),
    codigo_enviado: !!b.codigo_hash && !!b.codigo_expira && new Date(b.codigo_expira) > new Date(),
    aceite: b.aceite_em ? { nome: b.aceite_nome, cargo: b.aceite_cargo, em: b.aceite_em, hash: b.aceite_hash, versao: b.aceite_versao, png: b.aceite_png, canal: b.aceite_canal } : null,
    contato: { responsavel: b.assinante?.nome || b.responsavel_nome || null, telefones: b.assinante?.telefones || null, empresa: doc.empresa?.nome_fantasia || doc.empresa?.razao_social },
    motivos_revisao: MOTIVOS_REVISAO,
  };
}
/** 💬 resposta do cliente, item por item: { nome, cargo, geral, itens: { item_id: { decisao, motivo, comentario } } } */
async function responder(supabase, b, body = {}) {
  if (b.fase !== 'aguardando_cliente') return { status: 409, erro: b.fase === 'revisao_solicitada' ? 'Recebemos a sua resposta — a empresa está revisando a proposta' : 'Esta proposta não está aguardando resposta' };
  if (b.valido_ate && b.valido_ate < hojeBR()) return { status: 409, erro: 'A validade desta proposta venceu — fale com a empresa para renovar' };
  const nome = texto(body.nome, 120); if (!nome) return { status: 400, erro: 'Informe o seu nome' };
  const vers = await versoesDe(supabase, b.tenant_id, b.id); const v = vers.find((x) => x.versao === b.versao_enviada); if (!v) return { status: 404, erro: 'Versão não encontrada' };
  const itens = (v.snapshot?.grupos || []).flatMap((g) => g.itens.map((i) => ({ ...i, grupo: g.titulo })));
  const resp = {}; const cont = { aprovado: 0, revisar: 0, recusado: 0 }; const motivos = [];
  for (const it of itens) {
    const r = (body.itens || {})[it.id] || {};
    if (!DECISOES.includes(r.decisao)) return { status: 400, erro: 'Responda todos os itens (aprovar, pedir revisão ou recusar)' };
    const comentario = texto(r.comentario, 1000);
    if (r.decisao === 'revisar' && !MOTIVOS_REVISAO[r.motivo]) return { status: 400, erro: 'Escolha o motivo de cada revisão pedida' };
    if (r.decisao === 'revisar' && r.motivo === 'outro' && !comentario) return { status: 400, erro: 'Descreva o que precisa ser revisto' };
    if (r.decisao === 'recusado' && !comentario) return { status: 400, erro: 'Diga o motivo de cada item recusado' };
    resp[it.id] = { decisao: r.decisao, ...(r.decisao === 'revisar' ? { motivo: r.motivo } : {}), ...(comentario ? { comentario } : {}) };
    cont[r.decisao]++; if (r.decisao !== 'aprovado') motivos.push(`${it.grupo ? `${it.grupo} — ` : ''}${it.valores?.modelo || it.valores?.veiculo || 'item'}: ${r.decisao === 'revisar' ? MOTIVOS_REVISAO[r.motivo] : 'recusado'}${comentario ? ` (${comentario})` : ''}`);
  }
  const agora = new Date().toISOString();
  const resposta = { nome, cargo: texto(body.cargo, 80), geral: texto(body.geral, 2000), itens: resp, em: agora };
  await updVersao(supabase, b.tenant_id, b, v.versao, { resposta, respondida_em: agora });
  const total = itens.length;
  const fase = cont.aprovado === total ? 'aguardando_aceite' : cont.recusado === total ? 'perdido' : 'revisao_solicitada';
  const campos = { fase, fase_desde: agora, respondido_em: agora };
  if (fase === 'perdido') Object.assign(campos, { perdido_em: agora, motivo_perda: 'recusado_cliente', perda_obs: texto([resposta.geral, ...motivos].filter(Boolean).join(' · '), 300) });
  await upd(supabase, b.tenant_id, b, campos);
  const resumo = [cont.aprovado && `${cont.aprovado} aprovado(s)`, cont.revisar && `${cont.revisar} revisão(ões)`, cont.recusado && `${cont.recusado} recusado(s)`].filter(Boolean).join(' · ');
  await atividade(supabase, b.tenant_id, { usuarioNome: `${nome} (cliente)` }, { bid_id: b.id, cliente_id: b.cliente_id, tipo: 'evento', texto: `💬 O cliente respondeu a v${v.versao}: ${resumo}${resposta.geral ? ` — "${resposta.geral}"` : ''} → ${B.FASE_NOME[fase]}` });
  const para = await emailResponsavel(supabase, b.tenant_id, b);
  if (para) { const emp = await empresaDe(supabase, b.tenant_id);
    await mandar(para, `💬 ${b.cliente_nome} respondeu a proposta ${b.numero}: ${resumo}`, casca(emp, `<p><b>${esc(nome)}</b> (${esc(b.cliente_nome)}) respondeu a v${v.versao} da proposta <b>${esc(b.numero)}</b>: ${esc(resumo)}.</p>
      ${motivos.length ? `<ul>${motivos.slice(0, 20).map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}${resposta.geral ? `<p>Comentário: "${esc(resposta.geral)}"</p>` : ''}
      <p>${fase === 'aguardando_aceite' ? 'Tudo aprovado — falta o cliente assinar o aceite.' : fase === 'perdido' ? 'O cliente recusou todos os itens — o BID foi para Perdido.' : 'Abra o BID em 📈 Comercial, ajuste o que foi pedido e envie a nova versão.'}</p>`)); }
  return { ok: true, fase: faseCliente({ ...b, fase }) };
}
/** 🔐 código de 6 dígitos por e-mail para assinar o aceite (15 min; novo pedido só depois de 60 s) */
async function enviarCodigo(supabase, b) {
  if (b.fase !== 'aguardando_aceite') return { status: 409, erro: 'Esta proposta não está aguardando o aceite' };
  if (b.valido_ate && b.valido_ate < hojeBR()) return { status: 409, erro: 'A validade desta proposta venceu — fale com a empresa para renovar' };
  const para = b.envio_para || b.contato_email; if (!para) return { status: 409, erro: 'Proposta sem e-mail de contato' };
  if (b.codigo_expira && new Date(b.codigo_expira) - Date.now() > 14 * 60000) return { status: 429, erro: 'Código enviado agora há pouco — confira a caixa de entrada (e o spam)' };
  const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await upd(supabase, b.tenant_id, b, { codigo_hash: hashCodigo(b.token, codigo), codigo_expira: new Date(Date.now() + 15 * 60000).toISOString(), codigo_tentativas: 0 });
  const emp = await empresaDe(supabase, b.tenant_id);
  const aviso = await mandar(para, `Código para assinar a proposta ${b.numero}: ${codigo}`, casca(emp, `<p>O seu código para assinar o aceite da proposta <b>${esc(b.numero)}</b> é:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${codigo}</p><p>Vale por 15 minutos. Se não foi você, ignore este e-mail.</p>`));
  if (aviso) return { status: 503, erro: 'Não conseguimos enviar o código agora. Tente de novo em instantes.' };
  return { ok: true, email: mascarar(para) };
}
/** ✍ aceite: { codigo, nome, cargo, assinatura_png } */
async function aceitar(supabase, b, body = {}, { ip } = {}) {
  if (b.fase !== 'aguardando_aceite') return { status: 409, erro: b.fase === 'aceito' ? 'Esta proposta já foi aceita' : 'Esta proposta não está aguardando o aceite' };
  if (b.valido_ate && b.valido_ate < hojeBR()) return { status: 409, erro: 'A validade desta proposta venceu — fale com a empresa para renovar' };
  if (!b.codigo_hash || !b.codigo_expira) return { status: 400, erro: 'Peça o código por e-mail primeiro' };
  if (new Date(b.codigo_expira) < new Date()) return { status: 400, erro: 'O código venceu — peça um novo' };
  if (Number(b.codigo_tentativas || 0) >= 5) return { status: 429, erro: 'Muitas tentativas — peça um novo código' };
  if (hashCodigo(b.token, body.codigo) !== b.codigo_hash) { await upd(supabase, b.tenant_id, b, { codigo_tentativas: Number(b.codigo_tentativas || 0) + 1 }); return { status: 400, erro: `Código incorreto (${4 - Number(b.codigo_tentativas || 0)} tentativa(s) restante(s))` }; }
  const nome = texto(body.nome, 120); if (!nome) return { status: 400, erro: 'Informe o seu nome' };
  const png = body.assinatura_png;
  if (typeof png !== 'string' || !png.startsWith('data:image/png;base64,') || png.length < 200 || png.length > 400 * 1024) return { status: 400, erro: 'Assine na tela para aceitar' };
  const v = (await versoesDe(supabase, b.tenant_id, b.id)).find((x) => x.versao === b.versao_enviada);
  const em = new Date().toISOString(); const email = b.envio_para || b.contato_email;
  const hash = crypto.createHash('sha256').update(`${v?.hash}|${nome}|${email}|${em}|${png}`).digest('hex');
  await upd(supabase, b.tenant_id, b, { fase: 'aceito', fase_desde: em, ganho_em: em, aceite_canal: 'link', aceite_nome: nome, aceite_cargo: texto(body.cargo, 80), aceite_email: email, aceite_em: em, aceite_png: png,
    aceite_hash: hash, aceite_versao: b.versao_enviada, aceite_ip: texto(ip, 60), codigo_hash: null, codigo_expira: null, codigo_tentativas: 0 });
  await atividade(supabase, b.tenant_id, { usuarioNome: `${nome} (cliente)` }, { bid_id: b.id, cliente_id: b.cliente_id, tipo: 'evento', texto: `✍ Aceito pelo cliente — ${nome}${texto(body.cargo, 80) ? `, ${texto(body.cargo, 80)}` : ''} (v${b.versao_enviada}, código confirmado em ${email})` });
  const emp = await empresaDe(supabase, b.tenant_id); const url = B.linkCliente(b.token);
  await mandar(email, `Aceite registrado — proposta ${b.numero}`, casca(emp, `<p>Registramos o seu aceite da proposta <b>${esc(b.numero)}</b> (versão ${b.versao_enviada}) em ${new Date(em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.</p>${botao(url, 'Ver / imprimir a proposta aceita')}<p style="font-size:11px;color:#777">Código de integridade (SHA-256): ${hash}</p>`));
  const para = await emailResponsavel(supabase, b.tenant_id, b);
  if (para) await mandar(para, `✍ ${b.cliente_nome} aceitou a proposta ${b.numero}`, casca(emp, `<p><b>${esc(nome)}</b> (${esc(b.cliente_nome)}) assinou o aceite da proposta <b>${esc(b.numero)}</b> (v${b.versao_enviada}, ${esc(B.brl(v?.valor_total) || '')}).</p>`));
  return { ok: true, aceite_em: em, aceite_hash: hash };
}

/** rotina diária (CRON_INTERNO): validade vence em 2 dias → e-mail ao responsável */
async function avisosDiarios(supabase, { hoje = hojeBR() } = {}) {
  const alvo = somaDias(hoje, 2); let n = 0;
  const bs = (await q(supabase.from('bids').select('*'))).filter((b) => B.COM_CLIENTE.includes(b.fase) && b.valido_ate === alvo);
  for (const b of bs) {
    const para = await emailResponsavel(supabase, b.tenant_id, b); if (!para) continue;
    const emp = await empresaDe(supabase, b.tenant_id);
    if (!(await mandar(para, `⌛ A proposta ${b.numero} (${b.cliente_nome}) vence em 2 dias`, casca(emp, `<p>A proposta <b>${esc(b.numero)}</b> para <b>${esc(b.cliente_nome)}</b> vence em ${dBR(alvo)} e ${b.fase === 'aguardando_aceite' ? 'ainda falta o cliente assinar o aceite' : b.visto_primeiro_em ? `foi aberta ${b.visto_qtd}× sem resposta` : 'ainda não foi aberta'}.</p>`)))) n++;
  }
  return { avisos: n };
}

module.exports = { assuntoPadrao, textoPadrao, MOTIVOS_REVISAO, checklist, revisao, enviar, reenviarEmail, iniciarRevisao, descartarRevisao, aceiteExterno,
  bidPorToken, paginaCliente, registrarVisualizacao, responder, enviarCodigo, aceitar, avisosDiarios, _definirEnvio, mascarar };
