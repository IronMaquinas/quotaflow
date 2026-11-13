// backend/services/patio.js — etapa 18z: 📦 propriedade do cliente (pátio)
//
// Equipamento DO CLIENTE guardado no pátio da empresa (chega do porto e espera o dono programar a entrega) — quase sempre
// sem cobrança. Não é estoque da empresa: uma linha por equipamento (PAT-AAAA-NNNN), controlado pelo nº de série da plaqueta.
// Entrada (cliente, equipamento, série, NF de entrada, local, quem recebeu, fotos com tarja) → no pátio → Saída (quem liberou,
// quem retirou, NF de saída, AT se a empresa levou, fotos). Mesmo nº de série não entra duas vezes enquanto estiver no pátio.
// 18z.1: PRÉ-ENTRADA — o suporte lê o XML da NF (um registro por unidade, série sugerida a partir de infAdProd/veicProd) e a equipe
// do pátio confirma a chegada (confere série na plaqueta, local, fotos). Status: pre_entrada → no_patio → saiu.
// Histórico por nº de série (o mesmo equipamento pode voltar). Fotos no bucket "documentos", link assinado de 1 h.
const crypto = require('crypto');
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const sem081 = (e) => /patio_bens|does not exist|schema cache/i.test(String(e?.message || e));
const txt = (v, n = 160) => String(v ?? '').trim().slice(0, n);
const serieNorm = (v) => txt(v, 80).toUpperCase().replace(/\s+/g, ' ');
const data10 = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null);
const hojeBR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const BUCKET = 'documentos'; const MAX_FOTOS = 12; const LIMITE = 8 * 1024 * 1024;
const dias = (a, b) => Math.max(0, Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5));

async function proximoNumero(supabase, tenantId) {
  const ano = hojeBR().slice(0, 4); const pre = `PAT-${ano}-`;
  const ns = (await q(supabase.from('patio_bens').select('*').eq('tenant_id', tenantId))).map((b) => b.numero).filter((n) => String(n).startsWith(pre)).map((n) => Number(String(n).slice(pre.length)) || 0);
  return `${pre}${String((ns.length ? Math.max(...ns) : 0) + 1).padStart(4, '0')}`;
}
async function assinar(supabase, fotos) {
  const out = [];
  for (const f of Array.isArray(fotos) ? fotos : []) { let url = null; try { const { data } = await supabase.storage.from(BUCKET).createSignedUrl(f.path, 3600); url = data?.signedUrl || null; } catch { /* sem link */ } out.push({ ...f, url }); }
  return out;
}
const publico = (b, hoje = hojeBR()) => ({ ...b, dias_no_patio: b.entrada_em ? dias(b.entrada_em, b.status === 'saiu' && b.saida_em ? b.saida_em : hoje) : 0 });
const area = (v) => { if (v === undefined) return undefined; if (v === null || String(v).trim() === '') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : NaN; };
const ORD = { pre_entrada: 0, no_patio: 1, saiu: 2 };
const ativo = (b) => b.status === 'no_patio' || b.status === 'pre_entrada';
const NOME = { pre_entrada: 'tem pré-entrada aguardando chegada', no_patio: 'já está no pátio' };

