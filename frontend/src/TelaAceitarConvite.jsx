// src/TelaAceitarConvite.jsx
//
// O fornecedor abre o link do convite (<FRONTEND_URL>/#convite?token=...).
//   • Convite de fornecedor já cadastrado (etapa 10): cria nome + senha.
//   • Convite de fornecedor NOVO (etapa 10b): preenche CNPJ (busca na Receita),
//     dados da empresa, atuação (opcional) e cria nome + senha.
//   • Etapa 10c: o tenant já informa o CNPJ no convite → CNPJ, razão social e
//     endereço vêm da Receita e ficam TRAVADOS (o backend também ignora esses
//     campos). O fornecedor completa nome fantasia, telefone, atuação e acesso.
// Nos dois casos já entra no portal (#/portal). Rota registrada no main.jsx.

import { useState, useEffect } from "react";
import { API_URL } from "./utils/constants";
import apiService from "./services/apiService";
import { useOpcoesAtuacao, PainelAtuacao, atuacaoVazia } from "./components/shared/SeletorAtuacao";
import CampoTelefone, { paraE164 } from "./components/shared/CampoTelefone"; // etapa 11a.3: telefone com país

const C = {
  bg: "#0a0e14", surface: "#111722", border: "#1e2535", text: "#e2e8f0",
  muted: "#64748b", accent: "#3b82f6", success: "#22c55e", danger: "#ef4444",
};
const input = {
  width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6,
  padding: "10px 12px", color: C.text, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
const label = { fontSize: 11, color: C.muted, letterSpacing: "0.08em", display: "block", marginBottom: 5, fontWeight: 600 };
const s = { input, label }; // para o PainelAtuacao

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

// Motivos em que o melhor caminho é entrar com o login que já existe
const MOTIVOS_IR_LOGIN = ["cnpj_global", "cnpj_ja_no_portal", "email_em_uso", "usado"];

function tokenDaUrl() {
  const h = window.location.hash || "";
  const q = h.includes("?") ? h.slice(h.indexOf("?") + 1) : "";
  return new URLSearchParams(q).get("token") || new URLSearchParams(window.location.search).get("token") || "";
}

const soDigitos = (v) => String(v || "").replace(/\D/g, "");

function formatarCNPJ(v) {
  const d = soDigitos(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatarCEP(v) {
  const d = soDigitos(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
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

const EMPRESA_VAZIA = {
  cnpj: "", nome_fantasia: "", razao_social: "", cep: "", endereco: "", numero: "",
  complemento: "", bairro: "", cidade: "", estado: "", telefone: "", whatsapp: "",
};

function Secao({ numero, titulo, ajuda, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>{numero}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{titulo}</span>
        {ajuda && <span style={{ fontSize: 11, color: C.muted }}>{ajuda}</span>}
      </div>
      {children}
    </div>
  );
}

function Campo({ rotulo, children, style }) {
  return (
    <div style={{ minWidth: 0, ...style }}>
      <label style={label}>{rotulo}</label>
      {children}
    </div>
  );
}

const linha = (colunas) => ({ display: "grid", gridTemplateColumns: colunas, gap: 10, marginBottom: 10 });

export default function TelaAceitarConvite() {
  const [token] = useState(tokenDaUrl);
  const [convite, setConvite] = useState(null); // { ok, novo, empresa, cliente, email, nome_sugerido } | { ok:false, mensagem }
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState("");
  const [motivoErro, setMotivoErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  // fornecedor novo
  const [empresa, setEmpresa] = useState(EMPRESA_VAZIA);
  const [atuacao, setAtuacao] = useState(atuacaoVazia);
  const [mostrarAtuacao, setMostrarAtuacao] = useState(false);
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false);
  const [avisoCNPJ, setAvisoCNPJ] = useState(null); // { tipo: 'ok'|'erro', texto }
  const { opcoes: opcoesAtuacao } = useOpcoesAtuacao();

  useEffect(() => {
    fetch(`${API_URL}/auth/convite/validar?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((c) => {
        setConvite(c);
        if (c?.ok && c.novo && c.nome_sugerido) setNome(c.nome_sugerido);
        const r = c?.ok && c.novo ? c.empresa_receita : null;
        if (r) {
          setEmpresa((e) => ({
            ...e,
            cnpj: formatarCNPJ(r.cnpj),
            razao_social: r.razao_social || "",
            nome_fantasia: r.nome_fantasia || r.razao_social || "",
            endereco: r.endereco || "",
            numero: r.numero || "",
            complemento: r.complemento || "",
            bairro: r.bairro || "",
            cidade: r.cidade || "",
            estado: r.estado || "",
            cep: r.cep ? formatarCEP(r.cep) : "",
            telefone: r.telefone ? paraE164(r.telefone) : "",
          }));
        }
      })
      .catch(() => setConvite({ ok: false, mensagem: "Erro de conexão com o servidor." }));
  }, [token]);

  const irParaLogin = () => { window.location.hash = "#login"; };
  const mudarEmpresa = (campo, valor) => setEmpresa((e) => ({ ...e, [campo]: valor }));

  const buscarCNPJ = async () => {
    const cnpj = soDigitos(empresa.cnpj);
    if (!cnpjValido(cnpj)) {
      setAvisoCNPJ({ tipo: "erro", texto: "CNPJ inválido. Confira os 14 dígitos." });
      return;
    }
    setBuscandoCNPJ(true);
    setAvisoCNPJ(null);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (res.status === 404) {
        setAvisoCNPJ({ tipo: "erro", texto: "CNPJ não encontrado na Receita Federal." });
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const d = await res.json();
      setEmpresa((e) => ({
        ...e,
        nome_fantasia: d.nome_fantasia || e.nome_fantasia || d.razao_social || "",
        razao_social: d.razao_social || e.razao_social,
        cep: d.cep ? formatarCEP(d.cep) : e.cep,
        endereco: d.logradouro ? [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(" ") : e.endereco,
        numero: d.numero || e.numero,
        complemento: d.complemento || e.complemento,
        bairro: d.bairro || e.bairro,
        cidade: d.municipio || e.cidade,
        estado: d.uf || e.estado,
        telefone: d.ddd_telefone_1 ? paraE164(d.ddd_telefone_1) : e.telefone,
      }));
      const situacao = String(d.descricao_situacao_cadastral || "").toUpperCase();
      if (situacao && situacao !== "ATIVA") {
        setAvisoCNPJ({ tipo: "erro", texto: `Este CNPJ consta como "${d.descricao_situacao_cadastral}" na Receita. Só empresas ATIVAS podem se cadastrar.` });
      } else {
        setAvisoCNPJ({ tipo: "ok", texto: "Dados da Receita carregados. Confira e ajuste o que precisar." });
      }
    } catch {
      setAvisoCNPJ({ tipo: "erro", texto: "Não foi possível consultar a Receita agora. Preencha os dados manualmente." });
    } finally {
      setBuscandoCNPJ(false);
    }
  };

  const criarAcesso = async (e) => {
    e.preventDefault();
    setErro("");
    setMotivoErro("");
    if (convite?.novo) {
      if (!cnpjValido(empresa.cnpj)) return setErro("Informe um CNPJ válido.");
      if (!empresa.nome_fantasia.trim()) return setErro("Informe o nome fantasia da empresa.");
      if (!empresa.cidade.trim() || !empresa.estado) return setErro("Informe a cidade e o estado da empresa.");
    }
    if (!nome.trim()) return setErro("Informe seu nome.");
    if (senha.length < 6) return setErro("A senha deve ter ao menos 6 caracteres.");
    if (senha !== confirmar) return setErro("A confirmação não confere com a senha.");

    const corpo = { token, nome: nome.trim(), senha };
    if (convite?.novo) {
      corpo.empresa = { ...empresa, cnpj: soDigitos(empresa.cnpj), cep: soDigitos(empresa.cep), ...atuacao };
    }

    setEnviando(true);
    try {
      const r = await fetch(`${API_URL}/auth/convite/aceitar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const data = await r.json();
      if (!r.ok) {
        setErro(data.erro || "Não foi possível criar o acesso.");
        setMotivoErro(data.motivo || "");
        setEnviando(false);
        return;
      }

      // Mesmo efeito do login de fornecedor (TelaLogin + App.login)
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

  const novo = !!convite?.novo;
  // Dados vindos da Receita no convite (etapa 10c): campo preenchido fica travado
  const receita = novo ? convite?.empresa_receita || null : null;
  const travado = (campo) => !!(receita && receita[campo]);
  const estiloTravado = { ...input, opacity: 0.75, cursor: "not-allowed" };
  const campoEmpresa = (campo, extra = {}) => ({
    value: empresa[campo],
    disabled: travado(campo),
    style: travado(campo) ? estiloTravado : input,
    ...extra,
  });

  const camposAcesso = (
    <>
      <div style={{ marginBottom: 12 }}>
        <label style={label}>E-MAIL DE ACESSO</label>
        <input value={convite?.email || ""} disabled style={{ ...input, opacity: 0.7 }} />
        {novo && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>É também o e-mail onde a empresa recebe cotações e pedidos. Dá para mudar depois em Meus Dados.</div>}
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={label}>SEU NOME</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como você quer ser chamado" style={input} autoFocus={!novo} />
      </div>
      <div style={linha("1fr 1fr")}>
        <Campo rotulo="SENHA">
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" style={input} />
        </Campo>
        <Campo rotulo="CONFIRMAR SENHA">
          <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} style={input} />
        </Campo>
      </div>
    </>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <div style={{ width: "100%", maxWidth: novo ? 680 : 440 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 5, height: 30, background: "#f87171", borderRadius: 2 }} />
            <span style={{ fontSize: 22, fontWeight: 700, color: C.text }}>QuotaFlow</span>
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>Portal do fornecedor</div>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "28px 26px" }}>
          {!convite && <div style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>Verificando convite…</div>}

          {convite && !convite.ok && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>Convite indisponível</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 18, lineHeight: 1.5 }}>{convite.mensagem || "Este convite não é válido."}</div>
              <button onClick={irParaLogin} style={{ background: C.accent, border: "none", borderRadius: 6, padding: "10px 18px", color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Ir para o login
              </button>
            </div>
          )}

          {convite && convite.ok && (
            <form onSubmit={criarAcesso}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>
                {novo ? "Cadastre sua empresa" : "Crie seu acesso"}
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.5 }}>
                {novo ? (
                  <><b style={{ color: C.text }}>{convite.cliente || "Seu cliente"}</b> convidou sua empresa para ser fornecedora dela no QuotaFlow. O portal é gratuito.</>
                ) : (
                  <><b style={{ color: C.text }}>{convite.cliente || "Seu cliente"}</b> convidou <b style={{ color: C.text }}>{convite.empresa || "sua empresa"}</b> para o portal.</>
                )}
              </div>

              {!novo && camposAcesso}

              {novo && (
                <>
                  <Secao numero="1" titulo="Sua empresa">
                    {receita && (
                      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, marginBottom: 12, padding: "9px 12px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7 }}>
                        🔒 CNPJ, razão social e endereço vêm da <b style={{ color: C.text }}>Receita Federal</b> e não podem ser alterados aqui.
                        Se algo estiver errado, fale com {convite.cliente || "o seu cliente"}.
                      </div>
                    )}
                    {receita ? (
                      <div style={{ marginBottom: 10 }}>
                        <label style={label}>CNPJ</label>
                        <input value={empresa.cnpj} disabled style={estiloTravado} />
                      </div>
                    ) : (
                    <div style={{ marginBottom: 10 }}>
                      <label style={label}>CNPJ</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          value={empresa.cnpj}
                          onChange={(e) => { mudarEmpresa("cnpj", formatarCNPJ(e.target.value)); setAvisoCNPJ(null); }}
                          placeholder="00.000.000/0000-00"
                          inputMode="numeric"
                          style={{ ...input, flex: 1 }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={buscarCNPJ}
                          disabled={buscandoCNPJ || soDigitos(empresa.cnpj).length !== 14}
                          style={{ background: "transparent", border: `1px solid ${C.accent}`, borderRadius: 6, padding: "0 14px", color: C.accent, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", opacity: buscandoCNPJ || soDigitos(empresa.cnpj).length !== 14 ? 0.5 : 1 }}
                        >
                          {buscandoCNPJ ? "⏳ Buscando…" : "🔍 Buscar dados"}
                        </button>
                      </div>
                      {avisoCNPJ && (
                        <div style={{ fontSize: 11, marginTop: 5, color: avisoCNPJ.tipo === "ok" ? C.success : C.danger }}>
                          {avisoCNPJ.tipo === "ok" ? "✓ " : "⚠ "}{avisoCNPJ.texto}
                        </div>
                      )}
                    </div>
                    )}

                    <div style={linha("1fr 1fr")}>
                      <Campo rotulo="NOME FANTASIA">
                        <input value={empresa.nome_fantasia} onChange={(e) => mudarEmpresa("nome_fantasia", e.target.value)} style={input} />
                      </Campo>
                      <Campo rotulo="RAZÃO SOCIAL">
                        <input {...campoEmpresa("razao_social")} onChange={(e) => mudarEmpresa("razao_social", e.target.value)} />
                      </Campo>
                    </div>
                    <div style={linha("120px 1fr 90px")}>
                      <Campo rotulo="CEP">
                        <input {...campoEmpresa("cep")} onChange={(e) => mudarEmpresa("cep", formatarCEP(e.target.value))} inputMode="numeric" />
                      </Campo>
                      <Campo rotulo="ENDEREÇO">
                        <input {...campoEmpresa("endereco")} onChange={(e) => mudarEmpresa("endereco", e.target.value)} />
                      </Campo>
                      <Campo rotulo="NÚMERO">
                        <input {...campoEmpresa("numero")} onChange={(e) => mudarEmpresa("numero", e.target.value)} />
                      </Campo>
                    </div>
                    <div style={linha("1fr 1fr 90px")}>
                      <Campo rotulo="BAIRRO">
                        <input {...campoEmpresa("bairro")} onChange={(e) => mudarEmpresa("bairro", e.target.value)} />
                      </Campo>
                      <Campo rotulo="CIDADE">
                        <input {...campoEmpresa("cidade")} onChange={(e) => mudarEmpresa("cidade", e.target.value)} />
                      </Campo>
                      <Campo rotulo="UF">
                        <select value={empresa.estado} disabled={travado("estado")} onChange={(e) => mudarEmpresa("estado", e.target.value)} style={{ ...(travado("estado") ? estiloTravado : input), padding: "10px 8px" }}>
                          <option value="">—</option>
                          {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                        </select>
                      </Campo>
                    </div>
                    <div style={{ ...linha("1fr 1fr"), marginBottom: 0 }}>
                      <Campo rotulo="TELEFONE">
                        <CampoTelefone value={empresa.telefone} onChange={(v) => mudarEmpresa("telefone", v)} C={C} />
                      </Campo>
                      <Campo rotulo="WHATSAPP">
                        <CampoTelefone value={empresa.whatsapp} onChange={(v) => mudarEmpresa("whatsapp", v)} placeholder="opcional" C={C} />
                      </Campo>
                    </div>
                  </Secao>

                  <Secao numero="2" titulo="O que você fornece" ajuda="opcional · dá para completar depois">
                    {!mostrarAtuacao ? (
                      <button
                        type="button"
                        onClick={() => setMostrarAtuacao(true)}
                        style={{ width: "100%", background: "transparent", border: `1px dashed ${C.border}`, borderRadius: 6, padding: "12px 14px", color: C.text, fontSize: 13, cursor: "pointer", fontFamily: "inherit", textAlign: "left", lineHeight: 1.5 }}
                      >
                        ＋ Preencher agora <span style={{ color: C.muted }}>— é o que faz as demandas spot certas (segmento, sistema, marca, região) chegarem até você.</span>
                      </button>
                    ) : opcoesAtuacao ? (
                      <PainelAtuacao opcoes={opcoesAtuacao} valores={atuacao} onChange={setAtuacao} C={C} s={s} />
                    ) : (
                      <div style={{ fontSize: 12, color: C.muted }}>Carregando opções…</div>
                    )}
                  </Secao>

                  <Secao numero="3" titulo="Seu acesso">
                    {camposAcesso}
                  </Secao>
                </>
              )}

              {erro && (
                <div style={{ background: "#ef444422", border: "1px solid #ef444444", borderRadius: 7, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: C.danger, lineHeight: 1.5 }}>
                  ⚠️ {erro}
                  {MOTIVOS_IR_LOGIN.includes(motivoErro) && (
                    <div style={{ marginTop: 8 }}>
                      <button type="button" onClick={irParaLogin} style={{ background: "transparent", border: `1px solid ${C.danger}66`, borderRadius: 5, padding: "5px 12px", color: C.text, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                        Ir para o login
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button type="submit" disabled={enviando}
                style={{ width: "100%", background: C.accent, border: "none", borderRadius: 6, padding: 13, color: "#fff", fontWeight: 600, fontSize: 15, cursor: enviando ? "not-allowed" : "pointer", opacity: enviando ? 0.6 : 1, fontFamily: "inherit" }}>
                {enviando ? (novo ? "Cadastrando…" : "Criando acesso…") : (novo ? "Cadastrar e entrar" : "Criar acesso e entrar")}
              </button>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 12, textAlign: "center", lineHeight: 1.5 }}>
                {novo
                  ? "O portal é gratuito. Seus preços e condições só são vistos pelo cliente a quem você responde."
                  : <>O portal é gratuito. Depois de entrar, confira os dados da sua empresa em <b>Meus Dados</b>.</>}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
