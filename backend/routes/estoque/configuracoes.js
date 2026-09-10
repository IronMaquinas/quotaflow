const express = require('express');
const router = express.Router();
const { DB } = require('../../db');
const tenantMiddleware = require('../../middleware/tenantMiddleware');

// ─────────────────────────────────────────────────────────────────────────
// FIX (2026-09): GET e PUT liam/escreviam em tabelas DIFERENTES —
// GET usava `configuracoes_estoque`, PUT usava `config_estoque`. Resultado:
// toda config salva "sumia" no próximo carregamento da tela, porque o GET
// nunca via o que o PUT tinha acabado de gravar. `config_estoque` é a
// tabela correta — é nela que routes/estoque/movimentacoes.js já confia
// para decidir a regra de fluxo_aprovacao. `configuracoes_estoque` era uma
// tabela órfã (nada mais no backend a lê) e foi removida via migration —
// ver 002_fix_config_estoque_duplicada.sql.
// ─────────────────────────────────────────────────────────────────────────

// GET /api/estoque/configuracoes
router.get('/', tenantMiddleware, async (req, res) => {
  try {
    const config = await DB.selectOne('config_estoque', { tenant_id: req.tenantId });
    if (!config) {
      // Criar padrão
      const novo = await DB.insert('config_estoque', {
        tenant_id: req.tenantId,
        fluxo_aprovacao: false,
        notificar_recompra: true,
        dias_para_recompra: 7
      });
      return res.json(novo);
    }
    res.json(config);
  } catch (err) {
    console.error('❌ Erro ao buscar configurações:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// PUT /api/estoque/configuracoes
router.put('/', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { fluxo_aprovacao, notificar_recompra, dias_para_recompra } = req.body;

    console.log('🔍 Recebido para salvar:', { fluxo_aprovacao, notificar_recompra, dias_para_recompra });

    const config = await DB.selectOne('config_estoque', { tenant_id: tenantId });
    if (!config) {
      const novo = await DB.insert('config_estoque', {
        tenant_id: tenantId,
        fluxo_aprovacao: fluxo_aprovacao || false,
        notificar_recompra: notificar_recompra !== undefined ? notificar_recompra : true,
        dias_para_recompra: dias_para_recompra !== undefined ? dias_para_recompra : 7
      });
      return res.json(novo);
    }

    const atualizado = await DB.update('config_estoque', config.id, {
      fluxo_aprovacao: fluxo_aprovacao,  // ← DEVE SER BOOLEANO
      notificar_recompra: notificar_recompra,
      dias_para_recompra: dias_para_recompra !== undefined ? dias_para_recompra : config.dias_para_recompra,
      atualizado_em: new Date()
    }, tenantId);

    console.log('✅ Configuração atualizada:', atualizado);
    res.json(atualizado);
  } catch (err) {
    console.error('❌ Erro ao atualizar configurações:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;