// backend/services/matchSpot.js
//
// Match Score do Canal Spot — fase 1 (regras). "Vagas que combinam com você".
//
// Para cada demanda aberta, compara com o perfil de atuação do fornecedor
// (etapa 4) e com o catálogo dele, e devolve pontos + faixa + motivos.
//
//   Critério                                         Pontos   Motivo
//   PN da demanda no catálogo do fornecedor          100      "Você tem esse PN no catálogo"
//   Mesmo segmento                                   30       "Você atende Guindaste"
//   Mesmo sistema                                    25       "Você trabalha com Hidráulica"
//   Marca citada na demanda entre as marcas dele     20       "Você atende XCMG"
//   Atende o estado da demanda (ou Brasil todo)      15       "Você atende RJ"
//     (demanda.uf; se vazio, tenants.regiao)
//   Oferta compatível                                10       "Aceita Usada / recondicionada"
//
// Faixas (nunca porcentagem): ≥ 60 combina muito · 30–59 combina · 1–29 pode interessar.
//
// Regra importante: estado e oferta só REFORÇAM. Sozinhos não recomendam
// (senão quem marca "Brasil todo" receberia tudo como recomendação). Precisa
// de pelo menos um casamento de PN, segmento, sistema ou marca.
//
// Recomendação ORDENA, nunca esconde: a tela continua mostrando todas as demandas.
//
// Calculado na hora (sem tabela): mudou a atuação, mudou a recomendação.
// Quando entrar o e-mail diário (fase 4), grava-se em demanda_fornecedor_match.

const PESOS = { pn: 100, segmento: 30, sistema: 25, marca: 20, uf: 15, oferta: 10 };
const FAIXAS = [
  { minimo: 60, faixa: 'combina_muito' },
  { minimo: 30, faixa: 'combina' },
  { minimo: 1, faixa: 'pode_interessar' },
];

const lista = (v) => (Array.isArray(v) ? v.map(String) : []);
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const soAlfanum = (t) => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// texto "limpo" com espaços nas bordas, para casar palavra inteira com includes(' x ')
const textoBusca = (t) => ` ${semAcento(t).replace(/[^a-z0-9]+/g, ' ').trim()} `;

// Formas como uma marca pode aparecer escrita na demanda:
// "VW / MAN" → "vw man", "vw", "man"; "Mercedes-Benz" → "mercedes benz", "mercedes", "benz"
function formasDaMarca(nome, codigo) {
  const formas = new Set();
  const cheio = textoBusca(nome).trim();
  if (cheio) formas.add(cheio);
  for (const parte of String(nome || '').split('/')) {
    const p = textoBusca(parte).trim();
    if (p) formas.add(p);
    for (const palavra of p.split(' ')) if (palavra.length >= 4) formas.add(palavra);
  }
  const cod = textoBusca(String(codigo || '').replace(/_/g, ' ')).trim();
  if (cod) formas.add(cod);
  return [...formas];
}

// PN do catálogo: o nome da coluna varia conforme a origem do produto
// (CSV, cadastro manual), então lê as variações conhecidas.
function pnsDoProduto(p) {
  return [p.pn_normalizado, p.pn_raw, p.pn, p.part_number, p.codigo, p.codigo_fabricante]
    .filter(Boolean)
    .map(soAlfanum)
    .filter((x) => x.length >= 3);
}

// Carrega uma vez por requisição tudo o que o cálculo precisa do fornecedor.
async function contextoDoFornecedor(db, fornecedorId) {
  const [fornecedor, produtos, opcoes] = await Promise.all([
    db.selectOne('fornecedores', { id: fornecedorId }),
    db.select('fornecedor_produtos', { fornecedor_id: fornecedorId }).catch(() => []),
    db.select('atuacao_opcoes', {}).catch(() => []),
  ]);
  const f = fornecedor || {};

  const nomes = {};
  for (const o of opcoes || []) nomes[`${o.dimensao}:${o.codigo}`] = o.nome;
  const nome = (dimensao, codigo) => nomes[`${dimensao}:${codigo}`] || codigo;

  const pns = new Set();
  for (const p of produtos || []) {
    if (p.ativo === false) continue;
    for (const pn of pnsDoProduto(p)) pns.add(pn);
  }

  const marcas = lista(f.atuacao_marcas).map((codigo) => ({
    codigo,
    nome: nome('marca', codigo),
    formas: formasDaMarca(nome('marca', codigo), codigo),
  }));

  const perfil = {
    segmentos: lista(f.atuacao_segmentos),
    sistemas: lista(f.atuacao_sistemas),
    ofertas: lista(f.atuacao_ofertas),
    ufs: lista(f.atuacao_ufs),
    marcas,
  };

  return {
    perfil,
    pns,
    nome,
    temPerfil: !!(perfil.segmentos.length || perfil.sistemas.length || marcas.length || pns.size),
  };
}

