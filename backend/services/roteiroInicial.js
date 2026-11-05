// backend/services/roteiroInicial.js — etapa 18i: 👋 Bem-vindo ao sistema
//
// Roteiro das configurações mínimas para o sistema funcionar conforme o TIPO DO NEGÓCIO da empresa
// (tenants.tipos_negocio: transporte · locacao · compras — um ou mais; migration 070).
// Cada passo é conferido pelos próprios dados (nada a marcar à mão): ✓ feito / pendente, obrigatório ou recomendado,
// o porquê e a tela certa. Passo que não se aplica pode ser dispensado (tenants.roteiro_config.dispensados).
// Absorve o "Complete o perfil da empresa" (14d.5) — os itens de lá viraram os primeiros passos.
const PE = () => require('./perfilEmpresa');

const TIPOS = {
  transporte: { nome: '🚛 Transporte', dica: 'BID → pedido → AT, motoristas, documentos fiscais' },
  locacao: { nome: '🏗 Locação de equipamentos', dica: 'contratos, inspeções, medição mensal' },
  compras: { nome: '🛒 Compras e estoque', dica: 'cotações, fornecedores, itens de consumo' },
};
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const qq = (p) => q(p).catch(() => []);
const ROTINA = ['gestor', 'comercial', 'operacao', 'comprador', 'qualidade', 'financeiro', 'fiscal'];

async function tenantDe(supabase, tenantId) { return (await qq(supabase.from('tenants').select('*').eq('id', tenantId)))[0] || null; }

