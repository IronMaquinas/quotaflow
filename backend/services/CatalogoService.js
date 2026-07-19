// services/CatalogoService.js
/**
 * CatalogoService
 * Gerencia a lógica de negócio do catálogo de peças
 * - Criar, editar, buscar itens
 * - Filtrar por marca, modelo, ano
 * - Buscar fornecedores de cada item
 */

class CatalogoService {
  constructor(db) {
    this.db = db;
  }

  parseCSV(csvText) {
    const linhas = csvText.split('\n').filter((l) => l.trim());
    if (linhas.length < 2) {
      throw new Error('CSV vazio ou sem dados');
    }

    const headers = linhas[0]
      .split(',')
      .map((h) => h.trim().toLowerCase());

    const indiceNome = headers.indexOf('nome');
    const indiceCodigo = headers.indexOf('codigo');
    const indiceCategoria = headers.indexOf('categoria');
    const indiceMarca = headers.indexOf('marca');
    const indiceModelo = headers.indexOf('modelo');
    const indiceAnoModelo = headers.indexOf('ano_modelo');

    if (indiceNome === -1) {
      throw new Error('CSV deve ter coluna "nome"');
    }

    const itens = [];

    for (let i = 1; i < linhas.length; i++) {
      const partes = linhas[i].split(',').map((p) => p.trim());

      if (partes[indiceNome]) {
        const item = {
          nome: partes[indiceNome],
          codigo: indiceCodigo >= 0 ? partes[indiceCodigo] : '',
          categoria: indiceCategoria >= 0 ? partes[indiceCategoria] : '',
          marca: indiceMarca >= 0 ? partes[indiceMarca] : '',
          modelo: indiceModelo >= 0 ? partes[indiceModelo] : '',
          ano_modelo: indiceAnoModelo >= 0 ? partes[indiceAnoModelo] : '',
        };

        itens.push(item);
      }
    }

    return itens;
  }

  // --- CALCULA SIMILARIDADE ENTRE O CATÁLOGO DOS FORNECEDORES ---
  
  calcularSimilaridade(str1, str2) {
    // Normaliza (lowercase, remove pontuação)
    const n1 = this.normalizarTexto(str1);
    const n2 = this.normalizarTexto(str2);

    if (n1 === n2) return 100;
    if (!n1 || !n2) return 0;

    // Algoritmo de Levenshtein (distância entre strings)
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
      .replace(/[\u0300-\u036f]/g, '');
  }

  // ───────────────────────────────────────────────────────────────────────
  // CRIAR ITEM
  // ───────────────────────────────────────────────────────────────────────
  async criarItem(tenantId, dados) {

    // Validar
    this.validarDadosItem(dados);

    // Verificar se código já existe
    const existe = await this.db.selectOne(
      'catalogo_itens',
      { tenant_id: tenantId, codigo: dados.codigo.toUpperCase() }
    );

    if (existe) {
      throw new Error(`Código ${dados.codigo} já existe para este tenant`);
    }

    // Criar item
    const item = await this.db.insert('catalogo_itens', {
      tenant_id: tenantId,
      codigo: dados.codigo.toUpperCase(),
      nome: dados.nome,
      categoria: dados.categoria,
      subcategoria: dados.subcategoria || null,
      descricao: dados.descricao || '',
      
      // Marca/Modelo/Ano (NOVO!)
      marca: dados.marca || null,                    // NULL = universal
      modelo: dados.modelo || null,                  // NULL = todos modelos
      tipo_fabricante: dados.tipo_fabricante || 'Genérico',
      ano_fabricacao_inicio: dados.ano_fabricacao_inicio || null,
      ano_fabricacao_fim: dados.ano_fabricacao_fim || null,
      
      unidade: dados.unidade || 'un',
      tags: dados.tags || [],
      especificacoes: dados.especificacoes || {},
      ativo: true
    });

    return item;
  }

  // ───────────────────────────────────────────────────────────────────────
  // EDITAR ITEM
  // ───────────────────────────────────────────────────────────────────────
  async editarItem(tenantId, itemId, dados, usuarioId = null) {
    this.validarDadosItem(dados);

    const item = await this.db.update('catalogo_itens', itemId, {
      nome: dados.nome,
      categoria: dados.categoria,
      subcategoria: dados.subcategoria || null,
      descricao: dados.descricao || '',
      
      // Marca/Modelo/Ano (NOVO!)
      marca: dados.marca || null,
      modelo: dados.modelo || null,
      tipo_fabricante: dados.tipo_fabricante || 'Genérico',
      ano_fabricacao_inicio: dados.ano_fabricacao_inicio || null,
      ano_fabricacao_fim: dados.ano_fabricacao_fim || null,
      
      tags: dados.tags || [],
      especificacoes: dados.especificacoes || {},
      atualizado_em: new Date(),
      atualizado_por: usuarioId
    }, tenantId);

    return item;
  }

