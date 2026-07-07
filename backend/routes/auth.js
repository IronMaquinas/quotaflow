const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_troque_em_producao";

// Middleware de autenticação — use em rotas protegidas
function autenticar(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ erro: "Token não fornecido." });
  const token = header.replace("Bearer ", "");
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: "Token inválido ou expirado." });
  }
}

// Middleware de perfil mínimo
function requerPerfil(...perfis) {
  return (req, res, next) => {
    if (!perfis.includes(req.usuario?.perfil))
      return res.status(403).json({ erro: "Acesso negado para seu perfil." });
    next();
  };
}

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: "E-mail e senha obrigatórios." });

  const usuario = db.prepare("SELECT * FROM usuarios WHERE email = ? AND ativo = 1").get(email);
  if (!usuario) return res.status(401).json({ erro: "E-mail não cadastrado ou usuário inativo." });

  const senhaOk = bcrypt.compareSync(senha, usuario.senha_hash);
  if (!senhaOk) return res.status(401).json({ erro: "Senha incorreta." });

  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({
    token,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil }
  });
});

// GET /api/auth/me — valida token e retorna dados do usuário
router.get("/me", autenticar, (req, res) => {
  const u = db.prepare("SELECT id, nome, email, perfil FROM usuarios WHERE id = ?").get(req.usuario.id);
  res.json(u);
});

module.exports = router;
module.exports.autenticar = autenticar;
module.exports.requerPerfil = requerPerfil;
