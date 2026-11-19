// services/custoIa.js — etapa B5.0: 💲 quanto a IA custa por empresa + interruptores e teto da voz (Console da Plataforma)
//   Custo ESTIMADO a partir de ia_uso: texto = tokens × preço do modelo; voz_falar = caracteres; voz_ouvir = segundos.
//   Preços em US$ (ajuste sem deploy: IA_PRECOS='{"modelo":{"in":3,"out":15}}' por 1M tokens; voz: {"voz_falar":{"char":16.7},"voz_ouvir":{"seg":50}} por 1M).
//   USD_BRL (padrão 5,5). Teto mensal da VOZ PAGA por empresa (padrão R$ 15): 80% → alerta no Console; 100% → volta para a voz do navegador.
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const PADRAO_PRECOS = {
  'claude-sonnet-5-5': { in: 3, out: 15 }, 'claude-haiku-5-5': { in: 1, out: 5 }, 'claude-opus-5-5': { in: 15, out: 75 },
  voz_falar: { char: 10 }, voz_ouvir: { seg: 30 }, // B5.3: recalibrado pela fatura real (a 1ª tabela superestimava ~70%) _texto: { in: 3, out: 15 },
};
function precos() { try { return { ...PADRAO_PRECOS, ...JSON.parse(process.env.IA_PRECOS || '{}') }; } catch { return PADRAO_PRECOS; } }
const cambio = () => Number(String(process.env.USD_BRL || '5.5').replace(',', '.')) || 5.5;
const ehVoz = (r) => /^voz_/.test(String(r || ''));

/** custo em US$ de um registro de ia_uso */
function custoUsd(u, P = precos()) {
  if (!u || u.provedor === 'local' || u.ok === false) return 0;
  if (u.recurso === 'voz_falar') return (Number(u.tokens_entrada) || 0) * (P.voz_falar?.char || 0) / 1e6;
  if (u.recurso === 'voz_ouvir') return (Number(u.tokens_entrada) || 0) * (P.voz_ouvir?.seg || 0) / 1e6;
  const p = P[u.modelo] || Object.entries(P).find(([k]) => k !== '_texto' && u.modelo && String(u.modelo).startsWith(k.split('-').slice(0, 2).join('-')))?.[1] || P._texto;
  return ((Number(u.tokens_entrada) || 0) * (p.in || 0) + (Number(u.tokens_saida) || 0) * (p.out || 0)) / 1e6;
}

const PADRAO = { chat_mic: true, chat_fala: false, conversa: 'desligado', cortesia_ate: null, cortesia_modo: 'neural', teto_mes_brl: 15 };
const MODOS = ['desligado', 'neural', 'ao_vivo'];
const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
function normalizar(c = {}) {
  const o = { ...PADRAO, ...(c && typeof c === 'object' ? c : {}) };
  o.chat_mic = o.chat_mic !== false; o.chat_fala = o.chat_fala === true;
  if (!MODOS.includes(o.conversa)) o.conversa = 'desligado'; if (!MODOS.includes(o.cortesia_modo) || o.cortesia_modo === 'desligado') o.cortesia_modo = 'neural';
  o.cortesia_ate = /^\d{4}-\d{2}-\d{2}$/.test(String(o.cortesia_ate || '')) ? o.cortesia_ate : null;
  const t = Number(String(o.teto_mes_brl ?? 15).replace(',', '.')); o.teto_mes_brl = Number.isFinite(t) && t >= 0 ? Math.round(t * 100) / 100 : 15;
  return o;
}
/** modo do modo Conversa valendo hoje (cortesia vence sozinha) */
function modoEfetivo(c) { const n = normalizar(c); return n.cortesia_ate && n.cortesia_ate >= hojeBR() ? { modo: n.cortesia_modo, cortesia: true } : { modo: n.conversa, cortesia: false }; }

