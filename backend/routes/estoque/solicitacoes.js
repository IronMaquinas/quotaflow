// routes/estoque/solicitacoes.js
const express = require('express');
const router = express.Router();
const { DB } = require('../../db');
const tenantMiddleware = require('../../middleware/tenantMiddleware');

// GET /api/estoque/solicitacoes - Listar solicitações (com itens filhos)
router.get('/', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const origem_os_id = req.query.origem_os_id;
    
    // Se tiver origem_os_id, filtra por ele
    const solicitacoes = origem_os_id 
      ? await DB.select('solicitacoes_retirada', { tenant_id: tenantId, origem_os_id: origem_os_id }, tenantId)
      : await DB.select('solicitacoes_retirada', { tenant_id: tenantId }, tenantId);

    // 🔥 Buscar os itens filhos de todas as solicitações
    const solicitacaoIds = solicitacoes.map(s => s.id);
    let itensRetirada = [];
    if (solicitacaoIds.length > 0) {
      itensRetirada = await DB.raw(`
        SELECT * FROM solicitacao_retirada_itens 
        WHERE tenant_id = $1 AND solicitacao_retirada_id = ANY($2)
        ORDER BY id
      `, [tenantId, solicitacaoIds]);
    }

    // Agrupar itens por solicitacao_retirada_id
    const itensPorRetirada = {};
    itensRetirada.forEach(item => {
      if (!itensPorRetirada[item.solicitacao_retirada_id]) {
        itensPorRetirada[item.solicitacao_retirada_id] = [];
      }
      itensPorRetirada[item.solicitacao_retirada_id].push(item);
    });

    // Buscar dados relacionados separadamente
    const solicitacoesCompletas = await Promise.all(solicitacoes.map(async (s) => {
      const item = await DB.selectOne('itens_consumo', { id: s.item_consumo_id }, tenantId);
      const usuario = await DB.selectOne('usuarios', { id: s.solicitante_id }, tenantId);
      const aprovador = s.aprovado_por ? await DB.selectOne('usuarios', { id: s.aprovado_por }, tenantId) : null;

      return {
        ...s,
        // 🔥 ADICIONA OS ITENS FILHOS
        itens: itensPorRetirada[s.id] || [],
        item_nome: item?.nome || 'Item não encontrado',
        sku: item?.sku || '—',
        unidade_medida: item?.unidade_medida || 'UN',
        solicitante_nome: usuario?.nome || 'Usuário não encontrado',
        aprovador_nome: aprovador?.nome || 'Gestor'
      };
    }));

    // Ordenar por data (mais antiga primeiro - prioridade)
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

    // 1. Buscar solicitação
    const solicitacao = await DB.selectOne('solicitacoes_retirada', { 
      id, 
      tenant_id: tenantId,
      status: 'pendente'
    }, tenantId);
    
    if (!solicitacao) {
      return res.status(404).json({ erro: 'Solicitação não encontrada ou já processada' });
    }

    // 2. Buscar itens filhos
    const itens = await DB.select('solicitacao_retirada_itens', { 
      solicitacao_retirada_id: id, 
      tenant_id: tenantId 
    }, tenantId);

    if (!itens || itens.length === 0) {
      return res.status(404).json({ erro: 'Nenhum item encontrado na solicitação' });
    }

    // 3. Atualizar status da solicitação
    await DB.update('solicitacoes_retirada', id, {
      status: 'aprovado',
      aprovado_por: req.userId,
      aprovado_em: new Date(),
      observacao_aprovacao: observacao || null
    }, tenantId);

    // 4. Para cada item, baixar o saldo do estoque
    for (const item of itens) {
      // Buscar item de consumo
      const itemConsumo = await DB.selectOne('itens_consumo', { id: item.item_consumo_id }, tenantId);
      if (itemConsumo) {
        const novoSaldo = (itemConsumo.saldo_atual || 0) - item.quantidade;
        await DB.update('itens_consumo', itemConsumo.id, {
          saldo_atual: novoSaldo,
          atualizado_em: new Date()
        }, tenantId);
      }

      // Registrar movimentação de saída (para cada item)
      await DB.insert('movimentacoes_estoque', {
        tenant_id: tenantId,
        item_consumo_id: item.item_consumo_id || null,
        tipo: 'saida',
        quantidade: item.quantidade,
        responsavel_id: solicitacao.solicitante_id,
        observacao: solicitacao.motivo || 'Retirada aprovada',
        aprovado_por: req.userId,
        aprovado_em: new Date(),
        status: 'aprovado',
        numero_solicitacao: solicitacao.numero_solicitacao
      }, tenantId);
    }

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

    // 1. Buscar solicitação
    const solicitacao = await DB.selectOne('solicitacoes_retirada', { 
      id, 
      tenant_id: tenantId,
      status: 'pendente'
    }, tenantId);
    
    if (!solicitacao) {
      return res.status(404).json({ erro: 'Solicitação não encontrada ou já processada' });
    }

    // 2. Atualizar status da solicitação
    await DB.update('solicitacoes_retirada', id, {
      status: 'rejeitado',
      aprovado_por: req.userId, // 🔥 Salva APENAS o ID (que já tem no banco)
      aprovado_em: new Date(),
      observacao_aprovacao: observacao || 'Rejeitado pelo gestor'
    }, tenantId);

    // 3. 🔥 Atualizar status dos itens filhos para 'rejeitado'
    const itens = await DB.select('solicitacao_retirada_itens', { 
      solicitacao_retirada_id: id, 
      tenant_id: tenantId 
    }, tenantId);

    if (itens.length > 0) {
      for (const item of itens) {
        await DB.update('solicitacao_retirada_itens', item.id, {
          status: 'rejeitado'
        }, tenantId);
      }
    }

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

// ─── CRIAR SOLICITAÇÃO DE RETIRADA ──────────────────────
router.post('/', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { item_consumo_id, quantité, motivo, solicitante_id } = req.body;
    // 🔥 NOVOS CAMPOS DE ORIGEM:
    const { origem_os_id, origem_ov_id, origem_ov_numero } = req.body;

    if (!item_consumo_id || !quantidade || !motivo || !solicitante_id) {
      return res.status(400).json({ erro: 'Dados obrigatórios não fornecidos' });
    }

    // Gerar número...
    const ultimas = await DB.select('solicitacoes_retirada', { tenant_id: tenantId }, tenantId);
    let ultimaSequencia = 0;
    if (ultimas.length > 0) {
      ultimas.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
      if (ultimas[0].numero_solicitacion) {
        const partes = ultimas[0].numero_solicitacion.split('-');
        ultimaSequencia = parseInt(partes[2]) || 0;
      }
    }
    const ano = new Date().getFullYear();
    const sequencia = ultimaSequencia + 1;
    const numero = `RET-${ano}-${String(sequencia).padStart(4, '0')}`;

    // Insert com origem:
    await DB.insert('solicitacoes_retirada', {
      tenant_id: tenantId,
      numero_solicitacion: numero,
      item_consumo_id: item_consumo_id,
      quantité: quantité,
      motivo: motivo,
      solicitante_id: solicitante_id,
      status: 'pendente',
      criado_em: new Date(),
      // 🔥 Campos de origem:
      origem_os_id: origem_os_id || null,
      origem_ov_id: origem_ov_id || null,
      origem_ov_numero: origem_ov_numero || null
    }, tenantId);

    res.json({ ok: true, numero_solicitacion: numero });
  } catch (err) {
    console.error('❌ Erro ao créer solicitação:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;