// frontend/src/utils/gerarFichaEpi.js — etapa 12d.2
//
// Ficha de Controle de Entrega de EPI (NR-6) — HTML "printável", mesmo padrão do gerarPdfNC.js:
// abre numa aba nova e dispara window.print() (o usuário escolhe "Salvar como PDF").
// Sem dependência nova. Uma linha por EPI entregue; a assinatura do colaborador aparece em cada entrega.

const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dataBR = (d) => (d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
const dataIsoBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const fmtCNPJ = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : (v || ""); };
const fmtCPF = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : (v || "—"); };
const MOTIVO = { entrega: "Entrega", admissao: "Admissão", troca: "Troca", reposicao: "Reposição", perda: "Perda", dano: "Dano", outro: "Outro" };
const DEVOL = { bom: "Devolvido (bom estado)", danificado: "Devolvido (danificado/descartado)", substituido: "Substituído" };

const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #f5f5f5; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; font-size: 11px; line-height: 1.45; }
  .pagina { max-width: 297mm; margin: 10mm auto; padding: 10mm; background: #fff; }
  .cab { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
  .emp { font-size: 15px; font-weight: 700; } .sub { color: #555; font-size: 10px; }
  h1 { font-size: 14px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: .03em; }
  .dados { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 6px 12px; border: 1px solid #ccc; padding: 8px; margin-bottom: 10px; }
  .dados b { display: block; font-size: 9px; color: #666; text-transform: uppercase; font-weight: 600; }
  .termo { border: 1px solid #ccc; padding: 8px; margin-bottom: 10px; font-size: 10px; text-align: justify; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #bbb; padding: 4px 6px; vertical-align: middle; }
  th { background: #eee; font-size: 9px; text-transform: uppercase; }
  td.num { font-family: "Courier New", monospace; white-space: nowrap; }
  td.ass { width: 150px; text-align: center; } td.ass img { max-width: 140px; max-height: 46px; }
  .rod { margin-top: 10px; font-size: 9px; color: #666; display: flex; justify-content: space-between; gap: 12px; }
  .hash { font-family: "Courier New", monospace; font-size: 8px; color: #888; word-break: break-all; }
  @media print { body { background: #fff; } .pagina { margin: 0; max-width: none; } .nao-imprimir { display: none; } tr { page-break-inside: avoid; } }
  @page { size: A4 landscape; margin: 8mm; }
`;

export function gerarHtmlFichaEpi({ empresa = {}, colaborador = {}, entregas = [], gerado_em }) {
  const linhas = [];
  for (const e of entregas) {
    const itens = e.itens || [];
    itens.forEach((i, k) => {
      linhas.push(`<tr>
        ${k === 0 ? `<td rowspan="${itens.length}">${dataBR(e.entregue_em)}</td><td rowspan="${itens.length}" class="num">${esc(e.numero)}</td>` : ""}
        <td>${esc(i.item_nome)}</td><td class="num">${esc(i.ca || "—")}</td><td>${esc(i.tamanho || "—")}</td>
        <td style="text-align:right">${esc(Number(i.quantidade).toLocaleString("pt-BR"))}</td>
        ${k === 0 ? `<td rowspan="${itens.length}">${esc(MOTIVO[e.motivo] || e.motivo)}</td>` : ""}
        <td>${i.proxima_troca ? dataIsoBR(i.proxima_troca) : "—"}</td>
        <td>${i.devolvido_em ? `${dataBR(i.devolvido_em)} — ${esc(DEVOL[i.devolucao_estado] || i.devolucao_estado || "")}` : "Em uso"}</td>
        ${k === 0 ? `<td rowspan="${itens.length}" class="ass">${e.assinatura_png ? `<img src="${e.assinatura_png}" alt="assinatura"/>` : "—"}<div class="sub">${esc(e.entregue_por_nome ? `Entregue por ${e.entregue_por_nome}` : "")}</div></td>` : ""}
      </tr>`);
    });
  }
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ficha de EPI — ${esc(colaborador.nome)}</title><style>${CSS}</style></head><body>
  <div class="pagina">
    <div class="cab">
      <div><div class="emp">${esc(empresa.razao_social || empresa.nome)}</div><div class="sub">${empresa.cnpj ? `CNPJ ${esc(fmtCNPJ(empresa.cnpj))}` : ""}</div></div>
      <div style="text-align:right"><div style="font-weight:700">FICHA DE EPI</div><div class="sub">NR-6 · gerada em ${dataBR(gerado_em || new Date())}</div></div>
    </div>
    <h1>Ficha de controle de entrega de Equipamento de Proteção Individual</h1>
    <div class="dados">
      <div><b>Colaborador</b>${esc(colaborador.nome)}</div>
      <div><b>CPF</b>${esc(fmtCPF(colaborador.cpf))}</div>
      <div><b>Função</b>${esc(colaborador.funcao || "—")}</div>
      <div><b>Admissão</b>${dataIsoBR(colaborador.admissao)}</div>
    </div>
    <div class="termo">
      Declaro ter recebido gratuitamente os Equipamentos de Proteção Individual abaixo, com Certificado de Aprovação (CA),
      e ter sido orientado(a) sobre o uso correto, a guarda e a conservação. Comprometo-me a usá-los apenas para a finalidade
      a que se destinam, responsabilizar-me pela guarda e conservação, comunicar ao empregador qualquer alteração que os torne
      impróprios para uso e cumprir as determinações sobre o uso adequado (NR-6). Estou ciente de que a recusa injustificada
      ao uso do EPI fornecido constitui ato faltoso.
    </div>
    <table>
      <thead><tr><th>Data</th><th>Nº ficha</th><th>EPI</th><th>CA</th><th>Tam.</th><th>Qtd</th><th>Motivo</th><th>Próx. troca</th><th>Devolução</th><th>Assinatura do colaborador</th></tr></thead>
      <tbody>${linhas.join("") || `<tr><td colspan="10" style="text-align:center;color:#666;padding:14px">Nenhuma entrega registrada.</td></tr>`}</tbody>
    </table>
    <div class="rod">
      <div>Assinaturas coletadas na tela do QuotaFlow, no momento da entrega. Cada entrega guarda um código de integridade (SHA-256):</div>
    </div>
    <div class="hash">${entregas.map((e) => `${esc(e.numero)}: ${esc(e.assinatura_hash || "")}`).join(" · ")}</div>
    <div class="nao-imprimir" style="margin-top:14px;text-align:center"><button onclick="window.print()" style="padding:8px 18px;font-size:13px">🖨 Imprimir / Salvar em PDF</button></div>
  </div></body></html>`;
}

// Abre a aba NO CLIQUE (antes de buscar os dados) — senão o navegador bloqueia o pop-up
export function prepararJanela() {
  const w = window.open("", "_blank");
  if (w) { try { w.document.write('<p style="font-family:sans-serif;padding:24px">Gerando a ficha de EPI…</p>'); } catch { /* ok */ } }
  return w;
}

export function abrirFichaEpi(dados, janela) {
  const w = janela || window.open("", "_blank");
  if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.");
  w.document.open(); w.document.write(gerarHtmlFichaEpi(dados)); w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* ok */ } }, 300);
}
