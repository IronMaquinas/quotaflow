// components/plano/ChecklistFiscal.jsx — etapa 18g.1: 🧾 documentos da tarefa fiscal (TSK-TR-…) no ✅ Plano
//   NF-e → CT-e → averbação → MDF-e. Cada um: nº/chave + PDF (dá o ✓) + XML (opcional: preenche e confere as chaves).
//   18g.1.1: XML primeiro — ao escolher, já mostra o que foi lido e preenche nº e chave (a conferência oficial é no servidor).
//   18g.2: MDF-e com XML → "🚚 Programar AT deste MDF-e" (rascunho na Mesa, já com placa/motorista); AT concluída → 🏁 encerrar o MDF-e.
//   18g.2.3: com AT no trecho (mesmo rascunho) os documentos ficam 🔒 travados (sem 🗑); "Programar AT" avisa se há documento sem salvar.
//   O que foi anexado direto na AT aparece aqui ("da AT-…"). Dispensar = cancelar com justificativa (fica no histórico).
import { useState } from "react";
import apiService from "../../services/apiService";
import { lerXmlFiscal } from "../../utils/lerXmlFiscal"; // 18g.1.1: prévia do XML no navegador

export const ITENS_FISCAIS = [
  ["nfe", "NF-e", "Nota fiscal da mercadoria — pegue com o cliente (remetente)"],
  ["cte", "CT-e", "Conhecimento de transporte — emitido pela transportadora (não precisa de placa/motorista)"],
  ["averbacao", "Averbação", "Nº de averbação do seguro da carga (RCTR-C) — devolvido pela averbadora"],
  ["mdfe", "MDF-e", "Manifesto — placa, condutor, CT-e e averbação; um por veículo. A AT espelha o MDF-e"],
];
const lerBase64 = (f) => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => erro(new Error("Não consegui ler o arquivo")); r.readAsDataURL(f); });
const mimeDe = (f) => f.type || (/\.pdf$/i.test(f.name) ? "application/pdf" : /\.xml$/i.test(f.name) ? "application/xml" : "");
const curta = (c) => (c ? `…${String(c).slice(-8)}` : "");
const quando = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");

