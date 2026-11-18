// services/salaControle/index.js — etapa SC1: 🛰 SALA DE CONTROLE (Início por perfil)
//   Regras sobre os dados (instantâneo, sem custo, auditável). Cada SENSOR devolve { alertas, prioridades, agenda, kpis } e
//   nunca derruba a sala (try/catch próprio). O front ainda esconde o que o perfil/plano não abre (link.tela → temAcesso).
//   • 🚨 alertas  = crítico agora (equipamento bloqueado, AT atrasada/sem motorista, documento vencido)
//   • 🎯 prioridades = o que a PESSOA precisa fazer (tarefas, aprovar/verificar documento, ler procedimento, plano de ação da NC)
//                    + (gestão) o que a área precisa resolver. Ordem: peso (urgência × impacto). Máx. 7 no front.
//   • 📅 agenda   = hoje (ATs, tarefas com prazo hoje)
//   • 📊 kpis     = números rápidos da gestão · 👥 equipe = tarefas atrasadas por pessoa (gestor)

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const hojeBR = (agora = new Date()) => new Date(agora.getTime() - 3 * 36e5).toISOString().slice(0, 10);
const dBR = (iso) => String(iso || '').slice(0, 10).split('-').reverse().join('/');
const hm = (iso) => { const d = new Date(new Date(iso).getTime() - 3 * 36e5); return d.toISOString().slice(11, 16); };
const ABERTA_T = ['pendente', 'em_andamento'];
const GESTAO = ['admin', 'gestor'];
const tem = (perfis, lista) => perfis.some((p) => lista.includes(p));

// ── pessoais ───────────────────────────────────────────────────────────────
async function minhasTarefas(c) {
  const ts = (await q(c.sb.from('tarefas').select('*').eq('tenant_id', c.tenantId))).filter((t) => ABERTA_T.includes(t.status));
  const out = { prioridades: [], agenda: [], equipe: null, kpis: {} };
  const minhas = ts.filter((t) => String(t.responsavel_usuario_id) === String(c.userId));
  for (const t of minhas) {
    const p = t.prazo ? String(t.prazo).slice(0, 10) : null;
    if (p && p < c.hoje) out.prioridades.push({ peso: 90 + (t.prioridade === 'alta' ? 5 : 0), icone: '⏰', titulo: t.titulo || 'Tarefa', detalhe: `atrasada desde ${dBR(p)}`, link: { tela: 'plano', id: t.id } });
    else if (p === c.hoje) { out.prioridades.push({ peso: 70 + (t.prioridade === 'alta' ? 5 : 0), icone: '📌', titulo: t.titulo || 'Tarefa', detalhe: 'vence hoje', link: { tela: 'plano', id: t.id } }); out.agenda.push({ hora: null, icone: '📌', titulo: t.titulo || 'Tarefa', link: { tela: 'plano', id: t.id } }); }
    else if (t.prioridade === 'alta') out.prioridades.push({ peso: 40, icone: '🔺', titulo: t.titulo || 'Tarefa', detalhe: p ? `prazo ${dBR(p)} · prioridade alta` : 'prioridade alta', link: { tela: 'plano', id: t.id } });
  }
  if (c.gestor) {
    const atr = ts.filter((t) => t.prazo && String(t.prazo).slice(0, 10) < c.hoje);
    const por = new Map(); for (const t of atr) { const k = t.responsavel || 'Sem responsável'; por.set(k, (por.get(k) || 0) + 1); }
    out.equipe = { atrasadas: atr.length, abertas: ts.length, pessoas: [...por].map(([nome, n]) => ({ nome, atrasadas: n })).sort((a, b) => b.atrasadas - a.atrasadas) };
    out.kpis.tarefas_atrasadas = atr.length;
  }
  return out;
}

