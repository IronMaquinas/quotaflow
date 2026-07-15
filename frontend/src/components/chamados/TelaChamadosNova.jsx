import { useState, useEffect, useRef } from "react";
import { useChamados } from "../../hooks/useChamados";
import { useEquipamentos } from "../../hooks/useEquipamentos";

export default function TelaChamadosNova({ fmtBRL, fmtD, C, s }) {
  const { chamados, loading, erro, carregar, criar, atualizar, deletar } = useChamados();
  const { equipamentos } = useEquipamentos();

  // Restante dos estados continua igual
  const [telaAtual, setTelaAtual] = useState("lista");
  const [chamadoSel, setChamadoSel] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroUrgencia, setFiltroUrgencia] = useState("todos");
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);
  const [processando, setProcessando] = useState(false);

  // Autocomplete de equipamento
  const [eqSearch, setEqSearch] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const eqRef = useRef(null);

  // Estado do formulário (com lista de itens)
  const [form, setForm] = useState({
    equipamentoId: "",
    descricaoGeral: "",
    itens: [
      { id: Date.now(), item_nome: "", codigo: "", quantidade: 1, urgencia: "media", categoria: "corretiva", tipo_item: "", descricao: "" }
    ]
  });

// 1️⃣ CARREGAR DADOS
useEffect(() => {
  carregar();
}, []);

