// routes/pessoas.js — etapa 12c: colaboradores e documentos com vencimento
//                     etapa 12d.0: funções (cargos) + biblioteca + ficha do colaborador
//                     etapa 12d.1: EPI (item de consumo marcado como EPI, CA, endereço EPI)
//                     etapa 12d.1b: catálogo de tipos de EPI (lista do admin + do tenant), tamanhos
//                     etapa 12d.2: entrega de EPI (ficha NR-6 com assinatura), painel por colaborador, selo de conformidade
//                     etapa 12d.3: histórico de funções do colaborador
//                     etapa 12e.1: treinamentos (catálogo, turmas, presença assinada, registro manual) + pilar 🎓
// Registrado no server.js com tenantMiddleware: app.use('/api/pessoas', tenantMiddleware, ...)
//
// Ver:     admin, gestor, qualidade, operacao   (CPF só aparece para quem edita — LGPD)
// Editar:  admin, gestor, qualidade
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const D = require('../services/documentos');
const F = require('../services/funcoes'); // etapa 12d.0
const E = require('../services/epi');     // etapa 12d.1
const EE = require('../services/epiEntregas'); // etapa 12d.2
const CF = require('../services/conformidade'); // etapa 12d.2
const HF = require('../services/historicoFuncoes'); // etapa 12d.3
const TR = require('../services/treinamentos'); // etapa 12e.1
const PO = require('../services/provaOnline'); // etapa 12e.2b
const K = require('../services/competencias'); // etapa 12e.3
const DS = require('../services/dossie'); // etapa 12f
const MU = require('../services/multas'); // etapa 12g
const DI = require('../services/disciplinar'); // etapa 12h
const bcrypt = require('bcryptjs');            // etapa 12e.2b (acesso do colaborador)

const VER = ['admin', 'gestor', 'qualidade', 'operacao'];
const EDITAR = ['admin', 'gestor', 'qualidade'];
const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));
const podeVer = (req) => perfisDe(req).some((p) => VER.includes(p));
const podeEditar = (req) => perfisDe(req).some((p) => EDITAR.includes(p));
const q = async (p) => { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; };

function exigirVer(req, res, next) {
  if (!req.tenantId) return res.status(401).json({ erro: 'Não autenticado' });
  if (!podeVer(req)) return res.status(403).json({ erro: 'Seu perfil não acessa Pessoas e documentos' });
  next();
}
function exigirEditar(req, res, next) {
  if (!req.tenantId) return res.status(401).json({ erro: 'Não autenticado' });
  if (!podeEditar(req)) return res.status(403).json({ erro: 'Só admin, gestor ou qualidade alteram pessoas e documentos' });
  next();
}
function erro(res, onde, err) {
  const m = String(err?.message || '');
  if (/funcoes|funcao_id/.test(m) && /does not exist|não existe|relation|column/.test(m)) {
    return res.status(409).json({ erro: 'Rode as migrations 024 e 025 antes (funções)' });
  }
  if (/epi_itens/.test(m) && /does not exist|não existe|relation|schema cache/.test(m)) {
    return res.status(409).json({ erro: 'Rode a migration 026 antes (EPI)' });
  }
  if (/epi_tipos|tamanho|tam_calcado|tam_camisa|tam_calca|tam_luva/.test(m) && /does not exist|não existe|relation|schema cache|column/.test(m)) {
    return res.status(409).json({ erro: 'Rode a migration 027 antes (catálogo de EPI e tamanhos)' });
  }
  if (/epi_entregas|epi_entrega_itens/.test(m) && /does not exist|não existe|relation|schema cache/.test(m)) {
    return res.status(409).json({ erro: 'Rode a migration 028 antes (entregas de EPI)' });
  }
  if (/epi_entregas_numero_unico/.test(m)) return res.status(409).json({ erro: 'Duas entregas ao mesmo tempo — tente de novo' });
  if (/secoes|prova|horas|data_nascimento/.test(m) && /does not exist|não existe|schema cache|column/.test(m)) {
    return res.status(409).json({ erro: 'Rode a migration 031 antes (conteúdo, prova e horas de treinamento)' });
  }
  if (/medidas_disciplinares/.test(m) && /does not exist|não existe|schema cache|relation/.test(m)) return res.status(409).json({ erro: 'Rode a migration 037 antes (medidas disciplinares)' });
  if (/multas/.test(m) && /does not exist|não existe|schema cache|relation/.test(m)) return res.status(409).json({ erro: 'Rode a migration 036 antes (multas)' });
  if (/nivel_esperado|evidencia_treinamentos|"nivel"|'nivel'|column colaborador_competencias.nivel/.test(m)) return res.status(409).json({ erro: 'Rode a migration 034 antes (nota das competências)' });
  if (/colaborador_competencias|cnh_categoria|competencias|escolaridade/.test(m) && /does not exist|não existe|schema cache|column|relation/.test(m)) return res.status(409).json({ erro: 'Rode a migration 033 antes (competências)' });
  if (/treinamento_tentativas|tentativas_extra|link_token|link_ativo/.test(m)) return res.status(409).json({ erro: 'Rode a migration 032 antes (prova online)' });
  if (/treinamento/.test(m) && /does not exist|não existe|relation|schema cache/.test(m)) {
    return res.status(409).json({ erro: 'Rode a migration 030 antes (treinamentos)' });
  }
  if (/treinamento_participacoes_unica/.test(m)) return res.status(409).json({ erro: 'Colaborador já está nesta turma' });
  if (/epi_itens_item_unico/.test(m)) return res.status(409).json({ erro: 'Esse item já está marcado como EPI' });
  if (/funcoes_nome_unico/.test(m)) return res.status(409).json({ erro: 'Já existe uma função com esse nome' });
  if (/colaboradores|documento_tipos|documentos/.test(m) && /does not exist|não existe|relation/.test(m)) {
    return res.status(409).json({ erro: 'Rode a migration 022 antes (colaboradores e documentos)' });
  }
  if (/colaboradores_cpf_unico/.test(m)) return res.status(409).json({ erro: 'Já existe um colaborador com esse CPF' });
  console.error(`❌ [pessoas/${onde}]`, m);
  res.status(500).json({ erro: 'Erro interno — veja o log do servidor' });
}

const idValido = (id) => /^\d+$/.test(String(id));
async function colaboradorDoTenant(req, id) {
  if (!idValido(id)) return null;
  return (await q(supabase.from('colaboradores').select('*').eq('tenant_id', req.tenantId).eq('id', id)))[0] || null;
}
async function documentoDoTenant(req, id) {
  if (!idValido(id)) return null;
  return (await q(supabase.from('documentos').select('*').eq('tenant_id', req.tenantId).eq('id', id)))[0] || null;
}
async function usuarioDoTenant(req, id) {
  if (!id) return null;
  return (await q(supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId).eq('id', id)))[0] || null;
}

// O documento só pode apontar para coisas do próprio tenant
async function conferirVinculosDoc(req, dados) {
  if (dados.colaborador_id && !(await colaboradorDoTenant(req, dados.colaborador_id))) return 'Colaborador não encontrado';
  if (dados.equipamento_id) {
    const e = (await q(supabase.from('equipamentos').select('id').eq('tenant_id', req.tenantId).eq('id', dados.equipamento_id)))[0];
    if (!e) return 'Equipamento não encontrado';
  }
  if (dados.responsavel_id && !(await usuarioDoTenant(req, dados.responsavel_id).catch(() => null))) return 'Responsável não encontrado';
  if (dados.tipo_id) {
    const tipos = await D.tiposDoTenant(supabase, req.tenantId);
    const t = tipos.find((x) => String(x.id) === String(dados.tipo_id));
    if (!t) return 'Tipo de documento não encontrado';
    if (dados.alvo_tipo && t.alvo !== dados.alvo_tipo) return 'Esse tipo de documento é de outro alvo (pessoa/equipamento/empresa)';
    dados.tipo_nome = t.nome; // cópia do nome
  }
  return null;
}

// 12d.0: função escolhida tem de ser do tenant; o texto "funcao" acompanha o nome (histórico)
async function conferirFuncao(req, dados) {
  if (dados.funcao_id === undefined) return null;
  if (!dados.funcao_id) { dados.funcao_id = null; return null; }
  const f = await F.funcaoPorId(supabase, dados.funcao_id);
  if (!F.doTenant(f, req.tenantId) || f.ativo === false) return 'Função não encontrada';
  dados.funcao = f.nome;
  return null;
}

