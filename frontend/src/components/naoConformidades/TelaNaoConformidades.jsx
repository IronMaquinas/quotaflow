// frontend/src/components/naoConformidades/TelaNaoConformidades.jsx
//
// Listagem de Não Conformidades do tenant. Filtros por status e origem,
// busca livre, clique expande o card inline com descrição completa e
// contexto (OS/equipamento).
//
// Fase 2A: só listagem + visualização. Fluxo de tratamento (mudança de
// status, plano de ação, anexos) vem na 2B.

import { useState, useEffect, useCallback } from "react";
import apiService from "../../services/apiService";
import ModalDetalheNC from "./ModalDetalheNC";

// ─────────────────────────────────────────────────────────────────────────
// CONSTANTES DE UI
// ─────────────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  aberta:               { l: "Aberta",                c: "#f59e0b", icon: "🟡" },
  em_analise:           { l: "Em análise",            c: "#60a5fa", icon: "🔍" },
  em_execucao:          { l: "Em execução",           c: "#a855f7", icon: "⚙️" },
  aguardando_validacao: { l: "Aguardando validação",  c: "#f59e0b", icon: "⏳" },
  resolvida:            { l: "Resolvida",             c: "#22c55e", icon: "✅" },
  cancelada:            { l: "Cancelada",             c: "#6b7280", icon: "⚫" },
};

const ORIGEM_CFG = {
  recebimento:  { l: "Recebimento",       icon: "📥" },
  os_material:  { l: "Material na OS",    icon: "📦" },
  os_servico:   { l: "Serviço na OS",     icon: "🛠" },
  inspecao:     { l: "Inspeção",          icon: "🔎" },
  pos_venda:    { l: "Pós-venda",         icon: "📞" },
};

const DISPOSICAO_CFG = {
  pendente:      { l: "Pendente",         icon: "⏳" },
  devolucao:     { l: "Devolução",        icon: "↩️" },
  retrabalho:    { l: "Retrabalho",       icon: "🔧" },
  descarte:      { l: "Descarte",         icon: "🗑" },
  uso_como_esta: { l: "Uso como está",    icon: "✔️" },
};

