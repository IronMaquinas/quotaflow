// components/equipamentos/TelaEquipamentos.jsx
import { useState, useEffect } from 'react';
import { useEquipamentos } from '../../hooks/useEquipamentos';

export default function TelaEquipamentos({ fmtBRL, fmtD, C, s }) {
  const { equipamentos, loading, erro, listar, criar, atualizar, deletar } = useEquipamentos();

  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    tag: '',
    nome: '',
    local: '',
    fabricante: '',
    modelo: '',
    serie: '',
  });

  useEffect(() => {
    listar();
  }, []);

  const equipamentosSeguro = equipamentos || [];

  const salvar = async () => {
    if (!form.nome || !form.tag) return;
    try {
      if (modal === 'novo') {
        await criar(form);
      } else {
        await atualizar(modal, form);
      }
      setModal(null);
      setForm({ tag: '', nome: '', local: '', fabricante: '', modelo: '', serie: '' });
      await listar();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  };

  const excluir = async (id) => {
    if (!confirm('Desativar este equipamento?')) return;
    try {
      await deletar(id);
      await listar();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  };

  const abrirEditar = (eq) => {
    setForm({
      tag: eq.tag,
      nome: eq.nome,
      local: eq.local || '',
      fabricante: eq.fabricante || '',
      modelo: eq.modelo || '',
      serie: eq.serie || '',
    });
    setModal(eq.id);
  };

  const lista = equipamentosSeguro.filter(
    (e) =>
      e.ativo !== false &&
      (e.nome.toLowerCase().includes(search.toLowerCase()) ||
        e.tag.toLowerCase().includes(search.toLowerCase()) ||
        e.local?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ padding: '22px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em', marginBottom: 4 }}>CADASTROS</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>Equipamentos</div>
        </div>
        <button
          onClick={() => {
            setForm({ tag: '', nome: '', local: '', fabricante: '', modelo: '', serie: '' });
            setModal('novo');
          }}
          style={{ ...s.btn(true), padding: '8px 18px' }}
        >
          + Novo equipamento
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nome, TAG ou localização..."
        style={{ ...s.input, marginBottom: 16 }}
      />

      {loading && <div style={{ color: C.muted, padding: 20, textAlign: 'center' }}>Carregando...</div>}
      {erro && <div style={{ color: '#ef4444', padding: 20, background: '#ef444422', borderRadius: 8, marginBottom: 16 }}>{erro}</div>}

      <div style={{ ...s.card, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '120px 2fr 1fr 1fr 1fr 80px',
            padding: '10px 18px',
            background: C.bg,
            borderBottom: `1px solid ${C.border}`,
            fontSize: 10,
            color: C.muted,
            letterSpacing: '0.08em',
          }}
        >
          <span>TAG</span>
          <span>EQUIPAMENTO</span>
          <span>LOCALIZAÇÃO</span>
          <span>FABRICANTE</span>
          <span>MODELO / SÉRIE</span>
          <span></span>
        </div>
        {lista.map((eq, i) => (
          <div
            key={eq.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 2fr 1fr 1fr 1fr 80px',
              padding: '13px 18px',
              borderBottom: i < lista.length - 1 ? `1px solid ${C.border}22` : 'none',
              alignItems: 'center',
            }}
          >
            <span
              style={{ fontSize: 11, color: C.accent, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600 }}
            >
              {eq.tag}
            </span>
            <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{eq.nome}</span>
            <span style={{ fontSize: 12, color: C.textSub }}>{eq.local}</span>
            <span style={{ fontSize: 12, color: C.textSub }}>{eq.fabricante}</span>
            <div>
              <div style={{ fontSize: 12, color: C.textSub }}>{eq.modelo}</div>
              <div style={{ fontSize: 10, color: C.muted }}>{eq.serie}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => abrirEditar(eq)}
                style={{
                  background: 'transparent',
                  border: `1px solid ${C.border}`,
                  borderRadius: 5,
                  padding: '4px 8px',
                  color: C.textSub,
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                ✏
              </button>
              <button
                onClick={() => excluir(eq.id)}
                style={{
                  background: 'transparent',
                  border: `1px solid #ef444433`,
                  borderRadius: 5,
                  padding: '4px 8px',
                  color: '#ef4444',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        {lista.length === 0 && !loading && (
          <div style={{ padding: 32, textAlign: 'center', color: C.muted, fontSize: 13 }}>
            Nenhum equipamento encontrado
          </div>
        )}
      </div>

      {modal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#00000090',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 300,
            padding: 20,
          }}
        >
          <div
            style={{
              ...s.card,
              width: 480,
              maxWidth: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 48px #00000060',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 22px',
                borderBottom: `1px solid ${C.border}`,
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                {modal === 'novo' ? 'Novo equipamento' : 'Editar equipamento'}
              </div>
              <button
                onClick={() => setModal(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: C.muted,
                  fontSize: 20,
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={s.label}>TAG *</label>
                <input
                  type="text"
                  value={form.tag}
                  onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
                  placeholder="Ex: COMP-AR-03"
                  style={s.input}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={s.label}>NOME *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Compressor de Ar"
                  style={s.input}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={s.label}>LOCALIZAÇÃO</label>
                <input
                  type="text"
                  value={form.local}
                  onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))}
                  placeholder="Ex: Fábrica A"
                  style={s.input}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={s.label}>FABRICANTE</label>
                  <input
                    type="text"
                    value={form.fabricante}
                    onChange={(e) => setForm((f) => ({ ...f, fabricante: e.target.value }))}
                    placeholder="Ex: Atlas Copco"
                    style={s.input}
                  />
                </div>
                <div>
                  <label style={s.label}>MODELO</label>
                  <input
                    type="text"
                    value={form.modelo}
                    onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))}
                    placeholder="Ex: GA15"
                    style={s.input}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={s.label}>NÚMERO DE SÉRIE</label>
                <input
                  type="text"
                  value={form.serie}
                  onChange={(e) => setForm((f) => ({ ...f, serie: e.target.value }))}
                  placeholder="Ex: ATC-2019-003"
                  style={s.input}
                />
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 10,
                padding: '14px 22px',
                borderTop: `1px solid ${C.border}`,
                flexShrink: 0,
              }}
            >
              <button onClick={() => setModal(null)} style={{ ...s.btn(false), padding: '8px 18px', flex: 1 }}>
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={!form.nome || !form.tag}
                style={{
                  ...s.btn(true),
                  flex: 1,
                  padding: '8px 18px',
                  opacity: !form.nome || !form.tag ? 0.5 : 1,
                  cursor: !form.nome || !form.tag ? 'not-allowed' : 'pointer',
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}