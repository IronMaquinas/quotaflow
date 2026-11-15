// components/pessoas/AjustarFoto.jsx — etapa 18zn: ✂ ajustar o recorte da foto (CNH ou foto enviada)
//   Moldura 3×4 sobre a imagem inteira: arrastar move · alça no canto (ou − / +) muda o tamanho · régua "Endireitar" gira
//   (−15° a +15°) para tirar a foto do "fora de esquadro". Prévia ao vivo. Funciona com mouse e dedo.
import { useEffect, useRef, useState } from "react";

const PROP = 4 / 3; // altura / largura (foto 3×4)
const lim = (v, a, b) => Math.max(a, Math.min(b, v));

/** recorta com rotação: caixa em px da imagem (centro cx, cy; largura w) e ângulo em graus → JPG 360×480 */
export function recortar(img, { cx, cy, w, ang }) {
  const W = 360, H = 480; const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  ctx.translate(W / 2, H / 2); ctx.scale(W / w, W / w); ctx.rotate((ang * Math.PI) / 180); ctx.drawImage(img, -cx, -cy);
  const u = c.toDataURL("image/jpeg", 0.9); return { dataUrl: u, base64: u.split(",")[1], mime: "image/jpeg" };
}

export default function AjustarFoto({ C, s, src, inicial = null, onPronto, onCancelar }) {
  const [img, setImg] = useState(null); const [cx, setCx] = useState(0); const [cy, setCy] = useState(0); const [w, setW] = useState(100); const [ang, setAng] = useState(0);
  const area = useRef(null); const arr = useRef(null); const [esc, setEsc] = useState(1); const prev = useRef(null);
  useEffect(() => { const i = new Image(); i.onload = () => {
    setImg(i); const f = inicial || { x: 0.3, y: 0.15, largura: 0.4, altura: 0.4 * PROP * i.width / i.height };
    const ww = Math.max(40, f.largura * i.width); setW(ww); setCx((f.x + f.largura / 2) * i.width); setCy((f.y + f.altura / 2) * i.height);
  }; i.src = src; }, [src]); // eslint-disable-line
  useEffect(() => { if (!img || !area.current) return; const r = () => setEsc(Math.min(area.current.clientWidth / img.width, (window.innerHeight * 0.55) / img.height)); r(); window.addEventListener("resize", r); return () => window.removeEventListener("resize", r); }, [img]);
  useEffect(() => { if (img && prev.current) { const r = recortar(img, { cx, cy, w, ang }); prev.current.src = r.dataUrl; } }, [img, cx, cy, w, ang]);
  if (!img) return null;
  const h = w * PROP;
  const down = (modo) => (e) => { e.preventDefault(); e.stopPropagation(); try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* ok */ } arr.current = { modo, x: e.clientX, y: e.clientY, cx, cy, w }; };
  const move = (e) => { const a = arr.current; if (!a) return; const dx = (e.clientX - a.x) / esc, dy = (e.clientY - a.y) / esc;
    if (a.modo === "mover") { setCx(lim(a.cx + dx, 0, img.width)); setCy(lim(a.cy + dy, 0, img.height)); }
    else { const nw = lim(a.w + Math.max(dx, dy / PROP) * 2, 40, img.width); setW(nw); } };
  const up = () => { arr.current = null; };
  const bt = { ...s.btn(false), padding: "6px 12px", fontSize: 13, cursor: "pointer", color: C.text };
  return <div onClick={(e) => { e.stopPropagation(); onCancelar?.(); }} style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 1450, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
    <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Ajustar foto" style={{ ...s.card, background: C.card || C.surface, width: 760, maxWidth: "100%", maxHeight: "96vh", overflow: "auto", padding: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>✂ Ajustar a foto</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Arraste a moldura sobre o rosto · puxe o canto (ou − / +) para o tamanho · use "Endireitar" se a foto estiver torta.</div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div ref={area} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ flex: "1 1 360px", position: "relative", touchAction: "none", userSelect: "none" }}>
          <div style={{ position: "relative", width: img.width * esc, height: img.height * esc, overflow: "hidden", borderRadius: 6 }}>
            <img src={src} alt="" draggable={false} style={{ width: "100%", height: "100%", display: "block", borderRadius: 6 }} />
            <div onPointerDown={down("mover")} style={{ position: "absolute", left: (cx - w / 2) * esc, top: (cy - h / 2) * esc, width: w * esc, height: h * esc, border: "2px solid #fff", boxShadow: "0 0 0 9999px #00000088", cursor: "move", transform: `rotate(${-ang}deg)`, boxSizing: "border-box" }}>
              <div onPointerDown={down("tamanho")} style={{ position: "absolute", right: -9, bottom: -9, width: 18, height: 18, borderRadius: 9, background: "#fff", border: `2px solid ${C.accent}`, cursor: "nwse-resize" }} />
            </div>
          </div>
        </div>
        <div style={{ flex: "0 0 150px", display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          <img ref={prev} alt="Prévia" style={{ width: 120, height: 160, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff" }} />
          <div style={{ display: "flex", gap: 6 }}><button type="button" onClick={() => setW((v) => lim(v * 1.1, 40, img.width))} style={bt} aria-label="Afastar (moldura maior)">−</button><button type="button" onClick={() => setW((v) => lim(v / 1.1, 40, img.width))} style={bt} aria-label="Aproximar (moldura menor)">+</button></div>
          <label style={{ fontSize: 11, color: C.muted, width: "100%" }}>ENDIREITAR {ang > 0 ? "+" : ""}{ang}°
            <input type="range" min={-15} max={15} step={0.5} value={ang} onChange={(e) => setAng(Number(e.target.value))} style={{ width: "100%" }} /></label>
          {ang !== 0 && <button type="button" onClick={() => setAng(0)} style={{ background: "none", border: "none", color: C.accent, fontSize: 12, cursor: "pointer" }}>zerar giro</button>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
        <button type="button" onClick={onCancelar} style={bt}>Cancelar</button>
        <button type="button" onClick={() => onPronto(recortar(img, { cx, cy, w, ang }))} style={{ ...s.btn(true), padding: "6px 16px", fontSize: 13, cursor: "pointer" }}>Usar esta foto</button>
      </div>
    </div>
  </div>;
}
