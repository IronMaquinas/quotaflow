// frontend/src/utils/gerarMedidaDisciplinar.js — etapa 12h
// Documento da medida disciplinar (orientação, advertência, suspensão, justa causa) com a ciência do colaborador
// assinada na tela — ou a recusa com 2 testemunhas. HTML "printável" (aba nova + print).

const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");
const fmtCNPJ = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : (v || ""); };
const fmtCPF = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : (v || "—"); };
const TITULO = { orientacao: "Registro de orientação", advertencia: "Advertência disciplinar", suspensao: "Suspensão disciplinar", justa_causa: "Registro de dispensa por justa causa" };

export function gerarHtmlMedida({ empresa = {}, colaborador = {}, medida: m = {}, gerado_em }) {
  const ass = m.ciencia === "assinada"
    ? `<div class="ass"><img src="${m.ciencia_png}" alt="assinatura"/><div>${esc(colaborador.nome)} — ciente em ${dataHora(m.ciencia_em)}</div></div>`
    : m.ciencia === "recusa"
      ? `<p><b>O(a) colaborador(a) recusou-se a assinar.</b> A ciência foi presenciada pelas testemunhas abaixo, em ${dataHora(m.ciencia_em)}:</p>
         <div style="display:flex;gap:20mm;justify-content:center">${(m.testemunhas || []).map((t) => `<div class="ass"><img src="${t.png}" alt="assinatura"/><div>Testemunha: ${esc(t.nome)}${t.cpf ? `<br/>CPF ${esc(fmtCPF(t.cpf))}` : ""}</div></div>`).join("")}</div>`
      : m.ciencia === "pendente" // 12h.1: para assinar no papel — linhas em branco
        ? `<div style="margin-top:14mm;display:flex;flex-direction:column;align-items:center;gap:14mm">
             <div class="linha" style="margin-top:0">${esc(colaborador.nome)} — ciente em ____/____/______</div>
             <div style="font-size:10.5px;color:#444;text-align:center">Em caso de recusa em assinar, a ciência é presenciada por duas testemunhas:</div>
             <div style="display:flex;gap:16mm"><div class="linha" style="margin-top:0;width:70mm">Testemunha 1 — nome, CPF e assinatura</div><div class="linha" style="margin-top:0;width:70mm">Testemunha 2 — nome, CPF e assinatura</div></div>
           </div>`
        : m.ciencia === "papel" ? `<p><b>Ciência colhida no papel</b> em ${dataHora(m.ciencia_em)} — o documento assinado está anexado no QuotaFlow (${esc(m.arquivo_nome || "anexo")}).</p>`
        : `<p><i>Orientação verbal, registrada sem assinatura.</i></p>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(TITULO[m.tipo])} — ${esc(colaborador.nome)}</title><style>
  body { margin: 0; background: #f2f2f2; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; font-size: 12px; line-height: 1.55; }
  .pagina { max-width: 190mm; margin: 10mm auto; padding: 14mm; background: #fff; }
  h1 { font-size: 16px; text-align: center; margin: 8mm 0 6mm; text-transform: uppercase; letter-spacing: .05em; }
  .grade { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 12px; border: 1px solid #ccc; padding: 8px; margin-bottom: 10px; font-size: 11px; }
  .grade b { display: block; font-size: 8.5px; color: #666; text-transform: uppercase; }
  .termo { border: 1px solid #999; padding: 12px; text-align: justify; font-size: 13px; margin-bottom: 8mm; }
  .ass { margin-top: 10mm; text-align: center; } .ass img { max-width: 240px; max-height: 80px; border-bottom: 1px solid #111; }
  .linha { margin-top: 16mm; border-top: 1px solid #111; width: 80mm; margin-left: auto; margin-right: auto; text-align: center; padding-top: 4px; font-size: 11px; }
  .hash { font-family: "Courier New", monospace; font-size: 8.5px; color: #888; word-break: break-all; margin-top: 10mm; }
  .canc { border: 2px solid #b91c1c; color: #b91c1c; padding: 6px; text-align: center; font-weight: 700; margin-bottom: 8px; }
  @media print { body { background: #fff; } .pagina { margin: 0; } .nao-imprimir { display: none; } }
  @page { size: A4; margin: 12mm; }
  </style></head><body><div class="pagina">
    <div style="display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:6px">
      <div><b style="font-size:14px">${esc(empresa.razao_social || empresa.nome)}</b><div style="color:#555;font-size:10px">${empresa.cnpj ? `CNPJ ${esc(fmtCNPJ(empresa.cnpj))}` : ""}</div></div>
      <div style="text-align:right;font-size:10px;color:#555">gerado em ${dataHora(gerado_em)}</div>
    </div>
    <h1>${esc(TITULO[m.tipo])}</h1>
    ${m.status === "cancelada" ? `<div class="canc">MEDIDA CANCELADA — ${esc(m.cancelamento_motivo || "")}</div>` : ""}
    <div class="grade">
      <div><b>Colaborador</b>${esc(colaborador.nome)}</div><div><b>CPF</b>${esc(fmtCPF(colaborador.cpf))}</div><div><b>Função</b>${esc(colaborador.funcao || "—")}</div>
      <div><b>Data do fato</b>${dBR(m.data_fato)}</div><div><b>Aplicada em</b>${dBR(m.data_aplicacao)}</div><div><b>Motivo</b>${esc(m.categoria_nome)}</div>
      ${m.tipo === "suspensao" ? `<div><b>Suspensão</b>${m.dias_suspensao} dia(s)</div><div><b>De</b>${dBR(m.suspensao_inicio)}</div><div><b>Até</b>${dBR(m.suspensao_fim)}</div>` : ""}
    </div>
    <div class="termo">${esc(m.texto)}</div>
    ${ass}
    <div class="linha">${esc(m.aplicado_por_nome || "Responsável")} — pela empresa</div>
    <div class="hash">Assinaturas coletadas na tela do QuotaFlow. Integridade (SHA-256): ${m.ciencia_hash ? `colaborador: ${esc(m.ciencia_hash)}` : ""} ${(m.testemunhas || []).map((t) => `· ${esc(t.nome)}${t.cpf ? ` (${esc(fmtCPF(t.cpf))})` : ""}: ${esc(t.hash)}`).join(" ")}</div>
    <div class="nao-imprimir" style="margin-top:14px;text-align:center"><button onclick="window.print()" style="padding:8px 18px;font-size:13px">🖨 Imprimir / Salvar em PDF</button></div>
  </div></body></html>`;
}
export function prepararJanela() {
  const w = window.open("", "_blank");
  if (w) { try { w.document.write('<p style="font-family:sans-serif;padding:24px">Gerando o documento…</p>'); } catch { /* ok */ } }
  return w;
}
export function abrirMedida(dados, janela) {
  const w = janela || window.open("", "_blank");
  if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.");
  w.document.open(); w.document.write(gerarHtmlMedida(dados)); w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* ok */ } }, 300);
}
