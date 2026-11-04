// frontend/src/utils/gerarRelatorioTarefas.js — etapa 18g.2b: 📑 relatório das tarefas do ✅ Plano por período (impressão / PDF / CSV)
//   resumoTarefas(lista)          → números do período (abertas, concluídas, % no prazo, atrasadas, canceladas, tempo médio, por tipo)
//   gerarHtmlRelatorioTarefas(..) → relatório (tabela) ou 🔎 modo auditoria (+ ficha por tarefa: histórico, evidências, vínculos)
//   csvTarefas(lista)             → planilha (separador ;)
//   Data de conclusão = a última mudança para "Concluída" no histórico (tarefas antigas, sem histórico: sem data).
import { logoHtml } from "./logoEmpresa";

export const TIPOS_REL = { TR: "Transporte", NC: "Não conformidade", AU: "Auditoria", MT: "Manutenção", CM: "Comercial", HR: "Pessoas", GN: "Geral" };
const STATUS = { pendente: "Pendente", em_andamento: "Em andamento", concluida: "Concluída", cancelada: "Cancelada" };
const ACAO = { criada: "criada", status: "situação", editada: "editada", reclassificada: "reclassificada", anexo: "evidência", anexo_removido: "evidência removida" };
const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const diaBR = (iso) => (iso ? new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10) : null);
const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");
const hoje = () => diaBR(new Date().toISOString());
const tipoDe = (t) => t.tipo || ({ prospeccao: "CM", multa: "HR", autuacao: "NC", fiscal: "TR" }[t.origem]) || "GN";

/** data em que a tarefa foi concluída (última entrada do histórico que levou a "Concluída") */
export function concluidaEm(t) {
  if (t.status !== "concluida") return null;
  const h = [...(t.historico || [])].reverse().find((x) => x.acao === "status" && /Conclu/i.test(String(x.para || "")));
  return h?.em || null;
}
/** situação no prazo: true/false/null (sem prazo) */
export function noPrazo(t, ref = hoje()) {
  if (!t.prazo) return null;
  const prazo = String(t.prazo).slice(0, 10);
  if (t.status === "concluida") { const c = diaBR(concluidaEm(t)); return c ? c <= prazo : null; }
  if (t.status === "cancelada") return null;
  return ref <= prazo;
}
export const dataBase = (t, base) => (base === "prazo" ? (t.prazo ? String(t.prazo).slice(0, 10) : null) : base === "conclusao" ? diaBR(concluidaEm(t)) : diaBR(t.criado_em));

export function resumoTarefas(lista) {
  const conc = lista.filter((t) => t.status === "concluida");
  const comPrazoConc = conc.filter((t) => noPrazo(t) != null);
  const hj = hoje();
  const atrasadas = lista.filter((t) => !["concluida", "cancelada"].includes(t.status) && t.prazo && String(t.prazo).slice(0, 10) < hj).length;
  const dur = conc.map((t) => { const c = concluidaEm(t); return c && t.criado_em ? (new Date(c) - new Date(t.criado_em)) / 86400000 : null; }).filter((x) => x != null && x >= 0);
  const porTipo = Object.keys(TIPOS_REL).map((k) => { const l = lista.filter((t) => tipoDe(t) === k); return { tipo: k, nome: TIPOS_REL[k], total: l.length, concluidas: l.filter((t) => t.status === "concluida").length, abertas: l.filter((t) => !["concluida", "cancelada"].includes(t.status)).length }; }).filter((x) => x.total);
  return { total: lista.length, abertas: lista.filter((t) => !["concluida", "cancelada"].includes(t.status)).length, concluidas: conc.length,
    no_prazo_pct: comPrazoConc.length ? Math.round((comPrazoConc.filter((t) => noPrazo(t)).length / comPrazoConc.length) * 100) : null,
    atrasadas, canceladas: lista.filter((t) => t.status === "cancelada").length, dias_medios: dur.length ? Math.round((dur.reduce((a, b) => a + b, 0) / dur.length) * 10) / 10 : null, porTipo };
}

const linhaTabela = (t) => { const np = noPrazo(t); return `<tr><td class="m"><b>${esc(t.numero || "—")}</b></td><td>${esc(t.titulo)}${t.detalhe ? `<div class="d">${esc(String(t.detalhe).slice(0, 180))}${String(t.detalhe).length > 180 ? "…" : ""}</div>` : ""}</td><td>${esc(TIPOS_REL[tipoDe(t)] || tipoDe(t))}</td><td>${esc(t.responsavel || "—")}</td><td>${dBR(diaBR(t.criado_em))}</td><td>${dBR(t.prazo)}</td><td>${dBR(diaBR(concluidaEm(t)))}</td><td>${esc(STATUS[t.status] || t.status)}</td><td class="c ${np === false ? "nok" : np ? "ok" : ""}">${np == null ? "—" : np ? "sim" : "não"}</td></tr>`; };

