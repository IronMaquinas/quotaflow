// frontend/src/TelaResetSenha.jsx
//
// Tela de redefinir senha — lê token da URL (hash routing).

import { useState, useEffect } from 'react';
import apiService from './services/apiService';
import { C, s } from './App';

export default function TelaResetSenha({ onVoltar }) {
  const [token, setToken] = useState(null);
  const [validando, setValidando] = useState(true);
  const [valido, setValido] = useState(false);
  const [motivo, setMotivo] = useState(null);
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    // Parse do hash: #/reset-senha?token=abc123
    const hash = window.location.hash || '';
    const m = hash.match(/token=([a-f0-9]+)/i);
    const t = m ? m[1] : null;
    setToken(t);

    if (!t) {
      setValidando(false);
      setValido(false);
      setMotivo('invalido');
      return;
    }

    apiService.get('/auth/reset-password/validar', { token: t })
      .then(r => {
        setValido(!!r?.ok);
        setMotivo(r?.motivo || null);
      })
      .catch(() => {
        setValido(false);
        setMotivo('invalido');
      })
      .finally(() => setValidando(false));
  }, []);

  async function salvar() {
    if (senha.length < 6) { setErro('Senha precisa ter ao menos 6 caracteres.'); return; }
    if (senha !== confirma) { setErro('As senhas não coincidem.'); return; }
    setSalvando(true);
    setErro(null);
    try {
      await apiService.post('/auth/reset-password', { token, senha });
      setOk(true);
    } catch (e) {
      setErro(e.message || 'Erro ao redefinir');
    } finally {
      setSalvando(false);
    }
  }

  if (validando) {
    return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ ...s.card, width: 400, padding: 32, textAlign: 'center', color: C.muted }}>
          Validando link...
        </div>
      </div>
    );
  }

  if (!valido && !ok) {
    const msgs = {
      expirado: '⏱ Este link expirou. Peça um novo.',
      usado: '✅ Este link já foi usado. Peça um novo.',
      invalido: '❌ Link inválido.',
    };
    return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ ...s.card, width: 400, padding: 32 }}>
          <div style={{ fontSize: 16, color: C.text, marginBottom: 12 }}>
            {msgs[motivo] || 'Não foi possível abrir este link.'}
          </div>
          <button onClick={onVoltar}
            style={{ ...s.btn(true), padding: '10px 18px', fontSize: 13 }}>
            ← Voltar pro login
          </button>
        </div>
      </div>
    );
  }

  if (ok) {
    return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ ...s.card, width: 400, padding: 32 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 12 }}>
            ✅ Senha redefinida!
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
            Sua senha foi atualizada. Você já pode fazer login com a nova.
          </div>
          <button onClick={onVoltar}
            style={{ ...s.btn(true), padding: '10px 18px', fontSize: 13 }}>
            Ir pro login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ ...s.card, width: 400, padding: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 8 }}>
          🔒 Nova senha
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
          Escolha uma nova senha (mínimo 6 caracteres).
        </div>

        {erro && (
          <div style={{ fontSize: 12, color: '#ef4444', background: '#ef444415',
                        border: '1px solid #ef444440', borderRadius: 6,
                        padding: '8px 10px', marginBottom: 12 }}>
            ⚠ {erro}
          </div>
        )}

        <label style={s.label}>NOVA SENHA</label>
        <input type="password" value={senha}
          onChange={e => setSenha(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          autoFocus
          style={{ ...s.input, marginBottom: 12 }} />

        <label style={s.label}>CONFIRMAR SENHA</label>
        <input type="password" value={confirma}
          onChange={e => setConfirma(e.target.value)}
          placeholder="Repita a senha"
          onKeyDown={e => { if (e.key === 'Enter') salvar(); }}
          style={{ ...s.input, marginBottom: 20 }} />

        <button onClick={salvar}
          disabled={salvando || !senha || !confirma}
          style={{ ...s.btn(true), width: '100%', padding: '11px', fontSize: 13,
                   opacity: (salvando || !senha || !confirma) ? 0.5 : 1 }}>
          {salvando ? 'Salvando...' : 'Redefinir senha'}
        </button>
      </div>
    </div>
  );
}