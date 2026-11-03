// services/utilizacaoFrota.js — etapa 18f.1: 📊 utilização (passado) × alocação (futuro) da frota e dos motoristas
//
// Linha divisória = HOJE (decidido com o Marcony):
//   • Utilização (realizado): dias em que o recurso esteve numa AT iniciada — do início real até a conclusão
//     (ou até hoje, se ainda em execução). Hoje conta como utilizado.
//   • Alocação (reservado): dias de AT programada / em execução daqui para frente (de amanhã até o fim previsto).
//   Ex.: viagem de 20 dias, hoje é o 10º → 10 dias utilizados + 10 dias reservados.
//
// Base = dias operacionais da frota (services/frotaCalendario.js — padrão seg a sáb, sem feriados).
//   disponível = dias operacionais − dias parado (equipamento bloqueado por inspeção reprovada, desde o bloqueio)
//   ocioso     = disponível − utilizado
//   rodou num dia fora do calendário (domingo/feriado) → conta à parte ("fora do calendário"), não infla o %.
//
// 💰 Receita (só admin/gestor): o valor dos itens da AT (pedido de venda) rateado pelos dias da viagem.
//   receita por dia em uso = receita realizada ÷ dias em uso; receita perdida (estimada) = dias ociosos × receita por dia
//   (do próprio recurso; sem histórico, a média da frota). A receita de uma AT aparece em cada recurso do conjunto
//   e no motorista — por recurso não se soma; o total da frota soma cada AT uma vez.
//
// Frota de transporte = equipamentos ativos que já entraram em alguma AT (equipamento só de locação fica de fora).
const FROTA = require('./frotaCalendario');

const q = async (p) => { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; };
const diaBR = (iso) => (iso ? new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10) : null);
const hojeBR = () => diaBR(new Date().toISOString());
const soma = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
function dias(de, ate) { const out = []; if (!de || !ate || de > ate) return out; for (let d = de; d <= ate; d = soma(d, 1)) out.push(d); return out; }
const r2 = (n) => Math.round(n * 100) / 100;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const ehMotorista = (c) => /motorista|condutor/i.test(String(c.funcao?.nome || c.funcao || ''));

/** dias realizados e reservados de uma AT (YYYY-MM-DD, dias corridos) */
function janelas(e, hoje) {
  if (['rascunho', 'cancelada'].includes(e.status)) return { real: [], reserva: [], total: [] };
  const iniPrev = diaBR(e.inicio_previsto); const fimPrev = diaBR(e.fim_previsto) || iniPrev;
  let real = [];
  if (['em_execucao', 'concluida'].includes(e.status)) {
    const ini = diaBR(e.iniciada_em) || iniPrev;
    const fim = e.status === 'concluida' ? (diaBR(e.concluida_em) || fimPrev) : hoje;
    real = dias(ini, fim < hoje ? fim : hoje);
  }
  let reserva = [];
  if (['programada', 'em_execucao'].includes(e.status) && fimPrev) {
    const ini = e.status === 'em_execucao' ? soma(hoje, 1) : (iniPrev > hoje ? iniPrev : soma(hoje, 1));
    reserva = dias(ini, fimPrev);
  }
  // total da viagem (para ratear a receita): o realizado + o reservado; concluída = o realizado
  const total = [...new Set([...real, ...reserva])].sort();
  return { real, reserva, total: total.length ? total : dias(iniPrev, fimPrev) };
}

/** receita da AT = itens da AT no pedido (valor × quantidade) */
function receitaAT(e, pvs) {
  const pv = pvs.find((p) => String(p.id) === String(e.pv_id)); if (!pv) return 0;
  const porId = new Map(); (pv.grupos || []).forEach((g) => (g.itens || []).forEach((i) => porId.set(String(i.id), i)));
  return (e.itens || []).reduce((s, i) => { const x = porId.get(String(i.id)); return s + (x && x.valor != null ? Number(x.valor) * Number(x.quantidade || 1) : 0); }, 0);
}

function novoRecurso(base) { return { ...base, real: new Set(), reserva: new Set(), parado: new Set(), ats: [], receita: 0, receita_prevista: 0, viagens: 0 }; }

