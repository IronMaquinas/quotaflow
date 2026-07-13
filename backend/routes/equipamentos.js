const express = require("express");
const router = express.Router();
const { DB } = require("../db");
const tenantMiddleware = require("../middleware/tenantMiddleware");

router.get("/", tenantMiddleware, async (req, res) => {
  try {
    console.log('📥 GET /equipamentos tenant:', req.tenantId);
    const equipamentos = await DB.select("equipamentos", {}, req.tenantId);
    console.log('📦 Equipamentos encontrados:', equipamentos);
    res.json(equipamentos);
  } catch (err) {
    console.error('❌ Erro ao listar equipamentos:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

router.post("/", tenantMiddleware, async (req, res) => {
  try {
    console.log('📥 POST /equipamentos dados recebidos:', req.body);
    const eq = await DB.insert("equipamentos", req.body, req.tenantId);
    console.log('✅ Equipamento criado:', eq);
    res.status(201).json(eq);
  } catch (err) {
    console.error('❌ Erro ao criar equipamento:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

router.put("/:id", tenantMiddleware, async (req, res) => {
  try {
    await DB.update("equipamentos", req.params.id, req.body, req.tenantId);
    const eq = await DB.selectOne("equipamentos", { id: req.params.id }, req.tenantId);
    res.json(eq);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.delete("/:id", tenantMiddleware, async (req, res) => {
  try {
    await DB.delete("equipamentos", req.params.id, req.tenantId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;