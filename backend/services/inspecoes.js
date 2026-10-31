// backend/services/inspecoes.js — etapa 14a
//
// Inspeções de equipamento (pré-uso e rotina) — decidido com o Marcony (21/10/2026):
//   • modelo com VISTAS (frente, traseira, laterais, painel, motor, eixos…) — cada vista tem um ESQUEMA genérico do
//     QuotaFlow (ou uma foto/desenho do cliente) e PONTOS posicionados (x, y em % da imagem); cada ponto: OK / não OK /
//     N/A (ou número, ou texto), foto (nunca | se não OK | sempre), crítico. Biblioteca do QuotaFlow (Console) → a empresa
//     importa e edita (mesmo padrão de funções e treinamentos).
//   • execução no celular: registro (km/horímetro validados contra a última, local, cliente, GPS opcional) → pontos
//     (todo ponto nasce "não verificado"; só finaliza com tudo verificado) → assinatura. cliente_uid gerado no aparelho:
//     o envio offline (fila no navegador) não duplica.
//   • "não OK" + "impede o uso" (ou ponto crítico não OK) → equipamento BLOQUEADO (evidência); o gestor libera com motivo
//     (equipamento_liberacoes). Do item não OK o gestor abre uma OS (vai para a rotina de OS existente).
//   • resultado: aprovado (tudo OK/N/A) · ressalvas (não OK que não impede) · reprovado (algo impede o uso).
// 14b.1: tipo do modelo (equipamento | carregamento | transito | descarregamento), número INSP-AAAA-NNNN, "resolvi na hora"
//   (item não OK consertado ali mesmo — não bloqueia, fica como ressalva com o que foi feito) e link de inspeção de terceiros.
// Regras do backend: sem DB.raw; ids com String(); filtros sem null.

const crypto = require('crypto');
const D = require('./documentos');

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const texto = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const num = (v) => { if (v === '' || v == null) return null; const t = String(v).trim(); const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); return Number.isFinite(n) ? n : NaN; };

const CATEGORIAS = [
  { codigo: 'cavalo', nome: 'Cavalo mecânico' }, { codigo: 'caminhao', nome: 'Caminhão (toco/truck)' }, { codigo: 'carreta', nome: 'Carreta / semirreboque' },
  { codigo: 'onibus', nome: 'Ônibus' }, { codigo: 'utilitario', nome: 'Utilitário / van' }, { codigo: 'empilhadeira', nome: 'Empilhadeira' },
  { codigo: 'retroescavadeira', nome: 'Retroescavadeira / máquina' }, { codigo: 'outro', nome: 'Outro' },
];
const FREQUENCIAS = [
  { codigo: 'pre_uso', nome: 'Pré-uso (a cada saída)' }, { codigo: 'diaria', nome: 'Diária' }, { codigo: 'semanal', nome: 'Semanal' },
  { codigo: 'mensal', nome: 'Mensal' }, { codigo: 'avulsa', nome: 'Avulsa (sem frequência)' },
];
const CAMPOS = ['km', 'horimetro', 'local', 'cliente'];
const TIPOS = [ // 14b.1 — os 3 últimos são os gatilhos da futura Autorização de Transporte (AT)
  { codigo: 'equipamento', nome: 'Equipamento (pré-uso / rotina)' }, { codigo: 'carregamento', nome: 'Carregamento (acomodação, amarração, sinalização)' },
  { codigo: 'transito', nome: 'Em trânsito (parada de verificação)' }, { codigo: 'descarregamento', nome: 'Descarregamento (entrega)' },
  { codigo: 'entrega', nome: 'Entrega de locação (saída para o cliente)' }, { codigo: 'devolucao', nome: 'Devolução de locação (volta do cliente)' }, // 14b.2
];
const ESQUEMAS = ['cavalo_frente', 'cavalo_lateral', 'cavalo_traseira', 'carreta_lateral', 'carreta_traseira', 'onibus_lateral', 'onibus_frente',
  'empilhadeira_lateral', 'retro_lateral', 'utilitario_lateral', 'painel', 'motor', 'eixos'];
const IMG_PATH = /^(tenant-\d+|biblioteca)\/insp-modelo\/[\w.-]+\.(jpg|png|webp)$/;

