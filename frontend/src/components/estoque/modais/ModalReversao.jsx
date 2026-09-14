// frontend/src/components/estoque/modais/ModalReversao.jsx
//
// Modal de reversão de aplicação de material (estorno rastreável).
// Extraído do TelaOrdemServico.jsx na Rodada 3 da quebra.
//
// Padrão: componente "burro" — recebe `contexto` (o objeto com aplicacaoId,
// chamadoItemId, itemNome, quantidade, numerosSerie) e emite eventos via
// callbacks. Estado interno é só o que precisa pro form (motivo, obs, erro).

import { useState } from "react";

export default function ModalReversao({
  contexto, salvando, onCancelar, onConfirmar, s, C,
}) {
  const [motivo, setMotivo] = useState(contexto?.motivo || "");
  const [observacoes, setObservacoes] = useState(contexto?.observacoes || "");
  const [erro, setErro] = useState(null);

  const podeConfirmar = motivo && !salvando;

  async function handleConfirmar() {
    if (!motivo) {
      setErro("Selecione o motivo da reversão.");
      return;
    }
    setErro(null);
    try {
      await onConfirmar({
        motivo,
        observacoes: observacoes?.trim() || null,
      });
    } catch (e) {
      setErro(e.message || "Erro ao reverter");
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090",
                  display: "flex", alignItems: "center",
                  justifyContent: "center", zIndex: 350, padding: 20 }}>
      <div style={{ ...s.card, width: 460, maxWidth: "100%" }}>

        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
            Reverter aplicação
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {contexto?.itemNome}
          </div>
        </div>

        <div style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 14,
                        background: C.bg, borderRadius: 6, padding: "10px 12px" }}>
            Esta operação <strong>não apaga</strong> o registro original — cria
            um estorno rastreável. O histórico completo fica preservado para
            garantia, seguradora e auditoria.
          </div>

          <div style={{ display: "flex", justifyContent: "space-between",
                        fontSize: 11, marginBottom: 14,
                        background: C.bg, borderRadius: 6, padding: "8px 12px" }}>
            <span style={{ color: C.muted }}>Quantidade a estornar:</span>
            <strong style={{ color: C.text }}>{contexto?.quantidade} un</strong>
          </div>

          {contexto?.numerosSerie?.length > 0 && (
            <div style={{ fontSize: 11, color: C.textSub, marginBottom: 14,
                          background: C.bg, padding: "8px 10px",
                          borderRadius: 6, fontFamily: "'IBM Plex Mono',monospace" }}>
              SN: {contexto.numerosSerie.join(", ")}
            </div>
          )}

          <label style={s.label}>MOTIVO DA REVERSÃO *</label>
          <select
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            style={{ ...s.input, appearance: "none" }}>
            <option value="">Selecione um motivo...</option>
            <option value="peca_incorreta">Peça incorreta para o equipamento</option>
            <option value="defeito_fabricacao">Defeito de fabricação</option>
            <option value="erro_registro">Erro de registro / duplicidade</option>
            <option value="nao_instalada">Peça não foi instalada</option>
            <option value="outro">Outro (descrever nas observações)</option>
          </select>

          <div style={{ marginTop: 12 }}>
            <label style={s.label}>OBSERVAÇÕES</label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Detalhes adicionais sobre a reversão"
              style={{ ...s.input, minHeight: 60, resize: "vertical" }} />
          </div>

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
            Cancelar
          </button>
          <button
            disabled={!podeConfirmar}
            onClick={handleConfirmar}
            style={{ ...s.btn(true), flex: 1, padding: "8px 16px",
                     background: "#ef4444", border: "1px solid #ef4444",
                     opacity: podeConfirmar ? 1 : 0.5 }}>
            {salvando ? "Revertendo..." : "Confirmar reversão"}
          </button>
        </div>
      </div>
    </div>
  );
}