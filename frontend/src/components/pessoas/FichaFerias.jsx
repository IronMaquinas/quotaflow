// components/pessoas/FichaFerias.jsx — etapa B1.15: 👁 ficha de um lançamento de férias (só leitura)
//   Datas, volta, período aquisitivo, vendidos, quem lançou · ⚠ conflitos com a agenda (AT, OS, tarefa, turma, mesma função — com link)
//   · 🕓 histórico (lançada / reprogramada / cancelada, com motivo). Editar e Cancelar ficam AQUI (evita edição acidental na lista).
import { useEffect, useState } from "react";
import apiService from "../../services/apiService";

const dBR = (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");
const dhBR = (v) => { if (!v) return "—"; const d = new Date(v); return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`; };
const ACAO = { lancada: ["📝 Lançada", "#3b82f6"], reprogramada: ["✏ Reprogramada", "#eab308"], cancelada: ["✕ Cancelada", "#ef4444"] };
export const irPara = (l) => { if (!l?.tela) return; if (l.tela === "pessoas" && l.aba) window.qfPessoasAba = l.aba; window.dispatchEvent(new CustomEvent("qf-navegar", { detail: { tela: l.tela } })); };

export default function FichaFerias({ C, s, modal, id, editar, onFechar, onEditar, onCancelado }) {
  const [d, setD] = useState(null); const [erro, setErro] = useState(""); const [cancelando, setCancelando] = useState(null); const [enviando, setEnviando] = useState(false);
  useEffect(() => { apiService.get(`/pessoas/ferias/${id}`).then(setD).catch((e) => setErro(e?.response?.data?.erro || e.message)); }, [id]);
  const f = d?.ferias; const cancelada = !!f?.cancelada_em;
  const linha = (rot, val) => <div style={{ display: "flex", gap: 8, fontSize: 13, padding: "5px 0", borderBottom: `1px solid ${C.border}` }}><span style={{ color: C.textSub, minWidth: 150 }}>{rot}</span><b style={{ flex: 1 }}>{val}</b></div>;
  const resumo = (x) => (x ? `${dBR(x.inicio)} a ${dBR(x.fim)} (${x.dias} dia(s)${x.abono_dias ? ` + ${x.abono_dias} vendido(s)` : ""})` : "—");
  const cancelar = async () => {
    setEnviando(true); setErro("");
    try { await apiService.post(`/pessoas/ferias/${id}/cancelar`, { motivo: cancelando }); onCancelado?.(); }
    catch (e) { setErro(e?.response?.data?.erro || e.message); } finally { setEnviando(false); }
  };

  return modal(<>
    <h3 style={{ margin: "0 0 4px", fontSize: 17 }}>🏖 Férias {f ? `— ${f.colaborador_nome}` : ""}</h3>
    {f && <div style={{ fontSize: 12, color: C.textSub, marginBottom: 12 }}>{f.funcao || ""}</div>}
    {!d && !erro && <div style={{ color: C.muted, fontSize: 13 }}>Carregando…</div>}
    {erro && <div style={{ color: C.danger, fontSize: 13, marginBottom: 10 }}>⚠ {erro}</div>}
    {f && <>
      {cancelada && <div style={{ border: `1px solid ${C.danger}`, background: `${C.danger}12`, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, color: C.danger, marginBottom: 10 }}>✕ Cancelada em {dhBR(f.cancelada_em)}{f.cancelada_por_nome ? ` por ${f.cancelada_por_nome}` : ""} — {f.cancelamento_motivo}</div>}
      <div style={{ marginBottom: 12 }}>
        {linha("Saída", dBR(f.inicio))}
        {linha("Último dia", dBR(f.fim))}
        {linha("Volta ao trabalho", dBR(f.retorno))}
        {linha("Dias", `${f.dias} dia(s) corrido(s)${f.abono_dias ? ` + ${f.abono_dias} vendido(s)` : ""}`)}
        {linha("Período aquisitivo", f.periodo_aquisitivo || "—")}
        {linha("Situação", cancelada ? "cancelada" : { programada: `programada · sai em ${f.faltam_dias} dia(s)`, em_gozo: "em gozo", concluida: "gozada" }[f.situacao] || f.situacao)}
        {f.obs && linha("Observação", f.obs)}
        {linha("Lançado por", `${f.criado_por_nome || "—"}${f.criado_em ? ` · ${dhBR(f.criado_em)}` : ""}`)}
      </div>
      {d.conflitos?.length > 0 && <div style={{ border: `1px solid ${C.warn}`, background: `${C.warn}10`, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>🧠 Analista — agenda no período</div>
        {d.conflitos.map((x, i) => <div key={i} style={{ fontSize: 12.5, color: C.warn, marginTop: 3 }}>⚠ {x.texto} {x.link?.tela && <button type="button" onClick={() => { onFechar(); irPara(x.link); }} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 12, padding: 0, fontFamily: "inherit" }}>abrir →</button>}</div>)}
      </div>}
      <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, marginBottom: 6 }}>🕓 HISTÓRICO</div>
      {!d.historico?.length ? <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 12 }}>Sem alterações registradas.</div>
        : <div style={{ marginBottom: 12 }}>{d.historico.map((h) => { const [rot, cor] = ACAO[h.acao] || [h.acao, C.text]; return (
          <div key={h.id} style={{ fontSize: 12.5, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
            <b style={{ color: cor }}>{rot}</b> <span style={{ color: C.textSub }}>· {dhBR(h.em)}{h.por_nome ? ` · ${h.por_nome}` : ""}</span>
            {h.acao === "reprogramada" && <div style={{ marginTop: 2 }}><span style={{ color: C.muted, textDecoration: "line-through" }}>{resumo(h.antes)}</span> → <b>{resumo(h.depois)}</b></div>}
            {h.acao === "lancada" && <div style={{ marginTop: 2 }}>{resumo(h.depois)}</div>}
            {h.motivo && <div style={{ marginTop: 2, color: C.textSub }}>Motivo: {h.motivo}</div>}
          </div>); })}</div>}
      {cancelando != null && <div style={{ border: `1px solid ${C.danger}`, borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Cancelar estas férias?</div>
        <div style={{ fontSize: 12, color: C.textSub, marginBottom: 6 }}>O lançamento não é apagado: fica no histórico e no dossiê, e os dias voltam ao saldo.</div>
        <textarea rows={3} value={cancelando} onChange={(e) => setCancelando(e.target.value)} placeholder="Motivo do cancelamento (obrigatório)" style={{ ...s.input, resize: "vertical", width: "100%" }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button type="button" onClick={() => setCancelando(null)} disabled={enviando} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button>
          <button type="button" onClick={cancelar} disabled={enviando || !cancelando.trim()} style={{ ...s.btn(true), background: C.danger, borderColor: C.danger, cursor: "pointer", opacity: cancelando.trim() ? 1 : 0.5 }}>{enviando ? "…" : "Cancelar férias"}</button>
        </div>
      </div>}
    </>}
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
      {f && editar && !cancelada && cancelando == null && <>
        <button type="button" onClick={() => setCancelando("")} style={{ ...s.btn(false), cursor: "pointer", color: C.danger }}>Cancelar férias</button>
        <button type="button" onClick={() => onEditar(f)} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>✏ Reprogramar</button>
      </>}
      <button type="button" onClick={onFechar} style={{ ...s.btn(true), cursor: "pointer" }}>Fechar</button>
    </div>
  </>, onFechar, 620);
}
