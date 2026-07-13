// utils/helpers.js
// Funções helper para formatação, validação, etc

// ────────────────────────────────────────────────────────────────────────────
// FORMATAÇÃO
// ────────────────────────────────────────────────────────────────────────────

export const fmtBRL = (valor) => {
  if (valor == null || valor === undefined) return "—";
  return `R$ ${Number(valor).toFixed(2).replace(".", ",")}`;
};

export const fmtCNPJ = (cnpj) => {
  const clean = cnpj.replace(/\D/g, "").slice(0, 14);
  if (clean.length === 0) return "";
  if (clean.length <= 2) return clean;
  if (clean.length <= 5) return `${clean.slice(0, 2)}.${clean.slice(2)}`;
  if (clean.length <= 8)
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5)}`;
  if (clean.length <= 12)
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(
      8
    )}`;
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(
    8,
    12
  )}-${clean.slice(12)}`;
};

export const fmtCPF = (cpf) => {
  const clean = cpf.replace(/\D/g, "").slice(0, 11);
  if (clean.length === 0) return "";
  if (clean.length <= 3) return clean;
  if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`;
  if (clean.length <= 9)
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
};

export const fmtTelefone = (tel) => {
  const clean = tel.replace(/\D/g, "").slice(0, 11);
  if (clean.length === 0) return "";
  if (clean.length <= 2) return clean;
  if (clean.length <= 7) return `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
  if (clean.length <= 10)
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
};

export const fmtData = (data) => {
  if (!data) return "—";
  const d = new Date(data);
  return d.toLocaleDateString("pt-BR");
};

export const fmtDataHora = (data) => {
  if (!data) return "—";
  const d = new Date(data);
  return d.toLocaleString("pt-BR");
};

export const fmtDiasDesde = (data) => {
  if (!data) return "—";
  const dias = Math.floor((new Date() - new Date(data)) / 86400000);
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Ontem";
  if (dias < 7) return `${dias} dias atrás`;
  if (dias < 30) return `${Math.floor(dias / 7)} semanas atrás`;
  if (dias < 365) return `${Math.floor(dias / 30)} meses atrás`;
  return `${Math.floor(dias / 365)} anos atrás`;
};

export const fmtMoeda = (valor, moeda = "BRL") => {
  if (valor == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: moeda,
  }).format(valor);
};

// ────────────────────────────────────────────────────────────────────────────
// VALIDAÇÃO
// ────────────────────────────────────────────────────────────────────────────

export const validarCNPJ = (cnpj) => {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return false;

  // Eliminar CNPJs conhecidos como inválidos
  if (/^(\d)\1{13}$/.test(clean)) return false;

  // Validar primeiro dígito
  let size = clean.length - 2;
  let numbers = clean.substring(0, size);
  let digits = clean.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += numbers.charAt(size - i) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  // Validar segundo dígito
  size = size + 1;
  numbers = clean.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += numbers.charAt(size - i) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
};

export const validarCPF = (cpf) => {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++)
    sum += parseInt(clean.substring(i - 1, i)) * (11 - i);

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(clean.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++)
    sum += parseInt(clean.substring(i - 1, i)) * (12 - i);

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(clean.substring(10, 11))) return false;

  return true;
};

export const validarEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validarTelefone = (tel) => {
  const clean = tel.replace(/\D/g, "");
  return clean.length >= 10 && clean.length <= 11;
};

// ────────────────────────────────────────────────────────────────────────────
// CÁLCULOS
// ────────────────────────────────────────────────────────────────────────────

export const calcularMenor = (fornecedores) => {
  const valores = fornecedores
    .filter((f) => f.valor != null)
    .map((f) => f.valor);
  return valores.length > 0 ? Math.min(...valores) : null;
};

export const calcularMaior = (fornecedores) => {
  const valores = fornecedores
    .filter((f) => f.valor != null)
    .map((f) => f.valor);
  return valores.length > 0 ? Math.max(...valores) : null;
};

export const calcularMedia = (fornecedores) => {
  const valores = fornecedores
    .filter((f) => f.valor != null)
    .map((f) => f.valor);
  if (valores.length === 0) return null;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
};

export const calcularSaving = (valorAprovado, maiorCotacao) => {
  if (!maiorCotacao || !valorAprovado) return 0;
  return maiorCotacao - valorAprovado;
};

export const calcularSavingPercent = (valorAprovado, maiorCotacao) => {
  if (!maiorCotacao || !valorAprovado || maiorCotacao === 0) return 0;
  return ((maiorCotacao - valorAprovado) / maiorCotacao) * 100;
};

// ────────────────────────────────────────────────────────────────────────────
// ARRAYS / FILTROS
// ────────────────────────────────────────────────────────────────────────────

export const unique = (arr, key) => {
  return [...new Map(arr.map((item) => [item[key], item])).values()];
};

export const groupBy = (arr, key) => {
  return arr.reduce((acc, item) => {
    const group = item[key];
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});
};

export const sortBy = (arr, key, desc = false) => {
  return [...arr].sort((a, b) => {
    if (a[key] < b[key]) return desc ? 1 : -1;
    if (a[key] > b[key]) return desc ? -1 : 1;
    return 0;
  });
};

// ────────────────────────────────────────────────────────────────────────────
// SLEEP / DELAYS
// ────────────────────────────────────────────────────────────────────────────

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const throttle = (func, limit) => {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};
