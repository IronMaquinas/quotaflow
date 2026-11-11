// components/contratos/MobilizacaoContrato.jsx — etapa 18y: 🚛 mobilização/desmobilização do contrato → AT · 📈 faturamento previsto
//   A mobilização vira um trecho do pedido de transporte do contrato; a AT é programada em 🚛 Programação, como sempre.
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import { moduloAtivo } from "../../utils/modulosSessao";

const dataBR = (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");
const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const STATUS_AT = { programada: "📅 programada", em_execucao: "🚛 em execução", concluida: "✅ concluída" };
const irPara = (tela) => window.dispatchEvent(new CustomEvent("qf-ir-tela", { detail: tela }));

export default function MobilizacaoContrato({ C, s, contrato, editar, onOk, onErro }) {
  const [d, setD] = useState(null); const [form, setForm] = useState(null); const [env, setEnv] = useState(false);
  const carregar = () => apiService.get(`/contratos/${contrato.id}/mobilizacoes`).then(setD).catch(() => setD({ movimentos: [] }));
  useEffect(() => { carregar(); }, [contrato.id]); // eslint-disable-line
  if (!moduloAtivo("transporte")) return null; // sem Programação/AT no plano: a seção não aparece
  const ativos = (contrato.equipamentos || []).filter((e) => e.ativa);
  const abrir = (tipo) => setForm({ tipo, base_saida: d?.base_saida || "", origem: "", destino: "", data: "", valor: "", equipamentos: ativos.map((e) => String(e.equipamento_id)) });
  const salvar = async () => {
    setEnv(true);
    try { const r = await apiService.post(`/contratos/${contrato.id}/mobilizacoes`, form); setForm(null); onOk?.(r.mensagem); carregar(); }
    catch (e) { onErro?.(e.message); } finally { setEnv(false); }
  };
  const mob = form?.tipo === "mobilizacao"; const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return <>
    <div style={{ display: "flex", alignItems: "center", marginTop: 16, marginBottom: 6, gap: 6, flexWrap: "wrap" }}>
      <div style={{ fontWeight: 700, flex: 1 }}>🚛 Mobilização e desmobilização</div>
      {editar && contrato.status === "ativo" && ativos.length > 0 && <>
        <button type="button" onClick={() => abrir("mobilizacao")} style={{ ...s.btn(false), padding: "5px 10px", fontSize: 12 }}>＋ Mobilização</button>
        <button type="button" onClick={() => abrir("desmobilizacao")} style={{ ...s.btn(false), padding: "5px 10px", fontSize: 12 }}>＋ Desmobilização</button></>}
    </div>
    {d?.sem_migration ? <div style={{ fontSize: 12, color: C.danger }}>Falta rodar a migration 079 no Supabase.</div>
      : !d ? <div style={{ fontSize: 12, color: C.muted }}>Carregando…</div>
      : d.movimentos.length === 0 ? <div style={{ fontSize: 12, color: C.muted }}>Levar as máquinas até a obra (e trazer de volta) vira um pedido de transporte do contrato — a AT é programada em 🚛 Programação.</div>
      : d.movimentos.map((m) => <div key={m.pv_id + m.grupo_id} style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 10px", marginBottom: 6, fontSize: 12.5 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}><b style={{ flex: 1 }}>{m.titulo}</b><span style={{ color: C.muted }}>{m.pv_numero} · {m.itens - m.cancelados} equip.{m.data ? ` · ${dataBR(m.data)}` : ""}</span></div>
        <div style={{ color: C.textSub }}>{m.origem || "—"} → {m.destino || "—"}</div>
        <div style={{ marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {m.ats.length ? m.ats.map((a) => <span key={a.id} style={s.tag(a.status === "concluida" ? C.success : C.accent)}>{a.numero} · {STATUS_AT[a.status] || a.status}{a.motorista_nome ? ` · ${a.motorista_nome}` : ""}</span>)
            : <><span style={s.tag(C.warning || "#f59e0b")}>⏳ AT a programar</span><button type="button" onClick={() => irPara("programacao")} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 0, fontSize: 12, textDecoration: "underline" }}>abrir 🚛 Programação</button></>}
        </div>
      </div>)}
    {form && <div onClick={() => !env && setForm(null)} style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={mob ? "Mobilização" : "Desmobilização"} style={{ ...s.card, width: 520, maxWidth: "100%", padding: 20, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{mob ? "🚛➡️ Mobilização" : "⬅️🚛 Desmobilização"} — {contrato.numero}</div>
        <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 12 }}>{mob ? "Levar as máquinas até a obra." : "Trazer as máquinas de volta."} Vira um trecho do pedido de transporte do contrato; a AT (motorista, conjunto, documentos) é programada em 🚛 Programação.</div>
        <label style={s.label}>PÁTIO / BASE DA EMPRESA</label><input value={form.base_saida} onChange={set("base_saida")} placeholder="ex.: Pátio Contagem — Av. ..., 1000" style={s.input} />
        <label style={s.label}>{mob ? "LOCAL DA OBRA (DESTINO)" : "LOCAL DA OBRA (ORIGEM)"}</label><input value={mob ? form.destino : form.origem} onChange={set(mob ? "destino" : "origem")} placeholder={contrato.local || "endereço da obra"} style={s.input} />
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: -6, marginBottom: 10 }}>Em branco = {contrato.local ? `"${contrato.local}" (local do contrato)` : "o local do contrato"}.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={s.label}>DATA PREVISTA</label><input type="date" value={form.data} onChange={set("data")} style={s.input} /></div>
          <div><label style={s.label}>VALOR COBRADO (OPCIONAL)</label><input type="number" min="0" step="0.01" value={form.valor} onChange={set("valor")} style={s.input} /></div>
        </div>
        <label style={s.label}>EQUIPAMENTOS</label>
        {ativos.map((e) => { const id = String(e.equipamento_id); const on = form.equipamentos.includes(id);
          return <label key={id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "4px 0", cursor: "pointer" }}><input type="checkbox" checked={on} onChange={() => setForm({ ...form, equipamentos: on ? form.equipamentos.filter((x) => x !== id) : [...form.equipamentos, id] })} />{e.tag ? `${e.tag} · ` : ""}{e.nome}</label>; })}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <button type="button" disabled={env} onClick={() => setForm(null)} style={{ ...s.btn(false), padding: "8px 16px" }}>Cancelar</button>
          <button type="button" disabled={env || !form.equipamentos.length} onClick={salvar} style={{ ...s.btn(true), padding: "8px 16px" }}>{env ? "Criando…" : "Criar e ir programar"}</button>
        </div>
      </div></div>}
  </>;
}

