// components/estoque/TelaEstoqueConsumiveis.jsx
import { useState, useEffect } from 'react';
import apiService from '../../services/apiService';

export default function TelaEstoqueConsumiveis({ C, s, fmtBRL, fmtD }) {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [modal, setModal] = useState(null);
  const [modalConfig, setModalConfig] = useState(false);
  const [config, setConfig] = useState({ fluxo_aprovacao: false, notificar_recompra: true });
  const [form, setForm] = useState({
    nome: '',
    sku: '',
    numero_serie: '',
    unidade_medida: 'UN',
    saldo_atual: 0,
    limite_inferior_controle: '',
    limite_recompra: '',
    lote_minimo_compra: '',
    quantidade_lotes_automatico: 1,
    fornecedor_preferencial_id: '',
    localizacao: ''
  });

  // ─── CARREGAR ITENS ──────────────────────────────────────────
  const carregarItens = async () => {
    try {
      const data = await apiService.get('/estoque/itens');
      setItens(data || []);
    } catch (err) {
      console.error('Erro ao carregar itens:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── CARREGAR CONFIGURAÇÕES ─────────────────────────────────
  const carregarConfig = async () => {
    try {
      const data = await apiService.get('/estoque/configuracoes');
      setConfig(data);
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
    }
  };

  useEffect(() => {
    carregarItens();
    carregarConfig();
  }, []);

  // ─── SALVAR CONFIGURAÇÕES ───────────────────────────────────
const salvarConfig = async () => {
  try {
    await apiService.put('/estoque/configuracoes', {
      fluxo_aprovacao: config.fluxo_aprovacao,
      notificar_recompra: config.notificar_recompra
    });
    
    // 🔥 RECARREGA A CONFIGURAÇÃO DO BANCO PARA GARANTIR QUE O ESTADO ESTÁ SINCRONIZADO
    const data = await apiService.get('/estoque/configuracoes');
    setConfig(data);
    
    setModalConfig(false);
    alert('Configurações salvas!');
  } catch (err) {
    alert('Erro ao salvar configurações: ' + err.message);
  }
};

  // ─── SALVAR ITEM ─────────────────────────────────────────────
  const salvarItem = async () => {
    if (!form.nome) {
      alert('Nome é obrigatório');
      return;
    }

    try {
      if (modal === 'novo') {
        await apiService.post('/estoque/itens', form);
      } else {
        await apiService.put(`/estoque/itens/${modal}`, form);
      }
      setModal(null);
      setForm({
        nome: '',
        sku: '',
        numero_serie: '',
        unidade_medida: 'UN',
        saldo_atual: 0,
        limite_inferior_controle: '',
        limite_recompra: '',
        lote_minimo_compra: '',
        quantidade_lotes_automatico: 1,
        fornecedor_preferencial_id: '',
        localizacao: ''
      });
      carregarItens();
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    }
  };

  const abrirEditar = (item) => {
    setForm({
      nome: item.nome || '',
      sku: item.sku || '',
      numero_serie: item.numero_serie || '',
      unidade_medida: item.unidade_medida || 'UN',
      saldo_atual: item.saldo_atual || 0,
      limite_inferior_controle: item.limite_inferior_controle || '',
      limite_recompra: item.limite_recompra || '',
      lote_minimo_compra: item.lote_minimo_compra || '',
      quantidade_lotes_automatico: item.quantidade_lotes_automatico || 1,
      fornecedor_preferencial_id: item.fornecedor_preferencial_id || '',
      localizacao: item.localizacao || ''
    });
    setModal(item.id);
  };

  const deletarItem = async (id) => {
    if (!confirm('Tem certeza?')) return;
    try {
      await apiService.delete(`/estoque/itens/${id}`);
      carregarItens();
    } catch (err) {
      alert('Erro ao deletar: ' + err.message);
    }
  };

  const getStatus = (item) => {
    const saldo = item.saldo_atual || 0;
    const limite = item.limite_recompra;
    const controle = item.limite_inferior_controle;

    if (!limite && !controle) return { label: 'Sem limite', color: C.muted };
    if (limite && saldo < limite) return { label: '⚠️ CRÍTICO', color: C.danger };
    if (controle && saldo < controle) return { label: '🟡 ATENÇÃO', color: C.warn };
    return { label: '✅ OK', color: C.success };
  };

  const itensFiltrados = itens.filter(item => {
    const matchBusca = !busca || 
      item.nome.toLowerCase().includes(busca.toLowerCase()) ||
      item.sku?.toLowerCase().includes(busca.toLowerCase());
    const status = getStatus(item);
    if (filtroStatus === 'critico') return matchBusca && status.color === C.danger;
    if (filtroStatus === 'atencao') return matchBusca && status.color === C.warn;
    if (filtroStatus === 'ok') return matchBusca && status.color === C.success;
    return matchBusca;
  });

  if (loading) return <div style={{ padding: 20, color: C.muted }}>Carregando...</div>;

  // ─── RENDER ──────────────────────────────────────────────────
  return (
    <div style={{ padding: '22px 24px', overflowY: 'auto', height: '100%' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em' }}>ESTOQUE</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Itens de Consumo</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setModalConfig(true)} style={{ ...s.btn(false), padding: '8px 14px', fontSize: 12 }}>
            ⚙️
          </button>
          <button onClick={() => { setModal('novo'); setForm({ ...form, nome: '', sku: '', saldo_atual: 0 }); }} style={{ ...s.btn(true), padding: '9px 18px' }}>
            + Novo Item
          </button>
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar por nome ou SKU..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ ...s.input, flex: 1, minWidth: 200, padding: '8px 12px', fontSize: 12 }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {['todos', 'critico', 'atencao', 'ok'].map(f => (
            <button
              key={f}
              onClick={() => setFiltroStatus(f)}
              style={{
                background: filtroStatus === f ? C.accent : 'transparent',
                border: `1px solid ${filtroStatus === f ? C.accent : C.border}`,
                borderRadius: 6,
                padding: '6px 14px',
                color: filtroStatus === f ? 'white' : C.muted,
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {f === 'todos' ? 'Todos' : f === 'critico' ? '⚠️ Crítico' : f === 'atencao' ? '🟡 Atenção' : '✅ OK'}
            </button>
          ))}
        </div>
      </div>

      {/* TABELA */}
      <div style={{ ...s.card, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 100px 80px', padding: '10px 18px', background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, letterSpacing: '0.08em' }}>
          <span>ITEM / SKU</span>
          <span>SALDO</span>
          <span>LIMITE RECOMPRA</span>
          <span>CONTROLE</span>
          <span>STATUS</span>
          <span></span>
        </div>
        {itensFiltrados.map((item) => {
          const status = getStatus(item);
          return (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 100px 80px', padding: '13px 18px', borderBottom: `1px solid ${C.border}22`, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{item.nome}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{item.sku || '—'}</div>
              </div>
              <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{item.saldo_atual || 0} {item.unidade_medida || 'UN'}</div>
              <div style={{ fontSize: 12, color: C.textSub }}>{item.limite_recompra || '—'}</div>
              <div style={{ fontSize: 12, color: C.textSub }}>{item.limite_inferior_controle || '—'}</div>
              <div><span style={{ ...s.tag(status.color), fontSize: 10 }}>{status.label}</span></div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => abrirEditar(item)} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 5, padding: '4px 8px', color: C.muted, fontSize: 11, cursor: 'pointer' }}>✏</button>
                <button onClick={() => deletarItem(item.id)} style={{ background: 'transparent', border: `1px solid #ef444433`, borderRadius: 5, padding: '4px 8px', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}>🗑</button>
              </div>
            </div>
          );
        })}
        {itensFiltrados.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Nenhum item cadastrado</div>}
      </div>

      {/* ─── MODAL DE CONFIGURAÇÕES ─── */}
      {modalConfig && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ ...s.card, width: 420, maxWidth: '100%' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>⚙️ Configurações</div>
              <button onClick={() => setModalConfig(false)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '20px 22px' }}>
              {/* Toggle: Fluxo de aprovação */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Fluxo de aprovação</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Exige aprovação do gestor para retiradas</div>
                </div>
                <button
                  onClick={() => setConfig(f => ({ ...f, fluxo_aprovacao: !f.fluxo_aprovacao }))}
                  style={{
                    width: 48,
                    height: 28,
                    borderRadius: 14,
                    background: config.fluxo_aprovacao ? C.success : C.border,
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background .2s',
                    border: 'none',
                    flexShrink: 0
                  }}
                >
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 3,
                    left: config.fluxo_aprovacao ? 23 : 3,
                    transition: 'left .2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }} />
                </button>
              </div>

              {/* Toggle: Notificar recompra */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Notificar recompra automática</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Envia alerta quando estoque atinge o limite</div>
                </div>
                <button
                  onClick={() => setConfig(f => ({ ...f, notificar_recompra: !f.notificar_recompra }))}
                  style={{
                    width: 48,
                    height: 28,
                    borderRadius: 14,
                    background: config.notificar_recompra ? C.success : C.border,
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background .2s',
                    border: 'none',
                    flexShrink: 0
                  }}
                >
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 3,
                    left: config.notificar_recompra ? 23 : 3,
                    transition: 'left .2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button onClick={() => setModalConfig(false)} style={{ ...s.btn(false), flex: 1 }}>Cancelar</button>
                <button onClick={salvarConfig} style={{ ...s.btn(true), flex: 1 }}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE ITEM (NOVO/EDITAR) ─── */}
      {(modal === 'novo' || modal) && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ ...s.card, width: 520, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{modal === 'novo' ? 'Novo Item' : 'Editar Item'}</div>
            </div>
            <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
              {/* ... seu formulário existente ... */}
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => setModal(null)} style={{ ...s.btn(false), flex: 1 }}>Cancelar</button>
              <button onClick={salvarItem} style={{ ...s.btn(true), flex: 1 }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}