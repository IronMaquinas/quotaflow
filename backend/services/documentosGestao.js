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
  return l.map(({ conteudo, rascunho, ...d }) => ({ ...d, em_revisao: !!rascunho, rascunho_motivo: rascunho?.motivo || null, tem_conteudo: !!conteudo, tem_arquivo: !!d.arquivo_path, revisar: d.status === 'vigente' && d.proxima_revisao && d.proxima_revisao <= hoje }))
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
  // 18zs: conteúdo de documento VIGENTE só muda por nova revisão (aprovada) — aqui só dados de controle e a situação
  if (atual.status === 'vigente') {
    const mexe = ['titulo', 'conteudo', 'revisao'].some((k) => Object.prototype.hasOwnProperty.call(dados, k) && String(dados[k] ?? '') !== String(atual[k] ?? '')) || body?.arquivo_base64 || body?.remover_arquivo;
    if (mexe) throw Object.assign(new Error('Documento vigente: o texto, o título, a revisão e o arquivo só mudam por “↻ Nova revisão” (aprovada). Aqui dá para alterar área, datas, norma e a situação.'), { status: 409 });
  }
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

// ─── 18zs: 🔁 REVISÃO (a vigente vale até a nova ser aprovada) · 🗂 HISTÓRICO · ✓ LEITURA ───────────────────────────────
//   iniciar/salvar rascunho → aprovar: a vigente vai para documentos_gestao_versoes (obsoleta, com "vigente até"), o rascunho
//   vira a nova revisão (Rev. +1) com aprovado por/em de quem aprovou; as leituras recomeçam (são por revisão).
const CAMPOS_RASC = ['titulo', 'conteudo', 'motivo', 'elaborado_por', 'area', 'norma', 'proxima_revisao'];
const hojeBR = () => new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
const erro = (msg, status) => Object.assign(new Error(msg), { status });

async function salvarRascunho(supabase, tenantId, id, body) {
  const d = await obter(supabase, tenantId, id); if (!d) throw erro('Documento não encontrado', 404);
  if (d.status !== 'vigente') throw erro('Só documento vigente ganha nova revisão — rascunho novo se edita direto.', 409);
  const r = { ...(d.rascunho || { titulo: d.titulo, conteudo: d.conteudo, area: d.area, norma: d.norma, iniciado_em: new Date().toISOString() }) };
  for (const k of CAMPOS_RASC) if (Object.prototype.hasOwnProperty.call(body || {}, k)) r[k] = body[k] == null ? null : String(body[k]).slice(0, k === 'conteudo' ? 200000 : 2000);
  if (r.proxima_revisao && !/^\d{4}-\d{2}-\d{2}$/.test(r.proxima_revisao)) throw erro('Data inválida', 400);
  const arq = await gravarArquivo(supabase, tenantId, `${id}r`, body);
  if (arq) Object.assign(r, { arquivo: arq }); if (body?.remover_arquivo) r.arquivo = { remover: true };
  await q(supabase.from('documentos_gestao').update({ rascunho: r }).eq('id', id).eq('tenant_id', tenantId));
  return obter(supabase, tenantId, id);
}

async function descartarRascunho(supabase, tenantId, id) {
  const d = await obter(supabase, tenantId, id); if (!d) throw erro('Documento não encontrado', 404);
  if (d.rascunho?.arquivo?.arquivo_path) await D.removerArquivo(supabase, d.rascunho.arquivo.arquivo_path).catch(() => {});
  await q(supabase.from('documentos_gestao').update({ rascunho: null }).eq('id', id).eq('tenant_id', tenantId));
  return { ok: true };
}

async function aprovarRevisao(supabase, tenantId, id, { aprovador } = {}) {
  const d = await obter(supabase, tenantId, id); if (!d) throw erro('Documento não encontrado', 404);
  const r = d.rascunho; if (!r) throw erro('Não há revisão em elaboração para aprovar.', 409);
  if (!String(r.motivo || '').trim()) throw erro('Descreva o que mudou nesta revisão antes de aprovar (ISO 9001 7.5.3 — identificação das alterações).', 409);
  if (!String(r.titulo || '').trim()) throw erro('A revisão precisa de título.', 409);
  // a vigente vira histórico (com o arquivo dela)
  await q(supabase.from('documentos_gestao_versoes').insert([{ tenant_id: tenantId, documento_id: d.id, revisao: d.revisao, titulo: d.titulo, conteudo: d.conteudo,
    arquivo_path: d.arquivo_path, arquivo_nome: d.arquivo_nome, arquivo_mime: d.arquivo_mime, motivo: d.motivo_revisao || null, elaborado_por: d.elaborado_por, aprovado_por: d.aprovado_por, aprovado_em: d.aprovado_em, vigente_ate: new Date().toISOString() }]));
  const novoArq = r.arquivo?.arquivo_path ? r.arquivo : r.arquivo?.remover ? { arquivo_path: null, arquivo_nome: null, arquivo_mime: null } : {};
  await q(supabase.from('documentos_gestao').update({ titulo: r.titulo, conteudo: r.conteudo ?? null, area: r.area ?? d.area, norma: r.norma ?? d.norma, ...novoArq,
    revisao: (d.revisao || 0) + 1, motivo_revisao: r.motivo, elaborado_por: r.elaborado_por || d.elaborado_por, aprovado_por: aprovador || null, aprovado_em: hojeBR(),
    proxima_revisao: r.proxima_revisao || null, rascunho: null, status: 'vigente', atualizado_em: new Date().toISOString() }).eq('id', id).eq('tenant_id', tenantId));
  return obter(supabase, tenantId, id);
}