async function listar(supabase, tenantId, { status = 'no_patio', busca = '', cliente = '' } = {}) {
  let bs; try { bs = await q(supabase.from('patio_bens').select('*').eq('tenant_id', tenantId)); } catch (e) { if (sem081(e)) return { sem_migration: true, bens: [], clientes: [] }; throw e; }
  const hoje = hojeBR(); const b0 = String(busca || '').toLowerCase().trim();
  const noPatio = bs.filter((b) => b.status === 'no_patio'); const pre = bs.filter((b) => b.status === 'pre_entrada');
  const porCliente = new Map(); for (const b of noPatio) { const c = porCliente.get(b.cliente_nome) || { cliente: b.cliente_nome, qtd: 0, mais_antigo: b.entrada_em }; c.qtd++; if (b.entrada_em < c.mais_antigo) c.mais_antigo = b.entrada_em; porCliente.set(b.cliente_nome, c); }
  const lista = bs.filter((b) => (status === 'todos' || b.status === status) && (!cliente || b.cliente_nome === cliente)
    && (!b0 || [b.numero, b.numero_serie, b.identificacao, b.descricao, b.modelo, b.fabricante, b.cliente_nome, b.nf_entrada_numero, b.nf_entrada_chave, b.nf_emitente_nome, b.local_patio].some((x) => String(x || '').toLowerCase().includes(b0))))
    .sort((a, b) => (a.status === b.status ? String(b.entrada_em || b.previsto_em || '').localeCompare(String(a.entrada_em || a.previsto_em || '')) || String(b.numero).localeCompare(String(a.numero)) : ORD[a.status] - ORD[b.status]))
    .map((b) => publico(b, hoje));
  return { bens: lista, total_no_patio: noPatio.length, total_pre_entrada: pre.length, pre_atrasadas: pre.filter((b) => b.previsto_em && b.previsto_em < hoje).length, clientes: [...porCliente.values()].map((c) => ({ ...c, dias_mais_antigo: dias(c.mais_antigo, hoje) })).sort((a, b) => b.qtd - a.qtd),
    saidas_30d: bs.filter((b) => b.status === 'saiu' && b.saida_em && dias(b.saida_em, hoje) <= 30).length };
}

