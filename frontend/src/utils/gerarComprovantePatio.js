// frontend/src/utils/gerarComprovantePatio.js — etapas 18z.5/18z.6 (CNPJ do cliente e do emitente, área de armazenagem): 📦 pátio — comprovante de entrada/saída e ficha de movimentação (A4, layout padrão) + CSV
import { logoHtml, dadosEmpresa } from "./logoEmpresa";

const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dBR = (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");
const num = (v, c = 0) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
const CSS = `body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;background:#f3f4f6}.pagina{background:#fff;max-width:800px;margin:16px auto;padding:24px 28px}
  .topo{display:flex;align-items:center;gap:14px;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:10px}.topo h1{font-size:17px;margin:0}.sub{font-size:11.5px;color:#555}
  .emp{text-align:right;font-size:11px;color:#333}h2{font-size:13px;margin:14px 0 4px;background:#eef2f7;padding:5px 8px;border-left:3px solid #1d4ed8}
  table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;font-weight:600;color:#333;padding:4px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top}
  td{padding:4px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top}.k th{width:32%}.mono{font-family:Consolas,monospace}.dir{text-align:right}
  .lista th{background:#f8fafc;border-bottom:1px solid #cbd5e1}.kpis{display:flex;gap:8px;margin:8px 0}.kpi{flex:1;border:1px solid #cbd5e1;padding:6px 8px}.kpi b{display:block;font-size:16px}.kpi span{font-size:10.5px;color:#555}
  .fotos{display:flex;flex-wrap:wrap;gap:6px}.fotos img{width:150px;height:112px;object-fit:cover;border:1px solid #ccc}
  .ass{display:flex;gap:40px;margin-top:46px}.ass div{flex:1;border-top:1px solid #111;padding-top:4px;font-size:11px;text-align:center}
  .nota{font-size:10.5px;color:#444;margin-top:10px}.rodape{font-size:10px;color:#777;margin-top:14px;border-top:1px solid #ddd;padding-top:6px}
  @media print{body{background:#fff}.pagina{margin:0;max-width:none;padding:0}@page{size:A4 portrait;margin:12mm}h2,tr,.fotos img{break-inside:avoid}}`;
const topo = (titulo, sub) => { const e = dadosEmpresa(); return `<div class="topo"><div>${logoHtml ? logoHtml() : ""}</div><div style="flex:1"><h1>${esc(titulo)}</h1><div class="sub">${sub}</div></div>
  <div class="emp"><b>${esc(e.razao_social || e.nome || "")}</b>${e.cnpj ? `<br>CNPJ ${esc(e.cnpj)}` : ""}</div></div>`; };
const pagina = (titulo, corpo) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${CSS}</style></head><body><div class="pagina">${corpo}
  <div class="rodape">Emitido pelo QuotaFlow em ${new Date().toLocaleString("pt-BR")}.</div></div><script>window.onload=function(){setTimeout(function(){window.print()},500)}</script></body></html>`;
const cnpjFmt = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : v || ""; };
const linhas = (pares) => `<table class="k">${pares.filter(([, v]) => v != null && v !== "").map(([r, v, cls]) => `<tr><th>${esc(r)}</th><td class="${cls || ""}">${esc(v)}</td></tr>`).join("")}</table>`;
function abrir(html) { const w = window.open("", "_blank"); if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo."); w.document.open(); w.document.write(html); w.document.close(); }

/** comprovante de entrada (ou de saída) de um bem de terceiro guardado no pátio */
export function htmlComprovantePatio(b, tipo = "entrada") {
  const saida = tipo === "saida"; const titulo = saida ? "Comprovante de saída do pátio" : "Comprovante de entrada no pátio";
  const fotos = (saida ? b.fotos_saida : b.fotos_entrada || []).filter((f) => f.url).slice(0, 8);
  const corpo = `${topo(titulo, `${esc(b.numero)} · bem de terceiro em guarda`)}
  <h2>Cliente (proprietário)</h2>${linhas([["Cliente", b.cliente_nome], ["CNPJ / CPF", b.cliente_documento ? cnpjFmt(b.cliente_documento) : "não informado"]])}
  <h2>Equipamento</h2>${linhas([["Descrição", b.descricao], ["Nº de série (plaqueta)", b.numero_serie, "mono"], ["Outra identificação", b.identificacao], ["Fabricante / modelo / ano", [b.fabricante, b.modelo, b.ano].filter(Boolean).join(" · ")]])}
  <h2>Nota fiscal de entrada</h2>${b.nf_entrada_numero || b.nf_entrada_chave ? linhas([["Número", b.nf_entrada_numero], ["Data de emissão", b.nf_entrada_data ? dBR(b.nf_entrada_data) : ""], ["Emitente", [b.nf_emitente_nome, b.nf_emitente_cnpj && `CNPJ ${cnpjFmt(b.nf_emitente_cnpj)}`].filter(Boolean).join(" · ")], ["Item da NF", b.nf_item], ["Chave de acesso", b.nf_entrada_chave, "mono"]]) : `<div class="nota">Entrada sem nota fiscal informada.</div>`}
  <h2>Entrada</h2>${linhas([["Data da entrada", dBR(b.entrada_em)], ["Recebido por", b.recebido_por], ["Local no pátio", [b.area?.nome, b.local_patio].filter(Boolean).join(" · ")], ["Área ocupada", b.area_m2 != null ? `${num(b.area_m2, 2)} m²` : ""], ["Observação", b.obs]])}
  ${saida ? `<h2>Saída</h2>${linhas([["Data da saída", dBR(b.saida_em)], ["Liberado por", b.liberado_por], ["Retirado por", b.retirado_por], ["Documento", b.retirado_documento], ["Placa", b.retirado_placa], ["NF de saída / remessa", b.nf_saida_numero], ["AT", b.at ? b.at.numero : ""], ["Permanência", `${b.dias_no_patio} dia(s)`], ["Observação", b.saida_obs]])}` : ""}
  ${fotos.length ? `<h2>Fotos ${saida ? "da retirada" : "da chegada"}</h2><div class="fotos">${fotos.map((f) => `<img src="${esc(f.url)}" alt="">`).join("")}</div>` : ""}
  <div class="nota">${saida ? "Declaro ter retirado o equipamento acima, conferido pelo nº de série da plaqueta, nas condições registradas." : "O equipamento acima, de propriedade do cliente, foi recebido em guarda no pátio e conferido pelo nº de série da plaqueta, nas condições registradas. Não integra o estoque da empresa."}</div>
  <div class="ass"><div>${saida ? "Liberado por (empresa)" : "Recebido por (empresa)"}<br>${esc(saida ? b.liberado_por || "" : b.recebido_por || "")}</div><div>${saida ? "Retirado por" : "Entregue por / cliente"}<br>${esc(saida ? b.retirado_por || "" : "")}</div></div>`;
  return pagina(`${titulo} — ${b.numero}`, corpo);
}
export const abrirComprovantePatio = (b, tipo) => abrir(htmlComprovantePatio(b, tipo));

/** ficha de movimentação do pátio no período (por cliente ou todos) */
export function htmlMovimentacaoPatio(m) {
  const corpo = `${topo("Ficha de movimentação — pátio", `${m.cliente ? `Cliente ${esc(m.cliente)}` : "Todos os clientes"} · ${dBR(m.de)} a ${dBR(m.ate)}`)}
  <div class="kpis"><div class="kpi"><span>Saldo inicial</span><b>${m.saldo_inicial}</b></div><div class="kpi"><span>Entradas</span><b>${m.entradas}</b></div><div class="kpi"><span>Saídas</span><b>${m.saidas}</b></div><div class="kpi"><span>Saldo final</span><b>${m.saldo_final}</b></div>
  <div class="kpi"><span>Equipamento·dia</span><b>${num(m.equip_dias)}</b></div><div class="kpi"><span>m²·dia</span><b>${num(m.m2_dia, 2)}</b></div></div>
  ${!m.cliente && m.por_cliente.length > 1 ? `<h2>Resumo por cliente</h2><table class="lista"><tr><th>Cliente</th><th class="dir">Equipamentos</th><th class="dir">Equip.·dia</th><th class="dir">m²·dia</th></tr>${m.por_cliente.map((c) => `<tr><td>${esc(c.cliente)}</td><td class="dir">${c.equipamentos}</td><td class="dir">${num(c.dias)}</td><td class="dir">${num(c.m2_dia, 2)}${c.sem_area ? ` (${c.sem_area} sem área)` : ""}</td></tr>`).join("")}</table>` : ""}
  <h2>Movimentos no período</h2>${m.movimentos.length ? `<table class="lista"><tr><th>Data</th><th>Mov.</th><th>PAT</th>${m.cliente ? "" : "<th>Cliente</th>"}<th>Equipamento</th><th>Série</th><th>NF</th><th>Quem</th></tr>${m.movimentos.map((x) => `<tr><td>${dBR(x.data)}</td><td>${x.tipo === "entrada" ? "Entrada" : "Saída"}</td><td class="mono">${esc(x.numero)}</td>${m.cliente ? "" : `<td>${esc(x.cliente)}</td>`}<td>${esc(x.descricao)}</td><td class="mono">${esc(x.serie || "")}</td><td>${esc(x.nf || "")}</td><td>${esc(x.quem || "")}</td></tr>`).join("")}</table>` : `<div class="nota">Nenhuma entrada ou saída no período.</div>`}
  <h2>Permanência no período (base para cobrança)</h2>${m.itens.length ? `<table class="lista"><tr><th>PAT</th>${m.cliente ? "" : "<th>Cliente</th>"}<th>Equipamento</th><th>Série</th><th>Entrada</th><th>Saída</th><th class="dir">Dias</th><th class="dir">m²</th><th class="dir">m²·dia</th></tr>${m.itens.map((i) => `<tr><td class="mono">${esc(i.numero)}</td>${m.cliente ? "" : `<td>${esc(i.cliente)}</td>`}<td>${esc(i.descricao)}</td><td class="mono">${esc(i.serie || "")}</td><td>${dBR(i.entrada_em)}</td><td>${i.saida_em ? dBR(i.saida_em) : "no pátio"}</td><td class="dir">${i.dias}</td><td class="dir">${i.area_m2 != null ? num(i.area_m2, 2) : "—"}</td><td class="dir">${i.m2_dia != null ? num(i.m2_dia, 2) : "—"}</td></tr>`).join("")}
  <tr><th colspan="${m.cliente ? 5 : 6}">Total</th><th class="dir">${num(m.equip_dias)}</th><th></th><th class="dir">${num(m.m2_dia, 2)}</th></tr></table>` : `<div class="nota">Nenhum equipamento no pátio no período.</div>`}
  <div class="nota">Diária: conta o dia da entrada e não conta o dia da saída (entrada e saída no mesmo dia = 1 dia).${m.sem_area ? ` ${m.sem_area} equipamento(s) sem área informada — ficam fora do m²·dia.` : ""}</div>`;
  return pagina(`Movimentação do pátio — ${dBR(m.de)} a ${dBR(m.ate)}`, corpo);
}
export const abrirMovimentacaoPatio = (m) => abrir(htmlMovimentacaoPatio(m));
const csvCampo = (v) => { const t = String(v ?? ""); return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
export function csvMovimentacaoPatio(m) {
  const l = [["PAT", "Cliente", "Equipamento", "Série", "Entrada", "Saída", "Dias no período", "Área m²", "m²·dia"], ...m.itens.map((i) => [i.numero, i.cliente, i.descricao, i.serie, dBR(i.entrada_em), i.saida_em ? dBR(i.saida_em) : "", i.dias, i.area_m2 != null ? num(i.area_m2, 2) : "", i.m2_dia != null ? num(i.m2_dia, 2) : ""])];
  return "﻿" + l.map((x) => x.map(csvCampo).join(";")).join("\r\n");
}
