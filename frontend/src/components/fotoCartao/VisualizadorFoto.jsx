// components/fotoCartao/VisualizadorFoto.jsx — etapa E2.2: 🖼 visualizador da foto DENTRO do app (sem abrir aba nova)
//   Zoom: roda do mouse, 2 dedos, duplo toque/clique ou botões −/＋ · arrastar para mover · ‹ › anterior/próxima · ⬇ Baixar.
//   🗑 Excluir → confirmação com motivo → LIXEIRA (30 dias para restaurar) · ♻ Restaurar quando aberta pela lixeira.
//   Excluir/restaurar: quem tirou a foto ou a gestão (admin, gestor, qualidade) — o servidor confere de novo.
import { useEffect, useRef, useState } from "react";
import apiService from "../../services/apiService";
import { quandoBR, gpsTxt } from "../../utils/cartaoFoto";

const usuarioLocal = () => { try { return JSON.parse(localStorage.getItem("usuario") || "{}"); } catch { return {}; } };
const Z = 2147483600;

export default function VisualizadorFoto({ lista, inicio = 0, onFechar, onMudou }) {
  const [i, setI] = useState(inicio); const x = lista[i]; const [v, setV] = useState({ z: 1, tx: 0, ty: 0 }); const [info, setInfo] = useState(true);
  const [conf, setConf] = useState(null); const [msg, setMsg] = useState(""); const [ocup, setOcup] = useState(false);
  const toques = useRef(new Map()); const g = useRef(null); const caixa = useRef(null); const ultToque = useRef(0);
  const u = usuarioLocal(); const perfis = Array.isArray(u.perfis) && u.perfis.length ? u.perfis : [u.perfil].filter(Boolean);
  const pode = x && (perfis.some((p) => ["admin", "gestor", "qualidade"].includes(p)) || String(x.usuario_id) === String(u.id));
  useEffect(() => { setV({ z: 1, tx: 0, ty: 0 }); setMsg(""); }, [i]);
  useEffect(() => { const k = (e) => { if (conf) return; if (e.key === "Escape") onFechar(); if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, lista.length - 1)); if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0)); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [conf, lista.length]); // eslint-disable-line
  if (!x) return null;
  const zoomEm = (fator, cx, cy) => setV((o) => { const z = Math.min(8, Math.max(1, o.z * fator)); if (z === 1) return { z: 1, tx: 0, ty: 0 }; const b = caixa.current.getBoundingClientRect(); const px = (cx ?? b.left + b.width / 2) - b.left - b.width / 2; const py = (cy ?? b.top + b.height / 2) - b.top - b.height / 2;
    const k = z / o.z; return { z, tx: px - (px - o.tx) * k, ty: py - (py - o.ty) * k }; });
  const down = (e) => { caixa.current.setPointerCapture?.(e.pointerId); toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); const p = [...toques.current.values()];
    g.current = { v0: v, p0: p.map((q) => ({ ...q })), d0: p.length === 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0 };
    if (p.length === 1) { const t = Date.now(); if (t - ultToque.current < 300) zoomEm(v.z > 1 ? 1 / v.z : 2.5, e.clientX, e.clientY); ultToque.current = t; } };
  const move = (e) => { if (!toques.current.has(e.pointerId) || !g.current) return; toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); const p = [...toques.current.values()]; const G = g.current;
    if (p.length >= 2 && G.d0) { const z = Math.min(8, Math.max(1, G.v0.z * (Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) / G.d0))); setV(z === 1 ? { z: 1, tx: 0, ty: 0 } : { ...G.v0, z }); }
    else if (p.length === 1 && G.v0.z > 1) setV({ ...G.v0, tx: G.v0.tx + p[0].x - G.p0[0].x, ty: G.v0.ty + p[0].y - G.p0[0].y }); };
  const up = (e) => { toques.current.delete(e.pointerId); const p = [...toques.current.values()]; g.current = p.length ? { v0: v, p0: p.map((q) => ({ ...q })), d0: 0 } : null; };
  const baixar = async () => { try { const b = await (await fetch(x.url)).blob(); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `${(x.referencia || x.modelo_nome || "foto").replace(/[^\w.-]+/g, "_")}-${String(x.tirada_em).slice(0, 10)}-${x.id}.jpg`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); } catch { setMsg("⚠ Não consegui baixar agora — tente de novo."); } };
  const acao = async (fn, texto) => { setOcup(true); try { await fn(); setConf(null); onMudou?.(texto); onFechar(); return; } catch (e) { setMsg(`⚠ ${e?.response?.data?.erro || e.message}`); } finally { setOcup(false); } };
  const btn = { background: "rgba(255,255,255,.12)", color: "#fff", border: "1px solid rgba(255,255,255,.25)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 14 };
  const vals = (x.modelo?.campos || []).filter((c) => x.valores?.[c.id]).map((c) => `${c.rotulo}: ${x.valores[c.id]}${c.unidade ? ` ${c.unidade}` : ""}`);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.94)", zIndex: Z, display: "flex", flexDirection: "column", color: "#fff" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "10px 12px", flexWrap: "wrap" }}>
        <b style={{ flex: "1 1 200px", fontSize: 14 }}>{x.referencia || x.modelo_nome} · {quandoBR(x.tirada_em)} <span style={{ color: "#94a3b8", fontWeight: 400 }}>({i + 1}/{lista.length})</span></b>
        <button type="button" onClick={() => zoomEm(1 / 1.5)} style={btn}>−</button><span style={{ minWidth: 44, textAlign: "center", fontSize: 13 }}>{Math.round(v.z * 100)}%</span><button type="button" onClick={() => zoomEm(1.5)} style={btn}>＋</button>
        <button type="button" onClick={() => setV({ z: 1, tx: 0, ty: 0 })} style={btn}>Ajustar</button>
        {x.url && <button type="button" onClick={baixar} style={btn}>⬇ Baixar</button>}
        <button type="button" onClick={() => setInfo(!info)} style={btn}>ℹ</button>
        {pode && !x.excluida_em && <button type="button" onClick={() => setConf({ motivo: "" })} style={{ ...btn, color: "#fca5a5" }}>🗑 Excluir</button>}
        {pode && x.excluida_em && <button type="button" disabled={ocup} onClick={() => acao(() => apiService.post(`/foto-cartao/fotos/${x.id}/restaurar`), "♻ Foto restaurada.")} style={{ ...btn, color: "#86efac" }}>♻ Restaurar</button>}
        <button type="button" onClick={onFechar} style={btn}>✕</button>
      </div>
      {msg && <div style={{ padding: "0 12px 6px", fontSize: 13, color: /^⚠/.test(msg) ? "#fca5a5" : "#86efac" }}>{msg}</div>}
      {x.excluida_em && <div style={{ padding: "0 12px 6px", fontSize: 12.5, color: "#fcd34d" }}>🗑 Na lixeira desde {quandoBR(x.excluida_em)}{x.excluida_por ? ` por ${x.excluida_por}` : ""} — {x.exclusao_motivo}. Some de vez 30 dias depois.</div>}
      <div ref={caixa} onWheel={(e) => zoomEm(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY)} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ flex: 1, position: "relative", overflow: "hidden", touchAction: "none", cursor: v.z > 1 ? "grab" : "zoom-in" }}>
        {x.url ? <img src={x.url} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", transform: `translate(${v.tx}px, ${v.ty}px) scale(${v.z})`, transformOrigin: "center", userSelect: "none" }} /> : <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>Sem link da foto agora.</div>}
        {i > 0 && <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => setI(i - 1)} style={{ ...btn, position: "absolute", left: 8, top: "50%", fontSize: 22, padding: "10px 14px" }}>‹</button>}
        {i < lista.length - 1 && <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => setI(i + 1)} style={{ ...btn, position: "absolute", right: 8, top: "50%", fontSize: 22, padding: "10px 14px" }}>›</button>}
      </div>
      {info && <div style={{ padding: "8px 12px calc(10px + env(safe-area-inset-bottom))", fontSize: 12.5, display: "grid", gap: 3, background: "rgba(15,23,42,.9)" }}>
        <div>{vals.join(" · ") || "—"}</div>{x.obs && <div>Obs.: {x.obs}</div>}
        <div>👷 {x.tecnico} · 📍 {x.gps ? <a href={`https://maps.google.com/?q=${x.gps.lat},${x.gps.lng}`} target="_blank" rel="noreferrer" style={{ color: "#93c5fd" }}>{gpsTxt(x.gps)}</a> : "sem GPS"}</div>
        <div style={{ color: "#94a3b8", wordBreak: "break-all", fontSize: 11 }}>SHA-256 {x.hash}</div></div>}
      {conf && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: Z + 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ background: "#111827", color: "#e5e7eb", border: "1px solid #334155", borderRadius: 12, padding: 18, width: "min(440px, 100%)", display: "grid", gap: 10 }}>
          <b>🗑 Enviar esta foto para a lixeira?</b>
          <div style={{ fontSize: 13.5 }}>Ela some das galerias, do mapa e dos relatórios, mas fica <b>30 dias na lixeira</b> para restaurar. Depois disso é apagada de vez.</div>
          <textarea value={conf.motivo} onChange={(e) => setConf({ motivo: e.target.value })} rows={2} placeholder="Motivo (ex.: foto tremida, duplicada, defeito errado)…" style={{ padding: 10, borderRadius: 8, border: "1px solid #334155", background: "#0b1220", color: "#e5e7eb", fontSize: 15 }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={() => setConf(null)} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #334155", background: "transparent", color: "#e5e7eb", cursor: "pointer" }}>Voltar</button>
            <button type="button" disabled={ocup || conf.motivo.trim().length < 5} onClick={() => acao(() => apiService.post(`/foto-cartao/fotos/${x.id}/excluir`, conf), "Foto enviada para a lixeira (30 dias para restaurar).")} style={{ padding: "10px 14px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontWeight: 700, opacity: conf.motivo.trim().length < 5 ? 0.5 : 1, cursor: "pointer" }}>Enviar para a lixeira</button></div>
        </div></div>}
    </div>
  );
}
