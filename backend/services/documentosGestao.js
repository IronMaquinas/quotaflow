// backend/services/documentosGestao.js — etapa 18zr: 📘 DOCUMENTOS DE GESTÃO (sistema da qualidade — ISO 9001 7.5)
//   Manual, política, procedimento, instrução, formulário, registro: CÓDIGO + REVISÃO + situação (rascunho · vigente · obsoleto),
//   elaborado/aprovado, próxima análise crítica, conteúdo em texto e/ou arquivo. (Fluxo de revisão/aprovação/leitura: 18zs.)
const D = require('./documentos');

const TIPOS = { manual: 'Manual', politica: 'Política', procedimento: 'Procedimento', instrucao: 'Instrução de trabalho', formulario: 'Formulário', registro: 'Registro', outro: 'Outro' };
const STATUS = { rascunho: 'Rascunho', vigente: 'Vigente', obsoleto: 'Obsoleto' };
const DATA = /^\d{4}-\d{2}-\d{2}$/;
async function q(p) { const { data, error } = await p; if (error) throw Object.assign(new Error(error.message), { db: true }); return data || []; }
const txt = (v, n) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, n));

function validar(body, parcial = false) {
  const erros = []; const out = {}; const tem = (k) => !parcial || Object.prototype.hasOwnProperty.call(body, k);
  if (tem('codigo')) { const c = txt(body.codigo, 30); if (!c) erros.push('Informe o código (ex.: PQ-01)'); else out.codigo = c.toUpperCase(); }
  if (tem('titulo')) { const t = txt(body.titulo, 200); if (!t) erros.push('Informe o título'); else out.titulo = t; }
  if (tem('tipo')) { if (!TIPOS[body.tipo]) erros.push('Tipo inválido'); else out.tipo = body.tipo; }
  if (tem('status')) { if (!STATUS[body.status]) erros.push('Situação inválida'); else out.status = body.status; }
  if (tem('revisao')) { const r = Number(body.revisao); if (!Number.isInteger(r) || r < 0 || r > 999) erros.push('Revisão inválida'); else out.revisao = r; }
  for (const k of ['aprovado_em', 'proxima_revisao']) if (tem(k)) { if (body[k] && !DATA.test(String(body[k]))) erros.push('Data inválida'); else out[k] = body[k] || null; }
  for (const [k, n] of [['area', 80], ['elaborado_por', 120], ['aprovado_por', 120], ['norma', 120]]) if (tem(k)) out[k] = txt(body[k], n);
  if (tem('conteudo')) out.conteudo = body.conteudo ? String(body.conteudo).slice(0, 200000) : null;
  return { erros, dados: out };
}

async function listar(supabase, tenantId) {
  const l = await q(supabase.from('documentos_gestao').select('*').eq('tenant_id', tenantId));
  const hoje = new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
  return l.map(({ conteudo, ...d }) => ({ ...d, tem_conteudo: !!conteudo, tem_arquivo: !!d.arquivo_path, revisar: d.status === 'vigente' && d.proxima_revisao && d.proxima_revisao <= hoje }))
    .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true }));
}
async function obter(supabase, tenantId, id) { return (await q(supabase.from('documentos_gestao').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] || null; }

async function codigoLivre(supabase, tenantId, codigo, menosId = null) {
  const l = await q(supabase.from('documentos_gestao').select('*').eq('tenant_id', tenantId));
  return !l.some((d) => String(d.codigo).toLowerCase() === String(codigo).toLowerCase() && String(d.id) !== String(menosId));
}

async function gravarArquivo(supabase, tenantId, id, b) {
  if (!b?.arquivo_base64) return null;
  const msg = D.validarArquivo({ base64: b.arquivo_base64, mime: b.arquivo_mime, nome: b.arquivo_nome }); if (msg) throw Object.assign(new Error(msg), { status: 400 });
  const path = await D.subirArquivo(supabase, { tenantId, documentoId: `g${id}`, base64: b.arquivo_base64, mime: b.arquivo_mime });
  return { arquivo_path: path, arquivo_nome: String(b.arquivo_nome || 'arquivo').slice(0, 200), arquivo_mime: b.arquivo_mime };
}

async function criar(supabase, tenantId, body) {
  const { erros, dados } = validar(body || {}); if (erros.length) throw Object.assign(new Error(erros[0]), { status: 400 });
  if (!(await codigoLivre(supabase, tenantId, dados.codigo))) throw Object.assign(new Error(`Já existe um documento com o código ${dados.codigo}`), { status: 409 });
  const [d] = await q(supabase.from('documentos_gestao').insert([{ ...dados, tenant_id: tenantId, modelo_origem: txt(body.modelo_origem, 60) }]).select());
  const arq = await gravarArquivo(supabase, tenantId, d.id, body);
  if (arq) await q(supabase.from('documentos_gestao').update(arq).eq('id', d.id).eq('tenant_id', tenantId));
  return { ...d, ...(arq || {}) };
}

async function atualizar(supabase, tenantId, id, body) {
  const atual = await obter(supabase, tenantId, id); if (!atual) throw Object.assign(new Error('Documento não encontrado'), { status: 404 });
  const { erros, dados } = validar(body || {}, true); if (erros.length) throw Object.assign(new Error(erros[0]), { status: 400 });
  if (dados.codigo && !(await codigoLivre(supabase, tenantId, dados.codigo, id))) throw Object.assign(new Error(`Já existe um documento com o código ${dados.codigo}`), { status: 409 });
  const arq = await gravarArquivo(supabase, tenantId, id, body);
  const tirar = body?.remover_arquivo && atual.arquivo_path && !arq;
  await q(supabase.from('documentos_gestao').update({ ...dados, ...(arq || {}), ...(tirar ? { arquivo_path: null, arquivo_nome: null, arquivo_mime: null } : {}), atualizado_em: new Date().toISOString() }).eq('id', id).eq('tenant_id', tenantId));
  if ((arq || tirar) && atual.arquivo_path) await D.removerArquivo(supabase, atual.arquivo_path).catch(() => {});
  return obter(supabase, tenantId, id);
}

async function excluir(supabase, tenantId, id) {
  const atual = await obter(supabase, tenantId, id); if (!atual) throw Object.assign(new Error('Documento não encontrado'), { status: 404 });
  if (atual.status === 'vigente') throw Object.assign(new Error('Documento vigente não se exclui — marque como Obsoleto (a ISO pede o histórico).'), { status: 409 });
  await q(supabase.from('documentos_gestao').delete().eq('id', id).eq('tenant_id', tenantId));
  if (atual.arquivo_path) await D.removerArquivo(supabase, atual.arquivo_path).catch(() => {});
  return { ok: true };
}

module.exports = { TIPOS, STATUS, validar, listar, obter, criar, atualizar, excluir };
