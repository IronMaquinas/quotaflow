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
// Regras do backend: sem DB.raw; ids com String(); filtros sem null.

const crypto = require('crypto');
const D = require('./documentos');

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
    out.push({ codigo, nome, reavaliar_meses: r });
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
  return { colabs, funcoes, avals };
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
    let situacao = 'pendente';
    if (ult) situacao = !ult.atende ? 'nao_atende' : ult.valido_ate && String(ult.valido_ate).slice(0, 10) < hoje ? 'reavaliar' : 'ok';
    itens.push({ tipo: 'competencia', codigo: c.codigo, nome: c.nome, reavaliar_meses: c.reavaliar_meses || null, situacao,
      ultima: ult ? { id: ult.id, atende: ult.atende, avaliado_em: ult.avaliado_em, valido_ate: ult.valido_ate, avaliado_por_nome: ult.avaliado_por_nome, obs: ult.obs, tem_evidencia: !!ult.evidencia_path } : null,
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
  if (typeof body.atende !== 'boolean') return { status: 400, erro: 'Marque atende ou não atende' };
  const em = DATA.test(String(body.avaliado_em || '')) ? body.avaliado_em : hojeBR(agora);
  if (em > hojeBR(agora)) return { status: 400, erro: 'A data da avaliação não pode ser futura' };
  let path = null;
  if (body.evidencia_base64) {
    const msg = D.validarArquivo({ base64: body.evidencia_base64, mime: body.evidencia_mime }); if (msg) return { status: 400, erro: msg };
    path = `tenant-${tenantId}/comp-${colab.id}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${D.MIME_OK[body.evidencia_mime]}`;
    const { error } = await supabase.storage.from(D.BUCKET).upload(path, Buffer.from(String(body.evidencia_base64), 'base64'), { contentType: body.evidencia_mime, upsert: false });
    if (error) throw new Error(`Falha ao subir a evidência: ${error.message}`);
  }
  const { data, error } = await supabase.from('colaborador_competencias').insert([{
    tenant_id: tenantId, colaborador_id: colab.id, codigo: c.codigo, nome: c.nome, atende: body.atende, avaliado_em: em,
    valido_ate: body.atende && c.reavaliar_meses ? somaMeses(em, c.reavaliar_meses) : null,
    avaliado_por: usuarioId || null, avaliado_por_nome: usuarioNome || null,
    evidencia_path: path, evidencia_nome: path ? texto(body.evidencia_nome, 200) || 'evidencia' : null, evidencia_mime: path ? body.evidencia_mime : null,
    obs: texto(body.obs, 1000),
  }]).select();
  if (error) { if (path) await D.removerArquivo(supabase, path); throw new Error(error.message); }
  return { avaliacao: data[0] };
}

async function historico(supabase, tenantId, colaboradorId) {
  return (await q(supabase.from('colaborador_competencias').select('*').eq('tenant_id', tenantId).eq('colaborador_id', colaboradorId)))
    .map((a) => ({ ...a, evidencia_path: undefined, tem_evidencia: !!a.evidencia_path }))
    .sort((a, b) => String(b.avaliado_em).localeCompare(String(a.avaliado_em)) || Number(b.id) - Number(a.id));
}

async function linkEvidencia(supabase, tenantId, avaliacaoId) {
  if (!/^\d+$/.test(String(avaliacaoId))) return { status: 404, erro: 'Avaliação não encontrada' };
  const a = (await q(supabase.from('colaborador_competencias').select('*').eq('tenant_id', tenantId).eq('id', avaliacaoId)))[0];
  if (!a?.evidencia_path) return { status: 404, erro: 'Sem evidência' };
  return { url: await D.linkArquivo(supabase, a.evidencia_path), nome: a.evidencia_nome };
}

module.exports = { CNH_CATEGORIAS, SUGESTOES, cobreCNH, validarLista, validarCNH, carregarBase, statusColaborador, avaliar, historico, linkEvidencia, somaMeses };
