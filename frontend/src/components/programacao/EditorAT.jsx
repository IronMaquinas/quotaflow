// components/programacao/EditorAT.jsx — etapa 16c: o modal de uma programação (um item = um conjunto = uma AT)
//   · rota e data vêm do trecho (BID/pedido) — editáveis
//   · motorista, cavalo, implemento 1, implemento 2 — cada campo com nome; 🔒 bloqueado não aparece como opção
//   · documentos do motorista (CNH) e do conjunto (CRLV) puxados do cadastro, pela data da viagem — clique abre
//       vencido → trava (gestor/admin libera com justificativa) · não cadastrado → só avisa · vence em até 30 dias → 🟡
//   · NF-e / CT-e / MDF-e: anexa aqui (numa programação nova, o rascunho é salvo sozinho para guardar o arquivo) — clique abre
//   · 💾 Salvar rascunho (fecha e guarda no servidor) · 🚛 Programar · Cancelar (sai sem gravar o que mudou)
import { useState, useEffect, useRef } from "react";
import apiService from "../../services/apiService";
import { valorCelula } from "../../utils/gerarBid";
import { SELO } from "./FichaAT";
import VerArquivo, { ChipDoc, TXT_DOC } from "./VerArquivo";

const FISCAIS = [["nfe", "NF-e"], ["cte", "CT-e"], ["mdfe", "MDF-e"]];
const local = (iso) => (iso ? new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 16) : "");
const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "");
export const lerArquivo = (arq) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = ko; r.readAsDataURL(arq); });
export const mimeDe = (arq) => arq.type || (/\.xml$/i.test(arq.name) ? "application/xml" : "");

