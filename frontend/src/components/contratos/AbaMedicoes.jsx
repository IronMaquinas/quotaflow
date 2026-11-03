// components/contratos/AbaMedicoes.jsx — etapa 18d.5: 📏 aba Medições (em 📑 Contratos)
//   • resumo: valor mensal em locação · contratos ativos · para revisar e enviar · aguardando o cliente · medido no mês anterior · vencendo em 60 dias
//   • para agir: medições prontas / contestadas / aguardando o cliente
//   • histórico: período (pré-seletores) + contrato + cliente + equipamento — cada linha abre a medição
import { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";
import MedicaoModal, { corStatusMedicao } from "./MedicaoModal";
import FiltroPeriodo, { faixaPeriodo } from "../shared/FiltroPeriodo";

const dataBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const compacto = (v) => { const n = Number(v || 0); return n >= 1e6 ? `R$ ${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : n >= 1e4 ? `R$ ${(n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil` : brl(n); };
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default function AbaMedicoes({ C, s, editar, filtroContrato = null, onFiltroUsado, onMudou, onErro, onOk }) {
  const [d, setD] = useState(null); const [aberta, setAberta] = useState(null);
  const [per, setPer] = useState(() => faixaPeriodo("ano"));
  const [fc, setFc] = useState(filtroContrato ? String(filtroContrato) : ""); const [fcli, setFcli] = useState(""); const [feq, setFeq] = useState("");
  const carregar = async () => { try { setD(await apiService.get("/contratos/medicoes/painel")); } catch (e) { onErro(e.message); } };
  useEffect(() => { carregar(); }, []); // eslint-disable-line
  useEffect(() => { if (filtroContrato) { setFc(String(filtroContrato)); setPer(faixaPeriodo("tudo")); onFiltroUsado?.(); } }, [filtroContrato]); // eslint-disable-line
  const hist = useMemo(() => (d?.historico || []).filter((h) => (!per.de || (h.inicio <= per.ate && h.fim >= per.de)) && (!fc || String(h.contrato_id) === fc) && (!fcli || h.cliente === fcli)
    && (!feq || h.itens.some((i) => String(i.equipamento_id) === feq))), [d, per, fc, fcli, feq]);
  if (!d) return <div style={{ color: C.muted }}>Carregando…</div>;
  const r = d.resumo; const ma = r.mes_anterior; const [ano, mm] = ma.mes.split("-");
  const card = (rot, val, sub, cor, onClick) => <div className={onClick ? "qf-clicavel" : undefined} onClick={onClick} style={{ ...s.card, padding: "12px 14px", flex: "1 1 170px", minWidth: 0, cursor: onClick ? "pointer" : "default" }}>
    <div style={{ fontSize: 10.5, color: C.muted, letterSpacing: ".06em" }}>{rot}</div><div style={{ fontSize: 20, fontWeight: 800, color: cor || C.text, marginTop: 2 }}>{val}</div>{sub && <div style={{ fontSize: 11.5, color: C.textSub, marginTop: 2 }}>{sub}</div>}</div>;
  const totalHist = hist.reduce((t, h) => t + (feq ? h.itens.filter((i) => String(i.equipamento_id) === feq).reduce((x, i) => x + Number(i.valor || 0), 0) : h.total), 0);
  const sel = { ...s.input, padding: "6px 8px", fontSize: 13, width: "auto", minWidth: 170 };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {card("VALOR MENSAL EM LOCAÇÃO", compacto(r.valor_mensal), `${r.equipamentos} equipamento(s) locado(s) hoje`, C.success)}
        {card("CONTRATOS ATIVOS", r.contratos_ativos, r.vencendo ? `${r.vencendo} vencendo em 60 dias` : "nenhum vencendo em 60 dias", r.vencendo ? C.warn : undefined)}
        {card("PARA REVISAR E ENVIAR", r.para_revisar, r.contestadas ? `${r.contestadas} contestada(s) pelo cliente` : "medições prontas", r.contestadas ? C.danger : r.para_revisar ? C.accent : undefined)}
        {card("AGUARDANDO O CLIENTE", r.aguardando, r.aguardando ? compacto(r.aguardando_valor) : "nada pendente", r.aguardando ? C.warn : undefined)}
        {card(`MEDIDO EM ${MES[Number(mm) - 1].toUpperCase()}/${ano}`, compacto(ma.medido), `${ma.fechadas} de ${ma.total} fechada(s) · previsto ${compacto(ma.previsto)}`)}
      </div>
      {r.vencendo_lista.length > 0 && <div style={{ fontSize: 12.5, color: C.warn, marginBottom: 10 }}>⏳ Vencendo em 60 dias: {r.vencendo_lista.map((c) => `${c.numero} · ${c.cliente} (${dataBR(c.fim_previsto)})`).join(" · ")}</div>}

      <div style={{ ...s.card, padding: "10px 14px", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>📏 Para agir ({d.pendencias.length})</div>
        {d.pendencias.map((x) => <div key={x.medicao_id} className="qf-clicavel" onClick={() => setAberta(x.medicao_id)} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderTop: `1px solid ${C.border}`, fontSize: 13.5, cursor: "pointer", flexWrap: "wrap" }}>
          <span style={{ flex: "1 1 240px" }}><b>{x.numero}</b> · {x.cliente} · {x.rotulo}</span><span style={{ color: C.textSub }}>{brl(x.total_cobrar)}</span>
          <span style={s.tag(corStatusMedicao(x.status))}>{x.status === "aberta" ? (x.medicao_locatario ? "pronta — revisar e enviar" : "pronta — revisar e fechar") : x.status_nome}</span><span style={{ color: C.accent }}>abrir ›</span></div>)}
        {!d.pendencias.length && <div style={{ fontSize: 13, color: C.muted, padding: "4px 0" }}>Nada pendente. A medição do mês aparece nos últimos 10 dias do ciclo.</div>}
      </div>

      <div style={{ ...s.card, padding: "10px 14px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginRight: 6 }}>📜 Histórico</div>
          <FiltroPeriodo C={C} s={s} valor={per} onChange={setPer} comTudo />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <select value={fc} onChange={(e) => setFc(e.target.value)} style={sel}><option value="">Todos os contratos</option>{d.opcoes.contratos.map((c) => <option key={c.id} value={c.id}>{c.numero} · {c.cliente}</option>)}</select>
          <select value={fcli} onChange={(e) => setFcli(e.target.value)} style={sel}><option value="">Todos os clientes</option>{d.opcoes.clientes.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <select value={feq} onChange={(e) => setFeq(e.target.value)} style={sel}><option value="">Todos os equipamentos</option>{d.opcoes.equipamentos.map((e) => <option key={e.id} value={e.id}>{e.tag} — {e.nome}</option>)}</select>
          {(fc || fcli || feq) && <button type="button" onClick={() => { setFc(""); setFcli(""); setFeq(""); }} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 13 }}>limpar filtros</button>}
          <div style={{ flex: 1 }} /><span style={{ fontSize: 13, color: C.textSub }}>{hist.length} medição(ões) · <b style={{ color: C.text }}>{brl(totalHist)}</b>{feq ? " (só o equipamento)" : ""}</span>
        </div>
        {hist.map((h) => { const it = feq ? h.itens.find((i) => String(i.equipamento_id) === feq) : null;
          return <div key={h.medicao_id} className="qf-clicavel" onClick={() => setAberta(h.medicao_id)} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0", borderTop: `1px solid ${C.border}`, fontSize: 13.5, cursor: "pointer", flexWrap: "wrap" }}>
            <span style={{ width: 80, fontWeight: 700 }}>{h.rotulo}</span>
            <span style={{ flex: "1 1 220px" }}>{h.numero} · {h.cliente}<span style={{ color: C.muted }}> · {it ? `${it.tag}${it.dias < it.dias_ciclo ? ` · ${it.dias}/${it.dias_ciclo} dias` : ""}` : `${h.itens.length} equipamento(s)`}</span></span>
            <b>{brl(it ? it.valor : h.total)}</b><span style={s.tag(corStatusMedicao(h.status))}>{h.status_nome}</span></div>; })}
        {!hist.length && <div style={{ fontSize: 13, color: C.muted, padding: "6px 0" }}>Nenhuma medição com esses filtros.</div>}
      </div>
      {aberta && <MedicaoModal C={C} s={s} medicaoId={aberta} podeEditar={editar} onFechar={() => setAberta(null)} onMudou={() => { carregar(); onMudou?.(); }} onErro={onErro} onOk={onOk} />}
    </div>
  );
}
