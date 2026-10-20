// backend/services/avisosPessoas.js — etapa 12d.3
//
// Avisos de Pessoas que entram no MESMO e-mail diário dos documentos (services/avisosVencimento.js):
//   • epi_troca  — EPI em uso com troca em até 15 dias ('15') e quando vence ('vencido')
//   • epi_ca     — CA do EPI do estoque a 30 dias ('30') e vencido ('vencido'); renovar o CA (nova data) reinicia
//   • doc_falta  — documento exigido pela função e ainda não cadastrado ('falta', uma vez por colaborador+tipo+função)
//   • trein_venc — treinamento exigido vencendo em 30 dias ('30') e vencido ('vencido')  (12e.1)
//   • trein_falta — treinamento exigido pela função e nunca feito ('falta', uma vez por colaborador+treinamento+função)
// Cada marco sai uma vez (tabela avisos_enviados). Se o servidor ficou dias fora, manda só o mais urgente.
// Destinatários: admin e gestor (o responsável do documento continua só nos avisos de documento).
// Sem as migrations 028/029, devolve lista vazia (nunca quebra o e-mail dos documentos).

const E = require('./epi');
const F = require('./funcoes');
const TR = require('./treinamentos'); // 12e.1

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const hojeBR = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600000).toISOString().slice(0, 10);
const diasAte = (de, ate) => Math.round((Date.parse(String(ate).slice(0, 10) + 'T00:00:00Z') - Date.parse(de + 'T00:00:00Z')) / 86400000);
const ORDEM = { falta: 1, '30': 1, '15': 2, vencido: 3 };

function marcoTroca(dias) { return dias == null ? null : dias < 0 ? 'vencido' : dias <= 15 ? '15' : null; }
function marcoCA(dias) { return dias == null ? null : dias < 0 ? 'vencido' : dias <= 30 ? '30' : null; }

/** Tudo que caberia avisar hoje no tenant (sem filtrar pelos já enviados) */
async function candidatos(supabase, tenantId, agora = new Date()) {
  const hoje = hojeBR(agora);
  const out = [];
  const colabs = (await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId))).filter((c) => c.situacao !== 'desligado');
  const ativos = new Map(colabs.map((c) => [String(c.id), c]));

  // EPI em uso → troca
  try {
    const its = (await q(supabase.from('epi_entrega_itens').select('*').eq('tenant_id', tenantId))).filter((i) => !i.devolvido_em && i.proxima_troca && ativos.has(String(i.colaborador_id)));
    for (const i of its) {
      const dias = diasAte(hoje, i.proxima_troca); const m = marcoTroca(dias);
      if (m) out.push({ categoria: 'epi_troca', chave: `epi_troca:${i.id}`, marco: m, dias, data: String(i.proxima_troca).slice(0, 10), titulo: `Troca de ${i.item_nome}`, de: ativos.get(String(i.colaborador_id)).nome });
    }
  } catch (e) { if (!/epi_entrega_itens/.test(String(e.message))) throw e; }

  // CA dos EPIs do estoque
  try {
    const epis = await E.listarEpiItens(supabase, tenantId, { agora });
    for (const e of epis.filter((x) => x.ca_validade && x.item_ativo)) {
      const m = marcoCA(e.ca_dias);
      if (m) out.push({ categoria: 'epi_ca', chave: `epi_ca:${e.id}:${String(e.ca_validade).slice(0, 10)}`, marco: m, dias: e.ca_dias, data: String(e.ca_validade).slice(0, 10), titulo: `CA ${e.ca || ''} — ${e.item_nome}`, de: 'Estoque de EPI' });
    }
  } catch (e) { if (!/epi_itens/.test(String(e.message))) throw e; }

  // documento exigido pela função e não cadastrado
  try {
    const fichas = await F.fichasDoTenant(supabase, tenantId, colabs);
    for (const c of colabs) {
      const f = fichas.get(String(c.id));
      if (!f?.funcao) continue;
      for (const it of f.itens.filter((x) => x.situacao === 'falta')) {
        out.push({ categoria: 'doc_falta', chave: `doc_falta:${c.id}:${it.codigo}:${f.funcao.id}`, marco: 'falta', dias: null, data: null, titulo: `${it.nome} não cadastrado`, de: `${c.nome} (${f.funcao.nome})` });
      }
    }
  } catch (e) { if (!/funcoes|funcao_id/.test(String(e.message))) throw e; }

  // 12e.1: treinamentos exigidos (vencendo/vencido e nunca feito)
  try {
    const base = await TR.carregarBase(supabase, tenantId);
    for (const c of colabs) {
      const st = TR.statusColaborador(c, base, hoje);
      for (const i of st.itens) {
        if (i.valido_ate && (i.situacao === 'vence' || i.situacao === 'vencido')) {
          const m = i.dias < 0 ? 'vencido' : '30';
          out.push({ categoria: 'trein_venc', chave: `trein:${c.id}:${i.codigo}:${String(i.valido_ate).slice(0, 10)}`, marco: m, dias: i.dias, data: String(i.valido_ate).slice(0, 10), titulo: i.nome, de: c.nome });
        } else if (i.situacao === 'falta' && st.funcao) {
          out.push({ categoria: 'trein_falta', chave: `trein_falta:${c.id}:${i.codigo}:${st.funcao.id}`, marco: 'falta', dias: null, data: null, titulo: `${i.nome} não realizado`, de: `${c.nome} (${st.funcao.nome})` });
        }
      }
    }
  } catch (e) { if (!/treinamento/.test(String(e.message))) throw e; }
  return out;
}

