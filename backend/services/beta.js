// services/beta.js — etapa B1: 👋 BETA — a assistente do QuotaFlow (por texto, só CONSULTA)
//   "Oi Beta, como está minha empresa hoje?" — responde com os dados da própria empresa, logada como a pessoa:
//   o contexto é montado pelo servidor (Sala de Controle + metas + valor gerado), sempre do tenant da sessão — nada de outro cliente.
//   Toda resposta passa pela 🛡 conferência de números. Limite diário por pessoa (IA_LIMITE_BETA_DIA, padrão 20).
//   O provedor/modelo de IA nunca aparece: para o cliente, é a Beta.
const IA = require('./ia');
const { gerarConferido } = require('./ia/conferir');
const SC = require('./salaControle');

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
  const hist = (Array.isArray(mensagens) ? mensagens : []).filter((m) => m && typeof m.texto === 'string' && m.texto.trim()).slice(-8).map((m) => ({ de: m.de === 'beta' ? 'beta' : 'pessoa', texto: m.texto.trim().slice(0, 800) }));
  const pergunta = hist.filter((m) => m.de === 'pessoa').pop(); if (!pergunta) return { erro: 'Escreva a sua pergunta.', status: 400 };
  const usados = await usoHoje(sb, tenantId, userId);
  if (usados >= LIMITE()) return { erro: `Você já fez ${LIMITE()} perguntas hoje — a Beta volta amanhã. 😊`, status: 429, restantes: 0 };
  const emp = (await q(sb.from('tenants').select('*').eq('id', tenantId)).catch(() => []))[0] || {};
  if (!IA.status(emp).ligada) return { erro: 'A Beta está desligada para a sua empresa.', status: 409 };
  const { dados } = await contexto(sb, { tenantId, userId, perfis, nome });
  const conversa = hist.map((m) => `${m.de === 'beta' ? 'Beta' : 'Pessoa'}: ${m.texto}`).join('\n');
  const r = await gerarConferido((extra) => IA.gerarTexto({ tenant: emp, registrar: { supabase: sb, tenantId, recurso: 'beta', chave: `${hojeBR()}:${userId}` }, sistema: SISTEMA,
    prompt: `Dados da empresa (JSON):\n${JSON.stringify(dados)}\n\nConversa:\n${conversa}${extra}\n\nResponda à última mensagem da Pessoa.`, max: 450 }), { dados, perguntas: hist.map((m) => m.texto) });
  if (!r.texto) return { erro: 'A Beta não conseguiu responder agora. Tente de novo em instantes.', status: 503 };
  const restantes = Math.max(0, LIMITE() - (await usoHoje(sb, tenantId, userId)));
  return { texto: r.texto, conferido: r.conferido, suspeitos: r.suspeitos || [], restantes };
}

module.exports = { perguntar, contexto, SISTEMA, LIMITE };
