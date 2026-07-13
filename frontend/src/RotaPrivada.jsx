import { useAuth } from "./hooks/useAuth";

export default function RotaPrivada({ children }) {
  const { isLogado, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 20, textAlign: "center" }}>Carregando...</div>;
  }

  if (!isLogado) {
    window.location.href = "/login";
    return null;
  }

  return children;
}