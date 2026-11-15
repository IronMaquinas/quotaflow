// backend/services/analistaRotina.js — etapa 18zj: 🧠 ANALISTA DA ROTINA DE INSPEÇÃO (Bloco 5, pedido do Marcony 02/11)
//   Gestão da rotina como indicador: cumprimento mês a mês (12 meses, tendência), por responsável (empresa × locatário) e por
//   equipamento; reprovações, itens que mais falham, tempo da reprovação até a liberação e OS abertas pelas inspeções.
//   ACHADOS por REGRAS (sem IA): o sistema funciona completo com a IA desligada. A IA (próxima etapa) só reescreve/cruza os
//   achados num parecer — se o provedor cair ou for trocado, nada se perde (decidido com o Marcony, 14/11).
const R = require('./rotinasInspecao');

const somaDias = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const diasEntre = (de, ate) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86400000);
const diaBR = (iso) => (iso ? new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10) : null);
const pct = (c, e) => (e ? Math.round((c / e) * 100) : null);
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ultimoDia = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const mesesAte = (hoje, n) => { const out = []; let [y, m] = hoje.slice(0, 7).split('-').map(Number); for (let i = 0; i < n; i++) { out.unshift(`${y}-${String(m).padStart(2, '0')}`); m--; if (!m) { m = 12; y--; } } return out; };
// 18zm: reprovação CORRIGIDA (resolvido na hora, resolução posterior ou OS do item concluída) conta como liberada na data da correção
//   — antes só uma nova inspeção aprovada liberava, e a luz de ré trocada pela OS-2026-0004 seguia "sem liberação" (Marcony, 15/11).
function corrigidaEm(i) {
  const imp = (i.respostas || []).filter((r) => r.status === 'nok' && (r.impede || i.resultado === 'reprovado'));
  if (!imp.length) return null; let ult = null;
  for (const r of imp) {
    const os = (i.os_abertas || []).find((o) => o.ponto_id === r.ponto_id && o.concluida_em);
    const d = r.resolvido ? diaBR(i.concluida_em) : r.resolucao_posterior ? diaBR(r.resolucao_posterior.em || r.resolucao_posterior.data || i.concluida_em) : os ? diaBR(os.concluida_em) : null;
    if (!d) return null; if (!ult || d > ult) ult = d;
  }
  return ult;
}
const rotMes = (ym) => `${MES[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`;

