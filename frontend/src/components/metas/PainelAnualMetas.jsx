// components/metas/PainelAnualMetas.jsx — etapa SC2.4: 📅 PAINEL ANUAL — metas × meses, células coloridas 🟢🟡🔴
//   Material de entrada da análise crítica pela direção (ISO 9001, 9.3). Imprime em A4 deitado com o logo.
import { useEffect, useState } from "react";
import apiService from "../../services/apiService";
import { logoHtml, dadosEmpresa } from "../../utils/logoEmpresa";
import { COR_SINAL, fmtValor } from "./TelaMetas";

const FUNDO = { verde: "#dcfce7", amarelo: "#fef3c7", vermelho: "#fee2e2" };
const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const regraCurta = (m) => m.meta == null ? "—" : `${m.sentido === "menor" ? "≤" : "≥"} ${fmtValor(m.meta, m.unidade)}`;

export default function PainelAnualMetas({ C, s, onFechar, onAbrir, onErro }) {
  const anoAtual = String(new Date().getFullYear()); const [ano, setAno] = useState(anoAtual); const [d, setD] = useState(null);
  useEffect(() => { setD(null); apiService.get(`/metas/painel-anual?ano=${ano}`).then(setD).catch((e) => onErro?.(e?.response?.data?.erro || e.message)); }, [ano]); // eslint-disable-line
  const imprimir = () => {
    const e = dadosEmpresa(); const logo = logoHtml({ altura: 38, largura: 130, margem: "0" }) || `<b>${esc(e.razao_social || e.nome || "")}</b>`;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Metas do negócio ${d.ano}</title><style>
      body{font:10.5px Arial,sans-serif;color:#111;margin:0;background:#e5e7eb}.p{background:#fff;width:297mm;min-height:210mm;box-sizing:border-box;margin:16px auto;padding:10mm;box-shadow:0 2px 12px rgba(0,0,0,.25)}
      h1{font-size:15px;margin:0}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #bbb;padding:3px 4px;color:#111;text-align:center}th{background:#eee;font-size:10px}td.n{text-align:left}
      .v{background:${FUNDO.verde}}.a{background:${FUNDO.amarelo}}.r{background:${FUNDO.vermelho}}.aj{font-weight:700}
      @media print{body{background:#fff}.p{margin:0;width:auto;min-height:0;box-shadow:none;padding:0}@page{size:A4 landscape;margin:9mm}}</style></head><body><div class="p">
      <div style="display:flex;justify-content:space-between;align-items:center">${logo}<div style="text-align:right"><h1>🎯 Metas do negócio — ${esc(d.ano)}</h1><div>Análise crítica pela direção (ISO 9001, 9.3) · emitido em ${new Date().toLocaleDateString("pt-BR")}</div></div></div>
      <table><tr><th style="text-align:left">Indicador</th><th>Dono</th><th>Meta</th><th>Planos de ação</th>${d.meses.map((m) => `<th>${esc(m.nome.split("/")[0])}</th>`).join("")}</tr>
      ${d.metas.map((m) => `<tr><td class="n"><b>${esc(m.nome)}</b><br><span style="color:#555">${esc(m.area_nome)}</span></td><td>${esc(m.responsavel_nome || "—")}</td><td>${esc(regraCurta(m))}</td><td style="text-align:left;font-size:9.5px">${(m.acoes || []).map((a) => `${esc(a.numero || '')} ${esc(({ pendente: 'pendente', em_andamento: 'em andamento', concluida: 'concluída', cancelada: 'cancelada' })[a.status] || a.status)}`).join('<br>') || (['amarelo', 'vermelho'].includes(m.sinal_atual) ? '<b style="color:#b91c1c">sem plano</b>' : '—')}</td>${m.celulas.map((c) => `<td class="${{ verde: "v", amarelo: "a", vermelho: "r" }[c.sinal] || ""}${c.origem === "ajustado" ? " aj" : ""}">${c.valor == null ? "" : esc(fmtValor(c.valor, m.unidade))}${c.origem === "ajustado" ? "✎" : c.origem === "parcial" ? "*" : ""}</td>`).join("")}</tr>`).join("")}</table>
      <p style="color:#555;margin-top:6px">✎ = valor corrigido à mão (quem, quando e motivo ficam registrados no sistema) · * = parcial do mês corrente · fundo verde/amarelo/vermelho = semáforo pela meta de cada indicador.</p></div>
      <script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></body></html>`;
    const w = window.open("", "_blank"); if (!w) { onErro?.("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo."); return; }
    w.document.open(); w.document.write(html); w.document.close();
  };
  return (
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "#000000aa", zIndex: 80, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, padding: 18, width: "min(1200px, 100%)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>📅 Painel anual das metas</div>
          <select value={ano} onChange={(e) => setAno(e.target.value)} style={{ ...s.input, width: "auto", padding: "5px 10px" }}>{[0, 1, 2].map((i) => String(Number(anoAtual) - i)).map((a) => <option key={a}>{a}</option>)}</select>
          <button type="button" disabled={!d} onClick={imprimir} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>🖨 Imprimir A4</button>
          <button type="button" onClick={onFechar} style={{ ...s.btn(true), cursor: "pointer" }}>Fechar</button>
        </div>
        <div style={{ fontSize: 12, color: C.textSub, margin: "4px 0 10px" }}>Todas as metas mês a mês — entrada da análise crítica pela direção (ISO 9001, 9.3). Clique numa linha para ver a ficha.</div>
        {!d ? <div style={{ color: C.muted, padding: 30, textAlign: "center" }}>Carregando…</div> : d.metas.length === 0 ? <div style={{ color: C.muted, padding: 20 }}>Nenhuma meta cadastrada.</div> : (
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 3, fontSize: 12 }}>
            <thead><tr style={{ color: C.textSub }}><th style={{ textAlign: "left", padding: "4px 6px" }}>Indicador</th><th style={{ padding: "4px 6px" }}>Meta</th><th style={{ padding: "4px 6px" }}>Ações</th>{d.meses.map((m) => <th key={m.mes} style={{ padding: "4px 2px", fontWeight: 600 }}>{m.nome.split("/")[0]}</th>)}</tr></thead>
            <tbody>{d.metas.map((m) => <tr key={m.id} onClick={() => onAbrir?.(m.id)} style={{ cursor: "pointer" }}>
              <td style={{ padding: "6px", minWidth: 180 }}><div style={{ fontWeight: 600 }}>{m.nome}</div><div style={{ fontSize: 11, color: C.muted }}>{m.area_nome}{m.responsavel_nome ? ` · ${m.responsavel_nome}` : ""}</div></td>
              <td style={{ padding: "6px", whiteSpace: "nowrap", color: C.textSub, textAlign: "center" }}>{regraCurta(m)}</td>
              <td style={{ padding: "6px", textAlign: "center", whiteSpace: "nowrap", fontSize: 11.5 }} title={(m.acoes || []).map((a) => `${a.numero || ""} · ${a.titulo} · ${a.status}`).join("\n")}>{(m.acoes || []).length ? <span style={{ color: C.accent }}>📋 {m.acoes.filter((a) => !["concluida", "cancelada"].includes(a.status)).length}/{m.acoes.length}</span> : ["amarelo", "vermelho"].includes(m.sinal_atual) ? <span style={{ color: "#f87171" }}>sem plano</span> : <span style={{ color: C.border }}>—</span>}</td>
              {m.celulas.map((c) => <td key={c.mes} title={c.origem === "ajustado" ? `ajustado por ${c.por || "—"}: ${c.motivo || ""}` : c.origem === "parcial" ? "parcial do mês" : ""}
                style={{ textAlign: "center", padding: "6px 2px", borderRadius: 5, minWidth: 54, background: c.sinal ? COR_SINAL[c.sinal] + "33" : "transparent", color: COR_SINAL[c.sinal] || C.textSub, fontWeight: 700, border: c.origem === "parcial" ? `1px dashed ${C.border}` : "none" }}>
                {c.valor == null ? <span style={{ color: C.border }}>·</span> : <>{fmtValor(c.valor, m.unidade)}{c.origem === "ajustado" ? "✎" : ""}</>}</td>)}
            </tr>)}</tbody></table></div>)}
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>✎ corrigido à mão (passe o mouse para ver quem e por quê) · borda tracejada = mês em andamento</div>
      </div>
    </div>
  );
}
