// components/configuracoes/ConfigOcorrencias.jsx — etapa 18h.4a/4b/4c: ⚠️ ocorrências (INC), por origem
//   🏗 Locação (INC-LC → tarefa TSK-CM) · 🚛 Transporte (INC-TR → tarefa TSK-MT) — tipo da tarefa fixo pela origem.
//   • Perfis com acesso: veem e acompanham as ocorrências da origem (gestor e admin sempre). NÃO recebem e-mail.
//   • Quem é avisado por e-mail: só as pessoas escolhidas; a 1ª é a responsável pela tarefa.
//   Regra do SaaS: o perfil admin nunca recebe e-mail de rotina.
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import { SeletorPessoa } from "../shared/CampoPessoa";

const ORIGENS = [
  ["lc", "🏗 Locação (contrato)", "INC-LC", "TSK-CM · Comercial", "Avaria, pane, acidente… registrados pelo cliente ou pela empresa num contrato de locação."],
  ["tr", "🚛 Transporte (AT)", "INC-TR", "TSK-MT · Manutenção", "Ocorrências registradas pela ficha da AT durante a viagem."],
];

export default function ConfigOcorrencias({ C, s, onErro }) {
  const [d, setD] = useState(null); const [cfg, setCfg] = useState(null); const [salvo, setSalvo] = useState(null);
  const [salvando, setSalvando] = useState(false); const [ok, setOk] = useState(false); const [add, setAdd] = useState({ lc: "", tr: "" });
  const aplicar = (r) => { setD(r); const c = { lc: { perfis: r.lc.perfis, pessoas: r.lc.pessoas }, tr: { perfis: r.tr.perfis, pessoas: r.tr.pessoas } }; setCfg(c); setSalvo(JSON.stringify(c)); };
  useEffect(() => { apiService.get("/configuracoes/ocorrencias").then(aplicar).catch((e) => onErro?.(e.message)); }, []); // eslint-disable-line
  if (!d || !cfg) return null;
  const mudou = JSON.stringify(cfg) !== salvo;
  const muda = (k, campo, v) => { setCfg((x) => ({ ...x, [k]: { ...x[k], [campo]: v } })); setOk(false); };
  const togglePerfil = (k, p) => muda(k, "perfis", cfg[k].perfis.includes(p) ? cfg[k].perfis.filter((x) => x !== p) : [...cfg[k].perfis, p]);
  const nomeDe = (ref) => d.pessoas.find((p) => p.ref === ref);
  const salvar = async () => {
    setSalvando(true); setOk(false);
    try { aplicar(await apiService.put("/configuracoes/ocorrencias", cfg)); setOk(true); setTimeout(() => setOk(false), 3000); }
    catch (e) { onErro?.(e.message); } finally { setSalvando(false); }
  };
  const chip = (ativo) => ({ ...s.btn(ativo), padding: "5px 11px", fontSize: 12.5, cursor: "pointer" });
  const sub = { fontSize: 12.5, fontWeight: 600, marginBottom: 2, marginTop: 4 };
  const dica = { fontSize: 11.5, color: C.muted, marginBottom: 6 };
  return <div style={{ ...s.card, padding: 18, marginTop: 16 }}>
    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>⚠️ Ocorrências</div>
    {d.migrou === false && <div style={{ fontSize: 12.5, color: C.warn, marginBottom: 10 }}>⚠️ Rode a migration 069 para salvar.</div>}
    {ORIGENS.map(([k, titulo, inc, tarefa, txt]) => { const semEmail = cfg[k].pessoas.filter((r) => nomeDe(r) && !nomeDe(r).email);
      return <div key={k} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}><b style={{ fontSize: 14 }}>{titulo}</b><span style={{ fontSize: 12, color: C.muted }}>{inc}-AAAA-NNNN · gera tarefa <b>{tarefa}</b></span></div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{txt}</div>
        <div style={sub}>👁 Perfis com acesso</div>
        <div style={dica}>Veem e acompanham estas ocorrências. Não recebem e-mail. Gestor e Administrador sempre têm acesso.</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>{Object.entries(d.perfis_disponiveis).map(([p, nome]) => <button key={p} type="button" aria-pressed={cfg[k].perfis.includes(p)} onClick={() => togglePerfil(k, p)} style={chip(cfg[k].perfis.includes(p))}>{nome}</button>)}</div>
        <div style={sub}>📧 Quem é avisado por e-mail</div>
        <div style={dica}>Só estas pessoas recebem o e-mail. A 1ª (👤) é a responsável pela tarefa no ✅ Plano.</div>
        {cfg[k].pessoas.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          {cfg[k].pessoas.map((ref, i) => { const p = nomeDe(ref); return <span key={ref} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${i === 0 ? C.accent : C.border}`, borderRadius: 14, padding: "3px 10px", fontSize: 12.5 }}>
            {i === 0 && <span title="Responsável pela tarefa">👤</span>}{p?.nome || ref}
            {i > 0 && <button type="button" title="Tornar responsável" onClick={() => muda(k, "pessoas", [ref, ...cfg[k].pessoas.filter((x) => x !== ref)])} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 0, fontSize: 11.5 }}>tornar 👤</button>}
            <button type="button" aria-label={`Tirar ${p?.nome || ref}`} onClick={() => muda(k, "pessoas", cfg[k].pessoas.filter((x) => x !== ref))} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 0 }}>✕</button></span>; })}
        </div>}
        <div style={{ maxWidth: 360 }}><SeletorPessoa C={C} s={s} rotulo={`Adicionar pessoa — ${titulo}`} vazio="Adicionar pessoa…" placeholder="Digite o nome…"
          opcoes={d.pessoas.filter((p) => !cfg[k].pessoas.includes(p.ref)).map((p) => ({ id: p.ref, nome: p.nome, detalhe: [p.funcao, p.email || "sem e-mail"].filter(Boolean).join(" · ") }))}
          valor={add[k]} onChange={(id) => { if (id) muda(k, "pessoas", [...cfg[k].pessoas, id]); setAdd((x) => ({ ...x, [k]: "" })); }} /></div>
        {!cfg[k].pessoas.length && <div style={{ fontSize: 12, color: C.warn, marginTop: 6 }}>⚠️ Ninguém será avisado por e-mail e a tarefa fica sem responsável — a ocorrência aparece só na tela.</div>}
        {semEmail.length > 0 && <div style={{ fontSize: 12, color: C.warn, marginTop: 6 }}>⚠️ {semEmail.map((r) => nomeDe(r).nome).join(", ")} sem e-mail no cadastro — não recebe o aviso.</div>}
      </div>; })}
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <button type="button" onClick={salvar} disabled={salvando || d.migrou === false || !mudou} style={{ ...s.btn(!salvando && mudou), padding: "9px 18px", fontSize: 13, cursor: mudou ? "pointer" : "default" }}>{salvando ? "Salvando…" : "Salvar"}</button>
      {ok && <span style={{ fontSize: 12.5, color: C.success || "#16a34a" }}>✓ salvo</span>}
      {mudou && !ok && <span style={{ fontSize: 12.5, color: C.warn }}>alterações não salvas</span>}
    </div>
  </div>;
}
