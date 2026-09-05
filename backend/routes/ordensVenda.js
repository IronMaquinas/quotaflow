// routes/ordensVenda.js
const express = require('express');
const router = express.Router();
const { DB } = require('../db');
const tenantMiddleware = require('../middleware/tenantMiddleware');
const { enviarEmailCotacao } = require('../services/emailService');

// ─── GET /api/ordens-venda ──────────────────────────────────
router.get('/', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const origem_os_id = req.query.origem_os_id;
    const usuario = await DB.selectOne('usuarios', { id: req.userId }, tenantId);
    const perfil = usuario?.perfil;

    // 🔥 CONSTRÓI O FILTRO CONFORME O PERFIL
    let filtro = { tenant_id: tenantId };

    // Se tiver origem_os_id, adiciona ao filtro
    if (origem_os_id) {
      filtro.origem_os_id = origem_os_id;
    }

    // Se for fornecedor, filtra apenas as OVs onde ele é o fornecedor
    if (perfil === 'fornecedor') {
      const fornecedor = await DB.selectOne('fornecedores', { 
        tenant_id: tenantId,
        email: usuario.email
      });
      if (fornecedor) {
        filtro.fornecedor_id = fornecedor.id;
      } else {
        return res.json([]);
      }
    }

    // Busca as OVs com o filtro definido
    const ordens = await DB.select('ordens_venda', filtro, tenantId);

    // 🔥 ENRIQUECER COM ITENS (para mostrar a contagem)
    const ordensComItens = await Promise.all(ordens.map(async (ov) => {
      // Buscar itens da OV
      const itens = await DB.select('ordem_venda_itens', { ordem_venda_id: ov.id }, tenantId);
      
      // Buscar fornecedor
      const fornecedor = await DB.selectOne('fornecedores', { id: ov.fornecedor_id }, tenantId);
      const cotacao = await DB.selectOne('cotacoes', { id: ov.cotacao_id }, tenantId);
      
      return {
        ...ov,
        fornecedor_nome: fornecedor?.nome || 'Fornecedor não identificado',
        cotacao_numero: cotacao?.numero || null,
        itens: itens || [] // 🔥 Adicionar os itens!
      };
    }));

    res.json(ordensComItens);
  } catch (err) {
    console.error('❌ Erro ao listar OVs:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─── GET /api/ordens-venda/:id ──────────────────────────────
router.get('/:id', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const ovId = req.params.id;
    const usuario = await DB.selectOne('usuarios', { id: req.userId }, tenantId);
    const perfil = usuario?.perfil;

    // Buscar a OV
    const ov = await DB.selectOne('ordens_venda', { id: ovId }, tenantId);
    if (!ov) {
      return res.status(404).json({ erro: 'Ordem de venda não encontrada' });
    }

    // 🔥 SE FOR FORNECEDOR, VERIFICA SE A OV É DELE
    if (perfil === 'fornecedor') {
      const fornecedor = await DB.selectOne('fornecedores', { 
        tenant_id: tenantId,
        email: usuario.email
      });
      if (!fornecedor || ov.fornecedor_id !== fornecedor.id) {
        return res.status(403).json({ erro: 'Acesso negado: esta OV não pertence a você' });
      }
    }

    // Buscar fornecedor
    const fornecedorData = await DB.selectOne('fornecedores', { id: ov.fornecedor_id }, tenantId);
    const fornecedor_nome = fornecedorData?.nome || 'Fornecedor não identificado';
    const fornecedor_email = fornecedorData?.email || null;

    // Buscar cotação
    const cotacao = await DB.selectOne('cotacoes', { id: ov.cotacao_id }, tenantId);
    const cotacao_numero = cotacao?.numero || null;

    // Buscar itens
    const itens = await DB.select('ordem_venda_itens', { ordem_venda_id: ovId }, tenantId);

    // Buscar quem criou e aprovou
    const criador = await DB.selectOne('usuarios', { id: ov.criado_por }, tenantId);
    const aprovador = await DB.selectOne('usuarios', { id: ov.aprovado_por }, tenantId);

    res.json({
      ...ov,
      fornecedor_nome,
      fornecedor_email,
      cotacao_numero,
      criado_por_nome: criador?.nome || 'Usuário não identificado',
      aprovado_por_nome: aprovador?.nome || 'Não aprovado',
      itens
    });
  } catch (err) {
    console.error('❌ Erro ao buscar OV:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─── PUT /api/ordens-venda/:id/status ──────────────────────
router.put('/:id/status', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const ovId = req.params.id;
    const { status } = req.body;
    const usuario = await DB.selectOne('usuarios', { id: req.userId }, tenantId);
    const perfil = usuario?.perfil;

    const allowed = ['pendente', 'aprovada', 'rejeitada', 'faturada'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ erro: 'Status inválido' });
    }

    const ov = await DB.selectOne('ordens_venda', { id: ovId }, tenantId);
    if (!ov) {
      return res.status(404).json({ erro: 'Ordem de venda não encontrada' });
    }

    // 🔥 SE FOR FORNECEDOR, VERIFICA SE A OV É DELE
    if (perfil === 'fornecedor') {
      const fornecedor = await DB.selectOne('fornecedores', { 
        tenant_id: tenantId,
        email: usuario.email
      });
      if (!fornecedor || ov.fornecedor_id !== fornecedor.id) {
        return res.status(403).json({ erro: 'Acesso negado' });
      }
    }

    // Buscar fornecedor para e-mail
    const fornecedorData = await DB.selectOne('fornecedores', { id: ov.fornecedor_id }, tenantId);
    const fornecedor_email = fornecedorData?.email || null;

    // Atualizar status
    await DB.update('ordens_venda', ovId, {
      status,
      atualizado_em: new Date(),
      aprovado_por: req.userId
    }, tenantId);

    // Se status for 'aprovada' e fornecedor tem email, enviar notificação
    if (status === 'aprovada' && fornecedor_email) {
      try {
        const itens = await DB.raw(`
          SELECT nome_item, quantidade, valor_unitario, valor_total
          FROM ordem_venda_itens
          WHERE ordem_venda_id = $1 AND tenant_id = $2
        `, [ovId, tenantId]);

        const numeroOV = ov.numero;
        const valorTotal = parseFloat(ov.valor_total).toFixed(2);
        const prazo = ov.prazo_entrega;

        const listaItens = itens.map(i => 
          `<li>${i.nome_item} - Qtd: ${i.quantidade} - R$ ${parseFloat(i.valor_unitario).toFixed(2)} - Total: R$ ${parseFloat(i.valor_total).toFixed(2)}</li>`
        ).join('');

        const assunto = `Ordem de Venda Aprovada - ${numeroOV}`;
        const corpo = `
          <h2>Ordem de Venda Aprovada</h2>
          <p>Prezado(a) ${fornecedorData?.nome || 'Fornecedor'},</p>
          <p>A ordem de venda <strong>${numeroOV}</strong> foi aprovada.</p>
          <p>Itens:</p>
          <ul>${listaItens}</ul>
          <p><strong>Valor Total:</strong> R$ ${valorTotal}</p>
          <p><strong>Prazo:</strong> ${prazo} dias</p>
          <p>Favor iniciar a execução da ordem.</p>
          <hr>
          <p><small>Esta é uma mensagem automática. Não responda este e-mail.</small></p>
        `;

        await enviarEmailCotacao(fornecedor_email, assunto, corpo);
        console.log(`✅ E-mail de OV aprovada enviado para ${fornecedor_email}`);
      } catch (err) {
        console.error('❌ Erro ao enviar e-mail de aprovação:', err.message);
      }
    }

    res.json({ ok: true, status });
  } catch (err) {
    console.error('❌ Erro ao atualizar status:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;