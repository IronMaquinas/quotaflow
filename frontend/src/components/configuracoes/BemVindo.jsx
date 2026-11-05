// components/configuracoes/BemVindo.jsx — etapa 18i: 👋 Bem-vindo ao QuotaFlow (roteiro das configurações mínimas)
//   1º: o que a empresa faz (transporte · locação · compras — um ou mais) → os passos certos para o tipo do negócio.
//   Cada passo é conferido pelos dados (✓ sozinho), com o porquê e o botão para a tela certa; "não se aplica" dispensa.
//   modo "cartao": tela inicial (minimizável, some quando completo) · modo "pagina": ⚙️ Configurações → 👋 Roteiro inicial.
//   Substitui o "Complete o perfil da empresa" (14d.5).
import { useState, useEffect, useCallback } from "react";
import apiService from "../../services/apiService";
import { perfisDaSessao } from "../../utils/areaRestrita";

const CHAVE = "qf_bemvindo_minimizado";
const ler = () => { try { return localStorage.getItem(CHAVE) === "1"; } catch { return false; } };
const gravar = (v) => { try { localStorage.setItem(CHAVE, v ? "1" : "0"); } catch { /* ok */ } };
const GRUPOS = { empresa: "🏢 Empresa e equipe", transporte: "🚛 Transporte", locacao: "🏗 Locação", compras: "🛒 Compras e estoque" };