function fichaAuditoria(t) {
  const h = (t.historico || []).map((x) => `<tr><td>${dataHora(x.em)}</td><td>${esc(x.por || "—")}</td><td>${esc(ACAO[x.acao] || x.acao)}</td><td>${x.campo ? `<b>${esc(x.campo)}</b>: ${esc(x.de)} → ${esc(x.para)}${x.texto ? ` · ${esc(x.texto)}` : ""}` : esc(x.texto || "")}</td></tr>`).join("");
  const ev = (t.anexos || []).map((a) => `<li>${esc(a.nome)} <span class="d">· ${esc(a.por || "—")} · ${dataHora(a.em)}</span></li>`).join("");
  const vin = (t.vinculos || []).map((v) => esc(v.numero || `${v.tipo} ${v.id}`)).join(" · ");
  const com = (t.comentarios || []).map((c) => `<li>${esc(c.texto)} <span class="d">· ${esc(c.autor || "—")} · ${dataHora(c.data)}</span></li>`).join("");
  return `<div class="ficha"><h3>${esc(t.numero || "—")} · ${esc(t.titulo)}</h3>
    <div class="grade"><span>Tipo</span><b>${esc(TIPOS_REL[tipoDe(t)] || "")}</b><span>Responsável</span><b>${esc(t.responsavel || "—")}</b><span>Aberta em</span><b>${dataHora(t.criado_em)}</b><span>Prazo</span><b>${dBR(t.prazo)}</b><span>Concluída em</span><b>${dataHora(concluidaEm(t))}</b><span>Situação</span><b>${esc(STATUS[t.status] || t.status)}</b></div>
    ${t.detalhe ? `<p>${esc(t.detalhe)}</p>` : ""}${vin ? `<p><b>Vínculos:</b> ${vin}</p>` : ""}
    <p><b>Evidências (${(t.anexos || []).length}):</b></p>${ev ? `<ul>${ev}</ul>` : `<p class="d">Nenhuma evidência anexada.</p>`}
    ${com ? `<p><b>Acompanhamento:</b></p><ul>${com}</ul>` : ""}
    <p><b>Histórico:</b></p>${h ? `<table><thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Detalhe</th></tr></thead><tbody>${h}</tbody></table>` : `<p class="d">Sem histórico registrado.</p>`}</div>`;
}

