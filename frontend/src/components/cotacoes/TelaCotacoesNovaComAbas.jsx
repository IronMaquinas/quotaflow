// components/cotacoes/TelaCotacoesNovaComAbas.jsx

import { useState, useEffect, useCallback } from "react";
import { useCotacoes } from "../../hooks/useCotacoes";
import { useFornecedores } from "../../hooks/useFornecedores";
import { useChamados } from "../../hooks/useChamados";
import { useEmail } from "../../hooks/useEmail";
import { cotacoesService } from "../../services/cotacoesService";
import TelaMonitorarRespostas from "./TelaMonitorarRespostas";

export default function TelaCotacoesNovaComAbas({ fmtBRL, fmtD, C, s }) {
  // ─── HOOKS EXISTENTES (mantém tudo como antes) ─────────────
  const token = localStorage.getItem("accessToken") || localStorage.getItem("access_token");
  const { cotacoes, loading, erro, carregar: listarCotacoes, criar: criarCotacao, aprovar: aprovarFornecedor, 
        buscarChamadoComItens, salvarCotacao, salvarEEnviarCotacao,   buscarDetalhesCotacao, atualizarCotacao, excluirCotacao } = useCotacoes(token);
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
  const [telaMonitorar, setTelaMonitorar] = useState(false);

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
  // ─── NOVO: ESTADO PARA VISUALIZAR RESPOSTAS ────────────────
  const [telaRespostas, setTelaRespostas] = useState(false);
  const [statusCotacao, setStatusCotacao] = useState(null);
  const [carregandoStatus, setCarregandoStatus] = useState(false);

  const [adicionandoFornecedorPara, setAdicionandoFornecedorPara] = useState(null);
  const [buscaFornecedorManual, setBuscaFornecedorManual] = useState("");
  const [buscaFornecedor, setBuscaFornecedor] = useState({});
  const [editandoId, setEditandoId] = useState(null);
  const [cotacaoEditando, setCotacaoEditando] = useState(null); 

  // Carregar cotações ao montar
  useEffect(() => {
    listarCotacoes();
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
      setEditandoId(null);
      setCarregandoAutomatico(false);
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

  // ─── NOVO: CARREGAR CHAMADO COM ITENS AGRUPADOS ─────────────
  const handleCarregarChamadoAutomatico = async (chamadoId) => {
    setCarregandoAutomatico(true);
    try {
      console.log(`🔍 Carregando chamado ${chamadoId}...`);
      
      const resultado = await buscarChamadoComItens(chamadoId);
      
      console.log(`✅ Chamado carregado:`, resultado);
      
      // Processar resposta do backend
      setChamadoAutomatico({
        id: resultado.chamado.id,
        numero: resultado.chamado.numero,
        itens: []  // Não usamos mais
      });

      // Estruturar dados agrupados por categoria
      const categoriasAgrupadas = Object.entries(resultado.itensPorCategoria).map(
        ([categoria, itens]) => ({
          categoria,
          itens: itens.map(item => ({
            id: item.id,
            nome: item.nome,
            quantidade: item.quantidade,
            fornecedores: item.fornecedores || [],
            fornecedoresSelecionados: []  // Iniciar vazio
          }))
        })
      );

      setAgrupado(categoriasAgrupadas);
      
      // Inicializar seleções
      const novasSel = {};
      categoriasAgrupadas.forEach(cat => {
        cat.itens.forEach(item => {
          novasSel[item.id] = [];
        });
      });
      setSelecionesFornecedor(novasSel);

    } catch (err) {
      console.error("❌ Erro ao carregar chamado:", err);
      alert("Erro ao carregar chamado: " + err.message);
    } finally {
      setCarregandoAutomatico(false);
    }
  };

  // Handle Salvar Automático uma cotação para envio posterior
  const handleSalvarAutomatico = async () => {
    const temSelecoes = Object.values(selecionesFornecedor).some(arr => arr.length > 0);
    if (!temSelecoes) {
      alert("Selecione pelo menos um fornecedor para um item");
      return;
    }
    if (!chamadoAutomatico) {
      alert("Nenhum chamado selecionado");
      return;
    }

    setEnviando(true);
    try {
      // Monta payload no formato correto: itens com fornecedores_ids
      const itensPayload = Object.entries(selecionesFornecedor).map(([itemId, fornecedorIds]) => ({
        item_id: parseInt(itemId),
        fornecedor_ids: fornecedorIds
      }));

      if (editandoId) {
        // Atualizar cotação existente
        await atualizarCotacao(editandoId, itensPayload, "");
        alert("Cotação atualizada com sucesso!");
      } else {
        // Salvar nova cotação
        await salvarCotacao(chamadoAutomatico.id, itensPayload, "");
        alert("Rascunho salvo com sucesso!");
      }

      await listarCotacoes();
      setModal(null);
      setEditandoId(null);
      setCotacaoEditando(null);
      setChamadoAutomatico(null);
      setAgrupado([]);
      setSelecionesFornecedor({});
    } catch (err) {
      console.error("❌ Erro ao salvar:", err);
      alert("Erro ao salvar: " + err.message);
    } finally {
      setEnviando(false);
    }
  };

  const handleEnviarAutomatico = async () => {
  const temSelecoes = Object.values(selecionesFornecedor).some(arr => arr.length > 0);
  if (!temSelecoes) {
    alert("Selecione pelo menos um fornecedor para um item");
    return;
  }
  if (!chamadoAutomatico) {
    alert("Nenhum chamado selecionado");
    return;
  }

  setEnviando(true);
  try {
    const itensPayload = Object.entries(selecionesFornecedor).map(([itemId, fornecedorIds]) => ({
      item_id: parseInt(itemId),
      fornecedor_ids: fornecedorIds
    }));

    // 🔍 DEBUG - VER O QUE ESTÁ SENDO ENVIADO
    console.log('📋 selecionesFornecedor (estado):', selecionesFornecedor);
    console.log('📦 itensPayload (o que vai enviar):', JSON.stringify(itensPayload, null, 2));
    
    // Também mostrar por item
    itensPayload.forEach(item => {
      console.log(`  Item ${item.item_id}: ${item.fornecedor_ids.length} fornecedor(es) - IDs: ${item.fornecedor_ids.join(', ')}`);
    });

    if (editandoId) {
      await atualizarCotacao(editandoId, itensPayload, "");
      alert("✅ Cotação atualizada!");
    } else {
      await salvarEEnviarCotacao(chamadoAutomatico.id, itensPayload, "");
      alert("✅ Cotação criada e enviada!");
    }

    await listarCotacoes();
    setModal(null);
    setEditandoId(null);
    setCotacaoEditando(null);
    setChamadoAutomatico(null);
    setAgrupado([]);
    setSelecionesFornecedor({});
  } catch (err) {
    console.error("❌ Erro ao enviar:", err);
    alert("Erro ao enviar: " + err.message);
  } finally {
    setEnviando(false);
  }
};

// ─── NOVO: BUSCAR STATUS DA COTAÇÃO E ABRIR MONITORAMENTO ────────────
const handleVisualizarRespostas = async (cotacaoId) => {
  setCarregandoStatus(true);
  try {
    console.log(`🔍 Buscando status da cotação ${cotacaoId}...`);
    
    const status = await cotacoesService.obterStatusCotacao(token, cotacaoId);
    
    console.log(`✅ Status carregado:`, status);
    setStatusCotacao(status);
    setTelaMonitorar(true);  // ← MUDE ISTO (era setTelaRespostas)
    
  } catch (err) {
    console.error("❌ Erro:", err);
    alert("Erro ao buscar status: " + err.message);
  } finally {
    setCarregandoStatus(false);
  }
};

// ─── CRIAR ORDEM DE VENDA ───────────────────────────
const handleCriarOrdenVenda = async (cotacaoId, fornecedorId) => {
  if (!window.confirm(`Deseja emitir a OV para este fornecedor?`)) {
    return;
  }

  setEnviando(true);
  try {
    console.log(`📦 Criando OV...`);
    
    const resultado = await cotacoesService.criarOrdenVenda(
      token,
      cotacaoId,
      fornecedorId
    );
    
    console.log(`✅ OV criada:`, resultado);
    
    await listarCotacoes();
    setTelaRespostas(false);
    setStatusCotacao(null);
    
    alert(`✅ Ordem de Venda ${resultado.numero} criada com sucesso!`);
    
  } catch (err) {
    console.error("❌ Erro:", err);
    alert("Erro ao criar OV: " + err.message);
  } finally {
    setEnviando(false);
  }
};

// Abrir para Edição ou Visualização
const handleAbrirCotacao = async (cotacao) => {
  if (cotacao.status === 'rascunho' || cotacao.status === 'pendente') {
    // ← MODO EDIÇÃO (rascunho/pendente)
    try {
      const data = await buscarDetalhesCotacao(cotacao.id);
      console.log('📦 Dados da cotação:', data);
      
      setCotacaoEditando(data);
      setEditandoId(cotacao.id);
      // ... resto do código igual ...
      
      setAbaAtiva('automatico');
      setModal('nova');
    } catch (err) {
      alert('Erro ao carregar cotação: ' + err.message);
    }
  } else if (cotacao.status === 'enviada' || cotacao.status === 'finalizada') {
    // ← MODO VISUALIZAÇÃO (enviada/finalizada) 
    console.log(`👁️ Visualizando cotação ${cotacao.id}`);
    
    // Abrir a tela de respostas direto!
    handleVisualizarRespostas(cotacao.id);
  } else {
    alert('Status desconhecido: ' + cotacao.status);
  }
};

  // Excluir Cotação
  const handleExcluir = async () => {
    if (!window.confirm('Tem certeza que deseja excluir esta cotação?')) return;
    try {
      await excluirCotacao(editandoId);
      alert('Cotação excluída com sucesso!');
      await listarCotacoes();
      setModal(null);
      setEditandoId(null);
      setCotacaoEditando(null);
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  // ─── FILTRO COTAÇÕES (seu código original) ─────────────────
  const cotacoesFiltered = cotacoesSeguro
  .filter((cotacao) => {
    if (filtro === "todos") {
      return true;
    }
    if (filtro === "em_curso") {
      return cotacao.status === "enviada";
    }
    if (filtro === "finalizado") {
      return cotacao.status === "finalizada";
    }
  })
  .filter((c) => {
    const chamado = chamadosSeguro.find((ch) => Number(ch.id) === Number(c.chamadoId));
    return (
      !busca ||
      (chamado?.peca && chamado.peca.toLowerCase().includes(busca.toLowerCase())) ||
      (chamado?.codigo && chamado.codigo.toLowerCase().includes(busca.toLowerCase()))
    );
  });

  // ─── RENDER: MODAL NOVA COTAÇÃO ─────────────────────────────
  if (modal === "nova") {
    const chamadosSemCotacao = chamadosSeguro.filter(
      (ch) => !cotacoesSeguro.some((c) => 
        c.chamadoId === ch.id && 
        (c.status === 'rascunho' || c.status === 'pendente' || c.status === 'enviada')
      )
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
                🤖 Agrupamento Automático
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
                            {forn.contatos?.[0]?.email || forn.email || "Sem email"}
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
                      const id = parseInt(e.target.value);
                      if (id && !editandoId) {
                        handleCarregarChamadoAutomatico(id);
                      }
                    }}
                    value={chamadoAutomatico?.id || ""}
                    disabled={!!editandoId}
                  >
                    <option value="">Selecione um chamado</option>
                    {chamadosSemCotacao.map((ch) => {
                      const primeiroItem =
                        ch.itens?.[0]?.item_nome || ch.peca || "Sem item";
                      return (
                        <option key={ch.id} value={ch.id}>
                          {ch.numero} - {primeiroItem} ({ch.itens?.length || 0} itens)
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
                                {item.nome} (Qtd: {item.quantidade})
                              </div>

                              {/* FORNECEDORES RECOMENDADOS + MANUAIS (COM VALOR) */}
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 6,
                                }}
                              >
                              {(() => {
                              // 1. Fornecedores recomendados do backend
                              const recomendados = item.fornecedores || [];
                              
                              // 2. IDs dos fornecedores selecionados manualmente
                              const idsSelecionadosManualmente = (selecionesFornecedor[item.id] || []).filter(
                                (id) => !recomendados.some((f) => f.fornecedor_id === id)
                              );
                              
                              // 3. Buscar objetos completos dos fornecedores manuais
                              const manuais = idsSelecionadosManualmente
                                .map((id) => {
                                  const f = fornecedoresSeguro.find((forn) => forn.id === id);
                                  return f
                                    ? { fornecedor_id: f.id, nome: f.nome, preco: f.preco || 0 }
                                    : null;
                                })
                                .filter(Boolean);

                              // 4. ✅ MOSTRAR TODOS (recomendados + manuais)
                              const todosFornecedores = [...recomendados, ...manuais];

                              if (todosFornecedores.length === 0) {
                                return (
                                  <span style={{ fontSize: 11, color: C.muted, fontStyle: "italic" }}>
                                    Nenhum fornecedor encontrado
                                  </span>
                                );
                              }

                              // 5. ✅ RENDERIZAR TODOS, mas com visual diferente se selecionado
                              return todosFornecedores.map((forn) => (
                                <label
                                  key={forn.fornecedor_id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    fontSize: 11,
                                    padding: "4px 8px",
                                    background: selecionesFornecedor[item.id]?.includes(forn.fornecedor_id)
                                      ? C.accent + "22"  // ✅ Destacado se selecionado
                                      : "#ffffff05",      // Discreto se não
                                    border: selecionesFornecedor[item.id]?.includes(forn.fornecedor_id)
                                      ? `1px solid ${C.accent}`
                                      : `1px solid ${C.border}33`,
                                    borderRadius: 4,
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={
                                      selecionesFornecedor[item.id]?.includes(forn.fornecedor_id) || false
                                    }
                                    onChange={() => toggleFornecedorAutomatico(item.id, forn.fornecedor_id)}
                                    style={{ cursor: "pointer", width: 14, height: 14 }}
                                  />
                                  <span>{forn.nome} - {fmtBRL(forn.preco || 0)}</span>
                                  {!recomendados.some((f) => f.fornecedor_id === forn.fornecedor_id) && (
                                    <span
                                      style={{
                                        fontSize: 8,
                                        background: C.warn + "33",
                                        color: C.warn,
                                        padding: "1px 4px",
                                        borderRadius: 2,
                                      }}
                                    >
                                      manual
                                    </span>
                                  )}
                                </label>
                              ));
                            })()}
                              </div>

                              {/* BOTÃO ADICIONAR FORNECEDOR MANUALMENTE */}
                              <div style={{ marginTop: 6 }}>
                                <button
                                  onClick={() =>
                                    setAdicionandoFornecedorPara(
                                      adicionandoFornecedorPara === item.id ? null : item.id
                                    )
                                  }
                                  style={{
                                    background: adicionandoFornecedorPara === item.id ? C.accent + "22" : "transparent",
                                    border: adicionandoFornecedorPara === item.id 
                                      ? `1px solid ${C.accent}` 
                                      : `1px dashed ${C.border}`,
                                    borderRadius: 4,
                                    padding: "4px 8px",
                                    fontSize: 10,
                                    color: adicionandoFornecedorPara === item.id ? C.accent : C.muted,
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                  }}
                                >
                                  {adicionandoFornecedorPara === item.id ? "✕ Fechar" : "➕ Adicionar fornecedor"}
                                </button>

                                {/* SELETOR COM AUTOCOMPLETE */}
                                {adicionandoFornecedorPara === item.id && (
                                  <div style={{ marginTop: 6 }}>
                                    <input
                                      type="text"
                                      placeholder="Digite o nome do fornecedor..."
                                      value={buscaFornecedor[item.id] || ""}
                                      onChange={(e) =>
                                        setBuscaFornecedor((prev) => ({
                                          ...prev,
                                          [item.id]: e.target.value,
                                        }))
                                      }
                                      style={{
                                        ...s.input,
                                        width: "100%",
                                        fontSize: 11,
                                        padding: "6px 10px",
                                      }}
                                      autoFocus
                                    />

                                    {/* LISTA DE SUGESTÕES */}
                                    {buscaFornecedor[item.id] &&
                                      buscaFornecedor[item.id].trim().length > 0 && (
                                        <div
                                          style={{
                                            marginTop: 4,
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 4,
                                            maxHeight: 150,
                                            overflowY: "auto",
                                            border: `1px solid ${C.border}`,
                                            borderRadius: 4,
                                            background: C.surface,
                                            padding: 4,
                                          }}
                                        >
                                          {fornecedoresSeguro
                                            .filter((f) => f.ativo)
                                            .filter((f) => !selecionesFornecedor[item.id]?.includes(f.id))
                                            .filter((f) =>
                                              f.nome
                                                .toLowerCase()
                                                .includes(buscaFornecedor[item.id].toLowerCase())
                                            )
                                            .map((forn) => (
                                              <button
                                                key={forn.id}
                                                onClick={() => {
                                                  setSelecionesFornecedor((prev) => ({
                                                    ...prev,
                                                    [item.id]: [...(prev[item.id] || []), forn.id],
                                                  }));
                                                  setAdicionandoFornecedorPara(null);
                                                  setBuscaFornecedor((prev) => ({
                                                    ...prev,
                                                    [item.id]: "",
                                                  }));
                                                }}
                                                style={{
                                                  background: "transparent",
                                                  border: "none",
                                                  padding: "6px 8px",
                                                  textAlign: "left",
                                                  fontSize: 11,
                                                  color: C.text,
                                                  cursor: "pointer",
                                                  borderRadius: 4,
                                                  transition: "all 0.2s",
                                                  display: "flex",
                                                  justifyContent: "space-between",
                                                  alignItems: "center",
                                                }}
                                                onMouseEnter={(e) => {
                                                  e.currentTarget.style.background = C.accent + "22";
                                                }}
                                                onMouseLeave={(e) => {
                                                  e.currentTarget.style.background = "transparent";
                                                }}
                                              >
                                                <span>{forn.nome}</span>
                                                {forn.preco && (
                                                  <span style={{ fontSize: 10, color: C.muted }}>
                                                    {fmtBRL(forn.preco)}
                                                  </span>
                                                )}
                                              </button>
                                            ))}
                                          {fornecedoresSeguro.filter(
                                            (f) =>
                                              f.ativo &&
                                              !selecionesFornecedor[item.id]?.includes(f.id) &&
                                              f.nome
                                                .toLowerCase()
                                                .includes(buscaFornecedor[item.id].toLowerCase())
                                          ).length === 0 && (
                                            <div
                                              style={{
                                                padding: "6px 8px",
                                                fontSize: 11,
                                                color: C.muted,
                                                fontStyle: "italic",
                                              }}
                                            >
                                              Nenhum fornecedor disponível
                                            </div>
                                          )}
                                        </div>
                                      )}
                                  </div>
                                )}
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
                setEditandoId(null);
              }}
              style={{
                ...s.btn(false, C.muted),
                padding: "8px 16px",
                fontSize: 12,
              }}
            >
              Cancelar
            </button>

            {editandoId && (
              <button
                onClick={handleExcluir}
                style={{
                  ...s.btn(false, '#ef4444'),
                  padding: "8px 16px",
                  fontSize: 12,
                  marginRight: "auto",
                }}
              >
                🗑️ Excluir
              </button>
            )}

            {abaAtiva === "automatico" && (
              <>
                <button
                  onClick={handleSalvarAutomatico}
                  disabled={enviando || !chamadoAutomatico}
                  style={{
                    ...s.btn(false, C.accent),
                    padding: "8px 16px",
                    fontSize: 12,
                    opacity: enviando || !chamadoAutomatico ? 0.5 : 1,
                  }}
                >
                  {enviando ? "Salvando..." : "💾 Salvar Rascunho"}
                </button>
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
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── NOVO: TELA DE RESPOSTAS ───────────────────────────────
  if (telaRespostas && statusCotacao) {
    return (
      <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>
              RESPOSTAS RECEBIDAS
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>
              Cotação {statusCotacao.cotacao.numero || `#${statusCotacao.cotacao.id}`}
            </div>
          </div>
          <button
            onClick={() => {
              setTelaRespostas(false);
              setStatusCotacao(null);
            }}
            style={{
              ...s.btn(false, C.muted),
              padding: "10px 16px",
              fontSize: 12,
            }}
          >
            ← Voltar
          </button>
        </div>

        {/* Resumo */}
        <div style={{
          ...s.card,
          padding: "16px 18px",
          marginBottom: 20,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12
        }}>
          <div>
            <div style={{ fontSize: 10, color: C.muted }}>TOTAL FORNECEDORES</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginTop: 4 }}>
              {statusCotacao.fornecedores.total}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.muted }}>✅ RESPONDIDOS</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.success, marginTop: 4 }}>
              {statusCotacao.fornecedores.respondidos}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.muted }}>⏳ PENDENTES</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.warn, marginTop: 4 }}>
              {statusCotacao.fornecedores.pendentes}
            </div>
          </div>
        </div>

        {/* Melhor proposta destaque */}
        {statusCotacao.melhorProposta && (
          <div style={{
            ...s.card,
            padding: "16px 18px",
            marginBottom: 20,
            borderLeft: `4px solid ${C.success}`
          }}>
            <div style={{ fontSize: 12, color: C.success, fontWeight: 600, marginBottom: 8 }}>
              🏆 MELHOR PROPOSTA
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
              {statusCotacao.melhorProposta.fornecedor_nome}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
              {fmtBRL(statusCotacao.melhorProposta.valor)} | Prazo: {statusCotacao.melhorProposta.prazo} dias
            </div>
          </div>
        )}

        {/* Lista de respostas */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 12 }}>
            TODAS AS PROPOSTAS
          </div>
          {statusCotacao.fornecedores.respostas.map((forn) => (
            <div
              key={forn.id}
              style={{
                ...s.card,
                padding: "12px 16px",
                marginBottom: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                opacity: forn.status === 'respondido' ? 1 : 0.5
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                  {forn.fornecedor_nome}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                  {forn.status === 'respondido' ? (
                    <>
                      {fmtBRL(forn.valor)} • Prazo: {forn.prazo} dias
                    </>
                  ) : (
                    <>
                      ⏳ Aguardando resposta...
                    </>
                  )}
                </div>
              </div>
              {forn.status === 'respondido' && !statusCotacao.ordemVenda && (
                <button
                  onClick={() => handleCriarOrdenVenda(statusCotacao.cotacao.id, forn.fornecedor_id)}
                  disabled={enviando}
                  style={{
                    ...s.btn(true, C.success),
                    padding: "6px 12px",
                    fontSize: 11,
                    opacity: enviando ? 0.5 : 1
                  }}
                >
                  {enviando ? "..." : "📋 Emitir OV"}
                </button>
              )}
              {statusCotacao.ordemVenda && (
                <div style={{ fontSize: 11, color: C.success, fontWeight: 600 }}>
                  ✅ OV Emitida
                </div>
              )}
            </div>
          ))}
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
            onClick={() => handleAbrirNovaJanelaModal("automatico")}
            style={{
              ...s.btn(true, C.accent),
              padding: "10px 16px",
              fontSize: 12,
            }}
          >
            📝 Nova Cotação (Automática)
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
          {["todos", "rascunho", "em_curso", "finalizado"].map((status) => {
            // Calcula contagem apenas para rascunho e em_curso
            let label = status === "todos"
              ? "Todas"
              : status === "rascunho"
              ? "Rascunho"
              : status === "em_curso"
              ? "Em Curso"
              : "Finalizadas";

            // Adiciona contagem para rascunho e em_curso
            if (status === "rascunho") {
              const count = cotacoesSeguro.filter(c => c.status === 'rascunho').length;
              label += ` (${count})`;
            } else if (status === "em_curso") {
              const count = cotacoesSeguro.filter(c => 
                c.status === 'pendente' || c.status === 'enviada' || c.status === 'em_curso'
              ).length;
              label += ` (${count})`;
            }

            return (
              <button
                key={status}
                onClick={() => setFiltro(status)}
                style={{
                  ...s.btn(filtro === status, C.accent),
                  padding: "8px 14px",
                  fontSize: 11,
                }}
              >
                {label}
              </button>
            );
          })}
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
            // Converte para número explicitamente
            const chamado = chamadosSeguro.find((ch) => String(ch.id) === String(cotacao.chamado_id));

            // Fallback: se não encontrar, usa o ID da cotação
            const numeroChamado = chamado?.numero || `Chamado ${cotacao.chamado_id}`;
            const descricaoChamado = chamado?.descricao || chamado?.peca || "Chamado sem descrição";

            // ─── NOVO: TELA DE VISUALIZAÇÃO DE RESPOSTAS ───────────────
            if (telaRespostas && statusCotacao) {
              return (
                <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>
                        RESPOSTAS RECEBIDAS
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>
                        Cotação {statusCotacao.cotacao.numero}
                      </div>
                    </div>
                    <button
                      onClick={() => setTelaRespostas(false)}
                      style={{
                        ...s.btn(false, C.muted),
                        padding: "10px 16px",
                        fontSize: 12,
                      }}
                    >
                      ← Voltar
                    </button>
                  </div>

                  {/* Resumo */}
                  <div style={{
                    ...s.card,
                    padding: "16px 18px",
                    marginBottom: 20,
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 12
                  }}>
                    <div>
                      <div style={{ fontSize: 10, color: C.muted }}>TOTAL FORNECEDORES</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginTop: 4 }}>
                        {statusCotacao.fornecedores.total}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: C.muted }}>✅ RESPONDIDOS</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: C.success, marginTop: 4 }}>
                        {statusCotacao.fornecedores.respondidos}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: C.muted }}>⏳ PENDENTES</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: C.warn, marginTop: 4 }}>
                        {statusCotacao.fornecedores.pendentes}
                      </div>
                    </div>
                  </div>

                  {/* Melhor proposta destaque */}
                  {statusCotacao.melhorProposta && (
                    <div style={{
                      ...s.card,
                      padding: "16px 18px",
                      marginBottom: 20,
                      borderLeft: `4px solid ${C.success}`
                    }}>
                      <div style={{ fontSize: 12, color: C.success, fontWeight: 600, marginBottom: 8 }}>
                        🏆 MELHOR PROPOSTA
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                        {statusCotacao.melhorProposta.fornecedor_nome}
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                        R$ {statusCotacao.melhorProposta.valor?.toFixed(2)} | Prazo: {statusCotacao.melhorProposta.prazo} dias
                      </div>
                    </div>
                  )}

                  {/* Lista de respostas */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 12 }}>
                      TODAS AS PROPOSTAS
                    </div>
                    {statusCotacao.fornecedores.respostas.map((forn) => (
                      <div
                        key={forn.id}
                        style={{
                          ...s.card,
                          padding: "12px 16px",
                          marginBottom: 8,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          opacity: forn.status === 'respondido' ? 1 : 0.5
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                            {forn.fornecedor_nome}
                          </div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                            {forn.status === 'respondido' ? (
                              <>
                                R$ {forn.valor?.toFixed(2)} • Prazo: {forn.prazo} dias
                              </>
                            ) : (
                              <>
                                ⏳ Aguardando resposta...
                              </>
                            )}
                          </div>
                        </div>
                        {forn.status === 'respondido' && !statusCotacao.ordemVenda && (
                          <button
                            onClick={() => handleCriarOrdenVenda(statusCotacao.cotacao.id, forn.fornecedor_id)}
                            disabled={enviando}
                            style={{
                              ...s.btn(true, C.success),
                              padding: "6px 12px",
                              fontSize: 11,
                              opacity: enviando ? 0.5 : 1
                            }}
                          >
                            {enviando ? "..." : "📋 Emitir OV"}
                          </button>
                        )}
                        {statusCotacao.ordemVenda && (
                          <div style={{ fontSize: 11, color: C.success, fontWeight: 600 }}>
                            ✅ OV Emitida
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (telaMonitorar && statusCotacao) {
              return (
                <TelaMonitorarRespostas
                  cotacaoId={statusCotacao.cotacao.id}
                  token={token}
                  fmtBRL={fmtBRL}
                  C={C}
                  s={s}
                  onVoltar={() => {
                    setTelaMonitorar(false);
                    setStatusCotacao(null);
                    listarCotacoes();
                  }}
                  onCriarOrdenVenda={handleCriarOrdenVenda}
                />
              );
            }

            return (
              <div
                key={cotacao.id}
                onClick={() => handleAbrirCotacao(cotacao)}
                style={{ ...s.card, padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.2s" }}
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
                    {numeroChamado}
                  </div>
                  <div style={{ fontSize: 12, color: C.text, marginTop: 4 }}>
                    {descricaoChamado}
                    {chamado?.itens && ` (${chamado.itens.length} itens)`}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                    Cotação: {cotacao.numero || `#${cotacao.id}`} • {fmtD(cotacao.enviado_em)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: C.muted }}>STATUS</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 
                        cotacao.status === "rascunho" ? C.muted :
                        cotacao.status === "pendente" ? C.warn :
                        cotacao.status === "enviada" ? C.accent :
                        cotacao.status === "finalizado" ? C.success :
                        C.muted
                      }}>
                        {cotacao.status === "rascunho" ? "Rascunho" :
                        cotacao.status === "pendente" ? "Pendente" :
                        cotacao.status === "enviada" ? "Enviada" :
                        cotacao.status === "finalizado" ? "Finalizado" :
                        cotacao.status}
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
