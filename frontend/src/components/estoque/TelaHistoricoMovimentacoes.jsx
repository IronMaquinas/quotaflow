// components/estoque/TelaHistoricoMovimentacoes.jsx
import { useState, useEffect } from 'react';
import apiService from '../../services/apiService';

export default function TelaHistoricoMovimentacoes({ C, s, fmtD, fmtBRL }) {
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    carregarMovimentacoes();
  }, []);

  const carregarMovimentacoes = async () => {
    try {
      const data = await apiService.get('/estoque/movimentacoes');
      setMovimentacoes(data || []);
    } catch (err) {
      console.error('Erro ao carregar movimentações:', err);
    } finally {
      setLoading(false);
    }
  };

  const movimentacoesFiltradas = movimentacoes
    .filter(m => filtroTipo === 'todos' || m.tipo === filtroTipo)
    .filter(m => !busca || 
      m.item_nome?.toLowerCase().includes(busca.toLowerCase()) ||
      m.observacao?.toLowerCase().includes(busca.toLowerCase()) ||
      m.numero_solicitacao?.toLowerCase().includes(busca.toLowerCase()) // 🔥 Busca por número
    );

  const getTipoConfig = (tipo) => {
    if (tipo === 'entrada') return { label: '✅ Entrada', color: C.success };
    if (tipo === 'saida') return { label: '📤 Saída', color: C.danger };
    return { label: '🔧 Ajuste', color: C.warn };
  };

  if (loading) return <div style={{ padding: 20, color: C.muted }}>Carregando...</div>;

  return (
    <div style={{ padding: '22px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em' }}>ESTOQUE</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Histórico de Movimentações</div>
        </div>
        <button onClick={carregarMovimentacoes} style={{ ...s.btn(false), padding: '8px 14px', fontSize: 12 }}>
          🔄 Atualizar
        </button>
      </div>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar por item, observação ou Nº solicitação..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ ...s.input, flex: 1, minWidth: 200, padding: '8px 12px', fontSize: 12 }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {['todos', 'entrada', 'saida', 'ajuste'].map(t => (
            <button
              key={t}
              onClick={() => setFiltroTipo(t)}
              style={{
                background: filtroTipo === t ? C.accent : 'transparent',
                border: `1px solid ${filtroTipo === t ? C.accent : C.border}`,
                borderRadius: 6,
                padding: '6px 14px',
                color: filtroTipo === t ? 'white' : C.muted,
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t === 'todos' ? 'Todos' : t === 'entrada' ? '✅ Entrada' : t === 'saida' ? '📤 Saída' : '🔧 Ajuste'}
            </button>
          ))}
        </div>
      </div>

      {/* TABELA */}
      <div style={{ ...s.card, overflow: 'hidden' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1.5fr 1fr 1.5fr 1.5fr 1.5fr 1fr', 
          padding: '10px 18px', 
          background: C.bg, 
          borderBottom: `1px solid ${C.border}`, 
          fontSize: 10, 
          color: C.muted, 
          letterSpacing: '0.08em' 
        }}>
          <span>Nº SOLICITAÇÃO</span>
          <span>ITEM</span>
          <span>QUANTIDADE</span>
          <span>TIPO</span>
          <span>RESPONSÁVEL</span>
          <span>DATA</span>
        </div>
        {movimentacoesFiltradas.map((m, i) => {
          const tipoCfg = getTipoConfig(m.tipo);
          return (
            <div 
              key={m.id} 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: '1.5fr 1fr 1.5fr 1.5fr 1.5fr 1fr', 
                padding: '11px 18px', 
                borderBottom: i < movimentacoesFiltradas.length - 1 ? `1px solid ${C.border}22` : 'none',
                alignItems: 'center',
                background: m.tipo === 'saida' ? '#0f0f0f' : 'transparent'
              }}
            >
              <div style={{ fontSize: 12, color: C.accent, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600 }}>
                {m.numero_solicitacao || '—'}
              </div>
              <div>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{m.item_nome}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{m.sku || '—'}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: m.tipo === 'saida' ? C.danger : C.success }}>
                {m.quantidade} {m.unidade_medida || 'UN'}
              </div>
              <div>
                <span style={{ ...s.tag(tipoCfg.color), fontSize: 10 }}>
                  {tipoCfg.label}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.textSub }}>
                {m.responsavel_nome || '—'}
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {fmtD(m.criado_em)}
              </div>
            </div>
          );
        })}
        {movimentacoesFiltradas.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
            Nenhuma movimentação encontrada
          </div>
        )}
      </div>
    </div>
  );
}