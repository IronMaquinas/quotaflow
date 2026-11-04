// components/programacao/AcaoDocFiscal.jsx — etapa 18g.2.5: 🔁 substituir · ＋ evento/correção · ＋ inclusão de condutor — direto pela AT
//   A tarefa fiscal (TSK-TR) continua a fonte única dos arquivos; a ação fica registrada nos dois lados.
import { useState } from "react";
import apiService from "../../services/apiService";
import { lerXmlFiscal } from "../../utils/lerXmlFiscal";

const lerBase64 = (f) => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => erro(new Error("Não consegui ler o arquivo")); r.readAsDataURL(f); });
const lerTexto = (f) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result || "")); r.onerror = () => ok(""); r.readAsText(f); });
const mimeDe = (f) => f.type || (/\.pdf$/i.test(f.name) ? "application/pdf" : "");
const ITEM = { nfe: "NF-e", cte: "CT-e", mdfe: "MDF-e" };
const MOTIVOS = [["arquivo_errado", "Arquivo errado anexado (mesmo documento)"], ["reemitido", "Documento cancelado e reemitido"], ["outro", "Outro motivo"]];
const EVENTOS = { nfe: [["cce", "Carta de correção (CC-e)"], ["outro", "Outro evento"]], cte: [["cce", "Carta de correção (CC-e)"], ["outro", "Outro evento"]], mdfe: [["inclusao_condutor", "Inclusão de condutor"], ["outro", "Outro evento"]] };

