// backend/services/recomendacoesEmail.js
//
// E-mails de recomendação do Canal Spot — recurso do PLANO PRO do fornecedor.
//
//   • Alerta imediato: ao publicar uma demanda, avisa na hora os fornecedores
//     Pro para quem ela "Combina muito" (ou é urgente e combina).
//   • Resumo diário (7h): um e-mail por fornecedor Pro com as demandas abertas
//     que combinam com ele e que ainda não foram avisadas. Sem novidade = sem e-mail.
//
// Regras que valem sempre:
//   • Cada demanda é avisada no máximo UMA vez a cada fornecedor
//     (tabela recomendacoes_enviadas) — imediato e resumo nunca repetem.
//   • Cota diária própria (RECOMENDACOES_LIMITE_DIA, padrão 60): recomendação
//     nunca consome a cota do Resend que os e-mails transacionais (cotação, OC,
//     NC) precisam. Plano grátis do Resend = 100 e-mails/dia.
//   • Todo e-mail tem link de descadastro (LGPD — e-mail de oferta) no rodapé e
//     no cabeçalho List-Unsubscribe (botão nativo do Gmail/Outlook). Sem
//     BACKEND_URL configurada, NENHUM e-mail de recomendação sai.
//   • Cada demanda tem botão que abre ela direto no portal (?spot=<id>).
//   • Falha de e-mail nunca quebra a criação da demanda.
//
// E-mails transacionais (pedido de cotação, OC, NC, "você foi escolhido")
// NÃO passam por aqui: são grátis e continuam como estão.

const { DB, supabase } = require('../db');
const { enviarEmailRecomendacao } = require('./emailService');
const { emailFornecedor } = require('./fornecedoresVisiveis');
const { contextoDoFornecedor, pontuarDemanda } = require('./matchSpot');

const LIMITE_DIA = Math.max(0, parseInt(process.env.RECOMENDACOES_LIMITE_DIA, 10) || 60);
const MAX_DEMANDAS_NO_RESUMO = 10;
const DIAS_JANELA_RESUMO = 7;            // demanda aberta há até 7 dias ainda entra no resumo
const PAUSA_ENTRE_ENVIOS_MS = 600;       // Resend: ~2 requisições/segundo

const FAIXA_TEXTO = { combina_muito: '⭐ Combina muito', combina: 'Combina', pode_interessar: 'Pode interessar' };
const FAIXA_COR = { combina_muito: '#16a34a', combina: '#2563eb', pode_interessar: '#64748b' };

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (t) => String(t == null ? '' : t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const semBarraFinal = (u) => String(u || '').replace(/\/+$/, '');

// ─── Configuração obrigatória ────────────────────────────────────────────────
// Sem BACKEND_URL não há link de descadastro → não envia (LGPD).
function configuracaoOk() {
  if (!semBarraFinal(process.env.BACKEND_URL)) {
    console.error('❌ [recomendacoes] BACKEND_URL não configurada — e-mails de recomendação NÃO enviados (sem link de descadastro).');
    return false;
  }
  return true;
}

function linkDescadastroDe(fornecedor) {
  return `${semBarraFinal(process.env.BACKEND_URL)}/api/recomendacoes/descadastrar/${fornecedor.descadastro_token}`;
}

function linkDemanda(demanda) {
  const portal = semBarraFinal(process.env.FRONTEND_URL);
  return portal ? `${portal}/?spot=${encodeURIComponent(demanda.id)}` : null;
}

// ─── Plano ───────────────────────────────────────────────────────────────────
function temPlanoPro(f, agora = new Date()) {
  if (!f || f.plano !== 'pro') return false;
  if (f.plano_valido_ate && new Date(f.plano_valido_ate) < agora) return false;
  return true;
}

// Pode receber e-mail de recomendação? (Pro + não se descadastrou + tem e-mail)
function podeReceberRecomendacao(f) {
  return temPlanoPro(f) && f.recomendacoes_email !== false && !!emailFornecedor(f) && !!f.descadastro_token;
}

// ─── Cota diária ─────────────────────────────────────────────────────────────
function inicioDoDiaBrasilISO(agora = new Date()) {
  // meia-noite em Brasília (UTC-3, sem horário de verão desde 2019)
  const brt = new Date(agora.getTime() - 3 * 3600 * 1000);
  const meiaNoiteBrtEmUtc = Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate()) + 3 * 3600 * 1000;
  return new Date(meiaNoiteBrtEmUtc).toISOString();
}

