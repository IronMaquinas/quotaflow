// utils/cartaoFoto.js — etapa E1: 📸 desenho do CARTÃO gravado na foto (o mesmo desenho na prévia da câmera, no editor e na foto final)
//   Cabeçalho: logo + nome da empresa · título · código/revisão. Caixas de destaque (ex.: Pá, Defeito nº) · grade de 2 colunas (rótulo | valor)
//   · observações · rodapé automático: técnico · data/hora · GPS · ID. Fundo branco levemente translúcido; valores em azul (como a caneta).
//   Medidas em "u" = largura/400 → o cartão fica igual em qualquer tamanho.
const AZUL = "#1d4ed8";
const pad = (n) => String(n).padStart(2, "0");
export const quandoBR = (d) => { const x = new Date(d); return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()} ${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())}`; };
export const gpsTxt = (g) => (g && Number.isFinite(g.lat) ? `${g.lat.toFixed(6)}, ${g.lng.toFixed(6)}${g.precisao ? ` ±${Math.round(g.precisao)} m` : ""}` : "GPS indisponível");

function linhas(modelo) { // agrupa os campos em linhas de 2 colunas (largura 2 = linha inteira)
  const dest = []; const grade = []; let atual = [];
  for (const c of modelo?.campos || []) {
    if (c.destaque) { dest.push(c); continue; }
    if (c.largura === 2) { if (atual.length) grade.push(atual); grade.push([c]); atual = []; continue; }
    atual.push(c); if (atual.length === 2) { grade.push(atual); atual = []; }
  }
  if (atual.length) grade.push(atual);
  const lDest = []; for (let i = 0; i < dest.length; i += 2) lDest.push(dest.slice(i, i + 2));
  return { lDest, grade };
}
function corta(ctx, t, max) { let s = String(t ?? ""); if (ctx.measureText(s).width <= max) return s; while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1); return `${s}…`; }
function quebra(ctx, t, max, nMax) { const out = []; let lin = ""; for (const w of String(t || "").split(/\s+/)) { const tt = lin ? `${lin} ${w}` : w; if (ctx.measureText(tt).width > max && lin) { out.push(lin); lin = w; if (out.length === nMax) break; } else lin = tt; } if (lin && out.length < nMax) out.push(lin); return out; }

export function alturaCartao(modelo, w) {
  const u = w / 400; const { lDest, grade } = linhas(modelo);
  return u * (54 + lDest.length * 52 + grade.length * 26 + (modelo?.obs !== false ? 46 : 0) + 34 + 10);
}

/** desenha e devolve a altura. dados = { modelo, valores, obs, empresa, logo (HTMLImageElement|null), tecnico, quando, gps, id } */
export function desenharCartao(ctx, x, y, w, dados = {}) {
  const { modelo = {}, valores = {}, obs = "", empresa = "", logo = null, tecnico = "", quando = Date.now(), gps = null, id = "", projeto = "" } = dados;
  const u = w / 400; const h = alturaCartao(modelo, w); const { lDest, grade } = linhas(modelo); const P = 8 * u; const iw = w - 2 * P;
  const fonte = (px, peso = 400) => `${peso} ${px * u}px Arial, Helvetica, sans-serif`;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.93)"; ctx.strokeStyle = "#111"; ctx.lineWidth = Math.max(1, 1.2 * u);
  const r = 6 * u; ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.textBaseline = "middle"; let cy = y + P;
  // cabeçalho
  const hc = 38 * u; let tx = x + P;
  if (logo && logo.naturalWidth) { const lh = hc - 6 * u; const lw = Math.min(90 * u, (logo.naturalWidth / logo.naturalHeight) * lh); ctx.drawImage(logo, x + P, cy + 3 * u, lw, lh); tx = x + P + lw + 6 * u; }
  else if (empresa) { ctx.fillStyle = "#111"; ctx.font = fonte(9, 700); ctx.textAlign = "left"; ctx.fillText(corta(ctx, empresa, 90 * u), x + P, cy + hc / 2); tx = x + P + 96 * u; }
  const dir = modelo.codigo || modelo.revisao ? 78 * u : 0;
  ctx.fillStyle = "#111"; ctx.font = fonte(13, 700); ctx.textAlign = "center"; ctx.fillText(corta(ctx, modelo.titulo || "", x + w - P - dir - tx), (tx + x + w - P - dir) / 2, cy + hc / 2);
  if (dir) { ctx.font = fonte(7.5); ctx.textAlign = "right"; if (modelo.codigo) ctx.fillText(corta(ctx, modelo.codigo, dir), x + w - P, cy + hc / 2 - 6 * u); if (modelo.revisao) ctx.fillText(`Rev.: ${modelo.revisao}`, x + w - P, cy + hc / 2 + 6 * u); }
  cy += hc + 6 * u;
  const val = (c) => { const v = valores?.[c.id]; return v == null || v === "" ? "" : `${v}${c.unidade ? ` ${c.unidade}` : ""}`; };
  // destaques (caixas grandes)
  for (const lin of lDest) {
    const cw = (iw - 8 * u) / 2;
    lin.forEach((c, i) => { const bx = x + P + i * (cw + 8 * u); ctx.strokeRect(bx, cy, cw, 44 * u); ctx.fillStyle = "#111"; ctx.font = fonte(8); ctx.textAlign = "left"; ctx.fillText(corta(ctx, `${c.rotulo}:`, cw - 8 * u), bx + 4 * u, cy + 8 * u);
      ctx.fillStyle = AZUL; ctx.font = fonte(22, 700); ctx.textAlign = "center"; ctx.fillText(corta(ctx, val(c), cw - 10 * u), bx + cw / 2, cy + 28 * u); });
    cy += 52 * u;
  }
  // grade
  for (const lin of grade) {
    const cols = lin.length === 1 && lin[0].largura === 2 ? [iw] : [iw / 2, iw / 2];
    let bx = x + P;
    lin.forEach((c, i) => { const cw = cols[i] ?? iw / 2; const lw = Math.min(cw * 0.48, cols.length === 1 ? iw * 0.24 : cw * 0.48);
      ctx.strokeRect(bx, cy, lw, 26 * u); ctx.strokeRect(bx + lw, cy, cw - lw, 26 * u);
      ctx.fillStyle = "#111"; ctx.font = fonte(8.5); ctx.textAlign = "right"; ctx.fillText(corta(ctx, `${c.rotulo}:`, lw - 6 * u), bx + lw - 4 * u, cy + 13 * u);
      ctx.fillStyle = AZUL; ctx.font = fonte(12, 700); ctx.textAlign = "left"; ctx.fillText(corta(ctx, val(c), cw - lw - 8 * u), bx + lw + 5 * u, cy + 13 * u); bx += cw; });
    cy += 26 * u;
  }
  // observações
  if (modelo.obs !== false) { cy += 4 * u; ctx.strokeRect(x + P, cy, iw, 40 * u); ctx.fillStyle = "#111"; ctx.font = fonte(8); ctx.textAlign = "left"; ctx.fillText("OBS.:", x + P + 4 * u, cy + 7 * u);
    ctx.fillStyle = AZUL; ctx.font = fonte(10, 700); quebra(ctx, obs, iw - 50 * u, 3).forEach((l, i) => ctx.fillText(l, x + P + 34 * u, cy + 8 * u + i * 12 * u)); cy += 42 * u; }
  // rodapé automático
  ctx.fillStyle = "#111"; ctx.font = fonte(7.5, 700); ctx.textAlign = "left";
  ctx.fillText(corta(ctx, `👷 ${tecnico || "—"}   🕒 ${quandoBR(quando)}${projeto ? `   📁 ${projeto}` : ""}`, iw), x + P, cy + 9 * u);
  ctx.font = fonte(7.5); ctx.fillText(corta(ctx, `📍 ${gpsTxt(gps)}${id ? `   ID ${id}` : ""}   · QuotaFlow`, iw), x + P, cy + 21 * u);
  ctx.restore();
  return h;
}

/** carrega a logo (data URL) num <img> pronto para o canvas */
export function carregarImagem(src) { return new Promise((ok) => { if (!src) return ok(null); const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; }); }
