// services/frotaCalendario.js — etapa 18f: 🚛 dias operacionais da frota
//   Base dos indicadores de utilização (passado) × alocação (futuro) da 18f.1.
//   Configuração do tenant: dias da semana (padrão seg a sáb) + descontar feriados (padrão sim).
const PADRAO = [1, 2, 3, 4, 5, 6];
const NOMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function lerDias(txt) {
  const d = [...new Set(String(txt ?? '').split(',').filter((x) => x.trim() !== '').map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b);
  return d.length ? d : PADRAO.slice();
}

async function obter(supabase, tenantId) {
  const { data, error } = await supabase.from('tenants').select('*').eq('id', tenantId);
  if (error) throw new Error(error.message);
  const t = data?.[0] || {};
  const migrou = Object.prototype.hasOwnProperty.call(t, 'frota_dias_semana');
  return { dias_semana: lerDias(t.frota_dias_semana), descontar_feriados: t.frota_descontar_feriados !== false, migrou };
}

async function salvar(supabase, tenantId, body = {}) {
  const dias = [...new Set((Array.isArray(body.dias_semana) ? body.dias_semana : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b);
  if (!dias.length) return { status: 409, erro: 'Marque pelo menos um dia da semana' };
  const { error } = await supabase.from('tenants').update({ frota_dias_semana: dias.join(','), frota_descontar_feriados: body.descontar_feriados !== false }).eq('id', tenantId);
  if (error) {
    if (/frota_/.test(error.message)) return { status: 409, erro: 'Rode a migration 064 antes (colunas da frota não existem)' };
    throw new Error(error.message);
  }
  return { ok: true, ...(await obter(supabase, tenantId)) };
}

/** calendário pronto para contar: { dias_semana, feriados: Set(YYYY-MM-DD) } */
async function calendario(supabase, tenantId) {
  const cfg = await obter(supabase, tenantId);
  let feriados = new Set();
  if (cfg.descontar_feriados) {
    const { data } = await supabase.from('tenant_feriados').select('*').eq('tenant_id', tenantId);
    feriados = new Set((data || []).map((f) => String(f.data || '').slice(0, 10)).filter(Boolean));
  }
  return { ...cfg, feriados };
}

const proximo = (d) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
const ehOperacional = (d, cal) => cal.dias_semana.includes(new Date(`${d}T12:00:00Z`).getUTCDay()) && !cal.feriados.has(d);

/** dias operacionais entre de e ate (inclusive), em YYYY-MM-DD */
function diasOperacionais(de, ate, cal) {
  const out = []; if (!de || !ate || de > ate) return out;
  for (let d = de; d <= ate; d = proximo(d)) if (ehOperacional(d, cal)) out.push(d);
  return out;
}

const descrever = (cfg) => `${cfg.dias_semana.map((n) => NOMES[n]).join(', ')}${cfg.descontar_feriados ? ' · feriados não contam' : ' · feriados contam'}`;

module.exports = { obter, salvar, calendario, diasOperacionais, ehOperacional, descrever, PADRAO, NOMES, _lerDias: lerDias };
