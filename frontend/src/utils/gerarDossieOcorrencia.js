// utils/gerarDossieOcorrencia.js — etapa 18h: 📄 dossiê da ocorrência / sinistro (SIN) para imprimir ou salvar em PDF
//   Contexto do momento (AT ou contrato), descrição, fotos com tarja, BO/anexos, conversa e histórico — material para seguradora/cliente.
const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dh = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
import { logoHtml } from "./logoEmpresa";
const fmtCNPJ = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : (v || ""); };

export function gerarHtmlDossie(o, { empresa = {}, interno = true } = {}) {
  const c = o.contexto || {};
  const grade = (pares) => `<div class="grade">${pares.filter(([, v]) => v != null && v !== "").map(([l, v]) => `<div><b>${esc(l)}</b>${esc(v)}</div>`).join("")}</div>`;
  const gps = o.gps ? `${Number(o.gps.lat).toFixed(5)}, ${Number(o.gps.lng).toFixed(5)}` : null;
  const ocorrencia = grade([["Tipo", o.tipo_nome || o.tipo], ["Quando", dh(o.ocorrido_em)], ["Local", o.local], ["GPS", gps], ["Registrada por", `${o.registrado_por_nome || "—"}${o.registrado_por_tipo === "locatario" ? " (cliente)" : ""} · ${dh(o.criado_em)}`],
    ["Situação", o.status_nome || o.status], ["Responsabilidade", o.responsabilidade_nome || o.responsabilidade], ["Equipamento parado", o.parado ? `Sim · ${o.dias_parado} dia(s)` : "Não"],
    ["Encerrada em", o.encerrado_em ? dh(o.encerrado_em) : null], ...(interno && o.tarefa?.numero ? [["Tarefa", o.tarefa.numero]] : [])]);
  const ctx = o.origem === "at"
    ? grade([["AT", c.at?.numero], ["Cliente", c.at?.cliente], ["Motorista", c.motorista?.nome], ["Conjunto", (c.conjunto || []).map((x) => [x.placa || x.tag, x.nome].filter(Boolean).join(" ")).join(" + ")],
      ["Carga", (c.carga || []).map((x) => [x.descricao, x.origem && x.destino ? `${x.origem} → ${x.destino}` : null].filter(Boolean).join(" · ")).join(" | ")],
      ["Documentos", (c.documentos || []).map((d) => `${String(d.tipo).toUpperCase()} ${d.nome || ""}`).join(" · ")], ["Averbação", (c.fiscal?.averbacoes || []).join(", ")], ["Apólice", c.apolice],
      ["Última posição", c.ultima_posicao ? `${c.ultima_posicao.etapa || ""} · ${dh(c.ultima_posicao.em)}` : null]])
    : grade([["Contrato", c.contrato?.numero], ["Cliente", c.contrato?.cliente], ["Local da obra", c.contrato?.local], ["Equipamento", [c.equipamento?.tag, c.equipamento?.nome].filter(Boolean).join(" — ")], ["Modelo", c.equipamento?.modelo], ["Nº de série", c.equipamento?.serie],
      ["Última inspeção", c.ultima_inspecao ? `${c.ultima_inspecao.numero || ""} · ${dh(c.ultima_inspecao.em)} · ${c.ultima_inspecao.resultado || ""}` : "sem inspeção registrada"],
      ["Não OK na última inspeção", (c.ultima_inspecao?.nao_ok || []).join(", ")]]);
  const fotos = (o.fotos || []).filter((f) => f.url);
  const antigas = fotos.filter((f) => f.antiga).length;
  const fotosHtml = fotos.map((f) => `<figure><img src="${esc(f.url)}" alt=""><figcaption>${esc(f.legenda || f.nome || "")} · ${f.lado === "cliente" ? "cliente" : "empresa"} · ${dh(f.em)}${f.antiga ? ' · <span class="ant">⚠ foto antiga / da galeria</span>' : ""}</figcaption></figure>`).join("");
  const anexos = (o.anexos || []).map((a) => `<li>${a.tipo === "bo" ? "📄 Boletim de ocorrência" : "📎"} — ${a.url ? `<a href="${esc(a.url)}">${esc(a.nome)}</a>` : esc(a.nome)} · ${dh(a.em)} · ${esc(a.por || "")}</li>`).join("");
  const msgs = (o.mensagens || []).map((m) => `<tr><td class="q">${dh(m.em)}<br><b>${esc(m.por || "")}</b> (${m.lado === "cliente" ? "cliente" : "empresa"})</td><td>${esc(m.texto)}</td></tr>`).join("");
  const hist = interno ? (o.historico || []).map((h) => `<tr><td class="q">${dh(h.em)}<br>${esc(h.por || "")}</td><td>${esc(h.acao)}${h.de ? ` · ${esc(h.de)} →` : ""}${h.para ? ` ${esc(h.para)}` : ""}${h.texto ? ` — ${esc(h.texto)}` : ""}</td></tr>`).join("") : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(o.numero)} — dossiê da ocorrência</title><style>
  body { margin: 0; background: #f2f2f2; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; font-size: 11.5px; line-height: 1.45; }
  .pagina { max-width: 190mm; margin: 10mm auto; padding: 12mm; background: #fff; color: #111; }
  h1 { font-size: 16px; margin: 6mm 0 2mm; } h2 { font-size: 13px; margin: 6mm 0 2mm; border-bottom: 1px solid #ccc; padding-bottom: 2px; page-break-after: avoid; }
  .sel { display: inline-block; font-weight: 800; font-size: 12px; padding: 3px 9px; border: 2px solid; border-radius: 4px; margin-right: 6px; }
  .grade { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 12px; border: 1px solid #ccc; padding: 8px; margin: 8px 0; }
  .grade b { display: block; font-size: 8.5px; color: #666; text-transform: uppercase; }
  .desc { white-space: pre-wrap; border: 1px solid #ccc; padding: 8px; }
  .fts { display: flex; gap: 4mm; flex-wrap: wrap; } figure { margin: 0 0 3mm; width: 56mm; page-break-inside: avoid; } figure img { width: 56mm; border: 1px solid #ccc; display: block; } figcaption { font-size: 9.5px; margin-top: 2px; color: #444; }
  .ant { color: #b45309; font-weight: 700; } .aviso { border: 1px solid #d97706; color: #92400e; padding: 6px 8px; margin: 6px 0; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; } td { border-bottom: 1px solid #eee; padding: 3px 4px; vertical-align: top; } td.q { width: 42mm; color: #555; font-size: 10.5px; }
  ul { padding-left: 16px; margin: 0; } li { margin-bottom: 3px; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print { body { background: #fff; } .pagina { margin: 0; padding: 0; } .nao-imprimir { display: none; } }
  @page { size: A4; margin: 12mm; }
  </style></head><body><div class="pagina">
    <div style="display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:6px">
      <div>${logoHtml()}<b style="font-size:14px">${esc(empresa.razao_social || empresa.nome || "")}</b><div style="color:#555;font-size:10px">${empresa.cnpj ? `CNPJ ${esc(fmtCNPJ(empresa.cnpj))}` : ""}</div></div>
      <div style="text-align:right;font-size:10px;color:#555">Dossiê da ocorrência ${esc(o.numero)}<br/>emitido em ${dh(new Date())}</div>
    </div>
    <h1>⚠️ ${esc(o.numero)} — ${esc(o.tipo_nome || o.tipo)} <span style="font-weight:400;font-size:12px;color:#555">· ${o.origem === "at" ? "transporte" : "locação"}</span></h1>
    <span class="sel">${esc(o.status_nome || o.status)}</span><span class="sel" style="border-color:#555;color:#333">Responsabilidade: ${esc(o.responsabilidade_nome || o.responsabilidade)}</span>${o.parado ? `<span class="sel" style="color:#b91c1c;border-color:#b91c1c">⛔ PARADO · ${o.dias_parado} dia(s)</span>` : ""}
    <h2>Ocorrência</h2>${ocorrencia}<div class="desc">${esc(o.descricao)}</div>
    <h2>Contexto no momento do registro</h2>${ctx}
    ${fotos.length ? `<h2>Fotos (${fotos.length})</h2>${antigas ? `<div class="aviso">⚠ ${antigas} foto(s) antiga(s) ou da galeria — o arquivo é anterior ao registro (ver a tarja de cada foto).</div>` : ""}<div class="fts">${fotosHtml}</div>` : ""}
    ${anexos ? `<h2>Boletim de ocorrência e documentos</h2><ul>${anexos}</ul>` : ""}
    ${msgs ? `<h2>Conversa com o cliente</h2><table>${msgs}</table>` : ""}
    ${hist ? `<h2>Histórico</h2><table>${hist}</table>` : ""}
    <div style="font-size:9px;color:#888;margin-top:8mm">Registro do QuotaFlow. As fotos levam a tarja de rastreabilidade (o quê, SIN, data/hora, GPS, quem). Os links dos arquivos valem por 1 hora a partir da emissão.</div>
    <div class="nao-imprimir" style="margin-top:14px;text-align:center"><button onclick="window.print()" style="padding:8px 18px;font-size:13px">🖨 Imprimir / Salvar em PDF</button></div>
  </div></body></html>`;
}
export function prepararJanela() {
  const w = window.open("", "_blank");
  if (w) { try { w.document.write('<p style="font-family:sans-serif;padding:24px">Gerando o dossiê…</p>'); } catch { /* ok */ } }
  return w;
}
export function abrirDossie(o, opcoes, janela) {
  const w = janela || window.open("", "_blank");
  if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.");
  w.document.open(); w.document.write(gerarHtmlDossie(o, opcoes)); w.document.close();
}
