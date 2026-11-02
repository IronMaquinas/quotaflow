// components/comercial/PainelProspeccao.jsx — etapa 18b: 📣 PROSPECÇÃO POR EVENTO (a tela de trabalho da campanha)
//   clientes ligados ao evento + 💡 sugeridos (contrataram no mesmo período do ano anterior), com os contatos e um toque para
//   💬 WhatsApp (mensagem pronta e editável — sai do aparelho do vendedor, sem custo) · ✉ e-mail · 📞 ligar
//   ✓ registrar o contato (vai para a linha do tempo do cliente, ligado ao evento) · ＋ BID (nasce ligado ao evento)
//   situação: ⚪ a contatar → 💬 contatado → 📝 BID criado · e quantos equipamentos estão livres no período do evento
//   18b.2: cada cliente é uma OPORTUNIDADE — só se encerra com 📝 BID ou ✕ cancelada (motivo obrigatório); 🔕 o evento inteiro
//          18b.5: fonte do painel 1,5 pt maior (leitura).
//          também pode ser cancelado no ano; 18b.4: histórico da campanha por cliente, nome abre o Cliente 360°, 📅 retorno vira ⏰ tarefa;
//          👤 delegar (cliente ou evento) cria tarefa no ✅ Plano que se encerra sozinha aqui.
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";

const dBR = (d) => String(d || "").slice(0, 10).split("-").reverse().join("/");
const quando = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");
const foneWa = (t) => { const d = String(t || "").replace(/\D/g, ""); if (!d) return null; return d.length <= 11 ? `55${d}` : d; };
const SIT = { a_contatar: ["⚪ a contatar", "#94a3b8"], contatado: ["💬 contatado", "#38bdf8"], bid: ["📝 BID criado", "#22c55e"], cancelada: ["✕ cancelada", "#f87171"] };
const MODELO = "Olá, {contato}! Aqui é {voce}, da {empresa}. A {evento} acontece em {data}{local} — vai levar ou buscar equipamentos? Temos conjuntos disponíveis para o transporte. Posso te mandar uma proposta?";

const ICO = { whatsapp: "💬", ligacao: "📞", email: "✉", reuniao: "🤝", nota: "📝", retorno: "📅", delegada: "👤", cancelada: "✕", reaberta: "↩" };
const ROT = { delegada: "Delegada", cancelada: "Cancelada", reaberta: "Reaberta" };
const quandoH = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

