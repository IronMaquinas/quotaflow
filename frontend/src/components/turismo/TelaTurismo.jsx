// components/turismo/TelaTurismo.jsx — etapa T1: 🚌 VIAGENS E EMBARQUE
//   Abas: Viagens (lista → viagem: ônibus, mapa de poltronas, reservas individuais/grupo, importar planilha, lista A4) | Mapas de poltronas (modelos + editor)
import { useEffect, useMemo, useState } from "react";
import apiService from "../../services/apiService";
import CampoFuncionario from "../shared/CampoFuncionario";
import MapaPoltronas, { Legenda } from "./MapaPoltronas";
import { abrirListaPassageiros, lerPlanilha } from "../../utils/listaPassageiros";
import { carregarLogoEmpresa } from "../../utils/logoEmpresa";
import { Toggle } from "../../plataforma/ModulosPlataforma";
import { SeletorLocal } from "../fotoCartao/MapaFotos";

const erroDe = (e) => e?.response?.data?.erro || e.message;
const STATUS = { planejada: "📋 Planejada", em_andamento: "🚌 Em andamento", concluida: "✅ Concluída", cancelada: "✖ Cancelada" };
const loc = (v) => (v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const inputDT = (v) => { if (!v) return ""; const d = new Date(v); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const PASS_VAZIO = { nome: "", documento: "", nascimento: "", telefone: "", emergencia_nome: "", emergencia_telefone: "", obs: "", assistencia: false, plano_saude: false, plano_saude_nome: "", plano_saude_numero: "", seguro_viagem: false, seguro_nome: "", seguro_apolice: "", tipo_sanguineo: "", embarque_parada_id: null };
const SANGUE = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const PAG = { pago: "✅ Pago", parcial: "◐ Parcial", embarque: "🚌 Paga no embarque", pendente: "⏳ Pendente" };
const reais = (v) => (v == null || v === "" ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const pontosEmbarque = (v) => (v?.embarques_diferentes ? (v.paradas || []).filter((p) => p.embarque) : []);
const nomeEmbarque = (v, id) => (id ? (v?.paradas || []).find((p) => String(p.id) === String(id))?.nome || "parada" : v?.origem || "saída");

function Modal({ C, s, titulo, onFechar, children, largura = 520 }) {
  return <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, padding: "16px 18px", width: `min(${largura}px, 100%)`, maxHeight: "92vh", overflowY: "auto", display: "grid", gap: 10, color: C.text }}>
      <b style={{ fontSize: 15 }}>{titulo}</b>{children}
    </div></div>;
}
function Quadro({ C, s, embutido, titulo, onFechar, largura, children }) { // T1.2: mesmo formulário em janela ou dentro da aba
  if (!embutido) return <Modal C={C} s={s} titulo={titulo} onFechar={onFechar} largura={largura}>{children}</Modal>;
  return <div style={{ ...s.card, padding: "14px 16px", display: "grid", gap: 10, color: C.text, alignContent: "start" }}>{titulo && <b style={{ fontSize: 15 }}>{titulo}</b>}{children}</div>;
}
function Confirmar({ C, s, texto, onSim, onNao }) {
  return <Modal C={C} s={s} titulo="Confirmar" onFechar={onNao} largura={400}><div style={{ fontSize: 13.5 }}>{texto}</div>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={onNao} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button><button type="button" onClick={onSim} style={{ ...s.btn(true), cursor: "pointer" }}>Confirmar</button></div></Modal>;
}

export default function TelaTurismo({ C, s }) {
  const [aba, setAba] = useState("viagens"); const [aberta, setAberta] = useState(null);
  useEffect(() => { carregarLogoEmpresa().catch(() => {}); }, []);
  return <div style={{ padding: "18px clamp(12px, 2.5vw, 28px)", display: "grid", gap: 14, color: C.text }}>
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", paddingRight: 48 }}>{/* T1.1: espaço do sino de notificações */}
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
      <button type="button" onClick={() => setNova({ nome: "", origem: "", destino: "", saida_em: "", retorno_em: "", obs: "", paradas: [], veiculos: [] })} style={{ ...s.btn(true), cursor: "pointer" }}>＋ Nova viagem</button>
      <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} style={s.input}><option value="ativas">Planejadas e em andamento</option><option value="concluida">Concluídas</option><option value="cancelada">Canceladas</option><option value="">Todas</option></select>
      <input value={f.busca} onChange={(e) => setF({ ...f, busca: e.target.value })} placeholder="🔎 Buscar viagem, origem, destino…" style={{ ...s.input, flex: "1 1 200px" }} />
    </div>
    {msg && <div style={{ color: C.warn, fontSize: 13 }}>{msg}</div>}
    {!l ? <div style={{ color: C.textSub }}>Carregando…</div> : !l.length ? <div style={{ ...s.card, padding: 18, color: C.textSub }}>Nenhuma viagem aqui. Crie a primeira: viagem = evento (show, excursão, romaria…) com um ou vários ônibus.</div> :
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {l.map((v) => { const pct = v.lugares ? Math.round((v.passageiros / v.lugares) * 100) : 0;
          return <div key={v.id} onClick={() => onAbrir(v.id)} style={{ ...s.card, padding: "12px 14px", cursor: "pointer", display: "grid", gap: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{v.nome}</b><span style={{ fontSize: 11.5, color: C.textSub }}>{v.numero}</span></div>
            <div style={{ fontSize: 12.5, color: C.textSub }}>{v.origem || "—"} → {v.destino || "—"} · saída {loc(v.saida_em)}</div>
            <div style={{ fontSize: 12.5 }}>{STATUS[v.status]} · {v.onibus} veículo(s) · <b>{v.passageiros}</b>/{v.lugares} lugares{v.pessoas_previstas ? ` · ${v.pessoas_previstas} esperadas` : ""}</div>
            {v.pendencias > 0 && <div style={{ fontSize: 12, color: C.warn }}>🟡 {v.pendencias} pendência(s) de veículo/motorista</div>}
            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,.08)" }}><div style={{ width: `${Math.min(pct, 100)}%`, height: 6, borderRadius: 3, background: pct >= 100 ? "#a3402e" : "#1f6f43" }} /></div>
          </div>; })}
      </div>}
    {nova && <FormViagem C={C} s={s} v={nova} onFechar={() => setNova(null)} onSalvo={(v) => { setNova(null); onAbrir(v.id); }} />}
  </>;
}

// T1.1: origem/destino/paradas — nome + busca no mapa (lugar real) com pino ajustável
function CampoLocal({ C, s, rotulo, valor, onChange, placeholder }) {
  const [mapa, setMapa] = useState(false); const lab = { fontSize: 11.5, color: C.textSub, display: "block", marginBottom: 3 };
  const temPonto = valor.lat != null && valor.lat !== "";
  return <div style={{ display: "grid", gap: 5 }}>
    {rotulo && <span style={lab}>{rotulo}</span>}
    <div style={{ display: "flex", gap: 6 }}>
      <input value={valor.nome || ""} onChange={(e) => onChange({ ...valor, nome: e.target.value })} placeholder={placeholder} style={{ ...s.input, flex: 1, minWidth: 0 }} />
      <button type="button" onClick={() => setMapa(!mapa)} title="Achar o lugar no mapa" style={{ ...s.btn(mapa), cursor: "pointer", padding: "6px 10px", whiteSpace: "nowrap" }}>{temPonto ? "📍 no mapa ✔" : "📍 Mapa"}</button>
    </div>
    {mapa && <SeletorLocal C={C} s={s} rota="/turismo/geocode" altura={200} textoVazio="Busque a cidade/endereço ou toque no mapa." valor={{ local: valor.nome, lat: valor.lat ?? "", lng: valor.lng ?? "" }}
      onChange={(x) => onChange({ ...valor, lat: x.lat, lng: x.lng, ...(x.local && !valor.nome ? { nome: x.local } : {}) })} />}
  </div>;
}

function Opcao({ C, ligado, onChange, titulo, texto }) {
  return <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}><Toggle C={C} ligado={ligado} rotulo={titulo} onChange={onChange} />
    <div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{titulo}</div><div style={{ fontSize: 11.5, color: C.textSub }}>{texto}</div></div></div>;
}

