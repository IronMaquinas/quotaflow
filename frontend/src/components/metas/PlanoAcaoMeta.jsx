// components/metas/PlanoAcaoMeta.jsx — etapa SC2.5: 📋 PLANO DE AÇÃO para meta fora do alvo
//   Cria uma tarefa tipo KPI (TSK-KPI-AAAA-nnnn) vinculada à meta — aparece no ✅ Plano, no cartão e na ficha da meta.
//   Uma meta pode ter várias ações. Recomendado quando a meta sai do 🟢 (não obrigatório).
import { useState } from "react";
import apiService from "../../services/apiService";
import CampoFuncionario from "../shared/CampoFuncionario";
import { COR_SINAL, fmtValor } from "./TelaMetas";

export const STATUS_ACAO = { pendente: "⏳ pendente", em_andamento: "🔄 em andamento", concluida: "✅ concluída", cancelada: "✖ cancelada" };
export const abrirTarefa = (numero) => numero && window.dispatchEvent(new CustomEvent("qf-abrir-tarefa", { detail: numero }));

export default function PlanoAcaoMeta({ C, s, meta, pessoas, onFechar, onCriada }) {
  const [f, setF] = useState({ titulo: "", detalhe: "", prazo: "", prioridade: meta.sinal === "vermelho" ? "alta" : "media", resp_nome: "", resp_id: null, resp_uid: null });
  const [ocup, setOcup] = useState(false); const [erro, setErro] = useState(null);
  const temResp = !!(f.resp_id || f.resp_uid);
  const salvar = async () => {
    setOcup(true); setErro(null);
    try {
      const r = await apiService.post(`/metas/${meta.id}/acoes`, { titulo: f.titulo, detalhe: f.detalhe, prazo: f.prazo || null, prioridade: f.prioridade, responsavel_ref: f.resp_id ? `c:${f.resp_id}` : `u:${f.resp_uid}` });
      onCriada?.(r.tarefa);
    } catch (e) { setErro(e?.response?.data?.erro || e.message); } finally { setOcup(false); }
  };
  return (
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "#000000aa", zIndex: 90, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, padding: 18, width: "min(560px, 100%)" }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>📋 Plano de ação — {meta.nome}</div>
        <div style={{ fontSize: 12.5, color: C.textSub, margin: "4px 0 12px" }}>Atual <b style={{ color: COR_SINAL[meta.sinal] }}>{fmtValor(meta.valor, meta.unidade)}</b> · meta {meta.sentido === "menor" ? "≤" : "≥"} {fmtValor(meta.meta, meta.unidade)}. Vira uma tarefa <b>TSK-KPI</b> no ✅ Plano, ligada a esta meta — dá para abrir várias ações.</div>
        <label style={{ display: "block", marginBottom: 10 }}><span style={s.label}>O QUE VAI SER FEITO</span>
          <input autoFocus value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: trocar o fornecedor de filtros; treinar a equipe na inspeção diária" style={s.input} /></label>
        <label style={{ display: "block", marginBottom: 10 }}><span style={s.label}>CAUSA / DETALHES (OPCIONAL)</span>
          <textarea rows={3} value={f.detalhe} onChange={(e) => setF({ ...f, detalhe: e.target.value })} placeholder="Por que a meta saiu do alvo e como esta ação ajuda a voltar" style={{ ...s.input, minHeight: 66, resize: "vertical", fontFamily: "inherit" }} /></label>
        <div style={{ marginBottom: 10 }}><span style={s.label}>👤 RESPONSÁVEL</span>
          <CampoFuncionario C={C} s={s} lista={pessoas} nome={f.resp_nome} id={f.resp_id} usuarioId={f.resp_uid} placeholder="Digite o nome do funcionário…" onChange={(v) => setF({ ...f, resp_nome: v.nome, resp_id: v.id, resp_uid: v.usuario_id })} /></div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <label style={{ flex: "1 1 150px" }}><span style={s.label}>PRAZO</span><input type="date" value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} style={s.input} /></label>
          <label style={{ flex: "1 1 150px" }}><span style={s.label}>PRIORIDADE</span><select value={f.prioridade} onChange={(e) => setF({ ...f, prioridade: e.target.value })} style={s.input}><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></select></label>
        </div>
        {erro && <div style={{ color: C.danger, fontSize: 12.5, marginBottom: 8 }}>{erro}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onFechar} style={{ ...s.btn(false), flex: 1, cursor: "pointer", color: C.text }}>Cancelar</button>
          <button type="button" disabled={ocup || !f.titulo.trim() || !temResp} onClick={salvar} style={{ ...s.btn(true), flex: 1.4, cursor: "pointer", opacity: f.titulo.trim() && temResp ? 1 : 0.6 }}>{ocup ? "Criando…" : "📋 Criar ação"}</button>
        </div>
      </div>
    </div>
  );
}
