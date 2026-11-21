// services/auditoriaRegistros.js — etapa A1.2: 🔎 busca de REGISTROS do sistema para a auditoria (rastreabilidade) e de DOCUMENTOS de gestão
//   Uma busca só, em vários módulos, sempre no mesmo formato: { tipo, rotulo, id, numero, descricao, emissor, data, situacao, tela }.
//   Para incluir um tipo novo: acrescente uma linha em FONTES (tabela + como ler número, data, situação e emissor).
async function q(p) { try { const { data, error } = await p; if (error) return []; return data || []; } catch { return []; } }
const d10 = (v) => (v ? String(v).slice(0, 10) : null);
const um = (r, ...ks) => { for (const k of ks) if (r[k] != null && r[k] !== '') return r[k]; return null; };
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const SIT = { aberta: 'aberta', aberto: 'aberto', pendente: 'pendente', em_andamento: 'em andamento', em_execucao: 'em execução', concluida: 'concluída', concluido: 'concluído', fechada: 'fechada', cancelada: 'cancelada', cancelado: 'cancelado', rascunho: 'rascunho', programada: 'programada', emitida: 'emitida', recebida: 'recebida', aprovada: 'aprovada', encerrada: 'encerrada', vigente: 'vigente' };
const sit = (v) => (v == null ? '—' : SIT[String(v)] || String(v).replace(/_/g, ' '));

const FONTES = [
  { tipo: 'os', rotulo: 'Ordem de serviço', tabela: 'chamados', tela: 'ordem_servico', filtro: (r) => !r.tipo_documento || r.tipo_documento === 'os', numero: (r) => um(r, 'numero', 'codigo') || `OS #${r.id}`, descricao: (r) => um(r, 'titulo', 'descricao', 'equipamento_nome') , emissor: (r) => um(r, 'solicitante_nome', 'responsavel_nome', 'criado_por_nome'), data: (r) => um(r, 'criado_em', 'data_abertura'), situacao: (r) => r.status },
  { tipo: 'at', rotulo: 'Autorização de transporte', tabela: 'execucoes', tela: 'programacao', numero: (r) => r.numero || `AT #${r.id}`, descricao: (r) => [r.cliente_nome, r.grupo_titulo].filter(Boolean).join(' · '), emissor: (r) => um(r, 'criado_por_nome', 'motorista_nome'), data: (r) => um(r, 'inicio_previsto', 'criado_em'), situacao: (r) => r.status },
  { tipo: 'pv', rotulo: 'Pedido de venda', tabela: 'pedidos_venda', tela: 'comercial', numero: (r) => r.numero || `PV #${r.id}`, descricao: (r) => [r.cliente_nome, r.titulo].filter(Boolean).join(' · '), emissor: (r) => um(r, 'responsavel_nome', 'criado_por_nome'), data: (r) => r.criado_em, situacao: (r) => r.status },
  { tipo: 'cotacao', rotulo: 'Cotação / requisição de compra', tabela: 'cotacoes', tela: 'compradora', numero: (r) => r.numero || `RC #${r.id}`, descricao: (r) => um(r, 'titulo', 'descricao', 'observacao'), emissor: (r) => um(r, 'comprador_nome', 'criado_por_nome', 'solicitante_nome'), data: (r) => r.criado_em, situacao: (r) => r.status },
  { tipo: 'oc', rotulo: 'Ordem de compra', tabela: 'ordens_venda', tela: 'ordensvenda', numero: (r) => r.numero || `OC #${r.id}`, descricao: (r) => um(r, 'fornecedor_nome', 'mensagem'), emissor: (r) => um(r, 'criado_por_nome', 'criado_por'), data: (r) => r.criado_em, situacao: (r) => r.status },
  { tipo: 'recebimento', rotulo: 'Recebimento', tabela: 'movimentacoes_estoque', tela: 'recebimento', filtro: (r) => !!r.numero_recebimento, agrupar: 'numero_recebimento', numero: (r) => r.numero_recebimento, descricao: (r) => [r.ordem_venda_numero && `OC ${r.ordem_venda_numero}`, r.numero_nota_fiscal && `NF ${r.numero_nota_fiscal}`].filter(Boolean).join(' · '), emissor: (r) => um(r, 'responsavel_nome', 'criado_por_nome'), data: (r) => r.criado_em, situacao: () => 'recebido' },
  { tipo: 'movimentacao', rotulo: 'Movimentação de material', tabela: 'movimentacoes_estoque', tela: 'historico_estoque', filtro: (r) => !!r.numero_movimento, numero: (r) => r.numero_movimento, descricao: (r) => [r.tipo, r.quantidade != null && `qtd ${r.quantidade}`, r.observacao].filter(Boolean).join(' · '), emissor: (r) => um(r, 'responsavel_nome', 'criado_por_nome'), data: (r) => r.criado_em, situacao: (r) => r.tipo },
  { tipo: 'nc', rotulo: 'Não conformidade', tabela: 'nao_conformidades', tela: 'nao_conformidades', numero: (r) => r.numero_nc || `NC #${r.id}`, descricao: (r) => String(r.descricao_problema || '').slice(0, 120), emissor: (r) => um(r, 'criado_por_nome', 'responsavel_nome'), data: (r) => um(r, 'data_ocorrencia', 'criado_em'), situacao: (r) => r.status },
  { tipo: 'tarefa', rotulo: 'Tarefa', tabela: 'tarefas', tela: 'plano', numero: (r) => r.numero || `TSK #${r.id}`, descricao: (r) => r.titulo, emissor: (r) => um(r, 'responsavel', 'criado_por_nome'), data: (r) => r.criado_em, situacao: (r) => r.status },
  { tipo: 'inspecao', rotulo: 'Inspeção', tabela: 'inspecoes', tela: 'inspecoes', numero: (r) => `INSP-${String(r.id).padStart(4, '0')}`, descricao: (r) => [r.modelo_nome, r.equipamento_nome].filter(Boolean).join(' · '), emissor: (r) => r.executor_nome, data: (r) => um(r, 'concluida_em', 'iniciada_em', 'criado_em'), situacao: (r) => r.resultado || (r.concluida_em ? 'concluída' : 'em andamento') },
  { tipo: 'ocorrencia', rotulo: 'Ocorrência / sinistro', tabela: 'ocorrencias', tela: 'programacao', numero: (r) => r.numero || `OCR #${r.id}`, descricao: (r) => [r.tipo, r.local].filter(Boolean).join(' · '), emissor: (r) => r.registrado_por_nome, data: (r) => um(r, 'ocorrido_em', 'criado_em'), situacao: (r) => r.status },
  { tipo: 'treinamento', rotulo: 'Registro de treinamento', tabela: 'treinamento_turmas', tela: 'pessoas', numero: (r) => `TRN-${String(r.id).padStart(4, '0')}`, descricao: (r) => [r.treinamento_nome, r.instrutor && `instrutor ${r.instrutor}`].filter(Boolean).join(' · '), emissor: (r) => um(r, 'instrutor', 'criado_por'), data: (r) => r.data, situacao: (r) => r.status },
];
const TIPOS = Object.fromEntries(FONTES.map((f) => [f.tipo, f.rotulo]));

