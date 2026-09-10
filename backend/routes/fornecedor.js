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
// FIX (2026-09, grave): mesmo problema do GET /catalogo — esse JOIN de 3
// tabelas não bate com nenhum padrão que DB.raw() reconhece, então caía no
// fallback genérico ("SELECT * FROM interesses_spot" só com o filtro de
// tenant_id, quando a regex do fallback conseguia achar esse pedaço da
// query — o filtro de fornecedor_id era sempre ignorado). Confirmado com
// teste real: fornecedor 1 via a mensagem privada de interesse do
// fornecedor 2 na mesma demanda, e nenhum dos campos da OS/demanda
// (componente, urgência etc.) vinha preenchido. Reescrito sem raw().
router.get('/interesses', fornecedorMiddleware, async (req, res) => {
  try {
    const fornecedorId = req.fornecedorId;
    const fornecedor = await DB.selectOne('fornecedores', { id: fornecedorId });
    const tenantId = fornecedor.tenant_id;

    const meusInteresses = await DB.select('interesses_spot', { fornecedor_id: fornecedorId }, tenantId);

    const interessesCompletos = await Promise.all(meusInteresses.map(async (i) => {
      const demanda = await DB.selectOne('demandas_spot', { id: i.demanda_id });
      const tenant = demanda ? await DB.selectOne('tenants', { id: demanda.tenant_id }) : null;
      return {
        ...i,
        componente: demanda?.componente ?? null,
        descricao_equipamento: demanda?.descricao_equipamento ?? null,
        quantidade: demanda?.quantidade ?? null,
        urgencia: demanda?.urgencia ?? null,
        demanda_status: demanda?.status ?? null,
        empresa_nome: tenant?.nome ?? null
      };
    }));

    interessesCompletos.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));

    res.json(interessesCompletos);
  } catch (err) {
    console.error('❌ Erro ao listar interesses:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/fornecedor/catalogo - Listar produtos do fornecedor
// FIX (2026-09, grave): esse JOIN não está entre os poucos padrões de SQL
// que DB.raw() reconhece de verdade, então caía no fallback genérico —
// que faz "SELECT * FROM <primeira tabela do FROM>" IGNORANDO o JOIN, as
// colunas pedidas E o WHERE fi.fornecedor_id = $1. Na prática, todo
// fornecedor autenticado via essa rota via o catálogo de preços de TODOS
// os fornecedores da base, não só o próprio — vazamento de dado
// confidencial (confirmado com teste real: fornecedor 1 via o preço do
// fornecedor 2). Reescrito sem raw(): busca só os itens do próprio
// fornecedor via DB.select (filtro de verdade), depois busca os dados do
// catálogo relacionado e junta em JS.
router.get('/catalogo', fornecedorMiddleware, async (req, res) => {
  try {
    const fornecedorId = req.fornecedorId;

    const meusItens = await DB.select('fornecedor_itens', {
      fornecedor_id: fornecedorId,
      ativo: true
    });

    const itensComCatalogo = await Promise.all(meusItens.map(async (fi) => {
      const ci = await DB.selectOne('catalogo_itens', { id: fi.item_catalogo_id });
      return {
        id: fi.id,
        preco_unitario: fi.preco_unitario,
        estoque_status: fi.estoque_status,
        data_tabela: fi.data_tabela,
        item_catalogo_id: ci?.id ?? fi.item_catalogo_id,
        nome: ci?.nome ?? null,
        codigo: ci?.codigo ?? null,
        categoria: ci?.categoria ?? null
      };
    }));

    itensComCatalogo.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    res.json(itensComCatalogo);
  } catch (err) {
    console.error('❌ Erro ao listar catálogo:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/fornecedor/catalogo - Adicionar produto ao catálogo
// FIX (2026-09): fornecedor_itens.tenant_id é NOT NULL, mas o insert nunca
// preenchia esse campo (DB.insert só recebia 2 argumentos) — toda chamada
// quebrava com "null value in column tenant_id violates not-null
// constraint". O tenant_id certo aqui não é o do fornecedor (fornecedores.
// tenant_id é quem cadastrou esse fornecedor como vendor) — é o tenant DONO
// do item de catálogo (catalogo_itens.tenant_id), já que o preço que o
// fornecedor está cadastrando é especificamente pro catálogo daquele
// comprador. Também passou a validar que o item de catálogo existe antes de
// tentar o insert, em vez de deixar a FK estourar um erro cru.
router.post('/catalogo', fornecedorMiddleware, async (req, res) => {
  try {
    const fornecedorId = req.fornecedorId;
    const { item_catalogo_id, preco_unitario, estoque_status } = req.body;

    if (!item_catalogo_id || !preco_unitario) {
      return res.status(400).json({ erro: 'item_catalogo_id e preco_unitario são obrigatórios' });
    }

    const itemCatalogo = await DB.selectOne('catalogo_itens', { id: item_catalogo_id });
    if (!itemCatalogo) {
      return res.status(404).json({ erro: 'Item de catálogo não encontrado' });
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
      tenant_id: itemCatalogo.tenant_id,
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
// FIX (2026-09): DB.update só sabe filtrar por tenant_id (um valor único,
// vira "AND tenant_id = $N"), mas esta rota passava um OBJETO
// { fornecedor_id: fornecedorId } nesse parâmetro — quebrava com erro de
// tipo do Postgres ("invalid input syntax for type integer"), então a
// exclusão nunca funcionou. Pior: como o erro só estourava DEPOIS da
// tentativa, não existia nenhuma verificação real de que o item pertence a
// este fornecedor — se não fosse o erro de tipo, qualquer fornecedor
// autenticado poderia desativar item de catálogo de outro fornecedor só
// adivinhando o id. Agora busca o item primeiro e confirma o dono antes de
// desativar.
router.delete('/catalogo/:id', fornecedorMiddleware, async (req, res) => {
  try {
    const fornecedorId = req.fornecedorId;
    const { id } = req.params;

    const item = await DB.selectOne('fornecedor_itens', { id });
    if (!item) {
      return res.status(404).json({ erro: 'Item não encontrado' });
    }
    if (item.fornecedor_id !== fornecedorId) {
      return res.status(403).json({ erro: 'Este item não pertence ao seu catálogo' });
    }

    await DB.update('fornecedor_itens', id, { ativo: false }, item.tenant_id);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Erro ao remover produto:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;