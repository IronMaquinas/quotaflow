// backend/services/epi.js — etapa 12d.1
//
// EPI = item de consumo do Estoque marcado como EPI (tabela epi_itens): categoria, CA, validade do CA,
// troca a cada X dias. O saldo é o do Estoque (itens_consumo.saldo_atual / itens_consumo_enderecos).
// Endereço padrão "EPI" (tipo armazem) criado sozinho por tenant.
// Kit da função (funcoes.epis) usa CATEGORIAS — a biblioteca vale para todos os tenants.
//
// 12d.1b: catálogo de tipos no banco (epi_tipos — tenant_id NULL = catálogo do QuotaFlow, mantido no Console;
// o tenant cria os dele). TIPOS_EPI abaixo vira só a reserva enquanto a migration 027 não roda.
// Tamanho no item (epi_itens.tamanho); "grade" do tipo diz qual tamanho do colaborador usar.
//
// Regras do backend: sem DB.raw; ids com String(); filtros sem null.

const ENDERECO_EPI = 'EPI';

// Categorias de EPI (fonte única: o frontend recebe pela API)
const TIPOS_EPI = [
  { codigo: 'capacete', nome: 'Capacete de segurança' },
  { codigo: 'oculos', nome: 'Óculos de proteção' },
  { codigo: 'protetor_facial', nome: 'Protetor facial' },
  { codigo: 'mascara_solda', nome: 'Máscara de solda' },
  { codigo: 'protetor_auricular', nome: 'Protetor auricular' },
  { codigo: 'mascara_pff2', nome: 'Máscara PFF2' },
  { codigo: 'respirador', nome: 'Respirador com filtro químico' },
  { codigo: 'luva_vaqueta', nome: 'Luva de vaqueta / raspa' },
  { codigo: 'luva_nitrilica', nome: 'Luva nitrílica' },
  { codigo: 'luva_isolante', nome: 'Luva isolante (elétrica)' },
  { codigo: 'luva_anticorte', nome: 'Luva anticorte' },
  { codigo: 'botina', nome: 'Botina de segurança' },
  { codigo: 'botina_isolante', nome: 'Botina isolante (sem metal)' },
  { codigo: 'bota_pvc', nome: 'Bota de PVC' },
  { codigo: 'avental_pvc', nome: 'Avental de PVC' },
  { codigo: 'uniforme', nome: 'Uniforme / vestimenta' },
  { codigo: 'jaqueta_termica', nome: 'Jaqueta térmica' },
  { codigo: 'colete_refletivo', nome: 'Colete refletivo' },
  { codigo: 'cinto_paraquedista', nome: 'Cinto paraquedista + talabarte' },
  { codigo: 'protetor_solar', nome: 'Protetor solar' },
  { codigo: 'creme_protetor', nome: 'Creme de proteção (luva química)' },
  { codigo: 'outro', nome: 'Outro EPI' },
];

// Risco da função (services/funcoes.js → RISCOS) → categorias sugeridas. É SUGESTÃO: o gestor/SESMT confirma.
const SUGESTAO_POR_RISCO = {
  ruido: ['protetor_auricular'],
  calor: ['protetor_solar'],
  frio: ['jaqueta_termica'],
  umidade: ['bota_pvc', 'avental_pvc'],
  radiacao: ['mascara_solda'],
  quimico: ['luva_nitrilica', 'oculos', 'creme_protetor'],
  poeira_fumos: ['mascara_pff2'],
  produtos_perigosos: ['luva_nitrilica', 'oculos', 'respirador'],
  biologico: ['luva_nitrilica'],
  levantamento: ['luva_vaqueta'],
  transito: ['colete_refletivo'],
  altura: ['cinto_paraquedista', 'capacete'],
  queda: ['botina'],
  eletricidade: ['luva_isolante', 'botina_isolante', 'oculos'],
  maquinas: ['oculos', 'luva_vaqueta', 'protetor_auricular'],
  prensamento: ['botina', 'luva_vaqueta'],
  explosao_pneu: ['protetor_facial', 'oculos'],
};

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const texto = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const CODIGO = /^[a-z0-9_]{1,40}$/;
const GRADES = ['calcado', 'camisa', 'calca', 'luva'];
// sem lista do banco, aceita qualquer código bem formado (o frontend só oferece os válidos)
const tipoValido = (t, codigos) => (codigos ? codigos.has(String(t)) : CODIGO.test(String(t || '')));
const slug = (n) => String(n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 36);

