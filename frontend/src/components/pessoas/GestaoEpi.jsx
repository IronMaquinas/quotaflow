// components/pessoas/GestaoEpi.jsx — etapa 12d.2
// 🦺 EPI → 👷 Gestão de funcionários: cada colaborador com o kit da função e a situação de cada EPI
// (✓ em dia · ⚠ troca em breve · 🔴 troca vencida · ✗ não entregue).
// "Entregar": ficha pré-preenchida (kit + tamanhos + item sugerido), o colaborador confere e ASSINA na tela,
// o técnico confirma → baixa no Estoque + nº EPI-AAAA-NNNN. Histórico com devolução. Ficha NR-6 para imprimir/PDF.
import { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";
import AssinaturaTela from "../shared/AssinaturaTela";
import { abrirFichaEpi, prepararJanela } from "../../utils/gerarFichaEpi";

const SIT = {
  ok:           { l: "Em dia",         i: "✓", c: "#22c55e" },
  vence:        { l: "Troca em breve", i: "⚠", c: "#f59e0b" },
  vencido:      { l: "Troca vencida",  i: "🔴", c: "#ef4444" },
  nao_entregue: { l: "Não entregue",   i: "✗", c: "#94a3b8" },
};
const MOTIVO_L = { entrega: "Entrega", admissao: "Admissão", troca: "Troca", reposicao: "Reposição", perda: "Perda", dano: "Dano", outro: "Outro" };
const dataBR = (d) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const dataIsoBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fmtQtd = (n) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export default function GestaoEpi({ C, s, modal, campo, epiItens = [], nomeTipo, onAviso, onErro, onMudou, onCadastrarEpi, podeCadastrar }) {
  const [dados, setDados] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("");
  const [entrega, setEntrega] = useState(null);   // { colab, motivo, obs, linhas: [{ on, tipo, epi_item_id, quantidade }] }
  const [assinatura, setAssinatura] = useState(null);
  const [historico, setHistorico] = useState(null); // { colab, entregas }
  const [devolver, setDevolver] = useState(null);   // { item, estado, obs }
  const [salvando, setSalvando] = useState(false);
  const [semMigration, setSemMigration] = useState(false);

  const carregar = async () => {
    try { setDados(await apiService.get("/pessoas/epi/painel")); setSemMigration(false); }
    catch (e) { if (/028/.test(e.message || "")) setSemMigration(true); else onErro(e.message); }
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line

  const colabs = dados?.colaboradores || [];
  const resumo = useMemo(() => ({
    total: colabs.length,
    vencido: colabs.filter((c) => c.resumo.vencido > 0).length,
    nao_entregue: colabs.filter((c) => c.resumo.nao_entregue > 0).length,
    sem_kit: colabs.filter((c) => !c.resumo.total).length,
  }), [colabs]);
  const lista = colabs.filter((c) => {
    if (filtro === "vencido" && !c.resumo.vencido) return false;
    if (filtro === "nao_entregue" && !c.resumo.nao_entregue) return false;
    if (filtro === "sem_kit" && c.resumo.total) return false;
    const b = semAcento(busca.trim());
    return !b || semAcento(`${c.nome} ${c.funcao_nome || ""}`).includes(b);
  });

  const abrirEntrega = (c) => {
    setAssinatura(null);
    setEntrega({
      colab: c, motivo: c.itens.every((i) => i.situacao === "nao_entregue") ? "admissao" : "entrega", obs: "",
      linhas: c.itens.map((i) => ({
        on: i.situacao !== "ok", tipo: i.tipo, epi_item_id: i.sugerido?.epi_item_id ? String(i.sugerido.epi_item_id) : "",
        quantidade: i.quantidade_kit || 1, troca_dias: i.troca_dias_kit || "", kit: true,
      })),
    });
  };
  // 12d.3: cadastrou um EPI pelo atalho → a linha vazia daquele tipo já pega o item novo
  useEffect(() => {
    if (!entrega) return;
    let mudou = false;
    const linhas = entrega.linhas.map((l) => {
      if (l.epi_item_id || !l.tipo) return l;
      const op = epiItens.find((e) => e.tipo === l.tipo && e.item_ativo !== false);
      if (!op) return l;
      mudou = true; return { ...l, epi_item_id: String(op.id) };
    });
    if (mudou) setEntrega({ ...entrega, linhas });
  }, [epiItens]); // eslint-disable-line

  const opcoesDo = (tipo) => epiItens.filter((e) => (!tipo || e.tipo === tipo) && e.item_ativo !== false);
  const epiPor = (id) => epiItens.find((e) => String(e.id) === String(id));
  const mudaLinha = (k, campoL, v) => setEntrega({ ...entrega, linhas: entrega.linhas.map((l, j) => (j === k ? { ...l, [campoL]: v } : l)) });

  const confirmarEntrega = async () => {
    setSalvando(true);
    try {
      const itens = entrega.linhas.filter((l) => l.on && l.epi_item_id).map((l) => ({ epi_item_id: l.epi_item_id, quantidade: Number(l.quantidade), troca_dias: l.troca_dias || null }));
      const r = await apiService.post("/pessoas/epi/entregas", { colaborador_id: entrega.colab.id, motivo: entrega.motivo, obs: entrega.obs, assinatura_png: assinatura, itens });
      const colab = entrega.colab;
      setEntrega(null); setAssinatura(null);
      onAviso(`Entrega ${r?.entrega?.numero || ""} registrada para ${colab.nome} — baixa feita no Estoque.`);
      await carregar(); onMudou?.();
    } catch (e) { onErro(e.message); }
    finally { setSalvando(false); }
  };

  const abrirHistorico = async (c) => {
    try { const r = await apiService.get(`/pessoas/epi/colaboradores/${c.id}/historico`); setHistorico({ colab: c, entregas: r?.entregas || [] }); }
    catch (e) { onErro(e.message); }
  };
  const confirmarDevolucao = async () => {
    const d = devolver; setDevolver(null);
    try {
      await apiService.post(`/pessoas/epi/entrega-itens/${d.item.id}/devolver`, { estado: d.estado, obs: d.obs });
      onAviso(d.estado === "bom" ? `${d.item.item_nome}: devolvido e de volta ao estoque (endereço EPI).` : `${d.item.item_nome}: devolvido como danificado (descarte).`);
      await carregar(); onMudou?.();
      if (historico) await abrirHistorico(historico.colab);
    } catch (e) { onErro(e.message); }
  };
  const imprimirFicha = async (c) => {
    const janela = prepararJanela();
    try { const f = await apiService.get(`/pessoas/epi/colaboradores/${c.id}/ficha-nr6`); abrirFichaEpi(f, janela); }
    catch (e) { try { janela?.close(); } catch { /* ok */ } onErro(e.message); }
  };

  if (semMigration) return <div style={{ ...s.card, padding: 24, color: C.textSub }}>Rode a migration <b>028_epi_entregas.sql</b> no Supabase para registrar entregas de EPI.</div>;
  if (!dados) return <div style={{ color: C.muted }}>Carregando…</div>;

  // validação da ficha de entrega
  const selecionadas = entrega ? entrega.linhas.filter((l) => l.on) : [];
  const problemas = entrega ? selecionadas.map((l) => {
    const e = epiPor(l.epi_item_id);
    if (!e) return `${nomeTipo(l.tipo) || "EPI"}: escolha o item`;
    if (!e.ca) return `${e.item_nome}: sem CA cadastrado`;
    if (e.ca_situacao === "vencido") return `${e.item_nome}: CA vencido`;
    if (!(Number(l.quantidade) > 0)) return `${e.item_nome}: quantidade`;
    if (e.saldo_total < Number(l.quantidade)) return `${e.item_nome}: saldo ${fmtQtd(e.saldo_total)} ${e.unidade}`;
    return null;
  }).filter(Boolean) : [];
  const podeConfirmar = entrega && !salvando && selecionadas.length > 0 && !problemas.length && !!assinatura;

  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        {[["", "Colaboradores", resumo.total, C.accent], ["vencido", "Com troca vencida", resumo.vencido, SIT.vencido.c], ["nao_entregue", "Com EPI não entregue", resumo.nao_entregue, SIT.nao_entregue.c], ["sem_kit", "Função sem kit", resumo.sem_kit, C.muted]].map(([k, l, n, cor]) => (
          <button key={l} onClick={() => setFiltro(filtro === k ? "" : k)}
            style={{ ...s.card, padding: "10px 16px", cursor: "pointer", borderColor: filtro === k && k ? cor : C.border, background: filtro === k && k ? `${cor}18` : C.surface, textAlign: "left", fontFamily: "inherit", color: C.text }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: cor }}>{n}</div>
            <div style={{ fontSize: 11, color: C.textSub }}>{l}</div>
          </button>
        ))}
      </div>
      {colabs.length > 0 && <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar colaborador ou função…" style={{ ...s.input, maxWidth: 320, padding: "7px 10px", fontSize: 12, marginBottom: 12 }} />}

      {colabs.length === 0 ? (
        <div style={{ ...s.card, padding: 28, textAlign: "center", color: C.textSub }}>Nenhum colaborador ativo. Cadastre em 👥 Colaboradores e ligue a função.</div>
      ) : lista.length === 0 ? (
        <div style={{ ...s.card, padding: 20, textAlign: "center", color: C.textSub }}>Ninguém com esses filtros.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {lista.map((c) => (
            <div key={c.id} style={{ ...s.card, padding: "12px 16px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{c.nome}</div>
                  <div style={{ fontSize: 12, color: C.textSub }}>
                    {c.funcao_nome || "Sem função"}
                    {[c.tamanhos.calcado && `👟 ${c.tamanhos.calcado}`, c.tamanhos.camisa && `👕 ${c.tamanhos.camisa}`, c.tamanhos.calca && `👖 ${c.tamanhos.calca}`, c.tamanhos.luva && `🧤 ${c.tamanhos.luva}`].filter(Boolean).map((t) => ` · ${t}`).join("")}
                  </div>
                </div>
                {c.resumo.total > 0 && <span style={{ fontSize: 12, color: C.textSub }}>{c.resumo.ok + c.resumo.vence}/{c.resumo.total} em dia</span>}
                <button onClick={() => abrirEntrega(c)} disabled={!c.resumo.total && !epiItens.length} style={{ ...s.btn(true), cursor: "pointer", padding: "6px 12px", fontSize: 12 }}>🦺 Entregar</button>
                <button onClick={() => abrirHistorico(c)} style={{ ...s.btn(false), cursor: "pointer", padding: "6px 12px", fontSize: 12, color: C.text }}>📋 Histórico</button>
                <button onClick={() => imprimirFicha(c)} style={{ ...s.btn(false), cursor: "pointer", padding: "6px 12px", fontSize: 12, color: C.text }}>🖨 Ficha NR-6</button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {c.itens.length === 0 && <span style={{ fontSize: 12, color: C.muted }}>{c.funcao_id ? "A função não tem kit de EPI — configure em 🧰 Kits por função." : "Sem função ligada — escolha a função no cadastro do colaborador."}</span>}
                {c.itens.map((i) => {
                  const sc = SIT[i.situacao];
                  const det = i.situacao === "nao_entregue" ? "não entregue" : i.proxima_troca ? (i.dias < 0 ? `troca venceu há ${-i.dias} d` : `troca em ${dataIsoBR(i.proxima_troca)}`) : "em uso";
                  return <span key={i.tipo} title={i.item ? `${i.item.item_nome} · entregue em ${dataBR(i.item.entregue_em)}` : ""} style={s.tag(sc.c)}>{sc.i} {i.tipo_nome} · {det}</span>;
                })}
                {(c.extras || []).map((x) => (
                  <button key={`x${x.id}`} onClick={() => abrirHistorico(c)} title="Recebido numa função anterior ou fora do kit — se não usa mais, registre a devolução no Histórico"
                    style={{ ...s.tag("#a78bfa"), cursor: "pointer", fontFamily: "inherit", border: "none" }}>↩ {nomeTipo(x.tipo) || x.item_nome} · fora do kit atual</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── ficha de entrega ─── */}
      {entrega && modal(<>
        <div style={{ fontSize: 17, fontWeight: 700 }}>🦺 Entrega de EPI — {entrega.colab.nome}</div>
        <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>
          {entrega.colab.funcao_nome || "Sem função"}
          {[entrega.colab.tamanhos.calcado && `👟 ${entrega.colab.tamanhos.calcado}`, entrega.colab.tamanhos.camisa && `👕 ${entrega.colab.tamanhos.camisa}`, entrega.colab.tamanhos.calca && `👖 ${entrega.colab.tamanhos.calca}`, entrega.colab.tamanhos.luva && `🧤 ${entrega.colab.tamanhos.luva}`].filter(Boolean).map((t) => ` · ${t}`).join("")}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
          {campo("MOTIVO", <select value={entrega.motivo} onChange={(e) => setEntrega({ ...entrega, motivo: e.target.value })} style={s.input}>
            {(dados.motivos || Object.keys(MOTIVO_L)).map((m) => <option key={m} value={m}>{MOTIVO_L[m] || m}</option>)}</select>, "1 1 160px")}
        </div>
        <div style={{ marginTop: 12, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
          {entrega.linhas.map((l, k) => {
            const e = epiPor(l.epi_item_id);
            const ops = opcoesDo(l.kit ? l.tipo : null);
            return (
              <div key={k} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "8px 10px", borderBottom: k < entrega.linhas.length - 1 ? `1px solid ${C.border}` : "none", opacity: l.on ? 1 : 0.5 }}>
                <input type="checkbox" checked={l.on} onChange={(ev) => mudaLinha(k, "on", ev.target.checked)} aria-label="entregar este EPI" />
                <div style={{ flex: "1 1 130px", fontSize: 12, fontWeight: 600 }}>{l.kit ? nomeTipo(l.tipo) : "Outro EPI"}</div>
                <select value={l.epi_item_id} onChange={(ev) => mudaLinha(k, "epi_item_id", ev.target.value)} style={{ ...s.input, flex: "3 1 220px", padding: "6px 8px", fontSize: 12 }}>
                  <option value="">{ops.length ? "Escolha o item…" : "Sem item desse tipo no Estoque de EPI"}</option>
                  {ops.map((o) => <option key={o.id} value={o.id}>{o.item_nome}{o.tamanho ? ` (tam. ${o.tamanho})` : ""} — saldo {fmtQtd(o.saldo_total)}{o.ca_situacao === "vencido" ? " · CA VENCIDO" : ""}</option>)}
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.textSub }}>qtd
                  <input type="number" min={1} value={l.quantidade} onChange={(ev) => mudaLinha(k, "quantidade", ev.target.value)} style={{ ...s.input, width: 56, padding: "5px 6px", fontSize: 12 }} /></label>
                {!ops.length && l.kit && podeCadastrar && onCadastrarEpi
                  ? <button type="button" onClick={() => onCadastrarEpi(l.tipo)} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 10px", fontSize: 11, color: C.accent }}>＋ Cadastrar</button>
                  : <span style={{ fontSize: 11, color: e?.ca_situacao === "vencido" || !e?.ca ? SIT.vencido.c : C.muted, minWidth: 70 }}>{e ? (e.ca ? `CA ${e.ca}` : "sem CA") : ""}</span>}
              </div>
            );
          })}
          <div style={{ padding: "8px 10px" }}>
            <button type="button" onClick={() => setEntrega({ ...entrega, linhas: [...entrega.linhas, { on: true, tipo: "", epi_item_id: "", quantidade: 1, kit: false }] })}
              style={{ background: "none", border: "none", color: C.accent, fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>＋ Outro EPI (fora do kit)</button>
          </div>
        </div>
        {problemas.length > 0 && <div style={{ fontSize: 12, color: SIT.vencido.c, marginTop: 8 }}>⚠ {problemas.join(" · ")}</div>}
        <div style={{ marginTop: 10 }}>{campo("OBSERVAÇÕES", <textarea rows={2} value={entrega.obs} onChange={(e) => setEntrega({ ...entrega, obs: e.target.value })} style={{ ...s.input, resize: "vertical" }} />)}</div>
        <div style={{ fontSize: 11, color: C.textSub, marginTop: 12, lineHeight: 1.5, padding: 10, border: `1px solid ${C.border}`, borderRadius: 8 }}>
          <b style={{ color: C.text }}>Colaborador, confira os itens e assine:</b> declaro ter recebido gratuitamente os EPIs acima, com CA, e ter sido orientado(a) sobre o uso, a guarda e a conservação; comprometo-me a usá-los só para a finalidade a que se destinam e a comunicar qualquer alteração que os torne impróprios (NR-6).
        </div>
        <div style={{ marginTop: 10 }}><AssinaturaTela C={C} s={s} onChange={setAssinatura} /></div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button onClick={() => setEntrega(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          <button onClick={confirmarEntrega} disabled={!podeConfirmar} title={!assinatura ? "Falta a assinatura do colaborador" : ""} style={{ ...s.btn(!!podeConfirmar), flex: 2 }}>
            {salvando ? "Registrando…" : `✓ Confirmar entrega (${selecionadas.length} EPI) e dar baixa`}
          </button>
        </div>
      </>, () => !salvando && setEntrega(null), 720)}

      {/* ─── histórico ─── */}
      {historico && modal(<>
        <div style={{ fontSize: 17, fontWeight: 700 }}>📋 EPIs de {historico.colab.nome}</div>
        <div style={{ fontSize: 12, color: C.textSub, margin: "4px 0 12px" }}>Todas as entregas, com o que está em uso e o que já foi devolvido.</div>
        {historico.entregas.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>Nenhuma entrega ainda.</div>}
        <div style={{ display: "grid", gap: 10 }}>
          {[...historico.entregas].reverse().map((e) => (
            <div key={e.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 12, color: C.textSub, marginBottom: 6 }}><b style={{ color: C.text, fontFamily: "monospace" }}>{e.numero}</b> · {dataBR(e.entregue_em)} · {MOTIVO_L[e.motivo] || e.motivo}{e.entregue_por_nome ? ` · por ${e.entregue_por_nome}` : ""}</div>
              {e.itens.map((i) => (
                <div key={i.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12, padding: "4px 0" }}>
                  <div style={{ flex: "2 1 200px" }}>{i.item_nome} <span style={{ color: C.muted }}>· CA {i.ca || "—"} · qtd {fmtQtd(i.quantidade)}{i.proxima_troca ? ` · troca ${dataIsoBR(i.proxima_troca)}` : ""}</span></div>
                  {i.devolvido_em
                    ? <span style={s.tag(C.muted)}>{i.devolucao_estado === "substituido" ? "Substituído" : i.devolucao_estado === "bom" ? "Devolvido (bom)" : "Devolvido (danificado)"} · {dataBR(i.devolvido_em)}</span>
                    : <button onClick={() => setDevolver({ item: i, estado: "bom", obs: "" })} style={{ ...s.btn(false), cursor: "pointer", padding: "3px 10px", fontSize: 11, color: C.text }}>↩ Devolver</button>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={() => imprimirFicha(historico.colab)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>🖨 Ficha NR-6</button>
          <button onClick={() => setHistorico(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Fechar</button>
        </div>
      </>, () => setHistorico(null), 640)}

      {/* ─── devolução ─── */}
      {devolver && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700 }}>↩ Devolução de EPI</div>
        <div style={{ fontSize: 13, color: C.textSub, margin: "8px 0 12px" }}>{devolver.item.item_nome} · qtd {fmtQtd(devolver.item.quantidade)}</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[["bom", "Em bom estado — volta ao estoque (EPI)"], ["danificado", "Danificado — descarte"]].map(([k, l]) => (
            <button key={k} onClick={() => setDevolver({ ...devolver, estado: k })} style={{ ...s.btn(devolver.estado === k), cursor: "pointer", flex: 1, fontSize: 12, ...(devolver.estado !== k ? { color: C.text } : {}) }}>{l}</button>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>{campo("OBSERVAÇÃO (OPCIONAL)", <input value={devolver.obs} onChange={(e) => setDevolver({ ...devolver, obs: e.target.value })} style={s.input} />)}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={() => setDevolver(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          <button onClick={confirmarDevolucao} style={{ ...s.btn(true), cursor: "pointer", flex: 1 }}>Registrar devolução</button>
        </div>
      </>, () => setDevolver(null), 480)}
    </>
  );
}
