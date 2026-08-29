// middleware/fornecedorMiddleware.js
const jwt = require('jsonwebtoken');
const { DB } = require('../db');

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ erro: 'Token obrigatório' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await DB.selectOne('fornecedor_usuarios', { id: decoded.user_id });

    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ erro: 'Usuário inválido ou desativado' });
    }

    req.fornecedorId = usuario.fornecedor_id;
    req.userId = usuario.id;
    req.userPerfil = usuario.perfil;
    req.tenantId = null;
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido' });
  }
};