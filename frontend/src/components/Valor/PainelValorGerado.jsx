// components/valor/PainelValorGerado.jsx — etapa 5a: 💰 VALOR GERADO (gestor/admin)
//   Destaque = só ganhos MEDIDOS (compras, spot, multas), cada um com a origem. Receita do comercial e atividade ficam à parte.
//   ROI pela assinatura do plano. "Como calculamos" aberto para quem quiser conferir.
import { useEffect, useState } from "react";
import apiService from "../../services/apiService";

const brl = (v, cent = false) => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: cent ? 2 : 0, maximumFractionDigits: cent ? 2 : 0 })}`;
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const AREAS = [
  { k: "compras", icone: "🛒", nome: "Compras", txt: (a) => `${a.n} item(ns) comprados abaixo da mediana · ${a.com_concorrencia} de ${a.itens_comprados} com 2+ propostas` },
  { k: "spot", icone: "⚡", nome: "Canal Spot", txt: (a) => `${a.n} demanda(s) com proposta abaixo da mediana · ${a.encerradas} encerrada(s)` },
  { k: "multas", icone: "🚦", nome: "Multas", txt: (a) => `${a.n} paga(s) com desconto · ${a.pagas} paga(s) no período` },
];

export default function PainelValorGerado({ C, s }) {
  const anoAtual = String(new Date().getFullYear());
  const [ano, setAno] = useState(anoAtual); const [d, setD] = useState(null); const [erro, setErro] = useState(null); const [como, setComo] = useState(false);
  useEffect(() => { setD(null); setErro(null); apiService.get(`/valor-gerado?ano=${ano}`).then(setD).catch((e) => setErro(e?.response?.data?.erro || "Não consegui carregar agora.")); }, [ano]);
  const ir = (g) => window.dispatchEvent(new CustomEvent("qf-navegar", { detail: { tela: g.link?.tela, titulo: g.titulo } }));
  const maxMes = d ? Math.max(1, ...d.por_mes.map((m) => m.valor)) : 1;
  const card = { ...s.card, padding: 16 };
  return (
    <div style={{ padding: "24px 28px 48px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <div style={{ fontSize: 24, fontWeight: 700, flex: 1 }}>💰 Valor gerado</div>
        <select value={ano} onChange={(e) => setAno(e.target.value)} style={{ ...s.input, width: "auto", padding: "6px 10px" }}>{[0, 1, 2].map((i) => String(Number(anoAtual) - i)).map((a) => <option key={a} value={a}>{a}</option>)}</select>
      </div>
      <div style={{ fontSize: 13, color: C.textSub, marginBottom: 18 }}>O quanto o QuotaFlow já devolveu para a empresa — <b>só ganhos medidos nos seus próprios dados</b>, cada real com a origem para conferir.</div>
      {erro && <div style={{ ...card, color: C.danger }}>{erro}</div>}
      {!d && !erro && <div style={{ ...card, color: C.muted, textAlign: "center", padding: 40 }}>Calculando…</div>}
      {d && <>
        <div style={{ ...card, padding: "22px 24px", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", background: `linear-gradient(135deg, ${C.surface}, #0f2a1f)`, borderColor: "#166534" }}>
          <div style={{ flex: "1 1 260px" }}>
            <div style={{ fontSize: 12, letterSpacing: "0.08em", color: "#86efac", fontWeight: 700 }}>ECONOMIA MEDIDA EM {d.ano}</div>
            <div style={{ fontSize: 44, fontWeight: 800, color: "#4ade80", lineHeight: 1.1, margin: "4px 0" }}>{brl(d.total)}</div>
            <div style={{ fontSize: 12.5, color: C.textSub }}>de 01/01 a {d.ate.split("-").reverse().join("/")} · compras + spot + multas</div>
          </div>
          {d.roi ? <div style={{ flex: "0 1 260px", textAlign: "center", borderLeft: `1px solid ${C.border}`, paddingLeft: 20 }}>
            <div style={{ fontSize: 34, fontWeight: 800, color: d.roi.vezes >= 1 ? "#4ade80" : C.text }}>{d.roi.vezes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×</div>
            <div style={{ fontSize: 12.5, color: C.textSub }}>{d.roi.vezes >= 1 ? "a assinatura já se pagou" : "do valor da assinatura no período"}<br />({brl(d.roi.custo_periodo)} de assinatura no período)</div>
          </div> : <div style={{ flex: "0 1 220px", fontSize: 12, color: C.muted }}>ROI aparece quando o plano da empresa tiver valor cadastrado.</div>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}>
          {AREAS.map((a) => { const x = d.areas[a.k]; return (
            <div key={a.k} style={card}>
              <div style={{ fontSize: 13, color: C.textSub }}>{a.icone} {a.nome} <span style={{ ...s.tag("#22c55e"), marginLeft: 4, fontSize: 10 }}>medido</span></div>
              <div style={{ fontSize: 24, fontWeight: 700, margin: "6px 0 4px", color: x.total > 0 ? "#4ade80" : C.text }}>{brl(x.total)}</div>
              <div style={{ fontSize: 11.5, color: C.muted }}>{a.txt(x)}</div>
            </div>); })}
        </div>

        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Mês a mês</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 130 }}>
            {d.por_mes.map((m) => <div key={m.mes} title={`${MES[Number(m.mes.slice(5)) - 1]}: ${brl(m.valor, true)}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
              <div style={{ fontSize: 10, color: C.textSub }}>{m.valor > 0 ? brl(m.valor) : ""}</div>
              <div style={{ width: "100%", maxWidth: 46, height: `${Math.max(2, (m.valor / maxMes) * 92)}px`, background: m.valor > 0 ? "#22c55e" : C.border, borderRadius: "4px 4px 0 0" }} />
              <div style={{ fontSize: 10.5, color: C.muted }}>{MES[Number(m.mes.slice(5)) - 1]}</div>
            </div>)}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12, marginTop: 12 }}>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>📈 Receita fechada no sistema</div>
            <div style={{ fontSize: 22, fontWeight: 700, margin: "6px 0 2px" }}>{brl(d.receita.valor)}</div>
            <div style={{ fontSize: 11.5, color: C.muted }}>{d.receita.bids} BID(s) aceito(s) no período · é receita, não economia — por isso fica fora do total acima</div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>⏱ O que o sistema fez pela equipe</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, fontSize: 12.5 }}>
              {[["🛒", d.atividade.cotacoes, "cotações"], ["📄", d.atividade.ocs, "ordens de compra"], ["🔍", d.atividade.inspecoes, "inspeções digitais"], ["🚛", d.atividade.ats, "ATs / viagens"], ["📏", d.atividade.medicoes, "medições enviadas"]].map(([i, n, l]) => <div key={l}><div style={{ fontSize: 18, fontWeight: 700 }}>{i} {n}</div><div style={{ color: C.muted }}>{l}</div></div>)}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Horas poupadas em R$ entram depois, com a linha de base que a empresa informar.</div>
          </div>
        </div>

        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🏆 Maiores ganhos — clique para ver a origem</div>
          {d.maiores.length === 0 ? <div style={{ fontSize: 12.5, color: C.muted }}>Ainda sem ganhos medidos no período. Eles aparecem quando houver compras ou spots com 2+ propostas, ou multas pagas com desconto.</div>
            : d.maiores.map((g, i) => <div key={i} onClick={() => ir(g)} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "8px 4px", borderTop: i ? `1px solid ${C.border}` : "none", cursor: "pointer" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#4ade80", minWidth: 96 }}>{brl(g.valor, true)}</span>
              <span style={{ flex: 1, fontSize: 13 }}>{g.titulo}<div style={{ fontSize: 11.5, color: C.muted }}>{g.detalhe} · {g.em.split("-").reverse().join("/")}</div></span>
              <span style={{ color: C.accent, fontSize: 12 }}>abrir ›</span></div>)}
        </div>

        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={() => setComo(!como)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 12.5, padding: 0 }}>{como ? "▾" : "▸"} Como calculamos</button>
          {como && <div style={{ ...card, marginTop: 6, fontSize: 12.5, color: C.textSub, lineHeight: 1.6 }}>
            <b>Regra: conservador.</b> Na dúvida, não conta.<br />
            🛒 <b>Compras:</b> para cada item de ordem de compra, (mediana das propostas dos <i>outros</i> fornecedores para o mesmo item − preço pago) × quantidade. Só entra com 2 ou mais propostas; se o preço pago foi maior que a mediana, conta zero (não desconta).<br />
            ⚡ <b>Spot:</b> mediana das outras propostas − proposta escolhida, quando há 2 ou mais com valor.<br />
            🚦 <b>Multas:</b> valor da multa − valor pago (desconto por pagar no prazo).<br />
            🛡 <b>Trava:</b> mediana acima de 3× o preço pago é tratada como dado suspeito e não entra.<br />
            📈 Receita e ⏱ atividade aparecem à parte e não somam na economia. Ganhos estimados (NIC evitada, documento vencido evitado…) virão numa seção separada, com premissas que a empresa confirma.
          </div>}
        </div>
      </>}
    </div>
  );
}

/** 5a: selo no Início (gestor/admin) — "💰 R$ X gerados em 2026" · clique abre o painel. Some se ainda não houver ganho. */
export function SeloValorGerado({ C, s, onAbrir }) {
  const [d, setD] = useState(null);
  useEffect(() => { apiService.get("/valor-gerado").then(setD).catch(() => {}); }, []);
  if (!d || !(d.total > 0)) return null;
  return (
    <div onClick={onAbrir} style={{ ...s.card, padding: "12px 16px", marginBottom: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left", borderColor: "#166534", background: `linear-gradient(135deg, ${C.surface}, #0f2a1f)` }}>
      <span style={{ fontSize: 26 }}>💰</span>
      <span style={{ flex: 1 }}><b style={{ fontSize: 18, color: "#4ade80" }}>{brl(d.total)}</b> <span style={{ fontSize: 13, color: C.textSub }}>gerados pelo QuotaFlow em {d.ano}</span>
        {d.roi && d.roi.vezes >= 1 && <div style={{ fontSize: 12, color: C.muted }}>a assinatura já se pagou {d.roi.vezes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×</div>}</span>
      <span style={{ color: C.accent, fontSize: 12.5 }}>ver ›</span>
    </div>
  );
}
