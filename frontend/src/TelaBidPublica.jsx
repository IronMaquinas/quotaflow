// frontend/src/TelaBidPublica.jsx — etapa 15b
// Página do CLIENTE para o BID (#bid?t=<token>) — pública, sem login, como o link da cotação do fornecedor.
//   • mostra a proposta (a versão enviada) como documento + 📄 imprimir; se foi atualizada, diz o que mudou
//   • responder ITEM POR ITEM: ✅ aprovar · ✏ pedir revisão (motivo + comentário) · ❌ recusar (motivo); "Aprovar todos"
//   • tudo aprovado → ACEITE: código de 6 dígitos no e-mail + nome + assinatura na tela → aceito (com hash)
//   • estados: respondido (a empresa está revisando) · aceito · encerrado · validade vencida
// Não usa o apiService (ele desloga com 403): fetch direto em /api/bid-link.
import { useState, useEffect } from "react";
import { C, s } from "./App";
import AssinaturaTela from "./components/shared/AssinaturaTela";
import { gerarHtmlBid, abrirBid, valorCelula } from "./utils/gerarBid";
import { definirLogoEmpresa } from "./utils/logoEmpresa";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const tokenDaUrl = () => { const m = (window.location.hash || "").match(/[?&]t=([a-f0-9]{48})/i); return m ? m[1] : ""; };
const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");
const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "");
const DEC = { aprovado: ["✅ Aprovar", "#22c55e"], revisar: ["✏ Pedir revisão", "#f59e0b"], recusado: ["❌ Recusar", "#ef4444"] };