// ─── validação do modelo ──────────────────────────────────────────────────
function validarVistas(lista, { prefixos = null } = {}) {
  if (!Array.isArray(lista) || !lista.length) return { erro: 'O modelo precisa de pelo menos uma vista' };
  if (lista.length > 12) return { erro: 'No máximo 12 vistas' };
  const vistas = [], ids = new Set();
  for (const [i, v] of lista.entries()) {
    const nome = texto(v?.nome, 60); if (!nome) return { erro: `Vista ${i + 1}: informe o nome` };
    const img = texto(v?.imagem, 300);
    if (img && !(img.startsWith('esquema:') ? ESQUEMAS.includes(img.slice(8)) : IMG_PATH.test(img) && (!prefixos || prefixos.some((p) => img.startsWith(p))))) return { erro: `Vista “${nome}”: imagem inválida` };
    const pts = Array.isArray(v?.pontos) ? v.pontos : [];
    if (pts.length > 40) return { erro: `Vista “${nome}”: no máximo 40 pontos` };
    const pontos = [];
    for (const [k, p] of pts.entries()) {
      const rotulo = texto(p?.rotulo, 80); if (!rotulo) return { erro: `Vista “${nome}”, ponto ${k + 1}: informe o nome` };
      let id = texto(p?.id, 40); if (!id || !/^[\w-]{1,40}$/.test(id) || ids.has(id)) id = `p${crypto.randomBytes(4).toString('hex')}`;
      ids.add(id);
      const x = Number(p?.x), y = Number(p?.y);
      const tipo = ['ok_nok', 'numero', 'texto'].includes(p?.tipo) ? p.tipo : 'ok_nok';
      pontos.push({ id, rotulo, x: Number.isFinite(x) ? Math.min(100, Math.max(0, Math.round(x * 10) / 10)) : null, y: Number.isFinite(y) ? Math.min(100, Math.max(0, Math.round(y * 10) / 10)) : null,
        tipo, foto: ['nunca', 'se_nok', 'sempre'].includes(p?.foto) ? p.foto : 'se_nok', foto_obrigatoria: p?.foto_obrigatoria !== false, critico: p?.critico === true, unidade: texto(p?.unidade, 12), ajuda: texto(p?.ajuda, 200) });
    }
    vistas.push({ codigo: texto(v?.codigo, 40) || `v${i + 1}`, nome, imagem: img, pontos });
  }
  if (!vistas.some((v) => v.pontos.length)) return { erro: 'Cadastre pelo menos um ponto de inspeção' };
  return { vistas };
}
function validarModelo(body, opcoes = {}) {
  const { parcial = false } = opcoes;
  const erros = [], out = {};
  const tem = (k) => body[k] !== undefined;
  if (!parcial || tem('nome')) { const n = texto(body.nome, 120); if (!n) erros.push('Informe o nome do modelo'); else out.nome = n; }
  if (tem('categoria')) { if (!CATEGORIAS.some((c) => c.codigo === body.categoria)) erros.push('Categoria inválida'); else out.categoria = body.categoria; }
  if (tem('frequencia')) { if (!FREQUENCIAS.some((c) => c.codigo === body.frequencia)) erros.push('Frequência inválida'); else out.frequencia = body.frequencia; }
  if (tem('tipo')) { if (!TIPOS.some((c) => c.codigo === body.tipo)) erros.push('Tipo inválido'); else out.tipo = body.tipo; }
  if (tem('descricao')) out.descricao = texto(body.descricao, 1000);
  if (tem('campos')) out.campos = (Array.isArray(body.campos) ? body.campos : []).filter((c) => CAMPOS.includes(c));
  if (!parcial || tem('vistas')) { const r = validarVistas(body.vistas, opcoes); if (r.erro) erros.push(r.erro); else out.vistas = r.vistas; }
  return { erros, dados: out };
}
const totalPontos = (m) => (m.vistas || []).reduce((s, v) => s + (v.pontos || []).length, 0);
const resumoModelo = (m) => ({ ...m, pontos_qtd: totalPontos(m), vistas_qtd: (m.vistas || []).length, criticos_qtd: (m.vistas || []).reduce((s, v) => s + v.pontos.filter((p) => p.critico).length, 0) });

// ─── biblioteca (Console) ─────────────────────────────────────────────────
const CONTEUDO = ['nome', 'tipo', 'categoria', 'frequencia', 'descricao', 'vistas', 'campos'];
async function bibliotecaTodos(supabase) { return (await q(supabase.from('inspecao_modelos').select('*').is('tenant_id', null))).sort((a, b) => String(a.nome).localeCompare(String(b.nome))); }
async function bibliotecaConsole(supabase) { return { modelos: (await bibliotecaTodos(supabase)).map(resumoModelo), categorias: CATEGORIAS, frequencias: FREQUENCIAS, tipos: TIPOS, esquemas: ESQUEMAS }; }
async function criarModeloBib(supabase, body) {
  const { erros, dados } = validarModelo(body || {}, { prefixos: ['biblioteca/'] });
  if (erros.length) return { status: 400, erro: erros[0] };
  const { data, error } = await supabase.from('inspecao_modelos').insert([{ ...dados, tenant_id: null, versao: 1 }]).select();
  if (error) throw new Error(error.message);
  return { modelo: resumoModelo(data[0]) };
}
async function editarModeloBib(supabase, id, body) {
  if (!/^\d+$/.test(String(id))) return { status: 404, erro: 'Modelo não encontrado' };
  const m = (await q(supabase.from('inspecao_modelos').select('*').is('tenant_id', null).eq('id', id)))[0];
  if (!m) return { status: 404, erro: 'Modelo não encontrado' };
  const { erros, dados } = validarModelo(body || {}, { parcial: true, prefixos: ['biblioteca/'] });
  if (erros.length) return { status: 400, erro: erros[0] };
  const mudou = CONTEUDO.some((k) => dados[k] !== undefined && JSON.stringify(dados[k]) !== JSON.stringify(m[k] ?? null));
  if (body.ativo !== undefined) dados.ativo = body.ativo !== false;
  const { data, error } = await supabase.from('inspecao_modelos').update({ ...dados, versao: mudou ? (m.versao || 1) + 1 : m.versao, atualizado_em: new Date().toISOString() }).eq('id', m.id).is('tenant_id', null).select();
  if (error) throw new Error(error.message);
  return { modelo: resumoModelo(data[0]), versao_subiu: mudou };
}

