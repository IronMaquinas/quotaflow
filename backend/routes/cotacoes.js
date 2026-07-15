// routes/cotacoes.js
const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const { DB } = require("../db");
const tenantMiddleware = require("../middleware/tenantMiddleware");
const { enviarEmailCotacao, enviarEmailResultado } = require("../services/emailService");

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
    // Buscar todos os chamados
    const chamados = await DB.raw(`
      SELECT 
        c.id, c.numero, c.equipamento_id, c.status, c.aberto_em,
        c.tecnico_nome, c.descricao,
        e.tag as equipamento_tag, 
        e.nome as equipamento_nome
      FROM chamados c
      LEFT JOIN equipamentos e ON e.id = c.equipamento_id AND e.tenant_id = c.tenant_id
      WHERE c.tenant_id = $1
      ORDER BY c.aberto_em DESC
    `, [req.tenantId]);

    // Buscar todos os itens de uma vez (em vez de um por um)
    const chamadoIds = chamados.map(ch => ch.id);
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

    // Montar resultado
    const resultado = chamados.map(ch => ({
      ...ch,
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
    const { equipamento_id, tecnico_nome, descricao_geral, itens } = req.body;

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
      status: "aguardando_cotacao",
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
        descricao: item.descricao || ""
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
    const cotacoes = await DB.raw(`
      SELECT 
        c.id,
        c.numero as cotacao_numero,
        c.status as cotacao_status,
        c.enviado_em,
        c.finalizado_em,
        ch.numero as chamado_numero,
        ch.peca,
        ch.categoria_item
      FROM cotacoes c
      JOIN chamados ch ON ch.id = c.chamado_id AND ch.tenant_id = c.tenant_id
      WHERE c.tenant_id = $1
      ORDER BY c.enviado_em DESC
    `, [req.tenantId]);

    const resultado = await Promise.all(
      cotacoes.map(async (cot) => {
        const fornecedores = await DB.raw(`
          SELECT 
            id, fornecedor_nome, fornecedor_email, status, 
            valor, prazo, frete, valor_frete, obs, data_resposta
          FROM cotacao_fornecedores
          WHERE cotacao_id = $1 AND tenant_id = $2
          ORDER BY data_resposta DESC NULLS LAST
        `, [cot.id, req.tenantId]);
        return { ...cot, fornecedores };
      })
    );

    res.json(resultado);
  } catch (err) {
    console.error("❌ Erro listar cotações:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/cotacoes
router.post("/", tenantMiddleware, async (req, res) => {
  try {
    const { chamado_id, fornecedores } = req.body;

    if (!chamado_id || !fornecedores || fornecedores.length === 0) {
      return res.status(400).json({ erro: "chamado_id e lista de fornecedores são obrigatórios" });
    }

    const chamado = await DB.selectOne("chamados", { id: chamado_id }, req.tenantId);
    if (!chamado) {
      return res.status(404).json({ erro: "Chamado não encontrado" });
    }

    const numero = await gerarNumeroCotacao(req.tenantId);

    const cotacao = await DB.insert("cotacoes", {
      chamado_id,
      numero,
      status: "em_curso"
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
    const { equipamento_id, descricao_geral, itens } = req.body;
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
          descricao: item.descricao || ""
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

module.exports = router;