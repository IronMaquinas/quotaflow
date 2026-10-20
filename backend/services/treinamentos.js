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
// Prova online (biblioteca do QuotaFlow, colaborador logado / link) chega na 12e.2.
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
function validarTreinamento(body, { parcial = false } = {}) {
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
  return { erros, dados: out };
}

async function catalogo(supabase, tenantId) {
  const l = (await q(supabase.from('treinamentos').select('*').eq('tenant_id', tenantId))).filter((t) => t.ativo !== false);
  return l.sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
}

async function criarTreinamento(supabase, tenantId, body) {
  const { erros, dados } = validarTreinamento(body || {});
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
  if (!ps.some((p) => p.presente)) return { status: 400, erro: 'Ninguém assinou a presença ainda' };
  const r = await supabase.from('treinamento_turmas').update({ status: 'concluida', concluida_em: new Date().toISOString() }).eq('id', turma.id).eq('tenant_id', tenantId).select();
  if (r.error) throw new Error(r.error.message);
  const va = validoAte(turma);
  for (const p of ps.filter((x) => x.presente)) await supabase.from('treinamento_participacoes').update({ valido_ate: va }).eq('id', p.id).eq('tenant_id', tenantId);
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
    const feitos = doTipo.filter(({ p, t }) => t.status === 'concluida' && p.presente && p.aprovado !== false)
      .sort((a, b) => String(b.t.data).localeCompare(String(a.t.data)));
    const agendada = doTipo.filter(({ t }) => t.status === 'agendada' && String(t.data) >= hoje).sort((a, b) => String(a.t.data).localeCompare(String(b.t.data)))[0];
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
      ultimo: ult ? { turma_id: ult.t.id, data: ult.t.data, modalidade: ult.t.modalidade, instrutor: ult.t.instrutor } : null,
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
  return base.colabs.filter((c) => c.situacao !== 'desligado').map((c) => ({ id: c.id, nome: c.nome, funcao_nome: c.funcao || null, funcao_id: c.funcao_id, ...statusColaborador(c, base, hoje) }))
    .sort((a, b) => (b.resumo.vencido - a.resumo.vencido) || (b.resumo.falta - a.resumo.falta) || String(a.nome).localeCompare(String(b.nome)));
}

/** Histórico de treinamentos de um colaborador (todas as participações) */
async function historico(supabase, tenantId, colaboradorId) {
  const ps = await q(supabase.from('treinamento_participacoes').select('*').eq('tenant_id', tenantId).eq('colaborador_id', colaboradorId));
  const ts = ps.length ? await q(supabase.from('treinamento_turmas').select('*').eq('tenant_id', tenantId).in('id', ps.map((p) => p.turma_id))) : [];
  const por = new Map(ts.map((t) => [String(t.id), t]));
  return ps.map((p) => { const t = por.get(String(p.turma_id)) || {}; return { id: p.id, turma_id: p.turma_id, treinamento: t.treinamento_nome, data: t.data, modalidade: t.modalidade, status: t.status, instrutor: t.instrutor, carga_horaria: t.carga_horaria, presente: p.presente, assinou: !!p.assinatura_png, valido_ate: p.valido_ate }; })
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));
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
};
