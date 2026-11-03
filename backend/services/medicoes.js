// backend/services/medicoes.js — etapa 18d: 📏 MEDIÇÃO MENSAL DO CONTRATO DE LOCAÇÃO (desenho: claude/desenho-medicao-locacao.md)
//
//   • ciclo: do dia `medicao_dia_inicio` (1–28) ao dia anterior do mês seguinte; nulo = mês do calendário (1 ao último dia).
//     Os ciclos contam do início do contrato até o ciclo de hoje.
//   • escopo por equipamento (equipamento_locacoes): unidade hora | dia | fixo, quantidade programada por ciclo e valor unitário
//     (informativo). A medição copia o escopo ao abrir — mudar o escopo depois não altera medição já aberta.
//   • uma medição por contrato × ciclo: itens [{ locacao_id, equipamento_id, tag, nome, unidade, programado, realizado, obs, valor }]
//     "↻ Repetir programado" (realizado = programado). Situação: aberta → enviada (locatário) → aprovada | devolvida.
//     Sem o toggle "Medição pelo locatário", a própria empresa preenche e aprova (aberta → aprovada).
//   • informativo automático (só leitura): inspeções previstas × cumpridas no prazo por equipamento (rotinas do contrato),
//     horímetro das inspeções no ciclo (referência para quem cobra por hora). Gravado na aprovação (fica congelado no BM).
//   • sem desconto nem penalidade: o sistema mostra programado × realizado; as partes se entendem.
// Regras do backend: sem DB.raw; ids com String(); 409 para trava de regra.

const R = require('./rotinasInspecao');

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const texto = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const hojeBR = R.hojeBR;
const diaBR = (iso) => (iso ? new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10) : null);
const UNIDADES = { hora: 'h', dia: 'dia(s)', fixo: 'mês' };
const UNIDADE_NOME = { hora: 'Hora', dia: 'Dia', fixo: 'Valor fixo mensal' };
const STATUS_NOME = { aberta: 'Aberta', enviada: 'Enviada pelo locatário', aprovada: 'Aprovada', devolvida: 'Devolvida ao locatário', pendente: 'A abrir' };
const ERRO_062 = { status: 409, erro: 'Rode a migration 062 antes (medição da locação)' };
const sem062 = (e) => /locacao_medicoes|medicao_|checklist_locatario|does not exist|schema cache/.test(String(e?.message || ''));