async function painel(supabase, tenantId, { de, ate } = {}, { comValores = false, hoje = hojeBR() } = {}) {
  if (!de || !ate) { de = `${hoje.slice(0, 7)}-01`; const [y, m] = hoje.split('-').map(Number); ate = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); }
  if (de > ate) return { status: 409, erro: 'Período inválido (início depois do fim)' };
  if (dias(de, ate).length > 731) return { status: 409, erro: 'Período máximo: 2 anos' };
  const cal = await FROTA.calendario(supabase, tenantId);
  const [ex, eqs, colabs, pvs, tens] = await Promise.all([
    q(supabase.from('execucoes').select('*').eq('tenant_id', tenantId)),
    q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId)),
    q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId)).catch(() => []),
    comValores ? q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId)).catch(() => []) : Promise.resolve([]),
    q(supabase.from('tenants').select('*').eq('id', tenantId)).catch(() => []),
  ]);
  const validas = ex.filter((e) => !['rascunho', 'cancelada'].includes(e.status));
  const passado = dias(de, ate < hoje ? ate : hoje); const futuro = dias(de > hoje ? de : soma(hoje, 1), ate);
  const opPass = passado.filter((d) => FROTA.ehOperacional(d, cal)); const opFut = futuro.filter((d) => FROTA.ehOperacional(d, cal));
  const noPer = (d) => d >= de && d <= ate;

  // recursos
  const usadosIds = new Set(validas.flatMap((e) => (e.conjunto || []).map((c) => String(c.id))));
  const R = { eq: new Map(), mot: new Map() };
  eqs.filter((e) => e.ativo !== false && usadosIds.has(String(e.id))).forEach((e) => {
    const r = novoRecurso({ id: e.id, tag: e.tag || '', nome: e.nome || '' });
    if (e.bloqueado) { const desde = diaBR(e.bloqueado_em) || hoje; passado.filter((d) => d >= desde).forEach((d) => r.parado.add(d)); r.bloqueado = true; r.bloqueio_motivo = e.bloqueio_motivo || null; }
    R.eq.set(String(e.id), r);
  });
  const chaveMot = (id, nome) => (id ? `id:${id}` : `nome:${String(nome || '').trim().toLowerCase()}`);
  colabs.filter((c) => c.situacao !== 'desligado' && ehMotorista(c)).forEach((c) => R.mot.set(chaveMot(c.id, c.nome), novoRecurso({ id: c.id, nome: c.nome })));

  let receitaFrota = 0; let receitaPrevFrota = 0; let atsNoPeriodo = 0;
  for (const e of validas) {
    const j = janelas(e, hoje);
    const real = j.real.filter(noPer); const reserva = j.reserva.filter(noPer);
    if (!real.length && !reserva.length) continue;
    atsNoPeriodo++;
    const rec = comValores ? receitaAT(e, pvs) : 0; const porDia = j.total.length ? rec / j.total.length : 0;
    const recReal = porDia * real.length; const recPrev = porDia * reserva.length;
    receitaFrota += recReal; receitaPrevFrota += recPrev;
    const linha = { id: e.id, numero: e.numero, status: e.status, de: [...real, ...reserva][0], ate: [...real, ...reserva].slice(-1)[0], dias_real: real.length, dias_reserva: reserva.length, origem: e.origem || '', destino: e.destino || '', cliente: e.cliente_nome || '', ...(comValores ? { receita: r2(recReal), receita_prevista: r2(recPrev) } : {}) };
    const aplicar = (r) => { real.forEach((d) => r.real.add(d)); reserva.forEach((d) => r.reserva.add(d)); r.ats.push(linha); r.receita += recReal; r.receita_prevista += recPrev; if (real.length) r.viagens++; };
    (e.conjunto || []).forEach((c) => { let r = R.eq.get(String(c.id)); if (!r) { r = novoRecurso({ id: c.id, tag: c.tag || '', nome: c.nome || '' }); R.eq.set(String(c.id), r); } aplicar(r); });
    if (e.motorista_id || e.motorista_nome) {
      const k = chaveMot(e.motorista_id, e.motorista_nome);
      let r = R.mot.get(k) || (!e.motorista_id ? null : null);
      if (!r && e.motorista_nome) r = [...R.mot.values()].find((x) => String(x.nome).trim().toLowerCase() === String(e.motorista_nome).trim().toLowerCase()) || null;
      if (!r) { r = novoRecurso({ id: e.motorista_id || null, nome: e.motorista_nome || '—' }); R.mot.set(k, r); }
      aplicar(r);
    }
  }

  const fechar = (r) => {
    const usados = opPass.filter((d) => r.real.has(d)).length;
    const parados = opPass.filter((d) => r.parado.has(d) && !r.real.has(d)).length;
    const disp = opPass.length - parados; const ociosos = Math.max(0, disp - usados);
    const fora = [...r.real].filter((d) => passado.includes(d) && !FROTA.ehOperacional(d, cal)).length;
    const reservados = opFut.filter((d) => r.reserva.has(d)).length;
    const diasUso = [...r.real].filter((d) => passado.includes(d)).length;
    const o = { id: r.id, tag: r.tag, nome: r.nome, ...(r.bloqueado ? { bloqueado: true, bloqueio_motivo: r.bloqueio_motivo } : {}),
      disponiveis: disp, utilizados: usados, parados, ociosos, fora_calendario: fora, utilizacao_pct: pct(usados, disp),
      dias_futuros: opFut.length, reservados, livres_futuro: opFut.length - reservados, alocacao_pct: pct(reservados, opFut.length),
      viagens: r.viagens, ats: r.ats.sort((a, b) => String(a.de).localeCompare(String(b.de))) };
    if (comValores) Object.assign(o, { receita: r2(r.receita), receita_prevista: r2(r.receita_prevista), receita_dia: diasUso ? r2(r.receita / diasUso) : null, _diasUso: diasUso });
    return o;
  };
  const eqL = [...R.eq.values()].map(fechar); const motL = [...R.mot.values()].map(fechar);
  const resumo = (l) => {
    const t = l.reduce((a, x) => ({ disp: a.disp + x.disponiveis, uso: a.uso + x.utilizados, par: a.par + x.parados, oc: a.oc + x.ociosos, fut: a.fut + x.dias_futuros, res: a.res + x.reservados, rd: a.rd + (x._diasUso || 0), rec: a.rec + (x.receita || 0) }), { disp: 0, uso: 0, par: 0, oc: 0, fut: 0, res: 0, rd: 0, rec: 0 });
    const o = { recursos: l.length, utilizacao_pct: pct(t.uso, t.disp), alocacao_pct: pct(t.res, t.fut), disponibilidade_pct: pct(t.disp, t.disp + t.par), dias_ociosos: t.oc, dias_parados: t.par };
    if (comValores) {
      const media = t.rd ? t.rec / t.rd : 0; // receita média por recurso-dia em uso
      l.forEach((x) => { x.receita_perdida = r2(x.ociosos * (x.receita_dia ?? media)); x.receita_perdida_base = x.receita_dia != null ? 'proprio' : 'media_frota'; delete x._diasUso; });
      o.receita_perdida = r2(l.reduce((s, x) => s + x.receita_perdida, 0)); o.receita_dia_media = r2(media);
    }
    return o;
  };
  const ordem = (a, b) => (b.utilizacao_pct ?? -1) - (a.utilizacao_pct ?? -1) || String(a.tag || a.nome).localeCompare(String(b.tag || b.nome));
  const out = {
    periodo: { de, ate, hoje, dias_operacionais_passado: opPass.length, dias_operacionais_futuro: opFut.length },
    empresa: { nome: tens[0]?.nome || '' }, emitido_em: new Date().toISOString(), calendario: FROTA.descrever(cal), com_valores: comValores, ats: atsNoPeriodo,
    equipamentos: { resumo: resumo(eqL), itens: eqL.sort(ordem) },
    motoristas: { resumo: resumo(motL), itens: motL.sort(ordem) },
  };
  if (comValores) Object.assign(out, { receita: r2(receitaFrota), receita_prevista: r2(receitaPrevFrota) });
  return out;
}

module.exports = { painel, _janelas: janelas, _receitaAT: receitaAT };
