// components/programacao/MesaProgramacao.jsx — etapa 16b: 🧩 Mesa de programação
// Uma grade por trecho do pedido: cada LINHA é um item → a sua AT (item × motorista × conjunto × documentos).
//   · rota e data vêm do BID/pedido (ou da última AT do trecho) — editáveis, sem redigitar
//   · selo do motorista (🟢🟡🔴⚪), 🔒 equipamento bloqueado e ⚠ conflito de agenda aparecem ENQUANTO escolhe
//   · cada item = um conjunto = uma AT (16b.1: sem "juntar" — o mesmo conjunto em dois itens são duas viagens)
//   · "Programar" grava todas as linhas prontas de uma vez; o resto fica como rascunho (neste navegador)
//   · documentos NF-e/CT-e/MDF-e: depois de programada, clique no chip cinza da AT para anexar (verde = anexado, clique abre) — não trava nada
import { useState, useEffect, useMemo, useRef } from "react";
import apiService from "../../services/apiService";
import { valorCelula } from "../../utils/gerarBid";
import { COR_STATUS, NOME_STATUS, SELO, dataHora } from "./FichaAT";

const DOCS = [["nfe", "NF-e"], ["cte", "CT-e"], ["mdfe", "MDF-e"]];
const lerRascunho = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const gravarRascunho = (k, v) => { try { if (v) localStorage.setItem(k, JSON.stringify(v)); else localStorage.removeItem(k); } catch { /* sem storage: segue sem rascunho */ } };

