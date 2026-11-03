// frontend/src/utils/gerarRelatorioUtilizacao.js — etapa 18f.1: 📑 relatório detalhado de utilização × alocação (aba nova → imprimir / PDF)
//   Resumo da frota e dos motoristas + uma tabela por recurso + as ATs de cada um (dias em uso / reservados e, para admin/gestor, a receita).
import { logoHtml } from "./logoEmpresa";

const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");
const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }));
const pc = (v) => (v == null ? "—" : `${String(v).replace(".", ",")}%`);
const ST = { programada: "Programada", em_execucao: "Em execução", concluida: "Concluída" };

function secao(tit, bloco, ehEq, comValores) {
  const r = bloco.resumo || {}; const nome = (x) => (ehEq ? `${esc(x.tag)}${x.nome ? ` · ${esc(x.nome)}` : ""}` : esc(x.nome));
  const resumo = `<table><thead><tr><th>${ehEq ? "Equipamento" : "Motorista"}</th><th class="n">Disp.</th><th class="n">Em uso</th><th class="n">Ocioso</th><th class="n">Parado</th><th class="n">Utiliz.</th><th class="n">Reserv.</th><th class="n">Alocação</th><th class="n">Viagens</th>${comValores ? `<th class="n">Receita</th><th class="n">R$/dia</th><th class="n">Perdida (est.)</th>` : ""}</tr></thead><tbody>${
    bloco.itens.map((x) => `<tr><td><b>${nome(x)}</b>${x.bloqueado ? " 🔒" : ""}${x.fora_calendario ? `<div class="m">+${x.fora_calendario} dia(s) fora do calendário</div>` : ""}</td><td class="n">${x.disponiveis}</td><td class="n">${x.utilizados}</td><td class="n">${x.ociosos}</td><td class="n">${x.parados || "—"}</td><td class="n"><b>${pc(x.utilizacao_pct)}</b></td><td class="n">${x.reservados}</td><td class="n">${pc(x.alocacao_pct)}</td><td class="n">${x.viagens}</td>${comValores ? `<td class="n">${brl(x.receita)}</td><td class="n">${brl(x.receita_dia)}</td><td class="n nok">${x.receita_perdida ? brl(x.receita_perdida) : "—"}</td>` : ""}</tr>`).join("")
  }</tbody></table>`;
  const detalhe = bloco.itens.filter((x) => x.ats.length).map((x) => `<div class="rec"><h3>${nome(x)} <span class="m">· ${pc(x.utilizacao_pct)} utilizado · ${pc(x.alocacao_pct)} alocado</span></h3><table><thead><tr><th>AT</th><th>Situação</th><th>De</th><th>Até</th><th>Rota</th><th>Cliente</th><th class="n">Em uso</th><th class="n">Reserv.</th>${comValores ? `<th class="n">Receita</th><th class="n">Prevista</th>` : ""}</tr></thead><tbody>${
    x.ats.map((a) => `<tr><td><b>${esc(a.numero)}</b></td><td>${esc(ST[a.status] || a.status)}</td><td>${dBR(a.de)}</td><td>${dBR(a.ate)}</td><td>${esc(a.origem || "—")} → ${esc(a.destino || "—")}</td><td>${esc(a.cliente)}</td><td class="n">${a.dias_real}</td><td class="n">${a.dias_reserva}</td>${comValores ? `<td class="n">${brl(a.receita)}</td><td class="n">${brl(a.receita_prevista)}</td>` : ""}</tr>`).join("")
  }</tbody></table></div>`).join("");
  return `<h2>${tit}</h2><div class="kpis"><div class="kpi">Utilização<b>${pc(r.utilizacao_pct)}</b>realizado</div><div class="kpi">Alocação<b>${pc(r.alocacao_pct)}</b>reservado</div><div class="kpi">Disponibilidade<b>${pc(r.disponibilidade_pct)}</b>${r.dias_parados || 0} dia(s) parado</div><div class="kpi">Dias ociosos<b>${r.dias_ociosos ?? 0}</b>&nbsp;</div>${comValores ? `<div class="kpi">Receita perdida (est.)<b class="nok">${brl(r.receita_perdida)}</b>${brl(r.receita_dia_media)}/dia médio</div>` : ""}</div>
  ${bloco.itens.length ? resumo : `<p class="m">Sem registros.</p>`}${detalhe ? `<h2 style="font-size:11px">${tit} — ATs de cada um</h2>${detalhe}` : ""}`;
}

