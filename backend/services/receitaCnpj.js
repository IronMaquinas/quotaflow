// backend/services/receitaCnpj.js
//
// FONTE ÚNICA da consulta de CNPJ na Receita (BrasilAPI) e dos alertas
// automáticos de cadastro (etapa 11a).
//
// Usado por: services/convitesFornecedor.js (convite com CNPJ),
//            services/cadastroPublico.js ("Criar conta" de transportadora
//            e de fornecedor).
//
// Alertas NÃO bloqueiam: aparecem para o admin na aprovação (etapa 11b).
// Bloqueio só para CNPJ inválido, inexistente, não ATIVO ou Receita fora do ar.

const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const soDigitos = (v) => String(v || '').replace(/\D/g, '');
const normEmail = (e) => String(e || '').trim().toLowerCase();
const texto = (v, max = 200) => {
  const t = String(v == null ? '' : v).trim();
  return t ? t.slice(0, max) : null;
};

function cnpjValido(cnpj) {
  const c = soDigitos(cnpj);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const digito = (base) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((acc, p, i) => acc + p * Number(base[i]), 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return digito(c.slice(0, 12)) === Number(c[12]) && digito(c.slice(0, 13)) === Number(c[13]);
}

// Consulta pública (BrasilAPI). Nunca lança erro.
//   { status: 'ok', dados } | { status: 'nao_encontrado' } | { status: 'indisponivel' }
async function consultarReceitaBrasilAPI(cnpj) {
  if (typeof fetch !== 'function') return { status: 'indisponivel' };
  const controle = new AbortController();
  const tempo = setTimeout(() => controle.abort(), 6000);
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: controle.signal });
    if (r.status === 404) return { status: 'nao_encontrado' };
    if (!r.ok) return { status: 'indisponivel' };
    return { status: 'ok', dados: await r.json() };
  } catch {
    return { status: 'indisponivel' };
  } finally {
    clearTimeout(tempo);
  }
}
let consultaAtual = consultarReceitaBrasilAPI;
const consultarReceita = (cnpj) => consultaAtual(cnpj);

// Só o que interessa do retorno (não guarda nem expõe a lista de sócios)
function resumoReceita(rf) {
  if (!rf) return null;
  const endereco = [rf.descricao_tipo_de_logradouro, rf.logradouro].filter(Boolean).join(' ').trim();
  const cnaesSec = Array.isArray(rf.cnaes_secundarios)
    ? rf.cnaes_secundarios.map((c) => soDigitos(c && c.codigo)).filter((c) => c && c !== '0')
    : [];
  return {
    razao_social: texto(rf.razao_social, 160),
    nome_fantasia: texto(rf.nome_fantasia, 120),
    situacao: texto(rf.descricao_situacao_cadastral, 40),
    endereco: texto(endereco, 160),
    numero: texto(rf.numero, 20),
    complemento: texto(rf.complemento, 80),
    bairro: texto(rf.bairro, 80),
    cidade: texto(rf.municipio, 80),
    estado: rf.uf ? String(rf.uf).toUpperCase().slice(0, 2) : null,
    cep: soDigitos(rf.cep).slice(0, 8) || null,
    telefone: texto(rf.ddd_telefone_1, 30),
    email: rf.email ? normEmail(rf.email) : null,
    cnae: rf.cnae_fiscal ? soDigitos(rf.cnae_fiscal) : null,
    cnae_descricao: texto(rf.cnae_fiscal_descricao, 160),
    cnaes_secundarios: cnaesSec.slice(0, 30),
    abertura: texto(rf.data_inicio_atividade, 10),
  };
}

const nomeDaReceita = (r) => (r && (r.nome_fantasia || r.razao_social)) || null;

