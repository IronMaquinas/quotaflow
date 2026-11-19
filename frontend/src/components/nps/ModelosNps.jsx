// components/nps/ModelosNps.jsx — etapa N1.1: ⚙ modelos da pesquisa de satisfação
//   "Padrão QuotaFlow" vem pronto (não edita; duplica). Modelo da empresa: nome, descrição, pontos 👍/👎 (liga/desliga + itens),
//   até 8 perguntas extras (estrelas 1–5, sim/não, múltipla escolha, texto; obrigatória). A pergunta 0–10 é fixa em todos.
//   ★ Padrão = usado nas pesquisas automáticas (pedido concluído). Pesquisas enviadas guardam a cópia — editar não muda as já enviadas.
import { useEffect, useState } from "react";
import apiService from "../../services/apiService";
import { Toggle } from "../../plataforma/ModulosPlataforma";

const TIPOS = { estrelas: "⭐ Nota de 1 a 5 estrelas", sim_nao: "✔ Sim ou não", escolha: "☰ Múltipla escolha", texto: "✎ Texto livre" };
const novoModelo = (base) => ({ nome: base ? `${base.nome} (cópia)` : "", descricao: base?.descricao || "", pontos: base ? base.pontos !== false : true, itens_pontos: (base?.itens_pontos || []).map((x) => ({ ...x })), perguntas: (base?.perguntas || []).map((x) => ({ ...x, opcoesTxt: (x.opcoes || []).join(", ") })) });

