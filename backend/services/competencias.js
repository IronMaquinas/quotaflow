// backend/services/competencias.js — etapa 12e.3
//
// Competências do colaborador × exigidas pela função → pilar 🧩 do selo. Três tipos de item:
//   • escolaridade — a do colaborador tem de ser ≥ a mínima da função (mesma lista de funcoes.ESCOLARIDADES)
//   • cnh          — a categoria do colaborador tem de cobrir a mínima da função (E cobre D, C, B; "A" é à parte)
//                    (a VALIDADE da CNH é documento — pilar 📄)
//   • competencia  — lista da função (texto livre + sugestões); o gestor avalia "atende / não atende" com data,
//                    observação e evidência opcional; reavaliar_meses opcional (vencida = reavaliar)
// Regra do selo (decidida com o Marcony, 21/10): não informado, não avaliado, não atende ou reavaliação vencida =
//   item PENDENTE (🟡) — nunca 🔴 sozinho. Ok = conta como em dia.
// 12e.3.1: avaliação com NOTA de 1 a 4 (1 não atende · 2 em desenvolvimento · 3 atende · 4 referência); cada competência
//   da função tem um NÍVEL ESPERADO (padrão 3) — "atende" = nota ≥ esperado. Competência pode ligar TREINAMENTOS que a
//   sustentam: na Ficha aparece "🎓 em dia · falta avaliação prática" ou "⚠ sem o treinamento"; na avaliação, os em dia
//   viram evidência (cópia). O treinamento NUNCA marca "atende" sozinho — competência é prática, quem decide é o gestor.
// Regras do backend: sem DB.raw; ids com String(); filtros sem null.

