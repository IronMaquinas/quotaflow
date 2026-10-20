// components/shared/AssinaturaTela.jsx — etapa 12d.2
// Quadro para assinar com o dedo (celular/tablet) ou o mouse. "Limpar e refazer" apaga.
// onChange(dataUrlPng | null) — null enquanto estiver vazio.
import { useRef, useEffect, useState } from "react";

export default function AssinaturaTela({ C, s, onChange, altura = 180 }) {
  const ref = useRef(null);
  const desenhando = useRef(false);
  const ultimo = useRef(null);
  const [vazio, setVazio] = useState(true);

  // ajusta o tamanho real do canvas à largura da tela (nítido em celular)
  useEffect(() => {
    const cv = ref.current; if (!cv || !cv.getContext) return;
    const ajustar = () => {
      const r = cv.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
      const w = Math.max(280, Math.round(r.width || 560));
      cv.width = w * dpr; cv.height = altura * dpr;
      const ctx = cv.getContext("2d"); if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, altura);
      ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    };
    ajustar();
  }, [altura]);

  const ponto = (e) => { const r = ref.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const inicio = (e) => {
    const ctx = ref.current?.getContext?.("2d"); if (!ctx) return;
    e.preventDefault(); ref.current.setPointerCapture?.(e.pointerId);
    desenhando.current = true; ultimo.current = ponto(e);
    ctx.beginPath(); ctx.arc(ultimo.current.x, ultimo.current.y, 1, 0, Math.PI * 2); ctx.fillStyle = "#0f172a"; ctx.fill();
  };
  const move = (e) => {
    if (!desenhando.current) return;
    const ctx = ref.current.getContext("2d"); const p = ponto(e);
    ctx.beginPath(); ctx.moveTo(ultimo.current.x, ultimo.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ultimo.current = p;
  };
  const fim = () => {
    if (!desenhando.current) return;
    desenhando.current = false;
    setVazio(false);
    try { onChange?.(ref.current.toDataURL("image/png")); } catch { onChange?.(null); }
  };
  const limpar = () => {
    const cv = ref.current; const ctx = cv?.getContext?.("2d");
    if (ctx) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.restore(); }
    setVazio(true); onChange?.(null);
  };

  return (
    <div>
      <div style={{ position: "relative", border: `2px dashed ${vazio ? C.border : C.success}`, borderRadius: 8, overflow: "hidden", background: "#fff" }}>
        <canvas ref={ref} data-assinatura="1" onPointerDown={inicio} onPointerMove={move} onPointerUp={fim} onPointerLeave={fim} onPointerCancel={fim}
          style={{ display: "block", width: "100%", height: altura, touchAction: "none", cursor: "crosshair" }} />
        {vazio && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13, pointerEvents: "none" }}>✍ Assine aqui com o dedo ou o mouse</div>}
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 34, borderBottom: "1px solid #cbd5e1", pointerEvents: "none" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
        <button type="button" onClick={limpar} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 12px", fontSize: 12, color: C.text }}>↺ Limpar e refazer</button>
      </div>
    </div>
  );
}
