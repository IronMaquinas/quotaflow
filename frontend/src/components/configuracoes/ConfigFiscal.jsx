// components/configuracoes/ConfigFiscal.jsx — etapa 18g.1: 🧾 antecedência da tarefa fiscal do transporte
//   A tarefa TSK-TR de cada trecho do pedido vence N dias úteis (seg a sex, sem feriados) antes da data do transporte. Padrão: 2 (D-2).
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";

export default function ConfigFiscal({ C, s, onErro }) {
  const [cfg, setCfg] = useState(null);
  const [n, setN] = useState("2");
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  useEffect(() => { apiService.get("/configuracoes/fiscal").then((r) => { setCfg(r); setN(String(r.antecedencia_dias ?? 2)); }).catch((e) => onErro?.(e.message)); }, []); // eslint-disable-line
  if (!cfg) return null;
  const valido = /^\d+$/.test(n) && Number(n) <= 30;
  const salvar = async () => {
    setSalvando(true); setOk(false);
    try { const r = await apiService.put("/configuracoes/fiscal", { antecedencia_dias: Number(n) }); setCfg(r); setN(String(r.antecedencia_dias)); setOk(true); setTimeout(() => setOk(false), 3000); }
    catch (e) { onErro?.(e.message); } finally { setSalvando(false); }
  };
  return <div style={{ ...s.card, padding: 18, marginTop: 16 }}>
    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🧾 Documentos fiscais do transporte</div>
    <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12 }}>Quando o BID é aprovado, cada trecho do pedido ganha uma tarefa <b>TSK-TR</b> no ✅ Plano para o time fiscal (e o gestor): NF-e → CT-e → averbação → MDF-e. O prazo é esta quantidade de <b>dias úteis antes do transporte</b>.</div>
    {cfg.migrou === false && <div style={{ fontSize: 12.5, color: C.warn, marginBottom: 10 }}>⚠️ Rode a migration 066 para salvar — até lá vale D-2.</div>}
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 13 }}>Prazo: D −</span>
      <input aria-label="Dias úteis de antecedência" value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, "").slice(0, 2))} style={{ ...s.input, width: 70, marginBottom: 0, textAlign: "center" }} />
      <span style={{ fontSize: 13, color: C.textSub }}>dia(s) úteis</span>
      <button type="button" onClick={salvar} disabled={salvando || !valido} style={{ ...s.btn(!salvando && valido), padding: "9px 18px", fontSize: 13, cursor: "pointer" }}>{salvando ? "Salvando…" : "Salvar"}</button>
      {ok && <span style={{ fontSize: 12.5, color: C.success || "#16a34a" }}>✓ salvo — vale para as próximas mudanças de data</span>}
    </div>
  </div>;
}
