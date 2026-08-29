// routes/estoque/solicitacoes.js
const express = require('express');
const router = express.Router();
const { DB } = require('../../db');
const tenantMiddleware = require('../../middleware/tenantMiddleware');

// GET /api/estoque/solicitacoes - Listar solicitações pendentes
router.get('/', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    // 1. Buscar solicitações pendentes
    const solicitacoes = await DB.select('solicitacoes_retirada', {
      tenant_id: tenantId,
      status: 'pendente'
    }, tenantId);

    // 2. Buscar dados relacionados separadamente
    const solicitacoesCompletas = await Promise.all(solicitacoes.map(async (s) => {
      const item = await DB.selectOne('itens_consumo', { id: s.item_consumo_id }, tenantId);
      
      const usuario = await DB.selectOne('usuarios', { id: s.solicitante_id }, tenantId);

      return {
        ...s,
        item_nome: item?.nome || 'Item não encontrado',
        sku: item?.sku || '—',
        unidade_medida: item?.unidade_medida || 'UN',
        solicitante_nome: usuario?.nome || 'Usuário não encontrado'
      };
    }));

    solicitacoesCompletas.sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em));

    res.json(solicitacoesCompletas);
  } catch (err) {
    console.error('❌ Erro ao listar solicitações:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// PUT /api/estoque/solicitacoes/:id/aprovar
router.put('/:id/aprovar', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { observacao } = req.body;
    const gestor = await DB.selectOne('usuarios', { id: req.userId }, tenantId);

    // Buscar solicitação
    const solicitacao = await DB.selectOne('solicitacoes_retirada', { 
      id, 
      tenant_id: tenantId,
      status: 'pendente'
    }, tenantId);
    
    if (!solicitacao) {
      return res.status(404).json({ erro: 'Solicitação não encontrada ou já processada' });
    }

    // Buscar o item
    const item = await DB.selectOne('itens_consumo', { id: solicitacao.item_consumo_id }, tenantId);
    if (!item) {
      return res.status(404).json({ erro: 'Item não encontrado' });
    }

    // Atualizar status da solicitação
    await DB.update('solicitacoes_retirada', id, {
      status: 'aprovado',
      aprovado_por: req.userId,
      aprovado_nome: gestor?.nome || 'Gestor',
      aprovado_em: new Date(),
      observacao_aprovacao: observacao || null
    }, tenantId);

    // Baixar saldo
    const novoSaldo = (item.saldo_atual || 0) - solicitacao.quantidade;
    await DB.update('itens_consumo', item.id, {
      saldo_atual: novoSaldo,
      atualizado_em: new Date()
    }, tenantId);

    // Registrar movimentação
    await DB.insert('movimentacoes_estoque', {
      tenant_id: tenantId,
      item_consumo_id: item.id,
      tipo: 'saida',
      quantidade: solicitacao.quantidade,
      responsavel_id: solicitacao.solicitante_id,
      observacao: solicitacao.motivo,
      aprovado_por: req.userId,
      aprovado_em: new Date(),
      status: 'aprovado'
    }, tenantId);

    res.json({ ok: true, mensagem: 'Solicitação aprovada e saldo baixado' });
  } catch (err) {
    console.error('❌ Erro ao aprovar solicitação:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// PUT /api/estoque/solicitacoes/:id/rejeitar
router.put('/:id/rejeitar', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { observacao } = req.body;
    const gestor = await DB.selectOne('usuarios', { id: req.userId }, tenantId);

    const solicitacao = await DB.selectOne('solicitacoes_retirada', { 
      id, 
      tenant_id: tenantId,
      status: 'pendente'
    }, tenantId);
    
    if (!solicitacao) {
      return res.status(404).json({ erro: 'Solicitação não encontrada ou já processada' });
    }

    await DB.update('solicitacoes_retirada', id, {
      status: 'rejeitado',
      aprovado_por: req.userId,
      aprovado_nome: gestor?.nome || 'Gestor',
      aprovado_em: new Date(),
      observacao_aprovacao: observacao || 'Rejeitado pelo gestor'
    }, tenantId);

    res.json({ ok: true, mensagem: 'Solicitação rejeitada' });
  } catch (err) {
    console.error('❌ Erro ao rejeitar solicitação:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

router.get('/minhas-solicitacoes', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.query.userId || req.userId;

    if (!userId) {
      return res.status(400).json({ erro: 'ID do usuário não fornecido' });
    }

    const solicitacoes = await DB.select('solicitacoes_retirada', {
      tenant_id: tenantId,
      solicitante_id: userId
    }, tenantId);

    const solicitacoesCompletas = await Promise.all(solicitacoes.map(async (s) => {
      const item = await DB.selectOne('itens_consumo', { id: s.item_consumo_id }, tenantId);
      
      const usuario = await DB.selectOne('usuarios', { id: s.solicitante_id }, tenantId);
      
      const aprovador = s.aprovado_por ? await DB.selectOne('usuarios', { id: s.aprovado_por }, tenantId) : null;

      return {
        ...s,
        item_nome: item?.nome || 'Item não encontrado',
        sku: item?.sku || '—',
        unidade_medida: item?.unidade_medida || 'UN',
        solicitante_nome: usuario?.nome || 'Usuário não encontrado',
        
        aprovador_nome: aprovador?.nome || 'Gestor'
      };
    }));

    solicitacoesCompletas.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));

    res.json(solicitacoesCompletas);
  } catch (err) {
    console.error('❌ Erro ao carregar minhas solicitações:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;