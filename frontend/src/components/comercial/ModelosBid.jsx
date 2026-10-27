// components/comercial/ModelosBid.jsx — etapa 15a
// 📈 Comercial → 🧩 Modelos de BID: importar da biblioteca do QuotaFlow (cópia da empresa), ✨ versão nova, criar, editar, desativar.
// Modelo = título do documento + rótulo do grupo ("Trecho") + validade + SEÇÕES de texto (antes/depois da precificação)
//          + COLUNAS do item (texto, número com unidade, sim/não/N/A, data) + CONDIÇÕES comerciais (texto, R$, número; com valor padrão).
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";

const casca = (s, conteudo, fechar, largura = 860) => (
  <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 330, padding: 16, overflowY: "auto" }} onClick={fechar}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: largura, maxWidth: "100%", padding: "18px 20px", margin: "auto 0", boxShadow: "0 24px 48px #00000060" }}>{conteudo}</div>
  </div>
);
const TIPO_COL = { texto: "Texto", numero: "Número", sim_nao: "Sim / Não / N/A", data: "Data" };
const TIPO_COND = { texto: "Texto", moeda: "R$", numero: "Número" };

function Lista({ C, s, itens, setItens, novo, render, titulo, max }) {
  const mover = (i, d) => { const l = [...itens]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; setItens(l); };
  const mini = { background: "transparent", border: `1px solid ${C.border}`, color: C.textSub, borderRadius: 5, padding: "3px 7px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" };
  return (<div style={{ marginTop: 14 }}>
    <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}><span style={{ ...s.label, flex: 1, marginBottom: 0 }}>{titulo}</span>
      {itens.length < max && <button type="button" onClick={() => setItens([...itens, novo()])} style={mini}>＋ Adicionar</button>}</div>
    {itens.map((it, i) => (
      <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 6, padding: 8, border: `1px solid ${C.border}`, borderRadius: 8 }}>
        <div style={{ flex: 1 }}>{render(it, (x) => setItens(itens.map((y, k) => (k === i ? x : y))))}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <button type="button" title="Subir" onClick={() => mover(i, -1)} style={mini}>↑</button>
          <button type="button" title="Descer" onClick={() => mover(i, 1)} style={mini}>↓</button>
          <button type="button" title="Tirar" onClick={() => setItens(itens.filter((_, k) => k !== i))} style={{ ...mini, color: C.danger }}>✕</button>
        </div>
      </div>
    ))}
    {!itens.length && <div style={{ fontSize: 12, color: C.muted }}>Nenhum.</div>}
  </div>);
}

