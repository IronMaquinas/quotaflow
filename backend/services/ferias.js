// services/ferias.js — etapa B1.5: 🏖 férias do colaborador (Pessoas → aba 🏖 Férias)
//   Um período por linha (fracionadas = várias). Situação pela data de hoje (Brasília): programada · em_gozo · concluida.
//   Não deixa dois períodos se sobreporem para a mesma pessoa (409).
// B1.6: regras do país (services/feriasRegras — tenants.pais; BR = CLT): a partir da ADMISSÃO, períodos aquisitivos de 12 meses,
//   direito conforme as FALTAS injustificadas do período (colaborador_faltas), limite para gozar (concessivo) e saldo × gozado × programado.
//   Cada lançamento de férias consome o período aberto mais antigo (ordem de data). Períodos cujo limite acabou ANTES do
//   início do controle (1º lançamento de férias da empresa) contam como "anteriores ao controle" (não viram alerta falso).
//   analisar(): o 🧠 Analista confere a programação e lembra o gestor (faltas, saldo, fracionamento, abono, aviso de 30 dias,
//   início antes de feriado/domingo, limite) — avisos, não bloqueios. Bloqueia só: datas inválidas, > 30 dias, sobreposição.
const REGRAS = require('./feriasRegras');
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const hojeBR = () => new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
const d10 = (v) => (v ? String(v).slice(0, 10) : null);
const dias = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

function situacao(f, hoje = hojeBR()) {
  const i = d10(f.inicio), fim = d10(f.fim);
  if (hoje < i) return 'programada';
  if (hoje > fim) return 'concluida';
  return 'em_gozo';
}

function enriquecer(f, colabs, hoje = hojeBR()) {
  const c = colabs.find((x) => String(x.id) === String(f.colaborador_id)) || {};
  const sit = situacao(f, hoje);
  return { ...f, inicio: d10(f.inicio), fim: d10(f.fim), colaborador_nome: c.nome || '—', funcao: c.funcao_nome || c.funcao || null,
    dias: dias(d10(f.inicio), d10(f.fim)) + 1, situacao: sit,
    retorno: new Date(Date.parse(d10(f.fim)) + 864e5).toISOString().slice(0, 10),
    faltam_dias: sit === 'programada' ? dias(hoje, d10(f.inicio)) : null };
}

async function listar(sb, tenantId, { colaboradorId = null } = {}) {
  const ctx = await contexto(sb, tenantId); const { hoje } = ctx; // B1.6: período aquisitivo calculado
  const per = new Map();
  for (const c of ctx.colabs) { const { alocacao } = montarPeriodos({ admissao: d10(c.admissao), ferias: ctx.ferias.filter((f) => String(f.colaborador_id) === String(c.id)), faltas: ctx.faltas, colabId: c.id, R: ctx.R, hoje, controleDesde: ctx.controleDesde }); for (const [k, p] of alocacao) per.set(k, p.rotulo); }
  return ctx.ferias.filter((f) => !colaboradorId || String(f.colaborador_id) === String(colaboradorId)).map((f) => ({ ...enriquecer(f, ctx.colabs, hoje), periodo_aquisitivo: per.get(String(f.id)) || f.periodo_aquisitivo || null }))
    .sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
}

/** colaboradorId → { fim } de quem está de férias hoje */
async function deFeriasHoje(sb, tenantId) {
  const hoje = hojeBR(); const m = new Map();
  for (const f of await q(sb.from('colaborador_ferias').select('*').eq('tenant_id', tenantId))) if (situacao(f, hoje) === 'em_gozo') m.set(String(f.colaborador_id), { fim: d10(f.fim) });
  return m;
}

