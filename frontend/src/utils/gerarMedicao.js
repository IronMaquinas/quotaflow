// frontend/src/utils/gerarMedicao.js — etapa 18d: 📏 Boletim de Medição (BM) do contrato de locação — HTML "printável" (aba nova → PDF)
import { logoHtml } from "./logoEmpresa";
const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dataBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const num = (v) => (v == null || v === "" ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 }));
const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const UN = { hora: "h", dia: "dia(s)", fixo: "mês" };

export function gerarHtmlMedicao({ medicao: m, contrato: c, informativo: inf = {}, empresa = {} }) {
  const itens = m.itens || [];
  const total = itens.reduce((t, i) => t + (i.valor != null && i.realizado != null ? Number(i.valor) * Number(i.realizado) : 0), 0);
  const temValor = itens.some((i) => i.valor != null);
  const pe = inf.por_equipamento || {};
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Boletim de Medição ${esc(c.numero)} — ${esc(m.rotulo)}</title><style>
  body { margin: 0; background: #f2f2f2; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; font-size: 11.5px; }
  .pagina { max-width: 190mm; margin: 10mm auto; padding: 12mm; background: #fff; color: #111; }
  h1 { font-size: 16px; margin: 6mm 0 1mm; } h2 { font-size: 12px; margin: 6mm 0 2mm; text-transform: uppercase; color: #333; }
  table { width: 100%; border-collapse: collapse; } th { text-align: left; font-size: 9px; color: #555; text-transform: uppercase; border-bottom: 1.5px solid #111; padding: 4px; }
  td { border-bottom: 1px solid #e5e5e5; padding: 4px; font-size: 11px; vertical-align: top; } td.n, th.n { text-align: right; white-space: nowrap; }
  .dif { color: #b45309; font-weight: 700; } .box { border: 1px solid #ccc; border-radius: 4px; padding: 6px 10px; margin-top: 4mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print { body { background: #fff; } .pagina { margin: 0; padding: 0; } } @page { size: A4; margin: 12mm; }
  </style></head><body><div class="pagina">
    <div style="display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:6px">
      <div>${logoHtml()}<b style="font-size:14px">${esc(empresa.razao_social || empresa.nome || "")}</b>${empresa.cnpj ? `<div style="font-size:10px;color:#555">CNPJ ${esc(empresa.cnpj)}</div>` : ""}</div>
      <div style="text-align:right;font-size:10px;color:#555">Boletim de Medição<br/>emitido em ${dataHora(new Date())}</div>
    </div>
    <h1>Boletim de Medição — ${esc(c.numero)}</h1>
    <div>Cliente: <b>${esc(c.cliente)}</b>${c.local ? ` · ${esc(c.local)}` : ""}<br/>Período: <b>${dataBR(m.inicio)} a ${dataBR(m.fim)}</b> · Situação: <b>${esc(m.status_nome || m.status)}</b></div>
    <h2>Programado × realizado</h2>
    <table><thead><tr><th>Equipamento</th><th>Unidade</th><th class="n">Programado</th><th class="n">Realizado</th>${temValor ? '<th class="n">Valor unit.</th><th class="n">Total</th>' : ""}<th>Observações</th></tr></thead><tbody>
    ${itens.map((i) => { const dif = i.programado != null && i.realizado != null && Number(i.programado) !== Number(i.realizado);
      return `<tr><td><b>${esc(i.tag || "")}</b> ${esc(i.nome || "")}</td><td>${esc(i.unidade ? ({ hora: "Hora", dia: "Dia", fixo: "Fixo mensal" })[i.unidade] : "—")}</td>
      <td class="n">${num(i.programado)} ${esc(UN[i.unidade] || "")}</td><td class="n ${dif ? "dif" : ""}">${num(i.realizado)} ${esc(UN[i.unidade] || "")}</td>
      ${temValor ? `<td class="n">${brl(i.valor)}</td><td class="n">${i.valor != null && i.realizado != null ? brl(Number(i.valor) * Number(i.realizado)) : "—"}</td>` : ""}<td>${esc(i.obs || "")}</td></tr>`; }).join("")}
    ${temValor ? `<tr><td colspan="5" class="n"><b>Total medido</b></td><td class="n"><b>${brl(total)}</b></td><td></td></tr>` : ""}
    </tbody></table>
    ${m.obs ? `<div class="box"><b>Observações:</b> ${esc(m.obs)}</div>` : ""}
    <h2>Informativo — inspeções no período (registrado pelo sistema)</h2>
    <table><thead><tr><th>Equipamento</th><th class="n">Previstas</th><th class="n">No prazo</th><th class="n">Feitas</th><th class="n">Reprovadas</th><th class="n">Horímetro</th></tr></thead><tbody>
    ${itens.map((i) => { const x = pe[String(i.equipamento_id)] || {}; return `<tr><td><b>${esc(i.tag || "")}</b></td><td class="n">${x.previstas ?? 0}</td><td class="n">${x.no_prazo ?? 0}</td><td class="n">${x.feitas ?? 0}</td><td class="n">${x.reprovadas ?? 0}</td>
      <td class="n">${x.horimetro ? `${num(x.horimetro.de)} → ${num(x.horimetro.ate)} (${num(x.horimetro.horas)} h)` : "—"}</td></tr>`; }).join("")}
    </tbody></table>
    <div class="box" style="font-size:10.5px">${m.preenchido_por ? `Preenchido por <b>${esc(m.preenchido_por)}</b> em ${dataHora(m.preenchido_em)}. ` : ""}${m.enviado_por ? `Enviado por <b>${esc(m.enviado_por)}</b> em ${dataHora(m.enviado_em)}. ` : ""}${m.aprovado_por ? `Aprovado por <b>${esc(m.aprovado_por)}</b> em ${dataHora(m.aprovado_em)}.` : "Ainda não aprovado."}</div>
  </div></body></html>`;
}
export function prepararJanela() {
  const w = window.open("", "_blank");
  if (w) { try { w.document.write('<p style="font-family:sans-serif;padding:24px">Gerando o boletim…</p>'); } catch { /* ok */ } }
  return w;
}
export function abrirMedicao(dados, janela) {
  const w = janela || window.open("", "_blank");
  if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.");
  w.document.open(); w.document.write(gerarHtmlMedicao(dados)); w.document.close();
}
