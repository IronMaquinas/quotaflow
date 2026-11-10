// plataforma/ModulosPlataforma.jsx — etapa 18j: 🧩 módulos e planos no Console da Plataforma
//   • <PlanosPlataforma>: planos-modelo (nome, descrição, módulos) — "Transportadora completo", "Locadora", "Suprimentos"…
//   • <ModulosEmpresa>: liga/desliga os módulos de uma empresa — aplica um plano-modelo ou monta o personalizado
//     ("Fale conosco para planos customizados"). Dependências entram sozinhas (o servidor resolve e devolve).
import { useState, useEffect } from "react";

function useCatalogo(token, chamar) {
  const [cat, setCat] = useState(null);
  useEffect(() => { chamar(token, "GET", "/modulos").then(setCat).catch(() => setCat({ areas: [], todos: [] })); }, [token]); // eslint-disable-line
  return cat;
}
/** dependências no navegador (mesma regra do servidor) — só para mostrar ao vivo */
function resolver(cat, lista) {
  const mods = cat.areas.flatMap((a) => a.modulos); const set = new Set(lista); let mudou = true;
  while (mudou) { mudou = false; for (const id of [...set]) { const m = mods.find((x) => x.id === id); if (!m) continue;
    for (const d of m.depende) if (!set.has(d)) { set.add(d); mudou = true; }
    if (m.dependeUm.length && !m.dependeUm.some((d) => set.has(d))) { set.add(m.dependeUm[0]); mudou = true; } } }
  return mods.map((m) => m.id).filter((id) => set.has(id));
}

/** 18j: toggle no padrão do SaaS (estilo iOS — o mesmo dos perfis em 👥 Usuários) */
export function Toggle({ ligado, onChange, desabilitado = false, rotulo, C }) {
  return <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} disabled={desabilitado} onClick={() => !desabilitado && onChange(!ligado)}
    style={{ width: 48, height: 28, borderRadius: 14, background: ligado ? (C.success || "#22c55e") : C.border, cursor: desabilitado ? "default" : "pointer", position: "relative", transition: "background .2s", border: "none", flexShrink: 0, opacity: desabilitado ? 0.55 : 1, padding: 0 }}>
    <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: ligado ? 23 : 3, transition: "left .2s", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }} />
  </button>;
}

export function SeletorModulos({ cat, valor, onChange, C, tag }) {
  const ativos = resolver(cat, valor); const auto = ativos.filter((x) => !valor.includes(x));
  const nomeDe = (id) => cat.areas.flatMap((a) => a.modulos).find((m) => m.id === id)?.nome || id;
  return <div>
    {cat.areas.map((a) => <div key={a.id} style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <b style={{ fontSize: 13 }}>{a.nome}</b>
        <button type="button" onClick={() => { const ids = a.modulos.filter((m) => !m.futuro).map((m) => m.id); const todos = ids.every((id) => ativos.includes(id)); onChange(todos ? valor.filter((x) => !ids.includes(x)) : [...new Set([...valor, ...ids])]); }}
          style={{ background: "none", border: "none", color: C.accent, fontSize: 11, cursor: "pointer", padding: 0 }}>{a.modulos.filter((m) => !m.futuro).every((m) => ativos.includes(m.id)) ? "desmarcar área" : "área toda"}</button>
      </div>
      {a.modulos.map((m) => { const on = ativos.includes(m.id); const ehAuto = auto.includes(m.id);
        return <div key={m.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "7px 0", borderTop: `1px solid ${C.border}`, opacity: m.futuro ? 0.55 : 1 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: on ? C.text : C.sub }}>{m.nome}{m.futuro && <span style={{ ...tag(C.violet), marginLeft: 6 }}>EM BREVE</span>}</div>
            <div style={{ fontSize: 11.5, color: C.muted }}>{ehAuto ? <span style={{ color: C.accent }}>Ligado junto — outro módulo depende dele. </span> : null}{(m.depende.length > 0 || m.dependeUm.length > 0) ? `Precisa de ${[...m.depende.map(nomeDe), ...(m.dependeUm.length ? [m.dependeUm.map(nomeDe).join(" ou ")] : [])].join(", ")}.` : m.desc}</div>
          </div>
          <Toggle C={C} ligado={on} desabilitado={m.futuro || ehAuto} rotulo={m.nome} onChange={(v) => onChange(v ? [...valor, m.id] : valor.filter((x) => x !== m.id))} />
        </div>; })}
    </div>)}
  </div>;
}

