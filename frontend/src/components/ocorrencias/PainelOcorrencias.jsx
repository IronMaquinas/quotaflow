// components/ocorrencias/PainelOcorrencias.jsx — etapa 18h: ⚠️ ocorrências / sinistros (SIN)
//   modo "empresa": aba ⚠️ Ocorrências em 📑 Contratos (e lista pela AT) — status, responsabilidade, conversa, fotos, dossiê
//   modo "cliente": aba do locatário — registra, acompanha, conversa e manda mais fotos/BO
//   "Parado" só informa: o comercial decide (a medição mostra os dias, nada é descontado sozinho).
import { useState, useEffect, useCallback } from "react";
import apiService from "../../services/apiService";
import RegistrarOcorrencia, { TIPOS_OC, enviarArquivos } from "./RegistrarOcorrencia";
import { abrirDossie, prepararJanela } from "../../utils/gerarDossieOcorrencia";

const STATUS = { registrada: "Registrada", em_analise: "Em análise", em_atendimento: "Em atendimento", encerrada: "Encerrada" };
const RESP = { a_definir: "A definir", cliente: "Cliente", locadora: "Locadora", seguro: "Seguro" };
const dh = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
export const corStatusOc = (C, st) => ({ registrada: C.danger, em_analise: "#f59e0b", em_atendimento: C.accent, encerrada: C.success }[st] || C.muted);

