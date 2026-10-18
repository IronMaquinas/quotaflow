// services/planosManutencao.js — etapa 12b: planos de manutenção recorrentes
//
// Um plano = "a cada N dias/semanas/meses, para o equipamento X, usando o
// modelo de manutenção Y" (os_templates — o mesmo "Carregar modelo" da OS).
//
// "Gerar OS (12 meses)": cria as OS das ocorrências entre hoje e +12 meses.
//   - A série é ancorada em proxima_data (a data não "anda"; ocorrências que
//     já passaram são ignoradas). Rodar de novo só cria o que falta.
//   - Nunca duplica: OS do mesmo plano na mesma data (não cancelada) é pulada
//     — e o índice único chamados_plano_data_unico (migration 019) garante.
//   - A OS nasce SEM RC e SEM RM (diferente da OS criada na tela): os
//     materiais ficam na fila do comprador (gerar-requisicao-material) para
//     serem pedidos na hora certa. Senão um plano mensal criaria 12 RCs hoje.
//
// 12b.2: responsável (plano → OS), seleção de datas na geração, bloqueio sem
// modelo (exceção "gerar sem itens" com confirmação) e regra de dia útil:
//   data que cai em folga ou feriado vai para o dia útil seguinte (padrão),
//   anterior, ou fica (regra_dia_util = 'proximo' | 'anterior' | 'manter').
//   Dia útil = dia da semana marcado "Trabalho normal" na jornada da empresa
//   (Configurações; sem jornada = segunda a sexta) e que não é feriado cadastrado.
//   origem_plano_data guarda a data NOMINAL da série (é ela que trava duplicar).
//
// Regras do backend respeitadas: sem DB.raw; ids comparados com String();
// numeric chega como string → Number(); filtros sem null.

const { precosReferencia, num } = require('./calendarioManutencao');

const UNIDADES = ['dias', 'semanas', 'meses'];
const HORIZONTE_MESES = 12;
const MAX_OCORRENCIAS = 400;

const pad = (n) => String(n).padStart(2, '0');
const isoData = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parseData = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };

// Soma meses mantendo o dia da âncora (31/01 + 1 mês = 28 ou 29/02; + 2 meses = 31/03)
function somaMeses(ancora, n) {
  const y = ancora.getUTCFullYear(), m = ancora.getUTCMonth() + n, dia = ancora.getUTCDate();
  const ultimo = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(dia, ultimo)));
}

/** Datas (AAAA-MM-DD) das ocorrências do plano entre `de` e `ate` (inclusive).
 *  Respeita plano.termina_em (12b.1): nenhuma ocorrência depois do término. */
function ocorrencias(plano, de, ate) {
  if (plano.termina_em && String(plano.termina_em).slice(0, 10) < String(ate).slice(0, 10)) ate = String(plano.termina_em).slice(0, 10);
  const valor = parseInt(plano.periodicidade_valor, 10);
  if (!(valor >= 1) || !UNIDADES.includes(plano.periodicidade_unidade) || !plano.proxima_data) return [];
  const ancora = parseData(plano.proxima_data);
  const deD = parseData(de), ateD = parseData(ate);
  const out = [];
  for (let i = 0; i < 100000 && out.length < MAX_OCORRENCIAS; i++) {
    let d;
    if (plano.periodicidade_unidade === 'meses') d = somaMeses(ancora, i * valor);
    else d = new Date(ancora.getTime() + i * valor * (plano.periodicidade_unidade === 'semanas' ? 7 : 1) * 86400000);
    if (d > ateD) break;
    if (d >= deD) out.push(isoData(d));
  }
  return out;
}

function janela(hoje = new Date()) {
  // "hoje" no fuso de Brasília
  const local = new Date(hoje.getTime() - 3 * 3600000);
  const de = isoData(local);
  const ate = isoData(new Date(somaMeses(parseData(de), HORIZONTE_MESES).getTime() - 86400000));
  return { de, ate };
}

