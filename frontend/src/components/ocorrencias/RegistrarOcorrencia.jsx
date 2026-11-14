// components/ocorrencias/RegistrarOcorrencia.jsx — etapa 18h: ⚠️ registrar ocorrência / sinistro (SIN-AAAA-NNNN)
//   Mesmo formulário para as duas portas:
//     • cliente (locatário): escolhe o contrato e o equipamento locado → /api/locatario/ocorrencias
//     • empresa: pelo contrato (contrato + equipamento) ou pela AT (execucao) → /api/ocorrencias
//   Fotos: comprimidas no aparelho e com a tarja (o que · SIN · data/hora · GPS · quem) ABAIXO da foto — enviadas depois que o SIN existe.
//   "Equipamento parado" só avisa o comercial — quem decide é ele.
import { useState, useEffect, useRef } from "react";
import ImagemZoom from "../shared/ImagemZoom"; // 18ze: zoom no ver foto
import apiService from "../../services/apiService";
import { linhasMarca, alturaMarca, desenharMarca } from "../../utils/marcaFoto";

export const TIPOS_OC = { avaria: "💥 Avaria / dano", pane: "🔧 Pane / falha mecânica", acidente: "🚨 Acidente", furto: "🕵️ Furto / roubo", outro: "❔ Outro" };
const lerBase64 = (f) => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => erro(new Error("Não consegui ler o arquivo")); r.readAsDataURL(f); });
const agoraLocal = () => { const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };

/** foto → JPEG (lado máx. 1600) com a tarja do SIN embaixo */
export function fotoComTarja(file, marca, lado = 1600, qualidade = 0.75) {
  return new Promise((ok, erro) => {
    const r = new FileReader(); r.onerror = () => erro(new Error("Não consegui ler a foto"));
    r.onload = (ev) => {
      const img = new Image(); img.onerror = () => erro(new Error("Arquivo não é uma imagem válida"));
      img.onload = () => {
        let { width: w, height: h } = img; const k = Math.min(1, lado / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
        const mk = marca ? linhasMarca({ ...marca, arquivoEm: file.lastModified }) : null; const lm = mk ? mk.linhas : null;
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h + (lm ? alturaMarca(w, h, lm) : 0);
        const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0, w, h); if (lm) desenharMarca(ctx, w, h, lm);
        const uri = cv.toDataURL("image/jpeg", qualidade); ok({ mime: "image/jpeg", base64: uri.split(",")[1] || "", dataUri: uri, antiga: !!mk?.antiga });
      };
      img.src = ev.target.result;
    };
    r.readAsDataURL(file);
  });
}
/** sobe fotos/BO de uma ocorrência já criada (base = "/ocorrencias" ou "/locatario/ocorrencias") */
export async function enviarArquivos(base, oc, { fotos = [], bo = null, quem = null, gps = null } = {}) {
  const falhas = [];
  for (const f of fotos) {
    try { const x = await fotoComTarja(f.file, { oque: `Ocorrência ${f.legenda ? `· ${f.legenda}` : ""}`.trim(), ref: oc.numero, quem, gps });
      const { dataUri: _d, ...envio } = x; await apiService.post(`${base}/${oc.id}/anexos`, { tipo: "foto", nome: f.file.name, legenda: f.legenda || null, gps, ...envio }); }
    catch (e) { falhas.push(`${f.file.name}: ${e.message}`); }
  }
  if (bo) { try { await apiService.post(`${base}/${oc.id}/anexos`, { tipo: "bo", nome: bo.name, mime: bo.type || (/\.pdf$/i.test(bo.name) ? "application/pdf" : "image/jpeg"), base64: await lerBase64(bo) }); } catch (e) { falhas.push(`BO: ${e.message}`); } }
  return falhas;
}

