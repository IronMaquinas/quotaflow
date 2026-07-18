// components/catalogo/TelaGerenciarFornecedores.jsx
import { useState, useEffect } from "react";
import { useCatalogo } from "../../hooks/useCatalogo";
import { useAuth } from "../../hooks/useAuth";
import { fornecedorService } from "../../services/fornecedorService"; // Você já tem este

export default function TelaGerenciarFornecedores({ C, s }) {
  const { user } = useAuth();
  const { itens, loading, carregar } = useCatalogo(user?.access_token);

  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [fornecedores, setFornecedores] = useState([]);
  const [fornecedoresDisponiveis, setFornecedoresDisponiveis] = useState([]);
  const [carregandoFornecedores, setCarregandoFornecedores] = useState(false);
  const [modal, setModal] = useState(null);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState(null);

  const [formNovoFornecedor, setFormNovoFornecedor] = useState({
    fornecedor_id: "",
    preco_unitario: "",
    codigo_fornecedor: "",
    descricao_fornecedor: "",
  });

  // ─── CARREGAR FORNECEDORES DA PEÇA SELECIONADA ──────────────────────
  useEffect(() => {
    if (!itemSelecionado || !user?.access_token) return;

    const buscarFornecedores = async () => {
      setCarregandoFornecedores(true);
      try {
        // GET /api/catalogo/:id/fornecedores
        const res = await fetch(`${import.meta.env.VITE_API_URL}/catalogo/${itemSelecionado.id}/fornecedores`, {
          headers: { Authorization: `Bearer ${user.access_token}` },
        });
        const dados = await res.json();
        setFornecedores(dados.fornecedores || []);
      } catch (err) {
        setErro("Erro ao carregar fornecedores: " + err.message);
      } finally {
        setCarregandoFornecedores(false);
      }
    };

    buscarFornecedores();
  }, [itemSelecionado, user?.access_token]);

  // ─── CARREGAR LISTA DE FORNECEDORES DISPONÍVEIS ──────────────────────
  useEffect(() => {
    if (!user?.access_token) return;

    const buscar = async () => {
      try {
        const dados = await fornecedorService.listar(user.access_token);
        setFornecedoresDisponiveis(dados.fornecedores || []);
      } catch (err) {
        console.error("Erro ao carregar fornecedores:", err);
      }
    };

    buscar();
  }, [user?.access_token]);

  // Filtrar itens
  const itensFiltrados = itens.filter(item =>
    item.nome.toLowerCase().includes(busca.toLowerCase()) ||
    item.codigo.toLowerCase().includes(busca.toLowerCase())
  );

  // ─── ADICIONAR FORNECEDOR À PEÇA ──────────────────────────────────
  const handleAdicionarFornecedor = async () => {
    if (!itemSelecionado || !formNovoFornecedor.fornecedor_id || !formNovoFornecedor.preco_unitario) {
      alert("Fornecedor e Preço são obrigatórios");
      return;
    }

    try {
      setErro(null);
      // POST /api/catalogo/:id/fornecedor
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/catalogo/${itemSelecionado.id}/fornecedor`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.access_token}`,
          },
          body: JSON.stringify(formNovoFornecedor),
        }
      );

      const dados = await res.json();

      if (!res.ok) {
        setErro(dados.erro || "Erro ao adicionar fornecedor");
        return;
      }

      setFornecedores([...fornecedores, dados.forn]);
      setFormNovoFornecedor({
        fornecedor_id: "",
        preco_unitario: "",
        codigo_fornecedor: "",
        descricao_fornecedor: "",
      });
      setModal(null);
      alert("Fornecedor adicionado com sucesso!");
    } catch (err) {
      setErro("Erro ao adicionar fornecedor: " + err.message);
    }
  };

  // ─── REMOVER FORNECEDOR ──────────────────────────────────────────────
  const handleRemoverFornecedor = async (fornecedorId) => {
    if (!window.confirm("Tem certeza que deseja remover este fornecedor?")) return;

    try {
      // DELETE /api/catalogo/:id/fornecedor/:forn_id
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/catalogo/${itemSelecionado.id}/fornecedor/${fornecedorId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${user.access_token}` },
        }
      );

      if (!res.ok) {
        const erro = await res.json();
        alert("Erro: " + (erro.erro || "Não foi possível remover"));
        return;
      }

      setFornecedores(fornecedores.filter(f => f.id !== fornecedorId));
      alert("Fornecedor removido com sucesso!");
    } catch (err) {
      alert("Erro: " + err.message);
    }
  };

  // ─── MODAL: ADICIONAR FORNECEDOR ──────────────────────────────────
  if (modal === "adicionarFornecedor") {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
        <div style={{ ...s.card, width: 500, maxWidth: "100%", boxShadow: "0 24px 48px #00000060" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
              Adicionar Fornecedor: {itemSelecionado?.nome}
            </div>
            <button onClick={() => setModal(null)} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>×</button>
          </div>

          <div style={{ padding: "20px 22px" }}>
            {erro && <div style={{ color: "#ef4444", padding: 12, background: "#ef444422", borderRadius: 6, marginBottom: 16, fontSize: 12 }}>{erro}</div>}

            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>FORNECEDOR *</label>
              <select
                value={formNovoFornecedor.fornecedor_id}
                onChange={e => setFormNovoFornecedor({ ...formNovoFornecedor, fornecedor_id: e.target.value })}
                style={{ ...s.input, appearance: "none" }}
              >
                <option value="">Selecione um fornecedor...</option>
                {fornecedoresDisponiveis
                  .filter(f => !fornecedores.some(forn => forn.fornecedor_id == f.id))
                  .map(f => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>PREÇO UNITÁRIO (R$) *</label>
              <input
                type="number"
                placeholder="0.00"
                step="0.01"
                value={formNovoFornecedor.preco_unitario}
                onChange={e => setFormNovoFornecedor({ ...formNovoFornecedor, preco_unitario: e.target.value })}
                style={s.input}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>CÓDIGO DO FORNECEDOR</label>
              <input
                type="text"
                placeholder="Ex: PAD-A-001"
                value={formNovoFornecedor.codigo_fornecedor}
                onChange={e => setFormNovoFornecedor({ ...formNovoFornecedor, codigo_fornecedor: e.target.value })}
                style={s.input}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>DESCRIÇÃO DO FORNECEDOR</label>
              <input
                type="text"
                placeholder="Como o fornecedor chama este item"
                value={formNovoFornecedor.descricao_fornecedor}
                onChange={e => setFormNovoFornecedor({ ...formNovoFornecedor, descricao_fornecedor: e.target.value })}
                style={s.input}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, padding: "14px 22px", borderTop: `1px solid ${C.border}` }}>
            <button onClick={() => setModal(null)} style={{ ...s.btn(false), flex: 1, padding: "8px 16px" }}>Cancelar</button>
            <button
              onClick={handleAdicionarFornecedor}
              style={{ ...s.btn(true), flex: 1, padding: "8px 16px" }}
            >
              Adicionar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── LISTA PRINCIPAL ──────────────────────────────────────────────
  return (
    <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%", display: "grid", gridTemplateColumns: "300px 1fr", gap: 22 }}>
      {/* COLUNA 1: Lista de Peças */}
      <div>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 8 }}>PEÇAS</div>
        <input
          type="text"
          placeholder="Buscar peça..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ ...s.input, width: "100%", marginBottom: 12, fontSize: 12, padding: "8px 10px" }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 600, overflowY: "auto" }}>
          {loading ? (
            <div style={{ color: C.muted, fontSize: 12 }}>Carregando...</div>
          ) : itensFiltrados.length === 0 ? (
            <div style={{ color: C.muted, fontSize: 12 }}>Nenhuma peça encontrada</div>
          ) : (
            itensFiltrados.map(item => (
              <button
                key={item.id}
                onClick={() => setItemSelecionado(item)}
                style={{
                  ...s.card,
                  padding: "12px 14px",
                  textAlign: "left",
                  border: itemSelecionado?.id === item.id ? `2px solid ${C.accent}` : `1px solid ${C.border}`,
                  background: itemSelecionado?.id === item.id ? C.accentLight : "transparent",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 600, color: C.text, marginBottom: 3 }}>{item.codigo}</div>
                <div style={{ color: C.muted, fontSize: 11 }}>{item.nome.substring(0, 30)}</div>
                {item.total_fornecedores > 0 && (
                  <div style={{ color: C.accent, fontSize: 10, marginTop: 4 }}>
                    {item.total_fornecedores} fornecedor(es)
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* COLUNA 2: Fornecedores da Peça Selecionada */}
      <div>
        {!itemSelecionado ? (
          <div style={{ ...s.card, padding: "60px 40px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏪</div>
            <div style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>Selecione uma peça</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
              Clique em uma peça à esquerda para gerenciar seus fornecedores
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>FORNECEDORES</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{itemSelecionado.nome}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{itemSelecionado.codigo}</div>
              </div>
              <button
                onClick={() => setModal("adicionarFornecedor")}
                style={{ ...s.btn(true), padding: "8px 16px", fontSize: 11 }}
              >
                ➕ Adicionar
              </button>
            </div>

            {carregandoFornecedores ? (
              <div style={{ color: C.muted, textAlign: "center", padding: 40 }}>Carregando...</div>
            ) : fornecedores.length === 0 ? (
              <div style={{ ...s.card, padding: "40px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>Nenhum fornecedor</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
                  Adicione fornecedores para esta peça
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {fornecedores.map(forn => (
                  <div key={forn.id} style={{ ...s.card, padding: "14px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: C.text, marginBottom: 6 }}>
                        {forn.fornecedor_nome}
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>
                        Preço: <span style={{ color: C.accent, fontWeight: 600 }}>R$ {parseFloat(forn.preco_unitario).toFixed(2)}</span>
                      </div>
                      {forn.codigo_fornecedor && (
                        <div style={{ fontSize: 11, color: C.muted }}>
                          Código: {forn.codigo_fornecedor}
                        </div>
                      )}
                      {forn.descricao_fornecedor && (
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                          "{forn.descricao_fornecedor}"
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>
                        Atualizado em: {new Date(forn.data_tabela).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoverFornecedor(forn.id)}
                      style={{
                        ...s.btn(false),
                        padding: "6px 10px",
                        fontSize: 11,
                        marginLeft: 12,
                        flexShrink: 0,
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
