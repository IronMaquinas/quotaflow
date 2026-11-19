// components/nps/TelaNps.jsx — etapa N1: ⭐ NPS — satisfação dos clientes (admin, gestor, comercial)
//   NPS do período (promotores − detratores), por mês, o que pesou, lista de pesquisas (copiar link / reenviar / cancelar) e ＋ Nova pesquisa.
//   N1.1: aba ⚙ Modelos (perguntas extras, pontos 👍/👎), 👁 lida pelo cliente, filtro "Lidas sem resposta", resultado das perguntas extras.
//   A pesquisa nasce sozinha quando um pedido (PV) fica Concluído. Detrator (0–6) vira tarefa para a gestão tratar.
import { useEffect, useState } from "react";
import apiService from "../../services/apiService";
import FiltroPeriodo, { faixaPeriodo } from "../shared/FiltroPeriodo";
import ModelosNps from "./ModelosNps"; // N1.1

const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const corNota = (n) => (n == null ? "#64748b" : n <= 6 ? "#ef4444" : n <= 8 ? "#f59e0b" : "#22c55e");
const corNps = (v) => (v == null ? "#64748b" : v >= 50 ? "#22c55e" : v >= 0 ? "#f59e0b" : "#ef4444");
const ST = { pendente: ["sem envio", "#f59e0b"], enviada: ["enviada", "#60a5fa"], respondida: ["respondida", "#22c55e"], cancelada: ["cancelada", "#64748b"] };