async function painel(supabase, tenantId, { meses = 12, agora = new Date() } = {}) {
  const hoje = R.hojeBR(agora); const base = await R.carregar(supabase, tenantId);
  const ms = mesesAte(hoje, Math.min(24, Math.max(3, Number(meses) || 12)));
  const de12 = `${ms[0]}-01`;
  const rots = base.rotinas.map((r) => { const loc = r.locacao_id ? base.locacoes.find((l) => String(l.id) === String(r.locacao_id)) : null;
    const fim = r.ativo === false ? (loc?.fim_real || null) : null; return (r.ativo === false && !fim) ? null : { r, fim, x: R.enriquecer(r, base, hoje) }; }).filter(Boolean);
  const ins = base.inspecoes.filter((i) => { const d = diaBR(i.concluida_em); return d && d >= de12 && d <= hoje; });

  // ── série mensal + por responsável + por equipamento
  const resp = { empresa: { esperadas: 0, cumpridas: 0 }, locatario: { esperadas: 0, cumpridas: 0 } };
  const eqs = new Map();
  const serie = ms.map((ym) => {
    const de = `${ym}-01`; const ate = ultimoDia(ym); let e = 0, c = 0;
    for (const { r, fim, x } of rots) {
      if (r.inicio > ate || (fim && fim < de)) continue;
      const k = R.cumprimento({ ...r, fim }, base.inspecoes, de, ate, hoje); if (!k.esperadas) continue;
      e += k.esperadas; c += k.cumpridas;
      const rr = resp[r.responsavel === 'locatario' ? 'locatario' : 'empresa']; rr.esperadas += k.esperadas; rr.cumpridas += k.cumpridas;
      const id = String(r.equipamento_id); const q = eqs.get(id) || { equipamento_id: r.equipamento_id, tag: x.equipamento_tag, nome: x.equipamento_nome, esperadas: 0, cumpridas: 0, meses: {} };
      q.esperadas += k.esperadas; q.cumpridas += k.cumpridas; const mm = q.meses[ym] || { e: 0, c: 0 }; mm.e += k.esperadas; mm.c += k.cumpridas; q.meses[ym] = mm; eqs.set(id, q);
    }
    const doMes = ins.filter((i) => diaBR(i.concluida_em).slice(0, 7) === ym);
    return { mes: ym, rotulo: rotMes(ym), esperadas: e, cumpridas: c, pct: pct(c, e), inspecoes: doMes.length, reprovadas: doMes.filter((i) => i.resultado === 'reprovado').length, parcial: ym === hoje.slice(0, 7) };
  });

  // ── reprovações, itens que falham, liberação, OS
  const porEq = (id) => base.inspecoes.filter((i) => String(i.equipamento_id) === String(id)).sort((a, b) => String(a.concluida_em).localeCompare(String(b.concluida_em)));
  const reprov = ins.filter((i) => i.resultado === 'reprovado');
  const liberacoes = reprov.map((i) => { const dep = porEq(i.equipamento_id).find((j) => String(j.concluida_em) > String(i.concluida_em) && j.resultado !== 'reprovado');
    const cor = corrigidaEm(i); const re = dep ? diaBR(dep.concluida_em) : null;
    const lib = [cor, re].filter(Boolean).sort()[0] || null; // o que veio primeiro: correção registrada ou nova inspeção aprovada
    return { inspecao_id: i.id, numero: i.numero, equipamento_id: i.equipamento_id, equipamento_nome: i.equipamento_nome, em: diaBR(i.concluida_em), liberado_em: lib, como: lib ? (lib === cor ? 'correcao' : 'reinspecao') : null,
      dias: lib ? diasEntre(diaBR(i.concluida_em), lib) : diasEntre(diaBR(i.concluida_em), hoje) }; });
  const lib = liberacoes.filter((l) => l.liberado_em);
  const falhas = new Map();
  for (const i of ins) for (const r of (i.respostas || [])) if (r.status === 'nok') {
    const k = String(r.rotulo || '').trim().toLowerCase(); if (!k) continue;
    const f = falhas.get(k) || { rotulo: r.rotulo, vezes: 0, criticas: 0, corrigidas: 0, equipamentos: new Set(), datas: [] }; f.vezes++; if (r.impede) f.criticas++;
    if (r.resolvido || r.resolucao_posterior || (i.os_abertas || []).some((o) => o.ponto_id === r.ponto_id && o.concluida_em)) f.corrigidas++;
    f.equipamentos.add(String(i.equipamento_nome)); f.datas.push(diaBR(i.concluida_em)); falhas.set(k, f);
  }
  const os = ins.reduce((s, i) => s + (i.os_abertas || []).length, 0);
  const porEquip = [...eqs.values()].map((q) => { const mi = base.inspecoes.filter((i) => String(i.equipamento_id) === String(q.equipamento_id) && diaBR(i.concluida_em) >= de12);
    return { equipamento_id: q.equipamento_id, tag: q.tag, nome: q.nome, esperadas: q.esperadas, cumpridas: q.cumpridas, pct: pct(q.cumpridas, q.esperadas),
      meses_abaixo: Object.values(q.meses).filter((m) => m.e && m.c < m.e).length, reprovadas: mi.filter((i) => i.resultado === 'reprovado').length, os: mi.reduce((s, i) => s + (i.os_abertas || []).length, 0) }; })
    .sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101) || b.reprovadas - a.reprovadas);

  const tot = serie.reduce((a, m) => ({ e: a.e + m.esperadas, c: a.c + m.cumpridas }), { e: 0, c: 0 });
  const d = {
    hoje, meses: ms.length, serie, total: { esperadas: tot.e, cumpridas: tot.c, pct: pct(tot.c, tot.e) },
    responsavel: Object.entries(resp).map(([k, v]) => ({ responsavel: k, nome: R.RESP_NOME[k], ...v, pct: pct(v.cumpridas, v.esperadas) })).filter((x) => x.esperadas),
    terceiros: { inspecoes: ins.filter((i) => i.executor_tipo === 'terceiro').length, total: ins.length },
    equipamentos: porEquip,
    falhas: [...falhas.values()].map((f) => ({ rotulo: f.rotulo, vezes: f.vezes, criticas: f.criticas, corrigidas: f.corrigidas, datas: f.datas.sort(), equipamentos: [...f.equipamentos].slice(0, 5), n_equipamentos: f.equipamentos.size })).sort((a, b) => b.vezes - a.vezes).slice(0, 10),
    // 18zm: dias de equipamento indisponível por reprovação (reprovação → correção/reinspeção) — impacto em disponibilidade/receita
    indisponivel: [...liberacoes.reduce((m, l) => { const k = String(l.equipamento_id); const v = m.get(k) || { equipamento_id: l.equipamento_id, equipamento: l.equipamento_nome, dias: 0, reprovacoes: 0 }; v.dias += l.dias; v.reprovacoes++; m.set(k, v); return m; }, new Map()).values()].sort((a, b) => b.dias - a.dias),
    liberacao: { reprovadas: reprov.length, liberadas: lib.length, por_correcao: lib.filter((l) => l.como === 'correcao').length, media_dias: lib.length ? Math.round((lib.reduce((s, l) => s + l.dias, 0) / lib.length) * 10) / 10 : null,
      // uma linha por equipamento: desde a 1ª reprovação ainda sem liberação (e quantas reprovações seguidas)
      pendentes: [...liberacoes.filter((l) => !l.liberado_em).reduce((m, l) => { const k = String(l.equipamento_id); const v = m.get(k); if (!v) m.set(k, { ...l, reprovacoes: 1 }); else { v.reprovacoes++; if (l.dias > v.dias) Object.assign(v, { ...l, reprovacoes: v.reprovacoes }); } return m; }, new Map()).values()].sort((a, b) => b.dias - a.dias) },
    os_abertas: os,
  };
  d.achados = achados(d, ins, hoje);
  return d;
}

