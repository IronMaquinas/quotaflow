// components/fornecedores/TelaFornecedoresNova.jsx
import { useState, useEffect } from "react";
import { useFornecedores } from "../../hooks/useFornecedores";
import apiService from "../../services/apiService";
import { useOpcoesAtuacao, PainelAtuacao, ResumoAtuacao, atuacaoDe, atuacaoVazia, nomeAtuacao, DIMENSOES_ATUACAO } from "../shared/SeletorAtuacao";

export default function TelaFornecedoresNova({ fmtD, C, s }) {
  const { fornecedores, loading, erro, listar, criar, atualizar, deletar } = useFornecedores();

  const [filtroAtivo, setFiltroAtivo] = useState("todos");
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [consultandoCNPJ, setConsultandoCNPJ] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const { opcoes: opcoesAtuacao, recarregar: recarregarOpcoesAtuacao } = useOpcoesAtuacao();

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
    ...atuacaoVazia(), // perfil de atuação (etapa 4) — substitui as antigas "categorias"
    email: "",
  });

  // Texto de todas as opções de atuação do fornecedor, para o filtro
  // ("hidráulica", "Volvo", "guindaste", "RJ"…)
  const semAcento = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const textoAtuacao = (f) => semAcento(DIMENSOES_ATUACAO
    .flatMap(d => (f[d.campo] || []).map(c => nomeAtuacao(opcoesAtuacao, d.dimensao, c)))
    .join(" "));
  const termoAtuacao = semAcento(filtroCategoria).trim();

  // Convites a fornecedores NOVOS, ainda não cadastrados (etapa 10b)
  const [convitesNovos, setConvitesNovos] = useState([]);
  const [modalConvite, setModalConvite] = useState(null); // { cnpj, email, nome } | null
  // Prévia da Receita no modal (etapa 10c): { situacao: 'buscando'|'ok'|'erro', dados?, texto? }
  const [receitaConvite, setReceitaConvite] = useState(null);
  const [enviandoConvite, setEnviandoConvite] = useState(false);
  const [erroConvite, setErroConvite] = useState("");
  const [acaoConviteId, setAcaoConviteId] = useState(null);

  const carregarConvitesNovos = async () => {
    try {
      const r = await apiService.get("/fornecedores/convites");
      setConvitesNovos(Array.isArray(r) ? r : []);
    } catch (e) {
      console.error("❌ convites pendentes:", e);
    }
  };

  useEffect(() => {
    listar();
    carregarConvitesNovos();
  }, []);

  // ─── FILTROS ──────────────────────────────────────────────
  const fornecedoresFiltered = (fornecedores || [])
    .filter(f => filtroAtivo === 'todos' || (filtroAtivo === 'ativo' ? f.ativo : !f.ativo))
    .filter(f => !busca || f.nome.toLowerCase().includes(busca.toLowerCase()))
    .filter(f => !termoAtuacao || textoAtuacao(f).includes(termoAtuacao));

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
        atuacao_segmentos: form.atuacao_segmentos,
        atuacao_sistemas: form.atuacao_sistemas,
        atuacao_marcas: form.atuacao_marcas,
        atuacao_ofertas: form.atuacao_ofertas,
        atuacao_ufs: form.atuacao_ufs,
        marca_sugerida: form.marca_sugerida || undefined,
        email: form.email || form.contato_email,
        ativo: 1,
      };

      if (modal === "novo") {
        await criar(payload);
      } else {
        await atualizar(modal, payload);
      }

      if (form.marca_sugerida && form.marca_sugerida.trim()) await recarregarOpcoesAtuacao();
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
      ...atuacaoVazia(),
      email: "",
    });
  };

  const handleEditar = (forn) => {
    // global, e local que já está no portal (etapa 10), são somente-leitura para o tenant
    if (forn.tipo === "global" || forn.editavel === false) return;
    const contato = forn.contatos?.[0] || {};
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
      email: forn.email || "",
      contato_nome: contato.nome || "",
      contato_email: contato.email || "",
      contato_telefone: contato.telefone || "",
      contato_whatsapp: contato.whatsapp || "",
      ...atuacaoDe(forn),
    });
    setModal(forn.id);
  };

  // ─── CONVITE PARA O PORTAL (etapa 10) ────────────────────
  const [convidandoId, setConvidandoId] = useState(null);
  const handleConvidar = async (forn) => {
    const sugestao = forn.convite_email || forn.email || forn.contatos?.[0]?.email || "";
    const email = window.prompt(
      `Enviar convite para ${forn.nome} acessar o portal de fornecedores.\n\n` +
      `Ele cria o próprio login e passa a manter os dados da empresa (você continua podendo ativar/desativar).\n\n` +
      `E-mail do convite:`,
      sugestao
    );
    if (email == null) return;
    setConvidandoId(forn.id);
    try {
      const r = await apiService.post(`/fornecedores/${forn.id}/convidar`, { email: email.trim() });
      alert(r?.mensagem || "Convite enviado!");
      await listar();
    } catch (e) {
      alert("Erro: " + (e.message || "não foi possível enviar o convite"));
    } finally {
      setConvidandoId(null);
    }
  };

  // ─── CONVITE A FORNECEDOR NOVO (etapas 10b e 10c) ────────
  // CNPJ obrigatório: a prévia vem da Receita (BrasilAPI, pelo navegador);
  // o backend confere de novo no envio e grava os dados no convite.
  const abrirModalConvite = (inicial = {}) => {
    setErroConvite("");
    setReceitaConvite(null);
    setModalConvite({ cnpj: "", email: "", nome: "", ...inicial });
  };

  const buscarReceitaConvite = async (cnpjFormatado) => {
    const cnpj = cnpjFormatado.replace(/\D/g, "");
    if (cnpj.length !== 14) { setReceitaConvite(null); return; }
    setReceitaConvite({ situacao: "buscando" });
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (res.status === 404 || res.status === 400) {
        setReceitaConvite({ situacao: "erro", texto: "CNPJ não encontrado na Receita Federal." });
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const d = await res.json();
      const sit = String(d.descricao_situacao_cadastral || "").toUpperCase();
      if (sit && sit !== "ATIVA") {
        setReceitaConvite({ situacao: "erro", texto: `CNPJ consta como "${d.descricao_situacao_cadastral}" na Receita. Só empresas ATIVAS podem ser convidadas.` });
        return;
      }
      setReceitaConvite({ situacao: "ok", dados: d });
      // sugere o e-mail da Receita, se o tenant ainda não digitou nenhum
      if (d.email) setModalConvite((m) => (m && !m.email ? { ...m, email: String(d.email).toLowerCase() } : m));
    } catch {
      setReceitaConvite({ situacao: "erro", texto: "Não foi possível consultar a Receita agora. Tente de novo em instantes." });
    }
  };

  const enviarConviteNovo = async (e) => {
    e?.preventDefault?.();
    const cnpj = (modalConvite?.cnpj || "").replace(/\D/g, "");
    const email = (modalConvite?.email || "").trim();
    if (cnpj.length !== 14) {
      setErroConvite("Informe o CNPJ do fornecedor (14 dígitos).");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setErroConvite("Informe um e-mail válido.");
      return;
    }
    setEnviandoConvite(true);
    setErroConvite("");
    try {
      const r = await apiService.post("/fornecedores/convidar-novo", { cnpj, email, nome: (modalConvite?.nome || "").trim() });
      setModalConvite(null);
      await carregarConvitesNovos();
      alert(r?.mensagem || "Convite enviado!");
    } catch (err) {
      setErroConvite(err.message || "Não foi possível enviar o convite.");
    } finally {
      setEnviandoConvite(false);
    }
  };

  const reenviarConviteNovo = async (c) => {
    // convite antigo, sem CNPJ: abre o modal para informar o CNPJ
    if (!c.cnpj) {
      abrirModalConvite({ email: c.email || "", nome: c.nome || "" });
      return;
    }
    setAcaoConviteId(c.id);
    try {
      const r = await apiService.post("/fornecedores/convidar-novo", { cnpj: c.cnpj, email: c.email, nome: c.nome || "" });
      await carregarConvitesNovos();
      alert(r?.mensagem || "Convite reenviado!");
    } catch (err) {
      alert("Erro: " + (err.message || "não foi possível reenviar"));
    } finally {
      setAcaoConviteId(null);
    }
  };

  const cancelarConviteNovo = async (c) => {
    if (!window.confirm(`Cancelar o convite enviado para ${c.email}? O link do e-mail deixa de funcionar.`)) return;
    setAcaoConviteId(c.id);
    try {
      await apiService.delete(`/fornecedores/convites/${c.id}`);
      await carregarConvitesNovos();
    } catch (err) {
      alert("Erro: " + (err.message || "não foi possível cancelar"));
    } finally {
      setAcaoConviteId(null);
    }
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

            {/* ─── EMAIL DE CADASTRO ─── */}
            <div style={{ marginBottom: 14 }}>
              <label style={s.label}>EMAIL DE CADASTRO</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="contato@email.com.br"
                style={s.input}
              />
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

            {/* ─── ATUAÇÃO (etapa 4) — mesmas listas do portal do fornecedor ─── */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.08em", fontWeight: 600, marginBottom: 10 }}>
                ATUAÇÃO
              </div>
              <PainelAtuacao
                opcoes={opcoesAtuacao}
                valores={form}
                onChange={(v) => setForm(f => ({ ...f, ...v }))}
                C={C}
                s={s}
              />
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => abrirModalConvite()}
            title="O fornecedor recebe um link, cadastra a empresa e já entra no portal"
            style={{ background: "transparent", border: `1px solid ${C.accent}`, borderRadius: 6, padding: "9px 18px", color: C.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            ✉ Convidar fornecedor
          </button>
          <button
            onClick={() => { resetForm(); setModal("novo"); }}
            style={{ ...s.btn(true), padding: "9px 20px", fontSize: 12 }}
          >
            ➕ Novo Fornecedor
          </button>
        </div>
      </div>

      {/* ─── MODAL: CONVIDAR FORNECEDOR NOVO ─── */}
      {modalConvite && (
        <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
          <form onSubmit={enviarConviteNovo} style={{ ...s.card, width: 480, maxWidth: "100%", boxShadow: "0 24px 48px #00000060" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Convidar fornecedor</div>
              <button type="button" onClick={() => setModalConvite(null)} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: "18px 22px" }}>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 16 }}>
                Para um fornecedor que ainda não está na sua lista. Informe o CNPJ: os dados vêm da Receita Federal e
                ficam travados no convite. Ele recebe o link por e-mail, confere os dados, completa o contato, cria o
                próprio login e entra direto como seu fornecedor.
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={s.label}>CNPJ DO FORNECEDOR</label>
                <input
                  value={modalConvite.cnpj}
                  onChange={(e) => {
                    const v = formatarCNPJ(e.target.value.replace(/\D/g, "").slice(0, 14));
                    setModalConvite((m) => ({ ...m, cnpj: v }));
                    if (v.replace(/\D/g, "").length === 14) buscarReceitaConvite(v); else setReceitaConvite(null);
                  }}
                  placeholder="00.000.000/0000-00"
                  inputMode="numeric"
                  style={s.input}
                  autoFocus
                />
                {receitaConvite?.situacao === "buscando" && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>⏳ Consultando a Receita Federal…</div>
                )}
                {receitaConvite?.situacao === "erro" && (
                  <div style={{ fontSize: 11, color: "#ef4444", marginTop: 6 }}>⚠ {receitaConvite.texto}</div>
                )}
                {receitaConvite?.situacao === "ok" && (
                  <div style={{ marginTop: 8, padding: "10px 12px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, lineHeight: 1.5 }}>
                    <div style={{ color: C.text, fontWeight: 600 }}>
                      {receitaConvite.dados.nome_fantasia || receitaConvite.dados.razao_social}
                      <span style={{ marginLeft: 8, fontSize: 10, color: "#22c55e" }}>✓ ATIVA na Receita</span>
                    </div>
                    {receitaConvite.dados.nome_fantasia && <div style={{ color: C.muted }}>{receitaConvite.dados.razao_social}</div>}
                    <div style={{ color: C.muted }}>
                      {[receitaConvite.dados.municipio, receitaConvite.dados.uf].filter(Boolean).join("/")}
                      {receitaConvite.dados.cnae_fiscal_descricao ? ` · ${receitaConvite.dados.cnae_fiscal_descricao}` : ""}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={s.label}>E-MAIL DO FORNECEDOR</label>
                <input
                  type="email"
                  value={modalConvite.email}
                  onChange={(e) => setModalConvite((m) => ({ ...m, email: e.target.value }))}
                  placeholder="vendas@fornecedor.com.br"
                  style={s.input}
                />
              </div>
              <div style={{ marginBottom: 6 }}>
                <label style={s.label}>NOME DO CONTATO <span style={{ fontWeight: 400 }}>(opcional — aparece na saudação do e-mail)</span></label>
                <input
                  value={modalConvite.nome}
                  onChange={(e) => setModalConvite((m) => ({ ...m, nome: e.target.value }))}
                  placeholder="Ex.: João"
                  maxLength={120}
                  style={s.input}
                />
              </div>
              {erroConvite && (
                <div style={{ background: "#ef444422", border: "1px solid #ef444444", borderRadius: 7, padding: "10px 14px", marginTop: 12, fontSize: 12, color: "#ef4444", lineHeight: 1.5 }}>
                  ⚠️ {erroConvite}
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 22px", borderTop: `1px solid ${C.border}` }}>
              <button type="button" onClick={() => setModalConvite(null)} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 16px", color: C.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                Cancelar
              </button>
              <button type="submit" disabled={enviandoConvite || receitaConvite?.situacao === "buscando" || receitaConvite?.situacao === "erro"} style={{ ...s.btn(true), padding: "8px 18px", fontSize: 12, opacity: enviandoConvite || receitaConvite?.situacao === "buscando" || receitaConvite?.situacao === "erro" ? 0.6 : 1 }}>
                {enviandoConvite ? "Enviando…" : "Enviar convite"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── FILTROS ─── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Buscar fornecedor..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ ...s.input, flex: 1, minWidth: 200, padding: "8px 12px", fontSize: 12 }}
        />
        
        {/* 🔥 FILTRO POR CATEGORIA (autocomplete simples) */}
        <input
          type="text"
          placeholder="Filtrar por atuação (ex.: hidráulica, Volvo)..."
          value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)}
          style={{ ...s.input, width: 180, padding: "8px 12px", fontSize: 12 }}
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

      {/* ─── LISTA DE FORNECEDORES ─── */}
      <div style={{ ...s.card, overflow: "hidden" }}>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "2fr 1.5fr 1fr 0.8fr 150px", 
          padding: "10px 18px", 
          background: C.bg, 
          borderBottom: `1px solid ${C.border}`, 
          fontSize: 10, 
          color: C.muted, 
          letterSpacing: "0.08em" 
        }}>
          <span>FORNECEDOR</span>
          <span>CONTATO</span>
          <span>ATUAÇÃO</span>
          <span>TIPO</span>
          <span>STATUS</span>
        </div>
        
        {fornecedoresFiltered.map((forn, i) => {
          const contato = forn.contatos?.[0] || {};
          return (
            <div
              key={forn.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1.5fr 1fr 0.8fr 150px",
                padding: "13px 18px",
                borderBottom: i < fornecedoresFiltered.length - 1 ? `1px solid ${C.border}22` : "none",
                alignItems: "center",
              }}
            >
              {/* FORNECEDOR */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text, fontWeight: 500 }}>
                  {forn.nome}
                  {forn.tipo === "global" && (
                    <span
                      style={{
                        fontSize: 9,
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
                {forn.cidade && forn.estado && <div style={{ fontSize: 10, color: C.muted }}>{forn.cidade}/{forn.estado}</div>}
                {forn.tipo !== "global" && forn.portal_ativo && (
                  <div style={{ fontSize: 10, color: C.success, marginTop: 2 }} title="O fornecedor mantém os próprios dados no portal">
                    🟢 No portal
                  </div>
                )}
                {forn.tipo !== "global" && !forn.portal_ativo && forn.convite_pendente_ate && (
                  <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 2 }}>
                    ✉ Convite enviado · vale até {new Date(forn.convite_pendente_ate).toLocaleDateString("pt-BR")}
                  </div>
                )}
              </div>

              {/* CONTATO */}
              <div>
                {contato.nome && <div style={{ fontSize: 12, color: C.text }}>{contato.nome}</div>}
                <div style={{ fontSize: 11, color: C.accent }}>{contato.email || "—"}</div>
              </div>

              {/* ATUAÇÃO (resumida: sistemas; marcas embaixo) */}
              <div style={{ fontSize: 10, color: C.muted }}>
                <div><ResumoAtuacao opcoes={opcoesAtuacao} dimensao="sistema" codigos={forn.atuacao_sistemas} /></div>
                {(forn.atuacao_marcas || []).length > 0 && (
                  <div style={{ opacity: 0.8 }}><ResumoAtuacao opcoes={opcoesAtuacao} dimensao="marca" codigos={forn.atuacao_marcas} /></div>
                )}
              </div>

              {/* TIPO */}
              <div>
                <span style={{ 
                  ...s.tag(forn.tipo === "global" ? C.success : C.muted), 
                  fontSize: 9,
                  background: forn.tipo === "global" ? "#22c55e22" : "transparent",
                  border: `1px solid ${forn.tipo === "global" ? "#22c55e44" : C.border}`,
                }}>
                  {forn.tipo === "global" ? "Global" : "Local"}
                </span>
              </div>

              {/* STATUS + AÇÕES */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                <span style={{ ...s.tag(forn.ativo ? C.success : C.muted), fontSize: 10 }}>
                  {forn.ativo ? "Ativo" : "Inativo"}
                </span>
                {forn.tipo === "global" || forn.editavel === false ? (
                  // Global (plataforma) ou local que já está no portal (o próprio fornecedor mantém) — tenant não edita
                  <span
                    title={forn.tipo === "global"
                      ? "Fornecedor da rede global: os dados são mantidos pela plataforma"
                      : "Fornecedor no portal: ele mesmo mantém os dados da empresa"}
                    style={{ border: `1px solid ${C.border}`, borderRadius: 5, padding: "4px 8px", color: C.muted, fontSize: 11, opacity: 0.6 }}
                  >
                    🔒
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => handleConvidar(forn)}
                      disabled={convidandoId === forn.id}
                      title={forn.convite_pendente_ate ? "Reenviar convite para o portal" : "Convidar para o portal de fornecedores"}
                      style={{ background: "transparent", border: `1px solid ${C.accent}55`, borderRadius: 5, padding: "4px 8px", color: C.accent, fontSize: 11, cursor: "pointer", fontFamily: "inherit", opacity: convidandoId === forn.id ? 0.5 : 1 }}
                    >
                      ✉
                    </button>
                    <button
                      onClick={() => handleEditar(forn)}
                      style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 5, padding: "4px 8px", color: C.muted, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      ✏
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleToggleAtivo(forn)}
                  title={forn.tipo === "global"
                    ? (forn.ativo ? "Desativar para a minha empresa (não afeta outros clientes)" : "Reativar para a minha empresa")
                    : (forn.ativo ? "Desativar" : "Ativar")}
                  style={{ background: "transparent", border: `1px solid ${forn.ativo ? "#ef444433" : "#22c55e33"}`, borderRadius: 5, padding: "4px 8px", color: forn.ativo ? "#ef4444" : C.success, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                >
                  {forn.ativo ? "❌" : "✅"}
                </button>
              </div>
            </div>
          );
        })}
        {fornecedoresFiltered.length === 0 && !loading && (
          <div style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>Nenhum fornecedor encontrado</div>
        )}
      </div>

      {/* ─── CONVITES AGUARDANDO CADASTRO (etapa 10b) ─── */}
      {convitesNovos.length > 0 && (
        <div style={{ ...s.card, overflow: "hidden", marginTop: 18 }}>
          <div style={{ padding: "10px 18px", background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, letterSpacing: "0.08em" }}>
            CONVITES AGUARDANDO CADASTRO · {convitesNovos.length}
          </div>
          {convitesNovos.map((c, i) => (
            <div
              key={c.id}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: i < convitesNovos.length - 1 ? `1px solid ${C.border}22` : "none", flexWrap: "wrap" }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, color: C.text }}>
                  {c.empresa ? <><b style={{ fontWeight: 600 }}>{c.empresa}</b> <span style={{ color: C.muted }}>·</span> </> : null}
                  {c.nome ? <>{c.nome} <span style={{ color: C.muted }}>·</span> </> : null}
                  <span style={{ color: C.accent }}>{c.email}</span>
                </div>
                {c.cnpj && <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>CNPJ {formatarCNPJ(c.cnpj)}</div>}
                <div style={{ fontSize: 10, color: c.expirado ? "#ef4444" : "#f59e0b", marginTop: 2 }}>
                  {c.expirado
                    ? `✉ Convite expirou em ${new Date(c.expira_em).toLocaleDateString("pt-BR")} — reenvie se ainda quiser`
                    : `✉ Enviado${c.enviado_em ? ` em ${new Date(c.enviado_em).toLocaleDateString("pt-BR")}` : ""} · vale até ${new Date(c.expira_em).toLocaleDateString("pt-BR")}`}
                </div>
              </div>
              <button
                onClick={() => reenviarConviteNovo(c)}
                disabled={acaoConviteId === c.id}
                style={{ background: "transparent", border: `1px solid ${C.accent}55`, borderRadius: 5, padding: "5px 10px", color: C.accent, fontSize: 11, cursor: "pointer", fontFamily: "inherit", opacity: acaoConviteId === c.id ? 0.5 : 1 }}
              >
                Reenviar
              </button>
              <button
                onClick={() => cancelarConviteNovo(c)}
                disabled={acaoConviteId === c.id}
                style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 5, padding: "5px 10px", color: C.muted, fontSize: 11, cursor: "pointer", fontFamily: "inherit", opacity: acaoConviteId === c.id ? 0.5 : 1 }}
              >
                Cancelar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}