// ─── Configuração da tela ────────────────────────────────────────────────
router.get('/config', exigirVer, async (req, res) => {
  try {
    const tipos = await D.tiposDoTenant(supabase, req.tenantId);
    const usuarios = (await q(supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId)))
      .filter((u) => u.ativo !== false && u.ativo !== 0).map((u) => ({ id: u.id, nome: u.nome || u.email })).sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
    res.json({ tipos, usuarios, pode_editar: podeEditar(req) });
  } catch (err) { erro(res, 'config', err); }
});

// POST /api/pessoas/documento-tipos { alvo, nome, validade_meses_padrao } — tipo próprio do tenant
router.post('/documento-tipos', exigirEditar, async (req, res) => {
  try {
    const alvo = req.body?.alvo; const nome = String(req.body?.nome || '').trim();
    if (!D.ALVOS.includes(alvo)) return res.status(400).json({ erro: 'Alvo inválido' });
    if (!nome) return res.status(400).json({ erro: 'Informe o nome do tipo' });
    const meses = req.body?.validade_meses_padrao ? parseInt(req.body.validade_meses_padrao, 10) : null;
    if (meses !== null && !(meses >= 1 && meses <= 240)) return res.status(400).json({ erro: 'Validade entre 1 e 240 meses' });
    const codigo = 'p_' + nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').slice(0, 40);
    const existentes = await D.tiposDoTenant(supabase, req.tenantId);
    if (existentes.some((t) => t.alvo === alvo && t.nome.toLowerCase() === nome.toLowerCase())) return res.status(409).json({ erro: 'Esse tipo já existe' });
    const { data, error } = await supabase.from('documento_tipos').insert([{ tenant_id: req.tenantId, alvo, codigo, nome: nome.slice(0, 120), validade_meses_padrao: meses, ordem: 500 }]).select();
    if (error) throw new Error(error.message);
    res.status(201).json(data[0]);
  } catch (err) { erro(res, 'tipos', err); }
});

// ─── Colaboradores ───────────────────────────────────────────────────────
router.get('/colaboradores', exigirVer, async (req, res) => {
  try {
    const lista = await q(supabase.from('colaboradores').select('*').eq('tenant_id', req.tenantId));
    const docs = await D.listarDocumentos(supabase, req.tenantId, { alvoTipo: 'colaborador' });
    const editar = podeEditar(req);
    // 12d.0: ficha pela função (se a migration 024 ainda não rodou, a lista funciona igual sem ela)
    let fichas = new Map();
    try { fichas = await F.fichasDoTenant(supabase, req.tenantId, lista); }
    catch (e) { if (!/funcoes|funcao_id/.test(String(e.message))) throw e; }
    // 12d.2: status de EPI para o selo (antes da migration 028 o selo sai sem o pilar EPI)
    let baseEpi = null;
    try { baseEpi = await EE.carregarBase(supabase, req.tenantId); }
    catch (e) { if (!/epi_|funcoes|tam_/.test(String(e.message))) throw e; }
    let baseTr = null; // 12e.1
    try { baseTr = await TR.carregarBase(supabase, req.tenantId); }
    catch (e) { if (!/treinamento|funcoes/.test(String(e.message))) throw e; }
    let baseK = null; // 12e.3 (antes da migration 033 o selo sai sem o pilar 🧩)
    try { baseK = await K.carregarBase(supabase, req.tenantId); }
    catch (e) { if (!/colaborador_competencias|funcoes/.test(String(e.message))) throw e; }
    const out = lista.map((c) => {
      const meus = docs.filter((d) => String(d.colaborador_id) === String(c.id));
      const ficha = fichas.get(String(c.id));
      const epi = baseEpi ? EE.statusColaborador(c, baseEpi).resumo : null;
      const trein = baseTr ? TR.statusColaborador(c, baseTr).resumo : null;
      const comp = baseK ? K.statusColaborador(c, baseK, F.ESCOLARIDADES).resumo : null;
      const seloC = CF.selo({ funcaoLigada: !!ficha?.funcao, docs: ficha?.resumo, epi, trein, comp });
      return {
        ...c,
        funcao_nome: ficha?.funcao?.nome || c.funcao || null,
        exigidos: ficha?.resumo?.total || 0,
        pendencias: ficha?.resumo?.pendencias || 0,
        selo: seloC, epi_resumo: epi, trein_resumo: trein,
        cpf: editar ? c.cpf : (c.cpf ? `***.***.***-${c.cpf.slice(-2)}` : null), // LGPD: CPF completo só para quem edita
        ...(c.data_nascimento !== undefined ? { data_nascimento: editar ? c.data_nascimento : null } : {}), // 12e.2a — LGPD idem
        documentos: meus.length,
        vencidos: meus.filter((d) => d.situacao === 'vencido').length,
        a_vencer: meus.filter((d) => d.situacao === 'vence_30').length,
      };
    }).sort((a, b) => (a.situacao === 'desligado') - (b.situacao === 'desligado') || String(a.nome).localeCompare(String(b.nome)));
    res.json({ colaboradores: out, pode_editar: editar });
  } catch (err) { erro(res, 'colaboradores', err); }
});

router.post('/colaboradores', exigirEditar, async (req, res) => {
  try {
    const { erros, dados } = D.validarColaborador(req.body || {});
    if (erros.length) return res.status(400).json({ erro: erros[0], erros });
    if (dados.escolaridade && !F.ESCOLARIDADES.some((x) => x.codigo === dados.escolaridade)) return res.status(400).json({ erro: 'Escolaridade inválida' }); // 12e.3
    if (!dados.cpf) return res.status(400).json({ erro: 'Informe o CPF do colaborador (obrigatório — identifica a pessoa nos treinamentos e no dossiê)' }); // 12e.0
    if (dados.usuario_id && !(await usuarioDoTenant(req, dados.usuario_id))) return res.status(400).json({ erro: 'Usuário não encontrado' });
    const fe = await conferirFuncao(req, dados); if (fe) return res.status(400).json({ erro: fe });
    const mud = HF.validarMudanca(req.body); if (mud.erro) return res.status(400).json({ erro: mud.erro });
    const { data, error } = await supabase.from('colaboradores').insert([{ ...dados, tenant_id: req.tenantId }]).select();
    if (error) throw new Error(error.message);
    // 12d.3: 1º período no histórico de funções (admissão)
    if (data[0].funcao_id || data[0].funcao) {
      await HF.registrarMudanca(supabase, req.tenantId, data[0], { funcao_id: data[0].funcao_id || null, funcao_nome: data[0].funcao }, { desde: mud.desde || data[0].admissao || null, motivo: mud.motivo || 'admissao', obs: mud.obs, por: req.userId })
        .catch((e) => console.warn('⚠️ [pessoas] histórico de funções:', e.message));
    }
    res.status(201).json(data[0]);
  } catch (err) { erro(res, 'colaboradores', err); }
});

router.put('/colaboradores/:id', exigirEditar, async (req, res) => {
  try {
    const c = await colaboradorDoTenant(req, req.params.id);
    if (!c) return res.status(404).json({ erro: 'Colaborador não encontrado' });
    const { erros, dados } = D.validarColaborador(req.body || {}, { parcial: true });
    if (erros.length) return res.status(400).json({ erro: erros[0], erros });
    if (dados.escolaridade && !F.ESCOLARIDADES.some((x) => x.codigo === dados.escolaridade)) return res.status(400).json({ erro: 'Escolaridade inválida' }); // 12e.3
    // 12e.0: CPF obrigatório — quem já existe sem CPF precisa preencher ao editar
    if (!(dados.cpf !== undefined ? dados.cpf : c.cpf)) return res.status(400).json({ erro: 'Informe o CPF do colaborador (obrigatório desde a etapa 12e)' });
    if (dados.usuario_id && !(await usuarioDoTenant(req, dados.usuario_id))) return res.status(400).json({ erro: 'Usuário não encontrado' });
    const fe = await conferirFuncao(req, dados); if (fe) return res.status(400).json({ erro: fe });
    // 12d.3: mudou a função → registra no histórico ANTES (se a data for inválida, nada é gravado)
    const mudouFuncao = (dados.funcao_id !== undefined && String(dados.funcao_id || '') !== String(c.funcao_id || ''))
      || (dados.funcao_id === undefined && dados.funcao !== undefined && (dados.funcao || '') !== (c.funcao || ''));
    if (mudouFuncao) {
      const mud = HF.validarMudanca(req.body); if (mud.erro) return res.status(400).json({ erro: mud.erro });
      const tirou = dados.funcao_id === null && c.funcao_id != null; // ficou sem função: só fecha o período atual
      const novo = tirou ? { funcao_id: null, funcao_nome: null }
        : { funcao_id: dados.funcao_id !== undefined ? dados.funcao_id : c.funcao_id, funcao_nome: dados.funcao !== undefined ? dados.funcao : c.funcao };
      const r = await HF.registrarMudanca(supabase, req.tenantId, c, novo, { ...mud, por: req.userId });
      if (r.erro) return res.status(r.status).json({ erro: r.erro });
    }
    const { data, error } = await supabase.from('colaboradores').update({ ...dados, atualizado_em: new Date().toISOString() })
      .eq('id', c.id).eq('tenant_id', req.tenantId).select();
    if (error) throw new Error(error.message);
    res.json(data[0]);
  } catch (err) { erro(res, 'colaboradores', err); }
});

