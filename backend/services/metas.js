// services/metas.js — etapa SC2: 🎯 METAS DO NEGÓCIO (KPIs)
//   MEDIDAS = o que o sistema sabe calcular (chave → nome, área, unidade, sentido, sugestão de meta/limite, cálculo).
//   A empresa importa as sugeridas (e ajusta meta e limites) ou cria escolhendo uma medida. Sem meta = número sem semáforo.
//   Semáforo: sentido 'maior' → ≥ meta 🟢 · ≥ limite 🟡 · abaixo 🔴 ; 'menor' → ≤ meta 🟢 · ≤ limite 🟡 · acima 🔴.
//   Tendência: fotografia diária (metas_fotografias) → compara com ~30 dias atrás.

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const hojeBR = (agora = new Date()) => new Date(agora.getTime() - 3 * 36e5).toISOString().slice(0, 10);
const diasAtras = (dia, n) => new Date(new Date(dia + 'T12:00:00Z').getTime() - n * 864e5).toISOString().slice(0, 10);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const ATIVA = (e) => !/vendid|baixad|inativ|sucata/i.test(String(e.situacao || ''));

const AREAS = { operacao: '🛠 Operação', frota: '🚛 Frota', manutencao: '🔧 Manutenção', financeiro: '💵 Financeiro', seguranca: '🦺 Segurança', qualidade: '⚠️ Qualidade', pessoas: '👷 Pessoas', comercial: '📈 Comercial', compras: '🛒 Compras', gestao: '📌 Gestão' };

