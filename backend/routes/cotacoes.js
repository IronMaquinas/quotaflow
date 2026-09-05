// routes/cotacoes.js
const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const { DB } = require("../db");
const tenantMiddleware = require("../middleware/tenantMiddleware");
const { enviarEmailCotacao, enviarEmailResultado } = require("../services/emailService");
const CotacaoService = require('../services/CotacaoService');
const cotacaoService = new CotacaoService(DB);

// ─── HELPERS ───────────────────────────────────────────────

async function gerarNumeroChamado(tenant_id) {
  const ano = new Date().getFullYear();
  const prefix = `CHAM-${ano}-`;

  // Buscar o maior número usando id DESC
  const result = await DB.raw(`
    SELECT numero FROM chamados 
    WHERE tenant_id = $1 AND numero LIKE $2
    ORDER BY id DESC
    LIMIT 1
  `, [tenant_id, `${prefix}%`]);

  let seq = 1;
  if (result.length > 0 && result[0].numero) {
    const match = result[0].numero.match(/(\d+)$/);
    if (match) {
      seq = parseInt(match[1]) + 1;
    }
  }

  let novoNumero = `${prefix}${String(seq).padStart(4, "0")}`;
  
  // Verificar se existe usando selectOne (mais confiável)
  let existe = await DB.selectOne("chamados", { numero: novoNumero }, tenant_id);
  if (existe) {
    // Se existir, incrementa até achar um livre (mas limitado a 100 tentativas)
    let tentativas = 0;
    while (existe && tentativas < 100) {
      seq++;
      novoNumero = `${prefix}${String(seq).padStart(4, "0")}`;
      existe = await DB.selectOne("chamados", { numero: novoNumero }, tenant_id);
      tentativas++;
    }
  }

  return novoNumero;
}

async function gerarNumeroCotacao(tenant_id) {
  const ano = new Date().getFullYear();
  const prefix = `COT-${ano}-`;

  const result = await DB.raw(`
    SELECT numero FROM cotacoes 
    WHERE tenant_id = $1 AND numero LIKE $2
    ORDER BY numero DESC
    LIMIT 1
  `, [tenant_id, `${prefix}%`]);

  let seq = 1;
  if (result.length > 0 && result[0].numero) {
    const match = result[0].numero.match(/(\d+)$/);
    if (match) {
      seq = parseInt(match[1]) + 1;
    }
  }

  let novoNumero = `${prefix}${String(seq).padStart(4, "0")}`;
  let existe = true;
  let tentativas = 0;
  while (existe && tentativas < 100) {
    const check = await DB.raw(`
      SELECT id FROM cotacoes WHERE tenant_id = $1 AND numero = $2
    `, [tenant_id, novoNumero]);
    if (check.length === 0) {
      existe = false;
    } else {
      seq++;
      novoNumero = `${prefix}${String(seq).padStart(4, "0")}`;
      tentativas++;
    }
  }

  return novoNumero;
}

// ─── ROTAS ─────────────────────────────────────────────────

