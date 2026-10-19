// components/pessoas/TelaEpi.jsx — etapa 12d.1
// Aba "🦺 EPI" de Pessoas. O EPI é um item de consumo do Estoque marcado como EPI
// (categoria, CA, validade do CA, troca a cada X dias). O saldo é o do Estoque; o endereço
// padrão "EPI" é criado sozinho. Entrega com assinatura e ficha NR-6 chegam na 12d.2.
// Confirmações sempre no modal do app (nunca window.confirm/alert).
import { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";

const SIT_CA = {
  vencido:      { l: "CA vencido",       c: "#ef4444" },
  vence_30:     { l: "CA vence em 30 d", c: "#f59e0b" },
  ok:           { l: "CA em dia",        c: "#22c55e" },
  sem_validade: { l: "CA sem validade",  c: "#64748b" },
};
const dataBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fmtQtd = (n) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export default function TelaEpi({ C, s, funcoes = [], modal, campo, onAviso, onErro }) {
  const [dados, setDados] = useState(null);
  const [form, setForm] = useState(null);
  const [itensConsumo, setItensConsumo] = useState([]);
  const [buscaItem, setBuscaItem] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("");
  const [confirmar, setConfirmar] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [semMigration, setSemMigration] = useState(false);

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

  const abrirNovo = async (tipo = "") => {
    setBuscaItem("");
    setForm({ modo: "estoque", item_consumo_id: "", novo_nome: "", novo_unidade: "PAR", novo_sku: "", tipo, ca: "", ca_validade: "", troca_dias: "", obs: "" });
    try { const r = await apiService.get("/pessoas/epi/itens-consumo"); setItensConsumo(r?.itens || []); }
    catch (e) { onErro(e.message); }
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const f = form;
      const corpo = { tipo: f.tipo, ca: f.ca, ca_validade: f.ca_validade || null, troca_dias: f.troca_dias === "" ? null : f.troca_dias, obs: f.obs };
      if (f.id) await apiService.put(`/pessoas/epi/itens/${f.id}`, corpo);
      else if (f.modo === "estoque") await apiService.post("/pessoas/epi/itens", { ...corpo, item_consumo_id: f.item_consumo_id });
      else await apiService.post("/pessoas/epi/itens", { ...corpo, novo_item: { nome: f.novo_nome, unidade_medida: f.novo_unidade, sku: f.novo_sku } });
      setForm(null);
      onAviso(f.id ? "EPI atualizado." : f.modo === "novo" ? "Item criado no Estoque e marcado como EPI. Dê entrada pelo Estoque (endereço EPI)." : "Item marcado como EPI.");
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
  const okForm = form && !salvando && form.tipo && (form.id || (form.modo === "estoque" ? form.item_consumo_id : form.novo_nome.trim()));

  return (
    <>
      <div style={{ fontSize: 12, color: C.textSub, marginBottom: 12 }}>
        O EPI é um item do <b style={{ color: C.text }}>Estoque</b> marcado como EPI: a compra segue RM → RC → cotação e o saldo é o do Estoque.
        {dados.endereco ? <> Endereço padrão: <b style={{ color: C.text }}>📦 {dados.endereco.codigo}</b> (dê entrada nele pelo Estoque).</> : null}
        {" "}Entrega com assinatura e ficha NR-6: em breve.
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
        {editar && <button onClick={() => abrirNovo()} style={{ ...s.btn(true), cursor: "pointer", alignSelf: "center" }}>＋ Marcar item como EPI</button>}
      </div>

      {itens.length > 0 && <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar EPI por nome, tipo ou CA…" style={{ ...s.input, maxWidth: 320, padding: "7px 10px", fontSize: 12, marginBottom: 12 }} />}

      {itens.length === 0 ? (
        <div style={{ ...s.card, padding: 28, textAlign: "center", color: C.textSub }}>Nenhum EPI ainda. Marque itens do Estoque (botina, luva, protetor…) como EPI, com o número do CA.</div>
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
                  <div style={{ fontSize: 12, color: C.textSub }}>{nomeTipo(i.tipo)}{i.troca_dias ? ` · troca a cada ${i.troca_dias} dias` : ""}</div>
                </div>
                <div style={{ flex: "1 1 160px", fontSize: 12, color: C.textSub }}>
                  {i.ca ? <>CA <b style={{ color: C.text }}>{i.ca}</b>{i.ca_validade ? ` · até ${dataBR(i.ca_validade)}` : ""}</> : <span style={{ color: SIT_CA.vencido.c }}>Sem CA informado</span>}
                  <div style={{ marginTop: 4 }}><span style={s.tag(sc.c)}>{sc.l}{i.ca_situacao === "vencido" ? ` há ${-i.ca_dias} d` : i.ca_situacao === "vence_30" ? ` (${i.ca_dias} d)` : ""}</span></div>
                </div>
                <div style={{ flex: "0 0 130px", fontSize: 12, color: C.textSub, textAlign: "right" }}>
                  <b style={{ color: i.saldo_total > 0 ? C.text : SIT_CA.vencido.c, fontSize: 14 }}>{fmtQtd(i.saldo_total)}</b> {i.unidade}
                  <div>no EPI: {fmtQtd(i.saldo_epi)}</div>
                </div>
                {editar && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setForm({ id: i.id, titulo: i.item_nome, tipo: i.tipo, ca: i.ca || "", ca_validade: i.ca_validade ? String(i.ca_validade).slice(0, 10) : "", troca_dias: i.troca_dias || "", obs: i.obs || "" })}
                      style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.text }}>Editar</button>
                    <button onClick={() => setConfirmar(i)} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.danger }}>Desmarcar</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── kits das funções × itens cadastrados ─── */}
      {cobertura.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Kits das funções</div>
          <div style={{ fontSize: 12, color: C.textSub, marginBottom: 10 }}>
            {faltando.length ? <>⚠ {faltando.length} tipo(s) de EPI dos kits ainda sem item cadastrado — sem item, não dá para entregar.</> : "✓ Todos os tipos de EPI dos kits têm item cadastrado."}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {cobertura.map(({ funcao, kit }) => (
              <div key={funcao.id} style={{ ...s.card, padding: "10px 14px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>👔 {funcao.nome}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {kit.map((k) => (
                    <button key={k.tipo} onClick={() => editar && !k.itens && abrirNovo(k.tipo)} title={k.itens ? `${k.itens} item(ns) · saldo ${fmtQtd(k.saldo)}` : "Sem item cadastrado — clique para marcar um"}
                      style={{ ...s.tag(k.itens ? (k.saldo > 0 ? "#22c55e" : "#f59e0b") : "#ef4444"), cursor: editar && !k.itens ? "pointer" : "default", fontFamily: "inherit", border: "none" }}>
                      {k.itens ? (k.saldo > 0 ? "✓" : "○") : "＋"} {nomeTipo(k.tipo)} ×{k.quantidade}{k.troca_dias ? ` · ${k.troca_dias} d` : ""}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>✓ tem item com saldo · ○ tem item, sem saldo · ＋ falta marcar um item desse tipo</div>
        </div>
      )}

      {/* ─── modal marcar / editar ─── */}
      {form && modal(<>
        <div style={{ fontSize: 17, fontWeight: 700 }}>{form.id ? "Editar EPI" : "Marcar item como EPI"}</div>
        {form.titulo && <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>{form.titulo}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          {!form.id && (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                {[["estoque", "Item que já está no Estoque"], ["novo", "Item novo"]].map(([k, l]) => (
                  <button key={k} onClick={() => setForm({ ...form, modo: k })} style={{ ...s.btn(form.modo === k), cursor: "pointer", flex: 1, ...(form.modo !== k ? { color: C.text } : {}) }}>{l}</button>
                ))}
              </div>
              {form.modo === "estoque" ? (
                <div>
                  <input value={buscaItem} onChange={(e) => setBuscaItem(e.target.value)} placeholder="🔍 Buscar item do estoque…" style={{ ...s.input, marginBottom: 6 }} />
                  <select value={form.item_consumo_id} onChange={(e) => setForm({ ...form, item_consumo_id: e.target.value })} size={Math.min(6, Math.max(2, itensEscolha.length + 1))} style={{ ...s.input, height: "auto" }}>
                    <option value="">{itensEscolha.length ? "Escolha o item…" : "Nenhum item disponível — use “Item novo”"}</option>
                    {itensEscolha.map((i) => <option key={i.id} value={i.id}>{i.nome}{i.sku ? ` (${i.sku})` : ""} — saldo {fmtQtd(i.saldo)} {i.unidade}</option>)}
                  </select>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {campo("NOME DO ITEM", <input value={form.novo_nome} onChange={(e) => setForm({ ...form, novo_nome: e.target.value })} placeholder="Botina de segurança nº 42" style={s.input} />, "3 1 220px")}
                  {campo("UNIDADE", <input value={form.novo_unidade} onChange={(e) => setForm({ ...form, novo_unidade: e.target.value })} style={s.input} />, "1 1 70px")}
                  {campo("CÓDIGO / SKU", <input value={form.novo_sku} onChange={(e) => setForm({ ...form, novo_sku: e.target.value })} style={s.input} />, "1 1 110px")}
                </div>
              )}
            </>
          )}
          {campo("TIPO DE EPI", <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={s.input}>
            <option value="">Escolha…</option>{tipos.map((t) => <option key={t.codigo} value={t.codigo}>{t.nome}</option>)}</select>)}
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
