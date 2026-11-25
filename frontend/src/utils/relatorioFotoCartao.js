// utils/relatorioFotoCartao.js — etapa E5: 📄 RELATÓRIO AUTOMÁTICO de inspeção e reparos (A4, impressão/PDF do navegador)
//   Capa (logo, empresa, projeto, cliente, local, período, aerogeradores, técnicos) · resumo da triagem · tabela de defeitos ·
//   evidências de cada defeito (fotos com data, técnico, GPS e hash) · cada reparo etapa a etapa (campos, materiais com lote/validade/
//   proporção, temperatura/umidade, comentário, conclusão e liberação, fotos) · campos de assinatura (técnico e engenharia).
import { logoHtml, dadosEmpresa } from "./logoEmpresa";
import { quandoBR, gpsTxt } from "./cartaoFoto";

const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const ROT = { pendente: "A classificar", sem_reparo: "a) Sem reparo", reparar: "b) Reparar", investigar: "c) Investigar" };
const COR = { pendente: "#b45309", sem_reparo: "#475569", reparar: "#b91c1c", investigar: "#7e22ce" };
const STR = { aberto: "Aberto", em_execucao: "Em execução", concluido: "Concluído", cancelado: "Cancelado" };

const fotoHtml = (x) => `<figure><img src="${esc(x.url || "")}" alt=""><figcaption>${quandoBR(x.tirada_em)} · ${esc(x.tecnico || "—")} · ${esc(gpsTxt(x.gps))}<br><span class="h">SHA-256 ${esc(String(x.hash || "").slice(0, 16))}…</span></figcaption></figure>`;
const grade = (l) => (l.length ? `<div class="fotos">${l.map(fotoHtml).join("")}</div>` : "");
let VOC = { ativo: "Aerogerador", ativos: "Aerogeradores", componente: "Pá" };
const tituloDef = (d) => `${d.referencia ? `${esc(d.referencia)} · ` : ""}${d.pa ? `${esc(VOC.componente)} ${esc(d.pa)} · ` : ""}Defeito ${esc(d.numero)}`;

