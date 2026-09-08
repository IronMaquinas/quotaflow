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

  //--- GERAR NÚMERO DO RECEBIMENTO ---
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

// --- Gerar número de RNC sequencial ---
async function gerarNumeroNC(tenantId) {
  const ano = new Date().getFullYear();
  const prefix = `NC-${ano}-`;
  
  const result = await DB.raw(`
    SELECT numero_nc FROM nao_conformidades
    WHERE tenant_id = $1 AND numero_nc LIKE $2
    ORDER BY numero_nc DESC
    LIMIT 1
  `, [tenantId, `${prefix}%`]).catch(() => []); // catch preventivo caso a tabela não exista ainda

  let seq = 1;
  if (result.length > 0 && result[0].numero_nc) {
    const match = result[0].numero_nc.match(/(\d+)$/);
    if (match) seq = parseInt(match[1]) + 1;
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
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

    // 🔥 INÍCIO DA ATUALIZAÇÃO DO STATUS DA OV PAI
    // 1. Busca novamente todos os itens da OV atualizados no banco
    const todosItensDaOV = await DB.select('ordem_venda_itens', { 
      ordem_venda_id: ov.id 
    }, tenantId);

    // 2. Calcula o status geral com base no estado atual de todos os itens
    const novoStatusDaOV = calcularStatusOV(todosItensDaOV);

    // 3. Atualiza a tabela pai 'ordens_venda' com o novo status calculado
    await DB.update('ordens_venda', ov.id, {
      status_recebimento: novoStatusDaOV,
      atualizado_em: new Date()
    }, tenantId);
    // ⚠️ FIM DA ATUALIZAÇÃO DO STATUS DA OV PAI

    return res.json({ 
      ok: true, 
      mensagem: 'Conferência fiscal salva com sucesso e status atualizado!', 
      numero_recebimento: numeroRecebimentoOV 
    });

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
    
    // 🔥 AJUSTE ESTE ATUALIZAR DA LINHA 382:
    const novoStatusRecebimento = calcularStatusOV(itensOV);
    await DB.update('ordens_venda', ov.id, {
      status: todosRecebidos ? 'recebido' : 'parcial_recebido',
      status_recebimento: novoStatusRecebimento, // <-- Adicione esta linha
      atualizado_em: new Date()
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
      observacao = null
      // ⚠️ NÃO RECEBE 'tentativa' nem 'status'
    } = req.body;

    const itemIdNum = parseInt(item_id);
    if (isNaN(itemIdNum)) {
      return res.status(400).json({ erro: 'ID do item inválido' });
    }

    // 1. Buscar o item da OV
    const item = await DB.selectOne('ordem_venda_itens', { 
      id: itemIdNum, 
      tenant_id: tenantId 
    }, tenantId);
    
    if (!item) {
      return res.status(404).json({ erro: 'Item da OV não encontrado' });
    }

    // 2. Contar quantas contagens já existem para este item
    const contagensExistentes = await DB.select('historico_contagens_cegas', {
      ordem_venda_item_id: itemIdNum,
      tenant_id: tenantId
    }, tenantId);

    const tentativaReal = contagensExistentes.length + 1;

    if (tentativaReal > 3) {
      return res.status(400).json({ erro: 'Número máximo de contagens (3) excedido' });
    }

    // 3. VALIDAÇÃO DA CONTAGEM (backend)
    const qtdEsperada = parseFloat(item.quantidade || 0);
    const qtdContada = parseFloat(quantidade || 0);
    const unidadeEsperada = item.unidade_medida || 'UN';
    const unidadeContada = unidade_medida || 'UN';

    const diferenca = Math.abs(qtdContada - qtdEsperada);
    const quantidadeOk = diferenca < 0.001;
    const unidadeOk = unidadeEsperada === unidadeContada;

    let status;
    if (quantidadeOk && unidadeOk) {
      status = 'aprovado';
    } else {
      if (tentativaReal < 3) {
        status = 'pendente';
      } else {
        status = 'rejeitado';
      }
    }

    // 4. Registrar no histórico
    const historico = await DB.insert('historico_contagens_cegas', {
      tenant_id: tenantId,
      ordem_venda_item_id: itemIdNum,
      tentativa: tentativaReal,
      quantidade_contada: qtdContada,
      lote: lote || null,
      validade: validade || null,
      numero_serie: numero_serie || null,
      unidade_medida: unidadeContada,
      status_quarentena: status,
      observacao: observacao || null,
      contado_por: req.userId,
      contado_em: new Date(),
      is_atual: true
    }, tenantId);

    // 5. Desmarcar contagens anteriores
    for (const c of contagensExistentes) {
      await DB.update('historico_contagens_cegas', c.id, {
        is_atual: false
      }, tenantId);
    }

    // 6. Atualizar o item da OV
    const contagemDefinitiva = (status === 'aprovado' || tentativaReal >= 3);

    await DB.update('ordem_venda_itens', itemIdNum, {
      tentativa_atual: tentativaReal,
      contagem_atual_id: historico.id,
      quantidade_recebida_fisica: qtdContada,
      // Se não for definitivo, mantém como 'em_andamento' para o front reabrir
      status_contagem: contagemDefinitiva ? 'concluido' : 'em_andamento', 
      lote: lote || null,
      validade: validade || null,
      numero_serie: numero_serie || null,
      unidade_medida: unidadeContada,
      // Salva como 'rejeitado' apenas na 3ª tentativa errada
      status_quarentena: status, 
      migo_por: req.userId,
      migo_em: new Date()
    }, tenantId);

    // 7. Se aprovado e tentativa >= 2, atualizar saldo
    if (status === 'aprovado' && tentativaReal >= 2) {
      const itemConsumo = await DB.selectOne('itens_consumo', { 
        id: item.item_catalogo_id, 
        tenant_id: tenantId 
      }, tenantId);
      
      if (itemConsumo) {
        const novoSaldo = (parseFloat(itemConsumo.saldo_atual) || 0) + qtdContada;
        await DB.update('itens_consumo', itemConsumo.id, {
          saldo_atual: novoSaldo,
          atualizado_em: new Date()
        }, tenantId);
      }
    }

    // 8. Buscar histórico completo para retornar
    const historicoCompleto = await DB.select('historico_contagens_cegas', { 
      ordem_venda_item_id: itemIdNum,
      tenant_id: tenantId 
    }, tenantId);

    // 9. Verificar se todos os itens da OV foram contados (DENTRO DE POST /contagem-cega)
    const itensOV = await DB.select('ordem_venda_itens', { 
      ordem_venda_id: item.ordem_venda_id, 
      tenant_id: tenantId 
    }, tenantId);
    
    const todosContados = itensOV.every(i => i.status_contagem === 'concluido');
    
    // 🔥 CALCULA O STATUS GERAL DA OV BASEADO NOS ITENS ATUALIZADOS
    const novoStatusGeralOV = calcularStatusOV(itensOV);

    // 🔥 ATUALIZAÇÃO SÍNCRONA NO SUPABASE (Tabela Pai)
    await DB.update('ordens_venda', item.ordem_venda_id, {
      status: todosContados ? 'contagem_concluida' : 'em_andamento',
      status_recebimento: novoStatusGeralOV, // ✅ Atualiza a coluna física que o front lê!
      atualizado_em: new Date()
    }, tenantId);

    res.json({
      ok: true,
      mensagem: 'Contagem cega registrada com sucesso e status atualizado!',
      tentativa_atual: tentativaReal,
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

            console.log(`OV ${ov.id} tem ${itens.length} itens`);

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

      const itensDivergentesCalculados = itensComNomes.filter(i => 
        i.status_quarentena === 'rejeitado' || 
        i.status_contagem === 'pendente' ||
        i.status_contagem === 'em_andamento' 
      ).length;

      // ✅ 2. Retorno ajustado para forçar o envio de todas as formas possíveis
      return {
        ...ov,
        itens: itensComNomes,
        fornecedor_nome: fornecedor?.nome || '—',
        status_recebimento: statusRecebimento,
        total_itens: itensComNomes.length,
        itens_divergentes: itensDivergentesCalculados, // Alinhado com snake_case
        itensDivergentes: itensDivergentesCalculados,   // Alinhado com camelCase
        TESTE_CONEXAO: "ROTA_EM_PROCESSO_ATUALIZADA"   // Nosso carimbo de prova real
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

// ─────────────────────────────────────────────────────────────────────
// 2. ROTA DO CLIQUE NO CARD (NO SINGULAR) - Usada quando você clica em uma OV
// ─────────────────────────────────────────────────────────────────────
router.get('/ordem-venda/:ovId', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { ovId } = req.params;

    // Buscar OV
    const ov = await DB.selectOne('ordens_venda', { id: ovId }, tenantId);
    if (!ov) {
      return res.status(404).json({ erro: 'OV não encontrada' });
    }

    // Buscar itens da OV
    const itens = await DB.select('ordem_venda_itens', { ordem_venda_id: ovId }, tenantId);

    // Buscar dados do catálogo para cada item
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

    // Retorno padrão esperado pelo seu frontend
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

// ─────────────────────────────────────────────────────────────────────
// 1. ROTA DA LISTAGEM GERAL (NO PLURAL) - Usada para carregar a tela
// ─────────────────────────────────────────────────────────────────────
router.get('/ordens-venda', tenantMiddleware, async (req, res) => {
  console.log('🔍 Rota /ordens-venda chamada');
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
      }, null);

      // Buscar fornecedor
      const fornecedor = ov.fornecedor_id ?
        await DB.selectOne('fornecedores', { id: ov.fornecedor_id, tenant_id: tenantId }, tenantId) :
        null;

      // Calcular status dinâmico
      const statusRealCalculado = calcularStatusOV(itens);

      // Calcular itens divergentes
      const itensDivergentes = itens.filter(i =>
        i.status_quarentena === 'rejeitado' ||
        i.status_contagem === 'pendente' ||
        i.status_contagem === 'em_andamento'
      ).length;

      // Injeta as propriedades calculadas depois do spread (...ov) para o JSON não sumir
      return {
        ...ov,
        itens: itens || [],
        fornecedor_nome: fornecedor?.nome || '—',
        total_itens: itens?.length || 0,
        status_recebimento: statusRealCalculado,
        itens_divergentes: itensDivergentes,
        itensDivergentes: itensDivergentes
      };
    }));

    res.json(ordensCompletas || []);
  } catch (err) {
    console.error('❌ Erro ao buscar OVs:', err.message);
    res.status(500).json({ erro: err.message });
  }
});


// PUT /api/estoque/movimentacoes/item/:itemId/aprovar-saldo
router.put('/item/:itemId/aprovar-saldo', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { itemId } = req.params;
    const { justificativa, destino_tratativa } = req.body; // 'aprovado' ou 'nao_conformidade'

    if (!justificativa) {
      return res.status(400).json({ erro: 'Justificativa é obrigatória' });
    }

    // 1. Buscar item da OV
    const item = await DB.selectOne('ordem_venda_itens', { id: itemId, tenant_id: tenantId }, tenantId);
    if (!item) {
      return res.status(404).json({ erro: 'Item não encontrado' });
    }

    // 2. Tratar de acordo com a decisão do Gestor
    if (destino_tratativa === 'nao_conformidade') {
      // Gera o número da NC em tempo de execução
      let numeroNC = `NC-${new Date().getFullYear()}-0001`; 
      try {
        numeroNC = await gerarNumeroNC(tenantId);
      } catch (e) {
        console.log("Tabela nao_conformidades ainda não criada. Usando número temporário.");
      }

      const justificativaCompleta = `[${numeroNC}] - Recusa definitiva por: ${justificativa}`;

      // Atualiza o item da OV com o carimbo da NC na observação
      await DB.update('ordem_venda_itens', itemId, {
        status_quarentena: 'nao_conforme',
        status_contagem: 'concluido',
        observacao: justificativaCompleta,
        atualizado_em: new Date()
      }, tenantId);

      // alvar na tabela nova de não conformmidades
      await DB.insert('nao_conformidades', {
        tenant_id: tenantId,
        numero_nc: numeroNC,
        ordem_venda_id: ov.id,
        numero_pedido: ov.numero,
        fornecedor_nome: ov.fornecedor_nome,
        numero_nota_fiscal: item.numero_nota_fiscal,
        inspetor_id: req.userId,
        motivo_recusa: justificativa,
        quantidade: parseFloat(item.quantidade_recebida_fisica || 0),
        unidade_medida: item.unidade_medida,
        lote: item.lote,
        numero_serie: item.numero_serie,
        validade: item.validade
      }, tenantId);
      
      // Recalcula o status pai da ordem para atualizar o card na tela
      const todosItens = await DB.select('ordem_venda_itens', { ordem_venda_id: item.ordem_venda_id }, tenantId);
      const novoStatusOV = calcularStatusOV(todosItens);
      await DB.update('ordens_venda', item.ordem_venda_id, {
        status_recebimento: novoStatusOV,
        atualizado_em: new Date()
      }, tenantId);

      return res.json({
        ok: true,
        mensagem: `Material rejeitado com sucesso! Foi gerado o Registro de Não Conformidade: ${numeroNC}`
      });
    }

    // 📦 SE FOR APROVADO (Fluxo SAP: Envia para o endereço 'RECEBIMENTO')
    // 3. Atualizar o item da OV para liberado
    await DB.update('ordem_venda_itens', itemId, {
      status_quarentena: 'aprovado',
      status_contagem: 'concluido',
      aprovado_por: req.userId,
      aprovado_em: new Date(),
      observacao: `Saldo aprovado em tratativa: ${justificativa}`
    }, tenantId);

    // 4. Buscar o cadastro do item no catálogo para saber a quantidade física contada
    const itemConsumo = await DB.selectOne('itens_consumo', { id: item.item_catalogo_id }, tenantId);
    
    if (itemConsumo) {
      // Entrada do saldo na tabela de estoque apontando para a doca/localização de RECEBIMENTO
      const novoSaldo = (parseFloat(itemConsumo.saldo_atual) || 0) + parseFloat(item.quantidade_recebida_fisica || 0);
      
      await DB.update('itens_consumo', itemConsumo.id, {
        saldo_atual: novoSaldo,
        localizacao: 'RECEBIMENTO', // 🔥 Transfere temporariamente para o endereço de conferência
        atualizado_em: new Date()
      }, tenantId);

      // Registrar o histórico da movimentação de entrada SAP
      await DB.insert('movimentacoes_estoque', {
        tenant_id: tenantId,
        item_consumo_id: itemConsumo.id,
        tipo: 'entrada',
        quantidade: parseFloat(item.quantidade_recebida_fisica || 0),
        responsavel_id: req.userId,
        observacao: `Entrada via Liberação de Quarentena (SAP WM). Justificativa: ${justificativa}`,
        criado_em: new Date()
      }, tenantId);
    }

    res.json({
      ok: true,
      mensagem: 'Saldo aprovado com sucesso! O material está alocado na doca de RECEBIMENTO.'
    });

  } catch (err) {
    console.error('❌ Erro ao aprovar saldo:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// VERSÃO DEFINITIVA BASEADA NO NÚMERO DE TENTATIVAS REAIS
function calcularStatusOV(itens) {
  if (!itens || itens.length === 0) return 'pendente';
  
  // 1. PRIORIDADE MÁXIMA: Se houver qualquer item rejeitado/quarentena (Falha na 3ª contagem ou fiscal)
  const temQuarentena = itens.some(i => i.status_quarentena === 'rejeitado' || i.status_quarentena === 'quarentena');
  if (temQuarentena) return 'quarentena';

  // 2. SEGUNDA PRIORIDADE: Se o item já teve alguma tentativa registrada (tentativa_atual > 0)
  // mas o status_contagem NÃO está concluído, significa que ele está esperando recontagem (AMARELO)!
  const temRecontagemAtiva = itens.some(i => (i.tentativa_atual || 0) > 0 && i.status_contagem !== 'concluido');
  if (temRecontagemAtiva) return 'contagem_pendente';

  // 3. TERCEIRA PRIORIDADE: Se a conferência fiscal foi feita, mas NENHUMA contagem foi tentada ainda (tentativa_atual === 0)
  const temMiro = itens.some(i => i.miro_por);
  const nenhumaContagemFeita = itens.every(i => (i.tentativa_atual || 0) === 0);
  
  if (temMiro && nenhumaContagemFeita) return 'aguardando_contagem';

  // 4. QUARTA PRIORIDADE: Fluxo feliz 100% concluído e aprovado
  const todosConcluidos = itens.every(i => i.status_contagem === 'concluido' && i.status_quarentena === 'aprovado');
  if (todosConcluidos) return 'parcial';
  
  return 'pendente'; 
}

module.exports = router;