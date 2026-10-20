// src/TelaProvaPublica.jsx — etapa 12e.2b
// Link externo da prova (#prova?t=<token>) — "em último caso", para quem não tem usuário no sistema.
// A pessoa confirma quem é com CPF + data de nascimento (têm de bater com um participante da turma);
// a sessão vale 3 h e fica só nesta aba (sessionStorage). Sem login do QuotaFlow.
import { useState, useEffect } from "react";
import AulaEProva, { CORES as C, card, botao } from "./components/pessoas/AreaTreinamentoColaborador";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const tokenDaUrl = () => { const h = window.location.hash || ""; const m = h.match(/[?&]t=([a-f0-9]{32,64})/i); return m ? m[1] : ""; };
const CHAVE = "prova_sessao";
const lerSessao = (tk) => { try { const v = JSON.parse(sessionStorage.getItem(CHAVE) || "null"); return v && v.tk === tk ? v : null; } catch { return null; } };
const mascCPF = (v) => { const d = String(v).replace(/\D/g, "").slice(0, 11); return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2"); };
const input = { width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", color: C.text, fontSize: 16, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

export default function TelaProvaPublica() {
  const tk = tokenDaUrl();
  const [info, setInfo] = useState(null);
  const [erro, setErro] = useState("");
  const [sessao, setSessao] = useState(() => lerSessao(tk));
  const [cpf, setCpf] = useState("");
  const [nasc, setNasc] = useState("");
  const [entrando, setEntrando] = useState(false);

  const chamar = async (metodo, caminho, corpo, comSessao = true) => {
    const r = await fetch(`${API}/prova/${tk}${caminho}`, { method: metodo, headers: { "Content-Type": "application/json", ...(comSessao && sessao ? { "X-Sessao-Prova": sessao.s } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && comSessao) { try { sessionStorage.removeItem(CHAVE); } catch { /* ok */ } setSessao(null); }
    if (!r.ok) throw new Error(j.erro || "Erro de conexão");
    return j;
  };
  useEffect(() => { if (!tk) { setErro("Link incompleto."); return; } chamar("GET", "", null, false).then(setInfo).catch((e) => setErro(e.message)); }, []); // eslint-disable-line

  const entrar = async () => {
    setEntrando(true); setErro("");
    try {
      const r = await chamar("POST", "/entrar", { cpf, nascimento: nasc }, false);
      const v = { tk, s: r.sessao, nome: r.nome };
      try { sessionStorage.setItem(CHAVE, JSON.stringify(v)); } catch { /* ok */ }
      setSessao(v);
    } catch (e) { setErro(e.message); }
    finally { setEntrando(false); }
  };
  const sair = () => { try { sessionStorage.removeItem(CHAVE); } catch { /* ok */ } setSessao(null); setCpf(""); setNasc(""); };

  const api = {
    abrir: () => chamar("GET", "/treinamento"),
    material: (_t, i) => chamar("GET", `/material/${i}`),
    prova: (_t, respostas) => chamar("POST", "/prova", { respostas }),
    concluir: () => chamar("POST", "/concluir", {}),
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 18, flex: 1 }}>QuotaFlow <span style={{ color: C.muted, fontWeight: 400, fontSize: 13 }}>· {info?.empresa || "treinamento"}</span></div>
          {sessao && <button onClick={sair} style={{ background: "none", border: `1px solid ${C.border}`, color: C.textSub, borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>Sair ({String(sessao.nome || "").split(" ")[0]})</button>}
        </div>
        {!info && erro ? <div style={{ ...card, padding: 20, color: C.danger }}>{erro}</div>
          : !info ? <div style={{ color: C.muted }}>Carregando…</div>
          : sessao ? <AulaEProva api={api} turmaId={tk} />
          : (
            <div style={{ ...card, padding: 22, maxWidth: 420, margin: "30px auto 0" }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>🎓 {info.treinamento}</div>
              <div style={{ fontSize: 13, color: C.textSub, margin: "6px 0 18px" }}>{info.encerrada ? "Esta turma já foi encerrada." : "Para começar, confirme quem você é."}</div>
              {!info.encerrada && (<>
                <label style={{ display: "block", marginBottom: 12 }}><span style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: ".08em" }}>CPF</span>
                  <input value={cpf} onChange={(e) => setCpf(mascCPF(e.target.value))} inputMode="numeric" placeholder="000.000.000-00" style={input} /></label>
                <label style={{ display: "block", marginBottom: 16 }}><span style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: ".08em" }}>DATA DE NASCIMENTO</span>
                  <input type="date" value={nasc} onChange={(e) => setNasc(e.target.value)} style={input} /></label>
                {erro && <div style={{ color: C.danger, fontSize: 13, marginBottom: 12 }}>{erro}</div>}
                <button disabled={entrando || cpf.replace(/\D/g, "").length !== 11 || !nasc} onClick={entrar} style={{ ...botao(!entrando && cpf.replace(/\D/g, "").length === 11 && !!nasc), width: "100%" }}>{entrando ? "Conferindo…" : "Entrar"}</button>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 14, lineHeight: 1.5 }}>Seus dados são usados só para confirmar sua identidade e registrar o treinamento (LGPD). A prova feita aqui vale como sua assinatura do exame.</div>
              </>)}
            </div>
          )}
      </div>
    </div>
  );
}