// Início/fim da OS (ISO com -03:00) a partir da data, hora e duração do plano
function horarioOS(data, plano) {
  const hora = String(plano.hora_inicio || '08:00').slice(0, 5);
  const inicio = new Date(`${data}T${hora}:00-03:00`);
  const fim = new Date(inicio.getTime() + num(plano.duracao_horas || 8) * 3600000);
  const fmt = (d) => { const l = new Date(d.getTime() - 3 * 3600000); return `${isoData(l)}T${pad(l.getUTCHours())}:${pad(l.getUTCMinutes())}:00-03:00`; };
  return { inicio: fmt(inicio), fim: fmt(fim) };
}

/** Custo estimado de UMA OS do plano (puro). */
function custoEstimado(itensModelo, plano, { precos, valorHora }) {
  let materiais = 0, maoDeObra = 0, horas = 0, comValor = 0, total = 0;
  for (const it of itensModelo) {
    total++;
    if (it.tipo === 'servico') {
      const h = num(plano.duracao_horas || 8) * Math.max(parseInt(it.qtd_pessoas_planejada, 10) || 1, 1);
      horas += h;
      if (num(valorHora) > 0) { maoDeObra += h * num(valorHora); comValor++; }
      continue;
    }
    const p = it.item_catalogo_id ? precos.get(String(it.item_catalogo_id)) : null;
    if (p > 0) { materiais += p * Math.max(num(it.quantidade) || 1, 1); comValor++; }
  }
  const r = (v) => Math.round(v * 100) / 100;
  return { materiais: r(materiais), mao_de_obra: r(maoDeObra), total: r(materiais + maoDeObra), horas: Math.round(horas * 10) / 10,
    itens: total, itens_com_valor: comValor, percentual_conhecido: total ? Math.round((comValor / total) * 100) : 0 };
}

// ─── Dia útil (12b.2) ────────────────────────────────────────────────────
const REGRAS_DIA_UTIL = ['proximo', 'anterior', 'manter'];
const DIAS_JORNADA = ['regra_domingo', 'regra_segunda', 'regra_terca', 'regra_quarta', 'regra_quinta', 'regra_sexta', 'regra_sabado'];
const NOME_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Calendário de trabalho: { trabalha: [7 bool, dom..sáb], feriados: Map(data → nome) } */
function montarCalendarioTrabalho(jornada, feriados) {
  const trabalha = jornada
    ? DIAS_JORNADA.map((c) => (jornada[c] || (c === 'regra_domingo' ? 'excepcional' : 'normal')) === 'normal')
    : [false, true, true, true, true, true, false];
  if (!trabalha.some(Boolean)) trabalha.fill(true); // jornada sem nenhum dia normal: não move nada
  const mapa = new Map();
  for (const f of feriados || []) if (f && f.data) mapa.set(String(f.data).slice(0, 10), f.nome || 'Feriado');
  return { trabalha, feriados: mapa };
}

function motivoNaoUtil(data, cal) {
  if (cal.feriados.has(data)) return cal.feriados.get(data);
  const dow = parseData(data).getUTCDay();
  return cal.trabalha[dow] ? null : NOME_DIA[dow];
}

/** Ajusta a data para dia útil conforme a regra. Devolve { data, motivo } (motivo = por que saiu da data original). */
function ajustarDiaUtil(data, regra, cal) {
  if (!cal || regra === 'manter') return { data, motivo: null };
  const motivo = motivoNaoUtil(data, cal);
  if (!motivo) return { data, motivo: null };
  const passo = regra === 'anterior' ? -1 : 1;
  let d = parseData(data);
  for (let i = 0; i < 60; i++) {
    d = new Date(d.getTime() + passo * 86400000);
    if (!motivoNaoUtil(isoData(d), cal)) return { data: isoData(d), motivo };
  }
  return { data, motivo: null }; // não achou em 60 dias: mantém
}

