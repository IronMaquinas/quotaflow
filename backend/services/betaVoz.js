// services/betaVoz.js — etapa B4: 🎤🔊 voz da Beta (gestor/admin). Adaptador: o cliente nunca vê o fornecedor.
//   VOZ_PROVEDOR = navegador (padrão: o próprio navegador ouve e fala, custo zero) | openai (voz neural)
//   openai: VOZ_API_KEY (ou OPENAI_API_KEY) · VOZ_NOME (padrão nova) · VOZ_MODELO_FALA (gpt-4o-mini-tts) · VOZ_MODELO_OUVIR (gpt-4o-mini-transcribe)
//   VOZ_LIMITE_DIA = falas+transcrições por empresa/dia (padrão 300). Acabou ou falhou → o front volta para a voz do navegador.
const env = process.env;
const BASE = 'https://api.openai.com/v1';
const INSTRUCOES = 'Fale em português do Brasil, com voz feminina jovem, calorosa e natural, ritmo ágil e tom de assistente prestativa. Leia siglas como TSK, PV, AT e CT-e letra a letra e números de documento com clareza.';
const usos = new Map(); // `${tenant}:${dia}` → n (memória do processo; reinicia no deploy)

function config() {
  const p = String(env.VOZ_PROVEDOR || 'navegador').toLowerCase();
  const chave = env.VOZ_API_KEY || env.OPENAI_API_KEY || null;
  if (p === 'openai' && chave) return { provedor: 'neural', chave, voz: env.VOZ_NOME || 'nova', fala: env.VOZ_MODELO_FALA || 'gpt-4o-mini-tts', ouvir: env.VOZ_MODELO_OUVIR || 'gpt-4o-mini-transcribe' };
  return { provedor: 'navegador' };
}
const limite = () => Math.max(0, Number(env.VOZ_LIMITE_DIA) || 300);
function consumir(tenantId) {
  const k = `${tenantId}:${new Date().toISOString().slice(0, 10)}`; const n = usos.get(k) || 0;
  if (n >= limite()) return false; usos.set(k, n + 1); if (usos.size > 5000) usos.clear(); return true;
}
/** o que o front precisa saber (sem nome de fornecedor) */
const publico = () => ({ provedor: config().provedor });

// limpa o texto para falar: tira emojis, setas e marcação
const paraFala = (t) => String(t || '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '').replace(/[→•*_#]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200);

async function falar(tenantId, texto, fetcher = fetch) {
  const c = config(); if (c.provedor !== 'neural') return { status: 409, erro: 'Voz neural desligada.', reserva: true };
  const input = paraFala(texto); if (!input) return { status: 400, erro: 'Nada para falar.' };
  if (!consumir(tenantId)) return { status: 429, erro: 'Limite diário de voz atingido.', reserva: true };
  const r = await fetcher(`${BASE}/audio/speech`, { method: 'POST', headers: { Authorization: `Bearer ${c.chave}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: c.fala, voice: c.voz, input, instructions: INSTRUCOES, response_format: 'mp3' }) });
  if (!r.ok) { console.error('❌ [voz] falar', r.status); return { status: 502, erro: 'Voz indisponível agora.', reserva: true }; }
  return { audio: Buffer.from(await r.arrayBuffer()).toString('base64'), tipo: 'audio/mpeg' };
}

async function transcrever(tenantId, base64, tipo = 'audio/webm', fetcher = fetch) {
  const c = config(); if (c.provedor !== 'neural') return { status: 409, erro: 'Voz neural desligada.', reserva: true };
  const buf = Buffer.from(String(base64 || ''), 'base64'); if (buf.length < 500) return { status: 400, erro: 'Não ouvi nada.' };
  if (buf.length > 8e6) return { status: 413, erro: 'Áudio longo demais.' };
  if (!consumir(tenantId)) return { status: 429, erro: 'Limite diário de voz atingido.', reserva: true };
  const fd = new FormData(); const ext = /mp4|m4a|aac/.test(tipo) ? 'mp4' : /ogg/.test(tipo) ? 'ogg' : 'webm';
  fd.append('file', new Blob([buf], { type: tipo }), `fala.${ext}`); fd.append('model', c.ouvir); fd.append('language', 'pt');
  fd.append('prompt', 'Termos do QuotaFlow: TSK, PV, AT, OS, CT-e, MDF-e, BID, CNH, carreta, cavalo, programação, cotação, férias.');
  const r = await fetcher(`${BASE}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${c.chave}` }, body: fd });
  if (!r.ok) { console.error('❌ [voz] ouvir', r.status); return { status: 502, erro: 'Não consegui entender agora.', reserva: true }; }
  const j = await r.json(); return { texto: String(j.text || '').trim() };
}

module.exports = { config, publico, falar, transcrever, paraFala, consumir, _usos: usos };