const MEDIDAS = {
  disponibilidade_frota: { nome: 'Disponibilidade da frota', area: 'frota', unidade: '%', sentido: 'maior', sug: [95, 90], tela: 'equipamentos',
    como: 'equipamentos sem bloqueio ÷ equipamentos ativos',
    calc: async (c) => { const es = (await q(c.sb.from('equipamentos').select('*').eq('tenant_id', c.tenantId))).filter(ATIVA); return pct(es.filter((e) => !e.bloqueado).length, es.length); } },
  equipamentos_bloqueados: { nome: 'Equipamentos bloqueados', area: 'frota', unidade: 'un', sentido: 'menor', sug: [0, 1], tela: 'inspecoes',
    como: 'equipamentos bloqueados agora por reprovação na inspeção',
    calc: async (c) => (await q(c.sb.from('equipamentos').select('*').eq('tenant_id', c.tenantId))).filter((e) => ATIVA(e) && e.bloqueado).length },
  ats_no_prazo: { nome: 'Viagens iniciadas no prazo (30 dias)', area: 'operacao', unidade: '%', sentido: 'maior', sug: [95, 85], tela: 'programacao',
    como: 'ATs iniciadas até 2 h do previsto ÷ ATs iniciadas nos últimos 30 dias',
    calc: async (c) => { const de = diasAtras(c.hoje, 30); const xs = (await q(c.sb.from('execucoes').select('*').eq('tenant_id', c.tenantId))).filter((x) => x.iniciada_em && x.inicio_previsto && String(x.iniciada_em).slice(0, 10) >= de);
      return pct(xs.filter((x) => new Date(x.iniciada_em) - new Date(x.inicio_previsto) <= 2 * 36e5).length, xs.length); } },
  ncs_abertas_30d: { nome: 'NCs abertas há mais de 30 dias', area: 'qualidade', unidade: 'un', sentido: 'menor', sug: [0, 3], tela: 'nao_conformidades',
    como: 'não conformidades não resolvidas abertas há mais de 30 dias',
    calc: async (c) => { const lim = diasAtras(c.hoje, 30); return (await q(c.sb.from('nao_conformidades').select('*').eq('tenant_id', c.tenantId))).filter((n) => !['resolvida', 'cancelada'].includes(n.status) && String(n.criado_em || n.created_at || '').slice(0, 10) < lim).length; } },
  acoes_nc_no_prazo: { nome: 'Ações de NC em dia', area: 'qualidade', unidade: '%', sentido: 'maior', sug: [90, 75], tela: 'nao_conformidades',
    como: 'ações pendentes de plano de ação ainda dentro do prazo ÷ ações pendentes',
    calc: async (c) => { const as = (await q(c.sb.from('nao_conformidade_plano_acao').select('*').eq('tenant_id', c.tenantId))).filter((a) => a.status === 'pendente');
      return pct(as.filter((a) => !a.prazo || String(a.prazo).slice(0, 10) >= c.hoje).length, as.length); } },
  documentos_em_dia: { nome: 'Documentos em dia (pessoas e frota)', area: 'pessoas', unidade: '%', sentido: 'maior', sug: [98, 90], tela: 'documentos',
    como: 'documentos com vencimento ainda válidos ÷ documentos com vencimento (sem desligados)',
    calc: async (c) => { const D = require('./documentos'); const ds = (await D.listarDocumentos(c.sb, c.tenantId, { agora: c.agora })).filter((d) => !d.colaborador_desligado && d.dias != null); return pct(ds.filter((d) => d.dias >= 0).length, ds.length); } },
  documentos_vencidos: { nome: 'Documentos vencidos', area: 'pessoas', unidade: 'un', sentido: 'menor', sug: [0, 2], tela: 'documentos',
    como: 'documentos de pessoas, equipamentos e empresa vencidos agora',
    calc: async (c) => { const D = require('./documentos'); return (await D.listarDocumentos(c.sb, c.tenantId, { agora: c.agora })).filter((d) => !d.colaborador_desligado && d.dias != null && d.dias < 0).length; } },
  leitura_procedimentos: { nome: 'Leitura dos procedimentos', area: 'qualidade', unidade: '%', sentido: 'maior', sug: [90, 70], tela: 'documentos',
    como: 'leituras confirmadas ÷ leituras esperadas nos documentos de gestão vigentes com leitura obrigatória',
    calc: async (c) => { const DG = require('./documentosGestao'); const ds = (await DG.listar(c.sb, c.tenantId)).filter((d) => d.status === 'vigente' && d.leitura?.esperados);
      return pct(ds.reduce((s, d) => s + d.leitura.lidos, 0), ds.reduce((s, d) => s + d.leitura.esperados, 0)); } },
  tarefas_em_dia: { nome: 'Tarefas em dia', area: 'gestao', unidade: '%', sentido: 'maior', sug: [90, 75], tela: 'plano',
    como: 'tarefas abertas dentro do prazo ÷ tarefas abertas',
    calc: async (c) => { const ts = (await q(c.sb.from('tarefas').select('*').eq('tenant_id', c.tenantId))).filter((t) => ['pendente', 'em_andamento'].includes(t.status));
      return pct(ts.filter((t) => !t.prazo || String(t.prazo).slice(0, 10) >= c.hoje).length, ts.length); } },
  conversao_bids: { nome: 'Conversão de BIDs (12 meses)', area: 'comercial', unidade: '%', sentido: 'maior', sug: [30, 20], tela: 'comercial',
    como: 'BIDs aceitos ÷ BIDs decididos (aceitos + perdidos) nos últimos 12 meses',
    calc: async (c) => { const de = diasAtras(c.hoje, 365); const bs = (await q(c.sb.from('bids').select('*').eq('tenant_id', c.tenantId))).filter((b) => ['aceito', 'perdido'].includes(b.fase) && String(b.ganho_em || b.atualizado_em || '').slice(0, 10) >= de);
      return pct(bs.filter((b) => b.fase === 'aceito').length, bs.length); } },
  economia_compras_ano: { nome: 'Economia medida no ano', area: 'compras', unidade: 'R$', sentido: 'maior', sug: [null, null], tela: 'valor_gerado',
    como: 'total do 💰 Valor gerado no ano (compras + spot + multas)',
    calc: async (c) => (await require('./valorGerado').calcular(c.sb, c.tenantId)).total },
};

function sinal(m, v) {
  if (v == null || m.meta == null) return null;
  const meta = Number(m.meta); const lim = m.limite == null ? meta : Number(m.limite);
  if (m.sentido === 'menor') return v <= meta ? 'verde' : v <= lim ? 'amarelo' : 'vermelho';
  return v >= meta ? 'verde' : v >= lim ? 'amarelo' : 'vermelho';
}

