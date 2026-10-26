// components/shared/CampoTelefone.jsx
//
// Telefone com seletor de país (etapa 11a.3) — o mesmo react-phone-number-input
// e o mesmo tema escuro (components/usuarios/phone-input.css) da tela de Usuários
// e do Meu Perfil. Grava no formato internacional E.164 (ex.: +5521999990000),
// que também faz os links do WhatsApp (wa.me) funcionarem.
//
// Aceita valor antigo/formatado ("(21) 99999-0000", "2133334444" da Receita):
// converte para +55… ao exibir, para o componente não reclamar.

import PhoneInput, { parsePhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import "../usuarios/phone-input.css";

export function paraE164(valor) {
  const v = String(valor || "").trim();
  if (!v) return "";
  if (v.startsWith("+")) return "+" + v.replace(/\D/g, "");
  const d = v.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return "+55" + d;          // DDD + número (Brasil)
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return "+" + d;
  return "";
}

export default function CampoTelefone({ value, onChange, placeholder = "(11) 99999-9999", C = {}, altura = 40, disabled = false }) {
  return (
    <PhoneInput
      international
      defaultCountry="BR"
      value={paraE164(value)}
      onChange={(v) => onChange(v || "")}
      placeholder={placeholder}
      disabled={disabled}
      className="phone-input-dark"
      style={{
        background: C.bg || "#0a0e14",
        border: `1px solid ${C.border || "#1e2535"}`,
        borderRadius: 6,
        padding: "0 12px",
        height: altura,
        fontSize: 14,
        display: "flex",
        alignItems: "center",
        color: C.text || "#e2e8f0",
        boxSizing: "border-box",
        opacity: disabled ? 0.7 : 1,
      }}
    />
  );
}

// 14d.4: telefone para EXIBIR (só leitura) — bandeira + formato internacional ("🇧🇷 +55 22 98107-9814")
const bandeira = (pais) => (pais ? String.fromCodePoint(...[...pais.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "");
export function telefoneExibir(valor) {
  const e = paraE164(valor); if (!e) return valor || "";
  try { const p = parsePhoneNumber(e); if (p) return `${bandeira(p.country)} ${p.formatInternational()}`.trim(); } catch { /* ok */ }
  return e;
}
