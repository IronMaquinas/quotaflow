// frontend/src/utils/gerarRelatorioViagem.js — etapa 18e: 📑 RELATÓRIO COMPLETO DA VIAGEM (aba nova → imprimir / salvar em PDF)
//   AT (rota, cliente, motorista, conjunto, carga) + previsto × real + fluxo (hora, GPS, quem) + inspeções (resultado, itens não OK,
//   fotos com a tarja de rastreabilidade) + documentos. Sem valores — serve para o cliente e como evidência (sinistro, reclamação).
import { logoHtml } from "./logoEmpresa";
import { valorCelula } from "./gerarBid";

const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");
const num = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const ANEXO = { nfe: "NF-e", cte: "CT-e", mdfe: "MDF-e", outro: "Outro" };
const RES = { aprovado: ["Aprovado", "#16a34a"], ressalvas: ["Com ressalvas", "#d97706"], reprovado: ["Reprovado", "#dc2626"] };
const gpsLink = (g) => (g && g.lat != null ? `<a href="https://maps.google.com/?q=${g.lat},${g.lng}" style="color:#2563eb">${Number(g.lat).toFixed(5)}, ${Number(g.lng).toFixed(5)}</a>` : "—");
const ST = { feita: "✓ feita", reprovada: "⛔ reprovada", pendente: "pendente" };

