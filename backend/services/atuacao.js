// backend/services/atuacao.js
//
// Perfil de atuação do fornecedor (etapa 4) — FONTE ÚNICA das regras:
//   • quais campos existem (atuacao_segmentos, _sistemas, _marcas, _ofertas, _ufs)
//   • validação contra as listas fechadas da tabela atuacao_opcoes
//   • sugestão de marca nova (entra com aprovado = false)
//   • campos de atuação da demanda spot (segmento, sistema, ofertas_aceitas)
//
// Usado por: routes/fornecedor.js (Meus Dados do fornecedor),
//            routes/fornecedores.js (cadastro do tenant),
//            routes/spot.js (criação de demanda),
//            routes/atuacao.js (GET das opções).

const DIMENSAO_POR_CAMPO = {
  atuacao_segmentos: 'segmento',
  atuacao_sistemas: 'sistema',
  atuacao_marcas: 'marca',
  atuacao_ofertas: 'oferta',
  atuacao_ufs: 'uf',
};
const CAMPOS_ATUACAO = Object.keys(DIMENSAO_POR_CAMPO);
const UF_BRASIL_TODO = 'BR';

function slug(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

async function carregarOpcoes(db) {
  const linhas = (await db.select('atuacao_opcoes', {})) || [];
  return linhas.sort((a, b) =>
    String(a.dimensao).localeCompare(String(b.dimensao)) ||
    (Number(a.ordem) || 0) - (Number(b.ordem) || 0) ||
    String(a.nome).localeCompare(String(b.nome), 'pt-BR')
  );
}

// Formato do GET /api/atuacao/opcoes: { segmento: [...], sistema: [...], ... }
async function opcoesAgrupadas(db) {
  const saida = { segmento: [], sistema: [], marca: [], oferta: [], uf: [] };
  for (const o of await carregarOpcoes(db)) {
    if (!saida[o.dimensao]) continue;
    saida[o.dimensao].push({
      codigo: o.codigo,
      nome: o.nome,
      grupo: o.grupo || null,
      aprovado: o.aprovado !== false,
    });
  }
  return saida;
}

function codigosValidos(opcoes, dimensao) {
  return new Set(opcoes.filter((o) => o.dimensao === dimensao).map((o) => o.codigo));
}

function filtrarLista(valor, validos) {
  const lista = Array.isArray(valor) ? valor : [];
  return [...new Set(lista.map(String))].filter((c) => validos.has(c));
}

// Marca nova digitada em "Outra marca": reaproveita se já existe (mesmo código
// ou mesmo nome), senão cria pendente de aprovação. Devolve o código.
async function registrarMarcaSugerida(db, opcoes, nome, { fornecedorId, tenantId }) {
  const limpo = String(nome || '').trim().slice(0, 60);
  if (!limpo) return null;
  const codigo = slug(limpo);
  if (!codigo) return null;

  const marcas = opcoes.filter((o) => o.dimensao === 'marca');
  const existente = marcas.find((o) => o.codigo === codigo || slug(o.nome) === codigo);
  if (existente) return existente.codigo;

  const nova = await db.insert('atuacao_opcoes', {
    dimensao: 'marca',
    codigo,
    nome: limpo,
    grupo: 'Outras',
    ordem: 999,
    aprovado: false,
    sugerido_por_fornecedor_id: fornecedorId || null,
    sugerido_por_tenant_id: tenantId || null,
  });
  opcoes.push(nova || { dimensao: 'marca', codigo, nome: limpo });
  return codigo;
}

// Lê do body só os campos de atuação que vieram; devolve o objeto para gravar
// em `fornecedores` (vazio se o body não trouxe nada de atuação).
async function normalizarAtuacao(db, body, { fornecedorId = null, tenantId = null } = {}) {
  const b = body || {};
  const veioAlgo = CAMPOS_ATUACAO.some((c) => b[c] !== undefined) || !!String(b.marca_sugerida || '').trim();
  if (!veioAlgo) return {};

  const opcoes = await carregarOpcoes(db);
  const saida = {};

  for (const campo of CAMPOS_ATUACAO) {
    if (b[campo] === undefined) continue;
    saida[campo] = filtrarLista(b[campo], codigosValidos(opcoes, DIMENSAO_POR_CAMPO[campo]));
  }

  if (String(b.marca_sugerida || '').trim()) {
    const codigo = await registrarMarcaSugerida(db, opcoes, b.marca_sugerida, { fornecedorId, tenantId });
    if (codigo) saida.atuacao_marcas = [...new Set([...(saida.atuacao_marcas || []), codigo])];
  }

  // "Brasil todo" exclui os estados
  if (saida.atuacao_ufs && saida.atuacao_ufs.includes(UF_BRASIL_TODO)) {
    saida.atuacao_ufs = [UF_BRASIL_TODO];
  }

  return saida;
}

// Campos de atuação da demanda spot — todos opcionais.
async function normalizarDemanda(db, body) {
  const b = body || {};
  const opcoes = await carregarOpcoes(db);
  const segmentos = codigosValidos(opcoes, 'segmento');
  const sistemas = codigosValidos(opcoes, 'sistema');
  return {
    segmento: segmentos.has(String(b.segmento || '')) ? String(b.segmento) : null,
    sistema: sistemas.has(String(b.sistema || '')) ? String(b.sistema) : null,
    ofertas_aceitas: filtrarLista(b.ofertas_aceitas, codigosValidos(opcoes, 'oferta')),
  };
}

module.exports = {
  CAMPOS_ATUACAO,
  opcoesAgrupadas,
  normalizarAtuacao,
  normalizarDemanda,
  slug,
};
