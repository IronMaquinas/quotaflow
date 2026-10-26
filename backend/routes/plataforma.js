// backend/routes/plataforma.js
//
// Console da Plataforma (etapa 11b) — /api/plataforma/*
//
//   POST /login                         { email, senha }  (público)
//   GET  /me
//   GET  /visao-geral
//   GET  /pendentes                     transportadoras e fornecedores aguardando
//   GET  /transportadoras · /fornecedores   listas para consulta
//   POST /transportadoras/:id/aprovar · /recusar { motivo } · DELETE /transportadoras/:id
//   POST /fornecedores/:id/aprovar    · /recusar { motivo } · DELETE /fornecedores/:id
//   GET/POST /biblioteca/funcoes · PUT/DELETE /biblioteca/funcoes/:id   (etapa 12d.0 — modelos de função)
//   GET/POST /biblioteca/epi-tipos · PUT /biblioteca/epi-tipos/:id     (etapa 12d.1b — catálogo de EPI)
//   GET/POST /biblioteca/treinamentos · PUT/DELETE /biblioteca/treinamentos/:id  (etapa 12e.2a — conteúdo + prova)
//   POST/GET /biblioteca/treinamentos/material   (etapa 12e.2b — PDF de apoio no bucket privado)
//
// Login só para quem está em plataforma_admins (ativo) E na variável
// PLATAFORMA_ADMINS. Limite: 5 tentativas erradas por e-mail a cada 15 min.

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { DB } = require('../db');
const { plataformaMiddleware, gerarTokenPlataforma, emailAutorizado } = require('../middleware/plataformaMiddleware');
const C = require('../services/plataformaConsole');
const { supabase } = require('../db');
const F = require('../services/funcoes'); // etapa 12d.0
const E = require('../services/epi');     // etapa 12d.1b
const TR = require('../services/treinamentos'); // etapa 12e.2a
const INSP = require('../services/inspecoes'); // etapa 14a

const tentativas = new Map(); // email → { n, desde }
const JANELA_MS = 15 * 60 * 1000;
const MAX_TENTATIVAS = 5;

function bloqueado(email) {
  const t = tentativas.get(email);
  if (!t) return false;
  if (Date.now() - t.desde > JANELA_MS) { tentativas.delete(email); return false; }
  return t.n >= MAX_TENTATIVAS;
}
function falhou(email) {
  const t = tentativas.get(email);
  if (!t || Date.now() - t.desde > JANELA_MS) tentativas.set(email, { n: 1, desde: Date.now() });
  else t.n += 1;
}

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const senha = String(req.body?.senha || '');
    if (!email || !senha) return res.status(400).json({ erro: 'Informe e-mail e senha.' });
    if (bloqueado(email)) return res.status(429).json({ erro: 'Muitas tentativas. Aguarde 15 minutos.' });

    const admin = await DB.selectOne('plataforma_admins', { email });
    const ok = admin && admin.ativo !== false && emailAutorizado(email) && bcrypt.compareSync(senha, admin.senha_hash);
    if (!ok) {
      falhou(email);
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }
    tentativas.delete(email);
    await DB.update('plataforma_admins', admin.id, { ultimo_login_em: new Date().toISOString() });
    await C.registrar(admin, 'login', null, null, { ip: req.ip || null });
    res.json({ ok: true, token: gerarTokenPlataforma(admin), admin: { id: admin.id, email: admin.email, nome: admin.nome } });
  } catch (err) {
    console.error('❌ POST /plataforma/login:', err.message);
    res.status(500).json({ erro: 'Erro ao entrar no console' });
  }
});

router.use(plataformaMiddleware);

const responder = (fn) => async (req, res) => {
  try {
    const r = await fn(req);
    if (r && r.erro) return res.status(r.status || 400).json({ erro: r.erro });
    res.json(r);
  } catch (err) {
    console.error(`❌ ${req.method} /plataforma${req.path}:`, err.message);
    res.status(500).json({ erro: err.message || 'Erro no console' });
  }
};

