// routes/dashboard.js & routes/ordensVenda.js

const express = require('express');
const router = express.Router();
const db = require('../db');
const { tenantMiddleware } = require('../middleware/tenantMiddleware');

// ============ DASHBOARD ENDPOINTS ============

/**
 * GET /api/dashboard/resumo
 * Retorna métricas gerais do dashboard
 */
router.get('/dashboard/resumo', tenantMiddleware, async (req, res) => {
  try {
    const { tenantId } = req;

    // Total de cotações
    const totalCotacoes = await db.query(
      `SELECT COUNT(*) as count FROM cotacoes WHERE tenant_id = $1`,
      [tenantId]
    );

    // Cotações por status
    const cotacoesPorStatus = await db.query(
      `SELECT status, COUNT(*) as count 
       FROM cotacoes 
       WHERE tenant_id = $1 
       GROUP BY status`,
      [tenantId]
    );

    // Tempo médio de cotação (em horas)
    const tempoMedio = await db.query(
      `SELECT 
        AVG(EXTRACT(EPOCH FROM (COALESCE(finalizado_em, NOW()) - criado_em))/3600) as tempo_horas
       FROM cotacoes 
       WHERE tenant_id = $1 AND status IN ('respondida', 'finalizada')`,
      [tenantId]
    );

    // Economia total (diferença entre preço estimado e aceito)
    const economia = await db.query(
      `SELECT 
        SUM(
          COALESCE(ci.preco_estimado, 0) - 
          COALESCE(cf.valor, ci.preco_estimado)
        ) * (
          SELECT AVG(quantidade) FROM cotacao_itens 
          WHERE tenant_id = $1
        ) as economia_total
       FROM cotacao_itens ci
       LEFT JOIN cotacao_fornecedores cf ON cf.cotacao_id = ci.cotacao_id
       WHERE ci.tenant_id = $1`,
      [tenantId]
    );

    // Fornecedores ativos
    const fornecedores = await db.query(
      `SELECT COUNT(*) as count FROM fornecedores 
       WHERE tenant_id = $1 AND ativo = true`,
      [tenantId]
    );

    // Ordens de venda
    const ordensVenda = await db.query(
      `SELECT COUNT(*) as count FROM ordens_venda WHERE tenant_id = $1`,
      [tenantId]
    );

    const cotacoesAbertas = cotacoesPorStatus.rows.find(r => r.status === 'rascunho')?.count || 0;
    const cotacoesFinalizadas = cotacoesPorStatus.rows.find(r => r.status === 'finalizada')?.count || 0;

    return res.json({
      resumo: {
        totalCotacoes: totalCotacoes.rows[0].count,
        cotacoesAbertas,
        cotacoesFinalizadas,
        cotacoesRespondidas: cotacoesPorStatus.rows.find(r => r.status === 'respondida')?.count || 0,
        tempoMedioCotacao: Math.round(tempoMedio.rows[0]?.tempo_horas || 0),
        economiaTotal: Math.round(economia.rows[0]?.economia_total || 0),
        fornecedoresAtivos: fornecedores.rows[0].count,
        ordensVendaEmitidas: ordensVenda.rows[0].count
      },
      cotacoesPorStatus: cotacoesPorStatus.rows.map(r => ({
        status: r.status,
        quantidade: parseInt(r.count)
      }))
    });

  } catch (erro) {
    console.error('Erro em /dashboard/resumo:', erro);
    return res.status(500).json({ message: 'Erro ao carregar resumo' });
  }
});

/**
 * GET /api/dashboard/fornecedores-top10
 * Retorna top 10 fornecedores mais usados
 */
router.get('/dashboard/fornecedores-top10', tenantMiddleware, async (req, res) => {
  try {
    const { tenantId } = req;

    const resultado = await db.query(
      `SELECT 
        f.id,
        f.nome,
        COUNT(cf.id) as total_cotacoes,
        COUNT(CASE WHEN cf.status = 'respondido' THEN 1 END) as respondidas,
        ROUND(COUNT(CASE WHEN cf.status = 'respondido' THEN 1 END)::numeric / 
              COUNT(cf.id) * 100, 1) as taxa_resposta,
        AVG(cf.valor)::numeric(10,2) as valor_medio,
        AVG(cf.prazo) as prazo_medio
       FROM fornecedores f
       LEFT JOIN cotacao_fornecedores cf ON cf.fornecedor_id = f.id AND cf.tenant_id = $1
       WHERE f.tenant_id = $1 AND f.ativo = true
       GROUP BY f.id, f.nome
       HAVING COUNT(cf.id) > 0
       ORDER BY total_cotacoes DESC
       LIMIT 10`,
      [tenantId]
    );

    return res.json({
      fornecedores: resultado.rows
    });

  } catch (erro) {
    console.error('Erro em /dashboard/fornecedores-top10:', erro);
    return res.status(500).json({ message: 'Erro ao carregar fornecedores' });
  }
});

