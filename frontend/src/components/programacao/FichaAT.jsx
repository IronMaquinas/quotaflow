// components/programacao/FichaAT.jsx — etapa 16a
//   FormAT   — 🚛 programar um trecho (ou editar a AT): coleta/entrega, motorista (selo 🟢🟡🔴⚪), cavalo + até 2 implementos
//              (🔒 bloqueados não entram). Respostas do servidor:
//                · motorista 🔴 → caixa de LIBERAÇÃO (só gestor/admin, com justificativa — fica registrada)
//                · conflito de agenda → mostra os conflitos e "Programar mesmo assim"
//   FichaAT  — detalhe: rota, itens (sem valores), motorista, conjunto, anexos NF-e/CT-e/MDF-e, ▶ iniciar · ✓ concluir · ✕ cancelar · ↺ reabrir, 📄 PDF
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import { abrirAT } from "../../utils/gerarAT";
import { valorCelula } from "../../utils/gerarBid";

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

/** pv: { id, numero }, trecho: { id, titulo, datas }, atual: AT para editar (ou null) */
export function FormAT({ C, s, pv, trecho, colunas = [], atual, podeLiberar, onFechar, onSalvo, onErro }) {
  const [b, setB] = useState(null);
  const [f, setF] = useState(() => ({ inicio: local(atual?.inicio_previsto) || (trecho?.datas?.[0] ? `${trecho.datas[0]}T08:00` : ""), fim: local(atual?.fim_previsto), origem: atual?.origem || "", destino: atual?.destino || "",
    motorista_id: atual?.motorista_id ?? "", cavalo_id: atual?.cavalo_id ?? "", impl1: (atual?.conjunto || []).filter((c) => c.papel === "implemento")[0]?.id ?? "", impl2: (atual?.conjunto || []).filter((c) => c.papel === "implemento")[1]?.id ?? "", observacoes: atual?.observacoes || "" }));
  const [lib, setLib] = useState(null); // { erro, selo } → pede justificativa
  const [just, setJust] = useState("");
  const [conf, setConf] = useState(null); // lista de conflitos
  const [avisos, setAvisos] = useState([]);
  const livres = !atual ? (trecho?.itens || []).filter((i) => !i.at) : [];
  const [selItens, setSelItens] = useState(() => (livres[0] ? [String(livres[0].id)] : [])); // 16a.1: itens desta AT (padrão: 1 item = 1 conjunto)
  const resumoItem = (i) => colunas.slice(0, 4).map((c) => { const v = valorCelula(c, i.valores?.[c.chave]); return v ? `${c.rotulo}: ${v}` : null; }).filter(Boolean).join(" · ") || `Item ${i.id}`;
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { apiService.get("/programacao/base").then(setB).catch((e) => { onErro(e.message); onFechar(); }); }, []); // eslint-disable-line
  if (!b) return casca(s, <div style={{ color: C.muted }}>Carregando motoristas e equipamentos…</div>, onFechar);
  const mot = b.motoristas.find((m) => String(m.id) === String(f.motorista_id));
  const salvar = async (extra = {}) => {
    setOcupado(true);
    const corpo = { grupo_id: trecho?.id, ...(atual ? {} : { itens: selItens }), inicio: f.inicio, fim: f.fim || null, origem: f.origem, destino: f.destino, motorista_id: f.motorista_id || null, cavalo_id: f.cavalo_id || null,
      implementos: [f.impl1, f.impl2].filter((x) => x !== "" && x != null), observacoes: f.observacoes, ...(lib && just.trim() ? { liberacao_justificativa: just } : {}), ...extra };
    try {
      const r = atual ? await apiService.put(`/programacao/execucoes/${atual.id}`, corpo) : await apiService.post(`/programacao/pvs/${pv.id}/at`, corpo);
      onSalvo(r);
    } catch (e) {
      const d = e.data || e.body || e.response || {};
      if (/VENCIDO|Só gestor ou admin pode liberar/.test(e.message)) setLib({ erro: e.message });
      else if (/Conflito de agenda/.test(e.message)) setConf(e.message.replace(/^Conflito de agenda: /, "").split(" · "));
      else onErro(e.message);
      void d;
    } finally { setOcupado(false); }
  };
  const sel = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const lbl = (r, el, flex = "1 1 200px") => <label style={{ flex, display: "block" }}><span style={s.label}>{r}</span>{el}</label>;
  const optEq = (excluir) => b.equipamentos.filter((e) => !excluir.includes(String(e.id))).map((e) => <option key={e.id} value={e.id} disabled={e.bloqueado}>{e.bloqueado ? "🔒 " : ""}{e.tag ? `${e.tag} — ` : ""}{e.nome}{e.bloqueado ? " (bloqueado)" : ""}</option>);
  return casca(s, <>
    <div style={{ fontSize: 16, fontWeight: 700 }}>{atual ? `✏ Editar ${atual.numero}` : "🚛 Programar o trecho"}</div>
    <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 12 }}>{pv?.numero} · <b style={{ color: C.text }}>{trecho?.titulo || atual?.grupo_titulo}</b>{trecho?.datas?.length ? ` · data prevista no pedido: ${trecho.datas.map((d) => d.split("-").reverse().join("/")).join(", ")}` : ""}</div>
    {!atual && (trecho?.itens || []).length > 1 && <div style={{ ...s.card, padding: "8px 12px", marginBottom: 12, background: C.bg }}>
      <div style={{ ...s.label, marginBottom: 4 }}>ITENS DESTA AT — UM CONJUNTO (CAVALO + IMPLEMENTOS)</div>
      {(trecho.itens || []).map((i) => { const ja = !!i.at; const marc = selItens.includes(String(i.id)); return (
        <label key={i.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, padding: "3px 0", opacity: ja ? 0.5 : 1, cursor: ja ? "default" : "pointer" }}>
          <input type="checkbox" disabled={ja} checked={ja || marc} onChange={() => setSelItens((x) => (marc ? x.filter((y) => y !== String(i.id)) : [...x, String(i.id)]))} />
          <span style={{ flex: 1 }}>{resumoItem(i)}{Number(i.quantidade || 1) !== 1 ? ` · qtd ${i.quantidade}` : ""}</span>{ja && <span style={{ fontSize: 11, color: C.muted }}>já na {i.at}</span>}
        </label>); })}
      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Marque o que vai neste conjunto. Os outros itens continuam “a programar” — programe cada conjunto em seguida.</div>
    </div>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{lbl("COLETA — LOCAL", <input value={f.origem} onChange={(e) => sel("origem", e.target.value)} placeholder="Ex.: Pátio Serra/ES" style={s.input} />)}{lbl("COLETA — DATA E HORA *", <input type="datetime-local" value={f.inicio} onChange={(e) => sel("inicio", e.target.value)} style={s.input} />, "0 1 210px")}</div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{lbl("ENTREGA — LOCAL", <input value={f.destino} onChange={(e) => sel("destino", e.target.value)} placeholder="Ex.: Obra BR-040, BH/MG" style={s.input} />)}{lbl("ENTREGA — DATA E HORA", <input type="datetime-local" value={f.fim} onChange={(e) => sel("fim", e.target.value)} style={s.input} />, "0 1 210px")}</div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
      {lbl("MOTORISTA", <select value={f.motorista_id} onChange={(e) => { sel("motorista_id", e.target.value); setLib(null); setJust(""); }} style={s.input}><option value="">— definir depois —</option>
        {b.motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}{m.cnh ? ` · CNH ${m.cnh}` : ""} · {seloTxt(m)}</option>)}</select>, "1 1 100%")}
    </div>
    {mot && <div style={{ fontSize: 12, marginTop: 4, color: (SELO[mot.selo?.nivel] || SELO.sem_funcao)[1] }}>{seloTxt(mot)}{mot.selo?.nivel === "atencao" ? " — precisa da liberação de um gestor" : mot.selo?.nivel === "em_andamento" ? " — pode programar (só aviso)" : ""}</div>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
      {lbl("CAVALO (TRATOR) *", <select value={f.cavalo_id} onChange={(e) => sel("cavalo_id", e.target.value)} style={s.input}><option value="">—</option>{optEq([String(f.impl1), String(f.impl2)])}</select>)}
      {lbl("IMPLEMENTO 1", <select value={f.impl1} onChange={(e) => sel("impl1", e.target.value)} style={s.input}><option value="">—</option>{optEq([String(f.cavalo_id), String(f.impl2)])}</select>)}
      {lbl("IMPLEMENTO 2", <select value={f.impl2} onChange={(e) => sel("impl2", e.target.value)} style={s.input}><option value="">—</option>{optEq([String(f.cavalo_id), String(f.impl1)])}</select>)}
    </div>
    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>🔒 Equipamento bloqueado por inspeção não pode ser escolhido — libere em 🔍 Inspeções.</div>
    <label style={{ display: "block", marginTop: 10 }}><span style={s.label}>OBSERVAÇÕES PARA O MOTORISTA</span><textarea rows={2} value={f.observacoes} onChange={(e) => sel("observacoes", e.target.value)} placeholder="Ex.: escolta a partir do km 230; contato no destino: Sr. Paulo (31) 9…" style={{ ...s.input, resize: "vertical" }} /></label>

    {lib && <div style={{ ...s.card, padding: 12, marginTop: 12, borderColor: C.danger, background: `${C.danger}12` }}>
      <div style={{ fontSize: 13, color: C.danger, fontWeight: 700, marginBottom: 6 }}>🔴 {lib.erro}</div>
      {podeLiberar ? <><textarea rows={2} value={just} onChange={(e) => setJust(e.target.value)} placeholder="Justificativa da liberação (mínimo 15 caracteres) — ex.: CNH renovada ontem, aguardando o documento físico" style={{ ...s.input, resize: "vertical" }} />
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Fica registrada na AT (quem, quando e por quê) e sai no PDF.</div></>
        : <div style={{ fontSize: 12.5, color: C.textSub }}>Peça para um gestor liberar, ou escolha outro motorista.</div>}
    </div>}
    {conf && <div style={{ ...s.card, padding: 12, marginTop: 12, borderColor: C.warn, background: `${C.warn}12` }}>
      <div style={{ fontSize: 13, color: C.warn, fontWeight: 700, marginBottom: 4 }}>⚠ Conflito de agenda</div>
      {conf.map((c, i) => <div key={i} style={{ fontSize: 12.5 }}>• {c}</div>)}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}><button type="button" onClick={() => setConf(null)} style={{ ...s.btn(false), cursor: "pointer", color: C.text, padding: "6px 12px", fontSize: 12 }}>Trocar data/recurso</button>
        <button type="button" disabled={ocupado} onClick={() => { setConf(null); salvar({ ignorar_conflito: true }); }} style={{ ...s.btn(true, C.warn), padding: "6px 12px", fontSize: 12 }}>Programar mesmo assim</button></div>
    </div>}
    {avisos.length > 0 && avisos.map((a, i) => <div key={i} style={{ fontSize: 12, color: C.warn, marginTop: 6 }}>{a}</div>)}
    <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
      <button type="button" onClick={onFechar} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
      <button type="button" disabled={ocupado || !f.inicio || !f.cavalo_id || (!atual && !selItens.length) || (lib && podeLiberar && just.trim().length < 15) || (lib && !podeLiberar)} onClick={() => { setAvisos([]); salvar(); }}
        style={{ ...s.btn(!ocupado && !!f.inicio && !!f.cavalo_id && (!!atual || selItens.length > 0) && !(lib && (!podeLiberar || just.trim().length < 15)), lib ? C.danger : C.accent), flex: 1 }}>{ocupado ? "Salvando…" : lib ? "🔓 Liberar e programar" : atual ? "Salvar" : "🚛 Programar"}</button>
    </div>
  </>, onFechar, 760);
}

