// backend/services/fornecedoresVisiveis.js
//
// FONTE ÚNICA da regra "quais fornecedores este tenant pode usar":
//   locais do próprio tenant + globais da plataforma,
//   menos os globais que o tenant desativou para si (tenant_fornecedores.ativo = false).
//
// Global é identificado por `tipo = 'global'`, nunca por tenant_id — funciona com o
// global ainda no tenant_id antigo ou já com tenant_id NULL.
//
// Usado por services/CotacaoService.js e routes/buscaFornecedores.js.
// (routes/fornecedores.js, a tela de cadastro, aplica a mesma regra com formatação própria.)

const ativo = (v) => v === true || Number(v) === 1;

async function fornecedoresDoTenant(db, tenantId, { somenteAtivos = false } = {}) {
  const [doTenant, globais, vinculos] = await Promise.all([
    db.select('fornecedores', {}, tenantId),
    db.select('fornecedores', { tipo: 'global' }),
    db.select('tenant_fornecedores', { tenant_id: tenantId }),
  ]);
  const desativadosPeloTenant = new Set(
    (vinculos || []).filter((v) => v.ativo === false).map((v) => String(v.fornecedor_id))
  );

  const lista = [
    ...(globais || []).map((f) => ({ ...f, ativo_para_tenant: ativo(f.ativo) && !desativadosPeloTenant.has(String(f.id)) })),
    ...(doTenant || []).filter((f) => f.tipo !== 'global').map((f) => ({ ...f, ativo_para_tenant: ativo(f.ativo) })),
  ];
  return somenteAtivos ? lista.filter((f) => f.ativo_para_tenant) : lista;
}

async function mapaFornecedoresDoTenant(db, tenantId, opcoes) {
  const mapa = {};
  for (const f of await fornecedoresDoTenant(db, tenantId, opcoes)) mapa[String(f.id)] = f;
  return mapa;
}

// Um fornecedor específico, só se o tenant puder usá-lo (local dele ou global).
async function fornecedorDoTenant(db, tenantId, fornecedorId) {
  const f = await db.selectOne('fornecedores', { id: fornecedorId });
  if (!f) return null;
  if (f.tipo === 'global' || String(f.tenant_id) === String(tenantId)) return f;
  return null; // local de outro tenant
}

// E-mail para cotação/OV: o do cadastro (tenant) ou, na falta, o que o fornecedor mantém no portal.
function emailFornecedor(f) {
  return (f && (f.email || f.email_contato)) || null;
}

module.exports = { fornecedoresDoTenant, mapaFornecedoresDoTenant, fornecedorDoTenant, emailFornecedor };