export default function ModelosNps({ C, s, onMsg }) {
  const [l, setL] = useState(null); const [ed, setEd] = useState(null); const [novoItem, setNovoItem] = useState("");
  const carregar = () => apiService.get("/nps/modelos").then((r) => setL(r.modelos || [])).catch((e) => { onMsg(`⚠ ${e?.response?.data?.erro || e.message}`); setL([]); });
  useEffect(() => { carregar(); }, []); // eslint-disable-line
  const fazer = async (fn, ok) => { try { await fn(); onMsg(ok); await carregar(); return true; } catch (e) { onMsg(`⚠ ${e?.response?.data?.erro || e.message}`); return false; } };
  const salvar = async () => { const corpo = { ...ed, perguntas: ed.perguntas.map(({ opcoesTxt, ...p }) => ({ ...p, opcoes: p.tipo === "escolha" ? String(opcoesTxt || "").split(",").map((x) => x.trim()).filter(Boolean) : [] })) }; if (await fazer(() => (ed.id ? apiService.put(`/nps/modelos/${ed.id}`, corpo) : apiService.post("/nps/modelos", corpo)), "Modelo salvo.")) setEd(null); };
  const setP = (i, v) => setEd({ ...ed, perguntas: ed.perguntas.map((p, k) => (k === i ? { ...p, ...v } : p)) });
  const mover = (i, d) => { const a = [...ed.perguntas]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setEd({ ...ed, perguntas: a }); };
  const card = { ...s.card, padding: "16px 18px" };
  if (!l) return <div style={{ color: C.muted }}>Carregando…</div>;
  if (ed) return (
    <div style={{ ...card, display: "grid", gap: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{ed.id ? "Editar modelo" : "Novo modelo"}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} placeholder="Nome do modelo * — ex.: Pós-mobilização de guindaste" style={{ ...s.input, flex: "2 1 260px" }} />
        <input value={ed.descricao} onChange={(e) => setEd({ ...ed, descricao: e.target.value })} placeholder="Quando usar (opcional)" style={{ ...s.input, flex: "3 1 300px" }} />
      </div>
      <div style={{ fontSize: 12.5, color: C.textSub, background: C.bg, border: `1px dashed ${C.border}`, borderRadius: 8, padding: "8px 12px" }}>🔒 Pergunta fixa em todos os modelos: <b>"De 0 a 10, quanto você recomendaria a sua empresa a um colega ou parceiro?"</b> — é ela que calcula o NPS.</div>
      <div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, fontWeight: 600 }}><Toggle C={C} ligado={ed.pontos} rotulo="Pontos positivos e negativos" onChange={(v) => setEd({ ...ed, pontos: v })} />👍 Pontos positivos e 👎 negativos</label>
        {ed.pontos && <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: C.textSub, marginBottom: 6 }}>O cliente marca o que foi bem e o que pode melhorar nesta lista:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{ed.itens_pontos.map((x, i) => <span key={x.chave || i} style={{ display: "inline-flex", gap: 6, alignItems: "center", border: `1px solid ${C.border}`, borderRadius: 16, padding: "4px 6px 4px 12px", fontSize: 13 }}>{x.nome}<button type="button" onClick={() => setEd({ ...ed, itens_pontos: ed.itens_pontos.filter((_, k) => k !== i) })} aria-label={`Tirar ${x.nome}`} style={{ background: "none", border: "none", color: C.textSub, cursor: "pointer", fontSize: 15 }}>×</button></span>)}
            <form onSubmit={(e) => { e.preventDefault(); const n = novoItem.trim(); if (n) { setEd({ ...ed, itens_pontos: [...ed.itens_pontos, { nome: n }] }); setNovoItem(""); } }} style={{ display: "inline-flex", gap: 4 }}><input value={novoItem} onChange={(e) => setNovoItem(e.target.value)} placeholder="＋ item — ex.: Pontualidade do motorista" style={{ ...s.input, width: 260, padding: "5px 10px" }} /></form></div></div>}
      </div>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Perguntas extras ({ed.perguntas.length}/8)</div>
        {ed.perguntas.map((p, i) => <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, marginBottom: 8, display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ color: C.textSub, fontSize: 12, width: 18 }}>{i + 1}.</span>
            <input value={p.texto} onChange={(e) => setP(i, { texto: e.target.value })} placeholder="Texto da pergunta — ex.: O operador seguiu as regras de segurança?" style={{ ...s.input, flex: "3 1 280px" }} />
            <select value={p.tipo} onChange={(e) => setP(i, { tipo: e.target.value })} style={{ ...s.input, flex: "1 1 190px" }}>{Object.entries(TIPOS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select>
            <button type="button" onClick={() => mover(i, -1)} aria-label="Subir" style={{ ...s.btn(false), cursor: "pointer", padding: "4px 8px", color: C.text }}>↑</button>
            <button type="button" onClick={() => mover(i, 1)} aria-label="Descer" style={{ ...s.btn(false), cursor: "pointer", padding: "4px 8px", color: C.text }}>↓</button>
            <button type="button" onClick={() => setEd({ ...ed, perguntas: ed.perguntas.filter((_, k) => k !== i) })} aria-label="Remover pergunta" style={{ ...s.btn(false), cursor: "pointer", padding: "4px 8px", color: C.danger }}>×</button>
          </div>
          {p.tipo === "escolha" && <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", paddingLeft: 26 }}><input value={p.opcoesTxt || ""} onChange={(e) => setP(i, { opcoesTxt: e.target.value })} placeholder="Opções separadas por vírgula — ex.: Excelente, Boa, Regular, Ruim" style={{ ...s.input, flex: "1 1 320px" }} /><label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5 }}><Toggle C={C} ligado={!!p.multipla} rotulo="Pode marcar mais de uma" onChange={(v) => setP(i, { multipla: v })} />pode marcar mais de uma</label></div>}
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, paddingLeft: 26 }}><Toggle C={C} ligado={!!p.obrigatoria} rotulo="Obrigatória" onChange={(v) => setP(i, { obrigatoria: v })} />resposta obrigatória</label>
        </div>)}
        {ed.perguntas.length < 8 && <button type="button" onClick={() => setEd({ ...ed, perguntas: [...ed.perguntas, { tipo: "estrelas", texto: "", opcoesTxt: "", obrigatoria: false }] })} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>＋ Pergunta</button>}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={() => setEd(null)} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>Cancelar</button><button type="button" onClick={salvar} disabled={!ed.nome.trim()} style={{ ...s.btn(true), cursor: "pointer" }}>Salvar modelo</button></div>
    </div>);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}><div style={{ fontSize: 13, color: C.textSub }}>O modelo com ★ é usado nas pesquisas automáticas. Na ＋ Nova pesquisa dá para escolher outro.</div><button type="button" onClick={() => setEd(novoModelo(null))} style={{ ...s.btn(true), cursor: "pointer" }}>＋ Novo modelo</button></div>
      {l.map((m) => <div key={m.id ?? "padrao"} style={{ ...card, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}><div style={{ fontWeight: 700 }}>{m.padrao ? "★ " : ""}{m.nome}{m.virtual && <span style={{ fontSize: 11, color: C.textSub, fontWeight: 500 }}> · pronto do sistema</span>}</div>
          <div style={{ fontSize: 12.5, color: C.textSub, marginTop: 2 }}>{m.descricao || "—"}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>0–10 fixa · {m.pontos !== false ? `👍👎 ${m.itens_pontos.length} item(ns)` : "sem pontos 👍👎"} · {m.perguntas.length} pergunta(s) extra(s)</div></div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {!m.padrao && <button type="button" onClick={() => fazer(() => apiService.post(`/nps/modelos/${m.id ?? "padrao"}/padrao`, {}), `"${m.nome}" agora é o padrão.`)} style={{ ...s.btn(false), cursor: "pointer", fontSize: 12, color: C.text }}>★ Tornar padrão</button>}
          <button type="button" onClick={() => setEd(novoModelo(m))} style={{ ...s.btn(false), cursor: "pointer", fontSize: 12, color: C.text }}>Duplicar</button>
          {!m.virtual && <button type="button" onClick={() => setEd({ ...novoModelo(m), id: m.id, nome: m.nome })} style={{ ...s.btn(false), cursor: "pointer", fontSize: 12, color: C.text }}>Editar</button>}
          {!m.virtual && <button type="button" onClick={() => fazer(() => apiService.delete(`/nps/modelos/${m.id}`), "Modelo removido (pesquisas já enviadas não mudam).")} style={{ ...s.btn(false), cursor: "pointer", fontSize: 12, color: C.danger }}>Remover</button>}
        </div></div>)}
    </div>);
}
