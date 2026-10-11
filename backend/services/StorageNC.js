// backend/services/StorageNC.js
//
// M4.5: camada de Storage pro módulo de Não Conformidades. Anexos (fotos
// e PDFs) vão pro Supabase Storage em bucket PRIVADO `nc-evidencias`,
// organizados por `tenant-{id}/nc-{id}/evidencia-NN.ext`.
//
// Acesso SEMPRE via signed URL — o front nunca vê URL pública. O backend
// gera o link temporário (1h) quando o usuário logado abre a NC.
//
// Anexos antigos (gravados como `data:image/...` inline no Postgres)
// continuam funcionando: o front detecta `data:` e renderiza direto,
// sem passar por aqui. Migração desses fica pra M4.x separado.

const { supabase } = require('../db');

const BUCKET = 'nc-evidencias';
const SIGNED_URL_TTL_SEGUNDOS = 60 * 60; // 1 hora

// Extensão a partir do mime type. Aceita só o que o front pode mandar
// hoje (imagem + PDF). Qualquer coisa fora disso é rejeitada no upload.
const EXT_POR_MIME = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

// Extensão a partir do nome do arquivo (fallback quando não tem mime).
function extDoNome(nome) {
  const m = /\.([a-z0-9]+)$/i.exec(nome || '');
  return m ? m[1].toLowerCase() : null;
}

/**
 * Sobe um buffer pro bucket e devolve o path relativo.
 *
 * @param {Object} opts
 * @param {number} opts.tenantId
 * @param {number} opts.ncId
 * @param {number} opts.indice        posição do anexo (1-based) → evidencia-01, 02...
 * @param {string} opts.mimeType      ex: 'image/jpeg' | 'application/pdf'
 * @param {Buffer} opts.buffer        conteúdo binário
 * @param {string} [opts.nomeOriginal] pra inferir extensão quando mime é vazio
 * @returns {Promise<{ path: string, mimeType: string, tamanhoBytes: number }>}
 */
async function subirAnexoNC({ tenantId, ncId, indice, mimeType, buffer, nomeOriginal }) {
  if (!tenantId || !ncId || !indice) {
    throw new Error('subirAnexoNC: tenantId, ncId e indice são obrigatórios');
  }
  if (!buffer || !buffer.length) {
    throw new Error('subirAnexoNC: buffer vazio');
  }

  const ext = EXT_POR_MIME[mimeType] || extDoNome(nomeOriginal) || 'bin';
  if (!EXT_POR_MIME[mimeType] && ext === 'bin') {
    throw new Error(`Tipo de arquivo não suportado (mime=${mimeType || '—'})`);
  }

  const numero = String(indice).padStart(2, '0');
  const path = `tenant-${tenantId}/nc-${ncId}/evidencia-${numero}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: mimeType || 'application/octet-stream',
      upsert: true, // se reenviar com mesmo índice, sobrescreve
    });

  if (error) {
    throw new Error(`Falha ao subir anexo: ${error.message}`);
  }

  return { path, mimeType: mimeType || 'application/octet-stream', tamanhoBytes: buffer.length };
}

/**
 * Gera signed URL temporária pra um path. Retorna null se falhar
 * (best-effort — quem chama trata o fallback).
 */
async function gerarSignedUrl(path) {
  if (!path) return null;
  // Data URI antigo: não é do Storage, devolve como está.
  if (typeof path === 'string' && path.startsWith('data:')) return path;

  try {
    // M4.5-fix: passa `download: false` explicitamente. Sem isso, o
    // Supabase emite o token com `scope: "download"` (default), e o
    // gateway dele serve o arquivo com `Content-Disposition: attachment`
    // — o navegador baixa em vez de abrir. Com `false`, o scope vira
    // inline e o PDF abre numa aba nova (Ctrl+W fecha sem baixar).
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SEGUNDOS, { download: false });
    if (error) {
      console.warn(`⚠ Falha ao gerar signed URL (${path}):`, error.message);
      return null;
    }
    return data?.signedUrl || null;
  } catch (e) {
    console.warn(`⚠ Exceção ao gerar signed URL (${path}):`, e.message);
    return null;
  }
}

/**
 * Gera signed URLs em batch (Promise.all). Recebe lista de paths,
 * devolve mapa path → url. Entradas que falharem ficam com null.
 */
async function gerarSignedUrlsEmBatch(paths) {
  const unicos = Array.from(new Set((paths || []).filter(Boolean)));
  const resultados = await Promise.all(
    unicos.map(async (p) => [p, await gerarSignedUrl(p)])
  );
  return Object.fromEntries(resultados);
}

/**
 * Remove um anexo do bucket. Best-effort — não joga se falhar (o
 * registro no banco será removido mesmo assim).
 */
async function removerAnexoNC(path) {
  if (!path) return;
  if (typeof path === 'string' && path.startsWith('data:')) return; // data URI, nada a fazer

  try {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) {
      console.warn(`⚠ Falha ao remover anexo (${path}):`, error.message);
    }
  } catch (e) {
    console.warn(`⚠ Exceção ao remover anexo (${path}):`, e.message);
  }
}

module.exports = {
  BUCKET,
  SIGNED_URL_TTL_SEGUNDOS,
  subirAnexoNC,
  gerarSignedUrl,
  gerarSignedUrlsEmBatch,
  removerAnexoNC,
};