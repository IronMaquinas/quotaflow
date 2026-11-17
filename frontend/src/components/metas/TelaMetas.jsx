// components/metas/TelaMetas.jsx — etapa SC2: 🎯 METAS DO NEGÓCIO (gestor/admin)
//   Cada empresa define os próprios limites do semáforo. Importa métricas sugeridas (e ajusta) ou cria escolhendo uma medida.
//   O valor é calculado pelo sistema a partir dos dados; a tendência compara com ~30 dias atrás.
import { useEffect, useState } from "react";
import apiService from "../../services/apiService";
import { Toggle } from "../../plataforma/ModulosPlataforma";
import ConfirmarExclusao from "../shared/ConfirmarExclusao";
import CampoFuncionario from "../shared/CampoFuncionario"; // SC2.1: dono da meta = funcionário do cadastro
import FichaMeta from "./FichaMeta"; // SC2.4
import PainelAnualMetas from "./PainelAnualMetas"; // SC2.4

function Mini({ valores, cor }) { // SC2.4: mini gráfico dos últimos meses
  const W = 90; const H = 28; const lo = Math.min(...valores); const hi = Math.max(...valores); const y = (v) => (hi === lo ? H / 2 : 3 + (1 - (v - lo) / (hi - lo)) * (H - 6));
  const d = valores.map((v, i) => `${i ? "L" : "M"}${(i * (W - 4)) / (valores.length - 1) + 2},${y(v).toFixed(1)}`).join(" ");
  return <svg width={W} height={H} style={{ flex: "none" }}><path d={d} fill="none" stroke={cor} strokeWidth="2" strokeLinejoin="round" /></svg>;
}

export const COR_SINAL = { verde: "#22c55e", amarelo: "#f59e0b", vermelho: "#ef4444" };
export const fmtValor = (v, u) => (v == null ? "—" : u === "R$" ? `R$ ${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${u === "%" ? "%" : ["h", "dias", "km", "L"].includes(u) ? ` ${u}` : ""}`);

