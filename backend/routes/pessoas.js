// routes/pessoas.js — etapa 12c: colaboradores e documentos com vencimento
//                     etapa 12d.0: funções (cargos) + biblioteca + ficha do colaborador
// Registrado no server.js com tenantMiddleware: app.use('/api/pessoas', tenantMiddleware, ...)
//
// Ver:     admin, gestor, qualidade, operacao   (CPF só aparece para quem edita — LGPD)
// Editar:  admin, gestor, qualidade
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const D = require('../services/documentos');
const F = require('../services/funcoes'); // etapa 12d.0

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
    return res.status(409).json({ erro: 'Rode a migration 024 antes (funções)' });
  }
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
    const out = lista.map((c) => {
      const meus = docs.filter((d) => String(d.colaborador_id) === String(c.id));
      const ficha = fichas.get(String(c.id));
      return {
        ...c,
        funcao_nome: ficha?.funcao?.nome || c.funcao || null,
        exigidos: ficha?.resumo?.total || 0,
        pendencias: ficha?.resumo?.pendencias || 0,
        cpf: editar ? c.cpf : (c.cpf ? `***.***.***-${c.cpf.slice(-2)}` : null), // LGPD: CPF completo só para quem edita
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
    if (dados.usuario_id && !(await usuarioDoTenant(req, dados.usuario_id))) return res.status(400).json({ erro: 'Usuário não encontrado' });
    const fe = await conferirFuncao(req, dados); if (fe) return res.status(400).json({ erro: fe });
    const { data, error } = await supabase.from('colaboradores').insert([{ ...dados, tenant_id: req.tenantId }]).select();
    if (error) throw new Error(error.message);
    res.status(201).json(data[0]);
  } catch (err) { erro(res, 'colaboradores', err); }
});

router.put('/colaboradores/:id', exigirEditar, async (req, res) => {
  try {
    const c = await colaboradorDoTenant(req, req.params.id);
    if (!c) return res.status(404).json({ erro: 'Colaborador não encontrado' });
    const { erros, dados } = D.validarColaborador(req.body || {}, { parcial: true });
    if (erros.length) return res.status(400).json({ erro: erros[0], erros });
    if (dados.usuario_id && !(await usuarioDoTenant(req, dados.usuario_id))) return res.status(400).json({ erro: 'Usuário não encontrado' });
    const fe = await conferirFuncao(req, dados); if (fe) return res.status(400).json({ erro: fe });
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
  try { res.json({ funcoes: await F.listarFuncoes(supabase, req.tenantId), pode_editar: podeEditar(req) }); }
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
    res.json({
      colaborador: { id: c.id, nome: c.nome, situacao: c.situacao, funcao_id: c.funcao_id, funcao: c.funcao },
      funcao: f.funcao ? { id: f.funcao.id, nome: f.funcao.nome, descritivo: f.funcao.descritivo, requisitos: f.funcao.requisitos } : null,
      itens: f.itens, resumo: f.resumo, pode_editar: podeEditar(req),
    });
  } catch (err) { erro(res, 'ficha', err); }
});

module.exports = router;
