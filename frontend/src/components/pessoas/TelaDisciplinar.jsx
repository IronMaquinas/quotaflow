// components/pessoas/TelaDisciplinar.jsx — etapa 12h
// Aba "⚖ Disciplinar" de Pessoas (só admin, gestor e qualidade — LGPD). Medidas em escala: orientação → advertência
// escrita → suspensão → justa causa (registro). O sistema SUGERE a próxima pelo histórico; quem decide é o gestor.
// Ciência: o colaborador assina na tela; se recusar, 2 testemunhas (nome + CPF — 12h.2) assinam. Orientação pode ser só verbal (registrada).
// 12h.1: "⏳ Colher depois" — preenche no escritório, salva e colhe a ciência quando apresentar (na tela, recusa +
//   testemunhas ou "assinou no papel" com o anexo); 🖨 "para assinar" sai com as linhas em branco. Pendente não conta
//   na progressão até ser colhida.
// ⚠️ Os textos são modelos — a empresa deve validar com o jurídico.
import { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";
import AssinaturaTela from "../shared/AssinaturaTela";
import { abrirMedida, prepararJanela } from "../../utils/gerarMedidaDisciplinar";
import { prepararArquivo } from "../../utils/comprimirImagem"; // 14c.1: foto comprimida antes de enviar

const COR = { orientacao: "#3b82f6", advertencia: "#f59e0b", suspensao: "#ef4444", justa_causa: "#7f1d1d" };
const dataBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const mascCPF = (v) => { const d = String(v || "").replace(/\D/g, "").slice(0, 11); return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2"); };
const lerArquivo = (file) => new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => falha(new Error("Não foi possível ler o arquivo")); r.readAsDataURL(file); });

