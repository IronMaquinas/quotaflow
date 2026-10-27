// frontend/src/utils/gerarBid.js — etapa 15a
// BID "printável" (aba nova → imprimir / salvar em PDF), com a logo da empresa — mesmo layout do BID real da cliente:
//   título (+ referência do cliente) · 1. Identificação (dados cadastrais: razão social, CNPJ, IE, endereço, opção fiscal)
//   · seções "antes" (escopo, serviços inclusos, responsabilidades) · Precificação (tabela por grupo/trecho, subtotais, total)
//   + condições comerciais · Critérios de medição e pagamento (forma de pagamento + validade) · seções "depois"
//   (informações complementares) · assinatura (nome, cargo, registro, telefones).
// Linhas que começam com "- " viram lista. Rascunho (sem versão fechada) sai com a marca "RASCUNHO".
import { logoHtml } from "./logoEmpresa";

const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "");
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "");
const cnpj = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : v || ""; };
const cep = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 8 ? d.replace(/^(\d{2})(\d{3})(\d{3})$/, "$1.$2-$3") : v || ""; };
const SN = { sim: "Sim", nao: "Não", na: "N/A" };

/** valor de uma célula conforme o tipo da coluna */
export function valorCelula(col, v) {
  if (v == null || v === "") return "*";
  if (col.tipo === "sim_nao") return SN[v] || v;
  if (col.tipo === "data") return dBR(v);
  if (col.tipo === "numero") return `${String(v).replace(".", ",")}${col.unidade ? ` ${col.unidade}` : ""}`;
  return v;
}
/** valor de uma condição comercial */
export function valorCondicao(def, c = {}) {
  if ((c.na || []).includes(def.chave)) return "N/A";
  const v = c[def.chave];
  if (v == null || v === "") return null;
  if (def.tipo === "moeda") return brl(v);
  if (def.tipo === "numero") return `${String(v).replace(".", ",")}${def.unidade ? ` ${def.unidade}` : ""}`;
  return v;
}
function textoHtml(t) {
  const linhas = String(t || "").split("\n"); let out = ""; let lista = false;
  for (const l of linhas) {
    const x = l.trim();
    if (/^[-•]\s+/.test(x)) { if (!lista) { out += "<ul>"; lista = true; } out += `<li>${esc(x.replace(/^[-•]\s+/, ""))}</li>`; continue; }
    if (lista) { out += "</ul>"; lista = false; }
    if (x) out += `<p>${esc(x)}</p>`;
  }
  return out + (lista ? "</ul>" : "");
}

