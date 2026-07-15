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

  // ───────────────────────────────────────────────────────────────────────
  // CRIAR ITEM
  // ───────────────────────────────────────────────────────────────────────
  async criarItem(tenantId, dados) {
    console.log(`📦 [CatalogoService] Criando item: ${dados.nome}`);

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

    console.log(`✅ [CatalogoService] Item criado: ID ${item.id}`);
    return item;
  }

  // ───────────────────────────────────────────────────────────────────────
  // EDITAR ITEM
  // ───────────────────────────────────────────────────────────────────────
  async editarItem(tenantId, itemId, dados, usuarioId = null) {
    console.log(`✏️ [CatalogoService] Editando item ${itemId}`);

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

    console.log(`✅ [CatalogoService] Item atualizado`);
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

    console.log(`🔍 [CatalogoService] Buscando itens:`, { termo, marca, modelo, ano });

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

    console.log(`✅ [CatalogoService] ${itens.length} itens encontrados`);
    return itens;
  }

  // ───────────────────────────────────────────────────────────────────────
  // BUSCAR ITEM ESPECÍFICO (Com fornecedores)
  // ───────────────────────────────────────────────────────────────────────
  async buscarItemCompleto(tenantId, itemId) {
    const item = await this.db.selectOne('catalogo_itens', { id: itemId }, tenantId);

    if (!item) {
      throw new Error(`Item ${itemId} não encontrado`);
    }

    // Buscar fornecedores
    const fornecedores = await this.db.raw(`
      SELECT 
        fi.id,
        f.id as fornecedor_id,
        f.nome,
        fi.codigo_fornecedor,
        fi.descricao_fornecedor,
        fi.preco_unitario,
        fi.data_tabela,
        fi.estoque_status,
        fi.tempo_entrega_dias
      FROM fornecedor_itens fi
      JOIN fornecedores f ON fi.fornecedor_id = f.id
      WHERE fi.tenant_id = $1 
        AND fi.item_catalogo_id = $2 
        AND fi.ativo = true
      ORDER BY fi.preco_unitario ASC
    `, [tenantId, itemId]);

    return {
      ...item,
      fornecedores
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
    console.log(`🗑️ [CatalogoService] Deletando item ${itemId}`);

    await this.db.update('catalogo_itens', itemId, {
      ativo: false,
      atualizado_em: new Date()
    }, tenantId);

    console.log(`✅ [CatalogoService] Item deletado`);
  }
}

module.exports = CatalogoService;