// ─── modelos da empresa ───────────────────────────────────────────────────
async function modelosTenant(supabase, tenantId) {
  const l = (await q(supabase.from('inspecao_modelos').select('*').eq('tenant_id', tenantId))).filter((m) => m.ativo !== false);
  const bib = l.some((m) => m.origem_id != null) ? new Map((await bibliotecaTodos(supabase)).map((m) => [String(m.id), Number(m.versao || 1)])) : new Map();
  return l.map((m) => ({ ...resumoModelo(m), versao_nova: m.origem_id != null && (bib.get(String(m.origem_id)) || 0) > Number(m.origem_versao || 0) })).sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
}
async function bibliotecaParaTenant(supabase, tenantId) {
  const meus = await q(supabase.from('inspecao_modelos').select('*').eq('tenant_id', tenantId));
  const por = new Map(meus.filter((m) => m.origem_id != null && m.ativo !== false).map((m) => [String(m.origem_id), m]));
  return (await bibliotecaTodos(supabase)).filter((m) => m.ativo !== false).map((m) => ({ ...resumoModelo(m), ja_importado: por.has(String(m.id)) }));
}
async function importar(supabase, tenantId, bibId) {
  if (!/^\d+$/.test(String(bibId || ''))) return { status: 400, erro: 'Escolha o modelo' };
  const m = (await q(supabase.from('inspecao_modelos').select('*').is('tenant_id', null).eq('id', bibId)))[0];
  if (!m || m.ativo === false) return { status: 404, erro: 'Modelo não encontrado' };
  const copia = Object.fromEntries(CONTEUDO.map((k) => [k, m[k] ?? null]));
  const { data, error } = await supabase.from('inspecao_modelos').insert([{ ...copia, tenant_id: tenantId, origem_id: m.id, origem_versao: m.versao }]).select();
  if (error) throw new Error(error.message);
  return { modelo: resumoModelo(data[0]) };
}
async function atualizarDaBiblioteca(supabase, tenantId, id) {
  const t = /^\d+$/.test(String(id)) ? (await q(supabase.from('inspecao_modelos').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] : null;
  if (!t || t.origem_id == null) return { status: 404, erro: 'Modelo não veio da biblioteca' };
  const m = (await q(supabase.from('inspecao_modelos').select('*').is('tenant_id', null).eq('id', t.origem_id)))[0];
  if (!m) return { status: 404, erro: 'O modelo saiu da biblioteca' };
  const copia = Object.fromEntries(CONTEUDO.map((k) => [k, m[k] ?? null]));
  const { data, error } = await supabase.from('inspecao_modelos').update({ ...copia, origem_versao: m.versao, atualizado_em: new Date().toISOString() }).eq('id', t.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return { modelo: resumoModelo(data[0]) };
}
async function salvarModeloTenant(supabase, tenantId, id, body) {
  const pref = [`tenant-${tenantId}/`, 'biblioteca/'];
  if (id) {
    const { erros, dados } = validarModelo(body || {}, { parcial: true, prefixos: pref });
    if (erros.length) return { status: 400, erro: erros[0] };
    const { data, error } = await supabase.from('inspecao_modelos').update({ ...dados, atualizado_em: new Date().toISOString() }).eq('id', id).eq('tenant_id', tenantId).select();
    if (error) throw new Error(error.message);
    if (!data?.length) return { status: 404, erro: 'Modelo não encontrado' };
    return { modelo: resumoModelo(data[0]) };
  }
  const { erros, dados } = validarModelo(body || {}, { prefixos: pref });
  if (erros.length) return { status: 400, erro: erros[0] };
  const { data, error } = await supabase.from('inspecao_modelos').insert([{ ...dados, tenant_id: tenantId }]).select();
  if (error) throw new Error(error.message);
  return { modelo: resumoModelo(data[0]) };
}

/** Imagem própria (foto/desenho do equipamento) para uma vista — prefixo 'tenant-{id}' ou 'biblioteca' */
async function subirImagemModelo(supabase, prefixo, { base64, mime }) {
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime];
  if (!ext) return { status: 400, erro: 'Envie JPG, PNG ou WEBP' };
  const buf = Buffer.from(String(base64 || ''), 'base64');
  if (!buf.length || buf.length > 3 * 1024 * 1024) return { status: 400, erro: 'Imagem de até 3 MB' };
  const path = `${prefixo}/insp-modelo/${Date.now()}-${crypto.randomBytes(5).toString('hex')}.${ext}`;
  const { error } = await supabase.storage.from(D.BUCKET).upload(path, buf, { contentType: mime, upsert: false });
  if (error) throw new Error(`Falha ao subir a imagem: ${error.message}`);
  return { imagem: path };
}
/** Links (1 h) das imagens próprias das vistas */
async function linksImagens(supabase, modelo) {
  const out = {};
  for (const v of modelo?.vistas || []) if (v.imagem && !v.imagem.startsWith('esquema:')) { try { out[v.imagem] = await D.linkArquivo(supabase, v.imagem); } catch { /* ok */ } }
  return out;
}

// ─── equipamentos ─────────────────────────────────────────────────────────
async function equipamentos(supabase, tenantId) {
  const eqs = (await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId))).filter((e) => e.ativo !== false);
  const ins = await q(supabase.from('inspecoes').select('*').eq('tenant_id', tenantId));
  return eqs.map((e) => {
    const minhas = ins.filter((i) => String(i.equipamento_id) === String(e.id)).sort((a, b) => String(b.concluida_em).localeCompare(String(a.concluida_em)));
    const u = minhas[0];
    return { id: e.id, tag: e.tag, nome: e.nome, local: e.local, inspecao_modelo_id: e.inspecao_modelo_id || null, bloqueado: !!e.bloqueado, bloqueio_motivo: e.bloqueio_motivo || null, bloqueado_em: e.bloqueado_em || null, bloqueio_inspecao_id: e.bloqueio_inspecao_id || null,
      ultima: u ? { id: u.id, numero: u.numero || null, em: u.concluida_em, resultado: u.resultado, executor: u.executor_nome, km: u.km, horimetro: u.horimetro } : null, total: minhas.length };
  }).sort((a, b) => (b.bloqueado - a.bloqueado) || String(a.tag || a.nome).localeCompare(String(b.tag || b.nome)));
}
async function definirModeloEquipamento(supabase, tenantId, equipId, modeloId) {
  if (modeloId) { const m = (await q(supabase.from('inspecao_modelos').select('*').eq('tenant_id', tenantId).eq('id', modeloId)))[0]; if (!m) return { status: 400, erro: 'Modelo não encontrado' }; }
  const { data, error } = await supabase.from('equipamentos').update({ inspecao_modelo_id: modeloId || null }).eq('id', equipId).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  if (!data?.length) return { status: 404, erro: 'Equipamento não encontrado' };
  return { ok: true };
}

