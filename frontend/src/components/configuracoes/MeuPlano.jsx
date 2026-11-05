// components/configuracoes/MeuPlano.jsx — etapa 18j: ⭐ Meu plano
//   O que a empresa tem (✓) e o que pode contratar (🔒 → Fale conosco), por área: Comercial · Suprimentos · Operações ·
//   Qualidade · Pessoas · Inteligência e IA. Vitrine para contratar módulos depois — quem liga é o Console da Plataforma.
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";

export default function MeuPlano({ C, s }) {
  const [d, setD] = useState(null); const [erro, setErro] = useState(null);
  useEffect(() => { apiService.get("/configuracoes/modulos").then(setD).catch((e) => setErro(e.message)); }, []);
  if (erro) return <div style={{ padding: 24, color: C.danger }}>{erro}</div>;
  if (!d) return <div style={{ padding: 24, color: C.muted }}>Carregando…</div>;
  const contatar = (m) => {
    const assunto = encodeURIComponent(`Quero conhecer o módulo ${m ? m.nome : "QuotaFlow"}`);
    if (d.contato) window.location.href = `mailto:${d.contato}?subject=${assunto}`;
  };
  const ativosN = d.areas.reduce((n, a) => n + a.modulos.filter((m) => m.ativo).length, 0);
  return <div style={{ padding: "22px 24px", maxWidth: 980 }}>
    <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>MEU PLANO</div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>⭐ {d.plano_nome}</div>
      <div style={{ fontSize: 13, color: C.textSub }}>{ativosN} módulo(s) ativo(s)</div>
    </div>
    <div style={{ fontSize: 13, color: C.textSub, marginBottom: 18, maxWidth: 720 }}>O QuotaFlow é montado por módulos: você usa só o que precisa e liga outros quando quiser. Os marcados com 🔒 estão disponíveis para contratar.
      {d.contato ? <> Fale com a gente em <a href={`mailto:${d.contato}`} style={{ color: C.accent }}>{d.contato}</a>.</> : " Fale com o seu consultor QuotaFlow."}</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 12 }}>
      {d.areas.map((a) => { const n = a.modulos.filter((m) => m.ativo).length;
        return <div key={a.id} style={{ ...s.card, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", marginBottom: 8 }}><b style={{ fontSize: 15, flex: 1 }}>{a.nome}</b><span style={{ fontSize: 12, color: n ? (C.success || "#22c55e") : C.muted }}>{n ? `${n}/${a.modulos.length} ativo(s)` : "não contratado"}</span></div>
          {a.modulos.map((m) => <div key={m.id} style={{ display: "flex", gap: 10, padding: "7px 0", borderTop: `1px solid ${C.border}`, opacity: m.ativo ? 1 : 0.8 }}>
            <span style={{ width: 20, flex: "0 0 20px", textAlign: "center", fontSize: 13, color: m.ativo ? (C.success || "#22c55e") : C.muted }}>{m.ativo ? "✓" : "🔒"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: m.ativo ? C.text : C.textSub }}>{m.nome}{m.futuro && <span style={{ marginLeft: 6, fontSize: 10.5, color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 8, padding: "0 6px" }}>em breve</span>}</div>
              <div style={{ fontSize: 11.5, color: C.muted }}>{m.desc}</div>
            </div>
            {!m.ativo && d.contato && <button type="button" onClick={() => contatar(m)} style={{ background: "none", border: `1px solid ${C.accent}`, color: C.accent, borderRadius: 6, padding: "3px 9px", fontSize: 11.5, cursor: "pointer", alignSelf: "center", whiteSpace: "nowrap" }}>Fale conosco</button>}
          </div>)}
        </div>; })}
    </div>
  </div>;
}
