// components/configuracoes/LogoEmpresa.jsx — etapa 14c
// ⚙️ Configurações → 🏢 Empresa → Logomarca: aparece no cabeçalho dos documentos (relatório de inspeção, cumprimento,
// certificado, comprovante da avaliação, lista de presença… e, nas próximas etapas, os demais). 14c.1: qualquer tamanho — reduzida no navegador.
// Trocar/remover pede confirmação no modal do app.
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import { definirLogoEmpresa } from "../../utils/logoEmpresa";
import { comprimirImagem } from "../../utils/comprimirImagem"; // 14c.1

const lerArquivo = (file) => new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => falha(new Error("Não foi possível ler a imagem")); r.readAsDataURL(file); });

export default function LogoEmpresa({ C, s, onErro }) {
  const [logo, setLogo] = useState(undefined);
  const [empresa, setEmpresa] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [remover, setRemover] = useState(false);
  useEffect(() => { apiService.get("/configuracoes/logo").then((r) => { setLogo(r.logo || null); setEmpresa(r.empresa); }).catch((e) => { setLogo(null); onErro?.(e.message); }); }, []); // eslint-disable-line

  const enviar = async (file) => {
    if (!file) return; setMsg(null);
    if (!/^image\//.test(file.type)) return onErro?.("Envie uma imagem (PNG, JPG ou WEBP)");
    if (file.size > 25 * 1024 * 1024) return onErro?.("Imagem muito grande (acima de 25 MB) — escolha outra");
    setEnviando(true);
    try {
      // 14c.1: o sistema reduz sozinho (lado maior 600 px; PNG transparente continua PNG) — não precisa comprimir antes
      let url, mime;
      try { const c = await comprimirImagem(file, { lado: 600, qualidade: 0.9, manterTransparencia: true }); url = c.dataUrl; mime = c.mime; }
      catch { url = await lerArquivo(file); mime = file.type; }
      const r = await apiService.post("/configuracoes/logo", { base64: url.split(",")[1], mime }); setLogo(r.logo); definirLogoEmpresa(r.logo); setMsg("Logo salva — já sai nos documentos."); }
    catch (e) { onErro?.(e.message); } finally { setEnviando(false); }
  };
  return (
    <div style={{ ...s.card, padding: 18, marginTop: 16, maxWidth: 640 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🖼 Logomarca</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Vai no cabeçalho dos documentos: relatório de inspeção, cumprimento, certificado, comprovante da avaliação e lista de presença (os demais nas próximas etapas). PNG, JPG ou WEBP de qualquer tamanho — o sistema reduz sozinho. De preferência com fundo transparente ou branco.</div>
      {logo === undefined ? <div style={{ color: C.muted }}>Carregando…</div> : (
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, minWidth: 220, minHeight: 70, display: "flex", alignItems: "center", gap: 10 }}>
            {logo ? <img src={logo} alt="logo" style={{ maxHeight: 44, maxWidth: 180, objectFit: "contain" }} /> : <span style={{ color: "#999", fontSize: 12 }}>sem logo</span>}
            <div style={{ color: "#111", fontSize: 11 }}><b>{empresa?.razao_social || empresa?.nome || ""}</b><div style={{ color: "#666" }}>prévia do cabeçalho</div></div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label style={{ ...s.btn(!enviando, C.accent), cursor: enviando ? "wait" : "pointer" }}>{enviando ? "Enviando…" : logo ? "Trocar logo" : "Enviar logo"}
              <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} disabled={enviando} onChange={(e) => { enviar(e.target.files?.[0]); e.target.value = ""; }} /></label>
            {logo && <button type="button" onClick={() => setRemover(true)} style={{ ...s.btn(false), cursor: "pointer", color: C.danger }}>Remover</button>}
          </div>
        </div>
      )}
      {msg && <div style={{ color: C.success, fontSize: 12, marginTop: 10 }}>✓ {msg}</div>}
      {remover && (
        <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 20 }} onClick={() => setRemover(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: 420, maxWidth: "100%", padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.danger }}>⚠ Remover a logo?</div>
            <div style={{ fontSize: 13, color: C.textSub, marginTop: 8 }}>Os documentos voltam a sair só com o nome da empresa. Documentos já impressos não mudam.</div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button type="button" onClick={() => setRemover(false)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Voltar</button>
              <button type="button" onClick={async () => { setRemover(false); try { await apiService.delete("/configuracoes/logo"); setLogo(null); definirLogoEmpresa(null); setMsg("Logo removida."); } catch (e) { onErro?.(e.message); } }} style={{ ...s.btn(true, C.danger), cursor: "pointer", flex: 1 }}>Remover</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