  // ───────────────────────────────────────────────────────────────────────
  // BUSCAR ITENS (Com filtros por marca, modelo, ano)
  // ───────────────────────────────────────────────────────────────────────
  async buscarItens(tenantId, filtros = {}) {
    const {
      termo = '',
      categoria = null,
      marca = null,
      modelo = null,
      ano = null,
      limite = 50,
      pagina = 1,
      tipo_fabricante = null
    } = filtros;

    let query = `
      SELECT 
        c.id, c.codigo, c.nome, c.categoria, c.descricao,
        c.marca, c.modelo, c.tipo_fabricante, 
        c.ano_fabricacao_inicio, c.ano_fabricacao_fim,
        COUNT(DISTINCT fi.fornecedor_id) as total_fornecedores,
        MIN(fi.preco_unitario) as preco_minimo,
        MAX(fi.preco_unitario) as preco_maximo
      FROM catalogo_itens c
      LEFT JOIN fornecedor_itens fi ON c.id = fi.item_catalogo_id AND fi.ativo = true
      WHERE c.tenant_id = $1 AND c.ativo = true
    `;

    const params = [tenantId];
    let paramIndex = 2;

    // Filtro: Busca por termo (nome ou código)
    if (termo) {
      query += ` AND (c.nome ILIKE $${paramIndex} OR c.codigo ILIKE $${paramIndex})`;
      params.push(`%${termo}%`);
      paramIndex++;
    }

    // Filtro: Categoria
    if (categoria) {
      query += ` AND c.categoria = $${paramIndex}`;
      params.push(categoria);
      paramIndex++;
    }

    // Filtro: Marca (NOVO!)
    if (marca) {
      // Buscar items ESPECÍFICOS dessa marca OU itens genéricos
      query += ` AND (c.marca = $${paramIndex} OR c.marca IS NULL)`;
      params.push(marca);
      paramIndex++;
    }

    // Filtro: Modelo (NOVO!)
    if (modelo && marca) {
      // Se temos marca E modelo, busca específico desse modelo OU genérico
      query += ` AND (c.modelo = $${paramIndex} OR c.modelo IS NULL)`;
      params.push(modelo);
      paramIndex++;
    }

    // Filtro: Ano (NOVO!)
    if (ano && !isNaN(ano)) {
      // Buscar itens que são válidos PARA esse ano
      query += ` AND (c.ano_fabricacao_inicio IS NULL OR c.ano_fabricacao_inicio <= $${paramIndex})`;
      params.push(ano);
      paramIndex++;
      
      query += ` AND (c.ano_fabricacao_fim IS NULL OR c.ano_fabricacao_fim >= $${paramIndex - 1})`;
    }

    // Filtro: Tipo de fabricante
    if (tipo_fabricante) {
      query += ` AND (c.tipo_fabricante = $${paramIndex} OR c.tipo_fabricante = 'Genérico')`;
      params.push(tipo_fabricante);
      paramIndex++;
    }

    query += ` GROUP BY c.id ORDER BY c.nome LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`;

    const itens = await this.db.raw(query, params);

    return itens;
  }

