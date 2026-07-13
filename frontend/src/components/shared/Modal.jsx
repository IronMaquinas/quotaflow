// components/shared/Modal.jsx
// Componente Modal reutilizável

import { CORES } from "../../utils/constants";

export default function Modal({
  title,
  onClose,
  children,
  width = 480,
  actions, // [{ label, onClick, variant }]
  loading = false,
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#00000090",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 300,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: CORES.surface,
          border: `1px solid ${CORES.border}`,
          borderRadius: 10,
          width,
          maxWidth: "100%",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 48px #00000060",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 22px",
            borderBottom: `1px solid ${CORES.border}`,
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: CORES.text }}>
            {title}
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: "transparent",
              border: "none",
              color: CORES.muted,
              fontSize: 20,
              cursor: loading ? "not-allowed" : "pointer",
              lineHeight: 1,
              opacity: loading ? 0.5 : 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: "20px 22px",
            overflowY: "auto",
            flex: 1,
          }}
        >
          {children}
        </div>

        {/* Actions */}
        {actions && actions.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 10,
              padding: "14px 22px",
              borderTop: `1px solid ${CORES.border}`,
              justifyContent: "flex-end",
              flexShrink: 0,
            }}
          >
            {actions.map((action, idx) => (
              <button
                key={idx}
                onClick={action.onClick}
                disabled={loading || action.disabled}
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  borderRadius: 6,
                  border: "none",
                  cursor: loading || action.disabled ? "not-allowed" : "pointer",
                  opacity: loading || action.disabled ? 0.6 : 1,
                  background:
                    action.variant === "danger"
                      ? CORES.danger
                      : action.variant === "secondary"
                      ? CORES.surface
                      : CORES.accent,
                  color:
                    action.variant === "secondary" ? CORES.text : "#fff",
                  border:
                    action.variant === "secondary"
                      ? `1px solid ${CORES.border}`
                      : "none",
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
