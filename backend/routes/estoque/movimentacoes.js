// routes/estoque/movimentacoes.js
const express = require('express');
const router = express.Router();
const { DB } = require('../../db');
const tenantMiddleware = require('../../middleware/tenantMiddleware');

const SISTEMA_UUID = '00000000-0000-0000-0000-000000000000';

  // ─── HELPERS ───────────────────────────────────────────────
  const normalizarTexto = (texto) => {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();
  };

  const calcularLevenshtein = (a, b) => {
    a = normalizarTexto(a);
    b = normalizarTexto(b);
    
    const m = a.length, n = b.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i][j - 1] + 1,
          dp[i - 1][j] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    
    return dp[m][n];
  };

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

    // Atualizar saldo
    let novoSaldo = parseFloat(item.saldo_atual) || 0;
    const qtd = parseFloat(quantidade);

    if (tipo === 'entrada') {
      novoSaldo += qtd;
    } else if (tipo === 'saida') {
      novoSaldo -= qtd;
    } else if (tipo === 'ajuste') {
      novoSaldo = qtd;
    }

    await DB.update('itens_consumo', item_consumo_id, {
      saldo_atual: novoSaldo,
      atualizado_em: new Date()
    }, tenantId);

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
      status_quarentena = 'aprovado',
      motivo_divergencia
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

    // 🔥 3. BUSCAR SE JÁ EXISTE UM NÚMERO DE RECEBIMENTO PARA A OV
    const ovItems = await DB.select('ordem_venda_itens', { ordem_venda_id: ov.id }, tenantId);
    const numeroExistente = ovItems.find(i => i.numero_recebimento_ov)?.numero_recebimento_ov;

    let numeroRecebimentoOV = numeroExistente;
    
    // 🔥 4. SE NÃO EXISTIR, GERAR UM NÚMERO NOVO
    if (!numeroRecebimentoOV) {
      numeroRecebimentoOV = await gerarNumeroRecebimento(tenantId);
      // Atualizar todos os itens da OV com o número pai
      for (const ovItem of ovItems) {
        await DB.update('ordem_venda_itens', ovItem.id, {
          numero_recebimento_ov: numeroRecebimentoOV
        }, tenantId);
      }
    }

    // 5. Atualizar item atual (MIRO)
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
      numero_recebimento_ov: numeroRecebimentoOV,
      motivo_divergencia: motivo_divergencia || null,
      miro_por: req.userId,
      miro_em: new Date()
    }, tenantId);

    // 6. Se quarentena, criar ação
    if (status_quarentena === 'rejeitado') {
      await DB.insert('acoes', {
        tenant_id: tenantId,
        tipo: 'gestor',
        titulo: `Quarentena - Divergência na NF ${numero_nota_fiscal || '—'}`,
        descricao: `Item ${item.item_nome} (${ov.numero}) com divergência fiscal. Motivo: ${motivo_divergencia || 'Não informado'}`,
        data_vencimento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'pendente',
        criado_em: new Date()
      }, tenantId);
    }

    // 7. Verificar se MIRO e MIGO estão concluídas
    const itemAtualizado = await DB.selectOne('ordem_venda_itens', { id: item.id }, tenantId);
    const miroConcluida = itemAtualizado.numero_nota_fiscal && itemAtualizado.data_vencimento_pagamento;
    const migoConcluida = itemAtualizado.quantidade_recebida_fisica > 0;

    // 8. Se MIRO e MIGO estão concluídas, criar ações
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

    return res.json({ ok: true, mensagem: 'Conferência fiscal salva com sucesso!', numero_recebimento: numeroRecebimentoOV });
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