function FormViagem({ C, s, v, onFechar, onSalvo, embutido = false }) {
  const novo = !v.id;
  const [d, setD] = useState({ ...v, saida_em: inputDT(v.saida_em), retorno_em: inputDT(v.retorno_em), pessoas_previstas: v.pessoas_previstas ?? "", valor_pessoa: v.valor_pessoa ?? "",
    paradas: (v.paradas || []).map((p) => ({ ...p, chegada: inputDT(p.chegada), minutos: p.minutos ?? "" })), veiculos: v.veiculos || [] });
  const [msg, setMsg] = useState(""); const [salvando, setSalvando] = useState(false); const [tipos, setTipos] = useState([]); const [sug, setSug] = useState(null);
  useEffect(() => { if (novo) apiService.get("/turismo/mapas").then((r) => setTipos([...(r.mapas || []).map((m) => ({ id: String(m.id), nome: m.nome, lugares: m.lugares })), ...(r.modelos || [])])).catch(() => {}); }, [novo]);
  const lab = { fontSize: 11.5, color: C.textSub, display: "block", marginBottom: 3 }; const sec = { fontSize: 12, fontWeight: 700, color: C.textSub, letterSpacing: .4, marginTop: 4 };
  const lugares = d.veiculos.reduce((t, x) => t + (tipos.find((m) => m.id === x.mapa_id)?.lugares || 0), 0); const prev = parseInt(d.pessoas_previstas, 10) || 0;
  const mudarSaida = (val) => setD((x) => ({ ...x, saida_em: val, retorno_em: x.retorno_em && val && x.retorno_em < val ? "" : x.retorno_em }));
  const sugerir = async () => { setSug(null); if (!prev) { setMsg("⚠ Informe quantas pessoas são esperadas."); return; } try { const r = await apiService.get(`/turismo/sugestao-veiculos?pessoas=${prev}`); setSug(r.opcoes); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } };
  const usarSugestao = (o) => { setD({ ...d, veiculos: o.veiculos.flatMap((x) => Array.from({ length: x.qtd }, () => ({ mapa_id: x.id }))) }); setSug(null); };
  const setPar = (i, p) => setD({ ...d, paradas: d.paradas.map((x, j) => (j === i ? p : x)) });
  const moverPar = (i, k) => { const l = [...d.paradas]; const [x] = l.splice(i, 1); l.splice(i + k, 0, x); setD({ ...d, paradas: l }); };
  const salvar = async () => { setMsg("");
    if (!d.nome?.trim()) return setMsg("⚠ Dê um nome à viagem."); if (!d.origem?.trim()) return setMsg("⚠ Informe a origem."); if (!d.destino?.trim()) return setMsg("⚠ Informe o destino."); if (!d.saida_em) return setMsg("⚠ Informe a saída.");
    setSalvando(true);
    try { const iso = (x) => (x ? new Date(x).toISOString() : null);
      const b = { ...d, saida_em: iso(d.saida_em), retorno_em: iso(d.retorno_em), paradas: d.paradas.map((p) => ({ ...p, chegada: iso(p.chegada) })) };
      const r = novo ? await apiService.post("/turismo/viagens", b) : await apiService.put(`/turismo/viagens/${v.id}`, b); onSalvo(r.viagem, r.aviso); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } finally { setSalvando(false); } };
  const campo = (k, l, t = "text", extra = {}) => <div style={{ flex: "1 1 200px" }}><span style={lab}>{l}</span><input type={t} value={d[k] ?? ""} onChange={(e) => setD({ ...d, [k]: e.target.value })} style={{ ...s.input, width: "100%" }} {...extra} /></div>;
  return <Quadro C={C} s={s} embutido={embutido} titulo={novo ? "＋ Nova viagem" : embutido ? "" : `✎ ${v.nome}`} onFechar={onFechar} largura={820}>
    {campo("nome", "NOME DA VIAGEM / PASSEIO")}
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 300px" }}><CampoLocal C={C} s={s} rotulo="ORIGEM (saída / embarque)" placeholder="Cidade ou local de embarque" valor={{ nome: d.origem, lat: d.origem_lat, lng: d.origem_lng }} onChange={(x) => setD((y) => ({ ...y, origem: x.nome, origem_lat: x.lat, origem_lng: x.lng }))} /></div>
      <div style={{ flex: "1 1 300px" }}><CampoLocal C={C} s={s} rotulo="DESTINO" placeholder="Cidade ou local de destino" valor={{ nome: d.destino, lat: d.destino_lat, lng: d.destino_lng }} onChange={(x) => setD((y) => ({ ...y, destino: x.nome, destino_lat: x.lat, destino_lng: x.lng }))} /></div>
    </div>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 200px" }}><span style={lab}>SAÍDA</span><input type="datetime-local" value={d.saida_em} onChange={(e) => mudarSaida(e.target.value)} style={{ ...s.input, width: "100%" }} /></div>
      <div style={{ flex: "1 1 200px" }}><span style={lab}>RETORNO</span><input type="datetime-local" value={d.retorno_em} min={d.saida_em || undefined} disabled={!d.saida_em} onChange={(e) => setD({ ...d, retorno_em: d.saida_em && e.target.value && e.target.value < d.saida_em ? d.saida_em : e.target.value })} style={{ ...s.input, width: "100%" }} title={d.saida_em ? "" : "Escolha a saída primeiro"} /></div>
      <div style={{ flex: "0 1 170px" }}><span style={lab}>PESSOAS ESPERADAS</span><input type="number" min="1" value={d.pessoas_previstas} onChange={(e) => { setD({ ...d, pessoas_previstas: e.target.value }); setSug(null); }} placeholder="se já souber" style={{ ...s.input, width: "100%" }} /></div>
    </div>

    {novo && <><div style={sec}>VEÍCULOS</div>
      <div style={{ fontSize: 11.5, color: C.muted }}>Só o tipo agora — placa e motorista podem ser definidos depois (o veículo fica 🟡 "a definir" e o mapa de poltronas já funciona para vender).</div>
      {d.veiculos.map((x, i) => <div key={i} style={{ display: "flex", gap: 6 }}><select value={x.mapa_id} onChange={(e) => setD({ ...d, veiculos: d.veiculos.map((y, j) => (j === i ? { mapa_id: e.target.value } : y)) })} style={{ ...s.input, flex: 1 }}>{tipos.map((m) => <option key={m.id} value={m.id}>{m.nome}{m.pronto ? "" : ` · ${m.lugares} lugares`}</option>)}</select>
        <button type="button" onClick={() => setD({ ...d, veiculos: d.veiculos.filter((_, j) => j !== i) })} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 10px" }}>✕</button></div>)}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => setD({ ...d, veiculos: [...d.veiculos, { mapa_id: tipos[0]?.id || "tpl:conv46" }] })} style={{ ...s.btn(false), cursor: "pointer" }}>＋ Veículo</button>
        <button type="button" onClick={sugerir} style={{ ...s.btn(false), cursor: "pointer" }}>✨ Sugerir pela quantidade de pessoas</button>
        {d.veiculos.length > 0 && <span style={{ fontSize: 12.5, color: prev > lugares ? C.warn : C.textSub }}>{d.veiculos.length} veículo(s) · {lugares} lugares{prev ? (prev > lugares ? ` · ⚠ faltam ${prev - lugares}` : ` · sobram ${lugares - prev}`) : ""}</span>}
      </div>
      {sug && (sug.length ? <div style={{ display: "grid", gap: 5 }}>{sug.map((o, i) => <button key={i} type="button" onClick={() => usarSugestao(o)} style={{ textAlign: "left", background: "transparent", border: `1px solid ${i === 0 ? "#3b82f6" : C.border}`, borderRadius: 8, padding: "7px 10px", color: C.text, cursor: "pointer", fontSize: 12.5 }}>
        {i === 0 ? "⭐ " : ""}{o.veiculos.map((x) => `${x.qtd} × ${x.nome}`).join(" + ")} <span style={{ color: C.textSub }}>· {o.lugares} lugares (sobram {o.sobra})</span></button>)}</div> : <div style={{ fontSize: 12.5, color: C.warn }}>Nenhum conjunto de até 6 veículos atende — cadastre um mapa maior ou divida a viagem.</div>)}
    </>}
    {!novo && <div style={{ fontSize: 11.5, color: C.muted }}>Veículos e motoristas: aba 🚌 Veículos e motoristas.</div>}

    <div style={sec}>ITINERÁRIO — PARADAS NO PERCURSO</div>
    {d.paradas.map((p, i) => <div key={p.id || i} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-start", flexWrap: "wrap" }}>
        <b style={{ fontSize: 12.5, paddingTop: 8 }}>{i + 1}.</b>
        <div style={{ flex: "2 1 260px" }}><CampoLocal C={C} s={s} placeholder="Parada (posto, restaurante, cidade…)" valor={{ nome: p.nome, lat: p.lat, lng: p.lng }} onChange={(x) => setPar(i, { ...p, nome: x.nome, lat: x.lat, lng: x.lng })} /></div>
        <div style={{ flex: "1 1 190px" }}><input type="datetime-local" value={p.chegada || ""} min={d.saida_em || undefined} max={d.retorno_em || undefined} onChange={(e) => setPar(i, { ...p, chegada: e.target.value })} title="Chegada prevista" style={{ ...s.input, width: "100%" }} /></div>
        <div style={{ flex: "0 1 110px" }}><input type="number" min="0" value={p.minutos} onChange={(e) => setPar(i, { ...p, minutos: e.target.value })} placeholder="min parado" title="Tempo parado (minutos)" style={{ ...s.input, width: "100%" }} /></div>
        <div style={{ display: "flex", gap: 3 }}><button type="button" disabled={i === 0} onClick={() => moverPar(i, -1)} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 8px" }}>↑</button><button type="button" disabled={i === d.paradas.length - 1} onClick={() => moverPar(i, 1)} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 8px" }}>↓</button><button type="button" onClick={() => setD({ ...d, paradas: d.paradas.filter((_, j) => j !== i) })} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 8px" }}>✕</button></div>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5 }}>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}><Toggle C={C} ligado={!!p.conferir} rotulo="Conferir passageiros" onChange={(x) => setPar(i, { ...p, conferir: x })} /> Conferir passageiros nesta parada</span>
        {d.embarques_diferentes && <span style={{ display: "flex", gap: 6, alignItems: "center" }}><Toggle C={C} ligado={!!p.embarque} rotulo="Ponto de embarque" onChange={(x) => setPar(i, { ...p, embarque: x })} /> Ponto de embarque</span>}
      </div>
    </div>)}
    <button type="button" onClick={() => setD({ ...d, paradas: [...d.paradas, { id: `p${Date.now().toString(36)}`, nome: "", chegada: "", minutos: "", conferir: true, embarque: false }] })} style={{ ...s.btn(false), cursor: "pointer", justifySelf: "start" }}>＋ Parada</button>

    <div style={sec}>OPÇÕES DA VIAGEM</div>
    <Opcao C={C} ligado={!!d.acompanhar_pagamentos} onChange={(x) => setD({ ...d, acompanhar_pagamentos: x })} titulo="💲 Acompanhar pagamentos" texto="Valor por pessoa e situação de cada reserva (pago, parcial, paga no embarque, pendente). Desligado, nada de dinheiro aparece." />
    {d.acompanhar_pagamentos && <div style={{ maxWidth: 220, marginLeft: 58 }}>{campo("valor_pessoa", "VALOR POR PESSOA (R$)", "number", { min: 0, step: "0.01" })}</div>}
    <Opcao C={C} ligado={!!d.embarques_diferentes} onChange={(x) => setD({ ...d, embarques_diferentes: x })} titulo="📍 Acompanhar diferentes embarques" texto="Passageiros podem subir em paradas do caminho. Marque as paradas que são ponto de embarque; cada passageiro ganha o toggle “Embarque diferente da saída”." />
    <Opcao C={C} ligado={!!d.foto_obrigatoria} onChange={(x) => setD({ ...d, foto_obrigatoria: x })} titulo="🪪 Foto obrigatória para o crachá" texto="Por segurança: o crachá virtual (com QR para o motorista conferir) só é gerado com a foto do passageiro." />
    {!novo && <div><span style={lab}>SITUAÇÃO</span><select value={d.status} onChange={(e) => setD({ ...d, status: e.target.value })} style={{ ...s.input, width: "100%" }}>{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>}
    <div><span style={lab}>OBSERVAÇÕES</span><textarea value={d.obs || ""} onChange={(e) => setD({ ...d, obs: e.target.value })} rows={2} style={{ ...s.input, width: "100%" }} /></div>
    {msg && <div style={{ color: C.warn, fontSize: 13 }}>{msg}</div>}
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>{!embutido && <button type="button" onClick={onFechar} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button>}<button type="button" disabled={salvando} onClick={salvar} style={{ ...s.btn(true), cursor: "pointer" }}>{salvando ? "Salvando…" : novo ? "Criar viagem" : "Salvar alterações"}</button></div>
  </Quadro>;
}

// ─── viagem aberta — T1.2: uma tela só, resumo fixo + abas Viagem · Passageiros · Veículos · Poltronas ─────────
const ABAS = [["viagem", "🧭 Viagem"], ["passageiros", "👥 Passageiros"], ["veiculos", "🚌 Veículos e motoristas"], ["poltronas", "💺 Poltronas"]];
function Viagem({ C, s, id, onVoltar }) {
  const [D, setD] = useState(null); const [msg, setMsg] = useState(""); const [busId, setBusId] = useState(null); const [modo, setModo] = useState("reservar");
  const [aba, setAba] = useState(() => { try { return localStorage.getItem("turismo_aba") || "viagem"; } catch { return "viagem"; } });
  const [sel, setSel] = useState([]); const [reserva, setReserva] = useState(null); const [pass, setPass] = useState(null); const [movendo, setMovendo] = useState(null);
  const [novoBus, setNovoBus] = useState(null); const [importar, setImportar] = useState(false); const [conf, setConf] = useState(null); const [mapas, setMapas] = useState(null); const [distribuindo, setDistribuindo] = useState(false);
  const irAba = (k) => { setAba(k); try { localStorage.setItem("turismo_aba", k); } catch { /* sem storage */ } };
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
  const abrirReserva = (n = null) => setReserva({ responsavel: "", telefone: "", email: "", origem_venda: "", situacao_pagamento: "pendente", valor: "", valor_pago: "", embarque_parada_id: null, obs: "",
    passageiros: (n ? Array.from({ length: n }, () => null) : sel.length ? sel : [null]).map((x) => ({ ...PASS_VAZIO, poltrona: x, onibus_id: x ? bus?.id : null, menor_de: null })) });
  const distribuir = async () => { setDistribuindo(true); try { const r = await apiService.post(`/turismo/viagens/${id}/distribuir`, {}); avisar(r.sem_lugar.length ? `⚠ ${r.distribuidos} acomodado(s); sem lugar: ${r.sem_lugar.join(", ")}` : `⚡ ${r.distribuidos} passageiro(s) acomodado(s).`); carregar(); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } finally { setDistribuindo(false); } };
  if (!D) return <div style={{ color: msg ? C.warn : C.textSub }}>{msg || "Carregando…"}</div>;
  const v = D.viagem; const pendBus = D.pendencias.veiculo + D.pendencias.motorista;
  const selo = { viagem: 0, passageiros: D.incompletos, veiculos: pendBus, poltronas: D.sem_poltrona };
  return <div style={{ display: "grid", gap: 12 }}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button type="button" onClick={onVoltar} style={{ ...s.btn(false), cursor: "pointer" }}>← Viagens</button>
      <span style={{ flex: 1 }} />
      <button type="button" onClick={() => { if (!abrirListaPassageiros(D)) setMsg("⚠ Libere pop-ups para abrir a lista."); }} style={{ ...s.btn(false), cursor: "pointer" }}>🖨 Lista de passageiros</button>
    </div>
    <div onClick={() => irAba("viagem")} title="Abrir os dados da viagem" style={{ ...s.card, padding: "12px 14px", display: "grid", gap: 6, cursor: "pointer" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}><b style={{ fontSize: 17 }}>{v.nome}</b><span style={{ fontSize: 12, color: C.textSub }}>{v.numero} · {STATUS[v.status]}</span></div>
      <div style={{ fontSize: 13 }}>📍 {v.origem || v.local_saida || "—"} → {v.destino || "—"} · 🕒 ida {loc(v.saida_em)} · volta {loc(v.retorno_em)}</div>
      <div style={{ fontSize: 12.5, color: C.textSub }}>{D.passageiros.length} passageiro(s) · {D.onibus.length} veículo(s) · {D.lugares} lugares{v.pessoas_previstas ? ` · ${v.pessoas_previstas} esperadas` : ""}
        {D.faltam_lugares > 0 && <span style={{ color: C.warn }}> · ⚠ faltam {D.faltam_lugares} lugares para as pessoas esperadas</span>}
        {D.pagamentos && <> · 💲 recebido {reais(D.pagamentos.recebido)} de {reais(D.pagamentos.total)} · a receber <b style={{ color: D.pagamentos.a_receber > 0 ? C.warn : C.text }}>{reais(D.pagamentos.a_receber)}</b></>}</div>
    </div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
      {ABAS.map(([k, l]) => <button key={k} type="button" onClick={() => irAba(k)} style={{ ...s.btn(aba === k), cursor: "pointer" }}>{l}{selo[k] > 0 && <span style={{ marginLeft: 6, background: "#b7791f", color: "#fff", borderRadius: 9, padding: "0 6px", fontSize: 11 }}>{selo[k]}</span>}</button>)}
    </div>
    {msg && <div style={{ fontSize: 13, color: msg.startsWith("⚠") ? C.warn : C.ok || "#4caf50" }}>{msg}</div>}

    {aba === "viagem" && <FormViagem key={v.atualizado_em} C={C} s={s} v={v} embutido onSalvo={(_, aviso) => { avisar(aviso || "✔ Viagem salva."); carregar(); }} />}

    {aba === "passageiros" && <AbaPassageiros C={C} s={s} D={D} onPass={setPass} onNova={abrirReserva} onImportar={() => setImportar(true)} onMudou={carregar} setConf={setConf} setMsg={setMsg} />}

    {aba === "veiculos" && <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 12.5, color: C.textSub }}>Cada veículo nasce pelo tipo; placa e motoristas podem ficar 🟡 a definir. Trocar o tipo é bloqueado se o mapa novo não tiver as poltronas já ocupadas.</div>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 460px), 1fr))" }}>
        {D.onibus.map((o) => <FormOnibus key={`${o.id}-${o.atualizado_em}`} embutido C={C} s={s} viagem={v} viagemId={v.id} o={{ ...o, mapa_id: o.mapa_id || "" }} mapas={mapas} onSalvo={() => { avisar("✔ Veículo salvo."); carregar(); }} setConf={setConf} />)}
        {novoBus && <FormOnibus embutido C={C} s={s} viagem={v} viagemId={v.id} o={novoBus} mapas={mapas} onFechar={() => setNovoBus(null)} onSalvo={(o) => { setNovoBus(null); if (o) setBusId(o.id); avisar("✔ Veículo incluído."); carregar(); }} setConf={setConf} />}
      </div>
      {!novoBus && <button type="button" onClick={() => setNovoBus({ mapa_id: mapas?.mapas?.[0]?.id || "tpl:conv46", nome: "", placa: "", empresa: "", motoristas: [], equipamento_id: "" })} style={{ ...s.btn(true), cursor: "pointer", justifySelf: "start" }}>＋ Veículo</button>}
    </div>}

    {aba === "poltronas" && <>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {D.onibus.map((o) => <button key={o.id} type="button" onClick={() => { setBusId(o.id); setSel([]); }} style={{ ...s.btn(String(o.id) === String(busId)), cursor: "pointer" }}>🚌 {o.nome}{o.placa ? ` · ${o.placa}` : ""} <span style={{ opacity: .75 }}>({o.ocupados}/{o.lugares})</span></button>)}
        {D.sem_poltrona > 0 && D.onibus.length > 0 && <button type="button" disabled={distribuindo} onClick={() => setConf({ texto: `Acomodar automaticamente os ${D.sem_poltrona} passageiro(s) sem poltrona? Famílias ficam lado a lado, menores com o responsável e quem precisa de assistência na frente. Quem já tem poltrona não muda.`, sim: distribuir })} style={{ ...s.btn(true), cursor: "pointer" }}>{distribuindo ? "Acomodando…" : `⚡ Distribuir ${D.sem_poltrona} sem poltrona`}</button>}
      </div>
      {!bus ? <div style={{ ...s.card, padding: 18, color: C.textSub }}>Inclua o primeiro veículo na aba <a onClick={() => irAba("veiculos")} style={{ color: "#7fb2ff", cursor: "pointer" }}>🚌 Veículos e motoristas</a>.</div> :
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ ...s.card, padding: 14, display: "grid", gap: 10, flex: "0 1 auto", overflowX: "auto", maxWidth: "100%" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {[["reservar", "🎟 Reservar"], ["bloquear", "🚫 Bloquear"]].map(([k, l]) => <button key={k} type="button" onClick={() => { setModo(k); setSel([]); setMovendo(null); }} style={{ ...s.btn(modo === k), cursor: "pointer", padding: "5px 10px" }}>{l}</button>)}
            </div>
            <div style={{ fontSize: 12, color: C.textSub }}>{bus.tipo_nome || "—"} · {bus.falta_veiculo ? <span style={{ color: C.warn }}>veículo a definir</span> : `${bus.placa || "—"}${bus.empresa ? ` · ${bus.empresa}` : ""}`} · {bus.falta_motorista ? <span style={{ color: C.warn }}>sem motorista</span> : `motorista(s): ${bus.motoristas.map((m) => m.nome).join(", ")}`} · {bus.livres} livre(s)</div>
            {movendo && <div style={{ fontSize: 12.5, color: "#7fb2ff" }}>🔁 Toque na poltrona de destino de <b>{movendo.nome}</b> (ocupada = troca). Toque nele de novo para cancelar.</div>}
            {modo === "bloquear" && <div style={{ fontSize: 12.5, color: C.textSub }}>Toque para bloquear/liberar (guia, poltrona quebrada, reservada à empresa…).</div>}
            <MapaPoltronas C={C} layout={bus.layout} passageiros={doBus} bloqueadas={bus.bloqueadas || []} selecionadas={movendo ? [movendo.poltrona] : sel} onClique={clique} onSoltar={(pid, n) => mover(pid, n)} />
            <Legenda C={C} /><div style={{ fontSize: 11.5, color: C.muted }}>Dica: arraste um passageiro para outra poltrona (no computador).</div>
          </div>
          <div style={{ flex: "1 1 280px", display: "grid", gap: 10 }}>
            {D.sem_poltrona > 0 && <div style={{ ...s.card, padding: 12 }}><b style={{ fontSize: 13 }}>Sem poltrona ({D.sem_poltrona})</b><div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>{D.passageiros.filter((p) => !p.poltrona).map((p) => <button key={p.id} type="button" onClick={() => setMovendo(movendo?.id === p.id ? null : p)} draggable onDragStart={(ev) => ev.dataTransfer.setData("text/plain", String(p.id))} style={{ ...s.btn(movendo?.id === p.id), cursor: "pointer", padding: "4px 10px" }}>{p.assistencia ? "♿ " : ""}{p.nome}</button>)}</div><div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>Toque no nome e depois na poltrona (ou arraste) — ou use ⚡ Distribuir.</div></div>}
            {modo === "reservar" && <div style={{ ...s.card, padding: 14, display: "grid", gap: 8 }}>
              <b>🎟 Nova reserva neste ônibus</b>
              <div style={{ fontSize: 12.5, color: C.textSub }}>{sel.length ? <>Poltronas: <b style={{ color: C.text }}>{sel.join(", ")}</b></> : "Toque nas poltronas livres — ou peça lugares lado a lado:"}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{[1, 2, 3, 4, 5, 6].map((n) => <button key={n} type="button" onClick={() => sugerir(n)} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 10px" }}>{n}</button>)}<span style={{ fontSize: 11.5, color: C.muted, alignSelf: "center" }}>juntos</span></div>
              <div style={{ display: "flex", gap: 8 }}><button type="button" disabled={!sel.length} onClick={() => abrirReserva()} style={{ ...s.btn(true), cursor: "pointer" }}>{sel.length > 1 ? `Reservar ${sel.length} (grupo/família)` : "Reservar"}</button>{sel.length > 0 && <button type="button" onClick={() => setSel([])} style={{ ...s.btn(false), cursor: "pointer" }}>Limpar</button>}</div>
            </div>}
          </div>
        </div>}
    </>}

    {reserva && <FormReserva C={C} s={s} viagem={v} viagemId={v.id} r={reserva} onFechar={() => setReserva(null)} onSalvo={(t) => { setReserva(null); setSel([]); avisar(t); carregar(); }} />}
    {pass && <FormPassageiro C={C} s={s} viagem={v} p={pass} onFechar={() => setPass(null)} onMover={() => { setMovendo(pass); setPass(null); setModo("reservar"); setSel([]); if (pass.onibus_id) setBusId(pass.onibus_id); irAba("poltronas"); }} onSalvo={(t) => { setPass(null); avisar(t); carregar(); }} setConf={setConf} />}
    {importar && <Importar C={C} s={s} D={D} onFechar={() => setImportar(false)} onFeito={(t) => { setImportar(false); avisar(t); carregar(); }} />}
    {conf && <Confirmar C={C} s={s} texto={conf.texto} onNao={() => setConf(null)} onSim={async () => { const f = conf.sim; setConf(null); await f(); }} />}
  </div>;
}

// aba Passageiros: lista de todos (com ou sem poltrona) + filtros, e as reservas ao lado
function AbaPassageiros({ C, s, D, onPass, onNova, onImportar, onMudou, setConf, setMsg }) {
  const [f, setF] = useState(""); const [busca, setBusca] = useState(""); const v = D.viagem;
  const busNome = (id) => D.onibus.find((o) => String(o.id) === String(id))?.nome || "";
  const FILTROS = [["", "Todos", D.passageiros.length], ["falta", "⚠ Falta dado", D.incompletos], ["sem", "Sem poltrona", D.sem_poltrona], ["menor", "Menores", D.passageiros.filter((p) => p.menor).length], ["assist", "♿ Assistência", D.passageiros.filter((p) => p.assistencia).length]];
  const t = busca.trim().toLowerCase();
  const l = D.passageiros.filter((p) => (!f || (f === "falta" && p.incompleto) || (f === "sem" && !p.poltrona) || (f === "menor" && p.menor) || (f === "assist" && p.assistencia)) && (!t || [p.nome, p.documento, p.telefone, p.reserva_codigo].some((x) => String(x || "").toLowerCase().includes(t))))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  const td = { padding: "6px 8px", borderBottom: `1px solid ${C.border}`, fontSize: 12.5, verticalAlign: "top", color: C.text };
  return <div style={{ display: "grid", gap: 10 }}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button type="button" onClick={() => onNova(1)} style={{ ...s.btn(true), cursor: "pointer" }}>＋ Passageiro</button>
      <button type="button" onClick={() => onNova(2)} style={{ ...s.btn(false), cursor: "pointer" }}>＋ Grupo / família</button>
      <button type="button" onClick={onImportar} style={{ ...s.btn(false), cursor: "pointer" }}>📥 Importar planilha</button>
      <span style={{ fontSize: 12, color: C.muted }}>A poltrona pode ser escolhida depois (aba 💺 Poltronas ou ⚡ Distribuir).{v.foto_obrigatoria ? " Foto obrigatória para o crachá: ligada (crachá e link de cadastro chegam na próxima etapa)." : ""}</span>
    </div>
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ ...s.card, padding: 12, flex: "2 1 520px", display: "grid", gap: 8, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{FILTROS.map(([k, n, c]) => <button key={k} type="button" onClick={() => setF(k)} style={{ ...s.btn(f === k), cursor: "pointer", padding: "4px 10px", fontSize: 12 }}>{n} ({c})</button>)}
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔎 Nome, documento, telefone, reserva…" style={{ ...s.input, flex: "1 1 180px" }} /></div>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Nome", "Poltrona", "Documento", "Telefone", v.embarques_diferentes ? "Embarque" : null, "Saúde", "Reserva"].filter(Boolean).map((h) => <th key={h} style={{ ...td, textAlign: "left", color: C.textSub, fontWeight: 600 }}>{h}</th>)}</tr></thead>
          <tbody>{l.map((p) => <tr key={p.id} onClick={() => onPass(p)} style={{ cursor: "pointer" }}>
            <td style={td}><b>{p.nome}</b>{p.menor ? <span style={{ color: C.textSub }}> · menor</span> : ""}{p.assistencia ? " ♿" : ""}{p.incompleto && <span style={{ color: C.warn }} title="Falta documento, nascimento ou telefone"> ⚠</span>}</td>
            <td style={td}>{p.poltrona ? `${busNome(p.onibus_id)} · ${p.poltrona}` : <span style={{ color: C.warn }}>—</span>}</td>
            <td style={td}>{p.documento || "—"}</td><td style={td}>{p.telefone || "—"}</td>
            {v.embarques_diferentes && <td style={td}>{nomeEmbarque(v, p.embarque_parada_id)}</td>}
            <td style={td}>{[p.tipo_sanguineo, p.plano_saude && "plano", p.seguro_viagem && "seguro"].filter(Boolean).join(" · ") || "—"}</td>
            <td style={td}>{p.reserva_codigo}{p.reserva_tipo === "grupo" ? <div style={{ fontSize: 11, color: C.textSub }}>{p.responsavel}</div> : ""}</td>
          </tr>)}
            {!l.length && <tr><td style={{ ...td, color: C.textSub }} colSpan={7}>{D.passageiros.length ? "Ninguém neste filtro." : "Nenhum passageiro ainda — ＋ Passageiro, ＋ Grupo ou 📥 Importar planilha."}</td></tr>}</tbody>
        </table></div>
      </div>
      <div style={{ flex: "1 1 300px", minWidth: 0 }}><Reservas C={C} s={s} D={D} onPass={onPass} onMudou={onMudou} setConf={setConf} setMsg={setMsg} /></div>
    </div>
  </div>;
}

