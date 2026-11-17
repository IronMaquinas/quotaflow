// services/salaControle/analista.js — etapa SC3: 🧠 a FRASE DO ANALISTA SÊNIOR no Início do gestor
//   1 vez por dia por empresa (guardada em ia_uso: recurso sala_analista, chave = dia). Só fatos do painel (JSON curto);
//   passa pela 🛡 conferência de números — se não confirmar, a tela mostra a frase por regra (nunca um número inventado).
const IA = require('../ia');
const { gerarConferido } = require('../ia/conferir');
const SISTEMA = `Você é o Analista Sênior da empresa, falando com o gestor no começo do dia, em português do Brasil.
Escreva 2 ou 3 frases curtas, diretas, no tom de quem conhece a operação: como a empresa está hoje e o que merece atenção primeiro.
Regras: use SOMENTE os fatos do JSON; nunca invente números, nomes, códigos ou causas; se estiver tudo bem, diga isso em uma frase.
Não use listas, títulos nem emojis. Termine com a ação mais importante do dia.`;

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }

async function fraseDoDia(sb, tenantId, painel, { refazer = false } = {}) {
  const dia = painel.hoje;
  let hist = []; try { hist = (await q(sb.from('ia_uso').select('*').eq('tenant_id', tenantId).eq('recurso', 'sala_analista'))).filter((u) => u.chave === dia); } catch { /* sem 091 */ }
  const guardado = [...hist].reverse().find((u) => u.resposta?.texto);
  if (guardado && !refazer) return { texto: guardado.resposta.texto, conferido: guardado.resposta.conferido ?? null, gerado_em: guardado.em, guardado: true };
  if (hist.length >= 3) return guardado ? { texto: guardado.resposta.texto, conferido: guardado.resposta.conferido ?? null, gerado_em: guardado.em } : { texto: null, motivo: 'limite do dia' };
  const emp = (await q(sb.from('tenants').select('*').eq('id', tenantId)).catch(() => []))[0] || {};
  const dados = {
    estado: painel.estado, alertas: (painel.alertas || []).slice(0, 8).map((a) => `${a.titulo} (${a.detalhe || ''})`),
    metas_fora: (painel.saude || []).filter((m) => ['amarelo', 'vermelho'].includes(m.sinal)).map((m) => ({ meta: m.nome, valor: m.valor, unidade: m.unidade, alvo: m.meta, sinal: m.sinal })),
    metas_no_alvo: (painel.saude || []).filter((m) => m.sinal === 'verde').length,
    numeros: painel.kpis || {}, equipe: painel.equipe ? { tarefas_atrasadas: painel.equipe.atrasadas, tarefas_abertas: painel.equipe.abertas } : null,
    agenda_hoje: (painel.agenda || []).length,
  };
  const r = await gerarConferido((extra) => IA.gerarTexto({ tenant: emp, registrar: { supabase: sb, tenantId, recurso: 'sala_analista', chave: dia }, sistema: SISTEMA, prompt: `Painel de hoje (JSON):\n${JSON.stringify(dados)}${extra}`, max: 260 }), dados);
  if (!r.texto) return guardado ? { texto: guardado.resposta.texto, conferido: guardado.resposta.conferido ?? null, gerado_em: guardado.em } : { texto: null, motivo: r.motivo || 'a IA não respondeu' };
  if (r.conferido === false) return { texto: null, motivo: 'a frase da IA não passou na conferência dos números', suspeitos: r.suspeitos };
  if (r.uso_id != null) { try { await sb.from('ia_uso').update({ resposta: { texto: r.texto, conferido: r.conferido } }).eq('id', r.uso_id); } catch { /* ok */ } }
  return { texto: r.texto, conferido: r.conferido, gerado_em: new Date().toISOString() };
}

module.exports = { fraseDoDia, SISTEMA };
