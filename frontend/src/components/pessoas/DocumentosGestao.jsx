// components/pessoas/DocumentosGestao.jsx — etapa 18zr: 📘 aba GESTÃO do menu 📁 Documentos (sistema da qualidade — ISO 9001 7.5)
//   Manual, políticas, procedimentos, instruções, formulários, registros: código + revisão + situação, elaborado/aprovado,
//   próxima análise crítica, texto editável no sistema e/ou arquivo. Vigente não se exclui (vira Obsoleto — histórico).
//   Próximas etapas: 18zs (fluxo de revisão, histórico de versões, confirmação de leitura) · 18zt (biblioteca de modelos ISO 9001).
import { useEffect, useMemo, useState } from "react";
import CampoFuncionario from "../shared/CampoFuncionario"; // 18zz.6
import apiService from "../../services/apiService";
import VerArquivo from "../programacao/VerArquivo";
import { Toggle } from "../../plataforma/ModulosPlataforma"; // 18zz.2
import ConfirmarExclusao from "../shared/ConfirmarExclusao";
import { dadosEmpresa } from "../../utils/logoEmpresa";
import { corpoDocGestao, imprimirDocGestao, CSS_DOC_GESTAO } from "../../utils/gerarDocumentoGestao"; // 18zu: logo + rodapé

