// backend/services/provaOnline.js — etapa 12e.2b
//
// Prova ONLINE de treinamento — o mesmo fluxo para os dois meios:
//   • 'logado' — colaborador com usuário de perfil "colaborador" (colaboradores.usuario_id) em "🎓 Meus treinamentos";
//   • 'link'   — link externo da turma (treinamento_turmas.link_token), identificação por CPF + data de nascimento.
// Regras:
//   • só turma online, não cancelada nem concluída, e só quem está na lista de participantes;
//   • tentativas = prova.tentativas_max + participação.tentativas_extra (o instrutor "libera" depois de esgotar);
//   • cada tentativa grava respostas, cópia da prova, nota, meio, IP e um hash (prova legal = "assinatura do exame");
//   • aprovado → participação presente + aprovado + nota + horas (carga da turma) + válido até (data da aprovação + validade);
//   • treinamento sem prova → "Concluí o conteúdo" (declaração) conta como presença.
// O gabarito NUNCA sai daqui para o colaborador.

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const TR = require('./treinamentos');
const D = require('./documentos');

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const soDigitos = (v) => String(v || '').replace(/\D/g, '');
const SEGREDO = () => `${process.env.JWT_SECRET || 'dev'}:prova-online`; // segredo DIFERENTE: não vale como login do sistema

// ─── sessão do link externo ──────────────────────────────────────────────
function gerarSessao({ tenantId, colaboradorId, turmaId }) {
  return jwt.sign({ k: 'prova', t: String(tenantId), c: String(colaboradorId), tu: String(turmaId) }, SEGREDO(), { expiresIn: '3h' });
}
function lerSessao(token) {
  try { const d = jwt.verify(String(token || ''), SEGREDO()); return d.k === 'prova' ? { tenantId: d.t, colaboradorId: d.c, turmaId: d.tu } : null; }
  catch { return null; }
}

async function turmaPorLink(supabase, token) {
  if (!/^[a-f0-9]{32,64}$/.test(String(token || ''))) return null;
  let t = (await q(supabase.from('treinamento_turmas').select('*').eq('link_token', token)))[0];
  if (t && TR.prazoVencido(t)) { await TR.fecharOnlineVencidas(supabase, t.tenant_id, [t]); t = (await q(supabase.from('treinamento_turmas').select('*').eq('id', t.id)))[0]; } // 12e.2d
  return t && (t.link_ativo || t.status === 'concluida') ? t : null; // encerrada: o link ainda abre (certificado), mas não aceita prova
}

/** Link externo: CPF + nascimento têm de bater com um participante da turma */
async function identificar(supabase, token, { cpf, nascimento }) {
  const turma = await turmaPorLink(supabase, token);
  if (!turma) return { status: 404, erro: 'Link inválido ou desativado. Peça um novo ao responsável pelo treinamento.' };
  const c = soDigitos(cpf); // 12e.2d: turma encerrada ainda deixa entrar (ver resultado e baixar o certificado)
  if (c.length !== 11 || !/^\d{4}-\d{2}-\d{2}$/.test(String(nascimento || ''))) return { status: 400, erro: 'Informe o CPF e a data de nascimento.' };
  const ps = await q(supabase.from('treinamento_participacoes').select('*').eq('tenant_id', turma.tenant_id).eq('turma_id', turma.id));
  const colabs = ps.length ? await q(supabase.from('colaboradores').select('*').eq('tenant_id', turma.tenant_id).in('id', ps.map((p) => p.colaborador_id))) : [];
  const col = colabs.find((x) => soDigitos(x.cpf) === c && x.data_nascimento && String(x.data_nascimento).slice(0, 10) === nascimento && x.situacao !== 'desligado');
  if (!col) return { status: 401, erro: 'CPF e data de nascimento não conferem com os participantes desta turma.' };
  return { sessao: gerarSessao({ tenantId: turma.tenant_id, colaboradorId: col.id, turmaId: turma.id }), nome: col.nome };
}

async function infoLink(supabase, token) {
  const turma = await turmaPorLink(supabase, token);
  if (!turma) return { status: 404, erro: 'Link inválido ou desativado.' };
  const emp = (await q(supabase.from('tenants').select('*').eq('id', turma.tenant_id)))[0] || {};
  return { treinamento: turma.treinamento_nome, empresa: emp.nome_fantasia || emp.nome || emp.razao_social || 'Empresa', encerrada: turma.status !== 'agendada', prazo: turma.data_fim || null };
}

// ─── colaborador logado ──────────────────────────────────────────────────
async function colaboradorDoUsuario(supabase, tenantId, usuarioId) {
  if (!usuarioId) return null;
  return (await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId).eq('usuario_id', usuarioId)))[0] || null;
}

