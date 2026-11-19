// components/beta/ModoConversa.jsx — etapa B5.1: 🚗 modo Conversa da Beta (gestor/admin, mãos livres para quem está dirigindo)
//   Abre, cumprimenta pelo nome e fica escutando: pergunta → resposta falada → volta a escutar. "Obrigada, Beta" / "tchau" encerra.
//   Respostas longas: fala o começo e oferece continuar. Ações: a Beta repete o pedido e só faz com "sim/confirma" falado.
//   Bloqueado (erro legal) ou não entendeu → vira tarefa para a pessoa ver quando parar. Fora do QuotaFlow: recusa com gentileza.
//   Voz paga (neural) se a empresa tiver no plano; se falhar ou acabar o teto, segue com a voz do navegador.
import { useEffect, useRef, useState } from "react";
import apiService from "../../services/apiService";
import * as V from "./vozBeta";

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const SIM = /^(sim|pode|isso|confirma|confirmo|confirmado|ok|okay|certo|manda|faz|fechado|positivo|exato|pode sim|sim pode|pode fazer|isso mesmo)\b/;
const NAO = /^(nao|cancela|cancelar|deixa|esquece|negativo|para|pare)\b/;
const FIM = /\b(obrigad[oa],? beta|tchau|ate mais|ate logo|encerrar|encerra|pode parar|so isso|era so isso|desligar|sair)\b/;
const MAIS = /^(sim|continua|continue|pode continuar|detalha|detalhe|fala mais|quero|mais|pode)\b/;
const limpa = (t) => V.paraFala(String(t || "").replace(/\n+/g, ". ").replace(/\.\s*\./g, "."));
function partir(texto) { // começo curto para falar + resto (se houver)
  const t = limpa(texto); if (t.length <= 320) return [t, ""];
  const ps = t.split(/(?<=[.!?])\s+/); let a = ""; let i = 0; while (i < ps.length && (a + " " + ps[i]).length <= 320) { a = `${a} ${ps[i]}`.trim(); i++; }
  if (!a) { a = t.slice(0, 300); return [a, t.slice(300)]; } return [a, ps.slice(i).join(" ")];
}