// POST /api/estoque/movimentacoes/validar-xml
router.post('/validar-xml', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { ordem_venda_id, xml } = req.body;
    
    // 🔥 LOG 1: Ver o que está chegando
    
    // Proteção essencial caso o payload venha vazio
    if (!xml || !xml.itens_xml) {
      return res.status(400).json({ erro: "Dados do XML não recebidos ou incompletos na requisição." });
    }
    
    // 1. Buscar OC e filial
    const ov = await DB.selectOne('ordens_venda', { id: ordem_venda_id }, tenantId);
    const filial = ov?.filial_id ? await DB.selectOne('tenant_filiais', { id: ov.filial_id }, tenantId) : null;
    const tenant = await DB.selectOne('tenants', { id: tenantId });
    
    // 2. Validar CNPJ do Destinatário
    const cnpjDestinatario = xml.cnpj_destinatario || '';
    const cnpjEsperado = filial?.cnpj_filial || tenant?.cnpj || '';
    const cnpjDestStatus = cnpjDestinatario === cnpjEsperado ? 'ok' : 'divergente';
    
    // 3. Validar CNPJ do Emitente vs Fornecedor
    const cnpjEmitente = xml.cnpj_emitente || '';
    const fornecedor = ov ? await DB.selectOne('fornecedores', { id: ov.fornecedor_id }, tenantId) : null;
    const cnpjFornecedor = fornecedor?.cnpj || '';
    const cnpjStatus = cnpjEmitente === cnpjFornecedor ? 'ok' : 'divergente';
    
    // 4. Validar Itens (com match mais rigoroso)
    const itensOV = ov ? await DB.select('ordem_venda_itens', { ordem_venda_id: ov.id }, tenantId) : [];
    const validacoes = [];

    for (const itemOV of itensOV) {
      const itemXML = xml.itens_xml.find(item => {
        const descXML = normalizarTexto(item.descricao || '');
        const descOV = normalizarTexto(itemOV.item_nome || '');
        
        const skuMatch = itemOV.item_catalogo_id && item.codigo === itemOV.item_catalogo_id;
        const descMatch = descOV.length > 3 && descXML.includes(descOV);
        const levenshteinMatch = calcularLevenshtein(descOV, descXML) <= 3;
        
        return skuMatch || descMatch || levenshteinMatch;
      });
      
      if (!itemXML) {
        // 🔥 Buscar o primeiro item da NFe que NÃO está associado
        const itemNFePendente = xml.itens_xml.find(item => 
          !validacoes.some(v => v.item_nfe === item.descricao)
        );
        
        validacoes.push({ 
          item: itemOV.item_nome, 
          item_nfe: itemNFePendente?.descricao || 'Não encontrado', 
          status: 'match_fallback', 
          mensagem: 'Item não encontrado. Associe manualmente.' 
        });
      } else if (parseInt(itemOV.quantidade || 0) !== parseInt(itemXML.quantidade || 0)) {
        validacoes.push({ 
          item: itemOV.item_nome, 
          item_nfe: itemXML.descricao || '', 
          status: 'divergencia_quantidade', 
          mensagem: `Qtd: OV ${itemOV.quantidade} vs XML ${itemXML.quantidade}` 
        });
      } else if (parseFloat(itemOV.valor_unitario || 0) !== parseFloat(itemXML.valorUnitario || 0)) {
        validacoes.push({ 
          item: itemOV.item_nome, 
          item_nfe: itemXML.descricao || '', 
          status: 'divergencia_valor', 
          mensagem: `Valor: OV ${itemOV.valor_unitario} vs XML ${itemXML.valorUnitario}` 
        });
      } else {
        validacoes.push({ 
          item: itemOV.item_nome, 
          item_nfe: itemXML.descricao || '', 
          status: 'ok', 
          mensagem: 'Item validado' 
        });
      }
    }
    
    // 🔥 LOG 4: Ver o que será retornado
    console.log('🔍 [validar-xml] VALIDAÇÕES:', JSON.stringify(validacoes, null, 2));
    
    // 5. Retornar resultado (SEM PESO)
    return res.json({
      validacao: {
        cnpj: cnpjEmitente === cnpjFornecedor ? '✅ CNPJ Emitente válido' : `❌ CNPJ Emitente divergente (Esperado: ${cnpjFornecedor})`,
        cnpj_status: cnpjStatus,
        cnpj_destinatario: cnpjDestStatus === 'ok' ? `✅ CNPJ Destinatário válido (${filial?.nome_filial || 'Matriz'})` : `❌ CNPJ Destinatário divergente (Esperado: ${cnpjEsperado})`,
        itens: validacoes,
        totalDivergencias: validacoes.filter(v => v.status !== 'ok').length + (cnpjStatus !== 'ok' ? 1 : 0) + (cnpjDestStatus !== 'ok' ? 1 : 0)
      }
    });
  } catch (err) {
    console.error('❌ Erro ao validar XML:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

// POST /api/estoque/movimentacoes/aprovar-item-manual
router.post('/aprovar-item-manual', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { ordem_venda_id, item_nome, aprovado_por } = req.body;
    
    // 1. Registrar a aprovação
    await DB.insert('aprovacoes_manuais', {
      tenant_id: tenantId,
      ordem_venda_id: ordem_venda_id,
      item_nome: item_nome,
      aprovado_por: aprovado_por || null,
      criado_em: new Date()
    }, tenantId);
    
    return res.json({ ok: true, mensagem: 'Item aprovado manualmente!' });
  } catch (err) {
    console.error('❌ Erro ao aprovar item manual:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

// POST /api/estoque/movimentacoes/contagem-cega
router.post('/contagem-cega', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { 
      item_id, 
      quantidade, 
      lote, 
      validade, 
      numero_serie,
      unidade_medida = 'UN',
      tentativa = 1,
      observacao = null,
      status = 'aprovado'
    } = req.body;

    // Validar item_id
    const itemIdNum = parseInt(item_id);
    if (isNaN(itemIdNum)) {
      return res.status(400).json({ erro: 'ID do item inválido' });
    }

    const contagemExistente = await DB.selectOne('historico_contagens_cegas', {
      ordem_venda_item_id: itemIdNum,
      tenant_id: tenantId,
      is_atual: true
    }, tenantId);

    // 1. Buscar o item da OV
    const item = await DB.selectOne('ordem_venda_itens', { 
      id: itemIdNum, 
      tenant_id: tenantId 
    }, tenantId);
    
    if (!item) {
      return res.status(404).json({ erro: 'Item da OV não encontrado' });
    }

    // 2. Validar tentativa
    if (tentativa > 3) {
      return res.status(400).json({ erro: 'Número máximo de contagens (3) excedido' });
    }

    // 3. Registrar no histórico
    const historico = await DB.insert('historico_contagens_cegas', {
      tenant_id: tenantId,
      ordem_venda_item_id: itemIdNum,
      tentativa: parseInt(tentativa),
      quantidade_contada: parseFloat(quantidade),
      lote: lote || null,
      validade: validade || null,
      numero_serie: numero_serie || null,
      unidade_medida: unidade_medida || 'UN',
      status_quarentena: status,
      observacao: observacao || null,
      contado_por: req.userId,
      contado_em: new Date(),
      is_atual: true
    }, tenantId);

    // 🔥 4. Desmarcar contagens anteriores (sem usar .raw())
    // Buscar todas as contagens anteriores deste item
    const contagensAnteriores = await DB.select('historico_contagens_cegas', {
      ordem_venda_item_id: itemIdNum,
      tenant_id: tenantId
    }, tenantId);

    // Atualizar cada uma para is_atual = false
    for (const c of contagensAnteriores) {
      if (c.id !== historico.id) {
        await DB.update('historico_contagens_cegas', c.id, {
          is_atual: false
        }, tenantId);
      }
    }

    // 5. Atualizar o item da OV
    await DB.update('ordem_venda_itens', itemIdNum, {
      tentativa_atual: parseInt(tentativa),
      contagem_atual_id: historico.id,
      quantidade_recebida_fisica: parseFloat(quantidade),
      status_contagem: 'concluido',
      lote: lote || null,
      validade: validade || null,
      numero_serie: numero_serie || null,
      unidade_medida: unidade_medida || 'UN',
      status_quarentena: status,
      migo_por: req.userId,
      migo_em: new Date()
    }, tenantId);

    // 6. Se aprovado e tentativa >= 2, atualizar saldo
    if (status === 'aprovado' && parseInt(tentativa) >= 2) {
      const itemConsumo = await DB.selectOne('itens_consumo', { 
        id: item.item_catalogo_id, 
        tenant_id: tenantId 
      }, tenantId);
      
      if (itemConsumo) {
        const novoSaldo = (parseFloat(itemConsumo.saldo_atual) || 0) + parseFloat(quantidade);
        await DB.update('itens_consumo', itemConsumo.id, {
          saldo_atual: novoSaldo,
          atualizado_em: new Date()
        }, tenantId);
      }
    }

    // 7. Buscar histórico completo para retornar
    const historicoCompleto = await DB.select('historico_contagens_cegas', { 
      ordem_venda_item_id: itemIdNum,
      tenant_id: tenantId 
    }, tenantId);

    // 8. Verificar se todos os itens da OV foram contados
    const itensOV = await DB.select('ordem_venda_itens', { 
      ordem_venda_id: item.ordem_venda_id, 
      tenant_id: tenantId 
    }, tenantId);
    
    const todosContados = itensOV.every(i => i.status_contagem === 'concluido');
    
    if (todosContados) {
      await DB.update('ordens_venda', item.ordem_venda_id, {
        status: 'contagem_concluida',
        atualizado_em: new Date()
      }, tenantId);
    }

    res.json({
      ok: true,
      mensagem: 'Contagem cega registrada com sucesso!',
      tentativa_atual: parseInt(tentativa),
      historico: historicoCompleto,
      status: status
    });

  } catch (err) {
    console.error('❌ Erro ao registrar contagem cega:', err.message);
    console.error('📋 Stack:', err.stack);
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/estoque/movimentacoes/item/:itemId/historico-contagens
router.get('/item/:itemId/historico-contagens', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { itemId } = req.params;

    const itemIdNum = parseInt(itemId);
    if (isNaN(itemIdNum)) {
      return res.status(400).json({ erro: 'ID do item inválido' });
    }

    // 1. Verificar se o item existe
    const item = await DB.selectOne('ordem_venda_itens', { 
      id: itemIdNum, 
      tenant_id: tenantId 
    }, tenantId);

    if (!item) {
      return res.status(404).json({ erro: 'Item da OV não encontrado' });
    }

    // 2. Buscar histórico
    const historico = await DB.select('historico_contagens_cegas', {
      ordem_venda_item_id: itemIdNum,
      tenant_id: tenantId
    }, tenantId);

    // 3. Ordenar por tentativa
    historico.sort((a, b) => (a.tentativa || 0) - (b.tentativa || 0));

    // 4. Buscar nomes dos contadores
    const historicoComNomes = await Promise.all(historico.map(async (h) => {
      const usuario = await DB.selectOne('usuarios', { id: h.contado_por }, tenantId);
      return {
        ...h,
        contado_por_nome: usuario?.nome || 'Usuário não encontrado',
        contado_em_formatado: h.contado_em ? new Date(h.contado_em).toLocaleString('pt-BR') : null
      };
    }));

    // 5. Buscar informações do item de consumo
    let itemConsumo = null;
    if (item?.item_catalogo_id) {
      itemConsumo = await DB.selectOne('itens_consumo', { 
        id: item.item_catalogo_id, 
        tenant_id: tenantId 
      }, tenantId);
    }

    // 6. Buscar informações da OV
    const ov = await DB.selectOne('ordens_venda', { 
      id: item.ordem_venda_id, 
      tenant_id: tenantId 
    }, tenantId);

    res.json({
      ok: true,
      item: {
        id: item.id,
        nome: itemConsumo?.nome || item.nome_item || 'Item sem nome',
        sku: itemConsumo?.sku || item.sku || '—',
        quantidade_esperada: item.quantidade || 0,
        unidade_medida: itemConsumo?.unidade_medida || item.unidade_medida || 'UN',
        status_contagem: item.status_contagem || 'pendente',
        tentativa_atual: item.tentativa_atual || 0,
        status_quarentena: item.status_quarentena || 'aprovado'
      },
      ordem_venda: {
        id: ov?.id || null,
        numero: ov?.numero || '—',
        fornecedor: ov?.fornecedor_nome || '—'
      },
      historico: historicoComNomes,
      total_contagens: historicoComNomes.length
    });

  } catch (err) {
    console.error('❌ Erro ao buscar histórico:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/estoque/movimentacoes/contagens-pendentes
router.get('/contagens-pendentes', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // 1. Buscar todos os itens pendentes
    const itensPendentes = await DB.select('ordem_venda_itens', {
      tenant_id: tenantId,
      status_contagem: ['pendente', 'em_andamento']
    }, tenantId);

    // 2. Filtrar os que não estão em quarentena
    const itensFiltrados = itensPendentes.filter(item => 
      item.status_quarentena !== 'rejeitado'
    );

    // 3. Buscar dados relacionados separadamente (padrão do sistema)
    const itensCompletos = await Promise.all(itensFiltrados.map(async (item) => {
      // Buscar item de consumo
      const itemConsumo = await DB.selectOne('itens_consumo', { 
        id: item.item_catalogo_id, 
        tenant_id: tenantId 
      }, tenantId);

      // Buscar OV
      const ov = await DB.selectOne('ordens_venda', { 
        id: item.ordem_venda_id, 
        tenant_id: tenantId 
      }, tenantId);

      // Buscar fornecedor
      let fornecedor = null;
      if (ov?.fornecedor_id) {
        fornecedor = await DB.selectOne('fornecedores', { 
          id: ov.fornecedor_id, 
          tenant_id: tenantId 
        }, tenantId);
      }

      // Buscar total de tentativas
      const historico = await DB.select('historico_contagens_cegas', {
        ordem_venda_item_id: item.id,
        tenant_id: tenantId
      }, tenantId);

      return {
        ...item,
        item_nome: itemConsumo?.nome || item.nome_item || 'Item sem nome',
        sku: itemConsumo?.sku || item.sku || '—',
        unidade_medida: itemConsumo?.unidade_medida || item.unidade_medida || 'UN',
        ov_numero: ov?.numero || '—',
        fornecedor_nome: fornecedor?.nome || '—',
        total_tentativas: historico.length || 0
      };
    }));

    // 4. Ordenar por data de criação (mais recente primeiro)
    itensCompletos.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));

    res.json({
      ok: true,
      itens: itensCompletos
    });

  } catch (err) {
    console.error('❌ Erro ao buscar contagens pendentes:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/estoque/movimentacoes/ordens-em-processo
router.get('/ordens-em-processo', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // 1. Buscar todas as OVs não concluídas
    const ordens = await DB.select('ordens_venda', {
      tenant_id: tenantId,
      status_recebimento: ['pendente', 'parcial', 'aguardando_contagem', 'contagem_pendente', 'quarentena']
    }, tenantId);

    // 2. Buscar itens de cada OV
    const ordensCompletas = await Promise.all(ordens.map(async (ov) => {
      const itens = await DB.select('ordem_venda_itens', { 
        ordem_venda_id: ov.id, 
        tenant_id: tenantId 
      }, tenantId);

      // Buscar nomes dos itens
      const itensComNomes = await Promise.all(itens.map(async (item) => {
        const itemConsumo = await DB.selectOne('itens_consumo', { 
          id: item.item_catalogo_id, 
          tenant_id: tenantId 
        }, tenantId);
        
        return {
          ...item,
          item_nome: itemConsumo?.nome || item.nome_item || 'Item sem nome'
        };
      }));

      // Buscar fornecedor
      const fornecedor = ov.fornecedor_id ? 
        await DB.selectOne('fornecedores', { id: ov.fornecedor_id, tenant_id: tenantId }, tenantId) : 
        null;

      // Calcular status da OV
      const statusRecebimento = calcularStatusOV(itensComNomes);

      return {
        ...ov,
        itens: itensComNomes,
        fornecedor_nome: fornecedor?.nome || '—',
        status_recebimento: statusRecebimento,
        total_itens: itensComNomes.length,
        itens_divergentes: itensComNomes.filter(i => 
          i.status_quarentena === 'rejeitado' || 
          i.status_contagem === 'pendente'
        ).length
      };
    }));

    // 3. Ordenar: primeiro os mais urgentes (quarentena, depois pendentes)
    ordensCompletas.sort((a, b) => {
      const prioridade = { 'quarentena': 0, 'contagem_pendente': 1, 'aguardando_contagem': 2, 'pendente': 3, 'parcial': 4 };
      return (prioridade[a.status_recebimento] || 99) - (prioridade[b.status_recebimento] || 99);
    });

    res.json({
      ok: true,
      ordens: ordensCompletas
    });

  } catch (err) {
    console.error('❌ Erro ao buscar OVs em processo:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/estoque/movimentacoes/ordens-venda
router.get('/ordens-venda', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // Buscar todas as OVs do tenant
    const ordens = await DB.select('ordens_venda', {
      tenant_id: tenantId
    }, tenantId);

    // Buscar dados relacionados para cada OV
    const ordensCompletas = await Promise.all(ordens.map(async (ov) => {
      // Buscar itens da OV
      const itens = await DB.select('ordem_venda_itens', { 
        ordem_venda_id: ov.id, 
        tenant_id: tenantId 
      }, tenantId);

      // Buscar fornecedor
      const fornecedor = ov.fornecedor_id ? 
        await DB.selectOne('fornecedores', { id: ov.fornecedor_id, tenant_id: tenantId }, tenantId) : 
        null;

      return {
        ...ov,
        itens: itens || [],
        fornecedor_nome: fornecedor?.nome || '—',
        total_itens: itens?.length || 0
      };
    }));

    res.json(ordensCompletas || []);
  } catch (err) {
    console.error('❌ Erro ao buscar OVs:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// Função auxiliar para calcular status da OV
function calcularStatusOV(itens) {
  if (!itens || itens.length === 0) return 'pendente';
  
  const temQuarentena = itens.some(i => i.status_quarentena === 'rejeitado');
  const temPendente = itens.some(i => i.status_contagem === 'pendente' && i.status_quarentena !== 'rejeitado');
  const temMiro = itens.some(i => i.miro_por);
  const todosConcluidos = itens.every(i => i.status_contagem === 'concluido' && i.status_quarentena === 'aprovado');

  if (temQuarentena) return 'quarentena';
  if (temPendente) return 'contagem_pendente';
  if (temMiro && !todosConcluidos) return 'aguardando_contagem';
  if (todosConcluidos) return 'parcial';
  return 'pendente';
}

module.exports = router;