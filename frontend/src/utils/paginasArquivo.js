// utils/paginasArquivo.js — etapa 18zz.13: 📎 documento da EMPRESA (PDF/imagem) mostrado e impresso como é
//   PDF → cada página vira imagem aqui no navegador (pdf.js, carregado só quando precisa) — funciona igual no celular.
//   Imagem → ela mesma. Máx. 40 páginas (acima disso, avisa e mostra as primeiras).
export const MAX_PAGINAS = 40;
const ehPdf = (mime, nome) => mime === "application/pdf" || /\.pdf($|\?)/i.test(nome || "");

export async function paginasDoArquivo(url, { mime = "", nome = "", largura = 1400 } = {}) {
  if (!url) return { paginas: [], total: 0 };
  if (!ehPdf(mime, nome || url)) return { paginas: [url], total: 1 };
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const pdf = await pdfjs.getDocument({ url }).promise;
  const total = pdf.numPages; const paginas = [];
  for (let i = 1; i <= Math.min(total, MAX_PAGINAS); i++) {
    const pg = await pdf.getPage(i); const v1 = pg.getViewport({ scale: 1 });
    const vp = pg.getViewport({ scale: Math.min(3, largura / v1.width) });
    const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
    paginas.push(c.toDataURL("image/jpeg", 0.9));
  }
  return { paginas, total };
}

/** o documento é "da empresa" quando não tem texto no sistema e tem arquivo */
export const soArquivo = (conteudo, url) => !String(conteudo || "").trim() && !!url;
