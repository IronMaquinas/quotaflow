// services/inspecaoConfig.js — etapa E6: ⚙ VOCABULÁRIO da inspeção de campo (por empresa)
//   O mesmo sistema serve eólica, tubulação, soldagem, estruturas… muda só como as coisas se chamam nas telas, no mapa e no relatório:
//   ativo (onde está: aerogerador, linha, peça) · componente (o quê: pá, junta, cordão) · exemplo de referência.
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const txt = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);
const PRESETS = {
  eolica: { nome: 'Eólica (pás)', ativo: 'Aerogerador', ativos: 'Aerogeradores', componente: 'Pá', exemplo: 'WTG-07', icone: '⚡' },
  tubulacao: { nome: 'Tubulação / dutos', ativo: 'Linha', ativos: 'Linhas', componente: 'Junta', exemplo: 'L-101', icone: '🛢' },
  soldagem: { nome: 'Soldagem / caldeiraria', ativo: 'Peça', ativos: 'Peças', componente: 'Cordão', exemplo: 'P-12', icone: '🔥' },
  estruturas: { nome: 'Estruturas / civil', ativo: 'Estrutura', ativos: 'Estruturas', componente: 'Elemento', exemplo: 'E-03', icone: '🏗' },
  generico: { nome: 'Genérico', ativo: 'Ativo', ativos: 'Ativos', componente: 'Componente', exemplo: 'A-01', icone: '📍' },
};
function montar(c) {
  const base = PRESETS[c?.preset] || PRESETS.eolica;
  return { preset: PRESETS[c?.preset] ? c.preset : 'eolica', ativo: txt(c?.ativo, 30) || base.ativo, ativos: txt(c?.ativos, 30) || base.ativos, componente: txt(c?.componente, 30) || base.componente, exemplo: txt(c?.exemplo, 20) || base.exemplo, icone: base.icone };
}
async function ler(sb, tenantId) {
  let c = null; try { c = (await q(sb.from('tenants').select('*').eq('id', tenantId)))[0]?.inspecao_config || null; } catch { /* sem coluna ainda */ }
  return { vocabulario: montar(c), definido: !!c, PRESETS };
}
async function salvar(sb, tenantId, b = {}) {
  if (b.preset && !PRESETS[b.preset]) return { status: 400, erro: 'Escolha um tipo de inspeção da lista.' };
  const base = PRESETS[b.preset] || PRESETS.eolica; const cfg = { preset: b.preset || 'eolica' };
  for (const k of ['ativo', 'ativos', 'componente', 'exemplo']) { const v = txt(b[k], k === 'exemplo' ? 20 : 30); if (v && v !== base[k]) cfg[k] = v; }
  await q(sb.from('tenants').update({ inspecao_config: cfg }).eq('id', tenantId).select());
  return { vocabulario: montar(cfg), definido: true, PRESETS };
}
module.exports = { PRESETS, montar, ler, salvar };