/**
 * GET /api/dashboard/economia-mensal
 * Retorna economia mensal (últimos 12 meses)
 */
router.get('/dashboard/economia-mensal', tenantMiddleware, async (req, res) => {
  try {
    const { tenantId } = req;

    const resultado = await db.query(
      `SELECT 
        DATE_TRUNC('month', c.criado_em) as mes,
        COUNT(DISTINCT c.id) as total_cotacoes,
        SUM(
          COALESCE(ci.preco_estimado, 0) - 
          COALESCE(cf.valor, ci.preco_estimado)
        ) as economia
       FROM cotacoes c
       LEFT JOIN cotacao_itens ci ON ci.cotacao_id = c.id
       LEFT JOIN cotacao_fornecedores cf ON cf.cotacao_id = c.id AND cf.status = 'respondido'
       WHERE c.tenant_id = $1 
         AND c.criado_em >= NOW() - INTERVAL '12 months'
       GROUP BY DATE_TRUNC('month', c.criado_em)
       ORDER BY mes DESC`,
      [tenantId]
    );

    return res.json({
      economia: resultado.rows.map(r => ({
        mes: r.mes,
        totalCotacoes: parseInt(r.total_cotacoes),
        economia: Math.round(r.economia || 0)
      }))
    });

  } catch (erro) {
    console.error('Erro em /dashboard/economia-mensal:', erro);
    return res.status(500).json({ message: 'Erro ao carregar economia' });
  }
});

/**
 * GET /api/dashboard/tendencias
 * Retorna tendências e insights
 */
router.get('/dashboard/tendencias', tenantMiddleware, async (req, res) => {
  try {
    const { tenantId } = req;

    // Taxa de resposta média
    const taxaResposta = await db.query(
      `SELECT 
        COUNT(CASE WHEN status = 'respondido' THEN 1 END)::numeric / 
        COUNT(*) * 100 as taxa
       FROM cotacao_fornecedores
       WHERE tenant_id = $1`,
      [tenantId]
    );

    // Prazo médio de resposta
    const prazoMedio = await db.query(
      `SELECT 
        AVG(EXTRACT(EPOCH FROM (data_resposta - criado_em))/3600) as horas
       FROM cotacao_fornecedores
       WHERE tenant_id = $1 AND data_resposta IS NOT NULL`,
      [tenantId]
    );

    // Categoria mais cotada
    const categoriaMaisCotada = await db.query(
      `SELECT categoria, COUNT(*) as total
       FROM cotacao_itens
       WHERE tenant_id = $1
       GROUP BY categoria
       ORDER BY total DESC
       LIMIT 1`,
      [tenantId]
    );

    // Fornecedor com melhor preço
    const fornecedorMelhorPreco = await db.query(
      `SELECT 
        f.id,
        f.nome,
        AVG(cf.valor / ci.quantidade) as preco_unitario_medio
       FROM fornecedores f
       JOIN cotacao_fornecedores cf ON cf.fornecedor_id = f.id
       JOIN cotacao_itens ci ON ci.cotacao_id = cf.cotacao_id
       WHERE f.tenant_id = $1
       GROUP BY f.id, f.nome
       ORDER BY preco_unitario_medio ASC
       LIMIT 1`,
      [tenantId]
    );

    return res.json({
      tendencias: {
        taxaRespostaPorcentagem: Math.round(taxaResposta.rows[0]?.taxa || 0),
        prazoMedioResposta: Math.round(prazoMedio.rows[0]?.horas || 0),
        categoriaMaisCotada: categoriaMaisCotada.rows[0]?.categoria || 'N/A',
        fornecedorMelhorPreco: fornecedorMelhorPreco.rows[0]?.nome || 'N/A'
      }
    });

  } catch (erro) {
    console.error('Erro em /dashboard/tendencias:', erro);
    return res.status(500).json({ message: 'Erro ao carregar tendências' });
  }
});

// ============ ORDENS DE VENDA - FINALIZAÇÃO ============

/**
 * PUT /api/ordens-venda/:ordemVendaId/marcar-entregue
 * Marca OV como entregue
 */