function Reservas({ C, s, D, onPass, onMudou, setConf, setMsg }) {
  const [busca, setBusca] = useState(""); const [aberta, setAberta] = useState(null);
  const t = busca.trim().toLowerCase(); const busNome = (id) => D.onibus.find((o) => String(o.id) === String(id))?.nome || "";
  const rs = D.reservas.filter((r) => !t || [r.codigo, r.responsavel, r.telefone].some((x) => String(x || "").toLowerCase().includes(t)) || D.passageiros.some((p) => String(p.reserva_id) === String(r.id) && String(p.nome).toLowerCase().includes(t)));
  const v = D.viagem; const pontos = pontosEmbarque(v);
  const salvarR = async (r, b) => { try { await apiService.put(`/turismo/reservas/${r.id}`, b); onMudou(); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } };
  const excluir = (r) => setConf({ texto: `Cancelar a reserva ${r.codigo} (${r.responsavel}) e liberar as poltronas?`, sim: async () => { try { await apiService.delete(`/turismo/reservas/${r.id}`); onMudou(); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } } });
  return <div style={{ ...s.card, padding: 14, display: "grid", gap: 8 }}>
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}><b>Reservas ({D.reservas.length}) · {D.passageiros.length} passageiro(s)</b></div>
    <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔎 Nome, código, telefone…" style={{ ...s.input, width: "100%" }} />
    <div style={{ display: "grid", gap: 6, maxHeight: 460, overflowY: "auto" }}>
      {rs.map((r0) => { const ps = D.passageiros.filter((p) => String(p.reserva_id) === String(r0.id)); const ab = aberta === r0.id || !!t; const embs = [...new Set(ps.map((p) => p.embarque_parada_id || ""))]; const r = { ...r0, _emb: embs.length === 1 ? embs[0] : "" };
        return <div key={r.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 9px" }}>
          <div onClick={() => setAberta(ab && !t ? null : r.id)} style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer", fontSize: 13 }}>
            <b>{r.codigo}</b><span style={{ flex: 1 }}>{r.tipo === "grupo" ? "👨‍👩‍👧 " : ""}{r.responsavel}</span><span style={{ fontSize: 11.5, color: C.textSub }}>{ps.length} · {ps.map((p) => p.poltrona || "—").join(",")}</span>
            {v.acompanhar_pagamentos && <span title={PAG[r.situacao_pagamento] || ""} style={{ fontSize: 11 }}>{(PAG[r.situacao_pagamento] || "⏳").split(" ")[0]}</span>}
          </div>
          {ab && <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
            {ps.map((p) => <div key={p.id} onClick={() => onPass(p)} style={{ fontSize: 12.5, cursor: "pointer", display: "flex", gap: 6 }}><span style={{ width: 70, color: C.textSub }}>{p.poltrona ? `${busNome(p.onibus_id).slice(0, 8)} ${p.poltrona}` : "sem pol."}</span><span style={{ flex: 1 }}>{p.nome}{p.menor ? " · menor" : ""}</span>{pontos.length > 0 && p.embarque_parada_id && <span style={{ color: C.textSub }}>🚏 {nomeEmbarque(v, p.embarque_parada_id)}</span>}{p.incompleto && <span style={{ color: C.warn }} title="Falta documento, nascimento ou telefone">⚠</span>}</div>)}
            <div style={{ fontSize: 11.5, color: C.textSub }}>{[r.telefone, r.email, r.origem_venda && `venda: ${r.origem_venda}`, r.obs].filter(Boolean).join(" · ")}</div>
            {v.acompanhar_pagamentos && <PagamentoReserva C={C} s={s} r={r} onSalvar={(b) => salvarR(r, b)} />}
            {pontos.length > 0 && <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>🚏 Grupo embarca em <select value={r._emb ?? ""} onChange={(e) => salvarR(r, { embarque_parada_id: e.target.value || null })} style={{ ...s.input, padding: "3px 6px" }}><option value="">{v.origem || "saída"} (origem)</option>{pontos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select><span style={{ color: C.muted }}>(muda todos da reserva)</span></div>}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button type="button" onClick={() => excluir(r)} style={{ ...s.btn(false), cursor: "pointer", padding: "3px 9px", fontSize: 12 }}>Cancelar reserva</button></div>
          </div>}
        </div>; })}
      {!rs.length && <div style={{ fontSize: 12.5, color: C.textSub }}>{t ? "Nada encontrado." : "Nenhuma reserva ainda."}</div>}
    </div>
  </div>;
}

function PagamentoReserva({ C, s, r, onSalvar }) {
  const [valor, setValor] = useState(r.valor ?? ""); const [pagoV, setPagoV] = useState(r.valor_pago ?? "");
  return <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 12 }}>💲
    <select value={r.situacao_pagamento || "pendente"} onChange={(e) => onSalvar({ situacao_pagamento: e.target.value, valor: valor === "" ? null : valor, valor_pago: e.target.value === "parcial" ? pagoV || null : null })} style={{ ...s.input, padding: "3px 6px" }}>{Object.entries(PAG).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
    valor <input type="number" min="0" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} onBlur={() => String(valor) !== String(r.valor ?? "") && onSalvar({ valor: valor === "" ? null : valor })} style={{ ...s.input, padding: "3px 6px", width: 90 }} />
    {r.situacao_pagamento === "parcial" && <>pago <input type="number" min="0" step="0.01" value={pagoV} onChange={(e) => setPagoV(e.target.value)} onBlur={() => String(pagoV) !== String(r.valor_pago ?? "") && onSalvar({ situacao_pagamento: "parcial", valor_pago: pagoV })} style={{ ...s.input, padding: "3px 6px", width: 90 }} /></>}
  </div>;
}

