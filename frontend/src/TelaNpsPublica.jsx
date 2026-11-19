// frontend/src/TelaNpsPublica.jsx — etapa N1: ⭐ página do CLIENTE para a pesquisa de satisfação (#nps?t=<token>[&n=nota])
//   Pública, sem login, clara (o cliente abre no celular). Nota 0–10 (já vem marcada se clicou no número do e-mail),
//   "o que mais pesou" e comentário. Responde uma vez. Não usa o apiService (ele desloga com 403): fetch direto em /api/nps-link.
import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const tokenDaUrl = () => { const m = (window.location.hash || "").match(/[?&]t=([a-f0-9]{48})/i); return m ? m[1] : ""; };
const notaDaUrl = () => { const m = (window.location.hash || "").match(/[?&]n=(\d{1,2})\b/); const n = m ? Number(m[1]) : null; return n != null && n >= 0 && n <= 10 ? n : null; };
const cor = (n) => (n <= 6 ? "#ef4444" : n <= 8 ? "#f59e0b" : "#16a34a");

export default function TelaNpsPublica() {
  const [tk] = useState(tokenDaUrl); const [p, setP] = useState(null); const [erro, setErro] = useState(null);
  const [nota, setNota] = useState(notaDaUrl); const [mot, setMot] = useState([]); const [com, setCom] = useState(""); const [nome, setNome] = useState(""); const [env, setEnv] = useState(false); const [feito, setFeito] = useState(null);
  const chamar = async (caminho, metodo = "GET", corpo) => { const r = await fetch(`${API}/nps-link/${tk}${caminho}`, { method: metodo, headers: { "Content-Type": "application/json" }, body: corpo ? JSON.stringify(corpo) : undefined }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro || "Não consegui agora."); return j; };
  useEffect(() => { if (!tk) { setErro("Link inválido."); return; } chamar("").then(setP).catch((e) => setErro(e.message)); }, []); // eslint-disable-line
  const enviar = async () => { if (nota == null) return; setEnv(true); setErro(null); try { const r = await chamar("/responder", "POST", { nota, motivos: mot, comentario: com, nome }); setFeito(r.classe || "ok"); } catch (e) { setErro(e.message); } finally { setEnv(false); } };
  const box = { maxWidth: 560, margin: "0 auto", padding: "28px 18px 40px", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", color: "#111" };
  const pagina = (filhos) => <div style={{ minHeight: "100vh", background: "#f5f6f8" }}><div style={box}>{p?.logo && <img src={p.logo} alt="" style={{ maxHeight: 48, maxWidth: 180, marginBottom: 10 }} />}<div style={{ fontWeight: 700, fontSize: 16, borderBottom: "2px solid #111", paddingBottom: 6, marginBottom: 18 }}>{p?.empresa || " "}</div>{filhos}<div style={{ color: "#999", fontSize: 11, marginTop: 30 }}>Pesquisa enviada pelo QuotaFlow{p?.empresa ? ` em nome de ${p.empresa}` : ""}. Suas respostas vão só para a empresa.</div></div></div>;
  if (erro && !p) return pagina(<div style={{ fontSize: 15 }}>{erro}</div>);
  if (!p) return pagina(<div style={{ color: "#666" }}>Carregando…</div>);
  if (feito || p.status === "respondida") return pagina(<div style={{ textAlign: "center", padding: "30px 0" }}><div style={{ fontSize: 46 }}>🙏</div><div style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>Obrigado pela resposta!</div><div style={{ fontSize: 14, color: "#555", marginTop: 8 }}>{feito === "detrator" ? "Sentimos muito que não foi como esperado. Alguém da equipe vai entrar em contato para entender e corrigir." : feito === "promotor" ? "Que bom que deu tudo certo. Contamos com vocês na próxima!" : "Sua opinião ajuda a melhorar o nosso serviço."}</div></div>);
  if (p.status === "encerrada") return pagina(<div style={{ fontSize: 15 }}>Esta pesquisa foi encerrada. Obrigado!</div>);
  return pagina(<>
    <div style={{ fontSize: 15 }}>Olá{p.contato ? `, ${p.contato}` : ""}!{p.referencia ? <> Sobre o serviço <b>{p.referencia}</b>:</> : ""}</div>
    <div style={{ fontSize: 18, fontWeight: 700, margin: "14px 0 12px" }}>De 0 a 10, quanto você recomendaria a {p.empresa} a um colega ou parceiro?</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(11, 1fr)", gap: 4 }}>{Array.from({ length: 11 }, (_, i) => <button key={i} type="button" onClick={() => setNota(i)} style={{ padding: "12px 0", borderRadius: 8, border: `2px solid ${nota === i ? cor(i) : "#d4d4d8"}`, background: nota === i ? cor(i) : "#fff", color: nota === i ? "#fff" : "#111", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{i}</button>)}</div>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#777", marginTop: 4 }}><span>nada provável</span><span>com certeza</span></div>
    {nota != null && <>
      <div style={{ fontWeight: 600, margin: "22px 0 8px" }}>{nota <= 6 ? "O que não foi bem?" : nota <= 8 ? "O que faltou para ser 10?" : "O que mais agradou?"} <span style={{ fontWeight: 400, color: "#777", fontSize: 13 }}>(opcional)</span></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{Object.entries(p.MOTIVOS || {}).map(([k, r]) => { const on = mot.includes(k); return <button key={k} type="button" onClick={() => setMot(on ? mot.filter((x) => x !== k) : [...mot, k])} style={{ padding: "8px 12px", borderRadius: 18, border: `1px solid ${on ? "#2563eb" : "#d4d4d8"}`, background: on ? "#2563eb" : "#fff", color: on ? "#fff" : "#111", fontSize: 13.5, cursor: "pointer" }}>{r}</button>; })}</div>
      <textarea value={com} onChange={(e) => setCom(e.target.value)} maxLength={2000} rows={4} placeholder="Quer contar mais? (opcional)" style={{ width: "100%", boxSizing: "border-box", marginTop: 14, padding: 10, borderRadius: 8, border: "1px solid #d4d4d8", fontSize: 14, fontFamily: "inherit" }} />
      <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} placeholder="Seu nome (opcional)" style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: 10, borderRadius: 8, border: "1px solid #d4d4d8", fontSize: 14 }} />
      {erro && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 10 }}>{erro}</div>}
      <button type="button" onClick={enviar} disabled={env} style={{ marginTop: 16, width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer", opacity: env ? 0.6 : 1 }}>{env ? "Enviando…" : "Enviar resposta"}</button>
    </>}
  </>);
}
