// frontend/src/utils/gerarAT.js — etapa 16a
// AT "printável" para o motorista (aba nova → imprimir / salvar em PDF) — SEM valores:
// cabeçalho (logo, AT, pedido, cliente), coleta → entrega, motorista, conjunto, itens do trecho, observações, anexos, assinaturas.
import { logoHtml } from "./logoEmpresa";
import { valorCelula } from "./gerarBid";

const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");
const ANEXO = { nfe: "NF-e", cte: "CT-e", mdfe: "MDF-e", outro: "Outro" };

export function gerarHtmlAT(d) {
  const cols = (d.colunas || []).filter((c) => c.chave !== "data_prevista");
  const linha = (r, v) => `<div class="l"><span>${esc(r)}</span><b>${v || "—"}</b></div>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(d.numero)}</title><style>
  body { margin: 0; background: #f2f2f2; font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12.5px; }
  .pagina { max-width: 190mm; margin: 10mm auto; padding: 12mm 16mm; background: #fff; }
  .topo { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 5mm; }
  h1 { font-size: 18px; margin: 0; } h2 { font-size: 12px; text-transform: uppercase; color: #444; margin: 14px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
  .grade { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; } .l { display: flex; gap: 6px; } .l span { color: #666; min-width: 92px; }
  .rota { display: grid; grid-template-columns: 1fr 40px 1fr; align-items: center; border: 1.5px solid #111; border-radius: 6px; padding: 8px 10px; }
  .rota .seta { text-align: center; font-size: 20px; } .rota small { color: #666; display: block; font-size: 10.5px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; } th { text-align: left; border-bottom: 1.5px solid #111; padding: 4px; font-size: 10px; text-transform: uppercase; color: #444; } td { border-bottom: 1px solid #ddd; padding: 4px; }
  .ass { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10mm; margin-top: 18mm; font-size: 10.5px; text-align: center; } .ass div { border-top: 1px solid #111; padding-top: 4px; }
  .alerta { border: 1.5px solid #c00; color: #c00; padding: 6px 8px; border-radius: 4px; margin: 8px 0; font-size: 11px; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print { body { background: #fff; } .pagina { margin: 0; padding: 0; } .nao-imprimir { display: none; } } @page { size: A4; margin: 12mm; }
  </style></head><body><div class="pagina">
    <div class="topo"><div>${logoHtml() || `<b>${esc(d.empresa?.nome)}</b>`}</div><div style="text-align:right"><h1>${esc(d.numero)}</h1><div style="font-size:10.5px;color:#555">Autorização de Transporte · ${esc(d.status_nome || "")}<br/>${d.ref ? esc(d.ref) : `Pedido ${esc(d.pv_numero)}`}${d.referencia ? ` · ref. ${esc(d.referencia)}` : ""}</div></div></div>
    <div class="rota"><div><small>Coleta</small><b>${esc(d.origem || "—")}</b><br/>${dataHora(d.inicio_previsto)}</div><div class="seta">➜</div><div><small>Entrega</small><b>${esc(d.destino || "—")}</b><br/>${d.fim_previsto ? dataHora(d.fim_previsto) : "—"}</div></div>
    <h2>Cliente e trecho</h2><div class="grade">${linha("Cliente", esc(d.cliente_nome))}${linha("Trecho", esc(d.grupo_titulo))}${linha("Contato", esc(d.contato_cliente))}${linha("Itens", esc(d.qtd_itens))}</div>
    <h2>Motorista</h2><div class="grade">${linha("Nome", esc(d.motorista?.nome || d.motorista_nome))}${linha("CPF", esc(d.motorista?.cpf))}${linha("CNH", esc(d.motorista?.cnh))}${linha("Telefone", esc(d.motorista?.telefone))}</div>
    ${d.liberacao ? `<div class="alerta">Motorista liberado pelo gestor ${esc(d.liberacao.por || "")} em ${dataHora(d.liberacao.em)}: ${esc(d.liberacao.justificativa)}</div>` : ""}
    <h2>Conjunto</h2><table><thead><tr><th>Função</th><th>Tag</th><th>Equipamento</th></tr></thead><tbody>${(d.conjunto || []).map((c) => `<tr><td>${c.papel === "cavalo" ? "Cavalo (trator)" : "Implemento"}</td><td><b>${esc(c.tag)}</b></td><td>${esc(c.nome)}</td></tr>`).join("")}</tbody></table>
    <h2>Carga — itens do trecho</h2><table><thead><tr><th>Item</th>${cols.map((c) => `<th>${esc(c.rotulo)}${c.unidade ? ` (${esc(c.unidade)})` : ""}</th>`).join("")}<th>Nº de série</th><th>Qtd</th><th>Volumes</th></tr></thead>
      <tbody>${(d.itens || []).map((i) => `<tr><td><b>${esc(i.n || "")}</b></td>${cols.map((c) => `<td>${esc(valorCelula(c, i.valores?.[c.chave]))}</td>`).join("")}<td><b>${esc(i.serie || "")}</b></td><td>${esc(i.quantidade ?? 1)}</td><td><b>${esc(i.volumes || 1)}</b></td></tr>`).join("")}</tbody></table>
    ${d.observacoes ? `<h2>Observações</h2><p style="white-space:pre-wrap;margin:0">${esc(d.observacoes)}</p>` : ""}
    ${(d.anexos || []).length ? `<h2>Documentos fiscais</h2><p style="margin:0">${d.anexos.map((a) => `${ANEXO[a.tipo] || a.tipo}: ${esc(a.nome)}`).join(" · ")}</p>` : ""}
    <div class="ass"><div>Motorista</div><div>Responsável pela coleta</div><div>Recebedor (nome, data e hora)</div></div>
    <div style="font-size:9px;color:#777;margin-top:8mm">${esc(d.empresa?.razao_social || d.empresa?.nome)}${d.empresa?.cnpj ? ` · CNPJ ${esc(d.empresa.cnpj)}` : ""}${d.empresa?.telefone ? ` · ${esc(d.empresa.telefone)}` : ""} · emitida no QuotaFlow em ${dataHora(new Date().toISOString())}</div>
    <div class="nao-imprimir" style="margin-top:14px;text-align:center"><button onclick="window.print()" style="padding:8px 18px;font-size:13px">🖨 Imprimir / Salvar em PDF</button></div>
  </div></body></html>`;
}
export function abrirAT(dados, janela) {
  const w = janela || window.open("", "_blank");
  if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.");
  w.document.open(); w.document.write(gerarHtmlAT(dados)); w.document.close();
}
