// components/viagens/TelaMinhasViagens.jsx — etapa 17a: 🚛 MINHAS VIAGENS (motorista logado, perfil colaborador)
//   🚛 Agora     — as ATs dele em andamento/programadas: toque abre o FLUXO DA VIAGEM (o mesmo do 📲 link — etapas, inspeções, documentos)
//   🗂 Histórico — concluídas/canceladas dos últimos 90 dias (abre para consultar)
//   👥 Colegas   — só a AGENDA das viagens ativas dos outros motoristas (leitura: AT, rota, datas, motorista, conjunto e etapa)
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import TelaATPublica from "../../TelaATPublica";

const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const cidade = (e) => String(e || "—").split(",").slice(-2).join(",").replace(/CEP.*$/i, "").trim() || e;
const COR = { programada: "#3b82f6", em_execucao: "#f59e0b", concluida: "#22c55e", cancelada: "#ef4444" };

export default function TelaMinhasViagens({ C, s }) {
  const [d, setD] = useState(null); const [erro, setErro] = useState(null);
  const [aba, setAba] = useState("agora"); const [aberta, setAberta] = useState(null); const [busca, setBusca] = useState("");
  const carregar = () => apiService.get("/minhas-viagens").then((r) => { setD(r); setErro(null); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);
  if (aberta) return <div style={{ height: "100%", overflowY: "auto" }}><TelaATPublica tokenFixo={aberta} onVoltar={() => { setAberta(null); carregar(); }} /></div>;
  if (erro) return <div style={{ padding: 24, color: C.warn }}>{erro}</div>;
  if (!d) return <div style={{ padding: 24, color: C.muted }}>Carregando…</div>;
  const card = (e, onClick) => (
    <div key={e.id} className={onClick ? "qf-clicavel" : undefined} onClick={onClick} style={{ ...s.card, padding: "12px 14px", marginBottom: 10, cursor: onClick ? "pointer" : "default", borderLeft: `4px solid ${COR[e.status] || C.border}` }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <b style={{ fontSize: 15, flex: 1 }}>🚛 {e.numero}</b><span style={s.tag(COR[e.status] || C.muted)}>{e.status_nome}</span>
      </div>
      <div style={{ fontSize: 14, marginTop: 4 }}>{cidade(e.origem)} ➜ {cidade(e.destino)}</div>
      <div style={{ fontSize: 12.5, color: C.textSub, marginTop: 2 }}>🗓 {dataHora(e.inicio_previsto)}{e.cliente_nome ? ` · ${e.cliente_nome}` : ""}{e.motorista_nome ? ` · 👤 ${e.motorista_nome}` : ""}</div>
      {(e.conjunto || []).length > 0 && <div style={{ fontSize: 12.5, color: C.textSub }}>🚛 {e.conjunto.map((c) => (typeof c === "string" ? c : c.tag || c.nome)).join(" + ")}</div>}
      {e.fluxo_resumo && <div style={{ fontSize: 13, marginTop: 4, color: e.fluxo_resumo.travada ? C.danger : C.accent, fontWeight: 600 }}>{e.fluxo_resumo.travada ? `⛔ ${e.fluxo_resumo.reprovada} — aguarde a liberação` : e.fluxo_resumo.atual ? `🧭 ${e.fluxo_resumo.feitas}/${e.fluxo_resumo.total} · próxima: ${e.fluxo_resumo.atual}` : "✓ fluxo concluído"}</div>}
      {e.etapa && <div style={{ fontSize: 12.5, marginTop: 4, color: C.textSub }}>🧭 {e.progresso} · {e.etapa}</div>}
      {e.atrasada && <div style={{ fontSize: 12, color: C.danger }}>⏰ horário de coleta já passou</div>}
    </div>
  );
  const abaBt = (k, r, n) => <button key={k} type="button" onClick={() => setAba(k)} style={{ flex: 1, background: aba === k ? C.accent : "transparent", color: aba === k ? "#fff" : C.textSub, border: `1px solid ${aba === k ? C.accent : C.border}`, borderRadius: 8, padding: "9px 6px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{r}{n ? ` (${n})` : ""}</button>;
  const hist = d.historico.filter((e) => !busca.trim() || `${e.numero} ${e.ref} ${e.cliente_nome} ${e.origem} ${e.destino}`.toLowerCase().includes(busca.trim().toLowerCase()));
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "14px 14px 40px", color: C.text }}>
      <div style={{ fontSize: 13, color: C.textSub, marginBottom: 10 }}>Olá, <b style={{ color: C.text }}>{d.eu.nome}</b>. Toque numa viagem para seguir o fluxo, ver a rota e os documentos.</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>{abaBt("agora", "🚛 Minhas", d.ativas.length)}{abaBt("hist", "🗂 Histórico")}{abaBt("colegas", "👥 Colegas", d.colegas.length)}</div>
      {aba === "agora" && (d.ativas.length ? d.ativas.map((e) => card(e, () => setAberta(e.token))) : <div style={{ ...s.card, padding: 20, textAlign: "center", color: C.muted }}>Nenhuma viagem programada para você agora.</div>)}
      {aba === "hist" && <>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar AT, cliente, cidade…" style={{ ...s.input, marginBottom: 10 }} />
        {hist.length ? hist.map((e) => card(e, () => setAberta(e.token))) : <div style={{ ...s.card, padding: 20, textAlign: "center", color: C.muted }}>Nada nos últimos 90 dias.</div>}
        <div style={{ fontSize: 11.5, color: C.muted }}>Mostra os últimos 90 dias. Viagens mais antigas: fale com a programação.</div>
      </>}
      {aba === "colegas" && <>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Agenda das viagens em andamento dos colegas — só para consulta.</div>
        {d.colegas.length ? d.colegas.map((e) => card(e, null)) : <div style={{ ...s.card, padding: 20, textAlign: "center", color: C.muted }}>Nenhum colega em viagem agora.</div>}
      </>}
    </div>
  );
}