async function documentosGestao(c) {
  const DG = require('../documentosGestao');
  const out = { prioridades: [] };
  const docs = await q(c.sb.from('documentos_gestao').select('id, codigo, titulo, fluxo, status, revisao').eq('tenant_id', c.tenantId));
  for (const d of docs) {
    const f = d.fluxo; if (!f) continue;
    if (f.etapa === 'aprovacao' && String(f.aprovador?.id) === String(c.userId)) out.prioridades.push({ peso: 75, icone: '✍', titulo: `Aprovar ${d.codigo}`, detalhe: d.titulo, link: { tela: 'documentos', aba: 'gestao', id: d.id } });
    if (f.etapa === 'verificacao' && String(f.verificador?.id) === String(c.userId)) out.prioridades.push({ peso: 72, icone: '🔎', titulo: `Verificar ${d.codigo}`, detalhe: d.titulo, link: { tela: 'documentos', aba: 'gestao', id: d.id } });
    if (f.etapa === 'elaboracao' && String(f.elaborado?.usuario_id) === String(c.userId)) out.prioridades.push({ peso: 65, icone: '↩', titulo: `${d.codigo} voltou para ajuste`, detalhe: d.titulo, link: { tela: 'documentos', aba: 'gestao', id: d.id } });
  }
  if (c.colaborador) {
    const meus = await DG.meusProcedimentos(c.sb, c.tenantId, c.colaborador, c.userId).catch(() => []);
    const pend = meus.filter((x) => !x.lido_em);
    if (pend.length) out.prioridades.push({ peso: 50, icone: '📘', titulo: pend.length === 1 ? `Ler ${pend[0].codigo}` : `${pend.length} procedimentos para ler`, detalhe: pend.slice(0, 3).map((x) => x.codigo).join(', '), link: { tela: c.perfis.includes('colaborador') && !c.gestor ? 'meus_treinamentos' : 'documentos', aba: 'gestao', id: pend[0].id } });
  }
  return out;
}

async function planoAcaoNC(c) {
  const out = { prioridades: [], kpis: {} };
  const ncs = await q(c.sb.from('nao_conformidades').select('*').eq('tenant_id', c.tenantId));
  const abertas = ncs.filter((n) => !['resolvida', 'cancelada'].includes(n.status));
  const acoes = (await q(c.sb.from('nao_conformidade_plano_acao').select('*').eq('tenant_id', c.tenantId))).filter((a) => a.status === 'pendente' && a.prazo && String(a.prazo).slice(0, 10) < c.hoje && abertas.some((n) => String(n.id) === String(a.nc_id)));
  for (const a of acoes.filter((x) => String(x.responsavel_id) === String(c.userId))) {
    const n = abertas.find((x) => String(x.id) === String(a.nc_id));
    out.prioridades.push({ peso: 85, icone: '⚠️', titulo: `Ação da ${n?.numero_nc || 'NC'} atrasada`, detalhe: a.acao, link: { tela: 'nao_conformidades', id: a.nc_id } });
  }
  if (c.gestao || c.qualidade) {
    out.kpis.ncs_abertas = abertas.length; out.kpis.acoes_nc_atrasadas = acoes.length;
    if (acoes.length && (c.gestor || c.qualidade)) out.prioridades.push({ peso: 60, icone: '⚠️', titulo: `${acoes.length} ação(ões) de NC atrasada(s)`, detalhe: 'plano de ação com prazo vencido', link: { tela: 'nao_conformidades' } });
  }
  return out;
}

// ── gestão / operação ─────────────────────────────────────────────────────
async function frotaBloqueada(c) {
  if (!(c.gestor || c.operacao || c.qualidade)) return {};
  const es = (await q(c.sb.from('equipamentos').select('id, tag, nome, bloqueado, bloqueio_motivo, bloqueado_em').eq('tenant_id', c.tenantId))).filter((e) => e.bloqueado);
  return { alertas: es.map((e) => ({ nivel: 'critico', icone: '⛔', titulo: `${e.tag || e.nome} bloqueado`, detalhe: e.bloqueio_motivo || 'reprovado na inspeção', link: { tela: 'inspecoes' } })), kpis: { equipamentos_bloqueados: es.length } };
}

