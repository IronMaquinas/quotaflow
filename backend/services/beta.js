// services/beta.js — etapa B1: 👋 BETA — a assistente do QuotaFlow (por texto, só CONSULTA)
//   "Oi Beta, como está minha empresa hoje?" — responde com os dados da própria empresa, logada como a pessoa:
//   o contexto é montado pelo servidor (Sala de Controle + metas + valor gerado), sempre do tenant da sessão — nada de outro cliente.
//   Toda resposta passa pela 🛡 conferência de números. Limite diário por pessoa (IA_LIMITE_BETA_DIA, padrão 20).
//   O provedor/modelo de IA nunca aparece: para o cliente, é a Beta.
// B1.5: ⚡ CONSULTAS RÁPIDAS (services/betaConsultas.js) — primeiro a IA só escolhe a consulta (resposta curtinha em JSON);
//   o sistema lê o banco e monta a resposta por texto fixo. Se nenhuma consulta serve: gestor → resposta pelo painel (B1);
//   demais perfis → "ainda não sei isso; hoje eu consulto: …". Aberta a todos os perfis internos (cada consulta tem os seus).
const IA = require('./ia');
const { gerarConferido } = require('./ia/conferir');
const SC = require('./salaControle');
const BC = require('./betaConsultas');

const LIMITE = () => Math.max(1, Number(process.env.IA_LIMITE_BETA_DIA) || 20);
const SISTEMA = `Você é a Beta, assistente do QuotaFlow (sistema de gestão de transportadoras e locadoras), conversando em português do Brasil com uma pessoa da empresa.
Responda de forma curta e direta (até 5 frases, sem títulos), no tom de uma colega que conhece a operação.
Use SOMENTE os dados do JSON "dados da empresa". Nunca invente números, nomes, códigos, datas ou causas.
Se a pergunta pedir algo que não está nos dados, diga com naturalidade que ainda não consegue ver isso por aqui e indique a tela do sistema onde a pessoa encontra.
Você só consulta: não cria, altera nem agenda nada (ainda). Se pedirem uma ação, explique que por enquanto só consulta e diga onde fazer.
Se perguntarem qual inteligência artificial você é, responda apenas que é a Beta, assistente do QuotaFlow.`;

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const hojeBR = () => new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);

async function contexto(sb, { tenantId, userId, perfis, nome }) {
  const painel = await SC.montar(sb, { tenantId, userId, perfis, nome });
  const dados = { hoje: painel.hoje, pessoa: painel.nome, estado_do_dia: painel.estado,
    alertas: painel.alertas.slice(0, 12).map((a) => `${a.titulo} — ${a.detalhe || ''}`), minhas_prioridades: painel.prioridades.slice(0, 10).map((p) => `${p.titulo} — ${p.detalhe || ''}`),
    agenda_de_hoje: painel.agenda.map((a) => `${a.hora || ''} ${a.titulo} ${a.detalhe || ''}`.trim()), numeros_do_dia: painel.kpis,
    equipe: painel.equipe ? { tarefas_atrasadas: painel.equipe.atrasadas, tarefas_abertas: painel.equipe.abertas, por_pessoa: painel.equipe.pessoas } : null };
  if (painel.gestor) {
    try { dados.metas = (await require('./metas').listar(sb, tenantId, { fotografar: false })).map((m) => ({ meta: m.nome, area: m.area_nome, valor: m.valor, unidade: m.unidade, alvo: m.meta, sentido: m.sentido === 'menor' ? 'menor é melhor' : 'maior é melhor', semaforo: m.sinal, dono: m.responsavel_nome || null, planos_de_acao: (m.acoes || []).map((a) => `${a.numero || ''} ${a.titulo} (${a.status})`) })); } catch { /* sem metas */ }
    try { const v = await require('./valorGerado').calcular(sb, tenantId); dados.valor_gerado_no_ano = { ano: v.ano, economia_total: v.total, compras: v.areas.compras.total, spot: v.areas.spot.total, multas: v.areas.multas.total, receita_bids_aceitos: v.receita.valor, roi_vezes: v.roi?.vezes ?? null }; } catch { /* ok */ }
  }
  return { dados, gestor: painel.gestor };
}

