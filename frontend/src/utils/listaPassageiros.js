// utils/listaPassageiros.js — etapa T1: 🖨 LISTA DE PASSAGEIROS em A4 (um bloco por ônibus, ordem de poltrona) — salvar como PDF na impressão
import { logoHtml, dadosEmpresa } from "./logoEmpresa";
const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const dt = (v) => (v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const nasc = (v) => (v ? v.split("-").reverse().join("/") : "");

export function abrirListaPassageiros(D, { onibusId = null, contatos = true } = {}) {
  const w = window.open("", "_blank"); if (!w) return false;
  const emp = dadosEmpresa() || {}; const v = D.viagem; // T1.1: saúde, motoristas, embarque por parada
  const embOn = !!v.embarques_diferentes && (v.paradas || []).some((p) => p.embarque); const embNome = (id) => (id ? (v.paradas || []).find((p) => String(p.id) === String(id))?.nome || "parada" : v.origem || "saída");
  const saude = (p) => [p.tipo_sanguineo, p.plano_saude && `plano: ${p.plano_saude_nome || "sim"}${p.plano_saude_numero ? ` nº ${p.plano_saude_numero}` : ""}`, p.seguro_viagem && `seguro: ${p.seguro_nome || "sim"}${p.seguro_apolice ? ` ${p.seguro_apolice}` : ""}`].filter(Boolean).join(" · ");
  const blocos = D.onibus.filter((o) => !onibusId || String(o.id) === String(onibusId)).map((o) => {
    const ps = D.passageiros.filter((p) => String(p.onibus_id) === String(o.id)).sort((a, b) => (parseInt(a.poltrona, 10) || 0) - (parseInt(b.poltrona, 10) || 0));
    return `<section><h2>${esc(o.nome)}${o.placa ? ` · placa ${esc(o.placa)}` : ""}${o.empresa ? ` · ${esc(o.empresa)}` : ""}</h2>
      <div class="m">${esc(o.tipo_nome || "")} · Motorista(s): ${esc((o.motoristas || []).map((m) => m.nome + (m.telefone ? ` (${m.telefone})` : "")).join(", ") || o.motorista_nome || "a definir")} · ${ps.length} passageiro(s) de ${o.lugares}</div>
      <table><thead><tr><th>Pol.</th><th>Nome</th><th>Documento</th><th>Nasc.</th>${contatos ? "<th>Telefone</th><th>Emergência</th>" : ""}${embOn ? "<th>Embarque</th>" : ""}<th>Saúde</th><th>Reserva</th><th>✔</th></tr></thead><tbody>
      ${ps.map((p) => `<tr><td class="c"><b>${esc(p.poltrona)}</b></td><td>${esc(p.nome)}${p.menor ? ' <span class="t">menor</span>' : ""}${p.assistencia ? ' <span class="t">assist.</span>' : ""}${p.obs ? `<div class="o">${esc(p.obs)}</div>` : ""}</td><td>${esc(p.documento)}</td><td>${nasc(p.nascimento)}</td>${contatos ? `<td>${esc(p.telefone)}</td><td>${esc([p.emergencia_nome, p.emergencia_telefone].filter(Boolean).join(" · "))}</td>` : ""}${embOn ? `<td>${esc(embNome(p.embarque_parada_id))}</td>` : ""}<td class="o">${esc(saude(p))}</td><td>${esc(p.reserva_codigo)}${p.reserva_tipo === "grupo" ? `<div class="o">${esc(p.responsavel)}</div>` : ""}</td><td class="x"></td></tr>`).join("") || `<tr><td colspan="11" class="c">Sem passageiros</td></tr>`}
      </tbody></table></section>`;
  }).join("") + (embOn && !onibusId ? `<section><h2>Embarques por ponto (ordem do percurso)</h2><table><thead><tr><th>Ponto</th><th>Passageiros</th></tr></thead><tbody>${[{ id: null, nome: v.origem || "Saída" }, ...(v.paradas || []).filter((p) => p.embarque)].map((pt) => { const l = D.passageiros.filter((p) => String(p.embarque_parada_id || "") === String(pt.id || "")); return `<tr><td><b>${esc(pt.nome)}</b> (${l.length})</td><td>${l.map((p) => `${esc(p.poltrona || "—")} ${esc(p.nome)}`).join(" · ") || "—"}</td></tr>`; }).join("")}</tbody></table></section>` : "") + (() => { const sem = onibusId ? [] : D.passageiros.filter((p) => !p.onibus_id || !p.poltrona); return sem.length ? `<section><h2>Sem poltrona definida (${sem.length})</h2><table><thead><tr><th>Nome</th><th>Documento</th><th>Telefone</th><th>Reserva</th></tr></thead><tbody>${sem.map((p) => `<tr><td>${esc(p.nome)}</td><td>${esc(p.documento)}</td><td>${esc(p.telefone)}</td><td>${esc(p.reserva_codigo)}</td></tr>`).join("")}</tbody></table></section>` : ""; })();
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Lista de passageiros — ${esc(v.nome)}</title><style>
    @page{size:A4;margin:14mm} @media screen{body{background:#888}.pg{width:210mm;min-height:297mm;margin:12px auto;background:#fff;padding:14mm;box-sizing:border-box}}
    body{font:11px Arial,sans-serif;color:#111;margin:0} header{display:flex;gap:14px;align-items:center;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:10px}
    header img{max-height:46px} .p{font-weight:bold;font-size:13px} h1{font-size:16px;margin:0} h2{font-size:13px;margin:14px 0 2px;break-after:avoid} .m{color:#444;margin-bottom:4px}
    table{width:100%;border-collapse:collapse} th,td{border:1px solid #999;padding:3px 5px;vertical-align:top;text-align:left} th{background:#eee} td.c{text-align:center} td.x{width:18px}
    tr{break-inside:avoid} .t{font-size:9px;border:1px solid #777;border-radius:3px;padding:0 3px} .o{font-size:9.5px;color:#555} section{break-inside:auto}
  </style></head><body><div class="pg"><header>${logoHtml()}<div><div class="p">${esc(emp.nome || "")}</div><h1>Lista de passageiros — ${esc(v.nome)}</h1>
    <div>${esc(v.numero || "")} · ${esc(v.origem || "—")} → ${esc(v.destino || "—")} · saída ${dt(v.saida_em)}${v.local_saida ? ` (${esc(v.local_saida)})` : ""} · retorno ${dt(v.retorno_em)}</div></div></header>
    ${blocos}<div class="m" style="margin-top:14px">Emitido em ${dt(new Date())}</div></div><script>setTimeout(()=>print(),300)</script></body></html>`);
  w.document.close(); return true;
}

// planilha colada (Excel/Google: copiar e colar) ou CSV → linhas. 1ª linha pode ser cabeçalho.
const COLS = { nome: /nome|passageiro/, documento: /doc|rg|cpf/, nascimento: /nasc/, telefone: /tel|cel|whats|fone/, poltrona: /pol|assento|lugar/, grupo: /grupo|fam|respons/, onibus: /[ôo]nibus|bus|carro/, emergencia_nome: /emerg.*nome|contato/, emergencia_telefone: /emerg.*tel/, obs: /obs/, embarque: /embarq/ };
export function lerPlanilha(texto) {
  const linhas = String(texto || "").split(/\r?\n/).filter((l) => l.trim()); if (!linhas.length) return { linhas: [], mapa: [] };
  const sep = linhas[0].includes("\t") ? "\t" : linhas[0].includes(";") ? ";" : ",";
  const cel = linhas.map((l) => l.split(sep).map((x) => x.trim().replace(/^"|"$/g, "")));
  const cab = cel[0].map((h) => h.toLowerCase()); let mapa = cab.map((h) => Object.keys(COLS).find((k) => COLS[k].test(h)) || null);
  const temCab = mapa.filter(Boolean).length >= 1 && mapa.includes("nome"); if (!temCab) mapa = ["nome", "documento", "nascimento", "telefone", "poltrona", "grupo", "onibus"];
  const dados = (temCab ? cel.slice(1) : cel).map((c) => { const o = {}; mapa.forEach((k, i) => { if (k && c[i]) o[k] = c[i]; }); return o; }).filter((o) => o.nome);
  return { linhas: dados, mapa: mapa.filter(Boolean), cabecalho: temCab };
}
