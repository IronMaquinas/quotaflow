// components/pessoas/TelaTreinamentos.jsx — etapa 12e.1
// Aba "🎓 Treinamentos" de Pessoas. Sub-abas:
//   👷 Por colaborador — treinamentos exigidos pela função × o que cada um fez (✓ em dia · ⚠ vence em 30 d · 🔴 vencido ·
//      📅 agendado · ✗ falta), com "Agendar" já trazendo quem precisa.
//   📅 Turmas e registros — turma (presencial/online) com LISTA DE PRESENÇA ASSINADA na tela, concluir/cancelar,
//      🖨 lista de presença (PDF); "Registrar treinamento já realizado" (manual: participantes + evidência anexa).
//   📚 Catálogo — treinamentos da empresa (norma, carga horária, validade, conteúdo programático).
//   ⏱ Horas (12e.2a) — horas creditadas por colaborador no período, por tipo (regulatório · integração · desenvolvimento).
// 12e.2a: conteúdo em seções (texto, vídeo, material) + prova no catálogo; "📚 Importar da biblioteca" do QuotaFlow
//   e "✨ Versão nova".
// 12e.2b: turma ONLINE — o colaborador faz a prova logado ("🎓 Meus treinamentos") ou pelo 🔗 link (CPF + nascimento);
//   na turma: situação da prova por participante, "↻ Liberar tentativas" e o link para copiar. PDF de apoio enviado.
import { useState, useEffect, useMemo } from "react";
import EditorConteudoTreinamento, { limparConteudo } from "../shared/EditorConteudoTreinamento";
import apiService from "../../services/apiService";
import AssinaturaTela from "../shared/AssinaturaTela";
import { abrirListaPresenca, prepararJanela } from "../../utils/gerarListaPresenca";
import { abrirCertificado, abrirAvaliacao, prepararJanela as janelaCert } from "../../utils/gerarCertificado"; // 12e.2c
import { prepararArquivo } from "../../utils/comprimirImagem"; // 14c.1: foto comprimida antes de enviar

