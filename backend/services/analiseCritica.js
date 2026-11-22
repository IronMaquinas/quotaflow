// services/analiseCritica.js — etapa R2: 🧭 ANÁLISE CRÍTICA PELA DIREÇÃO (ISO 9001 9.3)
//   Rascunho → entradas montadas sozinhas com os dados do período (a–l da 9.3.2), comentário da direção por entrada (salva sozinho)
//   → saídas/decisões (9.3.3: melhoria · mudança no sistema · recursos) que podem virar TAREFA tipo AC → ■ Encerrar (números
//   congelados) → ✍ direção + responsável pela qualidade → ✅ concluída. As tarefas das saídas viram a entrada (a) da próxima análise.
//   Cancelar exige motivo; reabrir volta ao rascunho enquanto faltar assinatura (apaga as assinaturas).

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const seguro = async (p) => { try { return await q(p); } catch { return []; } };
const txt = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);
const data = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null);
const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const d10 = (x) => (x ? new Date(new Date(x).getTime() - 3 * 3600e3).toISOString().slice(0, 10) : null);
const somaDias = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
const r1 = (v) => Math.round(v * 10) / 10;

const STATUS = { rascunho: 'Em preparação', encerrada: 'Aguardando assinaturas', concluida: 'Concluída', cancelada: 'Cancelada' };
const TIPOS_SAIDA = { melhoria: 'Oportunidade de melhoria', mudanca: 'Mudança no sistema de gestão', recursos: 'Necessidade de recursos', risco: 'Tratamento de risco' }; // R2.2: risco (ISO 6.1) 
const PAPEIS = { direcao: 'Direção', qualidade: 'Responsável pela qualidade' };
const ENTRADAS = [
  { chave: 'acoes_anteriores', letra: 'a', clausula: '9.3.2 a', titulo: 'Situação das ações das análises anteriores' },
  { chave: 'contexto', letra: 'b', clausula: '9.3.2 b', titulo: 'Mudanças nas questões externas e internas', livre: true, dica: 'Mercado, clientes, legislação, concorrência, mudanças na empresa (estrutura, sócios, sistemas, base nova)…' },
  { chave: 'satisfacao', letra: 'c', clausula: '9.3.2 c1', titulo: 'Satisfação do cliente (NPS)', tela: 'nps' },
  { chave: 'objetivos', letra: 'd', clausula: '9.3.2 c2', titulo: 'Objetivos da qualidade (metas)', tela: 'metas' },
  { chave: 'processos', letra: 'e', clausula: '9.3.2 c3', titulo: 'Desempenho dos processos e conformidade dos serviços', tela: 'inspecoes' },
  { chave: 'ncs', letra: 'f', clausula: '9.3.2 c4', titulo: 'Não conformidades e ações corretivas', tela: 'nao_conformidades' },
  { chave: 'monitoramento', letra: 'g', clausula: '9.3.2 c5', titulo: 'Resultados de monitoramento e medição', tela: 'metas' },
  { chave: 'auditorias', letra: 'h', clausula: '9.3.2 c6', titulo: 'Resultados de auditorias', tela: 'auditorias' },
  { chave: 'provedores', letra: 'i', clausula: '9.3.2 c7', titulo: 'Desempenho dos provedores externos', tela: 'suprimentos' },
  { chave: 'recursos', letra: 'j', clausula: '9.3.2 d', titulo: 'Suficiência de recursos (pessoas, treinamentos, EPI, documentos)', tela: 'pessoas' },
  { chave: 'riscos', letra: 'k', clausula: '9.3.2 e', titulo: 'Eficácia das ações sobre riscos e oportunidades', livre: true, dica: 'Riscos e oportunidades do período: o que foi tratado, o que funcionou, o que mudou.' },
  { chave: 'melhoria', letra: 'l', clausula: '9.3.2 f', titulo: 'Oportunidades de melhoria', livre: true, dica: 'Ideias da equipe, dos clientes e das auditorias para melhorar.' },
];
const pior = (...xs) => (xs.includes('vermelho') ? 'vermelho' : xs.includes('amarelo') ? 'amarelo' : xs.some((x) => x === 'verde') ? 'verde' : null);
const nNum = (rotulo, valor, extra = {}) => ({ rotulo, valor: valor == null ? '—' : valor, ...extra });

