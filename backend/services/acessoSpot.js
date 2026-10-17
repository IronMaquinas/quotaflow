// backend/services/acessoSpot.js
//
// FONTE ÚNICA da regra de acesso do FORNECEDOR ao Canal Spot (etapa 10c).
//
// Decisão de produto (17/10/2026): só fornecedor VERIFICADO pela plataforma
// (tipo 'global') vê e responde demandas spot.
//
// Motivo (compliance): a demanda spot expõe empresa, nome, e-mail e telefone do
// comprador para a rede inteira. Fornecedor LOCAL é cadastrado/convidado por um
// tenant, sem análise da plataforma — uma empresa poderia criar uma conta de
// cliente, cadastrar fornecedores "laranja" e ter acesso às demandas e aos
// contatos de todos os tenants. Para ver o Spot, o fornecedor passa pela
// verificação (etapa 11b) e vira global.
//
// Usado por: routes/spot.js (rotas do fornecedor), routes/fornecedor.js
// (/me e /painel), services/recomendacoesEmail.js (e-mails Pro).

const { DB } = require('../db');

const CODIGO_BLOQUEIO = 'spot_requer_verificacao';
const MENSAGEM_BLOQUEIO =
  'O Canal Spot é exclusivo para fornecedores verificados pela plataforma. ' +
  'Sua empresa continua recebendo normalmente as cotações e pedidos dos seus clientes.';

function podeVerSpot(fornecedor) {
  return !!fornecedor && fornecedor.tipo === 'global';
}

// Middleware: usar DEPOIS do fornecedorMiddleware (precisa de req.fornecedorId)
async function exigirAcessoSpot(req, res, next) {
  try {
    const f = await DB.selectOne('fornecedores', { id: req.fornecedorId });
    if (!podeVerSpot(f)) {
      return res.status(403).json({ erro: MENSAGEM_BLOQUEIO, codigo: CODIGO_BLOQUEIO });
    }
    next();
  } catch (err) {
    console.error('❌ exigirAcessoSpot:', err.message);
    res.status(500).json({ erro: 'Erro ao verificar acesso ao Canal Spot' });
  }
}

module.exports = { podeVerSpot, exigirAcessoSpot, CODIGO_BLOQUEIO, MENSAGEM_BLOQUEIO };
