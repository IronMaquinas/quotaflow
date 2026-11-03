// components/contratos/MedicaoModal.jsx — etapa 18d: 📏 a medição do ciclo (programado × realizado) — mesma tela para a empresa e o locatário
//   • tabela por equipamento: programado (do escopo do contrato) · realizado (editável) · observação
//   • "↻ Repetir programado" preenche todos os realizados · observação geral
//   • informativo automático (inspeções previstas × no prazo, horímetro) — só leitura
//   • ações: empresa → 💾 Salvar · ✓ Aprovar · ↩ Devolver (motivo) · Reabrir (motivo) | locatário → 💾 Salvar · 📤 Enviar para a locadora
//   • 🖨 Boletim de Medição (PDF)
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import { abrirMedicao, prepararJanela } from "../../utils/gerarMedicao";

const dataBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const UN = { hora: "h", dia: "dia(s)", fixo: "mês" };
const COR = { aberta: "#3b82f6", enviada: "#f59e0b", aprovada: "#22c55e", devolvida: "#ef4444", pendente: "#64748b" };
export const corStatusMedicao = (st) => COR[st] || "#64748b";

/** base: "/contratos" (empresa) ou "/locatario" — o servidor aplica o escopo */
export default function MedicaoModal({ C, s, medicaoId, base = "/contratos", modo = "empresa", podeEditar = true, onFechar, onMudou, onErro, onOk }) {
  const [d, setD] = useState(null); const [ed, setEd] = useState({}); const [obs, setObs] = useState(""); const [ocupado, setOcupado] = useState(false);
  const [motivo, setMotivo] = useState(null); // { acao: 'devolver' | 'reabrir', texto }
  const url = `${base}/medicoes/${medicaoId}`;
  const carregar = async () => {
    try { const r = await apiService.get(url); setD(r); setEd(Object.fromEntries((r.medicao.itens || []).map((i) => [String(i.locacao_id), { realizado: i.realizado ?? "", obs: i.obs || "" }]))); setObs(r.medicao.obs || ""); }
    catch (e) { onErro(e.message); onFechar(); }
  };
  useEffect(() => { carregar(); }, [medicaoId]); // eslint-disable-line
  if (!d) return null;
  const m = d.medicao; const c = d.contrato; const inf = d.informativo || {}; const pe = inf.por_equipamento || {};
  const locatario = modo === "locatario";
  const editavel = podeEditar && (locatario ? ["aberta", "devolvida"].includes(m.status) : ["aberta", "devolvida", "enviada"].includes(m.status));
  const sujo = (m.itens || []).some((i) => { const x = ed[String(i.locacao_id)] || {}; return String(x.realizado ?? "") !== String(i.realizado ?? "") || String(x.obs || "") !== String(i.obs || ""); }) || obs !== (m.obs || "");
  const corpo = () => ({ itens: (m.itens || []).map((i) => ({ locacao_id: i.locacao_id, realizado: ed[String(i.locacao_id)]?.realizado ?? "", obs: ed[String(i.locacao_id)]?.obs ?? "" })), obs });
  const exec = async (fn, msg) => { setOcupado(true); try { const r = await fn(); if (msg) onOk(msg); await carregar(); onMudou?.(); return r; } catch (e) { onErro(e.message); return null; } finally { setOcupado(false); } };
  const salvar = () => exec(() => apiService.put(url, corpo()), "Medição salva.");
  const repetir = () => setEd((x) => Object.fromEntries((m.itens || []).map((i) => [String(i.locacao_id), { ...(x[String(i.locacao_id)] || {}), realizado: i.programado ?? "" }])));
  const salvarE = async (acao, msg, body) => { if (sujo) { const r = await exec(() => apiService.put(url, corpo())); if (!r) return; } return exec(() => apiService.post(`${url}/${acao}`, body || {}), msg); };
  const imprimir = () => { const w = prepararJanela(); try { abrirMedicao(d, w); } catch (e) { onErro(e.message); } };
  const acao = { background: "transparent", border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 14px", fontSize: 13.5, cursor: "pointer" };
  const total = (m.itens || []).reduce((t, i) => { const r = Number(String(ed[String(i.locacao_id)]?.realizado ?? "").replace(",", ".")); return t + (i.valor != null && Number.isFinite(r) ? i.valor * r : 0); }, 0);
  const temValor = (m.itens || []).some((i) => i.valor != null);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090", zIndex: 330, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }} onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: 940, maxWidth: "100%", margin: "auto 0", padding: "16px 20px", color: C.text }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>📏 Medição {m.rotulo} — {c.numero}</div>
            <div style={{ fontSize: 13.5, color: C.textSub }}>{c.cliente}{c.local ? ` · ${c.local}` : ""} · {dataBR(m.inicio)} a {dataBR(m.fim)}</div>
          </div>
          <span style={{ ...s.tag(corStatusMedicao(m.status)), fontSize: 12 }}>{m.status_nome}</span>
          <button type="button" onClick={onFechar} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        {m.status === "devolvida" && m.devolvido_motivo && <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: `${C.danger}18`, color: C.danger, fontSize: 14 }}>↩ Devolvida pela locadora: {m.devolvido_motivo}</div>}
        {!locatario && c.medicao_locatario && m.status === "aberta" && <div style={{ marginTop: 10, fontSize: 13.5, color: C.textSub }}>O locatário preenche esta medição (toggle "Medição pelo locatário" no contrato) — você aprova depois que ele enviar.</div>}

        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead><tr style={{ color: C.muted, fontSize: 11.5, textAlign: "left" }}>
              <th style={{ padding: 6 }}>EQUIPAMENTO</th><th style={{ padding: 6, textAlign: "right" }}>PROGRAMADO</th><th style={{ padding: 6, width: 140 }}>REALIZADO</th>{temValor && <th style={{ padding: 6, textAlign: "right" }}>VALOR</th>}<th style={{ padding: 6 }}>OBSERVAÇÃO</th>
            </tr></thead>
            <tbody>{(m.itens || []).map((i) => { const k = String(i.locacao_id); const x = ed[k] || {}; const r = Number(String(x.realizado ?? "").replace(",", "."));
              const dif = x.realizado !== "" && x.realizado != null && i.programado != null && Number.isFinite(r) && r !== Number(i.programado);
              return <tr key={k} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: 6 }}><b>{i.tag}</b> <span style={{ color: C.textSub }}>{i.nome}</span>{!i.unidade && <div style={{ fontSize: 12, color: C.warn }}>sem escopo no contrato</div>}</td>
                <td style={{ padding: 6, textAlign: "right", whiteSpace: "nowrap" }}>{i.programado != null ? `${Number(i.programado).toLocaleString("pt-BR")} ${UN[i.unidade] || ""}` : "—"}</td>
                <td style={{ padding: 6 }}>{editavel ? <div style={{ display: "flex", alignItems: "center", gap: 4 }}><input inputMode="decimal" value={x.realizado ?? ""} onChange={(e) => setEd({ ...ed, [k]: { ...x, realizado: e.target.value } })}
                    style={{ ...s.input, padding: "6px 8px", fontSize: 14, borderColor: dif ? C.warn : undefined }} /><span style={{ color: C.muted, fontSize: 12 }}>{UN[i.unidade] || ""}</span></div>
                  : <b style={{ color: dif ? C.warn : C.text }}>{i.realizado != null ? `${Number(i.realizado).toLocaleString("pt-BR")} ${UN[i.unidade] || ""}` : "—"}</b>}</td>
                {temValor && <td style={{ padding: 6, textAlign: "right", whiteSpace: "nowrap", color: C.textSub }}>{i.valor != null && Number.isFinite(r) ? (i.valor * r).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</td>}
                <td style={{ padding: 6 }}>{editavel ? <input value={x.obs || ""} onChange={(e) => setEd({ ...ed, [k]: { ...x, obs: e.target.value } })} placeholder="opcional" style={{ ...s.input, padding: "6px 8px", fontSize: 13.5 }} /> : <span style={{ color: C.textSub }}>{i.obs || ""}</span>}</td>
              </tr>; })}</tbody>
            {temValor && <tfoot><tr><td colSpan={3} style={{ padding: 6, textAlign: "right", color: C.textSub }}>Total medido</td><td style={{ padding: 6, textAlign: "right" }}><b>{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</b></td><td /></tr></tfoot>}
          </table>
          {!(m.itens || []).length && <div style={{ color: C.muted, padding: 10 }}>Nenhum equipamento no contrato neste período.</div>}
        </div>
        {editavel && <div style={{ marginTop: 8 }}><button type="button" onClick={repetir} style={{ ...acao, borderColor: C.accent, color: C.accent }}>↻ Repetir programado</button>
          <span style={{ fontSize: 12.5, color: C.muted, marginLeft: 8 }}>preenche o realizado igual ao programado — depois é só corrigir o que foi diferente</span></div>}
        <label style={{ display: "block", marginTop: 10 }}><span style={s.label}>OBSERVAÇÕES GERAIS</span>
          {editavel ? <textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="opcional" style={{ ...s.input, resize: "vertical", fontSize: 14 }} /> : <div style={{ fontSize: 14, color: C.textSub }}>{m.obs || "—"}</div>}</label>

        <div style={{ ...s.card, background: C.bg, padding: "10px 12px", marginTop: 12 }}>
          <div style={{ ...s.label, marginBottom: 6 }}>INFORMATIVO DO SISTEMA — INSPEÇÕES NO PERÍODO{m.status === "aprovada" ? " (congelado na aprovação)" : ""}</div>
          <div style={{ fontSize: 13.5, marginBottom: 4 }}>{inf.total ? <>Previstas <b>{inf.total.previstas}</b> · no prazo <b style={{ color: inf.total.previstas && inf.total.no_prazo < inf.total.previstas ? C.warn : C.success }}>{inf.total.no_prazo}</b> · feitas {inf.total.feitas} · reprovadas <b style={{ color: inf.total.reprovadas ? C.danger : C.text }}>{inf.total.reprovadas}</b></> : "—"}</div>
          {(m.itens || []).map((i) => { const x = pe[String(i.equipamento_id)]; if (!x) return null;
            return <div key={i.locacao_id} style={{ fontSize: 13, color: C.textSub, padding: "2px 0" }}><b style={{ color: C.text }}>{i.tag}</b>: {x.no_prazo}/{x.previstas} no prazo · {x.feitas} feita(s){x.reprovadas ? ` · ${x.reprovadas} reprovada(s)` : ""}{x.horimetro ? ` · horímetro ${x.horimetro.de.toLocaleString("pt-BR")} → ${x.horimetro.ate.toLocaleString("pt-BR")} (${x.horimetro.horas.toLocaleString("pt-BR")} h)` : ""}</div>; })}
        </div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>{m.preenchido_por ? `Preenchido por ${m.preenchido_por} em ${dataHora(m.preenchido_em)}. ` : ""}{m.enviado_por ? `Enviado por ${m.enviado_por} em ${dataHora(m.enviado_em)}. ` : ""}{m.aprovado_por ? `Aprovado por ${m.aprovado_por} em ${dataHora(m.aprovado_em)}.` : ""}</div>

        {motivo && <div style={{ ...s.card, background: C.bg, padding: 10, marginTop: 10 }}>
          <div style={{ fontSize: 14, marginBottom: 6 }}>{motivo.acao === "devolver" ? "↩ Devolver ao locatário — o que precisa ser corrigido?" : "Reabrir a medição aprovada — por quê?"}</div>
          <textarea rows={2} autoFocus value={motivo.texto} onChange={(e) => setMotivo({ ...motivo, texto: e.target.value })} style={{ ...s.input, resize: "vertical", fontSize: 14 }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}><button type="button" onClick={() => setMotivo(null)} style={acao}>Voltar</button>
            <button type="button" disabled={ocupado || !motivo.texto.trim()} onClick={async () => { const r = await exec(() => apiService.post(`${url}/${motivo.acao}`, { motivo: motivo.texto }), motivo.acao === "devolver" ? "Medição devolvida ao locatário." : "Medição reaberta."); if (r) setMotivo(null); }}
              style={{ ...s.btn(true, C.danger), padding: "8px 14px" }}>{motivo.acao === "devolver" ? "↩ Devolver" : "Reabrir"}</button></div>
        </div>}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, justifyContent: "flex-end" }}>
          <button type="button" onClick={imprimir} style={acao}>🖨 Boletim de Medição</button>
          <div style={{ flex: 1 }} />
          {editavel && <button type="button" disabled={ocupado || !sujo} onClick={salvar} style={acao}>💾 Salvar</button>}
          {locatario && editavel && <button type="button" disabled={ocupado} onClick={() => salvarE("enviar", "📤 Medição enviada à locadora.")} style={{ ...s.btn(true, C.accent), padding: "8px 16px" }}>📤 Enviar para a locadora</button>}
          {!locatario && podeEditar && m.status === "enviada" && <button type="button" disabled={ocupado} onClick={() => setMotivo({ acao: "devolver", texto: "" })} style={{ ...acao, color: C.danger, borderColor: `${C.danger}66` }}>↩ Devolver</button>}
          {!locatario && podeEditar && (m.status === "enviada" || (!c.medicao_locatario && ["aberta", "devolvida"].includes(m.status))) &&
            <button type="button" disabled={ocupado} onClick={() => salvarE("aprovar", "✓ Medição aprovada.")} style={{ ...s.btn(true, C.success), padding: "8px 16px" }}>✓ Aprovar</button>}
          {!locatario && podeEditar && m.status === "aprovada" && <button type="button" disabled={ocupado} onClick={() => setMotivo({ acao: "reabrir", texto: "" })} style={acao}>Reabrir</button>}
        </div>
      </div>
    </div>
  );
}

