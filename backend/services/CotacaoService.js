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

    // 1. BUSCAR ITENS DO CHAMADO
    const itensRaw = await this.db.select('chamado_itens', { chamado_id: chamadoId });

    if (itensRaw.length === 0) {
      throw new Error('Chamado não tem itens');
    }

    // 2. ENRIQUECER ITENS COM INFORMAÇÕES DO CATÁLOGO
    const itens = await Promise.all(
      itensRaw.map(async (item) => {
        // Tentar encontrar item no catálogo
        // FIX (2026-09): db.raw caía no fallback (ignorava ILIKE e LIMIT).
        // Trocado por select + filtro em JS com match parcial.
        const todosCatalogoAtu = await this.db.select('catalogo_itens',
          { tenant_id: tenantId, ativo: true }, tenantId);
        const termo = (item.item_nome || '').toLowerCase();
        const match = todosCatalogoAtu.find(c =>
          (c.nome || '').toLowerCase().includes(termo)
        );
        const catalogoItem = match ? [match] : [];

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

    // 3. AGRUPAR POR CATEGORIA
    const itensPorCategoria = this.agruparPorCategoria(itens);

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

    // Gerar número único para cotação — mesmo padrão COT-{ano}-000X
    const numeroCotacao = await this.gerarNumeroCotacao(tenantId);

    // Criar cotação
    const cotacao = await this.db.insert('cotacoes', {
      tenant_id: tenantId,
      chamado_id: chamadoId,
      numero: numeroCotacao,
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
    // FIX (2026-09): db.raw caía no fallback genérico (ignorava WHERE), e a
    // query montada por concatenação também tinha o bug do `if (modelo)`
    // aninhado em `if (marca)` — só aplicava modelo quando marca vinha junto.
    // Reescrito com db.select + filtro em JS. Também corrigido o `if` aninhado.

    // 1. Buscar todos os itens de fornecedor ativos do tenant
    const todosItens = await this.db.select('fornecedor_itens',
      { tenant_id: tenantId, ativo: true }, tenantId);

    // 2. Buscar todos os fornecedores ativos
    const todosForns = await this.db.select('fornecedores',
      { tenant_id: tenantId, ativo: true }, tenantId);
    const fornsPorId = {};
    todosForns.forEach(f => { fornsPorId[f.id] = f; });

    // 3. Buscar todo o catálogo do tenant
    const todoCatalogo = await this.db.select('catalogo_itens',
      { tenant_id: tenantId }, tenantId);
    const catalogoPorId = {};
    todoCatalogo.forEach(c => { catalogoPorId[c.id] = c; });

    // 4. Cruzar + filtrar
    const resultados = todosItens
      .map(fi => {
        const cat = catalogoPorId[fi.item_catalogo_id];
        if (!cat) return null;

        // Categoria é obrigatória (WHERE original tinha `c.categoria = $1`)
        if (cat.categoria !== categoria) return null;

        // Filtros opcionais — respeitam o padrão `campo = valor OR campo IS NULL`
        // do SQL original (só rejeitam quando AMBOS existem e são diferentes)
        if (marca && cat.marca && cat.marca !== marca) return null;
        if (modelo && cat.modelo && cat.modelo !== modelo) return null;
        if (tipoFabricante && cat.tipo_fabricante && cat.tipo_fabricante !== tipoFabricante) return null;

        // Fornecedor precisa existir e ser ativo
        const f = fornsPorId[fi.fornecedor_id];
        if (!f) return null;

        // Regra: fornecedor global OU do próprio tenant
        if (f.tipo !== 'global' && f.tenant_id !== tenantId) return null;

        return {
          fornecedor_item_id: fi.id,
          fornecedor_id: fi.fornecedor_id,
          fornecedor_nome: f.nome,
          fornecedor_email: f.email,
          preco_unitario: fi.preco_unitario,
          descricao_fornecedor: fi.descricao_fornecedor,
          data_tabela: fi.data_tabela,
          marca: cat.marca,
          modelo: cat.modelo,
          tipo_fabricante: cat.tipo_fabricante,
          tipo: f.tipo,
          fornecedor_tenant_id: f.tenant_id,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (parseFloat(a.preco_unitario) || 0) - (parseFloat(b.preco_unitario) || 0))
      .slice(0, 10); // LIMIT 10 do SQL original

    return resultados;
  }

  // ───────────────────────────────────────────────────────────────────────
  // 4. LISTAR COTAÇÕES DO TENANT
  // ───────────────────────────────────────────────────────────────────────
  async listar(tenantId, filtros = {}) {
    const { status = null, chamado_id = null, limite = 50, pagina = 1 } = filtros;

    // FIX (2026-09): reescrito sem db.raw — o wrapper ignorava os filtros
    // além de tenant_id. Agora monta tudo com db.select + agregação em JS.
    let cotacoes = await this.db.select('cotacoes', { tenant_id: tenantId }, tenantId);
    if (status) cotacoes = cotacoes.filter(c => c.status === status);
    if (chamado_id) cotacoes = cotacoes.filter(c => String(c.chamado_id) === String(chamado_id));

    cotacoes.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
    cotacoes = cotacoes.slice((pagina - 1) * limite, pagina * limite);

    // Enriquece com contagens
    const ids = cotacoes.map(c => c.id);
    const todosItens = ids.length > 0
      ? await this.db.select('cotacao_itens', { tenant_id: tenantId }, tenantId)
      : [];
    const todosFornecedores = ids.length > 0
      ? await this.db.select('cotacao_fornecedores', { tenant_id: tenantId }, tenantId)
      : [];

    return cotacoes.map(c => ({
      ...c,
      numero_cotacao: c.numero || c.numero_cotacao,
      total_itens: todosItens.filter(i => i.cotacao_id === c.id).length,
      total_fornecedores: todosFornecedores.filter(f => f.cotacao_id === c.id).length,
    }));
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
  async enviarCotacao(tenantId, cotacaoId, dados = {}) {
    const cotacao = await this.db.selectOne('cotacoes', { id: cotacaoId }, tenantId);
    const { origem_ov_numero } = dados;
    if (!cotacao) throw new Error(`Cotação ${cotacaoId} não encontrada`);

    const chamado = await this.db.selectOne('chamados', { id: cotacao.chamado_id }, tenantId);

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

    // 🔥 BUSCAR FORNECEDORES (ele ainda pode usar fornecedorIds, mas agora está dentro de dados)
    let fornecedores = await this.db.select('cotacao_fornecedores', {
      cotacao_id: cotacaoId,
      status: 'pendente'
    }, tenantId);

    if (dados.fornecedorIds && dados.fornecedorIds.length > 0) {
      fornecedores = fornecedores.filter(f => dados.fornecedorIds.includes(f.fornecedor_id));
    }

    if (fornecedores.length === 0) {
      throw new Error(`Nenhum fornecedor para enviar a cotação ${cotacaoId}`);
    }

    const fornecedorIdsArray = fornecedores.map(f => f.fornecedor_id);
    // FIX (2026-09): db.raw ignorava o ANY($2), devolvia todos os fornecedores.
    const todosFornecedores = await this.db.select('fornecedores', { tenant_id: tenantId }, tenantId);
    const fornecedoresData = todosFornecedores.filter(f => fornecedorIdsArray.includes(f.id));

    const fornecedorMap = {};
    fornecedoresData.forEach(f => { fornecedorMap[f.id] = f; });

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/^FRONTEND_URL=/, '');

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

    // ✅ BUSCAR COMPRADOR
    const comprador = await this.db.selectOne('usuarios', { id: cotacao.criado_por }, tenantId);
      
    // ✅ MONTAR ASSUNTO E RODAPÉ
    // FIX (2026-09): `numero_cotacao` não existe no objeto — o campo é
    // `numero`. O email saía com "Solicitação de Cotação: undefined" no
    // corpo (o subject usava `numero` e por isso parecia funcionar).
    const assunto = `Solicitação de Cotação - ${cotacao.numero}`;   
    
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
          <h2>Solicitação de Cotação: ${cotacao.numero}</h2>
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
      enviado_em: new Date(),
      origem_ov_numero: origem_ov_numero || null
    }, tenantId);

    // FIX (2026-09): enviarCotacao só setava `status: 'cotando'` — não
    // gravava `bloqueado_em`, então a trava de edição de RC cotada não
    // pegava. Alinhado com o POST /cotacoes (routes) que já grava os dois.
    await this.db.update('chamados', chamado.id, {
      status: 'cotando',
      bloqueado_em: new Date(),
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
    return `${cotacaoId}-FOR-${fornecedorId}-${timestamp}-${random}`;
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
    const numeroCotacao = await this.gerarNumeroCotacao(tenantId);
    const cotacao = await this.db.insert('cotacoes', {
      tenant_id: tenantId,
      chamado_id: chamadoId,
      numero: numeroCotacao,
      status: 'rascunho',
      modo: 'automatica',
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
    // FIX (2026-09): db.raw caía no fallback (ignorava WHERE item_catalogo_id),
    // retornando TODOS os fornecedor_itens do tenant. Trocado por select +
    // filtro em JS.
    const todosItens = await this.db.select('fornecedor_itens',
      { tenant_id: tenantId, ativo: true }, tenantId);
    const itensDoItem = todosItens.filter(fi => String(fi.item_catalogo_id) === String(itemCatalogoId));

    const todosFornecedores = await this.db.select('fornecedores',
      { tenant_id: tenantId, ativo: true }, tenantId);
    const fornecedoresPorId = {};
    todosFornecedores.forEach(f => { fornecedoresPorId[f.id] = f; });

    const fornecedores = itensDoItem
      .map(fi => {
        const f = fornecedoresPorId[fi.fornecedor_id];
        if (!f) return null;
        // Regra: fornecedor global OU do próprio tenant
        if (f.tipo !== 'global' && f.tenant_id !== tenantId) return null;
        return {
          fornecedor_item_id: fi.id,
          fornecedor_id: fi.fornecedor_id,
          fornecedor_nome: f.nome,
          fornecedor_email: f.email,
          preco_unitario: fi.preco_unitario,
          estoque_status: fi.estoque_status,
          tempo_entrega_dias: fi.tempo_entrega_dias,
          tipo: f.tipo,
          fornecedor_tenant_id: f.tenant_id,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (parseFloat(a.preco_unitario) || 0) - (parseFloat(b.preco_unitario) || 0));

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

    // ✅ Delete físico com tenantId no terceiro parâmetro
    await this.db.delete('cotacao_itens', cotacaoItemId, tenantId);

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
    const todosOsItens = await this.db.select('chamado_itens', { chamado_id: chamadoId }, tenantId);
    const itens = (todosOsItens || []).filter(item => item.tipo !== 'servico');
    if (!itens || itens.length === 0) {
      throw new Error(`Chamado ${chamadoId} não tem itens de material para cotação`);
    }

    // 3. Buscar catálogo para obter informações de categoria
    const todosCatalogo = await this.db.select('catalogo_itens', { ativo: 1 }, tenantId); // 🔥 MUDE PARA 1

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
      const catalogoItem = todosCatalogo.find(c => c.id === item.item_catalogo_id);
      const categoriaCatalogo = catalogoItem?.categoria || 'Sem categoria';
      
      if (!acc[categoriaCatalogo]) {
        acc[categoriaCatalogo] = [];
      }
      
      acc[categoriaCatalogo].push({
        ...item,
        categoria_catalogo: categoriaCatalogo
      });
      return acc;
    }, {});

    // 6. Para cada item, buscar fornecedores (APENAS DIRETOS, UM A UM)
    const resultado = {};

    for (const [categoria, itensCategoria] of Object.entries(itensPorCategoria)) {
      resultado[categoria] = [];

      for (const item of itensCategoria) {

        // FIX (2026-09): item sem vínculo de catálogo (item_catalogo_id null)
        // não tem fornecedores mapeáveis. Antes, o DB.select do wrapper
        // ignorava filtros com valor null, e a query virava "WHERE tenant_id
        // AND ativo = 1" — devolvia o catálogo INTEIRO do tenant. Agora
        // pulamos a busca quando não há catálogo vinculado, retornando
        // array vazio + flag `sem_catalogo` pra UI mostrar aviso.
        let fornecedorItens = [];
        if (item.item_catalogo_id != null) {
          fornecedorItens = await this.db.select('fornecedor_itens', {
            item_catalogo_id: item.item_catalogo_id,
            ativo: 1
          }, tenantId);
        }

        let fornecedores = [];

        if (fornecedorItens && fornecedorItens.length > 0) {
          // 2. Buscar FORNECEDORES UM A UM (para evitar erro de array)
          for (const fi of fornecedorItens) {
            const fornecedor = await this.db.selectOne('fornecedores', { 
              id: fi.fornecedor_id, 
              ativo: 1 // 🔥 MUDE PARA 1
            }, tenantId);

            fornecedores.push({
              fornecedor_id: fi.fornecedor_id,
              fornecedor_nome: fornecedor?.nome || 'Fornecedor não encontrado',
              fornecedor_email: fornecedor?.email || null,
              preco_unitario: fi.preco_unitario,
              data_tabela: fi.data_tabela,
              estoque_status: fi.estoque_status,
              tempo_entrega_dias: fi.tempo_entrega_dias,
              quantidade_minima: fi.quantidade_minima,
              tipo: fornecedor?.tipo || 'local'
            });
          }
        }

        // 7. Formatar fornecedores
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

        // Adicionar o item ao resultado
        resultado[categoria].push({
          ...item,
          fornecedores,
          sem_catalogo: item.item_catalogo_id == null,
        });
      }
    }

    // 8. RETORNO FINAL
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

    const { chamado_id, itens, notas, origem_ov_numero } = dados;

    if (!chamado_id || !itens || itens.length === 0) {
      throw new Error('Dados inválidos: chamado_id e itens são obrigatórios');
    }

    // FIX (2026-09): trocar db.raw por db.select + filtro em JS. O db.raw
    // caía no fallback genérico (só filtrava por tenant_id), então o WHERE
    // "chamado_id = X AND status = 'rascunho'" era ignorado — devolvia
    // QUALQUER cotação do tenant. Resultado: criar cotação pra RC nova
    // reaproveitava a cotação de outra RC e misturava os itens.
    const todasCotacoes = await this.db.select('cotacoes', { tenant_id: tenantId }, tenantId);
    const existente = todasCotacoes.filter(c =>
      String(c.chamado_id) === String(chamado_id) && c.status === 'rascunho'
    );

    // 🔥 SE EXISTIR, ATUALIZAR (não criar nova)
    if (existente.length > 0) {
      const cotacaoExistente = existente[0];
      
      // Atualizar notas e origem
      const updateData = {};
      if (notas !== undefined) updateData.notas = notas;
      if (origem_ov_numero !== undefined) updateData.origem_ov_numero = origem_ov_numero;
      
      await this.db.update('cotacoes', cotacaoExistente.id, updateData, tenantId);
      
      // Deletar fornecedores antigos DA COTAÇÃO (não do tenant todo).
      const fornsAntigos = await this.db.select('cotacao_fornecedores',
        { cotacao_id: cotacaoExistente.id, tenant_id: tenantId }, tenantId);
      for (const f of fornsAntigos) {
        await this.db.delete('cotacao_fornecedores', f.id, tenantId);
      }

      // 🔥 VINCULAR FORNECEDORES
      const fornecedoresUnicos = new Set();
      for (const item of itens) {
        (item.fornecedor_ids || []).forEach(id => fornecedoresUnicos.add(id));
      }
      
      for (const fornecedorId of fornecedoresUnicos) {
        const fornecedor = await this.db.selectOne('fornecedores', { id: fornecedorId }, tenantId);
        // FIX (2026-09): gerar token_acesso no INSERT. Antes o token só
        // nascia no enviarCotacao — se o comprador copiasse o link antes
        // de enviar, saía .../null, o PostgREST interpretava 'null' como
        // IS NULL e devolvia outro fornecedor da mesma cotação.
        const token = this.gerarTokenFornecedor(cotacaoExistente.id, fornecedorId);
        await this.db.insert('cotacao_fornecedores', {
          tenant_id: tenantId,
          cotacao_id: cotacaoExistente.id,
          fornecedor_id: fornecedorId,
          fornecedor_nome: fornecedor?.nome || 'Fornecedor',
          fornecedor_email: fornecedor?.email || null,
          status: 'pendente',
          token_acesso: token,
        }, tenantId);
      }

      // Deletar itens antigos DA COTAÇÃO (não do tenant todo).
      const itensAntigos = await this.db.select('cotacao_itens',
        { cotacao_id: cotacaoExistente.id, tenant_id: tenantId }, tenantId);
      for (const it of itensAntigos) {
        await this.db.delete('cotacao_itens', it.id, tenantId);
      }

      // Adicionar novos itens
      for (const item of itens) {
        await this.db.insert('cotacao_itens', {
          tenant_id: tenantId,
          cotacao_id: cotacaoExistente.id,
          chamado_item_id: item.item_id,
          item_catalogo_id: null,
          quantidade: 1,
          preco_estimado: null,
          fornecedores_ids: item.fornecedor_ids || []
        });
      }
      
      return {
        cotacao_id: cotacaoExistente.id,
        status: 'rascunho',
        mensagem: 'Cotação atualizada com sucesso'
      };
    }

    // ✅ SE NÃO EXISTIR, CRIAR NOVA
    // FIX (2026-09): gerar numero único no padrão COT-{ano}-000X. Antes
    // o INSERT omitia o campo, e toda cotação automática nascia com
    // `numero: NULL`.
    const numeroCotacao = await this.gerarNumeroCotacao(tenantId);
    const cotacao = await this.db.insert('cotacoes', {
      tenant_id: tenantId,
      chamado_id: chamado_id,
      numero: numeroCotacao,
      status: 'rascunho',
      modo: 'automatica',
      notas: notas || null,
      origem_ov_numero: origem_ov_numero || null
    }, tenantId);

    // 🔥 VINCULAR FORNECEDORES
    const fornecedoresUnicos = new Set();
    for (const item of itens) {
      (item.fornecedor_ids || []).forEach(id => fornecedoresUnicos.add(id));
    }
    
    for (const fornecedorId of fornecedoresUnicos) {
      const fornecedor = await this.db.selectOne('fornecedores', { id: fornecedorId }, tenantId);
      const token = this.gerarTokenFornecedor(cotacao.id, fornecedorId);
      await this.db.insert('cotacao_fornecedores', {
        tenant_id: tenantId,
        cotacao_id: cotacao.id,
        fornecedor_id: fornecedorId,
        fornecedor_nome: fornecedor?.nome || 'Fornecedor',
        fornecedor_email: fornecedor?.email || null,
        status: 'pendente',
        token_acesso: token,
      }, tenantId);
    }

    for (const item of itens) {
      const chamadoItem = await this.db.selectOne('chamado_itens', { id: item.item_id }, tenantId);
      const itemCatalogoId = chamadoItem?.item_catalogo_id || null;

      await this.db.insert('cotacao_itens', {
        tenant_id: tenantId,
        cotacao_id: cotacao.id,
        chamado_item_id: item.item_id,
        item_catalogo_id: itemCatalogoId,
        quantidade: 1,
        preco_estimado: null,
        fornecedores_ids: item.fornecedor_ids || []
      });
    }

    return {
      cotacao_id: cotacao.id,
      status: 'rascunho',
      mensagem: 'Cotação salva com sucesso'
    };
  }

  // ─── ATUALIZAR COTAÇÃO (editar fornecedores) ─────────────────
  async atualizarCotacao(tenantId, cotacaoId, dados) {

    const { itens, notas, origem_ov_numero } = dados; // 🔥 Adicione origem_ov_numero

    const cotacao = await this.db.selectOne('cotacoes', { id: cotacaoId }, tenantId);
    if (!cotacao) throw new Error('Cotação não encontrada');

    if (cotacao.status !== 'rascunho') {
      throw new Error('Apenas cotações em rascunho podem ser editadas');
    }

    // 🔥 Atualizar notas e origem (se enviados)
    const updateData = {};
    if (notas !== undefined) updateData.notas = notas;
    if (origem_ov_numero !== undefined) updateData.origem_ov_numero = origem_ov_numero;
    if (Object.keys(updateData).length > 0) {
      await this.db.update('cotacoes', cotacaoId, updateData, tenantId);
    }

    // ✅ Remove itens antigos (ou atualiza)
    // FIX (2026-09): db.raw caía no fallback genérico e ignorava o WHERE
    // cotacao_id — apagava TODOS os cotacao_itens do tenant. Trocado por
    // select + delete loop.
    const itensAntigosAtu = await this.db.select('cotacao_itens',
      { cotacao_id: cotacaoId, tenant_id: tenantId }, tenantId);
    for (const ia of itensAntigosAtu) {
      await this.db.delete('cotacao_itens', ia.id, tenantId);
    }

    // ✅ Adiciona novos itens com fornecedores_ids (com dados reais do chamado)
    for (const item of itens) {
      // Buscar dados do item do chamado para preservar quantidade e catalogo_id
      const chamadoItem = await this.db.selectOne('chamado_itens', 
        { id: item.item_id }, 
        tenantId
      );

      const itemCatalogoId = chamadoItem?.item_catalogo_id || null;
      const quantidade = chamadoItem?.quantidade || 1;

      await this.db.insert('cotacao_itens', {
        tenant_id: tenantId,
        cotacao_id: cotacaoId,
        chamado_item_id: item.item_id,
        item_catalogo_id: itemCatalogoId,
        quantidade: quantidade,
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

    // Verifica se a cotação existe E pertence ao tenant
    const cotacao = await this.db.selectOne('cotacoes', { id: cotacaoId, tenant_id: tenantId }, tenantId);
    if (!cotacao) throw new Error('Cotação não encontrada');

    // FIX (2026-09): o wrapper DB.delete só aceita ID único — não
    // suporta WHERE composto. Antes passávamos `{ cotacao_id, tenant_id }`
    // como se fosse id, e o Supabase serializava como "[object Object]"
    // (erro: invalid input syntax for type integer). Agora iteramos,
    // buscando os IDs primeiro e deletando um por um. Ordem respeita FK:
    // respostas por item → fornecedores → itens → cotação.

    // 1. Fornecedores desta cotação (pra ter os IDs antes de deletar
    //    as respostas por item)
    const fornecedoresDaCotacao = await this.db.select('cotacao_fornecedores',
      { cotacao_id: cotacaoId, tenant_id: tenantId }, tenantId);
    const fornecedoresIds = fornecedoresDaCotacao.map(f => f.id);

    // 2. Respostas por item (antes dos fornecedores, senão FK bloqueia)
    if (fornecedoresIds.length > 0) {
      const todasRespostas = await this.db.select('cotacao_fornecedor_itens',
        { tenant_id: tenantId }, tenantId);
      const respostasDaCotacao = todasRespostas.filter(r =>
        fornecedoresIds.includes(r.cotacao_fornecedor_id)
      );
      for (const r of respostasDaCotacao) {
        await this.db.delete('cotacao_fornecedor_itens', r.id, tenantId);
      }
    }

    // 3. Fornecedores
    for (const f of fornecedoresDaCotacao) {
      await this.db.delete('cotacao_fornecedores', f.id, tenantId);
    }

    // 4. Itens da cotação
    const itensDaCotacao = await this.db.select('cotacao_itens',
      { cotacao_id: cotacaoId, tenant_id: tenantId }, tenantId);
    for (const it of itensDaCotacao) {
      await this.db.delete('cotacao_itens', it.id, tenantId);
    }

    // 5. A cotação em si
    await this.db.delete('cotacoes', cotacaoId, tenantId);

    // 6. Desbloqueia a RC — sem cotação ativa, o requisitante volta a
    //    poder editar (mudança de status pra "aguardando_cotacao" é
    //    semântica: aguardando nova decisão do comprador).
    if (cotacao.chamado_id) {
      await this.db.update('chamados', cotacao.chamado_id, {
        bloqueado_em: null,
        status: 'aguardando_cotacao',
      }, tenantId);
    }

    return { ok: true };
  }

  // ───────────────────────────────────────────────────────────────────────
  // CRIAR ORDEM DE VENDA COM TODOS OS ITENS DO FORNECEDOR
  // ───────────────────────────────────────────────────────────────────────
  async criarOrdenVenda(tenantId, cotacaoId, fornecedorId, usuarioId = null, dados = {}) {
    try {
      // 1. Buscar cotação
      const cotacao = await this.db.selectOne('cotacoes', { id: cotacaoId }, tenantId);
      if (!cotacao) throw new Error(`Cotação ${cotacaoId} não encontrada`);

      // 2. Buscar resposta do fornecedor
      const resposta = await this.db.selectOne('cotacao_fornecedores', {
        cotacao_id: cotacaoId,
        fornecedor_id: fornecedorId
      }, tenantId);

      if (!resposta) throw new Error(`Fornecedor ${fornecedorId} não encontrado na cotação`);
      if (resposta.status !== 'respondido') throw new Error(`Fornecedor ainda não respondeu esta cotação`);

      // 3. Buscar itens da cotação (SEM LEFT JOIN)
      const itens = await this.db.select('cotacao_itens', { cotacao_id: cotacaoId }, tenantId);

      // 4. Buscar itens do chamado para obter nomes
      const chamadoItemIds = itens.map(i => i.chamado_item_id);
      // FIX (2026-09): db.raw ignorava o ANY($1).
      const todosChamadoItens = chamadoItemIds.length > 0
        ? await this.db.select('chamado_itens', { tenant_id: tenantId }, tenantId)
        : [];
      const chamadoItens = todosChamadoItens.filter(ci => chamadoItemIds.includes(ci.id));

      // 5. Buscar nomes dos itens
      const itensComNomes = itens.map(item => {
        const chamadoItem = chamadoItens.find(ci => ci.id === item.chamado_item_id);
        return {
          ...item,
          nome_item: chamadoItem?.item_nome || 'Item sem nome',
          item_catalogo_id: chamadoItem?.item_catalogo_id || item.item_catalogo_id || null,
        };
      });

      // 6. VALORES FINAIS (renegociados se existirem)
      const valorFinal = dados.valor || resposta.valor_renegociado || resposta.valor || 0;
      const freteFinal = dados.frete || resposta.frete_renegociado || resposta.valor_frete || 0;
      const economia = (resposta.valor || 0) - (resposta.valor_renegociado || resposta.valor || 0) + 
                      (resposta.valor_frete || 0) - (resposta.frete_renegociado || resposta.valor_frete || 0);

      // 7. Trava: já existe OV emitida pra esta cotação + fornecedor?
      // Sem isso, cada clique em "Finalizar" gera uma nova OV em cima da
      // mesma cotação — bug observado em 2026-09 (2 OVs pra cotação 10).
      const ovExistente = await this.db.selectOne('ordens_venda', {
        cotacao_id: cotacaoId,
        fornecedor_id: fornecedorId
      }, tenantId);

      if (ovExistente) {
        throw new Error(
          `OV ${ovExistente.numero} já foi emitida para este fornecedor nesta cotação. ` +
          `Se precisar reemitir, cancele a OV anterior primeiro.`
        );
      }

      // 8. Gerar número único para OV
      const numeroOV = await this.gerarNumeroOrdenVenda(tenantId);

      // 8.1 Criar ordem de venda
      const ordemVenda = await this.db.insert('ordens_venda', {
        tenant_id: tenantId,
        cotacao_id: cotacaoId,
        fornecedor_id: fornecedorId,
        numero: numeroOV,
        status: 'pendente',
        valor_total: valorFinal + freteFinal,
        valor_frete: freteFinal,
        prazo_entrega: resposta.prazo,
        criado_em: new Date(),
        criado_por: usuarioId && typeof usuarioId === 'string' ? usuarioId : null,
        // 🔥 RASTREABILIDADE:
        origem_ov_numero: cotacao.origem_ov_numero || null,
        // 🔥 VALORES RENEGOCIADOS:
        valor_original: resposta.valor || 0,
        frete_original: resposta.valor_frete || 0,
        economia: economia
      }, tenantId);

      // Marca a cotação como finalizada — assim a RC deixa de aparecer no
      // dropdown de "Nova Cotação". Sem isso, o usuário podia emitir a mesma
      // RC em OV indefinidamente (bug observado em 2026-09).
      await this.db.update('cotacoes', cotacaoId, {
        status: 'finalizado',
        finalizado_em: new Date().toISOString()
      }, tenantId);


      // 9. Criar itens da OV (com valores renegociados)
      for (const item of itensComNomes) {
        await this.db.insert('ordem_venda_itens', {
          tenant_id: tenantId,
          ordem_venda_id: ordemVenda.id,
          cotacao_item_id: item.id,
          chamado_item_id: item.chamado_item_id,
          item_catalogo_id: item.item_catalogo_id,
          nome_item: item.nome_item,
          quantidade: item.quantidade,
          valor_unitario: valorFinal / (itens.length || 1),
          valor_total: valorFinal,
          // M6: legado — mantido para consistência caso essa função
          // seja chamada por engano. O campo pode estar null se
          // `item.codigo_fornecedor` não existir no fluxo antigo.
          codigo_fornecedor: item.codigo_fornecedor || null,
          criado_em: new Date()
        }, tenantId);
      }

      // 10. ENVIAR E-MAIL DE CONFIRMAÇÃO
      try {
        const { enviarEmailCotacao } = require('./emailService');
        const fornecedor = await this.db.selectOne('fornecedores', { id: fornecedorId }, tenantId);
        const empresa = await this.db.selectOne('tenants', { id: tenantId });

        if (fornecedor?.email) {
          const assunto = `Ordem de Venda ${numeroOV} - Quotaflow`;
          const listaItens = itensComNomes.map(i => 
            `<li>${i.nome_item || 'Item'} - Qtd: ${i.quantidade} - Valor: R$ ${(valorFinal / (itens.length || 1)).toFixed(2)}</li>`
          ).join('');

          const corpo = `
            <h2>Ordem de Venda #${numeroOV}</h2>
            <p>Prezado(a) ${fornecedor.nome},</p>
            <p>Confirmamos a emissão da Ordem de Venda para os itens abaixo:</p>
            <ul>${listaItens}</ul>
            <p><strong>Valor Total:</strong> R$ ${(valorFinal + freteFinal).toFixed(2)}</p>
            <p><strong>Prazo de Entrega:</strong> ${resposta.prazo} dias</p>
            <p>Em breve o comprador entrará em contato para os próximos passos.</p>
            <p>Agradecemos pela parceria!</p>
            <hr>
            <p><small>Esta é uma mensagem automática. Não responda este e-mail.</small></p>
          `;

          await enviarEmailCotacao(fornecedor.email, assunto, corpo);
          console.log(`✅ E-mail de OV enviado para ${fornecedor.email}`);
        }
      } catch (err) {
        console.error('❌ Falha ao enviar e-mail de OV:', err.message);
      }

      // 11. Atualizar status da cotação
      await this.db.update('cotacoes', cotacaoId, {
        status: 'finalizada',
        finalizado_em: new Date()
      }, tenantId);

      // 12. Atualizar status do chamado
      const chamado = await this.db.selectOne('chamados', { id: cotacao.chamado_id }, tenantId);
      if (chamado) {
        await this.db.update('chamados', chamado.id, {
          status: 'finalizado',
          finalizado_em: new Date()
        }, tenantId);
      }

      return {
        ordem_venda_id: ordemVenda.id,
        numero: numeroOV,
        status: 'pendente',
        fornecedor_id: fornecedorId,
        valor_total: valorFinal + freteFinal,
        valor_frete: freteFinal,
        valor_original: resposta.valor || 0,
        economia: economia,
        prazo_entrega: resposta.prazo,
        quantidade_itens: itens.length,
        mensagem: `Ordem de Venda criada com sucesso para ${itens.length} item(ns)`
      };
    } catch (err) {
      console.error(`❌ Erro ao criar OV:`, err.message);
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // gerarNumeroCotacao — COT-{ano}-{0001}. Centralizado aqui no service
  // pra ser reutilizado por salvarCotacao, criarCotacaoCategoria e
  // criarAutomatica (antes cada uma gerava número inline com formato
  // diferente — COT-{chamadoId}-{timestamp}). O routes/cotacoes.js
  // continua com um wrapper que delega pra cá.
  // ─────────────────────────────────────────────────────────────────────────
  async gerarNumeroCotacao(tenantId) {
    const ano = new Date().getFullYear();
    const prefix = `COT-${ano}-`;

    const todasCotacoes = await this.db.select('cotacoes', { tenant_id: tenantId }, tenantId);
    const doPrefixo = todasCotacoes
      .map(c => c.numero)
      .filter(n => n && n.startsWith(prefix))
      .map(n => {
        const m = n.match(/(\d+)$/);
        return m ? parseInt(m[1]) : 0;
      });
    let seq = doPrefixo.length > 0 ? Math.max(...doPrefixo) + 1 : 1;

    let novoNumero = `${prefix}${String(seq).padStart(4, "0")}`;
    let tentativas = 0;
    while (todasCotacoes.some(c => c.numero === novoNumero) && tentativas < 100) {
      seq++;
      novoNumero = `${prefix}${String(seq).padStart(4, "0")}`;
      tentativas++;
    }
    return novoNumero;
  }


  // ───────────────────────────────────────────────────────────────────────
  // GERAR NÚMERO ÚNICO PARA ORDEM DE VENDA
  // ───────────────────────────────────────────────────────────────────────
  async gerarNumeroOrdenVenda(tenantId) {
    const ano = new Date().getFullYear();
    // Prefixo alinhado com OS/RC/RM: só ano. Consistência visual entre os
    // documentos do sistema.
    const prefix = `OC-${ano}-`;

    // FIX (2026-09): db.raw caía no fallback (ignorava LIKE), então a
    // numeração não avançava. Trocado por select + filtro em JS.
    const todas = await this.db.select('ordens_venda', { tenant_id: tenantId }, tenantId);
    const doPrefixo = todas
      .map(o => o.numero)
      .filter(n => n && n.startsWith(prefix))
      .map(n => {
        const match = n.match(/(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      });

    let seq = 1;
    if (doPrefixo.length > 0) {
      seq = Math.max(...doPrefixo) + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  // ───────────────────────────────────────────────────────────────────────
  // OBTER STATUS COMPLETO DE UMA COTAÇÃO
  // ───────────────────────────────────────────────────────────────────────
async obterStatusCotacao(tenantId, cotacaoId) {
  try {
    const cotacao = await this.db.selectOne('cotacoes', { id: cotacaoId }, tenantId);
    if (!cotacao) throw new Error(`Cotação ${cotacaoId} não encontrada`);

    const itens = await this.db.select('cotacao_itens', { cotacao_id: cotacaoId }, tenantId);
    const fornecedores = await this.db.select('cotacao_fornecedores', { cotacao_id: cotacaoId }, tenantId);

    // 🔥 BUSCAR NOME DOS ITENS DO CHAMADO
    const chamadoItemIds = itens.map(i => i.chamado_item_id);
    // const chamadoItens = chamadoItemIds.length > 0 ? await this.db.select('chamado_itens', {}, tenantId).then(todos => todos.filter(ci => chamadoItemIds.includes(ci.id))) : [];
    // teste substituindo a função acima por essa embaixo:
    // FIX (2026-09): db.raw ignorava o ANY($1).
    const todosChamadoItens = chamadoItemIds.length > 0
      ? await this.db.select('chamado_itens', { tenant_id: tenantId }, tenantId)
      : [];
    const chamadoItens = todosChamadoItens.filter(ci => chamadoItemIds.includes(ci.id));

    // 🔥 ESTRUTURAR ITENS
    const itensEstruturados = itens.map(item => {
      const fornecedoresIds = Array.isArray(item.fornecedores_ids) ? item.fornecedores_ids : JSON.parse(item.fornecedores_ids || '[]');
      const fornecedoresDoItem = fornecedores.filter(f => fornecedoresIds.includes(f.fornecedor_id));

      return {
        id: item.id,
        nome: chamadoItens.find(ci => ci.id === item.chamado_item_id)?.item_nome || 'Item sem nome',
        quantidade: item.quantidade,
        categoria: chamadoItens.find(ci => ci.id === item.chamado_item_id)?.categoria || '',
        codigo: chamadoItens.find(ci => ci.id === item.chamado_item_id)?.codigo || '',
        fornecedores: fornecedoresDoItem.map((f, idx) => ({
          id: f.id,
          token_acesso: f.token_acesso,
          fornecedor_id: f.fornecedor_id,
          nome: f.fornecedor_nome,
          email: f.fornecedor_email,
          status: f.status,
          valor: f.valor || null,
          frete: f.valor_frete || null,
          prazo: f.prazo || null,
          obs: f.obs || null,
          data_resposta: f.data_resposta,
          total: f.valor ? (f.valor + (f.valor_frete || 0)) : null,
          // 🔥 NOVO: Adicionar valor_renegociado e economia
          valor_renegociado: f.valor_renegociado || null,
          frete_renegociado: f.frete_renegociado || null,
          economia: f.economia || null,
          economia_frete: f.economia_frete || null,
          // #4c — Validade da proposta
          validade_dias: f.validade_dias || null,
          validade_em: f.validade_em || null,
          posicao: idx + 1
        }))
      };
    });

    const respondidos = fornecedores.filter(f => f.status === 'respondido').length;
    const pendentes = fornecedores.length - respondidos;

    const melhorProposta = fornecedores
      .filter(f => f.status === 'respondido' && f.valor)
      .sort((a, b) => (a.valor + (a.valor_frete || 0)) - (b.valor + (b.valor_frete || 0)))[0] || null;

    return {
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
        respondidos,
        pendentes
      },
      melhorProposta
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
    try {
      const atual = await this.db.selectOne('cotacao_fornecedores', {
        cotacao_id: cotacaoId,
        fornecedor_id: fornecedorId
      }, tenantId);

      if (!atual) {
        throw new Error(`Fornecedor ${fornecedorId} não encontrado nesta cotação`);
      }

      // ── Fase 1: renegociação POR ITEM ──
      // Quando o comprador abre o modal e edita cada item individualmente,
      // o frontend envia `dados.itens = [{ cotacao_item_id, valor,
      // valor_frete, valor_renegociado, frete_renegociado, ... }, ...]`.
      // Cada item é atualizado em `cotacao_fornecedor_itens`. Se a linha
      // ainda não existir (fornecedor não respondeu via link), cria uma
      // nova com `origem_preenchimento: 'manual'`.
      //
      // Se o payload NÃO tiver `itens` (chamador antigo), cai no fluxo
      // legado logo abaixo — que ainda funciona pra retrocompat.
      if (Array.isArray(dados.itens) && dados.itens.length > 0) {
        // 1. Carrega linhas existentes em cotacao_fornecedor_itens deste
        //    fornecedor (só as do próprio tenant).
        const todasItensResp = await this.db.select('cotacao_fornecedor_itens',
          { tenant_id: tenantId }, tenantId);
        const linhasExistentes = todasItensResp.filter(
          ir => ir.cotacao_fornecedor_id === atual.id
        );
        const porItemId = {};
        linhasExistentes.forEach(ir => { porItemId[ir.cotacao_item_id] = ir; });

        // 2. Aplica cada item do payload
        for (const itPayload of dados.itens) {
          const cotItemId = parseInt(itPayload.cotacao_item_id, 10);
          if (isNaN(cotItemId)) continue;

          const valor = itPayload.valor != null ? parseFloat(itPayload.valor) : null;
          const valorFrete = itPayload.valor_frete != null ? parseFloat(itPayload.valor_frete) : null;
          const valorReneg = itPayload.valor_renegociado != null ? parseFloat(itPayload.valor_renegociado) : null;
          const freteReneg = itPayload.frete_renegociado != null ? parseFloat(itPayload.frete_renegociado) : null;

          if (porItemId[cotItemId]) {
            // UPDATE na linha existente (fornecedor respondeu via link)
            // FIX (2026-09, CIF/FOB): o UPDATE antigo omitia
            // `frete_modalidade` — mesmo que o comprador trocasse CIF↔FOB
            // no modal, o banco mantinha o valor do fornecedor. Agora
            // propaga; cai pro valor atual se o payload não mandar o campo
            // (compat com chamadores antigos).
            await this.db.update('cotacao_fornecedor_itens', porItemId[cotItemId].id, {
              valor: valor != null ? valor : porItemId[cotItemId].valor,
              frete: valorFrete != null ? valorFrete : porItemId[cotItemId].frete,
              valor_renegociado: valorReneg,
              frete_renegociado: freteReneg,
              frete_modalidade: itPayload.frete_modalidade
                ? itPayload.frete_modalidade
                : porItemId[cotItemId].frete_modalidade,
            }, tenantId);
          } else {
            // INSERT novo (comprador preencheu manualmente, fornecedor não
            // respondeu via link)
            await this.db.insert('cotacao_fornecedor_itens', {
              tenant_id: tenantId,
              cotacao_fornecedor_id: atual.id,
              cotacao_item_id: cotItemId,
              chamado_item_id: itPayload.chamado_item_id || null,
              valor: valor,
              frete: valorFrete,
              valor_renegociado: valorReneg,
              frete_renegociado: freteReneg,
              frete_modalidade: itPayload.frete_modalidade || null,
              origem_preenchimento: 'manual',
              prazo: dados.prazo != null ? parseInt(dados.prazo) : null,
              criado_em: new Date().toISOString(),
            }, tenantId);
          }
        }

        // 3. Recalcula agregados do cabeçalho (valor, frete, economia)
        const todasItensResp2 = await this.db.select('cotacao_fornecedor_itens',
          { tenant_id: tenantId }, tenantId);
        const linhasDoForn = todasItensResp2.filter(
          ir => ir.cotacao_fornecedor_id === atual.id
        );

        const soma = (arr, campo) =>
          arr.reduce((s, ir) => s + (parseFloat(ir[campo]) || 0), 0);

        const valorTotal = soma(linhasDoForn, 'valor');
        const freteTotal = soma(linhasDoForn, 'frete');

        // Renegociado total: se o item tem renegociado, usa; senão, usa o
        // valor original daquele item.
        const valorRenegTotal = linhasDoForn.reduce((s, ir) => {
          const v = ir.valor_renegociado != null
            ? parseFloat(ir.valor_renegociado)
            : (parseFloat(ir.valor) || 0);
          return s + v;
        }, 0);
        const freteRenegTotal = linhasDoForn.reduce((s, ir) => {
          const f = ir.frete_renegociado != null
            ? parseFloat(ir.frete_renegociado)
            : (parseFloat(ir.frete) || 0);
          return s + f;
        }, 0);

        // Economia = (valor original + frete original) − (reneg total + frete reneg total)
        const economiaTotal =
          (valorTotal + freteTotal) - (valorRenegTotal + freteRenegTotal);

        // #4c — Revalidação implícita: se o comprador tocou a resposta
        // (renegociou valor, ajustou prazo), a proposta volta a valer.
        // Renova `validade_em` a partir de hoje, mantendo o `validade_dias`
        // que o fornecedor declarou originalmente. Sem isso, editar um
        // item renegociado não tirava o badge 🔴 vermelho — enganoso.
        const validadeDiasAtual = parseInt(atual.validade_dias, 10) || 30;
        const novaValidadeEm = new Date(Date.now() + validadeDiasAtual * 86400000).toISOString();

        await this.db.update('cotacao_fornecedores', atual.id, {
          valor: valorTotal,
          valor_frete: freteTotal,
          prazo: dados.prazo !== undefined ? parseInt(dados.prazo) : atual.prazo,
          obs: dados.obs || atual.obs,
          valor_renegociado: valorRenegTotal > 0 ? valorRenegTotal : null,
          frete_renegociado: freteRenegTotal > 0 ? freteRenegTotal : null,
          economia: economiaTotal > 0 ? economiaTotal : null,
          economia_frete: null,
          status: 'respondido',
          data_resposta: atual.data_resposta || new Date(),
          validade_dias: validadeDiasAtual,
          validade_em: novaValidadeEm,
        }, tenantId);

        return {
          fornecedor_id: fornecedorId,
          valor: valorTotal,
          valor_frete: freteTotal,
          itens_atualizados: dados.itens.length,
          economia_total: economiaTotal,
        };
      }

      // ── Fallback: payload antigo (sem array `itens`) ──
      // Compatibilidade com chamadores que ainda mandam só os campos
      // avulsos no nível do cabeçalho. Deve ser removido quando todos
      // os clientes migrarem pra `dados.itens`.
      const economia = dados.valor_renegociado ? (atual.valor || 0) - dados.valor_renegociado : null;
      const economia_frete = dados.frete_renegociado ? (atual.valor_frete || 0) - dados.frete_renegociado : null;

      await this.db.update('cotacao_fornecedores', atual.id, {
        valor: dados.valor !== undefined ? dados.valor : atual.valor,
        prazo: dados.prazo !== undefined ? dados.prazo : atual.prazo,
        valor_frete: dados.valor_frete !== undefined ? dados.valor_frete : atual.valor_frete,
        obs: dados.obs || atual.obs,
        valor_renegociado: dados.valor_renegociado !== undefined ? dados.valor_renegociado : atual.valor_renegociado,
        frete_renegociado: dados.frete_renegociado !== undefined ? dados.frete_renegociado : atual.frete_renegociado,
        economia: economia,
        economia_frete: economia_frete,
        status: 'respondido',
        data_resposta: dados.data_resposta || new Date()
      }, tenantId);

      return {
        fornecedor_id: fornecedorId,
        valor: dados.valor,
        prazo: dados.prazo,
        valor_frete: dados.valor_frete,
        obs: dados.obs,
        valor_renegociado: dados.valor_renegociado,
        frete_renegociado: dados.frete_renegociado,
        economia,
        economia_frete
      };
    } catch (err) {
      console.error(`❌ Erro ao atualizar resposta:`, err.message);
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
// emitirOCs — emite uma OC por fornecedor, agrupando todos os itens
// selecionados para aquele fornecedor em uma única OC.
//
// Substitui o fluxo antigo (criarOrdenVenda) que gerava 1 OC só com o
// "melhor fornecedor geral", ignorando que cada item pode ter um vencedor
// diferente.
//
// Body esperado:
//   selecoes: [
//     { cotacao_item_id, fornecedor_id, justificativa?, sugerido_fornecedor_id?, valor_sugerido? }
//   ]
// ─────────────────────────────────────────────────────────────────────────
async emitirOCs(tenantId, cotacaoId, selecoes, usuarioId = null, usuarioNome = null) {
  const cotacao = await this.db.selectOne('cotacoes', { id: cotacaoId }, tenantId);
  if (!cotacao) throw new Error(`Cotação ${cotacaoId} não encontrada`);

  // 1. Carregar itens da cotação
  const cotacaoItens = await this.db.select('cotacao_itens',
    { cotacao_id: cotacaoId, tenant_id: tenantId }, tenantId);
  const cotacaoItensPorId = {};
  cotacaoItens.forEach(ci => { cotacaoItensPorId[ci.id] = ci; });

  if (Object.keys(cotacaoItensPorId).length === 0) {
    throw new Error('Cotação não tem itens');
  }

  // 2. Validar seleções
  const selecoesValidadas = [];
  const itensVistos = new Set();
  for (const s of selecoes) {
    const ci = cotacaoItensPorId[s.cotacao_item_id];
    if (!ci) throw new Error(`Item ${s.cotacao_item_id} não pertence a esta cotação`);
    if (itensVistos.has(s.cotacao_item_id)) {
      throw new Error(`Item ${s.cotacao_item_id} selecionado mais de uma vez`);
    }
    itensVistos.add(s.cotacao_item_id);

    const resposta = await this.db.selectOne('cotacao_fornecedores', {
      cotacao_id: cotacaoId,
      fornecedor_id: s.fornecedor_id
    }, tenantId);
    if (!resposta) throw new Error(`Fornecedor ${s.fornecedor_id} não está nesta cotação`);
    if (resposta.status !== 'respondido') {
      throw new Error(`Fornecedor ${resposta.fornecedor_nome} ainda não respondeu`);
    }
    selecoesValidadas.push({ ...s, cotacao_item: ci, resposta });
  }

  // 3. Validar cobertura: todos os itens da cotação precisam ter uma seleção
  if (selecoesValidadas.length !== Object.keys(cotacaoItensPorId).length) {
    throw new Error(
      `Faltam ${Object.keys(cotacaoItensPorId).length - selecoesValidadas.length} item(ns) sem fornecedor selecionado`
    );
  }

  // 4. Agrupar por fornecedor
  const porFornecedor = {};
  for (const s of selecoesValidadas) {
    if (!porFornecedor[s.fornecedor_id]) {
      porFornecedor[s.fornecedor_id] = {
        fornecedor_id: s.fornecedor_id,
        resposta: s.resposta,
        itens: [],
      };
    }
    porFornecedor[s.fornecedor_id].itens.push(s);
  }

  // 5. Buscar todos os chamado_itens (uma vez)
  const chamadoItemIds = selecoesValidadas.map(s => s.cotacao_item.chamado_item_id);
  const todosChamadoItens = await this.db.select('chamado_itens', { tenant_id: tenantId }, tenantId);
  const chamadoItensMap = {};
  todosChamadoItens.forEach(ci => {
    if (chamadoItemIds.includes(ci.id)) chamadoItensMap[ci.id] = ci;
  });

  // 6. Criar uma OC por fornecedor
  const ocsCriadas = [];
  for (const grupo of Object.values(porFornecedor)) {
    const fornId = grupo.fornecedor_id;
    const resposta = grupo.resposta;

    // Trava anti-duplicação (mesma cotação + fornecedor)
    const ovExistente = await this.db.selectOne('ordens_venda', {
      cotacao_id: cotacaoId,
      fornecedor_id: fornId
    }, tenantId);
    if (ovExistente) {
      throw new Error(
        `OC ${ovExistente.numero} já foi emitida para ${resposta.fornecedor_nome} nesta cotação`
      );
    }

    // M6: carregar os codigo_fornecedor das respostas desse fornecedor
    // (por cotacao_item_id). É o cProd que ele usa pra cada item — vai
    // ser propagado pra OC pra depois alimentar o match de NFe por PN.
    const respostasFornItens = await this.db.select('cotacao_fornecedor_itens',
      { cotacao_fornecedor_id: resposta.id }, tenantId);
    const codigoPorItem = {};
    respostasFornItens.forEach(ri => {
      if (ri.codigo_fornecedor) {
        codigoPorItem[String(ri.cotacao_item_id)] = ri.codigo_fornecedor;
      }
    });

    // Calcular totais (usa renegociado quando existir)
    let valorTotal = 0;
    let freteTotal = 0;
    const itensParaOC = grupo.itens.map(s => {
      const ci = s.cotacao_item;
      const chamadoItem = chamadoItensMap[ci.chamado_item_id];
      const valorItem = resposta.valor_renegociado != null
        ? resposta.valor_renegociado
        : resposta.valor;
      const freteItem = resposta.frete_renegociado != null
        ? resposta.frete_renegociado
        : resposta.valor_frete;
      const v = parseFloat(valorItem) || 0;
      const f = parseFloat(freteItem) || 0;
      const qtd = parseInt(ci.quantidade) || 1;
      valorTotal += v * qtd;
      freteTotal += f;
      return {
        cotacao_item_id: ci.id,
        chamado_item_id: ci.chamado_item_id,
        item_catalogo_id: chamadoItem?.item_catalogo_id || null,
        nome_item: chamadoItem?.item_nome || 'Item sem nome',
        quantidade: qtd,
        valor_unitario: v,
        valor_total: v * qtd,
        codigo_fornecedor: codigoPorItem[String(ci.id)] || null,
      };
    });

    // Gerar número e criar OC
    const numeroOC = await this.gerarNumeroOrdenVenda(tenantId);
    const oc = await this.db.insert('ordens_venda', {
      tenant_id: tenantId,
      cotacao_id: cotacaoId,
      fornecedor_id: fornId,
      numero: numeroOC,
      status: 'pendente',
      valor_total: valorTotal + freteTotal,
      valor_frete: freteTotal,
      prazo_entrega: resposta.prazo,
      criado_em: new Date(),
      criado_por: usuarioId,
      origem_ov_numero: cotacao.origem_ov_numero || null,
      valor_original: resposta.valor || 0,
      frete_original: resposta.valor_frete || 0,
    }, tenantId);

    // Inserir itens
    for (const item of itensParaOC) {
      await this.db.insert('ordem_venda_itens', {
        tenant_id: tenantId,
        ordem_venda_id: oc.id,
        cotacao_item_id: item.cotacao_item_id,
        chamado_item_id: item.chamado_item_id,
        item_catalogo_id: item.item_catalogo_id,
        nome_item: item.nome_item,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        valor_total: item.valor_total,
        // M6: cProd do fornecedor (para match de NFe por PN na fase fiscal).
        codigo_fornecedor: item.codigo_fornecedor || null,
        criado_em: new Date(),
      }, tenantId);
    }

    // Salvar seleção + justificativa (auditoria)
    for (const s of grupo.itens) {
      const sugeridoId = s.sugerido_fornecedor_id || null;
      const eraSugestao = sugeridoId != null
        && String(s.fornecedor_id) === String(sugeridoId);
      await this.db.insert('cotacao_fornecedor_item_selecionado', {
        tenant_id: tenantId,
        cotacao_id: cotacaoId,
        cotacao_item_id: s.cotacao_item_id,
        fornecedor_id: s.fornecedor_id,
        justificativa: s.justificativa || null,
        sugerido_fornecedor_id: sugeridoId,
        era_sugestao: eraSugestao,
        valor_escolhido: resposta.valor_renegociado != null
          ? resposta.valor_renegociado
          : resposta.valor,
        valor_sugerido: s.valor_sugerido != null ? s.valor_sugerido : null,
        criado_por: usuarioId,
        criado_por_nome: usuarioNome,
        criado_em: new Date().toISOString(),
      }, tenantId);
    }

    ocsCriadas.push({
      id: oc.id,
      numero: oc.numero,
      fornecedor_id: fornId,
      fornecedor_nome: resposta.fornecedor_nome,
      valor_total: valorTotal + freteTotal,
      itens: itensParaOC,
    });
  }

  // 7. Marcar cotação como finalizada
  await this.db.update('cotacoes', cotacaoId, {
    status: 'finalizada',
    finalizado_em: new Date().toISOString(),
  }, tenantId);

  return { ocs: ocsCriadas, total: ocsCriadas.length };
}


}

module.exports = CotacaoService;