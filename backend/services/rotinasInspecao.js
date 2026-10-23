// backend/services/rotinasInspecao.js — etapa 14b.2
//
// Rotinas de inspeção por equipamento + locação de longo prazo (decidido com o Marcony, 22/10/2026):
//   • situação do equipamento: 🏠 'base' | 📍 'locado' (locação ativa em equipamento_locacoes — cliente, contrato, obra…)
//   • rotina = modelo + frequência (diária / semanal / quinzenal / mensal) + quem faz (empresa | locatário) + início.
//     Próxima = última inspeção daquele modelo naquele equipamento (desde o início da rotina) + período; sem nenhuma,
//     vence no início. Situação: em dia · vence hoje · atrasada (dias).
//   • % de cumprimento num intervalo: janelas do período a partir do início da rotina; cumpriu a janela se houve
//     pelo menos uma inspeção do modelo dentro dela. Janela que ainda não terminou só conta se já foi cumprida.
//   • pré-uso não entra aqui (depende do uso, não do calendário).
// Regras do backend: sem DB.raw; ids com String(); datas em YYYY-MM-DD (fuso de Brasília).

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const texto = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const hojeBR = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600000).toISOString().slice(0, 10);
const diaBR = (iso) => (iso ? new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10) : null);
const somaDias = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const diasEntre = (de, ate) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86400000);
const DATA = /^\d{4}-\d{2}-\d{2}$/;

const FREQ = { diaria: 1, semanal: 7, quinzenal: 15, mensal: 30 };
const FREQ_NOME = { diaria: 'Diária', semanal: 'Semanal', quinzenal: 'Quinzenal', mensal: 'Mensal' };
const RESP_NOME = { empresa: 'Empresa', locatario: 'Locatário' };

/** inspeções de um equipamento+modelo a partir de uma data, mais antigas primeiro (dias BR) */
const doModelo = (inspecoes, r) => inspecoes.filter((i) => String(i.equipamento_id) === String(r.equipamento_id) && String(i.modelo_id) === String(r.modelo_id))
  .map((i) => diaBR(i.concluida_em)).filter((d) => d && d >= r.inicio).sort();

function situacao(r, inspecoes, hoje) {
  const p = FREQ[r.frequencia] || 30;
  const feitas = doModelo(inspecoes, r);
  const ultima = feitas[feitas.length - 1] || null;
  const proxima = ultima ? somaDias(ultima, p) : r.inicio;
  const dias = diasEntre(hoje, proxima);
  return { ultima, proxima, dias, estado: dias < 0 ? 'atrasada' : dias === 0 ? 'hoje' : 'em_dia' };
}

function cumprimento(r, inspecoes, de, ate, hoje) {
  const p = FREQ[r.frequencia] || 30;
  const feitas = doModelo(inspecoes, r);
  const fim = [ate, hoje, ...(r.fim ? [r.fim] : [])].sort()[0];
  let esperadas = 0, cumpridas = 0;
  for (let ini = r.inicio; ini <= fim; ini = somaDias(ini, p)) {
    const fimJ = somaDias(ini, p - 1);
    if (fimJ < de) continue;
    const ok = feitas.some((d) => d >= ini && d <= fimJ);
    if (fimJ > hoje && !ok) continue; // janela em andamento ainda não cobrada
    esperadas++; if (ok) cumpridas++;
  }
  return { esperadas, cumpridas, pct: esperadas ? Math.round((cumpridas / esperadas) * 100) : null, feitas_no_periodo: feitas.filter((d) => d >= de && d <= ate).length };
}

async function carregar(supabase, tenantId) {
  const [rotinas, inspecoes, locacoes, modelos, equips] = await Promise.all([
    q(supabase.from('equipamento_rotinas').select('*').eq('tenant_id', tenantId)),
    q(supabase.from('inspecoes').select('*').eq('tenant_id', tenantId)),
    q(supabase.from('equipamento_locacoes').select('*').eq('tenant_id', tenantId)),
    q(supabase.from('inspecao_modelos').select('*').eq('tenant_id', tenantId)),
    q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId)),
  ]);
  return { rotinas, inspecoes, locacoes, modelos: new Map(modelos.map((m) => [String(m.id), m])), equips: new Map(equips.map((e) => [String(e.id), e])) };
}
const enriquecer = (r, base, hoje) => {
  const e = base.equips.get(String(r.equipamento_id)); const m = base.modelos.get(String(r.modelo_id));
  const loc = r.locacao_id ? base.locacoes.find((l) => String(l.id) === String(r.locacao_id)) : null;
  return { ...r, modelo_nome: m?.nome || 'Modelo', equipamento_tag: e?.tag || '', equipamento_nome: [e?.tag, e?.nome].filter(Boolean).join(' — '),
    frequencia_nome: FREQ_NOME[r.frequencia], responsavel_nome: r.responsavel === 'locatario' ? `Locatário${loc ? ` (${loc.cliente})` : ''}` : 'Empresa',
    cliente: loc?.cliente || null, ...situacao(r, base.inspecoes, hoje) };
};

