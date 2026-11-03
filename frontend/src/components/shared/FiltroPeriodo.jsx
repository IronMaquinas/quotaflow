// components/shared/FiltroPeriodo.jsx — etapa 18c.4: pré-seletores de período (o mesmo padrão do 📊 Funil comercial)
//   Mês corrente · Últimos 3 meses · Acumulado do ano · Período (datas) [+ "Tudo", opcional]
//   valor: { preset, de, ate } — de/ate em YYYY-MM-DD (null em "Tudo")
const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "");
export function faixaPeriodo(k, atual = null) {
  const h = hoje(); const d = new Date(`${h.slice(0, 7)}-01T12:00:00Z`);
  if (k === "mes") return { preset: k, de: `${h.slice(0, 7)}-01`, ate: h };
  if (k === "tri") { d.setUTCMonth(d.getUTCMonth() - 2); return { preset: k, de: d.toISOString().slice(0, 10), ate: h }; }
  if (k === "ano") return { preset: k, de: `${h.slice(0, 4)}-01-01`, ate: h };
  if (k === "tudo") return { preset: k, de: null, ate: null };
  return { preset: "livre", de: atual?.de || `${h.slice(0, 7)}-01`, ate: atual?.ate || h };
}
export default function FiltroPeriodo({ C, s, valor, onChange, comTudo = false }) {
  const op = [["mes", "Mês corrente"], ["tri", "Últimos 3 meses"], ["ano", "Acumulado do ano"], ...(comTudo ? [["tudo", "Tudo"]] : []), ["livre", "Período"]];
  return <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
    {op.map(([k, r]) => <button key={k} type="button" onClick={() => onChange(faixaPeriodo(k, valor))}
      style={{ background: valor.preset === k ? C.accent : "transparent", color: valor.preset === k ? "#fff" : C.text, border: `1px solid ${valor.preset === k ? C.accent : C.border}`, borderRadius: 16, padding: "5px 12px", fontSize: 12.5, cursor: "pointer" }}>{r}</button>)}
    {valor.preset === "livre" ? <>
      <input type="date" value={valor.de || ""} max={valor.ate || undefined} onChange={(e) => e.target.value && onChange({ ...valor, de: e.target.value })} style={{ ...s.input, width: 150, padding: "6px 8px" }} />
      <span style={{ fontSize: 12, color: C.textSub }}>até</span>
      <input type="date" value={valor.ate || ""} min={valor.de || undefined} onChange={(e) => e.target.value && onChange({ ...valor, ate: e.target.value })} style={{ ...s.input, width: 150, padding: "6px 8px" }} />
    </> : valor.de ? <span style={{ fontSize: 12, color: C.textSub }}>{dBR(valor.de)} a {dBR(valor.ate)}</span> : null}
  </div>;
}
