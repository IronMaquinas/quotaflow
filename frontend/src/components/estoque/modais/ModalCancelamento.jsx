// frontend/src/components/estoque/modais/ModalCancelamento.jsx
//
// Modal de cancelamento de Ordem de Serviço. Extraído do
// TelaOrdemServico.jsx na Rodada 3 da quebra.
//
// Padrão: totalmente "burro" — só recebe props e emite eventos via
// callback. O pai é quem faz a chamada à API (mesmo padrão já usado no
// ModalAplicarMaterial, para manter consistência).

import { useState } from "react";

export default function ModalCancelamento({
  chamado, salvando, onCancelar, onConfirmar, s, C,
}) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState(null);

  const podeConfirmar = motivo.trim().length > 0 && !salvando;

  async function handleConfirmar() {
    if (!motivo.trim()) {
      setErro("Informe o motivo do cancelamento.");
      return;
    }
    setErro(null);
    try {
      await onConfirmar(motivo.trim());
    } catch (e) {
      setErro(e.message || "Erro ao cancelar");
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090",
                  display: "flex", alignItems: "center",
                  justifyContent: "center", zIndex: 365, padding: 20 }}>
      <div style={{ ...s.card, width: 480, maxWidth: "100%" }}>
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
            Cancelar Ordem de Serviço
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {chamado?.numero}
          </div>
        </div>

        <div style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 12, color: C.text, marginBottom: 14 }}>
            Ao cancelar, a OS fica <strong>bloqueada para edição</strong>. Esta
            ação não apaga nada — o histórico fica preservado.
          </div>

          <label style={s.label}>MOTIVO DO CANCELAMENTO *</label>
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Ex: Equipamento sucateado por decisão da diretoria"
            autoFocus
            style={{ ...s.input, minHeight: 80, resize: "vertical" }} />

          {erro && (
            <div style={{ marginTop: 12, padding: "10px 12px",
                          background: "#ef444415", border: "1px solid #ef444440",
                          borderRadius: 6, fontSize: 11, color: "#ef4444" }}>
              ⚠ {erro}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, padding: "14px 22px",
                      borderTop: `1px solid ${C.border}` }}>
          <button onClick={onCancelar} disabled={salvando}
            style={{ ...s.btn(false), flex: 1, padding: "8px 16px" }}>
            Voltar
          </button>
          <button
            disabled={!podeConfirmar}
            onClick={handleConfirmar}
            style={{ ...s.btn(true), flex: 1, padding: "8px 16px",
                     background: "#f59e0b", border: "1px solid #f59e0b",
                     opacity: podeConfirmar ? 1 : 0.5 }}>
            {salvando ? "Cancelando..." : "Confirmar cancelamento"}
          </button>
        </div>
      </div>
    </div>
  );
}