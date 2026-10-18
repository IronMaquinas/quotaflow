// components/manutencao/ModalTransferirOS.jsx — etapa 12b.3
// Define ou transfere o responsável de UMA OS (admin/gestor).
// Usado no cartão do dia (Calendário) e no detalhe da OS (TelaOrdemServico).
// Não muda o plano: as próximas OS geradas seguem o responsável do plano.
import { useState } from "react";
import apiService from "../../services/apiService";

export default function ModalTransferirOS({ C, s, os, usuarios = [], onFechar, onTransferido }) {
  const [para, setPara] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const atual = os.responsavel_id ? usuarios.find((u) => String(u.id) === String(os.responsavel_id)) : null;
  const titulo = os.responsavel_id ? "⇄ Transferir responsável" : "👤 Definir responsável";

  const salvar = async () => {
    setSalvando(true); setErro("");
    try {
      const r = await apiService.put(`/manutencao/os/${os.id}/responsavel`, { para, motivo });
      onTransferido?.(r);
    } catch (e) { setErro(e.message || "Erro ao transferir"); }
    finally { setSalvando(false); }
  };

  return (
    <div onClick={() => !salvando && onFechar?.()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 80, overflowY: "auto", padding: "60px 16px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: "min(460px, 100%)", padding: 22, background: C.surface }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{titulo} — {os.numero}</div>
        <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>
          {os.responsavel_id ? <>Hoje: <b style={{ color: C.text }}>{atual?.nome || os.responsavel || "—"}</b>. </> : "Esta OS ainda não tem responsável. "}
          Só esta OS muda{os.origem_plano_id ? " — o plano e as próximas OS geradas continuam como estão" : ""}.
        </div>
        <label style={{ display: "block", marginTop: 16 }}>
          <span style={s.label}>NOVO RESPONSÁVEL</span>
          <select value={para} onChange={(e) => setPara(e.target.value)} style={s.input}>
            <option value="">Escolha…</option>
            {usuarios.filter((u) => String(u.id) !== String(os.responsavel_id || "")).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </label>
        <label style={{ display: "block", marginTop: 12 }}>
          <span style={s.label}>MOTIVO (OPCIONAL — VAI PARA O HISTÓRICO DA OS)</span>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} placeholder="ex.: férias do Pedro" style={s.input} />
        </label>
        {erro && <div style={{ color: C.danger, fontSize: 12, marginTop: 10 }}>⚠ {erro}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={onFechar} disabled={salvando} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          <button onClick={salvar} disabled={!para || salvando} style={{ ...s.btn(!!para && !salvando), flex: 1 }}>
            {salvando ? "Salvando…" : os.responsavel_id ? "Transferir" : "Definir"}
          </button>
        </div>
      </div>
    </div>
  );
}
