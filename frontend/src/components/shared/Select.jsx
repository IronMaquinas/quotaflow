// components/shared/Select.jsx
// Componente Select reutilizável

import { useState } from "react";
import { estilos, CORES } from "../../utils/constants";

export default function Select({
  label,
  value,
  onChange,
  options = [],
  error,
  disabled = false,
  required = false,
  placeholder = "Selecione...",
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

      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...estilos.select,
          ...(focused ? estilos.inputFocus : {}),
          ...(error ? estilos.inputError : {}),
          ...(disabled ? { opacity: 0.6, cursor: "not-allowed" } : {}),
        }}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {error && (
        <div style={{ fontSize: 12, color: CORES.danger, marginTop: 6 }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
