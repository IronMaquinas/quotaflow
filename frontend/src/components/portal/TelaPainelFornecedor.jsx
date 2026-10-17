// components/portal/TelaPainelFornecedor.jsx
//
// Painel do Fornecedor (etapa 10) — primeira tela do portal.
//   • Agora: o que espera uma ação (cada card leva à tela certa)
//   • Canal Spot e Cotações: desempenho nos últimos 90 dias
// Dados: GET /api/fornecedor/painel (só do próprio fornecedor).

import { useState, useEffect } from "react";
import apiService from "../../services/apiService";

const fmtBRL = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v) => (v == null ? "—" : `${v}%`);
function fmtHoras(h) {
  if (h == null) return "—";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h * 10) / 10} h`;
  return `${Math.round(h / 24)} dias`;
}

function CardAcao({ C, s, numero, titulo, detalhe, cor, onClick }) {
  const ativo = numero > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...s.card, textAlign: "left", cursor: "pointer", fontFamily: "inherit",
        borderLeft: `4px solid ${ativo ? cor : C.border}`, padding: "16px 18px",
        display: "flex", flexDirection: "column", gap: 4, minHeight: 104,
      }}
    >
      <div style={{ fontSize: 30, fontWeight: 700, color: ativo ? C.text : C.muted, lineHeight: 1 }}>{numero}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: ativo ? C.text : C.muted }}>{titulo}</div>
      {detalhe && <div style={{ fontSize: 11, color: C.muted }}>{detalhe}</div>}
    </button>
  );
}

function Indicador({ C, rotulo, valor, ajuda }) {
  return (
    <div style={{ padding: "12px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", fontWeight: 600 }}>{rotulo}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginTop: 4 }}>{valor}</div>
      {ajuda && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{ajuda}</div>}
    </div>
  );
}

export default function TelaPainelFornecedor({ C, s, usuario, onNavegar }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    apiService.get("/fornecedor/painel")
      .then(setDados)
      .catch((e) => setErro(e.message || "Erro ao carregar o painel"));
  }, []);

  if (erro) return <div style={{ padding: 40, color: "#ef4444" }}>⚠ {erro}</div>;
  if (!dados) return <div style={{ padding: 40, color: C.muted }}>Carregando painel…</div>;

  const { agora, spot, cotacoes, periodo_dias: dias, plano, tem_atuacao: temAtuacao } = dados;
  // Canal Spot só para fornecedor verificado (etapa 10c)
  const spotLiberado = dados.spot_liberado !== false && !!spot;
  const ir = (tela) => onNavegar && onNavegar(tela);
  const totalAgora = agora.cotacoes_aguardando + agora.pedidos_aguardando_confirmacao + agora.ncs_aguardando_resposta + (spotLiberado ? agora.spot_recomendadas : 0);

  return (
    <div style={{ padding: "22px 24px 60px", maxWidth: 1100 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em" }}>PAINEL</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Olá, {usuario?.nome || "Fornecedor"}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
          {totalAgora > 0 ? "Isto espera por você agora:" : "Tudo em dia por aqui. 👍"}
        </div>
      </div>

      {/* ─── Agora ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 26 }}>
        <CardAcao C={C} s={s} numero={agora.cotacoes_aguardando} titulo="Cotações aguardando resposta"
          cor="#f59e0b" onClick={() => ir("cotacoes")} />
        <CardAcao C={C} s={s} numero={agora.pedidos_aguardando_confirmacao} titulo="Pedidos para confirmar"
          cor="#3b82f6" onClick={() => ir("pedidos")} />
        <CardAcao C={C} s={s} numero={agora.ncs_aguardando_resposta} titulo="Não conformidades para responder"
          cor="#ef4444" onClick={() => ir("nao-conformidades")} />
        {spotLiberado ? (
          <CardAcao C={C} s={s} numero={agora.spot_recomendadas} titulo="Demandas spot que combinam com você"
            detalhe={agora.spot_combina_muito > 0 ? `⭐ ${agora.spot_combina_muito} combina(m) muito` : (temAtuacao ? "ainda não respondidas" : "preencha sua atuação em Meus Dados")}
            cor="#22c55e" onClick={() => ir(temAtuacao ? "oportunidades" : "meus-dados")} />
        ) : (
          <button type="button" onClick={() => ir("oportunidades")}
            style={{ ...s.card, textAlign: "left", cursor: "pointer", fontFamily: "inherit", borderLeft: `4px solid ${C.border}`, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4, minHeight: 104 }}>
            <div style={{ fontSize: 22, lineHeight: 1 }}>🔒</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Canal Spot</div>
            <div style={{ fontSize: 11, color: C.muted }}>exclusivo para fornecedores verificados — saiba mais</div>
          </button>
        )}
      </div>

      {/* ─── Canal Spot ─── */}
      {spotLiberado && (
      <div style={{ ...s.card, padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>⚡ CANAL SPOT <span style={{ color: C.muted, fontWeight: 400 }}>· últimos {dias} dias</span></div>
          {plano !== "pro" && (
            <div style={{ fontSize: 11, color: C.muted }}>
              ⭐ No plano Pro você recebe as demandas por e-mail, antes dos concorrentes.
            </div>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <Indicador C={C} rotulo="TAXA DE RESPOSTA" valor={fmtPct(spot.taxa_resposta)} ajuda={`${spot.respondidas} de ${spot.visualizadas} vistas`} />
          <Indicador C={C} rotulo="TAXA DE VITÓRIA" valor={fmtPct(spot.taxa_vitoria)} ajuda={`${spot.vitorias} de ${spot.decididas} decididas`} />
          <Indicador C={C} rotulo="TEMPO MÉDIO DE RESPOSTA" valor={fmtHoras(spot.tempo_medio_resposta_horas)} ajuda="da publicação à sua resposta" />
          <Indicador C={C} rotulo="VALOR GANHO" valor={fmtBRL(spot.valor_ganho)} ajuda="nas demandas em que você foi escolhido" />
        </div>
        <div style={{ fontSize: 10, color: C.muted, marginTop: 10 }}>
          "Decididas" são as demandas em que o comprador comprou de alguém — quando ele desiste da compra, não conta contra você.
        </div>
      </div>
      )}

      {/* ─── Cotações ─── */}
      <div style={{ ...s.card, padding: "18px 20px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>
          📋 COTAÇÕES <span style={{ color: C.muted, fontWeight: 400 }}>· últimos {dias} dias</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <Indicador C={C} rotulo="RECEBIDAS" valor={cotacoes.recebidas} />
          <Indicador C={C} rotulo="RESPONDIDAS" valor={cotacoes.respondidas} />
          <Indicador C={C} rotulo="VENCIDAS" valor={cotacoes.vencidas} ajuda={cotacoes.taxa_vitoria != null ? `${cotacoes.taxa_vitoria}% das respondidas` : null} />
          <Indicador C={C} rotulo="VALOR EM PEDIDOS" valor={fmtBRL(cotacoes.valor_pedidos)} />
        </div>
      </div>
    </div>
  );
}
