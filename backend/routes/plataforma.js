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
//
// Login só para quem está em plataforma_admins (ativo) E na variável
// PLATAFORMA_ADMINS. Limite: 5 tentativas erradas por e-mail a cada 15 min.

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { DB } = require('../db');
const { plataformaMiddleware, gerarTokenPlataforma, emailAutorizado } = require('../middleware/plataformaMiddleware');
const C = require('../services/plataformaConsole');

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
router.delete('/transportadoras/:id', responder((req) => C.excluirTransportadora(req.params.id, req.plataformaAdmin)));

router.post('/fornecedores/:id/aprovar', responder((req) => C.aprovarFornecedor(req.params.id, req.plataformaAdmin)));
router.post('/fornecedores/:id/recusar', responder((req) => C.recusarFornecedor(req.params.id, req.body?.motivo, req.plataformaAdmin)));
router.delete('/fornecedores/:id', responder((req) => C.excluirFornecedor(req.params.id, req.plataformaAdmin)));

module.exports = router;
