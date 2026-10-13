// frontend/src/components/usuarios/ModalMeuPerfil.jsx
//
// M4.7: modal de perfil do próprio usuário. Nome, telefone e troca de senha.
// O backend usa `req.userId` do JWT — nunca aceita id no body.

import { useState } from 'react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import './phone-input.css';
import apiService from '../../services/apiService';
import { C, s } from '../../App';

function iniciais(nome) {
  if (!nome) return '?';
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export default function ModalMeuPerfil({ usuario, onFechar, onAtualizado }) {
  const [aba, setAba] = useState('dados'); // 'dados' | 'senha'
  const [nome, setNome] = useState(usuario?.nome || '');
  const [telefone, setTelefone] = useState(usuario?.telefone || '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);

  // Trocar senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirma, setSenhaConfirma] = useState('');

  async function salvarDados() {
    if (!nome.trim()) { setErro('Nome não pode ser vazio.'); return; }
    setSalvando(true); setErro(null); setOk(null);
    try {
      const r = await apiService.put('/usuarios/me', { nome: nome.trim(), telefone: telefone || null });
      setOk('Dados atualizados.');
      onAtualizado?.(r.usuario);
    } catch (e) {
      setErro(e.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function trocarSenha() {
    if (!senhaAtual || !senhaNova) { setErro('Preencha todos os campos.'); return; }
    if (senhaNova.length < 6) { setErro('Nova senha precisa ter ao menos 6 caracteres.'); return; }
    if (senhaNova !== senhaConfirma) { setErro('As senhas não coincidem.'); return; }
    setSalvando(true); setErro(null); setOk(null);
    try {
      await apiService.post('/usuarios/me/trocar-senha', { senhaAtual, senhaNova });
      setOk('Senha alterada.');
      setSenhaAtual(''); setSenhaNova(''); setSenhaConfirma('');
    } catch (e) {
      setErro(e.message || 'Erro ao trocar senha');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div onClick={onFechar}
      style={{ position: 'fixed', inset: 0, background: '#00000090',
               display: 'flex', alignItems: 'center', justifyContent: 'center',
               zIndex: 400, padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ ...s.card, width: 480, maxWidth: '100%', padding: 0,
                 display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: C.accent, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, flexShrink: 0,
            }}>
              {iniciais(usuario?.nome)}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                Meu perfil
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {usuario?.email}
              </div>
            </div>
          </div>
          <button onClick={onFechar}
            style={{ background: 'transparent', border: 'none',
                     color: C.muted, fontSize: 22, cursor: 'pointer',
                     lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}` }}>
          {[
            { id: 'dados', label: 'Dados pessoais' },
            { id: 'senha', label: 'Trocar senha' },
          ].map(t => (
            <button key={t.id} onClick={() => { setAba(t.id); setErro(null); setOk(null); }}
              style={{
                background: 'transparent', border: 'none',
                borderBottom: aba === t.id ? `2px solid ${C.accent}` : '2px solid transparent',
                padding: '12px 18px', color: aba === t.id ? C.accent : C.muted,
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px', minHeight: 220 }}>

          {erro && (
            <div style={{ fontSize: 12, color: '#ef4444', background: '#ef444415',
                          border: '1px solid #ef444440', borderRadius: 6,
                          padding: '8px 12px', marginBottom: 12 }}>
              ⚠ {erro}
            </div>
          )}
          {ok && (
            <div style={{ fontSize: 12, color: C.success, background: '#22c55e15',
                          border: '1px solid #22c55e40', borderRadius: 6,
                          padding: '8px 12px', marginBottom: 12 }}>
              ✅ {ok}
            </div>
          )}

          {aba === 'dados' && (
            <>
              <label style={s.label}>NOME COMPLETO</label>
              <input type="text" value={nome}
                onChange={e => setNome(e.target.value)}
                style={{ ...s.input, marginBottom: 14 }} />

              <label style={s.label}>E-MAIL</label>
              <input type="email" value={usuario?.email || ''} disabled
                style={{ ...s.input, marginBottom: 14, opacity: 0.6, cursor: 'not-allowed' }} />
              <div style={{ fontSize: 10, color: C.muted, marginTop: -10, marginBottom: 14 }}>
                O e-mail só pode ser alterado por um administrador.
              </div>

              <label style={s.label}>TELEFONE</label>
              <PhoneInput
                international
                defaultCountry="BR"
                value={telefone || ''}
                onChange={v => setTelefone(v || '')}
                placeholder="(11) 99999-9999"
                className="phone-input-dark"
                style={{
                  background: C.bg, border: `1px solid ${C.border}`,
                  borderRadius: 6, padding: '0 12px', height: 38,
                  fontSize: 13, display: 'flex', alignItems: 'center',
                  marginBottom: 18,
                }}
              />
            </>
          )}

          {aba === 'senha' && (
            <>
              <label style={s.label}>SENHA ATUAL</label>
              <input type="password" value={senhaAtual}
                onChange={e => setSenhaAtual(e.target.value)}
                placeholder="Digite sua senha atual"
                style={{ ...s.input, marginBottom: 14 }} />

              <label style={s.label}>NOVA SENHA</label>
              <input type="password" value={senhaNova}
                onChange={e => setSenhaNova(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                style={{ ...s.input, marginBottom: 14 }} />

              <label style={s.label}>CONFIRMAR NOVA SENHA</label>
              <input type="password" value={senhaConfirma}
                onChange={e => setSenhaConfirma(e.target.value)}
                placeholder="Repita a nova senha"
                style={{ ...s.input, marginBottom: 14 }} />
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`,
                      display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onFechar} disabled={salvando}
            style={{ ...s.btn(false, C.muted), padding: '8px 20px', fontSize: 12 }}>
            Fechar
          </button>
          <button
            onClick={aba === 'dados' ? salvarDados : trocarSenha}
            disabled={salvando}
            style={{ ...s.btn(true, C.accent), padding: '8px 22px', fontSize: 12,
                     opacity: salvando ? 0.5 : 1 }}>
            {salvando ? 'Salvando...' : (aba === 'dados' ? 'Salvar dados' : 'Trocar senha')}
          </button>
        </div>
      </div>
    </div>
  );
}