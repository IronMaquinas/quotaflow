// components/fornecedores/TelaMeusDadosFornecedor.jsx
//
// Tela "Meus Dados" do portal do fornecedor — self-service completo:
// o fornecedor logado edita os dados da própria empresa (fornecedores:
// nome_fantasia, razão social, endereço, contato comercial) e os dados
// do seu próprio usuário de login (fornecedor_usuarios: nome, email,
// senha), sem depender do admin/banco para nada disso.
//
// Contexto do bug que motivou esta tela: o cabeçalho do portal ("Olá,
// {nome}") usa fornecedor_usuarios.nome — uma entidade separada de
// fornecedores.nome_fantasia, que é o que aparecia (e só aparecia) na
// tela "Editar Fornecedor" do admin. Não existia NENHUMA interface para
// o fornecedor corrigir o próprio nome de usuário — só via SQL direto.
// Esta tela fecha essa lacuna.
//
// Backend: PUT /api/fornecedor/me (routes/fornecedor.js), autenticado
// via fornecedorMiddleware (JWT do próprio portal). Aceita payload
// parcial — só envia os campos que o usuário efetivamente alterou.
//
// Decisões de produto confirmadas:
// - Fornecedor edita tudo: empresa + próprio usuário (nome/email/senha).
// - 1 usuário por fornecedor (sem tela de gestão de múltiplos usuários,
//   por ora).
// - Troca de senha faz parte desta tela, exige senha atual, sem fluxo
//   de confirmação por e-mail (troca já vale no próximo login).
// - Troca de e-mail de login é direta, sem confirmação por e-mail.

import { useState, useEffect, useCallback } from "react";
import apiService from "../../services/apiService";