const crypto = require('crypto');
const D = require('./documentos');
const TR = require('./treinamentos');
const NIVEIS = [
  { nivel: 1, nome: 'Não atende', desc: 'não faz, ou faz com risco' },
  { nivel: 2, nome: 'Em desenvolvimento', desc: 'faz com supervisão' },
  { nivel: 3, nome: 'Atende', desc: 'faz sozinho, no padrão' },
  { nivel: 4, nome: 'Referência', desc: 'faz muito bem e pode ensinar' },
];
const nivelDe = (a) => (a.nivel != null ? Number(a.nivel) : a.atende ? 3 : 1);

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const texto = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const hojeBR = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600000).toISOString().slice(0, 10);
const slug = (n) => String(n || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50);
function somaMeses(iso, meses) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const alvo = new Date(Date.UTC(y, m - 1 + Number(meses), 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

const CNH_CATEGORIAS = ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'];
const NIVEL_CNH = { B: 1, C: 2, D: 3, E: 4 };
function partesCNH(cat) {
  const c = String(cat || '').toUpperCase();
  const nivel = Math.max(0, ...[...c].map((l) => NIVEL_CNH[l] || 0));
  return { moto: c.includes('A'), nivel };
}
/** A categoria do colaborador cobre a exigida? (E cobre D, C, B; "A" só se tiver A) */
function cobreCNH(doColab, exigida) {
  if (!exigida) return true;
  if (!doColab) return false;
  const c = partesCNH(doColab), e = partesCNH(exigida);
  return (!e.moto || c.moto) && c.nivel >= e.nivel;
}

const SUGESTOES = [
  'Inspeção pré-viagem do veículo (checklist)', 'Amarração e acondicionamento de carga', 'Direção econômica / defensiva na prática',
  'Dirige veículo articulado (carreta)', 'Dirige bitrem / rodotrem', 'Opera tacógrafo e rastreador', 'Leitura de NF-e, CT-e e MDF-e',
  'Atendimento ao cliente na entrega', 'Conhece as rotas e regiões atendidas', 'Kit e ficha de emergência (produtos perigosos)',
  'Opera empilhadeira', 'Opera munck / guindauto', 'Primeiros socorros', 'Manutenção preventiva básica do veículo',
  'Diagnóstico mecânico / elétrico', 'Solda', 'Controle de estoque e inventário', 'Uso do sistema (QuotaFlow / TMS)', 'Liderança de equipe',
];

/** Lista da função: [{ codigo, nome, reavaliar_meses }] */
function validarLista(lista) {
  if (lista == null) return { competencias: [] };
  if (!Array.isArray(lista)) return { erro: 'Competências inválidas' };
  const out = [], vistos = new Set();
  for (const x of lista.slice(0, 40)) {
    const nome = texto(typeof x === 'string' ? x : x?.nome, 160);
    if (!nome) continue;
    const codigo = texto(x?.codigo, 50) && /^[a-z0-9_]{1,50}$/.test(x.codigo) ? x.codigo : slug(nome);
    if (!codigo || vistos.has(codigo)) continue;
    vistos.add(codigo);
    const r = x?.reavaliar_meses === '' || x?.reavaliar_meses == null ? null : parseInt(x.reavaliar_meses, 10);
    if (r !== null && !(r >= 1 && r <= 120)) return { erro: `“${nome}”: reavaliação entre 1 e 120 meses` };
    const ne = x?.nivel_esperado === '' || x?.nivel_esperado == null ? 3 : parseInt(x.nivel_esperado, 10);
    if (!(ne >= 1 && ne <= 4)) return { erro: `“${nome}”: nível esperado de 1 a 4` };
    const trs = [...new Set((Array.isArray(x?.treinamentos) ? x.treinamentos : []).map((t) => String(typeof t === 'string' ? t : t?.codigo || '')).filter((c) => /^[a-z0-9_]{1,60}$/.test(c)))].slice(0, 10);
    out.push({ codigo, nome, reavaliar_meses: r, nivel_esperado: ne, treinamentos: trs });
  }
  return { competencias: out };
}
function validarCNH(v) {
  const c = texto(v, 3);
  if (!c) return { cnh: null };
  const u = c.toUpperCase();
  return CNH_CATEGORIAS.includes(u) ? { cnh: u } : { erro: 'Categoria de CNH inválida' };
}

async function carregarBase(supabase, tenantId) {
  const [colabs, funcoes, avals] = await Promise.all([
    q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId)),
    q(supabase.from('funcoes').select('*').eq('tenant_id', tenantId)),
    q(supabase.from('colaborador_competencias').select('*').eq('tenant_id', tenantId)),
  ]);
  let tr = { treinos: [], turmas: [], parts: [] }; // treinamentos ligados às competências (antes da 030 fica vazio)
  try { const b = await TR.carregarBase(supabase, tenantId); tr = { treinos: b.treinos, turmas: b.turmas, parts: b.parts }; }
  catch (e) { if (!/treinamento/.test(String(e.message))) throw e; }
  return { colabs, funcoes, avals, tr };
}

/** Situação dos treinamentos ligados a uma competência, para o colaborador: ok · vencido · falta */
function treinosDaCompetencia(colab, codigos, base, hoje) {
  const tr = base.tr || { treinos: [], turmas: [], parts: [] };
  const turmaPor = new Map(tr.turmas.map((t) => [String(t.id), t]));
  return (codigos || []).map((codigo) => {
    const t = tr.treinos.find((x) => x.codigo === codigo && x.ativo !== false) || tr.treinos.find((x) => x.codigo === codigo);
    if (!t) return { codigo, nome: codigo, situacao: 'falta', existe: false };
    const feitos = tr.parts.filter((p) => String(p.colaborador_id) === String(colab.id))
      .map((p) => ({ p, tu: turmaPor.get(String(p.turma_id)) }))
      .filter(({ p, tu }) => tu && String(tu.treinamento_id) === String(t.id) && TR.contaFeito(p, tu))
      .sort((a, b) => TR.dataFeito(b.p, b.tu).localeCompare(TR.dataFeito(a.p, a.tu)));
    const u = feitos[0];
    if (!u) return { codigo, nome: t.nome, situacao: 'falta', existe: true };
    const va = u.p.valido_ate || (u.tu.validade_meses ? TR.validoAte(u.tu) : null);
    return { codigo, nome: t.nome, existe: true, situacao: va && String(va).slice(0, 10) < hoje ? 'vencido' : 'ok', turma_id: u.tu.id, concluido_em: TR.dataFeito(u.p, u.tu), valido_ate: va };
  });
}