  // ───────────────────────────────────────────────────────────────────────
  // BUSCAR ITEM ESPECÍFICO (Com fornecedores)
  // ───────────────────────────────────────────────────────────────────────
  async buscarItemCompleto(tenantId, itemId) {
    // Busca o item
    const item = await this.db.selectOne('catalogo_itens', { id: itemId }, tenantId);
    if (!item) throw new Error(`Item ${itemId} não encontrado`);

    // Busca fornecedores vinculados
    const fornecedores = await this.db.raw(`
  SELECT * FROM fornecedor_itens 
  WHERE tenant_id = $1 AND item_catalogo_id = $2
`, [tenantId, itemId]);

    // Mapeia para camelCase (como o frontend espera)
    const fornecedoresMapeados = fornecedores.map(f => ({
      fornecedorId: f.fornecedor_id,
      nome: f.nome,
      precoUnitario: f.preco_unitario || 0,
      estoqueStatus: f.estoque_status || 'em_estoque',
      tempoEntrega: f.tempo_entrega_dias || 3,
    }));

    // Retorna o item com a propriedade fornecedores
    return {
      ...item,
      fornecedores: fornecedoresMapeados
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // VALIDAR DADOS DO ITEM
  // ───────────────────────────────────────────────────────────────────────
  validarDadosItem(dados) {
    if (!dados.codigo || dados.codigo.trim().length === 0) {
      throw new Error('Código é obrigatório');
    }
    if (!dados.nome || dados.nome.trim().length === 0) {
      throw new Error('Nome é obrigatório');
    }
    if (!dados.categoria || dados.categoria.trim().length === 0) {
      throw new Error('Categoria é obrigatória');
    }

    // Validar anos
    if (dados.ano_fabricacao_inicio && dados.ano_fabricacao_fim) {
      if (dados.ano_fabricacao_inicio > dados.ano_fabricacao_fim) {
        throw new Error('Ano de início não pode ser maior que ano de fim');
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // OBTER ESTATÍSTICAS
  // ───────────────────────────────────────────────────────────────────────
  async obterEstatisticas(tenantId) {
    const stats = await this.db.raw(`
      SELECT 
        COUNT(DISTINCT c.id) as total_itens,
        COUNT(DISTINCT c.categoria) as total_categorias,
        COUNT(DISTINCT c.marca) FILTER (WHERE c.marca IS NOT NULL) as total_marcas,
        COUNT(DISTINCT fi.fornecedor_id) as total_fornecedores,
        AVG(fi.preco_unitario) as preco_medio,
        MIN(fi.preco_unitario) as preco_minimo,
        MAX(fi.preco_unitario) as preco_maximo
      FROM catalogo_itens c
      LEFT JOIN fornecedor_itens fi ON c.id = fi.item_catalogo_id AND fi.ativo = true
      WHERE c.tenant_id = $1 AND c.ativo = true
    `, [tenantId]);

    return stats[0] || {
      total_itens: 0,
      total_categorias: 0,
      total_marcas: 0,
      total_fornecedores: 0,
      preco_medio: 0
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // OBTER CATEGORIAS (Para filtros)
  // ───────────────────────────────────────────────────────────────────────
  async obterCategorias(tenantId) {
    const categorias = await this.db.raw(`
      SELECT DISTINCT categoria, COUNT(*) as total
      FROM catalogo_itens
      WHERE tenant_id = $1 AND ativo = true AND categoria IS NOT NULL
      GROUP BY categoria
      ORDER BY total DESC
    `, [tenantId]);

    return categorias;
  }

  // ───────────────────────────────────────────────────────────────────────
  // OBTER MARCAS (Para filtros)
  // ───────────────────────────────────────────────────────────────────────
  async obterMarcas(tenantId) {
    const marcas = await this.db.raw(`
      SELECT DISTINCT marca, COUNT(*) as total
      FROM catalogo_itens
      WHERE tenant_id = $1 AND ativo = true AND marca IS NOT NULL
      GROUP BY marca
      ORDER BY marca ASC
    `, [tenantId]);

    return marcas;
  }

  // ───────────────────────────────────────────────────────────────────────
  // OBTER MODELOS DE UMA MARCA (Para filtros cascata)
  // ───────────────────────────────────────────────────────────────────────
  async obterModelosPorMarca(tenantId, marca) {
    const modelos = await this.db.raw(`
      SELECT DISTINCT modelo, COUNT(*) as total
      FROM catalogo_itens
      WHERE tenant_id = $1 
        AND ativo = true 
        AND (marca = $2 OR marca IS NULL)
        AND modelo IS NOT NULL
      GROUP BY modelo
      ORDER BY modelo ASC
    `, [tenantId, marca]);

    return modelos;
  }

  // ───────────────────────────────────────────────────────────────────────
  // DELETAR ITEM (Soft delete)
  // ───────────────────────────────────────────────────────────────────────
  async deletarItem(tenantId, itemId) {

    await this.db.update('catalogo_itens', itemId, {
      ativo: false,
      atualizado_em: new Date()
    }, tenantId);

  }

  // ───────────────────────────────────────────────────────────────────────
  // IMPORTAR FORNECEDOR
  // ───────────────────────────────────────────────────────────────────────

  async importarFornecedor(tenantId, fornecedorId, csvText) {

    const itensCSV = this.parseCSV(csvText);
    
    // Busca TODOS os itens do tenant UMA VEZ
    const itensExistentes = await this.db.select('catalogo_itens', { tenant_id: tenantId });
    
    let itensAdicionados = 0;
    let itensVinculados = 0;

    for (const itemCSV of itensCSV) {
      try {
        let novoItem = null;
        
        // ✅ FUZZY MATCHING: Procura item similar PELO NOME
        for (const itemExistente of itensExistentes) {
          const similaridade = this.calcularSimilaridade(itemCSV.nome, itemExistente.nome);
          if (similaridade >= 90) {
            novoItem = itemExistente;
            break;
          }
        }
        
        // Se não encontrou similar, cria novo
        if (!novoItem) {
          novoItem = await this.criarItem(tenantId, {
            nome: itemCSV.nome,
            codigo: itemCSV.codigo,
            categoria: itemCSV.categoria || 'geral',
            marca: itemCSV.marca,
            modelo: itemCSV.modelo,
            ano_fabricacao_inicio: itemCSV.ano_modelo ? parseInt(itemCSV.ano_modelo) : null,
          });
          itensAdicionados++;
        } else {
          itensVinculados++;
        }

        // 2. Vincula fornecedor
        if (novoItem && novoItem.id) {
          try {
            await this.db.insert('fornecedor_itens', {
              tenant_id: tenantId,
              fornecedor_id: fornecedorId,
              item_catalogo_id: novoItem.id,
              codigo_fornecedor: itemCSV.codigo || '',
              descricao_fornecedor: itemCSV.nome,
              preco_unitario: 0,
              estoque_status: 'em_estoque',
              tempo_entrega_dias: 3,
              ativo: true
            });
          } catch (errVinc) {
            console.log(`   ⚠️ Já vinculado`);
          }
        }
      } catch (err) {
        console.error(`❌ ${itemCSV.nome}: ${err.message}`);
      }
    }

    return {
      criados: itensAdicionados,
      vinculados: itensVinculados,
      total: itensAdicionados + itensVinculados,
    };
  }
}

module.exports = CatalogoService;