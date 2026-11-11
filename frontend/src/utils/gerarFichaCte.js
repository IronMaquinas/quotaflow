// frontend/src/utils/gerarFichaCte.js — etapa 18g.3: 📋 ficha do CT-e em PDF (A4, layout padrão) e CSV (separador ;)
import { logoHtml } from "./logoEmpresa";

const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function htmlFichaCte(f) {
  const sec = f.secoes.map((s) => `<h2>${esc(s.titulo)}</h2><table>${s.campos.map((c) => `<tr><th>${esc(c.rotulo)}</th><td class="${c.falta ? "falta" : ""}">${c.valor ? esc(c.valor) : c.falta ? "⚠ falta" : "—"}${c.dica ? `<div class="dica">${esc(c.dica)}</div>` : ""}</td></tr>`).join("")}</table>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ficha do CT-e — ${esc(f.pedido.numero)}</title><style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;background:#f3f4f6}.pagina{background:#fff;max-width:800px;margin:16px auto;padding:24px 28px}
  .topo{display:flex;align-items:center;gap:14px;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:10px}.topo h1{font-size:18px;margin:0;flex:1}.sub{font-size:11.5px;color:#555}
  h2{font-size:13px;margin:14px 0 4px;background:#eef2f7;padding:5px 8px;border-left:3px solid #1d4ed8}table{width:100%;border-collapse:collapse;font-size:12px}
  th{width:38%;text-align:left;font-weight:600;color:#333;padding:4px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top}td{padding:4px 8px;border-bottom:1px solid #e5e7eb;font-family:Consolas,monospace}
  td.falta{color:#b91c1c;font-family:Arial}.dica{font-family:Arial;font-size:10.5px;color:#666}.aviso{font-size:11.5px;color:#92400e;background:#fffbeb;border:1px solid #fcd34d;padding:6px 8px;margin:8px 0}
  .rodape{font-size:10px;color:#777;margin-top:14px;border-top:1px solid #ddd;padding-top:6px}@media print{body{background:#fff}.pagina{margin:0;max-width:none;padding:0}@page{size:A4 portrait;margin:12mm}}
  </style></head><body><div class="pagina"><div class="topo">${logoHtml ? logoHtml() : ""}<div style="flex:1"><h1>📋 Ficha para emissão do CT-e</h1><div class="sub">${esc(f.pedido.numero)}${f.trecho ? ` · ${esc(f.trecho)}` : ""}${f.at ? ` · ${esc(f.at.numero)}` : ""} · tarefa ${esc(f.tarefa.numero || "")}</div></div></div>
  ${f.faltam.length ? `<div class="aviso">⚠ ${f.faltam.length} campo(s) sem dado no sistema — preencha direto no emissor: ${esc(f.faltam.join(" · "))}</div>` : ""}
  ${sec}<div class="rodape">Gerado pelo QuotaFlow em ${new Date().toLocaleString("pt-BR")} a partir do pedido, da AT e das NF-e da tarefa fiscal. Confira no emissor antes de transmitir.</div></div>
  <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`;
}
export function abrirFichaCte(f) {
  const w = window.open("", "_blank"); if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.");
  w.document.open(); w.document.write(htmlFichaCte(f)); w.document.close();
}
const csvCampo = (v) => { const t = String(v ?? ""); return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
export function csvFichaCte(f) {
  const linhas = [["Grupo", "Campo", "Valor", "Situação"], ...f.secoes.flatMap((s) => s.campos.map((c) => [s.titulo.replace(/^\S+\s/, ""), c.rotulo, c.valor, c.falta ? "falta" : ""]))];
  return "﻿" + linhas.map((l) => l.map(csvCampo).join(";")).join("\r\n");
}
