// routes/portalFornecedor.js

const express = require('express');
const router = express.Router();
const { DB } = require('../db');
const { v4: uuidv4 } = require('uuid');
const NotificacaoService = require('../services/NotificacaoService');

const notificacao = new NotificacaoService();

/**
 * GET /api/portal/cotacao/:cotacaoId/:token
 * Retorna dados da cotação para o fornecedor responder (sem autenticação)
 * Token valida se o fornecedor tem acesso
 */
router.get('/portal/cotacao/:cotacaoId/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const cotacaoId = parseInt(req.params.cotacaoId, 10); // ✅ CONVERTER PARA NÚMERO!

    if (!cotacaoId || isNaN(cotacaoId)) {
      return res.status(400).json({ message: 'ID da cotação inválido' });
    }

    // 1. Validar token
    const cotacaoFornecedor = await DB.select(
      'cotacao_fornecedores',
      { cotacao_id: cotacaoId, token }
    );

    if (cotacaoFornecedor.length === 0) {
      return res.status(403).json({ 
        message: 'Acesso negado. Token inválido ou expirado.' 
      });
    }

    const cotacaoFornecedorData = cotacaoFornecedor[0];
    const tenantId = cotacaoFornecedorData.tenant_id;

// 2. Buscar dados da cotação (1 resultado = DB.selectOne)
    const cotacao = await DB.selectOne(
      'cotacoes',
      { id: cotacaoId },
      tenantId
    );
 
    if (!cotacao) {
      return res.status(404).json({ message: 'Cotação não encontrada' });
    }
 
    // 3. Buscar dados da empresa (tenant) (1 resultado = DB.selectOne)
    const empresa = await DB.selectOne(
      'tenants',
      { id: tenantId }
    );
 
    // 4. Buscar dados do fornecedor (1 resultado = DB.selectOne)
    const fornecedor = await DB.selectOne(
      'fornecedores',
      { id: cotacaoFornecedorData.fornecedor_id },
      tenantId
    );
 
    // 5. Buscar itens da cotação (vários resultados = DB.select)
    const itens = await DB.select(
      'cotacao_itens',
      { cotacao_id: cotacaoId },
      tenantId
    );
 
    // 6. Buscar respostas já existentes (vários resultados = DB.select)
    const respostasExistentes = await DB.select(
      'cotacao_fornecedores',
      { 
        cotacao_id: cotacaoId, 
        fornecedor_id: cotacaoFornecedorData.fornecedor_id 
      },
      tenantId
    );

    return res.json({
      cotacao: cotacao[0],
      fornecedor: fornecedor[0],
      empresa: empresa[0],
      itens: itens,
      respostasExistentes: respostasExistentes[0] || null
    });

  } catch (erro) {
    console.error('Erro em GET /portal/cotacao:', erro);
    return res.status(500).json({ 
      message: 'Erro ao carregar cotação',
      error: process.env.NODE_ENV === 'development' ? erro.message : undefined
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
    const { fornecedorId, respostas } = req.body;

    // Validação de input
    if (!fornecedorId || !Array.isArray(respostas) || respostas.length === 0) {
      return res.status(400).json({ 
        message: 'Dados inválidos. Fornecedor e respostas são obrigatórios.' 
      });
    }

    // 1. Validar token
    const cotacaoFornecedor = await DB.select(
      'cotacao_fornecedores',
      { cotacao_id: cotacaoId, token, fornecedor_id: fornecedorId },
      tenantId
    );

    if (cotacaoFornecedor.length === 0) {
      return res.status(403).json({ 
        message: 'Acesso negado. Token ou fornecedor inválido.' 
      });
    }

    const { tenant_id: tenantId, id: cotacaoFornecedorId } = cotacaoFornecedor[0];

    // 2. Calcular valor total
    const valorTotal = respostas.reduce((acc, r) => {
      const valor = parseFloat(r.valor || 0);
      const qtd = parseFloat(r.quantidade || 1);
      return acc + (valor * qtd);
    }, 0);

    // 3. Atualizar COTACAO_FORNECEDORES com resposta
    const dataResposta = new Date();
    
    await DB.update(
      'cotacao_fornecedores',
      cotacaoFornecedorId,
      {
        status: 'respondido',
        valor: valorTotal,
        data_resposta: dataResposta,
        obs: respostas[0]?.observacoes || '',
        prazo: respostas[0]?.prazo || 0,
        frete: respostas.reduce((acc, r) => acc + parseFloat(r.frete || 0), 0),
        token_acesso: uuidv4()
      },
      tenantId
    );

    // 4. Registrar detalhes de cada item respondido
    for (const resposta of respostas) {
      await DB.insert(
        'cotacao_fornecedor_itens',
        {
          tenant_id: tenantId,
          cotacao_fornecedor_id: cotacaoFornecedorId,
          cotacao_item_id: resposta.itemId || null,
          chamado_item_id: resposta.chamadoItemId || null,
          valor: parseFloat(resposta.valor || 0),
          prazo: parseInt(resposta.prazo || 0),
          frete: parseFloat(resposta.frete || 0),
          criado_em: new Date().toISOString()
        },
        tenantId
      );
    }

    // 5. Atualizar status da COTACAO (se todas as respondidas, muda pra "respondida")
    const totalFornecedores = await DB.select(
      'cotacao_fornecedores',
      { cotacao_id: cotacaoId }
    );

    const respondidos = await DB.select(
      'cotacao_fornecedores',
      { cotacao_id: cotacaoId, status: 'respondido' }
    );

    // Se todos responderam, atualizar status da cotação
    if (totalFornecedores.length === respondidos.length) {
      await DB.update(
        'cotacoes',
        cotacaoId,
        { status: 'respondida' },
        tenantId
      );
    }

    // 6. Notificar compradores sobre a resposta
    try {
      await notificacao.notificarRespostaCotacao(cotacaoId, fornecedorId, tenantId);
    } catch (erro) {
      console.error('Erro ao notificar compradores:', erro);
      // Continuar mesmo se notificação falhar
    }

    // 7. Registrar no histórico
    await DB.insert(
      'notificacoes',
      {
        tenant_id: tenantId,
        fornecedor_id: fornecedorId,
        cotacao_id: cotacaoId,
        tipo: 'cotacao_respondida',
        metodo: 'portal',
        sucesso: true,
        criado_em: new Date().toISOString()
      },
      tenantId
    );

    return res.json({
      sucesso: true,
      message: 'Resposta registrada com sucesso!',
      valorTotal,
      dataResposta
    });

  } catch (erro) {
    console.error('Erro em POST /portal/cotacao/.../responder:', erro);
    return res.status(500).json({ 
      message: 'Erro ao processar resposta',
      error: process.env.NODE_ENV === 'development' ? erro.message : undefined
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

    // Validar token
    const cotacaoFornecedor = await DB.select(
      'cotacao_fornecedores',
      { cotacao_id: cotacaoId, token }
    );

    if (cotacaoFornecedor.length === 0) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const { tenant_id: tenantId } = cotacaoFornecedor[0];

    // Buscar status
    const cotacao = await DB.selectOne(
      'cotacoes',
      { id: cotacaoId },
      tenantId
    );

    return res.json({
      status: cotacao[0]?.status,
      respondido: cotacaoFornecedor[0].status === 'respondido',
      dataResposta: cotacaoFornecedor[0].data_resposta
    });

  } catch (erro) {
    console.error('Erro em GET /portal/.../status:', erro);
    return res.status(500).json({ message: 'Erro ao verificar status' });
  }
});

module.exports = router;
