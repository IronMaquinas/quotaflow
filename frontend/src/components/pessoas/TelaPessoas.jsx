// components/pessoas/TelaPessoas.jsx — etapa 12c
// Módulo "👷 Pessoas": abas Colaboradores · Documentos (pessoa, equipamento e empresa,
// com vencimento e arquivo anexo) · EPI e Treinamentos (em breve — 12d/12e).
// Confirmações sempre no modal do app (nunca window.confirm/alert).
import { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";

const ALVO = { colaborador: "Pessoa", equipamento: "Equipamento", empresa: "Empresa" };
const SITUACAO_DOC = {
  vencido:        { l: "Vencido",        c: "#ef4444" },
  vence_30:       { l: "Vence em 30 dias", c: "#f59e0b" },
  ok:             { l: "Em dia",         c: "#22c55e" },
  sem_vencimento: { l: "Sem vencimento", c: "#64748b" },
};
const SITUACAO_COLAB = { ativo: "Ativo", afastado: "Afastado", desligado: "Desligado" };
const dataBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const somaMeses = (iso, meses) => {
  const [y, m, d] = iso.split("-").map(Number);
  const alvo = new Date(Date.UTC(y, m - 1 + Number(meses), 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
};
const lerArquivo = (file) => new Promise((ok, falha) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(",")[1] || "");
  r.onerror = () => falha(new Error("Não foi possível ler o arquivo"));
  r.readAsDataURL(file);
});

export default function TelaPessoas({ C, s, equipamentos = [], abaInicial, onAbaConsumida }) {
  const [aba, setAba] = useState(abaInicial || "documentos");
  const [config, setConfig] = useState({ tipos: [], usuarios: [], pode_editar: false });
  const [colabs, setColabs] = useState([]);
  const [docs, setDocs] = useState([]);
  const [resumo, setResumo] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [filtroAlvo, setFiltroAlvo] = useState("");
  const [filtroSit, setFiltroSit] = useState("");
  const [filtroColab, setFiltroColab] = useState("");
  const [busca, setBusca] = useState("");
  const [historico, setHistorico] = useState(false);
  const [formColab, setFormColab] = useState(null);
  const [formDoc, setFormDoc] = useState(null); // { modo: 'novo' | 'editar' | 'renovar', ...campos }
  const [novoTipo, setNovoTipo] = useState(null);
  const [confirmar, setConfirmar] = useState(null); // { titulo, texto, acao }
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (abaInicial) { setAba(abaInicial); onAbaConsumida?.(); } }, [abaInicial]); // eslint-disable-line
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(""), 4500); return () => clearTimeout(t); }, [aviso]);

  const carregar = async () => {
    setCarregando(true); setErro("");
    try {
      const [cfg, c, d] = await Promise.all([
        apiService.get("/pessoas/config"),
        apiService.get("/pessoas/colaboradores"),
        apiService.get("/pessoas/documentos", historico ? { historico: "1" } : {}),
      ]);
      setConfig(cfg || {}); setColabs(c?.colaboradores || []); setDocs(d?.documentos || []); setResumo(d?.resumo || {});
    } catch (e) { setErro(e.message || "Erro ao carregar"); }
    finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); }, [historico]); // eslint-disable-line

  const editar = !!config.pode_editar;
  const tiposPorAlvo = (alvo) => (config.tipos || []).filter((t) => t.alvo === alvo);
  const nomeUsuario = (id) => (config.usuarios || []).find((u) => String(u.id) === String(id))?.nome;

  const docsFiltrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return docs.filter((d) => (!filtroAlvo || d.alvo_tipo === filtroAlvo) && (!filtroSit || d.situacao === filtroSit)
      && (!filtroColab || String(d.colaborador_id) === filtroColab)
      && (!b || `${d.alvo_nome} ${d.tipo_nome} ${d.numero || ""}`.toLowerCase().includes(b)));
  }, [docs, filtroAlvo, filtroSit, filtroColab, busca]);

  // ─── ações ────────────────────────────────────────────────────────────
  const salvarColab = async () => {
    setSalvando(true); setErro("");
    try {
      const { id, documentos, vencidos, a_vencer, criado_em, atualizado_em, tenant_id, ...corpo } = formColab;
      if (id) await apiService.put(`/pessoas/colaboradores/${id}`, corpo); else await apiService.post("/pessoas/colaboradores", corpo);
      setFormColab(null); setAviso(id ? "Colaborador atualizado." : "Colaborador cadastrado."); await carregar();
    } catch (e) { setErro(e.message); }
    finally { setSalvando(false); }
  };

  const salvarDoc = async () => {
    setSalvando(true); setErro("");
    try {
      const f = formDoc;
      const corpo = { numero: f.numero, emitido_em: f.emitido_em || null, vence_em: f.vence_em || null, responsavel_id: f.responsavel_id || null, obs: f.obs };
      if (f.arquivo) {
        if (f.arquivo.size > 10 * 1024 * 1024) throw new Error("Arquivo maior que 10 MB");
        corpo.arquivo_base64 = await lerArquivo(f.arquivo); corpo.arquivo_mime = f.arquivo.type; corpo.arquivo_nome = f.arquivo.name;
      }
      if (f.modo === "novo") {
        await apiService.post("/pessoas/documentos", { ...corpo, alvo_tipo: f.alvo_tipo, colaborador_id: f.colaborador_id || null, equipamento_id: f.equipamento_id || null, tipo_id: f.tipo_id });
      } else if (f.modo === "renovar") {
        await apiService.post(`/pessoas/documentos/${f.id}/renovar`, corpo);
      } else {
        await apiService.put(`/pessoas/documentos/${f.id}`, corpo);
      }
      setFormDoc(null); setAviso(f.modo === "renovar" ? "Documento renovado — o anterior ficou no histórico." : "Documento salvo."); await carregar();
    } catch (e) { setErro(e.message); }
    finally { setSalvando(false); }
  };

  const abrirArquivo = async (d) => {
    try { const r = await apiService.get(`/pessoas/documentos/${d.id}/arquivo`); if (r?.url) window.open(r.url, "_blank", "noopener"); }
    catch (e) { setErro(e.message); }
  };

  const salvarNovoTipo = async () => {
    try {
      const t = await apiService.post("/pessoas/documento-tipos", novoTipo);
      setNovoTipo(null); await carregar();
      setFormDoc((f) => (f ? { ...f, tipo_id: String(t.id) } : f));
    } catch (e) { setErro(e.message); }
  };

  const excluir = (titulo, texto, acao) => setConfirmar({ titulo, texto, acao });
  const executarConfirmar = async () => {
    const c = confirmar; setConfirmar(null);
    try { const msg = await c.acao(); setAviso(msg || "Feito."); await carregar(); } catch (e) { setErro(e.message); }
  };

  // sugere o vencimento pela validade padrão do tipo quando a emissão é preenchida
  const sugerirVencimento = (f, emitido, tipoId) => {
    const tipo = (config.tipos || []).find((t) => String(t.id) === String(tipoId ?? f.tipo_id));
    if (emitido && tipo?.validade_meses_padrao && !f.vence_em_manual) return somaMeses(emitido, tipo.validade_meses_padrao);
    return f.vence_em;
  };

  // ─── visual ───────────────────────────────────────────────────────────
  const tab = (id, l, em_breve) => (
    <button key={id} onClick={() => !em_breve && setAba(id)} disabled={em_breve}
      style={{ background: "none", border: "none", borderBottom: `2px solid ${aba === id ? C.accent : "transparent"}`, color: em_breve ? C.muted : aba === id ? C.text : C.textSub,
        padding: "10px 4px", marginRight: 22, fontSize: 14, fontWeight: aba === id ? 700 : 500, cursor: em_breve ? "default" : "pointer", fontFamily: "inherit" }}>
      {l}{em_breve && <span style={{ fontSize: 10, marginLeft: 6, color: C.muted }}>em breve</span>}
    </button>
  );
  const campo = (rotulo, el, larg) => (
    <label style={{ display: "block", minWidth: 0, ...(larg ? { flex: larg } : {}) }}><span style={s.label}>{rotulo}</span>{el}</label>
  );
  const sel = { ...s.input, width: "auto", minWidth: 150, padding: "7px 10px", fontSize: 12 };
  const modal = (conteudo, fechar, largura = 600) => (
    <div onClick={() => !salvando && fechar()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 70, overflowY: "auto", padding: "40px 16px" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ ...s.card, width: `min(${largura}px, 100%)`, padding: 24, background: C.surface }}>{conteudo}</div>
    </div>
  );
  const situacaoTag = (d) => {
    const cfg = SITUACAO_DOC[d.situacao] || SITUACAO_DOC.ok;
    const extra = d.situacao === "vencido" ? ` há ${-d.dias} d` : d.situacao === "vence_30" ? (d.dias === 0 ? " — hoje" : ` — ${d.dias} d`) : "";
    return <span style={s.tag(cfg.c)}>{cfg.l}{extra}</span>;
  };

  return (
    <div style={{ padding: "20px 24px" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>👷 Pessoas e documentos</h2>
      <div style={{ fontSize: 12, color: C.textSub, marginBottom: 12 }}>Colaboradores (com ou sem login no sistema) e documentos com vencimento de pessoas, equipamentos e da empresa.</div>
      <div style={{ borderBottom: `1px solid ${C.border}`, marginBottom: 18 }}>
        {tab("documentos", "📄 Documentos")}{tab("colaboradores", "👥 Colaboradores")}{tab("epi", "🦺 EPI", true)}{tab("treinamentos", "🎓 Treinamentos", true)}
      </div>

      {aviso && <div style={{ ...s.card, padding: 12, marginBottom: 12, borderColor: C.success, color: C.success }}>✓ {aviso}</div>}
      {erro && <div style={{ ...s.card, padding: 12, marginBottom: 12, borderColor: C.danger, color: C.danger }}>⚠ {erro}</div>}
      {carregando && <div style={{ color: C.muted, marginBottom: 12 }}>Carregando…</div>}

      {/* ─── DOCUMENTOS ─── */}
      {aba === "documentos" && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {["vencido", "vence_30", "ok"].map((k) => (
              <button key={k} onClick={() => setFiltroSit(filtroSit === k ? "" : k)}
                style={{ ...s.card, padding: "10px 16px", cursor: "pointer", borderColor: filtroSit === k ? SITUACAO_DOC[k].c : C.border, background: filtroSit === k ? `${SITUACAO_DOC[k].c}18` : C.surface, textAlign: "left", fontFamily: "inherit", color: C.text }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: SITUACAO_DOC[k].c }}>{resumo[k] || 0}</div>
                <div style={{ fontSize: 11, color: C.textSub }}>{SITUACAO_DOC[k].l}</div>
              </button>
            ))}
            <div style={{ flex: 1 }} />
            {editar && <button onClick={() => setFormDoc({ modo: "novo", alvo_tipo: "colaborador", colaborador_id: filtroColab || "", equipamento_id: "", tipo_id: "", numero: "", emitido_em: "", vence_em: "", responsavel_id: "", obs: "", arquivo: null })}
              style={{ ...s.btn(true), cursor: "pointer", alignSelf: "center" }}>＋ Novo documento</button>}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, tipo ou número…" style={{ ...s.input, maxWidth: 280, padding: "7px 10px", fontSize: 12 }} />
            <select value={filtroAlvo} onChange={(e) => setFiltroAlvo(e.target.value)} style={sel}>
              <option value="">Pessoas, equipamentos e empresa</option>
              {Object.entries(ALVO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select value={filtroColab} onChange={(e) => setFiltroColab(e.target.value)} style={sel}>
              <option value="">Todos os colaboradores</option>
              {colabs.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <label style={{ fontSize: 12, color: C.textSub, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={historico} onChange={(e) => setHistorico(e.target.checked)} /> Mostrar renovados (histórico)
            </label>
          </div>

          {docsFiltrados.length === 0 && !carregando ? (
            <div style={{ ...s.card, padding: 28, textAlign: "center", color: C.textSub }}>
              {docs.length === 0 ? <>Nenhum documento ainda. Cadastre CNH, CRLV, alvará… e o sistema avisa antes de vencer.</> : "Nenhum documento com esses filtros."}
            </div>
          ) : (
            <div style={{ ...s.card, overflow: "hidden" }}>
              {docsFiltrados.map((d, i) => (
                <div key={d.id} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "12px 16px", borderBottom: i < docsFiltrados.length - 1 ? `1px solid ${C.border}` : "none", opacity: d.substituido_por || d.colaborador_desligado ? 0.55 : 1 }}>
                  <div style={{ flex: "2 1 220px", minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{d.tipo_nome}{d.numero ? <span style={{ color: C.muted, fontWeight: 400 }}> · nº {d.numero}</span> : ""}</div>
                    <div style={{ fontSize: 12, color: C.textSub }}>
                      {d.alvo_tipo === "colaborador" ? "👤" : d.alvo_tipo === "equipamento" ? "⚙" : "🏢"} {d.alvo_nome}
                      {d.colaborador_desligado ? " (desligado)" : ""}{d.responsavel_id ? ` · resp.: ${nomeUsuario(d.responsavel_id) || "—"}` : ""}
                    </div>
                  </div>
                  <div style={{ flex: "1 1 140px", fontSize: 12, color: C.textSub }}>
                    {d.emitido_em ? <>Emitido {dataBR(d.emitido_em)}<br /></> : null}Vence <b style={{ color: C.text }}>{d.vence_em ? dataBR(d.vence_em) : "—"}</b>
                  </div>
                  <div style={{ flex: "0 0 auto" }}>{d.substituido_por ? <span style={s.tag(C.muted)}>Renovado</span> : situacaoTag(d)}</div>
                  <div style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
                    {d.tem_arquivo && <button onClick={() => abrirArquivo(d)} title={d.arquivo_nome || "Abrir arquivo"} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.accent }}>📎 Abrir</button>}
                    {editar && !d.substituido_por && <button onClick={() => setFormDoc({ modo: "renovar", id: d.id, titulo: `${d.tipo_nome} — ${d.alvo_nome}`, tipo_id: d.tipo_id, numero: "", emitido_em: "", vence_em: "", responsavel_id: d.responsavel_id || "", obs: "", arquivo: null })}
                      style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.success }}>↻ Renovar</button>}
                    {editar && <button onClick={() => setFormDoc({ modo: "editar", id: d.id, titulo: `${d.tipo_nome} — ${d.alvo_nome}`, tipo_id: d.tipo_id, numero: d.numero || "", emitido_em: d.emitido_em ? String(d.emitido_em).slice(0, 10) : "", vence_em: d.vence_em ? String(d.vence_em).slice(0, 10) : "", vence_em_manual: true, responsavel_id: d.responsavel_id || "", obs: d.obs || "", arquivo: null, arquivo_atual: d.arquivo_nome })}
                      style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.text }}>Editar</button>}
                    {editar && <button onClick={() => excluir("Excluir documento", `Excluir ${d.tipo_nome} de ${d.alvo_nome}? O arquivo anexo também é apagado. Use só para cadastro errado — para documento novo, use “Renovar”.`, async () => { await apiService.delete(`/pessoas/documentos/${d.id}`); return "Documento excluído."; })}
                      style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.danger }}>Excluir</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── COLABORADORES ─── */}
      {aba === "colaboradores" && (
        <>
          <div style={{ display: "flex", marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: C.textSub, alignSelf: "center" }}>Motoristas, ajudantes, mecânicos… não precisam ter login. Quem tem pode ser ligado ao usuário.</div>
            <div style={{ flex: 1 }} />
            {editar && <button onClick={() => setFormColab({ nome: "", cpf: "", funcao: "", admissao: "", situacao: "ativo", telefone: "", email: "", usuario_id: "", obs: "" })} style={{ ...s.btn(true), cursor: "pointer" }}>＋ Novo colaborador</button>}
          </div>
          {colabs.length === 0 && !carregando ? (
            <div style={{ ...s.card, padding: 28, textAlign: "center", color: C.textSub }}>Nenhum colaborador cadastrado.</div>
          ) : (
            <div style={{ ...s.card, overflow: "hidden" }}>
              {colabs.map((c, i) => (
                <div key={c.id} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "12px 16px", borderBottom: i < colabs.length - 1 ? `1px solid ${C.border}` : "none", opacity: c.situacao === "desligado" ? 0.55 : 1 }}>
                  <div style={{ flex: "2 1 220px" }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nome} {c.situacao !== "ativo" && <span style={s.tag(C.muted)}>{SITUACAO_COLAB[c.situacao]}</span>}</div>
                    <div style={{ fontSize: 12, color: C.textSub }}>{c.funcao || "Sem função"}{c.cpf ? ` · CPF ${c.cpf}` : ""}{c.usuario_id ? ` · login: ${nomeUsuario(c.usuario_id) || "—"}` : ""}</div>
                  </div>
                  <button onClick={() => { setFiltroColab(String(c.id)); setFiltroAlvo(""); setFiltroSit(""); setAba("documentos"); }}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: C.textSub, fontFamily: "inherit", flex: "1 1 160px", textAlign: "left" }}>
                    📄 {c.documentos} documento(s)
                    {c.vencidos > 0 && <span style={{ color: SITUACAO_DOC.vencido.c }}> · {c.vencidos} vencido(s)</span>}
                    {c.a_vencer > 0 && <span style={{ color: SITUACAO_DOC.vence_30.c }}> · {c.a_vencer} a vencer</span>}
                  </button>
                  {editar && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setFormColab({ ...c, cpf: c.cpf || "", admissao: c.admissao ? String(c.admissao).slice(0, 10) : "", usuario_id: c.usuario_id || "", telefone: c.telefone || "", email: c.email || "", funcao: c.funcao || "", obs: c.obs || "" })}
                        style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.text }}>Editar</button>
                      <button onClick={() => excluir("Excluir colaborador", `Excluir ${c.nome}? Só é possível se não houver documentos — com documentos, marque como “Desligado” para guardar o histórico.`, async () => { await apiService.delete(`/pessoas/colaboradores/${c.id}`); return "Colaborador excluído."; })}
                        style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.danger }}>Excluir</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── modal colaborador ─── */}
      {formColab && modal(<>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>{formColab.id ? "Editar colaborador" : "Novo colaborador"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {campo("NOME", <input value={formColab.nome} onChange={(e) => setFormColab({ ...formColab, nome: e.target.value })} style={s.input} />)}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("CPF (OPCIONAL)", <input value={formColab.cpf} onChange={(e) => setFormColab({ ...formColab, cpf: e.target.value })} placeholder="000.000.000-00" style={s.input} />, "1 1 180px")}
            {campo("FUNÇÃO", <input value={formColab.funcao} onChange={(e) => setFormColab({ ...formColab, funcao: e.target.value })} placeholder="Motorista, mecânico…" style={s.input} />, "1 1 180px")}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("ADMISSÃO", <input type="date" value={formColab.admissao} onChange={(e) => setFormColab({ ...formColab, admissao: e.target.value })} style={s.input} />, "1 1 160px")}
            {campo("SITUAÇÃO", <select value={formColab.situacao} onChange={(e) => setFormColab({ ...formColab, situacao: e.target.value })} style={s.input}>
              {Object.entries(SITUACAO_COLAB).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>, "1 1 160px")}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("TELEFONE", <input value={formColab.telefone} onChange={(e) => setFormColab({ ...formColab, telefone: e.target.value })} style={s.input} />, "1 1 160px")}
            {campo("E-MAIL", <input value={formColab.email} onChange={(e) => setFormColab({ ...formColab, email: e.target.value })} style={s.input} />, "1 1 200px")}
          </div>
          {campo("LOGIN NO SISTEMA (OPCIONAL)", <select value={formColab.usuario_id} onChange={(e) => setFormColab({ ...formColab, usuario_id: e.target.value })} style={s.input}>
            <option value="">Não tem login</option>{(config.usuarios || []).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select>)}
          {campo("OBSERVAÇÕES", <textarea rows={2} value={formColab.obs} onChange={(e) => setFormColab({ ...formColab, obs: e.target.value })} style={{ ...s.input, resize: "vertical" }} />)}
          <div style={{ fontSize: 11, color: C.muted }}>CPF é dado pessoal (LGPD): só admin, gestor e qualidade veem completo.</div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={() => setFormColab(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          <button onClick={salvarColab} disabled={salvando || !formColab.nome.trim()} style={{ ...s.btn(!salvando && !!formColab.nome.trim()), flex: 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </>, () => setFormColab(null), 560)}

      {/* ─── modal documento (novo / editar / renovar) ─── */}
      {formDoc && modal(<>
        <div style={{ fontSize: 17, fontWeight: 700 }}>{formDoc.modo === "novo" ? "Novo documento" : formDoc.modo === "renovar" ? "↻ Renovar documento" : "Editar documento"}</div>
        {formDoc.titulo && <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>{formDoc.titulo}{formDoc.modo === "renovar" ? " — cadastre os dados do documento novo; o atual fica no histórico." : ""}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          {formDoc.modo === "novo" && <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {campo("DE QUEM É", <select value={formDoc.alvo_tipo} onChange={(e) => setFormDoc({ ...formDoc, alvo_tipo: e.target.value, tipo_id: "", colaborador_id: "", equipamento_id: "" })} style={s.input}>
                {Object.entries(ALVO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>, "1 1 150px")}
              {formDoc.alvo_tipo === "colaborador" && campo("COLABORADOR", <select value={formDoc.colaborador_id} onChange={(e) => setFormDoc({ ...formDoc, colaborador_id: e.target.value })} style={s.input}>
                <option value="">Escolha…</option>{colabs.filter((c) => c.situacao !== "desligado").map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>, "2 1 220px")}
              {formDoc.alvo_tipo === "equipamento" && campo("EQUIPAMENTO", <select value={formDoc.equipamento_id} onChange={(e) => setFormDoc({ ...formDoc, equipamento_id: e.target.value })} style={s.input}>
                <option value="">Escolha…</option>{[...equipamentos].sort((a, b) => String(a.tag || a.nome).localeCompare(String(b.tag || b.nome))).map((e) => <option key={e.id} value={e.id}>{e.tag ? `${e.tag} - ` : ""}{e.nome}</option>)}</select>, "2 1 220px")}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              {campo("TIPO DE DOCUMENTO", <select value={formDoc.tipo_id} onChange={(e) => setFormDoc({ ...formDoc, tipo_id: e.target.value, vence_em: sugerirVencimento(formDoc, formDoc.emitido_em, e.target.value) })} style={s.input}>
                <option value="">Escolha…</option>{tiposPorAlvo(formDoc.alvo_tipo).map((t) => <option key={t.id} value={t.id}>{t.nome}{t.validade_meses_padrao ? ` (validade ${t.validade_meses_padrao} meses)` : ""}</option>)}</select>, "1 1 auto")}
              <button onClick={() => setNovoTipo({ alvo: formDoc.alvo_tipo, nome: "", validade_meses_padrao: "" })} style={{ ...s.btn(false), cursor: "pointer", padding: "9px 12px", fontSize: 12, color: C.accent, whiteSpace: "nowrap" }}>＋ Outro tipo</button>
            </div>
          </>}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("NÚMERO (OPCIONAL)", <input value={formDoc.numero} onChange={(e) => setFormDoc({ ...formDoc, numero: e.target.value })} style={s.input} />, "1 1 160px")}
            {campo("EMITIDO EM", <input type="date" value={formDoc.emitido_em} onChange={(e) => setFormDoc({ ...formDoc, emitido_em: e.target.value, vence_em: sugerirVencimento(formDoc, e.target.value) })} style={s.input} />, "1 1 150px")}
            {campo("VENCE EM", <input type="date" value={formDoc.vence_em} min={formDoc.emitido_em || undefined} onChange={(e) => setFormDoc({ ...formDoc, vence_em: e.target.value, vence_em_manual: true })} style={s.input} />, "1 1 150px")}
          </div>
          {formDoc.emitido_em && formDoc.vence_em && formDoc.vence_em < formDoc.emitido_em && <div style={{ fontSize: 12, color: C.danger }}>O vencimento não pode ser antes da emissão.</div>}
          {campo("RESPONSÁVEL POR RENOVAR (RECEBE O AVISO)", <select value={formDoc.responsavel_id} onChange={(e) => setFormDoc({ ...formDoc, responsavel_id: e.target.value })} style={s.input}>
            <option value="">Ninguém específico (avisa admin e gestor)</option>{(config.usuarios || []).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select>)}
          {campo(formDoc.arquivo_atual ? `ARQUIVO (ATUAL: ${formDoc.arquivo_atual} — ESCOLHA OUTRO PARA TROCAR)` : "ARQUIVO (PDF OU FOTO, ATÉ 10 MB)",
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFormDoc({ ...formDoc, arquivo: e.target.files?.[0] || null })} style={{ ...s.input, padding: 7 }} />)}
          {campo("OBSERVAÇÕES", <textarea rows={2} value={formDoc.obs} onChange={(e) => setFormDoc({ ...formDoc, obs: e.target.value })} style={{ ...s.input, resize: "vertical" }} />)}
        </div>
        {(() => {
          const f = formDoc;
          const ok = !salvando && !(f.emitido_em && f.vence_em && f.vence_em < f.emitido_em)
            && (f.modo !== "novo" || (f.tipo_id && (f.alvo_tipo === "empresa" || (f.alvo_tipo === "colaborador" ? f.colaborador_id : f.equipamento_id))));
          return (
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={() => setFormDoc(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
              <button onClick={salvarDoc} disabled={!ok} style={{ ...s.btn(ok), flex: 1 }}>{salvando ? "Salvando…" : f.modo === "renovar" ? "Renovar" : "Salvar"}</button>
            </div>
          );
        })()}
      </>, () => setFormDoc(null))}

      {/* ─── modal novo tipo ─── */}
      {novoTipo && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Novo tipo de documento ({ALVO[novoTipo.alvo]})</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {campo("NOME", <input value={novoTipo.nome} onChange={(e) => setNovoTipo({ ...novoTipo, nome: e.target.value })} placeholder="ex.: NR-35, certificado do munck…" style={s.input} />, "2 1 220px")}
          {campo("VALIDADE (MESES, OPCIONAL)", <input type="number" min={1} max={240} value={novoTipo.validade_meses_padrao} onChange={(e) => setNovoTipo({ ...novoTipo, validade_meses_padrao: e.target.value })} style={s.input} />, "1 1 140px")}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={() => setNovoTipo(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          <button onClick={salvarNovoTipo} disabled={!novoTipo.nome.trim()} style={{ ...s.btn(!!novoTipo.nome.trim()), flex: 1 }}>Criar tipo</button>
        </div>
      </>, () => setNovoTipo(null), 480)}

      {/* ─── confirmação ─── */}
      {confirmar && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.danger }}>⚠ {confirmar.titulo}</div>
        <div style={{ fontSize: 13, color: C.textSub, marginTop: 10, lineHeight: 1.5 }}>{confirmar.texto}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={() => setConfirmar(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          <button onClick={executarConfirmar} style={{ ...s.btn(true, C.danger), cursor: "pointer", flex: 1 }}>Excluir</button>
        </div>
      </>, () => setConfirmar(null), 460)}
    </div>
  );
}
