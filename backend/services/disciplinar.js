// backend/services/disciplinar.js — etapa 12h
//
// Medidas disciplinares do colaborador — decidido com o Marcony (21/10/2026): é RH, não "multa" → aba própria.
//   • tipos em escala: orientação (verbal, registrada) → advertência escrita → suspensão (dias) → justa causa (registro)
//   • categoria do motivo (atraso/falta, EPI, segurança, conduta, direção, desempenho, outro); pode ligar a uma multa
//   • CIÊNCIA: o colaborador assina na tela; se RECUSAR, registra 2 testemunhas (nome + assinatura) — prática usual;
//     orientação pode ser só "verbal" (registrada, sem assinatura)
//   • 12h.1: ciência PENDENTE — o documento é preenchido no escritório e salvo; a ciência é colhida depois (na tela, com
//     recusa + testemunhas, ou "assinou no papel" com o anexo). Pendente NÃO conta na progressão até ser colhida
//     (a data de aplicação passa a ser a da ciência). 🖨 "para assinar" sai com as linhas em branco.
//   • 12h.2: testemunha com NOME + CPF (validado; diferente do colaborador e entre si) — compliance
//   • PROGRESSÃO: o sistema SUGERE a próxima medida pelo histórico recente; quem decide é o gestor
//   • cancelar (anulada) não apaga — fica no histórico. Vai para a Ficha e o dossiê.
//   • LGPD: só admin, gestor e qualidade veem e registram.
// ⚠️ Os textos dos documentos são MODELOS — a empresa deve validar com o jurídico.

const crypto = require('crypto');
const D = require('./documentos');

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const texto = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const hojeBR = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600000).toISOString().slice(0, 10);
const somaDias = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dBR = (s) => String(s).slice(0, 10).split('-').reverse().join('/');

const TIPOS = [
  { codigo: 'orientacao', nome: 'Orientação (verbal, registrada)', curto: 'Orientação', nivel: 1 },
  { codigo: 'advertencia', nome: 'Advertência escrita', curto: 'Advertência', nivel: 2 },
  { codigo: 'suspensao', nome: 'Suspensão', curto: 'Suspensão', nivel: 3 },
  { codigo: 'justa_causa', nome: 'Dispensa por justa causa (registro)', curto: 'Justa causa', nivel: 4 },
];
const CATEGORIAS = [
  { codigo: 'atraso_falta', nome: 'Atraso / falta injustificada' }, { codigo: 'epi', nome: 'Não uso de EPI' },
  { codigo: 'seguranca', nome: 'Norma de segurança' }, { codigo: 'conduta', nome: 'Conduta / comportamento' },
  { codigo: 'direcao', nome: 'Direção perigosa / infração de trânsito' }, { codigo: 'desempenho', nome: 'Desempenho / negligência' },
  { codigo: 'patrimonio', nome: 'Dano ao patrimônio' }, { codigo: 'outro', nome: 'Outro' },
];
const nomeTipo = (c) => (TIPOS.find((t) => t.codigo === c) || {}).nome || c;

/** Texto do documento apresentado ao colaborador (modelo) */
function montarTexto({ tipo, colaborador, empresa, data_fato, descricao, dias_suspensao, suspensao_inicio, suspensao_fim }) {
  const emp = empresa || 'a empresa';
  const fato = `em ${dBR(data_fato)}: ${String(descricao).trim().replace(/[.;,\s]+$/, '')}`; // 12h.1: sem ".." no fim
  if (tipo === 'orientacao') return `${colaborador} foi orientado(a) por ${emp} sobre o fato ocorrido ${fato}. Esta orientação fica registrada para acompanhamento; a repetição poderá levar a medidas disciplinares.`;
  if (tipo === 'advertencia') return `Pelo presente, ${emp} aplica a ${colaborador} ADVERTÊNCIA DISCIPLINAR pelo fato ocorrido ${fato}. Solicitamos que tal conduta não se repita; a reincidência poderá acarretar medidas mais severas, nos termos da legislação trabalhista.`;
  if (tipo === 'suspensao') return `Pelo presente, ${emp} aplica a ${colaborador} SUSPENSÃO DISCIPLINAR de ${dias_suspensao} dia(s)${suspensao_inicio ? `, de ${dBR(suspensao_inicio)} a ${dBR(suspensao_fim)}` : ''}, sem remuneração, pelo fato ocorrido ${fato}. A reincidência poderá acarretar a rescisão do contrato por justa causa (CLT, art. 482).`;
  return `Registro de dispensa por JUSTA CAUSA de ${colaborador}, por ${emp}, pelo fato ocorrido ${fato} (CLT, art. 482). Este registro não substitui os documentos de rescisão.`;
}