/** Para o painel: por equipamento → situação, locação ativa e rotinas ativas com "próxima / atrasada" */
async function painel(supabase, tenantId, agora = new Date()) {
  const hoje = hojeBR(agora);
  const base = await carregar(supabase, tenantId);
  const porEquip = {};
  for (const [id, e] of base.equips) {
    const loc = e.locacao_id ? base.locacoes.find((l) => String(l.id) === String(e.locacao_id) && l.status === 'ativa') : null;
    porEquip[id] = { situacao: e.situacao === 'locado' && loc ? 'locado' : 'base', locacao: loc || null,
      rotinas: base.rotinas.filter((r) => r.ativo !== false && String(r.equipamento_id) === id).map((r) => enriquecer(r, base, hoje)) };
  }
  return porEquip;
}

async function criarRotina(supabase, tenantId, body = {}) {
  const e = (await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId).eq('id', body.equipamento_id)))[0];
  if (!e) return { status: 404, erro: 'Equipamento não encontrado' };
  const m = (await q(supabase.from('inspecao_modelos').select('*').eq('tenant_id', tenantId).eq('id', body.modelo_id)))[0];
  if (!m || m.ativo === false) return { status: 400, erro: 'Escolha o modelo de inspeção' };
  if (!FREQ[body.frequencia]) return { status: 400, erro: 'Frequência inválida' };
  const responsavel = body.responsavel === 'locatario' ? 'locatario' : 'empresa';
  if (responsavel === 'locatario' && !(e.situacao === 'locado' && e.locacao_id)) return { status: 400, erro: 'O equipamento não está locado — a rotina do locatário só existe durante a locação' };
  const inicio = DATA.test(String(body.inicio || '')) ? body.inicio : hojeBR();
  const { data, error } = await supabase.from('equipamento_rotinas').insert([{ tenant_id: tenantId, equipamento_id: e.id, modelo_id: m.id, frequencia: body.frequencia, responsavel,
    locacao_id: responsavel === 'locatario' ? e.locacao_id : null, inicio, ativo: true }]).select();
  if (error) throw new Error(error.message);
  return { rotina: data[0] };
}
async function removerRotina(supabase, tenantId, id) {
  const { data, error } = await supabase.from('equipamento_rotinas').update({ ativo: false }).eq('tenant_id', tenantId).eq('id', id).select();
  if (error) throw new Error(error.message);
  return data?.length ? { ok: true } : { status: 404, erro: 'Rotina não encontrada' };
}

