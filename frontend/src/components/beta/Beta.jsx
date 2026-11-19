// components/beta/Beta.jsx — etapa B1: 👋 BETA — assistente do QuotaFlow por texto (só consulta)
//   Botão flutuante no canto; abre a conversa. A conversa vive só nesta aba (não é guardada).
//   Respostas com o selo "✓ números conferidos" ou o aviso do que não foi confirmado nos dados.
// B4: 🎤 falar (navegador ou voz neural do servidor) e 🔊 ouvir as respostas — gestor/admin; o fornecedor nunca aparece
// B1.5: ⚡ consultas rápidas (CNH, férias, carreta livre, AT, tarefas, contrato, cotação, BID, peça) — resposta direto do sistema
//   (selo "⚡ direto do sistema") + botão "Abrir →" para a tela. Sugestões vêm do servidor conforme o perfil.
import { useEffect, useRef, useState } from "react";
import BotoesContato from "../shared/BotoesContato"; // B1.10
import apiService from "../../services/apiService";
import * as V from "./vozBeta"; // B4: 🎤🔊 voz


export default function Beta({ C, s, podeAbrir = () => true }) {
  const [aberta, setAberta] = useState(false); const [msgs, setMsgs] = useState([]); const [txt, setTxt] = useState(""); const [ocup, setOcup] = useState(false); const [rest, setRest] = useState(null);
  const fim = useRef(null); const [sug, setSug] = useState([]);
  // B4: voz (gestor/admin). modo = navegador | neural; fala = ler as respostas em voz alta (preferência do aparelho)
  const [voz, setVoz] = useState(null); const [fala, setFala] = useState(V.lerPref()); const [ouvindo, setOuvindo] = useState(null); const mic = useRef(null);
  useEffect(() => { if (aberta && !voz) apiService.get("/beta/voz").then((r) => setVoz(r)).catch(() => setVoz({ permitido: false })); if (!aberta) { V.pararFala(); mic.current?.parar(); } }, [aberta]); // eslint-disable-line
  // B5.0: no chat a voz é SEMPRE a do navegador (custo zero); 🎤 e 🔊 obedecem aos interruptores da empresa (Console). A voz paga fica só no modo Conversa.
  const modoVoz = "navegador";
  const temMic = !!(voz?.permitido && voz?.chat_mic !== false && V.podeOuvirNavegador);
  const temFala = !!(voz?.permitido && voz?.chat_fala === true && V.podeFalarNavegador);
  const falarResposta = (texto, proposta) => { if (!temFala || !fala) return; const extra = proposta ? (proposta.bloqueia ? " Não dá para fazer assim; veja o motivo no cartão." : ` ${proposta.resumo.join(". ")}. Toque em confirmar se estiver certo.`) : ""; V.falar(modoVoz, texto + extra); };
  const tocarMic = () => {
    if (ouvindo === "ouvindo") { mic.current?.parar(); return; } if (ouvindo) return;
    mic.current = V.ouvir(modoVoz, { aoEstado: setOuvindo, aoTexto: (t) => enviar(t), aoErro: (m) => setMsgs((l) => [...l, { de: "beta", texto: m, erro: true }]) });
  };
  useEffect(() => { if (aberta && !sug.length) apiService.get("/beta/consultas").then((r) => setSug(r.sugestoes || [])).catch(() => {}); }, [aberta]); // eslint-disable-line
  const ir = (l) => { if (!l?.tela) return; if (l.tela === "pessoas") { if (l.aba) window.qfPessoasAba = l.aba; if (l.colaborador) window.qfAbrirColab = l.colaborador; } window.dispatchEvent(new CustomEvent("qf-navegar", { detail: { tela: l.tela } })); };
  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, ocup]);
  const enviar = async (pergunta) => {
    const p = String(pergunta ?? txt).trim(); if (!p || ocup) return;
    const nova = [...msgs, { de: "pessoa", texto: p }]; setMsgs(nova); setTxt(""); setOcup(true);
    try { const r = await apiService.post("/beta", { mensagens: nova.map(({ de, texto, assunto }) => ({ de, texto, assunto: assunto || undefined })) }); falarResposta(r.texto, r.proposta); setMsgs([...nova, { de: "beta", texto: r.texto, conferido: r.conferido, suspeitos: r.suspeitos, direto: r.direto, link: r.link, acoes: r.acoes, aprendendo: r.aprendendo, assunto: r.assunto, proposta: r.proposta || null }]); setRest(r.restantes); }
    catch (e) { const d = e?.response?.data; setMsgs([...nova, { de: "beta", texto: d?.erro || "Não consegui responder agora. Tente de novo em instantes.", erro: true }]); if (d?.restantes != null) setRest(d.restantes); }
    finally { setOcup(false); }
  };
  // B3: ✓ confirmar / ✕ cancelar a ação proposta
  const decidir = async (i, ok) => {
    const m = msgs[i]; if (!m?.proposta || m.decidida) return;
    setMsgs((l) => l.map((x, k) => (k === i ? { ...x, decidida: ok ? "confirmando" : "cancelada" } : x)));
    if (!ok) { setMsgs((l) => [...l, { de: "beta", texto: "Tudo bem, não fiz nada. 👍", direto: true }]); return; }
    try { const r = await apiService.post("/beta/confirmar", { token: m.proposta.token }); setMsgs((l) => [...l.map((x, k) => (k === i ? { ...x, decidida: "feita" } : x)), { de: "beta", texto: r.texto, link: r.link, direto: true, feito: true }]); if (fala && temFala) V.falar(modoVoz, r.texto); }
    catch (e) { setMsgs((l) => [...l.map((x, k) => (k === i ? { ...x, decidida: null } : x)), { de: "beta", texto: e?.response?.data?.erro || "Não consegui fazer agora. Tente pela tela.", erro: true }]); }
  };
  if (!aberta) return (
    <button type="button" onClick={() => setAberta(true)} title="Converse com a Beta, a assistente do QuotaFlow"
      style={{ position: "fixed", right: 22, bottom: 22, zIndex: 150, background: `linear-gradient(135deg, ${C.accent}, #8b5cf6)`, color: "#fff", border: "none", borderRadius: 28, padding: "12px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,.4)" }}>👋 Beta</button>);
  return (
    <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 150, width: "min(400px, calc(100vw - 36px))", height: "min(560px, calc(100vh - 36px))", display: "flex", flexDirection: "column", ...s.card, padding: 0, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,.5)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: `linear-gradient(135deg, ${C.accent}33, #8b5cf633)`, borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 22 }}>👋</span>
        <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>Beta</div><div style={{ fontSize: 11.5, color: C.textSub }}>assistente do QuotaFlow · consulta os dados da sua empresa</div></div>
        {temFala && <button type="button" onClick={() => { const v = !fala; setFala(v); V.gravarPref(v); if (!v) V.pararFala(); }} title={fala ? "Beta fala as respostas — toque para silenciar" : "Ouvir as respostas da Beta"} aria-label="Voz das respostas" style={{ background: "none", border: "none", fontSize: 17, cursor: "pointer", opacity: fala ? 1 : 0.55 }}>{fala ? "🔊" : "🔇"}</button>}
        <button type="button" onClick={() => setAberta(false)} aria-label="Fechar" style={{ background: "none", border: "none", color: C.textSub, fontSize: 20, cursor: "pointer" }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {msgs.length === 0 && <div>
          <div style={{ fontSize: 13.5, color: C.text, marginBottom: 10 }}>Oi! Eu sou a Beta. Pergunte do seu jeito — vencimento de CNH, quem está de férias, se a carreta está livre, quem falta responder a cotação… Eu olho os dados e respondo. Também posso criar tarefas, lançar férias, registrar faltas e avisar a equipe — sempre com o seu ✓ antes.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{sug.map((x) => <button key={x} type="button" onClick={() => enviar(x)} style={{ textAlign: "left", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", color: C.text, fontSize: 13, cursor: "pointer" }}>{x}</button>)}</div>
        </div>}
        {msgs.map((m, i) => <div key={i} style={{ alignSelf: m.de === "pessoa" ? "flex-end" : "flex-start", maxWidth: "88%" }}>
          <div style={{ background: m.de === "pessoa" ? C.accent : m.erro ? "#7f1d1d55" : C.bg, color: m.de === "pessoa" ? "#fff" : C.text, border: m.de === "pessoa" ? "none" : `1px solid ${C.border}`, borderRadius: 12, padding: "8px 12px", fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.texto}</div>
          {m.de === "beta" && m.proposta && <div style={{ marginTop: 6, border: `1px solid ${m.proposta.bloqueia ? C.danger : C.accent}`, borderRadius: 10, padding: "10px 12px", background: `${m.proposta.bloqueia ? C.danger : C.accent}12` }}>
            {m.proposta.resumo.map((l, k) => <div key={k} style={{ fontSize: 13, fontWeight: k === 0 ? 700 : 400, marginTop: k ? 2 : 0 }}>{l}</div>)}
            {m.proposta.avisos.map((l, k) => <div key={`a${k}`} style={{ fontSize: 12, color: /^❌/.test(l) ? C.danger : C.warn, marginTop: 4 }}>{l}</div>)}
            {!m.proposta.bloqueia && !m.decidida && <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" onClick={() => decidir(i, true)} style={{ ...s.btn(true), cursor: "pointer", flex: 1 }}>✓ Confirmar</button>
              <button type="button" onClick={() => decidir(i, false)} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>Cancelar</button></div>}
            {m.decidida && <div style={{ fontSize: 11.5, color: C.textSub, marginTop: 6 }}>{{ confirmando: "fazendo…", feita: "✓ confirmado", cancelada: "✕ cancelado" }[m.decidida]}</div>}
          </div>}
          {m.de === "beta" && (m.acoes || []).map((a, k) => <div key={k} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>{m.acoes.length > 1 && <span style={{ fontSize: 11.5, color: C.textSub }}>{a.rotulo}:</span>}<BotoesContato C={C} telefone={a.telefone} email={a.email} tamanho={11.5} /></div>)}
          {m.de === "beta" && m.link?.tela && podeAbrir(m.link.tela) && <button type="button" onClick={() => ir(m.link)} style={{ background: "none", border: "none", color: C.accent, fontSize: 12, cursor: "pointer", padding: "4px 2px 0", fontFamily: "inherit" }}>Abrir no sistema →</button>}
          {m.de === "beta" && m.aprendendo && <div style={{ fontSize: 10.5, color: "#a78bfa", marginTop: 3 }}>📮 encaminhada aos especialistas · não contou no seu limite</div>}{m.de === "beta" && m.direto && !m.aprendendo && !m.erro && <div style={{ fontSize: 10.5, color: "#4ade80", marginTop: 3 }}>⚡ direto do sistema</div>}
          {m.de === "beta" && !m.direto && m.conferido === true && /\d/.test(m.texto || "") && <div style={{ fontSize: 10.5, color: "#4ade80", marginTop: 3 }}>✓ números conferidos com os dados</div>}
          {m.de === "beta" && m.conferido === false && <div style={{ fontSize: 10.5, color: C.warn, marginTop: 3 }}>⚠ não confirmado nos dados: {(m.suspeitos || []).join(", ")} — confira na tela</div>}
        </div>)}
        {ocup && <div style={{ alignSelf: "flex-start", fontSize: 13, color: C.muted }}>Beta está olhando os dados…</div>}
        <div ref={fim} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); enviar(); }} style={{ display: "flex", gap: 8, padding: 10, borderTop: `1px solid ${C.border}` }}>
        {temMic && <button type="button" onClick={tocarMic} disabled={ocup || ouvindo === "entendendo"} title={ouvindo === "ouvindo" ? "Toque para parar" : "Falar com a Beta"} aria-label="Falar"
          style={{ ...s.btn(ouvindo === "ouvindo"), padding: "0 12px", cursor: "pointer", fontSize: 16, background: ouvindo === "ouvindo" ? "#dc2626" : undefined, color: ouvindo === "ouvindo" ? "#fff" : C.text, animation: ouvindo === "ouvindo" ? "qfPulso 1.2s infinite" : "none" }}>{ouvindo === "entendendo" ? "…" : "🎤"}</button>}
        <input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={ouvindo === "ouvindo" ? "Pode falar…" : ouvindo === "entendendo" ? "Entendendo…" : "Pergunte à Beta…"} disabled={ocup} maxLength={800} style={{ ...s.input, flex: 1 }} />
        <button type="submit" disabled={ocup || !txt.trim()} style={{ ...s.btn(true), padding: "0 14px", cursor: "pointer" }}>➤</button>
      </form>
      <style>{"@keyframes qfPulso{0%,100%{box-shadow:0 0 0 0 #dc262699}50%{box-shadow:0 0 0 6px #dc262600}}"}</style>
      {rest != null && <div style={{ fontSize: 10.5, color: C.muted, textAlign: "center", paddingBottom: 6 }}>{rest} pergunta(s) restante(s) hoje</div>}
    </div>
  );
}
