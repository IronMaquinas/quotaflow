// routes/ordensVenda.js
const express = require('express');
const router = express.Router();
const { DB } = require('../db');
const tenantMiddleware = require('../middleware/tenantMiddleware');
const { enviarEmailCotacao } = require('../services/emailService');

// GET /api/ordens-venda - listar todas as OVs do tenant
router.get('/', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const ordens = await DB.raw(`
      SELECT 
        ov.id, ov.numero, ov.status, ov.valor_total, ov.valor_frete, ov.prazo_entrega,
        ov.criado_em, ov.cotacao_id, ov.fornecedor_id,
        COALESCE(f.nome, 'Fornecedor não identificado') as fornecedor_nome,
        c.numero as cotacao_numero
      FROM ordens_venda ov
      LEFT JOIN fornecedores f ON f.id = ov.fornecedor_id AND f.tenant_id = ov.tenant_id
      LEFT JOIN cotacoes c ON c.id = ov.cotacao_id AND c.tenant_id = ov.tenant_id
      WHERE ov.tenant_id = $1
      ORDER BY ov.criado_em DESC
    `, [tenantId]);
    res.json(ordens);
  } catch (err) {
    console.error('❌ Erro ao listar OVs:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/ordens-venda/:id - detalhes da OV
router.get('/:id', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const ovId = req.params.id;
    const ov = await DB.raw(`
      SELECT 
        ov.id, ov.numero, ov.status, ov.valor_total, ov.valor_frete, ov.prazo_entrega,
        ov.criado_em, ov.cotacao_id, ov.fornecedor_id,
        COALESCE(f.nome, 'Fornecedor não identificado') as fornecedor_nome,
        f.email as fornecedor_email,
        c.numero as cotacao_numero
      FROM ordens_venda ov
      LEFT JOIN fornecedores f ON f.id = ov.fornecedor_id AND f.tenant_id = ov.tenant_id
      LEFT JOIN cotacoes c ON c.id = ov.cotacao_id AND c.tenant_id = ov.tenant_id
      WHERE ov.id = $1 AND ov.tenant_id = $2
    `, [ovId, tenantId]);
    if (ov.length === 0) {
      return res.status(404).json({ erro: 'Ordem de venda não encontrada' });
    }
    const itens = await DB.raw(`
      SELECT 
        ovi.id, ovi.nome_item, ovi.quantidade, ovi.valor_unitario, ovi.valor_total,
        ch.item_nome as nome_original
      FROM ordem_venda_itens ovi
      LEFT JOIN chamado_itens ch ON ch.id = ovi.chamado_item_id
      WHERE ovi.ordem_venda_id = $1 AND ovi.tenant_id = $2
    `, [ovId, tenantId]);
    res.json({ ...ov[0], itens });
  } catch (err) {
    console.error('❌ Erro ao buscar OV:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// PUT /api/ordens-venda/:id/status - atualizar status + e‑mail se aprovada
router.put('/:id/status', tenantMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const tenantId = req.tenantId;
    const ovId = req.params.id;
    const allowed = ['pendente', 'aprovada', 'rejeitada', 'faturada'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ erro: 'Status inválido' });
    }

    // Buscar dados atuais da OV (inclui fornecedor e email)
    const ovAtual = await DB.raw(`
      SELECT ov.*, f.nome as fornecedor_nome, f.email as fornecedor_email
      FROM ordens_venda ov
      LEFT JOIN fornecedores f ON f.id = ov.fornecedor_id AND f.tenant_id = ov.tenant_id
      WHERE ov.id = $1 AND ov.tenant_id = $2
    `, [ovId, tenantId]);

    if (ovAtual.length === 0) {
      return res.status(404).json({ erro: 'Ordem de venda não encontrada' });
    }

    // Atualizar status
    await DB.update('ordens_venda', ovId, { status, atualizado_em: new Date() }, tenantId);

    // Se novo status for 'aprovada' e fornecedor tem email, enviar notificação
    if (status === 'aprovada' && ovAtual[0].fornecedor_email) {
      try {
        const itens = await DB.raw(`
          SELECT nome_item, quantidade, valor_unitario, valor_total
          FROM ordem_venda_itens
          WHERE ordem_venda_id = $1 AND tenant_id = $2
        `, [ovId, tenantId]);

        const numeroOV = ovAtual[0].numero;
        const fornecedorNome = ovAtual[0].fornecedor_nome || 'Fornecedor';
        const valorTotal = parseFloat(ovAtual[0].valor_total).toFixed(2);
        const prazo = ovAtual[0].prazo_entrega;

        const listaItens = itens.map(i => 
          `<li>${i.nome_item} - Qtd: ${i.quantidade} - R$ ${parseFloat(i.valor_unitario).toFixed(2)} - Total: R$ ${parseFloat(i.valor_total).toFixed(2)}</li>`
        ).join('');

        const assunto = `Ordem de Venda Aprovada - ${numeroOV}`;
        const corpo = `
          <h2>Ordem de Venda Aprovada</h2>
          <p>Prezado(a) ${fornecedorNome},</p>
          <p>A ordem de venda <strong>${numeroOV}</strong> foi aprovada.</p>
          <p>Itens:</p>
          <ul>${listaItens}</ul>
          <p><strong>Valor Total:</strong> R$ ${valorTotal}</p>
          <p><strong>Prazo:</strong> ${prazo} dias</p>
          <p>Favor iniciar a execução da ordem.</p>
          <hr>
          <p><small>Esta é uma mensagem automática. Não responda este e-mail.</small></p>
        `;

        await enviarEmailCotacao(ovAtual[0].fornecedor_email, assunto, corpo);
        console.log(`✅ E-mail de OV aprovada enviado para ${ovAtual[0].fornecedor_email}`);
      } catch (err) {
        console.error('❌ Erro ao enviar e-mail de aprovação:', err.message);
        // Não interrompe o fluxo
      }
    }

    res.json({ ok: true, status });
  } catch (err) {
    console.error('❌ Erro ao atualizar status:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;