import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import TelaLogin from "./TelaLogin";
import TelaSignup from "./TelaSignup";
import App from "./App"; // Dashboard
import { useAuth } from "./hooks/useAuth";

function Router() {
  const { isLogado, loading } = useAuth();
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

  // Se está logado e tenta acessar login/signup, redireciona para dashboard
  if (isLogado && (currentPage === "login" || currentPage === "signup")) {
    window.location.hash = "#dashboard";
    return <div style={{ background: "#0a0e14", minHeight: "100vh" }} />;
  }

  // Se não está logado e tenta acessar dashboard, redireciona para login
  if (!isLogado && currentPage === "dashboard") {
    window.location.hash = "#login";
    return <div style={{ background: "#0a0e14", minHeight: "100vh" }} />;
  }

  if (loading) {
    return (
      <div
        style={{
          background: "#0a0e14",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#e2e8f0",
          fontSize: 16,
        }}
      >
        Carregando...
      </div>
    );
  }

  // Renderizar página conforme a hash
  if (currentPage === "signup") {
    return <TelaSignup onSignupSuccess={() => window.location.hash = "#login"} />;
  }

  if (currentPage === "dashboard") {
    return <App />;
  }

  // Default: login
  return <TelaLogin onLoginSuccess={() => window.location.hash = "#dashboard"} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
);