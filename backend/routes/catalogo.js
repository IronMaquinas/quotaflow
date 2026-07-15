const express = require('express');
const router = express.Router();
const CatalogoService = require('../services/CatalogoService');
const tenantMiddleware = require('../middleware/tenantMiddleware');
const { DB } = require('../db');

const service = new CatalogoService(DB);

// GET /api/catalogo/admin - Listar itens
router.get('/admin', tenantMiddleware, async (req, res) => {
  try {
    const { termo, categoria, marca, modelo, ano } = req.query;
    const itens = await service.buscarItens(req.tenantId, {
      termo,
      categoria,
      marca,
      modelo,
      ano: ano ? parseInt(ano) : null
    });
    res.json({ ok: true, itens });
  } catch (err) {
    console.error('❌ Erro buscar itens:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/catalogo/admin - Criar item
router.post('/admin', tenantMiddleware, async (req, res) => {
  try {
    const item = await service.criarItem(req.tenantId, req.body);
    res.status(201).json({ ok: true, item });
  } catch (err) {
    console.error('❌ Erro criar item:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/catalogo/categorias - Facet
router.get('/categorias', tenantMiddleware, async (req, res) => {
  try {
    const categorias = await service.obterCategorias(req.tenantId);
    res.json({ ok: true, categorias });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/catalogo/marcas - Facet
router.get('/marcas', tenantMiddleware, async (req, res) => {
  try {
    const marcas = await service.obterMarcas(req.tenantId);
    res.json({ ok: true, marcas });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;