// components/pessoas/DocumentosGestao.jsx — etapa 18zr: 📘 aba GESTÃO do menu 📁 Documentos (sistema da qualidade — ISO 9001 7.5)
//   Manual, políticas, procedimentos, instruções, formulários, registros: código + revisão + situação, elaborado/aprovado,
//   próxima análise crítica, texto editável no sistema e/ou arquivo. Vigente não se exclui (vira Obsoleto — histórico).
//   Próximas etapas: 18zs (fluxo de revisão, histórico de versões, confirmação de leitura) · 18zt (biblioteca de modelos ISO 9001).
import { useEffect, useMemo, useState } from "react";
import apiService from "../../services/apiService";
import VerArquivo from "../programacao/VerArquivo";
import ConfirmarExclusao from "../shared/ConfirmarExclusao";

const ORDEM = ["manual", "politica", "procedimento", "instrucao", "formulario", "registro", "outro"];
const ICONE = { manual: "📕", politica: "🧭", procedimento: "📋", instrucao: "🛠", formulario: "🗒", registro: "🗂", outro: "📄" };
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const rev = (n) => `Rev. ${String(n ?? 0).padStart(2, "0")}`;
const lerArq = (f) => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok({ base64: String(r.result).split(",")[1], mime: f.type, nome: f.name }); r.onerror = () => erro(new Error("Não consegui ler o arquivo")); r.readAsDataURL(f); });

