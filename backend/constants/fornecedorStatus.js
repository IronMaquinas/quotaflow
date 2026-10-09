// backend/constants/fornecedorStatus.js
//
// M4.4-etapa-9d: whitelist canônica de status visíveis ao fornecedor.
// Fica em módulo próprio pra evitar `require` circular entre
// routes/fornecedorNC.js e services/NCService.js.
const STATUS_VISIVEIS_FORNECEDOR = [
  'enviado', 'visualizado', 'contestada', 'resolvida_fornecedor', 'devolvida',
];

module.exports = { STATUS_VISIVEIS_FORNECEDOR };