// Só apaga colaborador SEM documentos (histórico é prova legal) — com documentos: marque "desligado"
router.delete('/colaboradores/:id', exigirEditar, async (req, res) => {
  try {
    const c = await colaboradorDoTenant(req, req.params.id);
    if (!c) return res.status(404).json({ erro: 'Colaborador não encontrado' });
    const docs = await q(supabase.from('documentos').select('id').eq('tenant_id', req.tenantId).eq('colaborador_id', c.id));
    if (docs.length) return res.status(409).json({ erro: `${c.nome} tem ${docs.length} documento(s). Para guardar o histórico, marque como "desligado" em vez de excluir.` });
    const { error } = await supabase.from('colaboradores').delete().eq('id', c.id).eq('tenant_id', req.tenantId);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (err) { erro(res, 'colaboradores', err); }
});

// ─── Documentos ──────────────────────────────────────────────────────────
// GET /api/pessoas/documentos?alvo_tipo=&colaborador_id=&equipamento_id=&historico=1
router.get('/documentos', exigirVer, async (req, res) => {
  try {
    const docs = await D.listarDocumentos(supabase, req.tenantId, {
      alvoTipo: D.ALVOS.includes(req.query.alvo_tipo) ? req.query.alvo_tipo : null,
      colaboradorId: idValido(req.query.colaborador_id) ? req.query.colaborador_id : null,
      equipamentoId: req.query.equipamento_id ? String(req.query.equipamento_id) : null,
      historico: req.query.historico === '1',
    });
    res.json({ documentos: docs, resumo: D.resumo(docs.filter((d) => !d.substituido_por)), pode_editar: podeEditar(req) });
  } catch (err) { erro(res, 'documentos', err); }
});

async function gravarArquivoSeVier(req, docId, body) {
  if (!body?.arquivo_base64) return null;
  const msg = D.validarArquivo({ base64: body.arquivo_base64, mime: body.arquivo_mime, nome: body.arquivo_nome });
  if (msg) throw Object.assign(new Error(msg), { status: 400 });
  const path = await D.subirArquivo(supabase, { tenantId: req.tenantId, documentoId: docId, base64: body.arquivo_base64, mime: body.arquivo_mime });
  return { arquivo_path: path, arquivo_nome: String(body.arquivo_nome || 'arquivo').slice(0, 200), arquivo_mime: body.arquivo_mime };
}

async function criarDocumento(req, body) {
  const { erros, dados } = D.validarDocumento(body || {});
  if (erros.length) throw Object.assign(new Error(erros[0]), { status: 400 });
  const vinc = await conferirVinculosDoc(req, dados);
  if (vinc) throw Object.assign(new Error(vinc), { status: 400 });
  if (!dados.tipo_nome) throw Object.assign(new Error('Escolha o tipo de documento'), { status: 400 });
  // valida o arquivo ANTES de gravar o documento (não deixa documento pela metade)
  if (body.arquivo_base64) {
    const msg = D.validarArquivo({ base64: body.arquivo_base64, mime: body.arquivo_mime });
    if (msg) throw Object.assign(new Error(msg), { status: 400 });
  }
  const { data, error } = await supabase.from('documentos').insert([{ ...dados, tenant_id: req.tenantId, criado_por: req.userId ? String(req.userId) : null }]).select();
  if (error) throw new Error(error.message);
  let doc = data[0];
  try {
    const arq = await gravarArquivoSeVier(req, doc.id, body);
    if (arq) {
      const r = await supabase.from('documentos').update(arq).eq('id', doc.id).eq('tenant_id', req.tenantId).select();
      if (r.error) throw new Error(r.error.message);
      doc = r.data[0];
    }
  } catch (e) {
    await supabase.from('documentos').delete().eq('id', doc.id).eq('tenant_id', req.tenantId);
    throw e;
  }
  return doc;
}

router.post('/documentos', exigirEditar, async (req, res) => {
  try { res.status(201).json(await criarDocumento(req, req.body)); }
  catch (err) { if (err.status) return res.status(err.status).json({ erro: err.message }); erro(res, 'documentos', err); }
});

router.put('/documentos/:id', exigirEditar, async (req, res) => {
  try {
    const doc = await documentoDoTenant(req, req.params.id);
    if (!doc) return res.status(404).json({ erro: 'Documento não encontrado' });
    const { erros, dados } = D.validarDocumento(req.body || {}, { parcial: true });
    if (erros.length) return res.status(400).json({ erro: erros[0], erros });
    const emitido = dados.emitido_em !== undefined ? dados.emitido_em : doc.emitido_em;
    const vence = dados.vence_em !== undefined ? dados.vence_em : doc.vence_em;
    if (emitido && vence && String(vence) < String(emitido)) return res.status(400).json({ erro: 'O vencimento não pode ser antes da emissão' });
    const vinc = await conferirVinculosDoc(req, { ...dados, alvo_tipo: doc.alvo_tipo });
    if (vinc) return res.status(400).json({ erro: vinc });
    const arquivoAntigo = doc.arquivo_path || null;
    const arq = await gravarArquivoSeVier(req, doc.id, req.body);
    const { data, error } = await supabase.from('documentos').update({ ...dados, ...(arq || {}), atualizado_em: new Date().toISOString() })
      .eq('id', doc.id).eq('tenant_id', req.tenantId).select();
    if (error) { if (arq) await D.removerArquivo(supabase, arq.arquivo_path); throw new Error(error.message); }
    if (arq && arquivoAntigo && arquivoAntigo !== arq.arquivo_path) await D.removerArquivo(supabase, arquivoAntigo); // trocou o arquivo
    res.json(data[0]);
  } catch (err) { if (err.status) return res.status(err.status).json({ erro: err.message }); erro(res, 'documentos', err); }
});

// POST /api/pessoas/documentos/:id/renovar — cadastra o novo e marca o anterior como substituído
router.post('/documentos/:id/renovar', exigirEditar, async (req, res) => {
  try {
    const ant = await documentoDoTenant(req, req.params.id);
    if (!ant) return res.status(404).json({ erro: 'Documento não encontrado' });
    if (ant.substituido_por) return res.status(400).json({ erro: 'Este documento já foi renovado' });
    const novo = await criarDocumento(req, {
      ...req.body,
      alvo_tipo: ant.alvo_tipo, colaborador_id: ant.colaborador_id, equipamento_id: ant.equipamento_id,
      tipo_id: ant.tipo_id, tipo_nome: ant.tipo_nome,
      responsavel_id: req.body?.responsavel_id !== undefined ? req.body.responsavel_id : ant.responsavel_id,
    });
    await supabase.from('documentos').update({ substituido_por: novo.id, atualizado_em: new Date().toISOString() }).eq('id', ant.id).eq('tenant_id', req.tenantId);
    res.status(201).json(novo);
  } catch (err) { if (err.status) return res.status(err.status).json({ erro: err.message }); erro(res, 'renovar', err); }
});

// GET /api/pessoas/documentos/:id/arquivo — link assinado (1 h) para abrir o arquivo
router.get('/documentos/:id/arquivo', exigirVer, async (req, res) => {
  try {
    const doc = await documentoDoTenant(req, req.params.id);
    if (!doc || !doc.arquivo_path) return res.status(404).json({ erro: 'Arquivo não encontrado' });
    res.json({ url: await D.linkArquivo(supabase, doc.arquivo_path), nome: doc.arquivo_nome });
  } catch (err) { erro(res, 'arquivo', err); }
});

// Excluir documento (cadastro errado). Se ele tinha substituído outro, o anterior volta a valer.
router.delete('/documentos/:id', exigirEditar, async (req, res) => {
  try {
    const doc = await documentoDoTenant(req, req.params.id);
    if (!doc) return res.status(404).json({ erro: 'Documento não encontrado' });
    await supabase.from('documentos').update({ substituido_por: null }).eq('tenant_id', req.tenantId).eq('substituido_por', doc.id);
    const { error } = await supabase.from('documentos').delete().eq('id', doc.id).eq('tenant_id', req.tenantId);
    if (error) throw new Error(error.message);
    await D.removerArquivo(supabase, doc.arquivo_path);
    res.json({ ok: true });
  } catch (err) { erro(res, 'documentos', err); }
});

// ─── Funções (etapa 12d.0) ───────────────────────────────────────────────
router.get('/funcoes', exigirVer, async (req, res) => {
  try {
    let treinamentos = []; // 12e.1: para escolher os exigidos na função
    try { treinamentos = (await TR.catalogo(supabase, req.tenantId)).map((t) => ({ codigo: t.codigo, nome: t.nome, validade_meses: t.validade_meses })); }
    catch (e) { if (!/treinamento/.test(String(e.message))) throw e; }
    res.json({ funcoes: await F.listarFuncoes(supabase, req.tenantId), ...F.LISTAS, tipos_epi: await E.tiposDoTenant(supabase, req.tenantId), treinamentos, pode_editar: podeEditar(req) });
  }
  catch (err) { erro(res, 'funcoes', err); }
});

router.get('/funcoes/biblioteca', exigirVer, async (req, res) => {
  try {
    const minhas = await F.listarFuncoes(supabase, req.tenantId);
    const importadas = new Set(minhas.filter((f) => f.origem_id != null).map((f) => String(f.origem_id)));
    res.json({ modelos: (await F.biblioteca(supabase)).map((m) => ({ ...m, ja_importado: importadas.has(String(m.id)) })) });
  } catch (err) { erro(res, 'biblioteca', err); }
});

router.post('/funcoes/importar', exigirEditar, async (req, res) => {
  try {
    const r = await F.importar(supabase, req.tenantId, req.body?.biblioteca_id, { nome: req.body?.nome });
    if (r.erro) return res.status(r.status).json({ erro: r.erro });
    res.status(201).json(r.funcao);
  } catch (err) { erro(res, 'importar', err); }
});

router.post('/funcoes', exigirEditar, async (req, res) => {
  try {
    const { erros, dados } = F.validarFuncao(req.body || {});
    if (erros.length) return res.status(400).json({ erro: erros[0], erros });
    if (dados.epis) { const cod = await codigosEpi(req); dados.epis = dados.epis.filter((k) => cod.has(k.tipo)); } // só tipos que existem
    const { data, error } = await supabase.from('funcoes').insert([{ ...dados, tenant_id: req.tenantId }]).select();
    if (error) throw new Error(error.message);
    res.status(201).json(data[0]);
  } catch (err) { erro(res, 'funcoes', err); }
});

router.put('/funcoes/:id', exigirEditar, async (req, res) => {
  try {
    const f = await F.funcaoPorId(supabase, req.params.id);
    if (!F.doTenant(f, req.tenantId)) return res.status(404).json({ erro: 'Função não encontrada' });
    const { erros, dados } = F.validarFuncao(req.body || {}, { parcial: true });
    if (erros.length) return res.status(400).json({ erro: erros[0], erros });
    if (dados.epis) { const cod = await codigosEpi(req); dados.epis = dados.epis.filter((k) => cod.has(k.tipo)); } // só tipos que existem
    const { data, error } = await supabase.from('funcoes').update({ ...dados, atualizado_em: new Date().toISOString() })
      .eq('id', f.id).eq('tenant_id', req.tenantId).select();
    if (error) throw new Error(error.message);
    // o nome acompanha nos colaboradores (texto de histórico)
    if (dados.nome && dados.nome !== f.nome) await supabase.from('colaboradores').update({ funcao: dados.nome }).eq('tenant_id', req.tenantId).eq('funcao_id', f.id);
    res.json(data[0]);
  } catch (err) { erro(res, 'funcoes', err); }
});

// POST /funcoes/:id/atualizar — traz a versão nova do modelo da biblioteca
router.post('/funcoes/:id/atualizar', exigirEditar, async (req, res) => {
  try {
    const r = await F.atualizarDaBiblioteca(supabase, req.tenantId, req.params.id);
    if (r.erro) return res.status(r.status).json({ erro: r.erro });
    res.json(r.funcao);
  } catch (err) { erro(res, 'atualizar', err); }
});

// Excluir: sem colaborador ligado apaga; com colaborador, não deixa (troque a função deles antes)
router.delete('/funcoes/:id', exigirEditar, async (req, res) => {
  try {
    const f = await F.funcaoPorId(supabase, req.params.id);
    if (!F.doTenant(f, req.tenantId)) return res.status(404).json({ erro: 'Função não encontrada' });
    const usando = (await q(supabase.from('colaboradores').select('*').eq('tenant_id', req.tenantId).eq('funcao_id', f.id)));
    if (usando.length) return res.status(409).json({ erro: `${usando.length} colaborador(es) têm a função "${f.nome}". Troque a função deles antes de excluir.` });
    const { error } = await supabase.from('funcoes').delete().eq('id', f.id).eq('tenant_id', req.tenantId);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (err) { erro(res, 'funcoes', err); }
});

// GET /colaboradores/:id/ficha — documentos exigidos pela função × o que ele tem
router.get('/colaboradores/:id/ficha', exigirVer, async (req, res) => {
  try {
    const c = await colaboradorDoTenant(req, req.params.id);
    if (!c) return res.status(404).json({ erro: 'Colaborador não encontrado' });
    const fichas = await F.fichasDoTenant(supabase, req.tenantId, [c]);
    const f = fichas.get(String(c.id));
    let epi = null;
    try { epi = EE.statusColaborador(c, await EE.carregarBase(supabase, req.tenantId)); }
    catch (e) { if (!/epi_|tam_/.test(String(e.message))) throw e; }
    let comp = null; // 12e.3
    try { comp = K.statusColaborador(c, await K.carregarBase(supabase, req.tenantId), F.ESCOLARIDADES); }
    catch (e) { if (!/colaborador_competencias/.test(String(e.message))) throw e; }
    let trein = null; // 12e.1
    try { trein = TR.statusColaborador(c, await TR.carregarBase(supabase, req.tenantId)); trein.horas = TR.resumoHoras(await TR.historico(supabase, req.tenantId, c.id)); } // 12e.2a: ⏱
    catch (e) { if (!/treinamento/.test(String(e.message))) throw e; }
    res.json({
      epi: epi ? { itens: epi.itens, resumo: epi.resumo, extras: epi.extras } : null,
      treinamentos: trein ? { itens: trein.itens, resumo: trein.resumo, horas: trein.horas || null } : null,
      selo: CF.selo({ funcaoLigada: !!f.funcao, docs: f.resumo, epi: epi?.resumo, trein: trein?.resumo, comp: comp?.resumo }),
      competencias: comp ? { itens: comp.itens, resumo: comp.resumo } : null,
      disciplinar: podeEditar(req) ? await (async () => { try { const l = await DI.listar(supabase, req.tenantId, { colaboradorId: c.id }); return { lista: l.slice(0, 20), resumo: DI.resumoColaborador(l) }; } catch (e) { if (/medidas_disciplinares/.test(String(e.message))) return null; throw e; } })() : null, // 12h (LGPD: só quem edita)
      multas: await (async () => { try { const l = await MU.listar(supabase, req.tenantId, { colaboradorId: c.id }); return { lista: l.slice(0, 20), resumo: MU.resumoColaborador(l) }; } catch (e) { if (/multas/.test(String(e.message))) return null; throw e; } })(), // 12g
      colaborador_comp: { escolaridade: c.escolaridade ?? null, cnh_categoria: c.cnh_categoria ?? null },
      colaborador: { id: c.id, nome: c.nome, situacao: c.situacao, funcao_id: c.funcao_id, funcao: c.funcao },
      funcao: f.funcao ? { id: f.funcao.id, nome: f.funcao.nome, descritivo: f.funcao.descritivo, requisitos: f.funcao.requisitos, cbo: f.funcao.cbo || null, setor: f.funcao.setor || null, escolaridade: f.funcao.escolaridade || null, riscos: f.funcao.riscos || [], responde_a: f.funcao.responde_a || null } : null,
      ...F.LISTAS,
      itens: f.itens, resumo: f.resumo, pode_editar: podeEditar(req),
    });
  } catch (err) { erro(res, 'ficha', err); }
});

// ─── EPI (etapa 12d.1) ───────────────────────────────────────────────────
// O EPI é um item de consumo do Estoque marcado como EPI. Saldo = o do Estoque.
router.get('/epi', exigirVer, async (req, res) => {
  try {
    let endereco = null;
    try { endereco = await E.garantirEnderecoEpi(supabase, req.tenantId); await E.garantirRecebimento(supabase, req.tenantId); }
    catch (e) { console.warn('⚠️ [pessoas/epi] endereço EPI não criado:', e.message); }
    res.json({ itens: await E.listarEpiItens(supabase, req.tenantId), endereco, ...E.LISTAS_EPI, tipos_epi: await E.tiposDoTenant(supabase, req.tenantId), pode_editar: podeEditar(req) });
  } catch (err) { erro(res, 'epi', err); }
});

// POST /epi/tipos { nome, grade, troca_dias_padrao } — tipo de EPI próprio do tenant (12d.1b)
router.post('/epi/tipos', exigirEditar, async (req, res) => {
  try {
    const r = await E.criarTipoTenant(supabase, req.tenantId, req.body);
    if (r.erro) return res.status(r.status).json({ erro: r.erro });
    res.status(201).json(r.tipo);
  } catch (err) { erro(res, 'epi', err); }
});

const codigosEpi = async (req) => new Set((await E.tiposDoTenant(supabase, req.tenantId)).map((t) => t.codigo));

// Itens de consumo para escolher qual marcar como EPI
router.get('/epi/itens-consumo', exigirEditar, async (req, res) => {
  try {
    const itens = (await q(supabase.from('itens_consumo').select('*').eq('tenant_id', req.tenantId))).filter((i) => i.ativo !== false);
    const epis = (await q(supabase.from('epi_itens').select('*').eq('tenant_id', req.tenantId))).filter((e) => e.ativo !== false);
    const ja = new Set(epis.map((e) => String(e.item_consumo_id)));
    res.json({ itens: itens.map((i) => ({ id: i.id, nome: i.nome, sku: i.sku || null, unidade: i.unidade_medida || 'UN', saldo: Number(i.saldo_atual) || 0, ja_epi: ja.has(String(i.id)) }))
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome))) });
  } catch (err) { erro(res, 'epi', err); }
});