export default function PainelProspeccao({ C, s, eventoId, onFechar, onNovoBid, onAbrirBid, onAbrirCliente, onErro, onOk }) {
  const [d, setD] = useState(null); const [msg, setMsg] = useState(null); const [registro, setRegistro] = useState(null); const [ocupado, setOcupado] = useState(false);
  const [verHist, setVerHist] = useState({}); // 18b.4: cliente → histórico aberto
  const [op, setOp] = useState(null); // 18b.2: { tipo: 'cancelar'|'delegar', cliente|null, motivo, responsavel_id, prazo, observacao }
  const carregar = () => apiService.get(`/comercial/eventos/${eventoId}/prospeccao`).then((r) => { setD(r); setMsg((m) => m ?? MODELO); }).catch((e) => { onErro(e.message); onFechar(); });
  useEffect(() => { carregar(); }, [eventoId]); // eslint-disable-line
  if (!d) return null;
  const ev = d.evento;
  const texto = (contato) => (msg || MODELO).replace(/\{contato\}/g, (contato || "").split(" ")[0] || "tudo bem").replace(/\{voce\}/g, (d.voce || "").split(" ")[0] || "a equipe comercial").replace(/\{empresa\}/g, d.empresa || "nossa empresa")
    .replace(/\{evento\}/g, ev.nome).replace(/\{data\}/g, `${dBR(ev.inicio)}${ev.fim && ev.fim !== ev.inicio ? ` a ${dBR(ev.fim)}` : ""}`).replace(/\{local\}/g, ev.cidade ? `, em ${ev.cidade}${ev.uf ? `/${ev.uf}` : ""}` : "");
  const registrar = async () => {
    setOcupado(true);
    try { const txt = registro.texto || `${registro.tipo === "whatsapp" ? "Mensagem no WhatsApp" : registro.tipo === "email" ? "E-mail" : "Ligação"} — ${ev.nome}`;
      await apiService.post("/comercial/atividades", { tipo: registro.tipo, texto: txt, cliente_id: registro.cliente.id, evento_id: ev.id });
      if (registro.retorno) await apiService.post("/comercial/atividades", { tipo: "tarefa", texto: `📅 Retorno — ${registro.cliente.nome} (${ev.nome}): ${txt}`, cliente_id: registro.cliente.id, evento_id: ev.id, prevista_para: registro.retorno });
      onOk(`Contato com ${registro.cliente.nome} registrado${registro.retorno ? ` — retorno em ${dBR(registro.retorno)} nas suas ⏰ tarefas` : ""}.`); setRegistro(null); await carregar(); }
    catch (e) { onErro(e.message); } finally { setOcupado(false); }
  };
  const enviarOp = async (tipo, extra = {}) => {
    setOcupado(true);
    try {
      const alvo = extra.cliente !== undefined ? extra.cliente : op?.cliente;
      const body = { cliente_id: alvo ? alvo.id : undefined, ...(tipo === "cancelar" ? { motivo: op.motivo } : tipo === "delegar" ? { responsavel_id: op.responsavel_id, prazo: op.prazo || undefined, observacao: op.observacao || undefined } : {}) };
      const r = await apiService.post(`/comercial/eventos/${ev.id}/prospeccao/${tipo}`, body);
      const nome = alvo ? alvo.nome : "o evento";
      onOk(tipo === "cancelar" ? `Prospecção de ${nome} cancelada.` : tipo === "reabrir" ? `Prospecção de ${nome} reaberta.` : `Delegado — a tarefa está no ✅ Plano de ${(d.responsaveis || []).find((u) => String(u.id) === String(op.responsavel_id))?.nome || "quem recebeu"}.`);
      setOp(null); if (r?.prospeccao) setD((x) => ({ ...x, ...r.prospeccao })); else await carregar();
    } catch (e) { onErro(e.message); } finally { setOcupado(false); }
  };
  const formOp = (cliente) => op && (op.cliente?.id ?? null) === (cliente?.id ?? null) && <div style={{ ...s.card, padding: 10, marginTop: 8, background: C.bg }}>
    {op.tipo === "cancelar" ? <>
      <div style={{ fontSize: 14, marginBottom: 6 }}>{cliente ? <>✕ Cancelar a prospecção de <b>{cliente.nome}</b></> : <>🔕 Não prospectar <b>{ev.nome}</b> em {d.ano} — encerra todos os clientes em aberto</>}</div>
      <textarea rows={2} autoFocus value={op.motivo || ""} onChange={(e) => setOp({ ...op, motivo: e.target.value })} placeholder="Motivo (obrigatório). Ex.: já fechou com outro transportador; não vai à feira este ano" style={{ ...s.input, resize: "vertical", fontSize: 14 }} />
    </> : <>
      <div style={{ fontSize: 14, marginBottom: 6 }}>👤 Delegar {cliente ? <b>{cliente.nome}</b> : <>a prospecção de <b>{ev.nome}</b> (todos os clientes)</>} — vira tarefa no ✅ Plano e se encerra sozinha {cliente ? "com o BID ou o cancelamento" : "quando todos tiverem BID ou forem cancelados"}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <select value={op.responsavel_id || ""} onChange={(e) => setOp({ ...op, responsavel_id: e.target.value })} style={{ ...s.input, flex: "1 1 200px" }}><option value="">— para quem —</option>{(d.responsaveis || []).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select>
        <input type="date" value={op.prazo || ""} max={ev.fim || undefined} onChange={(e) => setOp({ ...op, prazo: e.target.value })} title="Prazo (vazio = véspera do evento)" style={{ ...s.input, flex: "0 1 170px" }} />
      </div>
      <input value={op.observacao || ""} onChange={(e) => setOp({ ...op, observacao: e.target.value })} placeholder="Observação (opcional). Ex.: cliente grande — falar com o diretor" style={{ ...s.input, marginTop: 6, fontSize: 14 }} />
    </>}
    <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "flex-end" }}><button type="button" onClick={() => setOp(null)} style={acao}>Voltar</button>
      <button type="button" disabled={ocupado || (op.tipo === "cancelar" ? !String(op.motivo || "").trim() : !op.responsavel_id)} onClick={() => enviarOp(op.tipo)} style={{ ...s.btn(true, op.tipo === "cancelar" ? "#ef4444" : undefined), padding: "5px 12px", fontSize: 13.5 }}>{op.tipo === "cancelar" ? "Confirmar cancelamento" : "👤 Delegar"}</button></div>
  </div>;
  const acao = { background: "transparent", border: `1px solid ${C.border}`, color: C.text, borderRadius: 16, padding: "4px 10px", fontSize: 13.5, cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090", zIndex: 320, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }} onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: 1000, maxWidth: "100%", padding: 0, margin: "auto 0", color: C.text, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 19, fontWeight: 800 }}>📣 Prospecção — {ev.nome}</div>
            <div style={{ fontSize: 14, color: C.textSub }}>{ev.tipo_nome}{ev.cidade ? ` · ${ev.cidade}${ev.uf ? `/${ev.uf}` : ""}` : ""} · {dBR(ev.inicio)}{ev.fim && ev.fim !== ev.inicio ? ` a ${dBR(ev.fim)}` : ""} · <b style={{ color: ev.faltam <= 15 ? C.warn : C.text }}>{ev.faltam > 0 ? `faltam ${ev.faltam} dias` : "acontecendo"}</b></div>
          </div>
          {!d.cancelado && <button type="button" onClick={() => setOp({ tipo: "delegar", cliente: null })} style={acao}>👤 Delegar evento</button>}
          {!d.cancelado && <button type="button" onClick={() => setOp({ tipo: "cancelar", cliente: null })} style={{ ...acao, color: "#f87171", borderColor: "#f8717155" }}>🔕 Não prospectar</button>}
          <button type="button" onClick={onFechar} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        {(d.cancelado || d.delegado || (op && !op.cliente)) && <div style={{ padding: "8px 18px", borderBottom: `1px solid ${C.border}`, fontSize: 14 }}>
          {d.cancelado && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", color: "#f87171" }}>🔕 Prospecção cancelada em {d.ano}{d.cancelado.por ? ` por ${d.cancelado.por}` : ""} ({quando(d.cancelado.em)}): <i>{d.cancelado.motivo}</i>
            <button type="button" disabled={ocupado} onClick={() => enviarOp("reabrir", { cliente: null })} style={acao}>↩ Reabrir</button></div>}
          {d.delegado && <div style={{ color: C.textSub }}>👤 Evento delegado a <b>{d.delegado.nome}</b>{d.delegado.prazo ? ` · prazo ${dBR(d.delegado.prazo)}` : ""} — tarefa no ✅ Plano</div>}
          {formOp(null)}
        </div>}
        <div style={{ padding: "10px 18px", display: "flex", gap: 10, flexWrap: "wrap", borderBottom: `1px solid ${C.border}`, fontSize: 14 }}>
          <span style={s.tag(C.accent)}>{d.resumo.contatados} de {d.resumo.total} contatados</span><span style={s.tag(C.success)}>{d.resumo.bids} BID(s)</span>{d.resumo.cancelados > 0 && <span style={s.tag("#f87171")}>{d.resumo.cancelados} cancelado(s)</span>}<span style={{ color: C.textSub }}>{d.resumo.abertos} em aberto</span>
          <span style={{ color: C.textSub }}>🚛 {d.livres.quantos} de {d.livres.de} equipamentos livres no período{d.livres.tags.length ? ` (${d.livres.tags.join(", ")})` : ""}</span>
        </div>
        <div style={{ padding: "10px 18px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ ...s.label, marginBottom: 4 }}>MENSAGEM PRONTA (WHATSAPP / E-MAIL) — {"{contato}"} {"{voce}"} {"{empresa}"} {"{evento}"} {"{data}"} {"{local}"} são trocados sozinhos</div>
          <textarea rows={2} value={msg || ""} onChange={(e) => setMsg(e.target.value)} style={{ ...s.input, resize: "vertical", fontSize: 14 }} />
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Como fica: “{texto(d.clientes[0]?.contatos[0]?.nome)}”</div>
        </div>
        <div style={{ padding: "8px 18px 16px", maxHeight: "60vh", overflowY: "auto" }}>
          {d.clientes.map((c) => { const [sit, cor] = SIT[c.situacao];
            return <div key={c.id} style={{ padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <b className="qf-clicavel" title="Abrir o Cliente 360°" onClick={() => onAbrirCliente?.(c.id)} style={{ fontSize: 16, cursor: onAbrirCliente ? "pointer" : "default", textDecoration: onAbrirCliente ? "underline dotted" : "none" }}>{c.nome}</b>{c.cidade && <span style={{ fontSize: 13.5, color: C.muted }}>{c.cidade}{c.uf ? `/${c.uf}` : ""}</span>}
                <span style={{ fontSize: 12.5, padding: "1px 8px", borderRadius: 10, background: `${cor}22`, color: cor }}>{sit}{c.contatado_em && c.situacao === "contatado" ? ` em ${quando(c.contatado_em)}` : ""}</span>
                {c.sugestao && <span title="Sugerido pelo histórico" style={{ fontSize: 12.5, color: C.warn }}>💡 {c.sugestao}</span>}
                {c.ligado && <span style={{ fontSize: 12.5, color: C.muted }}>👥 ligado ao evento</span>}
                {c.retorno && <span title={c.retorno.para ? `tarefa de ${c.retorno.para}` : ""} style={{ fontSize: 12.5, color: c.retorno.em < new Date().toISOString() ? C.danger : C.warn }}>📅 retorno {quando(c.retorno.em)}</span>}
                {c.delegado && c.situacao !== "bid" && c.situacao !== "cancelada" && <span style={{ fontSize: 12.5, color: C.textSub }}>👤 {c.delegado.nome}{c.delegado.prazo ? ` até ${dBR(c.delegado.prazo)}` : ""}</span>}
                <div style={{ flex: 1 }} />
                {c.bid_campanha ? <button type="button" onClick={() => onAbrirBid(c.bid_campanha.id)} style={acao}>📝 {c.bid_campanha.numero}</button>
                  : c.situacao !== "cancelada" && <button type="button" onClick={() => onNovoBid(c, ev.id)} style={{ ...acao, borderColor: C.accent, color: C.accent }}>＋ BID</button>}
                {c.situacao !== "bid" && c.situacao !== "cancelada" && <>
                  <button type="button" onClick={() => setRegistro({ cliente: c, tipo: "whatsapp", texto: "" })} style={acao}>✓ Registrar contato</button>
                  <button type="button" title="Delegar — vira tarefa no ✅ Plano" onClick={() => setOp({ tipo: "delegar", cliente: c, responsavel_id: c.delegado?.id ? String(c.delegado.id) : "" })} style={acao}>👤</button>
                  <button type="button" title="Cancelar esta oportunidade (com motivo)" onClick={() => setOp({ tipo: "cancelar", cliente: c })} style={{ ...acao, color: "#f87171", borderColor: "#f8717155" }}>✕</button></>}
                {c.situacao === "cancelada" && !c.cancelamento?.do_evento && <button type="button" disabled={ocupado} onClick={() => enviarOp("reabrir", { cliente: c })} style={acao}>↩ Reabrir</button>}
              </div>
              {(() => { const ult = (c.campanha || []).find((h) => ICO[h.tipo] && !ROT[h.tipo] && h.tipo !== "retorno"); const n = (c.campanha || []).length;
                return (ult || n > 0) && <div style={{ fontSize: 13.5, marginTop: 3, color: C.text }}>
                  {ult && <span>{ICO[ult.tipo]} <span style={{ color: C.muted }}>{quandoH(ult.em)}{ult.por ? ` · ${ult.por.split(" ")[0]}` : ""}:</span> {ult.texto}</span>}
                  {n > 0 && <button type="button" onClick={() => setVerHist((v) => ({ ...v, [c.id]: !v[c.id] }))} style={{ background: "none", border: "none", color: C.accent, fontSize: 13, cursor: "pointer", padding: "0 0 0 8px" }}>{verHist[c.id] ? "ocultar ▴" : `ver ${n === 1 ? "o registro" : `os ${n} registros`} da campanha ▾`}</button>}
                </div>; })()}
              {verHist[c.id] && <div style={{ margin: "6px 0 2px 10px", borderLeft: `2px solid ${C.border}`, paddingLeft: 10 }}>
                {(c.campanha || []).map((h, k) => <div key={k} style={{ fontSize: 13.5, padding: "3px 0" }}>
                  <span style={{ color: C.muted }}>{ICO[h.tipo] || "•"} {quandoH(h.em)}{h.por ? ` · ${h.por}` : ""}</span>{" "}
                  {ROT[h.tipo] ? <b>{ROT[h.tipo]}</b> : null}{ROT[h.tipo] && h.texto ? " — " : ""}<span style={{ whiteSpace: "pre-wrap" }}>{h.tipo === "retorno" ? String(h.texto || "").replace(/^📅\s*/, "") : h.texto}</span>
                  {h.tipo === "retorno" && <span style={{ color: h.feita ? C.success : C.warn }}> · {h.feita ? `feito em ${quando(h.feita)}` : `para ${quando(h.prevista)}`}</span>}
                </div>)}
              </div>}
              {c.cancelamento && <div style={{ fontSize: 13, color: "#f87171", marginTop: 2 }}>✕ {c.cancelamento.do_evento ? "Evento cancelado" : "Cancelada"}{c.cancelamento.por ? ` por ${c.cancelamento.por}` : ""} em {quando(c.cancelamento.em)}: {c.cancelamento.motivo}</div>}
              {formOp(c)}
              <div style={{ fontSize: 13, color: C.textSub, marginTop: 2 }}>
                {c.ultimo_bid ? `Último BID: ${c.ultimo_bid.numero}${c.ultimo_bid.em ? ` (${quando(c.ultimo_bid.em)})` : ""}` : "Sem BID ainda"}{c.ultimo_pedido ? ` · último pedido: ${c.ultimo_pedido.numero}` : ""}{c.ultimo_contato ? ` · último contato: ${quando(c.ultimo_contato.em)}${c.ultimo_contato.por ? ` por ${c.ultimo_contato.por}` : ""}` : " · nunca contatado"}
              </div>
              {c.situacao !== "cancelada" && c.contatos.map((x, k) => { const wa = foneWa(x.telefone);
                return <div key={k} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 5, paddingLeft: 10 }}>
                  <span style={{ fontSize: 14, minWidth: 140 }}>👤 {x.nome || "contato"}{x.de !== "cadastro" ? <span style={{ color: C.muted, fontSize: 12.5 }}> · do {x.de}</span> : null}</span>
                  {wa && <a href={`https://wa.me/${wa}?text=${encodeURIComponent(texto(x.nome))}`} target="_blank" rel="noreferrer" onClick={() => setRegistro({ cliente: c, tipo: "whatsapp", texto: `Mensagem no WhatsApp para ${x.nome || x.telefone} — ${ev.nome}` })} style={{ ...acao, background: "#25d366", borderColor: "#25d366", color: "#fff" }}>💬 WhatsApp</a>}
                  {x.telefone && <a href={`tel:${String(x.telefone).replace(/[^\d+]/g, "")}`} onClick={() => setRegistro({ cliente: c, tipo: "ligacao", texto: `Ligação para ${x.nome || x.telefone} — ${ev.nome}` })} style={acao}>📞 {x.telefone}</a>}
                  {x.email && <a href={`mailto:${x.email}?subject=${encodeURIComponent(`${ev.nome} — transporte dos seus equipamentos`)}&body=${encodeURIComponent(texto(x.nome))}`} onClick={() => setRegistro({ cliente: c, tipo: "email", texto: `E-mail para ${x.nome || x.email} — ${ev.nome}` })} style={acao}>✉ {x.email}</a>}
                </div>; })}
              {!c.contatos.length && c.situacao !== "cancelada" && <div style={{ fontSize: 13.5, color: C.warn, marginTop: 4, paddingLeft: 10 }}>Sem telefone nem e-mail — complete o cadastro em 👥 Clientes.</div>}
              {registro?.cliente.id === c.id && <div style={{ ...s.card, padding: 10, marginTop: 8, background: C.bg }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>{[["whatsapp", "💬 WhatsApp"], ["ligacao", "📞 Ligação"], ["email", "✉ E-mail"], ["reuniao", "🤝 Reunião"]].map(([k, r]) => <button key={k} type="button" onClick={() => setRegistro({ ...registro, tipo: k })} style={{ ...acao, background: registro.tipo === k ? C.accent : "transparent", color: registro.tipo === k ? "#fff" : C.text }}>{r}</button>)}</div>
                <textarea rows={2} value={registro.texto} onChange={(e) => setRegistro({ ...registro, texto: e.target.value })} placeholder="Como foi? Ex.: vai levar 2 tratores; pediu proposta até sexta" style={{ ...s.input, resize: "vertical", fontSize: 14 }} />
                <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ fontSize: 13.5, color: C.textSub, display: "flex", gap: 6, alignItems: "center", marginRight: "auto" }}>📅 Retornar em <input type="date" min={new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10)} value={registro.retorno || ""} onChange={(e) => setRegistro({ ...registro, retorno: e.target.value })} style={{ ...s.input, width: 160, padding: "4px 8px", fontSize: 13.5 }} /> <span style={{ color: C.muted }}>(opcional — vira ⏰ tarefa sua)</span></label>
                  <button type="button" onClick={() => setRegistro(null)} style={acao}>Agora não</button>
                  <button type="button" disabled={ocupado} onClick={registrar} style={{ ...s.btn(true), padding: "5px 12px", fontSize: 13.5 }}>✓ Registrar</button></div>
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>Fica na linha do tempo do cliente (👥 Cliente 360°), ligado a esta campanha.</div>
              </div>}
            </div>; })}
          {!d.clientes.length && <div style={{ fontSize: 14.5, color: C.muted, padding: 14, textAlign: "center" }}>Nenhum cliente ligado a este evento e nenhum sugerido pelo histórico. Ligue clientes no cadastro do evento (✏).</div>}
        </div>
      </div>
    </div>
  );
}
