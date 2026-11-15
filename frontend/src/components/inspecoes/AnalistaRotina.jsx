// components/inspecoes/AnalistaRotina.jsx — etapa 18zj: 🧠 ANALISTA DA ROTINA DE INSPEÇÃO (aba da tela 🔍 Inspeções)
//   Cumprimento mês a mês (tendência), empresa × locatário, equipamentos, itens que mais falham, reprovados sem liberação
//   e os ACHADOS por regra ("o que o analista viu"). Funciona sem IA; o parecer com IA entra no e-mail mensal (próxima etapa).
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";

export default function AnalistaRotina({ C, s, onErro, onVerEquipamento }) {
  const [meses, setMeses] = useState(12); const [d, setD] = useState(null);
  useEffect(() => { setD(null); apiService.get("/inspecoes/analista", { meses }).then(setD).catch((e) => onErro?.(e.message)); }, [meses]); // eslint-disable-line
  const cor = (p) => (p == null ? C.muted : p >= 90 ? C.success : p >= 70 ? C.warn : C.danger);
  const NIV = { alto: [C.danger, "●"], medio: [C.warn, "●"], bom: [C.success, "✓"] };
  const card = { ...s.card, padding: "12px 14px", marginBottom: 12 };
  const tit = (t, sub) => <div style={{ marginBottom: 8 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{t}</div>{sub && <div style={{ fontSize: 11.5, color: C.muted }}>{sub}</div>}</div>;
  const barra = (p, w = 90) => <div style={{ width: w, height: 6, background: C.border, borderRadius: 3, flexShrink: 0 }}><div style={{ width: `${p || 0}%`, height: 6, background: cor(p), borderRadius: 3 }} /></div>;
  const dBR = (x) => (x ? x.split("-").reverse().join("/") : "—");
  const eq = (id, txt) => onVerEquipamento ? <button type="button" onClick={() => onVerEquipamento(id)} style={{ background: "none", border: "none", padding: 0, color: C.accent, cursor: "pointer", fontWeight: 600, fontSize: 13, textAlign: "left" }}>{txt}</button> : <b>{txt}</b>;

  return <div>
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
      <span style={{ fontSize: 12, color: C.muted }}>Período:</span>
      {[6, 12, 24].map((n) => <button key={n} type="button" onClick={() => setMeses(n)} style={{ ...s.btn(meses === n), padding: "5px 12px", fontSize: 12.5, cursor: "pointer", ...(meses === n ? {} : { color: C.text }) }}>{n} meses</button>)}
    </div>
    {!d ? <div style={{ color: C.muted }}>Analisando…</div> : <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {[["CUMPRIMENTO", d.total.pct == null ? "—" : `${d.total.pct}%`, cor(d.total.pct), `${d.total.cumpridas} de ${d.total.esperadas} previstas`],
          ["REPROVADAS", d.liberacao.reprovadas, d.liberacao.reprovadas ? C.danger : C.muted, `${d.liberacao.pendentes.length} equipamento(s) sem liberação`],
          ["DA REPROVAÇÃO À LIBERAÇÃO", d.liberacao.media_dias == null ? "—" : `${String(d.liberacao.media_dias).replace(".", ",")} d`, d.liberacao.media_dias > 5 ? C.warn : C.text, "média de dias"],
          ["OS ABERTAS PELAS INSPEÇÕES", d.os_abertas, C.accent, `${d.terceiros.inspecoes} de ${d.terceiros.total} inspeções por terceiros`]].map(([l, v, c, sub]) =>
          <div key={l} style={{ ...s.card, padding: "10px 14px", flex: "1 1 140px" }}><div style={{ fontSize: 11, color: C.muted }}>{l}</div><div style={{ fontSize: 24, fontWeight: 800, color: c }}>{v}</div><div style={{ fontSize: 11, color: C.muted }}>{sub}</div></div>)}
      </div>

      <div style={{ ...card, borderLeft: `3px solid ${C.accent}` }}>
        {tit("🔎 O que o analista viu", "Achados calculados pelos dados das inspeções e rotinas.")}
        {d.achados.length === 0 ? <div style={{ fontSize: 13, color: C.muted }}>Nada fora do normal no período.</div>
          : d.achados.map((a, k) => <div key={k} style={{ display: "flex", gap: 8, fontSize: 13, padding: "4px 0" }}><span style={{ color: NIV[a.nivel][0] }}>{NIV[a.nivel][1]}</span><span>{a.texto}</span></div>)}
      </div>

      <div style={card}>
        {tit("📈 Cumprimento mês a mês", "Mês atual parcial (só conta janela que já terminou ou foi cumprida).")}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 150, overflowX: "auto", paddingBottom: 2 }}>
          {d.serie.map((m) => <div key={m.mes} title={`${m.rotulo}: ${m.cumpridas}/${m.esperadas} · ${m.inspecoes} inspeções · ${m.reprovadas} reprovadas`} style={{ flex: "1 0 28px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
            <div style={{ fontSize: 10.5, color: cor(m.pct), fontWeight: 700 }}>{m.pct == null ? "" : `${m.pct}%`}</div>
            <div style={{ width: "70%", height: `${m.pct == null ? 0 : Math.max(2, m.pct) * 0.95}px`, background: cor(m.pct), opacity: m.parcial ? 0.5 : 1, borderRadius: "3px 3px 0 0" }} />
            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>{m.rotulo}</div>
          </div>)}
        </div>
      </div>

      <div style={{ display: "flex", gap: "0 12px", flexWrap: "wrap" }}>
        <div style={{ ...card, flex: "1 1 300px" }}>
          {tit("👥 Quem cumpre", "Rotinas da sua equipe × rotinas do locatário.")}
          {d.responsavel.length === 0 ? <div style={{ fontSize: 12.5, color: C.muted }}>Sem rotinas no período.</div> : d.responsavel.map((r) => <div key={r.responsavel} style={{ display: "flex", gap: 10, alignItems: "center", padding: "5px 0", fontSize: 13 }}>
            <span style={{ flex: 1 }}>{r.responsavel === "locatario" ? "Locatários" : "Sua equipe"} <span style={{ color: C.muted, fontSize: 11.5 }}>{r.cumpridas}/{r.esperadas}</span></span>{barra(r.pct)}<b style={{ width: 42, textAlign: "right", color: cor(r.pct) }}>{r.pct}%</b></div>)}
        </div>
        <div style={{ ...card, flex: "1 1 300px" }}>
          {tit("🔧 Itens que mais falham", "Pontos marcados NOK no período.")}
          {d.falhas.length === 0 ? <div style={{ fontSize: 12.5, color: C.muted }}>Nenhum item NOK. 👏</div> : d.falhas.map((f) => <div key={f.rotulo} style={{ display: "flex", gap: 8, padding: "4px 0", fontSize: 13 }}>
            <b style={{ width: 30, color: C.warn }}>{f.vezes}×</b><span style={{ flex: 1 }}>{f.rotulo}{f.criticas ? <span style={{ ...s.tag(C.danger), marginLeft: 6 }}>{f.criticas} impediu</span> : null}<div style={{ fontSize: 11, color: C.muted }}>{f.equipamentos.join(", ")}{f.n_equipamentos > 5 ? ` +${f.n_equipamentos - 5}` : ""}</div></span></div>)}
        </div>
      </div>

      {d.liberacao.pendentes.length > 0 && <div style={{ ...card, borderLeft: `3px solid ${C.danger}` }}>
        {tit("⛔ Reprovados ainda sem liberação", "Sem inspeção aprovada depois da reprovação.")}
        {d.liberacao.pendentes.map((p) => <div key={p.equipamento_id} style={{ display: "flex", gap: 10, padding: "4px 0", fontSize: 13, flexWrap: "wrap" }}>
          <span style={{ flex: 1 }}>{eq(p.equipamento_id, p.equipamento_nome)} <span style={{ color: C.muted, fontSize: 11.5 }}>· reprovado em {dBR(p.em)}{p.reprovacoes > 1 ? ` · ${p.reprovacoes} reprovações` : ""}</span></span>
          <b style={{ color: p.dias > 7 ? C.danger : C.warn }}>{p.dias} dia(s)</b></div>)}
      </div>}

      <div style={{ ...s.card, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px 0" }}>{tit("🚜 Por equipamento", "Piores primeiro.")}</div>
        {d.equipamentos.length === 0 ? <div style={{ padding: 16, color: C.muted, textAlign: "center" }}>Nenhuma rotina no período. Crie em 🚚 Equipamentos → ⏰ Rotinas.</div>
          : d.equipamentos.map((e, k) => <div key={e.equipamento_id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 14px", borderTop: `1px solid ${C.border}`, flexWrap: "wrap", fontSize: 13 }}>
            <div style={{ flex: "2 1 200px" }}>{eq(e.equipamento_id, e.nome || e.tag)}
              <div style={{ fontSize: 11, color: C.muted }}>{e.meses_abaixo ? `${e.meses_abaixo} mês(es) abaixo do previsto` : "todos os meses em dia"}{e.reprovadas ? ` · ${e.reprovadas} reprovação(ões)` : ""}{e.os ? ` · ${e.os} OS` : ""}</div></div>
            <span style={{ fontSize: 12, color: C.textSub }}>{e.cumpridas}/{e.esperadas}</span>{barra(e.pct)}<b style={{ width: 42, textAlign: "right", color: cor(e.pct) }}>{e.pct == null ? "—" : `${e.pct}%`}</b>
          </div>)}
      </div>
    </>}
  </div>;
}
