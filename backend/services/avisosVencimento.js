// backend/services/avisosVencimento.js — etapa 12c.1
//
// E-mail diário de aviso de vencimento de documentos (👷 Pessoas / documentos).
//
//   • Marcos: faltando 30, 15 e 5 dias, e uma vez quando vence.
//     Cada marco de cada documento é avisado no máximo UMA vez (tabela documento_avisos).
//     Se o servidor ficou dias fora, manda só o marco mais urgente (não manda 30+15+5 juntos).
//   • Destinatários: usuários ativos admin ou gestor do tenant + o responsável do documento.
//   • Um e-mail por pessoa por dia, com a lista de documentos. Sem novidade = sem e-mail.
//   • Documento substituído (renovado) e colaborador desligado não entram.
//   • 12d.3: o mesmo e-mail traz também troca de EPI, CA de EPI e documento exigido não cadastrado
//     (services/avisosPessoas.js — só para admin e gestor; controle em avisos_enviados).
//   • Roda junto com o resumo diário das 7h (POST /api/recomendacoes/resumo-diario
//     e cron interno). Falha aqui nunca quebra o resumo do Canal Spot.
//
// Regras do backend: sem DB.raw; ids com String(); filtros sem null.

const { supabase } = require('../db');
const { enviarEmailCotacao } = require('./emailService');
const { listarDocumentos } = require('./documentos');
const AP = require('./avisosPessoas'); // etapa 12d.3

const PERFIS_AVISO = ['admin', 'gestor'];
const PAUSA_ENTRE_ENVIOS_MS = 600; // Resend: ~2 requisições/segundo
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (t) => String(t == null ? '' : t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dataBR = (d) => { const [a, m, dd] = String(d).slice(0, 10).split('-'); return `${dd}/${m}/${a}`; };

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }

/** Marco que cabe hoje para quantos dias faltam (null = nada a avisar) */
function marcoPara(dias) {
  if (dias == null) return null;
  if (dias < 0) return 'vencido';
  if (dias <= 5) return '5';
  if (dias <= 15) return '15';
  if (dias <= 30) return '30';
  return null;
}
const ORDEM = { '30': 1, '15': 2, '5': 3, vencido: 4 };

/** Decide o que avisar: só se o marco atual ainda não foi avisado e nenhum mais urgente já foi */
function pendentes(docs, avisados) {
  const out = [];
  for (const d of docs) {
    if (d.substituido_por || d.colaborador_desligado || !d.vence_em) continue;
    const m = marcoPara(d.dias);
    if (!m) continue;
    const ja = avisados.get(String(d.id)) || new Set();
    if ([...ja].some((x) => ORDEM[x] >= ORDEM[m])) continue;
    out.push({ ...d, marco: m });
  }
  return out;
}

function textoPrazo(d) {
  if (d.dias < 0) return `<b style="color:#dc2626">vencido há ${-d.dias} dia(s)</b>`;
  if (d.dias === 0) return '<b style="color:#dc2626">vence hoje</b>';
  return `<b style="color:${d.dias <= 5 ? '#dc2626' : d.dias <= 15 ? '#d97706' : '#2563eb'}">vence em ${d.dias} dia(s)</b>`;
}