async function montar(supabase, tenantId) {
  const t = await tenantDe(supabase, tenantId) || {};
  const migrou = 'tipos_negocio' in t;
  const tipos = (Array.isArray(t.tipos_negocio) ? t.tipos_negocio : []).filter((x) => TIPOS[x]);
  const dispensados = new Set(Array.isArray(t.roteiro_config?.dispensados) ? t.roteiro_config.dispensados.map(String) : []);
  const da = (tab) => qq(supabase.from(tab).select('*').eq('tenant_id', tenantId));
  const [perfil, us, cols, eqs, jorn, fer] = await Promise.all([PE().status(supabase, tenantId).catch(() => ({ itens: [] })), da('usuarios'), da('colaboradores'), da('equipamentos'), da('tenant_jornadas'), da('tenant_feriados')]);
  const ups = us.length ? await qq(supabase.from('usuario_perfis').select('*').in('usuario_id', us.map((u) => u.id))) : [];
  const perfisDe = (u) => [u.perfil, ...ups.filter((p) => String(p.usuario_id) === String(u.id)).map((p) => p.perfil_codigo)].filter(Boolean);
  const ativos = us.filter((u) => u.ativo !== false && u.ativo !== 0);
  const comRotina = ativos.filter((u) => perfisDe(u).some((p) => ROTINA.includes(p)));
  const tem = (perfil) => ativos.some((u) => perfisDe(u).includes(perfil));
  const colsAtivos = cols.filter((c) => c.situacao !== 'desligado');
  const motoristas = colsAtivos.filter((c) => /motorist/i.test(String(c.funcao?.nome || c.funcao || '')));
  const pe = (id) => perfil.itens?.find((i) => i.id === id) || {};
  const ocCfg = t.ocorrencias_config || {};
  const passos = [];
  const P = (grupo, id, titulo, porque, ok, { obrigatorio = true, tela = 'configuracoes', aba = null, falta = null } = {}) => passos.push({ grupo, id, titulo, porque, ok: !!ok, obrigatorio, tela, aba, falta, dispensado: !ok && dispensados.has(id) });

  // ── todos
  P('empresa', 'dados', 'Dados cadastrais da empresa', 'Razão social, CNPJ, endereço e telefone vão nos contratos, BIDs, relatórios e e-mails.', pe('dados').ok, { aba: 'empresa', falta: pe('dados').falta?.length ? pe('dados').falta.join(', ') : null });
  P('empresa', 'logo', 'Logomarca', 'Aparece no topo dos documentos (contrato, dossiê, relatórios).', pe('logo').ok, { aba: 'empresa', obrigatorio: false });
  P('empresa', 'regiao', 'Estado da operação', 'Define onde o Canal Spot procura fornecedores perto de você.', pe('regiao').ok, { aba: 'empresa', obrigatorio: false });
  P('empresa', 'usuarios', 'Usuários da equipe com perfil', 'O Administrador cuida do sistema; a rotina (aprovar, receber avisos, ser responsável por tarefas) precisa de gestor, comercial, operação… Cadastre ao menos um.', comRotina.length > 0, { tela: 'usuarios' });
  P('empresa', 'jornada', 'Jornada de trabalho', 'Base para prazos, programação e horas da equipe.', pe('jornada').ok ?? jorn.length > 0, { aba: 'jornada' });
  P('empresa', 'feriados', 'Feriados', 'Prazos em dias úteis (documentos fiscais, tarefas) pulam os feriados cadastrados.', fer.length > 0, { aba: 'feriados', obrigatorio: false });
  P('empresa', 'pessoas', 'Colaboradores (👷 Pessoas)', 'Quem pode ser responsável por tarefas, motorista, inspetor… mesmo sem login.', colsAtivos.length > 0, { tela: 'pessoas', obrigatorio: false });
  const precisaEquip = tipos.includes('transporte') || tipos.includes('locacao');
  if (precisaEquip) P(tipos.includes('transporte') ? 'transporte' : 'locacao', 'equipamentos', tipos.includes('transporte') && tipos.includes('locacao') ? 'Frota e equipamentos' : tipos.includes('locacao') ? 'Equipamentos para locação' : 'Frota (cavalos, carretas, pranchas)', 'Sem equipamento cadastrado não dá para programar AT nem colocar em contrato.', eqs.length > 0, { tela: 'equipamentos' });

  // ── transporte
  if (tipos.includes('transporte')) {
    P('transporte', 'motoristas', 'Motoristas', 'Colaboradores com a função "Motorista" aparecem para escolher na AT (com CNH e documentos conferidos).', motoristas.length > 0, { tela: 'pessoas' });
    P('transporte', 'bid_modelo', 'Modelo de BID', 'O BID é a proposta ao cliente; aprovado, vira pedido e AT. Crie (ou importe) o seu modelo.', (await da('bid_modelos')).length > 0, { tela: 'comercial' });
    P('transporte', 'dias_frota', 'Dias de trabalho da frota', 'Quais dias a frota roda — base da utilização e da alocação.', t.frota_dias_semana != null, { aba: 'jornada', obrigatorio: false });
    P('transporte', 'fiscal', 'Quem cuida dos documentos fiscais', 'NF-e, CT-e, averbação e MDF-e de cada trecho viram tarefa para o perfil Fiscal (ou o gestor).', tem('fiscal'), { tela: 'usuarios', obrigatorio: false });
    P('transporte', 'oc_tr', 'Quem é avisado das ocorrências de transporte', 'Avaria, pane ou acidente na viagem: quem recebe o e-mail e fica responsável pela tarefa.', (ocCfg.tr?.pessoas || []).length > 0, { aba: 'empresa', obrigatorio: false });
  }
  // ── locação
  if (tipos.includes('locacao')) {
    P('locacao', 'clientes', 'Clientes', 'O contrato de locação nasce de um cliente cadastrado (CNPJ/CPF, contato).', (await da('clientes')).length > 0, { tela: 'contratos', obrigatorio: false });
    P('locacao', 'modelo_contrato', 'Modelo de contrato', 'O texto do contrato com as suas cláusulas — o cliente lê e aceita pelo sistema.', (await da('contrato_modelos')).length > 0, { tela: 'contratos' });
    P('locacao', 'modelo_inspecao', 'Modelo de inspeção', 'Checklist da entrega, da devolução e das rotinas do equipamento (pode importar da biblioteca).', (await da('inspecao_modelos')).length > 0, { tela: 'inspecoes' });
    P('locacao', 'oc_lc', 'Quem é avisado das ocorrências de locação', 'Quando o cliente registra avaria ou pane: quem recebe o e-mail e fica responsável pela tarefa.', (ocCfg.lc?.pessoas || []).length > 0, { aba: 'empresa', obrigatorio: false });
  }
  // ── compras
  if (tipos.includes('compras')) {
    P('compras', 'fornecedores', 'Fornecedores', 'Seus fornecedores locais (os da plataforma já aparecem). Cotação vai para eles.', (await da('fornecedores')).length > 0, { tela: 'fornecedores', obrigatorio: false });
    P('compras', 'itens', 'Itens de consumo do estoque', 'Peças e materiais com estoque mínimo — base da recompra.', (await da('itens_consumo')).length > 0, { tela: 'estoque', obrigatorio: false });
    P('compras', 'comprador', 'Quem compra', 'Usuário com perfil Comprador recebe as requisições e envia as cotações.', tem('comprador'), { tela: 'usuarios', obrigatorio: false });
  }
  const contam = passos.filter((p) => !p.dispensado);
  const obrig = contam.filter((p) => p.obrigatorio);
  return { migrou, tipos, tipos_disponiveis: TIPOS, escolheu: tipos.length > 0, passos,
    feitos: contam.filter((p) => p.ok).length, total: contam.length,
    obrigatorios: { feitos: obrig.filter((p) => p.ok).length, total: obrig.length },
    completo: tipos.length > 0 && contam.every((p) => p.ok) };
}

async function salvar(supabase, tenantId, body = {}) {
  const t = await tenantDe(supabase, tenantId); if (!t) return { status: 404, erro: 'Empresa não encontrada' };
  if (!('tipos_negocio' in t)) return { status: 409, erro: 'Falta rodar a migration 070 no Supabase.' };
  const upd = {};
  if (Array.isArray(body.tipos)) { const v = [...new Set(body.tipos.map(String))].filter((x) => TIPOS[x]); if (!v.length) return { status: 400, erro: 'Escolha ao menos um tipo de negócio' }; upd.tipos_negocio = v; }
  if (body.dispensar && body.dispensar.id) {
    const set = new Set(Array.isArray(t.roteiro_config?.dispensados) ? t.roteiro_config.dispensados.map(String) : []);
    if (body.dispensar.valor === false) set.delete(String(body.dispensar.id)); else set.add(String(body.dispensar.id).slice(0, 40));
    upd.roteiro_config = { ...(t.roteiro_config || {}), dispensados: [...set] };
  }
  if (Object.keys(upd).length) { const { error } = await supabase.from('tenants').update(upd).eq('id', tenantId); if (error) throw new Error(error.message); }
  return montar(supabase, tenantId);
}

module.exports = { TIPOS, montar, salvar };
