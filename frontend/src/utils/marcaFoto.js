// utils/marcaFoto.js — etapa 18c: 📸 MARCA DE RASTREABILIDADE gravada nos pixels da foto
//   18c.1: tarja ABAIXO da foto (a imagem fica inteira) (não é metadado — vai junto em qualquer cópia, PDF ou print):
//     linha 1: QuotaFlow · o quê (inspeção/NC/…) · referência (AT, placa/TAG)
//     linha 2: data e hora da captura · GPS (lat, lng ±m) · quem tirou
//     linha 3 (se for o caso): ⚠ foto antiga / da galeria — tirada em dd/mm hh:mm (o arquivo é mais antigo que a captura)
//   anti-anacronismo: compara a data do arquivo (lastModified) com a hora do envio; mais de 10 min de diferença = aviso na faixa.
const pad = (n) => String(n).padStart(2, "0");
export const dataHoraBR = (d) => { const x = new Date(d); return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()} ${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())}`; };
export const LIMITE_ANTIGA_MS = 10 * 60 * 1000;

/** monta as linhas: { oque, ref, quem, gps:{lat,lng,precisao}, arquivoEm (ms), agora (ms) } */
export function linhasMarca({ oque, ref, quem, gps, arquivoEm, agora = Date.now() } = {}) {
  const l1 = ["QuotaFlow", oque, ref].filter(Boolean).join(" · ");
  const g = gps && Number.isFinite(Number(gps.lat)) ? `GPS ${Number(gps.lat).toFixed(5)}, ${Number(gps.lng).toFixed(5)}${gps.precisao ? ` ±${Math.round(gps.precisao)} m` : ""}` : "sem GPS";
  const l2 = [dataHoraBR(agora), g, quem].filter(Boolean).join(" · ");
  const linhas = [l1, l2];
  const antiga = Number.isFinite(arquivoEm) && arquivoEm > 0 && agora - arquivoEm > LIMITE_ANTIGA_MS;
  if (antiga) linhas.push(`⚠ foto antiga ou da galeria — arquivo de ${dataHoraBR(arquivoEm)}`);
  return { linhas, antiga };
}

// 18c.1: a tarja fica ABAIXO da foto (estilo legenda) — nenhum pixel da imagem é coberto; o canvas cresce a altura da tarja.
const metrica = (w, h, n) => { const fs = Math.max(11, Math.round(Math.min(w, h * 1.4) / 52)); const lh = Math.round(fs * 1.35); const padY = Math.round(fs * 0.55); return { fs, lh, padY, alt: lh * n + padY * 2 }; };
/** altura extra (px) que a tarja vai ocupar abaixo de uma foto w × h */
export const alturaMarca = (w, h, linhas) => (linhas?.length ? metrica(w, h, linhas.length).alt : 0);
/** desenha a tarja logo abaixo da foto: hFoto = altura da foto já desenhada no topo do canvas (canvas com altura hFoto + alturaMarca) */
export function desenharMarca(ctx, w, hFoto, linhas) {
  if (!ctx || !linhas?.length) return;
  const { fs, lh, padY, alt } = metrica(w, hFoto, linhas.length);
  ctx.save();
  ctx.fillStyle = "#111418"; ctx.fillRect(0, hFoto, w, alt);
  ctx.fillStyle = "#2d333b"; ctx.fillRect(0, hFoto, w, Math.max(1, Math.round(fs / 8))); // filete separando da foto
  ctx.font = `600 ${fs}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`; ctx.textBaseline = "top";
  linhas.forEach((t, i) => {
    ctx.fillStyle = /^⚠/.test(t) ? "#fbbf24" : i === 0 ? "#ffffff" : "#cbd5e1";
    let s = String(t); while (s.length > 4 && ctx.measureText(s).width > w - fs) s = s.slice(0, -2); if (s !== String(t)) s = `${s.slice(0, -1)}…`;
    ctx.fillText(s, Math.round(fs * 0.6), hFoto + padY + i * lh);
  });
  ctx.restore();
}

/** GPS do aparelho (rápido; sem permissão ou sem sinal = null) */
export function pegarGps(ms = 4000) {
  return new Promise((ok) => {
    try { if (!navigator.geolocation) return ok(null); const t = setTimeout(() => ok(null), ms);
      navigator.geolocation.getCurrentPosition((p) => { clearTimeout(t); ok({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy }); }, () => { clearTimeout(t); ok(null); }, { enableHighAccuracy: true, maximumAge: 60000, timeout: ms });
    } catch { ok(null); }
  });
}
