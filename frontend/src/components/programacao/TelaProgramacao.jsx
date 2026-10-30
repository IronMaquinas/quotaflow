// components/programacao/TelaProgramacao.jsx — etapa 16a: 🚛 Programação (operação, gestor, admin — SEM valores)
//   📋 A programar — pedidos abertos e seus trechos → 🚛 Programar (gera a AT do trecho)
//   🚛 ATs        — lista com filtro de status, ⚠ conflito, ⏰ coleta passou → abre a ficha
//   🗓 Agenda     — frota (equipamentos e motoristas) × 14 dias; conflito em vermelho
import { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";
import FichaAT, { COR_STATUS, NOME_STATUS, dataHora } from "./FichaAT";
import MesaProgramacao from "./MesaProgramacao";

const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const somaDias = (d, n) => new Date(new Date(`${d}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
const diaBR = (iso) => (iso ? new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10) : null);
const ddmm = (d) => d.slice(8, 10) + "/" + d.slice(5, 7);
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export default function TelaProgramacao({ C, s, perfis = [] }) {
  const [aba, setAba] = useState("programar");
  const [pedidos, setPedidos] = useState(null);
  const [ats, setAts] = useState(null);
  const [filtro, setFiltro] = useState("ativas");
  const [busca, setBusca] = useState("");
  const [ag, setAg] = useState(null);
  const [de, setDe] = useState(hoje());
  const [visao, setVisao] = useState("semana"); // 16d: semana (14 dias) · mês (calendário) · ano (ocupação por mês)
  const [ficha, setFicha] = useState(null);
  const [msg, setMsg] = useState(null);
  const podeLiberar = perfis.some((p) => ["admin", "gestor"].includes(p));
  const erro = (t) => setMsg({ t, erro: true });
  const ok = (t) => setMsg({ t });
  useEffect(() => { if (!msg) return; const x = setTimeout(() => setMsg(null), msg.erro ? 7000 : 4000); return () => clearTimeout(x); }, [msg]);

  const fimMes = (d) => { const [y, m] = d.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
  const periodo = visao === "ano" ? [`${de.slice(0, 4)}-01-01`, `${de.slice(0, 4)}-12-31`] : visao === "mes" ? [`${de.slice(0, 7)}-01`, fimMes(de)] : [de, somaDias(de, 13)];
  const mover = (n) => { if (visao === "ano") setDe(`${Number(de.slice(0, 4)) + n}-01-01`); else if (visao === "mes") { const [y, m] = de.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); setDe(d.toISOString().slice(0, 10)); } else setDe(somaDias(de, 7 * n)); };
  const carregar = async () => {
    try {
      const [p, a, g] = await Promise.all([apiService.get("/programacao/pedidos"), apiService.get(`/programacao/execucoes?status=${filtro}`), apiService.get(`/programacao/agenda?de=${periodo[0]}&ate=${periodo[1]}`)]);
      setPedidos(p.pedidos); setAts(a.execucoes); setAg(g);
    } catch (e) { erro(e.message); }
  };
  useEffect(() => { carregar(); }, [filtro, de, visao]); // eslint-disable-line

  const aProgramar = useMemo(() => (pedidos || []).map((p) => ({ ...p, faltam: p.trechos.reduce((n, t) => n + (t.a_programar ?? t.livres), 0) })), [pedidos]);
  const totalFaltam = aProgramar.reduce((a, p) => a + p.faltam, 0);
  // 16d: busca por palavras (todas precisam aparecer) — ex.: "BID-2026-0015 item 3", "série SN123", "ABC-333 Ana"
  const palheiro = (e) => `${e.numero} ${e.ref || ""} ${(e.itens || []).map((i) => `item ${i.n} #${i.n} série serie ${i.serie || ""}`).join(" ")} ${e.cliente_nome} ${e.pv_numero} ${e.motorista_nome} ${e.grupo_titulo} ${e.origem} ${e.destino} ${(e.conjunto || []).map((c) => c.tag).join(" ")}`.toLowerCase().replace(/·/g, " ");
  const atsFiltradas = (ats || []).filter((e) => { const p = busca.trim().toLowerCase().split(/\s+/).filter(Boolean); if (!p.length) return true; const h = palheiro(e); return p.every((w) => (w === "item" ? true : /^\d+$/.test(w) && p[p.indexOf(w) - 1] === "item" ? new RegExp(`item ${w}(\\D|$)`).test(h) : h.includes(w))); });

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

  // 16d: 🗓 visão mensal (calendário) e anual (ocupação por recurso × mês)
  const atsDoDia = (d) => (ag?.execucoes || []).filter((e) => { const ini = diaBR(e.inicio_previsto); const fim = diaBR(e.fim_efetivo || e.fim_previsto || e.inicio_previsto) || ini; return ini <= d && d <= fim; });
  const mesView = () => {
    const ini = `${de.slice(0, 7)}-01`; const w0 = new Date(`${ini}T12:00:00Z`).getUTCDay(); const n = Number(fimMes(de).slice(8, 10));
    const cel = [...Array(w0).fill(null), ...Array.from({ length: n }, (_, i) => somaDias(ini, i))]; while (cel.length % 7) cel.push(null);
    return <div style={{ ...s.card, padding: 0, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>{SEMANA.map((x) => <div key={x} style={{ padding: "6px 8px", fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", borderBottom: `1px solid ${C.border}` }}>{x}</div>)}
        {cel.map((d, i) => { const l = d ? atsDoDia(d) : []; return <div key={i} style={{ minHeight: 92, padding: 4, borderTop: `1px solid ${C.border}`, borderLeft: i % 7 ? `1px solid ${C.border}` : "none", background: d ? "transparent" : `${C.border}30` }}>
          {d && <div style={{ fontSize: 11.5, fontWeight: d === hoje() ? 800 : 600, color: d === hoje() ? C.accent : C.textSub, marginBottom: 3 }}>{Number(d.slice(8, 10))}</div>}
          {l.slice(0, 4).map((e) => <div key={e.id} className="qf-clicavel" onClick={() => setFicha(e.id)} title={`${e.numero} · ${e.ref || ""} · ${e.motorista_nome || "motorista a definir"} · ${(e.conjunto || []).map((c) => c.tag).join(" + ")}`}
            style={{ cursor: "pointer", background: e.conflitos?.length ? C.danger : COR_STATUS[e.status], color: "#fff", borderRadius: 4, padding: "1px 4px", marginBottom: 2, fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.numero.replace(/^AT-\d{4}-/, "AT ")} · {(e.conjunto || [])[0]?.tag || e.motorista_nome || ""}</div>)}
          {l.length > 4 && <div style={{ fontSize: 10.5, color: C.muted }}>+{l.length - 4} — veja na semana</div>}
        </div>; })}</div></div>;
  };
  const anoView = () => {
    const ano = de.slice(0, 4);
    const ocup = (l, m) => { const ini = `${ano}-${String(m + 1).padStart(2, "0")}-01`; const fim = fimMes(ini); const dias = new Set(); let cf = false;
      l.ats.forEach(({ e, ini: a, fim: b }) => { for (let d = a > ini ? a : ini; d <= (b < fim ? b : fim); d = somaDias(d, 1)) dias.add(d); if (e.conflitos?.length && a <= fim && b >= ini) cf = true; }); return { n: dias.size, cf, total: Number(fim.slice(8, 10)) }; };
    if (!linhas.length) return <div style={{ ...s.card, padding: 24, textAlign: "center", color: C.muted }}>Nenhuma AT em {ano}.</div>;
    return <div style={{ ...s.card, padding: 0, overflowX: "auto" }}><table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: "100%" }}>
      <thead><tr><th style={{ textAlign: "left", padding: "6px 10px", minWidth: 170, borderBottom: `1px solid ${C.border}`, color: C.text }}>RECURSO</th>{MESES.map((m, i) => <th key={m} className="qf-clicavel" onClick={() => { setDe(`${ano}-${String(i + 1).padStart(2, "0")}-01`); setVisao("mes"); }} style={{ padding: "6px 4px", cursor: "pointer", color: C.textSub, borderBottom: `1px solid ${C.border}`, minWidth: 54 }}>{m.slice(0, 3)}</th>)}</tr></thead>
      <tbody>{linhas.map((l) => <tr key={l.k}><td style={{ padding: "5px 10px", borderTop: `1px solid ${C.border}`, whiteSpace: "nowrap", fontWeight: 600, color: C.text }}>{l.rot}</td>
        {MESES.map((m, i) => { const o = ocup(l, i); const pct = o.n / o.total; return <td key={m} title={`${o.n} dia(s) ocupado(s) em ${m}`} className="qf-clicavel" onClick={() => { setDe(`${ano}-${String(i + 1).padStart(2, "0")}-01`); setVisao("mes"); }}
          style={{ padding: 2, borderTop: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}`, textAlign: "center", cursor: "pointer", background: o.n ? `${o.cf ? C.danger : C.accent}${Math.round(90 + pct * 160).toString(16).padStart(2, "0")}` : "transparent", color: o.n ? "#fff" : C.muted, fontWeight: 600 }}>{o.n || ""}</td>; })}</tr>)}</tbody></table></div>;
  };

  return (
    <div style={{ color: C.text, padding: "22px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ flex: 1 }}><div style={{ fontSize: 20, fontWeight: 800 }}>🚛 Programação</div><div style={{ fontSize: 12.5, color: C.textSub }}>Uma AT (Autorização de Transporte) por trecho do pedido — motorista, conjunto, datas e documentos. Valores ficam no 📈 Comercial.</div></div>
        <button type="button" onClick={carregar} style={{ ...s.btn(false), cursor: "pointer", color: C.text, padding: "6px 12px", fontSize: 12 }}>↻ Atualizar</button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {abaBt("programar", "🧩 Mesa de programação", totalFaltam)}{abaBt("ats", "🚛 ATs", (ats || []).filter((e) => e.conflitos?.length || e.atrasada).length ? "⚠" : null)}{abaBt("agenda", "🗓 Agenda da frota", ag?.com_conflito ? `${ag.com_conflito} ⚠` : null)}
      </div>

      {aba === "programar" && <MesaProgramacao C={C} s={s} pedidos={pedidos} podeLiberar={podeLiberar} onAbrirAT={setFicha} onSalvou={carregar} onErro={erro} onOk={ok} />}

      {aba === "ats" && <>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ ...s.input, width: 200 }}><option value="ativas">Ativas (programadas + em execução)</option>{Object.entries(NOME_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}<option value="">Todas</option></select>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar AT, BID, item (ex.: BID-2026-0015 item 3), nº de série, cliente, motorista, placa, cidade…" style={{ ...s.input, flex: 1, minWidth: 220 }} />
        </div>
        {!ats ? <div style={{ color: C.muted }}>Carregando…</div> : !atsFiltradas.length ? <div style={{ ...s.card, padding: 24, textAlign: "center", color: C.muted }}>Nenhuma AT neste filtro.</div> :
          <div style={{ ...s.card, padding: 0, overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["AT", "Status", "Coleta", "Rota", "Cliente / trecho", "Motorista", "Conjunto", ""].map((h) => <th key={h} style={{ textAlign: "left", fontSize: 10.5, color: C.muted, padding: "8px 10px", borderBottom: `1px solid ${C.border}` }}>{h.toUpperCase()}</th>)}</tr></thead>
            <tbody>{atsFiltradas.map((e) => <tr key={e.id} className="qf-clicavel" onClick={() => setFicha(e.id)} style={{ cursor: "pointer" }}>
              <td style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}`, fontWeight: 700, whiteSpace: "nowrap" }}>{e.numero}</td>
              <td style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}` }}>{chip(e)}</td>
              <td style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}`, whiteSpace: "nowrap", color: e.atrasada ? C.danger : C.text }}>{dataHora(e.inicio_previsto)}{e.atrasada ? " ⏰" : ""}</td>
              <td style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}`, color: C.textSub }}>{e.origem || "—"} ➜ {e.destino || "—"}</td>
              <td style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}` }}>{e.cliente_nome}<div style={{ fontSize: 11.5, color: C.muted }}>{e.ref || e.pv_numero} · {e.grupo_titulo}</div></td>
              <td style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}` }}>{e.motorista_nome || <span style={{ color: C.warn }}>a definir</span>}{e.liberacao ? " 🔓" : ""}</td>
              <td style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}`, fontSize: 12 }}>{(e.conjunto || []).map((c) => c.tag || c.nome).join(" + ")}</td>
              <td style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}` }}>{e.conflitos?.length ? <span title={e.conflitos.map((c) => c.texto).join("\n")} style={s.tag(C.warn)}>⚠ conflito</span> : null}</td>
            </tr>)}</tbody></table></div>}
      </>}

      {aba === "agenda" && <>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>{[["semana", "Semana"], ["mes", "Mês"], ["ano", "Ano"]].map(([k, r]) => <button key={k} type="button" onClick={() => setVisao(k)} style={{ background: visao === k ? C.accent : "transparent", color: visao === k ? "#fff" : C.textSub, border: "none", padding: "6px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{r}</button>)}</div>
          <button type="button" onClick={() => mover(-1)} style={{ ...s.btn(false), cursor: "pointer", color: C.text, padding: "6px 10px" }}>◀</button>
          {visao === "semana" ? <input type="date" value={de} onChange={(e) => e.target.value && setDe(e.target.value)} style={{ ...s.input, width: 160 }} />
            : <b style={{ minWidth: 150, textAlign: "center", fontSize: 14 }}>{visao === "ano" ? de.slice(0, 4) : `${MESES[Number(de.slice(5, 7)) - 1]} ${de.slice(0, 4)}`}</b>}
          <button type="button" onClick={() => mover(1)} style={{ ...s.btn(false), cursor: "pointer", color: C.text, padding: "6px 10px" }}>▶</button>
          <button type="button" onClick={() => setDe(hoje())} style={{ ...s.btn(false), cursor: "pointer", color: C.text, padding: "6px 10px", fontSize: 12 }}>Hoje</button>
          <span style={{ fontSize: 12, color: C.muted }}>{visao === "semana" ? "14 dias · recursos com AT no período" : visao === "mes" ? "ATs por dia (clique para abrir)" : "dias ocupados por recurso em cada mês (clique no mês para ver)"} · <span style={{ color: C.danger }}>vermelho</span> = conflito</span>
        </div>
        {!ag ? <div style={{ color: C.muted }}>Carregando…</div> : visao === "mes" ? mesView() : visao === "ano" ? anoView() : !linhas.length ? <div style={{ ...s.card, padding: 24, textAlign: "center", color: C.muted }}>Nenhuma AT neste período — frota livre.</div> :
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

      {ficha && <FichaAT C={C} s={s} id={ficha} podeLiberar={podeLiberar} onFechar={() => setFicha(null)} onMudou={carregar} onErro={erro} onOk={ok} />}
      {msg && <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 400, background: msg.erro ? C.danger : C.success, color: "#fff", padding: "10px 18px", borderRadius: 10, fontSize: 13, maxWidth: "90vw", boxShadow: "0 8px 24px #0006" }}>{msg.t}</div>}
    </div>
  );
}