// POST /epi/itens { item_consumo_id | novo_item: { nome, unidade_medida, sku }, tipo, ca, ca_validade, troca_dias, obs }
router.post('/epi/itens', exigirEditar, async (req, res) => {
  try {
    const codigos = await codigosEpi(req);
    const { erros, dados } = E.validarEpiItem(req.body || {}, { codigos });
    if (erros.length) return res.status(400).json({ erro: erros[0], erros });
    let itemId = req.body?.item_consumo_id;
    let criado = null;
    if (!itemId) {
      // 12d.1b: "Novo EPI" cria o item no Estoque por trás. Nome = descrição (ou o tipo) + tamanho.
      const tipoNome = (await E.tiposDoTenant(supabase, req.tenantId)).find((t) => t.codigo === dados.tipo)?.nome;
      const base = String(req.body?.novo_item?.nome || tipoNome || '').trim();
      if (!base) return res.status(400).json({ erro: 'Escolha um item do estoque ou informe o nome do item novo' });
      const nome = dados.tamanho && !base.toLowerCase().includes(`tam. ${dados.tamanho}`.toLowerCase()) ? `${base} — tam. ${dados.tamanho}` : base;
      req.body.novo_item = req.body.novo_item || {};
      const { data, error } = await supabase.from('itens_consumo').insert([{
        tenant_id: req.tenantId, nome: nome.slice(0, 200), sku: req.body.novo_item.sku ? String(req.body.novo_item.sku).trim().slice(0, 60) : null,
        unidade_medida: String(req.body.novo_item.unidade_medida || 'UN').trim().slice(0, 10) || 'UN',
        saldo_atual: 0, quantidade_lotes_automatico: 1, ativo: true,
      }]).select();
      if (error) throw new Error(error.message);
      criado = data[0]; itemId = criado.id;
    } else {
      const it = (await q(supabase.from('itens_consumo').select('*').eq('tenant_id', req.tenantId).eq('id', itemId)))[0];
      if (!it) return res.status(404).json({ erro: 'Item do estoque não encontrado' });
    }
    const existente = (await q(supabase.from('epi_itens').select('*').eq('tenant_id', req.tenantId).eq('item_consumo_id', itemId)))[0];
    if (existente && existente.ativo !== false) return res.status(409).json({ erro: 'Esse item já está marcado como EPI' });
    let r;
    if (existente) r = await supabase.from('epi_itens').update({ ...dados, ativo: true, atualizado_em: new Date().toISOString() }).eq('id', existente.id).eq('tenant_id', req.tenantId).select();
    else r = await supabase.from('epi_itens').insert([{ ...dados, tenant_id: req.tenantId, item_consumo_id: itemId }]).select();
    if (r.error) {
      if (criado) await supabase.from('itens_consumo').delete().eq('id', criado.id).eq('tenant_id', req.tenantId); // não deixa item órfão
      throw new Error(r.error.message);
    }
    res.status(201).json({ ...r.data[0], item_criado: !!criado });
  } catch (err) { erro(res, 'epi', err); }
});

