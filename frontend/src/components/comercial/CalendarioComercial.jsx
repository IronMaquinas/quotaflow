// components/comercial/CalendarioComercial.jsx — etapa 18a: 📅 CALENDÁRIO COMERCIAL + 🎪 eventos de mercado
//   visões Mês (calendário) · Semana (dia a dia) · Ano (resumo por mês) — com filtro do que mostrar
//   🎯 decisão esperada do BID · ⌛ validade da proposta · 🚚 transporte negociando (BID) · 🚛 transporte vendido (pedido) · ⏰ tarefas
//   🎪 eventos de mercado (feira, safra, obra, licitação…) e 📣 o dia de começar a prospecção (antecedência)
//   clicar: BID → ficha do BID · pedido → ficha do pedido · evento/prospecção → editar o evento
import { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const somaDias = (d, n) => new Date(new Date(`${d}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
const fimMes = (d) => { const [y, m] = d.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const dBR = (d) => String(d || "").slice(0, 10).split("-").reverse().join("/");
const CAMADAS = { decisao: ["🎯 Decisão", "#a855f7"], validade: ["⌛ Validade", "#f97316"], transporte_bid: ["🚚 Negociando", "#38bdf8"], transporte_pv: ["🚛 Vendido", "#22c55e"],
  tarefa: ["⏰ Tarefas", "#eab308"], evento: ["🎪 Eventos", "#ec4899"], prospeccao: ["📣 Prospecção", "#f43f5e"] };

function FormEvento({ C, s, ev, base, onFechar, onSalvo, onErro }) {
  const [f, setF] = useState(() => ({ nome: ev?.nome || "", tipo: ev?.tipo || "feira", cidade: ev?.cidade || "", uf: ev?.uf || "", inicio: ev?.inicio || "", fim: ev?.fim || "",
    repete_anual: ev ? !!ev.repete_anual : true, antecedencia_dias: ev?.antecedencia_dias ?? 60, observacoes: ev?.observacoes || "", clientes: (ev?.clientes || []).map(String), responsavel_id: ev?.responsavel_id ?? "" }));
  const [clientes, setClientes] = useState([]); const [busca, setBusca] = useState(""); const [ocupado, setOcupado] = useState(false); const [apagar, setApagar] = useState(false);
  useEffect(() => { apiService.get("/comercial/clientes").then((r) => setClientes(r.clientes || [])).catch(() => {}); }, []);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const salvar = async () => { setOcupado(true); try { const corpo = { ...f, antecedencia_dias: Number(f.antecedencia_dias) || 0, fim: f.fim || null }; if (ev) await apiService.put(`/comercial/eventos/${ev.id}`, corpo); else await apiService.post("/comercial/eventos", corpo); onSalvo(ev ? "Evento atualizado." : "Evento criado."); } catch (e) { onErro(e.message); } finally { setOcupado(false); } };
  const remover = async () => { setOcupado(true); try { await apiService.delete(`/comercial/eventos/${ev.id}`); onSalvo("Evento removido."); } catch (e) { onErro(e.message); } finally { setOcupado(false); } };
  const lbl = (r, el, flex = "1 1 200px") => <label style={{ flex, display: "block", minWidth: 0 }}><span style={s.label}>{r}</span>{el}</label>;
  const prosp = f.inicio ? somaDias(f.inicio, -(Number(f.antecedencia_dias) || 0)) : null;
  const visiveis = clientes.filter((c) => !busca.trim() || String(c.nome).toLowerCase().includes(busca.trim().toLowerCase()) || f.clientes.includes(String(c.id)));
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090", zIndex: 330, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }} onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: 720, maxWidth: "100%", padding: "16px 20px", margin: "auto 0", color: C.text }}>
        <div style={{ display: "flex", alignItems: "baseline" }}><div style={{ flex: 1, fontSize: 16, fontWeight: 700 }}>{ev ? "✏ Evento de mercado" : "🎪 Novo evento de mercado"}</div>
          <button type="button" onClick={onFechar} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button></div>
        <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 10 }}>Feiras, safras, obras e licitações que geram demanda de transporte. Na data de prospecção entra uma ⏰ tarefa para o responsável.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{lbl("NOME *", <input value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Feira de Máquinas — BH" style={s.input} />, "2 1 300px")}
          {lbl("TIPO", <select value={f.tipo} onChange={(e) => set("tipo", e.target.value)} style={s.input}>{Object.entries(base.tipos || {}).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select>, "0 1 160px")}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{lbl("CIDADE", <input value={f.cidade} onChange={(e) => set("cidade", e.target.value)} style={s.input} />)}
          {lbl("UF", <input value={f.uf} maxLength={2} onChange={(e) => set("uf", e.target.value.toUpperCase())} style={s.input} />, "0 1 70px")}
          {lbl("INÍCIO *", <input type="date" value={f.inicio} onChange={(e) => { const v = e.target.value; setF((x) => ({ ...x, inicio: v, fim: x.fim && v && x.fim < v ? "" : x.fim })); }} style={s.input} />, "0 1 160px")}
          {lbl("FIM", <input type="date" value={f.fim} min={f.inicio || undefined} onChange={(e) => set("fim", e.target.value)} style={s.input} />, "0 1 160px")}{/* 18a.1: o calendário não deixa fim antes do início */}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "flex-end" }}>
          {lbl("PROSPECTAR QUANTOS DIAS ANTES", <input type="number" min={0} max={365} value={f.antecedencia_dias} onChange={(e) => set("antecedencia_dias", e.target.value)} style={s.input} />, "0 1 210px")}
          {lbl("RESPONSÁVEL (RECEBE A TAREFA)", <select value={f.responsavel_id} onChange={(e) => set("responsavel_id", e.target.value)} style={s.input}><option value="">— quem criar —</option>{(base.responsaveis || []).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select>)}
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, paddingBottom: 10, cursor: "pointer" }}><input type="checkbox" checked={f.repete_anual} onChange={(e) => set("repete_anual", e.target.checked)} />🔁 Repete todo ano</label>
        </div>
        {prosp && <div style={{ fontSize: 12, color: C.accent, marginTop: 4 }}>📣 Prospecção a partir de {dBR(prosp)}{f.repete_anual ? " (todo ano)" : ""}.</div>}
        <div style={{ ...s.label, marginTop: 12 }}>CLIENTES LIGADOS (QUEM CONTRATOU NESSE EVENTO) — {f.clientes.length}</div>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente…" style={{ ...s.input, marginBottom: 6 }} />
        <div style={{ maxHeight: 150, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 8px" }}>
          {visiveis.map((c) => <label key={c.id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, padding: "3px 0", cursor: "pointer" }}><input type="checkbox" checked={f.clientes.includes(String(c.id))} onChange={(e) => set("clientes", e.target.checked ? [...f.clientes, String(c.id)] : f.clientes.filter((x) => x !== String(c.id)))} />{c.nome}</label>)}
          {!visiveis.length && <div style={{ fontSize: 12, color: C.muted, padding: 4 }}>Nenhum cliente.</div>}
        </div>
        <label style={{ display: "block", marginTop: 10 }}><span style={s.label}>OBSERVAÇÕES</span><textarea rows={2} value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} placeholder="Ex.: expositores precisam entregar as máquinas 5 dias antes; pavilhão 2" style={{ ...s.input, resize: "vertical" }} /></label>
        <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
          {ev && (apagar ? <><span style={{ fontSize: 12.5, color: C.danger }}>Remover o evento?</span><button type="button" onClick={() => setApagar(false)} style={{ ...s.btn(false), cursor: "pointer", color: C.text, padding: "6px 10px", fontSize: 12 }}>Não</button><button type="button" disabled={ocupado} onClick={remover} style={{ ...s.btn(true, C.danger), padding: "6px 10px", fontSize: 12 }}>Remover</button></>
            : <button type="button" onClick={() => setApagar(true)} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 12 }}>🗑 Remover evento</button>)}
          <div style={{ flex: 1 }} />
          <button type="button" onClick={onFechar} style={{ ...s.btn(false), cursor: "pointer", color: C.text, padding: "8px 14px" }}>Cancelar</button>
          <button type="button" disabled={ocupado || !f.nome.trim() || !f.inicio} onClick={salvar} style={{ ...s.btn(!ocupado && !!f.nome.trim() && !!f.inicio), padding: "8px 16px" }}>{ocupado ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}

export default function CalendarioComercial({ C, s, onAbrirBid, onAbrirPV, onErro, onOk }) {
  const [visao, setVisao] = useState("mes"); const [ref, setRef] = useState(hoje());
  const [dados, setDados] = useState(null); const [base, setBase] = useState(null); const [form, setForm] = useState(null);
  const [mostrar, setMostrar] = useState(() => Object.fromEntries(Object.keys(CAMADAS).map((k) => [k, true])));
  const periodo = visao === "ano" ? [`${ref.slice(0, 4)}-01-01`, `${ref.slice(0, 4)}-12-31`] : visao === "semana" ? [ref, somaDias(ref, 6)] : [`${ref.slice(0, 7)}-01`, fimMes(ref)];
  const carregar = async () => { try { const [c, e] = await Promise.all([apiService.get("/comercial/calendario", { de: periodo[0], ate: periodo[1] }), apiService.get("/comercial/eventos")]); setDados(c); setBase(e); } catch (er) { onErro(er.message); } };
  useEffect(() => { carregar(); }, [visao, ref]); // eslint-disable-line
  const itens = useMemo(() => (dados?.itens || []).filter((i) => mostrar[i.tipo]), [dados, mostrar]);
  const doDia = (d) => itens.filter((i) => (i.ate ? i.data <= d && d <= i.ate : i.data === d));
  const mover = (n) => { if (visao === "ano") setRef(`${Number(ref.slice(0, 4)) + n}-01-01`); else if (visao === "semana") setRef(somaDias(ref, 7 * n)); else { const [y, m] = ref.split("-").map(Number); setRef(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10)); } };
  const clicar = (i) => { if (i.ref?.bid_id) onAbrirBid(i.ref.bid_id); else if (i.ref?.pv_id) onAbrirPV(i.ref.pv_id); else if (i.ref?.evento_id) { const ev = base?.eventos?.find((e) => String(e.id) === String(i.ref.evento_id)); if (ev) setForm({ ev }); } };
  const chip = (i, k) => { const [, cor] = CAMADAS[i.tipo] || ["", C.muted]; return <div key={k} className="qf-clicavel" onClick={() => clicar(i)} title={`${i.titulo}${i.sub ? ` — ${i.sub}` : ""}`}
    style={{ cursor: "pointer", background: `${cor}26`, borderLeft: `3px solid ${cor}`, color: C.text, borderRadius: 4, padding: "1px 5px", marginBottom: 2, fontSize: 10.8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: i.feita ? "line-through" : "none", opacity: i.feita ? 0.6 : 1 }}>{i.titulo}</div>; };

  const mesView = () => {
    const ini = `${ref.slice(0, 7)}-01`; const w0 = new Date(`${ini}T12:00:00Z`).getUTCDay(); const n = Number(fimMes(ref).slice(8, 10));
    const cel = [...Array(w0).fill(null), ...Array.from({ length: n }, (_, i) => somaDias(ini, i))]; while (cel.length % 7) cel.push(null);
    return <div style={{ ...s.card, padding: 0, overflow: "hidden" }}><div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
      {SEMANA.map((x) => <div key={x} style={{ padding: "6px 8px", fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", borderBottom: `1px solid ${C.border}` }}>{x}</div>)}
      {cel.map((d, i) => { const l = d ? doDia(d) : []; return <div key={i} style={{ minHeight: 98, padding: 4, borderTop: `1px solid ${C.border}`, borderLeft: i % 7 ? `1px solid ${C.border}` : "none", background: d ? "transparent" : `${C.border}30` }}>
        {d && <div style={{ fontSize: 11.5, fontWeight: d === hoje() ? 800 : 600, color: d === hoje() ? C.accent : C.textSub, marginBottom: 3 }}>{Number(d.slice(8, 10))}</div>}
        {l.slice(0, 4).map((x, k) => chip(x, k))}{l.length > 4 && <div className="qf-clicavel" onClick={() => { setRef(d); setVisao("semana"); }} style={{ fontSize: 10.5, color: C.accent, cursor: "pointer" }}>+{l.length - 4} — ver a semana</div>}
      </div>; })}</div></div>;
  };
  const semanaView = () => <div style={{ ...s.card, padding: 0 }}>{Array.from({ length: 7 }, (_, i) => somaDias(ref, i)).map((d) => { const l = doDia(d); const w = new Date(`${d}T12:00:00Z`).getUTCDay();
    return <div key={d} style={{ display: "flex", gap: 12, padding: "10px 14px", borderTop: `1px solid ${C.border}` }}>
      <div style={{ width: 70, flex: "0 0 70px", color: d === hoje() ? C.accent : C.textSub, fontWeight: 700, fontSize: 13 }}>{SEMANA[w]}<div style={{ fontSize: 18 }}>{d.slice(8, 10)}/{d.slice(5, 7)}</div></div>
      <div style={{ flex: 1, minWidth: 0 }}>{l.length ? l.map((x, k) => <div key={k} className="qf-clicavel" onClick={() => clicar(x)} style={{ cursor: "pointer", padding: "4px 8px", marginBottom: 4, borderRadius: 6, borderLeft: `3px solid ${(CAMADAS[x.tipo] || [])[1]}`, background: `${(CAMADAS[x.tipo] || [])[1]}14`, textDecoration: x.feita ? "line-through" : "none" }}>
        <div style={{ fontSize: 13 }}>{x.titulo}</div>{x.sub && <div style={{ fontSize: 11.5, color: C.textSub }}>{x.sub}</div>}</div>) : <div style={{ fontSize: 12, color: C.muted, paddingTop: 6 }}>—</div>}</div>
    </div>; })}</div>;
  const anoView = () => <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>{MESES.map((m, i) => {
    const a = `${ref.slice(0, 4)}-${String(i + 1).padStart(2, "0")}-01`; const b = fimMes(a); const l = itens.filter((x) => x.data <= b && (x.ate || x.data) >= a);
    const conta = Object.keys(CAMADAS).map((k) => [k, l.filter((x) => x.tipo === k).length]).filter(([, n]) => n);
    return <div key={m} className="qf-clicavel" onClick={() => { setRef(a); setVisao("mes"); }} style={{ ...s.card, padding: "10px 12px", cursor: "pointer" }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{m}</div>
      {l.filter((x) => x.tipo === "evento").map((x, k) => <div key={k} style={{ fontSize: 12, color: CAMADAS.evento[1] }}>{x.titulo} · {dBR(x.inicio_real || x.data).slice(0, 5)}</div>)}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>{conta.filter(([k]) => k !== "evento").map(([k, n]) => <span key={k} style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 8, background: `${CAMADAS[k][1]}22`, color: CAMADAS[k][1] }}>{CAMADAS[k][0]} {n}</span>)}</div>
      {!l.length && <div style={{ fontSize: 11.5, color: C.muted }}>—</div>}
    </div>; })}</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>{[["semana", "Semana"], ["mes", "Mês"], ["ano", "Ano"]].map(([k, r]) => <button key={k} type="button" onClick={() => setVisao(k)} style={{ background: visao === k ? C.accent : "transparent", color: visao === k ? "#fff" : C.textSub, border: "none", padding: "6px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{r}</button>)}</div>
        <button type="button" onClick={() => mover(-1)} style={{ ...s.btn(false), cursor: "pointer", color: C.text, padding: "6px 10px" }}>◀</button>
        <b style={{ minWidth: 170, textAlign: "center" }}>{visao === "ano" ? ref.slice(0, 4) : visao === "semana" ? `${dBR(periodo[0]).slice(0, 5)} a ${dBR(periodo[1])}` : `${MESES[Number(ref.slice(5, 7)) - 1]} ${ref.slice(0, 4)}`}</b>
        <button type="button" onClick={() => mover(1)} style={{ ...s.btn(false), cursor: "pointer", color: C.text, padding: "6px 10px" }}>▶</button>
        <button type="button" onClick={() => setRef(hoje())} style={{ ...s.btn(false), cursor: "pointer", color: C.text, padding: "6px 10px", fontSize: 12 }}>Hoje</button>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={() => setForm({ ev: null })} style={{ ...s.btn(true), padding: "7px 14px", fontSize: 12.5 }}>🎪 ＋ Evento de mercado</button>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>{Object.entries(CAMADAS).map(([k, [r, cor]]) => <button key={k} type="button" onClick={() => setMostrar((x) => ({ ...x, [k]: !x[k] }))}
        style={{ background: mostrar[k] ? `${cor}22` : "transparent", color: mostrar[k] ? C.text : C.muted, border: `1px solid ${mostrar[k] ? cor : C.border}`, borderRadius: 14, padding: "3px 10px", fontSize: 12, cursor: "pointer" }}>{r}</button>)}</div>
      {!dados ? <div style={{ color: C.muted }}>Carregando…</div> : visao === "mes" ? mesView() : visao === "semana" ? semanaView() : anoView()}
      {base && <div style={{ ...s.card, padding: "10px 14px", marginTop: 14 }}>
        <div style={{ ...s.label, marginBottom: 6 }}>🎪 EVENTOS DE MERCADO ({base.eventos.length})</div>
        {base.eventos.map((e) => <div key={e.id} className="qf-clicavel" onClick={() => setForm({ ev: e })} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", borderTop: `1px solid ${C.border}`, cursor: "pointer", flexWrap: "wrap", fontSize: 13 }}>
          <span style={{ flex: "1 1 240px" }}><b>{e.nome}</b> <span style={{ color: C.textSub }}>· {e.tipo_nome}{e.cidade ? ` · ${e.cidade}${e.uf ? `/${e.uf}` : ""}` : ""}{e.repete_anual ? " · 🔁 anual" : ""}</span></span>
          <span style={{ color: C.textSub, fontSize: 12 }}>{e.proxima ? `${dBR(e.proxima.inicio)}${e.faltam > 0 ? ` · faltam ${e.faltam} dias` : " · acontecendo"}` : "já passou"}</span>
          {e.proxima && <span style={{ fontSize: 11.5, color: e.prospeccao <= hoje() ? CAMADAS.prospeccao[1] : C.muted }}>📣 {e.prospeccao <= hoje() ? "hora de prospectar" : `prospectar a partir de ${dBR(e.prospeccao)}`}</span>}
          {e.clientes_nomes?.length > 0 && <span style={{ fontSize: 11.5, color: C.muted }}>👥 {e.clientes_nomes.length}</span>}
        </div>)}
        {!base.eventos.length && <div style={{ fontSize: 12.5, color: C.muted }}>Nenhum evento ainda. Cadastre as feiras e datas do seu mercado — o sistema avisa quando for hora de procurar os clientes.</div>}
      </div>}
      {form && base && <FormEvento C={C} s={s} ev={form.ev} base={base} onErro={onErro} onFechar={() => setForm(null)} onSalvo={(m) => { setForm(null); onOk(m); carregar(); }} />}
    </div>
  );
}
