// backend/services/funcoes.js — etapa 12d.0
//
// Funções (cargos) com descritivo e documentos exigidos.
//   • Biblioteca (tenant_id NULL): mantida pelo Console da Plataforma; todos os tenants veem.
//   • Importar = COPIAR para o tenant (origem_id + origem_versao). Mudança na biblioteca nunca
//     altera a cópia sozinha: aparece "versão nova" e o tenant decide atualizar.
//   • Ficha do colaborador: documentos exigidos pela função × documentos que ele tem
//     (falta · vencido · vence_30 · ok · sem_vencimento).
//
// Regras do backend: sem DB.raw; ids com String(); filtros sem null (usa .is para NULL).

const { listarDocumentos, tiposDoTenant } = require('./documentos');
const E = require('./epi'); // etapa 12d.1 — kit de EPI

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const texto = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const idValido = (id) => /^\d+$/.test(String(id));

// 12d.0.2 — listas fixas (fonte única: o frontend recebe pela API)
const ESCOLARIDADES = [
  { codigo: 'fundamental_incompleto', nome: 'Fundamental incompleto' },
  { codigo: 'fundamental_completo', nome: 'Fundamental completo' },
  { codigo: 'medio_incompleto', nome: 'Médio incompleto' },
  { codigo: 'medio_completo', nome: 'Médio completo' },
  { codigo: 'tecnico', nome: 'Técnico' },
  { codigo: 'superior_incompleto', nome: 'Superior incompleto' },
  { codigo: 'superior_completo', nome: 'Superior completo' },
  { codigo: 'pos_graduacao', nome: 'Pós-graduação' },
];
// Grupos do PGR (NR-1/NR-9): físico, químico, biológico, ergonômico, acidente
const RISCOS = [
  { codigo: 'ruido', nome: 'Ruído', grupo: 'Físico' },
  { codigo: 'vibracao', nome: 'Vibração', grupo: 'Físico' },
  { codigo: 'calor', nome: 'Calor / sol', grupo: 'Físico' },
  { codigo: 'frio', nome: 'Frio (câmara fria)', grupo: 'Físico' },
  { codigo: 'umidade', nome: 'Umidade', grupo: 'Físico' },
  { codigo: 'radiacao', nome: 'Radiação (solda)', grupo: 'Físico' },
  { codigo: 'quimico', nome: 'Óleos, graxas e solventes', grupo: 'Químico' },
  { codigo: 'poeira_fumos', nome: 'Poeira e fumos', grupo: 'Químico' },
  { codigo: 'produtos_perigosos', nome: 'Produtos perigosos (carga)', grupo: 'Químico' },
  { codigo: 'biologico', nome: 'Agentes biológicos', grupo: 'Biológico' },
  { codigo: 'postura', nome: 'Postura', grupo: 'Ergonômico' },
  { codigo: 'levantamento', nome: 'Levantamento de peso', grupo: 'Ergonômico' },
  { codigo: 'repetitivo', nome: 'Movimento repetitivo', grupo: 'Ergonômico' },
  { codigo: 'jornada', nome: 'Jornada longa / noturna', grupo: 'Ergonômico' },
  { codigo: 'transito', nome: 'Trânsito', grupo: 'Acidente' },
  { codigo: 'altura', nome: 'Trabalho em altura', grupo: 'Acidente' },
  { codigo: 'queda', nome: 'Queda (subir/descer do veículo, piso)', grupo: 'Acidente' },
  { codigo: 'eletricidade', nome: 'Eletricidade', grupo: 'Acidente' },
  { codigo: 'maquinas', nome: 'Máquinas e ferramentas', grupo: 'Acidente' },
  { codigo: 'prensamento', nome: 'Prensamento / esmagamento', grupo: 'Acidente' },
  { codigo: 'explosao_pneu', nome: 'Explosão de pneu', grupo: 'Acidente' },
  { codigo: 'incendio', nome: 'Incêndio / explosão', grupo: 'Acidente' },
];
const LISTAS = { escolaridades: ESCOLARIDADES, riscos: RISCOS, ...E.LISTAS_EPI };
const CAMPOS_CONTEUDO = ['descritivo', 'requisitos', 'documentos', 'cbo', 'setor', 'escolaridade', 'riscos', 'responde_a', 'epis'];
const copiarConteudo = (m) => ({
  descritivo: m.descritivo ?? null, requisitos: m.requisitos ?? null, documentos: m.documentos || [],
  epis: m.epis || [], treinamentos: m.treinamentos || [],
  cbo: m.cbo ?? null, setor: m.setor ?? null, escolaridade: m.escolaridade ?? null, riscos: m.riscos || [], responde_a: m.responde_a ?? null,
});