export default function ChecklistFiscal({ C, s, tarefa, onAtualizou, onErro, onOk }) {
  const ck = tarefa.checklist || {}; const r = tarefa.fiscal || { itens: {}, alertas: [], feitos: 0, total: 4 };
  const [abrindo, setAbrindo] = useState(null); // item com o formulário aberto
  const [f, setF] = useState({ numero: "", chave: "", pdf: null, xml: null });
  const [lido, setLido] = useState(null); // { resumo } | { erro }
  const [ocupado, setOcupado] = useState(false);
  const [disp, setDisp] = useState(null); // motivo da dispensa (string) quando aberto
  const encerrada = ["cancelada"].includes(tarefa.status);
  const travado = ck.travado || []; // 18g.2.3
  const abrir = (k) => { setAbrindo(abrindo === k ? null : k); setF({ numero: "", chave: "", pdf: null, xml: null }); setLido(null); };
  const escolherXml = async (k, arq) => {
    if (!arq) { setF((v) => ({ ...v, xml: null })); setLido(null); return; }
    const txt = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result || "")); fr.onerror = () => ok(""); fr.readAsText(arq); });
    const r0 = lerXmlFiscal(k, txt);
    if (r0.erro) { setF((v) => ({ ...v, xml: null })); setLido({ erro: r0.erro }); return; }
    setF((v) => ({ ...v, xml: arq, numero: v.numero || r0.numero || "", chave: v.chave || r0.chave || "" })); setLido({ resumo: r0.resumo });
  };

  const enviar = async (k) => {
    setOcupado(true);
    try {
      const corpo = { numero: f.numero || undefined, chave: f.chave || undefined };
      if (f.pdf) corpo.pdf = { nome: f.pdf.name, mime: mimeDe(f.pdf), base64: await lerBase64(f.pdf) };
      if (f.xml) corpo.xml = { nome: f.xml.name, base64: await lerBase64(f.xml) };
      const res = await apiService.post(`/tarefas/${tarefa.id}/fiscal/${k}`, corpo);
      setAbrindo(null); onOk?.(`🧾 ${ITENS_FISCAIS.find((x) => x[0] === k)[1]} ✓${res?.resumo ? ` — ${res.resumo.feitos}/${res.resumo.total}` : ""}${res?.resumo?.feitos === res?.resumo?.total ? " · tarefa concluída ✓" : ""}`);
      await onAtualizou?.();
    } catch (e) { onErro?.(e); } finally { setOcupado(false); }
  };
  const completarPdf = async (k, e, arq) => { // 18g.1.1: entrada salva só com o XML → anexa o PDF depois
    setOcupado(true);
    try { const res = await apiService.post(`/tarefas/${tarefa.id}/fiscal/${k}`, { entrada: e.id, pdf: { nome: arq.name, mime: mimeDe(arq), base64: await lerBase64(arq) } }); onOk?.(`📄 PDF anexado${res?.resumo ? ` — ${res.resumo.feitos}/${res.resumo.total}` : ""}`); await onAtualizou?.(); }
    catch (er) { onErro?.(er); } finally { setOcupado(false); }
  };
  const programar = async (e) => { // 18g.2
    if (abrindo && (f.pdf || f.xml || String(f.numero || "").trim() || String(f.chave || "").trim())) { // 18g.2.3: não perde o que está no formulário
      onErro?.(new Error(`Você tem um documento (${ITENS_FISCAIS.find((x) => x[0] === abrindo)?.[1]}) preenchido e ainda não salvo — clique em Salvar (ou Fechar) antes de programar a AT.`)); return;
    }
    setOcupado(true);
    try { const r0 = await apiService.post(`/tarefas/${tarefa.id}/fiscal/mdfe/${e.id}/programar`, {}); onOk?.(`🚚 AT em rascunho criada — confira e programe na 🧩 Mesa${r0?.avisos?.length ? ` · ⚠️ ${r0.avisos.join("; ")}` : ""}`); await onAtualizou?.(); }
    catch (er) { onErro?.(er); } finally { setOcupado(false); }
  };
  const [enc, setEnc] = useState({}); // at_id → { numero, pdf }
  const encerrar = async (p) => {
    setOcupado(true);
    try { const v = enc[p.at_id] || {}; const corpo = { at_id: p.at_id, numero: v.numero || undefined }; if (v.pdf) corpo.pdf = { nome: v.pdf.name, mime: mimeDe(v.pdf), base64: await lerBase64(v.pdf) };
      const r0 = await apiService.post(`/tarefas/${tarefa.id}/fiscal/encerramento`, corpo); onOk?.(`🏁 MDF-e da ${p.at_numero} encerrado${r0?.tarefa?.status === "concluida" ? " · tarefa concluída ✓" : ""}`); setEnc((x) => ({ ...x, [p.at_id]: undefined })); await onAtualizou?.(); }
    catch (er) { onErro?.(er); } finally { setOcupado(false); }
  };
  const remover = async (k, e) => { setOcupado(true); try { await apiService.delete(`/tarefas/${tarefa.id}/fiscal/${k}/${e.id}`); onOk?.("Documento removido"); await onAtualizou?.(); } catch (er) { onErro?.(er); } finally { setOcupado(false); } };
  const abrirAnexo = async (id) => { try { const x = await apiService.get(`/tarefas/${tarefa.id}/anexos/${id}`); if (x?.url) window.open(x.url, "_blank"); } catch (e) { onErro?.(e); } };
  const dispensar = async () => { setOcupado(true); try { await apiService.post(`/tarefas/${tarefa.id}/fiscal/dispensar`, { motivo: disp }); setDisp(null); onOk?.(`${tarefa.numero || "Tarefa"} dispensada`); await onAtualizou?.(); } catch (e) { onErro?.(e); } finally { setOcupado(false); } };

  const arquivo = (rot, k, accept, aoEscolher) => <label style={{ ...s.btn(false), display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: f[k] ? C.accent : C.text }}>
    {f[k] ? `✓ ${f[k].name}` : rot}<input type="file" aria-label={rot} accept={accept} style={{ display: "none" }} onChange={(e) => { const x = e.target.files?.[0]; if (aoEscolher) aoEscolher(x || null); else setF((v) => ({ ...v, [k]: x || null })); e.target.value = ""; }} /></label>;

  return <div>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em" }}>DOCUMENTOS FISCAIS · {tarefa.numero || ""}</div>
      <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: "hidden", minWidth: 80 }}><div style={{ width: `${(r.feitos / (r.total || 4)) * 100}%`, height: "100%", background: r.feitos === r.total ? C.success : C.accent }} /></div>
      <b style={{ fontSize: 12.5, color: r.feitos === r.total ? C.success : C.text }}>{r.feitos}/{r.total}</b>
    </div>
    {travado.length > 0 && <div style={{ fontSize: 12.5, color: C.textSub, background: `${C.accent}12`, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>🔒 <b>Documentos travados</b> — já estão na {travado.map((x) => x.numero).join(", ")}. Para trocar um documento, descarte o rascunho ou cancele a AT (com motivo): assim a AT e a tarefa nunca divergem. Dá para acrescentar documento (fica no histórico).</div>}
    {ck.dispensa && <div style={{ fontSize: 12.5, color: C.warn, marginBottom: 10 }}>🚫 Dispensada por {ck.dispensa.por || "—"} em {quando(ck.dispensa.em)}: {ck.dispensa.motivo}</div>}
    {(r.alertas || []).map((a, i) => <div key={i} style={{ fontSize: 12.5, color: C.danger, marginBottom: 6 }}>⚠️ {a}</div>)}
    {ITENS_FISCAIS.map(([k, nome, dica], i) => {
      const ok = !!r.itens?.[k]; const ents = ck[k]?.entradas || []; const ehProx = !ok && r.proximo === k;
      return <div key={k} style={{ border: `1px solid ${ok ? `${C.success}66` : ehProx ? `${C.accent}66` : C.border}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8, background: C.surface }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ width: 22, height: 22, borderRadius: 11, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: ok ? C.success : "transparent", color: ok ? "#fff" : C.muted, border: `1px solid ${ok ? C.success : C.border}` }}>{ok ? "✓" : i + 1}</span>
          <b style={{ fontSize: 13.5 }}>{nome}</b>
          <span style={{ fontSize: 11.5, color: C.muted, flex: 1, minWidth: 180 }}>{dica}</span>
          {!encerrada && <button type="button" onClick={() => abrir(k)} style={{ ...s.btn(ehProx), padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>{abrindo === k ? "Fechar" : ents.length ? "＋ Outro" : "＋ Registrar"}</button>}
        </div>
        {ents.map((e) => <div key={e.id} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12.5, padding: "6px 0 0 32px", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600 }}>{e.numero ? `nº ${e.numero}` : nome}</span>
          {e.chave && <span title={e.chave} style={{ fontFamily: "ui-monospace, monospace", color: C.textSub }}>chave {curta(e.chave)}</span>}
          {e.pdf_anexo && <span style={{ color: C.accent, cursor: "pointer" }} onClick={() => abrirAnexo(e.pdf_anexo)}>📄 PDF</span>}
          {e.xml_anexo && <span style={{ color: C.accent, cursor: "pointer" }} onClick={() => abrirAnexo(e.xml_anexo)}>🧩 XML</span>}
          {e.origem === "at" && <span style={{ color: C.accent, cursor: "pointer" }} onClick={() => window.dispatchEvent(new CustomEvent("qf-abrir-at", { detail: e.at_id }))}>📎 {e.nome} — da {e.at_numero}</span>}
          {k !== "averbacao" && !e.pdf_anexo && e.origem !== "at" && <span style={{ color: C.warn }}>⚠️ falta o PDF (é o que dá o ✓){!encerrada && <label style={{ marginLeft: 8, color: C.accent, cursor: "pointer", fontWeight: 600 }}>＋ anexar PDF<input type="file" aria-label={`PDF do ${nome} ${e.numero || ""}`} accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" style={{ display: "none" }} onChange={(ev) => { const x = ev.target.files?.[0]; ev.target.value = ""; if (x) completarPdf(k, e, x); }} /></label>}</span>}
          {e.dados?.placa && <span style={{ color: C.textSub }}>🚛 {[e.dados.placa, ...(e.dados.reboques || [])].join(" + ")}{e.dados.condutores?.[0]?.nome ? ` · 👤 ${e.dados.condutores[0].nome}` : ""}</span>}
          {k === "mdfe" && e.at_id && <span style={{ color: C.accent, cursor: "pointer", fontWeight: 600 }} onClick={() => window.dispatchEvent(new CustomEvent("qf-abrir-at", { detail: e.at_id }))}>🔗 {/^RASC-/.test(e.at_numero || "") ? "💾 rascunho da AT (programe na Mesa)" : e.at_numero || "AT"}</span>}
          {k === "mdfe" && !e.at_id && e.dados && !encerrada && <button type="button" disabled={ocupado} onClick={() => programar(e)} style={{ ...s.btn(true), padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>🚚 Programar AT deste MDF-e</button>}
          {e.dados?.valor_frete != null && <span style={{ color: C.textSub }}>frete R$ {Number(e.dados.valor_frete).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
          {e.dados?.peso != null && k === "nfe" && <span style={{ color: C.textSub }}>{Number(e.dados.peso).toLocaleString("pt-BR")} kg</span>}
          <span style={{ color: C.muted, fontSize: 11 }}>{e.por || "—"} · {quando(e.em)}</span>
          {!encerrada && !travado.length && e.origem !== "at" && <button type="button" aria-label={`Remover ${nome}`} disabled={ocupado} onClick={() => remover(k, e)} style={{ background: "transparent", border: "none", color: C.danger, cursor: "pointer", fontSize: 12 }}>🗑</button>}
        </div>)}
        {abrindo === k && <div style={{ padding: "10px 0 2px 32px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {k !== "averbacao" && arquivo("🧩 XML (preenche sozinho)", "xml", ".xml,text/xml,application/xml", (x) => escolherXml(k, x))}
          <input aria-label={`Número ${nome}`} value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} placeholder={k === "averbacao" ? "Nº da averbação *" : "Nº (opcional se tiver o XML)"} style={{ ...s.input, width: 190, marginBottom: 0 }} />
          {k !== "averbacao" && <input aria-label={`Chave ${nome}`} value={f.chave} onChange={(e) => setF({ ...f, chave: e.target.value })} placeholder="Chave de acesso (44 dígitos)" style={{ ...s.input, width: 300, marginBottom: 0, fontFamily: "ui-monospace, monospace", fontSize: 12 }} />}
          {arquivo(k === "averbacao" ? "📄 Comprovante (opcional)" : "📄 PDF *", "pdf", ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png")}
          <button type="button" disabled={ocupado || (k === "averbacao" ? !f.numero.trim() : !(f.pdf || f.xml))} onClick={() => enviar(k)}
            style={{ ...s.btn(!ocupado && (k === "averbacao" ? !!f.numero.trim() : !!(f.pdf || f.xml))), padding: "7px 14px", fontSize: 12.5, cursor: "pointer" }}>{ocupado ? "Enviando…" : "Salvar"}</button>
          {lido && <div style={{ flexBasis: "100%", fontSize: 12.5, color: lido.erro ? C.danger : C.success }}>{lido.erro ? `⚠️ ${lido.erro}` : `✓ XML lido: ${lido.resumo}`}</div>}
          {k !== "averbacao" && f.xml && !f.pdf && <div style={{ flexBasis: "100%", fontSize: 12, color: C.warn }}>Falta o PDF ({{ nfe: "DANFE", cte: "DACTE", mdfe: "DAMDFE" }[k]}) — é ele que dá o ✓ (o motorista apresenta na fiscalização). Dá para salvar agora e anexar depois.</div>}
        </div>}
      </div>;
    })}
    {(r.encerramento?.pendentes?.length > 0 || r.encerramento?.feitos > 0) && <div style={{ border: `1px solid ${r.encerramento.pendentes.length ? `${C.warn}88` : `${C.success}66`}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8, background: C.surface }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}><span style={{ width: 22, height: 22, borderRadius: 11, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: r.encerramento.pendentes.length ? "transparent" : C.success, color: r.encerramento.pendentes.length ? C.warn : "#fff", border: `1px solid ${r.encerramento.pendentes.length ? C.warn : C.success}` }}>{r.encerramento.pendentes.length ? "5" : "✓"}</span>
        <b style={{ fontSize: 13.5 }}>🏁 Encerrar MDF-e</b><span style={{ fontSize: 11.5, color: C.muted }}>Viagem concluída: encerre o MDF-e no emissor (MDF-e aberto impede emitir outro para a mesma placa)</span></div>
      {(ck.encerramento?.entradas || []).map((x) => <div key={x.id} style={{ fontSize: 12.5, padding: "6px 0 0 32px" }}>✓ <b>{x.at_numero}</b>{x.numero ? ` · protocolo ${x.numero}` : ""}{x.pdf_anexo ? <span style={{ color: C.accent, cursor: "pointer", marginLeft: 8 }} onClick={() => abrirAnexo(x.pdf_anexo)}>📄 comprovante</span> : null} <span style={{ color: C.muted, fontSize: 11 }}>{x.por || "—"} · {quando(x.em)}</span></div>)}
      {r.encerramento.pendentes.map((p) => <div key={p.at_id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "8px 0 0 32px" }}>
        <b style={{ fontSize: 12.5 }}>{p.at_numero}</b>
        <input aria-label={`Protocolo ${p.at_numero}`} value={enc[p.at_id]?.numero || ""} onChange={(e) => setEnc((x) => ({ ...x, [p.at_id]: { ...(x[p.at_id] || {}), numero: e.target.value } }))} placeholder="Protocolo do encerramento (opcional)" style={{ ...s.input, width: 230, marginBottom: 0 }} />
        <label style={{ ...s.btn(false), display: "inline-flex", padding: "6px 12px", fontSize: 12, cursor: "pointer", color: enc[p.at_id]?.pdf ? C.accent : C.text }}>{enc[p.at_id]?.pdf ? `✓ ${enc[p.at_id].pdf.name}` : "📄 Comprovante (opcional)"}<input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" style={{ display: "none" }} onChange={(e) => { const f0 = e.target.files?.[0]; e.target.value = ""; setEnc((x) => ({ ...x, [p.at_id]: { ...(x[p.at_id] || {}), pdf: f0 || null } })); }} /></label>
        <button type="button" disabled={ocupado} onClick={() => encerrar(p)} style={{ ...s.btn(true), padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>🏁 Encerrado</button>
      </div>)}
    </div>}
    {!encerrada && tarefa.status !== "concluida" && (disp == null
      ? <button type="button" onClick={() => setDisp("")} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, padding: 0, marginTop: 4 }}>🚫 Dispensar documentos fiscais deste trecho…</button>
      : <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
        <input aria-label="Motivo da dispensa" value={disp} onChange={(e) => setDisp(e.target.value)} placeholder="Motivo (ex.: carga própria, transporte interno) — mín. 10 caracteres" style={{ ...s.input, flex: 1, minWidth: 260, marginBottom: 0 }} />
        <button type="button" onClick={() => setDisp(null)} style={{ ...s.btn(false), padding: "7px 12px", fontSize: 12, cursor: "pointer", color: C.text }}>Voltar</button>
        <button type="button" disabled={ocupado || disp.trim().length < 10} onClick={dispensar} style={{ ...s.btn(disp.trim().length >= 10, C.danger), padding: "7px 12px", fontSize: 12, cursor: "pointer" }}>🚫 Dispensar</button>
      </div>)}
  </div>;
}
