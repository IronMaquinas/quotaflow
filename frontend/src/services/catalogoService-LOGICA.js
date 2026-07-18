/**
 * services/catalogoService.js
 * 
 * Serviço de lógica para catálogo de itens
 * Inclui:
 * - Fuzzy matching (reconhecer variações de texto)
 * - Normalização de descrições
 * - Validação de itens
 * - Importação de CSV/Excel
 */

/**
 * FUZZY MATCHING: calcula similaridade entre 2 strings (0-100%)
 * 
 * Exemplo:
 * "farol lado direito" vs "farol, lado direito" = 95%
 * "farol lado direito" vs "farol lado esquerdo" = 80%
 * "farol lado direito" vs "motor" = 0%
 */
export function calcularSimilaridade(str1, str2) {
  // Normaliza (lowercase, remove pontuação)
  const n1 = normalizarTexto(str1);
  const n2 = normalizarTexto(str2);

  if (n1 === n2) return 100;
  if (!n1 || !n2) return 0;

  // Algoritmo de Levenshtein (distância entre strings)
  const len1 = n1.length;
  const len2 = n2.length;
  const matriz = Array(len2 + 1)
    .fill(null)
    .map(() => Array(len1 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matriz[0][i] = i;
  for (let j = 0; j <= len2; j++) matriz[j][0] = j;

  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const cost = n1[i - 1] === n2[j - 1] ? 0 : 1;
      matriz[j][i] = Math.min(
        matriz[j][i - 1] + 1,
        matriz[j - 1][i] + 1,
        matriz[j - 1][i - 1] + cost
      );
    }
  }

  const maxLen = Math.max(len1, len2);
  const distancia = matriz[len2][len1];
  const similaridade = ((maxLen - distancia) / maxLen) * 100;

  return Math.max(0, Math.min(100, similaridade));
}

/**
 * Normaliza texto para comparação
 * Remove pontuação, espaços extras, lowercase
 */
export function normalizarTexto(texto) {
  if (!texto) return "";
  return texto
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "") // Remove pontuação
    .replace(/\s+/g, " "); // Remove espaços extras
}

/**
 * Extrai palavras-chave de uma descrição
 * Útil para buscar itens similares
 * 
 * Exemplo:
 * "Lâmpada do farol lado direito" → ["lâmpada", "farol", "lado", "direito"]
 */
export function extrairPalavrasChave(descricao) {
  const stopwords = ["do", "da", "de", "o", "a", "um", "uma", "em", "para", "por"];
  return normalizarTexto(descricao)
    .split(" ")
    .filter((p) => p.length > 2 && !stopwords.includes(p));
}

/**
 * Detecta categoria automaticamente baseado em palavras-chave
 * 
 * Exemplo:
 * "Lâmpada do farol lado direito" → "iluminação"
 * "Filtro de óleo motor" → "motor"
 */
export function detectarCategoriaAutomatica(descricao) {
  const texto = normalizarTexto(descricao);
  
  const mapa = {
    iluminação: ["farol", "lâmpada", "luz", "ilumina", "headlight", "lamp"],
    motor: ["motor", "óleo", "corrente", "correia", "correia dentada", "engine", "oil"],
    freios: ["freio", "disco", "pastilha", "cilindro", "brake"],
    suspensão: ["suspensão", "amortecedor", "mola", "pneu", "roda", "suspension"],
    transmissão: ["câmbio", "transmissão", "caixa", "embraiagem", "clutch"],
    hidráulico: ["hidráulico", "óleo hidráulico", "válvula", "mangueira", "hydraulic"],
    elétrica: ["elétrico", "elétrica", "fiação", "conector", "fio", "electrical"],
    combustível: ["combustível", "filtro combustível", "bomba combustível", "fuel"],
    arrefecimento: ["radiador", "água", "arrefecimento", "termostato", "cooling"],
    ignição: ["vela", "bobina", "distribuidor", "alternador", "bateria", "spark"],
  };

  for (const [categoria, palavras] of Object.entries(mapa)) {
    if (palavras.some((p) => texto.includes(p))) {
      return categoria;
    }
  }

  return "geral"; // Categoria padrão
}

/**
 * Encontra itens similares já cadastrados
 * Útil para identificar duplicatas
 * 
 * Retorna: array de items com score de similaridade >= 60%
 */
export function encontrarSimilares(novaDescricao, itemsExistentes = [], threshold = 60) {
  const resultados = itemsExistentes
    .map((item) => ({
      item,
      similaridade: calcularSimilaridade(novaDescricao, item.nome),
    }))
    .filter((r) => r.similaridade >= threshold)
    .sort((a, b) => b.similaridade - a.similaridade);

  return resultados;
}

/**
 * Valida um item antes de salvar
 * Retorna objeto com erro se inválido
 */
