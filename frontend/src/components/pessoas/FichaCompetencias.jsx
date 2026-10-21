// components/pessoas/FichaCompetencias.jsx — etapa 12e.3
// Seção "🧩 Competências" da Ficha do colaborador: escolaridade e CNH (comparadas sozinhas com a função) e a lista
// da função com NOTA de 1 a 4 (12e.3.1 — "atende" = nota ≥ nível esperado da função), data, observação e evidência
// opcional. Treinamentos ligados à competência aparecem como base (🎓 em dia / ⚠ sem o treinamento) e, em dia, viram
// evidência automática na avaliação. Cada avaliação fica no histórico.
import { useState } from "react";
import apiService from "../../services/apiService";

const SIT = { ok: { i: "🟢", l: "Atende", c: "#22c55e" }, pendente: { i: "⚪", l: "Não avaliado", c: "#94a3b8" }, nao_atende: { i: "🟡", l: "Abaixo do esperado", c: "#f59e0b" }, reavaliar: { i: "🟡", l: "Reavaliar", c: "#f59e0b" } };
const NIVEL = { 1: { l: "Não atende", d: "não faz, ou faz com risco", c: "#ef4444" }, 2: { l: "Em desenvolvimento", d: "faz com supervisão", c: "#f59e0b" }, 3: { l: "Atende", d: "faz sozinho, no padrão", c: "#22c55e" }, 4: { l: "Referência", d: "faz muito bem e pode ensinar", c: "#0ea5e9" } };
const TRS = { ok: { i: "🎓", c: "#22c55e", l: "em dia" }, vencido: { i: "🎓", c: "#ef4444", l: "vencido" }, falta: { i: "⚠", c: "#f59e0b", l: "sem o treinamento" } };
const dataBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const lerArquivo = (file) => new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => falha(new Error("Não foi possível ler o arquivo")); r.readAsDataURL(file); });