export default function TelaMetas({ C, s }) {
  const [d, setD] = useState(null); const [erro, setErro] = useState(null); const [sug, setSug] = useState(null); const [marcadas, setMarcadas] = useState(new Set());
  const [form, setForm] = useState(null); const [apagar, setApagar] = useState(null); const [ocup, setOcup] = useState(false); const [aviso, setAviso] = useState(null);
  const [ficha, setFicha] = useState(null); const [painel, setPainel] = useState(false); // SC2.4
  const [pessoas, setPessoas] = useState(null); const [areas, setAreas] = useState({}); const [unidades, setUnidades] = useState(["%", "un", "R$", "h", "dias"]); const [valorDe, setValorDe] = useState(null);
  useEffect(() => { apiService.get("/pessoas/gestao-pessoas").then((r) => setPessoas(r.funcionarios || [])).catch(() => setPessoas([])); }, []);
  const informar = async () => { setOcup(true); try { await apiService.post(`/metas/${valorDe.id}/valor`, { valor: valorDe.valor }); setValorDe(null); carregar(); } catch (e) { setErro(e?.response?.data?.erro || e.message); } finally { setOcup(false); } };
  const carregar = () => apiService.get("/metas").then((r) => { setD(r); setErro(null); }).catch((e) => setErro(e?.response?.data?.erro || "Não consegui carregar."));
  useEffect(() => { carregar(); }, []);
  const abrirSug = () => apiService.get("/metas/sugeridas").then((r) => { setSug(r.medidas); setMarcadas(new Set()); }).catch((e) => setErro(e?.response?.data?.erro || e.message));
  const importar = async () => { setOcup(true); try { const r = await apiService.post("/metas/importar", { chaves: [...marcadas] }); setSug(null); setAviso(`${r.importadas} meta(s) importada(s) — ajuste os limites como fizer sentido para a empresa.`); carregar(); } catch (e) { setErro(e?.response?.data?.erro || e.message); } finally { setOcup(false); } };
  const salvar = async () => { setOcup(true); try { const corpo = { nome: form.nome, meta: form.meta, limite: form.limite, responsavel_colaborador_id: form.responsavel_colaborador_id || null, responsavel_usuario_id: form.responsavel_usuario_id || null, observacao: String(form.observacao || "").trim() || null,
        ...((form.chave === "manual" || form.origem === "manual") ? { area: form.area, unidade: form.unidade, sentido: form.sentido } : {}) };
      if (form.id) await apiService.put(`/metas/${form.id}`, corpo); else await apiService.post("/metas", { ...corpo, chave: form.chave });
      setForm(null); carregar(); } catch (e) { setErro(e?.response?.data?.erro || e.message); } finally { setOcup(false); } };
  const excluir = async () => { setOcup(true); try { await apiService.delete(`/metas/${apagar.id}`); setApagar(null); carregar(); } catch (e) { setErro(e?.response?.data?.erro || e.message); } finally { setOcup(false); } };
  const MANUAL = { chave: "manual", nome: "", meta: "", limite: "", sentido: "maior", unidade: "un", area: "manutencao", como: "Você define o nome e informa o valor quando medir (ex.: MTBF, consumo por km, custo de manutenção por hora)." };
  const novo = async () => { let r; try { r = await apiService.get("/metas/sugeridas"); } catch (e) { setErro(e?.response?.data?.erro || e.message); return; }
    setAreas(r.areas || {}); if (r.unidades) setUnidades(r.unidades);
    const livre = r.medidas.filter((m) => !m.ja); const ini = MANUAL; // SC2.2: começa vazio — digita e escolhe
    setForm({ _medidas: livre, ...ini, meta: ini.meta ?? "", limite: ini.limite ?? "" }); };
  const semDono = !form || (!form.responsavel_colaborador_id && !form.responsavel_usuario_id);
  const grupos = d ? Object.entries(d.metas.reduce((g, m) => { (g[m.area_nome] = g[m.area_nome] || []).push(m); return g; }, {})) : [];
  const card = { ...s.card, padding: 16 };
  return (
    <div style={{ padding: "24px 28px 48px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <div style={{ fontSize: 24, fontWeight: 700, flex: 1 }}>🎯 Metas do Negócio</div>
        {d?.metas?.length > 0 && <button type="button" onClick={() => setPainel(true)} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>📅 Painel anual</button>}
        {d?.pode_editar !== false && <button type="button" onClick={abrirSug} style={{ ...s.btn(false), cursor: "pointer", color: C.accent }}>📚 Métricas sugeridas</button>}
        {d?.pode_editar !== false && <button type="button" onClick={novo} style={{ ...s.btn(true), cursor: "pointer" }}>+ Nova meta</button>}
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          {ms.map((m) => { const dono = String(m.responsavel_usuario_id || "") === String(d.eu || ""); const pts = [...(m.serie || []).map((x) => x.valor), m.valor].filter((v) => v != null); return (
          <div key={m.id} onClick={() => setFicha(m.id)} style={{ ...card, borderLeft: `4px solid ${COR_SINAL[m.sinal] || C.border}`, cursor: "pointer", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{m.nome}</div>
              {m.sem_dono ? <span style={{ ...s.tag(C.warn), fontSize: 10.5, whiteSpace: "nowrap" }}>⚠ sem dono</span> : <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>👤 {m.responsavel_nome}</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: COR_SINAL[m.sinal] || C.text, lineHeight: 1 }}>{fmtValor(m.valor, m.unidade)}</span>
              {m.tendencia && m.tendencia.dif !== 0 && <span title={`em relação a ${m.tendencia.desde.split("-").reverse().join("/")}`} style={{ fontSize: 12.5, color: m.tendencia.melhorou ? "#4ade80" : "#f87171" }}>{m.tendencia.dif > 0 ? "▲" : "▼"} {fmtValor(Math.abs(m.tendencia.dif), m.unidade)}</span>}
              <span style={{ flex: 1 }} />{pts.length > 1 && <Mini valores={pts} cor={COR_SINAL[m.sinal] || C.textSub} />}
            </div>
            <div style={{ fontSize: 11.5, color: C.textSub }}>{m.meta == null ? "sem meta definida" : <><span style={{ color: COR_SINAL.verde }}>●</span> meta {m.sentido === "menor" ? "≤" : "≥"} {fmtValor(m.meta, m.unidade)}{m.limite != null && Number(m.limite) !== Number(m.meta) && <> · <span style={{ color: COR_SINAL.amarelo }}>●</span> amarelo {m.sentido === "menor" ? "≤" : "≥"} {fmtValor(m.limite, m.unidade)}</>}</>}</div>
            {m.descricao && <div title={m.como ? `Como calculamos: ${m.como}` : ""} style={{ fontSize: 12, color: C.muted, lineHeight: 1.45, whiteSpace: "pre-line" }}>{m.descricao}</div>}
            {m.origem === "manual" && <div style={{ fontSize: 11, color: C.muted }}>{m.informado ? `✏️ último valor em ${m.informado.dia.split("-").reverse().join("/")}${m.informado.por ? ` · ${m.informado.por}` : ""}` : "✏️ ainda sem valor informado"}</div>}
            {valorDe?.id === m.id && <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 6 }}>
              <input autoFocus type="number" step="any" value={valorDe.valor} onChange={(e) => setValorDe({ ...valorDe, valor: e.target.value })} placeholder={`valor de hoje${m.unidade ? ` (${m.unidade})` : ""}`} style={{ ...s.input, padding: "5px 8px" }} />
              <button type="button" disabled={ocup || valorDe.valor === ""} onClick={informar} style={{ ...s.btn(true), padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>Salvar</button>
              <button type="button" onClick={() => setValorDe(null)} style={{ ...s.btn(false), padding: "4px 10px", fontSize: 12, cursor: "pointer", color: C.text }}>×</button></div>}
            <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 6, marginTop: "auto", paddingTop: 4, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setFicha(m.id)} style={{ ...s.btn(false), padding: "4px 10px", fontSize: 12, cursor: "pointer", color: C.accent }}>📈 Mês a mês</button>
              {m.origem === "manual" && (d.pode_editar || dono) && valorDe?.id !== m.id && <button type="button" onClick={() => setValorDe({ id: m.id, valor: "" })} style={{ ...s.btn(false), padding: "4px 10px", fontSize: 12, cursor: "pointer", color: C.accent }}>✏️ Informar valor</button>}
              {d.pode_editar && <button type="button" onClick={() => { apiService.get("/metas/sugeridas").then((r) => { setAreas(r.areas || {}); if (r.unidades) setUnidades(r.unidades); }).catch(() => {}); setForm({ ...m, observacao: m.observacao || m.descricao || "", meta: m.meta ?? "", limite: m.limite ?? "" }); }} style={{ ...s.btn(false), padding: "4px 10px", fontSize: 12, cursor: "pointer", color: C.text }}>Editar</button>}
              {d.pode_editar && <button type="button" onClick={() => setApagar(m)} style={{ ...s.btn(false), padding: "4px 10px", fontSize: 12, cursor: "pointer", color: C.danger }}>Excluir</button>}
            </div>
          </div>); })}
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
          {!form.id && <label style={{ display: "block", marginBottom: 10 }}><span style={s.label}>NOME DA META</span>{/* SC2.2: Nova meta = sempre meta própria; as que o sistema calcula ficam em 📚 Métricas sugeridas */}
            <input autoFocus value={form.nome} placeholder="Ex.: MTBF da frota, custo de manutenção por km…" onChange={(e) => setForm({ ...form, nome: e.target.value })} style={s.input} />
            <span style={{ display: "block", fontSize: 11.5, color: C.muted, marginTop: 4 }}>✏️ Você informa o valor quando medir. As medidas que o sistema calcula sozinho estão em 📚 Métricas sugeridas.</span></label>}
          {(form.chave === "manual" || form.origem === "manual") && <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <label style={{ flex: "1 1 150px" }}><span style={s.label}>ÁREA</span><select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} style={s.input}>{Object.entries(Object.keys(areas).length ? areas : { [form.area]: form.area_nome || form.area }).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label style={{ flex: "0 1 100px" }}><span style={s.label}>UNIDADE</span><select value={form.unidade || ""} onChange={(e) => setForm({ ...form, unidade: e.target.value })} style={s.input}>{unidades.map((u) => <option key={u} value={u}>{u}</option>)}</select></label>
            <label style={{ flex: "1 1 160px" }}><span style={s.label}>O QUE É MELHOR</span><select value={form.sentido} onChange={(e) => setForm({ ...form, sentido: e.target.value })} style={s.input}><option value="maior">Quanto maior, melhor</option><option value="menor">Quanto menor, melhor</option></select></label>
          </div>}
          {form.id && <label style={{ display: "block", marginBottom: 10 }}><span style={s.label}>NOME</span><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={s.input} /></label>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 140px" }}><span style={s.label}>🟢 META ({form.sentido === "menor" ? "no máximo" : "no mínimo"}{form.unidade ? ` · ${form.unidade}` : ""})</span><input type="number" step="any" value={form.meta} onChange={(e) => setForm({ ...form, meta: e.target.value })} style={s.input} /></label>
            <label style={{ flex: "1 1 140px" }}><span style={s.label}>🟡 LIMITE DO AMARELO</span><input type="number" step="any" value={form.limite} onChange={(e) => setForm({ ...form, limite: e.target.value })} style={s.input} /></label>
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, margin: "4px 0 10px" }}>{form.sentido === "menor" ? "Menor é melhor: até a meta 🟢, até o limite 🟡, acima 🔴." : "Maior é melhor: a partir da meta 🟢, a partir do limite 🟡, abaixo 🔴."} Sem meta = mostra o número sem semáforo.</div>
          <label style={{ display: "block", marginBottom: 10 }}><span style={s.label}>DESCRIÇÃO (O QUE A META MEDE E POR QUE IMPORTA)</span>
            <textarea rows={3} value={form.observacao || ""} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Ex.: Tempo médio entre falhas da frota — quanto maior, menos parada na estrada. Medido todo fim de mês pela manutenção." style={{ ...s.input, minHeight: 70, resize: "vertical", fontFamily: "inherit" }} />
            <span style={{ fontSize: 11, color: C.muted }}>Aparece no cartão da meta e na Saúde do negócio — escreva para quem vai ler.</span></label>
          <div style={{ marginBottom: 10 }}><span style={s.label}>👤 DONO DA META (OBRIGATÓRIO)</span>
            <CampoFuncionario C={C} s={s} lista={pessoas} nome={form.responsavel_nome || ""} id={form.responsavel_colaborador_id} usuarioId={form.responsavel_usuario_id} placeholder="Digite o nome do funcionário…"
              onChange={(v) => setForm({ ...form, responsavel_nome: v.nome, responsavel_colaborador_id: v.id, responsavel_usuario_id: v.usuario_id })} />
            {form.responsavel_nome && semDono && <span style={{ fontSize: 11.5, color: C.warn }}>Escolha o nome na lista — a meta precisa de um dono do cadastro.</span>}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setForm(null)} style={{ ...s.btn(false), flex: 1, cursor: "pointer", color: C.text }}>Cancelar</button>
            <button type="button" disabled={ocup || !String(form.nome || "").trim() || semDono} onClick={salvar} style={{ ...s.btn(true), flex: 1.4, cursor: "pointer" }}>{ocup ? "Salvando…" : "Salvar"}</button>
          </div>
        </div></div>}
      {ficha && <FichaMeta C={C} s={s} metaId={ficha} podeCorrigir={d?.pode_editar || String(d?.metas?.find((x) => String(x.id) === String(ficha))?.responsavel_usuario_id || "") === String(d?.eu || "")} onFechar={() => setFicha(null)} onMudou={carregar} />}
      {painel && <PainelAnualMetas C={C} s={s} onErro={setErro} onFechar={() => setPainel(false)} onAbrir={(id) => { setPainel(false); setFicha(id); }} />}
      {apagar && <ConfirmarExclusao C={C} s={s} titulo={`Excluir a meta "${apagar.nome}"?`} texto="O indicador sai da Saúde do negócio. O histórico de fotografias fica guardado." ocupado={ocup} onCancelar={() => setApagar(null)} onConfirmar={excluir} />}
    </div>
  );
}
