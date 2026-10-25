// utils/comprimirImagem.js — etapa 14c.1
// Compressor INTERNO de imagem, no navegador, antes de enviar (o usuário nunca precisa de site externo).
// Foto de celular (4–12 MB) vira JPEG de ~150–400 KB: lado maior até 1600 px, qualidade 0,75 — legível para documento,
// auto de infração, evidência. PDF e outros arquivos passam direto. Se a compressão falhar (formato que o navegador não
// abre, ex.: HEIC em alguns aparelhos), envia o original (o limite do servidor continua valendo).

const IMAGEM = /^image\/(jpeg|png|webp|heic|heif)$/i;

function carregar(file) {
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error("Não foi possível abrir a imagem")); };
    img.src = url;
  });
}
function temTransparencia(ctx, w, h) {
  try { const d = ctx.getImageData(0, 0, w, h).data; for (let i = 3; i < d.length; i += 4 * 7) if (d[i] < 250) return true; } catch { /* ok */ }
  return false;
}

/**
 * Comprime uma imagem. → { blob, mime, dataUrl, largura, altura }
 * opts: lado (px do lado maior), qualidade (0–1), manterTransparencia (PNG com fundo transparente continua PNG — logo)
 */
export async function comprimirImagem(file, { lado = 1600, qualidade = 0.75, manterTransparencia = false } = {}) {
  const img = await carregar(file);
  const k = Math.min(1, lado / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * k)), h = Math.max(1, Math.round((img.naturalHeight || img.height) * k));
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  let mime = "image/jpeg";
  if (manterTransparencia && /png|webp/i.test(file.type) && temTransparencia(ctx, w, h)) mime = "image/png";
  else { // JPEG não tem transparência: fundo branco
    const fundo = document.createElement("canvas"); fundo.width = w; fundo.height = h;
    const fx = fundo.getContext("2d"); fx.fillStyle = "#ffffff"; fx.fillRect(0, 0, w, h); fx.drawImage(cv, 0, 0);
    ctx.drawImage(fundo, 0, 0);
  }
  const dataUrl = cv.toDataURL(mime, qualidade);
  const blob = await new Promise((ok) => cv.toBlob(ok, mime, qualidade));
  return { blob, mime, dataUrl, largura: w, altura: h };
}

/** Para campos de anexo (PDF ou foto): imagem → File JPEG comprimido; o resto (PDF…) volta igual. */
export async function prepararArquivo(file, opts) {
  if (!file || !IMAGEM.test(file.type || "") || file.size < 350 * 1024) return file || null; // pequena: não mexe
  try {
    const r = await comprimirImagem(file, opts);
    if (!r.blob || r.blob.size >= file.size) return file;
    const nome = String(file.name || "foto").replace(/\.[^.]+$/, "") + (r.mime === "image/png" ? ".png" : ".jpg");
    return new File([r.blob], nome, { type: r.mime, lastModified: Date.now() });
  } catch { return file; }
}
