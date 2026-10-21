// frontend/src/utils/gerarTermoDesconto.js — etapa 12g
// Termo de autorização de desconto de multa, assinado na tela pelo colaborador — HTML "printável" (aba nova + print).

const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");
const fmtCNPJ = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : (v || ""); };
const fmtCPF = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : (v || "—"); };
const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

export function gerarHtmlTermo({ empresa = {}, colaborador = {}, multa: m = {}, gerado_em }) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Termo de desconto — ${esc(colaborador.nome)}</title><style>
  body { margin: 0; background: #f2f2f2; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; font-size: 12px; line-height: 1.55; }
  .pagina { max-width: 190mm; margin: 10mm auto; padding: 14mm; background: #fff; }
  h1 { font-size: 16px; text-align: center; margin: 8mm 0 6mm; text-transform: uppercase; letter-spacing: .05em; }
  .grade { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 12px; border: 1px solid #ccc; padding: 8px; margin-bottom: 10px; font-size: 11px; }
  .grade b { display: block; font-size: 8.5px; color: #666; text-transform: uppercase; }
  .termo { border: 1px solid #999; padding: 12px; text-align: justify; font-size: 13px; }
  .ass { margin-top: 12mm; text-align: center; } .ass img { max-width: 260px; max-height: 90px; border-bottom: 1px solid #111; }
  .hash { font-family: "Courier New", monospace; font-size: 8.5px; color: #888; word-break: break-all; margin-top: 10mm; }
  @media print { body { background: #fff; } .pagina { margin: 0; } .nao-imprimir { display: none; } }
  @page { size: A4; margin: 12mm; }
  </style></head><body><div class="pagina">
    <div style="display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:6px">
      <div><b style="font-size:14px">${esc(empresa.razao_social || empresa.nome)}</b><div style="color:#555;font-size:10px">${empresa.cnpj ? `CNPJ ${esc(fmtCNPJ(empresa.cnpj))}` : ""}</div></div>
      <div style="text-align:right;font-size:10px;color:#555">gerado em ${dataHora(gerado_em)}</div>
    </div>
    <h1>Termo de autorização de desconto — multa de trânsito</h1>
    <div class="grade">
      <div><b>Colaborador</b>${esc(colaborador.nome)}</div><div><b>CPF</b>${esc(fmtCPF(colaborador.cpf))}</div><div><b>Função</b>${esc(colaborador.funcao || "—")}</div>
      <div><b>Auto de infração</b>${esc(m.auto_numero || "—")}</div><div><b>Órgão</b>${esc(m.orgao || "—")}</div><div><b>Data / hora</b>${dBR(m.data_infracao)}${m.hora_infracao ? ` ${esc(m.hora_infracao)}` : ""}</div>
      <div><b>Veículo</b>${esc(m.veiculo || "—")}</div><div><b>Infração</b>${esc([m.infracao_codigo, m.infracao_descricao].filter(Boolean).join(" — ") || "—")}</div><div><b>Local</b>${esc(m.local || "—")}</div>
      <div><b>Valor da multa</b>${brl(m.valor)}</div><div><b>Valor descontado</b>${brl(m.valor_descontado)}${m.parcelas_desconto > 1 ? ` em ${m.parcelas_desconto}x` : ""}</div><div><b>Pontos</b>${m.pontos ?? "—"}</div>
    </div>
    <div class="termo">${esc(m.aceite_texto)}</div>
    <div class="ass"><img src="${m.aceite_png}" alt="assinatura"/><div>${esc(colaborador.nome)} — assinado na tela em ${dataHora(m.aceite_em)}</div></div>
    <div class="hash">Assinatura coletada na tela do QuotaFlow. Integridade (SHA-256): ${esc(m.aceite_hash)}</div>
    <div class="nao-imprimir" style="margin-top:14px;text-align:center"><button onclick="window.print()" style="padding:8px 18px;font-size:13px">🖨 Imprimir / Salvar em PDF</button></div>
  </div></body></html>`;
}

export function prepararJanela() {
  const w = window.open("", "_blank");
  if (w) { try { w.document.write('<p style="font-family:sans-serif;padding:24px">Gerando o termo…</p>'); } catch { /* ok */ } }
  return w;
}
export function abrirTermo(dados, janela) {
  const w = janela || window.open("", "_blank");
  if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.");
  w.document.open(); w.document.write(gerarHtmlTermo(dados)); w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* ok */ } }, 300);
}
