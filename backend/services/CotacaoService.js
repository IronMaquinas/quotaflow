// services/CotacaoService.js
const { enviarEmailCotacao } = require('./emailService');

const DB = require('../db');
const { supabase } = require('../db');

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
        c.tipo_fabricante,
        f.tipo,
        f.tenant_id as fornecedor_tenant_id
      FROM fornecedor_itens fi
      JOIN fornecedores f ON fi.fornecedor_id = f.id
      JOIN catalogo_itens c ON fi.item_catalogo_id = c.id
      WHERE fi.ativo = true
        AND f.ativo = true
        AND c.categoria = $1
        AND (f.tipo = 'global' OR f.tenant_id = $2)
    `;

    const params = [categoria, tenantId];

    if (marca) {
      query += ` AND (c.marca = $${params.length + 1} OR c.marca IS NULL)`;
      params.push(marca);
      if (modelo) {
        query += ` AND (c.modelo = $${params.length + 1} OR c.modelo IS NULL)`;
        params.push(modelo);
      }
    }

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
  // 1. Buscar cotação
  const cotacao = await this.db.selectOne('cotacoes', { id: cotacaoId }, tenantId);
  if (!cotacao) throw new Error(`Cotação ${cotacaoId} não encontrada`);

  // 2. Buscar itens com LEFT JOIN (para não falhar se não houver correspondência)
  const { data: itens, error: errItens } = await supabase
    .from('cotacao_itens')
    .select(`
      id,
      quantidade,
      preco_estimado,
      chamado_item_id,
      item_catalogo_id,
      fornecedores_ids,
      catalogo_itens!left (
        nome,
        categoria,
        marca,
        modelo
      ),
      chamado_itens!left (
        item_nome
      )
    `)
    .eq('cotacao_id', cotacaoId)
    .eq('tenant_id', tenantId);

  if (errItens) throw new Error(`Erro ao buscar itens: ${errItens.message}`);

  // 3. Buscar fornecedores com LEFT JOIN
  const { data: fornecedores, error: errForn } = await supabase
    .from('cotacao_fornecedores')
    .select(`
      id,
      fornecedor_id,
      status,
      valor,
      prazo,
      frete,
      valor_frete,
      obs,
      data_resposta,
      token_acesso,
      fornecedores!left (
        nome,
        email
      )
    `)
    .eq('cotacao_id', cotacaoId)
    .eq('tenant_id', tenantId);

  if (errForn) throw new Error(`Erro ao buscar fornecedores: ${errForn.message}`);

  // 4. Formatar itens com preços dos fornecedores + recomendados
  const itensFormatados = await Promise.all(
    itens.map(async (item) => {
      // 4a. Buscar os 3 fornecedores mais baratos para este item (global)
      const { data: recomendados, error: errRec } = await supabase
        .from('fornecedor_itens')
        .select(`
          fornecedor_id,
          preco_unitario,
          fornecedores!inner (nome, email)
        `)
        .eq('item_catalogo_id', item.item_catalogo_id)
        .eq('tenant_id', tenantId)
        .eq('ativo', true)
        .order('preco_unitario', { ascending: true })
        .limit(3);

      if (errRec) console.error('Erro ao buscar recomendados:', errRec);

      // 4b. Mapear recomendados para o formato esperado
      const recomendadosFormatados = (recomendados || []).map(r => ({
        fornecedor_id: r.fornecedor_id,
        nome: r.fornecedores?.nome || 'Fornecedor',
        preco: parseFloat(r.preco_unitario) || 0
      }));

      // 4c. Buscar fornecedores da cotação (para manter os selecionados manualmente)
      const fornecedoresDaCotacao = fornecedores.map(f => ({
        fornecedor_id: f.fornecedor_id,
        nome: f.fornecedores?.nome || f.nome,
        preco: 0 // será substituído se houver preço
      }));

      // 4d. Juntar recomendados + fornecedores da cotação, remover duplicatas por fornecedor_id
      const todos = [...recomendadosFormatados, ...fornecedoresDaCotacao];
      const unicos = [];
      const idsVistos = new Set();
      for (const f of todos) {
        if (!idsVistos.has(f.fornecedor_id)) {
          idsVistos.add(f.fornecedor_id);
          unicos.push(f);
        }
      }

      // 4e. Atualizar preços dos fornecedores da cotação (que podem ter preço 0)
      // Buscar preços reais para todos os fornecedores únicos
      const { data: precosReais } = await supabase
        .from('fornecedor_itens')
        .select('fornecedor_id, preco_unitario')
        .eq('item_catalogo_id', item.item_catalogo_id)
        .eq('tenant_id', tenantId)
        .in('fornecedor_id', unicos.map(f => f.fornecedor_id));

      const precoMap = {};
      precosReais?.forEach(p => { precoMap[p.fornecedor_id] = p.preco_unitario; });

      // Atualizar preços nos objetos
      unicos.forEach(f => {
        if (precoMap[f.fornecedor_id] !== undefined) {
          f.preco = parseFloat(precoMap[f.fornecedor_id]) || 0;
        }
      });

      // 4f. Ordenar por preço (menor primeiro)
      unicos.sort((a, b) => a.preco - b.preco);

      return {
        ...item,
        nome: item.catalogo_itens?.nome || item.chamado_itens?.item_nome || 'Item sem nome',
        categoria: item.catalogo_itens?.categoria || 'Sem categoria',
        marca: item.catalogo_itens?.marca || null,
        modelo: item.catalogo_itens?.modelo || null,
        fornecedores: unicos // sempre terá pelo menos os 3 mais baratos
      };
    })
  );

  // 5. Formatar fornecedores
  const fornecedoresFormatados = fornecedores.map(f => ({
    ...f,
    nome: f.fornecedores?.nome || null,
    email: f.fornecedores?.email || null
  }));

  return {
    ...cotacao,
    itens: itensFormatados,
    fornecedores: fornecedoresFormatados,
    total_itens: itensFormatados.length,
    total_fornecedores: fornecedoresFormatados.length
  };
}

  // ───────────────────────────────────────────────────────────────────────
  // 6. ENVIAR COTAÇÃO PARA FORNECEDORES
  // ───────────────────────────────────────────────────────────────────────
  async enviarCotacao(tenantId, cotacaoId, fornecedorIds = null) {
    console.log('🚀 [enviarCotacao] INICIANDO FUNÇÃO');
    console.log(`📧 [CotacaoService] Enviando cotação ${cotacaoId}`);

    const cotacao = await this.db.selectOne('cotacoes', { id: cotacaoId }, tenantId);
    if (!cotacao) throw new Error(`Cotação ${cotacaoId} não encontrada`);

    const chamado = await this.db.selectOne('chamados', { id: cotacao.chamado_id }, tenantId);

    console.log(`🔍 Buscando itens para cotacao_id: ${cotacaoId}`);

    // 🔥 USANDO SUPABASE NATIVO (em vez de raw)
    const { data: itensCotacao, error } = await supabase
      .from('cotacao_itens')
      .select(`
        id,
        chamado_item_id,
        quantidade,
        fornecedores_ids,
        chamado_itens (
          item_nome,
          codigo,
          descricao
        )
      `)
      .eq('cotacao_id', cotacaoId)
      .eq('tenant_id', tenantId);

    if (error) throw new Error(`Erro ao buscar itens: ${error.message}`);

    const itensComNome = itensCotacao.map(item => ({
      ...item,
      item_nome: item.chamado_itens?.item_nome || 'Item sem nome',
      codigo: item.chamado_itens?.codigo || '',
      descricao: item.chamado_itens?.descricao || ''
    }));

    console.log(`✅ Itens com nome:`, JSON.stringify(itensComNome, null, 2));

    let fornecedores = await this.db.select('cotacao_fornecedores', {
      cotacao_id: cotacaoId,
      status: 'pendente'
    }, tenantId);

    if (fornecedorIds && fornecedorIds.length > 0) {
      fornecedores = fornecedores.filter(f => fornecedorIds.includes(f.fornecedor_id));
    }

    if (fornecedores.length === 0) {
      throw new Error(`Nenhum fornecedor para enviar a cotação ${cotacaoId}`);
    }

    const fornecedorIdsArray = fornecedores.map(f => f.fornecedor_id);
    const fornecedoresData = await this.db.raw(`
      SELECT id, nome, email FROM fornecedores
      WHERE tenant_id = $1 AND id = ANY($2::int[])
    `, [tenantId, fornecedorIdsArray]);

    const fornecedorMap = {};
    fornecedoresData.forEach(f => { fornecedorMap[f.id] = f; });

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/^FRONTEND_URL=/, '');
    console.log(`🔗 FRONTEND_URL: ${frontendUrl}`);

    const extrairIds = (campo) => {
      if (!campo) return [];
      if (Array.isArray(campo)) return campo.map(id => Number(id));
      if (typeof campo === 'string') {
        try {
          const parsed = JSON.parse(campo);
          return Array.isArray(parsed) ? parsed.map(id => Number(id)) : [];
        } catch {
          return campo.split(',').map(id => Number(id.trim())).filter(n => !isNaN(n));
        }
      }
      return [];
    };

    // ✅ BUSCAR COMPRADOR (ADICIONE AQUI)
    const comprador = await this.db.selectOne('usuarios', { id: cotacao.usuario_id }, tenantId);
      
    // ✅ MONTAR ASSUNTO E RODAPÉ (ADICIONE AQUI)
    const assunto = `Solicitação de Cotação - ${cotacao.numero_cotacao}`;    
    
    const rodape = `
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Este é um email automático. Não responda diretamente.

    Dúvidas sobre esta cotação?
    ${comprador?.nome || 'Comprador'}:
    📧 ${comprador?.email}
    📞 ${comprador?.telefone || 'N/A'}

    Acesse o portal: https://kotuno.netlify.app
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `;

    for (const forn of fornecedores) {
      try {
        const fornecedorInfo = fornecedorMap[forn.fornecedor_id];
        if (!fornecedorInfo) {
          console.warn(`⚠️ Fornecedor ${forn.fornecedor_id} não encontrado`);
          continue;
        }

        let token = forn.token_acesso || forn.token;
        if (!token) {
          token = this.gerarTokenFornecedor(cotacaoId, forn.fornecedor_id);
          await this.db.update('cotacao_fornecedores', forn.id, {
            token_acesso: token
          }, tenantId);
          console.log(`🔑 Token gerado para fornecedor ${forn.fornecedor_id}`);
        }

        const itensDoFornecedor = itensComNome.filter(item => {
          const ids = extrairIds(item.fornecedores_ids);
          return ids.includes(Number(forn.fornecedor_id));
        });

        console.log(`🔍 Fornecedor ${fornecedorInfo.nome} (ID ${forn.fornecedor_id}) - Itens encontrados: ${itensDoFornecedor.length}`);

        if (itensDoFornecedor.length === 0) {
          console.log(`⚠️ Fornecedor ${fornecedorInfo.nome} não tem itens selecionados. Pulando.`);
          continue;
        }

        const link = `${frontendUrl}/#/portal/cotacao/${cotacaoId}/${token}`;
        console.log(`🔗 Link gerado: ${link}`);

        const listaItens = itensDoFornecedor.map(item => {
          const nome = item.item_nome;
          const codigo = item.codigo ? ` (${item.codigo})` : '';
          const descricao = item.descricao ? `<br/><small style="color:#666;">${item.descricao}</small>` : '';
          return `<li>${nome}${codigo} - Qtd: ${item.quantidade}${descricao}</li>`;
        }).join('');

        const corpo = `
          <h2>Solicitação de Cotação: ${cotacao.numero_cotacao}</h2>
          <p>Prezado(a) ${fornecedorInfo.nome},</p>
          <p>Você recebeu uma solicitação de cotação para os seguintes itens:</p>
          <ul>
            ${listaItens}
          </ul>
          <p>Clique no link abaixo para acessar o portal e enviar sua proposta:</p>
          <p><a href="${link}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Responder Cotação</a></p>
          <p>Prazo para resposta: 48 horas.</p>
          <hr>
          <p><small>Esta é uma mensagem automática. Não responda este e-mail.</small></p>
        `;

        console.log(`📧 Corpo do e-mail para ${fornecedorInfo.email} (tamanho: ${corpo.length}) - início: ${corpo.substring(0, 100)}...`);

        await enviarEmailCotacao(fornecedorInfo.email, `Cotação ${cotacao.numero || cotacaoId}`, corpo);
        console.log(`✅ E‑mail enviado para ${fornecedorInfo.email} com ${itensDoFornecedor.length} itens`);
      } catch (err) {
        console.error(`❌ Falha ao enviar e‑mail para fornecedor ${forn.fornecedor_id}:`, err.message);
      }
    }

    await this.db.update('cotacoes', cotacaoId, {
      status: 'enviada',
      enviado_em: new Date()
    }, tenantId);

    await this.db.update('chamados', chamado.id, {
      status: 'cotando'
    }, tenantId);

    console.log(`✅ Cotação enviada e chamado atualizado`);

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
    if (!cotacaoForn) throw new Error('Token inválido ou expirado');

    // Buscar cotação completa
    const cotacao = await this.obterCotacao(cotacaoForn.tenant_id, cotacaoForn.cotacao_id);

    // Filtrar apenas informações públicas para o fornecedor
    return {
      id: cotacao.id,
      numero: cotacao.numero_cotacao,
      empresa: 'Empresa do Comprador', // Buscar do tenant
      comprador: 'Comprador', // Buscar do usuário que criou
      fornecedor: cotacaoForn.fornecedor_nome || 'Fornecedor',
      prazo_resposta: cotacaoForn.prazo || null,
      token: token,
      status: cotacaoForn.status,
      itens: cotacao.itens.map(item => ({
        id: item.chamado_item_id || item.id,
        peca: item.nome,
        codigo: item.codigo || item.modelo,
        qtd: item.quantidade,
        equipamento: item.equipamento_nome || '',
        urgencia: item.urgencia || 'media'
      }))
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // 8. FORNECEDOR RESPONDER COTAÇÃO
  // ───────────────────────────────────────────────────────────────────────
  async responderCotacao(token, resposta) {
    console.log(`📝 [CotacaoService] Recebendo resposta de cotação`);

    const { 
      itens,              // array de { item_id, valor_unitario, frete, valor_frete }
      prazo_entrega, 
      observacoes 
    } = resposta;

    if (!itens || itens.length === 0) {
      throw new Error('Nenhum item respondido');
    }

    // Buscar cotacao_fornecedores pelo token
    const cotacaoForn = await this.db.selectOne('cotacao_fornecedores', { token_acesso: token });
    if (!cotacaoForn) throw new Error('Token inválido');

    if (cotacaoForn.status === 'respondido') {
      throw new Error('Esta cotação já foi respondida');
    }

    // Calcular valor total a partir dos itens
    let valorTotal = 0;
    for (const item of itens) {
      const unit = parseFloat(item.valor_unitario) || 0;
      const frete = parseFloat(item.valor_frete) || 0;
      // Se frete = CIF, o valor unitário já inclui frete; se FOB, soma o frete
      const totalItem = unit + (item.frete === 'FOB' ? frete : 0);
      valorTotal += totalItem;
    }

    // Atualizar cotacao_fornecedores com os dados da resposta
    await this.db.update('cotacao_fornecedores', cotacaoForn.id, {
      status: 'respondido',
      valor_total: valorTotal,
      prazo: prazo_entrega || null,
      obs: observacoes || null,
      data_resposta: new Date(),
      // Opcional: salvar resposta detalhada em JSON
      resposta_json: resposta // se tiver campo no banco, senão pode criar depois
    });

    console.log(`✅ Cotação respondida com sucesso`);

    // Enviar e-mail de confirmação para o comprador (opcional)
    // await this.enviarEmailResposta(cotacaoForn);

    return { ok: true, mensagem: 'Proposta enviada com sucesso!' };
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

  // ───────────────────────────────────────────────────────────────────────
  // BUSCAR ITENS SIMILARES (Para autocomplete em TelaChamados)
  // ───────────────────────────────────────────────────────────────────────
  async buscarSimilares(tenantId, termo, limite = 5) {
    console.log(`🔍 [CotacaoService] Buscando similares: "${termo}"`);

    // 1. Buscar todos os itens do tenant
    const itens = await this.db.select('catalogo_itens', { 
      tenant_id: tenantId,
      ativo: true
    });

    // 2. Calcular similaridade com cada item
    const similares = itens
      .map(item => ({
        ...item,
        similaridade: this.calcularSimilaridade(termo, item.nome)
      }))
      .filter(item => item.similaridade >= 70) // Threshold: 70%
      .sort((a, b) => b.similaridade - a.similaridade)
      .slice(0, limite);

    console.log(`✅ [CotacaoService] ${similares.length} itens similares encontrados`);
    return similares;
  }

  // ───────────────────────────────────────────────────────────────────────
  // CALCULAR SIMILARIDADE (Levenshtein - REUTILIZA DO CATALOGO)
  // ───────────────────────────────────────────────────────────────────────
  calcularSimilaridade(str1, str2) {
    const n1 = this.normalizarTexto(str1);
    const n2 = this.normalizarTexto(str2);

    if (n1 === n2) return 100;
    if (!n1 || !n2) return 0;

    const len1 = n1.length;
    const len2 = n2.length;
    const matriz = Array(len2 + 1)
      .fill(null)
      .map(() => Array(len1 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matriz[0][i] = i;
    for (let j = 0; j <= len2; j++) matriz[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = n1[i - 1] === n2[j - 1] ? 0 : 1;
        matriz[j][i] = Math.min(
          matriz[j][i - 1] + 1,
          matriz[j - 1][i] + 1,
          matriz[j - 1][i - 1] + cost
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    const distancia = matriz[len2][len1];
    const similaridade = ((maxLen - distancia) / maxLen) * 100;

    return Math.max(0, Math.min(100, similaridade));
  }

  normalizarTexto(texto) {
    if (!texto) return '';
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
  }

  // ───────────────────────────────────────────────────────────────────────
  // CRIAR COTAÇÃO AUTOMÁTICA (Com item sugerido)
  // ───────────────────────────────────────────────────────────────────────
  async criarAutomatica(tenantId, chamadoId, itemCatalogoId, usuarioId = null) {
    console.log(`📝 [CotacaoService] Criando cotação automática para item ${itemCatalogoId}`);

    // 1. Validar item existe
    const item = await this.db.selectOne('catalogo_itens', { id: itemCatalogoId }, tenantId);
    if (!item) {
      throw new Error(`Item ${itemCatalogoId} não encontrado`);
    }

    console.log(`✅ Item validado: ${item.nome}`);

    // 2. Buscar fornecedores do item
    const fornecedores = await this.buscarFornecedoresPorItem(tenantId, itemCatalogoId);
    console.log(`👥 ${fornecedores.length} fornecedor(es) encontrado(s)`);

    // 3. Criar cotação em rascunho
    const numeroCotacao = `COT-${chamadoId}-${Date.now()}`;
    const cotacao = await this.db.insert('cotacoes', {
      tenant_id: tenantId,
      chamado_id: chamadoId,
      numero_cotacao: numeroCotacao,
      status: 'rascunho',
      modo: 'automatica',  // 🆕 Campo novo!
      criado_por: usuarioId
    });

    console.log(`✅ Cotação criada: ${numeroCotacao} (ID: ${cotacao.id})`);

    // 4. Adicionar item à cotação
    const cotacaoItem = await this.db.insert('cotacao_itens', {  // 🆕 Tabela nova!
      tenant_id: tenantId,
      cotacao_id: cotacao.id,
      item_catalogo_id: itemCatalogoId,
      quantidade: 1,
      preco_estimado: fornecedores[0]?.preco_unitario || null
    });

    console.log(`✅ Item adicionado à cotação`);

    // 5. Retornar cotação com fornecedores
    return {
      cotacaoId: cotacao.id,
      numero: numeroCotacao,
      item: {
        id: item.id,
        nome: item.nome,
        categoria: item.categoria,
        fornecedores: fornecedores
      }
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // BUSCAR FORNECEDORES DE UM ITEM (Helper)
  // ───────────────────────────────────────────────────────────────────────
  async buscarFornecedoresPorItem(tenantId, itemCatalogoId) {
    const fornecedores = await this.db.raw(`
      SELECT DISTINCT
        fi.id as fornecedor_item_id,
        fi.fornecedor_id,
        f.nome as fornecedor_nome,
        f.email as fornecedor_email,
        fi.preco_unitario,
        fi.estoque_status,
        fi.tempo_entrega_dias,
        f.tipo,
        f.tenant_id as fornecedor_tenant_id
      FROM fornecedor_itens fi
      JOIN fornecedores f ON fi.fornecedor_id = f.id
      WHERE fi.item_catalogo_id = $1
        AND fi.ativo = true
        AND f.ativo = true
        AND (f.tipo = 'global' OR f.tenant_id = $2)
      ORDER BY fi.preco_unitario ASC
    `, [itemCatalogoId, tenantId]);

    return fornecedores.map(f => ({
      fornecedorId: f.fornecedor_id,
      nome: f.fornecedor_nome,
      email: f.fornecedor_email,
      preco: f.preco_unitario || 0,
      estoque: f.estoque_status,
      prazo: f.tempo_entrega_dias,
      tipo: f.tipo,
      fornecedor_tenant_id: f.fornecedor_tenant_id
    }));
  }

  // ───────────────────────────────────────────────────────────────────────
  // ADICIONAR ITEM À COTAÇÃO AUTOMÁTICA (Edição)
  // ───────────────────────────────────────────────────────────────────────
  async adicionarItem(tenantId, cotacaoId, itemCatalogoId, quantidade = 1) {
    console.log(`➕ [CotacaoService] Adicionando item ${itemCatalogoId} à cotação ${cotacaoId}`);

    // Validar cotação existe
    const cotacao = await this.db.selectOne('cotacoes', { id: cotacaoId }, tenantId);
    if (!cotacao) throw new Error(`Cotação não encontrada`);

    // Validar item existe
    const item = await this.db.selectOne('catalogo_itens', { id: itemCatalogoId }, tenantId);
    if (!item) throw new Error(`Item não encontrado`);

    // Verificar se item já está na cotação
    const itemExistente = await this.db.selectOne('cotacao_itens', {
      cotacao_id: cotacaoId,
      item_catalogo_id: itemCatalogoId
    }, tenantId);

    if (itemExistente) {
      throw new Error(`Item já adicionado a esta cotação`);
    }

    // Buscar fornecedores
    const fornecedores = await this.buscarFornecedoresPorItem(tenantId, itemCatalogoId);

    // Adicionar item
    const cotacaoItem = await this.db.insert('cotacao_itens', {
      tenant_id: tenantId,
      cotacao_id: cotacaoId,
      item_catalogo_id: itemCatalogoId,
      quantidade: quantidade,
      preco_estimado: fornecedores[0]?.preco || null
    });

    console.log(`✅ Item adicionado`);

    return {
      id: cotacaoItem.id,
      nome: item.nome,
      categoria: item.categoria,
      quantidade: quantidade,
      fornecedores: fornecedores
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // REMOVER ITEM DA COTAÇÃO AUTOMÁTICA (Edição)
  // ───────────────────────────────────────────────────────────────────────
  async removerItem(tenantId, cotacaoId, cotacaoItemId) {
    console.log(`➖ [CotacaoService] Removendo item ${cotacaoItemId} da cotação`);

    // Validar que item pertence à cotação
    const cotacaoItem = await this.db.selectOne('cotacao_itens', {
      id: cotacaoItemId,
      cotacao_id: cotacaoId
    }, tenantId);

    if (!cotacaoItem) throw new Error(`Item não encontrado nesta cotação`);

    // Remover (soft delete ou delete?)
    // Opção 1: Delete físico
    await this.db.delete('cotacao_itens', cotacaoItemId, tenantId);

    // Opção 2: Se tiver campo 'ativo', fazer soft delete:
    // await this.db.update('cotacao_itens', cotacaoItemId, { ativo: false }, tenantId);

    console.log(`✅ Item removido`);
    return { ok: true };
  }

  // ───────────────────────────────────────────────────────────────────────
  // CONFIRMAR COTAÇÃO AUTOMÁTICA (Muda de rascunho para pendente)
  // ───────────────────────────────────────────────────────────────────────
  async confirmarCotacao(tenantId, cotacaoId, usuarioId = null) {
    console.log(`✓ [CotacaoService] Confirmando cotação ${cotacaoId}`);

    // Validar cotação existe
    const cotacao = await this.db.selectOne('cotacoes', { id: cotacaoId }, tenantId);
    if (!cotacao) throw new Error(`Cotação não encontrada`);

    // Validar que tem itens
    const itens = await this.db.select('cotacao_itens', { cotacao_id: cotacaoId });
    if (itens.length === 0) throw new Error(`Cotação não tem itens`);

    // Coletar fornecedores únicos dos itens
    const fornecedoresUnicos = new Set();
    for (const item of itens) {
      const fornecedores = await this.buscarFornecedoresPorItem(tenantId, item.item_catalogo_id);
      fornecedores.forEach(f => fornecedoresUnicos.add(f.fornecedorId));
    }

    // Adicionar fornecedores à cotação
    for (const fornecedorId of fornecedoresUnicos) {
      const existe = await this.db.selectOne('cotacao_fornecedores', {
        cotacao_id: cotacaoId,
        fornecedor_id: fornecedorId
      }, tenantId);

      if (!existe) {
        const token = this.gerarTokenFornecedor(cotacaoId, fornecedorId);
        await this.db.insert('cotacao_fornecedores', {
          tenant_id: tenantId,
          cotacao_id: cotacaoId,
          fornecedor_id: fornecedorId,
          status: 'pendente',
          token_acesso: token
        });
      }
    }

    // Mudar status de rascunho para pendente
    await this.db.update('cotacoes', cotacaoId, {
      status: 'pendente',
      confirmado_em: new Date(),
      confirmado_por: usuarioId
    }, tenantId);

    console.log(`✅ Cotação confirmada`);

    return {
      cotacaoId: cotacaoId,
      status: 'pendente',
      fornecedores: fornecedoresUnicos.size,
      itens: itens.length
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // BUSCAR CHAMADO COM ITENS AGRUPADOS POR CATEGORIA + TOP 3 FORNECEDORES
  // ───────────────────────────────────────────────────────────────────────
  async buscarPorChamadoComFornecedores(tenantId, chamadoId) {

    // 1. Buscar chamado
    const chamado = await this.db.selectOne('chamados', { id: chamadoId }, tenantId);
    if (!chamado) {
      throw new Error(`Chamado ${chamadoId} não encontrado`);
    }

    // 2. Buscar itens do chamado
    const itens = await this.db.select('chamado_itens', { chamado_id: chamadoId }, tenantId);
    if (!itens || itens.length === 0) {
      throw new Error(`Chamado ${chamadoId} não tem itens`);
    }

    // 3. Buscar catálogo para obter informações de categoria
    const todosCatalogo = await this.db.select('catalogo_itens', { ativo: true }, tenantId);

    // 4. Mapear itens com informações do catálogo
    const itensComInfo = itens.map(item => {
      const catalogoItem = todosCatalogo.find(c => c.id === item.item_catalogo_id);
      
      return {
        id: item.id,
        nome: item.item_nome || catalogoItem?.nome || 'Item sem nome',
        categoria: item.categoria || catalogoItem?.categoria || 'Sem categoria',
        codigo: item.codigo || catalogoItem?.codigo || '',
        quantidade: item.quantidade || 1,
        urgencia: item.urgencia || 'média',
        item_catalogo_id: item.item_catalogo_id,
        tipo_item: item.tipo_item || 'padrão'
      };
    });

    // 5. Agrupar por categoria
    const itensPorCategoria = itensComInfo.reduce((acc, item) => {
      // Buscar categoria do catálogo
      const catalogoItem = todosCatalogo.find(c => c.id === item.item_catalogo_id);
      const categoriaCatalogo = catalogoItem?.categoria || 'Sem categoria';
      
      if (!acc[categoriaCatalogo]) {
        acc[categoriaCatalogo] = [];
      }
      
      acc[categoriaCatalogo].push({
        ...item,
        categoria_catalogo: categoriaCatalogo  // 🆕 Guardar a categoria do catálogo
      });
      return acc;
    }, {});

    // 6. Para cada item, buscar top 3 fornecedores mais baratos
    const resultado = {};

    for (const [categoria, itensCategoria] of Object.entries(itensPorCategoria)) {
      resultado[categoria] = [];

      for (const item of itensCategoria) {

        // 1. Tenta buscar fornecedores diretos (pelo item_catalogo_id)
        const { data: diretos, error: errDir } = await supabase
        .from('fornecedor_itens')
        .select(`
          fornecedor_id,
          preco_unitario,
          data_tabela,
          estoque_status,
          tempo_entrega_dias,
          quantidade_minima,
          fornecedores!inner (
            id,
            nome,
            email,
            tipo,
            tenant_id
          )
        `)
        .eq('item_catalogo_id', item.item_catalogo_id)
        .eq('ativo', true)
        .eq('fornecedores.ativo', true)
        .or(`fornecedores.tipo.eq.global,fornecedores.tenant_id.eq.${tenantId}`)
        .order('preco_unitario', { ascending: true })
        .limit(5);

        let fornecedores = [];
        if (!errDir && diretos && diretos.length > 0) {
          // Buscar nomes/emails dos fornecedores
          const fornecedorIds = diretos.map(f => f.fornecedor_id);
          const { data: fornecedoresData } = await supabase
            .from('fornecedores')
            .select('id, nome, email')
            .in('id', fornecedorIds)
            .eq('tenant_id', tenantId);

          fornecedores = diretos.map(fi => {
            const f = fornecedoresData?.find(forn => forn.id === fi.fornecedor_id);
            return {
              fornecedor_id: fi.fornecedor_id,
              fornecedor_nome: f?.nome || null,
              fornecedor_email: f?.email || null,
              preco_unitario: fi.preco_unitario,
              data_tabela: fi.data_tabela,
              estoque_status: fi.estoque_status,
              tempo_entrega_dias: fi.tempo_entrega_dias,
              quantidade_minima: fi.quantidade_minima
            };
          });
        }

        // 2. Se não encontrou direto, fallback por CATEGORIA
        if (!fornecedores || fornecedores.length === 0) {

          // Buscar categoria do item no catálogo
          const catalogoItem = await this.db.selectOne('catalogo_itens', 
            { id: item.item_catalogo_id, ativo: true }, 
            tenantId
          );

          if (catalogoItem && catalogoItem.categoria) {
            const categoria = catalogoItem.categoria.trim();

            // Buscar todos os IDs de itens do catálogo com essa categoria
            const { data: itensCatalogo, error: errCat } = await supabase
              .from('catalogo_itens')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('ativo', true)
              .ilike('categoria', categoria); // ou .eq se for exato

            if (!errCat && itensCatalogo && itensCatalogo.length > 0) {
              const idsItens = itensCatalogo.map(item => item.id);

              // Buscar fornecedor_itens para esses itens
              const { data: fornecedorItens, error: errFI } = await supabase
                .from('fornecedor_itens')
                .select(`
                  fornecedor_id,
                  preco_unitario,
                  data_tabela,
                  estoque_status,
                  tempo_entrega_dias,
                  quantidade_minima,
                  fornecedores!inner (
                    id,
                    nome,
                    email,
                    tipo,
                    tenant_id
                  )
                `)
                .eq('ativo', true)
                .in('item_catalogo_id', idsItens)
                .eq('fornecedores.ativo', true)
                .or(`fornecedores.tipo.eq.global,fornecedores.tenant_id.eq.${tenantId}`)
                .order('preco_unitario', { ascending: true })
                .limit(5);

              if (!errFI && fornecedorItens && fornecedorItens.length > 0) {
                const fornecedorIds = fornecedorItens.map(f => f.fornecedor_id);
                const { data: fornecedoresData } = await supabase
                  .from('fornecedores')
                  .select('id, nome, email')
                  .in('id', fornecedorIds)
                  .eq('tenant_id', tenantId);

                fornecedores = fornecedorItens.map(fi => {
                  const f = fornecedoresData?.find(forn => forn.id === fi.fornecedor_id);
                  return {
                    fornecedor_id: fi.fornecedor_id,
                    fornecedor_nome: f?.nome || null,
                    fornecedor_email: f?.email || null,
                    preco_unitario: fi.preco_unitario,
                    data_tabela: fi.data_tabela,
                    estoque_status: fi.estoque_status,
                    tempo_entrega_dias: fi.tempo_entrega_dias,
                    quantidade_minima: fi.quantidade_minima
                  };
                });
              }
            }
          } else {
            console.log(`❌ Item ${item.item_catalogo_id} não encontrado no catálogo ou sem categoria.`);
          }
        }

        // Formatar para o resultado final (já está no formato esperado)
        const fornecedoresFormatados = (fornecedores || []).map(f => ({
          fornecedor_id: f.fornecedor_id,
          nome: f.fornecedor_nome || 'Fornecedor não encontrado',
          email: f.fornecedor_email || '',
          preco: parseFloat(f.preco_unitario) || 0,
          data_tabela: f.data_tabela,
          estoque: f.estoque_status || 'desconhecido',
          prazo: f.tempo_entrega_dias || 0,
          quantidade_minima: f.quantidade_minima || 1,
          tipo: f.tipo || 'local'
        }));

        resultado[categoria].push({
          ...item,
          fornecedores: fornecedoresFormatados
        });
      }
    }

    console.log(`✅ Cotação preparada com ${Object.keys(resultado).length} categorias`);

    return {
      chamado: {
        id: chamado.id,
        numero: chamado.numero || `CHA-${chamado.id}`,
        equipamento_id: chamado.equipamento_id,
        descricao_geral: chamado.descricao_geral,
        urgencia: chamado.urgencia_geral,
        status: chamado.status,
        criado_em: chamado.criado_em
      },
      itensPorCategoria: resultado,
      totalItens: itens.length,
      totalCategorias: Object.keys(resultado).length
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // SALVAR COTAÇÃO EM RASCUNHO
  // ───────────────────────────────────────────────────────────────────────
  async salvarCotacao(tenantId, dados) {
    console.log(`💾 [CotacaoService] Salvando cotação`);

    const { chamado_id, itens, notas } = dados;

    if (!chamado_id || !itens || itens.length === 0) {
      throw new Error('Dados inválidos: chamado_id e itens são obrigatórios');
    }

    // ✅ VERIFICA SE JÁ EXISTE UMA COTAÇÃO ATIVA PARA ESTE CHAMADO
    const existente = await this.db.selectOne('cotacoes', {
      chamado_id: chamado_id,
      status: ['rascunho', 'pendente', 'enviada']
    }, tenantId);

    if (existente) {
      throw new Error(`Já existe uma cotação em andamento (${existente.status}) para este chamado.`);
    }

    const cotacao = await this.db.insert('cotacoes', {
      tenant_id: tenantId,
      chamado_id: chamado_id,
      status: 'rascunho',
      modo: 'automatica',
      notas: notas || null
    });

    console.log(`✅ Cotação criada: ${cotacao.id}`);

    for (const item of itens) {
      const chamadoItem = await this.db.selectOne('chamado_itens', 
        { id: item.item_id }, 
        tenantId
      );

      const itemCatalogoId = chamadoItem?.item_catalogo_id || null;
      const quantidade = chamadoItem?.quantidade || 1;

      await this.db.insert('cotacao_itens', {
        tenant_id: tenantId,
        cotacao_id: cotacao.id,
        chamado_item_id: item.item_id,
        item_catalogo_id: itemCatalogoId,
        quantidade: quantidade,
        preco_estimado: null,
        fornecedores_ids: item.fornecedor_ids || []
      });
    }

    console.log(`✅ ${itens.length} itens salvos`);

    return {
      cotacao_id: cotacao.id,
      status: 'rascunho',
      itens: itens.length,
      mensagem: 'Cotação salva com sucesso'
    };
  }

  // ─── ATUALIZAR COTAÇÃO (editar fornecedores) ─────────────────
  async atualizarCotacao(tenantId, cotacaoId, dados) {
    console.log(`✏️ [CotacaoService] Atualizando cotação ${cotacaoId}`);

    const { itens, notas } = dados;

    const cotacao = await this.db.selectOne('cotacoes', { id: cotacaoId }, tenantId);
    if (!cotacao) throw new Error('Cotação não encontrada');

    if (cotacao.status !== 'rascunho') {
      throw new Error('Apenas cotações em rascunho podem ser editadas');
    }

    if (notas !== undefined) {
      await this.db.update('cotacoes', cotacaoId, { notas: notas }, tenantId);
    }

    // Remove itens antigos (ou atualiza)
    await this.db.delete('cotacao_itens', { cotacao_id: cotacaoId }, tenantId);

    // Adiciona novos itens com fornecedores_ids
    for (const item of itens) {
      await this.db.insert('cotacao_itens', {
        tenant_id: tenantId,
        cotacao_id: cotacaoId,
        chamado_item_id: item.item_id,
        item_catalogo_id: null,
        quantidade: 1,
        preco_estimado: null,
        fornecedores_ids: item.fornecedor_ids || []
      });
    }

    return {
      cotacao_id: cotacaoId,
      status: 'rascunho',
      mensagem: 'Cotação atualizada com sucesso'
    };
  }

  // ─── EXCLUIR COTAÇÃO (soft delete) ──────────────────────────
  async excluirCotacao(tenantId, cotacaoId) {
    console.log(`🗑️ [CotacaoService] Excluindo permanentemente cotação ${cotacaoId}`);

    // Verifica se a cotação existe
    const cotacao = await this.db.selectOne('cotacoes', { id: cotacaoId }, tenantId);
    if (!cotacao) throw new Error('Cotação não encontrada');

    // 1. Exclui itens da cotação
    const { error: errItens } = await supabase
      .from('cotacao_itens')
      .delete()
      .eq('cotacao_id', cotacaoId)
      .eq('tenant_id', tenantId);
    if (errItens) throw new Error(`Erro ao excluir itens: ${errItens.message}`);

    // 2. Exclui fornecedores da cotação
    const { error: errForn } = await supabase
      .from('cotacao_fornecedores')
      .delete()
      .eq('cotacao_id', cotacaoId)
      .eq('tenant_id', tenantId);
    if (errForn) throw new Error(`Erro ao excluir fornecedores: ${errForn.message}`);

    // 3. Exclui a cotação
    await this.db.delete('cotacoes', cotacaoId, tenantId);

    console.log(`✅ Cotação ${cotacaoId} excluída permanentemente`);
    return { ok: true };
  }

  // ───────────────────────────────────────────────────────────────────────
  // CRIAR ORDEM DE VENDA COM TODOS OS ITENS DO FORNECEDOR
  // ───────────────────────────────────────────────────────────────────────
  async criarOrdenVenda(tenantId, cotacaoId, fornecedorId) {
    console.log(`📦 [CotacaoService] Criando OV para cotação ${cotacaoId}, fornecedor ${fornecedorId}`);

    try {
      // 1. Buscar cotação
      const cotacao = await this.db.selectOne('cotacoes', { id: cotacaoId }, tenantId);
      if (!cotacao) {
        throw new Error(`Cotação ${cotacaoId} não encontrada`);
      }

      // 2. Buscar resposta do fornecedor
      const resposta = await this.db.selectOne('cotacao_fornecedores', {
        cotacao_id: cotacaoId,
        fornecedor_id: fornecedorId
      }, tenantId);

      if (!resposta) {
        throw new Error(`Fornecedor ${fornecedorId} não encontrado na cotação`);
      }

      if (resposta.status !== 'respondido') {
        throw new Error(`Fornecedor ainda não respondeu esta cotação`);
      }

      // 3. Buscar detalhes da resposta
      const respostaDetalhes = await this.db.selectOne('cotacao_fornecedores', {
        cotacao_id: cotacaoId,
        fornecedor_id: fornecedorId
      }, tenantId);

      console.log(`💰 Resposta do fornecedor:`, respostaDetalhes);

      // 4. Buscar itens da cotação
      const itensSimples = await this.db.raw(`
        SELECT 
          ci.id,
          ci.quantidade,
          COALESCE(ch.item_nome, 'Item sem nome') as nome_item
        FROM cotacao_itens ci
        LEFT JOIN chamado_itens ch ON ch.id = ci.chamado_item_id
        WHERE ci.cotacao_id = $1
          AND ci.fornecedores_ids @> ARRAY[$2]::bigint[]
      `, [cotacaoId, fornecedorId]);

      const itens = itensSimples.map(item => ({
        id: item.id,
        quantidade: item.quantidade,
        valor_unitario: respostaDetalhes.valor,
        valor_total: item.quantidade * respostaDetalhes.valor,
        nome_item: item.nome_item
      }));

      console.log(`📋 Itens processados:`, itens);

      if (!itens || itens.length === 0) {
        throw new Error(`Nenhum item associado a este fornecedor nesta cotação`);
      }

      console.log(`📋 ${itens.length} itens encontrados para este fornecedor`);

      // 5. Calcular valor total
      const valorTotal = itens.reduce((sum, item) => {
        return sum + (parseFloat(item.valor_total) || 0);
      }, 0);

      console.log(`💰 Valor total: R$ ${valorTotal.toFixed(2)}`);

      // 6. Gerar número único para OV
      const numeroOV = await this.gerarNumeroOrdenVenda(tenantId);

      // 7. Criar ordem de venda
      const ordemVenda = await this.db.insert('ordens_venda', {
        tenant_id: tenantId,
        cotacao_id: cotacaoId,
        fornecedor_id: fornecedorId,
        numero: numeroOV,
        status: 'pendente',
        valor_total: valorTotal,
        valor_frete: resposta.valor_frete || 0,
        prazo_entrega: resposta.prazo,
        criado_em: new Date(),
        criado_por: usuarioId
      });

      console.log(`✅ OV criada: ${numeroOV} (ID: ${ordemVenda.id})`);

      // 8. Criar itens da OV
      for (const item of itens) {
        await this.db.insert('ordem_venda_itens', {
          tenant_id: tenantId,
          ordem_venda_id: ordemVenda.id,
          cotacao_item_id: item.id,
          chamado_item_id: item.chamado_item_id,
          item_catalogo_id: item.item_catalogo_id,
          nome_item: item.nome_item,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          valor_total: item.valor_total,
          criado_em: new Date()
        });
      }

      console.log(`✅ ${itens.length} itens adicionados à OV`);

      // 🔥 9. ENVIAR E-MAIL DE CONFIRMAÇÃO DA OV PARA O FORNECEDOR
      try {
        const { enviarEmailCotacao } = require('./emailService');
        const fornecedor = await this.db.selectOne('fornecedores', { id: fornecedorId }, tenantId);
        const empresa = await this.db.selectOne('tenants', { id: tenantId });
        const cotacao = await this.db.selectOne('cotacoes', { id: cotacaoId }, tenantId);

        if (fornecedor?.email) {
          const assunto = `Ordem de Venda ${numeroOV} - Quotaflow`;
          const listaItens = itens.map(i => 
            `<li>${i.nome_item || 'Item'} - Qtd: ${i.quantidade} - Valor: R$ ${i.valor_unitario.toFixed(2)}</li>`
          ).join('');

          const corpo = `
            <h2>Ordem de Venda #${numeroOV}</h2>
            <p>Prezado(a) ${fornecedor.nome},</p>
            <p>Confirmamos a emissão da Ordem de Venda para os itens abaixo:</p>
            <ul>${listaItens}</ul>
            <p><strong>Valor Total:</strong> R$ ${valorTotal.toFixed(2)}</p>
            <p><strong>Prazo de Entrega:</strong> ${resposta.prazo} dias</p>
            <p>Em breve o comprador entrará em contato para os próximos passos.</p>
            <p>Agradecemos pela parceria!</p>
            <hr>
            <p><small>Esta é uma mensagem automática. Não responda este e-mail.</small></p>
          `;

          await enviarEmailCotacao(fornecedor.email, assunto, corpo);
          console.log(`✅ E-mail de OV enviado para ${fornecedor.email}`);
        } else {
          console.warn(`⚠️ Fornecedor ${fornecedorId} sem e-mail cadastrado, não foi possível enviar OV.`);
        }
      } catch (err) {
        console.error('❌ Falha ao enviar e-mail de OV:', err.message);
        // Não interrompe o fluxo – a OV já foi criada
      }

      // 10. Atualizar status da cotação para 'finalizada'
      await this.db.update('cotacoes', cotacaoId, {
        status: 'finalizada',
        finalizado_em: new Date()
      }, tenantId);

      // 11. Atualizar status do chamado para 'finalizado'
      const chamado = await this.db.selectOne('chamados', { id: cotacao.chamado_id }, tenantId);
      if (chamado) {
        await this.db.update('chamados', chamado.id, {
          status: 'finalizado',
          finalizado_em: new Date()
        }, tenantId);
        console.log(`✅ Chamado ${chamado.numero} finalizado`);
      }

      return {
        ordem_venda_id: ordemVenda.id,
        numero: numeroOV,
        status: 'pendente',
        fornecedor_id: fornecedorId,
        valor_total: valorTotal,
        prazo_entrega: resposta.prazo,
        quantidade_itens: itens.length,
        itens: itens.map(item => ({
          id: item.id,
          nome: item.nome_item,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          valor_total: item.valor_total
        })),
        mensagem: `Ordem de Venda criada com sucesso para ${itens.length} item(ns)`
      };

    } catch (err) {
      console.error(`❌ Erro ao criar OV:`, err.message);
      throw err;
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // GERAR NÚMERO ÚNICO PARA ORDEM DE VENDA
  // ───────────────────────────────────────────────────────────────────────
  async gerarNumeroOrdenVenda(tenantId) {
    const ano = new Date().getFullYear();
    const mes = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `OV-${ano}${mes}-`;

    const resultado = await this.db.raw(`
      SELECT numero FROM ordens_venda
      WHERE tenant_id = $1 AND numero LIKE $2
      ORDER BY numero DESC
      LIMIT 1
    `, [tenantId, `${prefix}%`]);

    let seq = 1;
    if (resultado.length > 0) {
      const match = resultado[0].numero.match(/(\d+)$/);
      if (match) {
        seq = parseInt(match[1]) + 1;
      }
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  // ───────────────────────────────────────────────────────────────────────
  // OBTER STATUS COMPLETO DE UMA COTAÇÃO
  // ───────────────────────────────────────────────────────────────────────
  async obterStatusCotacao(tenantId, cotacaoId) {
    console.log(`🔍 [CotacaoService] Obtendo status da cotação ${cotacaoId}`);

    try {
      // Buscar cotação
      const cotacao = await this.db.selectOne('cotacoes', { id: cotacaoId }, tenantId);
      if (!cotacao) {
        throw new Error(`Cotação ${cotacaoId} não encontrada`);
      }

      // Buscar respostas dos fornecedores
      const fornecedores = await this.db.raw(`
        SELECT 
          id,
          fornecedor_id,
          fornecedor_nome,
          fornecedor_email,
          status,
          valor,
          prazo,
          valor_frete,
          data_resposta
        FROM cotacao_fornecedores
        WHERE cotacao_id = $1 AND tenant_id = $2
        ORDER BY valor ASC
      `, [cotacaoId, tenantId]);

      // Contar respondidos vs pendentes
      const respondidos = fornecedores.filter(f => f.status === 'respondido');
      const pendentes = fornecedores.filter(f => f.status === 'pendente');

      // Encontrar melhor proposta (menor preço)
      const melhorProposta = respondidos.length > 0 ? respondidos[0] : null;

      // Buscar OV se existir
      const ordemVenda = await this.db.selectOne('ordens_venda', {
        cotacao_id: cotacaoId
      }, tenantId);

      return {
        cotacao: {
          id: cotacao.id,
          numero: cotacao.numero,
          status: cotacao.status,
          modo: cotacao.modo,
          criado_em: cotacao.criado_em,
          enviado_em: cotacao.enviado_em,
          finalizado_em: cotacao.finalizado_em
        },
        fornecedores: {
          total: fornecedores.length,
          respondidos: respondidos.length,
          pendentes: pendentes.length,
          respostas: fornecedores
        },
        melhorProposta: melhorProposta ? {
          fornecedor_id: melhorProposta.fornecedor_id,
          fornecedor_nome: melhorProposta.fornecedor_nome,
          valor: melhorProposta.valor,
          prazo: melhorProposta.prazo,
          data_resposta: melhorProposta.data_resposta
        } : null,
        ordemVenda: ordemVenda ? {
          id: ordemVenda.id,
          numero: ordemVenda.numero,
          status: ordemVenda.status,
          criado_em: ordemVenda.criado_em
        } : null
      };

    } catch (err) {
      console.error(`❌ Erro ao obter status:`, err.message);
      throw err;
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // ATUALIZAR RESPOSTA MANUAL DE UM FORNECEDOR
  // ───────────────────────────────────────────────────────────────────────
  async atualizarRespostaFornecedor(tenantId, cotacaoId, fornecedorId, dados) {
    console.log(`📝 [CotacaoService] Atualizando resposta do fornecedor ${fornecedorId}`);

    try {
      // 1. Buscar resposta atual
      const atual = await this.db.selectOne('cotacao_fornecedores', {
        cotacao_id: cotacaoId,
        fornecedor_id: fornecedorId
      }, tenantId);

      if (!atual) {
        throw new Error(`Fornecedor ${fornecedorId} não encontrado nesta cotação`);
      }

      // 2. Atualizar
      const atualizado = await this.db.update('cotacao_fornecedores', atual.id, {
        valor: dados.valor || atual.valor,
        prazo: dados.prazo || atual.prazo,
        valor_frete: dados.valor_frete !== undefined ? dados.valor_frete : atual.valor_frete,
        obs: dados.obs || atual.obs,
        status: 'respondido',
        data_resposta: dados.data_resposta || new Date()
      }, tenantId);

      console.log(`✅ Resposta atualizada`);

      return {
        fornecedor_id: fornecedorId,
        valor: dados.valor,
        prazo: dados.prazo,
        valor_frete: dados.valor_frete,
        obs: dados.obs
      };

    } catch (err) {
      console.error(`❌ Erro ao atualizar resposta:`, err.message);
      throw err;
    }
  }

}

module.exports = CotacaoService;