async function detalhe(supabase, tenantId, id) {
  const b = /^\d+$/.test(String(id)) ? (await q(supabase.from('patio_bens').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] : null;
  if (!b) return { status: 404, erro: 'Equipamento não encontrado' };
  const mesmos = (b.numero_serie ? await q(supabase.from('patio_bens').select('*').eq('tenant_id', tenantId)) : []).filter((x) => x.id !== b.id && serieNorm(x.numero_serie) === serieNorm(b.numero_serie))
    .sort((x, y) => String(y.entrada_em).localeCompare(String(x.entrada_em))).map((x) => ({ id: x.id, numero: x.numero, cliente_nome: x.cliente_nome, entrada_em: x.entrada_em, saida_em: x.saida_em, status: x.status }));
  let at = null; if (b.saida_at_id) { try { at = (await q(supabase.from('execucoes').select('*').eq('tenant_id', tenantId).eq('id', b.saida_at_id)))[0] || null; } catch { /* ok */ } }
  return { bem: { ...publico(b), fotos_entrada: await assinar(supabase, b.fotos_entrada), fotos_saida: await assinar(supabase, b.fotos_saida), at: at ? { id: at.id, numero: at.numero, status: at.status } : null }, historico_serie: mesmos };
}

async function entrada(supabase, tenantId, quem = {}, body = {}) {
  const descricao = txt(body.descricao); const serie = serieNorm(body.numero_serie);
  if (!descricao) return { status: 400, erro: 'Descreva o equipamento' };
  if (!serie) return { status: 400, erro: 'Informe o nº de série da plaqueta' };
  let cliente = null;
  if (body.cliente_id) { cliente = (await q(supabase.from('clientes').select('*').eq('tenant_id', tenantId).eq('id', body.cliente_id)))[0] || null; if (!cliente) return { status: 400, erro: 'Cliente não encontrado' }; }
  const clienteNome = cliente ? (cliente.nome || cliente.razao_social) : txt(body.cliente_nome);
  if (!clienteNome) return { status: 400, erro: 'Escolha o cliente dono do equipamento' };
  try {
    const dup = (await q(supabase.from('patio_bens').select('*').eq('tenant_id', tenantId))).find((b) => ativo(b) && serieNorm(b.numero_serie) === serie);
    if (dup) return { status: 409, erro: dup.status === 'pre_entrada' ? `O nº de série ${serie} tem pré-entrada (${dup.numero} · ${dup.cliente_nome}) — abra ela e confirme a chegada em vez de lançar de novo.` : `O nº de série ${serie} já está no pátio (${dup.numero} · ${dup.cliente_nome}). Dê a saída dele antes de uma nova entrada.`, existente_id: dup.id };
    const chave = String(body.nf_entrada_chave || '').replace(/\D/g, '');
    if (chave && chave.length !== 44) return { status: 400, erro: 'A chave da NF tem 44 dígitos' };
    const linha = { tenant_id: tenantId, numero: await proximoNumero(supabase, tenantId), cliente_id: cliente?.id ?? null, cliente_nome: clienteNome, descricao, fabricante: txt(body.fabricante, 80) || null, modelo: txt(body.modelo, 80) || null,
      ano: txt(body.ano, 10) || null, numero_serie: serie, identificacao: txt(body.identificacao, 80) || null, nf_entrada_numero: txt(body.nf_entrada_numero, 30) || null, nf_entrada_chave: chave || null,
      nf_entrada_data: data10(body.nf_entrada_data), entrada_em: data10(body.entrada_em) || hojeBR(), recebido_por: txt(body.recebido_por, 80) || quem.nome || null, local_patio: txt(body.local_patio, 80) || null,
      obs: txt(body.obs, 1000) || null, status: 'no_patio', fotos_entrada: [], fotos_saida: [], area_m2: area(body.area_m2) ?? null, nf_emitente_nome: txt(body.nf_emitente_nome, 120) || null, nf_emitente_cnpj: String(body.nf_emitente_cnpj || '').replace(/\D/g, '') || null };
    if (Number.isNaN(linha.area_m2)) return { status: 400, erro: 'Área em m² inválida' };
    if (linha.entrada_em > hojeBR()) return { status: 400, erro: 'A data de entrada não pode ser no futuro' };
    const r = await supabase.from('patio_bens').insert([linha]).select(); if (r.error) { if (/duplicate|unique/i.test(r.error.message)) return { status: 409, erro: `O nº de série ${serie} já está no pátio` }; throw new Error(r.error.message); }
    return { bem: publico(r.data[0]) };
  } catch (e) { if (sem081(e)) return { status: 409, erro: 'Falta rodar a migration 081 no Supabase.' }; throw e; }
}

async function editar(supabase, tenantId, id, body = {}) {
  const b = (await q(supabase.from('patio_bens').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!b) return { status: 404, erro: 'Equipamento não encontrado' };
  if (b.status === 'pre_entrada') { if (body.descricao !== undefined && !txt(body.descricao)) return { status: 400, erro: 'Descreva o equipamento' }; if (body.numero_serie !== undefined) { const sr = serieNorm(body.numero_serie); if (sr) { const dup = (await q(supabase.from('patio_bens').select('*').eq('tenant_id', tenantId))).find((x) => x.id !== b.id && ativo(x) && serieNorm(x.numero_serie) === sr); if (dup) return { status: 409, erro: `O nº de série ${sr} ${NOME[dup.status]} (${dup.numero})` }; } } }
  const upd = {}; if (b.status === 'pre_entrada') { if (body.descricao !== undefined) upd.descricao = txt(body.descricao); if (body.numero_serie !== undefined) upd.numero_serie = serieNorm(body.numero_serie) || null; if (body.previsto_em !== undefined) upd.previsto_em = data10(body.previsto_em); }
  for (const k of ['local_patio', 'obs', 'identificacao', 'nf_entrada_numero', 'fabricante', 'modelo', 'ano']) if (body[k] !== undefined) upd[k] = txt(body[k], k === 'obs' ? 1000 : 80) || null;
  if (body.area_m2 !== undefined) { const a = area(body.area_m2); if (Number.isNaN(a)) return { status: 400, erro: 'Área em m² inválida' }; upd.area_m2 = a; }
  if (!Object.keys(upd).length) return detalhe(supabase, tenantId, id);
  upd.atualizado_em = new Date().toISOString();
  const r = await supabase.from('patio_bens').update(upd).eq('id', b.id).eq('tenant_id', tenantId); if (r.error) throw new Error(r.error.message);
  return detalhe(supabase, tenantId, id);
}

async function foto(supabase, tenantId, id, body = {}) {
  const b = (await q(supabase.from('patio_bens').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!b) return { status: 404, erro: 'Equipamento não encontrado' };
  const fase = body.fase === 'saida' ? 'saida' : 'entrada'; const campo = `fotos_${fase}`;
  if (fase === 'entrada' && !ativo(b)) return { status: 409, erro: 'O equipamento já saiu — foto de entrada não muda mais' };
  const lista = Array.isArray(b[campo]) ? b[campo] : []; if (lista.length >= MAX_FOTOS) return { status: 409, erro: `Limite de ${MAX_FOTOS} fotos na ${fase}` };
  if (!/^image\/(jpeg|png)$/.test(body.mime || '')) return { status: 400, erro: 'Foto JPG ou PNG' };
  const buf = Buffer.from(String(body.base64 || ''), 'base64'); if (!buf.length) return { status: 400, erro: 'Foto vazia' }; if (buf.length > LIMITE) return { status: 400, erro: 'Foto maior que 8 MB' };
  const path = `tenant-${tenantId}/patio/${b.id}/${fase}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${body.mime === 'image/png' ? 'png' : 'jpg'}`;
  const up = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: body.mime, upsert: false }); if (up.error) throw new Error(`Falha ao subir a foto: ${up.error.message}`);
  const r = await supabase.from('patio_bens').update({ [campo]: [...lista, { path, em: new Date().toISOString(), legenda: txt(body.legenda, 120) || null }], atualizado_em: new Date().toISOString() }).eq('id', b.id).eq('tenant_id', tenantId);
  if (r.error) throw new Error(r.error.message);
  return detalhe(supabase, tenantId, id);
}

async function saida(supabase, tenantId, quem = {}, id, body = {}) {
  const b = (await q(supabase.from('patio_bens').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!b) return { status: 404, erro: 'Equipamento não encontrado' };
  if (b.status === 'pre_entrada') return { status: 409, erro: 'Este equipamento ainda não chegou — confirme a chegada antes da saída' };
  if (b.status !== 'no_patio') return { status: 409, erro: 'Este equipamento já saiu do pátio' };
  const retirado = txt(body.retirado_por, 120); if (!retirado) return { status: 400, erro: 'Informe quem retirou (motorista/transportadora ou "transporte próprio")' };
  const quando = data10(body.saida_em) || hojeBR();
  if (quando < b.entrada_em) return { status: 400, erro: 'A saída não pode ser antes da entrada' };
  if (quando > hojeBR()) return { status: 400, erro: 'A data de saída não pode ser no futuro' };
  let atId = null; if (body.saida_at_id) { const at = (await q(supabase.from('execucoes').select('*').eq('tenant_id', tenantId).eq('id', body.saida_at_id)).catch(() => []))[0]; if (!at) return { status: 400, erro: 'AT não encontrada' }; atId = at.id; }
  const upd = { status: 'saiu', saida_em: quando, liberado_por: txt(body.liberado_por, 80) || quem.nome || null, retirado_por: retirado, retirado_documento: txt(body.retirado_documento, 40) || null,
    retirado_placa: txt(body.retirado_placa, 20).toUpperCase() || null, nf_saida_numero: txt(body.nf_saida_numero, 30) || null, saida_at_id: atId, saida_obs: txt(body.saida_obs, 1000) || null, atualizado_em: new Date().toISOString() };
  const r = await supabase.from('patio_bens').update(upd).eq('id', b.id).eq('tenant_id', tenantId); if (r.error) throw new Error(r.error.message);
  return detalhe(supabase, tenantId, id);
}

// ── 18z.1: XML da NF → itens sugeridos (um por unidade) ─────────────────────────────────────────────────────────────────────
const SERIE_ROT = /(?:N[º°o]?\.?\s*(?:DE\s+)?S[ÉE]RIES?|S\/N|SERIAL(?:\s+N(?:UMBER|O\.?))?|N\.?\s*S\.?|PIN|CHASSIS?)\s*[:\-–.]?\s*/i;
function seriesDoTexto(texto) {
  const out = []; let s = String(texto || '');
  for (let guarda = 0; guarda < 20; guarda++) {
    const m = SERIE_ROT.exec(s); if (!m) break;
    const resto = s.slice(m.index + m[0].length); const trecho = resto.split(/\b(?:ANO|MODELO|MOD\.?|MARCA|FAB\w*|COR|MOTOR|NCM|PESO|LOTE)\b/i)[0].slice(0, 400);
    for (const tok of trecho.split(/[\s,;|]+|\s+[eE]\s+/)) { const v = tok.replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/gi, '').toUpperCase(); if (v.length >= 4 && /\d/.test(v) && /^[A-Z0-9\-\/.]+$/.test(v) && !out.includes(v)) out.push(v); }
    s = resto;
  }
  return out;
}
const UNID = /^(UN|UND|UNID|UNIDADE|PC|PCA|PÇ|PEÇA|PECA|EQ|EQUIP|CJ|CONJ|MAQ|VEIC|VEICULO)$/i;
function lerXml(xml) {
  const { parseNfeXml } = require('./NfeXmlParser');
  let base; try { base = parseNfeXml(xml); } catch (e) { return { status: 400, erro: `Não é um XML de NF-e válido (${e.message})` }; }
  const { XMLParser } = require('fast-xml-parser');
  let det = []; try { const raw = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, isArray: (n) => n === 'det' }).parse(String(xml));
    const ach = (o) => { if (!o || typeof o !== 'object') return null; if (o.infNFe) return o.infNFe; for (const v of Object.values(o)) { const r = ach(v); if (r) return r; } return null; };
    det = ach(raw)?.det || []; } catch { det = []; }
  const ano4 = (t) => (String(t || '').match(/\bANO(?:\s*(?:DE\s*)?FAB\w*)?\s*[:\-.]?\s*((?:19|20)\d{2})\b/i) || [])[1] || null;
  const itens = []; const avisos = [...(base.warnings || [])];
  base.itens.forEach((it, i) => {
    const d = det[i] || {}; const v = d.prod?.veicProd || {}; const inf = String(d.infAdProd || '');
    const serieVeic = [v.chassi, v.nSerie].map((x) => String(x || '').trim().toUpperCase()).filter(Boolean);
    const series = [...new Set([...serieVeic, ...seriesDoTexto(inf), ...seriesDoTexto(it.descricao)])];
    const qtdInt = Number.isInteger(it.quantidade) && it.quantidade >= 1;
    let n = qtdInt && UNID.test(it.unidade || 'UN') ? it.quantidade : 1;
    if (n > 50) { avisos.push(`Item ${it.numero}: ${it.quantidade} unidades — lancei 50; o resto lance depois`); n = 50; }
    if (!qtdInt || !UNID.test(it.unidade || 'UN')) if (it.quantidade !== 1) avisos.push(`Item ${it.numero}: quantidade ${it.quantidade} ${it.unidade || ''} — virou 1 linha; ajuste se for mais de um equipamento`);
    if (n > 1 && series.length && series.length !== n) avisos.push(`Item ${it.numero}: ${n} unidades e ${series.length} nº de série na NF — confira`);
    for (let k = 0; k < n; k++) itens.push({ nf_item: `${it.numero}${n > 1 ? `/${k + 1}` : ''}`, codigo: it.codigo || null, descricao: it.descricao, numero_serie: series[n > 1 ? k : 0] || '', series_achadas: n === 1 && series.length > 1 ? series : undefined,
      ano: String(v.anoFab || '').trim() || ano4(inf) || ano4(it.descricao) || '', identificacao: String(v.nMotor || '').trim() ? `Motor ${String(v.nMotor).trim()}` : '', obs: inf.slice(0, 500) });
  });
  return { nf: { numero: base.numero_nf, chave: base.chave_acesso, data: String(base.data_emissao || '').slice(0, 10) || null, emitente_nome: base.nome_emitente, emitente_cnpj: cnpj14(base.cnpj_emitente), destinatario_nome: base.nome_destinatario, destinatario_cnpj: cnpj14(base.cnpj_destinatario) }, itens, avisos };
}
const so = (v) => String(v || '').replace(/\D/g, '');
// o parser de NF-e lê o CNPJ como número e perde o zero à esquerda (04884… → 4884…): volta para 14 dígitos
const cnpj14 = (v) => { const d = so(v); return d.length > 11 && d.length < 14 ? d.padStart(14, '0') : d; };
async function lerXmlDoTenant(supabase, tenantId, xml) {
  const r = lerXml(xml); if (r.status) return r;
  let clientes = []; try { clientes = await require('./clientes').listar(supabase, tenantId); } catch { /* sem cadastro */ }
  const achar = (cnpj) => (cnpj ? clientes.find((c) => so(c.documento) && cnpj14(c.documento) === cnpj14(cnpj)) : null);
  const c = achar(r.nf.destinatario_cnpj) || achar(r.nf.emitente_cnpj);
  const ja = (await q(supabase.from('patio_bens').select('*').eq('tenant_id', tenantId))).filter((b) => r.nf.chave && b.nf_entrada_chave === r.nf.chave);
  return { ...r, cliente_sugerido: c ? { id: c.id, nome: c.nome, pelo: cnpj14(c.documento) === cnpj14(r.nf.destinatario_cnpj) ? 'destinatário' : 'emitente' } : null, ja_lancados: ja.map((b) => ({ id: b.id, numero: b.numero, status: b.status })) };
}

