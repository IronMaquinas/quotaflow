// components/portal/TelaFornecedor.jsx
import { useState, useEffect } from 'react';
import TelaPortalFornecedor from './TelaPortalFornecedor';
import TelaCatalogoFornecedor from './TelaCatalogoFornecedor';
import TelaOrdensVenda from '../ordensvenda/TelaOrdensVenda';

const C = {
  bg: "#0a0e14",
  surface: "#111722",
  border: "#1e2535",
  accent: "#3b82f6",
  success: "#22c55e",
  warn: "#f59e0b",
  danger: "#ef4444",
  muted: "#64748b",
  text: "#e2e8f0",
  textSub: "#94a3b8",
};

const s = {
  card: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 },
  btn: (enabled = true, color = C.accent) => ({ background: enabled ? color : C.surface, border: `1px solid ${enabled ? color : C.border}`, borderRadius: 7, padding: "9px 18px", color: enabled ? "#fff" : C.muted, fontSize: 13, fontWeight: 600, cursor: enabled ? "pointer" : "not-allowed", fontFamily: "inherit", transition: "all .15s" }),
  tag: (c) => ({ fontSize: 10, background: `${c}22`, border: `1px solid ${c}44`, borderRadius: 4, padding: "2px 8px", color: c, letterSpacing: "0.06em", fontWeight: 600, whiteSpace: "nowrap" }),
  label: { fontSize: 11, color: C.muted, letterSpacing: "0.08em", display: "block", marginBottom: 5, fontWeight: 600, textTransform: "uppercase" },
  input: { width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "9px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
};

const fmtBRL = v => v != null ? `R$ ${Number(v).toFixed(2).replace('.', ',')}` : '—';
const fmtD = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

export default function TelaFornecedor() {
  const [tela, setTela] = useState('oportunidades');
  const [usuario, setUsuario] = useState(null);
  
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('usuario') || '{}');
    setUsuario(user);
  }, []);

  const menuItens = [
    { id: 'oportunidades', label: '⚡ Oportunidades Spot' },
    { id: 'catalogo', label: '📦 Catálogo' },
    { id: 'ordens', label: '📋 Ordens de Venda' },
  ];

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('usuario');
    window.location.hash = '#login';
  };

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", background: C.bg, height: '100vh', color: C.text, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {/* ─── SIDEBAR ─── */}
        <div style={{
          width: 170,
          background: C.surface,
          borderRight: `1px solid ${C.border}`,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          height: '100vh',
          padding: '16px 12px',
          gap: 4,
          overflowY: 'auto',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ width: 4, height: 22, background: '#f87171', borderRadius: 2 }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '0.02em' }}>QuotaFlow</span>
          </div>

          {/* Menu do Fornecedor */}
          {menuItens.map(item => (
            <button
              key={item.id}
              onClick={() => setTela(item.id)}
              style={{
                background: tela === item.id ? '#1e2a3f' : 'transparent',
                border: 'none',
                borderRadius: 6,
                padding: '10px 14px',
                color: tela === item.id ? C.accent : C.muted,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
                width: '100%',
                transition: 'all .1s',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
              onMouseEnter={e => { if (tela !== item.id) e.currentTarget.style.background = '#151d2e' }}
              onMouseLeave={e => { if (tela !== item.id) e.currentTarget.style.background = 'transparent' }}
            >
              <span>{item.label}</span>
            </button>
          ))}

          <div style={{ flex: 1 }} />

          {/* Informações do usuário + logout */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 8 }}>
            <div style={{ fontSize: 11, color: C.text, fontWeight: 500, marginBottom: 2 }}>
              {usuario?.nome || 'Fornecedor'}
            </div>
            <div style={{ fontSize: 9, color: C.accent, marginBottom: 8 }}>
              🏢 Fornecedor
            </div>
            <button
              onClick={logout}
              style={{
                background: 'transparent',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: '6px 10px',
                color: C.muted,
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
                width: '100%',
              }}
            >
              Sair
            </button>
          </div>
        </div>

        {/* ─── CONTEÚDO ─── */}
        <div style={{ flex: 1, overflowY: 'auto', background: C.bg }}>
          {tela === 'oportunidades' && <TelaPortalFornecedor />}
          {tela === 'catalogo' && <TelaCatalogoFornecedor C={C} s={s} fmtBRL={fmtBRL} />}
          {tela === 'ordens' && <TelaOrdensVenda C={C} s={s} fmtBRL={fmtBRL} fmtD={fmtD} />}
        </div>
      </div>
    </div>
  );
}