router.put('/epi/itens/:id', exigirEditar, async (req, res) => {
  try {
    if (!idValido(req.params.id)) return res.status(404).json({ erro: 'EPI não encontrado' });
    const e = (await q(supabase.from('epi_itens').select('*').eq('tenant_id', req.tenantId).eq('id', req.params.id)))[0];
    if (!e) return res.status(404).json({ erro: 'EPI não encontrado' });
    const { erros, dados } = E.validarEpiItem(req.body || {}, { parcial: true, codigos: await codigosEpi(req) });
    if (erros.length) return res.status(400).json({ erro: erros[0], erros });
    const { data, error } = await supabase.from('epi_itens').update({ ...dados, atualizado_em: new Date().toISOString() }).eq('id', e.id).eq('tenant_id', req.tenantId).select();
    if (error) throw new Error(error.message);
    res.json(data[0]);
  } catch (err) { erro(res, 'epi', err); }
});

// Desmarcar como EPI: o item continua no Estoque; o histórico de entregas (12d.2) fica
router.delete('/epi/itens/:id', exigirEditar, async (req, res) => {
  try {
    if (!idValido(req.params.id)) return res.status(404).json({ erro: 'EPI não encontrado' });
    const { data, error } = await supabase.from('epi_itens').update({ ativo: false, atualizado_em: new Date().toISOString() }).eq('tenant_id', req.tenantId).eq('id', req.params.id).select();
    if (error) throw new Error(error.message);
    if (!data?.length) return res.status(404).json({ erro: 'EPI não encontrado' });
    res.json({ ok: true });
  } catch (err) { erro(res, 'epi', err); }
});

// GET /colaboradores/:id/funcoes — histórico de funções (12d.3)
router.get('/colaboradores/:id/funcoes', exigirVer, async (req, res) => {
  try {
    const c = await colaboradorDoTenant(req, req.params.id);
    if (!c) return res.status(404).json({ erro: 'Colaborador não encontrado' });
    res.json({ historico: await HF.listar(supabase, req.tenantId, c.id), motivos: HF.MOTIVOS });
  } catch (err) { erro(res, 'historico-funcoes', err); }
});

// ─── Entregas de EPI (etapa 12d.2) ────────────────────────────────────────
// Entregar e devolver: admin, gestor, qualidade e operação (a central de EPI). Sem aprovação de retirada.
async function usuarioLogado(req) {
  if (!req.userId) return null;
  const u = await usuarioDoTenant(req, req.userId).catch(() => null);
  return { id: req.userId, nome: u?.nome || u?.email || null };
}

router.get('/epi/painel', exigirVer, async (req, res) => {
  try { res.json({ colaboradores: await EE.painel(supabase, req.tenantId), motivos: EE.MOTIVOS, aviso_troca_dias: EE.AVISO_TROCA_DIAS }); }
  catch (err) { erro(res, 'epi-painel', err); }
});

router.post('/epi/entregas', exigirVer, async (req, res) => {
  try {
    const r = await EE.registrarEntrega(supabase, req.tenantId, await usuarioLogado(req), req.body || {});
    if (r.erro) return res.status(r.status).json({ erro: r.erro });
    res.status(201).json(r);
  } catch (err) { erro(res, 'epi-entrega', err); }
});

router.post('/epi/entrega-itens/:id/devolver', exigirVer, async (req, res) => {
  try {
    if (!idValido(req.params.id)) return res.status(404).json({ erro: 'Item não encontrado' });
    const r = await EE.devolver(supabase, req.tenantId, await usuarioLogado(req), req.params.id, req.body || {});
    if (r.erro) return res.status(r.status).json({ erro: r.erro });
    res.json(r);
  } catch (err) { erro(res, 'epi-devolver', err); }
});

