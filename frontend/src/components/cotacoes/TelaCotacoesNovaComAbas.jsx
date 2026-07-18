// components/cotacoes/TelaCotacoesNovaComAbas.jsx
/**
 * VERSÃO ADAPTADA PARA SEU CÓDIGO EXISTENTE
 * 
 * Mantém 100% compatibilidade com:
 * - Seus hooks: useCotacoes, useFornecedores, useChamados, useEmail
 * - Suas funções: criarCotacao, aprovarFornecedor, enviarCotacao
 * - Seu estado: cotacoes, fornecedores, chamados
 * - Suas props: fmtBRL, fmtD, C, s
 * 
 * Apenas ADICIONA:
 * - Nova ABA para modo automático
 * - Agrupamento por categoria
 * - Seleção de fornecedores por item
 */

import { useState, useEffect, useCallback } from "react";
import { useCotacoes } from "../../hooks/useCotacoes";
import { useFornecedores } from "../../hooks/useFornecedores";
import { useChamados } from "../../hooks/useChamados";
import { useEmail } from "../../hooks/useEmail";

export default function TelaCotacoesNovaComAbas({ fmtBRL, fmtD, C, s }) {
  // ─── HOOKS EXISTENTES (mantém tudo como antes) ─────────────
  const { cotacoes, loading, erro, carregar: listarCotacoes, criar: criarCotacao, aprovar: aprovarFornecedor } = useCotacoes();
  const { fornecedores } = useFornecedores();
  const { chamados } = useChamados();
  const { enviarCotacao } = useEmail();

  const cotacoesSeguro = cotacoes || [];
  const fornecedoresSeguro = fornecedores || [];
  const chamadosSeguro = chamados || [];

  // ─── ESTADO EXISTENTE (mantém tudo como antes) ─────────────
  const [telaAtual, setTelaAtual] = useState("lista");
  const [cotacaoSel, setCotacaoSel] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [aprovando, setAprovando] = useState(false);

  // ─── NOVO: ABA ATIVA (Manual vs Automático) ─────────────────
  const [abaAtiva, setAbaAtiva] = useState("manual");

  // ─── NOVO: ESTADO PARA MODO MANUAL ────────────────────────
  const [formManual, setFormManual] = useState({
    chamadoId: "",
    fornecedorIds: [],
  });

  // ─── NOVO: ESTADO PARA MODO AUTOMÁTICO ────────────────────
  const [chamadoAutomatico, setChamadoAutomatico] = useState(null);
  const [agrupado, setAgrupado] = useState([]);
  const [selecionesFornecedor, setSelecionesFornecedor] = useState({});
  const [carregandoAutomatico, setCarregandoAutomatico] = useState(false);
  const [enviadoAutomatico, setEnviadoAutomatico] = useState(false);

  // Carregar cotações ao montar
  useEffect(() => {
    listarCotacoes();
  }, []);

  // ─── NOVO: PROCESSAR ITENS PARA MODO AUTOMÁTICO ───────────
  const processarItensAutomatico = useCallback((chamado) => {
    if (!chamado || !chamado.itens || chamado.itens.length === 0) {
      setAgrupado([]);
      setSelecionesFornecedor({});
      return;
    }

    // Agrupa itens por categoria
    const grupos = {};
    const selecoes = {};

    chamado.itens.forEach((item) => {
      const categoria = item.categoria || "Sem Categoria";
      if (!grupos[categoria]) {
        grupos[categoria] = [];
      }
      grupos[categoria].push(item);
      selecoes[item.id] = [];
    });

    // Converte para array de grupos
    const agrupados = Object.entries(grupos).map(([categoria, itens]) => ({
      categoria,
      itens,
    }));

    setAgrupado(agrupados);
    setSelecionesFornecedor(selecoes);
  }, []);

  // ─── NOVO: TOGGLE FORNECEDOR ───────────────────────────────
  const toggleFornecedorAutomatico = useCallback((itemId, fornecedorId) => {
    setSelecionesFornecedor((prev) => {
      const atual = prev[itemId] || [];
      const novoArray = atual.includes(fornecedorId)
        ? atual.filter((id) => id !== fornecedorId)
        : [...atual, fornecedorId];

      return { ...prev, [itemId]: novoArray };
    });
  }, []);

  // ─── NOVO: SELECIONAR TODOS FORNECEDORES DE UM ITEM ────────
  const selecionarTodosFornecedoresItem = useCallback((itemId) => {
    const item = chamadoAutomatico?.itens?.find((i) => i.id === itemId);
    if (!item) return;

    // Filtra fornecedores que têm este item
    const fornecedoresItem = fornecedoresSeguro.filter(
      (f) => f.categorias && f.categorias.includes(item.categoria)
    );

    setSelecionesFornecedor((prev) => ({
      ...prev,
      [itemId]: fornecedoresItem.map((f) => f.id),
    }));
  }, [chamadoAutomatico, fornecedoresSeguro]);

  // ─── NOVO: DESSELECIONAR TODOS ──────────────────────────────
  const deselecionarTodosFornecedoresItem = useCallback((itemId) => {
    setSelecionesFornecedor((prev) => ({
      ...prev,
      [itemId]: [],
    }));
  }, []);

  // ─── NOVO: ENVIAR COTAÇÕES AUTOMÁTICAS ─────────────────────
  const handleEnviarAutomatico = async () => {
    // Valida seleções
    const selecoesTotal = Object.values(selecionesFornecedor).reduce(
      (acc, ids) => acc + ids.length,
      0
    );

    if (selecoesTotal === 0) {
      alert("Selecione ao menos um fornecedor para um item");
      return;
    }

    if (!chamadoAutomatico) {
      alert("Nenhum chamado selecionado");
      return;
    }

    setEnviando(true);
    try {
      // Agrupa seleções por fornecedor
      const agrupamentoPorFornecedor = {};

      Object.entries(selecionesFornecedor).forEach(([itemId, fornecedorIds]) => {
        fornecedorIds.forEach((fornId) => {
          if (!agrupamentoPorFornecedor[fornId]) {
            agrupamentoPorFornecedor[fornId] = [];
          }
          agrupamentoPorFornecedor[fornId].push(parseInt(itemId));
        });
      });

      // Cria cotação para cada fornecedor
      for (const [fornecedorId, itemIds] of Object.entries(agrupamentoPorFornecedor)) {
        const fornId = parseInt(fornecedorId);
        
        // Usa seu método criarCotacao existente
        const novaCotacao = await criarCotacao({
          chamado_id: chamadoAutomatico.id,
          fornecedor_ids: [fornId],
          itens_ids: itemIds, // passa apenas os itens deste fornecedor
        });

        // Envia email
        const forn = fornecedoresSeguro.find((f) => f.id === fornId);
        if (forn?.email && typeof enviarCotacao === "function") {
          await enviarCotacao({
            cotacaoId: novaCotacao.id,
            fornecedorId: fornId,
            email: forn.email,
          });
        }
      }

      await listarCotacoes();
      setEnviadoAutomatico(true);
      setChamadoAutomatico(null);
      setAgrupado([]);
      setSelecionesFornecedor({});

      alert("Cotações inteligentes criadas e enviadas com sucesso!");

      // Limpa após 2 segundos
      setTimeout(() => {
        setEnviadoAutomatico(false);
        setAbaAtiva("manual");
      }, 2000);
    } catch (e) {
      console.error(e);
      alert("Erro ao criar cotações: " + e.message);
    } finally {
      setEnviando(false);
    }
  };

  // ─── MODO MANUAL (seu código original) ──────────────────────
  const handleCriarCotacaoManual = async () => {
    if (!formManual.chamadoId || formManual.fornecedorIds.length === 0) {
      alert("Selecione chamado e pelo menos 1 fornecedor");
      return;
    }

    setEnviando(true);
    try {
      const novaCotacao = await criarCotacao({
        chamado_id: formManual.chamadoId,
        fornecedor_ids: formManual.fornecedorIds,
      });

      for (const fornId of formManual.fornecedorIds) {
        const forn = fornecedoresSeguro.find((f) => f.id === fornId);
        if (forn?.email && typeof enviarCotacao === "function") {
          await enviarCotacao({
            cotacaoId: novaCotacao.id,
            fornecedorId: fornId,
            email: forn.email,
          });
        }
      }

      await listarCotacoes();
      setModal(null);
      setFormManual({ chamadoId: "", fornecedorIds: [] });
      alert("Cotação criada e enviada com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao criar cotação: " + e.message);
    } finally {
      setEnviando(false);
    }
  };

  // ─── APERTAR BOTÃO NOVA COTAÇÃO ────────────────────────────
  const handleAbrirNovaJanelaModal = (tipoAba) => {
    if (tipoAba === "manual") {
      setAbaAtiva("manual");
      setModal("nova");
    } else if (tipoAba === "automatico") {
      setAbaAtiva("automatico");
      setModal("nova");
      setChamadoAutomatico(null);
      setAgrupado([]);
      setSelecionesFornecedor({});
    }
  };

  // ─── APPROVE FORNECEDOR (seu código original) ───────────────
  const handleAprovarFornecedor = async (cotacaoId, fornecedorId) => {
    if (!window.confirm("Confirma aprovação deste fornecedor como vencedor?")) return;

    setAprovando(true);
    try {
      await aprovarFornecedor(cotacaoId, fornecedorId);
      await listarCotacoes();
      setCotacaoSel(null);
      alert("Fornecedor aprovado com sucesso!");
    } catch (e) {
      alert("Erro: " + e.message);
    } finally {
      setAprovando(false);
    }
  };

  // ─── FILTRO COTAÇÕES (seu código original) ─────────────────
  const cotacoesFiltered = cotacoesSeguro
    .filter((c) => filtro === "todos" || c.status === filtro)
    .filter((c) => {
      const chamado = chamadosSeguro.find((ch) => ch.id === c.chamadoId);
      return (
        !busca ||
        (chamado && chamado.peca && chamado.peca.toLowerCase().includes(busca.toLowerCase())) ||
        (chamado && chamado.codigo && chamado.codigo.toLowerCase().includes(busca.toLowerCase()))
      );
    });

  // ─── RENDER: MODAL NOVA COTAÇÃO ─────────────────────────────
  if (modal === "nova") {
    const chamadosSemCotacao = chamadosSeguro.filter(
      (ch) => !cotacoesSeguro.some((c) => c.chamadoId === ch.id && c.status !== "finalizado")
    );

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#00000090",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 300,
          padding: 20,
        }}
      >
        <div
          style={{
            ...s.card,
            width: 620,
            maxWidth: "100%",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 24px 48px #00000060",
          }}
        >
          {/* Header com abas */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 22px",
              borderBottom: `1px solid ${C.border}`,
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setAbaAtiva("manual")}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  color: abaAtiva === "manual" ? C.accent : C.muted,
                  cursor: "pointer",
                  padding: "6px 12px",
                  borderBottom:
                    abaAtiva === "manual" ? `2px solid ${C.accent}` : "none",
                  fontFamily: "inherit",
                }}
              >
                📝 Manual
              </button>
              <button
                onClick={() => setAbaAtiva("automatico")}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  color: abaAtiva === "automatico" ? C.accent : C.muted,
                  cursor: "pointer",
                  padding: "6px 12px",
                  borderBottom:
                    abaAtiva === "automatico" ? `2px solid ${C.accent}` : "none",
                  fontFamily: "inherit",
                }}
              >
                🤖 Automático
              </button>
            </div>
            <button
              onClick={() => setModal(null)}
              style={{
                background: "transparent",
                border: "none",
                color: C.muted,
                fontSize: 20,
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
            {/* ABA MANUAL */}
            {abaAtiva === "manual" && (
              <>
                <div style={{ marginBottom: 18 }}>
                  <label style={s.label}>CHAMADO *</label>
                  <select
                    value={formManual.chamadoId}
                    onChange={(e) =>
                      setFormManual((f) => ({ ...f, chamadoId: e.target.value }))
                    }
                    style={{ ...s.input, appearance: "none" }}
                  >
                    <option value="">Selecione um chamado</option>
                    {chamadosSemCotacao.map((ch) => {
                      const primeiroItem =
                        ch.itens?.[0]?.item_nome || ch.peca || "Sem item";
                      return (
                        <option key={ch.id} value={ch.id}>
                          {ch.numero} - {primeiroItem} ({ch.urgencia || "média"})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={s.label}>FORNECEDORES *</label>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      maxHeight: 250,
                      overflowY: "auto",
                    }}
                  >
                    {fornecedoresSeguro
                      .filter((f) => f.ativo)
                      .map((forn) => (
                        <label
                          key={forn.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "8px 10px",
                            background: formManual.fornecedorIds.includes(forn.id)
                              ? C.accent + "22"
                              : C.bg,
                            borderRadius: 6,
                            cursor: "pointer",
                            border: formManual.fornecedorIds.includes(forn.id)
                              ? `1px solid ${C.accent}`
                              : "none",
                            transition: "all 0.2s",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={formManual.fornecedorIds.includes(forn.id)}
                            onChange={(e) =>
                              setFormManual((f) => ({
                                ...f,
                                fornecedorIds: e.target.checked
                                  ? [...f.fornecedorIds, forn.id]
                                  : f.fornecedorIds.filter(
                                      (id) => id !== forn.id
                                    ),
                              }))
                            }
                            style={{ cursor: "pointer" }}
                          />
                          <div>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: C.text,
                              }}
                            >
                              {forn.nome}
                            </div>
                            <div style={{ fontSize: 10, color: C.muted }}>
                              {forn.email}
                            </div>
                          </div>
                        </label>
                      ))}
                  </div>
                </div>
              </>
            )}

            {/* ABA AUTOMÁTICA */}
            {abaAtiva === "automatico" && (
              <>
                <div style={{ marginBottom: 18 }}>
                  <label style={s.label}>SELECIONE O CHAMADO *</label>
                  <select
                    onChange={(e) => {
                      const chamId = parseInt(e.target.value);
                      const cham = chamadosSeguro.find((ch) => ch.id === chamId);
                      setChamadoAutomatico(cham || null);
                      processarItensAutomatico(cham || null);
                    }}
                    style={{ ...s.input, appearance: "none" }}
                  >
                    <option value="">Selecione um chamado</option>
                    {chamadosSemCotacao.map((ch) => {
                      const primeiroItem =
                        ch.itens?.[0]?.item_nome || ch.peca || "Sem item";
                      return (
                        <option key={ch.id} value={ch.id}>
                          {ch.numero} - {primeiroItem} ({ch.itens?.length || 0}{" "}
                          itens)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {chamadoAutomatico && agrupado.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: C.muted,
                        letterSpacing: "0.08em",
                        marginBottom: 12,
                        fontWeight: 600,
                      }}
                    >
                      ITENS AGRUPADOS POR CATEGORIA ({agrupado.length} grupos)
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {agrupado.map((grupo, grupoIdx) => (
                        <div
                          key={grupoIdx}
                          style={{
                            background: C.bg,
                            border: `1px solid ${C.border}`,
                            borderRadius: 6,
                            padding: 12,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: C.accent,
                              marginBottom: 10,
                            }}
                          >
                            {grupo.categoria} ({grupo.itens.length} itens)
                          </div>

                          {grupo.itens.map((item) => (
                            <div
                              key={item.id}
                              style={{
                                padding: "8px 0",
                                borderTop: `1px solid ${C.border}33`,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 11,
                                  color: C.text,
                                  marginBottom: 6,
                                }}
                              >
                                {item.item_nome || item.nome} (Qtd:{" "}
                                {item.quantidade})
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 6,
                                }}
                              >
                                {fornecedoresSeguro
                                  .filter(
                                    (f) =>
                                      f.ativo &&
                                      f.categorias &&
                                      f.categorias.includes(grupo.categoria)
                                  )
                                  .map((forn) => (
                                    <label
                                      key={forn.id}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                        fontSize: 11,
                                        padding: "4px 8px",
                                        background:
                                          selecionesFornecedor[item.id]?.includes(
                                            forn.id
                                          )
                                            ? C.accent + "22"
                                            : "#ffffff05",
                                        border:
                                          selecionesFornecedor[item.id]?.includes(
                                            forn.id
                                          )
                                            ? `1px solid ${C.accent}`
                                            : `1px solid ${C.border}33`,
                                        borderRadius: 4,
                                        cursor: "pointer",
                                        transition: "all 0.2s",
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selecionesFornecedor[
                                          item.id
                                        ]?.includes(forn.id) || false}
                                        onChange={() =>
                                          toggleFornecedorAutomatico(
                                            item.id,
                                            forn.id
                                          )
                                        }
                                        style={{
                                          cursor: "pointer",
                                          width: 14,
                                          height: 14,
                                        }}
                                      />
                                      <span>{forn.nome}</span>
                                    </label>
                                  ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!chamadoAutomatico && (
                  <div
                    style={{
                      padding: "40px 20px",
                      textAlign: "center",
                      color: C.muted,
                    }}
                  >
                    Selecione um chamado acima para ver os itens agrupados
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer com botões */}
          <div
            style={{
              padding: "16px 22px",
              borderTop: `1px solid ${C.border}`,
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => {
                setModal(null);
                setFormManual({ chamadoId: "", fornecedorIds: [] });
                setChamadoAutomatico(null);
              }}
              style={{
                ...s.btn(false, C.muted),
                padding: "8px 16px",
                fontSize: 12,
              }}
            >
              Cancelar
            </button>

            {abaAtiva === "manual" && (
              <button
                onClick={handleCriarCotacaoManual}
                disabled={enviando || !formManual.chamadoId || formManual.fornecedorIds.length === 0}
                style={{
                  ...s.btn(true, C.accent),
                  padding: "8px 16px",
                  fontSize: 12,
                  opacity:
                    enviando || !formManual.chamadoId || formManual.fornecedorIds.length === 0
                      ? 0.5
                      : 1,
                }}
              >
                {enviando ? "Enviando..." : "✉️ Enviar Cotação"}
              </button>
            )}

            {abaAtiva === "automatico" && (
              <button
                onClick={handleEnviarAutomatico}
                disabled={enviando || !chamadoAutomatico}
                style={{
                  ...s.btn(true, C.accent),
                  padding: "8px 16px",
                  fontSize: 12,
                  opacity: enviando || !chamadoAutomatico ? 0.5 : 1,
                }}
              >
                {enviando ? "Enviando..." : "🤖 Enviar Cotações Inteligentes"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER: LISTAGEM (seu código original) ────────────────
  return (
    <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 22,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>
            COTAÇÕES
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>
            Gerenciador de Cotações
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => handleAbrirNovaJanelaModal("manual")}
            style={{
              ...s.btn(true, C.accent),
              padding: "10px 16px",
              fontSize: 12,
            }}
          >
            📝 Nova Cotação (Manual)
          </button>
          <button
            onClick={() => handleAbrirNovaJanelaModal("automatico")}
            style={{
              ...s.btn(true, "#7c3aed"),
              padding: "10px 16px",
              fontSize: 12,
            }}
          >
            🤖 Nova Cotação (Automática)
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 250 }}>
          <input
            placeholder="Buscar por peça ou código..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ ...s.input, width: "100%" }}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["todos", "em_curso", "finalizado"].map((status) => (
            <button
              key={status}
              onClick={() => setFiltro(status)}
              style={{
                ...s.btn(filtro === status, C.accent),
                padding: "8px 14px",
                fontSize: 11,
              }}
            >
              {status === "todos"
                ? "Todas"
                : status === "em_curso"
                ? "Em Curso"
                : "Finalizadas"}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de cotações */}
      {loading ? (
        <div style={{ textAlign: "center", color: C.muted, padding: "40px 20px" }}>
          Carregando cotações...
        </div>
      ) : cotacoesFiltered.length === 0 ? (
        <div style={{ ...s.card, padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>
            Nenhuma cotação encontrada
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>
            Clique em "Nova Cotação" para criar uma
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {cotacoesFiltered.map((cotacao) => {
            const chamado = chamadosSeguro.find((ch) => ch.id === cotacao.chamadoId);
            return (
              <div
                key={cotacao.id}
                onClick={() => {
                  setTelaAtual("detalhes");
                  setCotacaoSel(cotacao);
                }}
                style={{
                  ...s.card,
                  padding: "14px 18px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = C.surface;
                  e.currentTarget.style.borderColor = C.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = C.surface;
                  e.currentTarget.style.borderColor = C.border;
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.accent }}>
                    {cotacao.numero || `#${cotacao.id}`}
                  </div>
                  <div style={{ fontSize: 12, color: C.text, marginTop: 4 }}>
                    {chamado?.peca || "—"}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                    {fmtD(cotacao.enviado_em)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: C.muted }}>STATUS</div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color:
                          cotacao.status === "em_curso"
                            ? C.warn
                            : cotacao.status === "finalizado"
                            ? C.success
                            : C.muted,
                      }}
                    >
                      {cotacao.status === "em_curso"
                        ? "Em Curso"
                        : cotacao.status === "finalizado"
                        ? "Finalizado"
                        : "—"}
                    </div>
                  </div>

                  <div style={{ color: C.muted, fontSize: 16 }}>→</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
