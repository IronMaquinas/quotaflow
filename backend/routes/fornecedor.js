const express = require('express');
const router = express.Router();
const { DB } = require('../db');
const fornecedorMiddleware = require('../middleware/fornecedorMiddleware');

// ─── ROTAS PROTEGIDAS PARA FORNECEDOR ───

// GET /api/fornecedor/me - Dados do fornecedor logado
router.get('/me', fornecedorMiddleware, async (req, res) => {
  try {
    const fornecedor = await DB.selectOne('fornecedores', { id: req.fornecedorId });
    const usuario = await DB.selectOne('fornecedor_usuarios', { id: req.userId });
    
    res.json({
      fornecedor,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil
      }
    });
  } catch (err) {
    console.error('❌ Erro em /me:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/fornecedor/interesse - Manifestar interesse em demanda spot
router.post('/interesse', fornecedorMiddleware, async (req, res) => {
  try {
    const { demanda_id, mensagem } = req.body;
    const fornecedorId = req.fornecedorId;

    if (!demanda_id) {
      return res.status(400).json({ erro: 'demanda_id é obrigatório' });
    }

    // Buscar tenant do fornecedor
    const fornecedor = await DB.selectOne('fornecedores', { id: fornecedorId });
    if (!fornecedor) {
      return res.status(404).json({ erro: 'Fornecedor não encontrado' });
    }
    const tenantId = fornecedor.tenant_id;

    // Verificar se já existe interesse
    const existente = await DB.selectOne('interesses_spot', {
      demanda_id,
      fornecedor_id: fornecedorId
    }, tenantId);

    if (existente) {
      return res.status(409).json({ erro: 'Você já manifestou interesse nesta demanda' });
    }

    // Registrar interesse
    const interesse = await DB.insert('interesses_spot', {
      tenant_id: tenantId,
      demanda_id,
      fornecedor_id: fornecedorId,
      mensagem: mensagem || '',
      status: 'pendente'
    }, tenantId);

    res.status(201).json({ ok: true, interesse });
  } catch (err) {
    console.error('❌ Erro ao registrar interesse:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/fornecedor/interesses - Listar interesses do fornecedor
router.get('/interesses', fornecedorMiddleware, async (req, res) => {
  try {
    const fornecedorId = req.fornecedorId;
    const fornecedor = await DB.selectOne('fornecedores', { id: fornecedorId });
    const tenantId = fornecedor.tenant_id;

    const interesses = await DB.raw(`
      SELECT 
        i.*,
        d.componente,
        d.descricao_equipamento,
        d.quantidade,
        d.urgencia,
        d.status as demanda_status,
        t.nome as empresa_nome
      FROM interesses_spot i
      JOIN demandas_spot d ON d.id = i.demanda_id
      JOIN tenants t ON t.id = d.tenant_id
      WHERE i.fornecedor_id = $1 AND i.tenant_id = $2
      ORDER BY i.criado_em DESC
    `, [fornecedorId, tenantId]);

    res.json(interesses);
  } catch (err) {
    console.error('❌ Erro ao listar interesses:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/fornecedor/catalogo - Listar produtos do fornecedor
router.get('/catalogo', fornecedorMiddleware, async (req, res) => {
  try {
    const fornecedorId = req.fornecedorId;
    const itens = await DB.raw(`
      SELECT 
        fi.id, fi.preco_unitario, fi.estoque_status, fi.data_tabela,
        ci.id as item_catalogo_id, ci.nome, ci.codigo, ci.categoria
      FROM fornecedor_itens fi
      JOIN catalogo_itens ci ON ci.id = fi.item_catalogo_id
      WHERE fi.fornecedor_id = $1 AND fi.ativo = true
      ORDER BY ci.nome ASC
    `, [fornecedorId]);
    res.json(itens);
  } catch (err) {
    console.error('❌ Erro ao listar catálogo:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/fornecedor/catalogo - Adicionar produto ao catálogo
router.post('/catalogo', fornecedorMiddleware, async (req, res) => {
  try {
    const fornecedorId = req.fornecedorId;
    const { item_catalogo_id, preco_unitario, estoque_status } = req.body;

    if (!item_catalogo_id || !preco_unitario) {
      return res.status(400).json({ erro: 'item_catalogo_id e preco_unitario são obrigatórios' });
    }

    // Verificar se já existe
    const existente = await DB.selectOne('fornecedor_itens', {
      fornecedor_id: fornecedorId,
      item_catalogo_id
    });

    if (existente) {
      return res.status(409).json({ erro: 'Este produto já está no seu catálogo' });
    }

    const novo = await DB.insert('fornecedor_itens', {
      fornecedor_id: fornecedorId,
      item_catalogo_id,
      preco_unitario: parseFloat(preco_unitario),
      estoque_status: estoque_status || 'disponivel',
      ativo: true,
      criado_em: new Date()
    });

    res.status(201).json(novo);
  } catch (err) {
    console.error('❌ Erro ao adicionar produto:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// DELETE /api/fornecedor/catalogo/:id - Remover produto do catálogo
router.delete('/catalogo/:id', fornecedorMiddleware, async (req, res) => {
  try {
    const fornecedorId = req.fornecedorId;
    const { id } = req.params;

    await DB.update('fornecedor_itens', id, { ativo: false }, { fornecedor_id: fornecedorId });
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Erro ao remover produto:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;