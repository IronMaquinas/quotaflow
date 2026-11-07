// backend/services/ocorrencias.js — etapa 18h
//
// ⚠️ Ocorrência / sinistro unificado — INC-LC-AAAA-NNNN (locação) · INC-TR-AAAA-NNNN (transporte) (migrations 068/069, número pelo trigger, imutável).
//   Duas portas, um registro:
//     • pela AT (transporte): contexto = motorista, conjunto, carga, documentos (NF-e/CT-e/MDF-e/averbação), última posição do fluxo
//     • pelo contrato de locação: o LOCATÁRIO (ou a empresa) escolhe um equipamento locado; contexto = contrato, equipamento
//       (tag/modelo/série), local da obra e a última inspeção com o resultado
//   O contexto é um retrato do momento (não muda se a AT/contrato mudarem depois).
//   "Equipamento parado" só AVISA — o comercial decide (nada é descontado sozinho; a medição só mostra os dias parados).
//   Ao registrar: e-mail para quem está em ⚙️ Configurações → ⚠️ Ocorrências (padrão: locação → Comercial · transporte → Operação; admin nunca)
//   + tarefa (padrão TSK-CM na locação, TSK-MT no transporte) com o 1º responsável escolhido, ligada à ocorrência.
//   Status: registrada → em_analise → em_atendimento → encerrada · Responsabilidade: cliente / locadora / seguro / a_definir
//   Conversa com o cliente (mensagens) e fotos/BO dos dois lados enquanto não encerrada.
const crypto = require('crypto');

const TIPOS = { avaria: 'Avaria / dano', pane: 'Pane / falha mecânica', acidente: 'Acidente', furto: 'Furto / roubo', outro: 'Outro' };
const STATUS = { registrada: 'Registrada', em_analise: 'Em análise', em_atendimento: 'Em atendimento', encerrada: 'Encerrada' };
const RESP = { a_definir: 'A definir', cliente: 'Cliente', locadora: 'Locadora', seguro: 'Seguro' };
const MIME = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };
const LIMITE = 10 * 1024 * 1024;
const MAX_FOTOS = 20;
const BUCKET = 'documentos';
const texto = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const jsonArr = (v) => (Array.isArray(v) ? v : []);
const ERRO_068 = { status: 409, erro: 'Falta rodar a migration 068 (ocorrências) no Supabase.' };
const sem068 = (e) => /ocorrencias|relation .* does not exist|schema cache/i.test(String(e?.message || e));
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const entrada = (quem, acao, extra = {}) => ({ em: new Date().toISOString(), por: quem?.usuarioNome || null, lado: quem?.lado || 'empresa', acao, ...extra });

// ─── contexto ────────────────────────────────────────────────────────────────
function ultimaPosicao(ex) {
  const feitas = jsonArr(ex.fluxo).filter((e) => e.gps && (e.feita_em || e.status === 'feita')).sort((a, b) => String(a.feita_em || '').localeCompare(String(b.feita_em || '')));
  const u = feitas[feitas.length - 1]; return u ? { gps: u.gps, em: u.feita_em || null, etapa: u.rotulo || null } : null;
}
async function contextoAT(supabase, tenantId, ex) {
  const docs = jsonArr(ex.anexos).filter((a) => !a.retirado).map((a) => ({ tipo: a.tipo, nome: a.nome, chave: a.chave || null, versao: a.versao || 1 }));
  let fiscal = null;
  try { const t = (await q(supabase.from('tarefas').select('*').eq('tenant_id', tenantId).eq('origem', 'fiscal'))).find((x) => jsonArr(x.vinculos).some((v) => v.tipo === 'at' && String(v.id) === String(ex.id)));
    if (t) fiscal = { tarefa: t.numero || null, averbacoes: jsonArr(t.checklist?.averbacao?.entradas).map((e) => e.numero).filter(Boolean),
      ctes: jsonArr(t.checklist?.cte?.entradas).map((e) => e.chave || e.numero).filter(Boolean) }; } catch { /* opcional */ }
  return {
    at: { id: ex.id, numero: ex.numero, status: ex.status, cliente: ex.cliente_nome || ex.cliente || null, inicio_previsto: ex.inicio_previsto || null, fim_previsto: ex.fim_previsto || null },
    motorista: { id: ex.motorista_id || null, nome: ex.motorista_nome || null },
    conjunto: jsonArr(ex.conjunto).map((c) => ({ id: c.id, tag: c.tag || null, placa: c.placa || null, nome: c.nome || null })),
    carga: jsonArr(ex.itens).map((i) => ({ descricao: i.descricao || i.nome || i.carga || null, origem: i.origem || null, destino: i.destino || null, peso: i.peso ?? null })),
    documentos: docs, apolice: ex.apolice || null, fiscal, ultima_posicao: ultimaPosicao(ex),
  };
}
async function contextoContrato(supabase, tenantId, contrato, locacao, eq) {
  let ultima = null;
  try {
    const ins = (await q(supabase.from('inspecoes').select('*').eq('tenant_id', tenantId).eq('equipamento_id', eq.id))).filter((i) => i.concluida_em)
      .sort((a, b) => String(b.concluida_em).localeCompare(String(a.concluida_em)))[0];
    if (ins) ultima = { id: ins.id, numero: ins.numero || null, em: ins.concluida_em, resultado: ins.resultado || null, executor: ins.executor_nome || null,
      nao_ok: jsonArr(ins.respostas).filter((r) => r.status === 'nok').map((r) => r.rotulo).slice(0, 20) };
  } catch { /* sem inspeções */ }
  return {
    contrato: { id: contrato.id, numero: contrato.numero, cliente: contrato.cliente || contrato.cliente_nome || null, local: contrato.local || null },
    equipamento: { id: eq.id, tag: eq.tag || null, nome: eq.nome || null, modelo: eq.modelo || null, serie: eq.numero_serie || eq.serie || null, placa: eq.placa || null },
    locacao: locacao ? { id: locacao.id, inicio: locacao.inicio || null } : null, ultima_inspecao: ultima,
  };
}

