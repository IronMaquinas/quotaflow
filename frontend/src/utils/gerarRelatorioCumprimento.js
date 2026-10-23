// frontend/src/utils/gerarRelatorioCumprimento.js — etapa 14b.2
// Relatório de cumprimento das rotinas de inspeção no período — HTML "printável" (aba nova + print → PDF).
const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dataBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const cor = (p) => (p == null ? "#6b7280" : p >= 90 ? "#16a34a" : p >= 70 ? "#d97706" : "#dc2626");
const estado = (l) => (l.encerrada ? "encerrada" : l.estado === "atrasada" ? `<b style="color:#dc2626">atrasada ${-l.dias} d</b>` : l.estado === "hoje" ? '<b style="color:#d97706">vence hoje</b>' : `próxima ${dataBR(l.proxima)}`);

export function gerarHtmlCumprimento({ de, ate, linhas = [], total = {}, inspecoes = {}, empresa = {} }) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Cumprimento das inspeções ${dataBR(de)} a ${dataBR(ate)}</title><style>
  body { margin: 0; background: #f2f2f2; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; font-size: 11.5px; }
  .pagina { max-width: 190mm; margin: 10mm auto; padding: 12mm; background: #fff; color: #111; }
  h1 { font-size: 16px; margin: 6mm 0 3mm; }
  .kpis { display: flex; gap: 8px; margin-bottom: 6mm; } .kpi { border: 1px solid #ccc; border-radius: 4px; padding: 6px 10px; flex: 1; } .kpi b { display: block; font-size: 20px; }
  table { width: 100%; border-collapse: collapse; } th { text-align: left; font-size: 9px; color: #555; text-transform: uppercase; border-bottom: 1.5px solid #111; padding: 4px; }
  td { border-bottom: 1px solid #e5e5e5; padding: 4px; color: #111; font-size: 11px; vertical-align: top; } td.n { text-align: right; white-space: nowrap; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print { body { background: #fff; } .pagina { margin: 0; padding: 0; } .nao-imprimir { display: none; } } @page { size: A4; margin: 12mm; }
  </style></head><body><div class="pagina">
    <div style="display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:6px">
      <b style="font-size:14px">${esc(empresa.razao_social || empresa.nome || "")}</b>
      <div style="text-align:right;font-size:10px;color:#555">emitido em ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</div>
    </div>
    <h1>Cumprimento das inspeções de rotina — ${dataBR(de)} a ${dataBR(ate)}</h1>
    <div class="kpis">
      <div class="kpi">Cumprimento<b style="color:${cor(total.pct)}">${total.pct == null ? "—" : `${total.pct}%`}</b>${total.cumpridas || 0} de ${total.esperadas || 0} previstas</div>
      <div class="kpi">Inspeções no período<b>${inspecoes.total || 0}</b>${inspecoes.terceiros || 0} de terceiros</div>
      <div class="kpi">Reprovadas<b style="color:${inspecoes.reprovadas ? "#dc2626" : "#111"}">${inspecoes.reprovadas || 0}</b>${inspecoes.ressalvas || 0} com ressalvas</div>
    </div>
    <table><thead><tr><th>Equipamento</th><th>Rotina</th><th>Quem faz</th><th class="n">Feitas / previstas</th><th class="n">%</th><th>Situação</th></tr></thead><tbody>
    ${linhas.map((l) => `<tr><td>${esc(l.equipamento_nome)}</td><td>${esc(l.frequencia_nome)} · ${esc(l.modelo_nome)}</td><td>${esc(l.responsavel_nome)}</td><td class="n">${l.cumpridas} / ${l.esperadas}</td><td class="n" style="color:${cor(l.pct)};font-weight:700">${l.pct == null ? "—" : `${l.pct}%`}</td><td>${estado(l)}</td></tr>`).join("")}
    ${linhas.length ? "" : '<tr><td colspan="6" style="text-align:center;color:#666;padding:12px">Nenhuma rotina no período.</td></tr>'}
    </tbody></table>
    <div style="font-size:9.5px;color:#666;margin-top:6mm">Período previsto = janela da frequência (diária, semanal, quinzenal ou mensal) a partir do início da rotina; cumprida quando houve pelo menos uma inspeção do modelo dentro dela. Janela em andamento só conta se já foi cumprida.</div>
    <div class="nao-imprimir" style="margin-top:14px;text-align:center"><button onclick="window.print()" style="padding:8px 18px;font-size:13px">🖨 Imprimir / Salvar em PDF</button></div>
  </div></body></html>`;
}
export function prepararJanela() {
  const w = window.open("", "_blank");
  if (w) { try { w.document.write('<p style="font-family:sans-serif;padding:24px">Gerando o relatório…</p>'); } catch { /* ok */ } }
  return w;
}
export function abrirRelatorioCumprimento(dados, janela) {
  const w = janela || window.open("", "_blank");
  if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.");
  w.document.open(); w.document.write(gerarHtmlCumprimento(dados)); w.document.close();
}
