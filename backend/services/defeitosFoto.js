// services/defeitosFoto.js — etapa E3: 🔧 DEFEITOS mapeados pelas fotos com cartão + TRIAGEM da engenharia
//   Identidade do defeito = projeto + aerogerador (campo "aerogerador" do cartão ou a referência da foto) + pá + nº do defeito.
//   Os campos que identificam vêm do modelo (papel pa/defeito/aerogerador); sem papel marcado, reconhece pelo rótulo ("Pá", "Defeito nº").
//   Toda foto do mesmo defeito fica junta. Triagem: a) sem_reparo · b) reparar · c) investigar — justificativa obrigatória em a) e c);
//   reclassificar guarda histórico; c) pode criar tarefa DF (responsável e prazo). Fotos antigas são ligadas na primeira listagem.
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const txt = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);
const norm = (v) => String(v ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
const CLASSES = { sem_reparo: 'Sem reparo / não considerar', reparar: 'Reparar', investigar: 'Investigar mais' };

function papeis(campos = []) {
  const ach = (p, re) => campos.find((c) => c.papel === p) || campos.find((c) => !c.papel && re.test(String(c.rotulo || '').trim()));
  return { pa: ach('pa', /^p[áa]\b/i), defeito: ach('defeito', /defeito\s*(n[ºo°.]*|número|num)/i), aerogerador: ach('aerogerador', /aerogerador|wtg|turbina/i) };
}
function identificar(foto, campos) {
  const p = papeis(campos); const v = foto.valores || {};
  const numero = p.defeito ? norm(v[p.defeito.id]) : ''; if (!numero || !foto.projeto_id) return null;
  const pa = p.pa ? norm(v[p.pa.id]) : ''; const referencia = norm((p.aerogerador && v[p.aerogerador.id]) || foto.referencia);
  return { chave: `${foto.projeto_id}|${referencia}|${pa}|${numero}`, referencia: referencia || null, pa: pa || null, numero };
}
async function vincular(sb, tenantId, foto, campos) {
  const id = identificar(foto, campos || foto.modelo?.campos || []); if (!id) return null;
  const resumo = {}; for (const c of (campos || foto.modelo?.campos || [])) { const v = foto.valores?.[c.id]; if (v) resumo[c.rotulo] = `${v}${c.unidade ? ` ${c.unidade}` : ''}`; }
  let d = (await q(sb.from('defeitos_foto').select('*').eq('tenant_id', tenantId).eq('chave', id.chave)))[0];
  const t = foto.tirada_em; const agora = new Date().toISOString();
  if (!d) { try { d = (await q(sb.from('defeitos_foto').insert([{ tenant_id: tenantId, projeto_id: foto.projeto_id, ...id, resumo, primeira_em: t, ultima_em: t, historico: [], criado_em: agora, atualizado_em: agora }]).select()))[0]; }
    catch (e) { if (!/duplicate|unique/i.test(e.message)) throw e; d = (await q(sb.from('defeitos_foto').select('*').eq('tenant_id', tenantId).eq('chave', id.chave)))[0]; } }
  else { const up = { atualizado_em: agora }; if (!d.ultima_em || String(t) >= String(d.ultima_em)) { up.ultima_em = t; up.resumo = { ...(d.resumo || {}), ...resumo }; } if (!d.primeira_em || String(t) < String(d.primeira_em)) up.primeira_em = t;
    await q(sb.from('defeitos_foto').update(up).eq('tenant_id', tenantId).eq('id', d.id).select()); }
  await q(sb.from('fotos_cartao').update({ defeito_id: d.id }).eq('tenant_id', tenantId).eq('id', foto.id).select());
  return d;
}
// fotos que chegaram antes da E3 (ou de projeto que só depois ganhou cartão com nº do defeito)
async function ligarPendentes(sb, tenantId) {
  const fs = (await q(sb.from('fotos_cartao').select('*').eq('tenant_id', tenantId))).filter((f) => !f.defeito_id && !f.excluida_em && f.projeto_id);
  let n = 0; for (const f of fs.slice(0, 300)) { try { if (await vincular(sb, tenantId, f, f.modelo?.campos || [])) n++; } catch { /* segue */ } } return n;
}

async function listar(sb, tenantId, f = {}) {
  await ligarPendentes(sb, tenantId);
  const [ds, fs, ps] = await Promise.all([q(sb.from('defeitos_foto').select('*').eq('tenant_id', tenantId)), q(sb.from('fotos_cartao').select('*').eq('tenant_id', tenantId)), q(sb.from('projetos_foto').select('*').eq('tenant_id', tenantId))]);
  const vivas = fs.filter((x) => !x.excluida_em && x.defeito_id);
  let l = ds.map((d) => { const fd = vivas.filter((x) => String(x.defeito_id) === String(d.id)); const p = ps.find((x) => String(x.id) === String(d.projeto_id));
    const capa = fd.sort((a, b) => String(b.tirada_em).localeCompare(String(a.tirada_em)))[0];
    return { ...d, projeto: p?.nome || null, cliente: p?.cliente_nome || null, fotos: fd.length, tecnicos: [...new Set(fd.map((x) => x.tecnico).filter(Boolean))], capa: capa?.id || null, capa_arquivo: capa?.arquivo || null }; })
    .filter((d) => d.fotos > 0 || d.classificacao);
  if (f.projeto_id) l = l.filter((d) => String(d.projeto_id) === String(f.projeto_id));
  const contagem = { pendente: 0, sem_reparo: 0, reparar: 0, investigar: 0 }; for (const d of l) contagem[d.classificacao || 'pendente']++;
  if (f.classe) l = l.filter((d) => (f.classe === 'pendente' ? !d.classificacao : d.classificacao === f.classe));
  if (f.referencia) l = l.filter((d) => norm(d.referencia) === norm(f.referencia));
  if (f.busca) { const t = String(f.busca).toLowerCase(); l = l.filter((d) => [d.referencia, d.pa, d.numero, d.projeto, d.justificativa, ...Object.values(d.resumo || {})].some((v) => String(v || '').toLowerCase().includes(t))); }
  const ordem = (v) => String(v || '').padStart(8, '0');
  l.sort((a, b) => String(a.projeto).localeCompare(String(b.projeto), 'pt-BR') || String(a.referencia || '').localeCompare(String(b.referencia || ''), 'pt-BR', { numeric: true }) || String(a.pa || '').localeCompare(String(b.pa || '')) || ordem(a.numero).localeCompare(ordem(b.numero)));
  const D = require('./documentos'); for (const d of l.slice(0, 300)) { try { d.capa_url = d.capa_arquivo ? await D.linkArquivo(sb, d.capa_arquivo) : null; } catch { d.capa_url = null; } delete d.capa_arquivo; }
  return { defeitos: l, contagem, CLASSES };
}

async function classificar(sb, tenantId, quem, id, b = {}) {
  const d = (await q(sb.from('defeitos_foto').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!d) return { status: 404, erro: 'Defeito não encontrado.' };
  const classe = b.classificacao === null || b.classificacao === '' ? null : CLASSES[b.classificacao] ? b.classificacao : undefined;
  if (classe === undefined) return { status: 400, erro: 'Escolha: sem reparo, reparar ou investigar.' };
  const just = txt(b.justificativa, 1000);
  if ((classe === 'sem_reparo' || classe === 'investigar') && (!just || just.length < 5)) return { status: 400, erro: 'Justifique a classificação (mínimo 5 letras) — fica no relatório.' };
  if (classe === null && !just) return { status: 400, erro: 'Diga por que o defeito volta para "a classificar".' };
  const agora = new Date().toISOString();
  const historico = [...(d.historico || []), ...(d.classificacao || classe ? [{ de: d.classificacao || null, para: classe, justificativa: just, por: quem?.nome || null, em: agora }] : [])].slice(-50);
  let tarefa = null; let aviso = null;
  if (classe === 'investigar' && b.criar_tarefa && !d.tarefa_id) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.prazo || ''))) return { status: 400, erro: 'Informe o prazo da investigação (ou desligue "criar tarefa").' };
    const t = await require('./tarefas').criar(sb, tenantId, quem, { tipo: 'DF', titulo: `Investigar defeito ${d.numero}${d.pa ? ` · pá ${d.pa}` : ''}${d.referencia ? ` · ${d.referencia}` : ''}`, prioridade: 'alta', prazo: b.prazo,
      responsavel_ref: b.responsavel_ref || null, responsavel: b.responsavel_ref ? null : (txt(b.responsavel, 120) || 'Engenharia'),
      detalhe: `Defeito classificado como "investigar mais" na triagem da engenharia.\n${just}\n\n${Object.entries(d.resumo || {}).map(([k, v]) => `${k}: ${v}`).join(' · ')}`, vinculos: [{ tipo: 'defeito_foto', id: String(d.id), numero: d.numero }] });
    if (t?.erro) aviso = `a tarefa não foi criada (${t.erro})`; else tarefa = t;
  }
  const up = { classificacao: classe, justificativa: just, classificado_por: classe ? quem?.nome || null : null, classificado_em: classe ? agora : null, historico, atualizado_em: agora, ...(tarefa?.id ? { tarefa_id: String(tarefa.id) } : {}) };
  const novo = (await q(sb.from('defeitos_foto').update(up).eq('tenant_id', tenantId).eq('id', id).select()))[0];
  return { defeito: novo, tarefa: tarefa ? { id: tarefa.id, numero: tarefa.numero } : null, aviso: aviso ? `Classificado, mas ${aviso}.` : null };
}

// contagem por pino do mapa (projeto + referência)
async function porPino(sb, tenantId) {
  const ds = await q(sb.from('defeitos_foto').select('*').eq('tenant_id', tenantId)); const m = new Map();
  for (const d of ds) { const k = `${d.projeto_id || 'sem'}|${norm(d.referencia)}`; const c = m.get(k) || { total: 0, pendente: 0, sem_reparo: 0, reparar: 0, investigar: 0 }; c.total++; c[d.classificacao || 'pendente']++; m.set(k, c); }
  return m;
}

module.exports = { CLASSES, papeis, identificar, vincular, ligarPendentes, listar, classificar, porPino };
