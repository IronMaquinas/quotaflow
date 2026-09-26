// components/cotacoes/TelaCotacoesNovaComAbas.jsx

import { useState, useEffect, useCallback } from "react";
import apiService from "../../services/apiService";
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
  const { chamados, setChamados, carregar: carregarChamados } = useChamados();
  const { enviarCotacao } = useEmail();

  const cotacoesSeguro = cotacoes || [];
  const fornecedoresSeguro = fornecedores || [];
  const chamadosSeguro = chamados || [];

  // ─── ESTADO EXISTENTE (mantém tudo como antes) ─────────────
  const [telaAtual, setTelaAtual] = useState("lista");
  const [cotacaoSel, setCotacaoSel] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  // #4d — Filtro rápido por status_geral (aguardando | coletando |
  // revalidar | pronta | saturada). Separado do `filtro` tradicional
  // (rascunho / em_curso / etc) — os dois se combinam.
  const [filtroRapido, setFiltroRapido] = useState("todos");
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [aprovando, setAprovando] = useState(false);
  const [telaMonitorar, setTelaMonitorar] = useState(false);
  const [origem, setOrigem] = useState("");

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
  const [statusCotacao, setStatusCotacao] = useState(null);
  const [carregandoStatus, setCarregandoStatus] = useState(false);

  const [adicionandoFornecedorPara, setAdicionandoFornecedorPara] = useState(null);
  const [buscaFornecedorManual, setBuscaFornecedorManual] = useState("");
  const [buscaFornecedor, setBuscaFornecedor] = useState({});
  const [editandoId, setEditandoId] = useState(null);
  const [cotacaoEditando, setCotacaoEditando] = useState(null);

  // ─── Fase D: busca OS e RM juntos ───────────────────────────
  // GET /cotacoes/chamados só filtra por UM tipo_documento por vez (padrão
  // 'os'). Esta tela precisa dos dois ao mesmo tempo: RM pra alimentar o
  // dropdown de nova cotação (a partir de agora, só RM pode virar RC — a
  // OS primeiro precisa virar RM na tela "Gerar Requisição de Material"),
  // e OS pra continuar resolvendo corretamente o número/descrição de
  // cotações que já existem hoje, criadas direto contra o chamado_id de
  // uma OS (antes de existir essa separação OS/RM). Sem buscar os dois,
  // toda cotação antiga cairia no fallback "Chamado {id}" só porque o
  // chamado de origem dela deixou de aparecer na lista.
  const carregarChamadosParaCotacao = useCallback(async () => {
    try {
      const [osList, rmList] = await Promise.all([
        apiService.get("/cotacoes/chamados?tipo_documento=os"),
        apiService.get("/cotacoes/chamados?tipo_documento=requisicao_material"),
      ]);
      setChamados([...(osList || []), ...(rmList || [])]);
    } catch (err) {
      console.error("❌ Erro ao carregar chamados/RM:", err);
      setChamados([]);
    }
  }, [setChamados]);

  // Carregar cotações ao montar
