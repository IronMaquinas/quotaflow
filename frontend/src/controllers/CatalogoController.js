const CatalogoService = require('../../../backend/services/CatalogoService');

class CatalogoController {
  constructor(db) {
    this.service = new CatalogoService(db);
  }

  // GET /api/admin/catalogo
  async listar(req, res, next) {
    try {
      const { termo, categoria, marca, modelo, ano } = req.query;
      const tenantId = req.tenantId;

      const itens = await this.service.buscarItens(tenantId, {
        termo,
        categoria,
        marca,
        modelo,
        ano: ano ? parseInt(ano) : null
      });

      res.json({ ok: true, itens });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/admin/catalogo
  async criar(req, res, next) {
    try {
      const tenantId = req.tenantId;
      const item = await this.service.criarItem(tenantId, req.body);
      res.status(201).json({ ok: true, item });
    } catch (err) {
      next(err);
    }
  }

  // PUT /api/admin/catalogo/:id
  async editar(req, res, next) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId;
      const usuarioId = req.usuario?.id;

      const item = await this.service.editarItem(tenantId, id, req.body, usuarioId);
      res.json({ ok: true, item });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/catalogo/categorias
  async obterCategorias(req, res, next) {
    try {
      const tenantId = req.tenantId;
      const categorias = await this.service.obterCategorias(tenantId);
      res.json({ ok: true, categorias });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/catalogo/marcas
  async obterMarcas(req, res, next) {
    try {
      const tenantId = req.tenantId;
      const marcas = await this.service.obterMarcas(tenantId);
      res.json({ ok: true, marcas });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/catalogo/marcas/:marca/modelos
  async obterModelosPorMarca(req, res, next) {
    try {
      const { marca } = req.params;
      const tenantId = req.tenantId;
      const modelos = await this.service.obterModelosPorMarca(tenantId, marca);
      res.json({ ok: true, modelos });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CatalogoController;