async function viagens(c) {
  if (!(c.gestor || c.operacao)) return {};
  const xs = (await q(c.sb.from('execucoes').select('id, numero, status, inicio_previsto, motorista_id, motorista_nome, cliente_nome, origem, destino').eq('tenant_id', c.tenantId))).filter((x) => ['programada', 'em_execucao'].includes(x.status));
  const agora = c.agora.getTime(); const out = { alertas: [], agenda: [], kpis: {} };
  const hoje = xs.filter((x) => x.inicio_previsto && hojeBR(new Date(x.inicio_previsto)) === c.hoje);
  for (const x of xs) {
    if (x.status === 'programada' && x.inicio_previsto && new Date(x.inicio_previsto).getTime() < agora - 2 * 36e5) out.alertas.push({ nivel: 'atencao', icone: '🚛', titulo: `${x.numero} não iniciou`, detalhe: `previsto ${dBR(hojeBR(new Date(x.inicio_previsto)))} ${hm(x.inicio_previsto)}${x.cliente_nome ? ` · ${x.cliente_nome}` : ''}`, link: { tela: 'programacao', id: x.id } });
    else if (x.status === 'programada' && !x.motorista_id && x.inicio_previsto && new Date(x.inicio_previsto).getTime() < agora + 24 * 36e5) out.alertas.push({ nivel: 'critico', icone: '👤', titulo: `${x.numero} sem motorista`, detalhe: `sai ${dBR(hojeBR(new Date(x.inicio_previsto)))} ${hm(x.inicio_previsto)}`, link: { tela: 'programacao', id: x.id } });
  }
  for (const x of hoje.sort((a, b) => String(a.inicio_previsto).localeCompare(String(b.inicio_previsto)))) out.agenda.push({ hora: hm(x.inicio_previsto), icone: '🚛', titulo: `${x.numero}${x.cliente_nome ? ` · ${x.cliente_nome}` : ''}`, detalhe: [x.origem, x.destino].filter(Boolean).join(' → ') + (x.motorista_nome ? ` · ${x.motorista_nome}` : ' · sem motorista'), link: { tela: 'programacao', id: x.id } });
  out.kpis.ats_hoje = hoje.length; out.kpis.ats_em_execucao = xs.filter((x) => x.status === 'em_execucao').length;
  return out;
}

async function vencimentos(c) {
  if (!(c.gestor || c.qualidade || c.operacao)) return {};
  const D = require('../documentos');
  const ds = (await D.listarDocumentos(c.sb, c.tenantId, { agora: c.agora })).filter((d) => !d.colaborador_desligado && d.dias != null);
  const venc = ds.filter((d) => d.dias < 0); const breve = ds.filter((d) => d.dias >= 0 && d.dias <= 7);
  const nome = (d) => d.tipo_nome || d.nome || d.tipo || 'Documento';
  const out = { alertas: venc.slice(0, 8).map((d) => ({ nivel: 'critico', icone: '📄', titulo: `${nome(d)} vencido — ${d.alvo_nome}`, detalhe: `venceu em ${dBR(d.vence_em)}`, link: { tela: 'documentos' } })), prioridades: [], kpis: { documentos_vencidos: venc.length, documentos_7d: breve.length } };
  if (venc.length > 8) out.alertas.push({ nivel: 'critico', icone: '📄', titulo: `+${venc.length - 8} documento(s) vencido(s)`, detalhe: 'ver todos em Documentos', link: { tela: 'documentos' } });
  if (breve.length) out.prioridades.push({ peso: 55, icone: '📅', titulo: `${breve.length} documento(s) vencem em até 7 dias`, detalhe: breve.slice(0, 3).map((d) => `${nome(d)} · ${d.alvo_nome}`).join(' · '), link: { tela: 'documentos' } });
  return out;
}

async function metasInformar(c) { // SC2.4: dono da meta própria — informar o resultado do mês que fechou
  const ps = await require('../metas').pendentesInformar(c.sb, c.tenantId, { agora: c.agora, usuarioId: c.userId });
  return { prioridades: ps.map((p) => ({ peso: 62, icone: '🎯', titulo: `Informar ${p.nome} de ${p.mes_nome}`, detalhe: 'você é o dono desta meta', link: { tela: 'metas', id: p.id } })) };
}

