// components/turismo/TelaTurismo.jsx — etapa T1: 🚌 VIAGENS E EMBARQUE
//   Abas: Viagens (lista → viagem: ônibus, mapa de poltronas, reservas individuais/grupo, importar planilha, lista A4) | Mapas de poltronas (modelos + editor)
import { useEffect, useMemo, useState } from "react";
import apiService from "../../services/apiService";
import CampoFuncionario from "../shared/CampoFuncionario";
import MapaPoltronas, { Legenda } from "./MapaPoltronas";
import { abrirListaPassageiros, lerPlanilha } from "../../utils/listaPassageiros";
import { carregarLogoEmpresa } from "../../utils/logoEmpresa";

const erroDe = (e) => e?.response?.data?.erro || e.message;
const STATUS = { planejada: "📋 Planejada", em_andamento: "🚌 Em andamento", concluida: "✅ Concluída", cancelada: "✖ Cancelada" };
const loc = (v) => (v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const inputDT = (v) => { if (!v) return ""; const d = new Date(v); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const PASS_VAZIO = { nome: "", documento: "", nascimento: "", telefone: "", emergencia_nome: "", emergencia_telefone: "", obs: "", assistencia: false };

function Modal({ C, s, titulo, onFechar, children, largura = 520 }) {
  return <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, padding: "16px 18px", width: `min(${largura}px, 100%)`, maxHeight: "92vh", overflowY: "auto", display: "grid", gap: 10, color: C.text }}>
      <b style={{ fontSize: 15 }}>{titulo}</b>{children}
    </div></div>;
}
function Confirmar({ C, s, texto, onSim, onNao }) {
  return <Modal C={C} s={s} titulo="Confirmar" onFechar={onNao} largura={400}><div style={{ fontSize: 13.5 }}>{texto}</div>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={onNao} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button><button type="button" onClick={onSim} style={{ ...s.btn(true), cursor: "pointer" }}>Confirmar</button></div></Modal>;
}

export default function TelaTurismo({ C, s }) {
  const [aba, setAba] = useState("viagens"); const [aberta, setAberta] = useState(null);
  useEffect(() => { carregarLogoEmpresa().catch(() => {}); }, []);
  return <div style={{ padding: "18px clamp(12px, 2.5vw, 28px)", display: "grid", gap: 14, color: C.text }}>
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>🚌 Viagens e embarque</h2>
      <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>{[["viagens", "Viagens"], ["mapas", "Mapas de poltronas"]].map(([k, l]) => <button key={k} type="button" onClick={() => { setAba(k); setAberta(null); }} style={{ ...s.btn(aba === k), cursor: "pointer" }}>{l}</button>)}</div>
    </div>
    {aba === "mapas" ? <Mapas C={C} s={s} /> : aberta ? <Viagem C={C} s={s} id={aberta} onVoltar={() => setAberta(null)} /> : <ListaViagens C={C} s={s} onAbrir={setAberta} />}
  </div>;
}

// ─── lista de viagens ───────────────────────────────────────────────────────
function ListaViagens({ C, s, onAbrir }) {
  const [l, setL] = useState(null); const [f, setF] = useState({ status: "ativas", busca: "" }); const [nova, setNova] = useState(null); const [msg, setMsg] = useState("");
  const carregar = () => apiService.get(`/turismo/viagens?${new URLSearchParams(f)}`).then((r) => setL(r.viagens)).catch((e) => setMsg(`⚠ ${erroDe(e)}`));
  useEffect(() => { carregar(); }, [f.status, f.busca]); // eslint-disable-line react-hooks/exhaustive-deps
  return <>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button type="button" onClick={() => setNova({ nome: "", destino: "", saida_em: "", retorno_em: "", local_saida: "", obs: "" })} style={{ ...s.btn(true), cursor: "pointer" }}>＋ Nova viagem</button>
      <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} style={s.input}><option value="ativas">Planejadas e em andamento</option><option value="concluida">Concluídas</option><option value="cancelada">Canceladas</option><option value="">Todas</option></select>
      <input value={f.busca} onChange={(e) => setF({ ...f, busca: e.target.value })} placeholder="🔎 Buscar viagem, destino…" style={{ ...s.input, flex: "1 1 200px" }} />
    </div>
    {msg && <div style={{ color: C.warn, fontSize: 13 }}>{msg}</div>}
    {!l ? <div style={{ color: C.textSub }}>Carregando…</div> : !l.length ? <div style={{ ...s.card, padding: 18, color: C.textSub }}>Nenhuma viagem aqui. Crie a primeira: viagem = evento (show, excursão, romaria…) com um ou vários ônibus.</div> :
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {l.map((v) => { const pct = v.lugares ? Math.round((v.passageiros / v.lugares) * 100) : 0;
          return <div key={v.id} onClick={() => onAbrir(v.id)} style={{ ...s.card, padding: "12px 14px", cursor: "pointer", display: "grid", gap: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{v.nome}</b><span style={{ fontSize: 11.5, color: C.textSub }}>{v.numero}</span></div>
            <div style={{ fontSize: 12.5, color: C.textSub }}>{v.destino || "—"} · saída {loc(v.saida_em)}</div>
            <div style={{ fontSize: 12.5 }}>{STATUS[v.status]} · {v.onibus} ônibus · <b>{v.passageiros}</b>/{v.lugares} lugares</div>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,.08)" }}><div style={{ width: `${Math.min(pct, 100)}%`, height: 6, borderRadius: 3, background: pct >= 100 ? "#a3402e" : "#1f6f43" }} /></div>
          </div>; })}
      </div>}
    {nova && <FormViagem C={C} s={s} v={nova} onFechar={() => setNova(null)} onSalvo={(v) => { setNova(null); onAbrir(v.id); }} />}
  </>;
}

