// routes/configuracoes.js
//
// Configurações do tenant: jornada de trabalho e feriados.
// v1: 1 jornada padrão + feriados livres (multi-país).
// Schema já suporta múltiplas jornadas (turnos) para v2.

const express = require('express');
const router = express.Router();
const { DB } = require('../db');
const tenantMiddleware = require('../middleware/tenantMiddleware');

async function usuarioAtual(req, tenantId) {
  let nome = null;
  if (req.userId) {
    try {
      const u = await DB.selectOne("usuarios", { id: req.userId }, tenantId);
      nome = u?.nome || null;
    } catch (_) {}
  }
  return { id: req.userId || null, nome };
}

// ─────────────────────────────────────────────────────────────────────────
// GET /api/configuracoes/jornada
// Devolve a jornada padrão do tenant (ou a primeira ativa).
// ─────────────────────────────────────────────────────────────────────────
router.get('/jornada', tenantMiddleware, async (req, res) => {
  try {
    const jornadas = await DB.select("tenant_jornadas", {
      tenant_id: req.tenantId, ativo: true,
    }, req.tenantId);
    jornadas.sort((a, b) => (b.padrao ? 1 : 0) - (a.padrao ? 1 : 0));
    res.json(jornadas[0] || null);
  } catch (err) {
    console.error("❌ Erro ao buscar jornada:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/configuracoes/jornada
// Cria ou atualiza a jornada padrão. Upsert simples — se já existe uma
// jornada padrão, atualiza; senão cria.
// ─────────────────────────────────────────────────────────────────────────
router.post('/jornada', tenantMiddleware, async (req, res) => {
  try {
    const {
      nome, hora_inicio_min, hora_fim_min,
      possui_intervalo, intervalo_inicio_min, intervalo_fim_min, descontar_intervalo,
      calcular_extra_auto, tolerancia_extra_min,
      regra_segunda, regra_terca, regra_quarta, regra_quinta, regra_sexta,
      regra_sabado, regra_domingo,
    } = req.body;

    if (hora_inicio_min == null || hora_fim_min == null) {
      return res.status(400).json({ erro: "hora_inicio_min e hora_fim_min são obrigatórios" });
    }
    if (hora_inicio_min >= hora_fim_min) {
      return res.status(400).json({ erro: "Hora de início deve ser anterior à hora de fim" });
    }
    if (possui_intervalo) {
      if (intervalo_inicio_min == null || intervalo_fim_min == null) {
        return res.status(400).json({ erro: "Informe início e fim do intervalo" });
      }
      if (intervalo_inicio_min >= intervalo_fim_min) {
        return res.status(400).json({ erro: "Início do intervalo deve ser anterior ao fim" });
      }
    }

    const payload = {
      tenant_id: req.tenantId,
      nome: nome || "Jornada padrão",
      padrao: true,
      hora_inicio_min: parseInt(hora_inicio_min),
      hora_fim_min: parseInt(hora_fim_min),
      possui_intervalo: !!possui_intervalo,
      intervalo_inicio_min: possui_intervalo ? parseInt(intervalo_inicio_min) : null,
      intervalo_fim_min: possui_intervalo ? parseInt(intervalo_fim_min) : null,
      descontar_intervalo: !!descontar_intervalo,
      calcular_extra_auto: calcular_extra_auto !== false,
      tolerancia_extra_min: parseInt(tolerancia_extra_min) || 0,
      regra_segunda: regra_segunda || "normal",
      regra_terca: regra_terca || "normal",
      regra_quarta: regra_quarta || "normal",
      regra_quinta: regra_quinta || "normal",
      regra_sexta: regra_sexta || "normal",
      regra_sabado: regra_sabado || "normal",
      regra_domingo: regra_domingo || "excepcional",
      ativo: true,
      atualizado_em: new Date().toISOString(),
    };

    // Upsert: procura jornada padrão existente
    const existentes = await DB.select("tenant_jornadas", {
      tenant_id: req.tenantId, padrao: true, ativo: true,
    }, req.tenantId);

    let resultado;
    if (existentes.length > 0) {
      resultado = await DB.update("tenant_jornadas", existentes[0].id, payload, req.tenantId);
    } else {
      resultado = await DB.insert("tenant_jornadas", payload, req.tenantId);
    }

    res.json({ ok: true, jornada: resultado });
  } catch (err) {
    console.error("❌ Erro ao salvar jornada:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/configuracoes/feriados?ano=2026
// Lista feriados do tenant (opcionalmente filtrado por ano).
// ─────────────────────────────────────────────────────────────────────────
router.get('/feriados', tenantMiddleware, async (req, res) => {
  try {
    const ano = req.query.ano ? parseInt(req.query.ano) : null;
    let feriados = await DB.select("tenant_feriados", { tenant_id: req.tenantId }, req.tenantId);
    if (ano) {
      feriados = feriados.filter(f => new Date(f.data).getFullYear() === ano);
    }
    feriados.sort((a, b) => new Date(a.data) - new Date(b.data));
    res.json(feriados);
  } catch (err) {
    console.error("❌ Erro ao listar feriados:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/configuracoes/feriados
// Body: { data: 'YYYY-MM-DD', nome, tipo, pais? }
// ─────────────────────────────────────────────────────────────────────────
router.post('/feriados', tenantMiddleware, async (req, res) => {
  try {
    const { data, nome, tipo, pais } = req.body;
    if (!data) return res.status(400).json({ erro: "data é obrigatória (YYYY-MM-DD)" });
    if (!nome) return res.status(400).json({ erro: "nome é obrigatório" });

    const u = await usuarioAtual(req, req.tenantId);
    const feriado = await DB.insert("tenant_feriados", {
      tenant_id: req.tenantId,
      data,
      nome: nome.trim(),
      tipo: tipo || "nacional",
      pais: pais || null,
      parcial: false,
      criado_por: u.id,
      criado_por_nome: u.nome,
    }, req.tenantId);

    res.status(201).json({ ok: true, feriado });
  } catch (err) {
    console.error("❌ Erro ao criar feriado:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUT /api/configuracoes/feriados/:id
// ─────────────────────────────────────────────────────────────────────────
router.put('/feriados/:id', tenantMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, nome, tipo, pais } = req.body;

    const feriado = await DB.selectOne("tenant_feriados", { id, tenant_id: req.tenantId }, req.tenantId);
    if (!feriado) return res.status(404).json({ erro: "Feriado não encontrado" });

    const upd = {};
    if (data !== undefined) upd.data = data;
    if (nome !== undefined) upd.nome = nome;
    if (tipo !== undefined) upd.tipo = tipo;
    if (pais !== undefined) upd.pais = pais;

    const atualizado = await DB.update("tenant_feriados", id, upd, req.tenantId);
    res.json({ ok: true, feriado: atualizado });
  } catch (err) {
    console.error("❌ Erro ao atualizar feriado:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// DELETE /api/configuracoes/feriados/:id
// ─────────────────────────────────────────────────────────────────────────
router.delete('/feriados/:id', tenantMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const feriado = await DB.selectOne("tenant_feriados", { id, tenant_id: req.tenantId }, req.tenantId);
    if (!feriado) return res.status(404).json({ erro: "Feriado não encontrado" });
    await DB.delete("tenant_feriados", id, req.tenantId);
    res.json({ ok: true, mensagem: "Feriado removido" });
  } catch (err) {
    console.error("❌ Erro ao remover feriado:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;