// Consulta + regras de bloqueio. Devolve { resumo } ou { status, erro, motivo }.
async function conferirCnpj(cnpj, { quem = 'empresa' } = {}) {
  const c = soDigitos(cnpj);
  if (!cnpjValido(c)) return { status: 400, motivo: 'cnpj_invalido', erro: 'CNPJ inválido. Confira os 14 dígitos.' };
  const r = await consultarReceita(c);
  if (r.status === 'nao_encontrado') return { status: 400, motivo: 'cnpj_nao_encontrado', erro: 'CNPJ não encontrado na Receita Federal. Confira o número.' };
  if (r.status !== 'ok') return { status: 503, motivo: 'receita_indisponivel', erro: 'Não foi possível consultar a Receita Federal agora. Tente de novo em alguns minutos.' };
  const resumo = resumoReceita(r.dados || {});
  if (resumo.situacao && resumo.situacao.toUpperCase() !== 'ATIVA') {
    return {
      status: 400,
      motivo: 'cnpj_inativo',
      erro: `Este CNPJ consta como "${resumo.situacao}" na Receita Federal. Só ${quem}s com situação ATIVA podem se cadastrar.`,
    };
  }
  return { cnpj: c, resumo };
}

// ─── Alertas automáticos (não bloqueiam) ────────────────────────────────────

const EMAILS_GRATUITOS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.com.br', 'outlook.com', 'outlook.com.br',
  'live.com', 'msn.com', 'yahoo.com', 'yahoo.com.br', 'ymail.com', 'icloud.com', 'me.com',
  'bol.com.br', 'uol.com.br', 'terra.com.br', 'ig.com.br', 'globo.com', 'globomail.com', 'r7.com',
  'zipmail.com.br', 'protonmail.com', 'proton.me',
]);

// Prefixos de CNAE esperados para cada público (ajustável).
// Transportadora: transporte terrestre/aquaviário/aéreo, armazenagem e
// logística, correio/entrega, locação de veículos e máquinas com ou sem operador.
const CNAE_CLIENTE = ['49', '50', '51', '52', '53', '7711', '7719', '7731', '7732', '7739', '4313', '4399'];
// Fornecedor: comércio/reparação de veículos e peças, atacado de máquinas,
// peças, combustíveis e lubrificantes, ferragens, fabricação de borracha/pneus,
// metal, material elétrico, máquinas e veículos, manutenção de máquinas,
// locação de máquinas, reparação.
const CNAE_FORNECEDOR = [
  '45', '4661', '4662', '4663', '4664', '4665', '4669', '4672', '4673', '4674', '4679', '4681',
  '4684', '4685', '4686', '4687', '4689', '4731', '4732', '4741', '4742', '4743', '4744', '4752',
  '4757', '4789', '22', '25', '27', '28', '29', '30', '33', '7732', '7739', '9529',
];

function mesesDesde(dataIso) {
  const d = new Date(dataIso);
  if (Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (30.44 * 24 * 3600 * 1000);
}

// publico: 'cliente' | 'fornecedor'  → [{ codigo, texto }]
function alertasCadastro(publico, resumo, email) {
  const alertas = [];
  const r = resumo || {};
  const esperados = publico === 'cliente' ? CNAE_CLIENTE : CNAE_FORNECEDOR;
  const cnaes = [r.cnae, ...(r.cnaes_secundarios || [])].filter(Boolean);
  if (cnaes.length && !cnaes.some((c) => esperados.some((p) => c.startsWith(p)))) {
    alertas.push({
      codigo: 'cnae',
      texto: `Atividade fora do esperado para ${publico === 'cliente' ? 'transportadora' : 'fornecedor de peças/serviços'}: ${r.cnae_descricao || r.cnae}`,
    });
  }
  const meses = r.abertura ? mesesDesde(r.abertura) : null;
  if (meses != null && meses < 6) {
    alertas.push({ codigo: 'abertura', texto: `Empresa aberta há menos de 6 meses (${r.abertura})` });
  }
  const dominio = normEmail(email).split('@')[1] || '';
  if (EMAILS_GRATUITOS.has(dominio)) {
    alertas.push({ codigo: 'email_gratuito', texto: `E-mail gratuito (${dominio}), não corporativo` });
  }
  return alertas;
}

module.exports = {
  EMAIL_VALIDO,
  soDigitos,
  normEmail,
  texto,
  cnpjValido,
  consultarReceita,
  resumoReceita,
  nomeDaReceita,
  conferirCnpj,
  alertasCadastro,
  // só para testes
  _definirConsultaReceita: (fn) => { consultaAtual = fn || consultarReceitaBrasilAPI; },
};