export function validarItem(item) {
  const erros = [];

  if (!item.nome || item.nome.trim().length < 3) {
    erros.push("Nome deve ter pelo menos 3 caracteres");
  }

  if (!item.categoria || item.categoria.trim().length === 0) {
    erros.push("Categoria é obrigatória");
  }

  if (item.codigo && item.codigo.trim().length === 0) {
    erros.push("Se informar código, não pode ser vazio");
  }

  return {
    valido: erros.length === 0,
    erros,
  };
}

/**
 * Processa arquivo CSV para importação
 * Formato esperado:
 * nome,codigo,categoria,marca,modelo
 * Lâmpada farol direito,LAMP-001,iluminação,Philips,H7
 */
export function processarCSV(csvText) {
  const linhas = csvText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (linhas.length < 2) {
    return { erro: "CSV vazio ou sem cabeçalho", itens: [] };
  }

  // Parse cabeçalho
  const cabecalho = linhas[0].split(",").map((h) => h.trim().toLowerCase());
  const indicesEsperados = {
    nome: cabecalho.indexOf("nome"),
    codigo: cabecalho.indexOf("codigo"),
    categoria: cabecalho.indexOf("categoria"),
    marca: cabecalho.indexOf("marca"),
    modelo: cabecalho.indexOf("modelo"),
  };

  if (indicesEsperados.nome === -1) {
    return { erro: "CSV não tem coluna 'nome'", itens: [] };
  }

  // Parse linhas
  const itens = [];
  const erros = [];

  for (let i = 1; i < linhas.length; i++) {
    const partes = linhas[i].split(",").map((p) => p.trim());

    const item = {
      nome: partes[indicesEsperados.nome] || "",
      codigo: indicesEsperados.codigo >= 0 ? partes[indicesEsperados.codigo] : "",
      categoria:
        indicesEsperados.categoria >= 0
          ? partes[indicesEsperados.categoria]
          : detectarCategoriaAutomatica(partes[indicesEsperados.nome]),
      marca: indicesEsperados.marca >= 0 ? partes[indicesEsperados.marca] : "",
      modelo: indicesEsperados.modelo >= 0 ? partes[indicesEsperados.modelo] : "",
    };

    const validacao = validarItem(item);
    if (validacao.valido) {
      itens.push(item);
    } else {
      erros.push({ linha: i + 1, mensagens: validacao.erros });
    }
  }

  return { itens, erros, total: linhas.length - 1 };
}

/**
 * Detecta colunas em CSV automaticamente
 * Tenta mapear colunas mesmo com nomes diferentes
 */
export function detectorColunas(cabecalho) {
  const mapa = {
    nome: ["nome", "descricao", "item", "peça", "peca", "product", "description"],
    codigo: ["codigo", "code", "sku", "ref", "referência", "referencia"],
    categoria: ["categoria", "type", "tipo", "family", "família", "familia"],
    marca: ["marca", "brand", "fabricante", "manufacturer"],
    modelo: ["modelo", "model", "version", "versão", "versao"],
  };

  const colunas = {};
  const normalizados = cabecalho.map((h) => normalizarTexto(h));

  for (const [campo, opcoes] of Object.entries(mapa)) {
    for (const opcao of opcoes) {
      const idx = normalizados.findIndex((h) => h.includes(opcao));
      if (idx >= 0) {
        colunas[campo] = idx;
        break;
      }
    }
  }

  return colunas;
}

/**
 * Cria uma sugestão de categoria para um item
 * Retorna { categoria, confiança (0-100) }
 */
export function sugerirCategoria(descricao, categoriaExistentes = []) {
  const auto = detectarCategoriaAutomatica(descricao);

  // Se temos categorias conhecidas, tenta encontrar a mais similar
  if (categoriaExistentes.length > 0) {
    const palavrasDescricao = extrairPalavrasChave(descricao);
    
    const scores = categoriaExistentes.map((cat) => ({
      categoria: cat,
      score: Math.max(
        ...palavrasDescricao.map((p) => calcularSimilaridade(p, cat))
      ),
    }));

    const melhor = scores.sort((a, b) => b.score - a.score)[0];
    if (melhor.score > 40) {
      return { categoria: melhor.categoria, confiança: melhor.score };
    }
  }

  return { categoria: auto, confiança: 70 };
}

/**
 * Exporta itens para CSV
 */
export function exportarCSV(itens) {
  const cabecalho = "nome,codigo,categoria,marca,modelo";
  const linhas = itens.map((i) =>
    [i.nome, i.codigo || "", i.categoria || "", i.marca || "", i.modelo || ""]
      .map((v) => `"${v}"`)
      .join(",")
  );

  return [cabecalho, ...linhas].join("\n");
}
