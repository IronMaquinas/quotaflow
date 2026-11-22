// components/fotoCartao/TelaFotoCartao.jsx — etapa E1: 📸 FOTO COM CARTÃO
//   📸 Tirar foto (escolhe o cartão e a referência → câmera) · 🖼 Fotos (galeria com busca nos valores do cartão) · ⚙ Modelos (admin, gestor, qualidade)
//   Fila no aparelho: mostra quantas fotos aguardam sinal e envia sozinha.
import { useEffect, useRef, useState } from "react";
import apiService from "../../services/apiService";
import CameraCartao from "./CameraCartao";
import * as Fila from "../../utils/filaFotosCartao";
import { desenharCartao, alturaCartao, carregarImagem, quandoBR, gpsTxt } from "../../utils/cartaoFoto";
import { logoEmpresa, dadosEmpresa } from "../../utils/logoEmpresa";

const usuarioLocal = () => { try { return JSON.parse(localStorage.getItem("usuario") || "{}"); } catch { return {}; } };
const chaveTenant = () => { const u = usuarioLocal(); return String(u.tenant_id ?? u.tenantId ?? u.email ?? "t"); };
const ULT = "qfCartaoUltimo";

function Previa({ modelo, largura = 360 }) {
  const ref = useRef(null);
  useEffect(() => { let vivo = true; carregarImagem(logoEmpresa()).then((logo) => { if (!vivo || !ref.current) return; const dpr = window.devicePixelRatio || 1; const h = alturaCartao(modelo, largura);
    const c = ref.current; c.width = largura * dpr; c.height = (h + 2) * dpr; c.style.width = `${largura}px`; c.style.height = `${h + 2}px`; const ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ex = {}; (modelo.campos || []).forEach((k, i) => { ex[k.id] = k.tipo === "opcoes" ? k.opcoes?.[0] : k.tipo === "numero" ? String(10 * (i + 1)) : "abc"; });
    desenharCartao(ctx, 1, 1, largura - 2, { modelo, valores: ex, obs: "Exemplo de observação", empresa: dadosEmpresa()?.nome, logo, tecnico: usuarioLocal().nome || "Técnico", quando: Date.now(), gps: { lat: -5.123456, lng: -36.123456, precisao: 6 }, id: "7F3A9C21" }); });
    return () => { vivo = false; }; }, [JSON.stringify(modelo), largura]); // eslint-disable-line
  return <canvas ref={ref} style={{ maxWidth: "100%", borderRadius: 6, background: "#64748b" }} />;
}