function validarFuncao(body, { parcial = false } = {}) {
  const erros = [], out = {};
  const tem = (k) => body[k] !== undefined;
  if (!parcial || tem('nome')) {
    const n = texto(body.nome, 120);
    if (!n) erros.push('Informe o nome da função'); else out.nome = n;
  }
  if (tem('descritivo')) out.descritivo = texto(body.descritivo, 8000);
  if (tem('requisitos')) out.requisitos = texto(body.requisitos, 4000);
  if (tem('cbo')) {
    const c = texto(body.cbo, 10);
    if (c && !/^\d{4}-?\d{2}$/.test(c)) erros.push('CBO no formato 0000-00');
    else out.cbo = c ? `${c.replace('-', '').slice(0, 4)}-${c.replace('-', '').slice(4)}` : null;
  }
  if (tem('setor')) out.setor = texto(body.setor, 80);
  if (tem('responde_a')) out.responde_a = texto(body.responde_a, 120);
  if (tem('escolaridade')) {
    const e = texto(body.escolaridade, 40);
    if (e && !ESCOLARIDADES.some((x) => x.codigo === e)) erros.push('Escolaridade inválida'); else out.escolaridade = e;
  }
  if (tem('riscos')) {
    if (!Array.isArray(body.riscos)) erros.push('Riscos inválidos');
    else out.riscos = [...new Set(body.riscos.map(String))].filter((r) => RISCOS.some((x) => x.codigo === r));
  }
  if (tem('epis')) {
    const k = E.validarKit(body.epis);
    if (k.erro) erros.push(k.erro); else out.epis = k.kit;
  }
  if (tem('documentos')) {
    if (!Array.isArray(body.documentos)) erros.push('Documentos exigidos inválidos');
    else {
      const vistos = new Set(), lista = [];
      for (const d of body.documentos.slice(0, 40)) {
        const codigo = texto(typeof d === 'string' ? d : d?.codigo, 60);
        if (!codigo || vistos.has(codigo)) continue;
        vistos.add(codigo);
        lista.push({ codigo, ...(d?.obs ? { obs: texto(d.obs, 200) } : {}) });
      }
      out.documentos = lista;
    }
  }
  return { erros, dados: out };
}

const doTenant = (f, tenantId) => f && f.tenant_id != null && String(f.tenant_id) === String(tenantId);

async function biblioteca(supabase) {
  const l = await q(supabase.from('funcoes').select('*').is('tenant_id', null));
  return l.filter((f) => f.ativo !== false).sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
}

async function funcaoPorId(supabase, id) {
  if (!idValido(id)) return null;
  return (await q(supabase.from('funcoes').select('*').eq('id', id)))[0] || null;
}

/** Funções ativas do tenant, com nº de colaboradores e aviso de versão nova da biblioteca */
async function listarFuncoes(supabase, tenantId) {
  const lista = (await q(supabase.from('funcoes').select('*').eq('tenant_id', tenantId))).filter((f) => f.ativo !== false);
  const bib = await biblioteca(supabase);
  const bibPor = new Map(bib.map((b) => [String(b.id), b]));
  const colabs = await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId));
  return lista.map((f) => {
    const o = f.origem_id != null ? bibPor.get(String(f.origem_id)) : null;
    return {
      ...f,
      origem_nome: o?.nome || null,
      versao_nova: !!(o && Number(o.versao) > Number(f.origem_versao || 0)),
      colaboradores: colabs.filter((c) => String(c.funcao_id) === String(f.id) && c.situacao !== 'desligado').length,
    };
  }).sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
}