async function usoHoje(sb, tenantId, userId) {
  try { return (await q(sb.from('ia_uso').select('id, chave').eq('tenant_id', tenantId).eq('recurso', 'beta'))).filter((u) => u.chave === `${hojeBR()}:${userId}`).length; } catch { return 0; }
}

/** mensagens = [{ de: 'pessoa'|'beta', texto }] — a última é a pergunta */
async function perguntar(sb, { tenantId, userId, perfis = [], nome = '', mensagens = [] }) {
  // B2.2: só as últimas 4 mensagens (as da Beta resumidas) + o ASSUNTO da última resposta (para "com quem está?", "e o prazo?")
  const hist = (Array.isArray(mensagens) ? mensagens : []).filter((m) => m && typeof m.texto === 'string' && m.texto.trim()).slice(-4).map((m) => ({ de: m.de === 'beta' ? 'beta' : 'pessoa', texto: m.texto.trim().slice(0, m.de === 'beta' ? 220 : 500), assunto: m.de === 'beta' && m.assunto && typeof m.assunto === 'object' ? { consulta: String(m.assunto.consulta || '').slice(0, 40), args: Object.fromEntries(Object.entries(m.assunto.args || {}).slice(0, 4).map(([k, v]) => [String(k).slice(0, 20), String(v ?? '').slice(0, 120)])) } : null }));
  const ultimoAssunto = [...hist].reverse().find((m) => m.de === 'beta' && m.assunto?.consulta)?.assunto || null;
  const pergunta = hist.filter((m) => m.de === 'pessoa').pop(); if (!pergunta) return { erro: 'Escreva a sua pergunta.', status: 400 };
  const usados = await usoHoje(sb, tenantId, userId);
  if (usados >= LIMITE()) return { erro: `Você já fez ${LIMITE()} perguntas hoje — a Beta volta amanhã. 😊`, status: 429, restantes: 0 };
  const emp = (await q(sb.from('tenants').select('*').eq('id', tenantId)).catch(() => []))[0] || {};
  if (!IA.status(emp).ligada) return { erro: 'A Beta está desligada para a sua empresa.', status: 409 };
  const ctxP = { tenantId, userId, perfis };
  const base = `${hojeBR()}:${userId}`;
  const registrar = { supabase: sb, tenantId, recurso: 'beta', chave: `${base}:rot` }; // B2.0: chamadas internas não contam — conta 1 por pergunta RESPONDIDA
  const contar = () => sb.from('ia_uso').insert([{ tenant_id: tenantId, recurso: 'beta', chave: base, provedor: 'local', modelo: 'resposta', tokens_entrada: 0, tokens_saida: 0 }]).then(() => null, () => null);
  const conversa = hist.map((m) => `${m.de === 'beta' ? 'Beta' : 'Pessoa'}: ${m.texto}${m.assunto ? ` [assunto: ${m.assunto.consulta} ${JSON.stringify(m.assunto.args)}]` : ''}`).join('\n');
  const gestor = perfis.some((p) => ['admin', 'gestor'].includes(p));
  const lista = BC.permitidas(perfis);
  // ⚡ 0) B2.0: perguntas comuns entendidas SEM IA (palavras-chave) — custo zero
  let esc = await BC.rotearLocal(sb, ctxP, pergunta.texto, hist, ultimoAssunto).catch(() => null);
  // ⚡ 1) senão, o modelo econômico escolhe a consulta
  if (!esc) esc = await escolher({ emp, registrar, lista, conversa, gestor });
  if (esc.consulta === '__painel' && gestor) {
    // 🧠 visão geral (só quando pedida): modelo principal
    const { dados } = await contexto(sb, { tenantId, userId, perfis, nome });
    const r = await gerarConferido((extra) => IA.gerarTexto({ tenant: emp, registrar: { ...registrar, chave: `${base}:painel` }, sistema: SISTEMA,
      prompt: `Dados da empresa (JSON):\n${JSON.stringify(dados)}\n\nConversa:\n${conversa}${extra}\n\nResponda à última mensagem da Pessoa.`, max: 450 }), { dados, perguntas: hist.map((m) => m.texto) });
    if (!r.texto) return { erro: 'A Beta não conseguiu responder agora. Tente de novo em instantes.', status: 503 };
    await contar();
    return { texto: r.texto, conferido: r.conferido, suspeitos: r.suspeitos || [], restantes: await restam(sb, tenantId, userId) };
  }
  if (esc.consulta === '__perguntar') { // B2.4: falta um dado — pergunta em vez de cortar a conversa (não conta no limite)
    return { texto: esc.args.texto, pergunta_de_volta: true, assunto: ultimoAssunto, conferido: true, direto: true, suspeitos: [], restantes: await restam(sb, tenantId, userId) };
  }
  if (esc.consulta && esc.consulta !== '__painel') {
    // B2.4: argumento faltando? herda do assunto anterior (mesmos nomes: data, pessoa, equipamento, ref…)
    const def = BC.CONSULTAS.find((c) => c.nome === esc.consulta); const args = { ...(esc.args || {}) };
    if (def && ultimoAssunto?.args) for (const k of Object.keys(def.args)) if ((args[k] == null || args[k] === '') && ultimoAssunto.args[k]) args[k] = ultimoAssunto.args[k];
    esc.args = args;
    const r = await BC.executar(sb, ctxP, esc.consulta, esc.args);
    if (r?.falta) return { texto: r.texto, pergunta_de_volta: true, assunto: { consulta: esc.consulta, args: esc.args }, conferido: true, direto: true, suspeitos: [], restantes: await restam(sb, tenantId, userId) };
    await contar();
    return { texto: r.texto, link: r.link || null, acoes: r.acoes || [], assunto: r.assunto || { consulta: esc.consulta, args: esc.args || {} }, consulta: esc.consulta, local: !!esc.local, conferido: true, direto: true, suspeitos: [], restantes: await restam(sb, tenantId, userId) };
  }
  // 🛟 B2.3: não bateu com consulta, mas cita algo do cadastro → resumo do que existe sobre aquilo (sem IA)
  try { const cit = await BC.resumoDoCitado(sb, ctxP, pergunta.texto); if (cit) {
    const r = cit.consulta.startsWith('__') ? await BC.executarResumo(sb, ctxP, cit.consulta, cit.args) : await BC.executar(sb, ctxP, cit.consulta, cit.args);
    if (r?.texto) { await contar(); try { await q(sb.from('beta_pendentes').insert([{ tenant_id: tenantId, usuario_id: String(userId), usuario_nome: nome || null, perfis: perfis.join(','), pergunta: pergunta.texto.slice(0, 800), conversa: hist.slice(-4), status: 'pendente', nota: 'respondida com resumo do citado (melhorar)' }])); } catch { /* ok */ }
      return { texto: r.texto, link: r.link || null, acoes: r.acoes || [], assunto: { consulta: cit.consulta, args: cit.args }, resumo: true, conferido: true, direto: true, suspeitos: [], restantes: await restam(sb, tenantId, userId) }; } } } catch { /* segue */ }
  // 📮 B2.0: ainda não sabe → registra para o admin da plataforma (Console) e NÃO conta no limite
  try { await q(sb.from('beta_pendentes').insert([{ tenant_id: tenantId, usuario_id: String(userId), usuario_nome: nome || null, perfis: perfis.join(','), pergunta: pergunta.texto.slice(0, 800), conversa: hist.slice(-4), status: 'pendente' }])); } catch { /* sem a 110 */ }
  if (ultimoAssunto && pergunta.texto.split(/\s+/).length <= 14) // B2.4: parece continuação — não corta a conversa
    return { texto: 'Ainda não sei responder isso dentro deste assunto. 🙏 Já anotei para aprender. Se puder, me pergunte de outro jeito — por exemplo, dizendo o nome, a data ou o número do que você quer.', aprendendo: true, assunto: ultimoAssunto, conferido: true, direto: true, suspeitos: [], restantes: await restam(sb, tenantId, userId) };
  return { texto: 'Desculpe, ainda estou aprendendo a consultar isso. 🙏 Encaminhei a sua pergunta para os nossos especialistas — em breve você poderá perguntar de novo.' + (lista.length ? `\n\nHoje eu já sei, por exemplo: ${lista.slice(0, 5).map((c) => c.exemplo.replace(/\?$/, '')).join(' · ')}.` : ''),
    aprendendo: true, conferido: true, direto: true, suspeitos: [], restantes: await restam(sb, tenantId, userId) };
}

