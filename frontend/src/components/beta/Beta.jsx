// components/beta/Beta.jsx — etapa B1: 👋 BETA — assistente do QuotaFlow por texto (só consulta)
//   Botão flutuante no canto; abre a conversa. A conversa vive só nesta aba (não é guardada).
//   Respostas com o selo "✓ números conferidos" ou o aviso do que não foi confirmado nos dados.
import { useEffect, useRef, useState } from "react";
import apiService from "../../services/apiService";

const SUGESTOES = ["Como está minha empresa hoje?", "Quais as prioridades de hoje?", "Quais metas estão fora do alvo?", "Quanto o sistema já economizou este ano?"];

export default function Beta({ C, s }) {
  const [aberta, setAberta] = useState(false); const [msgs, setMsgs] = useState([]); const [txt, setTxt] = useState(""); const [ocup, setOcup] = useState(false); const [rest, setRest] = useState(null);
  const fim = useRef(null);
  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, ocup]);
  const enviar = async (pergunta) => {
    const p = String(pergunta ?? txt).trim(); if (!p || ocup) return;
    const nova = [...msgs, { de: "pessoa", texto: p }]; setMsgs(nova); setTxt(""); setOcup(true);
    try { const r = await apiService.post("/beta", { mensagens: nova.map(({ de, texto }) => ({ de, texto })) }); setMsgs([...nova, { de: "beta", texto: r.texto, conferido: r.conferido, suspeitos: r.suspeitos }]); setRest(r.restantes); }
    catch (e) { const d = e?.response?.data; setMsgs([...nova, { de: "beta", texto: d?.erro || "Não consegui responder agora. Tente de novo em instantes.", erro: true }]); if (d?.restantes != null) setRest(d.restantes); }
    finally { setOcup(false); }
  };
  if (!aberta) return (
    <button type="button" onClick={() => setAberta(true)} title="Converse com a Beta, a assistente do QuotaFlow"
      style={{ position: "fixed", right: 22, bottom: 22, zIndex: 150, background: `linear-gradient(135deg, ${C.accent}, #8b5cf6)`, color: "#fff", border: "none", borderRadius: 28, padding: "12px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,.4)" }}>👋 Beta</button>);
  return (
    <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 150, width: "min(400px, calc(100vw - 36px))", height: "min(560px, calc(100vh - 36px))", display: "flex", flexDirection: "column", ...s.card, padding: 0, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,.5)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: `linear-gradient(135deg, ${C.accent}33, #8b5cf633)`, borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 22 }}>👋</span>
        <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>Beta</div><div style={{ fontSize: 11.5, color: C.textSub }}>assistente do QuotaFlow · consulta os dados da sua empresa</div></div>
        <button type="button" onClick={() => setAberta(false)} aria-label="Fechar" style={{ background: "none", border: "none", color: C.textSub, fontSize: 20, cursor: "pointer" }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {msgs.length === 0 && <div>
          <div style={{ fontSize: 13.5, color: C.text, marginBottom: 10 }}>Oi! Eu sou a Beta. Pergunte sobre a sua empresa — eu olho os dados e respondo. Por enquanto eu só consulto: não crio nem altero nada.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{SUGESTOES.map((x) => <button key={x} type="button" onClick={() => enviar(x)} style={{ textAlign: "left", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", color: C.text, fontSize: 13, cursor: "pointer" }}>{x}</button>)}</div>
        </div>}
        {msgs.map((m, i) => <div key={i} style={{ alignSelf: m.de === "pessoa" ? "flex-end" : "flex-start", maxWidth: "88%" }}>
          <div style={{ background: m.de === "pessoa" ? C.accent : m.erro ? "#7f1d1d55" : C.bg, color: m.de === "pessoa" ? "#fff" : C.text, border: m.de === "pessoa" ? "none" : `1px solid ${C.border}`, borderRadius: 12, padding: "8px 12px", fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.texto}</div>
          {m.de === "beta" && m.conferido === true && <div style={{ fontSize: 10.5, color: "#4ade80", marginTop: 3 }}>✓ números conferidos com os dados</div>}
          {m.de === "beta" && m.conferido === false && <div style={{ fontSize: 10.5, color: C.warn, marginTop: 3 }}>⚠ não confirmado nos dados: {(m.suspeitos || []).join(", ")} — confira na tela</div>}
        </div>)}
        {ocup && <div style={{ alignSelf: "flex-start", fontSize: 13, color: C.muted }}>Beta está olhando os dados…</div>}
        <div ref={fim} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); enviar(); }} style={{ display: "flex", gap: 8, padding: 10, borderTop: `1px solid ${C.border}` }}>
        <input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Pergunte à Beta…" disabled={ocup} maxLength={800} style={{ ...s.input, flex: 1 }} />
        <button type="submit" disabled={ocup || !txt.trim()} style={{ ...s.btn(true), padding: "0 14px", cursor: "pointer" }}>➤</button>
      </form>
      {rest != null && <div style={{ fontSize: 10.5, color: C.muted, textAlign: "center", paddingBottom: 6 }}>{rest} pergunta(s) restante(s) hoje</div>}
    </div>
  );
}
