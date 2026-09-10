// frontend/src/components/chamados/TelaChamadosNova.jsx

import { useState, useEffect, useRef, useCallback } from "react";
import { useChamados } from "../../hooks/useChamados";
import { useEquipamentos } from "../../hooks/useEquipamentos";
import { useCatalogo } from '../../hooks/useCatalogo';
import apiService from "../../services/apiService";

// ─────────────────────────────────────────────────────────────────────────
// HOOK: useEstoque — isolado de propósito, é a única parte do arquivo que
// fala com endpoints que ainda não existem no backend.
// ─────────────────────────────────────────────────────────────────────────
function useEstoque() {
  const [consultando, setConsultando] = useState({});

  const consultarSaldo = useCallback(async (itemCatalogoId, quantidadeNecessaria) => {
    if (!itemCatalogoId) return { status: "nao_verificado", disponivel: null };
    setConsultando(prev => ({ ...prev, [itemCatalogoId]: true }));
    try {
      // TODO(backend): GET /estoque/saldo?item_catalogo_id=X -> { disponivel, reservado, fisico }
      const resp = await apiService.get('/estoque/saldo', { params: { item_catalogo_id: itemCatalogoId } });
      const disponivel = resp?.disponivel ?? 0;
      const qtd = Number(quantidadeNecessaria) || 1;
      let status = "sem_estoque";
      if (disponivel >= qtd) status = "atende";
      else if (disponivel > 0) status = "parcial";
      return { status, disponivel };
    } catch (err) {
      console.warn("⚠️ /estoque/saldo indisponível:", err.message);
      return { status: "nao_verificado", disponivel: null };
    } finally {
      setConsultando(prev => ({ ...prev, [itemCatalogoId]: false }));
    }
  }, []);

  const reservar = useCallback(async (itemCatalogoId, quantidade, chamadoId) => {
    try {
      // TODO(backend): POST /estoque/reservas { item_catalogo_id, quantidade, chamado_id }
      return await apiService.post('/estoque/reservas', { item_catalogo_id: itemCatalogoId, quantidade, chamado_id: chamadoId });
    } catch (err) {
      console.warn("⚠️ /estoque/reservas indisponível:", err.message);
      return null;
    }
  }, []);

  return { consultando, consultarSaldo, reservar };
}

const estoqueCfg = {
  atende:         { icon: "🟢", label: "Estoque atende à demanda" },
  parcial:        { icon: "🟡", label: "Estoque atende parcialmente" },
  sem_estoque:    { icon: "🔴", label: "Sem estoque — necessário comprar" },
  nao_verificado: { icon: "⚪", label: "Selecione um item do catálogo para verificar o estoque" },
};

const urgenciaCfgMap = { alta: { l: "Alta", c: "#ef4444" }, media: { l: "Média", c: "#f59e0b" }, baixa: { l: "Baixa", c: "#22c55e" } };
const categoriaCfgMap = { corretiva: { l: "Corretiva", c: "#ef4444" }, preventiva: { l: "Preventiva", c: "#22c55e" }, preditiva: { l: "Preditiva", c: "#60a5fa" } };

// ─────────────────────────────────────────────────────────────────────────
// Fábricas de item — modelo unificado (discriminado por `tipo`)
// ─────────────────────────────────────────────────────────────────────────
function novoMaterial(origem) {
  return {
    id: Date.now() + Math.random(),
    tipo: "material",
    origem,               // "planejado" | "adicionado" — congelado, nunca muda
    numero_base: null,    // inteiro congelado na emissão (só para origem="planejado")
    status: "ativo",      // "ativo" | "cancelado"
    item_nome: "", codigo: "", item_catalogo_id: null,
    quantidade: 1, tipo_item: "", descricao: "",
    status_estoque: "nao_verificado", saldo_disponivel: null,
  };
}

function novoServico(origem) {
  return {
    id: Date.now() + Math.random(),
    tipo: "servico",
    origem,
    numero_base: null,
    status: "ativo",
    nome: "", descricao: "",
    qtd_pessoas_planejada: 1,
    data_inicio_prevista: "", data_fim_prevista: "",
    apontamento: null, // { pessoas_reais, data_inicio_real, data_fim_real, horas_extras }
  };
}

