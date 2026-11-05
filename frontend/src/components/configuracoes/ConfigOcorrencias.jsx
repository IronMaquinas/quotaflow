// components/configuracoes/ConfigOcorrencias.jsx — etapa 18h.4a/18h.4b: ⚠️ quem recebe as ocorrências (INC), por origem
//   🏗 Locação (INC-LC → tarefa TSK-CM) e 🚛 Transporte (INC-TR → tarefa TSK-MT): o tipo da tarefa é fixo pela origem.
//   Perfis + pessoas + funções SOMAM (basta preencher um); a 1ª pessoa é a responsável pela tarefa.
//   "Quem vai receber" é calculado ao vivo, com o motivo de cada um — para tirar alguém, desmarque o que o incluiu.
//   Regra do SaaS: o perfil admin nunca recebe e-mail de rotina (cuida do sistema).
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import { SeletorPessoa } from "../shared/CampoPessoa";

const ORIGENS = [
  ["lc", "🏗 Locação (contrato)", "INC-LC", "TSK-CM · Comercial", "Avaria, pane, acidente… registrados pelo cliente ou pela empresa num contrato de locação."],
  ["tr", "🚛 Transporte (AT)", "INC-TR", "TSK-MT · Manutenção", "Ocorrências registradas pela ficha da AT durante a viagem."],
];

/** quem vai receber com a configuração da tela (antes de salvar) — mesma regra do servidor */
function quemRecebe(d, c) {
  const out = new Map(); const add = (email, nome, porque) => { const e = String(email || "").toLowerCase(); if (!e) return; if (out.has(e)) out.get(e).porque.push(porque); else out.set(e, { email: e, nome, porque: [porque] }); };
  for (const u of d.usuarios || []) { const p = c.perfis.find((x) => u.perfis.includes(x)); if (p) add(u.email, u.nome, `perfil ${d.perfis_disponiveis[p]}`); }
  c.pessoas.forEach((ref, i) => { const p = d.pessoas.find((x) => x.ref === ref); if (p?.email) add(p.email, p.nome, i === 0 ? "escolhida (responsável)" : "escolhida"); });
  const fs = c.funcoes.map((f) => f.toLowerCase());
  for (const p of d.pessoas) if (p.funcao && !p.afastado && fs.includes(String(p.funcao).toLowerCase()) && p.email) add(p.email, p.nome, `função ${p.funcao}`);
  return [...out.values()].sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
}

