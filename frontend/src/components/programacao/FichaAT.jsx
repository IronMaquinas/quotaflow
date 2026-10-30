// components/programacao/FichaAT.jsx — etapa 16a
//   (16c: programar/editar agora é o EditorAT — modal da mesa; aqui fica a ficha)
//              (🔒 bloqueados não entram). Respostas do servidor:
//                · motorista 🔴 → caixa de LIBERAÇÃO (só gestor/admin, com justificativa — fica registrada)
//                · conflito de agenda → mostra os conflitos e "Programar mesmo assim"
//   FichaAT  — detalhe: rota, itens (sem valores), motorista, conjunto, anexos NF-e/CT-e/MDF-e, ▶ iniciar · ✓ concluir · ✕ cancelar · ↺ reabrir, 📄 PDF
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import { abrirAT } from "../../utils/gerarAT";
import { valorCelula } from "../../utils/gerarBid";
import EditorAT from "./EditorAT";
import VerArquivo, { ChipDoc, TXT_DOC } from "./VerArquivo";

export const COR_STATUS = { programada: "#3b82f6", em_execucao: "#f59e0b", concluida: "#22c55e", cancelada: "#ef4444" };
export const NOME_STATUS = { programada: "Programada", em_execucao: "Em execução", concluida: "Concluída", cancelada: "Cancelada" };
export const SELO = { conforme: ["🟢", "#22c55e", "conforme"], em_andamento: ["🟡", "#f59e0b", "falta registro"], atencao: ["🔴", "#ef4444", "item vencido"], sem_funcao: ["⚪", "#64748b", "sem função"] };
export const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const local = (iso) => (iso ? new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 16) : "");
const casca = (s, conteudo, fechar, largura = 720, z = 330) => (
  <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: z, padding: 16, overflowY: "auto" }} onClick={fechar}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: largura, maxWidth: "100%", padding: "18px 20px", margin: "auto 0", boxShadow: "0 24px 48px #00000060" }}>{conteudo}</div>
  </div>
);
const seloTxt = (m) => { const x = SELO[m?.selo?.nivel] || SELO.sem_funcao; return `${x[0]} ${x[2]}${m?.selo?.geral != null ? ` · ${m.selo.geral}%` : ""}`; };

