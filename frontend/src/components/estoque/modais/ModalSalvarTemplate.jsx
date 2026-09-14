// frontend/src/components/estoque/modais/ModalSalvarTemplate.jsx
//
// Modal de salvar OS como modelo de manutenção. Extraído do
// TelaOrdemServico.jsx na Rodada 3 da quebra.
//
// Padrão: componente "burro" — mantém estado local apenas de `nome` e
// `descricao` (inputs não controlados pelo pai), e emite o payload final
// via `onConfirmar({ nome, descricao })`. Erros e `salvando` vêm do pai,
// que é quem faz a chamada de API.

import { useState } from "react";

export default function ModalSalvarTemplate({
  chamado, nomeInicial, descricaoInicial, salvando, erro,
  onCancelar, onConfirmar, s, C,
}) {
  const [nome, setNome] = useState(nomeInicial || "");
  const [descricao, setDescricao] = useState(descricaoInicial || "");

  const podeSalvar = nome.trim().length > 0 && !salvando;

  async function handleSalvar() {
    if (!nome.trim()) return;
    await onConfirmar({
      nome: nome.trim(),
      descricao: descricao.trim() || null,
    });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090",
                  display: "flex", alignItems: "center",
                  justifyContent: "center", zIndex: 370, padding: 20 }}>
      <div style={{ ...s.card, width: 480, maxWidth: "100%" }}>

        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
            Salvar como modelo de manutenção
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {chamado?.numero}
          </div>
        </div>

        <div style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 14,
                        background: C.bg, borderRadius: 6, padding: "10px 12px" }}>
            Os itens desta OS viram um <strong>modelo reutilizável</strong>. O
            modelo é <strong>privado da sua empresa</strong> — só você e sua
            equipe veem. Nenhum dado vai para outros clientes.
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>NOME DO MODELO *</label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Revisão 10.000km, Preventiva 90 dias..."
              autoFocus
              style={s.input} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>DESCRIÇÃO (OPCIONAL)</label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Ex: Revisão padrão para caminhões da frota — 10.000km"
              style={{ ...s.input, minHeight: 60, resize: "vertical" }} />
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
            disabled={!podeSalvar}
            onClick={handleSalvar}
            style={{ ...s.btn(true), flex: 1, padding: "8px 16px",
                     opacity: podeSalvar ? 1 : 0.5 }}>
            {salvando ? "Salvando..." : "Salvar modelo"}
          </button>
        </div>
      </div>
    </div>
  );
}