// frontend/src/utils/gerarCertificado.js — etapa 12e.2c
//
// Dois documentos "printáveis" (mesmo padrão do gerarFichaEpi.js / gerarListaPresenca.js: aba nova + window.print()):
//   • CERTIFICADO de treinamento (A4 paisagem) — empresa, colaborador/CPF, treinamento, norma, carga, conteúdo,
//     conclusão, nota, validade, instrutor e código de verificação. Rodapé "Emitido pelo QuotaFlow".
//   • COMPROVANTE DA AVALIAÇÃO (A4 retrato) — cada tentativa: data/hora, meio, IP, nota, cada pergunta com a resposta
//     marcada × a correta e o hash. Só para o gestor (mostra o gabarito). Serve de prova em auditoria e no dossiê (12f).
import { logoHtml } from "./logoEmpresa"; // 14c

const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dataIsoBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");
const fmtCNPJ = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : (v || ""); };
const fmtCPF = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : (v || "—"); };
const fmtH = (n) => `${Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
const MOD = { presencial: "presencial", online: "online", manual: "registro interno" };
const BOTAO = `<div class="nao-imprimir" style="margin-top:14px;text-align:center"><button onclick="window.print()" style="padding:8px 18px;font-size:13px">🖨 Imprimir / Salvar em PDF</button></div>`;

export function gerarHtmlCertificado(d) {
  const { empresa = {}, colaborador = {}, treinamento = {}, turma = {} } = d;
  const conteudo = treinamento.conteudo || (treinamento.secoes || []).join(" · ");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Certificado — ${esc(colaborador.nome)} — ${esc(treinamento.nome)}</title><style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #f2f2f2; font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; }
  .folha { width: 297mm; min-height: 200mm; margin: 8mm auto; background: #fff; padding: 14mm 18mm; position: relative; border: 10px solid #1e3a5f; outline: 2px solid #c9a227; outline-offset: -18px; }
  .emp { text-align: center; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 13px; color: #444; }
  .emp b { display: block; font-size: 16px; color: #1e3a5f; }
  h1 { text-align: center; font-size: 40px; letter-spacing: .18em; margin: 12mm 0 2mm; color: #1e3a5f; font-weight: 400; }
  .sub { text-align: center; font-size: 13px; letter-spacing: .3em; color: #8a6d12; margin-bottom: 10mm; text-transform: uppercase; }
  .texto { text-align: center; font-size: 17px; line-height: 1.7; max-width: 220mm; margin: 0 auto; }
  .nome { font-size: 30px; font-style: italic; color: #1e3a5f; display: block; margin: 2mm 0; }
  .trein { font-weight: 700; }
  .cont { text-align: center; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 10.5px; color: #555; max-width: 220mm; margin: 6mm auto 0; }
  .rod { display: flex; justify-content: space-around; gap: 20mm; margin-top: 16mm; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 11px; text-align: center; }
  .rod div { flex: 1; border-top: 1px solid #333; padding-top: 4px; max-width: 80mm; }
  .cod { position: absolute; left: 18mm; right: 18mm; bottom: 9mm; display: flex; justify-content: space-between; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 9.5px; color: #777; }
  @media print { body { background: #fff; } .folha { margin: 0; } .nao-imprimir { display: none; } }
  @page { size: A4 landscape; margin: 0; }
</style></head><body>
  <div class="folha">
    <div class="emp">${logoHtml({ altura: 56, largura: 220, margem: "0 auto 6px" })}<b>${esc(empresa.razao_social || empresa.nome)}</b>${empresa.cnpj ? `CNPJ ${esc(fmtCNPJ(empresa.cnpj))}` : ""}</div>
    <h1>CERTIFICADO</h1>
    <div class="sub">de conclusão de treinamento</div>
    <div class="texto">
      Certificamos que
      <span class="nome">${esc(colaborador.nome)}</span>
      CPF ${esc(fmtCPF(colaborador.cpf))}${colaborador.funcao ? `, ${esc(colaborador.funcao)},` : ""} concluiu o treinamento
      <span class="trein">${esc(treinamento.nome)}</span>${treinamento.norma ? ` (${esc(treinamento.norma)})` : ""},
      ${turma.modalidade ? `na modalidade ${esc(MOD[turma.modalidade] || turma.modalidade)}, ` : ""}com carga horária de <b>${fmtH(turma.carga_horaria || d.horas)}</b>,
      em <b>${dataIsoBR(d.concluido_em)}</b>${d.nota != null ? `, com aproveitamento de <b>${esc(Number(d.nota).toLocaleString("pt-BR"))}%</b>` : ""}.
      ${d.valido_ate ? `<br/>Válido até <b>${dataIsoBR(d.valido_ate)}</b>.` : ""}
    </div>
    ${conteudo ? `<div class="cont"><b>Conteúdo programático:</b> ${esc(conteudo)}</div>` : ""}
    <div class="rod">
      <div>${esc(turma.instrutor || "Instrutor / responsável")}<br/><span style="color:#777">Instrutor / responsável técnico</span></div>
      <div>${esc(empresa.razao_social || empresa.nome)}<br/><span style="color:#777">Empresa</span></div>
    </div>
    <div class="cod"><span>Código de verificação: <b>${esc(d.codigo)}</b> · emitido em ${dataHora(d.gerado_em)}</span><span>Emitido pelo QuotaFlow</span></div>
  </div>
  ${BOTAO}
</body></html>`;
}

