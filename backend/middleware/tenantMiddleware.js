// ════════════════════════════════════════════════════════════════════════════════
// middleware/tenantMiddleware.js: Extrai tenant_id do JWT
// ════════════════════════════════════════════════════════════════════════════════

const jwt = require("jsonwebtoken");

/**
 * Middleware: Extrai tenant_id do JWT e injeta em req.tenantId
 * 
 * O JWT deve ter payload:
 * {
 *   user_id: "uuid",
 *   tenant_id: 1,
 *   email: "user@example.com",
 *   perfil: "admin"
 * }
 */
function tenantMiddleware(req, res, next) {
  try {
    // Extrair token do header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ erro: "Token obrigatório" });
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    // Verificar e decodificar JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Injetar tenant_id e user_id em req para usar nas rotas
    req.tenantId = decoded.tenant_id;
    req.userId = decoded.user_id;
    req.userEmail = decoded.email;
    req.userPerfil = decoded.perfil;

    // Log para debug (remover em produção)
    console.log(`[TENANT] User: ${req.userEmail} (${decoded.user_id}) | Tenant: ${req.tenantId}`);

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ erro: "Token expirado" });
    }
    return res.status(401).json({ erro: "Token inválido", details: err.message });
  }
}

module.exports = tenantMiddleware;
