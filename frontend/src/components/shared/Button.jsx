// components/shared/Button.jsx
// Componente Button reutilizável com variantes

import { CORES, estilos } from "../../utils/constants";

export default function Button({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = "primary", // primary | secondary | danger | success
  size = "md", // sm | md | lg
  fullWidth = false,
  type = "button",
  icon,
  ...props
}) {
  const variantColors = {
    primary: CORES.accent,
    secondary: CORES.surface,
    danger: CORES.danger,
    success: CORES.success,
  };

  const sizeStyles = {
    sm: { padding: "6px 12px", fontSize: 12 },
    md: { padding: "10px 18px", fontSize: 13 },
    lg: { padding: "12px 24px", fontSize: 14 },
  };

  const color = variantColors[variant] || variantColors.primary;
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      style={{
        ...estilos.btn(
          !isDisabled,
          variant === "secondary" ? CORES.border : color
        ),
        ...sizeStyles[size],
        width: fullWidth ? "100%" : "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity: isDisabled ? 0.6 : 1,
        cursor: isDisabled ? "not-allowed" : "pointer",
      }}
      {...props}
    >
      {icon && <span style={{ fontSize: size === "sm" ? 12 : 14 }}>{icon}</span>}
      {loading ? "Carregando..." : children}
    </button>
  );
}