const num = (v) => (v === '' || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : NaN);
const UNIDADES = ['%', 'un', 'R$', 'h', 'dias', 'km', 'L'];
const MANUAL = 'manual'; // 18 SC2.1: a empresa cria a própria meta e informa o valor
function validar(b, { parcial = false } = {}) {
  const erros = []; const out = {}; const tem = (k) => Object.prototype.hasOwnProperty.call(b || {}, k);
  if (!parcial || tem('chave')) { if (!MEDIDAS[b.chave] && b.chave !== MANUAL) erros.push('Escolha uma medida da lista ou "meta própria"'); else out.chave = b.chave; }
  if (tem('area')) { if (!AREAS[b.area]) erros.push('Área inválida'); else out.area = b.area; }
  if (tem('unidade')) { if (b.unidade && !UNIDADES.includes(b.unidade)) erros.push('Unidade inválida'); else out.unidade = b.unidade || null; }
  if (tem('responsavel_colaborador_id')) out.responsavel_colaborador_id = b.responsavel_colaborador_id || null;
  if (!parcial && !b.responsavel_usuario_id && !b.responsavel_colaborador_id) erros.push('Toda meta precisa de um dono — escolha o responsável na lista de funcionários');
  if (!parcial || tem('nome')) { const n = String(b.nome || MEDIDAS[b.chave]?.nome || '').trim(); if (!n) erros.push('Dê um nome à meta'); else out.nome = n.slice(0, 120); }
  for (const k of ['meta', 'limite']) if (tem(k)) { const v = num(b[k]); if (Number.isNaN(v)) erros.push(`${k === 'meta' ? 'Meta' : 'Limite'} inválido`); else out[k] = v; }
  if (tem('sentido')) { if (!['maior', 'menor'].includes(b.sentido)) erros.push('Sentido inválido'); else out.sentido = b.sentido; }
  if (tem('responsavel_usuario_id')) out.responsavel_usuario_id = b.responsavel_usuario_id || null;
  if (tem('responsavel_nome')) out.responsavel_nome = b.responsavel_nome ? String(b.responsavel_nome).slice(0, 120) : null;
  if (tem('observacao')) out.observacao = b.observacao ? String(b.observacao).slice(0, 500) : null;
  if (tem('ativo')) out.ativo = !!b.ativo;
  const sentido = out.sentido || b.sentido || MEDIDAS[b.chave]?.sentido;
  if (out.meta != null && out.limite != null && sentido && (sentido === 'maior' ? out.limite > out.meta : out.limite < out.meta)) erros.push(sentido === 'maior' ? 'O limite do amarelo precisa ser menor ou igual à meta' : 'O limite do amarelo precisa ser maior ou igual à meta');
  return { erros, dados: out };
}

const erro = (m, status) => Object.assign(new Error(m), { status });

