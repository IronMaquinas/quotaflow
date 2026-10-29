// components/programacao/TelaProgramacao.jsx — etapa 16a: 🚛 Programação (operação, gestor, admin — SEM valores)
//   📋 A programar — pedidos abertos e seus trechos → 🚛 Programar (gera a AT do trecho)
//   🚛 ATs        — lista com filtro de status, ⚠ conflito, ⏰ coleta passou → abre a ficha
//   🗓 Agenda     — frota (equipamentos e motoristas) × 14 dias; conflito em vermelho
import { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";
import FichaAT, { FormAT, COR_STATUS, NOME_STATUS, dataHora } from "./FichaAT";

const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const somaDias = (d, n) => new Date(new Date(`${d}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
const diaBR = (iso) => (iso ? new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10) : null);
const ddmm = (d) => d.slice(8, 10) + "/" + d.slice(5, 7);
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export default function TelaProgramacao({ C, s, perfis = [] }) {
  const [aba, setAba] = useState("programar");
  const [pedidos, setPedidos] = useState(null);
  const [ats, setAts] = useState(null);
  const [filtro, setFiltro] = useState("ativas");
  const [busca, setBusca] = useState("");
  const [ag, setAg] = useState(null);
  const [de, setDe] = useState(hoje());
  const [form, setForm] = useState(null); // { pv, trecho }
  const [ficha, setFicha] = useState(null);
  const [msg, setMsg] = useState(null);
  const podeLiberar = perfis.some((p) => ["admin", "gestor"].includes(p));
  const erro = (t) => setMsg({ t, erro: true });
  const ok = (t) => setMsg({ t });
  useEffect(() => { if (!msg) return; const x = setTimeout(() => setMsg(null), msg.erro ? 7000 : 4000); return () => clearTimeout(x); }, [msg]);

  const carregar = async () => {
    try {
      const [p, a, g] = await Promise.all([apiService.get("/programacao/pedidos"), apiService.get(`/programacao/execucoes?status=${filtro}`), apiService.get(`/programacao/agenda?de=${de}&ate=${somaDias(de, 13)}`)]);
      setPedidos(p.pedidos); setAts(a.execucoes); setAg(g);
    } catch (e) { erro(e.message); }
  };
  useEffect(() => { carregar(); }, [filtro, de]); // eslint-disable-line

  const aProgramar = useMemo(() => (pedidos || []).map((p) => ({ ...p, faltam: p.trechos.filter((t) => !t.at && t.qtd > 0).length })), [pedidos]);
  const totalFaltam = aProgramar.reduce((a, p) => a + p.faltam, 0);
  const atsFiltradas = (ats || []).filter((e) => !busca.trim() || `${e.numero} ${e.cliente_nome} ${e.pv_numero} ${e.motorista_nome} ${e.grupo_titulo} ${e.origem} ${e.destino} ${(e.conjunto || []).map((c) => c.tag).join(" ")}`.toLowerCase().includes(busca.trim().toLowerCase()));

  const abaBt = (k, r, n) => <button key={k} type="button" onClick={() => setAba(k)} style={{ background: aba === k ? C.accent : "transparent", color: aba === k ? "#fff" : C.textSub, border: `1px solid ${aba === k ? C.accent : C.border}`, borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>{r}{n ? <span style={{ marginLeft: 6, background: "#ffffff30", borderRadius: 10, padding: "0 6px", fontSize: 11 }}>{n}</span> : null}</button>;
  const chip = (e) => <span style={s.tag(COR_STATUS[e.status])}>{NOME_STATUS[e.status]}</span>;

  // ── agenda: linhas = recursos usados no período ──
  const dias = Array.from({ length: 14 }, (_, i) => somaDias(de, i));
  const linhas = useMemo(() => {
    const m = new Map();
    (ag?.execucoes || []).forEach((e) => {
      const ini = diaBR(e.inicio_previsto); const fim = diaBR(e.fim_efetivo || e.fim_previsto || e.inicio_previsto) || ini;
      const add = (k, rot, tipo) => { if (!m.has(k)) m.set(k, { k, rot, tipo, ats: [] }); m.get(k).ats.push({ e, ini, fim }); };
      (e.conjunto || []).forEach((c) => add(`eq${c.id}`, `${c.papel === "cavalo" ? "🚛" : "🔗"} ${c.tag || c.nome}`, 0));
      if (e.motorista_id) add(`mo${e.motorista_id}`, `👤 ${e.motorista_nome}`, 1);
    });
    return [...m.values()].sort((a, b) => a.tipo - b.tipo || a.rot.localeCompare(b.rot));
  }, [ag]);

  return (
    <div style={{ color: C.text }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ flex: 1 }}><div style={{ fontSize: 20, fontWeight: 800 }}>🚛 Programação</div><div style={{ fontSize: 12.5, color: C.textSub }}>Uma AT (Autorização de Transporte) por trecho do pedido — motorista, conjunto, datas e documentos. Valores ficam no 📈 Comercial.</div></div>
        <button type="button" onClick={carregar} style={{ ...s.btn(false), cursor: "pointer", color: C.text, padding: "6px 12px", fontSize: 12 }}>↻ Atualizar</button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {abaBt("programar", "📋 A programar", totalFaltam)}{abaBt("ats", "🚛 ATs", (ats || []).filter((e) => e.conflitos?.length || e.atrasada).length ? "⚠" : null)}{abaBt("agenda", "🗓 Agenda da frota", ag?.com_conflito ? `${ag.com_conflito} ⚠` : null)}
      </div>

      {aba === "programar" && (!pedidos ? <div style={{ color: C.muted }}>Carregando…</div> : !aProgramar.length ? <div style={{ ...s.card, padding: 24, textAlign: "center", color: C.muted }}>Nenhum pedido aberto. Os pedidos nascem do aceite do BID no 📈 Comercial.</div> :
        aProgramar.map((p) => <div key={p.id} style={{ ...s.card, padding: 0, marginBottom: 10, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <b>{p.numero}</b><span style={{ color: C.textSub, fontSize: 13 }}>{p.cliente_nome}{p.titulo ? ` · ${p.titulo}` : ""}{p.referencia ? ` · ref. ${p.referencia}` : ""}</span><div style={{ flex: 1 }} />
            {p.tipo_execucao !== "transporte" ? <span style={s.tag(C.muted)}>{p.tipo_execucao} — ainda não programável aqui</span> : p.faltam ? <span style={s.tag(C.warn)}>{p.faltam} trecho(s) a programar</span> : <span style={s.tag(C.success)}>tudo programado</span>}
          </div>
          {p.trechos.map((t) => <div key={t.id} style={{ padding: "8px 14px", display: "flex", gap: 10, alignItems: "center", borderTop: `1px solid ${C.border}`, fontSize: 13, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}><b>{t.titulo}</b> <span style={{ color: C.muted }}>· {t.qtd} item(ns){t.datas?.length ? ` · previsto ${t.datas.map((d) => d.split("-").reverse().join("/")).join(", ")}` : ""}</span></div>
            {t.at ? <button type="button" className="qf-clicavel" onClick={() => setFicha(t.at.id)} style={{ background: "none", border: "none", color: C.text, cursor: "pointer", display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}><b>{t.at.numero}</b>{chip(t.at)}<span style={{ color: C.muted }}>{dataHora(t.at.inicio_previsto)}</span></button>
              : t.qtd === 0 ? <span style={{ color: C.muted, fontSize: 12 }}>sem itens ativos</span>
              : p.tipo_execucao === "transporte" && <button type="button" onClick={() => setForm({ pv: p, trecho: t })} style={{ ...s.btn(true), cursor: "pointer", padding: "6px 12px", fontSize: 12 }}>🚛 Programar</button>}
          </div>)}
        </div>))}

      {aba === "ats" && <>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ ...s.input, width: 200 }}><option value="ativas">Ativas (programadas + em execução)</option>{Object.entries(NOME_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}<option value="">Todas</option></select>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar AT, cliente, motorista, placa/tag, cidade…" style={{ ...s.input, flex: 1, minWidth: 220 }} />
        </div>
        {!ats ? <div style={{ color: C.muted }}>Carregando…</div> : !atsFiltradas.length ? <div style={{ ...s.card, padding: 24, textAlign: "center", color: C.muted }}>Nenhuma AT neste filtro.</div> :
          <div style={{ ...s.card, padding: 0, overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["AT", "Status", "Coleta", "Rota", "Cliente / trecho", "Motorista", "Conjunto", ""].map((h) => <th key={h} style={{ textAlign: "left", fontSize: 10.5, color: C.muted, padding: "8px 10px", borderBottom: `1px solid ${C.border}` }}>{h.toUpperCase()}</th>)}</tr></thead>
            <tbody>{atsFiltradas.map((e) => <tr key={e.id} className="qf-clicavel" onClick={() => setFicha(e.id)} style={{ cursor: "pointer" }}>
              <td style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}`, fontWeight: 700, whiteSpace: "nowrap" }}>{e.numero}</td>
              <td style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}` }}>{chip(e)}</td>
              <td style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}`, whiteSpace: "nowrap", color: e.atrasada ? C.danger : C.text }}>{dataHora(e.inicio_previsto)}{e.atrasada ? " ⏰" : ""}</td>
              <td style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}`, color: C.textSub }}>{e.origem || "—"} ➜ {e.destino || "—"}</td>
              <td style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}` }}>{e.cliente_nome}<div style={{ fontSize: 11.5, color: C.muted }}>{e.pv_numero} · {e.grupo_titulo}</div></td>
              <td style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}` }}>{e.motorista_nome || <span style={{ color: C.warn }}>a definir</span>}{e.liberacao ? " 🔓" : ""}</td>
              <td style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}`, fontSize: 12 }}>{(e.conjunto || []).map((c) => c.tag || c.nome).join(" + ")}</td>
              <td style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}` }}>{e.conflitos?.length ? <span title={e.conflitos.map((c) => c.texto).join("\n")} style={s.tag(C.warn)}>⚠ conflito</span> : null}</td>
            </tr>)}</tbody></table></div>}
      </>}

      {aba === "agenda" && <>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={() => setDe(somaDias(de, -7))} style={{ ...s.btn(false), cursor: "pointer", color: C.text, padding: "6px 10px" }}>◀</button>
          <input type="date" value={de} onChange={(e) => e.target.value && setDe(e.target.value)} style={{ ...s.input, width: 160 }} />
          <button type="button" onClick={() => setDe(somaDias(de, 7))} style={{ ...s.btn(false), cursor: "pointer", color: C.text, padding: "6px 10px" }}>▶</button>
          <button type="button" onClick={() => setDe(hoje())} style={{ ...s.btn(false), cursor: "pointer", color: C.text, padding: "6px 10px", fontSize: 12 }}>Hoje</button>
          <span style={{ fontSize: 12, color: C.muted }}>14 dias · só recursos com AT no período · <span style={{ color: C.danger }}>vermelho</span> = o mesmo recurso em duas ATs ao mesmo tempo</span>
        </div>
        {!ag ? <div style={{ color: C.muted }}>Carregando…</div> : !linhas.length ? <div style={{ ...s.card, padding: 24, textAlign: "center", color: C.muted }}>Nenhuma AT neste período — frota livre.</div> :
          <div style={{ ...s.card, padding: 0, overflowX: "auto" }}><table style={{ borderCollapse: "collapse", fontSize: 11.5, minWidth: "100%" }}>
            <thead><tr><th style={{ position: "sticky", left: 0, background: C.surface || C.bg, color: C.text, textAlign: "left", padding: "6px 10px", minWidth: 170, borderBottom: `1px solid ${C.border}` }}>RECURSO</th>
              {dias.map((d) => { const w = new Date(`${d}T12:00:00Z`).getUTCDay(); return <th key={d} style={{ padding: "6px 4px", minWidth: 62, borderBottom: `1px solid ${C.border}`, color: d === hoje() ? C.accent : w === 0 || w === 6 ? C.muted : C.textSub, fontWeight: d === hoje() ? 800 : 600 }}>{SEMANA[w]}<br />{ddmm(d)}</th>; })}</tr></thead>
            <tbody>{linhas.map((l) => <tr key={l.k}>
              <td style={{ position: "sticky", left: 0, background: C.surface || C.bg, color: C.text, padding: "5px 10px", borderTop: `1px solid ${C.border}`, whiteSpace: "nowrap", fontWeight: 600 }}>{l.rot}</td>
              {dias.map((d) => { const aqui = l.ats.filter((x) => x.ini <= d && d <= x.fim); const choque = aqui.length > 1;
                return <td key={d} style={{ padding: 2, borderTop: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}`, verticalAlign: "top", background: choque ? `${C.danger}30` : "transparent" }}>
                  {aqui.map(({ e }) => <div key={e.id} onClick={() => setFicha(e.id)} title={`${e.numero} · ${e.cliente_nome} · ${e.origem || ""} ➜ ${e.destino || ""}`} className="qf-clicavel"
                    style={{ cursor: "pointer", background: choque ? C.danger : COR_STATUS[e.status], color: "#fff", borderRadius: 4, padding: "2px 4px", marginBottom: 2, fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 80 }}>{e.numero.replace(/^AT-\d{4}-/, "AT ")}</div>)}
                </td>; })}
            </tr>)}</tbody></table></div>}
      </>}

      {form && <FormAT C={C} s={s} pv={form.pv} trecho={form.trecho} podeLiberar={podeLiberar} onErro={erro} onFechar={() => setForm(null)}
        onSalvo={(r) => { setForm(null); ok(`${r.execucao.numero} programada.${r.avisos?.length ? ` ${r.avisos.join(" ")}` : ""}`); carregar(); setFicha(r.execucao.id); }} />}
      {ficha && <FichaAT C={C} s={s} id={ficha} podeLiberar={podeLiberar} onFechar={() => setFicha(null)} onMudou={carregar} onErro={erro} onOk={ok} />}
      {msg && <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 400, background: msg.erro ? C.danger : C.success, color: "#fff", padding: "10px 18px", borderRadius: 10, fontSize: 13, maxWidth: "90vw", boxShadow: "0 8px 24px #0006" }}>{msg.t}</div>}
    </div>
  );
}