// ─── entradas (cada uma isolada: se uma fonte falhar, as outras seguem) ───────
const FONTES = {
  async acoes_anteriores({ sb, tenantId, id, de }) {
    const ls = (await seguro(sb.from('analises_criticas').select('*').eq('tenant_id', tenantId))).filter((x) => String(x.id) !== String(id) && x.status === 'concluida' && String(x.periodo_ate) <= String(de || '9999')).sort((a, b) => String(b.periodo_ate).localeCompare(String(a.periodo_ate)));
    const ant = ls[0]; if (!ant) return { sinal: null, numeros: [nNum('Análise anterior', 'primeira análise no sistema')], itens: [] };
    const ids = (ant.saidas || []).map((s) => s.tarefa_id).filter(Boolean).map(String);
    const ts = ids.length ? new Map((await seguro(sb.from('tarefas').select('*').eq('tenant_id', tenantId))).filter((t) => ids.includes(String(t.id))).map((t) => [String(t.id), t])) : new Map();
    const hoje = hojeBR(); const itens = (ant.saidas || []).map((s) => { const t = s.tarefa_id ? ts.get(String(s.tarefa_id)) : null; const st = t ? t.status : 'sem tarefa'; const atras = t && !['concluida', 'cancelada'].includes(t.status) && t.prazo && String(t.prazo).slice(0, 10) < hoje;
      return { texto: s.texto, detalhe: `${t?.numero || ''}${t?.numero ? ' · ' : ''}${{ pendente: 'pendente', em_andamento: 'em andamento', concluida: 'concluída', cancelada: 'cancelada' }[st] || st}${atras ? ' · ATRASADA' : ''}`, sinal: !t ? null : t.status === 'concluida' ? 'verde' : atras ? 'vermelho' : t.status === 'cancelada' ? null : 'amarelo' }; });
    const com = itens.filter((x) => x.sinal); const conc = com.filter((x) => x.sinal === 'verde').length; const atr = com.filter((x) => x.sinal === 'vermelho').length;
    return { sinal: !com.length ? null : atr ? 'vermelho' : conc === com.length ? 'verde' : 'amarelo', numeros: [nNum('Análise anterior', `${ant.numero || ''} (${String(ant.periodo_de).split('-').reverse().join('/')} a ${String(ant.periodo_ate).split('-').reverse().join('/')})`), nNum('Decisões', (ant.saidas || []).length), nNum('Ações concluídas', com.length ? `${conc}/${com.length} (${pct(conc, com.length)}%)` : '—'), nNum('Atrasadas', atr)], itens };
  },
  async satisfacao({ sb, tenantId, de, ate }) {
    const p = await require('./nps').painel(sb, tenantId, { de, ate });
    const s = p.nps == null ? null : p.nps >= 50 ? 'verde' : p.nps >= 0 ? 'amarelo' : 'vermelho';
    return { sinal: s, numeros: [nNum('NPS', p.nps), nNum('Respostas', p.respostas), nNum('Promotores · neutros · detratores', `${p.promotores} · ${p.neutros} · ${p.detratores}`), nNum('Taxa de resposta', p.taxa_resposta == null ? null : `${p.taxa_resposta}%`)],
      itens: (p.motivos || []).slice(0, 5).map((m) => ({ texto: m.nome, detalhe: `👍 ${m.elogios} · 👎 ${m.reclamacoes}`, sinal: m.reclamacoes > m.elogios ? 'vermelho' : null })) };
  },
  async objetivos({ sb, tenantId }) {
    const ms = await require('./metas').listar(sb, tenantId, { fotografar: false });
    const c = (k) => ms.filter((m) => m.sinal === k).length;
    return { sinal: !ms.length ? null : pior(...ms.map((m) => m.sinal)), numeros: [nNum('Metas', ms.length), nNum('No alvo 🟢', c('verde')), nNum('Atenção 🟡', c('amarelo')), nNum('Fora 🔴', c('vermelho'))],
      itens: ms.filter((m) => m.sinal === 'vermelho' || m.sinal === 'amarelo').slice(0, 8).map((m) => ({ texto: m.nome, detalhe: `${m.valor ?? '—'}${m.unidade ? ` ${m.unidade}` : ''} · meta ${m.sentido === 'menor' ? '≤' : '≥'} ${m.meta}${m.unidade ? ` ${m.unidade}` : ''}`, sinal: m.sinal })) };
  },
  async processos({ sb, tenantId, de, ate }) {
    const noP = (x) => { const d = d10(x); return d && d >= de && d <= ate; };
    const [ins, ocs, ats] = await Promise.all([seguro(sb.from('inspecoes').select('*').eq('tenant_id', tenantId)), seguro(sb.from('ocorrencias').select('*').eq('tenant_id', tenantId)), seguro(sb.from('execucoes').select('*').eq('tenant_id', tenantId))]);
    const iP = ins.filter((i) => noP(i.concluida_em || i.criado_em)); const rep = iP.filter((i) => i.resultado === 'reprovado').length; const res = iP.filter((i) => i.resultado === 'ressalvas').length;
    const oP = ocs.filter((o) => noP(o.criado_em)); const ac = oP.filter((o) => o.tipo === 'acidente').length;
    const aP = ats.filter((a) => a.status === 'concluida' && noP(a.concluida_em)); const comPrazo = aP.filter((a) => a.fim_previsto); const noPrazo = comPrazo.filter((a) => new Date(a.concluida_em) <= new Date(a.fim_previsto)).length;
    const pInsp = pct(iP.length - rep, iP.length); const pAt = pct(noPrazo, comPrazo.length);
    const TIPO = { avaria: 'Avaria', pane: 'Pane', acidente: 'Acidente', furto: 'Furto', outro: 'Outro' };
    return { sinal: pior(ac ? 'vermelho' : oP.length ? 'amarelo' : 'verde', pInsp == null ? null : pInsp >= 95 ? 'verde' : pInsp >= 85 ? 'amarelo' : 'vermelho', pAt == null ? null : pAt >= 90 ? 'verde' : pAt >= 75 ? 'amarelo' : 'vermelho'),
      numeros: [nNum('Inspeções', iP.length), nNum('Aprovadas', pInsp == null ? null : `${pInsp}%`, { detalhe: `${res} com ressalvas · ${rep} reprovadas` }), nNum('ATs concluídas', aP.length), nNum('ATs no prazo', pAt == null ? null : `${pAt}%`), nNum('Ocorrências', oP.length), nNum('Acidentes', ac)],
      itens: Object.keys(TIPO).map((k) => ({ k, n: oP.filter((o) => o.tipo === k).length })).filter((x) => x.n).map((x) => ({ texto: `Ocorrências — ${TIPO[x.k]}`, detalhe: String(x.n), sinal: x.k === 'acidente' ? 'vermelho' : null })) };
  },
  async ncs({ sb, tenantId, de, ate }) {
    const l = await seguro(sb.from('nao_conformidades').select('*').eq('tenant_id', tenantId)); const ab = (n) => d10(n.criado_em || n.data_abertura);
    const noP = (d) => d && d >= de && d <= ate; const abertas = l.filter((n) => noP(ab(n))); const fechadas = l.filter((n) => n.status === 'resolvida' && noP(d10(n.resolvida_em || n.encerrada_em)));
    const emAberto = l.filter((n) => !['resolvida', 'cancelada'].includes(n.status));
    const dur = fechadas.map((n) => (n.resolvida_em && (n.criado_em || n.data_abertura) ? (new Date(n.resolvida_em) - new Date(n.criado_em || n.data_abertura)) / 864e5 : null)).filter((x) => x != null && x >= 0);
    const tm = dur.length ? r1(dur.reduce((s, v) => s + v, 0) / dur.length) : null;
    const acoes = await seguro(sb.from('nao_conformidade_plano_acao').select('*').eq('tenant_id', tenantId)); const hoje = hojeBR();
    const atr = acoes.filter((a) => a.status === 'pendente' && a.prazo && String(a.prazo).slice(0, 10) < hoje && emAberto.some((n) => String(n.id) === String(a.nc_id))).length;
    const ORIG = {}; for (const n of abertas) { const k = n.origem || 'manual'; ORIG[k] = (ORIG[k] || 0) + 1; }
    const NOME = { manual: 'Interna (registrada pela equipe)', auditoria: 'Auditoria', fornecedor: 'Fornecedor', cliente: 'Cliente', recebimento: 'Recebimento', inspecao: 'Inspeção', os_material: 'OS (material)', estoque: 'Estoque', ocorrencia: 'Ocorrência' };
    return { sinal: pior(atr ? 'vermelho' : 'verde', tm == null ? null : tm <= 30 ? 'verde' : tm <= 60 ? 'amarelo' : 'vermelho', emAberto.length > 10 ? 'amarelo' : null),
      numeros: [nNum('Abertas no período', abertas.length), nNum('Resolvidas no período', fechadas.length), nNum('Em aberto hoje', emAberto.length), nNum('Tempo médio para resolver', tm == null ? null : `${String(tm).replace('.', ',')} dias`), nNum('Ações atrasadas', atr)],
      itens: Object.entries(ORIG).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ texto: `Origem — ${NOME[k] || String(k).replace(/_/g, ' ')}`, detalhe: String(n) })) };
  },
  async monitoramento({ sb, tenantId, de, ate }) {
    const M = require('./metas'); const anos = [...new Set([de.slice(0, 4), ate.slice(0, 4)])]; const linhas = [];
    for (const ano of anos) { const p = await M.painelAnual(sb, tenantId, { ano }); for (const m of p.metas) { const cs = m.celulas.filter((c) => c.mes >= de.slice(0, 7) && c.mes <= ate.slice(0, 7) && c.valor != null); const x = linhas.find((y) => String(y.id) === String(m.id)) || (linhas.push({ id: m.id, nome: m.nome, unidade: m.unidade, cs: [] }), linhas[linhas.length - 1]); x.cs.push(...cs); } }
    const comDado = linhas.filter((l) => l.cs.length); const meses = comDado.reduce((s, l) => s + l.cs.length, 0); const verdes = comDado.reduce((s, l) => s + l.cs.filter((c) => c.sinal === 'verde').length, 0);
    const tarefas = await seguro(sb.from('tarefas').select('*').eq('tenant_id', tenantId)); const hoje = hojeBR(); const atr = tarefas.filter((t) => !['concluida', 'cancelada'].includes(t.status) && t.prazo && String(t.prazo).slice(0, 10) < hoje).length;
    const p = pct(verdes, meses);
    return { sinal: pior(p == null ? null : p >= 80 ? 'verde' : p >= 60 ? 'amarelo' : 'vermelho', atr > 10 ? 'amarelo' : null),
      numeros: [nNum('Indicadores medidos', comDado.length), nNum('Medições no alvo', p == null ? null : `${p}%`, { detalhe: `${verdes} de ${meses} meses` }), nNum('Tarefas atrasadas hoje', atr)],
      itens: comDado.map((l) => { const v = l.cs.filter((c) => c.sinal === 'verde').length; const u = l.cs[l.cs.length - 1]; return { texto: l.nome, detalhe: `${v}/${l.cs.length} meses no alvo · último ${u.valor}${l.unidade ? ` ${l.unidade}` : ''}`, sinal: u.sinal }; }).slice(0, 10) };
  },
  async auditorias({ sb, tenantId, ate }) {
    const p = await require('./auditorias').programa(sb, tenantId, ate.slice(0, 4)); const r = p.resumo;
    return { sinal: pior(r.nc_maior ? 'vermelho' : r.nc_menor || r.atrasadas ? 'amarelo' : 'verde', r.cobertura_pct >= 100 ? 'verde' : r.cobertura_pct >= 50 ? 'amarelo' : 'vermelho'),
      numeros: [nNum(`Auditorias ${p.ano}`, `${r.concluidas}/${r.total} concluídas`), nNum('Cobertura ISO 9001 (auditado)', `${r.auditado_pct ?? 0}%`), nNum('NC maior · menor', `${r.nc_maior} · ${r.nc_menor}`), nNum('Observações · oportunidades', `${r.observacoes} · ${r.oportunidades}`), nNum('Ações de NC concluídas', r.acoes_nc_pct == null ? null : `${r.acoes_nc_pct}%`), nNum('Ações abertas', r.acoes_abertas)],
      itens: (p.auditorias || []).filter((a) => a.status !== 'cancelada').slice(0, 10).map((a) => ({ texto: `${a.numero} — ${a.titulo}`, detalhe: `${p.STATUS[a.status]}${a.contagem.nc_maior + a.contagem.nc_menor ? ` · ${a.contagem.nc_maior + a.contagem.nc_menor} NC` : ''}`, sinal: a.status === 'concluida' ? 'verde' : a.atrasada ? 'vermelho' : null })) };
  },
  async provedores({ sb, tenantId, de, ate }) {
    const p = await require('./suprimentos').painel(sb, tenantId, { de, ate }); const r = p.resumo; const comNc = (p.fornecedores || []).filter((f) => f.ncs > 0);
    return { sinal: pior(comNc.length ? 'amarelo' : 'verde', r.com_concorrencia_pct == null ? null : r.com_concorrencia_pct >= 70 ? 'verde' : 'amarelo'),
      numeros: [nNum('Compras (OCs)', r.ocs), nNum('Gasto', `R$ ${Number(r.gasto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`), nNum('Fornecedores', r.fornecedores), nNum('Com concorrência', r.com_concorrencia_pct == null ? null : `${r.com_concorrencia_pct}%`), nNum('Economia', `${String(r.saving_pct || 0).replace('.', ',')}%`), nNum('Fornecedores com NC', comNc.length)],
      itens: [...comNc.sort((a, b) => b.ncs - a.ncs).slice(0, 5).map((f) => ({ texto: f.nome, detalhe: `${f.ncs} NC · ${f.vitorias} OC(s)${f.taxa_resposta != null ? ` · responde ${f.taxa_resposta}%` : ''}`, sinal: 'vermelho' })),
        ...(p.oportunidades || []).slice(0, 3).map((o) => ({ texto: o.titulo, detalhe: o.detalhe, sinal: o.sev === 'alta' ? 'amarelo' : null }))] };
  },
  async recursos({ sb, tenantId, de, ate }) {
    const hoje = hojeBR();
    const [cols, docs, turmas, parts, epis] = await Promise.all(['colaboradores', 'documentos', 'treinamento_turmas', 'treinamento_participacoes', 'epi_entregas'].map((t) => seguro(sb.from(t).select('*').eq('tenant_id', tenantId))));
    const ativos = cols.filter((c) => (c.situacao || 'ativo') === 'ativo'); const idsAt = new Set(ativos.map((c) => String(c.id)));
    const docsVenc = docs.filter((d) => !d.substituido_por && d.vence_em && String(d.vence_em) < hoje && (d.alvo_tipo !== 'colaborador' || idsAt.has(String(d.colaborador_id))));
    const tP = turmas.filter((t) => t.status === 'concluida' && String(t.data) >= de && String(t.data) <= ate); const idsT = new Set(tP.map((t) => String(t.id)));
    const pres = parts.filter((p) => p.presente && idsT.has(String(p.turma_id)));
    const horas = pres.reduce((s, p) => s + (Number(tP.find((t) => String(t.id) === String(p.turma_id))?.carga_horaria) || 0), 0);
    // treinamento vencido = a última participação válida da pessoa naquele treinamento já venceu
    const trDe = new Map(turmas.map((t) => [String(t.id), t])); const ult = new Map();
    for (const p of parts.filter((x) => x.presente && x.valido_ate && idsAt.has(String(x.colaborador_id)))) { const t = trDe.get(String(p.turma_id)); const k = `${p.colaborador_id}|${t?.treinamento_id || t?.nome || p.turma_id}`; if (!ult.has(k) || String(p.valido_ate) > String(ult.get(k))) ult.set(k, p.valido_ate); }
    const trVenc = [...ult.values()].filter((v) => String(v) < hoje).length;
    const ePer = epis.filter((e) => { const d = d10(e.entregue_em); return d && d >= de && d <= ate; }).length;
    return { sinal: pior(docsVenc.length ? 'vermelho' : 'verde', trVenc ? 'amarelo' : null),
      numeros: [nNum('Colaboradores ativos', ativos.length), nNum('Treinamentos realizados', tP.length, { detalhe: `${pres.length} participações · ${String(r1(horas)).replace('.', ',')} h` }), nNum('Treinamentos vencidos', trVenc), nNum('Entregas de EPI', ePer), nNum('Documentos vencidos', docsVenc.length)],
      itens: docsVenc.slice(0, 8).map((d) => ({ texto: `${d.tipo_nome}${d.numero ? ` ${d.numero}` : ''}`, detalhe: `${d.alvo_tipo === 'colaborador' ? (cols.find((c) => String(c.id) === String(d.colaborador_id))?.nome || 'colaborador') : d.alvo_tipo} · venceu ${String(d.vence_em).split('-').reverse().join('/')}`, sinal: 'vermelho' })) };
  },
  async riscos({ sb, tenantId, de, ate }) {
    const itens = [];
    try { const p = await require('./suprimentos').painel(sb, tenantId, { de, ate }); itens.push(...(p.oportunidades || []).slice(0, 4).map((o) => ({ texto: `Compras: ${o.titulo}`, detalhe: o.detalhe, sugestao: true }))); } catch { /* ok */ }
    try { const ocs = await seguro(sb.from('ocorrencias').select('*').eq('tenant_id', tenantId)); const ac = ocs.filter((o) => o.tipo === 'acidente' && d10(o.criado_em) >= de && d10(o.criado_em) <= ate).length; if (ac) itens.push({ texto: `Segurança: ${ac} acidente(s) no período`, detalhe: 'avaliar riscos da operação e ações de prevenção', sugestao: true }); } catch { /* ok */ }
    return { sinal: null, numeros: [], itens };
  },
};

