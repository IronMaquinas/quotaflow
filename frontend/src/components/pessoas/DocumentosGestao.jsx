// components/pessoas/DocumentosGestao.jsx — etapa 18zr: 📘 aba GESTÃO do menu 📁 Documentos (sistema da qualidade — ISO 9001 7.5)
//   Manual, políticas, procedimentos, instruções, formulários, registros: código + revisão + situação, elaborado/aprovado,
//   próxima análise crítica, texto editável no sistema e/ou arquivo. Vigente não se exclui (vira Obsoleto — histórico).
//   Próximas etapas: 18zs (fluxo de revisão, histórico de versões, confirmação de leitura) · 18zt (biblioteca de modelos ISO 9001).
import { useEffect, useMemo, useState } from "react";
import apiService from "../../services/apiService";
import VerArquivo from "../programacao/VerArquivo";
import ConfirmarExclusao from "../shared/ConfirmarExclusao";
import { dadosEmpresa } from "../../utils/logoEmpresa";
import { corpoDocGestao, imprimirDocGestao, CSS_DOC_GESTAO } from "../../utils/gerarDocumentoGestao"; // 18zu: logo + rodapé

const ORDEM = ["manual", "politica", "procedimento", "instrucao", "formulario", "registro", "outro"];
const ICONE = { manual: "📕", politica: "🧭", procedimento: "📋", instrucao: "🛠", formulario: "🗒", registro: "🗂", outro: "📄" };
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
// 18zu: prévia do modelo já com os dados da empresa (o servidor faz o mesmo na importação)
const preencherPrevia = (txt) => { const e = dadosEmpresa(); const c = String(e.cnpj || "").replace(/\D/g, ""); return String(txt || "").replace(/\{\{EMPRESA\}\}/g, e.nome || e.razao_social || "[nome da empresa]").replace(/\{\{CNPJ\}\}/g, c.length === 14 ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : "[CNPJ]").replace(/\{\{CIDADE_UF\}\}/g, "[cidade/UF]"); };
const rev = (n) => `Rev. ${String(n ?? 0).padStart(2, "0")}`;
const lerArq = (f) => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok({ base64: String(r.result).split(",")[1], mime: f.type, nome: f.name }); r.onerror = () => erro(new Error("Não consegui ler o arquivo")); r.readAsDataURL(f); });

