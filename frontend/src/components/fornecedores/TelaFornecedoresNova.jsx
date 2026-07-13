// components/fornecedores/TelaFornecedoresNova.jsx
import { useState, useEffect } from "react";
import { useFornecedores } from "../../hooks/useFornecedores";

export default function TelaFornecedoresNova({ fmtD, C, s }) {
  const { fornecedores, loading, erro, listar, criar, atualizar, deletar } = useFornecedores();

  const [filtroAtivo, setFiltroAtivo] = useState("todos");
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [consultandoCNPJ, setConsultandoCNPJ] = useState(false);

  // Estado do formulário (expandido)
  const [form, setForm] = useState({
    nome: "",
    razao_social: "",
    cnpj: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    contato_nome: "",
    contato_email: "",
    contato_telefone: "",
    contato_whatsapp: "",
    categorias: [],
  });

  const categorias = [
    "rolamentos",
    "correias",
    "transmissão",
    "hidráulico",
    "pneumático",
    "válvulas",
    "filtros",
    "sensores",
    "instrumentação",
    "elétrica",
    "automação",
    "manutenção geral",
  ];

  useEffect(() => {
    listar();
  }, []);

  // ─── FILTROS ──────────────────────────────────────────────
  const fornecedoresFiltered = (fornecedores || [])
    .filter(f => filtroAtivo === "todos" || (filtroAtivo === "ativo" ? f.ativo : !f.ativo))
    .filter(f => {
      const search = busca.toLowerCase();
      const contato = f.contatos?.[0] || {};
      return (
        f.nome?.toLowerCase().includes(search) ||
        contato.email?.toLowerCase().includes(search) ||
        f.cnpj?.includes(search)
      );
    });

  // ─── FORMATADORES ─────────────────────────────────────────
  const formatarCNPJ = (valor) => {
    const v = valor.replace(/\D/g, "");
    if (v.length <= 2) return v;
    if (v.length <= 5) return v.replace(/(\d{2})(\d+)/, "$1.$2");
    if (v.length <= 8) return v.replace(/(\d{2})(\d{3})(\d+)/, "$1.$2.$3");
    if (v.length <= 12) return v.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, "$1.$2.$3/$4");
    return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  const formatarTelefone = (valor) => {
    const v = valor.replace(/\D/g, "");
    if (v.length <= 2) return `(${v}`;
    if (v.length <= 6) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
    if (v.length <= 10) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
    return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7, 11)}`;
  };

  const formatarCEP = (valor) => {
    const v = valor.replace(/\D/g, "");
    if (v.length <= 5) return v;
    return v.replace(/(\d{5})(\d+)/, "$1-$2");
  };

  // ─── CONSULTA CNPJ ────────────────────────────────────────
  const consultarCNPJ = async () => {
    const cnpjLimpo = form.cnpj.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) {
      alert("Digite um CNPJ válido (14 dígitos)");
      return;
    }

    // Validar dígitos verificadores (opcional, mas recomendado)
    function validarCNPJ(cnpj) {
      const c = cnpj.replace(/\D/g, "");
      if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
      const calc = (s, n) => {
        let sum = 0, pos = n - 7;
        for (let i = n; i >= 1; i--) {
          sum += parseInt(s.charAt(n - i)) * pos--;
          if (pos < 2) pos = 9;
        }
        const r = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        return r === parseInt(s.charAt(n));
      };
      return calc(c, 12) && calc(c, 13);
    }

    setConsultandoCNPJ(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      if (res.status === 404) {
        alert("CNPJ não encontrado na Receita Federal. Verifique o número digitado.");
        return;
      }
      if (!res.ok) throw new Error(`Erro ${res.status}: ${res.statusText}`);
      const data = await res.json();

      setForm((f) => ({
        ...f,
        nome: data.nome_fantasia || data.razao_social || f.nome,
        razao_social: data.razao_social || "",
        endereco: data.logradouro || "",
        numero: data.numero || "",
        complemento: data.complemento || "",
        bairro: data.bairro || "",
        cidade: data.municipio || "",
        estado: data.uf || "",
        cep: formatarCEP(data.cep || ""),
        contato_email: data.email || f.contato_email,
        contato_telefone: data.telefone ? formatarTelefone(data.telefone) : f.contato_telefone,
      }));
      alert("Dados carregados com sucesso!");
    } catch (e) {
      console.error("Erro na consulta CNPJ:", e);
      alert("Erro ao consultar CNPJ: " + e.message);
    } finally {
      setConsultandoCNPJ(false);
    }
  };

  // ─── SALVAR ────────────────────────────────────────────────
  const handleSalvar = async () => {
    if (!form.nome || !form.contato_email) {
      alert("Preencha nome e e-mail de contato");
      return;
    }

    setProcessando(true);
    try {
      // Montar array de contatos (suporta múltiplos contatos, mas usamos 1)
      const contatos = [
        {
          nome: form.contato_nome || "",
          email: form.contato_email || "",
          telefone: form.contato_telefone || "",
          whatsapp: form.contato_whatsapp || "",
          papel: "comercial",
        },
      ];

      const payload = {
        nome: form.nome,
        razao_social: form.razao_social || null,
        cnpj: form.cnpj.replace(/\D/g, "") || null,
        endereco: form.endereco || null,
        numero: form.numero || null,
        complemento: form.complemento || null,
        bairro: form.bairro || null,
        cidade: form.cidade || null,
        estado: form.estado || null,
        cep: form.cep.replace(/\D/g, "") || null,
        contatos: contatos,
        categorias: form.categorias || [],
        ativo: 1,
      };

      if (modal === "novo") {
        await criar(payload);
      } else {
        await atualizar(modal, payload);
      }

      setModal(null);
      resetForm();
      await listar();
      alert(modal === "novo" ? "Fornecedor criado!" : "Fornecedor atualizado!");
    } catch (e) {
      alert("Erro: " + e.message);
    } finally {
      setProcessando(false);
    }
  };

  const resetForm = () => {
    setForm({
      nome: "",
      razao_social: "",
      cnpj: "",
      endereco: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
      cep: "",
      contato_nome: "",
      contato_email: "",
      contato_telefone: "",
      contato_whatsapp: "",
      categorias: [],
    });
  };

  // ─── TOGGLE ATIVO / DELETAR ──────────────────────────────
  const handleToggleAtivo = async (fornecedor) => {
    try {
      await atualizar(fornecedor.id, { ativo: !fornecedor.ativo });
      await listar();
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  const handleDeletar = async (id) => {
    if (!window.confirm("Tem certeza?")) return;
    try {
      await deletar(id);
      await listar();
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  // ─── MODAL ──────────────────────────────────────────────────
  if (modal) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
        <div style={{ ...s.card, width: 700, maxWidth: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 48px #00000060" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
              {modal === "novo" ? "Novo Fornecedor" : "Editar Fornecedor"}
            </div>
            <button onClick={() => { setModal(null); resetForm(); }} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>

          <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
            {/* ─── CNPJ ─── */}
            <div style={{ marginBottom: 14 }}>
              <label style={s.label}>CNPJ</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={form.cnpj}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    if (raw.length > 14) return;
                    setForm(f => ({ ...f, cnpj: formatarCNPJ(raw) }));
                  }}
                  placeholder="00.000.000/0000-00"
                  maxLength="18"
                  style={{ ...s.input, flex: 1 }}
                />
                <button
                  onClick={consultarCNPJ}
                  disabled={consultandoCNPJ || form.cnpj.replace(/\D/g, "").length !== 14}
                  style={{
                    ...s.btn(true, "#0891b2"),
                    padding: "0 16px",
                    whiteSpace: "nowrap",
                    fontSize: 12,
                    opacity: consultandoCNPJ || form.cnpj.replace(/\D/g, "").length !== 14 ? 0.6 : 1,
                    cursor: consultandoCNPJ || form.cnpj.replace(/\D/g, "").length !== 14 ? "not-allowed" : "pointer",
                  }}
                >
                  {consultandoCNPJ ? "⏳ Buscando..." : "🔍 Consultar"}
                </button>
              </div>
            </div>

            {/* ─── NOME E RAZÃO SOCIAL ─── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={s.label}>NOME FANTASIA *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome fantasia"
                  style={s.input}
                />
              </div>
              <div>
                <label style={s.label}>RAZÃO SOCIAL</label>
                <input
                  type="text"
                  value={form.razao_social}
                  onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))}
                  placeholder="Razão social"
                  style={s.input}
                />
              </div>
            </div>

            {/* ─── ENDEREÇO ─── */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={s.label}>LOGRADOURO</label>
                <input
                  type="text"
                  value={form.endereco}
                  onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))}
                  placeholder="Rua, Avenida..."
                  style={s.input}
                />
              </div>
              <div>
                <label style={s.label}>NÚMERO</label>
                <input
                  type="text"
                  value={form.numero}
                  onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                  placeholder="Número"
                  style={s.input}
                />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={s.label}>COMPLEMENTO</label>
                <input
                  type="text"
                  value={form.complemento}
                  onChange={e => setForm(f => ({ ...f, complemento: e.target.value }))}
                  placeholder="Complemento"
                  style={s.input}
                />
              </div>
              <div>
                <label style={s.label}>BAIRRO</label>
                <input
                  type="text"
                  value={form.bairro}
                  onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))}
                  placeholder="Bairro"
                  style={s.input}
                />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={s.label}>CIDADE</label>
                <input
                  type="text"
                  value={form.cidade}
                  onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))}
                  placeholder="Cidade"
                  style={s.input}
                />
              </div>
              <div>
                <label style={s.label}>ESTADO</label>
                <input
                  type="text"
                  value={form.estado}
                  onChange={e => setForm(f => ({ ...f, estado: e.target.value.toUpperCase().slice(0, 2) }))}
                  placeholder="UF"
                  style={s.input}
                  maxLength="2"
                />
              </div>
              <div>
                <label style={s.label}>CEP</label>
                <input
                  type="text"
                  value={form.cep}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    if (raw.length > 8) return;
                    setForm(f => ({ ...f, cep: formatarCEP(raw) }));
                  }}
                  placeholder="00000-000"
                  maxLength="9"
                  style={s.input}
                />
              </div>
            </div>

            {/* ─── CONTATO COMERCIAL ─── */}
            <div style={{ marginBottom: 14, borderTop: `1px solid ${C.border}22`, paddingTop: 14 }}>
              <div style={{ fontSize: 12, color: C.textSub, fontWeight: 600, marginBottom: 12 }}>CONTATO COMERCIAL</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={s.label}>NOME DO CONTATO</label>
                  <input
                    type="text"
                    value={form.contato_nome}
                    onChange={e => setForm(f => ({ ...f, contato_nome: e.target.value }))}
                    placeholder="Nome do representante"
                    style={s.input}
                  />
                </div>
                <div>
                  <label style={s.label}>E-MAIL *</label>
                  <input
                    type="email"
                    value={form.contato_email}
                    onChange={e => setForm(f => ({ ...f, contato_email: e.target.value }))}
                    placeholder="comercial@fornecedor.com"
                    style={s.input}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={s.label}>TELEFONE</label>
                  <input
                    type="tel"
                    value={form.contato_telefone}
                    onChange={(e) => setForm(f => ({ ...f, contato_telefone: formatarTelefone(e.target.value) }))}
                    placeholder="(11) 0000-0000"
                    style={s.input}
                  />
                </div>
                <div>
                  <label style={s.label}>WHATSAPP</label>
                  <input
                    type="tel"
                    value={form.contato_whatsapp}
                    onChange={(e) => setForm(f => ({ ...f, contato_whatsapp: formatarTelefone(e.target.value) }))}
                    placeholder="(11) 99999-9999"
                    style={s.input}
                  />
                </div>
              </div>
            </div>

            {/* ─── CATEGORIAS ─── */}
            <div style={{ marginBottom: 14 }}>
              <label style={s.label}>CATEGORIAS</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {categorias.map(cat => (
                  <label key={cat} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: C.bg, borderRadius: 6, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={form.categorias.includes(cat)}
                      onChange={e => {
                        setForm(f => ({
                          ...f,
                          categorias: e.target.checked
                            ? [...f.categorias, cat]
                            : f.categorias.filter(c => c !== cat)
                        }));
                      }}
                      style={{ cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 11, color: C.text }}>{cat}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ─── AÇÕES DO MODAL ─── */}
          <div style={{ display: "flex", gap: 10, padding: "14px 22px", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
            <button onClick={() => { setModal(null); resetForm(); }} style={{ ...s.btn(false), flex: 1, padding: "8px 16px" }}>Cancelar</button>
            <button
              onClick={handleSalvar}
              disabled={processando || !form.nome || !form.contato_email}
              style={{
                ...s.btn(true),
                flex: 1,
                padding: "8px 16px",
                opacity: processando || !form.nome || !form.contato_email ? 0.5 : 1,
                cursor: processando || !form.nome || !form.contato_email ? "not-allowed" : "pointer",
              }}
            >
              {processando ? "Salvando..." : modal === "novo" ? "Criar Fornecedor" : "Atualizar"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── LISTA ──────────────────────────────────────────────────
  return (
    <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>GESTÃO</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Fornecedores</div>
        </div>
        <button
          onClick={() => { resetForm(); setModal("novo"); }}
          style={{ ...s.btn(true), padding: "9px 20px", fontSize: 12 }}
        >
          ➕ Novo Fornecedor
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Buscar fornecedor..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ ...s.input, flex: 1, minWidth: 200, padding: "8px 12px", fontSize: 12 }}
        />
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { id: "todos", label: "Todos" },
            { id: "ativo", label: "Ativos" },
            { id: "inativo", label: "Inativos" },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFiltroAtivo(f.id)}
              style={{
                background: filtroAtivo === f.id ? C.accent : "transparent",
                border: `1px solid ${filtroAtivo === f.id ? C.accent : C.border}`,
                borderRadius: 6,
                padding: "6px 14px",
                color: filtroAtivo === f.id ? "white" : C.muted,
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

      <div style={{ ...s.card, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 150px 120px 100px 100px", padding: "10px 18px", background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, letterSpacing: "0.08em" }}>
          <span>FORNECEDOR</span>
          <span>CONTATO</span>
          <span>CNPJ</span>
          <span>CATEGORIAS</span>
          <span>STATUS</span>
          <span></span>
        </div>
        {fornecedoresFiltered.map((forn, i) => {
          const contato = forn.contatos?.[0] || {};
          return (
            <div
              key={forn.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 2fr 150px 120px 100px 100px",
                padding: "13px 18px",
                borderBottom: i < fornecedoresFiltered.length - 1 ? `1px solid ${C.border}22` : "none",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{forn.nome}</div>
                {forn.cidade && forn.estado && <div style={{ fontSize: 10, color: C.muted }}>{forn.cidade}/{forn.estado}</div>}
              </div>
              <div>
                {contato.nome && <div style={{ fontSize: 12, color: C.text }}>{contato.nome}</div>}
                <div style={{ fontSize: 11, color: C.accent }}>{contato.email || "—"}</div>
              </div>
              <div style={{ fontSize: 11, color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>
                {forn.cnpj || "—"}
              </div>
              <div style={{ fontSize: 10, color: C.muted }}>
                {forn.categorias?.slice(0, 2).join(", ") || "—"}
                {forn.categorias?.length > 2 && ` +${forn.categorias.length - 2}`}
              </div>
              <div style={{ ...s.tag(forn.ativo ? C.success : C.muted), fontSize: 10 }}>
                {forn.ativo ? "Ativo" : "Inativo"}
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    setForm({
                      nome: forn.nome || "",
                      razao_social: forn.razao_social || "",
                      cnpj: forn.cnpj ? formatarCNPJ(forn.cnpj) : "",
                      endereco: forn.endereco || "",
                      numero: forn.numero || "",
                      complemento: forn.complemento || "",
                      bairro: forn.bairro || "",
                      cidade: forn.cidade || "",
                      estado: forn.estado || "",
                      cep: forn.cep ? formatarCEP(forn.cep) : "",
                      contato_nome: contato.nome || "",
                      contato_email: contato.email || "",
                      contato_telefone: contato.telefone || "",
                      contato_whatsapp: contato.whatsapp || "",
                      categorias: forn.categorias || [],
                    });
                    setModal(forn.id);
                  }}
                  style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 5, padding: "4px 8px", color: C.muted, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                >
                  ✏
                </button>
                <button
                  onClick={() => handleToggleAtivo(forn)}
                  style={{ background: "transparent", border: `1px solid ${forn.ativo ? "#ef444433" : "#22c55e33"}`, borderRadius: 5, padding: "4px 8px", color: forn.ativo ? "#ef4444" : C.success, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                >
                  {forn.ativo ? "❌" : "✅"}
                </button>
                <button
                  onClick={() => handleDeletar(forn.id)}
                  style={{ background: "transparent", border: `1px solid #ef444433`, borderRadius: 5, padding: "4px 8px", color: "#ef4444", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                >
                  🗑
                </button>
              </div>
            </div>
          );
        })}
        {fornecedoresFiltered.length === 0 && !loading && (
          <div style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>Nenhum fornecedor encontrado</div>
        )}
      </div>
    </div>
  );
}