async function ocorrencias(c) { // SC2.7: 🚨 incidentes de campo (cliente e motorista) — gestor + donos do processo (destinatários configurados)
  const O = require('../ocorrencias');
  let dono = false;
  if (!c.gestor) { const cfg = await O.config(c.sb, c.tenantId); for (const or of ['contrato', 'at']) { const ds = await O.destinatarios(c.sb, c.tenantId, or, cfg).catch(() => []); if (ds.some((d) => String(d.usuario_id) === String(c.userId))) dono = true; } }
  if (!c.gestor && !dono) return {};
  const os = (await q(c.sb.from('ocorrencias').select('*').eq('tenant_id', c.tenantId))).filter((o) => o.status !== 'encerrada');
  const semTrat = os.filter((o) => o.status === 'registrada'); const emTrat = os.filter((o) => o.status !== 'registrada');
  const horas = (o) => Math.max(0, Math.round((c.agora - Date.parse(o.criado_em || o.created_at || c.agora)) / 36e5));
  const quem = (o) => { const x = o.contexto || {}; return o.origem === 'at' ? `AT ${x.at?.numero || ''}${x.motorista?.nome ? ` · ${x.motorista.nome}` : ''}` : `${x.contrato?.cliente || 'cliente'}${x.equipamento?.tag ? ` · ${x.equipamento.tag}` : ''}`; };
  return {
    alertas: semTrat.map((o) => ({ nivel: 'critico', icone: '🚨', titulo: `${o.numero || 'Ocorrência'} — ${O.TIPOS[o.tipo] || 'ocorrência'} sem tratamento`, detalhe: `${quem(o)} · registrada há ${horas(o) < 24 ? `${horas(o)} h` : `${Math.floor(horas(o) / 24)} dia(s)`}`, link: { tela: 'contratos', evento: 'qf-abrir-ocorrencia', id: o.id } })),
    kpis: { ocorrencias_sem_tratamento: semTrat.length, ocorrencias_em_tratamento: emTrat.length },
  };
}

async function ferias(c) { // B1.6: 🏖 férias vencidas / vencendo (regras do país) — gestão e qualidade (RH)
  if (!(c.gestor || c.qualidade)) return {};
  const FE = require('../ferias');
  const s = await FE.saldos(c.sb, c.tenantId); const xs = s.colaboradores;
  const venc = xs.filter((x) => x.alerta === 'vencido'), crit = xs.filter((x) => x.alerta === 'critico'), vindo = xs.filter((x) => x.alerta === 'vencendo');
  // B1.14: a 60 dias do limite sem programação = ⚠ risco (trabalhista e de operação); vencido = crítico
  const alertas = [...venc.map((x) => ({ nivel: 'critico', icone: '🏖', titulo: `Férias vencidas — ${x.nome}`, detalhe: `${x.a_gozar} dia(s) sem gozar · ${s.regras.includes('CLT') ? 'paga em dobro' : 'fora do prazo'}`, link: { tela: 'pessoas', aba: 'ferias' } })),
    ...[...crit, ...vindo].sort((a, b) => String(a.proximo_limite).localeCompare(String(b.proximo_limite))).map((x) => ({ nivel: 'atencao', icone: '🏖', titulo: `Risco: férias de ${x.nome} vencem em ${dBR(x.proximo_limite)}`, detalhe: `${x.a_gozar} dia(s) sem programar${x.atual?.sair_ate ? ` · sair até ${dBR(x.atual.sair_ate)}` : ''}`, link: { tela: 'pessoas', aba: 'ferias' } }))].slice(0, 8);
  const prioridades = [];
  // B1.15: férias que batem com AT / OS / tarefa / turma (próximos 90 dias) — ⚠ revise a programação
  try { const hoje = FE.hojeBR(); const ate = new Date(Date.parse(hoje) + 90 * 864e5).toISOString().slice(0, 10);
    const colabs = new Map((await c.sb.from('colaboradores').select('*').eq('tenant_id', c.tenantId)).data?.map((x) => [String(x.id), x]) || []);
    for (const a of await FE.ausencias(c.sb, c.tenantId, hoje, ate)) { const col = colabs.get(String(a.colaborador_id)); if (!col) continue;
      for (const x of (await FE.conflitos(c.sb, c.tenantId, col, a.inicio, a.fim)).filter((k) => k.tipo !== 'mesma_funcao').slice(0, 2))
        alertas.push({ nivel: 'atencao', icone: '🏖', titulo: `${col.nome} estará de férias (${dBR(a.inicio)} a ${dBR(a.fim)})`, detalhe: x.texto, link: x.link }); } } catch { /* sem 109/tabelas */ }
  return { alertas, prioridades, kpis: { ferias_vencidas: venc.length, ferias_vencendo: crit.length + vindo.length } };
}

