// components/shared/ConfirmarExclusao.jsx — etapa 18ze: 🗑 modal padrão "Excluir esta foto?" (Cancelar | Excluir)
//   Padrão do QuotaFlow para fotos/anexos: o ✕ NUNCA apaga direto — no campo (sol, chuva, em cima do caminhão) um toque sem
//   querer não pode sumir com a foto. Mostra a miniatura do que vai ser excluído. Nunca window.confirm.
export default function ConfirmarExclusao({ C, s, titulo = "Excluir esta foto?", texto = "Se excluir, terá que tirar de novo.", imagem = null, rotulo = "Excluir", ocupado = false, onConfirmar, onCancelar, z = 1400 }) {
  return <div onClick={(e) => { e.stopPropagation(); if (!ocupado) onCancelar?.(); }} style={{ position: "fixed", inset: 0, background: "#000000aa", zIndex: z, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={titulo} style={{ ...s.card, background: C.card || C.surface || "#111827", width: 380, maxWidth: "100%", padding: 20, textAlign: "center" }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10, color: C.text }}>{titulo}</div>
      {imagem && <img src={imagem} alt="" style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 8, border: `1px solid ${C.border}` }} />}
      {texto && <div style={{ fontSize: 12.5, color: C.textSub, margin: "8px 0 14px" }}>{texto}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: texto ? 0 : 14 }}>
        <button type="button" disabled={ocupado} onClick={onCancelar} style={{ ...s.btn(false), flex: 1, padding: "12px 16px", fontSize: 14, color: C.text, cursor: "pointer" }}>Cancelar</button>
        <button type="button" disabled={ocupado} onClick={onConfirmar} style={{ ...s.btn(true, C.danger), flex: 1, padding: "12px 16px", fontSize: 14, background: C.danger, borderColor: C.danger, color: "#fff", cursor: "pointer" }}>{ocupado ? "Excluindo…" : rotulo}</button>
      </div>
    </div>
  </div>;
}
