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
    localizacao: '',
    fabricante: '',
    lote: '',
    validade: '',
    codigo_barras: '',
    ativo: true
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
      // 🔥 CORREÇÃO 1: Adicione os campos que estavam faltando
      const dadosParaSalvar = {
        ...form,
        ativo: form.ativo ? true : false, // 🔥 Envia o toggle corretamente
        saldo_atual: form.saldo_atual === '' ? 0 : parseFloat(form.saldo_atual),
        limite_inferior_controle: form.limite_inferior_controle === '' ? null : parseFloat(form.limite_inferior_controle),
        limite_recompra: form.limite_recompra === '' ? null : parseFloat(form.limite_recompra),
        lote_minimo_compra: form.lote_minimo_compra === '' ? null : parseFloat(form.lote_minimo_compra),
        quantidade_lotes_automatico: form.quantidade_lotes_automatico === '' ? null : parseInt(form.quantidade_lotes_automatico),
        fornecedor_preferencial_id: form.fornecedor_preferencial_id === '' ? null : parseInt(form.fornecedor_preferencial_id),
        codigo_barras: form.codigo_barras || null // 🔥 Envia o código de barras
      };

      if (modal === 'novo') {
        await apiService.post('/estoque/itens', dadosParaSalvar);
      } else {
        await apiService.put(`/estoque/itens/${modal}`, dadosParaSalvar);
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
        localizacao: '',
        fabricante: '',
        lote: '',
        validade: '',
        codigo_barras: '',
        ativo: true
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
      localizacao: item.localizacao || '',
      fabricante: item.fabricante || '',
      lote: item.lote || '',
      validade: item.validade || '',
      codigo_barras: item.codigo_barras || '',
      ativo: item.ativo !== false
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
              {/* CAMPOS DO FORMULÁRIO */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.label}>NOME DO ITEM *</label>
                  <input value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))} style={s.input} />
                </div>
                <div>
                  <label style={s.label}>SKU / CÓDIGO</label>
                  <input value={form.sku} onChange={e => setForm(f => ({...f, sku: e.target.value}))} style={s.input} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.label}>FABRICANTE</label>
                  <input value={form.fabricante} onChange={e => setForm(f => ({...f, fabricante: e.target.value}))} placeholder="Ex: SKF, Bosch..." style={s.input} />
                </div>
                <div>
                  <label style={s.label}>UNIDADE DE MEDIDA *</label>
                  <select value={form.unidade_medida} onChange={e => setForm(f => ({...f, unidade_medida: e.target.value}))} style={{...s.input, appearance: 'none'}}>
                    <option value="UN">UN (Unidade)</option>
                    <option value="L">L (Litro)</option>
                    <option value="KG">KG (Quilograma)</option>
                    <option value="CX">CX (Caixa)</option>
                    <option value="RL">RL (Rolo)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.label}>LOTE</label>
                  <input value={form.lote} onChange={e => setForm(f => ({...f, lote: e.target.value}))} placeholder="Ex: L2024-08" style={s.input} />
                </div>
                <div>
                  <label style={s.label}>VALIDADE</label>
                  <input type="date" value={form.validade} onChange={e => setForm(f => ({...f, validade: e.target.value}))} style={s.input} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.label}>LOCALIZAÇÃO (BIN)</label>
                  <input value={form.localizacao} onChange={e => setForm(f => ({...f, localizacao: e.target.value}))} placeholder="Ex: Prateleira A, Corredor 2" style={s.input} />
                </div>
                <div>
                  <label style={s.label}>CÓDIGO DE BARRAS (EAN)</label>
                  <input value={form.codigo_barras} onChange={e => setForm(f => ({...f, codigo_barras: e.target.value}))} placeholder="Ex: 7891234567890" style={s.input} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.label}>SALDO ATUAL</label>
                  <input type="number" value={form.saldo_atual} onChange={e => setForm(f => ({...f, saldo_atual: e.target.value}))} style={s.input} />
                </div>
                <div>
                  <label style={s.label}>LIMITE INFERIOR</label>
                  <input type="number" value={form.limite_inferior_controle} onChange={e => setForm(f => ({...f, limite_inferior_controle: e.target.value}))} style={s.input} />
                </div>
                <div>
                  <label style={s.label}>LIMITE DE RECOMPRA</label>
                  <input type="number" value={form.limite_recompra} onChange={e => setForm(f => ({...f, limite_recompra: e.target.value}))} style={s.input} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.label}>LOTE MÍNIMO DE COMPRA</label>
                  <input type="number" value={form.lote_minimo_compra} onChange={e => setForm(f => ({...f, lote_minimo_compra: e.target.value}))} style={s.input} />
                </div>
                <div>
                  <label style={s.label}>QUANTIDADE LOTES AUTO</label>
                  <input type="number" value={form.quantidade_lotes_automatico} onChange={e => setForm(f => ({...f, quantidade_lotes_automatico: e.target.value}))} style={s.input} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                <div>
                  <label style={s.label}>FORNECEDOR</label>
                  <input 
                    value={form.fornecedor_preferencial_id} 
                    onChange={e => setForm(f => ({...f, fornecedor_preferencial_id: e.target.value}))} 
                    placeholder="Ex: SKF, Bosch, Mercedes..." 
                    style={s.input} 
                  />
                </div>
              </div>

              {/* Toggle: Ativo */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Item Ativo</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Permite que este item seja usado em operações</div>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}
                  style={{
                    width: 48,
                    height: 28,
                    borderRadius: 14,
                    background: form.ativo ? C.success : C.border,
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
                    left: form.ativo ? 23 : 3,
                    transition: 'left .2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }} />
                </button>
              </div>
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