/** lista as metas da empresa com valor atual, semáforo e tendência (e grava a fotografia do dia) */
async function listar(sb, tenantId, { agora = new Date(), fotografar = true } = {}) {
  const ms = (await q(sb.from('metas_negocio').select('*').eq('tenant_id', tenantId))).filter((m) => m.ativo !== false).sort((a, b) => (a.ordem - b.ordem) || String(a.nome).localeCompare(String(b.nome)));
  if (!ms.length) return [];
  const c = { sb, tenantId, agora, hoje: hojeBR(agora) };
  const valores = {}; await Promise.all([...new Set(ms.filter((m) => m.origem !== 'manual').map((m) => m.chave))].map(async (k) => { try { valores[k] = MEDIDAS[k] ? await MEDIDAS[k].calc(c) : null; } catch (e) { console.warn(`⚠️ [metas] ${k}:`, e.message); valores[k] = null; } }));
  let fotos = []; try { fotos = await q(sb.from('metas_fotografias').select('*').eq('tenant_id', tenantId)); } catch { /* sem 101 */ }
  let resultados = []; try { resultados = await q(sb.from('metas_resultados').select('*').eq('tenant_id', tenantId)); } catch { /* sem 103 */ }
  if (fotografar) { try { const novas = Object.entries(valores).filter(([k, v]) => v != null && !fotos.some((f) => f.chave === k && String(f.dia).slice(0, 10) === c.hoje)).map(([k, v]) => ({ tenant_id: tenantId, chave: k, dia: c.hoje, valor: v })); if (novas.length) await q(sb.from('metas_fotografias').insert(novas)); } catch { /* corrida entre abas: ignora */ } }
  const alvo = diasAtras(c.hoje, 30);
  return ms.map((m) => {
    const md = MEDIDAS[m.chave] || {}; const ult = m.origem === 'manual' ? fotos.filter((f) => f.chave === m.chave).sort((a, b) => String(b.dia).localeCompare(String(a.dia)))[0] : null;
    const v = m.origem === 'manual' ? (ult ? Number(ult.valor) : null) : (valores[m.chave] ?? null);
    const antes = fotos.filter((f) => f.chave === m.chave && String(f.dia).slice(0, 10) <= alvo).sort((a, b) => String(b.dia).localeCompare(String(a.dia)))[0];
    const dif = antes && v != null && antes.valor != null ? Math.round((v - Number(antes.valor)) * 10) / 10 : null;
    return { ...m, descricao: m.observacao || (md.como ? `${md.como[0].toUpperCase()}${md.como.slice(1)}.` : ''), unidade: m.unidade || md.unidade || '', area_nome: AREAS[m.area] || m.area, como: m.origem === 'manual' ? 'meta própria — valor informado pela empresa' : (md.como || ''), tela: md.tela || null, valor: v, sinal: sinal(m, v),
      informado: ult ? { dia: String(ult.dia).slice(0, 10), por: ult.informado_por || null } : null,
      serie: resultados.filter((r) => String(r.meta_id) === String(m.id)).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-6).map((r) => ({ mes: r.mes, valor: Number(r.valor), sinal: sinal(m, Number(r.valor)), origem: r.origem })), sem_dono: !m.responsavel_usuario_id && !m.responsavel_colaborador_id,
      tendencia: dif == null ? null : { dif, melhorou: dif === 0 ? null : (m.sentido === 'menor' ? dif < 0 : dif > 0), desde: String(antes.dia).slice(0, 10) } };
  });
}

function sugeridas(jaTem = []) {
  return Object.entries(MEDIDAS).map(([chave, m]) => ({ chave, nome: m.nome, area: m.area, area_nome: AREAS[m.area], unidade: m.unidade, sentido: m.sentido, meta: m.sug[0], limite: m.sug[1], como: m.como, ja: jaTem.includes(chave) }));
}

async function importar(sb, tenantId, chaves = []) {
  const atuais = await q(sb.from('metas_negocio').select('chave').eq('tenant_id', tenantId));
  const novas = [...new Set(chaves)].filter((k) => MEDIDAS[k] && !atuais.some((a) => a.chave === k))
    .map((k, i) => ({ tenant_id: tenantId, chave: k, nome: MEDIDAS[k].nome, area: MEDIDAS[k].area, sentido: MEDIDAS[k].sentido, unidade: MEDIDAS[k].unidade, origem: 'sistema', observacao: `${MEDIDAS[k].como[0].toUpperCase()}${MEDIDAS[k].como.slice(1)}.`, meta: MEDIDAS[k].sug[0], limite: MEDIDAS[k].sug[1], ordem: atuais.length + i }));
  if (novas.length) await q(sb.from('metas_negocio').insert(novas));
  return { importadas: novas.length };
}