export function gerarHtmlRelatorioViagem(d) {
  const cols = (d.colunas || []).filter((c) => c.chave !== "data_prevista");
  const linha = (r, v) => `<div class="l"><span>${esc(r)}</span><b>${v || "—"}</b></div>`;
  const r = d.real || {}; const rs = d.resumo || {};
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório da viagem ${esc(d.numero)}</title><style>
  body { margin: 0; background: #f2f2f2; font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; }
  .pagina { max-width: 190mm; margin: 10mm auto; padding: 12mm 14mm; background: #fff; }
  .topo { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 5mm; }
  h1 { font-size: 18px; margin: 0; } h2 { font-size: 12px; text-transform: uppercase; color: #444; margin: 14px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
  h3 { font-size: 12px; margin: 10px 0 4px; }
  .grade { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; } .l { display: flex; gap: 6px; } .l span { color: #666; min-width: 100px; }
  .kpis { display: flex; gap: 8px; } .kpi { border: 1px solid #ccc; border-radius: 4px; padding: 6px 10px; flex: 1; font-size: 11px; } .kpi b { display: block; font-size: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; } th { text-align: left; border-bottom: 1.5px solid #111; padding: 4px; font-size: 9.5px; text-transform: uppercase; color: #444; } td { border-bottom: 1px solid #ddd; padding: 4px; vertical-align: top; }
  .ins { border: 1px solid #ccc; border-radius: 6px; padding: 8px 10px; margin: 8px 0; page-break-inside: avoid; }
  .fotos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 6px; } .fotos figure { margin: 0; } .fotos img { width: 100%; border: 1px solid #ccc; border-radius: 3px; }
  .fotos figcaption { font-size: 9.5px; color: #555; } .nok { color: #b91c1c; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print { body { background: #fff; } .pagina { margin: 0; padding: 0; } .nao-imprimir { display: none; } } @page { size: A4; margin: 12mm; }
  </style></head><body><div class="pagina">
    <div class="topo"><div>${logoHtml() || `<b>${esc(d.empresa?.nome)}</b>`}</div><div style="text-align:right"><h1>Relatório da viagem — ${esc(d.numero)}</h1><div style="font-size:10.5px;color:#555">${esc(d.status_nome || "")}${d.ref ? ` · ${esc(d.ref)}` : ""}<br/>emitido em ${dataHora(d.emitido_em)}</div></div></div>
    <div class="kpis">
      <div class="kpi">Etapas<b>${rs.feitas ?? 0}/${rs.etapas ?? 0}</b>feitas</div>
      <div class="kpi">Inspeções<b>${rs.inspecoes ?? 0}</b>${rs.reprovadas ? `<span class="nok">${rs.reprovadas} reprovada(s)</span>` : "nenhuma reprovada"}</div>
      <div class="kpi">Itens não OK<b class="${rs.nao_ok ? "nok" : ""}">${rs.nao_ok ?? 0}</b>nas inspeções</div>
      <div class="kpi">Duração<b>${r.duracao_h != null ? `${num(r.duracao_h)} h` : "—"}</b>${r.atraso_h != null ? (r.atraso_h > 0 ? `<span class="nok">${num(r.atraso_h)} h após o previsto</span>` : "dentro do previsto") : "&nbsp;"}</div>
      ${r.km ? `<div class="kpi">Km<b>${num(r.km.rodados)}</b>${num(r.km.de)} → ${num(r.km.ate)}</div>` : ""}
    </div>
    <h2>Rota — previsto × real</h2>
    <table><thead><tr><th></th><th>Local</th><th>Previsto</th><th>Real</th></tr></thead><tbody>
      <tr><td><b>Coleta</b></td><td>${esc(d.origem || "—")}</td><td>${dataHora(d.inicio_previsto)}</td><td>${dataHora(r.iniciada_em)}</td></tr>
      <tr><td><b>Entrega</b></td><td>${esc(d.destino || "—")}</td><td>${dataHora(d.fim_previsto)}</td><td>${dataHora(r.concluida_em)}</td></tr></tbody></table>
    <h2>Cliente, motorista e conjunto</h2><div class="grade">${linha("Cliente", esc(d.cliente_nome))}${linha("Contato", esc(d.contato_cliente))}${linha("Trecho", esc(d.grupo_titulo))}${linha("Referência", esc(d.referencia))}
      ${linha("Motorista", esc(d.motorista?.nome || d.motorista_nome))}${linha("CNH", esc(d.motorista?.cnh))}${linha("Conjunto", esc((d.conjunto || []).map((c) => `${c.tag}${c.nome ? ` ${c.nome}` : ""}`).join(" + ")))}</div>
    <h2>Carga</h2><table><thead><tr><th>Item</th>${cols.map((c) => `<th>${esc(c.rotulo)}</th>`).join("")}<th>Nº de série</th><th>Qtd</th><th>Volumes</th></tr></thead>
      <tbody>${(d.itens || []).map((i) => `<tr><td><b>${esc(i.n || "")}</b></td>${cols.map((c) => `<td>${esc(valorCelula(c, i.valores?.[c.chave]))}</td>`).join("")}<td>${esc(i.serie || "")}</td><td>${esc(i.quantidade ?? 1)}</td><td>${esc(i.volumes ?? "")}</td></tr>`).join("")}</tbody></table>
    <h2>Fluxo da viagem</h2><table><thead><tr><th>Etapa</th><th>Situação</th><th>Quando</th><th>Quem</th><th>GPS</th></tr></thead><tbody>
      ${(d.fluxo || []).map((e) => `<tr><td>${esc(e.rotulo)}${e.inspecao_numero ? `<br/><small>${esc(e.inspecao_numero)}${e.resultado ? ` — ${esc((RES[e.resultado] || [e.resultado])[0])}` : ""}</small>` : ""}</td>
        <td>${esc(ST[e.status] || e.status)}${e.liberacao ? `<br/><small>liberada por ${esc(e.liberacao.por || "")} em ${dataHora(e.liberacao.em)}: ${esc(e.liberacao.motivo)}</small>` : ""}</td><td>${dataHora(e.feita_em)}</td><td>${esc(e.por || "")}</td><td>${gpsLink(e.gps)}</td></tr>`).join("")}
      ${!(d.fluxo || []).length ? '<tr><td colspan="5">Sem fluxo de etapas nesta AT.</td></tr>' : ""}</tbody></table>
    <h2>Inspeções</h2>
    ${(d.inspecoes || []).map((i) => { const rr = RES[i.resultado] || [i.resultado || "—", "#111"];
      return `<div class="ins"><h3>${esc(i.numero || "Inspeção")} · ${esc(i.modelo)} — <span style="color:${rr[1]}">${esc(rr[0])}</span></h3>
        <div style="font-size:11px;color:#444">${esc(i.equipamento || "")} · ${esc(i.executor || "")} · ${dataHora(i.concluida_em)}${i.km != null ? ` · km ${num(i.km)}` : ""}${i.local ? ` · ${esc(i.local)}` : ""}${i.gps ? ` · GPS ${gpsLink(i.gps)}` : ""} · ${i.total_pontos} ponto(s) verificado(s)</div>
        ${i.nao_ok.length ? `<ul style="margin:6px 0 0 16px;padding:0">${i.nao_ok.map((n) => `<li class="nok">${esc(n.rotulo)}${n.obs ? ` — ${esc(n.obs)}` : ""}${n.resolvido ? ` <span style="color:#16a34a">(resolvido na hora: ${esc(n.resolucao || "")})</span>` : ""}</li>`).join("")}</ul>` : '<div style="font-size:11px;color:#16a34a;margin-top:4px">Todos os pontos OK.</div>'}
        ${i.fotos.length ? `<div class="fotos">${i.fotos.map((f) => `<figure><img src="${esc(f.url)}" alt=""/><figcaption class="${f.nok ? "nok" : ""}">${esc(f.legenda)}</figcaption></figure>`).join("")}</div>` : ""}</div>`; }).join("")}
    ${!(d.inspecoes || []).length ? '<p style="color:#666">Nenhuma inspeção registrada nesta viagem.</p>' : ""}
    ${(d.anexos || []).length ? `<h2>Documentos da viagem</h2><p style="margin:0">${d.anexos.map((a) => `${ANEXO[a.tipo] || a.tipo}: ${esc(a.nome)}${a.versao > 1 ? ` (v${a.versao})` : ""}`).join(" · ")}</p>` : ""}
    ${(d.historico_docs || []).length ? `<h3>Histórico dos documentos</h3><table><thead><tr><th>Quando</th><th>Quem</th><th>Documento</th><th>O que aconteceu</th></tr></thead><tbody>${d.historico_docs.map((h) => `<tr><td>${dataHora(h.em)}</td><td>${esc(h.por || "—")}</td><td>${esc(h.doc)}</td><td>${esc(h.texto)}</td></tr>`).join("")}</tbody></table>` : ""}
    ${d.observacoes ? `<h2>Observações</h2><p style="white-space:pre-wrap;margin:0">${esc(d.observacoes)}</p>` : ""}
    <div style="font-size:9px;color:#777;margin-top:8mm">${esc(d.empresa?.razao_social || d.empresa?.nome)}${d.empresa?.cnpj ? ` · CNPJ ${esc(d.empresa.cnpj)}` : ""} · relatório gerado pelo QuotaFlow a partir dos registros da viagem (horários e GPS gravados no momento de cada etapa; fotos com tarja de rastreabilidade).</div>
    <div class="nao-imprimir" style="margin-top:14px;text-align:center"><button onclick="window.print()" style="padding:8px 18px;font-size:13px">🖨 Imprimir / Salvar em PDF</button></div>
  </div></body></html>`;
}
export function abrirRelatorioViagem(dados, janela) {
  const w = janela || window.open("", "_blank");
  if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.");
  w.document.open(); w.document.write(gerarHtmlRelatorioViagem(dados)); w.document.close();
}
