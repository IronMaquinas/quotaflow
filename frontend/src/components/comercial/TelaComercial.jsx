// components/comercial/TelaComercial.jsx — etapa 15a
// 📈 Comercial — mini-CRM dentro do QuotaFlow (inspirado em RD Station CRM / Pipedrive / HubSpot), ver: admin, gestor, comercial.
//   📊 Funil     — indicadores (em aberto, ganhos, conversão, ticket médio, tempo até o aceite) + 15b: envio → visualização →
//                  resposta, taxa de abertura, abertos sem resposta. KANBAN por fase — 15b: a fase muda pelo CLIENTE; o cartão só
//                  é arrastado para Perdido (pede o motivo). Cartão com ✓ / ✓✓ e alertas. ⏰ tarefas e motivos de perda do período.
//   📝 BIDs      — lista com busca e filtro por fase. ＋ Novo BID: cliente (CNPJ primeiro — mesmo cadastro dos contratos) + modelo.
//   👥 Clientes  — mesmo cadastro de 📑 Contratos (por /comercial/clientes); clicar abre a ficha 360° (BIDs, contratos, atividades).
//   🧩 Modelos   — modelos de BID (biblioteca do QuotaFlow → cópia da empresa).
//   🧾 Pedidos   — 15c: PV-AAAA-NNNN, nasce sozinho no aceite (aviso "🎉 Novos pedidos" no Funil); status por item; ➕ aditivo pelo link.
import { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";
import FichaBid, { FASES, COR_FASE, NOME_FASE, MOTIVOS, MOTIVOS_MANUAIS, brl } from "./FichaBid";
import FichaPedido, { STATUS_PV, STATUS_ITEM } from "./FichaPedido"; // 15c
import ModelosBid from "./ModelosBid";
import { AbaClientes, CampoDocumento, NotaReceita, CamposCliente, vazioCliente, mascaraDoc } from "../contratos/Clientes";

const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "");
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");
const compacto = (v) => (v == null ? "—" : v >= 1e6 ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : v >= 1e4 ? `R$ ${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil` : brl(v));
const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const mesNome = (ym) => { const [a, m] = String(ym || "").split("-"); return `${["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"][Number(m) - 1] || ""}/${a || ""}`; };
const haQuanto = (iso) => { if (!iso) return ""; const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000)); return m < 60 ? `há ${Math.max(1, m)} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`; };
const tempo = (h) => (h == null ? "—" : h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${String(Math.round(h * 10) / 10).replace(".", ",")} h` : `${String(Math.round((h / 24) * 10) / 10).replace(".", ",")} dias`);
const menosDias = (n) => new Date(Date.now() - 3 * 3600000 - n * 86400000).toISOString().slice(0, 10);
const casca = (s, conteudo, fechar, largura = 640, z = 320) => (
  <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: z, padding: 16, overflowY: "auto" }} onClick={fechar}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: largura, maxWidth: "100%", padding: "18px 20px", margin: "auto 0", boxShadow: "0 24px 48px #00000060" }}>{conteudo}</div>
  </div>
);

function Kpi({ C, s, rotulo, valor, sub, cor }) {
  return <div style={{ ...s.card, padding: "12px 14px", flex: "1 1 150px", minWidth: 0 }}>
    <div style={{ fontSize: 10.5, color: C.muted, letterSpacing: ".06em" }}>{rotulo}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color: cor || C.text, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{valor}</div>
    {sub && <div style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>{sub}</div>}
  </div>;
}

function CartaoBid({ C, s, b, onAbrir, arrastavel }) {
  const cor = COR_FASE[b.fase]; const parado = ["aguardando_cliente", "aguardando_aceite"].includes(b.fase) && b.dias_na_fase > 7;
  const comCliente = ["aguardando_cliente", "aguardando_aceite"].includes(b.fase); const alerta = (b.alertas || [])[0];
  const t = b.proxima_tarefa; const atrasada = t?.prevista_para && t.prevista_para < new Date().toISOString();
  return (
    <div draggable={arrastavel} onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(b.id)); e.dataTransfer.effectAllowed = "move"; }} onClick={() => onAbrir(b.id)} className="qf-clicavel"
      style={{ ...s.card, background: C.bg, padding: "9px 10px", marginBottom: 7, borderLeft: `3px solid ${cor}`, textDecoration: "none" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}><span style={{ fontSize: 10.5, color: C.muted, flex: 1 }}>{b.numero}{b.referencia ? ` · ${b.referencia}` : ""}</span>
        <span style={{ fontSize: 10.5, color: parado ? C.danger : C.muted, fontWeight: parado ? 700 : 400 }} title="dias nesta fase">{b.dias_na_fase} d</span></div>
      <div style={{ fontSize: 13, fontWeight: 600, margin: "2px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.cliente_nome}</div>
      {b.titulo && <div style={{ fontSize: 11, color: C.textSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.titulo}</div>}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}><b style={{ fontSize: 12.5, flex: 1 }}>{brl(b.valor_total)}</b>
        {b.expirado && <span title="validade vencida" style={{ fontSize: 11 }}>⌛</span>}<span style={{ fontSize: 10.5, color: C.muted }}>{(b.responsavel_nome || "").split(" ")[0]}</span></div>
      {/* 15b.4: decisão esperada */}
      {b.previsao_fechamento && !["aceito", "perdido"].includes(b.fase) && <div style={{ fontSize: 10.5, marginTop: 3, color: b.previsao_fechamento < hoje() ? C.danger : C.textSub }} title="Decisão esperada do cliente">📅 decisão {b.previsao_fechamento < hoje() ? "esperada em" : ""} {dBR(b.previsao_fechamento)}{b.previsao_fechamento < hoje() ? " — passou" : ""}</div>}
      {/* 15b.2: status do cliente no próprio cartão, como na Não Conformidade (📤 enviada / 👁 visualizada) */}
      {(() => {
        const chip = (cor, txt, title) => <div style={{ marginTop: 5 }}><span title={title} style={{ ...s.tag(cor), fontSize: 10, letterSpacing: 0 }}>{txt}</span></div>;
        if (b.em_revisao) return chip(C.warn, `✏ Preparando a v${(b.versao_atual || 0) + 1}`, `O cliente continua vendo a v${b.versao_enviada}`);
        if (b.fase === "aguardando_cliente") return b.visto_primeiro_em
          ? chip(C.accent, `👁 Visualizado pelo cliente${b.visto_qtd > 1 ? ` · ${b.visto_qtd}×` : ""} · ${haQuanto(b.visto_ultimo_em)}`, `Aberto ${b.visto_qtd}× — 1ª vez ${dataHora(b.visto_primeiro_em)}, última ${dataHora(b.visto_ultimo_em)}`)
          : chip(C.warn, `📤 Enviado · ainda não aberto · ${haQuanto(b.enviado_em)}`, `v${b.versao_enviada} enviada em ${dataHora(b.enviado_em)} para ${b.envio_para || ""}`);
        if (b.fase === "revisao_solicitada") return chip(C.warn, `💬 Cliente pediu revisão · ${haQuanto(b.respondido_em)}`);
        if (b.fase === "aguardando_aceite") return chip("#a78bfa", "✅ Aprovado · falta assinar o aceite");
        return null;
      })()}
      {alerta && <div style={{ fontSize: 10.5, color: alerta.tipo === "vencido" ? C.danger : C.warn, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>⚠ {alerta.texto}</div>}
      {t && <div style={{ fontSize: 10.5, color: atrasada ? C.danger : C.textSub, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>⏰ {dBR(t.prevista_para?.slice(0, 10))} {t.texto}</div>}
      {b.fase === "perdido" && b.motivo_perda && <div style={{ fontSize: 10.5, color: C.danger, marginTop: 3 }}>{MOTIVOS[b.motivo_perda]}</div>}
    </div>
  );
}

function NovoBid({ C, s, clienteInicial, onCriado, onCancelar, onErro }) {
  const [modelos, setModelos] = useState(null); const [resp, setResp] = useState([]);
  const [doc, setDoc] = useState(""); const [res, setRes] = useState(null); const [cli, setCli] = useState(vazioCliente()); const [semDoc, setSemDoc] = useState(false);
  const [escolhido, setEscolhido] = useState(clienteInicial || null);
  const [f, setF] = useState({ modelo_id: "", referencia: "", titulo: "", responsavel_id: "", previsao_fechamento: "" });
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    apiService.get("/comercial/modelos").then((r) => { setModelos(r.modelos || []); if (r.modelos?.length === 1) setF((x) => ({ ...x, modelo_id: r.modelos[0].id })); }).catch((e) => onErro(e.message));
    apiService.get("/comercial/responsaveis").then((r) => { setResp(r.responsaveis || []); setF((x) => ({ ...x, responsavel_id: r.responsaveis?.some((u) => String(u.id) === String(r.eu)) ? r.eu : "" })); }).catch(() => {});
  }, []); // eslint-disable-line
  const aoBuscar = (r) => { setRes(r); if (r.existente) setEscolhido(r.cliente); else setCli({ ...vazioCliente(), ...Object.fromEntries(Object.entries(r.cliente || {}).map(([a, b]) => [a, b ?? ""])) }); };
  const pronto = (escolhido || ((res || semDoc) && cli.nome.trim())) && f.modelo_id;
  const criar = async () => {
    setOcupado(true);
    try {
      let c = escolhido;
      if (!c) { const { id, ...corpo } = cli; const r = await apiService.post("/comercial/clientes", { ...corpo, documento: semDoc ? null : cli.documento || doc }); c = r.cliente; } // eslint-disable-line no-unused-vars
      const r = await apiService.post("/comercial/bids", { ...f, cliente_id: c.id, responsavel_id: f.responsavel_id || undefined, previsao_fechamento: f.previsao_fechamento || null });
      onCriado(r.bid);
    } catch (e) { onErro(e.message); } finally { setOcupado(false); }
  };
  if (!modelos) return <div style={{ color: C.muted }}>Carregando…</div>;
  return (<>
    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>＋ Novo BID</div>
    {!modelos.length && <div style={{ ...s.card, padding: 12, borderColor: C.warn, fontSize: 13, color: C.warn, marginBottom: 10 }}>Nenhum modelo de BID ainda — vá em 🧩 Modelos e importe o “Transporte de equipamentos” da biblioteca.</div>}
    {escolhido ? <div style={{ ...s.card, padding: 12, borderColor: C.success, display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1 }}><div style={{ color: C.success, fontWeight: 700, fontSize: 12 }}>✓ Cliente</div><div style={{ fontWeight: 600 }}>{escolhido.nome}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{escolhido.documento ? mascaraDoc(escolhido.documento) : "sem CNPJ/CPF"}{escolhido.cidade ? ` · ${escolhido.cidade}/${escolhido.uf || ""}` : ""}</div></div>
        {!clienteInicial && <button type="button" onClick={() => { setEscolhido(null); setRes(null); setDoc(""); }} style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer" }}>trocar</button>}
      </div> : <>
        {!semDoc && <CampoDocumento C={C} s={s} base="/comercial" valor={doc} onValor={(v) => { setDoc(v); setRes(null); }} onResultado={aoBuscar} onErro={onErro} autoFocus />}
        {!res && !semDoc && <button type="button" onClick={() => { setSemDoc(true); setCli(vazioCliente()); }} style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", padding: "6px 0" }}>Cliente sem CNPJ/CPF? Preencher na mão ›</button>}
        {res && !res.existente && <NotaReceita C={C} r={res} doc={doc} />}
        {((res && !res.existente) || semDoc) && <div style={{ marginTop: 10 }}><CamposCliente C={C} s={s} c={cli} setC={setCli} /></div>}
      </>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
      <label style={{ flex: "2 1 220px" }}><span style={s.label}>MODELO</span><select value={f.modelo_id} onChange={(e) => setF({ ...f, modelo_id: e.target.value })} style={s.input}><option value="">—</option>{modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></label>
      <label style={{ flex: "1 1 140px" }}><span style={s.label}>REFERÊNCIA DO CLIENTE</span><input value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })} placeholder="PC 551" style={s.input} /></label>
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
      <label style={{ flex: "2 1 220px" }}><span style={s.label}>TÍTULO DA PROPOSTA</span><input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Transporte de 2 retroescavadeiras ES → MT" style={s.input} /></label>
      <label style={{ flex: "1 1 160px" }}><span style={s.label}>RESPONSÁVEL</span><select value={f.responsavel_id} onChange={(e) => setF({ ...f, responsavel_id: e.target.value })} style={s.input}><option value="">eu</option>{resp.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></label>
      <label style={{ flex: "1 1 150px" }} title="Quando você espera que o cliente decida (aceite ou recuse) — entra na previsão de receita do Funil"><span style={s.label}>DECISÃO ESPERADA EM</span><input type="date" value={f.previsao_fechamento} onChange={(e) => setF({ ...f, previsao_fechamento: e.target.value })} style={s.input} /></label>
    </div>
    <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
      <button type="button" onClick={onCancelar} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
      <button type="button" disabled={ocupado || !pronto} onClick={criar} style={{ ...s.btn(!ocupado && !!pronto, C.accent), flex: 1 }}>Criar BID</button>
    </div>
  </>);
}

function Cliente360({ C, s, id, onFechar, onAbrirBid, onNovoBid, onEditar, onErro, onAbrirPV }) {
  const [d, setD] = useState(null); const [a, setA] = useState({ tipo: "nota", texto: "" }); const [ocupado, setOcupado] = useState(false);
  const carregar = () => apiService.get(`/comercial/clientes/${id}/360`).then(setD).catch((e) => { onErro(e.message); onFechar(); });
  useEffect(() => { carregar(); }, [id]); // eslint-disable-line
  if (!d) return null;
  const c = d.cliente; const r = d.resumo;
  const registrar = async () => { setOcupado(true); try { await apiService.post("/comercial/atividades", { ...a, cliente_id: c.id }); setA({ ...a, texto: "" }); await carregar(); } catch (e) { onErro(e.message); } finally { setOcupado(false); } };
  return casca(s, <>
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
      <div style={{ flex: 1 }}><div style={{ fontSize: 17, fontWeight: 800 }}>{c.nome}</div>
        <div style={{ fontSize: 12, color: C.textSub }}>{c.razao_social && c.razao_social !== c.nome ? `${c.razao_social} · ` : ""}{c.documento ? mascaraDoc(c.documento) : "sem CNPJ/CPF"}{c.cidade ? ` · ${c.cidade}/${c.uf || ""}` : ""}</div>
        <div style={{ fontSize: 12, color: C.textSub }}>{[c.contato_nome, c.contato_email, c.contato_telefone].filter(Boolean).join(" · ")}</div></div>
      <button type="button" onClick={() => onEditar(c.id)} style={{ ...s.btn(true, C.accent), background: "transparent", color: C.accent, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>✏ Editar cadastro</button>
      <button type="button" onClick={() => onNovoBid(c)} style={{ ...s.btn(true, C.accent), padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>＋ Novo BID</button>
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      <Kpi C={C} s={s} rotulo="EM ABERTO" valor={compacto(r.em_aberto)} sub={`${r.abertos} BID(s)`} />
      <Kpi C={C} s={s} rotulo="GANHO" valor={compacto(r.valor_ganho)} sub={`${r.ganhos} aceito(s) · ${r.perdidos} perdido(s)`} cor={C.success} />
      <Kpi C={C} s={s} rotulo="CONTRATOS ATIVOS" valor={r.contratos_ativos} sub={`${d.contratos.length} no total`} />
    </div>
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
      <div style={{ flex: "3 1 360px", minWidth: 0 }}>
        <div style={s.label}>BIDS</div>
        {d.bids.map((b) => <div key={b.id} onClick={() => onAbrirBid(b.id)} className="qf-clicavel" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, padding: "7px 0", borderBottom: `1px solid ${C.border}`, textDecoration: "none" }}>
          <span style={{ ...s.tag(COR_FASE[b.fase]) }}>{NOME_FASE[b.fase]}</span><span style={{ flex: 1 }}>{b.numero}{b.referencia ? ` · ${b.referencia}` : ""}{b.titulo ? ` — ${b.titulo}` : ""}</span><b>{brl(b.valor_total)}</b></div>)}
        {!d.bids.length && <div style={{ fontSize: 12, color: C.muted }}>Nenhum BID ainda.</div>}
        {(d.pedidos || []).length > 0 && <><div style={{ ...s.label, marginTop: 14 }}>PEDIDOS DE VENDA</div>
          {d.pedidos.map((p) => <div key={p.id} onClick={() => onAbrirPV?.(p.id)} className="qf-clicavel" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, padding: "7px 0", borderBottom: `1px solid ${C.border}`, textDecoration: "none" }}>
            <span style={s.tag(STATUS_PV[p.status]?.[1])}>{STATUS_PV[p.status]?.[0]}</span><span style={{ flex: 1 }}>🧾 {p.numero}{p.titulo ? ` — ${p.titulo}` : ""}</span><b>{brl(p.valor_total)}</b></div>)}</>}
        {d.contratos.length > 0 && <><div style={{ ...s.label, marginTop: 14 }}>CONTRATOS DE LOCAÇÃO</div>
          {d.contratos.map((k) => <div key={k.id} style={{ fontSize: 12.5, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}><span style={s.tag(k.status === "ativo" ? C.success : C.muted)}>{k.status}</span> {k.numero}{k.local ? ` · ${k.local}` : ""} · {dBR(k.inicio)}{k.fim_previsto ? ` → ${dBR(k.fim_previsto)}` : ""}</div>)}</>}
      </div>
      <div style={{ flex: "2 1 260px", minWidth: 0 }}>
        <div style={s.label}>ATIVIDADES</div>
        <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>{[["nota", "📝 Nota"], ["ligacao", "📞 Ligação"], ["email", "✉ E-mail"], ["reuniao", "🤝 Reunião"]].map(([k, l]) => <button key={k} type="button" onClick={() => setA({ ...a, tipo: k })} style={{ ...s.tag(a.tipo === k ? C.accent : C.muted), cursor: "pointer", padding: "3px 7px" }}>{l}</button>)}</div>
        <div style={{ display: "flex", gap: 6 }}><input value={a.texto} onChange={(e) => setA({ ...a, texto: e.target.value })} placeholder="O que aconteceu" style={{ ...s.input, fontSize: 12 }} />
          <button type="button" disabled={ocupado || !a.texto.trim()} onClick={registrar} style={{ ...s.btn(!ocupado && !!a.texto.trim(), C.accent), padding: "6px 10px", fontSize: 12 }}>OK</button></div>
        <div style={{ maxHeight: 320, overflowY: "auto", marginTop: 6 }}>{d.atividades.map((x) => <div key={x.id} style={{ fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${C.border}`, color: x.tipo === "evento" ? C.muted : C.text }}>
          {x.texto}<div style={{ fontSize: 10.5, color: C.muted }}>{dataHora(x.criado_em)}{x.usuario_nome ? ` · ${x.usuario_nome}` : ""}</div></div>)}</div>
      </div>
    </div>
    <button type="button" onClick={onFechar} style={{ ...s.btn(false), cursor: "pointer", width: "100%", color: C.text, marginTop: 14 }}>Fechar</button>
  </>, onFechar, 900);
}