const UFS = new Set(['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']);

function normalizarUF(v) {
  const uf = String(v || '').trim().toUpperCase();
  return UFS.has(uf) ? uf : null;
}

// Região da empresa compradora: no banco é tenants.regiao (estado/uf por segurança)
function ufDoTenant(t) {
  return t ? normalizarUF(t.regiao || t.estado || t.uf) : null;
}

// demanda + contexto do fornecedor + tenant que publicou → { pontos, faixa, motivos } | null
function pontuarDemanda(demanda, ctx, tenant) {
  if (!ctx || !ctx.temPerfil || !demanda || demanda.status === 'encerrada') return null;
  const { perfil, pns, nome } = ctx;
  const motivos = [];
  let pontos = 0;
  let substantivo = false;

  // PN no catálogo — o sinal mais forte
  const pnDemanda = soAlfanum(demanda.part_number);
  if (pnDemanda.length >= 3 && pns.has(pnDemanda)) {
    pontos += PESOS.pn;
    substantivo = true;
    motivos.push({ tipo: 'pn', texto: 'Você tem esse PN no catálogo' });
  }

  if (demanda.segmento && perfil.segmentos.includes(String(demanda.segmento))) {
    pontos += PESOS.segmento;
    substantivo = true;
    motivos.push({ tipo: 'segmento', texto: `Você atende ${nome('segmento', demanda.segmento)}` });
  }

  if (demanda.sistema && perfil.sistemas.includes(String(demanda.sistema))) {
    pontos += PESOS.sistema;
    substantivo = true;
    motivos.push({ tipo: 'sistema', texto: `Você trabalha com ${nome('sistema', demanda.sistema)}` });
  }

  // Marca: procurada no texto que o comprador escreveu
  if (perfil.marcas.length) {
    const texto = textoBusca([demanda.marca_modelo, demanda.descricao_equipamento, demanda.componente].filter(Boolean).join(' '));
    const marca = perfil.marcas.find((m) => m.formas.some((forma) => texto.includes(` ${forma} `)));
    if (marca) {
      pontos += PESOS.marca;
      substantivo = true;
      motivos.push({ tipo: 'marca', texto: `Você atende ${marca.nome}` });
    }
  }

  // Reforços (não recomendam sozinhos)
  // Estado onde a peça é necessária: o da demanda; se não tiver, a região da empresa
  const uf = normalizarUF(demanda.uf) || ufDoTenant(tenant);
  if (perfil.ufs.includes('BR')) {
    pontos += PESOS.uf;
    motivos.push({ tipo: 'uf', texto: uf ? `Você atende ${uf}` : 'Você atende todo o Brasil' });
  } else if (uf && perfil.ufs.includes(uf)) {
    pontos += PESOS.uf;
    motivos.push({ tipo: 'uf', texto: `Você atende ${uf}` });
  }

  const ofertaComum = lista(demanda.ofertas_aceitas).find((o) => perfil.ofertas.includes(o));
  if (ofertaComum) {
    pontos += PESOS.oferta;
    motivos.push({ tipo: 'oferta', texto: `Aceita ${nome('oferta', ofertaComum)}` });
  }

  if (!substantivo) return null;
  const faixa = (FAIXAS.find((f) => pontos >= f.minimo) || {}).faixa || null;
  return { pontos, faixa, motivos };
}

module.exports = { contextoDoFornecedor, pontuarDemanda, normalizarUF, ufDoTenant, PESOS };