async function criar(sb, tenantId, body) {
  const { erros, dados } = validar(body); if (erros.length) throw erro(erros[0], 400);
  await responsavelValido(sb, tenantId, dados);
  if (dados.chave === MANUAL) {
    if (!dados.area) throw erro('Escolha a área da meta', 400);
    dados.chave = `manual_${Date.now().toString(36)}`; dados.origem = 'manual'; dados.sentido = dados.sentido || 'maior';
    return (await q(sb.from('metas_negocio').insert([{ tenant_id: tenantId, ...dados }]).select()))[0];
  }
  if ((await q(sb.from('metas_negocio').select('id').eq('tenant_id', tenantId).eq('chave', dados.chave))).length) throw erro('Essa medida já está nas suas metas — edite a existente.', 409);
  const md = MEDIDAS[dados.chave];
  return (await q(sb.from('metas_negocio').insert([{ tenant_id: tenantId, area: md.area, sentido: md.sentido, unidade: md.unidade, origem: 'sistema', ...dados }]).select()))[0];
}
async function atualizar(sb, tenantId, id, body) {
  const { chave, ...resto } = body || {}; const atual = (await q(sb.from('metas_negocio').select('*').eq('id', id).eq('tenant_id', tenantId)))[0]; if (!atual) throw erro('Meta não encontrada', 404);
  const { erros, dados } = validar({ sentido: atual.sentido, ...resto }, { parcial: true }); if (erros.length) throw erro(erros[0], 400);
  if (atual.origem !== 'manual') { delete dados.area; delete dados.unidade; delete dados.sentido; }
  if ('responsavel_usuario_id' in dados || 'responsavel_colaborador_id' in dados) { if (!dados.responsavel_usuario_id && !dados.responsavel_colaborador_id) throw erro('Toda meta precisa de um dono — escolha o responsável na lista de funcionários', 400); await responsavelValido(sb, tenantId, dados); } if (erros.length) throw erro(erros[0], 400);
  delete dados.chave;
  const r = await q(sb.from('metas_negocio').update({ ...dados, atualizado_em: new Date().toISOString() }).eq('id', id).eq('tenant_id', tenantId).select());
  if (!r.length) throw erro('Meta não encontrada', 404); return r[0];
}
async function responsavelValido(sb, tenantId, dados) {
  if (dados.responsavel_colaborador_id) { const c = (await q(sb.from('colaboradores').select('*').eq('tenant_id', tenantId).eq('id', dados.responsavel_colaborador_id)))[0]; if (!c) throw erro('Responsável não encontrado no cadastro', 400); dados.responsavel_nome = c.nome; if (!dados.responsavel_usuario_id) dados.responsavel_usuario_id = c.usuario_id || null; }
  else if (dados.responsavel_usuario_id) { const u = (await q(sb.from('usuarios').select('*').eq('tenant_id', tenantId).eq('id', dados.responsavel_usuario_id)))[0]; if (!u) throw erro('Responsável não encontrado', 400); dados.responsavel_nome = u.nome || u.email; }
}

/** meta própria: a empresa informa o valor (uma fotografia por dia; a do dia é substituída) */
async function informarValor(sb, tenantId, id, { valor, eu = null, agora = new Date() }) {
  const m = (await q(sb.from('metas_negocio').select('*').eq('id', id).eq('tenant_id', tenantId)))[0]; if (!m) throw erro('Meta não encontrada', 404);
  if (m.origem !== 'manual') throw erro('Esta meta é calculada pelo sistema — o valor não se informa à mão.', 409);
  const v = num(valor); if (v == null || Number.isNaN(v)) throw erro('Informe um número', 400);
  const dia = hojeBR(agora);
  await q(sb.from('metas_fotografias').delete().eq('tenant_id', tenantId).eq('chave', m.chave).eq('dia', dia));
  await q(sb.from('metas_fotografias').insert([{ tenant_id: tenantId, chave: m.chave, dia, valor: v, informado_por: eu || null }]));
  return { ok: true };
}

async function excluir(sb, tenantId, id) {
  const r = await q(sb.from('metas_negocio').delete().eq('id', id).eq('tenant_id', tenantId).select());
  if (!r.length) throw erro('Meta não encontrada', 404); return { ok: true };
}