export default function TelaMeusDadosFornecedor({ C, s }) {
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [mensagem, setMensagem] = useState(null); // {tipo: 'ok'|'erro', texto}

  const [formEmpresa, setFormEmpresa] = useState(null);
  const [formUsuario, setFormUsuario] = useState(null);
  const [formSenha, setFormSenha] = useState({ senha_atual: "", nova_senha: "", confirmar_senha: "" });
  const [senhaVisivel, setSenhaVisivel] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroCarregar(null);
    try {
      const dados = await apiService.get("/fornecedor/me");
      setFormEmpresa({
        nome_fantasia: dados.fornecedor?.nome_fantasia || "",
        razao_social: dados.fornecedor?.razao_social || "",
        endereco: dados.fornecedor?.endereco || "",
        cidade: dados.fornecedor?.cidade || "",
        estado: dados.fornecedor?.estado || "",
        cep: dados.fornecedor?.cep || "",
        nome_contato: dados.fornecedor?.nome_contato || "",
        email_contato: dados.fornecedor?.email_contato || "",
        telefone: dados.fornecedor?.telefone || "",
        whatsapp: dados.fornecedor?.whatsapp || "",
      });
      setFormUsuario({
        nome: dados.usuario?.nome || "",
        email: dados.usuario?.email || "",
      });
    } catch (err) {
      console.error("❌ Erro ao carregar Meus Dados:", err);
      setErroCarregar(err.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const mostrarMensagem = (tipo, texto) => {
    setMensagem({ tipo, texto });
    window.clearTimeout(mostrarMensagem._t);
    mostrarMensagem._t = window.setTimeout(() => setMensagem(null), 4000);
  };

  const salvarDadosCadastrais = async () => {
    if (!formEmpresa.nome_fantasia || !formEmpresa.nome_fantasia.trim()) {
      mostrarMensagem("erro", "Nome Fantasia é obrigatório.");
      return;
    }
    if (!formUsuario.nome || !formUsuario.nome.trim()) {
      mostrarMensagem("erro", "Seu nome é obrigatório.");
      return;
    }
    if (!formUsuario.email || !formUsuario.email.trim()) {
      mostrarMensagem("erro", "Seu e-mail é obrigatório.");
      return;
    }

    setSalvando(true);
    try {
      const resposta = await apiService.put("/fornecedor/me", {
        ...formEmpresa,
        nome: formUsuario.nome,
        email: formUsuario.email,
      });

      // Mantém o localStorage sincronizado com o que acabou de ser salvo.
      // TelaFornecedor.jsx (o shell do portal) lê `usuario` do localStorage
      // uma única vez ao montar — sem isso, o nome exibido no cabeçalho
      // ("Olá, {nome}") e no rodapé do menu só atualizaria depois de um
      // logout/login novo, mesmo com o banco já correto.
      if (resposta.usuario) {
        const usuarioAtual = JSON.parse(localStorage.getItem("usuario") || "{}");
        const usuarioAtualizado = { ...usuarioAtual, ...resposta.usuario };
        localStorage.setItem("usuario", JSON.stringify(usuarioAtualizado));
        // Evento custom (storage não dispara na mesma aba que escreveu) —
        // permite que TelaFornecedor.jsx reaja sem precisar de F5.
        window.dispatchEvent(new CustomEvent("usuario-atualizado", { detail: usuarioAtualizado }));
      }

      mostrarMensagem("ok", resposta.mensagem || "Dados atualizados com sucesso.");
    } catch (err) {
      console.error("❌ Erro ao salvar dados cadastrais:", err);
      mostrarMensagem("erro", err.message || "Erro ao salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  const salvarSenha = async () => {
    if (!formSenha.senha_atual) {
      mostrarMensagem("erro", "Informe sua senha atual.");
      return;
    }
    if (!formSenha.nova_senha || formSenha.nova_senha.length < 6) {
      mostrarMensagem("erro", "A nova senha deve ter ao menos 6 caracteres.");
      return;
    }
    if (formSenha.nova_senha !== formSenha.confirmar_senha) {
      mostrarMensagem("erro", "A confirmação não bate com a nova senha.");
      return;
    }

    setSalvandoSenha(true);
    try {
      const resposta = await apiService.put("/fornecedor/me", {
        senha_atual: formSenha.senha_atual,
        nova_senha: formSenha.nova_senha,
      });
      mostrarMensagem("ok", resposta.mensagem || "Senha atualizada com sucesso.");
      setFormSenha({ senha_atual: "", nova_senha: "", confirmar_senha: "" });
    } catch (err) {
      console.error("❌ Erro ao trocar senha:", err);
      mostrarMensagem("erro", err.message || "Erro ao trocar a senha.");
    } finally {
      setSalvandoSenha(false);
    }
  };

  if (carregando) {
    return <div style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 13 }}>Carregando seus dados…</div>;
  }

  if (erroCarregar) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>Erro ao carregar: {erroCarregar}</div>
        <button onClick={carregar} style={{ ...s.btn(true), padding: "8px 18px", fontSize: 12 }}>Tentar novamente</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 60px" }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Meus Dados</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
          Atualize os dados da sua empresa e do seu acesso ao portal.
        </div>
      </div>

      {mensagem && (
        <div style={{
          marginBottom: 18, padding: "10px 14px", borderRadius: 8, fontSize: 12,
          background: mensagem.tipo === "ok" ? `${C.success}18` : "#ef444418",
          border: `1px solid ${mensagem.tipo === "ok" ? `${C.success}44` : "#ef444444"}`,
          color: mensagem.tipo === "ok" ? C.success : "#ef4444",
        }}>
          {mensagem.tipo === "ok" ? "✓ " : "⚠ "}{mensagem.texto}
        </div>
      )}

      {/* ─── Dados da empresa ─── */}
      <div style={{ ...s.card, padding: "20px 22px", marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16 }}>DADOS DA EMPRESA</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={s.label}>NOME FANTASIA *</label>
            <input value={formEmpresa.nome_fantasia}
              onChange={e => setFormEmpresa(f => ({ ...f, nome_fantasia: e.target.value }))}
              style={s.input} />
          </div>
          <div>
            <label style={s.label}>RAZÃO SOCIAL</label>
            <input value={formEmpresa.razao_social}
              onChange={e => setFormEmpresa(f => ({ ...f, razao_social: e.target.value }))}
              placeholder="Razão social" style={s.input} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={s.label}>LOGRADOURO</label>
          <input value={formEmpresa.endereco}
            onChange={e => setFormEmpresa(f => ({ ...f, endereco: e.target.value }))}
            placeholder="Rua, Avenida…" style={s.input} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 120px", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={s.label}>CIDADE</label>
            <input value={formEmpresa.cidade}
              onChange={e => setFormEmpresa(f => ({ ...f, cidade: e.target.value }))}
              placeholder="Cidade" style={s.input} />
          </div>
          <div>
            <label style={s.label}>ESTADO</label>
            <input value={formEmpresa.estado} maxLength={2}
              onChange={e => setFormEmpresa(f => ({ ...f, estado: e.target.value.toUpperCase() }))}
              placeholder="UF" style={s.input} />
          </div>
          <div>
            <label style={s.label}>CEP</label>
            <input value={formEmpresa.cep}
              onChange={e => setFormEmpresa(f => ({ ...f, cep: e.target.value }))}
              placeholder="00000-000" style={s.input} />
          </div>
        </div>

        <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.08em", fontWeight: 600, margin: "18px 0 12px" }}>
          CONTATO COMERCIAL
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={s.label}>NOME DO CONTATO</label>
            <input value={formEmpresa.nome_contato}
              onChange={e => setFormEmpresa(f => ({ ...f, nome_contato: e.target.value }))}
              placeholder="Nome do representante" style={s.input} />
          </div>
          <div>
            <label style={s.label}>E-MAIL</label>
            <input type="email" value={formEmpresa.email_contato}
              onChange={e => setFormEmpresa(f => ({ ...f, email_contato: e.target.value }))}
              style={s.input} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={s.label}>TELEFONE</label>
            <input value={formEmpresa.telefone}
              onChange={e => setFormEmpresa(f => ({ ...f, telefone: e.target.value }))}
              placeholder="(11) 0000-0000" style={s.input} />
          </div>
          <div>
            <label style={s.label}>WHATSAPP</label>
            <input value={formEmpresa.whatsapp}
              onChange={e => setFormEmpresa(f => ({ ...f, whatsapp: e.target.value }))}
              placeholder="(11) 90000-0000" style={s.input} />
          </div>
        </div>
      </div>

      {/* ─── Meu acesso (usuário de login) ─── */}
      <div style={{ ...s.card, padding: "20px 22px", marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>MEU ACESSO</div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>
          Este é o nome exibido no cabeçalho do portal ("Olá, ...") e o e-mail usado para entrar.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={s.label}>SEU NOME *</label>
            <input value={formUsuario.nome}
              onChange={e => setFormUsuario(f => ({ ...f, nome: e.target.value }))}
              style={s.input} />
          </div>
          <div>
            <label style={s.label}>SEU E-MAIL DE LOGIN *</label>
            <input type="email" value={formUsuario.email}
              onChange={e => setFormUsuario(f => ({ ...f, email: e.target.value }))}
              style={s.input} />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 30 }}>
        <button onClick={salvarDadosCadastrais} disabled={salvando}
          style={{ ...s.btn(true, C.accent), padding: "10px 24px", fontSize: 13 }}>
          {salvando ? "Salvando…" : "Salvar dados cadastrais"}
        </button>
      </div>

      {/* ─── Trocar senha ─── */}
      <div style={{ ...s.card, padding: "20px 22px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16 }}>TROCAR SENHA</div>

        <div style={{ marginBottom: 14 }}>
          <label style={s.label}>SENHA ATUAL *</label>
          <input type={senhaVisivel ? "text" : "password"} value={formSenha.senha_atual}
            onChange={e => setFormSenha(f => ({ ...f, senha_atual: e.target.value }))}
            placeholder="••••••••" style={s.input} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 8 }}>
          <div>
            <label style={s.label}>NOVA SENHA *</label>
            <div style={{ position: "relative" }}>
              <input type={senhaVisivel ? "text" : "password"} value={formSenha.nova_senha}
                onChange={e => setFormSenha(f => ({ ...f, nova_senha: e.target.value }))}
                placeholder="Mínimo 6 caracteres" style={{ ...s.input, paddingRight: 44 }} />
              <button type="button" onClick={() => setSenhaVisivel(v => !v)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 14 }}>
                {senhaVisivel ? "🙈" : "👁"}
              </button>
            </div>
          </div>
          <div>
            <label style={s.label}>CONFIRMAR NOVA SENHA *</label>
            <input type={senhaVisivel ? "text" : "password"} value={formSenha.confirmar_senha}
              onChange={e => setFormSenha(f => ({ ...f, confirmar_senha: e.target.value }))}
              placeholder="••••••••" style={s.input} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button onClick={salvarSenha} disabled={salvandoSenha}
            style={{ ...s.btn(true), padding: "10px 24px", fontSize: 13 }}>
            {salvandoSenha ? "Salvando…" : "Trocar senha"}
          </button>
        </div>
      </div>
    </div>
  );
}