/** Dados para começar uma inspeção: equipamento, modelo (o padrão do equipamento ou o escolhido), última leitura */
async function preparar(supabase, tenantId, equipId, modeloId) {
  const e = (await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId).eq('id', equipId)))[0];
  if (!e) return { status: 404, erro: 'Equipamento não encontrado' };
  const mid = modeloId || e.inspecao_modelo_id;
  if (!mid) return { status: 400, erro: 'Escolha o modelo de inspeção (ou defina o modelo padrão do equipamento)' };
  const m = (await q(supabase.from('inspecao_modelos').select('*').eq('tenant_id', tenantId).eq('id', mid)))[0];
  if (!m || m.ativo === false) return { status: 404, erro: 'Modelo não encontrado' };
  const ins = (await q(supabase.from('inspecoes').select('*').eq('tenant_id', tenantId).eq('equipamento_id', e.id))).sort((a, b) => String(b.concluida_em).localeCompare(String(a.concluida_em)));
  const maxKm = ins.reduce((mx, i) => (i.km != null && Number(i.km) > mx ? Number(i.km) : mx), 0);
  const maxH = ins.reduce((mx, i) => (i.horimetro != null && Number(i.horimetro) > mx ? Number(i.horimetro) : mx), 0);
  return { equipamento: { id: e.id, tag: e.tag, nome: e.nome, bloqueado: !!e.bloqueado, bloqueio_motivo: e.bloqueio_motivo || null },
    modelo: { id: m.id, nome: m.nome, tipo: m.tipo || 'equipamento', descricao: m.descricao || null, categoria: m.categoria, frequencia: m.frequencia, campos: m.campos || [], vistas: m.vistas }, imagens: await linksImagens(supabase, m),
    ultima: { km: maxKm || null, horimetro: maxH || null, em: ins[0]?.concluida_em || null },
    inicial: { local: '', cliente: '', _origem: {}, _opcoes_local: [await opcaoBase(supabase, tenantId)] } }; // 16e.4
}

/** 14b.1: veículo do próprio terceiro (não cadastrado) — só o modelo; sem última leitura nem bloqueio */
/** 16e.4: botões de local na 1ª tela da inspeção — fora de uma AT só "📍 Base" (o pátio cadastrado em Dados da empresa) */
async function opcaoBase(supabase, tenantId) {
  const emp = (await q(supabase.from('tenants').select('*').eq('id', tenantId)).catch(() => []))[0] || {};
  return { chave: 'base', rotulo: '📍 Base', origem: 'pátio / base da frota', valor: texto(emp.base_endereco, 200) || '' };
}
async function prepararAvulso(supabase, tenantId, { placa, descricao }, modeloId) {
  const m = (await q(supabase.from('inspecao_modelos').select('*').eq('tenant_id', tenantId).eq('id', modeloId)))[0];
  if (!m || m.ativo === false) return { status: 404, erro: 'Modelo não encontrado' };
  const pl = texto(placa, 12); if (!pl) return { status: 400, erro: 'Informe a placa do veículo' };
  return { equipamento: { id: null, tag: pl.toUpperCase(), nome: texto(descricao, 80) || 'Veículo do terceiro', bloqueado: false },
    modelo: { id: m.id, nome: m.nome, tipo: m.tipo || 'equipamento', descricao: m.descricao || null, categoria: m.categoria, frequencia: m.frequencia, campos: m.campos || [], vistas: m.vistas },
    imagens: await linksImagens(supabase, m), ultima: { km: null, horimetro: null, em: null },
    inicial: { local: '', cliente: '', _origem: {}, _opcoes_local: [await opcaoBase(supabase, tenantId)] } }; // 16e.4
}
async function proximoNumero(supabase, tenantId, agoraIso, salto = 0) {
  const ano = new Date(new Date(agoraIso).getTime() - 3 * 3600000).getUTCFullYear();
  const pre = `INSP-${ano}-`;
  const l = (await q(supabase.from('inspecoes').select('*').eq('tenant_id', tenantId))).filter((i) => String(i.numero || '').startsWith(pre));
  const max = l.reduce((mx, i) => { const n = Number(String(i.numero || '').slice(pre.length)); return Number.isFinite(n) && n > mx ? n : mx; }, 0);
  return `${pre}${String(max + 1 + salto).padStart(4, '0')}`;
}

// ─── envio da inspeção ────────────────────────────────────────────────────
const pngOk = (png) => typeof png === 'string' && png.startsWith('data:image/png;base64,') && png.length >= 200 && png.length <= 400 * 1024;
const FOTO_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/**
 * body: { cliente_uid, equipamento_id, modelo_id, km, horimetro, local, cliente, gps: {lat, lng, precisao},
 *   iniciada_em, respostas: { [ponto_id]: { status: 'ok'|'nok'|'na', valor, obs, impede, fotos: [{ base64, mime }] } },
 *   assinatura_png, obs }
 * executor: { tipo: 'colaborador'|'usuario'|'terceiro', colaborador_id, usuario_id, nome, terceiro }
 */
