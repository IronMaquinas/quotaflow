// backend/services/ia/index.js — etapa 18zk: 🧠 ADAPTADOR DE IA (decidido com o Marcony, 14/11)
//   "Preciso poder trocar a IA no futuro e ligar/desligar sem perder funcionalidade."
//   • O sistema NUNCA depende da IA: quem chama sempre tem o resultado por regras; a IA só escreve um texto em cima dele.
//   • gerarTexto() nunca lança erro: devolve { texto: null, motivo } se estiver desligada, sem chave, fora do ar ou lenta.
//   • Trocar de provedor = mudar variáveis de ambiente (nenhum código fora desta pasta conhece o provedor):
//       IA_PROVEDOR = anthropic (padrão se houver ANTHROPIC_API_KEY) | openai | desligado
//       anthropic: ANTHROPIC_API_KEY · IA_MODELO (padrão claude-sonnet-5-5)
//       openai   : formato "chat completions" — serve para OpenAI e compatíveis (Groq, DeepSeek, Mistral, Ollama local…)
//                  IA_API_KEY (ou OPENAI_API_KEY) · IA_BASE_URL (padrão https://api.openai.com/v1) · IA_MODELO
//       IA_TIMEOUT_MS (padrão 45000)
//   • Por empresa: o módulo "🧠 Agente de IA" (agente_ia) no Console liga/desliga a IA daquela empresa.
const axios = require('axios');

function config() {
  const env = process.env;
  let p = String(env.IA_PROVEDOR || '').trim().toLowerCase();
  if (!p) p = env.ANTHROPIC_API_KEY ? 'anthropic' : (env.IA_API_KEY || env.OPENAI_API_KEY) ? 'openai' : 'desligado';
  const timeout = Number(env.IA_TIMEOUT_MS) > 0 ? Number(env.IA_TIMEOUT_MS) : 45000;
  if (p === 'anthropic') return { provedor: 'anthropic', nome: 'Claude (Anthropic)', chave: env.ANTHROPIC_API_KEY || env.IA_API_KEY || null, modelo: env.IA_MODELO || 'claude-sonnet-5-5', timeout };
  if (p === 'openai') return { provedor: 'openai', nome: `Compatível OpenAI${env.IA_BASE_URL ? ` (${String(env.IA_BASE_URL).replace(/^https?:\/\//, '').split('/')[0]})` : ''}`, chave: env.IA_API_KEY || env.OPENAI_API_KEY || null,
    modelo: env.IA_MODELO || 'gpt-4o-mini', base: String(env.IA_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''), timeout };
  return { provedor: 'desligado', nome: 'desligada', chave: null, modelo: null, timeout };
}

const PROVEDORES = {
  async anthropic(c, { sistema, prompt, max }) {
    const r = await axios.post('https://api.anthropic.com/v1/messages', { model: c.modelo, max_tokens: max, system: sistema, messages: [{ role: 'user', content: prompt }] },
      { headers: { 'x-api-key': c.chave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, timeout: c.timeout });
    return (r.data?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  },
  async openai(c, { sistema, prompt, max }) {
    const r = await axios.post(`${c.base}/chat/completions`, { model: c.modelo, max_tokens: max, messages: [{ role: 'system', content: sistema }, { role: 'user', content: prompt }] },
      { headers: { authorization: `Bearer ${c.chave}`, 'content-type': 'application/json' }, timeout: c.timeout });
    return String(r.data?.choices?.[0]?.message?.content || '').trim();
  },
};

/** a IA está disponível para esta empresa? (servidor configurado + módulo agente_ia ligado) */
function status(tenant = null) {
  const c = config();
  const modulo = tenant ? require('../modulos').ativosDe(tenant).includes('agente_ia') : true;
  const ligada = c.provedor !== 'desligado' && !!c.chave && modulo;
  return { ligada, provedor: c.provedor, nome: c.nome, modelo: c.modelo, motivo: ligada ? null : c.provedor === 'desligado' ? 'IA desligada no servidor' : !c.chave ? 'sem chave da IA no servidor' : 'módulo 🧠 Agente de IA desligado para a empresa' };
}

let _fake = null; // testes
/** { texto, provedor, modelo } — texto null quando não deu (motivo explica); nunca lança */
async function gerarTexto({ sistema = '', prompt, max = 900, tenant = null } = {}) {
  const st = status(tenant);
  if (!st.ligada) return { texto: null, motivo: st.motivo, provedor: st.provedor };
  const c = config();
  try {
    const texto = _fake ? await _fake({ sistema, prompt, max, c }) : await PROVEDORES[c.provedor](c, { sistema, prompt, max });
    return texto ? { texto, provedor: c.provedor, nome: c.nome, modelo: c.modelo } : { texto: null, motivo: 'a IA respondeu vazio', provedor: c.provedor };
  } catch (e) {
    const m = e?.response?.data?.error?.message || e?.message || String(e);
    console.error(`⚠️ [ia:${c.provedor}]`, m);
    return { texto: null, motivo: `a IA não respondeu (${String(m).slice(0, 120)})`, provedor: c.provedor };
  }
}

module.exports = { config, status, gerarTexto, PROVEDORES, _definirFake: (fn) => { _fake = fn; } };