function montarEmail(nome, docs, extras = []) {
  const portal = String(process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  const linhas = docs.map((d) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb">${esc(d.tipo_nome || 'Documento')}${d.numero ? ' nº ' + esc(d.numero) : ''}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb">${esc(d.alvo_nome)}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb">${dataBR(d.vence_em)}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb">${textoPrazo(d)}</td>
    </tr>`).join('');
  return `
  <div style="font-family:Arial,sans-serif;max-width:640px;color:#111827">
    <h2 style="margin:0 0 8px">${docs.length ? '📄 Documentos vencendo' : '👷 Avisos de pessoas'}</h2>
    <p>Olá${nome ? ', ' + esc(nome) : ''}. ${docs.length ? 'Estes documentos precisam de atenção:' : 'Estes itens precisam de atenção:'}</p>
    ${docs.length ? `<table style="border-collapse:collapse;width:100%;font-size:14px">
      <tr style="background:#f3f4f6;text-align:left">
        <th style="padding:8px">Documento</th><th style="padding:8px">De</th><th style="padding:8px">Vencimento</th><th style="padding:8px">Prazo</th>
      </tr>${linhas}
    </table>` : ''}
    ${AP.secoesHtml(extras)}
    ${portal ? `<p style="margin-top:16px"><a href="${esc(portal)}" style="background:#14b8a6;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Abrir o QuotaFlow</a></p>` : ''}
    <p style="font-size:12px;color:#6b7280;margin-top:16px">Documentos: 👷 Pessoas → Documentos → Renovar. EPI: 👷 Pessoas → 🦺 EPI → Gestão de funcionários / Estoque. Você recebe este aviso por ser admin/gestor ou responsável pelo documento.</p>
  </div>`;
}

async function destinatariosDoTenant(tenantId) {
  const usuarios = (await q(supabase.from('usuarios').select('*').eq('tenant_id', tenantId)))
    .filter((u) => u.ativo !== false && u.ativo !== 0 && u.email);
  let perfisN = [];
  if (usuarios.length) {
    try { perfisN = await q(supabase.from('usuario_perfis').select('*').in('usuario_id', usuarios.map((u) => u.id))); }
    catch (e) { console.warn('⚠️ [avisos] usuario_perfis indisponível:', e.message); }
  }
  const perfisDe = new Map();
  for (const p of perfisN) {
    const k = String(p.usuario_id);
    if (!perfisDe.has(k)) perfisDe.set(k, new Set());
    perfisDe.get(k).add(p.perfil_codigo);
  }
  const porId = new Map(usuarios.map((u) => [String(u.id), u]));
  const gestores = usuarios.filter((u) => PERFIS_AVISO.includes(u.perfil) || [...(perfisDe.get(String(u.id)) || [])].some((p) => PERFIS_AVISO.includes(p)));
  return { porId, gestores };
}

/** Roda para todos os tenants. Devolve contagem. agora/enviar injetáveis para teste. */
async function enviarAvisosVencimento({ agora = new Date(), enviar = enviarEmailCotacao, pausaMs = PAUSA_ENTRE_ENVIOS_MS } = {}) {
  const r = { tenants: 0, documentos: 0, pessoas: 0, emails: 0, falhas: 0 };
  // tenants com documento com vencimento + (12d.3) tenants com colaborador ativo
  const comVenc = await q(supabase.from('documentos').select('id, tenant_id, vence_em'));
  let comColab = [];
  try { comColab = (await q(supabase.from('colaboradores').select('id, tenant_id, situacao'))).filter((c) => c.situacao !== 'desligado'); }
  catch (e) { console.warn('⚠️ [avisos] colaboradores indisponível:', e.message); }
  const tenantIds = [...new Set([...comVenc.filter((d) => d.vence_em).map((d) => String(d.tenant_id)), ...comColab.map((c) => String(c.tenant_id))])];

  for (const tenantId of tenantIds) {
    try {
      const docs = await listarDocumentos(supabase, tenantId, { agora });
      const ids = docs.map((d) => d.id);
      const avisos = ids.length ? await q(supabase.from('documento_avisos').select('*').in('documento_id', ids)) : [];
      const avisados = new Map();
      for (const a of avisos) {
        const k = String(a.documento_id);
        if (!avisados.has(k)) avisados.set(k, new Set());
        avisados.get(k).add(a.marco);
      }
      const lista = pendentes(docs, avisados);
      let extras = [];
      try { extras = await AP.pendentes(supabase, tenantId, agora); }
      catch (e) { console.error(`❌ [avisos-pessoas] tenant ${tenantId}:`, e.message); }
      if (!lista.length && !extras.length) continue;
      r.tenants++;

      const { porId, gestores } = await destinatariosDoTenant(tenantId);
      const caixa = new Map(); // email -> { nome, docs, extras }
      const por = (u, d) => {
        const k = String(u.email).trim().toLowerCase();
        if (!caixa.has(k)) caixa.set(k, { email: u.email, nome: u.nome, docs: [], extras: [] });
        const c = caixa.get(k);
        if (!c.docs.some((x) => String(x.id) === String(d.id))) c.docs.push(d);
      };
      const contagem = new Map();
      for (const d of lista) {
        const alvo = [...gestores];
        const resp = d.responsavel_id != null ? porId.get(String(d.responsavel_id)) : null;
        if (resp) alvo.push(resp);
        for (const u of alvo) por(u, d);
        contagem.set(String(d.id), new Set(alvo.map((u) => String(u.email).toLowerCase())).size);
      }

      // 12d.3: avisos de pessoas vão para admin e gestor
      if (extras.length) for (const u of gestores) {
        const k = String(u.email).trim().toLowerCase();
        if (!caixa.has(k)) caixa.set(k, { email: u.email, nome: u.nome, docs: [], extras: [] });
        caixa.get(k).extras = extras;
      }
      let extrasEnviados = 0;

      const okDocs = new Set();
      for (const c of caixa.values()) {
        c.docs.sort((a, b) => a.dias - b.dias);
        const n = c.docs.length;
        const assunto = !n
          ? `👷 ${c.extras.length} aviso(s) de pessoas: EPI e documentos`
          : n === 1 && !c.extras.length
          ? `📄 ${c.docs[0].dias < 0 ? 'Documento vencido' : 'Documento vence em ' + c.docs[0].dias + ' dia(s)'}: ${c.docs[0].tipo_nome || ''} — ${c.docs[0].alvo_nome}`
          : `📄 ${n} documento(s) vencendo${c.extras.length ? ` + ${c.extras.length} aviso(s) de EPI/pessoas` : ' ou vencidos'}`;
        try {
          await enviar(c.email, assunto, montarEmail(c.nome, c.docs, c.extras));
          r.emails++;
          for (const d of c.docs) okDocs.add(String(d.id));
          if (c.extras.length) extrasEnviados++;
        } catch (e) {
          r.falhas++;
          console.error(`❌ [avisos] e-mail para ${c.email}:`, e.message || e);
        }
        if (pausaMs) await esperar(pausaMs);
      }

      // registra só o que saiu para alguém (se ninguém recebeu, tenta de novo amanhã)
      const registrar = lista.filter((d) => okDocs.has(String(d.id)))
        .map((d) => ({ documento_id: d.id, marco: d.marco, destinatarios: contagem.get(String(d.id)) || 0 }));
      if (registrar.length) {
        const { error } = await supabase.from('documento_avisos').upsert(registrar, { onConflict: 'documento_id,marco', ignoreDuplicates: true });
        if (error) console.error('❌ [avisos] registrar:', error.message);
      }
      r.documentos += registrar.length;
      if (extras.length && extrasEnviados) { await AP.registrar(supabase, tenantId, extras, extrasEnviados); r.pessoas += extras.length; }
      if (!caixa.size) console.warn(`⚠️ [avisos] tenant ${tenantId}: ${lista.length} documento(s) a avisar mas nenhum admin/gestor com e-mail`);
    } catch (e) {
      r.falhas++;
      console.error(`❌ [avisos] tenant ${tenantId}:`, e.message);
    }
  }
  console.log(`📄 [avisos] vencimento: ${r.documentos} documento(s), ${r.pessoas} aviso(s) de pessoas, ${r.emails} e-mail(s), ${r.falhas} falha(s)`);
  return r;
}

module.exports = { enviarAvisosVencimento, marcoPara, pendentes, montarEmail };
