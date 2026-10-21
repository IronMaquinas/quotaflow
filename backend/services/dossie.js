// backend/services/dossie.js — etapa 12f
//
// Dossiê do colaborador — junta, num só documento para imprimir/PDF, tudo o que o QuotaFlow sabe da pessoa
// num período (ano, intervalo ou todo o histórico): dados, histórico de funções e descritivo atual, selo,
// documentos, entregas de EPI (com assinatura), treinamentos (horas, notas, certificados, tentativas) e a
// EVOLUÇÃO das competências (nota a nota). Uso: auditoria ISO, processo trabalhista, pedido do colaborador.
// LGPD: só admin/gestor/qualidade geram; cada geração fica em dossie_registros (quem, quando, período, motivo, IP)
// e o código de verificação sai impresso. Multas entram na 12g.

const crypto = require('crypto');
const D = require('./documentos');
const F = require('./funcoes');
const EE = require('./epiEntregas');
const HF = require('./historicoFuncoes');
const TR = require('./treinamentos');
const K = require('./competencias');
const CF = require('./conformidade');
const MU = require('./multas'); // 12g
const DI = require('./disciplinar'); // 12h

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const SECOES = ['dados', 'funcoes', 'documentos', 'epi', 'treinamentos', 'competencias', 'multas', 'disciplinar']; // 12g: + multas · 12h: + disciplinar
const MOTIVOS = ['auditoria', 'trabalhista', 'colaborador', 'desligamento', 'outro'];
const tenta = async (fn, padrao, re) => { try { return await fn(); } catch (e) { if (re.test(String(e.message))) return padrao; throw e; } };
const dia = (v) => (v ? String(v).slice(0, 10) : null);

/** Período: { de, ate } — de NULL = desde o início */
function periodo({ de, ate, tipo } = {}, hoje = TR.hojeBR()) {
  if (tipo === 'tudo') return { de: null, ate: hoje };
  if (tipo === '12m') return { de: TR.somaMeses(hoje, -12), ate: hoje };
  if (tipo === 'ano') return { de: `${hoje.slice(0, 4)}-01-01`, ate: hoje };
  if (!DATA.test(String(ate || ''))) ate = hoje;
  if (de && !DATA.test(String(de))) de = null;
  if (de && de > ate) return { erro: 'Período inválido' };
  return { de: de || null, ate };
}

