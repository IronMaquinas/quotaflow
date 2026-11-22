// services/fotoCartao.js — etapa E1: 📸 FOTO COM CARTÃO
//   Modelos de cartão por empresa (título, código/revisão, campos em grade de 2 colunas, observações) — com exemplos prontos para copiar
//   (etiqueta de ultrassom e registro de reparo de pá eólica). A foto chega do aparelho JÁ COMPOSTA (cartão desenhado nos pixels, com o
//   rodapé técnico · data/hora · GPS); o servidor guarda o arquivo, os valores (para busca e relatório), o hash SHA-256 e não duplica
//   (cliente_uid gerado no aparelho — a fila offline pode reenviar à vontade).
const crypto = require('crypto');
const D = require('./documentos');

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const txt = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);
const TIPOS = { texto: 'Texto', numero: 'Número', opcoes: 'Lista de opções' };

const EXEMPLOS = [
  { chave: 'ultrassom', nome: 'Etiqueta de ultrassom (pá eólica)', titulo: 'ETIQUETA DE ULTRASSOM', codigo: '', revisao: '', obs: true, campos: [
    { rotulo: 'Pá', destaque: true }, { rotulo: 'Defeito nº', destaque: true },
    { rotulo: 'Posição (tip / root)', largura: 2 },
    { rotulo: 'Casca pressão' }, { rotulo: 'Casca sucção' }, { rotulo: 'Alma LPR' }, { rotulo: 'Alma LSR' }, { rotulo: 'PRA' }, { rotulo: 'RFD' },
    { rotulo: 'Z inicial', tipo: 'numero', unidade: 'mm' }, { rotulo: 'Z final', tipo: 'numero', unidade: 'mm' }, { rotulo: 'A' }, { rotulo: 'AM' }, { rotulo: 'DEF.' }, { rotulo: 'P' },
    { rotulo: 'G1 / G2', largura: 2 }] },
  { chave: 'reparo', nome: 'Registro de reparo (pá eólica)', titulo: 'REGISTRO DE REPARO', codigo: '', revisao: '', obs: true, campos: [
    { rotulo: 'Aerogerador (WTG)', destaque: true }, { rotulo: 'Pá', tipo: 'opcoes', opcoes: ['A', 'B', 'C'], destaque: true },
    { rotulo: 'Defeito nº' }, { rotulo: 'Etapa', tipo: 'opcoes', opcoes: ['Antes', 'Durante', 'Depois'] },
    { rotulo: 'Bordo / face', tipo: 'opcoes', opcoes: ['Bordo de ataque', 'Bordo de fuga', 'Pressão', 'Sucção'] }, { rotulo: 'Distância da raiz', tipo: 'numero', unidade: 'm' },
    { rotulo: 'Tipo de defeito', tipo: 'opcoes', opcoes: ['Erosão', 'Trinca', 'Delaminação', 'Impacto de raio', 'Lascamento', 'Outro'], largura: 2 },
    { rotulo: 'Comprimento', tipo: 'numero', unidade: 'cm' }, { rotulo: 'Largura', tipo: 'numero', unidade: 'cm' },
    { rotulo: 'Severidade (1 a 5)', tipo: 'opcoes', opcoes: ['1', '2', '3', '4', '5'] }, { rotulo: 'Material' }] },
];

function validarModelo(b = {}) {
  const nome = txt(b.nome, 80); if (!nome) return { erro: 'Dê um nome ao modelo.' };
  const titulo = txt(b.titulo, 60) || nome.toUpperCase();
  const ids = new Set(); const campos = [];
  for (const c of Array.isArray(b.campos) ? b.campos.slice(0, 30) : []) {
    const rotulo = txt(c?.rotulo, 40); if (!rotulo) continue;
    const tipo = TIPOS[c.tipo] ? c.tipo : 'texto';
    let id = String(c.id || '').replace(/[^a-z0-9_]/gi, '').slice(0, 20) || `c${campos.length + 1}`; while (ids.has(id)) id = `${id}x`; ids.add(id);
    const opcoes = tipo === 'opcoes' ? [...new Set((Array.isArray(c.opcoes) ? c.opcoes : String(c.opcoes || '').split(/[;\n]/)).map((o) => txt(o, 40)).filter(Boolean))].slice(0, 20) : [];
    if (tipo === 'opcoes' && opcoes.length < 2) return { erro: `"${rotulo}": informe ao menos 2 opções.` };
    campos.push({ id, rotulo, tipo, opcoes, unidade: txt(c.unidade, 10), largura: c.largura === 2 && !c.destaque ? 2 : 1, destaque: !!c.destaque, obrigatorio: !!c.obrigatorio });
  }
  if (!campos.length) return { erro: 'Inclua ao menos um campo no cartão.' };
  return { dados: { nome, titulo, codigo: txt(b.codigo, 40), revisao: txt(b.revisao, 10), obs: b.obs !== false, campos } };
}

