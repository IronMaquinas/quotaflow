// frontend/src/components/estoque/modais/ModalDetalheRM.jsx
//
// Mini-modal de detalhe da RM (Requisição de Material / retirada física).
// Foco principal: mostrar se a peça já saiu do estoque ou não.
//
// Status:
//   pendente  → aguardando aprovação, peça AINDA no estoque
//   aprovada  → peça SAIU do estoque
//   rejeitada → peça PERMANECE no estoque (retirada negada)

import { useState, useEffect } from "react";
import apiService from "../../../services/apiService";

const STATUS_CFG = {
  pendente:  {
    icon: "⏳",
    label: "Aguardando aprovação",
    banner: "A peça ainda está no estoque, aguardando liberação.",
    c: "#f59e0b",
    bg: "#f59e0b15",
    border: "#f59e0b40",
  },
  aprovada: {
    icon: "✅",
    label: "Aprovada · peça retirada",
    banner: "Peça saiu do estoque.",
    c: "#22c55e",
    bg: "#22c55e15",
    border: "#22c55e40",
  },
  rejeitada: {
    icon: "❌",
    label: "Rejeitada",
    banner: "Peça permanece no estoque — retirada foi negada.",
    c: "#ef4444",
    bg: "#ef444415",
    border: "#ef444440",
  },
};

export default function ModalDetalheRM({ rmId, onFechar, s, C, fmtD }) {
  const [rm, setRm] = useState(null);
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!rmId) return;
    let cancelado = false;
    (async () => {
      setCarregando(true);
      try {
        const lista = await apiService.get("/estoque/solicitacoes", {});
        if (cancelado) return;
        const encontrada = Array.isArray(lista)
          ? lista.find(r => String(r.id) === String(rmId))
          : null;
        if (!encontrada) {
          setErro("RM não encontrada");
        } else {
          setRm(encontrada);
          setItens(encontrada.itens || encontrada.itens_retirada || []);
        }
      } catch (e) {
        if (!cancelado) setErro(e.message || "Erro ao carregar RM");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [rmId]);

  const cfg = rm ? (STATUS_CFG[rm.status] || STATUS_CFG.pendente) : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090",
                  display: "flex", alignItems: "center",
                  justifyContent: "center", zIndex: 380, padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div style={{ ...s.card, width: 560, maxWidth: "100%",
                    maxHeight: "85vh", display: "flex", flexDirection: "column" }}
        onClick={e => e.stopPropagation()}>

        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}`,
                      display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
              📦 Requisição de Material
            </div>
            {rm && (
              <div style={{ fontSize: 12, color: "#22c55e",
                            fontFamily: "'IBM Plex Mono',monospace", marginTop: 4 }}>
                {rm.numero_solicitacao}
              </div>
            )}
          </div>
          <button onClick={onFechar}
            style={{ background: "transparent", border: "none",
                     color: C.muted, fontSize: 20, cursor: "pointer",
                     lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
          {carregando && (
            <div style={{ color: C.muted, textAlign: "center", padding: 20 }}>
              Carregando...
            </div>
          )}

          {!carregando && erro && (
            <div style={{ color: "#ef4444", padding: 12,
                          background: "#ef444415", borderRadius: 6, fontSize: 12 }}>
              ⚠ {erro}
            </div>
          )}

          {!carregando && rm && cfg && (
            <>
              {/* Banner de status — o coração do modal */}
              <div style={{
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                borderRadius: 8,
                padding: "14px 16px",
                marginBottom: 16,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8,
                              fontSize: 14, fontWeight: 700, color: cfg.c }}>
                  <span style={{ fontSize: 18 }}>{cfg.icon}</span>
                  {cfg.label}
                </div>
                <div style={{ fontSize: 11, color: C.text, marginTop: 6,
                              marginLeft: 26 }}>
                  {cfg.banner}
                </div>
              </div>

              {/* Resumo consolidado (contagem + total de quantidades) */}
              {itens.length > 0 && (() => {
                const totalQtd = itens.reduce((soma, it) =>
                  soma + (parseFloat(it.quantidade) || 0), 0);
                const pluralItens = itens.length > 1 ? "itens" : "item";
                return (
                  <div style={{ background: C.bg, borderRadius: 6,
                                padding: "10px 12px", marginBottom: 10, fontSize: 11,
                                display: "flex", justifyContent: "space-between",
                                alignItems: "center" }}>
                    <span style={{ color: C.muted, fontSize: 10,
                                   letterSpacing: "0.08em", fontWeight: 600 }}>
                      RESUMO
                    </span>
                    <span style={{ color: C.text, fontWeight: 600 }}>
                      {itens.length} {pluralItens} · {totalQtd} no total
                    </span>
                  </div>
                );
              })()}

              {/* Metadados */}
              <div style={{ background: C.bg, borderRadius: 6,
                            padding: "10px 12px", marginBottom: 14, fontSize: 11 }}>
                {rm.origem_os_numero && (
                  <div style={{ color: C.text, marginBottom: 4 }}>
                    <span style={{ color: C.muted }}>Origem: </span>
                    <strong>{rm.origem_os_numero}</strong>
                  </div>
                )}
                {rm.criado_em && (
                  <div style={{ color: C.muted, fontSize: 10 }}>
                    Solicitada em {fmtD ? fmtD(rm.criado_em) : new Date(rm.criado_em).toLocaleDateString("pt-BR")}
                  </div>
                )}
                {rm.solicitante_nome && (
                  <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>
                    Solicitada por {rm.solicitante_nome}
                  </div>
                )}
              </div>

              {/* Itens */}
              <div style={{ fontSize: 10, color: C.muted,
                            letterSpacing: "0.08em", marginBottom: 10 }}>
                ITENS ({itens.length})
              </div>

              {itens.length === 0 ? (
                <div style={{ color: C.muted, fontSize: 11,
                              textAlign: "center", padding: 20 }}>
                  Nenhum item vinculado.
                </div>
              ) : (
                itens.map((it, idx) => (
                  <div key={it.id || idx} style={{
                    background: C.bg, borderRadius: 6,
                    padding: "10px 12px", marginBottom: 6, fontSize: 11,
                  }}>
                    <div style={{ display: "flex", alignItems: "center",
                                  gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: "#22c55e",
                        fontFamily: "'IBM Plex Mono',monospace",
                        flexShrink: 0,
                      }}>
                        #{idx + 1}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                        📦 {it.item_nome}
                      </span>
                      {it.codigo && (
                        <span style={{ fontSize: 10, color: C.muted,
                                       fontFamily: "'IBM Plex Mono',monospace" }}>
                          {it.codigo}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 10,
                                  color: C.muted, flexWrap: "wrap" }}>
                      <span>
                        Qtd: <strong style={{ color: C.text }}>{it.quantidade}</strong>
                        {it.unidade_medida && ` ${it.unidade_medida}`}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        <div style={{ display: "flex", padding: "14px 22px",
                      borderTop: `1px solid ${C.border}` }}>
          <button onClick={onFechar}
            style={{ ...s.btn(false), flex: 1, padding: "8px 16px" }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}