// backend/services/modulos.js — etapa 18j: 🧩 áreas → módulos → planos
//
// Catálogo único (Console, menu, tela inicial, roteiro e ⭐ Meu plano leem daqui). A empresa tem tenants.modulos
// (migration 071): NULL = tudo ligado (empresas antigas / plano completo). O Console da Plataforma liga e desliga
// módulo a módulo ou aplica um plano-modelo (plataforma_planos). Dependências entram sozinhas.
// Nesta etapa o módulo desligado some do menu, da tela inicial e do roteiro; o bloqueio das rotas da API vem depois.
// Nomes neutros de segmento onde dá — o mesmo sistema serve transportadora, locadora e outros negócios.

const AREAS = [
  { id: 'comercial', nome: '📈 Comercial', modulos: [
    { id: 'crm_bid', nome: 'CRM, BID e pedidos', desc: 'Funil, prospecção, proposta (BID) com aceite do cliente e pedido de venda.', telas: ['comercial'] },
    { id: 'contratos_locacao', nome: 'Contratos de locação', desc: 'Contrato com aceite, equipamentos locados e acesso do cliente.', telas: ['contratos'], depende: ['frota_equipamentos'] },
    { id: 'medicao', nome: 'Medição mensal', desc: 'Ciclo de medição, aprovação ou contestação pelo cliente.', telas: [], depende: ['contratos_locacao'] },
  ] },
  { id: 'suprimentos', nome: '🛒 Suprimentos', modulos: [
    { id: 'compras', nome: 'Requisição e compras', desc: 'Requisição, compra e ordens, com aprovação.', telas: ['tecnico', 'compradora', 'ordensvenda', 'aprovacoes'] },
    { id: 'cotacoes_spot', nome: 'Cotações e Canal Spot', desc: 'Cotação com fornecedores e demanda urgente para a rede.', telas: ['spot', 'historico'], depende: ['compras', 'fornecedores'] },
    { id: 'fornecedores', nome: 'Fornecedores e Monitor de CNPJ', desc: 'Cadastro de fornecedores, catálogo e situação na Receita.', telas: ['fornecedores', 'monitor_cnpj', 'catalogo'] },
    { id: 'estoque', nome: 'Estoque, recebimento e retirada', desc: 'Itens de consumo, estoque mínimo, recompra, entrada e saída.', telas: ['estoque', 'historico_estoque', 'recebimento', 'retirada'] },
  ] },
  { id: 'operacoes', nome: '🚛 Operações', modulos: [
    { id: 'frota_equipamentos', nome: 'Frota e equipamentos', desc: 'Cadastro de equipamentos/ativos, documentos e bloqueios.', telas: ['equipamentos'] },
    { id: 'transporte', nome: 'Programação e AT', desc: 'AT por trecho, mesa de programação, link e fluxo do motorista, utilização da frota.', telas: ['programacao', 'minhas_viagens'], depende: ['crm_bid', 'frota_equipamentos'] },
    { id: 'manutencao', nome: 'Manutenção (OS e calendário)', desc: 'Ordem de serviço e calendário de manutenção.', telas: ['ordem_servico', 'calendario'], depende: ['frota_equipamentos'] },
    { id: 'fiscal', nome: 'Documentos fiscais do transporte', desc: 'Tarefa por trecho: NF-e, CT-e, averbação e MDF-e, conferência com a AT.', telas: [], depende: ['transporte'] },
    { id: 'ocorrencias', nome: 'Ocorrências (INC)', desc: 'Avaria, pane, acidente — pela AT ou pelo contrato, com dossiê e indicadores.', telas: [], dependeUm: ['transporte', 'contratos_locacao'] },
  ] },
  { id: 'qualidade', nome: '✅ Qualidade', modulos: [
    { id: 'inspecoes', nome: 'Inspeções e relatórios', desc: 'Checklists com foto e tarja, rotinas, relatório de inspeção, link para terceiros.', telas: ['inspecoes'], depende: ['frota_equipamentos'] },
    { id: 'nao_conformidades', nome: 'Não conformidades e autuações', desc: 'NC com evidências e causa raiz; autuações da empresa.', telas: ['nao_conformidades'] },
  ] },
  { id: 'pessoas', nome: '👷 Pessoas', modulos: [
    { id: 'colaboradores', nome: 'Colaboradores e documentos', desc: 'Cadastro, funções, documentos com vencimento e avisos.', telas: ['pessoas'] },
    { id: 'jornada', nome: 'Jornada e feriados', desc: 'Jornada de trabalho, feriados e dias da frota.', telas: [] },
    { id: 'treinamentos', nome: 'Treinamentos', desc: 'Turmas, prova online, certificados e "Meus treinamentos".', telas: ['meus_treinamentos'], depende: ['colaboradores'] },
    { id: 'epi', nome: 'EPI', desc: 'Entrega, estoque e ficha de EPI.', telas: [], depende: ['colaboradores'] },
    { id: 'multas', nome: 'Multas', desc: 'Multas de trânsito com responsável e tarefa.', telas: [], depende: ['colaboradores'] },
  ] },
  { id: 'inteligencia', nome: '🧠 Inteligência e IA', modulos: [
    { id: 'paineis', nome: 'Painéis e relatórios', desc: 'Relatório gerencial, financeiro, histórico de preços e benchmark de mercado.', telas: ['relatorio', 'financeiro', 'benchmark'] },
    { id: 'agente_ia', nome: 'Agente de IA — saúde da empresa', desc: 'Análise da operação pelo agente de IA e recomendações.', telas: ['inteligencia'] },
    { id: 'notificacoes_celular', nome: '🔔 Notificações no celular', desc: 'Aviso no celular (Telegram, depois app) só do que importa, com regra contra excesso. Na tela é para todos.', telas: [], futuro: true },
    { id: 'radar_mercado', nome: 'Radar de mercado (relatório diário)', desc: 'Relatório diário com informações do mercado coletadas na web.', telas: [], futuro: true },
  ] },
];
// 18u: 🏷 segmentos de negócio (a empresa pode ter mais de um — ex.: transporte de cargas especiais + locação de máquinas)
//   NULL no banco = ['transporte']. Mudam os NOMES na tela (não os dados) e sugerem módulos no Console.
const SEGMENTOS = [
  { id: 'transporte', nome: '🚛 Transporte', sugere: ['crm_bid', 'frota_equipamentos', 'transporte', 'fiscal', 'ocorrencias', 'manutencao'] },
  { id: 'locacao', nome: '🏗 Locação de equipamentos', sugere: ['crm_bid', 'frota_equipamentos', 'contratos_locacao', 'medicao', 'ocorrencias', 'inspecoes', 'manutencao'] },
  { id: 'servicos', nome: '🔧 Manutenção / serviços', sugere: ['frota_equipamentos', 'manutencao', 'inspecoes', 'compras', 'estoque'] },
  { id: 'outro', nome: '🏢 Outro', sugere: ['compras', 'fornecedores', 'estoque'] },
];
const segmentosDe = (t) => { const s = (Array.isArray(t?.segmentos) ? t.segmentos : []).filter((x) => SEGMENTOS.some((g) => g.id === x)); return s.length ? s : ['transporte']; };
// sempre ligadas (base do sistema)
const TELAS_BASE = ['home', 'plano', 'usuarios', 'configuracoes', 'portalfornecedor', 'meu_plano'];

