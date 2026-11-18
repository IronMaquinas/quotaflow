// components/pessoas/FichaFeriasFaltas.jsx — etapa B1.6: na FICHA do colaborador (sem precisar clicar em Editar)
//   📅 admissão e tempo de casa · 🏖 saldo de férias (regras do país) · ⚠ faltas injustificadas (reduzem os dias de férias)
import { useEffect, useState } from "react";
import apiService from "../../services/apiService";

const dBR = (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");
const hojeBR = () => new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
function tempoDeCasa(adm) {
  if (!adm) return null; const [a, m, d] = adm.split("-").map(Number); const [ha, hm, hd] = hojeBR().split("-").map(Number);
  let meses = (ha - a) * 12 + (hm - m) - (hd < d ? 1 : 0); if (meses < 0) return "ainda não começou";
  const anos = Math.floor(meses / 12); meses %= 12;
  return [anos ? `${anos} ano${anos > 1 ? "s" : ""}` : "", meses ? `${meses} ${meses > 1 ? "meses" : "mês"}` : ""].filter(Boolean).join(" e ") || "menos de 1 mês";
}

export default function FichaFeriasFaltas({ C, s, colaborador, editar, excluir }) {
  const [saldo, setSaldo] = useState(null); const [faltas, setFaltas] = useState(null); const [nova, setNova] = useState(null); const [erro, setErro] = useState(""); const [salvando, setSalvando] = useState(false);
  const id = colaborador.id; const adm = colaborador.admissao ? String(colaborador.admissao).slice(0, 10) : null;
  const carregar = () => {
    apiService.get(`/pessoas/ferias/saldos?colaborador_id=${id}`).then((r) => setSaldo(r.colaboradores?.[0] || null)).catch(() => setSaldo(null));
    apiService.get(`/pessoas/colaboradores/${id}/faltas`).then((r) => setFaltas(r.faltas || [])).catch((e) => setFaltas({ erro: e?.response?.data?.erro || e.message }));
  };
  useEffect(carregar, [id]); // eslint-disable-line
  const salvar = async () => {
    setErro(""); setSalvando(true);
    try { await apiService.post(`/pessoas/colaboradores/${id}/faltas`, nova); setNova(null); carregar(); }
    catch (e) { setErro(e?.response?.data?.erro || e.message); } finally { setSalvando(false); }
  };
  const p = saldo?.atual; const ALR = { vencido: ["⛔ período vencido", C.danger], critico: ["⚠ vence em até 30 dias", C.warn], vencendo: ["vence em até 60 dias", "#eab308"] }[saldo?.alerta];
  const total = Array.isArray(faltas) ? faltas.reduce((t, f) => t + Number(f.dias || 1), 0) : 0;

  return (
    <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px" }}>
        <div style={{ fontSize: 11, color: C.textSub, fontWeight: 600 }}>📅 ADMISSÃO</div>
        {adm ? <><div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{dBR(adm)}</div><div style={{ fontSize: 12, color: C.textSub }}>{tempoDeCasa(adm)} de casa</div></>
          : <div style={{ fontSize: 12.5, color: C.warn, marginTop: 4 }}>Não informada — preencha em Editar (é a base do cálculo das férias).</div>}
      </div>
      <div style={{ border: `1px solid ${ALR ? ALR[1] : C.border}`, borderRadius: 8, padding: "10px 12px" }}>
        <div style={{ fontSize: 11, color: C.textSub, fontWeight: 600 }}>🏖 FÉRIAS</div>
        {!adm ? <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>Sem admissão, sem cálculo.</div>
          : !saldo ? <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>…</div>
          : !p ? <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>Nada a gozar.</div>
          : <>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{p.situacao === "em_aquisicao" ? "Em aquisição" : `${saldo.a_gozar} dia(s) a gozar`}</div>
            <div style={{ fontSize: 12, color: C.textSub }}>Período {dBR(p.inicio)} a {dBR(p.fim)} · direito {p.direito}{p.programado ? ` · ${p.programado} programado(s)` : ""}{p.situacao !== "em_aquisicao" ? ` · limite ${dBR(p.limite)}` : ""}</div>
            {ALR && <div style={{ fontSize: 12, color: ALR[1], fontWeight: 600, marginTop: 2 }}>{ALR[0]}</div>}
          </>}
      </div>
      <div style={{ border: `1px solid ${total > 5 ? C.warn : C.border}`, borderRadius: 8, padding: "10px 12px", gridColumn: "1 / -1" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, color: C.textSub, fontWeight: 600, flex: 1 }}>⚠ FALTAS INJUSTIFICADAS {Array.isArray(faltas) && faltas.length > 0 && <span style={{ fontWeight: 400 }}>· {total} dia(s) no total{p && p.faltas ? ` · ${p.faltas} no período aquisitivo` : ""}</span>}</div>
          {editar && !nova && <button type="button" onClick={() => { setErro(""); setNova({ data: hojeBR(), dias: 1, obs: "" }); }} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 10px", fontSize: 12, color: C.accent }}>＋ Registrar falta</button>}
        </div>
        {p && p.faltas > 5 && <div style={{ fontSize: 12, color: C.warn, marginTop: 4 }}>🧠 {p.faltas} faltas no período aquisitivo — o direito de férias caiu para {p.direito} dias.</div>}
        {nova && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 8 }}>
          <label style={{ flex: "1 1 140px" }}><span style={s.label}>1º dia</span><input type="date" max={hojeBR()} value={nova.data} onChange={(e) => setNova({ ...nova, data: e.target.value })} style={s.input} /></label>
          <label style={{ flex: "0 1 90px" }}><span style={s.label}>Dias</span><input type="number" min={1} max={60} value={nova.dias} onChange={(e) => setNova({ ...nova, dias: e.target.value })} style={s.input} /></label>
          <label style={{ flex: "2 1 200px" }}><span style={s.label}>Observação</span><input value={nova.obs} onChange={(e) => setNova({ ...nova, obs: e.target.value })} placeholder="opcional" style={s.input} /></label>
          <button type="button" onClick={() => setNova(null)} disabled={salvando} style={{ ...s.btn(false), cursor: "pointer" }}>Cancelar</button>
          <button type="button" onClick={salvar} disabled={salvando || !nova.data} style={{ ...s.btn(true), cursor: "pointer" }}>{salvando ? "…" : "Salvar"}</button>
        </div>}
        {erro && <div style={{ color: C.danger, fontSize: 12.5, marginTop: 6 }}>⚠ {erro}</div>}
        {faltas?.erro ? <div style={{ fontSize: 12, color: C.warn, marginTop: 6 }}>{faltas.erro}</div>
          : Array.isArray(faltas) && (faltas.length === 0 ? !nova && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>Nenhuma falta injustificada registrada.</div>
          : <div style={{ marginTop: 6 }}>{faltas.slice(0, 12).map((f) => (
            <div key={f.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, padding: "4px 0", borderTop: `1px solid ${C.border}` }}>
              <span style={{ flex: 1 }}>{dBR(f.data)}{f.dias > 1 ? ` · ${f.dias} dias` : ""}{f.obs ? <span style={{ color: C.textSub }}> · {f.obs}</span> : ""}{f.criado_por_nome ? <span style={{ color: C.muted }}> · por {f.criado_por_nome}</span> : ""}</span>
              {editar && <button type="button" onClick={() => excluir("Excluir falta", `Excluir a falta de ${dBR(f.data)}${f.dias > 1 ? ` (${f.dias} dias)` : ""}?`, async () => { await apiService.delete(`/pessoas/faltas/${f.id}`); carregar(); return "Falta excluída."; })}
                style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 12 }}>Excluir</button>}
            </div>))}{faltas.length > 12 && <div style={{ fontSize: 11.5, color: C.muted }}>…e mais {faltas.length - 12}</div>}</div>)}
      </div>
    </div>
  );
}