// 2️⃣ FECHAR DROPDOWN
useEffect(() => {
  const handleClickOutside = (e) => {
    if (eqRef.current && !eqRef.current.contains(e.target)) {
      setShowDrop(false);
    }
  };
  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);

// 3️⃣ LOG DE DEPURAÇÃO (NOVO)
useEffect(() => {
  chamados.forEach(ch => {
  });
}, [chamados]);

  // Equipamentos filtrados para autocomplete
  const eqFiltrados = (equipamentos || [])
    .filter(e => e.ativo !== false)
    .filter(e =>
      e.nome.toLowerCase().includes(eqSearch.toLowerCase()) ||
      e.tag.toLowerCase().includes(eqSearch.toLowerCase())
    );

  // Filtrar chamados
  const chamadosFiltered = (chamados || [])
    .filter(c => filtroStatus === "todos" || c.status === filtroStatus)
    .filter(c => {
      if (filtroUrgencia === "todos") return true;
      if (c.urgencia === filtroUrgencia) return true;
      if (c.itens && c.itens.some(item => item.urgencia === filtroUrgencia)) return true;
      return false;
    })
    .filter(c => {
      if (!busca) return true;
      const text = busca.toLowerCase();
      if (c.itens && c.itens.some(item => item.item_nome.toLowerCase().includes(text) || (item.codigo && item.codigo.toLowerCase().includes(text)))) {
        return true;
      }
      return (c.peca && c.peca.toLowerCase().includes(text)) || (c.codigo && c.codigo.toLowerCase().includes(text));
    });

  // Funções para manipular itens
  const adicionarItem = () => {
    setForm(f => ({
      ...f,
      itens: [...f.itens, { id: Date.now() + Math.random(), item_nome: "", codigo: "", quantidade: 1, urgencia: "media", categoria: "corretiva", tipo_item: "", descricao: "" }]
    }));
  };

  const removerItem = (id) => {
    if (form.itens.length === 1) {
      alert("É necessário pelo menos um item.");
      return;
    }
    if (!window.confirm("Remover este item?")) return;
    setForm(f => ({
      ...f,
      itens: f.itens.filter(item => item.id !== id)
    }));
  };

  const atualizarItem = (id, campo, valor) => {
    setForm(f => ({
      ...f,
      itens: f.itens.map(item => item.id === id ? { ...item, [campo]: valor } : item)
    }));
  };

  // Submit
  const handleSubmit = async () => {

    // ✅ PRIMEIRO: Declarar e calcular itensValidos
    const itensValidos = form.itens.filter(item => item.item_nome.trim() !== "");

    if (itensValidos.length === 0) {
      alert("Adicione pelo menos um item com nome preenchido.");
      return;
    }

    // ✅ SEGUNDO: Criar o payload (agora itensValidos existe)
    const payload = {
      equipamento_id: form.equipamentoId || null,
      descricao_geral: form.descricaoGeral,
      itens: itensValidos.map(item => ({
        item_nome: item.item_nome,
        codigo: item.codigo,
        quantidade: parseInt(item.quantidade) || 1,
        urgencia: item.urgencia,
        categoria: item.categoria,
        tipo_item: item.tipo_item,
        descricao: item.descricao
      }))
    };

    // ✅ TERCEIRO: Processar (agora payload existe)
    setProcessando(true);
    try {
      if (modal === "editar") {
          const resposta = await atualizar(chamadoSel.id, payload);
          setChamadoSel(resposta);  // ← Adicione isto
          setTelaAtual("detalhe");  // ← E isto
          alert("Chamado atualizado com sucesso!");
        } else {
        const resposta = await criar(payload);
        await carregar(); // recarrega sem força (já está cache)
        alert("Chamado criado com sucesso!");
      }

      setModal(null);
      resetForm();
    } catch (e) {
      console.error("❌ Erro detalhado:", e);
      console.error("❌ Stack:", e.stack);
      alert("Erro: " + (e.message || "Ocorreu um erro inesperado"));
    } finally {
      setProcessando(false);
    }
  };

  const resetForm = () => {
    setForm({
      equipamentoId: "",
      descricaoGeral: "",
      itens: [{ id: Date.now(), item_nome: "", codigo: "", quantidade: 1, urgencia: "media", categoria: "corretiva", tipo_item: "", descricao: "" }]
    });
    setEqSearch("");
    setShowDrop(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MODAL
  // ─────────────────────────────────────────────────────────────────────────
  if (modal === "novo" || modal === "editar") {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
        <div style={{ ...s.card, width: 700, maxWidth: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 48px #00000060" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
              {modal === "novo" ? "Novo Chamado" : "Editar Chamado"}
            </div>
            <button onClick={() => { setModal(null); resetForm(); }} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>

          <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
            {/* Equipamento com autocomplete (opcional) */}
            <div style={{ marginBottom: 14, position: "relative" }} ref={eqRef}>
              <label style={s.label}>EQUIPAMENTO (OPCIONAL)</label>
              <input
                type="text"
                value={
                  form.equipamentoId
                    ? (equipamentos || []).find(e => e.id === parseInt(form.equipamentoId))?.nome || eqSearch
                    : eqSearch
                }
                onChange={e => {
                  setEqSearch(e.target.value);
                  setForm(f => ({ ...f, equipamentoId: "" }));
                  setShowDrop(true);
                }}
                onFocus={() => setShowDrop(true)}
                placeholder="Buscar equipamento por nome ou TAG..."
                style={s.input}
              />

              {showDrop && eqFiltrados.length > 0 && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: "#1a2233",
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  zIndex: 50,
                  marginTop: 4,
                  maxHeight: 200,
                  overflowY: "auto"
                }}>
                  {eqFiltrados.map(eq => (
                    <div
                      key={eq.id}
                      onClick={() => {
                        setForm(f => ({ ...f, equipamentoId: eq.id }));
                        setEqSearch(`${eq.tag} - ${eq.nome}`);
                        setShowDrop(false);
                      }}
                      style={{
                        padding: "10px 14px",
                        cursor: "pointer",
                        borderBottom: `1px solid ${C.border}22`
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "#1e2a3f"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div style={{ fontSize: 13, color: C.text }}>{eq.nome}</div>
                      <div style={{ fontSize: 11, color: C.accent }}>{eq.tag} · {eq.local}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Descrição geral */}
            <div style={{ marginBottom: 14 }}>
              <label style={s.label}>DESCRIÇÃO GERAL (OPCIONAL)</label>
              <textarea
                value={form.descricaoGeral}
                onChange={e => setForm(f => ({ ...f, descricaoGeral: e.target.value }))}
                placeholder="Observações gerais sobre o chamado"
                style={{ ...s.input, minHeight: 60, resize: "vertical" }}
              />
            </div>

            {/* Lista de itens */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={s.label}>ITENS SOLICITADOS</label>
                <button
                  onClick={adicionarItem}
                  style={{ ...s.btn(true), padding: "4px 12px", fontSize: 11 }}
                >
                  + Adicionar Item
                </button>
              </div>

              {form.itens.map((item, index) => (
                <div key={item.id} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>Item #{index + 1}</span>
                    <button
                      onClick={() => removerItem(item.id)}
                      style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: 14, cursor: "pointer" }}
                      title="Remover item"
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 80px", gap: 10 }}>
                    <div>
                      <label style={{ ...s.label, fontSize: 10 }}>NOME *</label>
                      <input
                        type="text"
                        value={item.item_nome}
                        onChange={e => atualizarItem(item.id, "item_nome", e.target.value)}
                        placeholder="Ex: Rolamento SKF 6205"
                        style={s.input}
                      />
                    </div>
                    <div>
                      <label style={{ ...s.label, fontSize: 10 }}>CÓDIGO</label>
                      <input
                        type="text"
                        value={item.codigo}
                        onChange={e => atualizarItem(item.id, "codigo", e.target.value)}
                        placeholder="Ex: SKF-6205"
                        style={s.input}
                      />
                    </div>
                    <div>
                      <label style={{ ...s.label, fontSize: 10 }}>QTD</label>
                      <input
                        type="number"
                        value={item.quantidade}
                        onChange={e => atualizarItem(item.id, "quantidade", e.target.value)}
                        min="1"
                        style={{ ...s.input, textAlign: "center" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 8 }}>
                    <div>
                      <label style={{ ...s.label, fontSize: 10 }}>URGÊNCIA</label>
                      <select
                        value={item.urgencia}
                        onChange={e => atualizarItem(item.id, "urgencia", e.target.value)}
                        style={{ ...s.input, appearance: "none" }}
                      >
                        <option value="baixa">Baixa</option>
                        <option value="media">Média</option>
                        <option value="alta">Alta</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ ...s.label, fontSize: 10 }}>CATEGORIA</label>
                      <select
                        value={item.categoria}
                        onChange={e => atualizarItem(item.id, "categoria", e.target.value)}
                        style={{ ...s.input, appearance: "none" }}
                      >
                        <option value="corretiva">Corretiva</option>
                        <option value="preventiva">Preventiva</option>
                        <option value="preditiva">Preditiva</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ ...s.label, fontSize: 10 }}>TIPO DO ITEM</label>
                      <select
                        value={item.tipo_item}
                        onChange={e => atualizarItem(item.id, "tipo_item", e.target.value)}
                        style={{ ...s.input, appearance: "none" }}
                      >
                        <option value="">Selecione</option>
                        <option value="componente">Componente</option>
                        <option value="consumivel">Consumível</option>
                        <option value="insumo">Insumo</option>
                        <option value="servico">Serviço</option>
                        <option value="escritorio">Material de escritório</option>
                        <option value="facilities">Facilities</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <label style={{ ...s.label, fontSize: 10 }}>DESCRIÇÃO (OPCIONAL)</label>
                    <input
                      type="text"
                      value={item.descricao || ""}
                      onChange={e => atualizarItem(item.id, "descricao", e.target.value)}
                      placeholder="Detalhes adicionais sobre este item"
                      style={s.input}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, padding: "14px 22px", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
            <button onClick={() => { setModal(null); resetForm(); }} style={{ ...s.btn(false), flex: 1, padding: "8px 16px" }}>Cancelar</button>
            <button
              onClick={handleSubmit}
              disabled={processando}
              style={{
                ...s.btn(true),
                flex: 1,
                padding: "8px 16px",
                opacity: processando ? 0.5 : 1,
                cursor: processando ? "not-allowed" : "pointer",
              }}
            >
              {processando ? "Salvando..." : modal === "novo" ? "Criar Chamado" : "Atualizar Chamado"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LISTA DE CHAMADOS (mesma de antes)
  // ─────────────────────────────────────────────────────────────────────────
  if (telaAtual === "lista") {
    
    return (
      <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>MANUTENÇÃO</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Chamados / Requisições</div>
          </div>
          <button
            onClick={() => { resetForm(); setModal("novo"); }}
            style={{ ...s.btn(true), padding: "9px 20px", fontSize: 12 }}
          >
            ➕ Novo Chamado
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Buscar por item ou código..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ ...s.input, flex: 1, minWidth: 200, padding: "8px 12px", fontSize: 12 }}
          />
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { id: "todos", label: "Todos" },
              { id: "aberto", label: "Aberto" },
              { id: "cotando", label: "Cotando" },
              { id: "finalizado", label: "Finalizado" },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFiltroStatus(f.id)}
                style={{
                  background: filtroStatus === f.id ? C.accent : "transparent",
                  border: `1px solid ${filtroStatus === f.id ? C.accent : C.border}`,
                  borderRadius: 6,
                  padding: "6px 14px",
                  color: filtroStatus === f.id ? "white" : C.muted,
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { id: "todos", label: "Urgência: Todas" },
              { id: "alta", label: "Alta" },
              { id: "media", label: "Média" },
              { id: "baixa", label: "Baixa" },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFiltroUrgencia(f.id)}
                style={{
                  background: filtroUrgencia === f.id ? C.accent : "transparent",
                  border: `1px solid ${filtroUrgencia === f.id ? C.accent : C.border}`,
                  borderRadius: 6,
                  padding: "6px 14px",
                  color: filtroUrgencia === f.id ? "white" : C.muted,
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading && <div style={{ color: C.muted, padding: 20, textAlign: "center" }}>Carregando...</div>}
        {erro && <div style={{ color: "#ef4444", padding: 20, background: "#ef444422", borderRadius: 8, marginBottom: 16 }}>{erro}</div>}

        {!loading && chamadosFiltered.length === 0 ? (
          <div style={{ ...s.card, padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔧</div>
            <div style={{ fontSize: 14, color: C.text, fontWeight: 500, marginBottom: 4 }}>Nenhum chamado encontrado</div>
            <div style={{ fontSize: 12, color: C.muted }}>Crie um novo chamado para solicitar uma peça</div>
          </div>
        ) : (
          <div style={{ ...s.card, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 120px 100px 80px 80px 100px", padding: "10px 18px", background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, letterSpacing: "0.08em" }}>
              <span>NÚMERO</span>
              <span>ITEM / QTD</span>
              <span>DATA ABERTURA</span>
              <span>URGÊNCIA</span>
              <span>CATEGORIA</span>
              <span>STATUS</span>
              <span></span>
            </div>
            {chamadosFiltered.map((chamado, i) => {
              const primeiroItem = chamado.itens && chamado.itens.length > 0 ? chamado.itens[0] : null;
              const nomeExibicao = primeiroItem ? primeiroItem.item_nome : (chamado.peca || "—");
              const qtdExibicao = primeiroItem ? primeiroItem.quantidade : 1;
              const urgenciaExibicao = primeiroItem ? primeiroItem.urgencia : chamado.urgencia;
              const categoriaExibicao = primeiroItem ? primeiroItem.categoria : chamado.categoria;
              const totalItens = chamado.itens ? chamado.itens.length : 1;

              const statusCfg = {
                aberto: { l: "Aberto", c: C.muted },
                cotando: { l: "Cotando", c: C.warn },
                finalizado: { l: "Finalizado", c: C.success },
              }[chamado.status] || { l: chamado.status, c: C.muted };

              const urgenciaCfg = {
                alta: { l: "Alta", c: "#ef4444" },
                media: { l: "Média", c: C.warn },
                baixa: { l: "Baixa", c: C.success },
              }[urgenciaExibicao] || { l: urgenciaExibicao, c: C.muted };

              const categoriaCfg = {
                corretiva: { l: "Corretiva", c: "#ef4444" },
                preventiva: { l: "Preventiva", c: C.success },
                preditiva: { l: "Preditiva", c: C.accent },
              }[categoriaExibicao] || { l: categoriaExibicao, c: C.muted };

              return (
                <div
                  key={chamado.id}
                  style={{ display: "grid", gridTemplateColumns: "1fr 2fr 120px 100px 80px 80px 100px", padding: "13px 18px", borderBottom: i < chamadosFiltered.length - 1 ? `1px solid ${C.border}22` : "none", alignItems: "center" }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>
                    {chamado.numero}
                    {totalItens > 1 && <span style={{ fontSize: 9, color: C.muted, marginLeft: 4 }}>({totalItens} itens)</span>}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{nomeExibicao}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>Qtd: {qtdExibicao}</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>{fmtD(chamado.aberto_em)}</div>
                  <div style={{ ...s.tag(urgenciaCfg.c), fontSize: 10 }}>{urgenciaCfg.l}</div>
                  <div style={{ ...s.tag(categoriaCfg.c), fontSize: 10 }}>{categoriaCfg.l}</div>
                  <div style={{ ...s.tag(statusCfg.c), fontSize: 10 }}>{statusCfg.l}</div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button
                      onClick={() => { setChamadoSel(chamado); setTelaAtual("detalhe"); }}
                      style={{ ...s.btn(true), padding: "4px 10px", fontSize: 10 }}
                    >
                      Ver
                    </button>
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
  // DETALHE (com tabela de itens)
  // ─────────────────────────────────────────────────────────────────────────
  if (telaAtual === "detalhe" && chamadoSel) {
    const equipamento = (equipamentos || []).find(e => e.id === chamadoSel.equipamento_id);
    const itens = chamadoSel.itens || [];
    return (
      <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
        <button
          onClick={() => { setTelaAtual("lista"); setChamadoSel(null); }}
          style={{ background: "transparent", border: "none", color: C.accent, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 16 }}
        >
          ← Voltar para chamados
        </button>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>DETALHES DO CHAMADO</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.accent, fontFamily: "'IBM Plex Mono',monospace", marginBottom: 4 }}>
                {chamadoSel.numero}
              </div>
              <div style={{ fontSize: 14, color: C.text }}>{equipamento?.nome || "Equipamento não informado"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>ABERTO EM</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{fmtD(chamadoSel.aberto_em)}</div>
            </div>
          </div>
        </div>

        <div style={{ ...s.card, padding: "16px 18px", marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", marginBottom: 12 }}>ITENS SOLICITADOS</div>
          {itens.length === 0 ? (
            <div style={{ color: C.muted, fontSize: 12 }}>Nenhum item cadastrado</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 10, color: C.muted, fontWeight: 600 }}>ITEM</th>
                    <th style={{ padding: "6px 10px", textAlign: "center", fontSize: 10, color: C.muted, fontWeight: 600 }}>QTD</th>
                    <th style={{ padding: "6px 10px", textAlign: "center", fontSize: 10, color: C.muted, fontWeight: 600 }}>URG.</th>
                    <th style={{ padding: "6px 10px", textAlign: "center", fontSize: 10, color: C.muted, fontWeight: 600 }}>CAT.</th>
                    <th style={{ padding: "6px 10px", textAlign: "center", fontSize: 10, color: C.muted, fontWeight: 600 }}>TIPO</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item) => (
                    <tr key={item.id} style={{ borderBottom: `1px solid ${C.border}22` }}>
                      <td style={{ padding: "8px 10px", fontSize: 12, color: C.text }}>
                        <div>{item.item_nome}</div>
                        {item.codigo && <div style={{ fontSize: 10, color: C.muted }}>{item.codigo}</div>}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "center", fontSize: 12, color: C.text }}>{item.quantidade}</td>
                      <td style={{ padding: "8px 10px", textAlign: "center" }}>
                        <span style={{ ...s.tag({ alta: "#ef4444", media: C.warn, baixa: C.success }[item.urgencia] || C.muted), fontSize: 9 }}>
                          {item.urgencia}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "center" }}>
                        <span style={{ ...s.tag({ corretiva: "#ef4444", preventiva: C.success, preditiva: C.accent }[item.categoria] || C.muted), fontSize: 9 }}>
                          {item.categoria}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "center", fontSize: 11, color: C.muted }}>{item.tipo_item || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {chamadoSel.descricao && (
            <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}22`, paddingTop: 12 }}>
              <div style={{ fontSize: 10, color: C.muted }}>OBSERVAÇÕES GERAIS</div>
              <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>{chamadoSel.descricao}</div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => {
              const itensForm = (chamadoSel.itens || []).map(item => ({
                id: Date.now() + Math.random(),
                item_nome: item.item_nome || "",
                codigo: item.codigo || "",
                quantidade: item.quantidade || 1,
                urgencia: item.urgencia || "media",
                categoria: item.categoria || "corretiva",
                tipo_item: item.tipo_item || "",
                descricao: item.descricao || ""
              }));
              setForm({
                equipamentoId: chamadoSel.equipamento_id || "",
                descricaoGeral: chamadoSel.descricao || "",
                itens: itensForm.length > 0 ? itensForm : [{ id: Date.now(), item_nome: "", codigo: "", quantidade: 1, urgencia: "media", categoria: "corretiva", tipo_item: "", descricao: "" }]
              });
              setEqSearch("");
              setModal("editar");
            }}
            style={{ ...s.btn(true), padding: "9px 20px", fontSize: 12 }}
          >
            ✏️ Editar
          </button>
          <button
            onClick={() => {
              if (window.confirm("Tem certeza que deseja excluir este chamado?")) {
                deletar(chamadoSel.id).then(() => setTelaAtual("lista"));
              }
            }}
            style={{ ...s.btn(false), padding: "9px 20px", fontSize: 12, border: "1px solid #ef4444", color: "#ef4444" }}
          >
            🗑 Deletar
          </button>
        </div>
      </div>
    );
  }

  return null;
}