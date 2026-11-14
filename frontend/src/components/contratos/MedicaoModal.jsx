// components/contratos/MedicaoModal.jsx — etapa 18d · 18d.2 (simplificada): 📏 a medição do ciclo
//   o SISTEMA monta: por equipamento, período no ciclo (dias), valor mensal do contrato e o VALOR RECOMENDADO (proporcional)
//   • empresa (comercial): edita o valor a cobrar e a observação · 💾 Salvar · ↻ Recalcular · 📤 Enviar ao cliente (ou ✓ Fechar) · Reabrir
//   • cliente (locatário): ✓ Aprovar · ✕ Contestar comentando na linha do item
//   • 🖨 Boletim de Medição (PDF) · informativo automático das inspeções do ciclo (só leitura)
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import { abrirMedicao, prepararJanela } from "../../utils/gerarMedicao";

const dataBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const brl = (v) => (v == null || v === "" ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const num = (v) => { if (v === "" || v == null) return null; const t = String(v).trim(); const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t); return Number.isFinite(n) ? n : null; };
const COR = { aberta: "#3b82f6", enviada: "#f59e0b", aprovada: "#22c55e", devolvida: "#ef4444", pendente: "#64748b" };
export const corStatusMedicao = (st) => COR[st] || "#64748b";

/** base: "/contratos" (empresa) ou "/locatario" — o servidor aplica o escopo */
export default function MedicaoModal({ C, s, medicaoId, base = "/contratos", modo = "empresa", podeEditar = true, onFechar, onMudou, onErro, onOk }) {
  const [d, setD] = useState(null); const [ed, setEd] = useState({}); const [obs, setObs] = useState(""); const [ocupado, setOcupado] = useState(false);
  const [coment, setComent] = useState({}); const [motivoGeral, setMotivoGeral] = useState(""); const [contestando, setContestando] = useState(false);
  const [reabrindo, setReabrindo] = useState(null);
  const url = `${base}/medicoes/${medicaoId}`;
  const carregar = async () => {
    try { const r = await apiService.get(url); setD(r);
      setEd(Object.fromEntries((r.medicao.itens || []).map((i) => [String(i.locacao_id), { valor: i.valor == null ? "" : String(i.valor).replace(".", ","), obs: i.obs || "" }])));
      setComent(Object.fromEntries((r.medicao.itens || []).map((i) => [String(i.locacao_id), i.comentario_cliente || ""]))); setObs(r.medicao.obs || ""); }
    catch (e) { onErro(e.message); onFechar(); }
  };
  useEffect(() => { carregar(); }, [medicaoId]); // eslint-disable-line
  if (!d) return null;
  const m = d.medicao; const c = d.contrato; const inf = d.informativo || {}; const pe = inf.por_equipamento || {};
  const cliente = modo === "locatario";
  const editavel = !cliente && podeEditar && ["aberta", "devolvida"].includes(m.status);
  const clienteResponde = cliente && m.status === "enviada";
  const sujo = editavel && ((m.itens || []).some((i) => { const x = ed[String(i.locacao_id)] || {}; return num(x.valor) !== (i.valor ?? null) || String(x.obs || "") !== String(i.obs || ""); }) || obs !== (m.obs || ""));
  const corpo = () => ({ itens: (m.itens || []).map((i) => ({ locacao_id: i.locacao_id, valor: ed[String(i.locacao_id)]?.valor ?? "", obs: ed[String(i.locacao_id)]?.obs ?? "" })), obs });
  const exec = async (fn, msg) => { setOcupado(true); try { const r = await fn(); if (msg) onOk(msg); await carregar(); onMudou?.(); return r; } catch (e) { onErro(e.message); return null; } finally { setOcupado(false); } };
  const salvarSeSujo = async () => (sujo ? exec(() => apiService.put(url, corpo())) : true);
  const total = (m.itens || []).reduce((t, i) => t + (editavel ? (num(ed[String(i.locacao_id)]?.valor) || 0) : Number(i.valor || 0)), 0);
  const imprimir = () => { const w = prepararJanela(); try { abrirMedicao(d, w); } catch (e) { onErro(e.message); } };
  const acao = { background: "transparent", border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 14px", fontSize: 13.5, cursor: "pointer" };
  const th = { padding: 6, fontSize: 11.5, color: C.muted, textAlign: "left", fontWeight: 600 };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090", zIndex: 330, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }} onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: 1000, maxWidth: "100%", margin: "auto 0", padding: "16px 20px", color: C.text }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>📏 Medição {m.rotulo} — {c.numero}</div>
            <div style={{ fontSize: 13.5, color: C.textSub }}>{c.cliente}{c.local ? ` · ${c.local}` : ""} · {dataBR(m.inicio)} a {dataBR(m.fim)}{c.medicao_vencimento_dia ? ` · vencimento dia ${String(c.medicao_vencimento_dia).padStart(2, "0")}` : ""}</div>
          </div>
          <span style={{ ...s.tag(corStatusMedicao(m.status)), fontSize: 12 }}>{m.status_nome}</span>
          <button type="button" onClick={onFechar} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        {!cliente && m.status === "devolvida" && m.devolvido_motivo && <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: `${C.danger}18`, color: C.danger, fontSize: 14 }}>✕ Contestada pelo cliente: {m.devolvido_motivo}</div>}
        {!cliente && ["aberta", "devolvida"].includes(m.status) && c.envio_automatico_em && <div style={{ marginTop: 10, fontSize: 13, padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.accent}`, color: C.text }}>{/* 18zc */}📤 <b>Envio automático em {dataBR(c.envio_automatico_em)}</b> — {m.status === "devolvida" ? "o cliente contestou: não vai sozinha, revise e reenvie." : c.medicao_locatario ? "vai sozinha para o cliente aprovar. Revise antes, se quiser." : "fecha sozinha e o resumo vai por e-mail ao contato. Revise antes, se quiser."}</div>}
        {!cliente && m.status === "aberta" && <div style={{ marginTop: 10, fontSize: 13.5, color: C.textSub }}>Medição montada pelo sistema: valor mensal do contrato, proporcional aos dias no ciclo. Revise o <b>valor a cobrar</b> e {c.medicao_locatario ? <>📤 envie ao cliente para aprovar.</> : <>✓ feche (este contrato não pede aprovação do cliente).</>}</div>}
        {clienteResponde && <div style={{ marginTop: 10, fontSize: 14, color: C.textSub }}>Confira os valores. Se estiver tudo certo, <b>✓ Aprove</b>. Se algo não estiver de acordo, escreva na linha do item e clique em <b>✕ Contestar</b>.</div>}

        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead><tr><th style={th}>EQUIPAMENTO</th><th style={th}>PERÍODO NO CICLO</th><th style={{ ...th, textAlign: "right" }}>VALOR MENSAL / BASE</th>{!cliente && <th style={{ ...th, textAlign: "right" }}>RECOMENDADO</th>}
              <th style={{ ...th, textAlign: "right", width: 150 }}>{cliente ? "VALOR" : "VALOR A COBRAR"}</th><th style={th}>OBSERVAÇÃO</th><th style={th}>{cliente ? "SEU COMENTÁRIO" : "COMENTÁRIO DO CLIENTE"}</th></tr></thead>
            <tbody>{(m.itens || []).map((i) => { const k = String(i.locacao_id); const x = ed[k] || {}; const v = editavel ? num(x.valor) : i.valor;
              const ajustado = v != null && i.valor_recomendado != null && Math.abs(v - i.valor_recomendado) > 0.005;
              return <tr key={k} style={{ borderTop: `1px solid ${C.border}`, verticalAlign: "top" }}>
                <td style={{ padding: 6 }}><b>{i.tag}</b> <span style={{ color: C.textSub }}>{i.nome}</span>{!cliente && i.novo && <div style={{ fontSize: 11.5, color: C.warn }}>entrou no contrato depois da revisão — confira o valor</div>}</td>
                <td style={{ padding: 6, whiteSpace: "nowrap", color: C.textSub }}>{dataBR(i.de)} a {dataBR(i.ate)}<div style={{ fontSize: 12.5 }}>{String(i.tipo || "").startsWith("armazenagem") ? (i.tipo === "armazenagem" ? `${i.dias} dia(s) no pátio${i.saiu_em ? ` · saiu ${dataBR(i.saiu_em)}` : ""}` : "ciclo inteiro") : `${i.dias} de ${i.dias_ciclo} dia(s)${i.dias < i.dias_ciclo ? " · proporcional" : ""}`}</div></td>
                <td style={{ padding: 6, textAlign: "right", whiteSpace: "nowrap" }}>{String(i.tipo || "").startsWith("armazenagem") ? <span style={{ fontSize: 12.5, whiteSpace: "normal", color: i.area_m2 == null && i.tipo === "armazenagem" ? C.warn : C.textSub }}>{i.base}</span> : i.valor_mensal != null ? brl(i.valor_mensal) : <span style={{ color: C.warn }}>sem valor no contrato</span>}</td>
                {!cliente && <td style={{ padding: 6, textAlign: "right", whiteSpace: "nowrap", color: C.textSub }}>{brl(i.valor_recomendado)}</td>}
                <td style={{ padding: 6, textAlign: "right" }}>{editavel ? <input inputMode="decimal" value={x.valor ?? ""} onChange={(e) => setEd({ ...ed, [k]: { ...x, valor: e.target.value } })} style={{ ...s.input, padding: "6px 8px", fontSize: 14, textAlign: "right", borderColor: ajustado ? C.warn : undefined }} />
                  : <b>{brl(i.valor)}</b>}{!cliente && ajustado && <div style={{ fontSize: 11.5, color: C.warn }}>ajustado</div>}</td>
                <td style={{ padding: 6 }}>{editavel ? <input value={x.obs || ""} onChange={(e) => setEd({ ...ed, [k]: { ...x, obs: e.target.value } })} placeholder="opcional" style={{ ...s.input, padding: "6px 8px", fontSize: 13.5 }} /> : <span style={{ color: C.textSub }}>{i.obs || ""}</span>}</td>
                <td style={{ padding: 6 }}>{clienteResponde ? <input value={coment[k] || ""} onChange={(e) => setComent({ ...coment, [k]: e.target.value })} placeholder="só se não estiver de acordo" style={{ ...s.input, padding: "6px 8px", fontSize: 13.5 }} />
                  : <span style={{ color: i.comentario_cliente ? C.danger : C.muted }}>{i.comentario_cliente || ""}</span>}</td>
              </tr>; })}</tbody>
            <tfoot><tr><td colSpan={cliente ? 3 : 4} style={{ padding: 6, textAlign: "right", color: C.textSub }}>Total{!cliente && m.total_recomendado != null ? <span style={{ color: C.muted }}> (recomendado {brl(m.total_recomendado)})</span> : null}</td>
              <td style={{ padding: 6, textAlign: "right", fontSize: 15 }}><b>{brl(total)}</b></td><td colSpan={2} /></tr></tfoot>
          </table>
          {!(m.itens || []).length && <div style={{ color: C.muted, padding: 10 }}>Nenhum equipamento no contrato neste ciclo.</div>}
        </div>
        <label style={{ display: "block", marginTop: 10 }}><span style={s.label}>OBSERVAÇÕES GERAIS</span>
          {editavel ? <textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="opcional — vai no boletim" style={{ ...s.input, resize: "vertical", fontSize: 14 }} /> : <div style={{ fontSize: 14, color: C.textSub }}>{m.obs || "—"}</div>}</label>

        <div style={{ ...s.card, background: C.bg, padding: "10px 12px", marginTop: 12 }}>
          <div style={{ ...s.label, marginBottom: 6 }}>INFORMATIVO DO SISTEMA — INSPEÇÕES NO PERÍODO{m.status === "aprovada" ? " (congelado no fechamento)" : ""}</div>
          <div style={{ fontSize: 13.5 }}>{inf.total ? <>Previstas <b>{inf.total.previstas}</b> · no prazo <b style={{ color: inf.total.previstas && inf.total.no_prazo < inf.total.previstas ? C.warn : C.success }}>{inf.total.no_prazo}</b> · feitas {inf.total.feitas} · reprovadas <b style={{ color: inf.total.reprovadas ? C.danger : C.text }}>{inf.total.reprovadas}</b></> : "—"}</div>
          {(m.itens || []).map((i) => { const x = i.equipamento_id != null ? pe[String(i.equipamento_id)] : null; if (!x || (!x.previstas && !x.feitas)) return null;
            return <div key={i.locacao_id} style={{ fontSize: 13, color: C.textSub, padding: "2px 0" }}><b style={{ color: C.text }}>{i.tag}</b>: {x.no_prazo}/{x.previstas} no prazo · {x.feitas} feita(s){x.reprovadas ? ` · ${x.reprovadas} reprovada(s)` : ""}</div>; })}
        </div>
        {!cliente && (d.paradas || []).length > 0 && <div style={{ ...s.card, background: C.bg, padding: "10px 12px", marginTop: 10, borderColor: C.danger }}>{/* 18h: só informa — o comercial decide */}
          <div style={{ ...s.label, marginBottom: 6 }}>⚠️ EQUIPAMENTO PARADO NO CICLO (OCORRÊNCIAS) — nada é descontado sozinho</div>
          {d.paradas.map((p) => <div key={p.id} style={{ fontSize: 13, padding: "2px 0" }}><b>{p.equipamento}</b>: {p.dias} dia(s) · {p.numero} · {p.tipo} · {p.status} · responsabilidade: {p.responsabilidade}</div>)}
        </div>}
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>{m.preenchido_por ? `Revisado por ${m.preenchido_por} em ${dataHora(m.preenchido_em)}. ` : ""}{m.enviado_por ? `Enviado por ${m.enviado_por} em ${dataHora(m.enviado_em)}. ` : ""}{m.aprovado_por ? `Aprovado por ${m.aprovado_por} em ${dataHora(m.aprovado_em)}.` : ""}</div>

        {contestando && <div style={{ ...s.card, background: C.bg, padding: 10, marginTop: 10 }}>
          <div style={{ fontSize: 14, marginBottom: 6 }}>✕ Contestar — comente na linha do item e/ou aqui o que não está de acordo:</div>
          <textarea rows={2} autoFocus value={motivoGeral} onChange={(e) => setMotivoGeral(e.target.value)} placeholder="opcional se você já comentou na linha" style={{ ...s.input, resize: "vertical", fontSize: 14 }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}><button type="button" onClick={() => setContestando(false)} style={acao}>Voltar</button>
            <button type="button" disabled={ocupado || (!motivoGeral.trim() && !Object.values(coment).some((t) => String(t).trim()))}
              onClick={async () => { const r = await exec(() => apiService.post(`${url}/contestar`, { motivo: motivoGeral, itens: (m.itens || []).map((i) => ({ locacao_id: i.locacao_id, comentario: coment[String(i.locacao_id)] || "" })) }), "Contestação enviada à locadora."); if (r) setContestando(false); }}
              style={{ ...s.btn(true, C.danger), padding: "8px 14px" }}>✕ Enviar contestação</button></div>
        </div>}
        {reabrindo != null && <div style={{ ...s.card, background: C.bg, padding: 10, marginTop: 10 }}>
          <div style={{ fontSize: 14, marginBottom: 6 }}>Reabrir a medição — por quê?</div>
          <textarea rows={2} autoFocus value={reabrindo} onChange={(e) => setReabrindo(e.target.value)} style={{ ...s.input, resize: "vertical", fontSize: 14 }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}><button type="button" onClick={() => setReabrindo(null)} style={acao}>Voltar</button>
            <button type="button" disabled={ocupado || !reabrindo.trim()} onClick={async () => { const r = await exec(() => apiService.post(`${url}/reabrir`, { motivo: reabrindo }), "Medição reaberta."); if (r) setReabrindo(null); }} style={{ ...s.btn(true, C.danger), padding: "8px 14px" }}>Reabrir</button></div>
        </div>}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, justifyContent: "flex-end" }}>
          <button type="button" onClick={imprimir} style={acao}>🖨 Boletim de Medição</button>
          <div style={{ flex: 1 }} />
          {editavel && <button type="button" disabled={ocupado} onClick={() => exec(() => apiService.post(`${url}/recalcular`, {}), "Medição recalculada com os dados atuais do contrato.")} title="Refaz os valores recomendados com os equipamentos e valores atuais do contrato" style={acao}>↻ Recalcular</button>}
          {editavel && <button type="button" disabled={ocupado || !sujo} onClick={() => exec(() => apiService.put(url, corpo()), "Medição salva.")} style={acao}>💾 Salvar</button>}
          {editavel && <button type="button" disabled={ocupado} onClick={async () => { if (!(await salvarSeSujo())) return; exec(() => apiService.post(`${url}/enviar`, {}), c.medicao_locatario ? "📤 Medição enviada ao cliente — ele recebe o e-mail e a pendência no acesso dele." : "✓ Medição fechada."); }}
            style={{ ...s.btn(true, c.medicao_locatario ? C.accent : C.success), padding: "8px 16px" }}>{c.medicao_locatario ? (m.status === "devolvida" ? "📤 Reenviar ao cliente" : "📤 Enviar ao cliente") : "✓ Fechar medição"}</button>}
          {!cliente && podeEditar && ["enviada", "aprovada"].includes(m.status) && <button type="button" disabled={ocupado} onClick={() => setReabrindo("")} style={acao}>Reabrir</button>}
          {clienteResponde && !contestando && <button type="button" disabled={ocupado} onClick={() => setContestando(true)} style={{ ...acao, color: C.danger, borderColor: `${C.danger}66` }}>✕ Contestar</button>}
          {clienteResponde && !contestando && <button type="button" disabled={ocupado} onClick={() => exec(() => apiService.post(`${url}/aprovar`, {}), "✓ Medição aprovada. Obrigado!")} style={{ ...s.btn(true, C.success), padding: "8px 16px" }}>✓ Aprovar</button>}
        </div>
      </div>
    </div>
  );
}

/** lista de ciclos de um contrato (empresa) — abre a medição (gera se ainda não existe) */
export function CiclosMedicao({ C, s, ciclos = [], onAbrir, podeAbrir = true, limite = 6 }) {
  const [todos, setTodos] = useState(false);
  const l = todos ? ciclos : ciclos.slice(0, limite);
  return <div>
    {l.map((x) => <div key={x.inicio} className={x.medicao_id || podeAbrir ? "qf-clicavel" : undefined} onClick={() => (x.medicao_id || podeAbrir) && onAbrir(x)}
      style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 0", borderTop: `1px solid ${C.border}`, fontSize: 13.5, cursor: x.medicao_id || podeAbrir ? "pointer" : "default", flexWrap: "wrap" }}>
      <span style={{ flex: "1 1 200px" }}>📏 <b>{x.rotulo}</b> <span style={{ color: C.muted }}>· {dataBR(x.inicio)} a {dataBR(x.fim)}{x.em_andamento ? " · em andamento" : ""}</span></span>
      {x.total_cobrar != null && <span style={{ fontSize: 13, color: C.textSub }}>{brl(x.total_cobrar)}{x.comentarios ? ` · ${x.comentarios} comentário(s) do cliente` : ""}</span>}
      <span style={s.tag(corStatusMedicao(x.status))}>{x.status_nome}</span>
      {(x.medicao_id || podeAbrir) && <span style={{ color: C.accent }}>{x.medicao_id ? "abrir ›" : "＋ gerar"}</span>}
    </div>)}
    {ciclos.length > limite && <button type="button" onClick={() => setTodos(!todos)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 13, padding: "6px 0" }}>{todos ? "mostrar menos" : `ver todos (${ciclos.length})`}</button>}
    {!ciclos.length && <div style={{ fontSize: 13, color: C.muted, padding: "6px 0" }}>Sem ciclos ainda.</div>}
  </div>;
}
