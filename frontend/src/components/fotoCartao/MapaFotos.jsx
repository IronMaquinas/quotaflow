// components/fotoCartao/MapaFotos.jsx — etapa E2.1: 🗺 MAPA da Foto com cartão (área de abrangência)
//   Longe: um pino por projeto (agrupam quando próximos). Perto: um pino por aerogerador/referência = média do GPS das fotos dela.
//   Clique no pino → painel: projeto, cliente, aerogerador, fotos (miniaturas), datas, técnicos. Mapa ou satélite. Filtros e lista ao lado.
//   Leaflet + OpenStreetMap (sem chave); satélite Esri World Imagery. Também exporta SeletorLocal (local do projeto: busca, coordenadas, toque no mapa).
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import apiService from "../../services/apiService";
import { quandoBR } from "../../utils/cartaoFoto";
import VisualizadorFoto from "./VisualizadorFoto";
import BotaoRelatorio from "./BotaoRelatorio";

const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
function base(el, opts = {}) {
  const mapa = L.map(el, { zoomControl: true, attributionControl: true, ...opts });
  const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" });
  const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Imagens © Esri" });
  osm.addTo(mapa); L.control.layers({ Mapa: osm, "Satélite": sat }, {}, { position: "topright" }).addTo(mapa);
  return mapa;
}
const icone = (txt, cor, grande) => L.divIcon({ className: "", iconSize: grande ? [34, 34] : [28, 28], iconAnchor: grande ? [17, 17] : [14, 14],
  html: `<div style="width:100%;height:100%;border-radius:50%;background:${cor};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:#fff;font:700 ${grande ? 12 : 11}px Arial">${txt}</div>` });

