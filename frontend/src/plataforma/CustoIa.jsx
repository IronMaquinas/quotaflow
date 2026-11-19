// plataforma/CustoIa.jsx — etapa B5.0: 💲 custo da IA por empresa (estimado) + interruptores da voz da Beta e teto mensal
//   Por empresa: 🎤 no chat · 🔊 no chat (voz do navegador, custo zero) · modo Conversa (desligado / neural / ao vivo) · cortesia até · teto R$/mês da voz paga.
//   Teto: 80% → alerta aqui; 100% → a voz paga volta para a do navegador até o mês virar (a Beta continua funcionando).
import { useEffect, useState } from "react";
import { Toggle } from "./ModulosPlataforma";
const brl = (n) => { const v = Number(n) || 0; return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: v > 0 && v < 0.1 ? 3 : 2, maximumFractionDigits: v > 0 && v < 0.1 ? 3 : 2 }); }; // B5.3: centavos pequenos não somem
const MODOS = [["desligado", "Desligado"], ["neural", "Voz neural"], ["ao_vivo", "Ao vivo (tempo real)"]];
const ROT = { beta: "Beta (texto)", "beta:rot": "Beta — roteador", "beta:painel": "Beta — visão geral", voz_falar: "Voz — fala", voz_ouvir: "Voz — escuta" };

