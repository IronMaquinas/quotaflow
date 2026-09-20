// frontend/src/components/chamados/TelaChamadosNova.jsx
//
// ─────────────────────────────────────────────────────────────────────────
// HISTÓRICO DESTE ARQUIVO (importante para quem for mexer depois)
// ─────────────────────────────────────────────────────────────────────────
// Este arquivo já foi a tela de criação de "chamados" completos (equipamento
// + materiais + serviços + apontamento de horas). Toda aquela lógica foi
// MOVIDA para TelaOrdemServico.jsx, que é hoje a tela "de verdade" para
// esse fluxo completo — leia o comentário de topo daquele arquivo para o
// histórico completo da separação.
//
// O NOME do arquivo continua TelaChamadosNova.jsx por decisão explícita
// (não renomear/apagar), mas o CONTEÚDO agora é outro: esta é a tela de
// Requisição de Compra (RC) — uma lista simples de materiais a comprar,
// sem equipamento, sem serviço, sem apontamento de execução. RC é sempre
// sobre "o que precisa ser comprado", nunca sobre "quem vai executar o quê
// e quando".
//
// RCs têm DUAS origens possíveis:
//   1) Manual — criada diretamente nesta tela, pelo comprador/almoxarife,
//      sem nenhuma OS por trás. Vai para o endpoint NOVO
//      POST /cotacoes/chamados/rc-manual (ver handleSubmit mais abaixo).
//      Esse endpoint AINDA NÃO EXISTE no backend no momento deste refactor
//      — o contrato de payload foi definido aqui no frontend e precisa ser
//      implementado do lado do servidor antes de ir para produção.
//   2) Automática — nascida do "split" que o backend já faz quando um item
//      de material de uma OS não tem estoque suficiente (ver
//      012_split_automatico_os_rm_rc.sql). Essas RCs chegam pela mesma
//      listagem (GET /cotacoes/chamados, filtrando tipo_documento =
//      'requisicao_material') e trazem `origem_os_id`/`origem_os_numero`
//      preenchidos. Quando esses campos são null, é uma RC manual.
//
// Esta tela NÃO cria nem edita OS. Para isso, use TelaOrdemServico.jsx.
// ─────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { useChamados } from "../../hooks/useChamados";
import apiService from "../../services/apiService";

