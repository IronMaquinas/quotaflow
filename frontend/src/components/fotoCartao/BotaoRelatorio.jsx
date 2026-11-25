// components/fotoCartao/BotaoRelatorio.jsx — etapa E5: 📄 botão + opções do RELATÓRIO AUTOMÁTICO (projeto, aerogerador ou reparo)
import { useState } from "react";
import apiService from "../../services/apiService";
import { abrirRelatorioInspecao } from "../../utils/relatorioFotoCartao";

export default function BotaoRelatorio({ C, s, projetoId = null, reparoId = null, referencia = "", aerogeradores = [], rotulo = "📄 Relatório (PDF)", estilo = {} }) {
  const [op, setOp] = useState(null); const [msg, setMsg] = useState(""); const [gerando, setGerando] = useState(false);
  const gerar = async () => { setMsg(""); setGerando(true);
    try { const p = new URLSearchParams(Object.entries({ projeto_id: projetoId || "", reparo_id: reparoId || "", referencia: op.referencia || "", fotos_por_defeito: String(op.fotos), sem_reparo: op.semReparo ? "1" : "0" }).filter(([, v]) => v !== ""));
      const R = await apiService.get(`/foto-cartao/relatorio?${p}`); if (!abrirRelatorioInspecao(R)) setMsg("⚠ Libere pop-ups para abrir o relatório."); else setOp(null);
    } catch (e) { setMsg(`⚠ ${e?.response?.data?.erro || e.message}`); } finally { setGerando(false); } };
  const card = { ...s.card, padding: "14px 16px" }; const lab = { fontSize: 11.5, color: C.textSub, display: "block", marginBottom: 3 };
  return <>
    <button type="button" onClick={() => setOp({ referencia, fotos: 4, semReparo: true })} style={{ ...s.btn(false), cursor: "pointer", ...estilo }}>{rotulo}</button>
    {op && <div onClick={() => setOp(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "min(440px, 100%)", display: "grid", gap: 10, color: C.text }}>
        <b>📄 {reparoId ? "Relatório do reparo" : "Relatório de inspeção e reparos"}</b>
        <div style={{ fontSize: 12.5, color: C.textSub }}>Sai em A4 com o logo da empresa: resumo, tabela de defeitos e triagem, evidências com fotos e cada reparo etapa a etapa (materiais, lotes, proporção, condições, liberações) e campos de assinatura. Salve como PDF na janela de impressão.</div>
        {!reparoId && aerogeradores.length > 1 && <div><span style={lab}>AEROGERADOR</span><select value={op.referencia} onChange={(e) => setOp({ ...op, referencia: e.target.value })} style={{ ...s.input, width: "100%" }}><option value="">Todos do projeto</option>{aerogeradores.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>}
        <div><span style={lab}>FOTOS POR DEFEITO (inspeção)</span><div style={{ display: "flex", gap: 6 }}>{[0, 2, 4, 8].map((n) => <button key={n} type="button" onClick={() => setOp({ ...op, fotos: n })} style={{ ...s.btn(op.fotos === n), cursor: "pointer", padding: "6px 12px" }}>{n === 0 ? "nenhuma" : n}</button>)}</div></div>
        {!reparoId && <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={op.semReparo} onChange={(e) => setOp({ ...op, semReparo: e.target.checked })} /> Incluir defeitos classificados como "sem reparo"</label>}
        {msg && <div style={{ fontSize: 13, color: C.warn }}>{msg}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={() => setOp(null)} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button><button type="button" disabled={gerando} onClick={gerar} style={{ ...s.btn(true), cursor: "pointer" }}>{gerando ? "Montando…" : "Gerar relatório"}</button></div>
      </div></div>}
  </>;
}