// Horas-homem: sempre derivadas de (pessoas × duração), nunca digitadas.
function calcularHorasHomem(dataInicio, dataFim, qtdPessoas) {
  if (!dataInicio || !dataFim || !qtdPessoas) return null;
  const ini = new Date(dataInicio);
  const fim = new Date(dataFim);
  const diffMs = fim - ini;
  if (isNaN(diffMs) || diffMs <= 0) return null;
  const horasCorridas = diffMs / (1000 * 60 * 60);
  return {
    horasCorridas: Number(horasCorridas.toFixed(1)),
    horasHomem: Number((horasCorridas * qtdPessoas).toFixed(1)),
  };
}

function computarNumeracao(itens) {
  let ultimoBase = 0;
  let contadorSufixo = 0;
  return itens.map(item => {
    if (item.origem === "planejado" && item.numero_base != null) {
      ultimoBase = item.numero_base;
      contadorSufixo = 0;
      return { ...item, numeroExibicao: String(item.numero_base) };
    }
    contadorSufixo += 1;
    return { ...item, numeroExibicao: `${ultimoBase}.${contadorSufixo}` };
  });
}

// primeiro salvamento.
function numerarRascunho(itens) {
  return itens.map((item, i) => ({ ...item, numeroExibicao: String(i + 1) }));
}

function calcularJanelaAutomatica(itens) {
  const datas = itens
    .filter(it => it.tipo === "servico" && it.status !== "cancelado")
    .flatMap(it => [it.data_inicio_prevista, it.data_fim_prevista].filter(Boolean));
  if (datas.length === 0) return null;
  const ordenadas = datas.map(d => new Date(d)).sort((a, b) => a - b);
  return {
    inicio: itens.filter(it => it.tipo === "servico" && it.data_inicio_prevista).map(it => it.data_inicio_prevista).sort()[0] || null,
    fim: itens.filter(it => it.tipo === "servico" && it.data_fim_prevista).map(it => it.data_fim_prevista).sort().slice(-1)[0] || null,
  };
}

function janelaValida(inicio, fim) {
  if (!inicio || !fim) return true;
  return new Date(fim) >= new Date(inicio);
}

