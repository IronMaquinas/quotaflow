// components/spot/ChatSpot.jsx — etapa 18l: 💬 conversa da demanda spot (comprador ↔ fornecedor)
//   Mesmo componente dos dois lados (Canal Spot do comprador e Spot do portal do fornecedor).
//   Tempo real por espera longa: pergunta "tem algo depois do id X?" e o servidor responde assim que chega mensagem
//   (ou em ~25 s, e pergunta de novo). A mensagem do outro lado aparece sozinha, sem recarregar.
import { useState, useEffect, useRef } from "react";
import apiService from "../../services/apiService";
import { prepararArquivo } from "../../utils/comprimirImagem"; // 18q: 📎
import VerArquivo from "../programacao/VerArquivo";

const hora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

export default function ChatSpot({ C, s, url, lado, titulo, subtitulo, onFechar, onLidas }) {
  const [msgs, setMsgs] = useState([]); const [txt, setTxt] = useState(""); const [erro, setErro] = useState(null);
  const [encerrada, setEncerrada] = useState(false); const [enviando, setEnviando] = useState(false); const [carregou, setCarregou] = useState(false);
  const ultimo = useRef(0); const vivo = useRef(true); const fim = useRef(null);
  const arqRef = useRef(null); const [ver, setVer] = useState(null); // 18q: 📎 anexo e visualizador por cima da conversa
  const juntar = (novas) => { if (!novas?.length) return; setMsgs((v) => { const ids = new Set(v.map((m) => m.id)); return [...v, ...novas.filter((m) => !ids.has(m.id))]; }); ultimo.current = Math.max(ultimo.current, ...novas.map((m) => Number(m.id))); };
  useEffect(() => {
    vivo.current = true;
    (async () => {
      try { const r = await apiService.get(url, { desde: 0 }); if (!vivo.current) return; juntar(r.mensagens); setEncerrada(!!r.encerrada); setCarregou(true); onLidas?.(); if (r.sem_migration) setErro("Falta rodar a migration 072 no Supabase."); }
      catch (e) { if (vivo.current) { setErro(e.message); setCarregou(true); } return; }
      while (vivo.current) { // espera longa: volta assim que chega mensagem nova
        try { const r = await apiService.get(url, { desde: ultimo.current, esperar: 1 }); if (!vivo.current) break; juntar(r.mensagens); setEncerrada(!!r.encerrada); if (r.mensagens?.length) onLidas?.(); }
        catch { await new Promise((ok) => setTimeout(ok, 5000)); } // sem conexão: tenta de novo em 5 s
      }
    })();
    return () => { vivo.current = false; };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);
  const anexar = async (ev) => { // 18q: copia o arquivo ANTES de limpar o campo (senão a lista some — lição da 18h)
    const f0 = ev.target.files?.[0]; ev.target.value = ""; if (!f0 || enviando) return;
    if (!/^(image\/(jpeg|png)|application\/pdf)$/.test(f0.type)) { setErro("Anexo: foto (JPG ou PNG) ou PDF"); return; }
    setEnviando(true); setErro(null);
    try {
      const f = await prepararArquivo(f0); if (f.size > 10 * 1024 * 1024) throw new Error("Arquivo maior que 10 MB");
      const base64 = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = ko; r.readAsDataURL(f); });
      const r = await apiService.post(url, { texto: txt.trim(), anexo: { nome: f.name, mime: f.type, base64 } }); juntar([r.mensagem]); setTxt("");
    } catch (e) { setErro(e.message); } finally { setEnviando(false); }
  };
  const enviar = async () => {
    const t = txt.trim(); if (!t || enviando) return;
    setEnviando(true); setErro(null);
    try { const r = await apiService.post(url, { texto: t }); juntar([r.mensagem]); setTxt(""); }
    catch (e) { setErro(e.message); } finally { setEnviando(false); }
  };
  return <div onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onFechar?.(); }} style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div role="dialog" aria-modal="true" aria-label="Conversa" style={{ ...s.card, width: 520, maxWidth: "100%", height: "min(640px, 90vh)", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>💬 {titulo}</div>{subtitulo && <div style={{ fontSize: 12, color: C.textSub || C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitulo}</div>}</div>
        <button type="button" aria-label="Fechar" onClick={onFechar} style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {!carregou ? <div style={{ color: C.muted, fontSize: 13 }}>Carregando…</div>
          : msgs.length === 0 ? <div style={{ color: C.muted, fontSize: 13, textAlign: "center", marginTop: 30 }}>Nenhuma mensagem ainda.<br />{lado === "comprador" ? "Tire dúvidas, negocie prazo e valor aqui mesmo." : "Fale com o comprador sobre a demanda."}</div>
            : msgs.map((m) => { const minha = m.lado === lado;
              return <div key={m.id} style={{ alignSelf: minha ? "flex-end" : "flex-start", maxWidth: "82%", background: minha ? `${C.accent}26` : (C.bg || "#0002"), border: `1px solid ${minha ? `${C.accent}55` : C.border}`, borderRadius: 10, padding: "7px 11px" }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>{m.autor || (m.lado === "comprador" ? "Comprador" : "Fornecedor")} · {hora(m.em)}{minha && m.lida ? " · ✓ lida" : ""}</div>
                {m.anexo && (m.anexo.url ? (/^image\//.test(m.anexo.mime)
                  ? <img src={m.anexo.url} alt={m.anexo.nome} onClick={() => setVer(m.anexo)} style={{ display: "block", maxWidth: 220, maxHeight: 180, borderRadius: 6, cursor: "zoom-in", margin: "2px 0 4px" }} />
                  : <button type="button" onClick={() => setVer(m.anexo)} style={{ display: "flex", alignItems: "center", gap: 6, background: C.bg || "#0002", border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 10px", color: C.text, fontSize: 12.5, cursor: "pointer", margin: "2px 0 4px", fontFamily: "inherit" }}>📄 {m.anexo.nome}</button>)
                  : <div style={{ fontSize: 12, color: C.muted }}>📎 {m.anexo.nome}</div>)}{/* 18q */}
                {m.texto && <div style={{ fontSize: 13.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.texto}</div>}</div>; })}
        <div ref={fim} />
      </div>
      {erro && <div style={{ color: C.danger, fontSize: 12.5, padding: "0 16px 6px" }}>{erro}</div>}
      {encerrada ? <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}`, fontSize: 12.5, color: C.muted, textAlign: "center" }}>Demanda encerrada — a conversa fica só para consulta.</div>
        : <div style={{ display: "flex", gap: 8, padding: "10px 12px", borderTop: `1px solid ${C.border}` }}>
          <input ref={arqRef} type="file" accept="image/jpeg,image/png,application/pdf" onChange={anexar} style={{ display: "none" }} />
          <button type="button" aria-label="Anexar foto ou PDF" title="Anexar foto ou PDF (até 10 MB)" disabled={enviando} onClick={() => arqRef.current?.click()} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, color: C.textSub || C.muted, fontSize: 17, width: 40, cursor: "pointer" }}>📎</button>
          <textarea aria-label="Mensagem" value={txt} rows={1} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} placeholder="Escreva… (Enter envia, Shift+Enter quebra a linha)"
            style={{ ...s.input, flex: 1, marginBottom: 0, resize: "none", minHeight: 38, maxHeight: 120, fontFamily: "inherit" }} />
          <button type="button" disabled={!txt.trim() || enviando} onClick={enviar} style={{ ...s.btn(true), padding: "8px 16px", cursor: txt.trim() ? "pointer" : "default", opacity: txt.trim() ? 1 : 0.6 }}>{enviando ? "…" : "Enviar"}</button>
        </div>}
    </div>
    {ver && <VerArquivo C={C} s={s} arquivo={ver} z={1200} onFechar={() => setVer(null)} />}
  </div>;
}

// 18n: estado da conversa (do ponto de vista de quem vê) — o mesmo nos dois lados
//   nova: tem mensagem do outro lado sem ler · aguardando: a última é minha, < 24 h · sem_resposta: a última é minha, ≥ 24 h
//   ativa: os dois escreveram e a última é dos últimos 3 dias · parada: houve conversa, mas parou
export const ESTADO_CONVERSA = {
  nova: { emoji: "🔵", cor: "#3b82f6", rotulo: (e, n) => `${n} nova${n > 1 ? "s" : ""}` },
  aguardando: { emoji: "⏳", cor: "#f59e0b", rotulo: (e, n, o) => `Aguardando resposta${e.horas >= 1 ? ` há ${e.horas} h` : ""}${e.ultima_lida ? ` · lida pelo ${o}` : ` · ainda não lida pelo ${o}`}` },
  sem_resposta: { emoji: "🔴", cor: "#ef4444", rotulo: (e, n, o) => `Sem resposta há ${e.horas >= 48 ? `${Math.floor(e.horas / 24)} dias` : `${e.horas} h`}${e.ultima_lida ? ` · lida pelo ${o}` : ` · ainda não lida pelo ${o}`}` },
  ativa: { emoji: "💬", cor: "#22c55e", rotulo: () => "Conversa ativa" },
  parada: { emoji: "💬", cor: "#64748b", rotulo: () => "Conversa parada" },
};
export function SeloConversa({ estado, naoLidas = 0, compacto = false, outro = "outro lado" }) { // 18n.2: "lida pelo fornecedor/comprador"
  const k = naoLidas > 0 ? "nova" : estado?.estado; const e = ESTADO_CONVERSA[k]; if (!e) return null;
  return <span title="Situação da conversa" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: compacto ? 11 : 11.5, fontWeight: 700, color: e.cor, whiteSpace: "nowrap" }}>{e.emoji} {e.rotulo(estado || {}, naoLidas, outro)}</span>;
}
/** resumo de várias conversas (card da demanda do comprador) */
export function resumoConversas(interesses = []) {
  const c = { nova: 0, aguardando: 0, sem_resposta: 0, ativa: 0 };
  for (const i of interesses) { if (i.desistiu_em) continue; const k = i.chat_nao_lidas > 0 ? "nova" : i.chat_estado?.estado; if (k in c) c[k] += k === "nova" ? i.chat_nao_lidas : 1; }
  const conv = (n) => `${n} conversa${n > 1 ? 's' : ''}`; // 18n.1: deixa claro que é o 💬 chat
  return [c.nova && `🔵 ${c.nova} mensage${c.nova > 1 ? 'ns novas' : 'm nova'} no chat`, c.sem_resposta && `🔴 ${conv(c.sem_resposta)} sem resposta +24 h`, c.aguardando && `⏳ ${conv(c.aguardando)} aguardando resposta`, c.ativa && `💬 ${conv(c.ativa)} ativa${c.ativa > 1 ? 's' : ''}`].filter(Boolean);
}

// 18n: abrir uma demanda (e a conversa) vindo do 🔔 — guarda o pedido até a tela do Spot carregar as demandas
let pedidoAbrir = null;
export function pedirAbrirDemanda(link) { pedidoAbrir = link ? { ...link, em: Date.now() } : null; window.dispatchEvent(new CustomEvent("qf-abrir-demanda-spot")); }
export function pegarPedidoAbrir() { const p = pedidoAbrir; return p && Date.now() - p.em < 60000 ? p : null; }
export function limparPedidoAbrir() { pedidoAbrir = null; }
