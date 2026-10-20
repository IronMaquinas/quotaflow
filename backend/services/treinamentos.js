// backend/services/treinamentos.js — etapa 12e.1
//
// Treinamentos: catálogo da empresa, turmas com lista de presença ASSINADA na tela, registro manual
// (treinamento já feito no modelo da empresa — instrutor/material internos — só com o anexo da evidência),
// exigidos pela função (funcoes.treinamentos [{ codigo }]) → pilar 🎓 do selo, calendário e e-mail.
//   • Turma presencial/online: nasce 'agendada'; cada participante assina → presente; "Concluir" fecha a turma
//     (quem não assinou fica como faltou). Válido até = data da turma + validade do treinamento.
//   • Manual: nasce 'concluida', participantes presentes, com evidência anexa (PDF/foto).
//   • Situação por colaborador e treinamento exigido: ok · vence (≤ 30 dias) · vencido · agendado (inscrito numa
//     turma futura — ainda conta como falta no selo) · falta.
// 12e.2a: conteúdo em seções (texto + vídeo por link + material), prova de múltipla escolha (nota mínima,
//   até 3 tentativas), BIBLIOTECA do QuotaFlow (tenant_id NULL, mantida no Console → a empresa importa uma cópia
//   com origem_id/origem_versao, e vê "✨ versão nova") e HORAS creditadas por participação (⏱ por colaborador,
//   por tipo e por período).
// 12e.2b: turma ONLINE — o colaborador faz a prova (logado em "Meus treinamentos" ou pelo link com CPF + nascimento;
//   services/provaOnline.js). Aprovado = presente + horas creditadas + válido a partir da data da aprovação,
//   mesmo com a turma ainda aberta. PDF de apoio pode ser enviado ao QuotaFlow (material_path, bucket privado).
//
// Regras do backend: sem DB.raw; ids com String(); filtros sem null.

const crypto = require('crypto');
const D = require('./documentos');