async function enviar(supabase, tenantId, executor, body = {}, opcoes = {}) {
  const { origem = 'app', linkId = null } = opcoes;
  const uid = texto(body.cliente_uid, 60);
  if (!uid || !/^[\w-]{8,60}$/.test(uid)) return { status: 400, erro: 'Inspeção sem identificador — recarregue a página' };
  const ja = (await q(supabase.from('inspecoes').select('*').eq('tenant_id', tenantId).eq('cliente_uid', uid)))[0];
  if (ja) return { inspecao: { id: ja.id, resultado: ja.resultado }, repetido: true }; // reenvio da fila offline
  const prep = opcoes.avulso ? await prepararAvulso(supabase, tenantId, opcoes.avulso, body.modelo_id) : await preparar(supabase, tenantId, body.equipamento_id, body.modelo_id);
  if (prep.erro) return prep;
  const { equipamento: e, modelo: m, ultima } = prep;
  const campos = m.campos || [];
  const km = num(body.km), hor = num(body.horimetro);
  if (campos.includes('km')) { if (km == null || Number.isNaN(km) || km < 0) return { status: 400, erro: 'Informe o km' }; if (ultima.km && km < ultima.km) return { status: 400, erro: `Km menor que a última leitura (${ultima.km.toLocaleString('pt-BR')})` }; }
  if (campos.includes('horimetro')) { if (hor == null || Number.isNaN(hor) || hor < 0) return { status: 400, erro: 'Informe o horímetro' }; if (ultima.horimetro && hor < ultima.horimetro) return { status: 400, erro: `Horímetro menor que a última leitura (${ultima.horimetro.toLocaleString('pt-BR')})` }; }
  if (campos.includes('local') && !texto(body.local, 200)) return { status: 400, erro: 'Informe o local' };
  if (campos.includes('cliente') && !texto(body.cliente, 200)) return { status: 400, erro: 'Informe o cliente / contrato' };
  if (!pngOk(body.assinatura_png)) return { status: 400, erro: 'Falta a assinatura de quem inspecionou' };
  const resp = body.respostas && typeof body.respostas === 'object' ? body.respostas : {};
  const pontos = m.vistas.flatMap((v) => v.pontos.map((p) => ({ ...p, vista: v.nome })));
  const saida = [];
  const fotosParaSubir = [];
  let nFotos = 0;
  for (const p of pontos) {
    const r = resp[p.id] || {};
    const st = p.tipo === 'ok_nok' ? r.status : (r.status === 'na' ? 'na' : 'ok');
    if (!['ok', 'nok', 'na'].includes(st)) return { status: 400, erro: `Falta verificar: ${p.vista} → ${p.rotulo}` };
    let valor = null;
    if (p.tipo === 'numero' && st !== 'na') { valor = num(r.valor); if (valor == null || Number.isNaN(valor)) return { status: 400, erro: `Informe o valor: ${p.rotulo}` }; }
    if (p.tipo === 'texto' && st !== 'na') { valor = texto(r.valor, 500); if (!valor) return { status: 400, erro: `Preencha: ${p.rotulo}` }; }
    const fotos = (Array.isArray(r.fotos) ? r.fotos : []).slice(0, 4);
    const precisaFoto = st !== 'na' && p.foto_obrigatoria !== false && (p.foto === 'sempre' || ((p.foto || 'se_nok') === 'se_nok' && st === 'nok')); // 14a.1: foto opcional
    if (precisaFoto && !fotos.length) return { status: 400, erro: `Tire a foto: ${p.rotulo}` };
    if (st === 'nok' && !texto(r.obs, 500) && p.tipo === 'ok_nok') return { status: 400, erro: `Descreva o problema: ${p.rotulo}` };
    const caminhos = [];
    for (const f of fotos) {
      const ext = FOTO_MIME[f?.mime]; const buf = Buffer.from(String(f?.base64 || ''), 'base64');
      if (!ext || !buf.length || buf.length > 2.5 * 1024 * 1024) return { status: 400, erro: `Foto inválida em ${p.rotulo} (JPG/PNG até 2,5 MB)` };
      const path = `tenant-${tenantId}/insp-${uid}/${p.id}-${++nFotos}.${ext}`;
      fotosParaSubir.push({ path, buf, mime: f.mime }); caminhos.push(path);
    }
    const resolvido = st === 'nok' && r.resolvido === true; // 14b.1: "resolvi na hora"
    if (resolvido && !texto(r.resolucao, 500)) return { status: 400, erro: `Conte o que foi feito para resolver: ${p.rotulo}` };
    const impede = st === 'nok' && !resolvido && (p.critico || r.impede === true);
    saida.push({ ponto_id: p.id, vista: p.vista, rotulo: p.rotulo, tipo: p.tipo, critico: !!p.critico, status: st, valor, unidade: p.unidade || null, obs: texto(r.obs, 500), impede, resolvido, resolucao: resolvido ? texto(r.resolucao, 500) : null, fotos: caminhos });
  }
  for (const f of fotosParaSubir) {
    const { error } = await supabase.storage.from(D.BUCKET).upload(f.path, f.buf, { contentType: f.mime, upsert: true });
    if (error) throw new Error(`Falha ao subir foto: ${error.message}`);
  }
  const resultado = saida.some((x) => x.impede) ? 'reprovado' : saida.some((x) => x.status === 'nok') ? 'ressalvas' : 'aprovado';
  const agora = new Date().toISOString();
  const gps = body.gps && Number.isFinite(Number(body.gps.lat)) && Number.isFinite(Number(body.gps.lng)) ? { lat: Number(body.gps.lat), lng: Number(body.gps.lng), precisao: Number(body.gps.precisao) || null } : null;
  const reg = { tenant_id: tenantId, cliente_uid: uid, tipo: m.tipo || 'equipamento', link_id: linkId, modelo_id: m.id, modelo_nome: m.nome, modelo: m, equipamento_id: e.id, equipamento_nome: [e.tag, e.nome].filter(Boolean).join(' — '),
    executor_tipo: executor.tipo, colaborador_id: executor.colaborador_id || null, usuario_id: executor.usuario_id || null, executor_nome: executor.nome || '—', terceiro: executor.terceiro || null,
    km: campos.includes('km') ? km : null, horimetro: campos.includes('horimetro') ? hor : null, local: texto(body.local, 200), cliente: texto(body.cliente, 200), gps,
    iniciada_em: body.iniciada_em && !Number.isNaN(Date.parse(body.iniciada_em)) ? new Date(body.iniciada_em).toISOString() : null, concluida_em: agora,
    resultado, respostas: saida, assinatura_png: body.assinatura_png, origem, obs: texto(body.obs, 1000) };
  reg.hash = crypto.createHash('sha256').update(JSON.stringify({ t: String(tenantId), uid, e: String(e.id), km: reg.km, h: reg.horimetro, r: saida.map((x) => [x.ponto_id, x.status, x.valor]), em: agora }) + body.assinatura_png).digest('hex');
  let ins = null;
  for (let tentativa = 0; tentativa < 5 && !ins; tentativa++) { // número INSP-AAAA-NNNN (corrida: tenta o próximo)
    reg.numero = await proximoNumero(supabase, tenantId, agora, tentativa);
    const { data, error } = await supabase.from('inspecoes').insert([reg]).select();
    if (!error) { ins = data[0]; break; }
    if (/inspecoes_cliente_uid_unico/.test(error.message)) return { inspecao: { cliente_uid: uid }, repetido: true };
    if (!/inspecoes_numero_unico/.test(error.message)) throw new Error(error.message);
  }
  if (!ins) throw new Error('Não foi possível numerar a inspeção — tente de novo');
  try { await require('./rotinasInspecao').aoGravarInspecao(supabase, tenantId, ins, reg.tipo); } // 14b.2: liga à locação ativa (entrega/devolução)
  catch (err) { if (!/locac|does not exist|schema cache/.test(String(err.message))) console.error('⚠️ [inspeções] locação:', err.message); }
  if (resultado === 'reprovado' && e.id) {
    const motivo = saida.filter((x) => x.impede).map((x) => `${x.rotulo}${x.obs ? ` (${x.obs})` : ''}`).join('; ').slice(0, 500);
    await supabase.from('equipamentos').update({ bloqueado: true, bloqueio_motivo: motivo, bloqueio_inspecao_id: ins.id, bloqueado_em: agora }).eq('id', e.id).eq('tenant_id', tenantId);
  }
  return { inspecao: { id: ins.id, numero: ins.numero, resultado, nao_ok: saida.filter((x) => x.status === 'nok').length, bloqueou: resultado === 'reprovado' } };
}