async function enviadosHoje() {
  const { count, error } = await supabase
    .from('recomendacoes_email_log')
    .select('id', { count: 'exact', head: true })
    .gte('enviado_em', inicioDoDiaBrasilISO());
  if (error) throw error;
  return count || 0;
}

// ─── Controle de "já avisado" ────────────────────────────────────────────────
async function demandasJaAvisadas(fornecedorId) {
  const linhas = (await DB.select('recomendacoes_enviadas', { fornecedor_id: fornecedorId })) || [];
  return new Set(linhas.map((l) => String(l.demanda_id)));
}

async function registrarEnvio(fornecedorId, demandaIds, tipo) {
  for (const demandaId of demandaIds) {
    await DB.insert('recomendacoes_enviadas', { fornecedor_id: fornecedorId, demanda_id: demandaId, tipo });
  }
  await DB.insert('recomendacoes_email_log', { fornecedor_id: fornecedorId, tipo, qtd_demandas: demandaIds.length });
}

// ─── HTML do e-mail ──────────────────────────────────────────────────────────
function cartaoDemanda(item) {
  const { demanda: d, match: m, empresa } = item;
  const linha2 = [d.descricao_equipamento, d.marca_modelo, d.part_number ? `PN ${d.part_number}` : null]
    .filter(Boolean).map(esc).join(' · ');
  const motivos = (m.motivos || []).map((x) =>
    `<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 8px;border-radius:10px;background:#f1f5f9;color:#475569;font-size:12px;">✓ ${esc(x.texto)}</span>`
  ).join('');
  return `
    <div style="border:1px solid #e2e8f0;border-left:4px solid ${FAIXA_COR[m.faixa] || '#64748b'};border-radius:8px;padding:12px 14px;margin:0 0 10px;">
      <div style="font-size:11px;color:#2563eb;font-family:monospace;">${esc(d.numero || '')}${d.urgencia === 'alta' ? ' &nbsp;<b style="color:#dc2626;">URGENTE</b>' : ''}</div>
      <div style="font-size:15px;font-weight:700;color:#0f172a;margin:2px 0;">${esc(d.componente)}</div>
      <div style="font-size:13px;color:#475569;">${linha2}</div>
      <div style="font-size:12px;color:#475569;margin-top:4px;">
        ${empresa ? `🏢 ${esc(empresa)} · ` : ''}${d.uf ? `📍 ${esc(d.uf)} · ` : ''}${esc(d.quantidade)} unidade(s)
      </div>
      <div style="margin-top:6px;"><b style="font-size:12px;color:${FAIXA_COR[m.faixa] || '#64748b'};">${FAIXA_TEXTO[m.faixa] || ''}</b></div>
      <div style="margin-top:4px;">${motivos}</div>
      ${linkDemanda(d) ? `
      <div style="margin-top:10px;">
        <a href="${esc(linkDemanda(d))}" style="color:#2563eb;font-weight:700;font-size:13px;text-decoration:none;">Ver e responder →</a>
      </div>` : ''}
    </div>`;
}

// Versão texto puro (ajuda a não cair no spam e aparece em leitores sem HTML)
function textoDoEmail({ titulo, nome, tipo, itens, linkDescadastro }) {
  const linhas = [
    titulo.toUpperCase(),
    '',
    `Olá, ${nome}.`,
    tipo === 'imediato'
      ? 'Acabou de ser publicada uma demanda com o perfil da sua empresa. Quem responde primeiro tem mais chance.'
      : 'Estas são as oportunidades em aberto que combinam com o que você fornece.',
    '',
  ];
  for (const { demanda: d, match: m, empresa } of itens) {
    linhas.push(`${d.numero || ''}${d.urgencia === 'alta' ? ' — URGENTE' : ''}`);
    linhas.push(`${d.componente}`);
    linhas.push([d.descricao_equipamento, d.marca_modelo, d.part_number ? `PN ${d.part_number}` : null].filter(Boolean).join(' · '));
    linhas.push([empresa, d.uf, `${d.quantidade} unidade(s)`].filter(Boolean).join(' · '));
    linhas.push(`${(FAIXA_TEXTO[m.faixa] || '').replace('⭐ ', '')}: ${(m.motivos || []).map((x) => x.texto).join('; ')}`);
    if (linkDemanda(d)) linhas.push(`Ver e responder: ${linkDemanda(d)}`);
    linhas.push('');
  }
  linhas.push('—');
  linhas.push('Você recebe este e-mail porque sua empresa tem o plano Pro do QuotaFlow.');
  linhas.push(`Não quer mais receber recomendações? ${linkDescadastro}`);
  return linhas.join('\n');
}

