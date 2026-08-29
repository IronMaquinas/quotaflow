// routes/estoque/itensConsumo.js
const express = require('express');
const router = express.Router();
const { DB } = require('../../db');
const tenantMiddleware = require('../../middleware/tenantMiddleware');

// ─── LISTAR ITENS DE CONSUMO ──────────────────────────────────
router.get('/', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const itens = await DB.raw(`
      SELECT 
        ic.*,
        f.nome as fornecedor_nome
      FROM itens_consumo ic
      LEFT JOIN fornecedores f ON f.id = ic.fornecedor_preferencial_id AND f.tenant_id = ic.tenant_id
      WHERE ic.tenant_id = $1
      ORDER BY ic.nome ASC
    `, [tenantId]);
    res.json(itens);
  } catch (err) {
    console.error('❌ Erro ao listar itens de consumo:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─── BUSCAR ITEM POR ID ──────────────────────────────────────
router.get('/:id', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const item = await DB.selectOne('itens_consumo', { id, tenant_id: tenantId }, tenantId);
    if (!item) {
      return res.status(404).json({ erro: 'Item não encontrado' });
    }
    res.json(item);
  } catch (err) {
    console.error('❌ Erro ao buscar item:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─── CRIAR ITEM DE CONSUMO ──────────────────────────────────
router.post('/', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const {
      nome,
      sku,
      numero_serie,
      unidade_medida,
      saldo_atual,
      limite_inferior_controle,
      limite_recompra,
      lote_minimo_compra,
      quantidade_lotes_automatico,
      fornecedor_preferencial_id,
      localizacao
    } = req.body;

    if (!nome) {
      return res.status(400).json({ erro: 'Nome é obrigatório' });
    }

    const novoItem = await DB.insert('itens_consumo', {
      tenant_id: tenantId,
      nome,
      sku: sku || null,
      numero_serie: numero_serie || null,
      unidade_medida: unidade_medida || 'UN',
      saldo_atual: saldo_atual || 0,
      limite_inferior_controle: limite_inferior_controle || null,
      limite_recompra: limite_recompra || null,
      lote_minimo_compra: lote_minimo_compra || null,
      quantidade_lotes_automatico: quantidade_lotes_automatico || 1,
      fornecedor_preferencial_id: fornecedor_preferencial_id || null,
      localizacao: localizacao || null,
      ativo: true
    }, tenantId);

    res.status(201).json(novoItem);
  } catch (err) {
    console.error('❌ Erro ao criar item:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─── ATUALIZAR ITEM DE CONSUMO ──────────────────────────────
router.put('/:id', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const {
      nome,
      sku,
      numero_serie,
      unidade_medida,
      saldo_atual,
      limite_inferior_controle,
      limite_recompra,
      lote_minimo_compra,
      quantidade_lotes_automatico,
      fornecedor_preferencial_id,
      localizacao,
      ativo
    } = req.body;

    const item = await DB.selectOne('itens_consumo', { id, tenant_id: tenantId }, tenantId);
    if (!item) {
      return res.status(404).json({ erro: 'Item não encontrado' });
    }

    const updateData = {};
    if (nome !== undefined) updateData.nome = nome;
    if (sku !== undefined) updateData.sku = sku;
    if (numero_serie !== undefined) updateData.numero_serie = numero_serie;
    if (unidade_medida !== undefined) updateData.unidade_medida = unidade_medida;
    if (saldo_atual !== undefined) updateData.saldo_atual = saldo_atual;
    if (limite_inferior_controle !== undefined) updateData.limite_inferior_controle = limite_inferior_controle;
    if (limite_recompra !== undefined) updateData.limite_recompra = limite_recompra;
    if (lote_minimo_compra !== undefined) updateData.lote_minimo_compra = lote_minimo_compra;
    if (quantidade_lotes_automatico !== undefined) updateData.quantidade_lotes_automatico = quantidade_lotes_automatico;
    if (fornecedor_preferencial_id !== undefined) updateData.fornecedor_preferencial_id = fornecedor_preferencial_id;
    if (localizacao !== undefined) updateData.localizacao = localizacao;
    if (ativo !== undefined) updateData.ativo = ativo;
    updateData.atualizado_em = new Date();

    await DB.update('itens_consumo', id, updateData, tenantId);
    const atualizado = await DB.selectOne('itens_consumo', { id, tenant_id: tenantId }, tenantId);
    res.json(atualizado);
  } catch (err) {
    console.error('❌ Erro ao atualizar item:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─── DELETAR ITEM DE CONSUMO ─────────────────────────────────
router.delete('/:id', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const item = await DB.selectOne('itens_consumo', { id, tenant_id: tenantId }, tenantId);
    if (!item) {
      return res.status(404).json({ erro: 'Item não encontrado' });
    }
    await DB.delete('itens_consumo', id, tenantId);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Erro ao deletar item:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;