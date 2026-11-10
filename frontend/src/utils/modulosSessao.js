// utils/modulosSessao.js — etapa 18k: 🧩 módulos ligados da empresa, para as telas esconderem abas/botões de módulo não contratado
// O App grava ao entrar (GET /configuracoes/modulos; o locatário, /locatario/modulos). null = tudo ligado (ou ainda carregando).
let ativos = null;
const ouvintes = new Set();
export function definirModulosSessao(lista) { ativos = Array.isArray(lista) ? new Set(lista) : null; ouvintes.forEach((f) => { try { f(); } catch { /* ok */ } }); }
export const moduloAtivo = (id) => !ativos || ativos.has(id);
export function aoMudarModulos(f) { ouvintes.add(f); return () => ouvintes.delete(f); }

// 18t.1: "⭐ Meu plano" clicável nas mensagens de módulo não contratado — o App escuta e abre a tela
export function irParaMeuPlano() { window.dispatchEvent(new CustomEvent("qf-ir-tela", { detail: "meu_plano" })); }
