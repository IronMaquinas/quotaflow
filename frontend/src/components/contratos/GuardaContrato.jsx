// components/contratos/GuardaContrato.jsx — etapa 18za.1: 📦 guarda no pátio dentro do contrato
//   Cobrando: condições (preço, unidade, mínimo) + o que o ciclo atual já acumulou até hoje (prévia da medição).
//   Não cobrando, mas o cliente tem equipamento no pátio: aviso para ligar a cobrança.
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";

const brl = (v, max = 2) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: max });
const m2 = (v) => Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const dBR = (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");

export default function GuardaContrato({ C, s, contrato, editar, onEditar }) {
  const [g, setG] = useState(null);
  const chave = [contrato.id, contrato.arm_ativo, contrato.arm_preco, contrato.arm_unidade, contrato.arm_minimo_m2].join("|");
  useEffect(() => { let vivo = true; apiService.get(`/contratos/${contrato.id}/guarda`).then((r) => vivo && setG(r)).catch(() => vivo && setG(null)); return () => { vivo = false; }; }, [chave]); // eslint-disable-line
  if (!g || g.sem_patio) return null;
  const irPatio = () => window.dispatchEvent(new CustomEvent("qf-ir-tela", { detail: "patio" }));
  if (!g.ativo) {
    if (!g.no_patio) return null;
    return <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, color: C.warn, border: `1px dashed ${C.warn}`, borderRadius: 8, padding: "8px 12px", marginTop: 14 }}>
      <span style={{ flex: 1, minWidth: 220 }}>📦 Este cliente tem <b>{g.no_patio} equipamento(s) no pátio</b>{g.m2_no_patio ? ` (${m2(g.m2_no_patio)} m²)` : ""} e a guarda <b>não está sendo cobrada</b> neste contrato.</span>
      {editar && <button type="button" onClick={onEditar} style={{ ...s.btn(false), padding: "6px 12px", fontSize: 12 }}>✎ Ligar a cobrança</button>}</div>;
  }
  const un = g.unidade === "m2_dia" ? "m² ao dia" : "m² ao mês";
  return <div style={{ marginTop: 16 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
      <div style={{ fontWeight: 700 }}>📦 Guarda no pátio</div><span style={s.tag(C.success)}>COBRANDO</span><span style={{ flex: 1 }} />
      <button type="button" onClick={irPatio} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 12.5, padding: 0 }}>abrir o pátio ›</button></div>
    <div style={{ fontSize: 13, color: C.textSub, marginBottom: 6 }}><b style={{ color: C.text }}>{brl(g.preco, 4)} por {un}</b>{g.minimo_m2 ? ` · mínimo contratado ${m2(g.minimo_m2)} m²/mês` : " · sem mínimo"} · no pátio agora: <b style={{ color: C.text }}>{g.no_patio} equipamento(s){g.m2_no_patio ? `, ${m2(g.m2_no_patio)} m²` : ""}</b></div>
    {g.itens.length > 0 ? <>
      {g.itens.map((i) => <div key={i.locacao_id} style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
        <span style={{ flex: "1 1 220px" }}><b>{i.tag}</b> — {i.nome.replace(/^📦 Guarda no pátio — /, "")}<div style={{ fontSize: 11, color: i.area_m2 == null ? C.warn : C.muted }}>{i.base}{i.saiu_em ? ` · saiu ${dBR(i.saiu_em)}` : ""}</div></span>
        <span style={{ color: C.textSub, fontSize: 12 }}>{i.dias} dia(s)</span><b style={{ minWidth: 90, textAlign: "right" }}>{i.valor != null ? brl(i.valor) : "—"}</b></div>)}
      <div style={{ display: "flex", gap: 8, fontSize: 13, paddingTop: 6 }}><span style={{ flex: 1, color: C.textSub }}>Ciclo {dBR(g.ciclo.inicio)} a {dBR(g.ciclo.fim)} — acumulado até hoje ({m2(g.m2_dia)} m²·dia){g.minimo_m2 ? "; o mínimo entra na medição do fim do ciclo" : ""}</span><b>{brl(g.parcial)}</b></div>
      {g.sem_m2 > 0 && <div style={{ fontSize: 12, color: C.warn, marginTop: 4 }}>⚠ {g.sem_m2} equipamento(s) no pátio sem m² — informe na ficha do pátio, senão ficam sem valor na medição.</div>}
    </> : <div style={{ fontSize: 13, color: C.muted, padding: "4px 0" }}>Nenhum equipamento deste cliente no pátio neste ciclo.{g.minimo_m2 ? ` A medição cobra o mínimo contratado (${m2(g.minimo_m2)} m²/mês).` : ""}</div>}
  </div>;
}