function FormViagem({ C, s, v, onFechar, onSalvo }) {
  const [d, setD] = useState({ ...v, saida_em: inputDT(v.saida_em), retorno_em: inputDT(v.retorno_em) }); const [msg, setMsg] = useState("");
  const lab = { fontSize: 11.5, color: C.textSub, display: "block", marginBottom: 3 };
  const salvar = async () => { setMsg(""); try { const b = { ...d, saida_em: d.saida_em ? new Date(d.saida_em).toISOString() : null, retorno_em: d.retorno_em ? new Date(d.retorno_em).toISOString() : null };
    const r = v.id ? await apiService.put(`/turismo/viagens/${v.id}`, b) : await apiService.post("/turismo/viagens", b); onSalvo(r.viagem); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } };
  const campo = (k, l, t = "text") => <div style={{ flex: "1 1 200px" }}><span style={lab}>{l}</span><input type={t} value={d[k] || ""} onChange={(e) => setD({ ...d, [k]: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>;
  return <Modal C={C} s={s} titulo={v.id ? "Editar viagem" : "Nova viagem"} onFechar={onFechar}>
    {campo("nome", "NOME DO EVENTO / VIAGEM")}{campo("destino", "DESTINO")}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{campo("saida_em", "SAÍDA", "datetime-local")}{campo("retorno_em", "RETORNO", "datetime-local")}</div>
    {campo("local_saida", "LOCAL DE SAÍDA / EMBARQUE")}
    {v.id && <div><span style={lab}>SITUAÇÃO</span><select value={d.status} onChange={(e) => setD({ ...d, status: e.target.value })} style={{ ...s.input, width: "100%" }}>{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>}
    <div><span style={lab}>OBSERVAÇÕES</span><textarea value={d.obs || ""} onChange={(e) => setD({ ...d, obs: e.target.value })} rows={2} style={{ ...s.input, width: "100%" }} /></div>
    {msg && <div style={{ color: C.warn, fontSize: 13 }}>{msg}</div>}
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={onFechar} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button><button type="button" onClick={salvar} style={{ ...s.btn(true), cursor: "pointer" }}>Salvar</button></div>
  </Modal>;
}

// ─── viagem aberta ──────────────────────────────────────────────────────────
function Viagem({ C, s, id, onVoltar }) {
  const [D, setD] = useState(null); const [msg, setMsg] = useState(""); const [busId, setBusId] = useState(null); const [modo, setModo] = useState("reservar");
  const [sel, setSel] = useState([]); const [reserva, setReserva] = useState(null); const [pass, setPass] = useState(null); const [movendo, setMovendo] = useState(null);
  const [formBus, setFormBus] = useState(null); const [editar, setEditar] = useState(false); const [importar, setImportar] = useState(false); const [conf, setConf] = useState(null); const [mapas, setMapas] = useState(null);
  const carregar = () => apiService.get(`/turismo/viagens/${id}`).then((r) => { setD(r); setBusId((b) => (r.onibus.some((o) => String(o.id) === String(b)) ? b : r.onibus[0]?.id || null)); }).catch((e) => setMsg(`⚠ ${erroDe(e)}`));
  useEffect(() => { carregar(); apiService.get("/turismo/mapas").then(setMapas).catch(() => setMapas({ mapas: [], modelos: [] })); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const bus = D?.onibus.find((o) => String(o.id) === String(busId)); const doBus = useMemo(() => (D && bus ? D.passageiros.filter((p) => String(p.onibus_id) === String(bus.id)) : []), [D, bus]);
  const avisar = (t) => { setMsg(t); setTimeout(() => setMsg((m) => (m === t ? "" : m)), 5000); };
  const mover = async (pid, poltrona, onibusId = bus?.id) => { try { const r = await apiService.post(`/turismo/passageiros/${pid}/mover`, { onibus_id: onibusId, poltrona }); avisar(r.trocou ? `🔁 Trocados de lugar com ${r.trocou.nome}.` : "✔ Passageiro mudou de poltrona."); setMovendo(null); carregar(); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } };
  const clique = async (c, _pt, p) => {
    if (movendo) { if (p && String(p.id) === String(movendo.id)) { setMovendo(null); return; } if ((bus.bloqueadas || []).includes(c.n)) { setMsg("⚠ Poltrona bloqueada."); return; } mover(movendo.id, c.n); return; }
    if (modo === "bloquear") { if (p) { setMsg("⚠ Poltrona ocupada — tire o passageiro antes de bloquear."); return; } try { await apiService.post(`/turismo/onibus/${bus.id}/bloquear`, { poltrona: c.n, bloquear: !(bus.bloqueadas || []).includes(c.n) }); carregar(); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } return; }
    if (p) { setPass(p); return; }
    if ((bus.bloqueadas || []).includes(c.n)) { setMsg("Poltrona bloqueada — use o modo 🚫 Bloquear para liberar."); return; }
    setSel((l) => (l.includes(c.n) ? l.filter((x) => x !== c.n) : [...l, c.n]));
  };
  const sugerir = async (n) => { try { const r = await apiService.get(`/turismo/onibus/${bus.id}/sugestao?n=${n}`); setSel(r.poltronas); if (r.poltronas.length < n) setMsg(`⚠ Só há ${r.poltronas.length} livre(s) neste ônibus.`); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } };
  const abrirReserva = () => setReserva({ responsavel: "", telefone: "", email: "", origem_venda: "", pago: false, obs: "", passageiros: (sel.length ? sel : [null]).map((n) => ({ ...PASS_VAZIO, poltrona: n, onibus_id: n ? bus?.id : null, menor_de: null })) });
  if (!D) return <div style={{ color: msg ? C.warn : C.textSub }}>{msg || "Carregando…"}</div>;
  const v = D.viagem;
  return <div style={{ display: "grid", gap: 12 }}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button type="button" onClick={onVoltar} style={{ ...s.btn(false), cursor: "pointer" }}>← Viagens</button>
      <div style={{ flex: "1 1 240px" }}><b style={{ fontSize: 16 }}>{v.nome}</b> <span style={{ fontSize: 12, color: C.textSub }}>{v.numero} · {STATUS[v.status]}</span>
        <div style={{ fontSize: 12.5, color: C.textSub }}>{v.destino || "—"} · saída {loc(v.saida_em)}{v.local_saida ? ` · ${v.local_saida}` : ""} · retorno {loc(v.retorno_em)}</div></div>
      <button type="button" onClick={() => setEditar(true)} style={{ ...s.btn(false), cursor: "pointer" }}>✎ Viagem</button>
      <button type="button" onClick={() => setImportar(true)} disabled={!D.onibus.length} style={{ ...s.btn(false), cursor: "pointer" }}>📥 Importar planilha</button>
      <button type="button" onClick={() => { if (!abrirListaPassageiros(D)) setMsg("⚠ Libere pop-ups para abrir a lista."); }} style={{ ...s.btn(false), cursor: "pointer" }}>🖨 Lista de passageiros</button>
    </div>
    {msg && <div style={{ fontSize: 13, color: msg.startsWith("⚠") ? C.warn : C.ok || "#4caf50" }}>{msg}</div>}
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {D.onibus.map((o) => <button key={o.id} type="button" onClick={() => { setBusId(o.id); setSel([]); }} style={{ ...s.btn(String(o.id) === String(busId)), cursor: "pointer" }}>🚌 {o.nome}{o.placa ? ` · ${o.placa}` : ""} <span style={{ opacity: .75 }}>({o.ocupados}/{o.lugares})</span></button>)}
      <button type="button" onClick={() => setFormBus({ mapa_id: mapas?.mapas?.[0]?.id || "tpl:conv46", nome: "", placa: "", empresa: "", motorista_nome: "", motorista_colaborador_id: null, motorista_telefone: "", equipamento_id: "" })} style={{ ...s.btn(false), cursor: "pointer" }}>＋ Ônibus</button>
      {(D.sem_poltrona > 0 || D.incompletos > 0) && <span style={{ fontSize: 12.5, color: C.warn, marginLeft: 6 }}>{D.sem_poltrona > 0 && `${D.sem_poltrona} sem poltrona · `}{D.incompletos > 0 && `${D.incompletos} com dado faltando`}</span>}
    </div>
    {!bus ? <div style={{ ...s.card, padding: 18, color: C.textSub }}>Inclua o primeiro ônibus: escolha o mapa de poltronas (modelo pronto ou um seu), placa e motorista.</div> :
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ ...s.card, padding: 14, display: "grid", gap: 10, flex: "0 1 auto", overflowX: "auto", maxWidth: "100%" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {[["reservar", "🎟 Reservar"], ["bloquear", "🚫 Bloquear"]].map(([k, l]) => <button key={k} type="button" onClick={() => { setModo(k); setSel([]); setMovendo(null); }} style={{ ...s.btn(modo === k), cursor: "pointer", padding: "5px 10px" }}>{l}</button>)}
            <button type="button" onClick={() => setFormBus({ ...bus, mapa_id: bus.mapa_id || "" })} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px" }}>✎ Ônibus</button>
          </div>
          <div style={{ fontSize: 12, color: C.textSub }}>{bus.empresa || "—"} · motorista {bus.motorista_nome || "—"}{bus.motorista_telefone ? ` · ${bus.motorista_telefone}` : ""} · {bus.livres} livre(s)</div>
          {movendo && <div style={{ fontSize: 12.5, color: "#7fb2ff" }}>🔁 Toque na poltrona de destino de <b>{movendo.nome}</b> (ocupada = troca). Toque nele de novo para cancelar.</div>}
          {modo === "bloquear" && <div style={{ fontSize: 12.5, color: C.textSub }}>Toque para bloquear/liberar (guia, poltrona quebrada, reservada à empresa…).</div>}
          <MapaPoltronas C={C} layout={bus.layout} passageiros={doBus} bloqueadas={bus.bloqueadas || []} selecionadas={movendo ? [movendo.poltrona] : sel} onClique={clique} onSoltar={(pid, n) => mover(pid, n)} />
          <Legenda C={C} /><div style={{ fontSize: 11.5, color: C.muted }}>Dica: arraste um passageiro para outra poltrona (no computador).</div>
        </div>
        <div style={{ flex: "1 1 280px", display: "grid", gap: 10 }}>
          {modo === "reservar" && <div style={{ ...s.card, padding: 14, display: "grid", gap: 8 }}>
            <b>🎟 Nova reserva</b>
            <div style={{ fontSize: 12.5, color: C.textSub }}>{sel.length ? <>Poltronas: <b style={{ color: C.text }}>{sel.join(", ")}</b></> : "Toque nas poltronas livres — ou peça lugares lado a lado:"}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{[1, 2, 3, 4, 5, 6].map((n) => <button key={n} type="button" onClick={() => sugerir(n)} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 10px" }}>{n}</button>)}<span style={{ fontSize: 11.5, color: C.muted, alignSelf: "center" }}>juntos</span></div>
            <div style={{ display: "flex", gap: 8 }}><button type="button" onClick={abrirReserva} style={{ ...s.btn(true), cursor: "pointer" }}>{sel.length > 1 ? `Reservar ${sel.length} (grupo/família)` : sel.length ? "Reservar" : "Reservar sem poltrona"}</button>{sel.length > 0 && <button type="button" onClick={() => setSel([])} style={{ ...s.btn(false), cursor: "pointer" }}>Limpar</button>}</div>
          </div>}
          <Reservas C={C} s={s} D={D} onPass={setPass} onMudou={carregar} setConf={setConf} setMsg={setMsg} />
        </div>
      </div>}
    {D.sem_poltrona > 0 && bus && <div style={{ ...s.card, padding: 12 }}><b style={{ fontSize: 13 }}>Sem poltrona</b><div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>{D.passageiros.filter((p) => !p.poltrona).map((p) => <button key={p.id} type="button" onClick={() => setMovendo(p)} draggable onDragStart={(ev) => ev.dataTransfer.setData("text/plain", String(p.id))} style={{ ...s.btn(movendo?.id === p.id), cursor: "pointer", padding: "4px 10px" }}>{p.nome}</button>)}</div><div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>Toque no nome e depois na poltrona (ou arraste).</div></div>}
    {editar && <FormViagem C={C} s={s} v={v} onFechar={() => setEditar(false)} onSalvo={() => { setEditar(false); carregar(); }} />}
    {formBus && <FormOnibus C={C} s={s} viagemId={v.id} o={formBus} mapas={mapas} onFechar={() => setFormBus(null)} onSalvo={(o) => { setFormBus(null); if (o) setBusId(o.id); carregar(); }} setConf={setConf} />}
    {reserva && <FormReserva C={C} s={s} viagemId={v.id} r={reserva} onFechar={() => setReserva(null)} onSalvo={(t) => { setReserva(null); setSel([]); avisar(t); carregar(); }} />}
    {pass && <FormPassageiro C={C} s={s} p={pass} onFechar={() => setPass(null)} onMover={() => { setMovendo(pass); setPass(null); setModo("reservar"); setSel([]); }} onSalvo={(t) => { setPass(null); avisar(t); carregar(); }} setConf={setConf} />}
    {importar && <Importar C={C} s={s} D={D} onFechar={() => setImportar(false)} onFeito={(t) => { setImportar(false); avisar(t); carregar(); }} />}
    {conf && <Confirmar C={C} s={s} texto={conf.texto} onNao={() => setConf(null)} onSim={async () => { const f = conf.sim; setConf(null); await f(); }} />}
  </div>;
}

function Reservas({ C, s, D, onPass, onMudou, setConf, setMsg }) {
  const [busca, setBusca] = useState(""); const [aberta, setAberta] = useState(null);
  const t = busca.trim().toLowerCase(); const busNome = (id) => D.onibus.find((o) => String(o.id) === String(id))?.nome || "";
  const rs = D.reservas.filter((r) => !t || [r.codigo, r.responsavel, r.telefone].some((x) => String(x || "").toLowerCase().includes(t)) || D.passageiros.some((p) => String(p.reserva_id) === String(r.id) && String(p.nome).toLowerCase().includes(t)));
  const pago = async (r) => { try { await apiService.put(`/turismo/reservas/${r.id}`, { pago: !r.pago }); onMudou(); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } };
  const excluir = (r) => setConf({ texto: `Cancelar a reserva ${r.codigo} (${r.responsavel}) e liberar as poltronas?`, sim: async () => { try { await apiService.delete(`/turismo/reservas/${r.id}`); onMudou(); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } } });
  return <div style={{ ...s.card, padding: 14, display: "grid", gap: 8 }}>
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}><b>Reservas ({D.reservas.length}) · {D.passageiros.length} passageiro(s)</b></div>
    <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔎 Nome, código, telefone…" style={{ ...s.input, width: "100%" }} />
    <div style={{ display: "grid", gap: 6, maxHeight: 460, overflowY: "auto" }}>
      {rs.map((r) => { const ps = D.passageiros.filter((p) => String(p.reserva_id) === String(r.id)); const ab = aberta === r.id || !!t;
        return <div key={r.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 9px" }}>
          <div onClick={() => setAberta(ab && !t ? null : r.id)} style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer", fontSize: 13 }}>
            <b>{r.codigo}</b><span style={{ flex: 1 }}>{r.tipo === "grupo" ? "👨‍👩‍👧 " : ""}{r.responsavel}</span><span style={{ fontSize: 11.5, color: C.textSub }}>{ps.length} · {ps.map((p) => p.poltrona || "—").join(",")}</span>
            {r.pago && <span title="Pago" style={{ fontSize: 11 }}>💲</span>}
          </div>
          {ab && <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
            {ps.map((p) => <div key={p.id} onClick={() => onPass(p)} style={{ fontSize: 12.5, cursor: "pointer", display: "flex", gap: 6 }}><span style={{ width: 70, color: C.textSub }}>{p.poltrona ? `${busNome(p.onibus_id).slice(0, 8)} ${p.poltrona}` : "sem pol."}</span><span style={{ flex: 1 }}>{p.nome}{p.menor ? " · menor" : ""}</span>{p.incompleto && <span style={{ color: C.warn }} title="Falta documento, nascimento ou telefone">⚠</span>}</div>)}
            <div style={{ fontSize: 11.5, color: C.textSub }}>{[r.telefone, r.email, r.origem_venda && `venda: ${r.origem_venda}`, r.obs].filter(Boolean).join(" · ")}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button type="button" onClick={() => pago(r)} style={{ ...s.btn(r.pago), cursor: "pointer", padding: "3px 9px", fontSize: 12 }}>{r.pago ? "💲 Pago" : "Marcar pago"}</button><button type="button" onClick={() => excluir(r)} style={{ ...s.btn(false), cursor: "pointer", padding: "3px 9px", fontSize: 12 }}>Cancelar reserva</button></div>
          </div>}
        </div>; })}
      {!rs.length && <div style={{ fontSize: 12.5, color: C.textSub }}>{t ? "Nada encontrado." : "Nenhuma reserva ainda."}</div>}
    </div>
  </div>;
}

function CamposPassageiro({ C, s, p, set, enxuto = false }) {
  const lab = { fontSize: 11, color: C.textSub, display: "block", marginBottom: 2 };
  const c = (k, l, t = "text", flex = "1 1 140px") => <div style={{ flex }}><span style={lab}>{l}</span><input type={t} value={p[k] || ""} onChange={(e) => set({ ...p, [k]: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>;
  return <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
    {c("nome", "NOME COMPLETO", "text", "2 1 220px")}{c("documento", "RG / CPF")}{c("nascimento", "NASCIMENTO", "date")}{c("telefone", "TELEFONE")}
    {!enxuto && <>{c("emergencia_nome", "CONTATO DE EMERGÊNCIA")}{c("emergencia_telefone", "TEL. EMERGÊNCIA")}{c("obs", "OBSERVAÇÃO (saúde, alimentação…)", "text", "2 1 220px")}</>}
    <label style={{ fontSize: 12.5, display: "flex", gap: 5, alignItems: "center", flex: "1 1 100%" }}><input type="checkbox" checked={!!p.assistencia} onChange={(e) => set({ ...p, assistencia: e.target.checked })} /> Precisa de assistência (idoso, mobilidade…)</label>
  </div>;
}

function FormReserva({ C, s, viagemId, r, onFechar, onSalvo }) {
  const [d, setD] = useState(r); const [msg, setMsg] = useState(""); const [salvando, setSalvando] = useState(false);
  const lab = { fontSize: 11.5, color: C.textSub, display: "block", marginBottom: 3 }; const grupo = d.passageiros.length > 1;
  const setP = (i, p) => setD({ ...d, passageiros: d.passageiros.map((x, j) => (j === i ? p : x)) });
  const salvar = async () => { setMsg(""); setSalvando(true); try { const x = await apiService.post(`/turismo/viagens/${viagemId}/reservas`, d); onSalvo(`✔ Reserva ${x.reserva.codigo} criada (${x.passageiros.length} passageiro(s)).`); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } finally { setSalvando(false); } };
  return <Modal C={C} s={s} titulo={grupo ? "🎟 Reserva de grupo / família" : "🎟 Reserva"} onFechar={onFechar} largura={720}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {grupo && <div style={{ flex: "2 1 220px" }}><span style={lab}>RESPONSÁVEL PELO GRUPO</span><input value={d.responsavel} onChange={(e) => setD({ ...d, responsavel: e.target.value })} placeholder="Em branco = 1º passageiro" style={{ ...s.input, width: "100%" }} /></div>}
      <div style={{ flex: "1 1 150px" }}><span style={lab}>TELEFONE DA RESERVA</span><input value={d.telefone} onChange={(e) => setD({ ...d, telefone: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>
      <div style={{ flex: "1 1 150px" }}><span style={lab}>VENDIDO POR (opcional)</span><input value={d.origem_venda} list="origens-venda" onChange={(e) => setD({ ...d, origem_venda: e.target.value })} placeholder="balcão, site, WhatsApp…" style={{ ...s.input, width: "100%" }} /><datalist id="origens-venda">{["Balcão", "WhatsApp", "Site", "Instagram", "Agente / revendedor"].map((o) => <option key={o} value={o} />)}</datalist></div>
      <label style={{ fontSize: 13, display: "flex", gap: 5, alignItems: "center" }}><input type="checkbox" checked={d.pago} onChange={(e) => setD({ ...d, pago: e.target.checked })} /> Pago</label>
    </div>
    {d.passageiros.map((p, i) => <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5 }}><b>Passageiro {i + 1}</b><span style={{ color: C.textSub }}>{p.poltrona ? `poltrona ${p.poltrona}` : "sem poltrona"}</span>
        {grupo && i > 0 && <label style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>menor sob responsabilidade de <select value={p.menor_de ?? ""} onChange={(e) => setP(i, { ...p, menor_de: e.target.value === "" ? null : Number(e.target.value) })} style={{ ...s.input, padding: "3px 6px" }}><option value="">—</option>{d.passageiros.map((q2, j) => j !== i && <option key={j} value={j}>{q2.nome || `Passageiro ${j + 1}`}</option>)}</select></label>}
        {!p.poltrona && d.passageiros.length > 1 && <button type="button" onClick={() => setD({ ...d, passageiros: d.passageiros.filter((_, j) => j !== i) })} style={{ ...s.btn(false), cursor: "pointer", padding: "2px 8px", marginLeft: grupo && i > 0 ? 0 : "auto" }}>✕</button>}
      </div>
      <CamposPassageiro C={C} s={s} p={p} set={(x) => setP(i, x)} enxuto={grupo && i > 0} />
    </div>)}
    <button type="button" onClick={() => setD({ ...d, passageiros: [...d.passageiros, { ...PASS_VAZIO, poltrona: null, onibus_id: null, menor_de: null }] })} style={{ ...s.btn(false), cursor: "pointer", justifySelf: "start" }}>＋ Passageiro sem poltrona (escolhe depois)</button>
    <div style={{ fontSize: 11.5, color: C.muted }}>Só o nome é obrigatório agora; o que faltar (documento, nascimento, telefone) fica com ⚠ na lista para completar antes do embarque.</div>
    {msg && <div style={{ color: C.warn, fontSize: 13 }}>{msg}</div>}
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={onFechar} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button><button type="button" disabled={salvando} onClick={salvar} style={{ ...s.btn(true), cursor: "pointer" }}>{salvando ? "Salvando…" : "Confirmar reserva"}</button></div>
  </Modal>;
}

function FormPassageiro({ C, s, p, onFechar, onMover, onSalvo, setConf }) {
  const [d, setD] = useState({ ...PASS_VAZIO, ...p }); const [msg, setMsg] = useState("");
  const salvar = async () => { try { await apiService.put(`/turismo/passageiros/${p.id}`, d); onSalvo("✔ Passageiro atualizado."); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } };
  const tirar = () => setConf({ texto: `Tirar ${p.nome} da viagem? A poltrona fica livre.`, sim: async () => { try { await apiService.delete(`/turismo/passageiros/${p.id}`); onSalvo("✔ Passageiro removido."); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } } });
  return <Modal C={C} s={s} titulo={`${p.poltrona ? `Poltrona ${p.poltrona} · ` : ""}${p.nome}`} onFechar={onFechar} largura={620}>
    <div style={{ fontSize: 12.5, color: C.textSub }}>Reserva {p.reserva_codigo}{p.reserva_tipo === "grupo" ? ` · grupo de ${p.responsavel}` : ""}{p.idade != null ? ` · ${p.idade} anos` : ""}{p.menor ? " · menor de idade" : ""}</div>
    <CamposPassageiro C={C} s={s} p={d} set={setD} />
    {msg && <div style={{ color: C.warn, fontSize: 13 }}>{msg}</div>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" onClick={onMover} style={{ ...s.btn(false), cursor: "pointer" }}>🔁 Mudar / trocar poltrona</button>
      <button type="button" onClick={tirar} style={{ ...s.btn(false), cursor: "pointer" }}>Tirar da viagem</button>
      <span style={{ flex: 1 }} /><button type="button" onClick={onFechar} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button><button type="button" onClick={salvar} style={{ ...s.btn(true), cursor: "pointer" }}>Salvar</button>
    </div>
  </Modal>;
}

function FormOnibus({ C, s, viagemId, o, mapas, onFechar, onSalvo, setConf }) {
  const [d, setD] = useState(o); const [msg, setMsg] = useState(""); const [frota, setFrota] = useState([]); const [pessoas, setPessoas] = useState(null);
  useEffect(() => { apiService.listarEquipamentos().then((r) => setFrota((Array.isArray(r) ? r : r?.equipamentos || []).filter((e) => e.placa))).catch(() => {}); apiService.get("/pessoas/gestao-pessoas").then((r) => setPessoas(r.funcionarios || [])).catch(() => setPessoas([])); }, []);
  const lab = { fontSize: 11.5, color: C.textSub, display: "block", marginBottom: 3 };
  const salvar = async () => { setMsg(""); try { const r = o.id ? await apiService.put(`/turismo/onibus/${o.id}`, { ...d, viagem_id: viagemId }) : await apiService.post(`/turismo/viagens/${viagemId}/onibus`, d); onSalvo(r.onibus); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } };
  const excluir = () => setConf({ texto: `Tirar ${o.nome} da viagem?`, sim: async () => { try { await apiService.delete(`/turismo/onibus/${o.id}`); onSalvo(null); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } } });
  const campo = (k, l) => <div style={{ flex: "1 1 150px" }}><span style={lab}>{l}</span><input value={d[k] || ""} onChange={(e) => setD({ ...d, [k]: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>;
  return <Modal C={C} s={s} titulo={o.id ? `✎ ${o.nome}` : "＋ Ônibus na viagem"} onFechar={onFechar} largura={600}>
    <div><span style={lab}>MAPA DE POLTRONAS</span><select value={d.mapa_id || ""} onChange={(e) => setD({ ...d, mapa_id: e.target.value })} style={{ ...s.input, width: "100%" }}>
      {o.id && !o.mapa_id && <option value="">(mantém o atual)</option>}
      {(mapas?.mapas || []).length > 0 && <optgroup label="Mapas da empresa">{mapas.mapas.map((m) => <option key={m.id} value={m.id}>{m.nome} · {m.lugares} lugares</option>)}</optgroup>}
      <optgroup label="Modelos prontos">{(mapas?.modelos || []).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</optgroup></select>
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>O ônibus da viagem recebe uma cópia do mapa — mudar o modelo depois não mexe nas viagens já montadas.</div></div>
    {frota.length > 0 && <div><span style={lab}>DA FROTA (opcional)</span><select value={d.equipamento_id || ""} onChange={(e) => setD({ ...d, equipamento_id: e.target.value })} style={{ ...s.input, width: "100%" }}><option value="">— ônibus de terceiro / digitar placa —</option>{frota.map((e) => <option key={e.id} value={e.id}>{e.tag || e.nome} · {e.placa}</option>)}</select></div>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{campo("nome", "NOME NA VIAGEM (ex.: Ônibus 1)")}{!d.equipamento_id && campo("placa", "PLACA")}{campo("empresa", "EMPRESA DO ÔNIBUS")}</div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><div style={{ flex: "2 1 220px" }}><span style={lab}>MOTORISTA</span><CampoFuncionario C={C} s={s} lista={pessoas} nome={d.motorista_nome} id={d.motorista_colaborador_id} placeholder="Digite o nome do motorista…" onChange={(v) => setD({ ...d, motorista_nome: v.nome, motorista_colaborador_id: v.id })} /></div>{campo("motorista_telefone", "TELEFONE DO MOTORISTA")}</div>
    {msg && <div style={{ color: C.warn, fontSize: 13 }}>{msg}</div>}
    <div style={{ display: "flex", gap: 8 }}>{o.id && <button type="button" onClick={excluir} style={{ ...s.btn(false), cursor: "pointer" }}>Tirar da viagem</button>}<span style={{ flex: 1 }} /><button type="button" onClick={onFechar} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button><button type="button" onClick={salvar} style={{ ...s.btn(true), cursor: "pointer" }}>Salvar</button></div>
  </Modal>;
}

function Importar({ C, s, D, onFechar, onFeito }) {
  const [texto, setTexto] = useState(""); const [msg, setMsg] = useState(""); const [enviando, setEnviando] = useState(false); const [origem, setOrigem] = useState("");
  const P = useMemo(() => lerPlanilha(texto), [texto]);
  const arquivo = (e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setTexto(String(r.result || "")); r.readAsText(f, "utf-8"); };
  const enviar = async () => { setMsg(""); setEnviando(true); try { const r = await apiService.post(`/turismo/viagens/${D.viagem.id}/importar`, { linhas: P.linhas, origem_venda: origem }); onFeito(`✔ ${r.importados} passageiro(s) importados em ${r.reservas} reserva(s).`); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } finally { setEnviando(false); } };
  return <Modal C={C} s={s} titulo="📥 Importar planilha de passageiros" onFechar={onFechar} largura={760}>
    <div style={{ fontSize: 12.5, color: C.textSub }}>Copie as linhas do Excel/Google Planilhas e cole aqui (ou escolha um CSV). Colunas reconhecidas pelo cabeçalho: <b>nome</b>, documento, nascimento, telefone, poltrona, <b>grupo/responsável</b> (mesmo valor = mesma reserva), ônibus{D.onibus.length > 1 ? " (nome, nº ou placa — obrigatório com poltrona)" : ""}, emergência, obs. Sem cabeçalho, a ordem é: nome, documento, nascimento, telefone, poltrona, grupo, ônibus.</div>
    <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={7} placeholder={"nome\tdocumento\tnascimento\ttelefone\tpoltrona\tgrupo\nMaria Souza\t12.345.678-9\t10/04/1980\t(11) 9…\t5\tFamília Souza"} style={{ ...s.input, width: "100%", fontFamily: "monospace", fontSize: 12 }} />
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><input type="file" accept=".csv,.txt,.tsv" onChange={arquivo} style={{ fontSize: 12 }} /><input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Vendido por (opcional, p/ todas)" style={{ ...s.input, flex: "1 1 200px" }} /></div>
    {P.linhas.length > 0 && <div style={{ overflowX: "auto" }}><div style={{ fontSize: 12.5, marginBottom: 4 }}>{P.linhas.length} passageiro(s) · colunas: {P.mapa.join(", ")}{!P.cabecalho && " (sem cabeçalho)"}</div>
      <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}><thead><tr>{P.mapa.map((k) => <th key={k} style={{ textAlign: "left", borderBottom: `1px solid ${C.border}`, padding: 3 }}>{k}</th>)}</tr></thead>
        <tbody>{P.linhas.slice(0, 8).map((l, i) => <tr key={i}>{P.mapa.map((k) => <td key={k} style={{ padding: 3, borderBottom: `1px solid ${C.border}` }}>{l[k] || ""}</td>)}</tr>)}</tbody></table>{P.linhas.length > 8 && <div style={{ fontSize: 11.5, color: C.muted }}>… e mais {P.linhas.length - 8}</div>}</div>}
    <div style={{ fontSize: 11.5, color: C.muted }}>Se alguma poltrona já estiver ocupada ou não existir, nada é importado e o sistema diz qual linha corrigir.</div>
    {msg && <div style={{ color: C.warn, fontSize: 13 }}>{msg}</div>}
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={onFechar} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button><button type="button" disabled={!P.linhas.length || enviando} onClick={enviar} style={{ ...s.btn(true), cursor: "pointer" }}>{enviando ? "Importando…" : `Importar ${P.linhas.length || ""}`}</button></div>
  </Modal>;
}

// ─── mapas de poltronas (modelos + editor) ──────────────────────────────────
const CICLO = ["p", "c", "x", "porta", "escada", "wc", "gel", "mot", "mesa"];
const NOME_CEL = { p: "Poltrona", c: "Corredor", x: "Vazio", porta: "Porta", escada: "Escada", wc: "Banheiro", gel: "Geladeira", mot: "Motorista", mesa: "Mesa" };
function Mapas({ C, s }) {
  const [D, setD] = useState(null); const [ed, setEd] = useState(null); const [msg, setMsg] = useState(""); const [ver, setVer] = useState(null);
  const carregar = () => apiService.get("/turismo/mapas").then(setD).catch((e) => setMsg(`⚠ ${erroDe(e)}`));
  useEffect(() => { carregar(); }, []);
  if (ed) return <EditorMapa C={C} s={s} m={ed} onFechar={() => setEd(null)} onSalvo={() => { setEd(null); setMsg("✔ Mapa salvo."); carregar(); }} />;
  if (!D) return <div style={{ color: msg ? C.warn : C.textSub }}>{msg || "Carregando…"}</div>;
  const card = (m, pronto) => <div key={m.id} style={{ ...s.card, padding: "12px 14px", display: "grid", gap: 6 }}>
    <b>{m.nome}</b><div style={{ fontSize: 12.5, color: C.textSub }}>{m.tipo || "—"} · {m.lugares} lugares · {(m.layout?.pisos || []).length} piso(s)</div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button type="button" onClick={() => setVer(m)} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 10px" }}>Ver</button>
      {pronto ? <button type="button" onClick={() => setEd({ nome: `${m.nome} (meu)`, tipo: m.tipo, layout: JSON.parse(JSON.stringify(m.layout)) })} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 10px" }}>Usar como base</button>
        : <button type="button" onClick={() => setEd(m)} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 10px" }}>✎ Editar</button>}</div>
  </div>;
  return <div style={{ display: "grid", gap: 12 }}>
    {msg && <div style={{ fontSize: 13, color: msg.startsWith("⚠") ? C.warn : C.ok || "#4caf50" }}>{msg}</div>}
    <div style={{ fontSize: 13, color: C.textSub }}>Cadastre o mapa de cada modelo de ônibus que a empresa usa (os seus e os dos parceiros). Comece de um modelo pronto e ajuste: numeração, banheiro, escada, porta…</div>
    <b>Mapas da empresa</b>
    {D.mapas.length ? <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>{D.mapas.map((m) => card(m, false))}</div> : <div style={{ fontSize: 12.5, color: C.textSub }}>Nenhum ainda — use um modelo pronto como base.</div>}
    <b>Modelos prontos</b>
    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>{D.modelos.map((m) => card(m, true))}</div>
    {ver && <Modal C={C} s={s} titulo={ver.nome} onFechar={() => setVer(null)} largura={760}><div style={{ overflowX: "auto" }}><MapaPoltronas C={C} layout={ver.layout} /></div><button type="button" onClick={() => setVer(null)} style={{ ...s.btn(false), cursor: "pointer", justifySelf: "end" }}>Fechar</button></Modal>}
  </div>;
}

function EditorMapa({ C, s, m, onFechar, onSalvo }) {
  const [d, setD] = useState(() => ({ ...m, layout: JSON.parse(JSON.stringify(m.layout)) })); const [pincel, setPincel] = useState("p"); const [msg, setMsg] = useState(""); const [piso, setPiso] = useState(0);
  const lab = { fontSize: 11.5, color: C.textSub, display: "block", marginBottom: 3 };
  const mudar = (fn) => { const ly = JSON.parse(JSON.stringify(d.layout)); fn(ly); setD({ ...d, layout: ly }); };
  const proximo = () => { const ns = []; for (const p of d.layout.pisos) for (const l of p.linhas) for (const c of l) if (c.t === "p") ns.push(parseInt(c.n, 10) || 0); return String((ns.length ? Math.max(...ns) : 0) + 1); };
  const clique = (c, pt) => mudar((ly) => { const cel = ly.pisos[pt.pi].linhas[pt.li]; if (pincel === "p") { if (c.t === "p") cel[pt.ci] = { t: "x" }; else cel[pt.ci] = { t: "p", n: proximo() }; } else cel[pt.ci] = { t: pincel }; });
  const renumerar = () => mudar((ly) => { let n = 1; for (const p of ly.pisos) for (const l of p.linhas) { const esq = []; const dir = []; let lado = esq; for (const c of l) { if (c.t === "c") lado = dir; else if (c.t === "p") lado.push(c); } for (const c of [...esq, ...dir.reverse()]) c.n = String(n++); } });
  const P2 = d.layout.pisos[piso] || d.layout.pisos[0];
  const salvar = async () => { setMsg(""); try { if (m.id) await apiService.put(`/turismo/mapas/${m.id}`, d); else await apiService.post("/turismo/mapas", d); onSalvo(); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } };
  const nPol = d.layout.pisos.reduce((t, p) => t + p.linhas.reduce((u, l) => u + l.filter((c) => c.t === "p").length, 0), 0);
  return <div style={{ display: "grid", gap: 12 }}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      <button type="button" onClick={onFechar} style={{ ...s.btn(false), cursor: "pointer" }}>← Mapas</button>
      <div style={{ flex: "2 1 240px" }}><span style={lab}>NOME DO MAPA</span><input value={d.nome || ""} onChange={(e) => setD({ ...d, nome: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>
      <div style={{ flex: "1 1 160px" }}><span style={lab}>TIPO</span><input value={d.tipo || ""} onChange={(e) => setD({ ...d, tipo: e.target.value })} placeholder="Double deck, micro…" style={{ ...s.input, width: "100%" }} /></div>
      <b style={{ alignSelf: "center" }}>{nPol} poltronas</b>
      <button type="button" onClick={salvar} style={{ ...s.btn(true), cursor: "pointer" }}>Salvar mapa</button>
    </div>
    {msg && <div style={{ color: C.warn, fontSize: 13 }}>{msg}</div>}
    <div style={{ ...s.card, padding: 12, display: "grid", gap: 8 }}>
      <div style={{ fontSize: 12.5, color: C.textSub }}>Escolha o que colocar e toque nas casas. Com “Poltrona”, tocar numa poltrona a apaga; tocar numa casa vazia cria com o próximo número. “Renumerar” numera fileira a fileira (janela → corredor → janela).</div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{CICLO.map((k) => <button key={k} type="button" onClick={() => setPincel(k)} style={{ ...s.btn(pincel === k), cursor: "pointer", padding: "4px 9px", fontSize: 12 }}>{NOME_CEL[k]}</button>)}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {d.layout.pisos.length > 1 && d.layout.pisos.map((p, i) => <button key={i} type="button" onClick={() => setPiso(i)} style={{ ...s.btn(piso === i), cursor: "pointer", padding: "4px 9px", fontSize: 12 }}>{p.nome}</button>)}
        <button type="button" onClick={() => mudar((ly) => { const lin = ly.pisos[piso].linhas; lin.push((lin[lin.length - 1] || [{ t: "x" }]).map((c) => (c.t === "p" ? { t: "x" } : { t: c.t === "c" ? "c" : "x" }))); })} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 9px", fontSize: 12 }}>＋ Fileira</button>
        <button type="button" onClick={() => mudar((ly) => { if (ly.pisos[piso].linhas.length > 1) ly.pisos[piso].linhas.pop(); })} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 9px", fontSize: 12 }}>− Fileira</button>
        <button type="button" onClick={() => mudar((ly) => ly.pisos[piso].linhas.forEach((l) => l.push({ t: "x" })))} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 9px", fontSize: 12 }}>＋ Coluna</button>
        <button type="button" onClick={() => mudar((ly) => ly.pisos[piso].linhas.forEach((l) => { if (l.length > 1) l.pop(); }))} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 9px", fontSize: 12 }}>− Coluna</button>
        {d.layout.pisos.length < 2 && <button type="button" onClick={() => mudar((ly) => { ly.pisos[0].nome = "Piso inferior"; ly.pisos.unshift({ nome: "Piso superior", linhas: [[{ t: "x" }, { t: "x" }, { t: "c" }, { t: "x" }, { t: "x" }]] }); })} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 9px", fontSize: 12 }}>＋ 2º piso</button>}
        <button type="button" onClick={renumerar} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 9px", fontSize: 12 }}>🔢 Renumerar</button>
      </div>
      <div style={{ overflowX: "auto" }}><MapaPoltronas C={C} editor layout={{ pisos: [P2] }} onClique={(c, pt) => clique(c, { ...pt, pi: piso })} /></div>
    </div>
  </div>;
}
