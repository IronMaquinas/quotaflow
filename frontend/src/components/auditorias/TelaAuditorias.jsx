// components/auditorias/TelaAuditorias.jsx — etapa A1: 🔎 AUDITORIAS do sistema de gestão (admin, gestor, qualidade)
//   Programa do ano (mês a mês) + cobertura dos requisitos ISO 9001 (4–10) + lista. A1.1: a ficha (planejar → executar → concluir e
//   assinar) fica em FichaAuditoria.jsx.
import { useEffect, useMemo, useState } from "react";
import apiService from "../../services/apiService";
import FichaAuditoria from "./FichaAuditoria";
import PendenciasAuditoria from "./PendenciasAuditoria"; // A1.3 // A1.1: planejar → executar → concluir e assinar

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const COR_ST = { planejada: "#60a5fa", em_andamento: "#f59e0b", concluida: "#22c55e", cancelada: "#64748b" };
const COR_C = { nc_maior: "#ef4444", nc_menor: "#f97316", observacao: "#f59e0b", oportunidade: "#60a5fa", conforme: "#22c55e" };

export default function TelaAuditorias({ C, s }) {
  const [ano, setAno] = useState(() => String(new Date().getFullYear())); const [p, setP] = useState(null); const [erro, setErro] = useState(""); const [msg, setMsg] = useState("");
  const [ed, setEd] = useState(null); const [destaque, setDestaque] = useState(null); const [pend, setPend] = useState(false); const [pessoas, setPessoas] = useState(null); // A1.1.4: destaque = auditoria recém-planejada piscando no programa
  const carregar = () => apiService.get(`/auditorias/programa?ano=${ano}`).then((r) => { setP(r); setErro(""); }).catch((e) => setErro(e?.response?.data?.erro || e.message));
  useEffect(() => { setP(null); carregar(); }, [ano]); // eslint-disable-line
  useEffect(() => { apiService.get("/pessoas/gestao-pessoas").then((r) => setPessoas(r.funcionarios || [])).catch(() => setPessoas([])); }, []);
  const abrir = (id) => setEd({ id });
  const card = { ...s.card, padding: "16px 18px" }; const tit = { fontSize: 12, color: C.textSub, fontWeight: 700, letterSpacing: ".04em", marginBottom: 10 }; const lab = { fontSize: 11.5, color: C.textSub, display: "block", marginBottom: 3 };
  const reqs = p?.requisitos || []; // A1.1.1: sumiu na A1.1 (a cobertura usa)
  const porMes = useMemo(() => MES.map((_, i) => { const m = `${p?.ano}-${String(i + 1).padStart(2, "0")}`; return (p?.auditorias || []).filter((a) => { const ini = String(a.data_prevista || a.data_realizada).slice(0, 7); const fim = String(a.data_prevista_fim || a.data_prevista || a.data_realizada).slice(0, 7); return m >= ini && m <= fim; }); }), [p]); // A1.2: período atravessa meses

  if (pend) return <PendenciasAuditoria C={C} s={s} ano={ano} onVoltar={() => { setPend(false); carregar(); }} />; // A1.3
  if (ed) return <FichaAuditoria C={C} s={s} id={ed.id || null} ano={ano} meta={p} pessoas={pessoas} onVoltar={(info) => { setEd(null); carregar(); if (info?.msg) setMsg(info.msg); if (info?.destaque) { setDestaque(String(info.destaque)); setTimeout(() => setDestaque(null), 6000); } }} />; // A1.1

  return (
    <div style={{ padding: "20px clamp(12px, 3vw, 28px)", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div><div style={{ fontSize: 22, fontWeight: 800 }}>🔎 Auditorias do sistema de gestão</div><div style={{ fontSize: 13, color: C.textSub, marginTop: 2 }}>Programa do ano, cobertura dos requisitos e constatações — NC vira tarefa de ação corretiva.</div></div>
        <div style={{ display: "flex", gap: 8 }}><select value={ano} onChange={(e) => setAno(e.target.value)} style={{ ...s.input, width: 100 }}>{[0, 1, 2, 3].map((k) => String(new Date().getFullYear() + 1 - k)).map((a) => <option key={a}>{a}</option>)}</select>
          <button type="button" onClick={() => p && setEd({ id: null })} style={{ ...s.btn(true), cursor: "pointer" }}>📅 Planejar auditoria</button></div>
      </div>
      {msg && <div style={{ fontSize: 13, color: /^⚠/.test(msg) ? C.warn : "#22c55e" }}>{msg}</div>}
      {erro && <div style={{ ...card, color: C.danger }}>{erro}</div>}
      {!p && !erro && <div style={{ color: C.muted }}>Carregando…</div>}
      {p && <>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[["Auditorias no ano", `${p.resumo.concluidas}/${p.resumo.total}`, `concluídas${p.resumo.atrasadas ? ` · ${p.resumo.atrasadas} atrasada(s)` : ""}`, p.resumo.atrasadas ? C.warn : null], ["Cobertura ISO 9001", `${p.resumo.planejado_pct ?? 0}% · ${p.resumo.auditado_pct ?? 0}%`, `planejado · concluído${p.resumo.andamento_pct ? ` · ${p.resumo.andamento_pct}% em andamento` : ""} (${p.resumo.itens_total ?? "—"} itens)`, (p.resumo.auditado_pct ?? 0) < 100 ? C.warn : "#22c55e"], ["NC maior / menor", `${p.resumo.nc_maior} / ${p.resumo.nc_menor}`, `${p.resumo.observacoes} observação(ões) · ${p.resumo.oportunidades} oportunidade(s)`, p.resumo.nc_maior ? C.danger : null], ["Ações abertas", p.resumo.acoes_abertas, "tarefas AU não concluídas", p.resumo.acoes_abertas ? C.warn : null, true], ["Ações de NC concluídas", p.resumo.acoes_nc_pct == null ? "—" : `${p.resumo.acoes_nc_pct}%`, `${p.resumo.acoes_nc_concluidas ?? 0}/${p.resumo.acoes_nc_total ?? 0} · ver pendências →`, p.resumo.acoes_nc_pct != null && p.resumo.acoes_nc_pct < 100 ? C.warn : "#22c55e", true]].map(([r, v, sub, cor, clica]) => <div key={r} onClick={clica ? () => setPend(true) : undefined} title={clica ? "Abrir as pendências de auditoria" : undefined} style={{ ...card, flex: "1 1 150px", minWidth: 0, cursor: clica ? "pointer" : "default" }}><div style={{ fontSize: 11.5, color: C.textSub }}>{r}</div><div style={{ fontSize: 24, fontWeight: 800, color: cor || C.text, marginTop: 4 }}>{v}</div><div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{sub}</div></div>)}
        </div>
        {p.resumo.anteriores_abertas > 0 && <div onClick={() => setPend(true)} style={{ ...card, border: `1px solid ${C.warn}`, color: C.warn, cursor: "pointer", fontSize: 13.5 }}>⚠ {p.resumo.anteriores_abertas} pendência(s) do ciclo anterior ainda em aberto — ver pendências →</div>}
        <div style={card}><div style={tit}>PROGRAMA {p.ano}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>{porMes.map((l, i) => <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, minHeight: 70 }}><div style={{ fontSize: 11.5, color: C.textSub, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>{MES[i]}</div>
            {l.map((a) => <button key={a.id} type="button" onClick={() => abrir(a.id)} title={`${a.numero} · ${p.STATUS[a.status]}`} style={{ display: "block", width: "100%", textAlign: "left", background: `${COR_ST[a.status]}${destaque === String(a.id) ? "55" : "1f"}`, boxShadow: destaque === String(a.id) ? `0 0 0 2px ${COR_ST[a.status]}` : "none", transition: "all .4s", border: `1px solid ${a.atrasada ? C.danger : COR_ST[a.status]}`, borderRadius: 6, padding: "4px 6px", marginBottom: 4, color: C.text, fontSize: 11.5, cursor: "pointer" }}><b>{a.numero}</b>{a.atrasada ? " ⏰" : ""}<div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.titulo}</div></button>)}</div>)}</div></div>
        <div style={card}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><div style={tit}>COBERTURA DOS REQUISITOS — {p.ano}</div>
            <div style={{ display: "flex", gap: 12, fontSize: 11.5, color: C.textSub, flexWrap: "wrap" }}><span><span style={{ color: "#22c55e" }}>●</span> auditado (concluída)</span><span><span style={{ color: "#f59e0b" }}>●</span> em andamento</span><span><span style={{ color: "#60a5fa" }}>●</span> planejado</span><span><span style={{ color: C.muted }}>●</span> não planejado</span></div></div>
          {(() => { const COR = { auditado: "#22c55e", andamento: "#f59e0b", planejado: "#60a5fa", nao: C.muted }; const prin = reqs.filter((r) => r.principal);
            return <div style={{ display: "grid", gap: 8 }}>{prin.map((r) => { const ss = reqs.filter((x) => !x.principal && x.codigo.split(".")[0] === r.codigo); const pa = r.total ? (r.n_auditado / r.total) * 100 : 0; const pan = r.total ? ((r.n_andamento || 0) / r.total) * 100 : 0; const pp = r.total ? (r.n_planejado / r.total) * 100 : 0;
              return <div key={r.codigo} style={{ display: "grid", gridTemplateColumns: "minmax(170px, 230px) 1fr", gap: 10, alignItems: "center" }}>
                <div><div style={{ fontWeight: 700, fontSize: 13, color: COR[r.estado] }}>{r.codigo} {r.nome}</div><div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: C.border, marginTop: 3 }}><div style={{ width: `${pa}%`, background: "#22c55e" }} /><div style={{ width: `${pan}%`, background: "#f59e0b" }} /><div style={{ width: `${pp}%`, background: "#60a5fa" }} /></div>
                  <div style={{ fontSize: 10.5, color: C.textSub, marginTop: 2 }}>{r.n_auditado}/{r.total} auditado{r.n_andamento ? ` · ${r.n_andamento}/${r.total} em andamento` : ""} · {r.n_planejado}/{r.total} planejado</div></div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{(ss.length ? ss : [r]).map((x) => <span key={x.codigo} title={`${x.codigo} ${x.nome} — ${{ auditado: "auditado (concluída)", andamento: "em andamento", planejado: "planejado", nao: "não planejado" }[x.estado]}`} style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11.5, border: `1px solid ${COR[x.estado]}`, background: x.estado === "nao" ? "transparent" : `${COR[x.estado]}26`, color: x.estado === "nao" ? C.textSub : COR[x.estado] }}>{x.codigo} {x.nome}</span>)}</div>
              </div>; })}</div>; })()}
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 10 }}>Por subitem. Verde só com a auditoria concluída e aprovada; amarelo = auditoria começou e ainda não terminou; azul = planejada. A 9.2 da ISO pede que o programa do ano cubra o sistema.</div></div>
        <div style={card}><div style={tit}>AUDITORIAS {p.ano}</div>{p.auditorias.length ? p.auditorias.map((a, i) => <div key={a.id} onClick={() => abrir(a.id)} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "9px 4px", borderTop: i ? `1px solid ${C.border}55` : "none", cursor: "pointer" }}>
          <span style={{ fontSize: 11, color: COR_ST[a.status], border: `1px solid ${COR_ST[a.status]}`, borderRadius: 9, padding: "1px 8px", whiteSpace: "nowrap" }}>{p.STATUS[a.status]}</span>
          <div style={{ flex: "1 1 260px" }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.numero} · {a.titulo}{a.atrasada && <span style={{ color: C.danger, fontSize: 12 }}> · ⏰ atrasada</span>}</div><div style={{ fontSize: 12, color: C.textSub }}>{p.TIPOS[a.tipo]} · {dBR(a.data_prevista)}{a.data_prevista_fim && a.data_prevista_fim !== a.data_prevista ? ` a ${dBR(a.data_prevista_fim)}` : ""}{a.horas ? ` · ${String(a.horas).replace(".", ",")} h` : ""} · {a.auditor_nome || a.auditor_externo || "sem auditor"}{(a.requisitos || []).length ? ` · req. ${a.requisitos.join(", ")}` : ""}</div></div>
          <div style={{ fontSize: 12, color: C.textSub, whiteSpace: "nowrap" }}>{a.contagem.nc_maior ? <span style={{ color: "#ef4444" }}>{a.contagem.nc_maior} NC maior · </span> : null}{a.contagem.nc_menor ? <span style={{ color: "#f97316" }}>{a.contagem.nc_menor} NC menor · </span> : null}{a.contagem.acoes_abertas ? <span style={{ color: C.warn }}>{a.contagem.acoes_abertas} ação(ões) aberta(s)</span> : "—"}</div>
        </div>) : <div style={{ color: C.muted, fontSize: 13 }}>Nenhuma auditoria em {p.ano}. Comece pelo programa: ＋ Nova auditoria para cada processo ou cláusula no mês planejado.</div>}</div>
      </>}
    </div>);
}
