// components/contratos/ModelosContrato.jsx — etapa 14d
//   EditorModeloContrato — nome, descrição e o texto com os campos automáticos (clique no campo para inserir onde está o cursor)
//   AbaModelos           — 📑 Contratos → 📄 Modelos: importar da biblioteca do QuotaFlow, criar, editar, ✨ versão nova, desativar
//   DocumentoContrato    — no contrato: modelo + condições comerciais + valor mensal por equipamento → 👁 prévia / 📄 emitir
//                          (texto congelado com hash, versão) → aceite do locatário
import { useState, useEffect, useRef } from "react";
import apiService from "../../services/apiService";
import { abrirContrato, prepararJanela } from "../../utils/gerarContrato";
import { dadosEmpresa } from "../../utils/logoEmpresa";
import { gerarHtmlContrato } from "../../utils/gerarContrato";
import CampoMoeda from "../shared/CampoMoeda"; // 14d.1

const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const casca = (s, conteudo, fechar, largura = 640, z = 330) => (
  <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: z, padding: 16, overflowY: "auto" }} onClick={fechar}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: largura, maxWidth: "100%", padding: "18px 20px", margin: "auto 0", boxShadow: "0 24px 48px #00000060" }}>{conteudo}</div>
  </div>
);
const campo = (s, rot, el, flex = "1 1 160px") => <label style={{ flex, display: "block" }}><span style={s.label}>{rot}</span>{el}</label>;

/** 14d.1: modelo com os campos à mostra («Razão social do cliente») e uma tabela de exemplo */
function htmlModelo(m, campos = []) {
  const nome = new Map(campos.map(([k, l]) => [k, l]));
  const texto = String(m.corpo || "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => (k === "tabela_equipamentos" ? "[[TABELA_EQUIPAMENTOS]]" : `«${nome.get(k) || k}»`));
  return gerarHtmlContrato({ numero: "«nº do contrato»", texto, tabela: [{ tag: "EQ-01", nome: "Equipamento de exemplo", valor_mensal: null }], empresa: dadosEmpresa(), previa: true });
}

export function EditorModeloContrato({ C, s, inicial, campos, salvando, onSalvar, onCancelar, titulo }) {
  const [m, setM] = useState(() => ({ nome: "", descricao: "", corpo: "", ...inicial }));
  const ref = useRef(null);
  const inserir = (k) => {
    const el = ref.current; const tag = `{{${k}}}`;
    if (!el) return setM((x) => ({ ...x, corpo: `${x.corpo}${tag}` }));
    const a = el.selectionStart ?? m.corpo.length, b = el.selectionEnd ?? a;
    const novo = m.corpo.slice(0, a) + tag + m.corpo.slice(b);
    setM({ ...m, corpo: novo });
    setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = a + tag.length; }, 0);
  };
  return (<>
    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{titulo || (m.id ? `Editar — ${m.nome}` : "Novo modelo de contrato")}</div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{campo(s, "NOME", <input value={m.nome} onChange={(e) => setM({ ...m, nome: e.target.value })} style={s.input} />, "2 1 240px")}
      {campo(s, "DESCRIÇÃO (OPCIONAL)", <input value={m.descricao || ""} onChange={(e) => setM({ ...m, descricao: e.target.value })} style={s.input} />, "3 1 260px")}</div>
    <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap", alignItems: "stretch" }}>
      <label style={{ flex: "3 1 380px", display: "block" }}><span style={s.label}>TEXTO DO CONTRATO</span>
        <textarea ref={ref} value={m.corpo} onChange={(e) => setM({ ...m, corpo: e.target.value })} rows={22} spellCheck
          style={{ ...s.input, resize: "vertical", fontFamily: "Georgia, serif", fontSize: 13, lineHeight: 1.5 }} /></label>
      <div style={{ flex: "1 1 200px", maxHeight: 470, overflowY: "auto" }}>
        <span style={s.label}>CAMPOS (CLIQUE PARA INSERIR)</span>
        {(campos || []).map(([k, l]) => (
          <button key={k} type="button" onClick={() => inserir(k)} title={`{{${k}}}`} className="qf-clicavel" style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 8px", marginBottom: 4, color: C.text, fontSize: 11.5, fontFamily: "inherit" }}>
            {l}<div style={{ color: C.muted, fontSize: 10, fontFamily: "monospace" }}>{`{{${k}}}`}</div></button>
        ))}
      </div>
    </div>
    <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Linhas em MAIÚSCULAS e as que começam com "CLÁUSULA" saem em negrito. Coloque <b>{"{{tabela_equipamentos}}"}</b> sozinho numa linha para a tabela dos equipamentos.</div>
    <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
      <button type="button" onClick={onCancelar} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
      <button type="button" disabled={salvando || !m.nome.trim()} onClick={() => onSalvar(m)} style={{ ...s.btn(!salvando && !!m.nome.trim(), C.accent), flex: 1 }}>{salvando ? "Salvando…" : "Salvar modelo"}</button>
    </div>
  </>);
}

