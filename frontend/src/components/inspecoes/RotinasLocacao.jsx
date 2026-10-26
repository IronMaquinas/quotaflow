// components/inspecoes/RotinasLocacao.jsx — etapa 14b.2
// Peças da tela 🔍 Inspeções para rotinas e locação de longo prazo:
//   LinhaRotinas   — no card do equipamento: "⏰ Semanal · próxima 25/10" (verde) / "atrasada 3 d" (vermelho)
//   ModalRotinas   — rotinas do equipamento: modelo + frequência + quem faz (empresa | locatário) + início
//   ModalLocar     — 📍 locar (cliente, contrato, obra, contato, início, fim previsto) + rotina do locatário
//   ModalEncerrar  — 🏠 encerrar a locação (volta para a base; lembra da inspeção de devolução)
//   AbaCumprimento — 📊 % de cumprimento por rotina no período + relatório para imprimir
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import { abrirRelatorioCumprimento, prepararJanela } from "../../utils/gerarRelatorioCumprimento";

const FREQ = { diaria: "Diária", semanal: "Semanal", quinzenal: "Quinzenal", mensal: "Mensal" };
const dataBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const somaDias = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const corEstado = (C, r) => (r.estado === "atrasada" ? C.danger : r.estado === "hoje" ? C.warn : C.success);
export const txtEstado = (r) => (r.estado === "atrasada" ? `atrasada ${-r.dias} d` : r.estado === "hoje" ? "vence hoje" : `próxima ${dataBR(r.proxima)}`);

const casca = (C, s, conteudo, fechar, largura = 560) => (
  <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 320, padding: 16, overflowY: "auto" }} onClick={fechar}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: largura, maxWidth: "100%", padding: "18px 20px", margin: "auto 0", boxShadow: "0 24px 48px #00000060" }}>{conteudo}</div>
  </div>
);
const campo = (s, rot, el, flex = "1 1 160px") => <label style={{ flex, display: "block" }}><span style={s.label}>{rot}</span>{el}</label>;

export function LinhaRotinas({ e, C }) {
  if (!(e.rotinas || []).length) return null;
  return (
    <div style={{ marginTop: 6 }}>
      {e.rotinas.map((r) => (
        <div key={r.id} style={{ fontSize: 11, color: corEstado(C, r) }}>⏰ {r.frequencia_nome} · {r.modelo_nome}{r.responsavel === "locatario" ? " · 👤 locatário" : ""} — <b>{txtEstado(r)}</b></div>
      ))}
    </div>
  );
}

