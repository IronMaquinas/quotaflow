// frontend/src/utils/gerarDossie.js — etapa 12f
//
// Dossiê do colaborador — HTML "printável" (mesmo padrão do gerarFichaEpi.js: aba nova + window.print() → "Salvar como PDF").
// Capa (empresa, colaborador, período, código de verificação, quem gerou e por quê — LGPD) e as seções escolhidas:
// 1 Dados e selo · 2 Função e histórico de funções · 3 Documentos · 4 EPIs (com assinatura) · 5 Treinamentos (horas,
// notas, tentativas, certificados) · 6 Competências (situação atual e EVOLUÇÃO nota a nota) · 7 Multas (12g).

const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");
const fmtCNPJ = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : (v || ""); };
const fmtCPF = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : (v || "—"); };
const fmtH = (n) => `${Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
const MOTIVO = { auditoria: "Auditoria (ISO / cliente)", trabalhista: "Processo trabalhista", colaborador: "Pedido do colaborador", desligamento: "Desligamento", outro: "Outro" };
const MOTIVO_FUNCAO = { promocao: "Promoção", transferencia: "Transferência", readaptacao: "Readaptação", correcao: "Correção de cadastro", admissao: "Admissão", outro: "Outro" };
const SIT_DOC = { ok: "Em dia", vence_30: "Vence em 30 dias", vencido: "VENCIDO", sem_vencimento: "Sem vencimento", substituido: "Substituído (histórico)" };
const SIT_TR = { ok: "Em dia", vence: "Vence em breve", vencido: "VENCIDO", agendado: "Agendado", falta: "Não realizado" };
const SIT_K = { ok: "Atende", pendente: "Não avaliado / não informado", nao_atende: "Abaixo do esperado", reavaliar: "Reavaliar" };
const MOTIVO_EPI = { entrega: "Entrega", admissao: "Admissão", troca: "Troca", reposicao: "Reposição", perda: "Perda", dano: "Dano", outro: "Outro" };
const NIVEL = { 1: "Não atende", 2: "Em desenvolvimento", 3: "Atende", 4: "Referência" };
const MOD = { presencial: "Presencial", online: "Online", manual: "Registro interno" };
const SELO = { conforme: "🟢 Conforme", em_andamento: "🟡 Em andamento", atencao: "🔴 Atenção (algo vencido)", sem_funcao: "⚪ Sem função definida" };
const PILAR = { documentos: "Documentos", epi: "EPIs", treinamentos: "Treinamentos", competencias: "Competências" };

const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #f2f2f2; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; font-size: 10.5px; line-height: 1.45; }
  .pagina { max-width: 210mm; margin: 8mm auto; padding: 12mm; background: #fff; }
  .capa { min-height: 250mm; display: flex; flex-direction: column; justify-content: center; text-align: center; border: 2px solid #1e3a5f; padding: 20mm 14mm; }
  .capa h1 { font-size: 30px; letter-spacing: .12em; color: #1e3a5f; margin: 10mm 0 2mm; }
  .capa .nome { font-size: 22px; font-weight: 700; margin-top: 12mm; }
  .capa .linha { font-size: 12px; color: #444; margin-top: 2mm; }
  .capa .meta { margin-top: 16mm; font-size: 11px; color: #333; text-align: left; border-top: 1px solid #ccc; padding-top: 6mm; }
  .confid { margin-top: 10mm; font-size: 9.5px; color: #8a1c1c; border: 1px solid #e5b4b4; background: #fdf2f2; padding: 6px 8px; text-align: left; }
  h2 { font-size: 14px; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 3px; margin: 0 0 8px; }
  h3 { font-size: 11.5px; margin: 10px 0 4px; }
  .sec { page-break-before: always; }
  .grade { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 12px; border: 1px solid #ccc; padding: 8px; margin-bottom: 8px; }
  .grade b { display: block; font-size: 8.5px; color: #666; text-transform: uppercase; font-weight: 600; }
  .bloco { border: 1px solid #ddd; padding: 8px; margin-bottom: 8px; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #bbb; padding: 3px 5px; vertical-align: top; font-size: 9.5px; }
  th { background: #eef2f7; font-size: 8.5px; text-transform: uppercase; text-align: left; }
  td.ass { width: 120px; text-align: center; } td.ass img { max-width: 110px; max-height: 38px; }
  .ruim { color: #b91c1c; font-weight: 600; } .ok { color: #15803d; } .amar { color: #b45309; }
  .vazio { color: #777; font-style: italic; margin-bottom: 8px; }
  .evo { font-size: 13px; font-weight: 700; letter-spacing: .05em; }
  .hash { font-family: "Courier New", monospace; font-size: 8px; color: #888; word-break: break-all; }
  .rod { margin-top: 10px; font-size: 8.5px; color: #777; border-top: 1px solid #ddd; padding-top: 4px; display: flex; justify-content: space-between; }
  @media print { body { background: #fff; } .pagina { margin: 0; max-width: none; padding: 0; } .nao-imprimir { display: none; } tr { page-break-inside: avoid; } }
  @page { size: A4; margin: 12mm; }
`;