const MODALIDADES = ['presencial', 'online', 'manual'];
const TIPOS = ['regulatorio', 'desenvolvimento', 'integracao'];
const AVISO_DIAS = 30;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const texto = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const hojeBR = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600000).toISOString().slice(0, 10);
const diasAte = (de, ate) => Math.round((Date.parse(String(ate).slice(0, 10) + 'T00:00:00Z') - Date.parse(de + 'T00:00:00Z')) / 86400000);
function somaMeses(iso, meses) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const alvo = new Date(Date.UTC(y, m - 1 + Number(meses), 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}
const slug = (n) => String(n || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
const validoAte = (turma) => (turma.validade_meses ? somaMeses(turma.data_fim || turma.data, turma.validade_meses) : null);

// ─── catálogo ─────────────────────────────────────────────────────────────
function validarTreinamento(body, opcoes = {}) {
  const { parcial = false } = opcoes;
  const erros = [], out = {};
  const tem = (k) => body[k] !== undefined;
  if (!parcial || tem('nome')) { const n = texto(body.nome, 160); if (!n) erros.push('Informe o nome do treinamento'); else out.nome = n; }
  if (tem('norma')) out.norma = texto(body.norma, 60);
  if (tem('carga_horaria')) {
    const c = body.carga_horaria === '' || body.carga_horaria == null ? null : Number(String(body.carga_horaria).replace(',', '.'));
    if (c !== null && !(c > 0 && c <= 2000)) erros.push('Carga horária inválida'); else out.carga_horaria = c;
  }
  if (tem('validade_meses')) {
    const v = body.validade_meses === '' || body.validade_meses == null ? null : parseInt(body.validade_meses, 10);
    if (v !== null && !(v >= 1 && v <= 240)) erros.push('Validade entre 1 e 240 meses'); else out.validade_meses = v;
  }
  if (tem('conteudo')) out.conteudo = texto(body.conteudo, 8000);
  if (tem('tipo')) { if (!TIPOS.includes(body.tipo)) erros.push('Tipo inválido'); else out.tipo = body.tipo; }
  if (tem('secoes')) { const r = validarSecoes(body.secoes, { prefixos: opcoes.prefixos }); if (r.erro) erros.push(r.erro); else out.secoes = r.secoes; }
  if (tem('prova')) { const r = validarProva(body.prova); if (r.erro) erros.push(r.erro); else out.prova = r.prova; }
  return { erros, dados: out };
}

// ─── conteúdo e prova (12e.2a) ────────────────────────────────────────────
const URL_OK = /^https:\/\/[^\s]+$/i;
const MATERIAL_PATH = /^(tenant-\d+|biblioteca)\/trein-material\/[\w.-]+\.pdf$/;
function validarSecoes(lista, { prefixos = null } = {}) {
  if (lista == null) return { secoes: [] };
  if (!Array.isArray(lista)) return { erro: 'Conteúdo inválido' };
  if (lista.length > 40) return { erro: 'No máximo 40 seções' };
  const secoes = [];
  for (const [i, x] of lista.entries()) {
    const sec = { titulo: texto(x?.titulo, 160), texto: texto(x?.texto, 20000), video_url: texto(x?.video_url, 500), material_url: texto(x?.material_url, 500),
      material_path: texto(x?.material_path, 300), material_nome: texto(x?.material_nome, 200) };
    if (sec.material_path && (!MATERIAL_PATH.test(sec.material_path) || (prefixos && !prefixos.some((pf) => sec.material_path.startsWith(pf))))) return { erro: `Seção ${i + 1}: PDF enviado inválido` };
    if (!sec.material_path) sec.material_nome = null;
    if (!sec.titulo) return { erro: `Seção ${i + 1}: informe o título` };
    if (sec.video_url && !URL_OK.test(sec.video_url)) return { erro: `Seção ${i + 1}: o link do vídeo precisa começar com https://` };
    if (sec.material_url && !URL_OK.test(sec.material_url)) return { erro: `Seção ${i + 1}: o link do material precisa começar com https://` };
    secoes.push(sec);
  }
  return { secoes };
}
function validarProva(p) {
  if (p == null || p === '' || (Array.isArray(p?.perguntas) && !p.perguntas.length)) return { prova: null };
  if (typeof p !== 'object' || !Array.isArray(p.perguntas)) return { erro: 'Prova inválida' };
  if (p.perguntas.length > 50) return { erro: 'No máximo 50 perguntas' };
  const nota = p.nota_minima === undefined || p.nota_minima === '' ? 70 : Number(p.nota_minima);
  if (!(nota >= 1 && nota <= 100)) return { erro: 'Nota mínima entre 1 e 100 (%)' };
  const tent = p.tentativas_max === undefined || p.tentativas_max === '' ? 3 : parseInt(p.tentativas_max, 10);
  if (!(tent >= 1 && tent <= 5)) return { erro: 'Tentativas entre 1 e 5' };
  const perguntas = [];
  for (const [i, q0] of p.perguntas.entries()) {
    const enunciado = texto(q0?.enunciado, 1000);
    const alts = (Array.isArray(q0?.alternativas) ? q0.alternativas : []).map((a) => texto(a, 400)).filter(Boolean);
    const correta = parseInt(q0?.correta, 10);
    if (!enunciado) return { erro: `Pergunta ${i + 1}: informe o enunciado` };
    if (alts.length < 2 || alts.length > 6) return { erro: `Pergunta ${i + 1}: de 2 a 6 alternativas` };
    if (!(correta >= 0 && correta < alts.length)) return { erro: `Pergunta ${i + 1}: marque a alternativa correta` };
    perguntas.push({ enunciado, alternativas: alts, correta });
  }
  return { prova: { nota_minima: nota, tentativas_max: tent, perguntas } };
}
/** Corrige uma prova: respostas = [índice por pergunta] → { acertos, total, nota (%), aprovado } (usado na 12e.2b) */
function corrigirProva(prova, respostas) {
  const ps = prova?.perguntas || [];
  const acertos = ps.filter((x, i) => Number((respostas || [])[i]) === x.correta).length;
  const nota = ps.length ? Math.round((acertos / ps.length) * 1000) / 10 : 0;
  return { acertos, total: ps.length, nota, aprovado: nota >= Number(prova?.nota_minima || 70) };
}
/** Prova sem o gabarito (o que o colaborador vê) */
const provaSemGabarito = (prova) => (prova ? { nota_minima: prova.nota_minima, tentativas_max: prova.tentativas_max, perguntas: prova.perguntas.map((x) => ({ enunciado: x.enunciado, alternativas: x.alternativas })) } : null);

/** 12e.2b: PDF de apoio enviado ao QuotaFlow (bucket privado). prefixo = 'tenant-{id}' ou 'biblioteca' */
async function subirMaterial(supabase, prefixo, { base64, nome }) {
  if (!['biblioteca'].includes(prefixo) && !/^tenant-\d+$/.test(prefixo)) return { status: 400, erro: 'Destino inválido' };
  const msg = D.validarArquivo({ base64, mime: 'application/pdf', nome }); if (msg) return { status: 400, erro: msg };
  const buffer = Buffer.from(String(base64), 'base64');
  if (buffer.slice(0, 4).toString() !== '%PDF') return { status: 400, erro: 'O arquivo não é um PDF' };
  const path = `${prefixo}/trein-material/${Date.now()}-${crypto.randomBytes(5).toString('hex')}.pdf`;
  const { error } = await supabase.storage.from(D.BUCKET).upload(path, buffer, { contentType: 'application/pdf', upsert: false });
  if (error) throw new Error(`Falha ao subir o PDF: ${error.message}`);
  return { material_path: path, material_nome: texto(nome, 200) || 'material.pdf' };
}
/** Link (1 h) de um PDF de apoio — só caminhos permitidos */
async function linkMaterialGestor(supabase, path, prefixos) {
  if (!MATERIAL_PATH.test(String(path || '')) || !prefixos.some((pf) => String(path).startsWith(pf))) return { status: 404, erro: 'Material não encontrado' };
  return { url: await D.linkArquivo(supabase, path) };
}

// ─── biblioteca do QuotaFlow (tenant_id NULL) ─────────────────────────────
const CAMPOS_CONTEUDO = ['nome', 'norma', 'carga_horaria', 'validade_meses', 'conteudo', 'tipo', 'secoes', 'prova'];
async function bibliotecaTodos(supabase) {
  return (await q(supabase.from('treinamentos').select('*').is('tenant_id', null))).sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
}
const resumoModelo = (m) => ({ ...m, secoes_qtd: (m.secoes || []).length, perguntas_qtd: m.prova?.perguntas?.length || 0, videos_qtd: (m.secoes || []).filter((x) => x.video_url).length });
async function bibliotecaConsole(supabase) { return { modelos: (await bibliotecaTodos(supabase)).map(resumoModelo), tipos: TIPOS }; }

async function criarModelo(supabase, body) {
  const { erros, dados } = validarTreinamento(body || {}, { prefixos: ['biblioteca/'] });
  if (erros.length) return { status: 400, erro: erros[0] };
  const todos = await bibliotecaTodos(supabase);
  if (todos.some((t) => t.nome.toLowerCase() === dados.nome.toLowerCase())) return { status: 409, erro: 'Já existe um modelo com esse nome' };
  let codigo = texto(body.codigo, 40) ? slug(body.codigo) : slug(dados.nome) || 'treinamento';
  if (todos.some((t) => t.codigo === codigo)) return { status: 409, erro: `Código "${codigo}" já existe na biblioteca` };
  const { data, error } = await supabase.from('treinamentos').insert([{ ...dados, tenant_id: null, codigo, versao: 1 }]).select();
  if (error) throw new Error(error.message);
  return { modelo: data[0] };
}
async function editarModelo(supabase, id, body) {
  if (!/^\d+$/.test(String(id))) return { status: 404, erro: 'Modelo não encontrado' };
  const m = (await q(supabase.from('treinamentos').select('*').is('tenant_id', null).eq('id', id)))[0];
  if (!m) return { status: 404, erro: 'Modelo não encontrado' };
  const { erros, dados } = validarTreinamento(body || {}, { parcial: true, prefixos: ['biblioteca/'] });
  if (erros.length) return { status: 400, erro: erros[0] };
  const mudou = CAMPOS_CONTEUDO.some((k) => dados[k] !== undefined && JSON.stringify(dados[k]) !== JSON.stringify(m[k] ?? null));
  if (body.ativo !== undefined) dados.ativo = body.ativo !== false;
  const { data, error } = await supabase.from('treinamentos').update({ ...dados, versao: mudou ? (m.versao || 1) + 1 : m.versao, atualizado_em: new Date().toISOString() }).eq('id', m.id).is('tenant_id', null).select();
  if (error) throw new Error(error.message);
  return { modelo: data[0], versao_subiu: mudou };
}
async function desativarModelo(supabase, id) { return editarModelo(supabase, id, { ativo: false }); }

/** O que a empresa vê na biblioteca (com o que já importou e se há versão nova) */
async function bibliotecaParaTenant(supabase, tenantId) {
  const meus = await q(supabase.from('treinamentos').select('*').eq('tenant_id', tenantId));
  const por = new Map(meus.filter((t) => t.origem_id != null && t.ativo !== false).map((t) => [String(t.origem_id), t]));
  return (await bibliotecaTodos(supabase)).filter((m) => m.ativo !== false).map((m) => {
    const meu = por.get(String(m.id));
    return { ...resumoModelo(m), prova: m.prova ? { nota_minima: m.prova.nota_minima, tentativas_max: m.prova.tentativas_max } : null, ja_importado: !!meu, meu_id: meu?.id || null, versao_nova: !!meu && Number(m.versao) > Number(meu.origem_versao || 0) };
  });
}
async function importar(supabase, tenantId, bibliotecaId) {
  if (!/^\d+$/.test(String(bibliotecaId || ''))) return { status: 400, erro: 'Escolha o modelo' };
  const m = (await q(supabase.from('treinamentos').select('*').is('tenant_id', null).eq('id', bibliotecaId)))[0];
  if (!m || m.ativo === false) return { status: 404, erro: 'Modelo não encontrado' };
  const meus = await q(supabase.from('treinamentos').select('*').eq('tenant_id', tenantId));
  if (meus.some((t) => String(t.origem_id) === String(m.id) && t.ativo !== false)) return { status: 409, erro: 'Esse treinamento já foi importado' };
  // mesmo código já em uso? (ex.: criado à mão antes) → reaproveita o código só se estiver livre
  const reativar = meus.find((t) => t.codigo === m.codigo);
  const copia = Object.fromEntries(CAMPOS_CONTEUDO.map((k) => [k, m[k] ?? null]));
  copia.secoes = m.secoes || [];
  if (reativar) {
    const { data, error } = await supabase.from('treinamentos').update({ ...copia, origem_id: m.id, origem_versao: m.versao, ativo: true, atualizado_em: new Date().toISOString() }).eq('id', reativar.id).eq('tenant_id', tenantId).select();
    if (error) throw new Error(error.message);
    return { treinamento: data[0], reaproveitado: true };
  }
  const { data, error } = await supabase.from('treinamentos').insert([{ ...copia, tenant_id: tenantId, codigo: m.codigo, origem_id: m.id, origem_versao: m.versao }]).select();
  if (error) throw new Error(error.message);
  return { treinamento: data[0] };
}
/** Traz a versão nova da biblioteca (sobrescreve conteúdo/prova; o código e o histórico de turmas ficam) */
async function atualizarDaBiblioteca(supabase, tenantId, id) {
  if (!/^\d+$/.test(String(id))) return { status: 404, erro: 'Treinamento não encontrado' };
  const t = (await q(supabase.from('treinamentos').select('*').eq('tenant_id', tenantId).eq('id', id)))[0];
  if (!t || t.origem_id == null) return { status: 404, erro: 'Treinamento não veio da biblioteca' };
  const m = (await q(supabase.from('treinamentos').select('*').is('tenant_id', null).eq('id', t.origem_id)))[0];
  if (!m) return { status: 404, erro: 'O modelo saiu da biblioteca' };
  const copia = Object.fromEntries(CAMPOS_CONTEUDO.map((k) => [k, m[k] ?? null]));
  copia.secoes = m.secoes || [];
  const { data, error } = await supabase.from('treinamentos').update({ ...copia, origem_versao: m.versao, atualizado_em: new Date().toISOString() }).eq('id', t.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return { treinamento: data[0] };
}

async function catalogo(supabase, tenantId) {
  const l = (await q(supabase.from('treinamentos').select('*').eq('tenant_id', tenantId))).filter((t) => t.ativo !== false);
  let versoes = new Map(); // 12e.2a: "✨ versão nova" para o que veio da biblioteca
  if (l.some((t) => t.origem_id != null)) versoes = new Map((await bibliotecaTodos(supabase)).map((m) => [String(m.id), Number(m.versao || 1)]));
  return l.map((t) => ({ ...t, versao_nova: t.origem_id != null && (versoes.get(String(t.origem_id)) || 0) > Number(t.origem_versao || 0) }))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
}

async function criarTreinamento(supabase, tenantId, body) {
  const { erros, dados } = validarTreinamento(body || {}, { prefixos: [`tenant-${tenantId}/`, 'biblioteca/'] });
  if (erros.length) return { status: 400, erro: erros[0] };
  const existentes = await q(supabase.from('treinamentos').select('*').eq('tenant_id', tenantId));
  if (existentes.some((t) => t.ativo !== false && t.nome.toLowerCase() === dados.nome.toLowerCase())) return { status: 409, erro: 'Já existe um treinamento com esse nome' };
  let codigo = slug(dados.nome) || 'treinamento';
  if (existentes.some((t) => t.codigo === codigo)) codigo = `${codigo.slice(0, 34)}_${Date.now().toString(36).slice(-5)}`;
  const { data, error } = await supabase.from('treinamentos').insert([{ ...dados, tenant_id: tenantId, codigo }]).select();
  if (error) throw new Error(error.message);
  return { treinamento: data[0] };
}

// ─── turmas ───────────────────────────────────────────────────────────────
function validarTurma(body) {
  const erros = [], out = {};
  if (!body.treinamento_id) erros.push('Escolha o treinamento');
  if (!DATA.test(String(body.data || ''))) erros.push('Informe a data');
  else out.data = body.data;
  if (body.data_fim) { if (!DATA.test(String(body.data_fim)) || body.data_fim < body.data) erros.push('Data final inválida'); else out.data_fim = body.data_fim; }
  out.modalidade = MODALIDADES.includes(body.modalidade) ? body.modalidade : 'presencial';
  if (body.carga_horaria !== undefined && body.carga_horaria !== '' && body.carga_horaria != null) {
    const c = Number(String(body.carga_horaria).replace(',', '.'));
    if (!(c > 0 && c <= 2000)) erros.push('Carga horária inválida'); else out.carga_horaria = c;
  }
  out.instrutor = texto(body.instrutor, 160);
  out.local = texto(body.local, 160);
  out.obs = texto(body.obs, 2000);
  return { erros, dados: out };
}

async function turmaDoTenant(supabase, tenantId, id) {
  if (!/^\d+$/.test(String(id))) return null;
  return (await q(supabase.from('treinamento_turmas').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] || null;
}

async function subirEvidencia(supabase, tenantId, turmaId, { base64, mime }) {
  const buffer = Buffer.from(String(base64), 'base64');
  const path = `tenant-${tenantId}/trein-${turmaId}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${D.MIME_OK[mime]}`;
  const { error } = await supabase.storage.from(D.BUCKET).upload(path, buffer, { contentType: mime, upsert: false });
  if (error) throw new Error(`Falha ao subir a evidência: ${error.message}`);
  return path;
}

/**
 * Cria turma (ou registro manual). body: { treinamento_id, data, data_fim?, modalidade, carga_horaria?, instrutor?, local?, obs?,
 *   participantes: [colaborador_id], evidencia_base64?, evidencia_mime?, evidencia_nome? }
 */
async function criarTurma(supabase, tenantId, usuarioId, body) {
  const { erros, dados } = validarTurma(body || {});
  if (erros.length) return { status: 400, erro: erros[0] };
  const t = (await q(supabase.from('treinamentos').select('*').eq('id', body.treinamento_id)))[0];
  if (!t || (t.tenant_id != null && String(t.tenant_id) !== String(tenantId)) || t.ativo === false) return { status: 400, erro: 'Treinamento não encontrado' };
  const ids = [...new Set((Array.isArray(body.participantes) ? body.participantes : []).map(String))];
  const colabs = ids.length ? await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId).in('id', ids)) : [];
  if (colabs.length !== ids.length) return { status: 400, erro: 'Colaborador não encontrado' };
  if (colabs.some((c) => c.situacao === 'desligado')) return { status: 400, erro: 'Colaborador desligado não entra em turma' };
  const manual = dados.modalidade === 'manual';
  if (manual) {
    if (!colabs.length) return { status: 400, erro: 'Escolha quem participou' };
    if (!body.evidencia_base64) return { status: 400, erro: 'Anexe a evidência (lista de presença, certificado…)' };
    const msg = D.validarArquivo({ base64: body.evidencia_base64, mime: body.evidencia_mime }); if (msg) return { status: 400, erro: msg };
    if (dados.data > hojeBR()) return { status: 400, erro: 'Registro manual é de treinamento já realizado (data até hoje)' };
  }
  const { data, error } = await supabase.from('treinamento_turmas').insert([{
    ...dados, tenant_id: tenantId, treinamento_id: t.id, treinamento_nome: t.nome, validade_meses: t.validade_meses || null,
    carga_horaria: dados.carga_horaria ?? t.carga_horaria ?? null, status: manual ? 'concluida' : 'agendada',
    concluida_em: manual ? new Date().toISOString() : null, criado_por: usuarioId || null,
  }]).select();
  if (error) throw new Error(error.message);
  let turma = data[0];
  try {
    if (manual) {
      const path = await subirEvidencia(supabase, tenantId, turma.id, { base64: body.evidencia_base64, mime: body.evidencia_mime });
      const r = await supabase.from('treinamento_turmas').update({ evidencia_path: path, evidencia_nome: texto(body.evidencia_nome, 200) || 'evidencia', evidencia_mime: body.evidencia_mime }).eq('id', turma.id).eq('tenant_id', tenantId).select();
      if (r.error) throw new Error(r.error.message);
      turma = r.data[0];
    }
    if (colabs.length) {
      const va = manual ? validoAte(turma) : null;
      const { error: e2 } = await supabase.from('treinamento_participacoes').insert(colabs.map((c) => ({
        tenant_id: tenantId, turma_id: turma.id, colaborador_id: c.id, presente: manual, valido_ate: va,
        obs: manual ? 'Registro manual (evidência anexa à turma)' : null,
      })));
      if (e2) throw new Error(e2.message);
    }
  } catch (e) {
    if (turma.evidencia_path) await D.removerArquivo(supabase, turma.evidencia_path);
    await supabase.from('treinamento_turmas').delete().eq('id', turma.id).eq('tenant_id', tenantId);
    throw e;
  }
  return { turma };
}

async function participantes(supabase, tenantId, turmaId, { comAssinatura = false } = {}) {
  const ps = await q(supabase.from('treinamento_participacoes').select('*').eq('tenant_id', tenantId).eq('turma_id', turmaId));
  const colabs = ps.length ? await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId).in('id', ps.map((p) => p.colaborador_id))) : [];
  const por = new Map(colabs.map((c) => [String(c.id), c]));
  return ps.map((p) => {
    const c = por.get(String(p.colaborador_id)) || {};
    return { ...p, assinatura_png: comAssinatura ? p.assinatura_png : undefined, assinou: !!p.assinatura_png, nome: c.nome || '—', cpf: c.cpf || null, funcao: c.funcao || null };
  }).sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
}

