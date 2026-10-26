// frontend/src/utils/gerarContrato.js — etapa 14d
// Contrato de locação "printável" (aba nova + imprimir / salvar em PDF), com a logo da empresa.
// O texto vem do servidor já com os campos preenchidos; [[TABELA_EQUIPAMENTOS]] vira a tabela. Linhas em MAIÚSCULAS
// ("CLÁUSULA 1ª — DO OBJETO", título) saem em negrito. Prévia leva a marca "PRÉVIA — NÃO EMITIDO".
import { logoHtml } from "./logoEmpresa";

const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");
const TABELA = "[[TABELA_EQUIPAMENTOS]]";
const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");

function tabelaHtml(tabela = []) {
  const total = tabela.every((t) => t.valor_mensal != null) ? tabela.reduce((s, t) => s + Number(t.valor_mensal), 0) : null;
  // 14d.6: saída e término previsto de cada equipamento (contrato emitido antes da 14d.6 não tem as datas → sem as colunas)
  const comDatas = tabela.some((t) => "inicio" in t);
  const cols = comDatas ? 4 : 2;
  return `<table class="tab"><thead><tr><th>Tag</th><th>Equipamento</th>${comDatas ? '<th class="dt">Início</th><th class="dt">Término</th>' : ""}<th style="text-align:right">Valor mensal</th></tr></thead><tbody>
    ${tabela.map((t) => `<tr><td>${esc(t.tag)}</td><td>${esc(t.nome)}</td>${comDatas ? `<td class="dt">${dBR(t.inicio)}</td><td class="dt">${t.fim_previsto ? dBR(t.fim_previsto) : "indeterminado"}</td>` : ""}<td style="text-align:right">${t.valor_mensal == null ? "________" : brl(t.valor_mensal)}</td></tr>`).join("")}
    ${tabela.length ? "" : `<tr><td colspan="${cols + 1}" style="text-align:center;color:#777">nenhum equipamento</td></tr>`}
    </tbody>${total != null && tabela.length ? `<tfoot><tr><td colspan="${cols}"><b>Total mensal</b></td><td style="text-align:right"><b>${brl(total)}</b></td></tr></tfoot>` : ""}</table>`;
}
function corpoHtml(texto, tabela) {
  const ehTitulo = (l) => l.length > 3 && l === l.toUpperCase() && /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(l);
  return String(texto || "").split(/\n/).map((l) => {
    const t = l.trim();
    if (!t) return "";
    if (t === TABELA) return tabelaHtml(tabela);
    if (/^CL[ÁA]USULA\b/i.test(t) || ehTitulo(t)) return `<p class="tit">${esc(t)}</p>`;
    return `<p>${esc(t)}</p>`;
  }).join("\n");
}

/** d: { numero, texto, tabela, empresa, cliente, previa, versao, emitido_em, emitido_por, hash, aceite: { nome, em, png, hash } } */
export function gerarHtmlContrato(d) {
  const a = d.aceite || null;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Contrato ${esc(d.numero)}${d.previa ? " — prévia" : ""}</title><style>
  body { margin: 0; background: #f2f2f2; font-family: Georgia, "Times New Roman", serif; color: #111; font-size: 12.5px; line-height: 1.6; }
  .pagina { max-width: 190mm; margin: 10mm auto; padding: 16mm 18mm; background: #fff; color: #111; position: relative; }
  .topo { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 8mm; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; }
  p { margin: 0 0 6px; text-align: justify; } p.tit { font-weight: 700; margin-top: 12px; text-align: left; }
  .tab { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 11.5px; }
  .tab th { text-align: left; border-bottom: 1.5px solid #111; padding: 4px; font-size: 10px; text-transform: uppercase; color: #444; } .tab td { border-bottom: 1px solid #ddd; padding: 4px; color: #111; }
  .tab th:first-child, .tab td:first-child, .tab .dt, .tab th:last-child, .tab td:last-child { width: 1%; white-space: nowrap; padding-left: 10px; padding-right: 10px; } /* 14d.7: o equipamento fica com a sobra */
  .ass { display: grid; grid-template-columns: 1fr 1fr; gap: 14mm; margin-top: 16mm; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 11px; text-align: center; }
  .ass .linha { border-top: 1px solid #111; padding-top: 4px; } .ass img { max-height: 60px; max-width: 220px; display: block; margin: 0 auto 2px; }
  .hash { font-family: "Courier New", monospace; font-size: 8.5px; color: #777; word-break: break-all; margin-top: 10mm; }
  .previa { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font: 700 64px sans-serif; color: rgba(220,38,38,.13); transform: rotate(-28deg); pointer-events: none; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print { body { background: #fff; } .pagina { margin: 0; padding: 0; } .nao-imprimir { display: none; } } @page { size: A4; margin: 16mm; }
  </style></head><body>${d.previa ? '<div class="previa">PRÉVIA — NÃO EMITIDO</div>' : ""}<div class="pagina">
    <div class="topo"><div>${logoHtml()}<b style="font-size:13px">${esc(d.empresa?.razao_social || d.empresa?.nome || "")}</b></div>
      <div style="text-align:right;font-size:10px;color:#555">Contrato ${esc(d.numero)}${d.versao ? ` · versão ${d.versao}` : ""}<br/>${d.previa ? "prévia" : `emitido em ${dataHora(d.emitido_em)}`}</div></div>
    ${corpoHtml(d.texto, d.tabela)}
    <div class="ass">
      <div><div style="height:62px"></div><div class="linha">${esc(d.empresa?.razao_social || d.empresa?.nome || "LOCADORA")}<br/><span style="color:#666">LOCADORA</span></div></div>
      <div>${a?.png ? `<img src="${a.png}" alt="assinatura"/>` : '<div style="height:62px"></div>'}<div class="linha">${esc(a?.nome || d.cliente || "LOCATÁRIA")}<br/><span style="color:#666">LOCATÁRIA${a ? ` — aceite na tela em ${dataHora(a.em)}` : ""}</span></div></div>
      <div><div style="height:40px"></div><div class="linha">Testemunha 1 — nome e CPF</div></div>
      <div><div style="height:40px"></div><div class="linha">Testemunha 2 — nome e CPF</div></div>
    </div>
    ${d.hash ? `<div class="hash">Contrato emitido no QuotaFlow${d.emitido_por ? ` por ${esc(d.emitido_por)}` : ""}. Integridade do texto (SHA-256): ${esc(d.hash)}${a?.hash ? `<br/>Aceite do locatário (SHA-256): ${esc(a.hash)}` : ""}</div>` : ""}
    <div class="nao-imprimir" style="margin-top:14px;text-align:center"><button onclick="window.print()" style="padding:8px 18px;font-size:13px">🖨 Imprimir / Salvar em PDF</button></div>
  </div></body></html>`;
}
export function prepararJanela() {
  const w = window.open("", "_blank");
  if (w) { try { w.document.write('<p style="font-family:sans-serif;padding:24px">Gerando o contrato…</p>'); } catch { /* ok */ } }
  return w;
}
export function abrirContrato(dados, janela) {
  const w = janela || window.open("", "_blank");
  if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.");
  w.document.open(); w.document.write(gerarHtmlContrato(dados)); w.document.close();
}
