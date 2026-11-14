// components/shared/ImagemZoom.jsx — etapa 18ze: 🔍 imagem com ZOOM no "ver foto" (padrão do QuotaFlow)
//   Computador: rodinha do mouse (aproxima no ponto do cursor) · duplo clique alterna 1× ↔ 2,5× · arrastar com zoom.
//   Celular: pinça com dois dedos · duplo toque alterna · arrastar com um dedo quando há zoom.
//   Botões − / 100% / + no canto. Sem zoom, um clique simples passa adiante (o fundo continua fechando o visualizador);
//   com zoom, o clique é da imagem (não fecha sem querer ao arrastar).
import { useRef, useState, useEffect, useCallback } from "react";

const MIN = 1, MAX = 6;
const lim = (v, a, b) => Math.max(a, Math.min(b, v));

export default function ImagemZoom({ src, alt = "", style = {}, imgStyle = {}, botoes = true }) {
  const caixa = useRef(null);
  const [v, setV] = useState({ k: 1, x: 0, y: 0 });
  const vr = useRef(v); vr.current = v;
  const ponteiros = useRef(new Map()); const gesto = useRef(null); const moveu = useRef(false); const ultimoToque = useRef(0);
  useEffect(() => { setV({ k: 1, x: 0, y: 0 }); }, [src]);

  // zoom mantendo fixo o ponto (cx, cy) relativo ao centro da caixa
  const zoomEm = useCallback((k2, cx = 0, cy = 0) => {
    setV((a) => { const k = lim(k2, MIN, MAX); if (k === 1) return { k: 1, x: 0, y: 0 }; const f = k / a.k; return { k, x: cx - (cx - a.x) * f, y: cy - (cy - a.y) * f }; });
  }, []);
  const relCentro = (e) => { const r = caixa.current.getBoundingClientRect(); return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2]; };

  useEffect(() => { // rodinha: listener não-passivo para poder impedir a rolagem da página
    const el = caixa.current; if (!el) return undefined;
    const roda = (e) => { e.preventDefault(); const [cx, cy] = relCentro(e); zoomEm(vr.current.k * (e.deltaY < 0 ? 1.2 : 1 / 1.2), cx, cy); };
    el.addEventListener("wheel", roda, { passive: false }); return () => el.removeEventListener("wheel", roda);
  }, [zoomEm]);

  const alternar = (e) => { const [cx, cy] = relCentro(e); if (vr.current.k > 1) setV({ k: 1, x: 0, y: 0 }); else zoomEm(2.5, cx, cy); };
  const down = (e) => {
    try { caixa.current.setPointerCapture?.(e.pointerId); } catch { /* sem captura: segue */ } ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); moveu.current = false;
    const ps = [...ponteiros.current.values()];
    if (ps.length === 2) gesto.current = { tipo: "pinca", d0: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), k0: vr.current.k };
    else gesto.current = { tipo: "arrasto", x0: e.clientX, y0: e.clientY, vx: vr.current.x, vy: vr.current.y };
  };
  const move = (e) => {
    if (!ponteiros.current.has(e.pointerId)) return; ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesto.current; if (!g) return; const ps = [...ponteiros.current.values()];
    if (g.tipo === "pinca" && ps.length >= 2) {
      const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y); const r = caixa.current.getBoundingClientRect();
      const cx = (ps[0].x + ps[1].x) / 2 - r.left - r.width / 2; const cy = (ps[0].y + ps[1].y) / 2 - r.top - r.height / 2;
      zoomEm(g.k0 * (d / (g.d0 || 1)), cx, cy); moveu.current = true;
    } else if (g.tipo === "arrasto" && vr.current.k > 1) {
      const dx = e.clientX - g.x0, dy = e.clientY - g.y0; if (Math.abs(dx) + Math.abs(dy) > 3) moveu.current = true;
      setV((a) => ({ ...a, x: g.vx + dx, y: g.vy + dy }));
    }
  };
  const up = (e) => {
    ponteiros.current.delete(e.pointerId);
    if (e.pointerType === "touch" && !moveu.current && ponteiros.current.size === 0) { // duplo toque
      const agora = Date.now(); if (agora - ultimoToque.current < 300) { alternar(e); ultimoToque.current = 0; moveu.current = true; } else ultimoToque.current = agora;
    }
    const ps = [...ponteiros.current.values()];
    gesto.current = ps.length === 1 ? { tipo: "arrasto", x0: ps[0].x, y0: ps[0].y, vx: vr.current.x, vy: vr.current.y } : null;
  };
  const clique = (e) => { if (vr.current.k > 1 || moveu.current) e.stopPropagation(); };
  const bt = { width: 38, height: 38, borderRadius: 19, border: "none", background: "#000000aa", color: "#fff", fontSize: 18, cursor: "pointer", lineHeight: 1 };

  return <div ref={caixa} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={clique}
    onDoubleClick={(e) => { if (e.pointerType !== "touch") { e.stopPropagation(); alternar(e); } }}
    style={{ position: "relative", overflow: "hidden", touchAction: "none", display: "flex", alignItems: "center", justifyContent: "center", userSelect: "none", cursor: v.k > 1 ? "grab" : "zoom-in", width: "100%", height: "100%", ...style }}>
    <img src={src} alt={alt} draggable={false} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", transform: `translate(${v.x}px, ${v.y}px) scale(${v.k})`, transformOrigin: "center center", transition: gesto.current ? "none" : "transform 0.12s ease-out", ...imgStyle }} />
    {botoes && <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} style={{ position: "absolute", right: 10, bottom: 10, display: "flex", gap: 6, alignItems: "center" }}>
      <button type="button" aria-label="Diminuir zoom" onClick={() => zoomEm(v.k / 1.5)} style={bt}>−</button>
      <button type="button" aria-label="Tamanho original" onClick={() => setV({ k: 1, x: 0, y: 0 })} style={{ ...bt, width: "auto", padding: "0 12px", fontSize: 13 }}>{Math.round(v.k * 100)}%</button>
      <button type="button" aria-label="Aumentar zoom" onClick={() => zoomEm(v.k * 1.5)} style={bt}>+</button>
    </div>}
  </div>;
}
