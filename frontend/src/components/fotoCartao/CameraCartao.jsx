// components/fotoCartao/CameraCartao.jsx — etapa E1: 📸 câmera em tela cheia com o CARTÃO flutuando
//   1 dedo arrasta o cartão · 2 dedos no cartão aumentam/diminuem · toque no cartão abre o preenchimento · botão grande tira a foto (luva).
//   A foto sai com o cartão desenhado nos pixels (mesmo desenho da prévia) + técnico, data/hora e GPS no rodapé do cartão.
//   E1.1: quadro certo já ao abrir (redesenha quando o vídeo carrega/muda de tamanho) · celular deitado pede a câmera na horizontal
//   (reabre a câmera ao girar) · ZOOM da imagem: 2 dedos fora do cartão ou botões 1×/2×/3×/5× (zoom óptico do aparelho quando o navegador
//   libera; senão zoom digital = recorte do centro, e a foto sai exatamente como na tela) · segurança: a foto é gravada no aparelho ANTES de
//   qualquer envio, contador "no aparelho / enviada", aviso ao fechar com foto pendente e ao sair da página.
import { useEffect, useRef, useState } from "react";
import { desenharCartao, alturaCartao, carregarImagem } from "../../utils/cartaoFoto";
import { logoEmpresa, dadosEmpresa } from "../../utils/logoEmpresa";
import * as Fila from "../../utils/filaFotosCartao";

const POS_KEY = "qfCartaoPos";
const Z_TOPO = 2147483640;
const ZOOMS = [1, 2, 3, 5];
const lerPos = () => { try { const p = JSON.parse(localStorage.getItem(POS_KEY) || "null"); if (p && p.nw > 0.15) return p; } catch { /* ok */ } return { nx: 0.02, ny: 0.45, nw: 0.46 }; };
const idCurto = (uid) => String(uid || "").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8);
const deitado = () => (window.matchMedia ? window.matchMedia("(orientation: landscape)").matches : window.innerWidth > window.innerHeight);

