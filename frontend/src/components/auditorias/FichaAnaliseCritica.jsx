// components/auditorias/FichaAnaliseCritica.jsx — etapa R2: 🧭 ficha da análise crítica pela direção (ISO 9001 9.3)
//   Preparação (período, reunião, participantes do cadastro) · 12 entradas a–l montadas pelo sistema com 🟢🟡🔴 e comentário da direção
//   (salva sozinho; cópia no aparelho) · saídas/decisões 9.3.3 (melhoria · mudança · recursos) com ☑ gerar tarefa AC (responsável e prazo)
//   · conclusão · ■ Encerrar (números congelados) · ✍ direção + qualidade → ✅ concluída · 📄 ata (PDF com logo) · cancelar com motivo.
import { useEffect, useRef, useState } from "react";
import apiService from "../../services/apiService";
import CampoFuncionario from "../shared/CampoFuncionario";
import AssinaturaTela from "../shared/AssinaturaTela";
import { Toggle } from "../../plataforma/ModulosPlataforma";
import { logoHtml } from "../../utils/logoEmpresa";
const COR_ST_AC = { rascunho: "#60a5fa", encerrada: "#f59e0b", concluida: "#22c55e", cancelada: "#64748b" };

const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const hora = (d) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const SINAL = { verde: { cor: "#22c55e", ic: "🟢" }, amarelo: { cor: "#f59e0b", ic: "🟡" }, vermelho: { cor: "#ef4444", ic: "🔴" } };
const lerLS = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const gravarLS = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem espaço: segue só no servidor */ } };
const amanha = () => new Date(Date.now() + 21 * 3600e3).toISOString().slice(0, 10);