router.get('/me', (req, res) => res.json({ admin: req.plataformaAdmin }));
router.get('/visao-geral', responder(() => C.visaoGeral()));
router.get('/pendentes', responder(() => C.pendentes()));
router.get('/transportadoras', responder(() => C.listarTransportadoras()));
router.get('/fornecedores', responder(() => C.listarFornecedores()));

router.post('/transportadoras/:id/aprovar', responder((req) => C.aprovarTransportadora(req.params.id, req.plataformaAdmin)));
router.post('/transportadoras/:id/recusar', responder((req) => C.recusarTransportadora(req.params.id, req.body?.motivo, req.plataformaAdmin)));
// 14d.5: troca de CNPJ só pela plataforma, com motivo (o gatilho do banco grava em tenant_alteracoes) + histórico da empresa
const PERFIL = require('../services/perfilEmpresa');
router.post('/transportadoras/:id/cnpj', responder(async (req) => { const r = await PERFIL.alterarCnpjPlataforma(supabase, req.params.id, req.plataformaAdmin, req.body || {}); if (!r.erro) await C.registrar(req.plataformaAdmin, 'cnpj_alterar', 'tenant', req.params.id, { antes: r.antes, depois: r.depois, motivo: String(req.body?.motivo || '').slice(0, 500) }).catch(() => {}); return r; }));
router.get('/transportadoras/:id/alteracoes', responder((req) => PERFIL.alteracoes(supabase, req.params.id)));
router.delete('/transportadoras/:id', responder((req) => C.excluirTransportadora(req.params.id, req.plataformaAdmin)));

router.post('/fornecedores/:id/aprovar', responder((req) => C.aprovarFornecedor(req.params.id, req.plataformaAdmin)));
router.post('/fornecedores/:id/recusar', responder((req) => C.recusarFornecedor(req.params.id, req.body?.motivo, req.plataformaAdmin)));
router.delete('/fornecedores/:id', responder((req) => C.excluirFornecedor(req.params.id, req.plataformaAdmin)));

// ─── Biblioteca de funções (etapa 12d.0) ──────────────────────────────────
router.get('/biblioteca/funcoes', responder(() => F.bibliotecaConsole(supabase)));
router.post('/biblioteca/funcoes', responder(async (req) => { const r = await F.criarModelo(supabase, req.body); if (!r.erro) await C.registrar(req.plataformaAdmin, 'funcao_criar', 'funcao', r.modelo.id, { nome: r.modelo.nome }).catch(() => {}); return r; }));
router.put('/biblioteca/funcoes/:id', responder(async (req) => { const r = await F.editarModelo(supabase, req.params.id, req.body); if (!r.erro) await C.registrar(req.plataformaAdmin, 'funcao_editar', 'funcao', req.params.id, { versao_subiu: r.versao_subiu }).catch(() => {}); return r; }));
router.delete('/biblioteca/funcoes/:id', responder(async (req) => { const r = await F.desativarModelo(supabase, req.params.id); if (!r.erro) await C.registrar(req.plataformaAdmin, 'funcao_desativar', 'funcao', req.params.id, null).catch(() => {}); return r; }));

// ─── Catálogo de tipos de EPI (etapa 12d.1b) ──────────────────────────────
router.get('/biblioteca/epi-tipos', responder(async () => {
  const todos = await (async () => { const { data, error } = await supabase.from('epi_tipos').select('*').is('tenant_id', null); if (error) throw new Error(error.message); return data || []; })();
  return { tipos: todos.sort((a, b) => (a.ordem - b.ordem) || String(a.nome).localeCompare(String(b.nome))), grades: E.GRADES };
}));
router.post('/biblioteca/epi-tipos', responder(async (req) => { const r = await E.criarTipoCatalogo(supabase, req.body); if (!r.erro) await C.registrar(req.plataformaAdmin, 'epi_tipo_criar', 'epi_tipo', r.tipo.id, { nome: r.tipo.nome }).catch(() => {}); return r; }));
router.put('/biblioteca/epi-tipos/:id', responder(async (req) => { const r = await E.editarTipoCatalogo(supabase, req.params.id, req.body); if (!r.erro) await C.registrar(req.plataformaAdmin, 'epi_tipo_editar', 'epi_tipo', req.params.id, null).catch(() => {}); return r; }));