// GET /api/cotacoes/chamados
router.get("/chamados", tenantMiddleware, async (req, res) => {
  try {
        console.log('🔍 Chamados da API:');

    const origem_os_id = req.query.origem_os_id;

    // 1. Buscar chamados
    const chamados = await DB.select('chamados', { tenant_id: req.tenantId }, req.tenantId);
    console.log('🔍 CHAMADOS RETORNADOS:', chamados);

    // 2. Buscar equipamentos separadamente (para adicionar nome e tag)
    const chamadoIds = chamados.map(ch => ch.id);
    const equipamentoIds = chamados.map(ch => ch.equipamento_id).filter(Boolean);

    let equipamentos = [];
    if (equipamentoIds.length > 0) {
      equipamentos = await DB.raw(`
        SELECT id, nome, tag
        FROM equipamentos
        WHERE id = ANY($1) AND tenant_id = $2
      `, [equipamentoIds, req.tenantId]);
    }

    // Agrupar equipamentos por ID
    const equipamentosPorID = {};
    equipamentos.forEach(eq => {
      equipamentosPorID[eq.id] = eq;
    });

    // 3. Buscar itens de todos os chamados
    let itens = [];
    if (chamadoIds.length > 0) {
      itens = await DB.raw(`
        SELECT chamado_id, id, item_nome, codigo, quantidade, urgencia, categoria, tipo_item, descricao
        FROM chamado_itens
        WHERE chamado_id = ANY($1) AND tenant_id = $2
        ORDER BY chamado_id, id
      `, [chamadoIds, req.tenantId]);
    }

    // Agrupar itens por chamado
    const itensPorChamado = {};
    itens.forEach(item => {
      if (!itensPorChamado[item.chamado_id]) {
        itensPorChamado[item.chamado_id] = [];
      }
      itensPorChamado[item.chamado_id].push(item);
    });

    // 4. Adicionar equipamento_nome e equipamento_tag
    const resultado = chamados.map(ch => ({
      ...ch,
      equipamento_nome: equipamentosPorID[ch.equipamento_id]?.nome || '—',
      equipamento_tag: equipamentosPorID[ch.equipamento_id]?.tag || '—',
      origem_os_numero: ch.origem_os_numero || null,
      itens: itensPorChamado[ch.id] || []
    }));

    res.json(resultado);
  } catch (err) {
    console.error("❌ Erro listar chamados:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/cotacoes/chamados
router.post("/chamados", tenantMiddleware, async (req, res) => {
  try {
    const { equipamento_id, tecnico_nome, descricao_geral, itens, servico_nome, urgencia, categoria } = req.body;

    let itensArray = itens;
    if (!itensArray || itensArray.length === 0) {
      const { peca, codigo, urgencia, categoria, tipo_item, descricao } = req.body;
      if (!peca) {
        return res.status(400).json({ erro: "É necessário pelo menos um item ou peça" });
      }
      itensArray = [{
        item_nome: peca,
        codigo: codigo || "",
        urgencia: urgencia || "media",
        categoria: categoria || "corretiva",
        tipo_item: tipo_item || "",
        descricao: descricao || "",
        quantidade: 1
      }];
    }

    if (!itensArray || itensArray.length === 0) {
      return res.status(400).json({ erro: "Nenhum item informado" });
    }

    for (const item of itensArray) {
      if (!item.item_nome) {
        return res.status(400).json({ erro: "Todos os itens devem ter nome" });
      }
    }

    const numero = await gerarNumeroChamado(req.tenantId);

    const chamadoData = {
      numero,
      equipamento_id: equipamento_id || null,
      tecnico_id: req.userId,
      tecnico_nome: tecnico_nome || req.userEmail || req.userId,
      descricao: descricao_geral || "",
      servico_nome: servico_nome || descricao_geral || "Manutenção",
      urgencia: urgencia || "media",
      categoria: categoria || "corretiva",
      status: "aguardando_cotacao",
      origem_os_numero: servico_nome || "Manutenção",
      participa_benchmark: 1
    };

    const chamado = await DB.insert("chamados", chamadoData, req.tenantId);

    const itensInseridos = [];
    for (const item of itensArray) {
      const itemData = {
        chamado_id: chamado.id,
        tenant_id: req.tenantId,
        item_nome: item.item_nome,
        codigo: item.codigo || "",
        quantidade: item.quantidade || 1,
        urgencia: item.urgencia || "media",
        categoria: item.categoria || null,
        tipo_item: item.tipo_item || null,
        descricao: item.descricao || "",
        item_catalogo_id: item.item_catalogo_id || null
      };
      const novoItem = await DB.insert("chamado_itens", itemData, req.tenantId);
      itensInseridos.push(novoItem);
    }

    res.status(201).json({
      id: chamado.id,
      numero: chamado.numero,
      status: chamado.status,
      itens: itensInseridos,
      mensagem: `Chamado criado com ${itensInseridos.length} item(ns)`
    });

  } catch (err) {
    console.error("❌ Erro criar chamado:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/cotacoes
router.get("/", tenantMiddleware, async (req, res) => {
  try {
    // 1. Buscar cotações
    const cotacoes = await DB.select('cotacoes', { tenant_id: req.tenantId }, req.tenantId);

    // 2. Buscar chamados separadamente
    const chamadoIds = cotacoes.map(c => c.chamado_id).filter(Boolean);
    let chamados = [];
    if (chamadoIds.length > 0) {
      chamados = await DB.raw(`
        SELECT id, numero, peca, categoria_item, servico_nome, urgencia, descricao, status as chamado_status
        FROM chamados
        WHERE id = ANY($1) AND tenant_id = $2
      `, [chamadoIds, req.tenantId]);
    }

    // Agrupar chamados por ID
    const chamadosPorID = {};
    chamados.forEach(ch => {
      chamadosPorID[ch.id] = ch;
    });

    // 3. Buscar fornecedores de todas as cotações
    const cotacaoIds = cotacoes.map(c => c.id);
    let fornecedores = [];
    if (cotacaoIds.length > 0) {
      fornecedores = await DB.raw(`
        SELECT 
          id, cotacao_id, fornecedor_nome, fornecedor_email, status, 
          valor, prazo, frete, valor_frete, obs, data_resposta
        FROM cotacao_fornecedores
        WHERE cotacao_id = ANY($1) AND tenant_id = $2
        ORDER BY data_resposta DESC NULLS LAST
      `, [cotacaoIds, req.tenantId]);
    }

    // Agrupar fornecedores por cotação
    const fornecedoresPorCotacao = {};
    fornecedores.forEach(f => {
      if (!fornecedoresPorCotacao[f.cotacao_id]) {
        fornecedoresPorCotacao[f.cotacao_id] = [];
      }
      fornecedoresPorCotacao[f.cotacao_id].push(f);
    });

    // 4. Montar resultado
    const resultado = cotacoes.map(c => ({
      ...c,
      chamado_numero: chamadosPorID[c.chamado_id]?.numero || null,
      chamado_peca: chamadosPorID[c.chamado_id]?.peca || null,
      chamado_servico_nome: chamadosPorID[c.chamado_id]?.servico_nome || null,
      chamado_urgencia: chamadosPorID[c.chamado_id]?.urgencia || null,
      chamado_categoria: chamadosPorID[c.chamado_id]?.categoria_item || null,
      chamado_status: chamadosPorID[c.chamado_id]?.chamado_status || null,
      fornecedores: fornecedoresPorCotacao[c.id] || []
    }));

    res.json(resultado);
  } catch (err) {
    console.error("❌ Erro listar cotações:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/cotacoes
router.post("/", tenantMiddleware, async (req, res) => {
  try {
    const { chamado_id, fornecedores, origem_ov_numero } = req.body;

    if (!chamado_id || !fornecedores || fornecedores.length === 0) {
      return res.status(400).json({ erro: "chamado_id e lista de fornecedores são obrigatórios" });
    }

    const chamado = await DB.selectOne("chamados", { id: chamado_id }, req.tenantId);
    if (!chamado) {
      return res.status(404).json({ erro: "Chamado não encontrado" });
    }

    const numero = await gerarNumeroCotacao(req.tenantId);

    const origem = origem_ov_numero || chamado?.origem_os_numero || chamado?.servico_nome || "Manutenção";

    const cotacao = await DB.insert("cotacoes", {
      chamado_id,
      numero,
      status: "em_curso",
      origem_ov_numero: origem
    }, req.tenantId);

    const linhas = [];
    for (const f of fornecedores) {
      const token = crypto.randomBytes(16).toString("hex");
      const cotacaoForn = await DB.insert("cotacao_fornecedores", {
        cotacao_id: cotacao.id,
        fornecedor_id: f.id || null,
        fornecedor_nome: f.nome,
        fornecedor_email: f.email,
        token,
        status: "pendente"
      }, req.tenantId);
      linhas.push({
        id: cotacaoForn.id,
        fornecedor_nome: f.nome,
        fornecedor_email: f.email,
        token,
        status: "pendente"
      });

      await enviarEmailCotacao(chamado, f, token, process.env.FRONTEND_URL).catch(e => console.error(e.message));
    }

    await DB.update("chamados", chamado_id, { status: "cotando" }, req.tenantId);

    res.status(201).json({
      id: cotacao.id,
      numero: cotacao.numero,
      chamado_id,
      status: "em_curso",
      fornecedores: linhas,
      mensagem: `Cotação ${cotacao.numero} enviada para ${linhas.length} fornecedores`
    });

  } catch (err) {
    console.error("❌ Erro criar cotação:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/cotacoes/:id - Buscar cotação completa por ID
router.get('/:id', tenantMiddleware, async (req, res) => {
  try {
    const service = new CotacaoService(DB);
    const cotacao = await service.obterCotacao(req.tenantId, req.params.id);
    res.json({ ok: true, ...cotacao });
  } catch (err) {
    console.error('❌ Erro ao buscar cotação:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// PUT /api/cotacoes/:id/finalizar
router.put("/:id/finalizar", tenantMiddleware, async (req, res) => {
  try {
    const { fornecedor_id, valor_negociado } = req.body;

    if (!fornecedor_id) {
      return res.status(400).json({ erro: "fornecedor_id é obrigatório" });
    }

    const cotacao = await DB.selectOne("cotacoes", { id: req.params.id }, req.tenantId);
    if (!cotacao) {
      return res.status(404).json({ erro: "Cotação não encontrada" });
    }

    const vencedor = await DB.selectOne("cotacao_fornecedores", { id: fornecedor_id }, req.tenantId);
    if (!vencedor) {
      return res.status(404).json({ erro: "Fornecedor não encontrado" });
    }

    const chamado = await DB.selectOne("chamados", { id: cotacao.chamado_id }, req.tenantId);
    const valorFinal = valor_negociado || vencedor.valor || 0;
    const custoTotal = valorFinal + (vencedor.valor_frete || 0);

    await DB.update("cotacoes", req.params.id, { status: "finalizado", finalizado_em: new Date().toISOString() }, req.tenantId);
    await DB.update("chamados", chamado.id, {
      status: "finalizado",
      valor_aprovado: vencedor.valor,
      valor_negociado: valorFinal,
      custo_total_real: custoTotal,
      fornecedor_aprovado: vencedor.fornecedor_nome,
      aprovado_por: req.userEmail,
      aprovado_por_id: req.userId,
      finalizado_em: new Date().toISOString()
    }, req.tenantId);

    const todos = await DB.raw(`SELECT * FROM cotacao_fornecedores WHERE cotacao_id = $1 AND tenant_id = $2`, [req.params.id, req.tenantId]);
    for (const f of todos) {
      const ganhou = f.id === fornecedor_id;
      await enviarEmailResultado(chamado, f, ganhou).catch(e => console.error(e.message));
    }

    res.json({
      ok: true,
      cotacao_id: cotacao.id,
      chamado_id: chamado.id,
      fornecedor_vencedor: vencedor.fornecedor_nome,
      valor_final: valorFinal,
      custo_total: custoTotal,
      mensagem: "Cotação finalizada e fornecedor notificado"
    });

  } catch (err) {
    console.error("❌ Erro finalizar cotação:", err.message);
    res.status(500).json({ erro: err.message });
  }
});


// DELETE /api/cotacoes/chamados/:id - Deletar chamado
router.delete("/chamados/:id", tenantMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o chamado existe e pertence ao tenant
    const chamado = await DB.selectOne("chamados", { id }, req.tenantId);
    if (!chamado) {
      return res.status(404).json({ erro: "Chamado não encontrado" });
    }

    // Deletar chamado (os itens serão deletados em cascata via ON DELETE CASCADE)
    await DB.delete("chamados", id, req.tenantId);

    res.json({
      ok: true,
      mensagem: `Chamado ${chamado.numero} deletado com sucesso`
    });
  } catch (err) {
    console.error("❌ Erro ao deletar chamado:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// PUT /api/cotacoes/chamados/:id - Atualizar chamado
router.put("/chamados/:id", tenantMiddleware, async (req, res) => {
  
  try {
    const { id } = req.params;
    const { equipamento_id, descricao_geral, servico_nome, itens } = req.body;
    const tenantId = req.tenantId;
 
    // Validação crítica
    if (!Array.isArray(itens)) {
      console.error('❌ ERRO CRÍTICO: itens não é um array!', typeof itens);
      return res.status(400).json({ 
        erro: "itens deve ser um array",
        recebido: typeof itens,
        valor: itens 
      });
    }
 
    // Verifica se o chamado existe
    const chamado = await DB.selectOne("chamados", { id, tenant_id: tenantId }, tenantId);
    if (!chamado) {
      console.error('❌ Chamado não encontrado:', id);
      return res.status(404).json({ erro: "Chamado não encontrado" });
    }
 
    // Atualiza dados do chamado
    const updateData = {};
    if (equipamento_id !== undefined) updateData.equipamento_id = equipamento_id;
    if (descricao_geral !== undefined) updateData.descricao = descricao_geral;
    if (servico_nome !== undefined) updateData.servico_nome = servico_nome;
    updateData.atualizado_em = new Date().toISOString();
 
    await DB.update("chamados", id, updateData, tenantId);
 
    const itensAntigos = await DB.select("chamado_itens", { chamado_id: id }, tenantId);
    const totalAntigos = itensAntigos?.length || 0;

    // Segundo: DELETAR cada item
    if (totalAntigos > 0) {
      for (const item of itensAntigos) {
        await DB.delete("chamado_itens", item.id, tenantId);
      }
    } else {
      console.log("⚠️ Nenhum item antigo encontrado para deletar");
    }

    // Terceiro: VERIFICAR que deletou
    const verificacaoDelete = await DB.select("chamado_itens", { chamado_id: id }, tenantId);
    const itensRestantes = verificacaoDelete?.length || 0;

    if (itensRestantes > 0) {
      console.error(`❌ AVISO: DELETE não funcionou completamente! Sobraram ${itensRestantes} itens`);
    } else {
      console.log('✅ DELETE completado com sucesso!');
    }
 
    // Inserir novos itens
    const itensInseridos = [];
    if (itens.length > 0) {
      
      for (const item of itens) {
        const itemData = {
          chamado_id: id,
          tenant_id: tenantId,
          item_nome: item.item_nome,
          codigo: item.codigo || "",
          quantidade: item.quantidade || 1,
          urgencia: item.urgencia || "media",
          categoria: item.categoria || null,
          tipo_item: item.tipo_item || null,
          descricao: item.descricao || "",
          item_catalogo_id: item.item_catalogo_id || null      
        };
        
        const novoItem = await DB.insert("chamado_itens", itemData, tenantId);
        itensInseridos.push(novoItem);
      }
    } else {
      console.log("⚠️ Nenhum item enviado, todos removidos");
    }
 
    // Buscar chamado atualizado e seus itens
    const chamadoAtualizado = await DB.selectOne("chamados", { id }, tenantId);
    
    const itensAtualizados = await DB.raw(
      `SELECT * FROM chamado_itens WHERE chamado_id = $1 AND tenant_id = $2 ORDER BY id ASC`,
      [id, tenantId]
    );
 
    // ⚠️ VALIDAÇÃO FINAL
    if ((itensAtualizados?.length || 0) !== itens.length) {
      console.error(`❌ ERRO: Esperava ${itens.length} itens, mas ficou com ${itensAtualizados?.length || 0}`);
    } else {
      console.log('✅ ✅ ✅ PUT /chamados/:id CONCLUÍDO COM SUCESSO');
    }
 
    res.json({ 
      ok: true,
      ...chamadoAtualizado, 
      itens: itensAtualizados || [],
      itensInseridos: itensInseridos.length,
      itensEsperados: itens.length,
      itensFinais: itensAtualizados?.length || 0,
      mensagem: `Chamado atualizado com ${itensAtualizados.length} item(ns)`
    });
    
  } catch (err) {
    console.error("❌ ERRO CRÍTICO ao atualizar chamado:", err.message);
    console.error("❌ Stack trace:", err.stack);
    res.status(500).json({ 
      erro: err.message, 
      stack: err.stack,
      detalhe: "Erro ao processar atualização"
    });
  }
});

// POST /api/cotacoes/gerar-automaticamente
router.post('/gerar-automaticamente', tenantMiddleware, async (req, res) => {
  try {
    const { chamado_id } = req.body;
    
    // 🔥 PREENCHER A ORIGEM
    const chamado = await DB.selectOne('chamados', { id: chamado_id }, req.tenantId);
    const origem_ov_numero = chamado?.origem_os_numero || null;
    
    const cotacoes = await cotacaoService.gerarCotacoesPorCategoria(
      req.tenantId,
      chamado_id,
      req.userId,
      origem_ov_numero
    );
    
    res.status(201).json({
      ok: true,
      cotacoes: cotacoes,
      total: cotacoes.length,
      mensagem: `${cotacoes.length} cotação(ões) criada(s) automaticamente`
    });
  } catch (err) {
    console.error('❌ Erro ao gerar cotações:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// 1. BUSCAR ITENS SIMILARES (Para autocomplete)
// ───────────────────────────────────────────────────────────────────────
router.post('/buscar-similares', tenantMiddleware, async (req, res) => {
  try {
    const { termo, limite = 5 } = req.body;

    if (!termo || termo.trim().length < 2) {
      return res.status(400).json({ erro: 'Termo deve ter pelo menos 2 caracteres' });
    }

    const similares = await cotacaoService.buscarSimilares(
      req.tenantId,
      termo,
      limite
    );

    res.json({
      ok: true,
      similares: similares,
      total: similares.length
    });
  } catch (err) {
    console.error('❌ Erro em buscar-similares:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// 2. CRIAR COTAÇÃO AUTOMÁTICA
// ───────────────────────────────────────────────────────────────────────
router.post('/criar-automatica', tenantMiddleware, async (req, res) => {
  try {
    const { chamadoId, itemCatalogoId } = req.body;

    if (!chamadoId || !itemCatalogoId) {
      return res.status(400).json({ erro: 'chamadoId e itemCatalogoId são obrigatórios' });
    }

    const cotacao = await cotacaoService.criarAutomatica(
      req.tenantId,
      chamadoId,
      itemCatalogoId,
      req.usuarioId
    );

    res.json({
      ok: true,
      cotacao: cotacao
    });
  } catch (err) {
    console.error('❌ Erro em criar-automatica:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// 3. ADICIONAR ITEM À COTAÇÃO
// ───────────────────────────────────────────────────────────────────────
router.post('/:cotacaoId/items', tenantMiddleware, async (req, res) => {
  try {
    const { cotacaoId } = req.params;
    const { itemCatalogoId, quantidade = 1 } = req.body;

    if (!itemCatalogoId) {
      return res.status(400).json({ erro: 'itemCatalogoId é obrigatório' });
    }

    const item = await cotacaoService.adicionarItem(
      req.tenantId,
      cotacaoId,
      itemCatalogoId,
      quantidade
    );

    res.json({
      ok: true,
      item: item
    });
  } catch (err) {
    console.error('❌ Erro em adicionar item:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// 4. REMOVER ITEM DA COTAÇÃO
// ───────────────────────────────────────────────────────────────────────
router.delete('/:cotacaoId/items/:itemId', tenantMiddleware, async (req, res) => {
  try {
    const { cotacaoId, itemId } = req.params;

    const resultado = await cotacaoService.removerItem(
      req.tenantId,
      cotacaoId,
      itemId
    );

    res.json({
      ok: true,
      resultado: resultado
    });
  } catch (err) {
    console.error('❌ Erro em remover item:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// 5. CONFIRMAR COTAÇÃO (Sai de rascunho)
// ───────────────────────────────────────────────────────────────────────
router.put('/:cotacaoId/confirmar', tenantMiddleware, async (req, res) => {
  try {
    const { cotacaoId } = req.params;

    const resultado = await cotacaoService.confirmarCotacao(
      req.tenantId,
      cotacaoId,
      req.usuarioId
    );

    res.json({
      ok: true,
      resultado: resultado
    });
  } catch (err) {
    console.error('❌ Erro em confirmar:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// GET /api/cotacoes/por-chamado/:chamadoId
// Busca chamado com itens agrupados por categoria + top 3 fornecedores
// ───────────────────────────────────────────────────────────────────────
router.get('/por-chamado/:chamadoId', tenantMiddleware, async (req, res) => {
  try {
    const { chamadoId } = req.params;

    if (!chamadoId) {
      return res.status(400).json({ erro: 'chamadoId é obrigatório' });
    }

    const resultado = await cotacaoService.buscarPorChamadoComFornecedores(
      req.tenantId,
      parseInt(chamadoId)
    );

    res.json({
      ok: true,
      ...resultado
    });
  } catch (err) {
    console.error('❌ Erro em por-chamado:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// POST /api/cotacoes/salvar
// Salva cotação em rascunho
// ───────────────────────────────────────────────────────────────────────
router.post('/salvar', tenantMiddleware, async (req, res) => {
  try {
    const { chamado_id, itens, notas, origem_ov_numero } = req.body;

    if (!chamado_id || !itens || itens.length === 0) {
      return res.status(400).json({ 
        erro: 'chamado_id e itens são obrigatórios' 
      });
    }

    const resultado = await cotacaoService.salvarCotacao(req.tenantId, {
      chamado_id,
      itens,
      notas,
      origem_ov_numero: origem_ov_numero || null
    });

    res.json({
      ok: true,
      ...resultado
    });
  } catch (err) {
    console.error('❌ Erro em salvar:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// POST /api/cotacoes/enviar
// Envia cotação aos fornecedores (usando CotacaoService)
// ───────────────────────────────────────────────────────────────────────
router.post('/enviar', tenantMiddleware, async (req, res) => {
  try {
    const { cotacao_id, origem_ov_numero } = req.body;

    if (!cotacao_id) {
      return res.status(400).json({ erro: 'cotacao_id é obrigatório' });
    }

    const resultado = await cotacaoService.enviarCotacao(req.tenantId, cotacao_id, {
      origem_ov_numero: origem_ov_numero || null
    });

    res.json({
      ok: true,
      ...resultado
    });
  } catch (err) {
    console.error('❌ Erro em enviar:', err);
    res.status(500).json({ erro: err.message });
  }
});

// PUT /api/cotacoes/:id - Atualizar cotação
router.put('/:id', tenantMiddleware, async (req, res) => {
  try {
    const { itens, notas } = req.body;
    const cotacaoId = parseInt(req.params.id);

    if (!itens || itens.length === 0) {
      return res.status(400).json({ erro: 'itens são obrigatórios' });
    }

    const resultado = await cotacaoService.atualizarCotacao(req.tenantId, cotacaoId, {
      itens,
      notas
    });

    res.json({ ok: true, ...resultado });
  } catch (err) {
    console.error('❌ Erro em atualizar:', err);
    res.status(500).json({ erro: err.message });
  }
});

// DELETE /api/cotacoes/:id - Excluir (cancelar) cotação
router.delete('/:id', tenantMiddleware, async (req, res) => {
  try {
    const service = new CotacaoService(DB);
    const result = await service.excluirCotacao(req.tenantId, req.params.id);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('❌ Erro ao excluir:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// POST /api/cotacoes/:cotacaoId/ordem-venda
// Cria ordem de venda a partir de uma cotação
// ───────────────────────────────────────────────────────────────────────
router.post('/:cotacaoId/ordem-venda', tenantMiddleware, async (req, res) => {
  try {
    const { cotacaoId } = req.params;
    const { fornecedor_id, valor, frete, valor_original, frete_original, economia, obs } = req.body;

    if (!cotacaoId || !fornecedor_id) {
      return res.status(400).json({ 
        erro: 'cotacaoId e fornecedor_id são obrigatórios' 
      });
    }

    const resultado = await cotacaoService.criarOrdenVenda(
      req.tenantId,
      parseInt(cotacaoId),
      parseInt(fornecedor_id),
      req.userId,
      {
        valor,
        frete,
        valor_original,
        frete_original,
        economia,
        obs
      }
    );

    res.json({ ok: true, ...resultado });
  } catch (err) {
    console.error('❌ Erro ao criar OV:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// GET /api/cotacoes/:cotacaoId/status
// ───────────────────────────────────────────────────────────────────────
router.get('/:cotacaoId/status', tenantMiddleware, async (req, res) => {
  try {
    const { cotacaoId } = req.params;

    if (!cotacaoId) {
      return res.status(400).json({ erro: 'cotacaoId é obrigatório' });
    }

    console.log(`🔍 Obtendo status da cotação ${cotacaoId}`);

    const status = await cotacaoService.obterStatusCotacao(
      req.tenantId,
      parseInt(cotacaoId)
    );

    res.json({
      ok: true,
      ...status
    });

  } catch (err) {
    console.error('❌ Erro ao obter status:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// PUT /api/cotacoes/:cotacaoId/fornecedor/:fornecedorId/atualizar-resposta
// Atualizar resposta manual de um fornecedor
// ───────────────────────────────────────────────────────────────────────
router.put('/:cotacaoId/fornecedor/:fornecedorId/atualizar-resposta', tenantMiddleware, async (req, res) => {
  try {
    const { cotacaoId, fornecedorId } = req.params;
    // 🔥 ADICIONE frete_renegociado
    const { valor, prazo, valor_frete, obs, valor_renegociado, frete_renegociado } = req.body;

    if (!cotacaoId || !fornecedorId) {
      return res.status(400).json({ 
        erro: 'cotacaoId e fornecedorId são obrigatórios' 
      });
    }

    console.log(`📝 Atualizando resposta: cotação ${cotacaoId}, fornecedor ${fornecedorId}`);

    const atualizado = await cotacaoService.atualizarRespostaFornecedor(
      req.tenantId,
      parseInt(cotacaoId),
      parseInt(fornecedorId),
      {
        valor,
        prazo,
        valor_frete,
        obs,
        valor_renegociado,
        frete_renegociado
      }
    );

    res.json({
      ok: true,
      mensagem: 'Resposta atualizada com sucesso',
      ...atualizado
    });
  } catch (err) {
    console.error('❌ Erro ao atualizar resposta:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// POST /api/cotacoes/:cotacaoId/fornecedores
// Vincula fornecedor a uma cotação
// ───────────────────────────────────────────────────────────────────────

router.post('/:cotacaoId/fornecedores', tenantMiddleware, async (req, res) => {
  try {
    const { cotacaoId } = req.params;
    const { fornecedor_id } = req.body;
    const tenantId = req.tenantId;

    if (!fornecedor_id) {
      return res.status(400).json({ erro: 'fornecedor_id é obrigatório' });
    }

    // 1. Verificar se cotação existe
    const cotacao = await DB.selectOne('cotacoes', { id: cotacaoId }, tenantId);
    if (!cotacao) {
      return res.status(404).json({ erro: 'Cotação não encontrada' });
    }

    // 2. Verificar se fornecedor existe
    const fornecedor = await DB.selectOne('fornecedores', { id: fornecedor_id }, tenantId);
    if (!fornecedor) {
      return res.status(404).json({ erro: 'Fornecedor não encontrado' });
    }

    // 3. Gerar token único
    const { v4: uuidv4 } = require('uuid');
    const token = uuidv4();

    // 4. Inserir em cotacao_fornecedores
    const contatos = fornecedor.contatos ? JSON.parse(fornecedor.contatos) : [];
    const emailComercial = contatos?.[0]?.email || fornecedor.email;

    const resultado = await DB.insert(
      'cotacao_fornecedores',
      {
        tenant_id: tenantId,
        cotacao_id: cotacaoId,
        fornecedor_id: fornecedor_id,
        fornecedor_nome: fornecedor.nome,
        fornecedor_email: emailComercial,
        token: token,
        status: 'pendente'
      },
      tenantId
    );

    return res.json({
      ok: true,
      cotacao_fornecedor_id: resultado.id,
      token: token,
      mensagem: `Fornecedor ${fornecedor.nome} vinculado com sucesso`
    });

  } catch (erro) {
    console.error('❌ Erro ao vincular fornecedor:', erro);
    return res.status(500).json({ 
      erro: 'Erro ao vincular fornecedor',
      detalhes: process.env.NODE_ENV === 'development' ? erro.message : undefined
    });
  }
});

// ───────────────────────────────────────────────────────────────────────
// GET /api/cotacoes/:cotacaoId/monitorar
// Retorna status da cotação estruturado por ITEM (para TelaMonitorarRespostas)
// ───────────────────────────────────────────────────────────────────────

router.get('/:cotacaoId/monitorar', tenantMiddleware, async (req, res) => {
  try {
    const { cotacaoId } = req.params;
    const tenantId = req.tenantId;

    // 1. Buscar cotação
    const cotacao = await DB.selectOne('cotacoes', { id: cotacaoId }, tenantId);
    if (!cotacao) {
      return res.status(404).json({ erro: 'Cotação não encontrada' });
    }

    // 2. Buscar itens da cotação
    const itens = await DB.select('cotacao_itens', { cotacao_id: cotacaoId }, tenantId);

    // 2b. Buscar dados dos itens do chamado (nome, código, etc)
    const chamadoItemIds = itens.map(i => i.chamado_item_id);
    const chamadoItens = chamadoItemIds.length > 0 
      ? await DB.select('chamado_itens', {}, tenantId).then(todos =>
          todos.filter(ci => chamadoItemIds.includes(ci.id))
        )
      : [];

    // 2c. Juntar informações
    const itensComDados = itens.map(item => {
      const chamadoItem = chamadoItens.find(ci => ci.id === item.chamado_item_id);
      return {
        ...item,
        item_nome: chamadoItem?.item_nome || 'Sem nome',
        codigo: chamadoItem?.codigo || '',
        categoria: chamadoItem?.categoria || ''
      };
    });

    // 3. Buscar fornecedores vinculados
    const fornecedores = await DB.select('cotacao_fornecedores', { cotacao_id: cotacaoId }, tenantId);

    // ✅ NOVO: Estruturar por ITEM usando fornecedores_ids do próprio item!
    const itensEstruturados = itensComDados.map(item => {
      // 🔥 USAR O fornecedores_ids DO PRÓPRIO ITEM
      const fornecedoresIds = Array.isArray(item.fornecedores_ids) 
        ? item.fornecedores_ids 
        : JSON.parse(item.fornecedores_ids || '[]');

      const fornecedoresComResposta = fornecedoresIds.map(fornecedorId => {
        const forn = fornecedores.find(f => f.fornecedor_id === fornecedorId);
        return forn ? {
          id: forn.id,
          fornecedor_id: forn.fornecedor_id,
          nome: forn.fornecedor_nome,
          email: forn.fornecedor_email,
          status: forn.status,
          valor: forn.valor || null,
          frete: forn.valor_frete || null,
          prazo: forn.prazo || null,
          obs: forn.obs || null,
          data_resposta: forn.data_resposta,
          total: forn.valor ? (forn.valor + (forn.valor_frete || 0)) : null,
          posicao: null
        } : null;
      }).filter(Boolean);

      // Calcular posições
      const comValor = fornecedoresComResposta.filter(f => f.total !== null);
      if (comValor.length > 0) {
        const ordenado = [...comValor].sort((a, b) => a.total - b.total);
        ordenado.forEach((f, idx) => {
          const fornInArray = fornecedoresComResposta.find(fn => fn.id === f.id);
          if (fornInArray) {
            fornInArray.posicao = idx + 1;
          }
        });
      }

      return {
        id: item.id,
        nome: item.item_nome,
        quantidade: item.quantidade,
        categoria: item.categoria,
        codigo: item.codigo,
        fornecedores: fornecedoresComResposta
      };
    });

    // 6. Calcular resumos
    const respondidos = fornecedores.filter(f => f.status === 'respondido').length;
    const pendentes = fornecedores.length - respondidos;

    // 7. Encontrar melhor proposta geral
    const melhorProposta = fornecedores
      .filter(f => f.status === 'respondido' && f.valor)
      .reduce((a, b) => (a.valor + (a.valor_frete || 0)) < (b.valor + (b.valor_frete || 0)) ? a : b, null);

    return res.json({
      cotacao: {
        id: cotacao.id,
        numero: cotacao.numero,
        status: cotacao.status,
        criado_em: cotacao.criado_em,
        enviado_em: cotacao.enviado_em
      },
      itens: itensEstruturados,
      resumo: {
        total: itensEstruturados.length,
        respondidos: respondidos,
        pendentes: pendentes
      },
      melhorProposta
    });

  } catch (erro) {
    console.error('❌ Erro ao buscar status cotação:', erro);
    return res.status(500).json({
      erro: 'Erro ao carregar status',
      detalhes: process.env.NODE_ENV === 'development' ? erro.message : undefined
    });
  }
});

// POST /api/cotacoes/:cotacaoId/item-fornecedor-selecionado
router.post('/:cotacaoId/item-fornecedor-selecionado', tenantMiddleware, async (req, res) => {
  try {
    const { cotacaoId } = req.params;
    const { cotacao_item_id, fornecedor_id } = req.body;
    const tenantId = req.tenantId;

    if (!cotacao_item_id || !fornecedor_id) {
      return res.status(400).json({ erro: 'cotacao_item_id e fornecedor_id são obrigatórios' });
    }

    await DB.insert(
      'cotacao_fornecedor_item_selecionado',
      {
        tenant_id: tenantId,
        cotacao_id: cotacaoId,
        cotacao_item_id,
        fornecedor_id,
        criado_em: new Date().toISOString()
      },
      tenantId
    );

    return res.json({ ok: true });
  } catch (erro) {
    console.error('❌ Erro ao registrar seleção:', erro);
    return res.status(500).json({ erro: 'Erro ao registrar seleção' });
  }
});

// GET /api/cotacoes/metricas-negociacao
router.get('/metricas-negociacao', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    const dados = await DB.raw(`
      SELECT 
        COUNT(*) as total_negociacoes,
        SUM(CASE WHEN economia > 0 THEN 1 ELSE 0 END) as negociacoes_sucesso,
        AVG(economia) as economia_media,
        SUM(economia) as economia_total
      FROM cotacao_fornecedores
      WHERE tenant_id = $1 AND valor_renegociado IS NOT NULL
    `, [tenantId]);

    res.json(dados[0]);
  } catch (err) {
    console.error('❌ Erro ao calcular métricas:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/cotacoes/:cotacaoId/fornecedor/:fornecedorId/renegociar
router.post('/:cotacaoId/fornecedor/:fornecedorId/renegociar', tenantMiddleware, async (req, res) => {
  try {
    const { cotacaoId, fornecedorId } = req.params;
    const { valor_renegociado } = req.body;

    const resposta = await DB.selectOne('cotacao_fornecedores', { 
      cotacao_id: cotacaoId, 
      fornecedor_id: fornecedorId 
    }, req.tenantId);
    
    if (!resposta) {
      return res.status(404).json({ erro: 'Resposta não encontrada' });
    }

    // 🔥 SALVAR O VALOR RENEGOCIADO E CALCULAR ECONOMIA
    const economia = (resposta.valor || 0) - valor_renegociado;

    await DB.update('cotacao_fornecedores', resposta.id, {
      valor_renegociado,
      economia,
      data_renegociacao: new Date()
    }, req.tenantId);

    return res.json({ ok: true, economia });
  } catch (err) {
    console.error('❌ Erro ao renegociar:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

module.exports = router;