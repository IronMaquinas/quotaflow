// components/comercial/FichaBid.jsx — etapa 15a
// Ficha do BID (abre por cima da tela): à esquerda o DOCUMENTO (itens por grupo/trecho, condições, textos, dados e assinatura,
// versões), à direita a LINHA DO TEMPO do CRM (ligação, e-mail, reunião, nota, tarefa com data + eventos automáticos).
//   • 💾 Salvar grava o rascunho. 📌 Fechar versão congela v1, v2… com o que mudou. 📄 PDF: rascunho ou uma versão fechada.
//   • Funil: mover de fase aqui ou arrastando no kanban. Perdido pede o motivo. Aceito/perdido travam a edição (↺ Reabrir).
import { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";
import CampoMoeda from "../shared/CampoMoeda";
import CampoTelefone from "../shared/CampoTelefone";
import { abrirBid, prepararJanela } from "../../utils/gerarBid";

export const FASES = [["elaboracao", "Elaboração", "#64748b"], ["enviado", "Enviado", "#3b82f6"], ["negociacao", "Em negociação", "#f59e0b"], ["proposta_final", "Proposta final", "#a78bfa"], ["aceito", "Aceito", "#22c55e"], ["perdido", "Perdido", "#ef4444"]];
export const COR_FASE = Object.fromEntries(FASES.map(([k, , c]) => [k, c]));
export const NOME_FASE = Object.fromEntries(FASES.map(([k, l]) => [k, l]));
export const MOTIVOS = { preco: "Preço", prazo: "Prazo", veiculo: "Tipo de veículo / disponibilidade", concorrente: "Fechou com concorrente", desistiu: "Cliente desistiu do serviço", outro: "Outro motivo" };
export const brl = (v) => (v == null || v === "" ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");
const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "");
const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const nid = () => Math.random().toString(36).slice(2, 12);
const TIPOS = { ligacao: "📞 Ligação", email: "✉ E-mail", reuniao: "🤝 Reunião", nota: "📝 Nota", tarefa: "⏰ Tarefa" };
const ICONE = { ligacao: "📞", email: "✉", reuniao: "🤝", nota: "📝", tarefa: "⏰", evento: "•" };

export function calcular(grupos = [], manual = null) {
  // 15a.1: item ainda sem valor (linha nova, recém-duplicada) não zera o subtotal — soma os que têm valor
  const gs = grupos.map((g) => { const comValor = g.itens.filter((i) => i.valor != null && i.valor !== ""); const soma = comValor.length ? comValor.reduce((t, i) => t + Number(i.valor) * Number(i.quantidade || 1), 0) : null; return { ...g, soma, subtotal: g.valor != null && g.valor !== "" ? Number(g.valor) : soma }; });
  const soma = gs.length && gs.every((g) => g.subtotal != null) ? gs.reduce((t, g) => t + g.subtotal, 0) : null;
  return { grupos: gs, soma, total: manual != null && manual !== "" ? Number(manual) : soma };
}

function Celula({ C, s, col, valor, onValor, travado }) {
  const st = { ...s.input, padding: "6px 7px", fontSize: 12, minWidth: col.tipo === "data" ? 130 : 70 };
  if (col.tipo === "sim_nao") return <select disabled={travado} value={valor || ""} onChange={(e) => onValor(e.target.value || undefined)} style={st}><option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option><option value="na">N/A</option></select>;
  if (col.tipo === "data") return <input disabled={travado} type="date" value={valor || ""} onChange={(e) => onValor(e.target.value || undefined)} style={st} />;
  return <input disabled={travado} value={valor ?? ""} inputMode={col.tipo === "numero" ? "decimal" : undefined} onChange={(e) => onValor(e.target.value)} placeholder={col.unidade || ""} style={st} />;
}

function Grupos({ C, s, conteudo, grupos, setGrupos, travado }) {
  const cols = conteudo.colunas || []; const rot = conteudo.rotulo_grupo || "Grupo";
  const calc = calcular(grupos).grupos;
  const setG = (gi, g) => setGrupos(grupos.map((x, k) => (k === gi ? g : x)));
  const novoItem = () => ({ id: nid(), valores: {}, quantidade: 1, valor: null });
  const mini = (cor = C.textSub) => ({ background: "transparent", border: `1px solid ${C.border}`, color: cor, borderRadius: 5, padding: "4px 8px", fontSize: 11, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" });
  return (<div>
    {grupos.map((g, gi) => (
      <div key={g.id} style={{ ...s.card, padding: 12, marginBottom: 12, background: C.bg }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 8 }}>
          <label style={{ flex: "3 1 260px" }}><span style={s.label}>{rot.toUpperCase()} {gi + 1}</span>
            <input disabled={travado} value={g.titulo || ""} onChange={(e) => setG(gi, { ...g, titulo: e.target.value })} placeholder={rot === "Trecho" ? "De ES x CONFRESA/MT" : `Nome do ${rot.toLowerCase()}`} style={{ ...s.input, fontWeight: 600 }} /></label>
          <label style={{ flex: "1 1 160px" }}><span style={s.label}>SUBTOTAL (OPCIONAL)</span>
            <CampoMoeda disabled={travado} value={g.valor ?? ""} onChange={(v) => setG(gi, { ...g, valor: v === "" ? null : v })} placeholder={calc[gi].soma != null ? `soma: ${brl(calc[gi].soma)}` : "pela soma dos itens"} style={s.input} /></label>
          {!travado && <>
            <button type="button" title="Duplicar (ex.: o retorno)" onClick={() => setGrupos([...grupos.slice(0, gi + 1), { ...g, id: nid(), titulo: g.titulo ? `${g.titulo} (cópia)` : "", itens: g.itens.map((i) => ({ ...i, id: nid() })) }, ...grupos.slice(gi + 1)])} style={mini()}>⧉ Duplicar</button>
            {grupos.length > 1 && <button type="button" onClick={() => setGrupos(grupos.filter((_, k) => k !== gi))} style={mini(C.danger)}>✕ Tirar</button>}
          </>}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr>{cols.map((c) => <th key={c.chave} style={{ textAlign: "left", color: C.muted, fontWeight: 600, fontSize: 10, padding: "4px 4px", whiteSpace: "nowrap" }}>{c.rotulo.toUpperCase()}{c.unidade ? ` (${c.unidade})` : ""}</th>)}
              <th style={{ textAlign: "left", color: C.muted, fontSize: 10, padding: 4 }}>QTD</th><th style={{ textAlign: "left", color: C.muted, fontSize: 10, padding: 4 }}>VALOR UNIT.</th><th /></tr></thead>
            <tbody>{g.itens.map((it, ii) => {
              const setI = (x) => setG(gi, { ...g, itens: g.itens.map((y, k) => (k === ii ? x : y)) });
              return (<tr key={it.id}>
                {cols.map((c) => <td key={c.chave} style={{ padding: 3 }}><Celula C={C} s={s} col={c} travado={travado} valor={it.valores?.[c.chave]} onValor={(v) => { const valores = { ...it.valores }; if (v === undefined || v === "") delete valores[c.chave]; else valores[c.chave] = v; setI({ ...it, valores }); }} /></td>)}
                <td style={{ padding: 3 }}><input disabled={travado} value={it.quantidade ?? 1} inputMode="decimal" onChange={(e) => setI({ ...it, quantidade: e.target.value })} style={{ ...s.input, padding: "6px 7px", fontSize: 12, width: 56 }} /></td>
                <td style={{ padding: 3, minWidth: 120 }}><CampoMoeda disabled={travado} value={it.valor ?? ""} onChange={(v) => setI({ ...it, valor: v === "" ? null : v })} style={{ ...s.input, padding: "6px 7px", fontSize: 12 }} /></td>
                <td style={{ padding: 3, whiteSpace: "nowrap" }}>{!travado && <>
                  <button type="button" title="Duplicar item" onClick={() => setG(gi, { ...g, itens: [...g.itens.slice(0, ii + 1), { ...it, id: nid() }, ...g.itens.slice(ii + 1)] })} style={mini()}>⧉</button>{" "}
                  {g.itens.length > 1 && <button type="button" title="Tirar item" onClick={() => setG(gi, { ...g, itens: g.itens.filter((_, k) => k !== ii) })} style={mini(C.danger)}>✕</button>}</>}</td>
              </tr>);
            })}</tbody>
          </table>
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 6 }}>
          {!travado && <button type="button" onClick={() => setG(gi, { ...g, itens: [...g.itens, novoItem()] })} style={mini(C.accent)}>＋ Item</button>}
          <div style={{ flex: 1, textAlign: "right", fontSize: 12, color: C.textSub }}>Subtotal: <b style={{ color: C.text }}>{brl(calc[gi].subtotal)}</b>{g.valor != null && g.valor !== "" && calc[gi].soma != null && Number(g.valor) !== calc[gi].soma ? <span style={{ color: C.warn }}> · soma dos itens {brl(calc[gi].soma)}</span> : ""}</div>
        </div>
      </div>
    ))}
    {!travado && <button type="button" onClick={() => setGrupos([...grupos, { id: nid(), titulo: "", valor: null, itens: [novoItem()] }])} style={{ ...mini(C.accent), padding: "7px 12px", fontSize: 12 }}>＋ {rot}</button>}
  </div>);
}

