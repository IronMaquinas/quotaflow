// backend/services/contratoModelos.js — etapa 14d
//
// 📄 Modelos de contrato de locação (decidido com o Marcony, 23/10/2026):
//   • modelo = texto com CAMPOS AUTOMÁTICOS ({{cliente.razao_social}}, {{contrato.numero}}, {{tabela_equipamentos}}…).
//     Biblioteca do QuotaFlow no Console (tenant_id NULL) → a empresa importa uma cópia e adapta (versão nova = aviso).
//   • no contrato: escolhe o modelo, preenche as CONDIÇÕES COMERCIAIS (caução, franquia, hora excedente, reajuste, multa,
//     vencimento, forma de pagamento, foro, condições específicas) e o valor mensal de cada equipamento.
//   • 👁 prévia a qualquer momento; 📄 EMITIR congela o texto + a tabela (hash SHA-256, versão 1, 2…). Emitir de novo
//     (depois de mudar algo) gera nova versão e pede novo aceite.
//   • ✍ aceite do LOCATÁRIO pelo acesso dele: lê, assina na tela → nome, data, assinatura e hash ficam no contrato.
// Regras do backend: sem DB.raw; ids com String(); filtros sem null.

const crypto = require('crypto');

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const texto = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const dig = (v) => String(v || '').replace(/\D/g, '');
const brl = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' '));
const dBR = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : null);
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const hojeBR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const extenso = (d) => { const [a, m, dia] = String(d).slice(0, 10).split('-'); return `${Number(dia)} de ${MESES[Number(m) - 1]} de ${a}`; };
const fmtDoc = (v) => { const d = dig(v); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : (v || null); };
const VAZIO = '________';
const TABELA = '[[TABELA_EQUIPAMENTOS]]';

/** Campos que o texto pode usar (a tela mostra esta lista para inserir com um clique) */
const CAMPOS = [
  ['contrato.numero', 'Nº do contrato (CL-…)'], ['contrato.local', 'Local / obra'], ['contrato.inicio', 'Data de início'], ['contrato.fim_previsto', 'Data de término'],
  ['contrato.prazo', 'Prazo por extenso ("até 01/03/2027" / "indeterminado")'],
  ['empresa.razao_social', 'Sua razão social'], ['empresa.nome', 'Seu nome fantasia'], ['empresa.cnpj', 'Seu CNPJ'],
  ['cliente.razao_social', 'Razão social do cliente'], ['cliente.nome', 'Nome do cliente'], ['cliente.documento', 'CNPJ/CPF do cliente'], ['cliente.endereco_completo', 'Endereço do cliente'],
  ['cliente.cidade', 'Cidade do cliente'], ['cliente.uf', 'UF do cliente'], ['contato.nome', 'Contato do cliente'],
  ['empresa.endereco_completo', 'Endereço da sua empresa'], ['empresa.telefone', 'Telefone da sua empresa'], ['empresa.email', 'E-mail da sua empresa'], // 14d.4
  ['representante.nome', 'Quem assina pelo cliente — nome'], ['representante.cpf', 'Quem assina pelo cliente — CPF'], ['representante.cargo', 'Quem assina pelo cliente — cargo'], // 14d.3
  ['tabela_equipamentos', 'Tabela dos equipamentos (tag, descrição, valor mensal)'], ['valor_mensal_total', 'Valor mensal total'], ['qtd_equipamentos', 'Quantidade de equipamentos'],
  ['condicoes.caucao', 'Caução'], ['condicoes.franquia_horas', 'Franquia (horas/mês)'], ['condicoes.hora_excedente', 'Valor da hora excedente'], ['condicoes.reajuste', 'Índice de reajuste'],
  ['condicoes.multa_rescisoria', 'Multa rescisória'], ['condicoes.vencimento_dia', 'Dia de vencimento'], ['condicoes.forma_pagamento', 'Forma de pagamento'], ['condicoes.foro', 'Foro (comarca)'],
  ['condicoes.observacoes', 'Condições específicas'], ['data_extenso', 'Data por extenso (dia da emissão)'], ['data', 'Data (dd/mm/aaaa)'],
];
const NOMES = new Set(CAMPOS.map((c) => c[0]));

