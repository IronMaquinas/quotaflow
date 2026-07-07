const express = require("express");
const db = require("../db");
const { autenticar, requerPerfil } = require("./auth");
const router = express.Router();

router.use(autenticar);

const parse = (f) => ({
  ...f,
  contatos: f.contatos ? JSON.parse(f.contatos) : [],
  categorias: f.categorias ? JSON.parse(f.categorias) : [],
  dados_cnpj: f.dados_cnpj ? JSON.parse(f.dados_cnpj) : null,
});

// GET /api/fornecedores
router.get("/", (req, res) => {
  const lista = db.prepare("SELECT * FROM fornecedores WHERE ativo = 1 ORDER BY nome").all();
  res.json(lista.map(parse));
});

// GET /api/fornecedores/alertas-cnpj — CNPJs com problema (admin/gestor)
router.get("/alertas-cnpj", requerPerfil("gestor","admin"), (req, res) => {
  const alertas = db.prepare(`
    SELECT ca.*, f.nome as fornecedor_nome, f.cnpj
    FROM cnpj_alertas ca
    JOIN fornecedores f ON f.id = ca.fornecedor_id
    WHERE ca.lido = 0
    ORDER BY ca.detectado_em DESC
  `).all();
  res.json(alertas);
});

// POST /api/fornecedores
router.post("/", requerPerfil("comprador","gestor","admin"), (req, res) => {
  const { nome, razao_social, cnpj, situacao_cnpj, dados_cnpj, endereco, cidade, estado, cep, contatos, categorias, obs } = req.body;
  if (!nome) return res.status(400).json({ erro: "Nome é obrigatório." });
  const r = db.prepare(`
    INSERT INTO fornecedores (nome, razao_social, cnpj, situacao_cnpj, dados_cnpj, endereco, cidade, estado, cep, contatos, categorias, obs)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(nome, razao_social||"", cnpj||"", situacao_cnpj||"", JSON.stringify(dados_cnpj||null), endereco||"", cidade||"", estado||"", cep||"", JSON.stringify(contatos||[]), JSON.stringify(categorias||[]), obs||"");
  res.json({ id: r.lastInsertRowid, nome });
});

// PUT /api/fornecedores/:id
router.put("/:id", requerPerfil("comprador","gestor","admin"), (req, res) => {
  const { nome, razao_social, cnpj, situacao_cnpj, dados_cnpj, endereco, cidade, estado, cep, contatos, categorias, obs } = req.body;
  db.prepare(`
    UPDATE fornecedores SET nome=?, razao_social=?, cnpj=?, situacao_cnpj=?, dados_cnpj=?,
    endereco=?, cidade=?, estado=?, cep=?, contatos=?, categorias=?, obs=? WHERE id=?
  `).run(nome, razao_social||"", cnpj||"", situacao_cnpj||"", JSON.stringify(dados_cnpj||null), endereco||"", cidade||"", estado||"", cep||"", JSON.stringify(contatos||[]), JSON.stringify(categorias||[]), obs||"", req.params.id);
  res.json({ ok: true });
});

// DELETE /api/fornecedores/:id (soft delete)
router.delete("/:id", requerPerfil("comprador","gestor","admin"), (req, res) => {
  db.prepare("UPDATE fornecedores SET ativo = 0 WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
