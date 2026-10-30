// components/programacao/VerArquivo.jsx — etapa 16c
// 👁 Visualizador dentro do sistema: PDF (iframe), imagem, XML (formatado). Para conferir se subiu a NF-e certa, a CNH certa…
// + ChipDoc: chip de documento (CNH/CRLV do cadastro ou NF-e/CT-e/MDF-e) com cor de status — sempre clicável:
//   tem arquivo → abre no visualizador · não tem → ação (anexar / dica de onde cadastrar).
import { useState, useEffect } from "react";

const tipoDe = (mime, nome, url) => {
  const t = `${mime || ""} ${nome || ""} ${String(url || "").split("?")[0]}`.toLowerCase();
  if (/pdf/.test(t)) return "pdf"; if (/xml/.test(t)) return "xml"; if (/png|jpe?g|image/.test(t)) return "img"; return "outro";
};
const formatarXml = (x) => {
  let n = 0; return String(x).replace(/>\s*</g, ">\n<").split("\n").map((l) => {
    if (/^<\//.test(l)) n = Math.max(n - 1, 0); const r = "  ".repeat(n) + l;
    if (/^<[^!?/][^>]*[^/]>$/.test(l) && !/<\/[^>]+>$/.test(l)) n++; return r;
  }).join("\n");
};

export default function VerArquivo({ C, s, arquivo, onFechar }) {
  const { url, nome, mime } = arquivo || {};
  const tipo = tipoDe(mime, nome, url);
  const [xml, setXml] = useState(null);
  useEffect(() => { if (tipo === "xml" && url) fetch(url).then((r) => r.text()).then((t) => setXml(formatarXml(t))).catch(() => setXml("Não deu para ler o XML aqui — use “Abrir em nova aba”.")); }, [url, tipo]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000b0", zIndex: 420, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }} onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: 960, maxWidth: "100%", height: "90vh", padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
          <b style={{ flex: 1, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.text }}>👁 {nome || "Arquivo"}</b>
          {url && <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.accent }}>Abrir em nova aba ↗</a>}
          <button type="button" onClick={onFechar} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ flex: 1, background: "#525659", overflow: "auto", display: "flex", alignItems: tipo === "img" ? "center" : "stretch", justifyContent: "center" }}>
          {!url ? <div style={{ color: "#fff", padding: 24 }}>Carregando…</div>
            : tipo === "pdf" ? <iframe title={nome || "arquivo"} src={url} style={{ border: "none", width: "100%", height: "100%" }} />
            : tipo === "img" ? <img alt={nome || ""} src={url} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            : tipo === "xml" ? <pre style={{ margin: 0, padding: 16, width: "100%", background: "#0f172a", color: "#e2e8f0", fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{xml ?? "Carregando…"}</pre>
            : <div style={{ color: "#fff", padding: 24 }}>Este tipo de arquivo não abre aqui — use “Abrir em nova aba”.</div>}
        </div>
      </div>
    </div>
  );
}

export const COR_DOC = (C) => ({ ok: C.success, vence: C.warn, vencido: C.danger, ausente: C.danger, falta: C.muted });
export const TXT_DOC = { ok: "válido", vence: "vence em até 30 dias", vencido: "vencido na data da viagem", ausente: "não cadastrado", falta: "não anexado" };
/** chip de documento — sempre com ação (onClick obrigatório) */
export function ChipDoc({ C, status, rotulo, title, onClick, carregando }) {
  const cor = COR_DOC(C)[status] || C.muted;
  const ic = status === "ok" ? "✓" : status === "vence" ? "⚠" : status === "falta" ? "＋" : "!";
  return <button type="button" title={title} onClick={(e) => { e.stopPropagation(); onClick?.(e); }} disabled={carregando}
    style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 5, border: `1px solid ${cor}`, color: cor, background: status === "falta" ? "transparent" : `${cor}14`, cursor: "pointer", whiteSpace: "nowrap", fontWeight: 600, lineHeight: 1.4 }}>
    {carregando ? "…" : ic} {rotulo}</button>;
}
