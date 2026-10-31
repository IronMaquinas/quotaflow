// components/comercial/PainelProspeccao.jsx — etapa 18b: 📣 PROSPECÇÃO POR EVENTO (a tela de trabalho da campanha)
//   clientes ligados ao evento + 💡 sugeridos (contrataram no mesmo período do ano anterior), com os contatos e um toque para
//   💬 WhatsApp (mensagem pronta e editável — sai do aparelho do vendedor, sem custo) · ✉ e-mail · 📞 ligar
//   ✓ registrar o contato (vai para a linha do tempo do cliente, ligado ao evento) · ＋ BID (nasce ligado ao evento)
//   situação: ⚪ a contatar → 💬 contatado → 📝 BID criado · e quantos equipamentos estão livres no período do evento
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";

const dBR = (d) => String(d || "").slice(0, 10).split("-").reverse().join("/");
const quando = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");
const foneWa = (t) => { const d = String(t || "").replace(/\D/g, ""); if (!d) return null; return d.length <= 11 ? `55${d}` : d; };
const SIT = { a_contatar: ["⚪ a contatar", "#94a3b8"], contatado: ["💬 contatado", "#38bdf8"], bid: ["📝 BID criado", "#22c55e"] };
const MODELO = "Olá, {contato}! Aqui é {voce}, da {empresa}. A {evento} acontece em {data}{local} — vai levar ou buscar equipamentos? Temos conjuntos disponíveis para o transporte. Posso te mandar uma proposta?";