export default function CameraCartao({ modelo, projeto = null, referencia, tenant, tecnico, valoresIniciais, onFechar, onFoto, extra = null, rotulo = "" }) {
  const vid = useRef(null); const tela = useRef(null); const caixa = useRef(null); const stream = useRef(null);
  const [pos, setPos] = useState(lerPos); const [val, setVal] = useState(valoresIniciais?.valores || {}); const [obs, setObs] = useState(valoresIniciais?.obs || "");
  const [gps, setGps] = useState(null); const [erro, setErro] = useState(""); const [form, setForm] = useState(false); const [flash, setFlash] = useState(false); const [ultima, setUltima] = useState(null);
  const [n, setN] = useState(0); const [pend, setPend] = useState(0); const [aviso, setAviso] = useState(""); const [sair, setSair] = useState(false);
  const [logo, setLogo] = useState(null); const [agora, setAgora] = useState(Date.now()); const [, setTick] = useState(0);
  const [z, setZ] = useState(1); const [hw, setHw] = useState(null); const [luz, setLuz] = useState(null);
  const toques = useRef(new Map()); const gesto = useRef(null); const zRef = useRef(1);
  const empresa = dadosEmpresa()?.nome || "";
  const redesenhar = () => setTick((t) => t + 1);

  const abrirCamera = async () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    const lado = deitado();
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: lado ? 3840 : 2160 }, height: { ideal: lado ? 2160 : 3840 }, aspectRatio: { ideal: lado ? 16 / 9 : 9 / 16 } } });
      stream.current = s; if (vid.current) { vid.current.srcObject = s; await vid.current.play().catch(() => {}); }
      const tr = s.getVideoTracks()[0]; const cap = tr?.getCapabilities?.() || {};
      setLuz(cap.torch ? false : null);
      if (cap.zoom && cap.zoom.max > cap.zoom.min) { setHw({ min: cap.zoom.min, max: cap.zoom.max }); const alvo = Math.min(Math.max(zRef.current, cap.zoom.min), cap.zoom.max); tr.applyConstraints({ advanced: [{ zoom: alvo }] }).catch(() => {}); } else setHw(null);
      setErro(""); redesenhar();
    } catch (e) { setErro(/Permission|NotAllowed/i.test(String(e?.name || e)) ? "Permita o uso da câmera para este site (cadeado na barra de endereço) e tente de novo." : "Não consegui abrir a câmera deste aparelho."); }
  };
  useEffect(() => { carregarImagem(logoEmpresa()).then(setLogo); const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    abrirCamera();
    let w = null; try { w = navigator.geolocation?.watchPosition((p) => setGps({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy }), () => {}, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }); } catch { /* sem GPS */ }
    let giro = null; const girou = () => { redesenhar(); clearTimeout(giro); giro = setTimeout(() => { const v = vid.current; if (v?.videoWidth && (v.videoWidth > v.videoHeight) !== deitado()) abrirCamera(); else redesenhar(); }, 450); };
    window.addEventListener("resize", girou); window.addEventListener("orientationchange", girou);
    Fila.listar(tenant).then((l) => setPend(l.filter((x) => x.status !== "erro").length));
    return () => { stream.current?.getTracks().forEach((t) => t.stop()); if (w != null) navigator.geolocation?.clearWatch(w); window.removeEventListener("resize", girou); window.removeEventListener("orientationchange", girou); clearTimeout(giro); };
  }, []); // eslint-disable-line
  useEffect(() => { try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* ok */ } }, [pos]);
  useEffect(() => { const f = (e) => { if (pend > 0) { e.preventDefault(); e.returnValue = ""; } }; window.addEventListener("beforeunload", f); return () => window.removeEventListener("beforeunload", f); }, [pend]);

  // zoom: óptico quando o navegador libera (hw), senão digital (recorte do centro)
  const aplicarZoom = (novo) => { const zz = Math.min(Math.max(novo, 1), hw ? hw.max : 5); zRef.current = zz; setZ(zz);
    if (hw) { const tr = stream.current?.getVideoTracks()[0]; tr?.applyConstraints({ advanced: [{ zoom: Math.max(zz, hw.min) }] }).catch(() => {}); } };
  const zDig = hw ? 1 : z;
  // E2: lanterna (luz contínua) — só aparece quando o navegador libera (Chrome no Android; Safari no iPhone ainda não)
  const alternarLuz = () => { const tr = stream.current?.getVideoTracks()[0]; const novo = !luz; tr?.applyConstraints({ advanced: [{ torch: novo }] }).then(() => setLuz(novo)).catch(() => setAviso("⚠ Este aparelho não deixou ligar a lanterna pelo navegador.")); };

  const quadro = () => { const v = vid.current; const c = caixa.current; if (!v || !c || !v.videoWidth) return null; const cw = c.clientWidth; const ch = c.clientHeight; const k = Math.min(cw / v.videoWidth, ch / v.videoHeight); const dw = v.videoWidth * k; const dh = v.videoHeight * k; return { cw, ch, dw, dh, ox: (cw - dw) / 2, oy: (ch - dh) / 2 }; };
  const dadosCartao = (quando, id = "") => ({ modelo, valores: val, obs, empresa, logo, tecnico, quando, gps, id, projeto: [projeto?.nome, referencia].filter(Boolean).join(" · "), etapa: rotulo || "" });
  // E2: o cartão sempre cabe inteiro no quadro (girar o celular ou trocar de modelo não corta o cartão na foto)
  const caber = (p, fw, fh) => { const k = alturaCartao(modelo, 1); let nw = Math.min(Math.max(p.nw, 0.15), 0.98); if (k * nw * fw > fh * 0.98) nw = (fh * 0.98) / (k * fw);
    const h = (k * nw * fw) / fh; return { nw, nx: Math.min(Math.max(p.nx, 0), 1 - nw), ny: Math.min(Math.max(p.ny, 0), Math.max(0, 1 - h - 0.01)) }; };
  const retCartao = (q) => { const pz = caber(pos, q.dw, q.dh); const w = pz.nw * q.dw; return { x: q.ox + pz.nx * q.dw, y: q.oy + pz.ny * q.dh, w, h: alturaCartao(modelo, w) }; };
  const q0 = quadro(); const lado = deitado();
  // prévia (redesenha a cada render: relógio, gestos, vídeo carregado, giro)
  useEffect(() => { const c = tela.current; const q = quadro(); if (!c || !q) return; const dpr = window.devicePixelRatio || 1;
    const W = Math.round(q.cw * dpr); const H = Math.round(q.ch * dpr); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, q.cw, q.ch); const r = retCartao(q); desenharCartao(ctx, r.x, r.y, r.w, dadosCartao(agora)); });

  const limitar = (p, q) => caber(p, q.dw, q.dh);
  const dentro = (e, q) => { const b = tela.current.getBoundingClientRect(); const r = retCartao(q); const px = e.clientX - b.left; const py = e.clientY - b.top; return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; };
  const down = (e) => { const q = quadro(); if (!q) return; tela.current.setPointerCapture?.(e.pointerId);
    const modo = toques.current.size ? gesto.current?.modo : dentro(e, q) ? "cartao" : "imagem";
    toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); const pts = [...toques.current.values()];
    gesto.current = { modo, ini: Date.now(), mov: 0, pos0: pos, z0: zRef.current, pts0: pts.map((p) => ({ ...p })), dist0: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0 }; };
  const move = (e) => { if (!toques.current.has(e.pointerId) || !gesto.current) return; const q = quadro(); if (!q) return; toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); const pts = [...toques.current.values()]; const g = gesto.current;
    if (pts.length >= 2 && g.dist0) { const k = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / g.dist0; g.mov += 10;
      if (g.modo === "cartao") setPos(limitar({ ...g.pos0, nw: Math.min(0.98, Math.max(0.2, g.pos0.nw * k)) }, q)); else aplicarZoom(g.z0 * k); }
    else if (pts.length === 1 && g.modo === "cartao") { const dx = pts[0].x - g.pts0[0].x; const dy = pts[0].y - g.pts0[0].y; g.mov = Math.max(g.mov, Math.hypot(dx, dy)); setPos(limitar({ ...g.pos0, nx: g.pos0.nx + dx / q.dw, ny: g.pos0.ny + dy / q.dh }, q)); }
    else if (pts.length === 1) g.mov = Math.max(g.mov, Math.hypot(pts[0].x - g.pts0[0].x, pts[0].y - g.pts0[0].y)); };
  const up = (e) => { const g = gesto.current; const eraUm = toques.current.size === 1; toques.current.delete(e.pointerId);
    if (toques.current.size) { const pts = [...toques.current.values()]; gesto.current = { ...g, ini: Date.now(), mov: 99, pos0: pos, z0: zRef.current, pts0: pts.map((p) => ({ ...p })), dist0: 0 }; return; }
    gesto.current = null; if (g && g.modo === "cartao" && eraUm && g.mov < 8 && Date.now() - g.ini < 450) setForm(true); };

  const tirar = async () => { const v = vid.current; if (!v?.videoWidth) return;
    const W = v.videoWidth; const H = v.videoHeight; const sw = Math.round(W / zDig); const sh = Math.round(H / zDig); const sx = Math.round((W - sw) / 2); const sy = Math.round((H - sh) / 2);
    const c = document.createElement("canvas"); c.width = sw; c.height = sh; const ctx = c.getContext("2d"); ctx.drawImage(v, sx, sy, sw, sh, 0, 0, sw, sh);
    const uid = Fila.novoUid(); const quando = Date.now(); const pz = caber(pos, sw, sh); desenharCartao(ctx, pz.nx * sw, pz.ny * sh, pz.nw * sw, dadosCartao(quando, idCurto(uid)));
    let img = c.toDataURL("image/jpeg", 0.86); if (img.length > 10.5e6) img = c.toDataURL("image/jpeg", 0.7);
    setFlash(true); setTimeout(() => setFlash(false), 140); try { navigator.vibrate?.(40); } catch { /* ok */ }
    const corpo = { cliente_uid: uid, imagem: img, modelo_id: modelo.id, modelo: { nome: modelo.nome, titulo: modelo.titulo, campos: modelo.campos }, valores: val, obs, referencia, projeto_id: projeto?.id || null, ...(extra || {}), gps, tirada_em: new Date(quando).toISOString(), zoom: z };
    const ok = await Fila.salvar({ uid, tenant, criado: quando, status: "pendente", corpo });
    if (ok === false) { setAviso("⚠ Não consegui guardar a foto no aparelho (memória cheia?). Libere espaço — esta foto NÃO foi salva."); return; }
    setUltima(img); setN((k) => k + 1); setPend((p) => p + 1); setAviso("✓ Foto guardada no aparelho");
    const r = await onFoto?.({ valores: val, obs });
    if (r) { setPend(r.pendentes); setAviso(r.pendentes ? `✓ Guardada no aparelho · ${r.pendentes} aguardando sinal` : "☁ Foto enviada"); }
  };
  const fechar = () => (pend > 0 ? setSair(true) : onFechar());

  const btnR = { background: "rgba(0,0,0,.55)", color: "#fff", border: "1px solid rgba(255,255,255,.35)", borderRadius: 22, padding: "9px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
  const inp = { width: "100%", padding: "11px 10px", borderRadius: 8, border: "1px solid #334155", fontSize: 16, boxSizing: "border-box", background: "#0b1220", color: "#e5e7eb" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: Z_TOPO, display: "flex", flexDirection: lado ? "row" : "column", touchAction: "none" }}>
      <div ref={caixa} style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: q0 ? q0.ox : 0, top: q0 ? q0.oy : 0, width: q0 ? q0.dw : "100%", height: q0 ? q0.dh : "100%", overflow: "hidden" }}>
          <video ref={vid} playsInline muted autoPlay onLoadedMetadata={redesenhar} onResize={redesenhar} onPlaying={redesenhar} style={{ width: "100%", height: "100%", objectFit: "fill", transform: `scale(${zDig})`, transformOrigin: "center center" }} />
        </div>
        <canvas ref={tela} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none" }} />
        {flash && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: 0.7 }} />}
        <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", pointerEvents: "none" }}>
          <button type="button" onClick={fechar} style={{ ...btnR, pointerEvents: "auto" }}>✕ Fechar</button>
          <div style={{ ...btnR, cursor: "default", fontWeight: 500, fontSize: 12.5 }}>{rotulo ? `🛠 ${rotulo}` : projeto ? `📁 ${projeto.nome}` : modelo.nome}{referencia ? ` · ${referencia}` : ""} · {gps ? `📍 ±${Math.round(gps.precisao || 0)} m` : "📍 buscando GPS…"}</div>
        </div>
        {aviso && <div style={{ position: "absolute", top: 58, left: 10, ...btnR, cursor: "default", fontSize: 12.5, background: /^⚠/.test(aviso) ? "#b91c1c" : "rgba(0,0,0,.6)" }}>{aviso}</div>}
        {erro && <div style={{ position: "absolute", top: "40%", left: 16, right: 16, background: "#fff", color: "#111", borderRadius: 10, padding: 16, textAlign: "center" }}>{erro}</div>}
        <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 8 }}>
          {ZOOMS.filter((k) => !hw || k <= hw.max).map((k) => <button key={k} type="button" onClick={() => aplicarZoom(k)} style={{ ...btnR, padding: "7px 12px", minWidth: 46, background: Math.abs(z - k) < 0.05 ? "#fbbf24" : btnR.background, color: Math.abs(z - k) < 0.05 ? "#111" : "#fff" }}>{k}×</button>)}
          {luz !== null && <button type="button" onClick={alternarLuz} aria-label="Lanterna" style={{ ...btnR, padding: "7px 12px", background: luz ? "#fde047" : btnR.background, color: luz ? "#111" : "#fff" }}>🔦</button>}
          {!ZOOMS.some((k) => Math.abs(z - k) < 0.05) && <span style={{ ...btnR, padding: "7px 10px", background: "#fbbf24", color: "#111", cursor: "default" }}>{z.toFixed(1)}×</span>}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: lado ? "column-reverse" : "row", alignItems: "center", justifyContent: "space-between", padding: lado ? "14px calc(12px + env(safe-area-inset-right)) 14px 12px" : "12px 18px calc(12px + env(safe-area-inset-bottom))", background: "#000" }}>
        <div style={{ width: 64, height: 64, borderRadius: 8, overflow: "hidden", border: "1px solid #444", position: "relative" }}>{ultima && <img src={ultima} alt="última" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          {n > 0 && <span title="fotos nesta sessão" style={{ position: "absolute", left: 2, bottom: 2, background: "#22c55e", color: "#fff", borderRadius: 8, fontSize: 11, padding: "0 5px", fontWeight: 700 }}>{n}</span>}
          {pend > 0 && <span title="no aparelho aguardando envio" style={{ position: "absolute", right: 2, top: 2, background: "#f59e0b", color: "#111", borderRadius: 8, fontSize: 11, padding: "0 5px", fontWeight: 700 }}>📶{pend}</span>}</div>
        <button type="button" aria-label="Tirar foto" onClick={tirar} disabled={!!erro} style={{ width: 84, height: 84, borderRadius: "50%", border: "5px solid #fff", background: "#ef4444", cursor: "pointer", boxShadow: "0 0 0 3px #000 inset" }} />
        <button type="button" onClick={() => setForm(true)} style={{ ...btnR, width: 64, height: 64, borderRadius: 12, padding: 0, fontSize: 12 }}>✎<br />Cartão</button>
      </div>
      {sair && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: Z_TOPO + 2, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ background: "#111827", color: "#e5e7eb", border: "1px solid #334155", borderRadius: 12, padding: 18, maxWidth: 420, display: "grid", gap: 10 }}>
          <b>📶 {pend} foto(s) guardada(s) no aparelho, ainda sem enviar</b>
          <div style={{ fontSize: 14 }}>Elas não se perdem ao fechar: sobem sozinhas quando o QuotaFlow for aberto com internet. Só <b>não apague os dados do navegador</b> nem desinstale até aparecer "enviada".</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={() => setSair(false)} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #334155", background: "transparent", color: "#e5e7eb" }}>Voltar à câmera</button><button type="button" onClick={onFechar} style={{ padding: "10px 14px", borderRadius: 8, border: "none", background: "#1d4ed8", color: "#fff", fontWeight: 700 }}>Fechar</button></div>
        </div></div>}
      {form && <div onClick={() => setForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: Z_TOPO + 1, display: "flex", alignItems: "flex-end" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: "#111827", color: "#e5e7eb", borderTop: "1px solid #334155", width: "100%", maxHeight: "78vh", overflowY: "auto", borderRadius: "14px 14px 0 0", padding: "14px 14px calc(14px + env(safe-area-inset-bottom))", display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b>{modelo.titulo}</b><button type="button" onClick={() => setForm(false)} style={{ background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 15, fontWeight: 700 }}>Pronto</button></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {(modelo.campos || []).map((c) => <label key={c.id} style={{ gridColumn: c.largura === 2 ? "1 / -1" : "auto", fontSize: 12, color: "#94a3b8", display: "grid", gap: 3 }}>{c.rotulo}{c.unidade ? ` (${c.unidade})` : ""}
              {c.tipo === "opcoes" ? <select value={val[c.id] || ""} onChange={(e) => setVal({ ...val, [c.id]: e.target.value })} style={inp}><option value="">—</option>{c.opcoes.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                : <input value={val[c.id] || ""} inputMode={c.tipo === "numero" ? "decimal" : "text"} onChange={(e) => setVal({ ...val, [c.id]: e.target.value })} style={inp} />}</label>)}
          </div>
          {modelo.obs !== false && <label style={{ fontSize: 12, color: "#94a3b8", display: "grid", gap: 3 }}>Observações<textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} style={inp} /></label>}
          <button type="button" onClick={() => { setVal({}); setObs(""); }} style={{ background: "transparent", border: "1px solid #334155", borderRadius: 8, padding: 10, color: "#e5e7eb" }}>Limpar o cartão (próximo defeito)</button>
        </div></div>}
    </div>
  );
}
