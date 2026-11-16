// components/pessoas/AgingDocumentos.jsx — etapa 18zz.14: 📊 AGING dos documentos de gestão (para o representante da qualidade)
//   Tempo desde a última aprovação (vigente) ou desde o cadastro (rascunho = nunca aprovado). Informativo: a ISO 9001 não fixa prazo.
//   Faixas + "nunca revisado" (Rev. 00) + próxima análise crítica vencida. Clique = abre o documento. 🖨 Imprimir em A4.
import { useMemo, useState } from "react";
import { logoHtml, dadosEmpresa } from "../../utils/logoEmpresa";

const dBR = (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");
const meses = (iso) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(String(iso).slice(0, 10) + "T12:00:00").getTime()) / (30.44 * 864e5))) : null);
const tempo = (m) => (m == null ? "—" : m < 1 ? "menos de 1 mês" : m < 12 ? `${m} ${m === 1 ? "mês" : "meses"}` : `${Math.floor(m / 12)} ano(s)${m % 12 ? ` e ${m % 12} m` : ""}`);
const rev = (n) => `Rev. ${String(n ?? 0).padStart(2, "0")}`;
const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const FAIXAS = [["todos", "Todos"], ["36", "3 anos ou mais"], ["24", "2 a 3 anos"], ["12", "1 a 2 anos"], ["0", "Menos de 1 ano"], ["nunca", "Nunca revisados (Rev. 00)"], ["rascunho", "Nunca aprovados (rascunho)"], ["vencida", "Análise crítica vencida"]];