/** 📍 Locar: cria a locação ativa, marca o equipamento como locado; opcional: rotina do locatário */
async function locar(supabase, tenantId, quem, equipId, body = {}) {
  const e = (await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId).eq('id', equipId)))[0];
  if (!e) return { status: 404, erro: 'Equipamento não encontrado' };
  if (e.situacao === 'locado' && e.locacao_id) return { status: 400, erro: 'O equipamento já está locado — encerre a locação atual antes' };
  if (body.contrato_id) { // 14b.3: locação dentro de um contrato (CL-…) — cliente, obra e contato vêm do contrato
    const c = (await q(supabase.from('locacao_contratos').select('*').eq('tenant_id', tenantId).eq('id', body.contrato_id)))[0];
    if (!c || c.status !== 'ativo') return { status: 400, erro: 'Contrato não encontrado ou encerrado' };
    body = { ...body, cliente: c.cliente, contrato: c.numero, local: body.local || c.local, contato_nome: c.contato_nome, contato_email: c.contato_email, contato_telefone: c.contato_telefone,
      inicio: body.inicio || c.inicio, fim_previsto: body.fim_previsto || c.fim_previsto || null };
  }
  const cliente = texto(body.cliente, 160); if (!cliente) return { status: 400, erro: 'Informe o cliente' };
  const inicio = DATA.test(String(body.inicio || '')) ? body.inicio : null; if (!inicio) return { status: 400, erro: 'Informe a data de início' };
  const fim = body.fim_previsto ? (DATA.test(String(body.fim_previsto)) ? body.fim_previsto : 'x') : null;
  if (fim === 'x' || (fim && fim < inicio)) return { status: 400, erro: 'Fim previsto inválido' };
  const email = texto(body.contato_email, 160); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 400, erro: 'E-mail do contato inválido' };
  if (body.rotina && (!FREQ[body.rotina.frequencia] || !body.rotina.modelo_id)) return { status: 400, erro: 'Rotina do locatário: escolha o modelo e a frequência' };
  const { data, error } = await supabase.from('equipamento_locacoes').insert([{ tenant_id: tenantId, equipamento_id: e.id, cliente, contrato: texto(body.contrato, 80), local: texto(body.local, 200),
    contato_nome: texto(body.contato_nome, 120), contato_email: email, contato_telefone: texto(body.contato_telefone, 30), inicio, fim_previsto: fim, obs: texto(body.obs, 1000),
    status: 'ativa', criado_por_nome: quem.usuarioNome || null, ...(body.contrato_id ? { contrato_id: body.contrato_id } : {}) }]).select();
  if (error) throw new Error(error.message);
  const loc = data[0];
  const { error: eu } = await supabase.from('equipamentos').update({ situacao: 'locado', locacao_id: loc.id }).eq('id', e.id).eq('tenant_id', tenantId);
  if (eu) throw new Error(eu.message);
  if (body.rotina) {
    const r = await criarRotina(supabase, tenantId, { equipamento_id: e.id, modelo_id: body.rotina.modelo_id, frequencia: body.rotina.frequencia, responsavel: 'locatario', inicio: somaDias(inicio, FREQ[body.rotina.frequencia]) });
    if (r.erro) return r;
  }
  return { locacao: loc };
}
/** 🏠 Encerrar a locação: volta para a base; as rotinas do locatário desta locação saem */
async function encerrarLocacao(supabase, tenantId, quem, equipId, body = {}) {
  const e = (await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId).eq('id', equipId)))[0];
  if (!e || !e.locacao_id) return { status: 400, erro: 'O equipamento não está locado' };
  const fim = DATA.test(String(body.fim_real || '')) ? body.fim_real : hojeBR();
  const { error } = await supabase.from('equipamento_locacoes').update({ status: 'encerrada', fim_real: fim, encerrado_por_nome: quem.usuarioNome || null }).eq('id', e.locacao_id).eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  await supabase.from('equipamento_rotinas').update({ ativo: false }).eq('tenant_id', tenantId).eq('locacao_id', e.locacao_id);
  const { error: eu } = await supabase.from('equipamentos').update({ situacao: 'base', locacao_id: null }).eq('id', e.id).eq('tenant_id', tenantId);
  if (eu) throw new Error(eu.message);
  return { ok: true };
}
async function locacoes(supabase, tenantId, equipId) {
  return (await q(supabase.from('equipamento_locacoes').select('*').eq('tenant_id', tenantId).eq('equipamento_id', equipId))).sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)));
}

/** Depois de gravar uma inspeção: liga à locação ativa e registra entrega/devolução nela */
async function aoGravarInspecao(supabase, tenantId, ins, tipo) {
  if (!ins?.equipamento_id) return;
  const e = (await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId).eq('id', ins.equipamento_id)))[0];
  if (!e?.locacao_id) return;
  await supabase.from('inspecoes').update({ locacao_id: e.locacao_id }).eq('id', ins.id).eq('tenant_id', tenantId);
  if (tipo === 'entrega') await supabase.from('equipamento_locacoes').update({ entrega_inspecao_id: ins.id }).eq('id', e.locacao_id).eq('tenant_id', tenantId);
  if (tipo === 'devolucao') await supabase.from('equipamento_locacoes').update({ devolucao_inspecao_id: ins.id }).eq('id', e.locacao_id).eq('tenant_id', tenantId);
}

