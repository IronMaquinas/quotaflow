// services/tarefas.js — etapa 18g: 🔗 rastreabilidade das tarefas do ✅ Plano (auditoria ISO)
//   número TSK-<tipo>-<ano>-<nnnn> dado pelo banco (trigger da migration 065) e imutável
//   tipo (TR · NC · AU · MT · CM · HR · GN) · evidências (anexos) · histórico (quem fez o quê e quando) · vínculos (BID → PV → TSK → AT…)
//   Tarefa que nasceu em outra tela (origem) só se encerra lá — 409 (não desloga).
const crypto = require('crypto');

const TIPOS = {
  TR: { nome: 'Transporte', icone: '🚚' }, NC: { nome: 'Não conformidade', icone: '⚠️' }, AU: { nome: 'Auditoria', icone: '🔎' },
  MT: { nome: 'Manutenção', icone: '🔧' }, CM: { nome: 'Comercial', icone: '📈' }, HR: { nome: 'Pessoas', icone: '👥' }, GN: { nome: 'Geral', icone: '📌' },
};
const TIPO_DA_ORIGEM = { prospeccao: 'CM', multa: 'HR', autuacao: 'NC', fiscal: 'TR', nc: 'NC' }; // igual à qf_tarefa_tipo_da_origem (065)
const ORIGEM_NOME = { prospeccao: '📈 Comercial → 📣 Prospecção (encerra quando o BID for criado ou o comercial cancelar)',
  fiscal: '🧾 Documentos (conclui sozinha com NF-e, CT-e, averbação e MDF-e ✓; para cancelar use "Dispensar" com a justificativa)' }; // 18g.1