async function validar(sb, tenantId, dados, id = null) {
  const inicio = d10(dados.inicio), fim = d10(dados.fim);
  if (!dados.colaborador_id) return 'Escolha o funcionário.';
  if (!inicio || !fim) return 'Informe o início e o fim das férias.';
  if (fim < inicio) return 'O fim não pode ser antes do início.';
  if (dias(inicio, fim) + 1 > 30) return 'Cada período tem no máximo 30 dias (lance as férias fracionadas em períodos separados).';
  const ab = Number(dados.abono_dias || 0); if (!(ab >= 0 && ab <= 10)) return 'Abono (dias vendidos) vai de 0 a 10.';
  const colab = (await q(sb.from('colaboradores').select('id, nome').eq('tenant_id', tenantId).eq('id', dados.colaborador_id)))[0];
  if (!colab) return 'Funcionário não encontrado.';
  const outros = (await q(sb.from('colaborador_ferias').select('*').eq('tenant_id', tenantId).eq('colaborador_id', dados.colaborador_id))).filter((f) => !id || String(f.id) !== String(id));
  const choca = outros.find((f) => !(fim < d10(f.inicio) || inicio > d10(f.fim)));
  if (choca) return { status: 409, erro: `${colab.nome} já tem férias de ${d10(choca.inicio).split('-').reverse().join('/')} a ${d10(choca.fim).split('-').reverse().join('/')} — os períodos se sobrepõem.` };
  return null;
}

const campos = (d) => ({ colaborador_id: d.colaborador_id, inicio: d10(d.inicio), fim: d10(d.fim), abono_dias: Number(d.abono_dias || 0), obs: (d.obs || '').trim() || null });