// ─── ciclos ─────────────────────────────────────────────────────────────────
const ultimoDia = (a, m) => new Date(Date.UTC(a, m, 0)).getUTCDate(); // m 1–12
const ymd = (a, m, d) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
/** ciclo que contém a data d → { inicio, fim, rotulo } */
function cicloDe(dia, d) {
  const a = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)), dd = Number(d.slice(8, 10));
  const ini = dia && dia > 1 ? dia : 1;
  let ia = a, im = m; if (dd < ini) { im--; if (im < 1) { im = 12; ia--; } }
  const inicio = ymd(ia, im, ini);
  let fa = ia, fm = im + 1; if (fm > 12) { fm = 1; fa++; }
  const fim = ini === 1 ? ymd(ia, im, ultimoDia(ia, im)) : ymd(fa, fm, ini - 1);
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return { inicio, fim, rotulo: ini === 1 ? `${MES[im - 1]}/${ia}` : `${inicio.slice(8)}/${inicio.slice(5, 7)} a ${fim.slice(8)}/${fim.slice(5, 7)}/${fim.slice(0, 4)}` };
}
/** ciclos do início do contrato até o ciclo de hoje (ou o fim do contrato), mais recentes primeiro */
function ciclos(c, hoje = hojeBR()) {
  const out = []; const ate = c.status === 'encerrado' && c.fim_real ? c.fim_real : hoje;
  if (!DATA.test(String(c.inicio || ''))) return out;
  for (let x = cicloDe(c.medicao_dia_inicio, c.inicio), n = 0; x.inicio <= ate && n < 120; n++) {
    out.push(x);
    const prox = new Date(Date.parse(`${x.fim}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
    x = cicloDe(c.medicao_dia_inicio, prox);
  }
  return out.reverse();
}

// ─── leitura ────────────────────────────────────────────────────────────────
async function contratoDo(supabase, tenantId, id) {
  return /^\d+$/.test(String(id)) ? (await q(supabase.from('locacao_contratos').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] || null : null;
}
async function medicaoDo(supabase, tenantId, id) {
  return /^\d+$/.test(String(id)) ? (await q(supabase.from('locacao_medicoes').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] || null : null;
}
const resumo = (m) => {
  const itens = m.itens || [];
  return { preenchidos: itens.filter((i) => i.realizado != null && i.realizado !== '').length, total: itens.length,
    divergentes: itens.filter((i) => i.realizado != null && i.realizado !== '' && i.programado != null && Number(i.realizado) !== Number(i.programado)).length };
};
/** lista de ciclos do contrato com a medição de cada um (ou "a abrir") */
async function listar(supabase, tenantId, contratoId) {
  const c = await contratoDo(supabase, tenantId, contratoId); if (!c) return { status: 404, erro: 'Contrato não encontrado' };
  let ms = [];
  try { ms = await q(supabase.from('locacao_medicoes').select('*').eq('tenant_id', tenantId).eq('contrato_id', c.id)); } catch (e) { if (sem062(e)) return ERRO_062; throw e; }
  const hoje = hojeBR();
  const lista = ciclos(c, hoje).map((x) => {
    const m = ms.find((y) => y.inicio === x.inicio) || null;
    return { ...x, medicao_id: m?.id || null, status: m?.status || 'pendente', status_nome: STATUS_NOME[m?.status || 'pendente'], em_andamento: x.fim >= hoje, ...(m ? resumo(m) : {}) };
  });
  return { contrato: { id: c.id, numero: c.numero, cliente: c.cliente, medicao_dia_inicio: c.medicao_dia_inicio ?? null, medicao_locatario: !!c.medicao_locatario, checklist_locatario: !!c.checklist_locatario }, ciclos: lista };
}

/** informativo automático do ciclo: inspeções (rotinas das locações do contrato) e horímetro por equipamento */
async function informativo(supabase, tenantId, c, inicio, fim) {
  const hoje = hojeBR();
  const locs = await q(supabase.from('equipamento_locacoes').select('*').eq('tenant_id', tenantId).eq('contrato_id', c.id));
  const lids = new Set(locs.map((l) => String(l.id)));
  const eids = new Set(locs.map((l) => String(l.equipamento_id)));
  const rel = await R.relatorioCumprimento(supabase, tenantId, inicio, fim < hoje ? fim : hoje).catch(() => null);
  const linhas = (rel?.linhas || []).filter((l) => (l.locacao_id != null ? lids.has(String(l.locacao_id)) : eids.has(String(l.equipamento_id))));
  const ins = (await q(supabase.from('inspecoes').select('*').eq('tenant_id', tenantId)).catch(() => []))
    .filter((i) => eids.has(String(i.equipamento_id)) && diaBR(i.concluida_em) >= inicio && diaBR(i.concluida_em) <= fim);
  const porEq = {};
  for (const id of eids) {
    const l = linhas.filter((x) => String(x.equipamento_id) === id);
    const hs = ins.filter((i) => String(i.equipamento_id) === id && i.horimetro != null).map((i) => Number(i.horimetro)).filter(Number.isFinite);
    porEq[id] = { previstas: l.reduce((t, x) => t + x.esperadas, 0), no_prazo: l.reduce((t, x) => t + x.cumpridas, 0), feitas: ins.filter((i) => String(i.equipamento_id) === id).length,
      reprovadas: ins.filter((i) => String(i.equipamento_id) === id && i.resultado === 'reprovado').length,
      horimetro: hs.length >= 2 ? { de: Math.min(...hs), ate: Math.max(...hs), horas: Math.round((Math.max(...hs) - Math.min(...hs)) * 10) / 10 } : null,
      rotinas: l.map((x) => ({ modelo: x.modelo_nome, frequencia: x.frequencia_nome, responsavel: x.responsavel_nome, previstas: x.esperadas, no_prazo: x.cumpridas, pct: x.pct })) };
  }
  const tot = Object.values(porEq);
  return { gerado_em: new Date().toISOString(), por_equipamento: porEq,
    total: { previstas: tot.reduce((t, x) => t + x.previstas, 0), no_prazo: tot.reduce((t, x) => t + x.no_prazo, 0), feitas: tot.reduce((t, x) => t + x.feitas, 0), reprovadas: tot.reduce((t, x) => t + x.reprovadas, 0) } };
}

/** detalhe: a medição + o informativo (ao vivo enquanto não aprovada; congelado depois) */
async function detalhe(supabase, tenantId, medicaoId) {
  let m; try { m = await medicaoDo(supabase, tenantId, medicaoId); } catch (e) { if (sem062(e)) return ERRO_062; throw e; }
  if (!m) return { status: 404, erro: 'Medição não encontrada' };
  const c = await contratoDo(supabase, tenantId, m.contrato_id);
  const info = m.status === 'aprovada' && m.informativo ? m.informativo : await informativo(supabase, tenantId, c, m.inicio, m.fim);
  const emp = (await q(supabase.from('tenants').select('*').eq('id', tenantId)))[0] || {};
  return { medicao: { ...m, status_nome: STATUS_NOME[m.status], rotulo: cicloDe(c.medicao_dia_inicio, m.inicio).rotulo, ...resumo(m) },
    contrato: { id: c.id, numero: c.numero, cliente: c.cliente, local: c.local, medicao_locatario: !!c.medicao_locatario },
    informativo: info, unidades: UNIDADES, unidade_nome: UNIDADE_NOME,
    empresa: { nome: emp.nome_fantasia || emp.nome || emp.razao_social || '', razao_social: emp.razao_social || null, cnpj: emp.cnpj || null } };
}

// ─── escrita ────────────────────────────────────────────────────────────────
const evento = (acao, por, obs) => ({ em: new Date().toISOString(), acao, por: por || null, obs: obs || null });
/** abre a medição do ciclo (copia o escopo dos equipamentos que estiveram no contrato no ciclo) */
async function abrir(supabase, tenantId, quem, contratoId, inicio) {
  const c = await contratoDo(supabase, tenantId, contratoId); if (!c) return { status: 404, erro: 'Contrato não encontrado' };
  const x = ciclos(c).find((y) => y.inicio === inicio); if (!x) return { status: 400, erro: 'Ciclo inválido para este contrato' };
  let ja; try { ja = (await q(supabase.from('locacao_medicoes').select('*').eq('tenant_id', tenantId).eq('contrato_id', c.id))).find((m) => m.inicio === x.inicio); } catch (e) { if (sem062(e)) return ERRO_062; throw e; }
  if (ja) return { medicao: ja };
  const locs = (await q(supabase.from('equipamento_locacoes').select('*').eq('tenant_id', tenantId).eq('contrato_id', c.id)))
    .filter((l) => l.inicio <= x.fim && (!(l.fim_real || null) || l.fim_real >= x.inicio)); // esteve no contrato em algum dia do ciclo
  const eqs = new Map((await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId))).map((e) => [String(e.id), e]));
  const itens = locs.map((l) => { const e = eqs.get(String(l.equipamento_id)) || {}; const un = l.medicao_unidade || null;
    return { locacao_id: l.id, equipamento_id: l.equipamento_id, tag: e.tag || null, nome: e.nome || null, unidade: un,
      programado: l.medicao_qtd != null ? Number(l.medicao_qtd) : (un === 'fixo' ? 1 : null), realizado: null, obs: null,
      valor: l.medicao_valor != null ? Number(l.medicao_valor) : (un === 'fixo' && l.valor_mensal != null ? Number(l.valor_mensal) : null) }; })
    .sort((a, b) => String(a.tag || '').localeCompare(String(b.tag || '')));
  const agora = new Date().toISOString();
  const { data, error } = await supabase.from('locacao_medicoes').insert([{ tenant_id: tenantId, contrato_id: c.id, inicio: x.inicio, fim: x.fim, status: 'aberta', itens, obs: null, informativo: null,
    preenchido_por: null, preenchido_em: null, enviado_por: null, enviado_em: null, aprovado_por: null, aprovado_em: null, devolvido_motivo: null,
    historico: [evento('aberta', quem.usuarioNome)], criado_em: agora, atualizado_em: agora }]).select();
  if (error) { if (/locacao_medicoes_uk|duplicate/.test(error.message)) return { medicao: (await q(supabase.from('locacao_medicoes').select('*').eq('tenant_id', tenantId).eq('contrato_id', c.id))).find((m) => m.inicio === x.inicio) }; if (sem062(error)) return ERRO_062; throw new Error(error.message); }
  return { medicao: data[0] };
}
/** salva o realizado (empresa ou locatário). body: { itens: [{ locacao_id, realizado, obs }], obs, repetir_programado } */
async function salvar(supabase, tenantId, quem, m, body = {}, { locatario = false } = {}) {
  const editavel = locatario ? ['aberta', 'devolvida'] : ['aberta', 'devolvida', 'enviada'];
  if (!editavel.includes(m.status)) return { status: 409, erro: m.status === 'aprovada' ? 'Medição aprovada — reabra para alterar' : 'Medição enviada — aguarde a análise da empresa' };
  const por = new Map((Array.isArray(body.itens) ? body.itens : []).map((i) => [String(i.locacao_id), i]));
  const itens = (m.itens || []).map((i) => {
    if (body.repetir_programado && i.programado != null) return { ...i, realizado: i.programado };
    const v = por.get(String(i.locacao_id)); if (!v) return i;
    let r = v.realizado; if (r === '' || r == null) r = null; else { r = Number(String(r).replace(',', '.')); if (!Number.isFinite(r) || r < 0) r = i.realizado; }
    return { ...i, realizado: r, obs: v.obs !== undefined ? texto(v.obs, 300) : i.obs };
  });
  const upd = { itens, atualizado_em: new Date().toISOString(), preenchido_por: quem.usuarioNome || null, preenchido_em: new Date().toISOString() };
  if (body.obs !== undefined) upd.obs = texto(body.obs, 1000);
  const { data, error } = await supabase.from('locacao_medicoes').update(upd).eq('id', m.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return { medicao: data[0] };
}
const faltando = (m) => (m.itens || []).filter((i) => i.realizado == null);
async function mudar(supabase, tenantId, m, upd, ev) {
  const { data, error } = await supabase.from('locacao_medicoes').update({ ...upd, historico: [...(m.historico || []), ev].slice(-60), atualizado_em: new Date().toISOString() }).eq('id', m.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return { medicao: data[0] };
}
/** locatário envia para a empresa analisar */
async function enviar(supabase, tenantId, quem, m) {
  if (!['aberta', 'devolvida'].includes(m.status)) return { status: 409, erro: 'Esta medição não está aberta para envio' };
  if (faltando(m).length) return { status: 400, erro: `Preencha o realizado de todos os equipamentos (faltam ${faltando(m).length}) — use "↻ Repetir programado" se foi igual` };
  return mudar(supabase, tenantId, m, { status: 'enviada', enviado_por: quem.usuarioNome || null, enviado_em: new Date().toISOString(), devolvido_motivo: null }, evento('enviada', quem.usuarioNome));
}
/** empresa aprova (com o toggle: só depois de enviada; sem o toggle: direto da aberta) — congela o informativo */
async function aprovar(supabase, tenantId, quem, m) {
  const c = await contratoDo(supabase, tenantId, m.contrato_id);
  const pode = c?.medicao_locatario ? ['enviada'] : ['aberta', 'devolvida', 'enviada'];
  if (!pode.includes(m.status)) return { status: 409, erro: m.status === 'aprovada' ? 'Já aprovada' : 'O locatário preenche esta medição — aguarde o envio' };
  if (faltando(m).length) return { status: 400, erro: `Falta o realizado de ${faltando(m).length} equipamento(s)` };
  const info = await informativo(supabase, tenantId, c, m.inicio, m.fim);
  return mudar(supabase, tenantId, m, { status: 'aprovada', aprovado_por: quem.usuarioNome || null, aprovado_em: new Date().toISOString(), informativo: info }, evento('aprovada', quem.usuarioNome));
}
async function devolver(supabase, tenantId, quem, m, motivo) {
  const mot = texto(motivo, 500); if (!mot) return { status: 400, erro: 'Conte o que precisa ser corrigido' };
  if (m.status !== 'enviada') return { status: 409, erro: 'Só a medição enviada pelo locatário pode ser devolvida' };
  return mudar(supabase, tenantId, m, { status: 'devolvida', devolvido_motivo: mot }, evento('devolvida', quem.usuarioNome, mot));
}
async function reabrir(supabase, tenantId, quem, m, motivo) {
  if (m.status !== 'aprovada') return { status: 409, erro: 'Só a medição aprovada pode ser reaberta' };
  const mot = texto(motivo, 500); if (!mot) return { status: 400, erro: 'Conte por que está reabrindo' };
  return mudar(supabase, tenantId, m, { status: 'aberta', aprovado_por: null, aprovado_em: null, informativo: null }, evento('reaberta', quem.usuarioNome, mot));
}

// ─── visão da empresa (rotas) ───────────────────────────────────────────────
async function acaoEmpresa(supabase, tenantId, quem, medicaoId, acao, body = {}) {
  let m; try { m = await medicaoDo(supabase, tenantId, medicaoId); } catch (e) { if (sem062(e)) return ERRO_062; throw e; }
  if (!m) return { status: 404, erro: 'Medição não encontrada' };
  if (acao === 'salvar') return salvar(supabase, tenantId, quem, m, body);
  if (acao === 'aprovar') return aprovar(supabase, tenantId, quem, m);
  if (acao === 'devolver') return devolver(supabase, tenantId, quem, m, body.motivo);
  if (acao === 'reabrir') return reabrir(supabase, tenantId, quem, m, body.motivo);
  return { status: 400, erro: 'Ação inválida' };
}
/** pendências da empresa (aba 📏 Medições em Contratos): enviadas para aprovar + ciclos encerrados sem medição aprovada */
async function pendencias(supabase, tenantId) {
  let cs, ms; try { [cs, ms] = await Promise.all([q(supabase.from('locacao_contratos').select('*').eq('tenant_id', tenantId)), q(supabase.from('locacao_medicoes').select('*').eq('tenant_id', tenantId))]); }
  catch (e) { if (sem062(e)) return ERRO_062; throw e; }
  const hoje = hojeBR(); const out = [];
  for (const c of cs.filter((x) => x.status === 'ativo')) {
    for (const x of ciclos(c, hoje).slice(0, 13)) {
      const m = ms.find((y) => String(y.contrato_id) === String(c.id) && y.inicio === x.inicio);
      const st = m?.status || 'pendente';
      if (st === 'aprovada' || (x.fim >= hoje && st !== 'enviada')) continue; // ciclo corrente só aparece se já foi enviado
      out.push({ contrato_id: c.id, numero: c.numero, cliente: c.cliente, ...x, medicao_id: m?.id || null, status: st, status_nome: STATUS_NOME[st], medicao_locatario: !!c.medicao_locatario, ...(m ? resumo(m) : {}) });
    }
  }
  return { pendencias: out.sort((a, b) => (a.status === 'enviada' ? 0 : 1) - (b.status === 'enviada' ? 0 : 1) || a.inicio.localeCompare(b.inicio)) };
}

// ─── visão do LOCATÁRIO (escopo pelo usuário logado — services/contratosLocacao.escopoLocatario) ─────────
async function contratosDoLocatario(supabase, tenantId, usuarioId) {
  const esc = await require('./contratosLocacao').escopoLocatario(supabase, tenantId, usuarioId);
  return esc.contratos.filter((c) => c.medicao_locatario);
}
async function painelLocatario(supabase, tenantId, usuarioId) {
  let cs; try { cs = await contratosDoLocatario(supabase, tenantId, usuarioId); } catch (e) { if (sem062(e)) return { contratos: [] }; throw e; }
  const out = [];
  for (const c of cs) { const l = await listar(supabase, tenantId, c.id); if (!l.erro) out.push({ ...l.contrato, ciclos: l.ciclos.slice(0, 12) }); }
  return { contratos: out };
}
async function medicaoDoLocatario(supabase, tenantId, usuarioId, medicaoId) {
  const cs = await contratosDoLocatario(supabase, tenantId, usuarioId);
  const m = await medicaoDo(supabase, tenantId, medicaoId);
  return m && cs.some((c) => String(c.id) === String(m.contrato_id)) ? m : null;
}
async function acaoLocatario(supabase, tenantId, usuario, acao, { contratoId, inicio, medicaoId, body = {} } = {}) {
  const quem = { usuarioId: usuario.id, usuarioNome: usuario.nome || usuario.email };
  try {
    if (acao === 'abrir') {
      const cs = await contratosDoLocatario(supabase, tenantId, usuario.id);
      if (!cs.some((c) => String(c.id) === String(contratoId))) return { status: 404, erro: 'Contrato não encontrado' };
      return abrir(supabase, tenantId, quem, contratoId, inicio);
    }
    const m = await medicaoDoLocatario(supabase, tenantId, usuario.id, medicaoId); if (!m) return { status: 404, erro: 'Medição não encontrada' };
    if (acao === 'ver') { const d = await detalhe(supabase, tenantId, m.id); return d; }
    if (acao === 'salvar') return salvar(supabase, tenantId, quem, m, body, { locatario: true });
    if (acao === 'enviar') return enviar(supabase, tenantId, quem, m);
    return { status: 400, erro: 'Ação inválida' };
  } catch (e) { if (sem062(e)) return ERRO_062; throw e; }
}

// ─── ✉ lembretes diários ao LOCATÁRIO (cron das 7h / POST /api/recomendacoes/resumo-diario) ──────────────
//   • medição (toggle "Medição pelo locatário"): ciclo encerrado sem envio → no 1º dia ('lembrete') e 5 dias depois ('5')
//   • inspeção (toggle "Checklist pelo locatário"): rotina do locatário atrasada → uma vez por vencimento
//   Controle em avisos_enviados (migration 029); sem ela não avisa (evita repetir todo dia).
const escH = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dBR = (d) => String(d || '').slice(0, 10).split('-').reverse().join('/');
async function avisosDiarios(supabase, { hoje = hojeBR(), enviar = null } = {}) {
  const mandar = enviar || ((para, assunto, html) => require('./emailService').enviarEmailCotacao(para, assunto, html));
  const r = { medicao: 0, inspecao: 0, emails: 0, falhas: 0 };
  let cs; try { cs = (await q(supabase.from('locacao_contratos').select('*'))).filter((c) => c.status === 'ativo' && (c.medicao_locatario || c.checklist_locatario)); } catch (e) { if (sem062(e)) return r; throw e; }
  const porTenant = new Map(); for (const c of cs) { const k = String(c.tenant_id); if (!porTenant.has(k)) porTenant.set(k, []); porTenant.get(k).push(c); }
  const portal = String(process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  for (const [tenantId, lista] of porTenant) {
    let enviados; try { enviados = await q(supabase.from('avisos_enviados').select('*').eq('tenant_id', tenantId)); } catch { continue; } // sem a 029
    const ja = new Set(enviados.map((a) => `${a.chave}|${a.marco}`));
    const [vinc, usuarios, ms, emp] = await Promise.all([
      q(supabase.from('locacao_contrato_usuarios').select('*').eq('tenant_id', tenantId)),
      q(supabase.from('usuarios').select('*').eq('tenant_id', tenantId)),
      q(supabase.from('locacao_medicoes').select('*').eq('tenant_id', tenantId)).catch(() => []),
      q(supabase.from('tenants').select('*').eq('id', tenantId)).then((l) => l[0] || {}),
    ]);
    const empresa = emp.nome_fantasia || emp.nome || emp.razao_social || 'a locadora';
    let painel = null;
    for (const c of lista) {
      const para = vinc.filter((v) => String(v.contrato_id) === String(c.id)).map((v) => usuarios.find((u) => String(u.id) === String(v.usuario_id))).filter((u) => u && u.ativo !== false && u.email);
      if (!para.length) continue;
      const itens = []; // { chave, marco, linha }
      if (c.medicao_locatario) {
        for (const x of ciclos(c, hoje).filter((y) => y.fim < hoje).slice(0, 3)) {
          const m = ms.find((y) => String(y.contrato_id) === String(c.id) && y.inicio === x.inicio);
          if (m && ['enviada', 'aprovada'].includes(m.status)) continue;
          const dias = Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${x.fim}T12:00:00Z`)) / 86400000);
          const marco = dias >= 5 ? '5' : 'lembrete'; const chave = `medicao:${c.id}:${x.inicio}`;
          if (ja.has(`${chave}|${marco}`) || (marco === 'lembrete' && ja.has(`${chave}|5`))) continue;
          itens.push({ chave, marco, tipo: 'medicao', linha: `📏 <b>Medição ${escH(x.rotulo)}</b> (${dBR(x.inicio)} a ${dBR(x.fim)})${m?.status === 'devolvida' ? ' — <b>devolvida para correção</b>' : ''}: preencha o realizado de cada equipamento e envie.` });
        }
      }
      if (c.checklist_locatario) {
        if (!painel) painel = await R.painel(supabase, tenantId).catch(() => ({}));
        const locs = new Set((await q(supabase.from('equipamento_locacoes').select('*').eq('tenant_id', tenantId).eq('contrato_id', c.id))).filter((l) => l.status === 'ativa').map((l) => String(l.id)));
        for (const pe of Object.values(painel)) for (const rt of pe.rotinas || []) {
          if (rt.responsavel !== 'locatario' || !locs.has(String(rt.locacao_id)) || rt.estado !== 'atrasada') continue;
          const chave = `insp_loc:${rt.id}:${rt.proxima}`; if (ja.has(`${chave}|vencido`)) continue;
          itens.push({ chave, marco: 'vencido', tipo: 'inspecao', linha: `🔍 <b>${escH(rt.equipamento_nome)}</b> — ${escH(rt.modelo_nome)} (${escH(String(rt.frequencia_nome).toLowerCase())}) atrasada desde ${dBR(rt.proxima)}.` });
        }
      }
      if (!itens.length) continue;
      const nMed = itens.filter((i) => i.tipo === 'medicao').length; const nIns = itens.length - nMed;
      const assunto = `${nMed ? `📏 Medição do contrato ${c.numero}` : ''}${nMed && nIns ? ' e ' : ''}${nIns ? `🔍 ${nIns} inspeção(ões) atrasada(s)` : ''} — ${empresa}`;
      const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#111"><p>Olá! Pendências do contrato <b>${escH(c.numero)}</b> com <b>${escH(empresa)}</b>:</p><ul>${itens.map((i) => `<li>${i.linha}</li>`).join('')}</ul>${portal ? `<p><a href="${portal}/#${nMed ? 'medicoes' : 'contratos'}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Abrir no QuotaFlow</a></p>` : ''}<p style="color:#666;font-size:12px">Aviso automático do QuotaFlow.</p></div>`;
      let ok = 0;
      for (const u of para) { try { await mandar(u.email, assunto, html); ok++; r.emails++; } catch (e) { r.falhas++; console.error('❌ [medição] e-mail:', e.message || e); } }
      if (ok) {
        await supabase.from('avisos_enviados').upsert(itens.map((i) => ({ tenant_id: tenantId, chave: i.chave, marco: i.marco, destinatarios: ok })), { onConflict: 'tenant_id,chave,marco', ignoreDuplicates: true });
        r.medicao += nMed; r.inspecao += nIns;
      }
    }
  }
  console.log(`📏 [medição] lembretes ao locatário: ${r.medicao} medição(ões), ${r.inspecao} inspeção(ões), ${r.emails} e-mail(s), ${r.falhas} falha(s)`);
  return r;
}

module.exports = { avisosDiarios, UNIDADES, UNIDADE_NOME, STATUS_NOME, cicloDe, ciclos, listar, detalhe, abrir, salvar, enviar, aprovar, devolver, reabrir, acaoEmpresa, pendencias, painelLocatario, acaoLocatario, informativo };