export function gerarHtmlRelatorioTarefas(lista, { titulo = "Relatório de tarefas", filtros = "", auditoria = false, empresa = "" } = {}) {
  const r = resumoTarefas(lista);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
  body { margin: 0; background: #f2f2f2; font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11px; }
  .pagina { max-width: 277mm; margin: 10mm auto; padding: 10mm 12mm; background: #fff; }
  .topo { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 4mm; }
  h1 { font-size: 18px; margin: 0; } h2 { font-size: 12px; text-transform: uppercase; color: #333; margin: 14px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; } h3 { font-size: 12.5px; margin: 0 0 6px; }
  .kpis { display: flex; gap: 8px; flex-wrap: wrap; } .kpi { border: 1px solid #ccc; border-radius: 4px; padding: 6px 10px; flex: 1; min-width: 90px; color: #444; font-size: 10px; } .kpi b { display: block; font-size: 16px; color: #111; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; } th { text-align: left; border-bottom: 1.5px solid #111; padding: 4px; font-size: 9px; text-transform: uppercase; color: #444; } td { border-bottom: 1px solid #ddd; padding: 4px; vertical-align: top; }
  .m { font-family: "Courier New", monospace; white-space: nowrap; } .c { text-align: center; } .d { color: #666; font-size: 9.5px; } .ok { color: #15803d; font-weight: bold; } .nok { color: #b91c1c; font-weight: bold; }
  .ficha { border: 1px solid #ccc; border-radius: 6px; padding: 8px 10px; margin: 10px 0; page-break-inside: avoid; } .ficha p { margin: 4px 0; } .ficha ul { margin: 2px 0 4px 16px; padding: 0; }
  .grade { display: grid; grid-template-columns: auto 1fr auto 1fr auto 1fr; gap: 2px 10px; margin-bottom: 4px; } .grade span { color: #666; }
  .ass { display: flex; gap: 40px; margin-top: 30px; } .ass div { flex: 1; border-top: 1px solid #111; padding-top: 4px; text-align: center; color: #444; }
  .nota { margin-top: 12px; font-size: 9px; color: #555; }
  @media print { body { background: #fff; } .pagina { margin: 0; max-width: none; padding: 0; } @page { size: A4 landscape; margin: 10mm; } }
  </style></head><body><div class="pagina">
  <div class="topo"><div>${logoHtml() || `<b>${esc(empresa)}</b>`}</div><div style="text-align:right"><h1>${esc(titulo)}${auditoria ? " — modo auditoria" : ""}</h1><div style="font-size:10.5px;color:#555">${esc(filtros)}<br/>emitido em ${dataHora(new Date().toISOString())}</div></div></div>
  <div class="kpis"><div class="kpi">Tarefas<b>${r.total}</b>no filtro</div><div class="kpi">Abertas<b>${r.abertas}</b>&nbsp;</div><div class="kpi">Concluídas<b>${r.concluidas}</b>&nbsp;</div><div class="kpi">No prazo<b>${r.no_prazo_pct == null ? "—" : `${r.no_prazo_pct}%`}</b>das concluídas</div><div class="kpi">Atrasadas<b class="${r.atrasadas ? "nok" : ""}">${r.atrasadas}</b>hoje</div><div class="kpi">Canceladas<b>${r.canceladas}</b>&nbsp;</div><div class="kpi">Tempo médio<b>${r.dias_medios == null ? "—" : `${String(r.dias_medios).replace(".", ",")} d`}</b>até concluir</div></div>
  ${r.porTipo.length ? `<h2>Por tipo</h2><table><thead><tr><th>Tipo</th><th class="c">Total</th><th class="c">Abertas</th><th class="c">Concluídas</th></tr></thead><tbody>${r.porTipo.map((x) => `<tr><td>${esc(x.nome)} <span class="d">(${x.tipo})</span></td><td class="c">${x.total}</td><td class="c">${x.abertas}</td><td class="c">${x.concluidas}</td></tr>`).join("")}</tbody></table>` : ""}
  <h2>Tarefas (${lista.length})</h2>
  ${lista.length ? `<table><thead><tr><th>Nº</th><th>Tarefa</th><th>Tipo</th><th>Responsável</th><th>Aberta</th><th>Prazo</th><th>Concluída</th><th>Situação</th><th class="c">No prazo</th></tr></thead><tbody>${lista.map(linhaTabela).join("")}</tbody></table>` : `<p class="d">Nenhuma tarefa no filtro.</p>`}
  ${auditoria && lista.length ? `<h2>Fichas das tarefas — histórico, evidências e vínculos</h2>${lista.map(fichaAuditoria).join("")}` : ""}
  ${auditoria ? `<div class="ass"><div>Responsável pela gestão</div><div>Auditor</div></div>` : ""}
  <div class="nota">Gerado pelo QuotaFlow a partir dos registros do ✅ Plano de ação (número TSK imutável; histórico gravado a cada mudança). "No prazo" = concluída até a data do prazo (abertas: prazo ainda não venceu).</div>
  </div></body></html>`;
}

export function abrirRelatorioTarefas(lista, opcoes, janela) {
  const w = janela || window.open("", "_blank");
  if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.");
  w.document.open(); w.document.write(gerarHtmlRelatorioTarefas(lista, opcoes)); w.document.close();
}

const csvCampo = (v) => { const t = String(v ?? ""); return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
export function csvTarefas(lista) {
  const cab = ["Número", "Título", "Tipo", "Responsável", "Aberta em", "Prazo", "Concluída em", "Situação", "No prazo", "Prioridade", "Evidências", "Vínculos", "Descrição"];
  const linhas = lista.map((t) => { const np = noPrazo(t); return [t.numero || "", t.titulo, TIPOS_REL[tipoDe(t)] || tipoDe(t), t.responsavel || "", dBR(diaBR(t.criado_em)), t.prazo ? dBR(t.prazo) : "", concluidaEm(t) ? dBR(diaBR(concluidaEm(t))) : "", STATUS[t.status] || t.status, np == null ? "" : np ? "sim" : "não", t.prioridade || "", (t.anexos || []).length, (t.vinculos || []).map((v) => v.numero || v.id).join(" | "), t.detalhe || ""]; });
  return "﻿" + [cab, ...linhas].map((l) => l.map(csvCampo).join(";")).join("\r\n");
}