async function criar(sb, tenantId, dados, porNome) {
  const v = await validar(sb, tenantId, dados); if (v) return typeof v === 'string' ? { status: 400, erro: v } : v;
  const r = await q(sb.from('colaborador_ferias').insert([{ tenant_id: tenantId, ...campos(dados), criado_por_nome: porNome || null }]).select());
  return { ferias: r[0] };
}
async function atualizar(sb, tenantId, id, dados) {
  const atual = (await q(sb.from('colaborador_ferias').select('*').eq('tenant_id', tenantId).eq('id', id)))[0];
  if (!atual) return { status: 404, erro: 'Férias não encontradas.' };
  const novo = { ...atual, ...dados };
  const v = await validar(sb, tenantId, novo, id); if (v) return typeof v === 'string' ? { status: 400, erro: v } : v;
  const r = await q(sb.from('colaborador_ferias').update({ ...campos(novo), atualizado_em: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id).select());
  return { ferias: r[0] };
}
async function excluir(sb, tenantId, id) {
  await q(sb.from('colaborador_ferias').delete().eq('tenant_id', tenantId).eq('id', id));
  return { ok: true };
}


// ═══ B1.6: períodos, saldo, faltas e o 🧠 Analista ═══════════════════════════
const somaMeses = (iso, n) => { const [a, m, d] = iso.split('-').map(Number); const x = new Date(Date.UTC(a, m - 1 + n, 1)); const ult = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate(); x.setUTCDate(Math.min(d, ult)); return x.toISOString().slice(0, 10); };
const somaDias = (iso, n) => { const x = new Date(`${iso}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dBR = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—');

async function regrasDoTenant(sb, tenantId) { try { const t = (await q(sb.from('tenants').select('*').eq('id', tenantId)))[0]; return REGRAS.regrasDe(t?.pais); } catch { return REGRAS.regrasDe('BR'); } }
async function faltasDe(sb, tenantId) { try { return await q(sb.from('colaborador_faltas').select('*').eq('tenant_id', tenantId)); } catch { return []; } }
const faltasNoIntervalo = (fs, colabId, ini, fim) => fs.filter((f) => String(f.colaborador_id) === String(colabId) && d10(f.data) >= ini && d10(f.data) <= fim).reduce((s, f) => s + Number(f.dias || 1), 0);

/** períodos aquisitivos de UM colaborador, com as férias distribuídas (a mais antiga primeiro) */
function montarPeriodos({ admissao, ferias, faltas, colabId, R, hoje, controleDesde }) {
  if (!admissao) return { periodos: [], alocacao: new Map() };
  const ps = [];
  for (let n = 0; n < 80; n++) {
    const inicio = somaMeses(admissao, n * R.periodoAquisitivoMeses); if (inicio > hoje) break;
    const fim = somaDias(somaMeses(admissao, (n + 1) * R.periodoAquisitivoMeses), -1);
    const limite = somaMeses(fim, R.periodoConcessivoMeses);
    const nf = faltasNoIntervalo(faltas, colabId, inicio, fim);
    ps.push({ n: n + 1, inicio, fim, limite, rotulo: `${inicio.slice(0, 4)}/${fim.slice(0, 4)}`, faltas: nf, direito: R.diasPorFaltas(nf), gozado: 0, programado: 0, lancamentos: [], em_aquisicao: fim >= hoje, anterior_controle: limite < controleDesde });
  }
  const alocacao = new Map();
  const ordem = [...ferias].sort((a, b) => d10(a.inicio).localeCompare(d10(b.inicio)));
  for (const f of ordem) {
    const consumo = dias(d10(f.inicio), d10(f.fim)) + 1 + Number(f.abono_dias || 0);
    const p = ps.find((x) => x.direito - x.gozado - x.programado > 0 && (!x.anterior_controle || d10(f.inicio) <= x.limite)) || ps[ps.length - 1]; // anterior ao controle só recebe férias da própria época
    if (!p) continue;
    if (d10(f.fim) < hoje) p.gozado += consumo; else p.programado += consumo;
    p.lancamentos.push(f.id); alocacao.set(String(f.id), p);
  }
  for (const p of ps) {
    p.saldo = p.direito - p.gozado - p.programado;
    p.situacao = p.em_aquisicao ? 'em_aquisicao' : p.saldo <= 0 ? 'quitado' : p.anterior_controle && !p.lancamentos.length ? 'anterior_controle' : p.limite < hoje ? 'vencido' : 'aberto';
    p.dias_para_limite = dias(hoje, p.limite);
  }
  return { periodos: ps, alocacao };
}

async function contexto(sb, tenantId) {
  const [R, ferias, faltas, colabs] = await Promise.all([regrasDoTenant(sb, tenantId), q(sb.from('colaborador_ferias').select('*').eq('tenant_id', tenantId)), faltasDe(sb, tenantId), q(sb.from('colaboradores').select('*').eq('tenant_id', tenantId))]);
  const hoje = hojeBR();
  const primeiro = ferias.map((f) => d10(f.criado_em) || d10(f.inicio)).filter(Boolean).sort()[0];
  return { R, ferias, faltas, colabs, hoje, controleDesde: primeiro && primeiro < hoje ? primeiro : hoje };
}

/** saldo de férias por colaborador (ativos) — alerta: vencido · critico · vencendo · sem_admissao */
async function saldos(sb, tenantId, { colaboradorId = null } = {}) {
  const ctx = await contexto(sb, tenantId); const { R, hoje } = ctx;
  const lista = ctx.colabs.filter((c) => c.situacao !== 'desligado' && (!colaboradorId || String(c.id) === String(colaboradorId))).map((c) => {
    const { periodos } = montarPeriodos({ admissao: d10(c.admissao), ferias: ctx.ferias.filter((f) => String(f.colaborador_id) === String(c.id)), faltas: ctx.faltas, colabId: c.id, R, hoje, controleDesde: ctx.controleDesde });
    const vis = periodos.filter((p) => p.situacao !== 'anterior_controle' && (p.situacao !== 'quitado' || p.limite >= hoje));
    const abertos = vis.filter((p) => ['aberto', 'vencido'].includes(p.situacao));
    const atual = abertos[0] || vis.find((p) => p.situacao === 'em_aquisicao') || null;
    const proxLimite = abertos.filter((p) => p.situacao === 'aberto').sort((a, b) => a.limite.localeCompare(b.limite))[0];
    let alerta = null;
    if (!c.admissao) alerta = 'sem_admissao';
    else if (abertos.some((p) => p.situacao === 'vencido')) alerta = 'vencido';
    else if (proxLimite && proxLimite.dias_para_limite <= R.alertas.criticoDias) alerta = 'critico';
    else if (proxLimite && proxLimite.dias_para_limite <= R.alertas.vencendoDias) alerta = 'vencendo';
    const faltas12 = faltasNoIntervalo(ctx.faltas, c.id, atual ? atual.inicio : somaMeses(hoje, -12), hoje);
    return { colaborador_id: c.id, nome: c.nome, funcao: c.funcao || null, admissao: d10(c.admissao), periodos: vis, atual, alerta, a_gozar: abertos.reduce((s, p) => s + Math.max(0, p.saldo), 0), programado: vis.reduce((s, p) => s + p.programado, 0), proximo_limite: proxLimite?.limite || null, faltas_periodo: faltas12 };
  });
  return { pais: R.pais, regras: R.nome, controle_desde: ctx.controleDesde, hoje, colaboradores: lista.sort((a, b) => a.nome.localeCompare(b.nome)) };
}

/** 🧠 o Analista confere uma programação (antes de salvar) */
async function analisar(sb, tenantId, dados = {}, id = null) {
  const ctx = await contexto(sb, tenantId); const { R, hoje } = ctx;
  const c = ctx.colabs.find((x) => String(x.id) === String(dados.colaborador_id)); if (!c) return { avisos: [] };
  const inicio = d10(dados.inicio), fim = d10(dados.fim); if (!inicio || !fim || fim < inicio) return { avisos: [] };
  const avisos = []; const A = (nivel, texto) => avisos.push({ nivel, texto });
  if (!c.admissao) { A('alerta', `Sem data de admissão no cadastro de ${c.nome} — sem ela não dá para calcular o período aquisitivo e o saldo. Preencha em Pessoas → Editar.`); return { avisos }; }
  const nova = { id: id || '__nova', colaborador_id: c.id, inicio, fim, abono_dias: Number(dados.abono_dias || 0) };
  const doColab = ctx.ferias.filter((f) => String(f.colaborador_id) === String(c.id) && (!id || String(f.id) !== String(id)));
  const { periodos, alocacao } = montarPeriodos({ admissao: d10(c.admissao), ferias: [...doColab, nova], faltas: ctx.faltas, colabId: c.id, R, hoje, controleDesde: ctx.controleDesde });
  const p = alocacao.get(String(nova.id)); const qtd = dias(inicio, fim) + 1;
  if (p) {
    if (p.faltas > 5) A('lembrete', `${c.nome} tem ${p.faltas} falta(s) injustificada(s) no período ${dBR(p.inicio)} a ${dBR(p.fim)} — pela regra (${R.nome}) o direito cai para ${p.direito} dias.`);
    else if (p.faltas > 0) A('info', `${p.faltas} falta(s) injustificada(s) no período aquisitivo — ainda não reduz os dias (reduz a partir de 6).`);
    if (p.saldo < 0) A('alerta', `Passa do saldo: o período ${p.rotulo} dá direito a ${p.direito} dias e, com esta, ficam ${p.direito - p.saldo} lançados (${-p.saldo} a mais).`);
    if (p.em_aquisicao) A('alerta', `Férias antecipadas: o período aquisitivo de ${c.nome} só se completa em ${dBR(somaDias(p.fim, 1))}.`);
    if (fim > p.limite) A('alerta', `Termina depois do limite do período (${dBR(p.limite)}) — os dias além do limite saem em dobro.`);
    const doPeriodo = [...doColab.filter((f) => alocacao.get(String(f.id)) === p), nova].map((f) => dias(d10(f.inicio), d10(f.fim)) + 1);
    const F = R.fracionamento;
    if (doPeriodo.length > F.maxPeriodos) A('alerta', `Este seria o ${doPeriodo.length}º período de férias do aquisitivo ${p.rotulo} — o máximo é ${F.maxPeriodos}.`);
    if (doPeriodo.length > 1 && qtd < F.minDemais) A('alerta', `Férias fracionadas: cada período precisa ter pelo menos ${F.minDemais} dias.`);
    if (doPeriodo.length > 1 && p.saldo <= 0 && !doPeriodo.some((d) => d >= F.minUmPeriodo)) A('alerta', `Férias fracionadas: um dos períodos precisa ter pelo menos ${F.minUmPeriodo} dias.`);
    if (doPeriodo.length > 1 && p.saldo > 0 && !doPeriodo.some((d) => d >= F.minUmPeriodo) && p.saldo < F.minUmPeriodo) A('alerta', `Férias fracionadas: nenhum período tem ${F.minUmPeriodo} dias e o saldo (${p.saldo}) não dá mais para isso.`);
    if (nova.abono_dias > Math.floor(p.direito * R.abonoMaxFracao)) A('alerta', `Abono acima do permitido: pode vender até ${Math.floor(p.direito * R.abonoMaxFracao)} dia(s) deste período.`);
    if (p.saldo >= 0 && !avisos.some((a) => a.nivel === 'alerta')) A('ok', `Período ${p.rotulo}: direito ${p.direito} dias · com esta, sobra ${p.saldo} · limite para gozar ${dBR(p.limite)}.`);
  }
  if (dias(hoje, inicio) < R.avisoPrevioDias && inicio >= hoje) A('alerta', `Começa em ${dias(hoje, inicio)} dia(s) — a comunicação ao funcionário deve ser feita com ${R.avisoPrevioDias} dias de antecedência.`);
  const feriados = new Set([...R.feriadosNacionais(+inicio.slice(0, 4)), ...R.feriadosNacionais(+inicio.slice(0, 4) + 1)]);
  try { for (const f of await q(sb.from('tenant_feriados').select('*').eq('tenant_id', tenantId))) feriados.add(d10(f.data)); } catch { /* ok */ }
  for (let k = 1; k <= R.inicioVedadoAntesDeDescanso; k++) {
    const d = somaDias(inicio, k); const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (feriados.has(d) || R.diasDescanso.includes(dow)) { A('alerta', `Começa ${k === 1 ? 'na véspera' : `${k} dias antes`} de ${feriados.has(d) ? `feriado (${dBR(d)})` : 'domingo (repouso)'} — a regra não permite início nos ${R.inicioVedadoAntesDeDescanso} dias antes de feriado ou repouso.`); break; }
  }
  return { periodo: p ? { rotulo: p.rotulo, inicio: p.inicio, fim: p.fim, limite: p.limite, direito: p.direito, faltas: p.faltas, saldo_depois: p.saldo } : null, avisos };
}

// ⚠ faltas injustificadas
async function listarFaltas(sb, tenantId, colaboradorId) { return (await q(sb.from('colaborador_faltas').select('*').eq('tenant_id', tenantId).eq('colaborador_id', colaboradorId))).map((f) => ({ ...f, data: d10(f.data) })).sort((a, b) => b.data.localeCompare(a.data)); }
async function registrarFalta(sb, tenantId, colaboradorId, d = {}, porNome) {
  const data = d10(d.data); const n = Number(d.dias || 1);
  if (!data) return { status: 400, erro: 'Informe a data da falta.' };
  if (data > hojeBR()) return { status: 400, erro: 'A falta não pode ser no futuro.' };
  if (!(n >= 1 && n <= 60)) return { status: 400, erro: 'Dias de falta: de 1 a 60.' };
  const colab = (await q(sb.from('colaboradores').select('id').eq('tenant_id', tenantId).eq('id', colaboradorId)))[0]; if (!colab) return { status: 404, erro: 'Funcionário não encontrado.' };
  const ja = (await listarFaltas(sb, tenantId, colaboradorId)).find((f) => !(somaDias(data, n - 1) < f.data || data > somaDias(f.data, Number(f.dias || 1) - 1)));
  if (ja) return { status: 409, erro: `Já há falta lançada em ${dBR(ja.data)}${ja.dias > 1 ? ` (${ja.dias} dias)` : ''}.` };
  const r = await q(sb.from('colaborador_faltas').insert([{ tenant_id: tenantId, colaborador_id: colaboradorId, data, dias: n, obs: (d.obs || '').trim() || null, criado_por_nome: porNome || null }]).select());
  return { falta: r[0] };
}
async function excluirFalta(sb, tenantId, id) { await q(sb.from('colaborador_faltas').delete().eq('tenant_id', tenantId).eq('id', id)); return { ok: true }; }

module.exports = { listar, criar, atualizar, excluir, deFeriasHoje, situacao, enriquecer, hojeBR, saldos, analisar, montarPeriodos, listarFaltas, registrarFalta, excluirFalta, somaMeses };
