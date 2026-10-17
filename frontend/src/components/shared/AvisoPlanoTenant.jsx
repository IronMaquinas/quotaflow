// components/shared/AvisoPlanoTenant.jsx
//
// Faixa no topo do sistema da transportadora (etapa 11a):
//   • empresa em análise pela plataforma → Canal Spot liberado após a aprovação
//   • teste grátis → "faltam X dias"; teste encerrado → aviso (sem bloqueio)
// Dados: GET /api/auth/me (tenant.em_teste, dias_restantes_teste, aprovacao_status…).
// Some nas empresas antigas/aprovadas fora do teste. Pode ser fechada na sessão.

import { useState, useEffect } from "react";
import apiService from "../../services/apiService";

const CHAVE_FECHADO = "qf_aviso_plano_fechado";

function lerFechado() {
  try { return sessionStorage.getItem(CHAVE_FECHADO) === "1"; } catch { return false; }
}

export default function AvisoPlanoTenant() {
  const [tenant, setTenant] = useState(null);
  const [fechado, setFechado] = useState(lerFechado);

  useEffect(() => {
    apiService.get("/auth/me").then((r) => setTenant(r?.tenant || null)).catch(() => {});
  }, []);

  if (!tenant || fechado) return null;

  const emAnalise = tenant.aprovacao_status === "pendente";
  const recusado = tenant.aprovacao_status === "recusado";
  const emTeste = !!tenant.em_teste;
  if (!emAnalise && !recusado && !emTeste) return null;

  const ate = tenant.teste_ate ? new Date(tenant.teste_ate).toLocaleDateString("pt-BR") : "";
  const dias = tenant.dias_restantes_teste;
  const mensagens = [];
  if (emTeste && tenant.teste_encerrado) {
    mensagens.push(<span key="t">⏰ Seu teste grátis terminou em <b>{ate}</b>. Fale com a equipe QuotaFlow para escolher um plano.</span>);
  } else if (emTeste) {
    mensagens.push(
      <span key="t">🎁 Teste grátis — {dias === 1 ? "falta 1 dia" : `faltam ${dias} dias`} (até <b>{ate}</b>).</span>
    );
  }
  if (emAnalise) {
    mensagens.push(<span key="a">⏳ Sua empresa está em análise. O Canal Spot é liberado após a aprovação; o restante do sistema já está disponível.</span>);
  }
  if (recusado) {
    mensagens.push(<span key="r">⚠️ O cadastro da sua empresa não foi aprovado para o Canal Spot. Fale com a equipe QuotaFlow.</span>);
  }

  const urgente = (emTeste && (tenant.teste_encerrado || dias <= 3)) || recusado;
  const cor = urgente ? "#f59e0b" : "#3b82f6";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "9px 18px", flexShrink: 0,
      background: `${cor}18`, borderBottom: `1px solid ${cor}44`, color: "#e2e8f0", fontSize: 12, lineHeight: 1.5,
    }}>
      <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: "4px 18px" }}>{mensagens}</div>
      <button
        type="button"
        onClick={() => { setFechado(true); try { sessionStorage.setItem(CHAVE_FECHADO, "1"); } catch { /* ok */ } }}
        title="Fechar"
        style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: 16, cursor: "pointer", lineHeight: 1, padding: 2 }}
      >
        ×
      </button>
    </div>
  );
}