/** 📊 Cumprimento no intervalo: uma linha por rotina (ativas e as encerradas que cruzam o intervalo) */
async function relatorioCumprimento(supabase, tenantId, de, ate, agora = new Date()) {
  if (!DATA.test(String(de)) || !DATA.test(String(ate)) || de > ate) return { status: 400, erro: 'Período inválido' };
  const hoje = hojeBR(agora);
  const base = await carregar(supabase, tenantId);
  const linhas = [];
  for (const r of base.rotinas) {
    const loc = r.locacao_id ? base.locacoes.find((l) => String(l.id) === String(r.locacao_id)) : null;
    const fimR = r.ativo === false ? (loc?.fim_real || null) : null;
    if (r.ativo === false && !fimR) continue; // removida sem data: sai do relatório
    if (r.inicio > ate || (fimR && fimR < de)) continue;
    const c = cumprimento({ ...r, fim: fimR }, base.inspecoes, de, ate, hoje);
    if (!c.esperadas && !c.feitas_no_periodo) continue;
    linhas.push({ ...enriquecer(r, base, hoje), ...c, encerrada: r.ativo === false });
  }
  linhas.sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101) || a.equipamento_nome.localeCompare(b.equipamento_nome));
  const esp = linhas.reduce((s, l) => s + l.esperadas, 0), cum = linhas.reduce((s, l) => s + l.cumpridas, 0);
  const ins = base.inspecoes.filter((i) => { const d = diaBR(i.concluida_em); return d >= de && d <= ate; });
  const emp = (await q(supabase.from('tenants').select('*').eq('id', tenantId)))[0] || {};
  return { empresa: { nome: emp.nome_fantasia || emp.nome || emp.razao_social || '', razao_social: emp.razao_social || null }, de, ate, linhas, total: { esperadas: esp, cumpridas: cum, pct: esp ? Math.round((cum / esp) * 100) : null },
    inspecoes: { total: ins.length, reprovadas: ins.filter((i) => i.resultado === 'reprovado').length, ressalvas: ins.filter((i) => i.resultado === 'ressalvas').length, terceiros: ins.filter((i) => i.executor_tipo === 'terceiro').length } };
}

/** 🔍 Camada do calendário: próximas inspeções previstas (e as atrasadas, na data em que venceram) */
async function eventosNoIntervalo(supabase, tenantId, de, ate, { equipamentoId = null, agora = new Date() } = {}) {
  const hoje = hojeBR(agora);
  const base = await carregar(supabase, tenantId);
  const out = [];
  for (const r of base.rotinas.filter((x) => x.ativo !== false && (!equipamentoId || String(x.equipamento_id) === String(equipamentoId)))) {
    const x = enriquecer(r, base, hoje); const p = FREQ[r.frequencia];
    const add = (d) => { if (d >= de && d <= ate) out.push({ id: `rot-${r.id}-${d}`, rotina_id: r.id, equipamento_id: r.equipamento_id, data: d, dias: diasEntre(hoje, d),
      situacao: d < hoje ? 'atrasada' : d === hoje ? 'hoje' : 'prevista', titulo: `${x.modelo_nome} (${x.frequencia_nome.toLowerCase()})`, de: `${x.equipamento_nome} · ${x.responsavel_nome}` }); };
    add(x.proxima); // atrasada aparece no dia em que venceu
    for (let d = somaDias(x.proxima < hoje ? hoje : x.proxima, p), n = 0; d <= ate && n < 400; d = somaDias(d, p), n++) add(d);
  }
  return out.sort((a, b) => a.data.localeCompare(b.data));
}

/** ✉ e-mail diário do gestor: rotina atrasada (uma vez por vencimento) */
async function avisosAtrasadas(supabase, tenantId, agora = new Date()) {
  const hoje = hojeBR(agora);
  const base = await carregar(supabase, tenantId);
  return base.rotinas.filter((r) => r.ativo !== false).map((r) => enriquecer(r, base, hoje)).filter((x) => x.estado === 'atrasada')
    .map((x) => ({ categoria: 'insp_atrasada', chave: `insp_rot:${x.id}:${x.proxima}`, marco: 'vencido', dias: x.dias, data: x.proxima,
      titulo: `${x.modelo_nome} (${x.frequencia_nome.toLowerCase()})`, de: `${x.equipamento_nome} · ${x.responsavel_nome}` }));
}

module.exports = { FREQ, FREQ_NOME, RESP_NOME, situacao, cumprimento, painel, criarRotina, removerRotina, locar, encerrarLocacao, locacoes, aoGravarInspecao, relatorioCumprimento, eventosNoIntervalo, avisosAtrasadas, hojeBR };
