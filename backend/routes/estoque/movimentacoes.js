// routes/estoque/movimentacoes.js
const express = require('express');
const router = express.Router();
const { DB } = require('../../db');
const tenantMiddleware = require('../../middleware/tenantMiddleware');

const SISTEMA_UUID = '00000000-0000-0000-0000-000000000000';

// ─── LISTAR MOVIMENTAÇÕES ──────────────────────────────────
router.get('/', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // 1. Buscar movimentações
    const movimentacoes = await DB.select('movimentacoes_estoque', { tenant_id: tenantId }, tenantId);

    // 2. Buscar dados relacionados separadamente
    const movimentacoesCompletas = await Promise.all(movimentacoes.map(async (m) => {
      // Buscar item de consumo
      const item = await DB.selectOne('itens_consumo', { id: m.item_consumo_id }, tenantId);
      
      // Buscar responsável (usuário)
      const usuario = await DB.selectOne('usuarios', { id: m.responsavel_id }, tenantId);

      let aprovador_nome = 'Automático';

      // Se o aprovador for o sistema, não busca no banco
      if (m.aprovado_por && m.aprovado_por !== SISTEMA_UUID) {
        const aprovador = await DB.selectOne('usuarios', { id: m.aprovado_por }, tenantId);
        aprovador_nome = aprovador?.nome || 'Automático';
      }

      return {
        ...m,
        item_nome: item?.nome || 'Item não encontrado',
        sku: item?.sku || '—',
        unidade_medida: item?.unidade_medida || 'UN',
        responsavel_nome: usuario?.nome || 'Usuário não encontrado',
        aprovado_por_nome: aprovador_nome
      };
    }));

    // Ordenar por data (mais recente primeiro)
    movimentacoesCompletas.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));

    res.json(movimentacoesCompletas);
  } catch (err) {
    console.error('❌ Erro ao listar movimentações:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─── REGISTRAR MOVIMENTAÇÃO ────────────────────────────────
// ─── REGISTRAR MOVIMENTAÇÃO ────────────────────────────────
router.post('/', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { item_consumo_id, tipo, quantidade, observacao } = req.body;

    console.log('🔍 [POST] Iniciando movimentação');
    console.log('🔍 [POST] tenantId:', tenantId);
    console.log('🔍 [POST] item_consumo_id:', item_consumo_id);
    console.log('🔍 [POST] tipo:', tipo);
    console.log('🔍 [POST] quantidade:', quantidade);
    console.log('🔍 [POST] observacao:', observacao);

    // 🔥 VALIDAÇÕES BÁSICAS
    if (!item_consumo_id || !tipo || !quantidade) {
      return res.status(400).json({ erro: 'item_consumo_id, tipo e quantidade são obrigatórios' });
    }

    if (!['entrada', 'saida', 'ajuste'].includes(tipo)) {
      return res.status(400).json({ erro: 'tipo deve ser entrada, saida ou ajuste' });
    }

    // Buscar o item
    const item = await DB.selectOne('itens_consumo', { id: item_consumo_id, tenant_id: tenantId }, tenantId);
    if (!item) {
      return res.status(404).json({ erro: 'Item não encontrado' });
    }
    console.log('📦 [POST] Item encontrado:', item.nome, 'Saldo atual:', item.saldo_atual);

    // 🔥 VERIFICAR SE PRECISA DE APROVAÇÃO
    const config = await DB.selectOne('config_estoque', { tenant_id: tenantId });
    const precisaAprovacao = config?.fluxo_aprovacao || false;
    console.log('🔍 [POST] precisaAprovacao:', precisaAprovacao);
    console.log('🔍 [POST] tipo === saida?', tipo === 'saida');

    // ─── SE PRECISAR DE APROVAÇÃO (APENAS PARA SAÍDAS) ──────
    if (precisaAprovacao && tipo === 'saida') {
      console.log('✅ [POST] Criando solicitação de aprovação');
      const solicitacao = await DB.insert('solicitacoes_retirada', {
        tenant_id: tenantId,
        item_consumo_id,
        quantidade: parseFloat(quantidade),
        motivo: observacao || '',
        solicitante_id: req.userId,
        status: 'pendente'
      }, tenantId);

      return res.status(201).json({
        ok: true,
        solicitacao_id: solicitacao.id,
        mensagem: 'Solicitação de retirada enviada para aprovação',
        status: 'pendente'
      });
    }

    // ─── SE NÃO PRECISAR DE APROVAÇÃO (FLUXO DIRETO) ────────
    console.log('✅ [POST] Fluxo DIRETO (sem aprovação)');

    // Registrar movimentação
    const movimentacao = await DB.insert('movimentacoes_estoque', {
      tenant_id: tenantId,
      item_consumo_id,
      tipo,
      quantidade: parseFloat(quantidade),
      responsavel_id: req.userId,
      observacao: observacao || null,
      aprovado_por: SISTEMA_UUID,
      aprovado_em: new Date(),
      status: 'aprovado'
    }, tenantId);
    console.log('📦 [POST] Movimentação criada:', movimentacao.id);

    // Atualizar saldo
    let novoSaldo = parseFloat(item.saldo_atual) || 0;
    const qtd = parseFloat(quantidade);
    console.log('📦 [POST] Saldo atual:', novoSaldo, 'Qtd:', qtd);

    if (tipo === 'entrada') {
      novoSaldo += qtd;
    } else if (tipo === 'saida') {
      novoSaldo -= qtd;
    } else if (tipo === 'ajuste') {
      novoSaldo = qtd;
    }
    console.log('📦 [POST] Novo saldo calculado:', novoSaldo);

    await DB.update('itens_consumo', item_consumo_id, {
      saldo_atual: novoSaldo,
      atualizado_em: new Date()
    }, tenantId);
    console.log('✅ [POST] Saldo atualizado com sucesso');

    res.status(201).json({
      movimentacao,
      novo_saldo: novoSaldo,
      status: 'aprovado'
    });

  } catch (err) {
    console.error('❌ [POST] Erro ao registrar movimentação:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─── BUSCAR MOVIMENTAÇÕES DE UM ITEM ──────────────────────
router.get('/item/:itemId', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { itemId } = req.params;

    const movimentacoes = await DB.select('movimentacoes_estoque', { 
      item_consumo_id: itemId,
      tenant_id: tenantId 
    }, tenantId);

    // Buscar responsáveis separadamente
    const movimentacoesCompletas = await Promise.all(movimentacoes.map(async (m) => {
      const usuario = await DB.selectOne('usuarios', { id: m.responsavel_id }, tenantId);
      return {
        ...m,
        responsavel_nome: usuario?.nome || 'Usuário não encontrado'
      };
    }));

    res.json(movimentacoesCompletas);
  } catch (err) {
    console.error('❌ Erro ao buscar movimentações:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;