const restam = async (sb, tenantId, userId) => Math.max(0, LIMITE() - (await usoHoje(sb, tenantId, userId)));

const ROTEADOR = `Você classifica perguntas para a Beta, assistente do QuotaFlow. Responda SOMENTE um JSON numa linha, sem texto em volta:
{"consulta":"<nome>","args":{...}}  ou  {"consulta":null}
Escolha a consulta da lista que responde à ÚLTIMA mensagem da Pessoa (use a conversa para completar: se a Beta perguntou "qual delas?" e a Pessoa respondeu um nome, repita a consulta anterior com o nome completo).
Copie nomes, placas e números exatamente como a Pessoa escreveu (sem inventar). Não preencha argumento que a Pessoa não disse.
Se a Pessoa usar "nessa data", "esse dia", "ele/ela", "esse cliente", "o mesmo", copie o valor correspondente do [assunto] da resposta anterior da Beta.
Se a pergunta é continuação mas falta um dado essencial que não está na conversa, devolva {"consulta":"__perguntar","args":{"texto":"<pergunta curta pedindo o dado>"}}.
NÃO explique, NÃO pense em voz alta, NÃO use markdown: a resposta inteira é só o JSON.`;

async function escolher({ emp, registrar, lista, conversa, gestor }) {
  if (!lista.length) return { consulta: null };
  const cat = lista.map((c) => `- ${c.nome}: ${c.descricao} Argumentos: ${Object.entries(c.args).map(([k, v]) => `${k} (${v})`).join(', ')}. Ex.: "${c.exemplo}"`).join('\n');
  const extra = gestor ? '\nSe a pessoa pedir a VISÃO GERAL da empresa (como está hoje, resumo, metas, valor gerado, alertas), devolva {"consulta":"__painel"}.' : '';
  const r = await IA.gerarTexto({ tenant: emp, registrar, sistema: ROTEADOR + extra, prompt: `Consultas:\n${cat}\n\nConversa:\n${conversa}`, max: 400, rapido: true }); // B1.8: IA_MODELO_RAPIDO · B1.10: folga (com 120 o modelo econômico às vezes cortava antes do JSON)
  try {
    const bruto = String(r.texto || ''); const m = bruto.match(/\{[\s\S]*\}/);
    let j = null; try { j = JSON.parse(m[0]); } catch { const n = bruto.match(/"consulta"\s*:\s*"([a-z_]+)"/); if (n) { j = { consulta: n[1], args: {} }; for (const a of bruto.matchAll(/"([a-z_]+)"\s*:\s*"([^"]*)"/g)) if (a[1] !== 'consulta') j.args[a[1]] = a[2]; } } // B1.10: JSON cortado ainda serve
    if (j && j.consulta === '__perguntar' && j.args?.texto) return { consulta: '__perguntar', args: { texto: String(j.args.texto).slice(0, 200) } }; // B2.4
    if (j && j.consulta && lista.some((c) => c.nome === j.consulta)) return { consulta: j.consulta, args: j.args && typeof j.args === 'object' ? j.args : {} };
  } catch { /* não entendeu → segue sem consulta */ }
  if (gestor && /"consulta"\s*:\s*"__painel"/.test(String(r?.texto || ''))) return { consulta: '__painel' };
  if (r?.texto && !/"consulta"/.test(r.texto)) console.log(`👋 [beta] roteador não devolveu JSON (${r.parada || '?'}): ${String(r.texto).slice(0, 300).replace(/\s+/g, ' ')}`); // B2.0: diagnóstico
  return { consulta: null };
}

module.exports = { perguntar, contexto, escolher, SISTEMA, ROTEADOR, LIMITE };