// ─── consulta ─────────────────────────────────────────────────────────────
/** 14b.1.4: todos os itens não OK já resolvidos (na hora, sem OS ou OS concluída)? O resultado registrado não muda. */
const corrigida = (i) => { const nok = (i.respostas || []).filter((r) => r.status === 'nok'); return nok.length > 0 && nok.every((r) => r.resolvido || r.resolucao_posterior || (i.os_abertas || []).some((o) => o.ponto_id === r.ponto_id && o.concluida_em)); };
const leve = (i) => ({ id: i.id, locacao_id: i.locacao_id ?? null, numero: i.numero || null, tipo: i.tipo || 'equipamento', colaborador_id: i.colaborador_id, equipamento_id: i.equipamento_id, equipamento_nome: i.equipamento_nome, modelo_nome: i.modelo_nome, executor_nome: i.executor_nome, executor_tipo: i.executor_tipo,
  terceiro: i.terceiro, km: i.km, horimetro: i.horimetro, local: i.local, cliente: i.cliente, concluida_em: i.concluida_em, resultado: i.resultado, origem: i.origem,
  nao_ok: (i.respostas || []).filter((r) => r.status === 'nok').length, corrigida: corrigida(i), // 14b.1.4
  impede: (i.respostas || []).filter((r) => r.impede).length, os_abertas: i.os_abertas || [] });
async function listar(supabase, tenantId, { equipamentoId, de, ate } = {}) {
  let b = supabase.from('inspecoes').select('*').eq('tenant_id', tenantId);
  if (equipamentoId) b = b.eq('equipamento_id', equipamentoId);
  return (await q(b)).filter((i) => (!de || String(i.concluida_em).slice(0, 10) >= de) && (!ate || String(i.concluida_em).slice(0, 10) <= ate))
    .sort((a, b2) => String(b2.concluida_em).localeCompare(String(a.concluida_em))).map(leve);
}
async function detalhe(supabase, tenantId, id) {
  if (!/^\d+$/.test(String(id))) return { status: 404, erro: 'Inspeção não encontrada' };
  const i = (await q(supabase.from('inspecoes').select('*').eq('tenant_id', tenantId).eq('id', id)))[0];
  if (!i) return { status: 404, erro: 'Inspeção não encontrada' };
  const fotos = {};
  for (const r of i.respostas || []) for (const p of r.fotos || []) { try { fotos[p] = await D.linkArquivo(supabase, p); } catch { /* ok */ } }
  const emp = (await q(supabase.from('tenants').select('*').eq('id', tenantId)))[0] || {};
  // 14b.2: devolução de locação → traz a inspeção de entrega para comparar item a item (mesmo ponto_id ou mesmo rótulo)
  let entrega = null;
  if (i.tipo === 'devolucao' && i.locacao_id) {
    try {
      const loc = (await q(supabase.from('equipamento_locacoes').select('*').eq('tenant_id', tenantId).eq('id', i.locacao_id)))[0];
      const ent = loc?.entrega_inspecao_id ? (await q(supabase.from('inspecoes').select('*').eq('tenant_id', tenantId).eq('id', loc.entrega_inspecao_id)))[0] : null;
      if (ent) {
        for (const r0 of ent.respostas || []) for (const p of r0.fotos || []) { try { fotos[p] = await D.linkArquivo(supabase, p); } catch { /* ok */ } }
        entrega = { id: ent.id, numero: ent.numero, concluida_em: ent.concluida_em, executor_nome: ent.executor_nome, km: ent.km, horimetro: ent.horimetro, respostas: ent.respostas, cliente: loc.cliente };
      }
    } catch { /* sem a 042 */ }
  }
  return { inspecao: i, entrega, fotos, imagens: await linksImagens(supabase, i.modelo), empresa: { nome: emp.nome_fantasia || emp.nome || emp.razao_social || 'Empresa', razao_social: emp.razao_social || emp.nome || null, cnpj: emp.cnpj || null } };
}

/** Libera um equipamento bloqueado (evidência: quem, quando, por quê).
 *  14b.2: primeiro desbloqueia e CONFERE (antes, uma falha no update passava em silêncio e o equipamento seguia
 *  bloqueado com a evidência gravada); depois grava a evidência. */
