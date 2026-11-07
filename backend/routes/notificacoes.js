// backend/routes/notificacoes.js — etapa 18n: 🔔 Central de Notificações
//   /api/notificacoes            → usuário do sistema (tenantMiddleware)
//   /api/notificacoes-fornecedor → usuário do portal do fornecedor (fornecedorMiddleware) — o aviso é da empresa fornecedora
//   GET  /?desde=<versão>&esperar=1   lista (segura até chegar algo novo, ~25 s)
//   POST /:id/lida · POST /lidas (todas)
const express = require('express');
const { supabase } = require('../db');
const N = require('../services/notificacoes');
function rotas(destDe) {
  const r = express.Router();
  const resp = (fn) => async (req, res) => { try { const x = await fn(req); if (x && x.erro) return res.status(x.status || 400).json({ erro: x.erro }); res.json(x); } catch (e) { console.error('❌ [notificacoes]', e.message); res.status(500).json({ erro: 'Erro interno' }); } };
  r.get('/', resp((req) => N.listar(supabase, destDe(req), { desde: Number(req.query.desde) || 0, esperar: req.query.esperar === '1' })));
  r.post('/lidas', resp((req) => N.marcarLida(supabase, destDe(req), req.body?.chave ? { chave: String(req.body.chave) } : { todas: true }))); // 18q: { chave } marca só o assunto
  r.post('/:id/lida', resp((req) => N.marcarLida(supabase, destDe(req), { id: req.params.id })));
  return r;
}
module.exports = { usuario: rotas((req) => ({ tipo: 'usuario', id: req.userId })), fornecedor: rotas((req) => ({ tipo: 'fornecedor', id: req.fornecedorId })) };