async function adicionarParticipantes(supabase, tenantId, turma, ids) {
  if (turma.status !== 'agendada') return { status: 400, erro: 'A turma já foi fechada' };
  const lista = [...new Set((ids || []).map(String))];
  const colabs = lista.length ? await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId).in('id', lista)) : [];
  if (colabs.length !== lista.length || colabs.some((c) => c.situacao === 'desligado')) return { status: 400, erro: 'Colaborador inválido' };
  const ja = new Set((await q(supabase.from('treinamento_participacoes').select('*').eq('tenant_id', tenantId).eq('turma_id', turma.id))).map((p) => String(p.colaborador_id)));
  const novos = colabs.filter((c) => !ja.has(String(c.id)));
  if (novos.length) {
    const { error } = await supabase.from('treinamento_participacoes').insert(novos.map((c) => ({ tenant_id: tenantId, turma_id: turma.id, colaborador_id: c.id })));
    if (error) throw new Error(error.message);
  }
  return { adicionados: novos.length };
}

async function removerParticipante(supabase, tenantId, turma, colaboradorId) {
  if (turma.status !== 'agendada') return { status: 400, erro: 'A turma já foi fechada' };
  const p = (await q(supabase.from('treinamento_participacoes').select('*').eq('tenant_id', tenantId).eq('turma_id', turma.id).eq('colaborador_id', colaboradorId)))[0];
  if (!p) return { status: 404, erro: 'Participante não encontrado' };
  if (p.assinatura_png) return { status: 400, erro: 'Já assinou a presença — não dá para tirar da lista' };
  await supabase.from('treinamento_participacoes').delete().eq('id', p.id).eq('tenant_id', tenantId);
  return { ok: true };
}

