import { useState, useEffect } from 'react';
import apiService from '../../services/apiService';

export default function TelaCatalogoFornecedor({ fornecedorId, C, s, fmtBRL }) {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ item_catalogo_id: '', preco_unitario: '', estoque_status: 'disponivel' });
  const [catalogoDisponivel, setCatalogoDisponivel] = useState([]);

  // Carregar itens do fornecedor
  useEffect(() => {
    carregarItens();
    carregarCatalogo();
  }, []);

  const carregarItens = async () => {
    try {
      const data = await apiService.get(`/fornecedor/catalogo`);
      setItens(data || []);
    } catch (err) {
      console.error('Erro ao carregar catálogo:', err);
    } finally {
      setLoading(false);
    }
  };

  const carregarCatalogo = async () => {
    try {
      const data = await apiService.get('/catalogo');
      setCatalogoDisponivel(data || []);
    } catch (err) {
      console.error('Erro ao carregar catálogo global:', err);
    }
  };

  const adicionarItem = async () => {
    if (!form.item_catalogo_id || !form.preco_unitario) {
      alert('Selecione um item e informe o preço');
      return;
    }

    try {
      await apiService.post('/fornecedor/catalogo', {
        item_catalogo_id: form.item_catalogo_id,
        preco_unitario: parseFloat(form.preco_unitario),
        estoque_status: form.estoque_status
      });
      setModal(null);
      setForm({ item_catalogo_id: '', preco_unitario: '', estoque_status: 'disponivel' });
      carregarItens();
    } catch (err) {
      alert('Erro ao adicionar item: ' + err.message);
    }
  };

  const removerItem = async (id) => {
    if (!confirm('Remover este item do catálogo?')) return;
    try {
      await apiService.delete(`/fornecedor/catalogo/${id}`);
      carregarItens();
    } catch (err) {
      alert('Erro ao remover: ' + err.message);
    }
  };

  const itensFiltrados = itens.filter(i =>
    i.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    i.codigo?.toLowerCase().includes(busca.toLowerCase())
  );

  if (loading) return <div style={{ color: C.muted, padding: 20 }}>Carregando catálogo...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text }}>📦 Meu Catálogo de Produtos</h3>
        <button onClick={() => setModal('novo')} style={{ ...s.btn(true), padding: '8px 16px', fontSize: 12 }}>
          + Adicionar Produto
        </button>
      </div>

      <input
        type="text"
        placeholder="Buscar por nome ou código..."
        value={busca}
        onChange={e => setBusca(e.target.value)}
        style={{ ...s.input, marginBottom: 16 }}
      />

      {itensFiltrados.length === 0 && (
        <div style={{ ...s.card, padding: 40, textAlign: 'center', color: C.muted }}>
          Nenhum produto cadastrado no seu catálogo.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {itensFiltrados.map(item => (
          <div key={item.id} style={{ ...s.card, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, color: C.text }}>{item.nome}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{item.codigo} · {item.categoria}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.success }}>{fmtBRL(item.preco_unitario)}</span>
              <span style={{ ...s.tag(item.estoque_status === 'disponivel' ? C.success : C.warn), fontSize: 10 }}>
                {item.estoque_status}
              </span>
              <button onClick={() => removerItem(item.id)} style={{ background: 'transparent', border: 'none', color: C.danger, cursor: 'pointer' }}>✕</button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL - Adicionar produto */}
      {modal === 'novo' && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ ...s.card, width: 480, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Adicionar Produto</div>
            </div>
            <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
              <div style={{ marginBottom: 12 }}>
                <label style={s.label}>PRODUTO *</label>
                <select
                  value={form.item_catalogo_id}
                  onChange={e => setForm(f => ({ ...f, item_catalogo_id: e.target.value }))}
                  style={{ ...s.input, appearance: 'none' }}
                >
                  <option value="">Selecione um produto</option>
                  {catalogoDisponivel.map(item => (
                    <option key={item.id} value={item.id}>{item.nome} - {item.codigo}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={s.label}>PREÇO UNITÁRIO (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.preco_unitario}
                  onChange={e => setForm(f => ({ ...f, preco_unitario: e.target.value }))}
                  placeholder="0,00"
                  style={s.input}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={s.label}>ESTOQUE</label>
                <select
                  value={form.estoque_status}
                  onChange={e => setForm(f => ({ ...f, estoque_status: e.target.value }))}
                  style={{ ...s.input, appearance: 'none' }}
                >
                  <option value="disponivel">Disponível</option>
                  <option value="sob_consulta">Sob consulta</option>
                  <option value="indisponivel">Indisponível</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => setModal(null)} style={{ ...s.btn(false), flex: 1 }}>Cancelar</button>
              <button onClick={adicionarItem} style={{ ...s.btn(true), flex: 1 }}>Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}