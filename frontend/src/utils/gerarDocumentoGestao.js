// frontend/src/utils/gerarDocumentoGestao.js — etapa 18zu: 📘 documento de gestão em A4 com a IDENTIDADE da empresa
//   Cabeçalho de controle (logo | título | código · revisão · situação), bloco elaborado/aprovado, "alterações desta revisão",
//   texto e RODAPÉ em toda página impressa: "Documento controlado eletronicamente no QuotaFlow — cópia impressa não controlada".
//   Revisão obsoleta sai com tarja OBSOLETO. O mesmo HTML serve para a tela (👁 Ver) e para 🖨 Imprimir / salvar em PDF.
import { logoHtml, dadosEmpresa } from "./logoEmpresa";
import { paginasDoArquivo } from "./paginasArquivo"; // 18zz.13

const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dBR = (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");
const rev = (n) => `Rev. ${String(n ?? 0).padStart(2, "0")}`;
// 18zv: bloco de assinaturas eletrônicas (quem elaborou / verificou / aprovou, quando, função) + código de verificação
const ETAPA_TXT = { elaborado: "Elaborado", verificado: "Verificado", aprovado: "Aprovado" };
const dh = (iso) => { try { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); } catch { return ""; } };
function assinaturasHtml(d) {
  const l = d.assinaturas?.lista; if (!l?.length) return "";
  const inval = d.assinatura && d.assinatura.valida === false;
  return `<div class="ass" style="border:1px solid ${inval ? "#b91c1c" : "#cbd5e1"};padding:6px 10px;margin-bottom:14px;font-size:11.5px">${l.map((a) => `<div>✍ <b>${ETAPA_TXT[a.etapa] || a.etapa}:</b> ${esc(a.nome || "—")}${a.funcao ? ` (${esc(a.funcao)})` : ""} — ${dh(a.em)}</div>`).join("")}
    <div style="color:${inval ? "#b91c1c" : "#555"};margin-top:2px">${inval ? "⚠ O texto foi alterado depois da aprovação — assinatura INVÁLIDA." : `Assinado eletronicamente no QuotaFlow · código de verificação <b>${esc(d.codigo_verificacao || "")}</b>`}</div></div>`;
}
const SIT = { rascunho: "RASCUNHO — não aprovado", vigente: "Vigente", obsoleto: "OBSOLETO", em_aprovacao: "EM APROVAÇÃO" };
const cnpjFmt = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : v || ""; };

export const CSS_DOC_GESTAO = `.dg{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:13px;line-height:1.6;position:relative}
  .dg table.cab{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px}.dg table.cab td{border:1px solid #888;padding:6px 8px;vertical-align:middle;color:#111;background:#fff}
  .dg .tit{font-weight:700;font-size:15px;text-align:center}.dg .logo{width:150px;text-align:center}.dg .ctl{width:150px;font-size:11.5px}
  .dg .mot{white-space:pre-line;font-size:12px;color:#333;border:1px solid #ddd;background:#fafafa;padding:6px 10px;margin-bottom:14px}
  .dg .txt{white-space:pre-wrap}.dg .rod{font-size:10px;color:#666;border-top:1px solid #ccc;margin-top:22px;padding-top:6px;display:flex;justify-content:space-between;gap:10px}
  .dg .tarja{position:absolute;top:70px;right:-6px;transform:rotate(18deg);border:3px solid #b91c1c;color:#b91c1c;font-weight:800;font-size:22px;padding:2px 14px;letter-spacing:.12em;opacity:.8}`;

