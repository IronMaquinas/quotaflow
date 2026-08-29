// components/estoque/TelaAprovacaoRetirada.jsx
import { useState, useEffect } from 'react';
import apiService from '../../services/apiService';

export default function TelaAprovacaoRetirada({ C, s, fmtD, onAtualizarBadge }) {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState({});

  const carregar = async () => {
    try {
      const data = await apiService.get('/estoque/solicitacoes');
      setSolicitacoes(data || []);
    } catch (err) {
      console.error('Erro ao carregar solicitações:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const aprovar = async (id) => {
    if (!window.confirm('Aprovar esta retirada?')) return;
    setProcessando(p => ({ ...p, [id]: true }));
    try {
      await apiService.put(`/estoque/solicitacoes/${id}/aprovar`);
      await carregar(); 
      
      // 🔥 GATILHO: Avisa o App para atualizar o badge buscando a contagem otimizada
      if (onAtualizarBadge) onAtualizarBadge(); 
      
    } catch (err) {
      alert('Erro ao aprovar: ' + err.message);
    } finally {
      setProcessando(p => ({ ...p, [id]: false }));
    }
  };

  const rejeitar = async (id) => {
    const motivo = prompt('Motivo da rejeição:');
    if (motivo === null) return;
    setProcessando(p => ({ ...p, [id]: true }));
    try {
      await apiService.put(`/estoque/solicitacoes/${id}/rejeitar`, { observacao: motivo });
      await carregar(); 
      
      // 🔥 GATILHO: Avisa o App para atualizar o badge buscando a contagem otimizada
      if (onAtualizarBadge) onAtualizarBadge();
      
    } catch (err) {
      alert('Erro ao rejeitar: ' + err.message);
    } finally {
      setProcessando(p => ({ ...p, [id]: false }));
    }
  };

  if (loading) return <div style={{ padding: 20, color: C.muted }}>Carregando...</div>;

  return (
    <div style={{ padding: '22px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em' }}>APROVAÇÕES</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Retiradas Pendentes</div>
      </div>

      {solicitacoes.length === 0 && (
        <div style={{ ...s.card, padding: 40, textAlign: 'center', color: C.muted }}>
          ✅ Nenhuma solicitação pendente de aprovação
        </div>
      )}

      {solicitacoes.map(sol => (
        <div key={sol.id} style={{ ...s.card, padding: '16px 18px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{sol.item_nome}</div>
              <div style={{ fontSize: 12, color: C.muted }}>
                {sol.quantidade} {sol.unidade_medida || 'UN'} · {sol.solicitante_nome} · {fmtD(sol.criado_em)}
              </div>
              {sol.motivo && <div style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>"{sol.motivo}"</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => aprovar(sol.id)}
                disabled={processando[sol.id]}
                style={{ ...s.btn(true, C.success), padding: '6px 14px', fontSize: 12 }}
              >
                ✅ Aprovar
              </button>
              <button
                onClick={() => rejeitar(sol.id)}
                disabled={processando[sol.id]}
                style={{ ...s.btn(true, C.danger), padding: '6px 14px', fontSize: 12 }}
              >
                ❌ Rejeitar
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}