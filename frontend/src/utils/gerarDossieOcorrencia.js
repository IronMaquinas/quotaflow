// utils/gerarDossieOcorrencia.js — etapa 18h: 📄 dossiê da ocorrência / sinistro (SIN) para imprimir ou salvar em PDF
//   Contexto do momento (AT ou contrato), descrição, fotos com tarja, BO/anexos, conversa e histórico — material para seguradora/cliente.
const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dh = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const linha = (k, v) => (v == null || v === "" ? "" : `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`);

export function gerarHtmlDossie(o, { empresa = {}, interno = true } = {}) {
  const c = o.contexto || {};
  const ctx = o.origem === "at"
    ? [linha("AT", c.at?.numero), linha("Cliente", c.at?.cliente), linha("Motorista", c.motorista?.nome), linha("Conjunto", (c.conjunto || []).map((x) => [x.placa || x.tag, x.nome].filter(Boolean).join(" ")).join(" + ")),
      linha("Carga", (c.carga || []).map((x) => [x.descricao, x.origem && x.destino ? `${x.origem} → ${x.destino}` : null].filter(Boolean).join(" · ")).join(" | ")),
      linha("Documentos", (c.documentos || []).map((d) => `${String(d.tipo).toUpperCase()} ${d.nome || ""}`).join(" · ")),
      linha("Averbação", (c.fiscal?.averbacoes || []).join(", ")), linha("Apólice", c.apolice),
      linha("Última posição", c.ultima_posicao ? `${c.ultima_posicao.etapa || ""} ${dh(c.ultima_posicao.em)} · GPS ${c.ultima_posicao.gps?.lat}, ${c.ultima_posicao.gps?.lng}` : null)].join("")
    : [linha("Contrato", c.contrato?.numero), linha("Cliente", c.contrato?.cliente), linha("Equipamento", [c.equipamento?.tag, c.equipamento?.nome].filter(Boolean).join(" — ")), linha("Modelo", c.equipamento?.modelo), linha("Série", c.equipamento?.serie),
      linha("Última inspeção", c.ultima_inspecao ? `${c.ultima_inspecao.numero || ""} · ${dh(c.ultima_inspecao.em)} · ${c.ultima_inspecao.resultado || ""}${c.ultima_inspecao.nao_ok?.length ? ` · não OK: ${c.ultima_inspecao.nao_ok.join(", ")}` : ""}` : "sem inspeção registrada")].join("");
  const fotos = (o.fotos || []).filter((f) => f.url).map((f) => `<figure><img src="${esc(f.url)}" alt=""><figcaption>${esc(f.legenda || f.nome || "")} · ${esc(f.lado === "cliente" ? "cliente" : "empresa")} · ${dh(f.em)}</figcaption></figure>`).join("");
  const anexos = (o.anexos || []).map((a) => `<li>${a.tipo === "bo" ? "📄 BO" : "📎"} ${a.url ? `<a href="${esc(a.url)}">${esc(a.nome)}</a>` : esc(a.nome)} · ${dh(a.em)} · ${esc(a.por || "")}</li>`).join("");
  const msgs = (o.mensagens || []).map((m) => `<li><b>${esc(m.por || "")}</b> (${m.lado === "cliente" ? "cliente" : "empresa"}) · ${dh(m.em)}<br>${esc(m.texto)}</li>`).join("");
  const hist = interno ? (o.historico || []).map((h) => `<li>${dh(h.em)} · ${esc(h.por || "")} · ${esc(h.acao)}${h.de ? ` ${esc(h.de)} →` : ""}${h.para ? ` ${esc(h.para)}` : ""}${h.texto ? ` — ${esc(h.texto)}` : ""}</li>`).join("") : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(o.numero)} — dossiê</title><style>
body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;font-size:12.5px}h1{font-size:18px;margin:0}h2{font-size:14px;border-bottom:1px solid #999;padding-bottom:3px;margin-top:20px}
table{border-collapse:collapse;width:100%}th{text-align:left;width:150px;color:#444;font-weight:600;vertical-align:top;padding:3px 8px 3px 0}td{padding:3px 0}
.cab{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:12px}.sel{display:inline-block;padding:2px 8px;border:1px solid #111;border-radius:10px;margin-right:6px}
.parado{color:#b91c1c;font-weight:700}figure{display:inline-block;width:31%;margin:0 1% 10px 0;vertical-align:top;break-inside:avoid}figure img{width:100%;border:1px solid #ccc}figcaption{font-size:10.5px;color:#444}
.desc{white-space:pre-wrap;background:#f4f4f5;padding:10px;border-radius:6px}ul{padding-left:18px}li{margin-bottom:4px}@media print{.np{display:none}}</style></head><body>
<div class="np" style="text-align:right;margin-bottom:10px"><button onclick="window.print()">🖨 Imprimir / salvar PDF</button></div>
<div class="cab"><div><h1>⚠️ ${esc(o.numero)} — ${esc(o.tipo_nome || o.tipo)}</h1><div>${esc(o.origem === "at" ? "Transporte" : "Locação")} · registrada por ${esc(o.registrado_por_nome || "—")}${o.registrado_por_tipo === "locatario" ? " (cliente)" : ""} em ${dh(o.criado_em)}</div></div><div style="text-align:right"><b>${esc(empresa.nome || "")}</b>${empresa.cnpj ? `<br>CNPJ ${esc(empresa.cnpj)}` : ""}</div></div>
<div><span class="sel">${esc(o.status_nome || o.status)}</span><span class="sel">Responsabilidade: ${esc(o.responsabilidade_nome || o.responsabilidade)}</span>${o.parado ? `<span class="parado">⛔ Parado · ${o.dias_parado} dia(s)</span>` : ""}</div>
<h2>Ocorrência</h2><table>${linha("Quando", dh(o.ocorrido_em))}${linha("Local", o.local)}${linha("GPS", o.gps ? `${o.gps.lat}, ${o.gps.lng}` : null)}${linha("Encerrada em", o.encerrado_em ? dh(o.encerrado_em) : null)}${interno && o.tarefa?.numero ? linha("Tarefa", o.tarefa.numero) : ""}</table>
<div class="desc">${esc(o.descricao)}</div>
<h2>Contexto no momento do registro</h2><table>${ctx}</table>
${fotos ? `<h2>Fotos (${(o.fotos || []).length})</h2>${fotos}` : ""}${anexos ? `<h2>BO e documentos</h2><ul>${anexos}</ul>` : ""}${msgs ? `<h2>Conversa com o cliente</h2><ul>${msgs}</ul>` : ""}${hist ? `<h2>Histórico</h2><ul>${hist}</ul>` : ""}
<p style="font-size:10px;color:#666;margin-top:24px">Gerado pelo QuotaFlow em ${dh(new Date())}. Links das fotos e arquivos valem por 1 hora.</p></body></html>`;
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
