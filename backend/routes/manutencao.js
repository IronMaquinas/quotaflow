// routes/manutencao.js — etapa 12a: calendário anual de manutenção (só leitura)
// Registrado no server.js com tenantMiddleware: app.use('/api/manutencao', tenantMiddleware, ...)
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const { montarCalendario, carregar } = require('../services/calendarioManutencao');

const DATA = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/manutencao/calendario?de=2026-01-01&ate=2026-12-31&equipamento_id=
router.get('/calendario', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(401).json({ erro: 'Não autenticado' });

    const { de, ate } = req.query;
    if (!DATA.test(String(de || '')) || !DATA.test(String(ate || ''))) {
      return res.status(400).json({ erro: 'Informe de e ate no formato AAAA-MM-DD' });
    }
    if (de > ate) return res.status(400).json({ erro: '"de" depois de "ate"' });
    const dias = (new Date(ate) - new Date(de)) / 86400000;
    if (dias > 400) return res.status(400).json({ erro: 'Intervalo máximo de 400 dias' });

    const equipamentoId = req.query.equipamento_id ? String(req.query.equipamento_id) : null;
    const dados = await carregar(supabase, tenantId, { de, ate, equipamentoId });
    res.json({ de, ate, ...montarCalendario(dados) });
  } catch (err) {
    console.error('❌ [manutencao/calendario]', err.message);
    res.status(500).json({ erro: 'Erro ao montar o calendário' });
  }
});

module.exports = router;
