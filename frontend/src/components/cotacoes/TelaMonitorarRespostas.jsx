import { useState, useEffect } from "react";
import { cotacoesService } from "../../services/cotacoesService";
import apiService from "../../services/apiService";

export default function TelaMonitorarRespostas({ 
  cotacaoId, 
  token, 
  fmtBRL, 
  C, 
  s, 
  onVoltar, 
  onFinalizarOV 
}) {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editandoFornecedor, setEditandoFornecedor] = useState(null);
  const [atualizando, setAtualizando] = useState(false);
  // ── Seleção de fornecedor por item ──
  // Mapa: cotacao_item_id → fornecedor_id escolhido
  const [selecoesPorItem, setSelecoesPorItem] = useState({});
  // Mapa: cotacao_item_id → texto da justificativa (quando diverge do sugerido)
  const [justificativas, setJustificativas] = useState({});
  // Mapa: cotacao_item_id → dados do "sugerido" (menor preço)
  // Preenchido automaticamente no carregarDados
  const [sugeridosPorItem, setSugeridosPorItem] = useState({});
  // Modal "Adicionar Fornecedor"
  const [modalAddForn, setModalAddForn] = useState(false);
  const [fornecedoresDisponiveis, setFornecedoresDisponiveis] = useState([]);
  const [carregandoForns, setCarregandoForns] = useState(false);
  const [selecionadosAdd, setSelecionadosAdd] = useState([]);
  const [buscaAdd, setBuscaAdd] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  // Quais itens da cotação os novos fornecedores vão cotar
  const [itensSelecionados, setItensSelecionados] = useState([]);
  const [formEdicao, setFormEdicao] = useState({
    valor: '',
    prazo: '',
    frete: '',
    obs: ''
  });
  const [itensEdicao, setItensEdicao] = useState([]); // Fase 1B: edição por item
  // Quais fornecedores do card "VENCEDORES POR ITEM" estão expandidos.
  // Chave = fornecedor_id (string). Colapsado por padrão — o card é
  // panorama, quem quiser detalhe clica.
  const [vencedoresExpandidos, setVencedoresExpandidos] = useState({});

  // ─── CARREGAR DADOS ───────────────────────────────────────
  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const resultado = await cotacoesService.obterStatusCotacao(token, cotacaoId);
      setDados(resultado);

      // Pré-seleciona o melhor fornecedor (menor total) por item.
      // `sugerido` = menor preço; `selecao` começa igual (usuário pode trocar).
      const sugeridos = {};
      const selecoes = {};
      (resultado.itens || []).forEach(item => {
        const respondidos = (item.fornecedores || [])
          .filter(f => f.status === 'respondido' && f.total != null);
        if (respondidos.length === 0) return;
        const melhor = respondidos.reduce((a, b) =>
          (parseFloat(a.total) || 0) <= (parseFloat(b.total) || 0) ? a : b
        );
        sugeridos[item.id] = {
          fornecedor_id: melhor.fornecedor_id,
          total: melhor.total,
          nome: melhor.nome,
        };
        selecoes[item.id] = melhor.fornecedor_id;
      });
      setSugeridosPorItem(sugeridos);
      setSelecoesPorItem(selecoes);
      setJustificativas({});
    } catch (err) {
      console.error('❌ Erro:', err);
      alert('Erro ao carregar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── ABRIR EDIÇÃO ──────────────────────────────────────────
  const handleAbrirEdicao = (fornecedor) => {
    setEditandoFornecedor(fornecedor);

    // Cabeçalho continua sendo prazo + obs (o resto vira por item).
    setFormEdicao({
      prazo: fornecedor.prazo || '',
      obs: fornecedor.obs || ''
    });

    // Fase 1B — monta linhas por item. Para cada item da cotação,
    // localiza a linha desse fornecedor em item.fornecedores[] e
    // converte em uma linha editável. Se o fornecedor não respondeu
    // esse item, ainda assim mostramos a linha (valor/frete vazios)
    // para o comprador poder preencher manualmente.
    const linhas = (dados?.itens || [])
      .map(item => {
        const forn = (item.fornecedores || []).find(
          f => String(f.fornecedor_id) === String(fornecedor.fornecedor_id)
        );
        if (!forn) return null;
        return {
          cotacao_item_id: item.id,
          chamado_item_id: item.chamado_item_id || null,
          item_nome: item.nome,
          item_codigo: item.codigo || null,
          item_quantidade: item.quantidade || 0,
          frete_modalidade: forn.frete_modalidade || 'CIF',
          valor: forn.valor != null ? String(forn.valor) : '',
          frete: forn.frete != null ? String(forn.frete) : '',
          valor_renegociado:
            forn.valor_renegociado != null ? String(forn.valor_renegociado) : '',
          frete_renegociado:
            forn.frete_renegociado != null ? String(forn.frete_renegociado) : ''
        };
      })
      .filter(Boolean);

    setItensEdicao(linhas);
  };

  const atualizarLinhaEdicao = (cotacaoItemId, campo, valor) => {
    setItensEdicao(prev =>
      prev.map(l =>
        l.cotacao_item_id === cotacaoItemId ? { ...l, [campo]: valor } : l
      )
    );
  };

    // Marca/desmarca seleção de um fornecedor pra um item.
  function selecionarFornecedor(cotacaoItemId, fornecedorId) {
    setSelecoesPorItem(prev => ({ ...prev, [cotacaoItemId]: fornecedorId }));
    // Se voltou pro sugerido, limpa justificativa (não é mais divergência)
    if (sugeridosPorItem[cotacaoItemId]?.fornecedor_id === fornecedorId) {
      setJustificativas(prev => {
        const copy = { ...prev };
        delete copy[cotacaoItemId];
        return copy;
      });
    }
  }

  // Um item "diverge" quando tem fornecedor selecionado E ele é diferente
  // do sugerido (menor preço).
  function itemDiverge(cotacaoItemId) {
    const selecionado = selecoesPorItem[cotacaoItemId];
    const sugerido = sugeridosPorItem[cotacaoItemId]?.fornecedor_id;
    return selecionado != null && sugerido != null && String(selecionado) !== String(sugerido);
  }

  // Há divergência pendente no total?
  const temDivergencia = Object.keys(selecoesPorItem).some(id => itemDiverge(Number(id)));

  // Há justificativa faltando em algum item divergente?
  const faltaJustificativa = Object.keys(selecoesPorItem).some(id => {
    if (!itemDiverge(Number(id))) return false;
    return !justificativas[Number(id)]?.trim();
  });

  // Quantos fornecedores únicos foram selecionados?
  const fornecedoresUnicos = [...new Set(Object.values(selecoesPorItem))];

  // Todos os itens têm seleção?
  const todosItensComSelecao = dados?.itens?.length > 0
    && dados.itens.every(item => selecoesPorItem[item.id] != null);

    // Abre o modal de adicionar fornecedor. Carrega a lista de fornecedores
  // do tenant (via /fornecedores) e filtra os que já estão nesta cotação.
  async function abrirModalAddFornecedor() {
    setModalAddForn(true);
    setSelecionadosAdd([]);
    setBuscaAdd("");
    // Todos os itens começam marcados — o comprador desmarca o que
    // não faz sentido o fornecedor cotar.
    setItensSelecionados((dados?.itens || []).map(i => i.id));
    setCarregandoForns(true);
    try {
      const lista = await apiService.get("/fornecedores");
      setFornecedoresDisponiveis(Array.isArray(lista) ? lista : []);
    } catch (e) {
      console.warn("Erro ao carregar fornecedores:", e.message);
      setFornecedoresDisponiveis([]);
    } finally {
      setCarregandoForns(false);
    }
  }

  function toggleAddFornecedor(fornId) {
    setSelecionadosAdd(prev => {
      const jaMarcado = prev.includes(fornId);
      if (jaMarcado) {
        return prev.filter(x => x !== fornId);
      }
      // Fix UX: se este fornecedor já está vinculado a alguns itens
      // desta cotação, desmarca esses itens automaticamente ao marcar
      // o fornecedor — o comprador normalmente quer adicionar SÓ nos
      // itens onde ele ainda não responde. Se quiser remarcar algum,
      // é só clicar de novo na linha do item.
      const itensComEsseForn = new Set();
      (dados?.itens || []).forEach(item => {
        const temEsseForn = (item.fornecedores || []).some(
          f => String(f.fornecedor_id) === String(fornId)
        );
        if (temEsseForn) itensComEsseForn.add(item.id);
      });
      if (itensComEsseForn.size > 0) {
        setItensSelecionados(prevItens =>
          prevItens.filter(id => !itensComEsseForn.has(id))
        );
      }
      return [...prev, fornId];
    });
  }

  function toggleItemAdd(cotacaoItemId) {
    setItensSelecionados(prev =>
      prev.includes(cotacaoItemId)
        ? prev.filter(x => x !== cotacaoItemId)
        : [...prev, cotacaoItemId]
    );
  }

  async function confirmarAdicionarFornecedores() {
    if (selecionadosAdd.length === 0) {
      alert("Selecione ao menos 1 fornecedor.");
      return;
    }
    if (itensSelecionados.length === 0) {
      alert("Selecione ao menos 1 item para o fornecedor cotar.");
      return;
    }
    setAdicionando(true);
    try {
      await cotacoesService.adicionarFornecedores(
        token, cotacaoId, selecionadosAdd, itensSelecionados
      );
      setModalAddForn(false);
      await carregarDados();
      alert(`✅ ${selecionadosAdd.length} fornecedor(es) adicionado(s) para ${itensSelecionados.length} item(ns).`);
    } catch (e) {
      alert("Erro ao adicionar: " + e.message);
    } finally {
      setAdicionando(false);
    }
  }

  // Handler novo: emite 1 OC por fornecedor via endpoint /emitir-ocs
  async function handleEmitirOCs() {
    if (!todosItensComSelecao) {
      alert('Selecione um fornecedor para cada item antes de emitir.');
      return;
    }
    if (faltaJustificativa) {
      alert('Preencha a justificativa nos itens onde você escolheu um fornecedor diferente do sugerido.');
      return;
    }

    if (!window.confirm(`Emitir ${fornecedoresUnicos.length} OC(s)?`)) return;

    setAtualizando(true);
    try {
      const selecoes = dados.itens.map(item => {
        const fornId = selecoesPorItem[item.id];
        const sugerido = sugeridosPorItem[item.id];
        const just = justificativas[item.id]?.trim() || null;
        return {
          cotacao_item_id: item.id,
          fornecedor_id: fornId,
          justificativa: just,
          sugerido_fornecedor_id: sugerido?.fornecedor_id || null,
          valor_sugerido: sugerido?.total != null ? parseFloat(sugerido.total) : null,
        };
      });

      const resultado = await cotacoesService.emitirOCs(token, cotacaoId, selecoes);
      alert(`✅ ${resultado.total} OC(s) emitida(s): ${resultado.ocs.map(o => o.numero).join(', ')}`);
      onVoltar();
    } catch (err) {
      alert('Erro ao emitir OCs: ' + err.message);
    } finally {
      setAtualizando(false);
    }
  }

  const handleSalvarEdicao = async () => {
    const modoPorItem = itensEdicao.length > 0;

    if (!formEdicao.prazo) {
      alert('Preencha o prazo');
      return;
    }
    if (!modoPorItem && !formEdicao.valor) {
      alert('Preencha valor e prazo');
      return;
    }

    setAtualizando(true);
    try {
      const payload = {
        prazo: parseInt(formEdicao.prazo),
        obs: formEdicao.obs || null
      };

      if (modoPorItem) {
        // Fase 1B — payload por item. Nomes dos campos seguem o contrato
        // do backend: `valor_frete` (payload) → coluna `frete`.
        payload.itens = itensEdicao.map(l => ({
          cotacao_item_id: l.cotacao_item_id,
          chamado_item_id: l.chamado_item_id,
          valor: l.valor !== '' && l.valor != null ? parseFloat(l.valor) : null,
          valor_frete:
            l.frete !== '' && l.frete != null ? parseFloat(l.frete) : null,
          valor_renegociado:
            l.valor_renegociado !== '' && l.valor_renegociado != null
              ? parseFloat(l.valor_renegociado)
              : null,
          frete_renegociado:
            l.frete_renegociado !== '' && l.frete_renegociado != null
              ? parseFloat(l.frete_renegociado)
              : null,
          frete_modalidade: l.frete_modalidade || null
        }));
      } else {
        // Fallback: cotação sem itens vinculados a este fornecedor
        // (caso degenerado). Só prazo/obs são enviados — valor/frete
        // do cabeçalho ficam intactos no backend, que já ignora campos
        // ausentes no caminho legado.
      }

      await cotacoesService.atualizarRespostaFornecedor(
        token,
        cotacaoId,
        editandoFornecedor.fornecedor_id,
        payload
      );

      // Sem update otimista: com N itens o mais confiável é recarregar
      // tudo do backend (que já recalcula agregados no cabeçalho).
      setEditandoFornecedor(null);
      setItensEdicao([]);
      await carregarDados();
    } catch (err) {
      console.error('❌ Erro:', err);
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setAtualizando(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "22px 24px", textAlign: "center", color: C.muted }}>
        Carregando respostas...
      </div>
    );
  }

  if (!dados) {
    return (
      <div style={{ padding: "22px 24px", textAlign: "center", color: C.muted }}>
        Erro ao carregar dados
      </div>
    );
  }

  // ─── MODO EDIÇÃO ───────────────────────────────────────────
  if (editandoFornecedor) {
    const modoPorItem = itensEdicao.length > 0;

    return (
      <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>
            EDITAR RESPOSTA
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>
            {editandoFornecedor.nome}
          </div>
        </div>

        {/* CABEÇALHO — prazo + obs (valem pro fornecedor inteiro) */}
        <div style={{ ...s.card, padding: "18px 20px", marginBottom: 20 }}>
          <div style={{
            fontSize: 10,
            color: C.muted,
            letterSpacing: "0.08em",
            fontWeight: 600,
            marginBottom: 12,
            paddingBottom: 6,
            borderBottom: `1px solid ${C.border}`,
          }}>
            DADOS DO FORNECEDOR
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>
              PRAZO (dias)
            </label>
            <input
              type="number"
              value={formEdicao.prazo}
              onChange={(e) => setFormEdicao({ ...formEdicao, prazo: e.target.value })}
              style={{ ...s.input, width: 120 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>
              OBSERVAÇÕES
            </label>
            <textarea
              value={formEdicao.obs}
              onChange={(e) => setFormEdicao({ ...formEdicao, obs: e.target.value })}
              placeholder="Ex: desconto negociado à vista, prazo estendido, condição especial..."
              style={{ ...s.input, width: "100%", minHeight: 60, resize: "vertical" }}
            />
          </div>
        </div>

        {/* EDIÇÃO POR ITEM */}
        {modoPorItem && (
          <div style={{ ...s.card, padding: "18px 20px", marginBottom: 20 }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}>
              <div style={{
                fontSize: 10,
                color: "#f59e0b",
                letterSpacing: "0.08em",
                fontWeight: 600,
              }}>
                ✏️ EDIÇÃO POR ITEM
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {itensEdicao.length} {itensEdicao.length === 1 ? "item" : "itens"}
              </div>
            </div>

            {/* Ações em massa — CIF/FOB. Ação destrutiva explícita:
                sobrescreve a modalidade de TODAS as linhas. Valores de
                frete continuam no state (só desabilitados), então voltar
                pra FOB restaura sem perda. */}
            <div style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}>
              <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.05em" }}>
                MODALIDADE EM MASSA:
              </span>
              {['CIF', 'FOB'].map(mod => (
                <button
                  key={mod}
                  type="button"
                  onClick={() => setItensEdicao(prev =>
                    prev.map(l => ({ ...l, frete_modalidade: mod }))
                  )}
                  style={{
                    background: "transparent",
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    color: C.text,
                    fontSize: 10,
                    cursor: "pointer",
                    padding: "4px 10px",
                    fontFamily: "inherit",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                  }}
                >
                  TODOS {mod}
                </button>
              ))}
            </div>

            {/* Header das colunas */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "minmax(140px, 1.4fr) 60px 1fr 90px 1fr 1fr 1fr 100px",
              gap: 8,
              padding: "6px 8px",
              borderBottom: `1px solid ${C.border}`,
              fontSize: 10,
              color: C.muted,
              letterSpacing: "0.05em",
              fontWeight: 600,
            }}>
              <div>ITEM</div>
              <div style={{ textAlign: "center" }}>QTD</div>
              <div style={{ textAlign: "right" }}>VALOR (R$)</div>
              <div style={{ textAlign: "center" }}>MODALIDADE</div>
              <div style={{ textAlign: "right" }}>FRETE (R$)</div>
              <div style={{ textAlign: "right" }}>VALOR NEG. (R$)</div>
              <div style={{ textAlign: "right" }}>FRETE NEG. (R$)</div>
              <div style={{ textAlign: "right" }}>SAVING</div>
            </div>

            {itensEdicao.map((linha) => {
              const ehCIF = (linha.frete_modalidade || 'CIF') === 'CIF';

              // Em CIF o frete está incluso no valor unitário — não soma
              // no total nem na economia. Os valores ficam preservados no
              // state (input desabilitado, não limpo), então voltar pra
              // FOB restaura tudo sem perda.
              const vOrig = parseFloat(linha.valor) || 0;
              const fOrig = ehCIF ? 0 : (parseFloat(linha.frete) || 0);
              const vNeg = linha.valor_renegociado !== '' ? parseFloat(linha.valor_renegociado) : null;
              const fNeg = linha.frete_renegociado !== '' ? parseFloat(linha.frete_renegociado) : null;

              const economItem = vNeg != null ? (vOrig - vNeg) : 0;
              const economFrete = (!ehCIF && fNeg != null) ? (fOrig - fNeg) : 0;
              const savingLinha = economItem + economFrete;
              const temReneg = vNeg != null || (!ehCIF && fNeg != null);

              return (
                <div
                  key={linha.cotacao_item_id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(140px, 1.4fr) 60px 1fr 90px 1fr 1fr 1fr 100px",
                    gap: 8,
                    padding: "10px 8px",
                    borderBottom: `1px solid ${C.border}22`,
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>
                    <div>{linha.item_nome}</div>
                    {linha.item_codigo && (
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                        {linha.item_codigo}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: "center", fontSize: 12, color: C.muted }}>
                    {linha.item_quantidade}
                  </div>

                  <input
                    type="number"
                    step="0.01"
                    value={linha.valor}
                    onChange={(e) => atualizarLinhaEdicao(linha.cotacao_item_id, 'valor', e.target.value)}
                    placeholder="—"
                    style={{ ...s.input, width: "100%", textAlign: "right" }}
                  />

                  {/* MODALIDADE — radio CIF/FOB (mesmo padrão do portal
                      do fornecedor). CIF = frete incluso; FOB = à parte. */}
                  <div style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 3,
                  }}>
                    {['CIF', 'FOB'].map(mod => {
                      const ativo = (linha.frete_modalidade || 'CIF') === mod;
                      return (
                        <button
                          key={mod}
                          type="button"
                          onClick={() => atualizarLinhaEdicao(linha.cotacao_item_id, 'frete_modalidade', mod)}
                          style={{
                            background: ativo ? `${C.accent}22` : "transparent",
                            border: `1px solid ${ativo ? C.accent : C.border}`,
                            borderRadius: 4,
                            color: ativo ? C.accent : C.muted,
                            fontSize: 9,
                            cursor: "pointer",
                            padding: "3px 6px",
                            fontFamily: "inherit",
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                          }}
                        >
                          {mod}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    type="number"
                    step="0.01"
                    value={linha.frete}
                    onChange={(e) => atualizarLinhaEdicao(linha.cotacao_item_id, 'frete', e.target.value)}
                    placeholder="—"
                    disabled={ehCIF}
                    title={ehCIF
                      ? 'CIF: frete já está incluso no valor unitário'
                      : 'FOB: frete cobrado à parte (deixe em branco se o comprador for contratar por fora)'}
                    style={{
                      ...s.input,
                      width: "100%",
                      textAlign: "right",
                      opacity: ehCIF ? 0.45 : 1,
                      cursor: ehCIF ? 'not-allowed' : 'text',
                    }}
                  />

                  <input
                    type="number"
                    step="0.01"
                    value={linha.valor_renegociado}
                    onChange={(e) => atualizarLinhaEdicao(linha.cotacao_item_id, 'valor_renegociado', e.target.value)}
                    placeholder="—"
                    style={{
                      ...s.input,
                      width: "100%",
                      textAlign: "right",
                      borderColor: "#f59e0b55",
                    }}
                  />

                  <input
                    type="number"
                    step="0.01"
                    value={linha.frete_renegociado}
                    onChange={(e) => atualizarLinhaEdicao(linha.cotacao_item_id, 'frete_renegociado', e.target.value)}
                    placeholder="—"
                    disabled={ehCIF}
                    title={
                      !ehCIF && fNeg != null && fOrig > 0 && fNeg > fOrig
                        ? `Frete renegociado R$ ${fNeg.toFixed(2)} — R$ ${(fNeg - fOrig).toFixed(2)} ACIMA do cotado. Reduz a economia da linha.`
                        : ehCIF
                          ? 'CIF: frete já está incluso no valor unitário'
                          : 'Frete renegociado (FOB à parte)'
                    }
                    style={{
                      ...s.input,
                      width: "100%",
                      textAlign: "right",
                      // Borda vermelha quando o comprador pagou MAIS frete
                      // na renegociação do que o fornecedor cotou — o saving
                      // cai silenciosamente nesse caso, o vermelho avisa.
                      borderColor: (!ehCIF && fNeg != null && fOrig > 0 && fNeg > fOrig)
                        ? "#ef4444"
                        : "#f59e0b55",
                      opacity: ehCIF ? 0.45 : 1,
                      cursor: ehCIF ? 'not-allowed' : 'text',
                    }}
                  />

                  <div style={{
                    textAlign: "right",
                    fontSize: 12,
                    color: temReneg && savingLinha > 0 ? "#22c55e" : C.muted,
                    fontWeight: 700,
                  }}>
                    {temReneg && savingLinha > 0 ? fmtBRL(savingLinha) : '—'}
                  </div>
                </div>
              );
            })}

            {/* Economia total */}
            {(() => {
              const totalSaving = itensEdicao.reduce((soma, l) => {
                const ehCIFlinha = (l.frete_modalidade || 'CIF') === 'CIF';
                const vOrig = parseFloat(l.valor) || 0;
                const fOrig = ehCIFlinha ? 0 : (parseFloat(l.frete) || 0);
                const vNeg = l.valor_renegociado !== '' ? parseFloat(l.valor_renegociado) : null;
                const fNeg = l.frete_renegociado !== '' ? parseFloat(l.frete_renegociado) : null;
                const e = vNeg != null ? (vOrig - vNeg) : 0;
                const f = (!ehCIFlinha && fNeg != null) ? (fOrig - fNeg) : 0;
                return soma + e + f;
              }, 0);
              if (totalSaving <= 0) return null;
              return (
                <div style={{
                  background: "#0f2f1a",
                  border: "1px solid #22c55e44",
                  borderRadius: 8,
                  padding: "12px 14px",
                  marginTop: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}>
                  <div style={{
                    fontSize: 10,
                    color: "#22c55e",
                    letterSpacing: "0.05em",
                    fontWeight: 600,
                  }}>
                    💰 ECONOMIA TOTAL
                  </div>
                  <div style={{
                    fontSize: 18,
                    color: "#22c55e",
                    fontWeight: 700,
                  }}>
                    {fmtBRL(totalSaving)}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {!modoPorItem && (
          <div style={{
            ...s.card,
            padding: "14px 18px",
            marginBottom: 20,
            fontSize: 12,
            color: C.muted,
          }}>
            Nenhum item vinculado a este fornecedor. Prazo e observações serão salvos no cabeçalho.
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { setEditandoFornecedor(null); setItensEdicao([]); }}
            style={{ ...s.btn(false, C.muted), flex: 1, padding: "10px 16px" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvarEdicao}
            disabled={atualizando}
            style={{
              ...s.btn(true, C.success),
              flex: 1,
              padding: "10px 16px",
              opacity: atualizando ? 0.5 : 1,
            }}
          >
            {atualizando ? "Salvando..." : "✅ Salvar"}
          </button>
        </div>
      </div>
    );
  }

  const salvarValorRenegociado = async (forn) => {
    try {
      await cotacoesService.atualizarRespostaFornecedor(
        token,
        cotacaoId,
        forn.fornecedor_id,
        {
          valor: forn.valor,
          prazo: forn.prazo,
          frete: forn.frete,
          obs: forn.obs,
          valor_renegociado: forn.valor_renegociado
        }
      );
      alert('✅ Valor renegociado salvo!');
      await carregarDados();
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    }
  };

  // ─── MODO VISUALIZAÇÃO ────────────────────────────────────

  const { cotacao, itens, resumo } = dados;

  // Resumo de Vencedores — agrega os itens que o comprador SELECIONOU
  // (radio `selecoesPorItem[item.id] = fornecedor_id`) por fornecedor.
  // Não usa `melhorProposta` (esse era o conceito antigo de "melhor geral
  // agregado", obsoleto desde a seleção por item).
  //
  // Total por fornecedor = soma de:
  //   (valor_renegociado ?? valor) + frete, onde frete só entra se FOB
  //   (em CIF o frete já está dentro do valor unitário).
  // O frete renegociado tem prioridade sobre o cotado.
  const fornecedoresVencedores = (() => {
    const mapa = {};
    itens.forEach(item => {
      const fornIdSel = selecoesPorItem[item.id];
      if (fornIdSel == null) return;
      const forn = (item.fornecedores || []).find(
        f => String(f.fornecedor_id) === String(fornIdSel)
      );
      if (!forn) return;

      const ehCIF = (forn.frete_modalidade || 'CIF') === 'CIF';
      const valorUnit = forn.valor_renegociado != null
        ? (parseFloat(forn.valor_renegociado) || 0)
        : (parseFloat(forn.valor) || 0);
      const freteUnit = ehCIF
        ? 0
        : (forn.frete_renegociado != null
            ? (parseFloat(forn.frete_renegociado) || 0)
            : (parseFloat(forn.frete) || 0));
      const qtd = parseFloat(item.quantidade) || 1;
      const totalItem = (valorUnit + freteUnit) * qtd;

      const key = String(forn.fornecedor_id);
      if (!mapa[key]) {
        mapa[key] = {
          fornecedor_id: forn.fornecedor_id,
          nome: forn.nome,
          itens_count: 0,
          total: 0,
          itens: [], // detalhe pro acordeão
        };
      }
      mapa[key].itens_count += 1;
      mapa[key].total += totalItem;
      mapa[key].itens.push({
        cotacao_item_id: item.id,
        item_nome: item.nome,
        item_codigo: item.codigo || null,
        quantidade: qtd,
        valor_unit: valorUnit,
        frete_unit: freteUnit,
        modalidade: ehCIF ? 'CIF' : 'FOB',
        total: totalItem,
      });
    });
    // Maior valor primeiro — o comprador bate o olho e vê o principal.
    return Object.values(mapa).sort((a, b) => b.total - a.total);
  })();

  // Panorama executivo da RC — 3 atos:
  //   1. Sem o QuotaFlow = pior cotação de cada item (o que o comprador
  //      veria se só tivesse 1 fornecedor na mesa)
  //   2. Com o QuotaFlow = menor cotação de cada item (piso tornado
  //      visível pela plataforma ao agregar múltiplas ofertas)
  //   3. Após negociação = o que o comprador fechou (respeita seleção no
  //      radio + renegociação, CIF/FOB)
  //
  // Saving do Sistema = (1) − (2) — mérito da plataforma.
  // Saving do Comprador = (2) − (3) — mérito (ou custo) do comprador.
  //   PODE SER NEGATIVO quando ele escolhe um fornecedor pior que o
  //   menor disponível, mesmo após renegociar. Isso é intencional: o
  //   painel comunica o custo da decisão, não só o brilho da negociação.
  //
  // Itens sem nenhuma resposta não entram em (1) nem em (2) — não há
  // cotação pra comparar. Aparecem só nos contadores de pendência.
  const panoramaRC = (() => {
    let semQuotaflow = 0;
    let comQuotaflow = 0;
    let aposNegociacao = 0;

    // Total efetivo = valor + frete (frete só entra em FOB)
    const totalEfetivo = (f) => {
      const ehCIF = (f.frete_modalidade || 'CIF') === 'CIF';
      const v = parseFloat(f.valor) || 0;
      const fr = ehCIF ? 0 : (parseFloat(f.frete) || 0);
      return v + fr;
    };

    itens.forEach(item => {
      const respondidos = (item.fornecedores || [])
        .filter(f => f.status === 'respondido' && f.valor != null);
      if (respondidos.length === 0) return;

      const totais = respondidos.map(f => totalEfetivo(f));
      semQuotaflow += Math.max(...totais);
      comQuotaflow += Math.min(...totais);

      // Fechado do item: valor efetivo do fornecedor selecionado,
      // respeitando renegociação se houver.
      const fornIdSel = selecoesPorItem[item.id];
      if (fornIdSel != null) {
        const fornSel = respondidos.find(
          f => String(f.fornecedor_id) === String(fornIdSel)
        );
        if (fornSel) {
          const ehCIF = (fornSel.frete_modalidade || 'CIF') === 'CIF';
          const vUnit = fornSel.valor_renegociado != null
            ? (parseFloat(fornSel.valor_renegociado) || 0)
            : (parseFloat(fornSel.valor) || 0);
          const fUnit = ehCIF
            ? 0
            : (fornSel.frete_renegociado != null
                ? (parseFloat(fornSel.frete_renegociado) || 0)
                : (parseFloat(fornSel.frete) || 0));
          const qtd = parseFloat(item.quantidade) || 1;
          aposNegociacao += (vUnit + fUnit) * qtd;
        }
      }
    });

    return {
      semQuotaflow,
      comQuotaflow,
      aposNegociacao,
      savingSistema: semQuotaflow - comQuotaflow,
      savingComprador: comQuotaflow - aposNegociacao,
    };
  })();

  const itensSemSelecao = itens.filter(item => selecoesPorItem[item.id] == null).length;

  // Função para determinar cor da borda baseado na posição
  const getCorBorda = (posicao) => {
    if (posicao === 1) return C.success; // Verde - melhor
    if (posicao === 2) return C.warn;    // Laranja - 2º
    return '#ef4444';                    // Vermelho - pior
  };

  return (
    <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>
            MONITORAR RESPOSTAS
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>
            Cotação {cotacao.numero || `#${cotacao.id}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={abrirModalAddFornecedor}
            disabled={['finalizada', 'cancelada'].includes(cotacao.status)}
            style={{
              ...s.btn(true, C.accent),
              padding: "10px 16px",
              fontSize: 12,
              opacity: ['finalizada', 'cancelada'].includes(cotacao.status) ? 0.5 : 1,
              cursor: ['finalizada', 'cancelada'].includes(cotacao.status) ? "not-allowed" : "pointer",
            }}
          >
            + Adicionar Fornecedor
          </button>
          <button
            onClick={onVoltar}
            style={{ ...s.btn(false, C.muted), padding: "10px 16px", fontSize: 12 }}
          >
            ← Voltar
          </button>
        </div>
      </div>

      {/* (Card cinza de resumo removido — o panorama executivo agora vive
          dentro do card de VENCEDORES POR ITEM, com escopo mais rico e
          contadores no rodapé. Ver bloco PANORAMA DA RC mais abaixo.) */}

      {/* VENCEDORES POR ITEM — agregação dos fornecedores que o comprador
          marcou no radio, por total efetivo (renegociado + FOB). Substitui
          o card antigo de "melhor proposta geral", que só elegia 1 vencedor
          no agregado e ficava obsoleto a partir da Fase 1B. */}
      {fornecedoresVencedores.length > 0 && (
        <div style={{
          ...s.card,
          padding: "16px 18px",
          marginBottom: 20,
          borderLeft: `4px solid ${C.success}`
        }}>
          <div style={{ fontSize: 12, color: C.success, fontWeight: 600, marginBottom: 12 }}>
            🏆 VENCEDORES POR ITEM
          </div>
          {fornecedoresVencedores.map((v, idx) => {
            const aberto = !!vencedoresExpandidos[String(v.fornecedor_id)];
            return (
              <div
                key={v.fornecedor_id}
                style={{
                  borderBottom: idx < fornecedoresVencedores.length - 1
                    ? `1px solid ${C.border}33`
                    : "none",
                }}
              >
                {/* LINHA CABEÇALHO — clicável, toggla o acordeão */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setVencedoresExpandidos(prev => ({
                    ...prev,
                    [String(v.fornecedor_id)]: !prev[String(v.fornecedor_id)],
                  }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setVencedoresExpandidos(prev => ({
                        ...prev,
                        [String(v.fornecedor_id)]: !prev[String(v.fornecedor_id)],
                      }));
                    }
                  }}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 10,
                      color: C.muted,
                      transform: aberto ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.15s ease",
                      display: "inline-block",
                      width: 10,
                    }}>
                      ▶
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                      {v.nome}
                    </span>
                    <span style={{
                      fontSize: 10,
                      color: C.muted,
                      background: `${C.border}66`,
                      borderRadius: 4,
                      padding: "2px 6px",
                      fontWeight: 600,
                      letterSpacing: "0.03em",
                    }}>
                      {v.itens_count} {v.itens_count === 1 ? "item" : "itens"}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                    {fmtBRL(v.total)}
                  </div>
                </div>

                {/* DETALHE — lista dos itens ganhos */}
                {aberto && (
                  <div style={{
                    paddingLeft: 18,
                    paddingBottom: 10,
                    paddingTop: 4,
                  }}>
                    {v.itens.map(it => (
                      <div
                        key={it.cotacao_item_id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 60px 1fr 90px 100px",
                          gap: 8,
                          padding: "6px 0",
                          fontSize: 11,
                          color: C.muted,
                          alignItems: "center",
                        }}
                      >
                        <div style={{ color: C.text }}>
                          <span>{it.item_nome}</span>
                          {it.item_codigo && (
                            <span style={{ fontSize: 10, color: C.muted, marginLeft: 6 }}>
                              {it.item_codigo}
                            </span>
                          )}
                        </div>
                        <div style={{ textAlign: "center" }}>
                          {it.quantidade}x
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {fmtBRL(it.valor_unit)}
                          {it.modalidade === 'FOB' && it.frete_unit > 0 && (
                            <span style={{ fontSize: 10, marginLeft: 4 }}>
                              + {fmtBRL(it.frete_unit)} FOB
                            </span>
                          )}
                          {it.modalidade === 'CIF' && (
                            <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.7 }}>
                              CIF
                            </span>
                          )}
                        </div>
                        <div style={{ textAlign: "right", color: C.text, fontWeight: 600 }}>
                          {fmtBRL(it.total)}
                        </div>
                        <div />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* ─── PANORAMA DA RC — 3 atos ──────────────────────── */}
          <div style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: `1px solid ${C.border}66`,
          }}>
            <div style={{
              fontSize: 10,
              color: C.muted,
              letterSpacing: "0.08em",
              fontWeight: 600,
              marginBottom: 12,
            }}>
              PANORAMA DA RC
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
              marginBottom: 12,
            }}>
              {/* Coluna 1 — SEM o QuotaFlow (range de mercado) */}
              <div>
                <div style={{
                  fontSize: 9, color: C.muted, letterSpacing: "0.05em",
                  fontWeight: 600, marginBottom: 4,
                }}>
                  SEM O QUOTAFLOW
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                  {fmtBRL(panoramaRC.semQuotaflow)}
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                  pior cotação disponível
                </div>
              </div>

              {/* Coluna 2 — COM o QuotaFlow (piso disponível) */}
              <div>
                <div style={{
                  fontSize: 9, color: "#22c55e", letterSpacing: "0.05em",
                  fontWeight: 600, marginBottom: 4,
                }}>
                  COM O QUOTAFLOW
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#22c55e" }}>
                  {fmtBRL(panoramaRC.comQuotaflow)}
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                  menor cotação disponível
                </div>
              </div>

              {/* Coluna 3 — APÓS a negociação (desembolso final) */}
              <div>
                <div style={{
                  fontSize: 9, color: "#f59e0b", letterSpacing: "0.05em",
                  fontWeight: 600, marginBottom: 4,
                }}>
                  APÓS NEGOCIAÇÃO
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#f59e0b" }}>
                  {fmtBRL(panoramaRC.aposNegociacao)}
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                  fechado pelo comprador
                </div>
              </div>
            </div>

            {/* Savings — Sistema (verde) x Comprador (âmbar/vermelho) */}
            <div style={{
              display: "flex",
              gap: 20,
              flexWrap: "wrap",
              padding: "10px 12px",
              background: "#00000040",
              borderRadius: 8,
              marginBottom: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>
                  💰 Saving do Sistema:
                </span>
                <span style={{ fontSize: 13, color: "#22c55e", fontWeight: 700 }}>
                  {panoramaRC.savingSistema > 0
                    ? `+${fmtBRL(panoramaRC.savingSistema)}`
                    : fmtBRL(0)}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  fontSize: 11,
                  color: panoramaRC.savingComprador < 0 ? "#ef4444" : "#f59e0b",
                  fontWeight: 600,
                }}>
                  ✍️ Saving do Comprador:
                </span>
                <span style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: panoramaRC.savingComprador < 0 ? "#ef4444" : "#f59e0b",
                }}>
                  {panoramaRC.savingComprador === 0
                    ? "—"
                    : panoramaRC.savingComprador > 0
                      ? `+${fmtBRL(panoramaRC.savingComprador)}`
                      : fmtBRL(panoramaRC.savingComprador)}
                </span>
              </div>
            </div>

            {/* Contadores */}
            <div style={{
              fontSize: 10,
              color: C.muted,
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}>
              <span>📦 {resumo.total} {resumo.total === 1 ? "item" : "itens"}</span>
              <span>✅ {resumo.respondidos} {resumo.respondidos === 1 ? "respondido" : "respondidos"}</span>
              {resumo.pendentes > 0 && (
                <span style={{ color: C.warn }}>
                  ⏳ {resumo.pendentes} {resumo.pendentes === 1 ? "pendente" : "pendentes"}
                </span>
              )}
            </div>
          </div>

          {itensSemSelecao > 0 && (
            <div style={{
              fontSize: 11,
              color: C.muted,
              marginTop: 10,
              fontStyle: "italic",
            }}>
              ⏳ {itensSemSelecao} {itensSemSelecao === 1
                ? "item ainda sem fornecedor selecionado"
                : "itens ainda sem fornecedor selecionado"}
            </div>
          )}
        </div>
      )}

      {/* TABELA POR ITEM */}
      <div style={{ marginBottom: 20, overflowX: 'auto', maxWidth: '100%' }}>
        <div style={{ minWidth: 1000 }}>
          {/* TÍTULO */}
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 12 }}>
            PROPOSTAS POR ITEM
          </div>

          {itens.map((item, itemIdx) => (
            <div key={item.id} style={{ marginBottom: 16 }}>
              {/* HEADER DO ITEM */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "36px minmax(100px, 1fr) 40px minmax(110px, 1fr) 80px 80px 80px 60px 110px 110px 90px 80px",
                padding: "12px 14px",
                background: C.bg,
                borderRadius: "6px 6px 0 0",
                borderBottom: `1px solid ${C.border}`,
                fontSize: 11,
                fontWeight: 600,
                color: C.muted,
                letterSpacing: "0.05em"
              }}>
                <div></div>
                <div>ITEM</div>
                <div style={{ textAlign: "center" }}>QTD</div>
                <div>FORNECEDOR</div>
                <div style={{ textAlign: "left" }}>VALOR</div>
                <div style={{ textAlign: "left" }}>FRETE</div>
                <div style={{ textAlign: "left" }}>TOTAL</div>
                <div style={{ textAlign: "left" }}>PRAZO</div>
                <div style={{ textAlign: "left" }}>RENEGOCIADO</div>
                <div style={{ textAlign: "left" }}>FRETE RENEGOCIADO</div>
                <div style={{ textAlign: "left" }}>SAVING</div>
                <div></div>
              </div>

              {/* LINHAS DE FORNECEDORES */}
              {item.fornecedores.map((forn, fornIdx) => {
                const isMelhor = forn.posicao === 1;
                const is2Melhor = forn.posicao === 2;
                const isTemResposta = forn.status === 'respondido';
                const corBorda = isTemResposta ? getCorBorda(forn.posicao) : 'transparent';

                // Estado de seleção pra este item/fornecedor
                const selecionado = String(selecoesPorItem[item.id]) === String(forn.fornecedor_id);
                const ehSugerido = String(sugeridosPorItem[item.id]?.fornecedor_id) === String(forn.fornecedor_id);
                const itemEstaDivergindo = itemDiverge(item.id);

                return (
                  <div key={forn.id}>
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "36px minmax(100px, 1fr) 40px minmax(110px, 1fr) 80px 80px 80px 60px 110px 110px 90px 80px",
                      gap: 6,
                      padding: "12px 14px",
                      background: selecionado ? `${C.accent}11` : (itemIdx % 2 === 0 ? C.bg : "transparent"),
                      borderLeft: `4px solid ${selecionado ? C.accent : corBorda}`,
                      borderBottom: fornIdx < item.fornecedores.length - 1 ? `1px solid ${C.border}22` : `2px solid ${C.border}`,
                      alignItems: "center",
                      opacity: isTemResposta ? 1 : 0.6
                    }}>
                      {/* RADIO DE SELEÇÃO */}
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        {isTemResposta && (
                          <input
                            type="radio"
                            name={`selecao-${item.id}`}
                            checked={selecionado}
                            onChange={() => selecionarFornecedor(item.id, forn.fornecedor_id)}
                            title="Selecionar este fornecedor para o item"
                            style={{ cursor: "pointer", width: 16, height: 16 }}
                          />
                        )}
                      </div>

                      {/* ITEM + QTD */}
                      {fornIdx === 0 && (
                        <>
                          <div style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: C.text,
                          }}>
                            <div>{item.nome}</div>
                            {item.codigo && (
                              <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                                {item.codigo}
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: C.text }}>
                            {item.quantidade}
                          </div>
                        </>
                      )}
                      {fornIdx > 0 && (
                        <>
                          <div></div>
                          <div></div>
                        </>
                      )}

                      {/* FORNECEDOR + badge sugerido */}
                      <div style={{ fontSize: 12, color: C.text, fontWeight: 500, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span>{forn.nome}</span>
                        {ehSugerido && isTemResposta && (
                          <span
                            title="Menor preço — sugerido automaticamente"
                            style={{
                              fontSize: 9,
                              background: `${C.success}22`,
                              color: C.success,
                              border: `1px solid ${C.success}55`,
                              borderRadius: 4,
                              padding: "1px 6px",
                              fontWeight: 600,
                              letterSpacing: "0.03em",
                            }}>
                            ⭐ SUGERIDO
                          </span>
                        )}
                      </div>

                      {/* VALOR */}
                      <div style={{ textAlign: "right", fontSize: 12, color: C.text, fontWeight: 600 }}>
                        {isTemResposta ? fmtBRL(forn.valor) : '—'}
                      </div>

                      {/* FRETE — modalidade inline. CIF = frete já incluso
                          no valor unitário (o R$ é só conveniência visual);
                          FOB = frete cobrado à parte. */}
                      <div style={{ textAlign: "right", fontSize: 12, color: C.text, fontWeight: 600 }}>
                        {isTemResposta ? (
                          <>
                            {fmtBRL(forn.frete || 0)}
                            {forn.frete_modalidade && (
                              <span style={{
                                fontSize: 9,
                                color: C.muted,
                                marginLeft: 4,
                                fontWeight: 500,
                                letterSpacing: "0.05em",
                              }}>
                                {forn.frete_modalidade}
                              </span>
                            )}
                          </>
                        ) : '—'}
                      </div>

                      {/* TOTAL */}
                      <div style={{
                        textAlign: "right",
                        fontSize: 12,
                        fontWeight: 700,
                        color: isTemResposta ? (isMelhor ? C.success : is2Melhor ? C.warn : '#ef4444') : C.muted
                      }}>
                        {isTemResposta ? fmtBRL(forn.total) : '⏳ Aguardando'}
                      </div>

                      {/* PRAZO */}
                      <div style={{ textAlign: "center", fontSize: 11, color: C.muted }}>
                        {isTemResposta ? `${forn.prazo}d` : '—'}
                      </div>

                      {/* RENEGOCIADO */}
                      <div style={{ textAlign: "right", fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>
                        {forn.valor_renegociado ? fmtBRL(forn.valor_renegociado) : '—'}
                      </div>

                      {/* FRETE RENEGOCIADO */}
                      <div style={{ textAlign: "right", fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>
                        {forn.frete_renegociado ? fmtBRL(forn.frete_renegociado) : '—'}
                      </div>

                      {/* SAVING — só faz sentido quando o comprador JÁ
                          renegociou este item (valor_renegociado preenchido).
                          Sem renegociação, não há "saving" pra mostrar. */}
                      <div style={{ textAlign: "right", fontSize: 12, color: '#22c55e', fontWeight: 700 }}>
                        {(() => {
                          const temReneg = forn.valor_renegociado != null || forn.frete_renegociado != null;
                          if (!temReneg) return '—';
                          const saving = (parseFloat(forn.economia) || 0) + (parseFloat(forn.economia_frete) || 0);
                          return saving > 0 ? fmtBRL(saving) : '—';
                        })()}
                      </div>

                    {/* BOTÕES DE AÇÃO */}
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      {/* Reenviar email — só pra pendentes */}
                      {forn.status === 'pendente' && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await cotacoesService.reenviarEmailFornecedor(
                                token, cotacaoId, forn.fornecedor_id
                              );
                              alert(`✅ Email reenviado para ${forn.fornecedor_email}`);
                            } catch (err) {
                              alert("Erro ao reenviar: " + err.message);
                            }
                          }}
                          title="Reenviar email de cotação"
                          style={{
                            background: "transparent",
                            border: `1px solid ${C.border}`,
                            borderRadius: 6,
                            color: C.accent,
                            fontSize: 11,
                            cursor: "pointer",
                            padding: "6px 10px",
                            fontFamily: "inherit",
                          }}>
                          📤
                        </button>
                      )}

                      {/* Copiar link — sempre disponível */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = `${window.location.origin}/#/portal/cotacao/${cotacaoId}/${forn.token_acesso}`;
                          navigator.clipboard.writeText(url)
                            .then(() => alert(`✅ Link copiado:\n${url}\n\nCole no WhatsApp/email do fornecedor.`))
                            .catch(() => {
                              prompt("Copie o link abaixo:", url);
                            });
                        }}
                        title="Copiar link do portal do fornecedor"
                        style={{
                          background: "transparent",
                          border: `1px solid ${C.border}`,
                          borderRadius: 6,
                          color: C.muted,
                          fontSize: 11,
                          cursor: "pointer",
                          padding: "6px 10px",
                          fontFamily: "inherit",
                        }}>
                        🔗
                      </button>

                      {/* Editar (já existia) */}
                      <button
                        onClick={() => handleAbrirEdicao(forn)}
                        style={{
                          ...s.btn(true, C.accent),
                          padding: "6px 10px",
                          fontSize: 11
                        }}>
                        {isTemResposta ? "✏️" : "➕"}
                      </button>
                    </div>
                    </div>

                    {/* CAIXA DE JUSTIFICATIVA — só aparece no último fornecedor
                        do item divergente, pra não repetir N vezes */}
                    {fornIdx === item.fornecedores.length - 1 && itemEstaDivergindo && (
                      <div style={{
                        background: "#f59e0b11",
                        border: "1px solid #f59e0b40",
                        borderTop: "none",
                        borderRadius: "0 0 6px 6px",
                        padding: "10px 14px",
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                        <div style={{ flex: 1, minWidth: 240 }}>
                          <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600, marginBottom: 4 }}>
                            Você escolheu um fornecedor diferente do sugerido
                          </div>
                          <div style={{ fontSize: 10, color: C.muted, marginBottom: 8 }}>
                            Justifique a escolha para fins de auditoria (prazo, qualidade,
                            relacionamento comercial etc).
                          </div>
                          <input
                            type="text"
                            value={justificativas[item.id] || ""}
                            onChange={e => setJustificativas(prev => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))}
                            placeholder="Ex: prazo de entrega 3 dias vs 5 dias do sugerido"
                            style={{
                              ...s.input,
                              fontSize: 11,
                              width: "100%",
                              borderColor: !justificativas[item.id]?.trim() ? "#f59e0b" : C.border,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ─── MODAL: ADICIONAR FORNECEDOR ─────────────────────────── */}
      {modalAddForn && (() => {
        // Quantos itens desta cotação o fornecedor já cota. Usado pro
        // badge "JÁ EM N ITENS" e pra auto-desmarcar na hora do toggle.
        const contagemPorFornecedor = {};
        (dados?.itens || []).forEach(item => {
          (item.fornecedores || []).forEach(f => {
            const k = String(f.fornecedor_id);
            contagemPorFornecedor[k] = (contagemPorFornecedor[k] || 0) + 1;
          });
        });

        // Extração defensiva do CNPJ — o backend entrega `dados_cnpj`
        // já parseado (JSON), mas o nome do campo interno pode variar
        // (cnpj, CNPJ), e alguns cadastros antigos podem ter `cnpj` solto
        // na raiz do fornecedor.
        const cnpjDe = (f) =>
          f.dados_cnpj?.cnpj || f.dados_cnpj?.CNPJ || f.cnpj || null;

        const formatCnpj = (c) => {
          if (!c) return null;
          const digits = String(c).replace(/\D/g, "");
          if (digits.length !== 14) return String(c);
          return digits.replace(
            /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
            "$1.$2.$3/$4-$5"
          );
        };

        // Fix: tirei o filtro que sumia com fornecedor já vinculado.
        // Agora todo mundo aparece; o badge "JÁ EM N ITENS" avisa, e a
        // busca casa nome, e-mail e CNPJ (só dígitos, tolerante a
        // pontuação).
        const disponiveisFiltrados = fornecedoresDisponiveis
          .filter(f => {
            const q = buscaAdd.trim();
            if (!q) return true;
            const qLower = q.toLowerCase();
            const qDigits = q.replace(/\D/g, "");
            const cnpjDigits = String(cnpjDe(f) || "").replace(/\D/g, "");
            const matchNome = (f.nome || "").toLowerCase().includes(qLower);
            const matchEmail = (f.email || "").toLowerCase().includes(qLower);
            const matchCnpj = qDigits.length >= 3 && cnpjDigits.includes(qDigits);
            return matchNome || matchEmail || matchCnpj;
          });

        return (
          <div style={{ position: "fixed", inset: 0, background: "#00000090",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        zIndex: 400, padding: 20 }}>
            <div style={{ ...s.card, width: 520, maxWidth: "100%",
                          maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}`,
                            display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                    Adicionar fornecedor
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    Cotação {cotacao.numero || `#${cotacao.id}`}
                  </div>
                </div>
                <button onClick={() => setModalAddForn(false)}
                  style={{ background: "transparent", border: "none",
                           color: C.muted, fontSize: 20, cursor: "pointer",
                           lineHeight: 1 }}>×</button>
              </div>

              <div style={{ padding: "14px 22px 0" }}>
                <input type="text" value={buscaAdd}
                  onChange={e => setBuscaAdd(e.target.value)}
                  placeholder="Buscar por nome, e-mail ou CNPJ..."
                  autoFocus
                  style={{ ...s.input, padding: "8px 12px", fontSize: 12 }} />
              </div>

              <div style={{ padding: "14px 22px", overflowY: "auto", flex: 1 }}>
                {/* Seção 1: Fornecedores */}
                <div style={{ fontSize: 10, color: C.muted,
                              letterSpacing: "0.08em", fontWeight: 600,
                              marginBottom: 8 }}>
                  FORNECEDORES
                </div>

                    {/* (Seção "JÁ NESTA COTAÇÃO" removida — agora
                    cada fornecedor carrega o badge "JÁ EM N ITENS" na
                    própria linha, que é mais preciso e não polui o topo.) */}

                {carregandoForns ? (
                  <div style={{ color: C.muted, textAlign: "center", padding: 20 }}>
                    Carregando fornecedores...
                  </div>
                ) : fornecedoresDisponiveis.length === 0 ? (
                  <div style={{ color: C.muted, textAlign: "center", padding: 20, fontSize: 12 }}>
                    Nenhum fornecedor cadastrado. Cadastre em <strong>Fornecedores</strong> antes.
                  </div>
                ) : disponiveisFiltrados.length === 0 ? (
                  <div style={{ color: C.muted, textAlign: "center", padding: 20, fontSize: 12 }}>
                    {buscaAdd ? `Nenhum fornecedor novo encontrado para "${buscaAdd}".` : "Todos os fornecedores já estão nesta cotação."}
                  </div>
                ) : (
                  disponiveisFiltrados.map(f => {
                    const marcado = selecionadosAdd.includes(f.id);
                    const jaEm = contagemPorFornecedor[String(f.id)] || 0;
                    const cnpj = formatCnpj(cnpjDe(f));
                    return (
                      <label key={f.id} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", marginBottom: 6,
                        background: marcado ? `${C.accent}15` : C.bg,
                        border: `1px solid ${marcado ? C.accent : C.border}`,
                        borderRadius: 6, cursor: "pointer",
                      }}>
                        <input type="checkbox" checked={marcado}
                          onChange={() => toggleAddFornecedor(f.id)}
                          style={{ cursor: "pointer" }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 12, color: C.text, fontWeight: 500,
                            display: "flex", alignItems: "center",
                            gap: 6, flexWrap: "wrap",
                          }}>
                            <span>{f.nome}</span>
                            {jaEm > 0 && (
                              <span style={{
                                fontSize: 9,
                                color: C.success,
                                background: `${C.success}22`,
                                border: `1px solid ${C.success}55`,
                                borderRadius: 4,
                                padding: "1px 6px",
                                fontWeight: 600,
                                letterSpacing: "0.03em",
                              }}>
                                JÁ EM {jaEm} {jaEm === 1 ? "ITEM" : "ITENS"}
                              </span>
                            )}
                          </div>
                          {(f.email || cnpj) && (
                            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                              {f.email}
                              {f.email && cnpj && " · "}
                              {cnpj}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>

              {/* Seção 2: Itens que estes fornecedores vão cotar */}
              <div style={{ padding: "14px 22px 0 22px", borderTop: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between",
                              alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted,
                                letterSpacing: "0.08em", fontWeight: 600 }}>
                    ITENS QUE ESTES FORNECEDORES VÃO COTAR
                  </div>
                  <button
                    onClick={() => setItensSelecionados(
                      itensSelecionados.length === (dados?.itens || []).length
                        ? []
                        : (dados?.itens || []).map(i => i.id)
                    )}
                    style={{ background: "transparent", border: "none",
                             color: C.accent, fontSize: 10,
                             cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                    {itensSelecionados.length === (dados?.itens || []).length ? "Desmarcar todos" : "Marcar todos"}
                  </button>
                </div>

                <div style={{ paddingBottom: 14 }}>
                  {(dados?.itens || []).map(item => {
                    const marcado = itensSelecionados.includes(item.id);
                    return (
                      <label key={item.id} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 12px", marginBottom: 4,
                        background: marcado ? `${C.accent}11` : "transparent",
                        border: `1px solid ${marcado ? C.accent + "55" : C.border}33`,
                        borderRadius: 6, cursor: "pointer",
                      }}>
                        <input type="checkbox" checked={marcado}
                          onChange={() => toggleItemAdd(item.id)}
                          style={{ cursor: "pointer" }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: C.text }}>
                            {item.nome}
                          </div>
                          {item.codigo && (
                            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                              {item.codigo}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: C.muted }}>
                          Qtd: {item.quantidade}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ padding: "14px 22px", borderTop: `1px solid ${C.border}`,
                            display: "flex", gap: 10 }}>
                <button onClick={() => setModalAddForn(false)} disabled={adicionando}
                  style={{ ...s.btn(false), flex: 1, padding: "8px 16px" }}>
                  Cancelar
                </button>
                <button onClick={confirmarAdicionarFornecedores}
                  disabled={selecionadosAdd.length === 0 || itensSelecionados.length === 0 || adicionando}
                  style={{ ...s.btn(true), flex: 1, padding: "8px 16px",
                           opacity: (selecionadosAdd.length === 0 || itensSelecionados.length === 0 || adicionando) ? 0.5 : 1 }}>
                  {adicionando
                    ? "Adicionando..."
                    : `Adicionar ${selecionadosAdd.length} forn. · ${itensSelecionados.length} itens`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* BOTÃO FINALIZAR — emite 1 OC por fornecedor */}
      <button
        onClick={handleEmitirOCs}
        disabled={!todosItensComSelecao || atualizando}
        style={{
          ...s.btn(todosItensComSelecao && !atualizando, temDivergencia ? C.warn : C.success),
          width: "100%",
          padding: "12px 16px",
          fontSize: 14,
          fontWeight: 600,
          opacity: (!todosItensComSelecao || atualizando) ? 0.5 : 1,
          background: temDivergencia ? "#f59e0b" : C.success,
          border: `1px solid ${temDivergencia ? "#f59e0b" : C.success}`,
        }}
      >
        {atualizando
          ? "Emitindo..."
          : !todosItensComSelecao
            ? "Selecione um fornecedor para cada item"
            : temDivergencia
              ? `⚠ Justificar e Emitir ${fornecedoresUnicos.length} OC(s)`
              : `📋 Emitir ${fornecedoresUnicos.length} OC(s)`}
      </button>
    </div>
  );
}