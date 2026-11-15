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
  // 18zl: imagens = [{ mime, base64 }] (leitura de documento) · devolvem { texto, uso: { entrada, saida } }
  async anthropic(c, { sistema, prompt, max, imagens = [] }) {
    const content = [...imagens.map((im) => ({ type: 'image', source: { type: 'base64', media_type: im.mime, data: im.base64 } })), { type: 'text', text: prompt }];
    const r = await axios.post('https://api.anthropic.com/v1/messages', { model: c.modelo, max_tokens: max, system: sistema, messages: [{ role: 'user', content }] },
      { headers: { 'x-api-key': c.chave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, timeout: c.timeout });
    return { texto: (r.data?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim(), parada: r.data?.stop_reason || null, uso: { entrada: r.data?.usage?.input_tokens || 0, saida: r.data?.usage?.output_tokens || 0 } };
  },
  async openai(c, { sistema, prompt, max, imagens = [] }) {
    const content = imagens.length ? [...imagens.map((im) => ({ type: 'image_url', image_url: { url: `data:${im.mime};base64,${im.base64}` } })), { type: 'text', text: prompt }] : prompt;
    const r = await axios.post(`${c.base}/chat/completions`, { model: c.modelo, max_tokens: max, messages: [{ role: 'system', content: sistema }, { role: 'user', content }] },
      { headers: { authorization: `Bearer ${c.chave}`, 'content-type': 'application/json' }, timeout: c.timeout });
    return { texto: String(r.data?.choices?.[0]?.message?.content || '').trim(), parada: r.data?.choices?.[0]?.finish_reason === 'length' ? 'max_tokens' : (r.data?.choices?.[0]?.finish_reason || null), uso: { entrada: r.data?.usage?.prompt_tokens || 0, saida: r.data?.usage?.completion_tokens || 0 } };
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
//   18zl: imagens (documentos) e registro do uso em ia_uso (registrar = { supabase, tenantId, recurso }) — base do custo por empresa
async function gerarTexto({ sistema = '', prompt, max = 900, tenant = null, imagens = [], registrar = null } = {}) {
  const st = status(tenant);
  if (!st.ligada) return { texto: null, motivo: st.motivo, provedor: st.provedor };
  const c = config();
  // 18zo: devolve o id do registro (quem chamou completa com o resultado/falha) + log de custo no servidor
  const anotar = async (ok, uso = {}) => {
    console.log(`🧠 [ia] ${registrar?.recurso || 'texto'} · ${c.modelo} · entrada ${uso.entrada || 0} · saída ${uso.saida || 0} tokens${ok ? '' : ' · FALHOU'}`);
    if (!registrar?.supabase) return null;
    try { const { data } = await registrar.supabase.from('ia_uso').insert([{ tenant_id: registrar.tenantId, recurso: String(registrar.recurso || 'texto').slice(0, 60), provedor: c.provedor, modelo: c.modelo, tokens_entrada: uso.entrada || 0, tokens_saida: uso.saida || 0, ok, em: new Date().toISOString(), ...(registrar.chave ? { chave: registrar.chave } : {}) }]).select(); return data?.[0]?.id ?? null; }
    catch { return null; /* sem a migration 089/091: segue */ } };
  try {
    let r = _fake ? await _fake({ sistema, prompt, max, c, imagens }) : await PROVEDORES[c.provedor](c, { sistema, prompt, max, imagens });
    if (typeof r === 'string') r = { texto: r, uso: {} };
    const usoId = await anotar(!!r.texto, r.uso);
    return r.texto ? { texto: r.texto, parada: r.parada || null, uso: r.uso || {}, uso_id: usoId, provedor: c.provedor, nome: c.nome, modelo: c.modelo } : { texto: null, motivo: 'a IA respondeu vazio', uso_id: usoId, provedor: c.provedor };
  } catch (e) {
    const m = e?.response?.data?.error?.message || e?.message || String(e);
    console.error(`⚠️ [ia:${c.provedor}]`, m); await anotar(false);
    return { texto: null, motivo: /credit|crédito|saldo|billing|quota|rate|429|529|overload/i.test(String(m)) ? 'a IA está sem crédito ou sobrecarregada no momento' : 'a IA não respondeu agora', provedor: c.provedor }; // 18zn: detalhe (provedor/modelo) só no log do servidor
  }
}

module.exports = { config, status, gerarTexto, PROVEDORES, _definirFake: (fn) => { _fake = fn; } };
