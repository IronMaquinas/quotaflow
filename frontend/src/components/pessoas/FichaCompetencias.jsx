// components/pessoas/FichaCompetencias.jsx — etapa 12e.3
// Seção "🧩 Competências" da Ficha do colaborador: escolaridade e CNH (comparadas sozinhas com a função) e a lista
// da função com "✓ Atende / ✗ Não atende" (data, observação, evidência opcional). Cada avaliação fica no histórico.
import { useState } from "react";
import apiService from "../../services/apiService";

const SIT = { ok: { i: "🟢", l: "Atende", c: "#22c55e" }, pendente: { i: "⚪", l: "Não avaliado", c: "#94a3b8" }, nao_atende: { i: "🟡", l: "Não atende", c: "#f59e0b" }, reavaliar: { i: "🟡", l: "Reavaliar", c: "#f59e0b" } };
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
      const corpo = { codigo: form.codigo, atende: form.atende, avaliado_em: form.avaliado_em, obs: form.obs };
      if (form.arquivo) {
        if (form.arquivo.size > 10 * 1024 * 1024) throw new Error("Arquivo maior que 10 MB");
        corpo.evidencia_base64 = await lerArquivo(form.arquivo); corpo.evidencia_mime = form.arquivo.type; corpo.evidencia_nome = form.arquivo.name;
      }
      await apiService.post(`/pessoas/colaboradores/${colaboradorId}/competencias`, corpo);
      onAviso(`${form.nome}: ${form.atende ? "atende" : "não atende"} — registrado.`); setForm(null); setHist(null); await onMudou?.();
    } catch (e) { onErro(e.message); }
    finally { setSalvando(false); }
  };
  const verEvidencia = async (id) => { try { const x = await apiService.get(`/pessoas/competencias/${id}/evidencia`); if (x?.url) window.open(x.url, "_blank", "noopener"); } catch (e) { onErro(e.message); } };
  const verHist = async () => { try { setHist((await apiService.get(`/pessoas/colaboradores/${colaboradorId}/competencias`))?.historico || []); } catch (e) { onErro(e.message); } };
  const faltam = r.total - r.ok;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>🧩 Competências
        <span style={{ fontWeight: 400, fontSize: 12, color: C.textSub }}> · {r.ok} de {r.total} atendem{faltam ? <> · <span style={{ color: "#f59e0b" }}>{[r.pendente && `${r.pendente} sem informação/avaliação`, r.nao_atende && `${r.nao_atende} não atende(m)`, r.reavaliar && `${r.reavaliar} para reavaliar`].filter(Boolean).join(" · ")}</span></> : ""}</span>
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
                    : it.ultima ? <>{it.ultima.atende ? "atende" : "não atende"} em {dataBR(it.ultima.avaliado_em)}{it.ultima.avaliado_por_nome ? ` por ${it.ultima.avaliado_por_nome}` : ""}{it.ultima.valido_ate ? ` · reavaliar até ${dataBR(it.ultima.valido_ate)}` : ""}{it.ultima.obs ? ` · “${it.ultima.obs}”` : ""}</>
                    : "ainda não avaliado"}
                  {it.ultima?.tem_evidencia && <button onClick={() => verEvidencia(it.ultima.id)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>📎 evidência</button>}
                </div>
              </div>
              <span style={s.tag(sc.c)}>{sc.l}</span>
              {podeEditar && it.tipo === "competencia" && <button onClick={() => setForm({ codigo: it.codigo, nome: it.nome, atende: true, avaliado_em: hoje(), obs: "", arquivo: null })} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 10px", fontSize: 11, color: C.text }}>Avaliar</button>}
              {podeEditar && it.tipo !== "competencia" && it.situacao !== "ok" && onEditarCadastro && <button onClick={onEditarCadastro} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 10px", fontSize: 11, color: C.text }}>Preencher</button>}
            </div>
          );
        })}
      </div>
      {form && (
        <div style={{ border: `1px dashed ${C.accent}`, borderRadius: 8, padding: 10, marginTop: 8, fontSize: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Avaliar: {form.nome}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <button onClick={() => setForm({ ...form, atende: true })} style={{ ...s.btn(form.atende, "#22c55e"), cursor: "pointer", padding: "6px 14px", fontSize: 12 }}>✓ Atende</button>
            <button onClick={() => setForm({ ...form, atende: false })} style={{ ...s.btn(!form.atende, "#f59e0b"), cursor: "pointer", padding: "6px 14px", fontSize: 12 }}>✗ Não atende</button>
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
      {hist && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, marginTop: 8, maxHeight: 200, overflowY: "auto" }}>
          {hist.length === 0 && <div style={{ padding: 10, fontSize: 12, color: C.muted }}>Nenhuma avaliação ainda.</div>}
          {hist.map((h) => (
            <div key={h.id} style={{ padding: "6px 12px", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.textSub }}>
              {dataBR(h.avaliado_em)} · <b style={{ color: C.text }}>{h.nome}</b> · {h.atende ? "atende" : "não atende"}{h.avaliado_por_nome ? ` · ${h.avaliado_por_nome}` : ""}{h.obs ? ` · “${h.obs}”` : ""}
              {h.tem_evidencia && <button onClick={() => verEvidencia(h.id)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>📎</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