async function versoes(supabase, tenantId, id) {
  return (await q(supabase.from('documentos_gestao_versoes').select('*').eq('tenant_id', tenantId).eq('documento_id', id))).sort((a, b) => b.revisao - a.revisao);
}

async function confirmarLeitura(supabase, tenantId, id, { usuarioId, usuarioNome }) {
  const d = await obter(supabase, tenantId, id); if (!d) throw erro('Documento não encontrado', 404);
  if (d.status !== 'vigente') throw erro('Só se confirma leitura de documento vigente.', 409);
  const ja = (await q(supabase.from('documentos_gestao_leituras').select('*').eq('documento_id', id).eq('revisao', d.revisao))).find((l) => String(l.usuario_id) === String(usuarioId));
  if (ja) return { ja: true, leitura: ja };
  const [l] = await q(supabase.from('documentos_gestao_leituras').insert([{ tenant_id: tenantId, documento_id: id, revisao: d.revisao, usuario_id: usuarioId, usuario_nome: usuarioNome || null }]).select());
  return { leitura: l };
}
async function leituras(supabase, tenantId, id, revisao) {
  return (await q(supabase.from('documentos_gestao_leituras').select('*').eq('tenant_id', tenantId).eq('documento_id', id))).filter((l) => revisao == null || Number(l.revisao) === Number(revisao))
    .sort((a, b) => String(b.lido_em).localeCompare(String(a.lido_em)));
}

// ─── 18zt: 📚 BIBLIOTECA DE MODELOS (ISO 9001) — importar entra como RASCUNHO; ✓ Aprovar e publicar = Rev. 00 vigente ─────
const BIB = () => require('./modelosGestao/iso9001');
const fmtCnpj = (c) => { const d = String(c || '').replace(/\D/g, ''); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : (c || '[CNPJ]'); };
function preencher(texto, emp) {
  return String(texto || '').replace(/\{\{EMPRESA\}\}/g, emp?.nome_fantasia || emp?.razao_social || emp?.nome || '[nome da empresa]')
    .replace(/\{\{CNPJ\}\}/g, fmtCnpj(emp?.cnpj)).replace(/\{\{CIDADE_UF\}\}/g, [emp?.cidade, emp?.uf].filter(Boolean).join('/') || '[cidade/UF]');
}
async function biblioteca(supabase, tenantId) {
  const meus = await q(supabase.from('documentos_gestao').select('*').eq('tenant_id', tenantId)).catch(() => []);
  return { aviso: BIB().AVISO, modelos: BIB().MODELOS.map((m) => { const ja = meus.find((d) => d.modelo_origem === m.id);
    return { id: m.id, codigo: m.codigo, titulo: m.titulo, tipo: m.tipo, norma: m.norma, area: m.area, conteudo: m.conteudo, ja_importado: !!ja, documento_id: ja?.id || null, codigo_ocupado: !ja && meus.some((d) => String(d.codigo).toLowerCase() === m.codigo.toLowerCase()) }; }) };
}
async function importarModelo(supabase, tenantId, modeloId, { codigo } = {}) {
  const m = BIB().MODELOS.find((x) => x.id === modeloId); if (!m) throw erro('Modelo não encontrado', 404);
  const meus = await q(supabase.from('documentos_gestao').select('*').eq('tenant_id', tenantId));
  if (meus.some((d) => d.modelo_origem === m.id)) throw erro(`${m.codigo} já foi importado — veja em 📘 Gestão.`, 409);
  const emp = (await q(supabase.from('tenants').select('*').eq('id', tenantId)).catch(() => []))[0] || {};
  return criar(supabase, tenantId, { codigo: codigo || m.codigo, titulo: m.titulo, tipo: m.tipo, area: m.area, norma: m.norma, revisao: 0, status: 'rascunho', modelo_origem: m.id,
    conteudo: `${preencher(m.conteudo, emp)}\n\n— ${BIB().AVISO}` });
}
/** rascunho (novo ou importado) → vigente Rev. atual, com aprovado por/em */
async function publicar(supabase, tenantId, id, { aprovador } = {}) {
  const d = await obter(supabase, tenantId, id); if (!d) throw erro('Documento não encontrado', 404);
  if (d.status !== 'rascunho') throw erro('Só rascunho se publica — documento vigente muda por nova revisão.', 409);
  if (!String(d.conteudo || '').trim() && !d.arquivo_path) throw erro('O documento está vazio — escreva o texto ou anexe o arquivo.', 409);
  await q(supabase.from('documentos_gestao').update({ status: 'vigente', aprovado_por: aprovador || d.aprovado_por, aprovado_em: hojeBR(), atualizado_em: new Date().toISOString() }).eq('id', id).eq('tenant_id', tenantId));
  return obter(supabase, tenantId, id);
}

module.exports = { biblioteca, importarModelo, publicar, preencher, salvarRascunho, descartarRascunho, aprovarRevisao, versoes, confirmarLeitura, leituras, TIPOS, STATUS, validar, listar, obter, criar, atualizar, excluir };
