// components/comercial/EnviarBid.jsx — etapa 15b
// 👁 Revisar e enviar (como o "revise sua candidatura" do Workday): à esquerda o documento EXATAMENTE como o cliente vai ver;
// à direita o checklist (o que impede o envio em vermelho, alertas em amarelo), o destinatário, o que mudou desde a versão
// enviada e o E-MAIL (15b.1: assunto e texto padronizados, pré-carregados e editáveis; link, validade e assinatura fixos).
// ✏ Voltar e editar · 📨 Enviar ao cliente → confirmação clara ("depois do envio, só com nova versão").
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import { gerarHtmlBid } from "../../utils/gerarBid";

export default function EnviarBid({ C, s, bidId, numero, onFechar, onEnviado, onErro }) {
  const [r, setR] = useState(null);
  const [assunto, setAssunto] = useState("");
  const [texto, setTexto] = useState("");
  const [nota, setNota] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { apiService.get(`/comercial/bids/${bidId}/revisao`).then((x) => { setR(x); setAssunto(x.email?.assunto || ""); setTexto(x.email?.texto || ""); }).catch((e) => { onErro(e.message); onFechar(); }); }, [bidId]); // eslint-disable-line
  if (!r) return null;
  const ck = r.checklist || { erros: [], avisos: [] };
  const reenvio = r.versao_enviada > 0;
  const bloqueado = ck.erros.length > 0 || r.nada_mudou || (reenvio && !nota.trim());
  const enviar = async () => {
    setOcupado(true);
    try { const x = await apiService.post(`/comercial/bids/${bidId}/enviar`, { assunto, texto, nota }); onEnviado(x); }
    catch (e) { onErro(e.message); setConfirmar(false); } finally { setOcupado(false); }
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000b0", zIndex: 350, display: "flex", justifyContent: "center", padding: 12, overflowY: "auto" }} onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: 1320, maxWidth: "100%", margin: "auto 0", padding: 0, overflow: "hidden", display: "flex", flexWrap: "wrap" }}>
        <div style={{ flex: "3 1 620px", minWidth: 0, background: "#e5e7eb" }}>
          <div style={{ padding: "8px 14px", background: C.surface, borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.textSub }}>👁 É assim que o cliente vai ver a <b>v{r.proxima_versao}</b> de {numero}</div>
          <iframe title="Prévia do BID" srcDoc={gerarHtmlBid({ ...r.documento, rascunho: false, versao: { versao: r.proxima_versao } })} style={{ width: "100%", height: "78vh", border: "none", background: "#fff" }} />
        </div>
        <div style={{ flex: "1 1 340px", minWidth: 0, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{reenvio ? `Enviar a v${r.proxima_versao} ao cliente` : "Revisar e enviar ao cliente"}</div>
          {ck.erros.length > 0 && <div style={{ ...s.card, padding: 10, borderColor: C.danger, background: `${C.danger}12` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.danger, marginBottom: 4 }}>Antes de enviar, falta:</div>
            {ck.erros.map((e) => <div key={e} style={{ fontSize: 12, color: C.text, padding: "2px 0" }}>✕ {e}</div>)}</div>}
          {r.nada_mudou && <div style={{ ...s.card, padding: 10, borderColor: C.warn, fontSize: 12, color: C.warn }}>Nada mudou desde a v{r.versao_enviada}. Ajuste o que o cliente pediu antes de enviar de novo.</div>}
          {ck.avisos.length > 0 && <div style={{ ...s.card, padding: 10, borderColor: C.warn }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.warn, marginBottom: 4 }}>Confira:</div>
            {ck.avisos.map((e) => <div key={e} style={{ fontSize: 12, color: C.textSub, padding: "2px 0" }}>⚠ {e}</div>)}</div>}
          {!ck.erros.length && !ck.avisos.length && !r.nada_mudou && <div style={{ fontSize: 12, color: C.success }}>✓ Tudo preenchido.</div>}
          <div><span style={s.label}>PARA</span><div style={{ fontSize: 13 }}>{r.para || <span style={{ color: C.danger }}>sem e-mail do contato</span>} <span style={{ color: C.muted, fontSize: 11 }}>(com cópia para você)</span></div></div>
          {reenvio && (r.mudancas || []).length > 0 && <div><span style={s.label}>O QUE MUDOU DESDE A v{r.versao_enviada}</span>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: C.textSub, maxHeight: 150, overflowY: "auto" }}>{r.mudancas.map((m, i) => <li key={i}>{m}</li>)}</ul></div>}
          {reenvio && <label><span style={s.label}>EXPLIQUE AO CLIENTE O QUE MUDOU *</span><textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: ajustamos o valor do SE300 conforme pedido" style={{ ...s.input, resize: "vertical" }} /></label>}
          <div style={{ ...s.card, padding: 10, background: C.bg }}>
            <div style={{ ...s.label, marginBottom: 6 }}>E-MAIL QUE O CLIENTE VAI RECEBER</div>
            <label><span style={{ ...s.label, fontSize: 10 }}>ASSUNTO</span><input value={assunto} onChange={(e) => setAssunto(e.target.value)} style={s.input} /></label>
            <label style={{ display: "block", marginTop: 8 }}><span style={{ ...s.label, fontSize: 10 }}>TEXTO (PODE AJUSTAR)</span><textarea rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} style={{ ...s.input, resize: "vertical", fontSize: 12.5, lineHeight: 1.5 }} /></label>
            <div style={{ fontSize: 12, color: C.textSub, marginTop: 8, lineHeight: 1.6, borderTop: `1px dashed ${C.border}`, paddingTop: 8 }}>
              {reenvio && <div>• O que mudou (a sua nota + a lista acima)</div>}
              <div><span style={{ display: "inline-block", background: C.accent, color: "#fff", borderRadius: 5, padding: "3px 10px", fontSize: 11.5, fontWeight: 700 }}>{reenvio ? "Ver a proposta atualizada" : "Ver a proposta"}</span> <span style={{ color: C.muted, fontSize: 11 }}>← o link da proposta</span></div>
              <div>Validade: {r.email?.validade}</div>
              <div style={{ marginTop: 4 }}>Atenciosamente,<br />{(r.email?.assinatura || []).map((l, i) => <span key={i}>{l}<br /></span>)}</div>
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>O link, a validade e a assinatura (✍ Dados e assinatura) entram sempre.</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>O cliente recebe um link para ver a proposta e responder item por item (aprovar, pedir revisão ou recusar). Você é avisado quando ele abrir e quando responder.</div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onFechar} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>✏ Voltar e editar</button>
            <button type="button" disabled={bloqueado || ocupado} onClick={() => setConfirmar(true)} style={{ ...s.btn(!bloqueado && !ocupado, C.accent), flex: 1 }}>📨 Enviar ao cliente</button>
          </div>
        </div>
      </div>
      {confirmar && <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 360, padding: 16 }} onClick={(e) => { e.stopPropagation(); setConfirmar(false); }}>
        <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: 460, maxWidth: "100%", padding: "18px 20px" }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Enviar a v{r.proxima_versao} para {r.para}?</div>
          <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.6 }}>Depois do envio, o BID fica <b>travado</b>: qualquer mudança vira uma <b>nova versão</b>, e o cliente é avisado por e-mail. A validade ({r.documento?.validade_dias} dias) começa a contar hoje.</div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button type="button" onClick={() => setConfirmar(false)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
            <button type="button" disabled={ocupado} onClick={enviar} style={{ ...s.btn(!ocupado, C.accent), flex: 1 }}>{ocupado ? "Enviando…" : "📨 Enviar"}</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
