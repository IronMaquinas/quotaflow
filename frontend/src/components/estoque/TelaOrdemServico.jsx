// frontend/src/components/estoque/TelaOrdemServico.jsx
//
// ─────────────────────────────────────────────────────────────────────────
// HISTÓRICO DESTE ARQUIVO (importante para quem for mexer depois)
// ─────────────────────────────────────────────────────────────────────────
// Este arquivo SUBSTITUIU integralmente a antiga TelaOrdemServico.jsx (o
// protótipo que falava com /estoque/ordem-servico e rotas manuais
// gerar-retirada/gerar-chamado). Aquele conteúdo foi descartado por
// decisão explícita do usuário — não sobrou nenhuma lógica dele aqui.
//
// O conteúdo REAL desta tela é uma cópia, com apenas renomeação de rótulos,
// da antiga TelaChamadosNova.jsx (que era o arquivo validado em produção).
// A tela de criar/editar "chamado" SEMPRE foi, na prática, uma tela de
// Ordem de Serviço (equipamento + materiais + serviços + apontamento de
// horas) — só o nome do arquivo/componente não refletia isso. Este refactor
// corrige a nomenclatura sem tocar na lógica de negócio nem na API usada.
//
// A API continua sendo a REAL: /cotacoes/chamados via useChamados/useEquipamentos.
// NÃO trocar para a API antiga do protótipo (/estoque/ordem-servico) — aquilo
// está morto e não deve ser reintroduzido.
//
// O que MUDOU de fato em relação à TelaChamadosNova.jsx original:
//   1. Nome do componente exportado: TelaOrdemServico (mesma assinatura de
//      props: { fmtBRL, fmtD, C, s }).
//   2. Todos os rótulos visíveis passaram a dizer "Ordem de Serviço" / "OS"
//      de forma consistente (a versão antiga já usava isso na maior parte,
//      mas havia inconsistências pontuais — revisado linha a linha).
//   3. Na tela de detalhe, foi adicionada uma seção simples mostrando a(s)
//      RC(s)/RM(s) que esta OS gerou automaticamente (ver seção "RC/RM
//      VINCULADAS" mais abaixo) — o backend já devolve esse vínculo via
//      `item.requisicao_material` em cada item de material, e o payload de
//      criação pode trazer `requisicao_compra`/`requisicao_material` no
//      topo da resposta.
//   4. A escolha de tela de listagem principal ("+ Nova RC" vs "+ Nova OS")
//      agora vive em TelaChamadosNova.jsx (que virou a tela de RC manual) —
//      esta tela (OS) é quem mantém toda a complexidade original.
//
// O QUE **NÃO** MUDOU (mantido 100% igual em comportamento):
//   - useChamados / useEquipamentos / useEstoque local
//   - numeração automática (numero_base / posicao / sufixo x.y)
//   - modelo unificado de item (discriminado por `tipo`: material | servico)
//   - apontamento de horas (pessoas x duração -> horas-homem)
//   - consulta/reserva de saldo de estoque
//   - autocomplete de equipamento e de item via /catalogo/buscar-item
// ─────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useChamados } from "../../hooks/useChamados";
import { useEquipamentos } from "../../hooks/useEquipamentos";
import apiService from "../../services/apiService";
import BarcodeScannerInput from "../common/BarcodeScannerInput";

// ── Helpers, constantes e hooks extraídos (Rodada 1 da quebra) ──
import {
  aplicacaoCfg,
  estoqueCfg,
  urgenciaCfgMap,
  categoriaCfgMap,
  derivarStatusAplicacao,
  calcularStatusPrazo,
  novoMaterial,
  novoServico,
  calcularHorasHomem,
  computarNumeracao,
  numerarRascunho,
  calcularJanelaAutomatica,
  janelaValida,
  paraDatetimeLocal,
  paraISOComOffset,
} from "./helpers";
import { useEstoque, useMaterialAplicacoes } from "./hooks";
import ModalAplicarMaterial from "./modais/ModalAplicarMaterial";
import ModalCancelamento from "./modais/ModalCancelamento";
import ModalReversao from "./modais/ModalReversao";
import ModalConclusao from "./modais/ModalConclusao";
import ModalSalvarTemplate from "./modais/ModalSalvarTemplate";
import ModalCarregarTemplate from "./modais/ModalCarregarTemplate";
import ModalApontamento from "./modais/ModalApontamento";

