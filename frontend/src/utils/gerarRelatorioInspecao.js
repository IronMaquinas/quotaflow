// frontend/src/utils/gerarRelatorioInspecao.js — etapa 14a
// Relatório da inspeção para a seguradora / o cliente — HTML "printável" (aba nova + print → PDF).
// Desenho de cada vista com os pontos coloridos, lista dos itens, fotos dos não OK, OS abertas, liberação, assinatura e hash.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FundoVista } from "../components/inspecoes/Esquemas";
import { logoHtml } from "./logoEmpresa"; // 14c

const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");
const fmtCNPJ = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : (v || ""); };
const COR = { ok: "#16a34a", nok: "#dc2626", na: "#6b7280" };
const ST = { ok: "OK", nok: "NÃO OK", na: "N.A." };
const RES = { aprovado: ["APROVADO", "#16a34a"], ressalvas: ["APROVADO COM RESSALVAS", "#d97706"], reprovado: ["REPROVADO — USO BLOQUEADO", "#dc2626"] };

export function gerarHtmlInspecao({ inspecao: i, fotos = {}, imagens = {}, empresa = {}, liberacao = null, entrega = null }) {
  const resp = new Map((i.respostas || []).map((r) => [r.ponto_id, r]));
  const vistas = i.modelo?.vistas || [];
  const [resTxt, resCor] = RES[i.resultado] || [i.resultado, "#111"];
  const fechado = (r) => r.status === "nok" && (r.resolvido || r.resolucao_posterior || (i.os_abertas || []).some((o) => o.ponto_id === r.ponto_id && o.concluida_em)); // 14b.1.4
  const nokL = (i.respostas || []).filter((r) => r.status === "nok"); const corr = nokL.length > 0 && nokL.every(fechado);
  const desenho = (v) => {
    const fundo = renderToStaticMarkup(createElement(FundoVista, { imagem: v.imagem, url: imagens[v.imagem] }));
    const pins = v.pontos.map((p, k) => { const st = resp.get(p.id)?.status; return `<div class="pin" style="left:${p.x}%;top:${p.y}%;background:${COR[st] || "#3b82f6"}">${k + 1}</div>`; }).join("");
    return `<div class="desenho">${fundo}${pins}</div>`;
  };
  const osItem = (r) => { const o = (i.os_abertas || []).find((x) => x.ponto_id === r.ponto_id); if (!o || r.status !== "nok") return ""; const n = esc(o.os_numero || `OS ${o.os_id}`); return o.concluida_em ? `<div class="obs" style="color:#16a34a">✓ Corrigido na <b>${n}</b> (concluída em ${dataHora(o.concluida_em)})</div>` : `<div class="obs" style="color:#2563eb">🛠 <b>${n}</b> em andamento</div>`; }; // 14b.1.5
  // 14b.2: devolução de locação → estado do mesmo item na entrega
  const entregaItem = (p, r) => { if (!entrega) return ""; const e = (entrega.respostas || []).find((x) => x.ponto_id === p.id) || (entrega.respostas || []).find((x) => x.rotulo === p.rotulo); if (!e) return ""; const mudou = e.status !== r.status; return `<div class="obs" style="color:${mudou ? "#d97706" : "#666"}">na entrega: <b>${ST[e.status] || "—"}</b>${e.valor != null ? ` ${esc(e.valor)}` : ""}${e.obs ? ` — ${esc(e.obs)}` : ""}${mudou ? " (mudou)" : ""}</div>`; };
  const linhas = (v) => v.pontos.map((p, k) => {
    const r = resp.get(p.id) || {};
    const val = r.valor != null ? ` — ${esc(r.valor)}${r.unidade ? ` ${esc(r.unidade)}` : ""}` : "";
    // 14b.1.5: como na tela — observação, "impede o uso" e a correção na coluna da descrição; o status só com o selo
    const ok = (t) => `<div class="obs" style="color:#16a34a">${t}</div>`;
    const desc = `${r.obs ? `<div class="obs">${esc(r.obs)}${r.impede ? ' · <span style="color:#dc2626">impede o uso</span>' : ""}</div>` : r.impede ? '<div class="obs" style="color:#dc2626">impede o uso</div>' : ""}`
      + (r.resolvido ? ok(`🔧 Resolvido na hora: ${esc(r.resolucao)}`) : "")
      + (r.resolucao_posterior ? ok(`✓ Resolvido sem OS: ${esc(r.resolucao_posterior.texto)} (${esc(r.resolucao_posterior.por)}, ${dataHora(r.resolucao_posterior.em)})`) : "")
      + osItem(r)
      + entregaItem(p, r);
    return `<tr><td class="n">${k + 1}</td><td>${esc(p.rotulo)}${p.critico ? ' <span class="crit">crítico</span>' : ""}${desc}</td><td class="st" style="color:${COR[r.status] || "#111"}">${fechado(r) ? '<span class="corr">✓ CORRIGIDO</span> ' : ""}${ST[r.status] || "—"}${val}</td></tr>`;
  }).join("");
  const fotosHtml = (i.respostas || []).filter((r) => (r.fotos || []).length).map((r) => `<figure><div class="fts">${r.fotos.map((p) => (fotos[p] ? `<img src="${esc(fotos[p])}"/>` : "")).join("")}</div><figcaption><b style="color:${COR[r.status]}">${ST[r.status]}</b> · ${esc(r.vista)} → ${esc(r.rotulo)}${r.obs ? ` — ${esc(r.obs)}` : ""}</figcaption></figure>`).join("");
  const os = (i.os_abertas || []).map((o) => `<li>${esc(o.os_numero || `OS ${o.os_id}`)} — ${esc((i.respostas || []).find((r) => r.ponto_id === o.ponto_id)?.rotulo || "")} · ${o.concluida_em ? `concluída em ${dataHora(o.concluida_em)}` : "em andamento"}</li>`).join("");
  const info = [["Equipamento", i.equipamento_nome], ["Modelo de inspeção", i.modelo_nome], ["Concluída em", dataHora(i.concluida_em)], ["Inspecionado por", `${i.executor_nome || "—"}${i.executor_tipo === "terceiro" ? ` (terceiro${i.terceiro?.empresa ? ` — ${i.terceiro.empresa}` : ""})` : ""}`], ...(i.terceiro?.cpf ? [["CPF de quem inspecionou", String(i.terceiro.cpf).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")]] : []),
    ...(i.km != null ? [["Km", Number(i.km).toLocaleString("pt-BR")]] : []), ...(i.horimetro != null ? [["Horímetro", `${Number(i.horimetro).toLocaleString("pt-BR")} h`]] : []),
    ...(i.local ? [["Local", i.local]] : []), ...(i.cliente ? [["Cliente / contrato", i.cliente]] : []), ...(i.gps ? [["GPS", `${i.gps.lat.toFixed(5)}, ${i.gps.lng.toFixed(5)}`]] : [])];
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Inspeção — ${esc(i.equipamento_nome)}</title><style>
  body { margin: 0; background: #f2f2f2; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; font-size: 11.5px; line-height: 1.45; }
  .pagina { max-width: 190mm; margin: 10mm auto; padding: 12mm; background: #fff; color: #111; }
  h1 { font-size: 16px; margin: 6mm 0 2mm; } h2 { font-size: 13px; margin: 6mm 0 2mm; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
  .res { display: inline-block; font-weight: 800; font-size: 13px; padding: 4px 10px; border: 2px solid; border-radius: 4px; }
  .grade { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 12px; border: 1px solid #ccc; padding: 8px; margin: 8px 0; }
  .grade b { display: block; font-size: 8.5px; color: #666; text-transform: uppercase; }
  .vista { display: grid; grid-template-columns: 46% 1fr; gap: 10px; page-break-inside: avoid; margin-bottom: 4mm; }
  .desenho { position: relative; border: 1px solid #ddd; } .desenho svg { display: block; width: 100%; }
  .pin { position: absolute; transform: translate(-50%,-50%); width: 16px; height: 16px; border-radius: 50%; color: #fff; font-size: 8px; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 1.5px solid #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table { width: 100%; border-collapse: collapse; } td { border-bottom: 1px solid #eee; padding: 3px 4px; vertical-align: top; color: #111; font-size: 11.5px; } td.n { width: 16px; color: #666; } td.st { width: 150px; white-space: nowrap; font-weight: 700; text-align: right; }
  .crit { font-size: 8px; color: #dc2626; border: 1px solid #dc2626; border-radius: 3px; padding: 0 3px; } .obs { font-weight: 400; color: #444; font-size: 10.5px; } .corr { font-size: 8.5px; color: #16a34a; border: 1px solid #16a34a; border-radius: 3px; padding: 1px 4px; vertical-align: middle; }
  figure { margin: 0 0 4mm; page-break-inside: avoid; } .fts { display: flex; gap: 4px; flex-wrap: wrap; } .fts img { width: 56mm; height: 42mm; object-fit: cover; border: 1px solid #ccc; } figcaption { font-size: 10.5px; margin-top: 2px; }
  .ass { margin-top: 8mm; text-align: center; } .ass img { max-width: 240px; max-height: 80px; border-bottom: 1px solid #111; }
  .hash { font-family: "Courier New", monospace; font-size: 8.5px; color: #888; word-break: break-all; margin-top: 8mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print { body { background: #fff; } .pagina { margin: 0; padding: 0; } .nao-imprimir { display: none; } }
  @page { size: A4; margin: 12mm; }
  </style></head><body><div class="pagina">
    <div style="display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:6px">
      <div>${logoHtml()}<b style="font-size:14px">${esc(empresa.razao_social || empresa.nome)}</b><div style="color:#555;font-size:10px">${empresa.cnpj ? `CNPJ ${esc(fmtCNPJ(empresa.cnpj))}` : ""}</div></div>
      <div style="text-align:right;font-size:10px;color:#555">Relatório de inspeção ${esc(i.numero || `nº ${i.id}`)}<br/>emitido em ${dataHora(new Date())}</div>
    </div>
    <h1>Relatório de inspeção de equipamento</h1>
    <span class="res" style="color:${resCor};border-color:${resCor}">${resTxt}</span>${corr ? ' <span class="res" style="color:#16a34a;border-color:#16a34a">✓ CORRIGIDO</span>' : ""}
    <div class="grade">${info.map(([l, v]) => `<div><b>${esc(l)}</b>${esc(v)}</div>`).join("")}</div>
    ${i.obs ? `<div><b>Observações:</b> ${esc(i.obs)}</div>` : ""}
    ${entrega ? `<div style="border:1px solid #d97706;padding:6px 8px;margin:6px 0;font-size:11px">Devolução da locação de <b>${esc(entrega.cliente)}</b> — comparada com a inspeção de entrega <b>${esc(entrega.numero || `nº ${entrega.id}`)}</b> (${dataHora(entrega.concluida_em)}, ${esc(entrega.executor_nome)}${entrega.horimetro != null ? `, horímetro ${Number(entrega.horimetro).toLocaleString("pt-BR")} h` : ""}${entrega.km != null ? `, ${Number(entrega.km).toLocaleString("pt-BR")} km` : ""}).</div>` : ""}
    ${vistas.map((v) => `<h2>${esc(v.nome)}</h2><div class="vista">${desenho(v)}<table>${linhas(v)}</table></div>`).join("")}
    ${fotosHtml ? `<h2>Fotos</h2>${fotosHtml}` : ""}
    ${os ? `<h2>Ordens de serviço</h2><ul>${os}</ul>` : ""}
    ${liberacao ? `<h2>Liberação do equipamento</h2><div>Liberado por <b>${esc(liberacao.liberado_por_nome)}</b> em ${dataHora(liberacao.criado_em)} — ${esc(liberacao.motivo_liberacao)}</div>` : ""}
    <div class="ass">${i.assinatura_png ? `<img src="${i.assinatura_png}" alt="assinatura"/>` : ""}<div>${esc(i.executor_nome)} — assinado na tela em ${dataHora(i.concluida_em)}</div></div>
    <div class="hash">Inspeção registrada no QuotaFlow${i.origem === "link" ? " (link de terceiros)" : ""}. Integridade (SHA-256): ${esc(i.hash)}</div>
    <div class="nao-imprimir" style="margin-top:14px;text-align:center"><button onclick="window.print()" style="padding:8px 18px;font-size:13px">🖨 Imprimir / Salvar em PDF</button></div>
  </div></body></html>`;
}

export function prepararJanela() {
  const w = window.open("", "_blank");
  if (w) { try { w.document.write('<p style="font-family:sans-serif;padding:24px">Gerando o relatório…</p>'); } catch { /* ok */ } }
  return w;
}
export function abrirRelatorioInspecao(dados, janela) {
  const w = janela || window.open("", "_blank");
  if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.");
  w.document.open(); w.document.write(gerarHtmlInspecao(dados)); w.document.close();
  setTimeout(() => { try { w.focus(); } catch { /* ok */ } }, 300);
}
