// backend/routes/provaPublica.js — etapa 12e.2b
//
// Link externo da prova — /api/prova/:token (PÚBLICO, sem login). "Em último caso", para quem não tem usuário.
//   GET  /:token                   nome do treinamento e da empresa (para a tela de entrada)
//   POST /:token/entrar            { cpf, nascimento } → { sessao } (vale 3 h; segredo diferente do login do sistema)
//   Com o cabeçalho X-Sessao-Prova:
//   GET  /:token/treinamento       conteúdo + prova sem gabarito
//   GET  /:token/material/:i       link (1 h) do PDF de apoio
//   POST /:token/prova             { respostas }
//   POST /:token/concluir          sem prova: "Concluí o conteúdo"
// Limite: 8 identificações erradas por link + IP a cada 15 min.

const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const P = require('../services/provaOnline');

const erros = new Map(); // `${token}|${ip}` → { n, desde }
const JANELA = 15 * 60 * 1000, MAX = 8;
const chave = (req) => `${req.params.token}|${req.ip}`;
function bloqueado(k) { const e = erros.get(k); if (!e) return false; if (Date.now() - e.desde > JANELA) { erros.delete(k); return false; } return e.n >= MAX; }
function errou(k) { const e = erros.get(k); if (!e || Date.now() - e.desde > JANELA) erros.set(k, { n: 1, desde: Date.now() }); else e.n++; }

const responder = (fn, { sessao = false } = {}) => async (req, res) => {
  try {
    if (sessao) {
      const s = P.lerSessao(req.headers['x-sessao-prova']);
      const turma = s ? await P.turmaPorLink(supabase, req.params.token) : null;
      if (!s || !turma || String(turma.id) !== String(s.turmaId) || String(turma.tenant_id) !== String(s.tenantId)) return res.status(401).json({ erro: 'Sessão expirada — entre de novo com CPF e data de nascimento.' });
      req.sessao = s;
    }
    const r = await fn(req);
    if (r && r.erro) return res.status(r.status || 400).json({ erro: r.erro });
    res.json(r);
  } catch (err) {
    const m = String(err?.message || '');
    if (/treinamento_tentativas|tentativas_extra|link_token|data_nascimento/.test(m)) return res.status(409).json({ erro: 'Prova online ainda não disponível (migration 032).' });
    console.error('❌ [prova pública]', m);
    res.status(500).json({ erro: 'Erro interno' });
  }
};

router.get('/:token', responder((req) => P.infoLink(supabase, req.params.token)));
router.post('/:token/entrar', responder(async (req) => {
  const k = chave(req);
  if (bloqueado(k)) return { status: 429, erro: 'Muitas tentativas. Aguarde 15 minutos.' };
  const r = await P.identificar(supabase, req.params.token, { cpf: req.body?.cpf, nascimento: req.body?.nascimento });
  if (r.status === 401) errou(k); else if (!r.erro) erros.delete(k);
  return r;
}));
router.get('/:token/treinamento', responder((req) => P.abrir(supabase, req.sessao.tenantId, req.sessao.colaboradorId, req.sessao.turmaId), { sessao: true }));
router.get('/:token/material/:i', responder((req) => P.linkMaterial(supabase, req.sessao.tenantId, req.sessao.colaboradorId, req.sessao.turmaId, req.params.i), { sessao: true }));
router.post('/:token/prova', responder((req) => P.enviarProva(supabase, req.sessao.tenantId, req.sessao.colaboradorId, req.sessao.turmaId, { respostas: req.body?.respostas, meio: 'link', ip: req.ip }), { sessao: true }));
router.post('/:token/concluir', responder((req) => P.concluirSemProva(supabase, req.sessao.tenantId, req.sessao.colaboradorId, req.sessao.turmaId, { meio: 'link' }), { sessao: true }));

module.exports = router;