export function gerarHtmlRelatorioUtilizacao(d) {
  const p = d.periodo || {};
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Utilização da frota ${dBR(p.de)} a ${dBR(p.ate)}</title><style>
  body { margin: 0; background: #f2f2f2; font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11.5px; }
  .pagina { max-width: 277mm; margin: 10mm auto; padding: 10mm 12mm; background: #fff; }
  .topo { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 4mm; }
  h1 { font-size: 18px; margin: 0; } h2 { font-size: 12.5px; text-transform: uppercase; color: #333; margin: 16px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; } h3 { font-size: 12px; margin: 10px 0 4px; }
  .kpis { display: flex; gap: 8px; margin-bottom: 8px; } .kpi { border: 1px solid #ccc; border-radius: 4px; padding: 6px 10px; flex: 1; font-size: 10.5px; color: #444; } .kpi b { display: block; font-size: 16px; color: #111; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; } th { text-align: left; border-bottom: 1.5px solid #111; padding: 4px; font-size: 9px; text-transform: uppercase; color: #444; } td { border-bottom: 1px solid #ddd; padding: 4px; vertical-align: top; }
  .n { text-align: right; } .m { color: #666; font-size: 10px; font-weight: normal; } .nok { color: #b91c1c; } .rec { page-break-inside: avoid; }
  .nota { margin-top: 12px; font-size: 9.5px; color: #555; line-height: 1.5; }
  @media print { body { background: #fff; } .pagina { margin: 0; max-width: none; padding: 0; } @page { size: A4 landscape; margin: 10mm; } }
  </style></head><body><div class="pagina">
  <div class="topo"><div>${logoHtml() || `<b>${esc(d.empresa?.nome)}</b>`}</div><div style="text-align:right"><h1>Utilização × alocação da frota</h1><div style="font-size:10.5px;color:#555">${dBR(p.de)} a ${dBR(p.ate)} · hoje ${dBR(p.hoje)} · ${p.dias_operacionais_passado} dia(s) operacional(is) até hoje + ${p.dias_operacionais_futuro} à frente<br/>calendário: ${esc(d.calendario)} · ${d.ats} AT(s) · emitido em ${dataHora(d.emitido_em)}</div></div></div>
  ${d.com_valores ? `<div class="kpis"><div class="kpi">Receita realizada<b>${brl(d.receita)}</b>viagens rateadas pelos dias</div><div class="kpi">Receita reservada<b>${brl(d.receita_prevista)}</b>ATs à frente</div></div>` : ""}
  ${secao("🚛 Equipamentos da frota", d.equipamentos, true, d.com_valores)}
  ${secao("👤 Motoristas", d.motoristas, false, d.com_valores)}
  <div class="nota"><b>Como calculamos.</b> Hoje é a linha divisória. Em uso = dias operacionais em AT iniciada (do início real à conclusão, ou até hoje se em execução). Reservado = dias operacionais de AT programada/em execução de amanhã ao fim previsto. Disponível = dias operacionais − dias parado (equipamento bloqueado por inspeção reprovada). Ocioso = disponível − em uso. Rodar em domingo/feriado aparece como "fora do calendário" e não infla o %.${d.com_valores ? " Receita = valor dos itens da AT no pedido, rateado pelos dias da viagem; cada recurso do conjunto mostra a receita da viagem (a soma dos itens não é o total da frota). Perdida (estimada) = dias ociosos × R$/dia em uso do próprio recurso (sem histórico, a média)." : ""}<br/>${esc(d.empresa?.nome || "")} · gerado pelo QuotaFlow.</div>
  </div></body></html>`;
}

export function abrirRelatorioUtilizacao(dados, janela) {
  const w = janela || window.open("", "_blank");
  if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.");
  w.document.open(); w.document.write(gerarHtmlRelatorioUtilizacao(dados)); w.document.close();
}