/** lista de ciclos de um contrato (empresa) — abre a medição; "abrir" cria a do ciclo */
export function CiclosMedicao({ C, s, ciclos = [], onAbrir, podeAbrir = true, limite = 6 }) {
  const [todos, setTodos] = useState(false);
  const l = todos ? ciclos : ciclos.slice(0, limite);
  return <div>
    {l.map((x) => <div key={x.inicio} className={x.medicao_id || podeAbrir ? "qf-clicavel" : undefined} onClick={() => (x.medicao_id || podeAbrir) && onAbrir(x)}
      style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 0", borderTop: `1px solid ${C.border}`, fontSize: 13.5, cursor: x.medicao_id || podeAbrir ? "pointer" : "default", flexWrap: "wrap" }}>
      <span style={{ flex: "1 1 200px" }}>📏 <b>{x.rotulo}</b> <span style={{ color: C.muted }}>· {dataBR(x.inicio)} a {dataBR(x.fim)}{x.em_andamento ? " · em andamento" : ""}</span></span>
      {x.total ? <span style={{ fontSize: 12.5, color: C.textSub }}>{x.preenchidos}/{x.total} preenchido(s){x.divergentes ? ` · ${x.divergentes} diferente(s) do programado` : ""}</span> : null}
      <span style={s.tag(corStatusMedicao(x.status))}>{x.status_nome}</span>
      {(x.medicao_id || podeAbrir) && <span style={{ color: C.accent }}>{x.medicao_id ? "abrir ›" : "＋ abrir"}</span>}
    </div>)}
    {ciclos.length > limite && <button type="button" onClick={() => setTodos(!todos)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 13, padding: "6px 0" }}>{todos ? "mostrar menos" : `ver todos (${ciclos.length})`}</button>}
    {!ciclos.length && <div style={{ fontSize: 13, color: C.muted, padding: "6px 0" }}>Sem ciclos ainda.</div>}
  </div>;
}
