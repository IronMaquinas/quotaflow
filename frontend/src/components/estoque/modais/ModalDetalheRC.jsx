// frontend/src/components/estoque/modais/ModalDetalheRC.jsx
//
// Mini-modal pra visualização rápida de uma Requisição de Compra (RC) a
// partir da tela de OS. Não navega pra fora — é só consulta inline.
//
// O usuário clica no badge "📄 RC: RC-XXXX" no cabeçalho da OS e vê:
//   - Cabeçalho da RC (número, status, urgência, categoria)
//   - Origem (qual OS gerou)
//   - Lista de itens (nome, código, quantidade, sugestão de recompra)

import { useState, useEffect } from "react";
import apiService from "../../../services/apiService";

const STATUS_CFG = {
  aberto:              { l: "Aberta",              c: "#f59e0b" },
  aguardando_cotacao:  { l: "Aguardando cotação",  c: "#f59e0b" },
  cotando:             { l: "Cotando",             c: "#60a5fa" },
  finalizado:          { l: "Finalizada",          c: "#22c55e" },
  cancelada:           { l: "Cancelada",           c: "#6b7280" },
};

const URGENCIA_CFG = {
  alta:  { l: "Alta",  c: "#ef4444" },
  media: { l: "Média", c: "#f59e0b" },
  baixa: { l: "Baixa", c: "#22c55e" },
};

const CATEGORIA_CFG = {
  corretiva:  { l: "Corretiva",  c: "#ef4444" },
  preventiva: { l: "Preventiva", c: "#22c55e" },
  preditiva:  { l: "Preditiva",  c: "#60a5fa" },
};

export default function ModalDetalheRC({ rcId, onFechar, s, C, fmtD }) {
  const [rc, setRc] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!rcId) return;
    let cancelado = false;
    (async () => {
      setCarregando(true);
      try {
        const lista = await apiService.get("/cotacoes/chamados", {
          tipo_documento: "requisicao_material",
        });
        if (cancelado) return;
        const encontrada = Array.isArray(lista)
          ? lista.find(c => String(c.id) === String(rcId))
          : null;
        setRc(encontrada);
        if (!encontrada) setErro("RC não encontrada");
      } catch (e) {
        if (!cancelado) setErro(e.message || "Erro ao carregar RC");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [rcId]);

  const st = rc ? (STATUS_CFG[rc.status] || { l: rc.status, c: C.muted }) : null;
  const urg = rc ? (URGENCIA_CFG[rc.urgencia] || { l: rc.urgencia, c: C.muted }) : null;
  const cat = rc ? (CATEGORIA_CFG[rc.categoria] || { l: rc.categoria, c: C.muted }) : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090",
                  display: "flex", alignItems: "center",
                  justifyContent: "center", zIndex: 380, padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div style={{ ...s.card, width: 600, maxWidth: "100%",
                    maxHeight: "85vh", display: "flex", flexDirection: "column" }}
        onClick={e => e.stopPropagation()}>

        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}`,
                      display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
              📄 Requisição de Compra
            </div>
            {rc && (
              <div style={{ fontSize: 12, color: C.accent,
                            fontFamily: "'IBM Plex Mono',monospace", marginTop: 4 }}>
                {rc.numero}
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

          {!carregando && rc && (
            <>
              {/* Badges */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                {st && <span style={{ ...s.tag(st.c), fontSize: 10 }}>{st.l}</span>}
                {urg && <span style={{ ...s.tag(urg.c), fontSize: 10 }}>{urg.l}</span>}
                {cat && <span style={{ ...s.tag(cat.c), fontSize: 10 }}>{cat.l}</span>}
              </div>

              {/* Origem */}
              {(rc.origem_os_numero || rc.aberto_em) && (
                <div style={{ background: C.bg, borderRadius: 6,
                              padding: "10px 12px", marginBottom: 14, fontSize: 11 }}>
                  {rc.origem_os_numero && (
                    <div style={{ color: C.text, marginBottom: 4 }}>
                      <span style={{ color: C.muted }}>Origem: </span>
                      <strong>{rc.origem_os_numero}</strong>
                    </div>
                  )}
                  {rc.aberto_em && (
                    <div style={{ color: C.muted, fontSize: 10 }}>
                      Criada em {fmtD ? fmtD(rc.aberto_em) : new Date(rc.aberto_em).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </div>
              )}

              {/* Itens */}
              <div style={{ fontSize: 10, color: C.muted,
                            letterSpacing: "0.08em", marginBottom: 10 }}>
                ITENS DA RC ({(rc.itens || []).length})
              </div>

              {(rc.itens || []).length === 0 ? (
                <div style={{ color: C.muted, fontSize: 11,
                              textAlign: "center", padding: 20 }}>
                  Nenhum item vinculado.
                </div>
              ) : (
                (rc.itens || []).map((item, idx) => (
                  <div key={item.id || idx} style={{
                    background: C.bg, borderRadius: 6,
                    padding: "10px 12px", marginBottom: 6, fontSize: 11,
                  }}>
                    <div style={{ display: "flex", alignItems: "center",
                                  gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.accent,
                                     fontFamily: "'IBM Plex Mono',monospace" }}>
                        #{item.numero_base ?? idx + 1}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                        📦 {item.item_nome}
                      </span>
                      {item.codigo && (
                        <span style={{ fontSize: 10, color: C.muted,
                                       fontFamily: "'IBM Plex Mono',monospace" }}>
                          {item.codigo}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 10,
                                  color: C.muted, flexWrap: "wrap" }}>
                      <span>Qtd: <strong style={{ color: C.text }}>{item.quantidade}</strong></span>
                      {item.quantidade_sugerida_recompra != null
                        && item.quantidade_sugerida_recompra > 0 && (
                        <span style={{ color: C.success }}>
                          💡 Sugestão de lote: {item.quantidade_sugerida_recompra}
                        </span>
                      )}
                      {item.motivo_recompra === "reposicao_estoque" && (
                        <span style={{ color: "#a855f7" }}>
                          📦 Reposição de estoque
                        </span>
                      )}
                      {item.descricao && <span>· {item.descricao}</span>}
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