export default function TelaOrdemServico({ fmtBRL, fmtD, C, s }) {
  const { chamados, loading, erro, carregar, criar, atualizar, deletar } = useChamados();
  const { equipamentos } = useEquipamentos();
  const { consultarSaldo, consultando, reservar } = useEstoque();

  const [telaAtual, setTelaAtual] = useState("lista");
  const [chamadoSel, setChamadoSel] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroUrgencia, setFiltroUrgencia] = useState("todos");
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);
  const [processando, setProcessando] = useState(false);

  const [eqSearch, setEqSearch] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const eqRef = useRef(null);

  const [itemSugestoes, setItemSugestoes] = useState({});
  const [showSugestoes, setShowSugestoes] = useState({});
  const [buscandoSugestoes, setBuscandoSugestoes] = useState({});
  // debounce + guard de resposta fora de ordem: por item (chave = itemId),
  // guarda o timer pendente e um contador de "última busca disparada" — se
  // a resposta que chega não é da busca mais recente, é descartada.
  const buscaItemRef = useRef({});

  const formVazio = () => ({
    equipamentoId: "",
    descricaoGeral: "",
    servico_nome: "",
    urgencia: "media",
    categoria: "corretiva",
    itens: [],
    dataInicioPrevista: "",
    dataFimPrevista: "",
    modoProgramacao: null,
  });
  const [form, setForm] = useState(formVazio());

  const [modalApontamento, setModalApontamento] = useState(null);
  const [modalConclusao, setModalConclusao] = useState(null);
  const [modalCancelamento, setModalCancelamento] = useState(null);

  // ── Templates de OS (Modelos de Manutenção) — Fase 1: privados do tenant ──
  const [modalSalvarTemplate, setModalSalvarTemplate] = useState(null);
  const [modalCarregarTemplate, setModalCarregarTemplate] = useState(false);
  const [templatesDisponiveis, setTemplatesDisponiveis] = useState([]);
  const [carregandoTemplates, setCarregandoTemplates] = useState(false);

  // Busca + preview no modal de carregar template
  const [buscaTemplate, setBuscaTemplate] = useState("");
  const [templateSelecionado, setTemplateSelecionado] = useState(null);
  const [carregandoItensTemplate, setCarregandoItensTemplate] = useState(false);
  // Quais itens do template estão marcados para carregar.
  // Chave = id do item (ou `idx_${i}` se não tiver id). Valor = boolean.
  const [itensSelecionadosTemplate, setItensSelecionadosTemplate] = useState({});

  // Aba ativa no modal: "meus" (privados do tenant) | "globais" (biblioteca SaaS)
  const [abaTemplate, setAbaTemplate] = useState("meus");

  // Busca e filtros do banco global (server-side)
  const [buscaGlobal, setBuscaGlobal] = useState("");
  const [filtroTipoEquip, setFiltroTipoEquip] = useState("");
  const [filtroMarca, setFiltroMarca] = useState("");
  const [templatesGlobais, setTemplatesGlobais] = useState([]);
  const [carregandoGlobais, setCarregandoGlobais] = useState(false);
  const [filtrosGlobaisDisponiveis, setFiltrosGlobaisDisponiveis] = useState({
    tipos_equipamento: [],
    marcas: [],
  });

  // Ref do timer de debounce da busca global (evita chamada por tecla)
  const buscaGlobalTimerRef = useRef(null);

  // ── Estados da aplicação de material (MIGO-like) ──
  const { aplicar, reverter, listarHistorico, salvando: salvandoAplicacao } = useMaterialAplicacoes();
  const [modalAplicacao, setModalAplicacao] = useState(null);
  const [modalReversao, setModalReversao] = useState(null);
  const [historicoPorItem, setHistoricoPorItem] = useState({});
  const [expandidoHistorico, setExpandidoHistorico] = useState({});  

  const [pendingFocusId, setPendingFocusId] = useState(null);

    // ── Percentual de conclusão + timeline de eventos da OS ──
  const [percentualConclusao, setPercentualConclusao] = useState(0);
  const [eventosOS, setEventosOS] = useState([]);
  const [carregandoEventos, setCarregandoEventos] = useState(false);

  const carregarPercentual = useCallback(async (chamadoId) => {
    try {
      const r = await apiService.get(`/cotacoes/chamados/${chamadoId}/percentual`);
      setPercentualConclusao(r?.percentual || 0);
    } catch (e) {
      setPercentualConclusao(0);
    }
  }, []);

  const carregarEventos = useCallback(async (chamadoId) => {
    setCarregandoEventos(true);
    try {
      const lista = await apiService.get(`/cotacoes/chamados/${chamadoId}/eventos`);
      setEventosOS(Array.isArray(lista) ? lista : []);
    } catch (e) {
      setEventosOS([]);
    } finally {
      setCarregandoEventos(false);
    }
  }, []);

  useEffect(() => { carregar(); }, []);

    // Carrega dados consolidados quando uma OS é selecionada (tela de detalhe):
  //  - percentual de conclusão
  //  - timeline de eventos
  //  - histórico de aplicações de cada material (pro contador do botão
  //    "Histórico (N)" já abrir certo, sem precisar clicar primeiro)
  useEffect(() => {
    if (!chamadoSel?.id) return;

    carregarPercentual(chamadoSel.id);
    carregarEventos(chamadoSel.id);

    const materiais = (chamadoSel.itens || []).filter(it =>
      it.tipo === "material" && it.status !== "cancelado"
    );

    Promise.all(materiais.map(async (item) => {
      if (historicoPorItem[item.id]) return;
      try {
        const h = await listarHistorico(chamadoSel.id, item.id);
        setHistoricoPorItem(prev => ({
          ...prev,
          [item.id]: { carregando: false, aplicacoes: h.aplicacoes || [] },
        }));
      } catch (_) {
        setHistoricoPorItem(prev => ({
          ...prev,
          [item.id]: { carregando: false, aplicacoes: [] },
        }));
      }
    }));
  }, [chamadoSel?.id, carregarPercentual, carregarEventos, listarHistorico]);

  useEffect(() => {
    if (!pendingFocusId) return;
    const el = document.querySelector(`[data-item-input="${pendingFocusId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
    }
    setPendingFocusId(null);
  }, [pendingFocusId, form.itens]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (eqRef.current && !eqRef.current.contains(e.target)) setShowDrop(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Busca de sugestões — via backend (GET /catalogo/buscar-item), cobrindo
  // catálogo local do tenant E marketplace de fornecedores (dual-source).
  // Contrato de resposta é DELIBERADAMENTE restrito: nunca traz fornecedor
  // nem preço, porque quem usa esta tela não deve ver dado comercial —
  // isso é garantido no backend (routes/catalogoBusca.js), não aqui; esta
  // função só consome o que a API já devolve.
  // Debounce (350ms) + guard de resposta fora de ordem por item, já que
  // várias teclas digitadas rápido podem disparar requisições que voltam
  // em ordem diferente da que foram enviadas.
  function buscarSugestoesItem(termo, itemId) {
    if (!buscaItemRef.current[itemId]) buscaItemRef.current[itemId] = { timer: null, ultimaChamadaId: 0 };
    const ctrl = buscaItemRef.current[itemId];

    if (ctrl.timer) clearTimeout(ctrl.timer);

    if (termo.trim().length < 2) {
      ctrl.ultimaChamadaId += 1;
      setItemSugestoes(prev => ({ ...prev, [itemId]: [] }));
      setShowSugestoes(prev => ({ ...prev, [itemId]: false }));
      setBuscandoSugestoes(prev => ({ ...prev, [itemId]: false }));
      return;
    }

    setBuscandoSugestoes(prev => ({ ...prev, [itemId]: true }));

    ctrl.timer = setTimeout(async () => {
      const chamadaId = ++ctrl.ultimaChamadaId;
      try {
        // apiService.get(endpoint, params) recebe os query params DIRETO
        // (sem wrapper { params: {...} } — esse é o formato do axios, não
        // o deste apiService, que monta a URL via URLSearchParams a partir
        // do objeto passado aqui mesmo).
        const resp = await apiService.get('/catalogo/buscar-item', { termo, limit: 5 });
        if (chamadaId !== ctrl.ultimaChamadaId) return; // resposta obsoleta, ignora
        const resultados = resp?.resultados || [];
        setItemSugestoes(prev => ({ ...prev, [itemId]: resultados }));
        setShowSugestoes(prev => ({ ...prev, [itemId]: resultados.length > 0 }));
      } catch (err) {
        if (chamadaId !== ctrl.ultimaChamadaId) return;
        console.warn("⚠️ /catalogo/buscar-item indisponível:", err.message);
        setItemSugestoes(prev => ({ ...prev, [itemId]: [] }));
        setShowSugestoes(prev => ({ ...prev, [itemId]: false }));
      } finally {
        if (chamadaId === ctrl.ultimaChamadaId) setBuscandoSugestoes(prev => ({ ...prev, [itemId]: false }));
      }
    }, 350);
  }

  // sug = { origem: "catalogo" | "fornecedores", catalogo_item_id, nome, codigo, categoria, tipo_match, confianca }
  async function selecionarSugestao(itemId, sug) {
    atualizarItem(itemId, "item_nome", sug.nome);
    atualizarItem(itemId, "codigo", sug.codigo || "");
    setItemSugestoes(prev => ({ ...prev, [itemId]: [] }));
    setShowSugestoes(prev => ({ ...prev, [itemId]: false }));

    if (sug.origem === "catalogo" && sug.catalogo_item_id) {
      // Match no catálogo local do tenant -> tem estoque real pra consultar.
      atualizarItem(itemId, "item_catalogo_id", sug.catalogo_item_id);
      const item = form.itens.find(m => m.id === itemId);
      const { status, disponivel } = await consultarSaldo(sug.catalogo_item_id, item?.quantidade || 1);
      setForm(f => ({ ...f, itens: f.itens.map(m => m.id === itemId ? { ...m, status_estoque: status, saldo_disponivel: disponivel } : m) }));
    } else {
      // Match só no marketplace de fornecedores: nome reconhecido, mas sem
      // vínculo de estoque local — não existe item_catalogo_id pra
      // consultar saldo. O código preenchido acima (linha ~276) é o PN de
      // UM fornecedor específico que respondeu o match — útil como
      // referência pra diferenciar itens de nome parecido (ex: duas
      // "lâmpada farol direito" de veículos diferentes), mas não é um PN
      // "oficial" unificado do item. Rótulo neutro específico de estoque,
      // nunca mostra fornecedor/preço aqui (esses dados nem chegam nesta
      // tela — o backend já os omite por contrato).
      atualizarItem(itemId, "item_catalogo_id", null);
      setForm(f => ({ ...f, itens: f.itens.map(m => m.id === itemId ? { ...m, status_estoque: "reconhecido_sem_estoque_local", saldo_disponivel: null } : m) }));
    }
  }

  async function revalidarSaldoQuantidade(itemId, novaQuantidade) {
    const item = form.itens.find(m => m.id === itemId);
    if (!item?.item_catalogo_id) return;
    const { status, disponivel } = await consultarSaldo(item.item_catalogo_id, novaQuantidade);
    setForm(f => ({ ...f, itens: f.itens.map(m => m.id === itemId ? { ...m, status_estoque: status, saldo_disponivel: disponivel } : m) }));
  }

  const eqFiltrados = (equipamentos || [])
    .filter(e => e.ativo !== false)
    .filter(e => e.nome.toLowerCase().includes(eqSearch.toLowerCase()) || e.tag.toLowerCase().includes(eqSearch.toLowerCase()));

  // Esta tela lista Ordens de Serviço. O backend distingue OS de RC pelo
  // campo `tipo_documento` do chamado ('os' vs 'requisicao_material'); como
  // useChamados() hoje não recebe filtro de tipo_documento (ver observação
  // equivalente em TelaChamadosNova.jsx), filtramos no cliente por
  // segurança, tolerando registros sem o campo (dados legados anteriores à
  // separação OS/RC) para não sumir com OS antigas da lista.
  const chamadosFiltered = (chamados || [])
    .filter(c => !c.tipo_documento || c.tipo_documento === "os")
    .filter(c => filtroStatus === "todos" || c.status === filtroStatus)
    .filter(c => filtroUrgencia === "todos" || c.urgencia === filtroUrgencia)
    .filter(c => {
      if (!busca) return true;
      const text = busca.toLowerCase();
      const linhas = c.itens || [...(c.materiais || []), ...(c.servicos || [])];
      if (linhas.some(item => (item.item_nome || item.nome || "").toLowerCase().includes(text) || (item.codigo && item.codigo.toLowerCase().includes(text)))) return true;
      return (c.peca && c.peca.toLowerCase().includes(text)) || (c.codigo && c.codigo.toLowerCase().includes(text));
    });

  // ── Manipulação da lista única ──
  const adicionarItem = (tipo) => {
    const origem = modal === "editar" ? "adicionado" : "planejado";
    const novo = tipo === "material" ? novoMaterial(origem) : novoServico(origem);
    setForm(f => ({ ...f, itens: [...f.itens, novo] }));
    setPendingFocusId(novo.id);
  };

  const moverItem = (id, direcao) => {
    setForm(f => {
      const idx = f.itens.findIndex(it => it.id === id);
      const novoIdx = idx + direcao;
      if (novoIdx < 0 || novoIdx >= f.itens.length) return f;
      const itens = [...f.itens];
      [itens[idx], itens[novoIdx]] = [itens[novoIdx], itens[idx]];
      return { ...f, itens };
    });
  };

  const removerOuCancelarItem = (id) => {
    const item = form.itens.find(it => it.id === id);
    const ativos = form.itens.filter(it => it.status !== "cancelado").length;

    if (modal === "editar" && item.origem === "planejado") {
      if (ativos === 1) { alert("É necessário pelo menos um item ativo na OS."); return; }
      if (!window.confirm("Este item fazia parte do plano original da OS. Marcar como cancelado (mantém o histórico)?")) return;
      atualizarItem(id, "status", "cancelado");
      return;
    }
    if (form.itens.length === 1) { alert("É necessário pelo menos um item."); return; }
    if (!window.confirm("Remover este item?")) return;
    setForm(f => ({ ...f, itens: f.itens.filter(it => it.id !== id) }));
  };

  const restaurarItem = (id) => atualizarItem(id, "status", "ativo");

  const atualizarItem = (id, campo, valor) => {
    setForm(f => ({ ...f, itens: f.itens.map(it => it.id === id ? { ...it, [campo]: valor } : it) }));
    if (campo === "quantidade") revalidarSaldoQuantidade(id, valor);
  };

  // Submit
  const handleSubmit = async () => {
    const itensValidos = form.itens.filter(it => {
      if (it.status === "cancelado") return true; // mantém no payload para preservar histórico
      const nome = it.tipo === "material" ? it.item_nome : it.nome;
      return nome && nome.trim() !== "";
    });

    if (itensValidos.filter(it => it.status !== "cancelado").length === 0) {
      alert("Adicione pelo menos um material ou serviço com nome preenchido.");
      return;
    }

    if (form.modoProgramacao === "geral" && !janelaValida(form.dataInicioPrevista, form.dataFimPrevista)) {
      alert("A data/hora de fim prevista da OS não pode ser anterior ao início. Corrija a janela prevista antes de salvar.");
      return;
    }
    if (form.modoProgramacao === "detalhada") {
      const itemInvalido = itensValidos.find(it => it.tipo === "servico" && it.status !== "cancelado" && !janelaValida(it.data_inicio_prevista, it.data_fim_prevista));
      if (itemInvalido) {
        alert(`O serviço "${itemInvalido.nome || "sem nome"}" tem fim previsto anterior ao início previsto. Corrija antes de salvar.`);
        return;
      }
    }

    let contador = 0;
    const itensComNumero = itensValidos.map(it => {
      if (it.origem === "planejado") {
        if (it.numero_base == null) { contador += 1; return { ...it, numero_base: contador }; }
        contador = Math.max(contador, it.numero_base);
        return it;
      }
      return it;
    });

    const janelaAuto = calcularJanelaAutomatica(itensComNumero);
    const dataInicioFinal = form.modoProgramacao === "geral" ? paraISOComOffset(form.dataInicioPrevista)
      : form.modoProgramacao === "detalhada" ? paraISOComOffset(janelaAuto?.inicio)
      : null;
    const dataFimFinal = form.modoProgramacao === "geral" ? paraISOComOffset(form.dataFimPrevista)
      : form.modoProgramacao === "detalhada" ? paraISOComOffset(janelaAuto?.fim)
      : null;

    const serializarItem = (it) => ({
      id: it.id, tipo: it.tipo, numero_base: it.numero_base, origem: it.origem, status: it.status,
      ...(it.tipo === "material" ? {
        item_nome: it.item_nome, codigo: it.codigo, item_catalogo_id: it.item_catalogo_id || null,
        quantidade: parseInt(it.quantidade) || 1, tipo_item: it.tipo_item, descricao: it.descricao,
        status_estoque: it.status_estoque, saldo_disponivel: it.saldo_disponivel,
      } : {
        nome: it.nome, descricao: it.descricao,
        qtd_pessoas_planejada: parseInt(it.qtd_pessoas_planejada) || 1,
        data_inicio_prevista: paraISOComOffset(it.data_inicio_prevista), data_fim_prevista: paraISOComOffset(it.data_fim_prevista),
        apontamento: it.apontamento || null,
      }),
    });

    const payload = {
      equipamento_id: form.equipamentoId || null,
      descricao_geral: form.descricaoGeral,
      servico_nome: form.servico_nome || form.descricaoGeral || "Manutenção",
      urgencia: form.urgencia,
      categoria: form.categoria,

      modo_programacao: form.modoProgramacao,
      data_inicio_prevista: dataInicioFinal,
      data_fim_prevista: dataFimFinal,
      itens: itensComNumero.map(serializarItem),
      materiais: itensComNumero.filter(it => it.tipo === "material").map(serializarItem),
      servicos: itensComNumero.filter(it => it.tipo === "servico").map(serializarItem),
    };

    setProcessando(true);
    try {
      if (modal === "editar") {
        const resposta = await atualizar(chamadoSel.id, payload);
        setChamadoSel(resposta);
        setTelaAtual("detalhe");
        alert("Ordem de Serviço atualizada com sucesso!");
      } else {
        const resposta = await criar(payload);
        await carregar();
        for (const it of itensComNumero) {
          if (it.tipo === "material" && it.item_catalogo_id && it.status_estoque !== "sem_estoque") {
            // eslint-disable-next-line no-await-in-loop
            await reservar(it.item_catalogo_id, it.quantidade, resposta?.id);
          }
        }
        alert("Ordem de Serviço criada com sucesso!");
      }
      setModal(null);
      resetForm();
    } catch (e) {
      console.error("❌ Erro detalhado:", e);
      alert("Erro: " + (e.message || "Ocorreu um erro inesperado"));
    } finally {
      setProcessando(false);
    }
  };

  const resetForm = () => {
    setForm(formVazio());
    setEqSearch("");
    setShowDrop(false);
  };

  // ── Busca de templates globais (server-side, com filtros e debounce) ──
  const carregarTemplatesGlobais = useCallback(async () => {
    setCarregandoGlobais(true);
    try {
      const params = {};
      if (buscaGlobal.trim()) params.q = buscaGlobal.trim();
      if (filtroTipoEquip) params.tipo_equipamento = filtroTipoEquip;
      if (filtroMarca) params.marca = filtroMarca;

      const lista = await apiService.get("/cotacoes/chamados/templates-globais", params);
      setTemplatesGlobais(Array.isArray(lista) ? lista : []);
    } catch (e) {
      console.warn("Erro ao buscar templates globais:", e.message);
      setTemplatesGlobais([]);
    } finally {
      setCarregandoGlobais(false);
    }
  }, [buscaGlobal, filtroTipoEquip, filtroMarca]);

  // Carrega filtros disponíveis (tipo de equipamento + marcas) só uma vez,
  // quando o modal abre pela primeira vez.
  useEffect(() => {
    if (!modalCarregarTemplate) return;
    apiService.get("/cotacoes/chamados/templates-globais-meta/filtros")
      .then(f => {
        if (f && typeof f === "object") setFiltrosGlobaisDisponiveis(f);
      })
      .catch(() => {});
  }, [modalCarregarTemplate]);

  // Dispara a busca global com debounce de 350ms quando algo muda.
  // Só roda quando a aba "globais" está ativa pra não gastar chamadas
  // enquanto o usuário navega em "meus modelos".
  useEffect(() => {
    if (!modalCarregarTemplate || abaTemplate !== "globais") return;
    if (buscaGlobalTimerRef.current) clearTimeout(buscaGlobalTimerRef.current);
    buscaGlobalTimerRef.current = setTimeout(() => {
      carregarTemplatesGlobais();
    }, 350);
    return () => {
      if (buscaGlobalTimerRef.current) clearTimeout(buscaGlobalTimerRef.current);
    };
  }, [buscaGlobal, filtroTipoEquip, filtroMarca, abaTemplate, modalCarregarTemplate, carregarTemplatesGlobais]);

  // ─────────────────────────────────────────────────────────────────────────
  // MODAL — SALVAR OS COMO MODELO (extraído em modais/ModalSalvarTemplate.jsx)
  // ─────────────────────────────────────────────────────────────────────────
  if (modalSalvarTemplate) {
    return (
      <ModalSalvarTemplate
        chamado={chamadoSel}
        nomeInicial={modalSalvarTemplate.nome}
        descricaoInicial={modalSalvarTemplate.descricao}
        salvando={!!modalSalvarTemplate.salvando}
        erro={modalSalvarTemplate.erro}
        s={s}
        C={C}
        onCancelar={() => setModalSalvarTemplate(null)}
        onConfirmar={async ({ nome, descricao }) => {
          setModalSalvarTemplate(m => ({ ...m, salvando: true, erro: null }));
          try {
            await apiService.post(
              `/cotacoes/chamados/${chamadoSel.id}/salvar-como-template`,
              { nome, descricao }
            );
            setModalSalvarTemplate(null);
            alert("Modelo salvo com sucesso. Ele já está disponível para novas OSs.");
          } catch (e) {
            setModalSalvarTemplate(m => ({
              ...m, salvando: false,
              erro: e.message || "Erro ao salvar modelo",
            }));
          }
        }}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODAL — CARREGAR MODELO DE MANUTENÇÃO
  // (componente extraído em modais/ModalCarregarTemplate.jsx)
  // ─────────────────────────────────────────────────────────────────────────
  if (modalCarregarTemplate) {
    return (
      <ModalCarregarTemplate
        qtdItensExistentes={form.itens.length}
        s={s}
        C={C}
        onCancelar={() => {
          setModalCarregarTemplate(false);
        }}
        onConfirmar={({ itens, template }) => {
          setForm(f => ({
            ...f,
            itens,
            categoria: template.categoria || f.categoria,
            urgencia: template.urgencia || f.urgencia,
            descricaoGeral: f.descricaoGeral || template.descricao || "",
            servico_nome: f.servico_nome || template.nome || "",
          }));
          setModalCarregarTemplate(false);
        }}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODAL — CRIAR / EDITAR OS
  // ─────────────────────────────────────────────────────────────────────────
  if (modal === "novo" || modal === "editar") {
    const numerados = modal === "novo" && form.itens.every(it => it.numero_base == null)
      ? numerarRascunho(form.itens)
      : computarNumeracao(form.itens);

    const janelaAuto = calcularJanelaAutomatica(form.itens);

    return (
      <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
        <div style={{ ...s.card, width: 820, maxWidth: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 48px #00000060" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                {modal === "novo" ? "Nova Ordem de Serviço" : "Editar Ordem de Serviço"}
              </div>
              {modal === "novo" && (
                <button
                  onClick={async () => {
                    setModalCarregarTemplate(true);
                    setCarregandoTemplates(true);
                    try {
                      const lista = await apiService.get("/cotacoes/chamados/templates");
                      setTemplatesDisponiveis(Array.isArray(lista) ? lista : []);
                    } catch (e) {
                      console.warn("Erro ao listar modelos:", e.message);
                      setTemplatesDisponiveis([]);
                    } finally {
                      setCarregandoTemplates(false);
                    }
                  }}
                  style={{ background: "transparent", border: "none", color: C.accent,
                           fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                           padding: 0, marginTop: 4, textDecoration: "underline" }}>
                  📋 Carregar modelo de manutenção
                </button>
              )}
            </div>
            <button onClick={() => { setModal(null); resetForm(); }} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>

          <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
            {/* Equipamento com autocomplete (opcional) */}
            <div style={{ marginBottom: 14, position: "relative" }} ref={eqRef}>
              <label style={s.label}>EQUIPAMENTO (OPCIONAL)</label>
              <input
                type="text"
                value={form.equipamentoId ? (equipamentos || []).find(e => e.id === parseInt(form.equipamentoId))?.nome || eqSearch : eqSearch}
                onChange={e => { setEqSearch(e.target.value); setForm(f => ({ ...f, equipamentoId: "" })); setShowDrop(true); }}
                onFocus={() => setShowDrop(true)}
                placeholder="Buscar equipamento por nome ou TAG..."
                style={s.input}
              />
              {showDrop && eqFiltrados.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#1a2233", border: `1px solid ${C.border}`, borderRadius: 6, zIndex: 50, marginTop: 4, maxHeight: 200, overflowY: "auto" }}>
                  {eqFiltrados.map(eq => (
                    <div key={eq.id}
                      onClick={() => { setForm(f => ({ ...f, equipamentoId: eq.id })); setEqSearch(`${eq.tag} - ${eq.nome}`); setShowDrop(false); }}
                      style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${C.border}22` }}
                      onMouseEnter={e => e.currentTarget.style.background = "#1e2a3f"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div style={{ fontSize: 13, color: C.text }}>{eq.nome}</div>
                      <div style={{ fontSize: 11, color: C.accent }}>{eq.tag} · {eq.local}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={s.label}>DESCRIÇÃO GERAL (OPCIONAL)</label>
              <textarea value={form.descricaoGeral} onChange={e => setForm(f => ({ ...f, descricaoGeral: e.target.value }))}
                placeholder="Observações gerais sobre a OS" style={{ ...s.input, minHeight: 60, resize: "vertical" }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={s.label}>NOME DA OS</label>
              <input value={form.servico_nome} onChange={e => setForm(f => ({ ...f, servico_nome: e.target.value }))}
                placeholder="Ex: Preventiva 10.000km, Troca de óleo, etc." style={s.input} />
            </div>

            {/* Urgência e Categoria — agora no nível da OS, não por item */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
              <div>
                <label style={s.label}>URGÊNCIA DA OS</label>
                <select value={form.urgencia} onChange={e => setForm(f => ({ ...f, urgencia: e.target.value }))} style={{ ...s.input, appearance: "none" }}>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <div>
                <label style={s.label}>CATEGORIA DA OS</label>
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={{ ...s.input, appearance: "none" }}>
                  <option value="corretiva">Corretiva</option>
                  <option value="preventiva">Preventiva</option>
                  <option value="preditiva">Preditiva</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={s.label}>PROGRAMAÇÃO DA OS</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                {[
                  { id: "nenhuma", label: "Não requerida" },
                  { id: "geral", label: "Programação geral" },
                  { id: "detalhada", label: "Detalhada por tarefa" },
                ].map(opt => (
                  <button key={opt.id}
                    onClick={() => setForm(f => ({
                      ...f, modoProgramacao: opt.id,
                      ...(opt.id === "detalhada" ? { dataInicioPrevista: "", dataFimPrevista: "" } : {}),
                    }))}
                    style={{
                      background: form.modoProgramacao === opt.id ? C.accent : "transparent",
                      border: `1px solid ${form.modoProgramacao === opt.id ? C.accent : C.border}`,
                      borderRadius: 6, padding: "6px 14px",
                      color: form.modoProgramacao === opt.id ? "white" : C.muted,
                      fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {form.modoProgramacao == null && (
                <div style={{ fontSize: 11, color: C.muted }}>Escolha como esta OS será programada.</div>
              )}

              {form.modoProgramacao === "nenhuma" && (
                <div style={{ fontSize: 11, color: C.muted }}>Sem data prevista para esta OS.</div>
              )}

              {form.modoProgramacao === "geral" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ ...s.label, fontSize: 10 }}>INÍCIO PREVISTO</label>
                    <input type="datetime-local" value={form.dataInicioPrevista} onChange={e => setForm(f => ({ ...f, dataInicioPrevista: e.target.value }))} style={s.input} />
                  </div>
                  <div>
                    <label style={{ ...s.label, fontSize: 10 }}>FIM PREVISTO</label>
                    <input type="datetime-local" value={form.dataFimPrevista} min={form.dataInicioPrevista || undefined}
                      onChange={e => setForm(f => ({ ...f, dataFimPrevista: e.target.value }))} style={s.input} />
                    {!janelaValida(form.dataInicioPrevista, form.dataFimPrevista) && (
                      <div style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }}>⚠ Fim não pode ser anterior ao início.</div>
                    )}
                  </div>
                </div>
              )}

              {form.modoProgramacao === "detalhada" && (
                <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 12, color: C.text }}>
                    📅 {janelaAuto?.inicio ? fmtD(janelaAuto.inicio) : "—"} → {janelaAuto?.fim ? fmtD(janelaAuto.fim) : "—"}
                    <span style={{ fontSize: 10, color: C.muted, marginLeft: 8 }}>(calculado a partir das datas de cada serviço, abaixo)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Lista única de itens */}
            <div style={{ marginBottom: 14 }} id="lista-itens-os">
              <div style={{ fontSize: 12, color: C.textSub, marginBottom: 10 }}>
                Adicione materiais ou serviços à OS
                {numerados.length > 0 && (
                  <span style={{ color: C.muted }}> · {numerados.filter(it => it.status !== "cancelado").length} ativo(s)</span>
                )}
              </div>

              {numerados.length === 0 && (
                <div style={{ background: C.bg, border: `1px dashed ${C.border}`, borderRadius: 8, padding: "18px 14px", textAlign: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Nenhum item ainda</div>
                  <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
                    <button onClick={() => adicionarItem("material")} style={{ background: "transparent", border: "none", color: C.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                      + Material
                    </button>
                    <button onClick={() => adicionarItem("servico")} style={{ background: "transparent", border: "none", color: C.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                      + Serviço
                    </button>
                  </div>
                </div>
              )}

              {numerados.map((item, index) => {
                const cancelado = item.status === "cancelado";
                const isMaterial = item.tipo === "material";
                const est = isMaterial ? (estoqueCfg[item.status_estoque] || estoqueCfg.nao_verificado) : null;
                const estaConsultando = isMaterial && item.item_catalogo_id && consultando[item.item_catalogo_id];
                const calc = !isMaterial ? calcularHorasHomem(item.data_inicio_prevista, item.data_fim_prevista, item.qtd_pessoas_planejada) : null;

                return (
                  <div key={item.id} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 10, opacity: cancelado ? 0.55 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <button onClick={() => moverItem(item.id, -1)} disabled={index === 0} style={{ background: "transparent", border: "none", color: index === 0 ? C.border : C.muted, fontSize: 10, cursor: index === 0 ? "default" : "pointer", lineHeight: 1, padding: 0 }} title="Mover para cima">▲</button>
                          <button onClick={() => moverItem(item.id, 1)} disabled={index === numerados.length - 1} style={{ background: "transparent", border: "none", color: index === numerados.length - 1 ? C.border : C.muted, fontSize: 10, cursor: index === numerados.length - 1 ? "default" : "pointer", lineHeight: 1, padding: 0 }} title="Mover para baixo">▼</button>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>#{item.numeroExibicao}</span>
                        <span style={{ fontSize: 11, color: C.textSub }}>{isMaterial ? "📦 Material" : "🛠 Serviço"}</span>
                        {item.origem === "adicionado" && <span style={{ ...s.tag(C.accent), fontSize: 9 }}>ADICIONADO</span>}
                        {cancelado && <span style={{ ...s.tag("#ef4444"), fontSize: 9 }}>CANCELADO</span>}
                      </div>
                      {cancelado ? (
                        <button onClick={() => restaurarItem(item.id)} style={{ background: "transparent", border: "none", color: C.accent, fontSize: 11, cursor: "pointer" }}>↩ Restaurar</button>
                      ) : (
                        <button onClick={() => removerOuCancelarItem(item.id)} style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: 14, cursor: "pointer" }} title="Remover item">✕</button>
                      )}
                    </div>

                    {isMaterial ? (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 70px 40px", gap: 10, alignItems: "end" }}>
                          <div style={{ position: "relative" }}>
                            <label style={{ ...s.label, fontSize: 10 }}>NOME *</label>
                            <div style={{ position: "relative" }}>
                              <input type="text" value={item.item_nome} disabled={cancelado} data-item-input={item.id}
                                onChange={e => { atualizarItem(item.id, "item_nome", e.target.value); atualizarItem(item.id, "item_catalogo_id", null); atualizarItem(item.id, "status_estoque", "nao_verificado"); buscarSugestoesItem(e.target.value, item.id); }}
                                onFocus={() => { if (itemSugestoes[item.id]?.length > 0) setShowSugestoes(prev => ({ ...prev, [item.id]: true })); }}
                                onBlur={() => setTimeout(() => setShowSugestoes(prev => ({ ...prev, [item.id]: false })), 200)}
                                placeholder="Ex: Rolamento SKF 6205" style={s.input} />
                              {buscandoSugestoes[item.id] && (
                                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: C.bg, border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 6px 6px", zIndex: 100, padding: "8px 12px", fontSize: 11, color: C.muted }}>
                                  Buscando...
                                </div>
                              )}
                              {!buscandoSugestoes[item.id] && showSugestoes[item.id] && itemSugestoes[item.id]?.length > 0 && (
                                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: C.bg, border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 6px 6px", zIndex: 100, maxHeight: 220, overflowY: "auto", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
                                  {itemSugestoes[item.id].map((sug, i) => {
                                    const doCatalogo = sug.origem === "catalogo";
                                    const matchExato = sug.tipo_match === "codigo" || sug.tipo_match === "pn";
                                    // PN no hint ajuda a diferenciar itens de nome parecido mas
                                    // de aplicação/veículo diferente (ex: duas "lâmpada farol
                                    // direito" com PN distinto). Vindo do marketplace, é o PN de
                                    // UM fornecedor específico — referência, não um código
                                    // "oficial" unificado do item.
                                    const partesInfo = [];
                                    if (sug.codigo) partesInfo.push(`PN: ${sug.codigo}`);
                                    else if (doCatalogo) partesInfo.push(sug.categoria || "Catálogo local");
                                    else partesInfo.push("Reconhecido");
                                    if (doCatalogo && sug.codigo && sug.categoria) partesInfo.push(sug.categoria);
                                    if (matchExato) partesInfo.push("código exato");
                                    return (
                                      <div key={`${sug.origem}-${sug.catalogo_item_id || sug.nome}-${i}`} onClick={() => selecionarSugestao(item.id, sug)} style={{ padding: "10px 12px", cursor: "pointer", borderBottom: `1px solid ${C.border}22`, fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}
                                        onMouseEnter={e => e.currentTarget.style.background = "#1e2a3f"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                        <span title={doCatalogo ? "No catálogo local — estoque pode ser verificado" : "Reconhecido — sem estoque local para verificar"} style={{ fontSize: 13, flexShrink: 0 }}>
                                          {doCatalogo ? "📦" : "🔵"}
                                        </span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ color: C.text, fontWeight: 500 }}>{sug.nome}</div>
                                          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                                            {partesInfo.join(" · ")}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <label style={{ ...s.label, fontSize: 10 }}>CÓDIGO</label>
                            <input type="text" value={item.codigo} disabled={cancelado} onChange={e => atualizarItem(item.id, "codigo", e.target.value)} placeholder="Ex: SKF-6205" style={s.input} />
                          </div>
                          <div>
                            <label style={{ ...s.label, fontSize: 10 }}>QTD</label>
                            <input type="number" value={item.quantidade} disabled={cancelado} onChange={e => atualizarItem(item.id, "quantidade", e.target.value)} min="1" style={{ ...s.input, textAlign: "center" }} />
                          </div>
                          <div style={{ display: "flex", justifyContent: "center", paddingBottom: 9 }} title={est.label}>
                            <span style={{ fontSize: 18, cursor: "help" }}>{estaConsultando ? "⏳" : est.icon}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                          {est.label}{item.saldo_disponivel != null && ` — saldo disponível: ${item.saldo_disponivel}`}
                        </div>

                        {/* ▼▼▼ NOVO BLOCO PARA SERIALIZAÇÃO ▼▼▼ */}
                        <label style={{
                          display: "flex", alignItems: "center", gap: 8,
                          marginTop: 10, padding: "8px 10px",
                          background: C.bg, borderRadius: 6, cursor: "pointer",
                        }}>
                          <input
                            type="checkbox"
                            checked={!!item.serializado}
                            disabled={cancelado}
                            onChange={e => atualizarItem(item.id, "serializado", e.target.checked)}
                          />
                          <span style={{ fontSize: 11, color: C.text }}>
                            Este material é <strong>serializado</strong> — exigir nº de série na aplicação
                          </span>
                        </label>
                        {/* ▲▲▲ FIM DO NOVO BLOCO ▲▲▲ */}

                        <div style={{ marginTop: 8 }}>
                          <label style={{ ...s.label, fontSize: 10 }}>DESCRIÇÃO (OPCIONAL)</label>
                          <input type="text" value={item.descricao || ""} disabled={cancelado} onChange={e => atualizarItem(item.id, "descricao", e.target.value)} placeholder="Detalhes adicionais sobre este material" style={s.input} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ marginBottom: 8 }}>
                          <label style={{ ...s.label, fontSize: 10 }}>NOME DO SERVIÇO *</label>
                          <input type="text" value={item.nome} disabled={cancelado} data-item-input={item.id} onChange={e => atualizarItem(item.id, "nome", e.target.value)} placeholder="Ex: Troca do amortecedor dianteiro lado direito" style={s.input} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: form.modoProgramacao === "detalhada" ? "90px 1fr 1fr" : "140px", gap: 10, marginBottom: 8 }}>
                          <div>
                            <label style={{ ...s.label, fontSize: 10 }}>PESSOAS</label>
                            <input type="number" min="1" value={item.qtd_pessoas_planejada} disabled={cancelado} onChange={e => atualizarItem(item.id, "qtd_pessoas_planejada", e.target.value)} style={{ ...s.input, textAlign: "center" }} />
                          </div>

                          {form.modoProgramacao === "detalhada" && (
                            <>
                              <div>
                                <label style={{ ...s.label, fontSize: 10 }}>INÍCIO PREVISTO</label>
                                <input type="datetime-local" value={item.data_inicio_prevista} disabled={cancelado} onChange={e => atualizarItem(item.id, "data_inicio_prevista", e.target.value)} style={s.input} />
                              </div>
                              <div>
                                <label style={{ ...s.label, fontSize: 10 }}>FIM PREVISTO</label>
                                <input type="datetime-local" value={item.data_fim_prevista} disabled={cancelado} min={item.data_inicio_prevista || undefined}
                                  onChange={e => atualizarItem(item.id, "data_fim_prevista", e.target.value)} style={s.input} />
                                {!janelaValida(item.data_inicio_prevista, item.data_fim_prevista) && (
                                  <div style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }}>⚠ Fim não pode ser anterior ao início.</div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        {calc && (
                          <div style={{ fontSize: 11, color: C.accent, background: `${C.accent}15`, borderRadius: 6, padding: "6px 10px", marginBottom: 8 }}>
                            ⏱ {calc.horasCorridas}h corridas × {item.qtd_pessoas_planejada} pessoa(s) = <strong>{calc.horasHomem}h-homem planejadas</strong>
                          </div>
                        )}
                        <div>
                          <label style={{ ...s.label, fontSize: 10 }}>DESCRIÇÃO (OPCIONAL)</label>
                          <input type="text" value={item.descricao || ""} disabled={cancelado} onChange={e => atualizarItem(item.id, "descricao", e.target.value)} placeholder="Detalhes adicionais sobre este serviço" style={s.input} />
                        </div>
                      </>
                    )}

                    {index === numerados.length - 1 && (
                      <div style={{ display: "flex", gap: 14, marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${C.border}` }}>
                        <button onClick={() => adicionarItem("material")} style={{ background: "transparent", border: "none", color: C.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                          + Material
                        </button>
                        <button onClick={() => adicionarItem("servico")} style={{ background: "transparent", border: "none", color: C.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                          + Serviço
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, padding: "14px 22px", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
            <button onClick={() => { setModal(null); resetForm(); }} style={{ ...s.btn(false), flex: 1, padding: "8px 16px" }}>Cancelar</button>
            <button onClick={handleSubmit} disabled={processando} style={{ ...s.btn(true), flex: 1, padding: "8px 16px", opacity: processando ? 0.5 : 1, cursor: processando ? "not-allowed" : "pointer" }}>
              {processando ? "Salvando..." : modal === "novo" ? "Criar OS" : "Atualizar OS"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODAL — APONTAMENTO DE EXECUÇÃO (extraído em modais/ModalApontamento.jsx)
  // ─────────────────────────────────────────────────────────────────────────
  if (modalApontamento) {
    const servico = (chamadoSel?.itens || []).find(it => it.id === modalApontamento.servicoId);
    if (!servico) {
      setModalApontamento(null);
      return null;
    }
    return (
      <ModalApontamento
        chamado={chamadoSel}
        item={servico}
        s={s}
        C={C}
        onFechar={() => setModalApontamento(null)}
        onAtualizarResumo={async () => {
          await carregar();
          const lista = await apiService.get("/cotacoes/chamados", { tipo_documento: "os" });
          const fresh = Array.isArray(lista)
            ? lista.find(c => String(c.id) === String(chamadoSel.id))
            : null;
          if (fresh) setChamadoSel(fresh);
          await carregarPercentual(chamadoSel.id);
          await carregarEventos(chamadoSel.id);
        }}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODAL — APLICAR MATERIAL NA OS (MIGO-like)
  // ─────────────────────────────────────────────────────────────────────────
  if (modalAplicacao) {
    return (
      <ModalAplicarMaterial
        chamado={chamadoSel}
        item={modalAplicacao.item}
        salvando={salvandoAplicacao}
        s={s}
        C={C}
        onCancelar={() => setModalAplicacao(null)}
        onConfirmar={async (payload) => {
          try {
            await aplicar(chamadoSel.id, modalAplicacao.item.id, payload);

            // Recarrega a lista (atualiza badge de status na lista principal)
            await carregar();

            // Recarrega o chamadoSel — carregar() atualiza só a lista, não
            // este snapshot que alimenta a tela de detalhe. Sem isso, o
            // item continua mostrando o estado antigo até F5.
            const listaAtualizada = await apiService.get(
              "/cotacoes/chamados",
              { tipo_documento: "os" }
            );
            const fresh = Array.isArray(listaAtualizada)
              ? listaAtualizada.find(c => String(c.id) === String(chamadoSel.id))
              : null;
            if (fresh) setChamadoSel(fresh);

            // Recarrega o histórico deste item AGORA — assim o contador do
            // botão "Histórico (N)" atualiza imediatamente após a aplicação,
            // sem depender de F5 ou de o usuário clicar pra expandir.
            try {
              const h = await listarHistorico(chamadoSel.id, modalAplicacao.item.id);
              setHistoricoPorItem(prev => ({
                ...prev,
                [modalAplicacao.item.id]: { carregando: false, aplicacoes: h.aplicacoes || [] },
              }));
            } catch (_) {
              setHistoricoPorItem(prev => {
                const copy = { ...prev };
                delete copy[modalAplicacao.item.id];
                return copy;
              });
            }

            setModalAplicacao(null);
          } catch (e) {
            alert("Não foi possível registrar a aplicação: " + (e.message || "erro inesperado"));
          }
        }}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODAL — REVERTER APLICAÇÃO (componente extraído em modais/ModalReversao.jsx)
  // ─────────────────────────────────────────────────────────────────────────
  if (modalReversao) {
    return (
      <ModalReversao
        contexto={modalReversao}
        salvando={salvandoAplicacao}
        s={s}
        C={C}
        onCancelar={() => setModalReversao(null)}
        onConfirmar={async ({ motivo, observacoes }) => {
          await reverter(modalReversao.aplicacaoId, { motivo, observacoes });
          await carregar();
          const listaAtualizada = await apiService.get(
            "/cotacoes/chamados",
            { tipo_documento: "os" }
          );
          const fresh = Array.isArray(listaAtualizada)
            ? listaAtualizada.find(c => String(c.id) === String(chamadoSel.id))
            : null;
          if (fresh) setChamadoSel(fresh);

          // Recarrega o histórico do item revertido, pro contador
          // atualizar na hora.
          if (modalReversao.chamadoItemId) {
            try {
              const h = await listarHistorico(chamadoSel.id, modalReversao.chamadoItemId);
              setHistoricoPorItem(prev => ({
                ...prev,
                [modalReversao.chamadoItemId]: { carregando: false, aplicacoes: h.aplicacoes || [] },
              }));
            } catch (_) {
              setHistoricoPorItem(prev => {
                const copy = { ...prev };
                delete copy[modalReversao.chamadoItemId];
                return copy;
              });
            }
          }
          setModalReversao(null);
        }}
      />
    );
  }

    // ─────────────────────────────────────────────────────────────────────────
  // MODAL — CANCELAR OS
  // ─────────────────────────────────────────────────────────────────────────
  if (modalCancelamento) {
    return (
      <ModalCancelamento
        chamado={chamadoSel}
        salvando={!!modalCancelamento.salvando}
        s={s}
        C={C}
        onCancelar={() => setModalCancelamento(null)}
        onConfirmar={async (motivo) => {
          setModalCancelamento(m => ({ ...m, salvando: true }));
          try {
            await apiService.post(
              `/cotacoes/chamados/${chamadoSel.id}/cancelar`,
              { motivo }
            );
            await carregar();
            const lista = await apiService.get("/cotacoes/chamados", { tipo_documento: "os" });
            const fresh = Array.isArray(lista)
              ? lista.find(c => String(c.id) === String(chamadoSel.id))
              : null;
            if (fresh) setChamadoSel(fresh);
            await carregarEventos(chamadoSel.id);
            setModalCancelamento(null);
          } catch (e) {
            setModalCancelamento(m => ({ ...m, salvando: false }));
            throw e;
          }
        }}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODAL — CONCLUIR OS (componente extraído em modais/ModalConclusao.jsx)
  // ─────────────────────────────────────────────────────────────────────────
  if (modalConclusao) {
    return (
      <ModalConclusao
        chamado={chamadoSel}
        resumo={modalConclusao.resumo}
        confirmouServicosPendentes={modalConclusao.confirmouServicosPendentes}
        salvando={!!modalConclusao.salvando}
        erro={modalConclusao.erro}
        s={s}
        C={C}
        onToggleCheckbox={(val) => setModalConclusao(m => ({
          ...m, confirmouServicosPendentes: val,
        }))}
        onCancelar={() => setModalConclusao(null)}
        onConfirmar={async () => {
          setModalConclusao(m => ({ ...m, salvando: true, erro: null }));
          try {
            await apiService.post(`/cotacoes/chamados/${chamadoSel.id}/concluir`, {});
            await carregar();
            const lista = await apiService.get("/cotacoes/chamados", { tipo_documento: "os" });
            const fresh = Array.isArray(lista)
              ? lista.find(c => String(c.id) === String(chamadoSel.id))
              : null;
            if (fresh) setChamadoSel(fresh);
            await carregarEventos(chamadoSel.id);
            await carregarPercentual(chamadoSel.id);
            setModalConclusao(null);
          } catch (e) {
            setModalConclusao(m => ({
              ...m, salvando: false,
              erro: e.message || "Erro ao concluir",
            }));
          }
        }}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LISTA DE ORDENS DE SERVIÇO
  // ─────────────────────────────────────────────────────────────────────────
  if (telaAtual === "lista") {
    return (
      <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>MANUTENÇÃO</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Ordens de Serviço</div>
          </div>
          <button onClick={() => { resetForm(); setModal("novo"); }} style={{ ...s.btn(true), padding: "9px 20px", fontSize: 12 }}>➕ Nova OS</button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          <input type="text" placeholder="Buscar por item, serviço ou código..." value={busca} onChange={e => setBusca(e.target.value)} style={{ ...s.input, flex: 1, minWidth: 200, padding: "8px 12px", fontSize: 12 }} />
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { id: "todos",         label: "Todos" },
              { id: "aberta",        label: "Aberta" },
              { id: "em_andamento",  label: "Em andamento" },
              { id: "finalizado",    label: "Finalizada" },
              { id: "cancelada",     label: "Cancelada" },
            ].map(f => (
              <button key={f.id} onClick={() => setFiltroStatus(f.id)} style={{ background: filtroStatus === f.id ? C.accent : "transparent", border: `1px solid ${filtroStatus === f.id ? C.accent : C.border}`, borderRadius: 6, padding: "6px 14px", color: filtroStatus === f.id ? "white" : C.muted, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>{f.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[{ id: "todos", label: "Urgência: Todas" }, { id: "alta", label: "Alta" }, { id: "media", label: "Média" }, { id: "baixa", label: "Baixa" }].map(f => (
              <button key={f.id} onClick={() => setFiltroUrgencia(f.id)} style={{ background: filtroUrgencia === f.id ? C.accent : "transparent", border: `1px solid ${filtroUrgencia === f.id ? C.accent : C.border}`, borderRadius: 6, padding: "6px 14px", color: filtroUrgencia === f.id ? "white" : C.muted, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>{f.label}</button>
            ))}
          </div>
        </div>

        {loading && <div style={{ color: C.muted, padding: 20, textAlign: "center" }}>Carregando...</div>}
        {erro && <div style={{ color: "#ef4444", padding: 20, background: "#ef444422", borderRadius: 8, marginBottom: 16 }}>{erro}</div>}

        {!loading && chamadosFiltered.length === 0 ? (
          <div style={{ ...s.card, padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔧</div>
            <div style={{ fontSize: 14, color: C.text, fontWeight: 500, marginBottom: 4 }}>Nenhuma OS encontrada</div>
            <div style={{ fontSize: 12, color: C.muted }}>Crie uma nova OS para solicitar materiais e/ou serviços</div>
          </div>
        ) : (
          <div style={{ ...s.card, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 110px 130px 90px 80px 90px 80px", padding: "10px 18px", background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, letterSpacing: "0.08em" }}>
              <span>NÚMERO</span><span>DESCRIÇÃO</span><span>ABERTURA</span><span>PRAZO</span><span>URGÊNCIA</span><span>CATEGORIA</span><span>STATUS</span><span></span>
            </div>
            {chamadosFiltered.map((chamado, i) => {
              const linhas = chamado.itens || [...(chamado.materiais || []), ...(chamado.servicos || [])];
              const nomeExibicao = chamado.servico_nome || chamado.descricao || (chamado.peca || "—");
              const totalLinhas = linhas.length;
              const totalAtivos = linhas.filter(it => it.status !== "cancelado").length;

              const statusCfg = {
                aberta: { l: "Aberta", c: C.muted },
                em_andamento: { l: "Em andamento", c: C.warn },
                finalizado: { l: "Finalizada", c: C.success },
                cancelada: { l: "Cancelada", c: "#ef4444" },
                // Legado
                aberto: { l: "Aberto", c: C.muted },
                cotando: { l: "Cotando", c: C.warn },
                aguardando_cotacao: { l: "Aguardando Cotação", c: C.warn },
              }[chamado.status] || { l: chamado.status, c: C.muted };
              const urgenciaCfg = urgenciaCfgMap[chamado.urgencia] || { l: chamado.urgencia, c: C.muted };
              const categoriaCfg = categoriaCfgMap[chamado.categoria] || { l: chamado.categoria, c: C.muted };

              return (
                <div key={chamado.id} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 110px 130px 90px 80px 90px 80px", padding: "13px 18px", borderBottom: i < chamadosFiltered.length - 1 ? `1px solid ${C.border}22` : "none", alignItems: "center" }}>                  <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>
                    {chamado.numero}
                    {totalLinhas > 1 && <span style={{ fontSize: 9, color: C.muted, marginLeft: 4 }}>({totalAtivos}/{totalLinhas} itens)</span>}
                  </div>
                  <div><div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{nomeExibicao}</div></div>
                  <div style={{ fontSize: 11, color: C.muted }}>{fmtD(chamado.aberto_em)}</div>
                  <div style={{ fontSize: 11 }}>
                    {(() => {
                      const prazo = calcularStatusPrazo(chamado, C);
                      if (!prazo) {
                        return <span style={{ color: C.muted, fontSize: 10 }}>—</span>;
                      }
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ color: C.text, fontFamily: "'IBM Plex Mono',monospace",
                                         fontSize: 10 }}>
                            {fmtD(chamado.data_fim_prevista)}
                          </span>
                          <span style={{ fontSize: 10, color: prazo.c, fontWeight: 600 }}>
                            {prazo.icon} {prazo.label}
                            {prazo.sub && (
                              <span style={{ color: C.muted, fontWeight: 400, marginLeft: 4 }}>
                                {prazo.sub}
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  <div style={{ ...s.tag(urgenciaCfg.c), fontSize: 10 }}>{urgenciaCfg.l}</div>
                  <div style={{ ...s.tag(categoriaCfg.c), fontSize: 10 }}>{categoriaCfg.l}</div>
                  {chamado.status === "em_andamento" && chamado.percentual_conclusao != null ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ background: C.bg, borderRadius: 20, height: 6,
                                    width: 46, overflow: "hidden" }}>
                        <div style={{
                          width: `${chamado.percentual_conclusao}%`,
                          background: chamado.percentual_conclusao >= 100 ? C.success : C.warn,
                          height: "100%",
                          transition: "width 0.4s ease",
                        }} />
                      </div>
                      <span style={{ fontSize: 10, color: C.warn, fontWeight: 600,
                                     fontFamily: "'IBM Plex Mono',monospace",
                                     minWidth: 30, textAlign: "right" }}>
                        {chamado.percentual_conclusao}%
                      </span>
                    </div>
                  ) : (
                    <div style={{ ...s.tag(statusCfg.c), fontSize: 10 }}>{statusCfg.l}</div>
                  )}
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={() => { setChamadoSel(chamado); setTelaAtual("detalhe"); }} style={{ ...s.btn(true), padding: "4px 10px", fontSize: 10 }}>Ver</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DETALHE
  // ─────────────────────────────────────────────────────────────────────────
  if (telaAtual === "detalhe" && chamadoSel) {
    const equipamento = (equipamentos || []).find(e => e.id === chamadoSel.equipamento_id);
    const linhas = (chamadoSel.itens || [...(chamadoSel.materiais || []), ...(chamadoSel.servicos || [])])
      .map(it => it.tipo === "servico" && it.nome === undefined ? { ...it, nome: it.item_nome || "" } : it)
      .sort((a, b) => {
        // Ordena por posicao (a numeração congelada da OS), preservando a
        // sequência em que o usuário criou. Fallback pra numero_base/id se
        // posicao vier nula (itens legados ou em rascunho).
        const pa = a.posicao ?? a.numero_base ?? Number.MAX_SAFE_INTEGER;
        const pb = b.posicao ?? b.numero_base ?? Number.MAX_SAFE_INTEGER;
        if (pa !== pb) return pa - pb;
        return Number(a.id) - Number(b.id);
      });
    const numerados = computarNumeracao(linhas);
    const urgenciaCfg = urgenciaCfgMap[chamadoSel.urgencia] || { l: chamadoSel.urgencia, c: C.muted };
    const categoriaCfg = categoriaCfgMap[chamadoSel.categoria] || { l: chamadoSel.categoria, c: C.muted };

    // ── RC/RM VINCULADAS ──────────────────────────────────────────────
    // O backend faz "split automático" de uma OS: quando um item de
    // material não tem estoque suficiente, ele pode ser absorvido por uma
    // Requisição de Material (RM) e, a partir dela, gerar uma Requisição
    // de Compra (RC). Esse vínculo chega de duas formas possíveis:
    //   1) por item: cada item de material em `chamadoSel.itens` pode
    //      trazer `requisicao_material` ({ id, numero }) quando aquele
    //      item específico foi absorvido;
    //   2) no payload de criação (resposta do POST), no nível do chamado,
    //      como `requisicao_compra`/`requisicao_material` — guardado aqui
    //      apenas se a API também persistir/retornar isso no GET de
    //      detalhe (não temos 100% de certeza disso — ver aviso no
    //      resumo final desta tarefa).
    // Não fazemos nenhuma chamada extra à API para montar isso — é só uma
    // leitura direta do que já veio no objeto do chamado. Se o backend não
    // preencher esses campos, a seção simplesmente não aparece.
    const rmsVinculadas = [];
    const vistos = new Set();
    for (const it of numerados) {
      const rm = it.requisicao_material;
      if (rm && rm.id != null && !vistos.has(rm.id)) {
        vistos.add(rm.id);
        rmsVinculadas.push(rm);
      }
    }
    const rcNoTopo = chamadoSel.requisicao_compra || null;
    const rmNoTopo = chamadoSel.requisicao_material || null;
    if (rmNoTopo && rmNoTopo.id != null && !vistos.has(rmNoTopo.id)) {
      vistos.add(rmNoTopo.id);
      rmsVinculadas.push(rmNoTopo);
    }
    const temVinculo = rmsVinculadas.length > 0 || rcNoTopo;

    return (
      <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
        <button onClick={() => { setTelaAtual("lista"); setChamadoSel(null); }} style={{ background: "transparent", border: "none", color: C.accent, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 16 }}>← Voltar para OS</button>

        {chamadoSel.concluida_em && (
          <div style={{
            background: `${C.success}15`,
            border: `1px solid ${C.success}40`,
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: 12,
            color: C.text,
          }}>
            ✅ <strong>OS concluída</strong> em {fmtD(chamadoSel.concluida_em)}
            {chamadoSel.concluida_por_nome && ` por ${chamadoSel.concluida_por_nome}`}
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap" }}>
              {chamadoSel.snapshot_total_aplicacoes != null && (
                <span>📦 {chamadoSel.snapshot_total_aplicacoes} aplicação(ões)</span>
              )}
              {Number(chamadoSel.snapshot_horas_reais) > 0 && (
                <span>⏱ {Number(chamadoSel.snapshot_horas_reais).toFixed(1)}h-homem realizadas</span>
              )}
              {Number(chamadoSel.snapshot_custo_materiais) > 0 && (
                <span>💰 R$ {Number(chamadoSel.snapshot_custo_materiais).toFixed(2)} em materiais</span>
              )}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>DETALHES DA ORDEM DE SERVIÇO</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.accent, fontFamily: "'IBM Plex Mono',monospace", marginBottom: 4 }}>{chamadoSel.numero}</div>
              <div style={{ fontSize: 14, color: C.text }}>{equipamento?.nome || "Equipamento não informado"}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{ ...s.tag(urgenciaCfg.c), fontSize: 10 }}>{urgenciaCfg.l}</span>
                <span style={{ ...s.tag(categoriaCfg.c), fontSize: 10 }}>{categoriaCfg.l}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>ABERTO EM</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{fmtD(chamadoSel.aberto_em)}</div>
              {(chamadoSel.data_inicio_prevista || chamadoSel.data_fim_prevista) && (
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                  Previsto: {chamadoSel.data_inicio_prevista ? fmtD(chamadoSel.data_inicio_prevista) : "—"} → {chamadoSel.data_fim_prevista ? fmtD(chamadoSel.data_fim_prevista) : "—"}
                </div>
              )}
            </div>
          </div>

          {/* Badge simples de RC/RM geradas a partir desta OS — ver comentário acima */}
          {temVinculo && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              {rcNoTopo && rcNoTopo.numero && (
                <span style={{ ...s.tag(C.accent), fontSize: 10 }}>📄 RC gerada: {rcNoTopo.numero}</span>
              )}
              {rmsVinculadas.map(rm => (
                <span key={rm.id} style={{ ...s.tag(C.accent), fontSize: 10 }}>📄 RM gerada: {rm.numero || `#${rm.id}`}</span>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...s.card, padding: "16px 18px", marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", marginBottom: 12 }}>ITENS DA OS</div>
          {numerados.length === 0 ? (
            <div style={{ color: C.muted, fontSize: 12 }}>Nenhum item cadastrado</div>
          ) : (
            numerados.map((item) => {
              const cancelado = item.status === "cancelado";
              const isMaterial = item.tipo === "material";
            if (isMaterial) {
              const est = estoqueCfg[item.status_estoque] || estoqueCfg.nao_verificado;
              const statusAplic = derivarStatusAplicacao(item);
              const cfgAplic = aplicacaoCfg[statusAplic];
              const qtdPlanejada = Number(item.quantidade) || 0;
              const qtdAplicada = Number(item.quantidade_aplicada) || 0;
              const qtdPendente = Math.max(0, qtdPlanejada - qtdAplicada);
              const temPendencia = qtdPendente > 0 && statusAplic !== "nao_aplicado";
              const historicoAberto = expandidoHistorico[item.id];
              const hist = historicoPorItem[item.id];

              return (
                <div key={item.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 10, opacity: cancelado ? 0.5 : 1 }}>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>#{item.numeroExibicao}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text, textDecoration: cancelado ? "line-through" : "none" }}>📦 {item.item_nome}</span>
                      {item.codigo && <span style={{ fontSize: 10, color: C.muted, fontFamily: "'IBM Plex Mono',monospace" }}>{item.codigo}</span>}
                      {item.serializado && <span style={{ ...s.tag("#a855f7"), fontSize: 9 }}>🔢 SERIALIZADO</span>}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span title={est.label} style={{ fontSize: 14, cursor: "help" }}>{est.icon}</span>
                      <span style={{ ...s.tag(cfgAplic.c), fontSize: 10 }}>{cfgAplic.icon} {cfgAplic.label}</span>
                    </div>
                  </div>

                  {item.requisicao_material?.numero && (
                    <div style={{ fontSize: 10, color: C.accent, marginBottom: 8 }}>↳ RM vinculada: {item.requisicao_material.numero}</div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 11, marginBottom: 10 }}>
                    <div style={{ background: C.bg, borderRadius: 6, padding: "6px 10px" }}>
                      <div style={{ color: C.muted, fontSize: 10 }}>PLANEJADO</div>
                      <div style={{ color: C.text, fontWeight: 600 }}>{qtdPlanejada} un</div>
                    </div>
                    <div style={{ background: `${cfgAplic.c}11`, borderRadius: 6, padding: "6px 10px" }}>
                      <div style={{ color: C.muted, fontSize: 10 }}>APLICADO</div>
                      <div style={{ color: cfgAplic.c, fontWeight: 600 }}>{qtdAplicada} un</div>
                    </div>
                    <div style={{ background: temPendencia ? "#f59e0b11" : C.bg, borderRadius: 6, padding: "6px 10px" }}>
                      <div style={{ color: C.muted, fontSize: 10 }}>PENDENTE</div>
                      <div style={{ color: temPendencia ? "#f59e0b" : C.text, fontWeight: 600 }}>{qtdPendente} un</div>
                    </div>
                  </div>

                  {!cancelado && !chamadoSel.concluida_em && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {temPendencia && (
                        <button
                          onClick={() => setModalAplicacao({ item })}
                          style={{ ...s.btn(true), padding: "6px 12px", fontSize: 11 }}>
                          ✅ Confirmar aplicação
                        </button>
                      )}
                      {!temPendencia && qtdAplicada > 0 && statusAplic === "aplicado" && (
                        <span style={{ fontSize: 11, color: C.success, padding: "6px 0" }}>✅ Consumo completo</span>
                      )}
                      <button
                        onClick={async () => {
                          const abrindo = !historicoAberto;
                          setExpandidoHistorico(prev => ({ ...prev, [item.id]: abrindo }));
                          if (abrindo) {   // ← sempre refetch, em vez de só na primeira vez
                            setHistoricoPorItem(prev => ({ ...prev, [item.id]: { carregando: true, aplicacoes: [] } }));
                            try {
                              const h = await listarHistorico(chamadoSel.id, item.id);
                              setHistoricoPorItem(prev => ({ ...prev, [item.id]: { carregando: false, aplicacoes: h.aplicacoes || [] } }));
                            } catch (e) {
                              setHistoricoPorItem(prev => ({ ...prev, [item.id]: { carregando: false, aplicacoes: [] } }));
                            }
                          }
                        }}
                        style={{ ...s.btn(false), padding: "6px 12px", fontSize: 11 }}>
                        {historicoAberto ? "▼" : "▶"} Histórico ({hist?.aplicacoes?.length || 0})
                      </button>
                    </div>
                  )}

                  {historicoAberto && (
                    <div style={{ marginTop: 10, background: C.bg, borderRadius: 6, padding: "10px 12px", fontSize: 11 }}>
                      {hist?.carregando ? (
                        <div style={{ color: C.muted }}>Carregando...</div>
                      ) : (hist?.aplicacoes?.length || 0) === 0 ? (
                        <div style={{ color: C.muted }}>Nenhum registro ainda.</div>
                      ) : (
                        hist.aplicacoes.map(ap => (
                          <div key={ap.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}22`, opacity: ap.tipo_evento === "reversao" ? 0.6 : 1 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: C.text, fontSize: 12 }}>
                                {ap.tipo_evento === "reversao" ? "🔁 REVERSÃO · " : "✅ APLICAÇÃO · "}
                                <strong>{ap.quantidade}</strong> un
                              </div>
                              {ap.origem_lastro && ap.origem_lastro !== "rm" && (
                                <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 2 }}>
                                  ⚠ {ap.origem_lastro === "emergencial" ? "Emergencial" : "Estoque próprio"}
                                  {ap.motivo_emergencia && ` · ${ap.motivo_emergencia}`}
                                  {ap.valor_estimado != null && ` · R$ ${Number(ap.valor_estimado).toFixed(2)}`}
                                </div>
                              )}
                              {ap.numeros_serie?.length > 0 && (
                                <div style={{ color: C.accent, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, marginTop: 2 }}>
                                  SN: {ap.numeros_serie.join(", ")}
                                </div>
                              )}
                              {ap.lote && <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>Lote: {ap.lote}</div>}
                              {ap.observacoes && (
                                <div style={{
                                  marginTop: 4,
                                  padding: "6px 10px",
                                  background: `${C.accent}10`,
                                  borderLeft: `2px solid ${C.accent}`,
                                  borderRadius: 3,
                                  fontSize: 10,
                                  color: C.text,
                                  fontStyle: "italic",
                                }}>
                                  💬 {ap.observacoes}
                                </div>
                              )}                  {ap.motivo_reversao && <div style={{ color: "#ef4444", fontSize: 10, marginTop: 2 }}>Motivo reversão: {ap.motivo_reversao}</div>}
                              <div style={{ color: C.muted, fontSize: 10, marginTop: 3 }}>
                                👤 {ap.operador_nome || ap.operador_email || "—"} · {fmtD(ap.data_evento)}
                              </div>
                            </div>
                            {/* ▼▼▼ NOVO: botão Reverter ▼▼▼ */}
                            {ap.tipo_evento === "aplicacao"
                            && ap.pode_reverter !== false
                            && !cancelado
                            && !chamadoSel.concluida_em && (
                              <button
                                onClick={() => setModalReversao({
                                  aplicacaoId: ap.id,
                                  chamadoItemId: item.id,
                                  itemNome: item.item_nome,
                                  quantidade: ap.quantidade,
                                  numerosSerie: ap.numeros_serie || [],
                                  motivo: "",
                                  observacoes: "",
                                  erro: null,
                                })}
                                style={{ background: "transparent", border: "1px solid #ef4444",
                                        borderRadius: 4, color: "#ef4444", fontSize: 10,
                                        cursor: "pointer", padding: "4px 8px",
                                        fontFamily: "inherit", flexShrink: 0 }}>
                                Reverter
                              </button>
                            )}
                            {/* ▲▲▲ FIM DO NOVO ▲▲▲ */}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            }
              const calcPlanejado = calcularHorasHomem(item.data_inicio_prevista, item.data_fim_prevista, item.qtd_pessoas_planejada);
              const calcReal = item.apontamento ? calcularHorasHomem(item.apontamento.data_inicio_real, item.apontamento.data_fim_real, item.apontamento.pessoas_reais) : null;
              return (
                <div key={item.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 10, opacity: cancelado ? 0.5 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>#{item.numeroExibicao}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, textDecoration: cancelado ? "line-through" : "none" }}>🛠 {item.nome}</div>
                        {item.descricao && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{item.descricao}</div>}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: C.muted }}>{item.origem === "adicionado" ? "Adicionado" : cancelado ? "Cancelado" : "Planejado"}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 11 }}>
                    <div style={{ background: C.bg, borderRadius: 6, padding: "8px 10px" }}>
                      <div style={{ color: C.muted, marginBottom: 2 }}>PLANEJADO</div>
                      <div style={{ color: C.text }}>{item.qtd_pessoas_planejada} pessoa(s){calcPlanejado && ` · ${calcPlanejado.horasHomem}h-homem`}</div>
                      <div style={{ color: C.muted, marginTop: 2 }}>{item.data_inicio_prevista ? fmtD(item.data_inicio_prevista) : "—"} → {item.data_fim_prevista ? fmtD(item.data_fim_prevista) : "—"}</div>
                    </div>
                    <div style={{ background: item.apontamento ? `${C.success}11` : C.bg, borderRadius: 6, padding: "8px 10px" }}>
                      <div style={{ color: C.muted, marginBottom: 2 }}>REALIZADO</div>
                      {item.apontamento ? (
                        <>
                          <div style={{ color: C.text }}>{item.apontamento.pessoas_reais} pessoa(s){calcReal && ` · ${calcReal.horasHomem}h-homem`}{Number(item.apontamento.horas_extras) > 0 && ` (+${item.apontamento.horas_extras}h extra)`}</div>
                          <div style={{ color: C.muted, marginTop: 2 }}>{item.apontamento.data_inicio_real ? fmtD(item.apontamento.data_inicio_real) : "—"} → {item.apontamento.data_fim_real ? fmtD(item.apontamento.data_fim_real) : "—"}</div>
                        </>
                      ) : <div style={{ color: C.muted }}>Ainda não apontado</div>}
                    </div>
                  </div>
                  {!cancelado && !chamadoSel.concluida_em && !chamadoSel.cancelada_em && (
                    <button onClick={() => setModalApontamento({ servicoId: item.id })}
                      style={{ ...s.btn(true), padding: "6px 12px", fontSize: 10, marginTop: 10 }}>
                      {item.apontamento_resumo?.total_sessoes > 0
                        ? "✏️ Gerenciar apontamentos"
                        : "📝 Lançar apontamento"}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {chamadoSel.descricao_geral && (
          <div style={{ ...s.card, padding: "16px 18px", marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: C.muted }}>OBSERVAÇÕES GERAIS</div>
            <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>{chamadoSel.descricao_geral}</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          
          {!chamadoSel.concluida_em && (
            <button
              onClick={() => {
                const materiais = numerados.filter(it => it.tipo === "material" && it.status !== "cancelado");
                const servicos  = numerados.filter(it => it.tipo === "servico" && it.status !== "cancelado");
                const aplicados = materiais.filter(m => m.status_aplicacao === "aplicado").length;
                const naoAplicados = materiais.filter(m => m.status_aplicacao === "nao_aplicado").length;

                const materiaisPendentes = materiais.filter(m => {
                  const ap = Number(m.quantidade_aplicada) || 0;
                  const pl = Number(m.quantidade) || 0;
                  return m.status_aplicacao !== "nao_aplicado" && ap < pl;
                });

                const servicosSemApontamento = servicos.filter(s => !s.apontamento);

                // Sempre abre o modal. A decisão de bloquear ou não fica
                // dentro dele — evita alternar entre dialog nativo e modal
                // (inconsistência visual reportada durante os testes).
                setModalConclusao({
                  resumo: {
                    materiais_aplicados: aplicados,
                    materiais_nao_aplicados: naoAplicados,
                    materiais_pendentes: materiaisPendentes.map(m => ({
                      numero_exibicao: m.numeroExibicao,
                      item_nome: m.item_nome,
                      quantidade: m.quantidade,
                      quantidade_aplicada: m.quantidade_aplicada,
                    })),
                    servicos_sem_apontamento: servicosSemApontamento.length,
                    servicos_pendentes_lista: servicosSemApontamento.map(s => ({
                      numero_exibicao: s.numeroExibicao,
                      nome: s.nome,
                    })),
                    horas_planejadas: 0,
                    horas_reais: 0,
                  },
                  confirmouServicosPendentes: false,
                  erro: null,
                });
              }}
              style={{ ...s.btn(true), padding: "9px 20px", fontSize: 12,
                      background: C.success, border: `1px solid ${C.success}` }}>
              ✅ Concluir OS
            </button>
          )}
          
          {!chamadoSel.concluida_em && !chamadoSel.cancelada_em && (
            <>
              <button
                onClick={() => {
                  const itensForm = linhas.map(it => it.tipo === "material" ? {
                    ...novoMaterial(it.origem || "planejado"), id: it.id, numero_base: it.numero_base ?? null, status: it.status || "ativo",
                    item_nome: it.item_nome || "", codigo: it.codigo || "", item_catalogo_id: it.item_catalogo_id || null,
                    quantidade: it.quantidade || 1, tipo_item: it.tipo_item || "", descricao: it.descricao || "",
                    status_estoque: it.status_estoque || "nao_verificado", saldo_disponivel: it.saldo_disponivel ?? null,
                  } : {
                    ...novoServico(it.origem || "planejado"), id: it.id, numero_base: it.numero_base ?? null, status: it.status || "ativo",
                    nome: it.nome || "", descricao: it.descricao || "", qtd_pessoas_planejada: it.qtd_pessoas_planejada || 1,
                    data_inicio_prevista: paraDatetimeLocal(it.data_inicio_prevista), data_fim_prevista: paraDatetimeLocal(it.data_fim_prevista),
                    apontamento: it.apontamento || null,
                  });

                  const modoInferido = chamadoSel.modo_programacao
                    || (calcularJanelaAutomatica(itensForm) ? "detalhada"
                      : (chamadoSel.data_inicio_prevista || chamadoSel.data_fim_prevista) ? "geral"
                      : "nenhuma");
                  setForm({
                    equipamentoId: chamadoSel.equipamento_id || "",
                    descricaoGeral: chamadoSel.descricao_geral || chamadoSel.descricao || "",
                    servico_nome: chamadoSel.servico_nome || "",
                    urgencia: chamadoSel.urgencia || "media",
                    categoria: chamadoSel.categoria || "corretiva",
                    itens: itensForm,
                    dataInicioPrevista: paraDatetimeLocal(chamadoSel.data_inicio_prevista),
                    dataFimPrevista: paraDatetimeLocal(chamadoSel.data_fim_prevista),
                    modoProgramacao: modoInferido,
                  });
                  setEqSearch("");
                  setModal("editar");
                }}
                style={{ ...s.btn(true), padding: "9px 20px", fontSize: 12 }}
              >✏️ Editar</button>
              <button
                onClick={() => { if (window.confirm("Tem certeza que deseja excluir esta OS?")) deletar(chamadoSel.id).then(() => setTelaAtual("lista")); }}
                style={{ ...s.btn(false), padding: "9px 20px", fontSize: 12, border: "1px solid #ef4444", color: "#ef4444" }}
              >🗑 Deletar</button>
              <button
                onClick={() => setModalCancelamento({ salvando: false })}
                style={{ ...s.btn(false), padding: "9px 20px", fontSize: 12,
                border: "1px solid #f59e0b", color: "#f59e0b" }}
              >⚠️ Cancelar OS</button>
              <button
                onClick={() => setModalSalvarTemplate({
                  nome: chamadoSel.servico_nome || "",
                  descricao: chamadoSel.descricao_geral || "",
                  erro: null,
                  salvando: false,
                })}
                style={{ ...s.btn(false), padding: "9px 20px", fontSize: 12 }}>
                📋 Salvar como modelo
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}