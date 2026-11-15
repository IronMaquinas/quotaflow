// frontend/src/utils/gerarDocumentoGestao.js — etapa 18zu: 📘 documento de gestão em A4 com a IDENTIDADE da empresa
//   Cabeçalho de controle (logo | título | código · revisão · situação), bloco elaborado/aprovado, "alterações desta revisão",
//   texto e RODAPÉ em toda página impressa: "Documento controlado eletronicamente no QuotaFlow — cópia impressa não controlada".
//   Revisão obsoleta sai com tarja OBSOLETO. O mesmo HTML serve para a tela (👁 Ver) e para 🖨 Imprimir / salvar em PDF.
import { logoHtml, dadosEmpresa } from "./logoEmpresa";

const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dBR = (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");
const rev = (n) => `Rev. ${String(n ?? 0).padStart(2, "0")}`;
const SIT = { rascunho: "RASCUNHO — não aprovado", vigente: "Vigente", obsoleto: "OBSOLETO" };
const cnpjFmt = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : v || ""; };

export const CSS_DOC_GESTAO = `.dg{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:13px;line-height:1.6;position:relative}
  .dg table.cab{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px}.dg table.cab td{border:1px solid #888;padding:6px 8px;vertical-align:middle;color:#111;background:#fff}
  .dg .tit{font-weight:700;font-size:15px;text-align:center}.dg .logo{width:150px;text-align:center}.dg .ctl{width:150px;font-size:11.5px}
  .dg .mot{font-size:12px;color:#333;border:1px solid #ddd;background:#fafafa;padding:6px 10px;margin-bottom:14px}
  .dg .txt{white-space:pre-wrap}.dg .rod{font-size:10px;color:#666;border-top:1px solid #ccc;margin-top:22px;padding-top:6px;display:flex;justify-content:space-between;gap:10px}
  .dg .tarja{position:absolute;top:70px;right:-6px;transform:rotate(18deg);border:3px solid #b91c1c;color:#b91c1c;font-weight:800;font-size:22px;padding:2px 14px;letter-spacing:.12em;opacity:.8}`;

/** corpo do documento (div.dg) — d: documento ou versão { codigo, titulo, revisao, status, conteudo, elaborado_por, aprovado_por, aprovado_em, norma, motivo_revisao } */
export function corpoDocGestao(d, { obsoleto = false } = {}) {
  const e = dadosEmpresa(); const sit = obsoleto ? "obsoleto" : d.status;
  const logo = logoHtml({ altura: 46, largura: 140, margem: "0 auto" }) || `<b style="font-size:12px">${esc(e.razao_social || e.nome || "")}</b>`;
  return `<div class="dg">${sit !== "vigente" ? `<div class="tarja">${sit === "obsoleto" ? "OBSOLETO" : "RASCUNHO"}</div>` : ""}
    <table class="cab"><tr><td rowspan="2" class="logo">${logo}</td><td rowspan="2" class="tit">${esc(d.titulo)}</td><td class="ctl">Código: <b>${esc(d.codigo)}</b></td></tr>
      <tr><td class="ctl">${rev(d.revisao)} · ${esc(SIT[sit] || sit)}</td></tr>
      <tr><td colspan="3" style="font-size:11.5px">Elaborado: ${esc(d.elaborado_por || "—")} · Aprovado: ${esc(d.aprovado_por || "—")} em ${dBR(d.aprovado_em)}${d.norma ? ` · Referência: ${esc(d.norma)}` : ""}${e.cnpj ? ` · ${esc(e.razao_social || e.nome || "")} — CNPJ ${esc(cnpjFmt(e.cnpj))}` : ""}</td></tr></table>
    ${d.motivo_revisao || d.motivo ? `<div class="mot"><b>Alterações desta revisão:</b> ${esc(d.motivo_revisao || d.motivo)}</div>` : ""}
    <div class="txt">${d.conteudo ? esc(d.conteudo) : '<span style="color:#666">Sem texto no sistema — veja o arquivo anexo.</span>'}</div>
    <div class="rod"><span>${esc(d.codigo)} · ${rev(d.revisao)}${obsoleto ? " · OBSOLETO" : ""}</span><span>Documento controlado eletronicamente no QuotaFlow — cópia impressa não controlada</span><span>Impresso em ${new Date().toLocaleDateString("pt-BR")}</span></div></div>`;
}

/** abre a janela de impressão (A4, com o rodapé de controle repetido em cada página) */
export function imprimirDocGestao(d, opc = {}) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(d.codigo)} ${rev(d.revisao)} — ${esc(d.titulo)}</title><style>
    body{margin:0;background:#f3f4f6}.pagina{background:#fff;max-width:800px;margin:16px auto;padding:26px 32px}${CSS_DOC_GESTAO}
    .rodfix{display:none}@media print{body{background:#fff}.pagina{margin:0;max-width:none;padding:0 0 14mm}@page{size:A4 portrait;margin:14mm 14mm 18mm}
    .rodfix{display:block;position:fixed;bottom:0;left:0;right:0;font:9.5px Arial,sans-serif;color:#666;border-top:1px solid #ccc;padding-top:3px;text-align:center}.dg .rod{display:none}}
  </style></head><body><div class="pagina">${corpoDocGestao(d, opc)}</div>
  <div class="rodfix">${esc(d.codigo)} · ${rev(d.revisao)} — Documento controlado eletronicamente no QuotaFlow — cópia impressa não controlada — impresso em ${new Date().toLocaleDateString("pt-BR")}</div>
  <script>window.onload=function(){setTimeout(function(){window.print()},500)}</script></body></html>`;
  const w = window.open("", "_blank"); if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.");
  w.document.open(); w.document.write(html); w.document.close();
}