useEffect(() => {
  listarCotacoes();
  carregarChamadosParaCotacao();
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
        origem_ov_numero: origem || null
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
      // 🔥 LIMPE O CAMPO DE ORIGEM:
      setOrigem("");
      alert("Cotação criada e enviada com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao criar cotação: " + e.message);
    } finally {
      setEnviando(false);
    }
  };

  // ─── APERTAR BOTÃO NOVA COTAÇÃO ────────────────────────────
  const handleAbrirNovaJanelaModal = async (tipoAba) => {
    await carregarChamadosParaCotacao();
    await listarCotacoes();

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
      
      const resultado = await buscarChamadoComItens(chamadoId);
      
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
      const itensPayload = Object.entries(selecionesFornecedor).map(([itemId, fornecedorIds]) => ({
        item_id: parseInt(itemId),
        fornecedor_ids: fornecedorIds
      }));

      if (editandoId) {
        await atualizarCotacao(editandoId, itensPayload, "");
        alert("Cotação atualizada com sucesso!");
      } else {
        // 🔥 ADICIONE O CAMPO DE ORIGEM:
        await salvarCotacao(chamadoAutomatico.id, itensPayload, "", origem || null);
        alert("Rascunho salvo com sucesso!");
      }

      await listarCotacoes();
      setModal(null);
      setEditandoId(null);
      setCotacaoEditando(null);
      setChamadoAutomatico(null);
      setAgrupado([]);
      setSelecionesFornecedor({});
      // 🔥 LIMPE O CAMPO DE ORIGEM:
      setOrigem("");
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

    // 🔥 Se estiver editando, apenas atualizar
    if (editandoId) {
      await atualizarCotacao(editandoId, itensPayload, "", origem || null);
      const cotacaoId = editandoId;
      
      // 🔥 ENVIAR A COTAÇÃO
      await cotacoesService.enviarCotacao(token, cotacaoId, origem || null);
      console.log("✅ Cotação enviada!");
    } else {
      // 🔥 Criar nova cotação e enviar
      const salva = await salvarCotacao(chamadoAutomatico.id, itensPayload, "", origem || null);
      const cotacaoId = salva.cotacao_id;
      
      await cotacoesService.enviarCotacao(token, cotacaoId, origem || null);
      console.log("✅ Cotação enviada!");
    }

    // Limpar estados
    await listarCotacoes();
    setModal(null);
    setEditandoId(null);
    setCotacaoEditando(null);
    setChamadoAutomatico(null);
    setAgrupado([]);
    setSelecionesFornecedor({});
    setOrigem("");
  } catch (err) {
    console.error("❌ Erro ao enviar:", err);
    alert("Erro ao enviar: " + err.message);
  } finally {
    setEnviando(false);
  }
};

// -- Status Label ---
const statusLabels = {
  'aguardando_cotacao': 'Aguardando Cotação',
  'cotando': 'Cotando',
  'finalizado': 'Finalizado',
  'aberto': 'Aberto',
  'rascunho': 'Rascunho',
  'enviada': 'Enviada',
  'respondida': 'Respondida',
  'cancelada': 'Cancelada',
};

// ─── NOVO: BUSCAR STATUS DA COTAÇÃO E ABRIR MONITORAMENTO ────────────
const handleVisualizarRespostas = async (cotacaoId) => {
  setCarregandoStatus(true);
  try {
    const status = await cotacoesService.obterStatusCotacao(token, cotacaoId);

    // Guard: se a cotação ainda não está pronta (ex: nova cotação
    // rascunho recém-criada pelo "Mover para nova RC"), não deixa
    // `telaMonitorar=true` com `statusCotacao=null` — quebra o render
    // em `statusCotacao.cotacao.id`.
    if (!status || !status.cotacao) {
      alert('Cotação não encontrada ou ainda não disponível. Recarregue a lista de Compras.');
      return;
    }

    setStatusCotacao(status);
    setTelaMonitorar(true);
  } catch (err) {
    console.error("❌ Erro:", err);
    alert("Erro ao buscar status: " + err.message);
  } finally {
    setCarregandoStatus(false);
  }
};

// ─── CRIAR ORDEM DE VENDA ───────────────────────────
const handleCriarOrdenVenda = async (cotacaoId, fornecedorId, dadosAdicionais = {}) => {
  if (!window.confirm(`Deseja emitir a OC para este fornecedor?`)) {
    return;
  }

  setEnviando(true);
  try {
    const resultado = await cotacoesService.criarOrdenVenda(
      token,
      cotacaoId,
      fornecedorId,
      dadosAdicionais
    );
    
    await listarCotacoes();
    setTelaMonitorar(false);
    setStatusCotacao(null);
    
    alert(`✅ Ordem de Compra ${resultado.numero} criada com sucesso!`);
  } catch (err) {
    alert("Erro ao criar OV: " + err.message);
  } finally {
    setEnviando(false);
  }
};

