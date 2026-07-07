const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { autenticar, requerPerfil } = require("./auth");
const router = express.Router();

// Todos os endpoints requerem admin
router.use(autenticar, requerPerfil("admin"));

// GET /api/usuarios
router.get("/", (req, res) => {
  const usuarios = db.prepare("SELECT id, nome, email, perfil, ativo, criado_em FROM usuarios ORDER BY nome").all();
  res.json(usuarios);
});

// POST /api/usuarios
router.post("/", (req, res) => {
  const { nome, email, senha, perfil, ativo = 1 } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: "Nome, e-mail e senha obrigatórios." });
  const hash = bcrypt.hashSync(senha, 10);
  try {
    const r = db.prepare("INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo) VALUES (?,?,?,?,?)").run(nome, email, hash, perfil || "comprador", ativo ? 1 : 0);
    res.json({ id: r.lastInsertRowid, nome, email, perfil, ativo });
  } catch (e) {
    if (e.message.includes("UNIQUE")) return res.status(400).json({ erro: "E-mail já cadastrado." });
    throw e;
  }
});

// PUT /api/usuarios/:id
router.put("/:id", (req, res) => {
  const { nome, email, senha, perfil, ativo } = req.body;
  const u = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(req.params.id);
  if (!u) return res.status(404).json({ erro: "Usuário não encontrado." });

  // Impedir remover o último admin
  if (u.perfil === "admin" && perfil !== "admin") {
    const qtdAdmins = db.prepare("SELECT COUNT(*) as n FROM usuarios WHERE perfil='admin' AND ativo=1").get().n;
    if (qtdAdmins <= 1) return res.status(400).json({ erro: "Não é possível remover o último administrador." });
  }

  const hash = senha ? bcrypt.hashSync(senha, 10) : u.senha_hash;
  db.prepare("UPDATE usuarios SET nome=?, email=?, senha_hash=?, perfil=?, ativo=? WHERE id=?")
    .run(nome || u.nome, email || u.email, hash, perfil || u.perfil, ativo !== undefined ? (ativo ? 1 : 0) : u.ativo, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
