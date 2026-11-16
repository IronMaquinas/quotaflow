// frontend/src/components/shared/CampoFuncionario.jsx — etapa 18zz.6: digitar o nome e escolher o FUNCIONÁRIO do cadastro (auto-sugestão)
//   valor = { nome, id } · id preenchido = rastreável (ligado ao cadastro). Digitar à mão solta o vínculo (id = null) e avisa.
//   lista = [{ id, nome, funcao? }] (colaboradores ativos)
import { useMemo, useRef, useState } from "react";

const sem = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function CampoFuncionario({ nome, id, onChange, lista, C, s, placeholder = "Digite o nome…", desabilitado = false }) {
  const [aberto, setAberto] = useState(false); const [ativo, setAtivo] = useState(0); const fechar = useRef(null);
  const sug = useMemo(() => { const t = sem(nome).trim(); return (lista || []).filter((p) => !t || sem(p.nome).includes(t)).slice(0, 8); }, [nome, lista]);
  const escolher = (p) => { onChange({ nome: p.nome, id: p.id }); setAberto(false); };
  const ligado = id != null && id !== "";
  return (
    <div style={{ position: "relative" }}>
      <input value={nome || ""} disabled={desabilitado} placeholder={placeholder} autoComplete="off" style={{ ...s.input, paddingRight: 30 }}
        onChange={(e) => { onChange({ nome: e.target.value, id: null }); setAberto(true); setAtivo(0); }}
        onFocus={() => { clearTimeout(fechar.current); setAberto(true); }}
        onBlur={() => { fechar.current = setTimeout(() => setAberto(false), 150); }}
        onKeyDown={(e) => {
          if (!aberto || !sug.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((a) => Math.min(a + 1, sug.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); escolher(sug[ativo]); }
          else if (e.key === "Escape") setAberto(false);
        }} />
      {nome && <span title={ligado ? "Ligado ao cadastro de funcionários" : "Nome digitado — não está ligado a um funcionário"} style={{ position: "absolute", right: 10, top: 10, fontSize: 14 }}>{ligado ? "✓" : "⚠️"}</span>}
      {aberto && !desabilitado && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 30, marginTop: 4, background: C.card || C.bg, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.35)", maxHeight: 260, overflowY: "auto" }}>
          {lista == null ? <div style={{ padding: 10, fontSize: 12.5, color: C.textSub }}>Carregando funcionários…</div>
            : sug.length ? sug.map((p, i) => (
              <button key={p.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(p)} onMouseEnter={() => setAtivo(i)}
                style={{ display: "block", width: "100%", textAlign: "left", background: i === ativo ? (C.accent + "22") : "transparent", border: "none", padding: "8px 12px", color: C.text, cursor: "pointer", fontSize: 13.5 }}>
                {p.nome}{p.funcao ? <span style={{ color: C.textSub, fontSize: 12 }}> · {p.funcao}</span> : null}
              </button>))
            : <div style={{ padding: 10, fontSize: 12.5, color: C.textSub }}>Nenhum funcionário com esse nome — cadastre em 👷 Pessoas para ficar rastreável.</div>}
        </div>
      )}
      {nome && !ligado && !aberto && <div style={{ fontSize: 11.5, color: C.warn || "#f59e0b", marginTop: 4 }}>Nome digitado à mão — escolha da lista para ligar ao funcionário (rastreável).</div>}
    </div>
  );
}
