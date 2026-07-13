// utils/constants.js
// Configurações globais, cores, estilos

// ────────────────────────────────────────────────────────────────────────────
// COLORS
// ────────────────────────────────────────────────────────────────────────────

export const CORES = {
  bg: "#0a0e14",
  surface: "#111722",
  surfaceAlt: "#0f131a",
  border: "#1e2535",
  accent: "#3b82f6",
  accentDark: "#2563eb",
  success: "#22c55e",
  warn: "#f59e0b",
  danger: "#ef4444",
  text: "#e2e8f0",
  textSub: "#94a3b8",
  muted: "#64748b",
  saving: "#a78bfa",
};

// ────────────────────────────────────────────────────────────────────────────
// STYLES
// ────────────────────────────────────────────────────────────────────────────

export const estilos = {
  // INPUT
  input: {
    width: "100%",
    background: CORES.bg,
    border: `1px solid ${CORES.border}`,
    borderRadius: 6,
    padding: "10px 12px",
    color: CORES.text,
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    transition: "all 0.15s",
  },

  inputFocus: {
    borderColor: CORES.accent,
    boxShadow: `0 0 0 3px ${CORES.accent}22`,
  },

  inputError: {
    borderColor: CORES.danger,
    boxShadow: `0 0 0 3px ${CORES.danger}22`,
  },

  // SELECT
  select: {
    width: "100%",
    background: CORES.bg,
    border: `1px solid ${CORES.border}`,
    borderRadius: 6,
    padding: "10px 12px",
    color: CORES.text,
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    appearance: "none",
    transition: "all 0.15s",
    cursor: "pointer",
  },

  // BUTTON
  btn: (enabled = true, color = CORES.accent) => ({
    background: enabled ? color : CORES.surface,
    border: `1px solid ${enabled ? color : CORES.border}`,
    borderRadius: 7,
    padding: "11px 18px",
    color: enabled ? "#fff" : CORES.muted,
    fontSize: 13,
    fontWeight: 600,
    cursor: enabled ? "pointer" : "not-allowed",
    fontFamily: "inherit",
    transition: "all 0.15s",
  }),

  btnHover: (color = CORES.accent) => ({
    background: color === CORES.accent ? "#2563eb" : color,
  }),

  // CARD
  card: {
    background: CORES.surface,
    border: `1px solid ${CORES.border}`,
    borderRadius: 10,
    padding: 16,
  },

  // LABEL
  label: {
    fontSize: 11,
    color: CORES.muted,
    letterSpacing: "0.08em",
    display: "block",
    marginBottom: 6,
    fontWeight: 600,
    textTransform: "uppercase",
  },

  // TAG
  tag: (tagColor = CORES.muted) => ({
    fontSize: 10,
    background: `${tagColor}22`,
    border: `1px solid ${tagColor}44`,
    borderRadius: 4,
    padding: "2px 8px",
    color: tagColor,
    letterSpacing: "0.06em",
    fontWeight: 600,
    whiteSpace: "nowrap",
    display: "inline-block",
  }),

  // BADGE
  badge: (color = CORES.accent) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 10,
    background: `${color}22`,
    border: `1px solid ${color}44`,
    borderRadius: 4,
    padding: "4px 10px",
    color: color,
    fontWeight: 600,
  }),
};

// ────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÕES
// ────────────────────────────────────────────────────────────────────────────

export const CATEGORIAS_ARVORE = {
  "Rolamentos e Mancais": [
    "Rolamentos SKF",
    "Rolamentos FAG",
    "Mancais",
    "Esferas de aço",
  ],
  "Correias e Transmissão": [
    "Correias dentadas",
    "Correias planas",
    "Correntes",
    "Polias",
  ],
  "Hidráulico e Pneumático": [
    "Válvulas hidráulicas",
    "Cilindros hidráulicos",
    "Válvulas pneumáticas",
    "Compressores",
  ],
  "Filtros e Lubrificantes": [
    "Filtros de óleo",
    "Filtros de ar",
    "Óleos industrial",
    "Graxas",
  ],
  Elétrica: [
    "Motores elétricos",
    "Chaves e disjuntores",
    "Cabos elétricos",
    "Transformadores",
  ],
  Instrumentação: [
    "Sensores",
    "Transmissores",
    "Indicadores",
    "Controladores",
  ],
  Automação: [
    "PLCs",
    "Inversores",
    "Soft-starters",
    "Relés de controle",
  ],
  "Manutenção Geral": [
    "Parafusos e porcas",
    "Vedadores",
    "Borrachas",
    "Acessórios diversos",
  ],
};

export const URGENCIA_CONFIG = {
  alta: { label: "Alta", color: CORES.danger, bg: "#3f0f0f", icon: "🔴" },
  media: { label: "Média", color: CORES.warn, bg: "#3f2a0a", icon: "🟡" },
  baixa: { label: "Baixa", color: CORES.success, bg: "#0f2f1a", icon: "🟢" },
};

export const CATEGORIA_CONFIG = {
  corretiva: { label: "Corretiva", color: "#f87171" },
  preventiva: { label: "Preventiva", color: "#60a5fa" },
  preditiva: { label: "Preditiva", color: "#a78bfa" },
};

export const FORNECEDOR_STATUS_CONFIG = {
  ATIVA: { icon: "✓", color: CORES.success, risco: "Baixo" },
  SUSPENSA: { icon: "!", color: CORES.warn, risco: "Alto" },
  INAPTA: { icon: "✕", color: CORES.danger, risco: "Alto" },
  BAIXADA: { icon: "—", color: CORES.muted, risco: "Crítico" },
};

export const PAPEL_CONTATO = {
  comercial: "Comercial",
  cotacao: "Cotação/Compras",
  tecnico: "Técnico",
  financeiro: "Financeiro",
  outro: "Outro",
};

export const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const FRETE_TIPO = ["CIF", "FOB", "EXW", "Frete Grátis"];

// ────────────────────────────────────────────────────────────────────────────
// API CONFIG
// ────────────────────────────────────────────────────────────────────────────

export const API_URL = "http://localhost:3001/api";

export const API_TIMEOUTS = {
  DEFAULT: 10000,
  UPLOAD: 30000,
  DOWNLOAD: 60000,
};
