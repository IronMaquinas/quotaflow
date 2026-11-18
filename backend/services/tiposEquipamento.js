// services/tiposEquipamento.js — etapa B2.0: 🚛 TIPOS de equipamento/ativo por empresa (o "objeto" que gera receita)
//   Lista inicial pelo SEGMENTO da empresa (abaixo — editável aqui); o tenant personaliza em Configurações → Tipos de equipamento
//   (cria, renomeia, apelidos/sinônimos, desativa). equipamentos.tipo_id liga o cadastro; a 👋 Beta usa nome + sinônimos
//   ("tem carreta livre dia 01/01?", "contêiner escritório disponível em fevereiro?"). sugerir(): tipo provável pelo nome do equipamento.
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// ➕ lista sugerida por segmento (services/modulos.js → SEGMENTOS). Sinônimos = palavras que a Beta e a sugestão reconhecem.
const SUGESTOES = {
  transporte: [
    ['Cavalo mecânico', '🚛', ['cavalo', 'trator', 'cavalo mecanico', 'truck tractor', 'scania', 'volvo fh', 'fh 540', 'actros', 'axor']],
    ['Carreta / semirreboque', '🚚', ['carreta', 'semirreboque', 'semi reboque', 'bitrem', 'rodotrem', 'prancha', 'bau', 'sider', 'graneleira', 'randon', 'librelato', 'facchini', 'implemento rodoviario']],
    ['Caminhão', '🚚', ['caminhao', 'truck', 'toco', 'vuc', '3 4', 'munck', 'munk', 'basculante']],
    ['Ônibus / van', '🚌', ['onibus', 'micro onibus', 'van', 'sprinter']],
    ['Veículo leve', '🚗', ['carro', 'veiculo leve', 'pickup', 'picape', 'utilitario', 'strada', 'hilux', 's10']],
    ['Máquina / equipamento', '🏗', ['maquina', 'empilhadeira', 'retroescavadeira', 'retro', 'pa carregadeira', 'escavadeira', 'guindaste', 'gerador', 'compressor', 'trator agricola']],
    ['Implemento / acessório', '🔩', ['implemento', 'acessorio', 'dolly', 'cavalete', 'rampa']],
    ['Outro', '📦', []],
  ],
  locacao: [
    ['Contêiner escritório', '🏢', ['conteiner escritorio', 'container escritorio', 'escritorio', 'modulo escritorio']],
    ['Contêiner almoxarifado', '📦', ['conteiner almoxarifado', 'container almoxarifado', 'almoxarifado', 'deposito', 'conteiner dry', 'container dry']],
    ['Módulo sanitário / vestiário', '🚻', ['sanitario', 'banheiro', 'vestiario', 'modulo sanitario']],
    ['Gerador', '⚡', ['gerador', 'grupo gerador']],
    ['Máquina / equipamento', '🏗', ['maquina', 'empilhadeira', 'retroescavadeira', 'retro', 'plataforma', 'compressor', 'betoneira']],
    ['Veículo', '🚚', ['caminhao', 'carro', 'van', 'veiculo']],
    ['Outro', '📦', []],
  ],
  servicos: [
    ['Máquina / equipamento', '🏗', ['maquina', 'equipamento', 'compressor', 'gerador', 'motor']],
    ['Veículo', '🚚', ['caminhao', 'carro', 'van', 'veiculo', 'cavalo', 'carreta']],
    ['Ferramenta', '🔧', ['ferramenta', 'chave', 'macaco', 'solda']],
    ['Outro', '📦', []],
  ],
  outro: [['Equipamento', '📦', ['equipamento']], ['Veículo', '🚚', ['veiculo', 'caminhao', 'carro']], ['Outro', '📦', []]],
};
const sugeridosPara = (segmentos = []) => {
  const vistos = new Set(); const out = [];
  for (const s of (segmentos.length ? segmentos : ['transporte'])) for (const [nome, icone, sin] of (SUGESTOES[s] || [])) if (!vistos.has(nome)) { vistos.add(nome); out.push({ nome, icone, sinonimos: sin }); }
  const outro = out.findIndex((x) => x.nome === 'Outro'); if (outro >= 0) out.push(out.splice(outro, 1)[0]); // "Outro" por último
  return out;
};