// Abrir para Edição ou Visualização
const handleAbrirCotacao = async (cotacao) => {
  if (cotacao.status === 'rascunho' || cotacao.status === 'pendente') {
    try {
      const data = await buscarDetalhesCotacao(cotacao.id);

      setOrigem(data.origem_ov_numero || '');
      
      // 🔥 CARREGAR OS ITENS DO CHAMADO
      const resultado = await buscarChamadoComItens(data.chamado_id);
      
      setChamadoAutomatico({
        id: data.chamado_id,
        numero: resultado.chamado.numero || '',
        itens: []
      });
      
      // ESTRUTURAR OS ITENS AGRUPADOS
      const categoriasAgrupadas = Object.entries(resultado.itensPorCategoria).map(
        ([categoria, itens]) => ({
          categoria,
          itens: itens.map(item => ({
            id: item.id,
            nome: item.nome,
            quantidade: item.quantidade,
            fornecedores: item.fornecedores || [],
            fornecedoresSelecionados: []
          }))
        })
      );
      
      setAgrupado(categoriasAgrupadas);
      setCotacaoEditando(data);
      setEditandoId(cotacao.id);
      setAbaAtiva('automatico');
      setModal('nova');
    } catch (err) {
      alert('Erro ao carregar cotação: ' + err.message);
    }
   } else if (cotacao.status === 'enviada' || cotacao.status === 'finalizada' || cotacao.status === 'respondida') {
    // ← MODO VISUALIZAÇÃO (enviada/finalizada/respondida) 
    console.log(`👁️ Visualizando cotação ${cotacao.id}`);
    
    // Abrir a tela de respostas direto!
    handleVisualizarRespostas(cotacao.id);
  } else if (cotacao.status === 'cancelada') {
    // Fase "Cancelar cotação": cotação cancelada não abre monitor nem
    // modal de edição — o histórico fica preservado mas o comprador
    // recotaria via "+ Nova Cotação" a partir da RC (que já foi
    // desbloqueada quando a cotação foi cancelada).
    alert(
      `Cotação ${cotacao.numero} foi cancelada.\n\n` +
      `A RC vinculada está desbloqueada. Use "+ Nova Cotação" para cotar novamente os itens.`
    );
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

  // ─── #4d — Config visual do status geral ──────────────────
  const STATUS_GERAL_CFG = {
    aguardando: { cor: '#94a3b8', label: '⚪ Aguardando' },
    coletando:  { cor: '#f59e0b', label: '🟡 Coletando' },
    revalidar:  { cor: '#ef4444', label: '🔴 Revalidar' },
    pronta:     { cor: '#22c55e', label: '🟢 Pronta p/ emitir' },
    saturada:   { cor: '#a855f7', label: '✨ Saturada' },
  };

  // Cotações "ativas" pra fins do agregado — rascunho/finalizada/
  // cancelada nunca entram nos filtros rápidos (não faz sentido
  // "pronta pra emitir" em cima de rascunho).
  const cotacoesAtivas = cotacoesSeguro.filter(
    (c) => !['rascunho', 'finalizada', 'finalizado', 'cancelada'].includes(c.status)
  );

  // Contagens dos chips de filtro rápido (só cotação ativa)
  const contagensRapidas = {
    prontas:   cotacoesAtivas.filter(c => c.status_geral === 'pronta').length,
    coletando: cotacoesAtivas.filter(c => c.status_geral === 'coletando').length,
    revalidar: cotacoesAtivas.filter(c => c.status_geral === 'revalidar').length,
    aguardando: cotacoesAtivas.filter(c => c.status_geral === 'aguardando').length,
    saturada:  cotacoesAtivas.filter(c => c.status_geral === 'saturada').length,
    // Aging: só conta a partir de 30d ("parada" mesmo, não "atenção")
    paradas:   cotacoesAtivas.filter(c => Number(c.dias_parada) >= 30).length,
  };

  // ─── FILTRO COTAÇÕES ──────────────────────────────────────
  const cotacoesFiltered = cotacoesSeguro
    .filter((c) => {
      // Filtro tradicional (rascunho / em_curso / finalizada / respondida)
      if (filtro === "todos") return true;
      if (filtro === "rascunho") return c.status === "rascunho";
      if (filtro === "em_curso") return c.status === "enviada" || c.status === "respondida";
      if (filtro === "respondida") return c.status === "respondida";
      if (filtro === "finalizado") return c.status === "finalizada";
      return false;
    })
    .filter((c) => {
      // #4d — Filtro rápido (status_geral / aging). Só se aplica em
      // cotação ativa; senão o filtro "pronta" mostraria rascunhos
      // que nem têm status_geral calculado.
      if (filtroRapido === "todos") return true;
      if (['rascunho', 'finalizada', 'finalizado', 'cancelada'].includes(c.status)) return false;
      // Filtro especial de aging
      if (filtroRapido === "paradas") return Number(c.dias_parada) >= 30;
      return c.status_geral === filtroRapido;
    })
    .filter((c) => {
      const chamado = chamadosSeguro.find((ch) => String(ch.id) === String(c.chamado_id));
      return (
        !busca ||
        (chamado?.peca && chamado.peca.toLowerCase().includes(busca.toLowerCase())) ||
        (chamado?.codigo && chamado.codigo.toLowerCase().includes(busca.toLowerCase()))
      );
    });

  // ─── RENDER: MODAL NOVA COTAÇÃO ─────────────────────────────
  if (modal === "nova") {
      const chamadosSemCotacao = chamados.filter((ch) => {
        // Se estiver editando (rascunho), traz o chamado vinculado
        if (editandoId && String(cotacaoEditando?.chamado_id) === String(ch.id)) return true;

        // Só RM pode virar cotação/RC (a OS precisa virar RM antes)
        if ((ch.tipo_documento || "os") !== "requisicao_material") return false;

        // Exclui chamados que já têm QUALQUER cotação ativa.
        // Cotação com status 'cancelada' não bloqueia nova tentativa.
        // (FIX 2026-09: o backend grava 'cancelada' — feminino. Antes o
        // filtro comparava com 'cancelado' e a comparação nunca batia,
        // deixando a RC cancelada fora da lista de Nova Cotação.)
        return !cotacoes.some((c) => 
          String(c.chamado_id) === String(ch.id) && c.status !== 'cancelada'
        );
      });

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
                          {ch.numero} - {ch.servico_nome || ch.descricao || ch.itens[0]?.item_nome || 'Sem descrição'} ({ch.itens?.length || 0} itens)
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
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  fontSize: 12,
                                  fontWeight: 500,
                                  color: C.text,
                                }}
                              >
                                {forn.nome}
                                {forn.tipo === "global" && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      background: "#22c55e",
                                      color: "#fff",
                                      padding: "1px 8px",
                                      borderRadius: 12,
                                      fontWeight: 600,
                                      letterSpacing: "0.04em",
                                    }}
                                    title="Fornecedor verificado pela plataforma"
                                  >
                                    🏅 Certificado
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 10, color: C.muted }}>
                                {forn.contatos?.[0]?.email || forn.email || "Sem email"}
                              </div>
                            </div>
                          </label>
                        ))}
                    {/* 🔥 CAMPO DE ORIGEM (MODO MANUAL) */}
                      <div style={{ marginBottom: 18 }}>
                        <label style={s.label}>ORIGEM (OPCIONAL)</label>
                        <input
                          value={origem}
                          onChange={(e) => setOrigem(e.target.value)}
                          placeholder="Ex: OS-2026-0001 ou Obra X"
                          style={s.input}
                        />
                      </div>
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
                      const primeiroItem = ch.itens && ch.itens.length > 0 ? ch.itens[0]?.item_nome : (ch.peca || "Sem item");
                      const equipamento = ch.equipamento || "Equipamento não definido";
                      return (
                        <option key={ch.id} value={ch.id}>
                          {ch.numero} - {ch.servico_nome || ch.descricao || ch.itens[0]?.item_nome || 'Sem descrição'} ({ch.itens?.length || 0} itens)
                        </option>
                      );
                    })}
                  </select>
                </div>
              {/* 🔥 CAMPO DE ORIGEM (MODO AUTOMÁTICO) */}
                <div style={{ marginBottom: 18 }}>
                  <label style={s.label}>ORIGEM (OPCIONAL)</label>
                  <input
                    value={origem}
                    onChange={(e) => setOrigem(e.target.value)}
                    placeholder="Ex: OS-2026-0001 ou Obra X"
                    style={s.input}
                  />
                </div>

                {/* SELECIONAR FILIAL
                <div style={{ marginBottom: 16 }}>
                  <label style={s.label}>FILIAL DE ENTREGA</label>
                  <select value={form.filial_id} onChange={(e) => setForm({ ...form, filial_id: e.target.value })} style={{ ...s.input, appearance: 'none' }}>
                    <option value="">— Matriz —</option>
                    {filiais.map(f => <option key={f.id} value={f.id}>{f.nome_filial} ({f.cnpj_filial})</option>)}
                  </select>
                </div>  */}

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
                              // Normaliza os dois formatos:
                              //   - recomendados (backend): { fornecedor_nome, preco_unitario }
                              //   - manuais (frontend):     { nome, preco }
                              // Sem isso, o render lia forn.preco (undefined) e exibia R$ 0,00.
                              const recomendadosNorm = recomendados.map(f => ({
                                fornecedor_id: f.fornecedor_id,
                                nome: f.fornecedor_nome || f.nome || "Fornecedor",
                                preco: parseFloat(f.preco_unitario || f.preco || 0),
                              }));
                              const manuaisNorm = manuais.map(f => ({
                                fornecedor_id: f.fornecedor_id,
                                nome: f.nome || "Fornecedor",
                                preco: parseFloat(f.preco || 0),
                              }));
                              const todosFornecedores = [...recomendadosNorm, ...manuaisNorm];

                              if (todosFornecedores.length === 0) {
                                return item.sem_catalogo ? (
                                  <div style={{
                                    fontSize: 11,
                                    color: "#f59e0b",
                                    background: "#f59e0b11",
                                    border: "1px solid #f59e0b33",
                                    borderRadius: 4,
                                    padding: "6px 10px",
                                    lineHeight: 1.4,
                                  }}>
                                    💡 <strong>Este item não está vinculado ao catálogo</strong> — não há como
                                    sugerir fornecedores automaticamente.
                                    <br />
                                    <span style={{ opacity: 0.8 }}>
                                      Selecione fornecedores manualmente abaixo. Para preenchimento
                                      automático nas próximas cotações, associe o item ao catálogo de
                                      um fornecedor cadastrado.
                                    </span>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 11, color: C.muted, fontStyle: "italic" }}>
                                    Nenhum fornecedor recomendado. Adicione fornecedores manualmente.
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
                                  {!recomendadosNorm.some((f) => f.fornecedor_id === forn.fornecedor_id) && (                                    <span
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

  // ─── TELA DE MONITORAMENTO DE RESPOSTAS ────────────────────
  // Early return: quando o usuário clica em "Ver Cotação", sai da
  // listagem e renderiza o monitoramento. É 1 renderização única,
  // fora do map (bug histórico: estava dentro do map e renderizava
  // N vezes, uma por cotação da lista).
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
          // Fase "Mover para nova RC": depois de mover, uma RC nova
          // apareceu no backend. Sem recarregar `chamados`, o card da
          // cotação nova renderiza com "-" no lugar do número da RC.
          carregarChamadosParaCotacao();
        }}
        onFinalizarOV={handleCriarOrdenVenda}
        onAbrirCotacao={(cotacaoIdAlvo) => {
          // Fase "Mover para nova RC": troca o monitor atual pelo da
          // cotação nova, reaproveitando a função que já existe.
          handleVisualizarRespostas(cotacaoIdAlvo);
        }}
      />
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
            📝 Nova Requisição de Compras
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
          {["todos", "rascunho", "em_curso", "finalizado", "respondida"].map((status) => {
              // Calcula contagem apenas para rascunho e em_curso
            let label = status === "todos"
              ? "Todas"
              : status === "rascunho"
              ? "Rascunho"
              : status === "em_curso"
              ? "Em Curso"
              : status === "finalizado"
              ? "Finalizadas"
              : "Respondidas";

            if (status === "rascunho") {
              const count = cotacoesSeguro.filter(c => c.status === 'rascunho').length;
              label += ` (${count})`;
            } else if (status === "em_curso") {
              const count = cotacoesSeguro.filter(c =>
                c.status === 'pendente' || c.status === 'enviada' || c.status === 'em_curso'
              ).length;
              label += ` (${count})`;
            } else if (status === "respondida") {
              const count = cotacoesSeguro.filter(c => c.status === 'respondida').length;
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

      {/* #4d — Filtros rápidos por status_geral (só cotação ativa) */}
      <div style={{
        display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap",
        alignItems: "center",
      }}>
        <span style={{
          fontSize: 10, color: C.muted, letterSpacing: "0.06em",
          fontWeight: 600, marginRight: 4,
        }}>
          RÁPIDO:
        </span>
        {[
          { id: "todos",     label: "Todas",           count: cotacoesAtivas.length, cor: C.muted },
          { id: "pronta",    label: "🟢 Prontas",      count: contagensRapidas.prontas, cor: '#22c55e' },
          { id: "coletando", label: "🟡 Coletando",    count: contagensRapidas.coletando, cor: '#f59e0b' },
          { id: "revalidar", label: "🔴 Revalidar",    count: contagensRapidas.revalidar, cor: '#ef4444' },
          { id: "aguardando",label: "⚪ Aguardando",   count: contagensRapidas.aguardando, cor: '#94a3b8' },
          { id: "saturada",  label: "✨ Saturadas",    count: contagensRapidas.saturada, cor: '#a855f7' },
          { id: "paradas",   label: "🕰 Paradas",      count: contagensRapidas.paradas, cor: '#fb923c' },
        ].map((chip) => {
          const ativo = filtroRapido === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => setFiltroRapido(chip.id)}
              disabled={chip.count === 0 && chip.id !== "todos"}
              style={{
                background: ativo ? `${chip.cor}22` : "transparent",
                border: `1px solid ${ativo ? chip.cor : C.border}`,
                borderRadius: 14,
                color: ativo ? chip.cor : (chip.count === 0 && chip.id !== "todos" ? C.muted : C.text),
                fontSize: 11,
                fontWeight: ativo ? 700 : 500,
                cursor: (chip.count === 0 && chip.id !== "todos") ? "not-allowed" : "pointer",
                padding: "5px 12px",
                fontFamily: "inherit",
                opacity: (chip.count === 0 && chip.id !== "todos") ? 0.4 : 1,
                transition: "all 0.15s",
              }}
            >
              {chip.label} ({chip.count})
            </button>
          );
        })}
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
            const numeroChamado = chamado?.numero || null;
            const descricaoChamado = chamado?.descricao || chamado?.peca || "Chamado sem descrição";

            return (
              (() => {
                // #4d — Agregado por cotação. Calculado no backend
                // (GET /cotacoes) — aqui só pinta.
                const temAgregado = cotacao.total_itens_ativos > 0 && cotacao.niveis;
                const sgCfg = STATUS_GERAL_CFG[cotacao.status_geral];
                const cotacaoAtiva = !['rascunho', 'finalizada', 'finalizado', 'cancelada'].includes(cotacao.status);

                // Cor da validade mais próxima (mesma regra do monitor)
                let corValidadeProx = C.muted;
                let labelValidadeProx = null;
                if (cotacao.proxima_validade) {
                  const em = new Date(cotacao.proxima_validade).getTime();
                  const dias = Math.ceil((em - Date.now()) / 86400000);
                  if (em <= Date.now()) { corValidadeProx = '#ef4444'; labelValidadeProx = 'vence hoje'; }
                  else if (dias <= 7)   { corValidadeProx = '#f59e0b'; labelValidadeProx = `${dias}d`; }
                  else                  { corValidadeProx = '#22c55e'; labelValidadeProx = `${dias}d`; }
                }

                // Polimento "🔄 Nª cotação" — quantas vezes esta mesma RC
                // já foi cotada (1 = original, 2+ = recotação). O número
                // da posição é derivado da ordem de criado_em; o comprador
                // vê de imediato que aquela não é a primeira rodada.
                const cotacoesDaMesmaRc = cotacoesSeguro
                  .filter(c => String(c.chamado_id) === String(cotacao.chamado_id))
                  .sort((a, b) => new Date(a.criado_em || 0) - new Date(b.criado_em || 0));
                const posicaoNaRc = cotacoesDaMesmaRc.findIndex(
                  c => String(c.id) === String(cotacao.id)
                ) + 1;
                const ehRecotacao = cotacoesDaMesmaRc.length > 1 && posicaoNaRc > 1;

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
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.accent,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}>
                        <span>
                          {numeroChamado ? numeroChamado : <span style={{ opacity: 0.4 }}>—</span>}
                        </span>
                        {ehRecotacao && (
                          <span
                            title={`Esta RC já teve ${cotacoesDaMesmaRc.length} cotações — esta é a ${posicaoNaRc}ª`}
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              color: "#a855f7",
                              background: "#a855f722",
                              border: "1px solid #a855f755",
                              borderRadius: 4,
                              padding: "1px 6px",
                              letterSpacing: "0.03em",
                              whiteSpace: "nowrap",
                            }}
                          >
                            🔄 {posicaoNaRc}ª cotação
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: C.text, marginTop: 4 }}>
                        {chamado?.servico_nome || chamado?.descricao || chamado?.itens?.[0]?.item_nome || 'Sem descrição'}
                      </div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                        Cotação: {cotacao.numero || `#${cotacao.id}`} • {fmtD(cotacao.enviado_em)}
                      </div>

                      {/* #4d — Níveis + validade + vencidas */}
                      {temAgregado && cotacaoAtiva && (
                        <div style={{
                          display: "flex", gap: 14, marginTop: 8,
                          fontSize: 10, flexWrap: "wrap", color: C.muted,
                          alignItems: "center",
                        }}>
                          <span>
                            📦 {cotacao.total_itens_ativos}{" "}
                            {cotacao.total_itens_ativos === 1 ? "item" : "itens"}
                          </span>
                          <span
                            title="Itens com pelo menos 1 resposta — piso pra emitir"
                            style={{
                              color: cotacao.niveis.nivel1.ok === cotacao.total_itens_ativos
                                ? '#22c55e' : C.muted,
                              fontWeight: 600,
                            }}
                          >
                            ✅ {cotacao.niveis.nivel1.ok}/{cotacao.total_itens_ativos} com 1+
                          </span>
                          <span
                            title="Itens com pelo menos 2 respostas — concorrência real"
                            style={{
                              color: cotacao.niveis.nivel2.ok === cotacao.total_itens_ativos
                                ? '#22c55e' : C.muted,
                              fontWeight: 600,
                            }}
                          >
                            ⚡ {cotacao.niveis.nivel2.ok}/{cotacao.total_itens_ativos} com 2+
                          </span>
                          <span
                            title="Itens com pelo menos 3 respostas — disputa ativa"
                            style={{
                              color: cotacao.niveis.nivel3.ok === cotacao.total_itens_ativos
                                ? '#22c55e' : C.muted,
                              fontWeight: 600,
                            }}
                          >
                            🔥 {cotacao.niveis.nivel3.ok}/{cotacao.total_itens_ativos} com 3+
                          </span>
                          {labelValidadeProx && (
                            <span style={{ color: corValidadeProx, fontWeight: 600 }}>
                              ⏱ {labelValidadeProx}
                            </span>
                          )}
                          {cotacao.n_vencidas > 0 && (
                            <span style={{ color: '#ef4444', fontWeight: 700 }}>
                              ⚠ {cotacao.n_vencidas} vencida{cotacao.n_vencidas > 1 ? 's' : ''}
                            </span>
                          )}
                          {/* Aging: há quanto tempo a cotação está parada.
                              Só aparece a partir de 15d pra não poluir com
                              cotação recém-criada. */}
                          {(() => {
                            const d = Number(cotacao.dias_parada);
                            if (!Number.isFinite(d) || d < 15) return null;
                            let cor = '#f59e0b', icone = '🕰';
                            if (d >= 90)      { cor = '#a855f7'; icone = '⛔'; }
                            else if (d >= 61) { cor = '#ef4444'; icone = '🕰'; }
                            else if (d >= 31) { cor = '#fb923c'; icone = '🕰'; }
                            return (
                              <span
                                title={`Cotação parada há ${d} dias desde o disparo`}
                                style={{ color: cor, fontWeight: 700 }}
                              >
                                {icone} {d}d
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: C.muted }}>STATUS</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color:
                            cotacao.status === "rascunho" ? C.muted :
                            cotacao.status === "pendente" ? C.warn :
                            cotacao.status === "enviada" ? C.accent :
                            cotacao.status === "finalizado" ? C.success :
                            cotacao.status === "respondida" ? C.success :
                            C.muted
                          }}>
                            {cotacao.status === "rascunho" ? "Rascunho" :
                            cotacao.status === "pendente" ? "Pendente" :
                            cotacao.status === "enviada" ? "Enviada" :
                            cotacao.status === "finalizado" ? "Finalizado" :
                            cotacao.status === "respondida" ? "Respondida" :
                            cotacao.status}
                        </div>
                        {/* #4d — Badge status_geral (só quando faz sentido) */}
                        {cotacaoAtiva && sgCfg && (
                          <div
                            title={`Nível 1: ${cotacao.niveis?.nivel1?.ok || 0}/${cotacao.total_itens_ativos || 0} · Nível 2: ${cotacao.niveis?.nivel2?.ok || 0}/${cotacao.total_itens_ativos || 0} · Nível 3: ${cotacao.niveis?.nivel3?.ok || 0}/${cotacao.total_itens_ativos || 0}`}
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              marginTop: 4,
                              color: sgCfg.cor,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {sgCfg.label}
                          </div>
                        )}
                      </div>
                      <div style={{ color: C.muted, fontSize: 16 }}>→</div>
                    </div>
                  </div>
                );
              })()
            );
          })}
        </div>
      )}
    </div>
  );
}
