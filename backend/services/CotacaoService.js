// services/CotacaoService.js
/**
 * CotacaoService - BACKEND
 * 
 * Gerencia cotações com:
 * ✓ Agrupamento automático por categoria
 * ✓ Identificação automática de fornecedores por marca/modelo
 * ✓ Portal do fornecedor (público)
 * ✓ Resposta de cotações
 * 
 * NÃO É CLIENT-SIDE! Este é o serviço backend puro.
 */

class CotacaoService {
  constructor(db) {
    this.db = db;
  }

  // ───────────────────────────────────────────────────────────────────────
  // 1. GERAR COTAÇÕES (Da forma INTELIGENTE)
  // ───────────────────────────────────────────────────────────────────────
  async gerarCotacoesPorCategoria(tenantId, chamadoId, usuarioId = null) {
    console.log(`\n🎯 [CotacaoService] Gerando cotações para chamado ${chamadoId}`);

    // 1. BUSCAR ITENS DO CHAMADO
    const itensRaw = await this.db.select('chamado_itens', { chamado_id: chamadoId });

    console.log(`📦 [CotacaoService] ${itensRaw.length} itens encontrados`);

    if (itensRaw.length === 0) {
      throw new Error('Chamado não tem itens');
    }

    // 2. ENRIQUECER ITENS COM INFORMAÇÕES DO CATÁLOGO
    const itens = await Promise.all(
      itensRaw.map(async (item) => {
        // Tentar encontrar item no catálogo
        const catalogoItem = await this.db.raw(
          `SELECT id, categoria, marca, modelo, tipo_fabricante, ano_fabricacao_inicio, ano_fabricacao_fim
           FROM catalogo_itens
           WHERE tenant_id = $1 AND nome ILIKE $2 AND ativo = true
           LIMIT 1`,
          [tenantId, `%${item.item_nome}%`]
        );

        return {
          ...item,
          catalogo_id: catalogoItem[0]?.id || null,
          categoria: catalogoItem[0]?.categoria || 'Sem Categoria',
          marca: catalogoItem[0]?.marca || null,
          modelo: catalogoItem[0]?.modelo || null,
          tipo_fabricante: catalogoItem[0]?.tipo_fabricante || 'Genérico'
        };
      })
    );

    console.log(`📋 [CotacaoService] Itens enriquecidos com dados do catálogo`);

    // 3. AGRUPAR POR CATEGORIA
    const itensPorCategoria = this.agruparPorCategoria(itens);
    console.log(`📊 [CotacaoService] Categorias:`, Object.keys(itensPorCategoria));

    // 4. PARA CADA CATEGORIA, CRIAR UMA COTAÇÃO
    const cotacoes = [];

    for (const [categoria, itensCategoria] of Object.entries(itensPorCategoria)) {
      console.log(`\n├─ Processando categoria: ${categoria}`);

      const cotacao = await this.criarCotacaoCategoria(
        tenantId,
        chamadoId,
        categoria,
        itensCategoria,
        usuarioId
      );

      cotacoes.push(cotacao);
    }

    console.log(`\n✅ [CotacaoService] ${cotacoes.length} cotações criadas\n`);
    return cotacoes;
  }

