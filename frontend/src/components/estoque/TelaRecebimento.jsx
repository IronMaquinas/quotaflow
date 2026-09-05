// components/estoque/TelaRecebimento.jsx
import { useState, useEffect, useRef } from 'react';
import apiService from '../../services/apiService';

// Função para formatar valores em Reais
const fmtBRL = (v) => {
  return v != null ? `R$ ${Number(v).toFixed(2).replace('.', ',')}` : '—';
};

export default function TelaRecebimento({ C, s, fmtD }) {
  // ─── ESTADOS PARA FLUXO PRINCIPAL (OVs) ────────────────────
  const [ordensVendaAbertas, setOrdensVendaAbertas] = useState([]);
  const [ordemVendaSel, setOrdemVendaSel] = useState(null);
  const [itensOV, setItensOV] = useState([]);
  const [buscaOV, setBuscaOV] = useState('');
  const [loading, setLoading] = useState(true);

  // ─── ESTADOS PARA RECEBIMENTO AVULSO (MODAL) ───────────────
  const [modalAvulso, setModalAvulso] = useState(false);
  const [itens, setItens] = useState([]);
  const [busca, setBusca] = useState('');
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [quantidade, setQuantidade] = useState('');
  const [fornecedor_id, setFornecedorId] = useState('');
  const [lote, setLote] = useState('');
  const [validade, setValidade] = useState('');
  const [numero_nota_fiscal, setNumeroNotaFiscal] = useState('');
  const [observacao, setObservacao] = useState('');
  const [mensagem, setMensagem] = useState(null);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const inputRef = useRef(null);
  const [fornecedores, setFornecedores] = useState([]);

  // ─── ESTADOS PARA MIRO / MIGO ─────────────────────────────
  const [itemConferenciaFiscal, setItemConferenciaFiscal] = useState(null);
  const [itemConferenciaFisica, setItemConferenciaFisica] = useState(null);

  // ─── FUNÇÕES PARA OVs ──────────────────────────────────────
  const carregarOVs = async () => {
    try {
      const data = await apiService.get('/ordens-venda');
      setOrdensVendaAbertas(data || []);
    } catch (err) {
      console.error('Erro ao carregar OVs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarOVs();
  }, []);

  const carregarItensOV = async (ovId) => {
    try {
      const data = await apiService.get(`/estoque/movimentacoes/ordem-venda/${ovId}`);
      setOrdemVendaSel(data.ordem_venda);
      
      if (data.ordem_venda.fornecedor_id) {
        const fornecedor = await apiService.get(`/fornecedores/${data.ordem_venda.fornecedor_id}`);
        setOrdemVendaSel(prev => ({ ...prev, fornecedor_nome: fornecedor.nome || '—' }));
      }
      
      setItensOV(data.itens);
    } catch (err) {
      alert('Erro ao carregar itens: ' + err.message);
    }
  };

  // ─── FUNÇÕES PARA MIRO (FISCAL) ────────────────────────────
  const abrirConferenciaFiscal = (item) => {
    setItemConferenciaFiscal({
      ...item,
      valor_total_ov: item.valor_total || (item.valor_unitario * item.quantidade) || 0,
      numero_nota_fiscal: '',
      quantidade_nf: '',
      valor_nf: '',
      impostos: '',
      data_vencimento_pagamento: '',
      unidade_medida: item.unidade_medida || 'UN'
    });
  };

  const handleSalvarConferenciaFiscal = async (status = 'aprovado') => {
    try {
      await apiService.put(`/estoque/movimentacoes/item/${itemConferenciaFiscal.id}/fiscal`, {
        numero_nota_fiscal: itemConferenciaFiscal.numero_nota_fiscal,
        valor_nf: itemConferenciaFiscal.valor_nf,
        quantidade_nf: itemConferenciaFiscal.quantidade_nf || null,
        impostos: itemConferenciaFiscal.impostos,
        data_vencimento_pagamento: itemConferenciaFiscal.data_vencimento_pagamento || null,
        unidade_medida: itemConferenciaFiscal.unidade_medida || 'UN',
        status_quarentena: status
      });
      alert(status === 'aprovado' ? '✅ Conferência fiscal salva!' : '🚫 Item em quarentena!');
      setItemConferenciaFiscal(null);
      await carregarItensOV(ordemVendaSel.id);
    } catch (err) {
      alert('Erro ao salvar conferência fiscal: ' + err.message);
    }
  };

  // ─── FUNÇÕES PARA MIGO (FÍSICA) ────────────────────────────
  const abrirConferenciaFisica = (item) => {
    setItemConferenciaFisica({
      ...item,
      quantidade_fisica: '',
      lote: '',
      validade: '',
      numero_serie: '',
      unidade_medida: item.unidade_medida || 'UN'
    });
  };

  const handleSalvarConferenciaFisica = async (status = 'aprovado') => {
    try {
      await apiService.put(`/estoque/movimentacoes/item/${itemConferenciaFisica.id}/fisica`, {
        quantidade_fisica: itemConferenciaFisica.quantidade_fisica,
        lote: itemConferenciaFisica.lote,
        validade: itemConferenciaFisica.validade,
        numero_serie: itemConferenciaFisica.numero_serie,
        unidade_medida: itemConferenciaFisica.unidade_medida || 'UN',
        status_quarentena: status
      });
      alert(status === 'aprovado' ? '✅ Conferência física salva!' : '🚫 Item em quarentena!');
      setItemConferenciaFisica(null);
      await carregarItensOV(ordemVendaSel.id);
    } catch (err) {
      alert('Erro ao salvar conferência física: ' + err.message);
    }
  };

  const entrarItemEstoque = async (item) => {
    try {
      await apiService.post(`/estoque/movimentacoes/entrada`, {
        ordem_venda_id: ordemVendaSel.id,
        item_consumo_id: item.item_consumo_id,
        quantidade: item.quantidade_pendente,
        numero_nota_fiscal: item.numero_nota_fiscal,
        observacao: `Recebimento da OV ${ordemVendaSel.numero}`
      });
      alert('✅ Item recebido e entrada no estoque realizada!');
      await carregarItensOV(ordemVendaSel.id);
    } catch (err) {
      alert('Erro ao entrar no estoque: ' + err.message);
    }
  };

  // ─── FUNÇÕES PARA RECEBIMENTO AVULSO ───────────────────────
  const carregarItens = async () => {
    try {
      const data = await apiService.get('/estoque/itens');
      setItens(data || []);
    } catch (err) {
      console.error('Erro ao carregar itens:', err);
    }
  };

  const carregarFornecedores = async () => {
    try {
      const data = await apiService.get('/fornecedores');
      setFornecedores(data || []);
    } catch (err) {
      console.error('Erro ao carregar fornecedores:', err);
    }
  };

  useEffect(() => {
    if (modalAvulso) {
      carregarItens();
      carregarFornecedores();
    }
  }, [modalAvulso]);

  const sugestoes = itens.filter(i => 
    i.nome.toLowerCase().includes(busca.toLowerCase()) ||
    i.sku?.toLowerCase().includes(busca.toLowerCase()) ||
    i.codigo_barras?.toLowerCase().includes(busca.toLowerCase())
  ).slice(0, 5);

  const selecionarItem = (item) => {
    setItemSelecionado(item);
    setBusca('');
    setShowSugestoes(false);
  };

  const receberAvulso = async () => {
    if (!itemSelecionado || !quantidade) {
      setMensagem({ tipo: 'erro', texto: 'Selecione um item e informe a quantidade' });
      return;
    }

    try {
      const response = await apiService.post('/estoque/movimentacoes/recebimento', {
        item_consumo_id: itemSelecionado.id,
        quantidade: parseFloat(quantidade),
        fornecedor_id: fornecedor_id || null,
        numero_nota_fiscal: numero_nota_fiscal || null,
        lote: lote || null,
        validade: validade || null,
        observacao: observacao || null
      });

      setMensagem({ tipo: 'sucesso', texto: `✅ Recebimento ${response.numero_recebimento} registrado!` });
      setModalAvulso(false);
      setBusca('');
      setItemSelecionado(null);
      setQuantidade('');
      setFornecedorId('');
      setLote('');
      setValidade('');
      setNumeroNotaFiscal('');
      setObservacao('');
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: '❌ Erro ao receber: ' + err.message });
    }
  };

  if (loading) return <div style={{ padding: 20, color: C.muted }}>Carregando...</div>;

  return (
    <div style={{ padding: '22px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em' }}>ESTOQUE</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Recebimento de Material</div>
        </div>
        <button onClick={() => setModalAvulso(true)} style={{ ...s.btn(false), padding: '9px 18px', fontSize: 12 }}>
          📥 Receber Item Avulso
        </button>
      </div>

      {mensagem && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 16,
          background: mensagem.tipo === 'sucesso' ? '#0f2f1a' : '#3f0f0f',
          border: `1px solid ${mensagem.tipo === 'sucesso' ? C.success : C.danger}`,
          color: mensagem.tipo === 'sucesso' ? C.success : C.danger,
          fontSize: 13
        }}>
          {mensagem.texto}
        </div>
      )}

      {/* ORDENS DE VENDA ABERTAS */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em', marginBottom: 12 }}>
          📦 ORDENS DE VENDA ABERTAS
        </div>

        <input
          type="text"
          placeholder="🔍 Buscar por item, SKU ou número da OV..."
          value={buscaOV}
          onChange={(e) => setBuscaOV(e.target.value)}
          style={{ ...s.input, marginBottom: 12 }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ordensVendaAbertas.map(ov => {
            const itens = ov.itens || [];
            const matchBusca = !buscaOV || 
              ov.numero.toLowerCase().includes(buscaOV.toLowerCase()) ||
              itens.some(i => (i.item_nome || '').toLowerCase().includes(buscaOV.toLowerCase()) || 
                                (i.codigo || '').toLowerCase().includes(buscaOV.toLowerCase()));
            
            if (!matchBusca) return null;

            return (
              <div
                key={ov.id}
                onClick={() => carregarItensOV(ov.id)}
                style={{
                  ...s.card,
                  padding: '14px 18px',
                  cursor: 'pointer',
                  border: `1px solid ${ordemVendaSel?.id === ov.id ? C.accent : C.border}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>
                      {ov.numero}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted }}>
                      {ov.fornecedor_nome} · {itens.length} itens
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ ...s.tag(ov.status === 'parcial_recebido' ? C.warn : C.success), fontSize: 10 }}>
                      {ov.status === 'parcial_recebido' ? 'Parcialmente recebido' : 'Aguardando recebimento'}
                    </span>
                    <span style={{ fontSize: 16, color: C.muted }}>→</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ITENS DA OV SELECIONADA */}
      {ordemVendaSel && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em' }}>
              📋 ITENS DA OV {ordemVendaSel.numero}
            </div>
            <button onClick={() => { setOrdemVendaSel(null); setItensOV([]); }} style={{ ...s.btn(false), padding: '6px 12px', fontSize: 11 }}>
              ← Voltar
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {itensOV.map(item => (
              <div key={item.id} style={{ ...s.card, padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.item_nome}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      Qtd: {item.quantidade} · {item.sku || 'Sem SKU'}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      Recebido: {item.quantidade_recebida || 0} / {item.quantidade}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {/* BOTÃO MIRO */}
                    <button
                      onClick={() => abrirConferenciaFiscal(item)}
                      style={{
                        ...s.btn(true, item.status_quarentena === 'rejeitado' ? C.danger : C.accent),
                        padding: '8px 14px',
                        fontSize: 11,
                        opacity: item.miro_por ? 0.6 : 1,
                        cursor: item.miro_por ? 'default' : 'pointer'
                      }}
                    >
                      {item.miro_por ? `✅ ${item.numero_recebimento_miro || 'Fiscal'}` : '📄 1. Fiscal'}
                    </button>
                    
                    {/* BOTÃO MIGO */}
                    <button
                      onClick={() => {
                        if (item.miro_por) {
                          abrirConferenciaFisica(item);
                        } else {
                          alert('⚠️ Conclua a conferência fiscal primeiro!');
                        }
                      }}
                      style={{
                        ...s.btn(true, C.warn),
                        padding: '8px 14px',
                        fontSize: 11,
                        opacity: item.miro_por ? 1 : 0.5,
                        cursor: item.miro_por ? 'pointer' : 'not-allowed'
                      }}
                    >
                      {item.migo_por ? '✅ Física' : '📦 2. Física'}
                    </button>
                    
                    {/* BOTÃO ENTRADA */}
                    <button
                      onClick={() => {
                        if (item.miro_por && item.migo_por) {
                          entrarItemEstoque(item);
                        } else {
                          alert('⚠️ Conclua as conferências fiscal e física primeiro!');
                        }
                      }}
                      style={{
                        ...s.btn(true, C.success),
                        padding: '8px 14px',
                        fontSize: 11,
                        opacity: (item.miro_por && item.migo_por) ? 1 : 0.5,
                        cursor: (item.miro_por && item.migo_por) ? 'pointer' : 'not-allowed'
                      }}
                    >
                      {item.entrada_por ? '✅ Entrada' : '✅ 3. Entrada'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: CONFERÊNCIA FISCAL (MIRO) */}
      {itemConferenciaFiscal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ ...s.card, width: 560, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                📄 Conferência Fiscal — {itemConferenciaFiscal.item_nome}
              </div>
              <button onClick={() => setItemConferenciaFiscal(null)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
              {itemConferenciaFiscal.numero_recebimento_miro && (
                <div style={{ marginBottom: 16, background: '#0f2f1a', border: '1px solid #22c55e44', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>NÚMERO DO RECEBIMENTO</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>{itemConferenciaFiscal.numero_recebimento_miro}</div>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{itemConferenciaFiscal.item_nome}</div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  SKU: {itemConferenciaFiscal.sku || '—'} · Qtd: {itemConferenciaFiscal.quantidade} {itemConferenciaFiscal.unidade_medida || 'UN'}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>FORNECEDOR (AUTOMÁTICO)</label>
                <input type="text" value={ordemVendaSel?.fornecedor_nome || '—'} readOnly style={{ ...s.input, background: C.bg, color: C.muted }} />
              </div>

              {itemConferenciaFiscal.numero_recebimento_miro ? (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <label style={s.label}>NÚMERO DA NOTA FISCAL</label>
                    <input type="text" value={itemConferenciaFiscal.numero_nota_fiscal || ''} readOnly style={{ ...s.input, background: C.bg, color: C.muted }} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={s.label}>VALOR DA NF (R$)</label>
                    <input type="number" value={itemConferenciaFiscal.valor_nf || ''} readOnly style={{ ...s.input, background: C.bg, color: C.muted }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={s.label}>QUANTIDADE NA NF</label>
                      <input type="number" value={itemConferenciaFiscal.quantidade_nf || ''} readOnly style={{ ...s.input, background: C.bg, color: C.muted }} />
                    </div>
                    <div>
                      <label style={s.label}>IMPOSTOS (R$)</label>
                      <input type="number" value={itemConferenciaFiscal.impostos || ''} readOnly style={{ ...s.input, background: C.bg, color: C.muted }} />
                    </div>
                    <div>
                      <label style={s.label}>UNIDADE DE MEDIDA</label>
                      <input type="text" value={itemConferenciaFiscal.unidade_medida || 'UN'} readOnly style={{ ...s.input, background: C.bg, color: C.muted }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={s.label}>DATA DE VENCIMENTO DO PAGAMENTO</label>
                    <input type="date" value={itemConferenciaFiscal.data_vencimento_pagamento || ''} readOnly style={{ ...s.input, background: C.bg, color: C.muted }} />
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <label style={s.label}>NÚMERO DA NOTA FISCAL</label>
                    <input type="text" value={itemConferenciaFiscal.numero_nota_fiscal || ''} onChange={(e) => setItemConferenciaFiscal({ ...itemConferenciaFiscal, numero_nota_fiscal: e.target.value })} placeholder="Ex: 12345" style={s.input} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={s.label}>VALOR DA NF (R$)</label>
                    <input type="number" step="0.01" value={itemConferenciaFiscal.valor_nf || ''} onChange={(e) => setItemConferenciaFiscal({ ...itemConferenciaFiscal, valor_nf: e.target.value })} onWheel={(e) => e.target.blur()} placeholder="Ex: 85.00" style={s.input} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={s.label}>QUANTIDADE NA NF</label>
                      <input type="number" value={itemConferenciaFiscal.quantidade_nf || ''} onChange={(e) => setItemConferenciaFiscal({ ...itemConferenciaFiscal, quantidade_nf: e.target.value })} onWheel={(e) => e.target.blur()} placeholder="Ex: 2" style={s.input} />
                    </div>
                    <div>
                      <label style={s.label}>IMPOSTOS (R$)</label>
                      <input type="number" step="0.01" value={itemConferenciaFiscal.impostos || ''} onChange={(e) => setItemConferenciaFiscal({ ...itemConferenciaFiscal, impostos: e.target.value })} onWheel={(e) => e.target.blur()} placeholder="Ex: 15.00" style={s.input} />
                    </div>
                    <div>
                      <label style={s.label}>UNIDADE DE MEDIDA</label>
                      <select value={itemConferenciaFiscal.unidade_medida || 'UN'} onChange={(e) => setItemConferenciaFiscal({ ...itemConferenciaFiscal, unidade_medida: e.target.value })} style={{ ...s.input, appearance: 'none' }}>
                        <option value="UN">UN (Unidade)</option>
                        <option value="L">L (Litro)</option>
                        <option value="KG">KG (Quilograma)</option>
                        <option value="M">M (Metro)</option>
                        <option value="CX">CX (Caixa)</option>
                        <option value="RL">RL (Rolo)</option>
                        <option value="GL">GL (Galão)</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={s.label}>DATA DE VENCIMENTO DO PAGAMENTO</label>
                    <input type="date" value={itemConferenciaFiscal.data_vencimento_pagamento || ''} onChange={(e) => setItemConferenciaFiscal({ ...itemConferenciaFiscal, data_vencimento_pagamento: e.target.value })} style={s.input} />
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid ${C.border}` }}>
              <button
                onClick={() => {
                  if (window.confirm('Deseja colocar este item em QUARENTENA?')) {
                    handleSalvarConferenciaFiscal('rejeitado');
                  }
                }}
                style={{ ...s.btn(true, C.danger), flex: 1, opacity: itemConferenciaFiscal.numero_recebimento_miro ? 0.5 : 1, cursor: itemConferenciaFiscal.numero_recebimento_miro ? 'default' : 'pointer' }}
              >
                🚫 Quarentena
              </button>
              <button onClick={() => setItemConferenciaFiscal(null)} style={{ ...s.btn(false), flex: 1 }}>Cancelar</button>
              <button onClick={() => handleSalvarConferenciaFiscal('aprovado')} style={{ ...s.btn(true, C.success), flex: 1, opacity: itemConferenciaFiscal.numero_recebimento_miro ? 0.5 : 1 }}>
                ✅ Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFERÊNCIA FÍSICA (MIGO - CEGA) */}
      {itemConferenciaFisica && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ ...s.card, width: 520, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                📦 Conferência Física — {itemConferenciaFisica.item_nome}
              </div>
              <button onClick={() => setItemConferenciaFisica(null)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{itemConferenciaFisica.item_nome}</div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  SKU: {itemConferenciaFisica.sku || '—'}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>QUANTIDADE FÍSICA (CEGA)</label>
                <input type="number" value={itemConferenciaFisica.quantidade_fisica || ''} onChange={(e) => setItemConferenciaFisica({ ...itemConferenciaFisica, quantidade_fisica: e.target.value })} onWheel={(e) => e.target.blur()} placeholder="Digite o que chegou..." style={s.input} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>UNIDADE DE MEDIDA</label>
                <select value={itemConferenciaFisica.unidade_medida || 'UN'} onChange={(e) => setItemConferenciaFisica({ ...itemConferenciaFisica, unidade_medida: e.target.value })} style={{ ...s.input, appearance: 'none' }}>
                  <option value="UN">UN (Unidade)</option>
                  <option value="L">L (Litro)</option>
                  <option value="KG">KG (Quilograma)</option>
                  <option value="M">M (Metro)</option>
                  <option value="CX">CX (Caixa)</option>
                  <option value="RL">RL (Rolo)</option>
                  <option value="GL">GL (Galão)</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>LOTE</label>
                <input type="text" value={itemConferenciaFisica.lote || ''} onChange={(e) => setItemConferenciaFisica({ ...itemConferenciaFisica, lote: e.target.value })} placeholder="Ex: L2024-08" style={s.input} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>VALIDADE</label>
                <input type="date" value={itemConferenciaFisica.validade || ''} onChange={(e) => setItemConferenciaFisica({ ...itemConferenciaFisica, validade: e.target.value })} style={s.input} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>NÚMERO DE SÉRIE (OPCIONAL)</label>
                <input type="text" value={itemConferenciaFisica.numero_serie || ''} onChange={(e) => setItemConferenciaFisica({ ...itemConferenciaFisica, numero_serie: e.target.value })} placeholder="Ex: SN-12345" style={s.input} />
              </div>

              <div style={{ marginBottom: 16, background: '#0f2f1a', border: '1px solid #22c55e44', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#22c55e', marginBottom: 8 }}>
                  🕵️ VALIDAÇÃO CEGA
                </div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>
                  <span style={{ color: '#d1d5db', fontWeight: 600 }}>Você digitou:</span> {itemConferenciaFisica.quantidade_fisica || '—'} unidades
                  <br />
                  <span style={{ color: '#6b7280' }}>O sistema vai validar quando você salvar.</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid ${C.border}` }}>
              <button
                onClick={() => {
                  if (window.confirm('Deseja colocar este item em QUARENTENA?')) {
                    handleSalvarConferenciaFisica('rejeitado');
                  }
                }}
                style={{ ...s.btn(true, C.danger), flex: 1, opacity: itemConferenciaFisica.numero_recebimento_migo ? 0.5 : 1, cursor: itemConferenciaFisica.numero_recebimento_migo ? 'default' : 'pointer' }}
              >
                🚫 Quarentena
              </button>
              <button onClick={() => setItemConferenciaFisica(null)} style={{ ...s.btn(false), flex: 1 }}>Cancelar</button>
              <button onClick={() => handleSalvarConferenciaFisica('aprovado')} style={{ ...s.btn(true, C.warn), flex: 1, opacity: itemConferenciaFisica.numero_recebimento_migo ? 0.5 : 1 }}>
                ✅ Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RECEBER ITEM AVULSO */}
      {modalAvulso && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ ...s.card, width: 520, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Receber Item Avulso</div>
              <button onClick={() => setModalAvulso(false)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
              <div style={{ marginBottom: 16, position: 'relative' }} ref={inputRef}>
                <label style={s.label}>ITEM *</label>
                <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} onFocus={() => { if (sugestoes.length > 0) setShowSugestoes(true); }} placeholder="Digite o nome, SKU ou EAN do item..." style={s.input} autoComplete="off" />
                {showSugestoes && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, zIndex: 100, maxHeight: 200, overflowY: 'auto', marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                    {sugestoes.map(item => (
                      <div key={item.id} onClick={() => selecionarItem(item)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.border}22`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 13, color: C.text }}>{item.nome}</div>
                          <div style={{ fontSize: 10, color: C.muted }}>SKU: {item.sku || '—'} · EAN: {item.codigo_barras || '—'} · Local: {item.localizacao || '—'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{item.saldo_atual || 0} {item.unidade_medida || 'UN'}</div>
                          <div style={{ fontSize: 9, color: C.muted }}>disponível</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {itemSelecionado && (
                <div style={{ background: C.bg, borderRadius: 6, padding: '12px 16px', marginBottom: 16, border: `1px solid ${C.accent}44` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{itemSelecionado.nome}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>SKU: {itemSelecionado.sku || '—'} · EAN: {itemSelecionado.codigo_barras || '—'} · Local: {itemSelecionado.localizacao || '—'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{itemSelecionado.saldo_atual || 0}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{itemSelecionado.unidade_medida || 'UN'} disponível</div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>QUANTIDADE *</label>
                <input type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="Ex: 10" style={s.input} min="0.01" step="0.01" disabled={!itemSelecionado} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={s.label}>FORNECEDOR</label>
                  <select value={fornecedor_id} onChange={(e) => setFornecedorId(e.target.value)} style={{...s.input, appearance: 'none'}} disabled={!itemSelecionado}>
                    <option value="">— Sem fornecedor —</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>LOTE</label>
                  <input value={lote} onChange={(e) => setLote(e.target.value)} placeholder="Ex: L2024-08" style={s.input} disabled={!itemSelecionado}/>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={s.label}>VALIDADE</label>
                  <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} style={s.input} disabled={!itemSelecionado}/>
                </div>
                <div>
                  <label style={s.label}>NÚMERO DA NOTA FISCAL</label>
                  <input value={numero_nota_fiscal} onChange={(e) => setNumeroNotaFiscal(e.target.value)} placeholder="Ex: 12345" style={s.input} disabled={!itemSelecionado}/>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>OBSERVAÇÃO</label>
                <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex: Compra efetuada via cotação CHAM-2026-0001" style={s.input} disabled={!itemSelecionado}/>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => setModalAvulso(false)} style={{ ...s.btn(false), flex: 1 }}>Cancelar</button>
              <button onClick={receberAvulso} disabled={!itemSelecionado || !quantidade} style={{ ...s.btn(true), flex: 1 }}>
                📥 Receber
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}