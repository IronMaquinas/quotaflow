// components/metas/TelaMetas.jsx — etapa SC2: 🎯 METAS DO NEGÓCIO (gestor/admin)
//   Cada empresa define os próprios limites do semáforo. Importa métricas sugeridas (e ajusta) ou cria escolhendo uma medida.
//   O valor é calculado pelo sistema a partir dos dados; a tendência compara com ~30 dias atrás.
import { useEffect, useState } from "react";
import apiService from "../../services/apiService";
import { Toggle } from "../../plataforma/ModulosPlataforma";
import ConfirmarExclusao from "../shared/ConfirmarExclusao";

export const COR_SINAL = { verde: "#22c55e", amarelo: "#f59e0b", vermelho: "#ef4444" };
export const fmtValor = (v, u) => (v == null ? "—" : u === "R$" ? `R$ ${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${u === "%" ? "%" : ""}`);
const regra = (m) => m.meta == null ? "sem meta definida" : m.sentido === "menor" ? `🟢 até ${fmtValor(m.meta, m.unidade)} · 🟡 até ${fmtValor(m.limite ?? m.meta, m.unidade)} · 🔴 acima` : `🟢 a partir de ${fmtValor(m.meta, m.unidade)} · 🟡 a partir de ${fmtValor(m.limite ?? m.meta, m.unidade)} · 🔴 abaixo`;

