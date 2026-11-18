// services/avisosFerias.js — etapa B1.14: 🏖 lembrete de férias perto do limite legal (sem programação)
//   Marcos: 60 dias · 30 dias · vencido (uma vez cada, tabela avisos_enviados — chave ferias_func:<colab>:<limite>).
//   🔔 sininho para o GESTOR (admin não recebe rotina) e para o FUNCIONÁRIO (se tiver login) + ✉ e-mail ao funcionário (se tiver e-mail).
//   O e-mail do gestor sai no resumo diário de Pessoas (services/avisosPessoas.js — categoria ferias_venc).
//   Na Home (Sala de Controle) aparece como ⚠ risco desde os 60 dias.
const AP = require('./avisosPessoas');
const N = require('./notificacoes');
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const dBR = (d) => String(d).slice(0, 10).split('-').reverse().join('/');
const ORDEM = { '60': 1, '30': 2, vencido: 3 };

function textos(x) {
  const venc = x.marco === 'vencido';
  return {
    titulo: venc ? `⛔ Férias vencidas — ${x.nome}` : `🏖 Férias de ${x.nome} vencem em ${dBR(x.limite)}`,
    texto: venc ? `${x.a_programar} dia(s) do período ${x.rotulo} passaram do limite legal sem gozo (pagamento em dobro).` : `${x.a_programar} dia(s) do período ${x.rotulo} ainda sem programar${x.sair_ate ? ` — a saída tem de ser até ${dBR(x.sair_ate)}` : ''}.`,
  };
}

async function enviar(supabase, { tenantId = null, enviarEmail = require('./emailService').enviarEmailCotacao } = {}) {
  const r = { avisos: 0, emails: 0 };
  let tenants = tenantId ? [String(tenantId)] : null;
  if (!tenants) { const a = (await q(supabase.from('colaboradores').select('tenant_id, admissao')).catch(() => [])).filter((c) => c.admissao).map((c) => String(c.tenant_id)); tenants = [...new Set(a)]; }
  for (const t of tenants) {
    try {
      const itens = await AP.feriasAVencer(supabase, t); if (!itens.length) continue;
      const env = await q(supabase.from('avisos_enviados').select('*').eq('tenant_id', t)).catch(() => null); if (!env) continue; // sem a 029: não avisa
      const ja = new Map(); for (const a of env) { if (!ja.has(a.chave)) ja.set(a.chave, []); ja.get(a.chave).push(a.marco); }
      const gestores = (await N.usuariosComPerfis(supabase, t, ['gestor'])).map((u) => u.id);
      const colabs = new Map((await q(supabase.from('colaboradores').select('*').eq('tenant_id', t))).map((c) => [String(c.id), c]));
      for (const x of itens) {
        const chave = `ferias_func:${x.colaborador_id}:${x.limite}`;
        if ((ja.get(chave) || []).some((m) => ORDEM[m] >= ORDEM[x.marco])) continue;
        const { titulo, texto } = textos(x); const link = { tela: 'pessoas', aba: 'ferias' };
        await N.avisarUsuarios(supabase, t, gestores, { tipo: 'ferias_vencendo', titulo, texto, link, chave: `${chave}:${x.marco}` });
        const c = colabs.get(String(x.colaborador_id)) || {};
        if (c.usuario_id) await N.criar(supabase, { tipo: 'usuario', id: String(c.usuario_id) }, { tenantId: t, tipo: 'ferias_vencendo', titulo: x.marco === 'vencido' ? '⛔ Suas férias passaram do prazo' : `🏖 Suas férias vencem em ${dBR(x.limite)}`, texto: `${texto} Combine as datas com o seu gestor.`, link: {}, chave: `${chave}:${x.marco}` }).catch(() => null);
        if (c.email && x.marco !== 'vencido') {
          try { await enviarEmail(c.email, `🏖 Suas férias vencem em ${dBR(x.limite)}`, `<p>Olá, ${String(c.nome).split(' ')[0]}!</p><p>Você tem <b>${x.a_programar} dia(s) de férias</b> do período ${x.rotulo} ainda sem data marcada. Pela lei, elas precisam ser gozadas até <b>${dBR(x.limite)}</b>${x.sair_ate ? ` — ou seja, a saída tem de ser até <b>${dBR(x.sair_ate)}</b>` : ''}.</p><p>Combine as datas com o seu gestor.</p>`); r.emails++; } catch (e) { console.error('❌ [avisos-ferias] e-mail:', e.message); }
        }
        await AP.registrar(supabase, t, [{ chave, marco: x.marco }], gestores.length + (c.usuario_id ? 1 : 0));
        r.avisos++;
      }
    } catch (e) { console.error(`❌ [avisos-ferias] tenant ${t}:`, e.message); }
  }
  return r;
}
module.exports = { enviar, textos };