export default function PainelProspeccao({ C, s, eventoId, onFechar, onNovoBid, onAbrirBid, onErro, onOk }) {
  const [d, setD] = useState(null); const [msg, setMsg] = useState(null); const [registro, setRegistro] = useState(null); const [ocupado, setOcupado] = useState(false);
  const carregar = () => apiService.get(`/comercial/eventos/${eventoId}/prospeccao`).then((r) => { setD(r); setMsg((m) => m ?? MODELO); }).catch((e) => { onErro(e.message); onFechar(); });
  useEffect(() => { carregar(); }, [eventoId]); // eslint-disable-line
  if (!d) return null;
  const ev = d.evento;
  const texto = (contato) => (msg || MODELO).replace(/\{contato\}/g, (contato || "").split(" ")[0] || "tudo bem").replace(/\{voce\}/g, (d.voce || "").split(" ")[0] || "a equipe comercial").replace(/\{empresa\}/g, d.empresa || "nossa empresa")
    .replace(/\{evento\}/g, ev.nome).replace(/\{data\}/g, `${dBR(ev.inicio)}${ev.fim && ev.fim !== ev.inicio ? ` a ${dBR(ev.fim)}` : ""}`).replace(/\{local\}/g, ev.cidade ? `, em ${ev.cidade}${ev.uf ? `/${ev.uf}` : ""}` : "");
  const registrar = async () => {
    setOcupado(true);
    try { await apiService.post("/comercial/atividades", { tipo: registro.tipo, texto: registro.texto || `${registro.tipo === "whatsapp" ? "Mensagem no WhatsApp" : registro.tipo === "email" ? "E-mail" : "Ligação"} — ${ev.nome}`, cliente_id: registro.cliente.id, evento_id: ev.id });
      onOk(`Contato com ${registro.cliente.nome} registrado.`); setRegistro(null); await carregar(); }
    catch (e) { onErro(e.message); } finally { setOcupado(false); }
  };
  const acao = { background: "transparent", border: `1px solid ${C.border}`, color: C.text, borderRadius: 16, padding: "4px 10px", fontSize: 12, cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090", zIndex: 320, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }} onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: 900, maxWidth: "100%", padding: 0, margin: "auto 0", color: C.text, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>📣 Prospecção — {ev.nome}</div>
            <div style={{ fontSize: 12.5, color: C.textSub }}>{ev.tipo_nome}{ev.cidade ? ` · ${ev.cidade}${ev.uf ? `/${ev.uf}` : ""}` : ""} · {dBR(ev.inicio)}{ev.fim && ev.fim !== ev.inicio ? ` a ${dBR(ev.fim)}` : ""} · <b style={{ color: ev.faltam <= 15 ? C.warn : C.text }}>{ev.faltam > 0 ? `faltam ${ev.faltam} dias` : "acontecendo"}</b></div>
          </div>
          <button type="button" onClick={onFechar} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: "10px 18px", display: "flex", gap: 10, flexWrap: "wrap", borderBottom: `1px solid ${C.border}`, fontSize: 12.5 }}>
          <span style={s.tag(C.accent)}>{d.resumo.contatados} de {d.resumo.total} contatados</span><span style={s.tag(C.success)}>{d.resumo.bids} BID(s)</span>
          <span style={{ color: C.textSub }}>🚛 {d.livres.quantos} de {d.livres.de} equipamentos livres no período{d.livres.tags.length ? ` (${d.livres.tags.join(", ")})` : ""}</span>
        </div>
        <div style={{ padding: "10px 18px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ ...s.label, marginBottom: 4 }}>MENSAGEM PRONTA (WHATSAPP / E-MAIL) — {"{contato}"} {"{voce}"} {"{empresa}"} {"{evento}"} {"{data}"} {"{local}"} são trocados sozinhos</div>
          <textarea rows={2} value={msg || ""} onChange={(e) => setMsg(e.target.value)} style={{ ...s.input, resize: "vertical", fontSize: 12.5 }} />
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>Como fica: “{texto(d.clientes[0]?.contatos[0]?.nome)}”</div>
        </div>
        <div style={{ padding: "8px 18px 16px", maxHeight: "60vh", overflowY: "auto" }}>
          {d.clientes.map((c) => { const [sit, cor] = SIT[c.situacao];
            return <div key={c.id} style={{ padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <b style={{ fontSize: 14 }}>{c.nome}</b>{c.cidade && <span style={{ fontSize: 12, color: C.muted }}>{c.cidade}{c.uf ? `/${c.uf}` : ""}</span>}
                <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 10, background: `${cor}22`, color: cor }}>{sit}{c.contatado_em && c.situacao === "contatado" ? ` em ${quando(c.contatado_em)}` : ""}</span>
                {c.sugestao && <span title="Sugerido pelo histórico" style={{ fontSize: 11, color: C.warn }}>💡 {c.sugestao}</span>}
                {c.ligado && <span style={{ fontSize: 11, color: C.muted }}>👥 ligado ao evento</span>}
                <div style={{ flex: 1 }} />
                {c.bid_campanha ? <button type="button" onClick={() => onAbrirBid(c.bid_campanha.id)} style={acao}>📝 {c.bid_campanha.numero}</button>
                  : <button type="button" onClick={() => onNovoBid(c, ev.id)} style={{ ...acao, borderColor: C.accent, color: C.accent }}>＋ BID</button>}
                <button type="button" onClick={() => setRegistro({ cliente: c, tipo: "whatsapp", texto: "" })} style={acao}>✓ Registrar contato</button>
              </div>
              <div style={{ fontSize: 11.5, color: C.textSub, marginTop: 2 }}>
                {c.ultimo_bid ? `Último BID: ${c.ultimo_bid.numero} (${quando(c.ultimo_bid.em)})` : "Sem BID ainda"}{c.ultimo_pedido ? ` · último pedido: ${c.ultimo_pedido.numero}` : ""}{c.ultimo_contato ? ` · último contato: ${quando(c.ultimo_contato.em)}${c.ultimo_contato.por ? ` por ${c.ultimo_contato.por}` : ""}` : " · nunca contatado"}
              </div>
              {c.contatos.map((x, k) => { const wa = foneWa(x.telefone);
                return <div key={k} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 5, paddingLeft: 10 }}>
                  <span style={{ fontSize: 12.5, minWidth: 140 }}>👤 {x.nome || "contato"}{x.de !== "cadastro" ? <span style={{ color: C.muted, fontSize: 11 }}> · do {x.de}</span> : null}</span>
                  {wa && <a href={`https://wa.me/${wa}?text=${encodeURIComponent(texto(x.nome))}`} target="_blank" rel="noreferrer" onClick={() => setRegistro({ cliente: c, tipo: "whatsapp", texto: `Mensagem no WhatsApp para ${x.nome || x.telefone} — ${ev.nome}` })} style={{ ...acao, background: "#25d366", borderColor: "#25d366", color: "#fff" }}>💬 WhatsApp</a>}
                  {x.telefone && <a href={`tel:${String(x.telefone).replace(/[^\d+]/g, "")}`} onClick={() => setRegistro({ cliente: c, tipo: "ligacao", texto: `Ligação para ${x.nome || x.telefone} — ${ev.nome}` })} style={acao}>📞 {x.telefone}</a>}
                  {x.email && <a href={`mailto:${x.email}?subject=${encodeURIComponent(`${ev.nome} — transporte dos seus equipamentos`)}&body=${encodeURIComponent(texto(x.nome))}`} onClick={() => setRegistro({ cliente: c, tipo: "email", texto: `E-mail para ${x.nome || x.email} — ${ev.nome}` })} style={acao}>✉ {x.email}</a>}
                </div>; })}
              {!c.contatos.length && <div style={{ fontSize: 12, color: C.warn, marginTop: 4, paddingLeft: 10 }}>Sem telefone nem e-mail — complete o cadastro em 👥 Clientes.</div>}
              {registro?.cliente.id === c.id && <div style={{ ...s.card, padding: 10, marginTop: 8, background: C.bg }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>{[["whatsapp", "💬 WhatsApp"], ["ligacao", "📞 Ligação"], ["email", "✉ E-mail"], ["reuniao", "🤝 Reunião"]].map(([k, r]) => <button key={k} type="button" onClick={() => setRegistro({ ...registro, tipo: k })} style={{ ...acao, background: registro.tipo === k ? C.accent : "transparent", color: registro.tipo === k ? "#fff" : C.text }}>{r}</button>)}</div>
                <textarea rows={2} value={registro.texto} onChange={(e) => setRegistro({ ...registro, texto: e.target.value })} placeholder="Como foi? Ex.: vai levar 2 tratores; pediu proposta até sexta" style={{ ...s.input, resize: "vertical", fontSize: 12.5 }} />
                <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "flex-end" }}><button type="button" onClick={() => setRegistro(null)} style={acao}>Agora não</button>
                  <button type="button" disabled={ocupado} onClick={registrar} style={{ ...s.btn(true), padding: "5px 12px", fontSize: 12 }}>✓ Registrar</button></div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Fica na linha do tempo do cliente (👥 Cliente 360°), ligado a esta campanha.</div>
              </div>}
            </div>; })}
          {!d.clientes.length && <div style={{ fontSize: 13, color: C.muted, padding: 14, textAlign: "center" }}>Nenhum cliente ligado a este evento e nenhum sugerido pelo histórico. Ligue clientes no cadastro do evento (✏).</div>}
        </div>
      </div>
    </div>
  );
}
