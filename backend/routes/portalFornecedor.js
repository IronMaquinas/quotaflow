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

    // 🔥 BUSCAR POR token_acesso (NÃO por token!)
    const cotacaoFornecedor = await DB.select(
      'cotacao_fornecedores',
      { cotacao_id: cotacaoId, token_acesso: token }
    );

    if (cotacaoFornecedor.length === 0) {
      return res.status(403).json({ message: 'Acesso negado. Token inválido ou expirado.' });
    }

    const cotacaoFornecedorData = cotacaoFornecedor[0];
    const tenantId = cotacaoFornecedorData.tenant_id;
    const fornecedorId = cotacaoFornecedorData.fornecedor_id;

    // 2. Buscar cotação
    // FIX (2026-09): DB.selectOne já devolve o objeto direto (ou null), não
    // um array — usar cotacao[0]/fornecedor[0]/empresa[0] embaixo sempre
    // resultava em `undefined`. Confirmado com teste real: numero_cotacao,
    // fornecedor e empresa sempre chegavam vazios pro fornecedor na tela.
    const cotacao = await DB.selectOne('cotacoes', { id: cotacaoId }, tenantId);
    if (!cotacao) {
      return res.status(404).json({ message: 'Cotação não encontrada' });
    }

    // 3. Buscar empresa
    const empresa = await DB.selectOne('tenants', { id: tenantId });

    // 4. Buscar fornecedor
    const fornecedor = await DB.selectOne('fornecedores', { id: fornecedorId }, tenantId);

    // 5. Buscar itens com nome usando SUPABASE NATIVO
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

    // FIX (2026-09, grave — vazamento entre fornecedores): a query buscava
    // TODOS os itens da cotação, sem checar se este fornecedor está na
    // lista fornecedores_ids daquele item. Confirmado com teste real: numa
    // cotação com o item A destinado só ao fornecedor 1 e o item B só ao
    // fornecedor 2, o fornecedor 1 via os dois itens — inclusive o preço
    // estimado e a descrição do item que não era dele. Cada fornecedor só
    // deve ver os itens em que foi explicitamente incluído.
    const itensDoFornecedor = itens.filter(item => {
      const ids = Array.isArray(item.fornecedores_ids) ? item.fornecedores_ids : [];
      return ids.length === 0 || ids.includes(fornecedorId);
    });

    const itensFormatados = itensDoFornecedor.map(item => ({
      ...item,
      item_nome: item.chamado_itens?.item_nome || 'Item sem nome',
      codigo: item.chamado_itens?.codigo || '',
      descricao: item.chamado_itens?.descricao || ''
    }));

    // 6. Buscar respostas existentes (opcional)
    const respostasExistentes = await DB.select(
      'cotacao_fornecedores',
      { cotacao_id: cotacaoId, fornecedor_id: fornecedorId },
      tenantId
    );

    return res.json({
      cotacao,
      fornecedor,
      empresa,
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

    if (!Array.isArray(respostas) || respostas.length === 0) {
      return res.status(400).json({ message: 'Nenhuma resposta enviada.' });
    }

    // 🔥 1. VALIDAR TOKEN (use token_acesso!)
    const cotacaoFornecedor = await DB.select(
      'cotacao_fornecedores',
      { cotacao_id: cotacaoId, token_acesso: token }
    );

    if (cotacaoFornecedor.length === 0) {
      return res.status(403).json({ message: 'Acesso negado. Token inválido.' });
    }

    const fornData = cotacaoFornecedor[0];
    const tenantId = fornData.tenant_id;
    const fornecedorId = fornData.fornecedor_id;
    const cotacaoFornecedorId = fornData.id;

    // 🔥 2. VALIDAR SE O FORNECEDOR JÁ RESPONDEU
    if (fornData.status === 'respondido') {
      return res.status(400).json({ message: 'Esta cotação já foi respondida.' });
    }

    // FIX (2026-09, grave — resposta em item de outro fornecedor): nada
    // validava que os cotacao_item_id enviados no body realmente pertencem
    // a este fornecedor. Confirmado com teste real: era possível responder
    // (e gravar preço para) um item que fornecedores_ids não incluía este
    // fornecedor_id. Busca os itens de verdade da cotação e cruza com
    // fornecedores_ids antes de aceitar qualquer resposta.
    const { data: itensCotacao, error: erroItens } = await supabase
      .from('cotacao_itens')
      .select('*')
      .eq('cotacao_id', parseInt(cotacaoId, 10))
      .eq('tenant_id', tenantId);

    if (erroItens) throw new Error(`Erro ao validar itens: ${erroItens.message}`);

    const itensPermitidosIds = new Set(
      itensCotacao
        .filter(item => {
          const ids = Array.isArray(item.fornecedores_ids) ? item.fornecedores_ids : [];
          return ids.length === 0 || ids.includes(fornecedorId);
        })
        .map(item => item.id)
    );

    for (const resposta of respostas) {
      const itemIdCheck = parseInt(resposta.itemId, 10);
      if (!itensPermitidosIds.has(itemIdCheck)) {
        return res.status(403).json({
          message: `Item ${resposta.itemId} não está disponível para este fornecedor cotar.`
        });
      }
    }

    // 🔥 3. CALCULAR VALOR TOTAL (item + frete)
    const valorTotal = respostas.reduce((acc, r) => {
      const valor = parseFloat(r.valor_unitario || 0);
      const frete = parseFloat(r.valor_frete || 0);
      return acc + (valor * (r.quantidade || 1)) + frete;
    }, 0);

    // FIX (2026-09): resumo agregado da modalidade — se todos os itens
    // desta resposta vierem na mesma modalidade, grava essa modalidade;
    // se vier misto no mesmo pedido (ex: peça leve em CIF e peça pesada
    // em FOB, cenário real de operação já vivido pelo usuário), grava
    // "MISTO" em vez de mostrar só a modalidade do primeiro item e
    // esconder a mistura. O detalhe certo, item a item, está em
    // cotacao_fornecedor_itens.frete_modalidade — este campo aqui é só
    // um resumo pra quem lista cotações sem abrir o detalhe.
    const valorFreteTotal = respostas.reduce((acc, r) => acc + parseFloat(r.valor_frete || 0), 0);
    const modalidadesUsadas = [...new Set(respostas.map(r => r.frete).filter(Boolean))];
    const modalidadeResumo = modalidadesUsadas.length === 1
      ? modalidadesUsadas[0]
      : (modalidadesUsadas.length > 1 ? 'MISTO' : null);

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
        frete: modalidadeResumo,
        valor_frete: valorFreteTotal,
        token_acesso: uuidv4()
      },
      tenantId
    );

    // 🔥 5. INSERIR ITENS RESPONDIDOS
    // FIX (2026-09, grave — perda de dado): o payload real manda o preço
    // do item em "valor_unitario", mas o código lia "resposta.valor"
    // (campo que o frontend nunca envia) — todo item era gravado com
    // valor 0, mesmo o total da cotação (valorTotal acima) saindo certo.
    // Confirmado com teste real. Também gravava "frete" (modalidade,
    // string) via parseFloat na coluna numérica errada — agora vai pra
    // coluna nova frete_modalidade, e "frete" (numérico, valor do frete
    // deste item) vem do valor_frete do payload.
    // FIX (2026-09): "chamadoItemId" nunca é enviado pelo frontend (o
    // TelaPortalFornecedor.jsx não tem esse campo — só manda item_id, que
    // é o id de cotacao_itens). Em vez de depender do frontend mandar um
    // campo que ele não tem, busca chamado_item_id no próprio
    // itensCotacao já carregado acima pra validação.
    const itensCotacaoPorId = new Map(itensCotacao.map(item => [item.id, item]));

    for (const resposta of respostas) {
      const itemId = parseInt(resposta.itemId, 10);
      const itemOriginal = itensCotacaoPorId.get(itemId);
      await DB.insert(
        'cotacao_fornecedor_itens',
        {
          tenant_id: tenantId,
          cotacao_fornecedor_id: cotacaoFornecedorId,
          cotacao_item_id: itemId,
          chamado_item_id: resposta.chamadoItemId || itemOriginal?.chamado_item_id || null,
          valor: parseFloat(resposta.valor_unitario || 0),
          prazo: parseInt(resposta.prazo ?? respostas[0]?.prazo ?? 0),
          frete: parseFloat(resposta.valor_frete || 0),
          frete_modalidade: resposta.frete || null,
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

    // 7. ENVIAR E‑MAIL DE CONFIRMAÇÃO PARA O FORNECEDOR
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

    // 🔥 Validar token_acesso (NÃO token)
    const cotacaoFornecedor = await DB.select(
      'cotacao_fornecedores',
      { cotacao_id: cotacaoId, token_acesso: token }
    );

    if (cotacaoFornecedor.length === 0) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const { tenant_id: tenantId } = cotacaoFornecedor[0];

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