export default function DocumentosGestao({ C, s, onErro, onAviso }) {
  const [d, setD] = useState(null); const [busca, setBusca] = useState(""); const [verObsoletos, setVerObsoletos] = useState(false);
  const [form, setForm] = useState(null); const [ver, setVer] = useState(null);
  const [revi, setRevi] = useState(null); const [hist, setHist] = useState(null); const [leit, setLeit] = useState(null); const [verVersao, setVerVersao] = useState(null); const [descartar, setDescartar] = useState(false); /* 18zs */ const [bib, setBib] = useState(null); const [buscaBib, setBuscaBib] = useState(""); const [verMod, setVerMod] = useState(null); const [publicar, setPublicar] = useState(false); /* 18zt */ const [arq, setArq] = useState(null); const [apagar, setApagar] = useState(null); const [ocup, setOcup] = useState(false);
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
      const { id, novo_arquivo, arquivo_url, rascunho_arquivo_url, rascunho, motivo_revisao, status_original, tem_conteudo, tem_arquivo, revisar, criado_em, atualizado_em, tenant_id, arquivo_path, arquivo_nome, arquivo_mime, ...corpo } = form;
      if (novo_arquivo) Object.assign(corpo, { arquivo_base64: novo_arquivo.base64, arquivo_mime: novo_arquivo.mime, arquivo_nome: novo_arquivo.nome });
      if (id) await apiService.put(`/pessoas/gestao/${id}`, corpo); else await apiService.post("/pessoas/gestao", corpo);
      setForm(null); onAviso?.(id ? "Documento atualizado." : "Documento cadastrado."); carregar();
    } catch (e) { onErro?.(e?.response?.data?.erro || e.message); } finally { setOcup(false); }
  };
  const abrir = async (x, editarDepois = false) => {
    try { const r = await apiService.get(`/pessoas/gestao/${x.id}`); const doc = r.documento;
      if (editarDepois) setForm({ ...doc, status_original: doc.status, aprovado_em: doc.aprovado_em ? String(doc.aprovado_em).slice(0, 10) : "", proxima_revisao: doc.proxima_revisao ? String(doc.proxima_revisao).slice(0, 10) : "" });
      else { setPublicar(false); setVer({ ...doc, pode_aprovar: r.pode_aprovar }); setHist(null); setLeit(null); if (doc.status === "vigente") apiService.get(`/pessoas/gestao/${x.id}/leituras`).then(setLeit).catch(() => {}); } }
    catch (e) { onErro?.(e.message); }
  };
  // 18zs: ↻ nova revisão (a vigente vale até aprovar) · histórico · leitura
  const abrirRevisao = (doc) => { const r = doc.rascunho || {}; setRevi({ id: doc.id, codigo: doc.codigo, revisao: (doc.revisao || 0) + 1, pode_aprovar: doc.pode_aprovar, titulo: r.titulo ?? doc.titulo, conteudo: r.conteudo ?? doc.conteudo ?? "", motivo: r.motivo || "", elaborado_por: r.elaborado_por || "", proxima_revisao: r.proxima_revisao || "", arquivo_nome: r.arquivo?.arquivo_nome || null, ja: !!doc.rascunho }); setVer(null); };
  const corpoRevi = () => { const { id, codigo, revisao, pode_aprovar, ja, novo_arquivo, arquivo_nome, ...c } = revi; return { ...c, ...(novo_arquivo ? { arquivo_base64: novo_arquivo.base64, arquivo_mime: novo_arquivo.mime, arquivo_nome: novo_arquivo.nome } : {}) }; };
  const salvarRevi = async (aprovar = false) => {
    setOcup(true);
    try { await apiService.put(`/pessoas/gestao/${revi.id}/rascunho`, corpoRevi());
      if (aprovar) { await apiService.post(`/pessoas/gestao/${revi.id}/aprovar`, {}); onAviso?.(`${revi.codigo} Rev. ${String(revi.revisao).padStart(2, "0")} aprovada — a anterior foi para o histórico e as leituras recomeçam.`); }
      else onAviso?.("Revisão salva como rascunho — a versão vigente continua valendo até a aprovação.");
      setRevi(null); carregar(); }
    catch (e) { onErro?.(e?.response?.data?.erro || e.message); } finally { setOcup(false); }
  };
  const lerEntendi = async () => { try { await apiService.post(`/pessoas/gestao/${ver.id}/leitura`, {}); setLeit(await apiService.get(`/pessoas/gestao/${ver.id}/leituras`)); onAviso?.("Leitura confirmada."); } catch (e) { onErro?.(e?.response?.data?.erro || e.message); } };
  const statusTag = (x) => x.status === "vigente" ? (x.revisar ? <span style={s.tag(C.warn)}>Análise crítica vencida</span> : <span style={s.tag(C.success)}>Vigente</span>)
    : x.status === "rascunho" ? <span style={s.tag(C.accent)}>Rascunho</span> : <span style={s.tag(C.muted)}>Obsoleto</span>;
  const travado = !!(form?.id && form?.status_original === "vigente"); // 18zs
  const campo = (rot, el, flex = "1 1 160px") => <label style={{ flex, minWidth: 0 }}><span style={s.label}>{rot}</span>{el}</label>;
  const inp = (k, extra = {}) => <input value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={s.input} {...extra} />;

  if (!d) return <div style={{ color: C.muted }}>Carregando…</div>;
  return <div>
    {d.sem_tabela && <div style={{ ...s.card, padding: 12, marginBottom: 12, borderColor: C.warn, color: C.warn }}>Rode a migration 092 para usar os documentos de gestão.</div>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por código, título ou área…" style={{ ...s.input, maxWidth: 280, padding: "7px 10px", fontSize: 12 }} />
      <label style={{ fontSize: 12, color: C.textSub, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={verObsoletos} onChange={(e) => setVerObsoletos(e.target.checked)} /> Mostrar obsoletos</label>
      <div style={{ flex: 1 }} />
      <button type="button" onClick={async () => { try { setBuscaBib(""); setBib(await apiService.get("/pessoas/gestao/modelos")); } catch (e) { onErro?.(e?.response?.data?.erro || e.message); } }} style={{ ...s.btn(false), cursor: "pointer", color: C.accent }}>📚 Modelos ISO 9001</button>
      {editar && <button type="button" onClick={() => setForm({ codigo: "", titulo: "", tipo: "procedimento", area: "", revisao: 0, status: "vigente", elaborado_por: "", aprovado_por: "", aprovado_em: "", proxima_revisao: "", norma: "", conteudo: "" })} style={{ ...s.btn(true), cursor: "pointer" }}>＋ Novo documento de gestão</button>}
    </div>
    <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Manual da qualidade, políticas, procedimentos, instruções e formulários — com código e revisão (ISO 9001, 7.5). Comece pelos 📚 Modelos ISO 9001: entram como rascunho, você ajusta e aprova.</div>
    {grupos.length === 0 ? <div style={{ ...s.card, padding: 28, textAlign: "center", color: C.textSub }}>{d.documentos.length ? "Nenhum documento com esses filtros." : "Nenhum documento de gestão ainda. Cadastre o manual, os procedimentos e as políticas da empresa."}</div>
      : grupos.map((g) => <div key={g.tipo} style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, letterSpacing: "0.04em", margin: "0 0 6px" }}>{ICONE[g.tipo]} {String(d.tipos[g.tipo]).toUpperCase()}{g.tipo === "manual" ? "" : "S"} · {g.docs.length}</div>
        <div style={{ ...s.card, overflow: "hidden", padding: 0 }}>{g.docs.map((x, i) => <div key={x.id} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "11px 14px", borderBottom: i < g.docs.length - 1 ? `1px solid ${C.border}` : "none", opacity: x.status === "obsoleto" ? 0.6 : 1 }}>
          <div style={{ flex: "2 1 240px", minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}><span style={{ color: C.accent }}>{x.codigo}</span> · {x.titulo}</div>
            <div style={{ fontSize: 11.5, color: C.textSub }}>{rev(x.revisao)}{x.area ? ` · ${x.area}` : ""}{x.aprovado_em ? ` · aprovado em ${dBR(x.aprovado_em)}${x.aprovado_por ? ` por ${x.aprovado_por}` : ""}` : ""}{x.proxima_revisao ? ` · análise crítica até ${dBR(x.proxima_revisao)}` : ""}</div>
          </div>
          {statusTag(x)}{x.em_revisao && <span title={x.rascunho_motivo || ""} style={s.tag(C.accent)}>↻ Rev. {String((x.revisao || 0) + 1).padStart(2, "0")} em elaboração</span>}
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={() => abrir(x)} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.accent }}>👁 Ver</button>
            {editar && <button type="button" onClick={() => abrir(x, true)} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.text }}>Editar</button>}
            {editar && x.status !== "vigente" && <button type="button" onClick={() => setApagar(x)} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.danger }}>Excluir</button>}
          </div>
        </div>)}</div>
      </div>)}

    {ver && <div onClick={() => setVer(null)} style={{ position: "fixed", inset: 0, background: "#000000aa", zIndex: 80, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(820px, 100%)" }}>
        <div style={{ background: "#fff", borderRadius: 6, padding: "26px 32px", overflow: "hidden" }}><style>{CSS_DOC_GESTAO}</style><div dangerouslySetInnerHTML={{ __html: corpoDocGestao(ver) }} /></div>
        {ver.status === "vigente" && leit && <div style={{ ...s.card, background: C.surface, padding: "10px 12px", marginTop: 10, fontSize: 12.5 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ flex: 1 }}>👥 Leitura da {rev(leit.revisao)}: {leit.leituras.length} pessoa(s)</b>
            {leit.eu_li ? <span style={s.tag(C.success)}>✓ Você leu esta revisão</span> : <button type="button" onClick={lerEntendi} style={{ ...s.btn(true), padding: "6px 12px", fontSize: 12.5, cursor: "pointer" }}>✓ Li e entendi</button>}
          </div>
          {leit.leituras.length > 0 && <div style={{ color: C.textSub, marginTop: 4 }}>{leit.leituras.map((l) => `${l.usuario_nome || "—"} (${new Date(l.lido_em).toLocaleDateString("pt-BR")})`).join(" · ")}</div>}
        </div>}
        {hist && <div style={{ ...s.card, background: C.surface, padding: "10px 12px", marginTop: 10, fontSize: 12.5 }}>
          <b>🗂 Histórico de revisões</b>
          {hist.length === 0 ? <div style={{ color: C.muted, marginTop: 4 }}>Esta é a primeira revisão — ainda não há anteriores.</div> : hist.map((v) => <div key={v.id} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "6px 0", borderTop: `1px solid ${C.border}`, marginTop: 4, flexWrap: "wrap" }}>
            <b style={{ width: 62 }}>{rev(v.revisao)}</b>
            <span style={{ flex: 1, color: C.textSub }}>{v.aprovado_em ? `aprovada ${dBR(v.aprovado_em)}${v.aprovado_por ? ` por ${v.aprovado_por}` : ""} · ` : ""}obsoleta desde {dBR(v.vigente_ate)}{v.motivo ? ` · ${v.motivo}` : ""}</span>
            <button type="button" onClick={() => setVerVersao(v)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 12.5 }}>👁 ver</button>
          </div>)}
        </div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10, flexWrap: "wrap" }}>
          {ver.status === "rascunho" && ver.pode_aprovar && !publicar && <button type="button" onClick={() => setPublicar(true)} style={{ ...s.btn(true), cursor: "pointer" }}>✓ Aprovar e publicar ({rev(ver.revisao)})</button>}
          {publicar && <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, color: C.text }}>Publicar como vigente, aprovado por você hoje?
            <button type="button" onClick={() => setPublicar(false)} style={{ ...s.btn(false), padding: "5px 10px", cursor: "pointer", color: C.text }}>Cancelar</button>
            <button type="button" disabled={ocup} onClick={async () => { setOcup(true); try { await apiService.post(`/pessoas/gestao/${ver.id}/publicar`, {}); setPublicar(false); setVer(null); onAviso?.(`${ver.codigo} aprovado e vigente (${rev(ver.revisao)}).`); carregar(); } catch (e) { onErro?.(e?.response?.data?.erro || e.message); } finally { setOcup(false); } }} style={{ ...s.btn(true), padding: "5px 10px", cursor: "pointer" }}>Publicar</button></span>}
          <button type="button" onClick={async () => { try { setHist((await apiService.get(`/pessoas/gestao/${ver.id}/versoes`)).versoes || []); } catch (e) { onErro?.(e?.response?.data?.erro || e.message); } }} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>🗂 Histórico</button>
          {editar && ver.status === "vigente" && <button type="button" onClick={() => abrirRevisao(ver)} style={{ ...s.btn(false), cursor: "pointer", color: C.accent }}>{ver.rascunho ? `✎ Continuar Rev. ${String((ver.revisao || 0) + 1).padStart(2, "0")}` : "↻ Nova revisão"}</button>}
          {ver.arquivo_url && <button type="button" onClick={() => setArq({ url: ver.arquivo_url, nome: ver.arquivo_nome, mime: ver.arquivo_mime })} style={{ ...s.btn(false), cursor: "pointer", color: C.accent }}>📎 Arquivo anexo</button>}
          <button type="button" onClick={() => { try { imprimirDocGestao(ver); } catch (e) { onErro?.(e.message); } }} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>🖨 Imprimir / PDF</button>
          <button type="button" onClick={() => setVer(null)} style={{ ...s.btn(true), cursor: "pointer" }}>Fechar</button>
        </div>
      </div>
    </div>}
    {arq && <VerArquivo C={C} s={s} arquivo={arq} onFechar={() => setArq(null)} z={90} />}

    {bib && <div onClick={() => setBib(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 80, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }}>{/* 18zt */}
      <div onClick={(e) => e.stopPropagation()} role="dialog" style={{ ...s.card, background: C.surface, width: "min(780px, 100%)", padding: 22 }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>📚 Modelos ISO 9001 do QuotaFlow</div>
        <div style={{ fontSize: 12, color: C.textSub, margin: "4px 0 10px" }}>Cada procedimento descreve o fluxo que o próprio QuotaFlow executa — o documento e a prática batem. Entra como <b>rascunho</b> com o nome e o CNPJ da sua empresa; complete os [colchetes], revise e aprove. {bib.aviso}</div>
        <input value={buscaBib} onChange={(e) => setBuscaBib(e.target.value)} placeholder="🔍 Buscar (título, requisito, palavra do texto…)" style={{ ...s.input, marginBottom: 8 }} />
        {bib.modelos.filter((m) => !buscaBib.trim() || `${m.codigo} ${m.titulo} ${m.norma} ${m.conteudo}`.toLowerCase().includes(buscaBib.trim().toLowerCase())).map((m) => <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 260px" }}><div style={{ fontWeight: 600, fontSize: 13 }}>{ICONE[m.tipo]} <span style={{ color: C.accent }}>{m.codigo}</span> · {m.titulo}</div><div style={{ fontSize: 11.5, color: C.muted }}>{m.norma}{m.area ? ` · ${m.area}` : ""}</div></div>
          <button type="button" onClick={() => setVerMod(m)} style={{ ...s.btn(false), cursor: "pointer", color: C.accent, padding: "6px 12px", fontSize: 12.5 }}>👁 Visualizar</button>
          {m.ja_importado ? <span style={s.tag(C.success)}>Importado</span> : editar && <button type="button" disabled={ocup} onClick={async () => { setOcup(true); try { await apiService.post(`/pessoas/gestao/modelos/${m.id}/importar`, m.codigo_ocupado ? { codigo: `${m.codigo}-Q` } : {}); setBib(await apiService.get("/pessoas/gestao/modelos")); setVerMod(null); onAviso?.(`${m.codigo} importado como rascunho — revise e aprove em 👁 Ver.`); carregar(); } catch (e) { onErro?.(e?.response?.data?.erro || e.message); } finally { setOcup(false); } }} style={{ ...s.btn(true), cursor: "pointer", padding: "6px 12px", fontSize: 12.5 }}>Importar{m.codigo_ocupado ? ` como ${m.codigo}-Q` : ""}</button>}
        </div>)}
        <div style={{ textAlign: "right", marginTop: 12 }}><button type="button" onClick={() => setBib(null)} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>Fechar</button></div>
      </div>
    </div>}
    {verMod && <div onClick={() => setVerMod(null)} style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 95, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(820px, 100%)" }}>
        <div style={{ background: "#fff", borderRadius: 6, padding: "26px 32px", overflow: "hidden" }}><style>{CSS_DOC_GESTAO}</style><div dangerouslySetInnerHTML={{ __html: corpoDocGestao({ ...verMod, revisao: 0, status: "rascunho", conteudo: preencherPrevia(verMod.conteudo) }) }} /></div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
          <button type="button" onClick={() => setVerMod(null)} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>Voltar</button>
        </div>
      </div>
    </div>}
    {verVersao && <div onClick={() => setVerVersao(null)} style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 95, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(820px, 100%)" }}>
        <div style={{ background: "#fff", borderRadius: 6, padding: "26px 32px", overflow: "hidden" }}><style>{CSS_DOC_GESTAO}</style><div dangerouslySetInnerHTML={{ __html: corpoDocGestao({ ...verVersao, codigo: ver?.codigo || "", status: "obsoleto" }, { obsoleto: true }) }} /></div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
          {verVersao.arquivo_url && <button type="button" onClick={() => setArq({ url: verVersao.arquivo_url, nome: verVersao.arquivo_nome, mime: verVersao.arquivo_mime })} style={{ ...s.btn(false), cursor: "pointer", color: C.accent }}>📎 Arquivo desta revisão</button>}
          <button type="button" onClick={() => { try { imprimirDocGestao({ ...verVersao, codigo: ver?.codigo || "", status: "obsoleto" }, { obsoleto: true }); } catch (e) { onErro?.(e.message); } }} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>🖨 Imprimir</button>
          <button type="button" onClick={() => setVerVersao(null)} style={{ ...s.btn(true), cursor: "pointer" }}>Fechar</button>
        </div>
      </div>
    </div>}

    {revi && <div onClick={() => !ocup && setRevi(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 80, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" style={{ ...s.card, background: C.surface, width: "min(760px, 100%)", padding: 22 }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>↻ {revi.codigo} — Rev. {String(revi.revisao).padStart(2, "0")} {revi.ja ? "(em elaboração)" : "(nova)"}</div>
        <div style={{ fontSize: 12, color: C.textSub, margin: "4px 0 12px" }}>A revisão vigente continua valendo até esta ser aprovada. Ao aprovar, a anterior vai para o 🗂 histórico como obsoleta e as leituras recomeçam.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label><span style={s.label}>O QUE MUDOU NESTA REVISÃO (OBRIGATÓRIO PARA APROVAR)</span><input value={revi.motivo} onChange={(e) => setRevi({ ...revi, motivo: e.target.value })} placeholder="Ex.: incluída a etapa de quarentena; ajustados os responsáveis" style={s.input} /></label>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={{ flex: "3 1 260px" }}><span style={s.label}>TÍTULO</span><input value={revi.titulo || ""} onChange={(e) => setRevi({ ...revi, titulo: e.target.value })} style={s.input} /></label>
            <label style={{ flex: "1 1 160px" }}><span style={s.label}>ELABORADO POR</span><input value={revi.elaborado_por} onChange={(e) => setRevi({ ...revi, elaborado_por: e.target.value })} style={s.input} /></label>
            <label style={{ flex: "0 1 170px" }}><span style={s.label}>PRÓXIMA ANÁLISE CRÍTICA</span><input type="date" value={revi.proxima_revisao} onChange={(e) => setRevi({ ...revi, proxima_revisao: e.target.value })} style={s.input} /></label>
          </div>
          <label><span style={s.label}>TEXTO</span><textarea value={revi.conteudo} onChange={(e) => setRevi({ ...revi, conteudo: e.target.value })} rows={14} style={{ ...s.input, fontFamily: "inherit", lineHeight: 1.5, resize: "vertical" }} /></label>
          <div style={{ fontSize: 12.5, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: C.textSub }}>Arquivo da nova revisão (opcional):</span><b>{revi.novo_arquivo?.nome || revi.arquivo_nome || <span style={{ color: C.muted, fontWeight: 400 }}>mantém o atual</span>}</b>
            <label style={{ color: C.accent, cursor: "pointer" }}>📎 Anexar<input type="file" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) setRevi({ ...revi, novo_arquivo: await lerArq(f) }); }} /></label>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {revi.ja && <button type="button" disabled={ocup} onClick={() => setDescartar(true)} style={{ ...s.btn(false), cursor: "pointer", color: C.danger }}>Descartar revisão</button>}
          <div style={{ flex: 1 }} />
          <button type="button" disabled={ocup} onClick={() => setRevi(null)} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>Fechar</button>
          <button type="button" disabled={ocup} onClick={() => salvarRevi(false)} style={{ ...s.btn(false), cursor: "pointer", color: C.accent }}>Salvar rascunho</button>
          {revi.pode_aprovar && <button type="button" disabled={ocup || !revi.motivo.trim()} title={revi.motivo.trim() ? "" : "Descreva o que mudou"} onClick={() => salvarRevi(true)} style={{ ...s.btn(true), cursor: "pointer", opacity: revi.motivo.trim() ? 1 : 0.5 }}>{ocup ? "Aprovando…" : "✓ Aprovar revisão"}</button>}
        </div>
      </div>
    </div>}
    {descartar && <ConfirmarExclusao C={C} s={s} titulo="Descartar esta revisão?" texto="O rascunho é apagado; a revisão vigente continua igual." rotulo="Descartar" ocupado={ocup} z={95}
      onCancelar={() => setDescartar(false)} onConfirmar={async () => { setOcup(true); try { await apiService.delete(`/pessoas/gestao/${revi.id}/rascunho`); setDescartar(false); setRevi(null); onAviso?.("Revisão descartada."); carregar(); } catch (e) { onErro?.(e?.response?.data?.erro || e.message); } finally { setOcup(false); } }} />}

    {form && <div onClick={() => !ocup && setForm(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 80, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" style={{ ...s.card, background: C.surface, width: "min(760px, 100%)", padding: 22 }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>{form.id ? `Editar ${form.codigo}` : "Novo documento de gestão"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("CÓDIGO", inp("codigo", { placeholder: "PQ-01" }), "0 1 120px")}
            {campo("TÍTULO", inp("titulo", { placeholder: "Controle de não conformidades", disabled: travado }), "3 1 260px")}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("TIPO", <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={s.input}>{ORDEM.map((t) => <option key={t} value={t}>{d.tipos[t]}</option>)}</select>)}
            {campo("ÁREA / PROCESSO", inp("area", { placeholder: "Qualidade, Operação…" }))}
            {campo("REVISÃO", <input type="number" min={0} disabled={travado} value={form.revisao} onChange={(e) => setForm({ ...form, revisao: e.target.value === "" ? "" : Number(e.target.value) })} style={s.input} />, "0 1 90px")}
            {campo("SITUAÇÃO", <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={s.input}>{Object.entries(d.status).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>, "0 1 130px")}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("ELABORADO POR", inp("elaborado_por"))}{campo("APROVADO POR", inp("aprovado_por"))}
            {campo("APROVADO EM", inp("aprovado_em", { type: "date" }), "0 1 150px")}{campo("PRÓXIMA ANÁLISE CRÍTICA", inp("proxima_revisao", { type: "date" }), "0 1 170px")}
          </div>
          {campo("NORMA / REFERÊNCIA (OPCIONAL)", inp("norma", { placeholder: "ISO 9001:2015 — 10.2" }), "1 1 100%")}
          {campo("TEXTO DO DOCUMENTO", <textarea disabled={travado} value={form.conteudo ?? ""} onChange={(e) => setForm({ ...form, conteudo: e.target.value })} rows={14} style={{ ...s.input, fontFamily: "inherit", lineHeight: 1.5, resize: "vertical" }} placeholder={"1. OBJETIVO\n…\n2. ABRANGÊNCIA\n…\n3. RESPONSABILIDADES\n…"} />, "1 1 100%")}
          {travado && <div style={{ fontSize: 12.5, color: C.warn }}>🔒 Documento vigente: texto, título, revisão e arquivo só mudam por <b>↻ Nova revisão</b> (👁 Ver → Nova revisão). Aqui você altera área, datas, norma e a situação (ex.: Obsoleto).</div>}
          {!travado && <div style={{ fontSize: 12.5, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: C.textSub }}>Arquivo (opcional — PDF, Word, imagem):</span>
            {form.novo_arquivo ? <b>{form.novo_arquivo.nome}</b> : form.arquivo_nome && !form.remover_arquivo ? <b>{form.arquivo_nome}</b> : <span style={{ color: C.muted }}>nenhum</span>}
            <label style={{ color: C.accent, cursor: "pointer" }}>📎 {form.arquivo_nome || form.novo_arquivo ? "Trocar" : "Anexar"}<input type="file" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) setForm({ ...form, novo_arquivo: await lerArq(f), remover_arquivo: false }); }} /></label>
            {(form.novo_arquivo || (form.arquivo_nome && !form.remover_arquivo)) && <button type="button" onClick={() => setForm({ ...form, novo_arquivo: null, remover_arquivo: !!form.arquivo_nome })} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 12.5 }}>✕ tirar</button>}
          </div>}
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
