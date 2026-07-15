const CotacaoService = require('../services/CotacaoService');

class CotacaoController {
  constructor(db) {
    this.service = new CotacaoService(db);
  }

  // POST /api/chamado/:id/gerar-cotacoes
  async gerarCotacoes(req, res, next) {
    try {
      const { id: chamadoId } = req.params;
      const tenantId = req.tenantId;

      const cotacoes = await this.service.gerarCotacoesPorCategoria(tenantId, chamadoId);

      res.status(201).json({
        ok: true,
        cotacoes,
        total: cotacoes.length,
        mensagem: `${cotacoes.length} cotação(ões) criada(s)`
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/cotacao/:id
  async obterCotacao(req, res, next) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId;

      const cotacao = await this.service.obterCotacaoCompleta(tenantId, id);

      res.json({ ok: true, cotacao });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/chamado/:id/cotacoes
  async listarCotacoes(req, res, next) {
    try {
      const { id: chamadoId } = req.params;
      const tenantId = req.tenantId;

      const cotacoes = await this.service.listarCotacoesChamado(tenantId, chamadoId);

      res.json({ ok: true, cotacoes });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/cotacao/:id/enviar
  async enviarCotacao(req, res, next) {
    try {
      const { id } = req.params;
      const { fornecedor_ids } = req.body;
      const tenantId = req.tenantId;

      const resultado = await this.service.enviarCotacao(tenantId, id, fornecedor_ids);

      res.json({ ok: true, ...resultado });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CotacaoController;