export function gerarHtmlAvaliacao(d) {
  const { empresa = {}, colaborador = {}, turma = {} } = d;
  const blocos = (d.tentativas || []).map((t) => `
    <div class="tent">
      <div class="tcab"><b>Tentativa ${t.numero}</b> · ${dataHora(t.em)} · ${t.meio === "link" ? "pelo link (CPF + nascimento)" : "colaborador logado"}${t.ip ? ` · IP ${esc(t.ip)}` : ""}
        <span class="${t.aprovado ? "ok" : "no"}">${t.aprovado ? "APROVADO" : "NÃO APROVADO"} — ${esc(Number(t.nota).toLocaleString("pt-BR"))}% (${t.acertos}/${t.total}; mínimo ${esc(t.nota_minima)}%)</span></div>
      <table><thead><tr><th>#</th><th>Pergunta</th><th>Marcada</th><th>Correta</th><th></th></tr></thead><tbody>
        ${t.perguntas.map((p, i) => { const ok = Number(p.marcada) === Number(p.correta); const alt = (k) => (k == null || p.alternativas[k] == null ? "—" : `${String.fromCharCode(65 + Number(k))}) ${esc(p.alternativas[k])}`); return `<tr><td>${i + 1}</td><td>${esc(p.enunciado)}</td><td>${alt(p.marcada)}</td><td>${alt(p.correta)}</td><td class="${ok ? "ok" : "no"}">${ok ? "✓" : "✗"}</td></tr>`; }).join("")}
      </tbody></table>
      <div class="hash">Integridade (SHA-256): ${esc(t.hash)}</div>
    </div>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Avaliação — ${esc(colaborador.nome)} — ${esc(turma.treinamento_nome)}</title><style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #f5f5f5; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; font-size: 10.5px; line-height: 1.4; }
  .pagina { max-width: 210mm; margin: 10mm auto; padding: 10mm; background: #fff; }
  .cab { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
  .emp { font-size: 15px; font-weight: 700; } .sub { color: #555; font-size: 10px; }
  .dados { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px 12px; border: 1px solid #ccc; padding: 8px; margin-bottom: 10px; }
  .dados b { display: block; font-size: 9px; color: #666; text-transform: uppercase; font-weight: 600; }
  .tent { border: 1px solid #ccc; padding: 8px; margin-bottom: 10px; page-break-inside: avoid; }
  .tcab { margin-bottom: 6px; } .tcab span { float: right; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #bbb; padding: 3px 5px; vertical-align: top; font-size: 9.5px; }
  th { background: #eee; font-size: 8.5px; text-transform: uppercase; text-align: left; }
  .ok { color: #15803d; } .no { color: #b91c1c; }
  .hash { font-family: "Courier New", monospace; font-size: 8px; color: #888; word-break: break-all; margin-top: 4px; }
  @media print { body { background: #fff; } .pagina { margin: 0; max-width: none; } .nao-imprimir { display: none; } }
  @page { size: A4; margin: 10mm; }
</style></head><body><div class="pagina">
  <div class="cab">
    <div>${logoHtml()}<div class="emp">${esc(empresa.razao_social || empresa.nome)}</div><div class="sub">${empresa.cnpj ? `CNPJ ${esc(fmtCNPJ(empresa.cnpj))}` : ""}</div></div>
    <div style="text-align:right"><div style="font-weight:700">COMPROVANTE DE AVALIAÇÃO</div><div class="sub">gerado em ${dataHora(d.gerado_em)}</div></div>
  </div>
  <div class="dados">
    <div><b>Colaborador</b>${esc(colaborador.nome)}</div><div><b>CPF</b>${esc(fmtCPF(colaborador.cpf))}</div><div><b>Função</b>${esc(colaborador.funcao || "—")}</div>
    <div><b>Treinamento</b>${esc(turma.treinamento_nome)}</div><div><b>Turma</b>${dataIsoBR(turma.data)}${turma.instrutor ? ` · ${esc(turma.instrutor)}` : ""}</div>
    <div><b>Resultado</b><span class="${d.situacao === "aprovado" ? "ok" : "no"}">${d.situacao === "aprovado" ? "Aprovado" : "Não aprovado"}</span>${d.tentativas_extra ? ` · ${d.tentativas_extra} tentativa(s) liberada(s) pelo instrutor` : ""}</div>
  </div>
  ${blocos}
  <div class="sub">Prova feita no QuotaFlow. Cada tentativa guarda as respostas, a cópia da prova do momento, o meio de acesso e o código de integridade acima.</div>
  ${BOTAO}
</div></body></html>`;
}

export function prepararJanela(msg = "Gerando…") {
  const w = window.open("", "_blank");
  if (w) { try { w.document.write(`<p style="font-family:sans-serif;padding:24px">${msg}</p>`); } catch { /* ok */ } }
  return w;
}
function abrir(html, janela) {
  const w = janela || window.open("", "_blank");
  if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.");
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* ok */ } }, 400);
}
export const abrirCertificado = (dados, janela) => abrir(gerarHtmlCertificado(dados), janela);
export const abrirAvaliacao = (dados, janela) => abrir(gerarHtmlAvaliacao(dados), janela);
