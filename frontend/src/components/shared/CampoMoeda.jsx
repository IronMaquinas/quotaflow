// components/shared/CampoMoeda.jsx — etapa 14d.1
// Campo de valor em reais com máscara "R$ 1.234,56" enquanto digita (os dígitos entram pelos centavos).
// value / onChange trabalham com NÚMERO (ou "" vazio) — o servidor recebe número, sem vírgula nem ponto.
const fmt = (n) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CampoMoeda({ value, onChange, disabled, style, placeholder = "R$ 0,00" }) {
  const vazio = value === "" || value == null || Number.isNaN(Number(value));
  return (
    <input inputMode="numeric" disabled={disabled} placeholder={placeholder} style={style}
      value={vazio ? "" : fmt(value)}
      onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); onChange(d ? Number(d) / 100 : ""); }} />
  );
}