export default function TelaComercial({ C, s }) {
  const [aba, setAba] = useState("funil");
  const [bids, setBids] = useState(null);
  const [funil, setFunil] = useState(null);
  const [tarefas, setTarefas] = useState([]);
  const [soMinhas, setSoMinhas] = useState(true);
  const [periodo, setPeriodo] = useState({ de: menosDias(89), ate: hoje() });
  const [busca, setBusca] = useState(""); const [filtroFase, setFiltroFase] = useState("abertos");
  const [pedidos, setPedidos] = useState(null); const [pvAberto, setPvAberto] = useState(null); // 15c
  const [aberto, setAberto] = useState(null); const [novo, setNovo] = useState(null); const [c360, setC360] = useState(null); const [editarCli, setEditarCli] = useState(null);
  const [arrasto, setArrasto] = useState(null); // { id, fase } para perdido/aceito
  const [msg, setMsg] = useState(null); const [ocupado, setOcupado] = useState(false);
  const erro = (t) => setMsg(t ? { tipo: "erro", t } : null); const ok = (t) => setMsg({ tipo: "ok", t });

  const carregar = async () => {
    try {
      const [b, fu, ts, pv] = await Promise.all([apiService.get("/comercial/bids"), apiService.get("/comercial/funil", periodo), apiService.get("/comercial/tarefas", soMinhas ? { minhas: "1" } : {}), apiService.get("/comercial/pvs").catch(() => ({ pedidos: [] }))]);
      setBids(b.bids || []); setFunil(fu); setTarefas(ts.tarefas || []); setPedidos(pv.pedidos || []);
    } catch (e) { erro(e.message); }
  };
  useEffect(() => { carregar(); }, [periodo.de, periodo.ate, soMinhas]); // eslint-disable-line
  useEffect(() => { if (!msg || msg.tipo !== "ok") return undefined; const t = setTimeout(() => setMsg(null), 4000); return () => clearTimeout(t); }, [msg]);

  const mover = async (id, fase, extra = {}) => {
    const b = (bids || []).find((x) => String(x.id) === String(id)); if (!b || b.fase === fase) return;
    // 15b: a fase muda sozinha pelo que o cliente faz no link — arrastar, só para Perdido
    if (fase !== "perdido") return erro("A fase muda sozinha, pelo que o cliente faz no link. Para enviar, abra o BID → 📨 Revisar e enviar. Arrastar, só para Perdido.");
    if (["aceito", "perdido"].includes(b.fase)) return erro("BID fechado — abra a ficha e use ↺ Reabrir.");
    if (!extra.confirmado) return setArrasto({ id, fase, motivo: "", obs: "", b });
    setOcupado(true);
    try { await apiService.post(`/comercial/bids/${id}/fase`, { fase, motivo: extra.motivo, obs: extra.obs }); setArrasto(null); ok(`${b.numero} → ${NOME_FASE[fase]}`); await carregar(); }
    catch (e) { erro(e.message); } finally { setOcupado(false); }
  };
  const concluir = async (t) => { try { await apiService.post(`/comercial/atividades/${t.id}/concluir`, {}); await carregar(); } catch (e) { erro(e.message); } };

  const listaVisivel = useMemo(() => (bids || []).filter((b) => (filtroFase === "todos" || (filtroFase === "abertos" ? !["aceito", "perdido"].includes(b.fase) : b.fase === filtroFase))
    && (!busca.trim() || semAcento(`${b.numero} ${b.cliente_nome} ${b.referencia || ""} ${b.titulo || ""} ${b.responsavel_nome || ""}`).includes(semAcento(busca.trim())))), [bids, busca, filtroFase]);

  const k = funil?.kpis || {};
  const abaBt = (id, l) => <button key={id} type="button" onClick={() => setAba(id)} style={{ background: "transparent", border: "none", borderBottom: `2px solid ${aba === id ? C.accent : "transparent"}`, padding: "8px 12px", color: aba === id ? C.text : C.muted, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>;
  const maxMotivo = Math.max(1, ...(funil?.motivos || []).map((m) => m.qtd));
  // kanban: perdidos e aceitos só do período (o resto sempre)
  const diaBR = (iso) => new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10); // 15b.1: dia em Brasília
  const noPeriodo = (iso) => !!iso && diaBR(iso) >= periodo.de && diaBR(iso) <= periodo.ate;
  const daColuna = (fase) => (bids || []).filter((b) => b.fase === fase && (fase === "aceito" ? noPeriodo(b.ganho_em) : fase === "perdido" ? noPeriodo(b.perdido_em) : true));

  return (
    <div style={{ padding: "22px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <div style={{ fontSize: 20, fontWeight: 800, flex: 1 }}>📈 Comercial</div>
        <button type="button" onClick={() => setNovo({})} style={{ ...s.btn(true, C.accent), cursor: "pointer" }}>＋ Novo BID</button>
      </div>
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 14, flexWrap: "wrap" }}>
        {abaBt("funil", "📊 Funil")}{abaBt("bids", "📝 BIDs")}{abaBt("clientes", "👥 Clientes")}{abaBt("pedidos", `🧾 Pedidos${(pedidos || []).filter((p) => ["aberto", "em_execucao"].includes(p.status)).length ? ` (${pedidos.filter((p) => ["aberto", "em_execucao"].includes(p.status)).length})` : ""}`)}{abaBt("modelos", "🧩 Modelos de BID")}
      </div>
      {msg && <div style={{ ...s.card, padding: "9px 12px", marginBottom: 12, fontSize: 13, borderColor: msg.tipo === "erro" ? C.danger : C.success, color: msg.tipo === "erro" ? C.danger : C.success, display: "flex" }}>
        <span style={{ flex: 1 }}>{msg.t}</span><button type="button" onClick={() => setMsg(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}>×</button></div>}

      {aba === "funil" && (pedidos || []).filter((p) => Date.now() - new Date(p.criado_em) < 3 * 86400000).map((p) => (
        <div key={p.id} style={{ ...s.card, padding: "10px 14px", marginBottom: 10, borderColor: C.success, background: `${C.success}12`, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, fontSize: 13 }}>🎉 <b>{p.bid_numero} aceito!</b> O pedido <b>{p.numero}</b> foi gerado: {p.cliente_nome} · <b>{brl(p.valor_total)}</b> · {p.qtd_itens} item(ns). Próximo passo: programar a execução.</div>
          <button type="button" onClick={() => setPvAberto(p.id)} style={{ ...s.btn(true, C.success), padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>Abrir o pedido</button>
        </div>))}
      {aba === "funil" && (!funil ? <div style={{ color: C.muted }}>Carregando…</div> : <>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap", fontSize: 12, color: C.textSub }}>
          Período <input type="date" value={periodo.de} onChange={(e) => e.target.value && setPeriodo({ ...periodo, de: e.target.value })} style={{ ...s.input, width: 150, padding: "6px 8px" }} />
          até <input type="date" value={periodo.ate} onChange={(e) => e.target.value && setPeriodo({ ...periodo, ate: e.target.value })} style={{ ...s.input, width: 150, padding: "6px 8px" }} />
          <span style={{ color: C.muted }}>(ganhos, perdidos e conversão; o que está em aberto é sempre o atual)</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <Kpi C={C} s={s} rotulo="EM ABERTO NO FUNIL" valor={compacto(k.em_aberto)} sub={`${k.qtd_aberto} BID(s)${k.parados ? ` · ${k.parados} parado(s) +7 d` : ""}${k.expirados ? ` · ${k.expirados} vencido(s)` : ""}`} />
          <Kpi C={C} s={s} rotulo="GANHO NO PERÍODO" valor={compacto(k.valor_ganho)} sub={`${k.ganhos} aceito(s)`} cor={C.success} />
          <Kpi C={C} s={s} rotulo="CONVERSÃO" valor={k.conversao_pct == null ? "—" : `${String(k.conversao_pct).replace(".", ",")}%`} sub={`${k.ganhos} ganho(s) × ${k.perdidos} perdido(s)`} />
          <Kpi C={C} s={s} rotulo="TICKET MÉDIO" valor={compacto(k.ticket_medio)} sub="dos aceitos no período" />
          <Kpi C={C} s={s} rotulo="TEMPO ATÉ O ACEITE" valor={k.dias_ate_aceite == null ? "—" : `${k.dias_ate_aceite} dias`} sub="da criação ao aceite" />
        </div>
        {funil.previsao && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <Kpi C={C} s={s} rotulo={`PREVISTO PARA FECHAR EM ${mesNome(funil.previsao.mes)}`} valor={compacto(funil.previsao.este_mes.valor)} sub={`${funil.previsao.este_mes.qtd} BID(s) com decisão esperada no mês`} cor={C.accent} />
          <Kpi C={C} s={s} rotulo={`PREVISTO PARA ${mesNome(funil.previsao.proximo_mes)}`} valor={compacto(funil.previsao.proximo.valor)} sub={`${funil.previsao.proximo.qtd} BID(s)`} />
          <Kpi C={C} s={s} rotulo="DECISÃO ESPERADA JÁ PASSOU" valor={compacto(funil.previsao.atrasados.valor)} sub={`${funil.previsao.atrasados.qtd} BID(s) — atualizar a data ou ligar`} cor={funil.previsao.atrasados.qtd ? C.danger : undefined} />
          <Kpi C={C} s={s} rotulo="SEM DATA DE DECISÃO" valor={compacto(funil.previsao.sem_data.valor)} sub={`${funil.previsao.sem_data.qtd} BID(s) em aberto sem previsão`} cor={funil.previsao.sem_data.qtd ? C.warn : undefined} />
        </div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <Kpi C={C} s={s} rotulo="TAXA DE ABERTURA" valor={k.taxa_abertura_pct == null ? "—" : `${String(k.taxa_abertura_pct).replace(".", ",")}%`} sub={`${k.abertas || 0} de ${k.enviadas || 0} versão(ões) enviada(s)`} />
          <Kpi C={C} s={s} rotulo="ENVIO → VISUALIZAÇÃO" valor={tempo(k.horas_ate_ver)} sub="tempo médio até o cliente abrir" />
          <Kpi C={C} s={s} rotulo="VISUALIZAÇÃO → RESPOSTA" valor={tempo(k.horas_ate_responder)} sub="tempo médio até responder" />
        </div>

        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, alignItems: "flex-start" }}>
          {FASES.map(([fase, nome, cor]) => { const l = daColuna(fase); const col = funil.colunas.find((c) => c.fase === fase) || {};
            const valor = l.reduce((t, b) => t + Number(b.valor_total || 0), 0);
            return (
              <div key={fase} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }} onDrop={(e) => { e.preventDefault(); mover(e.dataTransfer.getData("text/plain"), fase); }}
                style={{ flex: "0 0 220px", ...s.card, padding: 8, minHeight: 200, borderTop: `3px solid ${cor}`, opacity: ocupado ? 0.7 : 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", marginBottom: 6, padding: "0 2px" }}><b style={{ fontSize: 12.5, flex: 1 }}>{nome}</b><span style={{ fontSize: 11, color: C.muted }}>{l.length}</span></div>
                <div style={{ fontSize: 11, color: C.textSub, marginBottom: 8, padding: "0 2px" }}>{compacto(valor)}{["aceito", "perdido"].includes(fase) ? " · no período" : ""}{col.qtd !== l.length ? ` (${col.qtd} no total)` : ""}</div>
                {l.map((b) => <CartaoBid key={b.id} C={C} s={s} b={b} onAbrir={setAberto} arrastavel={!["aceito", "perdido"].includes(b.fase)} />)}
                {!l.length && <div style={{ fontSize: 11, color: C.muted, textAlign: "center", padding: "16px 0" }}>{{ elaboracao: "＋ Novo BID começa aqui", aguardando_cliente: "BIDs enviados, esperando o cliente", revisao_solicitada: "o cliente pediu ajuste — sua vez", aguardando_aceite: "aprovado, falta o cliente assinar", aceito: "aceitos no período", perdido: "arraste para cá para marcar perdido" }[fase]}</div>}
              </div>); })}
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 14 }}>
          <div style={{ ...s.card, padding: 14, flex: "2 1 380px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}><b style={{ flex: 1, fontSize: 13 }}>⏰ Tarefas</b>
              <label style={{ fontSize: 12, color: C.textSub, display: "flex", gap: 4, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={soMinhas} onChange={(e) => setSoMinhas(e.target.checked)} /> só as minhas</label></div>
            {tarefas.map((t) => <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
              <input type="checkbox" onChange={() => concluir(t)} title="Concluir" style={{ marginTop: 3 }} />
              <div style={{ flex: 1, minWidth: 0 }}>{t.texto}<div style={{ fontSize: 11, color: t.atrasada ? C.danger : C.muted }}>{t.atrasada ? "atrasada · " : ""}{dBR(t.prevista_para?.slice(0, 10))}
                {t.bid_numero && <> · <button type="button" className="qf-clicavel" onClick={() => setAberto(t.bid_id)} style={{ background: "none", border: "none", color: C.textSub, padding: 0, fontSize: 11 }}>{t.bid_numero} {t.cliente_nome}</button></>}</div></div>
            </div>)}
            {!tarefas.length && <div style={{ fontSize: 12, color: C.muted }}>Nenhuma tarefa aberta{soMinhas ? " sua" : ""}. Crie na ficha do BID (⏰ Tarefa com data).</div>}
          </div>
          <div style={{ ...s.card, padding: 14, flex: "1 1 280px", minWidth: 0 }}>
            <b style={{ fontSize: 13 }}>✕ Motivos de perda no período</b>
            {(funil.motivos || []).map((m) => <div key={m.motivo} style={{ marginTop: 8 }}>
              <div style={{ display: "flex", fontSize: 12 }}><span style={{ flex: 1 }}>{m.nome}</span><span style={{ color: C.textSub }}>{m.qtd} · {compacto(m.valor)}</span></div>
              <div style={{ height: 6, background: C.bg, borderRadius: 3, marginTop: 3 }}><div style={{ height: 6, width: `${(m.qtd / maxMotivo) * 100}%`, background: C.danger, borderRadius: 3 }} /></div>
            </div>)}
            {!(funil.motivos || []).length && <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Nenhum BID perdido no período.</div>}
          </div>
        </div>
      </>)}

      {aba === "bids" && <>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Nº, cliente, referência, responsável…" style={{ ...s.input, maxWidth: 320 }} />
          <select value={filtroFase} onChange={(e) => setFiltroFase(e.target.value)} style={{ ...s.input, width: 190 }}>
            <option value="abertos">Em aberto</option>{FASES.map(([k2, l]) => <option key={k2} value={k2}>{l}</option>)}<option value="todos">Todos</option></select>
        </div>
        {!bids ? <div style={{ color: C.muted }}>Carregando…</div> : <div style={{ ...s.card, overflow: "hidden" }}>
          {listaVisivel.map((b, i) => <div key={b.id} onClick={() => setAberto(b.id)} className="qf-clicavel" style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: i < listaVisivel.length - 1 ? `1px solid ${C.border}` : "none", flexWrap: "wrap", textDecoration: "none" }}>
            <span style={{ ...s.tag(COR_FASE[b.fase]), minWidth: 92, textAlign: "center" }}>{NOME_FASE[b.fase]}</span>
            <div style={{ flex: "2 1 240px", minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{b.cliente_nome}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{b.numero}{b.referencia ? ` · ${b.referencia}` : ""}{b.titulo ? ` · ${b.titulo}` : ""} · {b.qtd_grupos} grupo(s), {b.qtd_itens} item(ns) · {b.versao_atual ? `v${b.versao_atual}` : "sem versão"}</div></div>
            <div style={{ fontSize: 12, color: C.textSub, flex: "1 1 120px" }}>{b.responsavel_nome || "—"}</div>
            <div style={{ fontSize: 11, color: b.expirado ? C.danger : C.muted, flex: "0 1 120px" }}>{b.valido_ate ? `${b.expirado ? "⌛ venceu" : "vale até"} ${dBR(b.valido_ate)}` : ""}</div>
            <b style={{ fontSize: 13, minWidth: 110, textAlign: "right" }}>{brl(b.valor_total)}</b>
          </div>)}
          {!listaVisivel.length && <div style={{ padding: 20, color: C.muted, textAlign: "center" }}>{(bids || []).length ? "Nenhum BID nesse filtro." : "Nenhum BID ainda — clique em ＋ Novo BID."}</div>}
        </div>}
      </>}

      {aba === "clientes" && <AbaClientes C={C} s={s} editar base="/comercial" onErro={erro} onOk={ok} onAbrir={(c) => setC360(c.id)} abrirId={editarCli} onAberto={() => setEditarCli(null)} />}
      {aba === "modelos" && <ModelosBid C={C} s={s} onErro={erro} onOk={ok} />}
      {aba === "pedidos" && (!pedidos ? <div style={{ color: C.muted }}>Carregando…</div> : <div style={{ ...s.card, overflow: "hidden" }}>
        {pedidos.map((p, i) => <div key={p.id} onClick={() => setPvAberto(p.id)} className="qf-clicavel" style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: i < pedidos.length - 1 ? `1px solid ${C.border}` : "none", flexWrap: "wrap", textDecoration: "none" }}>
          <span style={{ ...s.tag(STATUS_PV[p.status]?.[1]), minWidth: 84, textAlign: "center" }}>{STATUS_PV[p.status]?.[0]}</span>
          <div style={{ flex: "2 1 240px", minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13 }}>🧾 {p.numero} · {p.cliente_nome}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{p.titulo || p.bid_numero}{p.aditivo_atual ? ` · 📎 ${p.aditivo_atual} aditivo(s)` : ""} · {Object.entries(p.itens_por_status || {}).filter(([, n]) => n).map(([k, n]) => `${n} ${STATUS_ITEM[k]?.[0].toLowerCase()}`).join(" · ")}</div></div>
          <div style={{ fontSize: 11.5, color: C.textSub, flex: "1 1 180px" }}>{p.proximas?.[0] ? `📅 próxima: ${dBR(p.proximas[0].data)} · ${p.proximas[0].item}` : ""}</div>
          <b style={{ fontSize: 13, minWidth: 110, textAlign: "right" }}>{brl(p.valor_total)}</b>
        </div>)}
        {!pedidos.length && <div style={{ padding: 20, color: C.muted, textAlign: "center" }}>Nenhum pedido ainda — eles nascem sozinhos quando o cliente aceita um BID.</div>}
      </div>)}
      {pvAberto && <FichaPedido C={C} s={s} id={pvAberto} onFechar={() => { setPvAberto(null); carregar(); }} onMudou={carregar} onErro={erro} onOk={ok} onAbrirBid={(id) => { setPvAberto(null); setAberto(id); }} />}

      {novo && casca(s, <NovoBid C={C} s={s} clienteInicial={novo.cliente || null} onErro={erro} onCancelar={() => setNovo(null)}
        onCriado={async (b) => { setNovo(null); setC360(null); ok(`${b.numero} criado — preencha os itens e as condições.`); await carregar(); setAberto(b.id); }} />, () => setNovo(null), 720, 330)}
      {aberto && <FichaBid C={C} s={s} id={aberto} onFechar={() => { setAberto(null); carregar(); }} onMudou={carregar} onErro={erro} onOk={ok} onAbrirCliente={(cid) => { if (cid) { setAberto(null); setC360(cid); } }} onAbrirPV={(id) => { setAberto(null); setPvAberto(id); }} />}
      {c360 && <Cliente360 C={C} s={s} id={c360} onFechar={() => setC360(null)} onErro={erro} onAbrirBid={(id) => { setC360(null); setAberto(id); }}
        onNovoBid={(c) => setNovo({ cliente: c })} onAbrirPV={(id) => { setC360(null); setPvAberto(id); }} onEditar={(id) => { setC360(null); setAba("clientes"); setEditarCli(id); }} />}

      {arrasto && casca(s, <>
        {arrasto.fase === "perdido" ? <>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{arrasto.b.numero} — por que foi perdido?</div>
          {Object.entries(MOTIVOS_MANUAIS).map(([k2, l]) => <label key={k2} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "4px 0", cursor: "pointer" }}><input type="radio" checked={arrasto.motivo === k2} onChange={() => setArrasto({ ...arrasto, motivo: k2 })} /> {l}</label>)}
          <textarea value={arrasto.obs} onChange={(e) => setArrasto({ ...arrasto, obs: e.target.value })} rows={2} placeholder={arrasto.motivo === "outro" ? "Descreva o motivo (obrigatório)" : "Detalhe (opcional)"} style={{ ...s.input, marginTop: 8, resize: "vertical" }} />
        </> : <><div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Marcar {arrasto.b.numero} como aceito?</div>
          <div style={{ fontSize: 13, color: C.textSub }}>{arrasto.b.cliente_nome} · <b>{brl(arrasto.b.valor_total)}</b>. O documento fica travado (dá para reabrir na ficha).</div></>}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={() => setArrasto(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          <button type="button" disabled={ocupado || (arrasto.fase === "perdido" && (!arrasto.motivo || (arrasto.motivo === "outro" && !arrasto.obs.trim())))} onClick={() => mover(arrasto.id, arrasto.fase, { confirmado: true, motivo: arrasto.motivo, obs: arrasto.obs })}
            style={{ ...s.btn(!(arrasto.fase === "perdido" && (!arrasto.motivo || (arrasto.motivo === "outro" && !arrasto.obs.trim()))), arrasto.fase === "perdido" ? C.danger : C.success), flex: 1 }}>{arrasto.fase === "perdido" ? "Marcar como perdido" : "✓ Aceito"}</button>
        </div>
      </>, () => setArrasto(null), 460, 340)}
    </div>
  );
}
