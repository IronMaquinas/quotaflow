// components/inspecoes/TelaInspecoes.jsx — etapa 14a
// 🔍 Inspeções de equipamento (pré-uso e rotina).
//   🚚 Equipamentos — situação de cada um (⛔ bloqueado / última inspeção), inspecionar, liberar (evidência), modelo padrão
//   📋 Inspeções   — histórico, detalhe com o desenho e as fotos, "🛠 Abrir OS" do item não OK, relatório (seguradora/cliente)
//   🧩 Modelos     — importar da biblioteca do QuotaFlow, editar, criar
// Inspeções feitas sem internet ficam no aparelho e são enviadas sozinhas quando a conexão volta.
import { useState, useEffect, useMemo, useCallback } from "react";
import apiService from "../../services/apiService";
import ExecutarInspecao from "./ExecutarInspecao";
import EditorModeloInspecao, { modeloVazio } from "./EditorModeloInspecao";
import { FundoVista } from "./Esquemas";
import * as Fila from "../../utils/filaInspecoes";
import { abrirRelatorioInspecao, prepararJanela } from "../../utils/gerarRelatorioInspecao";

const RES = { aprovado: ["✓ Aprovado", "#22c55e"], ressalvas: ["⚠ Ressalvas", "#f59e0b"], reprovado: ["⛔ Reprovado", "#ef4444"] };
const COR = { ok: "#22c55e", nok: "#ef4444", na: "#64748b" };
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const chaveTenant = () => { try { const u = JSON.parse(localStorage.getItem("usuario") || "{}"); return String(u.tenant_id ?? u.tenantId ?? u.email ?? "t"); } catch { return "t"; } };

