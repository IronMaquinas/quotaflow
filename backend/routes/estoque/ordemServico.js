// routes/estoque/ordemServico.js
const express = require('express');
const router = express.Router();
const { DB } = require('../../db');
const tenantMiddleware = require('../../middleware/tenantMiddleware');

// ─── HELPERS: GERAR NÚMEROS SEQUENCIAIS ──────────────────────

async function gerarNumeroOS(tenantId) {
  const ano = new Date().getFullYear();
  const prefix = `OS-${ano}-`;
  
  const result = await DB.raw(`
    SELECT numero FROM ordens_servico 
    WHERE tenant_id = $1 AND numero LIKE $2
    ORDER BY numero DESC
    LIMIT 1
  `, [tenantId, `${prefix}%`]);

  let seq = 1;
  if (result.length > 0 && result[0].numero) {
    const match = result[0].numero.match(/(\d+)$/);
    if (match) seq = parseInt(match[1]) + 1;
  }
  
  // Verificar duplicados
  let novoNumero = `${prefix}${String(seq).padStart(4, '0')}`;
  let existe = await DB.selectOne('ordens_servico', { numero: novoNumero, tenant_id: tenantId }, tenantId);
  if (existe) {
    let tentativas = 0;
    while (existe && tentativas < 100) {
      seq++;
      novoNumero = `${prefix}${String(seq).padStart(4, '0')}`;
      existe = await DB.selectOne('ordens_servico', { numero: novoNumero, tenant_id: tenantId }, tenantId);
      tentativas++;
    }
  }

  return novoNumero;
}

async function gerarNumeroRetirada(tenantId) {
  const ano = new Date().getFullYear();
  const prefix = `RET-${ano}-`;

  const result = await DB.raw(`
    SELECT numero_solicitacao FROM solicitacoes_retirada
    WHERE tenant_id = $1 AND numero_solicitacao LIKE $2
    ORDER BY numero_solicitacao DESC
    LIMIT 1
  `, [tenantId, `${prefix}%`]);

  let seq = 1;
  if (result.length > 0 && result[0].numero_solicitacao) {
    const match = result[0].numero_solicitacao.match(/(\d+)$/);
    if (match) seq = parseInt(match[1]) + 1;
  }

  let novoNumero = `${prefix}${String(seq).padStart(4, '0')}`;
  let existe = await DB.selectOne('solicitacoes_retirada', { numero_solicitacao: novoNumero, tenant_id: tenantId }, tenantId);
  if (existe) {
    let tentativas = 0;
    while (existe && tentativas < 100) {
      seq++;
      novoNumero = `${prefix}${String(seq).padStart(4, '0')}`;
      existe = await DB.selectOne('solicitacoes_retirada', { numero_solicitacao: novoNumero, tenant_id: tenantId }, tenantId);
      tentativas++;
    }
  }

  return novoNumero;
}

async function gerarNumeroChamado(tenantId) {
  const ano = new Date().getFullYear();
  const prefix = `CHAM-${ano}-`;

  const result = await DB.raw(`
    SELECT numero FROM chamados
    WHERE tenant_id = $1 AND numero LIKE $2
    ORDER BY numero DESC
    LIMIT 1
  `, [tenantId, `${prefix}%`]);

  let seq = 1;
  if (result.length > 0 && result[0].numero) {
    const match = result[0].numero.match(/(\d+)$/);
    if (match) seq = parseInt(match[1]) + 1;
  }

  let novoNumero = `${prefix}${String(seq).padStart(4, '0')}`;
  let existe = await DB.selectOne('chamados', { numero: novoNumero, tenant_id: tenantId }, tenantId);
  if (existe) {
    let tentativas = 0;
    while (existe && tentativas < 100) {
      seq++;
      novoNumero = `${prefix}${String(seq).padStart(4, '0')}`;
      existe = await DB.selectOne('chamados', { numero: novoNumero, tenant_id: tenantId }, tenantId);
      tentativas++;
    }
  }

  return novoNumero;
}

// ─── ROTAS ─────────────────────────────────────────────────