/** Assinatura da lista de presença (colaborador assina na tela) */
async function assinarPresenca(supabase, tenantId, turma, colaboradorId, png, agora = new Date()) {
  if (turma.status === 'cancelada') return { status: 400, erro: 'Turma cancelada' };
  if (turma.modalidade === 'manual') return { status: 400, erro: 'Registro manual não tem lista para assinar (a evidência é o anexo)' };
  if (typeof png !== 'string' || !png.startsWith('data:image/png;base64,') || png.length < 200) return { status: 400, erro: 'Falta a assinatura' };
  if (png.length > 400 * 1024) return { status: 400, erro: 'Assinatura muito grande' };
  const p = (await q(supabase.from('treinamento_participacoes').select('*').eq('tenant_id', tenantId).eq('turma_id', turma.id).eq('colaborador_id', colaboradorId)))[0];
  if (!p) return { status: 404, erro: 'Colaborador não está nesta turma' };
  if (p.assinatura_png) return { status: 400, erro: 'Já assinou' };
  const hash = crypto.createHash('sha256').update(JSON.stringify({ turma: String(turma.id), colaborador: String(colaboradorId), treinamento: turma.treinamento_nome, data: turma.data, em: agora.toISOString() }) + png).digest('hex');
  const { data, error } = await supabase.from('treinamento_participacoes').update({
    presente: true, assinatura_png: png, assinatura_hash: hash, assinado_em: agora.toISOString(),
    valido_ate: turma.status === 'concluida' ? validoAte(turma) : null,
  }).eq('id', p.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return { participacao: { ...data[0], assinatura_png: undefined } };
}

/** Concluir: grava a validade de quem assinou; quem não assinou fica como faltou */
async function concluirTurma(supabase, tenantId, turma) {
  if (turma.status !== 'agendada') return { status: 400, erro: 'A turma não está agendada' };
  const ps = await q(supabase.from('treinamento_participacoes').select('*').eq('tenant_id', tenantId).eq('turma_id', turma.id));
  if (!ps.some((p) => p.presente)) return { status: 400, erro: turma.modalidade === 'online' ? 'Ninguém concluiu ainda (assinatura ou prova)' : 'Ninguém assinou a presença ainda' };
  const r = await supabase.from('treinamento_turmas').update({ status: 'concluida', concluida_em: new Date().toISOString() }).eq('id', turma.id).eq('tenant_id', tenantId).select();
  if (r.error) throw new Error(r.error.message);
  const va = validoAte(turma);
  for (const p of ps.filter((x) => x.presente && !(turma.modalidade === 'online' && x.valido_ate))) await supabase.from('treinamento_participacoes').update({ valido_ate: va }).eq('id', p.id).eq('tenant_id', tenantId);
  return { turma: r.data[0], presentes: ps.filter((p) => p.presente).length, faltaram: ps.filter((p) => !p.presente).length };
}

async function listarTurmas(supabase, tenantId) {
  const ts = await q(supabase.from('treinamento_turmas').select('*').eq('tenant_id', tenantId));
  const ps = await q(supabase.from('treinamento_participacoes').select('*').eq('tenant_id', tenantId));
  return ts.map((t) => {
    const meus = ps.filter((p) => String(p.turma_id) === String(t.id));
    return { ...t, participantes: meus.length, presentes: meus.filter((p) => p.presente).length, tem_evidencia: !!t.evidencia_path };
  }).sort((a, b) => String(b.data).localeCompare(String(a.data)) || Number(b.id) - Number(a.id));
}

// ─── horas creditadas (12e.2a) ────────────────────────────────────────────
/** Horas que a participação credita: p.horas (gravada — ex.: prova online) ou a carga da turma, se presente
 *  numa turma concluída (sem reprovação). Turma cancelada/agendada ou falta = 0. */
const contaFeito = (p, t) => !!t && !!p.presente && p.aprovado !== false
  && (t.status === 'concluida' || (t.modalidade === 'online' && t.status !== 'cancelada'));
const dataFeito = (p, t) => (t.modalidade === 'online' && p.assinado_em ? hojeBR(new Date(p.assinado_em)) : String(t.data_fim || t.data).slice(0, 10));
function horasDe(p, t) {
  if (!contaFeito(p, t)) return 0;
  if (p.horas != null) return Number(p.horas) || 0;
  return Number(t.carga_horaria) || 0;
}
const arred = (n) => Math.round(n * 10) / 10;
/** Horas por colaborador no período [de, ate] (data da turma), com quebra por tipo do treinamento */
function horasPorColaborador(base, { de, ate } = {}) {
  const turmaPor = new Map(base.turmas.map((t) => [String(t.id), t]));
  const tipoPor = new Map(base.treinos.map((t) => [String(t.id), t.tipo || 'regulatorio']));
  const out = new Map();
  for (const p of base.parts) {
    const t = turmaPor.get(String(p.turma_id));
    const h = horasDe(p, t);
    if (!h) continue;
    const d = dataFeito(p, t);
    if ((de && d < de) || (ate && d > ate)) continue;
    const k = String(p.colaborador_id);
    const r = out.get(k) || { total: 0, treinamentos: 0, por_tipo: Object.fromEntries(TIPOS.map((x) => [x, 0])) };
    const tipo = tipoPor.get(String(t.treinamento_id)) || 'regulatorio';
    r.total = arred(r.total + h); r.treinamentos++; r.por_tipo[tipo] = arred((r.por_tipo[tipo] || 0) + h);
    out.set(k, r);
  }
  return out;
}
const vazioHoras = () => ({ total: 0, treinamentos: 0, por_tipo: Object.fromEntries(TIPOS.map((x) => [x, 0])) });
/** Relatório de horas: período (padrão = ano corrente), por colaborador + totais da empresa */
async function relatorioHoras(supabase, tenantId, { de, ate, agora } = {}) {
  const hoje = hojeBR(agora);
  const ini = DATA.test(String(de || '')) ? de : `${hoje.slice(0, 4)}-01-01`;
  const fim = DATA.test(String(ate || '')) ? ate : `${hoje.slice(0, 4)}-12-31`;
  if (fim < ini) return { status: 400, erro: 'Período inválido' };
  const base = await carregarBase(supabase, tenantId);
  const mapa = horasPorColaborador(base, { de: ini, ate: fim });
  const ativos = base.colabs.filter((c) => c.situacao !== 'desligado' || mapa.has(String(c.id)));
  const linhas = ativos.map((c) => ({ id: c.id, nome: c.nome, funcao_nome: c.funcao || null, situacao: c.situacao, ...(mapa.get(String(c.id)) || vazioHoras()) }))
    .sort((a, b) => b.total - a.total || String(a.nome).localeCompare(String(b.nome)));
  const tot = vazioHoras();
  for (const l of linhas) { tot.total = arred(tot.total + l.total); tot.treinamentos += l.treinamentos; for (const k of TIPOS) tot.por_tipo[k] = arred(tot.por_tipo[k] + (l.por_tipo[k] || 0)); }
  const nAtivos = base.colabs.filter((c) => c.situacao !== 'desligado').length;
  return { de: ini, ate: fim, colaboradores: linhas, totais: { ...tot, colaboradores_ativos: nAtivos, media_por_colaborador: nAtivos ? arred(tot.total / nAtivos) : 0 } };
}

// ─── situação por colaborador (pilar 🎓) ─────────────────────────────────
async function carregarBase(supabase, tenantId) {
  const [colabs, funcoes, treinos, turmas, parts] = await Promise.all([
    q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId)),
    q(supabase.from('funcoes').select('*').eq('tenant_id', tenantId)),
    q(supabase.from('treinamentos').select('*').eq('tenant_id', tenantId)),
    q(supabase.from('treinamento_turmas').select('*').eq('tenant_id', tenantId)),
    q(supabase.from('treinamento_participacoes').select('*').eq('tenant_id', tenantId)),
  ]);
  return { colabs, funcoes, treinos, turmas, parts };
}