/** 🔎 achados por REGRA — frases prontas, com gravidade; a base do parecer (com ou sem IA) */
function achados(d, ins, hoje) {
  const out = []; const add = (nivel, texto, ref = null) => out.push({ nivel, texto, ref });
  // 1. tendência: últimos 3 meses fechados × 3 anteriores
  const fech = d.serie.filter((m) => !m.parcial && m.esperadas);
  if (fech.length >= 6) {
    const media = (l) => { const e = l.reduce((s, m) => s + m.esperadas, 0); return e ? Math.round((l.reduce((s, m) => s + m.cumpridas, 0) / e) * 100) : null; };
    const a = media(fech.slice(-3)), b = media(fech.slice(-6, -3));
    if (a != null && b != null && a <= b - 10) add('alto', `O cumprimento caiu de ${b}% para ${a}% nos últimos 3 meses.`);
    else if (a != null && b != null && a >= b + 10) add('bom', `O cumprimento subiu de ${b}% para ${a}% nos últimos 3 meses.`);
  }
  // 2. empresa × locatário
  const emp = d.responsavel.find((r) => r.responsavel === 'empresa'), loc = d.responsavel.find((r) => r.responsavel === 'locatario');
  if (emp && loc && emp.pct != null && loc.pct != null && Math.abs(emp.pct - loc.pct) >= 15)
    add('medio', loc.pct < emp.pct ? `Os locatários cumprem ${loc.pct}% das inspeções, contra ${emp.pct}% da sua equipe — vale cobrar o checklist no contrato.` : `Sua equipe cumpre ${emp.pct}% das inspeções, abaixo dos locatários (${loc.pct}%).`);
  // 3. atraso recorrente
  for (const e of d.equipamentos.filter((x) => x.meses_abaixo >= 3 && (x.pct ?? 100) < 80).slice(0, 5)) add('alto', `${e.tag || e.nome}: rotina abaixo do previsto em ${e.meses_abaixo} meses (${e.pct}% no período).`, { equipamento_id: e.equipamento_id });
  // 4. mesmo item reprovado no mesmo equipamento (60 dias)
  const de60 = somaDias(hoje, -60); const rep = new Map();
  for (const i of ins.filter((x) => diaBR(x.concluida_em) >= de60)) for (const r of (i.respostas || [])) if (r.status === 'nok') {
    const k = `${i.equipamento_id}|${String(r.rotulo).toLowerCase()}`; const v = rep.get(k) || { eq: i.equipamento_nome, id: i.equipamento_id, rotulo: r.rotulo, n: 0, os: 0 }; v.n++; if ((i.os_abertas || []).some((o) => o.ponto_id === r.ponto_id)) v.os++; rep.set(k, v); }
  for (const v of [...rep.values()].filter((x) => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 5))
    add(v.n >= 3 ? 'alto' : 'medio', `${v.eq}: "${v.rotulo}" falhou ${v.n}× em 60 dias${v.os ? ` (${v.os} OS aberta${v.os > 1 ? 's' : ''})` : ''} — avaliar causa raiz${v.n >= 3 ? ' ou substituição' : ''}.`, { equipamento_id: v.id });
  // 5. reprovado e ainda não liberado
  for (const p of d.liberacao.pendentes.filter((x) => x.dias > 7).slice(0, 5)) add('alto', `${p.equipamento_nome}: reprovado em ${p.em.split('-').reverse().join('/')}${p.reprovacoes > 1 ? ` (e mais ${p.reprovacoes - 1} ${p.reprovacoes > 2 ? 'reprovações' : 'reprovação'} depois)` : ''} e sem inspeção aprovada há ${p.dias} dias.`, { equipamento_id: p.equipamento_id });
  // 6. tempo médio de liberação
  if (d.liberacao.media_dias != null && d.liberacao.media_dias > 5) add('medio', `Da reprovação à liberação levam, em média, ${String(d.liberacao.media_dias).replace('.', ',')} dias.`);
  // 7. tudo certo
  if (!out.some((a) => a.nivel !== 'bom') && d.total.pct != null && d.total.pct >= 95) add('bom', `Rotina em dia: ${d.total.pct}% de cumprimento no período.`);
  const ord = { alto: 0, medio: 1, bom: 2 }; return out.sort((a, b) => ord[a.nivel] - ord[b.nivel]);
}

module.exports = { painel, achados, mesesAte };
