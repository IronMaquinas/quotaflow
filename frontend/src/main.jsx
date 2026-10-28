// scr/main.jsx

import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import TelaLogin from "./TelaLogin";
import TelaSignup from "./TelaSignup";
import App from "./App";
import { useAuth } from "./hooks/useAuth";
import TelaFornecedor from "./components/portal/TelaFornecedor";
import TelaConfirmarEmail from "./TelaConfirmarEmail"; // etapa 11a.3
import ConsolePlataforma from "./plataforma/ConsolePlataforma"; // etapa 11b
import TelaPortalFornecedor from "./components/portal/TelaPortalFornecedor";
import TelaAceitarConvite from "./TelaAceitarConvite";
import TelaProvaPublica from "./TelaProvaPublica"; // etapa 12e.2b
import TelaInspecaoPublica from "./TelaInspecaoPublica"; // etapa 14b.1
import TelaBidPublica from "./TelaBidPublica"; // etapa 15b

console.log('🚀 main.jsx executando');

function Router() {
  const { isLogado, loading, loginWithData } = useAuth();
  const [currentPage, setCurrentPage] = useState(() => {
    const hash = window.location.hash.slice(1) || "login";
    return hash;
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) || "login";
      setCurrentPage(hash);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // 🔥 ROTA TOKENIZADA — link direto de email/WhatsApp, sem login.
  // Monta o formulário de resposta direto, sem passar pelo hub do
  // fornecedor (que tem sidebar, menu, etc). Precisa vir ANTES do
  // check geral de /portal abaixo, senão cai no hub e perde o token.
  if (
    currentPage.startsWith("portal/cotacao/") ||
    currentPage.startsWith("/portal/cotacao/")
  ) {
    return <TelaPortalFornecedor />;
  }

  // 🔥 ROTA DO HUB DO FORNECEDOR LOGADO (e demais rotas /portal/...)
  if (
    currentPage === "portal" ||
    currentPage === "/portal" ||
    currentPage.startsWith("portal/") ||
    currentPage.startsWith("/portal/")
  ) {
    return <TelaFornecedor />;
  }

  // Etapa 11b: Console da Plataforma (#admin) — login próprio, separado de
  // transportadora e fornecedor; não passa pelos redirecionamentos abaixo.
  if (currentPage === "admin" || currentPage === "/admin" || currentPage.startsWith("admin/") || currentPage.startsWith("/admin/")) {
    return <ConsolePlataforma />;
  }

  // Etapa 11a.3: link de confirmação de e-mail (#confirmar-email?token=...).
  // Vem antes dos redirecionamentos de login: funciona logado ou não.
  if (currentPage.startsWith("confirmar-email") || currentPage.startsWith("/confirmar-email")) {
    return <TelaConfirmarEmail />;
  }

  // Etapa 12e.2b: link externo da prova de treinamento (#prova?t=...) — público, CPF + data de nascimento.
  if (currentPage.startsWith("prova") || currentPage.startsWith("/prova")) {
    return <TelaProvaPublica />;
  }

  // Etapa 15b: link do cliente para o BID (#bid?t=...) — público, token (como a cotação do fornecedor).
  if (currentPage.startsWith("bid?") || currentPage.startsWith("/bid?")) {
    return <TelaBidPublica />;
  }

  // Etapa 14b.1: link de inspeção de terceiros (#inspecao?t=...) — público, nome + CPF + empresa.
  if (currentPage.startsWith("inspecao") || currentPage.startsWith("/inspecao")) {
    return <TelaInspecaoPublica />;
  }

  // Etapa 10: convite ao fornecedor local (link do e-mail #convite?token=...).
  // Vem antes dos redirecionamentos de login: quem recebe o convite ainda não tem conta.
  if (currentPage.startsWith("convite") || currentPage.startsWith("/convite")) {
    return <TelaAceitarConvite />;
  }

  // Redirecionar se já logado e tentar acessar login/signup
  // Etapa 11a.1: só o LOGIN redireciona quem tem sessão guardada. "Criar conta"
  // (#signup) sempre abre — senão, com uma sessão antiga no navegador (o "Sair"
  // do sistema não limpa o localStorage), o clique em "Criar conta" voltava
  // para o login e parecia não fazer nada.
  if (isLogado && currentPage === "login") {
    window.location.hash = "#dashboard";
    return <div style={{ background: "#0a0e14", minHeight: "100vh" }} />;
  }

  // Redirecionar para login se não logado e tentar acessar dashboard
  if (!isLogado && currentPage === "dashboard") {
    window.location.hash = "#login";
    return <div style={{ background: "#0a0e14", minHeight: "100vh" }} />;
  }

  if (loading) {
    return (
      <div style={{ background: "#0a0e14", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#e2e8f0", fontSize: 16 }}>
        Carregando...
      </div>
    );
  }

  if (currentPage === "signup") {
    return <TelaSignup onSignupSuccess={() => window.location.hash = "#login"} />;
  }

  if (currentPage === "dashboard") {
    return <App />;
  }

  // M4.6: se logou como fornecedor, App renderiza o portal (TelaGestaoCotacoesFornecedor).
  // A lógica de qual tela mostrar está dentro do App, baseado em `usuario.perfil`.

  // M4.6: rotas de auth (esqueci/reset senha) → delega pro App.
  if (
    currentPage.startsWith("esqueci-senha") ||
    currentPage.startsWith("reset-senha") ||
    currentPage.startsWith("/esqueci-senha") ||
    currentPage.startsWith("/reset-senha")
  ) {
    return <App />;
  }

  // Qualquer outra rota → TelaLogin
  const handleLogin = (userData) => {
    loginWithData(userData);
    window.location.hash = "#dashboard";
  };

  return <TelaLogin onLogin={handleLogin} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
);