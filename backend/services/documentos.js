// services/documentos.js — etapa 12c: colaboradores e documentos com vencimento
//
// Documento = pessoa (colaborador), equipamento ou empresa + tipo (CNH, CRLV, alvará…)
// + vencimento + arquivo anexo (bucket privado "documentos", só por link assinado).
// Renovar = cadastrar o documento novo, que substitui o anterior (o anterior fica no
// histórico com substituido_por; não aparece mais como "a vencer").
//
// Situação (calculada, nunca gravada): vencido · vence_30 (até 30 dias) · ok · sem_vencimento.
// Regras do backend: sem DB.raw; ids com String(); filtros sem null.

const BUCKET = 'documentos';
const TTL = 60 * 60; // link do arquivo vale 1 hora
const ALVOS = ['colaborador', 'equipamento', 'empresa'];
const SITUACOES_COLAB = ['ativo', 'afastado', 'desligado'];
const MIME_OK = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const LIMITE_BYTES = 10 * 1024 * 1024;

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, '0');
function hojeBR(agora = new Date()) {
  const l = new Date(agora.getTime() - 3 * 3600000);
  return `${l.getUTCFullYear()}-${pad(l.getUTCMonth() + 1)}-${pad(l.getUTCDate())}`;
}
function diasEntre(de, ate) {
  const a = Date.UTC(...de.split('-').map((n, i) => (i === 1 ? n - 1 : +n)));
  const b = Date.UTC(...ate.split('-').map((n, i) => (i === 1 ? n - 1 : +n)));
  return Math.round((b - a) / 86400000);
}

/** vencido | vence_30 | ok | sem_vencimento — e quantos dias faltam */
function situacaoDocumento(doc, agora = new Date()) {
  if (!doc.vence_em) return { situacao: 'sem_vencimento', dias: null };
  const dias = diasEntre(hojeBR(agora), String(doc.vence_em).slice(0, 10));
  if (dias < 0) return { situacao: 'vencido', dias };
  if (dias <= 30) return { situacao: 'vence_30', dias };
  return { situacao: 'ok', dias };
}

const soDigitos = (s) => String(s || '').replace(/\D/g, '');
function cpfValido(c) {
  const d = soDigitos(c);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  for (const t of [9, 10]) {
    let s = 0;
    for (let i = 0; i < t; i++) s += +d[i] * (t + 1 - i);
    if (((s * 10) % 11) % 10 !== +d[t]) return false;
  }
  return true;
}

function validarColaborador(body, { parcial = false } = {}) {
  const erros = [], out = {};
  const tem = (k) => body[k] !== undefined;
  if (!parcial || tem('nome')) {
    const n = String(body.nome || '').trim();
    if (!n) erros.push('Informe o nome'); else out.nome = n.slice(0, 200);
  }
  if (tem('cpf')) {
    const c = soDigitos(body.cpf);
    if (c && !cpfValido(c)) erros.push('CPF inválido'); else out.cpf = c || null;
  }
  if (tem('funcao')) out.funcao = body.funcao ? String(body.funcao).trim().slice(0, 120) : null;
  if (tem('admissao')) {
    if (body.admissao && !DATA.test(String(body.admissao))) erros.push('Data de admissão inválida'); else out.admissao = body.admissao || null;
  }
  if (tem('data_nascimento')) { // 12e.2a — 2º fator do link da prova e aniversariantes
    const d = body.data_nascimento;
    if (d && (!DATA.test(String(d)) || String(d) > new Date().toISOString().slice(0, 10) || String(d) < '1900-01-01')) erros.push('Data de nascimento inválida'); else out.data_nascimento = d || null;
  }
  if (tem('situacao')) {
    if (!SITUACOES_COLAB.includes(body.situacao)) erros.push('Situação inválida'); else out.situacao = body.situacao;
  }
  if (tem('telefone')) out.telefone = body.telefone ? String(body.telefone).trim().slice(0, 30) : null;
  if (tem('email')) {
    const e = String(body.email || '').trim();
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) erros.push('E-mail inválido'); else out.email = e || null;
  }
  if (tem('usuario_id')) out.usuario_id = body.usuario_id || null;
  for (const k of ['tam_calcado', 'tam_camisa', 'tam_calca', 'tam_luva']) if (tem(k)) out[k] = body[k] ? String(body[k]).trim().slice(0, 10) : null; // 12d.1b
  if (tem('funcao_id')) out.funcao_id = body.funcao_id && /^\d+$/.test(String(body.funcao_id)) ? String(body.funcao_id) : null; // 12d.0
  if (tem('obs')) out.obs = body.obs ? String(body.obs).slice(0, 2000) : null;
  return { erros, dados: out };
}