// ─── escopo ──────────────────────────────────────────────────────────────────
const CT = () => require('./contratosLocacao');
async function doTenant(supabase, tenantId, id) { return (await q(supabase.from('ocorrencias').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] || null; }
/** locatário: só ocorrência de contrato dele */
async function doLocatario(supabase, tenantId, usuarioId, id) {
  const o = await doTenant(supabase, tenantId, id); if (!o || o.origem !== 'contrato') return null;
  const esc = await CT().escopoLocatario(supabase, tenantId, usuarioId);
  return esc.contratos.some((c) => String(c.id) === String(o.contrato_id)) ? o : null;
}

// ─── e-mail ──────────────────────────────────────────────────────────────────
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escH = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const frontendURL = () => String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/^FRONTEND_URL=/, '').replace(/\/+$/, '');
let enviarEmail = async (para, assunto, html) => require('./emailService').enviarEmailFornecedor(para, assunto, html);
function _definirEnvio(fn) { enviarEmail = fn; }
// ─── 18h.4a/4c: ⚙️ Configurações → ⚠️ Ocorrências, por origem (lc = locação · tr = transporte) ─────
//   • perfis  = quem tem ACESSO às ocorrências da origem (vê, acompanha, muda situação). Gestor e admin sempre têm. NÃO recebem e-mail.
//   • pessoas = as ÚNICAS que recebem o e-mail do evento; a 1ª é a responsável pela tarefa. Sem pessoa → ninguém é avisado por e-mail.
//   (18h.4c: sem "funções" e sem e-mail para o perfil inteiro — não queimar e-mail nem encher a caixa de quem não tem relação com o problema.)
//   REGRA DO SaaS: e-mail de rotina nunca vai para o perfil admin; pessoa escolhida pelo nome recebe (foi escolhida de propósito).
const PERFIS_OC = { comercial: 'Comercial', operacao: 'Operação', qualidade: 'Qualidade', comprador: 'Comprador', financeiro: 'Financeiro', fiscal: 'Fiscal' };
const SEMPRE = ['admin', 'gestor'];
const CONFIG_PADRAO = { lc: { perfis: ['comercial'], pessoas: [], tipo_tarefa: 'CM' }, tr: { perfis: ['operacao'], pessoas: [], tipo_tarefa: 'MT' } };
const siglaDe = (origem) => (origem === 'at' ? 'tr' : 'lc');
function limparCfg(c = {}, base) {
  const arr = (v) => (Array.isArray(v) ? [...new Set(v.map((x) => String(x || '').trim()).filter(Boolean))].slice(0, 30) : null);
  return { perfis: (arr(c.perfis) ?? base.perfis).filter((p) => PERFIS_OC[p]), pessoas: (arr(c.pessoas) ?? base.pessoas).filter((p) => /^[cu]:[\w-]{1,60}$/.test(p)), tipo_tarefa: base.tipo_tarefa };
}
async function config(supabase, tenantId) {
  const t = (await q(supabase.from('tenants').select('*').eq('id', tenantId)).catch(() => []))[0] || {};
  const salvo = t.ocorrencias_config && typeof t.ocorrencias_config === 'object' ? t.ocorrencias_config : {};
  return { lc: limparCfg(salvo.lc, CONFIG_PADRAO.lc), tr: limparCfg(salvo.tr, CONFIG_PADRAO.tr), migrou: 'ocorrencias_config' in t };
}
async function salvarConfig(supabase, tenantId, body = {}) {
  const atual = await config(supabase, tenantId); if (!atual.migrou) return { status: 409, erro: 'Falta rodar a migration 069 no Supabase.' };
  const novo = { lc: limparCfg(body.lc || atual.lc, atual.lc), tr: limparCfg(body.tr || atual.tr, atual.tr) };
  const { error } = await supabase.from('tenants').update({ ocorrencias_config: novo }).eq('id', tenantId); if (error) throw new Error(error.message);
  return opcoesConfig(supabase, tenantId);
}
async function opcoesConfig(supabase, tenantId) {
  const cfg = await config(supabase, tenantId);
  const ps = await require('./tarefas').pessoas(supabase, tenantId);
  return { ...cfg, perfis_disponiveis: PERFIS_OC, pessoas: ps.map((p) => ({ ref: p.ref, nome: p.nome, funcao: p.funcao, email: p.email, login: p.login })) };
}
/** acesso: gestor/admin sempre; os demais pelo perfil marcado na origem */
const podeOrigem = (perfis, cfg, origem) => (perfis || []).some((p) => SEMPRE.includes(p) || cfg[siglaDe(origem)].perfis.includes(p));
/** e-mails: só as pessoas escolhidas da origem */
async function destinatarios(supabase, tenantId, origem = 'contrato', cfg0 = null) {
  const cfg = (cfg0 || await config(supabase, tenantId))[siglaDe(origem)];
  if (!cfg.pessoas.length) return [];
  const us = (await q(supabase.from('usuarios').select('*').eq('tenant_id', tenantId)).catch(() => [])).filter((u) => u.ativo !== false && u.ativo !== 0);
  const cs = await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId)).catch(() => []);
  const out = new Map();
  for (const ref of cfg.pessoas) {
    const [k, id] = ref.split(':'); let email = null; let nome = null;
    let uid = null; // 18r: id do usuário para o 🔔
    if (k === 'u') { const u = us.find((x) => String(x.id) === id); email = u?.email; nome = u?.nome; uid = u?.id ?? null; }
    else { const c = cs.find((x) => String(x.id) === id && x.situacao !== 'desligado'); const u = c && c.usuario_id != null ? us.find((x) => String(x.id) === String(c.usuario_id)) : null; email = u?.email || c?.email; nome = c?.nome; uid = u?.id ?? null; }
    const e = String(email || '').trim().toLowerCase(); if (EMAIL_OK.test(e) && !out.has(e)) out.set(e, { email: e, nome, usuario_id: uid });
    else if (!EMAIL_OK.test(e) && uid != null && !out.has(`u:${uid}`)) out.set(`u:${uid}`, { email: null, nome, usuario_id: uid }); // 18r: sem e-mail, mas tem 🔔
  }
  return [...out.values()];
}
function resumoTxt(o) {
  const c = o.contexto || {};
  const alvo = o.origem === 'at' ? `AT ${c.at?.numero || ''} · ${c.motorista?.nome || 'sem motorista'} · ${(c.conjunto || []).map((x) => x.placa || x.tag).filter(Boolean).join(' + ')}`
    : `Contrato ${c.contrato?.numero || ''} · ${c.contrato?.cliente || ''} · ${[c.equipamento?.tag, c.equipamento?.nome].filter(Boolean).join(' — ')}`;
  return alvo;
}
// 18h.3: o e-mail já traz quem ligar — telefone/WhatsApp de quem registrou e do contato do cliente, endereço e mapa — sem abrir o sistema
const digitos = (t) => String(t || '').replace(/\D/g, '');
const foneBR = (t) => { const d = digitos(t); return !d ? null : d.length <= 11 ? `55${d}` : d; };
const foneTxt = (t) => { const d = digitos(t).replace(/^55(?=\d{10,11}$)/, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : String(t || ''); };
const docTxt = (v) => { const d = digitos(v); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : (v || ''); };
async function contatosDa(supabase, tenantId, o) {
  const out = { pessoas: [], cliente: null };
  const reg = o.registrado_por_id != null ? (await q(supabase.from('usuarios').select('*').eq('tenant_id', tenantId).eq('id', o.registrado_por_id)).catch(() => []))[0] : null;
  out.pessoas.push({ papel: o.registrado_por_tipo === 'locatario' ? 'Quem registrou (cliente)' : 'Quem registrou', nome: o.registrado_por_nome || reg?.nome || null, telefone: reg?.telefone || null, email: reg?.email || null });
  if (o.contrato_id != null) {
    const c = (await q(supabase.from('locacao_contratos').select('*').eq('tenant_id', tenantId).eq('id', o.contrato_id)).catch(() => []))[0];
    const cli = c?.cliente_id != null ? (await q(supabase.from('clientes').select('*').eq('tenant_id', tenantId).eq('id', c.cliente_id)).catch(() => []))[0] : null;
    if (c && (c.contato_nome || c.contato_telefone || c.contato_email) && !(c.contato_email && reg?.email && String(c.contato_email).toLowerCase() === String(reg.email).toLowerCase() && !c.contato_telefone))
      out.pessoas.push({ papel: 'Contato do contrato', nome: c.contato_nome || null, telefone: c.contato_telefone || cli?.contato_telefone || null, email: c.contato_email || null });
    if (c) out.cliente = { nome: c.cliente || cli?.nome || null, razao_social: cli?.razao_social || null, documento: c.cliente_doc || cli?.documento || null,
      endereco: cli ? [[cli.endereco, cli.numero].filter(Boolean).join(', '), cli.bairro, [cli.cidade, cli.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ') : null, obra: c.local || null };
  }
  if (o.execucao_id != null && o.contexto?.motorista?.id) {
    const m = (await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId).eq('id', o.contexto.motorista.id)).catch(() => []))[0];
    out.pessoas.push({ papel: 'Motorista', nome: o.contexto.motorista.nome || m?.nome || null, telefone: m?.telefone || m?.celular || null, email: null });
    out.cliente = { nome: o.contexto.at?.cliente || null };
  }
  return out;
}
function htmlAviso(o, emp, ct) {
  const btn = (href, txt, cor) => `<a href="${escH(href)}" style="display:inline-block;background:${cor};color:#fff;text-decoration:none;padding:7px 12px;border-radius:6px;font-weight:700;font-size:13px;margin:2px 6px 2px 0">${txt}</a>`;
  const zap = (f) => `https://wa.me/${f}?text=${encodeURIComponent(`Olá! Aqui é da ${emp.nome_fantasia || emp.nome || 'locadora'}, sobre a ocorrência ${o.numero || ''} (${TIPOS[o.tipo]}).`)}`;
  const pessoa = (p) => `<tr><td style="padding:6px 0;border-top:1px solid #e5e5e5;vertical-align:top"><div style="font-size:11px;color:#666">${escH(p.papel)}</div><b>${escH(p.nome || '—')}</b>${p.telefone ? ` · ${escH(foneTxt(p.telefone))}` : ''}${p.email ? ` · <a href="mailto:${escH(p.email)}">${escH(p.email)}</a>` : ''}
    ${p.telefone ? `<div style="margin-top:4px">${btn(`tel:+${foneBR(p.telefone)}`, '📞 Ligar', '#2563eb')}${btn(zap(foneBR(p.telefone)), '💬 WhatsApp', '#16a34a')}</div>` : ''}</td></tr>`;
  const c = o.contexto || {}; const cli = ct.cliente || {};
  const linha = (k, v) => (v ? `<tr><td style="color:#666;padding:2px 10px 2px 0;white-space:nowrap;vertical-align:top">${escH(k)}</td><td style="padding:2px 0">${escH(v)}</td></tr>` : '');
  const mapa = o.gps ? `https://www.google.com/maps?q=${o.gps.lat},${o.gps.lng}` : null;
  const dhBR = (d) => (d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '');
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#111;font-size:14px;line-height:1.5"><div style="font-weight:700;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:14px">${escH(emp.nome_fantasia || emp.razao_social || emp.nome || 'QuotaFlow')}</div>
<p style="margin:0 0 6px"><b>${escH(o.numero || '')}</b> — ${escH(TIPOS[o.tipo])} · ${escH(dhBR(o.ocorrido_em))}</p>
${o.parado ? '<p style="color:#b91c1c;font-weight:700;margin:0 0 8px">⛔ Informado como PARADO — o comercial decide o que fazer.</p>' : ''}
<p style="white-space:pre-wrap;background:#f4f4f5;padding:10px;border-radius:6px;margin:8px 0">${escH(o.descricao || '')}</p>
<div style="font-weight:700;margin-top:14px">📞 Contatos</div><table style="width:100%;border-collapse:collapse">${ct.pessoas.filter((p) => p.nome || p.telefone || p.email).map(pessoa).join('')}</table>
<div style="font-weight:700;margin-top:14px">${o.origem === 'at' ? '🚛 Viagem' : '🏗 Cliente e equipamento'}</div><table style="border-collapse:collapse;font-size:13px">
${o.origem === 'at' ? linha('AT', c.at?.numero) + linha('Cliente', cli.nome) + linha('Conjunto', (c.conjunto || []).map((x) => x.placa || x.tag).filter(Boolean).join(' + ')) + linha('Carga', (c.carga || []).map((x) => x.descricao).filter(Boolean).join(', '))
  : linha('Cliente', [cli.nome, cli.razao_social && cli.razao_social !== cli.nome ? cli.razao_social : null].filter(Boolean).join(' — ')) + linha('CNPJ/CPF', docTxt(cli.documento)) + linha('Endereço', cli.endereco) + linha('Obra', cli.obra) + linha('Contrato', c.contrato?.numero)
    + linha('Equipamento', [c.equipamento?.tag, c.equipamento?.nome, c.equipamento?.modelo].filter(Boolean).join(' — ')) + linha('Nº de série', c.equipamento?.serie)
    + linha('Última inspeção', c.ultima_inspecao ? `${c.ultima_inspecao.numero || ''} · ${dhBR(c.ultima_inspecao.em)} · ${c.ultima_inspecao.resultado || ''}` : 'sem inspeção registrada')}
${o.local && o.local !== cli.obra ? linha('Local', o.local) : ''}</table>${mapa ? `<div style="margin-top:6px">${btn(mapa, '📍 Ver no mapa', '#475569')}</div>` : ''}
<p style="margin:20px 0"><a href="${frontendURL()}" style="background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:700">Abrir a ocorrência</a></p><p style="font-size:11px;color:#666">Fotos e boletim de ocorrência ficam na ocorrência e no dossiê. Aviso automático do QuotaFlow.</p></div>`;
}
async function avisar(supabase, tenantId, o) {
  const emp = (await q(supabase.from('tenants').select('*').eq('id', tenantId)).catch(() => []))[0] || {};
  const assunto = `⚠️ ${o.numero || 'Ocorrência'} — ${TIPOS[o.tipo]}${o.parado ? ' · EQUIPAMENTO PARADO' : ''} · ${o.contexto?.contrato?.cliente || o.contexto?.at?.cliente || ''}`.replace(/ · $/, '');
  const html = htmlAviso(o, emp, await contatosDa(supabase, tenantId, o));
  let n = 0;
  const dest = await destinatarios(supabase, tenantId, o.origem);
  for (const { email: para } of dest.filter((x) => x.email)) { try { await enviarEmail(para, assunto, html); n++; } catch (e) { console.error('⚠️ [ocorrencias] e-mail não enviado:', para, e?.message || e); } }
  try { // 18r: 🔔 na tela para as mesmas pessoas (menos quem registrou)
    await require('./notificacoes').avisarUsuarios(supabase, tenantId, dest.map((x) => x.usuario_id), { tipo: 'ocorrencia_nova', chave: `oc:${o.id}`,
      titulo: `⚠️ Nova ocorrência ${o.numero || ''} — ${TIPOS[o.tipo] || ''}${o.parado ? ' · PARADO' : ''}`.trim(), texto: [o.contexto?.equipamento?.descricao || o.contexto?.at?.numero, o.contexto?.contrato?.cliente || o.contexto?.at?.cliente].filter(Boolean).join(' · ') || null,
      link: { tela: 'contratos', ocorrencia_id: o.id } }, { exceto: o._quem_id ?? null });
  } catch (e) { console.error('⚠️ [ocorrencias] 🔔:', e?.message || e); }
  return n;
}

// ─── criar ───────────────────────────────────────────────────────────────────
/** body: { origem:'at'|'contrato', execucao_id | contrato_id+equipamento_id, tipo, parado, ocorrido_em, local, gps, descricao, inspecao_id }
 *  quem: { usuarioId, usuarioNome, lado:'empresa'|'cliente' } · locatarioId: aplica o escopo do locatário */
async function criar(supabase, tenantId, quem, body = {}, { locatarioId = null } = {}) {
  const tipo = String(body.tipo || ''); if (!TIPOS[tipo]) return { status: 400, erro: 'Escolha o tipo da ocorrência' };
  const descricao = texto(body.descricao, 4000); if (!descricao) return { status: 400, erro: 'Descreva o que aconteceu' };
  const origem = locatarioId ? 'contrato' : body.origem === 'at' ? 'at' : 'contrato';
  let linha = { tenant_id: tenantId, origem, tipo, parado: body.parado === true, descricao, local: texto(body.local, 300),
    gps: body.gps && Number.isFinite(Number(body.gps.lat)) && Number.isFinite(Number(body.gps.lng)) ? { lat: Number(body.gps.lat), lng: Number(body.gps.lng), precisao: body.gps.precisao ?? null } : null,
    ocorrido_em: body.ocorrido_em && !Number.isNaN(Date.parse(body.ocorrido_em)) ? new Date(body.ocorrido_em).toISOString() : new Date().toISOString(),
    status: 'registrada', responsabilidade: 'a_definir', fotos: [], anexos: [], mensagens: [],
    registrado_por_id: quem.usuarioId || null, registrado_por_nome: quem.usuarioNome || null, registrado_por_tipo: locatarioId ? 'locatario' : 'empresa',
    inspecao_id: /^\d+$/.test(String(body.inspecao_id ?? '')) ? Number(body.inspecao_id) : null };
  if (Date.parse(linha.ocorrido_em) > Date.now() + 10 * 60000) return { status: 400, erro: 'A data/hora da ocorrência não pode ser no futuro' };
  if (origem === 'at') {
    const ex = (await q(supabase.from('execucoes').select('*').eq('tenant_id', tenantId).eq('id', body.execucao_id)))[0];
    if (!ex) return { status: 404, erro: 'AT não encontrada' };
    if (['rascunho', 'cancelada'].includes(ex.status)) return { status: 409, erro: 'Ocorrência só em AT programada, em execução ou concluída' };
    const eqId = jsonArr(ex.conjunto).find((c) => String(c.id) === String(body.equipamento_id))?.id ?? jsonArr(ex.conjunto)[0]?.id ?? null;
    linha = { ...linha, execucao_id: ex.id, equipamento_id: eqId, contexto: await contextoAT(supabase, tenantId, ex) };
    if (!linha.local && linha.contexto.ultima_posicao?.etapa) linha.local = `Última etapa: ${linha.contexto.ultima_posicao.etapa}`;
  } else {
    let contrato, loc;
    if (locatarioId) {
      const esc = await CT().escopoLocatario(supabase, tenantId, locatarioId);
      loc = esc.ativas.find((l) => String(l.equipamento_id) === String(body.equipamento_id) && (!body.contrato_id || String(l.contrato_id) === String(body.contrato_id)));
      if (!loc) return { status: 404, erro: 'Equipamento não encontrado nos seus contratos ativos' };
      contrato = esc.contratos.find((c) => String(c.id) === String(loc.contrato_id));
    } else {
      contrato = (await q(supabase.from('locacao_contratos').select('*').eq('tenant_id', tenantId).eq('id', body.contrato_id)))[0];
      if (!contrato) return { status: 404, erro: 'Contrato não encontrado' };
      loc = (await q(supabase.from('equipamento_locacoes').select('*').eq('tenant_id', tenantId).eq('contrato_id', contrato.id))).find((l) => String(l.equipamento_id) === String(body.equipamento_id));
      if (!loc) return { status: 404, erro: 'Equipamento não está neste contrato' };
    }
    const eq = (await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId).eq('id', loc.equipamento_id)))[0] || { id: loc.equipamento_id };
    linha = { ...linha, contrato_id: contrato.id, equipamento_id: eq.id, contexto: await contextoContrato(supabase, tenantId, contrato, loc, eq) };
    if (!linha.local && contrato.local) linha.local = contrato.local;
  }
  linha.historico = [entrada(quem, 'registrada', { texto: `${TIPOS[tipo]}${linha.parado ? ' · parado' : ''}` })];
  let o;
  try { const r = await supabase.from('ocorrencias').insert([linha]).select(); if (r.error) throw new Error(r.error.message); o = r.data[0]; }
  catch (e) { if (sem068(e)) return ERRO_068; throw e; }
  // TSK-MT ligada ao SIN
  try {
    const T = require('./tarefas'); const cfg = (await config(supabase, tenantId))[siglaDe(origem)];
    const prazo = new Date(Date.now() + (linha.parado ? 1 : 3) * 86400000).toISOString().slice(0, 10);
    const t = await T.criar(supabase, tenantId, { id: quem.usuarioId || null, nome: quem.usuarioNome || 'QuotaFlow' }, { _sem_aviso: true, tipo: cfg.tipo_tarefa || 'MT', ...(cfg.pessoas[0] ? { responsavel_ref: cfg.pessoas[0] } : {}), titulo: `${o.numero || 'Ocorrência'} — ${TIPOS[tipo]} · ${resumoTxt(o).slice(0, 120)}`,
      detalhe: `${descricao}${linha.parado ? '\n\n⛔ Informado como PARADO.' : ''}`, prioridade: linha.parado || ['acidente', 'furto'].includes(tipo) ? 'alta' : 'media', prazo,
      vinculos: [{ tipo: 'ocorrencia', id: String(o.id), numero: o.numero || null },
        ...(o.execucao_id ? [{ tipo: 'at', id: String(o.execucao_id), numero: o.contexto?.at?.numero || null }] : []),
        ...(o.contrato_id ? [{ tipo: 'contrato', id: String(o.contrato_id), numero: o.contexto?.contrato?.numero || null }] : []),
        ...(o.inspecao_id ? [{ tipo: 'inspecao', id: String(o.inspecao_id) }] : [])] });
    if (t?.id) {
      await supabase.from('tarefas').update({ origem: 'ocorrencia', origem_ref: String(o.id) }).eq('id', t.id).eq('tenant_id', tenantId);
      const r = await supabase.from('ocorrencias').update({ tarefa_id: t.id }).eq('id', o.id).eq('tenant_id', tenantId).select(); if (r.data?.[0]) o = r.data[0];
      o.tarefa_numero = t.numero || null;
    }
  } catch (e) { console.error('⚠️ [ocorrencias] tarefa não criada:', e?.message || e); }
  o._quem_id = quem.usuarioId ?? null; // 18r: quem registrou não recebe o próprio 🔔
  try { o.emails = await avisar(supabase, tenantId, o); } catch (e) { console.error('⚠️ [ocorrencias] aviso:', e?.message || e); }
  return { ocorrencia: await enfeitar(supabase, tenantId, o, { cliente: !!locatarioId }) };
}

// ─── leitura ─────────────────────────────────────────────────────────────────
async function enfeitar(supabase, tenantId, o, { cliente = false, urls = false } = {}) {
  const fim = o.encerrado_em ? Date.parse(o.encerrado_em) : Date.now();
  const dias_parado = o.parado ? Math.max(1, Math.ceil((fim - Date.parse(o.ocorrido_em)) / 86400000)) : 0;
  let tarefa = null;
  if (!cliente && o.tarefa_id != null) { try { const t = (await q(supabase.from('tarefas').select('*').eq('tenant_id', tenantId).eq('id', o.tarefa_id)))[0]; if (t) tarefa = { id: t.id, numero: t.numero || null, status: t.status }; } catch { /* */ } }
  const assinar = async (a) => { if (!urls || !a.path) return null; try { const { data } = await supabase.storage.from(BUCKET).createSignedUrl(a.path, 3600, { download: false }); return data?.signedUrl || null; } catch { return null; } };
  const limpar = async (lista) => Promise.all(jsonArr(lista).map(async ({ path: _p, ...a }) => ({ ...a, url: await assinar({ path: _p }) })));
  const { historico, ...base } = o;
  return { ...base, ...(cliente ? {} : { historico: jsonArr(historico) }), tipo_nome: TIPOS[o.tipo], status_nome: STATUS[o.status], responsabilidade_nome: RESP[o.responsabilidade],
    dias_parado, tarefa: tarefa || (o.tarefa_numero ? { numero: o.tarefa_numero } : null), resumo: resumoTxt(o),
    fotos: await limpar(o.fotos), anexos: await limpar(o.anexos), mensagens: jsonArr(o.mensagens) };
}
async function listar(supabase, tenantId, filtros = {}, { locatarioId = null, perfis = null } = {}) {
  let lista;
  try { lista = await q(supabase.from('ocorrencias').select('*').eq('tenant_id', tenantId)); } catch (e) { if (sem068(e)) return { ocorrencias: [], sem_migration: true }; throw e; }
  if (!locatarioId && perfis) { const cfg = await config(supabase, tenantId); lista = lista.filter((o) => podeOrigem(perfis, cfg, o.origem)); } // 18h.4c: acesso pelo perfil da origem
  if (locatarioId) { const esc = await CT().escopoLocatario(supabase, tenantId, locatarioId); const ids = new Set(esc.contratos.map((c) => String(c.id))); lista = lista.filter((o) => o.origem === 'contrato' && ids.has(String(o.contrato_id))); }
  if (filtros.contrato_id) lista = lista.filter((o) => String(o.contrato_id) === String(filtros.contrato_id));
  if (filtros.execucao_id) lista = lista.filter((o) => String(o.execucao_id) === String(filtros.execucao_id));
  if (filtros.origem) lista = lista.filter((o) => o.origem === filtros.origem);
  if (filtros.status === 'abertas') lista = lista.filter((o) => o.status !== 'encerrada'); else if (STATUS[filtros.status]) lista = lista.filter((o) => o.status === filtros.status);
  lista.sort((a, b) => String(b.ocorrido_em).localeCompare(String(a.ocorrido_em)));
  return { ocorrencias: await Promise.all(lista.map((o) => enfeitar(supabase, tenantId, o, { cliente: !!locatarioId }))), tipos: TIPOS, status: STATUS, responsabilidades: RESP };
}
// 18p: 💬 tempo real por espera longa (como a conversa do Spot) — a tela pergunta "mudou algo depois de X?" e o servidor
//   segura até gravar algo na ocorrência (mensagem, foto, status) ou ~25 s. Substitui o "reler a cada 15 s".
const avisosOc = new (require('events').EventEmitter)(); avisosOc.setMaxListeners(0);
const ESPERA_OC_MS = 25000;
async function detalhe(supabase, tenantId, id, opts = {}) {
  const { desde = null, esperar = false } = opts;
  if (esperar && desde) {
    const atual = await (opts.locatarioId ? doLocatario(supabase, tenantId, opts.locatarioId, id) : doTenant(supabase, tenantId, id)).catch(() => null);
    if (atual && String(atual.atualizado_em || '') <= String(desde)) {
      await new Promise((ok) => { const k = `oc:${atual.id}`; const tm = setTimeout(fim, ESPERA_OC_MS); function fim() { clearTimeout(tm); avisosOc.removeListener(k, fim); ok(); } avisosOc.once(k, fim); });
      const depois = await (opts.locatarioId ? doLocatario(supabase, tenantId, opts.locatarioId, id) : doTenant(supabase, tenantId, id)).catch(() => null);
      if (depois && String(depois.atualizado_em || '') <= String(desde)) return { sem_mudanca: true, versao: depois.atualizado_em || null };
    }
  }
  return detalheAgora(supabase, tenantId, id, opts);
}
async function detalheAgora(supabase, tenantId, id, { locatarioId = null, perfis = null } = {}) {
  const o = locatarioId ? await doLocatario(supabase, tenantId, locatarioId, id) : await doTenant(supabase, tenantId, id).catch((e) => { if (sem068(e)) return null; throw e; });
  if (!o) return { status: 404, erro: 'Ocorrência não encontrada' };
  if (!locatarioId && perfis && !podeOrigem(perfis, await config(supabase, tenantId), o.origem)) return { status: 409, erro: 'Seu perfil não tem acesso a esta ocorrência (⚙️ Configurações → ⚠️ Ocorrências)' };
  const emp = (await q(supabase.from('tenants').select('*').eq('id', tenantId)).catch(() => []))[0] || {};
  return { versao: o.atualizado_em || null, ocorrencia: await enfeitar(supabase, tenantId, o, { cliente: !!locatarioId, urls: true }), empresa: { nome: emp.nome_fantasia || emp.nome || emp.razao_social || '', razao_social: emp.razao_social || null, cnpj: emp.cnpj || null } };
}

// ─── ações ───────────────────────────────────────────────────────────────────
async function gravar(supabase, tenantId, o, upd) {
  const { data, error } = await supabase.from('ocorrencias').update({ ...upd, atualizado_em: new Date().toISOString() }).eq('id', o.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message); avisosOc.emit(`oc:${o.id}`); return data[0]; // 18p: acorda quem está com a ocorrência aberta
}
/** 18h.3.2: a TSK-MT acompanha a ocorrência — encerrada → concluída · em análise/atendimento → em andamento · registrada → pendente (cancelada fica como está) */
const STATUS_TAREFA = { registrada: 'pendente', em_analise: 'em_andamento', em_atendimento: 'em_andamento', encerrada: 'concluida' };
async function sincronizarTarefa(supabase, tenantId, tarefaId, status, quem, numero) {
  try {
    const T = require('./tarefas'); const alvo = STATUS_TAREFA[status];
    const t = (await q(supabase.from('tarefas').select('*').eq('tenant_id', tenantId).eq('id', tarefaId)))[0];
    if (!t || !alvo || t.status === alvo || t.status === 'cancelada') return;
    if (alvo === 'pendente' && t.status === 'em_andamento') return; // voltou para "registrada": não desfaz o trabalho já iniciado
    await T.atualizar(supabase, tenantId, { id: quem.usuarioId || null, nome: `${quem.usuarioNome || 'QuotaFlow'} (pela ${numero})` }, tarefaId, { status: alvo });
  } catch (e) { console.error('⚠️ [ocorrencias] tarefa não sincronizada:', e?.message || e); }
}
/** empresa: status e responsabilidade */
async function atualizar(supabase, tenantId, quem, id, body = {}) {
  const o = await doTenant(supabase, tenantId, id); if (!o) return { status: 404, erro: 'Ocorrência não encontrada' };
  if (quem.perfis && !podeOrigem(quem.perfis, await config(supabase, tenantId), o.origem)) return { status: 409, erro: 'Seu perfil não altera esta ocorrência (⚙️ Configurações → ⚠️ Ocorrências)' };
  const upd = {}; const hist = [];
  if ('status' in body && body.status !== o.status) {
    if (!STATUS[body.status]) return { status: 400, erro: 'Situação inválida' };
    if (o.status === 'encerrada' && !texto(body.motivo, 500)) return { status: 409, erro: 'Para reabrir uma ocorrência encerrada, informe o motivo' };
    upd.status = body.status; upd.encerrado_em = body.status === 'encerrada' ? new Date().toISOString() : null;
    hist.push(entrada(quem, 'status', { de: STATUS[o.status], para: STATUS[body.status], texto: texto(body.motivo, 500) }));
  }
  if ('responsabilidade' in body && body.responsabilidade !== o.responsabilidade) {
    if (!RESP[body.responsabilidade]) return { status: 400, erro: 'Responsabilidade inválida' };
    upd.responsabilidade = body.responsabilidade; hist.push(entrada(quem, 'responsabilidade', { de: RESP[o.responsabilidade], para: RESP[body.responsabilidade] }));
  }
  if ('parado' in body && !!body.parado !== !!o.parado) { upd.parado = !!body.parado; hist.push(entrada(quem, 'parado', { para: body.parado ? 'parado' : 'voltou a operar' })); }
  if (!hist.length) return { ocorrencia: await enfeitar(supabase, tenantId, o) };
  upd.historico = [...jsonArr(o.historico), ...hist];
  const n = await gravar(supabase, tenantId, o, upd);
  if (o.tarefa_id != null) {
    await require('./tarefas').registrar(supabase, tenantId, o.tarefa_id, { nome: quem.usuarioNome || null }, 'comentario', { texto: `${o.numero}: ${hist.map((h) => `${h.acao} → ${h.para}`).join(' · ')}` });
    if (upd.status) await sincronizarTarefa(supabase, tenantId, o.tarefa_id, upd.status, quem, o.numero);
  }
  return { ocorrencia: await enfeitar(supabase, tenantId, n) };
}
async function mensagem(supabase, tenantId, quem, id, body = {}, { locatarioId = null } = {}) {
  const o = locatarioId ? await doLocatario(supabase, tenantId, locatarioId, id) : await doTenant(supabase, tenantId, id); if (!o) return { status: 404, erro: 'Ocorrência não encontrada' };
  if (!locatarioId && quem.perfis && !podeOrigem(quem.perfis, await config(supabase, tenantId), o.origem)) return { status: 409, erro: 'Seu perfil não tem acesso a esta ocorrência' };
  const t = texto(body.texto, 2000); if (!t) return { status: 400, erro: 'Escreva a mensagem' };
  if (o.status === 'encerrada') return { status: 409, erro: 'Ocorrência encerrada — não recebe mais mensagens' };
  const msg = { id: crypto.randomBytes(5).toString('hex'), em: new Date().toISOString(), por: quem.usuarioNome || null, lado: locatarioId ? 'cliente' : 'empresa', texto: t };
  const n = await gravar(supabase, tenantId, o, { mensagens: [...jsonArr(o.mensagens), msg] });
  return { ocorrencia: await enfeitar(supabase, tenantId, n, { cliente: !!locatarioId }) };
}
/** foto (já comprimida e com a tarja do SIN no aparelho) ou BO/documento — os dois lados, enquanto não encerrada */
async function anexar(supabase, tenantId, quem, id, body = {}, { locatarioId = null } = {}) {
  const o = locatarioId ? await doLocatario(supabase, tenantId, locatarioId, id) : await doTenant(supabase, tenantId, id); if (!o) return { status: 404, erro: 'Ocorrência não encontrada' };
  if (o.status === 'encerrada') return { status: 409, erro: 'Ocorrência encerrada — não recebe mais arquivos' };
  const tipo = body.tipo === 'bo' ? 'bo' : body.tipo === 'documento' ? 'documento' : 'foto';
  if (!MIME[body.mime] || (tipo === 'foto' && !/^image\//.test(body.mime))) return { status: 400, erro: tipo === 'foto' ? 'Foto: JPG ou PNG' : 'Arquivo: PDF, JPG ou PNG' };
  if (tipo === 'foto' && jsonArr(o.fotos).length >= MAX_FOTOS) return { status: 409, erro: `Limite de ${MAX_FOTOS} fotos por ocorrência` };
  const buf = Buffer.from(String(body.base64 || ''), 'base64'); if (!buf.length) return { status: 400, erro: 'Arquivo vazio' };
  if (buf.length > LIMITE) return { status: 400, erro: 'Arquivo maior que 10 MB' };
  const aid = crypto.randomBytes(6).toString('hex');
  const path = `tenant-${tenantId}/ocorrencias/${o.id}/${Date.now()}-${aid}.${MIME[body.mime]}`;
  const { error: eu } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: body.mime, upsert: false });
  if (eu) throw new Error(`Falha ao subir o arquivo: ${eu.message}`);
  const a = { id: aid, tipo, nome: texto(body.nome, 160) || (tipo === 'bo' ? 'Boletim de ocorrência' : `foto.${MIME[body.mime]}`), legenda: texto(body.legenda, 200), path, mime: body.mime, tamanho: buf.length,
    em: new Date().toISOString(), por: quem.usuarioNome || null, lado: locatarioId ? 'cliente' : 'empresa', gps: body.gps || null, ...(tipo === 'foto' && body.antiga === true ? { antiga: true } : {}) }; // 18h.3: foto antiga / da galeria (a tarja já avisa)
  const upd = tipo === 'foto' ? { fotos: [...jsonArr(o.fotos), a] } : { anexos: [...jsonArr(o.anexos), a] };
  const n = await gravar(supabase, tenantId, o, upd);
  return { ocorrencia: await enfeitar(supabase, tenantId, n, { cliente: !!locatarioId }), anexo: { id: aid, tipo } };
}

// ─── locatário: o que ele pode escolher ─────────────────────────────────────
async function opcoesLocatario(supabase, tenantId, usuarioId) {
  const esc = await CT().escopoLocatario(supabase, tenantId, usuarioId);
  const eqs = esc.ativas.length ? await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId)) : [];
  return { tipos: TIPOS, contratos: esc.contratos.map((c) => ({ id: c.id, numero: c.numero, cliente: c.cliente || null, local: c.local || null,
    equipamentos: esc.ativas.filter((l) => String(l.contrato_id) === String(c.id)).map((l) => { const e = eqs.find((x) => String(x.id) === String(l.equipamento_id)) || {}; return { equipamento_id: l.equipamento_id, tag: e.tag || null, nome: e.nome || null, modelo: e.modelo || null, serie: e.numero_serie || e.serie || null }; }) })) };
}

/** 18h: dias parados por equipamento num período (para a medição mostrar — nada é descontado sozinho) */
async function paradasDoContrato(supabase, tenantId, contratoId, inicio, fim) {
  let lista; try { lista = await q(supabase.from('ocorrencias').select('*').eq('tenant_id', tenantId).eq('contrato_id', contratoId)); } catch { return []; }
  const ini = Date.parse(`${String(inicio).slice(0, 10)}T00:00:00`); const fi = Date.parse(`${String(fim).slice(0, 10)}T23:59:59`);
  return lista.filter((o) => o.parado || jsonArr(o.historico).some((h) => h.acao === 'parado')).map((o) => {
    const de = Math.max(Date.parse(o.ocorrido_em), ini); const ate = Math.min(o.encerrado_em ? Date.parse(o.encerrado_em) : Date.now(), fi);
    return { id: o.id, numero: o.numero, equipamento_id: o.equipamento_id, equipamento: [o.contexto?.equipamento?.tag, o.contexto?.equipamento?.nome].filter(Boolean).join(' — '), tipo: TIPOS[o.tipo], status: STATUS[o.status],
      responsabilidade: RESP[o.responsabilidade], dias: ate > de ? Math.ceil((ate - de) / 86400000) : 0 };
  }).filter((x) => x.dias > 0);
}

// ─── 18h.4: 📊 indicadores (período) — ocorrências, resolução, dias parados e DISPONIBILIDADE ─────────────
//   Na locação o cliente paga por disponibilidade: disponibilidade = (dias contratados − dias parados que NÃO são
//   responsabilidade do cliente) ÷ dias contratados, por equipamento e por contrato. Parada por responsabilidade do cliente
//   (mau uso) não conta contra a locadora. Receita (valor mensal da locação ÷ 30 por dia) só para gestor/admin.
//   Tudo é estimativa para gestão — nada é descontado sozinho.
const DIA = 86400000;
const iniDia = (d) => Date.parse(`${String(d).slice(0, 10)}T00:00:00-03:00`);
const fimDia = (d) => Date.parse(`${String(d).slice(0, 10)}T23:59:59.999-03:00`);
const diasSobre = (a0, a1, b0, b1) => { const de = Math.max(a0, b0); const ate = Math.min(a1, b1); return ate > de ? Math.ceil((ate - de) / DIA) : 0; };
const r1 = (n) => Math.round(n * 10) / 10; const r2 = (n) => Math.round(n * 100) / 100;
async function indicadores(supabase, tenantId, { de = null, ate = null, perfis = null, receita = false } = {}) {
  let todas; try { todas = await q(supabase.from('ocorrencias').select('*').eq('tenant_id', tenantId)); } catch (e) { if (sem068(e)) return { sem_migration: true }; throw e; }
  const cfg = perfis ? await config(supabase, tenantId) : null;
  if (perfis) todas = todas.filter((o) => podeOrigem(perfis, cfg, o.origem));
  const agora = Date.now(); const hojeTxt = new Date(agora - 3 * 3600000).toISOString().slice(0, 10);
  const P0 = de ? iniDia(de) : Math.min(agora, ...todas.map((o) => Date.parse(o.ocorrido_em))); const P1 = ate ? Math.min(fimDia(ate), agora) : agora;
  const fimOc = (o) => (o.encerrado_em ? Date.parse(o.encerrado_em) : agora);
  const doPeriodo = todas.filter((o) => { const t = Date.parse(o.ocorrido_em); return t >= P0 && t <= P1; });
  const conta = (lista, chave, nomes) => Object.entries(lista.reduce((m, o) => ((m[o[chave]] = (m[o[chave]] || 0) + 1), m), {})).map(([k, n]) => ({ k, nome: nomes[k] || k, n })).sort((a, b) => b.n - a.n);
  const enc = doPeriodo.filter((o) => o.encerrado_em);
  const horas = enc.map((o) => (Date.parse(o.encerrado_em) - Date.parse(o.ocorrido_em)) / 3600000).filter((h) => h >= 0);
  const abertasAntigas = todas.filter((o) => o.status !== 'encerrada').map((o) => ({ id: o.id, numero: o.numero, tipo: TIPOS[o.tipo], status: STATUS[o.status], dias: Math.floor((agora - Date.parse(o.ocorrido_em)) / DIA), parado: !!o.parado, resumo: resumoTxt(o) }))
    .sort((a, b) => b.dias - a.dias).slice(0, 5);
  // dias parados no período (qualquer ocorrência parada que cruza o período, mesmo aberta antes)
  const paradas = todas.filter((o) => o.parado).map((o) => ({ o, dias: diasSobre(Date.parse(o.ocorrido_em), fimOc(o), P0, P1) })).filter((x) => x.dias > 0);
  // disponibilidade (locação)
  const locs = (await q(supabase.from('equipamento_locacoes').select('*').eq('tenant_id', tenantId)).catch(() => [])).filter((l) => l.contrato_id != null && l.inicio);
  const eqs = new Map((await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId)).catch(() => [])).map((e) => [String(e.id), e]));
  const cts = new Map((await q(supabase.from('locacao_contratos').select('*').eq('tenant_id', tenantId)).catch(() => [])).map((c) => [String(c.id), c]));
  const porEq = new Map(); const porCt = new Map();
  for (const l of locs) {
    const L0 = iniDia(l.inicio); const L1 = l.fim_real ? fimDia(l.fim_real) : (l.status === 'ativa' ? agora : (l.fim_previsto ? fimDia(l.fim_previsto) : agora));
    const contratados = diasSobre(L0, L1, P0, P1); if (!contratados) continue;
    let indisp = 0; let doCliente = 0;
    for (const { o } of paradas.filter((x) => x.o.origem === 'contrato' && String(x.o.contrato_id) === String(l.contrato_id) && String(x.o.equipamento_id) === String(l.equipamento_id))) {
      const d = diasSobre(Date.parse(o.ocorrido_em), fimOc(o), Math.max(P0, L0), Math.min(P1, L1)); if (o.responsabilidade === 'cliente') doCliente += d; else indisp += d;
    }
    indisp = Math.min(indisp, contratados); doCliente = Math.min(doCliente, contratados - indisp);
    const diaria = l.valor_mensal != null ? Number(l.valor_mensal) / 30 : null;
    const e = eqs.get(String(l.equipamento_id)) || {}; const c = cts.get(String(l.contrato_id)) || {};
    const somar = (mapa, chave, base) => { const x = mapa.get(chave) || { ...base, contratados: 0, indisponiveis: 0, do_cliente: 0, perda: 0, cobravel: 0, sem_valor: false, ocorrencias: 0 };
      x.contratados += contratados; x.indisponiveis += indisp; x.do_cliente += doCliente;
      if (diaria == null) { if (indisp || doCliente) x.sem_valor = true; } else { x.perda += indisp * diaria; x.cobravel += doCliente * diaria; } mapa.set(chave, x); };
    somar(porEq, String(l.equipamento_id), { equipamento_id: l.equipamento_id, tag: e.tag || null, nome: e.nome || null });
    somar(porCt, String(l.contrato_id), { contrato_id: l.contrato_id, numero: c.numero || null, cliente: c.cliente || null });
  }
  for (const o of doPeriodo.filter((x) => x.origem === 'contrato')) { const a = porEq.get(String(o.equipamento_id)); if (a) a.ocorrencias++; const b = porCt.get(String(o.contrato_id)); if (b) b.ocorrencias++; }
  const fechar = (x) => ({ ...x, disponibilidade: x.contratados ? r1(((x.contratados - x.indisponiveis) / x.contratados) * 100) : null, ...(receita ? { perda: r2(x.perda), cobravel: r2(x.cobravel) } : { perda: undefined, cobravel: undefined }) });
  const equipamentos = [...porEq.values()].map(fechar).sort((a, b) => (a.disponibilidade ?? 101) - (b.disponibilidade ?? 101) || b.ocorrencias - a.ocorrencias);
  const contratos = [...porCt.values()].map(fechar).sort((a, b) => (a.disponibilidade ?? 101) - (b.disponibilidade ?? 101) || b.ocorrencias - a.ocorrencias);
  const tot = equipamentos.reduce((m, x) => ({ contratados: m.contratados + x.contratados, indisponiveis: m.indisponiveis + x.indisponiveis, do_cliente: m.do_cliente + x.do_cliente, perda: m.perda + (x.perda || 0), cobravel: m.cobravel + (x.cobravel || 0) }), { contratados: 0, indisponiveis: 0, do_cliente: 0, perda: 0, cobravel: 0 });
  // clientes (todas as origens): ocorrências e quantas são de responsabilidade do cliente
  const cli = new Map(); for (const o of doPeriodo) { const nome = o.contexto?.contrato?.cliente || o.contexto?.at?.cliente || '—'; const x = cli.get(nome) || { cliente: nome, ocorrencias: 0, do_cliente: 0, dias_parados: 0 }; x.ocorrencias++; if (o.responsabilidade === 'cliente') x.do_cliente++; cli.set(nome, x); }
  for (const { o, dias } of paradas) { const nome = o.contexto?.contrato?.cliente || o.contexto?.at?.cliente || '—'; const x = cli.get(nome) || { cliente: nome, ocorrencias: 0, do_cliente: 0, dias_parados: 0 }; x.dias_parados += dias; cli.set(nome, x); }
  return {
    periodo: { de: de || new Date(P0 - 3 * 3600000).toISOString().slice(0, 10), ate: ate || hojeTxt }, receita: !!receita,
    resumo: { total: doPeriodo.length, abertas: todas.filter((o) => o.status !== 'encerrada').length, encerradas_no_periodo: enc.length, paradas_agora: todas.filter((o) => o.parado && o.status !== 'encerrada').length,
      resolucao_media_dias: horas.length ? r1(horas.reduce((a, b) => a + b, 0) / horas.length / 24) : null, resolucao_max_dias: horas.length ? r1(Math.max(...horas) / 24) : null,
      dias_parados: paradas.reduce((a, x) => a + x.dias, 0),
      disponibilidade: tot.contratados ? r1(((tot.contratados - tot.indisponiveis) / tot.contratados) * 100) : null, dias_contratados: tot.contratados, dias_indisponiveis: tot.indisponiveis, dias_parados_cliente: tot.do_cliente,
      ...(receita ? { perda_estimada: r2(tot.perda), cobravel_cliente: r2(tot.cobravel) } : {}) },
    por_tipo: conta(doPeriodo, 'tipo', TIPOS), por_responsabilidade: conta(doPeriodo, 'responsabilidade', RESP), por_origem: conta(doPeriodo, 'origem', { contrato: 'Locação', at: 'Transporte' }),
    abertas_mais_antigas: abertasAntigas, equipamentos, contratos, clientes: [...cli.values()].sort((a, b) => b.ocorrencias - a.ocorrencias || b.dias_parados - a.dias_parados).slice(0, 10),
  };
}

module.exports = { indicadores, config, salvarConfig, opcoesConfig, destinatarios, TIPOS, STATUS, RESP, criar, listar, detalhe, atualizar, mensagem, anexar, opcoesLocatario, paradasDoContrato, contextoAT, contextoContrato, _definirEnvio, _avisosOc: avisosOc };