/** Sugestão da próxima medida pelo histórico vigente (o gestor decide) */
const conta = (m) => m.status === 'vigente' && m.ciencia !== 'pendente'; // 12h.1: pendente ainda não foi aplicada
function sugerirProxima(medidas, hoje = hojeBR()) {
  const vig = medidas.filter(conta);
  const desde = (dias) => vig.filter((m) => String(m.data_aplicacao) >= somaDias(hoje, -dias));
  const c = (lista, t) => lista.filter((m) => m.tipo === t).length;
  const d6 = desde(183), d12 = desde(365);
  if (c(d12, 'suspensao') >= 1) return { tipo: 'justa_causa', motivo: `${c(d12, 'suspensao')} suspensão(ões) nos últimos 12 meses — reincidência pode justificar justa causa (avalie com o jurídico)` };
  if (c(d6, 'advertencia') >= 2) return { tipo: 'suspensao', motivo: `${c(d6, 'advertencia')} advertências escritas nos últimos 6 meses` };
  if (c(d6, 'advertencia') >= 1 || c(d6, 'orientacao') >= 2) return { tipo: 'advertencia', motivo: `${c(d6, 'advertencia')} advertência(s) e ${c(d6, 'orientacao')} orientação(ões) nos últimos 6 meses` };
  if (c(d6, 'orientacao') >= 1) return { tipo: 'advertencia', motivo: '1 orientação nos últimos 6 meses — reincidência: advertência escrita' };
  return { tipo: 'orientacao', motivo: 'Sem medidas nos últimos 6 meses' };
}

function resumoColaborador(medidas, hoje = hojeBR()) {
  const vig = medidas.filter(conta);
  const d12 = vig.filter((m) => String(m.data_aplicacao) >= somaDias(hoje, -365));
  const por = Object.fromEntries(TIPOS.map((t) => [t.codigo, d12.filter((m) => m.tipo === t.codigo).length]));
  return { pendentes: medidas.filter((m) => m.status === 'vigente' && m.ciencia === 'pendente').length, total_12m: d12.length, por_tipo_12m: por, dias_suspensao_12m: d12.reduce((s, m) => s + (m.dias_suspensao || 0), 0), sugestao: sugerirProxima(medidas, hoje) };
}

const limpa = (m) => ({ ...m, ciencia_png: undefined, testemunhas: (m.testemunhas || []).map((t) => ({ nome: t.nome, cpf: t.cpf || null, hash: t.hash, assinou: !!t.png })), tem_arquivo: !!m.arquivo_path, tipo_nome: nomeTipo(m.tipo), categoria_nome: (CATEGORIAS.find((c) => c.codigo === m.categoria) || {}).nome || m.categoria });

async function listar(supabase, tenantId, { colaboradorId } = {}) {
  let b = supabase.from('medidas_disciplinares').select('*').eq('tenant_id', tenantId);
  if (colaboradorId) b = b.eq('colaborador_id', colaboradorId);
  return (await q(b)).map(limpa).sort((a, b2) => String(b2.data_aplicacao).localeCompare(String(a.data_aplicacao)) || Number(b2.id) - Number(a.id));
}

/** 12h.2: testemunhas com nome + CPF (válido, diferente do colaborador e entre si) + assinatura */
function validarTestemunhas(lista, colab, txt, em) {
  const ts = (Array.isArray(lista) ? lista : []).map((t) => ({ nome: texto(t?.nome, 120), cpf: D.soDigitos(t?.cpf || ''), png: t?.png })).filter((t) => t.nome);
  if (ts.length < 2 || ts.some((t) => !pngOk(t.png))) return { erro: 'Recusa: registre 2 testemunhas (nome, CPF e assinatura)' };
  if (ts.some((t) => !D.cpfValido(t.cpf))) return { erro: 'CPF de testemunha inválido' };
  if (new Set(ts.map((t) => t.cpf)).size !== ts.length) return { erro: 'As testemunhas precisam ser pessoas diferentes (CPF repetido)' };
  if (ts.some((t) => t.nome.toLowerCase() === String(colab.nome).toLowerCase() || (colab.cpf && D.soDigitos(colab.cpf) === t.cpf))) return { erro: 'O próprio colaborador não pode ser testemunha' };
  return { testemunhas: ts.slice(0, 3).map((t) => ({ nome: t.nome, cpf: t.cpf, png: t.png, hash: crypto.createHash('sha256').update(JSON.stringify({ c: String(colab.id), txt, testemunha: t.nome, cpf: t.cpf, em }) + t.png).digest('hex') })) };
}
const pngOk = (png) => typeof png === 'string' && png.startsWith('data:image/png;base64,') && png.length >= 200 && png.length <= 400 * 1024;

