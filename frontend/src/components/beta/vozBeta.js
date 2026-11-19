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
// B5.2: iPhone/Safari só tocam som iniciado por um TOQUE. desbloquearAudio() roda no toque do "🚗 Conversa": cria UM elemento de áudio
//   (reaproveitado em todas as falas), toca um silêncio, acorda a fala do aparelho e o AudioContext. Também guarda o motivo da última falha.
let audioEl = null; let actx = null; export const diag = { voz: "", erro: "" };
const SILENCIO = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
export function desbloquearAudio() {
  try { if (!audioEl) { audioEl = new Audio(); audioEl.setAttribute("playsinline", ""); } audioEl.muted = false; audioEl.src = SILENCIO; const p = audioEl.play(); p?.catch?.(() => {}); } catch { /* ok */ }
  try { if (podeFalarNavegador) { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; window.speechSynthesis.speak(u); } } catch { /* ok */ }
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume?.(); } catch { /* ok */ }
}
export const contextoAudio = () => { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume?.(); } catch { /* ok */ } return actx; };
// B5.2: o microfone abre UMA vez por conversa (o iPhone pedia permissão a cada frase)
let micStream = null;
export async function abrirMicrofone() {
  if (micStream && micStream.getTracks().some((x) => x.readyState === "live")) return micStream;
  micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); return micStream;
}
export function fecharMicrofone() { try { micStream?.getTracks().forEach((x) => x.stop()); } catch { /* ok */ } micStream = null; }
export function pararFala() { try { window.speechSynthesis?.cancel(); } catch { /* ok */ } if (audioAtual) { try { audioAtual.pause(); } catch { /* ok */ } audioAtual = null; } }
function falarNavegador(texto, aoFim) {
  if (!podeFalarNavegador) return aoFim?.();
  const u = new SpeechSynthesisUtterance(paraFala(texto)); u.lang = "pt-BR"; u.rate = 1.05; u.pitch = 1.1; const v = vozNavegador(); if (v) u.voice = v;
  u.onend = () => aoFim?.(); u.onerror = () => aoFim?.(); window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
}
export async function falar(modo, texto, aoFim) {
  pararFala(); const t = paraFala(texto); if (!t) return aoFim?.();
  if (modo === "neural") {
    let r = null;
    try { r = await apiService.post("/beta/voz/falar", { texto: t }); }
    catch (e) { diag.voz = "aparelho"; diag.erro = e?.response?.data?.erro || "voz neural indisponível"; }
    if (r?.audio) {
      try { const a = audioEl || new Audio(); a.setAttribute?.("playsinline", ""); a.src = `data:${r.tipo || "audio/mpeg"};base64,${r.audio}`; audioAtual = a;
        a.onended = () => { audioAtual = null; aoFim?.(); }; a.onerror = () => { audioAtual = null; aoFim?.(); }; await a.play(); diag.voz = "neural"; diag.erro = ""; return; }
      catch (e) { diag.voz = "aparelho"; diag.erro = `o aparelho bloqueou o som (${e?.name || "erro"}) — toque no botão`; }
    }
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

// B5.1: 🚗 modo Conversa — escuta contínua: grava só quando há fala (detector de voz) e para após ~1,3 s de silêncio.
//   Neural: envia o trecho ao servidor; navegador: reconhecimento do próprio navegador. aoSilencio() quando ninguém falou por ~45 s.
export function ouvirConversa(modo, { aoTexto, aoEstado, aoErro, aoSilencio, aoReserva }) {
  if (modo !== "neural" || !podeGravar) {
    let vivo = true; let r = null; const t0 = Date.now();
    const ciclo = () => {
      if (!vivo) return; if (!SR) { aoErro?.("Este navegador não reconhece fala."); return; }
      r = new SR(); r.lang = "pt-BR"; r.interimResults = false; r.continuous = false; let ok = false;
      r.onresult = (e) => { const t = Array.from(e.results).map((x) => x[0].transcript).join(" ").trim(); if (t) { ok = true; vivo = false; aoEstado?.(null); aoTexto?.(t); } };
      r.onerror = (e) => { if (e.error === "not-allowed") { vivo = false; aoErro?.("Libere o microfone para o QuotaFlow."); } };
      r.onend = () => { if (!vivo || ok) return; if (Date.now() - t0 > 45000) { vivo = false; aoEstado?.(null); aoSilencio?.(); return; } setTimeout(ciclo, 150); };
      try { r.start(); aoEstado?.("ouvindo"); } catch { setTimeout(ciclo, 400); }
    };
    ciclo(); return { parar() { vivo = false; try { r?.abort(); } catch { /* ok */ } } };
  }
  let vivo = true; let stream = null; let ctx = null; let rec = null; let raf = null; const partes = [];
  const encerrar = () => { vivo = false; cancelAnimationFrame(raf); try { if (rec?.state === "recording") rec.stop(); } catch { /* ok */ } }; // o microfone fica aberto até o fim da conversa
  abrirMicrofone().then((s) => {
    stream = s; if (!vivo) return encerrar();
    ctx = contextoAudio(); const an = ctx.createAnalyser(); an.fftSize = 1024; const fonte = ctx.createMediaStreamSource(s); fonte.connect(an); const buf = new Float32Array(an.fftSize);
    const tipo = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((x) => window.MediaRecorder.isTypeSupported?.(x)) || "";
    rec = new MediaRecorder(s, tipo ? { mimeType: tipo } : undefined); rec.ondataavailable = (e) => { if (e.data?.size) partes.push(e.data); };
    let falou = false; let ultimaVoz = 0; const t0 = Date.now(); let base = 0.01; let amostras = 0;
    rec.onstop = async () => {
      if (!falou) return; const blob = new Blob(partes, { type: rec.mimeType || "audio/webm" }); aoEstado?.("entendendo");
      try { const b64 = await new Promise((ok, err) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(",")[1]); fr.onerror = err; fr.readAsDataURL(blob); });
        const r = await apiService.post("/beta/voz/ouvir", { audio: b64, tipo: blob.type }); aoEstado?.(null); if (r.texto) aoTexto?.(r.texto); else aoErro?.("Não entendi. Pode repetir?"); }
      catch (e) { aoEstado?.(null); if (e?.response?.data?.reserva) aoReserva?.(e.response.data.erro); else aoErro?.("Não entendi. Pode repetir?"); }
    };
    rec.start(250); aoEstado?.("ouvindo");
    const loop = () => {
      if (!vivo) return; an.getFloatTimeDomainData(buf); let sq = 0; for (const v of buf) sq += v * v; const rms = Math.sqrt(sq / buf.length); const agora = Date.now();
      if (!falou && amostras < 30) { base = (base * amostras + rms) / (amostras + 1); amostras++; } // calibra o ruído (carro, rua)
      if (rms > Math.max(0.02, base * 2.5)) { if (!falou) falou = true; ultimaVoz = agora; }
      if (falou && agora - ultimaVoz > 1300) { vivo = false; try { rec.stop(); } catch { /* ok */ } return; }
      if (falou && agora - t0 > 25000) { vivo = false; try { rec.stop(); } catch { /* ok */ } return; }
      if (!falou && agora - t0 > 45000) { encerrar(); aoEstado?.(null); aoSilencio?.(); return; }
      raf = requestAnimationFrame(loop);
    }; loop();
  }).catch(() => { aoEstado?.(null); aoErro?.("Libere o microfone para o QuotaFlow."); });
  return { parar() { const gravando = vivo; vivo = false; cancelAnimationFrame(raf); partes.length = 0; if (gravando) encerrar(); } };
}
/** fala e devolve uma Promise que resolve quando termina */
export const falarE = (modo, texto) => new Promise((ok) => { let feito = false; const fim = () => { if (!feito) { feito = true; ok(); } }; falar(modo, texto, fim); setTimeout(fim, Math.min(60000, 4000 + String(texto || "").length * 90)); });
