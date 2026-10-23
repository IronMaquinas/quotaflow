// components/inspecoes/TelaInspecoes.jsx — etapa 14a
// 🔍 Inspeções de equipamento (pré-uso e rotina).
//   🚚 Equipamentos — situação de cada um (⛔ bloqueado / última inspeção), inspecionar, liberar (evidência), modelo padrão
//   📋 Inspeções   — histórico, detalhe com o desenho e as fotos, "🛠 Abrir OS" do item não OK, relatório (seguradora/cliente)
//   🧩 Modelos     — importar da biblioteca do QuotaFlow, editar, criar
// Inspeções feitas sem internet ficam no aparelho e são enviadas sozinhas quando a conexão volta.
// 14b.1: número INSP-AAAA-NNNN, tipo do modelo, "🔧 resolvido na hora", 🔗 links de inspeção de terceiros e o modo
//   colaborador ("Minhas inspeções" na tela própria do colaborador — sem modelos, liberação nem OS).
import { useState, useEffect, useMemo, useCallback } from "react";
import apiService from "../../services/apiService";
import ExecutarInspecao from "./ExecutarInspecao";
import EditorModeloInspecao, { modeloVazio } from "./EditorModeloInspecao";
import { FundoVista } from "./Esquemas";
import * as Fila from "../../utils/filaInspecoes";
import { abrirRelatorioInspecao, prepararJanela } from "../../utils/gerarRelatorioInspecao";
import { LinhaRotinas, ModalRotinas, ModalLocar, ModalEncerrar, AbaCumprimento } from "./RotinasLocacao"; // 14b.2

const RES = { aprovado: ["✓ Aprovado", "#22c55e"], ressalvas: ["⚠ Ressalvas", "#f59e0b"], reprovado: ["⛔ Reprovado", "#ef4444"] };
const COR = { ok: "#22c55e", nok: "#ef4444", na: "#64748b" };
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const chaveTenant = () => { try { const u = JSON.parse(localStorage.getItem("usuario") || "{}"); return String(u.tenant_id ?? u.tenantId ?? u.email ?? "t"); } catch { return "t"; } };

