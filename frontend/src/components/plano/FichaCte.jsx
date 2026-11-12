// components/plano/FichaCte.jsx — etapa 18g.3: 📋 ficha do CT-e — tudo o que o emissor pede, com 📋 copiar por campo, PDF e CSV
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import { abrirFichaCte, csvFichaCte } from "../../utils/gerarFichaCte";

export default function FichaCte({ C, s, tarefaId, onFechar }) {
  const [f, setF] = useState(null); const [erro, setErro] = useState(null); const [copiado, setCopiado] = useState(null);
  const [ed, setEd] = useState({}); // 18g.4: o funcionário confere e corrige os sugeridos (CFOP, CST, alíquota…) — vale para copiar, PDF e CSV
  const num = (v) => Number(String(v || "").replace(/\./g, "").replace(",", ".")); const brl = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fEd = !f ? null : { ...f, secoes: f.secoes.map((sec) => { const vals = Object.fromEntries(sec.campos.filter((c) => c.chave).map((c) => [c.chave, ed[c.chave] ?? c.valor]));
    const recalc = ("aliquota" in ed || "base" in ed) && !("icms" in ed) && vals.base && vals.aliquota ? brl(Math.round(num(vals.base) * num(vals.aliquota)) / 100) : null;
    return { ...sec, campos: sec.campos.map((c) => (c.chave === "icms" && recalc != null ? { ...c, valor: recalc, falta: false } : c.chave && c.chave in ed ? { ...c, valor: ed[c.chave], falta: !ed[c.chave] } : c)) }; }) };
  useEffect(() => { apiService.get(`/tarefas/${tarefaId}/fiscal/ficha-cte`).then(setF).catch((e) => setErro(e.message)); }, [tarefaId]);
  const copiar = async (v, k) => { try { await navigator.clipboard.writeText(v); } catch { const t = document.createElement("textarea"); t.value = v; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); } setCopiado(k); setTimeout(() => setCopiado((x) => (x === k ? null : x)), 1500); };
  const csv = () => { const url = URL.createObjectURL(new Blob([csvFichaCte(fEd)], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `ficha-cte-${f.pedido.numero}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); };
  return <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 1100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
    <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Ficha do CT-e" style={{ ...s.card, width: 760, maxWidth: "100%", padding: 20, marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>📋 Ficha do CT-e</div>
        {f && <><button type="button" onClick={() => { try { abrirFichaCte(fEd); } catch (e) { setErro(e.message); } }} style={{ ...s.btn(false), padding: "6px 12px", fontSize: 12.5 }}>🖨 PDF</button>
          <button type="button" onClick={csv} style={{ ...s.btn(false), padding: "6px 12px", fontSize: 12.5 }}>⬇ CSV</button></>}
        <button type="button" onClick={onFechar} aria-label="Fechar" style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
      </div>
      {erro ? <div style={{ color: C.danger }}>{erro}</div> : !f ? <div style={{ color: C.muted }}>Carregando…</div> : <>
        <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 10 }}>{f.pedido.numero}{f.trecho ? ` · ${f.trecho}` : ""}{f.at ? ` · ${f.at.numero}` : " · sem AT ainda"} · {f.nfes ? `${f.nfes} NF-e lida(s)` : "sem XML de NF-e (remetente/destinatário/carga ficam incompletos)"}. Clique em 📋 para copiar e colar no emissor.</div>
        {!f.migrou && <div style={{ fontSize: 12.5, color: C.warning || "#f59e0b", marginBottom: 8 }}>⚠ Rode a migration 080 e preencha ⚙️ Configurações → Dados do CT-e (IE, UF, RNTRC, CFOP, ICMS) e as apólices.</div>}
        {f.faltam.length > 0 && <div style={{ fontSize: 12.5, color: C.warning || "#f59e0b", background: `${C.warning || "#f59e0b"}14`, border: `1px solid ${C.warning || "#f59e0b"}55`, borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>⚠ {f.faltam.length} campo(s) sem dado no sistema — preencha direto no emissor (ou complete o cadastro).</div>}
        {f.aviso_tributario && <div style={{ fontSize: 12, color: C.textSub, background: `${C.accent}10`, border: `1px solid ${C.accent}40`, borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>🧮 Campos com ✎ são <b>sugeridos</b> e podem ser corrigidos aqui (a correção vai para o PDF e o CSV). {f.aviso_tributario}</div>}
        {fEd.secoes.map((sec) => <div key={sec.id} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{sec.titulo}</div>
          {sec.campos.map((c, i) => { const k = `${sec.id}-${i}`;
            return <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: `1px solid ${C.border}`, fontSize: 13 }}>
              <div style={{ width: "38%", color: C.textSub, flexShrink: 0 }}>{c.editavel ? "✎ " : ""}{c.rotulo}{c.dica && <div style={{ fontSize: 11, color: C.muted }}>{c.dica}</div>}</div>
              {c.editavel ? <div style={{ flex: 1, minWidth: 0 }}><input aria-label={c.rotulo} value={c.valor} placeholder="⚠ falta" onChange={(e) => setEd((x) => ({ ...x, [c.chave]: e.target.value }))} style={{ ...s.input, marginBottom: 0, padding: "5px 8px", fontFamily: "Consolas, monospace", fontSize: 13, borderColor: c.chave in ed ? C.accent : C.border }} /></div>
                : <div style={{ flex: 1, minWidth: 0, fontFamily: "Consolas, monospace", wordBreak: "break-all", color: c.falta ? (C.warning || "#f59e0b") : C.text }}>{c.valor || (c.falta ? "⚠ falta" : "—")}</div>}
              {c.valor && <button type="button" onClick={() => copiar(c.valor, k)} aria-label={`Copiar ${c.rotulo}`} title="Copiar" style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, color: copiado === k ? (C.success || "#22c55e") : C.textSub, cursor: "pointer", padding: "3px 8px", fontSize: 12, flexShrink: 0 }}>{copiado === k ? "✓ copiado" : "📋"}</button>}
            </div>; })}
        </div>)}
        <div style={{ fontSize: 11.5, color: C.muted }}>Gerado do pedido, da AT e das NF-e da tarefa. Confira no emissor antes de transmitir. O XML do CT-e (importar direto no emissor) fica para uma próxima etapa.</div>
      </>}
    </div>
  </div>;
}
