// components/pessoas/TelaEpi.jsx — etapa 12d.1 · 12d.1b
// Aba "🦺 EPI" de Pessoas. Sub-abas (12d.2): 👷 Gestão de funcionários (GestaoEpi.jsx — entrega, histórico,
// ficha NR-6) · 🧰 Kits por função (o que cada função recebe — base dos custos futuros) · 📦 Estoque (consulta/cadastro).
// O EPI é um item do Estoque marcado como EPI (tipo do catálogo, CA, validade, troca, tamanho).
// "＋ Novo EPI" cria o item no Estoque por trás; ligar item já existente é opcional.
// O recebimento deixa o saldo na doca RECEBIMENTO; "→ Guardar no EPI" usa a transferência do Estoque.
// Confirmações sempre no modal do app (nunca window.confirm/alert).
import { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";
import GestaoEpi from "./GestaoEpi"; // etapa 12d.2

const SIT_CA = {
  vencido:      { l: "CA vencido",       c: "#ef4444" },
  vence_30:     { l: "CA vence em 30 d", c: "#f59e0b" },
  ok:           { l: "CA em dia",        c: "#22c55e" },
  sem_validade: { l: "CA sem validade",  c: "#64748b" },
};
const dataBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fmtQtd = (n) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export default function TelaEpi({ C, s, funcoes = [], listas = {}, modal, campo, onAviso, onErro, onFuncoesMudou }) {
  const [dados, setDados] = useState(null);
  const [form, setForm] = useState(null);
  const [itensConsumo, setItensConsumo] = useState([]);
  const [buscaItem, setBuscaItem] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("");
  const [confirmar, setConfirmar] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [semMigration, setSemMigration] = useState(false);
  const [vista, setVista] = useState("gestao");
  const [kitEdit, setKitEdit] = useState(null);     // { funcao, epis } — edição do kit na sub-aba Kits
  const [buscaTipo, setBuscaTipo] = useState("");    // autocompletar do tipo
  const [abrirTipos, setAbrirTipos] = useState(false);
  const [novoTipo, setNovoTipo] = useState(null);    // { nome, grade }
  const [guardar, setGuardar] = useState(null);      // { item, quantidade }

  const carregar = async () => {
    try { setDados(await apiService.get("/pessoas/epi")); setSemMigration(false); }
    catch (e) { if (/026/.test(e.message || "")) setSemMigration(true); else onErro(e.message); }
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line

  const tipos = dados?.tipos_epi || [];
  const nomeTipo = (c) => tipos.find((t) => t.codigo === c)?.nome || c;
  const itens = dados?.itens || [];
  const editar = !!dados?.pode_editar;

  const resumo = useMemo(() => ({
    total: itens.length,
    vencido: itens.filter((i) => i.ca_situacao === "vencido").length,
    vence_30: itens.filter((i) => i.ca_situacao === "vence_30").length,
    sem_saldo: itens.filter((i) => i.saldo_total <= 0).length,
  }), [itens]);

  const filtrados = itens.filter((i) => {
    if (filtro === "vencido" && i.ca_situacao !== "vencido") return false;
    if (filtro === "vence_30" && i.ca_situacao !== "vence_30") return false;
    if (filtro === "sem_saldo" && i.saldo_total > 0) return false;
    const b = semAcento(busca.trim());
    return !b || semAcento(`${i.item_nome} ${i.sku || ""} ${nomeTipo(i.tipo)} ${i.ca || ""}`).includes(b);
  });

  // Kits das funções × itens cadastrados: categoria do kit sem item de EPI = não dá para entregar
  const cobertura = funcoes.filter((f) => (f.epis || []).length).map((f) => ({
    funcao: f,
    kit: f.epis.map((k) => {
      const meus = itens.filter((i) => i.tipo === k.tipo);
      return { ...k, itens: meus.length, saldo: meus.reduce((s2, i) => s2 + i.saldo_total, 0) };
    }),
  }));
  const faltando = [...new Set(cobertura.flatMap((c) => c.kit.filter((k) => !k.itens).map((k) => k.tipo)))];

  const tipoDe = (c) => tipos.find((t) => t.codigo === c);
  const GRADE_L = { calcado: "calçado", camisa: "camisa/vestimenta", calca: "calça", luva: "luva" };
  const escolherTipo = (t, f = form) => {
    setBuscaTipo(t.nome); setAbrirTipos(false);
    setForm({ ...f, tipo: t.codigo, troca_dias: f.troca_dias || t.troca_dias_padrao || "", novo_unidade: f.novo_unidade_manual ? f.novo_unidade : (t.grade === "calcado" || t.grade === "luva" ? "PAR" : "UN") });
  };
  const abrirNovo = async (tipo = "") => {
    setBuscaItem(""); setNovoTipo(null);
    const t = tipoDe(tipo);
    setBuscaTipo(t?.nome || ""); setAbrirTipos(false);
    setForm({ modo: "novo", item_consumo_id: "", novo_nome: "", novo_unidade: t && (t.grade === "calcado" || t.grade === "luva") ? "PAR" : "UN", novo_sku: "", tipo, tamanho: "", ca: "", ca_validade: "", troca_dias: t?.troca_dias_padrao || "", obs: "" });
    try { const r = await apiService.get("/pessoas/epi/itens-consumo"); setItensConsumo(r?.itens || []); }
    catch { setItensConsumo([]); } // a lista só serve para "já tenho o item"; sem ela, segue o cadastro novo
  };
  const criarTipo = async () => {
    try {
      const t = await apiService.post("/pessoas/epi/tipos", { nome: novoTipo.nome, grade: novoTipo.grade || null });
      setNovoTipo(null); await carregar();
      setDados((d) => (d ? { ...d, tipos_epi: [...(d.tipos_epi || []), t] } : d));
      escolherTipo(t);
      onAviso(`Tipo “${t.nome}” criado na sua empresa.`);
    } catch (e) { onErro(e.message); }
  };
  const guardarNoEpi = async () => {
    const g = guardar; setGuardar(null);
    try {
      await apiService.post("/estoque/movimentacoes/transferir", { item_consumo_id: g.item.item_consumo_id, quantidade: Number(g.quantidade), endereco_origem: "RECEBIMENTO", endereco_destino: "EPI", observacao: "Guardado no EPI pela tela de EPI" });
      onAviso(`${fmtQtd(g.quantidade)} ${g.item.unidade} de ${g.item.item_nome} guardado(s) no endereço EPI.`); await carregar();
    } catch (e) { onErro(e.message); }
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const f = form;
      const corpo = { tipo: f.tipo, tamanho: f.tamanho || null, ca: f.ca, ca_validade: f.ca_validade || null, troca_dias: f.troca_dias === "" ? null : f.troca_dias, obs: f.obs };
      if (f.id) await apiService.put(`/pessoas/epi/itens/${f.id}`, corpo);
      else if (f.modo === "estoque") await apiService.post("/pessoas/epi/itens", { ...corpo, item_consumo_id: f.item_consumo_id });
      else await apiService.post("/pessoas/epi/itens", { ...corpo, novo_item: { nome: f.novo_nome, unidade_medida: f.novo_unidade, sku: f.novo_sku } });
      setForm(null);
      onAviso(f.id ? "EPI atualizado." : f.modo === "novo" ? "EPI cadastrado (o item foi criado no Estoque). Compre pelo fluxo normal; ao receber, use “Guardar no EPI”." : "Item do Estoque ligado ao EPI.");
      await carregar();
    } catch (e) { onErro(e.message); }
    finally { setSalvando(false); }
  };

  const desmarcar = async () => {
    const i = confirmar; setConfirmar(null);
    try { await apiService.delete(`/pessoas/epi/itens/${i.id}`); onAviso(`${i.item_nome} não é mais EPI (continua no Estoque).`); await carregar(); }
    catch (e) { onErro(e.message); }
  };

  if (semMigration) return <div style={{ ...s.card, padding: 24, color: C.textSub }}>Rode a migration <b>026_epi_itens.sql</b> no Supabase para usar o EPI.</div>;
  if (!dados) return <div style={{ color: C.muted }}>Carregando…</div>;

  const itensEscolha = itensConsumo.filter((i) => !i.ja_epi && (!buscaItem.trim() || semAcento(`${i.nome} ${i.sku || ""}`).includes(semAcento(buscaItem.trim()))));
  const okForm = form && !salvando && form.tipo && (form.id || (form.modo === "estoque" ? form.item_consumo_id : true));
  const tipoForm = form ? tipoDe(form.tipo) : null;
  const sugestoesTipo = tipos.filter((t) => !buscaTipo.trim() || semAcento(t.nome).includes(semAcento(buscaTipo.trim()))).slice(0, 8);
  const tipoExato = tipos.some((t) => semAcento(t.nome) === semAcento(buscaTipo.trim()));

  const sub = (id, l, breve) => (
    <button key={id} onClick={() => !breve && setVista(id)} disabled={breve}
      style={{ ...s.btn(vista === id), cursor: breve ? "default" : "pointer", padding: "6px 14px", fontSize: 12, ...(vista !== id ? { color: breve ? C.muted : C.text } : {}) }}>
      {l}{breve && <span style={{ fontSize: 10, marginLeft: 6 }}>em breve</span>}
    </button>
  );

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>{sub("gestao", "👷 Gestão de funcionários")}{sub("kits", "🧰 Kits por função")}{sub("estoque", "📦 Estoque")}</div>

      {vista === "gestao" && <GestaoEpi C={C} s={s} modal={modal} campo={campo} epiItens={itens} nomeTipo={nomeTipo} onAviso={onAviso} onErro={onErro} onMudou={carregar} onCadastrarEpi={(tipo) => abrirNovo(tipo)} podeCadastrar={editar} />}

      {vista === "estoque" && (<>
      <div style={{ fontSize: 12, color: C.textSub, marginBottom: 12 }}>
        O EPI é um item do <b style={{ color: C.text }}>Estoque</b> marcado como EPI: a compra segue RM → RC → cotação e o saldo é o do Estoque.
        {dados.endereco ? <> Endereço padrão: <b style={{ color: C.text }}>📦 {dados.endereco.codigo}</b> (dê entrada nele pelo Estoque).</> : null}
        {" "}Ao receber, o material fica na doca <b style={{ color: C.text }}>RECEBIMENTO</b>: use “→ Guardar no EPI”.
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        {[["", "Itens de EPI", resumo.total, C.accent], ["vencido", "CA vencido", resumo.vencido, SIT_CA.vencido.c], ["vence_30", "CA vence em 30 dias", resumo.vence_30, SIT_CA.vence_30.c], ["sem_saldo", "Sem saldo", resumo.sem_saldo, C.muted]].map(([k, l, n, cor]) => (
          <button key={l} onClick={() => setFiltro(filtro === k ? "" : k)}
            style={{ ...s.card, padding: "10px 16px", cursor: "pointer", borderColor: filtro === k && k ? cor : C.border, background: filtro === k && k ? `${cor}18` : C.surface, textAlign: "left", fontFamily: "inherit", color: C.text }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: cor }}>{n}</div>
            <div style={{ fontSize: 11, color: C.textSub }}>{l}</div>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {editar && <button onClick={() => abrirNovo()} style={{ ...s.btn(true), cursor: "pointer", alignSelf: "center" }}>＋ Novo EPI</button>}
      </div>

      {itens.length > 0 && <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar EPI por nome, tipo ou CA…" style={{ ...s.input, maxWidth: 320, padding: "7px 10px", fontSize: 12, marginBottom: 12 }} />}

      {itens.length === 0 ? (
        <div style={{ ...s.card, padding: 28, textAlign: "center", color: C.textSub }}>Nenhum EPI ainda. Cadastre o primeiro em “＋ Novo EPI” (botina, luva, protetor…), com o número do CA.</div>
      ) : filtrados.length === 0 ? (
        <div style={{ ...s.card, padding: 20, textAlign: "center", color: C.textSub }}>Nenhum EPI com esses filtros.</div>
      ) : (
        <div style={{ ...s.card, overflow: "hidden" }}>
          {filtrados.map((i, n) => {
            const sc = SIT_CA[i.ca_situacao] || SIT_CA.sem_validade;
            return (
              <div key={i.id} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "12px 16px", borderBottom: n < filtrados.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ flex: "2 1 240px", minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>🦺 {i.item_nome}{i.sku ? <span style={{ color: C.muted, fontWeight: 400 }}> · {i.sku}</span> : ""}</div>
                  <div style={{ fontSize: 12, color: C.textSub }}>{nomeTipo(i.tipo)}{i.tamanho ? ` · tam. ${i.tamanho}` : ""}{i.troca_dias ? ` · troca a cada ${i.troca_dias} dias` : ""}</div>
                </div>
                <div style={{ flex: "1 1 160px", fontSize: 12, color: C.textSub }}>
                  {i.ca ? <>CA <b style={{ color: C.text }}>{i.ca}</b>{i.ca_validade ? ` · até ${dataBR(i.ca_validade)}` : ""}</> : <span style={{ color: SIT_CA.vencido.c }}>Sem CA informado</span>}
                  <div style={{ marginTop: 4 }}><span style={s.tag(sc.c)}>{sc.l}{i.ca_situacao === "vencido" ? ` há ${-i.ca_dias} d` : i.ca_situacao === "vence_30" ? ` (${i.ca_dias} d)` : ""}</span></div>
                </div>
                <div style={{ flex: "0 0 130px", fontSize: 12, color: C.textSub, textAlign: "right" }}>
                  <b style={{ color: i.saldo_total > 0 ? C.text : SIT_CA.vencido.c, fontSize: 14 }}>{fmtQtd(i.saldo_total)}</b> {i.unidade}
                  <div>no EPI: {fmtQtd(i.saldo_epi)}</div>
                  {i.saldo_recebimento > 0 && (editar
                    ? <button onClick={() => setGuardar({ item: i, quantidade: i.saldo_recebimento })} style={{ ...s.btn(false), cursor: "pointer", padding: "3px 8px", fontSize: 11, color: C.accent, marginTop: 4 }}>📥 {fmtQtd(i.saldo_recebimento)} na doca → Guardar no EPI</button>
                    : <div style={{ color: C.accent }}>📥 {fmtQtd(i.saldo_recebimento)} na doca</div>)}
                </div>
                {editar && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => { setBuscaTipo(nomeTipo(i.tipo)); setForm({ id: i.id, titulo: i.item_nome, tipo: i.tipo, tamanho: i.tamanho || "", ca: i.ca || "", ca_validade: i.ca_validade ? String(i.ca_validade).slice(0, 10) : "", troca_dias: i.troca_dias || "", obs: i.obs || "" }); }}
                      style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.text }}>Editar</button>
                    <button onClick={() => setConfirmar(i)} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.danger }}>Desmarcar</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      </>)}

      {/* ─── 🧰 kits por função ─── */}
      {vista === "kits" && (
        <div>
          <div style={{ fontSize: 12, color: C.textSub, marginBottom: 10 }}>
            O que cada função tem direito a receber — é o que vem preenchido na ficha de entrega. {faltando.length ? <b style={{ color: "#ef4444" }}>⚠ {faltando.length} tipo(s) dos kits ainda sem EPI no estoque (sem EPI cadastrado não dá para entregar).</b> : null}
          </div>
          {funcoes.length === 0 && <div style={{ ...s.card, padding: 24, textAlign: "center", color: C.textSub }}>Nenhuma função. Crie ou importe em 👔 Funções.</div>}
          <div style={{ display: "grid", gap: 8 }}>
            {funcoes.map((f) => {
              const cob = cobertura.find((c) => String(c.funcao.id) === String(f.id));
              return (
                <div key={f.id} style={{ ...s.card, padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>👔 {f.nome} <span style={{ color: C.muted, fontWeight: 400 }}>· {f.colaboradores} colaborador(es)</span></div>
                    {editar && <button onClick={() => setKitEdit({ funcao: f, epis: (f.epis || []).map((k) => ({ ...k, troca_dias: k.troca_dias ?? "" })) })} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 10px", fontSize: 12, color: C.text }}>Editar kit</button>}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {!cob && <span style={{ fontSize: 12, color: C.muted }}>Sem kit de EPI.</span>}
                    {(cob?.kit || []).map((k) => (
                      <button key={k.tipo} onClick={() => editar && !k.itens && (setVista("estoque"), abrirNovo(k.tipo))} title={k.itens ? `${k.itens} EPI(s) no estoque · saldo ${fmtQtd(k.saldo)}` : "Sem EPI cadastrado — clique para cadastrar"}
                        style={{ ...s.tag(k.itens ? (k.saldo > 0 ? "#22c55e" : "#f59e0b") : "#ef4444"), cursor: editar && !k.itens ? "pointer" : "default", fontFamily: "inherit", border: "none" }}>
                        {k.itens ? (k.saldo > 0 ? "✓" : "○") : "＋"} {nomeTipo(k.tipo)} ×{k.quantidade}{k.troca_dias ? ` · troca ${k.troca_dias} d` : ""}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>✓ tem EPI com saldo · ○ tem EPI, sem saldo · ＋ falta cadastrar um EPI desse tipo. Custo por funcionário e por tipo de EPI: em breve.</div>
        </div>
      )}

      {kitEdit && modal(<>
        <div style={{ fontSize: 17, fontWeight: 700 }}>🧰 Kit de EPI — {kitEdit.funcao.nome}</div>
        <div style={{ fontSize: 12, color: C.textSub, margin: "4px 0 12px" }}>Tipo, quantidade por entrega e troca (dias). A sugestão pelos riscos é um ponto de partida — confirme com o PGR/SESMT.</div>
        {kitEdit.epis.map((k, i) => {
          const muda = (c, v) => setKitEdit({ ...kitEdit, epis: kitEdit.epis.map((x, j) => (j === i ? { ...x, [c]: v } : x)) });
          return (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
              <select value={k.tipo} onChange={(e) => muda("tipo", e.target.value)} style={{ ...s.input, flex: "3 1 200px", padding: "7px 10px", fontSize: 12 }}>
                <option value="">Tipo de EPI…</option>
                {tipos.filter((t) => t.codigo === k.tipo || !kitEdit.epis.some((x) => x.tipo === t.codigo)).map((t) => <option key={t.codigo} value={t.codigo}>{t.nome}</option>)}
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.textSub }}>qtd
                <input type="number" min={1} max={99} value={k.quantidade} onChange={(e) => muda("quantidade", e.target.value)} style={{ ...s.input, width: 56, padding: "6px 8px", fontSize: 12 }} /></label>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.textSub }}>troca (dias)
                <input type="number" min={1} max={3650} value={k.troca_dias} onChange={(e) => muda("troca_dias", e.target.value)} placeholder="—" style={{ ...s.input, width: 70, padding: "6px 8px", fontSize: 12 }} /></label>
              <button type="button" onClick={() => setKitEdit({ ...kitEdit, epis: kitEdit.epis.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 16 }}>×</button>
            </div>
          );
        })}
        {(() => {
          const ja = new Set(kitEdit.epis.map((k) => k.tipo)); const sug = [];
          for (const r of kitEdit.funcao.riscos || []) for (const t of (listas.sugestao_por_risco || {})[r] || []) if (!ja.has(t) && tipos.some((x) => x.codigo === t)) { ja.add(t); sug.push({ tipo: t, quantidade: 1, troca_dias: tipos.find((x) => x.codigo === t)?.troca_dias_padrao || "" }); }
          return (
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button type="button" onClick={() => setKitEdit({ ...kitEdit, epis: [...kitEdit.epis, { tipo: "", quantidade: 1, troca_dias: "" }] })} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.accent }}>＋ EPI</button>
              <button type="button" disabled={!sug.length} onClick={() => setKitEdit({ ...kitEdit, epis: [...kitEdit.epis, ...sug] })} title={(kitEdit.funcao.riscos || []).length ? "" : "Marque os riscos da função em 👔 Funções"}
                style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: "#a78bfa", borderColor: "#a78bfa", opacity: sug.length ? 1 : 0.45 }}>✨ Sugerir pelos riscos</button>
            </div>
          );
        })()}
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={() => setKitEdit(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          <button disabled={salvando} onClick={async () => {
            setSalvando(true);
            try {
              await apiService.put(`/pessoas/funcoes/${kitEdit.funcao.id}`, { epis: kitEdit.epis.filter((k) => k.tipo).map((k) => ({ tipo: k.tipo, quantidade: Number(k.quantidade) || 1, troca_dias: k.troca_dias === "" || k.troca_dias == null ? null : Number(k.troca_dias) })) });
              setKitEdit(null); onAviso("Kit de EPI salvo."); await onFuncoesMudou?.();
            } catch (e) { onErro(e.message); } finally { setSalvando(false); }
          }} style={{ ...s.btn(!salvando), flex: 1 }}>{salvando ? "Salvando…" : "Salvar kit"}</button>
        </div>
      </>, () => setKitEdit(null), 620)}

      {/* ─── modal novo / editar EPI ─── */}
      {form && modal(<>
        <div style={{ fontSize: 17, fontWeight: 700 }}>{form.id ? "Editar EPI" : form.modo === "estoque" ? "Ligar item do Estoque ao EPI" : "Novo EPI"}</div>
        {form.titulo && <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>{form.titulo}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          {/* tipo — busca com autocompletar no catálogo (QuotaFlow + da empresa) */}
          <div style={{ position: "relative" }}>
            <span style={s.label}>TIPO DE EPI</span>
            <input value={buscaTipo} onChange={(e) => { setBuscaTipo(e.target.value); setAbrirTipos(true); setForm({ ...form, tipo: "" }); }} onFocus={() => setAbrirTipos(true)}
              placeholder="Digite: botina, luva, protetor…" style={{ ...s.input, borderColor: form.tipo ? "#22c55e" : undefined }} />
            {abrirTipos && !form.tipo && (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, marginTop: 4, background: C.surface, overflow: "hidden" }}>
                {sugestoesTipo.map((t) => (
                  <button key={t.codigo} type="button" onClick={() => escolherTipo(t)}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: `1px solid ${C.border}`, padding: "8px 12px", color: C.text, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                    {t.nome}<span style={{ color: C.muted, fontSize: 11 }}>{t.grade ? ` · tamanho de ${GRADE_L[t.grade]}` : ""}{t.proprio ? " · da empresa" : ""}</span>
                  </button>
                ))}
                {editar && buscaTipo.trim() && !tipoExato && (
                  <button type="button" onClick={() => setNovoTipo({ nome: buscaTipo.trim(), grade: "" })}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 12px", color: C.accent, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                    ＋ Criar o tipo “{buscaTipo.trim()}” na minha empresa
                  </button>
                )}
              </div>
            )}
            {novoTipo && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginTop: 8, padding: 10, border: `1px dashed ${C.accent}`, borderRadius: 8 }}>
                {campo("NOME DO TIPO", <input value={novoTipo.nome} onChange={(e) => setNovoTipo({ ...novoTipo, nome: e.target.value })} style={s.input} />, "2 1 180px")}
                {campo("USA TAMANHO DE", <select value={novoTipo.grade} onChange={(e) => setNovoTipo({ ...novoTipo, grade: e.target.value })} style={s.input}>
                  <option value="">Sem tamanho</option>{Object.entries(GRADE_L).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>, "1 1 140px")}
                <button type="button" onClick={criarTipo} disabled={!novoTipo.nome.trim()} style={{ ...s.btn(!!novoTipo.nome.trim()), cursor: "pointer" }}>Criar tipo</button>
                <button type="button" onClick={() => setNovoTipo(null)} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>Cancelar</button>
              </div>
            )}
          </div>
          {!form.id && form.modo === "novo" && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {campo("DESCRIÇÃO / MODELO (OPCIONAL)", <input value={form.novo_nome} onChange={(e) => setForm({ ...form, novo_nome: e.target.value })} placeholder={tipoForm?.nome || "ex.: Botina de couro bico PVC"} style={s.input} />, "3 1 220px")}
              {campo("TAMANHO", <input value={form.tamanho} onChange={(e) => setForm({ ...form, tamanho: e.target.value })} placeholder={tipoForm?.grade === "calcado" ? "42" : tipoForm?.grade ? "M" : "—"} style={s.input} />, "1 1 80px")}
              {campo("UNIDADE", <input value={form.novo_unidade} onChange={(e) => setForm({ ...form, novo_unidade: e.target.value, novo_unidade_manual: true })} style={s.input} />, "1 1 70px")}
              {campo("CÓDIGO / SKU", <input value={form.novo_sku} onChange={(e) => setForm({ ...form, novo_sku: e.target.value })} style={s.input} />, "1 1 110px")}
            </div>
          )}
          {form.id && campo("TAMANHO", <input value={form.tamanho} onChange={(e) => setForm({ ...form, tamanho: e.target.value })} style={{ ...s.input, maxWidth: 120 }} />)}
          {!form.id && form.modo === "estoque" && (
            <div>
              <input value={buscaItem} onChange={(e) => setBuscaItem(e.target.value)} placeholder="🔍 Buscar item do estoque…" style={{ ...s.input, marginBottom: 6 }} />
              <select value={form.item_consumo_id} onChange={(e) => setForm({ ...form, item_consumo_id: e.target.value })} size={Math.min(6, Math.max(2, itensEscolha.length + 1))} style={{ ...s.input, height: "auto" }}>
                <option value="">{itensEscolha.length ? "Escolha o item…" : "Nenhum item disponível"}</option>
                {itensEscolha.map((i) => <option key={i.id} value={i.id}>{i.nome}{i.sku ? ` (${i.sku})` : ""} — saldo {fmtQtd(i.saldo)} {i.unidade}</option>)}
              </select>
              {campo("TAMANHO", <input value={form.tamanho} onChange={(e) => setForm({ ...form, tamanho: e.target.value })} style={{ ...s.input, maxWidth: 120 }} />)}
            </div>
          )}
          {!form.id && (
            <button type="button" onClick={() => setForm({ ...form, modo: form.modo === "novo" ? "estoque" : "novo", item_consumo_id: "" })}
              style={{ background: "none", border: "none", color: C.accent, fontSize: 12, cursor: "pointer", textAlign: "left", padding: 0, fontFamily: "inherit" }}>
              {form.modo === "novo" ? "Já tenho esse item cadastrado no Estoque (comprado antes) — ligar ao EPI" : "← Voltar: cadastrar EPI novo"}
            </button>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("Nº DO CA", <input value={form.ca} onChange={(e) => setForm({ ...form, ca: e.target.value })} placeholder="ex.: 12345" inputMode="numeric" style={s.input} />, "1 1 120px")}
            {campo("VALIDADE DO CA", <input type="date" value={form.ca_validade} onChange={(e) => setForm({ ...form, ca_validade: e.target.value })} style={s.input} />, "1 1 150px")}
            {campo("TROCA A CADA (DIAS)", <input type="number" min={1} max={3650} value={form.troca_dias} onChange={(e) => setForm({ ...form, troca_dias: e.target.value })} placeholder="opcional" style={s.input} />, "1 1 130px")}
          </div>
          {campo("OBSERVAÇÕES", <textarea rows={2} value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} style={{ ...s.input, resize: "vertical" }} />)}
          <div style={{ fontSize: 11, color: C.muted }}>O CA (Certificado de Aprovação) vem impresso no EPI e na nota; a validade se confere no site do Ministério do Trabalho. Sem CA válido o EPI não pode ser entregue (NR-6).</div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={() => setForm(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          <button onClick={salvar} disabled={!okForm} style={{ ...s.btn(!!okForm), flex: 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </>, () => setForm(null), 600)}

      {guardar && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700 }}>📥 Guardar no EPI</div>
        <div style={{ fontSize: 13, color: C.textSub, marginTop: 8, lineHeight: 1.5 }}>
          Transfere <b style={{ color: C.text }}>{guardar.item.item_nome}</b> da doca <b style={{ color: C.text }}>RECEBIMENTO</b> para o endereço <b style={{ color: C.text }}>EPI</b> (na doca: {fmtQtd(guardar.item.saldo_recebimento)} {guardar.item.unidade}).
        </div>
        <div style={{ marginTop: 12 }}>{campo("QUANTIDADE", <input type="number" min={0.01} max={guardar.item.saldo_recebimento} step="any" value={guardar.quantidade} onChange={(e) => setGuardar({ ...guardar, quantidade: e.target.value })} style={{ ...s.input, maxWidth: 160 }} />)}</div>
        {(() => { const ok = Number(guardar.quantidade) > 0 && Number(guardar.quantidade) <= guardar.item.saldo_recebimento; return (
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button onClick={() => setGuardar(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
            <button onClick={guardarNoEpi} disabled={!ok} style={{ ...s.btn(ok), flex: 1 }}>Guardar no EPI</button>
          </div>
        ); })()}
      </>, () => setGuardar(null), 460)}

      {confirmar && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.danger }}>⚠ Desmarcar EPI</div>
        <div style={{ fontSize: 13, color: C.textSub, marginTop: 10, lineHeight: 1.5 }}><b style={{ color: C.text }}>{confirmar.item_nome}</b> deixa de ser EPI. O item e o saldo continuam no Estoque; só sai da lista de EPI.</div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={() => setConfirmar(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          <button onClick={desmarcar} style={{ ...s.btn(true, C.danger), cursor: "pointer", flex: 1 }}>Desmarcar</button>
        </div>
      </>, () => setConfirmar(null), 460)}
    </>
  );
}
