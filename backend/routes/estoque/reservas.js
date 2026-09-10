const express = require('express');
const router = express.Router();
const { DB } = require('../../db');
const tenantMiddleware = require('../../middleware/tenantMiddleware');

router.get('/saldo', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { item_catalogo_id } = req.query;

    if (!item_catalogo_id) {
      return res.status(400).json({ erro: 'item_catalogo_id é obrigatório' });
    }

    const item = await DB.selectOne('itens_consumo', { catalogo_item_id: item_catalogo_id, tenant_id: tenantId }, tenantId);
    if (!item) {
      return res.status(404).json({ erro: 'Esta peça não tem controle de estoque no almoxarifado (sem vínculo com itens_consumo)' });
    }

    const todasReservas = await DB.select('estoque_reservas', {
      item_catalogo_id: item_catalogo_id,
      tenant_id: tenantId
    }, tenantId);
    const reservasAtivas = (todasReservas || []).filter(r => !r.liberado_em);

    const fisico = parseFloat(item.saldo_atual) || 0;
    const reservado = (reservasAtivas || []).reduce((soma, r) => soma + (parseFloat(r.quantidade) || 0), 0);
    const disponivel = fisico - reservado;
    const limiteRecompra = item.limite_recompra !== null ? parseFloat(item.limite_recompra) : null;

    res.json({
      item_catalogo_id: parseInt(item_catalogo_id),
      item_consumo_id: item.id,
      nome: item.nome,
      unidade_medida: item.unidade_medida,
      fisico,
      reservado,
      disponivel,
      limite_recompra: limiteRecompra,
      limite_inferior_controle: item.limite_inferior_controle !== null ? parseFloat(item.limite_inferior_controle) : null,
      alerta_recompra: limiteRecompra !== null ? disponivel <= limiteRecompra : false
    });
  } catch (err) {
    console.error('❌ Erro ao consultar saldo:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/estoque/reservas
// body: { item_catalogo_id, quantidade, chamado_id, chamado_item_id }
router.post('/reservas', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { item_catalogo_id, quantidade, chamado_id, chamado_item_id } = req.body;

    if (!item_catalogo_id || !quantidade || quantidade <= 0) {
      return res.status(400).json({ erro: 'item_catalogo_id e quantidade (> 0) são obrigatórios' });
    }

    const item = await DB.selectOne('itens_consumo', { catalogo_item_id: item_catalogo_id, tenant_id: tenantId }, tenantId);
    if (!item) {
      return res.status(404).json({ erro: 'Esta peça não tem controle de estoque no almoxarifado (sem vínculo com itens_consumo)' });
    }

    const todasReservasItem = await DB.select('estoque_reservas', {
      item_catalogo_id: item_catalogo_id,
      tenant_id: tenantId
    }, tenantId);
    const reservasAtivas = (todasReservasItem || []).filter(r => !r.liberado_em);
    const reservado = (reservasAtivas || []).reduce((soma, r) => soma + (parseFloat(r.quantidade) || 0), 0);
    const disponivelAntes = (parseFloat(item.saldo_atual) || 0) - reservado;

    const novaReserva = await DB.insert('estoque_reservas', {
      tenant_id: tenantId,
      item_catalogo_id,
      chamado_id: chamado_id || null,
      chamado_item_id: chamado_item_id || null,
      quantidade,
      criado_por: req.userId || null
    }, tenantId);

    res.json({
      ...novaReserva,
      disponivel_antes_da_reserva: disponivelAntes,
      atendida_integralmente: disponivelAntes >= quantidade
    });
  } catch (err) {
    console.error('❌ Erro ao criar reserva:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// DELETE /api/estoque/reservas/:id
// body opcional: { motivo } — 'item_cancelado' | 'os_cancelada' | 'consumido' | 'manual' (default)
router.delete('/reservas/:id', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const motivo = req.body?.motivo || 'manual';

    const reserva = await DB.selectOne('estoque_reservas', { id, tenant_id: tenantId }, tenantId);
    if (!reserva) {
      return res.status(404).json({ erro: 'Reserva não encontrada' });
    }
    if (reserva.liberado_em) {
      return res.json(reserva); // já estava liberada — idempotente, não é erro
    }

    const atualizada = await DB.update('estoque_reservas', id, {
      liberado_em: new Date(),
      liberado_motivo: motivo
    }, tenantId);

    res.json(atualizada);
  } catch (err) {
    console.error('❌ Erro ao liberar reserva:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

router.delete('/reservas/por-chamado/:chamadoId', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { chamadoId } = req.params;
    const motivo = req.body?.motivo || 'os_cancelada';

    const todasReservasChamado = await DB.select('estoque_reservas', {
      chamado_id: chamadoId,
      tenant_id: tenantId
    }, tenantId);
    const reservasAtivas = (todasReservasChamado || []).filter(r => !r.liberado_em);

    const liberadas = [];
    for (const r of (reservasAtivas || [])) {
      const atualizada = await DB.update('estoque_reservas', r.id, {
        liberado_em: new Date(),
        liberado_motivo: motivo
      }, tenantId);
      liberadas.push(atualizada);
    }

    res.json({ liberadas: liberadas.length, reservas: liberadas });
  } catch (err) {
    console.error('❌ Erro ao liberar reservas da OS:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