router.put('/ordens-venda/:ordemVendaId/marcar-entregue', tenantMiddleware, async (req, res) => {
  try {
    const { ordemVendaId } = req.params;
    const { tenantId } = req;

    // 1. Buscar OV
    const ov = await db.query(
      `SELECT id, cotacao_id, status FROM ordens_venda 
       WHERE id = $1 AND tenant_id = $2`,
      [ordemVendaId, tenantId]
    );

    if (ov.rows.length === 0) {
      return res.status(404).json({ message: 'Ordem de venda não encontrada' });
    }

    const ovData = ov.rows[0];

    // 2. Atualizar status para "entregue"
    const dataEntrega = new Date();
    await db.query(
      `UPDATE ordens_venda 
       SET status = 'entregue', entregue_em = $1
       WHERE id = $2`,
      [dataEntrega, ordemVendaId]
    );

    // 3. Arquivar cotação (se todas as OVs estão entregues)
    const ovsNaoEntregues = await db.query(
      `SELECT COUNT(*) as count FROM ordens_venda 
       WHERE cotacao_id = $1 AND status != 'entregue' AND status != 'cancelada'`,
      [ovData.cotacao_id]
    );

    if (ovsNaoEntregues.rows[0].count === 0) {
      await db.query(
        `UPDATE cotacoes SET status = 'finalizada', finalizado_em = NOW()
         WHERE id = $1`,
        [ovData.cotacao_id]
      );
    }

    // 4. Registrar atividade
    await db.query(
      `INSERT INTO atividades (tenant_id, tipo, descricao, referencia_id, criado_em)
       VALUES ($1, 'ov_entregue', $2, $3, NOW())`,
      [tenantId, `Ordem ${ordemVendaId} marcada como entregue`, ordemVendaId]
    );

    return res.json({
      sucesso: true,
      message: 'Ordem de venda marcada como entregue',
      dataEntrega,
      ovStatus: 'entregue'
    });

  } catch (erro) {
    console.error('Erro em PUT /ordens-venda/.../marcar-entregue:', erro);
    return res.status(500).json({ message: 'Erro ao marcar entrega' });
  }
});

/**
 * PUT /api/ordens-venda/:ordemVendaId/cancelar
 * Cancela uma OV (retorna cotação para "Em Curso")
 */
router.put('/ordens-venda/:ordemVendaId/cancelar', tenantMiddleware, async (req, res) => {
  try {
    const { ordemVendaId } = req.params;
    const { tenantId, userId } = req;
    const { motivo } = req.body;

    // 1. Buscar OV
    const ov = await db.query(
      `SELECT id, cotacao_id, status FROM ordens_venda 
       WHERE id = $1 AND tenant_id = $2`,
      [ordemVendaId, tenantId]
    );

    if (ov.rows.length === 0) {
      return res.status(404).json({ message: 'Ordem de venda não encontrada' });
    }

    // 2. Cancelar OV
    const dataCancelamento = new Date();
    await db.query(
      `UPDATE ordens_venda 
       SET status = 'cancelada', cancelado_em = $1
       WHERE id = $2`,
      [dataCancelamento, ordemVendaId]
    );

    // 3. Retornar cotação para status "respondida"
    await db.query(
      `UPDATE cotacoes SET status = 'respondida'
       WHERE id = $1`,
      [ov.rows[0].cotacao_id]
    );

    // 4. Registrar atividade
    await db.query(
      `INSERT INTO atividades (tenant_id, tipo, descricao, referencia_id, criado_por, criado_em)
       VALUES ($1, 'ov_cancelada', $2, $3, $4, NOW())`,
      [tenantId, `Ordem cancelada - ${motivo || 'Sem motivo especificado'}`, ordemVendaId, userId]
    );

    return res.json({
      sucesso: true,
      message: 'Ordem de venda cancelada',
      ovStatus: 'cancelada'
    });

  } catch (erro) {
    console.error('Erro em PUT /ordens-venda/.../cancelar:', erro);
    return res.status(500).json({ message: 'Erro ao cancelar OV' });
  }
});

/**
 * GET /api/cotacoes/:cotacaoId/timeline
 * Retorna timeline visual completa da cotação
 */