export default function TelaNps({ C, s }) {
  const [per, setPer] = useState(() => faixaPeriodo("ano")); const [d, setD] = useState(null); const [erro, setErro] = useState(""); const [msg, setMsg] = useState("");
  const [nova, setNova] = useState(null); const [clientes, setClientes] = useState([]); const [filtro, setFiltro] = useState("todas"); const [aba, setAba] = useState("painel"); const [mods, setMods] = useState([]);
  const carregar = () => apiService.get(`/nps/painel?de=${per.de || ""}&ate=${per.ate || ""}`).then((r) => { setD(r); setErro(""); }).catch((e) => setErro(e?.response?.data?.erro || e.message));
  useEffect(() => { setD(null); carregar(); }, [per.de, per.ate]); // eslint-disable-line
  const abrirNova = async () => { setNova({ cliente_nome: "", contato_nome: "", email: "", origem_ref: "", modelo_id: "" }); apiService.get("/nps/modelos").then((r) => setMods(r.modelos || [])).catch(() => setMods([])); if (!clientes.length) for (const b of ["/contratos/clientes", "/comercial/clientes"]) { try { const r = await apiService.get(b); const l = r.clientes || r || []; if (Array.isArray(l) && l.length) { setClientes(l); break; } } catch { /* sem módulo */ } } };
  const acao = async (fn, ok) => { setMsg(""); try { const r = await fn(); setMsg(r?.aviso ? `⚠ ${r.aviso}` : ok); carregar(); return r; } catch (e) { setMsg(`⚠ ${e?.response?.data?.erro || e.message}`); return null; } };
  const copiar = (link) => { try { navigator.clipboard.writeText(link); setMsg("Link copiado — cole no WhatsApp ou e-mail do cliente."); } catch { setMsg(link); } };
  const card = { ...s.card, padding: "16px 18px" }; const tit = { fontSize: 12, color: C.textSub, fontWeight: 700, letterSpacing: ".04em", marginBottom: 10 };
  const lista = (d?.pesquisas || []).filter((p) => filtro === "todas" || (filtro === "detratores" ? p.classe === "detrator" : filtro === "lidas" ? ["pendente", "enviada"].includes(p.status) && p.aberta_em : filtro === "aguardando" ? ["pendente", "enviada"].includes(p.status) : p.status === filtro));

  return (
    <div style={{ padding: "20px clamp(12px, 3vw, 28px)", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div><div style={{ fontSize: 22, fontWeight: 800 }}>⭐ NPS — satisfação dos clientes</div><div style={{ fontSize: 13, color: C.textSub, marginTop: 2 }}>A pesquisa sai sozinha quando um pedido fica Concluído. Nota 0–6 vira tarefa para a gestão tratar.</div></div>
        <button type="button" onClick={abrirNova} style={{ ...s.btn(true), cursor: "pointer" }}>＋ Nova pesquisa</button>
      </div>
      <div style={{ display: "flex", gap: 6, borderBottom: `1px solid ${C.border}` }}>{[["painel", "Painel"], ["modelos", "⚙ Modelos"]].map(([k, r]) => <button key={k} type="button" onClick={() => setAba(k)} style={{ background: "none", border: "none", borderBottom: `2px solid ${aba === k ? C.accent : "transparent"}`, color: aba === k ? C.text : C.textSub, padding: "8px 12px", fontWeight: aba === k ? 700 : 500, cursor: "pointer", fontSize: 13.5 }}>{r}</button>)}</div>
      {aba === "modelos" && <ModelosNps C={C} s={s} onMsg={setMsg} />}
      {aba === "painel" && <FiltroPeriodo C={C} s={s} valor={per} onChange={setPer} />}
      {msg && <div style={{ fontSize: 13, color: /^⚠/.test(msg) ? C.warn : "#22c55e" }}>{msg}</div>}
      {erro && <div style={{ ...card, color: C.danger }}>{erro}</div>}
      {nova && <div style={{ ...card, border: `1px solid ${C.accent}66` }}><div style={tit}>NOVA PESQUISA</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input list="qf-nps-clientes" value={nova.cliente_nome} onChange={(e) => { const c = clientes.find((x) => (x.nome || x.razao_social) === e.target.value); setNova({ ...nova, cliente_nome: e.target.value, cliente_id: c?.id ?? null, contato_nome: c?.contato_nome || nova.contato_nome, email: c?.contato_email || nova.email }); }} placeholder="Cliente *" style={{ ...s.input, flex: "2 1 220px" }} />
          <datalist id="qf-nps-clientes">{clientes.map((c) => <option key={c.id} value={c.nome || c.razao_social} />)}</datalist>
          <input value={nova.contato_nome} onChange={(e) => setNova({ ...nova, contato_nome: e.target.value })} placeholder="Contato" style={{ ...s.input, flex: "1 1 160px" }} />
          <input value={nova.email} onChange={(e) => setNova({ ...nova, email: e.target.value })} placeholder="E-mail (vazio = só o link)" style={{ ...s.input, flex: "1 1 200px" }} />
          <select value={nova.modelo_id} onChange={(e) => setNova({ ...nova, modelo_id: e.target.value })} style={{ ...s.input, flex: "1 1 200px" }}>{mods.map((m) => <option key={m.id ?? "padrao"} value={m.id ?? "padrao"}>{m.padrao ? "★ " : ""}{m.nome}</option>)}</select>
          <input value={nova.origem_ref} onChange={(e) => setNova({ ...nova, origem_ref: e.target.value })} placeholder="Sobre qual serviço? (opcional)" style={{ ...s.input, flex: "2 1 240px" }} />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
          <button type="button" onClick={() => setNova(null)} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>Cancelar</button>
          <button type="button" disabled={!nova.cliente_nome.trim()} onClick={async () => { const r = await acao(() => apiService.post("/nps", nova), nova.email ? "Pesquisa enviada por e-mail." : "Pesquisa criada — copie o link na lista."); if (r) setNova(null); }} style={{ ...s.btn(true), cursor: "pointer" }}>{nova.email ? "Criar e enviar" : "Criar link"}</button>
        </div></div>}
      {aba === "painel" && !d && !erro && <div style={{ color: C.muted }}>Carregando…</div>}
      {aba === "painel" && d && <>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ ...card, flex: "1 1 200px" }}><div style={{ fontSize: 11.5, color: C.textSub }}>NPS do período</div><div style={{ fontSize: 34, fontWeight: 800, color: corNps(d.nps) }}>{d.nps == null ? "—" : d.nps}</div><div style={{ fontSize: 11.5, color: C.muted }}>{d.nps == null ? "sem respostas ainda" : d.nps >= 75 ? "excelente" : d.nps >= 50 ? "muito bom" : d.nps >= 0 ? "razoável — dá para melhorar" : "crítico"}</div></div>
          <div style={{ ...card, flex: "2 1 320px" }}><div style={{ fontSize: 11.5, color: C.textSub, marginBottom: 8 }}>{d.respostas} resposta(s) · taxa de resposta {d.taxa_resposta == null ? "—" : `${d.taxa_resposta}%`} de {d.enviadas}</div>
            {d.respostas > 0 && <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden" }}>{[[d.promotores, "#22c55e"], [d.neutros, "#f59e0b"], [d.detratores, "#ef4444"]].map(([n, c], i) => n > 0 && <div key={i} style={{ flex: n, background: c }} />)}</div>}
            <div style={{ display: "flex", gap: 14, fontSize: 12.5, marginTop: 8, flexWrap: "wrap" }}><span style={{ color: "#22c55e" }}>● {d.promotores} promotor(es) 9–10</span><span style={{ color: "#f59e0b" }}>● {d.neutros} neutro(s) 7–8</span><span style={{ color: "#ef4444" }}>● {d.detratores} detrator(es) 0–6</span></div></div>
        </div>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          <div style={card}><div style={tit}>NPS POR MÊS (12 MESES)</div><div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>{d.por_mes.map((m) => <div key={m.mes} title={m.nps == null ? "sem respostas" : `NPS ${m.nps} · ${m.respostas} resposta(s)`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 4 }}>{m.nps != null && <div style={{ fontSize: 10.5, color: corNps(m.nps), fontWeight: 700 }}>{m.nps}</div>}<div style={{ width: "100%", maxWidth: 30, height: m.nps == null ? 2 : `${Math.max(4, (m.nps + 100) / 2)}%`, background: m.nps == null ? C.border : corNps(m.nps), borderRadius: "4px 4px 0 0" }} /><div style={{ fontSize: 10.5, color: C.textSub }}>{MES[Number(m.mes.slice(5)) - 1]}</div></div>)}</div></div>
          <div style={card}><div style={tit}>PONTOS POSITIVOS E NEGATIVOS</div>{d.motivos.length ? d.motivos.map((m) => { const mx = Math.max(...d.motivos.map((x) => Math.max(x.elogios || 0, x.reclamacoes || 0)), 1); return <div key={m.chave} style={{ display: "grid", gridTemplateColumns: "1fr minmax(0, 1.3fr)", gap: 10, fontSize: 13, padding: "5px 0", alignItems: "center" }}><span>{m.nome}</span><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, alignItems: "center" }}><div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4 }}><span style={{ fontSize: 11.5, color: "#ef4444" }}>{m.reclamacoes || 0} 👎</span><div style={{ height: 8, width: `${((m.reclamacoes || 0) / mx) * 70}%`, background: "#ef4444", borderRadius: 4 }} /></div><div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ height: 8, width: `${((m.elogios || 0) / mx) * 70}%`, background: "#22c55e", borderRadius: 4 }} /><span style={{ fontSize: 11.5, color: "#22c55e" }}>👍 {m.elogios || 0}</span></div></div></div>; }) : <div style={{ color: C.muted, fontSize: 13 }}>Ainda sem respostas com pontos.</div>}</div>
        </div>
        {(d.perguntas || []).length > 0 && <div style={card}><div style={tit}>PERGUNTAS EXTRAS</div><div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>{d.perguntas.map((p) => <div key={`${p.modelo}|${p.id}`} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 11, color: C.muted }}>{p.modelo} · {p.respostas} resposta(s)</div><div style={{ fontWeight: 600, fontSize: 13.5, margin: "2px 0 6px" }}>{p.texto}</div>
          {p.tipo === "estrelas" && <div style={{ fontSize: 20, color: "#f59e0b" }}>{p.media == null ? "—" : <>{"★".repeat(Math.round(p.media))}<span style={{ color: C.border }}>{"★".repeat(5 - Math.round(p.media))}</span> <span style={{ fontSize: 14, color: C.text }}>{String(p.media).replace(".", ",")}</span></>}</div>}
          {p.tipo === "sim_nao" && <div style={{ fontSize: 14 }}>{p.sim_pct == null ? "—" : <><b style={{ color: "#22c55e" }}>{p.sim_pct}% sim</b> · <span style={{ color: C.textSub }}>{100 - p.sim_pct}% não</span></>}</div>}
          {p.tipo === "escolha" && p.opcoes.map((o) => <div key={o} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span>{o}</span><span style={{ color: C.textSub }}>{p.contagem[o] || 0}</span></div>)}
          {p.tipo === "texto" && (p.textos.length ? p.textos.map((x, i) => <div key={i} style={{ fontSize: 12.5, fontStyle: "italic", marginTop: 3 }}>"{x.texto}" <span style={{ fontStyle: "normal", color: C.muted }}>— {x.cliente}</span></div>) : <span style={{ color: C.muted, fontSize: 12.5 }}>—</span>)}
        </div>)}</div></div>}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}><div style={tit}>PESQUISAS</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{[["todas", "Todas"], ["aguardando", "Aguardando"], ["lidas", `👁 Lidas sem resposta${d.lidas_sem_resposta ? ` (${d.lidas_sem_resposta})` : ""}`], ["respondida", "Respondidas"], ["detratores", "Detratores"]].map(([k, r]) => <button key={k} type="button" onClick={() => setFiltro(k)} style={{ background: filtro === k ? C.accent : "transparent", color: filtro === k ? "#fff" : C.text, border: `1px solid ${filtro === k ? C.accent : C.border}`, borderRadius: 14, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>{r}</button>)}</div></div>
          {lista.length ? lista.map((p, i) => <div key={p.id} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "10px 0", borderTop: i ? `1px solid ${C.border}55` : "none" }}>
            <div style={{ width: 38, height: 38, borderRadius: 19, background: `${corNota(p.nota)}22`, border: `2px solid ${corNota(p.nota)}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: corNota(p.nota), flex: "none" }}>{p.nota ?? "–"}</div>
            <div style={{ flex: "1 1 240px", minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.cliente_nome} <span style={{ fontSize: 11, color: ST[p.status]?.[1], border: `1px solid ${ST[p.status]?.[1]}`, borderRadius: 9, padding: "0 6px", marginLeft: 4 }}>{ST[p.status]?.[0]}</span>{p.status !== "respondida" && p.aberta_em && <span style={{ fontSize: 11, color: "#a78bfa", border: "1px solid #a78bfa", borderRadius: 9, padding: "0 6px", marginLeft: 4 }}>👁 lida {new Date(p.ultima_abertura_em || p.aberta_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}{p.aberturas > 1 ? ` · ${p.aberturas}×` : ""}</span>}</div>
              <div style={{ fontSize: 12, color: C.textSub }}>{p.numero}{p.modelo_nome && p.modelo_nome !== "Padrão QuotaFlow" ? ` · ${p.modelo_nome}` : ""}{p.origem_ref ? ` · ${p.origem_ref}` : ""} · {p.status === "respondida" ? `respondeu ${dBR(p.respondida_em)}${p.respondente ? ` (${p.respondente})` : ""}` : `criada ${dBR(p.criado_em)}${p.email ? ` · ${p.email}` : " · sem e-mail"}`}</div>
              {p.comentario && <div style={{ fontSize: 12.5, marginTop: 3, fontStyle: "italic" }}>"{p.comentario}"</div>}
              {(() => { const nm = Object.fromEntries(((p.config || {}).itens_pontos || []).map((x) => [x.chave, x.nome])); const n = (k) => nm[k] || d.MOTIVOS[k] || k; const pos = p.pontos_positivos || []; const neg = p.pontos_negativos || [];
                if (pos.length || neg.length) return <div style={{ fontSize: 11.5, marginTop: 2 }}>{pos.length > 0 && <span style={{ color: "#22c55e" }}>👍 {pos.map(n).join(" · ")}</span>}{pos.length > 0 && neg.length > 0 && "  "}{neg.length > 0 && <span style={{ color: "#ef4444" }}>👎 {neg.map(n).join(" · ")}</span>}</div>;
                return (p.motivos || []).length > 0 ? <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{p.motivos.map(n).join(" · ")}</div> : null; })()}</div>
            {p.link && <div style={{ display: "flex", gap: 6 }}>
              <button type="button" onClick={() => copiar(p.link)} style={{ ...s.btn(false), cursor: "pointer", fontSize: 12, padding: "5px 10px", color: C.text }}>Copiar link</button>
              {p.email && <button type="button" onClick={() => acao(() => apiService.post(`/nps/${p.id}/reenviar`, {}), "Reenviada.")} style={{ ...s.btn(false), cursor: "pointer", fontSize: 12, padding: "5px 10px", color: C.text }}>Reenviar</button>}
              <button type="button" onClick={() => acao(() => apiService.post(`/nps/${p.id}/cancelar`, {}), "Pesquisa cancelada.")} style={{ ...s.btn(false), cursor: "pointer", fontSize: 12, padding: "5px 10px", color: C.textSub }}>Cancelar</button></div>}
          </div>) : <div style={{ color: C.muted, fontSize: 13 }}>Nenhuma pesquisa{filtro !== "todas" ? " neste filtro" : ""}. Elas aparecem quando um pedido fica Concluído — ou crie em ＋ Nova pesquisa.</div>}
        </div>
      </>}
    </div>
  );
}