function paraDatetimeLocal(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function paraISOComOffset(datetimeLocalStr) {
  if (!datetimeLocalStr) return null;
  const d = new Date(datetimeLocalStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function TelaChamadosNova({ fmtBRL, fmtD, C, s }) {
  const { chamados, loading, erro, carregar, criar, atualizar, deletar } = useChamados();
  const { equipamentos } = useEquipamentos();
  const { itens: catalogoItens } = useCatalogo();
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
  const [apontamentoForm, setApontamentoForm] = useState({ pessoas_reais: 1, data_inicio_real: "", data_fim_real: "", horas_extras: 0 });

  const [pendingFocusId, setPendingFocusId] = useState(null);

  useEffect(() => { carregar(); }, []);

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

  // Busca de sugestões no catálogo (lógica original preservada)
  function buscarSugestoesItem(termo, itemId) {
    if (termo.trim().length < 2) {
      setItemSugestoes(prev => ({ ...prev, [itemId]: [] }));
      setShowSugestoes(prev => ({ ...prev, [itemId]: false }));
      return;
    }
    const normalizarTexto = (texto) => texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const calcularSimilaridade = (str1, str2) => {
      const n1 = normalizarTexto(str1);
      const n2 = normalizarTexto(str2);
      if (n1 === n2) return 100;
      if (!n1 || !n2) return 0;
      const len1 = n1.length, len2 = n2.length;
      const matriz = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(0));
      for (let i = 0; i <= len1; i++) matriz[0][i] = i;
      for (let j = 0; j <= len2; j++) matriz[j][0] = j;
      for (let j = 1; j <= len2; j++) {
        for (let i = 1; i <= len1; i++) {
          const cost = n1[i - 1] === n2[j - 1] ? 0 : 1;
          matriz[j][i] = Math.min(matriz[j][i - 1] + 1, matriz[j - 1][i] + 1, matriz[j - 1][i - 1] + cost);
        }
      }
      const maxLen = Math.max(len1, len2);
      const distancia = matriz[len2][len1];
      return Math.max(0, Math.min(100, ((maxLen - distancia) / maxLen) * 100));
    };
    const termoBuscado = normalizarTexto(termo);
    const termoOriginal = termo.toLowerCase();
    const porInclusao = catalogoItens.filter(item => {
      const nomeNorm = normalizarTexto(item.nome);
      const nomeLower = item.nome.toLowerCase();
      return nomeNorm.includes(termoBuscado) || nomeLower.includes(termoOriginal);
    });
    let sugestoes;
    if (porInclusao.length > 0) {
      sugestoes = porInclusao.map(item => ({ ...item, similaridade: calcularSimilaridade(termo, item.nome), tipo: 'inclusao' }))
        .sort((a, b) => b.similaridade - a.similaridade).slice(0, 5);
    } else {
      sugestoes = catalogoItens.map(item => ({ ...item, similaridade: calcularSimilaridade(termo, item.nome), tipo: 'levenshtein' }))
        .filter(item => item.similaridade >= 40).sort((a, b) => b.similaridade - a.similaridade).slice(0, 5);
    }
    setItemSugestoes(prev => ({ ...prev, [itemId]: sugestoes }));
    setShowSugestoes(prev => ({ ...prev, [itemId]: sugestoes.length > 0 }));
  }

  async function selecionarSugestao(itemId, nomeItem, catalogoId) {
    atualizarItem(itemId, "item_nome", nomeItem);
    atualizarItem(itemId, "item_catalogo_id", catalogoId);
    setItemSugestoes(prev => ({ ...prev, [itemId]: [] }));
    setShowSugestoes(prev => ({ ...prev, [itemId]: false }));
    const item = form.itens.find(m => m.id === itemId);
    const { status, disponivel } = await consultarSaldo(catalogoId, item?.quantidade || 1);
    setForm(f => ({ ...f, itens: f.itens.map(m => m.id === itemId ? { ...m, status_estoque: status, saldo_disponivel: disponivel } : m) }));
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

  const chamadosFiltered = (chamados || [])
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
        alert("Chamado atualizado com sucesso!");
      } else {
        const resposta = await criar(payload);
        await carregar();
        for (const it of itensComNumero) {
          if (it.tipo === "material" && it.item_catalogo_id && it.status_estoque !== "sem_estoque") {
            // eslint-disable-next-line no-await-in-loop
            await reservar(it.item_catalogo_id, it.quantidade, resposta?.id);
          }
        }
        alert("Chamado criado com sucesso!");
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

  function abrirModalApontamento(servico) {
    setApontamentoForm({
      pessoas_reais: servico.apontamento?.pessoas_reais || servico.qtd_pessoas_planejada || 1,
      data_inicio_real: paraDatetimeLocal(servico.apontamento?.data_inicio_real),
      data_fim_real: paraDatetimeLocal(servico.apontamento?.data_fim_real),
      horas_extras: servico.apontamento?.horas_extras || 0,
    });
    setModalApontamento({ servicoId: servico.id });
  }

  async function salvarApontamento() {
    if (!chamadoSel) return;
    const itensAtualizados = (chamadoSel.itens || []).map(it =>
      it.id === modalApontamento.servicoId ? { ...it, apontamento: { ...apontamentoForm } } : it
    );
    setChamadoSel(prev => ({ ...prev, itens: itensAtualizados }));

    try {
      await apiService.post(`/cotacoes/chamados/${chamadoSel.id}/apontamentos`, {
        servico_id: modalApontamento.servicoId,
        pessoas_reais: parseInt(apontamentoForm.pessoas_reais) || 1,
        data_inicio_real: paraISOComOffset(apontamentoForm.data_inicio_real),
        data_fim_real: paraISOComOffset(apontamentoForm.data_fim_real),
        horas_extras: parseFloat(apontamentoForm.horas_extras) || 0,
      });
    } catch (e) {
      alert("O apontamento ficou salvo só nesta tela — não foi possível gravar no servidor: " + e.message);
    }
    setModalApontamento(null);
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
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
              {modal === "novo" ? "Nova Ordem de Serviço" : "Editar Ordem de Serviço"}
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
                              {showSugestoes[item.id] && itemSugestoes[item.id]?.length > 0 && (
                                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: C.bg, border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 6px 6px", zIndex: 100, maxHeight: 180, overflowY: "auto", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
                                  {itemSugestoes[item.id].map(sug => (
                                    <div key={sug.id} onClick={() => selecionarSugestao(item.id, sug.nome, sug.id)} style={{ padding: "10px 12px", cursor: "pointer", borderBottom: `1px solid ${C.border}22`, fontSize: 12 }}
                                      onMouseEnter={e => e.currentTarget.style.background = "#1e2a3f"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                      <div style={{ color: C.text, fontWeight: 500 }}>{sug.nome}</div>
                                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sug.categoria}</div>
                                    </div>
                                  ))}
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
  // MODAL DE APONTAMENTO DE EXECUÇÃO
  // ─────────────────────────────────────────────────────────────────────────
  if (modalApontamento) {
    const servico = (chamadoSel?.itens || []).find(it => it.id === modalApontamento.servicoId);
    const calc = calcularHorasHomem(apontamentoForm.data_inicio_real, apontamentoForm.data_fim_real, apontamentoForm.pessoas_reais);
    const calcPlanejado = servico ? calcularHorasHomem(servico.data_inicio_prevista, servico.data_fim_prevista, servico.qtd_pessoas_planejada) : null;

    return (
      <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 320, padding: 20 }}>
        <div style={{ ...s.card, width: 480, maxWidth: "100%", boxShadow: "0 24px 48px #00000060" }}>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Apontamento de execução</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{servico?.nome}</div>
          </div>
          <div style={{ padding: "18px 22px" }}>
            {calcPlanejado && (
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 14, background: C.bg, borderRadius: 6, padding: "8px 10px" }}>
                Planejado: {servico.qtd_pessoas_planejada} pessoa(s) · {calcPlanejado.horasHomem}h-homem
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={s.label}>PESSOAS QUE EXECUTARAM</label>
                <input type="number" min="1" value={apontamentoForm.pessoas_reais} onChange={e => setApontamentoForm(f => ({ ...f, pessoas_reais: e.target.value }))} style={{ ...s.input, textAlign: "center" }} />
              </div>
              <div>
                <label style={s.label}>HORAS EXTRAS</label>
                <input type="number" min="0" step="0.5" value={apontamentoForm.horas_extras} onChange={e => setApontamentoForm(f => ({ ...f, horas_extras: e.target.value }))} style={{ ...s.input, textAlign: "center" }} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={s.label}>INÍCIO REAL</label>
                <input type="datetime-local" value={apontamentoForm.data_inicio_real} onChange={e => setApontamentoForm(f => ({ ...f, data_inicio_real: e.target.value }))} style={s.input} />
              </div>
              <div>
                <label style={s.label}>FIM REAL</label>
                <input type="datetime-local" value={apontamentoForm.data_fim_real} onChange={e => setApontamentoForm(f => ({ ...f, data_fim_real: e.target.value }))} style={s.input} />
              </div>
            </div>
            {calc && (
              <div style={{ fontSize: 11, color: C.success, background: `${C.success}15`, borderRadius: 6, padding: "8px 10px" }}>
                ⏱ {calc.horasCorridas}h corridas × {apontamentoForm.pessoas_reais} pessoa(s) = <strong>{calc.horasHomem}h-homem realizadas</strong>
                {Number(apontamentoForm.horas_extras) > 0 && ` (+ ${apontamentoForm.horas_extras}h extras)`}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, padding: "14px 22px", borderTop: `1px solid ${C.border}` }}>
            <button onClick={() => setModalApontamento(null)} style={{ ...s.btn(false), flex: 1, padding: "8px 16px" }}>Cancelar</button>
            <button onClick={salvarApontamento} style={{ ...s.btn(true), flex: 1, padding: "8px 16px" }}>Salvar apontamento</button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LISTA DE CHAMADOS
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
            {[{ id: "todos", label: "Todos" }, { id: "aberto", label: "Aberto" }, { id: "cotando", label: "Cotando" }, { id: "finalizado", label: "Finalizado" }].map(f => (
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 120px 100px 80px 80px 100px", padding: "10px 18px", background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, letterSpacing: "0.08em" }}>
              <span>NÚMERO</span><span>DESCRIÇÃO</span><span>DATA ABERTURA</span><span>URGÊNCIA</span><span>CATEGORIA</span><span>STATUS</span><span></span>
            </div>
            {chamadosFiltered.map((chamado, i) => {
              const linhas = chamado.itens || [...(chamado.materiais || []), ...(chamado.servicos || [])];
              const nomeExibicao = chamado.servico_nome || chamado.descricao || (chamado.peca || "—");
              const totalLinhas = linhas.length;
              const totalAtivos = linhas.filter(it => it.status !== "cancelado").length;

              const statusCfg = {
                aberto: { l: "Aberto", c: C.muted }, cotando: { l: "Cotando", c: C.warn },
                finalizado: { l: "Finalizado", c: C.success }, aguardando_cotacao: { l: "Aguardando Cotação", c: C.warn },
              }[chamado.status] || { l: chamado.status, c: C.muted };
              const urgenciaCfg = urgenciaCfgMap[chamado.urgencia] || { l: chamado.urgencia, c: C.muted };
              const categoriaCfg = categoriaCfgMap[chamado.categoria] || { l: chamado.categoria, c: C.muted };

              return (
                <div key={chamado.id} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 120px 100px 80px 80px 100px", padding: "13px 18px", borderBottom: i < chamadosFiltered.length - 1 ? `1px solid ${C.border}22` : "none", alignItems: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>
                    {chamado.numero}
                    {totalLinhas > 1 && <span style={{ fontSize: 9, color: C.muted, marginLeft: 4 }}>({totalAtivos}/{totalLinhas} itens)</span>}
                  </div>
                  <div><div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{nomeExibicao}</div></div>
                  <div style={{ fontSize: 11, color: C.muted }}>{fmtD(chamado.aberto_em)}</div>
                  <div style={{ ...s.tag(urgenciaCfg.c), fontSize: 10 }}>{urgenciaCfg.l}</div>
                  <div style={{ ...s.tag(categoriaCfg.c), fontSize: 10 }}>{categoriaCfg.l}</div>
                  <div style={{ ...s.tag(statusCfg.c), fontSize: 10 }}>{statusCfg.l}</div>
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
      .map(it => it.tipo === "servico" && it.nome === undefined ? { ...it, nome: it.item_nome || "" } : it);
    const numerados = computarNumeracao(linhas);
    const urgenciaCfg = urgenciaCfgMap[chamadoSel.urgencia] || { l: chamadoSel.urgencia, c: C.muted };
    const categoriaCfg = categoriaCfgMap[chamadoSel.categoria] || { l: chamadoSel.categoria, c: C.muted };

    return (
      <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
        <button onClick={() => { setTelaAtual("lista"); setChamadoSel(null); }} style={{ background: "transparent", border: "none", color: C.accent, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 16 }}>← Voltar para OS</button>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>DETALHES DA ORDEM DE SERVIÇO</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.accent, fontFamily: "'IBM Plex Mono',monospace", marginBottom: 4 }}>{chamadoSel.numero}</div>
              <div style={{ fontSize: 14, color: C.text }}>{equipamento?.nome || "Equipamento não informado"}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
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
                return (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderBottom: `1px solid ${C.border}22`, opacity: cancelado ? 0.5 : 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, fontFamily: "'IBM Plex Mono',monospace", width: 36 }}>#{item.numeroExibicao}</span>
                    <span style={{ fontSize: 14 }} title={est.label}>{est.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: C.text, textDecoration: cancelado ? "line-through" : "none" }}>📦 {item.item_nome}</div>
                      {item.codigo && <div style={{ fontSize: 10, color: C.muted }}>{item.codigo}</div>}
                    </div>
                    <div style={{ fontSize: 12, color: C.text }}>Qtd: {item.quantidade}</div>
                    <div style={{ fontSize: 10, color: C.muted, width: 80, textAlign: "right" }}>
                      {item.origem === "adicionado" ? "Adicionado" : cancelado ? "Cancelado" : "Planejado"}
                    </div>
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
                  {!cancelado && (
                    <button onClick={() => abrirModalApontamento(item)} style={{ ...s.btn(true), padding: "6px 12px", fontSize: 10, marginTop: 10 }}>
                      {item.apontamento ? "✏️ Editar apontamento" : "📝 Lançar apontamento"}
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
        </div>
      </div>
    );
  }

  return null;
}