export default function TelaMetas({ C, s }) {
  const [d, setD] = useState(null); const [erro, setErro] = useState(null); const [sug, setSug] = useState(null); const [marcadas, setMarcadas] = useState(new Set());
  const [form, setForm] = useState(null); const [apagar, setApagar] = useState(null); const [ocup, setOcup] = useState(false); const [aviso, setAviso] = useState(null);
  const carregar = () => apiService.get("/metas").then((r) => { setD(r); setErro(null); }).catch((e) => setErro(e?.response?.data?.erro || "Não consegui carregar."));
  useEffect(() => { carregar(); }, []);
  const abrirSug = () => apiService.get("/metas/sugeridas").then((r) => { setSug(r.medidas); setMarcadas(new Set(r.medidas.filter((m) => !m.ja).map((m) => m.chave))); }).catch((e) => setErro(e?.response?.data?.erro || e.message));
  const importar = async () => { setOcup(true); try { const r = await apiService.post("/metas/importar", { chaves: [...marcadas] }); setSug(null); setAviso(`${r.importadas} meta(s) importada(s) — ajuste os limites como fizer sentido para a empresa.`); carregar(); } catch (e) { setErro(e?.response?.data?.erro || e.message); } finally { setOcup(false); } };
  const salvar = async () => { setOcup(true); try { const corpo = { nome: form.nome, meta: form.meta, limite: form.limite, responsavel_nome: form.responsavel_nome || null, observacao: form.observacao || null };
      if (form.id) await apiService.put(`/metas/${form.id}`, corpo); else await apiService.post("/metas", { ...corpo, chave: form.chave });
      setForm(null); carregar(); } catch (e) { setErro(e?.response?.data?.erro || e.message); } finally { setOcup(false); } };
  const excluir = async () => { setOcup(true); try { await apiService.delete(`/metas/${apagar.id}`); setApagar(null); carregar(); } catch (e) { setErro(e?.response?.data?.erro || e.message); } finally { setOcup(false); } };
  const novo = async () => { let ms = sug; if (!ms) { try { ms = (await apiService.get("/metas/sugeridas")).medidas; } catch (e) { setErro(e?.response?.data?.erro || e.message); return; } } const livre = ms.filter((m) => !m.ja); if (!livre.length) { setAviso("Todas as medidas já estão nas suas metas."); return; } setForm({ _medidas: livre, chave: livre[0].chave, nome: livre[0].nome, meta: livre[0].meta ?? "", limite: livre[0].limite ?? "", sentido: livre[0].sentido, unidade: livre[0].unidade }); };
  const grupos = d ? Object.entries(d.metas.reduce((g, m) => { (g[m.area_nome] = g[m.area_nome] || []).push(m); return g; }, {})) : [];
  const card = { ...s.card, padding: 16 };
  return (
    <div style={{ padding: "24px 28px 48px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <div style={{ fontSize: 24, fontWeight: 700, flex: 1 }}>🎯 Metas do Negócio</div>
        <button type="button" onClick={abrirSug} style={{ ...s.btn(false), cursor: "pointer", color: C.accent }}>📚 Métricas sugeridas</button>
        <button type="button" onClick={novo} style={{ ...s.btn(true), cursor: "pointer" }}>+ Nova meta</button>
      </div>
      <div style={{ fontSize: 13, color: C.textSub, margin: "4px 0 16px" }}>Os indicadores que dizem se a empresa vai bem. O sistema calcula o valor sozinho a partir dos dados; você define a meta e o limite do amarelo. Eles aparecem como <b>📊 Saúde do negócio</b> no Início.</div>
      {aviso && <div style={{ ...card, padding: "10px 14px", marginBottom: 12, color: "#4ade80", fontSize: 13 }}>{aviso}</div>}
      {erro && <div style={{ ...card, padding: "10px 14px", marginBottom: 12, color: C.danger, fontSize: 13 }}>{erro}</div>}
      {d && d.metas.length === 0 && <div style={{ ...card, textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 32 }}>🎯</div><div style={{ fontWeight: 700, margin: "6px 0" }}>Nenhuma meta ainda</div>
        <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12 }}>Comece pelas métricas sugeridas — dá para ajustar tudo depois.</div>
        <button type="button" onClick={abrirSug} style={{ ...s.btn(true), cursor: "pointer" }}>📚 Ver métricas sugeridas</button></div>}
      {grupos.map(([area, ms]) => <div key={area} style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: C.textSub, margin: "8px 0" }}>{area.toUpperCase()}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {ms.map((m) => <div key={m.id} style={{ ...card, borderLeft: `4px solid ${COR_SINAL[m.sinal] || C.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{m.nome}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "6px 0 2px" }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: COR_SINAL[m.sinal] || C.text }}>{fmtValor(m.valor, m.unidade)}</span>
              {m.tendencia && m.tendencia.dif !== 0 && <span title={`desde ${m.tendencia.desde.split("-").reverse().join("/")}`} style={{ fontSize: 12.5, color: m.tendencia.melhorou ? "#4ade80" : "#f87171" }}>{m.tendencia.dif > 0 ? "▲" : "▼"} {fmtValor(Math.abs(m.tendencia.dif), m.unidade)}</span>}
            </div>
            <div style={{ fontSize: 11.5, color: C.muted }}>{regra(m)}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }} title={m.como}>📐 {m.como}{m.responsavel_nome ? ` · 👤 ${m.responsavel_nome}` : ""}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button type="button" onClick={() => setForm({ ...m, meta: m.meta ?? "", limite: m.limite ?? "" })} style={{ ...s.btn(false), padding: "4px 10px", fontSize: 12, cursor: "pointer", color: C.text }}>Editar</button>
              <button type="button" onClick={() => setApagar(m)} style={{ ...s.btn(false), padding: "4px 10px", fontSize: 12, cursor: "pointer", color: C.danger }}>Excluir</button>
            </div>
          </div>)}
        </div></div>)}

      {sug && <div onClick={() => setSug(null)} style={{ position: "fixed", inset: 0, background: "#000000aa", zIndex: 80, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "min(640px, 100%)" }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>📚 Métricas sugeridas</div>
          <div style={{ fontSize: 12, color: C.textSub, margin: "4px 0 10px" }}>Escolha as que fazem sentido. Entram com uma meta sugerida — você ajusta depois em Editar.</div>
          {sug.map((m) => <div key={m.chave} onClick={() => !m.ja && setMarcadas((x) => { const n = new Set(x); n.has(m.chave) ? n.delete(m.chave) : n.add(m.chave); return n; })} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 4px", borderTop: `1px solid ${C.border}`, cursor: m.ja ? "default" : "pointer", opacity: m.ja ? 0.55 : 1 }}>
            <span style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.nome} <span style={{ fontWeight: 400, fontSize: 11.5, color: C.muted }}>· {m.area_nome}</span></div>
              <div style={{ fontSize: 11.5, color: C.muted }}>{m.como}{m.meta != null ? ` · meta sugerida ${fmtValor(m.meta, m.unidade)}` : ""}</div></span>
            {m.ja ? <span style={{ fontSize: 11.5, color: C.muted }}>já tem</span> : <span onClick={(e) => e.stopPropagation()}><Toggle C={C} ligado={marcadas.has(m.chave)} rotulo={m.nome} onChange={() => setMarcadas((x) => { const n = new Set(x); n.has(m.chave) ? n.delete(m.chave) : n.add(m.chave); return n; })} /></span>}
          </div>)}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" onClick={() => setSug(null)} style={{ ...s.btn(false), flex: 1, cursor: "pointer", color: C.text }}>Cancelar</button>
            <button type="button" disabled={!marcadas.size || ocup} onClick={importar} style={{ ...s.btn(true), flex: 1.4, cursor: "pointer", opacity: marcadas.size ? 1 : 0.6 }}>{ocup ? "Importando…" : `Importar ${marcadas.size} métrica(s)`}</button>
          </div>
        </div></div>}

      {form && <div onClick={() => setForm(null)} style={{ position: "fixed", inset: 0, background: "#000000aa", zIndex: 80, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "min(520px, 100%)" }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{form.id ? "Editar meta" : "Nova meta"}</div>
          {!form.id && <label style={{ display: "block", marginBottom: 10 }}><span style={s.label}>MEDIDA (O SISTEMA CALCULA)</span>
            <select value={form.chave} onChange={(e) => { const m = form._medidas.find((x) => x.chave === e.target.value); setForm({ ...form, chave: m.chave, nome: m.nome, meta: m.meta ?? "", limite: m.limite ?? "", sentido: m.sentido, unidade: m.unidade }); }} style={s.input}>
              {form._medidas.map((m) => <option key={m.chave} value={m.chave}>{m.nome}</option>)}</select></label>}
          <label style={{ display: "block", marginBottom: 10 }}><span style={s.label}>NOME</span><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={s.input} /></label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 140px" }}><span style={s.label}>🟢 META ({form.sentido === "menor" ? "no máximo" : "no mínimo"}{form.unidade ? ` · ${form.unidade}` : ""})</span><input type="number" step="any" value={form.meta} onChange={(e) => setForm({ ...form, meta: e.target.value })} style={s.input} /></label>
            <label style={{ flex: "1 1 140px" }}><span style={s.label}>🟡 LIMITE DO AMARELO</span><input type="number" step="any" value={form.limite} onChange={(e) => setForm({ ...form, limite: e.target.value })} style={s.input} /></label>
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, margin: "4px 0 10px" }}>{form.sentido === "menor" ? "Menor é melhor: até a meta 🟢, até o limite 🟡, acima 🔴." : "Maior é melhor: a partir da meta 🟢, a partir do limite 🟡, abaixo 🔴."} Sem meta = mostra o número sem semáforo.</div>
          <label style={{ display: "block", marginBottom: 10 }}><span style={s.label}>RESPONSÁVEL (OPCIONAL)</span><input value={form.responsavel_nome || ""} onChange={(e) => setForm({ ...form, responsavel_nome: e.target.value })} placeholder="Quem acompanha este indicador" style={s.input} /></label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setForm(null)} style={{ ...s.btn(false), flex: 1, cursor: "pointer", color: C.text }}>Cancelar</button>
            <button type="button" disabled={ocup || !String(form.nome || "").trim()} onClick={salvar} style={{ ...s.btn(true), flex: 1.4, cursor: "pointer" }}>{ocup ? "Salvando…" : "Salvar"}</button>
          </div>
        </div></div>}
      {apagar && <ConfirmarExclusao C={C} s={s} titulo={`Excluir a meta "${apagar.nome}"?`} texto="O indicador sai da Saúde do negócio. O histórico de fotografias fica guardado." ocupado={ocup} onCancelar={() => setApagar(null)} onConfirmar={excluir} />}
    </div>
  );
}