// ─── núcleo ──────────────────────────────────────────────────────────────
async function contexto(supabase, tenantId, colaboradorId, turmaId) {
  if (!/^\d+$/.test(String(turmaId || ''))) return { status: 404, erro: 'Turma não encontrada' };
  let turma = await TR.turmaDoTenant(supabase, tenantId, turmaId);
  if (turma && TR.prazoVencido(turma)) { await TR.fecharOnlineVencidas(supabase, tenantId, [turma]); turma = await TR.turmaDoTenant(supabase, tenantId, turmaId); } // 12e.2d
  if (!turma || turma.modalidade !== 'online' || turma.status === 'cancelada') return { status: 404, erro: 'Treinamento online não encontrado' };
  const p = (await q(supabase.from('treinamento_participacoes').select('*').eq('tenant_id', tenantId).eq('turma_id', turma.id).eq('colaborador_id', colaboradorId)))[0];
  if (!p) return { status: 403, erro: 'Você não está nesta turma' };
  const tr = turma.treinamento_id ? (await q(supabase.from('treinamentos').select('*').eq('id', turma.treinamento_id)))[0] : null;
  const tents = (await q(supabase.from('treinamento_tentativas').select('*').eq('tenant_id', tenantId).eq('participacao_id', p.id))).sort((a, b) => a.numero - b.numero);
  const prova = tr?.prova?.perguntas?.length ? tr.prova : null;
  const max = prova ? Number(prova.tentativas_max || 3) + Number(p.tentativas_extra || 0) : 0;
  return { turma, p, tr, tents, prova, max };
}

function resumo(ctx) {
  const { turma, p, tr, tents, prova, max } = ctx;
  const aprovado = p.presente && p.aprovado !== false;
  const usadas = tents.length;
  return {
    turma_id: turma.id, treinamento: turma.treinamento_nome, norma: tr?.norma || null, tipo: tr?.tipo || null,
    carga_horaria: turma.carga_horaria, data: turma.data, prazo: turma.modalidade === 'online' ? turma.data_fim || null : null, validade_meses: turma.validade_meses, encerrada: turma.status !== 'agendada',
    tem_prova: !!prova, nota_minima: prova?.nota_minima ?? null, perguntas: prova?.perguntas?.length || 0,
    tentativas_usadas: usadas, tentativas_max: max, restantes: Math.max(0, max - usadas),
    concluido: aprovado, nota: p.nota, valido_ate: p.valido_ate, concluido_em: p.assinado_em,
    situacao: aprovado ? 'aprovado' : prova && usadas >= max ? 'esgotou' : usadas ? 'reprovado' : 'pendente',
    tentativas: tents.map((x) => ({ numero: x.numero, nota: Number(x.nota), aprovado: x.aprovado, em: x.criado_em, meio: x.meio })),
  };
}

/** Lista "Meus treinamentos": turmas online abertas + histórico do colaborador */
async function meusTreinamentos(supabase, tenantId, colaboradorId) {
  const ps = await q(supabase.from('treinamento_participacoes').select('*').eq('tenant_id', tenantId).eq('colaborador_id', colaboradorId));
  const turmas = ps.length ? await q(supabase.from('treinamento_turmas').select('*').eq('tenant_id', tenantId).in('id', ps.map((p) => p.turma_id))) : [];
  const online = [];
  for (const t of turmas.filter((x) => x.modalidade === 'online' && x.status !== 'cancelada')) {
    const ctx = await contexto(supabase, tenantId, colaboradorId, t.id);
    if (!ctx.erro) online.push(resumo(ctx));
  }
  const historico = await TR.historico(supabase, tenantId, colaboradorId);
  return {
    pendentes: online.filter((x) => !x.concluido && !x.encerrada).sort((a, b) => String(a.data).localeCompare(String(b.data))),
    historico: historico.filter((h) => h.horas > 0 || (h.presente && h.status === 'concluida')),
    horas: TR.resumoHoras(historico),
  };
}

/** Conteúdo da aula + prova SEM gabarito */
async function abrir(supabase, tenantId, colaboradorId, turmaId) {
  const ctx = await contexto(supabase, tenantId, colaboradorId, turmaId);
  if (ctx.erro) return ctx;
  const secoes = (ctx.tr?.secoes || []).map((x, i) => ({ indice: i, titulo: x.titulo, texto: x.texto, video_url: x.video_url, material_url: x.material_url, tem_pdf: !!x.material_path, material_nome: x.material_nome }));
  return { ...resumo(ctx), conteudo: ctx.tr?.conteudo || null, secoes, prova: ctx.prova && !resumo(ctx).concluido ? TR.provaSemGabarito(ctx.prova) : null };
}

