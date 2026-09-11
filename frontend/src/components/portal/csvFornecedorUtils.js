// csvFornecedorUtils.js
//
// Parser de CSV para o upload de lista de preços do fornecedor
// (fornecedor_produtos). Diferente do processarCSV() do catalogoService
// (catálogo do comprador, por tenant_id), este:
//   1. Respeita aspas CSV de verdade (campo com vírgula dentro de "...").
//   2. Mapeia colunas por sinônimo, não por nome exato — cada fornecedor
//      exporta do ERP dele com um cabeçalho diferente.
//   3. Não faz fuzzy matching contra catálogo nenhum — o backend
//      (POST /api/fornecedor/produtos/upload) já faz upsert simples por
//      PN normalizado. Aqui só extraímos e validamos os 7 campos que a
//      rota espera: pn, nome, descricao, categoria, marca, preco_unitario,
//      unidade.

// ─────────────────────────────────────────────────────────────────────
// Parser de linha CSV com suporte a aspas (RFC4180 simplificado):
// separa por vírgula, mas ignora vírgula dentro de "..."; "" dentro de
// aspas vira um " literal (regra padrão de escape do CSV).
// ─────────────────────────────────────────────────────────────────────
function parseLinhaCSV(linha) {
  const campos = [];
  let atual = '';
  let dentroDeAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const char = linha[i];

    if (dentroDeAspas) {
      if (char === '"') {
        if (linha[i + 1] === '"') {
          atual += '"';
          i++; // pula o segundo "
        } else {
          dentroDeAspas = false;
        }
      } else {
        atual += char;
      }
    } else {
      if (char === '"') {
        dentroDeAspas = true;
      } else if (char === ',') {
        campos.push(atual.trim());
        atual = '';
      } else {
        atual += char;
      }
    }
  }
  campos.push(atual.trim());
  return campos;
}

// Quebra o texto em linhas respeitando quebra de linha DENTRO de campo
// entre aspas (ex: descrição com \n no meio, exportação de alguns ERPs).
function quebrarLinhasCSV(csvText) {
  const linhas = [];
  let atual = '';
  let dentroDeAspas = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') dentroDeAspas = !dentroDeAspas;

    if ((char === '\n') && !dentroDeAspas) {
      linhas.push(atual);
      atual = '';
    } else if (char !== '\r') {
      atual += char;
    }
  }
  if (atual.trim().length > 0) linhas.push(atual);
  return linhas;
}

function normalizarCabecalho(txt) {
  return String(txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .trim();
}

// Sinônimos aceitos por campo — cobre os ERPs/planilhas mais comuns.
// Ordem importa: primeiro sinônimo que bater no cabeçalho é usado.
const SINONIMOS = {
  pn: ['pn', 'part_number', 'partnumber', 'part number', 'codigo_fabricante', 'código do fabricante', 'p/n'],
  nome: ['nome', 'produto', 'item', 'descricao_curta', 'nome_produto', 'title', 'product'],
  descricao: ['descricao', 'descrição', 'description', 'detalhes', 'especificacao', 'especificação'],
  categoria: ['categoria', 'category', 'familia', 'família', 'grupo', 'tipo'],
  marca: ['marca', 'brand', 'fabricante', 'manufacturer'],
  preco_unitario: ['preco_unitario', 'preço unitário', 'preco', 'preço', 'valor', 'valor_unitario', 'price', 'unit price'],
  unidade: ['unidade', 'un', 'unit', 'uom'],
};

function detectarColunasFornecedor(cabecalhoRaw) {
  const cabecalho = cabecalhoRaw.map(normalizarCabecalho);
  const indices = {};

  for (const [campo, opcoes] of Object.entries(SINONIMOS)) {
    let encontrado = -1;
    for (const opcao of opcoes) {
      const idx = cabecalho.indexOf(normalizarCabecalho(opcao));
      if (idx >= 0) {
        encontrado = idx;
        break;
      }
    }
    indices[campo] = encontrado;
  }

  return indices;
}

function parsePreco(valorBruto) {
  if (valorBruto === undefined || valorBruto === null) return NaN;
  // Aceita "1234,56", "1.234,56" (formato BR) ou "1234.56" (US).
  let limpo = String(valorBruto).trim().replace(/[^\d.,-]/g, '');
  if (limpo.includes(',') && limpo.includes('.')) {
    // Formato BR com milhar: 1.234,56 -> 1234.56
    limpo = limpo.replace(/\./g, '').replace(',', '.');
  } else if (limpo.includes(',')) {
    // Só vírgula: assume decimal BR -> 1234,56
    limpo = limpo.replace(',', '.');
  }
  return parseFloat(limpo);
}

/**
 * Processa o texto de um CSV de lista de preços do fornecedor.
 *
 * @param {string} csvText - conteúdo bruto do arquivo/colagem.
 * @returns {{ erro?: string, itens: object[], erros: {linha:number, mensagens:string[]}[], total: number, colunasDetectadas: object }}
 */
export function processarCSVFornecedor(csvText) {
  if (!csvText || !csvText.trim()) {
    return { erro: 'CSV vazio', itens: [], erros: [], total: 0 };
  }

  const linhas = quebrarLinhasCSV(csvText).filter((l) => l.trim().length > 0);
  if (linhas.length < 2) {
    return { erro: 'CSV vazio ou sem cabeçalho', itens: [], erros: [], total: 0 };
  }

  const cabecalho = parseLinhaCSV(linhas[0]);
  const colunas = detectarColunasFornecedor(cabecalho);

  if (colunas.nome === -1) {
    return {
      erro: `CSV não tem uma coluna reconhecível de nome/produto. Cabeçalho encontrado: ${cabecalho.join(', ')}`,
      itens: [],
      erros: [],
      total: 0,
    };
  }
  if (colunas.preco_unitario === -1) {
    return {
      erro: `CSV não tem uma coluna reconhecível de preço. Cabeçalho encontrado: ${cabecalho.join(', ')}`,
      itens: [],
      erros: [],
      total: 0,
    };
  }

  const itens = [];
  const erros = [];

  for (let i = 1; i < linhas.length; i++) {
    const partes = parseLinhaCSV(linhas[i]);
    const numeroLinha = i + 1; // +1 porque linha 1 é cabeçalho

    const pegar = (campo) => (colunas[campo] >= 0 ? (partes[colunas[campo]] || '').trim() : '');

    const nome = pegar('nome');
    const precoBruto = pegar('preco_unitario');
    const preco = parsePreco(precoBruto);

    const mensagensErro = [];
    if (!nome) mensagensErro.push('Nome/produto vazio');
    if (isNaN(preco) || preco <= 0) mensagensErro.push(`Preço inválido: "${precoBruto}"`);

    if (mensagensErro.length > 0) {
      erros.push({ linha: numeroLinha, mensagens: mensagensErro });
      continue;
    }

    itens.push({
      pn: pegar('pn') || null,
      nome,
      descricao: pegar('descricao') || null,
      categoria: pegar('categoria') || null,
      marca: pegar('marca') || null,
      preco_unitario: preco,
      unidade: pegar('unidade') || null,
    });
  }

  return {
    itens,
    erros,
    total: linhas.length - 1,
    colunasDetectadas: colunas,
  };
}