// POST /api/estoque/ordem-servico - Criar OS
router.post('/', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { 
      equipamento_id, 
      tecnico_id, 
      tecnico_nome, 
      descricao, 
      itens, 
      tipo_manutencao,
      criado_por_id,
      criado_por_nome,
      // 🔥 ADICIONE AQUI:
      servico_nome,
      urgencia
    } = req.body;

    if (!itens || itens.length === 0) {
      return res.status(400).json({ erro: 'Itens da OS são obrigatórios' });
    }

    const numero = await gerarNumeroOS(tenantId);

    const os = await DB.insert('ordens_servico', {
      tenant_id: tenantId,
      numero,
      equipamento_id: equipamento_id || null,
      tecnico_id: tecnico_id || null,
      tecnico_nome: tecnico_nome || '',
      descricao: descricao || '',
      servico_nome: servico_nome || '', // ✅ Agora está definida!
      urgencia: urgencia || 'media', // ✅ Agora está definida!
      tipo_manutencao: tipo_manutencao || 'corretiva',
      criado_por_id: criado_por_id || null,
      criado_por_nome: criado_por_nome || '',
      status: 'aberta',
      inicio: new Date(),
      criado_em: new Date()
    }, tenantId);

    // Inserir itens com vínculo ao catálogo
    for (const item of itens) {
      await DB.insert('ordem_servico_itens', {
        tenant_id: tenantId,
        ordem_servico_id: os.id,
        item_nome: item.item_nome,
        item_catalogo_id: item.item_catalogo_id || null,
        sku: item.sku || null,
        quantidade: item.quantidade || 1,
        unidade_medida: item.unidade_medida || 'UN',
        tipo_item: item.tipo_item || 'consumivel',
        status: 'pendente',
        criado_em: new Date()
      }, tenantId);
    }

    res.status(201).json({
      ok: true,
      id: os.id,
      numero,
      mensagem: `Ordem de Serviço ${numero} criada com sucesso`
    });
  } catch (err) {
    console.error('❌ Erro ao criar OS:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/estoque/ordem-servico - Listar OS
router.get('/', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    // 1. Buscar as OS (sem LEFT JOIN)
    const ordens = await DB.raw(`
      SELECT os.*
      FROM ordens_servico os
      WHERE os.tenant_id = $1
      ORDER BY os.criado_em DESC
    `, [tenantId]);

    // 2. Buscar equipamentos separadamente (para adicionar nome e tag)
    const equipamentoIds = ordens.map(os => os.equipamento_id).filter(Boolean);
    const equipamentos = equipamentoIds.length > 0
      ? await DB.raw(`
          SELECT id, nome, tag
          FROM equipamentos
          WHERE id = ANY($1) AND tenant_id = $2
        `, [equipamentoIds, tenantId])
      : [];

    // Agrupar equipamentos por ID
    const equipamentosPorID = {};
    equipamentos.forEach(eq => {
      equipamentosPorID[eq.id] = eq;
    });

    // 3. Buscar itens de todas as OS
    const osIds = ordens.map(os => os.id);
    let itens = [];
    if (osIds.length > 0) {
      itens = await DB.raw(`
        SELECT * FROM ordem_servico_itens 
        WHERE tenant_id = $1 AND ordem_servico_id = ANY($2)
        ORDER BY id
      `, [tenantId, osIds]);
    }

    // Agrupar itens por OS
    const itensPorOS = {};
    itens.forEach(item => {
      if (!itensPorOS[item.ordem_servico_id]) {
        itensPorOS[item.ordem_servico_id] = [];
      }
      itensPorOS[item.ordem_servico_id].push(item);
    });

    // 4. Adicionar equipamento_nome e equipamento_tag nos objetos
    const resultado = ordens.map(os => ({
      ...os,
      equipamento_nome: equipamentosPorID[os.equipamento_id]?.nome || '—',
      equipamento_tag: equipamentosPorID[os.equipamento_id]?.tag || '—',
      itens: itensPorOS[os.id] || []
    }));

    res.json(resultado);
  } catch (err) {
    console.error('❌ Erro ao listar OS:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/estoque/ordem-servico/:id/gerar-retirada
router.post('/:id/gerar-retirada', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    
    // 1. Buscar OS e seus itens
    const os = await DB.selectOne('ordens_servico', { id }, tenantId);
    if (!os) {
      return res.status(404).json({ erro: 'OS não encontrada' });
    }

    const itens = await DB.select('ordem_servico_itens', { ordem_servico_id: id, tipo_item: 'consumivel' }, tenantId);
    if (itens.length === 0) {
      return res.status(400).json({ erro: 'Nenhum consumível encontrado nesta OS' });
    }

    // 2. Gerar número sequencial
    const numeroRetirada = await gerarNumeroRetirada(tenantId);

    // 3. Criar a solicitação de retirada (como uma "solicitação mãe")
    const retirada = await DB.insert('solicitacoes_retirada', {
      tenant_id: tenantId,
      numero_solicitacao: numeroRetirada,
      origem_os_id: os.id,
      origem_os_numero: os.numero,
      status: 'pendente',
      // 🔥 Preenche todas os campos obrigatórios
      solicitante_id: os.tecnico_id || os.criado_por_id || null,
      item_consumo_id: itens[0].item_catalogo_id || null, // 🔥 Usa o primeiro item
      quantidade: itens.reduce((sum, item) => sum + (item.quantidade || 1), 0),
      motivo: `Retirada gerada pela OS ${os.numero}`,
      criado_em: new Date().toISOString().split('T')[0]
    }, tenantId);

    // 4. Inserir os itens da retirada
    for (const item of itens) {
      await DB.insert('solicitacao_retirada_itens', {
        tenant_id: tenantId,
        solicitacao_retirada_id: retirada.id,
        item_consumo_id: item.item_catalogo_id || null,
        item_nome: item.item_nome,
        quantidade: item.quantidade || 1,
        unidade_medida: item.unidade_medida || 'UN',
        origem_os_item_id: item.id,
        criado_em: new Date()
      }, tenantId);
    }

    res.status(201).json({
      ok: true,
      retirada_id: retirada.id,
      numero: numeroRetirada,
      quantidade_itens: itens.length,
      mensagem: `Retirada ${numeroRetirada} gerada com ${itens.length} itens`
    });
  } catch (err) {
    console.error('❌ Erro ao gerar retirada:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/estoque/ordem-servico/:id/gerar-chamado
router.post('/:id/gerar-chamado', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    // 1. Buscar OS e seus itens
    const os = await DB.selectOne('ordens_servico', { id }, tenantId);
    if (!os) {
      return res.status(404).json({ erro: 'OS não encontrada' });
    }

    const itens = await DB.select('ordem_servico_itens', { ordem_servico_id: id, tipo_item: 'compra' }, tenantId);
    if (itens.length === 0) {
      return res.status(400).json({ erro: 'Nenhum item de compra encontrado nesta OS' });
    }

    // 2. Gerar número sequencial de chamado
    const numeroChamado = await gerarNumeroChamado(tenantId);

    // 3. Criar o chamado
    const chamado = await DB.insert('chamados', {
      tenant_id: tenantId,
      numero: numeroChamado,
      origem_os_id: os.id,
      origem_os_numero: os.numero,
      servico_nome: os.servico_nome || os.descricao || 'Manutenção',
      urgencia: os.urgencia || 'media',
      categoria: os.tipo_manutencao || 'corretiva',
      equipamento_id: os.equipamento_id || null,
      status: 'aguardando_cotacao',
      tecnico_nome: os.tecnico_nome,
      aberto_em: new Date().toISOString()
    }, tenantId);

    // 4. Inserir os itens do chamado
    for (const item of itens) {
      await DB.insert('chamado_itens', {
        tenant_id: tenantId,
        chamado_id: chamado.id,
        item_nome: item.item_nome,
        quantidade: item.quantidade || 1,
        unidade_medida: item.unidade_medida || 'UN',
        origem_os_item_id: item.id,
        criado_em: new Date()
      }, tenantId);
    }

    res.status(201).json({
      ok: true,
      chamado_id: chamado.id,
      numero: numeroChamado,
      quantidade_itens: itens.length,
      mensagem: `Chamado ${numeroChamado} gerado com ${itens.length} itens`
    });
  } catch (err) {
    console.error('❌ Erro ao gerar chamado:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;