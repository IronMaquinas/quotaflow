// components/fotoCartao/Reparos.jsx — etapa E4: 🛠 REPAROS (execução do procedimento em campo) + editor de PROCEDIMENTOS
//   Lista de reparos (ativos/concluídos/cancelados, projeto) com progresso → abrir: etapas em ordem, cada uma com instrução, fotos (📸 abre a
//   câmera com o cartão já preenchido: pá, defeito, aerogerador, etapa), campos, materiais (produto, lote, validade, quantidade, proporção),
//   temperatura/umidade e comentário; 💾 rascunho (também guardado no aparelho) e ✓ concluir. Engenharia: 🔓 liberar, ↺ reabrir, cancelar.
//   AbrirReparo (modal usado na aba Defeitos) e ProcedimentosReparo (editor dos modelos de etapas).
import { useEffect, useState } from "react";
import apiService from "../../services/apiService";
import CampoFuncionario from "../shared/CampoFuncionario";
import VisualizadorFoto from "./VisualizadorFoto";
import * as Fila from "../../utils/filaFotosCartao";
import { quandoBR } from "../../utils/cartaoFoto";
import BotaoRelatorio from "./BotaoRelatorio";

const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const COR_ST = { aberto: "#60a5fa", em_execucao: "#f59e0b", concluido: "#22c55e", cancelado: "#64748b" };
const erroDe = (e) => `⚠ ${e?.response?.data?.erro || (e?.response ? e.message : "Sem conexão agora — o rascunho ficou guardado no aparelho.")}`;
const rascunhoKey = (rid, eid) => `qfRepRasc:${rid}:${eid}`;
const lerRasc = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const gravarRasc = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* ok */ } };

// valores do cartão já preenchidos para a foto da etapa
export function valoresDaEtapa(cartao, defeito, etapa) {
  const v = {}; for (const c of cartao?.campos || []) {
    const papel = c.papel || (/^p[áa]\b/i.test(c.rotulo) ? "pa" : /defeito\s*(n[ºo°.]*|número)/i.test(c.rotulo) ? "defeito" : /aerogerador|wtg|turbina/i.test(c.rotulo) ? "aerogerador" : null);
    if (papel === "pa" && defeito?.pa) v[c.id] = c.tipo === "opcoes" ? (c.opcoes || []).find((o) => o.toUpperCase() === defeito.pa) || defeito.pa : defeito.pa;
    if (papel === "defeito" && defeito?.numero) v[c.id] = defeito.numero;
    if (papel === "aerogerador" && defeito?.referencia) v[c.id] = defeito.referencia;
    if (!papel && /etapa/i.test(c.rotulo) && etapa) { if (c.tipo !== "opcoes") v[c.id] = etapa.titulo; }
  }
  return v;
}