async function liberar(supabase, tenantId, { usuarioId, usuarioNome }, equipId, motivo) {
  const e = (await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId).eq('id', equipId)))[0];
  if (!e) return { status: 404, erro: 'Equipamento não encontrado' };
  if (!e.bloqueado) return { status: 400, erro: 'O equipamento não está bloqueado' };
  const mot = texto(motivo, 500); if (!mot || mot.length < 5) return { status: 400, erro: 'Explique por que está liberando (ex.: reparo feito na OS nº…, liberação provisória até…)' };
  const { data: upd, error: eu } = await supabase.from('equipamentos').update({ bloqueado: false, bloqueio_motivo: null, bloqueio_inspecao_id: null, bloqueado_em: null }).eq('id', e.id).eq('tenant_id', tenantId).select();
  if (eu) throw new Error(`Não foi possível desbloquear o equipamento: ${eu.message}`);
  if (!upd?.length || upd[0].bloqueado) return { status: 500, erro: 'O banco não aceitou o desbloqueio do equipamento — mande esta mensagem para conferência.' };
  const { error } = await supabase.from('equipamento_liberacoes').insert([{ tenant_id: tenantId, equipamento_id: e.id, inspecao_id: e.bloqueio_inspecao_id || null, motivo_bloqueio: e.bloqueio_motivo, motivo_liberacao: mot, liberado_por: usuarioId || null, liberado_por_nome: usuarioNome || null }]);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** 14b.2: "✅ Resolver sem OS" no item não OK (correção local / empresa sem OS). Se era o último item que impedia o uso
 *  e o equipamento está bloqueado por esta inspeção, já libera (com evidência). */
async function resolverSemOS(supabase, tenantId, quemFez, inspId, { ponto_id, texto: t } = {}) {
  const i = /^\d+$/.test(String(inspId)) ? (await q(supabase.from('inspecoes').select('*').eq('tenant_id', tenantId).eq('id', inspId)))[0] : null;
  if (!i) return { status: 404, erro: 'Inspeção não encontrada' };
  const resp = i.respostas || [];
  const k = resp.findIndex((r) => r.ponto_id === ponto_id);
  if (k < 0 || resp[k].status !== 'nok') return { status: 400, erro: 'Item não encontrado ou não está "não OK"' };
  if (resp[k].resolvido || resp[k].resolucao_posterior) return { status: 400, erro: 'Este item já foi resolvido' };
  const txt = texto(t, 500); if (!txt || txt.length < 5) return { status: 400, erro: 'Conte o que foi feito (ex.: lâmpada trocada pelo motorista)' };
  const novas = resp.map((r, j) => (j === k ? { ...r, resolucao_posterior: { texto: txt, por: quemFez.usuarioNome || null, por_id: quemFez.usuarioId || null, em: new Date().toISOString() } } : r));
  const { error } = await supabase.from('inspecoes').update({ respostas: novas }).eq('id', i.id).eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  const x = await liberarSeResolvida(supabase, tenantId, quemFez, { ...i, respostas: novas });
  if (x.erro) return x;
  return { ok: true, ...x };
}

/** 14b.1.2: item que impede o uso conta como resolvido quando foi "resolvido na hora", "resolvido sem OS" ou a OS dele foi
 *  CONCLUÍDA. Se todos estão resolvidos e o equipamento está bloqueado por esta inspeção → libera com evidência. */
const osConcluidaDe = (i, r) => (i.os_abertas || []).find((o) => o.ponto_id === r.ponto_id && o.concluida_em);
async function liberarSeResolvida(supabase, tenantId, quemFez, i) {
  const pendentes = (i.respostas || []).filter((r) => r.impede && !r.resolucao_posterior && !osConcluidaDe(i, r));
  if (pendentes.length || !i.equipamento_id) return { liberou: false, pendentes: pendentes.map((r) => r.rotulo) };
  const e = (await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId).eq('id', i.equipamento_id)))[0];
  if (!e?.bloqueado || String(e.bloqueio_inspecao_id) !== String(i.id)) return { liberou: false, pendentes: [] };
  const lista = (i.respostas || []).filter((r) => r.impede).map((r) => { const o = osConcluidaDe(i, r); return `${r.rotulo}: ${r.resolucao_posterior ? `resolvido sem OS — ${r.resolucao_posterior.texto}` : `corrigido na ${o.os_numero || `OS ${o.os_id}`}`}`; }).join('; ');
  const x = await liberar(supabase, tenantId, quemFez, e.id, `Liberação automática — itens que impediam o uso resolvidos (${i.numero || `inspeção ${i.id}`}): ${lista}`.slice(0, 500));
  if (x.erro) return x;
  return { liberou: true, pendentes: [] };
}

/** 14b.1.2: chamada quando uma OS é concluída — marca a OS como concluída nas inspeções ligadas a ela e libera o
 *  equipamento se não sobrou item impedindo o uso. Nunca derruba a conclusão da OS (erros só no log). */
async function osConcluida(supabase, tenantId, quemFez, osId, quando = new Date().toISOString()) {
  const lista = (await q(supabase.from('inspecoes').select('*').eq('tenant_id', tenantId))).filter((i) => (i.os_abertas || []).some((o) => String(o.os_id) === String(osId) && !o.concluida_em));
  const res = [];
  for (const i of lista) {
    const os = i.os_abertas.map((o) => (String(o.os_id) === String(osId) ? { ...o, concluida_em: quando } : o));
    const { error } = await supabase.from('inspecoes').update({ os_abertas: os }).eq('id', i.id).eq('tenant_id', tenantId);
    if (error) throw new Error(error.message);
    res.push({ inspecao: i.numero || i.id, ...(await liberarSeResolvida(supabase, tenantId, quemFez, { ...i, os_abertas: os })) });
  }
  return res;
}
async function liberacoes(supabase, tenantId, equipId) {
  return (await q(supabase.from('equipamento_liberacoes').select('*').eq('tenant_id', tenantId).eq('equipamento_id', equipId))).sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
}

/** Registra na inspeção a OS aberta para um item não OK (a OS é criada pela rota de OS existente) */
async function registrarOS(supabase, tenantId, inspId, { ponto_id, os_id, os_numero }) {
  const i = /^\d+$/.test(String(inspId)) ? (await q(supabase.from('inspecoes').select('*').eq('tenant_id', tenantId).eq('id', inspId)))[0] : null;
  if (!i) return { status: 404, erro: 'Inspeção não encontrada' };
  const lista = [...(i.os_abertas || []).filter((x) => x.ponto_id !== ponto_id), { ponto_id, os_id: String(os_id), os_numero: texto(os_numero, 40), em: new Date().toISOString() }];
  await supabase.from('inspecoes').update({ os_abertas: lista }).eq('id', i.id).eq('tenant_id', tenantId);
  return { ok: true, os_abertas: lista };
}

