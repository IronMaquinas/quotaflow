// routes/fornecedorProdutos.js
//
// Lista de preços do PRÓPRIO fornecedor (fornecedor_produtos) — upload em
// massa via CSV, independente de qualquer comprador/tenant. Autenticado
// via fornecedorMiddleware (mesmo padrão de routes/fornecedor.js).
//
// Upsert por (fornecedor_id, PN normalizado): PN já cadastrado -> atualiza
// preço/dados; PN novo -> insere. Item que sumiu do CSV não é removido
// automaticamente (decisão do usuário: fornecedor exclui manualmente se
// interromper o fornecimento de um item — não é prioridade agora).

const express = require('express');
const router = express.Router();
const { DB } = require('../db');
const fornecedorMiddleware = require('../middleware/fornecedorMiddleware');

// Réplica em JS da função SQL normalizar_pn(), pra decidir se uma linha
// do CSV já existe (mesmo PN, escrito diferente) ANTES de tentar
// insert/update — tem que dar exatamente o mesmo resultado que a coluna
// gerada no banco (upper + remove tudo que não é alfanumérico).
function normalizarPn(txt) {
  return String(txt || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Processa um chunk de linhas em paralelo (concorrência limitada, pra não
// abrir centenas de conexões simultâneas num CSV grande).
async function processarEmLotes(itens, tamanhoLote, fn) {
  const resultados = [];
  for (let i = 0; i < itens.length; i += tamanhoLote) {
    const lote = itens.slice(i, i + tamanhoLote);
    const resultadosLote = await Promise.all(lote.map(fn));
    resultados.push(...resultadosLote);
  }
  return resultados;
}

// POST /api/fornecedor/produtos/upload
// Body: { produtos: [{ pn, nome, descricao, categoria, marca, preco_unitario, unidade }, ...] }
router.post('/produtos/upload', fornecedorMiddleware, async (req, res) => {
  try {
    const fornecedorId = req.fornecedorId;
    const { produtos } = req.body;

    if (!Array.isArray(produtos) || produtos.length === 0) {
      return res.status(400).json({ erro: 'Nenhum produto enviado.' });
    }
    if (produtos.length > 20000) {
      return res.status(400).json({ erro: 'Lote grande demais (máximo 20000 linhas por upload). Divida o CSV em partes.' });
    }

    const linhasComIndice = produtos.map((p, idx) => ({ ...p, _linha: idx + 1 }));

    const resultados = await processarEmLotes(linhasComIndice, 20, async (item) => {
      const { _linha, pn, nome, descricao, categoria, marca, preco_unitario, unidade } = item;

      if (!nome || preco_unitario === undefined || preco_unitario === null || preco_unitario === '') {
        return { linha: _linha, status: 'erro', motivo: 'nome e preco_unitario são obrigatórios' };
      }
      const preco = parseFloat(preco_unitario);
      if (isNaN(preco) || preco <= 0) {
        return { linha: _linha, status: 'erro', motivo: 'preco_unitario inválido' };
      }

      const pnNormalizado = normalizarPn(pn);
      const valores = {
        nome_raw: nome,
        descricao_raw: descricao || null,
        categoria: categoria || null,
        marca: marca || null,
        preco_unitario: preco,
        unidade: unidade || null,
        ativo: true,
        atualizado_em: new Date()
      };

      try {
        if (pnNormalizado) {
          const existentes = await DB.select('fornecedor_produtos', {
            fornecedor_id: fornecedorId,
            pn_normalizado: pnNormalizado
          });

          if (existentes.length > 0) {
            await DB.update('fornecedor_produtos', existentes[0].id, valores);
            return { linha: _linha, status: 'atualizado', id: existentes[0].id };
          }
        }

        const novo = await DB.insert('fornecedor_produtos', {
          fornecedor_id: fornecedorId,
          pn_raw: pn || null,
          ...valores
        });
        return { linha: _linha, status: 'criado', id: novo.id };
      } catch (err) {
        return { linha: _linha, status: 'erro', motivo: err.message };
      }
    });

    const criados = resultados.filter(r => r.status === 'criado').length;
    const atualizados = resultados.filter(r => r.status === 'atualizado').length;
    const erros = resultados.filter(r => r.status === 'erro');

    res.json({
      ok: true,
      total_enviado: produtos.length,
      criados,
      atualizados,
      erros: erros.length,
      detalhe_erros: erros
    });
  } catch (err) {
    console.error('❌ Erro no upload de produtos:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/fornecedor/produtos/meus — lista o que este fornecedor já tem
// cadastrado (pra ele conferir o resultado do último upload).
router.get('/produtos/meus', fornecedorMiddleware, async (req, res) => {
  try {
    const fornecedorId = req.fornecedorId;
    const meus = await DB.select('fornecedor_produtos', { fornecedor_id: fornecedorId, ativo: true });
    meus.sort((a, b) => (a.nome_raw || '').localeCompare(b.nome_raw || ''));
    res.json(meus);
  } catch (err) {
    console.error('❌ Erro ao listar produtos:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/fornecedor/produtos — cria UM produto avulso (fora de CSV),
// mesma validação/normalização do upload em massa, sem fuzzy matching e
// sem depender de catalogo_itens de nenhum tenant.
router.post('/produtos', fornecedorMiddleware, async (req, res) => {
  try {
    const fornecedorId = req.fornecedorId;
    const { pn, nome, descricao, categoria, marca, preco_unitario, unidade } = req.body;

    if (!nome || preco_unitario === undefined || preco_unitario === null || preco_unitario === '') {
      return res.status(400).json({ erro: 'nome e preco_unitario são obrigatórios' });
    }
    const preco = parseFloat(preco_unitario);
    if (isNaN(preco) || preco <= 0) {
      return res.status(400).json({ erro: 'preco_unitario inválido' });
    }

    const pnNormalizado = normalizarPn(pn);
    if (pnNormalizado) {
      const existentes = await DB.select('fornecedor_produtos', {
        fornecedor_id: fornecedorId,
        pn_normalizado: pnNormalizado
      });
      if (existentes.length > 0) {
        return res.status(409).json({ erro: 'Já existe um produto seu com este PN. Edite o item existente.', id: existentes[0].id });
      }
    }

    const novo = await DB.insert('fornecedor_produtos', {
      fornecedor_id: fornecedorId,
      pn_raw: pn || null,
      nome_raw: nome,
      descricao_raw: descricao || null,
      categoria: categoria || null,
      marca: marca || null,
      preco_unitario: preco,
      unidade: unidade || null,
      ativo: true,
      atualizado_em: new Date()
    });
    res.status(201).json(novo);
  } catch (err) {
    console.error('❌ Erro ao criar produto:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// PUT /api/fornecedor/produtos/:id — edita UM produto já cadastrado
// (via CSV ou avulso). Ownership check: só edita produto do próprio
// fornecedor autenticado — nunca aceita id de outro fornecedor.
router.put('/produtos/:id', fornecedorMiddleware, async (req, res) => {
  try {
    const fornecedorId = req.fornecedorId;
    const produtoId = parseInt(req.params.id, 10);
    if (!produtoId || isNaN(produtoId)) {
      return res.status(400).json({ erro: 'ID de produto inválido' });
    }

    const existente = await DB.selectOne('fornecedor_produtos', { id: produtoId, fornecedor_id: fornecedorId });
    if (!existente) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    const { pn, nome, descricao, categoria, marca, preco_unitario, unidade } = req.body;

    if (!nome || preco_unitario === undefined || preco_unitario === null || preco_unitario === '') {
      return res.status(400).json({ erro: 'nome e preco_unitario são obrigatórios' });
    }
    const preco = parseFloat(preco_unitario);
    if (isNaN(preco) || preco <= 0) {
      return res.status(400).json({ erro: 'preco_unitario inválido' });
    }

    // Se o PN mudou, confere que não colide com outro produto deste
    // mesmo fornecedor (pn_normalizado é único por fornecedor na prática,
    // via upsert do upload — aqui só evitamos criar duplicata por edição manual).
    const pnNormalizado = normalizarPn(pn);
    if (pnNormalizado) {
      const colisao = await DB.select('fornecedor_produtos', {
        fornecedor_id: fornecedorId,
        pn_normalizado: pnNormalizado
      });
      if (colisao.some(c => Number(c.id) !== produtoId)) {
        return res.status(409).json({ erro: 'Já existe outro produto seu com este PN.' });
      }
    }

    const atualizado = await DB.update('fornecedor_produtos', produtoId, {
      pn_raw: pn || null,
      nome_raw: nome,
      descricao_raw: descricao || null,
      categoria: categoria || null,
      marca: marca || null,
      preco_unitario: preco,
      unidade: unidade || null,
      atualizado_em: new Date()
    });
    res.json(atualizado);
  } catch (err) {
    console.error('❌ Erro ao editar produto:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// DELETE /api/fornecedor/produtos/:id — remove (soft delete: ativo=false)
// um produto do próprio fornecedor.
router.delete('/produtos/:id', fornecedorMiddleware, async (req, res) => {
  try {
    const fornecedorId = req.fornecedorId;
    const produtoId = parseInt(req.params.id, 10);
    if (!produtoId || isNaN(produtoId)) {
      return res.status(400).json({ erro: 'ID de produto inválido' });
    }

    const existente = await DB.selectOne('fornecedor_produtos', { id: produtoId, fornecedor_id: fornecedorId });
    if (!existente) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    await DB.update('fornecedor_produtos', produtoId, { ativo: false, atualizado_em: new Date() });
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Erro ao remover produto:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