export default function TelaInspecoes({ C, s, onAbrirOS, onIrParaOS, embutida = false }) {
  const tenant = useMemo(chaveTenant, []);
  const [aba, setAba] = useState("equip");
  const [painel, setPainel] = useState(null);
  const [lista, setLista] = useState([]);
  const [locais, setLocais] = useState([]);
  const [semMigration, setSemMigration] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtroEq, setFiltroEq] = useState("");
  const [exec, setExec] = useState(null);       // { equipamento, modeloId } | { rascunho }
  const [escolher, setEscolher] = useState(null); // equipamento sem modelo padrão
  const [liberar, setLiberar] = useState(null);  // { equipamento, motivo }
  const [ver, setVer] = useState(null);          // detalhe
  const [editor, setEditor] = useState(null);    // { modelo, urls }
  const [biblioteca, setBiblioteca] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [links, setLinks] = useState(null);
  const [filtroSit, setFiltroSit] = useState("todos"); // 14b.2: todos | base | locado | atrasadas
  const [modalEq, setModalEq] = useState(null); // 14b.2: { tipo: 'rotinas'|'locar'|'encerrar', e } // 14b.1: { lista, form, criado }
  const ok = (t) => setAviso({ tipo: "ok", texto: t });
  const err = (t) => setAviso({ tipo: "erro", texto: t });
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(null), 6000); return () => clearTimeout(t); }, [aviso]);

  const carregarLocais = useCallback(async () => setLocais(await Fila.listar(tenant)), [tenant]);
  const carregar = useCallback(async () => {
    try {
      const [p, l] = await Promise.all([apiService.get("/inspecoes/painel"), apiService.get("/inspecoes")]);
      setPainel(p); setLista(l.inspecoes || []); setSemMigration(false);
    } catch (e) { if (/040/.test(e.message || "")) setSemMigration(true); else if (e.body) err(e.message); else err("Sem internet — mostrando só o que está guardado neste aparelho."); }
    await carregarLocais();
  }, [carregarLocais]);
  const sincronizar = useCallback(async () => {
    const r = await Fila.sincronizar(tenant, (corpo) => apiService.post("/inspecoes/enviar", corpo));
    if (r.enviadas) { ok(`${r.enviadas} inspeção(ões) guardada(s) no aparelho foram enviadas.`); await carregar(); } else await carregarLocais();
  }, [tenant, carregar, carregarLocais]);
  useEffect(() => { carregar().then(sincronizar); const on = () => sincronizar(); window.addEventListener("online", on); return () => window.removeEventListener("online", on); }, []); // eslint-disable-line

  const editar = !!painel?.pode_editar;
  const colab = !!painel?.colaborador;
  const numero = (i) => i.numero || `nº ${i.id}`;
  const tipoNome = (t) => (painel?.tipos || []).find((x) => x.codigo === t)?.nome?.split(" (")[0];
  const modelos = (painel?.modelos || []).filter((m) => m.ativo !== false);
  const nomeModelo = (id) => modelos.find((m) => String(m.id) === String(id))?.nome;

  const inspecionar = (e) => {
    if (e.inspecao_modelo_id && modelos.some((m) => String(m.id) === String(e.inspecao_modelo_id))) return setExec({ equipamento: e, modeloId: e.inspecao_modelo_id });
    if (!modelos.length) return err(editar ? "Importe ou crie um modelo de inspeção na aba 🧩 Modelos." : "Ainda não há modelo de inspeção — fale com o gestor.");
    if (modelos.length === 1) return setExec({ equipamento: e, modeloId: modelos[0].id });
    setEscolher(e);
  };
  const definirModelo = async (e, modeloId) => {
    try { await apiService.put(`/inspecoes/equipamentos/${e.id}/modelo`, { modelo_id: modeloId || null }); await carregar(); } catch (x) { err(x.message); }
  };
  const abrir = async (id) => {
    try { const d = await apiService.get(`/inspecoes/${id}`); let lib = []; try { lib = (await apiService.get(`/inspecoes/equipamentos/${d.inspecao.equipamento_id}/liberacoes`)).liberacoes || []; } catch { /* ok */ }
      setVer({ ...d, liberacao: lib.find((l) => String(l.inspecao_id) === String(id)) || null }); }
    catch (e) { err(e.message); }
  };
  // 14b.2: liberar mostra os itens que impedem o uso e pede COMO foi resolvido (OS · sem OS · provisória)
  const abrirLiberar = async (e) => {
    let itens = [], os = [];
    if (e.bloqueio_inspecao_id) { try { const d = await apiService.get(`/inspecoes/${e.bloqueio_inspecao_id}`); itens = (d.inspecao.respostas || []).filter((x) => x.impede && !x.resolucao_posterior); os = d.inspecao.os_abertas || []; } catch { /* ok */ } }
    setLiberar({ equipamento: e, itens, os, como: os.length ? "os" : "sem_os", osNum: os.map((o) => o.os_numero || o.os_id).join(", "), confirma: false, motivo: "" });
  };
  const motivoLiberar = (l) => {
    const lista = l.itens.map((x) => x.rotulo).join(", ") || l.equipamento.bloqueio_motivo || "itens da inspeção";
    const det = l.motivo.trim() ? ` — ${l.motivo.trim()}` : "";
    if (l.como === "os") return `Reparo realizado na ${l.osNum.trim() || "OS"} (${lista})${det}`;
    if (l.como === "sem_os") return `Resolvido sem OS — confirmado que ${lista} foi corrigido e não requer ordem de serviço${det}`;
    return `Liberação provisória${det}`;
  };
  const podeLiberar = (l) => (l.como === "os" ? !!l.osNum.trim() : l.como === "sem_os" ? l.confirma && l.motivo.trim().length >= 5 : l.motivo.trim().length >= 5);
  const [resolver, setResolver] = useState(null);
  const [foto, setFoto] = useState(null); // 14b.1.3: { url, legenda } — foto ampliada dentro do sistema // { item, texto } — "✅ Resolver sem OS" no detalhe
  const relatorio = () => { const w = prepararJanela(); try { abrirRelatorioInspecao(ver, w); } catch (e) { err(e.message); } };
  const abrirOS = (r) => {
    const i = ver.inspecao;
    onAbrirOS({ inspecao: { id: i.id, ponto_id: r.ponto_id }, equipamento_id: i.equipamento_id, equipamento_nome: i.equipamento_nome,
      descricao: `Inspeção nº ${i.id} (${dataHora(i.concluida_em)}) — ${r.vista} → ${r.rotulo}: ${r.obs || "não OK"}`, servico_nome: `Corrigir: ${r.rotulo}`, urgencia: r.impede ? "alta" : "media" });
  };
  const abrirEditor = async (m) => {
    if (!m) return setEditor({ modelo: modeloVazio(), urls: {} });
    let urls = {}; try { urls = (await apiService.get(`/inspecoes/modelos/${m.id}/imagens`)).imagens || {}; } catch { /* ok */ }
    setEditor({ modelo: JSON.parse(JSON.stringify(m)), urls });
  };
  const salvarModelo = async (dados) => {
    setOcupado(true);
    try { if (editor.modelo.id) await apiService.put(`/inspecoes/modelos/${editor.modelo.id}`, dados); else await apiService.post("/inspecoes/modelos", dados); ok("Modelo salvo."); setEditor(null); await carregar(); }
    catch (e) { err(e.message); } finally { setOcupado(false); }
  };
  const abrirBiblioteca = async () => { try { setBiblioteca((await apiService.get("/inspecoes/modelos/biblioteca")).modelos || []); } catch (e) { err(e.message); } };

  const modal = (conteudo, fechar, largura = 640, z = 300) => ( // 14b.1.3: z maior = modal por cima do detalhe
    <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: z, padding: 16, overflowY: "auto" }} onClick={fechar}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: largura, maxWidth: "100%", padding: "18px 20px", margin: "auto 0", boxShadow: "0 24px 48px #00000060" }}>{conteudo}</div>
    </div>
  );
  const bt = (cor, cheio = true) => ({ ...s.btn(true, cor), cursor: "pointer", padding: "7px 12px", fontSize: 12, ...(cheio ? {} : { background: "transparent", color: cor }) });

  if (exec) return <ExecutarInspecao tenant={tenant} C={C} s={s} {...exec} onFechar={() => { setExec(null); carregarLocais(); }}
    onConcluida={async (r) => { setExec(null); if (r.offline) ok(`Sem internet: a inspeção de ${r.equipamento.tag || r.equipamento.nome} ficou guardada no aparelho e será enviada quando a conexão voltar.${r.impede ? " ⛔ Item que impede o uso — não use o equipamento." : ""}`);
      else ok(r.bloqueou ? `⛔ Inspeção enviada — ${r.equipamento.tag || r.equipamento.nome} BLOQUEADO até o gestor liberar.` : r.nao_ok ? `Inspeção enviada com ${r.nao_ok} item(ns) não OK. Abra a OS pelo detalhe.` : "✓ Inspeção enviada — tudo OK."); await carregar(); }} />;

  if (semMigration) return <div style={{ padding: 24 }}><div style={{ ...s.card, padding: 20, color: C.warn }}>Rode a migration <b>040_inspecoes.sql</b> no Supabase para usar as inspeções.</div></div>;

  const eqs = (painel?.equipamentos || []).filter((e) => !busca.trim() || semAcento(`${e.tag} ${e.nome} ${e.local || ""}`).includes(semAcento(busca.trim())));
  const listaF = lista.filter((i) => (!filtroEq || String(i.equipamento_id) === String(filtroEq)) && (aba !== "hist" || !busca.trim() || semAcento(`${i.equipamento_nome} ${i.executor_nome} ${i.modelo_nome}`).includes(semAcento(busca.trim()))));
  const bloqueados = (painel?.equipamentos || []).filter((e) => e.bloqueado).length;
  const abas = colab ? [["equip", "🚚 Inspecionar"], ["hist", "📋 Minhas inspeções"]] : [["equip", `🚚 Equipamentos${bloqueados ? ` (⛔ ${bloqueados})` : ""}`], ["hist", "📋 Inspeções"], ["cumprimento", "📊 Cumprimento"], ["modelos", "🧩 Modelos"]];
  const atrasada = (e) => (e.rotinas || []).some((r) => r.estado === "atrasada");
  const contSit = { todos: eqs.length, base: eqs.filter((e) => e.situacao !== "locado").length, locado: eqs.filter((e) => e.situacao === "locado").length, atrasadas: eqs.filter(atrasada).length };
  const eqsF = eqs.filter((e) => filtroSit === "todos" || (filtroSit === "base" ? e.situacao !== "locado" : filtroSit === "locado" ? e.situacao === "locado" : atrasada(e)));
  const mudouEq = async (t) => { setModalEq(null); ok(t); await carregar(); };
  const linkUrl = (l) => `${window.location.origin}${window.location.pathname}#inspecao?t=${l.token}`;
  const abrirLinks = async () => { try { setLinks({ lista: (await apiService.get("/inspecoes/links")).links || [], form: null }); } catch (e) { err(e.message); } };
  const copiar = async (t) => { try { await navigator.clipboard.writeText(t); ok("Copiado — cole no WhatsApp / Telegram."); } catch { err("Não foi possível copiar — selecione o texto e copie."); } };

  return (
    <div style={{ padding: embutida ? "14px 14px" : "20px 22px", maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ fontSize: embutida ? 17 : 20, fontWeight: 700, flex: 1 }}>🔍 {colab ? "Minhas inspeções" : "Inspeções de equipamento"}</div>
        {editar && aba === "equip" && <button type="button" onClick={abrirLinks} style={bt(C.accent, false)}>🔗 Links de terceiros</button>}
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar…" style={{ ...s.input, width: 220 }} />
      </div>
      {aviso && <div style={{ ...s.card, padding: "10px 14px", marginBottom: 12, fontSize: 13, borderColor: aviso.tipo === "erro" ? C.danger : C.success, color: aviso.tipo === "erro" ? C.danger : C.success }}>{aviso.texto}</div>}

      {locais.length > 0 && (
        <div style={{ ...s.card, padding: "10px 14px", marginBottom: 12, borderColor: C.warn }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.warn, marginBottom: 6 }}>💾 Guardadas neste aparelho</div>
          {locais.map((x) => (
            <div key={x.uid} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "4px 0", flexWrap: "wrap" }}>
              <span style={{ flex: "1 1 200px" }}>{x.rotulo} · <span style={{ color: C.muted }}>{x.prep?.modelo?.nome} · {dataHora(x.atualizado_em)}</span></span>
              {x.situacao === "rascunho" && <><span style={s.tag(C.accent)}>EM ANDAMENTO</span><button type="button" onClick={() => setExec({ rascunho: x })} style={bt(C.accent)}>Continuar</button></>}
              {x.situacao === "pendente" && <><span style={s.tag(C.warn)}>AGUARDANDO INTERNET</span><button type="button" onClick={sincronizar} style={bt(C.warn, false)}>Enviar agora</button></>}
              {x.situacao === "erro" && <><span style={s.tag(C.danger)} title={x.erro}>NÃO ACEITA: {x.erro}</span><button type="button" onClick={() => { Fila.salvar({ ...x, situacao: "rascunho" }).then(() => setExec({ rascunho: { ...x, situacao: "rascunho" } })); }} style={bt(C.accent)}>Corrigir</button></>}
              <button type="button" onClick={() => setConfirmar({ titulo: "Descartar esta inspeção?", texto: "Ela ainda não foi enviada — será apagada deste aparelho.", acao: async () => { await Fila.remover(x.uid); await carregarLocais(); return "Descartada."; } })} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}>🗑</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {abas.map(([k, l]) => <button key={k} type="button" onClick={() => setAba(k)} style={{ ...s.btn(aba === k, C.accent), cursor: "pointer", color: aba === k ? "#fff" : C.text }}>{l}</button>)}
      </div>

      {!painel && <div style={{ color: C.muted }}>Carregando…</div>}

      {painel && aba === "equip" && !colab && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {[["todos", "Todos"], ["base", "🏠 Na base"], ["locado", "📍 Locados"], ["atrasadas", "⚠ Inspeção atrasada"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setFiltroSit(k)} style={{ ...s.btn(filtroSit === k, k === "atrasadas" ? C.danger : C.accent), cursor: "pointer", padding: "5px 12px", fontSize: 12, color: filtroSit === k ? "#fff" : C.text }}>{l} ({contSit[k]})</button>
          ))}
        </div>
      )}
      {painel && aba === "equip" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 10 }}>
          {eqsF.map((e) => { const r = e.ultima && RES[e.ultima.resultado]; return (
            <div key={e.id} style={{ ...s.card, padding: 14, borderColor: e.bloqueado ? C.danger : C.border }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{e.tag}</div><div style={{ fontSize: 12, color: C.textSub }}>{e.nome}{e.local ? ` · ${e.local}` : ""}</div></div>
                {e.bloqueado ? <span style={s.tag(C.danger)}>⛔ BLOQUEADO</span> : r ? <span style={s.tag(e.ultima.resultado === "reprovado" ? C.success : r[1])}>{e.ultima.resultado === "reprovado" ? "🔓 Liberado" : r[0]}</span> : <span style={s.tag(C.muted)}>Sem inspeção</span>}
              </div>
              {e.bloqueado && <div style={{ fontSize: 12, color: C.danger, marginTop: 6 }}>{e.bloqueio_motivo} · {dataHora(e.bloqueado_em)}</div>}
              <div style={{ fontSize: 12, marginTop: 6, color: e.situacao === "locado" ? C.warn : C.textSub }}>{e.situacao === "locado" && e.locacao
                ? <>📍 <b>Locado</b> — {e.locacao.cliente}{e.locacao.contrato ? ` · ${e.locacao.contrato}` : ""}{e.locacao.local ? ` · ${e.locacao.local}` : ""}{e.locacao.fim_previsto ? ` · até ${String(e.locacao.fim_previsto).split("-").reverse().join("/")}` : ""}</> : "🏠 Na base"}</div>
              <LinhaRotinas e={e} C={C} />
              {e.ultima && <div style={{ fontSize: 11, color: C.muted, marginTop: 6, cursor: "pointer" }} onClick={() => abrir(e.ultima.id)}>Última: {dataHora(e.ultima.em)} · {e.ultima.executor}{e.ultima.km != null ? ` · ${Number(e.ultima.km).toLocaleString("pt-BR")} km` : ""} ›</div>}
              {!colab && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Modelo: {editar ? (
                <select value={e.inspecao_modelo_id || ""} onChange={(x) => definirModelo(e, x.target.value)} style={{ ...s.input, width: "auto", padding: "3px 6px", fontSize: 11, display: "inline-block" }}>
                  <option value="">— escolher na hora —</option>{modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>) : (nomeModelo(e.inspecao_modelo_id) || "escolher na hora")}</div>}
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={() => inspecionar(e)} style={bt(C.accent)}>🔍 Inspecionar</button>
                {e.bloqueado && !colab && <button type="button" onClick={() => (e.bloqueio_inspecao_id ? abrir(e.bloqueio_inspecao_id) : abrirLiberar(e))} style={bt(C.success)}>🔓 Resolver bloqueio</button>}
                {editar && <button type="button" onClick={() => setModalEq({ tipo: "rotinas", e })} style={bt(C.accent, false)}>⏰ Rotinas{(e.rotinas || []).length ? ` (${e.rotinas.length})` : ""}</button>}
                {editar && (e.situacao === "locado" ? <button type="button" onClick={() => setModalEq({ tipo: "encerrar", e })} style={bt(C.success, false)}>🏠 Encerrar locação</button>
                  : <button type="button" onClick={() => setModalEq({ tipo: "locar", e })} style={bt(C.warn, false)}>📍 Locar</button>)}
                {e.total > 0 && !colab && <button type="button" onClick={() => { setFiltroEq(String(e.id)); setAba("hist"); }} style={bt(C.textSub, false)}>Histórico ({e.total})</button>}
              </div>
            </div>); })}
          {eqsF.length === 0 && <div style={{ color: C.muted }}>{eqs.length ? "Nenhum equipamento neste filtro." : "Nenhum equipamento cadastrado."}</div>}
        </div>
      )}

      {painel && aba === "cumprimento" && <AbaCumprimento C={C} s={s} onErro={err} />}
      {modalEq?.tipo === "rotinas" && <ModalRotinas e={(painel.equipamentos || []).find((x) => x.id === modalEq.e.id) || modalEq.e} modelos={modelos} C={C} s={s} onFechar={() => setModalEq(null)} onMudou={async (t) => { ok(t); await carregar(); }} onErro={err} />}
      {modalEq?.tipo === "locar" && <ModalLocar e={modalEq.e} modelos={modelos} C={C} s={s} onFechar={() => setModalEq(null)} onMudou={mudouEq} onErro={err} />}
      {modalEq?.tipo === "encerrar" && <ModalEncerrar e={modalEq.e} C={C} s={s} onFechar={() => setModalEq(null)} onMudou={mudouEq} onErro={err} />}

      {painel && aba === "hist" && (
        <div>
          <select value={filtroEq} onChange={(e) => setFiltroEq(e.target.value)} style={{ ...s.input, maxWidth: 320, marginBottom: 10 }}>
            <option value="">Todos os equipamentos</option>{(painel.equipamentos || []).map((e) => <option key={e.id} value={e.id}>{e.tag} — {e.nome}</option>)}
          </select>
          <div style={{ ...s.card, overflow: "hidden" }}>
            {listaF.map((i, k) => { const r = RES[i.resultado] || ["—", C.muted]; return (
              <div key={i.id} onClick={() => abrir(i.id)} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: k < listaF.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer", flexWrap: "wrap" }}>
                <div style={{ flex: "2 1 220px" }}><div style={{ fontWeight: 600, fontSize: 13 }}>{i.equipamento_nome}</div><div style={{ fontSize: 11, color: C.muted }}><b style={{ color: C.textSub }}>{numero(i)}</b> · {i.modelo_nome} · {i.executor_nome}{i.executor_tipo === "terceiro" ? " (terceiro)" : ""}</div></div>
                {i.tipo && i.tipo !== "equipamento" && <span style={s.tag(C.violet || "#a855f7")}>{tipoNome(i.tipo)}</span>}
                <div style={{ fontSize: 12, color: C.textSub }}>{dataHora(i.concluida_em)}</div>
                {(i.os_abertas || []).length > 0 && <span style={s.tag(C.accent)}>🛠 {i.os_abertas.length} OS</span>}
                <span style={s.tag(r[1])}>{r[0]}</span>
                {i.corrigida && <span style={s.tag(C.success)}>✓ Corrigido</span>}
              </div>); })}
            {listaF.length === 0 && <div style={{ padding: 20, color: C.muted, textAlign: "center" }}>Nenhuma inspeção ainda.</div>}
          </div>
        </div>
      )}

      {painel && aba === "modelos" && (
        <div>
          {editar && <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <button type="button" onClick={abrirBiblioteca} style={bt(C.accent)}>📚 Importar da biblioteca QuotaFlow</button>
            <button type="button" onClick={() => abrirEditor(null)} style={bt(C.accent, false)}>＋ Criar do zero</button>
          </div>}
          <div style={{ ...s.card, overflow: "hidden" }}>
            {modelos.map((m, k) => (
              <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: k < modelos.length - 1 ? `1px solid ${C.border}` : "none", flexWrap: "wrap" }}>
                <div style={{ flex: "2 1 220px" }}><div style={{ fontWeight: 600, fontSize: 13 }}>{m.nome}{m.tipo && m.tipo !== "equipamento" && <span style={{ ...s.tag(C.violet || "#a855f7"), marginLeft: 6 }}>{tipoNome(m.tipo)}</span>}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{painel.categorias.find((c) => c.codigo === m.categoria)?.nome} · {painel.frequencias.find((c) => c.codigo === m.frequencia)?.nome} · {m.vistas_qtd ?? m.vistas?.length} vistas · {m.pontos_qtd ?? ""} pontos{m.origem_id ? " · da biblioteca" : ""}</div></div>
                {m.versao_nova && editar && <button type="button" onClick={() => setConfirmar({ titulo: "Atualizar para a versão nova da biblioteca?", texto: "As mudanças que vocês fizeram neste modelo serão substituídas pela versão nova do QuotaFlow. Inspeções já feitas não mudam.", acao: async () => { await apiService.post(`/inspecoes/modelos/${m.id}/atualizar`); return "Modelo atualizado."; } })} style={bt(C.violet || "#a855f7")}>✨ Versão nova</button>}
                {editar && <button type="button" onClick={() => abrirEditor(m)} style={bt(C.accent, false)}>Editar</button>}
                {editar && <button type="button" onClick={() => setConfirmar({ titulo: `Desativar “${m.nome}”?`, texto: "Ele some da lista para novas inspeções. As inspeções já feitas continuam guardadas.", acao: async () => { await apiService.delete(`/inspecoes/modelos/${m.id}`); return "Modelo desativado."; } })} style={bt(C.danger, false)}>Desativar</button>}
              </div>
            ))}
            {modelos.length === 0 && <div style={{ padding: 20, color: C.muted, textAlign: "center" }}>Nenhum modelo ainda. {editar ? "Importe um da biblioteca — dá para ajustar depois." : ""}</div>}
          </div>
        </div>
      )}

      {escolher && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Qual inspeção em {escolher.tag}?</div>
        {modelos.map((m) => <button key={m.id} type="button" onClick={() => { setExec({ equipamento: escolher, modeloId: m.id }); setEscolher(null); }} style={{ ...s.btn(false), cursor: "pointer", color: C.text, width: "100%", textAlign: "left", marginBottom: 6 }}>{m.nome}</button>)}
        <button type="button" onClick={() => setEscolher(null)} style={{ ...s.btn(false), cursor: "pointer", color: C.textSub, marginTop: 6 }}>Cancelar</button>
      </>, () => setEscolher(null), 420)}

      {liberar && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700 }}>🔓 Liberar {liberar.equipamento.tag}</div>
        <div style={{ fontSize: 13, color: C.danger, marginTop: 6 }}>Bloqueado por: {liberar.itens.length ? liberar.itens.map((x) => `${x.rotulo}${x.obs ? ` (${x.obs})` : ""}`).join("; ") : liberar.equipamento.bloqueio_motivo}</div>
        <div style={{ ...s.label, marginTop: 14 }}>COMO FOI RESOLVIDO?</div>
        {[["os", "🛠 Reparo feito em ordem de serviço"], ["sem_os", "✅ Resolvido sem OS (correção local)"], ["provisoria", "⏳ Liberação provisória (ainda não resolvido)"]].map(([k, l]) => (
          <label key={k} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "4px 0", cursor: "pointer" }}><input type="radio" checked={liberar.como === k} onChange={() => setLiberar({ ...liberar, como: k, confirma: false })} />{l}</label>))}
        {liberar.como === "os" && <label style={{ display: "block", marginTop: 8 }}><span style={s.label}>Nº DA OS</span><input value={liberar.osNum} onChange={(e) => setLiberar({ ...liberar, osNum: e.target.value })} placeholder="OS-2026-0002" style={s.input} /></label>}
        {liberar.como === "sem_os" && <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, marginTop: 8, cursor: "pointer" }}><input type="checkbox" checked={liberar.confirma} onChange={(e) => setLiberar({ ...liberar, confirma: e.target.checked })} style={{ marginTop: 3 }} />
          <span>Confirmo que <b>{liberar.itens.map((x) => x.rotulo).join(", ") || "os itens"}</b> foi(ram) corrigido(s) e <b>não requer(em) ordem de serviço</b>.</span></label>}
        <label style={{ display: "block", marginTop: 10 }}><span style={s.label}>{liberar.como === "os" ? "OBSERVAÇÃO (OPCIONAL)" : liberar.como === "sem_os" ? "O QUE FOI FEITO?" : "POR QUE ESTÁ LIBERANDO E ATÉ QUANDO?"}</span>
          <textarea rows={2} value={liberar.motivo} onChange={(e) => setLiberar({ ...liberar, motivo: e.target.value })} placeholder={liberar.como === "sem_os" ? "Lâmpada trocada pelo motorista" : liberar.como === "provisoria" ? "Só para levar até a oficina, hoje" : ""} style={{ ...s.input, resize: "vertical" }} /></label>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Fica registrado com seu nome: “{motivoLiberar(liberar)}”</div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={() => setLiberar(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          <button type="button" disabled={ocupado || !podeLiberar(liberar)} onClick={async () => { setOcupado(true); try {
            if (liberar.como === "sem_os" && liberar.itens.length && liberar.equipamento.bloqueio_inspecao_id) {
              // 14b.1.3: "resolvido sem OS" em lote — registra em cada item da inspeção; o último libera o equipamento
              for (const x of liberar.itens) await apiService.post(`/inspecoes/${liberar.equipamento.bloqueio_inspecao_id}/resolver`, { ponto_id: x.ponto_id, texto: liberar.motivo.trim() });
            } else await apiService.post(`/inspecoes/equipamentos/${liberar.equipamento.id}/liberar`, { motivo: motivoLiberar(liberar) });
            ok(`${liberar.equipamento.tag} liberado.`); setLiberar(null); await carregar(); if (ver) await abrir(ver.inspecao.id); } catch (e) { err(e.message); } finally { setOcupado(false); } }}
            style={{ ...s.btn(!ocupado && podeLiberar(liberar), C.success), flex: 1 }}>Liberar</button>
        </div>
      </>, () => setLiberar(null), 520, 320)}

      {foto && (
        <div onClick={() => setFoto(null)} style={{ position: "fixed", inset: 0, background: "#000000e6", zIndex: 340, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16, cursor: "zoom-out" }}>
          <img src={foto.url} alt="" style={{ maxWidth: "100%", maxHeight: "85vh", objectFit: "contain", borderRadius: 6 }} />
          <div style={{ color: "#e2e8f0", fontSize: 13, marginTop: 10, textAlign: "center" }}>{foto.legenda}</div>
          <button type="button" onClick={() => setFoto(null)} style={{ position: "absolute", top: 14, right: 16, background: "transparent", border: "none", color: "#fff", fontSize: 26, cursor: "pointer" }}>✕</button>
        </div>)}

      {resolver && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700 }}>✅ Resolver sem OS</div>
        <div style={{ fontSize: 13, color: C.textSub, marginTop: 6 }}><b>{resolver.item.rotulo}</b>{resolver.item.obs ? ` — ${resolver.item.obs}` : ""}</div>
        <label style={{ display: "block", marginTop: 12 }}><span style={s.label}>O QUE FOI FEITO? (FICA REGISTRADO COM SEU NOME)</span>
          <textarea rows={3} autoFocus value={resolver.texto} onChange={(e) => setResolver({ ...resolver, texto: e.target.value })} placeholder="Lâmpada trocada pelo motorista no pátio" style={{ ...s.input, resize: "vertical" }} /></label>
        {resolver.item.impede && <div style={{ fontSize: 12, color: C.warn, marginTop: 6 }}>Se for o último item que impede o uso, o equipamento é liberado junto.</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={() => setResolver(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          <button type="button" disabled={ocupado || resolver.texto.trim().length < 5} onClick={async () => { setOcupado(true); try { const r = await apiService.post(`/inspecoes/${ver.inspecao.id}/resolver`, { ponto_id: resolver.item.ponto_id, texto: resolver.texto }); ok(r.liberou ? "Item resolvido — equipamento liberado." : r.pendentes?.length ? `Item resolvido. Ainda impede o uso: ${r.pendentes.join(", ")}.` : "Item resolvido."); setResolver(null); await abrir(ver.inspecao.id); await carregar(); } catch (e) { err(e.message); } finally { setOcupado(false); } }}
            style={{ ...s.btn(!ocupado && resolver.texto.trim().length >= 5, C.success), flex: 1 }}>Confirmar</button>
        </div>
      </>, () => setResolver(null), 480, 320)}

      {ver && modal(<DetalheInspecao d={ver} C={C} s={s} bt={bt} onRelatorio={relatorio} onAbrirOS={onAbrirOS && !colab ? abrirOS : null} onFoto={(url, legenda) => setFoto({ url, legenda })} onIrParaOS={onIrParaOS && !colab ? (id) => { setVer(null); onIrParaOS(id); } : null} onResolver={editar && !colab ? (x) => setResolver({ item: x, texto: "" }) : null}
        bloqueioAqui={(painel?.equipamentos || []).find((e) => e.bloqueado && String(e.bloqueio_inspecao_id) === String(ver.inspecao.id)) || null}
        onLiberar={editar && !colab ? (e) => abrirLiberar(e) : null} onFechar={() => setVer(null)} />, () => setVer(null), 860)}

      {editor && modal(<EditorModeloInspecao inicial={editor.modelo} urls={editor.urls} listas={painel} salvando={ocupado} C={C} s={s}
        subirImagem={async (base64, mime) => (await apiService.post("/inspecoes/modelos/imagem", { base64, mime })).imagem}
        onSalvar={salvarModelo} onCancelar={() => setEditor(null)} />, () => {}, 1000)}

      {biblioteca && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>📚 Biblioteca de inspeções do QuotaFlow</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Importe e ajuste à sua frota (pontos, fotos, imagem do seu equipamento).</div>
        {biblioteca.map((m) => (
          <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{m.nome}</div><div style={{ fontSize: 11, color: C.muted }}>{m.descricao}</div></div>
            {m.ja_importado ? <span style={s.tag(C.success)}>Importado</span>
              : <button type="button" disabled={ocupado} onClick={async () => { setOcupado(true); try { await apiService.post("/inspecoes/modelos/importar", { biblioteca_id: m.id }); ok(`“${m.nome}” importado.`); setBiblioteca(null); await carregar(); } catch (e) { err(e.message); } finally { setOcupado(false); } }} style={bt(C.accent)}>Importar</button>}
          </div>
        ))}
        {biblioteca.length === 0 && <div style={{ color: C.muted }}>A biblioteca está vazia.</div>}
        <div style={{ textAlign: "right", marginTop: 12 }}><button type="button" onClick={() => setBiblioteca(null)} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>Fechar</button></div>
      </>, () => setBiblioteca(null), 600)}

      {links && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700 }}>🔗 Links de inspeção de terceiros</div>
        <div style={{ fontSize: 12, color: C.muted, margin: "4px 0 12px" }}>Para motorista terceirizado, agregado ou temporário — sem login. Ele se identifica com nome, CPF e empresa e faz a inspeção no celular (funciona sem internet depois de aberto).</div>
        {!links.form ? <button type="button" onClick={() => setLinks({ ...links, form: { modelo_id: modelos[0]?.id || "", equipamento_id: "", dias: 7, titulo: "" } })} style={bt(C.accent)}>＋ Novo link</button> : (
          <div style={{ ...s.card, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label style={{ flex: "2 1 200px" }}><span style={s.label}>MODELO</span><select value={links.form.modelo_id} onChange={(e) => setLinks({ ...links, form: { ...links.form, modelo_id: e.target.value } })} style={s.input}>{modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></label>
              <label style={{ flex: "2 1 200px" }}><span style={s.label}>EQUIPAMENTO</span><select value={links.form.equipamento_id} onChange={(e) => setLinks({ ...links, form: { ...links.form, equipamento_id: e.target.value } })} style={s.input}>
                <option value="">Veículo do próprio terceiro (ele informa a placa)</option>{(painel.equipamentos || []).map((e) => <option key={e.id} value={e.id}>{e.tag} — {e.nome}</option>)}</select></label>
              <label style={{ flex: "1 1 90px" }}><span style={s.label}>VALE (DIAS)</span><input type="number" min={1} max={90} value={links.form.dias} onChange={(e) => setLinks({ ...links, form: { ...links.form, dias: e.target.value } })} style={s.input} /></label>
            </div>
            <label style={{ display: "block", marginTop: 8 }}><span style={s.label}>PARA QUEM / OBSERVAÇÃO (OPCIONAL)</span><input value={links.form.titulo} onChange={(e) => setLinks({ ...links, form: { ...links.form, titulo: e.target.value } })} placeholder="Transportes Silva — frete feira Ribeirão" style={s.input} /></label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
              <button type="button" onClick={() => setLinks({ ...links, form: null })} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>Cancelar</button>
              <button type="button" disabled={ocupado || !links.form.modelo_id} onClick={async () => { setOcupado(true); try { const r = await apiService.post("/inspecoes/links", links.form); setLinks({ lista: [{ ...r.link, vivo: true }, ...links.lista], form: null }); copiar(linkUrl(r.link)); } catch (e) { err(e.message); } finally { setOcupado(false); } }} style={bt(C.accent)}>Gerar e copiar</button>
            </div>
          </div>)}
        <div style={{ marginTop: 10 }}>
          {links.lista.map((l) => (
            <div key={l.id} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}`, opacity: l.vivo ? 1 : 0.5 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 220px", fontSize: 13 }}><b>{nomeModelo(l.modelo_id) || "Modelo"}</b> · {l.equipamento_id ? (painel.equipamentos.find((e) => String(e.id) === String(l.equipamento_id))?.tag || "equipamento") : "veículo do terceiro"}{l.titulo ? ` · ${l.titulo}` : ""}
                  <div style={{ fontSize: 11, color: C.muted }}>{l.vivo ? `vale até ${dataHora(l.valido_ate)}` : "expirado / desativado"} · {l.usos} inspeção(ões){l.criado_por_nome ? ` · por ${l.criado_por_nome}` : ""}</div></div>
                {l.vivo && <button type="button" onClick={() => copiar(linkUrl(l))} style={bt(C.accent, false)}>📋 Copiar</button>}
                {l.vivo && <button type="button" onClick={() => copiar(`Olá! Antes de sair, faça a inspeção do veículo pelo celular (${nomeModelo(l.modelo_id) || "inspeção"}):\n${linkUrl(l)}`)} style={bt(C.success, false)}>💬 Mensagem</button>}
                {l.vivo && <button type="button" onClick={async () => { try { await apiService.delete(`/inspecoes/links/${l.id}`); setLinks({ ...links, lista: links.lista.map((x) => (x.id === l.id ? { ...x, vivo: false, ativo: false } : x)) }); } catch (e) { err(e.message); } }} style={bt(C.danger, false)}>Desativar</button>}
              </div>
            </div>
          ))}
          {links.lista.length === 0 && <div style={{ color: C.muted, fontSize: 13, padding: 8 }}>Nenhum link ainda.</div>}
        </div>
        <div style={{ textAlign: "right", marginTop: 12 }}><button type="button" onClick={() => setLinks(null)} style={{ ...s.btn(true, C.accent), cursor: "pointer" }}>Fechar</button></div>
      </>, () => setLinks(null), 720)}

      {confirmar && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.danger }}>⚠ {confirmar.titulo}</div>
        <div style={{ fontSize: 13, color: C.textSub, marginTop: 10, lineHeight: 1.5 }}>{confirmar.texto}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button type="button" onClick={() => setConfirmar(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Voltar</button>
          <button type="button" onClick={async () => { const c = confirmar; setConfirmar(null); try { ok(await c.acao()); await carregar(); } catch (e) { err(e.message); } }} style={{ ...s.btn(true, C.danger), cursor: "pointer", flex: 1 }}>Confirmar</button>
        </div>
      </>, () => setConfirmar(null), 440)}
    </div>
  );
}

export function DetalheInspecao({ d, C, s, bt, onRelatorio, onAbrirOS, onIrParaOS, onFoto, onResolver, bloqueioAqui, onLiberar, onFechar }) {
  const i = d.inspecao; const r = RES[i.resultado] || ["—", C.muted];
  const resp = new Map((i.respostas || []).map((x) => [x.ponto_id, x]));
  const osDe = (pid) => (i.os_abertas || []).find((o) => o.ponto_id === pid);
  // 14b.2: devolução de locação → o mesmo item na inspeção de entrega (mesmo ponto ou mesmo rótulo)
  const naEntrega = (p) => (d.entrega?.respostas || []).find((x) => x.ponto_id === p.id) || (d.entrega?.respostas || []).find((x) => x.rotulo === p.rotulo);
  const ST_TXT = { ok: "OK", nok: "NÃO OK", na: "N.A." };
  // 14b.1.5: nº da OS clicável — abre a OS (trilha do evento)
  const linkOS = (o) => { const n = o.os_numero || `OS ${o.os_id}`; return onIrParaOS ? <span role="link" onClick={() => onIrParaOS(o.os_id)} title="Abrir a OS" style={{ textDecoration: "underline", cursor: "pointer", fontWeight: 700 }}>{n}</span> : n; };
  // 14b.1.4: o "NÃO OK" e o resultado ficam como registrados (como no papel); a situação mostra que já foi corrigido
  const itemCorrigido = (x) => x.status === "nok" && (x.resolvido || x.resolucao_posterior || !!osDe(x.ponto_id)?.concluida_em);
  const nokTodos = (i.respostas || []).filter((x) => x.status === "nok");
  const corrigida = nokTodos.length > 0 && nokTodos.every(itemCorrigido);
  return (<>
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>🔍 {i.equipamento_nome}</div>
      <span style={{ ...s.tag(r[1]), fontSize: 12 }}>{r[0]}</span>
      {corrigida && <span style={{ ...s.tag(C.success), fontSize: 12 }}>✓ Corrigido</span>}
    </div>
    <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>
      {i.numero || `Nº ${i.id}`} · {i.modelo_nome} · {dataHora(i.concluida_em)} · {i.executor_nome}{i.terceiro?.locatario ? ` (locatário — ${i.terceiro.empresa || ""}${i.terceiro.contrato ? ` · ${i.terceiro.contrato}` : ""})` : ""}{i.executor_tipo === "terceiro" ? ` (terceiro${i.terceiro?.empresa ? ` — ${i.terceiro.empresa}` : ""}${i.terceiro?.cpf ? ` · CPF ${String(i.terceiro.cpf).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")}` : ""})` : ""}
      {i.km != null ? ` · ${Number(i.km).toLocaleString("pt-BR")} km` : ""}{i.horimetro != null ? ` · ${Number(i.horimetro).toLocaleString("pt-BR")} h` : ""}{i.local ? ` · ${i.local}` : ""}{i.cliente ? ` · ${i.cliente}` : ""}
    </div>
    {d.entrega && <div style={{ ...s.card, padding: "8px 12px", marginTop: 10, fontSize: 12, borderColor: C.warn }}>📍 Devolução da locação de <b>{d.entrega.cliente}</b> — comparada com a entrega <b>{d.entrega.numero || `nº ${d.entrega.id}`}</b> ({dataHora(d.entrega.concluida_em)}, {d.entrega.executor_nome}). Em cada item: "entrega: … →" e o estado na devolução; em laranja o que mudou.</div>}
    {bloqueioAqui && <div style={{ ...s.card, borderColor: C.danger, padding: "10px 12px", marginTop: 10, fontSize: 13 }}>
      <div style={{ color: C.danger, fontWeight: 700 }}>⛔ {bloqueioAqui.tag} está bloqueado por esta inspeção</div>
      <div style={{ color: C.textSub, marginTop: 4 }}>Em cada item que impede o uso, escolha <b>🛠 Abrir OS</b> ou <b>✅ Resolver sem OS</b>. O equipamento é liberado sozinho quando o último for resolvido (OS conta quando for <b>concluída</b>).</div>
      {onLiberar && <button type="button" onClick={() => onLiberar(bloqueioAqui)} style={{ ...bt(C.warn, false), marginTop: 8 }}>⏳ Liberar agora (provisória / já resolvido)</button>}
    </div>}
    {d.liberacao && <div style={{ fontSize: 12, color: C.success, marginTop: 6 }}>🔓 Liberado por {d.liberacao.liberado_por_nome} em {dataHora(d.liberacao.criado_em)} — {d.liberacao.motivo_liberacao}</div>}
    {i.obs && <div style={{ fontSize: 13, marginTop: 8 }}>{i.obs}</div>}
    {(i.modelo?.vistas || []).map((v) => (
      <div key={v.codigo} style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{v.nome}</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ position: "relative", flex: "1 1 300px", maxWidth: 380, border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
            <FundoVista imagem={v.imagem} url={d.imagens?.[v.imagem]} />
            {v.pontos.map((p, k) => <div key={p.id} title={p.rotulo} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%,-50%)", width: 18, height: 18, borderRadius: "50%", background: COR[resp.get(p.id)?.status] || "#3b82f6", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #fff" }}>{k + 1}</div>)}
          </div>
          <div style={{ flex: "1 1 280px", fontSize: 12 }}>
            {v.pontos.map((p, k) => { const x = resp.get(p.id) || {}; const os = osDe(p.id); return (
              <div key={p.id} style={{ padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", gap: 6 }}><span style={{ color: C.muted, width: 16 }}>{k + 1}</span><span style={{ flex: 1 }}>{p.rotulo}</span>
                  {d.entrega && naEntrega(p) && <span title={naEntrega(p).obs || ""} style={{ fontSize: 10, color: naEntrega(p).status === x.status ? C.muted : C.warn, marginRight: 6 }}>entrega: {ST_TXT[naEntrega(p).status]}{naEntrega(p).valor != null ? ` ${naEntrega(p).valor}` : ""} →</span>}
                  {itemCorrigido(x) && <span style={{ ...s.tag(C.success), marginRight: 6 }}>✓ CORRIGIDO</span>}<b style={{ color: COR[x.status] }}>{x.status === "ok" ? "OK" : x.status === "nok" ? "NÃO OK" : "N.A."}{x.valor != null ? ` ${x.valor}${x.unidade ? ` ${x.unidade}` : ""}` : ""}</b></div>
                {x.status === "nok" && <div style={{ paddingLeft: 22 }}>
                  <div style={{ color: C.textSub }}>{x.obs}{x.impede && <span style={{ color: C.danger }}> · impede o uso</span>}</div>
                  {x.resolvido && <div style={{ color: C.success }}>🔧 Resolvido na hora: {x.resolucao}</div>}
                  {x.resolucao_posterior && <div style={{ color: C.success }}>✅ Resolvido sem OS: {x.resolucao_posterior.texto} <span style={{ color: C.muted }}>({x.resolucao_posterior.por} · {dataHora(x.resolucao_posterior.em)})</span></div>}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                    {(x.fotos || []).map((f) => d.fotos[f] && <img key={f} src={d.fotos[f]} alt="" onClick={() => onFoto(d.fotos[f], `${p.rotulo}${x.obs ? ` — ${x.obs}` : ""}`)} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 4, cursor: "zoom-in" }} />)}
                  </div>
                  {x.resolvido || x.resolucao_posterior ? null : os ? (os.concluida_em ? <div style={{ color: C.success, marginTop: 4 }}>✓ Corrigido na {linkOS(os)} (concluída em {dataHora(os.concluida_em)})</div>
                    : <span style={{ ...s.tag(C.accent), display: "inline-block", marginTop: 4 }}>🛠 {linkOS(os)} · em andamento</span>)
                    : <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {onAbrirOS && <button type="button" onClick={() => onAbrirOS(x)} style={{ ...bt(C.accent), marginTop: 4, padding: "4px 10px" }}>🛠 Abrir OS</button>}
                      {onResolver && <button type="button" onClick={() => onResolver(x)} style={{ ...bt(C.success, false), marginTop: 4, padding: "4px 10px" }}>✅ Resolver sem OS</button>}
                    </div>}
                </div>}
                {x.status !== "nok" && (x.fotos || []).length > 0 && <div style={{ display: "flex", gap: 6, paddingLeft: 22, marginTop: 4 }}>{x.fotos.map((f) => d.fotos[f] && <img key={f} src={d.fotos[f]} alt="" onClick={() => onFoto(d.fotos[f], p.rotulo)} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4, cursor: "zoom-in" }} />)}</div>}
              </div>); })}
          </div>
        </div>
      </div>
    ))}
    {i.assinatura_png && <div style={{ marginTop: 14, fontSize: 11, color: C.muted }}><img src={i.assinatura_png} alt="assinatura" style={{ maxHeight: 60, background: "#fff", borderRadius: 4, display: "block", marginBottom: 4 }} />Assinado por {i.executor_nome} · SHA-256 {String(i.hash || "").slice(0, 16)}…</div>}
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
      <button type="button" onClick={onRelatorio} style={{ ...s.btn(false), cursor: "pointer", color: C.text, background: "transparent" }}>📄 Relatório (seguradora / cliente)</button>
      <button type="button" onClick={onFechar} style={{ ...s.btn(true, C.accent), cursor: "pointer" }}>Fechar</button>
    </div>
  </>);
}
