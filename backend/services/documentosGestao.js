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
  for (const k of ['elaborado_por_id', 'aprovado_por_id', 'elaborado_por_usuario_id', 'aprovado_por_usuario_id']) if (tem(k)) { const v = body[k]; if (v == null || v === '') out[k] = null; else if (!/^[\w-]{1,40}$/.test(String(v))) erros.push('Pessoa inválida'); else out[k] = String(v); } // 18zz.6
  if (tem('conteudo')) out.conteudo = body.conteudo ? String(body.conteudo).slice(0, 200000) : null;
  if (tem('distribuicao')) { // 18zz.2 · 18zz.4 (Marcony): Todos · PERFIS de acesso · FUNÇÕES (o "setor" da 18zz.3 saiu)
    const x = body.distribuicao; const PERF = ['admin', 'gestor', 'comprador', 'operacao', 'qualidade', 'financeiro', 'comercial', 'fiscal', 'colaborador'];
    const fs = [...new Set((x?.funcoes || []).map(String))].slice(0, 300); const ps = [...new Set((x?.perfis || []).map(String))].filter((p) => PERF.includes(p));
    out.distribuicao = !x || (!x.todos && !fs.length && !ps.length) ? null : { todos: !!x.todos, perfis: x.todos ? [] : ps, funcoes: x.todos ? [] : fs }; }
  return { erros, dados: out };
}

async function listar(supabase, tenantId) {
  const l = await q(supabase.from('documentos_gestao').select('*').eq('tenant_id', tenantId));
  const cont = await contagens(supabase, tenantId, l).catch(() => new Map()); // 18zz.4
  const hoje = new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
  return l.map(({ conteudo, rascunho, ...d }) => ({ ...d, leitura: cont.get(String(d.id)) || null, etapa: d.fluxo?.etapa || null, com: d.fluxo?.etapa === 'verificacao' ? d.fluxo.verificador?.id : d.fluxo?.etapa === 'aprovacao' ? d.fluxo.aprovador?.id : null, em_revisao: !!rascunho, rascunho_motivo: rascunho?.motivo || null, tem_conteudo: !!conteudo, tem_arquivo: !!d.arquivo_path, revisar: d.status === 'vigente' && d.proxima_revisao && d.proxima_revisao <= hoje }))
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

// 18zz.6 (Marcony): elaborado/aprovado por = FUNCIONÁRIO do cadastro (rastreável) — o nome vem do cadastro; texto livre fica sem id
async function amarrarPessoas(supabase, tenantId, dados) { // 18zz.7: funcionário (colaborador) OU usuário do sistema sem cadastro de funcionário
  const has = (k) => Object.prototype.hasOwnProperty.call(dados, k);
  for (const pre of ['elaborado_por', 'aprovado_por']) {
    const kc = `${pre}_id`, ku = `${pre}_usuario_id`;
    if (!has(kc) && !has(ku)) { if (has(pre)) { dados[kc] = null; dados[ku] = null; } continue; }
    if (dados[kc] != null) {
      const c = (await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId).eq('id', dados[kc])))[0];
      if (!c) throw Object.assign(new Error('Funcionário não encontrado no cadastro'), { status: 400 });
      dados[pre] = c.nome; dados[ku] = c.usuario_id ?? null;
    } else if (dados[ku] != null) {
      const u = (await q(supabase.from('usuarios').select('*').eq('tenant_id', tenantId).eq('id', dados[ku])))[0];
      if (!u) throw Object.assign(new Error('Usuário não encontrado'), { status: 400 });
      dados[pre] = u.nome || u.email; dados[kc] = await colabIdDoUsuario(supabase, tenantId, u.id);
    } else { dados[kc] = null; dados[ku] = null; }
  }
  return dados;
}
async function colabIdDoUsuario(supabase, tenantId, usuarioId) {
  if (!usuarioId) return null;
  try { return (await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId).eq('usuario_id', usuarioId)))[0]?.id ?? null; } catch { return null; }
}