async function montar(supabase, tenantId, colab, { de, ate, secoes = SECOES } = {}) {
  const dentro = (d) => { const x = dia(d); return !!x && (!de || x >= de) && x <= ate; };
  const quer = new Set(secoes.filter((s) => SECOES.includes(s)));
  const emp = (await q(supabase.from('tenants').select('*').eq('id', tenantId)))[0] || {};
  const out = {
    empresa: { nome: emp.nome_fantasia || emp.nome || emp.razao_social || 'Empresa', razao_social: emp.razao_social || emp.nome || null, cnpj: emp.cnpj || null },
    colaborador: { id: colab.id, nome: colab.nome, cpf: colab.cpf, funcao: colab.funcao || null, admissao: colab.admissao || null, situacao: colab.situacao,
      data_nascimento: colab.data_nascimento || null, escolaridade: colab.escolaridade || null, cnh_categoria: colab.cnh_categoria || null, telefone: colab.telefone || null, email: colab.email || null },
    periodo: { de, ate }, secoes: [...quer],
  };
  // função atual + selo de hoje (retrato)
  const fichas = await tenta(() => F.fichasDoTenant(supabase, tenantId, [colab]), new Map(), /funcoes/);
  const ficha = fichas.get(String(colab.id));
  out.funcao_atual = ficha?.funcao ? { nome: ficha.funcao.nome, cbo: ficha.funcao.cbo || null, setor: ficha.funcao.setor || null, descritivo: ficha.funcao.descritivo || null, requisitos: ficha.funcao.requisitos || null,
    escolaridade: (F.ESCOLARIDADES.find((e) => e.codigo === ficha.funcao.escolaridade) || {}).nome || null, cnh_categoria: ficha.funcao.cnh_categoria || null,
    riscos: (ficha.funcao.riscos || []).map((r) => (F.RISCOS.find((x) => x.codigo === r) || {}).nome || r) } : null;
  out.colaborador.escolaridade_nome = (F.ESCOLARIDADES.find((e) => e.codigo === colab.escolaridade) || {}).nome || null;
  const baseEpi = await tenta(() => EE.carregarBase(supabase, tenantId), null, /epi_|tam_/);
  const baseTr = await tenta(() => TR.carregarBase(supabase, tenantId), null, /treinamento/);
  const baseK = await tenta(() => K.carregarBase(supabase, tenantId), null, /colaborador_competencias/);
  const stK = baseK ? K.statusColaborador(colab, baseK, F.ESCOLARIDADES) : null;
  out.selo = CF.selo({ funcaoLigada: !!ficha?.funcao, docs: ficha?.resumo, epi: baseEpi ? EE.statusColaborador(colab, baseEpi).resumo : null, trein: baseTr ? TR.statusColaborador(colab, baseTr).resumo : null, comp: stK?.resumo });

  if (quer.has('funcoes')) {
    out.historico_funcoes = (await tenta(() => HF.listar(supabase, tenantId, colab.id), [], /colaborador_funcoes/))
      .filter((h) => !de || !h.fim || dia(h.fim) >= de).filter((h) => dia(h.inicio) == null || dia(h.inicio) <= ate)
      .map((h) => ({ funcao_nome: h.funcao_nome, inicio: h.inicio, fim: h.fim, motivo: h.motivo, obs: h.obs || null }));
  }
  if (quer.has('documentos')) {
    // documentos vigentes + os substituídos que tiveram vigência no período (histórico de renovações)
    const docs = await D.listarDocumentos(supabase, tenantId, { colaboradorId: colab.id, historico: true });
    out.documentos = docs.filter((d) => !d.substituido_por || dentro(d.emitido_em) || dentro(d.vence_em) || dentro(d.criado_em))
      .map((d) => ({ tipo: d.tipo_nome, numero: d.numero, emitido_em: d.emitido_em, vence_em: d.vence_em, situacao: d.substituido_por ? 'substituido' : d.situacao, anexo: d.arquivo_nome || null, obs: d.obs || null }))
      .sort((a, b) => String(a.tipo).localeCompare(String(b.tipo)) || String(b.emitido_em || '').localeCompare(String(a.emitido_em || '')));
  }
  if (quer.has('epi')) {
    const ents = await tenta(() => EE.historico(supabase, tenantId, colab.id, { comAssinatura: true }), [], /epi_/);
    out.epi = ents.filter((e) => dentro(e.entregue_em)).map((e) => ({ numero: e.numero, entregue_em: e.entregue_em, motivo: e.motivo, funcao_nome: e.funcao_nome, entregue_por_nome: e.entregue_por_nome,
      assinatura_png: e.assinatura_png, assinatura_hash: e.assinatura_hash,
      itens: (e.itens || []).map((i) => ({ item_nome: i.item_nome, ca: i.ca, tamanho: i.tamanho, quantidade: i.quantidade, proxima_troca: i.proxima_troca, devolvido_em: i.devolvido_em, devolucao_estado: i.devolucao_estado })) }));
  }
  if (quer.has('treinamentos') && baseTr) {
    const hist = await TR.historico(supabase, tenantId, colab.id);
    const tents = await tenta(() => q(supabase.from('treinamento_tentativas').select('*').eq('tenant_id', tenantId).eq('colaborador_id', colab.id)), [], /treinamento_tentativas/);
    const turmas = new Map(baseTr.turmas.map((t) => [String(t.id), t]));
    const lista = hist.filter((h) => dentro(h.data)).map((h) => {
      const t = turmas.get(String(h.turma_id)) || {};
      const meus = tents.filter((x) => String(x.turma_id) === String(h.turma_id)).sort((a, b) => a.numero - b.numero);
      const p = baseTr.parts.find((x) => String(x.id) === String(h.id)) || {};
      const cod = TR.contaFeito(p, t) ? crypto.createHash('sha256').update(JSON.stringify({ t: String(tenantId), tu: String(h.turma_id), c: String(colab.id), h: p.assinatura_hash || null, concluido: TR.dataFeito(p, t), valido: p.valido_ate || (t.validade_meses ? TR.somaMeses(TR.dataFeito(p, t), t.validade_meses) : null) })).digest('hex').slice(0, 16).toUpperCase() : null;
      return { treinamento: h.treinamento, data: h.data, modalidade: h.modalidade, instrutor: h.instrutor, status: h.status, presente: h.presente, assinou: h.assinou, nota: h.nota, horas: h.horas, valido_ate: h.valido_ate,
        certificado: cod ? `${cod.slice(0, 4)}-${cod.slice(4, 8)}-${cod.slice(8, 12)}-${cod.slice(12, 16)}` : null,
        tentativas: meus.map((x) => ({ numero: x.numero, em: x.criado_em, nota: Number(x.nota), aprovado: x.aprovado, meio: x.meio })) };
    });
    const total = Math.round(lista.reduce((s, x) => s + (x.horas || 0), 0) * 10) / 10;
    out.treinamentos = { lista, horas_periodo: total, situacao_atual: TR.statusColaborador(colab, baseTr).itens.map((i) => ({ nome: i.nome, situacao: i.situacao, valido_ate: i.valido_ate })) };
  }
  if (quer.has('competencias') && baseK) {
    const avals = (await K.historico(supabase, tenantId, colab.id)).filter((a) => dentro(a.avaliado_em)).sort((a, b) => String(a.avaliado_em).localeCompare(String(b.avaliado_em)) || Number(a.id) - Number(b.id));
    const grupos = new Map();
    for (const a of avals) { if (!grupos.has(a.codigo)) grupos.set(a.codigo, { codigo: a.codigo, nome: a.nome, avaliacoes: [] }); grupos.get(a.codigo).avaliacoes.push({ em: a.avaliado_em, nivel: a.nivel, nivel_esperado: a.nivel_esperado, por: a.avaliado_por_nome, obs: a.obs, evidencia: a.evidencia_nome || null, treinamentos: (a.evidencia_treinamentos || []).map((t) => t.nome) }); }
    out.competencias = { atual: stK.itens.map((i) => ({ tipo: i.tipo, nome: i.nome, situacao: i.situacao, exigido: i.exigido || null, atual: i.atual || null, nivel: i.ultima?.nivel ?? null, nivel_esperado: i.nivel_esperado ?? null })), evolucao: [...grupos.values()] };
  }
  if (quer.has('multas')) {
    const l = await tenta(() => MU.listar(supabase, tenantId, { colaboradorId: colab.id }), [], /multas/);
    out.multas = { resumo: MU.resumoColaborador(l), lista: l.filter((m) => dentro(m.data_infracao)).sort((a, b) => String(a.data_infracao).localeCompare(String(b.data_infracao)))
      .map((m) => ({ data: m.data_infracao, hora: m.hora_infracao, veiculo: m.veiculo, auto: m.auto_numero, orgao: m.orgao, infracao: [m.infracao_codigo, m.infracao_descricao].filter(Boolean).join(' — '), gravidade: m.gravidade, pontos: m.pontos, valor: m.valor,
        status: m.status_nome, valor_pago: m.valor_pago, valor_descontado: m.valor_descontado, parcelas: m.parcelas_desconto, aceite: m.tem_aceite ? { em: m.aceite_em, hash: m.aceite_hash } : null, motivo_cancelamento: m.motivo_cancelamento })) };
  }
  if (quer.has('disciplinar')) {
    const l = await tenta(() => DI.listar(supabase, tenantId, { colaboradorId: colab.id }), [], /medidas_disciplinares/);
    out.disciplinar = { resumo: DI.resumoColaborador(l), lista: l.filter((m) => dentro(m.data_aplicacao)).sort((a, b) => String(a.data_aplicacao).localeCompare(String(b.data_aplicacao)))
      .map((m) => ({ data_fato: m.data_fato, data_aplicacao: m.data_aplicacao, tipo: m.tipo_nome, categoria: m.categoria_nome, descricao: m.descricao, dias_suspensao: m.dias_suspensao, suspensao_inicio: m.suspensao_inicio, suspensao_fim: m.suspensao_fim,
        ciencia: m.ciencia, ciencia_em: m.ciencia_em, ciencia_hash: m.ciencia_hash, testemunhas: m.testemunhas.map((t) => (t.cpf ? `${t.nome} (CPF ${String(t.cpf).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')})` : t.nome)), aplicado_por: m.aplicado_por_nome, status: m.status, cancelamento_motivo: m.cancelamento_motivo })) };
  }
  return out;
}