// ─── Biblioteca de treinamentos (etapa 12e.2a) ────────────────────────────
router.get('/biblioteca/treinamentos', responder(() => TR.bibliotecaConsole(supabase)));
router.post('/biblioteca/treinamentos/material', responder((req) => TR.subirMaterial(supabase, 'biblioteca', { base64: req.body?.base64, nome: req.body?.nome }))); // 12e.2b — PDF de apoio
router.get('/biblioteca/treinamentos/material', responder((req) => TR.linkMaterialGestor(supabase, req.query.path, ['biblioteca/'])));
router.post('/biblioteca/treinamentos', responder(async (req) => { const r = await TR.criarModelo(supabase, req.body); if (!r.erro) await C.registrar(req.plataformaAdmin, 'treinamento_criar', 'treinamento', r.modelo.id, { nome: r.modelo.nome }).catch(() => {}); return r; }));
router.put('/biblioteca/treinamentos/:id', responder(async (req) => { const r = await TR.editarModelo(supabase, req.params.id, req.body); if (!r.erro) await C.registrar(req.plataformaAdmin, 'treinamento_editar', 'treinamento', req.params.id, { versao_subiu: r.versao_subiu }).catch(() => {}); return r; }));
router.delete('/biblioteca/treinamentos/:id', responder(async (req) => { const r = await TR.desativarModelo(supabase, req.params.id); if (!r.erro) await C.registrar(req.plataformaAdmin, 'treinamento_desativar', 'treinamento', req.params.id, null).catch(() => {}); return r; }));

// ─── Biblioteca de modelos de inspeção (etapa 14a) ────────────────────────
router.get('/biblioteca/inspecoes', responder(() => INSP.bibliotecaConsole(supabase)));
// 14d — biblioteca de modelos de contrato
const CMOD = require('../services/contratoModelos');
router.get('/biblioteca/contratos', responder(() => CMOD.bibliotecaConsole(supabase)));
router.post('/biblioteca/contratos', responder((req) => CMOD.criarBib(supabase, req.body || {})));
router.put('/biblioteca/contratos/:id', responder((req) => CMOD.editarBib(supabase, req.params.id, req.body || {})));
router.post('/biblioteca/inspecoes/imagem', responder((req) => INSP.subirImagemModelo(supabase, 'biblioteca', req.body || {})));
router.post('/biblioteca/inspecoes', responder(async (req) => { const r = await INSP.criarModeloBib(supabase, req.body); if (!r.erro) await C.registrar(req.plataformaAdmin, 'inspecao_modelo_criar', 'inspecao_modelo', r.modelo.id, { nome: r.modelo.nome }).catch(() => {}); return r; }));
router.put('/biblioteca/inspecoes/:id', responder(async (req) => { const r = await INSP.editarModeloBib(supabase, req.params.id, req.body); if (!r.erro) await C.registrar(req.plataformaAdmin, 'inspecao_modelo_editar', 'inspecao_modelo', req.params.id, { versao_subiu: r.versao_subiu }).catch(() => {}); return r; }));
router.get('/biblioteca/inspecoes/:id/imagens', responder(async (req) => { const { data } = await supabase.from('inspecao_modelos').select('*').is('tenant_id', null).eq('id', req.params.id); return { imagens: data?.[0] ? await INSP.linksImagens(supabase, data[0]) : {} }; }));

module.exports = router;