function Trecho({ C, s, pv, t, base, podeLiberar, onAbrirAT, onSalvou, onErro, onOk }) {
  const chaveRasc = `qf-mesa-${pv.id}-${t.id}`;
  const livres = t.itens.filter((i) => !i.at);
  const inicial = () => {
    const r = lerRascunho(chaveRasc);
    const cab0 = { coleta: t.coleta || "", entrega: t.entrega || "", inicio: t.datas?.[0] ? `${t.datas[0]}T08:00` : "", fim: "" };
    const cab = { ...cab0 }; Object.entries(r?.cab || {}).forEach(([k, v]) => { if (v) cab[k] = v; }); // 16b.1: rascunho vazio não apaga a rota do BID
    const linhas = livres.map((i) => ({ item: String(i.id), inicio: "", motorista_id: "", cavalo_id: "", impl1: "", impl2: "", junto: false, justificativa: "", aceitar: false, observacoes: "", ...(r?.linhas?.[String(i.id)] || {}) }));
    return { cab, linhas };
  };
  const [st, setSt] = useState(inicial);
  const [cf, setCf] = useState({});
  const [erros, setErros] = useState({});
  const [ocupado, setOcupado] = useState(false);
  const [aberto, setAberto] = useState(true);
  const [enviando, setEnviando] = useState(null);
  // 16b.1: anexar NF-e/CT-e/MDF-e direto na grade (mesmo serviço da ficha da AT)
  const anexar = async (a, tipo, arq) => {
    if (!arq) return; if (arq.size > 10 * 1024 * 1024) return onErro("Arquivo maior que 10 MB");
    const mime = arq.type || (/\.xml$/i.test(arq.name) ? "application/xml" : "");
    setEnviando(a.id);
    try {
      const base64 = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = ko; r.readAsDataURL(arq); });
      await apiService.post(`/programacao/execucoes/${a.id}/anexos`, { tipo, nome: arq.name, mime, base64 }); onOk(`${arq.name} anexado à ${a.numero}.`); onSalvou();
    } catch (e) { onErro(e.message); } finally { setEnviando(null); }
  };
  const abrirDoc = async (a, anexo) => { const w = window.open("", "_blank"); try { const r = await apiService.get(`/programacao/execucoes/${a.id}/anexos/${anexo.id}`); if (w) w.location.href = r.url; } catch (e) { if (w) w.close(); onErro(e.message); } };
  const ultimaChecagem = useRef(0);
  const { cab, linhas } = st;
  const setCab = (k, v) => setSt((x) => ({ ...x, cab: { ...x.cab, [k]: v } }));
  const setL = (i, k, v) => setSt((x) => ({ ...x, linhas: x.linhas.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }));
  const itemDe = (id) => t.itens.find((i) => String(i.id) === String(id));
  const resumo = (i) => (pv.colunas || []).slice(0, 3).map((c) => valorCelula(c, i?.valores?.[c.chave])).filter(Boolean).join(" · ") || `Item ${i?.id}`;
  const mot = (id) => base.motoristas.find((m) => String(m.id) === String(id));
  const eq = (id) => base.equipamentos.find((e) => String(e.id) === String(id));

  // rascunho no navegador (só o que foi mexido)
  useEffect(() => { gravarRascunho(chaveRasc, { cab: st.cab, linhas: Object.fromEntries(st.linhas.map(({ item, ...l }) => [item, l])) }); }, [st]); // eslint-disable-line

  const grupos = useMemo(() => {
    const g = [];
    linhas.forEach((l, i) => g.push({ idx: [i], lider: i })); // 16b.1: uma linha = um conjunto = uma AT
    return g;
  }, [linhas]);
  const liderDe = (i) => grupos.find((g) => g.idx.includes(i))?.lider ?? i;
  const inicioDe = (l) => l.inicio || cab.inicio;

  // ⚠ conflitos: confere no servidor (ATs existentes + as próprias linhas) — com pausa para não chamar a cada tecla
  useEffect(() => {
    const n = ++ultimaChecagem.current;
    const ls = grupos.map((g) => { const l = linhas[g.lider]; const m = mot(l.motorista_id); return { chave: l.item, rotulo: `linha “${resumo(itemDe(l.item))}” desta mesa`, inicio: inicioDe(l), fim: cab.fim || null, motorista_id: l.motorista_id || null, motorista_nome: m?.nome || null, cavalo_id: l.cavalo_id || null, implementos: [l.impl1, l.impl2].filter(Boolean),
      tags: Object.fromEntries([l.cavalo_id, l.impl1, l.impl2].filter(Boolean).map((id) => [id, eq(id)?.tag || eq(id)?.nome])) }; }).filter((x) => x.inicio && (x.motorista_id || x.cavalo_id));
    if (!ls.length) { setCf({}); return undefined; }
    const tm = setTimeout(async () => { try { const r = await apiService.post("/programacao/checar", { linhas: ls }); if (n === ultimaChecagem.current) setCf(r.conflitos || {}); } catch { /* checagem é só aviso */ } }, 400);
    return () => clearTimeout(tm);
  }, [grupos, cab.inicio, cab.fim]); // eslint-disable-line

  const situacao = (i) => {
    const l = linhas[liderDe(i)]; const m = mot(l.motorista_id); const lst = [];
    if (!inicioDe(l)) lst.push(["data", C.muted, "falta data/hora"]);
    if (!l.cavalo_id) lst.push(["cav", C.muted, "falta o cavalo"]);
    if (!l.motorista_id) lst.push(["mot", C.warn, "motorista a definir"]);
    if (m?.selo?.nivel === "atencao" && (l.justificativa || "").trim().length < 15) lst.push(["lib", C.danger, podeLiberar ? "🔴 justificar liberação" : "🔴 precisa de gestor"]);
    const c = cf[l.item] || [];
    if (c.length && !l.aceitar) lst.push(["cf", C.warn, "⚠ conflito"]);
    const pronto = !lst.some(([k]) => ["data", "cav", "lib", "cf"].includes(k));
    return { pronto, lst, conflitos: c };
  };
  const prontos = grupos.filter((g) => situacao(g.lider).pronto);

  const programar = async () => {
    setOcupado(true); const novosErros = {}; let ok = 0; const feitos = new Set();
    for (const g of prontos) {
      const l = linhas[g.lider];
      try {
        await apiService.post(`/programacao/pvs/${pv.id}/at`, { grupo_id: t.id, itens: g.idx.map((i) => linhas[i].item), inicio: inicioDe(l), fim: cab.fim || null, origem: cab.coleta, destino: cab.entrega,
          motorista_id: l.motorista_id || null, cavalo_id: l.cavalo_id, implementos: [l.impl1, l.impl2].filter(Boolean), observacoes: l.observacoes, liberacao_justificativa: l.justificativa || undefined, ignorar_conflito: !!l.aceitar });
        ok++; g.idx.forEach((i) => feitos.add(linhas[i].item));
      } catch (e) { novosErros[l.item] = e.message; }
    }
    setErros(novosErros); setOcupado(false);
    if (ok) {
      setSt((x) => ({ ...x, linhas: x.linhas.filter((l) => !feitos.has(l.item)) }));
      onOk(`${ok} AT(s) programada(s) — ${t.titulo}.${Object.keys(novosErros).length ? " Algumas linhas não passaram (veja na mesa)." : ""}`); onSalvou();
    } else if (Object.keys(novosErros).length) onErro("Nenhuma AT programada — veja o motivo em cada linha.");
  };

  const sel = (v, on, opts, w = 130, extra = {}) => <select value={v} onChange={(e) => on(e.target.value)} style={{ ...s.input, padding: "5px 6px", fontSize: 12, minWidth: w, ...extra }}>{opts}</select>;
  const optEq = (excluir) => [<option key="" value="">—</option>, ...base.equipamentos.filter((e) => !excluir.includes(String(e.id))).map((e) => <option key={e.id} value={e.id} disabled={e.bloqueado}>{e.bloqueado ? "🔒 " : ""}{e.tag || e.nome}{e.bloqueado ? " (bloqueado)" : ""}</option>)];
  const optMot = [<option key="" value="">— a definir —</option>, ...base.motoristas.map((m) => <option key={m.id} value={m.id}>{(SELO[m.selo?.nivel] || SELO.sem_funcao)[0]} {m.nome}</option>)];
  const th = (r, w) => <th style={{ textAlign: "left", fontSize: 10, color: C.muted, padding: "6px 6px", whiteSpace: "nowrap", minWidth: w, borderBottom: `1px solid ${C.border}` }}>{r}</th>;
  const td = { padding: "6px 6px", borderTop: `1px solid ${C.border}`, verticalAlign: "top", fontSize: 12.5 };
  const docChip = (ok, rot) => <span key={rot} style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, marginRight: 3, border: `1px solid ${ok ? C.success : C.border}`, color: ok ? C.success : C.muted, whiteSpace: "nowrap" }}>{ok ? "✓ " : ""}{rot}</span>;

  return (
    <div style={{ borderTop: `1px solid ${C.border}` }}>
      <div style={{ padding: "10px 14px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", cursor: "pointer" }} onClick={() => setAberto(!aberto)}>
        <span style={{ color: C.muted, width: 12 }}>{aberto ? "▾" : "▸"}</span>
        <b style={{ fontSize: 13.5 }}>{t.titulo}</b>
        <span style={{ fontSize: 12, color: C.muted }}>{t.qtd} item(ns) · {t.qtd - t.livres} programado(s)</span>
        <div style={{ flex: 1 }} />
        {t.livres === 0 ? <span style={s.tag(C.success)}>✓ todos programados</span> : <span style={s.tag(C.warn)}>{t.livres} a programar</span>}
      </div>
      {aberto && <div style={{ padding: "0 14px 12px" }}>
        {t.livres > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <label style={{ flex: "2 1 260px" }}><span style={s.label}>📍 COLETA {t.rota_do_bid ? "(do BID)" : t.coleta ? "(da última AT)" : ""}</span><input value={cab.coleta} onChange={(e) => setCab("coleta", e.target.value)} placeholder="Endereço de coleta" style={{ ...s.input, fontSize: 12.5 }} /></label>
          <label style={{ flex: "2 1 260px" }}><span style={s.label}>🏁 ENTREGA {t.rota_do_bid ? "(do BID)" : t.entrega ? "(da última AT)" : ""}</span><input value={cab.entrega} onChange={(e) => setCab("entrega", e.target.value)} placeholder="Endereço de entrega" style={{ ...s.input, fontSize: 12.5 }} /></label>
          <label style={{ flex: "0 1 190px" }}><span style={s.label}>COLETA — DATA E HORA</span><input type="datetime-local" value={cab.inicio} onChange={(e) => setCab("inicio", e.target.value)} style={{ ...s.input, fontSize: 12.5 }} /></label>
          <label style={{ flex: "0 1 190px" }}><span style={s.label}>ENTREGA — DATA E HORA</span><input type="datetime-local" value={cab.fim} onChange={(e) => setCab("fim", e.target.value)} style={{ ...s.input, fontSize: 12.5 }} /></label>
        </div>}
        <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{th("ITEM", 170)}{th("COLETA", 150)}{th("MOTORISTA", 160)}{th("CAVALO", 120)}{th("IMPLEMENTOS", 200)}{th("DOCUMENTOS", 140)}{th("SITUAÇÃO", 150)}</tr></thead>
            <tbody>
              {t.ats.map((a) => <tr key={a.id} className="qf-clicavel" onClick={() => onAbrirAT(a.id)} style={{ cursor: "pointer" }}>
                <td style={td}>{(a.itens || []).map((i) => <div key={i.id}>{resumo(i)}</div>)}<div style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>🚛 {a.numero}</div></td>
                <td style={td}>{dataHora(a.inicio_previsto)}</td>
                <td style={td}>{a.motorista_nome || <span style={{ color: C.warn }}>a definir</span>}{a.liberacao ? " 🔓" : ""}</td>
                <td style={td}>{(a.conjunto || []).filter((c) => c.papel === "cavalo").map((c) => c.tag || c.nome).join("")}</td>
                <td style={td}>{(a.conjunto || []).filter((c) => c.papel !== "cavalo").map((c) => c.tag || c.nome).join(" + ") || "—"}</td>
                <td style={td} onClick={(e) => e.stopPropagation()}>{DOCS.map(([k, r]) => { const anexo = (a.anexos || []).find((x) => x.tipo === k);
                  return anexo ? <button key={k} type="button" title={`Abrir ${anexo.nome}`} onClick={() => abrirDoc(a, anexo)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>{docChip(true, r)}</button>
                    : <label key={k} title={`Anexar ${r} (PDF, XML, JPG ou PNG até 10 MB)`} style={{ cursor: "pointer" }}>{docChip(false, `＋ ${r}`)}<input type="file" accept=".pdf,.xml,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { anexar(a, k, e.target.files?.[0]); e.target.value = ""; }} /></label>; })}
                  {enviando === a.id && <div style={{ fontSize: 10, color: C.muted }}>enviando…</div>}</td>
                <td style={td}><span style={s.tag(COR_STATUS[a.status])}>{NOME_STATUS[a.status]}</span></td>
              </tr>)}
              {linhas.map((l, i) => {
                const it = itemDe(l.item); const lider = liderDe(i) === i; const sit = situacao(i); const m = mot(l.motorista_id);
                return <tr key={l.item} style={{ background: lider ? "transparent" : `${C.accent}0c` }}>
                  <td style={td}><div>{resumo(it)}{Number(it?.quantidade || 1) !== 1 ? ` · qtd ${it.quantidade}` : ""}</div>
                    {erros[l.item] && <div style={{ fontSize: 11, color: C.danger, marginTop: 3 }}>✕ {erros[l.item]}</div>}</td>
                  {lider ? <>
                    <td style={td}><input type="datetime-local" value={l.inicio || cab.inicio} onChange={(e) => setL(i, "inicio", e.target.value)} style={{ ...s.input, padding: "5px 6px", fontSize: 12, color: l.inicio ? C.text : C.textSub }} /></td>
                    <td style={td}>{sel(l.motorista_id, (v) => setL(i, "motorista_id", v), optMot, 150)}
                      {m && <div style={{ fontSize: 10.5, color: (SELO[m.selo?.nivel] || SELO.sem_funcao)[1], marginTop: 2 }}>{(SELO[m.selo?.nivel] || SELO.sem_funcao)[2]}{m.selo?.geral != null ? ` · ${m.selo.geral}%` : ""}</div>}
                      {m?.selo?.nivel === "atencao" && (podeLiberar
                        ? <input value={l.justificativa} onChange={(e) => setL(i, "justificativa", e.target.value)} placeholder="Justificativa da liberação (≥15)" style={{ ...s.input, padding: "4px 6px", fontSize: 11, marginTop: 3, borderColor: C.danger }} />
                        : <div style={{ fontSize: 10.5, color: C.danger }}>só gestor/admin libera</div>)}</td>
                    <td style={td}>{sel(l.cavalo_id, (v) => setL(i, "cavalo_id", v), optEq([l.impl1, l.impl2].map(String)), 110)}</td>
                    <td style={td}><div style={{ display: "flex", gap: 4 }}>{sel(l.impl1, (v) => setL(i, "impl1", v), optEq([l.cavalo_id, l.impl2].map(String)), 95)}{sel(l.impl2, (v) => setL(i, "impl2", v), optEq([l.cavalo_id, l.impl1].map(String)), 95)}</div></td>
                  </> : <td colSpan={4} style={{ ...td, color: C.textSub, fontSize: 12 }}>⛓ mesmo conjunto, motorista e horário da linha de cima</td>}
                  <td style={td}>{DOCS.map(([k, r]) => docChip(false, r))}<div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>anexa depois de programar</div></td>
                  <td style={td}>{lider ? <>
                    {sit.pronto ? <span style={s.tag(C.success)}>✓ pronto</span> : null}
                    {sit.lst.map(([k, cor, txt]) => <div key={k} style={{ fontSize: 11, color: cor }}>{txt}</div>)}
                    {sit.conflitos.length > 0 && <div style={{ fontSize: 10.5, color: C.warn, marginTop: 2 }}>{sit.conflitos.map((c, k) => <div key={k}>• {c.texto}</div>)}
                      <label style={{ display: "flex", gap: 4, alignItems: "center", cursor: "pointer", color: C.text }}><input type="checkbox" checked={l.aceitar} onChange={(e) => setL(i, "aceitar", e.target.checked)} />programar mesmo assim</label></div>}
                  </> : <span style={{ fontSize: 11, color: C.muted }}>↑</span>}</td>
                </tr>;
              })}
              {!t.ats.length && !linhas.length && <tr><td colSpan={7} style={{ ...td, color: C.muted, textAlign: "center" }}>Sem itens ativos.</td></tr>}
            </tbody>
          </table>
        </div>
        {linhas.length > 0 && <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, color: C.muted, flex: 1 }}>Linhas incompletas ficam salvas como rascunho neste navegador. Documentos fiscais: depois de programar, clique em ＋ NF-e / CT-e / MDF-e na linha da AT para anexar (ou na ficha). São pendência — não impedem programar nem iniciar.</span>
          <button type="button" disabled={ocupado || !prontos.length} onClick={programar} style={{ ...s.btn(!ocupado && prontos.length > 0), padding: "8px 16px", fontSize: 13 }}>{ocupado ? "Programando…" : `🚛 Programar ${prontos.length} AT${prontos.length === 1 ? "" : "s"} pronta${prontos.length === 1 ? "" : "s"}`}</button>
        </div>}
      </div>}
    </div>
  );
}

export default function MesaProgramacao({ C, s, pedidos, podeLiberar, onAbrirAT, onSalvou, onErro, onOk }) {
  const [base, setBase] = useState(null);
  const [soPendentes, setSoPendentes] = useState(true);
  useEffect(() => { apiService.get("/programacao/base").then(setBase).catch((e) => onErro(e.message)); }, []); // eslint-disable-line
  if (!pedidos || !base) return <div style={{ color: C.muted }}>Carregando…</div>;
  const lista = pedidos.filter((p) => !soPendentes || p.trechos.some((t) => t.livres > 0));
  return <>
    <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, color: C.textSub, marginBottom: 10, cursor: "pointer" }}><input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} />Só pedidos com itens a programar</label>
    {!lista.length && <div style={{ ...s.card, padding: 24, textAlign: "center", color: C.muted }}>{pedidos.length ? "Tudo programado. 🎉 Desmarque o filtro para ver os pedidos." : "Nenhum pedido aberto. Os pedidos nascem do aceite do BID no 📈 Comercial."}</div>}
    {lista.map((p) => <div key={p.id} style={{ ...s.card, padding: 0, marginBottom: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: C.bg }}>
        <b>{p.numero}</b><span style={{ color: C.textSub, fontSize: 13 }}>{p.cliente_nome}{p.titulo ? ` · ${p.titulo}` : ""}{p.referencia ? ` · ref. ${p.referencia}` : ""}</span>
      </div>
      {p.tipo_execucao !== "transporte" ? <div style={{ padding: "10px 14px", fontSize: 12.5, color: C.muted, borderTop: `1px solid ${C.border}` }}>Pedido do tipo “{p.tipo_execucao}” — ainda não programável aqui.</div>
        : p.trechos.filter((t) => t.qtd > 0).map((t) => <Trecho key={`${t.id}:${t.itens.filter((i) => !i.at).map((i) => i.id).join(",")}`} C={C} s={s} pv={p} t={t} base={base} podeLiberar={podeLiberar} onAbrirAT={onAbrirAT} onSalvou={onSalvou} onErro={onErro} onOk={onOk} />)}
    </div>)}
  </>;
}