export function AbaModelos({ C, s, editar, onErro, onOk }) {
  const [d, setD] = useState(null);
  const [bib, setBib] = useState(null);
  const [form, setForm] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [ver, setVer] = useState(null); // 14d.1: ver o modelo antes de importar / editar
  const [ocupado, setOcupado] = useState(false);
  const carregar = async () => { try { setD(await apiService.get("/contratos/modelos")); } catch (e) { onErro(e.message); } };
  useEffect(() => { carregar(); }, []); // eslint-disable-line
  const acao = async (fn, msg) => { setOcupado(true); try { await fn(); onOk(msg); await carregar(); return true; } catch (e) { onErro(e.message); return false; } finally { setOcupado(false); } };
  const bt = (cor, cheio = true) => ({ ...s.btn(true, cor), cursor: "pointer", padding: "6px 11px", fontSize: 12, ...(cheio ? {} : { background: "transparent", color: cor }) });
  if (!d) return <div style={{ color: C.muted }}>Carregando…</div>;
  return (
    <div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Texto padrão do seu contrato com campos automáticos (cliente, obra, datas, equipamentos, condições). No contrato você só escolhe o modelo e preenche as condições comerciais.</div>
      {editar && <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={async () => { try { setBib((await apiService.get("/contratos/modelos/biblioteca")).modelos || []); } catch (e) { onErro(e.message); } }} style={bt(C.accent)}>📚 Importar da biblioteca QuotaFlow</button>
        <button type="button" onClick={() => setForm({})} style={bt(C.accent, false)}>＋ Criar do zero</button>
      </div>}
      <div style={{ ...s.card, overflow: "hidden" }}>
        {d.modelos.map((m, k) => (
          <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: k < d.modelos.length - 1 ? `1px solid ${C.border}` : "none", flexWrap: "wrap" }}>
            <div style={{ flex: "2 1 240px" }}><div style={{ fontWeight: 600, fontSize: 13 }}>{m.nome}</div><div style={{ fontSize: 11, color: C.muted }}>{m.descricao || ""}{m.origem_id ? " · da biblioteca" : ""} · {m.campos_usados} campos automáticos</div></div>
            {m.versao_nova && editar && <button type="button" onClick={() => setConfirmar({ titulo: "Atualizar para a versão nova da biblioteca?", texto: "As mudanças que vocês fizeram no texto serão substituídas. Contratos já emitidos não mudam.", acao: () => apiService.post(`/contratos/modelos/${m.id}/atualizar`), msg: "Modelo atualizado." })} style={bt(C.violet || "#a855f7")}>✨ Versão nova</button>}
            <button type="button" onClick={() => setVer(m)} className="qf-clicavel" style={bt(C.textSub, false)}>👁 Ver</button>
            {editar && <button type="button" onClick={() => setForm(m)} style={bt(C.accent, false)}>Editar</button>}
            {editar && <button type="button" onClick={() => setConfirmar({ titulo: `Desativar “${m.nome}”?`, texto: "Ele sai da lista para novos contratos. Contratos já emitidos não mudam.", acao: () => apiService.delete(`/contratos/modelos/${m.id}`), msg: "Modelo desativado." })} style={bt(C.danger, false)}>Desativar</button>}
          </div>
        ))}
        {d.modelos.length === 0 && <div style={{ padding: 20, color: C.muted, textAlign: "center" }}>Nenhum modelo ainda. {editar ? "Importe o modelo-base da biblioteca e adapte ao seu." : ""}</div>}
      </div>
      {form && casca(s, <EditorModeloContrato C={C} s={s} inicial={form} campos={d.campos} salvando={ocupado} onCancelar={() => setForm(null)}
        onSalvar={async (m) => { const ok = await acao(() => (m.id ? apiService.put(`/contratos/modelos/${m.id}`, { nome: m.nome, descricao: m.descricao, corpo: m.corpo }) : apiService.post("/contratos/modelos", { nome: m.nome, descricao: m.descricao, corpo: m.corpo })), "Modelo salvo."); if (ok) setForm(null); }} />, () => {}, 1000)}
      {bib && casca(s, <>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>📚 Modelos de contrato do QuotaFlow</div>
        <div style={{ fontSize: 12, color: C.warn, marginBottom: 12 }}>São pontos de partida — revise com o seu jurídico antes de usar.</div>
        {bib.map((m) => (
          <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{m.nome}</div><div style={{ fontSize: 11, color: C.muted }}>{m.descricao}</div></div>
            <button type="button" onClick={() => setVer(m)} className="qf-clicavel" style={{ ...bt(C.accent, false) }}>👁 Ver</button>
            {m.ja_importado ? <span style={s.tag(C.success)}>Importado</span> : <button type="button" disabled={ocupado} onClick={async () => { if (await acao(() => apiService.post("/contratos/modelos/importar", { biblioteca_id: m.id }), `“${m.nome}” importado — ajuste em Editar.`)) setBib(null); }} style={bt(C.accent)}>Importar</button>}
          </div>
        ))}
        {bib.length === 0 && <div style={{ color: C.muted }}>A biblioteca está vazia.</div>}
        <div style={{ textAlign: "right", marginTop: 12 }}><button type="button" onClick={() => setBib(null)} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>Fechar</button></div>
      </>, () => setBib(null), 620)}
      {ver && casca(s, <>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}><div style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>👁 {ver.nome}</div>
          <span style={{ fontSize: 11, color: C.muted }}>Os campos automáticos aparecem como «nome do campo»</span></div>
        <iframe title="modelo" srcDoc={htmlModelo(ver, d.campos)} style={{ width: "100%", height: "65vh", border: `1px solid ${C.border}`, borderRadius: 6, background: "#fff" }} />
        <div style={{ textAlign: "right", marginTop: 10 }}><button type="button" onClick={() => setVer(null)} style={{ ...s.btn(true, C.accent), cursor: "pointer" }}>Fechar</button></div>
      </>, () => setVer(null), 860, 345)}
      {confirmar && casca(s, <>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.danger }}>⚠ {confirmar.titulo}</div>
        <div style={{ fontSize: 13, color: C.textSub, marginTop: 10 }}>{confirmar.texto}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button type="button" onClick={() => setConfirmar(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Voltar</button>
          <button type="button" onClick={async () => { const c = confirmar; setConfirmar(null); await acao(c.acao, c.msg); }} style={{ ...s.btn(true, C.danger), cursor: "pointer", flex: 1 }}>Confirmar</button>
        </div>
      </>, () => setConfirmar(null), 440, 340)}
    </div>
  );
}