function CampoEmbarque({ C, s, v, valor, onChange }) {
  const pontos = pontosEmbarque(v); if (!pontos.length) return null; const dif = !!valor;
  return <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, flex: "1 1 100%" }}>
    <Toggle C={C} ligado={dif} rotulo="Embarque diferente da saída" onChange={(x) => onChange(x ? pontos[0].id : null)} /> Embarque diferente da saída
    {dif && <select value={valor} onChange={(e) => onChange(e.target.value)} style={{ ...s.input, padding: "4px 8px" }}>{pontos.map((x) => <option key={x.id} value={x.id}>🚏 {x.nome}</option>)}</select>}
  </div>;
}

function CamposPassageiro({ C, s, p, set, enxuto = false, v = null, embarque = true }) {
  const lab = { fontSize: 11, color: C.textSub, display: "block", marginBottom: 2 };
  const c = (k, l, t = "text", flex = "1 1 140px") => <div style={{ flex }}><span style={lab}>{l}</span><input type={t} value={p[k] || ""} onChange={(e) => set({ ...p, [k]: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>;
  return <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
    {c("nome", "NOME COMPLETO", "text", "2 1 220px")}{c("documento", "RG / CPF")}{c("nascimento", "NASCIMENTO", "date")}{c("telefone", "TELEFONE")}
    {!enxuto && <>{c("emergencia_nome", "CONTATO DE EMERGÊNCIA")}{c("emergencia_telefone", "TEL. EMERGÊNCIA")}{c("obs", "OBSERVAÇÃO (saúde, alimentação…)", "text", "2 1 220px")}</>}
    <div style={{ flex: "0 1 110px" }}><span style={lab}>TIPO SANGUÍNEO</span><select value={p.tipo_sanguineo || ""} onChange={(e) => set({ ...p, tipo_sanguineo: e.target.value })} style={{ ...s.input, width: "100%" }}><option value="">—</option>{SANGUE.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, flex: "1 1 100%" }}><Toggle C={C} ligado={!!p.plano_saude} rotulo="Plano de saúde" onChange={(x) => set({ ...p, plano_saude: x })} /> Plano de saúde
      {p.plano_saude && <><input value={p.plano_saude_nome || ""} onChange={(e) => set({ ...p, plano_saude_nome: e.target.value })} placeholder="Qual (operadora)" style={{ ...s.input, flex: "1 1 140px" }} /><input value={p.plano_saude_numero || ""} onChange={(e) => set({ ...p, plano_saude_numero: e.target.value })} placeholder="Nº da carteirinha" style={{ ...s.input, flex: "1 1 140px" }} /></>}</div>
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, flex: "1 1 100%" }}><Toggle C={C} ligado={!!p.seguro_viagem} rotulo="Seguro viagem" onChange={(x) => set({ ...p, seguro_viagem: x })} /> Seguro viagem
      {p.seguro_viagem && <><input value={p.seguro_nome || ""} onChange={(e) => set({ ...p, seguro_nome: e.target.value })} placeholder="Seguradora" style={{ ...s.input, flex: "1 1 140px" }} /><input value={p.seguro_apolice || ""} onChange={(e) => set({ ...p, seguro_apolice: e.target.value })} placeholder="Nº da apólice" style={{ ...s.input, flex: "1 1 140px" }} /></>}</div>
    <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, flex: "1 1 100%" }}><Toggle C={C} ligado={!!p.assistencia} rotulo="Precisa de assistência" onChange={(x) => set({ ...p, assistencia: x })} /> Precisa de assistência (idoso, mobilidade…)</div>
    {embarque && v && <CampoEmbarque C={C} s={s} v={v} valor={p.embarque_parada_id || null} onChange={(x) => set({ ...p, embarque_parada_id: x })} />}
  </div>;
}