function validarDocumento(body, { parcial = false } = {}) {
  const erros = [], out = {};
  const tem = (k) => body[k] !== undefined;
  if (!parcial) {
    if (!ALVOS.includes(body.alvo_tipo)) erros.push('Escolha: pessoa, equipamento ou empresa');
    else out.alvo_tipo = body.alvo_tipo;
    if (out.alvo_tipo === 'colaborador' && !body.colaborador_id) erros.push('Escolha o colaborador');
    if (out.alvo_tipo === 'equipamento' && !body.equipamento_id) erros.push('Escolha o equipamento');
    out.colaborador_id = out.alvo_tipo === 'colaborador' ? body.colaborador_id : null;
    out.equipamento_id = out.alvo_tipo === 'equipamento' ? body.equipamento_id : null;
    if (!body.tipo_id && !String(body.tipo_nome || '').trim()) erros.push('Escolha o tipo de documento');
  }
  if (tem('tipo_id')) out.tipo_id = body.tipo_id || null;
  if (tem('tipo_nome')) out.tipo_nome = String(body.tipo_nome || '').trim().slice(0, 120) || undefined;
  if (tem('numero')) out.numero = body.numero ? String(body.numero).trim().slice(0, 80) : null;
  for (const k of ['emitido_em', 'vence_em']) {
    if (tem(k)) { if (body[k] && !DATA.test(String(body[k]))) erros.push('Data inválida'); else out[k] = body[k] || null; }
  }
  if (out.emitido_em && out.vence_em && out.vence_em < out.emitido_em) erros.push('O vencimento não pode ser antes da emissão');
  if (tem('responsavel_id')) out.responsavel_id = body.responsavel_id || null;
  if (tem('obs')) out.obs = body.obs ? String(body.obs).slice(0, 2000) : null;
  return { erros, dados: out };
}

// ─── Arquivo (bucket privado) ────────────────────────────────────────────
function validarArquivo({ base64, mime, nome }) {
  if (!base64) return 'Arquivo vazio';
  const ext = MIME_OK[mime] || null;
  if (!ext) return 'Envie PDF, JPG, PNG ou WEBP';
  const bytes = Math.floor((String(base64).length * 3) / 4);
  if (bytes > LIMITE_BYTES) return 'Arquivo maior que 10 MB';
  return null;
}