const SIT = {
  ok:       { l: "Em dia",   i: "✓",  c: "#22c55e" },
  vence:    { l: "Vence em breve", i: "⚠", c: "#f59e0b" },
  vencido:  { l: "Vencido",  i: "🔴", c: "#ef4444" },
  agendado: { l: "Agendado", i: "📅", c: "#3b82f6" },
  falta:    { l: "Falta",    i: "✗",  c: "#94a3b8" },
};
const MOD = { presencial: "Presencial", online: "Online", manual: "Registro manual" };
const ST = { agendada: { l: "Agendada", c: "#3b82f6" }, concluida: { l: "Concluída", c: "#22c55e" }, cancelada: { l: "Cancelada", c: "#64748b" } };
const TIPO = { regulatorio: "Regulatório (NR, ANTT…)", integracao: "Integração", desenvolvimento: "Desenvolvimento" };
const dataBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fmtH = (n) => `${Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
const lerArquivo = (file) => new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => falha(new Error("Não foi possível ler o arquivo")); r.readAsDataURL(file); });

export default function TelaTreinamentos({ C, s, modal, campo, colabs = [], onAviso, onErro, onMudou }) {
  const [vista, setVista] = useState("colaborador");
  const [cat, setCat] = useState(null);          // { treinamentos, pode_editar }
  const [painel, setPainel] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [semMigration, setSemMigration] = useState(false);
  const [busca, setBusca] = useState("");
  const [formTr, setFormTr] = useState(null);    // catálogo
  const [formTurma, setFormTurma] = useState(null); // nova turma / registro manual
  const [turma, setTurma] = useState(null);      // detalhe { turma, participantes }
  const [assinando, setAssinando] = useState(null); // participante
  const [assinatura, setAssinatura] = useState(null);
  const [addPart, setAddPart] = useState(null);  // ids selecionados para adicionar
  const [confirmar, setConfirmar] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [bib, setBib] = useState(null);           // 12e.2a: modelos da biblioteca do QuotaFlow
  const [horas, setHoras] = useState(null);       // 12e.2a: relatório de horas
  const [periodo, setPeriodo] = useState(() => { const a = hoje().slice(0, 4); return { de: `${a}-01-01`, ate: `${a}-12-31` }; });

  const carregar = async () => {
    try {
      const [c, p, t] = await Promise.all([apiService.get("/pessoas/treinamentos"), apiService.get("/pessoas/treinamentos/painel"), apiService.get("/pessoas/treinamentos/turmas")]);
      setCat(c); setPainel(p?.colaboradores || []); setTurmas(t?.turmas || []); setSemMigration(false);
    } catch (e) { if (/03[01]/.test(e.message || "")) setSemMigration(e.message); else onErro(e.message); }
  };
  const carregarHoras = async (p = periodo) => {
    try { setHoras(await apiService.get(`/pessoas/treinamentos/horas?de=${p.de}&ate=${p.ate}`)); } catch (e) { onErro(e.message); }
  };
  useEffect(() => { if (vista === "horas") carregarHoras(); }, [vista]); // eslint-disable-line
  const abrirBiblioteca = async () => {
    try { setBib((await apiService.get("/pessoas/treinamentos/biblioteca"))?.modelos || []); } catch (e) { onErro(e.message); }
  };
  const importar = async (m) => {
    setSalvando(true);
    try { await apiService.post("/pessoas/treinamentos/importar", { biblioteca_id: m.id }); onAviso(`“${m.nome}” importado para o catálogo. Marque em 👔 Funções quem precisa.`); await abrirBiblioteca(); await recarregarTudo(); }
    catch (e) { onErro(e.message); }
    finally { setSalvando(false); }
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line
  const recarregarTudo = async () => { await carregar(); onMudou?.(); };

  const treinos = cat?.treinamentos || [];
  const editar = !!cat?.pode_editar;
  const ativos = colabs.filter((c) => c.situacao !== "desligado");
  // quem precisa de cada treinamento (falta/vencido/vence), para sugerir na turma
  const precisam = (codigo) => painel.filter((c) => c.itens.some((i) => i.codigo === codigo && ["falta", "vencido", "vence"].includes(i.situacao))).map((c) => String(c.id));

  const abrirTurma = async (id) => {
    try { setTurma(await apiService.get(`/pessoas/treinamentos/turmas/${id}`)); } catch (e) { onErro(e.message); }
  };
  const novaTurma = (manual, trCodigo) => {
    const tr = trCodigo ? treinos.find((t) => t.codigo === trCodigo) : null;
    setFormTurma({ modalidade: manual ? "manual" : "presencial", treinamento_id: tr ? String(tr.id) : "", data: manual ? "" : "", data_fim: "", carga_horaria: "", instrutor: "", local: "", obs: "",
      participantes: tr ? precisam(tr.codigo) : [], arquivo: null, buscaP: "" });
  };
  const salvarTurma = async () => {
    setSalvando(true);
    try {
      const f = formTurma;
      const corpo = { treinamento_id: f.treinamento_id, data: f.data, data_fim: f.data_fim || null, modalidade: f.modalidade, carga_horaria: f.carga_horaria, instrutor: f.instrutor, local: f.local, obs: f.obs, participantes: f.participantes };
      if (f.modalidade === "manual") {
        if (!f.arquivo) throw new Error("Anexe a evidência");
        if (f.arquivo.size > 10 * 1024 * 1024) throw new Error("Arquivo maior que 10 MB");
        corpo.evidencia_base64 = await lerArquivo(f.arquivo); corpo.evidencia_mime = f.arquivo.type; corpo.evidencia_nome = f.arquivo.name;
      }
      const r = await apiService.post("/pessoas/treinamentos/turmas", corpo);
      setFormTurma(null);
      onAviso(f.modalidade === "manual" ? "Treinamento registrado com a evidência." : "Turma agendada — na data, abra a turma e colha as assinaturas.");
      await recarregarTudo();
      if (f.modalidade !== "manual" && r?.turma?.id) { setVista("turmas"); await abrirTurma(r.turma.id); }
    } catch (e) { onErro(e.message); }
    finally { setSalvando(false); }
  };
  const confirmarAssinatura = async () => {
    setSalvando(true);
    try {
      await apiService.post(`/pessoas/treinamentos/turmas/${turma.turma.id}/assinar`, { colaborador_id: assinando.colaborador_id, assinatura_png: assinatura });
      onAviso(`${assinando.nome} assinou a presença.`); setAssinando(null); setAssinatura(null);
      await abrirTurma(turma.turma.id); await recarregarTudo();
    } catch (e) { onErro(e.message); }
    finally { setSalvando(false); }
  };
  const acaoTurma = async (acao, msg) => {
    try { const r = await apiService.post(`/pessoas/treinamentos/turmas/${turma.turma.id}/${acao}`); onAviso(acao === "concluir" ? `Turma concluída: ${r?.presentes || 0} presente(s)${r?.faltaram ? `, ${r.faltaram} faltou(aram)` : ""}.` : msg); await abrirTurma(turma.turma.id); await recarregarTudo(); }
    catch (e) { onErro(e.message); }
  };
  const imprimirLista = async (id) => {
    const janela = prepararJanela();
    try { abrirListaPresenca(await apiService.get(`/pessoas/treinamentos/turmas/${id}/lista-presenca`), janela); }
    catch (e) { try { janela?.close(); } catch { /* ok */ } onErro(e.message); }
  };
  const imprimir = async (tipo, turmaId, colabId) => { // 12e.2c: certificado / comprovante da avaliação
    const janela = janelaCert(tipo === "certificado" ? "Gerando o certificado…" : "Gerando o comprovante…");
    try {
      const d = await apiService.get(`/pessoas/treinamentos/turmas/${turmaId}/${tipo}/${colabId}`);
      (tipo === "certificado" ? abrirCertificado : abrirAvaliacao)(d, janela);
    } catch (e) { try { janela?.close(); } catch { /* ok */ } onErro(e.message); }
  };
  const abrirEvidencia = async (id) => {
    try { const r = await apiService.get(`/pessoas/treinamentos/turmas/${id}/evidencia`); if (r?.url) window.open(r.url, "_blank", "noopener"); } catch (e) { onErro(e.message); }
  };
  const salvarTr = async () => {
    setSalvando(true);
    try {
      const f = formTr; const corpo = { nome: f.nome, norma: f.norma, carga_horaria: f.carga_horaria, validade_meses: f.validade_meses, tipo: f.tipo, conteudo: f.conteudo, ...limparConteudo(f) };
      if (f.id) await apiService.put(`/pessoas/treinamentos/${f.id}`, corpo); else await apiService.post("/pessoas/treinamentos", corpo);
      setFormTr(null); onAviso("Treinamento salvo."); await recarregarTudo();
    } catch (e) { onErro(e.message); }
    finally { setSalvando(false); }
  };

  const resumo = useMemo(() => ({
    total: painel.length, vencido: painel.filter((c) => c.resumo.vencido).length, falta: painel.filter((c) => c.resumo.falta).length,
    agendadas: turmas.filter((t) => t.status === "agendada").length,
    horas: Math.round(painel.reduce((n, c) => n + (c.horas_ano || 0), 0) * 10) / 10,
  }), [painel, turmas]);

  if (semMigration) return <div style={{ ...s.card, padding: 24, color: C.textSub }}>{/031/.test(String(semMigration)) ? <>Rode a migration <b>031_treinamentos_conteudo_horas.sql</b> no Supabase (conteúdo, prova e horas).</> : <>Rode a migration <b>030_treinamentos.sql</b> no Supabase para usar os treinamentos.</>}</div>;
  if (!cat) return <div style={{ color: C.muted }}>Carregando…</div>;

  const sub = (id, l) => (
    <button key={id} onClick={() => setVista(id)} style={{ ...s.btn(vista === id), cursor: "pointer", padding: "6px 14px", fontSize: 12, ...(vista !== id ? { color: C.text } : {}) }}>{l}</button>
  );
  const b = semAcento(busca.trim());

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>{sub("colaborador", "👷 Por colaborador")}{sub("turmas", "📅 Turmas e registros")}{sub("horas", "⏱ Horas")}{sub("catalogo", "📚 Catálogo")}</div>

      {/* ─── 👷 por colaborador ─── */}
      {vista === "colaborador" && (<>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          {[["Colaboradores", resumo.total, C.accent], ["Com treinamento vencido", resumo.vencido, SIT.vencido.c], ["Com treinamento faltando", resumo.falta, SIT.falta.c], ["Turmas agendadas", resumo.agendadas, SIT.agendado.c], [`Horas de treinamento em ${hoje().slice(0, 4)}`, fmtH(resumo.horas), "#a855f7"]].map(([l, n, cor]) => (
            <div key={l} style={{ ...s.card, padding: "10px 16px" }}><div style={{ fontSize: 22, fontWeight: 700, color: cor }}>{n}</div><div style={{ fontSize: 11, color: C.textSub }}>{l}</div></div>
          ))}
        </div>
        {treinos.length === 0 && <div style={{ ...s.card, padding: 16, color: C.textSub, marginBottom: 12 }}>Comece pelo 📚 Catálogo: cadastre os treinamentos da empresa e marque, em 👔 Funções, quais cada função exige.</div>}
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar colaborador ou função…" style={{ ...s.input, maxWidth: 320, padding: "7px 10px", fontSize: 12, marginBottom: 12 }} />
        <div style={{ display: "grid", gap: 10 }}>
          {painel.filter((c) => !b || semAcento(`${c.nome} ${c.funcao_nome || ""}`).includes(b)).map((c) => (
            <div key={c.id} style={{ ...s.card, padding: "12px 16px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 220px" }}><div style={{ fontWeight: 700, fontSize: 14 }}>{c.nome}</div><div style={{ fontSize: 12, color: C.textSub }}>{c.funcao?.nome || c.funcao_nome || "Sem função"}</div></div>
                {c.resumo.total > 0 && <span style={{ fontSize: 12, color: C.textSub }}>{c.resumo.ok + c.resumo.vence}/{c.resumo.total} em dia</span>}
                <span title={`Horas de treinamento creditadas em ${hoje().slice(0, 4)}`} style={s.tag("#a855f7")}>⏱ {fmtH(c.horas_ano)}</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {c.itens.length === 0 && <span style={{ fontSize: 12, color: C.muted }}>{c.funcao ? "A função não exige treinamentos — marque em 👔 Funções." : "Sem função ligada."}</span>}
                {c.itens.map((i) => {
                  const sc = SIT[i.situacao];
                  const det = i.situacao === "agendado" ? `turma ${dataBR(i.agendado.data)}` : i.situacao === "falta" ? "não realizado" : i.valido_ate ? (i.dias < 0 ? `venceu ${dataBR(i.valido_ate)}` : `válido até ${dataBR(i.valido_ate)}`) : "sem vencimento";
                  return (
                    <button key={i.codigo} onClick={() => (["falta", "vencido", "vence"].includes(i.situacao) && i.existe ? (setVista("turmas"), novaTurma(false, i.codigo)) : i.agendado ? abrirTurma(i.agendado.turma_id) : i.ultimo ? abrirTurma(i.ultimo.turma_id) : null)}
                      title={["falta", "vencido", "vence"].includes(i.situacao) ? "Agendar turma com quem precisa deste treinamento" : i.ultimo || i.agendado ? "Abrir a turma (presença, nota, tentativas)" : ""}
                      style={{ ...s.tag(sc.c), cursor: "pointer", fontFamily: "inherit", border: "none" }}>{sc.i} {i.nome} · {det}</button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Clique num treinamento em dia ou agendado para abrir a turma (presença, nota, tentativas); faltando ou vencido, para agendar uma turma já com todos que precisam dele.</div>
      </>)}

      {/* ─── 📅 turmas ─── */}
      {vista === "turmas" && (<>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button onClick={() => novaTurma(false)} disabled={!treinos.length} style={{ ...s.btn(!!treinos.length), cursor: "pointer" }}>＋ Agendar turma</button>
          <button onClick={() => novaTurma(true)} disabled={!treinos.length} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>📝 Registrar treinamento já realizado</button>
        </div>
        <div style={{ fontSize: 12, color: C.textSub, marginBottom: 10 }}>
          <b style={{ color: C.text }}>Turma</b>: cada participante assina a presença na tela; depois, “Concluir”. <b style={{ color: C.text }}>Registro manual</b>: treinamento feito no modelo da empresa (instrutor e material internos) — escolha quem participou e anexe a evidência (lista escaneada, certificado).
        </div>
        {turmas.length === 0 ? <div style={{ ...s.card, padding: 24, textAlign: "center", color: C.textSub }}>Nenhuma turma ainda.</div> : (
          <div style={{ ...s.card, overflow: "hidden" }}>
            {turmas.map((t, n) => (
              <div key={t.id} onClick={() => abrirTurma(t.id)} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", borderBottom: n < turmas.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer", opacity: t.status === "cancelada" ? 0.5 : 1 }}>
                <div style={{ flex: "0 0 86px", fontSize: 12, fontWeight: 600 }}>{dataBR(t.data)}</div>
                <div style={{ flex: "2 1 220px" }}><div style={{ fontWeight: 600, fontSize: 13 }}>{t.treinamento_nome}</div><div style={{ fontSize: 12, color: C.textSub }}>{MOD[t.modalidade]}{t.instrutor ? ` · ${t.instrutor}` : ""}{t.carga_horaria ? ` · ${Number(t.carga_horaria).toLocaleString("pt-BR")} h` : ""}</div></div>
                <span style={{ fontSize: 12, color: C.textSub }}>{t.presentes}/{t.participantes} presente(s)</span>
                {t.tem_evidencia && <span style={s.tag(C.accent)}>📎 evidência</span>}
                <span style={s.tag(ST[t.status].c)}>{ST[t.status].l}</span>
              </div>
            ))}
          </div>
        )}
      </>)}

      {/* ─── ⏱ horas (12e.2a) ─── */}
      {vista === "horas" && (<>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
          {campo("DE", <input type="date" value={periodo.de} onChange={(e) => setPeriodo({ ...periodo, de: e.target.value })} style={s.input} />, "0 1 160px")}
          {campo("ATÉ", <input type="date" value={periodo.ate} onChange={(e) => setPeriodo({ ...periodo, ate: e.target.value })} style={s.input} />, "0 1 160px")}
          <button onClick={() => carregarHoras()} disabled={!periodo.de || !periodo.ate} style={{ ...s.btn(true), cursor: "pointer" }}>Atualizar</button>
        </div>
        <div style={{ fontSize: 12, color: C.textSub, marginBottom: 10 }}>Horas creditadas = carga horária da turma para quem esteve presente (ou foi aprovado na prova online), em turma concluída. Conta pela data da turma.</div>
        {!horas ? <div style={{ color: C.muted }}>Carregando…</div> : (<>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            {[["Total da empresa", fmtH(horas.totais.total), "#a855f7"], ["Média por colaborador ativo", fmtH(horas.totais.media_por_colaborador), C.accent],
              ...Object.entries(TIPO).map(([k, l]) => [l, fmtH(horas.totais.por_tipo[k]), C.textSub])].map(([l, n, cor]) => (
              <div key={l} style={{ ...s.card, padding: "10px 16px" }}><div style={{ fontSize: 20, fontWeight: 700, color: cor }}>{n}</div><div style={{ fontSize: 11, color: C.textSub }}>{l}</div></div>
            ))}
          </div>
          <div style={{ ...s.card, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ color: C.textSub, textAlign: "left" }}>
                <th style={{ padding: "8px 12px" }}>Colaborador</th><th style={{ padding: 8 }}>Função</th>
                {Object.values(TIPO).map((l) => <th key={l} style={{ padding: 8, textAlign: "right" }}>{l.split(" (")[0]}</th>)}
                <th style={{ padding: 8, textAlign: "right" }}>Treinamentos</th><th style={{ padding: "8px 12px", textAlign: "right" }}>Total</th>
              </tr></thead>
              <tbody>
                {horas.colaboradores.map((c) => (
                  <tr key={c.id} style={{ borderTop: `1px solid ${C.border}`, opacity: c.situacao === "desligado" ? 0.55 : 1 }}>
                    <td style={{ padding: "7px 12px", fontWeight: 600 }}>{c.nome}{c.situacao === "desligado" ? <span style={{ color: C.muted, fontWeight: 400 }}> (desligado)</span> : ""}</td>
                    <td style={{ padding: 7, color: C.textSub }}>{c.funcao_nome || "—"}</td>
                    {Object.keys(TIPO).map((k) => <td key={k} style={{ padding: 7, textAlign: "right", color: c.por_tipo[k] ? C.text : C.muted }}>{c.por_tipo[k] ? fmtH(c.por_tipo[k]) : "—"}</td>)}
                    <td style={{ padding: 7, textAlign: "right" }}>{c.treinamentos}</td>
                    <td style={{ padding: "7px 12px", textAlign: "right", fontWeight: 700 }}>{fmtH(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!horas.colaboradores.length && <div style={{ padding: 20, textAlign: "center", color: C.textSub }}>Nenhum colaborador.</div>}
          </div>
        </>)}
      </>)}

      {/* ─── 📚 catálogo ─── */}
      {vista === "catalogo" && (<>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: C.textSub, flex: "1 1 300px" }}>Treinamentos da empresa. Marque em 👔 Funções quais cada função exige. Conteúdo com vídeo e prova: o colaborador faz online (em breve).</div>
          {editar && <button onClick={abrirBiblioteca} style={{ ...s.btn(false), cursor: "pointer", color: C.accent }}>📚 Importar da biblioteca</button>}
          {editar && <button onClick={() => setFormTr({ nome: "", norma: "", carga_horaria: "", validade_meses: "", tipo: "regulatorio", conteudo: "", secoes: [], prova: null })} style={{ ...s.btn(true), cursor: "pointer" }}>＋ Novo treinamento</button>}
        </div>
        {treinos.length === 0 ? <div style={{ ...s.card, padding: 24, textAlign: "center", color: C.textSub }}>Nenhum treinamento. Ex.: Integração EHS, Direção defensiva, NR-6 (uso de EPI), MOPP/produtos perigosos, NR-35.</div> : (
          <div style={{ display: "grid", gap: 8 }}>
            {treinos.map((t) => (
              <div key={t.id} style={{ ...s.card, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: "2 1 240px" }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t.nome}{t.norma ? <span style={{ color: C.muted, fontWeight: 400 }}> · {t.norma}</span> : ""}</div>
                  <div style={{ fontSize: 12, color: C.textSub }}>{TIPO[t.tipo] || t.tipo}{t.carga_horaria ? ` · ${Number(t.carga_horaria).toLocaleString("pt-BR")} h` : ""} · {t.validade_meses ? `reciclagem a cada ${t.validade_meses} meses` : "não vence"}</div>
                </div>
                {t.origem_id != null && <span style={s.tag(C.accent)} title="Veio da biblioteca do QuotaFlow">📚 QuotaFlow</span>}
                {(t.secoes || []).length > 0 && <span style={s.tag("#64748b")}>📖 {t.secoes.length} seç.{t.secoes.some((x) => x.video_url) ? " · 🎬" : ""}</span>}
                {t.prova?.perguntas?.length > 0 && <span style={s.tag("#22c55e")}>📝 prova ({t.prova.perguntas.length})</span>}
                {editar && t.versao_nova && <button onClick={() => setConfirmar({ titulo: "Atualizar da biblioteca", texto: `Trazer a versão nova de “${t.nome}”? O conteúdo, a prova e a carga horária ficam iguais aos do QuotaFlow (o que você mudou aqui é substituído). Turmas já feitas não mudam.`, botao: "Atualizar", acao: async () => { await apiService.post(`/pessoas/treinamentos/${t.id}/atualizar`); return "Treinamento atualizado com a versão nova."; } })} style={{ ...s.btn(true, "#f59e0b"), cursor: "pointer", padding: "5px 10px", fontSize: 12 }}>✨ Versão nova</button>}
                {editar && <button onClick={() => setFormTr({ id: t.id, nome: t.nome, norma: t.norma || "", carga_horaria: t.carga_horaria ?? "", validade_meses: t.validade_meses ?? "", tipo: t.tipo || "regulatorio", conteudo: t.conteudo || "", secoes: t.secoes || [], prova: t.prova || null })} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.text }}>Editar</button>}
                {editar && <button onClick={() => setConfirmar({ titulo: "Tirar do catálogo", texto: `“${t.nome}” deixa de aparecer para novas turmas. O histórico das turmas já feitas fica.`, acao: async () => { await apiService.delete(`/pessoas/treinamentos/${t.id}`); return "Treinamento retirado do catálogo."; } })} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.danger }}>Tirar</button>}
              </div>
            ))}
          </div>
        )}
      </>)}

      {/* ─── modal catálogo ─── */}
      {formTr && modal(<>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>{formTr.id ? "Editar treinamento" : "Novo treinamento"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {campo("NOME", <input value={formTr.nome} onChange={(e) => setFormTr({ ...formTr, nome: e.target.value })} placeholder="ex.: Direção defensiva" style={s.input} />)}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("NORMA / REFERÊNCIA", <input value={formTr.norma} onChange={(e) => setFormTr({ ...formTr, norma: e.target.value })} placeholder="NR-35, Res. ANTT…" style={s.input} />, "1 1 160px")}
            {campo("CARGA HORÁRIA (H)", <input type="number" min={0.5} step="0.5" value={formTr.carga_horaria} onChange={(e) => setFormTr({ ...formTr, carga_horaria: e.target.value })} style={s.input} />, "1 1 110px")}
            {campo("RECICLAGEM (MESES)", <input type="number" min={1} max={240} value={formTr.validade_meses} onChange={(e) => setFormTr({ ...formTr, validade_meses: e.target.value })} placeholder="vazio = não vence" style={s.input} />, "1 1 140px")}
          </div>
          {campo("TIPO", <select value={formTr.tipo} onChange={(e) => setFormTr({ ...formTr, tipo: e.target.value })} style={s.input}>{Object.entries(TIPO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>)}
          {campo("CONTEÚDO PROGRAMÁTICO (RESUMO — VAI NA LISTA DE PRESENÇA)", <textarea rows={3} value={formTr.conteudo} onChange={(e) => setFormTr({ ...formTr, conteudo: e.target.value })} style={{ ...s.input, resize: "vertical" }} />)}
          <EditorConteudoTreinamento secoes={formTr.secoes || []} prova={formTr.prova} onChange={(v) => setFormTr((f) => ({ ...f, ...v }))}
            onEnviarPdf={async (base64, nome) => apiService.post("/pessoas/treinamentos/material", { base64, nome })}
            onVerPdf={async (path) => (await apiService.get(`/pessoas/treinamentos/material?path=${encodeURIComponent(path)}`))?.url}
            ui={{ text: C.text, sub: C.textSub, border: C.border, accent: C.accent, danger: C.danger, success: C.success || "#22c55e", input: s.input, label: s.label }} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={() => setFormTr(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          <button onClick={salvarTr} disabled={salvando || !formTr.nome.trim()} style={{ ...s.btn(!salvando && !!formTr.nome.trim()), flex: 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </>, () => setFormTr(null), 720)}

      {/* ─── modal biblioteca do QuotaFlow (12e.2a) ─── */}
      {bib && modal(<>
        <div style={{ fontSize: 17, fontWeight: 700 }}>📚 Biblioteca de treinamentos do QuotaFlow</div>
        <div style={{ fontSize: 12, color: C.textSub, margin: "4px 0 12px" }}>Importar traz uma cópia para o seu catálogo (conteúdo, vídeos e prova). Você pode ajustar depois; quando o QuotaFlow publicar versão nova, aparece “✨ Versão nova”.</div>
        {bib.length === 0 ? <div style={{ padding: 16, color: C.muted, textAlign: "center" }}>A biblioteca ainda está vazia.</div> : (
          <div style={{ display: "grid", gap: 8, maxHeight: "60vh", overflowY: "auto" }}>
            {bib.map((m) => (
              <div key={m.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: "2 1 240px" }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{m.nome}{m.norma ? <span style={{ color: C.muted, fontWeight: 400 }}> · {m.norma}</span> : ""}</div>
                  <div style={{ fontSize: 12, color: C.textSub }}>{TIPO[m.tipo] || m.tipo}{m.carga_horaria ? ` · ${fmtH(m.carga_horaria)}` : ""} · 📖 {m.secoes_qtd} seç.{m.videos_qtd ? ` · 🎬 ${m.videos_qtd}` : ""} · {m.perguntas_qtd ? `📝 ${m.perguntas_qtd} perguntas (mín. ${m.prova?.nota_minima}%)` : "sem prova"}</div>
                </div>
                {m.ja_importado
                  ? <span style={s.tag(m.versao_nova ? "#f59e0b" : "#22c55e")}>{m.versao_nova ? "✨ versão nova no catálogo" : "✓ no catálogo"}</span>
                  : <button disabled={salvando} onClick={() => importar(m)} style={{ ...s.btn(!salvando), cursor: "pointer", padding: "5px 12px", fontSize: 12 }}>Importar</button>}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", marginTop: 14 }}><button onClick={() => setBib(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Fechar</button></div>
      </>, () => setBib(null), 680)}

      {/* ─── modal nova turma / registro manual ─── */}
      {formTurma && (() => {
        const f = formTurma; const manual = f.modalidade === "manual";
        const tr = treinos.find((t) => String(t.id) === String(f.treinamento_id));
        const sugeridos = tr ? new Set(precisam(tr.codigo)) : new Set();
        const lista = ativos.filter((c) => !f.buscaP.trim() || semAcento(c.nome).includes(semAcento(f.buscaP.trim())))
          .sort((a, b2) => (sugeridos.has(String(b2.id)) - sugeridos.has(String(a.id))) || String(a.nome).localeCompare(String(b2.nome)));
        const ok = !salvando && f.treinamento_id && f.data && (!manual || (f.participantes.length && f.arquivo && f.data <= hoje()));
        return modal(<>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{manual ? "📝 Registrar treinamento já realizado" : "＋ Agendar turma"}</div>
          <div style={{ fontSize: 12, color: C.textSub, margin: "4px 0 14px" }}>{manual ? "Para treinamento feito no modelo da empresa. Anexe a evidência (lista de presença escaneada, certificado…)." : "Na data, abra a turma: cada participante assina a presença na tela."}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {campo("TREINAMENTO", <select value={f.treinamento_id} onChange={(e) => { const t2 = treinos.find((t) => String(t.id) === e.target.value); setFormTurma({ ...f, treinamento_id: e.target.value, participantes: f.participantes.length ? f.participantes : (t2 ? precisam(t2.codigo) : []), carga_horaria: f.carga_horaria || (t2?.carga_horaria ?? "") }); }} style={s.input}>
              <option value="">Escolha…</option>{treinos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select>)}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {campo(manual ? "REALIZADO EM" : "DATA", <input type="date" value={f.data} max={manual ? hoje() : undefined} onChange={(e) => setFormTurma({ ...f, data: e.target.value })} style={s.input} />, "1 1 150px")}
              {campo(f.modalidade === "online" ? "PRAZO PARA FAZER (ATÉ)" : "ATÉ (SE DUROU MAIS DE 1 DIA)", <input type="date" value={f.data_fim} min={f.data || undefined} onChange={(e) => setFormTurma({ ...f, data_fim: e.target.value })} style={s.input} />, "1 1 150px")}
              {!manual && campo("MODALIDADE", <select value={f.modalidade} onChange={(e) => setFormTurma({ ...f, modalidade: e.target.value })} style={s.input}><option value="presencial">Presencial</option><option value="online">Online</option></select>, "1 1 130px")}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {campo("INSTRUTOR", <input value={f.instrutor} onChange={(e) => setFormTurma({ ...f, instrutor: e.target.value })} placeholder="nome (interno ou externo)" style={s.input} />, "2 1 200px")}
              {campo("CARGA (H)", <input type="number" min={0.5} step="0.5" value={f.carga_horaria} onChange={(e) => setFormTurma({ ...f, carga_horaria: e.target.value })} style={s.input} />, "1 1 90px")}
              {campo("LOCAL", <input value={f.local} onChange={(e) => setFormTurma({ ...f, local: e.target.value })} style={s.input} />, "1 1 140px")}
            </div>
            <div>
              <span style={s.label}>{manual ? "QUEM PARTICIPOU" : "PARTICIPANTES"} ({f.participantes.length})</span>
              <input value={f.buscaP} onChange={(e) => setFormTurma({ ...f, buscaP: e.target.value })} placeholder="🔍 Buscar colaborador…" style={{ ...s.input, padding: "6px 10px", fontSize: 12, marginBottom: 6 }} />
              <div style={{ maxHeight: 180, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
                {lista.map((c) => {
                  const on = f.participantes.includes(String(c.id));
                  return (
                    <label key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 10px", fontSize: 12, cursor: "pointer", borderBottom: `1px solid ${C.border}` }}>
                      <input type="checkbox" checked={on} onChange={() => setFormTurma({ ...f, participantes: on ? f.participantes.filter((x) => x !== String(c.id)) : [...f.participantes, String(c.id)] })} />
                      {c.nome}<span style={{ color: C.muted }}>{c.funcao_nome || c.funcao ? ` · ${c.funcao_nome || c.funcao}` : ""}</span>
                      {sugeridos.has(String(c.id)) && <span style={s.tag("#f59e0b")}>precisa</span>}
                    </label>
                  );
                })}
              </div>
            </div>
            {manual && campo("EVIDÊNCIA (PDF OU FOTO, ATÉ 10 MB)", <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={async (e) => { const arq = await prepararArquivo(e.target.files?.[0]); setFormTurma((v0) => ({ ...v0, arquivo: arq })); }} style={{ ...s.input, padding: 7 }} />)}
            {campo("OBSERVAÇÕES", <textarea rows={2} value={f.obs} onChange={(e) => setFormTurma({ ...f, obs: e.target.value })} style={{ ...s.input, resize: "vertical" }} />)}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button onClick={() => setFormTurma(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
            <button onClick={salvarTurma} disabled={!ok} style={{ ...s.btn(!!ok), flex: 1 }}>{salvando ? "Salvando…" : manual ? "Registrar" : "Agendar"}</button>
          </div>
        </>, () => !salvando && setFormTurma(null), 640);
      })()}

      {/* ─── modal detalhe da turma ─── */}
      {turma && !assinando && modal(<>
        {(() => {
          const t = turma.turma; const ps = turma.participantes;
          const pv = turma.prova || {}; const online = t.modalidade === "online";
          const linkUrl = t.link_token ? `${window.location.origin}${window.location.pathname}#prova?t=${t.link_token}` : "";
          const fora = ativos.filter((c) => !ps.some((p) => String(p.colaborador_id) === String(c.id)));
          return (<>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>🎓 {t.treinamento_nome}</div>
              <span style={s.tag(ST[t.status].c)}>{ST[t.status].l}</span>
            </div>
            <div style={{ fontSize: 12, color: C.textSub, margin: "4px 0 12px" }}>{dataBR(t.data)}{t.data_fim ? ` a ${dataBR(t.data_fim)}` : ""} · {MOD[t.modalidade]}{t.instrutor ? ` · instrutor: ${t.instrutor}` : ""}{t.carga_horaria ? ` · ${Number(t.carga_horaria).toLocaleString("pt-BR")} h` : ""}{t.local ? ` · ${t.local}` : ""}{t.validade_meses ? ` · válido por ${t.validade_meses} meses` : ""}</div>
            {online && t.status === "agendada" && <div style={{ fontSize: 11, color: C.textSub, marginTop: -8, marginBottom: 10 }}>{t.data_fim ? <>⏳ Prazo para fazer: <b style={{ color: C.text }}>até {dataBR(t.data_fim)}</b> — depois disso a turma se encerra sozinha.</> : "Sem prazo — encerra sozinha quando todos concluírem, ou pelo botão 🔒 Encerrar."}</div>}
            {online && (
              <div style={{ border: `1px solid ${C.accent}55`, borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 12 }}>
                <div style={{ color: C.textSub, marginBottom: 6 }}>💻 <b style={{ color: C.text }}>Online</b>: cada participante faz {pv.tem_prova ? `a prova (mínimo ${pv.nota_minima}%)` : "o conteúdo e declara que concluiu"} em <b style={{ color: C.text }}>🎓 Meus treinamentos</b> (se tiver acesso) ou pelo link abaixo, com CPF + data de nascimento. Aprovado = presença + horas.</div>
                {t.status === "agendada" && (t.link_token && t.link_ativo ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <input readOnly value={linkUrl} onFocus={(e) => e.target.select()} style={{ ...s.input, flex: "1 1 260px", padding: "6px 10px", fontSize: 11 }} />
                    <button onClick={async () => { try { await navigator.clipboard.writeText(linkUrl); onAviso("Link copiado — mande por WhatsApp ou e-mail."); } catch { onErro("Não deu para copiar — selecione o link e copie."); } }} style={{ ...s.btn(true), cursor: "pointer", padding: "5px 12px", fontSize: 12 }}>📋 Copiar</button>
                    <button onClick={async () => { try { await apiService.post(`/pessoas/treinamentos/turmas/${t.id}/link`, { ativo: false }); await abrirTurma(t.id); onAviso("Link desativado."); } catch (e) { onErro(e.message); } }} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 12px", fontSize: 12, color: C.danger }}>Desativar</button>
                  </div>
                ) : <button onClick={async () => { try { await apiService.post(`/pessoas/treinamentos/turmas/${t.id}/link`, { ativo: true }); await abrirTurma(t.id); } catch (e) { onErro(e.message); } }} style={{ ...s.btn(true), cursor: "pointer", padding: "5px 12px", fontSize: 12 }}>🔗 {t.link_token ? "Reativar link da prova" : "Gerar link da prova"}</button>)}
              </div>
            )}
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
              {ps.length === 0 && <div style={{ padding: 12, fontSize: 12, color: C.muted }}>Nenhum participante.</div>}
              {ps.map((p, n) => (
                <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", borderBottom: n < ps.length - 1 ? `1px solid ${C.border}` : "none", fontSize: 13, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 200px" }}>{p.nome}<span style={{ color: C.muted, fontSize: 11 }}>{p.funcao ? ` · ${p.funcao}` : ""}</span></div>
                  {online && pv.tem_prova && (() => { const x = pv.por_colaborador?.[String(p.colaborador_id)]; if (!x) return null; return (<>
                    <span style={{ fontSize: 11, color: C.textSub }} title="Tentativas usadas / permitidas · melhor nota">📝 {x.usadas}/{x.max}{x.melhor != null ? ` · ${Number(x.melhor).toLocaleString("pt-BR")}%` : ""}{x.meio ? ` · ${x.meio === "link" ? "pelo link" : "logado"}` : ""}</span>
                    {x.esgotou && t.status === "agendada" && <button onClick={async () => { try { await apiService.post(`/pessoas/treinamentos/turmas/${t.id}/liberar/${p.colaborador_id}`); onAviso(`Novas tentativas liberadas para ${p.nome}.`); await abrirTurma(t.id); } catch (e) { onErro(e.message); } }} style={{ ...s.btn(true, "#f59e0b"), cursor: "pointer", padding: "4px 10px", fontSize: 11 }}>↻ Liberar tentativas</button>}
                  </>); })()}
                  {p.presente && p.aprovado !== false && (t.status === "concluida" || online) && <button onClick={() => imprimir("certificado", t.id, p.colaborador_id)} title="Certificado" style={{ ...s.btn(false), cursor: "pointer", padding: "3px 8px", fontSize: 11, color: C.text }}>🎓 Certificado</button>}
                  {editar && online && pv.por_colaborador?.[String(p.colaborador_id)]?.usadas > 0 && <button onClick={() => imprimir("avaliacao", t.id, p.colaborador_id)} title="Comprovante da avaliação (com gabarito)" style={{ ...s.btn(false), cursor: "pointer", padding: "3px 8px", fontSize: 11, color: C.text }}>📄 Avaliação</button>}
                  {p.presente
                    ? <span style={s.tag("#22c55e")}>✓ {t.modalidade === "manual" ? "Participou" : online && p.aprovado ? `Aprovado ${p.nota != null ? `${Number(p.nota).toLocaleString("pt-BR")}% ` : ""}${p.assinado_em ? new Date(p.assinado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : ""}` : online && !p.assinou ? `Concluiu ${p.assinado_em ? new Date(p.assinado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : ""}` : `Assinou ${p.assinado_em ? new Date(p.assinado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : ""}`}</span>
                    : t.status === "agendada"
                      ? <>
                          <button onClick={() => { setAssinatura(null); setAssinando(p); }} style={{ ...s.btn(true), cursor: "pointer", padding: "4px 12px", fontSize: 12 }}>✍ Assinar presença</button>
                          <button onClick={async () => { try { await apiService.delete(`/pessoas/treinamentos/turmas/${t.id}/participantes/${p.colaborador_id}`); await abrirTurma(t.id); await recarregarTudo(); } catch (e) { onErro(e.message); } }} title="Tirar da turma" style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 15 }}>×</button>
                        </>
                      : <span style={s.tag("#94a3b8")}>Faltou</span>}
                </div>
              ))}
            </div>
            {t.status === "agendada" && (
              addPart ? (
                <div style={{ marginTop: 10, border: `1px dashed ${C.accent}`, borderRadius: 8, padding: 10 }}>
                  <div style={{ maxHeight: 150, overflowY: "auto" }}>
                    {fora.map((c) => { const on = addPart.includes(String(c.id)); return (
                      <label key={c.id} style={{ display: "flex", gap: 8, fontSize: 12, padding: "4px 0", cursor: "pointer" }}><input type="checkbox" checked={on} onChange={() => setAddPart(on ? addPart.filter((x) => x !== String(c.id)) : [...addPart, String(c.id)])} />{c.nome}</label>
                    ); })}
                    {!fora.length && <div style={{ fontSize: 12, color: C.muted }}>Todos os colaboradores já estão na turma.</div>}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={() => setAddPart(null)} style={{ ...s.btn(false), cursor: "pointer", fontSize: 12, color: C.text }}>Cancelar</button>
                    <button disabled={!addPart.length} onClick={async () => { try { await apiService.post(`/pessoas/treinamentos/turmas/${t.id}/participantes`, { colaboradores: addPart }); setAddPart(null); await abrirTurma(t.id); await recarregarTudo(); } catch (e) { onErro(e.message); } }} style={{ ...s.btn(!!addPart.length), cursor: "pointer", fontSize: 12 }}>Adicionar {addPart.length || ""}</button>
                  </div>
                </div>
              ) : <button onClick={() => setAddPart([])} style={{ background: "none", border: "none", color: C.accent, fontSize: 12, cursor: "pointer", marginTop: 8, padding: 0, fontFamily: "inherit" }}>＋ Adicionar participante</button>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              {t.status === "agendada" && (() => { // 12e.2d: "Encerrar" com o que vai acontecer
                const feitos = ps.filter((p) => p.presente).length, nao = ps.length - feitos;
                return <button onClick={() => setConfirmar({ titulo: "Encerrar turma", botao: "🔒 Encerrar", texto: `${feitos} concluíram${nao ? ` · ${nao} ainda não ${online ? "fizeram" : "assinaram"} — vão ficar como "faltou"` : ""}. Depois de encerrar, ninguém mais entra${online ? " (o link da prova para de aceitar tentativas)" : ""} e a turma sai das agendadas.`, acao: async () => { const r = await apiService.post(`/pessoas/treinamentos/turmas/${t.id}/concluir`); await abrirTurma(t.id); return `Turma encerrada: ${r?.presentes || 0} concluíram${r?.faltaram ? `, ${r.faltaram} faltaram` : ""}.`; } })}
                  disabled={!feitos} title={feitos ? "" : online ? "Ninguém concluiu ainda" : "Colha ao menos uma assinatura"} style={{ ...s.btn(!!feitos, C.success), cursor: "pointer", flex: "1 1 160px" }}>🔒 Encerrar turma</button>;
              })()}
              {t.modalidade !== "manual" && <button onClick={() => imprimirLista(t.id)} style={{ ...s.btn(false), cursor: "pointer", flex: "1 1 140px", color: C.text }}>🖨 Lista de presença</button>}
              {t.evidencia_path && <button onClick={() => abrirEvidencia(t.id)} style={{ ...s.btn(false), cursor: "pointer", flex: "1 1 140px", color: C.accent }}>📎 Ver evidência</button>}
              {t.status === "agendada" && <button onClick={() => setConfirmar({ titulo: "Cancelar turma", texto: `Cancelar a turma de ${dataBR(t.data)}? As assinaturas já colhidas ficam no histórico, mas não valem como treinamento.`, botao: "Cancelar turma", acao: async () => { await apiService.post(`/pessoas/treinamentos/turmas/${t.id}/cancelar`); await abrirTurma(t.id); return "Turma cancelada."; } })} style={{ ...s.btn(false), cursor: "pointer", flex: "0 1 auto", color: C.danger }}>Cancelar turma</button>}
              <button onClick={() => { setTurma(null); setAddPart(null); }} style={{ ...s.btn(false), cursor: "pointer", flex: "1 1 100px", color: C.text }}>Fechar</button>
            </div>
          </>);
        })()}
      </>, () => { setTurma(null); setAddPart(null); }, 680)}

      {/* ─── modal assinatura de presença ─── */}
      {turma && assinando && modal(<>
        <div style={{ fontSize: 17, fontWeight: 700 }}>✍ Presença — {assinando.nome}</div>
        <div style={{ fontSize: 12, color: C.textSub, margin: "4px 0 12px" }}>{turma.turma.treinamento_nome} · {dataBR(turma.turma.data)}{turma.turma.instrutor ? ` · ${turma.turma.instrutor}` : ""}</div>
        <div style={{ fontSize: 11, color: C.textSub, padding: 10, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 10 }}>Declaro que participei deste treinamento, com o conteúdo e a carga horária indicados.</div>
        <AssinaturaTela C={C} s={s} onChange={setAssinatura} />
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button onClick={() => { setAssinando(null); setAssinatura(null); }} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Voltar</button>
          <button onClick={confirmarAssinatura} disabled={!assinatura || salvando} style={{ ...s.btn(!!assinatura && !salvando), flex: 2 }}>{salvando ? "Registrando…" : "✓ Confirmar presença"}</button>
        </div>
      </>, () => !salvando && setAssinando(null), 620)}

      {confirmar && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.danger }}>⚠ {confirmar.titulo}</div>
        <div style={{ fontSize: 13, color: C.textSub, marginTop: 10, lineHeight: 1.5 }}>{confirmar.texto}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={() => setConfirmar(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Voltar</button>
          <button onClick={async () => { const c = confirmar; setConfirmar(null); try { onAviso(await c.acao()); await recarregarTudo(); } catch (e) { onErro(e.message); } }} style={{ ...s.btn(true, C.danger), cursor: "pointer", flex: 1 }}>{confirmar.botao || "Confirmar"}</button>
        </div>
      </>, () => setConfirmar(null), 460)}
    </>
  );
}