export default function AcaoDocFiscal({ C, s, modo, at, anexo = null, onFechar, onFeito, pdfInicial = null }) {
  const k = anexo?.tipo || "mdfe";
  const [f, setF] = useState({ motivo_tipo: "", motivo: "", tipo: modo === "condutor" ? "inclusao_condutor" : EVENTOS[k]?.[0]?.[0] || "outro", descricao: "", pdf: pdfInicial, xml: null, numero: "", chave: "", lido: null });
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const arq = (rot, campo, accept, fn) => <label style={{ ...s.btn(false), display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: 12.5, cursor: "pointer", color: f[campo] ? C.accent : C.text }}>{f[campo] ? `✓ ${f[campo].name}` : rot}
    <input type="file" aria-label={rot} accept={accept} style={{ display: "none" }} onChange={async (ev) => { const x = ev.target.files?.[0] || null; ev.target.value = ""; if (fn) await fn(x); else setF((v) => ({ ...v, [campo]: x })); }} /></label>;
  const escolherXml = async (x) => { if (!x) return setF((v) => ({ ...v, xml: null, lido: null })); const r0 = lerXmlFiscal(k, await lerTexto(x)); setF((v) => (r0.erro ? { ...v, xml: null, lido: { erro: r0.erro } } : { ...v, xml: x, numero: r0.numero || "", chave: r0.chave || "", lido: { resumo: r0.resumo } })); };
  const pode = modo === "retirar" ? f.motivo.trim().length >= 10 : modo === "subst" ? !!f.motivo_tipo && !!f.pdf && (f.motivo_tipo !== "outro" || f.motivo.trim().length >= 10) : !!f.pdf;
  const salvar = async () => {
    setOcupado(true); setErro(null);
    try {
      if (modo === "retirar") { await apiService.post(`/programacao/execucoes/${at.id}/anexos/${anexo.id}/retirar`, { motivo: f.motivo }); onFeito?.(`⊘ ${anexo.nome} retirado — fica guardado no histórico`); return; } // 18g.2.7
      const corpo = modo === "subst" ? { motivo_tipo: f.motivo_tipo, motivo: f.motivo, numero: f.numero || undefined, chave: f.chave || undefined } : { tipo: f.tipo, descricao: f.descricao };
      corpo.pdf = { nome: f.pdf.name, mime: mimeDe(f.pdf), base64: await lerBase64(f.pdf) };
      if (f.xml) corpo.xml = { nome: f.xml.name, base64: await lerBase64(f.xml) };
      const url = modo === "condutor" ? `/programacao/execucoes/${at.id}/mdfe/inclusao-condutor` : `/programacao/execucoes/${at.id}/anexos/${anexo.id}/${modo === "subst" ? "substituir" : "evento"}`;
      await apiService.post(url, corpo);
      onFeito?.(modo === "subst" ? `🔁 ${ITEM[k]} substituído — versão anterior guardada na tarefa fiscal` : modo === "condutor" ? `👤 Inclusão de condutor registrada no MDF-e` : "📎 Evento registrado");
    } catch (e) { setErro(e.message); } finally { setOcupado(false); }
  };
  const titulo = modo === "retirar" ? `⊘ Retirar ${ITEM[k] || "documento"} anexado por engano` : modo === "subst" ? `🔁 Substituir ${ITEM[k]}` : modo === "condutor" ? "👤 Inclusão de condutor no MDF-e" : `＋ Evento / correção — ${ITEM[k]}`;
  return <div onClick={(x) => x.stopPropagation()} style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 420, padding: 20 }}> {/* 18g.2.7: clique aqui não fecha a ficha da AT */}
    <div role="dialog" aria-modal="true" style={{ ...s.card, width: 560, maxWidth: "100%", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}><b style={{ flex: 1, fontSize: 15 }}>{titulo}</b><button type="button" aria-label="Fechar" onClick={onFechar} style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>×</button></div>
      <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 12 }}>
        {modo === "retirar" ? <>{anexo?.nome} · {at.numero}. O arquivo sai da AT e do link do motorista, mas fica guardado no histórico com o motivo.</> : modo === "subst" ? <>{anexo?.nome} · {at.numero}. A versão atual fica guardada {anexo?.tarefa_id ? `na tarefa fiscal${anexo?.tarefa_numero ? ` (${anexo.tarefa_numero})` : ""}` : "no histórico da AT"} e a AT passa a usar a nova.{at.status === "em_execucao" ? " O caminhão já saiu: só o gestor substitui, e o motorista vê \"versão atualizada\" no link." : ""}</>
          : modo === "condutor" ? <>O motorista da {at.numero} agora é <b>{at.motorista_nome}</b>. Anexe o comprovante do evento de inclusão de condutor emitido no seu sistema de MDF-e — o aviso de divergência sai da AT.</>
          : <>O documento original continua valendo; o PDF do evento fica junto dele, na AT e no link do motorista.</>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {modo === "retirar" && <input aria-label="Motivo da retirada" value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} placeholder="Por que foi anexado por engano? (mín. 10 caracteres) *" style={{ ...s.input, flex: "1 1 100%", marginBottom: 0 }} />}
        {modo === "subst" && <>
          <select aria-label="Motivo da substituição" value={f.motivo_tipo} onChange={(e) => setF({ ...f, motivo_tipo: e.target.value })} style={{ ...s.input, flex: "1 1 100%", marginBottom: 0 }}><option value="">Motivo *</option>{MOTIVOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <input aria-label="Detalhe do motivo" value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} placeholder={f.motivo_tipo === "outro" ? "Explique (mín. 10 caracteres) *" : "Detalhe (opcional)"} style={{ ...s.input, flex: "1 1 100%", marginBottom: 0 }} />
          {anexo?.tarefa_id && arq("🧩 XML novo (opcional)", "xml", ".xml,text/xml,application/xml", escolherXml)}
        </>}
        {modo === "evento" && <>
          <select aria-label="Tipo do evento" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} style={{ ...s.input, flex: "1 1 220px", marginBottom: 0 }}>{(EVENTOS[k] || []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </>}
        {!["subst", "retirar"].includes(modo) && <input aria-label="Descrição" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} placeholder={modo === "condutor" ? "Observação (opcional) — ex.: titular afastado por doença" : f.tipo === "outro" ? "Descreva *" : "O que foi corrigido (opcional)"} style={{ ...s.input, flex: "1 1 100%", marginBottom: 0 }} />}
        {modo !== "retirar" && arq(modo === "subst" ? "📄 PDF novo *" : "📄 PDF do evento *", "pdf", ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png")}
        {f.lido && <div style={{ flexBasis: "100%", fontSize: 12, color: f.lido.erro ? C.danger : C.success }}>{f.lido.erro ? `⚠️ ${f.lido.erro}` : `✓ XML lido: ${f.lido.resumo}`}</div>}
      </div>
      {erro && <div style={{ color: C.danger, fontSize: 12.5, marginTop: 10 }}>{erro}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button type="button" onClick={onFechar} style={{ ...s.btn(false), color: C.text, padding: "8px 16px", cursor: "pointer" }}>Cancelar</button>
        <button type="button" disabled={ocupado || !pode} onClick={salvar} style={{ ...s.btn(!ocupado && pode), padding: "8px 16px", cursor: "pointer" }}>{ocupado ? "Enviando…" : modo === "retirar" ? "⊘ Retirar" : modo === "subst" ? "🔁 Substituir" : "Registrar"}</button>
      </div>
    </div>
  </div>;
}