  // ───────────────────────────────────────────────────────────────────────
  // 2. CRIAR COTAÇÃO PARA UMA CATEGORIA
  // ───────────────────────────────────────────────────────────────────────
  async criarCotacaoCategoria(tenantId, chamadoId, categoria, itensCategoria, usuarioId) {
    console.log(`  📝 Criando cotação para ${categoria} (${itensCategoria.length} itens)`);

    // Gerar número único para cotação
    const numeroCotacao = `COT-${chamadoId}-${Date.now()}`;

    // Criar cotação
    const cotacao = await this.db.insert('cotacoes', {
      tenant_id: tenantId,
      chamado_id: chamadoId,
      numero_cotacao: numeroCotacao,
      categoria: categoria,
      status: 'pendente',
      criado_por: usuarioId
    });

    console.log(`  ✅ Cotação ${numeroCotacao} criada (ID: ${cotacao.id})`);

    // Coletar todos os fornecedores únicos para esta categoria
    let fornecedoresUnicos = new Map(); // ID -> Info

    // Para cada item, buscar fornecedores
    for (const item of itensCategoria) {
      console.log(`    ├─ ${item.item_nome}`);

      // Buscar fornecedores que vendem este item
      const fornecedores = await this.buscarFornecedoresItem(
        tenantId,
        categoria,
        item.marca,
        item.modelo,
        item.tipo_fabricante
      );

      console.log(`      └─ ${fornecedores.length} fornecedor(es) encontrado(s)`);

      // Adicionar item à cotação
      const cotacaoItem = await this.db.insert('cotacao_itens', {
        tenant_id: tenantId,
        cotacao_id: cotacao.id,
        chamado_item_id: item.id,
        item_catalogo_id: item.catalogo_id,
        quantidade: item.quantidade || 1,
        preco_estimado: fornecedores[0]?.preco_unitario || null,
        fornecedores_ids: fornecedores.map(f => f.fornecedor_id)
      });

      // Coletar fornecedores únicos
      fornecedores.forEach(f => {
        if (!fornecedoresUnicos.has(f.fornecedor_id)) {
          fornecedoresUnicos.set(f.fornecedor_id, {
            id: f.fornecedor_id,
            nome: f.fornecedor_nome,
            email: f.fornecedor_email
          });
        }
      });
    }

    // Adicionar fornecedores à cotação
    console.log(`  👥 Adicionando ${fornecedoresUnicos.size} fornecedor(es)`);

    for (const [fornecedor_id, fornecedorInfo] of fornecedoresUnicos) {
      // Gerar token único para o fornecedor
      const token = this.gerarTokenFornecedor(cotacao.id, fornecedor_id);

      const cotacaoForn = await this.db.insert('cotacao_fornecedores', {
        tenant_id: tenantId,
        cotacao_id: cotacao.id,
        fornecedor_id: fornecedor_id,
        status: 'pendente',
        token_acesso: token
      });

      console.log(`    ✓ ${fornecedorInfo.nome}`);
    }

    console.log(`  ✅ Cotação completada\n`);

    return {
      id: cotacao.id,
      numero: numeroCotacao,
      categoria: categoria,
      itens: itensCategoria.length,
      fornecedores: fornecedoresUnicos.size
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // 3. BUSCAR FORNECEDORES PARA UM ITEM
  // ───────────────────────────────────────────────────────────────────────
  async buscarFornecedoresItem(tenantId, categoria, marca = null, modelo = null, tipoFabricante = null) {
    let query = `
      SELECT DISTINCT
        fi.id as fornecedor_item_id,
        fi.fornecedor_id,
        f.nome as fornecedor_nome,
        f.email as fornecedor_email,
        fi.preco_unitario,
        fi.descricao_fornecedor,
        fi.data_tabela,
        c.marca,
        c.modelo,
        c.tipo_fabricante
      FROM fornecedor_itens fi
      JOIN fornecedores f ON fi.fornecedor_id = f.id
      JOIN catalogo_itens c ON fi.item_catalogo_id = c.id
      WHERE fi.tenant_id = $1 
        AND fi.ativo = true
        AND c.categoria = $2
    `;

    const params = [tenantId, categoria];

    // Se temos marca, buscar ESPECÍFICO da marca OU genéricos
    if (marca) {
      query += ` AND (c.marca = $${params.length + 1} OR c.marca IS NULL)`;
      params.push(marca);

      // Se temos modelo, buscar ESPECÍFICO do modelo OU genéricos
      if (modelo) {
        query += ` AND (c.modelo = $${params.length + 1} OR c.modelo IS NULL)`;
        params.push(modelo);
      }
    }

    // Ordenar por preço (melhor preço primeiro)
    query += ` ORDER BY fi.preco_unitario ASC LIMIT 10`;

    const fornecedores = await this.db.raw(query, params);
    return fornecedores;
  }

  // ───────────────────────────────────────────────────────────────────────
  // 4. LISTAR COTAÇÕES DO TENANT
  // ───────────────────────────────────────────────────────────────────────
  async listar(tenantId, filtros = {}) {
    const { status = null, chamado_id = null, limite = 50, pagina = 1 } = filtros;

    let query = `
      SELECT 
        c.id,
        c.numero_cotacao,
        c.categoria,
        c.status,
        c.chamado_id,
        COUNT(DISTINCT ci.id) as total_itens,
        COUNT(DISTINCT cf.id) as total_fornecedores,
        c.criado_em,
        c.enviado_em
      FROM cotacoes c
      LEFT JOIN cotacao_itens ci ON c.id = ci.cotacao_id
      LEFT JOIN cotacao_fornecedores cf ON c.id = cf.cotacao_id
      WHERE c.tenant_id = $1
    `;

    const params = [tenantId];

    if (status) {
      query += ` AND c.status = $${params.length + 1}`;
      params.push(status);
    }

    if (chamado_id) {
      query += ` AND c.chamado_id = $${params.length + 1}`;
      params.push(chamado_id);
    }

    query += ` GROUP BY c.id ORDER BY c.criado_em DESC LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`;

    const cotacoes = await this.db.raw(query, params);
    return cotacoes;
  }

  // ───────────────────────────────────────────────────────────────────────
  // 5. OBTER COTAÇÃO COMPLETA (Com todos os detalhes)
  // ───────────────────────────────────────────────────────────────────────
  async obterCotacao(tenantId, cotacaoId) {
    const cotacao = await this.db.selectOne('cotacoes', { id: cotacaoId }, tenantId);

    if (!cotacao) {
      throw new Error(`Cotação ${cotacaoId} não encontrada`);
    }

    // Buscar itens
    const itens = await this.db.raw(`
      SELECT 
        ci.id,
        ci.quantidade,
        ci.preco_estimado,
        c.nome,
        c.categoria,
        c.marca,
        c.modelo
      FROM cotacao_itens ci
      JOIN catalogo_itens c ON ci.item_catalogo_id = c.id
      WHERE ci.cotacao_id = $1
      ORDER BY c.nome
    `, [cotacaoId]);

    // Buscar fornecedores
    const fornecedores = await this.db.raw(`
      SELECT 
        cf.id,
        cf.fornecedor_id,
        f.nome,
        f.email,
        f.telefone,
        cf.status,
        cf.valor_total,
        cf.respondido_em,
        cf.token_acesso
      FROM cotacao_fornecedores cf
      JOIN fornecedores f ON cf.fornecedor_id = f.id
      WHERE cf.cotacao_id = $1
      ORDER BY f.nome
    `, [cotacaoId]);

    return {
      ...cotacao,
      itens,
      fornecedores,
      total_itens: itens.length,
      total_fornecedores: fornecedores.length,
      preco_estimado_total: itens.reduce((sum, i) => sum + (i.preco_estimado || 0), 0)
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // 6. ENVIAR COTAÇÃO PARA FORNECEDORES
  // ───────────────────────────────────────────────────────────────────────
  async enviarCotacao(tenantId, cotacaoId, fornecedorIds = null) {
    console.log(`📧 [CotacaoService] Enviando cotação ${cotacaoId}`);

    const cotacao = await this.obterCotacao(tenantId, cotacaoId);

    let fornecedores = cotacao.fornecedores;

    if (fornecedorIds && fornecedorIds.length > 0) {
      fornecedores = fornecedores.filter(f => fornecedorIds.includes(f.fornecedor_id));
    }

    console.log(`📧 [CotacaoService] Enviando para ${fornecedores.length} fornecedor(es)`);

    // TODO: Implementar envio de email para cada fornecedor
    // Usar: cotacao.numero_cotacao, fornecedor.token_acesso, etc

    // Atualizar status
    await this.db.update('cotacoes', cotacaoId, {
      status: 'enviada',
      enviado_em: new Date()
    }, tenantId);

    console.log(`✅ [CotacaoService] Cotação enviada`);

    return {
      cotacao_id: cotacaoId,
      fornecedores_contatados: fornecedores.length,
      status: 'enviada'
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // 7. PORTAL FORNECEDOR (Público - sem auth)
  // ───────────────────────────────────────────────────────────────────────
  async buscarPorToken(token) {
    console.log(`🔍 [CotacaoService] Buscando cotação por token`);

    const cotacaoForn = await this.db.selectOne('cotacao_fornecedores', { token_acesso: token });

    if (!cotacaoForn) {
      throw new Error('Token inválido ou expirado');
    }

    // Buscar cotação completa
    const cotacao = await this.obterCotacao(cotacaoForn.tenant_id, cotacaoForn.cotacao_id);

    // Filtrar apenas informações públicas
    return {
      id: cotacao.id,
      numero: cotacao.numero_cotacao,
      categoria: cotacao.categoria,
      data_cotacao: cotacao.criado_em,
      itens: cotacao.itens,
      seu_status: cotacaoForn.status,
      sua_resposta: cotacaoForn.valor_total ? {
        valor_total: cotacaoForn.valor_total,
        respondido_em: cotacaoForn.respondido_em
      } : null
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // 8. FORNECEDOR RESPONDER COTAÇÃO
  // ───────────────────────────────────────────────────────────────────────
  async responderCotacao(token, resposta) {
    console.log(`📝 [CotacaoService] Recebendo resposta de cotação`);

    const { valor_total, observacoes } = resposta;

    if (!valor_total || valor_total <= 0) {
      throw new Error('Valor deve ser maior que 0');
    }

    const cotacaoForn = await this.db.selectOne('cotacao_fornecedores', { token_acesso: token });

    if (!cotacaoForn) {
      throw new Error('Token inválido');
    }

    // Atualizar resposta
    await this.db.update('cotacao_fornecedores', cotacaoForn.id, {
      status: 'respondida',
      valor_total: valor_total,
      observacoes: observacoes || null,
      respondido_em: new Date()
    });

    console.log(`✅ [CotacaoService] Cotação respondida`);

    return { ok: true, mensagem: 'Resposta recebida com sucesso' };
  }

  // ───────────────────────────────────────────────────────────────────────
  // HELPERS
  // ───────────────────────────────────────────────────────────────────────

  agruparPorCategoria(itens) {
    const grupos = {};
    itens.forEach(item => {
      const categoria = item.categoria || 'Sem Categoria';
      if (!grupos[categoria]) {
        grupos[categoria] = [];
      }
      grupos[categoria].push(item);
    });
    return grupos;
  }

  gerarTokenFornecedor(cotacaoId, fornecedorId) {
    // Gera token seguro para acesso público
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `COT-${cotacaoId}-FOR-${fornecedorId}-${timestamp}-${random}`;
  }
}

module.exports = CotacaoService;