export default function PainelOcorrencias({ C, s, modo = "empresa", usuario = null, filtro = {}, podeEditar = false, abrirId = null, onAberto, onErro, onOk, semBotaoNovo = false, at = null, onMudou = null }) {
  const base = modo === "cliente" ? "/locatario/ocorrencias" : "/ocorrencias";
  const [lista, setLista] = useState(null); const [semMig, setSemMig] = useState(false);
  const [ver, setVer] = useState("abertas"); const [aberta, setAberta] = useState(null); const [novo, setNovo] = useState(false); const [contratos, setContratos] = useState(null);
  const carregar = useCallback(async () => {
    try { const r = await apiService.get(base, { ...filtro, ...(ver === "abertas" ? { status: "abertas" } : {}) }); setLista(r.ocorrencias || []); setSemMig(!!r.sem_migration); onMudou?.(); }
    catch (e) { onErro?.(e.message); setLista([]); }
  }, [base, ver, filtro.contrato_id, filtro.execucao_id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (abrirId) { setAberta(abrirId); onAberto?.(); } }, [abrirId]); // eslint-disable-line react-hooks/exhaustive-deps
  const abrirNovo = async () => {
    if (modo === "empresa" && !at && !contratos) {
      try { const r = await apiService.get("/contratos"); setContratos((r.contratos || []).filter((c) => c.status === "ativo" && (!filtro.contrato_id || String(c.id) === String(filtro.contrato_id)))
        .map((c) => ({ id: c.id, numero: c.numero, cliente: c.cliente, local: c.local, equipamentos: (c.equipamentos || []).filter((e) => e.ativa).map((e) => ({ equipamento_id: e.equipamento_id, tag: e.tag, nome: e.nome })) }))); }
      catch (e) { return onErro?.(e.message); }
    }
    setNovo(true);
  };
  return <div>
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
      {[["abertas", "Em aberto"], ["todas", "Todas"]].map(([k, l]) => <button key={k} type="button" onClick={() => setVer(k)} style={{ ...s.btn(ver === k), padding: "6px 12px", fontSize: 12.5, cursor: "pointer" }}>{l}</button>)}
      <span style={{ flex: 1 }} />
      {!semBotaoNovo && <button type="button" onClick={abrirNovo} style={{ ...s.btn(true), padding: "7px 14px", fontSize: 13, cursor: "pointer" }}>⚠️ Registrar ocorrência</button>}
    </div>
    {semMig && <div style={{ ...s.card, padding: 12, fontSize: 13, color: C.danger, marginBottom: 10 }}>Falta rodar a migration 068 (ocorrências) no Supabase.</div>}
    {lista === null ? <div style={{ color: C.muted, fontSize: 13 }}>Carregando…</div> : lista.length === 0 ? <div style={{ ...s.card, padding: 16, fontSize: 13, color: C.muted }}>{ver === "abertas" ? "Nenhuma ocorrência em aberto." : "Nenhuma ocorrência registrada."}</div>
      : <div style={{ display: "grid", gap: 8 }}>{lista.map((o) => <div key={o.id} role="button" tabIndex={0} className="qf-clicavel" onClick={() => setAberta(o.id)} onKeyDown={(e) => e.key === "Enter" && setAberta(o.id)}
        style={{ ...s.card, padding: "10px 14px", cursor: "pointer", borderLeft: `4px solid ${corStatusOc(C, o.status)}` }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <b style={{ fontSize: 13.5 }}>{o.numero}</b><span style={{ fontSize: 13 }}>{TIPOS_OC[o.tipo] || o.tipo_nome}</span>
          {o.parado && <span style={{ fontSize: 11.5, color: C.danger, fontWeight: 700 }}>⛔ parado · {o.dias_parado}d</span>}
          <span style={{ flex: 1 }} /><span style={{ fontSize: 12, color: corStatusOc(C, o.status), fontWeight: 600 }}>{o.status_nome}</span>
        </div>
        <div style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>{o.resumo} · {dh(o.ocorrido_em)}{(o.mensagens || []).length ? ` · 💬 ${o.mensagens.length}` : ""}{(o.fotos || []).length ? ` · 📷 ${o.fotos.length}` : ""}{modo === "empresa" && o.responsabilidade !== "a_definir" ? ` · resp.: ${o.responsabilidade_nome}` : ""}</div>
      </div>)}</div>}
    {novo && <RegistrarOcorrencia C={C} s={s} modo={modo === "cliente" ? "cliente" : "empresa"} at={at} contratos={modo === "cliente" ? null : contratos} usuario={usuario}
      inicial={filtro.contrato_id ? { contrato_id: String(filtro.contrato_id) } : {}} onFechar={() => setNovo(false)}
      onCriada={(oc, falhas) => { setNovo(false); onOk?.(`⚠️ ${oc.numero} registrada — o comercial foi avisado${falhas?.length ? `. Não subiram: ${falhas.join("; ")}` : ""}`); carregar(); setAberta(oc.id); }} />}
    {aberta && <DetalheOcorrencia C={C} s={s} modo={modo} id={aberta} usuario={usuario} podeEditar={podeEditar} onFechar={() => { setAberta(null); carregar(); }} onErro={onErro} />}
  </div>;
}

export function DetalheOcorrencia({ C, s, modo = "empresa", id, usuario = null, podeEditar = false, onFechar, onErro }) {
  const base = modo === "cliente" ? "/locatario/ocorrencias" : "/ocorrencias";
  const [d, setD] = useState(null); const [msg, setMsg] = useState(""); const [ocupado, setOcupado] = useState(false); const [erro, setErro] = useState(null);
  const [confirmar, setConfirmar] = useState(null); const [motivo, setMotivo] = useState("");
  const carregar = useCallback(async () => { try { setD(await apiService.get(`${base}/${id}`)); } catch (e) { setErro(e.message); } }, [base, id]);
  useEffect(() => { carregar(); }, [carregar]);
  const o = d?.ocorrencia; const c = o?.contexto || {}; const fechada = o?.status === "encerrada";
  const acao = async (fn) => { setOcupado(true); setErro(null); try { await fn(); await carregar(); } catch (e) { setErro(e.message); } finally { setOcupado(false); } };
  const mudar = (corpo) => acao(async () => { await apiService.put(`${base}/${id}`, corpo); setConfirmar(null); setMotivo(""); });
  const enviarMsg = () => acao(async () => { await apiService.post(`${base}/${id}/mensagens`, { texto: msg }); setMsg(""); });
  const subir = (tipo, files) => acao(async () => { const falhas = await enviarArquivos(base, o, tipo === "bo" ? { bo: files[0] } : { fotos: Array.from(files).map((file) => ({ file })), quem: usuario?.nome || null }); if (falhas.length) throw new Error(`Não subiram: ${falhas.join("; ")}`); });
  const dossie = () => { const w = prepararJanela(); try { abrirDossie(o, { empresa: d.empresa || {}, interno: modo === "empresa" }, w); } catch (e) { onErro?.(e.message); } };
  const lin = (k, v) => (v ? <div style={{ display: "flex", gap: 8, fontSize: 12.5, marginBottom: 2 }}><span style={{ color: C.muted, minWidth: 110 }}>{k}</span><span>{v}</span></div> : null);
  const pedirStatus = (st) => { if (st === "encerrada") setConfirmar({ status: "encerrada" }); else if (fechada) setConfirmar({ status: st, reabrir: true }); else mudar({ status: st }); };
  return <div onClick={(x) => x.stopPropagation()} style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 425, padding: 16, overflowY: "auto" }}>
    <div role="dialog" aria-modal="true" aria-label="Ocorrência" style={{ ...s.card, width: 760, maxWidth: "100%", padding: 20, marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <b style={{ flex: 1, fontSize: 16 }}>⚠️ {o ? `${o.numero} — ${TIPOS_OC[o.tipo] || o.tipo_nome}` : "Ocorrência"}</b>
        {o && <button type="button" onClick={dossie} style={{ ...s.btn(false), padding: "6px 12px", fontSize: 12.5, color: C.text, cursor: "pointer" }}>📄 Dossiê</button>}
        <button type="button" aria-label="Fechar" onClick={onFechar} style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
      </div>
      {!o ? <div style={{ color: erro ? C.danger : C.muted, fontSize: 13 }}>{erro || "Carregando…"}</div> : <>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          {modo === "empresa" && podeEditar ? <>
            <select aria-label="Situação" value={o.status} disabled={ocupado} onChange={(e) => pedirStatus(e.target.value)} style={{ ...s.input, width: "auto", marginBottom: 0, color: corStatusOc(C, o.status), fontWeight: 600 }}>{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <select aria-label="Responsabilidade" value={o.responsabilidade} disabled={ocupado} onChange={(e) => mudar({ responsabilidade: e.target.value })} style={{ ...s.input, width: "auto", marginBottom: 0 }}>{Object.entries(RESP).map(([k, l]) => <option key={k} value={k}>Responsabilidade: {l}</option>)}</select>
            <label style={{ fontSize: 12.5, display: "flex", gap: 5, alignItems: "center" }}><input type="checkbox" aria-label="Parado" checked={!!o.parado} disabled={ocupado || fechada} onChange={(e) => mudar({ parado: e.target.checked })} />⛔ parado</label>
          </> : <><span style={{ fontWeight: 600, color: corStatusOc(C, o.status), fontSize: 13 }}>{o.status_nome}</span>{modo === "empresa" && <span style={{ fontSize: 12.5 }}>· Responsabilidade: {o.responsabilidade_nome}</span>}</>}
          {o.parado && <span style={{ fontSize: 12.5, color: C.danger, fontWeight: 700 }}>⛔ parado há {o.dias_parado} dia(s) — o comercial decide</span>}
          {modo === "empresa" && o.tarefa?.numero && <span style={{ fontSize: 12, color: C.textSub }}>· 🔧 {o.tarefa.numero}</span>}
        </div>
        {confirmar && <div style={{ ...s.card, padding: 12, marginBottom: 10, borderColor: C.accent }}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>{confirmar.reabrir ? <>Reabrir a {o.numero}? Informe o motivo.</> : <>Encerrar a {o.numero}? Depois de encerrada ela não recebe mais mensagens nem arquivos (dá para reabrir com motivo).</>}</div>
          {confirmar.reabrir && <input aria-label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo *" style={{ ...s.input, width: "100%" }} />}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => { setConfirmar(null); setMotivo(""); }} style={{ ...s.btn(false), padding: "6px 12px", color: C.text, cursor: "pointer" }}>Cancelar</button>
            <button type="button" disabled={ocupado || (confirmar.reabrir && motivo.trim().length < 3)} onClick={() => mudar({ status: confirmar.status, motivo })} style={{ ...s.btn(true), padding: "6px 12px", cursor: "pointer" }}>{confirmar.reabrir ? "Reabrir" : "Encerrar"}</button>
          </div>
        </div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
          <div>
            {lin("Quando", dh(o.ocorrido_em))}{lin("Local", o.local)}{lin("GPS", o.gps ? `${o.gps.lat.toFixed?.(5) ?? o.gps.lat}, ${o.gps.lng.toFixed?.(5) ?? o.gps.lng}` : null)}
            {lin("Registrada por", `${o.registrado_por_nome || "—"}${o.registrado_por_tipo === "locatario" ? " (cliente)" : ""} · ${dh(o.criado_em)}`)}
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13, background: C.bg || "#0001", padding: 10, borderRadius: 6, marginTop: 6 }}>{o.descricao}</div>
          </div>
          <div style={{ fontSize: 12.5 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Contexto no momento do registro</div>
            {o.origem === "at" ? <>{lin("AT", c.at?.numero)}{lin("Motorista", c.motorista?.nome)}{lin("Conjunto", (c.conjunto || []).map((x) => x.placa || x.tag).filter(Boolean).join(" + "))}
              {lin("Carga", (c.carga || []).map((x) => x.descricao).filter(Boolean).join(", "))}{lin("Documentos", (c.documentos || []).map((x) => String(x.tipo).toUpperCase()).join(" · "))}
              {lin("Averbação", (c.fiscal?.averbacoes || []).join(", "))}{lin("Última posição", c.ultima_posicao ? `${c.ultima_posicao.etapa || ""} · ${dh(c.ultima_posicao.em)}` : null)}</>
              : <>{lin("Contrato", `${c.contrato?.numero || ""}${c.contrato?.cliente ? ` · ${c.contrato.cliente}` : ""}`)}{lin("Equipamento", [c.equipamento?.tag, c.equipamento?.nome].filter(Boolean).join(" — "))}{lin("Modelo / série", [c.equipamento?.modelo, c.equipamento?.serie].filter(Boolean).join(" · "))}
              {lin("Última inspeção", c.ultima_inspecao ? `${c.ultima_inspecao.numero || ""} · ${dh(c.ultima_inspecao.em)} · ${c.ultima_inspecao.resultado || ""}` : "sem inspeção")}
              {c.ultima_inspecao?.nao_ok?.length ? lin("Não OK", c.ultima_inspecao.nao_ok.join(", ")) : null}</>}
          </div>
        </div>
        <div style={{ marginTop: 14, fontWeight: 600, fontSize: 13 }}>📷 Fotos ({(o.fotos || []).length}) e documentos</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          {(o.fotos || []).map((f) => <a key={f.id} href={f.url || "#"} target="_blank" rel="noreferrer" title={`${f.legenda || f.nome} · ${f.lado === "cliente" ? "cliente" : "empresa"} · ${dh(f.em)}`}>
            {f.url ? <img src={f.url} alt={f.legenda || f.nome} style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.border}` }} /> : <span style={{ fontSize: 12 }}>{f.nome}</span>}</a>)}
          {(o.anexos || []).map((a) => <a key={a.id} href={a.url || "#"} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: C.accent, alignSelf: "center" }}>{a.tipo === "bo" ? "📄 BO" : "📎"} {a.nome}</a>)}
        </div>
        {!fechada && <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <label style={{ ...s.btn(false), padding: "6px 12px", fontSize: 12.5, color: C.text, cursor: "pointer" }}>＋ Fotos<input type="file" aria-label="Mais fotos" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ""; if (fs.length) subir("foto", fs); }} /></label>
          <label style={{ ...s.btn(false), padding: "6px 12px", fontSize: 12.5, color: C.text, cursor: "pointer" }}>＋ BO / documento<input type="file" aria-label="Mais documento" accept=".pdf,image/*" style={{ display: "none" }} onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ""; if (fs.length) subir("bo", fs); }} /></label>
        </div>}
        <div style={{ marginTop: 14, fontWeight: 600, fontSize: 13 }}>💬 Conversa {modo === "empresa" ? "com o cliente" : "com a locadora"}</div>
        <div style={{ display: "grid", gap: 6, marginTop: 6, maxHeight: 240, overflowY: "auto" }}>
          {(o.mensagens || []).length === 0 && <div style={{ fontSize: 12.5, color: C.muted }}>Nenhuma mensagem.</div>}
          {(o.mensagens || []).map((m) => { const minha = (modo === "cliente") === (m.lado === "cliente");
            return <div key={m.id} style={{ justifySelf: minha ? "end" : "start", maxWidth: "80%", background: minha ? `${C.accent}22` : (C.bg || "#0001"), padding: "6px 10px", borderRadius: 8, fontSize: 13 }}>
              <div style={{ fontSize: 11, color: C.muted }}>{m.por} · {m.lado === "cliente" ? "cliente" : "empresa"} · {dh(m.em)}</div><div style={{ whiteSpace: "pre-wrap" }}>{m.texto}</div></div>; })}
        </div>
        {!fechada && <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input aria-label="Mensagem" value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && msg.trim() && enviarMsg()} placeholder="Escreva uma mensagem…" style={{ ...s.input, flex: 1, marginBottom: 0 }} />
          <button type="button" disabled={!msg.trim() || ocupado} onClick={enviarMsg} style={{ ...s.btn(true), padding: "6px 14px", cursor: "pointer" }}>Enviar</button>
        </div>}
        {modo === "empresa" && (o.historico || []).length > 0 && <details style={{ marginTop: 14, fontSize: 12.5 }}><summary style={{ cursor: "pointer", fontWeight: 600 }}>🕘 Histórico ({o.historico.length})</summary>
          <ul style={{ paddingLeft: 18 }}>{o.historico.map((h, i) => <li key={i}>{dh(h.em)} · {h.por || "—"} · {h.acao}{h.de ? ` ${h.de} →` : ""}{h.para ? ` ${h.para}` : ""}{h.texto ? ` — ${h.texto}` : ""}</li>)}</ul></details>}
        {erro && <div style={{ color: C.danger, fontSize: 12.5, marginTop: 8 }}>{erro}</div>}
      </>}
    </div>
  </div>;
}