export default function CustoIa({ token, chamar, C, card, btn, tag, input, onAviso }) {
  const [mes, setMes] = useState(() => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7)); const [d, setD] = useState(null); const [ed, setEd] = useState(null); const [ab, setAb] = useState(null);
  const carregar = () => chamar(token, "GET", `/ia-custos?mes=${mes}`).then(setD).catch((e) => onAviso({ tipo: "erro", texto: e.message }));
  useEffect(() => { setD(null); carregar(); }, [mes]); // eslint-disable-line
  const salvar = async (id, cfg) => { try { await chamar(token, "PUT", `/transportadoras/${id}/ia-config`, cfg); onAviso({ tipo: "ok", texto: "Configuração de IA salva." }); setEd(null); carregar(); } catch (e) { onAviso({ tipo: "erro", texto: e.message }); } };
  const alertas = (d?.itens || []).filter((i) => i.alerta);
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>💲 Custo de IA por empresa</div>
      <div style={{ fontSize: 13, color: C.sub, marginBottom: 14 }}>Estimativa pelo uso registrado (tokens, caracteres falados, segundos ouvidos) × tabela de preços do servidor (IA_PRECOS) × câmbio {d ? `R$ ${String(d.cambio).replace(".", ",")}` : ""}. 🎤/🔊 no chat usam a voz do navegador — custo zero. A voz paga é só do modo Conversa e respeita o teto.</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} style={{ ...input, width: 170 }} />
        {d && <><span style={tag(C.accent)}>Total {brl(d.total)}</span><span style={tag(C.sub)}>Texto {brl(d.total_texto)}</span><span style={tag("#a78bfa")}>Voz {brl(d.total_voz)}</span></>}
      </div>
      {alertas.length > 0 && <div style={{ ...card, padding: 12, marginBottom: 12, borderColor: C.warn, color: C.warn, fontSize: 13 }}>⚠ {alertas.map((a) => `${a.empresa}: ${a.teto_pct}% do teto de voz${a.alerta === "teto" ? " (voz paga pausada até o mês virar)" : ""}`).join(" · ")}</div>}
      {!d ? <div style={{ color: C.sub }}>Carregando…</div> : (
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          {d.itens.map((i, k) => (
            <div key={i.id} style={{ padding: "12px 16px", borderTop: k ? `1px solid ${C.border}` : "none" }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{i.empresa}</div>
                  <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>🎤 chat {i.config.chat_mic ? "ligado" : "desligado"} · 🔊 chat {i.config.chat_fala ? "ligado" : "desligado"} · 🚗 Conversa: {MODOS.find((m) => m[0] === i.modo)?.[1]}{i.em_cortesia ? ` (cortesia até ${i.config.cortesia_ate.split("-").reverse().join("/")})` : ""}</div>
                </div>
                <div style={{ textAlign: "right", fontSize: 12.5, minWidth: 210 }}>
                  <div><b style={{ fontSize: 14 }}>{brl(i.total)}</b> <span style={{ color: C.sub }}>· {i.chamadas} uso(s)</span></div>
                  <div style={{ color: C.sub }}>texto {brl(i.texto)} · voz {brl(i.voz)} / teto {brl(i.config.teto_mes_brl)}</div>
                  <div style={{ height: 5, borderRadius: 3, background: C.border, marginTop: 4, overflow: "hidden" }}><div style={{ width: `${Math.min(100, i.teto_pct)}%`, height: "100%", background: i.alerta === "teto" ? C.danger : i.alerta ? C.warn : "#22c55e" }} /></div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {Object.keys(i.recursos).length > 0 && <button onClick={() => setAb(ab === i.id ? null : i.id)} style={{ ...btn(C.muted, false), cursor: "pointer", fontSize: 12 }}>Detalhe</button>}
                  <button onClick={() => setEd(ed?.id === i.id ? null : { id: i.id, ...i.config })} style={{ ...btn(C.accent, ed?.id === i.id), cursor: "pointer", fontSize: 12 }}>Configurar</button>
                </div>
              </div>
              {ab === i.id && <div style={{ marginTop: 8, fontSize: 12.5, color: C.sub, display: "flex", gap: 14, flexWrap: "wrap" }}>{Object.entries(i.recursos).sort((a, b) => b[1] - a[1]).map(([r, v]) => <span key={r}>{ROT[r] || r}: <b style={{ color: C.text }}>{brl(v)}</b></span>)}</div>}
              {ed?.id === i.id && (
                <div style={{ marginTop: 10, padding: 12, borderRadius: 8, background: `${C.accent}0d`, border: `1px solid ${C.border}`, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}><Toggle C={C} ligado={ed.chat_mic} rotulo="🎤 Microfone no chat (grátis)" onChange={(v) => setEd({ ...ed, chat_mic: v })} />🎤 Microfone no chat <span style={{ color: C.sub, fontSize: 11.5 }}>(voz do navegador, grátis)</span></label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}><Toggle C={C} ligado={ed.chat_fala} rotulo="🔊 Ler respostas no chat (grátis)" onChange={(v) => setEd({ ...ed, chat_fala: v })} />🔊 Ler respostas em voz alta no chat <span style={{ color: C.sub, fontSize: 11.5 }}>(grátis · padrão desligado)</span></label>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
                    <label style={{ fontSize: 12, color: C.sub }}>🚗 Modo Conversa (voz paga)<br /><select value={ed.conversa} onChange={(e) => setEd({ ...ed, conversa: e.target.value })} style={{ ...input, width: 200 }}>{MODOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                    <label style={{ fontSize: 12, color: C.sub }}>🎁 Cortesia até<br /><input type="date" value={ed.cortesia_ate || ""} onChange={(e) => setEd({ ...ed, cortesia_ate: e.target.value || null })} style={{ ...input, width: 160 }} /></label>
                    <label style={{ fontSize: 12, color: C.sub }}>Modo na cortesia<br /><select value={ed.cortesia_modo} onChange={(e) => setEd({ ...ed, cortesia_modo: e.target.value })} style={{ ...input, width: 190 }}>{MODOS.slice(1).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                    <label style={{ fontSize: 12, color: C.sub }}>Teto da voz (R$/mês)<br /><input type="number" min="0" step="1" value={ed.teto_mes_brl} onChange={(e) => setEd({ ...ed, teto_mes_brl: e.target.value })} style={{ ...input, width: 120 }} /></label>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.sub }}>Na cortesia vale o "modo na cortesia" até a data; depois volta sozinho para o modo Conversa da empresa. Ao vivo entra na B6 — até lá funciona como voz neural.</div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => setEd(null)} style={{ ...btn(C.muted, false), cursor: "pointer" }}>Cancelar</button>
                    <button onClick={() => { const { id, ...cfg } = ed; salvar(id, cfg); }} style={{ ...btn(C.success), cursor: "pointer" }}>Salvar</button>
                  </div>
                </div>)}
            </div>))}
        </div>)}
    </div>
  );
}
