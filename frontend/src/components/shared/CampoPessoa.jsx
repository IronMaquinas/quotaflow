// components/shared/CampoPessoa.jsx — etapa 18g.2a: 👤 escolher uma pessoa do cadastro digitando o nome
//   pessoas: [{ ref: 'c:12' | 'u:5', nome, funcao, email, login, afastado }] (GET /api/tarefas/pessoas)
//   valor: { nome, ref } — ref null = texto livre (ex.: "Time fiscal"), não ligado ao cadastro
//   A lista abre "flutuando" (position: fixed) para não ser cortada dentro de modal com rolagem.
//   18g.2b: autocomplete puro — nada abre até digitar a primeira letra; no máximo 8 sugestões.
//   ↑ ↓ para navegar, Enter escolhe, Esc fecha. Busca sem acento, por nome, função ou e-mail.
import { useState, useRef, useEffect } from "react";

const sem = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function CampoPessoa({ C, s, pessoas = [], valor = { nome: "", ref: null }, onChange, placeholder = "Digite o nome…", rotulo = "Responsável", livre = true }) {
  const [aberto, setAberto] = useState(false);
  const [i, setI] = useState(0);
  const caixa = useRef(null); const campo = useRef(null);
  const [pos, setPos] = useState(null);
  const medir = () => { const r = campo.current?.getBoundingClientRect?.(); if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width }); };
  useEffect(() => { if (!aberto) return; medir(); const f = () => medir(); window.addEventListener("resize", f); window.addEventListener("scroll", f, true); return () => { window.removeEventListener("resize", f); window.removeEventListener("scroll", f, true); }; }, [aberto]); // eslint-disable-line
  const termo = sem(valor.nome).trim();
  const lista = termo ? pessoas.filter((p) => termo.split(/\s+/).every((w) => sem(`${p.nome} ${p.funcao || ""} ${p.email || ""}`).includes(w))).slice(0, 8) : []; // 18g.2b: só abre depois da 1ª letra
  const sel = valor.ref ? pessoas.find((p) => p.ref === valor.ref) : null;
  const escolher = (p) => { onChange?.({ nome: p.nome, ref: p.ref }); setAberto(false); };
  const tecla = (e) => {
    if (!aberto && ["ArrowDown", "ArrowUp"].includes(e.key)) { setAberto(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, lista.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
    else if (e.key === "Enter" && aberto && lista[i]) { e.preventDefault(); escolher(lista[i]); }
    else if (e.key === "Escape") setAberto(false);
  };
  return <div ref={caixa} style={{ position: "relative" }} onBlur={(e) => { if (!caixa.current?.contains(e.relatedTarget)) setTimeout(() => setAberto(false), 120); }}>
    <input ref={campo} type="text" role="combobox" aria-expanded={aberto} aria-label={rotulo} autoComplete="off" value={valor.nome}
      onChange={(e) => { onChange?.({ nome: e.target.value, ref: null }); setAberto(true); setI(0); }} onFocus={() => setAberto(true)} onKeyDown={tecla}
      placeholder={placeholder} style={{ ...s.input, marginBottom: 0, borderColor: sel ? `${C.success}88` : undefined }} />
    {aberto && lista.length > 0 && <div role="listbox" style={{ position: "fixed", zIndex: 1000, top: pos?.top ?? 0, left: pos?.left ?? 0, width: pos?.width ?? 280, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: "0 12px 28px #00000070", maxHeight: 280, overflowY: "auto" }}>
      {lista.map((p, k) => <div key={p.ref} role="option" aria-selected={k === i} tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); escolher(p); }} onMouseEnter={() => setI(k)}
        style={{ padding: "8px 12px", cursor: "pointer", background: k === i ? `${C.accent}22` : "transparent", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{p.nome}{p.afastado ? <span style={{ color: C.warn, fontWeight: 400 }}> · afastado</span> : null}</div>
        <div style={{ fontSize: 11, color: C.muted }}>{[p.funcao, p.email, p.login ? "🔑 com login" : "👷 sem login"].filter(Boolean).join(" · ")}</div>
      </div>)}
    </div>}
    {aberto && termo && !lista.length && <div style={{ position: "fixed", zIndex: 1000, top: pos?.top ?? 0, left: pos?.left ?? 0, width: pos?.width ?? 280, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: C.muted }}>
      Ninguém com esse nome no cadastro{livre ? " — fica como texto livre" : ""}.</div>}
    <div style={{ fontSize: 11, marginTop: 4, color: sel ? C.success : C.muted, minHeight: 14 }}>
      {sel ? `✓ ${sel.funcao ? `${sel.funcao} · ` : ""}${sel.login ? "com login (vê em 👤 Minhas tarefas)" : "colaborador sem login"}` : valor.nome.trim() ? (livre ? "texto livre — não ligado ao cadastro" : "escolha alguém da lista") : ""}
    </div>
  </div>;
}
