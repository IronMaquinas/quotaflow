// src/plataforma/ConsolePlataforma.jsx
//
// Console da Plataforma (etapa 11b) — <endereço>/#admin
// Login próprio (plataforma_admins), separado de transportadora e fornecedor.
// Abas: Visão geral · Aprovações · Transportadoras · Fornecedores · Biblioteca de funções (12d.0) · Catálogo de EPI (12d.1b) · Biblioteca de treinamentos (12e.2a)
// Token guardado em localStorage "plataforma_token" (não mistura com o do sistema).

import { useState, useEffect, useCallback } from "react";
import { API_URL } from "../utils/constants";
import BibliotecaFuncoes from "./BibliotecaFuncoes"; // etapa 12d.0
import BibliotecaEpi from "./BibliotecaEpi"; // etapa 12d.1b
import BibliotecaTreinamentos from "./BibliotecaTreinamentos"; // etapa 12e.2a

const C = {
  bg: "#0a0e14", surface: "#111722", surface2: "#0d131d", border: "#1e2535", text: "#e2e8f0", sub: "#94a3b8",
  muted: "#64748b", accent: "#3b82f6", success: "#22c55e", warn: "#f59e0b", danger: "#ef4444", violet: "#a78bfa",
};
const input = {
  width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 12px",
  color: C.text, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
const label = { fontSize: 11, color: C.muted, letterSpacing: "0.08em", display: "block", marginBottom: 5, fontWeight: 600 };
const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10 };
const btn = (cor = C.accent, cheio = true) => ({
  background: cheio ? cor : "transparent", border: `1px solid ${cor}`, borderRadius: 6, padding: "7px 14px",
  color: cheio ? "#fff" : cor, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
});
const tag = (cor) => ({ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: `${cor}22`, color: cor, border: `1px solid ${cor}44`, whiteSpace: "nowrap" });

const CHAVE_TOKEN = "plataforma_token";
const lerToken = () => { try { return localStorage.getItem(CHAVE_TOKEN) || ""; } catch { return ""; } };
const gravarToken = (t) => { try { t ? localStorage.setItem(CHAVE_TOKEN, t) : localStorage.removeItem(CHAVE_TOKEN); } catch { /* ok */ } };