/** lista da empresa; na 1ª vez cria a sugerida pelo segmento */
async function listar(sb, tenantId, { semente = true } = {}) {
  let l = await q(sb.from('tipos_equipamento').select('*').eq('tenant_id', tenantId));
  if (!l.length && semente) {
    const t = (await q(sb.from('tenants').select('*').eq('id', tenantId)))[0] || {};
    const segs = require('./modulos').segmentosDe ? require('./modulos').segmentosDe(t) : ['transporte'];
    const novos = sugeridosPara(segs).map((x, i) => ({ tenant_id: tenantId, nome: x.nome, icone: x.icone, sinonimos: x.sinonimos, ordem: i, ativo: true }));
    if (novos.length) { await q(sb.from('tipos_equipamento').insert(novos)); l = await q(sb.from('tipos_equipamento').select('*').eq('tenant_id', tenantId)); }
  }
  return l.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || String(a.nome).localeCompare(String(b.nome)));
}
const limparSin = (v) => [...new Set((Array.isArray(v) ? v : String(v || '').split(/[,;\n]/)).map((x) => String(x).trim()).filter(Boolean).map((x) => x.slice(0, 40)))].slice(0, 30);
async function criar(sb, tenantId, d = {}) {
  const nome = String(d.nome || '').trim().slice(0, 60); if (!nome) return { status: 400, erro: 'Informe o nome do tipo.' };
  const l = await listar(sb, tenantId); if (l.some((x) => norm(x.nome) === norm(nome))) return { status: 409, erro: `Já existe o tipo "${nome}".` };
  const r = await q(sb.from('tipos_equipamento').insert([{ tenant_id: tenantId, nome, icone: d.icone || null, sinonimos: limparSin(d.sinonimos), ordem: l.length, ativo: true }]).select());
  return { tipo: r[0] };
}
async function atualizar(sb, tenantId, id, d = {}) {
  const l = await listar(sb, tenantId); const at = l.find((x) => String(x.id) === String(id)); if (!at) return { status: 404, erro: 'Tipo não encontrado.' };
  const up = {};
  if (d.nome != null) { const nome = String(d.nome).trim().slice(0, 60); if (!nome) return { status: 400, erro: 'O nome não pode ficar vazio.' }; if (l.some((x) => String(x.id) !== String(id) && norm(x.nome) === norm(nome))) return { status: 409, erro: `Já existe o tipo "${nome}".` }; up.nome = nome; }
  if (d.sinonimos != null) up.sinonimos = limparSin(d.sinonimos);
  if (d.icone !== undefined) up.icone = d.icone || null;
  if (d.ativo != null) up.ativo = !!d.ativo;
  if (d.ordem != null) up.ordem = Number(d.ordem) || 0;
  const r = await q(sb.from('tipos_equipamento').update(up).eq('tenant_id', tenantId).eq('id', id).select());
  return { tipo: r[0] };
}
async function excluir(sb, tenantId, id) { // só se nenhum equipamento usa; senão, desative
  const usados = (await q(sb.from('equipamentos').select('id, tipo_id').eq('tenant_id', tenantId))).filter((e) => String(e.tipo_id) === String(id)).length;
  if (usados) return { status: 409, erro: `${usados} equipamento(s) usam este tipo — troque o tipo deles ou apenas desative.` };
  await q(sb.from('tipos_equipamento').delete().eq('tenant_id', tenantId).eq('id', id)); return { ok: true };
}

/** tipo provável pelo nome/tag/modelo do equipamento (a palavra mais longa que bater ganha) */
function sugerir(eq, tipos) {
  const texto = ` ${norm([eq.nome, eq.tag, eq.modelo, eq.fabricante].filter(Boolean).join(' '))} `; let melhor = null; let tam = 0;
  for (const t of tipos.filter((x) => x.ativo !== false)) for (const w of [t.nome, ...(t.sinonimos || [])]) { const n = norm(w); if (n && texto.includes(` ${n} `) && n.length > tam) { melhor = t; tam = n.length; } }
  return melhor;
}
/** equipamentos sem tipo com a sugestão (para a revisão rápida) */
async function sugestoes(sb, tenantId) {
  const tipos = await listar(sb, tenantId); const eqs = await q(sb.from('equipamentos').select('*').eq('tenant_id', tenantId));
  return eqs.filter((e) => !e.tipo_id).map((e) => { const t = sugerir(e, tipos); return { id: e.id, tag: e.tag, nome: e.nome, tipo_id: t?.id || null, tipo_nome: t?.nome || null }; });
}
async function aplicar(sb, tenantId, itens = []) {
  const tipos = new Set((await listar(sb, tenantId)).map((t) => String(t.id))); let n = 0;
  for (const it of itens.slice(0, 500)) { if (!it?.id || !tipos.has(String(it.tipo_id))) continue; await q(sb.from('equipamentos').update({ tipo_id: it.tipo_id }).eq('tenant_id', tenantId).eq('id', it.id)); n++; }
  return { atualizados: n };
}
/** tipos que a frase menciona (nome ou sinônimo) */
function tiposNaFrase(texto, tipos) {
  const t = ` ${norm(texto)} `; const sing = (w) => w.replace(/oes\b/g, 'ao').replace(/es\b/g, 'e').replace(/s\b/g, '');
  const ts = ` ${sing(norm(texto))} `;
  return tipos.filter((x) => x.ativo !== false && [x.nome, ...(x.sinonimos || [])].some((w) => { const n = norm(w); const ns = sing(n); return n && (t.includes(` ${n} `) || ts.includes(` ${ns} `) || ts.includes(` ${ns.split(' ')[0]} `)); }));
}

module.exports = { SUGESTOES, sugeridosPara, listar, criar, atualizar, excluir, sugerir, sugestoes, aplicar, tiposNaFrase, norm };