// 18zz.4: perfis de acesso (os mesmos do cadastro de usuário)
const PERFIS = [{ codigo: "admin", label: "Administrador" }, { codigo: "gestor", label: "Gestor" }, { codigo: "comprador", label: "Comprador" }, { codigo: "operacao", label: "Operação" }, { codigo: "qualidade", label: "Qualidade" }, { codigo: "financeiro", label: "Financeiro" }, { codigo: "comercial", label: "Comercial" }, { codigo: "fiscal", label: "Fiscal" }, { codigo: "colaborador", label: "Colaborador (app de campo)" }];
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
  const [revi, setRevi] = useState(null); const [hist, setHist] = useState(null); const [leit, setLeit] = useState(null); const [verVersao, setVerVersao] = useState(null); const [descartar, setDescartar] = useState(false); /* 18zs */ const [bib, setBib] = useState(null); const [buscaBib, setBuscaBib] = useState(""); const [verMod, setVerMod] = useState(null); const [publicar, setPublicar] = useState(false); /* 18zt */ const [env, setEnv] = useState(null); const [pessoas, setPessoas] = useState(null); const [acao, setAcao] = useState(null); const [verRasc, setVerRasc] = useState(false); /* 18zv */ const [funcoes, setFuncoes] = useState(null); /* 18zz.2 */ const [modalDist, setModalDist] = useState(null); const [alcance, setAlcance] = useState(null); const [paraMim, setParaMim] = useState([]); /* 18zz.4 */ const [arq, setArq] = useState(null); const [apagar, setApagar] = useState(null); const [ocup, setOcup] = useState(false);
  const carregar = () => apiService.get("/pessoas/gestao").then(setD).catch((e) => onErro?.(e.message));
  useEffect(() => { carregar(); apiService.get("/pessoas/gestao-pessoas").then(setPessoas).catch(() => {}); apiService.get("/pessoas/gestao-para-mim").then((r) => setParaMim(r.documentos || [])).catch(() => {}); const ir = window.qfAbrirGestaoDoc; window.qfAbrirGestaoDoc = null; if (ir) abrir({ id: ir }); /* 18zz.5: veio da ficha/treinamento */ }, []); // eslint-disable-line
  const editar = !!d?.pode_editar;
  const grupos = useMemo(() => {
    if (!d) return []; const b = busca.trim().toLowerCase();
    const l = d.documentos.filter((x) => (verObsoletos || x.status !== "obsoleto") && (!b || `${x.codigo} ${x.titulo} ${x.area || ""}`.toLowerCase().includes(b)));
    return ORDEM.map((t) => ({ tipo: t, docs: l.filter((x) => x.tipo === t) })).filter((g) => g.docs.length);
  }, [d, busca, verObsoletos]);

  const salvar = async (enviar = false) => { // 18zz.9: enviar = salva e já abre 📤 Enviar para aprovação
    setOcup(true);
    try {
      const { id, novo_arquivo, arquivo_url, rascunho_arquivo_url, rascunho, motivo_revisao, status_original, tem_conteudo, tem_arquivo, revisar, criado_em, atualizado_em, tenant_id, arquivo_path, arquivo_nome, arquivo_mime, ...corpo } = form;
      if (novo_arquivo) Object.assign(corpo, { arquivo_base64: novo_arquivo.base64, arquivo_mime: novo_arquivo.mime, arquivo_nome: novo_arquivo.nome });
      const r = id ? await apiService.put(`/pessoas/gestao/${id}`, corpo) : await apiService.post("/pessoas/gestao", corpo);
      setForm(null); carregar();
      if (enviar && r?.documento) abrirEnvio(r.documento); else onAviso?.(id ? "Documento atualizado." : "Documento cadastrado.");
    } catch (e) { onErro?.(e?.response?.data?.erro || e.message); } finally { setOcup(false); }
  };
  const abrir = async (x, editarDepois = false) => {
    try { const r = await apiService.get(`/pessoas/gestao/${x.id}`); const doc = r.documento;
      if (editarDepois && doc.distribuicao && !funcoes) apiService.get("/pessoas/funcoes").then((r2) => setFuncoes(r2.funcoes || [])).catch(() => setFuncoes([]));
      if (editarDepois) setForm({ ...doc, status_original: doc.status, aprovado_em: doc.aprovado_em ? String(doc.aprovado_em).slice(0, 10) : "", proxima_revisao: doc.proxima_revisao ? String(doc.proxima_revisao).slice(0, 10) : "" });
      else { setPublicar(false); setAcao(null); setVerRasc(!!doc.fluxo && !!doc.rascunho); setVer({ ...doc, pode_aprovar: r.pode_aprovar, eu: r.eu, assinatura: r.assinatura }); setHist(null); setLeit(null); if (doc.status === "vigente") apiService.get(`/pessoas/gestao/${x.id}/leituras`).then(setLeit).catch(() => {}); } }
    catch (e) { onErro?.(e.message); }
  };
  // 18zs: ↻ nova revisão (a vigente vale até aprovar) · histórico · leitura
  const abrirRevisao = (doc) => { const r = doc.rascunho || {}; setRevi({ id: doc.id, codigo: doc.codigo, revisao: (doc.revisao || 0) + 1, pode_aprovar: doc.pode_aprovar, titulo: r.titulo ?? doc.titulo, conteudo: r.conteudo ?? doc.conteudo ?? "", motivo: r.motivo || "", elaborado_por: r.elaborado_por || "", elaborado_por_id: r.elaborado_por_id ?? null, elaborado_por_usuario_id: r.elaborado_por_usuario_id ?? null, aprovado_por: r.aprovado_por || "", aprovado_por_usuario_id: r.aprovado_por_usuario_id ?? null, proxima_revisao: r.proxima_revisao || "", arquivo_nome: r.arquivo?.arquivo_nome || null, ja: !!doc.rascunho }); setVer(null); };
  const corpoRevi = () => { const { id, codigo, revisao, pode_aprovar, ja, novo_arquivo, arquivo_nome, ...c } = revi; return { ...c, ...(novo_arquivo ? { arquivo_base64: novo_arquivo.base64, arquivo_mime: novo_arquivo.mime, arquivo_nome: novo_arquivo.nome } : {}) }; };
  const salvarRevi = async (aprovar = false) => {
    setOcup(true);
    try { await apiService.put(`/pessoas/gestao/${revi.id}/rascunho`, corpoRevi());
      if (aprovar) { await apiService.post(`/pessoas/gestao/${revi.id}/aprovar`, {}); onAviso?.(`${revi.codigo} Rev. ${String(revi.revisao).padStart(2, "0")} aprovada — a anterior foi para o histórico e as leituras recomeçam.`); }
      else onAviso?.("Revisão salva como rascunho — a versão vigente continua valendo até a aprovação.");
      setRevi(null); carregar(); }
    catch (e) { onErro?.(e?.response?.data?.erro || e.message); } finally { setOcup(false); }
  };
  const lerEntendi = async () => { try { await apiService.post(`/pessoas/gestao/${ver.id}/leitura`, {}); setLeit(await apiService.get(`/pessoas/gestao/${ver.id}/leituras`)); setParaMim((l) => l.filter((x) => String(x.id) !== String(ver.id))); carregar(); onAviso?.("Leitura confirmada."); } catch (e) { onErro?.(e?.response?.data?.erro || e.message); } };
  // 18zv: ✍ fluxo interno — enviar (escolhe verificador opcional + aprovador) · verificar · devolver · aprovar e assinar
  const ETAPA = { elaboracao: "Em elaboração", verificacao: "Aguardando verificação", aprovacao: "Aguardando aprovação" };
  const abrirEnvio = async (doc) => { try { const p = pessoas || await apiService.get("/pessoas/gestao-pessoas"); setPessoas(p); const f = doc.fluxo || {};
    setEnv({ id: doc.id, codigo: doc.codigo, verificador_id: f.verificador?.id || "", aprovador_id: f.aprovador?.id || "", comentario: "" }); } catch (e) { onErro?.(e?.response?.data?.erro || e.message); } };
  const fazer = async (url, corpo, msg) => { setOcup(true); try { await apiService.post(url, corpo || {}); onAviso?.(msg); setEnv(null); setAcao(null); setVer(null); setRevi(null); carregar(); } catch (e) { onErro?.(e?.response?.data?.erro || e.message); } finally { setOcup(false); } };
  const comigo = (d?.documentos || []).filter((x) => x.com != null && pessoas && String(x.com) === String(pessoas.eu));
  // 18zz.4: distribuição — Todos · Perfis · Funções, com a contagem de funcionários esperados ao vivo
  const setDist = (d) => setForm((f) => ({ ...f, distribuicao: d }));
  const togDist = (k, v) => { const d = form.distribuicao || {}; const l = (d[k] || []).map(String); setDist({ ...d, todos: false, [k]: l.includes(String(v)) ? l.filter((x) => x !== String(v)) : [...l, String(v)] }); };
  const distKey = JSON.stringify(form?.distribuicao || null);
  useEffect(() => { if (!form?.distribuicao) { setAlcance(null); return undefined; } setAlcance(null);
    const tm = setTimeout(() => apiService.post("/pessoas/gestao-alcance", { distribuicao: form.distribuicao }).then(setAlcance).catch(() => setAlcance({ total: 0, sem_login: 0 })), 300); return () => clearTimeout(tm); }, [distKey]); // eslint-disable-line
  const statusTag = (x) => x.status === "vigente" ? (x.revisar ? <span style={s.tag(C.warn)}>Análise crítica vencida</span> : <span style={s.tag(C.success)}>Vigente</span>)
    : x.status === "rascunho" ? <span style={s.tag(C.accent)}>Rascunho</span> : <span style={s.tag(C.muted)}>Obsoleto</span>;
  const travado = !!(form?.id && form?.status_original === "vigente"); // 18zs
  const podeEnviarForm = !!form && form.status === "rascunho" && !(form.fluxo && form.fluxo.etapa !== "elaboracao"); // 18zz.9
  const opcoesSituacao = !form ? [] : form.status_original === "vigente" ? ["vigente", "obsoleto"] : form.status_original === "obsoleto" ? ["obsoleto", "vigente"] : ["rascunho", "vigente"];
  const todosUsuarios = (() => { if (!pessoas) return []; const pode = new Set((pessoas.aprovadores || []).map((u) => String(u.id))); const m = new Map(); // 18zz.10: todo mundo com login; quem não pode aprovar aparece desabilitado
    for (const u of pessoas.aprovadores || []) m.set(String(u.id), { id: u.id, nome: u.nome, pode: true });
    for (const f of pessoas.funcionarios || []) if (f.usuario_id && !m.has(String(f.usuario_id))) m.set(String(f.usuario_id), { id: f.usuario_id, nome: f.nome, pode: pode.has(String(f.usuario_id)) });
    return [...m.values()].sort((a, b) => (b.pode - a.pode) || String(a.nome).localeCompare(String(b.nome), "pt-BR")); })();
  const semPerfil = (t) => { // 18zz.8.2: a pessoa existe, mas o login não tem perfil de aprovação
    const sem = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const achados = (pessoas?.funcionarios || []).filter((p) => sem(p.nome).includes(t));
    if (!achados.length) return null;
    const nomes = achados.slice(0, 3).map((p) => p.nome).join(", ");
    return `${nomes} ${achados.length > 1 ? "estão" : "está"} no cadastro, mas sem perfil para aprovar (admin, gestor ou qualidade)${achados.some((p) => !p.usuario_id) ? " ou sem login" : ""}. Para aprovar documentos, ajuste o perfil em Administração → Usuários.`;
  };
  const listaAprov = pessoas ? (pessoas.aprovadores || []).map((u) => ({ id: null, usuario_id: u.id, nome: u.nome, funcao: "pode aprovar" })) : null; // 18zz.8: só quem tem perfil de aprovação
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
      {editar && <button type="button" onClick={() => setForm({ codigo: "", titulo: "", tipo: "procedimento", area: "", revisao: 0, status: "rascunho", elaborado_por: "", elaborado_por_id: null, aprovado_por: "", aprovado_por_id: null, aprovado_em: "", proxima_revisao: "", norma: "", conteudo: "" })} style={{ ...s.btn(true), cursor: "pointer" }}>＋ Novo documento de gestão</button>}
    </div>
    {paraMim.length > 0 && <div style={{ ...s.card, padding: "10px 14px", marginBottom: 12, borderColor: C.warn, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <b>📣 Para você ler:</b>{paraMim.map((x) => <button key={x.id} type="button" onClick={() => abrir(x)} style={{ ...s.btn(false), padding: "4px 10px", fontSize: 12.5, cursor: "pointer", color: C.warn }}>{x.codigo} · {x.titulo}</button>)}
    </div>}
    {comigo.length > 0 && <div style={{ ...s.card, padding: "10px 14px", marginBottom: 12, borderColor: C.accent, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <b>✍ Aguardando você:</b>{comigo.map((x) => <button key={x.id} type="button" onClick={() => abrir(x)} style={{ ...s.btn(false), padding: "4px 10px", fontSize: 12.5, cursor: "pointer", color: C.accent }}>{x.codigo} · {x.etapa === "verificacao" ? "verificar" : "aprovar"}</button>)}
    </div>}
    <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Manual da qualidade, políticas, procedimentos, instruções e formulários — com código e revisão (ISO 9001, 7.5). Comece pelos 📚 Modelos ISO 9001: entram como rascunho, você ajusta e aprova.</div>
    {grupos.length === 0 ? <div style={{ ...s.card, padding: 28, textAlign: "center", color: C.textSub }}>{d.documentos.length ? "Nenhum documento com esses filtros." : "Nenhum documento de gestão ainda. Cadastre o manual, os procedimentos e as políticas da empresa."}</div>
      : grupos.map((g) => <div key={g.tipo} style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, letterSpacing: "0.04em", margin: "0 0 6px" }}>{ICONE[g.tipo]} {String(d.tipos[g.tipo]).toUpperCase()}{g.tipo === "manual" ? "" : "S"} · {g.docs.length}</div>
        <div style={{ ...s.card, overflow: "hidden", padding: 0 }}>{g.docs.map((x, i) => <div key={x.id} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "11px 14px", borderBottom: i < g.docs.length - 1 ? `1px solid ${C.border}` : "none", opacity: x.status === "obsoleto" ? 0.6 : 1 }}>
          <div style={{ flex: "2 1 240px", minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}><span style={{ color: C.accent }}>{x.codigo}</span> · {x.titulo}</div>
            <div style={{ fontSize: 11.5, color: C.textSub }}>{x.status === "vigente" && x.aprovado_em && (() => { const m = Math.floor((Date.now() - new Date(String(x.aprovado_em).slice(0, 10)).getTime()) / (30.44 * 864e5)); return m >= 24 ? <span title="Informativo: a ISO não fixa prazo — vale verificar se o conteúdo continua adequado" style={{ color: C.warn, fontWeight: 600 }}>⏳ sem revisão há {Math.floor(m / 12)} ano(s) · </span> : null; })()}{rev(x.revisao)}{x.area ? ` · ${x.area}` : ""}{x.aprovado_em ? ` · aprovado em ${dBR(x.aprovado_em)}${x.aprovado_por ? ` por ${x.aprovado_por}` : ""}` : ""}{x.proxima_revisao ? ` · análise crítica até ${dBR(x.proxima_revisao)}` : ""}</div>
          </div>
          {statusTag(x)}{x.distribuicao && x.status !== "vigente" && <span title="Leitura obrigatória já configurada — os colaboradores recebem quando o documento for aprovado (vigente)" style={s.tag(C.muted)}>📣 distribui ao aprovar</span>}{x.distribuicao && x.status === "vigente" && <span title="Leitura obrigatória — leram / esperados" style={s.tag(x.leitura && x.leitura.esperados && x.leitura.lidos >= x.leitura.esperados ? C.success : C.warn)}>📣 {x.leitura ? `${x.leitura.lidos}/${x.leitura.esperados} leram` : x.distribuicao.todos ? "todos" : "distribuído"}</span>}{x.em_revisao && !x.etapa && <span title={x.rascunho_motivo || ""} style={s.tag(C.accent)}>↻ Rev. {String((x.revisao || 0) + 1).padStart(2, "0")} em elaboração</span>}
          {x.etapa && <span style={s.tag(x.etapa === "elaboracao" ? C.warn : C.accent)}>✍ {x.etapa === "elaboracao" ? "Devolvido p/ ajuste" : ETAPA[x.etapa]}{x.etapa !== "elaboracao" && x.fluxo ? ` · ${(x.etapa === "verificacao" ? x.fluxo.verificador?.nome : x.fluxo.aprovador?.nome) || ""}` : ""}</span>}
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={() => abrir(x)} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.accent }}>👁 Ver</button>
            {["verificacao", "aprovacao"].includes(x.etapa) ? <span title="Em verificação/aprovação o documento fica travado (inclusive para quem aprova). Para mudar algo: ↩ Devolver com comentário — quem elaborou ajusta e reenvia." style={{ fontSize: 12, color: C.muted, alignSelf: "center" }}>🔒 travado no fluxo</span> : <>
            {editar && <button type="button" onClick={() => abrir(x, true)} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.text }}>Editar</button>}
            {editar && x.status !== "vigente" && <button type="button" onClick={() => setApagar(x)} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.danger }}>Excluir</button>}</>}
          </div>
        </div>)}</div>
      </div>)}

    {ver && <div onClick={() => setVer(null)} style={{ position: "fixed", inset: 0, background: "#000000aa", zIndex: 80, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(820px, 100%)" }}>
        <div style={{ background: "#fff", borderRadius: 6, padding: "26px 32px", overflow: "hidden" }}><style>{CSS_DOC_GESTAO}</style><div dangerouslySetInnerHTML={{ __html: verRasc && ver.rascunho ? corpoDocGestao({ ...ver, ...ver.rascunho, revisao: (ver.revisao || 0) + 1, status: "em_aprovacao", motivo_revisao: ver.rascunho.motivo, assinaturas: null, aprovado_por: null, aprovado_em: null }) : corpoDocGestao(ver) }} /></div>
        {(ver.fluxo || (ver.status === "rascunho") || ver.rascunho) && <div style={{ ...s.card, background: C.surface, padding: "10px 12px", marginTop: 10, fontSize: 12.5 }}>{/* 18zv: fluxo */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ flex: 1 }}>✍ {ver.fluxo ? (ver.fluxo.etapa === "elaboracao" ? "Devolvido para ajuste" : ETAPA[ver.fluxo.etapa]) : "Rascunho — ainda não enviado"}{ver.rascunho ? ` · Rev. ${String((ver.revisao || 0) + 1).padStart(2, "0")}` : ""}</b>
            {ver.rascunho && <button type="button" onClick={() => setVerRasc(!verRasc)} style={{ ...s.btn(false), padding: "5px 10px", fontSize: 12, cursor: "pointer", color: C.accent }}>{verRasc ? "Ver a vigente" : `👁 Ver a Rev. ${String((ver.revisao || 0) + 1).padStart(2, "0")} proposta`}</button>}
            {editar && (!ver.fluxo || ver.fluxo.etapa === "elaboracao") && <button type="button" onClick={() => abrirEnvio(ver)} style={{ ...s.btn(true), padding: "5px 12px", fontSize: 12.5, cursor: "pointer" }}>📤 Enviar para aprovação</button>}
            {["verificacao", "aprovacao"].includes(ver.fluxo?.etapa) && [String(ver.fluxo.aprovador?.id), String(ver.fluxo.elaborado?.usuario_id)].includes(String(ver.eu)) && <button type="button" onClick={() => { if (!pessoas) apiService.get("/pessoas/gestao-pessoas").then(setPessoas).catch(() => {}); setAcao({ tipo: "transferir", para: "", comentario: "" }); }} style={{ ...s.btn(false), padding: "5px 10px", fontSize: 12.5, cursor: "pointer", color: "#a855f7", borderColor: "#a855f7" }}>↪️ Transferir aprovação</button>}
            {ver.fluxo?.etapa === "verificacao" && String(ver.fluxo.verificador?.id) === String(ver.eu) && <>
              <button type="button" onClick={() => setAcao({ tipo: "devolver", comentario: "" })} style={{ ...s.btn(false), padding: "5px 10px", fontSize: 12.5, cursor: "pointer", color: C.warn }}>↩ Devolver</button>
              <button type="button" onClick={() => setAcao({ tipo: "verificar", comentario: "" })} style={{ ...s.btn(true), padding: "5px 12px", fontSize: 12.5, cursor: "pointer" }}>✓ Verificar e assinar</button></>}
            {ver.fluxo?.etapa === "aprovacao" && String(ver.fluxo.aprovador?.id) === String(ver.eu) && <>
              <button type="button" onClick={() => setAcao({ tipo: "devolver", comentario: "" })} style={{ ...s.btn(false), padding: "5px 10px", fontSize: 12.5, cursor: "pointer", color: C.warn }}>↩ Devolver</button>
              <button type="button" onClick={() => setAcao({ tipo: "aprovar" })} style={{ ...s.btn(true), padding: "5px 12px", fontSize: 12.5, cursor: "pointer" }}>✍ Aprovar e assinar</button></>}
          </div>
          {!ver.fluxo && (ver.rascunho?.aprovado_por || (ver.status === "rascunho" && ver.aprovado_por)) && <div style={{ color: C.textSub, marginTop: 4 }}>Aprovador responsável: <b>{ver.rascunho?.aprovado_por || ver.aprovado_por}</b> — já vem escolhido em 📤 Enviar para aprovação.</div>}
          {ver.fluxo && <div style={{ color: C.textSub, marginTop: 4 }}>Elaborado por {ver.fluxo.elaborado?.nome}{ver.fluxo.verificador ? ` · verificação: ${ver.fluxo.verificador.nome}${ver.fluxo.verificado ? " ✓" : ""}` : ""} · aprovação: {ver.fluxo.aprovador?.nome}</div>}
          {(ver.fluxo?.historico || []).slice(-4).map((h, i) => <div key={i} style={{ color: C.muted, fontSize: 11.5 }}>{new Date(h.em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {h.acao} por {h.por}{h.comentario ? ` — "${h.comentario}"` : ""}</div>)}
          {acao && <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {acao.tipo === "transferir" ? <span style={{ flex: 1, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <select autoFocus value={acao.para} onChange={(e) => setAcao({ ...acao, para: e.target.value })} style={{ ...s.input, padding: "6px 8px", fontSize: 12.5, flex: "1 1 180px" }}><option value="">Transferir a aprovação para…</option>
                  {(pessoas?.aprovadores || []).filter((u) => String(u.id) !== String(ver.fluxo.aprovador?.id) && String(u.id) !== String(ver.fluxo.verificador?.id) && String(u.id) !== String(ver.fluxo.elaborado?.usuario_id)).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select>
                <input value={acao.comentario} onChange={(e) => setAcao({ ...acao, comentario: e.target.value })} placeholder="Motivo (opcional) — ex.: férias" style={{ ...s.input, padding: "6px 8px", fontSize: 12.5, flex: "2 1 180px" }} /></span>
              : acao.tipo === "aprovar" ? <span style={{ flex: 1, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><span>Aprovar {ver.codigo} e assinar eletronicamente com o seu login? {ver.rascunho ? "A revisão atual vai para o histórico." : "O documento passa a vigente."}</span><label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>Próxima análise crítica (opcional): <input type="date" value={acao.proxima || ""} onChange={(e) => setAcao({ ...acao, proxima: e.target.value })} style={{ ...s.input, padding: "4px 6px", fontSize: 12.5, width: "auto" }} /></label></span>
              : <input autoFocus value={acao.comentario} onChange={(e) => setAcao({ ...acao, comentario: e.target.value })} placeholder={acao.tipo === "devolver" ? "O que precisa ser ajustado? (obrigatório)" : "Comentário (opcional)"} style={{ ...s.input, flex: 1, padding: "6px 8px", fontSize: 12.5 }} />}
            <button type="button" onClick={() => setAcao(null)} style={{ ...s.btn(false), padding: "5px 10px", cursor: "pointer", color: C.text }}>Cancelar</button>
            <button type="button" disabled={ocup || (acao.tipo === "devolver" && !acao.comentario.trim()) || (acao.tipo === "transferir" && !acao.para)} onClick={() => acao.tipo === "transferir" ? fazer(`/pessoas/gestao/${ver.id}/transferir-aprovacao`, { para: acao.para, motivo: acao.comentario || null }, `Aprovação de ${ver.codigo} transferida — a pessoa recebeu o aviso.`) : acao.tipo === "aprovar" ? fazer(`/pessoas/gestao/${ver.id}/aprovar-fluxo`, { proxima_revisao: acao.proxima || null }, `${ver.codigo} aprovado e assinado — vigente.`) : acao.tipo === "verificar" ? fazer(`/pessoas/gestao/${ver.id}/verificar`, { comentario: acao.comentario }, `${ver.codigo} verificado — seguiu para aprovação.`) : fazer(`/pessoas/gestao/${ver.id}/devolver`, { comentario: acao.comentario }, `${ver.codigo} devolvido para ajuste.`)}
              style={{ ...s.btn(true), padding: "5px 12px", cursor: "pointer" }}>{ocup ? "…" : acao.tipo === "transferir" ? "↪️ Transferir" : acao.tipo === "aprovar" ? "✍ Aprovar" : acao.tipo === "verificar" ? "✓ Verificar" : "↩ Devolver"}</button>
          </div>}
        </div>}
        {ver.status === "vigente" && leit && <div style={{ ...s.card, background: C.surface, padding: "10px 12px", marginTop: 10, fontSize: 12.5 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ flex: 1 }}>👥 Leitura da {rev(leit.revisao)}: {leit.leituras.length} pessoa(s){leit.destinatarios ? ` · funcionários: ${leit.destinatarios.lidos.length} de ${leit.destinatarios.total}` : ""}</b>
            {leit.eu_li ? <span style={s.tag(C.success)}>✓ Você leu esta revisão</span> : <button type="button" onClick={lerEntendi} style={{ ...s.btn(true), padding: "6px 12px", fontSize: 12.5, cursor: "pointer" }}>✓ Li e entendi</button>}
          </div>
          {leit.destinatarios?.lidos?.length > 0 && <div style={{ color: C.success, marginTop: 4 }}>✓ Leram: {leit.destinatarios.lidos.map((p) => `${p.nome} (${new Date(p.em).toLocaleDateString("pt-BR")})`).join(" · ")}</div>}
          {leit.destinatarios?.pendentes?.length > 0 && <div style={{ color: C.warn, marginTop: 4 }}>⏳ Faltam: {leit.destinatarios.pendentes.map((p) => `${p.nome}${p.sem_login ? " (sem login)" : ""}`).join(" · ")}</div>}
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
          <button type="button" onClick={async () => { try { setHist((await apiService.get(`/pessoas/gestao/${ver.id}/versoes`)).versoes || []); } catch (e) { onErro?.(e?.response?.data?.erro || e.message); } }} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>🗂 Histórico</button>
          {editar && ver.status === "vigente" && !["verificacao", "aprovacao"].includes(ver.fluxo?.etapa) && <button type="button" onClick={() => abrirRevisao(ver)} style={{ ...s.btn(false), cursor: "pointer", color: C.accent }}>{ver.rascunho ? `✎ Continuar Rev. ${String((ver.revisao || 0) + 1).padStart(2, "0")}` : "↻ Nova revisão"}</button>}
          {ver.arquivo_url && <button type="button" onClick={() => setArq({ url: ver.arquivo_url, nome: ver.arquivo_nome, mime: ver.arquivo_mime })} style={{ ...s.btn(false), cursor: "pointer", color: C.accent }}>📎 Arquivo anexo</button>}
          <button type="button" onClick={() => { try { imprimirDocGestao(ver); } catch (e) { onErro?.(e.message); } }} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>🖨 Imprimir / PDF</button>
          <button type="button" onClick={() => setVer(null)} style={{ ...s.btn(true), cursor: "pointer" }}>Fechar</button>
        </div>
      </div>
    </div>}
    {arq && <VerArquivo C={C} s={s} arquivo={arq} onFechar={() => setArq(null)} z={90} />}

    {modalDist && form && <div onClick={() => setModalDist(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 110, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }}>{/* 18zz.4 */}
      <div onClick={(e) => e.stopPropagation()} role="dialog" style={{ ...s.card, background: C.surface, width: "min(480px, 100%)", padding: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{modalDist === "perfis" ? "👤 Perfis que devem ler" : "🧩 Funções que devem ler"}</div>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8 }}>
          {(modalDist === "perfis" ? PERFIS.map((p) => ({ id: p.codigo, nome: p.label })) : (funcoes || []).map((f) => ({ id: String(f.id), nome: f.nome }))).map((it, i, arr) => { const on = ((form.distribuicao || {})[modalDist] || []).map(String).includes(String(it.id));
            return <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{it.nome}</span><Toggle C={C} ligado={on} onChange={() => togDist(modalDist, it.id)} /></div>; })}
          {modalDist === "funcoes" && !funcoes && <div style={{ padding: 12, color: C.muted }}>Carregando…</div>}
          {modalDist === "funcoes" && funcoes && !funcoes.length && <div style={{ padding: 12, color: C.muted }}>Nenhuma função cadastrada.</div>}
        </div>
        <div style={{ fontSize: 12.5, color: C.textSub, marginTop: 10 }}>👥 {alcance == null ? "Calculando…" : `Esperados: ${alcance.total} funcionário(s)${alcance.sem_login ? ` · ${alcance.sem_login} sem login` : ""}`}</div>
        <div style={{ textAlign: "right", marginTop: 12 }}><button type="button" onClick={() => setModalDist(null)} style={{ ...s.btn(true), cursor: "pointer" }}>Pronto</button></div>
      </div>
    </div>}
    {env && pessoas && <div onClick={() => !ocup && setEnv(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }}>{/* 18zv */}
      <div onClick={(e) => e.stopPropagation()} role="dialog" style={{ ...s.card, background: C.surface, width: "min(520px, 100%)", padding: 22 }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>📤 Enviar {env.codigo} para aprovação</div>
        <div style={{ fontSize: 12, color: C.textSub, margin: "4px 0 12px" }}>Você assina como <b>elaborador</b> agora. O texto fica travado até ser aprovado ou devolvido; cada pessoa recebe um aviso (🔔 e e-mail).</div>
        <label style={{ display: "block", marginBottom: 10 }}><span style={s.label}>VERIFICAÇÃO (OPCIONAL)</span>
          <select value={env.verificador_id} onChange={(e) => setEnv({ ...env, verificador_id: e.target.value })} style={s.input}><option value="">— sem verificação (vai direto para a aprovação)</option>
            {pessoas.verificadores.filter((u) => String(u.id) !== String(pessoas.eu) && String(u.id) !== String(env.aprovador_id)).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></label>
        <label style={{ display: "block", marginBottom: 10 }}><span style={s.label}>APROVAÇÃO</span>
          <select value={env.aprovador_id} onChange={(e) => setEnv({ ...env, aprovador_id: e.target.value })} style={s.input}><option value="">Escolha quem aprova…</option>
            {todosUsuarios.map((u) => <option key={u.id} value={u.id} disabled={!u.pode}>{u.nome}{String(u.id) === String(pessoas.eu) ? " (você)" : ""}{u.pode ? "" : " — sem perfil de aprovação"}</option>)}</select>
          {String(env.aprovador_id) === String(pessoas.eu) && <div style={{ fontSize: 11.5, color: C.warn, marginTop: 4 }}>Você está enviando e vai aprovar — fica registrado no histórico (sem segregação de funções).</div>}
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>Para aprovar, o login precisa ter perfil admin, gestor ou qualidade (Administração → Usuários).</div></label>
        <label style={{ display: "block" }}><span style={s.label}>MENSAGEM (OPCIONAL)</span><input value={env.comentario} onChange={(e) => setEnv({ ...env, comentario: e.target.value })} style={s.input} placeholder="Ex.: incluí a etapa de quarentena" /></label>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" disabled={ocup} onClick={() => setEnv(null)} style={{ ...s.btn(false), flex: 1, cursor: "pointer", color: C.text }}>Cancelar</button>
          <button type="button" disabled={ocup || !env.aprovador_id} onClick={() => fazer(`/pessoas/gestao/${env.id}/enviar`, { verificador_id: env.verificador_id || null, aprovador_id: env.aprovador_id, comentario: env.comentario }, `${env.codigo} enviado — ${env.verificador_id ? "aguardando verificação" : "aguardando aprovação"}.`)} style={{ ...s.btn(true), flex: 1, cursor: "pointer" }}>{ocup ? "Enviando…" : "📤 Enviar"}</button>
        </div>
      </div>
    </div>}
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
            <div style={{ flex: "1 1 160px" }}><span style={s.label}>ELABORADO POR</span><CampoFuncionario C={C} s={s} lista={pessoas?.funcionarios ?? null} nome={revi.elaborado_por} id={revi.elaborado_por_id} usuarioId={revi.elaborado_por_usuario_id} onChange={(v) => setRevi((r) => ({ ...r, elaborado_por: v.nome, elaborado_por_id: v.id, elaborado_por_usuario_id: v.usuario_id }))} /></div>
            
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
          <button type="button" disabled={ocup || !revi.motivo.trim()} title={revi.motivo.trim() ? "" : "Descreva o que mudou"} onClick={async () => { await salvarRevi(false); abrirEnvio({ id: revi.id, codigo: revi.codigo, rascunho: { aprovado_por_usuario_id: revi.aprovado_por_usuario_id } }); }} style={{ ...s.btn(true), cursor: "pointer", opacity: revi.motivo.trim() ? 1 : 0.5 }}>📤 Salvar e enviar para aprovação</button>
        </div>
      </div>
    </div>}
    {descartar && <ConfirmarExclusao C={C} s={s} titulo="Descartar esta revisão?" texto="O rascunho é apagado; a revisão vigente continua igual." rotulo="Descartar" ocupado={ocup} z={95}
      onCancelar={() => setDescartar(false)} onConfirmar={async () => { setOcup(true); try { await apiService.delete(`/pessoas/gestao/${revi.id}/rascunho`); setDescartar(false); setRevi(null); onAviso?.("Revisão descartada."); carregar(); } catch (e) { onErro?.(e?.response?.data?.erro || e.message); } finally { setOcup(false); } }} />}

    {form && <div onClick={() => !ocup && setForm(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 80, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" style={{ ...s.card, background: C.surface, width: "min(760px, 100%)", padding: 22 }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{form.id ? `Editar ${form.codigo}` : "Novo documento de gestão"}</div>
        {form.status === "rascunho" && <div style={{ fontSize: 12, color: C.textSub, marginBottom: 12 }}>{/* 18zz.9 */}Caminho: <b>1</b> Salvar rascunho (quantas vezes quiser) → <b>2</b> 📤 Enviar para aprovação (texto trava) → <b>3</b> o aprovador assina → fica <b>Vigente</b> e, se houver leitura obrigatória, vai para os colaboradores.</div>}
        {form.status === "vigente" && form.status_original !== "vigente" && form.status_original !== "obsoleto" && <div style={{ fontSize: 12, color: C.warn, marginBottom: 12 }}>Vigente direto só para documento <b>já aprovado fora do sistema</b> — informe abaixo quem aprovou e quando. Documento novo: deixe em Rascunho e envie para aprovação.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("CÓDIGO", inp("codigo", { placeholder: "PQ-01" }), "0 1 120px")}
            {campo("TÍTULO", inp("titulo", { placeholder: "Controle de não conformidades", disabled: travado }), "3 1 260px")}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("TIPO", <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={s.input}>{ORDEM.map((t) => <option key={t} value={t}>{d.tipos[t]}</option>)}</select>)}
            {campo("ÁREA / PROCESSO", inp("area", { placeholder: "Qualidade, Operação…" }))}
            {campo("REVISÃO", <input type="number" min={0} disabled={travado} value={form.revisao} onChange={(e) => setForm({ ...form, revisao: e.target.value === "" ? "" : Number(e.target.value) })} style={s.input} />, "0 1 90px")}
            {campo("SITUAÇÃO", <select value={form.status} disabled={!!(form.fluxo && form.fluxo.etapa !== "elaboracao")} onChange={(e) => setForm({ ...form, status: e.target.value })} style={s.input}>{opcoesSituacao.map((k) => <option key={k} value={k}>{k === "vigente" && form.status_original !== "vigente" && form.status_original !== "obsoleto" ? "Vigente (já aprovado fora)" : d.status[k]}</option>)}</select>, "0 1 200px")}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("ELABORADO POR", <CampoFuncionario C={C} s={s} lista={pessoas?.funcionarios ?? null} nome={form.elaborado_por} id={form.elaborado_por_id} usuarioId={form.elaborado_por_usuario_id} onChange={(v) => setForm((f) => ({ ...f, elaborado_por: v.nome, elaborado_por_id: v.id, elaborado_por_usuario_id: v.usuario_id }))} />)}
          </div>
          {/* 18zz.7 (Marcony): "Aprovado por/em" = quem aprovou, quando aprovou (no fluxo). À mão só para registrar documento JÁ aprovado fora do sistema. Próxima análise crítica: quem aprova decide (opcional). */}
          {form.assinaturas?.lista?.length ? <div style={{ fontSize: 12.5, color: C.textSub }}>✍ Aprovado no sistema{form.aprovado_por ? ` por ${form.aprovado_por}` : ""}{form.aprovado_em ? ` em ${dBR(form.aprovado_em)}` : ""} — vem da assinatura, não se edita.{form.proxima_revisao ? ` · próxima análise crítica: ${dBR(form.proxima_revisao)}` : ""}</div>
            : form.status === "vigente" ? <div style={{ border: `1px dashed ${C.border}`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 12, color: C.textSub, marginBottom: 8 }}>📄 Documento <b>já aprovado fora do sistema</b> (papel, outro sistema): registre quem aprovou e quando. Documento novo → deixe como Rascunho e use ✉ Enviar para aprovação.</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {campo("APROVADO POR", <CampoFuncionario C={C} s={s} lista={pessoas?.funcionarios ?? null} nome={form.aprovado_por} id={form.aprovado_por_id} usuarioId={form.aprovado_por_usuario_id} onChange={(v) => setForm((f) => ({ ...f, aprovado_por: v.nome, aprovado_por_id: v.id, aprovado_por_usuario_id: v.usuario_id }))} />)}
                {campo("APROVADO EM", inp("aprovado_em", { type: "date" }), "0 1 150px")}
              </div></div>
            : form.fluxo && form.fluxo.etapa !== "elaboracao" ? <div style={{ fontSize: 12.5, color: C.textSub }}>✍ Aprovação com <b>{form.fluxo.aprovador?.nome}</b> (em andamento) — para trocar, use ↪️ Transferir no 👁 Ver.</div>
            : <div style={{ fontSize: 11.5, color: C.muted, marginTop: -4 }}>Quem aprova você escolhe ao clicar em 📤 Salvar e enviar para aprovação. A data e a assinatura entram quando essa pessoa aprovar.</div>}
          {/* 18zz.2: 📣 leitura obrigatória dos colaboradores (app do colaborador → 📘 Procedimentos) */}
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Toggle C={C} ligado={!!form.distribuicao} onChange={(v) => { setForm({ ...form, distribuicao: v ? { todos: true, funcoes: [] } : null }); if (v && !funcoes) apiService.get("/pessoas/funcoes").then((r) => setFuncoes(r.funcoes || [])).catch(() => setFuncoes([])); }} />
              <div style={{ fontSize: 13 }}><b>📣 Leitura obrigatória dos colaboradores</b><div style={{ fontSize: 11.5, color: C.muted }}>Aparece no app do colaborador (📘 Procedimentos) para confirmar "Li e entendi" — a cada nova revisão.</div></div>
            </div>
            {form.distribuicao && <div style={{ marginTop: 10, fontSize: 12.5 }}>{/* 18zz.4: Todos · Perfis · Funções (toggles + modais) */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Toggle C={C} ligado={!!form.distribuicao.todos} onChange={(v) => setDist({ todos: v, perfis: [], funcoes: [] })} /><span><b>Todos os funcionários</b></span></div>
              {!form.distribuicao.todos && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <button type="button" onClick={() => setModalDist("perfis")} style={{ ...s.btn(false), cursor: "pointer", padding: "6px 12px", fontSize: 12.5, color: C.text }}>👤 Perfis{(form.distribuicao.perfis || []).length ? ` (${form.distribuicao.perfis.length})` : ""}</button>
                <button type="button" onClick={() => { setModalDist("funcoes"); if (!funcoes) apiService.get("/pessoas/funcoes").then((r) => setFuncoes(r.funcoes || [])).catch(() => setFuncoes([])); }} style={{ ...s.btn(false), cursor: "pointer", padding: "6px 12px", fontSize: 12.5, color: C.text }}>🧩 Funções{(form.distribuicao.funcoes || []).length ? ` (${form.distribuicao.funcoes.length})` : ""}</button>
                {(form.distribuicao.perfis || []).map((p) => <span key={p} style={s.tag(C.accent)}>{PERFIS.find((x) => x.codigo === p)?.label || p}</span>)}
                {(form.distribuicao.funcoes || []).length > 0 && funcoes && form.distribuicao.funcoes.map((id) => <span key={id} style={s.tag(C.textSub)}>{funcoes.find((f) => String(f.id) === String(id))?.nome || "função"}</span>)}
              </div>}
              <div style={{ marginTop: 8, fontSize: 12.5, color: alcance?.total ? C.text : C.warn }}>👥 {alcance == null ? "Calculando…" : <>Esperados: <b>{alcance.total}</b> funcionário(s){alcance.sem_login ? <span style={{ color: C.warn }}> · {alcance.sem_login} sem login (não conseguem confirmar no app)</span> : ""}</>}</div>
            </div>}
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
          <button type="button" disabled={ocup} onClick={() => salvar(false)} style={{ ...s.btn(!podeEnviarForm), flex: 1, cursor: "pointer", ...(podeEnviarForm ? { color: C.accent } : {}) }}>{ocup ? "Salvando…" : podeEnviarForm ? "Salvar rascunho" : "Salvar"}</button>
          {podeEnviarForm && <button type="button" disabled={ocup} onClick={() => salvar(true)} style={{ ...s.btn(true), flex: 1.4, cursor: "pointer" }}>📤 Salvar e enviar para aprovação</button>}
        </div>
      </div>
    </div>}
    {apagar && <ConfirmarExclusao C={C} s={s} titulo={`Excluir ${apagar.codigo}?`} texto={`${apagar.titulo} — ${apagar.status === "rascunho" ? "rascunho" : "obsoleto"}. Não dá para desfazer.`} ocupado={ocup} z={90}
      onCancelar={() => setApagar(null)} onConfirmar={async () => { setOcup(true); try { await apiService.delete(`/pessoas/gestao/${apagar.id}`); setApagar(null); onAviso?.("Documento excluído."); carregar(); } catch (e) { onErro?.(e?.response?.data?.erro || e.message); } finally { setOcup(false); } }} />}
  </div>;
}
const STATUS_TXT = { rascunho: "Rascunho", vigente: "Vigente", obsoleto: "Obsoleto" };
