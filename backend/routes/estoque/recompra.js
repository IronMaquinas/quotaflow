// routes/estoque/recompra.js
const express = require('express');
const router = express.Router();
const { DB } = require('../../db');
const tenantMiddleware = require('../../middleware/tenantMiddleware');

// ─── GERAR ORDEM DE RECOMPRA ─────────────────────────────────
router.post('/gerar', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // Buscar itens que precisam ser repostos
    const itensCriticos = await DB.raw(`
      SELECT 
        ic.*,
        f.nome as fornecedor_nome
      FROM itens_consumo ic
      LEFT JOIN fornecedores f ON f.id = ic.fornecedor_preferencial_id AND f.tenant_id = ic.tenant_id
      WHERE ic.tenant_id = $1
        AND ic.ativo = true
        AND ic.saldo_atual < ic.limite_recompra
    `, [tenantId]);

    if (itensCriticos.length === 0) {
      return res.json({ 
        ok: true, 
        mensagem: 'Nenhum item precisa ser reposto no momento.',
        itens: []
      });
    }

    // Gerar número da ordem
    const ano = new Date().getFullYear();
    const prefix = `REQ-${ano}-`;
    const ultimo = await DB.raw(`
      SELECT numero FROM ordens_recompra
      WHERE tenant_id = $1 AND numero LIKE $2
      ORDER BY numero DESC LIMIT 1
    `, [tenantId, `${prefix}%`]);

    let seq = 1;
    if (ultimo.length > 0 && ultimo[0].numero) {
      const match = ultimo[0].numero.match(/(\d+)$/);
      if (match) seq = parseInt(match[1]) + 1;
    }
    const numero = `${prefix}${String(seq).padStart(4, '0')}`;

    // Criar ordem de recompra
    const ordem = await DB.insert('ordens_recompra', {
      tenant_id: tenantId,
      numero,
      status: 'pendente',
      criado_em: new Date()
    }, tenantId);

    // Inserir itens na ordem
    for (const item of itensCriticos) {
      const quantidadeSugerida = parseFloat(item.lote_minimo_compra || 1) * parseInt(item.quantidade_lotes_automatico || 1);
      const prioridade = item.saldo_atual < item.limite_recompra ? 'urgente' : 'normal';

      await DB.insert('itens_recompra', {
        tenant_id: tenantId,
        ordem_recompra_id: ordem.id,
        item_consumo_id: item.id,
        quantidade_sugerida: quantidadeSugerida,
        prioridade,
        observacoes: `Saldo atual: ${item.saldo_atual} | Limite: ${item.limite_recompra}`
      }, tenantId);
    }

    res.status(201).json({
      ok: true,
      ordem_id: ordem.id,
      numero: numero,
      itens: itensCriticos.length,
      mensagem: `Ordem de recompra ${numero} gerada com ${itensCriticos.length} itens`
    });

  } catch (err) {
    console.error('❌ Erro ao gerar ordem de recompra:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─── LISTAR ORDENS DE RECOMPRA ──────────────────────────────
router.get('/ordens', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const ordens = await DB.raw(`
      SELECT 
        o.*,
        COUNT(ir.id) as total_itens,
        SUM(CASE WHEN ir.prioridade = 'urgente' THEN 1 ELSE 0 END) as itens_urgentes
      FROM ordens_recompra o
      LEFT JOIN itens_recompra ir ON ir.ordem_recompra_id = o.id AND ir.tenant_id = o.tenant_id
      WHERE o.tenant_id = $1
      GROUP BY o.id
      ORDER BY o.criado_em DESC
    `, [tenantId]);
    res.json(ordens);
  } catch (err) {
    console.error('❌ Erro ao listar ordens:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─── BUSCAR UMA ORDEM COM SEUS ITENS ────────────────────────
router.get('/ordens/:id', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const ordem = await DB.selectOne('ordens_recompra', { id, tenant_id: tenantId }, tenantId);
    if (!ordem) {
      return res.status(404).json({ erro: 'Ordem não encontrada' });
    }

    const itens = await DB.raw(`
      SELECT 
        ir.*,
        ic.nome as item_nome,
        ic.sku,
        ic.saldo_atual,
        ic.limite_recompra,
        ic.unidade_medida
      FROM itens_recompra ir
      JOIN itens_consumo ic ON ic.id = ir.item_consumo_id AND ic.tenant_id = ir.tenant_id
      WHERE ir.ordem_recompra_id = $1 AND ir.tenant_id = $2
      ORDER BY ir.prioridade DESC, ic.nome ASC
    `, [id, tenantId]);

    res.json({ ...ordem, itens });
  } catch (err) {
    console.error('❌ Erro ao buscar ordem:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─── ATUALIZAR STATUS DA ORDEM ──────────────────────────────
router.put('/ordens/:id/status', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['pendente', 'em_cotacao', 'aprovada', 'cancelada'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ erro: 'Status inválido' });
    }

    await DB.update('ordens_recompra', id, {
      status,
      atualizado_em: new Date(),
      aprovado_por: status === 'aprovada' ? req.userId : null
    }, tenantId);

    res.json({ ok: true, status });
  } catch (err) {
    console.error('❌ Erro ao atualizar status:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─── ATUALIZAR QUANTIDADE APROVADA DE UM ITEM ──────────────
router.put('/itens/:itemId', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { itemId } = req.params;
    const { quantidade_aprovada } = req.body;

    if (!quantidade_aprovada || quantidade_aprovada <= 0) {
      return res.status(400).json({ erro: 'Quantidade aprovada deve ser maior que zero' });
    }

    await DB.update('itens_recompra', itemId, {
      quantidade_aprovada: parseFloat(quantidade_aprovada)
    }, tenantId);

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Erro ao atualizar item:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;