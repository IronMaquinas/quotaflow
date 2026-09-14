// frontend/src/components/estoque/modais/ModalAplicarMaterial.jsx
//
// Modal de aplicação de material na OS (fluxo MIGO-like). Extraído do
// TelaOrdemServico.jsx na Rodada 2 da quebra — arquivo original tinha
// ~3000 linhas. Este componente é autocontido: recebe tudo por props.

import { useState, useEffect } from "react";
import BarcodeScannerInput from "../../common/BarcodeScannerInput";

export default function ModalAplicarMaterial({
  chamado, item, salvando, onCancelar, onConfirmar, s, C,
}) {
  const qtdPlanejada = Number(item.quantidade) || 0;
  const qtdAplicada = Number(item.quantidade_aplicada) || 0;
  const qtdPendente = Math.max(0, qtdPlanejada - qtdAplicada);
  const temRM = !!item.requisicao_material?.numero;

  const [quantidade, setQuantidade] = useState(qtdPendente);
  const [serializado, setSerializado] = useState(!!item.serializado);
  const [numerosSerie, setNumerosSerie] = useState([""]);
  const [lote, setLote] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [confirmou, setConfirmou] = useState(false);
  const [erro, setErro] = useState(null);

  // Lastro: se tem RM vinculada, origem fica fixa em 'rm'. Senão,
  // o técnico escolhe entre emergencial ou estoque_proprio, com motivo
  // obrigatório — e o registro aparece no relatório de divergências.
  const [origemLastro, setOrigemLastro] = useState(temRM ? "rm" : "emergencial");
  const [motivoEmergencia, setMotivoEmergencia] = useState(temRM ? "" : "compra_cartao");
  const [valorEstimado, setValorEstimado] = useState("");

  useEffect(() => {
    const n = Math.max(1, parseInt(quantidade) || 1);
    setNumerosSerie(prev => {
      const copy = [...prev];
      while (copy.length < n) copy.push("");
      return copy.slice(0, n);
    });
  }, [quantidade]);

  function setSerie(idx, val) {
    setNumerosSerie(prev => prev.map((s, i) => i === idx ? val : s));
  }

  function validar() {
    const q = parseInt(quantidade);
    if (!q || q <= 0) return "Informe uma quantidade maior que zero.";
    if (q > qtdPendente) return `Só restam ${qtdPendente} unidade(s) pendente(s) neste item.`;
    if (origemLastro !== "rm" && !motivoEmergencia) {
      return "Selecione o motivo da origem não-RM (compra emergencial, estoque próprio etc).";
    }
    if (serializado) {
      const vazios = numerosSerie.filter(s => !s.trim()).length;
      if (vazios > 0) return `Preencha todos os ${q} número(s) de série.`;
      const dup = numerosSerie.map(s => s.trim().toUpperCase());
      if (new Set(dup).size !== dup.length) return "Há números de série repetidos dentro deste mesmo item.";
    }
    if (!confirmou) return "É preciso confirmar que as peças foram fisicamente instaladas.";
    return null;
  }

  async function handleSalvar() {
    const msg = validar();
    if (msg) { setErro(msg); return; }
    setErro(null);
    await onConfirmar({
      quantidade: parseInt(quantidade),
      serializado,
      numeros_serie: serializado ? numerosSerie.map(s => s.trim().toUpperCase()) : [],
      lote: lote.trim() || null,
      observacoes: observacoes.trim() || null,
      origem_lastro: origemLastro,
      motivo_emergencia: origemLastro !== "rm" ? motivoEmergencia : null,
      valor_estimado: valorEstimado !== "" ? parseFloat(valorEstimado) : null,
      _idempotencyKey: crypto.randomUUID(),
    });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090",
                  display: "flex", alignItems: "center",
                  justifyContent: "center", zIndex: 340, padding: 20 }}>
      <div style={{ ...s.card, width: 560, maxWidth: "100%",
                    maxHeight: "90vh", display: "flex", flexDirection: "column" }}>

        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
            Aplicar material na OS
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {chamado?.numero} · {item.item_nome}
          </div>
        </div>

        <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
          <div style={{ background: C.bg, borderRadius: 6, padding: "10px 12px",
                        fontSize: 11, color: C.muted, marginBottom: 16 }}>
            Planejado: <strong style={{ color: C.text }}>{qtdPlanejada}</strong> ·
            Já aplicado: <strong style={{ color: C.text }}>{qtdAplicada}</strong> ·
            Pendente: <strong style={{ color: C.accent }}>{qtdPendente}</strong>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>QUANTIDADE A APLICAR AGORA</label>
            <input type="number" min="1" max={qtdPendente}
              value={quantidade}
              onChange={e => setQuantidade(e.target.value)}
              style={{ ...s.input, textAlign: "center", fontWeight: 600 }} />
          </div>

          {temRM ? (
            <div style={{ background: `${C.accent}15`, border: `1px solid ${C.accent}40`,
                          borderRadius: 6, padding: "10px 12px", marginBottom: 14,
                          fontSize: 11, color: C.text }}>
              <strong>📄 Lastro: RM {item.requisicao_material.numero}</strong>
              <div style={{ color: C.muted, marginTop: 2, fontSize: 10 }}>
                Peça vinculada à requisição de material desta OS.
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 14, background: "#f59e0b11",
                          border: "1px solid #f59e0b40", borderRadius: 6,
                          padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600,
                            marginBottom: 8 }}>
                ⚠ Sem RM vinculada — registre a origem desta peça
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 10 }}>
                Este registro aparecerá no relatório de divergências do gestor.
                É esperado em compras emergenciais, mas precisa ter motivo declarado.
              </div>

              <label style={{ ...s.label, fontSize: 10 }}>COMO ESTA PEÇA CHEGOU *</label>
              <select value={origemLastro}
                onChange={e => setOrigemLastro(e.target.value)}
                style={{ ...s.input, appearance: "none", marginBottom: 10 }}>
                <option value="emergencial">Compra emergencial (loja física, cartão, cupom)</option>
                <option value="estoque_proprio">Estoque próprio do técnico / doação</option>
              </select>

              <label style={{ ...s.label, fontSize: 10 }}>MOTIVO *</label>
              <select value={motivoEmergencia}
                onChange={e => setMotivoEmergencia(e.target.value)}
                style={{ ...s.input, appearance: "none", marginBottom: 10 }}>
                <option value="compra_cartao">Compra direta no cartão</option>
                <option value="compra_dinheiro">Compra direta em dinheiro</option>
                <option value="urgencia_operacional">Urgência operacional (equipamento parado)</option>
                <option value="estoque_tecnico">Veio do estoque pessoal do técnico</option>
                <option value="doacao">Doação / garantia do fornecedor</option>
                <option value="outro">Outro (descrever nas observações)</option>
              </select>

              <label style={{ ...s.label, fontSize: 10 }}>VALOR PAGO (R$) — OPCIONAL</label>
              <input type="number" min="0" step="0.01"
                value={valorEstimado}
                onChange={e => setValorEstimado(e.target.value)}
                placeholder="Ex: 89.90"
                style={{ ...s.input, textAlign: "right" }} />
            </div>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 8,
                          cursor: "pointer", marginBottom: 14,
                          padding: "10px 12px", background: C.bg,
                          borderRadius: 6 }}>
            <input type="checkbox" checked={serializado}
              onChange={e => setSerializado(e.target.checked)} />
            <span style={{ fontSize: 12, color: C.text }}>
              Este material é <strong>serializado</strong>
            </span>
          </label>

          {serializado && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 8,
                            letterSpacing: "0.08em" }}>
                NÚMEROS DE SÉRIE ({numerosSerie.length})
              </div>
              {numerosSerie.map((sn, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>
                    #{i + 1}
                  </div>
                  <BarcodeScannerInput
                    value={sn}
                    onChange={v => setSerie(i, v)}
                    placeholder="Ex: 8A32-11"
                    autoFocus={i === 0}
                    style={s.input}
                  />
                </div>
              ))}
              <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>
                Leia o código de barras ou digite manualmente — algumas peças
                têm SN só gravado no metal, sem etiqueta.
              </div>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>LOTE (OPCIONAL)</label>
            <input type="text" value={lote}
              onChange={e => setLote(e.target.value)}
              placeholder="Ex: L2024-09"
              style={s.input} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>OBSERVAÇÕES (OPCIONAL)</label>
            <textarea value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Ex: substituição preventiva, avaria visível no rolamento antigo..."
              style={{ ...s.input, minHeight: 60, resize: "vertical" }} />
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 8,
                          cursor: "pointer", padding: "12px",
                          background: `${C.accent}15`,
                          border: `1px solid ${C.accent}40`,
                          borderRadius: 6 }}>
            <input type="checkbox" checked={confirmou}
              onChange={e => setConfirmou(e.target.checked)}
              style={{ marginTop: 2 }} />
            <span style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>
              Confirmo que esta(s) peça(s) foi(ram) <strong>fisicamente instalada(s)</strong>
              {" "}no equipamento e que os números de série informados correspondem
              ao que foi aplicado.
            </span>
          </label>

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
          <button onClick={handleSalvar} disabled={salvando}
            style={{ ...s.btn(true), flex: 1, padding: "8px 16px",
                     opacity: salvando ? 0.5 : 1 }}>
            {salvando ? "Registrando..." : "Confirmar aplicação"}
          </button>
        </div>
      </div>
    </div>
  );
}