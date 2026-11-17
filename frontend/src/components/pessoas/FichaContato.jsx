// components/pessoas/FichaContato.jsx — etapa B1.10: topo da ficha — CPF, telefone e e-mail (com ligar/WhatsApp/e-mail),
//   🚑 contato de emergência e 🩺 plano de saúde. Sem precisar clicar em Editar.
import BotoesContato, { formatarTelefone } from "../shared/BotoesContato";
const dBR = (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "");
const cpfFmt = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : v; };

export default function FichaContato({ C, colaborador: c }) {
  const vazio = (t) => <span style={{ color: C.muted, fontWeight: 400 }}>{t}</span>;
  const box = (titulo, filhos, cor) => <div style={{ border: `1px solid ${cor || C.border}`, borderRadius: 8, padding: "10px 12px", minWidth: 0 }}><div style={{ fontSize: 11, color: C.textSub, fontWeight: 600, marginBottom: 4 }}>{titulo}</div>{filhos}</div>;
  const linha = (rot, val) => <div style={{ fontSize: 13, marginTop: 2, overflowWrap: "anywhere" }}><span style={{ color: C.textSub }}>{rot}: </span><b>{val}</b></div>;
  const temEmerg = c.emergencia_nome || c.emergencia_telefone; const temPlano = c.plano_saude_operadora || c.plano_saude_carteira;
  return (
    <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
      {box("📇 CONTATO", <>
        {linha("CPF", c.cpf ? cpfFmt(c.cpf) : vazio("não cadastrado"))}
        {linha("Telefone", c.telefone ? formatarTelefone(c.telefone) : vazio("não cadastrado"))}
        {linha("E-mail", c.email || vazio("não cadastrado"))}
        {(c.telefone || c.email) && <div style={{ marginTop: 8 }}><BotoesContato C={C} telefone={c.telefone} email={c.email} /></div>}
      </>)}
      {box("🚑 EMERGÊNCIA", temEmerg ? <>
        {linha(c.emergencia_parentesco || "Contato", c.emergencia_nome || "—")}
        {c.emergencia_telefone && linha("Telefone", formatarTelefone(c.emergencia_telefone))}
        {c.emergencia_telefone && <div style={{ marginTop: 8 }}><BotoesContato C={C} telefone={c.emergencia_telefone} /></div>}
      </> : <div style={{ fontSize: 12.5, color: C.warn }}>Sem contato de emergência — cadastre em Editar.</div>, temEmerg ? undefined : `${C.warn}88`)}
      {box("🩺 PLANO DE SAÚDE", temPlano ? <>
        {linha("Operadora", `${c.plano_saude_operadora || "—"}${c.plano_saude_plano ? ` · ${c.plano_saude_plano}` : ""}`)}
        {linha("Carteirinha", c.plano_saude_carteira || vazio("não informada"))}
        {c.plano_saude_validade && linha("Validade", dBR(c.plano_saude_validade))}
      </> : <div style={{ fontSize: 12.5, color: C.muted }}>Não informado.</div>)}
    </div>
  );
}
