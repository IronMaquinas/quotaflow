// routes/portalFornecedor.js

const express = require('express');
const router = express.Router();
const { DB } = require('../db');
const { v4: uuidv4 } = require('uuid');
const NotificacaoService = require('../services/NotificacaoService');
const { supabase } = require('../db');
const { enviarEmailCotacao } = require('../services/emailService');

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

    // 1. Validar token
    const cotacaoFornecedor = await DB.select(
      'cotacao_fornecedores',
      { cotacao_id: cotacaoId, token }
    );

    if (cotacaoFornecedor.length === 0) {
      return res.status(403).json({ message: 'Acesso negado. Token inválido ou expirado.' });
    }

    const cotacaoFornecedorData = cotacaoFornecedor[0];
    const tenantId = cotacaoFornecedorData.tenant_id;

    // 2. Buscar cotação
    const cotacao = await DB.selectOne('cotacoes', { id: cotacaoId }, tenantId);
    if (!cotacao) {
      return res.status(404).json({ message: 'Cotação não encontrada' });
    }

    // 3. Buscar empresa
    const empresa = await DB.selectOne('tenants', { id: tenantId });

    // 4. Buscar fornecedor
    const fornecedor = await DB.selectOne('fornecedores', { id: cotacaoFornecedorData.fornecedor_id }, tenantId);

    // 5. 🔥 Buscar itens com nome usando SUPABASE NATIVO
    const { data: itens, error } = await supabase
      .from('cotacao_itens')
      .select(`
        *,
        chamado_itens (
          item_nome,
          codigo,
          descricao
        )
      `)
      .eq('cotacao_id', cotacaoId)
      .eq('tenant_id', tenantId);

    if (error) throw new Error(`Erro ao buscar itens: ${error.message}`);

    const itensFormatados = itens.map(item => ({
      ...item,
      item_nome: item.chamado_itens?.item_nome || 'Item sem nome',
      codigo: item.chamado_itens?.codigo || '',
      descricao: item.chamado_itens?.descricao || ''
    }));

    // 6. Buscar respostas existentes (opcional)
    const respostasExistentes = await DB.select(
      'cotacao_fornecedores',
      { cotacao_id: cotacaoId, fornecedor_id: cotacaoFornecedorData.fornecedor_id },
      tenantId
    );

    return res.json({
      cotacao: cotacao[0],
      fornecedor: fornecedor[0],
      empresa: empresa[0],
      itens: itensFormatados,
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
    const { respostas } = req.body;

    // 🔥 1. VALIDAR TOKEN E OBTER DADOS DO FORNECEDOR
    const cotacaoFornecedor = await DB.select(
      'cotacao_fornecedores',
      { cotacao_id: cotacaoId, token }
    );

    if (cotacaoFornecedor.length === 0) {
      return res.status(403).json({ message: 'Acesso negado. Token inválido.' });
    }

    const fornData = cotacaoFornecedor[0];
    // 🟢 DECLARE TODAS AS VARIÁVEIS AQUI, ANTES DE USAR EM QUALQUER QUERY
    const tenantId = fornData.tenant_id;
    const fornecedorId = fornData.fornecedor_id;
    const cotacaoFornecedorId = fornData.id;

    // 🔥 2. VALIDAR SE O FORNECEDOR JÁ RESPONDEU
    if (fornData.status === 'respondido') {
      return res.status(400).json({ message: 'Esta cotação já foi respondida.' });
    }

    // 🔥 3. CALCULAR VALOR TOTAL
    const valorTotal = respostas.reduce((acc, r) => {
      const valor = parseFloat(r.valor || 0);
      return acc + (valor * (r.quantidade || 1));
    }, 0);

    // 🔥 4. ATUALIZAR COTAÇÃO_FORNECEDORES
    await DB.update(
      'cotacao_fornecedores',
      cotacaoFornecedorId,
      {
        status: 'respondido',
        valor: valorTotal,
        data_resposta: new Date(),
        obs: respostas[0]?.observacoes || '',
        prazo: parseInt(respostas[0]?.prazo || 0),
        frete: respostas.reduce((acc, r) => acc + parseFloat(r.frete || 0), 0),
        token_acesso: require('uuid').v4() // Gera novo token (opcional)
      },
      tenantId
    );

    // 🔥 5. INSERIR ITENS RESPONDIDOS
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

    // 🔥 6. VERIFICAR SE TODOS OS FORNECEDORES RESPONDERAM
    const total = await DB.select('cotacao_fornecedores', { cotacao_id: cotacaoId });
    const respondidos = await DB.select('cotacao_fornecedores', { cotacao_id: cotacaoId, status: 'respondido' });
    if (total.length === respondidos.length) {
      await DB.update('cotacoes', cotacaoId, { status: 'respondida' }, tenantId);
    }

    // 7. ENVIAR E‑MAIL DE CONFIRMAÇÃO PARA O FORNECEDOR (e/ou comprador)
    try {
      const { enviarEmailCotacao } = require('../services/emailService');
      const fornecedor = await DB.selectOne('fornecedores', { id: fornecedorId }, tenantId);
      const empresa = await DB.selectOne('tenants', { id: tenantId });
      const cotacao = await DB.selectOne('cotacoes', { id: cotacaoId }, tenantId);

      const assunto = `Proposta enviada com sucesso - Cotação ${cotacao.numero || cotacaoId}`;
      const corpo = `
        <h2>Proposta enviada!</h2>
        <p>Olá ${fornecedor?.nome || 'Fornecedor'},</p>
        <p>Sua proposta para a cotação <strong>${cotacao.numero || cotacaoId}</strong> foi enviada com sucesso para ${empresa?.nome || 'a empresa'}.</p>
        <p><strong>Valor total:</strong> R$ ${valorTotal.toFixed(2).replace('.', ',')}</p>
        <p><strong>Prazo:</strong> ${parseInt(respostas[0]?.prazo || 0)} dias úteis</p>
        <p>Aguardamos o retorno do comprador.</p>
        <hr>
        <p><small>Esta é uma mensagem automática. Não responda este e-mail.</small></p>
      `;

      await enviarEmailCotacao(fornecedor?.email, assunto, corpo);
      console.log(`✅ E‑mail de confirmação enviado para ${fornecedor?.email}`);
    } catch (err) {
      console.error('❌ Falha ao enviar e‑mail de confirmação:', err.message);
      // Não interrompe o fluxo
    }

    return res.json({
      sucesso: true,
      message: 'Resposta registrada com sucesso!',
      valorTotal
    });

  } catch (erro) {
    console.error('Erro em POST /portal/cotacao/.../responder:', erro);
    return res.status(500).json({ message: 'Erro ao processar resposta', error: erro.message });
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
