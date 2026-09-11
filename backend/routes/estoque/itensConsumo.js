// routes/estoque/itensConsumo.js
const express = require('express');
const router = express.Router();
const { DB } = require('../../db');
const tenantMiddleware = require('../../middleware/tenantMiddleware');

// ─── LISTAR ITENS DE CONSUMO ──────────────────────────────────
router.get('/', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // 1. Buscar os itens (com TODOS os campos, incluindo os novos)
    const itens = await DB.select('itens_consumo', { tenant_id: tenantId }, tenantId);

    // 2. Buscar o fornecedor separadamente (para exibir o nome)
    const itensComFornecedor = await Promise.all(itens.map(async (item) => {
      const fornecedor = item.fornecedor_preferencial_id ?
        await DB.selectOne('fornecedores', { id: item.fornecedor_preferencial_id, tenant_id: tenantId }, tenantId) : null;

      return {
        ...item,
        fornecedor_nome: fornecedor?.nome || '—'
      };
    }));

    // 3. Ordenar por nome
    itensComFornecedor.sort((a, b) => a.nome.localeCompare(b.nome));

    res.json(itensComFornecedor);
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
      localizacao,
      // 🔥 NOVOS CAMPOS:
      fabricante,
      lote,
      validade,
      codigo_barras,
      ativo
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
      fabricante: fabricante || null,
      lote: lote || null,
      validade: validade || null,
      codigo_barras: codigo_barras || null,
      ativo: ativo !== false // 🔥 Se não vier, assume true
    }, tenantId);

    res.status(201).json(novoItem);
  } catch (err) {
    console.error('❌ Erro ao criar item:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─── ATUALIZAR ITEM DE CONSUMO ──────────────────────────────
//
// FIX (2026-09-11): "UPDATE itens_consumo failed: invalid input syntax for
// type date: """. `validade` é coluna `date` no Postgres — não aceita
// string vazia, só uma data válida ou NULL. O POST (criar) já tratava isso
// certo (`validade || null`), mas o PUT usava só `!== undefined`, então
// quando o formulário manda o campo de data vazio como "" (não como
// `undefined` nem `null` — comportamento comum de <input type="date">
// controlado em React quando o campo é limpo), a string vazia ia direto
// pro Postgres e quebrava. Corrigido: "" (ou qualquer string em branco)
// em `validade` agora vira `null` antes de gravar, preservando o resto do
// comportamento (campo omitido do payload = não mexe no valor atual).
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
      ativo,
      // 🔥 NOVOS CAMPOS:
      fabricante,
      lote,
      validade,
      codigo_barras
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
    if (fornecedor_preferencial_id !== undefined) updateData.fornecedor_preferencial_id = fornecedor_preferencial_id;    if (localizacao !== undefined) updateData.localizacao = localizacao;
    if (ativo !== undefined) updateData.ativo = ativo;

    // 🔥 NOVOS CAMPOS:
    if (fabricante !== undefined) updateData.fabricante = fabricante;
    if (lote !== undefined) updateData.lote = lote;
    // FIX: "" -> null (ver comentário acima do router.put). `validade` é
    // `date` no banco, não aceita string vazia.
    if (validade !== undefined) updateData.validade = (validade === '' ? null : validade);
    if (codigo_barras !== undefined) updateData.codigo_barras = codigo_barras;

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