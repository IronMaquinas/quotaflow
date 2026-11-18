// components/pessoas/TelaFerias.jsx — etapa B1.5: 🏖 férias do colaborador (Pessoas → aba Férias)
//   Quem está de férias agora, quem sai nos próximos 60 dias e o histórico. Um período por lançamento (fracionadas = vários).
//   Funcionário sempre pela busca do cadastro (CampoFuncionario). A 👋 Beta responde "quem está de férias?".
// B1.6: 📊 saldo por funcionário (regras do país: período aquisitivo pela ADMISSÃO, faltas, limite para gozar) com alerta
//   de vencimento, e o 🧠 Analista confere a programação enquanto você preenche (avisa, não bloqueia).
import { useEffect, useMemo, useState } from "react";
import apiService from "../../services/apiService";
import CampoFuncionario from "../shared/CampoFuncionario";

const dBR = (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");
const SIT = { em_gozo: { l: "🏖 De férias", c: "#22c55e" }, programada: { l: "📅 Programada", c: "#3b82f6" }, concluida: { l: "Concluída", c: "#94a3b8" } };
const somaDias = (d, n) => { if (!d) return ""; const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

export default function TelaFerias({ C, s, modal, campo, colabs = [], editar, excluir, onAviso, onErro, recarregar }) {
  const [resumo, setResumo] = useState(null); // B1.7: resumo do funcionário escolhido
  const [saldos, setSaldos] = useState(null); const [analise, setAnalise] = useState(null); const [filtroSaldo, setFiltroSaldo] = useState("alerta");
  const [lista, setLista] = useState([]); const [form, setForm] = useState(null); const [salvando, setSalvando] = useState(false); const [verHist, setVerHist] = useState(false); const [erroForm, setErroForm] = useState("");
  const carregar = async () => { try { const r = await apiService.get("/pessoas/ferias"); setLista(r.ferias || []); } catch (e) { onErro?.(e?.response?.data?.erro || e.message); }
    try { setSaldos(await apiService.get("/pessoas/ferias/saldos")); } catch (e) { setSaldos({ erro: e?.response?.data?.erro || e.message }); } };
  useEffect(() => { if (!form?.colaborador_id) { setResumo(null); return; } setResumo({ carregando: true });
    apiService.get(`/pessoas/ferias/saldos?colaborador_id=${form.colaborador_id}`).then((r) => setResumo(r.colaboradores?.[0] || { vazio: true })).catch(() => setResumo(null)); }, [form?.colaborador_id]); // eslint-disable-line
  // 🧠 Analista: confere a programação enquanto preenche
  useEffect(() => { if (!form?.colaborador_id || !form.inicio || !form.fim || form.fim < form.inicio) { setAnalise(null); return; }
    const t = setTimeout(() => apiService.post("/pessoas/ferias/analisar", { id: form.id, colaborador_id: form.colaborador_id, inicio: form.inicio, fim: form.fim, abono_dias: form.abono_dias || 0 }).then(setAnalise).catch(() => setAnalise(null)), 350);
    return () => clearTimeout(t); }, [form?.colaborador_id, form?.inicio, form?.fim, form?.abono_dias]); // eslint-disable-line
  useEffect(() => { carregar(); }, [recarregar]); // eslint-disable-line
  const pessoas = useMemo(() => colabs.filter((c) => c.situacao !== "desligado").map((c) => ({ id: c.id, nome: c.nome, usuario_id: c.usuario_id || null })), [colabs]);
  const agora = lista.filter((f) => f.situacao === "em_gozo").sort((a, b) => a.fim.localeCompare(b.fim));
  const prox = lista.filter((f) => f.situacao === "programada").sort((a, b) => a.inicio.localeCompare(b.inicio));
  const hist = lista.filter((f) => f.situacao === "concluida");
  const fimAntes = !!(form?.inicio && form?.fim && form.fim < form.inicio); // B1.9
  const dias = form?.inicio && form?.fim && form.fim >= form.inicio ? Math.round((Date.parse(form.fim) - Date.parse(form.inicio)) / 864e5) + 1 : null;

  const salvar = async () => {
    setErroForm(""); if (!form.colaborador_id) return setErroForm("Escolha o funcionário pela busca do cadastro.");
    setSalvando(true);
    try {
      const corpo = { colaborador_id: form.colaborador_id, inicio: form.inicio, fim: form.fim, abono_dias: form.abono_dias || 0, obs: form.obs };
      if (form.id) await apiService.put(`/pessoas/ferias/${form.id}`, corpo); else await apiService.post("/pessoas/ferias", corpo);
      onAviso?.(form.id ? "Férias atualizadas." : `Férias de ${form.colaborador_nome} lançadas.`); setForm(null); await carregar();
    } catch (e) { setErroForm(e?.response?.data?.erro || e.message); } finally { setSalvando(false); }
  };

  const linha = (f, ultimo) => {
    const st = SIT[f.situacao] || SIT.concluida;
    return (
      <div key={f.id} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "12px 16px", borderBottom: ultimo ? "none" : `1px solid ${C.border}`, opacity: f.situacao === "concluida" ? 0.7 : 1 }}>
        <div style={{ flex: "2 1 220px", minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{f.colaborador_nome}</div>
          <div style={{ fontSize: 12, color: C.textSub }}>{f.funcao || "—"}{f.periodo_aquisitivo ? ` · período ${f.periodo_aquisitivo}` : ""}{f.abono_dias ? ` · ${f.abono_dias} dia(s) vendido(s)` : ""}{f.obs ? ` · ${f.obs}` : ""}</div>
        </div>
        <div style={{ flex: "1 1 200px", fontSize: 12, color: C.textSub }}>
          <b style={{ color: C.text }}>{dBR(f.inicio)} a {dBR(f.fim)}</b> · {f.dias} dia(s)<br />
          {f.situacao === "em_gozo" ? <>volta em <b style={{ color: C.text }}>{dBR(f.retorno)}</b></> : f.situacao === "programada" ? <>sai em {f.faltam_dias} dia(s) · volta {dBR(f.retorno)}</> : <>voltou {dBR(f.retorno)}</>}
        </div>
        <span style={s.tag(st.c)}>{st.l}</span>
        {editar && <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => { setErroForm(""); setForm({ ...f }); }} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.text }}>Editar</button>
          <button onClick={() => excluir("Excluir férias", `Excluir as férias de ${f.colaborador_nome} (${dBR(f.inicio)} a ${dBR(f.fim)})?`, async () => { await apiService.delete(`/pessoas/ferias/${f.id}`); await carregar(); return "Férias excluídas."; })}
            style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.danger }}>Excluir</button>
        </div>}
      </div>
    );
  };
  const bloco = (titulo, xs, vazio) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{titulo} <span style={{ color: C.muted, fontWeight: 400 }}>({xs.length})</span></div>
      {xs.length ? <div style={{ ...s.card, overflow: "hidden" }}>{xs.map((f, i) => linha(f, i === xs.length - 1))}</div>
        : <div style={{ ...s.card, padding: 16, color: C.muted, fontSize: 13 }}>{vazio}</div>}
    </div>
  );

  return (
    <>
      <div style={{ display: "flex", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: C.textSub, alignSelf: "center", flex: "1 1 300px" }}>Férias de cada funcionário — a lista de colaboradores e a 👋 Beta mostram quem está fora. Férias fracionadas: lance cada período separado.</div>
        {editar && <button onClick={() => { setErroForm(""); setForm({ colaborador_id: null, colaborador_nome: "", inicio: "", fim: "", periodo_aquisitivo: "", abono_dias: 0, obs: "" }); }} style={{ ...s.btn(true), cursor: "pointer" }}>＋ Lançar férias</button>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 }}>
        {[["🏖 De férias agora", agora.length, "#22c55e"], ["📅 Saem em 30 dias", prox.filter((f) => f.faltam_dias <= 30).length, "#3b82f6"], ["📅 Programadas", prox.length, C.text]].map(([l, n, c]) => (
          <div key={l} style={{ ...s.card, padding: "12px 16px" }}><div style={{ fontSize: 12, color: C.textSub }}>{l}</div><div style={{ fontSize: 26, fontWeight: 800, color: c }}>{n}</div></div>))}
      </div>
      {saldos && !saldos.erro && (() => {
        const ALR = { vencido: { l: "⛔ Vencidas", c: C.danger }, critico: { l: "⚠ Vence em ≤ 30 dias", c: C.warn }, vencendo: { l: "Vence em ≤ 90 dias", c: "#eab308" }, sem_admissao: { l: "Sem admissão", c: C.muted } };
        const xs = saldos.colaboradores || []; const com = xs.filter((x) => x.alerta);
        const vis = filtroSaldo === "alerta" ? com : xs;
        return (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>📊 Saldo de férias</div>
              <div style={{ fontSize: 11.5, color: C.muted, flex: "1 1 240px" }}>Regras: {saldos.regras} · período aquisitivo pela admissão · faltas injustificadas reduzem os dias</div>
              {[["alerta", `Precisam de atenção (${com.length})`], ["todos", `Todos (${xs.length})`]].map(([k, l]) => <button key={k} onClick={() => setFiltroSaldo(k)} style={{ ...s.btn(filtroSaldo === k), cursor: "pointer", padding: "4px 10px", fontSize: 12 }}>{l}</button>)}
            </div>
            {!vis.length ? <div style={{ ...s.card, padding: 16, color: C.muted, fontSize: 13 }}>{filtroSaldo === "alerta" ? "✓ Nenhum saldo vencendo nos próximos 90 dias." : "Nenhum funcionário ativo."}</div> : (
              <div style={{ ...s.card, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 720 }}>
                  <thead><tr style={{ color: C.textSub, textAlign: "left" }}>{["Funcionário", "Admissão", "Período a gozar", "Direito", "Gozado", "Programado", "Saldo", "Limite para gozar", ""].map((h) => <th key={h} style={{ padding: "9px 12px", fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>)}</tr></thead>
                  <tbody>{vis.map((x) => { const p = x.atual; const a = ALR[x.alerta]; return (
                    <tr key={x.colaborador_id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "9px 12px", fontWeight: 600 }}>{x.nome}{x.faltas_periodo > 5 && <div style={{ fontSize: 11, color: C.warn, fontWeight: 400 }}>{x.faltas_periodo} faltas no período</div>}</td>
                      <td style={{ padding: "9px 12px" }}>{dBR(x.admissao)}</td>
                      <td style={{ padding: "9px 12px" }}>{p ? <>{dBR(p.inicio)} a {dBR(p.fim)}{p.situacao === "em_aquisicao" && <div style={{ fontSize: 11, color: C.muted }}>em aquisição</div>}</> : "—"}</td>
                      <td style={{ padding: "9px 12px" }}>{p ? p.direito : "—"}</td><td style={{ padding: "9px 12px" }}>{p ? p.gozado : "—"}</td><td style={{ padding: "9px 12px" }}>{p ? p.programado : "—"}</td>
                      <td style={{ padding: "9px 12px", fontWeight: 700, color: p && p.saldo > 0 && x.alerta ? a?.c : C.text }}>{p ? p.saldo : "—"}{x.periodos.filter((q) => ["aberto", "vencido"].includes(q.situacao)).length > 1 && <div style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>total {x.a_gozar}</div>}</td>
                      <td style={{ padding: "9px 12px" }}>{p && p.situacao !== "em_aquisicao" ? dBR(p.limite) : "—"}</td>
                      <td style={{ padding: "9px 12px" }}>{a && <span style={s.tag(a.c)}>{a.l}</span>}</td>
                    </tr>); })}</tbody>
                </table>
              </div>)}
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Períodos que terminaram antes de começar o controle no sistema (desde {dBR(saldos.controle_desde)}) não entram — para corrigir, lance as férias antigas. Faltas: ficha do funcionário.</div>
          </div>);
      })()}
      {saldos?.erro && <div style={{ ...s.card, padding: 12, color: C.warn, fontSize: 12.5, marginBottom: 14 }}>📊 Saldo de férias: {saldos.erro}</div>}
      {bloco("🏖 De férias agora", agora, "Ninguém de férias hoje.")}
      {bloco("📅 Programadas", prox, "Nenhuma férias programada.")}
      <button onClick={() => setVerHist(!verHist)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 10, fontFamily: "inherit" }}>{verHist ? "▾" : "▸"} Histórico ({hist.length})</button>
      {verHist && bloco("Concluídas", hist, "Sem histórico ainda.")}

      {form && modal(<>
        <h3 style={{ margin: "0 0 14px", fontSize: 17 }}>{form.id ? "Editar férias" : "🏖 Lançar férias"}</h3>
        <div style={{ display: "grid", gap: 12 }}>
          {campo("Funcionário *", form.id ? <div style={{ ...s.input, opacity: 0.8 }}>{form.colaborador_nome}</div>
            : <CampoFuncionario C={C} s={s} lista={pessoas} nome={form.colaborador_nome} id={form.colaborador_id} placeholder="Digite o nome do funcionário…"
              onChange={(p) => setForm({ ...form, colaborador_nome: p.nome, colaborador_id: p.id })} />)}
          {form.colaborador_id && resumo && !resumo.carregando && !resumo.vazio && (() => { const p = resumo.atual; const ALR = { vencido: ["⛔ período vencido — paga em dobro", C.danger], critico: ["⚠ vence em até 30 dias", C.warn], vencendo: ["vence em até 90 dias", "#eab308"] }[resumo.alerta];
            const cel = (rot, val, sub, cor) => <div style={{ flex: "1 1 110px", minWidth: 0 }}><div style={{ fontSize: 10.5, color: C.textSub, fontWeight: 600, letterSpacing: 0.3 }}>{rot}</div><div style={{ fontSize: 15, fontWeight: 700, color: cor || C.text }}>{val}</div>{sub && <div style={{ fontSize: 11, color: C.textSub }}>{sub}</div>}</div>;
            return (
            <div style={{ border: `1px solid ${ALR ? ALR[1] : C.border}`, borderRadius: 8, padding: "10px 12px", background: `${ALR ? ALR[1] : C.accent}0d` }}>
              {!resumo.admissao ? <div style={{ fontSize: 12.5, color: C.warn }}>⚠ Sem data de admissão no cadastro — sem ela não dá para calcular saldo e vencimento. Preencha em Colaboradores → Editar.</div> : <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {cel("ADMISSÃO", dBR(resumo.admissao))}
                {cel("PERÍODO A GOZAR", p ? `${dBR(p.inicio).slice(0, 5)}/${p.inicio.slice(2, 4)} a ${dBR(p.fim).slice(0, 5)}/${p.fim.slice(2, 4)}` : "—", p?.situacao === "em_aquisicao" ? "em aquisição" : p ? `direito ${p.direito} dias${p.faltas ? ` · ${p.faltas} falta(s)` : ""}` : null)}
                {cel("SALDO", p ? `${p.situacao === "em_aquisicao" ? p.direito - p.gozado - p.programado : resumo.a_gozar} dias` : "—", p && p.programado ? `${p.programado} já programado(s)` : null, ALR?.[1])}
                {cel("PRAZO PARA GOZAR", p ? `até ${dBR(p.limite)}` : "—", p ? `a partir de ${dBR(new Date(Date.parse(p.fim) + 864e5).toISOString().slice(0, 10))}${p.sair_ate ? ` · sair até ${dBR(p.sair_ate)} p/ ${p.saldo} dias` : ""}` : null, ALR?.[1])}{/* B1.11 */}
              </div>
              {ALR && <div style={{ fontSize: 12, color: ALR[1], fontWeight: 600, marginTop: 6 }}>{ALR[0]}</div>}
              {resumo.faltas_periodo > 5 && <div style={{ fontSize: 12, color: C.warn, marginTop: 4 }}>💡 {resumo.faltas_periodo} faltas injustificadas no período — o direito caiu.</div>}</>}
            </div>); })()}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {campo("Início *", <input type="date" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} style={s.input} />)}{/* B1.12: o fim fica em branco até o gestor preencher — sem soma automática */}
            {campo("Fim (último dia) *", <input type="date" value={form.fim} min={form.inicio || undefined} onChange={(e) => setForm({ ...form, fim: e.target.value })} style={{ ...s.input, ...(fimAntes ? { borderColor: C.danger } : {}) }} />)}
          </div>
          {fimAntes && <div style={{ fontSize: 12.5, color: C.danger, fontWeight: 600 }}>❌ O fim ({dBR(form.fim)}) está antes do início ({dBR(form.inicio)}) — ajuste as datas.</div>}
          {dias != null && <div style={{ fontSize: 12, color: dias > 30 ? C.danger : C.textSub }}>{dias} dia(s) · volta em {dBR(somaDias(form.fim, 1))}{dias > 30 ? " — máximo 30 por período" : ""}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {campo("Período aquisitivo", <div style={{ ...s.input, opacity: 0.85 }}>{analise?.periodo ? `${analise.periodo.rotulo} · direito ${analise.periodo.direito} dias` : "calculado pela admissão"}</div>)}
            {campo("Dias vendidos (abono)", <input type="number" min={0} max={10} value={form.abono_dias || 0} onChange={(e) => setForm({ ...form, abono_dias: e.target.value })} style={s.input} />)}
          </div>
          {campo("Observação", <textarea rows={2} value={form.obs || ""} onChange={(e) => setForm({ ...form, obs: e.target.value })} style={{ ...s.input, resize: "vertical" }} />)}
          {analise?.avisos?.length > 0 && (() => { const cor = analise.bloqueia ? C.danger : analise.avisos.some((a) => a.nivel === "alerta") ? C.warn : C.border; return (
          <div style={{ border: `1px solid ${cor}`, borderRadius: 8, padding: "10px 12px", background: `${analise.bloqueia ? C.danger : analise.avisos.some((a) => a.nivel === "alerta") ? C.warn : C.accent}10` }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>🧠 Analista</div>
            {analise.avisos.map((a, i) => <div key={i} style={{ fontSize: 12.5, color: a.nivel === "erro" ? C.danger : a.nivel === "alerta" ? C.warn : a.nivel === "ok" ? "#22c55e" : C.text, marginTop: 3, fontWeight: a.nivel === "erro" ? 600 : 400 }}>{a.nivel === "erro" ? "❌" : a.nivel === "alerta" ? "⚠" : a.nivel === "ok" ? "✓" : "💡"} {a.texto}</div>)}
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{analise.bloqueia ? "❌ Em desacordo com a legislação — ajuste as datas para salvar." : analise.avisos.some((a) => a.nivel === "alerta") ? "⚠ São lembretes — você pode salvar mesmo assim." : ""}</div>
          </div>); })()}
          {erroForm && <div style={{ color: C.danger, fontSize: 13 }}>⚠ {erroForm}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setForm(null)} disabled={salvando} style={{ ...s.btn(false), cursor: "pointer" }}>Cancelar</button>
            <button onClick={salvar} disabled={salvando || !form.inicio || !form.fim || fimAntes || !!analise?.bloqueia} title={analise?.bloqueia ? "Em desacordo com a legislação — veja o Analista" : undefined} style={{ ...s.btn(true), cursor: analise?.bloqueia || fimAntes ? "not-allowed" : "pointer", opacity: analise?.bloqueia || fimAntes ? 0.45 : 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
          </div>
        </div>
      </>, () => setForm(null), 560)}
    </>
  );
}
