// backend/services/autuacoes.js — etapa 12i
//
// Autuações da EMPRESA (requisito legal) — decidido com o Marcony (21/10/2026): são da empresa, não de uma pessoa →
// ficam na tela de ⚠️ Não Conformidades (aba 🏛 Autuações); para a ISO (14001/9001) são não conformidade legal.
//   • órgão (INEA, IBAMA, ANTT, CETESB, vigilância sanitária, Receita, MTE, bombeiros, prefeitura…) e esfera
//   • PRAZO DE DEFESA (o crítico), prazo de recurso, vencimento → calendário (camada 🏛), e-mail diário do gestor,
//     tarefa automática no ✅ Plano para quem monitora (mesmo motor das multas)
//   • ligação com a licença/documento da EMPRESA (📄 Documentos) e, se for o caso, o veículo
//   • "Abrir NC de causa raiz": cria uma NC ligada (5 porquês, plano de ação, eficácia ficam lá)
//   • situação: recebida → defesa apresentada → em recurso → final: paga | cancelada (defesa deferida / anulada)
// Regras do backend: sem DB.raw; ids com String(); filtros sem null.

const crypto = require('crypto');
const D = require('./documentos');

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const texto = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const hojeBR = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600000).toISOString().slice(0, 10);
const diasAte = (de, ate) => Math.round((Date.parse(`${String(ate).slice(0, 10)}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000);
const num = (v) => { if (v === '' || v == null) return null; const t = String(v).trim(); return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); };

const STATUS = ['recebida', 'defesa_apresentada', 'em_recurso', 'paga', 'cancelada'];
const ABERTOS = ['recebida', 'defesa_apresentada', 'em_recurso'];
const FINAIS = ['paga', 'cancelada'];
const STATUS_NOME = { recebida: 'Recebida', defesa_apresentada: 'Defesa apresentada', em_recurso: 'Em recurso', paga: 'Paga', cancelada: 'Cancelada / anulada' };
const ESFERAS = [
  { codigo: 'ambiental', nome: 'Ambiental' }, { codigo: 'transporte', nome: 'Transporte (ANTT, DER…)' }, { codigo: 'trabalhista', nome: 'Trabalhista (MTE)' },
  { codigo: 'sanitaria', nome: 'Sanitária' }, { codigo: 'tributaria', nome: 'Tributária / fiscal' }, { codigo: 'seguranca', nome: 'Segurança (bombeiros)' }, { codigo: 'outra', nome: 'Outra' },
];
const ORGAOS = ['INEA', 'IBAMA', 'CETESB', 'FEPAM', 'ANTT', 'DER', 'Vigilância Sanitária', 'MTE (Auditoria Fiscal do Trabalho)', 'Receita Federal', 'SEFAZ', 'Corpo de Bombeiros', 'Prefeitura', 'ANP', 'INMETRO'];

function validar(body, { parcial = false } = {}) {
  const erros = [], out = {};
  const tem = (k) => body[k] !== undefined;
  const data = (k, nome, obrig) => {
    if (!tem(k) && parcial) return;
    const v = body[k];
    if (!v) { if (obrig) erros.push(`Informe ${nome}`); else out[k] = null; return; }
    if (!DATA.test(String(v))) erros.push(`Data inválida: ${nome}`); else out[k] = v;
  };
  if (!parcial || tem('orgao')) { const o = texto(body.orgao, 80); if (!o) erros.push('Informe o órgão'); else out.orgao = o; }
  if (!parcial || tem('esfera')) { if (!ESFERAS.some((e) => e.codigo === body.esfera)) erros.push('Escolha a esfera'); else out.esfera = body.esfera; }
  if (!parcial || tem('descricao')) { const d = texto(body.descricao, 3000); if (!d) erros.push('Descreva a infração'); else out.descricao = d; }
  data('data_autuacao', 'a data da autuação', !parcial);
  data('recebida_em', 'a data de recebimento', !parcial);
  data('prazo_defesa', 'o prazo de defesa', false);
  data('prazo_recurso', 'o prazo de recurso', false);
  data('vencimento', 'o vencimento', false);
  for (const [k, max] of [['auto_numero', 60], ['base_legal', 300], ['local', 200], ['veiculo', 80], ['obs', 2000]]) if (tem(k)) out[k] = texto(body[k], max);
  if (tem('valor')) { const v = num(body.valor); if (v !== null && !(v >= 0 && v < 1e9)) erros.push('Valor inválido'); else out.valor = v; }
  if (tem('documento_id')) out.documento_id = body.documento_id && /^\d+$/.test(String(body.documento_id)) ? String(body.documento_id) : null;
  if (tem('equipamento_id')) out.equipamento_id = body.equipamento_id ? String(body.equipamento_id) : null;
  if (tem('responsavel_id')) out.responsavel_id = body.responsavel_id || null;
  if (out.data_autuacao && out.data_autuacao > hojeBR()) erros.push('A data da autuação não pode ser futura');
  return { erros, dados: out };
}

async function doTenant(supabase, tenantId, id) {
  if (!/^\d+$/.test(String(id))) return null;
  return (await q(supabase.from('autuacoes').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] || null;
}

async function conferirVinculos(supabase, tenantId, dados) {
  if (dados.documento_id) {
    const d = (await q(supabase.from('documentos').select('*').eq('tenant_id', tenantId).eq('id', dados.documento_id)))[0];
    if (!d) return 'Documento não encontrado';
    dados.documento_nome = [d.tipo_nome, d.numero].filter(Boolean).join(' nº ').slice(0, 200);
  } else if (dados.documento_id === null) dados.documento_nome = null;
  if (dados.equipamento_id) {
    const e = (await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId).eq('id', dados.equipamento_id)))[0];
    if (!e) return 'Veículo/equipamento não encontrado';
    if (!dados.veiculo) dados.veiculo = [e.tag, e.nome].filter(Boolean).join(' — ').slice(0, 80);
  }
  if (dados.responsavel_id) {
    const u = (await q(supabase.from('usuarios').select('*').eq('tenant_id', tenantId).eq('id', dados.responsavel_id)))[0];
    if (!u) return 'Responsável não encontrado';
    dados.responsavel_nome = u.nome;
  } else if (dados.responsavel_id === null) dados.responsavel_nome = null;
  return null;
}

/** Próximo prazo: defesa (se "recebida") · recurso (se "defesa apresentada" ou "em recurso") · vencimento */
function proximoPrazo(a, hoje = hojeBR()) {
  if (!ABERTOS.includes(a.status)) return null;
  const mk = (tipo, nome, data) => ({ tipo, nome, data: String(data).slice(0, 10), dias: diasAte(hoje, data) });
  if (a.status === 'recebida' && a.prazo_defesa) return mk('defesa', 'Apresentar defesa', a.prazo_defesa);
  if (a.status !== 'recebida' && a.prazo_recurso && String(a.prazo_recurso).slice(0, 10) >= hoje) return mk('recurso', 'Prazo de recurso', a.prazo_recurso);
  if (a.vencimento) return mk('vencimento', 'Pagar / vencimento', a.vencimento);
  if (a.prazo_recurso) return mk('recurso', 'Prazo de recurso', a.prazo_recurso);
  return null;
}
const enriquecer = (a, hoje) => ({ ...a, status_nome: STATUS_NOME[a.status], aberta: ABERTOS.includes(a.status), prazo: proximoPrazo(a, hoje), tem_arquivo: !!a.arquivo_path, tem_defesa: !!a.defesa_path,
  esfera_nome: (ESFERAS.find((e) => e.codigo === a.esfera) || {}).nome || a.esfera });

async function listar(supabase, tenantId, { agora } = {}) {
  const hoje = hojeBR(agora);
  return (await q(supabase.from('autuacoes').select('*').eq('tenant_id', tenantId))).map((a) => enriquecer(a, hoje))
    .sort((a, b) => (b.aberta - a.aberta) || ((a.prazo?.dias ?? 9999) - (b.prazo?.dias ?? 9999)) || String(b.data_autuacao).localeCompare(String(a.data_autuacao)));
}

// ─── tarefa no ✅ Plano (mesmo motor das multas) ───────────────────────────
async function sincronizarTarefa(supabase, tenantId, a) {
  try {
    const p = proximoPrazo(a);
    const titulo = `🏛 Autuação ${a.orgao}${a.auto_numero ? ` nº ${a.auto_numero}` : ''}`.slice(0, 200);
    const detalhe = [`Situação: ${STATUS_NOME[a.status]}.`, p ? `Próximo passo: ${p.nome} até ${p.data.split('-').reverse().join('/')}.` : null, `Infração: ${String(a.descricao).slice(0, 200)}.`,
      a.valor != null ? `Valor: R$ ${Number(a.valor).toFixed(2).replace('.', ',')}.` : null, a.nc_numero ? `NC de causa raiz: ${a.nc_numero}.` : null,
      'Acompanhe em ⚠️ Não Conformidades → 🏛 Autuações (tarefa criada pelo QuotaFlow).'].filter(Boolean).join(' ');
    const final = FINAIS.includes(a.status);
    if (a.tarefa_id) {
      await supabase.from('tarefas').update(final ? { status: a.status === 'cancelada' ? 'cancelada' : 'concluida', detalhe } : { titulo, detalhe, prazo: p?.data || null, responsavel: a.responsavel_nome || null }).eq('id', a.tarefa_id).eq('tenant_id', tenantId);
      return a.tarefa_id;
    }
    if (final || !a.responsavel_id) return null;
    const { data, error } = await supabase.from('tarefas').insert([{ tenant_id: tenantId, titulo, detalhe, responsavel: a.responsavel_nome || null, prazo: p?.data || null, prioridade: 'alta', status: 'pendente', criado_em: new Date().toISOString() }]).select();
    if (error) throw new Error(error.message);
    const id = String(data[0].id);
    await supabase.from('autuacoes').update({ tarefa_id: id }).eq('id', a.id).eq('tenant_id', tenantId);
    return id;
  } catch (e) { console.warn('⚠️ [autuacoes] tarefa do Plano:', e.message); return a.tarefa_id || null; }
}

const evento = (status, por, obs) => ({ em: new Date().toISOString(), status, por: por || null, obs: obs || null });

async function subir(supabase, tenantId, id, prefixo, { base64, mime }) {
  const msg = D.validarArquivo({ base64, mime }); if (msg) return { erro: msg };
  const path = `tenant-${tenantId}/autuacao-${id}/${prefixo}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${D.MIME_OK[mime]}`;
  const { error } = await supabase.storage.from(D.BUCKET).upload(path, Buffer.from(String(base64), 'base64'), { contentType: mime, upsert: false });
  if (error) throw new Error(`Falha ao subir o arquivo: ${error.message}`);
  return { path };
}
async function anexar(supabase, tenantId, a, body, campo) {
  const b64 = body[`${campo}_base64`]; if (!b64) return { a };
  const up = await subir(supabase, tenantId, a.id, campo, { base64: b64, mime: body[`${campo}_mime`] });
  if (up.erro) return { erro: up.erro };
  const k = campo === 'defesa' ? 'defesa' : 'arquivo';
  if (a[`${k}_path`]) await D.removerArquivo(supabase, a[`${k}_path`]);
  const r = await supabase.from('autuacoes').update({ [`${k}_path`]: up.path, [`${k}_nome`]: texto(body[`${campo}_nome`], 200) || campo, [`${k}_mime`]: body[`${campo}_mime`] }).eq('id', a.id).eq('tenant_id', tenantId).select();
  return { a: r.error ? a : r.data[0] };
}

async function criar(supabase, tenantId, { usuarioId, usuarioNome }, body = {}) {
  const { erros, dados } = validar(body);
  if (erros.length) return { status: 400, erro: erros[0] };
  const ve = await conferirVinculos(supabase, tenantId, dados); if (ve) return { status: 400, erro: ve };
  const { data, error } = await supabase.from('autuacoes').insert([{ ...dados, tenant_id: tenantId, status: 'recebida', criado_por: usuarioId || null, historico: [evento('recebida', usuarioNome, 'Autuação cadastrada')] }]).select();
  if (error) throw new Error(error.message);
  let a = data[0];
  const r = await anexar(supabase, tenantId, a, body, 'arquivo');
  if (r.erro) { await supabase.from('autuacoes').delete().eq('id', a.id).eq('tenant_id', tenantId); return { status: 400, erro: r.erro }; }
  a = r.a;
  a.tarefa_id = await sincronizarTarefa(supabase, tenantId, a);
  return { autuacao: enriquecer(a) };
}

async function editar(supabase, tenantId, quem, a, body = {}) {
  if (FINAIS.includes(a.status)) return { status: 400, erro: 'Autuação finalizada — não dá para editar' };
  const { erros, dados } = validar(body, { parcial: true });
  if (erros.length) return { status: 400, erro: erros[0] };
  const ve = await conferirVinculos(supabase, tenantId, dados); if (ve) return { status: 400, erro: ve };
  if (body.nc_id !== undefined) { dados.nc_id = body.nc_id ? String(body.nc_id).slice(0, 60) : null; dados.nc_numero = texto(body.nc_numero, 40); }
  const { data, error } = await supabase.from('autuacoes').update({ ...dados, atualizado_em: new Date().toISOString() }).eq('id', a.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  let n = data[0];
  for (const campo of ['arquivo', 'defesa']) { const r = await anexar(supabase, tenantId, n, body, campo); if (r.erro) return { status: 400, erro: r.erro }; n = r.a; }
  n.tarefa_id = await sincronizarTarefa(supabase, tenantId, n);
  return { autuacao: enriquecer(n) };
}

/** body: { status, obs, valor_pago, motivo_cancelamento, finalizada_em, prazo_recurso, defesa_base64/_mime/_nome } */
async function mudarStatus(supabase, tenantId, { usuarioNome }, a, body = {}) {
  const novo = body.status;
  if (!STATUS.includes(novo)) return { status: 400, erro: 'Situação inválida' };
  if (FINAIS.includes(a.status)) return { status: 400, erro: 'Autuação já finalizada' };
  if (novo === a.status) return { status: 400, erro: 'Já está nessa situação' };
  const upd = { status: novo, atualizado_em: new Date().toISOString() };
  const fim = DATA.test(String(body.finalizada_em || '')) ? body.finalizada_em : hojeBR();
  if (body.prazo_recurso !== undefined) upd.prazo_recurso = DATA.test(String(body.prazo_recurso || '')) ? body.prazo_recurso : null;
  if (novo === 'paga') { const v = num(body.valor_pago); if (!(v >= 0)) return { status: 400, erro: 'Informe o valor pago' }; Object.assign(upd, { valor_pago: v, finalizada_em: fim }); }
  if (novo === 'cancelada') { const mot = texto(body.motivo_cancelamento, 300); if (!mot) return { status: 400, erro: 'Informe o motivo (defesa deferida, auto anulado…)' }; Object.assign(upd, { motivo_cancelamento: mot, finalizada_em: fim }); }
  upd.historico = [...(Array.isArray(a.historico) ? a.historico : []), evento(novo, usuarioNome, texto(body.obs, 300))];
  const { data, error } = await supabase.from('autuacoes').update(upd).eq('id', a.id).eq('tenant_id', tenantId).eq('status', a.status).select();
  if (error) throw new Error(error.message);
  if (!data?.length) return { status: 409, erro: 'A autuação mudou enquanto você editava — recarregue' };
  let n = data[0];
  if (body.defesa_base64) { const r = await anexar(supabase, tenantId, n, body, 'defesa'); if (r.erro) return { status: 400, erro: r.erro }; n = r.a; }
  await sincronizarTarefa(supabase, tenantId, n);
  return { autuacao: enriquecer(n) };
}

/** Calendário (camada 🏛) */
async function eventosNoIntervalo(supabase, tenantId, de, ate, { agora } = {}) {
  const hoje = hojeBR(agora);
  const out = [];
  for (const a of (await q(supabase.from('autuacoes').select('*').eq('tenant_id', tenantId))).filter((x) => ABERTOS.includes(x.status))) {
    const add = (tipo, data, titulo) => { if (data && String(data).slice(0, 10) >= de && String(data).slice(0, 10) <= ate) { const dias = diasAte(hoje, data); out.push({ id: `aut-${a.id}-${tipo}`, tipo, data: String(data).slice(0, 10), dias, situacao: dias < 0 ? 'vencido' : dias <= 5 ? 'vence' : 'ok', titulo, de: [a.orgao, a.auto_numero && `auto ${a.auto_numero}`].filter(Boolean).join(' · ') }); } };
    if (a.status === 'recebida') add('defesa', a.prazo_defesa, 'Prazo de defesa');
    if (a.status !== 'recebida') add('recurso', a.prazo_recurso, 'Prazo de recurso');
    add('vencimento', a.vencimento, 'Autuação vence');
  }
  return out.sort((x, y) => x.data.localeCompare(y.data));
}

module.exports = { STATUS, ABERTOS, FINAIS, STATUS_NOME, ESFERAS, ORGAOS, validar, doTenant, listar, proximoPrazo, criar, editar, mudarStatus, eventosNoIntervalo, sincronizarTarefa, hojeBR };