async function montarEntradas(sb, tenantId, a) {
  const ctx = { sb, tenantId, id: a.id, de: String(a.periodo_de).slice(0, 10), ate: String(a.periodo_ate).slice(0, 10) };
  const out = await Promise.all(ENTRADAS.map(async (e) => {
    const base = { chave: e.chave, letra: e.letra, clausula: e.clausula, titulo: e.titulo, livre: !!e.livre, dica: e.dica || null, tela: e.tela || null };
    const fn = FONTES[e.chave]; if (!fn) return { ...base, sinal: null, numeros: [], itens: [] };
    try { return { ...base, ...(await fn(ctx)) }; } catch (err) { console.warn(`⚠️ [analise-critica] entrada ${e.chave}:`, err.message); return { ...base, sinal: null, numeros: [], itens: [], falha: true }; }
  }));
  return { montadas_em: new Date().toISOString(), lista: out };
}

// ─── CRUD / fluxo ────────────────────────────────────────────────────────────
async function uma(sb, tenantId, id) { return (await q(sb.from('analises_criticas').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] || null; }
const limparPart = (v) => (Array.isArray(v) ? v : []).map((p) => ({ nome: txt(p?.nome, 120), funcao: txt(p?.funcao, 80), colaborador_id: p?.colaborador_id ?? null, usuario_id: p?.usuario_id ?? null })).filter((p) => p.nome).slice(0, 30);
const periodoPadrao = () => { const ate = hojeBR(); return { de: somaDias(ate, -364), ate }; };

async function listar(sb, tenantId) {
  const l = (await q(sb.from('analises_criticas').select('*').eq('tenant_id', tenantId))).sort((a, b) => String(b.periodo_ate).localeCompare(String(a.periodo_ate)) || Number(b.id) - Number(a.id));
  const resumo = (a) => { const e = (a.entradas?.lista || []); const n = (k, r) => e.find((x) => x.chave === k)?.numeros?.find((x) => x.rotulo === r)?.valor ?? null; return { nps: n('satisfacao', 'NPS'), ncs_abertas: n('ncs', 'Abertas no período'), metas_fora: n('objetivos', 'Fora 🔴'), metas: n('objetivos', 'Metas') }; };
  const hoje = hojeBR(); const ano = hoje.slice(0, 4);
  return { STATUS, TIPOS_SAIDA, PAPEIS, periodo_padrao: periodoPadrao(), analises: l.map(({ entradas, assinaturas, ...a }) => ({ ...a, saidas_n: (a.saidas || []).length, assinaturas_n: (assinaturas || []).length, resumo: a.status === 'concluida' || a.status === 'encerrada' ? resumo({ entradas }) : null })),
    concluida_no_ano: l.some((a) => a.status === 'concluida' && String(a.data_reuniao || a.periodo_ate).startsWith(ano)) };
}
async function criar(sb, tenantId, quem, d = {}) {
  const P = periodoPadrao(); const de = data(d.periodo_de) || P.de; const ate = data(d.periodo_ate) || P.ate;
  if (de > ate) return { status: 400, erro: 'O início do período precisa ser antes do fim.' };
  const ano = (data(d.data_reuniao) || hojeBR()).slice(0, 4); const todas = await q(sb.from('analises_criticas').select('*').eq('tenant_id', tenantId));
  const numero = `ACD-${ano}-${String(todas.filter((a) => String(a.numero || '').startsWith(`ACD-${ano}-`)).length + 1).padStart(2, '0')}`;
  const agora = new Date().toISOString();
  const a = (await q(sb.from('analises_criticas').insert([{ tenant_id: tenantId, numero, titulo: txt(d.titulo, 160) || `Análise crítica pela direção ${ano}`, periodo_de: de, periodo_ate: ate, data_reuniao: data(d.data_reuniao), participantes: limparPart(d.participantes), status: 'rascunho', comentarios: {}, saidas: [], assinaturas: [], criado_por: quem?.nome || null, criado_em: agora, atualizado_em: agora }]).select()))[0];
  return { analise: a };
}
async function detalhe(sb, tenantId, id) {
  const a = await uma(sb, tenantId, id); if (!a) return { status: 404, erro: 'Análise não encontrada.' };
  const entradas = a.status === 'rascunho' || !a.entradas ? await montarEntradas(sb, tenantId, a) : a.entradas;
  const ids = (a.saidas || []).map((s) => s.tarefa_id).filter(Boolean).map(String);
  const ts = ids.length ? (await seguro(sb.from('tarefas').select('*').eq('tenant_id', tenantId))).filter((t) => ids.includes(String(t.id))) : [];
  const saidas = (a.saidas || []).map((s) => { const t = ts.find((x) => String(x.id) === String(s.tarefa_id)); return { ...s, tarefa: t ? { id: t.id, numero: t.numero, status: t.status, prazo: t.prazo } : null }; });
  return { analise: { ...a, saidas }, entradas, travada: a.status !== 'rascunho', STATUS, TIPOS_SAIDA, PAPEIS };
}
const MSG_TRAV = 'Análise encerrada — use "Reabrir" (apaga as assinaturas) para alterar.';
async function atualizar(sb, tenantId, id, d = {}) {
  const a = await uma(sb, tenantId, id); if (!a) return { status: 404, erro: 'Análise não encontrada.' };
  if (a.status !== 'rascunho') return { status: 409, erro: MSG_TRAV };
  const up = { atualizado_em: new Date().toISOString() };
  if ('titulo' in d) { up.titulo = txt(d.titulo, 160); if (!up.titulo) return { status: 400, erro: 'Dê um título à análise.' }; }
  if ('periodo_de' in d) up.periodo_de = data(d.periodo_de) || a.periodo_de;
  if ('periodo_ate' in d) up.periodo_ate = data(d.periodo_ate) || a.periodo_ate;
  if (String(up.periodo_de || a.periodo_de) > String(up.periodo_ate || a.periodo_ate)) return { status: 400, erro: 'O início do período precisa ser antes do fim.' };
  if ('data_reuniao' in d) up.data_reuniao = data(d.data_reuniao);
  if ('participantes' in d) up.participantes = limparPart(d.participantes);
  if ('conclusao' in d) up.conclusao = txt(d.conclusao, 6000);
  if (d.comentarios && typeof d.comentarios === 'object') { const c = { ...(a.comentarios || {}) }; for (const [k, v] of Object.entries(d.comentarios)) if (ENTRADAS.some((e) => e.chave === k)) { const t = txt(v, 4000); if (t) c[k] = t; else delete c[k]; } up.comentarios = c; }
  return { analise: (await q(sb.from('analises_criticas').update(up).eq('tenant_id', tenantId).eq('id', id).select()))[0] };
}
// R2.4: cria (sid vazio) ou edita uma decisão; se ela tem tarefa, a tarefa acompanha (título, detalhe, prazo, prioridade, responsável)
async function novaSaida(sb, tenantId, quem, id, d = {}, sid = null) {
  const a = await uma(sb, tenantId, id); if (!a) return { status: 404, erro: 'Análise não encontrada.' };
  if (a.status !== 'rascunho') return { status: 409, erro: MSG_TRAV };
  const velha = sid ? (a.saidas || []).find((x) => x.id === sid) : null; if (sid && !velha) return { status: 404, erro: 'Decisão não encontrada.' };
  const tipo = TIPOS_SAIDA[d.tipo] ? d.tipo : null; if (!tipo) return { status: 400, erro: 'Escolha o tipo da decisão: melhoria, mudança no sistema, recursos ou risco.' };
  const texto = txt(d.texto, 1000); if (!texto || texto.length < 5) return { status: 400, erro: 'Descreva a decisão.' };
  const entrada = velha ? velha.entrada : ENTRADAS.some((e) => e.chave === d.entrada) ? d.entrada : null;
  const ref = /^[cu]:\d+$/.test(String(d.responsavel_ref || '')) ? String(d.responsavel_ref) : null;
  const s = { ...(velha || { id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, tarefa_id: null, criado_por: quem?.nome || null, criado_em: new Date().toISOString() }),
    tipo, texto, entrada, responsavel: txt(d.responsavel, 120), responsavel_ref: ref, prazo: data(d.prazo), recurso: tipo === 'recursos' ? txt(d.recurso, 300) : null, risco: tipo === 'risco' ? txt(d.risco, 300) : null, ...(velha ? { editado_em: new Date().toISOString(), editado_por: quem?.nome || null } : {}) };
  const querTarefa = !!s.tarefa_id || d.gerar_tarefa !== false;
  if (querTarefa) {
    if (!s.prazo) return { status: 400, erro: 'Informe o prazo da ação (ou desligue "Criar tarefa no Plano").' };
    if (s.prazo < hojeBR() && (!velha || s.prazo !== velha.prazo)) return { status: 400, erro: 'O prazo não pode estar no passado.' };
  }
  const ent = ENTRADAS.find((e) => e.chave === entrada);
  const campos = { titulo: `${TIPOS_SAIDA[tipo]} — ${a.numero}: ${texto.slice(0, 140)}`, prioridade: tipo === 'risco' ? 'alta' : 'media', prazo: s.prazo,
    responsavel_ref: ref, responsavel: ref ? null : (s.responsavel || 'Direção'),
    detalhe: `${a.numero} · ${a.titulo}\nDecisão da análise crítica pela direção (ISO 9001 9.3.3) — ${TIPOS_SAIDA[tipo]}${ent ? `\nEntrada: ${ent.letra}) ${ent.titulo}` : ''}\n\n${texto}${s.recurso ? `\n\nRecurso: ${s.recurso}` : ''}${s.risco ? `\n\nRisco: ${s.risco}` : ''}\n\nA situação desta tarefa entra na próxima análise crítica.` };
  let aviso = null; let tarefa = null; const T = require('./tarefas');
  if (s.tarefa_id) { const t = await T.atualizar(sb, tenantId, quem, s.tarefa_id, campos); if (t?.erro) aviso = `a tarefa não foi atualizada (${t.erro})`; else tarefa = { id: t.id, numero: t.numero }; }
  else if (querTarefa) { const t = await T.criar(sb, tenantId, quem, { tipo: 'AC', ...campos, vinculos: [{ tipo: 'analise_critica', id: String(a.id), numero: a.numero }] });
    if (t?.erro) aviso = `a tarefa não foi criada (${t.erro})`; else if (t?.id) { s.tarefa_id = String(t.id); tarefa = { id: t.id, numero: t.numero }; } }
  const saidas = velha ? a.saidas.map((x) => (x.id === sid ? s : x)) : [...(a.saidas || []), s];
  await q(sb.from('analises_criticas').update({ saidas, atualizado_em: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id).select());
  return { saida: s, tarefa, aviso: aviso ? `Decisão ${velha ? 'alterada' : 'registrada'}, mas ${aviso}.` : null };
}
async function excluirSaida(sb, tenantId, id, sid) {
  const a = await uma(sb, tenantId, id); if (!a) return { status: 404, erro: 'Análise não encontrada.' };
  if (a.status !== 'rascunho') return { status: 409, erro: MSG_TRAV };
  const s = (a.saidas || []).find((x) => x.id === sid); if (!s) return { status: 404, erro: 'Decisão não encontrada.' };
  await q(sb.from('analises_criticas').update({ saidas: a.saidas.filter((x) => x.id !== sid), atualizado_em: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id).select());
  return { ok: true, tarefa_mantida: !!s.tarefa_id };
}
async function encerrar(sb, tenantId, id) {
  const a = await uma(sb, tenantId, id); if (!a) return { status: 404, erro: 'Análise não encontrada.' };
  if (a.status !== 'rascunho') return { status: 409, erro: 'Esta análise já foi encerrada.' };
  const falta = [!a.data_reuniao && 'a data da reunião', !(a.participantes || []).length && 'os participantes', !(a.saidas || []).length && !a.conclusao && 'ao menos uma decisão ou a conclusão'].filter(Boolean);
  if (falta.length) return { status: 409, erro: `Para encerrar falta: ${falta.join(', ')}.` };
  const entradas = await montarEntradas(sb, tenantId, a); const agora = new Date().toISOString();
  return { analise: (await q(sb.from('analises_criticas').update({ status: 'encerrada', entradas, encerrada_em: agora, atualizado_em: agora }).eq('tenant_id', tenantId).eq('id', id).select()))[0] };
}
async function reabrir(sb, tenantId, id) {
  const a = await uma(sb, tenantId, id); if (!a) return { status: 404, erro: 'Análise não encontrada.' };
  if (a.status !== 'encerrada') return { status: 409, erro: a.status === 'concluida' ? 'Análise já aprovada pelas duas assinaturas — não reabre.' : 'Só reabre uma análise encerrada.' };
  return { analise: (await q(sb.from('analises_criticas').update({ status: 'rascunho', entradas: null, encerrada_em: null, assinaturas: [], atualizado_em: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id).select()))[0] };
}
async function assinar(sb, tenantId, quem, id, d = {}) {
  const a = await uma(sb, tenantId, id); if (!a) return { status: 404, erro: 'Análise não encontrada.' };
  if (a.status !== 'encerrada') return { status: 409, erro: a.status === 'concluida' ? 'Análise já aprovada.' : 'Encerre a análise antes de assinar.' };
  const papel = PAPEIS[d.papel] ? d.papel : null; if (!papel) return { status: 400, erro: 'Quem está assinando: direção ou responsável pela qualidade?' };
  const nome = txt(d.nome, 120); if (!nome) return { status: 400, erro: 'Informe o nome de quem assina.' };
  const png = String(d.png || ''); if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(png) || png.length < 200 || png.length > 600000) return { status: 400, erro: 'Assine no quadro antes de confirmar.' };
  const agora = new Date().toISOString();
  const ass = [...(a.assinaturas || []).filter((x) => x.papel !== papel), { papel, nome, colaborador_id: d.colaborador_id ?? null, usuario_id: d.usuario_id ?? null, png, em: agora, registrado_por: quem?.nome || null }];
  const ok = Object.keys(PAPEIS).every((k) => ass.some((x) => x.papel === k));
  return { analise: (await q(sb.from('analises_criticas').update({ assinaturas: ass, atualizado_em: agora, ...(ok ? { status: 'concluida', aprovada_em: agora } : {}) }).eq('tenant_id', tenantId).eq('id', id).select()))[0], aprovada: ok };
}
async function cancelar(sb, tenantId, id, d = {}, quem = null) {
  const a = await uma(sb, tenantId, id); if (!a) return { status: 404, erro: 'Análise não encontrada.' };
  if (a.status === 'concluida' || a.status === 'cancelada') return { status: 409, erro: a.status === 'concluida' ? 'Análise aprovada não pode ser cancelada.' : 'Já está cancelada.' };
  const motivo = txt(d.motivo, 500); if (!motivo || motivo.length < 10) return { status: 400, erro: 'Explique o motivo do cancelamento (mínimo 10 caracteres).' };
  const agora = new Date().toISOString();
  return { analise: (await q(sb.from('analises_criticas').update({ status: 'cancelada', cancelamento_motivo: motivo, cancelada_em: agora, cancelada_por: quem?.nome || null, atualizado_em: agora }).eq('tenant_id', tenantId).eq('id', id).select()))[0] };
}

const editarSaida = (sb, tenantId, quem, id, sid, d) => novaSaida(sb, tenantId, quem, id, d, sid);
module.exports = { editarSaida, ENTRADAS, STATUS, TIPOS_SAIDA, PAPEIS, montarEntradas, listar, criar, detalhe, atualizar, novaSaida, excluirSaida, encerrar, reabrir, assinar, cancelar };