async function linkMaterial(supabase, tenantId, colaboradorId, turmaId, indice) {
  const ctx = await contexto(supabase, tenantId, colaboradorId, turmaId);
  if (ctx.erro) return ctx;
  const sec = (ctx.tr?.secoes || [])[Number(indice)];
  if (!sec?.material_path) return { status: 404, erro: 'Material não encontrado' };
  return { url: await D.linkArquivo(supabase, sec.material_path), nome: sec.material_nome || 'material.pdf' };
}

async function marcarConcluido(supabase, tenantId, ctx, { nota = null, hash, agora = new Date() }) {
  const va = ctx.turma.validade_meses ? TR.somaMeses(TR.hojeBR(agora), ctx.turma.validade_meses) : null;
  const { error } = await supabase.from('treinamento_participacoes').update({
    presente: true, aprovado: nota == null ? null : true, nota, horas: Number(ctx.turma.carga_horaria) || 0,
    assinado_em: agora.toISOString(), assinatura_hash: hash, valido_ate: va,
  }).eq('id', ctx.p.id).eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
}

/** Envia uma tentativa. respostas = [índice da alternativa por pergunta] */
async function enviarProva(supabase, tenantId, colaboradorId, turmaId, { respostas, meio, usuarioId = null, ip = null, agora = new Date() }) {
  const ctx = await contexto(supabase, tenantId, colaboradorId, turmaId);
  if (ctx.erro) return ctx;
  if (ctx.turma.status !== 'agendada') return { status: 400, erro: 'Esta turma já foi encerrada' };
  if (!ctx.prova) return { status: 400, erro: 'Este treinamento não tem prova' };
  if (ctx.p.presente && ctx.p.aprovado !== false) return { status: 400, erro: 'Você já foi aprovado neste treinamento' };
  if (ctx.tents.length >= ctx.max) return { status: 400, erro: 'Tentativas esgotadas — peça ao responsável para liberar de novo' };
  const n = ctx.prova.perguntas.length;
  if (!Array.isArray(respostas) || respostas.length !== n || respostas.some((r) => !Number.isInteger(Number(r)) || Number(r) < 0)) return { status: 400, erro: 'Responda todas as perguntas' };
  const resp = respostas.map(Number);
  const r = TR.corrigirProva(ctx.prova, resp);
  const numero = ctx.tents.length + 1;
  const hash = crypto.createHash('sha256').update(JSON.stringify({ turma: String(ctx.turma.id), colaborador: String(colaboradorId), numero, resp, nota: r.nota, meio, em: agora.toISOString() })).digest('hex');
  const { error } = await supabase.from('treinamento_tentativas').insert([{
    tenant_id: tenantId, participacao_id: ctx.p.id, turma_id: ctx.turma.id, colaborador_id: colaboradorId, numero,
    respostas: resp, prova: ctx.prova, acertos: r.acertos, total: r.total, nota: r.nota, aprovado: r.aprovado,
    meio: meio === 'link' ? 'link' : 'logado', usuario_id: usuarioId || null, ip: ip ? String(ip).slice(0, 60) : null, hash, criado_em: agora.toISOString(),
  }]);
  if (error) { if (/treinamento_tentativas_numero_unico/.test(error.message)) return { status: 409, erro: 'Tentativa enviada duas vezes — recarregue a página' }; throw new Error(error.message); }
  if (r.aprovado) { await marcarConcluido(supabase, tenantId, ctx, { nota: r.nota, hash, agora }); await TR.fecharSeTodosConcluiram(supabase, tenantId, ctx.turma); } // 12e.2d
  else if (ctx.p.nota == null || r.nota > Number(ctx.p.nota)) await supabase.from('treinamento_participacoes').update({ nota: r.nota }).eq('id', ctx.p.id).eq('tenant_id', tenantId);
  const restantes = Math.max(0, ctx.max - numero);
  return { nota: r.nota, acertos: r.acertos, total: r.total, aprovado: r.aprovado, nota_minima: ctx.prova.nota_minima, restantes, numero };
}