async function buscar(sb, tenantId, termo = '', tipos = null) {
  const t = norm(String(termo).trim()); if (t.length < 2) return { itens: [], TIPOS };
  const fontes = FONTES.filter((f) => !tipos || !tipos.length || tipos.includes(f.tipo));
  const porTabela = new Map(); for (const f of fontes) if (!porTabela.has(f.tabela)) porTabela.set(f.tabela, q(sb.from(f.tabela).select('*').eq('tenant_id', tenantId)));
  const out = [];
  for (const f of fontes) {
    const rows = (await porTabela.get(f.tabela)).filter((r) => !f.filtro || f.filtro(r)); const vistos = new Set();
    for (const r of rows) {
      const numero = String(f.numero(r) || ''); if (f.agrupar) { if (vistos.has(numero)) continue; vistos.add(numero); }
      const desc = f.descricao(r) || ''; if (!norm(`${numero} ${desc}`).includes(t)) continue;
      out.push({ tipo: f.tipo, rotulo: f.rotulo, id: String(r.id), numero, descricao: String(desc).slice(0, 160) || null, emissor: f.emissor(r) || null, data: d10(f.data(r)), situacao: sit(f.situacao(r)), tela: f.tela });
    }
  }
  const nt = (x) => (norm(x.numero).startsWith(t) ? 0 : norm(x.numero).includes(t) ? 1 : 2);
  out.sort((a, b) => nt(a) - nt(b) || String(b.data || '').localeCompare(String(a.data || '')));
  return { itens: out.slice(0, 25), TIPOS };
}

