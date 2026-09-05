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
      frete: fornecedor.valor_frete || '',
      obs: fornecedor.obs || '',
      valor_renegociado: fornecedor.valor_renegociado || '',
      frete_renegociado: fornecedor.frete_renegociado || '' // 🔥 NOVO
    });
  };

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
          valor_frete: formEdicao.frete ? parseFloat(formEdicao.frete) : 0,
          obs: formEdicao.obs,
          valor_renegociado: formEdicao.valor_renegociado ? parseFloat(formEdicao.valor_renegociado) : null,
          frete_renegociado: formEdicao.frete_renegociado ? parseFloat(formEdicao.frete_renegociado) : null // 🔥 NOVO
        }
      );

      // 🔥 ATUALIZAR O ESTADO LOCAL
      setDados(prev => ({
        ...prev,
        itens: prev.itens.map(item => ({
          ...item,
          fornecedores: item.fornecedores.map(f => 
            f.id === editandoFornecedor.id ? { 
              ...f, 
              valor_frete: parseFloat(formEdicao.frete) || 0,
              valor_renegociado: formEdicao.valor_renegociado ? parseFloat(formEdicao.valor_renegociado) : null,
              frete_renegociado: formEdicao.frete_renegociado ? parseFloat(formEdicao.frete_renegociado) : null // 🔥 NOVO
            } : f
          )
        }))
      }));

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
              VALOR RENEGOCIADO (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={formEdicao.valor_renegociado}
              onChange={(e) => {
                const val = e.target.value;
                console.log('🔍 DIGITANDO valor_renegociado:', val);
                setFormEdicao({...formEdicao, valor_renegociado: val});
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 4 }}>
              FRETE RENEGOCIADO (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={formEdicao.frete_renegociado}
              onChange={(e) => setFormEdicao({...formEdicao, frete_renegociado: e.target.value})}
              placeholder="Ex: 5.00"
              style={{ ...s.input, width: "100%" }}
            />
          </div>

          {/* 🔥 MOSTRAR ECONOMIA NO MODAL */}
          {formEdicao.valor_renegociado && (
            <div style={{ 
              marginTop: 8, 
              background: '#0f2f1a', 
              border: '1px solid #22c55e44', 
              borderRadius: 8, 
              padding: '8px 12px', 
              display: 'flex', 
              gap: 8, 
              alignItems: 'center' 
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>
                💰 Economia: {fmtBRL(parseFloat(formEdicao.valor) - parseFloat(formEdicao.valor_renegociado))}
              </span>
            </div>
          )}

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

  const salvarValorRenegociado = async (forn) => {
    try {
      await cotacoesService.atualizarRespostaFornecedor(
        token,
        cotacaoId,
        forn.fornecedor_id,
        {
          valor: forn.valor,
          prazo: forn.prazo,
          frete: forn.frete,
          obs: forn.obs,
          valor_renegociado: forn.valor_renegociado
        }
      );
      alert('✅ Valor renegociado salvo!');
      await carregarDados();
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    }
  };

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
      <div style={{ marginBottom: 20, overflowX: 'auto', maxWidth: '100%' }}>
        <div style={{ minWidth: 1000 }}>
          {/* TÍTULO */}
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 12 }}>
            PROPOSTAS POR ITEM
          </div>

          {itens.map((item, itemIdx) => (
            <div key={item.id} style={{ marginBottom: 16 }}>
              {/* HEADER DO ITEM */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "minmax(100px, 1fr) 40px minmax(110px, 1fr) 80px 80px 80px 60px 110px 110px 90px 80px",
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
                <div style={{ textAlign: "left" }}>VALOR</div>
                <div style={{ textAlign: "left" }}>FRETE</div>
                <div style={{ textAlign: "left" }}>TOTAL</div>
                <div style={{ textAlign: "left" }}>PRAZO</div>
                <div style={{ textAlign: "left" }}>RENEGOCIADO</div>
                <div style={{ textAlign: "left" }}>FRETE RENEGOCIADO</div>
                <div style={{ textAlign: "left" }}>SAVING</div>
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
                    gridTemplateColumns: "minmax(100px, 1fr) 40px minmax(110px, 1fr) 80px 80px 80px 60px 110px 110px 90px 80px",
                    gap: 6,
                    padding: "12px 14px",
                    background: itemIdx % 2 === 0 ? C.bg : "transparent",
                    borderLeft: `4px solid ${corBorda}`,
                    borderBottom: fornIdx < item.fornecedores.length - 1 ? `1px solid ${C.border}22` : `2px solid ${C.border}`,
                    alignItems: "center",
                    opacity: isTemResposta ? 1 : 0.6
                  }}>
                    {/* ITEM + QTD */}
                    {fornIdx === 0 && (
                      <>
                        <div style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: C.text,
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
                    )}
                    {fornIdx > 0 && (
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
                    <div style={{ textAlign: "right", fontSize: 12, color: C.text, fontWeight: 600 }}>
                      {isTemResposta ? fmtBRL(forn.valor) : '—'}
                    </div>

                    {/* FRETE */}
                    <div style={{ textAlign: "right", fontSize: 12, color: C.text, fontWeight: 600 }}>
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

                    {/* RENEGOCIADO */}
                    <div style={{ textAlign: "right", fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>
                      {forn.valor_renegociado ? fmtBRL(forn.valor_renegociado) : '—'}
                    </div>

                    {/* FRETE RENEGOCIADO */}
                    <div style={{ textAlign: "right", fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>
                      {forn.frete_renegociado ? fmtBRL(forn.frete_renegociado) : '—'}
                    </div>

                    {/* SAVING */}
                    <div style={{ textAlign: "right", fontSize: 12, color: '#22c55e', fontWeight: 700 }}>
                      {forn.economia || forn.economia_frete ? fmtBRL((forn.economia || 0) + (forn.economia_frete || 0)) : '—'}
                    </div>

                    {/* BOTÕES DE AÇÃO */}
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
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
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* BOTÃO FINALIZAR */}
      <button
        onClick={() => {
          // 🔥 Verificar se tem melhor proposta
          if (!melhorProposta) {
            alert('Selecione um fornecedor vencedor');
            return;
          }
          
          // 🔥 Buscar o fornecedor vencedor com todos os dados
          const fornecedorVencedor = melhorProposta;
          const valorFinal = fornecedorVencedor.valor_renegociado || fornecedorVencedor.valor;
          const freteFinal = fornecedorVencedor.frete_renegociado || fornecedorVencedor.frete;
          
          onFinalizarOV(cotacao.id, fornecedorVencedor.fornecedor_id, {
            valor: valorFinal,
            frete: freteFinal,
            valor_original: fornecedorVencedor.valor,
            frete_original: fornecedorVencedor.frete,
            economia: (fornecedorVencedor.valor - valorFinal) + (fornecedorVencedor.frete - freteFinal),
            obs: fornecedorVencedor.obs
          });
        }}
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