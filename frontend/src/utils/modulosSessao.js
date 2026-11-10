// utils/modulosSessao.js — etapa 18k: 🧩 módulos ligados da empresa, para as telas esconderem abas/botões de módulo não contratado
// O App grava ao entrar (GET /configuracoes/modulos; o locatário, /locatario/modulos). null = tudo ligado (ou ainda carregando).
let ativos = null;
const ouvintes = new Set();
export function definirModulosSessao(lista) { ativos = Array.isArray(lista) ? new Set(lista) : null; ouvintes.forEach((f) => { try { f(); } catch { /* ok */ } }); }
export const moduloAtivo = (id) => !ativos || ativos.has(id);
export function aoMudarModulos(f) { ouvintes.add(f); return () => ouvintes.delete(f); }

// 18t.1: "⭐ Meu plano" clicável nas mensagens de módulo não contratado — o App escuta e abre a tela
export function irParaMeuPlano() { window.dispatchEvent(new CustomEvent("qf-ir-tela", { detail: "meu_plano" })); }

// 18u: 🏷 segmentos da empresa → nomes na tela. ['transporte'] até o App carregar (empresas antigas = transporte).
let segmentos = ["transporte"];
export function definirSegmentosSessao(lista) { segmentos = Array.isArray(lista) && lista.length ? lista : ["transporte"]; ouvintes.forEach((f) => { try { f(); } catch { /* ok */ } }); }
export const temSegmento = (id) => segmentos.includes(id);
/** nome na tela conforme o(s) segmento(s) — chave: frota | minhas_viagens | programacao */
export function rotulo(chave) {
  const tr = segmentos.includes("transporte"); const loc = segmentos.includes("locacao");
  const R = {
    frota: tr ? (loc ? "🚛 Frota e equipamentos" : "🚛 Frota") : "⚙ Equipamentos/ativos",
    minhas_viagens: tr ? "🚛 Minhas viagens" : "🧰 Minhas atividades",
    programacao: tr ? "🚛 Programação" : "📅 Programação",
  };
  return R[chave] || chave;
}