router.get('/epi/colaboradores/:id/historico', exigirVer, async (req, res) => {
  try {
    const c = await colaboradorDoTenant(req, req.params.id);
    if (!c) return res.status(404).json({ erro: 'Colaborador não encontrado' });
    res.json({ entregas: await EE.historico(supabase, req.tenantId, c.id) });
  } catch (err) { erro(res, 'epi-historico', err); }
});

// Ficha de EPI (NR-6) para imprimir/salvar em PDF: empresa, colaborador, todas as entregas com assinatura
router.get('/epi/colaboradores/:id/ficha-nr6', exigirVer, async (req, res) => {
  try {
    const c = await colaboradorDoTenant(req, req.params.id);
    if (!c) return res.status(404).json({ erro: 'Colaborador não encontrado' });
    const t = (await q(supabase.from('tenants').select('*').eq('id', req.tenantId)))[0] || {};
    const editar = podeEditar(req);
    res.json({
      empresa: { nome: t.nome_fantasia || t.nome || t.razao_social || 'Empresa', razao_social: t.razao_social || t.nome || null, cnpj: t.cnpj || null },
      colaborador: { id: c.id, nome: c.nome, cpf: c.cpf ? (editar ? c.cpf : `***.***.***-${c.cpf.slice(-2)}`) : null, funcao: c.funcao || null, admissao: c.admissao || null, situacao: c.situacao },
      entregas: await EE.historico(supabase, req.tenantId, c.id, { comAssinatura: true }),
      historico_funcoes: (await HF.listar(supabase, req.tenantId, c.id)).map((h) => ({ funcao_nome: h.funcao_nome, inicio: h.inicio, fim: h.fim, motivo: h.motivo })),
      gerado_em: new Date().toISOString(),
    });
  } catch (err) { erro(res, 'epi-ficha', err); }
});

// ─── Treinamentos (etapa 12e.1) ───────────────────────────────────────────
// Catálogo: editar = admin, gestor, qualidade. Turmas, presença e registro manual: quem vê Pessoas (inclui operação).
const responderTR = (fn) => async (req, res) => {
  try { const r = await fn(req); if (r && r.erro) return res.status(r.status || 400).json({ erro: r.erro }); res.json(r); }
  catch (err) { if (err.status) return res.status(err.status).json({ erro: err.message }); erro(res, 'treinamentos', err); }
};
const turmaOu404 = async (req) => { const t = await TR.turmaDoTenant(supabase, req.tenantId, req.params.id); if (!t) throw Object.assign(new Error('Turma não encontrada'), { status: 404 }); return t; };

router.get('/treinamentos', exigirVer, responderTR(async (req) => ({ treinamentos: await TR.catalogo(supabase, req.tenantId), tipos: TR.TIPOS, modalidades: TR.MODALIDADES, pode_editar: podeEditar(req) })));
router.post('/treinamentos', exigirEditar, responderTR((req) => TR.criarTreinamento(supabase, req.tenantId, req.body)));
router.put('/treinamentos/:id', exigirEditar, responderTR(async (req) => {
  if (!idValido(req.params.id)) return { status: 404, erro: 'Treinamento não encontrado' };
  const { erros, dados } = TR.validarTreinamento(req.body || {}, { parcial: true });
  if (erros.length) return { status: 400, erro: erros[0] };
  const { data, error } = await supabase.from('treinamentos').update({ ...dados, atualizado_em: new Date().toISOString() }).eq('id', req.params.id).eq('tenant_id', req.tenantId).select();
  if (error) throw new Error(error.message);
  if (!data?.length) return { status: 404, erro: 'Treinamento não encontrado' };
  return { treinamento: data[0] };
}));
router.delete('/treinamentos/:id', exigirEditar, responderTR(async (req) => { // desativa (o histórico das turmas fica)
  if (!idValido(req.params.id)) return { status: 404, erro: 'Treinamento não encontrado' };
  const { data, error } = await supabase.from('treinamentos').update({ ativo: false, atualizado_em: new Date().toISOString() }).eq('id', req.params.id).eq('tenant_id', req.tenantId).select();
  if (error) throw new Error(error.message);
  if (!data?.length) return { status: 404, erro: 'Treinamento não encontrado' };
  return { ok: true };
}));

// 12e.2a: biblioteca do QuotaFlow (importar / atualizar) e horas creditadas
router.get('/treinamentos/biblioteca', exigirVer, responderTR(async (req) => ({ modelos: await TR.bibliotecaParaTenant(supabase, req.tenantId) })));
router.post('/treinamentos/importar', exigirEditar, responderTR((req) => TR.importar(supabase, req.tenantId, req.body?.biblioteca_id)));
router.post('/treinamentos/:id/atualizar', exigirEditar, responderTR((req) => TR.atualizarDaBiblioteca(supabase, req.tenantId, req.params.id)));
router.get('/treinamentos/horas', exigirVer, responderTR((req) => TR.relatorioHoras(supabase, req.tenantId, { de: req.query.de, ate: req.query.ate })));

router.get('/treinamentos/painel', exigirVer, responderTR(async (req) => ({ colaboradores: await TR.painel(supabase, req.tenantId) })));
router.get('/treinamentos/turmas', exigirVer, responderTR(async (req) => ({ turmas: await TR.listarTurmas(supabase, req.tenantId) })));
router.post('/treinamentos/turmas', exigirVer, responderTR(async (req) => TR.criarTurma(supabase, req.tenantId, req.userId, req.body)));
router.get('/treinamentos/turmas/:id', exigirVer, responderTR(async (req) => {
  let t = await turmaOu404(req);
  if (TR.prazoVencido(t)) { await TR.fecharOnlineVencidas(supabase, req.tenantId, [t]); t = await turmaOu404(req); } // 12e.2d: prazo vencido → encerra
  let prova = {}; // 12e.2b: situação da prova online por participante (antes da migration 032 vem vazio)
  try { prova = await PO.situacaoTurma(supabase, req.tenantId, t); } catch (e) { if (!/treinamento_tentativas|tentativas_extra/.test(String(e.message))) throw e; }
  return { turma: t, participantes: await TR.participantes(supabase, req.tenantId, t.id), prova };
}));
// 12e.2b: link externo da prova (CPF + nascimento) e liberar novas tentativas
router.post('/treinamentos/turmas/:id/link', exigirVer, responderTR(async (req) => PO.gerarLink(supabase, req.tenantId, await turmaOu404(req), { ativo: req.body?.ativo !== false })));
router.post('/treinamentos/turmas/:id/liberar/:colab', exigirVer, responderTR(async (req) => PO.liberarTentativas(supabase, req.tenantId, await turmaOu404(req), req.params.colab)));
// 12e.2c: certificado (quem concluiu) e comprovante da avaliação (com gabarito — só admin, gestor, qualidade)
router.get('/treinamentos/turmas/:id/certificado/:colab', exigirVer, responderTR((req) => PO.certificado(supabase, req.tenantId, req.params.id, req.params.colab, { cpfCompleto: podeEditar(req) })));
router.get('/treinamentos/turmas/:id/avaliacao/:colab', exigirEditar, responderTR((req) => PO.avaliacao(supabase, req.tenantId, req.params.id, req.params.colab)));
// 12e.2b: PDF de apoio enviado ao QuotaFlow
router.post('/treinamentos/material', exigirEditar, responderTR((req) => TR.subirMaterial(supabase, `tenant-${req.tenantId}`, { base64: req.body?.base64, nome: req.body?.nome })));
router.get('/treinamentos/material', exigirVer, responderTR((req) => TR.linkMaterialGestor(supabase, req.query.path, [`tenant-${req.tenantId}/`, 'biblioteca/'])));
router.post('/treinamentos/turmas/:id/participantes', exigirVer, responderTR(async (req) => TR.adicionarParticipantes(supabase, req.tenantId, await turmaOu404(req), req.body?.colaboradores)));
router.delete('/treinamentos/turmas/:id/participantes/:colab', exigirVer, responderTR(async (req) => TR.removerParticipante(supabase, req.tenantId, await turmaOu404(req), req.params.colab)));
router.post('/treinamentos/turmas/:id/assinar', exigirVer, responderTR(async (req) => TR.assinarPresenca(supabase, req.tenantId, await turmaOu404(req), req.body?.colaborador_id, req.body?.assinatura_png)));
router.post('/treinamentos/turmas/:id/concluir', exigirVer, responderTR(async (req) => TR.concluirTurma(supabase, req.tenantId, await turmaOu404(req))));
router.post('/treinamentos/turmas/:id/cancelar', exigirVer, responderTR(async (req) => {
  const t = await turmaOu404(req);
  if (t.status !== 'agendada') return { status: 400, erro: 'Só turma agendada pode ser cancelada' };
  const { error } = await supabase.from('treinamento_turmas').update({ status: 'cancelada' }).eq('id', t.id).eq('tenant_id', req.tenantId);
  if (error) throw new Error(error.message);
  return { ok: true };
}));
router.get('/treinamentos/turmas/:id/evidencia', exigirVer, responderTR(async (req) => {
  const t = await turmaOu404(req);
  if (!t.evidencia_path) return { status: 404, erro: 'Sem evidência anexa' };
  return { url: await D.linkArquivo(supabase, t.evidencia_path), nome: t.evidencia_nome };
}));
// Lista de presença para imprimir/PDF (com as assinaturas)
router.get('/treinamentos/turmas/:id/lista-presenca', exigirVer, responderTR(async (req) => {
  const t = await turmaOu404(req);
  const emp = (await q(supabase.from('tenants').select('*').eq('id', req.tenantId)))[0] || {};
  const editar = podeEditar(req);
  const ps = (await TR.participantes(supabase, req.tenantId, t.id, { comAssinatura: true }))
    .map((p) => ({ ...p, cpf: p.cpf ? (editar ? p.cpf : `***.***.***-${String(p.cpf).slice(-2)}`) : null }));
  const tr = t.treinamento_id ? (await q(supabase.from('treinamentos').select('*').eq('id', t.treinamento_id)))[0] : null;
  return { empresa: { nome: emp.nome_fantasia || emp.nome || emp.razao_social || 'Empresa', razao_social: emp.razao_social || emp.nome || null, cnpj: emp.cnpj || null },
    turma: t, conteudo: tr?.conteudo || null, norma: tr?.norma || null, participantes: ps, gerado_em: new Date().toISOString() };
}));
router.get('/colaboradores/:id/treinamentos', exigirVer, responderTR(async (req) => {
  const c = await colaboradorDoTenant(req, req.params.id);
  if (!c) return { status: 404, erro: 'Colaborador não encontrado' };
  const historico = await TR.historico(supabase, req.tenantId, c.id);
  return { historico, horas: TR.resumoHoras(historico) };
}));