/** Situação de cada competência exigida pela função para o colaborador */
function statusColaborador(colab, base, ESCOLARIDADES, hoje = hojeBR()) {
  const funcao = colab.funcao_id != null ? base.funcoes.find((f) => String(f.id) === String(colab.funcao_id)) : null;
  const itens = [];
  if (funcao?.escolaridade) {
    const ordem = ESCOLARIDADES.map((e) => e.codigo);
    const exig = ordem.indexOf(funcao.escolaridade), tem = colab.escolaridade ? ordem.indexOf(colab.escolaridade) : -1;
    itens.push({ tipo: 'escolaridade', codigo: 'escolaridade', nome: 'Escolaridade',
      exigido: ESCOLARIDADES[exig]?.nome || funcao.escolaridade, atual: tem >= 0 ? ESCOLARIDADES[tem].nome : null,
      situacao: tem < 0 ? 'pendente' : tem >= exig ? 'ok' : 'nao_atende' });
  }
  if (funcao?.cnh_categoria) {
    itens.push({ tipo: 'cnh', codigo: 'cnh', nome: 'Categoria da CNH', exigido: funcao.cnh_categoria, atual: colab.cnh_categoria || null,
      situacao: !colab.cnh_categoria ? 'pendente' : cobreCNH(colab.cnh_categoria, funcao.cnh_categoria) ? 'ok' : 'nao_atende' });
  }
  const minhas = base.avals.filter((a) => String(a.colaborador_id) === String(colab.id));
  for (const c of (Array.isArray(funcao?.competencias) ? funcao.competencias : [])) {
    const ult = minhas.filter((a) => a.codigo === c.codigo).sort((a, b) => String(b.avaliado_em).localeCompare(String(a.avaliado_em)) || Number(b.id) - Number(a.id))[0];
    const esperado = Number(c.nivel_esperado || 3);
    let situacao = 'pendente';
    if (ult) situacao = nivelDe(ult) < esperado ? 'nao_atende' : ult.valido_ate && String(ult.valido_ate).slice(0, 10) < hoje ? 'reavaliar' : 'ok';
    itens.push({ tipo: 'competencia', codigo: c.codigo, nome: c.nome, reavaliar_meses: c.reavaliar_meses || null, nivel_esperado: esperado, situacao,
      treinamentos: treinosDaCompetencia(colab, c.treinamentos, base, hoje),
      ultima: ult ? { id: ult.id, atende: nivelDe(ult) >= esperado, nivel: nivelDe(ult), avaliado_em: ult.avaliado_em, valido_ate: ult.valido_ate, avaliado_por_nome: ult.avaliado_por_nome, obs: ult.obs, tem_evidencia: !!ult.evidencia_path, evidencia_treinamentos: ult.evidencia_treinamentos || [] } : null,
      avaliacoes: minhas.filter((a) => a.codigo === c.codigo).length });
  }
  const resumo = { total: itens.length, ok: 0, pendente: 0, nao_atende: 0, reavaliar: 0 };
  for (const i of itens) resumo[i.situacao]++;
  return { funcao: funcao ? { id: funcao.id, nome: funcao.nome } : null, itens, resumo };
}

