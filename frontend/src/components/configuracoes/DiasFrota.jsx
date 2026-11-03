// components/configuracoes/DiasFrota.jsx — etapa 18f: 🚛 dias operacionais da frota
//   Base dos indicadores de utilização × alocação (🚚 Programação). Padrão: seg a sáb, sem feriados.
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";

const NOMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function DiasFrota({ C, s, onErro }) {
  const [cfg, setCfg] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  useEffect(() => { apiService.get("/configuracoes/frota-dias").then(setCfg).catch((e) => onErro?.(e.message)); }, []); // eslint-disable-line
  if (!cfg) return null;
  const alternar = (n) => setCfg({ ...cfg, dias_semana: cfg.dias_semana.includes(n) ? cfg.dias_semana.filter((x) => x !== n) : [...cfg.dias_semana, n].sort() });
  const salvar = async () => {
    setSalvando(true); setOk(false);
    try { const r = await apiService.put("/configuracoes/frota-dias", { dias_semana: cfg.dias_semana, descontar_feriados: cfg.descontar_feriados }); setCfg(r); setOk(true); setTimeout(() => setOk(false), 3000); }
    catch (e) { onErro?.(e.message); } finally { setSalvando(false); }
  };
  return <div style={{ ...s.card, padding: 18, marginTop: 16 }}>
    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🚛 Dias operacionais da frota</div>
    <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12 }}>Dias em que a frota pode rodar. São a base dos indicadores de <b>utilização</b> (passado) e <b>alocação</b> (futuro) de equipamentos e motoristas na 🚚 Programação.</div>
    {cfg.migrou === false && <div style={{ fontSize: 12.5, color: C.warn, marginBottom: 10 }}>⚠️ Rode a migration 064 para salvar — até lá vale o padrão (seg a sáb).</div>}
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
      {NOMES.map((r, n) => { const on = cfg.dias_semana.includes(n); return <button key={n} type="button" onClick={() => alternar(n)} aria-pressed={on}
        style={{ minWidth: 52, padding: "7px 10px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", background: on ? C.accent : "transparent", color: on ? "#fff" : C.textSub, border: `1px solid ${on ? C.accent : C.border}` }}>{r}</button>; })}
    </div>
    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 14 }}>
      <input type="checkbox" checked={cfg.descontar_feriados} onChange={(e) => setCfg({ ...cfg, descontar_feriados: e.target.checked })} /> Feriados (aba Feriados) não contam como dia operacional
    </label>
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <button type="button" onClick={salvar} disabled={salvando || !cfg.dias_semana.length} style={{ ...s.btn(!salvando && cfg.dias_semana.length > 0), padding: "9px 18px", fontSize: 13, cursor: "pointer" }}>{salvando ? "Salvando…" : "Salvar dias da frota"}</button>
      <span style={{ fontSize: 12.5, color: C.muted }}>{cfg.dias_semana.length} dia(s) por semana</span>
      {ok && <span style={{ fontSize: 12.5, color: C.success || "#16a34a" }}>✓ salvo</span>}
    </div>
  </div>;
}
