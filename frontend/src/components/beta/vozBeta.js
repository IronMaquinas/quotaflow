// components/beta/vozBeta.js — etapa B4: 🎤🔊 voz da Beta. Modo "navegador" (reconhecimento e fala do próprio navegador)
//   ou "neural" (servidor). Se o neural falhar ou acabar o limite do dia, cai para o navegador sem a pessoa perceber.
import apiService from "../../services/apiService";

const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const podeOuvirNavegador = !!SR;
export const podeGravar = typeof window !== "undefined" && !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
export const podeFalarNavegador = typeof window !== "undefined" && "speechSynthesis" in window;

export const lerPref = () => { try { return localStorage.getItem("qfBetaFala") === "1"; } catch { return false; } };
export const gravarPref = (v) => { try { localStorage.setItem("qfBetaFala", v ? "1" : "0"); } catch { /* sem storage */ } };

export const paraFala = (t) => String(t || "").replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, "").replace(/[→•*_#]/g, " ").replace(/\s+/g, " ").trim();

// voz feminina pt-BR do aparelho, se houver
function vozNavegador() {
  const vs = window.speechSynthesis.getVoices().filter((v) => /^pt(-|_)?BR/i.test(v.lang) || /^pt/i.test(v.lang));
  return vs.find((v) => /luciana|francisca|thalita|maria|female|feminin|google português/i.test(v.name)) || vs.find((v) => /BR/i.test(v.lang)) || vs[0] || null;
}
let audioAtual = null;
export function pararFala() { try { window.speechSynthesis?.cancel(); } catch { /* ok */ } if (audioAtual) { audioAtual.pause(); audioAtual = null; } }
function falarNavegador(texto, aoFim) {
  if (!podeFalarNavegador) return aoFim?.();
  const u = new SpeechSynthesisUtterance(paraFala(texto)); u.lang = "pt-BR"; u.rate = 1.05; u.pitch = 1.1; const v = vozNavegador(); if (v) u.voice = v;
  u.onend = () => aoFim?.(); u.onerror = () => aoFim?.(); window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
}
export async function falar(modo, texto, aoFim) {
  pararFala(); const t = paraFala(texto); if (!t) return aoFim?.();
  if (modo === "neural") {
    try { const r = await apiService.post("/beta/voz/falar", { texto: t }); const a = new Audio(`data:${r.tipo || "audio/mpeg"};base64,${r.audio}`); audioAtual = a; a.onended = () => { audioAtual = null; aoFim?.(); }; await a.play(); return; }
    catch { /* reserva: navegador */ }
  }
  falarNavegador(t, aoFim);
}

/** começa a ouvir; devolve { parar() }. aoTexto(texto) quando entender; aoEstado("ouvindo"|"entendendo"|null); aoErro(msg) */
export function ouvir(modo, { aoTexto, aoEstado, aoErro }) {
  pararFala();
  if (modo === "neural" && podeGravar) return gravarNeural({ aoTexto, aoEstado, aoErro });
  return ouvirNavegador({ aoTexto, aoEstado, aoErro });
}
function ouvirNavegador({ aoTexto, aoEstado, aoErro }) {
  if (!SR) { aoErro?.("Este navegador não reconhece fala. Use Chrome, Edge ou Safari."); return { parar() {} }; }
  const r = new SR(); r.lang = "pt-BR"; r.interimResults = false; r.maxAlternatives = 1; r.continuous = false; let ok = false;
  r.onresult = (e) => { ok = true; const t = Array.from(e.results).map((x) => x[0].transcript).join(" ").trim(); if (t) aoTexto?.(t); };
  r.onerror = (e) => { if (e.error === "not-allowed") aoErro?.("Libere o microfone para o QuotaFlow no navegador."); else if (e.error !== "aborted" && e.error !== "no-speech") aoErro?.("Não entendi. Tente de novo."); };
  r.onend = () => { aoEstado?.(null); if (!ok) { /* silêncio: só fecha */ } };
  try { r.start(); aoEstado?.("ouvindo"); } catch { aoErro?.("Não consegui abrir o microfone."); }
  return { parar() { try { r.stop(); } catch { /* ok */ } } };
}
function gravarNeural({ aoTexto, aoEstado, aoErro }) {
  let rec = null; let stream = null; let parado = false; const partes = []; let silencio = null;
  const fim = () => { clearTimeout(silencio); try { if (rec?.state === "recording") rec.stop(); } catch { /* ok */ } };
  navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
    stream = s; if (parado) { s.getTracks().forEach((t) => t.stop()); return; }
    const tipo = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((x) => window.MediaRecorder.isTypeSupported?.(x)) || "";
    rec = new MediaRecorder(s, tipo ? { mimeType: tipo } : undefined);
    rec.ondataavailable = (e) => { if (e.data?.size) partes.push(e.data); };
    rec.onstop = async () => {
      s.getTracks().forEach((t) => t.stop()); const blob = new Blob(partes, { type: rec.mimeType || "audio/webm" }); if (blob.size < 500) { aoEstado?.(null); return; }
      aoEstado?.("entendendo");
      try { const b64 = await new Promise((ok, err) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(",")[1]); fr.onerror = err; fr.readAsDataURL(blob); });
        const r = await apiService.post("/beta/voz/ouvir", { audio: b64, tipo: blob.type }); aoEstado?.(null); if (r.texto) aoTexto?.(r.texto); else aoErro?.("Não entendi. Tente de novo."); }
      catch (e) { aoEstado?.(null); if (e?.response?.data?.reserva && SR) { aoErro?.("Toque no 🎤 de novo — vou ouvir pelo navegador."); window.qfBetaVozReserva = true; } else aoErro?.(e?.response?.data?.erro || "Não consegui entender agora."); }
    };
    rec.start(); aoEstado?.("ouvindo"); silencio = setTimeout(fim, 20000); // até 20 s por fala
  }).catch(() => { aoEstado?.(null); aoErro?.("Libere o microfone para o QuotaFlow no navegador."); });
  return { parar() { parado = true; fim(); if (!rec && stream) stream.getTracks().forEach((t) => t.stop()); } };
}
