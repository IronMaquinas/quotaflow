// backend/services/roteiroInicial.js — etapa 18i: 👋 Bem-vindo ao sistema
//
// Roteiro das configurações mínimas para o sistema funcionar com os MÓDULOS do plano da empresa (18j — services/modulos.js;
// antes, 18i, era por "tipo de negócio": tenants.tipos_negocio ficou sem uso). Quem tem só Suprimentos vê só os passos de Suprimentos.
// Cada passo é conferido pelos próprios dados (nada a marcar à mão): ✓ feito / pendente, obrigatório ou recomendado,
// o porquê e a tela certa. Passo recomendado que não se aplica pode ser dispensado (tenants.roteiro_config.dispensados).
// Absorve o "Complete o perfil da empresa" (14d.5).
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
  const migrou = 'roteiro_config' in t;
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
  // 18j: os passos vêm dos MÓDULOS ligados (plano contratado), não mais de uma pergunta
  const MOD = require('./modulos'); const modAtivos = MOD.ativosDe(t); const liga = (m) => modAtivos.includes(m);
  const areaDe = (m) => (m ? MOD.MODULOS.find((x) => x.id === m)?.area || 'empresa' : 'empresa');
  const passos = [];
  const P = (modulo, id, titulo, porque, ok, { obrigatorio = true, tela = 'configuracoes', aba = null, falta = null } = {}) => {
    if (modulo && !(Array.isArray(modulo) ? modulo.every(liga) : liga(modulo))) return;
    passos.push({ grupo: areaDe(Array.isArray(modulo) ? modulo[modulo.length - 1] : modulo), id, titulo, porque, ok: !!ok, obrigatorio, tela, aba, falta, dispensado: !ok && dispensados.has(id) });
  };
  // ── base (todo plano)
  P(null, 'dados', 'Dados cadastrais da empresa', 'Razão social, CNPJ, endereço e telefone vão nos documentos, relatórios e e-mails.', pe('dados').ok, { aba: 'empresa', falta: pe('dados').falta?.length ? pe('dados').falta.join(', ') : null });
  P(null, 'usuarios', 'Usuários da equipe com perfil', 'O Administrador cuida do sistema; a rotina (aprovar, receber avisos, ser responsável por tarefas) precisa de gestor, comprador, operação… Cadastre ao menos um.', comRotina.length > 0, { tela: 'usuarios' });
  P(null, 'logo', 'Logomarca', 'Aparece no topo dos documentos e relatórios.', pe('logo').ok, { aba: 'empresa', obrigatorio: false });
  P('cotacoes_spot', 'regiao', 'Estado da operação', 'Define onde o Canal Spot procura fornecedores perto de você.', pe('regiao').ok, { aba: 'empresa', obrigatorio: false });
  // ── pessoas
  P('jornada', 'jornada', 'Jornada de trabalho', 'Base para prazos, programação e horas da equipe.', pe('jornada').ok ?? jorn.length > 0, { aba: 'jornada' });
  P('jornada', 'feriados', 'Feriados', 'Prazos em dias úteis pulam os feriados cadastrados.', fer.length > 0, { aba: 'feriados', obrigatorio: false });
  P('colaboradores', 'pessoas', 'Colaboradores (👷 Pessoas)', 'Quem pode ser responsável por tarefas, motorista, inspetor… mesmo sem login.', colsAtivos.length > 0, { tela: 'pessoas', obrigatorio: liga('treinamentos') || liga('epi') });
  // ── operações
  P('frota_equipamentos', 'equipamentos', liga('transporte') ? 'Frota e equipamentos' : 'Equipamentos', 'Sem equipamento cadastrado não dá para programar AT, inspecionar nem colocar em contrato.', eqs.length > 0, { tela: 'equipamentos' });
  P('transporte', 'motoristas', 'Motoristas', 'Colaboradores com a função "Motorista" aparecem para escolher na AT (com CNH e documentos conferidos).', motoristas.length > 0, { tela: 'pessoas' });
  P('transporte', 'dias_frota', 'Dias de trabalho da frota', 'Quais dias a frota roda — base da utilização e da alocação.', t.frota_dias_semana != null, { aba: 'jornada', obrigatorio: false });
  P('fiscal', 'fiscal', 'Quem cuida dos documentos fiscais', 'NF-e, CT-e, averbação e MDF-e de cada trecho viram tarefa para o perfil Fiscal (ou o gestor).', tem('fiscal'), { tela: 'usuarios', obrigatorio: false });
  P(['transporte', 'ocorrencias'], 'oc_tr', 'Quem é avisado das ocorrências de transporte', 'Avaria, pane ou acidente na viagem: quem recebe o e-mail e fica responsável pela tarefa.', (ocCfg.tr?.pessoas || []).length > 0, { aba: 'empresa', obrigatorio: false });
  // ── comercial
  P('crm_bid', 'bid_modelo', 'Modelo de BID', 'O BID é a proposta ao cliente; aprovado, vira pedido (e AT, no transporte). Crie ou importe o seu modelo.', (await da('bid_modelos')).length > 0, { tela: 'comercial' });
  P('contratos_locacao', 'clientes', 'Clientes', 'O contrato de locação nasce de um cliente cadastrado (CNPJ/CPF, contato).', (await da('clientes')).length > 0, { tela: 'contratos', obrigatorio: false });
  P('contratos_locacao', 'modelo_contrato', 'Modelo de contrato', 'O texto do contrato com as suas cláusulas — o cliente lê e aceita pelo sistema.', (await da('contrato_modelos')).length > 0, { tela: 'contratos' });
  P(['contratos_locacao', 'ocorrencias'], 'oc_lc', 'Quem é avisado das ocorrências de locação', 'Quando o cliente registra avaria ou pane: quem recebe o e-mail e fica responsável pela tarefa.', (ocCfg.lc?.pessoas || []).length > 0, { aba: 'empresa', obrigatorio: false });
  // ── qualidade
  P('inspecoes', 'modelo_inspecao', 'Modelo de inspeção', 'O checklist das inspeções (pode importar da biblioteca).', (await da('inspecao_modelos')).length > 0, { tela: 'inspecoes' });
  // ── suprimentos
  P('fornecedores', 'fornecedores', 'Fornecedores', 'Seus fornecedores locais (os da plataforma já aparecem). Cotação vai para eles.', (await da('fornecedores')).length > 0, { tela: 'fornecedores', obrigatorio: false });
  P('estoque', 'itens', 'Itens de consumo do estoque', 'Peças e materiais com estoque mínimo — base da recompra.', (await da('itens_consumo')).length > 0, { tela: 'estoque', obrigatorio: false });
  P('compras', 'comprador', 'Quem compra', 'Usuário com perfil Comprador recebe as requisições e envia as cotações.', tem('comprador'), { tela: 'usuarios', obrigatorio: false });
  const contam = passos.filter((p) => !p.dispensado);
  const obrig = contam.filter((p) => p.obrigatorio);
  return { migrou, plano_nome: t.plano_nome || (Array.isArray(t.modulos) ? 'Plano personalizado' : 'Completo'), passos,
    feitos: contam.filter((p) => p.ok).length, total: contam.length,
    obrigatorios: { feitos: obrig.filter((p) => p.ok).length, total: obrig.length },
    completo: contam.every((p) => p.ok) };
}

async function salvar(supabase, tenantId, body = {}) {
  const t = await tenantDe(supabase, tenantId); if (!t) return { status: 404, erro: 'Empresa não encontrada' };
  if (!('roteiro_config' in t)) return { status: 409, erro: 'Falta rodar a migration 070 no Supabase.' };
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
