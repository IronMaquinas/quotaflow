// scr/main.jsx

import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import TelaLogin from "./TelaLogin";
import TelaSignup from "./TelaSignup";
import App from "./App";
import { useAuth } from "./hooks/useAuth";
import TelaFornecedor from "./components/portal/TelaFornecedor";

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

  // 🔥 ROTA PÚBLICA DO PORTAL
  if (currentPage === "portal" || currentPage === "/portal" || currentPage.startsWith("portal/") || currentPage.startsWith("/portal/")) {
    return <TelaFornecedor />;
  }

  // Redirecionar se já logado e tentar acessar login/signup
  if (isLogado && (currentPage === "login" || currentPage === "signup")) {
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