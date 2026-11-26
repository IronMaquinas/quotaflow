// components/turismo/MapaPoltronas.jsx — etapa T1: desenho do ônibus visto de cima (um ou dois pisos)
//   status da poltrona: livre · selecionada · reservada (passageiro) · incompleta (falta dado) · bloqueada. Arrastar passageiro → outra poltrona = mover/trocar.
const ICONE = { mot: "🧑‍✈️", porta: "🚪", escada: "🪜", wc: "🚻", gel: "🧊", mesa: "▭" };
export const COR = { livre: "#1f6f43", sel: "#2f6fdf", res: "#8a5a12", inc: "#a3402e", bloq: "#4b4f58" };

export default function MapaPoltronas({ layout, passageiros = [], bloqueadas = [], selecionadas = [], onClique, onSoltar, editor = false, C }) {
  const dono = (n) => passageiros.find((p) => String(p.poltrona) === String(n));
  const estado = (n) => (selecionadas.includes(String(n)) ? "sel" : bloqueadas.includes(String(n)) ? "bloq" : dono(n) ? (dono(n).incompleto ? "inc" : "res") : "livre");
  const cel = { width: 46, height: 42, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, userSelect: "none" };
  return <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
    {(layout?.pisos || []).map((piso, pi) => <div key={pi} style={{ border: `2px solid ${C.border}`, borderRadius: "28px 28px 10px 10px", padding: "14px 10px 10px", background: C.surface || "rgba(255,255,255,.03)" }}>
      <div style={{ fontSize: 11, color: C.textSub, textAlign: "center", marginBottom: 8 }}>▲ FRENTE · {piso.nome}</div>
      <div style={{ display: "grid", gap: 5 }}>
        {(piso.linhas || []).map((lin, li) => <div key={li} style={{ display: "flex", gap: 5 }}>
          {lin.map((c, ci) => {
            const k = `${pi}-${li}-${ci}`; const ponto = { pi, li, ci };
            if (c.t === "p") { const e = estado(c.n); const p = dono(c.n);
              return <div key={k} title={p ? `${c.n} — ${p.nome}${p.menor ? " (menor)" : ""}` : e === "bloq" ? `${c.n} — bloqueada` : `${c.n} — livre`}
                draggable={!!p && !!onSoltar} onDragStart={(ev) => ev.dataTransfer.setData("text/plain", String(p.id))}
                onDragOver={(ev) => onSoltar && ev.preventDefault()} onDrop={(ev) => { ev.preventDefault(); const id = ev.dataTransfer.getData("text/plain"); if (id && onSoltar) onSoltar(id, c.n); }}
                onClick={() => onClique?.(c, ponto, p)}
                style={{ ...cel, cursor: onClique ? "pointer" : "default", background: COR[e], color: "#fff", flexDirection: "column", lineHeight: 1.05, border: e === "sel" ? "2px solid #fff" : "2px solid transparent" }}>
                <b>{c.n || "?"}</b>{p && <span style={{ fontSize: 9, maxWidth: 42, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{String(p.nome).split(" ")[0]}</span>}
              </div>; }
            if (c.t === "c") return <div key={k} onClick={() => editor && onClique?.(c, ponto)} style={{ ...cel, width: 22, cursor: editor ? "pointer" : "default", border: editor ? `1px dashed ${C.border}` : "none" }} />;
            if (c.t === "x") return <div key={k} onClick={() => editor && onClique?.(c, ponto)} style={{ ...cel, cursor: editor ? "pointer" : "default", border: editor ? `1px dashed ${C.border}` : "none" }} />;
            return <div key={k} onClick={() => editor && onClique?.(c, ponto)} title={c.t} style={{ ...cel, cursor: editor ? "pointer" : "default", background: "rgba(255,255,255,.06)", fontSize: 18 }}>{ICONE[c.t] || "·"}</div>;
          })}
        </div>)}
      </div>
    </div>)}
  </div>;
}

export function Legenda({ C }) {
  return <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: C.textSub }}>
    {[["livre", "Livre"], ["res", "Reservada"], ["inc", "Falta dado"], ["bloq", "Bloqueada"], ["sel", "Selecionada"]].map(([k, l]) => <span key={k} style={{ display: "flex", gap: 5, alignItems: "center" }}><i style={{ width: 13, height: 13, borderRadius: 3, background: COR[k], display: "inline-block" }} />{l}</span>)}
  </div>;
}
