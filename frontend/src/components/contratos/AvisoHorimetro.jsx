// components/contratos/AvisoHorimetro.jsx — etapa 18zf.4: ⏱ o contrato cobra por HORA (ou tem FRANQUIA) ↔ o CHECKLIST pede horímetro?
//   Antes as duas pontas não conversavam: o contrato cobrava por hora, o checklist não pedia horímetro e a medição chegava
//   "sem leitura" sem ninguém saber onde informar. Aqui o aviso já vem com a ação:
//     • checklist sem o campo  → "revise o modelo do checklist utilizado" + link para o equipamento em 🔍 Inspeções (18zf.5)
//     • sem checklist          → "defina o checklist" + link para o equipamento em 🔍 Inspeções
//     • tudo certo (na medição) → diz ONDE as horas são informadas e por quem

const QUEM = { locatario: "o cliente (locatário)", empresa: "a sua equipe", padrao: "quem fizer a inspeção" };
const COB = { hora: "por hora", mensal: "com franquia de horas" };

export default function AvisoHorimetro({ C, s, d, editar = false, onMudou, medicao = false }) {
  if (!d) return null;
  const comH = d.modelos.find((m) => m.campos.includes("horimetro"));
  if (d.ok) {
    if (!medicao) return null;
    return <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>informado no checklist “{comH.nome}” por {QUEM[comH.responsavel]} — precisa de 2 leituras cobrindo o ciclo</div>;
  }
  // 18zf.5 (Marcony): o aviso orienta a REVISAR o checklist do equipamento — não liga o campo sozinho (um checklist de carregamento,
  //   por exemplo, não é o lugar do horímetro; o certo é usar um checklist de rotina/medição com o campo)
  const irEquip = () => { window.qfInspecoesBusca = d.tag || ""; window.dispatchEvent(new CustomEvent("qf-ir-tela", { detail: "inspecoes" })); };
  const link = <button type="button" onClick={irEquip} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 12, padding: 0, textDecoration: "underline" }}>{d.tag || "equipamento"} em 🔍 Inspeções ›</button>;
  return <div style={{ fontSize: 12, color: C.warn, marginTop: 4, whiteSpace: "normal" }}>
    ⏱ Cobra {COB[d.cobranca] || "por hora"}, mas {d.motivo === "sem_campo"
      ? <>{d.modelos.length > 1 ? "nenhum dos checklists" : "o checklist"} {d.modelos.map((m, i) => <span key={m.id}>{i ? ", " : ""}<b>“{m.nome}”</b></span>)} não pede horímetro — revise o modelo do checklist utilizado: {link}</>
      : <>o equipamento não tem checklist de inspeção — defina o checklist: {link}</>}
    <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>Dica: na Biblioteca de 🔍 Inspeções há o modelo “Leitura para medição contratual (horímetro)” — importe e crie uma rotina semanal para o cliente.</div>{/* 18zg */}
  </div>;
}
