// frontend/src/utils/gerarListaPresenca.js — etapa 12e.1 (12e.2b: prova online no lugar da assinatura)
//
// Lista de presença de treinamento — HTML "printável" (mesmo padrão do gerarFichaEpi.js / gerarPdfNC.js):
// abre numa aba nova e dispara window.print() → "Salvar como PDF". Sem dependência nova.
// Empresa, treinamento (norma, carga, conteúdo programático), instrutor, e uma linha por participante
// com CPF, função, data/hora e a assinatura colhida na tela + os códigos de integridade.
import { logoHtml } from "./logoEmpresa"; // 14c

const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dataIsoBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");
const fmtCNPJ = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : (v || ""); };
const fmtCPF = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : (v || "—"); };

const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #f5f5f5; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; font-size: 11px; line-height: 1.45; }
  .pagina { max-width: 210mm; margin: 10mm auto; padding: 10mm; background: #fff; }
  .cab { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
  .emp { font-size: 15px; font-weight: 700; } .sub { color: #555; font-size: 10px; }
  h1 { font-size: 14px; margin: 0 0 8px; text-transform: uppercase; }
  .dados { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px 12px; border: 1px solid #ccc; padding: 8px; margin-bottom: 10px; }
  .dados b { display: block; font-size: 9px; color: #666; text-transform: uppercase; font-weight: 600; }
  .bloco { border: 1px solid #ccc; padding: 8px; margin-bottom: 10px; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #bbb; padding: 3px 5px; vertical-align: middle; font-size: 9.5px; }
  td.nw { white-space: nowrap; }
  th { background: #eee; font-size: 8.5px; text-transform: uppercase; }
  td.ass { width: 150px; height: 46px; text-align: center; } td.ass img { max-width: 140px; max-height: 42px; }
  .rod { margin-top: 14px; display: flex; justify-content: space-between; gap: 30px; }
  .linha { flex: 1; border-top: 1px solid #111; padding-top: 4px; text-align: center; font-size: 10px; margin-top: 30px; }
  .hash { font-family: "Courier New", monospace; font-size: 8px; color: #888; word-break: break-all; margin-top: 8px; }
  @media print { body { background: #fff; } .pagina { margin: 0; max-width: none; } .nao-imprimir { display: none; } tr { page-break-inside: avoid; } }
  @page { size: A4; margin: 10mm; }
`;

export function gerarHtmlListaPresenca({ empresa = {}, turma = {}, conteudo, norma, participantes = [], gerado_em }) {
  const linhas = participantes.map((p, i) => `<tr>
      <td style="text-align:center">${i + 1}</td><td>${esc(p.nome)}</td><td class="nw">${esc(fmtCPF(p.cpf))}</td><td>${esc(p.funcao || "—")}</td>
      <td class="nw">${p.assinado_em ? dataHora(p.assinado_em) : (p.presente ? "presente" : "")}</td>
      <td class="ass">${p.assinatura_png ? `<img src="${p.assinatura_png}" alt="assinatura"/>` : p.presente && turma.modalidade === "online" ? `<span style="font-size:9px">${p.aprovado ? `Prova online — nota ${esc(Number(p.nota).toLocaleString("pt-BR"))}%` : "Concluiu online (declaração)"}</span>` : ""}</td></tr>`).join(""); // 12e.2b
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Lista de presença — ${esc(turma.treinamento_nome)}</title><style>${CSS}</style></head><body>
  <div class="pagina">
    <div class="cab">
      <div>${logoHtml()}<div class="emp">${esc(empresa.razao_social || empresa.nome)}</div><div class="sub">${empresa.cnpj ? `CNPJ ${esc(fmtCNPJ(empresa.cnpj))}` : ""}</div></div>
      <div style="text-align:right"><div style="font-weight:700">LISTA DE PRESENÇA</div><div class="sub">gerada em ${dataHora(gerado_em || new Date())}</div></div>
    </div>
    <h1>${esc(turma.treinamento_nome)}${norma ? ` — ${esc(norma)}` : ""}</h1>
    <div class="dados">
      <div><b>Instrutor</b>${esc(turma.instrutor || "—")}</div>
      <div><b>Data</b>${dataIsoBR(turma.data)}${turma.data_fim ? ` a ${dataIsoBR(turma.data_fim)}` : ""}</div>
      <div><b>Carga horária</b>${turma.carga_horaria ? `${Number(turma.carga_horaria).toLocaleString("pt-BR")} h` : "—"}</div>
      <div><b>Local</b>${esc(turma.local || "—")}</div>
      <div><b>Modalidade</b>${esc(turma.modalidade === "online" ? "Online" : "Presencial")}</div>
      <div><b>Validade</b>${turma.validade_meses ? `${turma.validade_meses} meses` : "não vence"}</div>
    </div>
    ${conteudo ? `<div class="bloco"><b>Conteúdo programático:</b>\n${esc(conteudo)}</div>` : ""}
    <table>
      <thead><tr><th>#</th><th>Participante</th><th>CPF</th><th>Função</th><th>Assinou em</th><th>Assinatura</th></tr></thead>
      <tbody>${linhas || `<tr><td colspan="6" style="text-align:center;color:#666;padding:14px">Sem participantes.</td></tr>`}</tbody>
    </table>
    <div class="rod"><div class="linha">${esc(turma.instrutor || "Instrutor")} — assinatura</div><div class="linha">Responsável pela empresa</div></div>
    <div class="hash">Assinaturas coletadas na tela do QuotaFlow. Integridade (SHA-256): ${participantes.filter((p) => p.assinatura_hash).map((p) => `${esc(p.nome)}: ${esc(p.assinatura_hash)}`).join(" · ") || "—"}</div>
    <div class="nao-imprimir" style="margin-top:14px;text-align:center"><button onclick="window.print()" style="padding:8px 18px;font-size:13px">🖨 Imprimir / Salvar em PDF</button></div>
  </div></body></html>`;
}

export function prepararJanela() {
  const w = window.open("", "_blank");
  if (w) { try { w.document.write('<p style="font-family:sans-serif;padding:24px">Gerando a lista de presença…</p>'); } catch { /* ok */ } }
  return w;
}

export function abrirListaPresenca(dados, janela) {
  const w = janela || window.open("", "_blank");
  if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.");
  w.document.open(); w.document.write(gerarHtmlListaPresenca(dados)); w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* ok */ } }, 300);
}