export default function FichaCompetencias({ C, s, colaboradorId, dados, podeEditar, onMudou, onAviso, onErro, onEditarCadastro }) {
  const [form, setForm] = useState(null); // { codigo, nome, atende, avaliado_em, obs, arquivo }
  const [salvando, setSalvando] = useState(false);
  const [hist, setHist] = useState(null);
  if (!dados || !dados.itens.length) return null;
  const r = dados.resumo;
  const salvar = async () => {
    setSalvando(true);
    try {
      const corpo = { codigo: form.codigo, nivel: form.nivel, avaliado_em: form.avaliado_em, obs: form.obs };
      if (form.arquivo) {
        if (form.arquivo.size > 10 * 1024 * 1024) throw new Error("Arquivo maior que 10 MB");
        corpo.evidencia_base64 = await lerArquivo(form.arquivo); corpo.evidencia_mime = form.arquivo.type; corpo.evidencia_nome = form.arquivo.name;
      }
      await apiService.post(`/pessoas/colaboradores/${colaboradorId}/competencias`, corpo);
      onAviso(`${form.nome}: nota ${form.nivel} (${NIVEL[form.nivel].l}) — ${form.nivel >= form.esperado ? "atende" : "abaixo do esperado"}.`); setForm(null); setHist(null); await onMudou?.();
    } catch (e) { onErro(e.message); }
    finally { setSalvando(false); }
  };
  const verEvidencia = async (id) => { try { const x = await apiService.get(`/pessoas/competencias/${id}/evidencia`); if (x?.url) window.open(x.url, "_blank", "noopener"); } catch (e) { onErro(e.message); } };
  const verHist = async () => { try { setHist((await apiService.get(`/pessoas/colaboradores/${colaboradorId}/competencias`))?.historico || []); } catch (e) { onErro(e.message); } };
  const faltam = r.total - r.ok;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>🧩 Competências
        <span style={{ fontWeight: 400, fontSize: 12, color: C.textSub }}> · {r.ok} de {r.total} atendem{faltam ? <> · <span style={{ color: "#f59e0b" }}>{[r.pendente && `${r.pendente} sem informação/avaliação`, r.nao_atende && `${r.nao_atende} abaixo do esperado`, r.reavaliar && `${r.reavaliar} para reavaliar`].filter(Boolean).join(" · ")}</span></> : ""}</span>
        <button onClick={hist ? () => setHist(null) : verHist} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 11, marginLeft: 8, fontFamily: "inherit" }}>{hist ? "fechar histórico" : "histórico"}</button>
      </div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
        {dados.itens.map((it, i) => {
          const sc = SIT[it.situacao];
          return (
            <div key={it.codigo} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "8px 12px", borderBottom: i < dados.itens.length - 1 ? `1px solid ${C.border}` : "none", fontSize: 12 }}>
              <span>{sc.i}</span>
              <div style={{ flex: "2 1 200px" }}>
                <b>{it.nome}</b>
                <div style={{ color: C.textSub }}>
                  {it.tipo !== "competencia" ? <>exigido: {it.exigido} · tem: {it.atual || <span style={{ color: "#f59e0b" }}>não informado</span>}</>
                    : it.ultima ? <>nota <b style={{ color: NIVEL[it.ultima.nivel]?.c }}>{it.ultima.nivel} · {NIVEL[it.ultima.nivel]?.l}</b> (esperado {it.nivel_esperado}) em {dataBR(it.ultima.avaliado_em)}{it.ultima.avaliado_por_nome ? ` por ${it.ultima.avaliado_por_nome}` : ""}{it.ultima.valido_ate ? ` · reavaliar até ${dataBR(it.ultima.valido_ate)}` : ""}{it.ultima.obs ? ` · “${it.ultima.obs}”` : ""}</>
                    : `ainda não avaliado · esperado: ${it.nivel_esperado} (${NIVEL[it.nivel_esperado]?.l})`}
                  {it.ultima?.tem_evidencia && <button onClick={() => verEvidencia(it.ultima.id)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>📎 evidência</button>}
                </div>
                {(it.treinamentos || []).length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                    {it.treinamentos.map((t) => <span key={t.codigo} style={s.tag(TRS[t.situacao].c)} title={t.valido_ate ? `válido até ${dataBR(t.valido_ate)}` : ""}>{TRS[t.situacao].i} {t.nome} · {TRS[t.situacao].l}</span>)}
                    {!it.ultima && it.treinamentos.every((t) => t.situacao === "ok") && <span style={{ fontSize: 11, color: C.textSub }}>— falta a avaliação prática</span>}
                  </div>
                )}
              </div>
              <span style={s.tag(sc.c)}>{sc.l}</span>
              {podeEditar && it.tipo === "competencia" && <button onClick={() => setForm({ codigo: it.codigo, nome: it.nome, nivel: it.nivel_esperado, esperado: it.nivel_esperado, treinamentos: it.treinamentos || [], avaliado_em: hoje(), obs: "", arquivo: null })} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 10px", fontSize: 11, color: C.text }}>Avaliar</button>}
              {podeEditar && it.tipo !== "competencia" && it.situacao !== "ok" && onEditarCadastro && <button onClick={onEditarCadastro} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 10px", fontSize: 11, color: C.text }}>Preencher</button>}
            </div>
          );
        })}
      </div>
      {form && (
        <div style={{ border: `1px dashed ${C.accent}`, borderRadius: 8, padding: 10, marginTop: 8, fontSize: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Avaliar: {form.nome}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 6, marginBottom: 6 }}>
            {[1, 2, 3, 4].map((n) => (
              <button key={n} onClick={() => setForm({ ...form, nivel: n })} style={{ ...s.btn(form.nivel === n, NIVEL[n].c), cursor: "pointer", padding: "6px 8px", fontSize: 12, textAlign: "left", ...(form.nivel === n ? {} : { color: C.text }) }}>
                <b>{n} · {NIVEL[n].l}</b><div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85 }}>{NIVEL[n].d}</div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: form.nivel >= form.esperado ? "#22c55e" : "#f59e0b", marginBottom: 8 }}>Esperado pela função: {form.esperado} ({NIVEL[form.esperado]?.l}) → {form.nivel >= form.esperado ? "conta como ATENDE" : "fica ABAIXO do esperado (pendência 🟡)"}</div>
          {form.treinamentos.length > 0 && <div style={{ fontSize: 11, color: C.textSub, marginBottom: 8 }}>{form.treinamentos.filter((t) => t.situacao === "ok").length ? <>🎓 Entram como evidência: {form.treinamentos.filter((t) => t.situacao === "ok").map((t) => t.nome).join(", ")}</> : "⚠ Nenhum dos treinamentos ligados está em dia — dá para avaliar mesmo assim (a prática vale), mas considere agendar."}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <input type="date" value={form.avaliado_em} max={hoje()} onChange={(e) => setForm({ ...form, avaliado_em: e.target.value })} style={{ ...s.input, width: 160, padding: "5px 8px", fontSize: 12 }} />
          </div>
          <input value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} placeholder="Observação (como foi avaliado, o que falta…)" style={{ ...s.input, padding: "6px 10px", fontSize: 12, marginBottom: 8 }} />
          <label style={{ display: "block", marginBottom: 8, color: C.textSub }}>Evidência (opcional — PDF ou foto, até 10 MB): <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setForm({ ...form, arquivo: e.target.files?.[0] || null })} /></label>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setForm(null)} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 12px", fontSize: 12, color: C.text }}>Cancelar</button>
            <button disabled={salvando || !form.avaliado_em} onClick={salvar} style={{ ...s.btn(!salvando), padding: "5px 12px", fontSize: 12 }}>{salvando ? "Salvando…" : "Registrar avaliação"}</button>
          </div>
        </div>
      )}
      {hist && ( /* 12f: histórico AGRUPADO por competência, com a evolução das notas (mesmo formato do dossiê) */
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, marginTop: 8, maxHeight: 260, overflowY: "auto" }}>
          {hist.length === 0 && <div style={{ padding: 10, fontSize: 12, color: C.muted }}>Nenhuma avaliação ainda.</div>}
          {[...hist.reduce((m, h) => m.set(h.codigo, [...(m.get(h.codigo) || []), h]), new Map()).values()].map((lista) => {
            const ord = [...lista].sort((a, b) => String(a.avaliado_em).localeCompare(String(b.avaliado_em)) || Number(a.id) - Number(b.id));
            return (
              <div key={ord[0].codigo} style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.textSub }}>
                <div style={{ marginBottom: 4 }}><b style={{ color: C.text, fontSize: 12 }}>{ord[0].nome}</b> · <span style={{ fontWeight: 800, letterSpacing: ".05em" }}>{ord.map((h, k) => <span key={h.id} style={{ color: NIVEL[h.nivel]?.c }}>{k > 0 && <span style={{ color: C.muted }}> → </span>}{h.nivel}</span>)}</span></div>
                {ord.map((h) => (
                  <div key={h.id} style={{ paddingLeft: 10 }}>
                    {dataBR(h.avaliado_em)} · nota {h.nivel} ({NIVEL[h.nivel]?.l}){h.nivel_esperado ? ` / esperado ${h.nivel_esperado}` : ""}{h.avaliado_por_nome ? ` · ${h.avaliado_por_nome}` : ""}{h.obs ? ` · “${h.obs}”` : ""}{(h.evidencia_treinamentos || []).length ? ` · 🎓 ${h.evidencia_treinamentos.map((t) => t.nome).join(", ")}` : ""}
                    {h.tem_evidencia && <button onClick={() => verEvidencia(h.id)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>📎</button>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
