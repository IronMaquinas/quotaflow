// backend/services/StorageSpot.js
//
// Camada de Storage pras fotos de Demandas Spot. Bucket dedicado
// `demanda-spot`, privado. Organizado por tenant:
//   tenant-{tenantId}/demanda-{numero}/foto.ext
//
// Acesso sempre via signed URL (1h). O front recebe `foto_url` pronta.

const { supabase } = require('../db');

const BUCKET = 'demanda-spot';
const SIGNED_URL_TTL_SEGUNDOS = 60 * 60;

const EXT_POR_MIME = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};

async function subirFotoDemanda({ tenantId, numero, mimeType, buffer }) {
  if (!tenantId || !numero || !buffer?.length) {
    throw new Error('subirFotoDemanda: tenantId, numero e buffer obrigatórios');
  }
  const ext = EXT_POR_MIME[mimeType];
  if (!ext) throw new Error(`Tipo de imagem não suportado: ${mimeType}`);

  const path = `tenant-${tenantId}/demanda-${numero}/foto.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: true });
  if (error) throw new Error(`Falha ao subir foto: ${error.message}`);
  return path;
}

async function gerarSignedUrl(path) {
  if (!path) return null;
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SEGUNDOS, { download: false });
    if (error) {
      console.warn(`⚠ Signed URL (${path}):`, error.message);
      return null;
    }
    return data?.signedUrl || null;
  } catch (e) {
    console.warn(`⚠ Exceção signed URL (${path}):`, e.message);
    return null;
  }
}

async function removerFotoDemanda(path) {
  if (!path) return;
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) console.warn(`⚠ Remover foto (${path}):`, error.message);
  } catch (e) {
    console.warn(`⚠ Exceção remover foto (${path}):`, e.message);
  }
}

module.exports = { BUCKET, subirFotoDemanda, gerarSignedUrl, removerFotoDemanda };