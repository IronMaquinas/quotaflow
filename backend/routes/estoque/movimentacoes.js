// routes/estoque/movimentacoes.js
const express = require('express');
const router = express.Router();
const { DB } = require('../../db');
const tenantMiddleware = require('../../middleware/tenantMiddleware');

const SISTEMA_UUID = '00000000-0000-0000-0000-000000000000';

// NO TOPO DO ARQUIVO (antes das rotas)
async function gerarNumeroRecebimento(tenantId) {
  const ano = new Date().getFullYear();
  const prefix = `REC-${ano}-`;
  
  const result = await DB.raw(`
    SELECT numero_recebimento FROM movimentacoes_estoque
    WHERE tenant_id = $1 AND numero_recebimento LIKE $2
    ORDER BY numero_recebimento DESC
    LIMIT 1
  `, [tenantId, `${prefix}%`]);

  let seq = 1;
  if (result.length > 0 && result[0].numero_recebimento) {
    const match = result[0].numero_recebimento.match(/(\d+)$/);
    if (match) seq = parseInt(match[1]) + 1;
  }

  let novoNumero = `${prefix}${String(seq).padStart(4, '0')}`;
  let existe = await DB.selectOne('movimentacoes_estoque', { numero_recebimento: novoNumero, tenant_id: tenantId }, tenantId);
  if (existe) {
    let tentativas = 0;
    while (existe && tentativas < 100) {
      seq++;
      novoNumero = `${prefix}${String(seq).padStart(4, '0')}`;
      existe = await DB.selectOne('movimentacoes_estoque', { numero_recebimento: novoNumero, tenant_id: tenantId }, tenantId);
      tentativas++;
    }
  }

  return novoNumero;
}