/** Catálogo do QuotaFlow (tenant_id NULL), ativo, em ordem */
async function catalogoEpi(supabase) {
  const l = await q(supabase.from('epi_tipos').select('*').is('tenant_id', null));
  return l.filter((t) => t.ativo !== false).sort((a, b) => (a.ordem - b.ordem) || String(a.nome).localeCompare(String(b.nome)));
}

/** Tipos que o tenant usa: catálogo + os dele (mesmo código do tenant substitui). Sem a 027: a lista fixa. */
async function tiposDoTenant(supabase, tenantId) {
  try {
    const todos = await q(supabase.from('epi_tipos').select('*'));
    const vis = todos.filter((t) => t.ativo !== false && (t.tenant_id == null || String(t.tenant_id) === String(tenantId)));
    const por = new Map();
    for (const t of vis.sort((a, b) => (a.tenant_id == null ? 0 : 1) - (b.tenant_id == null ? 0 : 1))) por.set(t.codigo, { ...t, proprio: t.tenant_id != null });
    return [...por.values()].sort((a, b) => (a.ordem - b.ordem) || String(a.nome).localeCompare(String(b.nome)));
  } catch (e) {
    if (!/epi_tipos/.test(String(e.message))) throw e;
    return TIPOS_EPI.map((t, i) => ({ ...t, grade: null, troca_dias_padrao: null, ordem: i, proprio: false }));
  }
}

function validarTipo(body, { parcial = false } = {}) {
  const erros = [], out = {};
  const tem = (k) => body[k] !== undefined;
  if (!parcial || tem('nome')) { const n = texto(body.nome, 80); if (!n) erros.push('Informe o nome do tipo de EPI'); else out.nome = n; }
  if (tem('grade')) { if (body.grade && !GRADES.includes(body.grade)) erros.push('Tamanho inválido'); else out.grade = body.grade || null; }
  if (tem('troca_dias_padrao')) {
    const d = body.troca_dias_padrao === '' || body.troca_dias_padrao == null ? null : parseInt(body.troca_dias_padrao, 10);
    if (d !== null && !(d >= 1 && d <= 3650)) erros.push('Troca entre 1 e 3650 dias'); else out.troca_dias_padrao = d;
  }
  if (tem('ordem')) out.ordem = parseInt(body.ordem, 10) || 100;
  return { erros, dados: out };
}

/** Tipo próprio do tenant (código p_…) */
async function criarTipoTenant(supabase, tenantId, body) {
  const { erros, dados } = validarTipo(body || {});
  if (erros.length) return { status: 400, erro: erros[0] };
  const tipos = await tiposDoTenant(supabase, tenantId);
  if (tipos.some((t) => t.nome.toLowerCase() === dados.nome.toLowerCase())) return { status: 409, erro: 'Esse tipo de EPI já existe' };
  const codigo = 'p_' + (slug(dados.nome) || 'epi');
  const { data, error } = await supabase.from('epi_tipos').insert([{ ...dados, tenant_id: tenantId, codigo, ordem: dados.ordem || 500 }]).select();
  if (error) { if (/epi_tipos_codigo_unico/.test(error.message)) return { status: 409, erro: 'Já existe um tipo com nome parecido' }; throw new Error(error.message); }
  return { tipo: { ...data[0], proprio: true } };
}

