// components/comercial/FichaPedido.jsx — etapa 15c
// 🧾 Ficha do PEDIDO DE VENDA (PV-AAAA-NNNN) — nasce sozinho no aceite do BID.
//   • itens por trecho com STATUS por item (a programar → programado → em execução → concluído | cancelado) — manual até a AT (16a)
//   • próximas execuções (pela data prevista dos itens), origem (BID/versão, quem aceitou, hash)
//   • ➕ ADITIVO PELO LINK: cria o aditivo (PV-…-A1) com os itens atuais → abre a ficha do BID do aditivo (mesmo fluxo da 15b:
//     revisar e enviar, visualizado, resposta por item, código + assinatura). Aceito → o pedido é atualizado sozinho.
//   • histórico de aditivos (o que mudou, valor antes → depois, hash) · 📄 PDF do pedido · ✕ cancelar (com motivo)
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import { abrirBid, prepararJanela, valorCelula } from "../../utils/gerarBid";
import { brl } from "./FichaBid";

const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");
const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "");
export const STATUS_ITEM = { a_programar: ["A programar", "#64748b"], programado: ["Programado", "#3b82f6"], em_execucao: ["Em execução", "#f59e0b"], concluido: ["Concluído", "#22c55e"], cancelado: ["Cancelado", "#ef4444"] };
export const STATUS_PV = { aberto: ["Aberto", "#3b82f6"], em_execucao: ["Em execução", "#f59e0b"], concluido: ["Concluído", "#22c55e"], cancelado: ["Cancelado", "#ef4444"] };

