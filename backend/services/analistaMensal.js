// backend/services/analistaMensal.js — etapa 18zk: ✉ RELATÓRIO MENSAL DO ANALISTA (rotina de inspeção) ao GESTOR
//   Dia 1, 7h: fecha o mês anterior (indicadores + achados por regra do 🧠 Analista) e, se a IA estiver ligada para a empresa,
//   o PARECER DO ANALISTA SÊNIOR escrito pela IA em cima desses dados. IA desligada/fora do ar → o e-mail sai igual, sem o parecer.
//   Só gestores (rotina não vai ao admin). Uma vez por mês por empresa (chave analista-mensal:AAAA-MM nas notificações).
const A = require('./analistaRotina');
const IA = require('./ia');
const N = require('./notificacoes');

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const escH = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeMes = (ym) => `${MESES[Number(ym.slice(5, 7)) - 1]}/${ym.slice(0, 4)}`;
const mesAnterior = (hoje) => { let [y, m] = hoje.slice(0, 7).split('-').map(Number); m--; if (!m) { m = 12; y--; } return `${y}-${String(m).padStart(2, '0')}`; };
const ultimoDia = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const frontendURL = () => String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/^FRONTEND_URL=/, '').replace(/\/+$/, '');
let enviarEmail = async (para, assunto, html) => require('./emailService').enviarEmailFornecedor(para, assunto, html);

const SISTEMA = `Você é o Analista Sênior de frota de uma empresa de transporte/locação de equipamentos pesados, escrevendo para o gestor.
Escreva em português do Brasil, direto e prático, no máximo 220 palavras, em 3 partes curtas com estes títulos exatos:
"Leitura do mês", "Riscos" e "Ações sugeridas" (até 4 ações numeradas, cada uma com o responsável sugerido).
Use SOMENTE os dados fornecidos; não invente números, nomes ou causas. Se os dados forem poucos, diga isso.
Não use markdown além de títulos em linha própria e listas simples.`;

