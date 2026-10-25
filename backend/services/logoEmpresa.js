// backend/services/logoEmpresa.js — etapa 14c
//
// Logomarca da EMPRESA (transportadora) para todos os documentos printáveis (inspeção, certificado, lista de presença,
// dossiê, termos, contrato…). Upload em ⚙️ Configurações → 🏢 Empresa (admin, gestor). PNG, JPG ou WEBP até 1 MB, no
// bucket privado "documentos" (tenant-{id}/logo/…). Os documentos recebem a logo já em data URL (base64): a janela de
// impressão não depende de link que expira. Cache em memória por caminho (a logo muda raramente).

const D = require('./documentos');

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const MAX = 1024 * 1024;
const cache = new Map(); // path → dataUrl

async function tenantDe(supabase, tenantId) { return (await q(supabase.from('tenants').select('*').eq('id', tenantId)))[0] || null; }

async function salvar(supabase, tenantId, { base64, mime } = {}) {
  const ext = MIME[mime]; if (!ext) return { status: 400, erro: 'Envie PNG, JPG ou WEBP' };
  const buf = Buffer.from(String(base64 || ''), 'base64');
  if (!buf.length) return { status: 400, erro: 'Imagem vazia' };
  if (buf.length > MAX) return { status: 400, erro: 'Logo de até 1 MB' };
  const t = await tenantDe(supabase, tenantId); if (!t) return { status: 404, erro: 'Empresa não encontrada' };
  const path = `tenant-${tenantId}/logo/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(D.BUCKET).upload(path, buf, { contentType: mime, upsert: true });
  if (error) throw new Error(`Falha ao subir a logo: ${error.message}`);
  const { error: eu } = await supabase.from('tenants').update({ logo_path: path, logo_atualizada_em: new Date().toISOString() }).eq('id', tenantId);
  if (eu) { if (/logo_path|column/.test(eu.message)) return { status: 409, erro: 'Rode a migration 045 antes (logo da empresa)' }; throw new Error(eu.message); }
  if (t.logo_path) { try { await supabase.storage.from(D.BUCKET).remove([t.logo_path]); } catch { /* ok */ } cache.delete(t.logo_path); }
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
  cache.set(path, dataUrl);
  return { ok: true, logo: dataUrl };
}
async function remover(supabase, tenantId) {
  const t = await tenantDe(supabase, tenantId); if (!t) return { status: 404, erro: 'Empresa não encontrada' };
  if (t.logo_path) { try { await supabase.storage.from(D.BUCKET).remove([t.logo_path]); } catch { /* ok */ } cache.delete(t.logo_path); }
  await supabase.from('tenants').update({ logo_path: null, logo_atualizada_em: new Date().toISOString() }).eq('id', tenantId);
  return { ok: true };
}
/** { logo: dataUrl|null, empresa: { nome, razao_social, cnpj } } — sem a 045 ou sem logo: logo null */
async function obter(supabase, tenantId) {
  const t = await tenantDe(supabase, tenantId);
  const empresa = { nome: t?.nome_fantasia || t?.nome || t?.razao_social || null, razao_social: t?.razao_social || t?.nome || null, cnpj: t?.cnpj || null };
  if (!t?.logo_path) return { logo: null, empresa };
  if (cache.has(t.logo_path)) return { logo: cache.get(t.logo_path), empresa };
  try {
    const { data, error } = await supabase.storage.from(D.BUCKET).download(t.logo_path);
    if (error || !data) return { logo: null, empresa };
    const buf = Buffer.from(await data.arrayBuffer());
    const ext = String(t.logo_path).split('.').pop();
    const mime = Object.keys(MIME).find((m) => MIME[m] === ext) || 'image/png';
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
    cache.set(t.logo_path, dataUrl);
    return { logo: dataUrl, empresa };
  } catch { return { logo: null, empresa }; }
}

module.exports = { salvar, remover, obter, MAX };