/** pv { id, numero, colunas }, trecho { id, titulo, coleta, entrega, datas }, itemId (programação nova) ou atual (rascunho/AT) */
export default function EditorAT({ C, s, pv, trecho, itemId, atual: atual0, base, podeLiberar, onFechar, onSalvo, onErro }) {
  const [atual, setAtual] = useState(atual0 || null);
  const conj = (papel, n) => (atual0?.conjunto || []).filter((c) => c.papel === papel)[n]?.id ?? "";
  const [f, setF] = useState(() => ({
    coleta: atual0?.origem || trecho?.coleta || "", entrega: atual0?.destino || trecho?.entrega || "",
    inicio: local(atual0?.inicio_previsto) || (trecho?.datas?.[0] ? `${trecho.datas[0]}T08:00` : ""), fim: local(atual0?.fim_previsto),
    motorista_id: atual0?.motorista_id ?? "", cavalo_id: conj("cavalo", 0), impl1: conj("implemento", 0), impl2: conj("implemento", 1), observacoes: atual0?.observacoes || "",
    just_mot: "", just_docs: "", aceitar: false }));
  const [docs, setDocs] = useState([]);
  const [conf, setConf] = useState([]);
  const [erro, setErro] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [subindo, setSubindo] = useState(null);
  const [ver, setVer] = useState(null);
  const seq = useRef(0);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const itens = atual?.itens || (pv.itensTrecho || []).filter((i) => String(i.id) === String(itemId));
  const resumo = (i) => (pv.colunas || []).filter((c) => c.chave !== "data_prevista" && c.tipo !== "moeda").map((c) => { const v = valorCelula(c, i?.valores?.[c.chave]); return v ? `${c.rotulo}: ${v}` : null; }).filter(Boolean).join(" · ");
  const mot = base.motoristas.find((m) => String(m.id) === String(f.motorista_id));
  const programada = atual && atual.status !== "rascunho";

  // documentos (CNH/CRLV) e conflitos — conferidos enquanto escolhe
  useEffect(() => {
    const n = ++seq.current; const corpo = { motorista_id: f.motorista_id || null, cavalo_id: f.cavalo_id || null, implementos: [f.impl1, f.impl2].filter(Boolean), inicio: f.inicio || null, fim: f.fim || null };
    const tm = setTimeout(async () => {
      try {
        const [d, c] = await Promise.all([apiService.post("/programacao/docs", corpo),
          f.inicio && (f.motorista_id || f.cavalo_id) ? apiService.post("/programacao/checar", { linhas: [{ chave: "x", inicio: f.inicio, fim: f.fim || null, motorista_id: f.motorista_id || null, motorista_nome: mot?.nome, cavalo_id: f.cavalo_id || null, implementos: corpo.implementos, tags: Object.fromEntries(base.equipamentos.map((e) => [e.id, e.tag || e.nome])) }] }) : Promise.resolve({ conflitos: {} })]);
        if (n !== seq.current) return;
        setDocs(d.docs || []); setConf((c.conflitos?.x || []).filter((x) => String(x.id) !== String(atual?.id)));
      } catch { /* conferência é só ajuda */ }
    }, 350);
    return () => clearTimeout(tm);
  }, [f.motorista_id, f.cavalo_id, f.impl1, f.impl2, f.inicio, f.fim]); // eslint-disable-line

  const vencidos = docs.filter((d) => d.status === "vencido");
  const motVermelho = mot?.selo?.nivel === "atencao" && !(atual?.liberacao && String(atual.motorista_id) === String(f.motorista_id));
  const docsJaLiberados = atual?.liberacao_docs && vencidos.every((d) => (atual.liberacao_docs.chaves || "").includes(d.chave));
  const faltas = [];
  if (!f.inicio) faltas.push("data e hora da coleta");
  if (!f.cavalo_id) faltas.push("cavalo");
  if (motVermelho && (!podeLiberar || f.just_mot.trim().length < 15)) faltas.push(podeLiberar ? "justificar a liberação do motorista" : "liberação do motorista por um gestor");
  if (vencidos.length && !docsJaLiberados && (!podeLiberar || f.just_docs.trim().length < 15)) faltas.push(podeLiberar ? "justificar o documento vencido" : "liberação do documento por um gestor");
  if (conf.length && !f.aceitar) faltas.push("confirmar o conflito de agenda");

  const corpo = (extra = {}) => ({ grupo_id: trecho?.id ?? atual?.grupo_id, itens: atual ? undefined : [itemId], origem: f.coleta, destino: f.entrega, inicio: f.inicio || null, fim: f.fim || null,
    motorista_id: f.motorista_id || null, cavalo_id: f.cavalo_id || null, implementos: [f.impl1, f.impl2].filter(Boolean), observacoes: f.observacoes,
    liberacao_justificativa: motVermelho ? f.just_mot : undefined, liberacao_docs_justificativa: vencidos.length && !docsJaLiberados ? f.just_docs : undefined, ignorar_conflito: !!f.aceitar, ...extra });
  const gravar = async (rascunho) => {
    const b = corpo(rascunho ? { rascunho: true } : {});
    return atual ? apiService.put(`/programacao/execucoes/${atual.id}`, b) : apiService.post(`/programacao/pvs/${pv.id}/at`, b);
  };
  const salvar = async (rascunho) => {
    setOcupado(true); setErro(null);
    try {
      const r = await gravar(rascunho);
      onSalvo(rascunho ? "💾 Rascunho salvo — continue quando quiser." : `${r.execucao.numero} ${programada ? "atualizada" : "programada"}.${r.avisos?.length ? ` ${r.avisos.join(" · ")}` : ""}`);
    } catch (e) { setErro(e.message); } finally { setOcupado(false); }
  };
  const descartar = async () => { setOcupado(true); try { await apiService.delete(`/programacao/execucoes/${atual.id}`); onSalvo("Rascunho descartado."); } catch (e) { setErro(e.message); setOcupado(false); } };

  // anexos fiscais: numa programação nova, salva o rascunho antes (o arquivo precisa de onde ficar)
  const anexar = async (tipo, arq) => {
    if (!arq) return; if (arq.size > 10 * 1024 * 1024) return setErro("Arquivo maior que 10 MB");
    setSubindo(tipo); setErro(null);
    try {
      let alvo = atual;
      if (!alvo) { const r = await gravar(true); alvo = r.execucao; }
      const r = await apiService.post(`/programacao/execucoes/${alvo.id}/anexos`, { tipo, nome: arq.name, mime: mimeDe(arq), base64: await lerArquivo(arq) });
      setAtual(r.execucao);
    } catch (e) { setErro(e.message); } finally { setSubindo(null); }
  };
  const verAnexo = async (a) => { setVer({ nome: a.nome, mime: a.mime }); try { const r = await apiService.get(`/programacao/execucoes/${atual.id}/anexos/${a.id}`); setVer({ url: r.url, nome: a.nome, mime: a.mime }); } catch (e) { setVer(null); setErro(e.message); } };
  const verDoc = async (d) => {
    if (!d.documento_id || !d.tem_arquivo) return setErro(`${d.rotulo} de ${d.dono}: ${d.documento_id ? "cadastrado sem arquivo" : "não está cadastrado"} — inclua em ${d.alvo === "motorista" ? "👷 Pessoas → Documentos" : "documentos do equipamento"}. O motorista pode seguir com o documento em mãos.`);
    setVer({ nome: `${d.rotulo} — ${d.dono}` }); try { const r = await apiService.get(`/programacao/documentos/${d.documento_id}`); setVer({ url: r.url, nome: r.nome || `${d.rotulo} — ${d.dono}`, mime: r.mime }); } catch (e) { setVer(null); setErro(e.message); }
  };
  const removerAnexo = async (a) => { try { const r = await apiService.delete(`/programacao/execucoes/${atual.id}/anexos/${a.id}`); setAtual(r.execucao); } catch (e) { setErro(e.message); } };

  const lbl = (r, el, flex = "1 1 200px") => <label style={{ flex, display: "block", minWidth: 0 }}><span style={s.label}>{r}</span>{el}</label>;
  const optEq = (excluir) => [<option key="" value="">—</option>, ...base.equipamentos.filter((e) => !excluir.includes(String(e.id))).map((e) => <option key={e.id} value={e.id} disabled={e.bloqueado}>{e.bloqueado ? "🔒 " : ""}{e.tag ? `${e.tag} — ` : ""}{e.nome}{e.bloqueado ? " (bloqueado)" : ""}</option>)];
  const cfEq = (id) => id && conf.some((c) => c.tipo === "equipamento" && c.texto.startsWith(base.equipamentos.find((e) => String(e.id) === String(id))?.tag || "§"));
  const cfMot = conf.some((c) => c.tipo === "motorista");
  const borda = (ruim) => (ruim ? { border: `1px solid ${C.warn}`, boxShadow: `0 0 0 1px ${C.warn}` } : {});
  const caixa = (cor, conteudo) => <div style={{ ...s.card, padding: "9px 12px", marginTop: 10, borderColor: cor, background: `${cor}12` }}>{conteudo}</div>;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 330, padding: 16, overflowY: "auto" }} onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: 820, maxWidth: "100%", padding: "16px 20px", margin: "auto 0", color: C.text, boxShadow: "0 24px 48px #00000060" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 700 }}>{programada ? `✏ ${atual.numero}` : atual ? "💾 Rascunho da programação" : "🚛 Nova programação"}</div>
          <button type="button" onClick={onFechar} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 10 }}>{pv.numero} · <b style={{ color: C.text }}>{trecho?.titulo || atual?.grupo_titulo}</b>{itens.map((i) => <div key={i.id} style={{ color: C.text, marginTop: 2 }}>📦 {resumo(i) || `Item ${i.id}`}</div>)}</div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{lbl("📍 COLETA", <input value={f.coleta} onChange={(e) => set("coleta", e.target.value)} style={s.input} />, "1 1 340px")}{lbl("DATA E HORA DA COLETA *", <input type="datetime-local" value={f.inicio} onChange={(e) => set("inicio", e.target.value)} style={s.input} />, "0 1 200px")}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{lbl("🏁 ENTREGA", <input value={f.entrega} onChange={(e) => set("entrega", e.target.value)} style={s.input} />, "1 1 340px")}{lbl("DATA E HORA DA ENTREGA", <input type="datetime-local" value={f.fim} onChange={(e) => set("fim", e.target.value)} style={s.input} />, "0 1 200px")}</div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {lbl("MOTORISTA", <select value={f.motorista_id} onChange={(e) => set("motorista_id", e.target.value)} style={{ ...s.input, ...borda(cfMot) }}><option value="">— a definir —</option>{base.motoristas.map((m) => <option key={m.id} value={m.id}>{(SELO[m.selo?.nivel] || SELO.sem_funcao)[0]} {m.nome}{m.cnh ? ` · CNH ${m.cnh}` : ""}</option>)}</select>, "1 1 100%")}
          {lbl("CAVALO (TRATOR) *", <select value={f.cavalo_id} onChange={(e) => set("cavalo_id", e.target.value)} style={{ ...s.input, ...borda(cfEq(f.cavalo_id)) }}>{optEq([String(f.impl1), String(f.impl2)])}</select>)}
          {lbl("IMPLEMENTO 1", <select value={f.impl1} onChange={(e) => set("impl1", e.target.value)} style={{ ...s.input, ...borda(cfEq(f.impl1)) }}>{optEq([String(f.cavalo_id), String(f.impl2)])}</select>)}
          {lbl("IMPLEMENTO 2", <select value={f.impl2} onChange={(e) => set("impl2", e.target.value)} style={{ ...s.input, ...borda(cfEq(f.impl2)) }}>{optEq([String(f.cavalo_id), String(f.impl1)])}</select>)}
        </div>
        {mot && <div style={{ fontSize: 11.5, marginTop: 4, color: (SELO[mot.selo?.nivel] || SELO.sem_funcao)[1] }}>Selo de {mot.nome}: {(SELO[mot.selo?.nivel] || SELO.sem_funcao)[0]} {(SELO[mot.selo?.nivel] || SELO.sem_funcao)[2]}{mot.selo?.geral != null ? ` · ${mot.selo.geral}%` : ""}</div>}

        <div style={{ ...s.label, marginTop: 14 }}>KIT DO MOTORISTA — DOCUMENTOS</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {docs.map((d) => <ChipDoc key={d.chave} C={C} status={d.status} rotulo={`${d.rotulo} ${d.dono}`} title={`${TXT_DOC[d.status]}${d.vence_em ? ` · vence ${dBR(d.vence_em)}` : ""}${d.tem_arquivo ? " — clique para ver" : ""}`} onClick={() => verDoc(d)} />)}
          {!docs.length && <span style={{ fontSize: 11.5, color: C.muted }}>Escolha motorista e conjunto para puxar a CNH e os CRLV do cadastro.</span>}
          <span style={{ width: 1, height: 18, background: C.border, margin: "0 4px" }} />
          {FISCAIS.map(([k, r]) => { const a = (atual?.anexos || []).find((x) => x.tipo === k);
            return a ? <span key={k} style={{ display: "inline-flex", alignItems: "center" }}><ChipDoc C={C} status="ok" rotulo={r} title={`${a.nome} — clique para ver`} onClick={() => verAnexo(a)} /><button type="button" title="Tirar" onClick={() => removerAnexo(a)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 11 }}>✕</button></span>
              : <label key={k} style={{ display: "inline-flex" }} title={`Anexar ${r} (PDF, XML, JPG ou PNG até 10 MB)`}><ChipDoc C={C} status="falta" rotulo={r} carregando={subindo === k} onClick={(e) => e.currentTarget.parentElement.querySelector("input").click()} />
                <input type="file" accept=".pdf,.xml,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { anexar(k, e.target.files?.[0]); e.target.value = ""; }} /></label>; })}
        </div>
        <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>CNH e CRLV vêm do cadastro, pela data da viagem (vermelho = vencido ou não cadastrado). Clique em qualquer documento para conferir. Tudo isso vai no 📲 link do motorista.</div>

        {motVermelho && caixa(C.danger, <><div style={{ fontSize: 12.5, color: C.danger, fontWeight: 700 }}>🔴 {mot.nome} tem item vencido no selo de conformidade.</div>
          {podeLiberar ? <textarea rows={2} value={f.just_mot} onChange={(e) => set("just_mot", e.target.value)} placeholder="Justificativa da liberação do motorista (mínimo 15 caracteres)" style={{ ...s.input, resize: "vertical", marginTop: 6 }} /> : <div style={{ fontSize: 12, color: C.textSub }}>Só gestor ou admin libera — salve como rascunho e peça a liberação, ou troque o motorista.</div>}</>)}
        {vencidos.length > 0 && !docsJaLiberados && caixa(C.danger, <><div style={{ fontSize: 12.5, color: C.danger, fontWeight: 700 }}>📄 Vencido na data da viagem: {vencidos.map((d) => `${d.rotulo} de ${d.dono} (${dBR(d.vence_em)})`).join(" · ")}</div>
          {podeLiberar ? <textarea rows={2} value={f.just_docs} onChange={(e) => set("just_docs", e.target.value)} placeholder="Justificativa da liberação (mínimo 15 caracteres) — ex.: renovação protocolada, documento provisório em mãos" style={{ ...s.input, resize: "vertical", marginTop: 6 }} /> : <div style={{ fontSize: 12, color: C.textSub }}>Só gestor ou admin libera — salve como rascunho e avise o gestor.</div>}</>)}
        {conf.length > 0 && caixa(C.warn, <><div style={{ fontSize: 12.5, color: C.warn, fontWeight: 700 }}>⚠ Conflito de agenda</div>{conf.map((c, i) => <div key={i} style={{ fontSize: 12 }}>• {c.tipo === "motorista" ? "Motorista" : "Equipamento"}: {c.texto}</div>)}
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, marginTop: 4, cursor: "pointer" }}><input type="checkbox" checked={f.aceitar} onChange={(e) => set("aceitar", e.target.checked)} />Programar mesmo assim (viagens em sequência, por exemplo)</label></>)}

        <label style={{ display: "block", marginTop: 12 }}><span style={s.label}>OBSERVAÇÕES PARA O MOTORISTA</span><textarea rows={2} value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} placeholder="Ex.: escolta a partir do km 230; contato no destino: Sr. Paulo (31) 9…" style={{ ...s.input, resize: "vertical" }} /></label>
        {avisos.map((a, i) => <div key={i} style={{ fontSize: 12, color: C.warn, marginTop: 4 }}>{a}</div>)}
        {erro && <div style={{ fontSize: 12.5, color: C.danger, marginTop: 8 }}>✕ {erro}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
          {atual?.status === "rascunho" && <button type="button" disabled={ocupado} onClick={descartar} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 12 }}>🗑 Descartar rascunho</button>}
          <div style={{ flex: 1, fontSize: 11.5, color: C.muted, textAlign: "right" }}>{!faltas.length ? "" : `Para programar: ${faltas.join(" · ")}`}</div>
          <button type="button" onClick={onFechar} style={{ ...s.btn(false), cursor: "pointer", color: C.text, padding: "8px 14px" }}>Cancelar</button>
          {!programada && <button type="button" disabled={ocupado} onClick={() => salvar(true)} style={{ ...s.btn(false), cursor: "pointer", color: C.text, padding: "8px 14px", borderColor: C.accent }}>💾 Salvar rascunho</button>}
          <button type="button" disabled={ocupado || faltas.length > 0} onClick={() => salvar(false)} style={{ ...s.btn(!ocupado && !faltas.length), padding: "8px 16px" }}>{ocupado ? "Salvando…" : programada ? "Salvar" : "🚛 Programar"}</button>
        </div>
      </div>
      {ver && <VerArquivo C={C} s={s} arquivo={ver} onFechar={() => setVer(null)} />}
    </div>
  );
}