export default function RegistrarOcorrencia({ C, s, modo = "cliente", at = null, contratos = null, inicial = {}, usuario = null, onFechar, onCriada }) {
  const base = modo === "cliente" ? "/locatario/ocorrencias" : "/ocorrencias";
  const [ops, setOps] = useState(contratos);
  const [f, setF] = useState({ contrato_id: inicial.contrato_id || "", equipamento_id: inicial.equipamento_id || "", tipo: inicial.tipo || "", parado: false, ocorrido_em: agoraLocal(), local: "", descricao: inicial.descricao || "", inspecao_id: inicial.inspecao_id || null });
  const [fotos, setFotos] = useState([]); const [bo, setBo] = useState(null);
  const [gps, setGps] = useState(null); const [ocupado, setOcupado] = useState(false); const [erro, setErro] = useState(null);
  const [verFoto, setVerFoto] = useState(null); const [remover, setRemover] = useState(null); // 18h.1: ampliar · confirmar remoção
  const ref = useRef(null);
  useEffect(() => { if (!at && !ops && modo === "cliente") apiService.get("/locatario/ocorrencias/opcoes").then((r) => setOps(r.contratos || [])).catch((e) => setErro(e.message)); }, [at, ops, modo]);
  useEffect(() => { try { navigator.geolocation?.getCurrentPosition((p) => setGps({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy }), () => {}, { timeout: 8000, maximumAge: 120000 }); } catch { /* sem GPS */ } }, []);
  useEffect(() => { if (ops?.length === 1 && !f.contrato_id) setF((v) => ({ ...v, contrato_id: String(ops[0].id), equipamento_id: ops[0].equipamentos?.length === 1 ? String(ops[0].equipamentos[0].equipamento_id) : v.equipamento_id })); }, [ops]); // eslint-disable-line react-hooks/exhaustive-deps
  const contrato = (ops || []).find((c) => String(c.id) === String(f.contrato_id));
  const equip = contrato?.equipamentos?.find((e) => String(e.equipamento_id) === String(f.equipamento_id));
  const pode = !!f.tipo && f.descricao.trim().length >= 5 && (at || (contrato && equip)) && !ocupado;
  // 18h.1: copia os arquivos NA HORA (o input é limpo logo depois) e gera a prévia já comprimida e com a tarja ("SIN a gerar" → o nº real entra no envio)
  const addFotos = async (lista) => {
    const arqs = Array.from(lista || []); const imgs = arqs.filter((x) => /^image\//.test(x.type) || /\.(jpe?g|png|heic|webp)$/i.test(x.name));
    if (arqs.length && !imgs.length) return setErro("Escolha um arquivo de imagem (JPG ou PNG).");
    const vagas = 20 - fotos.length; if (vagas <= 0) return setErro("Limite de 20 fotos.");
    setErro(null);
    for (const file of imgs.slice(0, vagas)) {
      try { const x = await fotoComTarja(file, { oque: "Ocorrência", ref: "INC a gerar", quem: usuario?.nome || null, gps });
        setFotos((v) => [...v, { file, url: x.dataUri, legenda: "", kb: Math.round((x.base64.length * 3) / 4 / 1024) }].slice(0, 20)); }
      catch (e) { setErro(`${file.name}: ${e.message}`); }
    }
  };
  const salvar = async () => {
    setOcupado(true); setErro(null);
    try {
      const corpo = { tipo: f.tipo, parado: !!f.parado, ocorrido_em: new Date(f.ocorrido_em).toISOString(), local: f.local || null, descricao: f.descricao, gps, inspecao_id: f.inspecao_id || null,
        ...(at ? { origem: "at", execucao_id: at.id } : { origem: "contrato", contrato_id: f.contrato_id, equipamento_id: f.equipamento_id }) };
      const r = await apiService.post(base, corpo); const oc = r.ocorrencia;
      const falhas = await enviarArquivos(base, oc, { fotos, bo, quem: usuario?.nome || null, gps });
      onCriada?.(oc, falhas);
    } catch (e) { setErro(e.message); setOcupado(false); }
  };
  const lbl = { fontSize: 12, color: C.textSub, display: "block", marginBottom: 4 };
  return <div onClick={(x) => x.stopPropagation()} style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 430, padding: 16, overflowY: "auto" }}>
    <div role="dialog" aria-modal="true" aria-label="Registrar ocorrência" style={{ ...s.card, width: 640, maxWidth: "100%", padding: 20, marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}><b style={{ flex: 1, fontSize: 16 }}>⚠️ Registrar ocorrência</b><button type="button" aria-label="Fechar" onClick={onFechar} style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>✕</button></div>
      <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 14 }}>{at ? <>Pela <b>{at.numero}</b> — motorista, conjunto, carga, documentos e última posição entram sozinhos.</> : <>Escolha o equipamento — contrato, modelo, série, local e a última inspeção entram sozinhos.</>} O comercial recebe o aviso na hora.</div>
      {!at && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginBottom: 10 }}>
        <label><span style={lbl}>Contrato *</span><select aria-label="Contrato" value={f.contrato_id} onChange={(e) => setF({ ...f, contrato_id: e.target.value, equipamento_id: "" })} style={{ ...s.input, marginBottom: 0 }}>
          <option value="">{ops ? "Escolha…" : "Carregando…"}</option>{(ops || []).map((c) => <option key={c.id} value={c.id}>{c.numero}{c.cliente ? ` · ${c.cliente}` : ""}</option>)}</select></label>
        <label><span style={lbl}>Equipamento *</span><select aria-label="Equipamento" value={f.equipamento_id} disabled={!contrato} onChange={(e) => setF({ ...f, equipamento_id: e.target.value })} style={{ ...s.input, marginBottom: 0 }}>
          <option value="">Escolha…</option>{(contrato?.equipamentos || []).map((e) => <option key={e.equipamento_id} value={e.equipamento_id}>{[e.tag, e.nome, e.modelo].filter(Boolean).join(" — ")}{e.serie ? ` · série ${e.serie}` : ""}</option>)}</select></label>
      </div>}
      <span style={lbl}>O que aconteceu? *</span>
      <div role="radiogroup" aria-label="Tipo" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {Object.entries(TIPOS_OC).map(([k, t]) => <button key={k} type="button" role="radio" aria-checked={f.tipo === k} onClick={() => setF({ ...f, tipo: k })} style={{ ...s.btn(f.tipo === k), padding: "7px 12px", fontSize: 12.5, cursor: "pointer" }}>{t}</button>)}
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: 10, borderRadius: 8, border: `1px solid ${f.parado ? C.danger : C.border}`, marginBottom: 10, cursor: "pointer" }}>
        <input type="checkbox" aria-label="Equipamento parado" checked={f.parado} onChange={(e) => setF({ ...f, parado: e.target.checked })} style={{ marginTop: 2 }} />
        <span style={{ fontSize: 13 }}><b>⛔ O equipamento está parado</b><br /><span style={{ fontSize: 12, color: C.textSub }}>Só avisa — o comercial decide o que fazer (troca, atendimento, medição).</span></span>
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10, marginBottom: 10 }}>
        <label><span style={lbl}>Quando *</span><input type="datetime-local" aria-label="Data e hora" value={f.ocorrido_em} max={agoraLocal()} onChange={(e) => setF({ ...f, ocorrido_em: e.target.value })} style={{ ...s.input, marginBottom: 0 }} /></label>
        <label><span style={lbl}>Onde</span><input aria-label="Local" value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} placeholder={contrato?.local || (at ? "Rodovia, km, cidade" : "Local na obra")} style={{ ...s.input, marginBottom: 0 }} /></label>
      </div>
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: -4, marginBottom: 10 }}>{gps ? `📍 GPS ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : "📍 sem GPS (permita a localização para registrar o ponto)"}</div>
      <label><span style={lbl}>Descrição *</span><textarea aria-label="Descrição" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} rows={4} placeholder="O que aconteceu, como, quem estava, o que já foi feito" style={{ ...s.input, width: "100%", resize: "vertical" }} /></label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "6px 0 8px" }}>
        <label style={{ ...s.btn(false), padding: "7px 12px", fontSize: 12.5, cursor: "pointer", color: C.text }}>📷 Fotos<input ref={ref} type="file" aria-label="Fotos" accept="image/*" multiple capture="environment" style={{ display: "none" }} onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ""; addFotos(fs); }} /></label>
        <label style={{ ...s.btn(false), padding: "7px 12px", fontSize: 12.5, cursor: "pointer", color: bo ? C.accent : C.text }}>{bo ? `✓ ${bo.name}` : "📄 Boletim de ocorrência (BO)"}<input type="file" aria-label="Boletim de ocorrência" accept=".pdf,image/*" style={{ display: "none" }} onChange={(e) => { setBo(e.target.files?.[0] || null); e.target.value = ""; }} /></label>
        <span style={{ fontSize: 11.5, color: C.muted }}>{fotos.length}/20 · fotos comprimidas, com a tarja de rastreabilidade embaixo (o nº da ocorrência entra ao registrar)</span>
      </div>
      {fotos.length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        {fotos.map((x, i) => <div key={x.url} style={{ position: "relative", width: 92 }}>
          <img src={x.url} alt={`foto ${i + 1}`} title="Clique para ampliar" onClick={() => setVerFoto(x)} style={{ width: 92, height: 92, objectFit: "cover", objectPosition: "bottom", borderRadius: 6, border: `1px solid ${C.border}`, cursor: "zoom-in" }} />
          <div style={{ fontSize: 10, color: C.muted, textAlign: "center" }}>{x.kb} KB</div>
          <button type="button" aria-label={`Tirar foto ${i + 1}`} onClick={() => setRemover(i)} style={{ position: "absolute", top: 2, right: 2, background: C.danger, color: "#fff", border: "none", borderRadius: 10, width: 20, height: 20, cursor: "pointer", fontSize: 11 }}>×</button>
          <input aria-label={`Legenda da foto ${i + 1}`} value={x.legenda} onChange={(e) => setFotos((v) => v.map((y, j) => (j === i ? { ...y, legenda: e.target.value } : y)))} placeholder="legenda" style={{ ...s.input, width: 92, fontSize: 11, padding: "3px 5px", marginTop: 3, marginBottom: 0 }} />
        </div>)}
      </div>}
      {verFoto && <div onClick={() => setVerFoto(null)} style={{ position: "fixed", inset: 0, background: "#000000d0", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 440, padding: 16, cursor: "zoom-out" }}>
        <ImagemZoom src={verFoto.url} alt="foto ampliada" style={{ width: "min(96vw, 1400px)", height: "88vh" }} /></div>}
      {remover != null && <div onClick={(x) => x.stopPropagation()} style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 440, padding: 16 }}>
        <div role="dialog" aria-label="Remover foto" style={{ ...s.card, width: 360, maxWidth: "100%", padding: 18 }}>
          <div style={{ fontSize: 14, marginBottom: 12 }}>Remover a foto {remover + 1}?</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setRemover(null)} style={{ ...s.btn(false), color: C.text, padding: "6px 14px", cursor: "pointer" }}>Cancelar</button>
            <button type="button" onClick={() => { setFotos((v) => v.filter((_, j) => j !== remover)); setRemover(null); }} style={{ ...s.btn(true, C.danger), padding: "6px 14px", cursor: "pointer" }}>Remover</button>
          </div></div></div>}
      {erro && <div style={{ color: C.danger, fontSize: 12.5, marginTop: 8 }}>{erro}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
        <button type="button" onClick={onFechar} style={{ ...s.btn(false), color: C.text, padding: "8px 16px", cursor: "pointer" }}>Cancelar</button>
        <button type="button" disabled={!pode} onClick={salvar} style={{ ...s.btn(true), padding: "8px 18px", cursor: pode ? "pointer" : "not-allowed", opacity: pode ? 1 : 0.5 }}>{ocupado ? "Registrando…" : "⚠️ Registrar ocorrência"}</button>
      </div>
    </div>
  </div>;
}