export function htmlRelatorioInspecao(R) {
  const p = R.projeto; const s = R.resumo; const emp = dadosEmpresa() || {}; if (R.vocabulario) VOC = R.vocabulario;
  const titulo = R.filtro.reparo ? `Relatório de reparo ${esc(R.filtro.reparo)}` : `Relatório de inspeção e reparos${R.filtro.referencia ? ` — ${esc(R.filtro.referencia)}` : ""}`;
  const repDe = (d) => R.reparos.find((r) => String(r.defeito_id) === String(d.id));
  const tabela = `<table><tr><th>${esc(VOC.ativo)}</th><th>${esc(VOC.componente)}</th><th>Nº</th><th>Dados do cartão</th><th>Classificação</th><th>Justificativa</th><th>Reparo</th></tr>${R.defeitos.map((d) => { const k = d.classificacao || "pendente"; const r = repDe(d);
    return `<tr><td>${esc(d.referencia || "—")}</td><td>${esc(d.pa || "—")}</td><td>${esc(d.numero)}</td><td class="p">${Object.entries(d.resumo || {}).filter(([r2]) => !/^p[áa]$|defeito|aerogerador/i.test(r2)).map(([r2, v]) => `${esc(r2)}: ${esc(v)}`).join(" · ") || "—"}</td><td style="color:${COR[k]};font-weight:700">${ROT[k]}</td><td class="p">${esc(d.justificativa || "")}</td><td>${r ? `${esc(r.numero)}<br><span class="p">${STR[r.status]}</span>` : "—"}</td></tr>`; }).join("") || '<tr><td colspan="7">Nenhum defeito registrado.</td></tr>'}</table>`;
  const evid = R.defeitos.map((d) => { const k = d.classificacao || "pendente";
    return `<div class="bloco"><h3>${tituloDef(d)} <span style="color:${COR[k]}">· ${ROT[k]}</span></h3>
      <div class="p">${Object.entries(d.resumo || {}).map(([r2, v]) => `${esc(r2)}: <b>${esc(v)}</b>`).join(" · ")}</div>
      ${d.classificacao ? `<div class="p">Triagem: ${esc(d.justificativa || "—")} — ${esc(d.classificado_por || "")}, ${quandoBR(d.classificado_em)}</div>` : ""}
      ${grade(d.fotos_lista || [])}${d.fotos_total > (d.fotos_lista || []).length ? `<div class="p">+${d.fotos_total - d.fotos_lista.length} foto(s) no sistema.</div>` : ""}</div>`; }).join("");
  const reparos = R.reparos.map((r) => { const d = R.defeitos.find((x) => String(x.id) === String(r.defeito_id));
    const etapas = (r.etapas || []).map((e, i) => { const x = r.execucao?.[e.id] || {}; const fs = r.fotos.filter((f) => f.etapa_id === e.id); const ok = x.status === "concluida";
      const campos = (e.campos || []).filter((c) => x.campos?.[c.id]).map((c) => `${esc(c.rotulo)}: <b>${esc(x.campos[c.id])}${c.unidade ? ` ${esc(c.unidade)}` : ""}</b>`).join(" · ");
      const mats = (x.materiais || []).length ? `<table class="m"><tr><th>Produto</th><th>Lote</th><th>Validade</th><th>Quantidade</th><th>Proporção</th></tr>${x.materiais.map((m) => `<tr><td>${esc(m.produto)}</td><td>${esc(m.lote)}</td><td>${dBR(m.validade)}</td><td>${esc(m.quantidade || "")} ${esc(m.unidade || "")}</td><td>${esc(m.proporcao || "")}</td></tr>`).join("")}</table>` : "";
      const amb = x.ambiente && (x.ambiente.temperatura != null || x.ambiente.umidade != null) ? `<div class="p">Condições: ${x.ambiente.temperatura != null ? `${String(x.ambiente.temperatura).replace(".", ",")} °C` : "—"} · ${x.ambiente.umidade != null ? `${String(x.ambiente.umidade).replace(".", ",")}% UR` : "—"}</div>` : "";
      return `<div class="etapa"><h4>${ok ? "✔" : "○"} ${i + 1}. ${esc(e.titulo)}${e.liberacao ? " <span class=\"p\">(liberação da engenharia)</span>" : ""}</h4>
        ${campos ? `<div class="p">${campos}</div>` : ""}${mats}${amb}${x.comentario ? `<div class="p">Comentário: ${esc(x.comentario)}</div>` : ""}
        <div class="p">${ok ? `Concluída por ${esc(x.concluida_por)} em ${quandoBR(x.concluida_em)}` : "Não concluída"}${x.liberada_em ? ` · Liberada por ${esc(x.liberada_por)} em ${quandoBR(x.liberada_em)}${x.liberacao_obs ? ` — ${esc(x.liberacao_obs)}` : ""}` : ""}${(x.reaberturas || []).length ? ` · Reaberta ${x.reaberturas.length}×: ${x.reaberturas.map((rb) => esc(rb.motivo)).join("; ")}` : ""}</div>
        ${grade(fs)}</div>`; }).join("");
    return `<div class="reparo"><h2>Reparo ${esc(r.numero)} — ${d ? tituloDef(d) : ""}</h2>
      <table class="kv"><tr><th>Procedimento</th><td>${esc(r.modelo_nome)}</td><th>Status</th><td>${STR[r.status]}</td></tr><tr><th>Responsável</th><td>${esc(r.responsavel || "—")}</td><th>Aberto / concluído</th><td>${quandoBR(r.criado_em)}${r.concluido_em ? ` → ${quandoBR(r.concluido_em)}` : ""}</td></tr></table>${etapas}</div>`; }).join("");
  const assinaturas = `<div class="ass"><div><div class="linha"></div>Técnico responsável${s.tecnicos.length ? `<br><span class="p">${esc(s.tecnicos.join(", "))}</span>` : ""}</div><div><div class="linha"></div>Engenharia${R.defeitos.find((d) => d.classificado_por) ? `<br><span class="p">${esc([...new Set(R.defeitos.map((d) => d.classificado_por).filter(Boolean))].join(", "))}</span>` : ""}</div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${titulo} — ${esc(p.nome)}</title><style>
    @page{size:A4;margin:14mm}html{background:#d1d5db}body{font-family:Arial,Helvetica,sans-serif;font-size:11.5px;color:#111;width:210mm;min-height:297mm;margin:16px auto;padding:14mm;box-sizing:border-box;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.25)}
    @media print{html{background:none}body{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}.quebra{page-break-before:always}}
    h1{font-size:19px;margin:6px 0 2px}h2{font-size:15px;margin:18px 0 6px;border-bottom:2px solid #111;padding-bottom:3px}h3{font-size:12.5px;margin:10px 0 4px}h4{font-size:12px;margin:10px 0 3px}
    table{border-collapse:collapse;width:100%;font-size:10.5px;margin:4px 0}td,th{border:1px solid #bbb;padding:4px 5px;vertical-align:top;text-align:left}th{background:#f1f5f9;font-weight:600}.kv th{width:18%}.m{width:auto;min-width:70%}
    .p{color:#444;font-size:10.5px}.h{color:#777;font-size:9px}.cards{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.card{border:1px solid #ccc;border-radius:6px;padding:6px 10px;min-width:90px}.card b{font-size:17px;display:block}
    .fotos{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 0}figure{margin:0;page-break-inside:avoid}figure img{width:100%;max-height:85mm;object-fit:contain;background:#f1f5f9;border:1px solid #ddd}figcaption{font-size:9.5px;color:#333;margin-top:2px}
    .bloco,.etapa{page-break-inside:avoid;border-left:3px solid #e2e8f0;padding-left:8px;margin:8px 0}.ass{display:flex;gap:60px;margin-top:50px;page-break-inside:avoid}.ass>div{flex:1;text-align:center}.linha{border-top:1px solid #111;margin-bottom:4px;height:40px}
  </style></head><body>
    ${logoHtml()}<div class="p">${esc(emp.nome || "")}</div>
    <h1>${titulo}</h1>
    <table class="kv"><tr><th>Projeto</th><td>${esc(p.nome)}</td><th>Cliente</th><td>${esc(p.cliente_nome || "—")}</td></tr><tr><th>Local</th><td>${esc(p.local || "—")}${p.lat != null ? ` <span class="h">(${Number(p.lat).toFixed(5)}, ${Number(p.lng).toFixed(5)})</span>` : ""}</td><th>Período das fotos</th><td>${dBR(s.de)} a ${dBR(s.ate)}</td></tr>
      <tr><th>${esc(VOC.ativos)}</th><td>${esc(s.aerogeradores.join(", ") || "—")}</td><th>Técnicos</th><td>${esc(s.tecnicos.join(", ") || "—")}</td></tr></table>
    <div class="cards"><div class="card"><b>${s.total}</b>defeitos</div><div class="card" style="color:${COR.reparar}"><b>${s.reparar}</b>reparar</div><div class="card" style="color:${COR.investigar}"><b>${s.investigar}</b>investigar</div><div class="card" style="color:${COR.sem_reparo}"><b>${s.sem_reparo}</b>sem reparo</div>${s.pendente ? `<div class="card" style="color:${COR.pendente}"><b>${s.pendente}</b>a classificar</div>` : ""}<div class="card"><b>${s.reparos_concluidos}/${s.reparos}</b>reparos concluídos</div><div class="card"><b>${s.fotos}</b>fotos</div></div>
    <h2>Defeitos e triagem</h2>${tabela}
    ${R.defeitos.length ? `<h2 class="quebra">Evidências dos defeitos</h2>${evid}` : ""}
    ${reparos ? `<div class="quebra"></div>${reparos}` : ""}
    ${assinaturas}
    <div class="p" style="margin-top:14px">Gerado em ${quandoBR(R.gerado_em)} pelo QuotaFlow. As fotos levam o cartão de registro gravado na imagem; o código SHA-256 confere que o arquivo não foi alterado.</div>
  </body></html>`;
}

/** abre o relatório numa janela e chama a impressão quando as fotos terminam de carregar */
export function abrirRelatorioInspecao(R) {
  const w = window.open("", "_blank"); if (!w) return false;
  w.document.write(htmlRelatorioInspecao(R).replace("</body>", `<script>(function(){var im=[].slice.call(document.images);var n=im.length,f=0;function ok(){if(++f>=n)setTimeout(function(){print()},300)}if(!n)return setTimeout(function(){print()},300);im.forEach(function(i){if(i.complete)ok();else{i.onload=ok;i.onerror=ok}});setTimeout(function(){if(f<n)print()},15000)})()</script></body>`));
  w.document.close(); return true;
}