/** 📈 faturamento previsto dos contratos de locação (próximos meses) */
export function FaturamentoPrevisto({ C, s, onFechar, onAbrirContrato }) {
  const [d, setD] = useState(null); const [erro, setErro] = useState(null); const [meses, setMeses] = useState(6);
  useEffect(() => { apiService.get("/contratos/faturamento-previsto", { meses }).then(setD).catch((e) => setErro(e.message)); }, [meses]);
  const nomeMes = (a) => new Date(`${a}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
  const cel = { padding: "6px 8px", textAlign: "right", whiteSpace: "nowrap", borderTop: `1px solid ${C.border}`, fontSize: 12.5 };
  return <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
    <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Faturamento previsto" style={{ ...s.card, width: 960, maxWidth: "100%", padding: 20, marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>📈 Faturamento previsto — locação</div>
        <select value={meses} onChange={(e) => setMeses(Number(e.target.value))} style={{ ...s.input, width: "auto", marginBottom: 0 }}>{[3, 6, 12].map((n) => <option key={n} value={n}>{n} meses</option>)}</select>
        <button type="button" onClick={onFechar} aria-label="Fechar" style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ fontSize: 12, color: C.textSub, marginBottom: 12 }}>Soma do valor mensal de cada equipamento locado, proporcional aos dias do mês dentro do período (início → devolução ou término previsto). Sem término = conta até o fim da janela. Medição por hora/dia e mobilização não entram.</div>
      {erro ? <div style={{ color: C.danger }}>{erro}</div> : !d ? <div style={{ color: C.muted }}>Carregando…</div> : <>
        {d.equipamentos_sem_valor > 0 && <div style={{ fontSize: 12.5, color: C.warning || "#f59e0b", marginBottom: 8 }}>⚠ {d.equipamentos_sem_valor} equipamento(s) locado(s) sem valor mensal — não entram na previsão. Preencha no contrato.</div>}
        <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%", minWidth: 520 }}>
          <thead><tr><th style={{ ...cel, textAlign: "left", borderTop: "none", color: C.muted, fontSize: 11 }}>CONTRATO</th>{d.meses.map((m) => <th key={m} style={{ ...cel, borderTop: "none", color: C.muted, fontSize: 11 }}>{nomeMes(m).toUpperCase()}</th>)}</tr></thead>
          <tbody>
            {d.contratos.map((c) => <tr key={c.id}><td style={{ ...cel, textAlign: "left" }}><button type="button" onClick={() => onAbrirContrato?.(c.id)} style={{ background: "none", border: "none", padding: 0, color: C.accent, cursor: "pointer", font: "inherit", fontWeight: 600 }}>{c.cliente}</button><div style={{ fontSize: 11, color: C.muted }}>{c.numero}{c.fim_previsto ? ` · até ${dataBR(c.fim_previsto)}` : " · sem término"}{c.sem_valor ? ` · ⚠ ${c.sem_valor} sem valor` : ""}</div></td>
              {c.valores.map((v, i) => <td key={i} style={{ ...cel, color: v ? C.text : C.muted }}>{v ? brl(v) : "—"}</td>)}</tr>)}
            {d.contratos.length === 0 && <tr><td colSpan={d.meses.length + 1} style={{ ...cel, textAlign: "left", color: C.muted }}>Nenhum contrato ativo com valor mensal.</td></tr>}
            <tr><td style={{ ...cel, textAlign: "left", fontWeight: 700 }}>Total</td>{d.totais.map((v, i) => <td key={i} style={{ ...cel, fontWeight: 700, color: C.success || "#22c55e" }}>{brl(v)}</td>)}</tr>
          </tbody></table></div>
      </>}
    </div>
  </div>;
}