const NA_OK = ['caucao', 'franquia_horas', 'hora_excedente', 'reajuste', 'multa_rescisoria_pct', 'vencimento_dia', 'forma_pagamento', 'foro'];
const NA_TXT = 'não se aplica';
/** Condições comerciais: tudo opcional; números como número */
function validarCondicoes(c = {}) {
  const out = {};
  const ROT = { caucao: 'caução', franquia_horas: 'franquia (horas)', hora_excedente: 'hora excedente', multa_rescisoria_pct: 'multa rescisória (0 a 100%)', vencimento_dia: 'dia de vencimento (1 a 31)' };
  const naSet = new Set(Array.isArray(c.na) ? c.na.filter((k) => NA_OK.includes(k)) : []);
  const num = (k, min = 0, max = 1e9) => { if (naSet.has(k)) return; if (c[k] === undefined || c[k] === null || c[k] === '') return; const t = String(c[k]).trim(); const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); if (!Number.isFinite(n) || n < min || n > max) throw new Error(`Valor inválido: ${ROT[k] || k}`); out[k] = n; };
  num('caucao'); num('franquia_horas', 0, 100000); num('hora_excedente'); num('multa_rescisoria_pct', 0, 100); num('vencimento_dia', 1, 31);
  for (const [k, n] of [['reajuste', 60], ['forma_pagamento', 120], ['foro', 120], ['observacoes', 4000]]) if (c[k] !== undefined) out[k] = texto(c[k], n);
  // 14d.2: campos marcados como "não se aplica" (N/A) — saem assim no texto e não contam como faltando
  if (Array.isArray(c.na)) out.na = [...naSet];
  // 14d.3: quem assina pelo cliente (pode não ser o contato do cadastro)
  if (c.representante !== undefined) {
    const r = c.representante || {}; const cpf = String(r.cpf || '').replace(/\D/g, '');
    if (cpf && cpf.length !== 11) throw new Error('CPF de quem assina: 11 dígitos');
    out.representante = { nome: texto(r.nome, 120), cpf: cpf || null, cargo: texto(r.cargo, 80) };
  }
  for (const k of out.na || []) delete out[k];
  return out;
}