// ── SC2.4: RESULTADO MENSAL ─────────────────────────────────────────────────────────────────────────
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ymDe = (dia) => String(dia).slice(0, 7);
const mesAnterior = (ym) => { const [a, m] = ym.split('-').map(Number); return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`; };
const nomeMes = (ym) => `${MESES[Number(ym.slice(5)) - 1]}/${ym.slice(2, 4)}`;
const seguroQ = async (p) => { try { return await q(p); } catch { return []; } };

/** fecha o mês (padrão: o anterior) — metas do sistema: última fotografia do mês (ou o valor de agora, se o mês acabou de virar);
 *  metas próprias: o último valor informado no mês. Não mexe em mês já fechado (idempotente). */
async function fecharMes(sb, tenantId, { ym = null, agora = new Date() } = {}) {
  const mes = ym || mesAnterior(ymDe(hojeBR(agora)));
  const ms = (await q(sb.from('metas_negocio').select('*').eq('tenant_id', tenantId))).filter((m) => m.ativo !== false);
  if (!ms.length) return { mes, fechadas: 0 };
  const ja = await q(sb.from('metas_resultados').select('meta_id').eq('tenant_id', tenantId).eq('mes', mes));
  const fotos = await seguroQ(sb.from('metas_fotografias').select('*').eq('tenant_id', tenantId));
  const c = { sb, tenantId, agora, hoje: hojeBR(agora) };
  const novos = [];
  for (const m of ms.filter((x) => !ja.some((j) => String(j.meta_id) === String(x.id)))) {
    const f = fotos.filter((x) => x.chave === m.chave && ymDe(x.dia) === mes).sort((a, b) => String(b.dia).localeCompare(String(a.dia)))[0];
    let v = f ? Number(f.valor) : null;
    if (v == null && m.origem !== 'manual' && MEDIDAS[m.chave] && mes === mesAnterior(ymDe(c.hoje))) { try { v = await MEDIDAS[m.chave].calc(c); } catch { v = null; } }
    if (v == null) continue; // meta própria sem valor no mês: fica pendente (aviso ao dono)
    novos.push({ tenant_id: tenantId, meta_id: m.id, mes, valor: v, origem: m.origem === 'manual' ? 'informado' : 'calculado', por_nome: m.origem === 'manual' ? (f?.informado_por || null) : null });
  }
  if (novos.length) await q(sb.from('metas_resultados').insert(novos));
  return { mes, fechadas: novos.length };
}

/** informa ou corrige o resultado de um mês. Já existe e muda o valor → motivo obrigatório, guarda o original e quem alterou. */
async function gravarResultado(sb, tenantId, metaId, mes, { valor, motivo = '', eu = {} } = {}) {
  if (!/^\d{4}-\d{2}$/.test(String(mes))) throw erro('Mês inválido', 400);
  const m = (await q(sb.from('metas_negocio').select('*').eq('id', metaId).eq('tenant_id', tenantId)))[0]; if (!m) throw erro('Meta não encontrada', 404);
  const v = num(valor); if (v == null || Number.isNaN(v)) throw erro('Informe um número', 400);
  if (mes > ymDe(hojeBR())) throw erro('Não dá para lançar mês que ainda não chegou.', 400);
  const atual = (await q(sb.from('metas_resultados').select('*').eq('meta_id', metaId).eq('mes', mes)))[0];
  const mot = String(motivo || '').trim();
  if (atual) {
    if (Number(atual.valor) === v) return atual;
    if (mot.length < 5) throw erro('Diga o motivo da correção (ex.: "controle paralelo da oficina mostrou 2 paradas não registradas").', 400);
    return (await q(sb.from('metas_resultados').update({ valor: v, origem: 'ajustado', valor_original: atual.valor_original ?? atual.valor, origem_original: atual.origem_original || atual.origem, por_nome: eu.nome || null, por_id: eu.id || null, motivo: mot.slice(0, 500), em: new Date().toISOString() }).eq('id', atual.id).select()))[0];
  }
  const sistema = m.origem !== 'manual';
  if (sistema && mot.length < 5) throw erro('Este mês é calculado pelo sistema — para lançar à mão, diga o motivo.', 400);
  return (await q(sb.from('metas_resultados').insert([{ tenant_id: tenantId, meta_id: m.id, mes, valor: v, origem: sistema ? 'ajustado' : 'informado', por_nome: eu.nome || null, por_id: eu.id || null, motivo: mot ? mot.slice(0, 500) : null }]).select()))[0];
}

/** histórico de uma meta: últimos 12 meses fechados + o parcial do mês atual */
async function historico(sb, tenantId, metaId, { agora = new Date() } = {}) {
  const m = (await listar(sb, tenantId, { agora, fotografar: false })).find((x) => String(x.id) === String(metaId)); if (!m) throw erro('Meta não encontrada', 404);
  const rs = await q(sb.from('metas_resultados').select('*').eq('meta_id', metaId));
  const atual = ymDe(hojeBR(agora)); const meses = []; let ym = atual;
  for (let i = 0; i < 13; i++) { meses.unshift(ym); ym = mesAnterior(ym); }
  return { meta: m, meses: meses.map((k) => { const r = rs.find((x) => x.mes === k); const parcial = k === atual;
    const valor = r ? Number(r.valor) : parcial ? m.valor : null;
    return { mes: k, nome: nomeMes(k), valor, sinal: sinal(m, valor), parcial: parcial && !r, origem: r?.origem || (parcial && valor != null ? 'parcial' : null), valor_original: r?.valor_original ?? null, origem_original: r?.origem_original || null, por: r?.por_nome || null, motivo: r?.motivo || null, em: r?.em || null }; }) };
}

/** painel anual: todas as metas × meses do ano (para a análise crítica pela direção) */
async function painelAnual(sb, tenantId, { ano = null, agora = new Date() } = {}) {
  const A = String(ano || hojeBR(agora).slice(0, 4)); const atual = ymDe(hojeBR(agora));
  const ms = await listar(sb, tenantId, { agora, fotografar: false });
  const rs = (await seguroQ(sb.from('metas_resultados').select('*').eq('tenant_id', tenantId))).filter((r) => r.mes.startsWith(A));
  const meses = Array.from({ length: 12 }, (_, i) => `${A}-${String(i + 1).padStart(2, '0')}`);
  return { ano: A, meses: meses.map((k) => ({ mes: k, nome: nomeMes(k) })), metas: ms.map((m) => ({ id: m.id, nome: m.nome, area_nome: m.area_nome, unidade: m.unidade, sentido: m.sentido, meta: m.meta, limite: m.limite, responsavel_nome: m.responsavel_nome,
    celulas: meses.map((k) => { const r = rs.find((x) => String(x.meta_id) === String(m.id) && x.mes === k); const v = r ? Number(r.valor) : k === atual ? m.valor : null; return { mes: k, valor: v, sinal: sinal(m, v), origem: r?.origem || (k === atual && v != null ? 'parcial' : null), motivo: r?.motivo || null, por: r?.por_nome || null }; }) })) };
}

/** pendências de metas próprias do mês anterior (para a Sala de Controle e o aviso do sininho) */
async function pendentesInformar(sb, tenantId, { agora = new Date(), usuarioId = null } = {}) {
  const mes = mesAnterior(ymDe(hojeBR(agora)));
  const ms = (await seguroQ(sb.from('metas_negocio').select('*').eq('tenant_id', tenantId))).filter((m) => m.ativo !== false && m.origem === 'manual' && (!usuarioId || String(m.responsavel_usuario_id) === String(usuarioId)));
  if (!ms.length) return [];
  const rs = await seguroQ(sb.from('metas_resultados').select('meta_id').eq('tenant_id', tenantId).eq('mes', mes));
  return ms.filter((m) => !rs.some((r) => String(r.meta_id) === String(m.id))).map((m) => ({ id: m.id, nome: m.nome, mes, mes_nome: nomeMes(mes), responsavel_usuario_id: m.responsavel_usuario_id }));
}

/** cron diário (7h): fecha o mês anterior; no dia 1 e no dia 5 avisa o dono das metas próprias sem valor (sininho) */
async function rotinaDiaria(sb, { agora = new Date() } = {}) {
  const dia = Number(hojeBR(agora).slice(8, 10)); let tenants = []; const out = { fechadas: 0, avisos: 0 };
  try { tenants = [...new Set((await q(sb.from('metas_negocio').select('tenant_id'))).map((x) => String(x.tenant_id)))]; } catch { return out; }
  for (const t of tenants) {
    try { out.fechadas += (await fecharMes(sb, t, { agora })).fechadas; } catch (e) { console.warn('⚠️ [metas] fechar mês', t, e.message); }
    if (dia !== 1 && dia !== 5) continue;
    for (const p of await pendentesInformar(sb, t, { agora })) {
      if (!p.responsavel_usuario_id) continue;
      await require('./notificacoes').criar(sb, { tipo: 'usuario', id: String(p.responsavel_usuario_id) }, { tenantId: t, tipo: 'meta_informar', titulo: `🎯 Informe o resultado de ${p.mes_nome}: ${p.nome}`, texto: dia === 5 ? 'Lembrete — o mês ainda está sem valor.' : 'Você é o dono desta meta.', link: { tela: 'metas', id: p.id }, chave: `meta_informar_${p.id}_${p.mes}` }).catch(() => null);
      out.avisos++;
    }
  }
  return out;
}

module.exports = { fecharMes, gravarResultado, historico, painelAnual, pendentesInformar, rotinaDiaria, informarValor, UNIDADES, MEDIDAS, AREAS, sinal, validar, listar, sugeridas, importar, criar, atualizar, excluir };