async function criar(supabase, tenantId, body) {
  const { erros, dados } = validar(body || {}); if (erros.length) throw Object.assign(new Error(erros[0]), { status: 400 });
  await amarrarPessoas(supabase, tenantId, dados);
  if (!(await codigoLivre(supabase, tenantId, dados.codigo))) throw Object.assign(new Error(`Já existe um documento com o código ${dados.codigo}`), { status: 409 });
  const [d] = await q(supabase.from('documentos_gestao').insert([{ ...dados, tenant_id: tenantId, modelo_origem: txt(body.modelo_origem, 60) }]).select());
  const arq = await gravarArquivo(supabase, tenantId, d.id, body);
  if (arq) await q(supabase.from('documentos_gestao').update(arq).eq('id', d.id).eq('tenant_id', tenantId));
  return { ...d, ...(arq || {}) };
}

async function atualizar(supabase, tenantId, id, body) {
  const atual = await obter(supabase, tenantId, id); if (!atual) throw Object.assign(new Error('Documento não encontrado'), { status: 404 });
  const { erros, dados } = validar(body || {}, true); if (erros.length) throw Object.assign(new Error(erros[0]), { status: 400 });
  if (atual.assinaturas?.lista?.length || atual.fluxo) for (const k of ['aprovado_por', 'aprovado_por_id', 'aprovado_por_usuario_id', 'aprovado_em', 'elaborado_por', 'elaborado_por_id', 'elaborado_por_usuario_id']) delete dados[k]; // 18zz.7: quem assinou no sistema não se edita à mão
  await amarrarPessoas(supabase, tenantId, dados);
  if (dados.codigo && !(await codigoLivre(supabase, tenantId, dados.codigo, id))) throw Object.assign(new Error(`Já existe um documento com o código ${dados.codigo}`), { status: 409 });
  if (atual.status === 'rascunho' && ['titulo', 'conteudo'].some((k) => Object.prototype.hasOwnProperty.call(dados, k) && String(dados[k] ?? '') !== String(atual[k] ?? ''))) travadoNoFluxo(atual); // 18zv
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
const CAMPOS_RASC = ['titulo', 'conteudo', 'motivo', 'elaborado_por', 'elaborado_por_id', 'elaborado_por_usuario_id', 'aprovado_por', 'aprovado_por_usuario_id', 'area', 'norma', 'proxima_revisao'];
const hojeBR = () => new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
const erro = (msg, status) => Object.assign(new Error(msg), { status });

async function salvarRascunho(supabase, tenantId, id, body) {
  const d = await obter(supabase, tenantId, id); if (!d) throw erro('Documento não encontrado', 404);
  travadoNoFluxo(d);
  if (d.status !== 'vigente') throw erro('Só documento vigente ganha nova revisão — rascunho novo se edita direto.', 409);
  const r = { ...(d.rascunho || { titulo: d.titulo, conteudo: d.conteudo, area: d.area, norma: d.norma, iniciado_em: new Date().toISOString() }) };
  for (const k of CAMPOS_RASC) if (Object.prototype.hasOwnProperty.call(body || {}, k)) r[k] = body[k] == null ? null : String(body[k]).slice(0, k === 'conteudo' ? 200000 : 2000);
  if (r.proxima_revisao && !/^\d{4}-\d{2}-\d{2}$/.test(r.proxima_revisao)) throw erro('Data inválida', 400);
  if (['elaborado_por', 'elaborado_por_id', 'elaborado_por_usuario_id'].some((k) => Object.prototype.hasOwnProperty.call(body || {}, k))) { // 18zz.6 · 18zz.7
    const p = await amarrarPessoas(supabase, tenantId, { elaborado_por: r.elaborado_por, elaborado_por_id: r.elaborado_por_id || null, elaborado_por_usuario_id: r.elaborado_por_usuario_id || null }); Object.assign(r, p); }
  if (['aprovado_por', 'aprovado_por_usuario_id'].some((k) => Object.prototype.hasOwnProperty.call(body || {}, k))) { // 18zz.8: aprovador RESPONSÁVEL (designado) da revisão
    const p = await amarrarPessoas(supabase, tenantId, { aprovado_por: r.aprovado_por, aprovado_por_usuario_id: r.aprovado_por_usuario_id || null }); r.aprovado_por = p.aprovado_por; r.aprovado_por_usuario_id = p.aprovado_por_usuario_id; }
  const arq = await gravarArquivo(supabase, tenantId, `${id}r`, body);
  if (arq) Object.assign(r, { arquivo: arq }); if (body?.remover_arquivo) r.arquivo = { remover: true };
  await q(supabase.from('documentos_gestao').update({ rascunho: r }).eq('id', id).eq('tenant_id', tenantId));
  return obter(supabase, tenantId, id);
}

async function descartarRascunho(supabase, tenantId, id) {
  const d = await obter(supabase, tenantId, id); if (!d) throw erro('Documento não encontrado', 404);
  travadoNoFluxo(d);
  if (d.rascunho?.arquivo?.arquivo_path) await D.removerArquivo(supabase, d.rascunho.arquivo.arquivo_path).catch(() => {});
  await q(supabase.from('documentos_gestao').update({ rascunho: null }).eq('id', id).eq('tenant_id', tenantId));
  return { ok: true };
}

async function aprovarRevisao(supabase, tenantId, id, { aprovador, aprovadorUsuarioId = null, proxima } = {}) {
  const d = await obter(supabase, tenantId, id); if (!d) throw erro('Documento não encontrado', 404);
  const r = d.rascunho; if (!r) throw erro('Não há revisão em elaboração para aprovar.', 409);
  if (!String(r.motivo || '').trim()) throw erro('Descreva o que mudou nesta revisão antes de aprovar (ISO 9001 7.5.3 — identificação das alterações).', 409);
  if (!String(r.titulo || '').trim()) throw erro('A revisão precisa de título.', 409);
  // a vigente vira histórico (com o arquivo dela)
  await q(supabase.from('documentos_gestao_versoes').insert([{ tenant_id: tenantId, documento_id: d.id, revisao: d.revisao, titulo: d.titulo, conteudo: d.conteudo,
    arquivo_path: d.arquivo_path, arquivo_nome: d.arquivo_nome, arquivo_mime: d.arquivo_mime, motivo: d.motivo_revisao || null, elaborado_por: d.elaborado_por, aprovado_por: d.aprovado_por, ...(d.elaborado_por_id != null || d.aprovado_por_id != null || d.elaborado_por_usuario_id != null || d.aprovado_por_usuario_id != null ? { elaborado_por_id: d.elaborado_por_id ?? null, aprovado_por_id: d.aprovado_por_id ?? null, elaborado_por_usuario_id: d.elaborado_por_usuario_id ?? null, aprovado_por_usuario_id: d.aprovado_por_usuario_id ?? null } : {}), aprovado_em: d.aprovado_em, vigente_ate: new Date().toISOString(),
    ...(d.assinaturas ? { assinaturas: d.assinaturas, codigo_verificacao: d.codigo_verificacao || null } : {}) }])); // 18zv
  const novoArq = r.arquivo?.arquivo_path ? r.arquivo : r.arquivo?.remover ? { arquivo_path: null, arquivo_nome: null, arquivo_mime: null } : {};
  await q(supabase.from('documentos_gestao').update({ titulo: r.titulo, conteudo: r.conteudo ?? null, area: r.area ?? d.area, norma: r.norma ?? d.norma, ...novoArq,
    revisao: (d.revisao || 0) + 1, motivo_revisao: r.motivo, elaborado_por: r.elaborado_por || d.elaborado_por, elaborado_por_id: r.elaborado_por ? (r.elaborado_por_id ?? null) : (d.elaborado_por_id ?? null), elaborado_por_usuario_id: r.elaborado_por ? (r.elaborado_por_usuario_id ?? null) : (d.elaborado_por_usuario_id ?? null), aprovado_por: aprovador || null, aprovado_por_id: await colabIdDoUsuario(supabase, tenantId, aprovadorUsuarioId), aprovado_por_usuario_id: aprovadorUsuarioId || null, aprovado_em: hojeBR(),
    proxima_revisao: proxima !== undefined ? (proxima || null) : null, rascunho: null, status: 'vigente', atualizado_em: new Date().toISOString() }).eq('id', id).eq('tenant_id', tenantId));
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
  const [l] = await q(supabase.from('documentos_gestao_leituras').insert([{ tenant_id: tenantId, documento_id: id, revisao: d.revisao, usuario_id: usuarioId, usuario_nome: usuarioNome || null, lido_em: new Date().toISOString() }]).select());
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
async function publicar(supabase, tenantId, id, { aprovador, aprovadorUsuarioId = null, proxima } = {}) {
  const d = await obter(supabase, tenantId, id); if (!d) throw erro('Documento não encontrado', 404);
  if (d.status !== 'rascunho') throw erro('Só rascunho se publica — documento vigente muda por nova revisão.', 409);
  if (!String(d.conteudo || '').trim() && !d.arquivo_path) throw erro('O documento está vazio — escreva o texto ou anexe o arquivo.', 409);
  await q(supabase.from('documentos_gestao').update({ status: 'vigente', aprovado_por: aprovador || d.aprovado_por, ...(aprovador ? { aprovado_por_id: await colabIdDoUsuario(supabase, tenantId, aprovadorUsuarioId), aprovado_por_usuario_id: aprovadorUsuarioId || null } : {}), ...(proxima !== undefined ? { proxima_revisao: proxima || null } : {}), aprovado_em: hojeBR(), atualizado_em: new Date().toISOString() }).eq('id', id).eq('tenant_id', tenantId));
  return obter(supabase, tenantId, id);
}

// ─── 18zv: ✍ FLUXO INTERNO + ASSINATURA ELETRÔNICA (Marcony, 15/11) ──────────────────────────────────────────────────
//   Elaborado (quem envia) → Verificado (opcional: verificador escolhido) → Aprovado (aprovador escolhido, perfil admin/
//   gestor/qualidade). Cada etapa assina com o login: usuário, nome, função, data-hora e o HASH do texto naquele momento.
//   Durante a verificação/aprovação o texto fica TRAVADO (mudou o texto = assinatura inválida); devolver destrava e volta
//   para quem elaborou. Aprovado: assinaturas + código de verificação vão para o documento (e, na próxima revisão, para o
//   histórico). Cada passo avisa a próxima pessoa (🔔 no app; e-mail se não for vista — regra das notificações).
const crypto = require('crypto');
const ETAPA = { elaboracao: 'Em elaboração', verificacao: 'Aguardando verificação', aprovacao: 'Aguardando aprovação' };
function travadoNoFluxo(d) { if (['verificacao', 'aprovacao'].includes(d?.fluxo?.etapa)) throw erro(`${d.codigo} está ${ETAPA[d.fluxo.etapa].toLowerCase()} — o texto fica travado. Para alterar, quem está com ele precisa devolver.`, 409); }
/** o que está sendo aprovado: a revisão em rascunho (de um vigente) ou o próprio documento novo em rascunho */
function emPauta(d) {
  if (d.rascunho) return { modo: 'revisao', revisao: (d.revisao || 0) + 1, titulo: d.rascunho.titulo, conteudo: d.rascunho.conteudo || '', arquivo: d.rascunho.arquivo?.arquivo_path || d.arquivo_path || '' };
  if (d.status === 'rascunho') return { modo: 'novo', revisao: d.revisao || 0, titulo: d.titulo, conteudo: d.conteudo || '', arquivo: d.arquivo_path || '' };
  return null;
}
const hashDe = (d, p) => crypto.createHash('sha256').update(`${d.id}|${p.revisao}|${p.titulo}|${p.conteudo}|${p.arquivo}`).digest('hex');
const codigoVer = (h) => `${h.slice(0, 4)}-${h.slice(4, 8)}`.toUpperCase();
const assinatura = (etapa, eu, h) => ({ etapa, usuario_id: eu.id, nome: eu.nome || null, funcao: eu.funcao || null, em: new Date().toISOString(), hash: h });
async function avisar(supabase, tenantId, usuarioId, aviso) {
  if (!usuarioId) return; try { await require('./notificacoes').criar(supabase, { tipo: 'usuario', id: String(usuarioId) }, { tenantId, tipo: 'documento_gestao', link: { tela: 'documentos', aba: 'gestao' }, ...aviso }); } catch { /* sem notificações: segue */ }
}

async function enviarFluxo(supabase, tenantId, id, { eu, verificador = null, aprovador, comentario = null, aprovadores = [] }) {
  const d = await obter(supabase, tenantId, id); if (!d) throw erro('Documento não encontrado', 404);
  const p = emPauta(d); if (!p) throw erro('Não há rascunho para enviar — use ↻ Nova revisão.', 409);
  travadoNoFluxo(d);
  if (!String(p.titulo || '').trim() || (!p.conteudo.trim() && !p.arquivo)) throw erro('O documento está vazio — escreva o texto ou anexe o arquivo.', 409);
  if (p.modo === 'revisao' && !String(d.rascunho?.motivo || '').trim()) throw erro('Descreva o que mudou nesta revisão antes de enviar (ISO 9001 7.5.3).', 409);
  if (!aprovador?.id) throw erro('Escolha quem aprova.', 400);
  if (!aprovadores.some((a) => String(a.id) === String(aprovador.id))) throw erro('O aprovador precisa ter perfil admin, gestor ou qualidade.', 400);
  const proprio = String(aprovador.id) === String(eu.id); // 18zz.10: permitido, mas fica registrado (sem segregação)
  if (verificador?.id && (String(verificador.id) === String(eu.id) || String(verificador.id) === String(aprovador.id))) throw erro('O verificador precisa ser diferente de quem elaborou e de quem aprova.', 409);
  const h = hashDe(d, p); const etapa = verificador?.id ? 'verificacao' : 'aprovacao';
  const fluxo = { etapa, modo: p.modo, revisao: p.revisao, elaborado: assinatura('elaborado', eu, h), verificador: verificador?.id ? { id: verificador.id, nome: verificador.nome || null } : null, aprovador: { id: aprovador.id, nome: aprovador.nome || null }, verificado: null,
    historico: [...(d.fluxo?.historico || []), { acao: proprio ? 'enviado (quem enviou também aprova — sem segregação de funções)' : 'enviado', por: eu.nome || null, em: new Date().toISOString(), comentario: comentario ? String(comentario).slice(0, 1000) : null }] };
  await q(supabase.from('documentos_gestao').update({ fluxo }).eq('id', id).eq('tenant_id', tenantId));
  const quem = etapa === 'verificacao' ? fluxo.verificador : fluxo.aprovador;
  await avisar(supabase, tenantId, quem.id, { titulo: `✍ ${d.codigo} Rev. ${String(p.revisao).padStart(2, '0')} aguarda sua ${etapa === 'verificacao' ? 'verificação' : 'aprovação'}`, texto: `${p.titulo} — enviado por ${eu.nome || 'colega'}${comentario ? `: "${String(comentario).slice(0, 140)}"` : ''}.` });
  return obter(supabase, tenantId, id);
}

/** 18zz.8 (Marcony, como na NC): ↪️ transferir a APROVAÇÃO para outra pessoa — quem está como aprovador ou quem elaborou */
async function transferirAprovacao(supabase, tenantId, id, { eu, para, motivo = null, aprovadores = [] }) {
  const d = await obter(supabase, tenantId, id); if (!d) throw erro('Documento não encontrado', 404);
  const f = d.fluxo; if (!f || !['verificacao', 'aprovacao'].includes(f.etapa)) throw erro('Este documento não está aguardando aprovação.', 409);
  if (![String(f.aprovador?.id), String(f.elaborado?.usuario_id)].includes(String(eu.id))) throw erro(`Só ${f.aprovador?.nome || 'o aprovador'} ou quem elaborou pode transferir a aprovação.`, 403);
  const novo = aprovadores.find((a) => String(a.id) === String(para));
  if (!novo) throw erro('O novo aprovador precisa ter perfil admin, gestor ou qualidade.', 400);
  if (String(novo.id) === String(f.aprovador?.id)) throw erro('Essa pessoa já é a aprovadora.', 409);
  if (f.verificador?.id && String(novo.id) === String(f.verificador.id)) throw erro('O verificador não pode ser também o aprovador.', 409);
  const fluxo = { ...f, aprovador: { id: novo.id, nome: novo.nome || null }, historico: [...(f.historico || []), { acao: `aprovação transferida de ${f.aprovador?.nome || '—'} para ${novo.nome || '—'}`, por: eu.nome || null, em: new Date().toISOString(), comentario: motivo ? String(motivo).slice(0, 1000) : null }] };
  const desig = f.modo === 'revisao' ? { rascunho: { ...(d.rascunho || {}), aprovado_por: novo.nome || null, aprovado_por_usuario_id: novo.id } } : { aprovado_por: novo.nome || null, aprovado_por_usuario_id: novo.id, aprovado_por_id: await colabIdDoUsuario(supabase, tenantId, novo.id) };
  await q(supabase.from('documentos_gestao').update({ fluxo, ...desig }).eq('id', id).eq('tenant_id', tenantId));
  if (f.etapa === 'aprovacao') await avisar(supabase, tenantId, novo.id, { titulo: `✍ ${d.codigo} Rev. ${String(f.revisao).padStart(2, '0')} aguarda sua aprovação`, texto: `${eu.nome || 'Colega'} transferiu a aprovação para você${motivo ? ` — "${String(motivo).slice(0, 200)}"` : ''}.` });
  if (String(f.aprovador?.id) !== String(eu.id)) await avisar(supabase, tenantId, f.aprovador?.id, { titulo: `↪️ ${d.codigo}: aprovação transferida`, texto: `${eu.nome || 'Colega'} passou a aprovação para ${novo.nome || 'outra pessoa'}.` });
  return obter(supabase, tenantId, id);
}

async function verificarFluxo(supabase, tenantId, id, { eu, comentario = null }) {
  const d = await obter(supabase, tenantId, id); if (!d) throw erro('Documento não encontrado', 404);
  const f = d.fluxo; if (f?.etapa !== 'verificacao') throw erro('Este documento não está aguardando verificação.', 409);
  if (String(f.verificador?.id) !== String(eu.id)) throw erro(`Quem verifica é ${f.verificador?.nome || 'outra pessoa'}.`, 403);
  const h = hashDe(d, emPauta(d)); if (h !== f.elaborado.hash) throw erro('O texto mudou depois de enviado — devolva para elaboração.', 409);
  const fluxo = { ...f, etapa: 'aprovacao', verificado: assinatura('verificado', eu, h), historico: [...(f.historico || []), { acao: 'verificado', por: eu.nome || null, em: new Date().toISOString(), comentario: comentario ? String(comentario).slice(0, 1000) : null }] };
  await q(supabase.from('documentos_gestao').update({ fluxo }).eq('id', id).eq('tenant_id', tenantId));
  await avisar(supabase, tenantId, f.aprovador.id, { titulo: `✍ ${d.codigo} Rev. ${String(f.revisao).padStart(2, '0')} aguarda sua aprovação`, texto: `Verificado por ${eu.nome || 'colega'}.` });
  return obter(supabase, tenantId, id);
}

async function devolverFluxo(supabase, tenantId, id, { eu, comentario }) {
  const d = await obter(supabase, tenantId, id); if (!d) throw erro('Documento não encontrado', 404);
  const f = d.fluxo; if (!['verificacao', 'aprovacao'].includes(f?.etapa)) throw erro('Este documento não está em verificação nem em aprovação.', 409);
  const daVez = f.etapa === 'verificacao' ? f.verificador : f.aprovador;
  if (String(daVez?.id) !== String(eu.id)) throw erro(`Quem pode devolver agora é ${daVez?.nome || 'outra pessoa'}.`, 403);
  if (!String(comentario || '').trim()) throw erro('Diga o que precisa ser ajustado.', 400);
  const fluxo = { ...f, etapa: 'elaboracao', verificado: null, historico: [...(f.historico || []), { acao: 'devolvido', por: eu.nome || null, em: new Date().toISOString(), comentario: String(comentario).slice(0, 1000) }] };
  await q(supabase.from('documentos_gestao').update({ fluxo }).eq('id', id).eq('tenant_id', tenantId));
  await avisar(supabase, tenantId, f.elaborado?.usuario_id, { titulo: `↩ ${d.codigo} devolvido para ajuste`, texto: `${eu.nome || 'Colega'}: "${String(comentario).slice(0, 160)}"` });
  return obter(supabase, tenantId, id);
}

async function aprovarFluxo(supabase, tenantId, id, { eu, proxima = null }) { // 18zz.7: próxima análise crítica = opcional, quem aprova decide
  if (proxima && !DATA.test(String(proxima))) throw erro('Data inválida', 400);
  const d = await obter(supabase, tenantId, id); if (!d) throw erro('Documento não encontrado', 404);
  const f = d.fluxo; if (f?.etapa !== 'aprovacao') throw erro('Este documento não está aguardando aprovação.', 409);
  if (String(f.aprovador?.id) !== String(eu.id)) throw erro(`Quem aprova é ${f.aprovador?.nome || 'outra pessoa'}.`, 403);
  const p = emPauta(d); const h = hashDe(d, p); if (h !== f.elaborado.hash) throw erro('O texto mudou depois de enviado — devolva para elaboração.', 409);
  const assinaturas = [f.elaborado, ...(f.verificado ? [f.verificado] : []), assinatura('aprovado', eu, h)];
  const historico = [...(f.historico || []), { acao: 'aprovado', por: eu.nome || null, em: new Date().toISOString() }];
  if (p.modo === 'revisao') {
    if (!String(d.rascunho?.elaborado_por || '').trim()) await q(supabase.from('documentos_gestao').update({ rascunho: { ...d.rascunho, elaborado_por: f.elaborado.nome } }).eq('id', id).eq('tenant_id', tenantId));
    await aprovarRevisao(supabase, tenantId, id, { aprovador: eu.nome, aprovadorUsuarioId: eu.id, proxima });
  } else await publicar(supabase, tenantId, id, { aprovador: eu.nome, aprovadorUsuarioId: eu.id, proxima });
  await q(supabase.from('documentos_gestao').update({ assinaturas: { lista: assinaturas, historico }, codigo_verificacao: codigoVer(h), elaborado_por: f.elaborado.nome || d.elaborado_por, ...(f.elaborado?.usuario_id ? { elaborado_por_id: await colabIdDoUsuario(supabase, tenantId, f.elaborado.usuario_id), elaborado_por_usuario_id: f.elaborado.usuario_id } : {}), fluxo: null }).eq('id', id).eq('tenant_id', tenantId));
  await avisar(supabase, tenantId, f.elaborado?.usuario_id, { titulo: `✅ ${d.codigo} Rev. ${String(p.revisao).padStart(2, '0')} aprovado e vigente`, texto: `Aprovado por ${eu.nome || 'colega'}.` });
  return obter(supabase, tenantId, id);
}

/** confere se o documento vigente ainda bate com o que foi assinado */
function conferirAssinatura(d) {
  const l = d?.assinaturas?.lista; if (!l?.length || !d.codigo_verificacao) return null;
  const h = hashDe(d, { revisao: d.revisao, titulo: d.titulo, conteudo: d.conteudo || '', arquivo: d.arquivo_path || '' });
  return { valida: codigoVer(h) === d.codigo_verificacao, codigo: d.codigo_verificacao };
}

// ─── 18zz.2: 📣 DISTRIBUIÇÃO PARA OS COLABORADORES (leitura obrigatória no app) ───────────────────────────────────────
// alcança (por COLABORADOR ativo = o "funcionário"): todos · OU a função dele está na lista · OU o login ligado a ele tem um dos
//   perfis marcados (colaborador sem login só entra por "todos"/função — e aparece como "sem login" na contagem)
const alcanca = (dist, col, perfisDe = null) => !!dist && (dist.todos || (dist.funcoes || []).map(String).includes(String(col?.funcao_id ?? ''))
  || (!!perfisDe && !!col?.usuario_id && (perfisDe.get(String(col.usuario_id)) || []).some((p) => (dist.perfis || []).includes(p))));
async function mapaPerfis(supabase, tenantId) {
  try { return new Map((await q(supabase.from('usuarios').select('*').eq('tenant_id', tenantId))).filter((u) => u.ativo !== false)
    .map((u) => [String(u.id), Array.isArray(u.perfis) && u.perfis.length ? u.perfis : [u.perfil].filter(Boolean)])); } catch { return new Map(); }
}
/** quem precisa ler: colaboradores ativos alcançados (com/sem login) */
async function alvo(supabase, tenantId, dist, ctx = null) {
  if (!dist) return [];
  const perfisDe = ctx?.perfisDe || await mapaPerfis(supabase, tenantId);
  const cols = ctx?.cols || await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId));
  return cols.filter((c) => c.situacao !== 'desligado' && alcanca(dist, c, perfisDe)).map((c) => ({ id: c.id, nome: c.nome, usuario_id: c.usuario_id || null, sem_login: !c.usuario_id }));
}
/** documentos vigentes distribuídos para este colaborador, com "já li a revisão atual?" */
async function meusProcedimentos(supabase, tenantId, col, usuarioId) {
  const pd = await mapaPerfis(supabase, tenantId);
  const l = (await q(supabase.from('documentos_gestao').select('*').eq('tenant_id', tenantId))).filter((d) => d.status === 'vigente' && alcanca(d.distribuicao, col, pd));
  const lei = l.length ? await q(supabase.from('documentos_gestao_leituras').select('*').eq('tenant_id', tenantId)).catch(() => []) : [];
  return l.map(({ conteudo, rascunho, fluxo, ...d }) => ({ id: d.id, codigo: d.codigo, titulo: d.titulo, tipo: d.tipo, revisao: d.revisao, aprovado_em: d.aprovado_em,
    lido_em: lei.find((x) => String(x.documento_id) === String(d.id) && Number(x.revisao) === Number(d.revisao) && String(x.usuario_id) === String(usuarioId))?.lido_em || null }))
    .sort((a, b) => (a.lido_em ? 1 : 0) - (b.lido_em ? 1 : 0) || String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true }));
}
/** quem deveria ler × quem já leu a revisão atual — { total, lidos:[{nome,em}], pendentes:[{nome,sem_login}] } */
async function destinatarios(supabase, tenantId, d, ctx = null) {
  if (!d?.distribuicao) return null;
  const pessoas = await alvo(supabase, tenantId, d.distribuicao, ctx);
  const lei = ctx?.leituras ? ctx.leituras.filter((x) => String(x.documento_id) === String(d.id) && Number(x.revisao) === Number(d.revisao)) : await leituras(supabase, tenantId, d.id, d.revisao);
  const leu = (p) => p.usuario_id && lei.find((x) => String(x.usuario_id) === String(p.usuario_id));
  return { total: pessoas.length, lidos: pessoas.filter(leu).map((p) => ({ nome: p.nome, em: leu(p).lido_em })), pendentes: pessoas.filter((p) => !leu(p)).map((p) => ({ nome: p.nome, sem_login: p.sem_login })) };
}
/** 🔢 prévia: quantos funcionários uma distribuição alcança (enquanto escolhe) */
async function previaAlcance(supabase, tenantId, distribuicao) {
  const { dados } = validar({ distribuicao }, true); const p = await alvo(supabase, tenantId, dados.distribuicao);
  return { total: p.length, sem_login: p.filter((x) => x.sem_login).length };
}
/** contagem lidos/esperados para a LISTA (uma consulta de cada tabela para todos os documentos) */
async function contagens(supabase, tenantId, docs) {
  const dist = docs.filter((d) => d.status === 'vigente' && d.distribuicao); if (!dist.length) return new Map();
  const [perfisDe, cols, lei] = await Promise.all([mapaPerfis(supabase, tenantId), q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId)), q(supabase.from('documentos_gestao_leituras').select('*').eq('tenant_id', tenantId)).catch(() => [])]);
  const out = new Map(); for (const d of dist) { const r = await destinatarios(supabase, tenantId, d, { perfisDe, cols, leituras: lei }); out.set(String(d.id), { esperados: r.total, lidos: r.lidos.length }); }
  return out;
}

module.exports = { transferirAprovacao, mapaPerfis, alvo, previaAlcance, contagens, alcanca, meusProcedimentos, destinatarios, ETAPA, enviarFluxo, verificarFluxo, devolverFluxo, aprovarFluxo, conferirAssinatura, emPauta, biblioteca, importarModelo, publicar, preencher, salvarRascunho, descartarRascunho, aprovarRevisao, versoes, confirmarLeitura, leituras, TIPOS, STATUS, validar, listar, obter, criar, atualizar, excluir };