// ─── 12e.3: competências (atende / não atende) ────────────────────────────
router.post('/colaboradores/:id/competencias', exigirEditar, async (req, res) => {
  try {
    const c = await colaboradorDoTenant(req, req.params.id);
    if (!c) return res.status(404).json({ erro: 'Colaborador não encontrado' });
    const u = await usuarioDoTenant(req, req.userId).catch(() => null);
    const r = await K.avaliar(supabase, req.tenantId, { usuarioId: req.userId, usuarioNome: u?.nome || req.userEmail || null }, c, req.body || {});
    if (r.erro) return res.status(r.status).json({ erro: r.erro });
    res.status(201).json(r.avaliacao);
  } catch (err) { erro(res, 'competencias', err); }
});
router.get('/colaboradores/:id/competencias', exigirVer, async (req, res) => {
  try {
    const c = await colaboradorDoTenant(req, req.params.id);
    if (!c) return res.status(404).json({ erro: 'Colaborador não encontrado' });
    res.json({ historico: await K.historico(supabase, req.tenantId, c.id) });
  } catch (err) { erro(res, 'competencias', err); }
});
router.get('/competencias/:id/evidencia', exigirVer, async (req, res) => {
  try {
    const r = await K.linkEvidencia(supabase, req.tenantId, req.params.id);
    if (r.erro) return res.status(r.status).json({ erro: r.erro });
    res.json(r);
  } catch (err) { erro(res, 'competencias', err); }
});

// ─── 12g: multas de trânsito ─────────────────────────────────────────────
const quem = async (req) => { const u = await usuarioDoTenant(req, req.userId).catch(() => null); return { usuarioId: req.userId, usuarioNome: u?.nome || req.userEmail || null }; };
const multaOu404 = async (req) => { const m = await MU.multaDoTenant(supabase, req.tenantId, req.params.id); if (!m) throw Object.assign(new Error('Multa não encontrada'), { status: 404 }); return m; };
router.get('/multas', exigirVer, responderTR(async (req) => {
  const eqs = await q(supabase.from('equipamentos').select('*').eq('tenant_id', req.tenantId)).catch(() => []);
  const us = (await q(supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId))).filter((u) => u.ativo !== false && u.ativo !== 0 && u.perfil !== 'colaborador');
  return { multas: await MU.listar(supabase, req.tenantId), gravidades: MU.GRAVIDADES, status: MU.STATUS_NOME, prazo_indicacao_dias: MU.PRAZO_INDICACAO_DIAS, pode_editar: podeEditar(req),
    equipamentos: eqs.filter((e) => e.ativo !== false).map((e) => ({ id: e.id, tag: e.tag, nome: e.nome })).sort((a, b) => String(a.tag || a.nome).localeCompare(String(b.tag || b.nome))),
    usuarios: us.map((u) => ({ id: u.id, nome: u.nome })).sort((a, b) => String(a.nome).localeCompare(String(b.nome))) };
}));
router.post('/multas', exigirEditar, responderTR(async (req) => MU.criar(supabase, req.tenantId, await quem(req), req.body)));
router.put('/multas/:id', exigirEditar, responderTR(async (req) => MU.editar(supabase, req.tenantId, await quem(req), await multaOu404(req), req.body)));
router.post('/multas/:id/status', exigirEditar, responderTR(async (req) => MU.mudarStatus(supabase, req.tenantId, await quem(req), await multaOu404(req), req.body)));
router.get('/multas/:id/arquivo', exigirVer, responderTR(async (req) => { const m = await multaOu404(req); if (!m.arquivo_path) return { status: 404, erro: 'Sem notificação anexa' }; return { url: await D.linkArquivo(supabase, m.arquivo_path), nome: m.arquivo_nome }; }));
router.get('/multas/:id/termo', exigirVer, responderTR(async (req) => MU.termoAssinado(supabase, req.tenantId, await multaOu404(req))));
router.get('/multas/:id/previa-termo', exigirEditar, responderTR(async (req) => ({ termo: MU.termoDesconto(await multaOu404(req), { valor: Number(req.query.valor) || 0, parcelas: parseInt(req.query.parcelas, 10) || 1 }) })));
router.delete('/multas/:id', exigirEditar, responderTR(async (req) => { // só cadastro errado (ainda "recebida")
  const m = await multaOu404(req);
  if (m.status !== 'recebida') return { status: 400, erro: 'Só dá para excluir multa ainda "Recebida" — depois disso, use Cancelada' };
  if (m.tarefa_id) await supabase.from('tarefas').delete().eq('id', m.tarefa_id).eq('tenant_id', req.tenantId);
  const { error } = await supabase.from('multas').delete().eq('id', m.id).eq('tenant_id', req.tenantId);
  if (error) throw new Error(error.message);
  if (m.arquivo_path) await D.removerArquivo(supabase, m.arquivo_path);
  return { ok: true };
}));

// ─── 12h: medidas disciplinares (LGPD: só admin, gestor, qualidade) ─────────
router.get('/disciplinar', exigirEditar, responderTR(async (req) => {
  const lista = await DI.listar(supabase, req.tenantId);
  const porColab = new Map();
  for (const m of lista) { const k = String(m.colaborador_id); if (!porColab.has(k)) porColab.set(k, []); porColab.get(k).push(m); }
  const resumos = Object.fromEntries([...porColab.entries()].map(([k, l]) => [k, DI.resumoColaborador(l)]));
  return { medidas: lista, resumos, tipos: DI.TIPOS, categorias: DI.CATEGORIAS };
}));
router.get('/disciplinar/sugestao/:colab', exigirEditar, responderTR(async (req) => ({ ...DI.resumoColaborador(await DI.listar(supabase, req.tenantId, { colaboradorId: req.params.colab })) })));
router.post('/disciplinar/previa', exigirEditar, responderTR((req) => DI.previa(supabase, req.tenantId, req.body || {})));
router.post('/disciplinar', exigirEditar, responderTR(async (req) => DI.criar(supabase, req.tenantId, await quem(req), req.body)));
router.post('/disciplinar/:id/ciencia', exigirEditar, responderTR(async (req) => DI.colherCiencia(supabase, req.tenantId, await quem(req), req.params.id, req.body))); // 12h.1
router.post('/disciplinar/:id/cancelar', exigirEditar, responderTR(async (req) => DI.cancelar(supabase, req.tenantId, await quem(req), req.params.id, req.body?.motivo)));
router.get('/disciplinar/:id/documento', exigirEditar, responderTR((req) => DI.documento(supabase, req.tenantId, req.params.id)));
router.get('/disciplinar/:id/arquivo', exigirEditar, responderTR((req) => DI.linkArquivo(supabase, req.tenantId, req.params.id)));

