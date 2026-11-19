// components/auditorias/TelaAuditorias.jsx — etapa A1: 🔎 AUDITORIAS do sistema de gestão (admin, gestor, qualidade)
//   Programa do ano (mês a mês) + cobertura dos requisitos ISO 9001 (4–10) + lista. Ficha da auditoria: dados, auditor e auditados
//   do cadastro (CampoFuncionario), constatações com requisito/evidência; NC e observação viram tarefa 🔎 AU com responsável e prazo.
//   🖨 Relatório da auditoria (impressão/PDF pelo navegador).
import { useEffect, useMemo, useState } from "react";
import apiService from "../../services/apiService";
import CampoFuncionario from "../shared/CampoFuncionario";

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const COR_ST = { planejada: "#60a5fa", em_andamento: "#f59e0b", concluida: "#22c55e", cancelada: "#64748b" };
const COR_C = { nc_maior: "#ef4444", nc_menor: "#f97316", observacao: "#f59e0b", oportunidade: "#60a5fa", conforme: "#22c55e" };
const vazia = () => ({ titulo: "", tipo: "interna", norma: "ISO 9001:2015", escopo: "", processos: "", requisitos: [], auditor_nome: "", auditor_colaborador_id: null, auditor_usuario_id: null, auditor_externo: "", auditados: [], data_prevista: "", data_realizada: "", status: "planejada", conclusao: "" });
const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default function TelaAuditorias({ C, s }) {
  const [ano, setAno] = useState(() => String(new Date().getFullYear())); const [p, setP] = useState(null); const [erro, setErro] = useState(""); const [msg, setMsg] = useState("");
  const [ed, setEd] = useState(null); const [det, setDet] = useState(null); const [pessoas, setPessoas] = useState(null); const [nc, setNc] = useState(null);
  const carregar = () => apiService.get(`/auditorias/programa?ano=${ano}`).then((r) => { setP(r); setErro(""); }).catch((e) => setErro(e?.response?.data?.erro || e.message));
  useEffect(() => { setP(null); carregar(); }, [ano]); // eslint-disable-line
  useEffect(() => { apiService.get("/pessoas/gestao-pessoas").then((r) => setPessoas(r.funcionarios || [])).catch(() => setPessoas([])); }, []);
  const abrir = async (id) => { try { const r = await apiService.get(`/auditorias/${id}`); setDet(r); const a = r.auditoria; setEd({ ...vazia(), ...a, processos: (a.processos || []).join(", "), data_prevista: a.data_prevista || "", data_realizada: a.data_realizada || "", auditados: a.auditados || [] }); setNc(null); } catch (e) { setMsg(`⚠ ${e?.response?.data?.erro || e.message}`); } };
  const salvar = async () => { setMsg(""); try { const corpo = { ...ed, processos: String(ed.processos || "").split(",").map((x) => x.trim()).filter(Boolean) }; const r = ed.id ? await apiService.put(`/auditorias/${ed.id}`, corpo) : await apiService.post("/auditorias", corpo); setMsg(ed.id ? "Auditoria salva." : `Auditoria ${r.auditoria.numero} criada.`); await carregar(); await abrir(r.auditoria.id); } catch (e) { setMsg(`⚠ ${e?.response?.data?.erro || e.message}`); } };
  const constatar = async () => { setMsg(""); try { const r = await apiService.post(`/auditorias/${ed.id}/constatacoes`, { ...nc, responsavel_ref: nc.resp_id ? `c:${nc.resp_id}` : nc.resp_uid ? `u:${nc.resp_uid}` : null, responsavel: nc.resp_nome || null }); setMsg(r.aviso ? `⚠ ${r.aviso}` : r.tarefa ? `Constatação registrada — tarefa ${r.tarefa.numero || ""} criada.` : "Constatação registrada."); setNc(null); await abrir(ed.id); carregar(); } catch (e) { setMsg(`⚠ ${e?.response?.data?.erro || e.message}`); } };
  const excluirC = async (id) => { try { await apiService.delete(`/auditorias/constatacoes/${id}`); await abrir(ed.id); carregar(); } catch (e) { setMsg(`⚠ ${e?.response?.data?.erro || e.message}`); } };
  const reqs = p?.requisitos || [];
  const relatorio = () => {
    const a = det.auditoria; const w = window.open("", "_blank"); if (!w) return setMsg("⚠ Libere pop-ups para imprimir o relatório.");
    const linhas = det.constatacoes.map((c) => `<tr><td>${esc(p.CONST[c.tipo])}</td><td>${esc(c.requisito || "")}</td><td>${esc(c.processo || "")}</td><td>${esc(c.descricao)}${c.evidencia ? `<br><i>Evidência: ${esc(c.evidencia)}</i>` : ""}</td><td>${c.tarefa ? `${esc(c.tarefa.numero || "")} · ${esc(c.tarefa.responsavel || "")} · ${dBR(c.tarefa.prazo)} · ${esc(c.tarefa.status)}` : "—"}</td></tr>`).join("");
    w.document.write(`<html><head><meta charset="utf-8"><title>${esc(a.numero)}</title><style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:28px}h1{font-size:18px;margin:0 0 4px}table{border-collapse:collapse;width:100%;margin-top:10px}td,th{border:1px solid #bbb;padding:6px;vertical-align:top;text-align:left}th{background:#f1f5f9}.g{display:grid;grid-template-columns:160px 1fr;gap:4px 12px;margin-top:12px}.r{color:#555}</style></head><body>
      <h1>Relatório de auditoria ${esc(a.numero)}</h1><div class="r">${esc(a.titulo)} · ${esc(p.TIPOS[a.tipo])} · ${esc(a.norma)}</div>
      <div class="g"><b>Data</b><span>${dBR(a.data_realizada || a.data_prevista)}</span><b>Auditor</b><span>${esc(a.auditor_nome || a.auditor_externo || "—")}</span><b>Auditados</b><span>${esc((a.auditados || []).map((x) => x.nome).join(", ") || "—")}</span><b>Processos</b><span>${esc((a.processos || []).join(", ") || "—")}</span><b>Requisitos</b><span>${esc((a.requisitos || []).join(", ") || "—")}</span><b>Escopo</b><span>${esc(a.escopo || "—")}</span></div>
      <h3>Constatações</h3><table><tr><th>Tipo</th><th>Req.</th><th>Processo</th><th>Descrição</th><th>Ação (tarefa)</th></tr>${linhas || '<tr><td colspan="5">Nenhuma constatação.</td></tr>'}</table>
      <h3>Conclusão</h3><div>${esc(a.conclusao || "—").replace(/\n/g, "<br>")}</div>
      <div style="display:flex;gap:60px;margin-top:60px"><div style="border-top:1px solid #111;padding-top:4px;width:240px">Auditor</div><div style="border-top:1px solid #111;padding-top:4px;width:240px">Responsável pela área</div></div>
      <script>setTimeout(()=>print(),300)</script></body></html>`); w.document.close();
  };
  const card = { ...s.card, padding: "16px 18px" }; const tit = { fontSize: 12, color: C.textSub, fontWeight: 700, letterSpacing: ".04em", marginBottom: 10 }; const lab = { fontSize: 11.5, color: C.textSub, display: "block", marginBottom: 3 };
  const porMes = useMemo(() => MES.map((_, i) => (p?.auditorias || []).filter((a) => Number(String(a.data_prevista || a.data_realizada).slice(5, 7)) === i + 1)), [p]);

  if (ed) return (
    <div style={{ padding: "20px clamp(12px, 3vw, 28px)", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><button type="button" onClick={() => { setEd(null); setDet(null); }} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>← Programa</button>
        <div style={{ fontSize: 20, fontWeight: 800, flex: 1 }}>{ed.id ? `🔎 ${ed.numero}` : "🔎 Nova auditoria"}</div>{det && <button type="button" onClick={relatorio} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>🖨 Relatório</button>}</div>
      {msg && <div style={{ fontSize: 13, color: /^⚠/.test(msg) ? C.warn : "#22c55e" }}>{msg}</div>}
      <div style={{ ...card, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: "3 1 280px" }}><span style={lab}>TÍTULO *</span><input value={ed.titulo} onChange={(e) => setEd({ ...ed, titulo: e.target.value })} placeholder="Auditoria interna — Operação e Manutenção" style={{ ...s.input, width: "100%" }} /></div>
          <div style={{ flex: "1 1 160px" }}><span style={lab}>TIPO</span><select value={ed.tipo} onChange={(e) => setEd({ ...ed, tipo: e.target.value })} style={{ ...s.input, width: "100%" }}>{Object.entries(p?.TIPOS || {}).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></div>
          <div style={{ flex: "1 1 140px" }}><span style={lab}>NORMA</span><input value={ed.norma} onChange={(e) => setEd({ ...ed, norma: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>
          <div style={{ flex: "1 1 140px" }}><span style={lab}>STATUS</span><select value={ed.status} onChange={(e) => setEd({ ...ed, status: e.target.value })} style={{ ...s.input, width: "100%" }}>{Object.entries(p?.STATUS || {}).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 150px" }}><span style={lab}>DATA PREVISTA *</span><input type="date" value={ed.data_prevista} onChange={(e) => setEd({ ...ed, data_prevista: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>
          <div style={{ flex: "1 1 150px" }}><span style={lab}>DATA REALIZADA</span><input type="date" value={ed.data_realizada} onChange={(e) => setEd({ ...ed, data_realizada: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>
          <div style={{ flex: "2 1 240px" }}><span style={lab}>AUDITOR (DO CADASTRO)</span><CampoFuncionario C={C} s={s} lista={pessoas} nome={ed.auditor_nome || ""} id={ed.auditor_colaborador_id} usuarioId={ed.auditor_usuario_id} placeholder="Digite o nome do auditor…" onChange={(v) => setEd({ ...ed, auditor_nome: v.nome, auditor_colaborador_id: v.id, auditor_usuario_id: v.usuario_id })} /></div>
          <div style={{ flex: "2 1 220px" }}><span style={lab}>OU AUDITOR EXTERNO / EMPRESA</span><input value={ed.auditor_externo || ""} onChange={(e) => setEd({ ...ed, auditor_externo: e.target.value })} placeholder="ex.: Certificadora XYZ — Fulano" style={{ ...s.input, width: "100%" }} /></div>
        </div>
        <div><span style={lab}>AUDITADOS (DO CADASTRO)</span><div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>{(ed.auditados || []).map((x, i) => <span key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: "3px 6px 3px 10px", fontSize: 12.5 }}>{x.nome}<button type="button" onClick={() => setEd({ ...ed, auditados: ed.auditados.filter((_, k) => k !== i) })} aria-label={`Tirar ${x.nome}`} style={{ background: "none", border: "none", color: C.textSub, cursor: "pointer" }}>×</button></span>)}
          <div style={{ width: 260 }}><CampoFuncionario C={C} s={s} lista={pessoas} nome={ed._aud || ""} id={null} placeholder="＋ adicionar auditado…" onChange={(v) => { if (v.id != null || v.usuario_id != null) setEd({ ...ed, _aud: "", auditados: [...(ed.auditados || []), { nome: v.nome, colaborador_id: v.id, usuario_id: v.usuario_id }] }); else setEd({ ...ed, _aud: v.nome }); }} /></div></div></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: "2 1 300px" }}><span style={lab}>ESCOPO</span><textarea value={ed.escopo || ""} onChange={(e) => setEd({ ...ed, escopo: e.target.value })} rows={2} style={{ ...s.input, width: "100%", fontFamily: "inherit" }} /></div>
          <div style={{ flex: "1 1 240px" }}><span style={lab}>PROCESSOS (separe por vírgula)</span><input value={ed.processos} onChange={(e) => setEd({ ...ed, processos: e.target.value })} placeholder="Compras, Manutenção, Programação" style={{ ...s.input, width: "100%" }} /></div>
        </div>
        <div><span style={lab}>REQUISITOS AUDITADOS</span><div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{reqs.map((r) => { const on = (ed.requisitos || []).includes(r.codigo); return <button key={r.codigo} type="button" title={r.nome} onClick={() => setEd({ ...ed, requisitos: on ? ed.requisitos.filter((x) => x !== r.codigo) : [...(ed.requisitos || []), r.codigo] })} style={{ padding: r.principal ? "4px 10px" : "3px 8px", borderRadius: 12, fontSize: r.principal ? 12.5 : 11.5, fontWeight: r.principal ? 700 : 400, border: `1px solid ${on ? C.accent : C.border}`, background: on ? C.accent : "transparent", color: on ? "#fff" : C.text, cursor: "pointer" }}>{r.codigo}{r.principal ? ` ${r.nome}` : ""}</button>; })}</div></div>
        <div><span style={lab}>CONCLUSÃO DO AUDITOR</span><textarea value={ed.conclusao || ""} onChange={(e) => setEd({ ...ed, conclusao: e.target.value })} rows={3} placeholder="O sistema é eficaz? Pontos fortes, recomendações…" style={{ ...s.input, width: "100%", fontFamily: "inherit" }} /></div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" onClick={salvar} style={{ ...s.btn(true), cursor: "pointer" }}>{ed.id ? "Salvar" : "Criar auditoria"}</button></div>
      </div>
      {det && <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}><div style={tit}>CONSTATAÇÕES ({det.constatacoes.length})</div>{!nc && ed.status !== "concluida" && ed.status !== "cancelada" && <button type="button" onClick={() => setNc({ tipo: "nc_menor", requisito: "", processo: "", descricao: "", evidencia: "", prazo: "", resp_nome: "" })} style={{ ...s.btn(true), cursor: "pointer" }}>＋ Constatação</button>}</div>
        {nc && <div style={{ border: `1px solid ${C.accent}66`, borderRadius: 8, padding: 12, marginBottom: 12, display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{Object.entries(p.CONST).map(([k, r]) => <button key={k} type="button" onClick={() => setNc({ ...nc, tipo: k })} style={{ padding: "5px 12px", borderRadius: 14, fontSize: 12.5, border: `1px solid ${COR_C[k]}`, background: nc.tipo === k ? COR_C[k] : "transparent", color: nc.tipo === k ? "#fff" : C.text, cursor: "pointer" }}>{r}</button>)}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={nc.requisito} onChange={(e) => setNc({ ...nc, requisito: e.target.value })} style={{ ...s.input, flex: "1 1 200px" }}><option value="">Requisito…</option>{reqs.map((r) => <option key={r.codigo} value={r.codigo}>{r.codigo} — {r.nome}</option>)}</select>
            <input value={nc.processo} onChange={(e) => setNc({ ...nc, processo: e.target.value })} placeholder="Processo" style={{ ...s.input, flex: "1 1 160px" }} />
          </div>
          <textarea value={nc.descricao} onChange={(e) => setNc({ ...nc, descricao: e.target.value })} rows={2} placeholder="Descrição * — o que foi encontrado (requisito × situação)" style={{ ...s.input, fontFamily: "inherit" }} />
          <textarea value={nc.evidencia} onChange={(e) => setNc({ ...nc, evidencia: e.target.value })} rows={2} placeholder="Evidência — registro, documento, entrevista…" style={{ ...s.input, fontFamily: "inherit" }} />
          {["nc_maior", "nc_menor", "observacao"].includes(nc.tipo) && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
            <div style={{ flex: "2 1 240px" }}><span style={lab}>RESPONSÁVEL PELA AÇÃO</span><CampoFuncionario C={C} s={s} lista={pessoas} nome={nc.resp_nome} id={nc.resp_id} usuarioId={nc.resp_uid} placeholder="Digite o nome do funcionário…" onChange={(v) => setNc({ ...nc, resp_nome: v.nome, resp_id: v.id, resp_uid: v.usuario_id })} /></div>
            <div style={{ flex: "1 1 150px" }}><span style={lab}>PRAZO (vazio = {nc.tipo === "nc_maior" ? 15 : nc.tipo === "nc_menor" ? 30 : 45} dias)</span><input type="date" value={nc.prazo} onChange={(e) => setNc({ ...nc, prazo: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>
            <div style={{ fontSize: 11.5, color: C.textSub, flex: "1 1 200px" }}>Vira tarefa 🔎 AU para tratar (causa e ação corretiva).</div></div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={() => setNc(null)} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>Cancelar</button><button type="button" disabled={!nc.descricao.trim()} onClick={constatar} style={{ ...s.btn(true), cursor: "pointer" }}>Registrar</button></div>
        </div>}
        {det.constatacoes.map((c, i) => <div key={c.id} style={{ display: "flex", gap: 10, padding: "9px 0", borderTop: i ? `1px solid ${C.border}55` : "none", flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: COR_C[c.tipo], border: `1px solid ${COR_C[c.tipo]}`, borderRadius: 10, padding: "1px 8px", height: "fit-content", whiteSpace: "nowrap" }}>{c.tipo_nome}</span>
          <div style={{ flex: "1 1 300px" }}><div style={{ fontSize: 13.5 }}>{c.requisito && <b>{c.requisito} · </b>}{c.descricao}</div>{c.evidencia && <div style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>Evidência: {c.evidencia}</div>}
            {c.tarefa && <div style={{ fontSize: 12, marginTop: 3, color: ["concluida"].includes(c.tarefa.status) ? "#22c55e" : C.warn }}>🔎 {c.tarefa.numero || "tarefa"} · {c.tarefa.responsavel || "—"} · prazo {dBR(c.tarefa.prazo)} · {c.tarefa.status}</div>}</div>
          {!c.tarefa_id && ed.status !== "concluida" && <button type="button" onClick={() => excluirC(c.id)} aria-label="Remover constatação" style={{ background: "none", border: "none", color: C.textSub, cursor: "pointer" }}>×</button>}
        </div>)}
        {!det.constatacoes.length && !nc && <div style={{ color: C.muted, fontSize: 13 }}>Nenhuma constatação. Registre também os pontos "Conforme" — evidenciam o que foi verificado.</div>}
      </div>}
    </div>);

  return (
    <div style={{ padding: "20px clamp(12px, 3vw, 28px)", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div><div style={{ fontSize: 22, fontWeight: 800 }}>🔎 Auditorias do sistema de gestão</div><div style={{ fontSize: 13, color: C.textSub, marginTop: 2 }}>Programa do ano, cobertura dos requisitos e constatações — NC vira tarefa de ação corretiva.</div></div>
        <div style={{ display: "flex", gap: 8 }}><select value={ano} onChange={(e) => setAno(e.target.value)} style={{ ...s.input, width: 100 }}>{[0, 1, 2, 3].map((k) => String(new Date().getFullYear() + 1 - k)).map((a) => <option key={a}>{a}</option>)}</select>
          <button type="button" onClick={() => { setDet(null); setEd({ ...vazia(), data_prevista: `${ano}-${String(new Date().getMonth() + 1).padStart(2, "0")}-15` }); }} style={{ ...s.btn(true), cursor: "pointer" }}>＋ Nova auditoria</button></div>
      </div>
      {msg && <div style={{ fontSize: 13, color: /^⚠/.test(msg) ? C.warn : "#22c55e" }}>{msg}</div>}
      {erro && <div style={{ ...card, color: C.danger }}>{erro}</div>}
      {!p && !erro && <div style={{ color: C.muted }}>Carregando…</div>}
      {p && <>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[["Auditorias no ano", `${p.resumo.concluidas}/${p.resumo.total}`, `concluídas${p.resumo.atrasadas ? ` · ${p.resumo.atrasadas} atrasada(s)` : ""}`, p.resumo.atrasadas ? C.warn : null], ["Cobertura ISO 9001", `${p.resumo.cobertura_pct}%`, "cláusulas 4–10 auditadas", p.resumo.cobertura_pct < 100 ? C.warn : "#22c55e"], ["NC maior / menor", `${p.resumo.nc_maior} / ${p.resumo.nc_menor}`, `${p.resumo.observacoes} observação(ões) · ${p.resumo.oportunidades} oportunidade(s)`, p.resumo.nc_maior ? C.danger : null], ["Ações abertas", p.resumo.acoes_abertas, "tarefas AU não concluídas", p.resumo.acoes_abertas ? C.warn : null]].map(([r, v, sub, cor]) => <div key={r} style={{ ...card, flex: "1 1 180px" }}><div style={{ fontSize: 11.5, color: C.textSub }}>{r}</div><div style={{ fontSize: 24, fontWeight: 800, color: cor || C.text, marginTop: 4 }}>{v}</div><div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{sub}</div></div>)}
        </div>
        <div style={card}><div style={tit}>PROGRAMA {p.ano}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>{porMes.map((l, i) => <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, minHeight: 70 }}><div style={{ fontSize: 11.5, color: C.textSub, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>{MES[i]}</div>
            {l.map((a) => <button key={a.id} type="button" onClick={() => abrir(a.id)} title={`${a.numero} · ${p.STATUS[a.status]}`} style={{ display: "block", width: "100%", textAlign: "left", background: `${COR_ST[a.status]}1f`, border: `1px solid ${a.atrasada ? C.danger : COR_ST[a.status]}`, borderRadius: 6, padding: "4px 6px", marginBottom: 4, color: C.text, fontSize: 11.5, cursor: "pointer" }}><b>{a.numero}</b>{a.atrasada ? " ⏰" : ""}<div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.titulo}</div></button>)}</div>)}</div></div>
        <div style={card}><div style={tit}>COBERTURA DOS REQUISITOS — {p.ano}</div><div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{reqs.map((r) => <span key={r.codigo} title={r.nome} style={{ padding: r.principal ? "4px 10px" : "2px 7px", borderRadius: 12, fontSize: r.principal ? 12.5 : 11, fontWeight: r.principal ? 700 : 400, border: `1px solid ${r.coberto ? "#22c55e" : C.border}`, background: r.coberto ? "#22c55e22" : "transparent", color: r.coberto ? "#22c55e" : C.textSub }}>{r.codigo}{r.principal ? ` ${r.nome}` : ""}</span>)}</div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>Conta o que está marcado nas auditorias em andamento ou concluídas do ano. Base da ISO 9001 9.2: o programa deve cobrir o sistema.</div></div>
        <div style={card}><div style={tit}>AUDITORIAS {p.ano}</div>{p.auditorias.length ? p.auditorias.map((a, i) => <div key={a.id} onClick={() => abrir(a.id)} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "9px 4px", borderTop: i ? `1px solid ${C.border}55` : "none", cursor: "pointer" }}>
          <span style={{ fontSize: 11, color: COR_ST[a.status], border: `1px solid ${COR_ST[a.status]}`, borderRadius: 9, padding: "1px 8px", whiteSpace: "nowrap" }}>{p.STATUS[a.status]}</span>
          <div style={{ flex: "1 1 260px" }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.numero} · {a.titulo}{a.atrasada && <span style={{ color: C.danger, fontSize: 12 }}> · ⏰ atrasada</span>}</div><div style={{ fontSize: 12, color: C.textSub }}>{p.TIPOS[a.tipo]} · {dBR(a.data_realizada || a.data_prevista)} · {a.auditor_nome || a.auditor_externo || "sem auditor"}{(a.requisitos || []).length ? ` · req. ${a.requisitos.join(", ")}` : ""}</div></div>
          <div style={{ fontSize: 12, color: C.textSub, whiteSpace: "nowrap" }}>{a.contagem.nc_maior ? <span style={{ color: "#ef4444" }}>{a.contagem.nc_maior} NC maior · </span> : null}{a.contagem.nc_menor ? <span style={{ color: "#f97316" }}>{a.contagem.nc_menor} NC menor · </span> : null}{a.contagem.acoes_abertas ? <span style={{ color: C.warn }}>{a.contagem.acoes_abertas} ação(ões) aberta(s)</span> : "—"}</div>
        </div>) : <div style={{ color: C.muted, fontSize: 13 }}>Nenhuma auditoria em {p.ano}. Comece pelo programa: ＋ Nova auditoria para cada processo ou cláusula no mês planejado.</div>}</div>
      </>}
    </div>);
}