export default function FichaBid({ C, s, id, onFechar, onMudou, onErro, onOk, onAbrirCliente }) {
  const [d, setD] = useState(null);
  const [f, setF] = useState(null); // rascunho em edição
  const [sujo, setSujo] = useState(false);
  const [aba, setAba] = useState("itens");
  const [resp, setResp] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [modal, setModal] = useState(null); // { tipo: perdido|aceito|versao|reabrir|fechar }
  const [ativ, setAtiv] = useState({ tipo: "nota", texto: "", prevista_para: "" });

  const carregar = async () => {
    try {
      const r = await apiService.get(`/comercial/bids/${id}`); setD(r);
      const b = r.bid;
      setF({ titulo: b.titulo || "", referencia: b.referencia || "", contato_nome: b.contato_nome || "", contato_email: b.contato_email || "", contato_telefone: b.contato_telefone || "",
        previsao_fechamento: b.previsao_fechamento || "", responsavel_id: b.responsavel_id || "", validade_dias: b.validade_dias, valor_total_manual: b.valor_total_manual ?? "",
        grupos: (b.grupos || []).map(({ subtotal, ...g }) => g), condicoes: { na: [], ...(b.condicoes || {}) }, secoes: b.conteudo?.secoes || [], assinante: { nome: "", cargo: "", registro: "", telefones: "", ...(b.assinante || {}) } });
      setSujo(false);
    } catch (e) { onErro(e.message); onFechar(); }
  };
  useEffect(() => { carregar(); apiService.get("/comercial/responsaveis").then((r) => setResp(r.responsaveis || [])).catch(() => {}); }, [id]); // eslint-disable-line
  const calc = useMemo(() => (f ? calcular(f.grupos, f.valor_total_manual) : null), [f]);
  if (!d || !f) return null;
  const b = d.bid; const ct = b.conteudo || {}; const travado = ["aceito", "perdido"].includes(b.fase);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setSujo(true); };

  const salvar = async (silencioso = false) => {
    setOcupado(true);
    try {
      const corpo = { ...f, valor_total_manual: f.valor_total_manual === "" ? null : f.valor_total_manual, previsao_fechamento: f.previsao_fechamento || null, responsavel_id: f.responsavel_id || undefined };
      await apiService.put(`/comercial/bids/${b.id}`, corpo); if (!silencioso) onOk("BID salvo."); await carregar(); onMudou?.(); return true;
    } catch (e) { onErro(e.message); return false; } finally { setOcupado(false); }
  };
  const fase = async (fase, extra = {}) => {
    if (sujo && !travado && !(await salvar(true))) return;
    setOcupado(true);
    try { await apiService.post(`/comercial/bids/${b.id}/fase`, { fase, ...extra }); onOk(`Movido para ${NOME_FASE[fase]}.`); setModal(null); await carregar(); onMudou?.(); }
    catch (e) { onErro(e.message); } finally { setOcupado(false); }
  };
  const fecharVersao = async (nota) => {
    if (sujo && !(await salvar(true))) return;
    setOcupado(true);
    try { const r = await apiService.post(`/comercial/bids/${b.id}/versao`, { nota }); onOk(`Versão v${r.versao} fechada.`); setModal(null); await carregar(); onMudou?.(); }
    catch (e) { onErro(e.message); } finally { setOcupado(false); }
  };
  const pdf = async (versao = null) => {
    if (versao == null && sujo && !(await salvar(true))) return;
    const w = prepararJanela();
    try { const r = await apiService.get(`/comercial/bids/${b.id}/documento`, versao != null ? { versao } : {}); abrirBid(r, w); }
    catch (e) { if (w) w.close(); onErro(e.message); }
  };
  const registrar = async () => {
    setOcupado(true);
    try { await apiService.post("/comercial/atividades", { ...ativ, bid_id: b.id }); setAtiv({ tipo: ativ.tipo === "tarefa" ? "nota" : ativ.tipo, texto: "", prevista_para: "" }); await carregar(); onMudou?.(); }
    catch (e) { onErro(e.message); } finally { setOcupado(false); }
  };
  const concluir = async (a, feita = true) => { try { await apiService.post(`/comercial/atividades/${a.id}/concluir`, { feita }); await carregar(); onMudou?.(); } catch (e) { onErro(e.message); } };
  const tentarFechar = () => (sujo ? setModal({ tipo: "fechar" }) : onFechar());

  const cor = COR_FASE[b.fase];
  const bt = (c, cheio = true) => ({ ...s.btn(true, c), cursor: "pointer", padding: "7px 12px", fontSize: 12, ...(cheio ? {} : { background: "transparent", color: c }) });
  const abaBt = (k, l) => <button key={k} type="button" onClick={() => setAba(k)} style={{ background: "transparent", border: "none", borderBottom: `2px solid ${aba === k ? C.accent : "transparent"}`, padding: "7px 10px", color: aba === k ? C.text : C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>;
  const lbl = (rot, el, flex = "1 1 180px", key) => <label key={key} style={{ flex, display: "block" }}><span style={s.label}>{rot}</span>{el}</label>;
  const inp = (k, extra = {}) => <input disabled={travado} value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} style={s.input} {...extra} />;
  const proxima = FASES.findIndex(([k]) => k === b.fase) + 1;
  const condsDe = (grupo) => (ct.condicoes || []).filter((c) => (c.grupo || "comercial") === grupo);
  const tarefasAbertas = d.atividades.filter((a) => a.tipo === "tarefa" && !a.concluida_em);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090", zIndex: 310, display: "flex", justifyContent: "center", padding: 12, overflowY: "auto" }} onClick={tentarFechar}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: 1280, maxWidth: "100%", margin: "auto 0", padding: 0, overflow: "hidden", boxShadow: "0 24px 48px #00000060" }}>
        {/* cabeçalho */}
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: 17 }}>{b.numero}</span>
              <span style={s.tag(cor)}>{NOME_FASE[b.fase]}{b.dias_na_fase ? ` · ${b.dias_na_fase} d` : ""}</span>
              {b.expirado && <span style={s.tag(C.danger)}>⌛ validade vencida</span>}
              <span style={s.tag(C.muted)}>{b.versao_atual ? `v${b.versao_atual}${b.alterado_desde_versao ? " + alterações" : ""}` : "sem versão"}</span>
              {sujo && <span style={s.tag(C.warn)}>não salvo</span>}
            </div>
            <div style={{ fontSize: 13, color: C.textSub, marginTop: 3 }}>
              <button type="button" className="qf-clicavel" onClick={() => onAbrirCliente?.(b.cliente_id)} style={{ background: "none", border: "none", color: C.text, padding: 0, fontWeight: 600, fontSize: 13 }}>{b.cliente_nome}</button>
              {b.referencia ? ` · ${b.referencia}` : ""} · {b.modelo_nome} · {b.responsavel_nome || "sem responsável"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: C.muted }}>VALOR TOTAL</div><div style={{ fontSize: 20, fontWeight: 800 }}>{brl(calc.total)}</div></div>
          <button type="button" onClick={tentarFechar} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        {/* ações */}
        <div style={{ padding: "10px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {!travado && <button type="button" disabled={ocupado || !sujo} onClick={() => salvar()} style={{ ...s.btn(!ocupado && sujo, C.accent), padding: "7px 14px", fontSize: 12 }}>💾 Salvar</button>}
          {!travado && <button type="button" disabled={ocupado} onClick={() => setModal({ tipo: "versao" })} style={bt(C.accent, false)}>📌 Fechar versão</button>}
          <button type="button" onClick={() => pdf(null)} style={bt(C.textSub, false)}>{b.alterado_desde_versao || !b.versao_atual || sujo ? "👁 rascunho" : `📄 PDF v${b.versao_atual}`}</button>
          <div style={{ flex: 1 }} />
          {!travado && proxima > 0 && proxima < 5 && <button type="button" disabled={ocupado} onClick={() => fase(FASES[proxima][0])} style={bt(FASES[proxima][2])}>→ {FASES[proxima][1]}</button>}
          {!travado && <button type="button" disabled={ocupado} onClick={() => setModal({ tipo: "aceito" })} style={bt(C.success)}>✓ Aceito</button>}
          {!travado && <button type="button" disabled={ocupado} onClick={() => setModal({ tipo: "perdido", motivo: "", obs: "" })} style={bt(C.danger, false)}>✕ Perdido</button>}
          {travado && <button type="button" disabled={ocupado} onClick={() => setModal({ tipo: "reabrir" })} style={bt(C.warn, false)}>↺ Reabrir</button>}
        </div>
        {b.fase === "perdido" && <div style={{ padding: "8px 18px", background: `${C.danger}18`, fontSize: 12, color: C.danger }}>Perdido em {dataHora(b.perdido_em)} — {MOTIVOS[b.motivo_perda] || b.motivo_perda}{b.perda_obs ? `: ${b.perda_obs}` : ""}</div>}
        {b.fase === "aceito" && <div style={{ padding: "8px 18px", background: `${C.success}18`, fontSize: 12, color: C.success }}>Aceito em {dataHora(b.ganho_em)}. O Pedido de Venda (PV) nasce daqui na etapa 15c.</div>}

        <div style={{ display: "flex", flexWrap: "wrap" }}>
          {/* documento */}
          <div style={{ flex: "3 1 640px", minWidth: 0, padding: "6px 18px 18px", borderRight: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${C.border}`, marginBottom: 12, flexWrap: "wrap" }}>
              {abaBt("itens", "💲 Itens e valores")}{abaBt("condicoes", "📋 Condições")}{abaBt("textos", "📝 Textos")}{abaBt("dados", "✍ Dados e assinatura")}{abaBt("versoes", `🕘 Versões (${d.versoes.length})`)}
            </div>
            {aba === "itens" && <>
              <Grupos C={C} s={s} conteudo={ct} grupos={f.grupos} setGrupos={(g) => set("grupos", g)} travado={travado} />
              <div style={{ ...s.card, padding: 12, marginTop: 14, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 200px", fontSize: 12, color: C.textSub }}>Soma dos {(ct.rotulo_grupo || "grupo").toLowerCase()}s: <b style={{ color: C.text }}>{brl(calc.soma)}</b>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Como no BID da cliente, pode informar só o valor total (sem preço por item).</div></div>
                <label style={{ flex: "0 1 220px" }}><span style={s.label}>VALOR TOTAL (OPCIONAL)</span><CampoMoeda disabled={travado} value={f.valor_total_manual ?? ""} onChange={(v) => set("valor_total_manual", v)} placeholder="pela soma" style={s.input} /></label>
              </div>
            </>}
            {aba === "condicoes" && <>
              {[["comercial", "NA PRECIFICAÇÃO"], ["pagamento", "CRITÉRIOS DE MEDIÇÃO E PAGAMENTO"]].map(([g, titulo]) => (
                <div key={g} style={{ marginBottom: 14 }}><div style={{ ...s.label, marginBottom: 8 }}>{titulo}</div>
                  {condsDe(g).map((c) => { const na = (f.condicoes.na || []).includes(c.chave); const setC = (v) => set("condicoes", { ...f.condicoes, [c.chave]: v });
                    return (<div key={c.chave} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <div style={{ flex: "0 0 210px", fontSize: 12, color: C.textSub }}>{c.rotulo}{c.unidade ? ` (${c.unidade})` : ""}</div>
                      <div style={{ flex: 1, opacity: na ? 0.4 : 1 }}>{c.tipo === "moeda" ? <CampoMoeda disabled={travado || na} value={f.condicoes[c.chave] ?? ""} onChange={setC} style={s.input} />
                        : <input disabled={travado || na} value={f.condicoes[c.chave] ?? ""} inputMode={c.tipo === "numero" ? "decimal" : undefined} onChange={(e) => setC(e.target.value)} style={s.input} />}</div>
                      <label style={{ fontSize: 11, color: C.muted, display: "flex", gap: 4, alignItems: "center", whiteSpace: "nowrap" }}><input type="checkbox" disabled={travado} checked={na} onChange={(e) => set("condicoes", { ...f.condicoes, na: e.target.checked ? [...(f.condicoes.na || []), c.chave] : (f.condicoes.na || []).filter((k) => k !== c.chave) })} /> N/A</label>
                    </div>); })}
                  {g === "pagamento" && <div style={{ display: "flex", gap: 8, alignItems: "center" }}><div style={{ flex: "0 0 210px", fontSize: 12, color: C.textSub }}>Validade da proposta (dias)</div>
                    <input disabled={travado} type="number" min={1} max={365} value={f.validade_dias ?? ""} onChange={(e) => set("validade_dias", e.target.value)} style={{ ...s.input, width: 100 }} />
                    <span style={{ fontSize: 11, color: C.muted }}>{b.valido_ate ? `conta do envio — vale até ${dBR(b.valido_ate)}` : "conta a partir do envio"}</span></div>}
                  {!condsDe(g).length && g === "comercial" && <div style={{ fontSize: 12, color: C.muted }}>O modelo não tem condições aqui.</div>}
                </div>))}
            </>}
            {aba === "textos" && <>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Os textos vieram do modelo e podem ser ajustados só neste BID. Linhas que começam com “- ” viram lista. A Identificação sai dos dados cadastrais da empresa (⚙️ Configurações).</div>
              {f.secoes.map((x, i) => (<div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 4 }}><input disabled={travado} value={x.titulo} onChange={(e) => set("secoes", f.secoes.map((y, k) => (k === i ? { ...y, titulo: e.target.value } : y)))} style={{ ...s.input, fontWeight: 600 }} />
                  <span style={{ ...s.tag(C.muted), alignSelf: "center" }}>{x.posicao === "depois" ? "depois do pagamento" : "antes da precificação"}</span></div>
                <textarea disabled={travado} value={x.texto} onChange={(e) => set("secoes", f.secoes.map((y, k) => (k === i ? { ...y, texto: e.target.value } : y)))} rows={Math.min(12, Math.max(3, String(x.texto).split("\n").length + 1))} style={{ ...s.input, resize: "vertical", fontSize: 12.5, lineHeight: 1.5 }} />
              </div>))}
            </>}
            {aba === "dados" && <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{lbl("TÍTULO INTERNO (OPCIONAL)", inp("titulo", { placeholder: "Ex.: Retroescavadeiras para MT" }), "2 1 260px")}{lbl("REFERÊNCIA DO CLIENTE", inp("referencia", { placeholder: "PC 551" }), "1 1 140px")}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{lbl("CONTATO NO CLIENTE", inp("contato_nome"))}{lbl("E-MAIL", inp("contato_email", { type: "email" }))}
                {lbl("TELEFONE", <CampoTelefone value={f.contato_telefone || ""} onChange={(v) => set("contato_telefone", v || "")} C={C} />)}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {lbl("RESPONSÁVEL", <select value={f.responsavel_id || ""} onChange={(e) => set("responsavel_id", e.target.value)} style={s.input}>{!f.responsavel_id && <option value="">—</option>}{resp.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select>)}
                {lbl("PREVISÃO DE FECHAMENTO", <input type="date" value={f.previsao_fechamento || ""} onChange={(e) => set("previsao_fechamento", e.target.value)} style={s.input} />)}</div>
              <div style={{ ...s.label, marginTop: 16 }}>ASSINATURA DO DOCUMENTO</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["nome", "cargo", "registro", "telefones"].map((k) => lbl({ nome: "NOME", cargo: "CARGO", registro: "REGISTRO PROFISSIONAL (EX.: CREA/ES 052637/D)", telefones: "TELEFONES" }[k],
                  <input disabled={travado} value={f.assinante[k] || ""} onChange={(e) => set("assinante", { ...f.assinante, [k]: e.target.value })} style={s.input} />, k === "registro" ? "2 1 260px" : "1 1 180px", k))}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>O próximo BID deste responsável já vem com esta assinatura.</div>
            </>}
            {aba === "versoes" && <>
              {!d.versoes.length && <div style={{ fontSize: 12, color: C.muted }}>Nenhuma versão fechada. A v1 é fechada sozinha ao marcar como Enviado (ou em 📌 Fechar versão).</div>}
              {d.versoes.map((v) => (<div key={v.id} style={{ ...s.card, padding: 12, marginBottom: 8, background: C.bg }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b>v{v.versao}</b><span style={{ fontSize: 12, color: C.textSub }}>{dataHora(v.criado_em)}{v.criado_por_nome ? ` · ${v.criado_por_nome}` : ""}</span>
                  <span style={{ fontSize: 12 }}>{brl(v.valor_total)}</span><div style={{ flex: 1 }} /><button type="button" onClick={() => pdf(v.versao)} style={bt(C.textSub, false)}>📄 PDF v{v.versao}</button></div>
                {v.nota && <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>“{v.nota}”</div>}
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: C.textSub }}>{(v.mudancas || []).map((m, i) => <li key={i}>{m}</li>)}</ul>
                <div style={{ fontSize: 9.5, color: C.muted, fontFamily: "monospace", marginTop: 4, wordBreak: "break-all" }}>SHA-256 {v.hash}</div>
              </div>))}
            </>}
          </div>

          {/* linha do tempo do CRM */}
          <div style={{ flex: "1 1 320px", minWidth: 0, padding: "14px 16px", background: C.bg }}>
            <div style={{ ...s.label, marginBottom: 8 }}>ATIVIDADES</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>{Object.entries(TIPOS).map(([k, l]) => <button key={k} type="button" onClick={() => setAtiv({ ...ativ, tipo: k })} style={{ ...s.tag(ativ.tipo === k ? C.accent : C.muted), cursor: "pointer", padding: "4px 8px", fontSize: 11 }}>{l}</button>)}</div>
            <textarea value={ativ.texto} onChange={(e) => setAtiv({ ...ativ, texto: e.target.value })} rows={2} placeholder={ativ.tipo === "tarefa" ? "O que fazer (ex.: ligar para confirmar o prazo)" : "O que aconteceu"} style={{ ...s.input, resize: "vertical", fontSize: 12 }} />
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {ativ.tipo === "tarefa" && <input type="date" min={hoje()} value={ativ.prevista_para} onChange={(e) => setAtiv({ ...ativ, prevista_para: e.target.value })} style={{ ...s.input, flex: 1 }} />}
              <button type="button" disabled={ocupado || !ativ.texto.trim() || (ativ.tipo === "tarefa" && !ativ.prevista_para)} onClick={registrar} style={{ ...s.btn(!ocupado && !!ativ.texto.trim() && (ativ.tipo !== "tarefa" || !!ativ.prevista_para), C.accent), flex: 1, padding: "7px 10px", fontSize: 12 }}>Registrar</button>
            </div>
            {tarefasAbertas.length > 0 && <div style={{ marginTop: 14 }}><div style={{ ...s.label, marginBottom: 6 }}>⏰ TAREFAS ABERTAS</div>
              {tarefasAbertas.map((a) => { const atrasada = a.prevista_para && a.prevista_para < new Date().toISOString();
                return (<div key={a.id} style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                  <input type="checkbox" onChange={() => concluir(a)} title="Concluir" style={{ marginTop: 2 }} />
                  <div style={{ flex: 1 }}>{a.texto}<div style={{ fontSize: 11, color: atrasada ? C.danger : C.muted }}>{atrasada ? "atrasada · " : ""}{dBR(a.prevista_para?.slice(0, 10))}{a.usuario_nome ? ` · ${a.usuario_nome}` : ""}</div></div>
                </div>); })}</div>}
            <div style={{ marginTop: 14 }}>
              {d.atividades.filter((a) => !(a.tipo === "tarefa" && !a.concluida_em)).map((a) => (
                <div key={a.id} style={{ display: "flex", gap: 8, fontSize: 12, padding: "7px 0", borderBottom: `1px solid ${C.border}`, color: a.tipo === "evento" ? C.muted : C.text }}>
                  <span style={{ width: 16, textAlign: "center" }}>{a.tipo === "tarefa" ? "✅" : ICONE[a.tipo]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{a.texto}</div>
                    <div style={{ fontSize: 10.5, color: C.muted }}>{dataHora(a.criado_em)}{a.usuario_nome ? ` · ${a.usuario_nome}` : ""}{a.tipo === "tarefa" ? ` · feita ${dataHora(a.concluida_em)}` : ""}
                      {a.tipo === "tarefa" && <button type="button" onClick={() => concluir(a, false)} style={{ background: "none", border: "none", color: C.muted, fontSize: 10.5, textDecoration: "underline", cursor: "pointer", padding: "0 0 0 6px" }}>desfazer</button>}</div></div>
                </div>))}
            </div>
          </div>
        </div>
      </div>

      {modal && <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 340, padding: 16 }} onClick={(e) => { e.stopPropagation(); setModal(null); }}>
        <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: 480, maxWidth: "100%", padding: "18px 20px" }}>
          {modal.tipo === "perdido" && <>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Por que o BID foi perdido?</div>
            {Object.entries(MOTIVOS).map(([k, l]) => <label key={k} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "4px 0", cursor: "pointer" }}><input type="radio" checked={modal.motivo === k} onChange={() => setModal({ ...modal, motivo: k })} /> {l}</label>)}
            <textarea value={modal.obs} onChange={(e) => setModal({ ...modal, obs: e.target.value })} rows={2} placeholder={modal.motivo === "outro" ? "Descreva o motivo (obrigatório)" : "Detalhe (opcional) — ex.: concorrente 10% abaixo"} style={{ ...s.input, marginTop: 8, resize: "vertical" }} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>O motivo alimenta o gráfico de perdas do funil.</div>
          </>}
          {modal.tipo === "aceito" && <><div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Marcar {b.numero} como aceito?</div>
            <div style={{ fontSize: 13, color: C.textSub }}>Valor: <b>{brl(calc.total)}</b>. O documento fica travado (dá para reabrir). Na etapa 15b o aceite passa a vir do próprio cliente, pelo link, com assinatura na tela.</div></>}
          {modal.tipo === "reabrir" && <><div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Reabrir {b.numero}?</div><div style={{ fontSize: 13, color: C.textSub }}>Volta para “Em negociação” e a edição é liberada. Fica registrado na linha do tempo.</div></>}
          {modal.tipo === "fechar" && <><div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Sair sem salvar?</div><div style={{ fontSize: 13, color: C.textSub }}>As mudanças deste BID ainda não foram salvas.</div></>}
          {modal.tipo === "versao" && <><div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Fechar a versão v{(b.versao_atual || 0) + 1}?</div>
            <div style={{ fontSize: 13, color: C.textSub, marginBottom: 8 }}>A versão congela o documento como está (com hash). O que mudou desde a anterior é registrado.</div>
            <input value={modal.nota || ""} onChange={(e) => setModal({ ...modal, nota: e.target.value })} placeholder="Nota (opcional) — ex.: cliente pediu prancha 3 eixos" style={s.input} /></>}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button type="button" onClick={() => setModal(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>{modal.tipo === "fechar" ? "Continuar editando" : "Cancelar"}</button>
            {modal.tipo === "perdido" && <button type="button" disabled={ocupado || !modal.motivo || (modal.motivo === "outro" && !modal.obs.trim())} onClick={() => fase("perdido", { motivo: modal.motivo, obs: modal.obs })} style={{ ...s.btn(!!modal.motivo && !(modal.motivo === "outro" && !modal.obs.trim()), C.danger), flex: 1 }}>Marcar como perdido</button>}
            {modal.tipo === "aceito" && <button type="button" disabled={ocupado} onClick={() => fase("aceito")} style={{ ...s.btn(true, C.success), flex: 1 }}>✓ Aceito</button>}
            {modal.tipo === "reabrir" && <button type="button" disabled={ocupado} onClick={() => fase("negociacao")} style={{ ...s.btn(true, C.warn), flex: 1 }}>↺ Reabrir</button>}
            {modal.tipo === "fechar" && <button type="button" onClick={() => { setModal(null); onFechar(); }} style={{ ...s.btn(true, C.danger), flex: 1 }}>Sair sem salvar</button>}
            {modal.tipo === "versao" && <button type="button" disabled={ocupado} onClick={() => fecharVersao(modal.nota)} style={{ ...s.btn(true, C.accent), flex: 1 }}>📌 Fechar versão</button>}
          </div>
        </div>
      </div>}
    </div>
  );
}