// Assunto começando pela demanda mais importante
function assuntoDoEmail(tipo, itens) {
  const primeiro = itens[0];
  const estrela = primeiro.match.faixa === 'combina_muito' ? '⭐ ' : '';
  const urgente = primeiro.demanda.urgencia === 'alta' ? 'URGENTE: ' : '';
  if (tipo === 'imediato' || itens.length === 1) {
    return `${estrela}${urgente}${primeiro.demanda.componente} — demanda spot que combina com você`;
  }
  const outras = itens.length - 1;
  return `${estrela}${urgente}${primeiro.demanda.componente} e mais ${outras} ${outras === 1 ? 'demanda que combina' : 'demandas que combinam'} com você`;
}

function montarEmail({ fornecedor, itens, tipo }) {
  const urlPortal = semBarraFinal(process.env.FRONTEND_URL) || '';
  const linkDescadastro = linkDescadastroDe(fornecedor);
  const nome = fornecedor.nome_fantasia || fornecedor.nome || 'fornecedor';
  const titulo = tipo === 'imediato'
    ? 'Nova demanda que combina muito com você'
    : `${itens.length} ${itens.length === 1 ? 'demanda que combina' : 'demandas que combinam'} com você`;
  const assunto = assuntoDoEmail(tipo, itens);

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
    <div style="font-size:12px;color:#64748b;letter-spacing:.08em;">CANAL SPOT · QUOTAFLOW</div>
    <h2 style="margin:6px 0 4px;font-size:20px;">${esc(titulo)}</h2>
    <p style="margin:0 0 14px;font-size:14px;color:#475569;">
      Olá, ${esc(nome)}. ${tipo === 'imediato'
        ? 'Acabou de ser publicada uma demanda com o perfil da sua empresa. Quem responde primeiro tem mais chance.'
        : 'Estas são as oportunidades em aberto que combinam com o que você fornece.'}
    </p>
    ${itens.map(cartaoDemanda).join('')}
    ${urlPortal ? `
    <div style="text-align:center;margin:18px 0;">
      <a href="${esc(urlPortal)}" style="background:#2563eb;color:#fff;text-decoration:none;padding:11px 22px;border-radius:6px;font-weight:700;font-size:14px;display:inline-block;">
        Abrir o Canal Spot
      </a>
    </div>` : ''}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:18px 0 10px;">
    <p style="font-size:11px;color:#94a3b8;line-height:1.5;margin:0;">
      Você recebe este e-mail porque sua empresa tem o plano Pro do QuotaFlow e cadastrou o perfil de atuação.
      Pedidos de cotação e ordens de compra continuam chegando normalmente.
      <br><a href="${esc(linkDescadastro)}" style="color:#64748b;text-decoration:underline;">Não quero mais receber recomendações por e-mail</a>
    </p>
  </div>`;
  const texto = textoDoEmail({ titulo, nome, tipo, itens, linkDescadastro });
  return { assunto, html, texto, linkDescadastro };
}

// ─── Núcleo comum ────────────────────────────────────────────────────────────
async function fornecedoresPro() {
  const lista = (await DB.select('fornecedores', { plano: 'pro' })) || [];
  return lista.filter(podeReceberRecomendacao);
}

async function nomeEmpresa(cache, tenantId) {
  const k = String(tenantId);
  if (!(k in cache)) cache[k] = await DB.selectOne('tenants', { id: tenantId });
  return cache[k];
}

// ─── Alerta imediato (chamado ao criar demanda — não bloqueia a resposta) ────
async function enviarAlertaImediato(demanda) {
  const resultado = { avaliados: 0, enviados: 0, cota_esgotada: false };
  if (!demanda || demanda.status === 'encerrada') return resultado;
  if (!configuracaoOk()) return { ...resultado, erro: 'BACKEND_URL não configurada' };

  const tenant = await DB.selectOne('tenants', { id: demanda.tenant_id });
  for (const f of await fornecedoresPro()) {
    resultado.avaliados++;
    const ctx = await contextoDoFornecedor(DB, f.id);
    const match = pontuarDemanda(demanda, ctx, tenant);
    if (!match) continue;
    const merece = match.faixa === 'combina_muito' || demanda.urgencia === 'alta';
    if (!merece) continue; // fica para o resumo diário
    if ((await demandasJaAvisadas(f.id)).has(String(demanda.id))) continue;
    if ((await enviadosHoje()) >= LIMITE_DIA) { resultado.cota_esgotada = true; break; }

    const email = montarEmail({ fornecedor: f, tipo: 'imediato', itens: [{ demanda, match, empresa: tenant?.nome }] });
    try {
      await enviarEmailRecomendacao({ para: emailFornecedor(f), ...email });
      await registrarEnvio(f.id, [demanda.id], 'imediato');
      resultado.enviados++;
    } catch (e) {
      console.error(`❌ [recomendacoes] alerta imediato para fornecedor ${f.id}:`, e.message || e);
    }
    await esperar(PAUSA_ENTRE_ENVIOS_MS);
  }
  return resultado;
}

// ─── Resumo diário (chamado pelo agendador) ──────────────────────────────────
async function enviarResumoDiario() {
  const resultado = { fornecedores_pro: 0, enviados: 0, sem_novidade: 0, cota_esgotada: false, limite_dia: LIMITE_DIA };
  if (!configuracaoOk()) return { ...resultado, erro: 'BACKEND_URL não configurada' };
  const limiteData = Date.now() - DIAS_JANELA_RESUMO * 24 * 3600 * 1000;
  const abertas = ((await DB.select('demandas_spot', { status: 'aberta' })) || [])
    .filter((d) => new Date(d.criado_em || 0).getTime() >= limiteData);
  const tenants = {};
  const pros = await fornecedoresPro();
  resultado.fornecedores_pro = pros.length;

  for (const f of pros) {
    const ctx = await contextoDoFornecedor(DB, f.id);
    if (!ctx.temPerfil) { resultado.sem_novidade++; continue; }
    const jaAvisadas = await demandasJaAvisadas(f.id);
    const meusInteresses = new Set(((await DB.select('interesses_spot', { fornecedor_id: f.id })) || []).map((i) => String(i.demanda_id)));

    const itens = [];
    for (const d of abertas) {
      if (jaAvisadas.has(String(d.id)) || meusInteresses.has(String(d.id))) continue;
      const tenant = await nomeEmpresa(tenants, d.tenant_id);
      const match = pontuarDemanda(d, ctx, tenant);
      if (match) itens.push({ demanda: d, match, empresa: tenant?.nome });
    }
    if (!itens.length) { resultado.sem_novidade++; continue; }
    if ((await enviadosHoje()) >= LIMITE_DIA) { resultado.cota_esgotada = true; break; }

    itens.sort((a, b) => b.match.pontos - a.match.pontos);
    const doEmail = itens.slice(0, MAX_DEMANDAS_NO_RESUMO);
    const email = montarEmail({ fornecedor: f, tipo: 'resumo', itens: doEmail });
    try {
      await enviarEmailRecomendacao({ para: emailFornecedor(f), ...email });
      await registrarEnvio(f.id, doEmail.map((i) => i.demanda.id), 'resumo');
      resultado.enviados++;
    } catch (e) {
      console.error(`❌ [recomendacoes] resumo para fornecedor ${f.id}:`, e.message || e);
    }
    await esperar(PAUSA_ENTRE_ENVIOS_MS);
  }
  console.log('📧 [recomendacoes] resumo diário:', JSON.stringify(resultado));
  return resultado;
}

// ─── Descadastro (link do e-mail) ────────────────────────────────────────────
async function descadastrarPorToken(token) {
  if (!/^[0-9a-f-]{36}$/i.test(String(token || ''))) return null;
  const f = await DB.selectOne('fornecedores', { descadastro_token: token });
  if (!f) return null;
  await DB.update('fornecedores', f.id, { recomendacoes_email: false });
  return f;
}

module.exports = {
  temPlanoPro,
  podeReceberRecomendacao,
  enviarAlertaImediato,
  enviarResumoDiario,
  descadastrarPorToken,
  montarEmail,
  inicioDoDiaBrasilISO,
};
