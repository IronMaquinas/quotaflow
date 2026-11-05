// utils/areaRestrita.js — etapa 18h.2
// Usuário que só tem perfil "locatario" (cliente) e/ou "colaborador" tem tela própria e o backend barra o resto da API (403).
// Os carregamentos do sistema (catálogo, estoque…) não podem rodar para ele: o 403 derruba a sessão e o login entra em loop.
// Lê os perfis do usuário guardado ou, se ainda não houver (logo após o login), do próprio token.
const RESTRITOS = ["locatario", "colaborador"];
export function perfisDaSessao() {
  try { const u = JSON.parse(localStorage.getItem("usuario") || "null"); const ps = Array.isArray(u?.perfis) && u.perfis.length ? u.perfis : [u?.perfil].filter(Boolean); if (ps.length) return ps; } catch { /* segue */ }
  try { const t = localStorage.getItem("access_token") || ""; const p = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return Array.isArray(p.perfis) && p.perfis.length ? p.perfis : [p.perfil].filter(Boolean); } catch { return []; }
}
export const soAreaRestrita = (perfis = perfisDaSessao()) => perfis.length > 0 && perfis.every((p) => RESTRITOS.includes(p));
