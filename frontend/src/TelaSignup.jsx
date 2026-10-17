// src/TelaSignup.jsx
//
// "Criar conta" (etapa 11a) — dois caminhos, escolhidos no topo:
//   • Transportadora → POST /api/auth/signup
//       CNPJ (Receita) + dados + responsável. Teste grátis de 15 dias.
//       O responsável entra como gestor. Canal Spot liberado após a análise
//       da plataforma. Depois do cadastro, vai para o login com o e-mail preenchido.
//   • Fornecedor → POST /api/auth/signup-fornecedor
//       CNPJ (Receita) + contato + atuação (opcional) + login. Plano gratuito.
//       Entra direto no portal, "em análise" até a plataforma aprovar.
//
// CNPJ é obrigatório nos dois: a consulta à Receita (BrasilAPI) aqui é só a
// prévia — o servidor confere de novo e recusa CNPJ inexistente ou não ATIVO.
// Rota: #signup — registrada no main.jsx.

import { useState } from "react";
import { API_URL } from "./utils/constants";
import apiService from "./services/apiService";
import { useOpcoesAtuacao, PainelAtuacao, atuacaoVazia } from "./components/shared/SeletorAtuacao";

const C = {
  bg: "#0a0e14", surface: "#111722", border: "#1e2535", text: "#e2e8f0", textSub: "#94a3b8",
  muted: "#64748b", accent: "#3b82f6", success: "#22c55e", danger: "#ef4444", warn: "#f59e0b",
};
const input = {
  width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6,
  padding: "10px 12px", color: C.text, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
const label = { fontSize: 11, color: C.muted, letterSpacing: "0.08em", display: "block", marginBottom: 5, fontWeight: 600 };
const s = { input, label }; // para o PainelAtuacao

const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const soDigitos = (v) => String(v || "").replace(/\D/g, "");

function formatarCNPJ(v) {
  const d = soDigitos(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatarTelefone(v) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function cnpjValido(cnpj) {
  const c = soDigitos(cnpj);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const digito = (base) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((acc, p, i) => acc + p * Number(base[i]), 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return digito(c.slice(0, 12)) === Number(c[12]) && digito(c.slice(0, 13)) === Number(c[13]);
}

// A tela de login guarda qual aba estava aberta (Comprador/Fornecedor) antes de
// mandar para #signup — o main.jsx só reconhece "#signup" exato.
function tipoInicial() {
  try {
    const t = sessionStorage.getItem("qf_signup_tipo");
    if (t) { sessionStorage.removeItem("qf_signup_tipo"); return t === "fornecedor" ? "fornecedor" : "transportadora"; }
  } catch { /* sem sessionStorage */ }
  return "transportadora";
}

function Campo({ rotulo, children, ajuda }) {
  return (
    <div style={{ minWidth: 0 }}>
      <label style={label}>{rotulo}</label>
      {children}
      {ajuda && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{ajuda}</div>}
    </div>
  );
}

const linha = (colunas) => ({ display: "grid", gridTemplateColumns: colunas, gap: 10, marginBottom: 12 });

export default function TelaSignup() {
  const [tipo, setTipo] = useState(tipoInicial);
  const transportadora = tipo === "transportadora";

  const [cnpj, setCnpj] = useState("");
  const [receita, setReceita] = useState(null); // { situacao: 'buscando'|'ok'|'erro', dados?, texto? }
  const [empresaNome, setEmpresaNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [atuacao, setAtuacao] = useState(atuacaoVazia);
  const [mostrarAtuacao, setMostrarAtuacao] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [criada, setCriada] = useState(null); // transportadora criada: { email, teste_ate }
  const { opcoes: opcoesAtuacao } = useOpcoesAtuacao();

  const trocarTipo = (t) => { setTipo(t); setErro(""); };

  const buscarReceita = async (formatado) => {
    const c = soDigitos(formatado);
    if (c.length !== 14) { setReceita(null); return; }
    if (!cnpjValido(c)) { setReceita({ situacao: "erro", texto: "CNPJ inválido. Confira os 14 dígitos." }); return; }
    setReceita({ situacao: "buscando" });
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${c}`);
      if (res.status === 404 || res.status === 400) {
        setReceita({ situacao: "erro", texto: "CNPJ não encontrado na Receita Federal." });
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const d = await res.json();
      const sit = String(d.descricao_situacao_cadastral || "").toUpperCase();
      if (sit && sit !== "ATIVA") {
        setReceita({ situacao: "erro", texto: `Este CNPJ consta como "${d.descricao_situacao_cadastral}" na Receita. Só empresas ATIVAS podem se cadastrar.` });
        return;
      }
      setReceita({ situacao: "ok", dados: d });
      setEmpresaNome((atual) => atual || d.nome_fantasia || d.razao_social || "");
      if (d.ddd_telefone_1) setTelefone((atual) => atual || formatarTelefone(d.ddd_telefone_1));
    } catch {
      // a prévia falhou, mas o servidor tenta de novo no envio
      setReceita({ situacao: "aviso", texto: "Não consegui consultar a Receita agora. Pode seguir — conferimos de novo ao criar a conta." });
    }
  };

  const criarConta = async (e) => {
    e.preventDefault();
    setErro("");
    if (!cnpjValido(cnpj)) return setErro("Informe um CNPJ válido.");
    if (receita?.situacao === "erro") return setErro(receita.texto);
    if (!empresaNome.trim()) return setErro(transportadora ? "Informe o nome da empresa." : "Informe o nome fantasia.");
    if (!nome.trim()) return setErro("Informe o seu nome.");
    if (!EMAIL_VALIDO.test(email.trim())) return setErro("Informe um e-mail válido.");
    if (senha.length < 6) return setErro("A senha deve ter ao menos 6 caracteres.");
    if (senha !== confirmar) return setErro("A confirmação não confere com a senha.");

    setEnviando(true);
    try {
      const corpo = transportadora
        ? { cnpj: soDigitos(cnpj), empresa_nome: empresaNome.trim(), nome: nome.trim(), email: email.trim(), telefone, senha }
        : {
            cnpj: soDigitos(cnpj), nome: nome.trim(), email: email.trim(), senha,
            empresa: { nome_fantasia: empresaNome.trim(), telefone, whatsapp, ...atuacao },
          };
      const r = await fetch(`${API_URL}${transportadora ? "/auth/signup" : "/auth/signup-fornecedor"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const data = await r.json();
      if (!r.ok) {
        setErro(data.erro || "Não foi possível criar a conta.");
        setEnviando(false);
        return;
      }

      if (transportadora) {
        setCriada({ email: data.usuario?.email || email.trim(), teste_ate: data.tenant?.teste_ate || null });
        setEnviando(false);
        return;
      }

      // Fornecedor: mesmo efeito do login de fornecedor (TelaLogin + App.login)
      const usuario = {
        id: data.usuario.id,
        nome: data.usuario.nome,
        email: data.usuario.email,
        perfil: data.usuario.perfil || "fornecedor",
        ativo: true,
        access_token: data.token,
        fornecedor_id: data.usuario.fornecedor_id,
      };
      localStorage.setItem("access_token", data.token);
      localStorage.setItem("refresh_token", "");
      localStorage.setItem("user_type", "fornecedor");
      localStorage.setItem("usuario", JSON.stringify(usuario));
      if (typeof apiService.setToken === "function") apiService.setToken(data.token);
      window.location.hash = "#/portal";
    } catch {
      setErro("Erro de conexão com o servidor.");
      setEnviando(false);
    }
  };

  const irParaLogin = (prefill) => {
    try {
      if (prefill) sessionStorage.setItem("qf_login_prefill", JSON.stringify(prefill));
    } catch { /* sem sessionStorage: só não preenche */ }
    window.location.hash = "#login";
  };

  // ─── Transportadora criada ───
  if (criada) {
    const ate = criada.teste_ate ? new Date(criada.teste_ate).toLocaleDateString("pt-BR") : null;
    return (
      <Moldura>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>Conta criada!</div>
          <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.6, marginBottom: 6 }}>
            Seu teste grátis já começou{ate ? <> e vai até <b style={{ color: C.text }}>{ate}</b></> : null}.
          </div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>
            O sistema já está liberado. O <b style={{ color: C.textSub }}>Canal Spot</b> (publicar demandas para a rede de
            fornecedores) é liberado depois de uma análise rápida dos dados da empresa pela nossa equipe.
          </div>
          <button type="button" onClick={() => irParaLogin({ email: criada.email, fornecedor: false })}
            style={{ width: "100%", background: C.accent, border: "none", borderRadius: 6, padding: 13, color: "#fff", fontWeight: 600, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
            Entrar
          </button>
        </div>
      </Moldura>
    );
  }

  const r = receita?.dados;

  return (
    <Moldura largura={620}>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>Criar conta</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>Escolha como sua empresa vai usar o QuotaFlow.</div>

      {/* Tipo de conta */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
        {[
          { id: "transportadora", titulo: "🚚 Sou transportadora", texto: "Compras, estoque, OS e fornecedores. Teste grátis de 15 dias." },
          { id: "fornecedor", titulo: "🔧 Sou fornecedor", texto: "Receba cotações e pedidos das transportadoras. Gratuito." },
        ].map((o) => (
          <button key={o.id} type="button" onClick={() => trocarTipo(o.id)}
            style={{
              textAlign: "left", padding: "12px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
              background: tipo === o.id ? `${C.accent}18` : "transparent",
              border: `1px solid ${tipo === o.id ? C.accent : C.border}`,
            }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: tipo === o.id ? C.text : C.textSub }}>{o.titulo}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4, lineHeight: 1.4 }}>{o.texto}</div>
          </button>
        ))}
      </div>

      <form onSubmit={criarConta}>
        {/* Empresa */}
        <div style={{ marginBottom: 12 }}>
          <label style={label}>CNPJ DA EMPRESA</label>
          <input
            value={cnpj}
            onChange={(e) => {
              const v = formatarCNPJ(e.target.value);
              setCnpj(v);
              if (soDigitos(v).length === 14) buscarReceita(v); else setReceita(null);
            }}
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
            style={input}
            autoFocus
          />
          {receita?.situacao === "buscando" && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>⏳ Consultando a Receita Federal…</div>}
          {receita?.situacao === "erro" && <div style={{ fontSize: 11, color: C.danger, marginTop: 6 }}>⚠ {receita.texto}</div>}
          {receita?.situacao === "aviso" && <div style={{ fontSize: 11, color: C.warn, marginTop: 6 }}>⚠ {receita.texto}</div>}
          {receita?.situacao === "ok" && (
            <div style={{ marginTop: 8, padding: "10px 12px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, lineHeight: 1.5 }}>
              <div style={{ color: C.text, fontWeight: 600 }}>
                {r.razao_social}
                <span style={{ marginLeft: 8, fontSize: 10, color: C.success }}>✓ ATIVA na Receita</span>
              </div>
              <div style={{ color: C.muted }}>
                {[r.municipio, r.uf].filter(Boolean).join("/")}
                {r.cnae_fiscal_descricao ? ` · ${r.cnae_fiscal_descricao}` : ""}
              </div>
            </div>
          )}
        </div>

        <div style={linha(transportadora ? "1fr 1fr" : "1fr 1fr 1fr")}>
          <Campo rotulo={transportadora ? "NOME DA EMPRESA" : "NOME FANTASIA"}>
            <input value={empresaNome} onChange={(e) => setEmpresaNome(e.target.value)} style={input} />
          </Campo>
          <Campo rotulo="TELEFONE">
            <input value={telefone} onChange={(e) => setTelefone(formatarTelefone(e.target.value))} inputMode="tel" style={input} />
          </Campo>
          {!transportadora && (
            <Campo rotulo="WHATSAPP">
              <input value={whatsapp} onChange={(e) => setWhatsapp(formatarTelefone(e.target.value))} inputMode="tel" placeholder="opcional" style={input} />
            </Campo>
          )}
        </div>

        {/* Atuação (fornecedor, opcional) */}
        {!transportadora && (
          <div style={{ marginBottom: 14 }}>
            {!mostrarAtuacao ? (
              <button type="button" onClick={() => setMostrarAtuacao(true)}
                style={{ width: "100%", background: "transparent", border: `1px dashed ${C.border}`, borderRadius: 6, padding: "11px 14px", color: C.text, fontSize: 13, cursor: "pointer", fontFamily: "inherit", textAlign: "left", lineHeight: 1.5 }}>
                ＋ O que você fornece <span style={{ color: C.muted }}>— opcional, dá para completar depois em Meus Dados.</span>
              </button>
            ) : opcoesAtuacao ? (
              <div style={{ padding: "14px", border: `1px solid ${C.border}`, borderRadius: 8 }}>
                <PainelAtuacao opcoes={opcoesAtuacao} valores={atuacao} onChange={setAtuacao} C={C} s={s} />
              </div>
            ) : (
              <div style={{ fontSize: 12, color: C.muted }}>Carregando opções…</div>
            )}
          </div>
        )}

        {/* Acesso */}
        <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, letterSpacing: "0.08em", margin: "18px 0 10px", paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          {transportadora ? "RESPONSÁVEL (ENTRA COMO GESTOR)" : "SEU ACESSO AO PORTAL"}
        </div>
        <div style={linha("1fr 1fr")}>
          <Campo rotulo="SEU NOME">
            <input value={nome} onChange={(e) => setNome(e.target.value)} style={input} />
          </Campo>
          <Campo rotulo={transportadora ? "E-MAIL CORPORATIVO" : "E-MAIL"} ajuda={transportadora ? null : "Também recebe as cotações e pedidos."}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={input} />
          </Campo>
        </div>
        <div style={linha("1fr 1fr")}>
          <Campo rotulo="SENHA">
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" style={input} />
          </Campo>
          <Campo rotulo="CONFIRMAR SENHA">
            <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} style={input} />
          </Campo>
        </div>

        {erro && (
          <div style={{ background: "#ef444422", border: "1px solid #ef444444", borderRadius: 7, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: C.danger, lineHeight: 1.5 }}>
            ⚠️ {erro}
          </div>
        )}

        <button type="submit" disabled={enviando || receita?.situacao === "buscando"}
          style={{ width: "100%", background: C.accent, border: "none", borderRadius: 6, padding: 13, color: "#fff", fontWeight: 600, fontSize: 15, cursor: enviando ? "not-allowed" : "pointer", opacity: enviando || receita?.situacao === "buscando" ? 0.6 : 1, fontFamily: "inherit" }}>
          {enviando ? "Criando conta…" : transportadora ? "Criar conta e começar o teste" : "Criar conta de fornecedor"}
        </button>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 12, textAlign: "center", lineHeight: 1.6 }}>
          {transportadora
            ? "15 dias grátis. O Canal Spot é liberado após a análise dos dados da empresa."
            : "Gratuito. Sua empresa passa por uma análise da plataforma antes de aparecer para as transportadoras."}
        </div>
        <div style={{ marginTop: 14, textAlign: "center" }}>
          <button type="button" onClick={() => irParaLogin(null)}
            style={{ background: "transparent", border: "none", color: C.accent, fontSize: 12, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", padding: 0 }}>
            Já tenho conta — entrar
          </button>
        </div>
      </form>
    </Moldura>
  );
}

function Moldura({ children, largura = 440 }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'DM Sans','Segoe UI',sans-serif", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: largura }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 5, height: 30, background: "#f87171", borderRadius: 2 }} />
            <span style={{ fontSize: 22, fontWeight: 700, color: C.text }}>QuotaFlow</span>
          </div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "26px 24px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