export default function ModoConversa({ C, voz, onFechar }) {
  const [estado, setEstado] = useState("saudando"); const [ultimo, setUltimo] = useState({ eu: "", beta: "" }); const [pausado, setPausado] = useState(false);
  const modo = useRef(voz?.conversa && voz.conversa !== "desligado" ? "neural" : "navegador"); const hist = useRef([]); const mic = useRef(null); const vivo = useRef(true);
  const pend = useRef(null); const mais = useRef(""); const wake = useRef(null);
  const primeiro = String(voz?.nome || "").split(" ")[0];

  const [diag, setDiag] = useState("");
  const dizer = async (t) => { if (!vivo.current) return; setUltimo((u) => ({ ...u, beta: t })); setEstado("falando"); await V.falarE(modo.current, t); setDiag(V.diag.voz === "neural" ? "🔈 voz neural" : V.diag.erro ? `🔈 voz do aparelho — ${V.diag.erro}` : ""); };
  const escutar = () => {
    if (!vivo.current) return; setPausado(false);
    mic.current = V.ouvirConversa(modo.current, {
      aoEstado: (e) => vivo.current && setEstado(e || "pensando"),
      aoTexto: (t) => tratar(t),
      aoErro: async (m) => { await dizer(m); escutar(); },
      aoReserva: async () => { modo.current = "navegador"; await dizer("Vou continuar com a voz do aparelho. Pode repetir?"); escutar(); },
      aoSilencio: () => { if (vivo.current) { setEstado("pausado"); setPausado(true); } },
    });
  };
  const fechar = () => { vivo.current = false; mic.current?.parar(); V.pararFala(); V.fecharMicrofone(); try { wake.current?.release(); } catch { /* ok */ } onFechar(); };

  async function tratar(texto) {
    const t = String(texto).trim(); const n = norm(t); setUltimo({ eu: t, beta: "" });
    if (FIM.test(n)) { await dizer(`Até mais${primeiro ? `, ${primeiro}` : ""}! Boa viagem.`); fechar(); return; }
    if (pend.current) { // ação esperando o sim/não
      const p = pend.current;
      if (SIM.test(n)) { pend.current = null; setEstado("pensando");
        try { const r = await apiService.post("/beta/confirmar", { token: p.token }); await dizer(limpa(r.texto) || "Feito."); }
        catch (e) { await dizer(`Não consegui fazer: ${limpa(e?.response?.data?.erro || "erro")}. Vou deixar uma tarefa para você.`); await lembrete(p.pedido, e?.response?.data?.erro); }
        return escutar(); }
      if (NAO.test(n)) { pend.current = null; await dizer("Tudo bem, não fiz nada."); return escutar(); }
      await dizer("Diga sim para eu fazer, ou não para cancelar."); return escutar();
    }
    if (mais.current && MAIS.test(n)) { const [a, b] = partir(mais.current); mais.current = b; await dizer(b ? `${a} Quer que eu continue?` : a); return escutar(); }
    mais.current = "";
    hist.current = [...hist.current, { de: "pessoa", texto: t }].slice(-6); setEstado("pensando");
    let r; try { r = await apiService.post("/beta", { modo: "conversa", mensagens: hist.current.map(({ de, texto: x, assunto }) => ({ de, texto: x, assunto: assunto || undefined })) }); }
    catch (e) { await dizer(limpa(e?.response?.data?.erro) || "Não consegui responder agora. Tente de novo em instantes."); return escutar(); }
    hist.current = [...hist.current, { de: "beta", texto: r.texto, assunto: r.assunto }].slice(-6);
    if (r.proposta) {
      const pr = r.proposta; const resumo = pr.resumo.map(limpa).join(". ");
      if (pr.bloqueia || !pr.token) { const motivo = pr.avisos.map(limpa).join(". "); await dizer(`Não dá para fazer isso agora. ${motivo}`); await lembrete(t, motivo); return escutar(); }
      pend.current = { token: pr.token, pedido: t }; const av = pr.avisos.length ? ` Atenção: ${pr.avisos.map(limpa).join(". ")}.` : "";
      await dizer(`${resumo}.${av} Confirma?`); return escutar();
    }
    if (r.aprendendo) { await dizer("Isso eu ainda não sei responder. Eu cuido só do seu negócio aqui no QuotaFlow. Anotei para aprender. Quer perguntar outra coisa?"); return escutar(); }
    const [a, b] = partir(r.texto); mais.current = b; await dizer(b ? `${a} Quer que eu continue?` : a); escutar();
  }
  async function lembrete(pedido, motivo) {
    try { const r = await apiService.post("/beta/lembrete", { texto: pedido, motivo: motivo || "" }); await dizer(limpa(r.texto)); }
    catch { await dizer("Não consegui anotar agora. Lembre de ver isso quando parar."); }
  }

  useEffect(() => {
    (async () => { try { wake.current = await navigator.wakeLock?.request("screen"); } catch { /* ok */ }
      await dizer(`Oi${primeiro ? `, ${primeiro}` : ""}! Em que posso te ajudar?`); escutar(); })();
    return () => { vivo.current = false; mic.current?.parar(); V.pararFala(); V.fecharMicrofone(); try { wake.current?.release(); } catch { /* ok */ } };
  }, []); // eslint-disable-line

  const cor = { ouvindo: "#22c55e", entendendo: "#a78bfa", pensando: "#a78bfa", falando: C.accent, saudando: C.accent, pausado: "#64748b" }[estado] || "#64748b";
  const rot = { ouvindo: "Pode falar…", entendendo: "Entendendo…", pensando: "Pensando…", falando: "Beta falando — toque para interromper", saudando: "Beta falando…", pausado: "Pausado — toque para falar" }[estado] || "";
  const tocar = () => { V.desbloquearAudio(); if (estado === "falando" || estado === "saudando") { V.pararFala(); return; } if (pausado || estado === "pausado") escutar(); };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#05070b", color: "#e2e8f0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "max(24px, env(safe-area-inset-top)) 20px max(24px, env(safe-area-inset-bottom))" }}>
      <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 560 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>🚗 Beta · modo Conversa</div>
        <button type="button" onClick={fechar} style={{ background: "#1e2535", color: "#e2e8f0", border: "none", borderRadius: 20, padding: "10px 18px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Encerrar</button>
      </div>
      <button type="button" onClick={tocar} aria-label={rot}
        style={{ width: "min(62vw, 280px)", height: "min(62vw, 280px)", borderRadius: "50%", border: "none", cursor: "pointer", background: `radial-gradient(circle at 35% 30%, ${cor}, ${cor}55 60%, ${cor}22)`, boxShadow: `0 0 0 ${estado === "ouvindo" ? 18 : 6}px ${cor}22, 0 0 80px ${cor}55`, transition: "all .3s", fontSize: 64, color: "#fff", animation: estado === "ouvindo" ? "qfRespira 1.6s ease-in-out infinite" : estado === "falando" ? "qfRespira 0.9s ease-in-out infinite" : "none" }}>
        {estado === "ouvindo" ? "🎤" : estado === "falando" || estado === "saudando" ? "👋" : estado === "pausado" ? "▶" : "…"}
      </button>
      <div style={{ width: "100%", maxWidth: 560, textAlign: "center", minHeight: 150 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: cor, marginBottom: 12 }}>{rot}</div>
        {ultimo.eu && <div style={{ fontSize: 15, color: "#94a3b8", marginBottom: 8 }}>"{ultimo.eu}"</div>}
        {ultimo.beta && <div style={{ fontSize: 17, lineHeight: 1.45 }}>{ultimo.beta}</div>}
        {diag && <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 10 }}>{diag}</div>}
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 14 }}>Diga "obrigada, Beta" para encerrar · ações só com o seu "sim"</div>
      </div>
      <style>{"@keyframes qfRespira{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}"}</style>
    </div>
  );
}