export default function TelaBidPublica() {
  const [tk] = useState(tokenDaUrl);
  const [p, setP] = useState(null);
  const [erro, setErro] = useState(null);
  const [msg, setMsg] = useState(null);
  const [resp, setResp] = useState({});
  const [quem, setQuem] = useState({ nome: "", cargo: "", geral: "" });
  const [confirmar, setConfirmar] = useState(false);
  const [aceite, setAceite] = useState({ codigo: "", nome: "", cargo: "", png: null });
  const [codigoMsg, setCodigoMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const chamar = async (caminho, metodo = "GET", corpo) => {
    const r = await fetch(`${API}/bid-link/${tk}${caminho}`, { method: metodo, headers: { "Content-Type": "application/json" }, body: corpo ? JSON.stringify(corpo) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || `Erro ${r.status}`);
    return j;
  };
  const carregar = async () => {
    try { const r = await chamar(""); definirLogoEmpresa(r.logo); setP(r); setResp(r.sugestao || {}); setErro(null); }
    catch (e) { setErro(e.message); }
  };
  useEffect(() => { if (!tk) setErro("Link incompleto — abra pelo botão do e-mail."); else carregar(); }, []); // eslint-disable-line

  const pagina = (conteudo) => <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif", padding: "16px 12px 40px" }}><div style={{ maxWidth: 980, margin: "0 auto" }}>{conteudo}</div></div>;
  if (erro && !p) return pagina(<div style={{ ...s.card, padding: 24, marginTop: 40, textAlign: "center" }}><div style={{ fontSize: 34 }}>🔗</div><div style={{ fontSize: 16, fontWeight: 700, margin: "8px 0" }}>Não foi possível abrir a proposta</div><div style={{ color: C.textSub, fontSize: 13 }}>{erro}</div></div>);
  if (!p) return pagina(<div style={{ color: C.muted, padding: 40, textAlign: "center" }}>Carregando a proposta…</div>);

  const doc = p.documento; const cols = doc.conteudo?.colunas || []; const rot = doc.conteudo?.rotulo_grupo || "Grupo";
  const itens = (doc.grupos || []).flatMap((g, gi) => (g.itens || []).map((i) => ({ ...i, grupo: g.titulo || `${rot} ${gi + 1}` })));
  const resumoItem = (i) => cols.map((c) => (i.valores?.[c.chave] != null && i.valores[c.chave] !== "" ? `${c.rotulo}: ${valorCelula(c, i.valores[c.chave])}` : null)).filter(Boolean).slice(0, 4).join(" · ") || "item";
  const setR = (id, x) => setResp((r) => ({ ...r, [id]: { ...(r[id] || {}), ...x } }));
  const faltando = itens.filter((i) => { const r = resp[i.id]; return !r?.decisao || (r.decisao === "revisar" && (!r.motivo || (r.motivo === "outro" && !String(r.comentario || "").trim()))) || (r.decisao === "recusado" && !String(r.comentario || "").trim()); }).length;
  const cont = itens.reduce((a, i) => { const d = resp[i.id]?.decisao; if (d) a[d] = (a[d] || 0) + 1; return a; }, {});
  const podeResponder = p.fase === "responder" && !p.vencido;
  const enviarResposta = async () => {
    setOcupado(true);
    try { const r = await chamar("/responder", "POST", { ...quem, itens: resp }); setConfirmar(false); setMsg(r.fase === "aceite" ? "Obrigado! Agora é só assinar o aceite logo abaixo." : r.fase === "encerrado" ? "Resposta registrada. Obrigado pelo retorno." : "Resposta enviada! A empresa vai revisar e mandar a nova versão por e-mail."); await carregar(); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (e) { setErro(e.message); setConfirmar(false); } finally { setOcupado(false); }
  };
  const pedirCodigo = async () => { setOcupado(true); try { const r = await chamar("/codigo", "POST", {}); setCodigoMsg(`Enviamos um código de 6 dígitos para ${r.email}. Ele vale por 15 minutos.`); setErro(null); } catch (e) { setErro(e.message); } finally { setOcupado(false); } };
  const assinar = async () => { setOcupado(true); try { await chamar("/aceitar", "POST", { codigo: aceite.codigo, nome: aceite.nome, cargo: aceite.cargo, assinatura_png: aceite.png }); setMsg("✍ Aceite registrado! Você recebe a confirmação por e-mail."); setErro(null); await carregar(); window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { setErro(e.message); } finally { setOcupado(false); } };

  const faixa = (cor, txt) => <div style={{ ...s.card, padding: "12px 14px", marginBottom: 12, borderColor: cor, background: `${cor}14`, fontSize: 13.5, lineHeight: 1.55 }}>{txt}</div>;
  const total = doc.total;

  return pagina(<>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
      {p.logo && <img src={p.logo} alt="" style={{ maxHeight: 40, maxWidth: 160, background: "#fff", borderRadius: 6, padding: 4 }} />}
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 800, fontSize: 17 }}>{p.contato.empresa}</div>
        <div style={{ fontSize: 12.5, color: C.textSub }}>{p.aditivo ? "Aditivo" : "Proposta"} {p.numero} · versão {p.versao}{p.valido_ate ? ` · válida até ${dBR(p.valido_ate)}` : ""}</div></div>
      <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: C.muted }}>VALOR TOTAL</div><div style={{ fontSize: 20, fontWeight: 800 }}>{brl(total)}</div></div>
    </div>
    {msg && faixa(C.success, msg)}
    {erro && faixa(C.danger, erro)}
    {p.aditivo && p.fase !== "aceito" && faixa("#a78bfa", <>📎 <b>Aditivo {p.aditivo.numero} ao pedido {p.aditivo.pv_numero}</b> — o que muda em relação ao pedido atual{p.aditivo.valor_antes != null ? ` (hoje ${brl(p.aditivo.valor_antes)})` : ""}:
      {(p.aditivo.mudancas || []).length ? <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5 }}>{p.aditivo.mudancas.slice(0, 15).map((m, i) => <li key={i}>{m}</li>)}</ul> : " —"}</>)}
    {p.atualizacao && p.fase === "responder" && faixa(C.accent, <>🔄 <b>Proposta atualizada para a versão {p.versao}</b> em {dataHora(p.atualizacao.em)}.{p.atualizacao.nota ? ` ${p.atualizacao.nota}.` : ""}
      {(p.atualizacao.mudancas || []).length > 0 && <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5 }}>{p.atualizacao.mudancas.slice(0, 10).map((m, i) => <li key={i}>{m}</li>)}</ul>}</>)}
    {p.vencido && faixa(C.danger, <>⌛ <b>A validade desta proposta venceu</b> em {dBR(p.valido_ate)}. Para renovar, fale com {p.contato.responsavel || "a empresa"}{p.contato.telefones ? ` (${p.contato.telefones})` : ""}.</>)}
    {p.fase === "em_revisao" && faixa(C.warn, <>💬 <b>Recebemos a sua resposta{p.resposta?.em ? ` em ${dataHora(p.resposta.em)}` : ""}.</b> A empresa está revisando a proposta — a nova versão chega por e-mail.</>)}
    {p.fase === "encerrado" && faixa(C.muted, <>Esta proposta foi encerrada. Dúvidas: {p.contato.responsavel || "fale com a empresa"}{p.contato.telefones ? ` · ${p.contato.telefones}` : ""}.</>)}
    {p.fase === "aceito" && p.aceite && faixa(C.success, <>✍ <b>{p.aditivo ? `Aditivo aceito — o pedido ${p.aditivo.pv_numero} foi atualizado` : "Proposta aceita"}</b> por {p.aceite.nome}{p.aceite.cargo ? `, ${p.aceite.cargo}` : ""} em {dataHora(p.aceite.em)} (versão {p.aceite.versao}).
      {p.aceite.png && <div style={{ marginTop: 8 }}><img src={p.aceite.png} alt="assinatura" style={{ maxHeight: 70, background: "#fff", borderRadius: 4 }} /></div>}
      {p.aceite.hash && <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", wordBreak: "break-all", marginTop: 6 }}>SHA-256 {p.aceite.hash}</div>}</>)}

    <div style={{ ...s.card, overflow: "hidden", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderBottom: `1px solid ${C.border}` }}><b style={{ flex: 1, fontSize: 13 }}>📄 Documento da proposta</b>
        <button type="button" onClick={() => abrirBid({ ...doc, rascunho: false }, null)} style={{ ...s.btn(true, C.accent), background: "transparent", color: C.accent, padding: "5px 10px", fontSize: 12 }}>Abrir / imprimir</button></div>
      <iframe title="Proposta" srcDoc={gerarHtmlBid({ ...doc, rascunho: false })} style={{ width: "100%", height: "60vh", border: "none", background: "#fff", display: "block" }} />
    </div>

    {podeResponder && <div style={{ ...s.card, padding: "14px 14px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <div style={{ fontSize: 16, fontWeight: 800, flex: 1 }}>Sua resposta, item por item</div>
        <button type="button" onClick={() => setResp(Object.fromEntries(itens.map((i) => [i.id, { decisao: "aprovado" }])))} style={{ ...s.btn(true, C.success), padding: "6px 12px", fontSize: 12 }}>✅ Aprovar todos</button>
      </div>
      <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 12 }}>Aprove o que estiver certo, peça revisão do que precisa mudar (diga o quê) ou recuse. Se tudo for aprovado, você assina o aceite em seguida.</div>
      {(doc.grupos || []).map((g, gi) => <div key={g.id} style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#f87171", textTransform: "uppercase", margin: "6px 0" }}>{g.titulo || `${rot} ${gi + 1}`}{g.subtotal != null ? <span style={{ color: C.textSub, fontWeight: 400, textTransform: "none" }}> · {brl(g.subtotal)}</span> : ""}</div>
        {(g.itens || []).map((i) => { const r = resp[i.id] || {}; return (
          <div key={i.id} style={{ border: `1px solid ${r.decisao ? DEC[r.decisao][1] : C.border}`, borderRadius: 8, padding: "9px 10px", marginBottom: 7, background: C.bg }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}><div style={{ flex: 1, fontSize: 13 }}>{resumoItem(i)}</div>{i.valor != null && <b style={{ fontSize: 13 }}>{brl(Number(i.valor) * Number(i.quantidade || 1))}</b>}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>{Object.entries(DEC).map(([k, [l, cor]]) => <button key={k} type="button" onClick={() => setR(i.id, { decisao: k })}
              style={{ background: r.decisao === k ? cor : "transparent", color: r.decisao === k ? "#fff" : cor, border: `1px solid ${cor}`, borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>)}</div>
            {r.decisao === "revisar" && <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
              <select value={r.motivo || ""} onChange={(e) => setR(i.id, { motivo: e.target.value })} style={{ ...s.input, flex: "1 1 160px" }}><option value="">O que revisar?</option>{Object.entries(p.motivos_revisao || {}).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <input value={r.comentario || ""} onChange={(e) => setR(i.id, { comentario: e.target.value })} placeholder="Comentário (ex.: preciso de prancha 3 eixos)" style={{ ...s.input, flex: "3 1 240px" }} /></div>}
            {r.decisao === "recusado" && <input value={r.comentario || ""} onChange={(e) => setR(i.id, { comentario: e.target.value })} placeholder="Motivo da recusa (obrigatório)" style={{ ...s.input, marginTop: 7 }} />}
          </div>); })}
      </div>)}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
        <label style={{ flex: "1 1 200px" }}><span style={s.label}>SEU NOME *</span><input value={quem.nome} onChange={(e) => setQuem({ ...quem, nome: e.target.value })} style={s.input} /></label>
        <label style={{ flex: "1 1 160px" }}><span style={s.label}>CARGO</span><input value={quem.cargo} onChange={(e) => setQuem({ ...quem, cargo: e.target.value })} style={s.input} /></label></div>
      <label style={{ display: "block", marginTop: 8 }}><span style={s.label}>COMENTÁRIO GERAL (OPCIONAL)</span><textarea rows={2} value={quem.geral} onChange={(e) => setQuem({ ...quem, geral: e.target.value })} style={{ ...s.input, resize: "vertical" }} /></label>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, fontSize: 12, color: faltando ? C.warn : C.textSub }}>{faltando ? `Falta responder ${faltando} item(ns)` : `${cont.aprovado || 0} aprovado(s) · ${cont.revisar || 0} revisão(ões) · ${cont.recusado || 0} recusado(s)`}</div>
        <button type="button" disabled={!!faltando || !quem.nome.trim() || ocupado} onClick={() => setConfirmar(true)} style={{ ...s.btn(!faltando && !!quem.nome.trim() && !ocupado, C.accent), padding: "10px 20px" }}>Enviar resposta</button>
      </div>
    </div>}

    {p.fase === "aceite" && !p.vencido && <div style={{ ...s.card, padding: 14, marginBottom: 14, borderColor: "#a78bfa" }}>
      <div style={{ fontSize: 16, fontWeight: 800 }}>✍ Assinar o aceite</div>
      <div style={{ fontSize: 13, color: C.textSub, margin: "4px 0 12px" }}>Você aprovou todos os itens da versão {p.versao} — valor total <b style={{ color: C.text }}>{brl(total)}</b>. Para confirmar, enviamos um código ao e-mail {p.email_mascarado} e você assina aqui.</div>
      {!codigoMsg && !p.codigo_enviado ? <button type="button" disabled={ocupado} onClick={pedirCodigo} style={{ ...s.btn(!ocupado, C.accent) }}>📧 Enviar o código para {p.email_mascarado}</button> : <>
        <div style={{ fontSize: 12.5, color: C.success, marginBottom: 8 }}>{codigoMsg || `Já enviamos um código para ${p.email_mascarado}.`} <button type="button" onClick={pedirCodigo} disabled={ocupado} style={{ background: "none", border: "none", color: C.textSub, textDecoration: "underline", cursor: "pointer", fontSize: 12 }}>reenviar</button></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label style={{ flex: "0 1 150px" }}><span style={s.label}>CÓDIGO *</span><input value={aceite.codigo} inputMode="numeric" maxLength={6} onChange={(e) => setAceite({ ...aceite, codigo: e.target.value.replace(/\D/g, "") })} style={{ ...s.input, letterSpacing: 4, fontWeight: 700 }} /></label>
          <label style={{ flex: "1 1 200px" }}><span style={s.label}>SEU NOME COMPLETO *</span><input value={aceite.nome} onChange={(e) => setAceite({ ...aceite, nome: e.target.value })} style={s.input} /></label>
          <label style={{ flex: "1 1 160px" }}><span style={s.label}>CARGO</span><input value={aceite.cargo} onChange={(e) => setAceite({ ...aceite, cargo: e.target.value })} style={s.input} /></label></div>
        <div style={{ ...s.label, marginTop: 10 }}>ASSINE AQUI *</div>
        <AssinaturaTela C={C} s={s} onChange={(png) => setAceite((a) => ({ ...a, png }))} />
        <button type="button" disabled={ocupado || aceite.codigo.length !== 6 || !aceite.nome.trim() || !aceite.png} onClick={assinar} style={{ ...s.btn(!ocupado && aceite.codigo.length === 6 && !!aceite.nome.trim() && !!aceite.png, C.success), marginTop: 12, padding: "10px 22px" }}>✍ Assinar e aceitar a proposta</button>
      </>}
    </div>}

    <div style={{ fontSize: 11.5, color: C.muted, textAlign: "center" }}>Dúvidas: {p.contato.responsavel || p.contato.empresa}{p.contato.telefones ? ` · ${p.contato.telefones}` : ""} · enviado pelo QuotaFlow</div>

    {confirmar && <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }} onClick={() => setConfirmar(false)}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: 440, maxWidth: "100%", padding: "18px 20px" }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Enviar a sua resposta?</div>
        <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.6 }}>{cont.aprovado || 0} aprovado(s) · {cont.revisar || 0} revisão(ões) · {cont.recusado || 0} recusado(s).<br />{(cont.aprovado || 0) === itens.length ? "Tudo aprovado: em seguida você assina o aceite." : (cont.recusado || 0) === itens.length ? "Todos os itens recusados: a proposta será encerrada." : "A empresa vai revisar o que você pediu e enviar uma nova versão."}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={() => setConfirmar(false)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Voltar</button>
          <button type="button" disabled={ocupado} onClick={enviarResposta} style={{ ...s.btn(!ocupado, C.accent), flex: 1 }}>{ocupado ? "Enviando…" : "Enviar"}</button>
        </div>
      </div>
    </div>}
  </>);
}