// ─── 14b.1: link de inspeção de terceiros (sem login) ──────────────────────
// O gestor gera um link para um modelo (+ equipamento da frota, ou "veículo do próprio terceiro") com validade.
// O terceiro se identifica (nome, CPF, empresa; placa quando o veículo é dele) e faz a inspeção igual ao app.
const linkVivo = (l) => l && l.ativo !== false && new Date(l.valido_ate).getTime() > Date.now();
async function listarLinks(supabase, tenantId) {
  const l = await q(supabase.from('inspecao_links').select('*').eq('tenant_id', tenantId));
  return l.map((x) => ({ ...x, vivo: linkVivo(x) })).sort((a, b) => (b.vivo - a.vivo) || String(b.criado_em).localeCompare(String(a.criado_em)));
}
async function criarLink(supabase, tenantId, { usuarioId, usuarioNome }, body = {}) {
  const m = /^\d+$/.test(String(body.modelo_id || '')) ? (await q(supabase.from('inspecao_modelos').select('*').eq('tenant_id', tenantId).eq('id', body.modelo_id)))[0] : null;
  if (!m || m.ativo === false) return { status: 400, erro: 'Escolha o modelo de inspeção' };
  let equipId = null;
  if (body.equipamento_id) { const e = (await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId).eq('id', body.equipamento_id)))[0]; if (!e) return { status: 400, erro: 'Equipamento não encontrado' }; equipId = e.id; }
  const dias = Math.round(Number(body.dias || 7));
  if (!Number.isFinite(dias) || dias < 1 || dias > 90) return { status: 400, erro: 'Validade de 1 a 90 dias' };
  const reg = { tenant_id: tenantId, token: crypto.randomBytes(24).toString('hex'), titulo: texto(body.titulo, 120), modelo_id: m.id, equipamento_id: equipId,
    valido_ate: new Date(Date.now() + dias * 86400000).toISOString(), criado_por: usuarioId || null, criado_por_nome: usuarioNome || null };
  const { data, error } = await supabase.from('inspecao_links').insert([reg]).select();
  if (error) throw new Error(error.message);
  return { link: data[0] };
}
async function desativarLink(supabase, tenantId, id) {
  const { data, error } = await supabase.from('inspecao_links').update({ ativo: false }).eq('tenant_id', tenantId).eq('id', id).select();
  if (error) throw new Error(error.message);
  return data?.length ? { ok: true } : { status: 404, erro: 'Link não encontrado' };
}
async function linkPorToken(supabase, token) {
  if (!/^[a-f0-9]{48}$/.test(String(token || ''))) return null;
  return (await q(supabase.from('inspecao_links').select('*').eq('token', token)))[0] || null;
}
/** dados para a tela pública: empresa, modelo e equipamento (ou pedir a placa) */
async function prepararLink(supabase, link, { placa, descricao } = {}) {
  if (!linkVivo(link)) return { status: 410, erro: 'Este link de inspeção expirou ou foi desativado — peça um novo à empresa.' };
  const emp = (await q(supabase.from('tenants').select('*').eq('id', link.tenant_id)))[0] || {};
  const empresa = { nome: emp.nome_fantasia || emp.nome || emp.razao_social || 'Empresa' };
  const prep = link.equipamento_id ? await preparar(supabase, link.tenant_id, link.equipamento_id, link.modelo_id)
    : (placa ? await prepararAvulso(supabase, link.tenant_id, { placa, descricao }, link.modelo_id) : null);
  if (prep?.erro) return prep;
  const m = prep ? null : (await q(supabase.from('inspecao_modelos').select('*').eq('tenant_id', link.tenant_id).eq('id', link.modelo_id)))[0];
  return { empresa, titulo: link.titulo, pede_placa: !link.equipamento_id, valido_ate: link.valido_ate, modelo_nome: prep?.modelo.nome || m?.nome, prep };
}
async function enviarPorLink(supabase, link, body = {}) {
  if (!linkVivo(link)) return { status: 410, erro: 'Este link de inspeção expirou ou foi desativado — peça um novo à empresa.' };
  const t = body.terceiro || {};
  const nome = texto(t.nome, 120); if (!nome || nome.length < 3) return { status: 400, erro: 'Informe seu nome completo' };
  const cpf = String(t.cpf || '').replace(/\D/g, ''); if (!D.cpfValido(cpf)) return { status: 400, erro: 'CPF inválido' };
  const terceiro = { nome, cpf, empresa: texto(t.empresa, 120), telefone: texto(t.telefone, 30), placa: texto(t.placa, 12) };
  const opcoes = { origem: 'link', linkId: link.id };
  if (!link.equipamento_id) { if (!terceiro.placa) return { status: 400, erro: 'Informe a placa do veículo' }; opcoes.avulso = { placa: terceiro.placa, descricao: texto(t.veiculo, 80) }; }
  const r = await enviar(supabase, link.tenant_id, { tipo: 'terceiro', nome, terceiro }, { ...body, equipamento_id: link.equipamento_id, modelo_id: link.modelo_id }, opcoes);
  if (!r.erro && !r.repetido) await supabase.from('inspecao_links').update({ usos: Number(link.usos || 0) + 1, ultimo_uso: new Date().toISOString() }).eq('id', link.id);
  return r;
}

module.exports = { corrigida, osConcluida, liberarSeResolvida, resolverSemOS, listarLinks, criarLink, desativarLink, linkPorToken, prepararLink, enviarPorLink, TIPOS, prepararAvulso, proximoNumero, CATEGORIAS, FREQUENCIAS, CAMPOS, ESQUEMAS, validarModelo, validarVistas, bibliotecaConsole, criarModeloBib, editarModeloBib, modelosTenant, bibliotecaParaTenant, importar,
  atualizarDaBiblioteca, salvarModeloTenant, subirImagemModelo, linksImagens, equipamentos, definirModeloEquipamento, preparar, enviar, listar, detalhe, liberar, liberacoes, registrarOS };
