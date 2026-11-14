// components/contratos/AvisoHorimetro.jsx — etapa 18zf.4: ⏱ o contrato cobra por HORA (ou tem FRANQUIA) ↔ o CHECKLIST pede horímetro?
//   Antes as duas pontas não conversavam: o contrato cobrava por hora, o checklist não pedia horímetro e a medição chegava
//   "sem leitura" sem ninguém saber onde informar. Aqui o aviso já vem com a ação:
//     • checklist sem o campo  → "Ligar horímetro no checklist X" (confirma antes: vale para todo equipamento que usa esse checklist)
//     • sem checklist          → "Ir para 🔍 Inspeções" (definir rotina/checklist do equipamento)
//     • tudo certo (na medição) → diz ONDE as horas são informadas e por quem
import { useState } from "react";
import apiService from "../../services/apiService";

const QUEM = { locatario: "o cliente (locatário)", empresa: "a sua equipe", padrao: "quem fizer a inspeção" };
const COB = { hora: "por hora", mensal: "com franquia de horas" };

export default function AvisoHorimetro({ C, s, d, editar = false, onMudou, medicao = false }) {
  const [conf, setConf] = useState(false); const [ocupado, setOcupado] = useState(false); const [erro, setErro] = useState(null);
  if (!d) return null;
  const alvo = d.modelos.find((m) => m.responsavel === "locatario") || d.modelos[0];
  const comH = d.modelos.find((m) => m.campos.includes("horimetro"));
  const bt = (cor, cheio) => ({ ...s.btn(cheio, cor), padding: "4px 10px", fontSize: 12, ...(cheio ? { background: cor, borderColor: cor, color: "#fff" } : { color: cor }), cursor: "pointer" });
  const ligar = async () => {
    setOcupado(true); setErro(null);
    try { await apiService.put(`/inspecoes/modelos/${alvo.id}`, { campos: [...new Set([...(alvo.campos || []), "horimetro"])] }); setConf(false); onMudou?.(); }
    catch (e) { setErro(e?.response?.data?.erro || e.message || "Não foi possível ligar o horímetro"); } finally { setOcupado(false); }
  };
  if (d.ok) {
    if (!medicao) return null;
    return <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>informado no checklist “{comH.nome}” por {QUEM[comH.responsavel]} — precisa de 2 leituras cobrindo o ciclo</div>;
  }
  return <div style={{ fontSize: 12, color: C.warn, marginTop: 4, whiteSpace: "normal" }}>
    ⏱ Cobra {COB[d.cobranca] || "por hora"}, mas {d.motivo === "sem_campo" ? <>o checklist <b>“{alvo.nome}”</b> não pede horímetro</> : <>o equipamento não tem checklist de inspeção</>} — ninguém vai informar as horas.
    {editar && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
      {d.motivo === "sem_campo" && !conf && <button type="button" onClick={() => setConf(true)} style={bt(C.accent, false)}>⏱ Ligar horímetro no checklist “{alvo.nome}”</button>}
      {d.motivo === "sem_campo" && conf && <>
        <span style={{ color: C.text }}>O horímetro passa a ser <b>obrigatório</b> em toda inspeção com “{alvo.nome}”{d.modelos.length > 1 || alvo.responsavel !== "locatario" ? "" : " (inclusive a do cliente)"} — em qualquer equipamento que use esse checklist.</span>
        <button type="button" disabled={ocupado} onClick={() => setConf(false)} style={bt(C.muted, false)}>Cancelar</button>
        <button type="button" disabled={ocupado} onClick={ligar} style={bt(C.accent, true)}>{ocupado ? "Ligando…" : "Ligar"}</button></>}
      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("qf-ir-tela", { detail: "inspecoes" }))} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 12, padding: 0 }}>{d.motivo === "sem_checklist" ? "Definir checklist em 🔍 Inspeções ›" : "ou ajustar em 🔍 Inspeções ›"}</button>
    </div>}
    {erro && <div style={{ color: C.danger }}>{erro}</div>}
  </div>;
}
