// components/contratos/GuardaContrato.jsx — etapas 18za.1/18zb: 📦 CONDIÇÕES DO CONTRATO DE ARMAZENAGEM (CA-)
//   18zb (decidido com o Marcony): o contrato mostra só o que foi NEGOCIADO — preço do m², áreas mínima e máxima.
//   O uso do espaço é operação: fica no 📦 pátio (link) e vira valor na 📏 medição do fim do ciclo.
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const m2 = (v) => Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export default function GuardaContrato({ C, s, contrato: c, editar, onEditar }) {
  const falta = !(Number(c.arm_preco) > 0);
  const item = (rot, val, sub, cor) => <div style={{ ...s.card, background: C.bg, padding: "10px 12px", flex: "1 1 150px" }}>
    <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.06em" }}>{rot}</div><div style={{ fontSize: 17, fontWeight: 800, color: cor || C.text }}>{val}</div>{sub && <div style={{ fontSize: 11.5, color: C.textSub }}>{sub}</div>}</div>;
  return <div style={{ marginTop: 16 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
      <div style={{ fontWeight: 700, flex: 1 }}>📐 Condições da armazenagem</div>
      {editar && c.status === "ativo" && <button type="button" onClick={onEditar} style={{ ...s.btn(false), padding: "6px 12px", fontSize: 12.5 }}>✎ Editar condições</button>}</div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {item("PREÇO", falta ? "a definir" : brl(c.arm_preco), falta ? "informe em ✎ Editar condições" : `por m² ${c.arm_unidade === "m2_dia" ? "ao dia" : "ao mês"}`, falta ? C.warn : null)}
      {item("ÁREA MÍNIMA", c.arm_minimo_m2 ? `${m2(c.arm_minimo_m2)} m²` : "sem mínimo", c.arm_minimo_m2 ? "cobrada mesmo se usar menos" : null)}
      {item("ÁREA MÁXIMA", c.arm_area_max_m2 ? `${m2(c.arm_area_max_m2)} m²` : "sem limite", c.arm_area_max_m2 ? "passou → aviso + 🔔 gestor" : "sem aviso de excesso")}
    </div>
    <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Cobrança pela área ocupada × dias no pátio, na 📏 medição de cada ciclo (conta o dia da entrada e não o da saída).{" "}
      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("qf-ir-tela", { detail: "patio" }))} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 12, padding: 0 }}>Ver uso no pátio ›</button></div>
  </div>;
}