export function htmlAta(det) {
  const a = det.analise; const E = det.entradas?.lista || []; const com = a.comentarios || {};
  const ent = E.map((e) => `<div class="ent"><h3>${esc(e.letra)}) ${esc(e.titulo)} <span class="cl">${esc(e.clausula)}</span>${e.sinal ? ` <span style="color:${SINAL[e.sinal].cor}">●</span>` : ""}</h3>
    ${(e.numeros || []).length ? `<table><tr>${e.numeros.map((n) => `<th>${esc(n.rotulo)}</th>`).join("")}</tr><tr>${e.numeros.map((n) => `<td><b>${esc(n.valor)}</b>${n.detalhe ? `<br><span class="r">${esc(n.detalhe)}</span>` : ""}</td>`).join("")}</tr></table>` : ""}
    ${(e.itens || []).length ? `<ul>${e.itens.map((i) => `<li>${esc(i.texto)}${i.detalhe ? ` — <span class="r">${esc(i.detalhe)}</span>` : ""}</li>`).join("")}</ul>` : ""}
    <div class="com"><b>Análise da direção:</b> ${com[e.chave] ? esc(com[e.chave]).replace(/\n/g, "<br>") : "<i>sem comentário</i>"}</div></div>`).join("");
  const sai = (a.saidas || []).map((x) => `<tr><td>${esc(det.TIPOS_SAIDA[x.tipo])}</td><td>${esc(x.texto)}${x.recurso ? `<br><span class="r">Recurso: ${esc(x.recurso)}</span>` : ""}${x.risco ? `<br><span class="r">Risco: ${esc(x.risco)}</span>` : ""}</td><td>${esc(x.responsavel || "—")}</td><td>${dBR(x.prazo)}</td><td>${esc(x.tarefa?.numero || (x.tarefa_id ? "tarefa" : "—"))}</td></tr>`).join("");
  const ass = (p) => { const x = (a.assinaturas || []).find((y) => y.papel === p); return `<div style="width:260px;text-align:center">${x ? `<img src="${x.png}" style="height:70px"><div style="border-top:1px solid #111;padding-top:4px">${esc(x.nome)}<br><span style="font-size:10px;color:#555">${esc(det.PAPEIS[p])} · assinado em ${hora(x.em)}</span></div>` : `<div style="height:70px"></div><div style="border-top:1px solid #111;padding-top:4px">${esc(det.PAPEIS[p])}</div>`}</div>`; };
  return `<html><head><meta charset="utf-8"><title>${esc(a.numero)}</title><style>@page{size:A4;margin:14mm}html{background:#d1d5db}body{font-family:Arial,sans-serif;font-size:12px;color:#111;width:210mm;min-height:297mm;margin:16px auto;padding:14mm;box-sizing:border-box;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.25)}@media print{html{background:none}body{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}}h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #999}h3{font-size:12.5px;margin:12px 0 4px}.cl{font-weight:400;color:#666;font-size:10.5px}.r{color:#555;font-size:11px}table{border-collapse:collapse;width:100%;margin-top:4px;font-size:11.5px}td,th{border:1px solid #bbb;padding:5px;vertical-align:top;text-align:left}th{background:#f1f5f9;font-weight:600}.com{margin-top:4px;padding:6px 8px;background:#f8fafc;border-left:3px solid #64748b}.ent{page-break-inside:avoid}ul{margin:4px 0;padding-left:18px}</style></head><body>
    ${logoHtml()}<h1>Ata da análise crítica pela direção — ${esc(a.numero)}</h1>
    <div class="r">${esc(a.titulo)} · ISO 9001:2015, 9.3${a.status === "concluida" ? ` · <b style="color:#16a34a">APROVADA em ${hora(a.aprovada_em)}</b>` : a.status === "cancelada" ? ` · <b style="color:#dc2626">CANCELADA</b> — ${esc(a.cancelamento_motivo || "")}` : a.status === "rascunho" ? " · <b>RASCUNHO (números ao vivo)</b>" : ""}</div>
    <h2>Dados da reunião</h2><table><tr><th style="width:170px">Período analisado</th><td>${dBR(a.periodo_de)} a ${dBR(a.periodo_ate)}</td></tr><tr><th>Data da reunião</th><td>${dBR(a.data_reuniao)}</td></tr><tr><th>Participantes</th><td>${(a.participantes || []).map((p) => `${esc(p.nome)}${p.funcao ? ` (${esc(p.funcao)})` : ""}`).join(", ") || "—"}</td></tr>${det.entradas?.montadas_em ? `<tr><th>Dados apurados em</th><td>${hora(det.entradas.montadas_em)}</td></tr>` : ""}</table>
    <h2>Entradas (9.3.2)</h2>${ent}
    <h2>Saídas — decisões e ações (9.3.3)</h2><table><tr><th>Tipo</th><th>Decisão</th><th>Responsável</th><th>Prazo</th><th>Tarefa</th></tr>${sai || '<tr><td colspan="5">Nenhuma decisão registrada.</td></tr>'}</table>
    <h2>Conclusão da direção</h2><div>${esc(a.conclusao || "—").replace(/\n/g, "<br>")}</div>
    <div style="display:flex;gap:60px;margin-top:50px;flex-wrap:wrap">${ass("direcao")}${ass("qualidade")}</div></body></html>`;
}