export default function BemVindo({ C, s, modo = "cartao", podeEditar = true, onAbrir }) {
  const [d, setD] = useState(null); const [mini, setMini] = useState(modo === "cartao" && ler());
  const [tipos, setTipos] = useState([]); const [editarTipos, setEditarTipos] = useState(false); const [erro, setErro] = useState(null); const [ocupado, setOcupado] = useState(false);
  const carregar = useCallback(() => apiService.get("/configuracoes/roteiro").then((r) => { setD(r); setTipos(r.tipos || []); }).catch(() => setD(null)), []);
  useEffect(() => { carregar(); }, [carregar]);
  const admin = perfisDaSessao().includes("admin"); // 👥 Usuários só o Administrador abre
  if (!d) return null;
  if (modo === "cartao" && d.completo) return null;
  const salvar = async (corpo) => { setOcupado(true); setErro(null); try { const r = await apiService.put("/configuracoes/roteiro", corpo); setD(r); setTipos(r.tipos || []); setEditarTipos(false); } catch (e) { setErro(e.message); } finally { setOcupado(false); } };
  const pct = d.total ? Math.round((d.feitos / d.total) * 100) : 0;
  const barra = <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden", flex: 1 }}><div style={{ width: `${pct}%`, height: "100%", background: C.accent }} /></div>;
  if (mini) return <div onClick={() => { setMini(false); gravar(false); }} className="qf-clicavel" style={{ ...s.card, padding: "10px 14px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
    <span style={{ fontSize: 13, fontWeight: 600 }}>👋 Configuração inicial {d.escolheu ? `${d.feitos}/${d.total}` : ""}</span>{barra}<span style={{ fontSize: 12, color: C.accent }}>continuar ›</span></div>;

  const escolher = !d.escolheu || editarTipos;
  const grupos = Object.keys(GRUPOS).filter((g) => d.passos.some((p) => p.grupo === g));
  const proximo = d.passos.find((p) => !p.ok && !p.dispensado && p.obrigatorio) || d.passos.find((p) => !p.ok && !p.dispensado);
  return <div style={{ ...s.card, padding: "16px 18px", marginBottom: 24, textAlign: "left", border: modo === "cartao" ? `1px solid ${C.accent}55` : undefined }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
      <div style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>👋 Bem-vindo ao QuotaFlow</div>
      {modo === "cartao" && <button type="button" onClick={() => { setMini(true); gravar(true); }} className="qf-clicavel" style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer" }}>minimizar</button>}
    </div>
    {d.migrou === false && <div style={{ fontSize: 12.5, color: C.warn, marginBottom: 8 }}>⚠️ Falta rodar a migration 070 para salvar o tipo do negócio.</div>}
    {escolher ? <>
      <div style={{ fontSize: 13, color: C.textSub, marginBottom: 10 }}>Para mostrar só o que importa para você: <b>o que a sua empresa faz?</b> Pode marcar mais de um.</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {Object.entries(d.tipos_disponiveis).map(([k, t]) => { const on = tipos.includes(k); return <button key={k} type="button" aria-pressed={on} disabled={!podeEditar} onClick={() => setTipos((v) => (on ? v.filter((x) => x !== k) : [...v, k]))}
          style={{ ...s.btn(on), padding: "10px 14px", textAlign: "left", cursor: podeEditar ? "pointer" : "default", minWidth: 200 }}><div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.nome}</div><div style={{ fontSize: 11.5, opacity: 0.8 }}>{t.dica}</div></button>; })}
      </div>
      {podeEditar ? <div style={{ display: "flex", gap: 8 }}>
        <button type="button" disabled={!tipos.length || ocupado || d.migrou === false} onClick={() => salvar({ tipos })} style={{ ...s.btn(!!tipos.length), padding: "8px 16px", fontSize: 13, cursor: tipos.length ? "pointer" : "default" }}>{ocupado ? "Salvando…" : "Montar meu roteiro"}</button>
        {editarTipos && <button type="button" onClick={() => { setTipos(d.tipos); setEditarTipos(false); }} style={{ ...s.btn(false), padding: "8px 14px", fontSize: 13, color: C.text, cursor: "pointer" }}>Cancelar</button>}
      </div> : <div style={{ fontSize: 12, color: C.muted }}>Peça ao gestor ou administrador para escolher o tipo do negócio.</div>}
    </> : <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: C.textSub }}>{d.tipos.map((k) => d.tipos_disponiveis[k]?.nome).join(" · ")}</span>
        {podeEditar && <button type="button" onClick={() => setEditarTipos(true)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 12, padding: 0 }}>mudar</button>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0 4px" }}><span style={{ fontSize: 12.5, fontWeight: 600 }}>{d.feitos} de {d.total} passos</span>{barra}</div>
      <div style={{ fontSize: 12, color: d.obrigatorios.feitos === d.obrigatorios.total ? (C.success || "#16a34a") : C.textSub, marginBottom: 10 }}>{d.obrigatorios.feitos === d.obrigatorios.total ? "✓ O mínimo para o sistema funcionar está pronto — os demais passos são recomendados." : `Obrigatórios: ${d.obrigatorios.feitos} de ${d.obrigatorios.total}${proximo ? ` · próximo: ${proximo.titulo}` : ""}`}</div>
      {grupos.map((g) => <div key={g} style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>{GRUPOS[g] || g}</div>
        {d.passos.filter((p) => p.grupo === g).map((p) => <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "7px 0", borderTop: `1px solid ${C.border}`, opacity: p.dispensado ? 0.55 : 1 }}>
          <span aria-label={p.ok ? "feito" : p.dispensado ? "não se aplica" : "pendente"} style={{ width: 20, height: 20, borderRadius: 10, flex: "0 0 20px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff", background: p.ok ? (C.success || "#16a34a") : p.dispensado ? C.muted : "transparent", border: p.ok || p.dispensado ? "none" : `2px solid ${p.obrigatorio ? C.accent : C.border}` }}>{p.ok ? "✓" : p.dispensado ? "–" : ""}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, textDecoration: p.dispensado ? "line-through" : "none" }}>{p.titulo} {!p.ok && !p.dispensado && <span style={{ fontSize: 11, fontWeight: 600, color: p.obrigatorio ? C.accent : C.muted }}>{p.obrigatorio ? "obrigatório" : "recomendado"}</span>}</div>
            {!p.ok && <div style={{ fontSize: 12, color: C.textSub }}>{p.porque}{p.falta ? <> Falta: <b>{p.falta}</b>.</> : null}</div>}
          </div>
          {!p.ok && !p.dispensado && p.tela === "usuarios" && !admin ? <span style={{ fontSize: 11.5, color: C.muted, whiteSpace: "nowrap", padding: "5px 0" }}>o Administrador cadastra</span> : !p.ok && !p.dispensado && <button type="button" onClick={() => onAbrir?.(p)} style={{ ...s.btn(true), padding: "5px 12px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>ir ›</button>}
          {!p.ok && podeEditar && !p.obrigatorio && <button type="button" onClick={() => salvar({ dispensar: { id: p.id, valor: !p.dispensado } })} disabled={ocupado} title={p.dispensado ? "Voltar a contar este passo" : "Não se aplica à minha empresa"} style={{ background: "none", border: "none", color: C.muted, fontSize: 11.5, cursor: "pointer", whiteSpace: "nowrap", padding: "5px 0" }}>{p.dispensado ? "contar de novo" : "não se aplica"}</button>}
        </div>)}
      </div>)}
      {modo === "cartao" && <div style={{ fontSize: 11.5, color: C.muted }}>Os passos se marcam sozinhos quando você conclui. Este roteiro também fica em ⚙️ Configurações → 👋 Roteiro inicial.</div>}
    </>}
    {erro && <div style={{ color: C.danger, fontSize: 12.5, marginTop: 8 }}>{erro}</div>}
  </div>;
}