function statusColaborador(colab, base, hoje = hojeBR()) {
  const funcao = colab.funcao_id != null ? base.funcoes.find((f) => String(f.id) === String(colab.funcao_id)) : null;
  const exigidos = Array.isArray(funcao?.treinamentos) ? funcao.treinamentos : [];
  const turmaPor = new Map(base.turmas.map((t) => [String(t.id), t]));
  const meus = base.parts.filter((p) => String(p.colaborador_id) === String(colab.id));
  const itens = exigidos.map((e) => {
    const tr = base.treinos.find((t) => t.codigo === e.codigo);
    const doTipo = meus.map((p) => ({ p, t: turmaPor.get(String(p.turma_id)) })).filter(({ t }) => t && t.status !== 'cancelada' && tr && String(t.treinamento_id) === String(tr.id));
    const feitos = doTipo.filter(({ p, t }) => contaFeito(p, t))
      .sort((a, b) => dataFeito(b.p, b.t).localeCompare(dataFeito(a.p, a.t)));
    const agendada = doTipo.filter(({ p, t }) => t.status === 'agendada' && !contaFeito(p, t) && (String(t.data) >= hoje || t.modalidade === 'online')).sort((a, b) => String(a.t.data).localeCompare(String(b.t.data)))[0];
    const ult = feitos[0];
    let situacao = 'falta', dias = null, valido_ate = null;
    if (ult) {
      valido_ate = ult.p.valido_ate || (ult.t.validade_meses ? validoAte(ult.t) : null);
      if (!valido_ate) situacao = 'ok';
      else { dias = diasAte(hoje, valido_ate); situacao = dias < 0 ? 'vencido' : dias <= AVISO_DIAS ? 'vence' : 'ok'; }
    }
    if ((situacao === 'falta' || situacao === 'vencido') && agendada) situacao = situacao === 'vencido' ? 'vencido' : 'agendado';
    return {
      codigo: e.codigo, nome: tr?.nome || e.codigo, existe: !!tr, situacao, dias, valido_ate,
      ultimo: ult ? { turma_id: ult.t.id, data: dataFeito(ult.p, ult.t), modalidade: ult.t.modalidade, instrutor: ult.t.instrutor } : null,
      agendado: agendada ? { turma_id: agendada.t.id, data: agendada.t.data } : null,
    };
  });
  const r = { total: itens.length, ok: 0, vence: 0, vencido: 0, agendado: 0, falta: 0 };
  for (const i of itens) r[i.situacao]++;
  return { funcao: funcao ? { id: funcao.id, nome: funcao.nome } : null, itens, resumo: r };
}