// ─── A1.4: 🧭 documentos × requisitos da ISO 9001 ───────────────────────────
const ISO = () => require('./auditorias').ISO9001;
const subsDe = (c) => ISO().filter((r) => !r.principal && r.codigo.split('.')[0] === String(c)).map((r) => r.codigo);
const SUBS = () => ISO().filter((r) => !r.principal).map((r) => r.codigo);
/** códigos de subitem a partir de uma lista (aceita cláusula "5" → 5.1–5.3 e "8.5.3" → 8.5) */
function normalizarReqs(lista) { const out = new Set(); const val = new Set(SUBS()); for (const x of Array.isArray(lista) ? lista : []) { const c = String(x).trim(); if (!c) continue; if (!c.includes('.')) subsDe(c).forEach((s) => out.add(s)); else { const two = c.split('.').slice(0, 2).join('.'); if (val.has(two)) out.add(two); } } return [...out].sort((a, b) => a.localeCompare(b, 'pt', { numeric: true })); }
/** "ISO 9001:2015 — 7.1.3, 7.1.5 e 8.5.1" → [7.1, 8.5]; "4 a 10" → todos */
function reqsDaNorma(norma) {
  const s = String(norma || ''); if (!/9001/.test(s)) return []; const depois = s.split(/—|–|-\s/).slice(1).join(' ') || s.replace(/.*9001(:\d{4})?/, '');
  const faixa = depois.match(/\b(\d{1,2})\s*a\s*(\d{1,2})\b/); const cods = [];
  if (faixa) for (let i = Number(faixa[1]); i <= Number(faixa[2]); i++) cods.push(String(i));
  for (const m of depois.replace(/\b\d{1,2}\s*a\s*\d{1,2}\b/, '').matchAll(/\b(\d{1,2}(?:\.\d{1,2}){0,2})\b/g)) cods.push(m[1]);
  return normalizarReqs(cods);
}
const reqsDoDoc = (d) => { const r = normalizarReqs(d.requisitos); return r.length ? { requisitos: r, sugerido: false } : { requisitos: reqsDaNorma(d.norma), sugerido: true }; };

/** documentos de gestão (manual, procedimentos, formulários…) — vigente com a revisão; requisitos=8.1,8.2 → só os que cobrem */
async function documentos(sb, tenantId, termo = '', requisitos = null) {
  const t = norm(String(termo).trim()); const l = await q(sb.from('documentos_gestao').select('*').eq('tenant_id', tenantId)); const alvo = requisitos ? new Set(normalizarReqs(requisitos)) : null;
  return { itens: l.filter((d) => d.status !== 'obsoleto' && (!t || norm(`${d.codigo} ${d.titulo}`).includes(t))).map((d) => ({ d, rq: reqsDoDoc(d) })).filter(({ rq }) => !alvo || rq.requisitos.some((c) => alvo.has(c)))
    .sort((x, y) => (alvo ? y.rq.requisitos.filter((c) => alvo.has(c)).length - x.rq.requisitos.filter((c) => alvo.has(c)).length : 0) || String(x.d.codigo || '').localeCompare(String(y.d.codigo || ''))).slice(0, 30)
    .map(({ d, rq }) => ({ id: String(d.id), codigo: d.codigo || null, titulo: d.titulo, revisao: d.revisao != null ? String(d.revisao) : null, tipo: d.tipo || null, status: d.status || null, requisitos: rq.requisitos, requisitos_sugeridos: rq.sugerido, cobre: alvo ? rq.requisitos.filter((c) => alvo.has(c)) : undefined })) };
}
/** matriz: cada subitem da norma × documentos que o atendem; lacunas = subitens sem documento */
async function matriz(sb, tenantId) {
  const l = (await q(sb.from('documentos_gestao').select('*').eq('tenant_id', tenantId))).filter((d) => d.status !== 'obsoleto');
  const docs = l.map((d) => ({ id: String(d.id), codigo: d.codigo, titulo: d.titulo, revisao: d.revisao, status: d.status, ...reqsDoDoc(d) }));
  const linhas = ISO().map((r) => { const ss = r.principal ? subsDe(r.codigo) : [r.codigo]; const ds = docs.filter((d) => d.requisitos.some((c) => ss.includes(c)));
    return { codigo: r.codigo, nome: r.nome, principal: r.principal, documentos: ds.map((d) => ({ id: d.id, codigo: d.codigo, titulo: d.titulo, revisao: d.revisao, status: d.status, sugerido: d.sugerido })) }; });
  const subs = linhas.filter((x) => !x.principal); const lac = subs.filter((x) => !x.documentos.length);
  return { linhas, documentos: docs, resumo: { itens: subs.length, cobertos: subs.length - lac.length, lacunas: lac.length, cobertura_pct: Math.round(((subs.length - lac.length) / subs.length) * 100), docs_sem_requisito: docs.filter((d) => !d.requisitos.length).length } };
}

module.exports = { FONTES, TIPOS, buscar, documentos, matriz, normalizarReqs, reqsDaNorma };