export default function FichaAT({ C, s, id, podeLiberar, onFechar, onMudou, onErro, onOk }) {
  const [d, setD] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [modal, setModal] = useState(null); // { tipo: cancelar|editar|anexo }
  const carregar = async () => { try { setD(await apiService.get(`/programacao/execucoes/${id}`)); } catch (e) { onErro(e.message); onFechar(); } };
  useEffect(() => { carregar(); }, [id]); // eslint-disable-line
  if (!d) return null;
  const e = d.execucao; const cols = (e.colunas || []).filter((c) => c.chave !== "data_prevista");
  const acao = async (a, extra = {}, msg) => { setOcupado(true); try { await apiService.post(`/programacao/execucoes/${e.id}/status`, { acao: a, ...extra }); onOk(msg); setModal(null); await carregar(); onMudou?.(); } catch (er) { onErro(er.message); } finally { setOcupado(false); } };
  const pdf = async () => { const w = window.open("", "_blank"); try { abrirAT(await apiService.get(`/programacao/execucoes/${e.id}/documento`), w); } catch (er) { if (w) w.close(); onErro(er.message); } };
  const abrirAnexo = async (a) => { const w = window.open("", "_blank"); try { const r = await apiService.get(`/programacao/execucoes/${e.id}/anexos/${a.id}`); if (w) w.location.href = r.url; } catch (er) { if (w) w.close(); onErro(er.message); } };
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
            <div style={{ fontSize: 13, color: C.textSub, marginTop: 3 }}><b style={{ color: C.text }}>{e.cliente_nome}</b> · {e.pv_numero} · {e.grupo_titulo}</div>
          </div>
          <button type="button" onClick={onFechar} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: "10px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={pdf} style={bt(C.textSub, false)}>📄 PDF da AT</button>
          {e.status === "programada" && <button type="button" onClick={() => setModal({ tipo: "editar" })} style={bt(C.textSub, false)}>✏ Editar</button>}
          <div style={{ flex: 1 }} />
          {e.status === "programada" && <button type="button" disabled={ocupado} onClick={() => acao("iniciar", {}, `${e.numero} em execução.`)} style={bt(C.warn)}>▶ Iniciar</button>}
          {e.status === "em_execucao" && <button type="button" disabled={ocupado} onClick={() => acao("concluir", {}, `${e.numero} concluída.`)} style={bt(C.success)}>✓ Concluir</button>}
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
              <thead><tr>{cols.map((c) => <th key={c.chave} style={{ textAlign: "left", color: C.muted, fontSize: 10, padding: 4 }}>{c.rotulo.toUpperCase()}</th>)}<th style={{ textAlign: "left", color: C.muted, fontSize: 10, padding: 4 }}>QTD</th></tr></thead>
              <tbody>{e.itens.map((i) => <tr key={i.id}>{cols.map((c) => <td key={c.chave} style={{ padding: 4, borderTop: `1px solid ${C.border}` }}>{valorCelula(c, i.valores?.[c.chave])}</td>)}<td style={{ padding: 4, borderTop: `1px solid ${C.border}` }}>{i.quantidade ?? 1}</td></tr>)}</tbody></table></div>
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
      {modal?.tipo === "editar" && <FormAT C={C} s={s} pv={{ id: e.pv_id, numero: e.pv_numero }} trecho={{ id: e.grupo_id, titulo: e.grupo_titulo }} atual={e} podeLiberar={podeLiberar} onErro={onErro} onFechar={() => setModal(null)}
        onSalvo={async (r) => { setModal(null); onOk(`${e.numero} atualizada.${r.avisos?.length ? ` ${r.avisos.join(" ")}` : ""}`); await carregar(); onMudou?.(); }} />}
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