export default function TelaInspecoes({ C, s, onAbrirOS }) {
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

  const modal = (conteudo, fechar, largura = 640) => (
    <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, overflowY: "auto" }} onClick={fechar}>
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
  const abas = [["equip", `🚚 Equipamentos${bloqueados ? ` (⛔ ${bloqueados})` : ""}`], ["hist", "📋 Inspeções"], ["modelos", "🧩 Modelos"]];

  return (
    <div style={{ padding: "20px 22px", maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 700, flex: 1 }}>🔍 Inspeções de equipamento</div>
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

      {painel && aba === "equip" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 10 }}>
          {eqs.map((e) => { const r = e.ultima && RES[e.ultima.resultado]; return (
            <div key={e.id} style={{ ...s.card, padding: 14, borderColor: e.bloqueado ? C.danger : C.border }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{e.tag}</div><div style={{ fontSize: 12, color: C.textSub }}>{e.nome}{e.local ? ` · ${e.local}` : ""}</div></div>
                {e.bloqueado ? <span style={s.tag(C.danger)}>⛔ BLOQUEADO</span> : r ? <span style={s.tag(r[1])}>{r[0]}</span> : <span style={s.tag(C.muted)}>Sem inspeção</span>}
              </div>
              {e.bloqueado && <div style={{ fontSize: 12, color: C.danger, marginTop: 6 }}>{e.bloqueio_motivo} · {dataHora(e.bloqueado_em)}</div>}
              {e.ultima && <div style={{ fontSize: 11, color: C.muted, marginTop: 6, cursor: "pointer" }} onClick={() => abrir(e.ultima.id)}>Última: {dataHora(e.ultima.em)} · {e.ultima.executor}{e.ultima.km != null ? ` · ${Number(e.ultima.km).toLocaleString("pt-BR")} km` : ""} ›</div>}
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Modelo: {editar ? (
                <select value={e.inspecao_modelo_id || ""} onChange={(x) => definirModelo(e, x.target.value)} style={{ ...s.input, width: "auto", padding: "3px 6px", fontSize: 11, display: "inline-block" }}>
                  <option value="">— escolher na hora —</option>{modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>) : (nomeModelo(e.inspecao_modelo_id) || "escolher na hora")}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={() => inspecionar(e)} style={bt(C.accent)}>🔍 Inspecionar</button>
                {e.bloqueado && editar && <button type="button" onClick={() => setLiberar({ equipamento: e, motivo: "" })} style={bt(C.success)}>🔓 Liberar</button>}
                {e.total > 0 && <button type="button" onClick={() => { setFiltroEq(String(e.id)); setAba("hist"); }} style={bt(C.textSub, false)}>Histórico ({e.total})</button>}
              </div>
            </div>); })}
          {eqs.length === 0 && <div style={{ color: C.muted }}>Nenhum equipamento cadastrado.</div>}
        </div>
      )}

      {painel && aba === "hist" && (
        <div>
          <select value={filtroEq} onChange={(e) => setFiltroEq(e.target.value)} style={{ ...s.input, maxWidth: 320, marginBottom: 10 }}>
            <option value="">Todos os equipamentos</option>{(painel.equipamentos || []).map((e) => <option key={e.id} value={e.id}>{e.tag} — {e.nome}</option>)}
          </select>
          <div style={{ ...s.card, overflow: "hidden" }}>
            {listaF.map((i, k) => { const r = RES[i.resultado] || ["—", C.muted]; return (
              <div key={i.id} onClick={() => abrir(i.id)} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: k < listaF.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer", flexWrap: "wrap" }}>
                <div style={{ flex: "2 1 220px" }}><div style={{ fontWeight: 600, fontSize: 13 }}>{i.equipamento_nome}</div><div style={{ fontSize: 11, color: C.muted }}>{i.modelo_nome} · {i.executor_nome}{i.executor_tipo === "terceiro" ? " (terceiro)" : ""}</div></div>
                <div style={{ fontSize: 12, color: C.textSub }}>{dataHora(i.concluida_em)}</div>
                {(i.os_abertas || []).length > 0 && <span style={s.tag(C.accent)}>🛠 {i.os_abertas.length} OS</span>}
                <span style={s.tag(r[1])}>{r[0]}</span>
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
                <div style={{ flex: "2 1 220px" }}><div style={{ fontWeight: 600, fontSize: 13 }}>{m.nome}</div>
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
        <div style={{ fontSize: 13, color: C.danger, marginTop: 6 }}>Bloqueado: {liberar.equipamento.bloqueio_motivo}</div>
        <label style={{ display: "block", marginTop: 12 }}><span style={s.label}>POR QUE ESTÁ LIBERANDO? (FICA REGISTRADO COM SEU NOME)</span>
          <textarea rows={3} autoFocus value={liberar.motivo} onChange={(e) => setLiberar({ ...liberar, motivo: e.target.value })} placeholder="Reparo feito na OS nº… / liberação provisória até a oficina…" style={{ ...s.input, resize: "vertical" }} /></label>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={() => setLiberar(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          <button type="button" disabled={ocupado || liberar.motivo.trim().length < 5} onClick={async () => { setOcupado(true); try { await apiService.post(`/inspecoes/equipamentos/${liberar.equipamento.id}/liberar`, { motivo: liberar.motivo }); ok(`${liberar.equipamento.tag} liberado.`); setLiberar(null); await carregar(); } catch (e) { err(e.message); } finally { setOcupado(false); } }}
            style={{ ...s.btn(!ocupado && liberar.motivo.trim().length >= 5, C.success), flex: 1 }}>Liberar</button>
        </div>
      </>, () => setLiberar(null), 480)}

      {ver && modal(<DetalheInspecao d={ver} C={C} s={s} bt={bt} onRelatorio={relatorio} onAbrirOS={onAbrirOS ? abrirOS : null} onFechar={() => setVer(null)} />, () => setVer(null), 860)}

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

function DetalheInspecao({ d, C, s, bt, onRelatorio, onAbrirOS, onFechar }) {
  const i = d.inspecao; const r = RES[i.resultado] || ["—", C.muted];
  const resp = new Map((i.respostas || []).map((x) => [x.ponto_id, x]));
  const osDe = (pid) => (i.os_abertas || []).find((o) => o.ponto_id === pid);
  return (<>
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>🔍 {i.equipamento_nome}</div>
      <span style={{ ...s.tag(r[1]), fontSize: 12 }}>{r[0]}</span>
    </div>
    <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>
      Nº {i.id} · {i.modelo_nome} · {dataHora(i.concluida_em)} · {i.executor_nome}{i.executor_tipo === "terceiro" ? " (terceiro)" : ""}
      {i.km != null ? ` · ${Number(i.km).toLocaleString("pt-BR")} km` : ""}{i.horimetro != null ? ` · ${Number(i.horimetro).toLocaleString("pt-BR")} h` : ""}{i.local ? ` · ${i.local}` : ""}{i.cliente ? ` · ${i.cliente}` : ""}
    </div>
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
                  <b style={{ color: COR[x.status] }}>{x.status === "ok" ? "OK" : x.status === "nok" ? "NÃO OK" : "N.A."}{x.valor != null ? ` ${x.valor}${x.unidade ? ` ${x.unidade}` : ""}` : ""}</b></div>
                {x.status === "nok" && <div style={{ paddingLeft: 22 }}>
                  <div style={{ color: C.textSub }}>{x.obs}{x.impede && <span style={{ color: C.danger }}> · impede o uso</span>}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                    {(x.fotos || []).map((f) => d.fotos[f] && <a key={f} href={d.fotos[f]} target="_blank" rel="noreferrer"><img src={d.fotos[f]} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 4 }} /></a>)}
                  </div>
                  {os ? <span style={{ ...s.tag(C.accent), display: "inline-block", marginTop: 4 }}>🛠 OS {os.os_numero || os.os_id}</span>
                    : onAbrirOS && <button type="button" onClick={() => onAbrirOS(x)} style={{ ...bt(C.accent), marginTop: 4, padding: "4px 10px" }}>🛠 Abrir OS</button>}
                </div>}
                {x.status !== "nok" && (x.fotos || []).length > 0 && <div style={{ display: "flex", gap: 6, paddingLeft: 22, marginTop: 4 }}>{x.fotos.map((f) => d.fotos[f] && <a key={f} href={d.fotos[f]} target="_blank" rel="noreferrer"><img src={d.fotos[f]} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4 }} /></a>)}</div>}
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
