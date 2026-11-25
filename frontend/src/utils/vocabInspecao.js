// utils/vocabInspecao.js — etapa E6: 🔤 vocabulário da inspeção de campo (como a empresa chama o ATIVO e o COMPONENTE)
//   eólica: Aerogerador/Pá · tubulação: Linha/Junta · soldagem: Peça/Cordão · estruturas · genérico. Guardado no aparelho (funciona sem sinal).
const PADRAO = { preset: "eolica", ativo: "Aerogerador", ativos: "Aerogeradores", componente: "Pá", exemplo: "WTG-07", icone: "⚡" };
const CHAVE = "qfVocInspecao";
let atual = (() => { try { return { ...PADRAO, ...(JSON.parse(localStorage.getItem(CHAVE) || "null") || {}) }; } catch { return PADRAO; } })();
export const voc = () => atual;
export function definirVoc(v) { atual = { ...PADRAO, ...(v || {}) }; try { localStorage.setItem(CHAVE, JSON.stringify(atual)); } catch { /* ok */ } }
export const minus = (t) => String(t || "").toLowerCase();
