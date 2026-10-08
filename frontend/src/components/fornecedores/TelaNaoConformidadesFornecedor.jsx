// components/fornecedores/TelaNaoConformidadesFornecedor.jsx
//
// M4 — Não Conformidades expostas ao fornecedor logado. Lista NCs onde
// ele é o alvo, com thread de tratativa, anexo de evidência e ações
// de resposta (aceitar / contestar / resolver).

import { useState, useEffect, useCallback } from 'react';
import apiService from '../../services/apiService';
import { fmtBRL, fmtD } from '../../utils/formatters';
import ModalDetalheNCFornecedor from './ModalDetalheNCFornecedor';

const STATUS_TRATATIVA = {
  nao_enviado:          { l: 'Aguardando envio',   c: '#6b7280', icon: '⏳' },
  enviado:              { l: 'Aguardando você',    c: '#f59e0b', icon: '🔔' },
  visualizado:          { l: 'Visualizada',        c: '#6366f1', icon: '👁️' },
  // M4.4-etapa-9: comprador devolveu — precisa revisar e reenviar
  devolvida:            { l: 'Devolvida — ação!',  c: '#f59e0b', icon: '🔄' },
  // M4.4-etapa-9c: 'aceita' removido do fluxo
  contestada:           { l: 'Contestada',         c: '#ef4444', icon: '✋' },
  resolvida_fornecedor: { l: 'Resolvida',          c: '#3b82f6', icon: '✔️' },
};

export default function TelaNaoConformidadesFornecedor({ C, s, usuario }) {
  const [ncs, setNcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [filtro, setFiltro] = useState('todas');
  const [busca, setBusca] = useState('');
  const [modalDetalhe, setModalDetalhe] = useState(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/fornecedor/nao-conformidades');
      setNcs(data.ncs || []);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar NCs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirDetalhe = async (nc) => {
    setCarregandoDetalhe(true);
    try {
      const data = await apiService.get(`/fornecedor/nao-conformidades/${nc.id}`);
      setModalDetalhe(data);
    } catch (e) {
      alert('Erro ao carregar detalhes: ' + e.message);
    } finally {
      setCarregandoDetalhe(false);
    }
  };

  const filtradas = ncs.filter(nc => {
    if (filtro === 'aguardando') {
      if (!['enviado', 'visualizado'].includes(nc.fornecedor_tratativa_status)) return false;
    }
    if (filtro === 'respondidas') {
      if (!['aceita', 'contestada', 'resolvida_fornecedor'].includes(nc.fornecedor_tratativa_status)) return false;
    }
    if (busca.trim()) {
      const q = busca.toLowerCase();
      const hay = `${nc.numero_nc} ${nc.descricao_problema || ''} ${nc.numero_pedido || ''} ${nc.numero_nota_fiscal || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Carregando não conformidades...</div>;
  }

  return (
    <div style={{ padding: '22px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em', marginBottom: 4 }}>
          NÃO CONFORMIDADES
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>
          {usuario?.nome ? `Olá, ${usuario.nome}` : 'Acompanhamento'}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
          Acompanhe as recusas de recebimento, responda com tratativas e anexe evidências.
        </div>
      </div>

      {erro && (
        <div style={{
          padding: '10px 12px', background: '#ef444415',
          border: '1px solid #ef444440', borderRadius: 6,
          fontSize: 12, color: '#ef4444', marginBottom: 16,
        }}>
          ⚠ {erro}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { id: 'todas', l: 'Todas' },
          { id: 'aguardando', l: 'Aguardando você' },
          { id: 'respondidas', l: 'Já respondidas' },
        ].map(f => {
          const ativo = filtro === f.id;
          const count = f.id === 'aguardando'
            ? ncs.filter(nc => ['enviado', 'visualizado'].includes(nc.fornecedor_tratativa_status)).length
            : f.id === 'respondidas'
              ? ncs.filter(nc => ['aceita', 'contestada', 'resolvida_fornecedor'].includes(nc.fornecedor_tratativa_status)).length
              : ncs.length;
          return (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              style={{
                background: ativo ? `${C.accent}22` : 'transparent',
                border: `1px solid ${ativo ? C.accent : C.border}`,
                borderRadius: 6,
                color: ativo ? C.accent : C.muted,
                fontSize: 12, fontWeight: ativo ? 600 : 400,
                padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {f.l}{count > 0 && ` (${count})`}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <input
          type="text"
          placeholder="Buscar por NC, OC, NF..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ ...s.input, maxWidth: 260, padding: '6px 12px', fontSize: 12 }}
        />
      </div>

      {filtradas.length === 0 ? (
        <div style={{ ...s.card, padding: '40px 20px', textAlign: 'center', color: C.muted, fontSize: 12 }}>
          {ncs.length === 0
            ? 'Nenhuma não conformidade registrada contra você.'
            : 'Nenhuma NC corresponde ao filtro.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtradas.map(nc => {
            const cfg = STATUS_TRATATIVA[nc.fornecedor_tratativa_status] || { l: '—', c: '#6b7280', icon: '⚪' };
            return (
              <div
                key={nc.id}
                onClick={() => abrirDetalhe(nc)}
                style={{
                  ...s.card, padding: '14px 18px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 200px 140px',
                  gap: 16, alignItems: 'center',
                  cursor: 'pointer', transition: 'border-color .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; }}
              >
                <div>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: C.text,
                    fontFamily: "'IBM Plex Mono', monospace", marginBottom: 2,
                  }}>
                    {nc.numero_nc}
                  </div>
                  <div style={{
                    fontSize: 12, color: C.textSub,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    maxWidth: 400,
                  }}>
                    {nc.descricao_problema || nc.motivo_recusa || '—'}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                    {nc.numero_pedido && `${nc.numero_pedido} · `}
                    {nc.numero_nota_fiscal && `NF ${nc.numero_nota_fiscal} · `}
                    {fmtD(nc.criado_em)}
                  </div>
                </div>

                <div>
                  <span style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 4,
                    background: `${cfg.c}22`, color: cfg.c,
                    border: `1px solid ${cfg.c}55`, fontWeight: 600,
                  }}>
                    {cfg.icon} {cfg.l}
                  </span>
                </div>

                <div style={{ textAlign: 'right', fontSize: 11, color: C.muted }}>
                  {nc.quantidade && `${nc.quantidade} ${nc.unidade_medida || 'UN'}`}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(modalDetalhe || carregandoDetalhe) && (
        <ModalDetalheNCFornecedor
          C={C}
          s={s}
          detalhe={modalDetalhe}
          carregando={carregandoDetalhe}
          onFechar={() => setModalDetalhe(null)}
          onAtualizar={() => { abrirDetalhe({ id: modalDetalhe?.cabecalho?.id }); carregar(); }}
        />
      )}
    </div>
  );
}