/** corpo do documento (div.dg) — d: documento ou versão { codigo, titulo, revisao, status, conteudo, elaborado_por, aprovado_por, aprovado_em, norma, motivo_revisao } */
export function corpoDocGestao(d, { obsoleto = false, folha = null } = {}) { // 18zz.13: folha = { nome, paginas } → FOLHA DE CONTROLE do documento da empresa
  const e = dadosEmpresa(); const sit = obsoleto ? "obsoleto" : d.status;
  const logo = logoHtml({ altura: 46, largura: 140, margem: "0 auto" }) || `<b style="font-size:12px">${esc(e.razao_social || e.nome || "")}</b>`;
  return `<div class="dg">${sit !== "vigente" ? `<div class="tarja">${sit === "obsoleto" ? "OBSOLETO" : sit === "em_aprovacao" ? "EM APROVAÇÃO" : "RASCUNHO"}</div>` : ""}
    <table class="cab"><tr><td rowspan="2" class="logo">${logo}</td><td rowspan="2" class="tit">${esc(d.titulo)}</td><td class="ctl">Código: <b>${esc(d.codigo)}</b></td></tr>
      <tr><td class="ctl">${rev(d.revisao)} · ${esc(SIT[sit] || sit)}</td></tr>
      <tr><td colspan="3" style="font-size:11.5px">Elaborado: ${esc(d.elaborado_por || "—")} · Aprovado: ${esc(d.aprovado_por || "—")} em ${dBR(d.aprovado_em)}${d.norma ? ` · Referência: ${esc(d.norma)}` : ""}${e.cnpj ? ` · ${esc(e.razao_social || e.nome || "")} — CNPJ ${esc(cnpjFmt(e.cnpj))}` : ""}</td></tr></table>
    ${d.motivo_revisao || d.motivo ? `<div class="mot"><b>Alterações desta revisão:</b>
${esc(d.motivo_revisao || d.motivo)}</div>` : ""}
    ${assinaturasHtml(d)}
    ${folha ? `<div class="mot" style="font-size:12.5px"><b>📎 FOLHA DE CONTROLE.</b> O conteúdo deste documento é o arquivo da empresa${folha.nome ? ` «${esc(folha.nome)}»` : ""}${folha.paginas ? ` — ${folha.paginas} página(s) a seguir, reproduzidas como estão` : ""}. Esta folha registra o controle (código, revisão, situação, alterações e aprovações).</div>` : ""}
    <div class="txt">${folha ? "" : d.conteudo ? esc(d.conteudo) : '<span style="color:#666">Sem texto no sistema — veja o arquivo anexo.</span>'}</div>
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

/** 18zz.13: faixa de controle (tela) para documento da empresa — o PDF dela é o principal, aqui só o controle */
export function faixaControleHtml(d, { obsoleto = false } = {}) {
  const sit = obsoleto ? "obsoleto" : d.status;
  return `<div class="dg" style="font-size:12px;line-height:1.5"><div style="display:flex;flex-wrap:wrap;gap:4px 14px;align-items:baseline">
    <b style="font-size:13px">${esc(d.codigo)} · ${rev(d.revisao)}</b><span style="color:${sit === "vigente" ? "#15803d" : "#b91c1c"};font-weight:700">${esc(SIT[sit] || sit)}</span>
    <span>Elaborado: ${esc(d.elaborado_por || "—")}</span><span>Aprovado: ${esc(d.aprovado_por || "—")}${d.aprovado_em ? ` em ${dBR(d.aprovado_em)}` : ""}</span></div>
    ${d.motivo_revisao || d.motivo ? `<div class="mot" style="margin:6px 0 0"><b>Alterações desta revisão:</b>\n${esc(d.motivo_revisao || d.motivo)}</div>` : ""}
    ${assinaturasHtml(d).replace("margin-bottom:14px", "margin:6px 0 0")}</div>`;
}

/** 18zz.13: imprimir documento da EMPRESA — folha de controle + as páginas do arquivo dela, como estão */
export async function imprimirDocGestaoArquivo(d, arq, opc = {}) {
  const w = window.open("", "_blank"); if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.");
  w.document.write('<p style="font:14px Arial;padding:24px">Preparando o documento para impressão…</p>');
  let r; try { r = await paginasDoArquivo(arq.url, { mime: arq.mime, nome: arq.nome, largura: 1600 }); } catch { w.close(); throw new Error("Não consegui abrir o arquivo do documento para imprimir."); }
  const pags = r.paginas.map((p) => `<div class="pg"><img src="${p}" alt=""></div>`).join("");
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(d.codigo)} ${rev(d.revisao)} — ${esc(d.titulo)}</title><style>
    body{margin:0;background:#f3f4f6}.pagina{background:#fff;max-width:800px;margin:16px auto;padding:26px 32px}${CSS_DOC_GESTAO}
    .pg{max-width:800px;margin:16px auto;background:#fff}.pg img{width:100%;display:block}
    .rodfix{display:none}@media print{body{background:#fff}.pagina{margin:0;max-width:none;padding:0}.pg{margin:0;max-width:none;page-break-before:always;break-before:page}
    .pg img{max-height:250mm;width:auto;max-width:100%;margin:0 auto}@page{size:A4 portrait;margin:12mm 12mm 16mm}
    .rodfix{display:block;position:fixed;bottom:0;left:0;right:0;font:9.5px Arial,sans-serif;color:#666;border-top:1px solid #ccc;padding-top:3px;text-align:center}.dg .rod{display:none}}
  </style></head><body><div class="pagina">${corpoDocGestao(d, { ...opc, folha: { nome: arq.nome, paginas: r.total } })}</div>${pags}
  ${r.total > r.paginas.length ? `<p style="text-align:center;font:12px Arial">Arquivo com ${r.total} páginas — impressas as ${r.paginas.length} primeiras.</p>` : ""}
  <div class="rodfix">${esc(d.codigo)} · ${rev(d.revisao)} — Documento controlado eletronicamente no QuotaFlow — cópia impressa não controlada — impresso em ${new Date().toLocaleDateString("pt-BR")}</div>
  <script>window.onload=function(){setTimeout(function(){window.print()},600)}</script></body></html>`;
  w.document.open(); w.document.write(html); w.document.close();
}