async function painel(supabase, tenantId, { agora } = {}) {
  const base = await carregarBase(supabase, tenantId);
  const hoje = hojeBR(agora);
  const horas = horasPorColaborador(base, { de: `${hoje.slice(0, 4)}-01-01`, ate: `${hoje.slice(0, 4)}-12-31` }); // 12e.2a
  return base.colabs.filter((c) => c.situacao !== 'desligado').map((c) => ({ id: c.id, nome: c.nome, funcao_nome: c.funcao || null, funcao_id: c.funcao_id, ...statusColaborador(c, base, hoje), horas_ano: horas.get(String(c.id))?.total || 0 }))
    .sort((a, b) => (b.resumo.vencido - a.resumo.vencido) || (b.resumo.falta - a.resumo.falta) || String(a.nome).localeCompare(String(b.nome)));
}

/** Histórico de treinamentos de um colaborador (todas as participações) */
async function historico(supabase, tenantId, colaboradorId) {
  const ps = await q(supabase.from('treinamento_participacoes').select('*').eq('tenant_id', tenantId).eq('colaborador_id', colaboradorId));
  const ts = ps.length ? await q(supabase.from('treinamento_turmas').select('*').eq('tenant_id', tenantId).in('id', ps.map((p) => p.turma_id))) : [];
  const por = new Map(ts.map((t) => [String(t.id), t]));
  return ps.map((p) => { const t = por.get(String(p.turma_id)) || {}; return { id: p.id, turma_id: p.turma_id, treinamento: t.treinamento_nome, data: t.data ? dataFeito(p, t) : t.data, modalidade: t.modalidade, status: t.status, instrutor: t.instrutor, carga_horaria: t.carga_horaria, presente: p.presente, assinou: !!p.assinatura_png, valido_ate: p.valido_ate, aprovado: p.aprovado, nota: p.nota, horas: horasDe(p, t) }; })
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));
}
/** ⏱ resumo de horas de um colaborador: ano corrente, últimos 12 meses e total da vida */
function resumoHoras(historicoLista, hoje = hojeBR()) {
  const ano = hoje.slice(0, 4), ha12 = somaMeses(hoje, -12);
  const soma = (f) => arred(historicoLista.filter(f).reduce((s, x) => s + (x.horas || 0), 0));
  return { ano: soma((x) => String(x.data).slice(0, 4) === ano), ultimos_12m: soma((x) => String(x.data) >= ha12), total: soma(() => true) };
}