async function pedidosSemProgramacao(c) { // B2.0: pedido de venda com data prevista e sem AT — avisa (não bloqueia equipamento)
  if (!(c.gestor || tem(c.perfis, ['operacao', 'comercial']))) return {};
  const xs = await require('../execucoes').pendenciasProgramacao(c.sb, c.tenantId, { ateDias: 7 });
  const alertas = xs.map((x) => ({ nivel: x.dias <= 2 ? 'critico' : 'atencao', icone: '🚛', titulo: `${x.pv_numero} sem programação — ${x.dias < 0 ? `atrasado (era ${dBR(x.data)})` : x.dias === 0 ? 'é HOJE' : x.dias === 1 ? 'é AMANHÃ' : `em ${x.dias} dias (${dBR(x.data)})`}`,
    detalhe: `${x.cliente || ''} · ${x.trecho} · ${x.itens} item(ns) sem AT — programe ou renegocie`, link: { tela: 'programacao' } })).slice(0, 6);
  return { alertas, kpis: { pedidos_sem_programacao: xs.length } };
}

const SENSORES = { ocorrencias, pedidosSemProgramacao, ferias, metasInformar, minhasTarefas, documentosGestao, planoAcaoNC, frotaBloqueada, viagens, vencimentos };

async function montar(sb, { tenantId, userId, perfis = [], nome = '', agora = new Date() }) {
  const hoje = hojeBR(agora);
  let colaborador = null; try { colaborador = (await q(sb.from('colaboradores').select('*').eq('tenant_id', tenantId).eq('usuario_id', userId)))[0] || null; } catch { /* sem cadastro */ }
  const c = { sb, tenantId, userId, perfis, agora, hoje, colaborador, gestor: tem(perfis, GESTAO), gestao: tem(perfis, GESTAO), qualidade: perfis.includes('qualidade'), operacao: perfis.includes('operacao') };
  const res = { alertas: [], prioridades: [], agenda: [], kpis: {}, equipe: null, falhas: [] };
  await Promise.all(Object.entries(SENSORES).map(async ([k, fn]) => {
    try { const r = await fn(c) || {}; res.alertas.push(...(r.alertas || [])); res.prioridades.push(...(r.prioridades || [])); res.agenda.push(...(r.agenda || [])); Object.assign(res.kpis, r.kpis || {}); if (r.equipe) res.equipe = r.equipe; }
    catch (e) { res.falhas.push(k); console.warn(`⚠️ [sala-controle] sensor ${k}:`, e.message); }
  }));
  if (c.gestor) { try { res.saude = (await require('../metas').listar(sb, tenantId, { agora })).map(({ id, chave, nome, area, area_nome, unidade, valor, sinal, tendencia, meta, sentido, tela, descricao }) => ({ id, chave, nome, area, area_nome, unidade, valor, sinal, tendencia, meta, sentido, tela, descricao })); } catch { res.saude = null; } } // SC2: 📊 saúde do negócio
  res.alertas.sort((a, b) => (a.nivel === 'critico' ? 0 : 1) - (b.nivel === 'critico' ? 0 : 1));
  res.prioridades.sort((a, b) => b.peso - a.peso);
  res.agenda.sort((a, b) => String(a.hora || '99').localeCompare(String(b.hora || '99')));
  const crit = res.alertas.filter((a) => a.nivel === 'critico').length;
  const estado = crit ? 'critico' : (res.alertas.length || res.prioridades.some((p) => p.peso >= 80)) ? 'atencao' : 'estavel';
  return { hoje, nome: String(nome || '').split(' ')[0], gestor: c.gestor, estado, ...res };
}

module.exports = { montar, SENSORES, hojeBR };
