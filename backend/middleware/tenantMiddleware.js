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

    // M4.6: array de perfis (multi-perfil). Fallback pro single se
    // o token for antigo (usuário não relogou depois da migração).
    req.perfis = Array.isArray(decoded.perfis) && decoded.perfis.length > 0
      ? decoded.perfis
      : [decoded.perfil].filter(Boolean);

    // Etapa 12e.2b: perfil "colaborador" (sozinho) só acessa "Meus treinamentos" e o próprio cadastro.
    // Fica AQUI porque várias rotas só exigem o login — sem isso o colaborador chamaria a API inteira.
    if (req.perfis.length > 0 && req.perfis.every((p) => p === "colaborador")) {
      const url = String(req.originalUrl || "").split("?")[0];
      const livre = /^\/api\/meus-treinamentos(\/|$)/.test(url) || /^\/api\/usuarios\/me(\/|$)/.test(url) || /^\/api\/auth\//.test(url);
      if (!livre) return res.status(403).json({ erro: "Seu acesso é só a Meus treinamentos" });
    }

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ erro: "Token expirado" });
    }
    return res.status(401).json({ erro: "Token inválido", details: err.message });
  }
}

module.exports = tenantMiddleware;
