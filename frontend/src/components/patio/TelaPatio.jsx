// components/patio/TelaPatio.jsx — etapas 18z/18z.1: 📦 propriedade do cliente (equipamento do cliente guardado no pátio)
//   Pré-entrada pelo XML da NF (suporte) → confirmação da chegada (pátio, no celular) → no pátio → saída.
//   Controlado pelo nº de série da plaqueta, com NF (leitor de código de barras da chave), fotos com tarja e saldo por cliente.
//   Não é estoque da empresa: não entra no valor do estoque. Feita para celular/tablet: em tela estreita os modais ocupam a tela toda.
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import { fotoComTarja } from "../ocorrencias/RegistrarOcorrencia";
import VerArquivo from "../programacao/VerArquivo";
import { LeitorCodigoBarras } from "../LeitorCodigoBarras";

const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const dBR = (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");
const vazioEntrada = () => ({ cliente_id: "", cliente_nome: "", descricao: "", fabricante: "", modelo: "", ano: "", numero_serie: "", identificacao: "", nf_entrada_numero: "", nf_entrada_chave: "", nf_entrada_data: "", entrada_em: hoje(), local_patio: "", recebido_por: "", obs: "" });
const vazioSaida = () => ({ saida_em: hoje(), retirado_por: "", retirado_documento: "", retirado_placa: "", nf_saida_numero: "", liberado_por: "", saida_obs: "" });
// chave de 44 dígitos: cUF(2) AAMM(4) CNPJ(14) mod(2) série(3) nNF(9) …
const daChave = (ch) => (ch.length === 44 ? { numero: String(Number(ch.slice(25, 34))), aamm: `${ch.slice(4, 6)}/20${ch.slice(2, 4)}` } : null);
const ROT_STATUS = { pre_entrada: "aguardando chegada", no_patio: "no pátio", saiu: "saiu" };

export default function TelaPatio({ C, s, usuario }) {
  const [d, setD] = useState(null); const [erro, setErro] = useState(null); const [msg, setMsg] = useState(null);
  const [status, setStatus] = useState("no_patio"); const [busca, setBusca] = useState(""); const [cliente, setCliente] = useState("");
  const [form, setForm] = useState(null); const [clientes, setClientes] = useState([]); const [salv, setSalv] = useState(false);
  const [det, setDet] = useState(null); const [saida, setSaida] = useState(null); const [chegada, setChegada] = useState(null); const [ver, setVer] = useState(null); const [subindo, setSubindo] = useState(false);
  const [xml, setXml] = useState(null); const [leitor, setLeitor] = useState(false); const [preDaNf, setPreDaNf] = useState([]); const [confExcluir, setConfExcluir] = useState(false);
  const [fotosPend, setFotosPend] = useState([]); const [confFoto, setConfFoto] = useState(null); // fotos tiradas antes de salvar (entrada/chegada) — sobem com a tarja depois de salvar
  const [estreito, setEstreito] = useState(() => typeof window !== "undefined" && window.innerWidth < 760);
  useEffect(() => { const f = () => setEstreito(window.innerWidth < 760); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const carregar = () => apiService.get("/patio", { status, busca, cliente }).then((r) => { setD(r); setErro(null); }).catch((e) => setErro(e.message));
  useEffect(() => { const t = setTimeout(carregar, busca ? 300 : 0); return () => clearTimeout(t); }, [status, busca, cliente]); // eslint-disable-line
  const ok = (t) => { setMsg(t); setTimeout(() => setMsg(null), 5000); };
  const abrir = (id) => apiService.get(`/patio/${id}`).then((r) => { setDet(r); setConfExcluir(false); }).catch((e) => setErro(e.message));
  const carregarClientes = () => { if (!clientes.length) apiService.get("/patio/clientes").then((r) => setClientes(r.clientes || [])).catch(() => {}); };
  const limparFotos = () => setFotosPend([]);
  const novaEntrada = () => { limparFotos(); setPreDaNf([]); setForm({ ...vazioEntrada(), recebido_por: usuario?.nome || "" }); carregarClientes(); };
  const enviarFotos = async (bem, fase, arquivos) => {
    let r = null;
    for (const f of arquivos) {
      const ft = await fotoComTarja(f, { oque: `${fase === "saida" ? "Saída" : "Entrada"} pátio`, ref: `${bem.numero}${bem.numero_serie ? ` · série ${bem.numero_serie}` : ""} · ${bem.cliente_nome}`, quem: usuario?.nome || "" });
      r = await apiService.post(`/patio/${bem.id}/fotos`, { fase, mime: ft.mime, base64: ft.base64 });
    }
    return r;
  };
  const salvarEntrada = async () => {
    setSalv(true);
    try {
      const r = await apiService.post("/patio", form); const pend = fotosPend.map((f) => f.file);
      setForm(null); carregar();
      if (pend.length) { setSubindo(true); try { await enviarFotos(r.bem, "entrada", pend); } catch (e) { setErro(`Entrada salva, mas falhou alguma foto: ${e.message}`); } finally { setSubindo(false); } }
      limparFotos(); ok(`✓ ${r.bem.numero} no pátio${pend.length ? ` com ${pend.length} foto(s)` : " — tire as fotos da chegada na ficha"}`); abrir(r.bem.id);
    } catch (e) { setErro(e.message); } finally { setSalv(false); }
  };
  const salvarSaida = async () => { setSalv(true); try { const r = await apiService.post(`/patio/${det.bem.id}/saida`, saida); setSaida(null); setDet(r); ok(`✓ Saída de ${r.bem.numero} registrada`); carregar(); } catch (e) { setErro(e.message); } finally { setSalv(false); } };
  const salvarChegada = async () => {
    setSalv(true);
    try {
      let r = await apiService.post(`/patio/${det.bem.id}/chegada`, chegada); const pend = fotosPend.map((f) => f.file);
      if (pend.length) { setSubindo(true); try { r = (await enviarFotos(r.bem, "entrada", pend)) || r; } catch (e) { setErro(`Chegada confirmada, mas falhou alguma foto: ${e.message}`); } finally { setSubindo(false); } }
      limparFotos(); setChegada(null); setDet(r); ok(`✓ Chegada de ${r.bem.numero} confirmada — está no pátio`); carregar();
    } catch (e) { setErro(e.message); } finally { setSalv(false); }
  };
  const excluirPre = async () => { setSalv(true); try { const r = await apiService.delete(`/patio/${det.bem.id}`); setDet(null); ok(`✓ Pré-entrada ${r.numero} excluída`); carregar(); } catch (e) { setErro(e.message); } finally { setSalv(false); setConfExcluir(false); } };
  const subirFotos = async (fase, files) => {
    const lista = Array.from(files || []); if (!lista.length) return; setSubindo(true);
    try { const r = await enviarFotos(det.bem, fase, lista); if (r) setDet(r); } catch (e) { setErro(e.message); } finally { setSubindo(false); }
  };
  // fotos antes de salvar: já comprimidas e com a tarja (o nº PAT entra ao salvar) — o funcionário confere como vai ficar
  const marcaPend = () => { const b = chegada && det ? det.bem : null; const serie = (chegada?.numero_serie || form?.numero_serie || "").trim().toUpperCase(); const cli = b ? b.cliente_nome : (form?.cliente_id ? (clientes.find((c) => String(c.id) === String(form.cliente_id))?.nome || "") : (form?.cliente_nome || ""));
    return { oque: "Entrada pátio", ref: [b ? b.numero : "nova entrada", serie && `série ${serie}`, cli].filter(Boolean).join(" · "), quem: usuario?.nome || "" }; };
  const addPend = async (l) => { const marca = marcaPend(); const novos = [];
    for (const file of l) { try { const ft = await fotoComTarja(file, marca); novos.push({ file, url: ft.dataUri }); } catch (e) { setErro(`${file.name}: ${e.message}`); } }
    setFotosPend((p) => [...p, ...novos].slice(0, 12)); };
  // leitor da chave (câmera ou leitor USB): preenche chave + nº da NF e procura pré-entrada da mesma NF
  const chaveLida = (ch) => {
    const info = daChave(ch); setForm((f) => ({ ...f, nf_entrada_chave: ch, nf_entrada_numero: f.nf_entrada_numero || info?.numero || "" }));
    apiService.get("/patio", { status: "pre_entrada", busca: ch }).then((r) => setPreDaNf((r.bens || []).filter((b) => b.nf_entrada_chave === ch))).catch(() => setPreDaNf([]));
  };
  // XML → pré-entrada
  const abrirXml = () => { setXml({ etapa: "arquivo" }); carregarClientes(); };
  const lerArquivoXml = async (file) => {
    if (!file) return; setSalv(true);
    try {
      const texto = await file.text(); const r = await apiService.post("/patio/xml", { xml: texto });
      setXml({ etapa: "conferir", ...r, cliente_id: r.cliente_sugerido ? String(r.cliente_sugerido.id) : "", cliente_nome: r.cliente_sugerido ? "" : (r.nf.destinatario_nome || ""), previsto_em: "", local_patio: "", mesmo_assim: false,
        itens: r.itens.map((i, k) => ({ ...i, _k: k, fabricante: "", modelo: i.codigo || "" })) });
    } catch (e) { setErro(e.message); } finally { setSalv(false); }
  };
  const setItem = (k, campo, v) => setXml((x) => ({ ...x, itens: x.itens.map((i) => (i._k === k ? { ...i, [campo]: v } : i)) }));
  const salvarXml = async () => {
    setSalv(true);
    try {
      const r = await apiService.post("/patio/pre-entradas", { cliente_id: xml.cliente_id || null, cliente_nome: xml.cliente_nome, nf: xml.nf, previsto_em: xml.previsto_em || null, local_patio: xml.local_patio, mesmo_assim: xml.mesmo_assim,
        itens: xml.itens.map(({ _k, series_achadas, codigo, ...i }) => i) });
      setXml(null); setStatus("pre_entrada"); ok(`✓ ${r.criados.length} pré-entrada(s) lançada(s) — ${r.criados.map((b) => b.numero).join(", ")}. A equipe do pátio confirma a chegada.`); carregar();
    } catch (e) { setErro(e.message); } finally { setSalv(false); }
  };

  const fs = estreito ? 16 : undefined; // 16px evita o zoom automático do iPhone ao tocar no campo
  const inp = { ...s.input, ...(fs ? { fontSize: fs, minHeight: 44 } : {}) };
  const lab = { fontSize: 11, color: C.muted, display: "block", marginBottom: 4, letterSpacing: "0.05em" };
  const grid2 = { display: "grid", gridTemplateColumns: estreito ? "1fr" : "1fr 1fr", gap: "2px 12px" };
  const btnG = (pri) => ({ ...s.btn(pri), padding: estreito ? "12px 16px" : "8px 16px", fontSize: estreito ? 15 : undefined });
  const fundo = (z, fechar) => ({ onClick: fechar, style: { position: "fixed", inset: 0, background: "#00000099", zIndex: z, display: "flex", alignItems: estreito ? "stretch" : "flex-start", justifyContent: "center", padding: estreito ? 0 : 16, overflowY: "auto" } });
  const caixa = (w) => ({ ...s.card, width: w, maxWidth: "100%", padding: estreito ? "16px 16px 0" : 20, marginTop: estreito ? 0 : 20, ...(estreito ? { borderRadius: 0, minHeight: "100%", border: "none" } : {}) });
  const rodape = { display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", ...(estreito ? { position: "sticky", bottom: 0, background: C.card || C.surface || "#111", padding: "12px 0 16px", borderTop: `1px solid ${C.border}`, marginTop: 8 } : { marginTop: 4 }) };
  const secao = (t, primeira) => <div style={{ gridColumn: "1 / -1", fontWeight: 700, fontSize: 13, color: C.text, margin: primeira ? "0 0 6px" : "12px 0 6px", paddingTop: primeira ? 0 : 10, borderTop: primeira ? "none" : `1px solid ${C.border}` }}>{t}</div>;
  const titulo = (t, fechar) => <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}><div style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>{t}</div>{fechar && <button type="button" onClick={fechar} aria-label="Fechar" style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer", padding: 4 }}>✕</button>}</div>;
  const campo = (st, setSt, k, rot, props = {}) => <div style={props.full ? { gridColumn: "1 / -1" } : undefined}><label style={lab}>{rot}</label><input value={st[k] || ""} onChange={(e) => setSt({ ...st, [k]: e.target.value })} style={inp} {...(props.type ? { type: props.type } : {})} {...(props.ph ? { placeholder: props.ph } : {})} {...(props.max ? { max: props.max } : {})} {...(props.im ? { inputMode: props.im } : {})} /></div>;
  const kpi = (rot, val, sub, cor, onClick) => <div onClick={onClick} role={onClick ? "button" : undefined} style={{ ...s.card, padding: "12px 16px", flex: estreito ? "1 1 140px" : "1 1 180px", cursor: onClick ? "pointer" : undefined }}><div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.06em" }}>{rot}</div><div style={{ fontSize: 24, fontWeight: 800, color: cor || C.text }}>{val}</div>{sub && <div style={{ fontSize: 12, color: C.textSub }}>{sub}</div>}</div>;
  const thumb = { width: estreito ? 84 : 92, height: estreito ? 64 : 70, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.border}` };
  const botaoFoto = (rot, onFiles, desab) => <label style={{ ...btnG(false), cursor: desab ? "wait" : "pointer", display: "inline-flex", alignItems: "center" }}>{rot}<input type="file" accept="image/jpeg,image/png" multiple capture="environment" disabled={desab} onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ""; onFiles(l); }} style={{ display: "none" }} /></label>;
  // fotos antes de salvar
  const FotosPendentes = () => <div style={{ gridColumn: "1 / -1", margin: "6px 0 8px" }}>
    <label style={lab}>📷 FOTOS DA CHEGADA (PLAQUETA, AVARIAS, ACESSÓRIOS) — PODE TIRAR AGORA OU DEPOIS</label>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {fotosPend.map((f, i) => <div key={f.url} style={{ position: "relative" }}><img src={f.url} alt={`Foto ${i + 1} — toque para ver`} onClick={() => setVer({ url: f.url, nome: `foto-${i + 1}.jpg`, mime: "image/jpeg" })} style={{ ...thumb, cursor: "zoom-in" }} />
        <button type="button" aria-label="Excluir esta foto" onClick={() => setConfFoto(f)} style={{ position: "absolute", top: -8, right: -8, width: 28, height: 28, borderRadius: 14, border: "none", background: C.danger, color: "#fff", cursor: "pointer", fontSize: 12 }}>✕</button></div>)}
      {botaoFoto(fotosPend.length ? "＋ Mais fotos" : "📷 Tirar / escolher fotos", addPend)}
    </div>
    {fotosPend.length > 0 && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>Toque na foto para conferir. Ao salvar, a tarja ganha o nº PAT.</div>}
  </div>;
  const Fotos = ({ fase, lista, podeAdd }) => <div style={{ marginTop: 6 }}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {lista.map((f, i) => f.url ? <img key={i} src={f.url} alt={`Foto ${i + 1}`} onClick={() => setVer({ url: f.url, nome: `${det.bem.numero}-${fase}-${i + 1}.jpg`, mime: "image/jpeg" })} style={{ ...thumb, cursor: "zoom-in" }} /> : null)}
      {podeAdd && botaoFoto(subindo ? "Enviando…" : "📷 Adicionar fotos", (l) => subirFotos(fase, l), subindo)}
      {!lista.length && !podeAdd && <span style={{ fontSize: 12, color: C.muted }}>Sem fotos.</span>}
    </div></div>;
  const tagStatus = (b) => b.status === "pre_entrada" ? <span style={s.tag(C.warn || "#f59e0b")}>aguardando chegada{b.previsto_em ? ` · prev. ${dBR(b.previsto_em)}` : ""}</span>
    : b.status === "no_patio" ? <span style={s.tag(C.accent)}>no pátio · {b.dias_no_patio} dia(s)</span> : <span style={s.tag(C.success)}>saiu {dBR(b.saida_em)}</span>;

  return <div style={{ padding: estreito ? "14px 12px" : "22px 24px", overflowY: "auto", height: "100%" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
      <div style={{ flex: "1 1 220px" }}><div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em" }}>PÁTIO</div><div style={{ fontSize: estreito ? 19 : 22, fontWeight: 700 }}>📦 Propriedade do cliente</div></div>
      <button type="button" onClick={abrirXml} style={{ ...btnG(false), flex: estreito ? "1 1 45%" : undefined }}>📄 Pré-entrada pelo XML</button>
      <button type="button" onClick={novaEntrada} style={{ ...btnG(true), flex: estreito ? "1 1 45%" : undefined }}>＋ Entrada no pátio</button>
    </div>
    {!estreito && <div style={{ fontSize: 13, color: C.textSub, marginBottom: 14 }}>Equipamento <b>do cliente</b> guardado no pátio (ex.: chegou do porto e espera a entrega). Não é estoque da empresa — controle pelo <b>nº de série da plaqueta</b>. O suporte lança a <b>pré-entrada pelo XML</b> e o pátio confirma a chegada.</div>}
    {msg && <div style={{ ...s.card, padding: 10, margin: "8px 0 12px", borderColor: C.success, color: C.success, fontSize: 13 }}>{msg}</div>}
    {erro && <div style={{ ...s.card, padding: 10, margin: "8px 0 12px", borderColor: C.danger, color: C.danger, fontSize: 13, display: "flex", gap: 8 }}><span style={{ flex: 1 }}>⚠ {erro}</span><button type="button" onClick={() => setErro(null)} aria-label="Fechar aviso" style={{ background: "none", border: "none", color: C.danger, cursor: "pointer" }}>✕</button></div>}
    {d?.sem_migration ? <div style={{ color: C.danger }}>Falta rodar as migrations 081 e 082 no Supabase.</div> : !d ? <div style={{ color: C.muted }}>Carregando…</div> : <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "8px 0 12px" }}>
        {(d.total_pre_entrada || 0) > 0 && kpi("AGUARDANDO CHEGADA", d.total_pre_entrada, d.pre_atrasadas ? `${d.pre_atrasadas} com previsão vencida` : "pré-entradas pelo XML", d.pre_atrasadas ? C.danger : (C.warn || "#f59e0b"), () => setStatus("pre_entrada"))}
        {kpi("NO PÁTIO AGORA", d.total_no_patio, `${d.clientes.length} cliente(s)`, C.accent, () => setStatus("no_patio"))}
        {kpi("SAÍRAM (30 DIAS)", d.saidas_30d)}
        {d.clientes[0] && kpi("HÁ MAIS TEMPO", `${d.clientes.reduce((m, c) => Math.max(m, c.dias_mais_antigo), 0)} dias`, d.clientes.slice().sort((a, b) => b.dias_mais_antigo - a.dias_mais_antigo)[0].cliente, d.clientes.some((c) => c.dias_mais_antigo > 90) ? (C.warn || "#f59e0b") : C.text)}
      </div>
      {d.clientes.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: C.muted, alignSelf: "center" }}>Saldo por cliente:</span>
        {d.clientes.map((c) => <button key={c.cliente} type="button" aria-pressed={cliente === c.cliente} onClick={() => setCliente(cliente === c.cliente ? "" : c.cliente)} style={{ ...s.btn(cliente === c.cliente), padding: "6px 10px", fontSize: 12 }}>{c.cliente} · {c.qtd}</button>)}
      </div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        {[["pre_entrada", `Aguardando chegada${d.total_pre_entrada ? ` (${d.total_pre_entrada})` : ""}`], ["no_patio", "No pátio"], ["saiu", "Saíram"], ["todos", "Todos"]].map(([k, l]) => <button key={k} type="button" onClick={() => setStatus(k)} style={{ ...s.btn(status === k), padding: estreito ? "9px 12px" : "6px 14px", fontSize: 12.5 }}>{l}</button>)}
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Nº de série, PAT-…, cliente, NF, chave, modelo, local…" style={{ ...inp, marginBottom: 0, flex: 1, minWidth: estreito ? "100%" : 220 }} />
      </div>
      <div style={{ ...s.card, padding: 0, overflow: "hidden" }}>
        {d.bens.length === 0 ? <div style={{ padding: 18, color: C.muted, fontSize: 13 }}>{status === "no_patio" ? "Nada no pátio. Use ＋ Entrada no pátio quando chegar um equipamento de cliente." : status === "pre_entrada" ? "Nenhuma pré-entrada aguardando. Use 📄 Pré-entrada pelo XML quando a NF chegar antes da máquina." : "Nada encontrado."}</div>
          : d.bens.map((b) => <div key={b.id} role="button" tabIndex={0} onClick={() => abrir(b.id)} onKeyDown={(e) => e.key === "Enter" && abrir(b.id)} style={{ display: "flex", gap: estreito ? 6 : 12, alignItems: estreito ? "flex-start" : "center", flexDirection: estreito ? "column" : "row", padding: estreito ? "12px 14px" : "12px 16px", borderTop: `1px solid ${C.border}`, cursor: "pointer" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontFamily: "ui-monospace, monospace", color: C.accent }}>{b.numero}</div>
              <div style={{ fontWeight: 700 }}>{b.descricao}{b.modelo ? ` · ${b.modelo}` : ""}</div>
              <div style={{ fontSize: 12.5, color: C.textSub }}>{b.numero_serie ? <>Série <b style={{ fontFamily: "ui-monospace, monospace" }}>{b.numero_serie}</b></> : <span style={{ color: C.warn || "#f59e0b" }}>série a conferir</span>} · 🏢 {b.cliente_nome}{b.local_patio ? ` · 📍 ${b.local_patio}` : ""}{b.nf_entrada_numero ? ` · NF ${b.nf_entrada_numero}` : ""}</div>
            </div>
            <div style={{ textAlign: estreito ? "left" : "right", fontSize: 12.5 }}>{tagStatus(b)}
              <div style={{ color: C.muted, marginTop: 4 }}>{b.status === "pre_entrada" ? `lançada por ${b.pre_por || "—"}` : b.status === "no_patio" ? `entrou ${dBR(b.entrada_em)}` : b.retirado_por}</div></div>
          </div>)}
      </div>
    </>}

    {/* ── Pré-entrada pelo XML ── */}
    {xml && <div {...fundo(1000, () => !salv && setXml(null))}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Pré-entrada pelo XML" style={caixa(820)}>
        {titulo("📄 Pré-entrada pelo XML da NF", () => !salv && setXml(null))}
        {xml.etapa === "arquivo" ? <>
          <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12 }}>O suporte carrega o XML assim que a NF chega. O sistema lê os equipamentos (<b>uma linha por unidade</b>), tenta achar o <b>nº de série</b> nas informações do item e deixa tudo salvo. Quando a máquina chega, a equipe do pátio só <b>confere a plaqueta, diz o local e tira as fotos</b>.</div>
          <label style={{ ...btnG(true), display: "inline-flex", cursor: salv ? "wait" : "pointer" }}>{salv ? "Lendo…" : "Escolher o XML da NF-e"}<input type="file" accept=".xml,text/xml,application/xml" disabled={salv} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; lerArquivoXml(f); }} style={{ display: "none" }} /></label>
          <div style={{ height: 16 }} />
        </> : <>
          <div style={{ ...s.card, padding: 12, marginBottom: 10, fontSize: 13 }}>
            <b>NF {xml.nf.numero}</b> · {dBR(xml.nf.data)} · emitente {xml.nf.emitente_nome || "—"}{xml.nf.destinatario_nome ? ` → ${xml.nf.destinatario_nome}` : ""}
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11.5, color: C.muted, wordBreak: "break-all" }}>{xml.nf.chave}</div>
          </div>
          {xml.ja_lancados?.length > 0 && <div style={{ ...s.card, padding: 10, marginBottom: 10, borderColor: C.danger, fontSize: 13 }}>⚠ Esta NF já foi lançada: {xml.ja_lancados.map((b) => `${b.numero} (${ROT_STATUS[b.status]})`).join(", ")}.
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}><input type="checkbox" checked={xml.mesmo_assim} onChange={(e) => setXml({ ...xml, mesmo_assim: e.target.checked })} /> Lançar de novo mesmo assim</label></div>}
          {xml.avisos?.length > 0 && <div style={{ fontSize: 12.5, color: C.warn || "#f59e0b", marginBottom: 10 }}>{xml.avisos.map((a, i) => <div key={i}>⚠ {a}</div>)}</div>}
          <div style={grid2}>
            <div style={{ gridColumn: "1 / -1" }}><label style={lab}>CLIENTE DONO DOS EQUIPAMENTOS{xml.cliente_sugerido ? ` — achei pelo CNPJ do ${xml.cliente_sugerido.pelo}` : ""}</label>
              <select value={xml.cliente_id} onChange={(e) => setXml({ ...xml, cliente_id: e.target.value })} style={inp}><option value="">— outro (digite abaixo) —</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.documento ? ` · ${c.documento}` : ""}</option>)}</select>
              {!xml.cliente_id && <input value={xml.cliente_nome} onChange={(e) => setXml({ ...xml, cliente_nome: e.target.value })} placeholder="Nome do cliente (não cadastrado)" style={inp} />}</div>
            {campo(xml, setXml, "previsto_em", "CHEGADA PREVISTA", { type: "date" })}{campo(xml, setXml, "local_patio", "LOCAL PREVISTO NO PÁTIO", { ph: "opcional" })}
          </div>
          <div style={{ fontWeight: 700, margin: "10px 0 6px" }}>{xml.itens.length} equipamento(s) — confira o nº de série (pode ficar em branco: o pátio confere na plaqueta)</div>
          {xml.itens.map((i, n) => <div key={i._k} style={{ ...s.card, padding: 10, marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}><span style={{ fontSize: 11.5, color: C.muted }}>{n + 1}. item {i.nf_item} da NF{i.codigo ? ` · cód. ${i.codigo}` : ""}</span><span style={{ flex: 1 }} />
              <button type="button" aria-label="Tirar da lista" onClick={() => setXml((x) => ({ ...x, itens: x.itens.filter((y) => y._k !== i._k) }))} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 13 }}>✕ tirar</button></div>
            <div style={{ display: "grid", gridTemplateColumns: estreito ? "1fr" : "2fr 1.4fr 0.6fr", gap: "2px 10px" }}>
              <div><label style={lab}>EQUIPAMENTO</label><input value={i.descricao} onChange={(e) => setItem(i._k, "descricao", e.target.value)} style={inp} /></div>
              <div><label style={lab}>Nº DE SÉRIE</label><input value={i.numero_serie} onChange={(e) => setItem(i._k, "numero_serie", e.target.value)} placeholder="não achei — o pátio confere" style={{ ...inp, fontFamily: "ui-monospace, monospace" }} />
                {i.series_achadas && <div style={{ fontSize: 11, color: C.muted }}>Achei: {i.series_achadas.map((sx) => <button key={sx} type="button" onClick={() => setItem(i._k, "numero_serie", sx)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: "0 4px", fontSize: 11 }}>{sx}</button>)}</div>}</div>
              <div><label style={lab}>ANO</label><input value={i.ano} onChange={(e) => setItem(i._k, "ano", e.target.value)} inputMode="numeric" style={inp} /></div>
              <div><label style={lab}>MODELO</label><input value={i.modelo} onChange={(e) => setItem(i._k, "modelo", e.target.value)} style={inp} /></div>
              <div style={{ gridColumn: estreito ? undefined : "span 2" }}><label style={lab}>OUTRA IDENTIFICAÇÃO</label><input value={i.identificacao} onChange={(e) => setItem(i._k, "identificacao", e.target.value)} placeholder="chassi, PIN, motor…" style={inp} /></div>
            </div>
            {i.obs && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>Info. do item na NF: {i.obs}</div>}
          </div>)}
          <div style={rodape}><button type="button" disabled={salv} onClick={() => setXml(null)} style={btnG(false)}>Cancelar</button>
            <button type="button" disabled={salv || !xml.itens.length || (!xml.cliente_id && !xml.cliente_nome.trim()) || xml.itens.some((i) => !i.descricao.trim()) || (xml.ja_lancados?.length > 0 && !xml.mesmo_assim)} onClick={salvarXml} style={btnG(true)}>{salv ? "Salvando…" : `Lançar ${xml.itens.length} pré-entrada(s)`}</button></div>
        </>}
      </div></div>}

    {/* ── Entrada direta ── */}
    {form && <div {...fundo(1000, () => !salv && setForm(null))}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Entrada no pátio" style={caixa(640)}>
        {titulo("📥 Entrada no pátio — equipamento do cliente", () => !salv && setForm(null))}
        <div style={grid2}>
          {secao("🧾 Nota fiscal e cliente", true)}
          <div style={{ gridColumn: "1 / -1" }}><label style={lab}>CHAVE DA NF (CÓDIGO DE BARRAS DA DANFE)</label>
            <div style={{ display: "flex", gap: 8 }}><input value={form.nf_entrada_chave} inputMode="numeric" onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 44); setForm({ ...form, nf_entrada_chave: v }); if (v.length === 44) chaveLida(v); else setPreDaNf([]); }} placeholder="leia o código de barras da DANFE" style={{ ...inp, flex: 1, fontFamily: "ui-monospace, monospace" }} />
              <button type="button" onClick={() => setLeitor(true)} style={{ ...btnG(false), whiteSpace: "nowrap", marginBottom: s.input?.marginBottom }}>📷 Ler</button></div>
            {form.nf_entrada_chave.length === 44 ? <div style={{ fontSize: 12, color: C.success, marginTop: -2, marginBottom: 6 }}>✓ NF nº {daChave(form.nf_entrada_chave).numero} · emitida em {daChave(form.nf_entrada_chave).aamm}</div>
              : !form.sem_chave && <button type="button" onClick={() => setForm({ ...form, sem_chave: true })} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 12, padding: "0 0 6px", marginTop: -2 }}>Sem chave? Informar nº e data da NF</button>}
            {form.sem_chave && form.nf_entrada_chave.length !== 44 && <div style={grid2}>{campo(form, setForm, "nf_entrada_numero", "Nº DA NF", { im: "numeric" })}{campo(form, setForm, "nf_entrada_data", "DATA DA NF", { type: "date" })}</div>}
            {preDaNf.length > 0 && <div style={{ ...s.card, padding: 10, marginBottom: 8, borderColor: C.warn || "#f59e0b", fontSize: 13 }}>📄 Esta NF tem <b>{preDaNf.length} pré-entrada(s)</b> aguardando chegada — confirme a chegada nela em vez de lançar de novo:
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>{preDaNf.map((b) => <button key={b.id} type="button" onClick={() => { setForm(null); abrir(b.id); }} style={{ ...s.btn(true), padding: "8px 12px", fontSize: 12.5 }}>{b.numero} · {b.descricao}{b.numero_serie ? ` · ${b.numero_serie}` : ""}</button>)}</div></div>}
          </div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lab}>CLIENTE DONO DO EQUIPAMENTO</label>
            <select value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value, cliente_nome: e.target.value ? "" : form.cliente_nome })} style={inp}><option value="">— outro (digite abaixo) —</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.documento ? ` · ${c.documento}` : ""}</option>)}</select>
            {!form.cliente_id && <input value={form.cliente_nome} onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })} placeholder="Nome do cliente (não cadastrado)" style={inp} />}</div>
          {secao("🚜 Equipamento")}
          {campo(form, setForm, "descricao", "EQUIPAMENTO", { full: true, ph: "ex.: Escavadeira hidráulica" })}
          {campo(form, setForm, "numero_serie", "Nº DE SÉRIE (PLAQUETA)", { ph: "o que está na plaqueta" })}
          {campo(form, setForm, "identificacao", "OUTRA IDENTIFICAÇÃO", { ph: "chassi, PIN, nº do motor…" })}
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: estreito ? "1fr 1fr 0.7fr" : "2fr 2fr 1fr", gap: "2px 12px" }}>
            {campo(form, setForm, "fabricante", "FABRICANTE")}{campo(form, setForm, "modelo", "MODELO")}{campo(form, setForm, "ano", "ANO (OPCIONAL)", { im: "numeric", ph: "ex.: 2024" })}</div>
          {secao("📍 Chegada")}
          {campo(form, setForm, "local_patio", "LOCAL NO PÁTIO", { ph: "ex.: Galpão 2 · vaga 14" })}{campo(form, setForm, "entrada_em", "DATA DA ENTRADA", { type: "date", max: hoje() })}
          {campo(form, setForm, "recebido_por", "RECEBIDO POR", { full: true })}
          <FotosPendentes />
          {campo(form, setForm, "obs", "OBSERVAÇÃO (AVARIAS NA CHEGADA, ACESSÓRIOS…)", { full: true })}
        </div>
        <div style={rodape}><button type="button" disabled={salv} onClick={() => setForm(null)} style={btnG(false)}>Cancelar</button>
          <button type="button" disabled={salv || !form.descricao.trim() || !form.numero_serie.trim() || (!form.cliente_id && !form.cliente_nome.trim())} onClick={salvarEntrada} style={btnG(true)}>{salv ? (subindo ? "Enviando fotos…" : "Salvando…") : `Registrar entrada${fotosPend.length ? ` + ${fotosPend.length} foto(s)` : ""}`}</button></div>
      </div></div>}

    {/* ── Ficha ── */}
    {det && <div {...fundo(1000, () => !saida && !chegada && setDet(null))}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Equipamento no pátio" style={caixa(680)}>
        {(() => { const b = det.bem; const linha = (r, v) => v ? <div style={{ display: "flex", flexDirection: estreito ? "column" : "row", gap: estreito ? 0 : 10, fontSize: 13, padding: "5px 0", borderTop: `1px solid ${C.border}` }}><span style={{ width: estreito ? "auto" : 170, color: C.textSub, flexShrink: 0, fontSize: estreito ? 11.5 : 13 }}>{r}</span><span style={{ flex: 1 }}>{v}</span></div> : null;
          return <>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", color: C.accent }}>{b.numero}</div><div style={{ fontWeight: 800, fontSize: 17 }}>{b.descricao}{b.modelo ? ` · ${b.modelo}` : ""}</div>
              <div style={{ marginTop: 4 }}>{b.status === "saiu" ? <span style={s.tag(C.success)}>saiu em {dBR(b.saida_em)} · ficou {b.dias_no_patio} dia(s)</span> : b.status === "no_patio" ? <span style={s.tag(C.accent)}>no pátio há {b.dias_no_patio} dia(s)</span> : tagStatus(b)}</div></div>
              <button type="button" onClick={() => setDet(null)} aria-label="Fechar" style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer", padding: 4 }}>✕</button></div>
            {b.status === "pre_entrada" && <div style={{ ...s.card, padding: 10, marginTop: 10, borderColor: C.warn || "#f59e0b", fontSize: 13 }}>Pré-entrada lançada por <b>{b.pre_por || "—"}</b>{b.pre_em ? ` em ${dBR(b.pre_em)}` : ""}. Quando a máquina chegar: <b>confira a plaqueta</b>, diga o local e tire as fotos.</div>}
            <div style={{ fontWeight: 700, margin: "14px 0 4px" }}>📥 Entrada</div>
            {linha("Cliente (dono)", b.cliente_nome)}{linha("Nº de série (plaqueta)", b.numero_serie ? <b style={{ fontFamily: "ui-monospace, monospace" }}>{b.numero_serie}</b> : <span style={{ color: C.warn || "#f59e0b" }}>a conferir na chegada</span>)}{linha("Outra identificação", b.identificacao)}
            {linha("Fabricante / ano", [b.fabricante, b.ano].filter(Boolean).join(" · "))}{linha("NF de entrada", [b.nf_entrada_numero && `nº ${b.nf_entrada_numero}`, b.nf_entrada_data && dBR(b.nf_entrada_data), b.nf_item && `item ${b.nf_item}`, b.nf_emitente_nome, b.nf_entrada_chave && `chave …${b.nf_entrada_chave.slice(-8)}`].filter(Boolean).join(" · "))}
            {b.entrada_em && linha("Entrou em", `${dBR(b.entrada_em)}${b.recebido_por ? ` · recebido por ${b.recebido_por}` : ""}`)}{linha(b.status === "pre_entrada" ? "Local previsto" : "Local no pátio", b.local_patio)}{linha("Observação", b.obs && <span style={{ whiteSpace: "pre-wrap" }}>{b.obs}</span>)}
            <Fotos fase="entrada" lista={b.fotos_entrada} podeAdd={b.status !== "saiu"} />
            {b.status === "saiu" && <><div style={{ fontWeight: 700, margin: "14px 0 4px" }}>📤 Saída</div>
              {linha("Saiu em", `${dBR(b.saida_em)}${b.liberado_por ? ` · liberado por ${b.liberado_por}` : ""}`)}{linha("Retirado por", [b.retirado_por, b.retirado_documento, b.retirado_placa && `placa ${b.retirado_placa}`].filter(Boolean).join(" · "))}
              {linha("NF de saída / remessa", b.nf_saida_numero)}{linha("AT", b.at ? `${b.at.numero} (${b.at.status})` : null)}{linha("Observação", b.saida_obs)}
              <Fotos fase="saida" lista={b.fotos_saida} podeAdd /></>}
            {det.historico_serie.length > 0 && <div style={{ marginTop: 12, fontSize: 12.5, color: C.textSub }}>🔁 Este nº de série já passou pelo pátio: {det.historico_serie.map((h) => `${h.numero} (${dBR(h.entrada_em)}${h.saida_em ? ` → ${dBR(h.saida_em)}` : ""})`).join(" · ")}</div>}
            {confExcluir && <div style={{ ...s.card, padding: 12, marginTop: 12, borderColor: C.danger, fontSize: 13 }}>Excluir a pré-entrada <b>{b.numero}</b>? Use quando a máquina não vem mais ou foi lançada errada.
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}><button type="button" onClick={() => setConfExcluir(false)} style={btnG(false)}>Voltar</button><button type="button" disabled={salv} onClick={excluirPre} style={{ ...btnG(true), background: C.danger, borderColor: C.danger }}>Excluir</button></div></div>}
            <div style={{ ...rodape, marginTop: 16 }}>
              {b.status === "pre_entrada" && !confExcluir && <><button type="button" onClick={() => setConfExcluir(true)} style={{ ...btnG(false), color: C.danger }}>🗑 Excluir pré-entrada</button>
                <button type="button" onClick={() => { limparFotos(); setChegada({ numero_serie: b.numero_serie || "", local_patio: b.local_patio || "", entrada_em: hoje(), recebido_por: usuario?.nome || "", obs_chegada: "" }); }} style={btnG(true)}>✅ Confirmar chegada</button></>}
              {b.status === "no_patio" && <button type="button" onClick={() => setSaida({ ...vazioSaida(), liberado_por: usuario?.nome || "" })} style={btnG(true)}>📤 Registrar saída</button>}
              {b.status === "saiu" && estreito && <button type="button" onClick={() => setDet(null)} style={btnG(false)}>Fechar</button>}
            </div>
          </>; })()}
      </div></div>}

    {/* ── Confirmar chegada (pré-entrada) ── */}
    {chegada && det && <div {...fundo(1100, () => !salv && setChegada(null))}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Confirmar chegada" style={caixa(560)}>
        {titulo(`✅ Chegada — ${det.bem.numero}`, () => !salv && setChegada(null))}
        <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 12 }}>{det.bem.descricao} · {det.bem.cliente_nome}{det.bem.nf_entrada_numero ? ` · NF ${det.bem.nf_entrada_numero}` : ""}. <b>Confira o nº de série na plaqueta</b> — se for diferente da NF, corrija aqui.</div>
        <div style={grid2}>
          <div style={{ gridColumn: "1 / -1" }}><label style={lab}>Nº DE SÉRIE NA PLAQUETA</label><input value={chegada.numero_serie} onChange={(e) => setChegada({ ...chegada, numero_serie: e.target.value })} placeholder="o que está na plaqueta" style={{ ...inp, fontFamily: "ui-monospace, monospace", fontSize: 18 }} />
            {det.bem.numero_serie && chegada.numero_serie.trim() && chegada.numero_serie.trim().toUpperCase() !== det.bem.numero_serie && <div style={{ fontSize: 12, color: C.warn || "#f59e0b", marginTop: -2, marginBottom: 6 }}>⚠ Diferente da NF ({det.bem.numero_serie}) — anote na observação o motivo.</div>}</div>
          {campo(chegada, setChegada, "local_patio", "LOCAL NO PÁTIO", { ph: "ex.: Galpão 2 · vaga 14" })}{campo(chegada, setChegada, "entrada_em", "DATA DA CHEGADA", { type: "date", max: hoje() })}
          <FotosPendentes />
          {campo(chegada, setChegada, "recebido_por", "RECEBIDO POR")}<div />
          {campo(chegada, setChegada, "obs_chegada", "OBSERVAÇÃO DA CHEGADA (AVARIAS, ACESSÓRIOS…)", { full: true })}
        </div>
        <div style={rodape}><button type="button" disabled={salv} onClick={() => setChegada(null)} style={btnG(false)}>Cancelar</button>
          <button type="button" disabled={salv || !chegada.numero_serie.trim()} onClick={salvarChegada} style={btnG(true)}>{salv ? (subindo ? "Enviando fotos…" : "Salvando…") : `Confirmar chegada${fotosPend.length ? ` + ${fotosPend.length} foto(s)` : ""}`}</button></div>
      </div></div>}

    {/* ── Saída ── */}
    {saida && det && <div {...fundo(1100, () => !salv && setSaida(null))}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Saída do pátio" style={caixa(540)}>
        {titulo(`📤 Saída — ${det.bem.numero}`, () => !salv && setSaida(null))}
        <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 12 }}>{det.bem.descricao} · série <b>{det.bem.numero_serie}</b> · {det.bem.cliente_nome}. Confira a plaqueta antes de liberar.</div>
        <div style={grid2}>
          {campo(saida, setSaida, "saida_em", "DATA DA SAÍDA", { type: "date", max: hoje() })}{campo(saida, setSaida, "liberado_por", "LIBERADO POR")}
          {campo(saida, setSaida, "retirado_por", "QUEM RETIROU (MOTORISTA / TRANSPORTADORA)", { full: true, ph: "ou \"transporte próprio\"" })}
          {campo(saida, setSaida, "retirado_documento", "DOCUMENTO (CPF/CNH/RG)")}{campo(saida, setSaida, "retirado_placa", "PLACA")}
          {campo(saida, setSaida, "nf_saida_numero", "NF DE SAÍDA / REMESSA — Nº", { im: "numeric" })}{!estreito && <div />}
          {campo(saida, setSaida, "saida_obs", "OBSERVAÇÃO", { full: true })}
        </div>
        <div style={{ fontSize: 12, color: C.muted, margin: "4px 0 8px" }}>Depois da saída dá para anexar as fotos da retirada.</div>
        <div style={rodape}><button type="button" disabled={salv} onClick={() => setSaida(null)} style={btnG(false)}>Cancelar</button>
          <button type="button" disabled={salv || !saida.retirado_por.trim()} onClick={salvarSaida} style={btnG(true)}>{salv ? "Salvando…" : "Confirmar saída"}</button></div>
      </div></div>}
    {leitor && <div style={{ position: "fixed", inset: 0, zIndex: 1300 }}><LeitorCodigoBarras C={C} s={s} onDetectado={chaveLida} onFechar={() => setLeitor(false)} /></div>}
    {confFoto && <div onClick={() => setConfFoto(null)} style={{ position: "fixed", inset: 0, background: "#000000aa", zIndex: 1250, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Excluir foto" style={{ ...s.card, width: 380, maxWidth: "100%", padding: 20, textAlign: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Excluir esta foto?</div>
        <img src={confFoto.url} alt="Foto a excluir" style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 8, border: `1px solid ${C.border}` }} />
        <div style={{ fontSize: 12.5, color: C.textSub, margin: "8px 0 14px" }}>Ela ainda não foi salva — se excluir, terá que tirar de novo.</div>
        <div style={{ display: "flex", gap: 10 }}><button type="button" onClick={() => setConfFoto(null)} style={{ ...btnG(false), flex: 1, padding: "12px 16px" }}>Cancelar</button>
          <button type="button" onClick={() => { setFotosPend((l) => l.filter((x) => x.url !== confFoto.url)); setConfFoto(null); }} style={{ ...btnG(true), flex: 1, padding: "12px 16px", background: C.danger, borderColor: C.danger }}>Excluir</button></div>
      </div></div>}
    {ver && <VerArquivo C={C} s={s} arquivo={ver} z={1200} onFechar={() => setVer(null)} />}
  </div>;
}