async function subirArquivo(supabase, { tenantId, documentoId, base64, mime }) {
  const buffer = Buffer.from(String(base64), 'base64');
  // horário + sufixo aleatório: dois envios no mesmo milissegundo nunca colidem
  const path = `tenant-${tenantId}/doc-${documentoId}/${Date.now()}-${require('crypto').randomBytes(4).toString('hex')}.${MIME_OK[mime]}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: mime, upsert: false });
  if (error) throw new Error(`Falha ao subir arquivo: ${error.message}`);
  return path;
}

async function linkArquivo(supabase, path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, TTL, { download: false });
  if (error) throw new Error(`Falha ao gerar link: ${error.message}`);
  return data?.signedUrl || null;
}

async function removerArquivo(supabase, path) {
  if (!path) return;
  try { await supabase.storage.from(BUCKET).remove([path]); } catch (_) { /* não bloqueia */ }
}

// ─── Leitura ─────────────────────────────────────────────────────────────
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }

/** Tipos visíveis ao tenant: os do sistema (tenant_id NULL) + os dele; o do tenant com o mesmo código substitui o do sistema */
async function tiposDoTenant(supabase, tenantId) {
  const todos = await q(supabase.from('documento_tipos').select('*'));
  const visiveis = todos.filter((t) => t.ativo !== false && (t.tenant_id == null || String(t.tenant_id) === String(tenantId)));
  const porChave = new Map();
  for (const t of visiveis.sort((a, b) => (a.tenant_id == null ? 0 : 1) - (b.tenant_id == null ? 0 : 1))) porChave.set(`${t.alvo}|${t.codigo}`, t);
  return [...porChave.values()].sort((a, b) => a.alvo.localeCompare(b.alvo) || (a.ordem - b.ordem) || a.nome.localeCompare(b.nome));
}

/** Documentos do tenant enriquecidos (nome do alvo, situação). Sem os substituídos, salvo historico=true. */
async function listarDocumentos(supabase, tenantId, { alvoTipo, colaboradorId, equipamentoId, historico = false, agora } = {}) {
  let base = supabase.from('documentos').select('*').eq('tenant_id', tenantId);
  if (alvoTipo) base = base.eq('alvo_tipo', alvoTipo);
  if (colaboradorId) base = base.eq('colaborador_id', colaboradorId);
  if (equipamentoId) base = base.eq('equipamento_id', equipamentoId);
  let docs = await q(base);
  if (!historico) docs = docs.filter((d) => !d.substituido_por);

  const colIds = [...new Set(docs.map((d) => d.colaborador_id).filter(Boolean))];
  const eqIds = [...new Set(docs.map((d) => d.equipamento_id).filter(Boolean))];
  const cols = colIds.length ? await q(supabase.from('colaboradores').select('id, nome, situacao').eq('tenant_id', tenantId).in('id', colIds)) : [];
  const eqs = eqIds.length ? await q(supabase.from('equipamentos').select('id, tag, nome').eq('tenant_id', tenantId).in('id', eqIds)) : [];
  const colPor = new Map(cols.map((c) => [String(c.id), c]));
  const eqPor = new Map(eqs.map((e) => [String(e.id), `${e.tag ? e.tag + ' - ' : ''}${e.nome || ''}`]));

  return docs.map((d) => {
    const s = situacaoDocumento(d, agora);
    const col = colPor.get(String(d.colaborador_id));
    return {
      ...d,
      alvo_nome: d.alvo_tipo === 'colaborador' ? (col?.nome || 'Colaborador') : d.alvo_tipo === 'equipamento' ? (eqPor.get(String(d.equipamento_id)) || 'Equipamento') : 'Empresa',
      colaborador_desligado: col?.situacao === 'desligado',
      situacao: s.situacao, dias: s.dias, tem_arquivo: !!d.arquivo_path,
    };
  }).sort((a, b) => String(a.vence_em || '9999').localeCompare(String(b.vence_em || '9999')) || a.alvo_nome.localeCompare(b.alvo_nome));
}

function resumo(docs) {
  const r = { vencido: 0, vence_30: 0, ok: 0, sem_vencimento: 0, total: docs.length };
  for (const d of docs) if (!d.colaborador_desligado) r[d.situacao]++;
  return r;
}

/** Para o calendário: documentos vigentes que vencem entre de e ate (colaborador desligado não entra) */
async function documentosNoIntervalo(supabase, tenantId, de, ate, opcoes = {}) {
  const docs = await listarDocumentos(supabase, tenantId, opcoes);
  return docs.filter((d) => d.vence_em && !d.colaborador_desligado && String(d.vence_em).slice(0, 10) >= de && String(d.vence_em).slice(0, 10) <= ate);
}

module.exports = {
  ALVOS, SITUACOES_COLAB, MIME_OK, BUCKET,
  situacaoDocumento, cpfValido, soDigitos, validarColaborador, validarDocumento, validarArquivo,
  subirArquivo, linkArquivo, removerArquivo, tiposDoTenant, listarDocumentos, resumo, documentosNoIntervalo, hojeBR,
};