const MODULOS = AREAS.flatMap((a) => a.modulos.map((m) => ({ ...m, area: a.id })));
const POR_ID = new Map(MODULOS.map((m) => [m.id, m]));
const TODOS = MODULOS.filter((m) => !m.futuro).map((m) => m.id);

/** inclui as dependências (e escolhe a 1ª opção quando o módulo depende de "um de") */
function resolver(lista) {
  const set = new Set((Array.isArray(lista) ? lista : []).map(String).filter((x) => POR_ID.has(x)));
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const id of [...set]) {
      const m = POR_ID.get(id);
      for (const d of m.depende || []) if (!set.has(d)) { set.add(d); mudou = true; }
      if (m.dependeUm && !m.dependeUm.some((d) => set.has(d))) { set.add(m.dependeUm[0]); mudou = true; }
    }
  }
  return MODULOS.map((m) => m.id).filter((id) => set.has(id)); // ordem do catálogo
}
const ativosDe = (tenant) => (Array.isArray(tenant?.modulos) ? resolver(tenant.modulos) : [...TODOS]);
function telasLiberadas(ativos) {
  const telas = new Set(TELAS_BASE);
  for (const id of ativos) for (const t of POR_ID.get(id)?.telas || []) telas.add(t);
  return [...telas];
}
/** o que a empresa vê (⭐ Meu plano, menu, roteiro) */
async function daEmpresa(supabase, tenantId) {
  const { data } = await supabase.from('tenants').select('*').eq('id', tenantId);
  const t = data?.[0] || {};
  const ativos = ativosDe(t);
  return { segmentos: segmentosDe(t), migrou: 'modulos' in t, completo: !Array.isArray(t.modulos), plano_nome: t.plano_nome || (Array.isArray(t.modulos) ? 'Plano personalizado' : 'Completo'),
    ativos, telas: telasLiberadas(ativos), telas_mapeadas: [...new Set(MODULOS.flatMap((m) => m.telas))], areas: AREAS.map((a) => ({ id: a.id, nome: a.nome, modulos: a.modulos.map((m) => ({ id: m.id, nome: m.nome, desc: m.desc, futuro: !!m.futuro, ativo: ativos.includes(m.id) })) })),
    contato: process.env.PLATAFORMA_CONTATO_EMAIL || null };
}