export default function AgingDocumentos({ C, s, d, onAbrir, onFechar, onErro }) {
  const [faixa, setFaixa] = useState("todos");
  const hoje = new Date().toISOString().slice(0, 10);
  const linhas = useMemo(() => (d?.documentos || []).filter((x) => x.status !== "obsoleto").map((x) => {
    const base = x.status === "vigente" ? (x.aprovado_em || x.vigente_desde || x.criado_em) : x.criado_em;
    const m = meses(base);
    return { ...x, base, m, nunca: x.status === "vigente" && Number(x.revisao || 0) === 0, vencida: x.status === "vigente" && x.proxima_revisao && String(x.proxima_revisao).slice(0, 10) < hoje };
  }).sort((a, b) => (b.status === "rascunho") - (a.status === "rascunho") || (b.m ?? -1) - (a.m ?? -1)), [d]); // eslint-disable-line
  const conta = (f) => linhas.filter((x) => filtro(f, x)).length;
  const filtro = (f, x) => f === "todos" ? true : f === "nunca" ? x.nunca : f === "rascunho" ? x.status === "rascunho" : f === "vencida" ? x.vencida
    : x.status === "vigente" && x.m != null && (f === "36" ? x.m >= 36 : f === "24" ? x.m >= 24 && x.m < 36 : f === "12" ? x.m >= 12 && x.m < 24 : x.m < 12);
  const vis = linhas.filter((x) => filtro(faixa, x));
  const cor = (x) => x.status === "rascunho" ? C.muted : x.m >= 36 ? C.danger : x.m >= 24 ? C.warn : C.text;

  const imprimir = () => {
    const e = dadosEmpresa(); const logo = logoHtml({ altura: 40, largura: 130, margem: "0" }) || `<b>${esc(e.razao_social || e.nome || "")}</b>`;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Aging dos documentos de gestão</title><style>
      body{font:12px Arial,sans-serif;color:#111;margin:0}.p{max-width:800px;margin:16px auto;padding:20px}h1{font-size:16px;margin:0}table{width:100%;border-collapse:collapse;margin-top:10px}
      th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;color:#111;vertical-align:top}th{background:#eee;font-size:11px}.r{color:#b91c1c;font-weight:700}.a{color:#b45309;font-weight:700}
      @media print{.p{margin:0;max-width:none;padding:0}@page{size:A4 portrait;margin:12mm}}</style></head><body><div class="p">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">${logo}<div style="text-align:right"><h1>📊 Aging dos documentos de gestão</h1><div>${esc(FAIXAS.find((f) => f[0] === faixa)?.[1])} · ${vis.length} documento(s) · emitido em ${new Date().toLocaleDateString("pt-BR")}</div></div></div>
      <table><tr><th>Código</th><th>Título</th><th>Rev.</th><th>Situação</th><th>Última aprovação</th><th>Sem revisão há</th><th>Próx. análise</th><th>Leitura</th></tr>
      ${vis.map((x) => `<tr><td>${esc(x.codigo)}</td><td>${esc(x.titulo)}</td><td>${rev(x.revisao)}${x.nunca ? " · nunca revisado" : ""}</td><td>${x.status === "rascunho" ? "Rascunho (nunca aprovado)" : "Vigente"}</td>
        <td>${x.status === "vigente" ? dBR(x.aprovado_em) : "—"}</td><td class="${x.m >= 36 ? "r" : x.m >= 24 ? "a" : ""}">${x.status === "rascunho" ? `cadastrado há ${tempo(x.m)}` : tempo(x.m)}</td>
        <td${x.vencida ? ' class="r"' : ""}>${dBR(x.proxima_revisao)}${x.vencida ? " · vencida" : ""}</td><td>${x.leitura ? `${x.leitura.lidos}/${x.leitura.esperados}` : "—"}</td></tr>`).join("")}</table>
      <p style="font-size:10.5px;color:#555;margin-top:10px">Informativo: a ISO 9001 não fixa periodicidade de revisão — cabe à organização avaliar se o conteúdo continua adequado. Emitido pelo QuotaFlow.</p></div>
      <script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></body></html>`;
    const w = window.open("", "_blank"); if (!w) { onErro?.("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo."); return; }
    w.document.open(); w.document.write(html); w.document.close();
  };

  return (
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "#000000aa", zIndex: 80, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: "min(980px, 100%)", padding: 18 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <div style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>📊 Aging dos documentos</div>
          <button type="button" onClick={imprimir} style={{ ...s.btn(false), cursor: "pointer", color: C.text, padding: "6px 12px" }}>🖨 Imprimir</button>
          <button type="button" onClick={onFechar} style={{ ...s.btn(true), cursor: "pointer", padding: "6px 12px" }}>Fechar</button>
        </div>
        <div style={{ fontSize: 12, color: C.textSub, margin: "4px 0 10px" }}>Há quanto tempo cada documento não passa por revisão (desde a última aprovação). Informativo — a ISO 9001 não fixa prazo; serve para o representante da qualidade ver o que pode estar desatualizado.</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {FAIXAS.map(([k, l]) => { const n = conta(k); return <button key={k} type="button" onClick={() => setFaixa(k)} style={{ ...s.btn(faixa === k), cursor: "pointer", padding: "5px 10px", fontSize: 12, opacity: n || k === "todos" ? 1 : 0.5 }}>{l} · {n}</button>; })}
        </div>
        {vis.length === 0 ? <div style={{ color: C.muted, fontSize: 13, padding: 16, textAlign: "center" }}>Nenhum documento nesta faixa.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr style={{ color: C.textSub, textAlign: "left" }}>{["Código", "Título", "Rev.", "Última aprovação", "Sem revisão há", "Próx. análise", "Leitura"].map((h) => <th key={h} style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}`, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
              <tbody>{vis.map((x) => (
                <tr key={x.id} onClick={() => onAbrir(x)} style={{ cursor: "pointer", borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "7px 8px", color: C.accent, fontWeight: 600, whiteSpace: "nowrap" }}>{x.codigo}</td>
                  <td style={{ padding: "7px 8px" }}>{x.titulo}{x.status === "rascunho" && <span style={{ ...s.tag(C.muted), marginLeft: 6 }}>Rascunho</span>}</td>
                  <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>{rev(x.revisao)}{x.nunca && <div style={{ fontSize: 11, color: C.warn }}>nunca revisado</div>}</td>
                  <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>{x.status === "vigente" ? dBR(x.aprovado_em) : <span style={{ color: C.muted }}>nunca aprovado</span>}</td>
                  <td style={{ padding: "7px 8px", whiteSpace: "nowrap", color: cor(x), fontWeight: x.m >= 24 && x.status === "vigente" ? 700 : 400 }}>{x.status === "rascunho" ? `cadastrado há ${tempo(x.m)}` : tempo(x.m)}</td>
                  <td style={{ padding: "7px 8px", whiteSpace: "nowrap", color: x.vencida ? C.danger : C.text }}>{dBR(x.proxima_revisao)}{x.vencida ? " · vencida" : ""}</td>
                  <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>{x.leitura ? `${x.leitura.lidos}/${x.leitura.esperados}` : "—"}</td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