export default function MapaFotos({ C, s }) {
  const el = useRef(null); const mapa = useRef(null); const camadaPj = useRef(null); const camadaPin = useRef(null);
  const [f, setF] = useState({ cliente: "", projeto_id: "", de: "", ate: "", tecnico: "" }); const [D, setD] = useState(null); const [sel, setSel] = useState(null); const [fotos, setFotos] = useState(null); const [erro, setErro] = useState(""); const [ver, setVer] = useState(null);
  useEffect(() => { const m = base(el.current, { center: [-14.2, -51.9], zoom: 4 }); mapa.current = m;
    camadaPj.current = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50 }); camadaPin.current = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 35 });
    const ajustar = () => { const z = m.getZoom(); if (z >= 11) { if (m.hasLayer(camadaPj.current)) m.removeLayer(camadaPj.current); if (!m.hasLayer(camadaPin.current)) m.addLayer(camadaPin.current); } else { if (m.hasLayer(camadaPin.current)) m.removeLayer(camadaPin.current); if (!m.hasLayer(camadaPj.current)) m.addLayer(camadaPj.current); } };
    m.on("zoomend", ajustar); ajustar(); setTimeout(() => m.invalidateSize(), 200); return () => m.remove(); }, []);
  useEffect(() => { const p = new URLSearchParams(Object.entries(f).filter(([, v]) => v)); apiService.get(`/foto-cartao/mapa?${p}`).then((r) => { setD(r); setErro(""); }).catch((e) => setErro(e?.response?.data?.erro || e.message)); }, [JSON.stringify(f)]); // eslint-disable-line
  useEffect(() => { if (!D || !mapa.current) return; const cp = camadaPj.current; const ci = camadaPin.current; cp.clearLayers(); ci.clearLayers(); const pts = [];
    for (const p of D.projetos) { if (p.lat == null) continue; pts.push([p.lat, p.lng]);
      L.marker([p.lat, p.lng], { icon: icone(p.aerogeradores || p.fotos || "•", p.status === "ativo" ? "#2563eb" : "#64748b", true), title: p.nome })
        .on("click", () => { setSel({ tipo: "projeto", ...p }); mapa.current.setView([p.lat, p.lng], Math.max(mapa.current.getZoom(), 12)); }).addTo(cp); }
    for (const x of D.pinos) { pts.push([x.lat, x.lng]);
      L.marker([x.lat, x.lng], { icon: icone(x.referencia ? "⚡" : x.fotos, x.referencia ? "#16a34a" : "#a16207"), title: x.referencia || "fotos" }).on("click", () => setSel({ tipo: "pino", ...x })).addTo(ci); }
    if (pts.length) mapa.current.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 13 }); }, [D]);
  useEffect(() => { if (!sel) return setFotos(null); setFotos(null); const p = new URLSearchParams({ limite: "12", ...(sel.tipo === "projeto" ? { projeto_id: sel.id } : { projeto_id: sel.projeto_id || "sem", ...(sel.referencia ? { referencia: sel.referencia } : {}) }) });
    apiService.get(`/foto-cartao/fotos?${p}`).then((r) => setFotos(r)).catch(() => setFotos({ fotos: [], total: 0 })); }, [sel]);
  const card = { ...s.card, padding: "12px 14px" }; const T = D?.totais;
  return <div style={{ display: "grid", gap: 10 }}>
    {ver != null && fotos && <VisualizadorFoto lista={fotos.fotos} inicio={ver} onFechar={() => setVer(null)} onMudou={() => { setF({ ...f }); setSel({ ...sel }); }} />}
    <div style={{ ...card, display: "flex", gap: 8, flexWrap: "wrap" }}>
      <select value={f.cliente} onChange={(e) => setF({ ...f, cliente: e.target.value })} style={{ ...s.input, flex: "1 1 150px" }}><option value="">Todos os clientes</option>{(D?.filtros.clientes || []).map((c) => <option key={c}>{c}</option>)}</select>
      <select value={f.projeto_id} onChange={(e) => setF({ ...f, projeto_id: e.target.value })} style={{ ...s.input, flex: "1 1 170px" }}><option value="">Todos os projetos</option>{(D?.filtros.projetos || []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
      <select value={f.tecnico} onChange={(e) => setF({ ...f, tecnico: e.target.value })} style={{ ...s.input, flex: "1 1 140px" }}><option value="">Todos os técnicos</option>{(D?.filtros.tecnicos || []).map((c) => <option key={c}>{c}</option>)}</select>
      <input type="date" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} style={{ ...s.input, flex: "1 1 130px" }} /><input type="date" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} style={{ ...s.input, flex: "1 1 130px" }} />
    </div>
    {erro && <div style={{ ...card, color: C.danger }}>{erro}</div>}
    {T && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>{[["⚡", T.aerogeradores, "aerogeradores inspecionados"], ["📁", T.projetos, "projetos / parques"], ["🏢", T.clientes, "clientes"], ["📸", T.fotos, "fotos"]].map(([ic, n, l]) => <div key={l} style={{ ...card, padding: "10px 12px" }}><div style={{ fontSize: 20, fontWeight: 800 }}>{ic} {n}</div><div style={{ fontSize: 11.5, color: C.textSub }}>{l}</div></div>)}</div>}
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "stretch" }}>
      <div ref={el} style={{ flex: "3 1 420px", minHeight: 460, height: "62vh", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }} />
      <div style={{ flex: "1 1 260px", maxHeight: "62vh", overflowY: "auto", display: "grid", gap: 8, alignContent: "start" }}>
        {sel ? <div style={{ ...card, display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}><b>{sel.tipo === "projeto" ? `📁 ${sel.nome}` : `⚡ ${sel.referencia || "Fotos sem referência"}`}</b><button type="button" onClick={() => setSel(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}>✕</button></div>
          <div style={{ fontSize: 12.5, color: C.textSub }}>{sel.tipo === "projeto" ? [sel.cliente, sel.local, `${sel.aerogeradores} aerogerador(es) · ${sel.fotos} foto(s)`, sel.local_aprox ? "local aproximado pelas fotos" : null].filter(Boolean).join(" · ") : [sel.projeto, sel.cliente, `${sel.fotos} foto(s)`, `${dBR(sel.primeira)} a ${dBR(sel.ultima)}`].filter(Boolean).join(" · ")}</div>
          {sel.tecnicos?.length > 0 && <div style={{ fontSize: 12, color: C.textSub }}>👷 {sel.tecnicos.join(", ")}</div>}
          {sel.defeitos && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", fontSize: 11.5 }}>🔧 {sel.defeitos.total} defeito(s): {[["pendente", "a classificar", "#f59e0b"], ["reparar", "reparar", "#ef4444"], ["investigar", "investigar", "#a855f7"], ["sem_reparo", "sem reparo", "#64748b"]].filter(([k]) => sel.defeitos[k]).map(([k, n, c]) => <span key={k} style={{ border: `1px solid ${c}`, color: c, borderRadius: 8, padding: "0 6px" }}>{sel.defeitos[k]} {n}</span>)}</div>}
          {sel.modelos?.length > 0 && <div style={{ fontSize: 12, color: C.textSub }}>🪪 {sel.modelos.join(", ")}</div>}
          {(sel.tipo === "projeto" ? sel.id : sel.projeto_id) && <BotaoRelatorio C={C} s={s} projetoId={sel.tipo === "projeto" ? sel.id : sel.projeto_id} referencia={sel.tipo === "pino" ? sel.referencia || "" : ""} rotulo={sel.tipo === "pino" && sel.referencia ? "📄 Relatório deste aerogerador" : "📄 Relatório do projeto"} estilo={{ justifySelf: "start", padding: "6px 10px", fontSize: 12.5 }} />}
          {!fotos ? <div style={{ fontSize: 12, color: C.muted }}>Carregando fotos…</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>{fotos.fotos.map((x, k) => <a key={x.id} href="#" onClick={(e) => { e.preventDefault(); setVer(k); }} title={`${quandoBR(x.tirada_em)} · ${x.tecnico}`}>{x.url ? <img src={x.url} alt="" loading="lazy" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 4, display: "block" }} /> : <div style={{ aspectRatio: "1", background: C.border, borderRadius: 4 }} />}</a>)}</div>}
          {fotos && fotos.total > fotos.fotos.length && <div style={{ fontSize: 11.5, color: C.textSub }}>+{fotos.total - fotos.fotos.length} — veja todas em 📁 Projetos</div>}
        </div> : <div style={{ fontSize: 12, color: C.muted }}>Toque num pino. Aproxime o mapa para ver os aerogeradores (⚡).</div>}
        {(D?.projetos || []).filter((p) => p.fotos > 0 || p.lat != null).map((p) => <button key={p.id} type="button" onClick={() => { setSel({ tipo: "projeto", ...p }); if (p.lat != null) mapa.current.setView([p.lat, p.lng], 12); }} style={{ ...card, textAlign: "left", cursor: "pointer", color: C.text, padding: "8px 10px" }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>📁 {p.nome}</div><div style={{ fontSize: 11.5, color: C.textSub }}>{[p.cliente, `${p.aerogeradores} aerog.`, `${p.fotos} fotos`, p.lat == null ? "sem local" : null].filter(Boolean).join(" · ")}</div></button>)}
        {T?.sem_gps > 0 && <div style={{ fontSize: 11.5, color: C.muted }}>{T.sem_gps} foto(s) sem GPS não aparecem no mapa.</div>}
      </div>
    </div>
  </div>;
}

/** Local do projeto: busca de endereço, coordenadas coladas ou toque no mapa. valor = { local, lat, lng } */
export function SeletorLocal({ C, s, valor, onChange }) {
  const el = useRef(null); const mapa = useRef(null); const pino = useRef(null); const [busca, setBusca] = useState(""); const [res, setRes] = useState(null); const [msg, setMsg] = useState("");
  const temPonto = valor.lat != null && valor.lat !== "" && valor.lng != null && valor.lng !== "";
  const marcar = (la, ln, zoom) => { const m = mapa.current; if (!m) return; if (!pino.current) { pino.current = L.marker([la, ln], { draggable: true, icon: icone("📍", "#dc2626", true) }).addTo(m); pino.current.on("dragend", () => { const p = pino.current.getLatLng(); onChange({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) }); }); } else pino.current.setLatLng([la, ln]); if (zoom) m.setView([la, ln], zoom); };
  useEffect(() => { const m = base(el.current, { center: temPonto ? [Number(valor.lat), Number(valor.lng)] : [-14.2, -51.9], zoom: temPonto ? 12 : 4 }); mapa.current = m;
    m.on("click", (e) => { marcar(e.latlng.lat, e.latlng.lng); onChange({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) }); });
    if (temPonto) marcar(Number(valor.lat), Number(valor.lng)); setTimeout(() => m.invalidateSize(), 250); return () => { m.remove(); pino.current = null; }; }, []); // eslint-disable-line
  const buscar = async () => { setMsg(""); const c = busca.match(/^\s*(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/);
    if (c) { const la = Number(c[1].replace(",", ".")); const ln = Number(c[2].replace(",", ".")); if (Math.abs(la) <= 90 && Math.abs(ln) <= 180) { marcar(la, ln, 13); onChange({ lat: la, lng: ln }); setRes(null); return; } }
    try { const r = await apiService.get(`/foto-cartao/geocode?q=${encodeURIComponent(busca)}`); setRes(r.resultados); if (!r.resultados.length) setMsg("Nada encontrado — tente cidade e estado, ou toque no mapa."); } catch (e) { setMsg(e?.response?.data?.erro || e.message); } };
  return <div style={{ display: "grid", gap: 6 }}>
    <div style={{ display: "flex", gap: 6 }}><input value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), buscar())} placeholder="Buscar cidade/endereço ou colar coordenadas (-5.01, -36.23)" style={{ ...s.input, flex: 1 }} /><button type="button" onClick={buscar} style={{ ...s.btn(false), cursor: "pointer" }}>Buscar</button></div>
    {res && res.length > 0 && <div style={{ display: "grid", gap: 2, maxHeight: 140, overflowY: "auto" }}>{res.map((x, i) => <button key={i} type="button" onClick={() => { marcar(x.lat, x.lng, 13); onChange({ lat: +x.lat.toFixed(6), lng: +x.lng.toFixed(6), local: valor.local || x.nome.split(",").slice(0, 3).join(",").trim() }); setRes(null); }} style={{ textAlign: "left", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 8px", color: C.text, cursor: "pointer", fontSize: 12 }}>📍 {x.nome}</button>)}</div>}
    {msg && <div style={{ fontSize: 12, color: C.warn }}>{msg}</div>}
    <div ref={el} style={{ height: 220, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }} />
    <div style={{ fontSize: 11.5, color: C.textSub }}>{temPonto ? `📍 ${Number(valor.lat).toFixed(6)}, ${Number(valor.lng).toFixed(6)} — arraste o pino ou toque no mapa para ajustar` : "Toque no mapa para marcar o local do projeto."}{temPonto && <button type="button" onClick={() => { if (pino.current) { pino.current.remove(); pino.current = null; } onChange({ lat: "", lng: "" }); }} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 11.5 }}>limpar</button>}</div>
  </div>;
}