export function ModalRotinas({ e, modelos, C, s, onFechar, onMudou, onErro }) {
  const [f, setF] = useState({ modelo_id: modelos.find((m) => m.tipo === "equipamento" && m.frequencia !== "pre_uso")?.id || modelos[0]?.id || "", frequencia: "semanal", responsavel: e.situacao === "locado" ? "locatario" : "empresa", inicio: hoje() });
  const [remover, setRemover] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const salvar = async () => { setOcupado(true); try { await apiService.post("/inspecoes/rotinas", { ...f, equipamento_id: e.id }); await onMudou("Rotina criada."); } catch (x) { onErro(x.message); } finally { setOcupado(false); } };
  return casca(C, s, <>
    <div style={{ fontSize: 16, fontWeight: 700 }}>⏰ Rotinas de inspeção — {e.tag}</div>
    <div style={{ fontSize: 12, color: C.muted, margin: "4px 0 12px" }}>Gera a próxima data, o aviso de atrasada no e-mail do gestor, a camada 🔍 no calendário e o % de cumprimento. Pré-uso não entra (é a cada saída).</div>
    {(e.rotinas || []).map((r) => (
      <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
        <div style={{ flex: 1 }}><b>{r.frequencia_nome}</b> · {r.modelo_nome} · {r.responsavel_nome}<div style={{ fontSize: 11, color: corEstado(C, r) }}>{txtEstado(r)}{r.ultima ? ` · última ${dataBR(r.ultima)}` : " · nenhuma ainda"}</div></div>
        <button type="button" onClick={() => setRemover(r)} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer" }}>🗑</button>
      </div>
    ))}
    {(e.rotinas || []).length === 0 && <div style={{ fontSize: 13, color: C.muted, padding: "6px 0" }}>Nenhuma rotina ainda.</div>}
    <div style={{ ...s.card, padding: 12, marginTop: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>＋ Nova rotina</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {campo(s, "MODELO", <select value={f.modelo_id} onChange={(x) => setF({ ...f, modelo_id: x.target.value })} style={s.input}>{modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>, "2 1 220px")}
        {campo(s, "FREQUÊNCIA", <select value={f.frequencia} onChange={(x) => setF({ ...f, frequencia: x.target.value })} style={s.input}>{Object.entries(FREQ).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>)}
        {campo(s, "QUEM FAZ", <select value={f.responsavel} onChange={(x) => setF({ ...f, responsavel: x.target.value })} style={s.input}><option value="empresa">Empresa</option>{e.situacao === "locado" && <option value="locatario">Locatário ({e.locacao?.cliente})</option>}</select>)}
        {campo(s, "PRIMEIRA EM", <input type="date" value={f.inicio} onChange={(x) => setF({ ...f, inicio: x.target.value })} style={s.input} />)}
      </div>
      <div style={{ textAlign: "right", marginTop: 10 }}><button type="button" disabled={ocupado || !f.modelo_id} onClick={salvar} style={{ ...s.btn(!ocupado && !!f.modelo_id, C.accent) }}>Adicionar</button></div>
    </div>
    <div style={{ textAlign: "right", marginTop: 12 }}><button type="button" onClick={onFechar} style={{ ...s.btn(true, C.accent), cursor: "pointer" }}>Fechar</button></div>
    {remover && casca(C, s, <>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.danger }}>⚠ Remover a rotina {remover.frequencia_nome.toLowerCase()} “{remover.modelo_nome}”?</div>
      <div style={{ fontSize: 13, color: C.textSub, marginTop: 8 }}>Para de gerar datas e avisos. As inspeções já feitas continuam guardadas.</div>
      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button type="button" onClick={() => setRemover(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Voltar</button>
        <button type="button" onClick={async () => { const r = remover; setRemover(null); try { await apiService.delete(`/inspecoes/rotinas/${r.id}`); await onMudou("Rotina removida."); } catch (x) { onErro(x.message); } }} style={{ ...s.btn(true, C.danger), cursor: "pointer", flex: 1 }}>Remover</button>
      </div>
    </>, () => setRemover(null), 420)}
  </>, onFechar, 620);
}

export function ModalLocar({ e, modelos, C, s, onFechar, onMudou, onErro }) {
  const [f, setF] = useState({ cliente: "", contrato: "", local: "", contato_nome: "", contato_email: "", contato_telefone: "", inicio: hoje(), fim_previsto: "", obs: "", comRotina: true,
    modelo_id: modelos.find((m) => m.tipo === "equipamento" && m.frequencia !== "pre_uso")?.id || modelos[0]?.id || "", frequencia: "semanal" });
  const [ocupado, setOcupado] = useState(false);
  // 14b.3: locar dentro de um contrato (📑 Contratos) — cliente, obra e contato vêm dele
  const [contratos, setContratos] = useState([]);
  const [contratoId, setContratoId] = useState("");
  useEffect(() => { apiService.get("/contratos").then((r) => { const at = (r.contratos || []).filter((c) => c.status === "ativo"); setContratos(at); if (at.length) setContratoId(String(at[0].id)); }).catch(() => {}); }, []);
  const contrato = contratos.find((c) => String(c.id) === contratoId);
  const ok = (contrato || f.cliente.trim()) && f.inicio && (!f.comRotina || f.modelo_id);
  const salvar = async () => {
    setOcupado(true);
    try {
      const { comRotina, modelo_id, frequencia, ...corpo } = f;
      const rotina = comRotina ? { modelo_id, frequencia } : null;
      if (contrato) await apiService.post(`/contratos/${contrato.id}/equipamentos`, { equipamento_id: e.id, inicio: f.inicio, local: f.local || undefined, rotina });
      else await apiService.post(`/inspecoes/equipamentos/${e.id}/locar`, { ...corpo, fim_previsto: f.fim_previsto || null, rotina });
      await onMudou(`${e.tag} locado para ${contrato ? `${contrato.cliente} (${contrato.numero})` : f.cliente}. Faça a inspeção de entrega antes de sair.`);
    } catch (x) { onErro(x.message); } finally { setOcupado(false); }
  };
  const inp = (k, extra = {}) => <input value={f[k]} onChange={(x) => setF({ ...f, [k]: x.target.value })} style={s.input} {...extra} />;
  return casca(C, s, <>
    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>📍 Locar {e.tag} — {e.nome}</div>
    {campo(s, "CONTRATO DE LOCAÇÃO", <select value={contratoId} onChange={(x) => setContratoId(x.target.value)} style={s.input}>
      {contratos.map((c) => <option key={c.id} value={c.id}>{c.numero} — {c.cliente}{c.local ? ` · ${c.local}` : ""}</option>)}
      <option value="">Sem contrato (locação avulsa)</option></select>, "1 1 100%")}
    {contrato ? <div style={{ fontSize: 12, color: C.muted, margin: "6px 0 0" }}>Cliente, obra e contato vêm do contrato. Novo contrato: menu 📑 Contratos.</div> : <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {campo(s, "CLIENTE (LOCATÁRIO)", inp("cliente", { autoFocus: true }), "2 1 240px")}
        {campo(s, "Nº DO CONTRATO", inp("contrato"))}
      </div>
      <div style={{ marginTop: 8 }}>{campo(s, "LOCAL / OBRA", inp("local", { placeholder: "Obra BR-101, km 230 — Campos/RJ" }), "1 1 100%")}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {campo(s, "CONTATO NO CLIENTE", inp("contato_nome"))}
        {campo(s, "E-MAIL", inp("contato_email", { type: "email" }))}
        {campo(s, "TELEFONE", inp("contato_telefone", { inputMode: "tel" }))}
      </div></>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
      {campo(s, "INÍCIO", inp("inicio", { type: "date" }))}
      {!contrato && campo(s, "TÉRMINO (OPCIONAL)", inp("fim_previsto", { type: "date" }))}
    </div>
    <div style={{ ...s.card, padding: 12, marginTop: 12 }}>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, cursor: "pointer" }}><input type="checkbox" checked={f.comRotina} onChange={(x) => setF({ ...f, comRotina: x.target.checked })} /><b>Rotina de inspeção pelo locatário</b></label>
      {f.comRotina && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {campo(s, "MODELO", <select value={f.modelo_id} onChange={(x) => setF({ ...f, modelo_id: x.target.value })} style={s.input}>{modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>, "2 1 220px")}
        {campo(s, "FREQUÊNCIA", <select value={f.frequencia} onChange={(x) => setF({ ...f, frequencia: x.target.value })} style={s.input}>{Object.entries(FREQ).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>)}
      </div>}
      {f.comRotina && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Primeira em {dataBR(somaDias(f.inicio || hoje(), { diaria: 1, semanal: 7, quinzenal: 15, mensal: 30 }[f.frequencia]))}. O locatário inspeciona pelo acesso dele (📑 Contratos → 👤 Acessos).</div>}
    </div>
    <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
      <button type="button" onClick={onFechar} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
      <button type="button" disabled={ocupado || !ok} onClick={salvar} style={{ ...s.btn(!ocupado && !!ok, C.accent), flex: 1 }}>Locar</button>
    </div>
  </>, onFechar, 620);
}

export function ModalEncerrar({ e, C, s, onFechar, onMudou, onErro }) {
  const [fim, setFim] = useState(hoje());
  const [ocupado, setOcupado] = useState(false);
  const l = e.locacao || {};
  return casca(C, s, <>
    <div style={{ fontSize: 16, fontWeight: 700 }}>🏠 Encerrar a locação de {e.tag}</div>
    <div style={{ fontSize: 13, color: C.textSub, marginTop: 6 }}>{l.cliente}{l.contrato ? ` · ${l.contrato}` : ""}{l.local ? ` · ${l.local}` : ""} · desde {dataBR(l.inicio)}</div>
    <div style={{ fontSize: 13, marginTop: 10, color: C.warn }}>💡 Faça a <b>inspeção de devolução</b> (modelo do tipo "Devolução") antes ou logo depois — o relatório compara com a entrega.</div>
    <label style={{ display: "block", marginTop: 12 }}><span style={s.label}>DATA DA DEVOLUÇÃO</span><input type="date" value={fim} onChange={(x) => setFim(x.target.value)} style={{ ...s.input, maxWidth: 200 }} /></label>
    <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>O equipamento volta para 🏠 Na base e as rotinas do locatário desta locação param.</div>
    <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
      <button type="button" onClick={onFechar} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
      <button type="button" disabled={ocupado} onClick={async () => { setOcupado(true); try { await apiService.post(`/inspecoes/equipamentos/${e.id}/encerrar-locacao`, { fim_real: fim }); await onMudou(`Locação encerrada — ${e.tag} na base.`); } catch (x) { onErro(x.message); } finally { setOcupado(false); } }} style={{ ...s.btn(!ocupado, C.success), flex: 1 }}>Encerrar locação</button>
    </div>
  </>, onFechar, 520);
}

export function AbaCumprimento({ C, s, onErro }) {
  const [de, setDe] = useState(somaDias(hoje(), -29));
  const [ate, setAte] = useState(hoje());
  const [d, setD] = useState(null);
  const carregar = async () => { try { setD(await apiService.get("/inspecoes/cumprimento", { de, ate })); } catch (e) { onErro(e.message); } };
  useEffect(() => { carregar(); }, []); // eslint-disable-line
  const corPct = (p) => (p == null ? C.muted : p >= 90 ? C.success : p >= 70 ? C.warn : C.danger);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
        {campo(s, "DE", <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={s.input} />, "0 0 160px")}
        {campo(s, "ATÉ", <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={s.input} />, "0 0 160px")}
        <button type="button" onClick={carregar} style={{ ...s.btn(true, C.accent), cursor: "pointer" }}>Atualizar</button>
        {d && <button type="button" onClick={() => { const w = prepararJanela(); try { abrirRelatorioCumprimento(d, w); } catch (e) { onErro(e.message); } }} style={{ ...s.btn(false), cursor: "pointer", color: C.text, background: "transparent" }}>🖨 Relatório</button>}
      </div>
      {!d ? <div style={{ color: C.muted }}>Carregando…</div> : (<>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          {[["Cumprimento", d.total.pct == null ? "—" : `${d.total.pct}%`, corPct(d.total.pct), `${d.total.cumpridas} de ${d.total.esperadas} previstas`],
            ["Inspeções no período", d.inspecoes.total, C.accent, `${d.inspecoes.terceiros} de terceiros`],
            ["Reprovadas", d.inspecoes.reprovadas, d.inspecoes.reprovadas ? C.danger : C.muted, `${d.inspecoes.ressalvas} com ressalvas`]].map(([l, v, c, sub]) => (
            <div key={l} style={{ ...s.card, padding: "10px 14px", minWidth: 160 }}><div style={{ fontSize: 11, color: C.muted }}>{l.toUpperCase()}</div><div style={{ fontSize: 24, fontWeight: 800, color: c }}>{v}</div><div style={{ fontSize: 11, color: C.muted }}>{sub}</div></div>
          ))}
        </div>
        <div style={{ ...s.card, overflow: "hidden" }}>
          {d.linhas.map((l, k) => (
            <div key={l.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: k < d.linhas.length - 1 ? `1px solid ${C.border}` : "none", flexWrap: "wrap", opacity: l.encerrada ? 0.7 : 1 }}>
              <div style={{ flex: "2 1 220px" }}><div style={{ fontWeight: 600, fontSize: 13 }}>{l.equipamento_nome}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{l.frequencia_nome} · {l.modelo_nome} · {l.responsavel_nome}{l.encerrada ? " · encerrada" : ""}</div></div>
              <div style={{ fontSize: 12, color: C.textSub }}>{l.cumpridas}/{l.esperadas}</div>
              <div style={{ width: 90, height: 6, background: C.border, borderRadius: 3 }}><div style={{ width: `${l.pct || 0}%`, height: 6, background: corPct(l.pct), borderRadius: 3 }} /></div>
              <b style={{ width: 44, textAlign: "right", color: corPct(l.pct) }}>{l.pct == null ? "—" : `${l.pct}%`}</b>
              {!l.encerrada && <span style={s.tag(corEstado(C, l))}>{txtEstado(l)}</span>}
            </div>
          ))}
          {d.linhas.length === 0 && <div style={{ padding: 20, color: C.muted, textAlign: "center" }}>Nenhuma rotina no período. Crie em 🚚 Equipamentos → ⏰ Rotinas.</div>}
        </div>
      </>)}
    </div>
  );
}