/** Prévia do texto (o mesmo que será gravado) */
async function previa(supabase, tenantId, body) {
  const c = /^\d+$/.test(String(body.colaborador_id || '')) ? (await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId).eq('id', body.colaborador_id)))[0] : null;
  const emp = (await q(supabase.from('tenants').select('*').eq('id', tenantId)))[0] || {};
  const dias = parseInt(body.dias_suspensao, 10) || null;
  const ini = DATA.test(String(body.suspensao_inicio || '')) ? body.suspensao_inicio : null;
  return { texto: montarTexto({ tipo: body.tipo, colaborador: c?.nome || 'o(a) colaborador(a)', empresa: emp.razao_social || emp.nome, data_fato: DATA.test(String(body.data_fato || '')) ? body.data_fato : hojeBR(), descricao: texto(body.descricao, 3000) || '…', dias_suspensao: dias, suspensao_inicio: ini, suspensao_fim: ini && dias ? somaDias(ini, dias - 1) : null }) };
}

/** Registra a medida. body: { colaborador_id, tipo, categoria, data_fato, data_aplicacao, descricao, dias_suspensao, suspensao_inicio,
 *  multa_id, ciencia: 'assinada'|'recusa'|'verbal', ciencia_png, testemunhas: [{ nome, png }], arquivo_* } */