// ─── Console da Plataforma ──────────────────────────────────────────────────
const catalogo = () => ({ segmentos: SEGMENTOS, areas: AREAS.map((a) => ({ id: a.id, nome: a.nome, modulos: a.modulos.map((m) => ({ id: m.id, nome: m.nome, desc: m.desc, futuro: !!m.futuro, depende: m.depende || [], dependeUm: m.dependeUm || [] })) })), todos: TODOS });
async function listarPlanos(supabase) {
  const { data, error } = await supabase.from('plataforma_planos').select('*');
  if (error) { if (/plataforma_planos|does not exist|schema cache/i.test(error.message)) return { planos: [], sem_migration: true }; throw new Error(error.message); }
  return { planos: (data || []).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')).map((p) => ({ ...p, modulos: resolver(p.modulos) })) };
}
async function salvarPlano(supabase, id, body = {}) {
  const nome = String(body.nome || '').trim().slice(0, 80); if (!nome) return { status: 400, erro: 'Dê um nome ao plano' };
  const linha = { nome, descricao: String(body.descricao || '').trim().slice(0, 300) || null, modulos: resolver(body.modulos), ...require('./assinaturas').precoDoPlano(body) }; // 18v: preço
  if (!linha.modulos.length) return { status: 400, erro: 'Escolha ao menos um módulo' };
  const gravar = (l) => (id ? supabase.from('plataforma_planos').update(l).eq('id', id).select() : supabase.from('plataforma_planos').insert([l]).select());
  let r = await gravar(linha);
  if (r.error && /preco_anual_mensal|publico/.test(r.error.message)) { const { preco_anual_mensal, publico, ...sem } = linha; r = await gravar(sem); } // eslint-disable-line no-unused-vars — sem a 078
  if (r.error && /preco_|moeda|metrica|franquia/.test(r.error.message)) { // sem a 077: salva sem preço
    const { preco_mensal, preco_anual, preco_anual_mensal, publico, moeda, metrica, preco_unidade, franquia, ...sem } = linha; r = await gravar(sem); // eslint-disable-line no-unused-vars
  }
  if (r.error) { if (/duplicate|unique/i.test(r.error.message)) return { status: 409, erro: 'Já existe um plano com esse nome' }; throw new Error(r.error.message); }
  return { plano: r.data[0] };
}
async function excluirPlano(supabase, id) { const { error } = await supabase.from('plataforma_planos').delete().eq('id', id); if (error) throw new Error(error.message); return { ok: true }; }
/** liga/desliga os módulos de uma empresa — { completo: true } volta para "tudo ligado" */
async function definirDaEmpresa(supabase, tenantId, body = {}) {
  const { data } = await supabase.from('tenants').select('*').eq('id', tenantId); const t = data?.[0];
  if (!t) return { status: 404, erro: 'Empresa não encontrada' };
  if (!('modulos' in t)) return { status: 409, erro: 'Falta rodar a migration 071 no Supabase.' };
  const upd = body.completo === true ? { modulos: null, plano_nome: String(body.plano_nome || '').trim().slice(0, 80) || null }
    : { modulos: resolver(body.modulos), plano_nome: String(body.plano_nome || '').trim().slice(0, 80) || null };
  if (upd.modulos && !upd.modulos.length) return { status: 400, erro: 'Escolha ao menos um módulo' };
  if (Array.isArray(body.segmentos)) { // 18u
    if (!('segmentos' in t)) return { status: 409, erro: 'Falta rodar a migration 076 no Supabase (segmentos).' };
    const sg = [...new Set(body.segmentos.map(String))].filter((x) => SEGMENTOS.some((g) => g.id === x)); if (!sg.length) return { status: 400, erro: 'Escolha ao menos um segmento' };
    upd.segmentos = sg;
  }
  const r = await supabase.from('tenants').update(upd).eq('id', tenantId).select(); if (r.error) throw new Error(r.error.message);
  try { require('../middleware/exigirModulo').limparCache(tenantId); } catch { /* ok */ } // 18k: vale na hora
  return { antes: ativosDe(t), ...(await daEmpresa(supabase, tenantId)) };
}

module.exports = { SEGMENTOS, segmentosDe, AREAS, MODULOS, TODOS, TELAS_BASE, resolver, ativosDe, telasLiberadas, daEmpresa, catalogo, listarPlanos, salvarPlano, excluirPlano, definirDaEmpresa };
