// components/shared/Badge.jsx
// Componente Badge reutilizável

import { estilos, CORES } from "../../utils/constants";

export default function Badge({
  label,
  color = CORES.accent,
  dot = true,
  size = "md", // sm | md | lg
}) {
  const sizeMap = {
    sm: { fontSize: 9, padding: "2px 6px" },
    md: { fontSize: 10, padding: "4px 10px" },
    lg: { fontSize: 11, padding: "6px 12px" },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        ...estilos.badge(color),
        ...sizeMap[size],
      }}
    >
      {dot && (
        <span
          style={{
            width: size === "sm" ? 5 : 6,
            height: size === "sm" ? 5 : 6,
            borderRadius: "50%",
            background: color,
          }}
        />
      )}
      {label}
    </span>
  );
}