// ─────────────────────────────────────────────────────────────────────────
// HOOK: useEstoque — mantido igual ao da TelaOrdemServico.jsx (mesma
// origem: TelaChamadosNova.jsx original). Continua útil aqui: mesmo numa
// RC manual, sem OS por trás, o comprador quer saber se já tem saldo antes
// de decidir comprar.
// ─────────────────────────────────────────────────────────────────────────
function useEstoque() {
  const [consultando, setConsultando] = useState({});

  const consultarSaldo = useCallback(async (itemCatalogoId, quantidadeNecessaria) => {
    if (!itemCatalogoId) return { status: "nao_verificado", disponivel: null };
    setConsultando(prev => ({ ...prev, [itemCatalogoId]: true }));
    try {
      // TODO(backend): GET /estoque/saldo?item_catalogo_id=X -> { disponivel, reservado, fisico }
      // apiService.get(endpoint, params) recebe os query params DIRETO (sem
      // wrapper { params: {...} } — isso é convenção do axios, não deste
      // apiService). Ver nota idêntica em TelaOrdemServico.jsx.
      const resp = await apiService.get('/estoque/saldo', { item_catalogo_id: itemCatalogoId });
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

  return { consultando, consultarSaldo };
}

const estoqueCfg = {
  atende:         { icon: "🟢", label: "Estoque atende à demanda" },
  parcial:        { icon: "🟡", label: "Estoque atende parcialmente" },
  sem_estoque:    { icon: "🔴", label: "Sem estoque — necessário comprar" },
  nao_verificado: { icon: "⚪", label: "Selecione um item da lista para verificar o estoque" },
  reconhecido_sem_estoque_local: { icon: "🔵", label: "Item reconhecido — sem controle de estoque local para ele" },
};

const urgenciaCfgMap = { alta: { l: "Alta", c: "#ef4444" }, media: { l: "Média", c: "#f59e0b" }, baixa: { l: "Baixa", c: "#22c55e" } };
const categoriaCfgMap = { corretiva: { l: "Corretiva", c: "#ef4444" }, preventiva: { l: "Preventiva", c: "#22c55e" }, preditiva: { l: "Preditiva", c: "#60a5fa" } };

// Fábrica de item de material — RC só tem material, então não existe mais
// discriminação por `tipo` aqui (era `tipo: "material" | "servico"` no
// arquivo original). Os campos e nomes de propriedade foram mantidos
// idênticos aos de lá para que o payload serializado fique compatível com
// o formato que o backend já espera para itens de material.
function novoMaterial() {
  return {
    id: Date.now() + Math.random(),
    tipo: "material",
    origem: "planejado", // congelado — RC manual não tem noção de "adicionado depois", é sempre um rascunho único até salvar
    numero_base: null,   // inteiro congelado na emissão, mesma lógica de numeração da OS
    status: "ativo",     // "ativo" | "cancelado"
    item_nome: "", codigo: "", item_catalogo_id: null,
    quantidade: 1, tipo_item: "", descricao: "",
    status_estoque: "nao_verificado", saldo_disponivel: null,
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

function numerarRascunho(itens) {
  return itens.map((item, i) => ({ ...item, numeroExibicao: String(i + 1) }));
}

export default function TelaChamadosNova({ fmtBRL, fmtD, C, s, equipamentos }) {
  // FIX (2026-09-11, Fase 2): useChamados() sem parâmetro carrega a lista
  // "padrão" do backend — e GET /cotacoes/chamados usa tipo_documento='os'
  // como default quando nenhum filtro é passado na querystring (ver
  // routes/cotacoes.js). Isso significa que `chamados` vindo do hook
  // compartilhado SEMPRE traz Ordens de Serviço, nunca Requisições de
  // Compra — o filtro client-side abaixo (`tipo_documento ===
  // 'requisicao_material'`) daria vazio pra sempre nesta tela, mesmo com
  // RCs existindo no banco. Por isso esta tela busca a lista de RC
  // diretamente via apiService, com o filtro certo na query, no mesmo
  // padrão que TelaCotacoesNovaComAbas.jsx já usa pra carregar RM. Só
  // reaproveita do hook compartilhado as mutações (atualizar/deletar), que
  // não dependem de qual lista foi carregada.
  const { atualizar, deletar } = useChamados();
  const [chamados, setChamados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const lista = await apiService.get('/cotacoes/chamados', { tipo_documento: 'requisicao_material' });
      setChamados(lista || []);
    } catch (err) {
      console.error('❌ Erro ao carregar RCs:', err);
      setErro(err.message);
      setChamados([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const { consultarSaldo, consultando } = useEstoque();

  const [telaAtual, setTelaAtual] = useState("lista");
  const [chamadoSel, setChamadoSel] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroUrgencia, setFiltroUrgencia] = useState("todos");
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);
  const [processando, setProcessando] = useState(false);

  const [itemSugestoes, setItemSugestoes] = useState({});
  const [showSugestoes, setShowSugestoes] = useState({});
  const [buscandoSugestoes, setBuscandoSugestoes] = useState({});
  // debounce + guard de resposta fora de ordem, mesma lógica do arquivo
  // original — comportamento validado, não mexer sem necessidade.
  const buscaItemRef = useState(() => ({ current: {} }))[0];

  const formVazio = () => ({
    // nomeRc: campo curto e obrigatório-na-prática (mesmo padrão de
    // "NOME DO SERVIÇO" na tela de OS) — é o que aparece no dropdown de
    // "Agrupamento Automático" da tela de cotação como
    // "RC-2026-0001 - <nomeRc>", pra o comprador saber do que se trata sem
    // abrir a RC. Quando a RC nasce do split automático de uma OS, o
    // backend já preenche este campo sozinho com o nome/descrição da OS de
    // origem (servico_nome) — aqui só populamos pra criação/edição manual.
    nomeRc: "",
    descricaoGeral: "",
    urgencia: "media",
    categoria: "corretiva",
    // Equipamento é opcional numa RC (diferente da OS, onde também é
    // opcional mas mais frequentemente preenchido) — existe pra dar
    // rastreabilidade de histórico de manutenção quando a compra é de fato
    // ligada a um ativo específico, mesmo sendo uma RC manual (sem OS).
    equipamento_id: "",
    itens: [],
  });
  const [form, setForm] = useState(formVazio());

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

  // Busca de sugestões — idêntica à de TelaOrdemServico.jsx (mesmo backend,
  // mesmo contrato dual-source catálogo/marketplace, sem dado comercial).
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
        const resp = await apiService.get('/catalogo/buscar-item', { termo, limit: 5 });
        if (chamadaId !== ctrl.ultimaChamadaId) return;
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

  async function selecionarSugestao(itemId, sug) {
    atualizarItem(itemId, "item_nome", sug.nome);
    atualizarItem(itemId, "codigo", sug.codigo || "");
    setItemSugestoes(prev => ({ ...prev, [itemId]: [] }));
    setShowSugestoes(prev => ({ ...prev, [itemId]: false }));

    if (sug.origem === "catalogo" && sug.catalogo_item_id) {
      atualizarItem(itemId, "item_catalogo_id", sug.catalogo_item_id);
      const item = form.itens.find(m => m.id === itemId);
      const { status, disponivel } = await consultarSaldo(sug.catalogo_item_id, item?.quantidade || 1);
      setForm(f => ({ ...f, itens: f.itens.map(m => m.id === itemId ? { ...m, status_estoque: status, saldo_disponivel: disponivel } : m) }));
    } else {
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

  // `chamados` já vem filtrado por tipo_documento='requisicao_material' do
  // servidor (ver `carregar` acima) — os filtros abaixo são só os de
  // status/urgência/busca escolhidos pelo usuário na tela.
  const chamadosFiltered = (chamados || [])
    .filter(c => filtroStatus === "todos" || c.status === filtroStatus)
    .filter(c => filtroUrgencia === "todos" || c.urgencia === filtroUrgencia)
    .filter(c => {
      if (!busca) return true;
      const text = busca.toLowerCase();
      const linhas = c.itens || c.materiais || [];
      if (linhas.some(item => (item.item_nome || "").toLowerCase().includes(text) || (item.codigo && item.codigo.toLowerCase().includes(text)))) return true;
      return (c.peca && c.peca.toLowerCase().includes(text)) || (c.codigo && c.codigo.toLowerCase().includes(text));
    });

  // ── Manipulação da lista de materiais ──
  const adicionarItem = () => {
    const novo = novoMaterial();
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

  const removerItem = (id) => {
    if (form.itens.length === 1) { alert("É necessário pelo menos um item."); return; }
    if (!window.confirm("Remover este item?")) return;
    setForm(f => ({ ...f, itens: f.itens.filter(it => it.id !== id) }));
  };

  const atualizarItem = (id, campo, valor) => {
    setForm(f => ({ ...f, itens: f.itens.map(it => it.id === id ? { ...it, [campo]: valor } : it) }));
    if (campo === "quantidade") revalidarSaldoQuantidade(id, valor);
  };

  // Submit — cria uma RC manual (sem OS de origem).
  //
  // POST /cotacoes/chamados/rc-manual — endpoint dedicado à criação manual,
  // implementado no backend (ver cotacoes.js). Aceita servico_nome (o "NOME
  // DA RC" — é o que aparece no dropdown "RC-2026-0001 - <nome>" na tela de
  // cotação) e equipamento_id, além de itens/urgencia/categoria/
  // descricao_geral.
  const handleSubmit = async () => {
    const itensValidos = form.itens.filter(it => it.item_nome && it.item_nome.trim() !== "");

    if (itensValidos.length === 0) {
      alert("Adicione pelo menos um material com nome preenchido.");
      return;
    }

    if (!form.nomeRc || form.nomeRc.trim() === "") {
      alert("Informe o nome da RC — é o que orienta o comprador no momento da cotação.");
      return;
    }

    let contador = 0;
    const itensComNumero = itensValidos.map(it => {
      if (it.numero_base == null) { contador += 1; return { ...it, numero_base: contador }; }
      contador = Math.max(contador, it.numero_base);
      return it;
    });

    const serializarItem = (it) => ({
      // FIX (2026-09): incluir o `id` real do item. Sem isso, o PUT não
      // reconhece o item existente e cria duplicata (o antigo fica no banco
      // + o novo entra). Em criação, o id temporário (fracionário) do
      // frontend é tratado como novo pelo backend — insere corretamente.
      id: it.id,
      tipo: "material",
      origem: "planejado",
      status: "ativo",
      numero_base: it.numero_base,
      item_nome: it.item_nome,
      codigo: it.codigo,
      quantidade: parseInt(it.quantidade) || 1,
      urgencia: form.urgencia,
      categoria: form.categoria,
      tipo_item: it.tipo_item,
      descricao: it.descricao,
      item_catalogo_id: it.item_catalogo_id || null,
      unidade_medida: it.unidade_medida || null,
    });

    const payload = {
      itens: itensComNumero.map(serializarItem),
      urgencia: form.urgencia,
      categoria: form.categoria,
      descricao_geral: form.descricaoGeral,
      servico_nome: form.nomeRc,
      equipamento_id: form.equipamento_id || null,
    };

    setProcessando(true);
    try {
      if (modal === "editar") {
        // Edição de RC (manual ou vinda de OS) continua usando o endpoint
        // genérico de atualização de chamado, igual à OS — só a criação
        // manual é que precisa do endpoint novo. PUT /chamados/:id já
        // aceita servico_nome/equipamento_id (mesmos campos usados pela OS).
        const resposta = await atualizar(chamadoSel.id, {
          descricao_geral: form.descricaoGeral,
          servico_nome: form.nomeRc,
          equipamento_id: form.equipamento_id || null,
          urgencia: form.urgencia,
          categoria: form.categoria,
          itens: itensComNumero.map(serializarItem),
          materiais: itensComNumero.map(serializarItem),
        });
        setChamadoSel(resposta);
        setTelaAtual("detalhe");
        alert("Requisição de Compra atualizada com sucesso!");
      } else {
        await apiService.post('/cotacoes/chamados/rc-manual', payload);
        await carregar();
        alert("Requisição de Compra criada com sucesso!");
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
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MODAL — CRIAR / EDITAR RC
  // ─────────────────────────────────────────────────────────────────────────
  if (modal === "novo" || modal === "editar") {
    const numerados = modal === "novo" && form.itens.every(it => it.numero_base == null)
      ? numerarRascunho(form.itens)
      : computarNumeracao(form.itens);

    return (
      <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
        <div style={{ ...s.card, width: 820, maxWidth: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 48px #00000060" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
              {modal === "novo" ? "Nova Requisição de Compra" : "Editar Requisição de Compra"}
            </div>
            <button onClick={() => { setModal(null); resetForm(); }} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>

          <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
            {/* NOME DA RC — curto, é o que aparece no dropdown de cotação
                como "RC-2026-0001 - <nome>". Diferente da DESCRIÇÃO GERAL
                abaixo (mais longa, observações livres). Numa RC vinda de
                split automático de OS, o backend já preenche isso sozinho
                (servico_nome herdado da OS) — aqui é só pra criação/edição
                manual. */}
            <div style={{ marginBottom: 14 }}>
              <label style={s.label}>NOME DA RC *</label>
              <input value={form.nomeRc} onChange={e => setForm(f => ({ ...f, nomeRc: e.target.value }))}
                placeholder="Ex: Material de escritório, Peças urgentes linha 2..." style={s.input} />
            </div>

            {/* EQUIPAMENTO (OPCIONAL) — mesmo padrão da tela de OS. Numa RC
                manual dá rastreabilidade quando a compra está ligada a um
                ativo específico, mesmo sem uma OS de origem. Numa RC vinda
                de split automático, o backend já copia o equipamento_id da
                OS de origem — aqui também é editável na visualização por
                simetria com o restante do formulário. */}
            <div style={{ marginBottom: 14 }}>
              <label style={s.label}>EQUIPAMENTO (OPCIONAL)</label>
              <select value={form.equipamento_id} onChange={e => setForm(f => ({ ...f, equipamento_id: e.target.value }))} style={{ ...s.input, appearance: "none" }}>
                <option value="">— Sem equipamento —</option>
                {(equipamentos || []).map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.tag ? `${eq.tag} - ${eq.nome}` : eq.nome}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={s.label}>DESCRIÇÃO GERAL (OPCIONAL)</label>
              <textarea value={form.descricaoGeral} onChange={e => setForm(f => ({ ...f, descricaoGeral: e.target.value }))}
                placeholder="Observações gerais sobre a RC" style={{ ...s.input, minHeight: 60, resize: "vertical" }} />
            </div>

            {/* Urgência e Categoria — mesmo nível de granularidade da OS: valem para a RC inteira */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
              <div>
                <label style={s.label}>URGÊNCIA DA RC</label>
                <select value={form.urgencia} onChange={e => setForm(f => ({ ...f, urgencia: e.target.value }))} style={{ ...s.input, appearance: "none" }}>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <div>
                <label style={s.label}>CATEGORIA DA RC</label>
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={{ ...s.input, appearance: "none" }}>
                  <option value="corretiva">Corretiva</option>
                  <option value="preventiva">Preventiva</option>
                  <option value="preditiva">Preditiva</option>
                </select>
              </div>
            </div>

            {/* Lista de materiais — RC não tem serviço, equipamento nem apontamento */}
            <div style={{ marginBottom: 14 }} id="lista-itens-rc">
              <div style={{ fontSize: 12, color: C.textSub, marginBottom: 10 }}>
                Adicione materiais à RC
                {numerados.length > 0 && (
                  <span style={{ color: C.muted }}> · {numerados.length} item(ns)</span>
                )}
              </div>

              {numerados.length === 0 && (
                <div style={{ background: C.bg, border: `1px dashed ${C.border}`, borderRadius: 8, padding: "18px 14px", textAlign: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Nenhum item ainda</div>
                  <button onClick={adicionarItem} style={{ background: "transparent", border: "none", color: C.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                    + Material
                  </button>
                </div>
              )}

              {numerados.map((item, index) => {
                const est = estoqueCfg[item.status_estoque] || estoqueCfg.nao_verificado;
                const estaConsultando = item.item_catalogo_id && consultando[item.item_catalogo_id];

                return (
                  <div key={item.id} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <button onClick={() => moverItem(item.id, -1)} disabled={index === 0} style={{ background: "transparent", border: "none", color: index === 0 ? C.border : C.muted, fontSize: 10, cursor: index === 0 ? "default" : "pointer", lineHeight: 1, padding: 0 }} title="Mover para cima">▲</button>
                          <button onClick={() => moverItem(item.id, 1)} disabled={index === numerados.length - 1} style={{ background: "transparent", border: "none", color: index === numerados.length - 1 ? C.border : C.muted, fontSize: 10, cursor: index === numerados.length - 1 ? "default" : "pointer", lineHeight: 1, padding: 0 }} title="Mover para baixo">▼</button>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>#{item.numeroExibicao}</span>
                        <span style={{ fontSize: 11, color: C.textSub }}>📦 Material</span>
                      </div>
                      <button onClick={() => removerItem(item.id)} style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: 14, cursor: "pointer" }} title="Remover item">✕</button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 70px 40px", gap: 10, alignItems: "end" }}>
                      <div style={{ position: "relative" }}>
                        <label style={{ ...s.label, fontSize: 10 }}>NOME *</label>
                        <div style={{ position: "relative" }}>
                          <input type="text" value={item.item_nome} data-item-input={item.id}
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
                        <input type="text" value={item.codigo} onChange={e => atualizarItem(item.id, "codigo", e.target.value)} placeholder="Ex: SKF-6205" style={s.input} />
                      </div>
                      <div>
                        <label style={{ ...s.label, fontSize: 10 }}>QTD</label>
                        <input type="number" value={item.quantidade} onChange={e => atualizarItem(item.id, "quantidade", e.target.value)} min="1" style={{ ...s.input, textAlign: "center" }} />
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
                      <input type="text" value={item.descricao || ""} onChange={e => atualizarItem(item.id, "descricao", e.target.value)} placeholder="Detalhes adicionais sobre este material" style={s.input} />
                    </div>

                    {index === numerados.length - 1 && (
                      <div style={{ display: "flex", gap: 14, marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${C.border}` }}>
                        <button onClick={adicionarItem} style={{ background: "transparent", border: "none", color: C.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                          + Material
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
              {processando ? "Salvando..." : modal === "novo" ? "Criar RC" : "Atualizar RC"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LISTA DE REQUISIÇÕES DE COMPRA
  // ─────────────────────────────────────────────────────────────────────────
  if (telaAtual === "lista") {
    return (
      <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>COMPRAS</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Requisições de Compra</div>
          </div>
          <button onClick={() => { resetForm(); setModal("novo"); }} style={{ ...s.btn(true), padding: "9px 20px", fontSize: 12 }}>➕ Nova RC</button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          <input type="text" placeholder="Buscar por item ou código..." value={busca} onChange={e => setBusca(e.target.value)} style={{ ...s.input, flex: 1, minWidth: 200, padding: "8px 12px", fontSize: 12 }} />
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
            <div style={{ fontSize: 36, marginBottom: 12 }}>🛒</div>
            <div style={{ fontSize: 14, color: C.text, fontWeight: 500, marginBottom: 4 }}>Nenhuma RC encontrada</div>
            <div style={{ fontSize: 12, color: C.muted }}>Crie uma nova RC para solicitar a compra de materiais</div>
          </div>
        ) : (
          <div style={{ ...s.card, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 120px 100px 90px 90px 100px 100px", padding: "10px 18px", background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, letterSpacing: "0.08em" }}>
              <span>NÚMERO</span><span>DESCRIÇÃO</span><span>DATA ABERTURA</span><span>URGÊNCIA</span><span>CATEGORIA</span><span>STATUS</span><span>ORIGEM</span><span></span>
            </div>
            {chamadosFiltered.map((chamado, i) => {
              const linhas = chamado.itens || chamado.materiais || [];
              const nomeExibicao = chamado.servico_nome || chamado.descricao_geral || chamado.descricao || (chamado.peca || linhas[0]?.item_nome || "—");
              const totalLinhas = linhas.length;
              const totalAtivos = linhas.filter(it => it.status !== "cancelado").length;

              const statusCfg = {
                aberto: { l: "Aberto", c: C.muted }, cotando: { l: "Cotando", c: C.warn },
                finalizado: { l: "Finalizado", c: C.success }, aguardando_cotacao: { l: "Aguardando Cotação", c: C.warn },
              }[chamado.status] || { l: chamado.status, c: C.muted };
              const urgenciaCfg = urgenciaCfgMap[chamado.urgencia] || { l: chamado.urgencia, c: C.muted };
              const categoriaCfg = categoriaCfgMap[chamado.categoria] || { l: chamado.categoria, c: C.muted };

              // origem_os_numero preenchido -> RC nasceu do split automático
              // de uma OS. null/undefined -> RC manual, criada direto aqui.
              const origemLabel = chamado.origem_os_numero ? `OS ${chamado.origem_os_numero}` : "Manual";

              return (
                <div key={chamado.id} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 120px 100px 90px 90px 100px 100px", padding: "13px 18px", borderBottom: i < chamadosFiltered.length - 1 ? `1px solid ${C.border}22` : "none", alignItems: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>
                    {chamado.numero}
                    {totalLinhas > 1 && <span style={{ fontSize: 9, color: C.muted, marginLeft: 4 }}>({totalAtivos}/{totalLinhas} itens)</span>}
                  </div>
                  <div><div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{nomeExibicao}</div></div>
                  <div style={{ fontSize: 11, color: C.muted }}>{fmtD(chamado.aberto_em)}</div>
                  <div style={{ ...s.tag(urgenciaCfg.c), fontSize: 10 }}>{urgenciaCfg.l}</div>
                  <div style={{ ...s.tag(categoriaCfg.c), fontSize: 10 }}>{categoriaCfg.l}</div>
                  <div style={{ ...s.tag(statusCfg.c), fontSize: 10 }}>{statusCfg.l}</div>
                  <div style={{ fontSize: 10, color: chamado.origem_os_numero ? C.accent : C.muted }} title={chamado.origem_os_numero ? "Gerada automaticamente a partir desta OS" : "Criada manualmente, sem OS de origem"}>
                    {origemLabel}
                  </div>
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
    const linhas = chamadoSel.itens || chamadoSel.materiais || [];
    const numerados = computarNumeracao(linhas);
    const urgenciaCfg = urgenciaCfgMap[chamadoSel.urgencia] || { l: chamadoSel.urgencia, c: C.muted };
    const categoriaCfg = categoriaCfgMap[chamadoSel.categoria] || { l: chamadoSel.categoria, c: C.muted };
    const origemLabel = chamadoSel.origem_os_numero ? `OS ${chamadoSel.origem_os_numero}` : "Manual (sem OS de origem)";

    return (
      <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
        <button onClick={() => { setTelaAtual("lista"); setChamadoSel(null); }} style={{ background: "transparent", border: "none", color: C.accent, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 16 }}>← Voltar para RCs</button>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>DETALHES DA REQUISIÇÃO DE COMPRA</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.accent, fontFamily: "'IBM Plex Mono',monospace", marginBottom: 4 }}>{chamadoSel.numero}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{ ...s.tag(urgenciaCfg.c), fontSize: 10 }}>{urgenciaCfg.l}</span>
                <span style={{ ...s.tag(categoriaCfg.c), fontSize: 10 }}>{categoriaCfg.l}</span>
                <span style={{ ...s.tag(chamadoSel.origem_os_numero ? C.accent : C.muted), fontSize: 10 }}>
                  {chamadoSel.origem_os_numero ? `📄 Origem: ${origemLabel}` : "Origem: Manual"}
                </span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>ABERTO EM</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{fmtD(chamadoSel.aberto_em)}</div>
            </div>
          </div>
        </div>

        <div style={{ ...s.card, padding: "16px 18px", marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", marginBottom: 12 }}>MATERIAIS DA RC</div>
          {numerados.length === 0 ? (
            <div style={{ color: C.muted, fontSize: 12 }}>Nenhum item cadastrado</div>
          ) : (
            numerados.map((item) => {
              const cancelado = item.status === "cancelado";
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
              const itensForm = linhas.map(it => ({
                ...novoMaterial(), id: it.id, numero_base: it.numero_base ?? null, status: it.status || "ativo",
                item_nome: it.item_nome || "", codigo: it.codigo || "", item_catalogo_id: it.item_catalogo_id || null,
                quantidade: it.quantidade || 1, tipo_item: it.tipo_item || "", descricao: it.descricao || "",
                status_estoque: it.status_estoque || "nao_verificado", saldo_disponivel: it.saldo_disponivel ?? null,
              }));
              setForm({
                nomeRc: chamadoSel.servico_nome || "",
                equipamento_id: chamadoSel.equipamento_id || "",
                descricaoGeral: chamadoSel.descricao_geral || chamadoSel.descricao || "",
                urgencia: chamadoSel.urgencia || "media",
                categoria: chamadoSel.categoria || "corretiva",
                itens: itensForm,
              });
              setModal("editar");
            }}
            style={{ ...s.btn(true), padding: "9px 20px", fontSize: 12 }}
          >✏️ Editar</button>
          <button
            onClick={() => { if (window.confirm("Tem certeza que deseja excluir esta RC?")) deletar(chamadoSel.id).then(() => setTelaAtual("lista")); }}
            style={{ ...s.btn(false), padding: "9px 20px", fontSize: 12, border: "1px solid #ef4444", color: "#ef4444" }}
          >🗑 Deletar</button>
        </div>
      </div>
    );
  }

  return null;
}