async function calendarioTrabalho(supabase, tenantId) {
  let jornada = null, feriados = [];
  try {
    const js = await q(supabase.from('tenant_jornadas').select('*').eq('tenant_id', tenantId));
    jornada = js.filter((j) => j.ativo !== false).sort((a, b) => (b.padrao ? 1 : 0) - (a.padrao ? 1 : 0))[0] || null;
  } catch (_) { /* sem tabela de jornada: segunda a sexta */ }
  try { feriados = await q(supabase.from('tenant_feriados').select('*').eq('tenant_id', tenantId)); } catch (_) {}
  return montarCalendarioTrabalho(jornada, feriados);
}

// ─── Validação do corpo do plano ─────────────────────────────────────────
function validarPlano(body, { parcial = false } = {}) {
  const erros = [];
  const out = {};
  const tem = (k) => body[k] !== undefined;
  if (!parcial || tem('nome')) {
    const nome = String(body.nome || '').trim();
    if (!nome) erros.push('Informe o nome do plano'); else out.nome = nome.slice(0, 200);
  }
  if (tem('descricao')) out.descricao = body.descricao ? String(body.descricao).slice(0, 2000) : null;
  if (!parcial || tem('periodicidade_valor')) {
    const v = parseInt(body.periodicidade_valor, 10);
    if (!(v >= 1 && v <= 3650)) erros.push('Periodicidade: informe um número entre 1 e 3650'); else out.periodicidade_valor = v;
  }
  if (!parcial || tem('periodicidade_unidade')) {
    if (!UNIDADES.includes(body.periodicidade_unidade)) erros.push('Periodicidade: dias, semanas ou meses'); else out.periodicidade_unidade = body.periodicidade_unidade;
  }
  if (!parcial || tem('proxima_data')) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.proxima_data || ''))) erros.push('Informe a data da próxima manutenção'); else out.proxima_data = body.proxima_data;
  }
  // Término (12b.1): vazio/null = sem término; com data, não pode ser antes da próxima manutenção
  if (tem('termina_em')) {
    if (!body.termina_em) out.termina_em = null;
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.termina_em))) erros.push('Data de término inválida');
    else out.termina_em = body.termina_em;
  }
  if (out.termina_em && out.proxima_data && out.termina_em < out.proxima_data) erros.push('O término não pode ser antes da próxima manutenção');
  if (tem('hora_inicio') && body.hora_inicio) {
    if (!/^\d{2}:\d{2}$/.test(String(body.hora_inicio).slice(0, 5))) erros.push('Hora inválida'); else out.hora_inicio = String(body.hora_inicio).slice(0, 5);
  }
  if (tem('duracao_horas') && body.duracao_horas !== '' && body.duracao_horas !== null) {
    const d = Number(body.duracao_horas);
    if (!(d > 0 && d <= 720)) erros.push('Duração entre 0,5 e 720 horas'); else out.duracao_horas = d;
  }
  if (tem('categoria')) out.categoria = ['corretiva', 'preventiva', 'preditiva'].includes(body.categoria) ? body.categoria : 'preventiva';
  if (tem('urgencia')) out.urgencia = ['alta', 'media', 'baixa'].includes(body.urgencia) ? body.urgencia : 'media';
  if (tem('ativo')) out.ativo = !!body.ativo;
  if (tem('equipamento_id')) out.equipamento_id = body.equipamento_id || null;
  if (tem('responsavel_id')) out.responsavel_id = body.responsavel_id || null;
  if (tem('regra_dia_util')) out.regra_dia_util = REGRAS_DIA_UTIL.includes(body.regra_dia_util) ? body.regra_dia_util : 'proximo';
  if (tem('template_id')) out.template_id = body.template_id || null;
  return { erros, dados: out };
}

// ─── Banco ───────────────────────────────────────────────────────────────
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }

async function itensDoModelo(supabase, tenantId, templateId) {
  if (!templateId) return [];
  const itens = await q(supabase.from('os_template_itens').select('*').eq('tenant_id', tenantId).eq('template_id', templateId));
  return itens.sort((a, b) => (num(a.posicao) - num(b.posicao)) || (num(a.numero_base) - num(b.numero_base)));
}