export default function ConfigOcorrencias({ C, s, onErro }) {
  const [d, setD] = useState(null); const [cfg, setCfg] = useState(null); const [salvo, setSalvo] = useState(null);
  const [salvando, setSalvando] = useState(false); const [ok, setOk] = useState(false);
  const [add, setAdd] = useState({ lc: "", tr: "" }); const [fn, setFn] = useState({ lc: "", tr: "" });
  const aplicar = (r) => { setD(r); const c = { lc: r.lc, tr: r.tr }; setCfg(c); setSalvo(JSON.stringify(c)); };
  useEffect(() => { apiService.get("/configuracoes/ocorrencias").then(aplicar).catch((e) => onErro?.(e.message)); }, []); // eslint-disable-line
  if (!d || !cfg) return null;
  const mudou = JSON.stringify(cfg) !== salvo;
  const muda = (k, campo, v) => { setCfg((x) => ({ ...x, [k]: { ...x[k], [campo]: v } })); setOk(false); };
  const togglePerfil = (k, p) => muda(k, "perfis", cfg[k].perfis.includes(p) ? cfg[k].perfis.filter((x) => x !== p) : [...cfg[k].perfis, p]);
  const nomeDe = (ref) => d.pessoas.find((p) => p.ref === ref);
  const salvar = async () => {
    setSalvando(true); setOk(false);
    try { aplicar(await apiService.put("/configuracoes/ocorrencias", { lc: { perfis: cfg.lc.perfis, pessoas: cfg.lc.pessoas, funcoes: cfg.lc.funcoes }, tr: { perfis: cfg.tr.perfis, pessoas: cfg.tr.pessoas, funcoes: cfg.tr.funcoes } })); setOk(true); setTimeout(() => setOk(false), 3000); }
    catch (e) { onErro?.(e.message); } finally { setSalvando(false); }
  };
  const chip = (ativo) => ({ ...s.btn(ativo), padding: "5px 11px", fontSize: 12.5, cursor: "pointer" });
  const sub = { fontSize: 12, color: C.textSub, marginBottom: 4, marginTop: 2 };
  return <div style={{ ...s.card, padding: 18, marginTop: 16 }}>
    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>⚠️ Ocorrências — quem recebe</div>
    <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12, lineHeight: 1.5 }}>
      Quando alguém registra uma ocorrência, todos de <b>perfis + pessoas + funções</b> recebem o e-mail (eles <b>somam</b> — basta preencher um). A <b>1ª pessoa</b> da lista fica responsável pela tarefa no ✅ Plano; sem pessoa, a tarefa fica sem responsável. O perfil <b>Administrador não recebe</b> e-mail de rotina.
    </div>
    {d.migrou === false && <div style={{ fontSize: 12.5, color: C.warn, marginBottom: 10 }}>⚠️ Rode a migration 069 para salvar — até lá vale o padrão (locação → Comercial, transporte → Operação).</div>}
    {ORIGENS.map(([k, titulo, inc, tarefa, dica]) => { const lista = quemRecebe(d, cfg[k]);
      return <div key={k} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}><b style={{ fontSize: 14 }}>{titulo}</b><span style={{ fontSize: 12, color: C.muted }}>{inc}-AAAA-NNNN · gera tarefa <b>{tarefa}</b></span></div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{dica}</div>
        <div style={sub}>Perfis — todos os usuários ativos com o perfil</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>{Object.entries(d.perfis_disponiveis).map(([p, nome]) => <button key={p} type="button" aria-pressed={cfg[k].perfis.includes(p)} onClick={() => togglePerfil(k, p)} style={chip(cfg[k].perfis.includes(p))}>{nome}</button>)}</div>
        <div style={sub}>+ Pessoas — a 1ª (👤) é a responsável pela tarefa</div>
        {cfg[k].pessoas.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          {cfg[k].pessoas.map((ref, i) => { const p = nomeDe(ref); return <span key={ref} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${i === 0 ? C.accent : C.border}`, borderRadius: 14, padding: "3px 10px", fontSize: 12.5 }}>
            {i === 0 && <span title="Responsável pela tarefa">👤</span>}{p?.nome || ref}{p && !p.email && <span style={{ color: C.warn }} title="Sem e-mail — fica responsável, mas não recebe o aviso">⚠ sem e-mail</span>}
            {i > 0 && <button type="button" title="Tornar responsável" onClick={() => muda(k, "pessoas", [ref, ...cfg[k].pessoas.filter((x) => x !== ref)])} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 0, fontSize: 11.5 }}>tornar 👤</button>}
            <button type="button" aria-label={`Tirar ${p?.nome || ref}`} onClick={() => muda(k, "pessoas", cfg[k].pessoas.filter((x) => x !== ref))} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 0 }}>✕</button></span>; })}
        </div>}
        <div style={{ maxWidth: 360, marginBottom: 10 }}><SeletorPessoa C={C} s={s} rotulo={`Adicionar pessoa — ${titulo}`} vazio="Adicionar pessoa…" placeholder="Digite o nome…"
          opcoes={d.pessoas.filter((p) => !cfg[k].pessoas.includes(p.ref)).map((p) => ({ id: p.ref, nome: p.nome, detalhe: [p.funcao, p.email || "sem e-mail"].filter(Boolean).join(" · ") }))}
          valor={add[k]} onChange={(id) => { if (id) muda(k, "pessoas", [...cfg[k].pessoas, id]); setAdd((x) => ({ ...x, [k]: "" })); }} /></div>
        <div style={sub}>+ Funções — colaboradores ativos com a função (ex.: Mecânico)</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          {cfg[k].funcoes.map((f) => <span key={f} style={{ display: "inline-flex", gap: 6, border: `1px solid ${C.border}`, borderRadius: 14, padding: "3px 10px", fontSize: 12.5 }}>{f}<button type="button" aria-label={`Tirar função ${f}`} onClick={() => muda(k, "funcoes", cfg[k].funcoes.filter((x) => x !== f))} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 0 }}>✕</button></span>)}
          {d.funcoes.length > 0 ? <select aria-label={`Adicionar função — ${titulo}`} value={fn[k]} onChange={(e) => { const v = e.target.value; if (v && !cfg[k].funcoes.includes(v)) muda(k, "funcoes", [...cfg[k].funcoes, v]); setFn((x) => ({ ...x, [k]: "" })); }} style={{ ...s.input, width: "auto", marginBottom: 0, fontSize: 12.5 }}>
            <option value="">＋ função…</option>{d.funcoes.filter((f) => !cfg[k].funcoes.includes(f)).map((f) => <option key={f} value={f}>{f}</option>)}</select> : <span style={{ fontSize: 12, color: C.muted }}>nenhuma função cadastrada em 👷 Pessoas</span>}
        </div>
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: lista.length ? C.text : C.danger, marginBottom: 4 }}>{lista.length ? `= Vão receber o e-mail (${lista.length})${mudou ? " — depois de salvar" : ""}` : "⚠️ Ninguém vai receber o e-mail desta origem — marque um perfil, uma pessoa ou uma função."}</div>
          {lista.map((x) => <div key={x.email} style={{ fontSize: 12, color: C.textSub, padding: "1px 0" }}>{x.nome} <span style={{ color: C.muted }}>· {x.email} · por {x.porque.join(" + ")}</span></div>)}
          {lista.length > 0 && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Para tirar alguém, desmarque o perfil ou a função que o incluiu (o motivo está ao lado do nome) ou tire a pessoa.</div>}
        </div>
      </div>; })}
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <button type="button" onClick={salvar} disabled={salvando || d.migrou === false || !mudou} style={{ ...s.btn(!salvando && mudou), padding: "9px 18px", fontSize: 13, cursor: mudou ? "pointer" : "default" }}>{salvando ? "Salvando…" : "Salvar"}</button>
      {ok && <span style={{ fontSize: 12.5, color: C.success || "#16a34a" }}>✓ salvo — vale para as próximas ocorrências</span>}
      {mudou && !ok && <span style={{ fontSize: 12.5, color: C.warn }}>alterações não salvas</span>}
    </div>
  </div>;
}