async function configDe(sb, tenantId) {
  try { const t = (await q(sb.from('tenants').select('*').eq('id', tenantId)))[0]; return normalizar(t?.ia_config); } catch { return normalizar(); }
}
async function salvarConfig(sb, tenantId, d = {}) {
  const atual = await configDe(sb, tenantId); const novo = normalizar({ ...atual, ...d });
  await q(sb.from('tenants').update({ ia_config: novo }).eq('id', tenantId).select()); return { config: novo };
}

const inicioMes = (mes) => `${mes}-01T03:00:00.000Z`; // mês no horário de Brasília
const proxMes = (mes) => { const [a, m] = mes.split('-').map(Number); return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`; };
const mesAtual = () => hojeBR().slice(0, 7);
async function usosDoMes(sb, mes, tenantId = null) {
  let p = sb.from('ia_uso').select('*').gte('em', inicioMes(mes)).lt('em', inicioMes(proxMes(mes))); if (tenantId != null) p = p.eq('tenant_id', tenantId);
  return q(p);
}
/** gasto do mês em R$ (voz paga, para o teto) */
async function gastoVozMes(sb, tenantId) {
  const P = precos(); return (await usosDoMes(sb, mesAtual(), tenantId)).filter((u) => ehVoz(u.recurso)).reduce((s, u) => s + custoUsd(u, P), 0) * cambio();
}
/** pode gastar voz paga agora? */
async function podeVozPaga(sb, tenantId) {
  const c = await configDe(sb, tenantId); const g = await gastoVozMes(sb, tenantId);
  return { ok: g < c.teto_mes_brl, gasto: g, teto: c.teto_mes_brl };
}

/** painel do Console: por empresa no mês — texto, voz, total (R$), teto e situação */
async function painel(sb, mes = mesAtual()) {
  if (!/^\d{4}-\d{2}$/.test(mes)) mes = mesAtual();
  const P = precos(); const R = cambio(); const usos = await usosDoMes(sb, mes);
  const tenants = await q(sb.from('tenants').select('*'));
  const porT = new Map();
  for (const u of usos) { const k = String(u.tenant_id); const x = porT.get(k) || { texto: 0, voz: 0, chamadas: 0, recursos: {} }; const v = custoUsd(u, P) * R; if (ehVoz(u.recurso)) x.voz += v; else x.texto += v; x.chamadas++; x.recursos[u.recurso] = (x.recursos[u.recurso] || 0) + v; porT.set(k, x); }
  const r2 = (n) => Math.round(n * 1000) / 1000;
  const itens = tenants.map((t) => {
    const x = porT.get(String(t.id)) || { texto: 0, voz: 0, chamadas: 0, recursos: {} }; const cfg = normalizar(t.ia_config); const ef = modoEfetivo(cfg);
    const pct = cfg.teto_mes_brl > 0 ? Math.round((x.voz / cfg.teto_mes_brl) * 100) : (x.voz > 0 ? 100 : 0);
    return { id: t.id, empresa: t.nome_fantasia || t.razao_social || t.nome || `#${t.id}`, config: cfg, modo: ef.modo, em_cortesia: ef.cortesia, texto: r2(x.texto), voz: r2(x.voz), total: r2(x.texto + x.voz), chamadas: x.chamadas,
      recursos: Object.fromEntries(Object.entries(x.recursos).map(([k, v]) => [k, r2(v)])), teto_pct: pct, alerta: pct >= 100 ? 'teto' : pct >= 80 ? 'perto' : null };
  }).sort((a, b) => b.total - a.total || String(a.empresa).localeCompare(String(b.empresa)));
  return { mes, cambio: R, itens, total: r2(itens.reduce((s, i) => s + i.total, 0)), total_voz: r2(itens.reduce((s, i) => s + i.voz, 0)), total_texto: r2(itens.reduce((s, i) => s + i.texto, 0)) };
}

module.exports = { PADRAO, MODOS, normalizar, modoEfetivo, configDe, salvarConfig, custoUsd, precos, cambio, gastoVozMes, podeVozPaga, painel, mesAtual };