async function osDoPlano(supabase, tenantId, planoId) {
  const lista = await q(supabase.from('chamados').select('id, numero, origem_plano_data, cancelada_em, concluida_em')
    .eq('tenant_id', tenantId).eq('origem_plano_id', planoId));
  return lista.filter((c) => !c.cancelada_em);
}

async function valorHoraDoTenant(supabase, tenantId) {
  const t = await q(supabase.from('tenants').select('*').eq('id', tenantId));
  const v = num(t[0]?.valor_hora);
  return v > 0 ? v : null;
}

/** Prévia do "Gerar OS (12 meses)" — nada é gravado. */
async function previa(supabase, tenantId, plano, { hoje } = {}) {
  const { de, ate } = janela(hoje);
  const datas = ocorrencias(plano, de, ate);
  const existentes = new Set((await osDoPlano(supabase, tenantId, plano.id)).map((c) => String(c.origem_plano_data).slice(0, 10)));
  const itens = await itensDoModelo(supabase, tenantId, plano.template_id);
  const catIds = [...new Set(itens.filter((i) => i.tipo !== 'servico' && i.item_catalogo_id).map((i) => i.item_catalogo_id))];
  const precos = await precosReferencia(supabase, tenantId, catIds);
  const valorHora = await valorHoraDoTenant(supabase, tenantId);
  const custo = custoEstimado(itens, plano, { precos, valorHora });
  const novas = datas.filter((d) => !existentes.has(d));
  const cal = await calendarioTrabalho(supabase, tenantId);
  const regra = plano.regra_dia_util || 'proximo';
  return {
    de, ate, valor_hora: valorHora, termina_em: plano.termina_em || null,
    itens_modelo: itens.length,
    custo_por_os: custo,
    custo_total: Math.round(custo.total * novas.length * 100) / 100,
    regra_dia_util: regra,
    // data = nominal (da série); data_os = onde a OS vai ficar (dia útil)
    ocorrencias: datas.map((d) => {
      const aj = ajustarDiaUtil(d, regra, cal);
      return { data: d, data_os: aj.data, movida_por: aj.motivo, ...horarioOS(aj.data, plano), ja_existe: existentes.has(d) };
    }),
    novas: novas.length,
    ja_existentes: datas.length - novas.length,
  };
}

async function gerarNumeroOS(supabase, tenantId, usados) {
  const ano = new Date().getFullYear();
  const prefix = `OS-${ano}-`;
  const todos = await q(supabase.from('chamados').select('numero').eq('tenant_id', tenantId));
  let seq = Math.max(0, ...todos.map((c) => c.numero).filter((n) => n && n.startsWith(prefix)).map((n) => parseInt((n.match(/(\d+)$/) || [])[1], 10) || 0)) + 1;
  let numero = `${prefix}${String(seq).padStart(4, '0')}`;
  const existentes = new Set(todos.map((c) => c.numero));
  while (existentes.has(numero) || usados.has(numero)) { seq++; numero = `${prefix}${String(seq).padStart(4, '0')}`; }
  usados.add(numero);
  return numero;
}

function itemDaOS(it, chamadoId, tenantId, idx) {
  const base = {
    chamado_id: chamadoId, tenant_id: tenantId,
    tipo: it.tipo === 'servico' ? 'servico' : 'material',
    origem: 'planejado', status: 'ativo',
    numero_base: it.numero_base ?? idx + 1,
    posicao: it.posicao ?? it.numero_base ?? idx + 1,
  };
  if (base.tipo === 'servico') {
    return { ...base, item_nome: it.item_nome || 'Serviço', descricao: it.descricao || '', quantidade: null, codigo: null,
      urgencia: null, categoria: null, tipo_item: null, item_catalogo_id: null,
      qtd_pessoas_planejada: parseInt(it.qtd_pessoas_planejada, 10) || 1, data_inicio_prevista: null, data_fim_prevista: null };
  }
  return { ...base, item_nome: it.item_nome || '', codigo: it.codigo || '', quantidade: parseInt(it.quantidade, 10) || 1,
    urgencia: null, categoria: null, tipo_item: it.tipo_item || null, descricao: it.descricao || '',
    item_catalogo_id: it.item_catalogo_id || null, unidade_medida: it.unidade_medida || 'UN',
    qtd_pessoas_planejada: null, data_inicio_prevista: null, data_fim_prevista: null };
}

