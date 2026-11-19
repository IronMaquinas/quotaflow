// services/betaVoz.js — etapa B4: 🎤🔊 voz da Beta (gestor/admin). Adaptador: o cliente nunca vê o fornecedor.
//   B5.0: quem decide é a EMPRESA (Console da Plataforma → 💲 Custo de IA): 🎤 no chat e 🔊 no chat usam SEMPRE o navegador (custo zero);
//   a voz paga (neural / ao vivo) é só do modo Conversa e respeita o teto mensal (services/custoIa.js). Cada uso entra em ia_uso.
//   Servidor: VOZ_API_KEY (ou OPENAI_API_KEY) · VOZ_NOME (padrão nova) · VOZ_MODELO_FALA (gpt-4o-mini-tts) · VOZ_MODELO_OUVIR (gpt-4o-mini-transcribe)
//   VOZ_PROVEDOR=navegador desliga a voz paga para todos (chave de emergência). VOZ_LIMITE_DIA = trava extra por empresa/dia (padrão 300).
const env = process.env;
const BASE = 'https://api.openai.com/v1';
const INSTRUCOES = 'Fale em português do Brasil, com voz feminina jovem, calorosa e natural, ritmo ágil e tom de assistente prestativa. Leia siglas como TSK, PV, AT e CT-e letra a letra e números de documento com clareza.';
const usos = new Map(); // `${tenant}:${dia}` → n (memória do processo; reinicia no deploy)

function config() {
  const p = String(env.VOZ_PROVEDOR || 'openai').toLowerCase();
  const chave = env.VOZ_API_KEY || env.OPENAI_API_KEY || null;
  if (p !== 'navegador' && chave) return { provedor: 'neural', chave, voz: env.VOZ_NOME || 'nova', fala: env.VOZ_MODELO_FALA || 'gpt-4o-mini-tts', ouvir: env.VOZ_MODELO_OUVIR || 'gpt-4o-mini-transcribe' };
  return { provedor: 'navegador' };
}
const limite = () => Math.max(0, Number(env.VOZ_LIMITE_DIA) || 300);
function consumir(tenantId) {
  const k = `${tenantId}:${new Date().toISOString().slice(0, 10)}`; const n = usos.get(k) || 0;
  if (n >= limite()) return false; usos.set(k, n + 1); if (usos.size > 5000) usos.clear(); return true;
}
const CI = () => require('./custoIa');
/** o que o front precisa saber (sem nome de fornecedor). chat = sempre navegador; conversa = modo da empresa (se o servidor tiver voz paga) */
async function publico(sb, tenantId) {
  const cfg = await CI().configDe(sb, tenantId); const ef = CI().modoEfetivo(cfg); const neural = config().provedor === 'neural';
  return { provedor: 'navegador', chat_mic: cfg.chat_mic, chat_fala: cfg.chat_fala, conversa: ef.modo !== 'desligado' && neural ? ef.modo : 'desligado', cortesia: ef.cortesia };
}
/** a voz paga pode ser usada agora por esta empresa? */
async function liberada(sb, tenantId) {
  if (config().provedor !== 'neural') return { status: 409, erro: 'Voz neural desligada.', reserva: true };
  const ef = CI().modoEfetivo(await CI().configDe(sb, tenantId)); if (ef.modo === 'desligado') return { status: 403, erro: 'Modo Conversa não está no plano da empresa.', reserva: true };
  const g = await CI().podeVozPaga(sb, tenantId); if (!g.ok) return { status: 429, erro: 'Limite de voz do mês atingido.', reserva: true };
  if (!consumir(tenantId)) return { status: 429, erro: 'Limite diário de voz atingido.', reserva: true };
  return null;
}
const anotar = (sb, tenantId, recurso, unidades, modelo) => sb?.from('ia_uso').insert([{ tenant_id: tenantId, recurso, provedor: 'voz', modelo, tokens_entrada: Math.round(unidades), tokens_saida: 0, ok: true, em: new Date().toISOString() }]).then(() => null, () => null);

// limpa o texto para falar: tira emojis, setas e marcação
const paraFala = (t) => String(t || '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '').replace(/[→•*_#]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200);

const cacheFala = new Map(); // B5.3: frase repetida (saudação, "Confirma?") não é paga de novo
async function falar(sb, tenantId, texto, fetcher = fetch) {
  const input = paraFala(texto); if (!input) return { status: 400, erro: 'Nada para falar.' };
  const kc = `${config().voz || ''}|${input}`; if (input.length <= 120 && cacheFala.has(kc)) return { audio: cacheFala.get(kc), tipo: 'audio/mpeg', cache: true };
  const bloq = await liberada(sb, tenantId); if (bloq) return bloq; const c = config();
  const r = await fetcher(`${BASE}/audio/speech`, { method: 'POST', headers: { Authorization: `Bearer ${c.chave}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: c.fala, voice: c.voz, input, instructions: INSTRUCOES, response_format: 'mp3' }) });
  if (!r.ok) { console.error('❌ [voz] falar', r.status); return { status: 502, erro: 'Voz indisponível agora.', reserva: true }; }
  await anotar(sb, tenantId, 'voz_falar', input.length, c.fala);
  const audio = Buffer.from(await r.arrayBuffer()).toString('base64');
  if (input.length <= 120) { if (cacheFala.size > 300) cacheFala.clear(); cacheFala.set(kc, audio); }
  return { audio, tipo: 'audio/mpeg' };
}

async function transcrever(sb, tenantId, base64, tipo = 'audio/webm', fetcher = fetch) {
  const buf = Buffer.from(String(base64 || ''), 'base64'); if (buf.length < 500) return { status: 400, erro: 'Não ouvi nada.' };
  if (buf.length > 8e6) return { status: 413, erro: 'Áudio longo demais.' };
  const bloq = await liberada(sb, tenantId); if (bloq) return bloq; const c = config();
  const fd = new FormData(); const ext = /mp4|m4a|aac/.test(tipo) ? 'mp4' : /ogg/.test(tipo) ? 'ogg' : 'webm';
  fd.append('file', new Blob([buf], { type: tipo }), `fala.${ext}`); fd.append('model', c.ouvir); fd.append('language', 'pt');
  fd.append('prompt', 'Termos do QuotaFlow: TSK, PV, AT, OS, CT-e, MDF-e, BID, CNH, carreta, cavalo, programação, cotação, férias.');
  const r = await fetcher(`${BASE}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${c.chave}` }, body: fd });
  if (!r.ok) { console.error('❌ [voz] ouvir', r.status); return { status: 502, erro: 'Não consegui entender agora.', reserva: true }; }
  await anotar(sb, tenantId, 'voz_ouvir', Math.max(1, buf.length / 2000), c.ouvir); // ~16 kbps (opus): bytes/2000 ≈ segundos
  const j = await r.json(); return { texto: String(j.text || '').trim() };
}

module.exports = { config, publico, liberada, falar, transcrever, paraFala, consumir, _usos: usos };
