// frontend/src/components/naoConformidades/ModalDetalheNC.jsx
//
// Detalhe completo de uma NC com fluxo de tratamento:
//   - Ações de status (aberta → em_analise → em_execucao → resolvida / cancelada)
//   - Fotos com compressão client-side (data URI)
//   - Plano de ação 3W
//   - Timeline de eventos
//   - Comentários

import { useState, useEffect, useRef } from "react";
import apiService from "../../services/apiService";

// Sugestão automática de área por tipo de disposição. O usuário pode
// sobrescrever no mini-modal. Alinhado com o fluxo real: devolução vai
// pra Suprimentos, retrabalho e descarte pra Produção, uso como está
// precisa de aval da Qualidade.
const AREA_POR_DISPOSICAO = {
  devolucao:     "suprimentos",
  retrabalho:    "producao",
  descarte:      "producao",
  uso_como_esta: "qualidade",
};

// Heurística de mapeamento perfil → área. Não há coluna `area` em usuarios,
// então usamos o perfil como proxy. Quando tiver volume maior, migra pra
// coluna dedicada.
const PERFIS_POR_AREA = {
  suprimentos: ["comprador"],
  producao:    ["tecnico"],
  manutencao:  ["tecnico"],
  engenharia:  ["gestor", "admin"],
  qualidade:   ["gestor", "admin"],
};

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  aberta:               { l: "Aberta",                c: "#f59e0b", icon: "🟡" },
  em_analise:           { l: "Em análise",            c: "#60a5fa", icon: "🔍" },
  em_execucao:          { l: "Em execução",           c: "#a855f7", icon: "⚙️" },
  aguardando_validacao: { l: "Aguardando validação",  c: "#f59e0b", icon: "⏳" },
  resolvida:            { l: "Resolvida",             c: "#22c55e", icon: "✅" },
  cancelada:            { l: "Cancelada",             c: "#6b7280", icon: "⚫" },
};

// M4.2: pipeline único de tratativa com fornecedor (6 estados).
// Substitui o esquema antigo (nao_notificado/notificado) que misturava
// "envio" com "leitura".
const TRATATIVA_FORNECEDOR_CFG = {
  nao_enviado:          { l: "Aguardando triagem interna",   c: "#9ca3af", icon: "🔒" },
  enviado:              { l: "Enviado ao fornecedor",        c: "#f59e0b", icon: "📤" },
  visualizado:          { l: "Visualizado pelo fornecedor",  c: "#3b82f6", icon: "👁" },
  // M4.4-etapa-9: status do loop de negociação
  devolvida:            { l: "Devolvida ao fornecedor",      c: "#f59e0b", icon: "🔄" },
  aceita:               { l: "Fornecedor aceitou",           c: "#10b981", icon: "✅" },
  contestada:           { l: "Fornecedor contestou",         c: "#ef4444", icon: "✋" },
  resolvida_fornecedor: { l: "Fornecedor resolveu",          c: "#a855f7", icon: "🎯" },
};

const EVENTO_CFG = {
  criacao:                  { icon: "🆕", c: "#60a5fa" },
  status_alterado:          { icon: "🔄", c: "#f59e0b" },
  disposicao_definida:      { icon: "🎯", c: "#a855f7" },
  resolucao:                { icon: "✅", c: "#22c55e" },
  cancelamento:             { icon: "⚫", c: "#6b7280" },
  plano_acao_adicionado:    { icon: "➕", c: "#60a5fa" },
  plano_acao_concluido:     { icon: "🏁", c: "#22c55e" },
  anexo_adicionado:         { icon: "📷", c: "#60a5fa" },
  anexo_removido:           { icon: "🗑", c: "#ef4444" },
  comentario:               { icon: "💬", c: "#a855f7" },
  atualizacao:              { icon: "✏️", c: "#f59e0b" },
  transferencia:            { icon: "↪️", c: "#a855f7" },
  direcionamento:           { icon: "🎯", c: "#60a5fa" },
  disposicao_definida:      { icon: "🎯", c: "#a855f7" },
  devolucao_validacao:      { icon: "↩️", c: "#f59e0b" },
  encerramento:             { icon: "🏁", c: "#22c55e" },
};

function fmtDataHora(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR") + " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ─────────────────────────────────────────────────────────────────────────
// COMPRESSÃO DE IMAGEM (client-side)
//
// Lê o File, redimensiona pra caber em 1200px de largura máxima, aplica
// JPEG quality 0.75. Resultado vira data URI (~150-250KB por foto).
// ─────────────────────────────────────────────────────────────────────────
function comprimirImagem(file, { maxDim = 1200, quality = 0.75 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Arquivo não é uma imagem"));
      return;
    }
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Erro ao ler arquivo"));
    leitor.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Erro ao processar imagem"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height >= width && height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const dataUri = canvas.toDataURL("image/jpeg", quality);
        const tamanhoBytes = Math.round((dataUri.length - 22) * 0.75);
        resolve({ dataUri, mime_type: "image/jpeg", tamanho_bytes: tamanhoBytes });
      };
      img.src = ev.target.result;
    };
    leitor.readAsDataURL(file);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────