/** Cria as OS que faltam. Devolve { criadas: [{id, numero, data}], puladas }. */
/**
 * opcoes.datas     → só estas datas NOMINAIS (as da prévia); sem isso, todas as que faltam
 * opcoes.semItens  → confirma gerar mesmo sem modelo (OS sem itens)
 */
async function gerar(supabase, tenantId, plano, usuario, { hoje, datas: escolhidas, semItens = false } = {}) {
  if (!plano.ativo) throw Object.assign(new Error('Plano desativado'), { status: 400 });
  const { de, ate } = janela(hoje);
  let datas = ocorrencias(plano, de, ate);
  if (Array.isArray(escolhidas)) {
    const sel = new Set(escolhidas.map((d) => String(d).slice(0, 10)));
    datas = datas.filter((d) => sel.has(d));
  }
  const existentes = new Set((await osDoPlano(supabase, tenantId, plano.id)).map((c) => String(c.origem_plano_data).slice(0, 10)));
  const itens = await itensDoModelo(supabase, tenantId, plano.template_id);
  if (!itens.length && !semItens) {
    throw Object.assign(new Error('O plano não tem modelo de manutenção (ou o modelo está vazio). Planeje a OS antes: monte uma OS com os itens e use “📋 Salvar como modelo”.'), { status: 400, code: 'sem_modelo' });
  }
  const cal = await calendarioTrabalho(supabase, tenantId);
  const regra = plano.regra_dia_util || 'proximo';
  const usados = new Set();
  const criadas = [];
  let puladas = 0;

  for (const data of datas) {
    if (existentes.has(data)) { puladas++; continue; }
    const dataOS = ajustarDiaUtil(data, regra, cal).data;
    const { inicio, fim } = horarioOS(dataOS, plano);
    const numero = await gerarNumeroOS(supabase, tenantId, usados);
    const { data: ins, error } = await supabase.from('chamados').insert([{
      tenant_id: tenantId, numero, tipo_documento: 'os',
      equipamento_id: plano.equipamento_id || null,
      tecnico_id: usuario?.id || null,
      responsavel_id: plano.responsavel_id || null,
      tecnico_nome: usuario?.nome || usuario?.email || 'Plano de manutenção',
      descricao: plano.descricao || '',
      servico_nome: plano.nome,
      urgencia: plano.urgencia || 'media',
      categoria: plano.categoria || 'preventiva',
      status: 'aberta',
      origem_os_numero: plano.nome,
      participa_benchmark: 1,
      modo_programacao: 'geral',
      data_inicio_prevista: inicio,
      data_fim_prevista: fim,
      origem_plano_id: plano.id,
      origem_plano_data: data,
    }]).select();
    if (error) {
      // 23505 = já existe OS deste plano nesta data (gerada em paralelo) → pula
      if (error.code === '23505') { puladas++; continue; }
      throw new Error(error.message);
    }
    const os = ins[0];
    // Um insert por item (mesmo padrão do POST /chamados): material e serviço têm colunas diferentes
    for (let i = 0; i < itens.length; i++) {
      const { error: e2 } = await supabase.from('chamado_itens').insert([itemDaOS(itens[i], os.id, tenantId, i)]);
      if (e2) {
        // não deixa OS pela metade: apaga itens já gravados e a OS
        await supabase.from('chamado_itens').delete().eq('chamado_id', os.id).eq('tenant_id', tenantId);
        await supabase.from('chamados').delete().eq('id', os.id).eq('tenant_id', tenantId);
        throw new Error(e2.message);
      }
    }
    try {
      await supabase.from('chamado_eventos').insert([{ tenant_id: tenantId, chamado_id: os.id, tipo: 'criacao',
        descricao: `OS gerada pelo plano "${plano.nome}" com ${itens.length} item(ns)`,
        dados: { origem_plano_id: plano.id, origem_plano_data: data, data_os: dataOS, responsavel_id: plano.responsavel_id || null }, criado_por: usuario?.id || null, criado_por_nome: usuario?.nome || null }]);
    } catch (_) { /* evento não bloqueia */ }
    criadas.push({ id: os.id, numero: os.numero, data, data_os: dataOS });
  }
  return { criadas, puladas };
}

