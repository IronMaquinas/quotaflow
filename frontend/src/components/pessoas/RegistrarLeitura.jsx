// components/pessoas/RegistrarLeitura.jsx — etapa 18zz.14: 🧾 a gestão registra a leitura POR outra pessoa
//   Para quem não tem login ou leu em reunião / treinamento presencial. Justificativa obrigatória; lista de presença (foto ou PDF) opcional.
//   Fica no histórico como "registrada por X" — separado da confirmação feita pela própria pessoa no app.
import { useState } from "react";
import apiService from "../../services/apiService";
import { Toggle } from "../../plataforma/ModulosPlataforma";
import { comprimirImagem } from "../../utils/comprimirImagem";

const lerB64 = (blobOuFile) => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = () => erro(new Error("Não consegui ler o arquivo")); r.readAsDataURL(blobOuFile); });

export default function RegistrarLeitura({ C, s, doc, pendentes, onFechar, onFeito, onErro }) {
  const [sel, setSel] = useState(() => new Set());
  const [just, setJust] = useState(""); const [ev, setEv] = useState(null); const [ocup, setOcup] = useState(false);
  const todos = pendentes.length > 0 && sel.size === pendentes.length;
  const tog = (id) => setSel((x) => { const n = new Set(x); n.has(String(id)) ? n.delete(String(id)) : n.add(String(id)); return n; });
  const anexar = async (f) => {
    if (!f) return;
    try {
      if (/^image\//.test(f.type)) { const c = await comprimirImagem(f, { lado: 1800, qualidade: 0.8 }); setEv({ base64: await lerB64(c.blob), mime: c.mime, nome: f.name.replace(/\.\w+$/, "") + ".jpg", previa: c.dataUrl }); }
      else setEv({ base64: await lerB64(f), mime: f.type || "application/pdf", nome: f.name });
    } catch (e) { onErro?.(e.message); }
  };
  const ok = sel.size > 0 && just.trim().length >= 10;
  const salvar = async () => {
    setOcup(true);
    try {
      const r = await apiService.post(`/pessoas/gestao/${doc.id}/leitura-por`, { colaboradores: [...sel], justificativa: just.trim(), evidencia: ev ? { base64: ev.base64, mime: ev.mime, nome: ev.nome } : null });
      onFeito?.(`Leitura registrada para ${r.registradas} pessoa(s)${r.ja ? ` · ${r.ja} já tinha(m) lido` : ""}.`);
    } catch (e) { onErro?.(e?.response?.data?.erro || e.message); } finally { setOcup(false); }
  };
  return (
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "#000000aa", zIndex: 95, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: "min(560px, 100%)", padding: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>🧾 Registrar leitura por outra pessoa</div>
        <div style={{ fontSize: 12, color: C.textSub, margin: "4px 0 12px" }}>{doc.codigo} · Rev. {String(doc.revisao ?? 0).padStart(2, "0")} — para quem não tem login ou leu em reunião / treinamento presencial. Fica registrado como <b>"registrada por você"</b>, com a justificativa.</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ ...s.label, flex: 1, margin: 0 }}>QUEM LEU ({sel.size} de {pendentes.length})</span>
          <button type="button" onClick={() => setSel(todos ? new Set() : new Set(pendentes.map((p) => String(p.id))))} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 12.5 }}>{todos ? "Desmarcar todos" : "Marcar todos"}</button>
        </div>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, maxHeight: 240, overflowY: "auto", marginBottom: 12 }}>
          {pendentes.map((p) => (
            <div key={p.id} onClick={() => tog(p.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}>
              <span style={{ flex: 1, fontSize: 13.5 }}>{p.nome}{p.sem_login && <span style={{ fontSize: 11.5, color: C.muted }}> · sem login</span>}</span>
              <span onClick={(e) => e.stopPropagation()}><Toggle C={C} ligado={sel.has(String(p.id))} onChange={() => tog(p.id)} rotulo={p.nome} /></span>
            </div>))}
        </div>
        <label style={{ display: "block", marginBottom: 12 }}><span style={s.label}>JUSTIFICATIVA (OBRIGATÓRIA)</span>
          <textarea rows={3} value={just} onChange={(e) => setJust(e.target.value)} placeholder="Ex.: leitura feita no treinamento presencial de 14/11 — lista de presença anexa" style={{ ...s.input, minHeight: 72, resize: "vertical", fontFamily: "inherit" }} />
          {just.trim().length > 0 && just.trim().length < 10 && <span style={{ fontSize: 11.5, color: C.warn }}>Descreva um pouco mais (mín. 10 caracteres).</span>}
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ color: C.textSub }}>Lista de presença (opcional):</span>
          {ev ? <>{ev.previa ? <img src={ev.previa} alt="" style={{ height: 44, borderRadius: 4 }} /> : null}<b>{ev.nome}</b><button type="button" onClick={() => setEv(null)} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 12.5 }}>Remover</button></>
            : <label style={{ color: C.accent, cursor: "pointer" }}>📎 Anexar foto ou PDF<input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => anexar(e.target.files?.[0])} /></label>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onFechar} style={{ ...s.btn(false), flex: 1, cursor: "pointer", color: C.text }}>Cancelar</button>
          <button type="button" disabled={!ok || ocup} onClick={salvar} style={{ ...s.btn(true), flex: 1.4, cursor: ok ? "pointer" : "not-allowed", opacity: ok ? 1 : 0.6 }}>{ocup ? "Registrando…" : `🧾 Registrar ${sel.size || ""} leitura(s)`}</button>
        </div>
      </div>
    </div>
  );
}