function FormReserva({ C, s, viagem: v, viagemId, r, onFechar, onSalvo }) {
  const [d, setD] = useState(r); const [msg, setMsg] = useState(""); const [salvando, setSalvando] = useState(false);
  const lab = { fontSize: 11.5, color: C.textSub, display: "block", marginBottom: 3 }; const grupo = d.passageiros.length > 1;
  const setP = (i, p) => setD({ ...d, passageiros: d.passageiros.map((x, j) => (j === i ? p : x)) });
  const salvar = async () => { setMsg(""); if (d.situacao_pagamento === "parcial" && !(Number(d.valor_pago) > 0)) { setMsg("⚠ Informe quanto já foi pago."); return; } setSalvando(true); try { const x = await apiService.post(`/turismo/viagens/${viagemId}/reservas`, { ...d, valor: d.valor === "" ? null : d.valor }); onSalvo(`✔ Reserva ${x.reserva.codigo} criada (${x.passageiros.length} passageiro(s)).`); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } finally { setSalvando(false); } };
  return <Modal C={C} s={s} titulo={grupo ? "🎟 Reserva de grupo / família" : "🎟 Reserva"} onFechar={onFechar} largura={720}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {grupo && <div style={{ flex: "2 1 220px" }}><span style={lab}>RESPONSÁVEL PELO GRUPO</span><input value={d.responsavel} onChange={(e) => setD({ ...d, responsavel: e.target.value })} placeholder="Em branco = 1º passageiro" style={{ ...s.input, width: "100%" }} /></div>}
      <div style={{ flex: "1 1 150px" }}><span style={lab}>TELEFONE DA RESERVA</span><input value={d.telefone} onChange={(e) => setD({ ...d, telefone: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>
      <div style={{ flex: "1 1 150px" }}><span style={lab}>VENDIDO POR (opcional)</span><input value={d.origem_venda} list="origens-venda" onChange={(e) => setD({ ...d, origem_venda: e.target.value })} placeholder="balcão, site, WhatsApp…" style={{ ...s.input, width: "100%" }} /><datalist id="origens-venda">{["Balcão", "WhatsApp", "Site", "Instagram", "Agente / revendedor"].map((o) => <option key={o} value={o} />)}</datalist></div>
    </div>
    {v.acompanhar_pagamentos && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div style={{ flex: "1 1 170px" }}><span style={lab}>💲 PAGAMENTO</span><select value={d.situacao_pagamento} onChange={(e) => setD({ ...d, situacao_pagamento: e.target.value })} style={{ ...s.input, width: "100%" }}>{Object.entries(PAG).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div style={{ flex: "1 1 140px" }}><span style={lab}>VALOR DA RESERVA (R$)</span><input type="number" min="0" step="0.01" value={d.valor} onChange={(e) => setD({ ...d, valor: e.target.value })} placeholder={v.valor_pessoa != null ? String(Number(v.valor_pessoa) * d.passageiros.length) : ""} style={{ ...s.input, width: "100%" }} /></div>
      {d.situacao_pagamento === "parcial" && <div style={{ flex: "1 1 140px" }}><span style={lab}>JÁ PAGO (R$)</span><input type="number" min="0" step="0.01" value={d.valor_pago} onChange={(e) => setD({ ...d, valor_pago: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>}
      {v.valor_pessoa != null && <div style={{ fontSize: 11.5, color: C.muted, flex: "1 1 100%" }}>Em branco = {reais(v.valor_pessoa)} × {d.passageiros.length} passageiro(s). Mude para desconto, criança etc.</div>}
    </div>}
    {pontosEmbarque(v).length > 0 && grupo && <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, flexWrap: "wrap" }}>🚏 O grupo embarca em <select value={d.embarque_parada_id || ""} onChange={(e) => { const x = e.target.value || null; setD({ ...d, embarque_parada_id: x, passageiros: d.passageiros.map((p) => ({ ...p, embarque_parada_id: x })) }); }} style={{ ...s.input, padding: "4px 8px" }}><option value="">{v.origem || "saída"} (origem)</option>{pontosEmbarque(v).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select><span style={{ color: C.muted, fontSize: 11.5 }}>— dá para mudar um passageiro abaixo</span></div>}
    {d.passageiros.map((p, i) => <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5 }}><b>Passageiro {i + 1}</b><span style={{ color: C.textSub }}>{p.poltrona ? `poltrona ${p.poltrona}` : "sem poltrona"}</span>
        {grupo && i > 0 && <label style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>menor sob responsabilidade de <select value={p.menor_de ?? ""} onChange={(e) => setP(i, { ...p, menor_de: e.target.value === "" ? null : Number(e.target.value) })} style={{ ...s.input, padding: "3px 6px" }}><option value="">—</option>{d.passageiros.map((q2, j) => j !== i && <option key={j} value={j}>{q2.nome || `Passageiro ${j + 1}`}</option>)}</select></label>}
        {!p.poltrona && d.passageiros.length > 1 && <button type="button" onClick={() => setD({ ...d, passageiros: d.passageiros.filter((_, j) => j !== i) })} style={{ ...s.btn(false), cursor: "pointer", padding: "2px 8px", marginLeft: grupo && i > 0 ? 0 : "auto" }}>✕</button>}
      </div>
      <CamposPassageiro C={C} s={s} v={v} p={p} set={(x) => setP(i, x)} enxuto={grupo && i > 0} />
    </div>)}
    <button type="button" onClick={() => setD({ ...d, passageiros: [...d.passageiros, { ...PASS_VAZIO, embarque_parada_id: d.embarque_parada_id || null, poltrona: null, onibus_id: null, menor_de: null }] })} style={{ ...s.btn(false), cursor: "pointer", justifySelf: "start" }}>＋ Passageiro sem poltrona (escolhe depois)</button>
    <div style={{ fontSize: 11.5, color: C.muted }}>Só o nome é obrigatório agora; o que faltar (documento, nascimento, telefone) fica com ⚠ na lista para completar antes do embarque.</div>
    {msg && <div style={{ color: C.warn, fontSize: 13 }}>{msg}</div>}
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={onFechar} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button><button type="button" disabled={salvando} onClick={salvar} style={{ ...s.btn(true), cursor: "pointer" }}>{salvando ? "Salvando…" : "Confirmar reserva"}</button></div>
  </Modal>;
}

function FormPassageiro({ C, s, viagem: v, p, onFechar, onMover, onSalvo, setConf }) {
  const [d, setD] = useState({ ...PASS_VAZIO, ...p }); const [msg, setMsg] = useState("");
  const salvar = async () => { try { await apiService.put(`/turismo/passageiros/${p.id}`, d); onSalvo("✔ Passageiro atualizado."); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } };
  const tirar = () => setConf({ texto: `Tirar ${p.nome} da viagem? A poltrona fica livre.`, sim: async () => { try { await apiService.delete(`/turismo/passageiros/${p.id}`); onSalvo("✔ Passageiro removido."); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } } });
  return <Modal C={C} s={s} titulo={`${p.poltrona ? `Poltrona ${p.poltrona} · ` : ""}${p.nome}`} onFechar={onFechar} largura={620}>
    <div style={{ fontSize: 12.5, color: C.textSub }}>Reserva {p.reserva_codigo}{p.reserva_tipo === "grupo" ? ` · grupo de ${p.responsavel}` : ""}{p.idade != null ? ` · ${p.idade} anos` : ""}{p.menor ? " · menor de idade" : ""}</div>
    <CamposPassageiro C={C} s={s} v={v} p={d} set={setD} />
    {msg && <div style={{ color: C.warn, fontSize: 13 }}>{msg}</div>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" onClick={onMover} style={{ ...s.btn(false), cursor: "pointer" }}>🔁 Mudar / trocar poltrona</button>
      <button type="button" onClick={tirar} style={{ ...s.btn(false), cursor: "pointer" }}>Tirar da viagem</button>
      <span style={{ flex: 1 }} /><button type="button" onClick={onFechar} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button><button type="button" onClick={salvar} style={{ ...s.btn(true), cursor: "pointer" }}>Salvar</button>
    </div>
  </Modal>;
}

function FormOnibus({ C, s, viagem, viagemId, o, mapas, onFechar, onSalvo, setConf, embutido = false }) {
  const [d, setD] = useState({ ...o, motoristas: (o.motoristas || []).length ? o.motoristas : [{ nome: "", colaborador_id: null, telefone: "" }] });
  const setM = (i, m) => setD({ ...d, motoristas: d.motoristas.map((x, j) => (j === i ? m : x)) }); const [msg, setMsg] = useState(""); const [frota, setFrota] = useState([]); const [pessoas, setPessoas] = useState(null);
  useEffect(() => { apiService.listarEquipamentos().then((r) => setFrota((Array.isArray(r) ? r : r?.equipamentos || []).filter((e) => e.placa))).catch(() => {}); apiService.get("/pessoas/gestao-pessoas").then((r) => setPessoas(r.funcionarios || [])).catch(() => setPessoas([])); }, []);
  const lab = { fontSize: 11.5, color: C.textSub, display: "block", marginBottom: 3 };
  const salvar = async () => { setMsg(""); try { const r = o.id ? await apiService.put(`/turismo/onibus/${o.id}`, { ...d, viagem_id: viagemId, mapa_id: d.mapa_id || undefined }) : await apiService.post(`/turismo/viagens/${viagemId}/onibus`, d); onSalvo(r.onibus); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } };
  const excluir = () => setConf({ texto: `Tirar ${o.nome} da viagem?`, sim: async () => { try { await apiService.delete(`/turismo/onibus/${o.id}`); onSalvo(null); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } } });
  const campo = (k, l) => <div style={{ flex: "1 1 150px" }}><span style={lab}>{l}</span><input value={d[k] || ""} onChange={(e) => setD({ ...d, [k]: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>;
  const pend = o.id && (o.falta_veiculo || o.falta_motorista);
  return <Quadro C={C} s={s} embutido={embutido} titulo={o.id ? <>🚌 {o.nome} <span style={{ fontWeight: 400, fontSize: 12, color: C.textSub }}>· {o.ocupados ?? 0}/{o.lugares ?? ""} ocupados</span>{pend && <span style={{ fontWeight: 400, fontSize: 12, color: C.warn }}> · 🟡 {[o.falta_veiculo && "veículo a definir", o.falta_motorista && "sem motorista"].filter(Boolean).join(" · ")}</span>}</> : `＋ Novo veículo`} onFechar={onFechar} largura={600}>
    <div><span style={lab}>TIPO DO VEÍCULO / MAPA DE POLTRONAS</span><select value={d.mapa_id || ""} onChange={(e) => setD({ ...d, mapa_id: e.target.value })} style={{ ...s.input, width: "100%" }}>
      {o.id && !o.mapa_id && <option value="">Atual: {o.tipo_nome || "mapa da viagem"}</option>}
      {(mapas?.mapas || []).length > 0 && <optgroup label="Mapas da empresa">{mapas.mapas.map((m) => <option key={m.id} value={m.id}>{m.nome} · {m.lugares} lugares</option>)}</optgroup>}
      <optgroup label="Modelos prontos">{(mapas?.modelos || []).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</optgroup></select>
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>O ônibus da viagem recebe uma cópia do mapa — mudar o modelo depois não mexe nas viagens já montadas.</div></div>
    {frota.length > 0 && <div><span style={lab}>DA FROTA (opcional)</span><select value={d.equipamento_id || ""} onChange={(e) => setD({ ...d, equipamento_id: e.target.value })} style={{ ...s.input, width: "100%" }}><option value="">— de terceiro ou ainda a definir —</option>{frota.map((e) => <option key={e.id} value={e.id}>{e.tag || e.nome} · {e.placa}</option>)}</select></div>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{campo("nome", o.id ? "APELIDO NA VIAGEM" : "APELIDO (opcional — senão Ônibus N)")}{!d.equipamento_id && campo("placa", "PLACA (em branco = a definir)")}{campo("empresa", "EMPRESA DO ÔNIBUS")}</div>
    <span style={{ ...lab, marginBottom: -4 }}>MOTORISTA(S) — em branco = a definir</span>
    {d.motoristas.map((m, i) => <div key={i} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ flex: "2 1 220px" }}><CampoFuncionario C={C} s={s} lista={pessoas} nome={m.nome} id={m.colaborador_id} placeholder={i ? "Motorista de revezamento…" : "Digite o nome do motorista…"} onChange={(v) => setM(i, { ...m, nome: v.nome, colaborador_id: v.id })} /></div>
      <input value={m.telefone || ""} onChange={(e) => setM(i, { ...m, telefone: e.target.value })} placeholder="Telefone" style={{ ...s.input, flex: "1 1 130px" }} />
      {d.motoristas.length > 1 && <button type="button" onClick={() => setD({ ...d, motoristas: d.motoristas.filter((_, j) => j !== i) })} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 9px" }}>✕</button>}
    </div>)}
    {d.motoristas.length < 4 && <button type="button" onClick={() => setD({ ...d, motoristas: [...d.motoristas, { nome: "", colaborador_id: null, telefone: "" }] })} style={{ ...s.btn(false), cursor: "pointer", justifySelf: "start" }}>＋ Outro motorista (revezamento)</button>}
    {msg && <div style={{ color: C.warn, fontSize: 13 }}>{msg}</div>}
    <div style={{ display: "flex", gap: 8 }}>{o.id && <button type="button" onClick={excluir} style={{ ...s.btn(false), cursor: "pointer" }}>Tirar da viagem</button>}<span style={{ flex: 1 }} />{onFechar && <button type="button" onClick={onFechar} style={{ ...s.btn(false), cursor: "pointer" }}>{o.id ? "Voltar" : "Cancelar"}</button>}<button type="button" onClick={salvar} style={{ ...s.btn(true), cursor: "pointer" }}>{o.id ? "Salvar veículo" : "Incluir veículo"}</button></div>
  </Quadro>;
}

function Importar({ C, s, D, onFechar, onFeito }) {
  const [texto, setTexto] = useState(""); const [msg, setMsg] = useState(""); const [enviando, setEnviando] = useState(false); const [origem, setOrigem] = useState("");
  const P = useMemo(() => lerPlanilha(texto), [texto]);
  const arquivo = (e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setTexto(String(r.result || "")); r.readAsText(f, "utf-8"); };
  const enviar = async () => { setMsg(""); setEnviando(true); try { const r = await apiService.post(`/turismo/viagens/${D.viagem.id}/importar`, { linhas: P.linhas, origem_venda: origem }); onFeito(`✔ ${r.importados} passageiro(s) importados em ${r.reservas} reserva(s).`); } catch (e) { setMsg(`⚠ ${erroDe(e)}`); } finally { setEnviando(false); } };
  return <Modal C={C} s={s} titulo="📥 Importar planilha de passageiros" onFechar={onFechar} largura={760}>
    <div style={{ fontSize: 12.5, color: C.textSub }}>Copie as linhas do Excel/Google Planilhas e cole aqui (ou escolha um CSV). Colunas reconhecidas pelo cabeçalho: <b>nome</b>, documento, nascimento, telefone, poltrona, <b>grupo/responsável</b> (mesmo valor = mesma reserva), ônibus{D.onibus.length > 1 ? " (nome, nº ou placa — obrigatório com poltrona)" : ""}, emergência, obs{pontosEmbarque(D.viagem).length ? ", embarque (nome da parada)" : ""}. Sem cabeçalho, a ordem é: nome, documento, nascimento, telefone, poltrona, grupo, ônibus.</div>
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
