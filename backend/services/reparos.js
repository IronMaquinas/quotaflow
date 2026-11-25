// services/reparos.js — etapa E4: 🛠 PROCEDIMENTOS DE REPARO e execução em campo
//   Modelo = sequência de etapas (título, instrução, fotos mínimas, campos, ☑ materiais, ☑ condições ambientais, ☑ liberação da engenharia).
//   Reparo = 1 por defeito "b) Reparar" (cópia das etapas — a engenharia pode ajustar ao abrir). Execução etapa a etapa, NA ORDEM:
//   fotos com o cartão já preenchido (pá, defeito, aerogerador, etapa), valores, materiais (produto, lote, validade, quantidade, proporção),
//   temperatura/umidade, comentário → ✓ concluir (confere fotos mínimas, materiais, validade, ambiente). Etapa com liberação: a próxima só
//   começa depois que a engenharia libera. Reabrir etapa exige motivo (histórico). Reparo concluído quando todas as etapas estão ok.
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const txt = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);
const data = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null);
const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const num = (v) => { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
const STATUS = { aberto: 'Aberto', em_execucao: 'Em execução', concluido: 'Concluído', cancelado: 'Cancelado' };

const EXEMPLOS = [{ chave: 'laminado', nome: 'Reparo de laminado — pá eólica', descricao: 'Reparo estrutural em laminado de fibra (biax) com hand lay-up e acabamento em gel coat.', etapas: [
  { titulo: 'Defeito antes do reparo', instrucao: 'Fotografe o defeito com o cartão: visão geral e detalhe com escala.', fotos_min: 2 },
  { titulo: 'Desenho do escalonamento', instrucao: 'Marque o escalonamento (camadas e sobreposição) antes de remover as fibras.', fotos_min: 1, campos: [{ rotulo: 'Nº de camadas', tipo: 'numero' }, { rotulo: 'Sobreposição', tipo: 'numero', unidade: 'mm' }], liberacao: true },
  { titulo: 'Fibras removidas conforme escalonamento', instrucao: 'Remoção camada a camada respeitando o desenho.', fotos_min: 2 },
  { titulo: 'Defeito removido', instrucao: 'Área limpa, sem material comprometido; confirmar com a engenharia se necessário.', fotos_min: 1, liberacao: true },
  { titulo: 'Fibras reposicionadas', instrucao: 'Corte e posicionamento do biax conforme o escalonamento.', fotos_min: 1, materiais: true },
  { titulo: 'Hand lay-up', instrucao: 'Laminação manual: registre resina, endurecedor e proporção da mistura, temperatura e umidade.', fotos_min: 2, materiais: true, ambiente: true },
  { titulo: 'Gel coat aplicado', instrucao: 'Acabamento: pore filling e gel coat; registre materiais, proporção e condições.', fotos_min: 2, materiais: true, ambiente: true },
] },
  // E6: reparo de solda (tubulação / caldeiraria)
  { chave: 'solda', nome: 'Reparo de solda', descricao: 'Remoção da descontinuidade, END de liberação, ressoldagem conforme EPS e END final.', etapas: [
    { titulo: 'Indicação antes do reparo', instrucao: 'Fotografe a indicação com o cartão e a marcação da região.', fotos_min: 1 },
    { titulo: 'Remoção (goivagem / esmerilhamento)', instrucao: 'Remova a descontinuidade; registre a profundidade da cavidade.', fotos_min: 1, campos: [{ rotulo: 'Profundidade', tipo: 'numero', unidade: 'mm' }, { rotulo: 'Comprimento', tipo: 'numero', unidade: 'mm' }] },
    { titulo: 'END após remoção (PT/MT)', instrucao: 'Confirme a remoção total antes de soldar.', fotos_min: 1, campos: [{ rotulo: 'Técnica' }, { rotulo: 'Resultado' }], liberacao: true },
    { titulo: 'Pré-aquecimento', instrucao: 'Registre a temperatura de pré-aquecimento e as condições.', fotos_min: 1, campos: [{ rotulo: 'Temperatura da peça', tipo: 'numero', unidade: '°C' }], ambiente: true },
    { titulo: 'Soldagem', instrucao: 'Conforme EPS; registre soldador, consumível (lote) e parâmetros.', fotos_min: 2, campos: [{ rotulo: 'Soldador (sinete)' }, { rotulo: 'EPS' }], materiais: true },
    { titulo: 'END final', instrucao: 'Ensaio final conforme o critério de aceitação.', fotos_min: 1, campos: [{ rotulo: 'Técnica' }, { rotulo: 'Resultado' }, { rotulo: 'Relatório de END nº' }], liberacao: true },
  ] }];

function validarEtapas(lista) {
  const out = []; const ids = new Set();
  for (const e of Array.isArray(lista) ? lista.slice(0, 40) : []) {
    const titulo = txt(e?.titulo, 120); if (!titulo) continue;
    let id = String(e.id || '').replace(/[^a-z0-9_]/gi, '').slice(0, 20) || `e${out.length + 1}`; while (ids.has(id)) id = `${id}x`; ids.add(id);
    const campos = (Array.isArray(e.campos) ? e.campos : []).map((c, i) => ({ id: String(c?.id || `c${i + 1}`).replace(/[^a-z0-9_]/gi, '').slice(0, 20) || `c${i + 1}`, rotulo: txt(c?.rotulo, 60), tipo: c?.tipo === 'numero' ? 'numero' : 'texto', unidade: txt(c?.unidade, 10) })).filter((c) => c.rotulo).slice(0, 15);
    out.push({ id, titulo, instrucao: txt(e.instrucao, 1000), fotos_min: Math.min(Math.max(parseInt(e.fotos_min, 10) || 0, 0), 20), campos, materiais: !!e.materiais, ambiente: !!e.ambiente, liberacao: !!e.liberacao });
  }
  return out;
}

// ─── modelos ────────────────────────────────────────────────────────────────
async function listarModelos(sb, tenantId, { todos = false } = {}) {
  const l = (await q(sb.from('reparo_modelos').select('*').eq('tenant_id', tenantId))).filter((m) => todos || m.ativo !== false).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  return { modelos: l, exemplos: EXEMPLOS.map(({ chave, nome }) => ({ chave, nome })) };
}
async function salvarModelo(sb, tenantId, quem, id, b = {}) {
  let base = b; if (!id && b.exemplo) { const ex = EXEMPLOS.find((e) => e.chave === b.exemplo); if (!ex) return { status: 404, erro: 'Exemplo não encontrado.' }; base = ex; }
  const nome = txt(base.nome, 120); if (!nome) return { status: 400, erro: 'Dê um nome ao procedimento.' };
  const etapas = validarEtapas(base.etapas); if (!etapas.length) return { status: 400, erro: 'Inclua ao menos uma etapa.' };
  const d = { nome, descricao: txt(base.descricao, 1000), etapas, atualizado_em: new Date().toISOString() };
  if (id) { const m = (await q(sb.from('reparo_modelos').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!m) return { status: 404, erro: 'Procedimento não encontrado.' };
    return { modelo: (await q(sb.from('reparo_modelos').update({ ...d, ...('ativo' in b ? { ativo: !!b.ativo } : {}) }).eq('tenant_id', tenantId).eq('id', id).select()))[0] }; }
  return { modelo: (await q(sb.from('reparo_modelos').insert([{ ...d, tenant_id: tenantId, ativo: true, criado_por: quem?.nome || null, criado_em: d.atualizado_em }]).select()))[0] };
}

// ─── reparos ────────────────────────────────────────────────────────────────
async function um(sb, tenantId, id) { return (await q(sb.from('reparos').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] || null; }
async function abrir(sb, tenantId, quem, b = {}) {
  const d = (await q(sb.from('defeitos_foto').select('*').eq('tenant_id', tenantId).eq('id', b.defeito_id)))[0]; if (!d) return { status: 404, erro: 'Defeito não encontrado.' };
  if (d.classificacao !== 'reparar') return { status: 409, erro: 'Só abre reparo para defeito classificado como "b) Reparar".' };
  const ja = (await q(sb.from('reparos').select('*').eq('tenant_id', tenantId))).find((r) => String(r.defeito_id) === String(d.id) && r.status !== 'cancelado');
  if (ja) return { status: 409, erro: `Este defeito já tem o reparo ${ja.numero}.`, reparo_id: ja.id };
  const m = (await q(sb.from('reparo_modelos').select('*').eq('tenant_id', tenantId).eq('id', b.modelo_id)))[0]; if (!m) return { status: 400, erro: 'Escolha o procedimento de reparo.' };
  const etapas = validarEtapas(Array.isArray(b.etapas) && b.etapas.length ? b.etapas : m.etapas); if (!etapas.length) return { status: 400, erro: 'O reparo precisa de ao menos uma etapa.' };
  let cartao = null; if (b.cartao_modelo_id) cartao = (await q(sb.from('cartao_foto_modelos').select('*').eq('tenant_id', tenantId).eq('id', b.cartao_modelo_id)))[0] || null;
  if (!cartao) return { status: 400, erro: 'Escolha o cartão que vai nas fotos do reparo.' };
  const ano = hojeBR().slice(0, 4); const todos = await q(sb.from('reparos').select('*').eq('tenant_id', tenantId));
  const numero = `REP-${ano}-${String(todos.filter((r) => String(r.numero || '').startsWith(`REP-${ano}-`)).length + 1).padStart(3, '0')}`; const agora = new Date().toISOString();
  const r = (await q(sb.from('reparos').insert([{ tenant_id: tenantId, numero, defeito_id: d.id, projeto_id: d.projeto_id, modelo_id: m.id, modelo_nome: m.nome, cartao_modelo_id: cartao.id, etapas, execucao: {}, status: 'aberto',
    responsavel: txt(b.responsavel, 120), responsavel_ref: /^[cu]:\d+$/.test(String(b.responsavel_ref || '')) ? b.responsavel_ref : null, prazo: data(b.prazo), criado_por: quem?.nome || null, criado_em: agora, atualizado_em: agora }]).select()))[0];
  return { reparo: r };
}

async function fotosDe(sb, tenantId, reparoId) { return (await q(sb.from('fotos_cartao').select('*').eq('tenant_id', tenantId))).filter((f) => String(f.reparo_id) === String(reparoId) && !f.excluida_em); }
function progresso(r, fotos) {
  const ex = r.execucao || {}; const total = (r.etapas || []).length; const ok = (r.etapas || []).filter((e) => ex[e.id]?.status === 'concluida').length;
  const prox = (r.etapas || []).find((e) => ex[e.id]?.status !== 'concluida'); const espera = (r.etapas || []).find((e) => e.liberacao && ex[e.id]?.status === 'concluida' && !ex[e.id]?.liberada_em);
  return { total, concluidas: ok, pct: total ? Math.round((ok / total) * 100) : 0, fotos: fotos.length, proxima: prox?.titulo || null, aguardando_liberacao: espera?.titulo || null };
}
async function listar(sb, tenantId, f = {}) {
  const [rs, ds, ps, fs] = await Promise.all([q(sb.from('reparos').select('*').eq('tenant_id', tenantId)), q(sb.from('defeitos_foto').select('*').eq('tenant_id', tenantId)), q(sb.from('projetos_foto').select('*').eq('tenant_id', tenantId)), q(sb.from('fotos_cartao').select('*').eq('tenant_id', tenantId))]);
  let l = rs.map((r) => { const d = ds.find((x) => String(x.id) === String(r.defeito_id)); const p = ps.find((x) => String(x.id) === String(r.projeto_id));
    const { execucao, etapas, ...resto } = r; return { ...resto, defeito: d ? { id: d.id, referencia: d.referencia, pa: d.pa, numero: d.numero } : null, projeto: p?.nome || null, progresso: progresso(r, fs.filter((x) => String(x.reparo_id) === String(r.id) && !x.excluida_em)) }; });
  if (f.projeto_id) l = l.filter((r) => String(r.projeto_id) === String(f.projeto_id));
  if (f.status) l = l.filter((r) => (f.status === 'ativos' ? ['aberto', 'em_execucao'].includes(r.status) : r.status === f.status));
  l.sort((a, b) => (['aberto', 'em_execucao'].includes(a.status) === ['aberto', 'em_execucao'].includes(b.status) ? String(b.criado_em).localeCompare(String(a.criado_em)) : ['aberto', 'em_execucao'].includes(a.status) ? -1 : 1));
  return { reparos: l, STATUS };
}
async function detalhe(sb, tenantId, id) {
  const r = await um(sb, tenantId, id); if (!r) return { status: 404, erro: 'Reparo não encontrado.' };
  const [d, p, c, fotos] = await Promise.all([q(sb.from('defeitos_foto').select('*').eq('tenant_id', tenantId).eq('id', r.defeito_id)).then((l) => l[0] || null), q(sb.from('projetos_foto').select('*').eq('tenant_id', tenantId).eq('id', r.projeto_id)).then((l) => l[0] || null),
    q(sb.from('cartao_foto_modelos').select('*').eq('tenant_id', tenantId).eq('id', r.cartao_modelo_id)).then((l) => l[0] || null), fotosDe(sb, tenantId, r.id)]);
  const D = require('./documentos'); const fs = [];
  for (const x of fotos.sort((a, b) => String(a.tirada_em).localeCompare(String(b.tirada_em)))) { let url = null; try { url = await D.linkArquivo(sb, x.arquivo); } catch { /* sem link */ } fs.push({ ...x, url }); }
  return { reparo: r, defeito: d, projeto: p, cartao: c, fotos: fs, progresso: progresso(r, fotos), STATUS };
}

const MSG_FECHADO = (r) => `Reparo ${STATUS[r.status].toLowerCase()} — não muda mais.`;
function limparExec(e, b) {
  const campos = {}; for (const c of e.campos || []) { const v = txt(b.campos?.[c.id], 120); if (v) campos[c.id] = v; }
  const materiais = (Array.isArray(b.materiais) ? b.materiais : []).slice(0, 30).map((m) => ({ produto: txt(m?.produto, 120), lote: txt(m?.lote, 60), validade: data(m?.validade), quantidade: txt(m?.quantidade, 20), unidade: txt(m?.unidade, 10), proporcao: txt(m?.proporcao, 40) })).filter((m) => m.produto || m.lote);
  const ambiente = { temperatura: num(b.ambiente?.temperatura), umidade: num(b.ambiente?.umidade) };
  return { campos, materiais, ambiente, comentario: txt(b.comentario, 2000) };
}
async function salvarEtapa(sb, tenantId, quem, id, etapaId, b = {}, concluir = false) {
  const r = await um(sb, tenantId, id); if (!r) return { status: 404, erro: 'Reparo não encontrado.' };
  if (['concluido', 'cancelado'].includes(r.status)) return { status: 409, erro: MSG_FECHADO(r) };
  const i = (r.etapas || []).findIndex((e) => e.id === etapaId); if (i < 0) return { status: 404, erro: 'Etapa não encontrada.' }; const e = r.etapas[i];
  const ex = { ...(r.execucao || {}) }; const atual = ex[e.id] || {};
  if (atual.status === 'concluida') return { status: 409, erro: 'Etapa já concluída — peça à engenharia para reabrir se precisar mudar.' };
  const anterior = r.etapas[i - 1]; const exAnt = anterior ? ex[anterior.id] || {} : null;
  if (anterior && exAnt.status !== 'concluida') return { status: 409, erro: `Conclua antes a etapa "${anterior.titulo}".` };
  if (anterior && anterior.liberacao && !exAnt.liberada_em) return { status: 409, erro: `A etapa "${anterior.titulo}" aguarda liberação da engenharia.` };
  const v = limparExec(e, b);
  if (Number.isNaN(v.ambiente.temperatura) || Number.isNaN(v.ambiente.umidade)) return { status: 400, erro: 'Temperatura e umidade em números (ex.: 24,5).' };
  if (v.ambiente.umidade != null && (v.ambiente.umidade < 0 || v.ambiente.umidade > 100)) return { status: 400, erro: 'Umidade entre 0 e 100%.' };
  const agora = new Date().toISOString(); const novo = { ...atual, ...v, status: 'em_andamento', atualizado_em: agora, atualizado_por: quem?.nome || null };
  if (concluir) {
    const fotos = (await fotosDe(sb, tenantId, r.id)).filter((f) => f.etapa_id === e.id);
    const falta = [];
    if (fotos.length < (e.fotos_min || 0)) falta.push(`${e.fotos_min - fotos.length} foto(s) (mínimo ${e.fotos_min})`);
    for (const c of e.campos || []) if (!v.campos[c.id]) falta.push(c.rotulo);
    if (e.materiais) { if (!v.materiais.length) falta.push('os materiais usados'); for (const m of v.materiais) if (!m.produto || !m.lote || !m.validade) falta.push(`produto, lote e validade de "${m.produto || m.lote}"`); }
    if (e.ambiente && (v.ambiente.temperatura == null || v.ambiente.umidade == null)) falta.push('temperatura e umidade');
    if (falta.length) return { status: 409, erro: `Para concluir "${e.titulo}" falta: ${falta.join(', ')}.` };
    const vencido = v.materiais.find((m) => m.validade && m.validade < hojeBR()); if (vencido) return { status: 409, erro: `Material vencido: ${vencido.produto} lote ${vencido.lote} venceu em ${vencido.validade.split('-').reverse().join('/')}. Troque o material.` };
    Object.assign(novo, { status: 'concluida', concluida_em: agora, concluida_por: quem?.nome || null, fotos: fotos.length });
  }
  ex[e.id] = novo;
  const up = { execucao: ex, atualizado_em: agora, ...(r.status === 'aberto' ? { status: 'em_execucao' } : {}) };
  const fim = concluir && (r.etapas || []).every((x) => ex[x.id]?.status === 'concluida' && (!x.liberacao || ex[x.id]?.liberada_em));
  if (fim) Object.assign(up, { status: 'concluido', concluido_em: agora, concluido_por: quem?.nome || null });
  return { reparo: (await q(sb.from('reparos').update(up).eq('tenant_id', tenantId).eq('id', id).select()))[0], concluido: !!fim };
}
async function liberarEtapa(sb, tenantId, quem, id, etapaId, b = {}) {
  const r = await um(sb, tenantId, id); if (!r) return { status: 404, erro: 'Reparo não encontrado.' };
  if (['concluido', 'cancelado'].includes(r.status)) return { status: 409, erro: MSG_FECHADO(r) };
  const e = (r.etapas || []).find((x) => x.id === etapaId); if (!e) return { status: 404, erro: 'Etapa não encontrada.' };
  const ex = { ...(r.execucao || {}) }; const at = ex[e.id] || {};
  if (at.status !== 'concluida') return { status: 409, erro: 'A etapa precisa estar concluída para ser liberada.' };
  if (at.liberada_em) return { status: 409, erro: 'Etapa já liberada.' };
  const agora = new Date().toISOString(); ex[e.id] = { ...at, liberada_em: agora, liberada_por: quem?.nome || null, liberacao_obs: txt(b.obs, 500) };
  const fim = (r.etapas || []).every((x) => ex[x.id]?.status === 'concluida' && (!x.liberacao || ex[x.id]?.liberada_em));
  return { reparo: (await q(sb.from('reparos').update({ execucao: ex, atualizado_em: agora, ...(fim ? { status: 'concluido', concluido_em: agora, concluido_por: quem?.nome || null } : {}) }).eq('tenant_id', tenantId).eq('id', id).select()))[0], concluido: fim };
}
async function reabrirEtapa(sb, tenantId, quem, id, etapaId, b = {}) {
  const r = await um(sb, tenantId, id); if (!r) return { status: 404, erro: 'Reparo não encontrado.' };
  if (r.status === 'cancelado') return { status: 409, erro: MSG_FECHADO(r) };
  const i = (r.etapas || []).findIndex((x) => x.id === etapaId); if (i < 0) return { status: 404, erro: 'Etapa não encontrada.' };
  const motivo = txt(b.motivo, 500); if (!motivo || motivo.length < 5) return { status: 400, erro: 'Diga por que a etapa volta (mínimo 5 letras).' };
  const ex = { ...(r.execucao || {}) }; const at = ex[r.etapas[i].id] || {}; if (at.status !== 'concluida') return { status: 409, erro: 'Só reabre etapa concluída.' };
  const depois = r.etapas.slice(i + 1).find((x) => ex[x.id]?.status === 'concluida'); if (depois) return { status: 409, erro: `Reabra antes a etapa "${depois.titulo}", que vem depois.` };
  const agora = new Date().toISOString();
  ex[r.etapas[i].id] = { ...at, status: 'em_andamento', concluida_em: null, concluida_por: null, liberada_em: null, liberada_por: null, reaberturas: [...(at.reaberturas || []), { em: agora, por: quem?.nome || null, motivo }] };
  return { reparo: (await q(sb.from('reparos').update({ execucao: ex, status: 'em_execucao', concluido_em: null, concluido_por: null, atualizado_em: agora }).eq('tenant_id', tenantId).eq('id', id).select()))[0] };
}
async function cancelar(sb, tenantId, quem, id, b = {}) {
  const r = await um(sb, tenantId, id); if (!r) return { status: 404, erro: 'Reparo não encontrado.' };
  if (['concluido', 'cancelado'].includes(r.status)) return { status: 409, erro: MSG_FECHADO(r) };
  const motivo = txt(b.motivo, 500); if (!motivo || motivo.length < 10) return { status: 400, erro: 'Explique o motivo do cancelamento (mínimo 10 caracteres).' };
  const agora = new Date().toISOString();
  return { reparo: (await q(sb.from('reparos').update({ status: 'cancelado', cancelado_em: agora, cancelamento_motivo: `${motivo} (${quem?.nome || ''})`, atualizado_em: agora }).eq('tenant_id', tenantId).eq('id', id).select()))[0] };
}
async function editar(sb, tenantId, id, b = {}) {
  const r = await um(sb, tenantId, id); if (!r) return { status: 404, erro: 'Reparo não encontrado.' };
  if (['concluido', 'cancelado'].includes(r.status)) return { status: 409, erro: MSG_FECHADO(r) };
  const up = { atualizado_em: new Date().toISOString() };
  if ('responsavel' in b) up.responsavel = txt(b.responsavel, 120); if ('responsavel_ref' in b) up.responsavel_ref = /^[cu]:\d+$/.test(String(b.responsavel_ref || '')) ? b.responsavel_ref : null; if ('prazo' in b) up.prazo = data(b.prazo);
  if (Array.isArray(b.etapas)) { const iniciadas = Object.keys(r.execucao || {}); const novas = validarEtapas(b.etapas);
    if (iniciadas.some((k) => !novas.find((e) => e.id === k))) return { status: 409, erro: 'Não dá para tirar uma etapa que já foi iniciada.' }; if (!novas.length) return { status: 400, erro: 'O reparo precisa de ao menos uma etapa.' }; up.etapas = novas; }
  return { reparo: (await q(sb.from('reparos').update(up).eq('tenant_id', tenantId).eq('id', id).select()))[0] };
}
async function porDefeito(sb, tenantId) { const m = new Map(); for (const r of await q(sb.from('reparos').select('*').eq('tenant_id', tenantId))) if (r.status !== 'cancelado') m.set(String(r.defeito_id), { id: r.id, numero: r.numero, status: r.status }); return m; }

module.exports = { EXEMPLOS, STATUS, validarEtapas, listarModelos, salvarModelo, abrir, listar, detalhe, salvarEtapa, liberarEtapa, reabrirEtapa, cancelar, editar, porDefeito };
