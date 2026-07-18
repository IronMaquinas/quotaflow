// components/catalogo/TelaCatalogo.jsx
/**
 * TELA COMPLETA DE CADASTRO DE ITENS (versão corrigida com props)
 * 
 * ✅ RECEBE itens e fornecedores como PROPS do App.jsx
 * ✅ Dados persistem quando você navega entre telas
 * ✅ Usa fornecedores reais do seu banco de dados
 * 
 * Props esperadas:
 * - itens: array de itens do catálogo (do App.jsx)
 * - setItens: função para atualizar itens (do App.jsx)
 * - fornecedores: array de fornecedores reais (do App.jsx)
 * - C, s, fmtBRL: cores, estilos, formatação
 */

import { useState, useEffect, useCallback } from "react";
import {
  calcularSimilaridade,
  normalizarTexto,
  detectarCategoriaAutomatica,
  extrairPalavrasChave,
  encontrarSimilares,
  validarItem,
  processarCSV,
  sugerirCategoria,
  exportarCSV,
} from "../../services/catalogoService";

export default function TelaCatalogo({ 
  itens = [],
  setItens = () => {},
  fornecedores = [],
  catalogo = {},
  C, s, fmtBRL 
}) {
  // ──────────────────────────────────────────────────────────
  // ESTADO LOCAL (apenas UI, não dados principais)
  // ──────────────────────────────────────────────────────────

  const [abaPrincipal, setAbaPrincipal] = useState("lista"); // lista | novo | importar
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [modal, setModal] = useState(null); // null | novo | editar | vinculaForn

  // Estado do formulário novo item
  const [formNovoItem, setFormNovoItem] = useState({
    nome: "",
    codigo: "",
    categoria: "",
    marca: "",
    modelo: "",
    ano_modelo: "",
  });

  // Estado de importação
  const [importacao, setImportacao] = useState({
    csv: "",
    preview: [],
    erros: [],
    carregando: false,
  });

  // Estado de similaridade
  const [similares, setSimilares] = useState([]);
  const [mostrarSimilares, setMostrarSimilares] = useState(false);

  // Estado de vinculação fornecedor
  const [vinculacaoForm, setVinculacaoForm] = useState({
    itemId: null,
    fornecedorId: null,
    precoUnitario: "",
    estoqueStatus: "em_estoque",
    tempoEntrega: 3,
  });

  const [importFornecedor, setImportFornecedor] = useState({
    fornecedorSelecionado: null,
    csvRaw: "",
    preview: [],
    matching: [],
    carregando: false,
    etapa: "selecionar",
  });

  const [importForn, setImportForn] = useState({
    fornecedorSelecionado: null,
    arquivo: null,
    carregando: false,
    mensagem: null,
  });

  // ────────────────────────────────────────────────────────────────
  // FUNÇÕES
  // ────────────────────────────────────────────────────────────────
  
  // --- Importar Fornecedor ---

  const handleImportarFornecedor = useCallback(async () => {
    if (!importForn.fornecedorSelecionado) {
      alert("Selecione um fornecedor");
      return;
    }
  
    if (!importForn.arquivo) {
      alert("Selecione um arquivo CSV");
      return;
    }
  
    setImportForn((prev) => ({ ...prev, carregando: true, mensagem: "Processando..." }));
  
    try {
      
  console.log('🔍 DEBUG Fornecedor:', importForn.fornecedorSelecionado);
  console.log('🔍 DEBUG Arquivo:', importForn.arquivo?.name);

      // ✅ ENVIAR PARA O BACKEND (FormData)
      const formData = new FormData();
      formData.append('fornecedor_id', importForn.fornecedorSelecionado.id);
      formData.append('arquivo', importForn.arquivo);
  
      const token = localStorage.getItem('access_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  console.log('🔍 DEBUG URL:', `${apiUrl}/catalogo/importar-fornecedor`); // ← Ver URL
  console.log('🔍 DEBUG Token:', token ? 'Existe' : 'Faltando!'); // ← Ver token


      const response = await fetch(`${apiUrl}/catalogo/importar-fornecedor`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
  
      if (!response.ok) {
        const erro = await response.json();
        console.error('❌ Erro do backend:', erro); // ← Ver resposta de erro

        throw new Error(erro.erro || 'Erro ao importar');
      }
  
      const data = await response.json();
      console.log('✅ Resposta do backend:', data);  // ← AQUI!
  
      // ✅ RECARREGAR ITENS DO BANCO
      console.log('🔍 Antes de carregar:', catalogo);

      if (typeof catalogo?.carregar === 'function') {
        console.log('📥 Carregando itens...');
        await catalogo.carregar();
        console.log('✅ Itens carregados:', catalogo.itens);
      } else {
        console.log('❌ catalogo.carregar não é função!');
      }
  
      // Reset formulário
      setImportForn({
        fornecedorSelecionado: null,
        arquivo: null,
        carregando: false,
        mensagem: null,
      });
  
      setAbaPrincipal("lista");
      
      alert(
        `✅ Importação concluída!\n${data.dados.criados} itens criados\n${data.dados.vinculados} itens vinculados`
      );
    } catch (e) {
      console.error('Erro ao importar:', e);
      alert("Erro: " + e.message);
      setImportForn((prev) => ({ ...prev, carregando: false, mensagem: null }));
    }
  }, [importForn, catalogo]);

  /**
   * Processa CSV e faz fuzzy matching contra catálogo
   */
  const handleProcessarCSVFornecedor = useCallback(() => {
    if (!importFornecedor.fornecedorSelecionado) {
      alert("Selecione um fornecedor");
      return;
    }
  
    if (!importFornecedor.csvRaw.trim()) {
      alert("Cole ou envie um CSV");
      return;
    }
  
    // Parse CSV
    const resultado = processarCSV(importFornecedor.csvRaw);
    if (resultado.erro) {
      alert(resultado.erro);
      return;
    }
  
    const itensCSV = resultado.itens;
  
    // Fuzzy matching: cada item do CSV contra catálogo
    const matching = itensCSV.map((itemCSV) => {
      // Procura similares no catálogo
      const similares = encontrarSimilares(itemCSV.nome, itens, 65);
  
      if (similares.length > 0) {
        // Encontrou item similar
        const melhorMatch = similares[0]; // O mais similar
        return {
          itemCSV,
          itemCatalogo: melhorMatch.item,
          similaridade: Math.round(melhorMatch.similaridade),
          acao: "vincular", // vincular ao existente
          jaCadastrado: true,
        };
      } else {
        // Item novo
        return {
          itemCSV,
          itemCatalogo: null,
          similaridade: 0,
          acao: "criar", // criar novo no catálogo
          jaCadastrado: false,
        };
      }
    });
  
    setImportFornecedor((prev) => ({
      ...prev,
      preview: itensCSV,
      matching,
      etapa: "matching",
    }));
  }, [importFornecedor.fornecedorSelecionado, importFornecedor.csvRaw, itens]);
  
  /**
   * Usuário pode revisar e mudar ação de matching
   */
  const handleAjustarMatching = useCallback((indice, novaAcao) => {
    setImportFornecedor((prev) => ({
      ...prev,
      matching: prev.matching.map((m, i) =>
        i === indice ? { ...m, acao: novaAcao } : m
      ),
    }));
  }, []);
  
  /**
   * Confirma e cria/vincula itens ao fornecedor
   */
  const handleConfirmarImportFornecedor = useCallback(async () => {
    setImportFornecedor((prev) => ({ ...prev, carregando: true, etapa: "confirmando" }));
  
    try {
      const fornecedorId = importFornecedor.fornecedorSelecionado.id;
      let itensAdicionados = 0;
      let itensVinculados = 0;
  
      // Processa cada matching
      for (const m of importFornecedor.matching) {
        if (m.acao === "criar") {
          // Criar novo item no catálogo
          const novoItem = {
            id: Date.now() + Math.random(),
            ...m.itemCSV,
            categoria: m.itemCSV.categoria || detectarCategoriaAutomatica(m.itemCSV.nome),
            fornecedores: [
              {
                fornecedorId,
                fornecedorNome: importFornecedor.fornecedorSelecionado.nome,
                precoUnitario: 0, // Será preenchido depois
                estoqueStatus: "em_estoque",
                tempoEntrega: 3,
              },
            ],
            criadoEm: new Date().toLocaleString("pt-BR"),
          };
  
          setItens((prev) => [...prev, novoItem]);
          itensAdicionados++;
        } else if (m.acao === "vincular") {
          // Vincular ao item existente
          setItens((prev) =>
            prev.map((item) => {
              if (item.id === m.itemCatalogo.id) {
                // Verifica se fornecedor já está vinculado
                const jaVinculado = item.fornecedores?.some(
                  (f) => f.fornecedorId === fornecedorId
                );
  
                if (!jaVinculado) {
                  return {
                    ...item,
                    fornecedores: [
                      ...(item.fornecedores || []),
                      {
                        fornecedorId,
                        fornecedorNome: importFornecedor.fornecedorSelecionado.nome,
                        precoUnitario: 0,
                        estoqueStatus: "em_estoque",
                        tempoEntrega: 3,
                      },
                    ],
                  };
                }
              }
              return item;
            })
          );
          itensVinculados++;
        }
      }
  
      // Reset
      setImportFornecedor({
        fornecedorSelecionado: null,
        csvRaw: "",
        preview: [],
        matching: [],
        carregando: false,
        etapa: "selecionar",
      });
  
      setAbaPrincipal("lista");
      alert(
        `✅ Importação concluída!\n${itensAdicionados} itens criados\n${itensVinculados} itens vinculados`
      );
    } catch (e) {
      alert("Erro: " + e.message);
      setImportFornecedor((prev) => ({
        ...prev,
        carregando: false,
        etapa: "matching",
      }));
    }
  }, [importFornecedor, itens, setItens]);
  
  // ──────────────────────────────────────────────────────────
  // FUNÇÕES: Novo Item
  // ──────────────────────────────────────────────────────────

  const handleAdicionarNovoItem = useCallback(() => {
    const validacao = validarItem(formNovoItem);

    if (!validacao.valido) {
      alert("Erros:\n" + validacao.erros.join("\n"));
      return;
    }

    // Verifica similaridade com itens existentes
    const similars = encontrarSimilares(formNovoItem.nome, itens, 70);
    if (similars.length > 0) {
      setMostrarSimilares(true);
      setSimilares(similars);
      return;
    }

    // Adiciona item
    const novoItem = {
      id: Date.now(),
      ...formNovoItem,
      categoria: formNovoItem.categoria || detectarCategoriaAutomatica(formNovoItem.nome),
      fornecedores: [],
      criadoEm: new Date().toLocaleString("pt-BR"),
    };

    setItens([...itens, novoItem]);
    setFormNovoItem({ nome: "", codigo: "", categoria: "", marca: "", modelo: "", ano_modelo: "" });
    setAbaPrincipal("lista");
    alert("Item cadastrado com sucesso!");
  }, [formNovoItem, itens]);

  const handleDetectarCategoria = useCallback(() => {
    const sugestao = sugerirCategoria(formNovoItem.nome, [
      "iluminação",
      "motor",
      "freios",
      "suspensão",
      "transmissão",
      "hidráulico",
      "elétrica",
    ]);
    setFormNovoItem((f) => ({ ...f, categoria: sugestao.categoria }));
  }, [formNovoItem.nome]);

  // ──────────────────────────────────────────────────────────
  // FUNÇÕES: Importação CSV
  // ──────────────────────────────────────────────────────────

  const handleProcessarCSV = useCallback(() => {
    if (!importacao.csv.trim()) {
      alert("Cole o conteúdo do CSV");
      return;
    }

    const resultado = processarCSV(importacao.csv);

    if (resultado.erro) {
      alert(resultado.erro);
      return;
    }

    setImportacao((f) => ({
      ...f,
      preview: resultado.itens,
      erros: resultado.erros,
    }));
  }, [importacao.csv]);

  const handleConfirmarImportacao = useCallback(async () => {
    const novosItens = importacao.preview.map((item) => ({
      id: Date.now() + Math.random(),
      ...item,
      fornecedores: [],
      criadoEm: new Date().toLocaleString("pt-BR"),
    }));

    setItens([...itens, ...novosItens]);
    setAbaPrincipal("lista");
    setImportacao({ csv: "", preview: [], erros: [], carregando: false });
    alert(`${novosItens.length} itens importados com sucesso!`);
  }, [importacao.preview, itens]);

  const handleCarregarArquivo = useCallback((e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;

    const leitor = new FileReader();
    leitor.onload = (evt) => {
      setImportacao((f) => ({ ...f, csv: evt.target.result }));
    };
    leitor.readAsText(arquivo);
  }, []);

  // ──────────────────────────────────────────────────────────
  // FUNÇÕES: Vinculação de Fornecedores
  // ──────────────────────────────────────────────────────────

  const handleAdicionarFornecedor = useCallback(() => {
    if (!vinculacaoForm.itemId || !vinculacaoForm.fornecedorId || !vinculacaoForm.precoUnitario) {
      alert("Preencha todos os campos");
      return;
    }

    setItens((prevItens) =>
      prevItens.map((item) => {
        if (item.id === vinculacaoForm.itemId) {
          const fornecedor = fornecedores.find((f) => f.id === parseInt(vinculacaoForm.fornecedorId));
          return {
            ...item,
            fornecedores: [
              ...(item.fornecedores || []),
              {
                fornecedorId: parseInt(vinculacaoForm.fornecedorId),
                fornecedorNome: fornecedor?.nome,
                precoUnitario: parseFloat(vinculacaoForm.precoUnitario),
                estoqueStatus: vinculacaoForm.estoqueStatus,
                tempoEntrega: parseInt(vinculacaoForm.tempoEntrega),
              },
            ],
          };
        }
        return item;
      })
    );

    setVinculacaoForm({ itemId: null, fornecedorId: null, precoUnitario: "", estoqueStatus: "em_estoque", tempoEntrega: 3 });
    setModal(null);
    alert("Fornecedor vinculado com sucesso!");
  }, [vinculacaoForm, fornecedores]);

  // ──────────────────────────────────────────────────────────
  // FUNÇÕES: Busca e Filtro
  // ──────────────────────────────────────────────────────────

  const itensFiltrados = itens.filter((item) => {
    const matchBusca =
      !busca ||
      normalizarTexto(item.nome).includes(normalizarTexto(busca)) ||
      (item.codigo && normalizarTexto(item.codigo).includes(normalizarTexto(busca)));

    const matchCategoria = filtroCategoria === "todos" || item.categoria === filtroCategoria;

    return matchBusca && matchCategoria;
  });

  const categorias = [...new Set(itens.map((i) => i.categoria))].sort();

  // ──────────────────────────────────────────────────────────
  // RENDER: Aba Lista
  // ──────────────────────────────────────────────────────────

  if (abaPrincipal === "lista") {
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
              CATÁLOGO
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>
              Itens ({itens.length})
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setAbaPrincipal("novo")}
              style={{ ...s.btn(true, C.accent), padding: "10px 16px", fontSize: 12 }}
            >
              ➕ Novo Item
            </button>
            <button
              onClick={() => setAbaPrincipal("importar")}
              style={{ ...s.btn(true, "#7c3aed"), padding: "10px 16px", fontSize: 12 }}
            >
              📤 Importar CSV
            </button>
            <button
              onClick={() => setAbaPrincipal("importarFornecedor")}
              style={{ ...s.btn(true, "#ec4899"), padding: "10px 16px", fontSize: 12 }}
            >
              🏭 Importar do Fornecedor
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <input
            placeholder="Buscar por nome ou código..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ ...s.input, flex: 1, minWidth: 250 }}
          />

          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            style={{ ...s.input, appearance: "none", minWidth: 200 }}
          >
            <option value="todos">Todas as categorias</option>
            {categorias.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Lista de itens */}
        {itensFiltrados.length === 0 ? (
          <div style={{ ...s.card, padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              {itens.length === 0 ? "Nenhum item cadastrado" : "Nenhum resultado encontrado"}
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>
              {itens.length === 0 ? "Clique em 'Novo Item' ou 'Importar CSV'" : "Tente outros filtros"}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {itensFiltrados.map((item) => (
              <div
                key={item.id}
                onClick={() => setItemSelecionado(item)}
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
                  e.currentTarget.style.borderColor = C.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = C.border;
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                    {item.nome}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                    {item.codigo && `Código: ${item.codigo} • `}
                    Categoria: {item.categoria}
                    {item.marca && ` • Marca: ${item.marca}`}
                  </div>
                </div>

                <div style={{ textAlign: "right", minWidth: 150 }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>
                    Fornecedores
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>
                    {item.fornecedores?.length || 0}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setVinculacaoForm({ ...vinculacaoForm, itemId: item.id });
                      setModal("vinculaForn");
                    }}
                    style={{
                      ...s.btn(false, C.accent),
                      padding: "4px 10px",
                      fontSize: 10,
                      marginTop: 4,
                    }}
                  >
                    + Adicionar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Detalhe do item */}
        {itemSelecionado && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "#00000090",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 400,
              padding: 20,
            }}
            onClick={() => setItemSelecionado(null)}
          >
            <div
              style={{
                ...s.card,
                width: 500,
                maxWidth: "100%",
                padding: "20px 22px",
                boxShadow: "0 24px 48px #00000060",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                  {itemSelecionado.nome}
                </div>
                <button
                  onClick={() => setItemSelecionado(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: C.muted,
                    fontSize: 24,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {itemSelecionado.codigo && (
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>CÓDIGO</div>
                    <div style={{ fontSize: 12, color: C.text }}>{itemSelecionado.codigo}</div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>CATEGORIA</div>
                  <div style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>
                    {itemSelecionado.categoria}
                  </div>
                </div>

                {itemSelecionado.marca && (
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>MARCA</div>
                    <div style={{ fontSize: 12, color: C.text }}>{itemSelecionado.marca}</div>
                  </div>
                )}

                {itemSelecionado.modelo && (
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>MODELO</div>
                    <div style={{ fontSize: 12, color: C.text }}>{itemSelecionado.modelo}</div>
                  </div>
                )}

                {/* Fornecedores */}
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, fontWeight: 600 }}>
                    FORNECEDORES ({itemSelecionado.fornecedores?.length || 0})
                  </div>

                  {(!itemSelecionado.fornecedores || itemSelecionado.fornecedores.length === 0) ? (
                    <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic" }}>
                      Nenhum fornecedor vinculado
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {itemSelecionado.fornecedores.map((forn, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: C.bg,
                            border: `1px solid ${C.border}`,
                            borderRadius: 6,
                            padding: "8px 12px",
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>
                            {forn.fornecedorNome}
                          </div>
                          <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                            {fmtBRL(forn.precoUnitario)} • {forn.estoqueStatus === "em_estoque" ? "✓ Estoque" : "⊘ Encomenda"} •{" "}
                            {forn.tempoEntrega}d
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setVinculacaoForm({ ...vinculacaoForm, itemId: itemSelecionado.id });
                      setModal("vinculaForn");
                    }}
                    style={{
                      ...s.btn(false, C.accent),
                      width: "100%",
                      marginTop: 12,
                      padding: "8px 12px",
                      fontSize: 11,
                    }}
                  >
                    + Adicionar Fornecedor
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Vinculação de Fornecedor */}
        {modal === "vinculaForn" && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "#00000090",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 400,
              padding: 20,
            }}
          >
            <div
              style={{
                ...s.card,
                width: 500,
                maxWidth: "100%",
                padding: "20px 22px",
                boxShadow: "0 24px 48px #00000060",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>
                Vincular Fornecedor
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={s.label}>FORNECEDOR *</label>
                  <select
                    value={vinculacaoForm.fornecedorId}
                    onChange={(e) => setVinculacaoForm({ ...vinculacaoForm, fornecedorId: e.target.value })}
                    style={{ ...s.input, width: "100%", appearance: "none" }}
                  >
                    <option value="">Selecione um fornecedor</option>
                    {fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={s.label}>PREÇO UNITÁRIO *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={vinculacaoForm.precoUnitario}
                    onChange={(e) =>
                      setVinculacaoForm({ ...vinculacaoForm, precoUnitario: e.target.value })
                    }
                    placeholder="0,00"
                    style={{ ...s.input, width: "100%" }}
                  />
                </div>

                <div>
                  <label style={s.label}>STATUS ESTOQUE</label>
                  <select
                    value={vinculacaoForm.estoqueStatus}
                    onChange={(e) =>
                      setVinculacaoForm({ ...vinculacaoForm, estoqueStatus: e.target.value })
                    }
                    style={{ ...s.input, width: "100%", appearance: "none" }}
                  >
                    <option value="em_estoque">✓ Em estoque</option>
                    <option value="encomenda">⊘ Encomenda</option>
                  </select>
                </div>

                <div>
                  <label style={s.label}>TEMPO ENTREGA (dias)</label>
                  <input
                    type="number"
                    min="1"
                    value={vinculacaoForm.tempoEntrega}
                    onChange={(e) =>
                      setVinculacaoForm({ ...vinculacaoForm, tempoEntrega: e.target.value })
                    }
                    style={{ ...s.input, width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                <button
                  onClick={() => setModal(null)}
                  style={{ ...s.btn(false, C.muted), padding: "8px 16px", fontSize: 12 }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAdicionarFornecedor}
                  style={{ ...s.btn(true, C.accent), padding: "8px 16px", fontSize: 12 }}
                >
                  Vincular
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // RENDER: Aba Novo Item
  // ──────────────────────────────────────────────────────────

  if (abaPrincipal === "novo") {
    return (
      <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
        <button
          onClick={() => setAbaPrincipal("lista")}
          style={{
            background: "transparent",
            border: "none",
            color: C.accent,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
            marginBottom: 16,
          }}
        >
          ← Voltar
        </button>

        <div style={{ ...s.card, padding: "20px 22px", maxWidth: 600 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 18 }}>
            Novo Item
          </div>

          {mostrarSimilares && similares.length > 0 && (
            <div
              style={{
                background: "#f5951633",
                border: `1px solid #f59e0b`,
                borderRadius: 6,
                padding: "12px 14px",
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: "#f59e0b", marginBottom: 8 }}>
                ⚠ Itens similares encontrados:
              </div>
              {similares.map((sim, idx) => (
                <div key={idx} style={{ fontSize: 11, color: C.text, marginBottom: 4 }}>
                  • {sim.item.nome} ({Math.round(sim.similaridade)}% similar)
                </div>
              ))}
              <button
                onClick={() => {
                  setMostrarSimilares(false);
                  setSimilares([]);
                }}
                style={{
                  fontSize: 11,
                  background: "#f59e0b",
                  color: C.bg,
                  border: "none",
                  borderRadius: 4,
                  padding: "6px 10px",
                  cursor: "pointer",
                  marginTop: 8,
                  fontWeight: 600,
                }}
              >
                Continuar mesmo assim
              </button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={s.label}>NOME *</label>
              <input
                value={formNovoItem.nome}
                onChange={(e) => setFormNovoItem({ ...formNovoItem, nome: e.target.value })}
                placeholder="Ex: Lâmpada do farol lado direito"
                style={{ ...s.input, width: "100%" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={s.label}>CÓDIGO (opcional)</label>
                <input
                  value={formNovoItem.codigo}
                  onChange={(e) => setFormNovoItem({ ...formNovoItem, codigo: e.target.value })}
                  placeholder="Ex: LAMP-001"
                  style={{ ...s.input, width: "100%" }}
                />
              </div>

              <div>
                <label style={s.label}>CATEGORIA *</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    value={formNovoItem.categoria}
                    onChange={(e) => setFormNovoItem({ ...formNovoItem, categoria: e.target.value })}
                    placeholder="Ex: iluminação"
                    style={{ ...s.input, flex: 1 }}
                  />
                  <button
                    onClick={handleDetectarCategoria}
                    style={{
                      ...s.btn(false, C.accent),
                      padding: "6px 12px",
                      fontSize: 11,
                      flexShrink: 0,
                    }}
                  >
                    🤖 Auto
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={s.label}>MARCA (opcional)</label>
                <input
                  value={formNovoItem.marca}
                  onChange={(e) => setFormNovoItem({ ...formNovoItem, marca: e.target.value })}
                  placeholder="Ex: Philips"
                  style={{ ...s.input, width: "100%" }}
                />
              </div>

              <div>
                <label style={s.label}>MODELO (opcional)</label>
                <input
                  value={formNovoItem.modelo}
                  onChange={(e) => setFormNovoItem({ ...formNovoItem, modelo: e.target.value })}
                  placeholder="Ex: H7"
                  style={{ ...s.input, width: "100%" }}
                />
              </div>

              <div>
                <label style={s.label}>ANO MODELO (opcional)</label>
                <input
                  type="number"
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  value={formNovoItem.ano_modelo}
                  onChange={(e) => setFormNovoItem({ ...formNovoItem, ano_modelo: e.target.value })}
                  placeholder="Ex: 2024"
                  style={{ ...s.input, width: "100%" }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
            <button
              onClick={() => {
                setAbaPrincipal("lista");
                setFormNovoItem({ nome: "", codigo: "", categoria: "", marca: "", modelo: "", ano_modelo: "" });
              }}
              style={{ ...s.btn(false, C.muted), padding: "10px 18px" }}
            >
              Cancelar
            </button>
            <button
              onClick={handleAdicionarNovoItem}
              style={{ ...s.btn(true, C.accent), padding: "10px 18px" }}
            >
              Cadastrar Item
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // RENDER: Aba Importar CSV
  // ──────────────────────────────────────────────────────────

  if (abaPrincipal === "importar") {
    return (
      <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
        <button
          onClick={() => {
            setAbaPrincipal("lista");
            setImportacao({ csv: "", preview: [], erros: [], carregando: false });
          }}
          style={{
            background: "transparent",
            border: "none",
            color: C.accent,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
            marginBottom: 16,
          }}
        >
          ← Voltar
        </button>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 1000 }}>
          {/* Painel: Upload */}
          <div style={{ ...s.card, padding: "20px 22px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>
              📤 Importar CSV
            </div>

            <div style={{ fontSize: 11, color: C.muted, marginBottom: 12, lineHeight: 1.6 }}>
              <div style={{ marginBottom: 8 }}>
                <strong>Formato esperado:</strong> CSV com colunas
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.textSub }}>
                nome, codigo, categoria, marca, modelo, ano_modelo
              </div>
            </div>

            <div
              style={{
                border: `2px dashed ${C.border}`,
                borderRadius: 6,
                padding: "20px",
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleCarregarArquivo}
                style={{ display: "none" }}
                id="csvFile"
              />
              <label
                htmlFor="csvFile"
                style={{
                  cursor: "pointer",
                  fontSize: 12,
                  color: C.accent,
                  fontWeight: 600,
                }}
              >
                Clique para selecionar arquivo CSV
              </label>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={s.label}>Ou cole CSV aqui:</label>
              <textarea
                value={importacao.csv}
                onChange={(e) => setImportacao({ ...importacao, csv: e.target.value })}
                placeholder="nome,codigo,categoria,marca,modelo&#10;Lâmpada farol,LAMP-001,iluminação,Philips,H7&#10;..."
                style={{
                  ...s.input,
                  width: "100%",
                  minHeight: 200,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  padding: "10px 12px",
                  resize: "vertical",
                }}
              />
            </div>

            <button
              onClick={handleProcessarCSV}
              disabled={!importacao.csv.trim()}
              style={{
                ...s.btn(!importacao.csv.trim() ? false : true, C.accent),
                width: "100%",
                padding: "10px 16px",
                opacity: !importacao.csv.trim() ? 0.5 : 1,
              }}
            >
              Processar CSV
            </button>
          </div>

          {/* Painel: Preview */}
          {importacao.preview.length > 0 && (
            <div style={{ ...s.card, padding: "20px 22px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>
                ✓ Preview ({importacao.preview.length} itens)
              </div>

              <div
                style={{
                  maxHeight: 300,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                {importacao.preview.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      padding: "8px 10px",
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>
                      {item.nome}
                    </div>
                    <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>
                      {item.codigo && `${item.codigo} • `}
                      {item.categoria}
                    </div>
                  </div>
                ))}
              </div>

              {importacao.erros.length > 0 && (
                <div
                  style={{
                    background: "#2d151533",
                    border: `1px solid #ef444433`,
                    borderRadius: 6,
                    padding: "8px 10px",
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 600, marginBottom: 4 }}>
                    {importacao.erros.length} erros
                  </div>
                  {importacao.erros.map((err, idx) => (
                    <div key={idx} style={{ fontSize: 9, color: "#ef4444" }}>
                      Linha {err.linha}: {err.mensagens.join(", ")}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleConfirmarImportacao}
                style={{
                  ...s.btn(true, C.success),
                  width: "100%",
                  padding: "10px 16px",
                }}
              >
                ✓ Importar {importacao.preview.length} itens
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

    // ────────────────────────────────────────────────────────────────
  // RENDER: ABA IMPORTAR POR FORNECEDOR
  // ────────────────────────────────────────────────────────────────
  
  if (abaPrincipal === "importarFornecedor") {
    return (
      <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
        <button
          onClick={() => {
            setAbaPrincipal("lista");
            setImportForn({
              fornecedorSelecionado: null,
              arquivo: null,
              carregando: false,
              mensagem: null,
            });
          }}
          style={{
            background: "transparent",
            border: "none",
            color: C.accent,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
            marginBottom: 16,
          }}
        >
          ← Voltar
        </button>
  
        <div style={{ ...s.card, padding: "30px 32px", maxWidth: 600 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 24 }}>
            🏭 Importar Catálogo do Fornecedor
          </div>
  
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* 1. Selecionar Fornecedor */}
            <div>
              <label style={s.label}>1. FORNECEDOR *</label>
              <select
                value={importForn.fornecedorSelecionado?.id || ""}
                onChange={(e) => {
                  const fornecedorId = parseInt(e.target.value);
                  const fornecedor = fornecedores.find((f) => f.id === fornecedorId);
                  setImportForn((prev) => ({
                    ...prev,
                    fornecedorSelecionado: fornecedor || null,
                  }));
                }}
                style={{ ...s.input, width: "100%", appearance: "none" }}
              >
                <option value="">Selecione um fornecedor...</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
  
              {importForn.fornecedorSelecionado && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 14px",
                    background: C.success + "22",
                    border: `1px solid ${C.success}`,
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.success,
                  }}
                >
                  ✓ {importForn.fornecedorSelecionado.nome}
                </div>
              )}
            </div>
  
            {/* 2. Selecionar Arquivo */}
            <div>
              <label style={s.label}>2. ARQUIVO CSV *</label>
              <div
                style={{
                  border: `2px dashed ${importForn.arquivo ? C.success : C.border}`,
                  borderRadius: 8,
                  padding: "30px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: importForn.arquivo ? C.success + "11" : C.bg,
                  transition: "all 0.2s",
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = C.accent;
                  e.currentTarget.style.background = C.accent + "11";
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.borderColor = importForn.arquivo ? C.success : C.border;
                  e.currentTarget.style.background = importForn.arquivo ? C.success + "11" : C.bg;
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const arquivo = e.dataTransfer.files[0];
                  if (arquivo && arquivo.name.endsWith(".csv")) {
                    setImportForn((prev) => ({ ...prev, arquivo }));
                  } else {
                    alert("Selecione um arquivo .csv");
                  }
                }}
              >
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setImportForn((prev) => ({
                        ...prev,
                        arquivo: e.target.files[0],
                      }));
                    }
                  }}
                  style={{
                    display: "none",
                    cursor: "pointer",
                  }}
                  id="arquivo-input"
                />
  
                {importForn.arquivo ? (
                  <div>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.success }}>
                      {importForn.arquivo.name}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                      {(importForn.arquivo.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor="arquivo-input"
                    style={{
                      cursor: "pointer",
                      display: "block",
                    }}
                  >
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                      Clique ou arraste o arquivo CSV aqui
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                      Formato: nome, codigo, categoria, marca, modelo, ano_modelo
                    </div>
                  </label>
                )}
              </div>
            </div>
  
            {/* Status */}
            {importForn.mensagem && (
              <div
                style={{
                  padding: "12px 16px",
                  background: C.accent + "22",
                  border: `1px solid ${C.accent}`,
                  borderRadius: 6,
                  fontSize: 12,
                  color: C.accent,
                  textAlign: "center",
                }}
              >
                {importForn.mensagem}
              </div>
            )}
  
            {/* Botões */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button
                onClick={() => {
                  setAbaPrincipal("lista");
                  setImportForn({
                    fornecedorSelecionado: null,
                    arquivo: null,
                    carregando: false,
                    mensagem: null,
                  });
                }}
                style={{ ...s.btn(false, C.muted), padding: "10px 20px", fontSize: 13 }}
              >
                Cancelar
              </button>
              <button
                onClick={handleImportarFornecedor}
                disabled={!importForn.fornecedorSelecionado || !importForn.arquivo || importForn.carregando}
                style={{
                  ...s.btn(importForn.fornecedorSelecionado && importForn.arquivo && !importForn.carregando, C.accent),
                  padding: "10px 20px",
                  fontSize: 13,
                  opacity:
                    importForn.fornecedorSelecionado && importForn.arquivo && !importForn.carregando ? 1 : 0.5,
                }}
              >
                {importForn.carregando ? "⟳ Importando..." : "Importar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}