export default function TelaNaoConformidades({ C, s, fmtD, onIrParaOS }) {
  const [ncs, setNcs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState("todas");
  const [filtroOrigem, setFiltroOrigem] = useState("");
  const [busca, setBusca] = useState("");

  // Card expandido (só 1 por vez, clicar em outro fecha o anterior)
  const [expandidoId, setExpandidoId] = useState(null);
  const [ncAbertaId, setNcAbertaId] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = {};
      if (filtroStatus !== "todas") params.status = filtroStatus;
      if (filtroOrigem) params.origem = filtroOrigem;
      if (busca.trim()) params.q = busca.trim();

      const lista = await apiService.get("/nao-conformidades", params);
      setNcs(Array.isArray(lista) ? lista : []);
    } catch (e) {
      setErro(e.message || "Erro ao carregar NCs");
    } finally {
      setCarregando(false);
    }
  }, [filtroStatus, filtroOrigem, busca]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── KPIs resumidos (contadores do topo) ──
  const kpis = {
    total: ncs.length,
    abertas: ncs.filter(n => ["aberta", "em_analise", "em_execucao", "aguardando_validacao"].includes(n.status)).length,
    resolvidas: ncs.filter(n => n.status === "resolvida").length,
    canceladas: ncs.filter(n => n.status === "cancelada").length,
  };

  return (
    <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
      {/* Cabeçalho */}
      <div style={{ display: "flex", justifyContent: "space-between",
                    alignItems: "flex-start", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>
            QUALIDADE
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>
            Não Conformidades
          </div>
        </div>
        <button
          onClick={() => alert("Em breve: criar NC avulsa (sem OS vinculada). Por ora, use o botão '⚠️ Reportar problema' dentro de uma Ordem de Serviço.")}
          style={{ ...s.btn(true), padding: "9px 20px", fontSize: 12 }}>
          ➕ Nova NC
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: 10, marginBottom: 18 }}>
        {[
          { l: "Total",       v: kpis.total,      c: C.text },
          { l: "Em aberto",   v: kpis.abertas,    c: "#f59e0b" },
          { l: "Resolvidas",  v: kpis.resolvidas, c: C.success },
          { l: "Canceladas",  v: kpis.canceladas, c: C.muted },
        ].map(k => (
          <div key={k.l} style={{ ...s.card, padding: "12px 16px" }}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em",
                          marginBottom: 4 }}>
              {k.l.toUpperCase()}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <input type="text"
          placeholder="Buscar por número, descrição, OS ou responsável..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ ...s.input, flex: 1, minWidth: 220, padding: "8px 12px", fontSize: 12 }} />

        <div style={{ display: "flex", gap: 4 }}>
          {[
            { id: "todas",                label: "Todas" },
            { id: "aberta",               label: "Abertas" },
            { id: "em_analise",           label: "Em análise" },
            { id: "em_execucao",          label: "Em execução" },
            { id: "aguardando_validacao", label: "Aguard. validação" },
            { id: "resolvida",            label: "Resolvidas" },
            { id: "cancelada",            label: "Canceladas" },
          ].map(f => (
            <button key={f.id}
              onClick={() => setFiltroStatus(f.id)}
              style={{
                background: filtroStatus === f.id ? C.accent : "transparent",
                border: `1px solid ${filtroStatus === f.id ? C.accent : C.border}`,
                borderRadius: 6, padding: "6px 12px",
                color: filtroStatus === f.id ? "white" : C.muted,
                fontSize: 11, cursor: "pointer", fontFamily: "inherit",
              }}>
              {f.label}
            </button>
          ))}
        </div>

        <select value={filtroOrigem}
          onChange={e => setFiltroOrigem(e.target.value)}
          style={{ ...s.input, padding: "6px 12px", fontSize: 11,
                   appearance: "none", maxWidth: 180 }}>
          <option value="">Todas as origens</option>
          {Object.entries(ORIGEM_CFG).map(([id, cfg]) => (
            <option key={id} value={id}>{cfg.icon} {cfg.l}</option>
          ))}
        </select>
      </div>

      {/* Conteúdo */}
      {carregando && (
        <div style={{ color: C.muted, padding: 40, textAlign: "center" }}>
          Carregando NCs...
        </div>
      )}

      {erro && !carregando && (
        <div style={{ color: "#ef4444", padding: 20, background: "#ef444422",
                      borderRadius: 8, marginBottom: 16 }}>
          ⚠ {erro}
        </div>
      )}

      {!carregando && ncs.length === 0 && (
        <div style={{ ...s.card, padding: "50px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 15, color: C.text, fontWeight: 500, marginBottom: 6 }}>
            Nenhuma Não Conformidade encontrada
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>
            {busca || filtroOrigem || filtroStatus !== "todas"
              ? "Ajuste os filtros ou limpe a busca."
              : "As NCs criadas a partir de uma OS aparecem aqui."}
          </div>
        </div>
      )}

      {!carregando && ncs.map(nc => {
        const st = STATUS_CFG[nc.status] || { l: nc.status, c: C.muted, icon: "•" };
        const origem = ORIGEM_CFG[nc.origem] || { l: nc.origem, icon: "•" };
        const disp = DISPOSICAO_CFG[nc.disposicao] || DISPOSICAO_CFG.pendente;
        const expandido = expandidoId === nc.id;

        return (
          <div key={nc.id} style={{
            background: C.surface,
            border: `1px solid ${expandido ? C.accent : C.border}`,
            borderRadius: 8,
            marginBottom: 8,
            overflow: "hidden",
            transition: "border-color 0.15s",
          }}>
            {/* Linha principal (clicável) */}
            <div
              onClick={() => setExpandidoId(expandido ? null : nc.id)}
              style={{ padding: "12px 16px", cursor: "pointer" }}>

              <div style={{ display: "flex", alignItems: "center", gap: 10,
                            marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: C.accent, fontFamily: "'IBM Plex Mono',monospace",
                }}>
                  {nc.numero_nc}
                </span>
                <span style={{ ...s.tag(st.c), fontSize: 10 }}>
                  {st.icon} {st.l}
                </span>
                <span style={{ ...s.tag(C.muted), fontSize: 10 }}>
                  {origem.icon} {origem.l}
                </span>
                {nc.disposicao && nc.disposicao !== "pendente" && (
                  <span style={{ ...s.tag("#a855f7"), fontSize: 10 }}>
                    {disp.icon} {disp.l}
                  </span>
                )}
                <span style={{ fontSize: 10, color: C.muted, marginLeft: "auto" }}>
                  {expandido ? "▼" : "▶"}
                </span>
              </div>

              <div style={{ fontSize: 12, color: C.text, marginBottom: 6,
                            overflow: "hidden", textOverflow: "ellipsis",
                            whiteSpace: expandido ? "normal" : "nowrap" }}>
                {nc.descricao_problema}
              </div>

              <div style={{ display: "flex", gap: 14, fontSize: 10,
                            color: C.muted, flexWrap: "wrap" }}>
                {nc.chamado_numero && (
                  <span>🔗 {nc.chamado_numero}</span>
                )}
                {nc.equipamento_nome && nc.equipamento_nome !== "—" && (
                  <span>🔧 {nc.equipamento_nome}
                    {nc.equipamento_tag && ` · ${nc.equipamento_tag}`}
                  </span>
                )}
                {nc.criado_por_nome && (
                  <span>👤 aberta por {nc.criado_por_nome}</span>
                )}
                {nc.criado_em && (
                  <span>📅 {fmtD ? fmtD(nc.criado_em) : new Date(nc.criado_em).toLocaleDateString("pt-BR")}</span>
                )}
              </div>
            </div>

            {/* Painel expandido */}
            {expandido && (
              <div style={{
                borderTop: `1px dashed ${C.border}`,
                padding: "14px 16px",
                background: C.bg,
                fontSize: 12,
              }}>
                {/* Ação imediata */}
                {nc.acao_imediata && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: C.muted,
                                  letterSpacing: "0.08em", marginBottom: 4 }}>
                      AÇÃO IMEDIATA
                    </div>
                    <div style={{ color: C.text, fontStyle: "italic",
                                  padding: "8px 10px",
                                  background: `${C.accent}10`,
                                  borderLeft: `2px solid ${C.accent}`,
                                  borderRadius: 3 }}>
                      {nc.acao_imediata}
                    </div>
                  </div>
                )}

                {/* Resolução (quando já resolvida) */}
                {nc.solucao_aplicada && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: C.muted,
                                  letterSpacing: "0.08em", marginBottom: 4 }}>
                      SOLUÇÃO APLICADA
                    </div>
                    <div style={{ color: C.success, fontStyle: "italic",
                                  padding: "8px 10px",
                                  background: `${C.success}10`,
                                  borderLeft: `2px solid ${C.success}`,
                                  borderRadius: 3 }}>
                      {nc.solucao_aplicada}
                    </div>
                  </div>
                )}

                {/* Motivo cancelamento (quando cancelada) */}
                {nc.motivo_cancelamento && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: C.muted,
                                  letterSpacing: "0.08em", marginBottom: 4 }}>
                      MOTIVO DO CANCELAMENTO
                    </div>
                    <div style={{ color: "#ef4444",
                                  padding: "8px 10px",
                                  background: "#ef444415",
                                  borderLeft: `2px solid #ef4444`,
                                  borderRadius: 3 }}>
                      {nc.motivo_cancelamento}
                    </div>
                  </div>
                )}

                {/* Metadados */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
                              gap: 8, fontSize: 11, marginBottom: 12 }}>
                  {nc.quantidade != null && (
                    <div>
                      <span style={{ color: C.muted }}>Quantidade afetada: </span>
                      <strong style={{ color: C.text }}>{nc.quantidade} un</strong>
                    </div>
                  )}
                  {nc.custo_estimado != null && (
                    <div>
                      <span style={{ color: C.muted }}>Custo estimado: </span>
                      <strong style={{ color: C.text }}>
                        R$ {Number(nc.custo_estimado).toFixed(2)}
                      </strong>
                    </div>
                  )}
                  {nc.responsavel_nome && (
                    <div>
                      <span style={{ color: C.muted }}>Responsável: </span>
                      <strong style={{ color: C.text }}>{nc.responsavel_nome}</strong>
                    </div>
                  )}
                  {nc.resolvida_por_nome && (
                    <div>
                      <span style={{ color: C.muted }}>Resolvida por: </span>
                      <strong style={{ color: C.text }}>{nc.resolvida_por_nome}</strong>
                    </div>
                  )}
                </div>

                {/* Rodapé de ações (placeholder pra 2B) */}
                <div style={{ display: "flex", gap: 8, paddingTop: 10,
                              borderTop: `1px dashed ${C.border}` }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setNcAbertaId(nc.id);
                    }}
                    style={{ ...s.btn(true), padding: "6px 14px", fontSize: 11 }}>
                    Abrir detalhe completo →
                  </button>
                  {nc.chamado_id && onIrParaOS && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onIrParaOS(nc.chamado_id);
                      }}
                      style={{ ...s.btn(false), padding: "6px 14px", fontSize: 11 }}>
                      🔗 Ver {nc.chamado_numero}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Modal de detalhe */}
            {ncAbertaId && (
              <ModalDetalheNC
                ncId={ncAbertaId}
                onFechar={() => setNcAbertaId(null)}
                onAtualizar={carregar}
                onIrParaOS={onIrParaOS}
                s={s}
                C={C}
                fmtD={fmtD}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}