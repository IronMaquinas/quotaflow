// components/configuracoes/ConfigOcorrencias.jsx — etapa 18h.4a: ⚠️ quem recebe as ocorrências (INC), por origem
//   🏗 Locação (contrato) e 🚛 Transporte (AT): perfis, pessoas do cadastro e/ou funções recebem o e-mail;
//   a 1ª pessoa escolhida vira a responsável da tarefa; tipo da tarefa (TSK-CM, TSK-MT…).
//   Regra do SaaS: o perfil admin nunca recebe e-mail de rotina (cuida do sistema).
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import { SeletorPessoa } from "../shared/CampoPessoa";

const ORIGENS = [["lc", "🏗 Locação (contrato)", "Avaria, pane, acidente… registrados pelo cliente ou pela empresa num contrato de locação."], ["tr", "🚛 Transporte (AT)", "Ocorrências registradas pela ficha da AT durante a viagem."]];
const TIPO_NOME = { MT: "TSK-MT · Manutenção", CM: "TSK-CM · Comercial", GN: "TSK-GN · Geral", NC: "TSK-NC · Não conformidade" };

export default function ConfigOcorrencias({ C, s, onErro }) {
  const [d, setD] = useState(null); const [cfg, setCfg] = useState(null);
  const [salvando, setSalvando] = useState(false); const [ok, setOk] = useState(false);
  const [add, setAdd] = useState({ lc: "", tr: "" }); const [fn, setFn] = useState({ lc: "", tr: "" });
  const aplicar = (r) => { setD(r); setCfg({ lc: r.lc, tr: r.tr }); };
  useEffect(() => { apiService.get("/configuracoes/ocorrencias").then(aplicar).catch((e) => onErro?.(e.message)); }, []); // eslint-disable-line
  if (!d || !cfg) return null;
  const muda = (k, campo, v) => { setCfg((x) => ({ ...x, [k]: { ...x[k], [campo]: v } })); setOk(false); };
  const togglePerfil = (k, p) => muda(k, "perfis", cfg[k].perfis.includes(p) ? cfg[k].perfis.filter((x) => x !== p) : [...cfg[k].perfis, p]);
  const nomeDe = (ref) => d.pessoas.find((p) => p.ref === ref);
  const salvar = async () => {
    setSalvando(true); setOk(false);
    try { aplicar(await apiService.put("/configuracoes/ocorrencias", cfg)); setOk(true); setTimeout(() => setOk(false), 3000); }
    catch (e) { onErro?.(e.message); } finally { setSalvando(false); }
  };
  const chip = (ativo) => ({ ...s.btn(ativo), padding: "5px 11px", fontSize: 12.5, cursor: "pointer" });
  return <div style={{ ...s.card, padding: 18, marginTop: 16 }}>
    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>⚠️ Ocorrências — quem recebe</div>
    <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12 }}>Quando alguém registra uma ocorrência (INC), quem está aqui recebe o <b>e-mail</b> com os contatos para agir na hora, e a <b>1ª pessoa escolhida</b> fica responsável pela tarefa no ✅ Plano. O perfil <b>Administrador não recebe</b> e-mail de rotina — ele cuida do sistema.</div>
    {d.migrou === false && <div style={{ fontSize: 12.5, color: C.warn, marginBottom: 10 }}>⚠️ Rode a migration 069 para salvar — até lá vale o padrão (locação → Comercial, transporte → Operação).</div>}
    {ORIGENS.map(([k, titulo, dica]) => <div key={k} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{titulo}</div><div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{dica}</div>
      <div style={{ fontSize: 12, color: C.textSub, marginBottom: 4 }}>Perfis (todos os usuários ativos com o perfil)</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>{Object.entries(d.perfis_disponiveis).map(([p, nome]) => <button key={p} type="button" aria-pressed={cfg[k].perfis.includes(p)} onClick={() => togglePerfil(k, p)} style={chip(cfg[k].perfis.includes(p))}>{nome}</button>)}</div>
      <div style={{ fontSize: 12, color: C.textSub, marginBottom: 4 }}>Pessoas (a 1ª é a responsável pela tarefa)</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        {cfg[k].pessoas.map((ref, i) => { const p = nomeDe(ref); return <span key={ref} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${i === 0 ? C.accent : C.border}`, borderRadius: 14, padding: "3px 10px", fontSize: 12.5 }}>
          {i === 0 && <span title="Responsável pela tarefa">👤</span>}{p?.nome || ref}{p && !p.email && <span style={{ color: C.warn }} title="Sem e-mail — não recebe o aviso">⚠</span>}
          {i > 0 && <button type="button" title="Tornar responsável" onClick={() => muda(k, "pessoas", [ref, ...cfg[k].pessoas.filter((x) => x !== ref)])} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 0, fontSize: 11.5 }}>↑</button>}
          <button type="button" aria-label={`Tirar ${p?.nome || ref}`} onClick={() => muda(k, "pessoas", cfg[k].pessoas.filter((x) => x !== ref))} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 0 }}>✕</button></span>; })}
      </div>
      <div style={{ maxWidth: 360, marginBottom: 10 }}><SeletorPessoa C={C} s={s} rotulo={`Adicionar pessoa — ${titulo}`} vazio="Adicionar pessoa…" placeholder="Digite o nome…"
        opcoes={d.pessoas.filter((p) => !cfg[k].pessoas.includes(p.ref)).map((p) => ({ id: p.ref, nome: p.nome, detalhe: [p.funcao, p.email || "sem e-mail"].filter(Boolean).join(" · ") }))}
        valor={add[k]} onChange={(id) => { if (id) muda(k, "pessoas", [...cfg[k].pessoas, id]); setAdd((x) => ({ ...x, [k]: "" })); }} /></div>
      <div style={{ fontSize: 12, color: C.textSub, marginBottom: 4 }}>Funções (colaboradores ativos com a função, ex.: Mecânico)</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        {cfg[k].funcoes.map((f) => <span key={f} style={{ display: "inline-flex", gap: 6, border: `1px solid ${C.border}`, borderRadius: 14, padding: "3px 10px", fontSize: 12.5 }}>{f}<button type="button" aria-label={`Tirar função ${f}`} onClick={() => muda(k, "funcoes", cfg[k].funcoes.filter((x) => x !== f))} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 0 }}>✕</button></span>)}
        {d.funcoes.length > 0 ? <select aria-label={`Adicionar função — ${titulo}`} value={fn[k]} onChange={(e) => { const v = e.target.value; if (v && !cfg[k].funcoes.includes(v)) muda(k, "funcoes", [...cfg[k].funcoes, v]); setFn((x) => ({ ...x, [k]: "" })); }} style={{ ...s.input, width: "auto", marginBottom: 0, fontSize: 12.5 }}>
          <option value="">＋ função…</option>{d.funcoes.filter((f) => !cfg[k].funcoes.includes(f)).map((f) => <option key={f} value={f}>{f}</option>)}</select> : <span style={{ fontSize: 12, color: C.muted }}>nenhuma função cadastrada em 👷 Pessoas</span>}
      </div>
      <label style={{ fontSize: 12.5, display: "flex", gap: 8, alignItems: "center" }}>Tarefa criada:
        <select aria-label={`Tipo da tarefa — ${titulo}`} value={cfg[k].tipo_tarefa} onChange={(e) => muda(k, "tipo_tarefa", e.target.value)} style={{ ...s.input, width: "auto", marginBottom: 0, fontSize: 12.5 }}>{d.tipos_tarefa.map((t) => <option key={t} value={t}>{TIPO_NOME[t] || t}</option>)}</select></label>
      <div style={{ fontSize: 11.5, color: (d.previa?.[k] || []).length ? C.muted : C.danger, marginTop: 8 }}>{(d.previa?.[k] || []).length ? `Hoje recebem (salvo): ${d.previa[k].join(", ")}` : "⚠️ Ninguém recebe hoje o e-mail desta origem — escolha um perfil, pessoa ou função."}</div>
    </div>)}
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <button type="button" onClick={salvar} disabled={salvando || d.migrou === false} style={{ ...s.btn(!salvando), padding: "9px 18px", fontSize: 13, cursor: "pointer" }}>{salvando ? "Salvando…" : "Salvar"}</button>
      {ok && <span style={{ fontSize: 12.5, color: C.success || "#16a34a" }}>✓ salvo — vale para as próximas ocorrências</span>}
    </div>
  </div>;
}