export default function Reparos({ C, s, projetos = [], podeEditar, tenant, abrirCamera, abrirId, onAbriu }) {
  const [f, setF] = useState({ status: "ativos", projeto_id: "" }); const [L, setL] = useState(null); const [aberto, setAberto] = useState(abrirId || null); const [erro, setErro] = useState("");
  const carregar = () => { const p = new URLSearchParams(Object.entries(f).filter(([, v]) => v)); apiService.get(`/foto-cartao/reparos?${p}`).then((r) => { setL(r); setErro(""); }).catch((e) => setErro(erroDe(e))); };
  useEffect(() => { carregar(); }, [JSON.stringify(f)]); // eslint-disable-line
  useEffect(() => { if (abrirId) { setAberto(abrirId); onAbriu?.(); } }, [abrirId]); // eslint-disable-line
  const card = { ...s.card, padding: "12px 14px" };
  if (aberto) return <Reparo C={C} s={s} id={aberto} podeEditar={podeEditar} tenant={tenant} abrirCamera={abrirCamera} onVoltar={() => { setAberto(null); carregar(); }} />;
  return <div style={{ display: "grid", gap: 10 }}>
    <div style={{ ...card, display: "flex", gap: 8, flexWrap: "wrap" }}>
      <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} style={{ ...s.input, flex: "1 1 150px" }}><option value="ativos">Em andamento</option><option value="concluido">Concluídos</option><option value="cancelado">Cancelados</option><option value="">Todos</option></select>
      <select value={f.projeto_id} onChange={(e) => setF({ ...f, projeto_id: e.target.value })} style={{ ...s.input, flex: "1 1 180px" }}><option value="">Todos os projetos</option>{projetos.map((p) => <option key={p.id} value={p.id}>📁 {p.nome}</option>)}</select>
    </div>
    {erro && <div style={{ ...card, color: C.danger }}>{erro}</div>}
    {!L && !erro && <div style={{ color: C.muted }}>Carregando…</div>}
    {L && !L.reparos.length && <div style={{ ...card, color: C.muted, fontSize: 13 }}>Nenhum reparo aqui. O reparo é aberto pela engenharia na aba 🔧 Defeitos, nos defeitos classificados como "b) Reparar".</div>}
    {(L?.reparos || []).map((r) => <button key={r.id} type="button" onClick={() => setAberto(r.id)} style={{ ...card, textAlign: "left", cursor: "pointer", color: C.text, display: "grid", gap: 6, borderLeft: `4px solid ${COR_ST[r.status]}` }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><b>🛠 {r.numero}</b><span style={{ fontSize: 13 }}>{r.defeito ? `${r.defeito.referencia ? `${r.defeito.referencia} · ` : ""}${r.defeito.pa ? `Pá ${r.defeito.pa} · ` : ""}Defeito ${r.defeito.numero}` : ""}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: COR_ST[r.status], border: `1px solid ${COR_ST[r.status]}`, borderRadius: 10, padding: "1px 8px", marginLeft: "auto" }}>{L.STATUS[r.status]}</span></div>
      <div style={{ fontSize: 12, color: C.textSub }}>📁 {r.projeto} · {r.modelo_nome} · 👷 {r.responsavel || "—"}{r.prazo ? ` · prazo ${dBR(r.prazo)}` : ""}</div>
      <div style={{ height: 6, background: C.border, borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${r.progresso.pct}%`, height: "100%", background: COR_ST[r.status] }} /></div>
      <div style={{ fontSize: 11.5, color: C.muted }}>{r.progresso.concluidas}/{r.progresso.total} etapas · 📸 {r.progresso.fotos}{r.progresso.aguardando_liberacao ? ` · 🔒 aguardando liberação: ${r.progresso.aguardando_liberacao}` : r.progresso.proxima && r.status !== "concluido" ? ` · próxima: ${r.progresso.proxima}` : ""}</div>
    </button>)}
  </div>;
}

function Reparo({ C, s, id, podeEditar, tenant, abrirCamera, onVoltar }) {
  const [D, setD] = useState(null); const [msg, setMsg] = useState(""); const [form, setForm] = useState({}); const [ver, setVer] = useState(null); const [pend, setPend] = useState([]); const [modal, setModal] = useState(null);
  const carregar = async () => { try { const r = await apiService.get(`/foto-cartao/reparos/${id}`); setD(r);
    const fm = {}; for (const e of r.reparo.etapas) { const ex = r.reparo.execucao?.[e.id] || {}; const loc = lerRasc(rascunhoKey(id, e.id)); fm[e.id] = loc && ex.status !== "concluida" && loc.em > Date.parse(ex.atualizado_em || 0) ? loc.v : { campos: ex.campos || {}, materiais: ex.materiais || [], ambiente: { temperatura: ex.ambiente?.temperatura ?? "", umidade: ex.ambiente?.umidade ?? "" }, comentario: ex.comentario || "" }; }
    setForm(fm); setPend((await Fila.listar(tenant)).filter((x) => String(x.corpo?.reparo_id) === String(id))); } catch (e) { setMsg(erroDe(e)); } };
  useEffect(() => { carregar(); const t = setInterval(async () => setPend((await Fila.listar(tenant)).filter((x) => String(x.corpo?.reparo_id) === String(id))), 5000); return () => clearInterval(t); }, [id]); // eslint-disable-line
  if (!D) return <div style={{ padding: 16, color: C.muted }}>{msg || "Carregando…"}</div>;
  const { reparo: r, defeito: d } = D; const ex = r.execucao || {}; const fechado = ["concluido", "cancelado"].includes(r.status);
  const card = { ...s.card, padding: "12px 14px" }; const lab = { fontSize: 11.5, color: C.textSub, display: "block", marginBottom: 3 };
  const mudar = (eid, novo) => { setForm((f0) => ({ ...f0, [eid]: novo })); gravarRasc(rascunhoKey(id, eid), { em: Date.now(), v: novo }); };
  const enviar = async (eid, concluir) => { setMsg(""); try { const res = concluir ? await apiService.post(`/foto-cartao/reparos/${id}/etapas/${eid}/concluir`, form[eid]) : await apiService.put(`/foto-cartao/reparos/${id}/etapas/${eid}`, form[eid]);
    gravarRasc(rascunhoKey(id, eid), null); setMsg(res.concluido ? "✅ Reparo concluído — todas as etapas ok." : concluir ? "✓ Etapa concluída." : "💾 Rascunho salvo."); carregar(); } catch (e) { setMsg(erroDe(e)); } };
  const acaoEng = async (url, corpo, ok) => { setMsg(""); try { const res = await apiService.post(url, corpo); setModal(null); setMsg(res.concluido ? "✅ Reparo concluído — todas as etapas ok." : ok); carregar(); } catch (e) { setMsg(erroDe(e)); } };
  let bloqueio = null;
  return <div style={{ display: "grid", gap: 10 }}>
    {ver && <VisualizadorFoto lista={ver.lista} inicio={ver.i} onFechar={() => setVer(null)} onMudou={(t) => { setMsg(t); carregar(); }} />}
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><button type="button" onClick={onVoltar} style={{ background: "none", border: "none", color: C.textSub, cursor: "pointer", padding: 0 }}>← Reparos</button>
      <div style={{ fontSize: 18, fontWeight: 800, flex: 1 }}>🛠 {r.numero} · {d ? `${d.referencia ? `${d.referencia} · ` : ""}${d.pa ? `Pá ${d.pa} · ` : ""}Defeito ${d.numero}` : ""}</div>
      <span style={{ fontSize: 12, fontWeight: 700, color: COR_ST[r.status], border: `1px solid ${COR_ST[r.status]}`, borderRadius: 10, padding: "2px 10px" }}>{D.STATUS[r.status]}</span>
      <BotaoRelatorio C={C} s={s} reparoId={r.id} rotulo="📄 Relatório do reparo" />
      {podeEditar && !fechado && <button type="button" onClick={() => setModal({ tipo: "cancelar", motivo: "" })} style={{ ...s.btn(false), cursor: "pointer", color: C.danger }}>Cancelar reparo</button>}</div>
    <div style={{ fontSize: 12.5, color: C.textSub }}>📁 {D.projeto?.nome} · {r.modelo_nome} · cartão: {D.cartao?.nome || "—"} · 👷 {r.responsavel || "—"}{r.prazo ? ` · prazo ${dBR(r.prazo)}` : ""} · {D.progresso.concluidas}/{D.progresso.total} etapas</div>
    {r.status === "cancelado" && <div style={{ ...card, borderLeft: `4px solid ${C.danger}`, fontSize: 13 }}>Cancelado em {quandoBR(r.cancelado_em)}: {r.cancelamento_motivo}</div>}
    {msg && <div style={{ fontSize: 13, color: /^⚠/.test(msg) ? C.warn : "#22c55e" }}>{msg}</div>}
    {r.etapas.map((e, i) => { const x = ex[e.id] || {}; const fm = form[e.id] || { campos: {}, materiais: [], ambiente: {}, comentario: "" }; const fotos = D.fotos.filter((ft) => ft.etapa_id === e.id); const pe = pend.filter((p) => p.corpo?.etapa_id === e.id).length;
      const ok = x.status === "concluida"; const travada = !!bloqueio; const meu = !ok && !travada && !fechado;
      if (!bloqueio && !ok) bloqueio = e.titulo; if (!bloqueio && ok && e.liberacao && !x.liberada_em) bloqueio = `liberação de "${e.titulo}"`;
      const cor = ok ? (e.liberacao && !x.liberada_em ? "#a855f7" : "#22c55e") : meu ? "#f59e0b" : C.border;
      return <div key={e.id} style={{ ...card, borderLeft: `4px solid ${cor}`, display: "grid", gap: 8, opacity: travada && !ok ? 0.55 : 1 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <b style={{ fontSize: 14.5 }}>{ok ? "✅" : meu ? "▶" : "⏳"} {i + 1}. {e.titulo}</b>
          {e.liberacao && <span style={{ fontSize: 11, color: "#a855f7", border: "1px solid #a855f7", borderRadius: 8, padding: "0 6px" }}>🔒 liberação da engenharia</span>}
          <span style={{ marginLeft: "auto", fontSize: 12, color: fotos.length >= e.fotos_min ? "#22c55e" : C.textSub }}>📸 {fotos.length}{pe ? ` +${pe} no aparelho` : ""} / mín. {e.fotos_min}</span></div>
        {e.instrucao && <div style={{ fontSize: 12.5, color: C.textSub }}>{e.instrucao}</div>}
        {travada && !ok && <div style={{ fontSize: 12, color: C.muted }}>⏳ Aguardando: {bloqueio}.</div>}
        {(fotos.length > 0 || pe > 0) && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{fotos.map((ft, k) => <button key={ft.id} type="button" onClick={() => setVer({ lista: fotos, i: k })} style={{ width: 72, height: 72, padding: 0, border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden", cursor: "pointer", background: C.border }}>{ft.url && <img src={ft.url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</button>)}
          {pe > 0 && <div style={{ width: 72, height: 72, borderRadius: 6, border: `1px dashed ${C.warn}`, display: "grid", placeItems: "center", fontSize: 11, color: C.warn, textAlign: "center" }}>📶 {pe}<br />no aparelho</div>}</div>}
        {meu && <button type="button" onClick={() => abrirCamera({ reparo: r, defeito: d, cartao: D.cartao, projeto: D.projeto, etapa: e, depois: carregar })} style={{ ...s.btn(true), cursor: "pointer", justifySelf: "start", padding: "12px 18px", fontSize: 15 }}>📸 Fotografar esta etapa</button>}
        {(e.campos || []).length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{e.campos.map((c) => <div key={c.id} style={{ flex: "1 1 150px" }}><span style={lab}>{c.rotulo}{c.unidade ? ` (${c.unidade})` : ""} *</span><input disabled={!meu} inputMode={c.tipo === "numero" ? "decimal" : "text"} value={fm.campos?.[c.id] || ""} onChange={(ev) => mudar(e.id, { ...fm, campos: { ...fm.campos, [c.id]: ev.target.value } })} style={{ ...s.input, width: "100%" }} /></div>)}</div>}
        {e.materiais && <div style={{ display: "grid", gap: 6 }}><span style={lab}>MATERIAIS * (produto, lote, validade, quantidade, proporção da mistura)</span>
          {(fm.materiais || []).map((m, k) => { const venc = m.validade && m.validade < new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); const set = (campo, v) => mudar(e.id, { ...fm, materiais: fm.materiais.map((y, j) => (j === k ? { ...y, [campo]: v } : y)) });
            return <div key={k} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <input disabled={!meu} value={m.produto || ""} onChange={(ev) => set("produto", ev.target.value)} placeholder="Produto (ex.: resina epóxi)" style={{ ...s.input, flex: "2 1 160px" }} />
              <input disabled={!meu} value={m.lote || ""} onChange={(ev) => set("lote", ev.target.value)} placeholder="Lote" style={{ ...s.input, flex: "1 1 90px" }} />
              <input disabled={!meu} type="date" value={m.validade || ""} onChange={(ev) => set("validade", ev.target.value)} title="Validade" style={{ ...s.input, flex: "1 1 130px", borderColor: venc ? C.danger : undefined }} />
              <input disabled={!meu} value={m.quantidade || ""} inputMode="decimal" onChange={(ev) => set("quantidade", ev.target.value)} placeholder="Qtd." style={{ ...s.input, width: 70 }} />
              <input disabled={!meu} value={m.unidade || ""} onChange={(ev) => set("unidade", ev.target.value)} placeholder="un." style={{ ...s.input, width: 56 }} />
              <input disabled={!meu} value={m.proporcao || ""} onChange={(ev) => set("proporcao", ev.target.value)} placeholder="Proporção (100:30)" style={{ ...s.input, flex: "1 1 120px" }} />
              {meu && <button type="button" onClick={() => mudar(e.id, { ...fm, materiais: fm.materiais.filter((_, j) => j !== k) })} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}>✕</button>}
              {venc && <span style={{ fontSize: 11.5, color: C.danger, flex: "1 1 100%" }}>⚠ Vencido — troque o material.</span>}</div>; })}
          {meu && <button type="button" onClick={() => mudar(e.id, { ...fm, materiais: [...(fm.materiais || []), { produto: "", lote: "", validade: "", quantidade: "", unidade: "", proporcao: "" }] })} style={{ ...s.btn(false), cursor: "pointer", justifySelf: "start" }}>＋ Material</button>}</div>}
        {e.ambiente && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><div style={{ flex: "1 1 120px" }}><span style={lab}>TEMPERATURA (°C) *</span><input disabled={!meu} inputMode="decimal" value={fm.ambiente?.temperatura ?? ""} onChange={(ev) => mudar(e.id, { ...fm, ambiente: { ...fm.ambiente, temperatura: ev.target.value } })} style={{ ...s.input, width: "100%" }} /></div>
          <div style={{ flex: "1 1 120px" }}><span style={lab}>UMIDADE RELATIVA (%) *</span><input disabled={!meu} inputMode="decimal" value={fm.ambiente?.umidade ?? ""} onChange={(ev) => mudar(e.id, { ...fm, ambiente: { ...fm.ambiente, umidade: ev.target.value } })} style={{ ...s.input, width: "100%" }} /></div></div>}
        {(meu || fm.comentario) && <div><span style={lab}>COMENTÁRIO</span><textarea disabled={!meu} value={fm.comentario || ""} onChange={(ev) => mudar(e.id, { ...fm, comentario: ev.target.value })} rows={2} style={{ ...s.input, width: "100%" }} /></div>}
        {ok && <div style={{ fontSize: 12, color: C.textSub }}>✓ Concluída por {x.concluida_por} em {quandoBR(x.concluida_em)}{x.liberada_em ? ` · 🔓 liberada por ${x.liberada_por} em ${quandoBR(x.liberada_em)}${x.liberacao_obs ? ` — ${x.liberacao_obs}` : ""}` : ""}</div>}
        {(x.reaberturas || []).length > 0 && <div style={{ fontSize: 11.5, color: C.muted }}>↺ {x.reaberturas.map((rb) => `${quandoBR(rb.em)} ${rb.por}: ${rb.motivo}`).join(" · ")}</div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {meu && <button type="button" onClick={() => enviar(e.id, false)} style={{ ...s.btn(false), cursor: "pointer" }}>💾 Salvar rascunho</button>}
          {meu && <button type="button" onClick={() => enviar(e.id, true)} style={{ ...s.btn(true), cursor: "pointer" }}>✓ Concluir etapa</button>}
          {podeEditar && ok && e.liberacao && !x.liberada_em && !fechado && <button type="button" onClick={() => setModal({ tipo: "liberar", e, obs: "" })} style={{ ...s.btn(true), cursor: "pointer", background: "#a855f7" }}>🔓 Liberar</button>}
          {podeEditar && ok && r.status !== "cancelado" && <button type="button" onClick={() => setModal({ tipo: "reabrir", e, motivo: "" })} style={{ ...s.btn(false), cursor: "pointer" }}>↺ Reabrir</button>}
        </div>
      </div>; })}
    {modal && <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(ev) => ev.stopPropagation()} style={{ ...card, width: "min(460px, 100%)", display: "grid", gap: 10 }}>
        <b>{modal.tipo === "liberar" ? `🔓 Liberar "${modal.e.titulo}"?` : modal.tipo === "reabrir" ? `↺ Reabrir "${modal.e.titulo}"?` : `Cancelar ${r.numero}?`}</b>
        <div style={{ fontSize: 13, color: C.textSub }}>{modal.tipo === "liberar" ? "A próxima etapa fica liberada para o técnico." : modal.tipo === "reabrir" ? "A etapa volta para edição (fotos ficam). Fica no histórico." : "As fotos ficam no projeto e no defeito."}</div>
        <textarea value={modal.tipo === "liberar" ? modal.obs : modal.motivo} onChange={(ev) => setModal({ ...modal, [modal.tipo === "liberar" ? "obs" : "motivo"]: ev.target.value })} rows={2} placeholder={modal.tipo === "liberar" ? "Observação (opcional)" : "Motivo *"} style={{ ...s.input, width: "100%" }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={() => setModal(null)} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button>
          <button type="button" onClick={() => (modal.tipo === "liberar" ? acaoEng(`/foto-cartao/reparos/${id}/etapas/${modal.e.id}/liberar`, { obs: modal.obs }, "🔓 Etapa liberada.") : modal.tipo === "reabrir" ? acaoEng(`/foto-cartao/reparos/${id}/etapas/${modal.e.id}/reabrir`, { motivo: modal.motivo }, "↺ Etapa reaberta.") : acaoEng(`/foto-cartao/reparos/${id}/cancelar`, { motivo: modal.motivo }, "Reparo cancelado."))}
            style={{ ...s.btn(true), cursor: "pointer", background: modal.tipo === "cancelar" ? C.danger : modal.tipo === "liberar" ? "#a855f7" : undefined }}>Confirmar</button></div>
      </div></div>}
  </div>;
}

/** modal da aba Defeitos: abrir o reparo de um defeito "b) Reparar" (gestão) */
export function AbrirReparo({ C, s, defeito, cartoes = [], onFechar, onAberto }) {
  const [M, setM] = useState(null); const [f, setF] = useState({ modelo_id: "", cartao_modelo_id: "", resp_nome: "", resp_id: null, resp_uid: null, prazo: "" }); const [pessoas, setPessoas] = useState(null); const [msg, setMsg] = useState("");
  useEffect(() => { apiService.get("/foto-cartao/reparo-modelos").then((r) => { setM(r); if (r.modelos.length === 1) setF((x) => ({ ...x, modelo_id: r.modelos[0].id })); }).catch((e) => setMsg(erroDe(e))); apiService.get("/pessoas/gestao-pessoas").then((r) => setPessoas(r.funcionarios || [])).catch(() => setPessoas([])); }, []);
  useEffect(() => { const ativos = cartoes.filter((c) => c.ativo !== false); if (ativos.length === 1 && !f.cartao_modelo_id) setF((x) => ({ ...x, cartao_modelo_id: ativos[0].id })); }, [cartoes.length]); // eslint-disable-line
  const modelo = (M?.modelos || []).find((m) => String(m.id) === String(f.modelo_id)); const card = { ...s.card, padding: "14px 16px" }; const lab = { fontSize: 11.5, color: C.textSub, display: "block", marginBottom: 3 };
  const abrir = async () => { setMsg(""); try { const r = await apiService.post("/foto-cartao/reparos", { defeito_id: defeito.id, modelo_id: f.modelo_id, cartao_modelo_id: f.cartao_modelo_id, prazo: f.prazo, responsavel: f.resp_nome, responsavel_ref: f.resp_id ? `c:${f.resp_id}` : f.resp_uid ? `u:${f.resp_uid}` : null }); onAberto(r.reparo); } catch (e) { setMsg(erroDe(e)); } };
  return <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "min(520px, 100%)", maxHeight: "92vh", overflowY: "auto", display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>🛠 Abrir reparo — {defeito.pa ? `Pá ${defeito.pa} · ` : ""}Defeito {defeito.numero} <span style={{ fontSize: 12.5, fontWeight: 400, color: C.textSub }}>{defeito.projeto}{defeito.referencia ? ` · ${defeito.referencia}` : ""}</span></div>
      {M && !M.modelos.length && <div style={{ fontSize: 13, color: C.warn }}>Nenhum procedimento cadastrado — crie em ⚙ Modelos › Procedimentos de reparo (há o exemplo "Reparo de laminado — pá eólica").</div>}
      <div><span style={lab}>PROCEDIMENTO *</span><select value={f.modelo_id} onChange={(e) => setF({ ...f, modelo_id: e.target.value })} style={{ ...s.input, width: "100%" }}><option value="">Escolha…</option>{(M?.modelos || []).map((m) => <option key={m.id} value={m.id}>{m.nome} ({m.etapas.length} etapas)</option>)}</select></div>
      {modelo && <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, color: C.textSub }}>{modelo.etapas.map((e) => <li key={e.id}>{e.titulo}{e.fotos_min ? ` · 📸 ${e.fotos_min}` : ""}{e.materiais ? " · materiais" : ""}{e.ambiente ? " · °C/%" : ""}{e.liberacao ? " · 🔒" : ""}</li>)}</ol>}
      <div><span style={lab}>CARTÃO NAS FOTOS *</span><select value={f.cartao_modelo_id} onChange={(e) => setF({ ...f, cartao_modelo_id: e.target.value })} style={{ ...s.input, width: "100%" }}><option value="">Escolha…</option>{cartoes.filter((c) => c.ativo !== false).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><div style={{ flex: "2 1 200px" }}><span style={lab}>RESPONSÁVEL (técnico)</span><CampoFuncionario C={C} s={s} lista={pessoas} nome={f.resp_nome} id={f.resp_id} usuarioId={f.resp_uid} placeholder="Digite o nome do funcionário…" onChange={(v) => setF({ ...f, resp_nome: v.nome, resp_id: v.id, resp_uid: v.usuario_id })} /></div>
        <div style={{ flex: "1 1 140px" }}><span style={lab}>PRAZO</span><input type="date" value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} style={{ ...s.input, width: "100%" }} /></div></div>
      {msg && <div style={{ fontSize: 13, color: C.warn }}>{msg}</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={onFechar} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button><button type="button" disabled={!f.modelo_id || !f.cartao_modelo_id} onClick={abrir} style={{ ...s.btn(true), cursor: "pointer", opacity: !f.modelo_id || !f.cartao_modelo_id ? 0.5 : 1 }}>Abrir reparo</button></div>
    </div></div>;
}

/** editor dos procedimentos (modelos de etapas) — aba ⚙ Modelos */
export function ProcedimentosReparo({ C, s, setMsg }) {
  const [M, setM] = useState(null); const [ed, setEd] = useState(null);
  const carregar = () => apiService.get("/foto-cartao/reparo-modelos?todos=1").then(setM).catch((e) => setMsg(erroDe(e)));
  useEffect(() => { carregar(); }, []); // eslint-disable-line
  const card = { ...s.card, padding: "14px 16px" }; const lab = { fontSize: 11.5, color: C.textSub, display: "block", marginBottom: 3 };
  const salvar = async () => { try { const r = ed.id ? await apiService.put(`/foto-cartao/reparo-modelos/${ed.id}`, ed) : await apiService.post("/foto-cartao/reparo-modelos", ed); setMsg(`Procedimento "${r.modelo.nome}" salvo.`); setEd(null); carregar(); } catch (e) { setMsg(erroDe(e)); } };
  const et = (i, k, v) => setEd({ ...ed, etapas: ed.etapas.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
  const mover = (i, d) => { const l = [...ed.etapas]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; setEd({ ...ed, etapas: l }); };
  if (ed) return <div style={{ ...card, display: "grid", gap: 10 }}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><div style={{ flex: "2 1 240px" }}><span style={lab}>NOME DO PROCEDIMENTO</span><input value={ed.nome || ""} onChange={(e) => setEd({ ...ed, nome: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>
      <div style={{ flex: "3 1 280px" }}><span style={lab}>DESCRIÇÃO</span><input value={ed.descricao || ""} onChange={(e) => setEd({ ...ed, descricao: e.target.value })} style={{ ...s.input, width: "100%" }} /></div></div>
    <span style={lab}>ETAPAS (na ordem de execução)</span>
    {ed.etapas.map((e, i) => <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}><b style={{ width: 22 }}>{i + 1}.</b><input value={e.titulo} onChange={(ev) => et(i, "titulo", ev.target.value)} placeholder="Título da etapa" style={{ ...s.input, flex: "3 1 200px" }} />
        <label style={{ fontSize: 12.5, display: "flex", gap: 4, alignItems: "center" }}>📸 mín.<input type="number" min={0} max={20} value={e.fotos_min} onChange={(ev) => et(i, "fotos_min", ev.target.value)} style={{ ...s.input, width: 60 }} /></label>
        <button type="button" onClick={() => mover(i, -1)} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 8px" }}>↑</button><button type="button" onClick={() => mover(i, 1)} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 8px" }}>↓</button>
        <button type="button" onClick={() => setEd({ ...ed, etapas: ed.etapas.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}>✕</button></div>
      <input value={e.instrucao || ""} onChange={(ev) => et(i, "instrucao", ev.target.value)} placeholder="Instrução para o técnico" style={{ ...s.input, width: "100%" }} />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12.5 }}>{[["materiais", "Materiais (lote, validade, proporção)"], ["ambiente", "Temperatura e umidade"], ["liberacao", "🔒 Liberação da engenharia"]].map(([k, l]) => <label key={k} style={{ display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={!!e[k]} onChange={(ev) => et(i, k, ev.target.checked)} /> {l}</label>)}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 12 }}><span style={{ color: C.textSub }}>Campos:</span>{(e.campos || []).map((c, k) => <span key={k} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><input value={c.rotulo} onChange={(ev) => et(i, "campos", e.campos.map((y, j) => (j === k ? { ...y, rotulo: ev.target.value } : y)))} placeholder="Rótulo" style={{ ...s.input, width: 130 }} /><input value={c.unidade || ""} onChange={(ev) => et(i, "campos", e.campos.map((y, j) => (j === k ? { ...y, unidade: ev.target.value } : y)))} placeholder="un." style={{ ...s.input, width: 50 }} /><button type="button" onClick={() => et(i, "campos", e.campos.filter((_, j) => j !== k))} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}>✕</button></span>)}
        <button type="button" onClick={() => et(i, "campos", [...(e.campos || []), { rotulo: "", tipo: "texto", unidade: "" }])} style={{ ...s.btn(false), cursor: "pointer", padding: "3px 8px", fontSize: 12 }}>＋ campo</button></div>
    </div>)}
    <button type="button" onClick={() => setEd({ ...ed, etapas: [...ed.etapas, { titulo: "", instrucao: "", fotos_min: 1, campos: [], materiais: false, ambiente: false, liberacao: false }] })} style={{ ...s.btn(false), cursor: "pointer", justifySelf: "start" }}>＋ Etapa</button>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>{ed.id && <button type="button" onClick={async () => { await apiService.put(`/foto-cartao/reparo-modelos/${ed.id}`, { ...ed, ativo: ed.ativo === false }); setEd(null); carregar(); }} style={{ ...s.btn(false), cursor: "pointer", marginRight: "auto" }}>{ed.ativo === false ? "Reativar" : "Desativar"}</button>}
      <button type="button" onClick={() => setEd(null)} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button><button type="button" onClick={salvar} style={{ ...s.btn(true), cursor: "pointer" }}>Salvar procedimento</button></div>
  </div>;
  return <div style={{ display: "grid", gap: 10 }}>
    <div style={{ ...card, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><button type="button" onClick={() => setEd({ nome: "", descricao: "", etapas: [{ titulo: "", instrucao: "", fotos_min: 1, campos: [] }] })} style={{ ...s.btn(true), cursor: "pointer" }}>＋ Novo procedimento</button>
      <span style={{ fontSize: 12.5, color: C.textSub }}>ou comece de um exemplo:</span>{(M?.exemplos || []).map((x) => <button key={x.chave} type="button" onClick={async () => { try { const r = await apiService.post("/foto-cartao/reparo-modelos", { exemplo: x.chave }); setMsg(`Procedimento "${r.modelo.nome}" criado — ajuste as etapas se quiser.`); carregar(); setEd(r.modelo); } catch (e) { setMsg(erroDe(e)); } }} style={{ ...s.btn(false), cursor: "pointer" }}>{x.nome}</button>)}</div>
    {(M?.modelos || []).map((m) => <button key={m.id} type="button" onClick={() => setEd({ ...m, etapas: m.etapas.map((e) => ({ ...e, campos: (e.campos || []).map((c) => ({ ...c })) })) })} style={{ ...card, textAlign: "left", cursor: "pointer", color: C.text, opacity: m.ativo === false ? 0.55 : 1 }}>
      <div style={{ fontWeight: 700 }}>🛠 {m.nome}{m.ativo === false ? " (desativado)" : ""}</div><div style={{ fontSize: 12, color: C.textSub }}>{m.etapas.length} etapas · {m.etapas.map((e) => e.titulo).join(" → ")}</div></button>)}
  </div>;
}