// ─── 12f: dossiê do colaborador (LGPD: só admin, gestor, qualidade; cada geração fica registrada) ──────
router.post('/colaboradores/:id/dossie', exigirEditar, async (req, res) => {
  try {
    const c = await colaboradorDoTenant(req, req.params.id);
    if (!c) return res.status(404).json({ erro: 'Colaborador não encontrado' });
    const u = await usuarioDoTenant(req, req.userId).catch(() => null);
    const r = await DS.gerar(supabase, req.tenantId, c, req.body || {}, { usuarioId: req.userId, usuarioNome: u?.nome || req.userEmail || null, ip: req.ip });
    if (r.erro) return res.status(r.status).json({ erro: r.erro });
    res.json(r);
  } catch (err) {
    if (/dossie_registros/.test(String(err.message))) return res.status(409).json({ erro: 'Rode a migration 035 antes (dossiê)' });
    erro(res, 'dossie', err);
  }
});
router.get('/colaboradores/:id/dossies', exigirEditar, async (req, res) => {
  try {
    const c = await colaboradorDoTenant(req, req.params.id);
    if (!c) return res.status(404).json({ erro: 'Colaborador não encontrado' });
    res.json({ registros: await DS.registros(supabase, req.tenantId, c.id) });
  } catch (err) {
    if (/dossie_registros/.test(String(err.message))) return res.json({ registros: [], sem_migration: true });
    erro(res, 'dossie', err);
  }
});

// ─── 12e.2b: aniversariantes do mês (só dia/mês — LGPD) ───────────────────
router.get('/aniversariantes', exigirVer, async (req, res) => {
  try {
    const hoje = TR.hojeBR();
    const mes = /^(0?[1-9]|1[0-2])$/.test(String(req.query.mes || '')) ? String(req.query.mes).padStart(2, '0') : hoje.slice(5, 7);
    const lista = await q(supabase.from('colaboradores').select('*').eq('tenant_id', req.tenantId));
    const out = lista.filter((c) => c.situacao !== 'desligado' && c.data_nascimento && String(c.data_nascimento).slice(5, 7) === mes)
      .map((c) => ({ id: c.id, nome: c.nome, funcao: c.funcao || null, dia: Number(String(c.data_nascimento).slice(8, 10)) }))
      .sort((a, b) => a.dia - b.dia || String(a.nome).localeCompare(String(b.nome)));
    res.json({ mes: Number(mes), hoje_dia: hoje.slice(5, 7) === mes ? Number(hoje.slice(8, 10)) : null, aniversariantes: out, sem_data: lista.filter((c) => c.situacao !== 'desligado' && !c.data_nascimento).length });
  } catch (err) {
    if (/data_nascimento/.test(String(err.message))) return res.json({ aniversariantes: [], sem_migration: true });
    erro(res, 'aniversariantes', err);
  }
});

// ─── 12e.2b: acesso do colaborador ("🎓 Meus treinamentos") ───────────────
// perfis efetivos (usuario_perfis; se vazio, a coluna usuarios.perfil — legado)
async function perfisDoUsuario(u) {
  const l = (await q(supabase.from('usuario_perfis').select('*').eq('usuario_id', u.id))).map((x) => x.perfil_codigo);
  return l.length ? l : [u.perfil].filter(Boolean);
}
// Cria um usuário de perfil "colaborador" (não conta na cobrança do plano) ligado ao colaborador.
router.post('/colaboradores/:id/acesso', exigirEditar, async (req, res) => {
  try {
    const c = await colaboradorDoTenant(req, req.params.id);
    if (!c) return res.status(404).json({ erro: 'Colaborador não encontrado' });
    if (c.situacao === 'desligado') return res.status(400).json({ erro: 'Colaborador desligado' });
    const email = String(req.body?.email || c.email || '').trim().toLowerCase();
    const senhaCPF = !req.body?.senha; // 12e.2b: sem senha digitada = CPF (só números) — ideia do Marcony; dá para trocar depois
    const senha = senhaCPF ? String(c.cpf || '').replace(/\D/g, '') : String(req.body.senha);
    if (senhaCPF && senha.length !== 11) return res.status(400).json({ erro: 'Colaborador sem CPF — digite uma senha' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ erro: 'Informe um e-mail válido' });
    if (senha.length < 6) return res.status(400).json({ erro: 'Senha com no mínimo 6 caracteres' });
    if (c.usuario_id) {
      const u = await usuarioDoTenant(req, c.usuario_id);
      if (u) {
        const perfis = await perfisDoUsuario(u);
        if (perfis.some((p) => p !== 'colaborador')) return res.status(409).json({ erro: `${c.nome} já tem um usuário do sistema (${u.email}) — ele já vê "Meus treinamentos" no menu dele.` });
        const { error } = await supabase.from('usuarios').update({ email, senha_hash: bcrypt.hashSync(senha, 10), ativo: 1 }).eq('id', u.id).eq('tenant_id', req.tenantId);
        if (error) throw new Error(error.message);
        return res.json({ ok: true, email, reativado: true, senha_cpf: senhaCPF });
      }
    }
    // o login procura o e-mail em todas as empresas → tem de ser único no sistema
    const mesmo = await q(supabase.from('usuarios').select('id').eq('email', email));
    if (mesmo.length) return res.status(409).json({ erro: 'Esse e-mail já é usado por outro usuário do QuotaFlow' });
    const { data, error } = await supabase.from('usuarios').insert([{ tenant_id: req.tenantId, nome: c.nome, email, senha_hash: bcrypt.hashSync(senha, 10), perfil: 'colaborador', ativo: 1 }]).select();
    if (error) throw new Error(error.message);
    const u = data[0];
    try {
      const e1 = await supabase.from('usuario_perfis').insert([{ usuario_id: u.id, perfil_codigo: 'colaborador' }]);
      if (e1.error) throw new Error(e1.error.message);
      const e2 = await supabase.from('colaboradores').update({ usuario_id: u.id, email: c.email || email }).eq('id', c.id).eq('tenant_id', req.tenantId);
      if (e2.error) throw new Error(e2.error.message);
    } catch (e) {
      await supabase.from('usuario_perfis').delete().eq('usuario_id', u.id);
      await supabase.from('usuarios').delete().eq('id', u.id).eq('tenant_id', req.tenantId);
      if (/perfil|foreign key|violates/.test(String(e.message))) return res.status(409).json({ erro: 'Rode a migration 032 antes (perfil Colaborador)' });
      throw e;
    }
    res.status(201).json({ ok: true, email, senha_cpf: senhaCPF });
  } catch (err) {
    if (/check constraint|perfil/.test(String(err.message))) return res.status(409).json({ erro: 'Rode a migration 032 antes (perfil Colaborador)' });
    erro(res, 'acesso', err);
  }
});
router.delete('/colaboradores/:id/acesso', exigirEditar, async (req, res) => {
  try {
    const c = await colaboradorDoTenant(req, req.params.id);
    if (!c || !c.usuario_id) return res.status(404).json({ erro: 'Colaborador sem acesso' });
    const u = await usuarioDoTenant(req, c.usuario_id);
    if (!u) return res.status(404).json({ erro: 'Colaborador sem acesso' });
    if ((await perfisDoUsuario(u)).some((p) => p !== 'colaborador')) return res.status(409).json({ erro: 'É um usuário do sistema — desative em Usuários' });
    const { error } = await supabase.from('usuarios').update({ ativo: 0 }).eq('id', c.usuario_id).eq('tenant_id', req.tenantId);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (err) { erro(res, 'acesso', err); }
});
// Situação do acesso (para a tela do colaborador)
router.get('/colaboradores/:id/acesso', exigirVer, async (req, res) => {
  try {
    const c = await colaboradorDoTenant(req, req.params.id);
    if (!c) return res.status(404).json({ erro: 'Colaborador não encontrado' });
    if (!c.usuario_id) return res.json({ tem: false });
    const u = await usuarioDoTenant(req, c.usuario_id);
    if (!u) return res.json({ tem: false });
    const perfis = await perfisDoUsuario(u);
    res.json({ tem: true, email: u.email, ativo: !!u.ativo, so_colaborador: perfis.length > 0 && perfis.every((p) => p === 'colaborador') });
  } catch (err) { erro(res, 'acesso', err); }
});

module.exports = router;