export default function TelaFotoCartao({ C, s, embutida = false }) {
  const u = usuarioLocal(); const perfis = Array.isArray(u.perfis) && u.perfis.length ? u.perfis : [u.perfil].filter(Boolean);
  const podeEditar = perfis.some((p) => ["admin", "gestor", "qualidade"].includes(p));
  const [aba, setAba] = useState("tirar"); const [M, setM] = useState(null); const [erro, setErro] = useState(""); const [msg, setMsg] = useState("");
  const ult = (() => { try { return JSON.parse(localStorage.getItem(ULT) || "{}"); } catch { return {}; } })();
  const [modeloId, setModeloId] = useState(ult.modelo_id || ""); const [ref, setRef] = useState(ult.referencia || ""); const [cam, setCam] = useState(false); const [cartao, setCartao] = useState(ult.cartao || null);
  const [fila, setFila] = useState({ pendentes: 0, erros: 0 }); const [refs, setRefs] = useState([]); const [persist, setPersist] = useState(null);
  const tenant = chaveTenant();
  const carregar = () => apiService.get(`/foto-cartao/modelos${podeEditar ? "?todos=1" : ""}`).then((r) => { setM(r); setErro(""); }).catch((e) => setErro(e?.response?.data?.erro || e.message));
  const sincronizar = async () => { const r = await Fila.sincronizar(tenant, (corpo) => apiService.post("/foto-cartao/fotos", corpo)); const l = await Fila.listar(tenant); setFila({ pendentes: l.filter((x) => x.status !== "erro").length, erros: l.filter((x) => x.status === "erro").length, lista: l }); return r; };
  useEffect(() => { Fila.pedirPersistencia().then(setPersist); carregar(); sincronizar(); apiService.get("/foto-cartao/fotos?limite=1").then((r) => setRefs(r.referencias || [])).catch(() => {}); const f = () => sincronizar(); window.addEventListener("online", f); const t = setInterval(f, 30000); return () => { window.removeEventListener("online", f); clearInterval(t); }; }, []); // eslint-disable-line
  const ativos = (M?.modelos || []).filter((m) => m.ativo !== false); const modelo = ativos.find((m) => String(m.id) === String(modeloId)) || null;
  const card = { ...s.card, padding: "16px 18px" }; const lab = { fontSize: 11.5, color: C.textSub, display: "block", marginBottom: 3 };
  const abas = [["tirar", "📸 Tirar foto"], ["fotos", "🖼 Fotos"], ...(podeEditar ? [["modelos", "⚙ Modelos de cartão"]] : [])];

  if (cam && modelo) return <CameraCartao modelo={modelo} referencia={ref} tenant={tenant} tecnico={u.nome || ""} valoresIniciais={cartao && String(cartao.modelo_id) === String(modelo.id) ? cartao : null}
    onFoto={(c) => { const x = { ...c, modelo_id: modelo.id }; setCartao(x); try { localStorage.setItem(ULT, JSON.stringify({ modelo_id: modelo.id, referencia: ref, cartao: x })); } catch { /* ok */ } return sincronizar(); }}
    onFechar={() => { setCam(false); sincronizar(); }} />;
  return (
    <div style={{ padding: embutida ? "14px" : "20px clamp(12px, 3vw, 28px)", display: "grid", gap: 14 }}>
      {!embutida && <div><div style={{ fontSize: 22, fontWeight: 800 }}>📸 Foto com cartão</div><div style={{ fontSize: 13, color: C.textSub, marginTop: 2 }}>O cartão de registro vai gravado na própria foto — sem cartão plastificado, caneta e pano. Funciona sem sinal: as fotos ficam no aparelho e sobem depois.</div></div>}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>{abas.map(([k, l]) => <button key={k} type="button" onClick={() => setAba(k)} style={{ background: "transparent", border: "none", borderBottom: `2px solid ${aba === k ? C.accent : "transparent"}`, padding: "8px 12px", color: aba === k ? C.text : C.muted, fontWeight: 600, cursor: "pointer" }}>{l}</button>)}</div>
      {erro && <div style={{ ...card, color: C.danger }}>{erro}</div>}
      {msg && <div style={{ fontSize: 13, color: /^⚠/.test(msg) ? C.warn : "#22c55e" }}>{msg}</div>}
      {(fila.pendentes > 0 || fila.erros > 0) && <div style={{ ...card, borderLeft: `4px solid ${C.warn}`, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
        <span>📶 {fila.pendentes} foto(s) no aparelho aguardando sinal{fila.erros ? ` · ${fila.erros} com erro` : ""}</span>
        <button type="button" onClick={async () => { const r = await sincronizar(); setMsg(r ? (r.enviadas ? `${r.enviadas} foto(s) enviada(s).` : "⚠ Ainda sem conexão com o servidor.") : ""); }} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 12px" }}>Enviar agora</button>
        <button type="button" onClick={() => copiasNoAparelho(fila.lista || [], setMsg)} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 12px" }}>⬇ Salvar cópias na galeria</button>
        {fila.erros > 0 && <span style={{ color: C.danger, fontSize: 12 }}>{fila.lista?.find((x) => x.status === "erro")?.erro}</span>}</div>}
      {persist === false && /iPhone|iPad/.test(navigator.userAgent) && <div style={{ ...card, fontSize: 12.5, color: C.textSub }}>💡 No iPhone, para o aparelho nunca apagar fotos ainda não enviadas, adicione o QuotaFlow à <b>Tela de Início</b> (Safari → Compartilhar → Adicionar à Tela de Início) e abra por lá.</div>}

      {aba === "tirar" && <div style={{ ...card, display: "grid", gap: 12 }}>
        {!M && !erro && <div style={{ color: C.muted }}>Carregando…</div>}
        {M && !ativos.length && <div style={{ fontSize: 13, color: C.textSub }}>Nenhum modelo de cartão ainda.{podeEditar ? " Crie em ⚙ Modelos de cartão (há exemplos prontos de pá eólica)." : " Peça ao gestor para criar o modelo."}</div>}
        {ativos.length > 0 && <>
          <div><span style={lab}>CARTÃO</span><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{ativos.map((m) => <button key={m.id} type="button" onClick={() => setModeloId(m.id)} style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer", border: `2px solid ${String(modeloId) === String(m.id) ? C.accent : C.border}`, background: "transparent", color: C.text, fontWeight: 600 }}>{m.nome}</button>)}</div></div>
          <div><span style={lab}>REFERÊNCIA (parque, aerogerador, equipamento…)</span><input value={ref} list="qf-refs-cartao" onChange={(e) => setRef(e.target.value)} placeholder="Ex.: Parque Serra Azul · WTG-07" style={{ ...s.input, width: "100%", maxWidth: 420 }} /><datalist id="qf-refs-cartao">{refs.map((r) => <option key={r} value={r} />)}</datalist></div>
          {modelo && <Previa modelo={modelo} />}
          <button type="button" disabled={!modelo} onClick={() => { if (!navigator.mediaDevices?.getUserMedia) return setMsg("⚠ Este navegador não libera a câmera. Use o Safari (iPhone) ou o Chrome (Android)."); setMsg(""); setCam(true); }} style={{ ...s.btn(true), cursor: "pointer", padding: "14px 20px", fontSize: 16, opacity: modelo ? 1 : 0.5, justifySelf: "start" }}>📸 Abrir câmera</button>
        </>}
      </div>}
      {aba === "fotos" && <Galeria C={C} s={s} modelos={M?.modelos || []} />}
      {aba === "modelos" && podeEditar && M && <Modelos C={C} s={s} M={M} onMudou={carregar} setMsg={setMsg} />}
    </div>
  );
}

// E1.1: cópia de segurança das fotos que ainda não subiram — compartilhar para Fotos/Arquivos (ou baixar)
async function copiasNoAparelho(lista, setMsg) {
  const fotos = lista.filter((x) => x.corpo?.imagem); if (!fotos.length) return;
  const arqs = await Promise.all(fotos.map(async (x) => new File([await (await fetch(x.corpo.imagem)).blob()], `quotaflow-${x.corpo.referencia || "foto"}-${x.uid.slice(0, 8)}.jpg`.replace(/[^\w.-]+/g, "_"), { type: "image/jpeg" })));
  try { if (navigator.canShare?.({ files: arqs })) { await navigator.share({ files: arqs }); return; } } catch (e) { if (e?.name === "AbortError") return; }
  for (const f of arqs) { const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  setMsg(`${arqs.length} cópia(s) baixada(s).`);
}

function Galeria({ C, s, modelos }) {
  const [f, setF] = useState({ busca: "", modelo_id: "", de: "", ate: "" }); const [L, setL] = useState(null); const [ver, setVer] = useState(null);
  const buscar = () => { const p = new URLSearchParams(Object.entries(f).filter(([, v]) => v)); apiService.get(`/foto-cartao/fotos?${p}`).then(setL).catch(() => setL({ fotos: [], total: 0 })); };
  useEffect(() => { const t = setTimeout(buscar, 300); return () => clearTimeout(t); }, [JSON.stringify(f)]); // eslint-disable-line
  const card = { ...s.card, padding: "14px 16px" };
  return <div style={{ display: "grid", gap: 12 }}>
    <div style={{ ...card, display: "flex", gap: 8, flexWrap: "wrap" }}>
      <input value={f.busca} onChange={(e) => setF({ ...f, busca: e.target.value })} placeholder="Buscar: pá, defeito, referência, técnico…" style={{ ...s.input, flex: "2 1 220px" }} />
      <select value={f.modelo_id} onChange={(e) => setF({ ...f, modelo_id: e.target.value })} style={{ ...s.input, flex: "1 1 160px" }}><option value="">Todos os cartões</option>{modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>
      <input type="date" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} style={{ ...s.input, flex: "1 1 130px" }} /><input type="date" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} style={{ ...s.input, flex: "1 1 130px" }} />
    </div>
    {!L && <div style={{ color: C.muted }}>Carregando…</div>}
    {L && <div style={{ fontSize: 12.5, color: C.textSub }}>{L.total} foto(s){L.total > L.fotos.length ? ` — mostrando as ${L.fotos.length} mais recentes` : ""}</div>}
    {L && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
      {L.fotos.map((x) => <button key={x.id} type="button" onClick={() => setVer(x)} style={{ ...card, padding: 0, overflow: "hidden", cursor: "pointer", textAlign: "left", color: C.text }}>
        {x.url ? <img src={x.url} alt="" loading="lazy" style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} /> : <div style={{ height: 120, display: "grid", placeItems: "center", color: C.muted }}>sem link</div>}
        <div style={{ padding: "6px 8px", fontSize: 11.5 }}><div style={{ fontWeight: 700 }}>{x.referencia || x.modelo_nome}</div><div style={{ color: C.textSub }}>{quandoBR(x.tirada_em)} · {x.tecnico}</div></div></button>)}
    </div>}
    {ver && <div onClick={() => setVer(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 500, overflowY: "auto", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 10, color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><b>{ver.referencia || ver.modelo_nome} · {quandoBR(ver.tirada_em)}</b><div style={{ display: "flex", gap: 8 }}>{ver.url && <a href={ver.url} target="_blank" rel="noreferrer" download style={{ color: "#93c5fd" }}>⬇ Baixar</a>}<button type="button" onClick={() => setVer(null)} style={{ background: "none", border: "1px solid #fff", color: "#fff", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Fechar</button></div></div>
        {ver.url && <img src={ver.url} alt="" style={{ width: "100%", borderRadius: 6 }} />}
        <div style={{ fontSize: 12.5, display: "grid", gap: 3 }}>
          <div>{(ver.modelo?.campos || []).filter((c) => ver.valores?.[c.id]).map((c) => `${c.rotulo}: ${ver.valores[c.id]}${c.unidade ? ` ${c.unidade}` : ""}`).join(" · ") || "—"}</div>
          {ver.obs && <div>Obs.: {ver.obs}</div>}
          <div>👷 {ver.tecnico} · 📍 {ver.gps ? <a href={`https://maps.google.com/?q=${ver.gps.lat},${ver.gps.lng}`} target="_blank" rel="noreferrer" style={{ color: "#93c5fd" }}>{gpsTxt(ver.gps)}</a> : "sem GPS"}</div>
          <div style={{ color: "#94a3b8", wordBreak: "break-all" }}>SHA-256 {ver.hash}</div>
        </div></div></div>}
  </div>;
}

const CAMPO_VAZIO = { rotulo: "", tipo: "texto", opcoes: [], unidade: "", largura: 1, destaque: false };
function Modelos({ C, s, M, onMudou, setMsg }) {
  const [ed, setEd] = useState(null); const card = { ...s.card, padding: "14px 16px" }; const lab = { fontSize: 11.5, color: C.textSub, display: "block", marginBottom: 3 };
  const salvar = async () => { try { const r = ed.id ? await apiService.put(`/foto-cartao/modelos/${ed.id}`, ed) : await apiService.post("/foto-cartao/modelos", ed); setMsg(`Modelo "${r.modelo.nome}" salvo.`); setEd(null); onMudou(); } catch (e) { setMsg(`⚠ ${e?.response?.data?.erro || e.message}`); } };
  const doExemplo = async (k) => { try { const r = await apiService.post("/foto-cartao/modelos", { exemplo: k }); setMsg(`Modelo "${r.modelo.nome}" criado — ajuste os campos se quiser.`); onMudou(); setEd(r.modelo); } catch (e) { setMsg(`⚠ ${e?.response?.data?.erro || e.message}`); } };
  const campo = (i, k, v) => setEd({ ...ed, campos: ed.campos.map((c, j) => (j === i ? { ...c, [k]: v } : c)) });
  const mover = (i, d) => { const l = [...ed.campos]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; setEd({ ...ed, campos: l }); };
  if (ed) return <div style={{ ...card, display: "grid", gap: 12 }}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <div style={{ flex: "2 1 200px" }}><span style={lab}>NOME DO MODELO</span><input value={ed.nome || ""} onChange={(e) => setEd({ ...ed, nome: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>
      <div style={{ flex: "2 1 200px" }}><span style={lab}>TÍTULO NO CARTÃO</span><input value={ed.titulo || ""} onChange={(e) => setEd({ ...ed, titulo: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>
      <div style={{ flex: "1 1 140px" }}><span style={lab}>CÓDIGO DO FORMULÁRIO</span><input value={ed.codigo || ""} onChange={(e) => setEd({ ...ed, codigo: e.target.value })} placeholder="FO.QA…" style={{ ...s.input, width: "100%" }} /></div>
      <div style={{ flex: "0 1 80px" }}><span style={lab}>REVISÃO</span><input value={ed.revisao || ""} onChange={(e) => setEd({ ...ed, revisao: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>
    </div>
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ flex: "3 1 420px", display: "grid", gap: 6 }}>
        <span style={lab}>CAMPOS (o cabeçalho com logo e o rodapé técnico · data/hora · GPS entram sozinhos)</span>
        {ed.campos.map((c, i) => <div key={i} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", borderTop: `1px solid ${C.border}`, paddingTop: 6 }}>
          <input value={c.rotulo} onChange={(e) => campo(i, "rotulo", e.target.value)} placeholder="Rótulo" style={{ ...s.input, flex: "2 1 140px" }} />
          <select value={c.tipo} onChange={(e) => campo(i, "tipo", e.target.value)} style={{ ...s.input, flex: "1 1 110px" }}>{Object.entries(M.TIPOS || {}).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
          {c.tipo === "opcoes" && <input value={(c.opcoes || []).join("; ")} onChange={(e) => campo(i, "opcoes", e.target.value.split(";").map((x) => x.trimStart()))} placeholder="Opções separadas por ;" style={{ ...s.input, flex: "2 1 160px" }} />}
          <input value={c.unidade || ""} onChange={(e) => campo(i, "unidade", e.target.value)} placeholder="un." style={{ ...s.input, width: 56 }} />
          <select value={c.destaque ? "d" : String(c.largura || 1)} onChange={(e) => setEd({ ...ed, campos: ed.campos.map((x, j) => (j === i ? { ...x, destaque: e.target.value === "d", largura: e.target.value === "2" ? 2 : 1 } : x)) })} style={{ ...s.input, flex: "1 1 120px" }}><option value="1">Meia linha</option><option value="2">Linha inteira</option><option value="d">Caixa grande</option></select>
          <button type="button" onClick={() => mover(i, -1)} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 8px" }}>↑</button><button type="button" onClick={() => mover(i, 1)} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 8px" }}>↓</button>
          <button type="button" onClick={() => setEd({ ...ed, campos: ed.campos.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}>✕</button>
        </div>)}
        <button type="button" onClick={() => setEd({ ...ed, campos: [...ed.campos, { ...CAMPO_VAZIO }] })} style={{ ...s.btn(false), cursor: "pointer", justifySelf: "start" }}>＋ Campo</button>
        <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={ed.obs !== false} onChange={(e) => setEd({ ...ed, obs: e.target.checked })} /> Caixa de observações</label>
      </div>
      <div style={{ flex: "2 1 300px" }}><span style={lab}>PRÉVIA (valores de exemplo)</span><Previa modelo={{ ...ed, campos: ed.campos.filter((c) => c.rotulo).map((c, i) => ({ ...c, id: c.id || `p${i}`, largura: c.destaque ? 1 : c.largura })) }} largura={340} /></div>
    </div>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
      {ed.id && <button type="button" onClick={async () => { await apiService.post(`/foto-cartao/modelos/${ed.id}/ativo`, { ativo: ed.ativo === false }); setEd(null); onMudou(); }} style={{ ...s.btn(false), cursor: "pointer", marginRight: "auto" }}>{ed.ativo === false ? "Reativar" : "Desativar"}</button>}
      <button type="button" onClick={() => setEd(null)} style={{ ...s.btn(false), cursor: "pointer" }}>Voltar</button><button type="button" onClick={salvar} style={{ ...s.btn(true), cursor: "pointer" }}>Salvar modelo</button></div>
  </div>;
  return <div style={{ display: "grid", gap: 10 }}>
    <div style={{ ...card, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button type="button" onClick={() => setEd({ nome: "", titulo: "", codigo: "", revisao: "", obs: true, campos: [{ ...CAMPO_VAZIO }] })} style={{ ...s.btn(true), cursor: "pointer" }}>＋ Novo modelo</button>
      <span style={{ fontSize: 12.5, color: C.textSub }}>ou comece de um exemplo:</span>
      {(M.exemplos || []).map((x) => <button key={x.chave} type="button" onClick={() => doExemplo(x.chave)} style={{ ...s.btn(false), cursor: "pointer" }}>{x.nome}</button>)}
    </div>
    {(M.modelos || []).map((m) => <button key={m.id} type="button" onClick={() => setEd({ ...m, campos: m.campos.map((c) => ({ ...c })) })} style={{ ...card, textAlign: "left", cursor: "pointer", color: C.text, opacity: m.ativo === false ? 0.55 : 1, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{m.nome}{m.ativo === false ? " (desativado)" : ""}</div><div style={{ fontSize: 12, color: C.textSub }}>{m.titulo}{m.codigo ? ` · ${m.codigo}` : ""}{m.revisao ? ` rev. ${m.revisao}` : ""} · {m.campos.length} campos</div></div><span style={{ color: C.textSub }}>✎</span></button>)}
  </div>;
}