async function preEntradas(supabase, tenantId, quem = {}, body = {}) {
  const itens = (Array.isArray(body.itens) ? body.itens : []).slice(0, 100);
  if (!itens.length) return { status: 400, erro: 'Nenhum equipamento para lançar' };
  let cliente = null;
  if (body.cliente_id) { cliente = (await q(supabase.from('clientes').select('*').eq('tenant_id', tenantId).eq('id', body.cliente_id)))[0] || null; if (!cliente) return { status: 400, erro: 'Cliente não encontrado' }; }
  const clienteNome = cliente ? (cliente.nome || cliente.razao_social) : txt(body.cliente_nome);
  if (!clienteNome) return { status: 400, erro: 'Escolha o cliente dono dos equipamentos' };
  const nf = body.nf || {}; const chave = so(nf.chave); if (chave && chave.length !== 44) return { status: 400, erro: 'A chave da NF tem 44 dígitos' };
  try {
    const todos = await q(supabase.from('patio_bens').select('*').eq('tenant_id', tenantId));
    if (chave && !body.mesmo_assim) { const ja = todos.filter((b) => b.nf_entrada_chave === chave); if (ja.length) return { status: 409, erro: `Esta NF já foi lançada (${ja.map((b) => b.numero).join(', ')}).`, ja_lancados: ja.map((b) => b.id) }; }
    const vistos = new Set();
    for (const [i, it] of itens.entries()) {
      if (!txt(it.descricao)) return { status: 400, erro: `Linha ${i + 1}: descreva o equipamento` };
      const sr = serieNorm(it.numero_serie); if (!sr) continue;
      if (vistos.has(sr)) return { status: 409, erro: `O nº de série ${sr} aparece duas vezes na lista` }; vistos.add(sr);
      const dup = todos.find((b) => ativo(b) && serieNorm(b.numero_serie) === sr); if (dup) return { status: 409, erro: `O nº de série ${sr} ${NOME[dup.status]} (${dup.numero} · ${dup.cliente_nome})` };
    }
    const criados = [];
    for (const it of itens) {
      const linha = { tenant_id: tenantId, numero: await proximoNumero(supabase, tenantId), cliente_id: cliente?.id ?? null, cliente_nome: clienteNome, descricao: txt(it.descricao), fabricante: txt(it.fabricante, 80) || null, modelo: txt(it.modelo, 80) || null,
        ano: txt(it.ano, 10) || null, numero_serie: serieNorm(it.numero_serie) || null, identificacao: txt(it.identificacao, 80) || null, nf_entrada_numero: txt(nf.numero, 30) || null, nf_entrada_chave: chave || null, nf_entrada_data: data10(nf.data),
        nf_emitente_nome: txt(nf.emitente_nome, 120) || null, nf_emitente_cnpj: cnpj14(nf.emitente_cnpj) || null, nf_item: txt(it.nf_item, 20) || null, entrada_em: null, previsto_em: data10(body.previsto_em), local_patio: txt(body.local_patio, 80) || null,
        obs: txt(it.obs, 1000) || null, status: 'pre_entrada', pre_por: quem.nome || null, pre_em: new Date().toISOString(), fotos_entrada: [], fotos_saida: [] };
      const r = await supabase.from('patio_bens').insert([linha]).select(); if (r.error) { if (/duplicate|unique/i.test(r.error.message)) return { status: 409, erro: 'Nº de série repetido — recarregue e confira', criados: criados.map((b) => b.numero) }; throw new Error(r.error.message); }
      criados.push(publico(r.data[0]));
    }
    return { criados };
  } catch (e) { if (sem081(e)) return { status: 409, erro: 'Falta rodar as migrations 081 e 082 no Supabase.' }; throw e; }
}