const fmtCNPJ = (v) => {
  const d = String(v || "").replace(/\D/g, "");
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : (v || "—");
};
const fmtData = (d) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const fmtDataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function chamar(token, metodo, caminho, corpo) {
  const r = await fetch(`${API_URL}/plataforma${caminho}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  let dados = null;
  try { dados = await r.json(); } catch { /* sem corpo */ }
  if (!r.ok) {
    const e = new Error(dados?.erro || `Erro ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return dados;
}

// ─── Login ──────────────────────────────────────────────────────────────────
function Login({ onEntrar }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const r = await chamar(null, "POST", "/login", { email: email.trim(), senha });
      gravarToken(r.token);
      onEntrar(r.token, r.admin);
    } catch (err) {
      setErro(err.message);
      setEnviando(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <form onSubmit={entrar} style={{ ...card, width: "100%", maxWidth: 380, padding: "28px 26px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 20 }}>🛡️</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Console da Plataforma</span>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>Acesso restrito à equipe da plataforma.</div>
        <div style={{ marginBottom: 12 }}>
          <label style={label}>E-MAIL</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={input} autoFocus autoComplete="username" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>SENHA</label>
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} style={input} autoComplete="current-password" />
        </div>
        {erro && <div style={{ fontSize: 12, color: C.danger, marginBottom: 12 }}>⚠ {erro}</div>}
        <button type="submit" disabled={enviando} style={{ ...btn(), width: "100%", padding: 12, fontSize: 14, opacity: enviando ? 0.6 : 1 }}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

// ─── Peças ──────────────────────────────────────────────────────────────────
function Numero({ rotulo, valor, cor = C.text, ajuda }) {
  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", fontWeight: 700 }}>{rotulo}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: cor, marginTop: 4 }}>{valor}</div>
      {ajuda && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{ajuda}</div>}
    </div>
  );
}

const NOME_ACAO = { aprovar: "aprovou", recusar: "recusou", excluir: "excluiu", login: "entrou no console" };

function VisaoGeral({ dados }) {
  if (!dados) return <div style={{ color: C.muted }}>Carregando…</div>;
  const { transportadoras: t, fornecedores: f, spot, ultimas_acoes: acoes } = dados;
  const grade = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 22 };
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, letterSpacing: "0.08em", marginBottom: 10 }}>🚚 TRANSPORTADORAS</div>
      <div style={grade}>
        <Numero rotulo="TOTAL" valor={t.total} />
        <Numero rotulo="AGUARDANDO APROVAÇÃO" valor={t.pendentes} cor={t.pendentes ? C.warn : C.text} />
        <Numero rotulo="EM TESTE" valor={t.em_teste} ajuda={t.teste_vencido ? `${t.teste_vencido} com teste vencido` : null} />
        <Numero rotulo="NOVAS (7 DIAS)" valor={t.novas_7_dias} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, letterSpacing: "0.08em", marginBottom: 10 }}>🔧 FORNECEDORES</div>
      <div style={grade}>
        <Numero rotulo="VERIFICADOS" valor={f.verificados} cor={C.success} ajuda={f.pro ? `${f.pro} no plano Pro` : null} />
        <Numero rotulo="LOCAIS (DOS TENANTS)" valor={f.locais} />
        <Numero rotulo="AGUARDANDO APROVAÇÃO" valor={f.pendentes} cor={f.pendentes ? C.warn : C.text} ajuda={f.recusados ? `${f.recusados} recusado(s)` : null} />
        <Numero rotulo="NOVOS (7 DIAS)" valor={f.novos_7_dias} />
        <Numero rotulo="DEMANDAS SPOT ABERTAS" valor={spot.demandas_abertas} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, letterSpacing: "0.08em", marginBottom: 10 }}>🕑 ÚLTIMAS AÇÕES NO CONSOLE</div>
      <div style={{ ...card, padding: acoes.length ? 0 : 16 }}>
        {acoes.length === 0 && <div style={{ fontSize: 12, color: C.muted }}>Nenhuma ação registrada ainda.</div>}
        {acoes.map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "10px 16px", borderBottom: i < acoes.length - 1 ? `1px solid ${C.border}` : "none", fontSize: 12, color: C.sub, flexWrap: "wrap" }}>
            <span style={{ color: C.muted, minWidth: 110 }}>{fmtDataHora(a.criado_em)}</span>
            <span style={{ color: C.text }}>{a.admin_email}</span>
            <span>{NOME_ACAO[a.acao] || a.acao}</span>
            {a.alvo_tipo && <span>{a.alvo_tipo === "tenant" ? "transportadora" : "fornecedor"} <b style={{ color: C.text }}>{a.detalhes?.nome || `#${a.alvo_id}`}</b></span>}
            {a.detalhes?.motivo && <span style={{ color: C.muted }}>— {a.detalhes.motivo}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Linha({ rotulo, receita, digitado }) {
  const difere = receita && digitado && semAcento(receita).replace(/\W/g, "") !== semAcento(digitado).replace(/\W/g, "");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr", gap: 10, fontSize: 12, padding: "4px 0", borderBottom: `1px dashed ${C.border}` }}>
      <span style={{ color: C.muted }}>{rotulo}</span>
      <span style={{ color: C.sub }}>{receita || "—"}</span>
      <span style={{ color: difere ? C.warn : C.text }}>{digitado || "—"}{difere ? " ≠" : ""}</span>
    </div>
  );
}