/** Candidatos que ainda não foram avisados neste marco (nem num mais urgente) */
async function pendentes(supabase, tenantId, agora = new Date()) {
  let enviados = [];
  try { enviados = await q(supabase.from('avisos_enviados').select('*').eq('tenant_id', tenantId)); }
  catch (e) { if (/avisos_enviados/.test(String(e.message))) return []; throw e; } // sem a 029: não avisa (evita repetir todo dia)
  const ja = new Map();
  for (const a of enviados) { if (!ja.has(a.chave)) ja.set(a.chave, new Set()); ja.get(a.chave).add(a.marco); }
  return (await candidatos(supabase, tenantId, agora)).filter((c) => ![...(ja.get(c.chave) || [])].some((m) => ORDEM[m] >= ORDEM[c.marco]));
}

async function registrar(supabase, tenantId, itens, destinatarios) {
  if (!itens.length) return;
  const { error } = await supabase.from('avisos_enviados').upsert(itens.map((i) => ({ tenant_id: tenantId, chave: i.chave, marco: i.marco, destinatarios })), { onConflict: 'tenant_id,chave,marco', ignoreDuplicates: true });
  if (error) console.error('❌ [avisos-pessoas] registrar:', error.message);
}

const TITULO = { epi_troca: '🦺 Troca de EPI', epi_ca: '🦺 CA de EPI', doc_falta: '📋 Documento exigido não cadastrado', trein_venc: '🎓 Treinamento vencendo', trein_falta: '🎓 Treinamento exigido não realizado' };
const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dataBR = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');
function prazo(i) {
  if (i.marco === 'falta') return '<b style="color:#d97706">cadastrar</b>';
  if (i.dias < 0) return `<b style="color:#dc2626">venceu há ${-i.dias} dia(s)</b>`;
  if (i.dias === 0) return '<b style="color:#dc2626">vence hoje</b>';
  return `<b style="color:${i.dias <= 15 ? '#d97706' : '#2563eb'}">em ${i.dias} dia(s)</b>`;
}
/** Seções HTML para o e-mail diário */
function secoesHtml(itens) {
  const cats = ['epi_troca', 'epi_ca', 'trein_venc', 'doc_falta', 'trein_falta'].filter((c) => itens.some((i) => i.categoria === c));
  return cats.map((c) => `
    <h3 style="margin:18px 0 6px;font-size:15px">${TITULO[c]}</h3>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      ${itens.filter((i) => i.categoria === c).sort((a, b) => (a.dias ?? 999) - (b.dias ?? 999)).map((i) => `
      <tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${esc(i.titulo)}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${esc(i.de)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${dataBR(i.data)}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${prazo(i)}</td></tr>`).join('')}
    </table>`).join('');
}

module.exports = { candidatos, pendentes, registrar, secoesHtml, marcoTroca, marcoCA };