/** Copia um modelo da biblioteca para o tenant */
async function importar(supabase, tenantId, bibliotecaId, { nome } = {}) {
  const m = await funcaoPorId(supabase, bibliotecaId);
  if (!m || m.tenant_id != null || m.ativo === false) return { status: 404, erro: 'Modelo não encontrado na biblioteca' };
  const nomeFinal = texto(nome, 120) || m.nome;
  const existentes = (await q(supabase.from('funcoes').select('*').eq('tenant_id', tenantId))).filter((f) => f.ativo !== false);
  if (existentes.some((f) => String(f.nome).toLowerCase() === nomeFinal.toLowerCase())) {
    return { status: 409, erro: `Sua empresa já tem a função "${nomeFinal}". Importe com outro nome ou edite a existente.` };
  }
  const { data, error } = await supabase.from('funcoes').insert([{
    tenant_id: tenantId, nome: nomeFinal, ...copiarConteudo(m),
    origem_id: m.id, origem_versao: m.versao || 1,
  }]).select();
  if (error) throw new Error(error.message);
  return { funcao: data[0] };
}

/** Traz a versão atual do modelo para a cópia do tenant (mantém o nome que o tenant deu) */
async function atualizarDaBiblioteca(supabase, tenantId, funcaoId) {
  const f = await funcaoPorId(supabase, funcaoId);
  if (!doTenant(f, tenantId)) return { status: 404, erro: 'Função não encontrada' };
  const m = f.origem_id != null ? await funcaoPorId(supabase, f.origem_id) : null;
  if (!m || m.tenant_id != null) return { status: 400, erro: 'Esta função não veio da biblioteca' };
  const { data, error } = await supabase.from('funcoes').update({
    ...copiarConteudo(m), origem_versao: m.versao || 1,
    atualizado_em: new Date().toISOString(),
  }).eq('id', f.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return { funcao: data[0] };
}

const ORDEM_SIT = { falta: 0, vencido: 1, vence_30: 2, ok: 3, sem_vencimento: 4 };

/** Monta a ficha: um item por documento exigido. Puro (sem banco) para testar fácil. */
function montarFicha(funcao, docsDoColab, tipos) {
  const exigidos = Array.isArray(funcao?.documentos) ? funcao.documentos : [];
  const tipoPorCodigo = new Map((tipos || []).filter((t) => t.alvo === 'colaborador').map((t) => [t.codigo, t]));
  const itens = exigidos.map((e) => {
    const tipo = tipoPorCodigo.get(e.codigo) || null;
    const nomeTipo = tipo?.nome || e.codigo;
    // o documento vigente desse tipo (pelo tipo_id ou, se o tipo foi apagado, pelo nome copiado)
    const candidatos = docsDoColab.filter((d) => !d.substituido_por && ((tipo && String(d.tipo_id) === String(tipo.id)) || d.tipo_nome === nomeTipo));
    candidatos.sort((a, b) => String(b.vence_em || '9999').localeCompare(String(a.vence_em || '9999')));
    const doc = candidatos[0] || null;
    return {
      codigo: e.codigo, nome: nomeTipo, obs: e.obs || null, tipo_id: tipo?.id || null,
      tipo_existe: !!tipo, validade_meses_padrao: tipo?.validade_meses_padrao || null,
      situacao: doc ? doc.situacao : 'falta', dias: doc ? doc.dias : null,
      documento: doc ? { id: doc.id, numero: doc.numero, vence_em: doc.vence_em, responsavel_id: doc.responsavel_id || null, tem_arquivo: !!doc.arquivo_path } : null,
    };
  }).sort((a, b) => ORDEM_SIT[a.situacao] - ORDEM_SIT[b.situacao] || a.nome.localeCompare(b.nome));
  const resumo = { falta: 0, vencido: 0, vence_30: 0, ok: 0, sem_vencimento: 0, total: itens.length };
  for (const i of itens) resumo[i.situacao]++;
  resumo.pendencias = resumo.falta + resumo.vencido;
  return { itens, resumo };
}

/** Fichas de todos os colaboradores do tenant de uma vez (para a lista) */
async function fichasDoTenant(supabase, tenantId, colaboradores) {
  const funcoes = (await q(supabase.from('funcoes').select('*').eq('tenant_id', tenantId)));
  const fPor = new Map(funcoes.map((f) => [String(f.id), f]));
  const docs = await listarDocumentos(supabase, tenantId, { alvoTipo: 'colaborador' });
  const tipos = await tiposDoTenant(supabase, tenantId);
  const out = new Map();
  for (const c of colaboradores) {
    const f = c.funcao_id != null ? fPor.get(String(c.funcao_id)) : null;
    const meus = docs.filter((d) => String(d.colaborador_id) === String(c.id));
    out.set(String(c.id), { funcao: f || null, ...montarFicha(f, meus, tipos) });
  }
  return out;
}


// ─── Biblioteca — Console da Plataforma ─────────────────────────────────
async function bibliotecaConsole(supabase) {
  const modelos = await biblioteca(supabase);
  const copias = await q(supabase.from('funcoes').select('*').not('origem_id', 'is', null));
  const tipos = (await q(supabase.from('documento_tipos').select('*').is('tenant_id', null)))
    .filter((t) => t.alvo === 'colaborador' && t.ativo !== false).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  return {
    modelos: modelos.map((m) => ({ ...m, importacoes: copias.filter((c) => String(c.origem_id) === String(m.id) && c.ativo !== false).length })),
    ...LISTAS,
    tipos_documento: tipos.map((t) => ({ codigo: t.codigo, nome: t.nome, validade_meses_padrao: t.validade_meses_padrao })),
  };
}
async function criarModelo(supabase, body) {
  const { erros, dados } = validarFuncao(body || {});
  if (erros.length) return { status: 400, erro: erros[0] };
  const { data, error } = await supabase.from('funcoes').insert([{ ...dados, tenant_id: null, versao: 1 }]).select();
  if (error) { if (/funcoes_nome_unico/.test(error.message)) return { status: 409, erro: 'Já existe um modelo com esse nome' }; throw new Error(error.message); }
  return { modelo: data[0] };
}
/** Editar modelo: se o conteúdo mudou, sobe a versão → as cópias dos tenants veem "versão nova" */
async function editarModelo(supabase, id, body) {
  const m = await funcaoPorId(supabase, id);
  if (!m || m.tenant_id != null) return { status: 404, erro: 'Modelo não encontrado' };
  const { erros, dados } = validarFuncao(body || {}, { parcial: true });
  if (erros.length) return { status: 400, erro: erros[0] };
  const mudou = CAMPOS_CONTEUDO.some((k) => dados[k] !== undefined && JSON.stringify(dados[k]) !== JSON.stringify(m[k] ?? (k === 'documentos' || k === 'riscos' || k === 'epis' ? [] : null)));
  const { data, error } = await supabase.from('funcoes').update({ ...dados, ...(mudou ? { versao: (Number(m.versao) || 1) + 1 } : {}), atualizado_em: new Date().toISOString() })
    .eq('id', m.id).is('tenant_id', null).select();
  if (error) { if (/funcoes_nome_unico/.test(error.message)) return { status: 409, erro: 'Já existe um modelo com esse nome' }; throw new Error(error.message); }
  return { modelo: data[0], versao_subiu: mudou };
}
/** Tirar da biblioteca: só desativa (as cópias dos tenants continuam intactas) */
async function desativarModelo(supabase, id) {
  const m = await funcaoPorId(supabase, id);
  if (!m || m.tenant_id != null) return { status: 404, erro: 'Modelo não encontrado' };
  const { error } = await supabase.from('funcoes').update({ ativo: false, atualizado_em: new Date().toISOString() }).eq('id', m.id).is('tenant_id', null);
  if (error) throw new Error(error.message);
  return { ok: true };
}

module.exports = { LISTAS, ESCOLARIDADES, RISCOS, bibliotecaConsole, criarModelo, editarModelo, desativarModelo,
  validarFuncao, biblioteca, funcaoPorId, listarFuncoes, importar, atualizarDaBiblioteca, montarFicha, fichasDoTenant, doTenant };
