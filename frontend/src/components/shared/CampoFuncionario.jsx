// frontend/src/components/shared/CampoFuncionario.jsx — etapa 18zz.6: digitar o nome e escolher o FUNCIONÁRIO do cadastro (auto-sugestão)
//   valor = { nome, id } · id preenchido = rastreável (ligado ao cadastro). Digitar à mão solta o vínculo (id = null) e avisa.
//   lista = [{ id, usuario_id, nome, funcao? }] — funcionários ativos + usuários do sistema sem cadastro (18zz.7)
//   18zz.7: padrão do SaaS — a lista só abre DEPOIS de digitar (até 8 nomes; "continue digitando" se houver mais)
import { useMemo, useRef, useState } from "react";

const sem = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function CampoFuncionario({ nome, id, usuarioId = null, onChange, lista, C, s, placeholder = "Digite o nome…", desabilitado = false, explicarVazio = null }) {
  const [aberto, setAberto] = useState(false); const [ativo, setAtivo] = useState(0); const fechar = useRef(null);
  const t = sem(nome).trim();
  const todos = useMemo(() => (t ? (lista || []).filter((p) => sem(p.nome).includes(t)) : []), [t, lista]);
  const sug = todos.slice(0, 8);
  const escolher = (p) => { onChange({ nome: p.nome, id: p.id ?? null, usuario_id: p.usuario_id ?? null }); setAberto(false); };
  const ligado = (id != null && id !== "") || (usuarioId != null && usuarioId !== "");
  return (
    <div style={{ position: "relative" }}>
      <input value={nome || ""} disabled={desabilitado} placeholder={placeholder} autoComplete="off" style={{ ...s.input, paddingRight: 30 }}
        onChange={(e) => { onChange({ nome: e.target.value, id: null, usuario_id: null }); setAberto(true); setAtivo(0); }}
        onFocus={() => { clearTimeout(fechar.current); if (t && !ligado) setAberto(true); }}
        onBlur={() => { fechar.current = setTimeout(() => setAberto(false), 150); }}
        onKeyDown={(e) => {
          if (!aberto || !sug.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((a) => Math.min(a + 1, sug.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); escolher(sug[ativo]); }
          else if (e.key === "Escape") setAberto(false);
        }} />
      {nome && <span title={ligado ? "Ligado ao funcionário / usuário do sistema" : "Nome digitado — não está ligado a um funcionário"} style={{ position: "absolute", right: 10, top: 10, fontSize: 14 }}>{ligado ? "✓" : "⚠️"}</span>}
      {aberto && !desabilitado && t && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 30, marginTop: 4, background: C.card || C.bg, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.35)", maxHeight: 260, overflowY: "auto" }}>
          {lista == null ? <div style={{ padding: 10, fontSize: 12.5, color: C.textSub }}>Carregando funcionários…</div>
            : sug.length ? sug.map((p, i) => (
              <button key={p.id ?? `u${p.usuario_id}`} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(p)} onMouseEnter={() => setAtivo(i)}
                style={{ display: "block", width: "100%", textAlign: "left", background: i === ativo ? (C.accent + "22") : "transparent", border: "none", padding: "8px 12px", color: C.text, cursor: "pointer", fontSize: 13.5 }}>
                {p.nome}{p.funcao ? <span style={{ color: C.textSub, fontSize: 12 }}> · {p.funcao}</span> : null}
              </button>))
            : <div style={{ padding: 10, fontSize: 12.5, color: C.textSub }}>{explicarVazio?.(t) || "Ninguém com esse nome — cadastre o funcionário ou o usuário para ficar rastreável."}</div>}
          {todos.length > sug.length && <div style={{ padding: "6px 12px", fontSize: 11.5, color: C.muted }}>+{todos.length - sug.length} — continue digitando para filtrar</div>}
        </div>
      )}
      {nome && !ligado && !aberto && <div style={{ fontSize: 11.5, color: C.warn || "#f59e0b", marginTop: 4 }}>Nome digitado à mão — escolha da lista para ligar à pessoa (rastreável).</div>}
    </div>
  );
}
