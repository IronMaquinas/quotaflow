// utils/gerarRelatorioOcorrencias.js — etapa 18h.4: 📊 relatório de performance das ocorrências (A4) + CSV
//   Disponibilidade por equipamento e por contrato, dias parados, resolução, ranking de clientes. Perda/cobrável só se veio do servidor (gestor/admin).
import { logoHtml } from "./logoEmpresa";
const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const pct = (v) => (v == null ? "—" : `${String(v).replace(".", ",")}%`);
const fmtCNPJ = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : (v || ""); };

export function gerarHtmlRelatorioOcorrencias(d, { empresa = {} } = {}) {
  const R = d.resumo || {}; const rec = !!d.receita;
  const card = (t, v, sub = "") => `<div class="kpi"><b>${esc(t)}</b><span>${v}</span>${sub ? `<i>${esc(sub)}</i>` : ""}</div>`;
  const tab = (cab, linhas) => `<table><thead><tr>${cab.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${linhas.join("") || `<tr><td colspan="${cab.length}" class="vz">Sem dados no período.</td></tr>`}</tbody></table>`;
  const linhaDisp = (x, rot) => `<tr><td>${esc(rot)}</td><td class="n">${x.contratados}</td><td class="n">${x.indisponiveis}</td><td class="n">${x.do_cliente}</td><td class="n"><b>${pct(x.disponibilidade)}</b></td><td class="n">${x.ocorrencias}</td>${rec ? `<td class="n">${brl(x.perda)}${x.sem_valor ? " *" : ""}</td><td class="n">${brl(x.cobravel)}</td>` : ""}</tr>`;
  const cabDisp = (p) => [p, "Dias contratados", "Dias indisponíveis", "Parado (cliente)", "Disponibilidade", "Ocorrências", ...(rec ? ["Perda estimada", "Cobrável do cliente"] : [])];
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ocorrências — performance ${dBR(d.periodo?.de)} a ${dBR(d.periodo?.ate)}</title><style>
  body { margin: 0; background: #f2f2f2; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; font-size: 11px; line-height: 1.45; }
  .pagina { max-width: 190mm; margin: 10mm auto; padding: 12mm; background: #fff; }
  h1 { font-size: 16px; margin: 6mm 0 1mm; } h2 { font-size: 13px; margin: 6mm 0 2mm; border-bottom: 1px solid #ccc; padding-bottom: 2px; page-break-after: avoid; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 4mm 0; } .kpi { border: 1px solid #ccc; padding: 6px 8px; } .kpi b { display: block; font-size: 8.5px; color: #666; text-transform: uppercase; } .kpi span { font-size: 16px; font-weight: 800; } .kpi i { display: block; font-style: normal; font-size: 9.5px; color: #666; }
  table { width: 100%; border-collapse: collapse; page-break-inside: auto; } th { text-align: left; font-size: 9px; color: #555; text-transform: uppercase; border-bottom: 1.5px solid #111; padding: 3px 4px; } td { border-bottom: 1px solid #eee; padding: 3px 4px; font-size: 11px; } td.n, th:not(:first-child) { text-align: right; } td.vz { color: #888; text-align: center; } tr { page-break-inside: avoid; }
  .nota { font-size: 9.5px; color: #666; margin-top: 2mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } @media print { body { background: #fff; } .pagina { margin: 0; padding: 0; } .nao-imprimir { display: none; } } @page { size: A4; margin: 12mm; }
  </style></head><body><div class="pagina">
    <div style="display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:6px">
      <div>${logoHtml()}<b style="font-size:14px">${esc(empresa.razao_social || empresa.nome || "")}</b><div style="color:#555;font-size:10px">${empresa.cnpj ? `CNPJ ${esc(fmtCNPJ(empresa.cnpj))}` : ""}</div></div>
      <div style="text-align:right;font-size:10px;color:#555">Ocorrências — performance<br/>${dBR(d.periodo?.de)} a ${dBR(d.periodo?.ate)}<br/>emitido em ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</div>
    </div>
    <h1>⚠️ Ocorrências e disponibilidade</h1>
    <div class="kpis">${card("Disponibilidade (locação)", pct(R.disponibilidade), `${R.dias_indisponiveis || 0} de ${R.dias_contratados || 0} dias contratados`)}${card("Ocorrências no período", R.total ?? 0, `${R.abertas ?? 0} em aberto hoje`)}${card("Resolução média", R.resolucao_media_dias == null ? "—" : `${String(R.resolucao_media_dias).replace(".", ",")} d`, R.resolucao_max_dias == null ? "" : `máx. ${String(R.resolucao_max_dias).replace(".", ",")} d`)}${card("Dias parados", R.dias_parados ?? 0, `${R.dias_parados_cliente || 0} por responsabilidade do cliente`)}
    ${rec ? card("Perda estimada", brl(R.perda_estimada), "dias indisponíveis × diária") + card("Cobrável do cliente", brl(R.cobravel_cliente), "parado por responsabilidade do cliente") : ""}</div>
    <div class="nota">Disponibilidade = (dias contratados − dias parados que não são responsabilidade do cliente) ÷ dias contratados. Parada por mau uso do cliente não conta contra a locadora. ${rec ? "Valores são estimativas (valor mensal da locação ÷ 30 por dia) — nada é descontado automaticamente. * sem valor mensal cadastrado." : ""}</div>
    <h2>Disponibilidade por equipamento</h2>${tab(cabDisp("Equipamento"), (d.equipamentos || []).map((x) => linhaDisp(x, [x.tag, x.nome].filter(Boolean).join(" — "))))}
    <h2>Disponibilidade por contrato</h2>${tab(cabDisp("Contrato"), (d.contratos || []).map((x) => linhaDisp(x, [x.numero, x.cliente].filter(Boolean).join(" · "))))}
    <h2>Por tipo e responsabilidade</h2>${tab(["Tipo", "Ocorrências"], (d.por_tipo || []).map((x) => `<tr><td>${esc(x.nome)}</td><td class="n">${x.n}</td></tr>`))}
    <div style="height:3mm"></div>${tab(["Responsabilidade", "Ocorrências"], (d.por_responsabilidade || []).map((x) => `<tr><td>${esc(x.nome)}</td><td class="n">${x.n}</td></tr>`))}
    <h2>Clientes com mais ocorrências</h2>${tab(["Cliente", "Ocorrências", "Responsabilidade do cliente", "Dias parados"], (d.clientes || []).map((x) => `<tr><td>${esc(x.cliente)}</td><td class="n">${x.ocorrencias}</td><td class="n">${x.do_cliente}</td><td class="n">${x.dias_parados}</td></tr>`))}
    ${(d.abertas_mais_antigas || []).length ? `<h2>Em aberto há mais tempo</h2>${tab(["Ocorrência", "Tipo", "Situação", "Dias"], d.abertas_mais_antigas.map((x) => `<tr><td>${esc(x.numero)} · ${esc(x.resumo)}${x.parado ? " · ⛔ parado" : ""}</td><td>${esc(x.tipo)}</td><td>${esc(x.status)}</td><td class="n">${x.dias}</td></tr>`))}` : ""}
    <div class="nao-imprimir" style="margin-top:14px;text-align:center"><button onclick="window.print()" style="padding:8px 18px;font-size:13px">🖨 Imprimir / Salvar em PDF</button></div>
  </div></body></html>`;
}
export function abrirRelatorioOcorrencias(d, opcoes, janela) {
  const w = janela || window.open("", "_blank");
  if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.");
  w.document.open(); w.document.write(gerarHtmlRelatorioOcorrencias(d, opcoes)); w.document.close();
}
const cc = (v) => { const t = String(v ?? ""); return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const num = (v) => (v == null ? "" : String(v).replace(".", ","));
/** CSV (;) por equipamento e por contrato — abre no Excel */
export function csvOcorrencias(d) {
  const rec = !!d.receita;
  const cab = ["Nível", "Equipamento / contrato", "Cliente", "Dias contratados", "Dias indisponíveis", "Parado (cliente)", "Disponibilidade %", "Ocorrências", ...(rec ? ["Perda estimada", "Cobrável do cliente"] : [])];
  const l = (nivel, nome, cli, x) => [nivel, nome, cli, x.contratados, x.indisponiveis, x.do_cliente, num(x.disponibilidade), x.ocorrencias, ...(rec ? [num(x.perda), num(x.cobravel)] : [])].map(cc).join(";");
  return "﻿" + [cab.join(";"), ...(d.equipamentos || []).map((x) => l("Equipamento", [x.tag, x.nome].filter(Boolean).join(" — "), "", x)), ...(d.contratos || []).map((x) => l("Contrato", x.numero, x.cliente, x))].join("\r\n");
}
