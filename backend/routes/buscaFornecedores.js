// routes/buscaFornecedores.js
//
// Busca ao vivo, cross-fornecedor, dos melhores preços pra um item do
// catálogo do comprador. Roda no momento em que o comprador está montando
// a RC — não depende de nenhum matching prévio feito no upload do CSV
// (que só faz upsert simples). Usa a função SQL buscar_fornecedores_para_item
// (PN normalizado primeiro, autoritativo; fallback por similaridade de
// texto só quando não há match de PN), chamada via supabase.rpc() — nunca
// via DB.raw(), pelo histórico conhecido de fragilidade daquele fallback.

const express = require('express');
const router = express.Router();
const { DB, supabase } = require('../db');

// GET /api/busca-fornecedores/:catalogoItemId?limit=3
router.get('/:catalogoItemId', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const catalogoItemId = parseInt(req.params.catalogoItemId, 10);
    const limite = Math.min(parseInt(req.query.limit, 10) || 3, 20);

    if (!catalogoItemId || isNaN(catalogoItemId)) {
      return res.status(400).json({ erro: 'ID de item de catálogo inválido' });
    }

    // Busca o item do catálogo DO PRÓPRIO tenant — isolamento crítico, um
    // comprador nunca pode disparar busca usando o id de item de outro
    // tenant como ponto de partida.
    const item = await DB.selectOne('catalogo_itens', { id: catalogoItemId }, tenantId);
    if (!item) {
      return res.status(404).json({ erro: 'Item de catálogo não encontrado' });
    }

    const { data, error } = await supabase.rpc('buscar_fornecedores_para_item', {
      p_pn: item.codigo || '',
      p_nome: item.nome || '',
      p_descricao: item.descricao || '',
      p_categoria: item.categoria || null,
      p_limite: limite
    });

    if (error) throw new Error(error.message);

    res.json({
      catalogo_item_id: item.id,
      nome: item.nome,
      codigo: item.codigo,
      resultados: data.map(r => ({
        fornecedor_produto_id: r.fornecedor_produto_id,
        fornecedor_id: r.fornecedor_id,
        fornecedor_nome: r.fornecedor_nome,
        nome_ofertado: r.nome_raw,
        preco_unitario: parseFloat(r.preco_unitario),
        unidade: r.unidade,
        tipo_match: r.tipo_match, // 'pn' = confirmado pelo código, 'descricao' = sugestão a confirmar
        confianca: parseFloat(r.confianca)
      }))
    });
  } catch (err) {
    console.error('❌ Erro na busca de fornecedores:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