export default function ModalDetalheNC({
  ncId, onFechar, onAtualizar, onIrParaOS, s, C, fmtD,
}) {
  const [nc, setNc] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  // M4.3-j: confirmação antes de disparar email externo ao fornecedor.
  const [confirmandoEnvio, setConfirmandoEnvio] = useState(false);
  const [toast, setToast] = useState(null);

  // Form de resolver (mini-modal interno)
  const [resolvendo, setResolvendo] = useState(null);

  // Mini-modais do novo fluxo (ISO 9001)
  const [direcionando, setDirecionando] = useState(null);
  // { area_responsavel, responsavel_id, responsavel_nome, observacao }

  const [registrandoDisposicao, setRegistrandoDisposicao] = useState(null);
  // { disposicao, acao_corretiva, executante_id, executante_nome }

  const [devolvendoValidacao, setDevolvendoValidacao] = useState(null);
  // { observacao }

  const [encerrando, setEncerrando] = useState(null);
  // { causa_raiz, cinco_porques: [5 strings], observacao }

  // Mini-modal de transferência
  const [transferindo, setTransferindo] = useState(null);
  // { responsavel_id: "", responsavel_nome: "", observacao: "" }

  // Lista de usuários elegíveis pra receber NC
  const [usuariosElegiveis, setUsuariosElegiveis] = useState([]);
  // M4.1: perfil do usuário logado (pra mostrar/ocultar botão de
  // notificar fornecedor). Lido uma vez do localStorage — se o backend
  // rejeitar depois, o modal mostra o erro.
  const [perfilUsuario, setPerfilUsuario] = useState(null);

  // Form de plano de ação
  const [novoPlano, setNovoPlano] = useState(null);
  // { acao: "", responsavel_nome: "", prazo: "" }

  // Comentário livre
  const [comentario, setComentario] = useState("");

  // Upload em andamento
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const cameraInputRef = useRef(null);
  const galeriaInputRef = useRef(null);

  // Lightbox
  const [fotoAberta, setFotoAberta] = useState(null);
  // Histórico começa recolhido pra não empurrar os botões de ação
  const [historicoExpandido, setHistoricoExpandido] = useState(false);

  // ── Carrega detalhe ──
  async function carregar() {
    setCarregando(true);
    try {
      const r = await apiService.get(`/nao-conformidades/${ncId}`);
      setNc(r);
    } catch (e) {
      setErro(e.message || "Erro ao carregar NC");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, [ncId]);

  // M4.3-i: auto-clear do toast de sucesso em 4s.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // M4.3-j: Esc cancela o modal de confirmação de envio.
  useEffect(() => {
    if (!confirmandoEnvio) return;
    const onKey = (e) => { if (e.key === "Escape") setConfirmandoEnvio(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmandoEnvio]);

  useEffect(() => {
    apiService.get("/usuarios")
      .then(lista => {
        const todos = Array.isArray(lista) ? lista : [];
        setUsuariosElegiveis(
          todos.filter(u => ["tecnico", "gestor", "admin"].includes(u.perfil))
        );
      })
      .catch(() => setUsuariosElegiveis([]));
  }, []);

  // M4.1: pega perfil do usuário logado do localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("usuario");
      const u = raw ? JSON.parse(raw) : null;
      setPerfilUsuario(u?.perfil || null);
    } catch (_) {
      setPerfilUsuario(null);
    }
  }, []);

  // ── Ações de status ──
  async function mudarStatus(novoStatus, extra = {}) {
    setSalvando(true);
    setErro(null);
    try {
      await apiService.put(`/nao-conformidades/${ncId}/status`, {
        status: novoStatus,
        ...extra,
      });
      await carregar();
      onAtualizar?.();
    } catch (e) {
      setErro(e.message || "Erro ao alterar status");
    } finally {
      setSalvando(false);
      setResolvendo(null);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // AÇÕES DO NOVO FLUXO (ISO 9001 — 4 etapas)
  // ─────────────────────────────────────────────────────────────────

  // [1] → [2]: Qualidade direciona pra uma área
  async function direcionarNC() {
    if (!direcionando?.area_responsavel) {
      setErro("Selecione a área responsável.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await apiService.put(`/nao-conformidades/${ncId}/direcionar`, {
        area_responsavel: direcionando.area_responsavel,
        responsavel_id: direcionando.responsavel_id || null,
        responsavel_nome: direcionando.responsavel_nome || null,
        observacao: direcionando.observacao?.trim() || null,
      });
      await carregar();
      onAtualizar?.();
      setDirecionando(null);
    } catch (e) {
      setErro(e.message || "Erro ao direcionar");
    } finally {
      setSalvando(false);
    }
  }

  // [2] → [3]: Responsável registra disposição e define executante
  async function registrarDisposicao() {
    const d = registrandoDisposicao;
    if (!d?.disposicao) { setErro("Selecione a disposição."); return; }
    if (!d?.area_responsavel) { setErro("Selecione a área responsável."); return; }
    if (!d?.acao_corretiva?.trim()) { setErro("Descreva a ação corretiva."); return; }
    if (!d?.executante_id || !d?.executante_nome) { setErro("Selecione o executante."); return; }

    setSalvando(true);
    setErro(null);
    try {
      await apiService.put(`/nao-conformidades/${ncId}/registrar-disposicao`, {
        disposicao: d.disposicao,
        area_responsavel: d.area_responsavel,
        acao_corretiva: d.acao_corretiva.trim(),
        executante_id: d.executante_id,
        executante_nome: d.executante_nome,
      });
      await carregar();
      onAtualizar?.();
      setRegistrandoDisposicao(null);
    } catch (e) {
      setErro(e.message || "Erro ao registrar disposição");
    } finally {
      setSalvando(false);
    }
  }

  // [3] → [4]: Executante devolve pra validação
  async function devolverValidacao() {
    setSalvando(true);
    setErro(null);
    try {
      await apiService.put(`/nao-conformidades/${ncId}/devolver-validacao`, {
        observacao: devolvendoValidacao?.observacao?.trim() || null,
      });
      await carregar();
      onAtualizar?.();
      setDevolvendoValidacao(null);
    } catch (e) {
      setErro(e.message || "Erro ao devolver para validação");
    } finally {
      setSalvando(false);
    }
  }

  // [4] → [5]: Qualidade encerra com causa raiz (e opcionalmente 5 porquês)
  async function encerrarNC() {
    if (!encerrando?.causa_raiz?.trim()) {
      setErro("Descreva a causa raiz.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const porques = (encerrando.cinco_porques || [])
        .map(p => (p || "").trim())
        .filter(Boolean);
      await apiService.put(`/nao-conformidades/${ncId}/encerrar`, {
        causa_raiz: encerrando.causa_raiz.trim(),
        cinco_porques: porques.length > 0 ? porques : null,
        observacao: encerrando.observacao?.trim() || null,
      });
      await carregar();
      onAtualizar?.();
      setEncerrando(null);
    } catch (e) {
      setErro(e.message || "Erro ao encerrar");
    } finally {
      setSalvando(false);
    }
  }

  // M4.3-j: dispara o modal de confirmação. Quem efetivamente envia
  // é `notificarFornecedor` (abaixo), chamada pelo botão do modal.
  function abrirConfirmacaoEnvio() {
    setConfirmandoEnvio(true);
  }

  function confirmarEnvio() {
    setConfirmandoEnvio(false);
    notificarFornecedor();
  }

  // M4.1: notificar fornecedor (fluxo de aprovação)
  // M4.3-i: feedback via toast in-place (o window.confirm voltou como
  // modal próprio — ver M4.3-j).
  async function notificarFornecedor() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await apiService.post(`/nao-conformidades/${ncId}/notificar-fornecedor`, {});
      await carregar();
      onAtualizar?.();
      setToast(r?.mensagem || `Email enviado para ${nc.fornecedor_nome || 'o fornecedor'}.`);
    } catch (e) {
      setErro(e.message || "Erro ao notificar fornecedor");
    } finally {
      setSalvando(false);
    }
  }

  async function cancelarNC() {
    const motivo = window.prompt("Motivo do cancelamento:");
    if (motivo === null) return;
    if (!motivo.trim()) {
      alert("Motivo é obrigatório para cancelar");
      return;
    }
    await mudarStatus("cancelada", { motivo: motivo.trim() });
  }

  async function transferirNC() {
    const { responsavel_id, responsavel_nome, observacao } = transferindo || {};
    if (!responsavel_id && !observacao?.trim()) {
      setErro("Selecione um responsável ou descreva o motivo de devolver para a fila.");
      return;
    }
    setSalvando(true);
    try {
      await apiService.put(`/nao-conformidades/${ncId}/transferir`, {
        responsavel_id: responsavel_id || null,
        responsavel_nome: responsavel_nome || null,
        observacao: observacao?.trim() || null,
      });
      await carregar();
      onAtualizar?.();
      setTransferindo(null);
    } catch (e) {
      setErro(e.message || "Erro ao transferir");
    } finally {
      setSalvando(false);
    }
  }

  // ── Plano de ação ──
  async function adicionarPlano() {
    if (!novoPlano?.acao?.trim() || !novoPlano?.prazo) {
      setErro("Preencha ação e prazo.");
      return;
    }
    setSalvando(true);
    try {
      await apiService.post(`/nao-conformidades/${ncId}/plano-acao`, {
        acao: novoPlano.acao.trim(),
        responsavel_nome: novoPlano.responsavel_nome?.trim() || null,
        prazo: novoPlano.prazo,
      });
      setNovoPlano(null);
      await carregar();
    } catch (e) {
      setErro(e.message || "Erro ao adicionar plano");
    } finally {
      setSalvando(false);
    }
  }

  async function atualizarPlano(planoId, patch) {
    setSalvando(true);
    try {
      await apiService.put(`/nao-conformidades/plano-acao/${planoId}`, patch);
      await carregar();
    } catch (e) {
      setErro(e.message || "Erro ao atualizar plano");
    } finally {
      setSalvando(false);
    }
  }

  async function removerPlano(planoId) {
    if (!window.confirm("Remover esta ação?")) return;
    setSalvando(true);
    try {
      await apiService.delete(`/nao-conformidades/plano-acao/${planoId}`);
      await carregar();
    } catch (e) {
      setErro(e.message || "Erro ao remover plano");
    } finally {
      setSalvando(false);
    }
  }

  // ── Anexos ──
  async function onArquivosSelecionados(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = "";
    setEnviandoFoto(true);
    setErro(null);
    let sucesso = 0;
    const falhas = [];
    try {
      for (const file of files) {
        try {
          const { dataUri, mime_type, tamanho_bytes } = await comprimirImagem(file);
          await apiService.post(`/nao-conformidades/${ncId}/anexos`, {
            url: dataUri,
            mime_type,
            tamanho_bytes,
          });
          sucesso++;
        } catch (err) {
          falhas.push(`${file.name}: ${err.message}`);
        }
      }
      await carregar();
      if (falhas.length > 0) {
        setErro(`${sucesso} foto(s) enviada(s). Falhas: ${falhas.join(" · ")}`);
      }
    } finally {
      setEnviandoFoto(false);
    }
  }

  async function removerAnexo(anexo) {
    if (!window.confirm(`Remover "${anexo.nome_arquivo}"?`)) return;
    setSalvando(true);
    try {
      await apiService.delete(`/nao-conformidades/anexos/${anexo.id}`);
      await carregar();
    } catch (e) {
      setErro(e.message || "Erro ao remover anexo");
    } finally {
      setSalvando(false);
    }
  }

  // ── Comentário ──
  async function enviarComentario() {
    if (!comentario.trim()) return;
    setSalvando(true);
    try {
      await apiService.post(`/nao-conformidades/${ncId}/comentario`, {
        descricao: comentario.trim(),
      });
      setComentario("");
      await carregar();
    } catch (e) {
      setErro(e.message || "Erro ao enviar comentário");
    } finally {
      setSalvando(false);
    }
  }

  // ── Render ──
  if (carregando && !nc) {
    return (
      <Overlay onFechar={onFechar} C={C}>
        <div style={{ ...s.card, width: 900, maxWidth: "100%", padding: 40, textAlign: "center" }}>
          <div style={{ color: C.muted }}>Carregando NC...</div>
        </div>
      </Overlay>
    );
  }

  if (!nc) {
    return (
      <Overlay onFechar={onFechar} C={C}>
        <div style={{ ...s.card, width: 900, maxWidth: "100%", padding: 40, textAlign: "center" }}>
          <div style={{ color: "#ef4444" }}>⚠ {erro || "NC não encontrada"}</div>
        </div>
      </Overlay>
    );
  }

  const st = STATUS_CFG[nc.status] || { l: nc.status, c: C.muted, icon: "•" };
  // Novo fluxo ISO 9001
  const podeDirecionar        = nc.status === "aberta";
  const podeRegistrarDisp     = nc.status === "em_analise";
  const podeDevolverValidacao = nc.status === "em_execucao";
  const podeEncerrar          = nc.status === "aguardando_validacao";
  const podeCancelar          = ["aberta", "em_analise", "em_execucao"].includes(nc.status);
  const podeTransferir        = ["aberta", "em_analise", "em_execucao"].includes(nc.status);
  const encerrada             = ["resolvida", "cancelada"].includes(nc.status);

  return (
    <Overlay onFechar={onFechar} C={C}>
      <div style={{ ...s.card, width: 900, maxWidth: "100%", maxHeight: "92vh",
                    display: "flex", flexDirection: "column" }}>

        {/* Cabeçalho */}
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}`,
                      display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8,
                          marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: C.accent,
                             fontFamily: "'IBM Plex Mono',monospace" }}>
                {nc.numero_nc}
              </span>
              <span style={{ ...s.tag(st.c), fontSize: 10 }}>
                {st.icon} {st.l}
              </span>

              {/* M4.1: badge do status de tratativa com o fornecedor.
                  Só mostra quando a NC tem fornecedor vinculado. */}
              {nc.fornecedor_id && nc.fornecedor_tratativa_status && (() => {
                const tf = TRATATIVA_FORNECEDOR_CFG[nc.fornecedor_tratativa_status];
                if (!tf) return null;
                return (
                  <span style={{ ...s.tag(tf.c), fontSize: 10 }} title={`Fornecedor: ${nc.fornecedor_nome || '—'}`}>
                    {tf.icon} {tf.l}
                  </span>
                );
              })()}
            </div>

            {/* M4.1: rastreio de leitura pelo fornecedor — "mensagem lida".
                Mostra timestamp quando disponível. */}
            {nc.fornecedor_ciente_em && (
              <div style={{
                fontSize: 10, color: C.muted, marginTop: 4,
                display: 'flex', gap: 4, alignItems: 'center',
              }}>
                <span>👁</span>
                <span>Visualizada pelo fornecedor em {fmtDataHora(nc.fornecedor_ciente_em)}</span>
              </div>
            )}
            <div style={{ fontSize: 11, color: C.muted, display: "flex",
                          gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              {nc.chamado_numero && (
                <span style={{ color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>
                  🔗 {nc.chamado_numero}
                </span>
              )}
              {nc.equipamento_nome && nc.equipamento_nome !== "—" && (
                <span>🔧 {nc.equipamento_nome}
                  {nc.equipamento_tag && ` · ${nc.equipamento_tag}`}
                </span>
              )}
              {nc.criado_por_nome && <span>👤 aberta por {nc.criado_por_nome}</span>}
              {nc.criado_em && <span>📅 {fmtDataHora(nc.criado_em)}</span>}

              {nc.area_responsavel && (
                <span style={{ ...s.tag("#60a5fa"), fontSize: 10 }}>
                  📂 {nc.area_responsavel}
                </span>
              )}
              {nc.responsavel_nome && (
                <span style={{ color: "#60a5fa", fontWeight: 600 }}>
                  🎯 responsável: {nc.responsavel_nome}
                </span>
              )}
              {nc.executante_nome && nc.executante_nome !== nc.responsavel_nome && (
                <span style={{ color: "#a855f7", fontWeight: 600 }}>
                  🔨 executor: {nc.executante_nome}
                </span>
              )}
              {nc.encerrada_por_nome && (
                <span style={{ color: C.success, fontWeight: 600 }}>
                  🏁 encerrada por {nc.encerrada_por_nome}
                </span>
              )}
            </div>
          </div>
          <button onClick={onFechar}
            style={{ background: "transparent", border: "none",
                     color: C.muted, fontSize: 22, cursor: "pointer",
                     lineHeight: 1 }}>×</button>
        </div>

        {/* Corpo scrollável */}
        <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>

          {/* M4.3-i: toast de sucesso in-place (some em 4s). */}
          {toast && (
            <div style={{
              padding: "10px 14px", background: "#10b98115",
              border: "1px solid #10b98155", borderRadius: 6,
              fontSize: 12, color: "#10b981", marginBottom: 16,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span>✅</span>
              <span style={{ flex: 1 }}>{toast}</span>
              <button
                onClick={() => setToast(null)}
                style={{ background: "transparent", border: "none",
                         color: "#10b981", cursor: "pointer", fontSize: 14 }}
                title="Fechar"
              >
                ×
              </button>
            </div>
          )}

          {erro && (
            <div style={{ padding: "10px 12px", background: "#ef444415",
                          border: "1px solid #ef444440", borderRadius: 6,
                          fontSize: 11, color: "#ef4444", marginBottom: 16 }}>
              ⚠ {erro}
            </div>
          )}

          {/* M4.2: banner quando o fornecedor já respondeu e precisa
              de ação do comprador (validar resolução ou tratar contestação). */}
          {nc.fornecedor_tratativa_status === 'resolvida_fornecedor' && (
            <div style={{
              padding: "12px 16px", background: "#a855f715",
              border: "1px solid #a855f755", borderRadius: 8,
              marginBottom: 16, display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 20 }}>🎯</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a855f7" }}>
                  Fornecedor marcou esta NC como resolvida
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  Valide a solução para encerrar a NC, ou rejeite se não atender.
                </div>
              </div>
            </div>
          )}

          {nc.fornecedor_tratativa_status === 'contestada' && (
            <div style={{
              padding: "12px 16px", background: "#ef444415",
              border: "1px solid #ef444455", borderRadius: 8,
              marginBottom: 16, display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 20 }}>✋</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#ef4444" }}>
                  Fornecedor contestou esta NC
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  Avalie a contestação: se for justa, aceite e cancele a NC. Caso contrário, rejeite e siga a tratativa interna.
                </div>
              </div>
            </div>
          )}

          {/* M4.3: banner de triagem quando a NC tem fornecedor_id
              mas ainda está 'nao_enviado'. Comunica que o fornecedor
              NÃO tem acesso e oferece os 2 caminhos. */}
          {nc.fornecedor_id && nc.fornecedor_tratativa_status === 'nao_enviado' && (
            <div style={{
              padding: "12px 16px", background: "#2e1c0c",
              border: "1px solid #f59e0b55", borderRadius: 8,
              marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>🔒</span>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b" }}>
                  Aguardando triagem — fornecedor NÃO tem acesso
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                Esta NC nasceu vinculada a <strong>{nc.fornecedor_nome || '—'}</strong> (via OC),
                mas ainda não foi decidido se é responsabilidade dele. O fornecedor
                <strong> não vê</strong> esta NC até você clicar em "📤 Notificar fornecedor".
                Se a triagem concluir que <strong>não é do fornecedor</strong> (ex: dano interno,
                transporte, empilhadeira), use "Marcar como interna".
              </div>
            </div>
          )}

          {/* ── Descrição ── */}
          <Secao titulo="DESCRIÇÃO DO PROBLEMA" C={C}>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>
              {nc.descricao_problema || nc.motivo_recusa || '—'}
            </div>
          </Secao>

          {/* ── Rastreabilidade ──
              Dados fiscais e físicos do material recusado. Alimenta o
              relatório PDF (M4.3) e serve pro fornecedor conferir a
              partida sem precisar abrir os anexos.
              Só renderiza a seção se pelo menos um campo estiver
              preenchido. */}
          {(() => {
            const campos = [
              { label: 'Número da NF',         valor: nc.numero_nota_fiscal },
              { label: 'Pedido (OC)',          valor: nc.numero_pedido },
              { label: 'RC origem',            valor: nc.chamado_numero },
              { label: 'Quantidade recusada',  valor: nc.quantidade != null ? `${nc.quantidade} ${nc.unidade_medida || 'UN'}` : null },
              { label: 'Lote',                 valor: nc.lote },
              { label: 'Número de série',      valor: nc.numero_serie },
              { label: 'Validade',             valor: nc.validade ? new Date(nc.validade).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : null },
            ].filter(c => c.valor != null && c.valor !== '');

            if (campos.length === 0) return null;

            return (
              <Secao titulo="DADOS DE RASTREABILIDADE" C={C}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 10,
                }}>
                  {campos.map((c, i) => (
                    <div key={i}>
                      <div style={{
                        fontSize: 9, color: C.muted,
                        letterSpacing: '0.06em', marginBottom: 2,
                        textTransform: 'uppercase', fontWeight: 600,
                      }}>
                        {c.label}
                      </div>
                      <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>
                        {c.valor}
                      </div>
                    </div>
                  ))}
                </div>
              </Secao>
            );
          })()}

          {/* ── Disposição + ação corretiva (aparecem quando registradas) ── */}
          {nc.disposicao && nc.disposicao !== "pendente" && (
            <Secao titulo="DISPOSIÇÃO" C={C}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ ...s.tag("#a855f7"), fontSize: 10 }}>
                  {({ devolucao: "↩️ Devolução", retrabalho: "🔧 Retrabalho",
                      descarte: "🗑 Descarte", uso_como_esta: "✔️ Uso como está",
                      pendente: "⏳ Pendente"
                    })[nc.disposicao] || nc.disposicao}
                </span>
              </div>
              {nc.acao_corretiva && (
                <div style={{ fontSize: 12, color: C.text,
                              padding: "8px 12px", background: `${"#a855f7"}10`,
                              borderLeft: `2px solid #a855f7`, borderRadius: 3 }}>
                  {nc.acao_corretiva}
                </div>
              )}
            </Secao>
          )}

          {/* ── Causa raiz + 5 porquês (quando encerrada) ── */}
          {nc.causa_raiz && (
            <Secao titulo="CAUSA RAIZ" C={C}>
              <div style={{ fontSize: 12, color: C.text,
                            padding: "8px 12px", background: `${C.success}10`,
                            borderLeft: `2px solid ${C.success}`, borderRadius: 3 }}>
                {nc.causa_raiz}
              </div>

              {Array.isArray(nc.cinco_porques) && nc.cinco_porques.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, color: C.muted,
                                letterSpacing: "0.08em", marginBottom: 6 }}>
                    ANÁLISE DOS 5 PORQUÊS
                  </div>
                  {nc.cinco_porques.map((p, i) => (
                    <div key={i} style={{
                      display: "flex", gap: 8, padding: "6px 0",
                      borderBottom: i < nc.cinco_porques.length - 1
                        ? `1px dashed ${C.border}` : "none",
                      fontSize: 11,
                    }}>
                      <span style={{
                        color: "#a855f7", fontWeight: 700,
                        fontFamily: "'IBM Plex Mono',monospace",
                        flexShrink: 0,
                      }}>
                        {i + 1}º
                      </span>
                      <span style={{ color: C.text }}>{p}</span>
                    </div>
                  ))}
                </div>
              )}
            </Secao>
          )}

          {/* ── Solução aplicada (resolvida) ── */}
          {nc.solucao_aplicada && (
            <Secao titulo="SOLUÇÃO APLICADA" C={C}>
              <div style={{ fontSize: 12, color: C.text, fontStyle: "italic",
                            padding: "8px 12px", background: `${C.success}10`,
                            borderLeft: `2px solid ${C.success}`, borderRadius: 3 }}>
                {nc.solucao_aplicada}
              </div>
              {nc.resolvida_por_nome && (
                <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>
                  Resolvida por {nc.resolvida_por_nome}
                  {nc.resolvida_em && ` · ${fmtDataHora(nc.resolvida_em)}`}
                </div>
              )}
            </Secao>
          )}

          {/* ── Motivo cancelamento ── */}
          {nc.motivo_cancelamento && (
            <Secao titulo="MOTIVO DO CANCELAMENTO" C={C}>
              <div style={{ fontSize: 12, color: "#ef4444",
                            padding: "8px 12px", background: "#ef444415",
                            borderLeft: `2px solid #ef4444`, borderRadius: 3 }}>
                {nc.motivo_cancelamento}
              </div>
            </Secao>
          )}

          {/* ── Fotos ── */}
          <Secao
            titulo={`EVIDÊNCIAS (${(nc.anexos || []).length})`}
            C={C}
            extra={
              !encerrada && (
                <>
                  {/* Câmera (mobile) — capture força abrir direto a câmera traseira */}
                  <input ref={cameraInputRef} type="file" accept="image/*"
                    capture="environment" multiple
                    style={{ display: "none" }}
                    onChange={onArquivosSelecionados} />
                  {/* Galeria / arquivo (desktop e mobile) — sem capture */}
                  <input ref={galeriaInputRef} type="file" accept="image/*"
                    multiple
                    style={{ display: "none" }}
                    onChange={onArquivosSelecionados} />
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={enviandoFoto}
                      style={{ background: "transparent", border: "none",
                               color: C.accent, fontSize: 11, cursor: "pointer",
                               fontFamily: "inherit", padding: 0,
                               opacity: enviandoFoto ? 0.5 : 1 }}>
                      {enviandoFoto ? "Processando..." : "📷 Câmera"}
                    </button>
                    <button
                      onClick={() => galeriaInputRef.current?.click()}
                      disabled={enviandoFoto}
                      style={{ background: "transparent", border: "none",
                               color: C.accent, fontSize: 11, cursor: "pointer",
                               fontFamily: "inherit", padding: 0,
                               opacity: enviandoFoto ? 0.5 : 1 }}>
                      🖼 Galeria
                    </button>
                  </div>
                </>
              )
            }>
            {(nc.anexos || []).length === 0 ? (
              <div style={{ fontSize: 11, color: C.muted }}>
                Nenhuma foto anexada.
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(nc.anexos || []).map(a => (
                  <div key={a.id} style={{ position: "relative" }}>
                    <img src={a.url} alt={a.nome_arquivo}
                      onClick={() => setFotoAberta(a)}
                      style={{ width: 100, height: 100, objectFit: "cover",
                               borderRadius: 6, cursor: "pointer",
                               border: `1px solid ${C.border}` }} />
                    {!encerrada && (
                      <button onClick={() => removerAnexo(a)}
                        title="Remover"
                        style={{ position: "absolute", top: -6, right: -6,
                                 width: 20, height: 20, borderRadius: "50%",
                                 background: "#ef4444", color: "white",
                                 border: "none", cursor: "pointer",
                                 fontSize: 12, lineHeight: 1, padding: 0 }}>
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Secao>

          {/* ── Plano de ação ── */}
          <Secao
            titulo={`PLANO DE AÇÃO (${(nc.plano_acao || []).length})`}
            C={C}
            extra={
              !encerrada && !novoPlano && (
                <button onClick={() => setNovoPlano({ acao: "", responsavel_nome: "", prazo: "" })}
                  style={{ background: "transparent", border: "none",
                           color: C.accent, fontSize: 11, cursor: "pointer",
                           fontFamily: "inherit", padding: 0 }}>
                  + Adicionar ação
                </button>
              )
            }>
            {(nc.plano_acao || []).length === 0 && !novoPlano && (
              <div style={{ fontSize: 11, color: C.muted }}>
                Nenhuma ação cadastrada. Adicione uma ação corretiva quando necessário.
              </div>
            )}

            {(nc.plano_acao || []).map(p => {
              const atrasado = p.status !== "concluida" && p.prazo && new Date(p.prazo) < new Date();
              return (
                <div key={p.id} style={{
                  background: C.surface, border: `1px solid ${atrasado ? "#ef4444" : C.border}`,
                  borderRadius: 6, padding: "10px 12px", marginBottom: 6,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between",
                                alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 12, color: C.text, flex: 1,
                                  textDecoration: p.status === "concluida" ? "line-through" : "none",
                                  opacity: p.status === "concluida" ? 0.6 : 1 }}>
                      {p.acao}
                    </div>
                    {!encerrada && (
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {p.status !== "concluida" && (
                          <button onClick={() => atualizarPlano(p.id, { status: "concluida" })}
                            disabled={salvando}
                            style={{ background: "transparent", border: "none",
                                     color: C.success, fontSize: 10,
                                     cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                            ✓ Concluir
                          </button>
                        )}
                        <button onClick={() => removerPlano(p.id)} disabled={salvando}
                          style={{ background: "transparent", border: "none",
                                   color: "#ef4444", fontSize: 10,
                                   cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                          Remover
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 10, color: C.muted,
                                flexWrap: "wrap" }}>
                    {p.responsavel_nome && <span>👤 {p.responsavel_nome}</span>}
                    <span style={{ color: atrasado ? "#ef4444" : C.muted }}>
                      📅 {new Date(p.prazo + "T00:00:00").toLocaleDateString("pt-BR")}
                      {atrasado && " · ATRASADO"}
                    </span>
                    <span style={{
                      color: p.status === "concluida" ? C.success : C.muted,
                      fontWeight: 600,
                    }}>
                      {p.status === "concluida" ? "✓ Concluída" : "○ " + p.status}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Form novo plano */}
            {novoPlano && (
              <div style={{ background: C.bg, border: `1px solid ${C.border}`,
                            borderRadius: 6, padding: "12px 14px", marginTop: 8 }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ ...s.label, fontSize: 10 }}>AÇÃO *</label>
                  <input type="text" value={novoPlano.acao}
                    onChange={e => setNovoPlano(p => ({ ...p, acao: e.target.value }))}
                    placeholder="Ex: Revisar procedimento de inspeção"
                    autoFocus
                    style={{ ...s.input, fontSize: 12 }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
                              gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={{ ...s.label, fontSize: 10 }}>RESPONSÁVEL</label>
                    <input type="text" value={novoPlano.responsavel_nome}
                      onChange={e => setNovoPlano(p => ({ ...p, responsavel_nome: e.target.value }))}
                      placeholder="Nome"
                      style={{ ...s.input, fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ ...s.label, fontSize: 10 }}>PRAZO *</label>
                    <input type="date" value={novoPlano.prazo}
                      onChange={e => setNovoPlano(p => ({ ...p, prazo: e.target.value }))}
                      style={{ ...s.input, fontSize: 12 }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setNovoPlano(null)} disabled={salvando}
                    style={{ ...s.btn(false), padding: "6px 12px", fontSize: 11 }}>
                    Cancelar
                  </button>
                  <button onClick={adicionarPlano} disabled={salvando}
                    style={{ ...s.btn(true), padding: "6px 12px", fontSize: 11 }}>
                    {salvando ? "Salvando..." : "Adicionar"}
                  </button>
                </div>
              </div>
            )}
          </Secao>

          {/* ── Timeline colapsável ── */}
          <Secao
            titulo={`HISTÓRICO (${(nc.eventos || []).length})`}
            C={C}
            extra={
              <button
                onClick={() => setHistoricoExpandido(!historicoExpandido)}
                style={{ background: "transparent", border: "none",
                         color: C.accent, fontSize: 11, cursor: "pointer",
                         fontFamily: "inherit", padding: 0 }}>
                {historicoExpandido ? "▼ Recolher" : "▶ Expandir"}
              </button>
            }>
            {historicoExpandido && (
              <>
                {(nc.eventos || []).length === 0 ? (
                  <div style={{ fontSize: 11, color: C.muted }}>Nenhum evento.</div>
                ) : (
                  <div style={{ position: "relative" }}>
                    {(nc.eventos || []).map((ev, i) => {
                      const cfg = EVENTO_CFG[ev.tipo] || { icon: "•", c: C.muted };
                      return (
                        <div key={ev.id} style={{ display: "flex", gap: 10,
                                                  padding: "8px 0",
                                                  borderBottom: i < nc.eventos.length - 1
                                                    ? `1px solid ${C.border}22`
                                                    : "none" }}>
                          <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1,
                                         color: cfg.c }}>
                            {cfg.icon}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, color: C.text }}>
                              {ev.descricao}
                            </div>
                            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                              {ev.criado_por_nome || "—"} · {fmtDataHora(ev.criado_em)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Comentário livre */}
                {!encerrada && (
                  <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <input type="text" value={comentario}
                      onChange={e => setComentario(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") enviarComentario(); }}
                      placeholder="Adicionar comentário..."
                      style={{ ...s.input, flex: 1, fontSize: 12 }} />
                    <button onClick={enviarComentario}
                      disabled={!comentario.trim() || salvando}
                      style={{ ...s.btn(true), padding: "6px 14px", fontSize: 11,
                               opacity: (!comentario.trim() || salvando) ? 0.5 : 1 }}>
                      Enviar
                    </button>
                  </div>
                )}
              </>
            )}
          </Secao>
        </div>

        {/* ── Rodapé com ações do fluxo ISO 9001 ── */}
        {!encerrada && (
          <div style={{ padding: "14px 22px", borderTop: `1px solid ${C.border}`,
                        display: "flex", gap: 10, flexWrap: "wrap",
                        alignItems: "center", justifyContent: "flex-end" }}>
            {/* M4.1: notificar fornecedor (fluxo de aprovação).
                Só aparece quando:
                  • NC tem fornecedor vinculado
                  • Ainda não foi notificado (status 'nao_notificado')
                  • Usuário é gestor/admin/comprador
                O backend reforça a permissão. */}
            {nc.fornecedor_id
              && nc.fornecedor_tratativa_status === "nao_enviado"
              && ["gestor", "admin", "comprador"].includes(perfilUsuario) && (
              <>
                <button
                  onClick={async () => {
                    if (!window.confirm(
                      `Marcar esta NC como INTERNA?\n\n` +
                      `O fornecedor ${nc.fornecedor_nome || '—'} perde acesso ` +
                      `(se ainda não tiver visto, nem vai ver) e a NC segue o ` +
                      `fluxo interno normal.`
                    )) return;
                    const motivo = window.prompt("Motivo (opcional):");
                    if (motivo === null) return;
                    setSalvando(true);
                    try {
                      await apiService.post(`/nao-conformidades/${ncId}/marcar-interna`, {
                        motivo: motivo?.trim() || null,
                      });
                      await carregar();
                      onAtualizar?.();
                    } catch (e) {
                      setErro(e.message || "Erro ao marcar como interna");
                    } finally {
                      setSalvando(false);
                    }
                  }}
                  disabled={salvando}
                  style={{
                    ...s.btn(false, C.muted),
                    padding: "8px 16px", fontSize: 12,
                  }}
                  title="NC não é responsabilidade do fornecedor — mantém no fluxo interno"
                >
                  🏭 Marcar como interna
                </button>
                <button
                  onClick={abrirConfirmacaoEnvio}
                  disabled={salvando}
                  style={{
                    ...s.btn(true, "#10b981"),
                    padding: "8px 16px", fontSize: 12,
                    background: "#10b981", border: "1px solid #10b981",
                    opacity: salvando ? 0.5 : 1,
                  }}
                  title={`Enviar email para ${nc.fornecedor_nome || "fornecedor"}`}
                >
                  {salvando ? "⏳ Enviando email..." : "📤 Notificar fornecedor"}
                </button>
              </>
            )}

            {/* M4.2: ações do comprador quando o fornecedor já respondeu. */}
            {nc.fornecedor_tratativa_status === 'resolvida_fornecedor' && (
              <>
                <button
                  onClick={async () => {
                    const obs = window.prompt("Observação (opcional):");
                    if (obs === null) return;
                    setSalvando(true);
                    try {
                      await apiService.post(`/nao-conformidades/${ncId}/validar-resolucao-fornecedor`, {
                        observacao: obs?.trim() || null,
                      });
                      await carregar();
                      onAtualizar?.();
                    } catch (e) {
                      setErro(e.message || "Erro ao validar");
                    } finally {
                      setSalvando(false);
                    }
                  }}
                  disabled={salvando}
                  style={{ ...s.btn(true, "#a855f7"), padding: "8px 16px", fontSize: 12,
                           background: "#a855f7", border: "1px solid #a855f7" }}
                >
                  🎯 Validar resolução
                </button>
                <button
                  onClick={async () => {
                    const motivo = window.prompt("Motivo da devolução (obrigatório):");
                    if (motivo === null) return;
                    if (!motivo.trim()) { alert("Motivo é obrigatório."); return; }
                    setSalvando(true);
                    try {
                      await apiService.post(`/nao-conformidades/${ncId}/devolver-fornecedor`, {
                        motivo: motivo.trim(),
                      });
                      await carregar();
                      onAtualizar?.();
                    } catch (e) {
                      setErro(e.message || "Erro ao devolver");
                    } finally {
                      setSalvando(false);
                    }
                  }}
                  disabled={salvando}
                  style={{ ...s.btn(true, "#f59e0b"), padding: "8px 16px", fontSize: 12,
                           background: "#f59e0b", border: "1px solid #f59e0b" }}
                >
                  🔄 Devolver ao fornecedor
                </button>
              </>
            )}

            {nc.fornecedor_tratativa_status === 'contestada' && (
              <>
                <button
                  onClick={async () => {
                    const obs = window.prompt("Motivo (opcional):");
                    if (obs === null) return;
                    if (!window.confirm("Aceitar a contestação e CANCELAR a NC?\n\nEssa ação encerra a NC.")) return;
                    setSalvando(true);
                    try {
                      await apiService.post(`/nao-conformidades/${ncId}/aceitar-contestacao`, {
                        observacao: obs?.trim() || null,
                      });
                      await carregar();
                      onAtualizar?.();
                    } catch (e) {
                      setErro(e.message || "Erro ao aceitar");
                    } finally {
                      setSalvando(false);
                    }
                  }}
                  disabled={salvando}
                  style={{ ...s.btn(true, "#10b981"), padding: "8px 16px", fontSize: 12,
                           background: "#10b981", border: "1px solid #10b981" }}
                >
                  ✅ Aceitar contestação (cancelar NC)
                </button>
                <button
                  onClick={async () => {
                    const obs = window.prompt("Justificativa obrigatória:");
                    if (!obs || !obs.trim()) {
                      if (obs !== null) alert("Justificativa é obrigatória.");
                      return;
                    }
                    setSalvando(true);
                    try {
                      await apiService.post(`/nao-conformidades/${ncId}/rejeitar-contestacao`, {
                        observacao: obs.trim(),
                      });
                      await carregar();
                      onAtualizar?.();
                    } catch (e) {
                      setErro(e.message || "Erro ao rejeitar");
                    } finally {
                      setSalvando(false);
                    }
                  }}
                  disabled={salvando}
                  style={{ ...s.btn(true, "#ef4444"), padding: "8px 16px", fontSize: 12,
                           background: "#ef4444", border: "1px solid #ef4444" }}
                >
                  ❌ Rejeitar contestação
                </button>
                <button
                  onClick={async () => {
                    const motivo = window.prompt("Motivo da devolução (obrigatório):");
                    if (motivo === null) return;
                    if (!motivo.trim()) { alert("Motivo é obrigatório."); return; }
                    setSalvando(true);
                    try {
                      await apiService.post(`/nao-conformidades/${ncId}/devolver-fornecedor`, {
                        motivo: motivo.trim(),
                      });
                      await carregar();
                      onAtualizar?.();
                    } catch (e) {
                      setErro(e.message || "Erro ao devolver");
                    } finally {
                      setSalvando(false);
                    }
                  }}
                  disabled={salvando}
                  style={{ ...s.btn(true, "#f59e0b"), padding: "8px 16px", fontSize: 12,
                           background: "#f59e0b", border: "1px solid #f59e0b" }}
                >
                  🔄 Devolver ao fornecedor
                </button>
              </>
            )}

            {podeTransferir && (
              <button onClick={() => setTransferindo({
                  responsavel_id: "",
                  responsavel_nome: "",
                  observacao: "",
                })}
                disabled={salvando}
                style={{ ...s.btn(false), padding: "8px 16px", fontSize: 12,
                         borderColor: "#a855f7", color: "#a855f7" }}>
                ↪️ Transferir
              </button>
            )}
            {podeCancelar && (
              <button onClick={cancelarNC} disabled={salvando}
                style={{ ...s.btn(false), padding: "8px 16px", fontSize: 12,
                         borderColor: "#ef4444", color: "#ef4444" }}>
                ⚫ Cancelar NC
              </button>
            )}

            {/* [1] → [2]: Qualidade direciona */}
            {podeDirecionar && (
              <button onClick={() => setDirecionando({
                  area_responsavel: "",
                  responsavel_id: "",
                  responsavel_nome: "",
                  observacao: "",
                })}
                disabled={salvando}
                style={{ ...s.btn(true), padding: "8px 16px", fontSize: 12,
                         background: "#60a5fa", border: "1px solid #60a5fa" }}>
                🎯 Direcionar para área
              </button>
            )}

            {/* [2] → [3]: Responsável registra disposição */}
            {podeRegistrarDisp && (
              <button onClick={() => setRegistrandoDisposicao({
                  disposicao: "",
                  acao_corretiva: "",
                  executante_id: "",
                  executante_nome: "",
                  area_responsavel: nc.area_responsavel || "",
                  mostrarTodosExecutantes: false,
                })}
                disabled={salvando}
                style={{ ...s.btn(true), padding: "8px 16px", fontSize: 12,
                         background: "#a855f7", border: "1px solid #a855f7" }}>
                ⚙️ Registrar disposição
              </button>
            )}

            {/* [3] → [4]: Executante devolve pra validação */}
            {podeDevolverValidacao && (
              <button onClick={() => setDevolvendoValidacao({ observacao: "" })}
                disabled={salvando}
                style={{ ...s.btn(true), padding: "8px 16px", fontSize: 12,
                         background: "#f59e0b", border: "1px solid #f59e0b" }}>
                ↩️ Devolver para validação
              </button>
            )}

            {/* [4] → [5]: Qualidade encerra */}
            {podeEncerrar && (
              <button onClick={() => setEncerrando({
                  causa_raiz: "",
                  cinco_porques: ["", "", "", "", ""],
                  observacao: "",
                })}
                disabled={salvando}
                style={{ ...s.btn(true), padding: "8px 16px", fontSize: 12,
                         background: C.success, border: `1px solid ${C.success}` }}>
                🏁 Encerrar NC
              </button>
            )}
          </div>
        )}

        {/* Mini-modal: direcionar (fluxo ISO 9001) */}
        {direcionando && (
          <div style={{ position: "absolute", inset: 0, background: "#00000090",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        zIndex: 10, padding: 20 }}>
            <div style={{ ...s.card, width: 500, maxWidth: "100%" }}>
              <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                  🎯 Direcionar NC para área
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {nc.numero_nc}
                </div>
              </div>
              <div style={{ padding: "18px 22px" }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
                  Qualidade revisa e encaminha a NC pra uma área responsável
                  pela tratativa.
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={s.label}>ÁREA RESPONSÁVEL *</label>
                  <select value={direcionando.area_responsavel}
                    onChange={e => setDirecionando(d => ({ ...d, area_responsavel: e.target.value }))}
                    style={{ ...s.input, appearance: "none" }}>
                    <option value="">Selecione a área...</option>
                    <option value="qualidade">🏅 Qualidade</option>
                    <option value="engenharia">🔬 Engenharia</option>
                    <option value="suprimentos">📦 Suprimentos</option>
                    <option value="producao">🏭 Produção</option>
                    <option value="manutencao">🔧 Manutenção</option>
                  </select>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={s.label}>RESPONSÁVEL (opcional)</label>
                  <select value={direcionando.responsavel_id}
                    onChange={e => {
                      const id = e.target.value;
                      const u = usuariosElegiveis.find(x => String(x.id) === String(id));
                      setDirecionando(d => ({
                        ...d,
                        responsavel_id: id,
                        responsavel_nome: u?.nome || "",
                      }));
                    }}
                    style={{ ...s.input, appearance: "none" }}>
                    <option value="">— Deixar em aberto pra área assumir —</option>
                    {usuariosElegiveis.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.nome} · {u.perfil}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={s.label}>OBSERVAÇÃO</label>
                  <textarea value={direcionando.observacao}
                    onChange={e => setDirecionando(d => ({ ...d, observacao: e.target.value }))}
                    placeholder="Ex: envolve análise dimensional, não é falha de uso"
                    style={{ ...s.input, minHeight: 60, resize: "vertical" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, padding: "14px 22px",
                            borderTop: `1px solid ${C.border}` }}>
                <button onClick={() => setDirecionando(null)} disabled={salvando}
                  style={{ ...s.btn(false), flex: 1, padding: "8px 16px" }}>
                  Cancelar
                </button>
                <button onClick={direcionarNC}
                  disabled={salvando || !direcionando.area_responsavel}
                  style={{ ...s.btn(true), flex: 1, padding: "8px 16px",
                           background: "#60a5fa", border: "1px solid #60a5fa",
                           opacity: (salvando || !direcionando.area_responsavel) ? 0.5 : 1 }}>
                  {salvando ? "Direcionando..." : "Confirmar direcionamento"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mini-modal: registrar disposição */}
        {registrandoDisposicao && (() => {
          const areaSugerida = AREA_POR_DISPOSICAO[registrandoDisposicao.disposicao] || null;
          const perfisArea = PERFIS_POR_AREA[registrandoDisposicao.area_responsavel] || [];
          const porArea = usuariosElegiveis.filter(u => perfisArea.includes(u.perfil));

          // Se o filtro por área não retorna ninguém (ex: não há comprador
          // cadastrado), cai automaticamente pra lista completa — não deixa
          // o usuário travado sem ninguém pra escolher.
          const mostrarTodos = registrandoDisposicao.mostrarTodosExecutantes
            || porArea.length === 0;

          const executantesFiltrados = mostrarTodos
            ? usuariosElegiveis
            : porArea;

          const filtroVazioPorArea = porArea.length === 0 && !registrandoDisposicao.mostrarTodosExecutantes;

          return (
          <div style={{ position: "absolute", inset: 0, background: "#00000090",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        zIndex: 10, padding: 20 }}>
            <div style={{ ...s.card, width: 520, maxWidth: "100%" }}>
              <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                  ⚙️ Registrar disposição
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {nc.numero_nc} · área atual: {nc.area_responsavel || "—"}
                </div>
              </div>
              <div style={{ padding: "18px 22px" }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
                  Defina o destino da NC, quem vai executar e qual área fica
                  responsável pela tratativa.
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={s.label}>DISPOSIÇÃO *</label>
                  <select value={registrandoDisposicao.disposicao}
                    onChange={e => {
                      const novaDisp = e.target.value;
                      // Pré-seleciona a área sugerida quando a disposição muda
                      const areaAuto = AREA_POR_DISPOSICAO[novaDisp] || registrandoDisposicao.area_responsavel;
                      setRegistrandoDisposicao(d => ({
                        ...d,
                        disposicao: novaDisp,
                        area_responsavel: areaAuto || d.area_responsavel,
                        // Limpa executante se ele não pertence à nova área
                        executante_id: "",
                        executante_nome: "",
                        mostrarTodosExecutantes: false,
                      }));
                    }}
                    style={{ ...s.input, appearance: "none" }}>
                    <option value="">Selecione...</option>
                    <option value="devolucao">↩️ Devolução ao fornecedor</option>
                    <option value="retrabalho">🔧 Retrabalho interno</option>
                    <option value="descarte">🗑 Descarte (refugo)</option>
                    <option value="uso_como_esta">✔️ Uso como está (concessão)</option>
                  </select>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={s.label}>
                    ÁREA RESPONSÁVEL *
                    {areaSugerida && registrandoDisposicao.area_responsavel === areaSugerida && (
                      <span style={{ color: C.accent, fontWeight: 400, marginLeft: 6, fontSize: 10 }}>
                        ✨ sugerida
                      </span>
                    )}
                  </label>
                  <select value={registrandoDisposicao.area_responsavel}
                    onChange={e => setRegistrandoDisposicao(d => ({
                      ...d,
                      area_responsavel: e.target.value,
                      executante_id: "",
                      executante_nome: "",
                      mostrarTodosExecutantes: false,
                    }))}
                    style={{ ...s.input, appearance: "none" }}>
                    <option value="">Selecione a área...</option>
                    <option value="qualidade">🏅 Qualidade</option>
                    <option value="engenharia">🔬 Engenharia</option>
                    <option value="suprimentos">📦 Suprimentos</option>
                    <option value="producao">🏭 Produção</option>
                    <option value="manutencao">🔧 Manutenção</option>
                  </select>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={s.label}>AÇÃO CORRETIVA *</label>
                  <textarea value={registrandoDisposicao.acao_corretiva}
                    onChange={e => setRegistrandoDisposicao(d => ({ ...d, acao_corretiva: e.target.value }))}
                    placeholder="Ex: Devolver lote ao fornecedor e solicitar reposição imediata"
                    style={{ ...s.input, minHeight: 70, resize: "vertical" }} />
                </div>

                <div>
                  <label style={s.label}>EXECUTANTE *</label>
                  <select value={registrandoDisposicao.executante_id}
                    onChange={e => {
                      const id = e.target.value;
                      const u = usuariosElegiveis.find(x => String(x.id) === String(id));
                      setRegistrandoDisposicao(d => ({
                        ...d,
                        executante_id: id,
                        executante_nome: u?.nome || "",
                      }));
                    }}
                    style={{ ...s.input, appearance: "none" }}>
                    <option value="">Quem vai executar a ação?</option>
                    {executantesFiltrados.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.nome} · {u.perfil}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 4,
                                display: "flex", justifyContent: "space-between",
                                alignItems: "center", gap: 8 }}>
                    <span>
                      {filtroVazioPorArea
                        ? `Nenhum usuário cadastrado como ${perfisArea.join("/")}. Mostrando todos.`
                        : registrandoDisposicao.mostrarTodosExecutantes
                          ? `Mostrando todos (${usuariosElegiveis.length}).`
                          : `Filtrado por área (${registrandoDisposicao.area_responsavel || "—"}) · ${porArea.length} disponível(is).`}
                    </span>
                    <button onClick={() => setRegistrandoDisposicao(d => ({
                        ...d,
                        mostrarTodosExecutantes: !d.mostrarTodosExecutantes,
                        executante_id: "",
                        executante_nome: "",
                      }))}
                      style={{ background: "transparent", border: "none",
                               color: C.accent, fontSize: 10, cursor: "pointer",
                               fontFamily: "inherit", padding: 0,
                               textDecoration: "underline",
                               // Em fail-open (área vazia), o link "Filtrar
                               // por área" fica desabilitado — filtrar por
                               // área sem ninguém nela resultaria em lista
                               // vazia, o que confunde mais que ajuda.
                               opacity: (filtroVazioPorArea && registrandoDisposicao.mostrarTodosExecutantes) ? 0.4 : 1,
                               cursor: (filtroVazioPorArea && registrandoDisposicao.mostrarTodosExecutantes) ? "not-allowed" : "pointer" }}>
                      {registrandoDisposicao.mostrarTodosExecutantes ? "Filtrar por área" : "Ver todos"}
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, padding: "14px 22px",
                            borderTop: `1px solid ${C.border}` }}>
                <button onClick={() => setRegistrandoDisposicao(null)} disabled={salvando}
                  style={{ ...s.btn(false), flex: 1, padding: "8px 16px" }}>
                  Cancelar
                </button>
                <button onClick={registrarDisposicao}
                  disabled={salvando || !registrandoDisposicao.disposicao
                            || !registrandoDisposicao.acao_corretiva?.trim()
                            || !registrandoDisposicao.executante_id
                            || !registrandoDisposicao.area_responsavel}
                  style={{ ...s.btn(true), flex: 1, padding: "8px 16px",
                           background: "#a855f7", border: "1px solid #a855f7",
                           opacity: (salvando || !registrandoDisposicao.disposicao
                                     || !registrandoDisposicao.acao_corretiva?.trim()
                                     || !registrandoDisposicao.executante_id
                                     || !registrandoDisposicao.area_responsavel) ? 0.5 : 1 }}>
                  {salvando ? "Salvando..." : "Enviar para execução"}
                </button>
              </div>
            </div>
          </div>
          );
        })()}

        {/* Mini-modal: devolver para validação */}
        {devolvendoValidacao && (
          <div style={{ position: "absolute", inset: 0, background: "#00000090",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        zIndex: 10, padding: 20 }}>
            <div style={{ ...s.card, width: 460, maxWidth: "100%" }}>
              <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                  ↩️ Devolver para validação
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {nc.numero_nc}
                </div>
              </div>
              <div style={{ padding: "18px 22px" }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
                  A ação foi executada. A NC volta pra qualidade validar e
                  registrar a causa raiz.
                </div>

                <div style={{ background: C.bg, borderRadius: 6,
                              padding: "10px 12px", marginBottom: 14, fontSize: 11 }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>
                    AÇÃO EXECUTADA
                  </div>
                  <div style={{ color: C.text }}>{nc.acao_corretiva}</div>
                </div>

                <div>
                  <label style={s.label}>OBSERVAÇÃO (o que foi feito na prática)</label>
                  <textarea value={devolvendoValidacao.observacao}
                    onChange={e => setDevolvendoValidacao(d => ({ ...d, observacao: e.target.value }))}
                    placeholder="Ex: Lote devolvido ao fornecedor em 15/09, protocolo #1234"
                    style={{ ...s.input, minHeight: 70, resize: "vertical" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, padding: "14px 22px",
                            borderTop: `1px solid ${C.border}` }}>
                <button onClick={() => setDevolvendoValidacao(null)} disabled={salvando}
                  style={{ ...s.btn(false), flex: 1, padding: "8px 16px" }}>
                  Cancelar
                </button>
                <button onClick={devolverValidacao}
                  disabled={salvando}
                  style={{ ...s.btn(true), flex: 1, padding: "8px 16px",
                           background: "#f59e0b", border: "1px solid #f59e0b",
                           opacity: salvando ? 0.5 : 1 }}>
                  {salvando ? "Devolvendo..." : "Confirmar devolução"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mini-modal: encerrar com causa raiz */}
        {encerrando && (
          <div style={{ position: "absolute", inset: 0, background: "#00000090",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        zIndex: 10, padding: 20 }}>
            <div style={{ ...s.card, width: 620, maxWidth: "100%",
                          maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                  🏁 Encerrar NC
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {nc.numero_nc} · validação final pela qualidade
                </div>
              </div>
              <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
                  Análise final. A causa raiz é obrigatória. Os 5 porquês são
                  opcionais, mas recomendados pra investigação madura.
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={s.label}>CAUSA RAIZ *</label>
                  <textarea value={encerrando.causa_raiz}
                    onChange={e => setEncerrando(d => ({ ...d, causa_raiz: e.target.value }))}
                    placeholder="Ex: Fornecedor entregou lote sem controle dimensional adequado"
                    autoFocus
                    style={{ ...s.input, minHeight: 80, resize: "vertical" }} />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={s.label}>ANÁLISE DOS 5 PORQUÊS (opcional)</label>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 8 }}>
                    Comece pelo problema visível e vá aprofundando. Deixe em
                    branco os que não souber.
                  </div>
                  {(encerrando.cinco_porques || []).map((p, i) => (
                    <div key={i} style={{ display: "flex", gap: 8,
                                          alignItems: "center", marginBottom: 6 }}>
                      <span style={{
                        fontSize: 11, color: "#a855f7", fontWeight: 700,
                        fontFamily: "'IBM Plex Mono',monospace",
                        width: 28, flexShrink: 0,
                      }}>
                        {i + 1}º
                      </span>
                      <input type="text" value={p}
                        onChange={e => {
                          const novos = [...encerrando.cinco_porques];
                          novos[i] = e.target.value;
                          setEncerrando(d => ({ ...d, cinco_porques: novos }));
                        }}
                        placeholder={i === 0 ? "Por que o problema aconteceu?" : "Por que disso?"}
                        style={{ ...s.input, flex: 1, fontSize: 12 }} />
                    </div>
                  ))}
                </div>

                <div>
                  <label style={s.label}>OBSERVAÇÃO FINAL (opcional)</label>
                  <textarea value={encerrando.observacao}
                    onChange={e => setEncerrando(d => ({ ...d, observacao: e.target.value }))}
                    placeholder="Ex: Ação corretiva implementada no fornecedor"
                    style={{ ...s.input, minHeight: 60, resize: "vertical" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, padding: "14px 22px",
                            borderTop: `1px solid ${C.border}` }}>
                <button onClick={() => setEncerrando(null)} disabled={salvando}
                  style={{ ...s.btn(false), flex: 1, padding: "8px 16px" }}>
                  Cancelar
                </button>
                <button onClick={encerrarNC}
                  disabled={salvando || !encerrando.causa_raiz?.trim()}
                  style={{ ...s.btn(true), flex: 1, padding: "8px 16px",
                           background: C.success, border: `1px solid ${C.success}`,
                           opacity: (salvando || !encerrando.causa_raiz?.trim()) ? 0.5 : 1 }}>
                  {salvando ? "Encerrando..." : "Confirmar encerramento"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mini-modal: transferir */}
        {transferindo && (
          <div style={{ position: "absolute", inset: 0, background: "#00000090",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        zIndex: 10, padding: 20 }}>
            <div style={{ ...s.card, width: 480, maxWidth: "100%" }}>
              <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                  ↪️ Transferir NC
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {nc.numero_nc}
                  {nc.responsavel_nome && ` · atualmente com ${nc.responsavel_nome}`}
                </div>
              </div>
              <div style={{ padding: "18px 22px" }}>
                <div style={{ marginBottom: 14 }}>
                  <label style={s.label}>NOVO RESPONSÁVEL</label>
                  <select
                    value={transferindo.responsavel_id}
                    onChange={e => {
                      const id = e.target.value;
                      const u = usuariosElegiveis.find(x => String(x.id) === String(id));
                      setTransferindo(t => ({
                        ...t,
                        responsavel_id: id,
                        responsavel_nome: u?.nome || "",
                      }));
                    }}
                    style={{ ...s.input, appearance: "none" }}>
                    <option value="">— Devolver para a fila (sem responsável) —</option>
                    {usuariosElegiveis
                      .filter(u => String(u.id) !== String(nc.responsavel_id))
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.nome} · {u.perfil}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label style={s.label}>OBSERVAÇÃO</label>
                  <textarea
                    value={transferindo.observacao}
                    onChange={e => setTransferindo(t => ({ ...t, observacao: e.target.value }))}
                    placeholder={transferindo.responsavel_id
                      ? "Ex: passando para o João porque envolve a parte elétrica"
                      : "Ex: retirando da fila — resolvido por telefone com o fornecedor"}
                    style={{ ...s.input, minHeight: 70, resize: "vertical" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, padding: "14px 22px",
                            borderTop: `1px solid ${C.border}` }}>
                <button onClick={() => setTransferindo(null)} disabled={salvando}
                  style={{ ...s.btn(false), flex: 1, padding: "8px 16px" }}>
                  Cancelar
                </button>
                <button onClick={transferirNC}
                  disabled={salvando}
                  style={{ ...s.btn(true), flex: 1, padding: "8px 16px",
                           background: "#a855f7", border: "1px solid #a855f7",
                           opacity: salvando ? 0.5 : 1 }}>
                  {salvando ? "Transferindo..." : transferindo.responsavel_id ? "Confirmar transferência" : "Devolver para a fila"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* M4.3-j: confirmação antes de disparar email ao fornecedor. */}
        {confirmandoEnvio && (
          <div onClick={() => setConfirmandoEnvio(false)}
               style={{ position: "fixed", inset: 0, background: "#000000bb",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        zIndex: 400, padding: 20 }}>
            <div onClick={e => e.stopPropagation()}
                 style={{ ...s.card, width: 460, maxWidth: "100%", padding: 22 }}>

              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 12 }}>
                📤 Confirmar envio de email?
              </div>

              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, marginBottom: 16 }}>
                Você está prestes a notificar o fornecedor sobre esta NC. O email
                será enviado e o fornecedor passará a ver a NC no portal.
              </div>

              <div style={{ background: C.bg, border: `1px solid ${C.border}55`,
                            borderRadius: 8, padding: "12px 14px", marginBottom: 16,
                            fontSize: 12, fontFamily: "'IBM Plex Mono', monospace",
                            display: "flex", flexDirection: "column", gap: 6 }}>
                <div><span style={{ color: C.muted }}>NC:</span> <span style={{ color: C.accent }}>{nc.numero_nc}</span></div>
                <div><span style={{ color: C.muted }}>Fornecedor:</span> <span style={{ color: C.text }}>{nc.fornecedor_nome || "—"}</span></div>
                <div><span style={{ color: C.muted }}>Email:</span> <span style={{ color: C.text }}>{nc.fornecedor_email || "não cadastrado"}</span></div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={() => setConfirmandoEnvio(false)}
                        style={{ ...s.btn(false, C.muted), padding: "8px 16px", fontSize: 12 }}>
                  Cancelar
                </button>
                <button onClick={confirmarEnvio}
                        disabled={salvando}
                        style={{ ...s.btn(true, "#10b981"), padding: "8px 16px", fontSize: 12,
                                 background: "#10b981", border: "1px solid #10b981",
                                 opacity: salvando ? 0.5 : 1 }}>
                  ✅ Confirmar envio
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lightbox */}
        {fotoAberta && (
          <div onClick={() => setFotoAberta(null)}
            style={{ position: "fixed", inset: 0, background: "#000000ee",
                     display: "flex", alignItems: "center", justifyContent: "center",
                     zIndex: 20, cursor: "zoom-out", padding: 30 }}>
            <img src={fotoAberta.url} alt={fotoAberta.nome_arquivo}
              style={{ maxWidth: "95%", maxHeight: "95%",
                       borderRadius: 8 }} />
            <div style={{ position: "absolute", bottom: 20, color: "white",
                          fontSize: 11, opacity: 0.7 }}>
              {fotoAberta.nome_arquivo} · clique para fechar
            </div>
          </div>
        )}
      </div>
    </Overlay>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTES
// ─────────────────────────────────────────────────────────────────────────
function Overlay({ children, onFechar, C }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090",
                  display: "flex", alignItems: "center",
                  justifyContent: "center", zIndex: 380, padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div style={{ position: "relative", maxWidth: "100%" }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Secao({ titulo, children, extra, C }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between",
                    alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em",
                      fontWeight: 600 }}>
          {titulo}
        </div>
        {extra}
      </div>
      {children}
    </div>
  );
}