export function gerarHtmlDossie(d) {
  const c = d.colaborador || {}, e = d.empresa || {}, f = d.funcao_atual;
  const per = d.periodo?.de ? `${dBR(d.periodo.de)} a ${dBR(d.periodo.ate)}` : `todo o histórico até ${dBR(d.periodo?.ate)}`;
  const tem = (s) => (d.secoes || []).includes(s);
  const rod = `<div class="rod"><span>Dossiê ${esc(c.nome)} · ${esc(per)}</span><span>Código ${esc(d.codigo)} · QuotaFlow</span></div>`;
  let n = 0;
  const sec = (titulo, corpo) => `<div class="sec"><h2>${++n}. ${titulo}</h2>${corpo}${rod}</div>`;
  const partes = [];

  // 1. dados
  if (tem("dados")) {
    const selo = d.selo || {};
    partes.push(sec("Dados do colaborador e situação atual", `
      <div class="grade">
        <div><b>Nome</b>${esc(c.nome)}</div><div><b>CPF</b>${esc(fmtCPF(c.cpf))}</div><div><b>Nascimento</b>${dBR(c.data_nascimento)}</div>
        <div><b>Função atual</b>${esc(c.funcao || "—")}</div><div><b>Admissão</b>${dBR(c.admissao)}</div><div><b>Situação</b>${esc(c.situacao || "—")}</div>
        <div><b>Escolaridade</b>${esc(c.escolaridade_nome || "—")}</div><div><b>CNH</b>${esc(c.cnh_categoria || "—")}</div><div><b>Contato</b>${esc([c.telefone, c.email].filter(Boolean).join(" · ") || "—")}</div>
      </div>
      <h3>Selo de conformidade (na data de emissão)</h3>
      <div class="bloco" style="white-space:normal"><b>${esc(SELO[selo.nivel] || "—")}</b>${selo.geral != null ? ` — ${selo.geral}% (${selo.feitos} de ${selo.total} itens em dia)` : ""}
        ${(selo.pilares || []).length ? `<br/>${selo.pilares.map((p) => `${esc(PILAR[p.pilar] || p.pilar)}: ${p.feitos}/${p.total}${p.vencidos ? ` <span class="ruim">(${p.vencidos} vencido(s))</span>` : ""}`).join(" · ")}` : ""}</div>`));
  }
  // 2. função
  if (tem("funcoes")) {
    const hist = d.historico_funcoes || [];
    partes.push(sec("Função e histórico de funções", `
      ${f ? `<div class="grade"><div><b>Função</b>${esc(f.nome)}</div><div><b>CBO</b>${esc(f.cbo || "—")}</div><div><b>Setor</b>${esc(f.setor || "—")}</div>
        <div><b>Escolaridade mínima</b>${esc(f.escolaridade || "—")}</div><div><b>CNH mínima</b>${esc(f.cnh_categoria || "—")}</div><div><b>Riscos (PGR)</b>${esc((f.riscos || []).join(", ") || "—")}</div></div>
        ${f.descritivo ? `<h3>Descritivo do cargo</h3><div class="bloco">${esc(f.descritivo)}</div>` : ""}
        ${f.requisitos ? `<h3>Requisitos</h3><div class="bloco">${esc(f.requisitos)}</div>` : ""}` : `<div class="vazio">Sem função ligada ao modelo de cargo.</div>`}
      <h3>Histórico de funções no período</h3>
      ${hist.length ? `<table><thead><tr><th>Função</th><th>De</th><th>Até</th><th>Motivo</th><th>Obs.</th></tr></thead><tbody>
        ${hist.map((h) => `<tr><td>${esc(h.funcao_nome)}</td><td>${dBR(h.inicio)}</td><td>${h.fim ? dBR(h.fim) : "atual"}</td><td>${esc(MOTIVO_FUNCAO[h.motivo] || h.motivo || "—")}</td><td>${esc(h.obs || "")}</td></tr>`).join("")}</tbody></table>` : `<div class="vazio">Sem registros no período.</div>`}`));
  }
  // 3. documentos
  if (tem("documentos")) {
    const docs = d.documentos || [];
    partes.push(sec("Documentos", docs.length ? `<table><thead><tr><th>Documento</th><th>Número</th><th>Emissão</th><th>Vencimento</th><th>Situação</th><th>Anexo no sistema</th></tr></thead><tbody>
      ${docs.map((x) => `<tr><td>${esc(x.tipo)}</td><td>${esc(x.numero || "—")}</td><td>${dBR(x.emitido_em)}</td><td>${x.vence_em ? dBR(x.vence_em) : "—"}</td><td class="${x.situacao === "vencido" ? "ruim" : x.situacao === "vence_30" ? "amar" : ""}">${esc(SIT_DOC[x.situacao] || x.situacao)}</td><td>${esc(x.anexo || "—")}</td></tr>`).join("")}
      </tbody></table><div class="vazio">Os arquivos (PDF/fotos) ficam guardados no QuotaFlow e podem ser apresentados à parte.</div>` : `<div class="vazio">Nenhum documento.</div>`));
  }
  // 4. EPI
  if (tem("epi")) {
    const ents = d.epi || [];
    partes.push(sec("Entregas de EPI (NR-6)", ents.length ? `<table><thead><tr><th>Data</th><th>Nº</th><th>Função na época</th><th>EPI (CA · tam. · qtd)</th><th>Motivo</th><th>Devolução</th><th>Assinatura</th></tr></thead><tbody>
      ${ents.map((x) => `<tr><td>${dBR(x.entregue_em)}</td><td>${esc(x.numero)}</td><td>${esc(x.funcao_nome || "—")}</td>
        <td>${(x.itens || []).map((i) => `${esc(i.item_nome)}${i.ca ? ` · CA ${esc(i.ca)}` : ""}${i.tamanho ? ` · ${esc(i.tamanho)}` : ""} · ${esc(Number(i.quantidade).toLocaleString("pt-BR"))}`).join("<br/>")}</td>
        <td>${esc(MOTIVO_EPI[x.motivo] || x.motivo || "")}</td><td>${(x.itens || []).map((i) => (i.devolvido_em ? `${dBR(i.devolvido_em)} (${esc(i.devolucao_estado || "")})` : "em uso")).join("<br/>")}</td>
        <td class="ass">${x.assinatura_png ? `<img src="${x.assinatura_png}" alt="assinatura"/>` : "—"}${x.entregue_por_nome ? `<div style="font-size:8px;color:#666">entregue por ${esc(x.entregue_por_nome)}</div>` : ""}</td></tr>`).join("")}
      </tbody></table><div class="hash">Integridade (SHA-256): ${ents.map((x) => `${esc(x.numero)}: ${esc(x.assinatura_hash || "")}`).join(" · ")}</div>` : `<div class="vazio">Nenhuma entrega no período.</div>`));
  }
  // 5. treinamentos
  if (tem("treinamentos")) {
    const t = d.treinamentos || { lista: [], situacao_atual: [] };
    partes.push(sec("Treinamentos", `
      <div class="bloco" style="white-space:normal"><b>Horas de treinamento no período: ${fmtH(t.horas_periodo)}</b> · ${t.lista.length} registro(s)</div>
      ${t.lista.length ? `<table><thead><tr><th>Data</th><th>Treinamento</th><th>Modalidade · instrutor</th><th>Presença / prova</th><th>Horas</th><th>Válido até</th><th>Certificado</th></tr></thead><tbody>
        ${t.lista.map((x) => `<tr><td>${dBR(x.data)}</td><td>${esc(x.treinamento)}</td><td>${esc(MOD[x.modalidade] || x.modalidade || "")}${x.instrutor ? ` · ${esc(x.instrutor)}` : ""}</td>
          <td>${x.presente ? `<span class="ok">${x.nota != null ? `Aprovado — nota ${esc(Number(x.nota).toLocaleString("pt-BR"))}%` : x.assinou ? "Presente (assinou)" : "Presente"}</span>` : x.status === "agendada" ? "Inscrito" : `<span class="ruim">Faltou</span>`}
            ${x.tentativas.length ? `<br/><span style="color:#555">Tentativas: ${x.tentativas.map((a) => `${a.numero}ª ${esc(Number(a.nota).toLocaleString("pt-BR"))}%`).join(" · ")}</span>` : ""}</td>
          <td>${x.horas ? fmtH(x.horas) : "—"}</td><td>${x.valido_ate ? dBR(x.valido_ate) : x.presente ? "não vence" : "—"}</td><td class="hash">${esc(x.certificado || "—")}</td></tr>`).join("")}
        </tbody></table>` : `<div class="vazio">Nenhum treinamento no período.</div>`}
      <h3>Treinamentos exigidos pela função — situação na emissão</h3>
      ${t.situacao_atual.length ? `<table><thead><tr><th>Treinamento</th><th>Situação</th><th>Válido até</th></tr></thead><tbody>${t.situacao_atual.map((x) => `<tr><td>${esc(x.nome)}</td><td class="${x.situacao === "vencido" || x.situacao === "falta" ? "ruim" : x.situacao === "ok" ? "ok" : "amar"}">${esc(SIT_TR[x.situacao] || x.situacao)}</td><td>${dBR(x.valido_ate)}</td></tr>`).join("")}</tbody></table>` : `<div class="vazio">A função não exige treinamentos.</div>`}`));
  }
  // 6. competências
  if (tem("competencias")) {
    const k = d.competencias || { atual: [], evolucao: [] };
    partes.push(sec("Competências", `
      <h3>Situação na emissão</h3>
      ${k.atual.length ? `<table><thead><tr><th>Competência</th><th>Exigido</th><th>Atual</th><th>Situação</th></tr></thead><tbody>
        ${k.atual.map((x) => `<tr><td>${esc(x.nome)}</td><td>${x.tipo === "competencia" ? `nível ${x.nivel_esperado} (${esc(NIVEL[x.nivel_esperado])})` : esc(x.exigido || "—")}</td>
          <td>${x.tipo === "competencia" ? (x.nivel ? `nível ${x.nivel} (${esc(NIVEL[x.nivel])})` : "—") : esc(x.atual || "não informado")}</td>
          <td class="${x.situacao === "ok" ? "ok" : "amar"}">${esc(SIT_K[x.situacao] || x.situacao)}</td></tr>`).join("")}</tbody></table>` : `<div class="vazio">A função não exige competências.</div>`}
      <h3>Evolução no período</h3>
      ${k.evolucao.length ? k.evolucao.map((g) => `
        <div class="bloco" style="white-space:normal"><b>${esc(g.nome)}</b> · <span class="evo">${g.avaliacoes.map((a) => a.nivel).join(" → ")}</span>
          <table style="margin:4px 0 0"><thead><tr><th>Data</th><th>Nota</th><th>Esperado</th><th>Avaliado por</th><th>Observação</th><th>Evidência</th></tr></thead><tbody>
          ${g.avaliacoes.map((a) => `<tr><td>${dBR(a.em)}</td><td>${a.nivel} · ${esc(NIVEL[a.nivel])}</td><td>${a.nivel_esperado || "—"}</td><td>${esc(a.por || "—")}</td><td>${esc(a.obs || "")}</td><td>${esc([a.evidencia, ...(a.treinamentos || []).map((x) => `🎓 ${x}`)].filter(Boolean).join(" · ") || "—")}</td></tr>`).join("")}
          </tbody></table></div>`).join("") : `<div class="vazio">Nenhuma avaliação no período.</div>`}`));
  }

  // 7. multas (12g)
  if (tem("multas")) {
    const mu = d.multas || { lista: [], resumo: {} };
    const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
    const r = mu.resumo || {};
    partes.push(sec("Multas de trânsito", `
      <div class="bloco" style="white-space:normal"><b>Últimos 12 meses:</b> ${r.total_12m || 0} multa(s) · ${r.pontos_12m || 0} ponto(s)${r.abertas ? ` · <span class="amar">${r.abertas} em aberto</span>` : ""} · <b>Total descontado do colaborador:</b> ${brl(r.descontado_total || 0)}</div>
      ${mu.lista.length ? `<table><thead><tr><th>Data</th><th>Veículo · auto · órgão</th><th>Infração</th><th>Pts</th><th>Valor</th><th>Situação</th></tr></thead><tbody>
        ${mu.lista.map((m) => `<tr><td>${dBR(m.data)}${m.hora ? ` ${esc(m.hora)}` : ""}</td><td>${esc([m.veiculo, m.auto && `auto ${m.auto}`, m.orgao].filter(Boolean).join(" · "))}</td><td>${esc(m.infracao || "—")}</td><td>${m.pontos ?? "—"}</td><td>${brl(m.valor)}</td>
          <td>${esc(m.status)}${m.valor_pago != null ? `<br/>pago ${brl(m.valor_pago)}` : ""}${m.valor_descontado != null ? `<br/>descontado ${brl(m.valor_descontado)}${m.parcelas > 1 ? ` em ${m.parcelas}x` : ""}` : ""}${m.aceite ? `<br/><span class="ok">✍ aceite assinado ${dataHora(m.aceite.em)}</span><div class="hash">${esc(m.aceite.hash)}</div>` : ""}${m.motivo_cancelamento ? `<br/>${esc(m.motivo_cancelamento)}` : ""}</td></tr>`).join("")}
        </tbody></table>` : `<div class="vazio">Nenhuma multa no período.</div>`}`));
  }

  // 8. disciplinar (12h)
  if (tem("disciplinar")) {
    const di = d.disciplinar || { lista: [], resumo: { por_tipo_12m: {} } };
    const p = di.resumo.por_tipo_12m || {};
    partes.push(sec("Medidas disciplinares", `
      <div class="bloco" style="white-space:normal"><b>Últimos 12 meses:</b> ${p.orientacao || 0} orientação(ões) · ${p.advertencia || 0} advertência(s) · ${p.suspensao || 0} suspensão(ões)${di.resumo.dias_suspensao_12m ? ` (${di.resumo.dias_suspensao_12m} dia(s))` : ""}</div>
      ${di.lista.length ? `<table><thead><tr><th>Aplicada</th><th>Medida</th><th>Motivo · fato</th><th>Ciência</th><th>Por</th></tr></thead><tbody>
        ${di.lista.map((m) => `<tr${m.status === "cancelada" ? ' style="opacity:.55"' : ""}><td>${dBR(m.data_aplicacao)}<br/><span style="color:#666">fato ${dBR(m.data_fato)}</span></td><td>${esc(m.tipo)}${m.dias_suspensao ? `<br/>${m.dias_suspensao} d (${dBR(m.suspensao_inicio)} a ${dBR(m.suspensao_fim)})` : ""}${m.status === "cancelada" ? `<br/><span class="ruim">CANCELADA: ${esc(m.cancelamento_motivo || "")}</span>` : ""}</td>
          <td><b>${esc(m.categoria)}</b><br/>${esc(m.descricao)}</td><td>${m.ciencia === "assinada" ? `✍ assinada ${dataHora(m.ciencia_em)}<div class="hash">${esc(m.ciencia_hash || "")}</div>` : m.ciencia === "recusa" ? `recusou — testemunhas: ${esc(m.testemunhas.join(", "))}` : m.ciencia === "pendente" ? `<span class="amar">aguardando ciência</span>` : m.ciencia === "papel" ? `assinou no papel ${dataHora(m.ciencia_em)} (anexo no sistema)` : "verbal (registrada)"}</td><td>${esc(m.aplicado_por || "—")}</td></tr>`).join("")}
        </tbody></table>` : `<div class="vazio">Nenhuma medida no período.</div>`}`));
  }

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Dossiê — ${esc(c.nome)}</title><style>${CSS}</style></head><body><div class="pagina">
    <div class="capa">
      <div style="font-size:14px;font-weight:700">${esc(e.razao_social || e.nome)}</div><div class="linha">${e.cnpj ? `CNPJ ${esc(fmtCNPJ(e.cnpj))}` : ""}</div>
      <h1>DOSSIÊ DO COLABORADOR</h1>
      <div class="linha">Período: <b>${esc(per)}</b></div>
      <div class="nome">${esc(c.nome)}</div>
      <div class="linha">CPF ${esc(fmtCPF(c.cpf))}${c.funcao ? ` · ${esc(c.funcao)}` : ""}${c.admissao ? ` · admissão ${dBR(c.admissao)}` : ""}</div>
      <div class="meta">
        <b>Código de verificação:</b> ${esc(d.codigo)}<br/>
        <b>Emitido em:</b> ${dataHora(d.gerado_em)}${d.gerado_por_nome ? ` · <b>por:</b> ${esc(d.gerado_por_nome)}` : ""}<br/>
        <b>Finalidade:</b> ${esc(MOTIVO[d.motivo] || d.motivo || "—")}<br/>
        <b>Conteúdo:</b> ${(d.secoes || []).map((s) => ({ dados: "Dados e selo", funcoes: "Função e histórico", documentos: "Documentos", epi: "EPIs", treinamentos: "Treinamentos", competencias: "Competências", multas: "Multas", disciplinar: "Disciplinar" }[s])).join(" · ")}
      </div>
      <div class="confid">DOCUMENTO CONFIDENCIAL — contém dados pessoais (LGPD, Lei 13.709/2018). Uso restrito à finalidade indicada; a emissão fica registrada no sistema (quem, quando e por quê). Não compartilhe além do necessário.</div>
    </div>
    ${partes.join("")}
    <div class="nao-imprimir" style="margin-top:14px;text-align:center"><button onclick="window.print()" style="padding:8px 18px;font-size:13px">🖨 Imprimir / Salvar em PDF</button></div>
  </div></body></html>`;
}

export function prepararJanela() {
  const w = window.open("", "_blank");
  if (w) { try { w.document.write('<p style="font-family:sans-serif;padding:24px">Montando o dossiê…</p>'); } catch { /* ok */ } }
  return w;
}
export function abrirDossie(dados, janela) {
  const w = janela || window.open("", "_blank");
  if (!w) throw new Error("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.");
  w.document.open(); w.document.write(gerarHtmlDossie(dados)); w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* ok */ } }, 500);
}