/** Treinamento online sem prova: "Concluí o conteúdo" */
async function concluirSemProva(supabase, tenantId, colaboradorId, turmaId, { meio, agora = new Date() } = {}) {
  const ctx = await contexto(supabase, tenantId, colaboradorId, turmaId);
  if (ctx.erro) return ctx;
  if (ctx.turma.status !== 'agendada') return { status: 400, erro: 'Esta turma já foi encerrada' };
  if (ctx.prova) return { status: 400, erro: 'Este treinamento tem prova — faça a prova para concluir' };
  if (ctx.p.presente) return { status: 400, erro: 'Já concluído' };
  const hash = crypto.createHash('sha256').update(JSON.stringify({ turma: String(ctx.turma.id), colaborador: String(colaboradorId), declaracao: 'conclui_conteudo', meio, em: agora.toISOString() })).digest('hex');
  await marcarConcluido(supabase, tenantId, ctx, { hash, agora });
  await TR.fecharSeTodosConcluiram(supabase, tenantId, ctx.turma); // 12e.2d
  return { ok: true };
}

/** Instrutor libera um novo ciclo de tentativas para quem esgotou */
async function liberarTentativas(supabase, tenantId, turma, colaboradorId) {
  const ctx = await contexto(supabase, tenantId, colaboradorId, turma.id);
  if (ctx.erro) return ctx;
  if (!ctx.prova) return { status: 400, erro: 'Treinamento sem prova' };
  if (ctx.p.presente && ctx.p.aprovado !== false) return { status: 400, erro: 'Já foi aprovado' };
  if (ctx.tents.length < ctx.max) return { status: 400, erro: 'Ainda tem tentativas' };
  const extra = Number(ctx.p.tentativas_extra || 0) + Number(ctx.prova.tentativas_max || 3);
  const { error } = await supabase.from('treinamento_participacoes').update({ tentativas_extra: extra }).eq('id', ctx.p.id).eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  return { ok: true, restantes: Number(ctx.prova.tentativas_max || 3) };
}

/** Situação da prova por participante (tela da turma, para o instrutor) */
async function situacaoTurma(supabase, tenantId, turma) {
  if (turma.modalidade !== 'online') return {};
  const tr = turma.treinamento_id ? (await q(supabase.from('treinamentos').select('*').eq('id', turma.treinamento_id)))[0] : null;
  const prova = tr?.prova?.perguntas?.length ? tr.prova : null;
  const ps = await q(supabase.from('treinamento_participacoes').select('*').eq('tenant_id', tenantId).eq('turma_id', turma.id));
  const tents = await q(supabase.from('treinamento_tentativas').select('*').eq('tenant_id', tenantId).eq('turma_id', turma.id));
  const out = {};
  for (const p of ps) {
    const meus = tents.filter((x) => String(x.participacao_id) === String(p.id));
    const max = prova ? Number(prova.tentativas_max || 3) + Number(p.tentativas_extra || 0) : 0;
    out[String(p.colaborador_id)] = { usadas: meus.length, max, melhor: meus.length ? Math.max(...meus.map((x) => Number(x.nota))) : null, esgotou: !!prova && meus.length >= max && !p.presente, meio: meus.length ? meus[meus.length - 1].meio : null };
  }
  return { tem_prova: !!prova, nota_minima: prova?.nota_minima ?? null, por_colaborador: out };
}

