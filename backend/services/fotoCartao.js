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
  let projetoId = null;
  if (b.projeto_id) { const pj = (await q(sb.from('projetos_foto').select('*').eq('tenant_id', tenantId).eq('id', b.projeto_id)))[0]; projetoId = pj ? pj.id : null; } // E2: projeto apagado → foto fica sem projeto, nunca é recusada
  const linha = { tenant_id: tenantId, cliente_uid: uid, projeto_id: projetoId, modelo_id: modelo?.id || null, modelo_nome: modelo?.nome || txt(b.modelo?.nome, 80), modelo: { titulo: modelo?.titulo || b.modelo?.titulo || null, campos: campos.map((c) => ({ id: c.id, rotulo: c.rotulo, unidade: c.unidade || null })) },
    valores, obs: txt(b.obs, 600), referencia: txt(b.referencia, 120), tecnico: quem?.nome || null, usuario_id: quem?.id != null ? String(quem.id) : null, gps, tirada_em: tirada, arquivo: path, tamanho: buf.length,
    hash: crypto.createHash('sha256').update(buf).digest('hex'), criado_em: new Date().toISOString() };
  try { return { foto: { id: (await q(sb.from('fotos_cartao').insert([linha]).select()))[0].id } }; }
  catch (e) { if (/duplicate|unique/i.test(e.message)) return { foto: null, repetida: true }; throw e; }
}

async function listarFotos(sb, tenantId, f = {}) {
  let l = await q(sb.from('fotos_cartao').select('*').eq('tenant_id', tenantId));
  if (f.modelo_id) l = l.filter((x) => String(x.modelo_id) === String(f.modelo_id));
  if (f.referencia != null && f.referencia !== '') { const rf = normRef(f.referencia); l = l.filter((x) => normRef(x.referencia) === rf); }
  if (f.tecnico) l = l.filter((x) => x.tecnico === f.tecnico);
  if (f.projeto_id) l = l.filter((x) => (f.projeto_id === 'sem' ? !x.projeto_id : String(x.projeto_id) === String(f.projeto_id)));
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

// ─── E2: projetos ────────────────────────────────────────────────────────────
const data = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null);
// E2.1: coordenadas do projeto (pino) — vazias limpam; fora do globo → recusa
const coord = (b) => { if (!('lat' in b) && !('lng' in b)) return {}; const la = b.lat === '' || b.lat == null ? null : Number(b.lat); const ln = b.lng === '' || b.lng == null ? null : Number(b.lng);
  if (la == null || ln == null) return { lat: null, lng: null }; if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return { lat: null, lng: null, invalido: true }; return { lat: la, lng: ln }; };