// Console: catálogo do QuotaFlow
async function criarTipoCatalogo(supabase, body) {
  const { erros, dados } = validarTipo(body || {});
  if (erros.length) return { status: 400, erro: erros[0] };
  const codigo = texto(body.codigo, 40) ? String(body.codigo).trim().toLowerCase() : slug(dados.nome);
  if (!CODIGO.test(codigo) || codigo.startsWith('p_')) return { status: 400, erro: 'Código: letras minúsculas, números e _ (não pode começar com p_)' };
  const { data, error } = await supabase.from('epi_tipos').insert([{ ...dados, tenant_id: null, codigo }]).select();
  if (error) { if (/epi_tipos_codigo_unico/.test(error.message)) return { status: 409, erro: 'Já existe um tipo com esse código' }; throw new Error(error.message); }
  return { tipo: data[0] };
}
async function editarTipoCatalogo(supabase, id, body) {
  const { erros, dados } = validarTipo(body || {}, { parcial: true });
  if (erros.length) return { status: 400, erro: erros[0] };
  if (body.ativo !== undefined) dados.ativo = body.ativo !== false;
  const { data, error } = await supabase.from('epi_tipos').update(dados).eq('id', id).is('tenant_id', null).select();
  if (error) throw new Error(error.message);
  if (!data?.length) return { status: 404, erro: 'Tipo não encontrado' };
  return { tipo: data[0] };
}

/** Kit sugerido pelos riscos (sem repetir, na ordem da lista de tipos) */
function sugerirKit(riscos = []) {
  const set = new Set();
  for (const r of riscos) for (const t of SUGESTAO_POR_RISCO[r] || []) set.add(t);
  return TIPOS_EPI.filter((t) => set.has(t.codigo)).map((t) => ({ tipo: t.codigo, quantidade: 1, troca_dias: null }));
}

/** Valida o kit da função: [{ tipo, quantidade 1–99, troca_dias 1–3650 | null }] */
function validarKit(lista, codigos) {
  if (!Array.isArray(lista)) return { erro: 'Kit de EPI inválido' };
  const vistos = new Set(), out = [];
  for (const k of lista.slice(0, 40)) {
    const tipo = String(typeof k === 'string' ? k : k?.tipo || '');
    if (!tipoValido(tipo, codigos) || vistos.has(tipo)) continue;
    vistos.add(tipo);
    const qtd = parseInt(k?.quantidade, 10);
    const dias = k?.troca_dias === '' || k?.troca_dias == null ? null : parseInt(k.troca_dias, 10);
    if (dias !== null && !(dias >= 1 && dias <= 3650)) return { erro: 'Troca do EPI entre 1 e 3650 dias' };
    out.push({ tipo, quantidade: qtd >= 1 && qtd <= 99 ? qtd : 1, troca_dias: dias });
  }
  return { kit: out };
}

function validarEpiItem(body, { parcial = false, codigos } = {}) {
  const erros = [], out = {};
  const tem = (k) => body[k] !== undefined;
  if (!parcial || tem('tipo')) { if (!tipoValido(body.tipo, codigos)) erros.push('Escolha o tipo de EPI'); else out.tipo = body.tipo; }
  if (tem('tamanho')) out.tamanho = texto(body.tamanho, 10);
  if (tem('ca')) {
    const c = texto(body.ca, 20);
    const dig = c ? c.replace(/\D/g, '') : '';
    if (c && !/^\d{1,7}$/.test(dig)) erros.push('CA deve ter de 1 a 7 números');
    else out.ca = dig || null;
  }
  if (tem('ca_validade')) {
    if (body.ca_validade && !DATA.test(String(body.ca_validade))) erros.push('Validade do CA inválida'); else out.ca_validade = body.ca_validade || null;
  }
  if (tem('troca_dias')) {
    const d = body.troca_dias === '' || body.troca_dias == null ? null : parseInt(body.troca_dias, 10);
    if (d !== null && !(d >= 1 && d <= 3650)) erros.push('Troca entre 1 e 3650 dias'); else out.troca_dias = d;
  }
  if (tem('obs')) out.obs = texto(body.obs, 1000);
  return { erros, dados: out };
}

function hojeBR(agora = new Date()) {
  const l = new Date(agora.getTime() - 3 * 3600000);
  return l.toISOString().slice(0, 10);
}
function situacaoCA(validade, agora = new Date()) {
  if (!validade) return { situacao: 'sem_validade', dias: null };
  const a = Date.parse(hojeBR(agora) + 'T00:00:00Z'), b = Date.parse(String(validade).slice(0, 10) + 'T00:00:00Z');
  const dias = Math.round((b - a) / 86400000);
  return { situacao: dias < 0 ? 'vencido' : dias <= 30 ? 'vence_30' : 'ok', dias };
}

