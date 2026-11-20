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

/** documentos de gestão (manual, procedimentos, formulários…) — vigente com a revisão */
async function documentos(sb, tenantId, termo = '') {
  const t = norm(String(termo).trim()); const l = await q(sb.from('documentos_gestao').select('*').eq('tenant_id', tenantId));
  return { itens: l.filter((d) => d.status !== 'obsoleto' && (!t || norm(`${d.codigo} ${d.titulo}`).includes(t))).sort((a, b) => String(a.codigo || '').localeCompare(String(b.codigo || ''))).slice(0, 30)
    .map((d) => ({ id: String(d.id), codigo: d.codigo || null, titulo: d.titulo, revisao: d.revisao != null ? String(d.revisao) : null, tipo: d.tipo || null, status: d.status || null })) };
}

module.exports = { FONTES, TIPOS, buscar, documentos };