module.exports = { ocorrencias, janela, horarioOS, custoEstimado, validarPlano, previa, gerar, osDoPlano, itensDoModelo, valorHoraDoTenant, UNIDADES,
  montarCalendarioTrabalho, ajustarDiaUtil, calendarioTrabalho, REGRAS_DIA_UTIL };

// ─── Previstas (12b.4) ───────────────────────────────────────────────────
// Ocorrências dos planos ATIVOS que ainda não viraram OS, entre max(de, hoje) e ate.
// Calculadas na hora (sem tabela): somem sozinhas quando a OS é gerada.
// Devolve itens já na data do dia útil (data_os), com custo estimado por OS.
async function previstasNoIntervalo(supabase, tenantId, de, ate, { equipamentoId, hoje } = {}) {
  const hojeISO = janela(hoje).de;
  const ini = de > hojeISO ? de : hojeISO;
  if (ini > ate) return [];
  let lista = await q(supabase.from('planos_manutencao').select('*').eq('tenant_id', tenantId));
  lista = lista.filter((p) => p.ativo !== false && (!equipamentoId || String(p.equipamento_id) === String(equipamentoId)));
  if (!lista.length) return [];

  const ids = lista.map((p) => p.id);
  const osGeradas = (await q(supabase.from('chamados').select('origem_plano_id, origem_plano_data, cancelada_em')
    .eq('tenant_id', tenantId).in('origem_plano_id', ids))).filter((c) => !c.cancelada_em);
  const existentes = new Set(osGeradas.map((c) => `${c.origem_plano_id}|${String(c.origem_plano_data).slice(0, 10)}`));

  const cal = await calendarioTrabalho(supabase, tenantId);
  const valorHora = await valorHoraDoTenant(supabase, tenantId);
  const out = [];
  for (const p of lista) {
    // folga de 7 dias antes de "ini": uma data nominal anterior pode ter sido movida para dentro do intervalo
    const folga = isoData(new Date(parseData(ini).getTime() - 7 * 86400000));
    const datas = ocorrencias(p, folga, ate).filter((d) => !existentes.has(`${p.id}|${d}`));
    if (!datas.length) continue;
    const itens = await itensDoModelo(supabase, tenantId, p.template_id);
    const catIds = [...new Set(itens.filter((i) => i.tipo !== 'servico' && i.item_catalogo_id).map((i) => i.item_catalogo_id))];
    const precos = await precosReferencia(supabase, tenantId, catIds);
    const custo = custoEstimado(itens, p, { precos, valorHora });
    for (const d of datas) {
      const aj = ajustarDiaUtil(d, p.regra_dia_util || 'proximo', cal);
      if (aj.data < ini || aj.data > ate) continue;
      if (d < hojeISO) continue; // ocorrência nominal já passou: não é mais "prevista"
      const { inicio, fim } = horarioOS(aj.data, p);
      out.push({
        plano_id: p.id, plano_nome: p.nome, data: d, data_os: aj.data, movida_por: aj.motivo,
        inicio, fim, categoria: p.categoria || null, equipamento_id: p.equipamento_id || null,
        responsavel_id: p.responsavel_id || null, tem_modelo: itens.length > 0, custo,
      });
    }
  }
  return out.sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
}

module.exports.previstasNoIntervalo = previstasNoIntervalo;