/** Gera (monta + registra). body: { tipo: 'ano'|'12m'|'tudo'|'intervalo', de, ate, secoes, motivo, motivo_obs } */
async function gerar(supabase, tenantId, colab, body = {}, { usuarioId, usuarioNome, ip } = {}) {
  const p = periodo(body);
  if (p.erro) return { status: 400, erro: p.erro };
  const secoes = (Array.isArray(body.secoes) && body.secoes.length ? body.secoes : SECOES).filter((s) => SECOES.includes(s));
  if (!secoes.length) return { status: 400, erro: 'Escolha ao menos uma seção' };
  const motivo = MOTIVOS.includes(body.motivo) ? body.motivo : 'outro';
  const dados = await montar(supabase, tenantId, colab, { ...p, secoes });
  const agora = new Date();
  const h = crypto.createHash('sha256').update(JSON.stringify({ t: String(tenantId), c: String(colab.id), p, secoes, em: agora.toISOString(), r: crypto.randomBytes(4).toString('hex') })).digest('hex').slice(0, 12).toUpperCase();
  const codigo = `DOS-${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`;
  const { error } = await supabase.from('dossie_registros').insert([{ tenant_id: tenantId, colaborador_id: colab.id, codigo, periodo_de: p.de, periodo_ate: p.ate, secoes,
    motivo: [motivo, body.motivo_obs ? String(body.motivo_obs).slice(0, 300) : null].filter(Boolean).join(' — '), gerado_por: usuarioId || null, gerado_por_nome: usuarioNome || null, ip: ip ? String(ip).slice(0, 60) : null, criado_em: agora.toISOString() }]);
  if (error) throw new Error(error.message);
  return { ...dados, codigo, gerado_em: agora.toISOString(), gerado_por_nome: usuarioNome || null, motivo };
}

async function registros(supabase, tenantId, colaboradorId) {
  return (await q(supabase.from('dossie_registros').select('*').eq('tenant_id', tenantId).eq('colaborador_id', colaboradorId)))
    .sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)))
    .map((r) => ({ id: r.id, codigo: r.codigo, periodo_de: r.periodo_de, periodo_ate: r.periodo_ate, secoes: r.secoes, motivo: r.motivo, gerado_por_nome: r.gerado_por_nome, criado_em: r.criado_em }));
}

module.exports = { SECOES, MOTIVOS, periodo, montar, gerar, registros };