const TF = () => require('./tarefasFiscais'); // 18g.1
const STATUS = { pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada' };
const PRIORIDADE = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const VINCULOS = { bid: 'BID', pv: 'Pedido', trecho: 'Trecho', at: 'AT', nc: 'NC', prospeccao: 'Prospecção', contrato: 'Contrato', inspecao: 'Inspeção', multa: 'Multa', autuacao: 'Autuação', tarefa: 'Tarefa' };
const CAMPOS = ['titulo', 'detalhe', 'responsavel', 'prazo', 'prioridade', 'status', 'tipo'];
const ROTULO = { titulo: 'título', detalhe: 'descrição', responsavel: 'responsável', prazo: 'prazo', prioridade: 'prioridade', status: 'situação', tipo: 'tipo' };
const BUCKET = 'documentos';
const LIMITE = 10 * 1024 * 1024;
const MIME = { 'application/pdf': 'pdf', 'application/xml': 'xml', 'text/xml': 'xml', 'image/jpeg': 'jpg', 'image/png': 'png' };

const texto = (v, n) => String(v ?? '').trim().slice(0, n);
const jsonArr = (v) => { if (Array.isArray(v)) return v; if (typeof v === 'string') { try { const x = JSON.parse(v); return Array.isArray(x) ? x : []; } catch { return []; } } return []; };
const semMigration = (m) => /tipo|numero|anexos|historico|vinculos|tarefa_sequencias/.test(m) && /does not exist|schema cache|column|relation/.test(m);
const ERRO_065 = { status: 409, erro: 'Rode a migration 065 antes (rastreabilidade das tarefas)' };
const tipoDe = (t) => t.tipo || TIPO_DA_ORIGEM[t.origem] || 'GN';
const valorTxt = (k, v) => (v == null || v === '' ? '—' : k === 'status' ? STATUS[v] || v : k === 'prioridade' ? PRIORIDADE[v] || v : k === 'tipo' ? `${v} · ${TIPOS[v]?.nome || ''}` : k === 'prazo' ? String(v).slice(0, 10).split('-').reverse().join('/') : String(v).slice(0, 120));

function enfeitar(t) {
  const tipo = tipoDe(t);
  return { ...t, tipo, tipo_nome: TIPOS[tipo]?.nome, tipo_icone: TIPOS[tipo]?.icone, numero: t.numero || null,
    comentarios: jsonArr(t.comentarios), anexos: jsonArr(t.anexos).map(({ path, ...a }) => a), historico: jsonArr(t.historico), vinculos: jsonArr(t.vinculos),
    trava_origem: ORIGEM_NOME[t.origem] ? ORIGEM_NOME[t.origem] : null,
    ...(t.origem === 'fiscal' ? { fiscal: TF().resumo(t.checklist || TF().novoChecklist()), checklist: t.checklist || TF().novoChecklist() } : {}) };
}
const entrada = (quem, acao, x = {}) => ({ em: new Date().toISOString(), por: quem?.nome || null, acao, ...x });

function limparVinculos(v) {
  return jsonArr(v).filter((x) => x && VINCULOS[x.tipo] && (x.id != null || x.numero)).slice(0, 30)
    .map((x) => ({ tipo: x.tipo, id: x.id != null ? String(x.id).slice(0, 60) : null, numero: texto(x.numero, 60) || null, ...(x.rotulo ? { rotulo: texto(x.rotulo, 120) } : {}) }));
}

async function doTenant(supabase, tenantId, id) {
  if (!/^\d+$/.test(String(id))) return null;
  const { data, error } = await supabase.from('tarefas').select('*').eq('tenant_id', tenantId).eq('id', id);
  if (error) throw new Error(error.message);
  return data?.[0] || null;
}

async function listar(supabase, tenantId) {
  const { data, error } = await supabase.from('tarefas').select('*').eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  return (data || []).map(enfeitar);
}

async function detalhe(supabase, tenantId, id) {
  const t = await doTenant(supabase, tenantId, id); if (!t) return { status: 404, erro: 'Tarefa não encontrada' };
  return enfeitar(t);
}

async function criar(supabase, tenantId, quem, body = {}) {
  const titulo = texto(body.titulo, 200); if (!titulo) return { status: 400, erro: 'Título é obrigatório' };
  const tipo = body.tipo ? String(body.tipo).toUpperCase() : 'GN';
  if (!TIPOS[tipo]) return { status: 400, erro: `Tipo inválido (${Object.keys(TIPOS).join(', ')})` };
  const agora = new Date().toISOString();
  const linha = { tenant_id: tenantId, titulo, detalhe: texto(body.detalhe, 4000), responsavel: texto(body.responsavel, 120) || null, prazo: body.prazo || null,
    prioridade: PRIORIDADE[body.prioridade] ? body.prioridade : 'media', status: STATUS[body.status] ? body.status : 'pendente', criado_em: agora,
    tipo, anexos: [], vinculos: limparVinculos(body.vinculos), historico: [entrada(quem, 'criada', { texto: `Tipo ${tipo} · ${TIPOS[tipo].nome}` })] };
  const { data, error } = await supabase.from('tarefas').insert([linha]).select();
  if (error) {
    if (!semMigration(error.message)) throw new Error(error.message);
    const { tipo: _t, anexos: _a, vinculos: _v, historico: _h, ...velha } = linha; // sem a 065: cria como antes (sem número)
    const r = await supabase.from('tarefas').insert([velha]).select(); if (r.error) throw new Error(r.error.message);
    return enfeitar(r.data[0]);
  }
  return enfeitar(data[0]);
}

async function atualizar(supabase, tenantId, quem, id, body = {}) {
  const t = await doTenant(supabase, tenantId, id); if (!t) return { status: 404, erro: 'Tarefa não encontrada' };
  if (ORIGEM_NOME[t.origem] && ['concluida', 'cancelada'].includes(body.status) && body.status !== t.status) return { status: 409, erro: `Esta tarefa se resolve em ${ORIGEM_NOME[t.origem]}.` };
  const upd = {}; const hist = [];
  for (const k of CAMPOS) {
    if (!(k in body)) continue;
    let v = body[k];
    if (k === 'tipo') { v = String(v || '').toUpperCase(); if (!TIPOS[v]) return { status: 400, erro: 'Tipo inválido' }; }
    if (k === 'status' && !STATUS[v]) return { status: 400, erro: 'Situação inválida' };
    if (k === 'prioridade' && !PRIORIDADE[v]) return { status: 400, erro: 'Prioridade inválida' };
    if (k === 'titulo') { v = texto(v, 200); if (!v) return { status: 400, erro: 'Título é obrigatório' }; }
    if (k === 'detalhe') v = texto(v, 4000);
    if (k === 'responsavel') v = texto(v, 120) || null;
    if (k === 'prazo') v = v ? String(v).slice(0, 10) : null;
    const antes = k === 'tipo' ? tipoDe(t) : t[k];
    if (String(antes ?? '') === String(v ?? '')) continue;
    upd[k] = v;
    hist.push(entrada(quem, k === 'status' ? 'status' : k === 'tipo' ? 'reclassificada' : 'editada', { campo: ROTULO[k], de: valorTxt(k, antes), para: valorTxt(k, v) }));
  }
  if ('vinculos' in body) upd.vinculos = limparVinculos(body.vinculos);
  if (!Object.keys(upd).length) return enfeitar(t);
  if (hist.length) upd.historico = [...jsonArr(t.historico), ...hist];
  const { data, error } = await supabase.from('tarefas').update(upd).eq('id', t.id).eq('tenant_id', tenantId).select();
  if (error) { if (semMigration(error.message)) { // sem a 065: grava só os campos antigos
    const velhos = Object.fromEntries(Object.entries(upd).filter(([k]) => !['tipo', 'historico', 'vinculos'].includes(k)));
    if (!Object.keys(velhos).length) return ERRO_065;
    const r = await supabase.from('tarefas').update(velhos).eq('id', t.id).eq('tenant_id', tenantId).select(); if (r.error) throw new Error(r.error.message); return enfeitar(r.data[0]);
  } throw new Error(error.message); }
  return enfeitar(data[0]);
}

async function excluir(supabase, tenantId, id) {
  const t = await doTenant(supabase, tenantId, id); if (!t) return { status: 404, erro: 'Tarefa não encontrada' };
  if (ORIGEM_NOME[t.origem]) return { status: 409, erro: `Esta tarefa se resolve em ${ORIGEM_NOME[t.origem]}.` };
  if (t.numero) return { status: 409, erro: `${t.numero} tem número de rastreabilidade — cancele em vez de excluir (fica no histórico)` };
  const { error } = await supabase.from('tarefas').delete().eq('id', t.id).eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

async function comentar(supabase, tenantId, quem, id, txt) {
  const t = await doTenant(supabase, tenantId, id); if (!t) return { status: 404, erro: 'Tarefa não encontrada' };
  const v = texto(txt, 4000); if (!v) return { status: 400, erro: 'Escreva o comentário' };
  const comentarios = [...jsonArr(t.comentarios), { id: Date.now(), texto: v, autor: quem?.nome || quem?.email || 'Usuário', data: new Date().toISOString() }];
  const { data, error } = await supabase.from('tarefas').update({ comentarios: JSON.stringify(comentarios) }).eq('id', t.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return enfeitar(data[0]);
}

async function anexar(supabase, tenantId, quem, id, { nome, mime, base64 } = {}) {
  const t = await doTenant(supabase, tenantId, id); if (!t) return { status: 404, erro: 'Tarefa não encontrada' };
  if (!('anexos' in t)) return ERRO_065;
  if (!MIME[mime]) return { status: 400, erro: 'Arquivo: PDF, XML, JPG ou PNG' };
  const buf = Buffer.from(String(base64 || ''), 'base64'); if (!buf.length) return { status: 400, erro: 'Arquivo vazio' };
  if (buf.length > LIMITE) return { status: 400, erro: 'Arquivo maior que 10 MB' };
  const aid = crypto.randomBytes(6).toString('hex');
  const path = `tenant-${tenantId}/tarefas/${t.id}/${Date.now()}-${aid}.${MIME[mime]}`;
  const { error: eu } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: mime, upsert: false });
  if (eu) throw new Error(`Falha ao subir o arquivo: ${eu.message}`);
  const anexo = { id: aid, nome: texto(nome, 160) || `evidencia.${MIME[mime]}`, path, mime, tamanho: buf.length, em: new Date().toISOString(), por: quem?.nome || null };
  const { data, error } = await supabase.from('tarefas').update({ anexos: [...jsonArr(t.anexos), anexo], historico: [...jsonArr(t.historico), entrada(quem, 'anexo', { texto: `📎 ${anexo.nome}` })] }).eq('id', t.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return enfeitar(data[0]);
}
async function linkAnexo(supabase, tenantId, id, anexoId) {
  const t = await doTenant(supabase, tenantId, id); const a = jsonArr(t?.anexos).find((x) => x.id === anexoId);
  if (!a) return { status: 404, erro: 'Anexo não encontrado' };
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.path, 3600, { download: false });
  if (error) throw new Error(error.message);
  return { url: data?.signedUrl || null, nome: a.nome };
}
async function removerAnexo(supabase, tenantId, quem, id, anexoId) {
  const t = await doTenant(supabase, tenantId, id); const a = jsonArr(t?.anexos).find((x) => x.id === anexoId);
  if (!a) return { status: 404, erro: 'Anexo não encontrado' };
  if (['concluida', 'cancelada'].includes(t.status)) return { status: 409, erro: 'Tarefa encerrada — reabra para mexer nas evidências' };
  try { await supabase.storage.from(BUCKET).remove([a.path]); } catch { /* arquivo some do bucket depois; o registro sai já */ }
  const { data, error } = await supabase.from('tarefas').update({ anexos: jsonArr(t.anexos).filter((x) => x.id !== anexoId), historico: [...jsonArr(t.historico), entrada(quem, 'anexo_removido', { texto: `🗑 ${a.nome}` })] }).eq('id', t.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return enfeitar(data[0]);
}

/** para outros serviços: acrescenta uma linha no histórico (best-effort — sem a 065 não faz nada) */
async function registrar(supabase, tenantId, id, quem, acao, extra = {}) {
  try {
    const t = await doTenant(supabase, tenantId, id); if (!t || !('historico' in t)) return;
    await supabase.from('tarefas').update({ historico: [...jsonArr(t.historico), entrada(quem, acao, extra)] }).eq('id', t.id).eq('tenant_id', tenantId);
  } catch { /* histórico não pode derrubar quem chamou */ }
}

module.exports = { TIPOS, VINCULOS, STATUS, listar, detalhe, criar, atualizar, excluir, comentar, anexar, linkAnexo, removerAnexo, registrar, enfeitar };