export default function FichaAT({ C, s, id, podeLiberar, onFechar, onMudou, onErro, onOk }) {
  const [d, setD] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [modal, setModal] = useState(null); // { tipo: cancelar|editar|anexo }
  const [ver, setVer] = useState(null);
  const [liberando, setLiberando] = useState(null); // 16e: { id, motivo }
  const [base, setBase] = useState(null);
  const carregar = async () => { try { setD(await apiService.get(`/programacao/execucoes/${id}`)); } catch (e) { onErro(e.message); onFechar(); } };
  useEffect(() => { carregar(); }, [id]); // eslint-disable-line
  if (!d) return null;
  const e = d.execucao; const temFluxo = (e.fluxo || []).length > 0; const cols = (e.colunas || []).filter((c) => c.chave !== "data_prevista");
  const acao = async (a, extra = {}, msg) => { setOcupado(true); try { await apiService.post(`/programacao/execucoes/${e.id}/status`, { acao: a, ...extra }); onOk(msg); setModal(null); await carregar(); onMudou?.(); } catch (er) { onErro(er.message); } finally { setOcupado(false); } };
  const pdf = async () => { const w = window.open("", "_blank"); try { abrirAT(await apiService.get(`/programacao/execucoes/${e.id}/documento`), w); } catch (er) { if (w) w.close(); onErro(er.message); } };
  const abrirAnexo = async (a) => { setVer({ nome: a.nome, mime: a.mime }); try { const r = await apiService.get(`/programacao/execucoes/${e.id}/anexos/${a.id}`); setVer({ url: r.url, nome: a.nome, mime: a.mime }); } catch (er) { setVer(null); onErro(er.message); } };
  const verDoc = async (x) => {
    if (!x.documento_id || !x.tem_arquivo) return onErro(`${x.rotulo} de ${x.dono}: ${x.documento_id ? "cadastrado sem arquivo" : "não está cadastrado"} — inclua em ${x.alvo === "motorista" ? "👷 Pessoas → Documentos" : "documentos do equipamento"}.`);
    setVer({ nome: `${x.rotulo} — ${x.dono}` }); try { const r = await apiService.get(`/programacao/documentos/${x.documento_id}`); setVer({ url: r.url, nome: r.nome, mime: r.mime }); } catch (er) { setVer(null); onErro(er.message); }
  };
  const liberarEtapa = async () => { setOcupado(true); try { await apiService.post(`/programacao/execucoes/${e.id}/fluxo/${liberando.id}/liberar`, { motivo: liberando.motivo }); setLiberando(null); onOk("Etapa liberada — o motorista pode seguir."); await carregar(); onMudou?.(); } catch (er) { onErro(er.message); } finally { setOcupado(false); } };
  const editar = async () => { try { setBase(base || await apiService.get("/programacao/base")); setModal({ tipo: "editar" }); } catch (er) { onErro(er.message); } };
  const copiarLink = async () => { try { await navigator.clipboard.writeText(e.link_motorista); onOk("📲 Link copiado — cole no WhatsApp do motorista."); } catch { onErro(`Copie o link: ${e.link_motorista}`); } };
  const textoZap = () => `Olá${e.motorista_nome ? `, ${e.motorista_nome.split(" ")[0]}` : ""}! Sua viagem ${e.numero}: ${e.origem || "—"} ➜ ${e.destino || "—"}, coleta ${dataHora(e.inicio_previsto)}. Rota e documentos: ${e.link_motorista}`;
  const removerAnexo = async (a) => { setOcupado(true); try { await apiService.delete(`/programacao/execucoes/${e.id}/anexos/${a.id}`); await carregar(); } catch (er) { onErro(er.message); } finally { setOcupado(false); } };
  const enviarAnexo = async (tipo, arq) => {
    if (!arq) return; if (arq.size > 10 * 1024 * 1024) return onErro("Arquivo maior que 10 MB");
    const mime = arq.type || (/\.xml$/i.test(arq.name) ? "application/xml" : "");
    setOcupado(true);
    try {
      const base64 = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = ko; r.readAsDataURL(arq); });
      await apiService.post(`/programacao/execucoes/${e.id}/anexos`, { tipo, nome: arq.name, mime, base64 }); onOk(`${arq.name} anexado.`); setModal(null); await carregar();
    } catch (er) { onErro(er.message); } finally { setOcupado(false); }
  };
  const bt = (c, cheio = true) => ({ ...s.btn(true, c), cursor: "pointer", padding: "7px 12px", fontSize: 12, ...(cheio ? {} : { background: "transparent", color: c }) });
  const cor = COR_STATUS[e.status];
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090", zIndex: 310, display: "flex", justifyContent: "center", padding: 12, overflowY: "auto" }} onClick={onFechar}>
      <div onClick={(x) => x.stopPropagation()} style={{ ...s.card, width: 1080, maxWidth: "100%", margin: "auto 0", padding: 0, overflow: "hidden", color: C.text }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><span style={{ fontWeight: 800, fontSize: 17 }}>🚛 {e.numero}</span><span style={s.tag(cor)}>{NOME_STATUS[e.status]}</span>
              {e.atrasada && <span style={s.tag(C.danger)}>⏰ coleta passou</span>}{e.conflitos?.length > 0 && <span style={s.tag(C.warn)}>⚠ conflito de agenda</span>}{e.liberacao && <span style={s.tag(C.danger)}>🔓 motorista liberado</span>}</div>
            <div style={{ fontSize: 13, color: C.textSub, marginTop: 3 }}><b style={{ color: C.text }}>{e.cliente_nome}</b> · {e.grupo_titulo}{e.ref ? <span title="Rastreabilidade: BID · item · pedido"> · 🔗 {e.ref}</span> : ` · ${e.pv_numero}`}</div>
          </div>
          <button type="button" onClick={onFechar} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: "10px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={pdf} style={bt(C.textSub, false)}>📄 PDF da AT</button>
          {e.status === "programada" && <button type="button" onClick={editar} style={bt(C.textSub, false)}>✏ Editar</button>}
          <div style={{ flex: 1 }} />
          {temFluxo && ["programada", "em_execucao"].includes(e.status) && <span style={{ fontSize: 12, color: C.muted, alignSelf: "center" }}>🧭 O motorista conduz a viagem pelo 📲 link — começa e termina sozinha</span>}
          {!temFluxo && e.status === "programada" && <button type="button" disabled={ocupado} onClick={() => acao("iniciar", {}, `${e.numero} em execução.`)} style={bt(C.warn)}>▶ Iniciar</button>}
          {!temFluxo && e.status === "em_execucao" && <button type="button" disabled={ocupado} onClick={() => acao("concluir", {}, `${e.numero} concluída.`)} style={bt(C.success)}>✓ Concluir</button>}
          {["programada", "em_execucao"].includes(e.status) && <button type="button" disabled={ocupado} onClick={() => setModal({ tipo: "cancelar", motivo: "" })} style={bt(C.danger, false)}>✕ Cancelar AT</button>}
          {["concluida", "cancelada"].includes(e.status) && <button type="button" disabled={ocupado} onClick={() => acao("reabrir", {}, `${e.numero} reaberta.`)} style={bt(C.warn, false)}>↺ Reabrir</button>}
        </div>
        {(e.conflitos?.length > 0 || e.bloqueados?.length > 0 || e.cancelada_motivo) && <div style={{ padding: "8px 18px", background: `${C.warn}14`, borderBottom: `1px solid ${C.border}`, fontSize: 12.5 }}>
          {(e.bloqueados || []).map((x, i) => <div key={`b${i}`} style={{ color: C.danger }}>🔒 {x.tag || x.nome} foi bloqueado por inspeção{x.motivo ? ` (${x.motivo})` : ""} — troque o equipamento (✏ Editar) ou libere em 🔍 Inspeções.</div>)}
          {(e.conflitos || []).map((x, i) => <div key={`c${i}`} style={{ color: C.warn }}>⚠ {x.texto}</div>)}
          {e.cancelada_motivo && <div style={{ color: C.danger }}>✕ Cancelada em {dataHora(e.cancelada_em)}: {e.cancelada_motivo}</div>}
        </div>}
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          <div style={{ flex: "3 1 560px", minWidth: 0, padding: "14px 18px", borderRight: `1px solid ${C.border}` }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center", ...s.card, padding: 12, background: C.bg }}>
              <div><div style={s.label}>COLETA</div><div style={{ fontWeight: 600 }}>{e.origem || "—"}</div><div style={{ fontSize: 12.5, color: C.textSub }}>{dataHora(e.inicio_previsto)}</div></div>
              <div style={{ fontSize: 22, color: C.muted }}>➜</div>
              <div><div style={s.label}>ENTREGA</div><div style={{ fontWeight: 600 }}>{e.destino || "—"}</div><div style={{ fontSize: 12.5, color: C.textSub }}>{e.fim_previsto ? dataHora(e.fim_previsto) : "—"}</div></div>
            </div>
            <div style={{ ...s.label, marginTop: 14 }}>CARGA — ITENS DO TRECHO ({e.itens.length})</div>
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr><th style={{ textAlign: "left", color: C.muted, fontSize: 10, padding: 4 }}>#</th>{cols.map((c) => <th key={c.chave} style={{ textAlign: "left", color: C.muted, fontSize: 10, padding: 4 }}>{c.rotulo.toUpperCase()}</th>)}<th style={{ textAlign: "left", color: C.muted, fontSize: 10, padding: 4 }}>Nº DE SÉRIE</th><th style={{ textAlign: "left", color: C.muted, fontSize: 10, padding: 4 }}>QTD</th></tr></thead>
              <tbody>{e.itens.map((i) => <tr key={i.id}><td style={{ padding: 4, borderTop: `1px solid ${C.border}`, fontWeight: 700 }}>{i.n || "—"}</td>{cols.map((c) => <td key={c.chave} style={{ padding: 4, borderTop: `1px solid ${C.border}` }}>{valorCelula(c, i.valores?.[c.chave])}</td>)}<td style={{ padding: 4, borderTop: `1px solid ${C.border}` }}>{i.serie || <span style={{ color: C.warn }}>—</span>}</td><td style={{ padding: 4, borderTop: `1px solid ${C.border}` }}>{i.quantidade ?? 1}</td></tr>)}</tbody></table></div>
            {temFluxo && <><div style={{ ...s.label, marginTop: 14 }}>🧭 FLUXO DA VIAGEM — {e.fluxo.filter((x) => x.status !== "pendente").length}/{e.fluxo.length}</div>
              {e.fluxo.map((x, i) => { const cor = x.status === "feita" ? C.success : x.status === "reprovada" ? (x.liberacao ? C.warn : C.danger) : x.liberada ? C.accent : C.muted;
                return <div key={x.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0", borderTop: i ? `1px solid ${C.border}` : "none", fontSize: 12.5 }}>
                  <span style={{ width: 20, height: 20, borderRadius: 10, background: `${cor}22`, border: `1px solid ${cor}`, color: cor, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, flex: "0 0 20px" }}>{x.status === "feita" ? "✓" : x.status === "reprovada" ? "!" : i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: x.status === "pendente" && !x.liberada ? C.textSub : C.text, fontWeight: x.liberada ? 700 : 400 }}>{x.rotulo}{x.tipo === "inspecao" && x.modelo_nome ? <span style={{ color: C.muted, fontWeight: 400 }}> · {x.modelo_nome}{x.modelo_tipo !== "equipamento" && x.equipamento_tag ? ` · ${x.equipamento_tag}` : ""}</span> : null}{x.liberada ? <span style={{ color: C.accent, fontWeight: 400 }}> ← próxima</span> : null}</div>
                    {x.status !== "pendente" && <div style={{ fontSize: 11.5, color: C.muted }}>{dataHora(x.feita_em)}{x.por ? ` · ${x.por}` : ""}{x.inspecao_numero ? ` · ${x.inspecao_numero} (${x.resultado})` : ""}{x.gps ? <> · <a href={`https://www.google.com/maps?q=${x.gps.lat},${x.gps.lng}`} target="_blank" rel="noreferrer" style={{ color: C.accent }}>📍 local</a></> : null}</div>}
                    {x.status === "reprovada" && (x.liberacao ? <div style={{ fontSize: 11.5, color: C.warn }}>🔓 Liberada por {x.liberacao.por} em {dataHora(x.liberacao.em)}: “{x.liberacao.motivo}”</div>
                      : podeLiberar ? (liberando?.id === x.id ? <div style={{ marginTop: 4 }}><textarea rows={2} value={liberando.motivo} onChange={(ev) => setLiberando({ ...liberando, motivo: ev.target.value })} placeholder="Por que está liberando? (mínimo 10 caracteres — fica na AT; libera também o equipamento)" style={{ ...s.input, resize: "vertical", fontSize: 12 }} />
                        <div style={{ display: "flex", gap: 6, marginTop: 4 }}><button type="button" onClick={() => setLiberando(null)} style={{ ...s.btn(false), cursor: "pointer", color: C.text, padding: "4px 10px", fontSize: 12 }}>Voltar</button>
                          <button type="button" disabled={ocupado || liberando.motivo.trim().length < 10} onClick={liberarEtapa} style={{ ...s.btn(liberando.motivo.trim().length >= 10, C.danger), padding: "4px 10px", fontSize: 12 }}>🔓 Liberar e seguir</button></div></div>
                        : <button type="button" onClick={() => setLiberando({ id: x.id, motivo: "" })} style={{ ...s.btn(true, C.danger), padding: "4px 10px", fontSize: 12, marginTop: 4 }}>⛔ Reprovada — liberar para seguir</button>)
                      : <div style={{ fontSize: 11.5, color: C.danger }}>⛔ Reprovada — o motorista está parado aguardando um gestor liberar.</div>)}
                  </div></div>; })}</>}
            {e.observacoes && <><div style={{ ...s.label, marginTop: 14 }}>OBSERVAÇÕES</div><div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{e.observacoes}</div></>}
            <div style={{ fontSize: 11, color: C.muted, marginTop: 14 }}>Iniciar e concluir a AT atualiza sozinho o status dos itens no pedido {e.pv_numero}. Valores não aparecem aqui (ficam no 📈 Comercial).</div>
          </div>
          <div style={{ flex: "1 1 300px", minWidth: 0, padding: "14px 16px", background: C.bg }}>
            <div style={s.label}>MOTORISTA</div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{e.motorista_nome || <span style={{ color: C.warn }}>— a definir —</span>}</div>
            {e.motorista_selo && <div style={{ fontSize: 12, color: (SELO[e.motorista_selo.nivel] || SELO.sem_funcao)[1] }}>{seloTxt({ selo: e.motorista_selo })} (na programação)</div>}
            {e.liberacao && <div style={{ fontSize: 12, color: C.danger, marginTop: 4 }}>🔓 Liberado por {e.liberacao.por} em {dataHora(e.liberacao.em)}: “{e.liberacao.justificativa}”</div>}
            <div style={{ ...s.label, marginTop: 14 }}>CONJUNTO</div>
            {(e.conjunto || []).map((c) => <div key={c.id} style={{ fontSize: 13, padding: "3px 0" }}>{c.papel === "cavalo" ? "🚛" : "🔗"} <b>{c.tag}</b> {c.nome}</div>)}
            <div style={{ ...s.label, marginTop: 14 }}>KIT DO MOTORISTA</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{(e.docs || []).map((x) => <ChipDoc key={x.chave} C={C} status={x.status} rotulo={`${x.rotulo} ${x.dono}`} title={`${TXT_DOC[x.status]}${x.vence_em ? ` · vence ${String(x.vence_em).split("-").reverse().join("/")}` : ""}`} onClick={() => verDoc(x)} />)}</div>
            {e.liberacao_docs && <div style={{ fontSize: 12, color: C.danger, marginTop: 4 }}>🔓 Documento vencido liberado por {e.liberacao_docs.por} em {dataHora(e.liberacao_docs.em)}: “{e.liberacao_docs.justificativa}”</div>}
            {e.link_motorista && <div style={{ ...s.card, padding: "8px 10px", marginTop: 8, background: "transparent" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>📲 Link do motorista {e.link_visto_em ? <span style={{ color: C.success, fontWeight: 400, fontSize: 11 }}>✓✓ aberto em {dataHora(e.link_visto_em)}</span> : <span style={{ color: C.muted, fontWeight: 400, fontSize: 11 }}>ainda não aberto</span>}</div>
              <div style={{ fontSize: 11, color: C.muted, margin: "2px 0 6px" }}>Rota (com atalho para o Maps), dados da viagem e o kit de documentos no celular — sem login, sem valores.</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button type="button" onClick={copiarLink} style={{ ...s.btn(false), cursor: "pointer", color: C.text, padding: "5px 10px", fontSize: 12 }}>📋 Copiar link</button>
                <a href={`https://wa.me/?text=${encodeURIComponent(textoZap())}`} target="_blank" rel="noreferrer" style={{ ...s.btn(true, "#25d366"), padding: "5px 10px", fontSize: 12, textDecoration: "none" }}>WhatsApp</a>
                <a href={e.link_motorista} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.accent, alignSelf: "center" }}>ver como o motorista ↗</a></div>
            </div>}
            <div style={{ ...s.label, marginTop: 14 }}>DOCUMENTOS FISCAIS</div>
            {(e.anexos || []).map((a) => <div key={a.id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={s.tag(C.accent)}>{d.anexos_tipos?.[a.tipo] || a.tipo}</span><button type="button" className="qf-clicavel" onClick={() => abrirAnexo(a)} style={{ background: "none", border: "none", color: C.text, padding: 0, fontSize: 12.5, flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nome}</button>
              {e.status !== "concluida" && <button type="button" title="Remover" onClick={() => removerAnexo(a)} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer" }}>✕</button>}</div>)}
            {!(e.anexos || []).length && <div style={{ fontSize: 12, color: C.muted }}>Nenhum ainda.</div>}
            {e.status !== "concluida" && e.status !== "cancelada" && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>{Object.entries(d.anexos_tipos || {}).map(([k, l]) => (
              <label key={k} style={{ ...s.tag(C.accent), cursor: "pointer", padding: "4px 8px" }}>＋ {l}<input type="file" accept=".pdf,.xml,.jpg,.jpeg,.png" style={{ display: "none" }} disabled={ocupado} onChange={(x) => { enviarAnexo(k, x.target.files?.[0]); x.target.value = ""; }} /></label>))}</div>}
            <div style={{ fontSize: 11, color: C.muted, marginTop: 14 }}>Programada por {e.criado_por_nome || "—"} em {dataHora(e.criado_em)}{e.iniciada_em ? ` · iniciada ${dataHora(e.iniciada_em)}` : ""}{e.concluida_em ? ` · concluída ${dataHora(e.concluida_em)}` : ""}</div>
          </div>
        </div>
      </div>
      {modal?.tipo === "editar" && base && <EditorAT C={C} s={s} pv={{ id: e.pv_id, numero: e.pv_numero, colunas: (e.colunas || []).filter((c) => c.chave !== "data_prevista") }} trecho={{ id: e.grupo_id, titulo: e.grupo_titulo }} atual={e} base={base} podeLiberar={podeLiberar}
        onErro={onErro} onFechar={() => setModal(null)} onSalvo={async (msg) => { setModal(null); onOk(msg); await carregar(); onMudou?.(); }} />}
      {ver && <VerArquivo C={C} s={s} arquivo={ver} onFechar={() => setVer(null)} />}
      {modal?.tipo === "cancelar" && casca(s, <>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Cancelar a {e.numero}?</div>
        <div style={{ fontSize: 13, color: C.textSub, marginBottom: 8 }}>Os itens do trecho voltam para "a programar" no pedido {e.pv_numero}. O motivo fica registrado.</div>
        <textarea rows={2} value={modal.motivo} onChange={(x) => setModal({ ...modal, motivo: x.target.value })} placeholder="Motivo (mínimo 10 caracteres)" style={{ ...s.input, resize: "vertical" }} />
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}><button type="button" onClick={() => setModal(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Voltar</button>
          <button type="button" disabled={ocupado || modal.motivo.trim().length < 10} onClick={() => acao("cancelar", { motivo: modal.motivo }, `${e.numero} cancelada.`)} style={{ ...s.btn(modal.motivo.trim().length >= 10, C.danger), flex: 1 }}>Cancelar AT</button></div>
      </>, () => setModal(null), 460, 340)}
    </div>
  );
}