/** Calendário (camada 🎓): turmas agendadas e vencimentos no intervalo */
async function eventosNoIntervalo(supabase, tenantId, de, ate, { agora } = {}) {
  const hoje = hojeBR(agora);
  const dentro = (d) => d && String(d).slice(0, 10) >= de && String(d).slice(0, 10) <= ate;
  const base = await carregarBase(supabase, tenantId);
  const out = [];
  for (const t of base.turmas.filter((x) => x.status === 'agendada' && dentro(x.data))) {
    const n = base.parts.filter((p) => String(p.turma_id) === String(t.id)).length;
    out.push({ id: `turma-${t.id}`, tipo: 'turma', data: String(t.data).slice(0, 10), dias: diasAte(hoje, t.data), situacao: 'agendada', titulo: `Turma: ${t.treinamento_nome}`, de: `${n} participante(s)${t.instrutor ? ` · ${t.instrutor}` : ''}` });
  }
  const ativos = new Map(base.colabs.filter((c) => c.situacao !== 'desligado').map((c) => [String(c.id), c]));
  for (const c of ativos.values()) {
    for (const i of statusColaborador(c, base, hoje).itens.filter((x) => x.valido_ate && dentro(x.valido_ate))) {
      out.push({ id: `trein-${c.id}-${i.codigo}`, tipo: 'vencimento', data: String(i.valido_ate).slice(0, 10), dias: i.dias, situacao: i.situacao === 'vencido' ? 'vencido' : i.situacao === 'vence' ? 'vence' : 'ok', titulo: `Vence: ${i.nome}`, de: c.nome });
    }
  }
  return out.sort((a, b) => a.data.localeCompare(b.data));
}

module.exports = {
  MODALIDADES, TIPOS, AVISO_DIAS, validoAte, somaMeses,
  validarTreinamento, catalogo, criarTreinamento,
  validarTurma, turmaDoTenant, criarTurma, participantes, adicionarParticipantes, removerParticipante, assinarPresenca, concluirTurma, listarTurmas,
  carregarBase, statusColaborador, painel, historico, eventosNoIntervalo, hojeBR,
  // 12e.2a
  validarSecoes, validarProva, corrigirProva, provaSemGabarito,
  bibliotecaConsole, criarModelo, editarModelo, desativarModelo, bibliotecaParaTenant, importar, atualizarDaBiblioteca,
  horasDe, horasPorColaborador, relatorioHoras, resumoHoras,
  contaFeito, dataFeito, MATERIAL_PATH, subirMaterial, linkMaterialGestor, // 12e.2b
};