// ─── modelos (biblioteca e empresa) ─────────────────────────────────────────
function validarModelo(body = {}, parcial = false) {
  const out = {}; const tem = (k) => body[k] !== undefined;
  if (!parcial || tem('nome')) { const n = texto(body.nome, 120); if (!n) return { erro: 'Informe o nome do modelo' }; out.nome = n; }
  if (tem('descricao')) out.descricao = texto(body.descricao, 500);
  if (!parcial || tem('corpo')) {
    const c = String(body.corpo || '').replace(/\r\n/g, '\n').trim(); if (c.length < 50) return { erro: 'Escreva o texto do contrato' };
    if (c.length > 60000) return { erro: 'Texto muito longo (máx. 60 mil caracteres)' };
    const desconhecidos = [...new Set([...c.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).filter((n) => !NOMES.has(n)))];
    if (desconhecidos.length) return { erro: `Campo desconhecido no texto: {{${desconhecidos[0]}}}` };
    out.corpo = c;
  }
  return { dados: out };
}
const resumo = (m) => ({ ...m, campos_usados: [...new Set([...String(m.corpo || '').matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((x) => x[1]))].length });
async function bibliotecaTodos(supabase) { return (await q(supabase.from('contrato_modelos').select('*').is('tenant_id', null))).sort((a, b) => String(a.nome).localeCompare(String(b.nome))); }
async function bibliotecaConsole(supabase) { return { modelos: (await bibliotecaTodos(supabase)).map(resumo), campos: CAMPOS }; }
async function criarBib(supabase, body) {
  const v = validarModelo(body); if (v.erro) return { status: 400, erro: v.erro };
  const { data, error } = await supabase.from('contrato_modelos').insert([{ ...v.dados, tenant_id: null, versao: 1, ativo: true }]).select();
  if (error) throw new Error(error.message);
  return { modelo: data[0] };
}
async function editarBib(supabase, id, body = {}) {
  const m = /^\d+$/.test(String(id)) ? (await q(supabase.from('contrato_modelos').select('*').is('tenant_id', null).eq('id', id)))[0] : null;
  if (!m) return { status: 404, erro: 'Modelo não encontrado' };
  const v = validarModelo(body, true); if (v.erro) return { status: 400, erro: v.erro };
  const mudou = ['nome', 'corpo'].some((k) => v.dados[k] !== undefined && v.dados[k] !== m[k]);
  if (body.ativo !== undefined) v.dados.ativo = body.ativo !== false;
  const { data, error } = await supabase.from('contrato_modelos').update({ ...v.dados, versao: mudou ? (m.versao || 1) + 1 : m.versao, atualizado_em: new Date().toISOString() }).eq('id', m.id).is('tenant_id', null).select();
  if (error) throw new Error(error.message);
  return { modelo: data[0], versao_subiu: mudou };
}
async function modelosTenant(supabase, tenantId) {
  const l = (await q(supabase.from('contrato_modelos').select('*').eq('tenant_id', tenantId))).filter((m) => m.ativo !== false);
  const bib = l.some((m) => m.origem_id != null) ? new Map((await bibliotecaTodos(supabase)).map((m) => [String(m.id), Number(m.versao || 1)])) : new Map();
  return l.map((m) => ({ ...resumo(m), versao_nova: m.origem_id != null && (bib.get(String(m.origem_id)) || 0) > Number(m.origem_versao || 0) })).sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
}
async function bibliotecaParaTenant(supabase, tenantId) {
  const meus = await q(supabase.from('contrato_modelos').select('*').eq('tenant_id', tenantId));
  const ja = new Set(meus.filter((m) => m.origem_id != null && m.ativo !== false).map((m) => String(m.origem_id)));
  return (await bibliotecaTodos(supabase)).filter((m) => m.ativo !== false).map((m) => ({ ...resumo(m), ja_importado: ja.has(String(m.id)) }));
}
async function importar(supabase, tenantId, bibId) {
  const m = /^\d+$/.test(String(bibId || '')) ? (await q(supabase.from('contrato_modelos').select('*').is('tenant_id', null).eq('id', bibId)))[0] : null;
  if (!m || m.ativo === false) return { status: 404, erro: 'Modelo não encontrado' };
  const { data, error } = await supabase.from('contrato_modelos').insert([{ tenant_id: tenantId, nome: m.nome, descricao: m.descricao, corpo: m.corpo, origem_id: m.id, origem_versao: m.versao, versao: 1, ativo: true }]).select();
  if (error) throw new Error(error.message);
  return { modelo: data[0] };
}
async function atualizarDaBiblioteca(supabase, tenantId, id) {
  const t = /^\d+$/.test(String(id)) ? (await q(supabase.from('contrato_modelos').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] : null;
  if (!t || t.origem_id == null) return { status: 404, erro: 'Modelo não veio da biblioteca' };
  const m = (await q(supabase.from('contrato_modelos').select('*').is('tenant_id', null).eq('id', t.origem_id)))[0];
  if (!m) return { status: 404, erro: 'O modelo saiu da biblioteca' };
  const { data, error } = await supabase.from('contrato_modelos').update({ nome: m.nome, descricao: m.descricao, corpo: m.corpo, origem_versao: m.versao, atualizado_em: new Date().toISOString() }).eq('id', t.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return { modelo: data[0] };
}
async function salvarModelo(supabase, tenantId, id, body = {}) {
  const v = validarModelo(body, !!id); if (v.erro) return { status: 400, erro: v.erro };
  if (id) {
    if (body.ativo === false) v.dados.ativo = false;
    const { data, error } = await supabase.from('contrato_modelos').update({ ...v.dados, atualizado_em: new Date().toISOString() }).eq('id', id).eq('tenant_id', tenantId).select();
    if (error) throw new Error(error.message);
    return data?.length ? { modelo: data[0] } : { status: 404, erro: 'Modelo não encontrado' };
  }
  const { data, error } = await supabase.from('contrato_modelos').insert([{ ...v.dados, tenant_id: tenantId, versao: 1, ativo: true }]).select();
  if (error) throw new Error(error.message);
  return { modelo: data[0] };
}

// ─── montar o texto ─────────────────────────────────────────────────────────
async function dadosDoContrato(supabase, tenantId, contrato) {
  const [emp, cli, locs, equips] = await Promise.all([
    q(supabase.from('tenants').select('*').eq('id', tenantId)).then((r) => r[0] || {}),
    contrato.cliente_id ? q(supabase.from('clientes').select('*').eq('tenant_id', tenantId).eq('id', contrato.cliente_id)).then((r) => r[0] || null).catch(() => null) : null,
    q(supabase.from('equipamento_locacoes').select('*').eq('tenant_id', tenantId).eq('contrato_id', contrato.id)),
    q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId)),
  ]);
  const eq = new Map(equips.map((e) => [String(e.id), e]));
  const tabela = locs.filter((l) => l.status === 'ativa').map((l) => { const e = eq.get(String(l.equipamento_id)) || {}; return { locacao_id: l.id, tag: e.tag || '', nome: e.nome || '', inicio: l.inicio || null, fim_previsto: l.fim_previsto || contrato.fim_previsto || null, valor_mensal: l.valor_mensal != null ? Number(l.valor_mensal) : null }; })
    .sort((a, b) => String(a.tag).localeCompare(String(b.tag)));
  return { emp, cli, tabela };
}
/** → { texto (com [[TABELA_EQUIPAMENTOS]] onde vai a tabela), tabela, total, faltando: [campos sem valor] } */
function montar(corpo, { contrato, emp, cli, tabela }, hoje = hojeBR()) {
  const c = contrato.condicoes || {};
  const total = tabela.length && tabela.every((t) => t.valor_mensal != null) ? tabela.reduce((s, t) => s + t.valor_mensal, 0) : null;
  const end = cli ? [[cli.endereco, cli.numero].filter(Boolean).join(', '), cli.complemento, cli.bairro, [cli.cidade, cli.uf].filter(Boolean).join('/'), cli.cep && `CEP ${String(cli.cep).replace(/^(\d{5})(\d{3})$/, '$1-$2')}`].filter(Boolean).join(' — ') : null;
  const endEmp = [[emp.endereco, emp.numero].filter(Boolean).join(', '), emp.complemento, emp.bairro, [emp.cidade, emp.regiao].filter(Boolean).join('/'), emp.cep && `CEP ${String(emp.cep).replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2')}`].filter(Boolean).join(' — ') || null;
  const v = {
    'contrato.numero': contrato.numero, 'contrato.local': contrato.local, 'contrato.inicio': dBR(contrato.inicio), 'contrato.fim_previsto': dBR(contrato.fim_previsto),
    'contrato.prazo': contrato.fim_previsto ? `até ${dBR(contrato.fim_previsto)}` : 'indeterminado',
    'empresa.razao_social': emp.razao_social || emp.nome, 'empresa.nome': emp.nome_fantasia || emp.nome, 'empresa.cnpj': fmtDoc(emp.cnpj), 'empresa.endereco_completo': endEmp, 'empresa.telefone': emp.telefone, 'empresa.email': emp.email,
    'cliente.razao_social': cli?.razao_social || cli?.nome || contrato.cliente, 'cliente.nome': cli?.nome || contrato.cliente, 'cliente.documento': fmtDoc(cli?.documento || contrato.cliente_doc),
    'cliente.endereco_completo': end, 'cliente.cidade': cli?.cidade, 'cliente.uf': cli?.uf, 'contato.nome': contrato.contato_nome || cli?.contato_nome,
    'representante.nome': c.representante?.nome || contrato.contato_nome || cli?.contato_nome, 'representante.cpf': fmtDoc(c.representante?.cpf), 'representante.cargo': c.representante?.cargo,
    tabela_equipamentos: TABELA, valor_mensal_total: brl(total), qtd_equipamentos: String(tabela.length),
    'condicoes.caucao': brl(c.caucao), 'condicoes.franquia_horas': c.franquia_horas != null ? String(c.franquia_horas) : null, 'condicoes.hora_excedente': brl(c.hora_excedente),
    'condicoes.reajuste': c.reajuste, 'condicoes.multa_rescisoria': c.multa_rescisoria_pct != null ? `${String(c.multa_rescisoria_pct).replace('.', ',')}%` : null,
    'condicoes.vencimento_dia': c.vencimento_dia != null ? String(c.vencimento_dia) : null, 'condicoes.forma_pagamento': c.forma_pagamento, 'condicoes.foro': c.foro,
    'condicoes.observacoes': c.observacoes || 'Não há.', data_extenso: extenso(hoje), data: dBR(hoje),
  };
  const naMap = { caucao: 'condicoes.caucao', franquia_horas: 'condicoes.franquia_horas', hora_excedente: 'condicoes.hora_excedente', reajuste: 'condicoes.reajuste', multa_rescisoria_pct: 'condicoes.multa_rescisoria',
    vencimento_dia: 'condicoes.vencimento_dia', forma_pagamento: 'condicoes.forma_pagamento', foro: 'condicoes.foro' };
  for (const k of c.na || []) if (naMap[k]) v[naMap[k]] = NA_TXT; // 14d.2
  const faltando = new Set();
  // 14d.4: modelo antigo (importado antes da 047) usa "representada por {{contato.nome}}" — se há quem assina, troca pela pessoa certa
  let corpoUsado = String(corpo || '');
  const r = c.representante || {};
  if (r.nome) {
    const frase = ['neste ato representada por ' + r.nome, r.cargo, r.cpf && `inscrito(a) no CPF sob o nº ${fmtDoc(r.cpf)}`].filter(Boolean).join(', ');
    corpoUsado = corpoUsado.replace(/neste ato representada por \{\{\s*contato\.nome\s*\}\}/g, frase);
  }
  // 14d.4: modelo antigo sem a sede da LOCADORA — se a empresa tem endereço, acrescenta
  if (endEmp) corpoUsado = corpoUsado.replace(/(inscrita no CNPJ sob o nº \{\{\s*empresa\.cnpj\s*\}\})\./, `$1, com sede em ${endEmp}.`);
  const texto0 = corpoUsado.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => { const x = v[k]; if (x == null || x === '') { faltando.add(k); return VAZIO; } return x; });
  if (tabela.some((t) => t.valor_mensal == null)) faltando.add('valor mensal de equipamento');
  if (!tabela.length) faltando.add('equipamentos no contrato');
  return { texto: texto0, tabela: tabela.map(({ tag, nome, inicio, fim_previsto, valor_mensal }) => ({ tag, nome, inicio, fim_previsto, valor_mensal })), total, faltando: [...faltando] };
}

