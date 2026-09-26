// components/fornecedores/ModalResponderCotacao.jsx
//
// Wrapper fino do FormularioRespostaCotacao pra uso dentro do hub do
// fornecedor logado. Em vez do token na URL, carrega via JWT (endpoints
// autenticados) — mesmo form, mesma UX, mas sem sair da tela.
//
// Reusado pelo botão "Responder agora" em TelaGestaoCotacoesFornecedor.
// Ao enviar, o pai decide o que fazer (fechar + recarregar lista).

import { usePortalAutenticado } from '../../hooks/usePortal';
import FormularioRespostaCotacao from '../portal/FormularioRespostaCotacao';

export default function ModalResponderCotacao({
  cotacaoFornecedorId,
  onFechar,
  onSucesso,
}) {
  const { cotacao, loading, erro, respondendo, enviarResposta } =
    usePortalAutenticado(cotacaoFornecedorId);

  return (
    <div
      onClick={onFechar}
      style={{
        position: 'fixed', inset: 0, background: '#00000090',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 600, padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0a0e14',
          color: '#e2e8f0',
          fontFamily: "'DM Sans','Segoe UI',sans-serif",
          borderRadius: 12,
          border: '1px solid #1e2535',
          width: 980,
          maxWidth: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        {/* Botão fechar no canto */}
        <button
          onClick={onFechar}
          style={{
            position: 'absolute', top: 12, right: 14,
            background: 'transparent', border: 'none',
            color: '#64748b', fontSize: 22, cursor: 'pointer',
            lineHeight: 1, zIndex: 2,
          }}
          title="Fechar"
        >
          ×
        </button>

        {loading && (
          <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
            Carregando cotação...
          </div>
        )}

        {erro && !loading && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 18, color: '#ef4444', marginBottom: 12 }}>
              ❌ Erro ao carregar cotação
            </div>
            <div style={{ fontSize: 14, color: '#64748b' }}>{erro}</div>
          </div>
        )}

        {cotacao && !loading && !erro && (
          <FormularioRespostaCotacao
            cotacao={cotacao}
            enviarResposta={enviarResposta}
            respondendo={respondendo}
            modoModal
            onSucesso={onSucesso}
            onFechar={onFechar}
          />
        )}
      </div>
    </div>
  );
}