async function criar(supabase, tenantId, { usuarioId, usuarioNome }, body = {}) {
  if (!TIPOS.some((t) => t.codigo === body.tipo)) return { status: 400, erro: 'Escolha o tipo da medida' };
  if (!CATEGORIAS.some((c) => c.codigo === body.categoria)) return { status: 400, erro: 'Escolha a categoria do motivo' };
  if (!DATA.test(String(body.data_fato || ''))) return { status: 400, erro: 'Informe a data do fato' };
  const aplic = DATA.test(String(body.data_aplicacao || '')) ? body.data_aplicacao : hojeBR();
  if (body.data_fato > hojeBR() || aplic > hojeBR()) return { status: 400, erro: 'Datas não podem ser futuras' };
  if (aplic < body.data_fato) return { status: 400, erro: 'A aplicação não pode ser antes do fato' };
  const descricao = texto(body.descricao, 3000); if (!descricao || descricao.length < 10) return { status: 400, erro: 'Descreva o fato (o que, onde, como)' };
  const c = /^\d+$/.test(String(body.colaborador_id || '')) ? (await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId).eq('id', body.colaborador_id)))[0] : null;
  if (!c) return { status: 400, erro: 'Colaborador não encontrado' };
  let dias = null, ini = null, fim = null;
  if (body.tipo === 'suspensao') {
    dias = parseInt(body.dias_suspensao, 10);
    if (!(dias >= 1 && dias <= 30)) return { status: 400, erro: 'Suspensão de 1 a 30 dias (CLT, art. 474)' };
    ini = DATA.test(String(body.suspensao_inicio || '')) ? body.suspensao_inicio : null;
    if (!ini) return { status: 400, erro: 'Informe o início da suspensão' };
    fim = somaDias(ini, dias - 1);
  }
  let multaId = null;
  if (body.multa_id) {
    const mu = /^\d+$/.test(String(body.multa_id)) ? (await q(supabase.from('multas').select('*').eq('tenant_id', tenantId).eq('id', body.multa_id)))[0] : null;
    if (!mu) return { status: 400, erro: 'Multa não encontrada' };
    multaId = mu.id;
  }
  const ciencia = ['assinada', 'recusa', 'verbal', 'pendente', 'papel'].includes(body.ciencia) ? body.ciencia : null;
  if (!ciencia) return { status: 400, erro: 'Registre a ciência do colaborador (ou “colher depois”)' };
  if (ciencia === 'papel' && !body.arquivo_base64) return { status: 400, erro: 'Assinado no papel: anexe o documento assinado (foto ou PDF)' };
  if (ciencia === 'verbal' && body.tipo !== 'orientacao') return { status: 400, erro: 'Só a orientação pode ser registrada sem assinatura' };
  const emp = (await q(supabase.from('tenants').select('*').eq('id', tenantId)))[0] || {};
  const txt = montarTexto({ tipo: body.tipo, colaborador: c.nome, empresa: emp.razao_social || emp.nome, data_fato: body.data_fato, descricao, dias_suspensao: dias, suspensao_inicio: ini, suspensao_fim: fim });
  const em = new Date().toISOString();
  const reg = { tenant_id: tenantId, colaborador_id: c.id, colaborador_nome: c.nome, tipo: body.tipo, categoria: body.categoria, data_fato: body.data_fato, data_aplicacao: aplic, descricao,
    dias_suspensao: dias, suspensao_inicio: ini, suspensao_fim: fim, multa_id: multaId, texto: txt, ciencia, testemunhas: [], status: 'vigente',
    aplicado_por: usuarioId || null, aplicado_por_nome: usuarioNome || null, historico: [{ em, acao: 'aplicada', por: usuarioNome || null }] };
  if (ciencia === 'assinada') {
    if (!pngOk(body.ciencia_png)) return { status: 400, erro: 'Falta a assinatura do colaborador' };
    Object.assign(reg, { ciencia_png: body.ciencia_png, ciencia_em: em, ciencia_hash: crypto.createHash('sha256').update(JSON.stringify({ c: String(c.id), txt, em }) + body.ciencia_png).digest('hex') });
  }
  if (ciencia === 'recusa') {
    const v = validarTestemunhas(body.testemunhas, c, txt, em); if (v.erro) return { status: 400, erro: v.erro };
    reg.testemunhas = v.testemunhas;
    reg.ciencia_em = em;
  }
  if (ciencia === 'papel') reg.ciencia_em = em;
  const { data, error } = await supabase.from('medidas_disciplinares').insert([reg]).select();
  if (error) { if (/ciencia_check/.test(error.message)) return { status: 409, erro: 'Rode a migration 038 antes (ciência pendente / no papel)' }; throw new Error(error.message); }
  let m = data[0];
  if (body.arquivo_base64) {
    const msg = D.validarArquivo({ base64: body.arquivo_base64, mime: body.arquivo_mime });
    if (msg && ciencia === 'papel') { await supabase.from('medidas_disciplinares').delete().eq('id', m.id).eq('tenant_id', tenantId); return { status: 400, erro: msg }; }
    if (!msg) {
      const path = `tenant-${tenantId}/disc-${m.id}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${D.MIME_OK[body.arquivo_mime]}`;
      const up = await supabase.storage.from(D.BUCKET).upload(path, Buffer.from(String(body.arquivo_base64), 'base64'), { contentType: body.arquivo_mime, upsert: false });
      if (!up.error) { const r = await supabase.from('medidas_disciplinares').update({ arquivo_path: path, arquivo_nome: texto(body.arquivo_nome, 200) || 'anexo', arquivo_mime: body.arquivo_mime }).eq('id', m.id).eq('tenant_id', tenantId).select(); if (!r.error) m = r.data[0]; }
    }
  }
  return { medida: limpa(m) };
}

