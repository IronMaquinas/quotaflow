// routes/estoque/movimentacoes.js
const express = require('express');
const router = express.Router();
const { DB } = require('../../db');
const tenantMiddleware = require('../../middleware/tenantMiddleware');
const ValidacaoXmlService = require('../../services/ValidacaoXmlService');

const SISTEMA_UUID = '00000000-0000-0000-0000-000000000000';

// ─────────────────────────────────────────────────────────────────────
// HELPER: dados do usuário logado
//
// Mesma função que existe em routes/cotacoes.js e routes/naoConformidades.js.
// Usada aqui pra gravar `criado_por_nome` / `aprovado_por` nas entidades
// que o fluxo de recebimento cria (NCs principalmente). Falha silenciosa
// se o usuário não existir — devolve nome null.
// ─────────────────────────────────────────────────────────────────────
async function usuarioAtual(req, tenantId) {
  let nome = null;
  if (req.userId) {
    try {
      const u = await DB.selectOne("usuarios", { id: req.userId }, tenantId);
      nome = u?.nome || null;
    } catch (_) {}
  }
  return { id: req.userId || null, nome, email: req.userEmail || null };
}

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

  // FIX (2026-09): a versão anterior usava DB.raw() com LIKE/ORDER BY/LIMIT —
  // esse padrão de SQL não está entre os poucos que db.js reconhece de fato,
  // então caía no fallback genérico (sem filtro/ordenação reais) e a
  // numeração nunca avançava direito. Trocado para buscar as NCs do tenant
  // via DB.select (sempre confiável) e calcular a maior sequência em JS.
  const todasNC = await DB.select('nao_conformidades', { tenant_id: tenantId }, tenantId).catch(() => []);

  let seq = 1;
  const numerosDoAno = (todasNC || [])
    .map(nc => nc.numero_nc)
    .filter(n => n && n.startsWith(prefix))
    .map(n => {
      const match = n.match(/(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    });

  if (numerosDoAno.length > 0) {
    seq = Math.max(...numerosDoAno) + 1;
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
        const quantidadePendente = (parseFloat(itemOV.quantidade) || 0) - (parseFloat(itemOV.quantidade_recebida) || 0);
        if (item.quantidade > quantidadePendente) {
          return res.status(400).json({ erro: `Quantidade recebida excede o pendente para o item ${itemOV.nome_item}` });
        }

        // FIX (2026-09): saldo_atual e quantidade_recebida são colunas
        // `numeric` no Postgres — o driver retorna esse tipo como STRING em
        // JS, não number. Sem parseFloat, "+" virava concatenação de texto
        // (ex.: "41" + 4 = "414" em vez de 45), inflando o saldo de forma
        // silenciosa e corrompendo também a comparação de status abaixo.
        // Atualizar quantidade recebida no item da OV
        const novaQuantidadeRecebida = (parseFloat(itemOV.quantidade_recebida) || 0) + parseFloat(item.quantidade);
        await DB.update('ordem_venda_itens', itemOV.id, {
          quantidade_recebida: novaQuantidadeRecebida,
          status_recebimento: novaQuantidadeRecebida >= parseFloat(itemOV.quantidade) ? 'recebido' : 'parcial'
        }, tenantId);

        // Buscar item de consumo (para atualizar saldo)
        // M4.3-ah: só busca se tem catálogo vinculado (ver armadilha #1 do README).
        const itemConsumo = itemOV.item_catalogo_id
          ? await DB.selectOne('itens_consumo', { catalogo_item_id: itemOV.item_catalogo_id, tenant_id: tenantId }, tenantId)
          : null;
        if (itemConsumo) {
          const novoSaldo = (parseFloat(itemConsumo.saldo_atual) || 0) + parseFloat(item.quantidade);
          await DB.update('itens_consumo', itemConsumo.id, {
            saldo_atual: novoSaldo,
            atualizado_em: new Date()
          }, tenantId);
        }

        // Registrar movimentação de entrada (vinculada à OV)
        await DB.insert('movimentacoes_estoque', {
          tenant_id: tenantId,
          item_consumo_id: itemConsumo?.id || null,
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
    // M4.3-ao: idem — ordem de criação, imutável. Sem isso, cada UPDATE
    // (fiscal/contagem/entrada) pode reordenar o heap físico do Postgres
    // e o card muda de posição na próxima F5.
    (itens || []).sort((a, b) => Number(a.id) - Number(b.id));
    
    // 3. NF-e atual (última não-substituída) da OC — preenchida quando
    //    o fornecedor já anexou o XML via hub. O frontend usa pra:
    //      • Mostrar o banner "NF-e validada digitalmente"
    //      • Esconder o botão de upload manual no fluxo fiscal
    //      • Pré-marcar itens que já passaram na validação automática
    const nfesDaOv = await DB.select('ordem_venda_xmls', { ordem_venda_id: ovId }, tenantId);
    const nfeAtual = (nfesDaOv || [])
      .filter(x => x.status !== 'substituido')
      .sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0))[0] || null;

    // Mapa item-OC → status na validação fiscal (a validação guarda o
    // nome do item da OC, não o id). Uso pra marcar `fiscal_auto_aprovado`
    // por item.
    const itensOkNaValidacao = new Set(
      (nfeAtual?.validacao?.itens || [])
        .filter(v => v.status === 'ok')
        .map(v => String(v.item || '').trim().toLowerCase())
    );

    // M4.3-e: buscar NCs abertas da OV pra enriquecer cada item com
    // nc_id/numero_nc (TelaRecebimento navega direto pra NC vinculada).
    // "Aberta" = status NÃO em ('resolvida', 'cancelada').
    const todasNCs = await DB.select('nao_conformidades', { tenant_id: tenantId }, tenantId)
      .catch(() => []);
    const ncsAbertasDaOV = todasNCs.filter(nc =>
      String(nc.ordem_venda_id) === String(ovId)
      && !['resolvida', 'cancelada'].includes(nc.status)
    );

    // M4.3-aa: nomes dos usuários que deram entrada (pra modal de entradas).
    // Busca 1x todos os usuários do tenant e faz lookup em JS (padrão do projeto).
    const todosUsuarios = await DB.select('usuarios', { tenant_id: tenantId }, tenantId).catch(() => []);
    const nomeUsuarioPorId = {};
    for (const u of todosUsuarios) nomeUsuarioPorId[String(u.id)] = u.nome || null;

    // 4. Buscar itens de consumo (para saber o SKU e saldo)
    const itensCompletos = await Promise.all(itens.map(async (item) => {
      // M4.3-ah: só busca itens_consumo se o item tem catálogo vinculado.
      // Com `item_catalogo_id: null`, o DB.selectOne ignora o null (armadilha
      // #1 do README) e retorna o PRIMEIRO item de consumo do tenant,
      // sobrescrevendo nome/sku do item da OC com dado errado.
      const itemConsumo = item.item_catalogo_id
        ? await DB.selectOne('itens_consumo', { catalogo_item_id: item.item_catalogo_id, tenant_id: tenantId }, tenantId)
        : null;
      const nomeItem = item.nome_item || 'Item sem nome';
      const fiscalOk = itensOkNaValidacao.has(String(nomeItem).trim().toLowerCase());

      // M4.3-e: NC aberta do item. Vínculo por número de série; se o
      // item não tiver série e houver só 1 NC na OV, assume ela.
      const ncPorSerie = item.numero_serie
        ? ncsAbertasDaOV.find(nc => nc.numero_serie && String(nc.numero_serie) === String(item.numero_serie))
        : null;
      const ncDoItem = ncPorSerie || (ncsAbertasDaOV.length === 1 ? ncsAbertasDaOV[0] : null);

      return {
        ...item,
        item_nome: itemConsumo?.nome || nomeItem,
        sku: itemConsumo?.sku || item.sku || '—',
        saldo_atual: itemConsumo?.saldo_atual || 0,
        unidade_medida: itemConsumo?.unidade_medida || item.unidade_medida || 'UN',
        quantidade_recebida: item.quantidade_recebida || 0,
        quantidade_pendente: (item.quantidade || 0) - (item.quantidade_recebida || 0),
        // Fase M3: a validação automática já conferiu este item.
        fiscal_auto_aprovado: fiscalOk,
        // M4.3-e: NC aberta vinculada a este item (se houver).
        nc_id: ncDoItem?.id || null,
        numero_nc: ncDoItem?.numero_nc || null,
        // M4.3-aa: nome de quem deu entrada (pro modal de entradas).
        entrada_por_nome: item.entrada_por
          ? (nomeUsuarioPorId[String(item.entrada_por)] || null)
          : null,
      };
    }));

    res.json({
      ok: true,
      ordem_venda: {
        id: ov.id,
        numero: ov.numero,
        status: ov.status,
        fornecedor_id: ov.fornecedor_id,
        valor_total: ov.valor_total,
        xml_anexado_em: ov.xml_anexado_em,
        xml_validacao_status: ov.xml_validacao_status,
        // FIX M3: `nfe_atual` DENTRO de ordem_venda — o frontend faz
        // setOrdemVendaSel(response.ordem_venda), então o campo tem que
        // estar no mesmo objeto. Antes vinha como chave irmã, e o banner
        // nunca aparecia.
        nfe_atual: nfeAtual ? {
          id: nfeAtual.id,
          numero_nf: nfeAtual.numero_nf,
          chave_acesso: nfeAtual.chave_acesso,
          status: nfeAtual.status,
          divergencias_count: nfeAtual.divergencias_count || 0,
          enviado_em: nfeAtual.criado_em,
          validacao: nfeAtual.validacao,
          resumo: nfeAtual.xml_resumo,
        } : null,
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
// FIX (2026-09): reescrita completa. Antes tinha um ReferenceError (usava um
// `itemId` que nunca era declarado — quebrava sempre) e, mesmo corrigindo só
// isso, só cobria entrada vinculada a uma OV existente, duplicando o que
// MIRO/MIGO/aprovar-saldo já fazem. Agora suporta dois modos: com OV
// (item_id) e sem OV (item_consumo_id) — este último pra compra emergencial
// fora do processo (cartão, dinheiro etc.), com rastreabilidade: toda
// entrada sem OV grava ordem_venda_numero: 'Compra sem OV', pra permitir no
// futuro medir que % das compras da empresa não passam pelo fluxo normal.
router.post('/entrada', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const {
      item_id,                 // modo COM OV: id de ordem_venda_itens
      item_consumo_id,         // modo SEM OV: id direto de itens_consumo
      fornecedor_id,           // opcional, se o fornecedor já está cadastrado
      fornecedor_nome_manual,  // opcional, texto livre p/ fornecedor avulso
      quantidade,
      numero_nota_fiscal,
      observacao
    } = req.body;

    if (!quantidade || quantidade <= 0) {
      return res.status(400).json({ erro: 'Quantidade inválida' });
    }

    if (item_id) {
      // ─── MODO COM OV: mantém o 3-way match contra o item da OV ───
      const item = await DB.selectOne('ordem_venda_itens', { id: item_id, tenant_id: tenantId }, tenantId);
      if (!item) {
        return res.status(404).json({ erro: 'Item da OV não encontrado' });
      }

      // M4.3-ak: idempotência. Rejeita se o item já foi 100% recebido —
      // sem isso, 2 cliques rápidos (ou retry de rede) dobram o saldo
      // em itens_consumo. O frontend bloqueia o botão, mas isso é UI;
      // o backend precisa garantir a invariante por conta própria.
      const qtdPlanejada = Number(item.quantidade || 0);
      const qtdRecebida = Number(item.quantidade_recebida || 0);
      if (qtdRecebida >= qtdPlanejada && qtdPlanejada > 0) {
        return res.status(400).json({
          erro: 'Item já foi recebido integralmente. Nenhuma ação necessária.'
        });
      }

      const ov = await DB.selectOne('ordens_venda', { id: item.ordem_venda_id, tenant_id: tenantId }, tenantId);
      if (!ov) {
        return res.status(404).json({ erro: 'OV não encontrada' });
      }

      // M4.3-t: no 1º recebimento o item pode não existir em itens_consumo
      // ainda — é o caso normal em compras (estoque zerou → OC gerada).
      // O catálogo já validou o item na criação da OC; criamos a "ficha
      // de estoque" on-the-fly e seguimos com a entrada.
      // `sku` (part number) vem de `catalogo_itens.codigo` — fonte única.
      // M4.3-ah: só busca se tem catálogo vinculado.
      let itemConsumo = item.item_catalogo_id
        ? await DB.selectOne('itens_consumo', { catalogo_item_id: item.item_catalogo_id, tenant_id: tenantId }, tenantId)
        : null;
      if (!itemConsumo) {
        const catalogo = await DB.selectOne('catalogo_itens', { id: item.item_catalogo_id, tenant_id: tenantId }, tenantId);
        if (!catalogo) {
          return res.status(400).json({
            erro: 'Item não encontrado no catálogo. Cadastre-o antes de dar entrada.'
          });
        }
        itemConsumo = await DB.insert('itens_consumo', {
          tenant_id: tenantId,
          catalogo_item_id: item.item_catalogo_id,
          nome: catalogo.nome || item.nome_item || 'Item sem nome',
          sku: catalogo.codigo || null,
          unidade_medida: catalogo.unidade || 'UN',
          saldo_atual: 0,
          serializado: false,
        }, tenantId);
        console.log(`🆕 itens_consumo criado on-the-fly: id=${itemConsumo.id} catalogo=${item.item_catalogo_id} sku="${catalogo.codigo}" nome="${catalogo.nome}"`);
      }

      // 3-WAY MATCH VALIDAÇÃO
      const valorNF = parseFloat(item.valor_nf || 0);
      const valorOV = parseFloat(item.valor_unitario * item.quantidade || 0);
      const quantidadeNF = parseInt(item.numero_nota_fiscal ? item.quantidade : 0);
      const quantidadeFisica = parseInt(item.quantidade_recebida_fisica || 0);

      const divergencias = [];
      if (valorNF !== valorOV) divergencias.push('Valor da NF diferente da OV');
      if (quantidadeNF !== quantidadeFisica) divergencias.push('Quantidade da NF diferente da física');

      if (divergencias.length > 0) {
        return res.status(400).json({
          erro: 'Divergência encontrada no 3-Way Match',
          divergencias
        });
      }

      const novoSaldo = (parseFloat(itemConsumo.saldo_atual) || 0) + parseFloat(quantidade);
      await DB.update('itens_consumo', itemConsumo.id, {
        saldo_atual: novoSaldo,
        atualizado_em: new Date()
      }, tenantId);

      await DB.insert('movimentacoes_estoque', {
        tenant_id: tenantId,
        item_consumo_id: itemConsumo.id,
        tipo: 'entrada',
        quantidade: quantidade,
        responsavel_id: req.userId,
        observacao: observacao || `Recebimento da OV ${ov.numero}`,
        fornecedor_id: fornecedor_id || ov.fornecedor_id || null,
        numero_nota_fiscal: numero_nota_fiscal || null,
        ordem_venda_id: ov.id,
        ordem_venda_numero: ov.numero,
        criado_em: new Date()
      }, tenantId);

      // M4.3-v: `ordem_venda_itens` NÃO tem coluna `atualizado_em` (só
      // `ordens_venda` e `itens_consumo` têm). O UPDATE falhava e
      // bloqueava a entrada no estoque.
      await DB.update('ordem_venda_itens', item.id, {
        quantidade_recebida: parseInt(item.quantidade_recebida || 0) + parseInt(quantidade),
        // M4.3-w: rastreio por etapa (espelha miro_por/miro_em e migo_por/migo_em)
        entrada_por: req.userId,
        entrada_em: new Date().toISOString(),
      }, tenantId);

      // M4.3-y: atualizar `status` E `status_recebimento` juntos — o card
      // lê `status_recebimento`, e antes só `status` era atualizado
      // (ficava dessincronizado, mostrando "Aguardando Entrada" mesmo
      // com tudo recebido).
      const itensOV = await DB.select('ordem_venda_itens', { ordem_venda_id: ov.id }, tenantId);
      const todosRecebidos = itensOV.every(i => Number(i.quantidade_recebida || 0) >= Number(i.quantidade || 0));
      await DB.update('ordens_venda', ov.id, {
        status: todosRecebidos ? 'recebido' : 'parcial_recebido',
        status_recebimento: todosRecebidos ? 'recebido' : 'parcial',
      }, tenantId);

      return res.json({ ok: true, mensagem: '3-Way Match validado e entrada no estoque realizada!' });
    }

    // ─── MODO SEM OV: entrada manual / compra emergencial ───
    if (!item_consumo_id) {
      return res.status(400).json({ erro: 'Informe item_id (com OV) ou item_consumo_id (sem OV)' });
    }

    const itemConsumo = await DB.selectOne('itens_consumo', { id: item_consumo_id, tenant_id: tenantId }, tenantId);
    if (!itemConsumo) {
      return res.status(404).json({ erro: 'Item de consumo não encontrado' });
    }

    const novoSaldo = (parseFloat(itemConsumo.saldo_atual) || 0) + parseFloat(quantidade);
    await DB.update('itens_consumo', itemConsumo.id, {
      saldo_atual: novoSaldo,
      atualizado_em: new Date()
    }, tenantId);

    const observacaoFornecedor = fornecedor_nome_manual ? ` - Fornecedor: ${fornecedor_nome_manual}` : '';

    await DB.insert('movimentacoes_estoque', {
      tenant_id: tenantId,
      item_consumo_id: itemConsumo.id,
      tipo: 'entrada',
      quantidade: quantidade,
      responsavel_id: req.userId,
      observacao: `Entrada manual sem OV${observacaoFornecedor}${observacao ? ' - ' + observacao : ''}`,
      fornecedor_id: fornecedor_id || null,
      numero_nota_fiscal: numero_nota_fiscal || null,
      ordem_venda_id: null,
      ordem_venda_numero: 'Compra sem OV',
      criado_em: new Date()
    }, tenantId);

    return res.json({ ok: true, mensagem: 'Entrada manual registrada com sucesso (sem OV).' });
  } catch (err) {
    console.error('❌ Erro ao entrar no estoque:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

// POST /api/estoque/movimentacoes/validar-xml
// POST /api/estoque/movimentacoes/validar-xml
router.post('/validar-xml', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { ordem_venda_id, xml } = req.body;

    if (!xml || !xml.itens_xml) {
      return res.status(400).json({ erro: "Dados do XML não recebidos ou incompletos na requisição." });
    }

    // Lógica toda vive no ValidacaoXmlService — aqui é só wrapper HTTP.
    // Mesma regra usada pelo portal do fornecedor (upload no hub, M2).
    const resultado = await ValidacaoXmlService.validarXmlContraOc(
      xml,
      ordem_venda_id,
      tenantId
    );

    return res.json(resultado);
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

    // M4.3-c: separar "resultado da contagem" (historico_contagens_cegas)
    // de "estado do item" (ordem_venda_itens). A contagem tem 4 estados,
    // o item tem 3. Nomes diferentes pra não confundir semântica ISO.
    let resultadoContagem;   // vai pra historico_contagens_cegas.resultado_contagem
    let statusItem;          // vai pra ordem_venda_itens.status_quarentena
    if (quantidadeOk && unidadeOk) {
      resultadoContagem = 'aprovado';
      statusItem = 'aprovado';
    } else {
      if (tentativaReal < 3) {
        resultadoContagem = 'divergente_pendente';
        statusItem = 'pendente';
      } else {
        resultadoContagem = 'divergente_esgotado';
        statusItem = 'rejeitado';
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
      resultado_contagem: resultadoContagem,
      observacao: observacao || null,
      contado_por: req.userId,
      contado_em: new Date().toISOString(),
      is_atual: true
    }, tenantId);

    // 5. Desmarcar contagens anteriores
    for (const c of contagensExistentes) {
      await DB.update('historico_contagens_cegas', c.id, {
        is_atual: false
      }, tenantId);
    }

    // 6. Atualizar o item da OV
    const contagemDefinitiva = (statusItem === 'aprovado' || tentativaReal >= 3);

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
      status_quarentena: statusItem, 
      migo_por: req.userId,
      migo_em: new Date()
    }, tenantId);

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
      // M4.3-n: após o split `status` → `resultadoContagem` + `statusItem`,
      // o frontend continua lendo `response.status` pra saber se foi
      // aprovado/pendente/rejeitado. Mandamos o statusItem (o do item).
      status: statusItem
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
    // FIX: wrapper não garante WHERE composto em DB.selectOne — busca por
    // tenant e filtra em JS (convenção do projeto).
    const todosItensTenant = await DB.select('ordem_venda_itens', { tenant_id: tenantId }, tenantId);
    const item = todosItensTenant.find(i => String(i.id) === String(itemIdNum));

    if (!item) {
      return res.status(404).json({ erro: 'Item da OV não encontrado' });
    }

    // 2. Buscar histórico
    // FIX: idem — traz do tenant e filtra em JS por ordem_venda_item_id.
    const todosHistoricos = await DB.select('historico_contagens_cegas', { tenant_id: tenantId }, tenantId);
    const historico = todosHistoricos.filter(h => String(h.ordem_venda_item_id) === String(itemIdNum));
    console.log('[historico-contagens]', {
      itemIdNum,
      totalTenant: todosHistoricos.length,
      encontradoParaItem: historico.length,
    });

    // 3. Ordenar por tentativa
    historico.sort((a, b) => (a.tentativa || 0) - (b.tentativa || 0));

    // 4. Buscar nomes dos contadores
    const historicoComNomes = await Promise.all(historico.map(async (h) => {
      const usuario = await DB.selectOne('usuarios', { id: h.contado_por }, tenantId);
      return {
        ...h,
        contado_por_nome: usuario?.nome || 'Usuário não encontrado',
        contado_em_formatado: h.contado_em
          ? new Date(h.contado_em).toLocaleString('pt-BR')
          : null
      };
    }));

    // 5. Buscar informações do item de consumo
    let itemConsumo = null;
    if (item?.item_catalogo_id) {
      itemConsumo = await DB.selectOne('itens_consumo', { 
        catalogo_item_id: item.item_catalogo_id, 
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

    // FIX (2026-09): DB.select faz `coluna = valor` — passar um array como
    // valor nunca bate com uma coluna escalar (equivale a comparar
    // status_contagem = ARRAY['pendente','em_andamento'], que nunca é
    // verdadeiro), então essa rota nunca listava nada, mesmo com itens
    // pendentes de verdade. Busca tudo do tenant e filtra em JS.
    // 1. Buscar todos os itens pendentes
    const statusContagemDesejados = ['pendente', 'em_andamento'];
    const todosItensDoTenant = await DB.select('ordem_venda_itens', {
      tenant_id: tenantId
    }, tenantId);
    const itensPendentes = todosItensDoTenant.filter(i => statusContagemDesejados.includes(i.status_contagem));

    // 2. Filtrar os que não estão em quarentena
    const itensFiltrados = itensPendentes.filter(item => 
      item.status_quarentena !== 'rejeitado'
    );

    // 3. Buscar dados relacionados separadamente (padrão do sistema)
    const itensCompletos = await Promise.all(itensFiltrados.map(async (item) => {
      // Buscar item de consumo
      const itemConsumo = await DB.selectOne('itens_consumo', { 
        catalogo_item_id: item.item_catalogo_id, 
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

    // FIX (2026-09): mesmo problema de /contagens-pendentes — array como
    // valor de filtro nunca bate numa coluna escalar. Busca todas as OVs do
    // tenant e filtra os status desejados em JS.
    // 1. Buscar todas as OVs não concluídas
    const statusEmProcesso = ['pendente', 'parcial', 'aguardando_contagem', 'contagem_pendente', 'quarentena'];
    const todasOrdensDoTenant = await DB.select('ordens_venda', {
      tenant_id: tenantId
    }, tenantId);
    const ordens = todasOrdensDoTenant.filter(ov => statusEmProcesso.includes(ov.status_recebimento));

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
          catalogo_item_id: item.item_catalogo_id, 
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
// ⚠️  M4.3-aq: rota DUPLICADA. A versão ativa é a do topo do arquivo
// (registrada primeiro — Express usa a primeira). Esta segunda nunca é
// chamada. Mantida por segurança até confirmar que nenhum cliente/curl
// aponta pra cá. Candidata a remoção no próximo cleanup.
//
// Se algum dia reativar: PRECISA do `.sort()` no DB.select de itens
// (armadilha do README) pra ordem dos itens ficar estável.
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
      // M4.3-ah: só busca se tem catálogo vinculado.
      const itemConsumo = item.item_catalogo_id
        ? await DB.selectOne('itens_consumo', { catalogo_item_id: item.item_catalogo_id, tenant_id: tenantId }, tenantId)
        : null;
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

      // Fase M3: buscar a NF-e atual pra o card da lista mostrar badge.
      //   • Sem XML                       → "aguardando_fornecedor"
      //   • XML com status 'ok'           → "validada"
      //   • XML com status 'divergencia'  → "divergencia"
      // Não buscamos os itens da validação aqui (só o resumo) — o
      // detalhe da OV faz isso quando o usuário clica.
      const nfesDaOv = await DB.select('ordem_venda_xmls', {
        ordem_venda_id: ov.id,
      }, tenantId);
      const nfeAtual = (nfesDaOv || [])
        .filter(x => x.status !== 'substituido')
        .sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0))[0] || null;

      let nfe_status = 'sem_nfe';
      if (nfeAtual) {
        nfe_status = nfeAtual.status === 'ok' ? 'validada' : 'divergencia';
      }

      // Injeta as propriedades calculadas depois do spread (...ov) para o JSON não sumir
      return {
        ...ov,
        itens: itens || [],
        fornecedor_nome: fornecedor?.nome || '—',
        total_itens: itens?.length || 0,
        status_recebimento: statusRealCalculado,
        itens_divergentes: itensDivergentes,
        itensDivergentes: itensDivergentes,
        nfe_status,
        nfe_numero: nfeAtual?.numero_nf || null,
        nfe_divergencias: nfeAtual?.divergencias_count || 0,
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
    const {
      justificativa,
      destino_tratativa, // 'aprovado' ou 'nao_conformidade'
      anexos,
      // FIX M4.3: campos opcionais. Quando o comprador preenche a
      // contagem mas clica em "Não Conformidade" (em vez de "Registrar
      // Contagem"), o valor digitado precisa vir por aqui — senão a NC
      // nasce com quantidade 0 (bug real).
      quantidade_afetada,
      unidade_medida: unidadeBody,
      lote: loteBody,
      validade: validadeBody,
      numero_serie: serieBody,
    } = req.body;

    if (!justificativa) {
      return res.status(400).json({ erro: 'Justificativa é obrigatória' });
    }

    // 1. Buscar item da OV
    const item = await DB.selectOne('ordem_venda_itens', { id: itemId, tenant_id: tenantId }, tenantId);
    if (!item) {
      return res.status(404).json({ erro: 'Item não encontrado' });
    }

    // FIX M4.3: prioridade dos valores do item recusado.
    //   body (digitado no modal) > quantidade_recebida_fisica (da contagem)
    //   > item.quantidade (planejada) > 0.
    const quantidadeFinal = parseFloat(
      quantidade_afetada ?? item.quantidade_recebida_fisica ?? item.quantidade ?? 0
    );
    const unidadeFinal = unidadeBody || item.unidade_medida || 'UN';
    const loteFinal = loteBody || item.lote || null;
    const validadeFinal = validadeBody || item.validade || null;
    const serieFinal = serieBody || item.numero_serie || null;

    // ─────────────────────────────────────────────────────────────────
    // CAMINHO 2: NÃO CONFORME (Recusa/Devolução)
    // ─────────────────────────────────────────────────────────────────
    if (destino_tratativa === 'nao_conformidade') {
      // FIX M4.3-b: quando o comprador preenche a contagem no modal do
      // recebimento e escolhe "Não Conformidade" (em vez de "Registrar
      // Contagem"), os dados digitados iam só pra NC — nenhuma linha era
      // criada em historico_contagens_cegas. Resultado: o botão
      // "📜 Histórico" mostrava "Nenhuma contagem registrada" mesmo
      // tendo contagem. Persistimos aqui, espelhando o que /contagem-cega
      // faria. M4.3-c: usa valor próprio 'nao_conformidade' (não
      // 'rejeitado') — quarentena e NC são coisas distintas.
      //
      // Só grava se o item AINDA não tem contagem registrada (evita
      // duplicar quando o fluxo veio de "Tratar Quarentena" após uma
      // contagem cega já existente).
      try {
        const todasHistItem = await DB.select('historico_contagens_cegas', { tenant_id: tenantId }, tenantId);
        const contagensItem = todasHistItem.filter(c => String(c.ordem_venda_item_id) === String(item.id));

        if (contagensItem.length === 0) {
          const contagemNC = await DB.insert('historico_contagens_cegas', {
            tenant_id: tenantId,
            ordem_venda_item_id: item.id,
            tentativa: 1,
            quantidade_contada: quantidadeFinal,
            unidade_medida: unidadeFinal,
            lote: loteFinal,
            validade: validadeFinal,
                        numero_serie: serieFinal,
            resultado_contagem: 'nao_conformidade',
            observacao: justificativa ? `NC: ${justificativa}` : 'Não Conformidade registrada na 1ª contagem',
            contado_por: req.userId || null,
            contado_em: new Date().toISOString(),
            is_atual: true,
          }, tenantId);

          // Sincroniza o item pra apontar pra essa contagem (senão a
          // próxima tentativa fica dessincronizada).
          await DB.update('ordem_venda_itens', itemId, {
            tentativa_atual: 1,
            contagem_atual_id: contagemNC?.id || null,
            quantidade_recebida_fisica: quantidadeFinal,
          }, tenantId);
        }
      } catch (e) {
        console.error('❌ Erro ao gravar contagem cega da NC:', e.message);
      }

      let numeroNC = `NC-${new Date().getFullYear()}-0001`; 
      try {
        numeroNC = await gerarNumeroNC(tenantId);
      } catch (e) {
        console.log("Erro ao gerar número sequencial de NC.");
      }

      const justificativaCompleta = `[${numeroNC}] - Recusa definitiva por: ${justificativa}`;

      // FIX (2026-09): registra de fato o Registro de Não Conformidade na
      // tabela nao_conformidades — antes disso nunca acontecia em lugar
      // nenhum do arquivo, então gerarNumeroNC() nunca via NC anterior
      // nenhuma e repetia sempre NC-2026-0001. Envolvido em try/catch
      // próprio pra não travar a recusa do item (já decidida) se algo
      // aqui falhar.
      try {
        const ovParaNC = await DB.selectOne('ordens_venda', { id: item.ordem_venda_id, tenant_id: tenantId }, tenantId);
        const fornecedorParaNC = ovParaNC?.fornecedor_id
          ? await DB.selectOne('fornecedores', { id: ovParaNC.fornecedor_id, tenant_id: tenantId }, tenantId)
          : null;

      // FIX M4: buscar nome do usuário logado pra gravar em
      // `criado_por_nome`. Sem isso, o modal mostra "—" no campo
      // "👤 aberta por".
      const usuarioLogado = await usuarioAtual(req, tenantId);

      const ncCriada = await DB.insert('nao_conformidades', {
        tenant_id: tenantId,
        numero_nc: numeroNC,
        ordem_venda_id: item.ordem_venda_id,
        numero_pedido: ovParaNC?.numero || null,
        fornecedor_id: ovParaNC?.fornecedor_id || null,
        fornecedor_nome: fornecedorParaNC?.nome || null,
        numero_nota_fiscal: item.numero_nota_fiscal || null,
        inspetor_id: req.userId,
        // FIX M4: gravar nos 2 campos. `descricao_problema` é o que o
        // ModalDetalheNC renderiza; `motivo_recusa` é a coluna legada
        // (NOT NULL) usada por outras telas.
        descricao_problema: justificativa,
        motivo_recusa: justificativa,
        // Quem abriu — nome de exibição no header do modal + timeline.
        criado_por_nome: usuarioLogado.nome || null,
        // FIX M4.2: quando o comprador clica "Não Conformidade" sem ter
        // feito contagem antes, `quantidade_recebida_fisica` ainda é null.
        // Fallback pra `item.quantidade` (planejada) — é a quantidade
        // correta quando o item INTEIRO está sendo recusado.
        quantidade: quantidadeFinal,
        unidade_medida: unidadeFinal,
        lote: loteFinal,
        validade: validadeFinal,
        numero_serie: serieFinal,
        fornecedor_tratativa_status: ovParaNC?.fornecedor_id ? 'nao_enviado' : null,
        criado_em: new Date()
      }, tenantId);

        // M4: evento de criação com visibilidade pro fornecedor. Ele
        // vê a NC no portal mesmo sem notificação por email.
        if (ncCriada && ovParaNC?.fornecedor_id) {
          await DB.insert('nao_conformidade_eventos', {
            tenant_id: tenantId,
            nc_id: ncCriada.id,
            tipo: 'criacao',
            descricao: `NC criada no recebimento da OC ${ovParaNC.numero}: ${justificativa}`,
            dados: {
              ordem_venda_id: item.ordem_venda_id,
              quantidade: quantidadeFinal,
            },
            criado_por: req.userId || null,
            criado_por_nome: 'Recebimento',
            visivel_fornecedor: true,
            autor_tipo: 'comprador',
          }, tenantId);
        }

        // M4: anexar evidências que vieram no body. Formato esperado:
        // [{ url, nome_arquivo?, mime_type?, tamanho_bytes? }]
        //
        // FIX M4-p: SEMPRE sobrescrever o nome do arquivo com padrão
        // rastreável `<numeroNC>-evidencia-NN.ext`. Antes, se o cliente
        // mandasse `IMG_1234.jpg`, esse nome ficava gravado — péssimo
        // pra busca futura por NC no storage/banco.
        if (ncCriada && Array.isArray(anexos) && anexos.length > 0) {
          for (let i = 0; i < anexos.length; i++) {
            const a = anexos[i];
            if (!a?.url) continue;
            const ext = (a.mime_type === 'image/png') ? 'png'
              : (a.mime_type === 'image/webp') ? 'webp'
              : (a.mime_type === 'application/pdf') ? 'pdf'
              : 'jpg';
            const nomePadrao = `${numeroNC}-evidencia-${String(i + 1).padStart(2, '0')}.${ext}`;
            await DB.insert('nao_conformidade_anexos', {
              tenant_id: tenantId,
              nc_id: ncCriada.id,
              url: a.url,
              nome_arquivo: nomePadrao,
              mime_type: a.mime_type || null,
              tamanho_bytes: a.tamanho_bytes != null ? parseInt(a.tamanho_bytes) : null,
              criado_por: req.userId || null,
              criado_por_nome: 'Recebimento',
            }, tenantId);
          }
        }

        // M4.1: notificação ao fornecedor respeita a policy do tenant.
        //   'aprovacao' (default) → NC nasce 'nao_notificado'; gestor
        //                            aprova no modal da NC.
        //   'direta'              → email dispara automaticamente agora.
        if (ncCriada && ovParaNC?.fornecedor_id) {
          const tenantCfg = await DB.selectOne('tenants', { id: tenantId });
          const policy = tenantCfg?.nc_notificacao_policy || 'aprovacao';

          if (policy === 'direta') {
            try {
              const { notificarFornecedorNC } = require('../../services/NCService');
              const uLogado = await usuarioAtual(req, tenantId);
              await notificarFornecedorNC(ncCriada.id, tenantId, {
                origem: 'auto',
                userId: uLogado.id,
                userNome: uLogado.nome,
              });
            } catch (mailErr) {
              // Se o email falha (SMTP, fornecedor sem email), a NC fica
              // como 'nao_notificado' e o gestor ainda pode disparar
              // manualmente depois. Registra o problema na timeline.
              console.warn('⚠ Falha ao notificar fornecedor automaticamente:', mailErr.message);
              await DB.insert('nao_conformidade_eventos', {
                tenant_id: tenantId,
                nc_id: ncCriada.id,
                tipo: 'notificacao_falhou',
                descricao: `Envio automático falhou (${mailErr.message}). Use "Notificar fornecedor" para tentar novamente.`,
                dados: { erro: mailErr.message },
                criado_por: null,
                criado_por_nome: 'Sistema',
                visivel_fornecedor: false,
                autor_tipo: 'sistema',
              }, tenantId).catch(() => {});
            }
          } else {
            // Policy 'aprovacao': registra evento interno avisando que
            // precisa de aprovação. Não é visível pro fornecedor.
            await DB.insert('nao_conformidade_eventos', {
              tenant_id: tenantId,
              nc_id: ncCriada.id,
              tipo: 'notificacao_pendente_aprovacao',
              descricao: 'Aguardando aprovação para notificar o fornecedor',
              dados: null,
              criado_por: req.userId || null,
              criado_por_nome: 'Recebimento',
              visivel_fornecedor: false,
              autor_tipo: 'comprador',
            }, tenantId).catch(() => {});
          }
        }
      } catch (e) {
        console.error('❌ Erro ao registrar Não Conformidade:', e.message);
      }

      // M4: notificação automática REMOVIDA por decisão de produto.
      // A NC contra um fornecedor é uma afirmação formal com efeito
      // contratual (recusa, glosa, devolução) — precisa de aprovação
      // humana antes de sair do sistema.
      //
      // Fluxo M4.1: a NC nasce 'nao_notificado' e fica visível no portal
      // do fornecedor em modo passivo. O email oficial sai quando o
      // gestor aprovar/direcionar a NC numa etapa posterior.
      //
      // O evento de criação já é gravado com visivel_fornecedor=true
      // (ver bloco de criação da NC), então a NC aparece na lista dele
      // mesmo sem notificação ativa.

      // ✅ ATUALIZAÇÃO CORRIGIDA: Gravando nas colunas certas do seu Supabase!
      // FIX M4: padronizar pra 'nao_conforme' (esse é o valor que o
      // calcularStatusOV agora reconhece como quarentena ativa, e que
      // o resto do frontend já usa no badge "Em Tratamento de Quarentena").
      await DB.update('ordem_venda_itens', itemId, {
        status_quarentena: 'nao_conforme',
        status_contagem: 'concluido',
        motivo_divergencia: justificativa,
        observacao: justificativaCompleta,
        aprovado_por: req.userId,
        aprovado_em: new Date()
      }, tenantId);

      // Recalcula o status pai da ordem para atualizar o card na tela
      const todosItens = await DB.select('ordem_venda_itens', { ordem_venda_id: item.ordem_venda_id }, tenantId);
      const novoStatusOV = calcularStatusOV(todosItens);
      
      // Na ordens_venda a coluna atualizado_em existe e pode ser usada
      await DB.update('ordens_venda', item.ordem_venda_id, {
        status_recebimento: novoStatusOV,
        atualizado_em: new Date()
      }, tenantId);

      // FIX (2026-09): rastreabilidade de bloqueio — registra no módulo de
      // estoque que uma quantidade foi recusada/bloqueada nesta OV, sem
      // alterar saldo_atual (o material nunca chegou a entrar no disponível)
      // e sem tocar em itens_consumo.localizacao (esse campo representa o
      // item inteiro — todo o saldo já existente daquele SKU no
      // almoxarifado — não só este recebimento específico).
      const itemConsumoBloqueado = await DB.selectOne('itens_consumo', {
        catalogo_item_id: item.item_catalogo_id,
        tenant_id: tenantId
      }, tenantId);

      await DB.insert('movimentacoes_estoque', {
        tenant_id: tenantId,
        item_consumo_id: itemConsumoBloqueado?.id || null,
        tipo: 'bloqueio',
        quantidade: quantidadeFinal,
        responsavel_id: req.userId,
        observacao: justificativaCompleta,
        ordem_venda_id: item.ordem_venda_id,
        criado_em: new Date()
      }, tenantId);

      return res.json({
        ok: true,
        numero_nc: numeroNC,
        mensagem: `Material rejeitado com sucesso! Foi gerado o Registro de Não Conformidade: ${numeroNC}`
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // CAMINHO 1: APROVADO (Padrão SAP - Entrada em Doca de Recebimento)
    // ─────────────────────────────────────────────────────────────────
    // ✅ ATUALIZAÇÃO CORRIGIDA: Gravando nas colunas certas do seu Supabase!
    await DB.update('ordem_venda_itens', itemId, {
      status_quarentena: 'aprovado',
      status_contagem: 'concluido',
      aprovado_por: req.userId, // Salva o UUID de quem aprovou
      aprovado_em: new Date(),   // Salva a data exata da aprovação
      observacao: `Saldo aprovado em tratativa: ${justificativa}`
    }, tenantId);

    // Lançar o saldo físico no catálogo apontando para a doca de RECEBIMENTO
    // M4.3-ah: só busca se tem catálogo vinculado.
    const itemConsumo = item.item_catalogo_id
      ? await DB.selectOne('itens_consumo', { catalogo_item_id: item.item_catalogo_id, tenant_id: tenantId }, tenantId)
      : null;

    if (itemConsumo) {
      const novoSaldo = (parseFloat(itemConsumo.saldo_atual) || 0) + parseFloat(item.quantidade_recebida_fisica || 0);
      
      await DB.update('itens_consumo', itemConsumo.id, {
        saldo_atual: novoSaldo,
        localizacao: 'RECEBIMENTO', // Direciona para o endereço de conferência SAP
        atualizado_em: new Date()
      }, tenantId);

      // Histórico de auditoria da movimentação
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

    // Recalcula o status pai da ordem para atualizar o card na tela
    const todosItens = await DB.select('ordem_venda_itens', { ordem_venda_id: item.ordem_venda_id }, tenantId);
    const novoStatusOV = calcularStatusOV(todosItens);
    await DB.update('ordens_venda', item.ordem_venda_id, {
      status_recebimento: novoStatusOV,
      atualizado_em: new Date()
    }, tenantId);

    res.json({
      ok: true,
      mensagem: 'Saldo liberado! Material alocado temporariamente na doca de RECEBIMENTO.'
    });

  } catch (err) {
    console.error('❌ Erro ao aprovar saldo:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// VERSÃO 100% CORRIGIDA DO CÁLCULO DE STATUS NO BACKEND
function calcularStatusOV(itens) {
  if (!itens || itens.length === 0) return 'pendente';
  
  // 1. PRIORIDADE 1: Não Conformidade formal registrada. É o estado
  //    mais grave — houve recusa COM NC aberta contra o fornecedor.
  //    Diferente de 'quarentena' (que é só separação física, sem NC).
  const temNaoConformidadeFormal = itens.some(i => i.status_quarentena === 'nao_conforme');
  if (temNaoConformidadeFormal) return 'nao_conforme';

  // 2. PRIORIDADE 2: Quarentena física (item rejeitado, aguardando
  //    decisão se vira NC ou não).
  const temQuarentenaFisica = itens.some(i =>
    i.status_quarentena === 'rejeitado' || i.status_quarentena === 'quarentena'
  );
  if (temQuarentenaFisica) return 'quarentena';

  // 2. PRIORIDADE 2: Itens em processo de recontagem física ativa (1ª ou 2ª tentativa falhas)
  const temRecontagemAtiva = itens.some(i => (i.tentativa_atual || 0) > 0 && i.status_contagem !== 'concluido');
  if (temRecontagemAtiva) return 'contagem_pendente';

  // 3. PRIORIDADE 3: Etapa fiscal concluída, mas contagem física não iniciada
  const temMiro = itens.some(i => i.miro_por);
  const nenhumaContagemFeita = itens.every(i => (i.tentativa_atual || 0) === 0);
  if (temMiro && nenhumaContagemFeita) return 'aguardando_contagem';

  // 🚨 4. PRIORIDADE 4: ENCERRAMENTO DO CICLO (A Mágica da Conclusão)
  // Uma ordem está concluída se TODOS os itens dela tiverem sido finalizados na contagem.
  const todosContadosEConcluidos = itens.every(i => i.status_contagem === 'concluido');
  
  if (todosContadosEConcluidos) {
    // Se houver qualquer item rejeitado em definitivo (não conforme), a OV foi encerrada com desvio
    const temNaoConformidade = itens.some(i => i.status_quarentena === 'nao_conforme');
    if (temNaoConformidade) return 'concluido_recusado'; // 🔥 Novo status de encerramento!
    
    return 'parcial'; // Entrada realizada com sucesso (Aguardando Entrada)
  }
  
  return 'pendente'; 
}

// ─────────────────────────────────────────────────────────────────────
// GET /api/estoque/movimentacoes/nfe/:xmlId/download
//
// Download autenticado do XML da NF-e pelo COMPRADOR (tenant). Diferente
// da rota do fornecedor (que filtra por fornecedor_id), essa filtra por
// tenant — o comprador só baixa XML de OC do próprio tenant.
//
// Retorna uma signed URL do Supabase Storage (bucket privado `nfe-xmls`)
// com validade de 1h.
// ─────────────────────────────────────────────────────────────────────
router.get('/nfe/:xmlId/download', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const xmlId = parseInt(req.params.xmlId, 10);
    if (!xmlId || isNaN(xmlId)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    const xmlRow = await DB.selectOne('ordem_venda_xmls', { id: xmlId }, tenantId);
    if (!xmlRow) return res.status(404).json({ erro: 'XML não encontrado' });
    if (String(xmlRow.tenant_id) !== String(tenantId)) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }
    if (!xmlRow.storage_path) {
      return res.status(404).json({ erro: 'XML sem arquivo no storage.' });
    }

    const { supabase } = require('../../db');
    const { data: signed, error: signErr } = await supabase.storage
      .from('nfe-xmls')
      .createSignedUrl(xmlRow.storage_path, 60 * 60); // 1h

    if (signErr || !signed?.signedUrl) {
      return res.status(500).json({ erro: `Falha ao gerar link: ${signErr?.message || 'sem URL'}` });
    }

    return res.json({
      url: signed.signedUrl,
      expira_em_segundos: 3600,
      numero_nf: xmlRow.numero_nf,
      chave_acesso: xmlRow.chave_acesso,
    });
  } catch (err) {
    console.error('❌ Erro em download XML (comprador):', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────
// PUT /api/estoque/movimentacoes/item/:itemId/forcar-quarentena
//
// Coloca um item em quarentena direto (sem passar por contagem cega).
// Usado pelo botão "⚠️ Quarentena" no modal de contagem — o comprador
// já sabe que o item está com problema e não quer esperar as 3
// tentativas.
//
// Diferente do /aprovar-saldo com 'nao_conformidade': NÃO cria NC
// formal. O item fica bloqueado esperando tratativa posterior (o
// comprador decide depois se vira NC, devolução, descarte etc.).
//
// Body: { motivo }
// ─────────────────────────────────────────────────────────────────────
router.put('/item/:itemId/forcar-quarentena', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { itemId } = req.params;
    const { motivo } = req.body;

    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ erro: 'motivo é obrigatório' });
    }

    const item = await DB.selectOne('ordem_venda_itens', { id: itemId, tenant_id: tenantId }, tenantId);
    if (!item) return res.status(404).json({ erro: 'Item não encontrado' });

    const justificativaCompleta = `Quarentena: ${motivo.trim()}`;

    await DB.update('ordem_venda_itens', itemId, {
      // FIX M4: quarentena física NÃO é NC. Fica 'rejeitado' até o
      // comprador decidir (no botão "⚖️ Tratar Quarentena" da tela
      // principal) se vira NC formal, devolução, descarte etc.
      status_quarentena: 'rejeitado',
      status_contagem: 'concluido',
      motivo_divergencia: motivo.trim(),
      observacao: justificativaCompleta,
      aprovado_por: req.userId,
      aprovado_em: new Date(),
    }, tenantId);

    // Recalcula status geral da OV
    const itensOV = await DB.select('ordem_venda_itens', { ordem_venda_id: item.ordem_venda_id, tenant_id: tenantId }, tenantId);
    const novoStatus = calcularStatusOV(itensOV);
    await DB.update('ordens_venda', item.ordem_venda_id, {
      status_recebimento: novoStatus,
      atualizado_em: new Date(),
    }, tenantId);

    res.json({ ok: true, mensagem: 'Item enviado para quarentena' });
  } catch (err) {
    console.error('❌ Erro ao forçar quarentena:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;