export default function FichaAnaliseCritica({ C, s, id, pessoas, onVoltar }) {
  const [det, setDet] = useState(null); const [msg, setMsg] = useState(""); const [salvo, setSalvo] = useState(null); const [com, setCom] = useState({}); const [conc, setConc] = useState("");
  const [part, setPart] = useState(""); const [sd, setSd] = useState(null); const [ass, setAss] = useState(null); const [canc, setCanc] = useState(null); const [tirar, setTirar] = useState(null); const [abertas, setAbertas] = useState({});
  const timers = useRef({}); const LS = `qfAcd:${id}`;
  const erroDe = (e) => setMsg(`⚠ ${e?.response?.data?.erro || e.message}`);
  const carregar = async () => { const r = await apiService.get(`/analise-critica/${id}`); setDet(r); const loc = lerLS(LS); const novo = loc && loc.em > Date.parse(r.analise.atualizado_em || 0) && r.analise.status === "rascunho";
    setCom(novo ? { ...(r.analise.comentarios || {}), ...(loc.com || {}) } : r.analise.comentarios || {}); setConc(novo && loc.conc != null ? loc.conc : r.analise.conclusao || ""); return r; };
  useEffect(() => { carregar().catch(erroDe); }, []); // eslint-disable-line
  const a = det?.analise; const trav = !!det?.travada; const st = a?.status;
  const card = { ...s.card, padding: "16px 18px" }; const lab = { fontSize: 11.5, color: C.textSub, display: "block", marginBottom: 3 }; const tit = { fontSize: 12, color: C.textSub, fontWeight: 700, letterSpacing: ".04em", marginBottom: 10 };
  const salvar = async (campos) => { try { await apiService.put(`/analise-critica/${id}`, campos); setSalvo(new Date()); } catch (e) { erroDe(e); } };
  const adiar = (k, fn) => { clearTimeout(timers.current[k]); timers.current[k] = setTimeout(fn, 1200); };
  const digitarCom = (k, v) => { const n = { ...com, [k]: v }; setCom(n); gravarLS(LS, { ...(lerLS(LS) || {}), com: n, em: Date.now() }); adiar(`c:${k}`, () => salvar({ comentarios: { [k]: v } })); };
  const digitarConc = (v) => { setConc(v); gravarLS(LS, { ...(lerLS(LS) || {}), conc: v, em: Date.now() }); adiar("conc", () => salvar({ conclusao: v })); };
  const acao = async (fn, ok) => { setMsg(""); try { const r = await fn(); if (ok) setMsg(typeof ok === "function" ? ok(r) : ok); await carregar(); return r; } catch (e) { erroDe(e); return null; } };
  const setA = (campos) => { setDet({ ...det, analise: { ...a, ...campos } }); salvar(campos); };
  const ata = () => { const w = window.open("", "_blank"); if (!w) return setMsg("⚠ Libere pop-ups para imprimir a ata."); w.document.write(htmlAta({ ...det, analise: { ...a, comentarios: com, conclusao: conc } }).replace("</body>", "<script>setTimeout(()=>print(),400)</script></body>")); w.document.close(); };
  const ir = (tela) => window.dispatchEvent(new CustomEvent("qf-navegar", { detail: { tela } }));
  const novaSaida = (entrada = null) => setSd({ tipo: "melhoria", texto: "", entrada, resp_nome: "", resp_id: null, resp_uid: null, prazo: "", recurso: "", gerar_tarefa: true });
  const registrarSaida = () => acao(() => apiService.post(`/analise-critica/${id}/saidas`, { ...sd, responsavel: sd.resp_nome || null, responsavel_ref: sd.resp_id ? `c:${sd.resp_id}` : sd.resp_uid ? `u:${sd.resp_uid}` : null }),
    (r) => { setSd(null); return r.aviso ? `⚠ ${r.aviso}` : `Decisão registrada${r.tarefa ? ` · tarefa ${r.tarefa.numero || ""} criada` : ""}.`; });

  if (!det) return <div style={{ padding: 24, color: C.muted }}>{msg || "Carregando…"}</div>;
  const E = det.entradas?.lista || [];
  const formSaida = sd && !trav ? (<div style={{ border: `2px solid ${C.border}`, borderRadius: 8, padding: 12, display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{Object.entries(det.TIPOS_SAIDA).map(([k, n]) => <button key={k} type="button" onClick={() => setSd({ ...sd, tipo: k })} style={{ padding: "6px 12px", borderRadius: 16, fontSize: 12.5, cursor: "pointer", border: `1px solid ${C.border}`, background: sd.tipo === k ? (C.primary || "#3b82f6") : "transparent", color: sd.tipo === k ? "#fff" : C.text }}>{n}</button>)}</div>
          {sd.entrada && <div style={{ fontSize: 12, color: C.textSub }}>Ligada à entrada {E.find((x) => x.chave === sd.entrada)?.letra}) {E.find((x) => x.chave === sd.entrada)?.titulo}</div>}
          <textarea value={sd.texto} onChange={(e) => setSd({ ...sd, texto: e.target.value })} rows={2} placeholder="Decisão da direção (o que será feito)…" style={{ ...s.input, width: "100%" }} />
          {sd.tipo === "risco" && <input value={sd.risco || ""} onChange={(e) => setSd({ ...sd, risco: e.target.value })} placeholder="Risco identificado (o que pode dar errado e o impacto)" style={{ ...s.input, width: "100%" }} />}
          {sd.tipo === "recursos" && <input value={sd.recurso} onChange={(e) => setSd({ ...sd, recurso: e.target.value })} placeholder="Recurso necessário (pessoa, equipamento, verba, sistema…)" style={{ ...s.input, width: "100%" }} />}
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}><Toggle C={C} ligado={sd.gerar_tarefa} rotulo="Gerar tarefa" onChange={(v) => setSd({ ...sd, gerar_tarefa: v })} /> Gerar tarefa no Plano (🧭 AC) — entra na próxima análise</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: "2 1 240px" }}><span style={lab}>RESPONSÁVEL</span><CampoFuncionario C={C} s={s} lista={pessoas} nome={sd.resp_nome} id={sd.resp_id} usuarioId={sd.resp_uid} placeholder="Digite o nome do funcionário…" onChange={(v) => setSd({ ...sd, resp_nome: v.nome, resp_id: v.id, resp_uid: v.usuario_id })} /></div>
            <div style={{ flex: "1 1 150px" }}><span style={lab}>PRAZO{sd.gerar_tarefa ? " *" : ""}</span><input type="date" min={amanha()} value={sd.prazo} onChange={(e) => setSd({ ...sd, prazo: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={() => setSd(null)} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button><button type="button" disabled={sd.texto.trim().length < 5 || (sd.gerar_tarefa && !sd.prazo)} onClick={registrarSaida} style={{ ...s.btn(true), cursor: "pointer", opacity: sd.texto.trim().length < 5 || (sd.gerar_tarefa && !sd.prazo) ? 0.5 : 1 }}>Registrar decisão</button></div>
  </div>) : null;
  return (
    <div style={{ padding: "20px clamp(12px, 3vw, 28px)", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div><button type="button" onClick={() => onVoltar()} style={{ background: "none", border: "none", color: C.textSub, cursor: "pointer", padding: 0, fontSize: 13 }}>← Análises</button>
          <div style={{ fontSize: 21, fontWeight: 800, marginTop: 4 }}>🧭 {a.numero} — {a.titulo}</div>
          <div style={{ fontSize: 12.5, color: C.textSub, marginTop: 2 }}><span style={{ color: COR_ST_AC[st], fontWeight: 700 }}>{det.STATUS[st]}</span>{st === "rascunho" ? " · números ao vivo — congelam ao encerrar" : det.entradas?.montadas_em ? ` · números de ${hora(det.entradas.montadas_em)}` : ""}{salvo ? ` · salvo ${salvo.toLocaleTimeString("pt-BR", { timeStyle: "short" })}` : ""}</div></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={ata} style={{ ...s.btn(false), cursor: "pointer" }}>📄 Ata (PDF)</button>
          {st === "rascunho" && <button type="button" onClick={() => acao(() => apiService.post(`/analise-critica/${id}/encerrar`), "Análise encerrada — números congelados. Agora as assinaturas.")} style={{ ...s.btn(true), cursor: "pointer" }}>■ Encerrar análise</button>}
          {st === "encerrada" && <button type="button" onClick={() => acao(() => apiService.post(`/analise-critica/${id}/reabrir`), "Reaberta — as assinaturas foram apagadas.")} style={{ ...s.btn(false), cursor: "pointer" }}>↺ Reabrir</button>}
          {["rascunho", "encerrada"].includes(st) && <button type="button" onClick={() => setCanc({ motivo: "" })} style={{ ...s.btn(false), cursor: "pointer", color: C.danger }}>Cancelar</button>}
        </div>
      </div>
      {msg && <div style={{ fontSize: 13, color: /^⚠/.test(msg) ? C.warn : "#22c55e" }}>{msg}</div>}
      {st === "cancelada" && <div style={{ ...card, borderLeft: `4px solid ${C.danger}`, fontSize: 13 }}>Cancelada{a.cancelada_por ? ` por ${a.cancelada_por}` : ""}{a.cancelada_em ? ` em ${hora(a.cancelada_em)}` : ""}: {a.cancelamento_motivo}</div>}

      {canc && <div onClick={() => setCanc(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}><div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "min(480px, 100%)", display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>Cancelar {a.numero}?</div><div style={{ fontSize: 13, color: C.textSub }}>As tarefas já criadas continuam no Plano. Explique o motivo (fica registrado).</div>
        <textarea value={canc.motivo} onChange={(e) => setCanc({ motivo: e.target.value })} rows={3} style={{ ...s.input, width: "100%" }} placeholder="Motivo do cancelamento…" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={() => setCanc(null)} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button><button type="button" disabled={canc.motivo.trim().length < 10} onClick={() => acao(() => apiService.post(`/analise-critica/${id}/cancelar`, canc), "Análise cancelada.").then((r) => r && setCanc(null))} style={{ ...s.btn(true), cursor: "pointer", background: C.danger, opacity: canc.motivo.trim().length < 10 ? 0.5 : 1 }}>Cancelar análise</button></div>
      </div></div>}
      {tirar && <div onClick={() => setTirar(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}><div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "min(440px, 100%)", display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>Tirar esta decisão da ata?</div><div style={{ fontSize: 13 }}>{tirar.texto}</div>{tirar.tarefa_id && <div style={{ fontSize: 12.5, color: C.warn }}>A tarefa {tirar.tarefa?.numero || ""} continua no Plano — cancele lá se não for mais fazer.</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={() => setTirar(null)} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button><button type="button" onClick={() => acao(() => apiService.delete(`/analise-critica/${id}/saidas/${tirar.id}`), "Decisão retirada.").then(() => setTirar(null))} style={{ ...s.btn(true), cursor: "pointer", background: C.danger }}>Tirar</button></div>
      </div></div>}

      <div style={{ ...card, display: "grid", gap: 10 }}>
        <div style={tit}>REUNIÃO</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: "3 1 260px" }}><span style={lab}>TÍTULO</span><input disabled={trav} value={a.titulo || ""} onChange={(e) => setDet({ ...det, analise: { ...a, titulo: e.target.value } })} onBlur={(e) => e.target.value.trim() && salvar({ titulo: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>
          <div style={{ flex: "1 1 140px" }}><span style={lab}>PERÍODO — DE</span><input type="date" disabled={trav} value={String(a.periodo_de).slice(0, 10)} onChange={(e) => e.target.value && acao(() => apiService.put(`/analise-critica/${id}`, { periodo_de: e.target.value }))} style={{ ...s.input, width: "100%" }} /></div>
          <div style={{ flex: "1 1 140px" }}><span style={lab}>ATÉ</span><input type="date" disabled={trav} value={String(a.periodo_ate).slice(0, 10)} onChange={(e) => e.target.value && acao(() => apiService.put(`/analise-critica/${id}`, { periodo_ate: e.target.value }))} style={{ ...s.input, width: "100%" }} /></div>
          <div style={{ flex: "1 1 140px" }}><span style={lab}>DATA DA REUNIÃO</span><input type="date" disabled={trav} value={a.data_reuniao ? String(a.data_reuniao).slice(0, 10) : ""} onChange={(e) => setA({ data_reuniao: e.target.value || null })} style={{ ...s.input, width: "100%" }} /></div>
        </div>
        <div><span style={lab}>PARTICIPANTES</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {(a.participantes || []).map((p, i) => <span key={i} style={{ display: "inline-flex", gap: 6, alignItems: "center", border: `1px solid ${C.border}`, borderRadius: 14, padding: "3px 6px 3px 10px", fontSize: 12.5 }}>{p.nome}
              <input disabled={trav} value={p.funcao || ""} placeholder="função" onChange={(e) => { const l = a.participantes.map((x, k) => (k === i ? { ...x, funcao: e.target.value } : x)); setDet({ ...det, analise: { ...a, participantes: l } }); }} onBlur={() => salvar({ participantes: a.participantes })} style={{ ...s.input, width: 110, padding: "2px 6px", fontSize: 12 }} />
              {!trav && <button type="button" onClick={() => setA({ participantes: a.participantes.filter((_, k) => k !== i) })} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}>✕</button>}</span>)}
            {!trav && <div style={{ width: 240 }}><CampoFuncionario C={C} s={s} lista={pessoas} nome={part} id={null} placeholder="＋ participante…" onChange={(v) => { if (v.id != null || v.usuario_id != null) { setPart(""); setA({ participantes: [...(a.participantes || []), { nome: v.nome, colaborador_id: v.id, usuario_id: v.usuario_id, funcao: "" }] }); } else setPart(v.nome); }} /></div>}
          </div></div>
      </div>

      <div style={tit}>ENTRADAS DA ANÁLISE (9.3.2)</div>
      {E.map((e) => { const aberto = (abertas[e.chave] ?? true) || sd?.entrada === e.chave; const sn = SINAL[e.sinal];
        return <div key={e.chave} style={{ ...card, borderLeft: `4px solid ${sn ? sn.cor : C.border}`, display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" onClick={() => setAbertas({ ...abertas, [e.chave]: !aberto })} style={{ background: "none", border: "none", color: C.text, cursor: "pointer", padding: 0, textAlign: "left", fontWeight: 700, fontSize: 14.5 }}>{aberto ? "▾" : "▸"} {sn?.ic || "⚪"} {e.letra}) {e.titulo} <span style={{ fontWeight: 400, fontSize: 11.5, color: C.muted }}>{e.clausula}</span></button>
            <div style={{ display: "flex", gap: 6 }}>{e.tela && <button type="button" onClick={() => ir(e.tela)} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 10px", fontSize: 12 }}>Abrir tela</button>}
              {!trav && sd?.entrada !== e.chave && <button type="button" onClick={() => novaSaida(e.chave)} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 10px", fontSize: 12 }}>＋ decisão</button>}</div>
          </div>
          {aberto && <>
            {e.falha && <div style={{ fontSize: 12.5, color: C.warn }}>⚠ Não consegui apurar estes números agora — comente com o que a equipe trouxe.</div>}
            {(e.numeros || []).length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>{e.numeros.map((n) => <div key={n.rotulo} style={{ background: C.bg || "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px" }}><div style={{ fontSize: 11, color: C.textSub }}>{n.rotulo}</div><div style={{ fontSize: String(n.valor).length > 14 ? 13 : 17, fontWeight: 800 }}>{n.valor}</div>{n.detalhe && <div style={{ fontSize: 11, color: C.muted }}>{n.detalhe}</div>}</div>)}</div>}
            {(e.itens || []).length > 0 && <div style={{ display: "grid", gap: 3 }}>{e.itens.map((i, k) => <div key={k} style={{ fontSize: 12.5 }}>{i.sinal ? SINAL[i.sinal].ic : i.sugestao ? "💡" : "•"} {i.texto}{i.detalhe ? <span style={{ color: C.textSub }}> — {i.detalhe}</span> : null}</div>)}</div>}
            {e.livre && e.dica && <div style={{ fontSize: 12, color: C.muted }}>{e.dica}</div>}
            <div><span style={lab}>ANÁLISE DA DIREÇÃO</span><textarea disabled={trav} value={com[e.chave] || ""} onChange={(ev) => digitarCom(e.chave, ev.target.value)} rows={e.livre ? 3 : 2} placeholder={trav ? "—" : "O que a direção conclui sobre esta entrada…"} style={{ ...s.input, width: "100%", resize: "vertical" }} /></div>
            {sd?.entrada === e.chave && formSaida}
          </>}
        </div>; })}

      <div style={{ ...card, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}><div style={{ ...tit, marginBottom: 0 }}>SAÍDAS — DECISÕES E AÇÕES (9.3.3) · {(a.saidas || []).length}</div>{!trav && !(sd && !sd.entrada) && <button type="button" onClick={() => novaSaida()} style={{ ...s.btn(true), cursor: "pointer" }}>＋ Nova decisão</button>}</div>
        {sd && !sd.entrada && formSaida}
        {!(a.saidas || []).length && !sd && <div style={{ fontSize: 12.5, color: C.muted }}>Nenhuma decisão ainda. Use "＋ decisão" numa entrada ou "＋ Nova decisão".</div>}
        {(a.saidas || []).map((x) => <div key={x.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", borderTop: `1px solid ${C.border}`, paddingTop: 8, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 280px" }}><div style={{ fontSize: 11.5, color: C.textSub, fontWeight: 700 }}>{det.TIPOS_SAIDA[x.tipo]}{x.entrada ? ` · entrada ${E.find((k) => k.chave === x.entrada)?.letra || ""})` : ""}</div><div style={{ fontSize: 13.5 }}>{x.texto}</div>{x.recurso && <div style={{ fontSize: 12, color: C.textSub }}>Recurso: {x.recurso}</div>}{x.risco && <div style={{ fontSize: 12, color: C.textSub }}>Risco: {x.risco}</div>}
            <div style={{ fontSize: 12, color: C.textSub }}>{x.responsavel || "—"} · prazo {dBR(x.prazo)}{x.tarefa ? ` · ${x.tarefa.numero || "tarefa"} (${{ pendente: "pendente", em_andamento: "em andamento", concluida: "concluída", cancelada: "cancelada" }[x.tarefa.status] || x.tarefa.status})` : x.tarefa_id ? " · tarefa" : " · sem tarefa"}</div></div>
          {!trav && <button type="button" onClick={() => setTirar(x)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}>✕</button>}
        </div>)}
      </div>

      <div style={{ ...card, display: "grid", gap: 8 }}>
        <div style={tit}>CONCLUSÃO DA DIREÇÃO</div>
        <div style={{ fontSize: 12, color: C.muted }}>Adequação, suficiência e eficácia do sistema de gestão no período; alinhamento com a direção estratégica.</div>
        <textarea disabled={trav} value={conc} onChange={(e) => digitarConc(e.target.value)} rows={4} style={{ ...s.input, width: "100%", resize: "vertical" }} placeholder={trav ? "—" : "O sistema de gestão está adequado, suficiente e eficaz porque…"} />
      </div>

      {st !== "rascunho" && st !== "cancelada" && <div style={{ ...card, display: "grid", gap: 10 }}>
        <div style={tit}>ASSINATURAS</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{Object.entries(det.PAPEIS).map(([p, nome]) => { const x = (a.assinaturas || []).find((y) => y.papel === p);
          return <div key={p} style={{ flex: "1 1 260px", border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, display: "grid", gap: 6 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{nome}</div>
            {x ? <><img src={x.png} alt="assinatura" style={{ height: 60, background: "#fff", borderRadius: 4, justifySelf: "start" }} /><div style={{ fontSize: 12, color: C.textSub }}>{x.nome} · {hora(x.em)}</div></>
              : st === "encerrada" && (ass?.papel === p ? <div style={{ display: "grid", gap: 8 }}><CampoFuncionario C={C} s={s} lista={pessoas} nome={ass.nome} id={ass.colaborador_id} usuarioId={ass.usuario_id} placeholder="Nome de quem assina…" onChange={(v) => setAss({ ...ass, nome: v.nome, colaborador_id: v.id, usuario_id: v.usuario_id })} />
                <AssinaturaTela C={C} s={s} onChange={(png) => setAss((z) => ({ ...z, png }))} />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={() => setAss(null)} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button><button type="button" disabled={!ass.nome || !ass.png} onClick={() => acao(() => apiService.post(`/analise-critica/${id}/assinar`, ass), (r) => (r.aprovada ? "✅ Análise concluída e aprovada." : "Assinatura registrada.")).then((r) => r && setAss(null))} style={{ ...s.btn(true), cursor: "pointer", opacity: !ass.nome || !ass.png ? 0.5 : 1 }}>Confirmar assinatura</button></div></div>
                : <button type="button" onClick={() => setAss({ papel: p, nome: "", colaborador_id: null, usuario_id: null, png: null })} style={{ ...s.btn(false), cursor: "pointer", justifySelf: "start" }}>✍ Assinar</button>)}
          </div>; })}</div>
      </div>}
    </div>
  );
}
