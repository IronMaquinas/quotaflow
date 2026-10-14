// components/portal/TelaFornecedorSpot.jsx
import { useState, useEffect } from 'react';
import apiService from '../../services/apiService';

export default function TelaFornecedorSpot({ C, s, usuario }) {
  const [demandas, setDemandas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [detalhe, setDetalhe] = useState(null);

  const carregar = async () => {
    try {
      const data = await apiService.get('/spot/fornecedor/demandas');
      setDemandas(Array.isArray(data) ? data : []);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const abrir = async (d) => {
    setDetalhe(d);
    // marca visualização (silencioso)
    try {
      await apiService.post(`/spot/fornecedor/demandas/${d.id}/visualizar`, {});
    } catch (e) { /* ignora */ }
  };

  const enviarInteresse = async (d) => {
    try {
      await apiService.post('/spot/fornecedor/interesse', { demanda_id: d.id, mensagem: '' });
      setDetalhe(null);
      carregar();
    } catch (e) {
      alert('Erro: ' + e.message);
    }
  };

  if (loading) return <div style={{ padding: 40, color: C.muted }}>Carregando...</div>;
  if (erro) return <div style={{ padding: 40, color: '#ef4444' }}>⚠ {erro}</div>;

  return (
    <div style={{ padding: '22px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em' }}>OPORTUNIDADES SPOT</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>
          Olá, {usuario?.nome || 'Fornecedor'}
        </div>
      </div>

      {demandas.length === 0 ? (
        <div style={{ ...s.card, padding: 40, textAlign: 'center', color: C.muted }}>
          Nenhuma demanda spot no momento.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {demandas.map(d => (
            <div
              key={d.id}
              onClick={() => abrir(d)}
              style={{ ...s.card, padding: '16px 20px', cursor: 'pointer' }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                {d.componente}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                {d.descricao_equipamento}
                {d.marca_modelo && ` · ${d.marca_modelo}`}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                {d.quantidade} unidade(s) · urgência {d.urgencia} · {d.status}
              </div>
              {d.ja_interesse && (
                <div style={{ marginTop: 10, fontSize: 11, color: C.success }}>
                  ✓ Interesse já enviado
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {detalhe && (
        <div
          onClick={() => setDetalhe(null)}
          style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ ...s.card, width: 520, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{detalhe.componente}</div>
              <button onClick={() => setDetalhe(null)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '18px 22px', overflowY: 'auto' }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{detalhe.descricao_equipamento}</div>
              {detalhe.marca_modelo && <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{detalhe.marca_modelo}</div>}
              {detalhe.part_number && <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>PN: {detalhe.part_number}</div>}
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
                {detalhe.quantidade} unidade(s) · urgência {detalhe.urgencia}
              </div>
              {detalhe.comentarios && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.05em', marginBottom: 4 }}>
                    COMENTÁRIOS:
                  </div>
                  <div style={{ fontSize: 12, color: C.text, background: C.bg, padding: 10, borderRadius: 6, border: `1px solid ${C.border}` }}>
                    {detalhe.comentarios}
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDetalhe(null)} style={{ ...s.btn(false), padding: '8px 18px' }}>Fechar</button>
              {detalhe.ja_interesse ? (
                <span style={{ fontSize: 12, color: C.success, alignSelf: 'center' }}>✓ Interesse já enviado</span>
              ) : (
                <button onClick={() => enviarInteresse(detalhe)} style={{ ...s.btn(true, C.accent), padding: '8px 18px' }}>
                  Tenho interesse →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}