export default function FichaPedido({ C, s, id, onFechar, onMudou, onErro, onOk, onAbrirBid }) {
  const [d, setD] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [cancelar, setCancelar] = useState(null);
  const [confirmarAditivo, setConfirmarAditivo] = useState(false); // 15c.2: pergunta antes de criar
  const carregar = async () => { try { setD(await apiService.get(`/comercial/pvs/${id}`)); } catch (e) { onErro(e.message); onFechar(); } };
  useEffect(() => { carregar(); }, [id]); // eslint-disable-line
  if (!d) return null;
  const pv = d.pv; const ct = pv.conteudo || {}; const cols = ct.colunas || []; const rot = ct.rotulo_grupo || "Grupo";
  const fechado = ["cancelado", "concluido"].includes(pv.status);
  const status = async (item, st) => { setOcupado(true); try { await apiService.post(`/comercial/pvs/${pv.id}/itens/${item}/status`, { status: st }); await carregar(); onMudou?.(); } catch (e) { onErro(e.message); } finally { setOcupado(false); } };
  const aditivo = async () => {
    if (d.aditivo_aberto) return onAbrirBid(d.aditivo_aberto.id);
    if (!confirmarAditivo) return setConfirmarAditivo(true);
    setConfirmarAditivo(false); setOcupado(true);
    try { const r = await apiService.post(`/comercial/pvs/${pv.id}/aditivo`, {}); onOk(`Aditivo ${r.bid.numero} criado — ajuste os itens e envie ao cliente pelo link.`); onMudou?.(); onAbrirBid(r.bid.id); }
    catch (e) { onErro(e.message); } finally { setOcupado(false); }
  };
  const pdf = async () => { const w = prepararJanela(); try { abrirBid(await apiService.get(`/comercial/pvs/${pv.id}/documento`), w); } catch (e) { if (w) w.close(); onErro(e.message); } };
  const fazerCancelar = async () => { setOcupado(true); try { await apiService.post(`/comercial/pvs/${pv.id}/cancelar`, { motivo: cancelar }); onOk("Pedido cancelado."); setCancelar(null); await carregar(); onMudou?.(); } catch (e) { onErro(e.message); } finally { setOcupado(false); } };
  const bt = (c, cheio = true) => ({ ...s.btn(true, c), cursor: "pointer", padding: "7px 12px", fontSize: 12, ...(cheio ? {} : { background: "transparent", color: c }) });
  const resumo = (i) => cols.filter((c) => c.chave !== "data_prevista").map((c) => (i.valores?.[c.chave] != null && i.valores[c.chave] !== "" ? `${c.rotulo}: ${valorCelula(c, i.valores[c.chave])}` : null)).filter(Boolean).slice(0, 5).join(" · ") || "item";
  const [nomeSt, corSt] = STATUS_PV[pv.status] || [pv.status, C.muted];

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090", zIndex: 310, display: "flex", justifyContent: "center", padding: 12, overflowY: "auto" }} onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: 1180, maxWidth: "100%", margin: "auto 0", padding: 0, overflow: "hidden", boxShadow: "0 24px 48px #00000060", color: C.text }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: 17 }}>🧾 {pv.numero}</span><span style={s.tag(corSt)}>{nomeSt}</span>
              {pv.aditivo_atual > 0 && <span style={s.tag("#a78bfa")}>📎 {pv.aditivo_atual} aditivo(s)</span>}
            </div>
            <div style={{ fontSize: 13, color: C.textSub, marginTop: 3 }}><b style={{ color: C.text }}>{pv.cliente_nome}</b>{pv.titulo ? ` · ${pv.titulo}` : ""}{pv.referencia ? ` · ${pv.referencia}` : ""} · {pv.responsavel_nome || "—"}</div>
          </div>
          <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: C.muted }}>VALOR DO PEDIDO</div><div style={{ fontSize: 20, fontWeight: 800 }}>{brl(pv.valor_total)}</div></div>
          <button type="button" onClick={onFechar} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: "10px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" onClick={pdf} style={bt(C.textSub, false)}>📄 PDF do pedido</button>
          {pv.bid_id && <button type="button" onClick={() => onAbrirBid(pv.bid_id)} style={bt(C.textSub, false)}>📝 {pv.bid_numero}</button>}
          <div style={{ flex: 1 }} />
          {!fechado && <button type="button" disabled={ocupado} onClick={aditivo} style={bt(C.accent, !d.aditivo_aberto)}>{d.aditivo_aberto ? `📎 Abrir o aditivo em andamento (${d.aditivo_aberto.fase_nome})` : "➕ Criar aditivo"}</button>}
          {pv.status !== "cancelado" && pv.status !== "concluido" && <button type="button" disabled={ocupado} onClick={() => setCancelar("")} style={bt(C.danger, false)}>✕ Cancelar pedido</button>}
        </div>
        <div style={{ padding: "9px 18px", background: `${C.success}12`, borderBottom: `1px solid ${C.border}`, fontSize: 12.5 }}>
          ✍ Gerado do <b>{pv.bid_numero}</b>{pv.bid_versao ? ` (v${pv.bid_versao})` : ""}, aceito{pv.aceite_nome ? ` por ${pv.aceite_nome}` : ""} em {dataHora(pv.aceite_em)}.
          {d.aditivo_aberto && <> · <span style={{ color: C.warn }}>📎 Aditivo {d.aditivo_aberto.numero} em andamento: {d.aditivo_aberto.fase_nome}</span></>}
          {pv.status === "cancelado" && <span style={{ color: C.danger }}> · Cancelado: {pv.cancelado_motivo}</span>}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap" }}>
          <div style={{ flex: "3 1 600px", minWidth: 0, padding: "14px 18px", borderRight: `1px solid ${C.border}` }}>
            {(pv.grupos || []).map((g, gi) => (
              <div key={g.id} style={{ ...s.card, padding: 12, marginBottom: 12, background: C.bg }}>
                <div style={{ display: "flex", alignItems: "baseline", marginBottom: 8 }}><b style={{ flex: 1, fontSize: 13 }}>{g.titulo || `${rot} ${gi + 1}`}</b><span style={{ fontSize: 12, color: C.textSub }}>Subtotal: <b style={{ color: C.text }}>{brl(g.subtotal)}</b></span></div>
                {(g.itens || []).map((i) => { const st = i.status || "a_programar"; return (
                  <div key={i.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0", borderTop: `1px solid ${C.border}`, flexWrap: "wrap", opacity: st === "cancelado" ? 0.5 : 1 }}>
                    <div style={{ flex: "3 1 260px", fontSize: 12.5 }}>{resumo(i)}{Number(i.quantidade || 1) !== 1 ? ` · qtd ${i.quantidade}` : ""}
                      {i.valores?.data_prevista && <div style={{ fontSize: 11, color: C.textSub }}>📅 previsto {dBR(i.valores.data_prevista)}</div>}</div>
                    <div style={{ fontSize: 12.5, minWidth: 100, textAlign: "right" }}>{i.valor != null ? brl(Number(i.valor) * Number(i.quantidade || 1)) : "—"}</div>
                    <select disabled={ocupado || pv.status === "cancelado"} value={st} onChange={(e) => status(i.id, e.target.value)} style={{ ...s.input, width: 150, padding: "6px 8px", fontSize: 12, color: STATUS_ITEM[st][1], fontWeight: 600 }}>
                      {Object.entries(STATUS_ITEM).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
                  </div>); })}
              </div>))}
            <div style={{ fontSize: 11, color: C.muted }}>O status de cada item é manual por enquanto. Na etapa 16a, a AT de cada trecho passa a atualizar sozinha (programado → em execução → concluído).</div>
          </div>
          <div style={{ flex: "1 1 300px", minWidth: 0, padding: "14px 16px", background: C.bg }}>
            <div style={s.label}>PRÓXIMAS EXECUÇÕES</div>
            {(pv.proximas || []).map((p, k) => <div key={k} style={{ fontSize: 12.5, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}><b>{dBR(p.data)}</b> · {p.grupo ? `${p.grupo} — ` : ""}{p.item} <span style={{ ...s.tag(STATUS_ITEM[p.status]?.[1]), fontSize: 9.5 }}>{STATUS_ITEM[p.status]?.[0]}</span></div>)}
            {!(pv.proximas || []).length && <div style={{ fontSize: 12, color: C.muted }}>Sem datas previstas nos itens.</div>}
            <div style={{ ...s.label, marginTop: 16 }}>ADITIVOS</div>
            {d.aditivos.map((a) => (<div key={a.id} style={{ ...s.card, padding: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 12.5 }}><b>📎 Aditivo {a.numero}</b> · {dataHora(a.aceite_em)}{a.aceite_nome ? ` · ${a.aceite_nome}` : ""}</div>
              <div style={{ fontSize: 12, color: C.textSub }}>{brl(a.valor_antes)} → <b style={{ color: C.text }}>{brl(a.valor_depois)}</b></div>
              <ul style={{ margin: "4px 0 0", paddingLeft: 16, fontSize: 11.5, color: C.textSub }}>{(a.mudancas || []).slice(0, 8).map((m, i) => <li key={i}>{m}</li>)}</ul>
              {a.bid_id && <button type="button" onClick={() => onAbrirBid(a.bid_id)} style={{ background: "none", border: "none", color: C.textSub, textDecoration: "underline", fontSize: 11, cursor: "pointer", padding: 0 }}>abrir o aditivo</button>}
            </div>))}
            {(d.aditivos_recusados || []).map((a) => <div key={a.id} style={{ fontSize: 11.5, color: C.muted, padding: "3px 0" }}>✕ {a.numero} recusado{a.motivo ? `: ${a.motivo}` : ""}</div>)}
            {!d.aditivos.length && !(d.aditivos_recusados || []).length && <div style={{ fontSize: 12, color: C.muted }}>Nenhum aditivo. ➕ Criar aditivo prepara uma alteração para o cliente aprovar pelo link.</div>}
          </div>
        </div>
      </div>
      {confirmarAditivo && <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 340, padding: 16 }} onClick={(e) => { e.stopPropagation(); setConfirmarAditivo(false); }}>
        <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: 480, maxWidth: "100%", padding: "18px 20px" }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Criar um aditivo ao {pv.numero}?</div>
          <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.6 }}>O aditivo começa com os itens atuais do pedido. Você pode <b>incluir, retirar</b> (menos os já programados ou em execução) ou <b>ajustar valores e datas</b>, e depois enviar ao cliente pelo link para ele aprovar e assinar. O pedido só muda quando o cliente aceitar.<br />Enquanto não for enviado, o aditivo pode ser descartado.</div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button type="button" onClick={() => setConfirmarAditivo(false)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Voltar</button>
            <button type="button" disabled={ocupado} onClick={aditivo} style={{ ...s.btn(true, C.accent), flex: 1 }}>➕ Criar aditivo</button>
          </div>
        </div>
      </div>}
      {cancelar !== null && <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 340, padding: 16 }} onClick={(e) => { e.stopPropagation(); setCancelar(null); }}>
        <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: 460, maxWidth: "100%", padding: "18px 20px" }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Cancelar o pedido {pv.numero}?</div>
          <div style={{ fontSize: 13, color: C.textSub, marginBottom: 8 }}>Só é possível sem itens em execução ou concluídos. O motivo fica registrado.</div>
          <textarea rows={2} value={cancelar} onChange={(e) => setCancelar(e.target.value)} placeholder="Motivo (mínimo 10 caracteres)" style={{ ...s.input, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button type="button" onClick={() => setCancelar(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Voltar</button>
            <button type="button" disabled={ocupado || cancelar.trim().length < 10} onClick={fazerCancelar} style={{ ...s.btn(cancelar.trim().length >= 10, C.danger), flex: 1 }}>Cancelar pedido</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
