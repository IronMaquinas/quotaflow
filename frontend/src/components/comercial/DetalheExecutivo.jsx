// components/comercial/DetalheExecutivo.jsx — etapa 18b.9: a composição "viva" dos cards da visão do dono
//   carteira (contratos de locação + pedidos em curso) · receita do ano (realizado × previsto) · em jogo (BIDs) · perdido (por motivo + BIDs)
//   cada item abre o que é: BID, pedido de venda ou contrato. Busca quando a lista passa de 10.
import { useState } from "react";

const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "");
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const FASE = { elaboracao: "Elaboração", aguardando_cliente: "Aguardando o cliente", revisao_solicitada: "Revisão solicitada", aguardando_aceite: "Aguardando aceite", aceito: "Aceito", perdido: "Perdido" };
const STATUS_PV = { aberto: "Aberto", em_execucao: "Em execução" };
const TITULO = { carteira: "💼 Carteira contratada", receita: "📈 Receita do ano", em_jogo: "🎯 Em jogo — BIDs em andamento", perdido: "✕ Perdido no período" };

export default function DetalheExecutivo({ C, s, qual, x, periodo, podeContratos, onFechar, onAbrirBid, onAbrirPV }) {
  const [busca, setBusca] = useState("");
  const it = x.itens || {};
  const filtra = (l) => (!busca.trim() ? l : l.filter((i) => semAcento([i.numero, i.cliente, i.titulo, i.motivo].join(" ")).includes(semAcento(busca))));
  const secao = (titulo, total, l, linha, vazio) => <div style={{ marginTop: 14 }}>
    <div style={{ display: "flex", alignItems: "baseline", borderBottom: `1px solid ${C.border}`, paddingBottom: 4, marginBottom: 2 }}>
      <b style={{ flex: 1, fontSize: 13, letterSpacing: ".04em", color: C.textSub }}>{titulo} <span style={{ color: C.muted, fontWeight: 400 }}>({l.length})</span></b><b style={{ fontSize: 14 }}>{total}</b></div>
    {filtra(l).map(linha)}
    {!l.length && <div style={{ fontSize: 13, color: C.muted, padding: "6px 0" }}>{vazio}</div>}
  </div>;
  const L = ({ onClick, titulo, sub, valor, cor, extra }) => <div className={onClick ? "qf-clicavel" : undefined} onClick={onClick} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 2px", borderBottom: `1px solid ${C.border}`, cursor: onClick ? "pointer" : "default", fontSize: 14 }}>
    <div style={{ flex: 1, minWidth: 0 }}><div>{titulo}</div>{sub && <div style={{ fontSize: 12.5, color: C.textSub }}>{sub}</div>}</div>
    {extra}<b style={{ color: cor || C.text, whiteSpace: "nowrap" }}>{valor}</b>{onClick && <span style={{ color: C.accent }}>›</span>}</div>;
  const bid = (b, sub, valor) => <L key={`b${b.id}`} onClick={() => onAbrirBid(b.id)} titulo={<>📝 <b>{b.numero}</b>{b.cliente ? ` · ${b.cliente}` : ""}{b.titulo ? <span style={{ color: C.muted }}> — {b.titulo}</span> : null}</>} sub={sub} valor={valor ?? brl(b.valor)} />;
  const contrato = (c, sub, valor) => <L key={`c${c.contrato_id}${c.numero}`} onClick={podeContratos && c.contrato_id ? () => window.dispatchEvent(new CustomEvent("qf-abrir-contrato", { detail: c.contrato_id })) : undefined}
    titulo={<>📑 <b>{c.numero || "locação avulsa"}</b>{c.cliente ? ` · ${c.cliente}` : ""}</>} sub={sub} valor={valor} />;
  const pv = (p) => <L key={`p${p.id}`} onClick={() => onAbrirPV(p.id)} titulo={<>🧾 <b>{p.numero}</b>{p.cliente ? ` · ${p.cliente}` : ""}{p.titulo ? <span style={{ color: C.muted }}> — {p.titulo}</span> : null}</>} sub={STATUS_PV[p.status] || p.status} valor={brl(p.valor)} />;
  const qtd = { carteira: (it.contratos || []).length + (it.pedidos || []).length, receita: (it.aceitos_ano || []).length + (it.contratos_ano || []).length + (it.bids_ano || []).length, em_jogo: (it.em_jogo || []).length, perdido: (it.perdidos || []).length }[qual];
  const r = x.receita_ano;
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090", zIndex: 330, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }} onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: 860, maxWidth: "100%", margin: "auto 0", padding: "16px 20px", color: C.text }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 19, fontWeight: 800 }}>{TITULO[qual]}{qual === "receita" ? ` ${r.ano}` : ""}</div>
            <div style={{ fontSize: 13, color: C.textSub }}>{qual === "perdido" ? `${dBR(periodo.de)} a ${dBR(periodo.ate)}` : qual === "receita" ? "realizado + previsto (só receita)" : "situação de hoje"}</div></div>
          <div style={{ fontSize: 22, fontWeight: 800, color: { carteira: C.success, receita: C.accent, perdido: x.perdido.qtd ? C.danger : C.text }[qual] || C.text }}>
            {brl({ carteira: x.carteira.valor, receita: r.total, em_jogo: x.em_jogo.valor, perdido: x.perdido.valor }[qual])}</div>
          <button type="button" onClick={onFechar} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        {qual === "receita" && <div style={{ fontSize: 13.5, color: C.textSub, marginTop: 6 }}>= realizado <b style={{ color: C.text }}>{brl(r.realizado)}</b> (vendido {brl(r.vendido)} + locação {brl(r.locacao_realizada)}) + previsto <b style={{ color: C.text }}>{brl(r.previsto)}</b> (locação {brl(r.locacao_prevista)} + BIDs {brl(r.bids_previstos)}{r.conversao_pct != null ? `, à conversão de ${String(r.conversao_pct).replace(".", ",")}%` : ", sem conversão no ano"})</div>}
        {qual === "em_jogo" && x.em_jogo.ponderado != null && <div style={{ fontSize: 13.5, color: C.textSub, marginTop: 6 }}>Ponderado pela conversão do ano: <b style={{ color: C.text }}>{brl(x.em_jogo.ponderado)}</b></div>}
        {qtd > 10 && <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar cliente, número ou título…" style={{ ...s.input, marginTop: 10, fontSize: 14 }} />}
        <div style={{ maxHeight: "65vh", overflowY: "auto" }}>
          {qual === "carteira" && <>
            {secao("LOCAÇÃO — A RECEBER", brl(x.carteira.locacao_restante), it.contratos || [], (c) => contrato(c, `${brl(c.mensal)}/mês · ${c.equipamentos} equipamento(s) · ${c.sem_fim ? "⚠ sem fim previsto (conta 12 meses)" : `até ${dBR(c.fim_previsto)}`}`, brl(c.a_receber)), "Nenhuma locação ativa com valor mensal.")}
            {secao("PEDIDOS EM CURSO", brl(x.carteira.pedidos_valor), it.pedidos || [], pv, "Nenhum pedido aberto ou em execução.")}
          </>}
          {qual === "receita" && <>
            {secao("REALIZADO — BIDS ACEITOS NO ANO", brl(r.vendido), it.aceitos_ano || [], (b) => bid(b, `aceito em ${dBR(b.em)}`), "Nenhum BID aceito no ano.")}
            {secao("LOCAÇÃO NO ANO (CORRIDA + ATÉ 31/12)", brl(r.locacao_realizada + r.locacao_prevista), it.contratos_ano || [], (c) => contrato(c, `corrida ${brl(c.realizado_ano)} · prevista até dez ${brl(c.previsto_ano)}`, brl(c.realizado_ano + c.previsto_ano)), "Nenhuma locação com valor no ano.")}
            {secao(`PREVISTO — BIDS COM DECISÃO NO ANO × CONVERSÃO`, brl(r.bids_previstos), it.bids_ano || [], (b) => bid(b, `${FASE[b.fase] || b.fase} · decisão ${dBR(b.decisao)} · cheio ${brl(b.valor)}`, brl(b.ponderado)), "Nenhum BID em aberto com decisão esperada até 31/12.")}
          </>}
          {qual === "em_jogo" && secao("BIDS EM ANDAMENTO", brl(x.em_jogo.valor), it.em_jogo || [], (b) => bid(b, <>{FASE[b.fase] || b.fase}{b.dias_na_fase != null ? ` · ${b.dias_na_fase} d na fase` : ""}{b.decisao ? ` · decisão ${dBR(b.decisao)}` : " · sem data de decisão"}
            {b.atrasado && <span style={{ color: C.danger }}> · decisão vencida</span>}{b.vencido && <span style={{ color: C.danger }}> · proposta vencida</span>}</>), "Nenhum BID em andamento.")}
          {qual === "perdido" && <>
            {secao("POR MOTIVO", brl(x.perdido.valor), it.motivos || [], (m) => <L key={m.motivo} titulo={m.nome} sub={`${m.qtd} BID(s)`} valor={brl(m.valor)} cor={C.danger} />, "Nenhum BID perdido no período.")}
            {secao("BIDS PERDIDOS", brl(x.perdido.valor), it.perdidos || [], (b) => bid(b, <>{b.motivo || "sem motivo"} · {dBR(b.em)}{b.obs ? <i> — {b.obs}</i> : null}</>), "—")}
          </>}
        </div>
      </div>
    </div>
  );
}
