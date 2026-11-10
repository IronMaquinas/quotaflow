// components/shared/TextoComPlano.jsx — etapa 18t.1: mostra uma mensagem trocando "⭐ Meu plano" por um link que abre a tela
import { irParaMeuPlano } from "../../utils/modulosSessao";

export default function TextoComPlano({ texto, C }) {
  const t = String(texto ?? ""); const i = t.indexOf("⭐ Meu plano");
  if (i < 0) return t;
  return <>{t.slice(0, i)}<button type="button" onClick={irParaMeuPlano} style={{ background: "none", border: "none", padding: 0, color: C?.accent || "#3b82f6", textDecoration: "underline", cursor: "pointer", font: "inherit", fontWeight: 700 }}>⭐ Meu plano</button>{t.slice(i + "⭐ Meu plano".length)}</>;
}
