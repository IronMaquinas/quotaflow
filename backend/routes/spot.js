// backend/routes/spot.js
const express = require('express');
const router = express.Router();
const { DB } = require('../db');
const tenantMiddleware = require('../middleware/tenantMiddleware');
const fornecedorMiddleware = require('../middleware/fornecedorMiddleware');

// ─── COMPRADOR ────────────────────────────────────────────────

router.get('/demandas', tenantMiddleware, async (req, res) => {
  try {
    const demandas = await DB.select('demandas_spot', {}, req.tenantId);
    const interesses = await DB.select('interesses_spot', {}, req.tenantId);

    const fornIds = [...new Set(interesses.map(i => i.fornecedor_id))];
    const fornecedores = fornIds.length
      ? await DB.select('fornecedores_spot', {})
      : [];
    const fornById = {};
    for (const f of fornecedores) fornById[f.id] = f;

    const visualizacoes = await DB.select('demandas_spot_visualizacoes', {});
    const visPorDemanda = {};
    for (const v of visualizacoes) {
      visPorDemanda[v.demanda_id] = (visPorDemanda[v.demanda_id] || 0) + 1;
    }

    const result = (demandas || []).map(d => {
      const meus = interesses.filter(i => i.demanda_id === d.id);
      return {
        ...d,
        total_interesses: meus.length,
        total_visualizacoes: visPorDemanda[d.id] || 0,
        visualizada: !!d.visualizada_em,
        visualizada_em: d.visualizada_em || null,
        interesses: meus.map(i => ({
          id: i.id,
          fornecedor_id: i.fornecedor_id,
          fornecedor_nome: fornById[i.fornecedor_id]?.nome || 'Fornecedor',
          mensagem: i.mensagem,
          status: i.status,
          criado_em: i.criado_em,
        })),
      };
    });

    res.json(result);
  } catch (err) {
    console.error('❌ GET /spot/demandas:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─── FORNECEDOR ───────────────────────────────────────────────

// Marca que o fornecedor viu a demanda (idempotente: só grava a 1ª vez)
router.post('/fornecedor/demandas/:id/visualizar', fornecedorMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const demanda = await DB.selectOne('demandas_spot', { id });
    if (!demanda) return res.status(404).json({ erro: 'Demanda não encontrada' });

    // Registra visualização única por fornecedor
    const ja = await DB.selectOne('demandas_spot_visualizacoes', {
      demanda_id: id,
      fornecedor_id: req.fornecedorId,
    });
    if (!ja) {
      await DB.insert('demandas_spot_visualizacoes', {
        demanda_id: id,
        fornecedor_id: req.fornecedorId,
      });
    }

    // Marca a primeira visualização global (compatibilidade)
    if (!demanda.visualizada_em) {
      await DB.update('demandas_spot', id, {
        visualizada_em: new Date().toISOString(),
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ POST /spot/fornecedor/demandas/:id/visualizar:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

router.get('/fornecedor/demandas', fornecedorMiddleware, async (req, res) => {
  try {
    const demandas = await DB.select('demandas_spot', {});
    const meusInteresses = await DB.select('interesses_spot', { fornecedor_id: req.fornecedorId });
    const idsMeus = new Set(meusInteresses.map(i => i.demanda_id));
    res.json((demandas || []).map(d => ({ ...d, ja_interesse: idsMeus.has(d.id) })));
  } catch (err) {
    console.error('❌ GET /spot/fornecedor/demandas:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /spot/demandas — criar demanda
router.post('/demandas', tenantMiddleware, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.descricao_equipamento || !b.componente || !b.quantidade) {
      return res.status(400).json({ erro: 'descricao_equipamento, componente e quantidade obrigatórios' });
    }
    const demanda = await DB.insert('demandas_spot', {
      tenant_id: req.tenantId,
      comprador_id: req.userId,
      descricao_equipamento: String(b.descricao_equipamento).trim(),
      marca_modelo: b.marca_modelo ? String(b.marca_modelo).trim() : null,
      componente: String(b.componente).trim(),
      part_number: b.part_number ? String(b.part_number).trim() : null,
      quantidade: Number(b.quantidade),
      comentarios: b.comentarios ? String(b.comentarios).trim() : null,
      urgencia: b.urgencia || 'media',
      status: 'aberta',
    }, req.tenantId);
    res.status(201).json({ ok: true, demanda });
  } catch (err) {
    console.error('❌ POST /spot/demandas:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

router.post('/fornecedor/interesse', fornecedorMiddleware, async (req, res) => {
  try {
    const { demanda_id, mensagem } = req.body;
    if (!demanda_id) return res.status(400).json({ erro: 'demanda_id obrigatório' });

    const demanda = await DB.selectOne('demandas_spot', { id: demanda_id });
    if (!demanda) return res.status(404).json({ erro: 'Demanda não encontrada' });
    if (demanda.status === 'encerrada') return res.status(400).json({ erro: 'Demanda encerrada' });

    const ja = await DB.selectOne('interesses_spot', { demanda_id, fornecedor_id: req.fornecedorId });
    if (ja) return res.status(409).json({ erro: 'Interesse já registrado' });

    const interesse = await DB.insert('interesses_spot', {
      demanda_id,
      tenant_id: demanda.tenant_id,
      fornecedor_id: req.fornecedorId,
      mensagem: (mensagem || '').trim(),
      status: 'pendente',
    });

    res.status(201).json({ ok: true, interesse });
  } catch (err) {
    console.error('❌ POST /spot/fornecedor/interesse:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;