async function listarProjetos(sb, tenantId, { todos = false } = {}) {
  const [ps, fs] = await Promise.all([q(sb.from('projetos_foto').select('*').eq('tenant_id', tenantId)), q(sb.from('fotos_cartao').select('*').eq('tenant_id', tenantId))]);
  const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const lista = ps.filter((p) => todos || p.status === 'ativo').map((p) => { const fp = fs.filter((f) => String(f.projeto_id) === String(p.id));
    return { ...p, fotos: fp.length, fotos_hoje: fp.filter((f) => String(f.tirada_em).slice(0, 10) === hoje || String(f.criado_em).slice(0, 10) === hoje).length, tecnicos: [...new Set(fp.map((f) => f.tecnico).filter(Boolean))], ultima_em: fp.reduce((m, f) => (String(f.criado_em) > m ? String(f.criado_em) : m), '') || null }; })
    .sort((a, b) => (a.status === b.status ? String(b.ultima_em || b.criado_em).localeCompare(String(a.ultima_em || a.criado_em)) : a.status === 'ativo' ? -1 : 1));
  return { projetos: lista, sem_projeto: fs.filter((f) => !f.projeto_id).length };
}
async function salvarProjeto(sb, tenantId, quem, id, b = {}) {
  const nome = txt(b.nome, 120); if (!nome) return { status: 400, erro: 'Dê um nome ao projeto.' };
  const d = { nome, cliente_id: b.cliente_id != null && b.cliente_id !== '' ? String(b.cliente_id) : null, cliente_nome: txt(b.cliente_nome, 120), local: txt(b.local, 160), descricao: txt(b.descricao, 1000), inicio: data(b.inicio), fim: data(b.fim), ...coord(b) };
  if (d.invalido) return { status: 400, erro: 'Coordenadas inválidas (latitude −90 a 90, longitude −180 a 180).' }; delete d.invalido;
  if (d.inicio && d.fim && d.inicio > d.fim) return { status: 400, erro: 'O início precisa ser antes do fim.' };
  const agora = new Date().toISOString();
  if (id) {
    const p = (await q(sb.from('projetos_foto').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!p) return { status: 404, erro: 'Projeto não encontrado.' };
    if ('status' in b) d.status = b.status === 'encerrado' ? 'encerrado' : 'ativo';
    return { projeto: (await q(sb.from('projetos_foto').update({ ...d, atualizado_em: agora }).eq('tenant_id', tenantId).eq('id', id).select()))[0] };
  }
  const dup = (await q(sb.from('projetos_foto').select('*').eq('tenant_id', tenantId))).find((p) => p.status === 'ativo' && p.nome.toLowerCase() === nome.toLowerCase());
  if (dup) return { status: 409, erro: `Já existe um projeto ativo com o nome "${nome}".` };
  return { projeto: (await q(sb.from('projetos_foto').insert([{ ...d, tenant_id: tenantId, status: 'ativo', criado_por: quem?.nome || null, criado_em: agora, atualizado_em: agora }]).select()))[0] };
}

// ─── E2.1: mapa — projetos (pino do local) e aerogeradores (média do GPS das fotos da mesma referência) ───
const normRef = (v) => String(v || '').trim().toUpperCase().replace(/\s+/g, ' ');
async function mapa(sb, tenantId, f = {}) {
  const [ps, fs0] = await Promise.all([q(sb.from('projetos_foto').select('*').eq('tenant_id', tenantId)), q(sb.from('fotos_cartao').select('*').eq('tenant_id', tenantId))]);
  let fs = fs0;
  if (f.projeto_id) fs = fs.filter((x) => String(x.projeto_id) === String(f.projeto_id));
  if (f.de) fs = fs.filter((x) => String(x.tirada_em).slice(0, 10) >= f.de);
  if (f.ate) fs = fs.filter((x) => String(x.tirada_em).slice(0, 10) <= f.ate);
  if (f.tecnico) fs = fs.filter((x) => x.tecnico === f.tecnico);
  const pMap = new Map(ps.map((p) => [String(p.id), p]));
  if (f.cliente) { const c = String(f.cliente).toLowerCase(); fs = fs.filter((x) => String(pMap.get(String(x.projeto_id))?.cliente_nome || '').toLowerCase() === c); }
  // pinos: projeto + referência (sem referência → agrupa por ~100 m)
  const grupos = new Map();
  for (const x of fs) { if (!x.gps || !Number.isFinite(Number(x.gps.lat))) continue; const rf = normRef(x.referencia);
    const k = `${x.projeto_id || 'sem'}|${rf || `@${Number(x.gps.lat).toFixed(3)},${Number(x.gps.lng).toFixed(3)}`}`;
    const g = grupos.get(k) || { chave: k, projeto_id: x.projeto_id || null, referencia: rf || null, n: 0, sLat: 0, sLng: 0, primeira: null, ultima: null, tecnicos: new Set(), modelos: new Set() };
    g.n++; g.sLat += Number(x.gps.lat); g.sLng += Number(x.gps.lng); const t = String(x.tirada_em); if (!g.primeira || t < g.primeira) g.primeira = t; if (!g.ultima || t > g.ultima) g.ultima = t; if (x.tecnico) g.tecnicos.add(x.tecnico); if (x.modelo_nome) g.modelos.add(x.modelo_nome); grupos.set(k, g); }
  const pinos = [...grupos.values()].map((g) => { const p = pMap.get(String(g.projeto_id)); return { chave: g.chave, projeto_id: g.projeto_id, projeto: p?.nome || null, cliente: p?.cliente_nome || null, referencia: g.referencia, lat: g.sLat / g.n, lng: g.sLng / g.n, fotos: g.n, primeira: g.primeira, ultima: g.ultima, tecnicos: [...g.tecnicos], modelos: [...g.modelos] }; });
  const idsComFoto = new Set(fs.map((x) => String(x.projeto_id)));
  const projetos = ps.filter((p) => (!f.projeto_id || String(p.id) === String(f.projeto_id)) && (!f.cliente || String(p.cliente_nome || '').toLowerCase() === String(f.cliente).toLowerCase()) && ((!f.de && !f.ate && !f.tecnico) || idsComFoto.has(String(p.id))))
    .map((p) => { const fp = fs.filter((x) => String(x.projeto_id) === String(p.id)); const pin = pinos.filter((x) => String(x.projeto_id) === String(p.id));
      let { lat, lng } = p; if ((lat == null || lng == null) && pin.length) { lat = pin.reduce((s2, x) => s2 + x.lat, 0) / pin.length; lng = pin.reduce((s2, x) => s2 + x.lng, 0) / pin.length; }
      return { id: p.id, nome: p.nome, cliente: p.cliente_nome, local: p.local, status: p.status, lat, lng, local_aprox: p.lat == null && lat != null, fotos: fp.length, aerogeradores: pin.filter((x) => x.referencia).length }; });
  const todas = fs0;
  return { projetos, pinos, totais: { projetos: projetos.filter((p) => p.fotos > 0).length, aerogeradores: pinos.filter((x) => x.referencia).length, fotos: fs.length, clientes: new Set(projetos.filter((p) => p.fotos > 0).map((p) => p.cliente).filter(Boolean)).size, sem_gps: fs.filter((x) => !x.gps).length },
    filtros: { clientes: [...new Set(ps.map((p) => p.cliente_nome).filter(Boolean))].sort(), tecnicos: [...new Set(todas.map((x) => x.tecnico).filter(Boolean))].sort(), projetos: ps.map((p) => ({ id: p.id, nome: p.nome })) } };
}
// geocodificação (OpenStreetMap / Nominatim) pelo servidor — identifica o app e guarda em memória por 1 dia
const cacheGeo = new Map();
async function geocodificar(texto) {
  const t = txt(texto, 160); if (!t || t.length < 3) return { status: 400, erro: 'Digite ao menos 3 letras do local.' };
  const k = t.toLowerCase(); const c = cacheGeo.get(k); if (c && Date.now() - c.em < 864e5) return { resultados: c.r };
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=pt-BR&q=${encodeURIComponent(t)}`;
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 8000);
  try { const r = await fetch(url, { headers: { 'User-Agent': 'QuotaFlow/1.0 (localizacao de projetos)' }, signal: ctl.signal }); if (!r.ok) return { status: 502, erro: 'O serviço de mapas não respondeu agora. Cole as coordenadas ou toque no mapa.' };
    const j = await r.json(); const res = (Array.isArray(j) ? j : []).map((x) => ({ nome: x.display_name, lat: Number(x.lat), lng: Number(x.lon) })).filter((x) => Number.isFinite(x.lat));
    cacheGeo.set(k, { em: Date.now(), r: res }); if (cacheGeo.size > 500) cacheGeo.delete(cacheGeo.keys().next().value); return { resultados: res }; }
  catch { return { status: 502, erro: 'O serviço de mapas não respondeu agora. Cole as coordenadas ou toque no mapa.' }; } finally { clearTimeout(to); }
}

module.exports = { mapa, geocodificar, normRef, listarProjetos, salvarProjeto, EXEMPLOS, TIPOS, validarModelo, listarModelos, salvarModelo, ativarModelo, enviarFoto, listarFotos };