export function EditorModeloBid({ C, s, inicial, campos, salvando, onSalvar, onCancelar }) {
  const [m, setM] = useState(() => ({ nome: "", descricao: "", titulo_documento: "", rotulo_grupo: "Trecho", validade_dias: 10, secoes: [], colunas: [], condicoes: [], ...inicial }));
  const inp = (k, extra = {}) => <input value={m[k] ?? ""} onChange={(e) => setM({ ...m, [k]: e.target.value })} style={s.input} {...extra} />;
  const lbl = (rot, el, flex = "1 1 160px") => <label style={{ flex, display: "block" }}><span style={s.label}>{rot}</span>{el}</label>;
  return (<>
    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{m.id ? `Editar — ${m.nome}` : "Novo modelo de BID"}</div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{lbl("NOME DO MODELO", inp("nome"), "2 1 240px")}{lbl("TÍTULO NO DOCUMENTO", inp("titulo_documento", { placeholder: "BID SERVIÇOS DE TRANSPORTES DE EQUIPAMENTOS" }), "3 1 300px")}</div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{lbl("DESCRIÇÃO (OPCIONAL)", inp("descricao"), "3 1 300px")}
      {lbl("COMO CHAMAR O GRUPO", inp("rotulo_grupo", { placeholder: "Trecho" }), "1 1 120px")}{lbl("VALIDADE (DIAS)", inp("validade_dias", { type: "number", min: 1, max: 365 }), "0 1 110px")}</div>

    <Lista C={C} s={s} titulo="SEÇÕES DE TEXTO (LINHAS QUE COMEÇAM COM “- ” VIRAM LISTA)" max={20} itens={m.secoes} setItens={(secoes) => setM({ ...m, secoes })} novo={() => ({ titulo: "", texto: "", posicao: "antes" })}
      render={(x, set) => (<>
        <div style={{ display: "flex", gap: 6 }}><input value={x.titulo} onChange={(e) => set({ ...x, titulo: e.target.value })} placeholder="Título da seção" style={{ ...s.input, flex: 1 }} />
          <select value={x.posicao} onChange={(e) => set({ ...x, posicao: e.target.value })} style={{ ...s.input, width: 210 }}><option value="antes">antes da precificação</option><option value="depois">depois do pagamento</option></select></div>
        <textarea value={x.texto} onChange={(e) => set({ ...x, texto: e.target.value })} rows={4} style={{ ...s.input, marginTop: 6, resize: "vertical" }} />
      </>)} />
    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Campos automáticos nos textos: {(campos || []).map(([k, l]) => <code key={k} title={l} style={{ marginRight: 6 }}>{`{{${k}}}`}</code>)}</div>

    <Lista C={C} s={s} titulo="COLUNAS DO ITEM (NA TABELA DE PRECIFICAÇÃO — O VALOR JÁ É UMA COLUNA FIXA)" max={16} itens={m.colunas} setItens={(colunas) => setM({ ...m, colunas })} novo={() => ({ rotulo: "", tipo: "texto" })}
      render={(x, set) => (<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input value={x.rotulo} onChange={(e) => set({ ...x, rotulo: e.target.value })} placeholder="Ex.: Peso operacional" style={{ ...s.input, flex: "2 1 180px" }} />
        <select value={x.tipo} onChange={(e) => set({ ...x, tipo: e.target.value })} style={{ ...s.input, flex: "1 1 140px" }}>{Object.entries(TIPO_COL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        {x.tipo === "numero" && <input value={x.unidade || ""} onChange={(e) => set({ ...x, unidade: e.target.value })} placeholder="unidade (t, m…)" style={{ ...s.input, flex: "0 1 120px" }} />}
      </div>)} />

    <Lista C={C} s={s} titulo="CONDIÇÕES COMERCIAIS (CADA UMA PODE SER MARCADA N/A NO BID)" max={30} itens={m.condicoes} setItens={(condicoes) => setM({ ...m, condicoes })} novo={() => ({ rotulo: "", tipo: "texto", grupo: "comercial" })}
      render={(x, set) => (<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input value={x.rotulo} onChange={(e) => set({ ...x, rotulo: e.target.value })} placeholder="Ex.: Pedágio" style={{ ...s.input, flex: "2 1 170px" }} />
        <select value={x.tipo} onChange={(e) => set({ ...x, tipo: e.target.value })} style={{ ...s.input, flex: "0 1 100px" }}>{Object.entries(TIPO_COND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        {x.tipo === "numero" && <input value={x.unidade || ""} onChange={(e) => set({ ...x, unidade: e.target.value })} placeholder="unidade" style={{ ...s.input, flex: "0 1 90px" }} />}
        <select value={x.grupo || "comercial"} onChange={(e) => set({ ...x, grupo: e.target.value })} style={{ ...s.input, flex: "1 1 150px" }}><option value="comercial">na precificação</option><option value="pagamento">em pagamento</option></select>
        <input value={x.padrao || ""} onChange={(e) => set({ ...x, padrao: e.target.value })} placeholder="valor padrão (opcional)" style={{ ...s.input, flex: "3 1 220px" }} />
      </div>)} />

    <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
      <button type="button" onClick={onCancelar} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
      <button type="button" disabled={salvando || !String(m.nome || "").trim()} onClick={() => onSalvar(m)} style={{ ...s.btn(!salvando && !!String(m.nome || "").trim(), C.accent), flex: 1 }}>{salvando ? "Salvando…" : "Salvar modelo"}</button>
    </div>
  </>);
}

export default function ModelosBid({ C, s, onErro, onOk }) {
  const [d, setD] = useState(null);
  const [bib, setBib] = useState(null);
  const [form, setForm] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const carregar = async () => { try { setD(await apiService.get("/comercial/modelos")); } catch (e) { onErro(e.message); } };
  useEffect(() => { carregar(); }, []); // eslint-disable-line
  const acao = async (fn, msg) => { setOcupado(true); try { await fn(); onOk(msg); await carregar(); return true; } catch (e) { onErro(e.message); return false; } finally { setOcupado(false); } };
  const bt = (cor, cheio = true) => ({ ...s.btn(true, cor), cursor: "pointer", padding: "6px 11px", fontSize: 12, ...(cheio ? {} : { background: "transparent", color: cor }) });
  if (!d) return <div style={{ color: C.muted }}>Carregando…</div>;
  return (
    <div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>O modelo define os textos, as colunas da tabela de preços e as condições comerciais do BID. O fluxo de aprovação do cliente (15b) é o mesmo para qualquer modelo.</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={async () => { try { setBib((await apiService.get("/comercial/modelos/biblioteca")).modelos || []); } catch (e) { onErro(e.message); } }} style={bt(C.accent)}>📚 Importar da biblioteca QuotaFlow</button>
        <button type="button" onClick={() => setForm({})} style={bt(C.accent, false)}>＋ Criar do zero</button>
      </div>
      <div style={{ ...s.card, overflow: "hidden" }}>
        {d.modelos.map((m, k) => (
          <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: k < d.modelos.length - 1 ? `1px solid ${C.border}` : "none", flexWrap: "wrap" }}>
            <div style={{ flex: "2 1 260px" }}><div style={{ fontWeight: 600, fontSize: 13 }}>{m.nome} {m.origem_id != null && <span style={s.tag(C.accent)}>📚 QuotaFlow</span>}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{(m.secoes || []).length} seção(ões) · {(m.colunas || []).length} coluna(s) · {(m.condicoes || []).length} condição(ões) · validade {m.validade_dias} dias</div></div>
            {m.versao_nova && <button type="button" onClick={() => setConfirmar(m)} style={bt(C.saving || "#a78bfa")}>✨ Versão nova</button>}
            <button type="button" onClick={() => setForm(m)} style={bt(C.accent, false)}>Editar</button>
            <button type="button" onClick={() => setConfirmar({ ...m, desativar: true })} style={bt(C.danger, false)}>Desativar</button>
          </div>
        ))}
        {!d.modelos.length && <div style={{ padding: 20, color: C.muted, textAlign: "center" }}>Nenhum modelo ainda — importe o “Transporte de equipamentos” da biblioteca e adapte os textos à sua empresa.</div>}
      </div>

      {bib && casca(s, <>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>📚 Biblioteca de modelos de BID</div>
        {bib.map((m) => (
          <div key={m.id} style={{ ...s.card, padding: 12, marginBottom: 8 }}>
            <div style={{ fontWeight: 600 }}>{m.nome}</div>
            <div style={{ fontSize: 12, color: C.textSub, margin: "4px 0 8px" }}>{m.descricao}</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Colunas: {(m.colunas || []).map((c) => c.rotulo).join(" · ")}</div>
            {m.ja_importado ? <span style={s.tag(C.success)}>✓ já importado</span>
              : <button type="button" disabled={ocupado} onClick={async () => { if (await acao(() => apiService.post("/comercial/modelos/importar", { biblioteca_id: m.id }), "Modelo importado — adapte os textos à sua empresa.")) setBib(null); }} style={bt(C.accent)}>Importar</button>}
          </div>
        ))}
        {!bib.length && <div style={{ color: C.muted }}>A biblioteca está vazia — rode a migration 051.</div>}
        <button type="button" onClick={() => setBib(null)} style={{ ...s.btn(false), cursor: "pointer", width: "100%", color: C.text, marginTop: 6 }}>Fechar</button>
      </>, () => setBib(null), 620)}

      {form && casca(s, <EditorModeloBid C={C} s={s} inicial={form} campos={d.campos} salvando={ocupado} onCancelar={() => setForm(null)}
        onSalvar={async (m) => { const { id, nome, descricao, titulo_documento, rotulo_grupo, validade_dias, secoes, colunas, condicoes } = m; const corpo = { nome, descricao, titulo_documento, rotulo_grupo, validade_dias, secoes, colunas, condicoes };
          if (await acao(() => (id ? apiService.put(`/comercial/modelos/${id}`, corpo) : apiService.post("/comercial/modelos", corpo)), "Modelo salvo. BIDs já criados não mudam.")) setForm(null); }} />, () => setForm(null))}

      {confirmar && casca(s, <>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{confirmar.desativar ? `Desativar “${confirmar.nome}”?` : `Atualizar “${confirmar.nome}” com a versão nova?`}</div>
        <div style={{ fontSize: 13, color: C.textSub, marginBottom: 16 }}>{confirmar.desativar ? "O modelo sai da lista de novos BIDs. Os BIDs já criados continuam como estão." : "Os textos, colunas e condições do modelo são trocados pelos da biblioteca (o que você adaptou neste modelo se perde). Os BIDs já criados não mudam."}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => setConfirmar(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          <button type="button" disabled={ocupado} onClick={async () => { const m = confirmar; if (await acao(() => (m.desativar ? apiService.delete(`/comercial/modelos/${m.id}`) : apiService.post(`/comercial/modelos/${m.id}/atualizar`, {})), m.desativar ? "Modelo desativado." : "Modelo atualizado.")) setConfirmar(null); }}
            style={{ ...s.btn(true, confirmar.desativar ? C.danger : C.accent), flex: 1 }}>{confirmar.desativar ? "Desativar" : "Atualizar"}</button>
        </div>
      </>, () => setConfirmar(null), 480)}
    </div>
  );
}