/** Gera/reativa o link externo da turma */
async function gerarLink(supabase, tenantId, turma, { ativo = true } = {}) {
  if (turma.modalidade !== 'online') return { status: 400, erro: 'Link de prova só para turma online' };
  if (turma.status !== 'agendada') return { status: 400, erro: 'A turma já foi fechada' };
  const token = turma.link_token || crypto.randomBytes(24).toString('hex');
  const { data, error } = await supabase.from('treinamento_turmas').update({ link_token: token, link_ativo: !!ativo }).eq('id', turma.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return { link_token: data[0].link_token, link_ativo: data[0].link_ativo };
}

module.exports = {
  gerarSessao, lerSessao, turmaPorLink, identificar, infoLink, colaboradorDoUsuario,
  meusTreinamentos, abrir, linkMaterial, enviarProva, concluirSemProva, liberarTentativas, situacaoTurma, gerarLink,
};

// ─── 12e.2c: certificado e comprovante da avaliação ──────────────────────
async function dadosEmpresa(supabase, tenantId) {
  const emp = (await q(supabase.from('tenants').select('*').eq('id', tenantId)))[0] || {};
  return { nome: emp.nome_fantasia || emp.nome || emp.razao_social || 'Empresa', razao_social: emp.razao_social || emp.nome || null, cnpj: emp.cnpj || null };
}
const mascarar = (cpf) => (cpf ? `***.***.***-${String(cpf).slice(-2)}` : null);

/** Dados do certificado — só para quem concluiu (presente e não reprovado; turma concluída ou online aprovada) */
async function certificado(supabase, tenantId, turmaId, colaboradorId, { cpfCompleto = true } = {}) {
  if (!/^\d+$/.test(String(turmaId || '')) || !/^\d+$/.test(String(colaboradorId || ''))) return { status: 404, erro: 'Não encontrado' };
  const turma = await TR.turmaDoTenant(supabase, tenantId, turmaId);
  if (!turma) return { status: 404, erro: 'Turma não encontrada' };
  const p = (await q(supabase.from('treinamento_participacoes').select('*').eq('tenant_id', tenantId).eq('turma_id', turma.id).eq('colaborador_id', colaboradorId)))[0];
  if (!p || !TR.contaFeito(p, turma)) return { status: 400, erro: 'Certificado só para quem concluiu o treinamento' };
  const col = (await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId).eq('id', colaboradorId)))[0] || {};
  const tr = turma.treinamento_id ? (await q(supabase.from('treinamentos').select('*').eq('id', turma.treinamento_id)))[0] : null;
  const concluido = TR.dataFeito(p, turma);
  const valido = p.valido_ate || (turma.validade_meses ? TR.somaMeses(concluido, turma.validade_meses) : null);
  const codigo = crypto.createHash('sha256').update(JSON.stringify({ t: String(tenantId), tu: String(turma.id), c: String(colaboradorId), h: p.assinatura_hash || null, concluido, valido })).digest('hex').slice(0, 16).toUpperCase();
  return {
    empresa: await dadosEmpresa(supabase, tenantId),
    colaborador: { nome: col.nome, cpf: cpfCompleto ? col.cpf : mascarar(col.cpf), funcao: col.funcao || null },
    treinamento: { nome: turma.treinamento_nome, norma: tr?.norma || null, tipo: tr?.tipo || null, conteudo: tr?.conteudo || null, secoes: (tr?.secoes || []).map((x) => x.titulo) },
    turma: { id: turma.id, data: turma.data, data_fim: turma.data_fim, modalidade: turma.modalidade, instrutor: turma.instrutor, local: turma.local, carga_horaria: turma.carga_horaria },
    concluido_em: concluido, nota: p.nota != null ? Number(p.nota) : null, valido_ate: valido, horas: TR.horasDe(p, turma),
    codigo: `${codigo.slice(0, 4)}-${codigo.slice(4, 8)}-${codigo.slice(8, 12)}-${codigo.slice(12, 16)}`, gerado_em: new Date().toISOString(),
  };
}

/** Comprovante da avaliação (com gabarito) — só para o gestor */
async function avaliacao(supabase, tenantId, turmaId, colaboradorId, { cpfCompleto = true } = {}) {
  if (!/^\d+$/.test(String(turmaId || '')) || !/^\d+$/.test(String(colaboradorId || ''))) return { status: 404, erro: 'Não encontrado' };
  const turma = await TR.turmaDoTenant(supabase, tenantId, turmaId);
  if (!turma) return { status: 404, erro: 'Turma não encontrada' };
  const p = (await q(supabase.from('treinamento_participacoes').select('*').eq('tenant_id', tenantId).eq('turma_id', turma.id).eq('colaborador_id', colaboradorId)))[0];
  if (!p) return { status: 404, erro: 'Colaborador não está nesta turma' };
  const tents = (await q(supabase.from('treinamento_tentativas').select('*').eq('tenant_id', tenantId).eq('participacao_id', p.id))).sort((a, b) => a.numero - b.numero);
  if (!tents.length) return { status: 404, erro: 'Nenhuma tentativa de prova' };
  const col = (await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId).eq('id', colaboradorId)))[0] || {};
  return {
    empresa: await dadosEmpresa(supabase, tenantId),
    colaborador: { nome: col.nome, cpf: cpfCompleto ? col.cpf : mascarar(col.cpf), funcao: col.funcao || null },
    turma: { id: turma.id, treinamento_nome: turma.treinamento_nome, data: turma.data, instrutor: turma.instrutor, carga_horaria: turma.carga_horaria },
    situacao: p.presente && p.aprovado !== false ? 'aprovado' : 'nao_aprovado', tentativas_extra: Number(p.tentativas_extra || 0),
    tentativas: tents.map((x) => ({
      numero: x.numero, em: x.criado_em, meio: x.meio, ip: x.ip, nota: Number(x.nota), acertos: x.acertos, total: x.total, aprovado: x.aprovado, hash: x.hash,
      nota_minima: x.prova?.nota_minima,
      perguntas: (x.prova?.perguntas || []).map((pq, i) => ({ enunciado: pq.enunciado, alternativas: pq.alternativas, correta: pq.correta, marcada: (x.respostas || [])[i] })),
    })),
    gerado_em: new Date().toISOString(),
  };
}

module.exports.certificado = certificado;
module.exports.avaliacao = avaliacao;
