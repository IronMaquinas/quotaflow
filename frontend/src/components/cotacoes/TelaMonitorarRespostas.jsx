import { useState, useEffect } from "react";
import { cotacoesService } from "../../services/cotacoesService";

export default function TelaMonitorarRespostas({ 
  cotacaoId, 
  token, 
  fmtBRL, 
  C, 
  s, 
  onVoltar, 
  onFinalizarOV 
}) {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editandoFornecedor, setEditandoFornecedor] = useState(null);
  const [atualizando, setAtualizando] = useState(false);
  const [formEdicao, setFormEdicao] = useState({
    valor: '',
    prazo: '',
    frete: '',
    obs: ''
  });

  // ─── CARREGAR DADOS ───────────────────────────────────────
  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const resultado = await cotacoesService.obterStatusCotacao(token, cotacaoId);
      setDados(resultado);
    } catch (err) {
      console.error('❌ Erro:', err);
      alert('Erro ao carregar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── ABRIR EDIÇÃO ──────────────────────────────────────────
  const handleAbrirEdicao = (fornecedor) => {
    setEditandoFornecedor(fornecedor);
    setFormEdicao({
      valor: fornecedor.valor || '',
      prazo: fornecedor.prazo || '',
      frete: fornecedor.frete || '',
      obs: fornecedor.obs || ''
    });
  };

  // ─── SALVAR EDIÇÃO ────────────────────────────────────────
  const handleSalvarEdicao = async () => {
    if (!formEdicao.valor || !formEdicao.prazo) {
      alert('Preencha valor e prazo');
      return;
    }

    setAtualizando(true);
    try {
      await cotacoesService.atualizarRespostaFornecedor(
        token,
        cotacaoId,
        editandoFornecedor.fornecedor_id,
        {
          valor: parseFloat(formEdicao.valor),
          prazo: parseInt(formEdicao.prazo),
          frete: formEdicao.frete ? parseFloat(formEdicao.frete) : 0,
          obs: formEdicao.obs
        }
      );

      setEditandoFornecedor(null);
      await carregarDados();
    } catch (err) {
      console.error('❌ Erro:', err);
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setAtualizando(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "22px 24px", textAlign: "center", color: C.muted }}>
        Carregando respostas...
      </div>
    );
  }

  if (!dados) {
    return (
      <div style={{ padding: "22px 24px", textAlign: "center", color: C.muted }}>
        Erro ao carregar dados
      </div>
    );
  }

  // ─── MODO EDIÇÃO ───────────────────────────────────────────
  if (editandoFornecedor) {
    return (
      <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>
            EDITAR RESPOSTA
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>
            {editandoFornecedor.nome}
          </div>
        </div>

        <div style={{ ...s.card, padding: "16px 18px", marginBottom: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 4 }}>
              VALOR (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={formEdicao.valor}
              onChange={(e) => setFormEdicao({...formEdicao, valor: e.target.value})}
              style={{ ...s.input, width: "100%" }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 4 }}>
              PRAZO (dias)
            </label>
            <input
              type="number"
              value={formEdicao.prazo}
              onChange={(e) => setFormEdicao({...formEdicao, prazo: e.target.value})}
              style={{ ...s.input, width: "100%" }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 4 }}>
              FRETE (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={formEdicao.frete}
              onChange={(e) => setFormEdicao({...formEdicao, frete: e.target.value})}
              style={{ ...s.input, width: "100%" }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 4 }}>
              OBSERVAÇÕES
            </label>
            <textarea
              value={formEdicao.obs}
              onChange={(e) => setFormEdicao({...formEdicao, obs: e.target.value})}
              style={{ ...s.input, width: "100%", minHeight: "80px" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setEditandoFornecedor(null)}
            style={{...s.btn(false, C.muted), flex: 1, padding: "10px 16px"}}
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvarEdicao}
            disabled={atualizando}
            style={{...s.btn(true, C.success), flex: 1, padding: "10px 16px", opacity: atualizando ? 0.5 : 1}}
          >
            {atualizando ? "Salvando..." : "✅ Salvar"}
          </button>
        </div>
      </div>
    );
  }

  // ─── MODO VISUALIZAÇÃO ────────────────────────────────────

  const { cotacao, itens, resumo, melhorProposta } = dados;

  // Função para determinar cor da borda baseado na posição
  const getCorBorda = (posicao) => {
    if (posicao === 1) return C.success; // Verde - melhor
    if (posicao === 2) return C.warn;    // Laranja - 2º
    return '#ef4444';                    // Vermelho - pior
  };

  return (
    <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>
            MONITORAR RESPOSTAS
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>
            Cotação {cotacao.numero || `#${cotacao.id}`}
          </div>
        </div>
        <button
          onClick={onVoltar}
          style={{ ...s.btn(false, C.muted), padding: "10px 16px", fontSize: 12 }}
        >
          ← Voltar
        </button>
      </div>

      {/* RESUMO */}
      <div style={{
        ...s.card,
        padding: "16px 18px",
        marginBottom: 20,
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12
      }}>
        <div>
          <div style={{ fontSize: 10, color: C.muted }}>TOTAL</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginTop: 4 }}>
            {resumo.total}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.muted }}>✅ RESPONDIDOS</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.success, marginTop: 4 }}>
            {resumo.respondidos}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.muted }}>⏳ PENDENTES</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.warn, marginTop: 4 }}>
            {resumo.pendentes}
          </div>
        </div>
      </div>

      {/* MELHOR PROPOSTA */}
      {melhorProposta && (
        <div style={{
          ...s.card,
          padding: "16px 18px",
          marginBottom: 20,
          borderLeft: `4px solid ${C.success}`
        }}>
          <div style={{ fontSize: 12, color: C.success, fontWeight: 600, marginBottom: 8 }}>
            🏆 MELHOR PROPOSTA GERAL
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
            {melhorProposta.fornecedor_nome}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
            {fmtBRL(melhorProposta.total)} | Prazo: {melhorProposta.prazo} dias
          </div>
        </div>
      )}

      {/* TABELA POR ITEM */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 12 }}>
          PROPOSTAS POR ITEM
        </div>

        {itens.map((item, itemIdx) => (
          <div key={item.id} style={{ marginBottom: 16 }}>
            {/* HEADER DO ITEM */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr 100px",
              gap: 12,
              padding: "12px 14px",
              background: C.bg,
              borderRadius: "6px 6px 0 0",
              borderBottom: `1px solid ${C.border}`,
              fontSize: 11,
              fontWeight: 600,
              color: C.muted,
              letterSpacing: "0.05em"
            }}>
              <div>ITEM</div>
              <div style={{ textAlign: "center" }}>QTD</div>
              <div>FORNECEDOR</div>
              <div style={{ textAlign: "right" }}>VALOR</div>
              <div style={{ textAlign: "right" }}>FRETE</div>
              <div style={{ textAlign: "right" }}>TOTAL</div>
              <div style={{ textAlign: "center" }}>PRAZO</div>
              <div></div>
            </div>

            {/* LINHAS DE FORNECEDORES */}
            {item.fornecedores.map((forn, fornIdx) => {
              const isMelhor = forn.posicao === 1;
              const is2Melhor = forn.posicao === 2;
              const isTemResposta = forn.status === 'respondido';
              const corBorda = isTemResposta ? getCorBorda(forn.posicao) : 'transparent';

              return (
                <div key={forn.id} style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr 100px",
                  gap: 12,
                  padding: "12px 14px",
                  background: itemIdx % 2 === 0 ? C.bg : "transparent",
                  borderLeft: `4px solid ${corBorda}`,
                  borderBottom: fornIdx < item.fornecedores.length - 1 ? `1px solid ${C.border}22` : `2px solid ${C.border}`,
                  alignItems: "center",
                  opacity: isTemResposta ? 1 : 0.6
                }}>
                  {/* ITEM + QTD (mesclados - só na primeira linha) */}
                  {fornIdx === 0 ? (
                    <>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.text,
                        gridColumn: "1"
                      }}>
                        <div>{item.nome}</div>
                        {item.codigo && (
                          <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                            {item.codigo}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: C.text }}>
                        {item.quantidade}
                      </div>
                    </>
                  ) : (
                    <>
                      <div></div>
                      <div></div>
                    </>
                  )}

                  {/* FORNECEDOR */}
                  <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>
                    {forn.nome}
                  </div>

                  {/* VALOR */}
                  <div style={{ textAlign: "right", fontSize: 12, color: C.text, fontWeight: isTemResposta ? 600 : 400 }}>
                    {isTemResposta ? fmtBRL(forn.valor) : '—'}
                  </div>

                  {/* FRETE */}
                  <div style={{ textAlign: "right", fontSize: 12, color: C.text, fontWeight: isTemResposta ? 600 : 400 }}>
                    {isTemResposta ? fmtBRL(forn.frete || 0) : '—'}
                  </div>

                  {/* TOTAL */}
                  <div style={{
                    textAlign: "right",
                    fontSize: 12,
                    fontWeight: 700,
                    color: isTemResposta ? (isMelhor ? C.success : is2Melhor ? C.warn : '#ef4444') : C.muted
                  }}>
                    {isTemResposta ? fmtBRL(forn.total) : '⏳ Aguardando'}
                  </div>

                  {/* PRAZO */}
                  <div style={{ textAlign: "center", fontSize: 11, color: C.muted }}>
                    {isTemResposta ? `${forn.prazo}d` : '—'}
                  </div>

                  {/* BOTÕES */}
                  <button
                    onClick={() => handleAbrirEdicao(forn)}
                    style={{
                      ...s.btn(true, C.accent),
                      padding: "6px 12px",
                      fontSize: 11
                    }}
                  >
                    {isTemResposta ? "✏️" : "➕"}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* BOTÃO FINALIZAR */}
      <button
        onClick={() => onFinalizarOV(cotacao.id, melhorProposta?.fornecedor_id)}
        disabled={resumo.respondidos === 0}
        style={{
          ...s.btn(resumo.respondidos > 0, C.success),
          width: "100%",
          padding: "12px 16px",
          fontSize: 14,
          fontWeight: 600,
          opacity: resumo.respondidos === 0 ? 0.5 : 1
        }}
      >
        📋 Finalizar e Emitir OV
      </button>
    </div>
  );
}