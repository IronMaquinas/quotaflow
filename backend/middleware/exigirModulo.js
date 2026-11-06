// backend/middleware/exigirModulo.js — etapa 18k: 🧩 bloqueio no backend dos módulos não contratados
//
// Uso: app.use('/api/comercial', tenantMiddleware, exigirModulo('crm_bid'), router)
//      exigirModulo(['transporte', 'contratos_locacao'])  → basta UM ligado
//      exigirModulo('colaboradores', { somenteEscrita: true }) → leitura liberada (cadastro compartilhado por outras telas)
// Empresa com tenants.modulos NULL (tudo ligado) ou sem a migration 071 passa sempre.
// Responde 409 (nunca 403 — o 403 derruba a sessão no front) com { erro, modulo_nao_contratado }.
const { supabase } = require('../db');
const MOD = require('../services/modulos');

const CACHE_MS = 30000;
const cache = new Map(); // tenantId → { em, ativos: Set | null }
function limparCache(tenantId) { if (tenantId == null) cache.clear(); else cache.delete(String(tenantId)); }
async function ativosDoTenant(tenantId) {
  const k = String(tenantId); const c = cache.get(k);
  if (c && Date.now() - c.em < CACHE_MS) return c.ativos;
  let ativos = null;
  try { const { data } = await supabase.from('tenants').select('*').eq('id', tenantId); const t = data?.[0]; ativos = t && Array.isArray(t.modulos) ? new Set(MOD.ativosDe(t)) : null; } catch { ativos = null; } // na dúvida, não bloqueia
  cache.set(k, { em: Date.now(), ativos });
  return ativos;
}
function exigirModulo(ids, { somenteEscrita = false } = {}) {
  const lista = Array.isArray(ids) ? ids : [ids];
  const nome = lista.map((id) => MOD.MODULOS.find((m) => m.id === id)?.nome || id).join(' ou ');
  return async (req, res, next) => {
    if (somenteEscrita && ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.tenantId == null) return next();
    const ativos = await ativosDoTenant(req.tenantId);
    if (!ativos || lista.some((id) => ativos.has(id))) return next();
    return res.status(409).json({ erro: `O módulo "${nome}" não está no plano da empresa. Veja ⭐ Meu plano.`, modulo_nao_contratado: lista[0] });
  };
}
module.exports = { exigirModulo, limparCache, _ativosDoTenant: ativosDoTenant };