export default function TelaDisciplinar({ C, s, modal, campo, colabs = [], onAviso, onErro }) {
  const [d, setD] = useState(null);
  const [semMigration, setSemMigration] = useState(false);
  const [filtro, setFiltro] = useState("vigentes");
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState(null);
  const [sug, setSug] = useState(null);
  const [previa, setPrevia] = useState("");
  const [multasColab, setMultasColab] = useState([]);
  const [ver, setVer] = useState(null);
  const [cancelar, setCancelar] = useState(null);
  const [colher, setColher] = useState(null); // 12h.1: { medida, ciencia, ciencia_png, testemunhas, data_aplicacao, arquivo }
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try { setD(await apiService.get("/pessoas/disciplinar")); setSemMigration(false); }
    catch (e) { if (/037/.test(e.message || "")) setSemMigration(true); else onErro(e.message); }
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line

  // ao escolher o colaborador: sugestão da próxima medida e as multas dele (para ligar)
  useEffect(() => {
    if (!form?.colaborador_id) { setSug(null); setMultasColab([]); return; }
    apiService.get(`/pessoas/disciplinar/sugestao/${form.colaborador_id}`).then((r) => { setSug(r); setForm((f) => (f && !f.tipo_escolhido ? { ...f, tipo: r.sugestao.tipo } : f)); }).catch(() => setSug(null));
    apiService.get("/pessoas/multas").then((r) => setMultasColab((r?.multas || []).filter((m) => String(m.colaborador_id) === String(form.colaborador_id)))).catch(() => setMultasColab([]));
  }, [form?.colaborador_id]); // eslint-disable-line
  useEffect(() => { // prévia do texto
    if (!form) return;
    const t = setTimeout(async () => { try { setPrevia((await apiService.post("/pessoas/disciplinar/previa", form))?.texto || ""); } catch { /* ok */ } }, 350);
    return () => clearTimeout(t);
  }, [form?.colaborador_id, form?.tipo, form?.data_fato, form?.descricao, form?.dias_suspensao, form?.suspensao_inicio]); // eslint-disable-line

  const medidas = d?.medidas || [];
  const ativos = colabs.filter((c) => c.situacao !== "desligado");
  const resumo = useMemo(() => {
    const d12 = medidas.filter((m) => m.status === "vigente" && String(m.data_aplicacao) >= new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10));
    const c = (t) => d12.filter((m) => m.tipo === t).length;
    return { orientacao: c("orientacao"), advertencia: c("advertencia"), suspensao: c("suspensao"), pessoas: new Set(d12.map((m) => String(m.colaborador_id))).size,
      pendentes: medidas.filter((m) => m.status === "vigente" && m.ciencia === "pendente").length };
  }, [medidas]);
  const b = semAcento(busca.trim());
  const lista = medidas.filter((m) => (filtro === "todas" || (filtro === "vigentes" ? m.status === "vigente" : m.status === "cancelada"))
    && (!b || semAcento(`${m.colaborador_nome} ${m.descricao} ${m.categoria_nome} ${m.tipo_nome}`).includes(b)));

  const nova = (colabId = "") => { setPrevia(""); setForm({ colaborador_id: colabId ? String(colabId) : "", tipo: "orientacao", tipo_escolhido: false, categoria: "", data_fato: "", data_aplicacao: hoje(), descricao: "", dias_suspensao: 1, suspensao_inicio: "", multa_id: "", ciencia: "pendente", ciencia_png: null, testemunhas: [{ nome: "", cpf: "", png: null }, { nome: "", cpf: "", png: null }], arquivo: null }); };
  const salvar = async () => {
    setSalvando(true);
    try {
      const f = form;
      const corpo = { colaborador_id: f.colaborador_id, tipo: f.tipo, categoria: f.categoria, data_fato: f.data_fato, data_aplicacao: f.data_aplicacao, descricao: f.descricao,
        dias_suspensao: f.tipo === "suspensao" ? f.dias_suspensao : null, suspensao_inicio: f.tipo === "suspensao" ? f.suspensao_inicio : null, multa_id: f.multa_id || null,
        ciencia: f.ciencia, ciencia_png: f.ciencia === "assinada" ? f.ciencia_png : null, testemunhas: f.ciencia === "recusa" ? f.testemunhas : [] };
      if (f.ciencia === "papel" && !f.arquivo) throw new Error("Anexe o documento assinado no papel");
      if (f.arquivo) { if (f.arquivo.size > 10 * 1024 * 1024) throw new Error("Arquivo maior que 10 MB"); corpo.arquivo_base64 = await lerArquivo(f.arquivo); corpo.arquivo_mime = f.arquivo.type; corpo.arquivo_nome = f.arquivo.name; }
      const r = await apiService.post("/pessoas/disciplinar", corpo);
      setForm(null); onAviso(r.medida.ciencia === "pendente" ? `${r.medida.tipo_nome} salva — aguardando a ciência de ${r.medida.colaborador_nome} (🖨 imprima para assinar ou colha na tela).` : `${r.medida.tipo_nome} registrada para ${r.medida.colaborador_nome}.`); await carregar();
    } catch (e) { onErro(e.message); }
    finally { setSalvando(false); }
  };
  const imprimir = async (m) => { const j = prepararJanela(); try { abrirMedida(await apiService.get(`/pessoas/disciplinar/${m.id}/documento`), j); } catch (e) { try { j?.close(); } catch { /* ok */ } onErro(e.message); } };
  const verAnexo = async (m) => { try { const r = await apiService.get(`/pessoas/disciplinar/${m.id}/arquivo`); if (r?.url) window.open(r.url, "_blank", "noopener"); } catch (e) { onErro(e.message); } };

  if (semMigration) return <div style={{ ...s.card, padding: 24, color: C.textSub }}>Rode a migration <b>037_disciplinar.sql</b> no Supabase para usar as medidas disciplinares.</div>;
  if (!d) return <div style={{ color: C.muted }}>Carregando…</div>;
  const tipoNome = (c) => d.tipos.find((t) => t.codigo === c)?.nome || c;

  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {[["Orientações (12 m)", resumo.orientacao, COR.orientacao], ["Advertências (12 m)", resumo.advertencia, COR.advertencia], ["Suspensões (12 m)", resumo.suspensao, COR.suspensao], ["Colaboradores com medida (12 m)", resumo.pessoas, C.textSub], ["⏳ Aguardando ciência", resumo.pendentes, "#f59e0b"]].map(([l, n, cor]) => (
          <div key={l} style={{ ...s.card, padding: "10px 16px" }}><div style={{ fontSize: 22, fontWeight: 700, color: cor }}>{n}</div><div style={{ fontSize: 11, color: C.textSub }}>{l}</div></div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        {[["vigentes", "Vigentes"], ["canceladas", "Canceladas"], ["todas", "Todas"]].map(([k, l]) => <button key={k} onClick={() => setFiltro(k)} style={{ ...s.btn(filtro === k), cursor: "pointer", padding: "6px 14px", fontSize: 12, ...(filtro !== k ? { color: C.text } : {}) }}>{l}</button>)}
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Colaborador, motivo…" style={{ ...s.input, maxWidth: 260, padding: "7px 10px", fontSize: 12 }} />
        <div style={{ flex: 1 }} />
        <button onClick={() => nova()} style={{ ...s.btn(true), cursor: "pointer" }}>＋ Registrar medida</button>
      </div>
      <div style={{ fontSize: 12, color: C.textSub, marginBottom: 10 }}>Visível só para admin, gestor e qualidade (LGPD). O sistema sugere a próxima medida pelo histórico; quem decide é você. Os textos são modelos — valide com o jurídico.</div>
      {lista.length === 0 ? <div style={{ ...s.card, padding: 24, textAlign: "center", color: C.textSub }}>{medidas.length ? "Nada neste filtro." : "Nenhuma medida registrada."}</div> : (
        <div style={{ ...s.card, overflow: "hidden" }}>
          {lista.map((m, i) => (
            <div key={m.id} onClick={() => setVer(m)} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", borderBottom: i < lista.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer", opacity: m.status === "cancelada" ? 0.5 : 1 }}>
              <div style={{ flex: "0 0 80px", fontSize: 12, fontWeight: 600 }}>{dataBR(m.data_aplicacao)}</div>
              <span style={s.tag(COR[m.tipo])}>{d.tipos.find((t) => t.codigo === m.tipo)?.curto}{m.tipo === "suspensao" ? ` ${m.dias_suspensao} d` : ""}</span>
              <div style={{ flex: "2 1 240px" }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{m.colaborador_nome}</div>
                <div style={{ fontSize: 12, color: C.textSub }}>{m.categoria_nome} · {m.descricao.length > 90 ? `${m.descricao.slice(0, 90)}…` : m.descricao}</div>
              </div>
              {m.ciencia === "pendente" ? <span style={s.tag("#f59e0b")}>⏳ aguardando ciência</span>
                : <span style={{ fontSize: 11, color: C.textSub }}>{m.ciencia === "assinada" ? "✍ ciente" : m.ciencia === "recusa" ? "👥 recusa + testemunhas" : m.ciencia === "papel" ? "📄 assinou no papel" : "🗣 verbal"}</span>}
              {m.status === "cancelada" && <span style={s.tag(C.muted)}>Cancelada</span>}
            </div>
          ))}
        </div>
      )}

      {/* ─── detalhe ─── */}
      {/* ─── 12h.1: colher a ciência de uma medida pendente ─── */}
      {colher && modal(<>
        <div style={{ fontSize: 17, fontWeight: 700 }}>✍ Ciência — {colher.medida.colaborador_nome}</div>
        <div style={{ fontSize: 12, color: C.textSub, margin: "4px 0 10px" }}>{tipoNome(colher.medida.tipo)} · fato em {dataBR(colher.medida.data_fato)}</div>
        <div style={{ fontSize: 12, padding: 10, border: `1px solid ${C.border}`, borderRadius: 8, lineHeight: 1.5, textAlign: "justify", marginBottom: 10 }}>{colher.medida.texto}</div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, marginBottom: 10 }}>
          {[["assinada", "✍ Assina na tela"], ["recusa", "👥 Recusou — 2 testemunhas"], ["papel", "📄 Assinou no papel (anexar)"], ...(colher.medida.tipo === "orientacao" ? [["verbal", "🗣 Só verbal"]] : [])].map(([k, l]) => (
            <label key={k} style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}><input type="radio" checked={colher.ciencia === k} onChange={() => setColher({ ...colher, ciencia: k })} />{l}</label>
          ))}
        </div>
        {campo("DATA DA CIÊNCIA (VIRA A DATA DE APLICAÇÃO)", <input type="date" value={colher.data_aplicacao} max={hoje()} min={String(colher.medida.data_fato).slice(0, 10)} onChange={(e) => setColher({ ...colher, data_aplicacao: e.target.value })} style={{ ...s.input, maxWidth: 200 }} />)}
        <div style={{ marginTop: 10 }}>
          {colher.ciencia === "assinada" && <AssinaturaTela C={C} s={s} onChange={(png) => setColher((c) => ({ ...c, ciencia_png: png }))} />}
          {colher.ciencia === "recusa" && colher.testemunhas.map((t, i) => (
            <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <input value={t.nome} onChange={(e) => setColher((c) => ({ ...c, testemunhas: c.testemunhas.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)) }))} placeholder={`Nome da testemunha ${i + 1}`} style={{ ...s.input, flex: "2 1 220px" }} />
                <input value={t.cpf || ""} onChange={(e) => setColher((c) => ({ ...c, testemunhas: c.testemunhas.map((x, k) => (k === i ? { ...x, cpf: mascCPF(e.target.value) } : x)) }))} placeholder="CPF da testemunha" inputMode="numeric" style={{ ...s.input, flex: "1 1 160px" }} />
              </div>
              <AssinaturaTela C={C} s={s} onChange={(png) => setColher((c) => ({ ...c, testemunhas: c.testemunhas.map((x, k) => (k === i ? { ...x, png } : x)) }))} />
            </div>
          ))}
          {colher.ciencia === "papel" && campo("DOCUMENTO ASSINADO (FOTO OU PDF, ATÉ 10 MB)", <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={async (e) => { const arq = await prepararArquivo(e.target.files?.[0]); setColher((v0) => ({ ...v0, arquivo: arq })); }} style={{ ...s.input, padding: 7 }} />)}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={() => setColher(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Voltar</button>
          {(() => {
            const c = colher;
            const ok = !salvando && c.data_aplicacao && (c.ciencia !== "assinada" || c.ciencia_png) && (c.ciencia !== "recusa" || c.testemunhas.every((t) => t.nome.trim() && String(t.cpf || "").replace(/\D/g, "").length === 11 && t.png)) && (c.ciencia !== "papel" || c.arquivo);
            return <button disabled={!ok} onClick={async () => {
              setSalvando(true);
              try {
                const corpo = { ciencia: c.ciencia, data_aplicacao: c.data_aplicacao, ciencia_png: c.ciencia === "assinada" ? c.ciencia_png : null, testemunhas: c.ciencia === "recusa" ? c.testemunhas : [] };
                if (c.ciencia === "papel") { if (c.arquivo.size > 10 * 1024 * 1024) throw new Error("Arquivo maior que 10 MB"); corpo.arquivo_base64 = await lerArquivo(c.arquivo); corpo.arquivo_mime = c.arquivo.type; corpo.arquivo_nome = c.arquivo.name; }
                const r = await apiService.post(`/pessoas/disciplinar/${c.medida.id}/ciencia`, corpo);
                setColher(null); setVer(r.medida); onAviso("Ciência registrada."); await carregar();
              } catch (e) { onErro(e.message); }
              finally { setSalvando(false); }
            }} style={{ ...s.btn(!!ok), flex: 2 }}>{salvando ? "Registrando…" : "Registrar ciência"}</button>;
          })()}
        </div>
      </>, () => !salvando && setColher(null), 640)}

      {ver && !cancelar && !colher && modal(<>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>⚖ {tipoNome(ver.tipo)}</div>
          {ver.status === "cancelada" && <span style={s.tag(C.muted)}>Cancelada</span>}
        </div>
        <div style={{ fontSize: 12, color: C.textSub, margin: "4px 0 12px" }}>{ver.colaborador_nome} · {ver.categoria_nome} · fato em {dataBR(ver.data_fato)} · aplicada em {dataBR(ver.data_aplicacao)}{ver.aplicado_por_nome ? ` por ${ver.aplicado_por_nome}` : ""}{ver.tipo === "suspensao" ? ` · ${ver.dias_suspensao} dia(s): ${dataBR(ver.suspensao_inicio)} a ${dataBR(ver.suspensao_fim)}` : ""}</div>
        <div style={{ fontSize: 12, padding: 10, border: `1px solid ${C.border}`, borderRadius: 8, lineHeight: 1.5, textAlign: "justify" }}>{ver.texto}</div>
        <div style={{ fontSize: 12, color: ver.ciencia === "pendente" ? "#f59e0b" : C.textSub, marginTop: 8 }}>{ver.ciencia === "pendente" ? "⏳ Aguardando a ciência do colaborador — ainda não conta na progressão." : ver.ciencia === "papel" ? `📄 Assinou no papel em ${new Date(ver.ciencia_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} (documento anexo)` : ver.ciencia === "assinada" ? `✍ Ciência assinada em ${new Date(ver.ciencia_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : ver.ciencia === "recusa" ? `👥 Recusou-se a assinar — testemunhas: ${ver.testemunhas.map((t) => `${t.nome}${t.cpf ? ` (CPF ${mascCPF(t.cpf)})` : ""}`).join(" e ")}` : "🗣 Orientação verbal (registrada)"}</div>
        {ver.status === "cancelada" && <div style={{ fontSize: 12, color: C.danger, marginTop: 6 }}>Cancelada: {ver.cancelamento_motivo}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {ver.status === "vigente" && ver.ciencia === "pendente" && <button onClick={() => setColher({ medida: ver, ciencia: "assinada", ciencia_png: null, testemunhas: [{ nome: "", cpf: "", png: null }, { nome: "", cpf: "", png: null }], data_aplicacao: hoje(), arquivo: null })} style={{ ...s.btn(true, "#f59e0b"), cursor: "pointer" }}>✍ Colher ciência</button>}
          <button onClick={() => imprimir(ver)} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>🖨 {ver.ciencia === "pendente" ? "Imprimir para assinar" : "Documento"}</button>
          {ver.tem_arquivo && <button onClick={() => verAnexo(ver)} style={{ ...s.btn(false), cursor: "pointer", color: C.accent }}>📎 Anexo</button>}
          {ver.status === "vigente" && <button onClick={() => setCancelar({ medida: ver, motivo: "" })} style={{ ...s.btn(false), cursor: "pointer", color: C.danger }}>Cancelar medida</button>}
          <div style={{ flex: 1 }} />
          <button onClick={() => setVer(null)} style={{ ...s.btn(true), cursor: "pointer", minWidth: 120 }}>Fechar</button>
        </div>
      </>, () => setVer(null), 640)}

      {cancelar && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.danger }}>⚠ Cancelar medida</div>
        <div style={{ fontSize: 13, color: C.textSub, margin: "10px 0" }}>A medida deixa de contar na progressão, mas fica no histórico (com o motivo).</div>
        <input value={cancelar.motivo} onChange={(e) => setCancelar({ ...cancelar, motivo: e.target.value })} placeholder="Motivo (aplicada por engano, revista após defesa…)" style={s.input} />
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={() => setCancelar(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Voltar</button>
          <button disabled={!cancelar.motivo.trim()} onClick={async () => { try { await apiService.post(`/pessoas/disciplinar/${cancelar.medida.id}/cancelar`, { motivo: cancelar.motivo }); setCancelar(null); setVer(null); onAviso("Medida cancelada."); await carregar(); } catch (e) { onErro(e.message); } }} style={{ ...s.btn(!!cancelar.motivo.trim(), C.danger), flex: 1 }}>Cancelar medida</button>
        </div>
      </>, () => setCancelar(null), 480)}

      {/* ─── registrar ─── */}
      {form && modal(<>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>⚖ Registrar medida disciplinar</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {campo("COLABORADOR", <select value={form.colaborador_id} onChange={(e) => setForm({ ...form, colaborador_id: e.target.value, tipo_escolhido: false, multa_id: "" })} style={s.input}>
            <option value="">Escolha…</option>{ativos.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.funcao_nome || c.funcao ? ` · ${c.funcao_nome || c.funcao}` : ""}</option>)}</select>)}
          {sug && <div style={{ fontSize: 12, padding: "8px 10px", border: `1px solid ${COR[sug.sugestao.tipo]}66`, borderRadius: 8, background: `${COR[sug.sugestao.tipo]}12` }}>
            💡 <b>Sugestão: {tipoNome(sug.sugestao.tipo)}</b> — {sug.sugestao.motivo}.{sug.total_12m ? ` Nos últimos 12 meses: ${sug.por_tipo_12m.orientacao} orientação(ões), ${sug.por_tipo_12m.advertencia} advertência(s), ${sug.por_tipo_12m.suspensao} suspensão(ões).` : ""}
          </div>}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("MEDIDA", <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value, tipo_escolhido: true, ciencia: e.target.value !== "orientacao" && form.ciencia === "verbal" ? "assinada" : form.ciencia })} style={s.input}>
              {d.tipos.map((t) => <option key={t.codigo} value={t.codigo}>{t.nome}</option>)}</select>, "2 1 220px")}
            {campo("MOTIVO", <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} style={s.input}>
              <option value="">Escolha…</option>{d.categorias.map((c) => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}</select>, "2 1 200px")}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("DATA DO FATO", <input type="date" value={form.data_fato} max={hoje()} onChange={(e) => setForm({ ...form, data_fato: e.target.value })} style={s.input} />, "1 1 150px")}
            {campo("APLICADA EM", <input type="date" value={form.data_aplicacao} max={hoje()} min={form.data_fato || undefined} onChange={(e) => setForm({ ...form, data_aplicacao: e.target.value })} style={s.input} />, "1 1 150px")}
            {form.tipo === "suspensao" && campo("DIAS (1–30)", <input type="number" min={1} max={30} value={form.dias_suspensao} onChange={(e) => setForm({ ...form, dias_suspensao: e.target.value })} style={s.input} />, "0 1 100px")}
            {form.tipo === "suspensao" && campo("INÍCIO DA SUSPENSÃO", <input type="date" value={form.suspensao_inicio} onChange={(e) => setForm({ ...form, suspensao_inicio: e.target.value })} style={s.input} />, "1 1 150px")}
          </div>
          {campo("O QUE ACONTECEU (FATO — O QUÊ, ONDE, COMO)", <textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex.: na oficina, às 14h, operando o esmeril sem óculos de proteção, já orientado em 12/09." style={{ ...s.input, resize: "vertical" }} />)}
          {form.categoria === "direcao" && multasColab.length > 0 && campo("MULTA LIGADA (OPCIONAL)", <select value={form.multa_id} onChange={(e) => setForm({ ...form, multa_id: e.target.value })} style={s.input}>
            <option value="">Nenhuma</option>{multasColab.map((m) => <option key={m.id} value={m.id}>{dataBR(m.data_infracao)} · {m.infracao_descricao || m.infracao_codigo || "infração"} · {m.veiculo}</option>)}</select>)}
          {previa && <div><span style={s.label}>TEXTO DO DOCUMENTO (MODELO)</span><div style={{ fontSize: 12, padding: 10, border: `1px solid ${C.border}`, borderRadius: 8, lineHeight: 1.5, textAlign: "justify" }}>{previa}</div></div>}
          <div>
            <span style={s.label}>CIÊNCIA DO COLABORADOR</span>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}>
              {[["pendente", "⏳ Colher depois"], ["assinada", "✍ Assina na tela"], ["recusa", "👥 Recusou — 2 testemunhas"], ["papel", "📄 Assinou no papel (anexar)"], ...(form.tipo === "orientacao" ? [["verbal", "🗣 Só verbal (registrada)"]] : [])].map(([k, l]) => (
                <label key={k} style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}><input type="radio" checked={form.ciencia === k} onChange={() => setForm({ ...form, ciencia: k })} />{l}</label>
              ))}
            </div>
          </div>
          {form.ciencia === "pendente" && <div style={{ fontSize: 12, color: C.textSub }}>A medida fica salva como <b style={{ color: "#f59e0b" }}>⏳ aguardando ciência</b>. Quando apresentar ao colaborador: abra a medida → ✍ Colher ciência (ou 🖨 imprima para assinar no papel e anexe depois). Só passa a contar na progressão depois da ciência.</div>}
          {form.ciencia === "papel" && <div style={{ fontSize: 12, color: C.textSub }}>Anexe abaixo o documento assinado (foto ou PDF).</div>}
          {form.ciencia === "assinada" && <AssinaturaTela C={C} s={s} onChange={(png) => setForm((f) => ({ ...f, ciencia_png: png }))} />}
          {form.ciencia === "recusa" && form.testemunhas.map((t, i) => (
            <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 10 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <input value={t.nome} onChange={(e) => setForm((f) => ({ ...f, testemunhas: f.testemunhas.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)) }))} placeholder={`Nome da testemunha ${i + 1}`} style={{ ...s.input, flex: "2 1 220px" }} />
                <input value={t.cpf || ""} onChange={(e) => setForm((f) => ({ ...f, testemunhas: f.testemunhas.map((x, k) => (k === i ? { ...x, cpf: mascCPF(e.target.value) } : x)) }))} placeholder="CPF da testemunha" inputMode="numeric" style={{ ...s.input, flex: "1 1 160px" }} />
              </div>
              <AssinaturaTela C={C} s={s} onChange={(png) => setForm((f) => ({ ...f, testemunhas: f.testemunhas.map((x, k) => (k === i ? { ...x, png } : x)) }))} />
            </div>
          ))}
          {campo("ANEXO (OPCIONAL — FOTO, RELATÓRIO, PDF ATÉ 10 MB)", <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={async (e) => { const arq = await prepararArquivo(e.target.files?.[0]); setForm((v0) => ({ ...v0, arquivo: arq })); }} style={{ ...s.input, padding: 7 }} />)}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={() => setForm(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          {(() => {
            const f = form;
            const ok = !salvando && f.colaborador_id && f.categoria && f.data_fato && f.descricao.trim().length >= 10 && (f.tipo !== "suspensao" || (f.dias_suspensao >= 1 && f.suspensao_inicio))
              && (f.ciencia !== "assinada" || f.ciencia_png) && (f.ciencia !== "recusa" || f.testemunhas.every((t) => t.nome.trim() && String(t.cpf || "").replace(/\D/g, "").length === 11 && t.png)) && (f.ciencia !== "papel" || f.arquivo);
            return <button disabled={!ok} onClick={salvar} style={{ ...s.btn(!!ok, COR[f.tipo]), flex: 2 }}>{salvando ? "Registrando…" : f.ciencia === "pendente" ? "💾 Salvar (colher ciência depois)" : "Registrar"}</button>;
          })()}
        </div>
      </>, () => !salvando && setForm(null), 680)}
    </>
  );
}
