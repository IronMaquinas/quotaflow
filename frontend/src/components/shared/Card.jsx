// components/shared/Card.jsx
// Componente Card reutilizável

import { estilos, CORES } from "../../utils/constants";

export default function Card({
  children,
  title,
  subtitle,
  icon,
  border,
  borderColor,
  onClick,
  style = {},
}) {
  return (
    <div
      onClick={onClick}
      style={{
        ...estilos.card,
        ...(border ? { borderLeft: `3px solid ${borderColor || CORES.accent}` } : {}),
        cursor: onClick ? "pointer" : "default",
        transition: onClick ? "all 0.2s" : "none",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.background = CORES.surface;
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.background = CORES.surface;
          e.currentTarget.style.boxShadow = "none";
        }
      }}
    >
      {(title || icon) && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
          <div>
            {title && (
              <div style={{ fontSize: 13, fontWeight: 700, color: CORES.text }}>
                {title}
              </div>
            )}
            {subtitle && (
              <div style={{ fontSize: 11, color: CORES.muted, marginTop: 2 }}>
                {subtitle}
              </div>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
