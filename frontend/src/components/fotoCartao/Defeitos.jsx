// components/fotoCartao/Defeitos.jsx — etapa E3: 🔧 DEFEITOS mapeados pelas fotos + TRIAGEM da engenharia
//   Lista por projeto → aerogerador → pá → nº do defeito (o sistema junta as fotos do mesmo defeito pelo cartão).
//   Classificar: a) sem reparo · b) reparar · c) investigar mais (justificativa em a e c; c pode criar tarefa 🔧 DF).
//   Reclassificar guarda histórico. Técnico vê a lista; quem classifica é admin, gestor ou qualidade.
import { voc, minus } from "../../utils/vocabInspecao";
import { useEffect, useState } from "react";
import apiService from "../../services/apiService";
import CampoFuncionario from "../shared/CampoFuncionario";
import VisualizadorFoto from "./VisualizadorFoto";
import { quandoBR } from "../../utils/cartaoFoto";
import { AbrirReparo } from "./Reparos";

export const COR_CLASSE = { pendente: "#f59e0b", sem_reparo: "#64748b", reparar: "#ef4444", investigar: "#a855f7" };
const ROT = { pendente: "A classificar", sem_reparo: "a) Sem reparo", reparar: "b) Reparar", investigar: "c) Investigar" };

export default function Defeitos({ C, s, projetos = [], podeEditar, cartoes = [], onAbrirReparo }) {
  const [f, setF] = useState({ projeto_id: "", classe: "pendente", busca: "" }); const [L, setL] = useState(null); const [erro, setErro] = useState(""); const [msg, setMsg] = useState("");
  const [cls, setCls] = useState(null); const [abrirRep, setAbrirRep] = useState(null); const [ver, setVer] = useState(null); const [pessoas, setPessoas] = useState(null);
  const carregar = () => { const p = new URLSearchParams(Object.entries(f).filter(([, v]) => v)); return apiService.get(`/foto-cartao/defeitos?${p}`).then((r) => { setL(r); setErro(""); }).catch((e) => setErro(e?.response?.data?.erro || e.message)); };
  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [JSON.stringify(f)]); // eslint-disable-line
  useEffect(() => { if (podeEditar) apiService.get("/pessoas/gestao-pessoas").then((r) => setPessoas(r.funcionarios || [])).catch(() => setPessoas([])); }, [podeEditar]);
  const abrirFotos = async (d) => { try { const r = await apiService.get(`/foto-cartao/fotos?defeito_id=${d.id}&limite=60`); if (r.fotos.length) setVer({ lista: r.fotos, i: 0 }); } catch (e) { setMsg(`⚠ ${e?.response?.data?.erro || e.message}`); } };
  const salvar = async () => { try { const r = await apiService.post(`/foto-cartao/defeitos/${cls.d.id}/classificar`, { classificacao: cls.classe, justificativa: cls.just, criar_tarefa: cls.classe === "investigar" && cls.tarefa, prazo: cls.prazo, responsavel: cls.resp_nome, responsavel_ref: cls.resp_id ? `c:${cls.resp_id}` : cls.resp_uid ? `u:${cls.resp_uid}` : null });
    setMsg(r.aviso ? `⚠ ${r.aviso}` : `Defeito ${cls.d.numero} → ${ROT[r.defeito.classificacao || "pendente"]}${r.tarefa ? ` · tarefa ${r.tarefa.numero || ""} criada` : ""}.`); setCls(null); carregar(); } catch (e) { setMsg(`⚠ ${e?.response?.data?.erro || e.message}`); } };
  const card = { ...s.card, padding: "12px 14px" }; const lab = { fontSize: 11.5, color: C.textSub, display: "block", marginBottom: 3 };
  const grupos = []; for (const d of L?.defeitos || []) { const k = `${d.projeto}|${d.referencia || ""}`; let g = grupos.find((x) => x.k === k); if (!g) { g = { k, projeto: d.projeto, referencia: d.referencia, itens: [] }; grupos.push(g); } g.itens.push(d); }
  const exige = cls && (cls.classe === "sem_reparo" || cls.classe === "investigar" || cls.classe === null);
  return <div style={{ display: "grid", gap: 10 }}>
    {abrirRep && <AbrirReparo C={C} s={s} defeito={abrirRep} cartoes={cartoes} onFechar={() => setAbrirRep(null)} onAberto={(rp) => { setAbrirRep(null); onAbrirReparo?.(rp.id); }} />}
    {ver && <VisualizadorFoto lista={ver.lista} inicio={ver.i} onFechar={() => setVer(null)} onMudou={(t) => { setMsg(t); carregar(); }} />}
    <div style={{ ...card, display: "flex", gap: 8, flexWrap: "wrap" }}>
      <select value={f.projeto_id} onChange={(e) => setF({ ...f, projeto_id: e.target.value })} style={{ ...s.input, flex: "1 1 180px" }}><option value="">Todos os projetos</option>{projetos.map((p) => <option key={p.id} value={p.id}>📁 {p.nome}</option>)}</select>
      <input value={f.busca} onChange={(e) => setF({ ...f, busca: e.target.value })} placeholder={`🔎 ${voc().ativo}, ${minus(voc().componente)}, nº, valor do cartão…`} style={{ ...s.input, flex: "2 1 220px" }} />
    </div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{[["pendente"], ["reparar"], ["investigar"], ["sem_reparo"], [""]].map(([k]) => <button key={k || "todos"} type="button" onClick={() => setF({ ...f, classe: k })} style={{ padding: "7px 12px", borderRadius: 16, cursor: "pointer", fontSize: 12.5, fontWeight: 600, border: `1px solid ${k ? COR_CLASSE[k] : C.border}`, background: f.classe === k ? (k ? COR_CLASSE[k] : C.accent) : "transparent", color: f.classe === k ? "#fff" : C.text }}>
      {k ? ROT[k] : "Todos"} {L ? `· ${k ? L.contagem[k] : Object.values(L.contagem).reduce((a, b) => a + b, 0)}` : ""}</button>)}</div>
    {msg && <div style={{ fontSize: 13, color: /^⚠/.test(msg) ? C.warn : "#22c55e" }}>{msg}</div>}
    {erro && <div style={{ ...card, color: C.danger }}>{erro}</div>}
    {!L && !erro && <div style={{ color: C.muted }}>Carregando…</div>}
    {L && !L.defeitos.length && <div style={{ ...card, color: C.muted, fontSize: 13 }}>{f.classe === "pendente" ? "Nenhum defeito esperando classificação." : "Nenhum defeito com esse filtro."} Os defeitos aparecem sozinhos quando a foto tem projeto e o cartão traz o <b>nº do defeito</b> (e o componente).</div>}
    {grupos.map((g) => <div key={g.k} style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.textSub, marginTop: 4 }}>📁 {g.projeto}{g.referencia ? ` · ${voc().icone} ${g.referencia}` : ""} · {g.itens.length}</div>
      {g.itens.map((d) => { const k = d.classificacao || "pendente"; return <div key={d.id} style={{ ...card, display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap", borderLeft: `4px solid ${COR_CLASSE[k]}` }}>
        <button type="button" onClick={() => abrirFotos(d)} style={{ width: 92, height: 92, padding: 0, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", cursor: "pointer", background: C.border, position: "relative", flex: "0 0 auto" }}>
          {d.capa_url && <img src={d.capa_url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}<span style={{ position: "absolute", right: 3, bottom: 3, background: "rgba(0,0,0,.7)", color: "#fff", fontSize: 11, borderRadius: 6, padding: "0 5px" }}>📸 {d.fotos}</span></button>
        <div style={{ flex: "1 1 240px", display: "grid", gap: 3 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{d.pa ? `${voc().componente} ${d.pa} · ` : ""}Defeito {d.numero} <span style={{ fontSize: 11.5, fontWeight: 700, color: COR_CLASSE[k], border: `1px solid ${COR_CLASSE[k]}`, borderRadius: 10, padding: "1px 8px", marginLeft: 4 }}>{ROT[k]}</span></div>
          <div style={{ fontSize: 12, color: C.textSub }}>{Object.entries(d.resumo || {}).filter(([r]) => !/^p[áa]$|defeito/i.test(r)).map(([r, v]) => `${r}: ${v}`).join(" · ") || "—"}</div>
          <div style={{ fontSize: 11.5, color: C.muted }}>👷 {d.tecnicos.join(", ") || "—"} · {quandoBR(d.primeira_em)}{d.ultima_em !== d.primeira_em ? ` → ${quandoBR(d.ultima_em)}` : ""}</div>
          {d.classificacao && <div style={{ fontSize: 12.5 }}>{d.justificativa ? `“${d.justificativa}” — ` : ""}<span style={{ color: C.textSub }}>{d.classificado_por}, {quandoBR(d.classificado_em)}</span>{d.tarefa_id ? " · 🔧 tarefa aberta" : ""}</div>}
        </div>
        {d.classificacao === "reparar" && (d.reparo ? <button type="button" onClick={() => onAbrirReparo?.(d.reparo.id)} style={{ ...s.btn(false), cursor: "pointer", flex: "0 0 auto" }}>🛠 {d.reparo.numero}{d.reparo.status === "concluido" ? " ✅" : ""}</button>
          : podeEditar && <button type="button" onClick={() => setAbrirRep(d)} style={{ ...s.btn(true), cursor: "pointer", flex: "0 0 auto" }}>🛠 Abrir reparo</button>)}
        {podeEditar && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: "0 1 auto" }}>{["sem_reparo", "reparar", "investigar"].map((c) => <button key={c} type="button" onClick={() => setCls({ d, classe: c, just: d.classificacao === c ? d.justificativa || "" : "", tarefa: !d.tarefa_id, prazo: "", resp_nome: "", resp_id: null, resp_uid: null })} style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12.5, fontWeight: 600, border: `1px solid ${COR_CLASSE[c]}`, background: d.classificacao === c ? COR_CLASSE[c] : "transparent", color: d.classificacao === c ? "#fff" : C.text }}>{ROT[c]}</button>)}</div>}
      </div>; })}
    </div>)}
    {cls && <div onClick={() => setCls(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "min(500px, 100%)", maxHeight: "92vh", overflowY: "auto", display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{cls.d.pa ? `${voc().componente} ${cls.d.pa} · ` : ""}Defeito {cls.d.numero} <span style={{ fontSize: 12.5, color: C.textSub, fontWeight: 400 }}>{cls.d.projeto}{cls.d.referencia ? ` · ${cls.d.referencia}` : ""}</span></div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{["sem_reparo", "reparar", "investigar"].map((c) => <button key={c} type="button" onClick={() => setCls({ ...cls, classe: c })} style={{ padding: "9px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 700, border: `1px solid ${COR_CLASSE[c]}`, background: cls.classe === c ? COR_CLASSE[c] : "transparent", color: cls.classe === c ? "#fff" : C.text }}>{ROT[c]}</button>)}
          {cls.d.classificacao && <button type="button" onClick={() => setCls({ ...cls, classe: null })} style={{ padding: "9px 12px", borderRadius: 8, cursor: "pointer", border: `1px solid ${C.border}`, background: cls.classe === null ? C.border : "transparent", color: C.text }}>↺ Voltar a classificar</button>}</div>
        <div><span style={lab}>JUSTIFICATIVA {exige ? "*" : "(opcional)"}</span><textarea value={cls.just} onChange={(e) => setCls({ ...cls, just: e.target.value })} rows={3} placeholder={cls.classe === "sem_reparo" ? "Ex.: dentro da tolerância do manual do fabricante" : cls.classe === "investigar" ? "Ex.: ultrassom inconclusivo — repetir com sonda de 2 MHz" : "Ex.: delaminação acima do limite — reparo estrutural"} style={{ ...s.input, width: "100%" }} /></div>
        {cls.classe === "investigar" && !cls.d.tarefa_id && <div style={{ display: "grid", gap: 8, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10 }}>
          <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={cls.tarefa} onChange={(e) => setCls({ ...cls, tarefa: e.target.checked })} /> Criar tarefa no Plano (🔧 TSK-DF-) para a investigação</label>
          {cls.tarefa && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><div style={{ flex: "2 1 200px" }}><span style={lab}>RESPONSÁVEL</span><CampoFuncionario C={C} s={s} lista={pessoas} nome={cls.resp_nome} id={cls.resp_id} usuarioId={cls.resp_uid} placeholder="Digite o nome do funcionário…" onChange={(v) => setCls({ ...cls, resp_nome: v.nome, resp_id: v.id, resp_uid: v.usuario_id })} /></div>
            <div style={{ flex: "1 1 140px" }}><span style={lab}>PRAZO *</span><input type="date" value={cls.prazo} onChange={(e) => setCls({ ...cls, prazo: e.target.value })} style={{ ...s.input, width: "100%" }} /></div></div>}
        </div>}
        {(cls.d.historico || []).length > 0 && <div style={{ fontSize: 11.5, color: C.muted, display: "grid", gap: 2 }}><b style={{ color: C.textSub }}>Histórico</b>{cls.d.historico.slice().reverse().map((h, i) => <div key={i}>{quandoBR(h.em)} · {h.por}: {ROT[h.de || "pendente"]} → {ROT[h.para || "pendente"]}{h.justificativa ? ` — ${h.justificativa}` : ""}</div>)}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={() => setCls(null)} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button>
          <button type="button" disabled={exige && cls.just.trim().length < 5} onClick={salvar} style={{ ...s.btn(true), cursor: "pointer", opacity: exige && cls.just.trim().length < 5 ? 0.5 : 1 }}>Salvar classificação</button></div>
      </div></div>}
  </div>;
}