async function contratoDoTenant(supabase, tenantId, id) {
  return /^\d+$/.test(String(id)) ? (await q(supabase.from('locacao_contratos').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] || null : null;
}
/** Condições + modelo + valor mensal de cada equipamento. body: { modelo_id, condicoes, valores: { [locacao_id]: valor } } */
async function salvarCondicoes(supabase, tenantId, id, body = {}) {
  const k = await contratoDoTenant(supabase, tenantId, id); if (!k) return { status: 404, erro: 'Contrato não encontrado' };
  if (k.status !== 'ativo') return { status: 400, erro: 'Contrato encerrado' };
  const upd = {};
  if (body.modelo_id !== undefined) {
    if (body.modelo_id) { const m = (await q(supabase.from('contrato_modelos').select('*').eq('tenant_id', tenantId).eq('id', body.modelo_id)))[0]; if (!m || m.ativo === false) return { status: 400, erro: 'Modelo não encontrado' }; }
    upd.modelo_id = body.modelo_id || null;
  }
  if (body.condicoes !== undefined) { try { upd.condicoes = validarCondicoes(body.condicoes); } catch (e) { return { status: 400, erro: e.message }; } }
  if (Object.keys(upd).length) { const { error } = await supabase.from('locacao_contratos').update(upd).eq('id', k.id).eq('tenant_id', tenantId); if (error) throw new Error(error.message); }
  if (body.valores && typeof body.valores === 'object') {
    const locs = await q(supabase.from('equipamento_locacoes').select('*').eq('tenant_id', tenantId).eq('contrato_id', k.id));
    for (const [lid, val] of Object.entries(body.valores)) {
      const l = locs.find((x) => String(x.id) === String(lid)); if (!l) continue;
      const t = String(val ?? '').trim(); const n = t === '' ? null : Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
      if (n != null && (!Number.isFinite(n) || n < 0)) return { status: 400, erro: 'Valor mensal inválido' };
      const { error } = await supabase.from('equipamento_locacoes').update({ valor_mensal: n }).eq('id', l.id).eq('tenant_id', tenantId);
      if (error) throw new Error(error.message);
    }
  }
  return { ok: true };
}
/** 👁 Prévia (texto atual, com o que falta preencher) */
async function previa(supabase, tenantId, id, modeloId = null) {
  const k = await contratoDoTenant(supabase, tenantId, id); if (!k) return { status: 404, erro: 'Contrato não encontrado' };
  const mid = modeloId || k.modelo_id; if (!mid) return { status: 400, erro: 'Escolha o modelo de contrato' };
  const m = (await q(supabase.from('contrato_modelos').select('*').eq('tenant_id', tenantId).eq('id', mid)))[0];
  if (!m) return { status: 404, erro: 'Modelo não encontrado' };
  const d = await dadosDoContrato(supabase, tenantId, k);
  return { modelo: { id: m.id, nome: m.nome }, ...montar(m.corpo, { contrato: k, ...d }), numero: k.numero };
}
/** 📄 Emitir: congela texto + tabela, hash, nova versão (e zera o aceite anterior) */
async function emitir(supabase, tenantId, quem, id, { forcar = false } = {}) {
  const p = await previa(supabase, tenantId, id); if (p.erro) return p;
  if (p.faltando.length && !forcar) return { status: 400, erro: `Falta preencher: ${p.faltando.join(', ')}`, faltando: p.faltando };
  const k = await contratoDoTenant(supabase, tenantId, id);
  const agora = new Date().toISOString();
  const hash = crypto.createHash('sha256').update(JSON.stringify({ t: String(tenantId), n: k.numero, v: (k.emitido_versao || 0) + 1, x: p.texto, tab: p.tabela, em: agora })).digest('hex');
  const { data, error } = await supabase.from('locacao_contratos').update({ emitido_texto: p.texto, emitido_tabela: p.tabela, emitido_em: agora, emitido_por_nome: quem.usuarioNome || null, emitido_hash: hash,
    emitido_versao: (k.emitido_versao || 0) + 1, aceite_nome: null, aceite_usuario_id: null, aceite_em: null, aceite_png: null, aceite_hash: null }).eq('id', k.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return { ok: true, versao: data[0].emitido_versao, hash };
}
/** 14d.2: o cliente assinou no PAPEL (sem acesso ao sistema) — a empresa registra; vale como aceite da versão emitida */
async function aceitePapel(supabase, tenantId, quem, id, { data, obs } = {}) {
  const k = await contratoDoTenant(supabase, tenantId, id); if (!k) return { status: 404, erro: 'Contrato não encontrado' };
  if (!k.emitido_hash) return { status: 400, erro: 'Emita o contrato antes de registrar a assinatura' };
  if (k.aceite_em) return { status: 400, erro: 'Este contrato já tem aceite registrado' };
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(data || '')) ? data : hojeBR();
  if (d > hojeBR()) return { status: 400, erro: 'Data da assinatura no futuro' };
  const em = new Date(`${d}T12:00:00-03:00`).toISOString();
  const nome = `Assinado no papel${texto(obs, 160) ? ` — ${texto(obs, 160)}` : ''} (registrado por ${quem.usuarioNome || 'usuário'})`;
  const hash = crypto.createHash('sha256').update(`${k.emitido_hash}|papel|${nome}|${em}`).digest('hex');
  const { error } = await supabase.from('locacao_contratos').update({ aceite_nome: nome, aceite_usuario_id: quem.usuarioId ? String(quem.usuarioId) : null, aceite_em: em, aceite_png: null, aceite_hash: hash }).eq('id', k.id).eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  return { ok: true };
}
/** ✍ Aceite do locatário (o escopo — contrato dele — é checado em contratosLocacao) */
async function aceitar(supabase, tenantId, contrato, usuario, { assinatura_png, nome } = {}) {
  if (!contrato.emitido_hash) return { status: 400, erro: 'O contrato ainda não foi emitido pela locadora' };
  if (contrato.aceite_em) return { status: 400, erro: 'Este contrato já foi aceito' };
  if (typeof assinatura_png !== 'string' || !assinatura_png.startsWith('data:image/png;base64,') || assinatura_png.length < 200 || assinatura_png.length > 400 * 1024) return { status: 400, erro: 'Assine na tela para aceitar' };
  const quem = texto(nome, 120) || usuario.nome; if (!quem) return { status: 400, erro: 'Informe seu nome' };
  const em = new Date().toISOString();
  const hash = crypto.createHash('sha256').update(`${contrato.emitido_hash}|${usuario.id}|${quem}|${em}|${assinatura_png}`).digest('hex');
  const { error } = await supabase.from('locacao_contratos').update({ aceite_nome: quem, aceite_usuario_id: String(usuario.id), aceite_em: em, aceite_png: assinatura_png, aceite_hash: hash }).eq('id', contrato.id).eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  return { ok: true, aceite_em: em, aceite_hash: hash };
}

/** 14d.2: fase do contrato, calculada — elaboracao → aguardando_aceite → andamento → encerrado */
function fase(c) { return c.status === 'encerrado' ? 'encerrado' : c.aceite_em ? 'andamento' : c.emitido_hash ? 'aguardando_aceite' : 'elaboracao'; }

module.exports = { CAMPOS, TABELA, validarModelo, validarCondicoes, bibliotecaConsole, criarBib, editarBib, modelosTenant, bibliotecaParaTenant, importar, atualizarDaBiblioteca, salvarModelo,
  montar, dadosDoContrato, salvarCondicoes, previa, emitir, aceitar, aceitePapel, fase };
