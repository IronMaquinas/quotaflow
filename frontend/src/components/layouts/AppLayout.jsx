// components/layouts/AppLayout.jsx
// Layout principal do SaaS com navegação lateral e grid

import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

const C = {
  bg: "#0a0e14",
  surface: "#111722",
  surfaceAlt: "#0f131a",
  border: "#1e2535",
  accent: "#3b82f6",
  success: "#22c55e",
  warn: "#f59e0b",
  danger: "#ef4444",
  text: "#e2e8f0",
  textSub: "#94a3b8",
  muted: "#64748b",
  saving: "#a78bfa",
};

const menuItems = [
  { id: "fornecedores", label: "📋 Fornecedores", icon: "📋" },
  { id: "tecnico", label: "🔧 Técnico", icon: "🔧" },
  { id: "comprador", label: "🛒 Comprador", icon: "🛒" },
  { id: "financeiro", label: "💰 Financeiro", icon: "💰" },
  { id: "inteligencia", label: "🧠 Inteligência", icon: "🧠" },
  { id: "benchmark", label: "📊 Benchmark", icon: "📊" },
  { id: "relatorio", label: "📈 Relatório", icon: "📈" },
  { id: "usuarios", label: "👥 Usuários", icon: "👥" },
];

export default function AppLayout({ currentPage, onPageChange, children }) {
  const { usuario, tenant, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, fontFamily: "inherit" }}>
      {/* ────────────────────────────────────────────────────────────────────────────
          SIDEBAR
          ──────────────────────────────────────────────────────────────────────────── */}

      <div
        style={{
          width: sidebarOpen ? 240 : 60,
          background: C.surfaceAlt,
          borderRight: `1px solid ${C.border}`,
          display: "flex",
          flexDirection: "column",
          transition: "width 0.3s",
          zIndex: 100,
        }}
      >
        {/* Logo / Brand */}
        <div
          style={{
            padding: "20px 16px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: C.accent }}>Q</div>
          {sidebarOpen && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Quotaflow</div>
              <div style={{ fontSize: 10, color: C.muted }}>{tenant?.nome || "Carregando..."}</div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: "transparent",
              border: "none",
              color: C.muted,
              cursor: "pointer",
              fontSize: 16,
              padding: 4,
              marginLeft: "auto",
            }}
          >
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        {/* Menu Items */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                marginBottom: 4,
                background:
                  currentPage === item.id ? `${C.accent}20` : "transparent",
                border: currentPage === item.id ? `1px solid ${C.accent}` : "none",
                borderRadius: 8,
                color:
                  currentPage === item.id ? C.accent : C.muted,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: currentPage === item.id ? 600 : 500,
                fontFamily: "inherit",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (currentPage !== item.id) {
                  e.target.style.background = `${C.border}40`;
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage !== item.id) {
                  e.target.style.background = "transparent";
                }
              }}
            >
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              {sidebarOpen && <span>{item.label.split(" ")[1]}</span>}
            </button>
          ))}
        </nav>

        {/* User Menu */}
        <div
          style={{
            padding: "12px 8px",
            borderTop: `1px solid ${C.border}`,
            position: "relative",
          }}
        >
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              color: C.text,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = `${C.border}60`;
            }}
            onMouseLeave={(e) => {
              e.target.style.background = C.surface;
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: C.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {usuario?.email?.[0].toUpperCase()}
            </div>
            {sidebarOpen && (
              <div style={{ textAlign: "left", flex: 1 }}>
                <div style={{ fontSize: 11, color: C.text }}>{usuario?.nome || "Usuário"}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{usuario?.perfil}</div>
              </div>
            )}
            {sidebarOpen && (
              <span style={{ fontSize: 11, color: C.muted, marginLeft: "auto" }}>
                {showUserMenu ? "▲" : "▼"}
              </span>
            )}
          </button>

          {/* User Dropdown */}
          {showUserMenu && sidebarOpen && (
            <div
              style={{
                position: "absolute",
                bottom: 70,
                left: 8,
                right: 8,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                overflow: "hidden",
                zIndex: 200,
                boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
              }}
            >
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  onPageChange("usuarios");
                }}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "transparent",
                  border: "none",
                  color: C.text,
                  textAlign: "left",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  borderBottom: `1px solid ${C.border}22`,
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = `${C.accent}20`;
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "transparent";
                }}
              >
                ⚙️ Meu Perfil
              </button>
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  logout();
                  window.location.hash = "#login";
                }}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "transparent",
                  border: "none",
                  color: C.danger,
                  textAlign: "left",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = `#ef444422`;
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "transparent";
                }}
              >
                🚪 Sair
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────────
          MAIN CONTENT
          ──────────────────────────────────────────────────────────────────────────── */}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: C.bg,
          overflow: "hidden",
        }}
      >
        {/* Top Bar */}
        <div
          style={{
            height: 60,
            background: C.surface,
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            paddingLeft: 20,
            paddingRight: 20,
          }}
        >
          <div style={{ fontSize: 14, color: C.text }}>
            {menuItems.find((m) => m.id === currentPage)?.label || "Dashboard"}
          </div>
        </div>

        {/* Content Area */}
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