async function listarModelos(sb, tenantId, { todos = false } = {}) {
  const l = (await q(sb.from('cartao_foto_modelos').select('*').eq('tenant_id', tenantId))).filter((m) => todos || m.ativo !== false).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  return { modelos: l, exemplos: EXEMPLOS.map(({ chave, nome }) => ({ chave, nome })), TIPOS };
}
async function salvarModelo(sb, tenantId, quem, id, b = {}) {
  let base = b;
  if (!id && b.exemplo) { const ex = EXEMPLOS.find((e) => e.chave === b.exemplo); if (!ex) return { status: 404, erro: 'Exemplo não encontrado.' }; base = { ...ex, nome: b.nome || ex.nome }; }
  const v = validarModelo(base); if (v.erro) return { status: 400, erro: v.erro };
  const agora = new Date().toISOString();
  if (id) {
    const m = (await q(sb.from('cartao_foto_modelos').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!m) return { status: 404, erro: 'Modelo não encontrado.' };
    return { modelo: (await q(sb.from('cartao_foto_modelos').update({ ...v.dados, ...('ativo' in b ? { ativo: !!b.ativo } : {}), atualizado_em: agora }).eq('tenant_id', tenantId).eq('id', id).select()))[0] };
  }
  return { modelo: (await q(sb.from('cartao_foto_modelos').insert([{ ...v.dados, tenant_id: tenantId, ativo: true, criado_por: quem?.nome || null, criado_em: agora, atualizado_em: agora }]).select()))[0] };
}
async function ativarModelo(sb, tenantId, id, ativo) {
  const m = (await q(sb.from('cartao_foto_modelos').update({ ativo: !!ativo, atualizado_em: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id).select()))[0];
  return m ? { modelo: m } : { status: 404, erro: 'Modelo não encontrado.' };
}

async function enviarFoto(sb, tenantId, quem, b = {}) {
  const uid = String(b.cliente_uid || '').replace(/[^a-z0-9-]/gi, '').slice(0, 60); if (uid.length < 8) return { status: 400, erro: 'Foto sem identificador do aparelho.' };
  const ja = (await q(sb.from('fotos_cartao').select('*').eq('tenant_id', tenantId).eq('cliente_uid', uid)))[0];
  if (ja) return { foto: { id: ja.id }, repetida: true };
  const m = String(b.imagem || '').match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/); if (!m) return { status: 400, erro: 'Imagem inválida (JPG).' };
  const buf = Buffer.from(m[1], 'base64'); if (buf.length < 2000 || buf.length > 8 * 1024 * 1024) return { status: 400, erro: 'Foto de até 8 MB.' };
  let modelo = null;
  if (b.modelo_id) modelo = (await q(sb.from('cartao_foto_modelos').select('*').eq('tenant_id', tenantId).eq('id', b.modelo_id)))[0] || null;
  const campos = modelo?.campos || (Array.isArray(b.modelo?.campos) ? b.modelo.campos : []);
  const valores = {}; for (const c of campos) { const v = txt(b.valores?.[c.id], 80); if (v) valores[c.id] = v; }
  const tirada = !Number.isNaN(Date.parse(b.tirada_em)) ? new Date(b.tirada_em).toISOString() : new Date().toISOString();
  const gps = b.gps && Number.isFinite(Number(b.gps.lat)) && Number.isFinite(Number(b.gps.lng)) ? { lat: Number(b.gps.lat), lng: Number(b.gps.lng), precisao: Number(b.gps.precisao) || null } : null;
  const path = `tenant-${tenantId}/fotos-cartao/${tirada.slice(0, 7)}/${uid}.jpg`;
  const { error } = await sb.storage.from(D.BUCKET).upload(path, buf, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(`Falha ao subir a foto: ${error.message}`);
  const linha = { tenant_id: tenantId, cliente_uid: uid, modelo_id: modelo?.id || null, modelo_nome: modelo?.nome || txt(b.modelo?.nome, 80), modelo: { titulo: modelo?.titulo || b.modelo?.titulo || null, campos: campos.map((c) => ({ id: c.id, rotulo: c.rotulo, unidade: c.unidade || null })) },
    valores, obs: txt(b.obs, 600), referencia: txt(b.referencia, 120), tecnico: quem?.nome || null, usuario_id: quem?.id != null ? String(quem.id) : null, gps, tirada_em: tirada, arquivo: path, tamanho: buf.length,
    hash: crypto.createHash('sha256').update(buf).digest('hex'), criado_em: new Date().toISOString() };
  try { return { foto: { id: (await q(sb.from('fotos_cartao').insert([linha]).select()))[0].id } }; }
  catch (e) { if (/duplicate|unique/i.test(e.message)) return { foto: null, repetida: true }; throw e; }
}

async function listarFotos(sb, tenantId, f = {}) {
  let l = await q(sb.from('fotos_cartao').select('*').eq('tenant_id', tenantId));
  if (f.modelo_id) l = l.filter((x) => String(x.modelo_id) === String(f.modelo_id));
  if (f.de) l = l.filter((x) => String(x.tirada_em).slice(0, 10) >= f.de);
  if (f.ate) l = l.filter((x) => String(x.tirada_em).slice(0, 10) <= f.ate);
  if (f.busca) { const t = String(f.busca).toLowerCase(); l = l.filter((x) => [x.referencia, x.tecnico, x.obs, x.modelo_nome, ...Object.values(x.valores || {})].some((v) => String(v || '').toLowerCase().includes(t))); }
  l.sort((a, b) => String(b.tirada_em).localeCompare(String(a.tirada_em)));
  const total = l.length; const pag = l.slice(0, Math.min(Number(f.limite) || 60, 200));
  const out = [];
  for (const x of pag) { let url = null; try { url = await D.linkArquivo(sb, x.arquivo); } catch { /* sem link agora */ } out.push({ ...x, url }); }
  const refs = [...new Set(l.map((x) => x.referencia).filter(Boolean))].slice(0, 50);
  return { fotos: out, total, referencias: refs };
}

module.exports = { EXEMPLOS, TIPOS, validarModelo, listarModelos, salvarModelo, ativarModelo, enviarFoto, listarFotos };