/** Cria o endereço "EPI" do tenant se ainda não existe (ou reativa). Nunca quebra a tela. */
async function garantirEnderecoEpi(supabase, tenantId) {
  const l = await q(supabase.from('enderecos').select('*').eq('tenant_id', tenantId).eq('codigo', ENDERECO_EPI));
  if (l[0]) {
    if (l[0].ativo === false) await supabase.from('enderecos').update({ ativo: true }).eq('id', l[0].id).eq('tenant_id', tenantId);
    return { ...l[0], ativo: true };
  }
  const { data, error } = await supabase.from('enderecos').insert([{ tenant_id: tenantId, codigo: ENDERECO_EPI, descricao: 'Depósito de EPI (criado pelo sistema)', tipo: 'armazem', ativo: true }]).select();
  if (error) throw new Error(error.message);
  return data[0];
}

/** A doca RECEBIMENTO precisa estar cadastrada para o "Guardar no EPI" (transferência) funcionar */
async function garantirRecebimento(supabase, tenantId) {
  const l = await q(supabase.from('enderecos').select('*').eq('tenant_id', tenantId).eq('codigo', 'RECEBIMENTO'));
  if (l[0]) return l[0];
  const { data, error } = await supabase.from('enderecos').insert([{ tenant_id: tenantId, codigo: 'RECEBIMENTO', descricao: 'Doca de recebimento', tipo: 'recebimento', ativo: true }]).select();
  if (error) throw new Error(error.message);
  return data[0];
}

/** Itens de EPI do tenant com dados do item de consumo e saldo (total e no endereço EPI) */
async function listarEpiItens(supabase, tenantId, { agora } = {}) {
  const epis = (await q(supabase.from('epi_itens').select('*').eq('tenant_id', tenantId))).filter((e) => e.ativo !== false);
  if (!epis.length) return [];
  const ids = epis.map((e) => e.item_consumo_id);
  const itens = await q(supabase.from('itens_consumo').select('*').eq('tenant_id', tenantId).in('id', ids));
  const ends = await q(supabase.from('itens_consumo_enderecos').select('*').eq('tenant_id', tenantId).in('item_consumo_id', ids)).catch(() => []);
  const itemPor = new Map(itens.map((i) => [String(i.id), i]));
  return epis.map((e) => {
    const it = itemPor.get(String(e.item_consumo_id)) || {};
    const meus = ends.filter((x) => String(x.item_consumo_id) === String(e.item_consumo_id));
    const ca = situacaoCA(e.ca_validade, agora);
    return {
      ...e,
      item_nome: it.nome || '(item apagado)', sku: it.sku || null, unidade: it.unidade_medida || 'UN', fabricante: it.fabricante || null,
      item_ativo: it.ativo !== false,
      saldo_total: Number(it.saldo_atual) || 0,
      saldo_epi: Number(meus.find((x) => x.endereco === ENDERECO_EPI)?.saldo) || 0,
      saldo_recebimento: Number(meus.find((x) => x.endereco === 'RECEBIMENTO')?.saldo) || 0, // doca: falta guardar
      ca_situacao: ca.situacao, ca_dias: ca.dias,
    };
  }).sort((a, b) => String(a.tipo).localeCompare(String(b.tipo)) || String(a.item_nome).localeCompare(String(b.item_nome)));
}

/** Kit da função ligado aos itens do tenant: para cada categoria, quais itens existem e o saldo */
function kitComItens(kit, epiItens) {
  return (kit || []).map((k) => {
    const itens = epiItens.filter((e) => e.tipo === k.tipo && e.item_ativo);
    return { ...k, itens: itens.length, saldo: itens.reduce((s, e) => s + e.saldo_total, 0) };
  });
}

const LISTAS_EPI = { tipos_epi: TIPOS_EPI, sugestao_por_risco: SUGESTAO_POR_RISCO };

module.exports = {
  ENDERECO_EPI, TIPOS_EPI, SUGESTAO_POR_RISCO, LISTAS_EPI,
  GRADES, catalogoEpi, tiposDoTenant, validarTipo, criarTipoTenant, criarTipoCatalogo, editarTipoCatalogo,
  sugerirKit, validarKit, validarEpiItem, situacaoCA, garantirEnderecoEpi, garantirRecebimento, listarEpiItens, kitComItens,
};