export function PlanosPlataforma({ token, chamar, C, input, label, card, btn, tag, onAviso }) {
  const cat = useCatalogo(token, chamar);
  const [d, setD] = useState(null); const [ed, setEd] = useState(null); const [conf, setConf] = useState(null);
  const carregar = () => chamar(token, "GET", "/planos").then(setD).catch((e) => onAviso({ tipo: "erro", texto: e.message }));
  useEffect(() => { carregar(); }, [token]); // eslint-disable-line
  if (!d || !cat) return <div style={{ color: C.muted }}>Carregando…</div>;
  const nomeDe = (id) => cat.areas.flatMap((a) => a.modulos).find((m) => m.id === id)?.nome || id;
  const salvar = async () => { try { await chamar(token, ed.id ? "PUT" : "POST", ed.id ? `/planos/${ed.id}` : "/planos", ed); onAviso({ tipo: "ok", texto: `Plano "${ed.nome}" salvo` }); setEd(null); carregar(); } catch (e) { onAviso({ tipo: "erro", texto: e.message }); } };
  return <div>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}><div style={{ fontSize: 20, fontWeight: 700, flex: 1 }}>🧩 Planos</div>
      {!ed && <button type="button" onClick={() => setEd({ nome: "", descricao: "", modulos: [] })} style={btn()}>＋ Novo plano</button>}</div>
    <div style={{ fontSize: 13, color: C.sub, marginBottom: 14 }}>Planos-modelo para aplicar nas empresas (🚚 Transportadoras → 🧩 Módulos…). Cada empresa também pode ter um plano personalizado. Empresas sem plano aplicado ficam com tudo ligado.</div>
    {d.sem_migration && <div style={{ color: C.danger, fontSize: 13, marginBottom: 10 }}>Falta rodar a migration 071.</div>}
    {ed && <div style={{ ...card, padding: 16, marginBottom: 14 }}>
      <label style={label}>NOME</label><input value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} placeholder="ex.: Transportadora completo" style={{ ...input, marginBottom: 10 }} />
      <label style={label}>DESCRIÇÃO (OPCIONAL)</label><input value={ed.descricao || ""} onChange={(e) => setEd({ ...ed, descricao: e.target.value })} style={{ ...input, marginBottom: 12 }} />
      <label style={label}>MÓDULOS</label><SeletorModulos cat={cat} valor={ed.modulos} onChange={(m) => setEd({ ...ed, modulos: m })} C={C} tag={tag} />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}><button type="button" onClick={() => setEd(null)} style={btn(C.muted, false)}>Cancelar</button><button type="button" disabled={!ed.nome.trim() || !ed.modulos.length} onClick={salvar} style={btn()}>Salvar plano</button></div>
    </div>}
    {d.planos.length === 0 && !ed ? <div style={{ ...card, padding: 16, color: C.muted, fontSize: 13 }}>Nenhum plano-modelo ainda.</div>
      : d.planos.map((p) => <div key={p.id} style={{ ...card, padding: "12px 14px", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><b style={{ flex: 1 }}>{p.nome}</b><span style={{ fontSize: 12, color: C.muted }}>{p.modulos.length} módulo(s)</span>
          <button type="button" onClick={() => setEd({ id: p.id, nome: p.nome, descricao: p.descricao || "", modulos: p.modulos })} style={{ ...btn(C.muted, false), padding: "4px 10px", fontSize: 11 }}>Editar</button>
          <button type="button" onClick={() => setConf(p)} style={{ ...btn(C.danger, false), padding: "4px 10px", fontSize: 11 }}>Excluir</button></div>
        {p.descricao && <div style={{ fontSize: 12, color: C.sub }}>{p.descricao}</div>}
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{p.modulos.map(nomeDe).join(" · ")}</div>
      </div>)}
    {conf && <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
      <div style={{ ...card, maxWidth: 420, padding: 20 }}><div style={{ fontWeight: 700, marginBottom: 8 }}>Excluir o plano "{conf.nome}"?</div><div style={{ fontSize: 13, color: C.sub, marginBottom: 14 }}>As empresas que usam este plano continuam com os mesmos módulos (ficam como personalizadas).</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={() => setConf(null)} style={btn(C.muted, false)}>Cancelar</button>
          <button type="button" onClick={async () => { try { await chamar(token, "DELETE", `/planos/${conf.id}`); setConf(null); carregar(); } catch (e) { onAviso({ tipo: "erro", texto: e.message }); } }} style={btn(C.danger)}>Excluir</button></div></div></div>}
  </div>;
}

export function ModulosEmpresa({ token, chamar, C, input, label, card, btn, tag, empresa, onFechar, onSalvo, onAviso }) {
  const cat = useCatalogo(token, chamar);
  const [planos, setPlanos] = useState([]);
  const [completo, setCompleto] = useState(!Array.isArray(empresa.modulos));
  const [mods, setMods] = useState(Array.isArray(empresa.modulos) ? empresa.modulos : []);
  const [nome, setNome] = useState(empresa.plano_nome || ""); const [ocupado, setOcupado] = useState(false);
  const [segs, setSegs] = useState(Array.isArray(empresa.segmentos) && empresa.segmentos.length ? empresa.segmentos : ["transporte"]); // 18u
  useEffect(() => { chamar(token, "GET", "/planos").then((r) => setPlanos(r.planos || [])).catch(() => {}); }, [token]); // eslint-disable-line
  useEffect(() => { if (cat && completo && !mods.length) setMods(cat.todos); }, [cat]); // eslint-disable-line
  const salvar = async () => {
    setOcupado(true);
    try { await chamar(token, "PUT", `/transportadoras/${empresa.id}/modulos`, { ...(completo ? { completo: true, plano_nome: nome } : { modulos: mods, plano_nome: nome || "Personalizado" }), segmentos: segs }); onAviso({ tipo: "ok", texto: `Módulos de ${empresa.nome} atualizados — vale no próximo acesso dos usuários` }); onSalvo(); }
    catch (e) { onAviso({ tipo: "erro", texto: e.message }); } finally { setOcupado(false); }
  };
  return <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 50, padding: 20, overflowY: "auto" }} onClick={onFechar}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "100%", maxWidth: 620, padding: "20px 22px", marginTop: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🧩 Módulos — {empresa.nome}</div>
      <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 12 }}>O que a empresa vê no menu, na tela inicial e no roteiro. Os demais aparecem em ⭐ Meu plano como disponíveis (🔒 Fale conosco).</div>
      {!cat ? <div style={{ color: C.muted }}>Carregando…</div> : <>
        {(cat.segmentos || []).length > 0 && <div style={{ marginBottom: 12 }}>{/* 18u: 🏷 segmentos — mais de um vale (ex.: transporte + locação) */}
          <label style={label}>SEGMENTOS DO NEGÓCIO (MUDA OS NOMES NA TELA)</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {cat.segmentos.map((g) => { const on = segs.includes(g.id); return <button key={g.id} type="button" aria-pressed={on} onClick={() => setSegs((v) => (on ? (v.length > 1 ? v.filter((x) => x !== g.id) : v) : [...v, g.id]))}
              style={{ ...btn(on ? undefined : C.muted, on), padding: "6px 12px", fontSize: 12.5 }}>{g.nome}</button>; })}
            {!completo && <button type="button" onClick={() => setMods((m) => [...new Set([...m, ...cat.segmentos.filter((g) => segs.includes(g.id)).flatMap((g) => g.sugere)])])}
              title="Liga os módulos que costumam servir a esses segmentos (você confere antes de salvar)" style={{ background: "none", border: "none", color: C.accent, fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>＋ ligar módulos sugeridos</button>}
          </div></div>}
        <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700 }}>Tudo ligado</div><div style={{ fontSize: 11.5, color: C.muted }}>Plano completo — recebe os módulos novos automaticamente.</div></div>
          <Toggle C={C} ligado={completo} rotulo="Tudo ligado" onChange={(v) => { setCompleto(v); if (v) setMods(cat.todos); }} />
        </div>
        {!completo && <>
          {planos.length > 0 && <><label style={label}>APLICAR UM PLANO-MODELO</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>{planos.map((p) => <button key={p.id} type="button" onClick={() => { setMods(p.modulos); setNome(p.nome); }} style={{ ...btn(nome === p.nome ? C.accent : C.muted, nome === p.nome), padding: "5px 10px", fontSize: 12 }}>{p.nome}</button>)}</div></>}
          <SeletorModulos cat={cat} valor={mods} onChange={(m) => { setMods(m); if (planos.some((p) => p.nome === nome)) setNome(""); }} C={C} tag={tag} />
        </>}
        <label style={label}>NOME DO PLANO (APARECE PARA O CLIENTE)</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={completo ? "Completo" : "Personalizado"} style={{ ...input, marginBottom: 12 }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={onFechar} style={btn(C.muted, false)}>Cancelar</button>
          <button type="button" disabled={ocupado || (!completo && !mods.length)} onClick={salvar} style={btn()}>{ocupado ? "Salvando…" : "Salvar módulos"}</button></div>
      </>}
    </div>
  </div>;
}
