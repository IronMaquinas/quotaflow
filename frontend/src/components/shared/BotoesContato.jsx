// components/shared/BotoesContato.jsx — etapa B1.10: 📞 ligar · 💬 WhatsApp · ✉ e-mail com um toque (sem copiar e colar)
//   Telefone brasileiro sem DDI ganha +55. Usado na ficha do colaborador e nas respostas da 👋 Beta.
export const soDigitos = (v) => String(v || "").replace(/\D/g, "");
export function telInternacional(v) { const d = soDigitos(v); if (!d) return null; if (d.length >= 12) return d; if (d.length === 10 || d.length === 11) return `55${d}`; return d; }
export function formatarTelefone(v) { const d = soDigitos(v); if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`; return v || ""; }

export default function BotoesContato({ C, telefone, email, whatsapp = true, tamanho = 12 }) {
  const t = telInternacional(telefone); const est = (cor) => ({ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 999, border: `1px solid ${cor}55`, background: `${cor}14`, color: cor, fontSize: tamanho, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" });
  if (!t && !email) return null;
  return (
    <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
      {t && <a href={`tel:+${t}`} style={est(C.accent)} title="Ligar">📞 Ligar</a>}
      {t && whatsapp && <a href={`https://wa.me/${t}`} target="_blank" rel="noreferrer" style={est("#22c55e")} title="Abrir conversa no WhatsApp">💬 WhatsApp</a>}
      {email && <a href={`mailto:${email}`} style={est("#a78bfa")} title="Escrever e-mail">✉ E-mail</a>}
    </span>
  );
}