/** monta o relatório do mês (ym = 'AAAA-MM' fechado) — { assunto, html, dados, ia } */
async function montar(supabase, tenantId, ym, { comIA = true } = {}) {
  const emp = (await q(supabase.from('tenants').select('*').eq('id', tenantId)).catch(() => []))[0] || {};
  const agora = new Date(`${ultimoDia(ym)}T23:00:00-03:00`);
  const d = await A.painel(supabase, tenantId, { meses: 12, agora });
  const mes = d.serie[d.serie.length - 1] || {}; const ant = d.serie[d.serie.length - 2] || {};
  const dados = { empresa: emp.nome_fantasia || emp.nome || emp.razao_social || '', mes: nomeMes(ym),
    cumprimento_mes: mes.pct, cumprimento_mes_anterior: ant.pct, previstas: mes.esperadas, cumpridas: mes.cumpridas, inspecoes_mes: mes.inspecoes, reprovadas_mes: mes.reprovadas,
    cumprimento_12m: d.total.pct, por_responsavel: d.responsavel.map((r) => ({ quem: r.responsavel === 'locatario' ? 'locatários' : 'equipe da empresa', pct: r.pct })),
    serie_12m: d.serie.map((m) => ({ mes: m.rotulo, pct: m.pct })), itens_que_mais_falham: d.falhas.slice(0, 5).map((f) => ({ item: f.rotulo, vezes: f.vezes, impediu: f.criticas, equipamentos: f.equipamentos })),
    reprovados_sem_liberacao: d.liberacao.pendentes.map((p) => ({ equipamento: p.equipamento_nome, dias: p.dias, reprovacoes: p.reprovacoes })), media_dias_liberacao: d.liberacao.media_dias,
    piores_equipamentos: d.equipamentos.slice(0, 5).map((e) => ({ equipamento: e.nome || e.tag, pct: e.pct, meses_abaixo: e.meses_abaixo, reprovacoes: e.reprovadas, os: e.os })),
    achados: d.achados.map((a) => `[${a.nivel}] ${a.texto}`) };
  let ia = { texto: null, motivo: 'não pedido' };
  if (comIA && (d.total.esperadas || mes.inspecoes)) ia = await IA.gerarTexto({ tenant: emp, sistema: SISTEMA, prompt: `Dados da rotina de inspeção (JSON):\n${JSON.stringify(dados)}\n\nEscreva o parecer de ${dados.mes}.`, max: 900 });
  else if (comIA) ia = { texto: null, motivo: 'sem rotina de inspeção no período' };
  const cor = (p) => (p == null ? '#666' : p >= 90 ? '#15803d' : p >= 70 ? '#b45309' : '#b91c1c');
  const pctTxt = (p) => (p == null ? '—' : `${p}%`);
  const dif = mes.pct != null && ant.pct != null ? mes.pct - ant.pct : null;
  const NIV = { alto: ['#b91c1c', '●'], medio: ['#b45309', '●'], bom: ['#15803d', '✓'] };
  const kpi = (rot, val, c, sub) => `<td style="padding:10px;border:1px solid #e5e7eb;border-radius:6px;vertical-align:top;width:25%"><div style="font-size:11px;color:#666">${rot}</div><div style="font-size:22px;font-weight:800;color:${c}">${val}</div><div style="font-size:11px;color:#666">${sub}</div></td>`;
  const parecer = ia.texto ? `<div style="margin:18px 0;padding:12px 14px;background:#f5f3ff;border-left:3px solid #6d28d9;border-radius:4px"><div style="font-weight:700;margin-bottom:6px">🧠 Parecer do Analista Sênior</div>
      <div style="white-space:pre-wrap">${escH(ia.texto)}</div><div style="font-size:11px;color:#777;margin-top:8px">Texto escrito por IA (${escH(ia.nome || ia.provedor)}) a partir dos dados acima — confira antes de decidir.</div></div>` : '';
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111;font-size:14px;line-height:1.55">
    <div style="font-weight:700;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:14px">${escH(dados.empresa)} · 🧠 Analista da rotina de inspeção</div>
    <p style="font-size:16px;margin:0 0 12px"><b>Relatório de ${escH(dados.mes)}</b></p>
    <table style="width:100%;border-collapse:separate;border-spacing:6px"><tr>
      ${kpi('CUMPRIMENTO NO MÊS', pctTxt(mes.pct), cor(mes.pct), dif == null ? `${mes.cumpridas || 0} de ${mes.esperadas || 0} previstas` : `${dif >= 0 ? '▲' : '▼'} ${Math.abs(dif)} pts vs mês anterior`)}
      ${kpi('INSPEÇÕES', mes.inspecoes || 0, '#111', `${mes.reprovadas || 0} reprovada(s)`)}
      ${kpi('SEM LIBERAÇÃO', d.liberacao.pendentes.length, d.liberacao.pendentes.length ? '#b91c1c' : '#666', 'equipamento(s) reprovado(s)')}
      ${kpi('12 MESES', pctTxt(d.total.pct), cor(d.total.pct), 'cumprimento acumulado')}
    </tr></table>
    <div style="margin:16px 0 6px;font-weight:700">🔎 O que o analista viu</div>
    ${d.achados.length ? d.achados.map((a) => `<div style="padding:3px 0"><span style="color:${NIV[a.nivel][0]}">${NIV[a.nivel][1]}</span> ${escH(a.texto)}</div>`).join('') : '<div style="color:#666">Nada fora do normal no período.</div>'}
    ${parecer}
    ${d.falhas.length ? `<div style="margin:16px 0 6px;font-weight:700">🔧 Itens que mais falham (12 meses)</div>${d.falhas.slice(0, 5).map((f) => `<div style="padding:2px 0"><b>${f.vezes}×</b> ${escH(f.rotulo)} <span style="color:#666;font-size:12px">— ${escH(f.equipamentos.join(', '))}</span></div>`).join('')}` : ''}
    <p style="margin:22px 0"><a href="${frontendURL()}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:700">Abrir 🔍 Inspeções → 🧠 Analista</a></p>
    <div style="font-size:11px;color:#888">E-mail mensal automático do QuotaFlow (dia 1, 7h) para os gestores.</div></div>`;
  return { assunto: `🧠 Rotina de inspeção — ${dados.mes}: ${pctTxt(mes.pct)} de cumprimento${d.liberacao.pendentes.length ? ` · ${d.liberacao.pendentes.length} sem liberação` : ''}`, html, dados, ia: { usada: !!ia.texto, motivo: ia.motivo || null, nome: ia.nome || null } };
}

/** envia o relatório do mês aos gestores da empresa (forcar = reenviar pela tela) */
async function enviar(supabase, tenantId, ym, { forcar = false } = {}) {
  const chave = `analista-mensal:${ym}`;
  if (!forcar) { const ja = await q(supabase.from('notificacoes').select('*').eq('tenant_id', String(tenantId)).eq('chave', chave)).catch(() => []); if (ja.length) return { ja_enviado: true }; }
  const gestores = (await N.usuariosComPerfis(supabase, tenantId, ['gestor'])).filter((u) => u.email);
  if (!gestores.length) return { enviados: 0, motivo: 'sem gestor com e-mail' };
  const r = await montar(supabase, tenantId, ym);
  let n = 0; for (const u of gestores) { try { await enviarEmail(u.email, r.assunto, r.html); n++; } catch (e) { console.error('⚠️ [analista] e-mail não enviado:', u.email, e?.message || e); } }
  await N.avisarUsuarios(supabase, tenantId, gestores.map((u) => u.id), { tipo: 'analista_mensal', chave, titulo: r.assunto, texto: `Relatório de ${nomeMes(ym)} enviado por e-mail${r.ia.usada ? ' com o parecer do Analista Sênior (IA)' : ''}.`, link: { tela: 'inspecoes' } }).catch(() => 0);
  return { enviados: n, ia: r.ia };
}

/** cron dia 1, 7h: todas as empresas com rotina de inspeção */
async function enviarMensal(supabase, agora = new Date()) {
  const hoje = require('./rotinasInspecao').hojeBR(agora); const ym = mesAnterior(hoje); const out = [];
  const rots = await q(supabase.from('equipamento_rotinas').select('*')).catch(() => []);
  for (const t of [...new Set(rots.map((r) => String(r.tenant_id)))]) { try { out.push({ tenant: t, ...(await enviar(supabase, t, ym)) }); } catch (e) { console.error('⚠️ [analista mensal]', t, e.message); } }
  return out;
}

module.exports = { montar, enviar, enviarMensal, mesAnterior, nomeMes, SISTEMA, _definirEnvio: (fn) => { enviarEmail = fn; } };
