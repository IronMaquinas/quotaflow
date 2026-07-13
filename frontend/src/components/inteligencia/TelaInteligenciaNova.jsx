// components/inteligencia/TelaInteligenciaNova.jsx
import { useState } from "react";

export default function TelaInteligenciaNova({
  chamados,
  cotacoes,
  fornecedores,
  equipamentos,
  perfilUsuario,
  C,
  s,
  fmtBRL,
}) {
  const [iaLoading, setIaLoading] = useState(false);
  const [iaAnalise, setIaAnalise] = useState("");
  const [iaErro, setIaErro] = useState("");
  const [expandAlert, setExpandAlert] = useState(null);

  // ── MOTOR DE ALERTAS (copiado do original) ──
  const alertas = [];
  const finalizados = chamados.filter(c => c.status === "finalizado" && c.valorAprovado);
  const todasCots = cotacoes;

  // 1. Compliance: Fornecedor que ganha após renegociação
  const fornVitorias = {};
  finalizados.forEach(ch => {
    const cot = todasCots.find(c => c.chamadoId === ch.id);
    if (!cot) return;
    const fs = cot.fornecedores.filter(f => f.valor != null);
    if (fs.length < 2) return;
    const menorOriginal = fs.reduce((a, b) => a.valor < b.valor ? a : b);
    const vencedor = ch.fornecedorAprovado;
    if (vencedor && vencedor !== menorOriginal.nome) {
      if (!fornVitorias[vencedor]) fornVitorias[vencedor] = { vitorias: 0, totalCots: 0, comprador: ch.aprovadoPor };
      fornVitorias[vencedor].vitorias++;
    }
    fs.forEach(f => {
      if (!fornVitorias[f.nome]) fornVitorias[f.nome] = { vitorias: 0, totalCots: 0, comprador: ch.aprovadoPor };
      fornVitorias[f.nome].totalCots++;
    });
  });
  Object.entries(fornVitorias).forEach(([nome, d]) => {
    if (d.vitorias >= 2 && d.totalCots >= 2) {
      const pct = Math.round((d.vitorias / Math.max(d.totalCots, 1)) * 100);
      if (pct >= 60) {
        alertas.push({
          id: `comp_rev_${nome}`,
          categoria: "compliance",
          severidade: "alta",
          titulo: `Fornecedor ganha frequentemente após renegociação`,
          descricao: `"${nome}" venceu ${d.vitorias}x sem ter o menor preço inicial. Em ${pct}% dos casos o pedido foi para ele após renegociação. Padrão pode indicar informação privilegiada sobre concorrentes.`,
          dado: `Comprador frequente nessas aprovações: ${d.comprador || "não identificado"}`,
          acao: "Auditar histórico de comunicações entre comprador e fornecedor. Verificar se outros fornecedores tiveram oportunidade de revisar proposta.",
        });
      }
    }
  });

  // 2. Compliance: Concentração comprador × fornecedor
  const compradorForn = {};
  finalizados.forEach(ch => {
    if (!ch.aprovadoPor || !ch.fornecedorAprovado) return;
    const key = `${ch.aprovadoPor}__${ch.fornecedorAprovado}`;
    compradorForn[key] = (compradorForn[key] || 0) + 1;
  });
  Object.entries(compradorForn).forEach(([key, count]) => {
    if (count >= 3) {
      const [comprador, forn] = key.split("__");
      alertas.push({
        id: `comp_conc_${key}`,
        categoria: "compliance",
        severidade: "media",
        titulo: `Alta concentração comprador × fornecedor`,
        descricao: `${comprador} aprovou ${count} pedidos consecutivos para "${forn}". Concentração acima do normal para um único par.`,
        dado: `${count} aprovações registradas`,
        acao: "Revisar se outros compradores rotacionam aprovações. Avaliar política de rodízio de aprovadores para fornecedores frequentes.",
      });
    }
  });

  // 3. Compliance: Cotação com 1 único respondente aprovada
  const semConcorrencia = finalizados.filter(ch => {
    const cot = todasCots.find(c => c.chamadoId === ch.id);
    if (!cot) return false;
    return cot.fornecedores.filter(f => f.valor != null).length === 1;
  });
  if (semConcorrencia.length > 0) {
    alertas.push({
      id: "comp_unico",
      categoria: "compliance",
      severidade: "media",
      titulo: `${semConcorrencia.length} compra(s) sem concorrência real`,
      descricao: `Aprovadas com apenas 1 proposta respondida. Sem comparação de preço, não há como garantir que o valor foi o melhor disponível.`,
      dado: semConcorrencia.map(c => c.numero).join(", "),
      acao: "Estabelecer política mínima de 2 cotações respondidas antes de qualquer aprovação, exceto em emergências documentadas.",
    });
  }

  // 4. Compliance: Resposta suspeita rápida
  todasCots.forEach(cot => {
    cot.fornecedores.forEach(f => {
      if (f.dataResposta && cot.dataEnvio) {
        const hrs = (new Date(f.dataResposta) - new Date(cot.dataEnvio)) / 3600000;
        const ch = chamados.find(c => c.id === cot.chamadoId);
        if (hrs < 2 && f.valor != null) {
          alertas.push({
            id: `comp_rapid_${f.token}`,
            categoria: "compliance",
            severidade: "baixa",
            titulo: `Resposta suspeita rápida de fornecedor`,
            descricao: `"${f.nome}" respondeu em menos de 2 horas na cotação ${ch?.numero || ""}. Tempo incomum para formular proposta com preço e prazo.`,
            dado: `Resposta em ${hrs.toFixed(1)}h após envio`,
            acao: "Verificar se fornecedor foi contatado antes do envio formal da cotação.",
          });
        }
      }
    });
  });

  // 5. Fornecedor único para peça
  const pecaFornMap = {};
  todasCots.forEach(cot => {
    const ch = chamados.find(c => c.id === cot.chamadoId);
    if (!ch) return;
    const key = ch.peca;
    if (!pecaFornMap[key]) pecaFornMap[key] = { peca: key, urgencia: ch.urgencia, fornecedores: new Set() };
    cot.fornecedores.forEach(f => f.valor != null && pecaFornMap[key].fornecedores.add(f.nome));
  });
  Object.values(pecaFornMap).forEach(p => {
    if (p.fornecedores.size === 1) {
      alertas.push({
        id: `forn_unico_${p.peca}`,
        categoria: "fornecedor",
        severidade: p.urgencia === "alta" ? "alta" : "media",
        titulo: `Fornecedor único para item ${p.urgencia === "alta" ? "crítico" : "recorrente"}`,
        descricao: `"${p.peca}" tem apenas 1 fornecedor que cotou até hoje: ${[...p.fornecedores][0]}. Risco de desabastecimento se esse fornecedor não estiver disponível.`,
        dado: `Urgência histórica: ${p.urgencia}`,
        acao: "Prospectar 2 fornecedores alternativos homologados para este item.",
      });
    }
  });

  // 6. Fornecedor com alta taxa de não resposta
  const fornResposta = {};
  todasCots.forEach(cot => {
    cot.fornecedores.forEach(f => {
      if (!fornResposta[f.nome]) fornResposta[f.nome] = { total: 0, naoResp: 0 };
      fornResposta[f.nome].total++;
      if (f.status === "sem_resposta") fornResposta[f.nome].naoResp++;
    });
  });
  Object.entries(fornResposta).forEach(([nome, d]) => {
    if (d.total >= 2 && d.naoResp / d.total >= 0.5) {
      alertas.push({
        id: `forn_noresp_${nome}`,
        categoria: "fornecedor",
        severidade: "media",
        titulo: `Fornecedor com baixa confiabilidade de resposta`,
        descricao: `"${nome}" não respondeu ${d.naoResp} de ${d.total} cotações (${Math.round((d.naoResp / d.total) * 100)}%). Dependência deste fornecedor cria risco operacional.`,
        dado: `${d.naoResp} sem resposta de ${d.total} solicitações`,
        acao: "Avaliar suspensão temporária do cadastro. Buscar substituto antes de remover.",
      });
    }
  });

  // 7. Concentração de gastos
  const gastoPorForn = {};
  finalizados.forEach(ch => {
    if (!ch.fornecedorAprovado) return;
    gastoPorForn[ch.fornecedorAprovado] = (gastoPorForn[ch.fornecedorAprovado] || 0) + (ch.valorNegociado || ch.valorAprovado);
  });
  const totalGastoGeral = Object.values(gastoPorForn).reduce((a, b) => a + b, 0);
  Object.entries(gastoPorForn).forEach(([nome, valor]) => {
    const pct = totalGastoGeral ? (valor / totalGastoGeral) * 100 : 0;
    if (pct >= 45) {
      alertas.push({
        id: `forn_conc_${nome}`,
        categoria: "fornecedor",
        severidade: "alta",
        titulo: `Concentração crítica de gastos em um fornecedor`,
        descricao: `${Math.round(pct)}% de todo o gasto de compras está concentrado em "${nome}". Qualquer problema com este fornecedor (falência, greve, aumento de preço) impacta diretamente a operação.`,
        dado: `${fmtBRL(valor)} de ${fmtBRL(totalGastoGeral)} total`,
        acao: "Diversificar base de fornecedores. Meta: nenhum fornecedor acima de 30% do gasto total.",
      });
    }
  });

  // 8. Variação de preço acima de 25%
  const precoHistorico = {};
  todasCots.forEach(cot => {
    const ch = chamados.find(c => c.id === cot.chamadoId);
    if (!ch) return;
    cot.fornecedores.filter(f => f.valor != null).forEach(f => {
      if (!precoHistorico[ch.peca]) precoHistorico[ch.peca] = [];
      precoHistorico[ch.peca].push({ valor: f.valor, data: cot.dataEnvio, forn: f.nome });
    });
  });
  Object.entries(precoHistorico).forEach(([peca, entries]) => {
    if (entries.length < 2) return;
    const sorted = [...entries].sort((a, b) => new Date(a.data) - new Date(b.data));
    const primeiro = sorted[0].valor;
    const ultimo = sorted[sorted.length - 1].valor;
    const variacao = ((ultimo - primeiro) / primeiro) * 100;
    if (variacao > 25) {
      alertas.push({
        id: `fin_preco_${peca}`,
        categoria: "financeiro",
        severidade: variacao > 50 ? "alta" : "media",
        titulo: `Alta variação de preço detectada`,
        descricao: `"${peca}" teve variação de +${variacao.toFixed(0)}% no preço entre a primeira e a última cotação. Tendência de alta pode impactar o orçamento de manutenção.`,
        dado: `De ${fmtBRL(primeiro)} → ${fmtBRL(ultimo)}`,
        acao: "Revisar orçamento previsto para este item. Avaliar compra em quantidade maior enquanto o preço está favorável.",
      });
    }
  });

  // 9. Frete FOB com custo elevado
  todasCots.forEach(cot => {
    const fsFOB = cot.fornecedores.filter(f => f.frete === "FOB" && f.valorFrete > 0 && f.valor != null);
    fsFOB.forEach(f => {
      const pctFrete = (f.valorFrete / f.valor) * 100;
      if (pctFrete > 20) {
        const ch = chamados.find(c => c.id === cot.chamadoId);
        alertas.push({
          id: `fin_frete_${f.token}`,
          categoria: "financeiro",
          severidade: "media",
          titulo: `Frete FOB representa custo elevado`,
          descricao: `Na cotação ${ch?.numero || ""}, o frete de "${f.nome}" representa ${pctFrete.toFixed(0)}% do valor da peça. O preço unitário parecia competitivo mas o custo total é elevado.`,
          dado: `Peça: ${fmtBRL(f.valor)} + Frete: ${fmtBRL(f.valorFrete)} = Total: ${fmtBRL(f.valor + f.valorFrete)}`,
          acao: "Comparar sempre pelo custo total (CIF equivalente). Negociar frete incluso ou consolidar pedidos com este fornecedor.",
        });
      }
    });
  });

  // 10. Equipamento com alta frequência corretiva
  const corrPorEquip = {};
  chamados.forEach(ch => {
    if (ch.categoria !== "corretiva") return;
    corrPorEquip[ch.equipamentoId] = (corrPorEquip[ch.equipamentoId] || 0) + 1;
  });
  Object.entries(corrPorEquip).forEach(([eqId, count]) => {
    if (count >= 2) {
      const eq = equipamentos.find(e => e.id === parseInt(eqId));
      const custoEq = finalizados.filter(c => c.equipamentoId === parseInt(eqId) && c.categoria === "corretiva").reduce((a, c) => a + (c.valorNegociado || c.valorAprovado), 0);
      alertas.push({
        id: `op_corr_${eqId}`,
        categoria: "operacional",
        severidade: count >= 3 ? "alta" : "media",
        titulo: `Equipamento com histórico crítico de falhas corretivas`,
        descricao: `"${eq?.nome || eqId}" (${eq?.tag}) acumulou ${count} manutenções corretivas. Equipamento pode estar próximo do limite de vida útil ou necessitar revisão geral.`,
        dado: `Custo corretivo acumulado: ${fmtBRL(custoEq)}`,
        acao: "Calcular relação custo de manutenção × valor de reposição do equipamento. Se >50% do valor novo, avaliar substituição.",
      });
    }
  });

  // 11. Lead time longo em alta urgência
  finalizados.filter(c => c.urgencia === "alta" && c.leadTime >= 5).forEach(ch => {
    const eq = equipamentos.find(e => e.id === ch.equipamentoId);
    alertas.push({
      id: `op_lead_${ch.id}`,
      categoria: "operacional",
      severidade: "alta",
      titulo: `Lead time crítico em item de alta urgência`,
      descricao: `"${ch.peca}" (equipamento ${eq?.tag || ""}) levou ${ch.leadTime} dias para ser entregue. Em equipamentos parados, cada dia de espera tem custo operacional direto.`,
      dado: `${ch.leadTime}d de lead time · Urgência: Alta`,
      acao: "Manter estoque mínimo de segurança para este item. Pré-qualificar fornecedor com pronta entrega.",
    });
  });

  // ordenar: alta > media > baixa
  const ordem = { alta: 0, media: 1, baixa: 2 };
  alertas.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);

  const sevCfg = {
    alta: { c: "#ef4444", bg: "#3f0f0f", l: "Alto" },
    media: { c: "#f59e0b", bg: "#3f2a0a", l: "Médio" },
    baixa: { c: "#60a5fa", bg: "#0f1e35", l: "Baixo" },
  };
  const catIcon = {
    compliance: "🔍",
    fornecedor: "🏭",
    financeiro: "💰",
    operacional: "⚙️",
  };
  const catLabel = {
    compliance: "Compliance",
    fornecedor: "Fornecedor",
    financeiro: "Financeiro",
    operacional: "Operacional",
  };
  const catColor = {
    compliance: "#f87171",
    fornecedor: "#a78bfa",
    financeiro: "#22c55e",
    operacional: "#60a5fa",
  };

  const resumo = ["compliance", "fornecedor", "financeiro", "operacional"].map(cat => ({
    cat,
    icon: catIcon[cat],
    label: catLabel[cat],
    color: catColor[cat],
    altas: alertas.filter(a => a.categoria === cat && a.severidade === "alta").length,
    total: alertas.filter(a => a.categoria === cat).length,
  }));

  // ── IA ANALYSIS ──
  const gerarAnaliseIA = () => {
    setIaLoading(true);
    setIaAnalise("");
    setIaErro("");

    const alto = alertas.filter(a => a.severidade === "alta").length;
    const totalGasto = finalizados.reduce((s, c) => s + (c.valorNegociado || c.valorAprovado), 0);
    const alertasTexto = alertas.slice(0, 8).map(a => `- [${a.severidade.toUpperCase()}] ${a.categoria}: ${a.titulo} | Dado: ${a.dado}`).join("\n");

    // Fallback local (sem chamada externa)
    setTimeout(() => {
      const linhas = [];
      linhas.push("PARECER EXECUTIVO — INTELIGÊNCIA DE SUPRIMENTOS\n");
      linhas.push("1. DIAGNÓSTICO GERAL");
      linhas.push(
        `A operação registrou ${alertas.length} alertas no período, sendo ${alto} de alta severidade. O gasto total de manutenção foi de ${fmtBRL(totalGasto)} em ${finalizados.length} ordens finalizadas. O perfil de risco requer atenção prioritária em ${
          alto > 0 ? "conformidade e concentração de fornecedores" : "gestão de custos e lead times"
        }.`
      );
      linhas.push("\n2. PRINCIPAIS RISCOS IDENTIFICADOS");
      const compAlerts = alertas.filter(a => a.categoria === "compliance");
      const fornAlerts = alertas.filter(a => a.categoria === "fornecedor");
      const finAlerts = alertas.filter(a => a.categoria === "financeiro");
      const opAlerts = alertas.filter(a => a.categoria === "operacional");
      if (compAlerts.length > 0) {
        linhas.push(`• 🔴 Compliance (${compAlerts.length} alerta${compAlerts.length > 1 ? "s" : ""}): ${compAlerts[0].titulo}. Risco de fraude ou favorecimento indevido.`);
      }
      if (fornAlerts.length > 0) {
        linhas.push(`• 🟠 Fornecedor (${fornAlerts.length} alerta${fornAlerts.length > 1 ? "s" : ""}): ${fornAlerts[0].titulo}. Dependência de fonte única compromete a continuidade operacional.`);
      }
      if (finAlerts.length > 0) {
        linhas.push(`• 🟡 Financeiro (${finAlerts.length} alerta${finAlerts.length > 1 ? "s" : ""}): ${finAlerts[0].titulo}. Variações de preço podem corroer a margem operacional.`);
      }
      if (opAlerts.length > 0) {
        linhas.push(`• 🔵 Operacional (${opAlerts.length} alerta${opAlerts.length > 1 ? "s" : ""}): ${opAlerts[0].titulo}. Equipamentos com manutenção recorrente merecem análise de substituição.`);
      }
      if (alertas.length === 0) {
        linhas.push("• ✅ Nenhum risco crítico identificado com os dados atuais. Manter monitoramento contínuo.");
      }
      linhas.push("\n3. RECOMENDAÇÃO PRIORITÁRIA IMEDIATA");
      if (compAlerts.length > 0) {
        linhas.push(
          "Iniciar auditoria nos processos de aprovação — analisar histórico de comunicações entre compradores e fornecedores com padrão suspeito. Implementar política de rodízio de aprovadores. Prazo: 15 dias."
        );
      } else if (fornAlerts.length > 0) {
        linhas.push(
          "Prospectar ao menos um fornecedor alternativo homologado para cada item com fonte única identificada. Priorizar itens de alta urgência. Prazo: 30 dias."
        );
      } else {
        linhas.push(
          "Manter a cadência de monitoramento atual. Revisar os benchmarks de preço trimestralmente e atualizar a base de fornecedores homologados."
        );
      }
      setIaAnalise(linhas.join("\n"));
      setIaLoading(false);
    }, 1200);
  };

  // ── RENDERIZAÇÃO ──
  return (
    <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>MÓDULO ESTRATÉGICO</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Inteligência de Suprimentos</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Análise automática de riscos baseada nos dados históricos do sistema</div>
        </div>
        <button
          onClick={gerarAnaliseIA}
          disabled={iaLoading}
          style={{
            background: iaLoading ? C.surface : "#7c3aed",
            border: `1px solid ${iaLoading ? C.border : "#7c3aed"}`,
            borderRadius: 6,
            padding: "10px 20px",
            color: iaLoading ? C.muted : "white",
            fontSize: 13,
            cursor: iaLoading ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: iaLoading ? 0.7 : 1,
          }}
        >
          {iaLoading ? <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span> : "🤖"}
          {iaLoading ? "Analisando..." : "Gerar parecer com IA"}
        </button>
      </div>

      {/* Resumo por categoria */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        {resumo.map(r => (
          <div key={r.cat} style={{ ...s.card, padding: "14px 18px", borderLeft: `3px solid ${r.color}` }}>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.07em", marginBottom: 8 }}>{r.icon} {r.label.toUpperCase()}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: r.altas > 0 ? "#ef4444" : r.total > 0 ? C.warn : C.success }}>
                {r.total}
              </div>
              {r.altas > 0 && <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>{r.altas} crítico{r.altas > 1 ? "s" : ""}</div>}
              {r.total === 0 && <div style={{ fontSize: 11, color: C.success }}>✓ OK</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Parecer IA */}
      {(iaAnalise || iaErro || iaLoading) && (
        <div
          style={{
            ...s.card,
            padding: "20px 22px",
            marginBottom: 20,
            border: `1px solid #7c3aed44`,
            background: "linear-gradient(135deg,#1e1035,#111722)",
          }}
        >
          <div style={{ fontSize: 11, color: "#a78bfa", letterSpacing: "0.1em", marginBottom: 12 }}>🤖 PARECER EXECUTIVO — ANÁLISE DE IA</div>
          {iaLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.muted, fontSize: 13 }}>
              <div style={{ width: 16, height: 16, border: "2px solid #7c3aed", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              Consultando o analista de suprimentos...
            </div>
          )}
          {iaErro && <div style={{ color: "#ef4444", fontSize: 13 }}>{iaErro}</div>}
          {iaAnalise && <div style={{ fontSize: 13, color: C.text, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{iaAnalise}</div>}
        </div>
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>

      {/* Lista de alertas */}
      {alertas.length === 0 && (
        <div style={{ ...s.card, padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.success, marginBottom: 6 }}>Nenhum risco identificado</div>
          <div style={{ fontSize: 13, color: C.muted }}>O sistema não detectou padrões de risco com os dados atuais. Continue monitorando.</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {alertas.map(a => {
          const sev = sevCfg[a.severidade];
          const exp = expandAlert === a.id;
          return (
            <div key={a.id} style={{ ...s.card, border: `1px solid ${sev.c}33`, overflow: "hidden", transition: "all .2s" }}>
              <div
                onClick={() => setExpandAlert(exp ? null : a.id)}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#151d2e")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: sev.c, flexShrink: 0, boxShadow: `0 0 6px ${sev.c}` }} />
                <span style={{ ...s.tag(catColor[a.categoria]), flexShrink: 0 }}>{catIcon[a.categoria]} {catLabel[a.categoria].toUpperCase()}</span>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: C.text }}>{a.titulo}</div>
                <span
                  style={{
                    fontSize: 10,
                    background: sev.bg,
                    color: sev.c,
                    border: `1px solid ${sev.c}44`,
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    flexShrink: 0,
                  }}
                >
                  RISCO {sev.l.toUpperCase()}
                </span>
                <span style={{ color: C.muted, fontSize: 12, flexShrink: 0 }}>{exp ? "▲" : "▼"}</span>
              </div>
              {exp && (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: "16px 18px 18px 42px", background: "#0d1320" }}>
                  <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.7, marginBottom: 12 }}>{a.descricao}</div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
                    <div style={{ background: `${sev.c}11`, border: `1px solid ${sev.c}33`, borderRadius: 6, padding: "8px 14px", flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.07em", marginBottom: 4 }}>DADO QUE GEROU O ALERTA</div>
                      <div style={{ fontSize: 12, color: sev.c, fontWeight: 600 }}>{a.dado}</div>
                    </div>
                    <div style={{ background: "#1e3a5f22", border: `1px solid #3b82f633`, borderRadius: 6, padding: "8px 14px", flex: 2, minWidth: 240 }}>
                      <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.07em", marginBottom: 4 }}>AÇÃO RECOMENDADA</div>
                      <div style={{ fontSize: 12, color: "#93c5fd" }}>{a.acao}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Frete CIF/FOB breakdown */}
      <div style={{ ...s.card, overflow: "hidden", marginTop: 20 }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.08em" }}>🚚 ANÁLISE DE CUSTOS DE FRETE (CIF × FOB)</div>
          <div style={{ fontSize: 11, color: C.muted }}>Custo real = Peça + Frete</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", padding: "16px 20px", gap: 16, borderBottom: `1px solid ${C.border}` }}>
          {(() => {
            const todas = cotacoes.flatMap(c => c.fornecedores.filter(f => f.valor != null));
            const cif = todas.filter(f => f.frete === "CIF");
            const fob = todas.filter(f => f.frete === "FOB");
            const totalFrete = fob.reduce((s, f) => s + (f.valorFrete || 0), 0);
            const totalPecas = todas.reduce((s, f) => s + f.valor, 0);
            const pctFrete = totalPecas ? (totalFrete / totalPecas) * 100 : 0;
            return [
              { l: "Cotações CIF (frete incluso)", v: cif.length, c: C.success },
              { l: "Cotações FOB (frete separado)", v: fob.length, c: C.warn },
              { l: "Frete s/ custo total de peças", v: `${pctFrete.toFixed(1)}%`, c: pctFrete > 15 ? "#ef4444" : C.warn },
            ].map(k => (
              <div key={k.l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: k.c }}>{k.v}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{k.l}</div>
              </div>
            ));
          })()}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "120px 2fr 80px 80px 80px 100px 110px",
            padding: "10px 20px",
            background: C.bg,
            borderBottom: `1px solid ${C.border}`,
            fontSize: 10,
            color: C.muted,
            letterSpacing: "0.08em",
          }}
        >
          <span>Nº COT.</span>
          <span>FORNECEDOR</span>
          <span>MODALIDADE</span>
          <span>VL PEÇA</span>
          <span>FRETE</span>
          <span>CUSTO TOTAL</span>
          <span>% FRETE</span>
        </div>
        {cotacoes
          .flatMap(cot => {
            const ch = chamados.find(c => c.id === cot.chamadoId);
            return cot.fornecedores.filter(f => f.valor != null && f.frete).map(f => ({ ...f, numero: ch?.numero, peca: ch?.peca }));
          })
          .slice(0, 10)
          .map((f, i) => {
            const pct = f.valor ? ((f.valorFrete || 0) / f.valor) * 100 : 0;
            const total = (f.valor || 0) + (f.valorFrete || 0);
            return (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 2fr 80px 80px 80px 100px 110px",
                  padding: "11px 20px",
                  borderBottom: `1px solid ${C.border}22`,
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 11, color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>{f.numero}</span>
                <div>
                  <div style={{ fontSize: 12, color: C.text }}>{f.nome}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{f.peca}</div>
                </div>
                <span style={{ ...s.tag(f.frete === "CIF" ? C.success : C.warn) }}>{f.frete}</span>
                <span style={{ fontSize: 12, color: C.textSub }}>{fmtBRL(f.valor)}</span>
                <span style={{ fontSize: 12, color: f.valorFrete > 0 ? C.warn : C.muted }}>{f.valorFrete > 0 ? fmtBRL(f.valorFrete) : "—"}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmtBRL(total)}</span>
                <span style={{ fontSize: 12, color: pct > 20 ? "#ef4444" : pct > 10 ? C.warn : C.success, fontWeight: pct > 20 ? 700 : 400 }}>
                  {pct > 0 ? `${pct.toFixed(0)}%` : "—"}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}