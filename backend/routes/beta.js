// routes/beta.js — etapa B1: 👋 POST /api/beta — pergunta à Beta (B1.5: todos os perfis internos; cada consulta tem os seus; só consulta)
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const B = require('../services/beta');
const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));

// sugestões do painel conforme o perfil
router.get('/consultas', (req, res) => {
  const perfis = perfisDe(req); const gestor = perfis.some((p) => ['admin', 'gestor'].includes(p));
  res.json({ sugestoes: [...(gestor ? ['Como está minha empresa hoje?', 'Cria uma tarefa para revisar o contrato até sexta'] : []), ...require('../services/betaConsultas').permitidas(perfis).map((c) => c.exemplo)] });
});

// B3: ✓ confirma a ação proposta pela Beta (token assinado, 15 min, só quem pediu)
router.post('/confirmar', async (req, res) => {
  try {
    const perfis = perfisDe(req); if (!perfis.some((p) => ['admin', 'gestor'].includes(p))) return res.status(403).json({ erro: 'Ações da Beta são para a gestão.' });
    let nome = null; try { const { data } = await supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId).eq('id', req.userId); nome = data?.[0]?.nome || null; } catch { /* ok */ }
    const r = await require('../services/betaAcoes').confirmar(supabase, { tenantId: req.tenantId, userId: req.userId, perfis, quem: { id: req.userId, nome: nome || 'gestor' } }, req.body?.token);
    if (r.erro) return res.status(r.status || 400).json(r); res.json(r);
  } catch (err) { console.error('❌ [beta] confirmar', err.message); res.status(500).json({ erro: 'Não consegui confirmar agora.' }); }
});

// B4: 🎤🔊 voz (gestor/admin) — o front pergunta o modo; neural fala/ouve pelo servidor, senão usa o navegador
//   B5.0: GET /voz traz os interruptores da empresa (Console); falar/ouvir só no modo Conversa e dentro do teto do mês
const gestorDe = (req) => perfisDe(req).some((p) => ['admin', 'gestor'].includes(p));
router.get('/voz', async (req, res) => { if (!gestorDe(req)) return res.json({ permitido: false }); try { let nome = ''; try { const { data } = await supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId).eq('id', req.userId); nome = data?.[0]?.nome || ''; } catch { /* ok */ } res.json({ ...(await require('../services/betaVoz').publico(supabase, req.tenantId)), permitido: true, nome }); } catch { res.json({ provedor: 'navegador', chat_mic: true, chat_fala: false, conversa: 'desligado', permitido: true }); } });
router.post('/voz/falar', async (req, res) => {
  if (!gestorDe(req)) return res.status(403).json({ erro: 'Voz da Beta é para a gestão.' });
  try { const r = await require('../services/betaVoz').falar(supabase, req.tenantId, req.body?.texto); if (r.erro) return res.status(r.status || 400).json(r); res.json(r); }
  catch (err) { console.error('❌ [voz] falar', err.message); res.status(502).json({ erro: 'Voz indisponível agora.', reserva: true }); }
});
router.post('/voz/ouvir', async (req, res) => {
  if (!gestorDe(req)) return res.status(403).json({ erro: 'Voz da Beta é para a gestão.' });
  try { const r = await require('../services/betaVoz').transcrever(supabase, req.tenantId, req.body?.audio, req.body?.tipo); if (r.erro) return res.status(r.status || 400).json(r); res.json(r); }
  catch (err) { console.error('❌ [voz] ouvir', err.message); res.status(502).json({ erro: 'Não consegui entender agora.', reserva: true }); }
});

// B5.1: 🚗 pedido que não deu para resolver dirigindo → tarefa para a própria pessoa
router.post('/lembrete', async (req, res) => {
  if (!gestorDe(req)) return res.status(403).json({ erro: 'Só para a gestão.' });
  try { let nome = null; try { const { data } = await supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId).eq('id', req.userId); nome = data?.[0]?.nome || null; } catch { /* ok */ }
    const r = await require('../services/betaAcoes').lembrete(supabase, { tenantId: req.tenantId, userId: req.userId, quem: { id: req.userId, nome: nome || 'gestor' } }, req.body?.texto, req.body?.motivo);
    if (r.erro) return res.status(r.status || 400).json(r); res.json(r); }
  catch (err) { console.error('❌ [beta] lembrete', err.message); res.status(500).json({ erro: 'Não consegui anotar agora.' }); }
});

router.post('/', async (req, res) => {
  const perfis = perfisDe(req);
  if (!perfis.some((p) => ['admin', 'gestor'].includes(p))) return res.status(403).json({ erro: 'A Beta está disponível para gestores nesta fase.' }); // B1.9: só gestão enquanto valida (as consultas já têm perfis — liberar = trocar esta linha e a do App.jsx)
  try {
    let nome = ''; try { const { data } = await supabase.from('usuarios').select('nome').eq('id', req.userId).limit(1); nome = data?.[0]?.nome || ''; } catch { /* segue */ }
    const r = await B.perguntar(supabase, { tenantId: req.tenantId, userId: req.userId, perfis, nome, mensagens: req.body?.mensagens, modo: req.body?.modo === 'conversa' ? 'conversa' : '' });
    if (r.erro) return res.status(r.status || 400).json(r);
    res.json(r);
  } catch (err) { console.error('❌ beta:', err.message); res.status(500).json({ erro: 'A Beta não conseguiu responder agora.' }); }
});

module.exports = router;