function CartaoPendente({ item, tipo, onAcao, ocupado }) {
  const r = item.receita || {};
  const recusado = tipo === "tenant" ? item.aprovacao_status === "recusado" : !!item.recusado_em;
  const confirmados = (item.logins || []).filter((l) => l.email_confirmado).length;
  const totalLogins = (item.logins || []).length;
  return (
    <div style={{ ...card, padding: "16px 18px", marginBottom: 12, borderLeft: `4px solid ${recusado ? C.danger : C.warn}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{item.nome}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            CNPJ {fmtCNPJ(item.cnpj)} · cadastrado em {fmtDataHora(item.criado_em)}
            {tipo === "tenant" && item.dias_teste != null ? ` · teste: ${item.dias_teste} dia(s)` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {recusado
            ? <span style={tag(C.danger)}>RECUSADO</span>
            : <span style={tag(C.warn)}>AGUARDANDO</span>}
          {totalLogins > 0 && (confirmados === totalLogins
            ? <span style={tag(C.success)}>✓ E-MAIL CONFIRMADO</span>
            : <span style={tag(C.muted)}>E-MAIL NÃO CONFIRMADO</span>)}
          {!item.receita && <span style={tag(C.danger)}>SEM DADOS DA RECEITA</span>}
        </div>
      </div>

      {recusado && item.aprovacao_obs && (
        <div style={{ fontSize: 12, color: C.danger, marginTop: 8 }}>Motivo da recusa: {item.aprovacao_obs}</div>
      )}

      {(item.alertas || []).length > 0 && (
        <div style={{ marginTop: 10, padding: "8px 12px", background: `${C.warn}12`, border: `1px solid ${C.warn}44`, borderRadius: 6 }}>
          {item.alertas.map((a, i) => <div key={i} style={{ fontSize: 12, color: C.warn }}>⚠ {a.texto}</div>)}
        </div>
      )}
      {item.global_mesmo_cnpj && (
        <div style={{ fontSize: 12, color: C.danger, marginTop: 8 }}>⛔ Já existe fornecedor verificado com este CNPJ — provável duplicado: exclua.</div>
      )}
      {item.locais_mesmo_cnpj > 0 && (
        <div style={{ fontSize: 12, color: C.violet, marginTop: 8 }}>
          ℹ {item.locais_mesmo_cnpj} transportadora(s) já têm este CNPJ como fornecedor local. Ao aprovar, eles ainda verão o cadastro local separado (a junção pelo CNPJ vem numa próxima etapa).
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr", gap: 10, fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 2 }}>
          <span /><span>RECEITA FEDERAL</span><span>INFORMADO NO CADASTRO</span>
        </div>
        <Linha rotulo="Nome" receita={r.nome_fantasia || r.razao_social} digitado={item.nome} />
        <Linha rotulo="Razão social" receita={r.razao_social} digitado={item.razao_social} />
        <Linha rotulo="Situação" receita={r.situacao} />
        <Linha rotulo="Atividade" receita={r.cnae_descricao} />
        <Linha rotulo="Abertura" receita={r.abertura ? fmtData(r.abertura) : null} />
        <Linha rotulo="Cidade" receita={[r.cidade, r.estado].filter(Boolean).join("/")} digitado={tipo === "tenant" ? item.regiao : [item.cidade, item.estado].filter(Boolean).join("/")} />
        <Linha rotulo="Telefone" receita={r.telefone} digitado={item.telefone} />
        {(item.logins || []).map((l) => (
          <Linha key={l.id} rotulo={tipo === "tenant" ? "Responsável" : "Login"} receita={r.email ? `Receita: ${r.email}` : null}
            digitado={`${l.nome || ""} · ${l.email}${l.email_confirmado ? " ✓" : ""}`} />
        ))}
        {tipo === "fornecedor" && (
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
            Atuação: {item.atuacao.segmentos} segmento(s), {item.atuacao.sistemas} sistema(s), {item.atuacao.marcas} marca(s)
            {item.atuacao.ufs.length ? ` · atende ${item.atuacao.ufs.join(", ")}` : ""}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button type="button" disabled={ocupado} onClick={() => onAcao("aprovar", item)} style={{ ...btn(C.success), opacity: ocupado ? 0.5 : 1 }}>✓ Aprovar</button>
        {!recusado && <button type="button" disabled={ocupado} onClick={() => onAcao("recusar", item)} style={{ ...btn(C.warn, false), opacity: ocupado ? 0.5 : 1 }}>Recusar…</button>}
        <button type="button" disabled={ocupado} onClick={() => onAcao("excluir", item)} style={{ ...btn(C.danger, false), opacity: ocupado ? 0.5 : 1 }}>🗑 Excluir cadastro</button>
      </div>
    </div>
  );
}

function Aprovacoes({ dados, onAcao, ocupadoId }) {
  if (!dados) return <div style={{ color: C.muted }}>Carregando…</div>;
  const vazio = (t) => <div style={{ ...card, padding: 16, fontSize: 13, color: C.muted, marginBottom: 20 }}>{t}</div>;
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, letterSpacing: "0.08em", marginBottom: 10 }}>
        🚚 TRANSPORTADORAS · {dados.transportadoras.length}
      </div>
      {dados.transportadoras.length === 0 && vazio("Nenhuma transportadora aguardando.")}
      {dados.transportadoras.map((t) => (
        <CartaoPendente key={`t${t.id}`} item={t} tipo="tenant" ocupado={ocupadoId === `tenant:${t.id}`} onAcao={(a, it) => onAcao(a, "tenant", it)} />
      ))}
      <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, letterSpacing: "0.08em", margin: "18px 0 10px" }}>
        🔧 FORNECEDORES · {dados.fornecedores.length}
      </div>
      {dados.fornecedores.length === 0 && vazio("Nenhum fornecedor aguardando.")}
      {dados.fornecedores.map((f) => (
        <CartaoPendente key={`f${f.id}`} item={f} tipo="fornecedor" ocupado={ocupadoId === `fornecedor:${f.id}`} onAcao={(a, it) => onAcao(a, "fornecedor", it)} />
      ))}
    </div>
  );
}

function Tabela({ colunas, linhas, vazio }) {
  return (
    <div style={{ ...card, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>{colunas.map((c) => <th key={c.k} style={{ textAlign: "left", padding: "10px 12px", color: C.muted, fontSize: 10, letterSpacing: "0.08em", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{c.t}</th>)}</tr>
        </thead>
        <tbody>
          {linhas.length === 0 && <tr><td colSpan={colunas.length} style={{ padding: 16, color: C.muted }}>{vazio}</td></tr>}
          {linhas.map((l, i) => (
            <tr key={l.id ?? i} style={{ borderBottom: `1px solid ${C.border}` }}>
              {colunas.map((c) => <td key={c.k} style={{ padding: "9px 12px", color: C.text, verticalAlign: "top" }}>{c.r ? c.r(l) : (l[c.k] ?? "—")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STATUS_TENANT = { aprovado: ["APROVADA", C.success], pendente: ["AGUARDANDO", C.warn], recusado: ["RECUSADA", C.danger] };
const TIPO_FORN = { global: ["🏅 VERIFICADO", C.success], local: ["LOCAL", C.muted], candidato: ["AGUARDANDO", C.warn] };

function Lista({ tipo, dados }) {
  const [busca, setBusca] = useState("");
  if (!dados) return <div style={{ color: C.muted }}>Carregando…</div>;
  const termo = semAcento(busca).trim();
  const linhas = dados.filter((l) => !termo || semAcento(`${l.nome} ${l.cnpj} ${l.razao_social || ""} ${l.email || l.email_admin || ""} ${l.tenant || ""}`).includes(termo));
  const colunas = tipo === "tenant"
    ? [
        { k: "nome", t: "TRANSPORTADORA", r: (l) => <><div style={{ fontWeight: 600 }}>{l.nome}</div><div style={{ color: C.muted }}>{fmtCNPJ(l.cnpj)}</div></> },
        { k: "status", t: "SITUAÇÃO", r: (l) => { const [t, c] = STATUS_TENANT[l.aprovacao_status] || [l.aprovacao_status, C.muted]; return <span style={tag(c)}>{t}</span>; } },
        { k: "plano", t: "PLANO", r: (l) => <>{l.plano || "—"}{l.dias_teste != null ? <div style={{ color: l.dias_teste <= 0 ? C.danger : C.muted }}>{l.dias_teste <= 0 ? "teste vencido" : `${l.dias_teste} dia(s) de teste`}</div> : null}</> },
        { k: "regiao", t: "UF" },
        { k: "usuarios", t: "USUÁRIOS" },
        { k: "email_admin", t: "E-MAIL" },
        { k: "criado_em", t: "DESDE", r: (l) => fmtData(l.criado_em) },
      ]
    : [
        { k: "nome", t: "FORNECEDOR", r: (l) => <><div style={{ fontWeight: 600 }}>{l.nome}</div><div style={{ color: C.muted }}>{fmtCNPJ(l.cnpj)}</div></> },
        { k: "tipo", t: "TIPO", r: (l) => { const [t, c] = TIPO_FORN[l.tipo] || [l.tipo, C.muted]; return <span style={tag(l.tipo === "candidato" && l.recusado_em ? C.danger : c)}>{l.tipo === "candidato" && l.recusado_em ? "RECUSADO" : t}</span>; } },
        { k: "tenant", t: "DE QUEM", r: (l) => l.tenant || (l.tipo === "local" ? "—" : "plataforma") },
        { k: "cidade", t: "CIDADE", r: (l) => [l.cidade, l.estado].filter(Boolean).join("/") || "—" },
        { k: "plano", t: "PLANO", r: (l) => (l.tipo === "global" ? l.plano : "—") },
        { k: "portal", t: "PORTAL", r: (l) => (l.portal ? "🟢" : "—") },
        { k: "criado_em", t: "DESDE", r: (l) => fmtData(l.criado_em) },
      ];
  return (
    <div>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, CNPJ, e-mail…" style={{ ...input, maxWidth: 360, marginBottom: 12, padding: "8px 12px", fontSize: 13 }} />
      <Tabela colunas={colunas} linhas={linhas} vazio="Nada encontrado." />
    </div>
  );
}

// Modal simples para recusa (motivo) e confirmações
function Modal({ titulo, children, onFechar }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }} onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "100%", maxWidth: 460, padding: "20px 22px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 12 }}>{titulo}</div>
        {children}
      </div>
    </div>
  );
}

// ─── Console ────────────────────────────────────────────────────────────────
export default function ConsolePlataforma() {
  const [token, setToken] = useState(lerToken);
  const [admin, setAdmin] = useState(null);
  const [aba, setAba] = useState("aprovacoes");
  const [visao, setVisao] = useState(null);
  const [pend, setPend] = useState(null);
  const [tenants, setTenants] = useState(null);
  const [forns, setForns] = useState(null);
  const [aviso, setAviso] = useState(null); // { tipo: 'ok'|'erro', texto }
  const [ocupadoId, setOcupadoId] = useState(null);
  const [acao, setAcao] = useState(null); // { acao, tipo, item }
  const [motivo, setMotivo] = useState("");

  const sair = useCallback(() => { gravarToken(""); setToken(""); setAdmin(null); }, []);

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      const [me, v, p, t, f] = await Promise.all([
        chamar(token, "GET", "/me"),
        chamar(token, "GET", "/visao-geral"),
        chamar(token, "GET", "/pendentes"),
        chamar(token, "GET", "/transportadoras"),
        chamar(token, "GET", "/fornecedores"),
      ]);
      setAdmin(me.admin); setVisao(v); setPend(p); setTenants(t); setForns(f);
    } catch (err) {
      if (err.status === 401 || err.status === 403) sair();
      else setAviso({ tipo: "erro", texto: err.message });
    }
  }, [token, sair]);

  useEffect(() => { carregar(); }, [carregar]);

  if (!token) return <Login onEntrar={(t, a) => { setToken(t); setAdmin(a); }} />;

  const executar = async () => {
    const { acao: qual, tipo, item } = acao;
    const base = tipo === "tenant" ? "/transportadoras" : "/fornecedores";
    setOcupadoId(`${tipo}:${item.id}`);
    setAcao(null);
    try {
      if (qual === "aprovar") await chamar(token, "POST", `${base}/${item.id}/aprovar`);
      if (qual === "recusar") await chamar(token, "POST", `${base}/${item.id}/recusar`, { motivo });
      if (qual === "excluir") await chamar(token, "DELETE", `${base}/${item.id}`);
      const feito = { aprovar: "aprovado(a) — a empresa foi avisada por e-mail", recusar: "recusado(a) — a empresa foi avisada por e-mail", excluir: "excluído(a)" }[qual];
      setAviso({ tipo: "ok", texto: `${item.nome}: ${feito}.` });
      await carregar();
    } catch (err) {
      setAviso({ tipo: "erro", texto: err.message });
    } finally {
      setOcupadoId(null);
      setMotivo("");
    }
  };

  const qtdPendentes = pend
    ? pend.transportadoras.filter((t) => t.aprovacao_status === "pendente").length + pend.fornecedores.filter((f) => !f.recusado_em).length
    : 0;
  const abas = [
    { id: "visao", t: "Visão geral" },
    { id: "aprovacoes", t: `Aprovações${qtdPendentes ? ` (${qtdPendentes})` : ""}` },
    { id: "transportadoras", t: "Transportadoras" },
    { id: "fornecedores", t: "Fornecedores" },
    { id: "funcoes", t: "📚 Biblioteca de funções" },
    { id: "epi", t: "🦺 Catálogo de EPI" },
    { id: "treinamentos", t: "🎓 Biblioteca de treinamentos" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 24px", borderBottom: `1px solid ${C.border}`, background: C.surface, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>🛡️</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Console da Plataforma</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: C.sub }}>
          <span>{admin?.email}</span>
          <button type="button" onClick={carregar} style={btn(C.muted, false)}>↻ Atualizar</button>
          <button type="button" onClick={sair} style={btn(C.muted, false)}>Sair</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, padding: "0 24px", borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
        {abas.map((a) => (
          <button key={a.id} type="button" onClick={() => setAba(a.id)}
            style={{ background: "transparent", border: "none", borderBottom: `2px solid ${aba === a.id ? C.accent : "transparent"}`, padding: "12px 14px", color: aba === a.id ? C.text : C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            {a.t}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px 24px 60px", maxWidth: 1100 }}>
        {aviso && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 14px", borderRadius: 7, marginBottom: 16, fontSize: 13,
            background: aviso.tipo === "ok" ? `${C.success}18` : `${C.danger}18`, border: `1px solid ${aviso.tipo === "ok" ? C.success : C.danger}55`, color: aviso.tipo === "ok" ? C.success : C.danger }}>
            <span>{aviso.tipo === "ok" ? "✓" : "⚠"} {aviso.texto}</span>
            <button type="button" onClick={() => setAviso(null)} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 15 }}>×</button>
          </div>
        )}
        {aba === "visao" && <VisaoGeral dados={visao} />}
        {aba === "aprovacoes" && <Aprovacoes dados={pend} ocupadoId={ocupadoId} onAcao={(a, tipo, item) => { setMotivo(""); setAcao({ acao: a, tipo, item }); }} />}
        {aba === "transportadoras" && <Lista tipo="tenant" dados={tenants} />}
        {aba === "fornecedores" && <Lista tipo="fornecedor" dados={forns} />}
        {aba === "funcoes" && <BibliotecaFuncoes token={token} chamar={chamar} C={C} input={input} label={label} card={card} btn={btn} tag={tag} onAviso={setAviso} />}
        {aba === "epi" && <BibliotecaEpi token={token} chamar={chamar} C={C} input={input} label={label} card={card} btn={btn} tag={tag} onAviso={setAviso} />}
        {aba === "treinamentos" && <BibliotecaTreinamentos token={token} chamar={chamar} C={C} input={input} label={label} card={card} btn={btn} tag={tag} onAviso={setAviso} />}
      </div>

      {acao && (
        <Modal
          titulo={{ aprovar: "Aprovar cadastro", recusar: "Recusar cadastro", excluir: "Excluir cadastro" }[acao.acao]}
          onFechar={() => setAcao(null)}
        >
          <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6, marginBottom: 14 }}>
            {acao.acao === "aprovar" && (acao.tipo === "tenant"
              ? <>Aprovar <b style={{ color: C.text }}>{acao.item.nome}</b>? O Canal Spot é liberado e a empresa recebe um e-mail.</>
              : <>Aprovar <b style={{ color: C.text }}>{acao.item.nome}</b> como fornecedor verificado? Ele passa a ver o Canal Spot, aparece para todas as transportadoras e recebe um e-mail.</>)}
            {acao.acao === "recusar" && <>Recusar <b style={{ color: C.text }}>{acao.item.nome}</b>. O motivo vai no e-mail para a empresa:</>}
            {acao.acao === "excluir" && <>Excluir <b style={{ color: C.text }}>{acao.item.nome}</b> e todos os logins dele? <b style={{ color: C.danger }}>Não dá para desfazer.</b></>}
          </div>
          {acao.acao === "recusar" && (
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={500} autoFocus
              placeholder="Ex.: a atividade da empresa (CNAE) não é de peças ou serviços para transporte."
              style={{ ...input, resize: "vertical", marginBottom: 14 }} />
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={() => setAcao(null)} style={btn(C.muted, false)}>Cancelar</button>
            <button type="button" onClick={executar} disabled={acao.acao === "recusar" && !motivo.trim()}
              style={{ ...btn({ aprovar: C.success, recusar: C.warn, excluir: C.danger }[acao.acao]), opacity: acao.acao === "recusar" && !motivo.trim() ? 0.5 : 1 }}>
              {{ aprovar: "Aprovar e avisar", recusar: "Recusar e avisar", excluir: "Excluir definitivamente" }[acao.acao]}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
