// plataforma/BetaPendentes.jsx — etapa B2.0: 👋 perguntas que a Beta ainda não sabe (todas as empresas) — só o admin da plataforma
//   Lista corrida: empresa · quem · perfil · quando · pergunta. Marque "atendida" (com aviso a quem perguntou) ou "descartada".
import { useEffect, useState } from "react";
const dh = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

export default function BetaPendentes({ token, chamar, C, card, btn, tag, onAviso }) {
  const [status, setStatus] = useState("pendente"); const [d, setD] = useState(null); const [busca, setBusca] = useState("");
  const carregar = () => chamar(token, "GET", `/beta-pendentes?status=${status}`).then(setD).catch((e) => onAviso({ tipo: "erro", texto: e.message }));
  useEffect(() => { setD(null); carregar(); }, [status]); // eslint-disable-line
  const marcar = async (p, st, avisar = false) => { try { await chamar(token, "PUT", `/beta-pendentes/${p.id}`, { status: st, avisar }); onAviso({ tipo: "ok", texto: st === "atendida" ? (avisar ? "Atendida — quem perguntou foi avisado." : "Marcada como atendida.") : st === "descartada" ? "Descartada." : "Voltou para pendente." }); carregar(); } catch (e) { onAviso({ tipo: "erro", texto: e.message }); } };
  const t = d?.totais || {}; const q = busca.trim().toLowerCase();
  const itens = (d?.itens || []).filter((p) => !q || `${p.pergunta} ${p.empresa} ${p.usuario_nome}`.toLowerCase().includes(q));
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>👋 Beta — perguntas que ela ainda não sabe</div>
      <div style={{ fontSize: 13, color: C.sub, marginBottom: 14 }}>O cliente recebeu "ainda estou aprendendo" (sem gastar IA). Use a lista para decidir as próximas consultas — guia no readme (👋 Beta → como incluir uma consulta).</div>
      {d?.aviso && <div style={{ ...card, padding: 12, color: C.warn, marginBottom: 12 }}>{d.aviso}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {[["pendente", `Pendentes (${t.pendente ?? "…"})`], ["atendida", `Atendidas (${t.atendida ?? "…"})`], ["descartada", `Descartadas (${t.descartada ?? "…"})`], ["todas", "Todas"]].map(([k, l]) => <button key={k} onClick={() => setStatus(k)} style={{ ...btn(C.accent, status === k), cursor: "pointer" }}>{l}</button>)}
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 filtrar por texto, empresa ou pessoa" style={{ flex: "1 1 240px", padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.text }} />
      </div>
      {!d ? <div style={{ color: C.sub }}>Carregando…</div> : !itens.length ? <div style={{ ...card, padding: 16, color: C.sub }}>Nada por aqui. 🎉</div> : (
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          {itens.map((p, i) => (
            <div key={p.id} style={{ padding: "12px 16px", borderTop: i ? `1px solid ${C.border}` : "none", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ flex: "1 1 340px", minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>"{p.pergunta}"</div>
                <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>{p.empresa} · {p.usuario_nome || "—"}{p.perfis ? ` (${p.perfis})` : ""} · {dh(p.criado_em)}{p.resolvido_em ? ` · resolvida ${dh(p.resolvido_em)}` : ""}</div>
                {Array.isArray(p.conversa) && p.conversa.length > 1 && <details style={{ marginTop: 4 }}><summary style={{ fontSize: 11.5, color: C.sub, cursor: "pointer" }}>conversa</summary>{p.conversa.map((m, k) => <div key={k} style={{ fontSize: 12, color: m.de === "beta" ? C.sub : C.text, marginTop: 2 }}>{m.de === "beta" ? "Beta" : "Pessoa"}: {m.texto}</div>)}</details>}
              </div>
              <span style={tag(p.status === "pendente" ? C.warn : p.status === "atendida" ? "#22c55e" : C.sub)}>{p.status}</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {p.status !== "atendida" && <button onClick={() => marcar(p, "atendida", true)} style={{ ...btn(C.success), cursor: "pointer", fontSize: 12 }} title="Avisa quem perguntou: 'A Beta aprendeu!'">✓ Atendida + avisar</button>}
                {p.status === "pendente" && <button onClick={() => marcar(p, "descartada")} style={{ ...btn(C.muted, false), cursor: "pointer", fontSize: 12 }}>Descartar</button>}
                {p.status !== "pendente" && <button onClick={() => marcar(p, "pendente")} style={{ ...btn(C.muted, false), cursor: "pointer", fontSize: 12 }}>Reabrir</button>}
              </div>
            </div>))}
        </div>)}
    </div>
  );
}
