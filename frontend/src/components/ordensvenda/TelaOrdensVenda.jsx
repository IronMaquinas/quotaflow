import { useState, useEffect } from 'react';
import { useOrdensVenda } from '../../hooks/useOrdensVenda';

export default function TelaOrdensVenda({ fmtBRL, fmtD, C, s }) {
  const { ordens, loading, erro, listar, buscarPorId, atualizarStatus } = useOrdensVenda();
  const [selected, setSelected] = useState(null);
  const [detalhes, setDetalhes] = useState(null);

  useEffect(() => {
  const token = localStorage.getItem('access_token');
  if (token) {
    listar();
  } else {
    console.log('⏳ Aguardando token para carregar OVs...');
  }
}, []);

useEffect(() => {
  console.log('📦 Ordens recebidas (detalhado):', JSON.stringify(ordens, null, 2));
}, [ordens]);

  const handleAbrirDetalhes = async (id) => {
    const data = await buscarPorId(id);
    setDetalhes(data);
    setSelected(id);
  };

  const handleStatusChange = async (id, novoStatus) => {
    if (!window.confirm(`Alterar status para "${novoStatus}"?`)) return;
    try {
      await atualizarStatus(id, novoStatus);
      await listar(); // recarregar a lista
      if (selected === id) {
        const data = await buscarPorId(id);
        setDetalhes(data);
      }
    } catch (err) {
      alert('Erro ao atualizar status: ' + err.message);
    }
  };

  if (loading) return <div style={{ padding: '22px 24px', textAlign: 'center' }}>Carregando ordens...</div>;
  if (erro) return <div style={{ padding: '22px 24px', color: '#ef4444' }}>Erro: {erro}</div>;

  return (
    <div style={{ padding: '22px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em' }}>ORDENS DE VENDA</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>Ordens de Venda</div>
        </div>
      </div>

      {!selected && (
        <div style={{ ...s.card, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '150px 2fr 1fr 1fr 1fr 120px', padding: '12px 18px', background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, letterSpacing: '0.08em' }}>
            <span>NÚMERO</span><span>FORNECEDOR</span><span>VALOR TOTAL</span><span>PRAZO</span><span>DATA</span><span>STATUS</span>
          </div>
          {ordens.map(ov => (
            <div key={ov.id} onClick={() => handleAbrirDetalhes(ov.id)} style={{ display: 'grid', gridTemplateColumns: '150px 2fr 1fr 1fr 1fr 120px', padding: '12px 18px', borderBottom: `1px solid ${C.border}22`, cursor: 'pointer', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1a2233'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.accent }}>{ov.numero}</span>
              <span>{ov.fornecedor_nome}</span>
              <span style={{ fontWeight: 600 }}>{fmtBRL(ov.valor_total)}</span>
              <span>{ov.prazo_entrega}d</span>
              <span>{fmtD(ov.criado_em)}</span>
              <span style={{ ...s.tag(ov.status === 'pendente' ? C.warn : ov.status === 'aprovada' ? C.success : '#ef4444') }}>
                {ov.status}
              </span>
            </div>
          ))}
          {ordens.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Nenhuma ordem de venda ainda.</div>}
        </div>
      )}

      {selected && detalhes && (
        <div>
          <button onClick={() => { setSelected(null); setDetalhes(null); }} style={{ ...s.btn(false, C.muted), padding: '8px 16px', marginBottom: 16 }}>
            ← Voltar
          </button>
          <div style={{ ...s.card, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: C.muted }}>ORDEM DE VENDA</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: C.accent }}>{detalhes.numero}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: C.muted }}>STATUS</div>
                <span style={{ ...s.tag(detalhes.status === 'pendente' ? C.warn : C.success) }}>{detalhes.status}</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div><span style={{ color: C.muted }}>Fornecedor:</span> {detalhes.fornecedor_nome}</div>
              <div><span style={{ color: C.muted }}>Cotação:</span> {detalhes.cotacao_numero || detalhes.cotacao_id}</div>
              <div><span style={{ color: C.muted }}>Criado por:</span> {detalhes.criado_por_nome}</div>
              <div><span style={{ color: C.muted }}>Aprovado por:</span> {detalhes.aprovado_por_nome}</div>            </div>
              <div><span style={{ color: C.muted }}>Data de emissão:</span> {new Date(detalhes.criado_em).toLocaleDateString('pt-BR')} às {new Date(detalhes.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8 }}>ITENS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '8px 12px', background: C.bg, borderRadius: 6, borderBottom: `1px solid ${C.border}`, fontSize: 11 }}>
                <span>ITEM</span><span>QTD</span><span>VALOR UNIT.</span><span>TOTAL</span>
              </div>
              {detalhes.itens.map(item => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '8px 12px', borderBottom: `1px solid ${C.border}22` }}>
                  <span>{item.nome_original || item.nome_item}</span>
                  <span>{item.quantidade}</span>
                  <span>{fmtBRL(item.valor_unitario)}</span>
                  <span>{fmtBRL(item.valor_total)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: C.muted, textAlign: 'right' }}>VALOR TOTAL</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.success }}>{fmtBRL(detalhes.valor_total)}</div>
                  {detalhes.valor_frete > 0 && <div style={{ fontSize: 12, color: C.muted }}>Frete: {fmtBRL(detalhes.valor_frete)}</div>}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
              <select onChange={(e) => handleStatusChange(detalhes.id, e.target.value)} value={detalhes.status} style={{ ...s.input, width: 'auto' }}>
                <option value="pendente">Pendente</option>
                <option value="aprovada">Aprovada</option>
                <option value="rejeitada">Rejeitada</option>
                <option value="faturada">Faturada</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}