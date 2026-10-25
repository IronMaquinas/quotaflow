// utils/logoEmpresa.js — etapa 14c
// Logomarca da empresa para os documentos printáveis. O App carrega uma vez depois do login (carregarLogoEmpresa) e os
// geradores de HTML leem na hora (logoHtml) — sem precisar passar a logo por cada tela. Sem logo: devolve "" e o
// documento segue só com o nome da empresa, como antes. A logo vem em data URL (não depende de link que expira).
import apiService from "../services/apiService";

let atual = null; // data URL | null

export async function carregarLogoEmpresa() {
  try { atual = (await apiService.get("/usuarios/me/logo"))?.logo || null; } catch { atual = null; }
  return atual;
}
export const definirLogoEmpresa = (dataUrl) => { atual = dataUrl || null; };
export const logoEmpresa = () => atual;

/** <img> pronto para o cabeçalho dos documentos (ou "" sem logo) */
export function logoHtml({ altura = 44, largura = 180, margem = "0 0 4px" } = {}) {
  if (!atual || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(atual)) return "";
  return `<img src="${atual}" alt="logo" style="display:block;max-height:${altura}px;max-width:${largura}px;object-fit:contain;margin:${margem}" />`;
}
