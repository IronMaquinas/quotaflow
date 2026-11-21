// components/auditorias/MatrizIso.jsx — etapa A1.4: 🧭 matriz ISO 9001 × documentos de gestão
//   Cada item da norma com os documentos que o atendem (✱ = sugerido pela "Norma / referência", sem marcação manual);
//   em vermelho os itens SEM documento (lacunas). Usada na tela de Documentos (botão 🧭 Matriz ISO).
import { useEffect, useState } from "react";
import apiService from "../../services/apiService";

export default function MatrizIso({ C, s, onFechar, onAbrirDoc }) {
  const [d, setD] = useState(null); const [erro, setErro] = useState(""); const [so, setSo] = useState(false);
  useEffect(() => { apiService.get("/auditorias/matriz-documentos").then(setD).catch((e) => setErro(e?.response?.data?.erro || e.message)); }, []);
  return <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 300, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 12px", overflowY: "auto" }}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: "min(980px, 100%)", padding: "18px 20px" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}><div style={{ fontSize: 18, fontWeight: 800, flex: 1 }}>🧭 Matriz ISO 9001 × documentos</div>
        <label style={{ fontSize: 12.5, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={so} onChange={(e) => setSo(e.target.checked)} />só lacunas</label>
        <button type="button" onClick={onFechar} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>Fechar</button></div>
      {erro && <div style={{ color: C.danger }}>{erro}</div>}
      {!d && !erro && <div style={{ color: C.muted }}>Carregando…</div>}
      {d && <>
        <div style={{ fontSize: 13, color: C.textSub, marginBottom: 10 }}><b style={{ color: d.resumo.lacunas ? C.warn : "#22c55e" }}>{d.resumo.cobertura_pct}%</b> dos {d.resumo.itens} itens da norma têm documento · <b style={{ color: d.resumo.lacunas ? C.danger : C.text }}>{d.resumo.lacunas} lacuna(s)</b>{d.resumo.docs_sem_requisito ? ` · ${d.resumo.docs_sem_requisito} documento(s) sem requisito marcado` : ""} · ✱ = sugerido pela "Norma / referência" do documento (confirme marcando os requisitos no documento)</div>
        <div style={{ display: "grid", gap: 2 }}>{d.linhas.filter((l) => !so || (!l.principal && !l.documentos.length) || (l.principal && d.linhas.some((x) => !x.principal && x.codigo.split(".")[0] === l.codigo && !x.documentos.length))).map((l) => <div key={l.codigo} style={{ display: "grid", gridTemplateColumns: "minmax(170px, 260px) 1fr", gap: 10, padding: l.principal ? "10px 0 4px" : "5px 0 5px 14px", borderTop: l.principal ? `1px solid ${C.border}` : "none", alignItems: "center" }}>
          <div style={{ fontSize: l.principal ? 13.5 : 12.5, fontWeight: l.principal ? 800 : 500, color: !l.principal && !l.documentos.length ? C.danger : C.text }}>{l.codigo} {l.nome}</div>
          {l.principal ? <div /> : <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{l.documentos.length ? l.documentos.map((x) => <button key={x.id} type="button" onClick={() => onAbrirDoc?.(x)} title={`${x.titulo}${x.revisao != null ? ` · rev. ${x.revisao}` : ""} · ${x.status}`} style={{ border: `1px solid ${x.sugerido ? C.border : C.accent}`, borderStyle: x.sugerido ? "dashed" : "solid", background: "transparent", color: C.text, borderRadius: 12, padding: "2px 9px", fontSize: 12, cursor: onAbrirDoc ? "pointer" : "default" }}>{x.codigo || x.titulo}{x.sugerido ? " ✱" : ""}</button>) : <span style={{ fontSize: 12, color: C.danger }}>⚠ nenhum documento</span>}</div>}
        </div>)}</div></>}
    </div></div>;
}
