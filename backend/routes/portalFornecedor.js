// routes/portalFornecedor.js

const express = require('express');
const router = express.Router();
const { DB } = require('../db');
const { v4: uuidv4 } = require('uuid');
const NotificacaoService = require('../services/NotificacaoService');
const { supabase } = require('../db');
const { enviarEmailCotacao } = require('../services/emailService');
const PortalRespostaService = require('../services/PortalRespostaService');

const notificacao = new NotificacaoService();

/**
 * GET /api/portal/cotacao/:cotacaoId/:token
 * Retorna dados da cotação para o fornecedor responder (sem autenticação)
 * Token valida se o fornecedor tem acesso
 */
router.get('/portal/cotacao/:cotacaoId/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const cotacaoId = parseInt(req.params.cotacaoId, 10);

    if (!cotacaoId || isNaN(cotacaoId)) {
      return res.status(400).json({ message: 'ID da cotação inválido' });
    }

    if (!token || token === 'null' || token === 'undefined' || String(token).trim() === '') {
      return res.status(403).json({ message: 'Acesso negado. Token inválido.' });
    }

    // Resolve fornData por token (filtro em JS — ver comentário histórico)
    const todosFornsDaCotacao = await DB.select(
      'cotacao_fornecedores',
      { cotacao_id: cotacaoId }
    );
    const fornData = todosFornsDaCotacao.find(
      cf => String(cf.token_acesso) === String(token)
    );

    if (!fornData) {
      return res.status(403).json({ message: 'Acesso negado. Token inválido ou expirado.' });
    }

    // Daqui pra frente é 100% compartilhado com o modo autenticado —
    // ver PortalRespostaService.carregarParaResposta.
    const payload = await PortalRespostaService.carregarParaResposta(fornData);
    return res.json(payload);

  } catch (erro) {
    console.error('Erro em GET /portal/cotacao:', erro);
    return res.status(500).json({
      message: 'Erro ao carregar cotação',
      error: process.env.NODE_ENV === 'development' ? erro.message : undefined,
    });
  }
});

/**
 * POST /api/portal/cotacao/:cotacaoId/:token/responder
 * Fornecedor submete suas respostas
 */
router.post('/portal/cotacao/:cotacaoId/:token/responder', async (req, res) => {
  try {
    const { cotacaoId, token } = req.params;
    const { respostas, validade_dias } = req.body;

    if (!Array.isArray(respostas) || respostas.length === 0) {
      return res.status(400).json({ message: 'Nenhuma resposta enviada.' });
    }

    let validadeDias = parseInt(validade_dias, 10);
    if (!Number.isFinite(validadeDias) || validadeDias < 1) validadeDias = 30;
    if (validadeDias > 365) validadeDias = 365;

    if (!token || token === 'null' || token === 'undefined' || String(token).trim() === '') {
      return res.status(403).json({ message: 'Acesso negado. Token inválido.' });
    }

    const todosFornsDaCotacao = await DB.select(
      'cotacao_fornecedores',
      { cotacao_id: cotacaoId }
    );
    const fornData = todosFornsDaCotacao.find(
      cf => String(cf.token_acesso) === String(token)
    );

    if (!fornData) {
      return res.status(403).json({ message: 'Acesso negado. Token inválido.' });
    }

    const { valorTotal } = await PortalRespostaService.responderPortal(
      fornData,
      respostas,
      validadeDias
    );

    return res.json({
      sucesso: true,
      message: 'Resposta registrada com sucesso!',
      valorTotal,
    });

  } catch (erro) {
    console.error('Erro em POST /portal/cotacao/.../responder:', erro);
    return res.status(500).json({
      message: erro.message || 'Erro ao processar resposta',
    });
  }
});

/**
 * GET /api/portal/cotacao/:cotacaoId/:token/status
 * Verificar status atual da cotação (para fornecedor)
 */
router.get('/portal/cotacao/:cotacaoId/:token/status', async (req, res) => {
  try {
    const { cotacaoId, token } = req.params;

    // 🔥 Validar token_acesso (NÃO token)
    if (!token || token === 'null' || token === 'undefined' || String(token).trim() === '') {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const todosFornsDaCotacao = await DB.select(
      'cotacao_fornecedores',
      { cotacao_id: cotacaoId }
    );
    const fornData = todosFornsDaCotacao.find(
      cf => String(cf.token_acesso) === String(token)
    );

    if (!fornData) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const cotacaoFornecedor = [fornData]; // mantém compat com o restante
    const { tenant_id: tenantId } = fornData;

    // FIX (2026-09): mesmo bug do "[0]" em cima de DB.selectOne — o valor
    // já vem como objeto direto, não array.
    const cotacao = await DB.selectOne(
      'cotacoes',
      { id: cotacaoId },
      tenantId
    );

    return res.json({
      status: cotacao?.status,
      respondido: cotacaoFornecedor[0].status === 'respondido',
      dataResposta: cotacaoFornecedor[0].data_resposta
    });

  } catch (erro) {
    console.error('Erro em GET /portal/.../status:', erro);
    return res.status(500).json({ message: 'Erro ao verificar status' });
  }
});

module.exports = router;
