// backend/routes/meusTreinamentos.js — etapa 12e.2b
//
// "🎓 Meus treinamentos" — /api/meus-treinamentos (colaborador LOGADO; o usuário precisa estar ligado a um
// colaborador em colaboradores.usuario_id). Qualquer perfil ligado a um colaborador também pode usar.
//   GET  /                         pendentes (turmas online abertas) + histórico + ⏱ horas
//   GET  /:turma                   conteúdo + prova sem gabarito
//   GET  /:turma/material/:i       link (1 h) do PDF de apoio da seção i
//   POST /:turma/prova             { respostas: [índice por pergunta] }
//   POST /:turma/concluir          treinamento sem prova: "Concluí o conteúdo"

const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const P = require('../services/provaOnline');

const responder = (fn) => async (req, res) => {
  try {
    const col = await P.colaboradorDoUsuario(supabase, req.tenantId, req.userId);
    if (!col) return res.status(404).json({ erro: 'Seu usuário não está ligado a um colaborador. Fale com o RH/SESMT.' });
    if (col.situacao === 'desligado') return res.status(403).json({ erro: 'Cadastro desligado' });
    req.colaborador = col;
    const r = await fn(req);
    if (r && r.erro) return res.status(r.status || 400).json({ erro: r.erro });
    res.json(r);
  } catch (err) {
    const m = String(err?.message || '');
    if (/treinamento_tentativas|tentativas_extra|link_token/.test(m)) return res.status(409).json({ erro: 'Rode a migration 032 antes (prova online)' });
    console.error('❌ [meus-treinamentos]', m);
    res.status(500).json({ erro: 'Erro interno — veja o log do servidor' });
  }
};

router.get('/', responder(async (req) => ({ colaborador: { nome: req.colaborador.nome, funcao: req.colaborador.funcao || null }, ...(await P.meusTreinamentos(supabase, req.tenantId, req.colaborador.id)) })));
router.get('/:turma', responder((req) => P.abrir(supabase, req.tenantId, req.colaborador.id, req.params.turma)));
router.get('/:turma/material/:i', responder((req) => P.linkMaterial(supabase, req.tenantId, req.colaborador.id, req.params.turma, req.params.i)));
router.post('/:turma/prova', responder((req) => P.enviarProva(supabase, req.tenantId, req.colaborador.id, req.params.turma, { respostas: req.body?.respostas, meio: 'logado', usuarioId: req.userId, ip: req.ip })));
router.post('/:turma/concluir', responder((req) => P.concluirSemProva(supabase, req.tenantId, req.colaborador.id, req.params.turma, { meio: 'logado' })));

module.exports = router;