// ─── LISTAR MOVIMENTAÇÕES ──────────────────────────────────
router.get('/', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const origem_os_id = req.query.origem_os_id;

    // 1. Buscar movimentações (com filtro por origem_os_id)
    const movimentacoes = origem_os_id 
      ? await DB.select('movimentacoes_estoque', { tenant_id: tenantId, origem_os_id: origem_os_id }, tenantId)
      : await DB.select('movimentacoes_estoque', { tenant_id: tenantId }, tenantId);

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
router.post('/', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { item_consumo_id, tipo, quantidade, observacao } = req.body;

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

    // 🔥 VERIFICAR SE PRECISA DE APROVAÇÃO
    const config = await DB.selectOne('config_estoque', { tenant_id: tenantId });
    const precisaAprovacao = config?.fluxo_aprovacao || false;

    // ─── SE PRECISAR DE APROVAÇÃO (APENAS PARA SAÍDAS) ──────
    if (precisaAprovacao && tipo === 'saida') {
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
      status: 'aprovado',
      numero_solicitacao: solicitacao.numero_solicitacao
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

// POST /api/estoque/movimentacoes/recebimento
router.post('/recebimento', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { 
      item_consumo_id, 
      quantidade, 
      fornecer_id, 
      numero_nota_fiscal, 
      lote, 
      validade, 
      observacao,
      // 🔥 CAMPOS NOVOS PARA VINCULAR À OV:
      ordem_venda_id,
      ordem_venda_numero,
      itens_recebidos // Array de itens para recebimento parcial vinculado à OV
    } = req.body;

    // ─── SE FOR RECEBIMENTO PARCIAL VINCULADO À OV ──────────
    if (ordem_venda_id && itens_recebidos && itens_recebidos.length > 0) {
      // Buscar OV
      const ov = await DB.selectOne('ordens_venda', { id: ordem_venda_id }, tenantId);
      if (!ov) {
        return res.status(404).json({ erro: 'OV não encontrada' });
      }

      // Gerar número de recebimento
      const numero = await gerarNumeroRecebimento(tenantId);

      // Para cada item recebido, atualizar saldo e status
      let quantidadeTotal = 0;
      for (const item of itens_recebidos) {
        const itemOV = await DB.selectOne('ordem_venda_itens', { id: item.id }, tenantId);
        if (!itemOV) {
          return res.status(404).json({ erro: 'Item da OV não encontrado' });
        }

        // Verificar se quantidade recebida não excede o pendente
        const quantidadePendente = (itemOV.quantidade || 0) - (itemOV.quantidade_recebida || 0);
        if (item.quantidade > quantidadePendente) {
          return res.status(400).json({ erro: `Quantidade recebida excede o pendente para o item ${itemOV.nome_item}` });
        }

        // Atualizar quantidade recebida no item da OV
        const novaQuantidadeRecebida = (itemOV.quantidade_recebida || 0) + item.quantidade;
        await DB.update('ordem_venda_itens', itemOV.id, {
          quantidade_recebida: novaQuantidadeRecebida,
          status_recebimento: novaQuantidadeRecebida >= itemOV.quantidade ? 'recebido' : 'parcial'
        }, tenantId);

        // Buscar item de consumo (para atualizar saldo)
        const itemConsumo = await DB.selectOne('itens_consumo', { id: itemOV.item_catalogo_id }, tenantId);
        if (itemConsumo) {
          const novoSaldo = (itemConsumo.saldo_atual || 0) + item.quantidade;
          await DB.update('itens_consumo', itemConsumo.id, {
            saldo_atual: novoSaldo,
            atualizado_em: new Date()
          }, tenantId);
        }

        // Registrar movimentação de entrada (vinculada à OV)
        await DB.insert('movimentacoes_estoque', {
          tenant_id: tenantId,
          item_consumo_id: itemOV.item_catalogo_id || null,
          tipo: 'entrada',
          quantidade: item.quantidade,
          responsavel_id: req.userId,
          observacao: `Recebimento parcial da OV ${ov.numero}`,
          fornecedor_id: fornecer_id || ov.fornecedor_id || null,
          lote: lote || null,
          validade: validade || null,
          numero_recebimento: numero,
          numero_nota_fiscal: numero_nota_fiscal || null,
          ordem_venda_id: ov.id,
          ordem_venda_numero: ov.numero,
          criado_em: new Date()
        }, tenantId);

        quantidadeTotal += item.quantidade;
      }

      // Atualizar status da OV
      const itensOV = await DB.select('ordem_venda_itens', { ordem_venda_id: ov.id }, tenantId);
      const todosRecebidos = itensOV.every(i => i.status_recebimento === 'recebido');
      await DB.update('ordens_venda', ov.id, {
        status: todosRecebidos ? 'recebido' : 'parcial_recebido'
      }, tenantId);

      return res.status(201).json({
        ok: true,
        numero_recebimento: numero,
        quantidade_total: quantidadeTotal,
        status_ov: todosRecebidos ? 'recebido' : 'parcial_recebido',
        mensagem: `Recebimento ${numero} registrado com sucesso`
      });
    }

    // ─── SE FOR RECEBIMENTO DIRETO (SEM OV) ────────────────
    if (!item_consumo_id || !quantidade) {
      return res.status(400).json({ erro: 'Item e quantidade obrigatórios' });
    }

    const item = await DB.selectOne('itens_consumo', { id: item_consumo_id }, tenantId);
    if (!item) {
      return res.status(404).json({ erro: 'Item não encontrado' });
    }

    // Gerar número de recebimento sequencial
    const numero = await gerarNumeroRecebimento(tenantId);

    // Dar entrada no saldo
    const novoSaldo = (item.saldo_atual || 0) + parseFloat(quantidade);
    await DB.update('itens_consumo', item.id, {
      saldo_atual: novoSaldo,
      atualizado_em: new Date()
    }, tenantId);

    // Registrar movimentação (com NF)
    await DB.insert('movimentacoes_estoque', {
      tenant_id: tenantId,
      item_consumo_id: item.id,
      tipo: 'entrada',
      quantidade: parseFloat(quantidade),
      responsavel_id: req.userId,
      observacao: observacao || null,
      fornecedor_id: fornecer_id || null,
      lote: lote || null,
      validade: validade || null,
      numero_recebimento: numero,
      numero_nota_fiscal: numero_nota_fiscal || null,
      ordem_venda_id: ordem_venda_id || null,
      ordem_venda_numero: ordem_venda_numero || null,
      criado_em: new Date()
    }, tenantId);

    res.json({ ok: true, mensagem: 'Recebimento registrado', numero_recebimento: numero, novo_saldo: novoSaldo });
  } catch (err) {
    console.error('❌ Erro ao receber material:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/estoque/movimentacoes/ordem-venda/:ovId
router.get('/ordem-venda/:ovId', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { ovId } = req.params;

    // 1. Buscar OV
    const ov = await DB.selectOne('ordens_venda', { id: ovId }, tenantId);
    if (!ov) {
      return res.status(404).json({ erro: 'OV não encontrada' });
    }

    // 2. Buscar itens da OV
    const itens = await DB.select('ordem_venda_itens', { ordem_venda_id: ovId }, tenantId);

    // 3. Buscar itens de consumo (para saber o SKU e saldo)
    const itensCompletos = await Promise.all(itens.map(async (item) => {
      const itemConsumo = await DB.selectOne('itens_consumo', { id: item.item_catalogo_id }, tenantId);
      return {
        ...item,
        item_nome: itemConsumo?.nome || item.nome_item || 'Item sem nome',
        sku: itemConsumo?.sku || item.sku || '—',
        saldo_atual: itemConsumo?.saldo_atual || 0,
        unidade_medida: itemConsumo?.unidade_medida || item.unidade_medida || 'UN',
        quantidade_recebida: item.quantidade_recebida || 0,
        quantidade_pendente: (item.quantidade || 0) - (item.quantidade_recebida || 0)
      };
    }));

    res.json({
      ok: true,
      ordem_venda: {
        id: ov.id,
        numero: ov.numero,
        status: ov.status,
        fornecedor_id: ov.fornecedor_id,
        valor_total: ov.valor_total
      },
      itens: itensCompletos
    });
  } catch (err) {
    console.error('❌ Erro ao buscar itens da OV:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// PUT /api/estoque/movimentacoes/item/:itemId/fiscal
router.put('/item/:itemId/fiscal', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { itemId } = req.params;
    const { 
      numero_nota_fiscal, 
      fornecedor_id, 
      lote, 
      validade, 
      observacao, 
      valor_nf, 
      quantidade_nf, 
      impostos, 
      data_vencimento_pagamento,
      unidade_medida = 'UN',
      status_quarentena = 'aprovado'
    } = req.body;

    // 1. Buscar item da OV
    const item = await DB.selectOne('ordem_venda_itens', { id: itemId }, tenantId);
    if (!item) {
      return res.status(404).json({ erro: 'Item da OV não encontrado' });
    }

    // 2. Buscar OV
    const ov = await DB.selectOne('ordens_venda', { id: item.ordem_venda_id }, tenantId);
    if (!ov) {
      return res.status(404).json({ erro: 'OV não encontrada' });
    }

    // 🔥 3. GERAR NÚMERO DE RECEBIMENTO MIRO (se aprovando pela primeira vez)
    let numeroRecebimentoMIRO = item.numero_recebimento_miro || null;
    if (status_quarentena === 'aprovado' && !numeroRecebimentoMIRO) {
      numeroRecebimentoMIRO = await gerarNumeroRecebimento(tenantId);
    }

    // 4. Atualizar item da OV (MIRO)
    await DB.update('ordem_venda_itens', item.id, {
      numero_nota_fiscal: numero_nota_fiscal || null,
      fornecedor_id: fornecedor_id || null,
      lote: lote || null,
      validade: validade || null,
      observacao: observacao || null,
      valor_nf: valor_nf || null,
      quantidade_nf: quantidade_nf || null,
      impostos: impostos || null,
      data_vencimento_pagamento: data_vencimento_pagamento || null,
      unidade_medida: unidade_medida || 'UN',
      status_quarentena: status_quarentena,
      numero_recebimento_miro: numeroRecebimentoMIRO,
      miro_por: req.userId,
      miro_em: new Date()
    }, tenantId);

    // 🔥 5. Se MIRO estiver em quarentena, criar ação
    if (status_quarentena === 'rejeitado') {
      await DB.insert('acoes', {
        tenant_id: tenantId,
        tipo: 'gestor',
        titulo: `Quarentena - Divergência na NF ${numero_nota_fiscal || '—'}`,
        descricao: `Item ${item.item_nome} (${ov.numero}) com divergência fiscal. Aguardando providências do fornecedor.`,
        status: 'pendente',
        criado_em: new Date()
      }, tenantId);
    }

    // 6. Verificar se MIRO e MIGO estão concluídas (para gerar ações)
    const itemAtualizado = await DB.selectOne('ordem_venda_itens', { id: item.id }, tenantId);
    const miroConcluida = itemAtualizado.numero_nota_fiscal && itemAtualizado.data_vencimento_pagamento;
    const migoConcluida = itemAtualizado.quantidade_recebida_fisica > 0;

    // 🔥 7. Se MIRO e MIGO estão concluídas, criar ações automáticas
    if (miroConcluida && migoConcluida) {
      await DB.insert('acoes', {
        tenant_id: tenantId,
        tipo: 'contas_a_pagar',
        titulo: `Pagar NF ${itemAtualizado.numero_nota_fiscal} - ${ov.numero}`,
        descricao: `Pagamento da NF ${itemAtualizado.numero_nota_fiscal} referente à OV ${ov.numero}. Valor: R$ ${itemAtualizado.valor_nf || 0}. Vencimento: ${itemAtualizado.data_vencimento_pagamento || '—'}`,
        data_vencimento: itemAtualizado.data_vencimento_pagamento,
        status: 'pendente',
        criado_em: new Date()
      }, tenantId);

      await DB.insert('acoes', {
        tenant_id: tenantId,
        tipo: 'gestor',
        titulo: `Recebimento concluído: ${ov.numero}`,
        descricao: `A OV ${ov.numero} foi recebida. NF: ${itemAtualizado.numero_nota_fiscal} | Valor: R$ ${itemAtualizado.valor_nf || 0} | Vencimento: ${itemAtualizado.data_vencimento_pagamento || '—'}`,
        data_vencimento: itemAtualizado.data_vencimento_pagamento,
        status: 'pendente',
        criado_em: new Date()
      }, tenantId);
    }

    return res.json({ ok: true, mensagem: 'Conferência fiscal salva com sucesso!', numero_recebimento: numeroRecebimentoMIRO });
  } catch (err) {
    console.error('❌ Erro ao salvar conferência fiscal:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

// PUT /api/estoque/movimentacoes/item/:itemId/fisica
router.put('/item/:itemId/fisica', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { itemId } = req.params;
    const { 
      quantidade_fisica, 
      lote, 
      validade, 
      numero_serie, 
      unidade_medida = 'UN',
      status_quarentena = 'aprovado'
    } = req.body;

    // 1. Buscar item da OV
    const item = await DB.selectOne('ordem_venda_itens', { id: itemId }, tenantId);
    if (!item) {
      return res.status(404).json({ erro: 'Item da OV não encontrado' });
    }

    // 2. Buscar OV
    const ov = await DB.selectOne('ordens_venda', { id: item.ordem_venda_id }, tenantId);
    if (!ov) {
      return res.status(404).json({ erro: 'OV não encontrada' });
    }

    // 🔥 3. GERAR NÚMERO DE RECEBIMENTO MIGO (se aprovando pela primeira vez)
    let numeroRecebimentoMIGO = item.numero_recebimento_migo || null;
    if (status_quarentena === 'aprovado' && !numeroRecebimentoMIGO) {
      numeroRecebimentoMIGO = await gerarNumeroRecebimento(tenantId);
    }

    // 4. Atualizar item da OV (MIGO)
    await DB.update('ordem_venda_itens', item.id, {
      quantidade_recebida_fisica: parseInt(quantidade_fisica || 0),
      lote: lote || null,
      validade: validade || null,
      numero_serie: numero_serie || null,
      unidade_medida: unidade_medida || 'UN',
      status_quarentena: status_quarentena,
      numero_recebimento_migo: numeroRecebimentoMIGO,
      migo_por: req.userId,
      migo_em: new Date()
    }, tenantId);

    // 🔥 5. Se MIGO estiver em quarentena, criar ação
    if (status_quarentena === 'rejeitado') {
      await DB.insert('acoes', {
        tenant_id: tenantId,
        tipo: 'gestor',
        titulo: `Quarentena - Divergência física em ${item.item_nome} (${ov.numero})`,
        descricao: `Quantidade física diferente da esperada. Aguardando regularização do fornecedor.`,
        status: 'pendente',
        criado_em: new Date()
      }, tenantId);
    }

    // 6. Verificar se MIRO e MIGO estão concluídas (para gerar ações)
    const itemAtualizado = await DB.selectOne('ordem_venda_itens', { id: item.id }, tenantId);
    const miroConcluida = itemAtualizado.numero_nota_fiscal && itemAtualizado.data_vencimento_pagamento;
    const migoConcluida = itemAtualizado.quantidade_recebida_fisica > 0;

    // 🔥 7. Se MIRO e MIGO estão concluídas, criar ações automáticas
    if (miroConcluida && migoConcluida) {
      await DB.insert('acoes', {
        tenant_id: tenantId,
        tipo: 'contas_a_pagar',
        titulo: `Pagar NF ${itemAtualizado.numero_nota_fiscal} - ${ov.numero}`,
        descricao: `Pagamento da NF ${itemAtualizado.numero_nota_fiscal} referente à OV ${ov.numero}. Valor: R$ ${itemAtualizado.valor_nf || 0}. Vencimento: ${itemAtualizado.data_vencimento_pagamento || '—'}`,
        data_vencimento: itemAtualizado.data_vencimento_pagamento,
        status: 'pendente',
        criado_em: new Date()
      }, tenantId);

      await DB.insert('acoes', {
        tenant_id: tenantId,
        tipo: 'gestor',
        titulo: `Recebimento concluído: ${ov.numero}`,
        descricao: `A OV ${ov.numero} foi recebida. NF: ${itemAtualizado.numero_nota_fiscal} | Valor: R$ ${itemAtualizado.valor_nf || 0} | Vencimento: ${itemAtualizado.data_vencimento_pagamento || '—'}`,
        data_vencimento: itemAtualizado.data_vencimento_pagamento,
        status: 'pendente',
        criado_em: new Date()
      }, tenantId);
    }

    // 8. Verificar se todos os itens da OV foram recebidos
    const itensOV = await DB.select('ordem_venda_itens', { ordem_venda_id: ov.id }, tenantId);
    const todosRecebidos = itensOV.every(i => i.quantidade_recebida_fisica >= i.quantidade);
    await DB.update('ordens_venda', ov.id, {
      status: todosRecebidos ? 'recebido' : 'parcial_recebido'
    }, tenantId);

    return res.json({ ok: true, mensagem: 'Conferência física salva com sucesso!', numero_recebimento: numeroRecebimentoMIGO });
  } catch (err) {
    console.error('❌ Erro ao salvar conferência física:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

// POST /api/estoque/movimentacoes/entrada
router.post('/entrada', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { ordem_venda_id, item_consumo_id, quantidade, numero_nota_fiscal, observacao } = req.body;

    // 1. Buscar item da OV
    const item = await DB.selectOne('ordem_venda_itens', { id: itemId }, tenantId);
    if (!item) {
      return res.status(404).json({ erro: 'Item da OV não encontrado' });
    }

    // 2. Buscar OV
    const ov = await DB.selectOne('ordens_venda', { id: item.ordem_venda_id }, tenantId);
    if (!ov) {
      return res.status(404).json({ erro: 'OV não encontrada' });
    }

    // 3. Buscar item de consumo
    const itemConsumo = await DB.selectOne('itens_consumo', { id: item.item_catalogo_id }, tenantId);
    if (!itemConsumo) {
      return res.status(404).json({ erro: 'Item de consumo não encontrado' });
    }

    // 4. 3-WAY MATCH VALIDAÇÃO
    const valorNF = parseFloat(item.valor_nf || 0);
    const valorOV = parseFloat(item.valor_unitario * item.quantidade || 0);
    const quantidadeNF = parseInt(item.numero_nota_fiscal ? item.quantidade : 0);
    const quantidadeFisica = parseInt(item.quantidade_recebida_fisica || 0);

    // Divergências
    const divergencias = [];
    if (valorNF !== valorOV) divergencias.push('Valor da NF diferente da OV');
    if (quantidadeNF !== quantidadeFisica) divergencias.push('Quantidade da NF diferente da física');

    // 5. Se houver divergência, bloquear entrada
    if (divergencias.length > 0) {
      return res.status(400).json({
        erro: 'Divergência encontrada no 3-Way Match',
        divergencias
      });
    }

    // 6. Entrada no estoque
    const novoSaldo = (itemConsumo.saldo_atual || 0) + quantidade;
    await DB.update('itens_consumo', itemConsumo.id, {
      saldo_atual: novoSaldo,
      atualizado_em: new Date()
    }, tenantId);

    // 7. Registrar movimentação
    await DB.insert('movimentacoes_estoque', {
      tenant_id: tenantId,
      item_consumo_id: itemConsumo.id,
      tipo: 'entrada',
      quantidade: quantidade,
      responsavel_id: req.userId,
      observacao: `Recebimento da OV ${ov.numero}`,
      numero_nota_fiscal: numero_nota_fiscal || null,
      criado_em: new Date()
    }, tenantId);

    // 8. Atualizar quantidade recebida
    await DB.update('ordem_venda_itens', item.id, {
      quantidade_recebida: parseInt(item.quantidade_recebida || 0) + quantidade,
      atualizado_em: new Date()
    }, tenantId);

    // 9. Verificar se todos os itens foram recebidos
    const itensOV = await DB.select('ordem_venda_itens', { ordem_venda_id: ov.id }, tenantId);
    const todosRecebidos = itensOV.every(i => i.quantidade_recebida >= i.quantidade);
    await DB.update('ordens_venda', ov.id, {
      status: todosRecebidos ? 'recebido' : 'parcial_recebido'
    }, tenantId);

    return res.json({ ok: true, mensagem: '3-Way Match validado e entrada no estoque realizada!' });
  } catch (err) {
    console.error('❌ Erro ao entrar no estoque:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

module.exports = router;