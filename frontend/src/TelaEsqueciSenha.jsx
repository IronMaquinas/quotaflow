// frontend/src/TelaEsqueciSenha.jsx
//
// Tela "esqueci minha senha" — input de email + envio.

import { useState } from 'react';
import apiService from './services/apiService';
import { C, s } from './App';

export default function TelaEsqueciSenha({ onVoltar }) {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function enviar() {
    if (!email.trim()) return;
    setSalvando(true);
    try {
      await apiService.post('/auth/forgot-password', { email: email.trim() });
      setEnviado(true);
    } catch (_) {
      // Backend sempre responde ok — mostra sucesso mesmo assim
      setEnviado(true);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ ...s.card, width: 400, maxWidth: '100%', padding: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 8 }}>
          🔒 Esqueci minha senha
        </div>

        {!enviado ? (
          <>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>
              Digite seu email. Se estiver cadastrado, enviaremos um link pra você criar uma nova senha.
            </div>
            <label style={s.label}>E-MAIL</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') enviar(); }}
              style={{ ...s.input, marginBottom: 16 }}
            />
            <button
              onClick={enviar}
              disabled={!email.trim() || salvando}
              style={{ ...s.btn(true), width: '100%', padding: '11px', fontSize: 13,
                       opacity: (!email.trim() || salvando) ? 0.5 : 1 }}>
              {salvando ? 'Enviando...' : 'Enviar link'}
            </button>
          </>
        ) : (
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>
            ✅ Se o email <strong>{email}</strong> estiver cadastrado, você receberá um link em alguns minutos.
            <br /><br />
            Não esquece de olhar a caixa de <strong>SPAM</strong>.
          </div>
        )}

        <button
          onClick={onVoltar}
          style={{ background: 'transparent', border: 'none', color: C.accent,
                   fontSize: 12, cursor: 'pointer', marginTop: 20, fontFamily: 'inherit' }}>
          ← Voltar pro login
        </button>
      </div>
    </div>
  );
}