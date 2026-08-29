import { useState, useEffect } from 'react';
import apiService from '../../services/apiService';

export default function TelaCanalSpot({ C, s, fmtD }) {
  const [demandas, setDemandas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [modal, setModal] = useState(null); // 'nova' | demandaId
  const [form, setForm] = useState({
    descricao_equipamento: '',
    marca_modelo: '',
    componente: '',
    part_number: '',
    quantidade: 1,
    comentarios: '',
    urgencia: 'media'
  });

  const carregarDemandas = async () => {
    try {
      const data = await apiService.get(`/spot/demandas?status=${filtroStatus}`);
      setDemandas(data);
    } catch (err) {
      console.error('Erro ao carregar demandas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDemandas();
  }, [filtroStatus]);

  const criarDemanda = async () => {
    try {
      await apiService.post('/spot/demandas', form);
      setModal(null);
      setForm({ descricao_equipamento: '', marca_modelo: '', componente: '', part_number: '', quantidade: 1, comentarios: '', urgencia: 'media' });
      carregarDemandas();
    } catch (err) {
      alert('Erro ao criar demanda: ' + err.message);
    }
  };

  if (loading) return <div style={{ padding: 20, color: C.muted }}>Carregando...</div>;

  return (
    <div style={{ padding: '22px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em' }}>COMPRAS SPOT</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Canal Spot</div>
        </div>
        <button onClick={() => setModal('nova')} style={{ ...s.btn(true), padding: '9px 18px' }}>+ Nova Demanda Spot</button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {['todos', 'aberta', 'em_negociacao', 'encerrada'].map(st => (
          <button key={st} onClick={() => setFiltroStatus(st)}
            style={{ background: filtroStatus === st ? C.accent : 'transparent', border: `1px solid ${filtroStatus === st ? C.accent : C.border}`, borderRadius: 6, padding: '6px 14px', color: filtroStatus === st ? 'white' : C.muted, fontSize: 11, cursor: 'pointer' }}>
            {st === 'todos' ? 'Todas' : st === 'aberta' ? '🟢 Abertas' : st === 'em_negociacao' ? '🟡 Em Negociação' : '🔴 Encerradas'}
          </button>
        ))}
      </div>

      {/* Lista de demandas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {demandas.length === 0 && <div style={{ ...s.card, padding: 40, textAlign: 'center', color: C.muted }}>Nenhuma demanda spot encontrada</div>}
        {demandas.map(d => (
          <div key={d.id} onClick={() => setModal(d.id)} style={{ ...s.card, padding: '16px 20px', cursor: 'pointer', borderLeft: `4px solid ${d.status === 'aberta' ? '#22c55e' : d.status === 'em_negociacao' ? '#f59e0b' : '#ef4444'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{d.componente}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{d.descricao_equipamento}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{d.quantidade} unidade(s) · {fmtD(d.criado_em)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ ...s.tag(d.status === 'aberta' ? '#22c55e' : d.status === 'em_negociacao' ? '#f59e0b' : '#ef4444') }}>
                  {d.status === 'aberta' ? 'Aberta' : d.status === 'em_negociacao' ? 'Em Negociação' : 'Encerrada'}
                </span>
                <span style={{ fontSize: 12, color: C.accent }}>
                  💬 {d.msg_nao_lidas || 0} não lidas
                </span>
                <span style={{ fontSize: 12, color: C.muted }}>
                  {d.total_interesses || 0} interesses
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL - Nova Demanda */}
      {modal === 'nova' && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ ...s.card, width: 520, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Nova Demanda Spot</div>
              <button onClick={() => setModal(null)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
              <div style={{ marginBottom: 12 }}><label style={s.label}>Descrição do Equipamento *</label><input value={form.descricao_equipamento} onChange={e => setForm(f => ({ ...f, descricao_equipamento: e.target.value }))} style={s.input} /></div>
              <div style={{ marginBottom: 12 }}><label style={s.label}>Marca / Modelo</label><input value={form.marca_modelo} onChange={e => setForm(f => ({ ...f, marca_modelo: e.target.value }))} style={s.input} /></div>
              <div style={{ marginBottom: 12 }}><label style={s.label}>Componente *</label><input value={form.componente} onChange={e => setForm(f => ({ ...f, componente: e.target.value }))} style={s.input} autoComplete="off" name="componente_spot"/></div>
              <div style={{ marginBottom: 12 }}><label style={s.label}>Part Number</label><input value={form.part_number} onChange={e => setForm(f => ({ ...f, part_number: e.target.value }))} style={s.input} /></div>
              <div style={{ marginBottom: 12 }}><label style={s.label}>Quantidade *</label><input type="number" min="1" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: parseInt(e.target.value) || 1 }))} style={s.input} /></div>
              <div style={{ marginBottom: 12 }}><label style={s.label}>Comentários</label><textarea value={form.comentarios} onChange={e => setForm(f => ({ ...f, comentarios: e.target.value }))} rows={2} style={{ ...s.input, resize: 'none' }} /></div>
              <div style={{ marginBottom: 12 }}>
                <label style={s.label}>Urgência</label>
                <select value={form.urgencia} onChange={e => setForm(f => ({ ...f, urgencia: e.target.value }))} style={{ ...s.input, appearance: 'none' }}>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => setModal(null)} style={{ ...s.btn(false), flex: 1 }}>Cancelar</button>
              <button onClick={criarDemanda} disabled={!form.descricao_equipamento || !form.componente} style={{ ...s.btn(true), flex: 1 }}>Publicar Demanda</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}