/** No detalhe do contrato (empresa) */
export function DocumentoContrato({ C, s, contrato: k, editar, onErro: onErroPai, onOk: onOkPai, onMudou }) {
  // 14d.1: a mensagem aparece AQUI (o aviso da tela fica escondido atrás do modal do contrato)
  const [msg, setMsg] = useState(null);
  const onErro = (t) => { setMsg({ tipo: "erro", texto: t }); onErroPai?.(t); };
  const onOk = (t) => { setMsg({ tipo: "ok", texto: t }); onOkPai?.(t); };
  const [modelos, setModelos] = useState(null);
  const [f, setF] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [faltando, setFaltando] = useState(null);
  const [papel, setPapel] = useState(null); // 14d.2: { data, obs } — assinatura no papel
  useEffect(() => { apiService.get("/contratos/modelos").then((r) => setModelos(r.modelos || [])).catch(() => setModelos([])); }, []);
  useEffect(() => {
    const c = k.condicoes || {};
    setF({ modelo_id: k.modelo_id || "", caucao: c.caucao ?? "", franquia_horas: c.franquia_horas ?? "", hora_excedente: c.hora_excedente ?? "", reajuste: c.reajuste ?? "IPCA", multa_rescisoria_pct: c.multa_rescisoria_pct ?? "",
      vencimento_dia: c.vencimento_dia ?? "", forma_pagamento: c.forma_pagamento ?? "boleto bancário", foro: c.foro ?? "", observacoes: c.observacoes ?? "", na: c.na || [],
      valores: Object.fromEntries(k.equipamentos.filter((e) => e.ativa).map((e) => [e.locacao_id, e.valor_mensal ?? ""])) });
  }, [k.id]); // eslint-disable-line
  if (!f || !modelos) return null;
  const set = (x, v) => setF({ ...f, [x]: v });
  const salvar = async () => {
    const { modelo_id, valores, ...cond } = f;
    await apiService.put(`/contratos/${k.id}/condicoes`, { modelo_id: modelo_id || null, condicoes: cond, valores });
  };
  const empresa = dadosEmpresa();
  const previa = async () => {
    setOcupado(true); const w = prepararJanela();
    try { await salvar(); const p = await apiService.get(`/contratos/${k.id}/previa`); setFaltando(p.faltando); abrirContrato({ ...p, empresa, cliente: k.cliente, previa: true }, w); onMudou?.(); }
    catch (e) { try { w?.close(); } catch { /* ok */ } onErro(e.message); } finally { setOcupado(false); }
  };
  const emitir = async (forcar = false) => {
    setOcupado(true);
    try { await salvar(); const r = await apiService.post(`/contratos/${k.id}/emitir`, { forcar }); setFaltando(null); onOk(`Contrato emitido — versão ${r.versao}. ${k.acessos?.length ? "O locatário já pode ler e aceitar pelo acesso dele." : "Crie o acesso do locatário para ele aceitar pelo sistema."}`); onMudou?.(); }
    catch (e) { if (e.body?.faltando) setFaltando(e.body.faltando); onErro(e.message); } finally { setOcupado(false); }
  };
  const imprimirEmitido = () => { const w = prepararJanela(); try { abrirContrato({ numero: k.numero, texto: k.emitido_texto, tabela: k.emitido_tabela || [], empresa, cliente: k.cliente, versao: k.emitido_versao, emitido_em: k.emitido_em, emitido_por: k.emitido_por_nome, hash: k.emitido_hash,
    aceite: k.aceite_em ? { nome: k.aceite_nome, em: k.aceite_em, png: k.aceite_png, hash: k.aceite_hash } : null }, w); } catch (e) { onErro(e.message); } };
  // 14d.2: N/A — o campo fica cinza, não conta como "falta" e sai "não se aplica" no contrato
  const ehNA = (x) => (f.na || []).includes(x);
  const alternaNA = (x) => setF({ ...f, na: ehNA(x) ? f.na.filter((y) => y !== x) : [...(f.na || []), x] });
  const bloq = !editar || k.status !== "ativo";
  const inp = (x, extra = {}) => <input value={ehNA(x) ? "não se aplica" : (f[x] ?? "")} onChange={(e) => set(x, e.target.value)} disabled={bloq || ehNA(x)} style={{ ...s.input, ...(ehNA(x) ? { opacity: 0.55, fontStyle: "italic" } : {}) }} {...extra} />;
  const moeda = (x) => (ehNA(x) ? inp(x) : <CampoMoeda value={f[x]} onChange={(v) => set(x, v)} disabled={bloq} style={s.input} />);
  const rotNA = (rot, x) => <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ flex: 1 }}>{rot}</span>
    <span onClick={(e) => { e.preventDefault(); if (!bloq) alternaNA(x); }} title="Não se aplica a este contrato" className={bloq ? "" : "qf-clicavel"} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, border: `1px solid ${ehNA(x) ? C.warn : C.border}`, color: ehNA(x) ? C.warn : C.muted, letterSpacing: 0 }}>{ehNA(x) ? "☑" : "☐"} N/A</span></span>;
  const ativos = k.equipamentos.filter((e) => e.ativa);
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <div style={{ fontWeight: 700, flex: 1 }}>📄 Contrato (documento)</div>
        {k.emitido_hash ? <span style={s.tag(k.aceite_em ? C.success : C.warn)}>{k.aceite_em ? `✍ ACEITO v${k.emitido_versao}` : `EMITIDO v${k.emitido_versao} · AGUARDANDO ACEITE`}</span> : <span style={s.tag(C.muted)}>NÃO EMITIDO</span>}
      </div>
      {k.emitido_hash && <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Emitido em {dataHora(k.emitido_em)}{k.emitido_por_nome ? ` por ${k.emitido_por_nome}` : ""}{k.aceite_em ? ` · aceito por ${k.aceite_nome} em ${dataHora(k.aceite_em)}` : ""}</div>}
      {modelos.length === 0 ? <div style={{ fontSize: 13, color: C.muted }}>Nenhum modelo de contrato — importe o modelo-base na aba 📄 Modelos.</div> : (<>
        {campo(s, "MODELO", <select value={f.modelo_id} onChange={(e) => set("modelo_id", e.target.value)} disabled={!editar || k.status !== "ativo"} style={s.input}><option value="">— escolha —</option>{modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>, "1 1 100%")}
        {ativos.length > 0 && <div style={{ marginTop: 8 }}><span style={s.label}>VALOR MENSAL POR EQUIPAMENTO (R$)</span>
          {ativos.map((e) => <div key={e.locacao_id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}><span style={{ flex: 1, fontSize: 13 }}>{e.tag} — {e.nome}</span>
            <CampoMoeda value={f.valores[e.locacao_id]} onChange={(v) => setF({ ...f, valores: { ...f.valores, [e.locacao_id]: v } })} disabled={!editar || k.status !== "ativo"} style={{ ...s.input, width: 160 }} /></div>)}</div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {campo(s, rotNA("CAUÇÃO", "caucao"), moeda("caucao"))}{campo(s, rotNA("FRANQUIA (H/MÊS POR EQUIP.)", "franquia_horas"), inp("franquia_horas", { inputMode: "numeric" }))}{campo(s, rotNA("HORA EXCEDENTE", "hora_excedente"), moeda("hora_excedente"))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {campo(s, rotNA("REAJUSTE (ÍNDICE)", "reajuste"), inp("reajuste"))}{campo(s, rotNA("MULTA RESCISÓRIA (%)", "multa_rescisoria_pct"), inp("multa_rescisoria_pct", { inputMode: "decimal" }))}{campo(s, rotNA("VENCIMENTO (DIA)", "vencimento_dia"), inp("vencimento_dia", { inputMode: "numeric" }))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{campo(s, rotNA("FORMA DE PAGAMENTO", "forma_pagamento"), inp("forma_pagamento"))}{campo(s, rotNA("FORO (COMARCA)", "foro"), inp("foro", { placeholder: "Rio de Janeiro/RJ" }))}</div>
        <label style={{ display: "block", marginTop: 8 }}><span style={s.label}>CONDIÇÕES ESPECÍFICAS DESTE CONTRATO</span>
          <textarea rows={3} value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} disabled={!editar || k.status !== "ativo"} style={{ ...s.input, resize: "vertical" }} /></label>
        {msg && <div style={{ fontSize: 12.5, marginTop: 8, padding: "6px 10px", borderRadius: 6, color: msg.tipo === "erro" ? C.danger : C.success, background: `${msg.tipo === "erro" ? C.danger : C.success}14` }}>{msg.tipo === "erro" ? "⚠ " : "✓ "}{msg.texto}</div>}
        {faltando?.length > 0 && <div style={{ fontSize: 12, color: C.warn, marginTop: 6 }}>Ainda sem valor: {faltando.join(", ")}. Na prévia aparece "________".</div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, justifyContent: "flex-end" }}>
          {k.emitido_hash && <button type="button" onClick={imprimirEmitido} className="qf-clicavel" style={{ ...s.btn(false), cursor: "pointer", color: C.text, background: "transparent", marginRight: "auto" }}>🖨 Contrato emitido (v{k.emitido_versao})</button>}
          {editar && k.status === "ativo" && <button type="button" disabled={ocupado || !f.modelo_id} onClick={async () => { setOcupado(true); try { await salvar(); onOk("Condições salvas."); onMudou?.(); } catch (e) { onErro(e.message); } finally { setOcupado(false); } }} style={{ ...s.btn(!ocupado && !!f.modelo_id, C.accent), background: "transparent", color: C.accent }}>Salvar</button>}
          <button type="button" disabled={ocupado || !f.modelo_id} onClick={previa} style={{ ...s.btn(!ocupado && !!f.modelo_id, C.accent), background: "transparent", color: C.accent }}>👁 Prévia</button>
          {editar && k.status === "ativo" && <button type="button" disabled={ocupado || !f.modelo_id} onClick={() => emitir(!!faltando?.length)} style={s.btn(!ocupado && !!f.modelo_id, C.success)}>{faltando?.length ? "📄 Emitir mesmo assim" : k.emitido_hash ? "📄 Emitir nova versão" : "📄 Emitir"}</button>}
        </div>
        {editar && k.status === "ativo" && k.emitido_hash && !k.aceite_em && (papel ? (
          <div style={{ ...s.card, padding: 10, marginTop: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>✍ Registrar assinatura no papel (versão {k.emitido_versao})</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              {campo(s, "ASSINADO EM", <input type="date" value={papel.data} onChange={(e) => setPapel({ ...papel, data: e.target.value })} style={s.input} />, "0 0 170px")}
              {campo(s, "OBSERVAÇÃO (OPCIONAL)", <input value={papel.obs} onChange={(e) => setPapel({ ...papel, obs: e.target.value })} placeholder="via original no arquivo do escritório" style={s.input} />, "1 1 220px")}
              <button type="button" onClick={() => setPapel(null)} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>Cancelar</button>
              <button type="button" disabled={ocupado} onClick={async () => { setOcupado(true); try { await apiService.post(`/contratos/${k.id}/aceite-papel`, papel); setPapel(null); onOk("Assinatura registrada — contrato em andamento."); onMudou?.(); } catch (e) { onErro(e.message); } finally { setOcupado(false); } }} style={s.btn(!ocupado, C.success)}>Registrar</button>
            </div>
          </div>) : <div style={{ textAlign: "right", marginTop: 8 }}><button type="button" onClick={() => setPapel({ data: new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10), obs: "" })} className="qf-clicavel" style={{ background: "none", border: "none", color: C.textSub, fontSize: 12, textDecoration: "underline" }}>O cliente assinou no papel? Registrar assinatura</button></div>)}
        {k.emitido_hash && k.aceite_em && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Emitir de novo gera a versão {k.emitido_versao + 1} e pede novo aceite do locatário.</div>}
      </>)}
    </div>
  );
}