export default function DocumentosGestao({ C, s, onErro, onAviso }) {
  const [d, setD] = useState(null); const [busca, setBusca] = useState(""); const [verObsoletos, setVerObsoletos] = useState(false);
  const [form, setForm] = useState(null); const [ver, setVer] = useState(null); const [arq, setArq] = useState(null); const [apagar, setApagar] = useState(null); const [ocup, setOcup] = useState(false);
  const carregar = () => apiService.get("/pessoas/gestao").then(setD).catch((e) => onErro?.(e.message));
  useEffect(() => { carregar(); }, []); // eslint-disable-line
  const editar = !!d?.pode_editar;
  const grupos = useMemo(() => {
    if (!d) return []; const b = busca.trim().toLowerCase();
    const l = d.documentos.filter((x) => (verObsoletos || x.status !== "obsoleto") && (!b || `${x.codigo} ${x.titulo} ${x.area || ""}`.toLowerCase().includes(b)));
    return ORDEM.map((t) => ({ tipo: t, docs: l.filter((x) => x.tipo === t) })).filter((g) => g.docs.length);
  }, [d, busca, verObsoletos]);

  const salvar = async () => {
    setOcup(true);
    try {
      const { id, novo_arquivo, arquivo_url, tem_conteudo, tem_arquivo, revisar, criado_em, atualizado_em, tenant_id, arquivo_path, arquivo_nome, arquivo_mime, ...corpo } = form;
      if (novo_arquivo) Object.assign(corpo, { arquivo_base64: novo_arquivo.base64, arquivo_mime: novo_arquivo.mime, arquivo_nome: novo_arquivo.nome });
      if (id) await apiService.put(`/pessoas/gestao/${id}`, corpo); else await apiService.post("/pessoas/gestao", corpo);
      setForm(null); onAviso?.(id ? "Documento atualizado." : "Documento cadastrado."); carregar();
    } catch (e) { onErro?.(e?.response?.data?.erro || e.message); } finally { setOcup(false); }
  };
  const abrir = async (x, editarDepois = false) => {
    try { const r = await apiService.get(`/pessoas/gestao/${x.id}`); const doc = r.documento;
      if (editarDepois) setForm({ ...doc, aprovado_em: doc.aprovado_em ? String(doc.aprovado_em).slice(0, 10) : "", proxima_revisao: doc.proxima_revisao ? String(doc.proxima_revisao).slice(0, 10) : "" }); else setVer(doc); }
    catch (e) { onErro?.(e.message); }
  };
  const statusTag = (x) => x.status === "vigente" ? (x.revisar ? <span style={s.tag(C.warn)}>Análise crítica vencida</span> : <span style={s.tag(C.success)}>Vigente</span>)
    : x.status === "rascunho" ? <span style={s.tag(C.accent)}>Rascunho</span> : <span style={s.tag(C.muted)}>Obsoleto</span>;
  const campo = (rot, el, flex = "1 1 160px") => <label style={{ flex, minWidth: 0 }}><span style={s.label}>{rot}</span>{el}</label>;
  const inp = (k, extra = {}) => <input value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={s.input} {...extra} />;

  if (!d) return <div style={{ color: C.muted }}>Carregando…</div>;
  return <div>
    {d.sem_tabela && <div style={{ ...s.card, padding: 12, marginBottom: 12, borderColor: C.warn, color: C.warn }}>Rode a migration 092 para usar os documentos de gestão.</div>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por código, título ou área…" style={{ ...s.input, maxWidth: 280, padding: "7px 10px", fontSize: 12 }} />
      <label style={{ fontSize: 12, color: C.textSub, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={verObsoletos} onChange={(e) => setVerObsoletos(e.target.checked)} /> Mostrar obsoletos</label>
      <div style={{ flex: 1 }} />
      {editar && <button type="button" onClick={() => setForm({ codigo: "", titulo: "", tipo: "procedimento", area: "", revisao: 0, status: "vigente", elaborado_por: "", aprovado_por: "", aprovado_em: "", proxima_revisao: "", norma: "", conteudo: "" })} style={{ ...s.btn(true), cursor: "pointer" }}>＋ Novo documento de gestão</button>}
    </div>
    <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Manual da qualidade, políticas, procedimentos, instruções e formulários — com código e revisão (ISO 9001, 7.5). Modelos prontos para importar chegam em breve.</div>
    {grupos.length === 0 ? <div style={{ ...s.card, padding: 28, textAlign: "center", color: C.textSub }}>{d.documentos.length ? "Nenhum documento com esses filtros." : "Nenhum documento de gestão ainda. Cadastre o manual, os procedimentos e as políticas da empresa."}</div>
      : grupos.map((g) => <div key={g.tipo} style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, letterSpacing: "0.04em", margin: "0 0 6px" }}>{ICONE[g.tipo]} {String(d.tipos[g.tipo]).toUpperCase()}{g.tipo === "manual" ? "" : "S"} · {g.docs.length}</div>
        <div style={{ ...s.card, overflow: "hidden", padding: 0 }}>{g.docs.map((x, i) => <div key={x.id} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "11px 14px", borderBottom: i < g.docs.length - 1 ? `1px solid ${C.border}` : "none", opacity: x.status === "obsoleto" ? 0.6 : 1 }}>
          <div style={{ flex: "2 1 240px", minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}><span style={{ color: C.accent }}>{x.codigo}</span> · {x.titulo}</div>
            <div style={{ fontSize: 11.5, color: C.textSub }}>{rev(x.revisao)}{x.area ? ` · ${x.area}` : ""}{x.aprovado_em ? ` · aprovado em ${dBR(x.aprovado_em)}${x.aprovado_por ? ` por ${x.aprovado_por}` : ""}` : ""}{x.proxima_revisao ? ` · análise crítica até ${dBR(x.proxima_revisao)}` : ""}</div>
          </div>
          {statusTag(x)}
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={() => abrir(x)} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.accent }}>👁 Ver</button>
            {editar && <button type="button" onClick={() => abrir(x, true)} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.text }}>Editar</button>}
            {editar && x.status !== "vigente" && <button type="button" onClick={() => setApagar(x)} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.danger }}>Excluir</button>}
          </div>
        </div>)}</div>
      </div>)}

    {ver && <div onClick={() => setVer(null)} style={{ position: "fixed", inset: 0, background: "#000000aa", zIndex: 80, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(820px, 100%)" }}>
        <div style={{ background: "#fff", color: "#111", borderRadius: 6, padding: "28px 34px", fontFamily: "Arial, Helvetica, sans-serif", fontSize: 13.5, lineHeight: 1.6 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 18, fontSize: 12 }}><tbody>
            <tr><td rowSpan={2} style={{ border: "1px solid #999", padding: 8, fontWeight: 700, fontSize: 15 }}>{ver.titulo}</td><td style={{ border: "1px solid #999", padding: 6, width: 130 }}>Código: <b>{ver.codigo}</b></td></tr>
            <tr><td style={{ border: "1px solid #999", padding: 6 }}>{rev(ver.revisao)} · {STATUS_TXT[ver.status]}</td></tr>
            <tr><td colSpan={2} style={{ border: "1px solid #999", padding: 6 }}>Elaborado: {ver.elaborado_por || "—"} · Aprovado: {ver.aprovado_por || "—"} em {dBR(ver.aprovado_em)}{ver.norma ? ` · Referência: ${ver.norma}` : ""}</td></tr>
          </tbody></table>
          {ver.conteudo ? <div style={{ whiteSpace: "pre-wrap" }}>{ver.conteudo}</div> : <div style={{ color: "#666" }}>Sem texto no sistema{ver.arquivo_url ? " — veja o arquivo anexo." : "."}</div>}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
          {ver.arquivo_url && <button type="button" onClick={() => setArq({ url: ver.arquivo_url, nome: ver.arquivo_nome, mime: ver.arquivo_mime })} style={{ ...s.btn(false), cursor: "pointer", color: C.accent }}>📎 Arquivo anexo</button>}
          <button type="button" onClick={() => window.print()} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>🖨 Imprimir</button>
          <button type="button" onClick={() => setVer(null)} style={{ ...s.btn(true), cursor: "pointer" }}>Fechar</button>
        </div>
      </div>
    </div>}
    {arq && <VerArquivo C={C} s={s} arquivo={arq} onFechar={() => setArq(null)} z={90} />}

    {form && <div onClick={() => !ocup && setForm(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 80, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" style={{ ...s.card, background: C.surface, width: "min(760px, 100%)", padding: 22 }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>{form.id ? `Editar ${form.codigo}` : "Novo documento de gestão"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("CÓDIGO", inp("codigo", { placeholder: "PQ-01" }), "0 1 120px")}
            {campo("TÍTULO", inp("titulo", { placeholder: "Controle de não conformidades" }), "3 1 260px")}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("TIPO", <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={s.input}>{ORDEM.map((t) => <option key={t} value={t}>{d.tipos[t]}</option>)}</select>)}
            {campo("ÁREA / PROCESSO", inp("area", { placeholder: "Qualidade, Operação…" }))}
            {campo("REVISÃO", <input type="number" min={0} value={form.revisao} onChange={(e) => setForm({ ...form, revisao: e.target.value === "" ? "" : Number(e.target.value) })} style={s.input} />, "0 1 90px")}
            {campo("SITUAÇÃO", <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={s.input}>{Object.entries(d.status).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>, "0 1 130px")}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("ELABORADO POR", inp("elaborado_por"))}{campo("APROVADO POR", inp("aprovado_por"))}
            {campo("APROVADO EM", inp("aprovado_em", { type: "date" }), "0 1 150px")}{campo("PRÓXIMA ANÁLISE CRÍTICA", inp("proxima_revisao", { type: "date" }), "0 1 170px")}
          </div>
          {campo("NORMA / REFERÊNCIA (OPCIONAL)", inp("norma", { placeholder: "ISO 9001:2015 — 10.2" }), "1 1 100%")}
          {campo("TEXTO DO DOCUMENTO", <textarea value={form.conteudo ?? ""} onChange={(e) => setForm({ ...form, conteudo: e.target.value })} rows={14} style={{ ...s.input, fontFamily: "inherit", lineHeight: 1.5, resize: "vertical" }} placeholder={"1. OBJETIVO\n…\n2. ABRANGÊNCIA\n…\n3. RESPONSABILIDADES\n…"} />, "1 1 100%")}
          <div style={{ fontSize: 12.5, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: C.textSub }}>Arquivo (opcional — PDF, Word, imagem):</span>
            {form.novo_arquivo ? <b>{form.novo_arquivo.nome}</b> : form.arquivo_nome && !form.remover_arquivo ? <b>{form.arquivo_nome}</b> : <span style={{ color: C.muted }}>nenhum</span>}
            <label style={{ color: C.accent, cursor: "pointer" }}>📎 {form.arquivo_nome || form.novo_arquivo ? "Trocar" : "Anexar"}<input type="file" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) setForm({ ...form, novo_arquivo: await lerArq(f), remover_arquivo: false }); }} /></label>
            {(form.novo_arquivo || (form.arquivo_nome && !form.remover_arquivo)) && <button type="button" onClick={() => setForm({ ...form, novo_arquivo: null, remover_arquivo: !!form.arquivo_nome })} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 12.5 }}>✕ tirar</button>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" disabled={ocup} onClick={() => setForm(null)} style={{ ...s.btn(false), flex: 1, cursor: "pointer", color: C.text }}>Cancelar</button>
          <button type="button" disabled={ocup} onClick={salvar} style={{ ...s.btn(true), flex: 1, cursor: "pointer" }}>{ocup ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
    </div>}
    {apagar && <ConfirmarExclusao C={C} s={s} titulo={`Excluir ${apagar.codigo}?`} texto={`${apagar.titulo} — ${apagar.status === "rascunho" ? "rascunho" : "obsoleto"}. Não dá para desfazer.`} ocupado={ocup} z={90}
      onCancelar={() => setApagar(null)} onConfirmar={async () => { setOcup(true); try { await apiService.delete(`/pessoas/gestao/${apagar.id}`); setApagar(null); onAviso?.("Documento excluído."); carregar(); } catch (e) { onErro?.(e?.response?.data?.erro || e.message); } finally { setOcup(false); } }} />}
  </div>;
}
const STATUS_TXT = { rascunho: "Rascunho", vigente: "Vigente", obsoleto: "Obsoleto" };
