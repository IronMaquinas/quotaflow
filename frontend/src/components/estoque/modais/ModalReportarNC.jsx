// frontend/src/components/estoque/modais/ModalReportarNC.jsx
//
// Modal de criação de Não Conformidade. Contexto (OS, item, equipamento,
// quantidade planejada) vem pré-preenchido do item da OS — o técnico só
// descreve o problema e informa quantidade afetada (quando aplicável).

import { useState } from "react";

export default function ModalReportarNC({
  chamado, item, origem, onCancelar, onConfirmar, s, C,
}) {
  const isMaterial = origem === "os_material";
  const qtdPlanejada = Number(item?.quantidade) || 0;

  const [descricao, setDescricao] = useState("");
  const [acaoImediata, setAcaoImediata] = useState("");
  const [disposicao, setDisposicao] = useState("pendente");
  const [quantidadeAfetada, setQuantidadeAfetada] = useState(
    isMaterial ? String(qtdPlanejada || 1) : ""
  );
  const [custoEstimado, setCustoEstimado] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const podeSalvar = descricao.trim().length >= 10 && !salvando;

  async function salvar() {
    if (!descricao.trim()) { setErro("Descreva o problema encontrado."); return; }
    if (descricao.trim().length < 10) { setErro("A descrição precisa ter ao menos 10 caracteres."); return; }
    if (isMaterial && quantidadeAfetada !== "") {
      const q = parseFloat(quantidadeAfetada);
      if (isNaN(q) || q <= 0) { setErro("Quantidade afetada deve ser maior que zero."); return; }
    }
    setSalvando(true);
    setErro(null);
    try {
      await onConfirmar({
        origem,
        descricao_problema: descricao.trim(),
        acao_imediata: acaoImediata.trim() || null,
        disposicao,
        custo_estimado: custoEstimado !== "" ? parseFloat(custoEstimado) : null,
        quantidade_afetada: isMaterial && quantidadeAfetada !== ""
          ? parseFloat(quantidadeAfetada)
          : null,
        chamado_id: chamado.id,
        chamado_item_id: item.id,
        equipamento_id: chamado.equipamento_id || null,
        item_catalogo_id: item.item_catalogo_id || null,
      });
    } catch (e) {
      setErro(e.message || "Erro ao registrar NC");
      setSalvando(false);
    }
  }

  const disposicoes = [
    { id: "pendente", label: "Pendente de decisão" },
    { id: "devolucao", label: "Devolução ao fornecedor" },
    { id: "retrabalho", label: "Retrabalho" },
    { id: "descarte", label: "Descarte (refugo)" },
    { id: "uso_como_esta", label: "Uso como está (concessão)" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090",
                  display: "flex", alignItems: "center",
                  justifyContent: "center", zIndex: 360, padding: 20 }}>
      <div style={{ ...s.card, width: 580, maxWidth: "100%",
                    maxHeight: "90vh", display: "flex", flexDirection: "column" }}>

        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between",
                        alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                ⚠️ Reportar Não Conformidade
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                {chamado?.numero}
              </div>
            </div>
            <button onClick={onCancelar}
              style={{ background: "transparent", border: "none",
                       color: C.muted, fontSize: 20, cursor: "pointer",
                       lineHeight: 1 }}>×</button>
          </div>
        </div>

        <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>

          {/* ── Contexto pré-preenchido (read-only) ── */}
          <div style={{ background: C.bg, borderRadius: 6,
                        padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em",
                          marginBottom: 8 }}>
              CONTEXTO
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8,
                          marginBottom: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                {isMaterial ? "📦" : "🛠"} {item?.item_nome || item?.nome}
              </span>
              {item?.codigo && (
                <span style={{ fontSize: 10, color: C.muted,
                               fontFamily: "'IBM Plex Mono',monospace" }}>
                  {item.codigo}
                </span>
              )}
              {item?.serializado && (
                <span style={{ ...s.tag("#a855f7"), fontSize: 9 }}>🔢 SERIALIZADO</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 11, color: C.muted,
                          flexWrap: "wrap" }}>
              {chamado?.equipamento_nome && chamado.equipamento_nome !== "—" && (
                <span>🔧 {chamado.equipamento_nome}</span>
              )}
              {isMaterial && qtdPlanejada > 0 && (
                <span>Planejado: {qtdPlanejada} un</span>
              )}
              {!isMaterial && item?.apontamento_resumo?.total > 0 && (
                <span>Executado: {item.apontamento_resumo.total}h-homem</span>
              )}
            </div>
          </div>

          {/* ── Quantidade afetada (só material) ── */}
          {isMaterial && (
            <div style={{ marginBottom: 14 }}>
              <label style={s.label}>QUANTIDADE AFETADA *</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="number" min="1" step="1"
                  value={quantidadeAfetada}
                  onChange={e => setQuantidadeAfetada(e.target.value)}
                  style={{ ...s.input, maxWidth: 120, textAlign: "center" }} />
                <span style={{ fontSize: 11, color: C.muted }}>
                  de {qtdPlanejada} planejada(s)
                </span>
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                Quantas unidades apresentaram o problema? Pode ser menor que o planejado.
              </div>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>DESCRIÇÃO DO PROBLEMA *</label>
            <textarea value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder={isMaterial
                ? "Ex: Rolamento apresentou folga excessiva ao ser instalado. Peça nova, retirada do lote L2026-09."
                : "Ex: Durante a instalação, o técnico avariou o cabeamento elétrico do sensor de ABS."}
              autoFocus
              style={{ ...s.input, minHeight: 90, resize: "vertical" }} />
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
              Mínimo 10 caracteres · {descricao.length} digitados
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>AÇÃO IMEDIATA / CONTENÇÃO</label>
            <textarea value={acaoImediata}
              onChange={e => setAcaoImediata(e.target.value)}
              placeholder="Ex: Peça isolada na bancada e identificada com fita vermelha. Lote do fornecedor separado para análise."
              style={{ ...s.input, minHeight: 70, resize: "vertical" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr",
                        gap: 10, marginBottom: 14 }}>
            <div>
              <label style={s.label}>DISPOSIÇÃO</label>
              <select value={disposicao}
                onChange={e => setDisposicao(e.target.value)}
                style={{ ...s.input, appearance: "none" }}>
                {disposicoes.map(d => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={s.label}>CUSTO EST. (R$)</label>
              <input type="number" min="0" step="0.01"
                value={custoEstimado}
                onChange={e => setCustoEstimado(e.target.value)}
                placeholder="0,00"
                style={{ ...s.input, textAlign: "right" }} />
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
          <button onClick={salvar} disabled={!podeSalvar}
            style={{ ...s.btn(true), flex: 1, padding: "8px 16px",
                     background: "#f59e0b", border: "1px solid #f59e0b",
                     opacity: podeSalvar ? 1 : 0.5,
                     cursor: podeSalvar ? "pointer" : "not-allowed" }}>
            {salvando ? "Registrando..." : "Registrar NC"}
          </button>
        </div>
      </div>
    </div>
  );
}