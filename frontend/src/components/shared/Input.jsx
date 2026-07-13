// components/shared/Input.jsx
// Componente Input reutilizável com label, validação, erro

import { useState } from "react";
import { estilos, CORES } from "../../utils/constants";

export default function Input({
  label,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
  disabled = false,
  required = false,
  icon,
  onBlur,
  onFocus,
  maxLength,
  autoComplete,
  ...props
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={estilos.label}>
          {label}
          {required && <span style={{ color: CORES.danger }}>*</span>}
        </label>
      )}

      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        {icon && (
          <span
            style={{
              position: "absolute",
              left: 12,
              color: CORES.muted,
              fontSize: 14,
              pointerEvents: "none",
            }}
          >
            {icon}
          </span>
        )}

        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          autoComplete={autoComplete}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={{
            ...estilos.input,
            ...(icon ? { paddingLeft: 36 } : {}),
            ...(focused ? estilos.inputFocus : {}),
            ...(error ? estilos.inputError : {}),
            ...(disabled ? { opacity: 0.6, cursor: "not-allowed" } : {}),
          }}
          {...props}
        />
      </div>

      {error && (
        <div style={{ fontSize: 12, color: CORES.danger, marginTop: 6 }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