/** d = resposta de GET /comercial/bids/:id/documento */
export function gerarHtmlBid(d) {
  const e = d.empresa || {}; const ct = d.conteudo || {}; const cols = ct.colunas || []; const conds = ct.condicoes || [];
  const rot = ct.rotulo_grupo || "Trecho";
  let n = 0; const sec = (t) => `<h2>${++n}. ${esc(t)}:</h2>`;
  const antes = (ct.secoes || []).filter((x) => x.posicao !== "depois"); const depois = (ct.secoes || []).filter((x) => x.posicao === "depois");
  const linha = (rotulo, v) => (v ? `<div><b>${esc(rotulo)}:</b> ${esc(v)}</div>` : "");
  const endereco = [e.endereco, e.numero].filter(Boolean).join(", ");
  const ident = `<div class="ident">
      <div>${linha("Razão Social", e.razao_social)}${linha("CNPJ", cnpj(e.cnpj))}${linha("Inscrição Estadual", e.inscricao_estadual)}${linha("Endereço", endereco)}${linha("Complemento", e.complemento)}${linha("Estado", e.uf)}${linha("Opção Fiscal", e.opcao_fiscal)}</div>
      <div>${linha("Bairro", e.bairro)}${linha("Município", e.cidade)}${linha("CEP", cep(e.cep))}${linha("Telefone", e.telefone)}${linha("E-mail", e.email)}</div></div>`;
  const tabelaGrupo = (g, gi) => {
    const temValorItem = (g.itens || []).some((i) => i.valor != null);
    const temQtd = (g.itens || []).some((i) => Number(i.quantidade || 1) !== 1);
    return `<div class="grupo">${esc(g.titulo || `${rot} ${gi + 1}`)}</div>
      <table class="tab"><thead><tr>${cols.map((c) => `<th>${esc(c.rotulo)}</th>`).join("")}${temQtd ? "<th>Qtd</th>" : ""}${temValorItem ? '<th class="v">Valor</th>' : ""}</tr></thead><tbody>
      ${(g.itens || []).map((i) => `<tr>${cols.map((c) => `<td>${esc(valorCelula(c, i.valores?.[c.chave]))}</td>`).join("")}${temQtd ? `<td>${esc(i.quantidade || 1)}</td>` : ""}${temValorItem ? `<td class="v">${i.valor == null ? "—" : brl(Number(i.valor) * Number(i.quantidade || 1))}</td>` : ""}</tr>`).join("")}
      </tbody>${g.subtotal != null && (d.grupos || []).length > 1 ? `<tfoot><tr><td colspan="${cols.length + (temQtd ? 1 : 0)}">Subtotal — ${esc(g.titulo || `${rot} ${gi + 1}`)}</td><td class="v">${brl(g.subtotal)}</td></tr></tfoot>` : ""}</table>`;
  };
  const condLinhas = (grupo) => conds.filter((c) => (c.grupo || "comercial") === grupo).map((c) => { const v = valorCondicao(c, d.condicoes); return v ? `<div><b>${esc(c.rotulo)}:</b> ${esc(v)};</div>` : ""; }).join("");
  const a = d.assinante || {};
  const titulo = `${esc(ct.titulo_documento || "PROPOSTA COMERCIAL")}${d.referencia ? ` – ${esc(d.referencia)}` : ""}`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(d.numero)}${d.versao ? ` v${d.versao.versao}` : " — rascunho"}</title><style>
  body { margin: 0; background: #f2f2f2; font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12.5px; line-height: 1.55; }
  .pagina { max-width: 190mm; margin: 10mm auto; padding: 14mm 18mm; background: #fff; color: #111; }
  .topo { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 6mm; }
  .topo img { max-height: 56px; } h1 { text-align: center; font-size: 13px; margin: 4mm 0 6mm; letter-spacing: .02em; }
  .para { text-align: center; font-size: 11px; color: #444; margin: -4mm 0 6mm; }
  h2 { font-size: 13px; margin: 18px 0 8px; } p { margin: 0 0 6px; text-align: justify; } ul { margin: 0 0 8px 18px; padding-left: 14px; } li { margin-bottom: 3px; text-align: justify; }
  .ident { display: grid; grid-template-columns: 1.4fr 1fr; gap: 0 24px; } .ident div > div { margin-bottom: 2px; }
  .grupo { color: #c00; font-weight: 700; font-size: 13px; margin: 12px 0 6px; text-transform: uppercase; }
  .tab { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 11.5px; }
  .tab th { border: 1px solid #111; padding: 4px 5px; font-size: 11px; text-align: center; } .tab td { border: 1px solid #111; padding: 4px 5px; text-align: center; }
  .tab td:first-child { text-align: left; } .tab .v { text-align: right; white-space: nowrap; } .tab tfoot td { font-weight: 700; background: #f4f4f4; text-align: right; }
  .total { margin: 10px 0 4px; } .total b { text-decoration: underline; } .cond div { margin-bottom: 2px; }
  .ass { margin-top: 18mm; } .ass .nome { font-weight: 700; margin-top: 14mm; }
  .hash { font-family: "Courier New", monospace; font-size: 8.5px; color: #777; word-break: break-all; margin-top: 10mm; }
  .rasc { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font: 700 72px sans-serif; color: rgba(220,38,38,.12); transform: rotate(-28deg); pointer-events: none; }
  h2, .grupo { break-after: avoid; page-break-after: avoid; } .tab, .ass { break-inside: avoid; page-break-inside: avoid; } /* trecho nunca fica sozinho no pé da página */
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print { body { background: #fff; } .pagina { margin: 0; padding: 0; } .nao-imprimir { display: none; } } @page { size: A4; margin: 14mm; }
  </style></head><body>${d.rascunho ? '<div class="rasc">RASCUNHO</div>' : ""}<div class="pagina">
    <div class="topo"><div>${logoHtml() || `<b>${esc(e.nome_fantasia || e.razao_social)}</b>`}</div><div style="text-align:right;font-size:10px;color:#555">${esc(d.numero)}${d.versao ? ` · versão ${d.versao.versao}` : " · rascunho"}<br/>${d.versao ? dataHora(d.versao.em) : ""}</div></div>
    <h1>${titulo}</h1>
    <div class="para">Para: ${esc(d.cliente?.razao_social || d.cliente?.nome || d.cliente_nome)}${d.cliente?.documento ? ` · ${cnpj(d.cliente.documento)}` : ""}${d.contato_nome ? ` · A/C ${esc(d.contato_nome)}` : ""}</div>
    ${sec("Identificação")}${ident}
    ${antes.map((x) => `${sec(x.titulo)}${textoHtml(x.texto)}`).join("")}
    ${sec("Precificação")}
    ${(d.grupos || []).map(tabelaGrupo).join("")}
    <div class="total"><b>Valor total:</b> ${d.total == null ? "________" : brl(d.total)}</div>
    <div class="cond">${condLinhas("comercial")}</div>
    ${sec("Critérios de medição e pagamento")}
    <div class="cond">${condLinhas("pagamento")}<div><b>Validade da proposta:</b> ${esc(d.validade_dias)} dias${d.valido_ate && !d.rascunho ? ` (até ${dBR(d.valido_ate)})` : ""}.</div></div>
    ${depois.map((x) => `${sec(x.titulo)}${textoHtml(x.texto)}`).join("")}
    <div class="ass"><p>Permanecemos à disposição para eventuais ajustes e alinhamentos técnicos.</p><p>Atenciosamente,</p>
      <div class="nome">${esc(a.nome || "")}</div>${a.cargo ? `<div>${esc(a.cargo)}</div>` : ""}${a.registro ? `<div>${esc(a.registro)}</div>` : ""}
      <div style="margin-top:8px"><b>${esc(e.nome_fantasia || e.razao_social || "")}</b></div>${a.telefones ? `<div>${esc(a.telefones)}</div>` : ""}</div>
    ${d.versao?.hash ? `<div class="hash">${esc(d.numero)} versão ${d.versao.versao}, fechada no QuotaFlow em ${dataHora(d.versao.em)}${d.versao.por ? ` por ${esc(d.versao.por)}` : ""}. Integridade (SHA-256): ${esc(d.versao.hash)}</div>` : ""}
    <div class="nao-imprimir" style="margin-top:14px;text-align:center"><button onclick="window.print()" style="padding:8px 18px;font-size:13px">🖨 Imprimir / Salvar em PDF</button></div>
  </div></body></html>`;
}
export function prepararJanela() {
  const w = window.open("", "_blank");
  if (w) { try { w.document.write('<p style="font-family:sans-serif;padding:24px">Gerando o BID…</p>'); } catch { /* ok */ } }
  return w;
}
export function abrirBid(dados, janela) {
  const w = janela || window.open("", "_blank");
  if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.");
  w.document.open(); w.document.write(gerarHtmlBid(dados)); w.document.close();
}
