// backend/middleware/plataformaMiddleware.js
//
// Autenticação do Console da Plataforma (etapa 11b) — rotas /api/plataforma/*.
//
// Separado de propósito do login de transportadora e de fornecedor:
//   • tabela própria (plataforma_admins), token próprio;
//   • o token é assinado com OUTRA chave (PLATAFORMA_JWT_SECRET, ou derivada do
//     JWT_SECRET) — assim um token de admin NUNCA é aceito pelo tenantMiddleware
//     nem pelo fornecedorMiddleware (que, sem tenant_id, poderiam devolver dados
//     de todos os tenants), e vice-versa;
//   • defesa em dobro: além de estar na tabela e ativo, o e-mail precisa estar
//     na variável PLATAFORMA_ADMINS (lista separada por vírgula).

const jwt = require('jsonwebtoken');
const { DB } = require('../db');

function segredoPlataforma() {
  const proprio = process.env.PLATAFORMA_JWT_SECRET;
  if (proprio && proprio.length >= 16) return proprio;
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET não configurado');
  return `${process.env.JWT_SECRET}::console-plataforma`;
}

function emailsAutorizados() {
  return String(process.env.PLATAFORMA_ADMINS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

const emailAutorizado = (email) => emailsAutorizados().includes(String(email || '').trim().toLowerCase());

function gerarTokenPlataforma(admin) {
  return jwt.sign(
    { plataforma_admin_id: admin.id, email: admin.email, tipo: 'plataforma' },
    segredoPlataforma(),
    { expiresIn: '12h' }
  );
}

async function plataformaMiddleware(req, res, next) {
  try {
    const cab = req.headers.authorization || '';
    const token = cab.startsWith('Bearer ') ? cab.slice(7) : null;
    if (!token) return res.status(401).json({ erro: 'Faça login no console.' });

    let dados;
    try {
      dados = jwt.verify(token, segredoPlataforma());
    } catch {
      return res.status(401).json({ erro: 'Sessão do console expirada. Entre de novo.' });
    }
    if (dados.tipo !== 'plataforma' || !dados.plataforma_admin_id) {
      return res.status(401).json({ erro: 'Token inválido para o console.' });
    }

    const admin = await DB.selectOne('plataforma_admins', { id: dados.plataforma_admin_id });
    if (!admin || admin.ativo === false || !emailAutorizado(admin.email)) {
      return res.status(403).json({ erro: 'Acesso ao console não autorizado.' });
    }
    req.plataformaAdmin = { id: admin.id, email: admin.email, nome: admin.nome };
    next();
  } catch (err) {
    console.error('❌ plataformaMiddleware:', err.message);
    res.status(500).json({ erro: 'Erro na autenticação do console' });
  }
}

module.exports = { plataformaMiddleware, gerarTokenPlataforma, emailAutorizado, emailsAutorizados };