/** 12h.1: colhe a ciência de uma medida pendente. body: { ciencia: 'assinada'|'recusa'|'papel'|'verbal', ciencia_png, testemunhas, data_aplicacao, arquivo_* } */
async function colherCiencia(supabase, tenantId, { usuarioNome }, id, body = {}) {
  const m = /^\d+$/.test(String(id)) ? (await q(supabase.from('medidas_disciplinares').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] : null;
  if (!m) return { status: 404, erro: 'Medida não encontrada' };
  if (m.status !== 'vigente' || m.ciencia !== 'pendente') return { status: 400, erro: 'Esta medida não está aguardando ciência' };
  const ciencia = ['assinada', 'recusa', 'papel', 'verbal'].includes(body.ciencia) ? body.ciencia : null;
  if (!ciencia) return { status: 400, erro: 'Como foi a ciência?' };
  if (ciencia === 'verbal' && m.tipo !== 'orientacao') return { status: 400, erro: 'Só a orientação pode ser registrada sem assinatura' };
  const aplic = DATA.test(String(body.data_aplicacao || '')) ? body.data_aplicacao : hojeBR();
  if (aplic > hojeBR() || aplic < String(m.data_fato).slice(0, 10)) return { status: 400, erro: 'Data da ciência inválida' };
  const em = new Date().toISOString();
  const upd = { ciencia, ciencia_em: em, data_aplicacao: aplic, historico: [...(m.historico || []), { em, acao: `ciência: ${ciencia}`, por: usuarioNome || null }] };
  if (ciencia === 'assinada') {
    if (!pngOk(body.ciencia_png)) return { status: 400, erro: 'Falta a assinatura do colaborador' };
    Object.assign(upd, { ciencia_png: body.ciencia_png, ciencia_hash: crypto.createHash('sha256').update(JSON.stringify({ c: String(m.colaborador_id), txt: m.texto, em }) + body.ciencia_png).digest('hex') });
  }
  if (ciencia === 'recusa') {
    const col = (await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId).eq('id', m.colaborador_id)))[0] || { id: m.colaborador_id, nome: m.colaborador_nome };
    const v = validarTestemunhas(body.testemunhas, col, m.texto, em); if (v.erro) return { status: 400, erro: v.erro };
    upd.testemunhas = v.testemunhas;
  }
  if (ciencia === 'papel') {
    if (!body.arquivo_base64) return { status: 400, erro: 'Anexe o documento assinado (foto ou PDF)' };
    const msg = D.validarArquivo({ base64: body.arquivo_base64, mime: body.arquivo_mime }); if (msg) return { status: 400, erro: msg };
    const path = `tenant-${tenantId}/disc-${m.id}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${D.MIME_OK[body.arquivo_mime]}`;
    const up = await supabase.storage.from(D.BUCKET).upload(path, Buffer.from(String(body.arquivo_base64), 'base64'), { contentType: body.arquivo_mime, upsert: false });
    if (up.error) throw new Error(`Falha ao subir o anexo: ${up.error.message}`);
    if (m.arquivo_path) await D.removerArquivo(supabase, m.arquivo_path);
    Object.assign(upd, { arquivo_path: path, arquivo_nome: texto(body.arquivo_nome, 200) || 'documento-assinado', arquivo_mime: body.arquivo_mime });
  }
  const { data, error } = await supabase.from('medidas_disciplinares').update(upd).eq('id', m.id).eq('tenant_id', tenantId).eq('ciencia', 'pendente').select();
  if (error) throw new Error(error.message);
  if (!data?.length) return { status: 409, erro: 'A ciência já foi registrada — recarregue' };
  return { medida: limpa(data[0]) };
}

async function cancelar(supabase, tenantId, { usuarioNome }, id, motivo) {
  const m = /^\d+$/.test(String(id)) ? (await q(supabase.from('medidas_disciplinares').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] : null;
  if (!m) return { status: 404, erro: 'Medida não encontrada' };
  if (m.status === 'cancelada') return { status: 400, erro: 'Já cancelada' };
  const mot = texto(motivo, 300); if (!mot) return { status: 400, erro: 'Informe o motivo do cancelamento' };
  const { data, error } = await supabase.from('medidas_disciplinares').update({ status: 'cancelada', cancelamento_motivo: mot, historico: [...(m.historico || []), { em: new Date().toISOString(), acao: 'cancelada', por: usuarioNome || null, obs: mot }] }).eq('id', m.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return { medida: limpa(data[0]) };
}

/** Documento para imprimir (com assinaturas) */
async function documento(supabase, tenantId, id) {
  const m = /^\d+$/.test(String(id)) ? (await q(supabase.from('medidas_disciplinares').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] : null;
  if (!m) return { status: 404, erro: 'Medida não encontrada' };
  const emp = (await q(supabase.from('tenants').select('*').eq('id', tenantId)))[0] || {};
  const col = (await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId).eq('id', m.colaborador_id)))[0] || {};
  return { empresa: { nome: emp.nome_fantasia || emp.nome || emp.razao_social || 'Empresa', razao_social: emp.razao_social || emp.nome || null, cnpj: emp.cnpj || null },
    colaborador: { nome: m.colaborador_nome, cpf: col.cpf || null, funcao: col.funcao || null },
    medida: { ...m, tipo_nome: nomeTipo(m.tipo), categoria_nome: (CATEGORIAS.find((c) => c.codigo === m.categoria) || {}).nome || m.categoria }, gerado_em: new Date().toISOString() };
}

async function linkArquivo(supabase, tenantId, id) {
  const m = /^\d+$/.test(String(id)) ? (await q(supabase.from('medidas_disciplinares').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] : null;
  if (!m?.arquivo_path) return { status: 404, erro: 'Sem anexo' };
  return { url: await D.linkArquivo(supabase, m.arquivo_path), nome: m.arquivo_nome };
}

module.exports = { TIPOS, CATEGORIAS, montarTexto, sugerirProxima, resumoColaborador, listar, previa, criar, colherCiencia, cancelar, documento, linkArquivo };