router.get('/cotacoes/:cotacaoId/timeline', tenantMiddleware, async (req, res) => {
  try {
    const { cotacaoId } = req.params;
    const { tenantId } = req;

    // 1. Buscar cotação
    const cotacao = await db.query(
      `SELECT id, criado_em, enviado_em, respondida_em, finalizado_em, status
       FROM cotacoes 
       WHERE id = $1 AND tenant_id = $2`,
      [cotacaoId, tenantId]
    );

    if (cotacao.rows.length === 0) {
      return res.status(404).json({ message: 'Cotação não encontrada' });
    }

    const cotacaoData = cotacao.rows[0];

    // 2. Buscar primeira resposta
    const primeiraResposta = await db.query(
      `SELECT MIN(data_resposta) as data 
       FROM cotacao_fornecedores
       WHERE cotacao_id = $1 AND data_resposta IS NOT NULL`,
      [cotacaoId]
    );

    // 3. Buscar OV emitida
    const ordemVenda = await db.query(
      `SELECT id, criado_em, entregue_em FROM ordens_venda
       WHERE cotacao_id = $1
       ORDER BY criado_em DESC
       LIMIT 1`,
      [cotacaoId]
    );

    // 4. Buscar chamado relacionado
    const chamado = await db.query(
      `SELECT id, criado_em FROM chamados
       WHERE id = (SELECT chamado_id FROM cotacoes WHERE id = $1 LIMIT 1)`,
      [cotacaoId]
    );

    const timeline = [
      {
        ordem: 1,
        titulo: 'Chamado Aberto',
        data: chamado.rows[0]?.criado_em || cotacaoData.criado_em,
        status: 'completo',
        icone: '📞'
      },
      {
        ordem: 2,
        titulo: 'Cotação Criada',
        data: cotacaoData.criado_em,
        status: 'completo',
        icone: '📄'
      },
      {
        ordem: 3,
        titulo: 'Cotação Enviada',
        data: cotacaoData.enviado_em,
        status: cotacaoData.enviado_em ? 'completo' : 'pendente',
        icone: '📤'
      },
      {
        ordem: 4,
        titulo: 'Primeira Resposta',
        data: primeiraResposta.rows[0]?.data,
        status: primeiraResposta.rows[0]?.data ? 'completo' : 'pendente',
        icone: '✉️'
      },
      {
        ordem: 5,
        titulo: 'OV Emitida',
        data: ordemVenda.rows[0]?.criado_em,
        status: ordemVenda.rows[0]?.criado_em ? 'completo' : 'pendente',
        icone: '📋'
      },
      {
        ordem: 6,
        titulo: 'Entregue',
        data: ordemVenda.rows[0]?.entregue_em,
        status: ordemVenda.rows[0]?.entregue_em ? 'completo' : 'pendente',
        icone: '✅'
      }
    ];

    return res.json({
      cotacao: {
        id: cotacaoData.id,
        status: cotacaoData.status
      },
      timeline: timeline.filter(t => t.data) // Filtrar eventos sem data
    });

  } catch (erro) {
    console.error('Erro em GET /cotacoes/.../timeline:', erro);
    return res.status(500).json({ message: 'Erro ao carregar timeline' });
  }
});

/**
 * GET /api/ordens-venda/:ordemVendaId
 * Obter detalhes completos de uma OV
 */
router.get('/ordens-venda/:ordemVendaId', tenantMiddleware, async (req, res) => {
  try {
    const { ordemVendaId } = req.params;
    const { tenantId } = req;

    // 1. Buscar OV
    const ov = await db.query(
      `SELECT ov.*, f.nome as fornecedor_nome, f.email as fornecedor_email
       FROM ordens_venda ov
       LEFT JOIN fornecedores f ON f.id = ov.fornecedor_id
       WHERE ov.id = $1 AND ov.tenant_id = $2`,
      [ordemVendaId, tenantId]
    );

    if (ov.rows.length === 0) {
      return res.status(404).json({ message: 'Ordem de venda não encontrada' });
    }

    // 2. Buscar itens da OV
    const itens = await db.query(
      `SELECT ovi.*, ci.item_nome, ci.categoria, ci.quantidade
       FROM ordem_venda_itens ovi
       LEFT JOIN cotacao_itens ci ON ci.id = ovi.cotacao_item_id
       WHERE ovi.ordem_venda_id = $1
       ORDER BY ci.categoria, ci.item_nome`,
      [ordemVendaId]
    );

    return res.json({
      ordemVenda: ov.rows[0],
      itens: itens.rows
    });

  } catch (erro) {
    console.error('Erro em GET /ordens-venda/:id:', erro);
    return res.status(500).json({ message: 'Erro ao carregar OV' });
  }
});

module.exports = router;
