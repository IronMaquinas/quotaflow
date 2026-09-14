// frontend/src/components/estoque/modais/ModalConclusao.jsx
//
// Modal de conclusão de Ordem de Serviço. Extraído do TelaOrdemServico.jsx
// na Rodada 3 da quebra.
//
// Regras de negócio embutidas:
//  - Material pendente → bloqueio permanente (não dá pra desbloquear por
//    checkbox, só resolvendo o material na tela de trás).
//  - Serviço sem apontamento → avisa + exige checkbox de confirmação
//    (bloqueia botão até marcar).
//  - Sem pendências → confirma direto.
//
// O componente é "burro": o pai é quem calcula o `resumo` e dispara a
// chamada de API em `onConfirmar`.

export default function ModalConclusao({
  chamado, resumo, confirmouServicosPendentes, salvando, erro,
  onToggleCheckbox, onCancelar, onConfirmar, s, C,
}) {
  const temMaterialPendente = (resumo?.materiais_pendentes?.length || 0) > 0;
  const temServicoPendente = (resumo?.servicos_sem_apontamento || 0) > 0;

  const bloqueado =
    temMaterialPendente
    || (temServicoPendente && !confirmouServicosPendentes);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090",
                  display: "flex", alignItems: "center",
                  justifyContent: "center", zIndex: 360, padding: 20 }}>
      <div style={{ ...s.card, width: 520, maxWidth: "100%" }}>

        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
            Concluir Ordem de Serviço
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {chamado?.numero}
          </div>
        </div>

        <div style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 12, color: C.text, marginBottom: 14 }}>
            Ao concluir, a OS fica <strong>bloqueada para edição</strong>. Um
            resumo consolidado (horas, materiais, custo) é gravado no histórico.
          </div>

          <div style={{ background: C.bg, borderRadius: 6, padding: "12px 14px",
                        marginBottom: 14, fontSize: 11 }}>
            <div style={{ color: C.muted, fontSize: 10, marginBottom: 8,
                          letterSpacing: "0.08em" }}>RESUMO</div>

            {/* ── Faixa vermelha: material pendente (bloqueio absoluto) ── */}
            {temMaterialPendente && (
              <div style={{
                background: "#ef444415",
                border: "1px solid #ef444440",
                borderRadius: 6,
                padding: "10px 12px",
                marginBottom: 8,
              }}>
                <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 600,
                              marginBottom: 6 }}>
                  🚫 Não é possível concluir — {resumo.materiais_pendentes.length} material(is) sem confirmação
                </div>
                <div style={{ fontSize: 10, color: C.text, marginBottom: 6 }}>
                  {resumo.materiais_pendentes.map((m, i) => (
                    <div key={i} style={{ display: "flex", gap: 6 }}>
                      <span style={{
                        fontFamily: "'IBM Plex Mono',monospace",
                        color: "#ef4444",
                        fontWeight: 600,
                        minWidth: 28,
                      }}>
                        #{m.numero_exibicao}
                      </span>
                      <span>
                        {m.item_nome} — {m.quantidade_aplicada}/{m.quantidade} aplicado(s)
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: C.muted, fontStyle: "italic" }}>
                  Aplique ou marque como "não aplicado" antes de fechar a OS.
                </div>
              </div>
            )}

            {/* ── Faixa amarela: serviço sem apontamento (aviso + checkbox) ── */}
            {temServicoPendente && (
              <div style={{
                background: "#f59e0b15",
                border: "1px solid #f59e0b40",
                borderRadius: 6,
                padding: "10px 12px",
                marginBottom: 8,
              }}>
                <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600,
                              marginBottom: 6 }}>
                  ⚠ {resumo.servicos_sem_apontamento} serviço(s) sem apontamento de horas
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 8 }}>
                  {resumo.servicos_pendentes_lista.map((sv, i) => (
                    <div key={i} style={{ display: "flex", gap: 6 }}>
                      <span style={{
                        fontFamily: "'IBM Plex Mono',monospace",
                        color: "#f59e0b",
                        fontWeight: 600,
                        minWidth: 28,
                      }}>
                        #{sv.numero_exibicao}
                      </span>
                      <span>{sv.nome}</span>
                    </div>
                  ))}
                </div>

                {!temMaterialPendente && (
                  <label style={{ display: "flex", alignItems: "flex-start",
                                  gap: 8, cursor: "pointer" }}>
                    <input type="checkbox"
                      checked={!!confirmouServicosPendentes}
                      onChange={e => onToggleCheckbox(e.target.checked)}
                      style={{ marginTop: 2 }} />
                    <span style={{ fontSize: 11, color: C.text, lineHeight: 1.5 }}>
                      Confirmo que estes serviços foram executados, ainda que o
                      apontamento de horas não tenha sido lançado.
                    </span>
                  </label>
                )}
                {temMaterialPendente && (
                  <div style={{ fontSize: 10, color: C.muted, fontStyle: "italic" }}>
                    Resolva os materiais pendentes acima para poder confirmar
                    os serviços.
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: 4, color: C.text }}>
              ⏱ Horas-homem planejadas: <strong>{resumo?.horas_planejadas || 0}h</strong>
              {(resumo?.horas_reais || 0) > 0 && ` · realizadas: ${resumo.horas_reais}h`}
            </div>
            <div style={{ color: C.muted, fontSize: 10, marginTop: 8 }}>
              Obs: o custo de materiais considera apenas compras emergenciais
              (com valor informado). Materiais via RM ainda não têm preço
              lançado no sistema.
            </div>
          </div>

          {erro && (
            <div style={{ padding: "10px 12px", background: "#ef444415",
                          border: "1px solid #ef444440", borderRadius: 6,
                          fontSize: 11, color: "#ef4444" }}>
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
            disabled={bloqueado || salvando}
            onClick={onConfirmar}
            style={{
              ...s.btn(true), flex: 1, padding: "8px 16px",
              background: C.success,
              border: `1px solid ${C.success}`,
              opacity: (bloqueado || salvando) ? 0.5 : 1,
              cursor: (bloqueado || salvando) ? "not-allowed" : "pointer",
            }}>
            {salvando ? "Concluindo..." : "Confirmar conclusão"}
          </button>
        </div>
      </div>
    </div>
  );
}