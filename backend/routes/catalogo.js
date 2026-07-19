// backend/routes/catalogo.js
const express = require('express');
const router = express.Router();
const CatalogoService = require('../services/CatalogoService');
const tenantMiddleware = require('../middleware/tenantMiddleware');
const { DB } = require('../db');

// GET /api/catalogo/admin/:id - Detalhes do item com fornecedores
router.get('/admin/:id', tenantMiddleware, async (req, res) => {

  try {
    const service = new CatalogoService(DB);
    const item = await service.buscarItemCompleto(req.tenantId, req.params.id);
    res.json({ ok: true, item });
  } catch (err) {
    console.error('Erro ao buscar detalhes:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ────────────────────────────────────────────────────────────────
// GET /api/catalogo/admin - Listar itens
// ────────────────────────────────────────────────────────────────
router.get('/admin', tenantMiddleware, async (req, res) => {
  try {
    const service = new CatalogoService(DB);
    const itens = await service.buscarItens(req.tenantId, {});
    
    // ✅ ADICIONA FORNECEDORES EM CADA ITEM
    const itensComFornecedores = await Promise.all(
      itens.map(async (item) => {
        try {
          const fornecedores = await DB.raw(`
            SELECT f.id, f.nome, fi.preco_unitario, fi.estoque_status, fi.tempo_entrega_dias
            FROM fornecedor_itens fi
            JOIN fornecedores f ON fi.fornecedor_id = f.id
            WHERE fi.item_catalogo_id = $1 AND fi.ativo = true
          `, [item.id]);
          
          return {
            ...item,
            fornecedores: fornecedores || []
          };
        } catch (err) {
          return {
            ...item,
            fornecedores: []
          };
        }
      })
    );
    
    res.json({ ok: true, itens: itensComFornecedores });
  } catch (err) {
    console.error('❌ Erro:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ────────────────────────────────────────────────────────────────
// POST /api/catalogo/admin - Criar item
// ────────────────────────────────────────────────────────────────
router.post('/admin', tenantMiddleware, async (req, res) => {
  try {
    const item = await CatalogoService.criar(req.tenantId, req.body);
    res.status(201).json({ ok: true, item });
  } catch (err) {
    console.error('❌ Erro criar item:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ────────────────────────────────────────────────────────────────
// GET /api/catalogo/categorias - Facet
// ────────────────────────────────────────────────────────────────
router.get('/categorias', tenantMiddleware, async (req, res) => {
  try {
    const service = new CatalogoService(DB);  // ✅ Instanciar
    const categorias = await service.obterCategorias(req.tenantId);
    res.json({ ok: true, categorias });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.get('/marcas', tenantMiddleware, async (req, res) => {
  try {
    const service = new CatalogoService(DB);  // ✅ Instanciar
    const marcas = await service.obterMarcas(req.tenantId);
    res.json({ ok: true, marcas });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ────────────────────────────────────────────────────────────────
// POST /api/catalogo/importar-fornecedor - Importar CSV ⭐
// ────────────────────────────────────────────────────────────────
router.post('/importar-fornecedor', tenantMiddleware, async (req, res) => {
  try {
    const { fornecedor_id } = req.body;
    const arquivo = req.files?.arquivo;

    if (!fornecedor_id || !arquivo) {
      return res.status(400).json({ erro: 'fornecedor_id e arquivo são obrigatórios' });
    }

    const csvText = arquivo.data.toString('utf8');
    
    const service = new CatalogoService(DB);  // ✅ Instanciar
    const resultado = await service.importarFornecedor(req.tenantId, fornecedor_id, csvText);

    res.json({ ok: true, dados: resultado });
  } catch (err) {
    console.error('Erro ao importar:', err.message);
    res.status(400).json({ erro: err.message });
  }
});

module.exports = router;