/** Registra uma avaliação "atende / não atende" (histórico — não apaga a anterior) */
async function avaliar(supabase, tenantId, { usuarioId, usuarioNome }, colab, body, agora = new Date()) {
  const funcao = colab.funcao_id != null ? (await q(supabase.from('funcoes').select('*').eq('tenant_id', tenantId).eq('id', colab.funcao_id)))[0] : null;
  const c = (Array.isArray(funcao?.competencias) ? funcao.competencias : []).find((x) => x.codigo === body?.codigo);
  if (!c) return { status: 400, erro: 'Competência não exigida pela função do colaborador' };
  const nivel = body.nivel != null && body.nivel !== '' ? parseInt(body.nivel, 10) : typeof body.atende === 'boolean' ? (body.atende ? 3 : 1) : NaN;
  if (!(nivel >= 1 && nivel <= 4)) return { status: 400, erro: 'Escolha a nota de 1 a 4' };
  const esperado = Number(c.nivel_esperado || 3);
  const atende = nivel >= esperado;
  const em = DATA.test(String(body.avaliado_em || '')) ? body.avaliado_em : hojeBR(agora);
  if (em > hojeBR(agora)) return { status: 400, erro: 'A data da avaliação não pode ser futura' };
  let path = null;
  if (body.evidencia_base64) {
    const msg = D.validarArquivo({ base64: body.evidencia_base64, mime: body.evidencia_mime }); if (msg) return { status: 400, erro: msg };
    path = `tenant-${tenantId}/comp-${colab.id}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${D.MIME_OK[body.evidencia_mime]}`;
    const { error } = await supabase.storage.from(D.BUCKET).upload(path, Buffer.from(String(body.evidencia_base64), 'base64'), { contentType: body.evidencia_mime, upsert: false });
    if (error) throw new Error(`Falha ao subir a evidência: ${error.message}`);
  }
  // treinamentos ligados e em dia na hora → evidência (cópia)
  let evid = [];
  if ((c.treinamentos || []).length) {
    const base = await carregarBase(supabase, tenantId);
    evid = treinosDaCompetencia(colab, c.treinamentos, base, em).filter((t) => t.situacao === 'ok').map((t) => ({ codigo: t.codigo, nome: t.nome, turma_id: t.turma_id, concluido_em: t.concluido_em, valido_ate: t.valido_ate }));
  }
  const { data, error } = await supabase.from('colaborador_competencias').insert([{
    tenant_id: tenantId, colaborador_id: colab.id, codigo: c.codigo, nome: c.nome, atende, nivel, nivel_esperado: esperado, evidencia_treinamentos: evid, avaliado_em: em,
    valido_ate: atende && c.reavaliar_meses ? somaMeses(em, c.reavaliar_meses) : null,
    avaliado_por: usuarioId || null, avaliado_por_nome: usuarioNome || null,
    evidencia_path: path, evidencia_nome: path ? texto(body.evidencia_nome, 200) || 'evidencia' : null, evidencia_mime: path ? body.evidencia_mime : null,
    obs: texto(body.obs, 1000),
  }]).select();
  if (error) { if (path) await D.removerArquivo(supabase, path); throw new Error(error.message); }
  return { avaliacao: data[0] };
}

async function historico(supabase, tenantId, colaboradorId) {
  return (await q(supabase.from('colaborador_competencias').select('*').eq('tenant_id', tenantId).eq('colaborador_id', colaboradorId)))
    .map((a) => ({ ...a, nivel: nivelDe(a), evidencia_path: undefined, tem_evidencia: !!a.evidencia_path }))
    .sort((a, b) => String(b.avaliado_em).localeCompare(String(a.avaliado_em)) || Number(b.id) - Number(a.id));
}

async function linkEvidencia(supabase, tenantId, avaliacaoId) {
  if (!/^\d+$/.test(String(avaliacaoId))) return { status: 404, erro: 'Avaliação não encontrada' };
  const a = (await q(supabase.from('colaborador_competencias').select('*').eq('tenant_id', tenantId).eq('id', avaliacaoId)))[0];
  if (!a?.evidencia_path) return { status: 404, erro: 'Sem evidência' };
  return { url: await D.linkArquivo(supabase, a.evidencia_path), nome: a.evidencia_nome };
}

module.exports = { NIVEIS, nivelDe, treinosDaCompetencia, CNH_CATEGORIAS, SUGESTOES, cobreCNH, validarLista, validarCNH, carregarBase, statusColaborador, avaliar, historico, linkEvidencia, somaMeses };
