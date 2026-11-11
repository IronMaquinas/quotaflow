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
      <PrecoPlano ed={ed} setEd={setEd} C={C} input={input} label={label} />{/* 18v */}
      <label style={label}>MÓDULOS</label><SeletorModulos cat={cat} valor={ed.modulos} onChange={(m) => setEd({ ...ed, modulos: m })} C={C} tag={tag} />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}><button type="button" onClick={() => setEd(null)} style={btn(C.muted, false)}>Cancelar</button><button type="button" disabled={!ed.nome.trim() || !ed.modulos.length} onClick={salvar} style={btn()}>Salvar plano</button></div>
    </div>}
    {d.planos.length === 0 && !ed ? <div style={{ ...card, padding: 16, color: C.muted, fontSize: 13 }}>Nenhum plano-modelo ainda.</div>
      : d.planos.map((p) => <div key={p.id} style={{ ...card, padding: "12px 14px", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><b style={{ flex: 1 }}>{p.nome}</b><span style={{ fontSize: 12, color: C.muted }}>{p.modulos.length} módulo(s)</span>
          <button type="button" onClick={() => setEd({ id: p.id, nome: p.nome, descricao: p.descricao || "", modulos: p.modulos, preco_mensal: p.preco_mensal ?? "", preco_anual: p.preco_anual ?? "", preco_anual_mensal: p.preco_anual_mensal ?? "", publico: p.publico !== false, moeda: p.moeda || "BRL", metrica: p.metrica || "empresa", preco_unidade: p.preco_unidade ?? "", franquia: p.franquia ?? "" })} style={{ ...btn(C.muted, false), padding: "4px 10px", fontSize: 11 }}>Editar</button>
          <button type="button" onClick={() => setConf(p)} style={{ ...btn(C.danger, false), padding: "4px 10px", fontSize: 11 }}>Excluir</button></div>
        {p.descricao && <div style={{ fontSize: 12, color: C.sub }}>{p.descricao}</div>}
        {resumoPreco(p) && <div style={{ fontSize: 12.5, color: C.success || "#22c55e", fontWeight: 600, marginTop: 2 }}>💲 {resumoPreco(p)}</div>}{/* 18v */}
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

// ─── 18v: 💲 preço do plano-modelo ──────────────────────────────────────────
export const MOEDAS = { BRL: "R$", USD: "US$", EUR: "€", DKK: "kr" };
export const METRICAS = { empresa: "por empresa (valor fixo)", usuario: "por usuário", equipamento: "por veículo/equipamento", uso: "por uso (pay-per-use)" };
export const dinheiro = (v, moeda = "BRL") => (v == null || v === "" ? "—" : `${MOEDAS[moeda] || moeda} ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export function resumoPreco(p) {
  if (p.preco_mensal == null && p.preco_anual == null && p.preco_anual_mensal == null && p.preco_unidade == null) return null;
  const m = p.moeda || "BRL"; const partes = [];
  if (p.preco_mensal != null) partes.push(`${dinheiro(p.preco_mensal, m)}/mês`);
  if (p.preco_anual_mensal != null) partes.push(`anual ${dinheiro(p.preco_anual_mensal, m)}/mês`);
  if (p.preco_anual != null) partes.push(`pré-pago ${dinheiro(p.preco_anual, m)}/ano`);
  if (p.publico === false) partes.push("🔒 interno");
  if (p.metrica && p.metrica !== "empresa") partes.push(`+ ${dinheiro(p.preco_unidade, m)} ${METRICAS[p.metrica]?.replace("por ", "por ") || p.metrica}${p.franquia ? ` (acima de ${p.franquia} incluídos)` : ""}`);
  return partes.join(" · ");
}
function PrecoPlano({ ed, setEd, C, input, label }) {
  const set = (k) => (e) => setEd({ ...ed, [k]: e.target.value });
  const metrica = ed.metrica || "empresa";
  return <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
    <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>💲 Preço <span style={{ fontWeight: 400, color: C.muted }}>(opcional — aparece no Console; a página de planos vem depois)</span></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
      <div><label style={label}>MOEDA</label><select value={ed.moeda || "BRL"} onChange={set("moeda")} style={input}>{Object.keys(MOEDAS).map((k) => <option key={k} value={k}>{k} ({MOEDAS[k]})</option>)}</select></div>
      <div><label style={label}>MENSAL (POR MÊS)</label><input type="number" min="0" step="0.01" value={ed.preco_mensal ?? ""} onChange={set("preco_mensal")} style={input} /></div>
      <div><label style={label}>ANUAL PAGO POR MÊS</label><input type="number" min="0" step="0.01" value={ed.preco_anual_mensal ?? ""} onChange={set("preco_anual_mensal")} placeholder="valor/mês" style={input} /></div>
      <div><label style={label}>ANUAL PRÉ-PAGO (ANO)</label><input type="number" min="0" step="0.01" value={ed.preco_anual ?? ""} onChange={set("preco_anual")} style={input} /></div>
      <div><label style={label}>COBRANÇA</label><select value={metrica} onChange={set("metrica")} style={input}>{Object.entries(METRICAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      {metrica !== "empresa" && <><div><label style={label}>PREÇO POR UNIDADE</label><input type="number" min="0" step="0.01" value={ed.preco_unidade ?? ""} onChange={set("preco_unidade")} style={input} /></div>
        <div><label style={label}>INCLUÍDOS NO PLANO</label><input type="number" min="0" step="1" value={ed.franquia ?? ""} onChange={set("franquia")} placeholder="ex.: 10" style={input} /></div></>}
    </div>
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginTop: 8, cursor: "pointer" }}><input type="checkbox" checked={ed.publico !== false} onChange={(e) => setEd({ ...ed, publico: e.target.checked })} /> Aparece para o cliente em ⭐ Meu plano (desmarque para planos internos/negociados)</label>
    <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>Ex.: "Pequeno" R$ 290/mês por empresa · "Cresce" R$ 590/mês + R$ 29 por veículo acima de 10 · "Pay-per-use" R$ 0 + R$ 4,90 por uso.</div>
  </div>;
}

// ─── 18v: 💳 assinatura da empresa (Console) ──────────────────────────────────
const SITUACAO = { teste: "🧪 Em teste", ativa: "✅ Ativa", inadimplente: "⚠️ Inadimplente", suspensa: "⏸ Suspensa", cancelada: "✖ Cancelada" };
const MODALIDADE = { mensal: "Mensal (sem fidelidade)", anual_mensal: "Anual, pago por mês", anual_prepago: "Anual pré-pago" };
const NOMES_CAMPO = { modalidade: "Modalidade", proxima_cobranca: "Próxima cobrança", fim_compromisso: "Compromisso até", plano_nome: "Plano", situacao: "Situação", ciclo: "Ciclo", moeda: "Moeda", valor: "Valor", desconto_pct: "Desconto %", inicio: "Início", proxima_renovacao: "Próxima renovação", teste_ate: "Fim do teste" };
export function AssinaturaEmpresa({ token, chamar, C, input, label, card, btn, empresa, onFechar, onSalvo, onAviso }) {
  const [d, setD] = useState(null); const [planos, setPlanos] = useState([]); const [f, setF] = useState(null); const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    chamar(token, "GET", "/planos").then((r) => setPlanos(r.planos || [])).catch(() => {});
    chamar(token, "GET", `/transportadoras/${empresa.id}/assinatura`).then((r) => { setD(r); const a = r.assinatura || {};
      setF({ situacao: r.situacao, plano_id: a.plano_id || "", plano_nome: a.plano_nome || empresa.plano_nome || "", modalidade: a.modalidade || (a.ciclo === "anual" ? "anual_prepago" : "mensal"), moeda: a.moeda || "BRL", valor: a.valor ?? "", desconto_pct: a.desconto_pct ?? "",
        inicio: a.inicio || "", proxima_cobranca: a.proxima_cobranca || "", fim_compromisso: a.fim_compromisso || "", obs: a.obs || "", teste_ate: r.teste_ate ? String(r.teste_ate).slice(0, 10) : "" }); })
      .catch((e) => onAviso({ tipo: "erro", texto: e.message }));
  }, [token, empresa.id]); // eslint-disable-line
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const escolherPlano = (id) => { const p = planos.find((x) => String(x.id) === String(id)); setF({ ...f, plano_id: id, ...(p ? { plano_nome: p.nome, moeda: p.moeda || f.moeda, valor: (f.modalidade === "anual_prepago" ? p.preco_anual : f.modalidade === "anual_mensal" ? p.preco_anual_mensal ?? p.preco_mensal : p.preco_mensal) ?? f.valor } : {}) }); };
  const liquido = f && f.valor !== "" ? Number(f.valor) * (1 - (Number(f.desconto_pct) || 0) / 100) : null;
  const salvar = async () => { setOcupado(true); try { await chamar(token, "PUT", `/transportadoras/${empresa.id}/assinatura`, f); onAviso({ tipo: "ok", texto: `Assinatura de ${empresa.nome} salva` }); onSalvo?.(); } catch (e) { onAviso({ tipo: "erro", texto: e.message }); } finally { setOcupado(false); } };
  const decidir = async (p, ok) => { setOcupado(true); try { await chamar(token, "POST", `/transportadoras/${empresa.id}/pedidos/${p.id}/${ok ? "confirmar" : "recusar"}`, {}); onAviso({ tipo: "ok", texto: ok ? `Plano ${p.plano_nome} ativado para ${empresa.nome}` : "Pedido recusado — o cliente recebe um e-mail" }); onSalvo?.(); } catch (e) { onAviso({ tipo: "erro", texto: e.message }); } finally { setOcupado(false); } };
  const fmt = (v) => (v == null || v === "" ? "—" : /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(0, 10).split("-").reverse().join("/") : SITUACAO[v] || MODALIDADE[v] || String(v));
  return <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 50, padding: 20, overflowY: "auto" }} onClick={onFechar}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "100%", maxWidth: 640, padding: "20px 22px", marginTop: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>💳 Assinatura — {empresa.nome}</div>
      {!d || !f ? <div style={{ color: C.muted }}>Carregando…</div> : !d.migrou ? <div style={{ color: C.danger, fontSize: 13 }}>Falta rodar a migration 077 no Supabase.</div> : <>
        {(d.pedidos || []).filter((p) => p.status === "pendente").map((p) => <div key={p.id} style={{ border: `1px solid ${C.warning || "#f59e0b"}`, borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 13 }}>{/* 18w */}
          📝 <b>Pedido do cliente:</b> {p.plano_nome} · {MODALIDADE[p.modalidade] || p.modalidade} · {p.valor != null ? dinheiro(p.valor, p.moeda) : "a combinar"} — {p.pedido_por || "—"} ({p.pedido_por_email || "—"}), {new Date(p.criado_em).toLocaleString("pt-BR")}{p.obs ? <div style={{ color: C.sub, marginTop: 4 }}>“{p.obs}”</div> : null}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}><button type="button" disabled={ocupado} onClick={() => decidir(p, true)} style={{ ...btn(), padding: "6px 14px" }}>✓ Confirmar (ativa e liga os módulos)</button><button type="button" disabled={ocupado} onClick={() => decidir(p, false)} style={{ ...btn(C.muted, false), padding: "6px 14px" }}>Recusar</button></div></div>)}
        <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 12 }}>{SITUACAO[d.situacao]}{d.situacao === "teste" && d.teste_ate ? ` até ${fmt(String(d.teste_ate).slice(0, 10))}${d.dias_teste != null ? (d.dias_teste > 0 ? ` (faltam ${d.dias_teste} dia(s))` : " — terminou: sistema só leitura") : ""}` : ""}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
          <div><label style={label}>SITUAÇÃO</label><select value={f.situacao} onChange={set("situacao")} style={input}>{Object.entries(SITUACAO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          {f.situacao === "teste" && <div><label style={label}>FIM DO TESTE</label><input type="date" value={f.teste_ate} onChange={set("teste_ate")} style={input} /></div>}
          <div><label style={label}>PLANO-MODELO</label><select value={f.plano_id} onChange={(e) => escolherPlano(e.target.value)} style={input}><option value="">— personalizado —</option>{planos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
          <div><label style={label}>NOME DO PLANO</label><input value={f.plano_nome} onChange={set("plano_nome")} style={input} /></div>
          <div><label style={label}>MODALIDADE</label><select value={f.modalidade} onChange={(e) => { const m = e.target.value; const p = planos.find((x) => String(x.id) === String(f.plano_id)); const v = p ? (m === "anual_prepago" ? p.preco_anual : m === "anual_mensal" ? p.preco_anual_mensal ?? p.preco_mensal : p.preco_mensal) : null; setF({ ...f, modalidade: m, proxima_cobranca: "", fim_compromisso: "", ...(v != null ? { valor: v } : {}) }); }} style={input}>{Object.entries(MODALIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label style={label}>MOEDA</label><select value={f.moeda} onChange={set("moeda")} style={input}>{Object.keys(MOEDAS).map((k) => <option key={k} value={k}>{k}</option>)}</select></div>
          <div><label style={label}>VALOR NEGOCIADO ({f.modalidade === "anual_prepago" ? "ANO" : "MÊS"})</label><input type="number" min="0" step="0.01" value={f.valor} onChange={set("valor")} style={input} /></div>
          <div><label style={label}>DESCONTO %</label><input type="number" min="0" max="100" step="0.01" value={f.desconto_pct} onChange={set("desconto_pct")} style={input} /></div>
          <div><label style={label}>INÍCIO</label><input type="date" value={f.inicio} onChange={set("inicio")} style={input} /></div>
          <div><label style={label}>PRÓXIMA COBRANÇA</label><input type="date" value={f.proxima_cobranca} onChange={set("proxima_cobranca")} style={input} /></div>
          {f.modalidade !== "mensal" && <div><label style={label}>COMPROMISSO ATÉ</label><input type="date" value={f.fim_compromisso} onChange={set("fim_compromisso")} style={input} /></div>}
        </div>
        {liquido != null && <div style={{ fontSize: 13, marginTop: 8 }}>Valor com desconto: <b>{dinheiro(liquido, f.moeda)}</b>/{f.modalidade === "anual_prepago" ? "ano" : "mês"}</div>}
        <label style={{ ...label, marginTop: 10 }}>OBSERVAÇÃO</label><input value={f.obs} onChange={set("obs")} placeholder="ex.: desconto de lançamento por 6 meses" style={{ ...input, marginBottom: 10 }} />
        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>Datas em branco = o sistema calcula pelo início: Mensal → cobra todo mês, sem fim · Anual pago por mês → cobra todo mês, compromisso de 12 meses · Pré-pago → paga o ano, renova em 12 meses. Trocar a modalidade limpa as datas. Ativar tira a empresa do teste. Voltar para "Em teste" com nova data estende o teste.</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={onFechar} style={btn(C.muted, false)}>Cancelar</button><button type="button" disabled={ocupado} onClick={salvar} style={btn()}>{ocupado ? "Salvando…" : "Salvar assinatura"}</button></div>
        {d.historico?.length > 0 && <div style={{ marginTop: 16 }}><div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>📜 Histórico</div>
          {d.historico.map((h) => <div key={h.id} style={{ fontSize: 12, borderTop: `1px solid ${C.border}`, padding: "6px 0", color: C.sub }}>
            <b style={{ color: C.text }}>{new Date(h.em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</b>{h.quem ? ` · ${h.quem}` : ""} — {Object.entries(h.detalhe || {}).map(([k, v]) => `${NOMES_CAMPO[k] || k}: ${fmt(v?.de)} → ${fmt(v?.para)}`).join(" · ")}</div>)}</div>}
      </>}
    </div>
  </div>;
}
