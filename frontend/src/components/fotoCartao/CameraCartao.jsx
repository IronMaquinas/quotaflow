// components/fotoCartao/CameraCartao.jsx — etapa E1: 📸 câmera em tela cheia com o CARTÃO flutuando
//   1 dedo arrasta o cartão · 2 dedos aumentam/diminuem · toque no cartão abre o preenchimento · botão grande tira a foto (funciona com luva).
//   A foto sai com o cartão desenhado nos pixels (mesmo desenho da prévia) + técnico, data/hora e GPS no rodapé do cartão.
//   Guardada primeiro no aparelho (fila) e enviada quando houver sinal.
import { useEffect, useRef, useState } from "react";
import { desenharCartao, alturaCartao, carregarImagem } from "../../utils/cartaoFoto";
import { logoEmpresa, dadosEmpresa } from "../../utils/logoEmpresa";
import * as Fila from "../../utils/filaFotosCartao";

const POS_KEY = "qfCartaoPos";
const lerPos = () => { try { const p = JSON.parse(localStorage.getItem(POS_KEY) || "null"); if (p && p.nw > 0.15) return p; } catch { /* ok */ } return { nx: 0.02, ny: 0.45, nw: 0.46 }; };
const idCurto = (uid) => String(uid || "").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8);

export default function CameraCartao({ modelo, referencia, tenant, tecnico, valoresIniciais, onFechar, onFoto }) {
  const vid = useRef(null); const tela = useRef(null); const caixa = useRef(null); const stream = useRef(null);
  const [pos, setPos] = useState(lerPos); const [val, setVal] = useState(valoresIniciais?.valores || {}); const [obs, setObs] = useState(valoresIniciais?.obs || "");
  const [gps, setGps] = useState(null); const [erro, setErro] = useState(""); const [form, setForm] = useState(false); const [flash, setFlash] = useState(false); const [ultima, setUltima] = useState(null); const [n, setN] = useState(0); const [res, setRes] = useState("");
  const [logo, setLogo] = useState(null); const [agora, setAgora] = useState(Date.now());
  const toques = useRef(new Map()); const gesto = useRef(null);
  const empresa = dadosEmpresa()?.nome || "";

  useEffect(() => { carregarImagem(logoEmpresa()).then(setLogo); const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { let vivo = true;
    (async () => { try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false });
      if (!vivo) { s.getTracks().forEach((t) => t.stop()); return; } stream.current = s; vid.current.srcObject = s; await vid.current.play().catch(() => {});
    } catch (e) { setErro(/Permission|NotAllowed/i.test(String(e?.name || e)) ? "Permita o uso da câmera para este site (cadeado na barra de endereço) e tente de novo." : "Não consegui abrir a câmera deste aparelho."); } })();
    let w = null; try { w = navigator.geolocation?.watchPosition((p) => setGps({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy }), () => {}, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }); } catch { /* sem GPS */ }
    return () => { vivo = false; stream.current?.getTracks().forEach((t) => t.stop()); if (w != null) navigator.geolocation?.clearWatch(w); };
  }, []);
  useEffect(() => { try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* ok */ } }, [pos]);

  const quadro = () => { const v = vid.current; const c = caixa.current; if (!v || !c || !v.videoWidth) return null; const cw = c.clientWidth; const ch = c.clientHeight; const k = Math.min(cw / v.videoWidth, ch / v.videoHeight); const dw = v.videoWidth * k; const dh = v.videoHeight * k; return { cw, ch, dw, dh, ox: (cw - dw) / 2, oy: (ch - dh) / 2 }; };
  const dadosCartao = (quando, id = "") => ({ modelo, valores: val, obs, empresa, logo, tecnico, quando, gps, id });
  const retCartao = (q) => { const w = pos.nw * q.dw; return { x: q.ox + pos.nx * q.dw, y: q.oy + pos.ny * q.dh, w, h: alturaCartao(modelo, w) }; };
  // prévia
  useEffect(() => { const c = tela.current; const q = quadro(); if (!c || !q) return; const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(q.cw * dpr)) { c.width = Math.round(q.cw * dpr); c.height = Math.round(q.ch * dpr); }
    const ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, q.cw, q.ch); const r = retCartao(q); desenharCartao(ctx, r.x, r.y, r.w, dadosCartao(agora));
    if (!res) setRes(`${vid.current.videoWidth}×${vid.current.videoHeight}`); });

  const limitar = (p, q) => { const w = p.nw * q.dw; const h = alturaCartao(modelo, w) / q.dh; return { nw: p.nw, nx: Math.min(Math.max(p.nx, 0), 1 - p.nw), ny: Math.min(Math.max(p.ny, 0), Math.max(0, 1 - h)) }; };
  const dentro = (e, q) => { const b = tela.current.getBoundingClientRect(); const r = retCartao(q); const px = e.clientX - b.left; const py = e.clientY - b.top; return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; };
  const down = (e) => { const q = quadro(); if (!q) return; if (!toques.current.size && !dentro(e, q)) return; tela.current.setPointerCapture?.(e.pointerId);
    toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); const pts = [...toques.current.values()];
    gesto.current = { ini: Date.now(), mov: 0, pos0: pos, pts0: pts.map((p) => ({ ...p })), dist0: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0 }; };
  const move = (e) => { if (!toques.current.has(e.pointerId) || !gesto.current) return; const q = quadro(); if (!q) return; toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); const pts = [...toques.current.values()]; const g = gesto.current;
    if (pts.length >= 2 && g.dist0) { const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y); const nw = Math.min(0.98, Math.max(0.2, g.pos0.nw * (d / g.dist0))); g.mov += 10; setPos(limitar({ ...g.pos0, nw }, q)); }
    else if (pts.length === 1) { const dx = pts[0].x - g.pts0[0].x; const dy = pts[0].y - g.pts0[0].y; g.mov = Math.max(g.mov, Math.hypot(dx, dy)); setPos(limitar({ ...g.pos0, nx: g.pos0.nx + dx / q.dw, ny: g.pos0.ny + dy / q.dh }, q)); } };
  const up = (e) => { const g = gesto.current; const eraUm = toques.current.size === 1; toques.current.delete(e.pointerId);
    if (toques.current.size) { const pts = [...toques.current.values()]; gesto.current = { ini: Date.now(), mov: 99, pos0: pos, pts0: pts.map((p) => ({ ...p })), dist0: 0 }; return; }
    gesto.current = null; if (g && eraUm && g.mov < 8 && Date.now() - g.ini < 450) setForm(true); };

  const tirar = async () => { const v = vid.current; if (!v?.videoWidth) return; const W = v.videoWidth; const H = v.videoHeight; const c = document.createElement("canvas"); c.width = W; c.height = H; const ctx = c.getContext("2d");
    ctx.drawImage(v, 0, 0, W, H); const uid = Fila.novoUid(); const quando = Date.now(); desenharCartao(ctx, pos.nx * W, pos.ny * H, pos.nw * W, dadosCartao(quando, idCurto(uid)));
    let img = c.toDataURL("image/jpeg", 0.86); if (img.length > 10.5e6) img = c.toDataURL("image/jpeg", 0.7);
    setFlash(true); setTimeout(() => setFlash(false), 140); setUltima(img); setN((k) => k + 1);
    try { navigator.vibrate?.(40); } catch { /* ok */ }
    await Fila.salvar({ uid, tenant, criado: quando, status: "pendente", corpo: { cliente_uid: uid, imagem: img, modelo_id: modelo.id, modelo: { nome: modelo.nome, titulo: modelo.titulo, campos: modelo.campos }, valores: val, obs, referencia, gps, tirada_em: new Date(quando).toISOString() } });
    onFoto?.({ valores: val, obs }); };

  const btnR = { background: "rgba(0,0,0,.55)", color: "#fff", border: "1px solid rgba(255,255,255,.35)", borderRadius: 22, padding: "9px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
  const inp = { width: "100%", padding: "11px 10px", borderRadius: 8, border: "1px solid #94a3b8", fontSize: 16, boxSizing: "border-box", background: "#fff", color: "#111" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 900, display: "flex", flexDirection: "column", touchAction: "none" }}>
      <div ref={caixa} style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <video ref={vid} playsInline muted autoPlay style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
        <canvas ref={tela} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none" }} />
        {flash && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: 0.7 }} />}
        <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", pointerEvents: "none" }}>
          <button type="button" onClick={onFechar} style={{ ...btnR, pointerEvents: "auto" }}>✕ Fechar</button>
          <div style={{ ...btnR, cursor: "default", fontWeight: 500, fontSize: 12.5 }}>{modelo.nome}{referencia ? ` · ${referencia}` : ""} · {gps ? `📍 ±${Math.round(gps.precisao || 0)} m` : "📍 buscando GPS…"}{res ? ` · ${res}` : ""}</div>
        </div>
        {erro && <div style={{ position: "absolute", top: "40%", left: 16, right: 16, background: "#fff", color: "#111", borderRadius: 10, padding: 16, textAlign: "center" }}>{erro}</div>}
        <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, textAlign: "center", color: "#fff", fontSize: 12, textShadow: "0 1px 3px #000", pointerEvents: "none" }}>Arraste o cartão · 2 dedos para aumentar · toque no cartão para preencher</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px calc(12px + env(safe-area-inset-bottom))", background: "#000" }}>
        <div style={{ width: 64, height: 64, borderRadius: 8, overflow: "hidden", border: "1px solid #444", position: "relative" }}>{ultima && <img src={ultima} alt="última" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}{n > 0 && <span style={{ position: "absolute", right: 2, bottom: 2, background: "#22c55e", color: "#fff", borderRadius: 8, fontSize: 11, padding: "0 5px", fontWeight: 700 }}>{n}</span>}</div>
        <button type="button" aria-label="Tirar foto" onClick={tirar} disabled={!!erro} style={{ width: 84, height: 84, borderRadius: "50%", border: "5px solid #fff", background: "#ef4444", cursor: "pointer", boxShadow: "0 0 0 3px #000 inset" }} />
        <button type="button" onClick={() => setForm(true)} style={{ ...btnR, width: 64, height: 64, borderRadius: 12, padding: 0, fontSize: 12 }}>✎<br />Cartão</button>
      </div>
      {form && <div onClick={() => setForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 910, display: "flex", alignItems: "flex-end" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: "#f8fafc", color: "#111", width: "100%", maxHeight: "78vh", overflowY: "auto", borderRadius: "14px 14px 0 0", padding: "14px 14px calc(14px + env(safe-area-inset-bottom))", display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b>{modelo.titulo}</b><button type="button" onClick={() => setForm(false)} style={{ background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 15, fontWeight: 700 }}>Pronto</button></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {(modelo.campos || []).map((c) => <label key={c.id} style={{ gridColumn: c.largura === 2 ? "1 / -1" : "auto", fontSize: 12, color: "#475569", display: "grid", gap: 3 }}>{c.rotulo}{c.unidade ? ` (${c.unidade})` : ""}
              {c.tipo === "opcoes" ? <select value={val[c.id] || ""} onChange={(e) => setVal({ ...val, [c.id]: e.target.value })} style={inp}><option value="">—</option>{c.opcoes.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                : <input value={val[c.id] || ""} inputMode={c.tipo === "numero" ? "decimal" : "text"} onChange={(e) => setVal({ ...val, [c.id]: e.target.value })} style={inp} />}</label>)}
          </div>
          {modelo.obs !== false && <label style={{ fontSize: 12, color: "#475569", display: "grid", gap: 3 }}>Observações<textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} style={inp} /></label>}
          <button type="button" onClick={() => { setVal({}); setObs(""); }} style={{ background: "transparent", border: "1px solid #94a3b8", borderRadius: 8, padding: 10, color: "#334155" }}>Limpar o cartão (próximo defeito)</button>
        </div></div>}
    </div>
  );
}
