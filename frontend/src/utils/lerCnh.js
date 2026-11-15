// utils/lerCnh.js — etapa 18zl: 🪪 prepara a CNH para a leitura pela IA e recorta a foto do titular
//   PDF (CNH digital do gov.br) → 1ª página vira imagem aqui no navegador (pdf.js, carregado só quando precisa).
//   Imagem → reduzida para no máx. 1600 px (menos tokens = leitura mais barata) em JPG.
const MAX = 1600;
const lerArquivo = (f) => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => erro(new Error("Não consegui abrir o arquivo")); r.readAsDataURL(f); });
const carregarImg = (src) => new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error("Imagem inválida")); i.src = src; });
const paraJpeg = (canvas, q = 0.88) => canvas.toDataURL("image/jpeg", q);

async function pdfParaCanvas(file) {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pg = await pdf.getPage(1); const v1 = pg.getViewport({ scale: 1 });
  const vp = pg.getViewport({ scale: Math.min(3, MAX / Math.max(v1.width, v1.height)) });
  const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  await pg.render({ canvasContext: ctx, viewport: vp }).promise; return c;
}

/** File (PDF ou imagem) → { dataUrl, base64, mime: 'image/jpeg', largura, altura } */
export async function cnhParaImagem(file) {
  let c;
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name || "")) c = await pdfParaCanvas(file);
  else {
    const im = await carregarImg(await lerArquivo(file)); const k = Math.min(1, MAX / Math.max(im.width, im.height));
    c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(im, 0, 0, c.width, c.height);
  }
  const dataUrl = paraJpeg(c); return { dataUrl, base64: dataUrl.split(",")[1], mime: "image/jpeg", largura: c.width, altura: c.height };
}

/** recorta o rosto (frações 0–1 da imagem, com folga) → { dataUrl, base64, mime } (até 480 px) */
export async function recortarFoto(dataUrl, f) {
  const im = await carregarImg(dataUrl); const folga = 0.12;
  let x = (f.x - f.largura * folga) * im.width, y = (f.y - f.altura * folga) * im.height;
  let w = f.largura * (1 + 2 * folga) * im.width, h = f.altura * (1 + 2 * folga) * im.height;
  x = Math.max(0, x); y = Math.max(0, y); w = Math.min(im.width - x, w); h = Math.min(im.height - y, h);
  const k = Math.min(1, 480 / Math.max(w, h)); const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  c.getContext("2d").drawImage(im, x, y, w, h, 0, 0, c.width, c.height);
  const u = paraJpeg(c, 0.9); return { dataUrl: u, base64: u.split(",")[1], mime: "image/jpeg" };
}

/** arquivo original para anexar no documento CNH: { base64, mime, nome } */
export async function arquivoOriginal(file) {
  const u = await lerArquivo(file); return { base64: String(u).split(",")[1], mime: file.type || "application/pdf", nome: file.name || "CNH" };
}