async function confirmarChegada(supabase, tenantId, quem = {}, id, body = {}) {
  const b = (await q(supabase.from('patio_bens').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!b) return { status: 404, erro: 'Equipamento não encontrado' };
  if (b.status !== 'pre_entrada') return { status: 409, erro: 'Este equipamento já teve a chegada confirmada' };
  const serie = serieNorm(body.numero_serie ?? b.numero_serie); if (!serie) return { status: 400, erro: 'Confira e informe o nº de série da plaqueta' };
  const dup = (await q(supabase.from('patio_bens').select('*').eq('tenant_id', tenantId))).find((x) => x.id !== b.id && ativo(x) && serieNorm(x.numero_serie) === serie);
  if (dup) return { status: 409, erro: `O nº de série ${serie} ${NOME[dup.status]} (${dup.numero} · ${dup.cliente_nome})` };
  const quando = data10(body.entrada_em) || hojeBR(); if (quando > hojeBR()) return { status: 400, erro: 'A data de entrada não pode ser no futuro' };
  const upd = { status: 'no_patio', numero_serie: serie, entrada_em: quando, recebido_por: txt(body.recebido_por, 80) || quem.nome || null, atualizado_em: new Date().toISOString() };
  for (const k of ['local_patio', 'identificacao', 'fabricante', 'modelo', 'ano']) if (body[k] !== undefined) upd[k] = txt(body[k], 80) || null;
  if (body.area_m2 !== undefined) { const a = area(body.area_m2); if (Number.isNaN(a)) return { status: 400, erro: 'Área em m² inválida' }; upd.area_m2 = a; }
  if (txt(body.obs_chegada, 1000)) upd.obs = [b.obs, `Na chegada: ${txt(body.obs_chegada, 1000)}`].filter(Boolean).join('\n');
  const r = await supabase.from('patio_bens').update(upd).eq('id', b.id).eq('tenant_id', tenantId); if (r.error) { if (/duplicate|unique/i.test(r.error.message)) return { status: 409, erro: `O nº de série ${serie} já está ativo no pátio` }; throw new Error(r.error.message); }
  return detalhe(supabase, tenantId, id);
}

async function cancelarPre(supabase, tenantId, id) {
  const b = (await q(supabase.from('patio_bens').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!b) return { status: 404, erro: 'Equipamento não encontrado' };
  if (b.status !== 'pre_entrada') return { status: 409, erro: 'Só dá para excluir uma pré-entrada (o equipamento ainda não chegou)' };
  const r = await supabase.from('patio_bens').delete().eq('id', b.id).eq('tenant_id', tenantId); if (r.error) throw new Error(r.error.message);
  return { ok: true, numero: b.numero };
}

// ── 18z.5: ficha de movimentação — movimentos, saldos e diárias (equipamento·dia e m²·dia) no período ─────────────────────────
// Diária: conta o dia da entrada e não conta o dia da saída (como hotel); quem entra e sai no mesmo dia conta 1.
function diasNoPeriodo(b, de, ate) {
  if (!b.entrada_em) return 0; const ini = b.entrada_em > de ? b.entrada_em : de;
  let fimExcl; if (b.status === 'saiu' && b.saida_em) fimExcl = b.saida_em === b.entrada_em ? addDia(b.saida_em) : b.saida_em; else fimExcl = addDia(ate);
  if (fimExcl > addDia(ate)) fimExcl = addDia(ate);
  return fimExcl > ini ? dias(ini, fimExcl) : 0;
}
const addDia = (d) => new Date(Date.parse(`${d}T12:00:00Z`) + 864e5).toISOString().slice(0, 10);
const noPatioEm = (b, dia) => b.entrada_em && b.entrada_em <= dia && !(b.status === 'saiu' && b.saida_em && b.saida_em <= dia);
async function movimentacao(supabase, tenantId, { cliente = '', de, ate } = {}) {
  const h = hojeBR(); ate = data10(ate) || h; de = data10(de) || `${ate.slice(0, 7)}-01`;
  if (de > ate) return { status: 400, erro: 'A data inicial é depois da final' };
  let bs; try { bs = await q(supabase.from('patio_bens').select('*').eq('tenant_id', tenantId)); } catch (e) { if (sem081(e)) return { sem_migration: true }; throw e; }
  const clientes = [...new Set(bs.filter((b) => b.status !== 'pre_entrada').map((b) => b.cliente_nome))].sort();
  bs = bs.filter((b) => b.status !== 'pre_entrada' && (!cliente || b.cliente_nome === cliente));
  const movs = [];
  for (const b of bs) {
    const base = { bem_id: b.id, numero: b.numero, cliente: b.cliente_nome, descricao: [b.descricao, b.modelo].filter(Boolean).join(' · '), serie: b.numero_serie };
    if (b.entrada_em >= de && b.entrada_em <= ate) movs.push({ ...base, data: b.entrada_em, tipo: 'entrada', nf: b.nf_entrada_numero || null, quem: b.recebido_por || null });
    if (b.status === 'saiu' && b.saida_em >= de && b.saida_em <= ate) movs.push({ ...base, data: b.saida_em, tipo: 'saida', nf: b.nf_saida_numero || null, quem: b.retirado_por || null });
  }
  movs.sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === b.tipo ? a.numero.localeCompare(b.numero) : a.tipo === 'entrada' ? -1 : 1));
  const antesDe = (d) => new Date(Date.parse(`${d}T12:00:00Z`) - 864e5).toISOString().slice(0, 10);
  const saldoIni = bs.filter((b) => noPatioEm(b, antesDe(de)) && !(b.status === 'saiu' && b.saida_em && b.saida_em < de)).length;
  const itens = bs.map((b) => { const d = diasNoPeriodo(b, de, ate); return d ? { bem_id: b.id, numero: b.numero, cliente: b.cliente_nome, descricao: [b.descricao, b.modelo].filter(Boolean).join(' · '), serie: b.numero_serie,
    entrada_em: b.entrada_em, saida_em: b.status === 'saiu' ? b.saida_em : null, dias: d, area_m2: b.area_m2 != null ? Number(b.area_m2) : null, m2_dia: b.area_m2 != null ? Math.round(Number(b.area_m2) * d * 100) / 100 : null } : null; })
    .filter(Boolean).sort((a, b) => a.cliente.localeCompare(b.cliente) || a.entrada_em.localeCompare(b.entrada_em));
  const porCliente = new Map(); for (const i of itens) { const c = porCliente.get(i.cliente) || { cliente: i.cliente, equipamentos: 0, dias: 0, m2_dia: 0, sem_area: 0 }; c.equipamentos++; c.dias += i.dias; if (i.m2_dia != null) c.m2_dia += i.m2_dia; else c.sem_area++; porCliente.set(i.cliente, c); }
  const fim = bs.filter((b) => noPatioEm(b, ate)).length;
  return { de, ate, cliente: cliente || null, clientes, saldo_inicial: saldoIni, entradas: movs.filter((m) => m.tipo === 'entrada').length, saidas: movs.filter((m) => m.tipo === 'saida').length, saldo_final: fim,
    equip_dias: itens.reduce((s, i) => s + i.dias, 0), m2_dia: Math.round(itens.reduce((s, i) => s + (i.m2_dia || 0), 0) * 100) / 100, sem_area: itens.filter((i) => i.area_m2 == null).length,
    movimentos: movs, itens, por_cliente: [...porCliente.values()].map((c) => ({ ...c, m2_dia: Math.round(c.m2_dia * 100) / 100 })) };
}

module.exports = { movimentacao, diasNoPeriodo, listar, detalhe, entrada, editar, foto, saida, serieNorm, lerXml, lerXmlDoTenant, seriesDoTexto, preEntradas, confirmarChegada, cancelarPre };
