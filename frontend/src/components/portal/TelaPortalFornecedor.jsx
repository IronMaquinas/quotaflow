// components/portal/TelaPortalFornecedor.jsx
//
// Wrapper PÚBLICO do formulário de resposta. Modo tokenizado: o fornecedor
// chega por link de email/WhatsApp, sem login, com um token na URL que dá
// acesso a UMA cotação específica dele.
//
// Após o refactor 2026-09 (extração do FormularioRespostaCotacao), esta
// tela só faz:
//   1. Lê o token da URL
//   2. Chama usePortal(token) pra carregar a cotação
//   3. Trata loading/erro/não-encontrado
//   4. Delega o resto pro <FormularioRespostaCotacao />
//
// O form em si não sabe se está no modo público ou autenticado — só
// recebe os dados e a função de envio. Isso permite reaproveitar o mesmo
// form no hub do fornecedor logado (ModalResponderCotacao, a implementar).

import { usePortal } from '../../hooks/usePortal';
import FormularioRespostaCotacao from './FormularioRespostaCotacao';

export default function TelaPortalFornecedor() {
  // Pega o token da URL (ex: /portal/cotacao/:cotacaoId/:token)
  const hashParts = window.location.hash.split('/');
  const token = hashParts[hashParts.length - 1];

  const { cotacao, loading, erro, respondendo, enviarResposta } = usePortal(token);

  // Se estiver carregando
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ fontSize: 18, color: '#6b7280' }}>Carregando cotação...</div>
      </div>
    );
  }

  // Se houve erro
  if (erro) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column' }}>
        <div style={{ fontSize: 18, color: '#ef4444', marginBottom: 12 }}>❌ Erro ao carregar cotação</div>
        <div style={{ fontSize: 14, color: '#6b7280' }}>{erro}</div>
      </div>
    );
  }

  // Se não há cotação
  if (!cotacao) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ fontSize: 18, color: '#6b7280' }}>Cotação não encontrada</div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#0a0e14',
      minHeight: '100vh',
      color: '#e2e8f0',
      fontFamily: "'DM Sans','Segoe UI',sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      <FormularioRespostaCotacao
        cotacao={cotacao}
        enviarResposta={enviarResposta}
        respondendo={respondendo}
      />
    </div>
  );
}