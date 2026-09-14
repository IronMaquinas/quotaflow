// frontend/src/components/estoque/modais/ModalApontamento.jsx
//
// Modal de apontamento de execução — v2 com lançamento em lote.
//
// Fluxo:
//   - Lista de sessões já lançadas
//   - "+ Nova sessão" → form que aceita N sessões (uma por dia)
//   - Modo "Janela contígua": Informa início+fim → sistema calcula
//   - Modo "Horas direto": informa as 5 categorias, sem início/fim
//   - Salvar = loop POST por linha
//
// Validação de multi-dia: cada linha é um dia só. O técnico usa
// "+ Adicionar outro dia" pra lançar 5 dias de uma vez.

import { useState, useEffect, useRef, useCallback } from "react";
import apiService from "../../../services/apiService";

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────
function fmtData(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR") + " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtHorasSessao(sessao) {
  const partes = [];
  if (sessao.horas_normais_diurnas > 0) partes.push(`${sessao.horas_normais_diurnas}h diurnas`);
  if (sessao.horas_normais_noturnas > 0) partes.push(`${sessao.horas_normais_noturnas}h noturnas`);
  if (sessao.horas_excepcionais > 0) partes.push(`${sessao.horas_excepcionais}h excepcionais`);
  if (sessao.horas_extras_diurnas > 0) partes.push(`${sessao.horas_extras_diurnas}h extra diurna`);
  if (sessao.horas_extras_noturnas > 0) partes.push(`${sessao.horas_extras_noturnas}h extra noturna`);
  return partes.join(" · ") || "—";
}

function calcularTotalSessao(s) {
  return (parseFloat(s.horas_normais_diurnas) || 0)
    + (parseFloat(s.horas_normais_noturnas) || 0)
    + (parseFloat(s.horas_excepcionais) || 0)
    + (parseFloat(s.horas_extras_diurnas) || 0)
    + (parseFloat(s.horas_extras_noturnas) || 0);
}

function hojeInputDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function novaLinha(pessoasPadrao = 1) {
  return {
    _id: Date.now() + Math.random(),
    data: hojeInputDate(),
    pessoas_reais: pessoasPadrao,
    inicio: "08:00",
    fim: "18:00",
    hD: "", hN: "", hE: "", hXD: "", hXN: "",
    preview: null,
    calculando: false,
    erroLinha: null,
  };
}

// Converte data + "HH:MM" para ISO compatível com o backend
function juntarDataHora(dataStr, horaStr) {
  if (!dataStr || !horaStr) return null;
  return `${dataStr}T${horaStr}:00`;
}

// ─────────────────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────────────────
export default function ModalApontamento({
  chamado, item, onFechar, onAtualizarResumo, s, C,
}) {
  const [modo, setModo] = useState("lista"); // "lista" | "form"
  const [sessoes, setSessoes] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const [sessaoEditando, setSessaoEditando] = useState(null);

  // Lista de linhas (1 sessão = 1 linha)
  const [linhas, setLinhas] = useState([novaLinha(item.qtd_pessoas_planejada || 1)]);

  const [observacoes, setObservacoes] = useState("");

  // Ref sempre atualizada com o valor atual de `linhas`. Usada pra ler o
  // snapshot mais recente dentro de callbacks async sem depender de
  // re-render / useEffect reativo.
  const linhasRef = useRef(linhas);
  useEffect(() => { linhasRef.current = linhas; }, [linhas]);

  // Timers de debounce do preview por linha.
  const calculoTimersRef = useRef({});

  // ── Carrega sessões ──
  const carregarSessoes = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await apiService.get(
        `/cotacoes/chamados/${chamado.id}/servicos/${item.id}/apontamentos`
      );
      setSessoes(r?.sessoes || []);
      setResumo(r?.resumo || null);
    } catch (e) {
      setErro(e.message || "Erro ao carregar sessões");
    } finally {
      setCarregando(false);
    }
  }, [chamado.id, item.id]);

  useEffect(() => { carregarSessoes(); }, [carregarSessoes]);

  function atualizarLinha(id, campo, valor) {
    setLinhas(prev => prev.map(l => l._id === id ? { ...l, [campo]: valor } : l));
  }

  // Atualiza campo E agenda recálculo. Chamado pelos inputs.
  function atualizarEAgendar(id, campo, valor) {
    atualizarLinha(id, campo, valor);
    agendarCalculo(id);
  }

  // Agenda preview com debounce de 400ms. Cancela timer anterior da linha.
  // Lê o estado atual via linhasRef (não re-executa useEffect).
  function agendarCalculo(linhaId) {
    if (calculoTimersRef.current[linhaId]) {
      clearTimeout(calculoTimersRef.current[linhaId]);
    }
    calculoTimersRef.current[linhaId] = setTimeout(() => {
      delete calculoTimersRef.current[linhaId];
      executarCalculo(linhaId);
    }, 400);
  }

  async function executarCalculo(linhaId) {
    const linha = linhasRef.current.find(l => l._id === linhaId);
    if (!linha) return;

    if (!linha.data || !linha.inicio || !linha.fim || !linha.pessoas_reais) {
      setLinhas(prev => prev.map(l => l._id === linhaId
        ? { ...l, calculando: false, preview: null, erroLinha: null }
        : l));
      return;
    }

    const inicioIso = juntarDataHora(linha.data, linha.inicio);
    const fimIso = juntarDataHora(linha.data, linha.fim);
    if (!inicioIso || !fimIso || new Date(fimIso) <= new Date(inicioIso)) {
      setLinhas(prev => prev.map(l => l._id === linhaId
        ? { ...l, calculando: false, preview: null,
            erroLinha: "Fim deve ser posterior ao início (mesmo dia)." }
        : l));
      return;
    }

    // Já calculado pra esta combinação? Não refaz.
    if (linha.preview
      && linha.preview._inicioIso === inicioIso
      && linha.preview._fimIso === fimIso
      && String(linha.preview._pessoas) === String(linha.pessoas_reais)) {
      return;
    }

    setLinhas(prev => prev.map(l => l._id === linhaId
      ? { ...l, calculando: true, erroLinha: null }
      : l));

    try {
      const r = await apiService.post(
        `/cotacoes/chamados/${chamado.id}/servicos/${item.id}/preview-apontamento`,
        {
          inicio: inicioIso,
          fim: fimIso,
          pessoas: parseInt(linha.pessoas_reais),
        }
      );

      if (r?.modo === "auto" && r.calculo) {
        setLinhas(prev => prev.map(l => l._id === linhaId
          ? {
              ...l,
              calculando: false,
              erroLinha: null,
              preview: {
                ...r.calculo,
                _inicioIso: inicioIso,
                _fimIso: fimIso,
                _pessoas: linha.pessoas_reais,
              },
            }
          : l));
      }
    } catch (e) {
      setLinhas(prev => prev.map(l => l._id === linhaId
        ? { ...l, calculando: false, erroLinha: e.message || "Erro no cálculo" }
        : l));
    }
  }

  // ── Ações do form ──
  function adicionarLinha() {
    setLinhas(prev => [...prev, novaLinha(item.qtd_pessoas_planejada || 1)]);
  }

  function removerLinha(id) {
    setLinhas(prev => prev.length > 1 ? prev.filter(l => l._id !== id) : prev);
  }

  function validarTudo() {
    const erros = [];
    linhas.forEach((l, i) => {
      const num = i + 1;
      if (!l.data) erros.push(`Dia ${num}: informe a data.`);
      if (!l.pessoas_reais || parseInt(l.pessoas_reais) <= 0) erros.push(`Dia ${num}: pessoas > 0.`);

      if (!l.inicio || !l.fim) {
        erros.push(`Dia ${num}: informe início e fim.`);
      } else {
        const ini = juntarDataHora(l.data, l.inicio);
        const fim = juntarDataHora(l.data, l.fim);
        if (new Date(fim) <= new Date(ini)) {
          erros.push(`Dia ${num}: fim deve ser posterior ao início (mesmo dia).`);
        }
      }
    });
    return erros;
  }

  async function salvarTudo() {
    const erros = validarTudo();
    if (erros.length > 0) {
      setErro(erros.join(" "));
      return;
    }
    setErro(null);
    setSalvando(true);

    let sucesso = 0;
    const falhas = [];

    for (const l of linhas) {
      try {
        const payload = {
          servico_id: item.id,
          pessoas_reais: parseInt(l.pessoas_reais),
          observacoes: observacoes?.trim() || null,
        };

        payload.modo = "auto";
        payload.data_inicio_real = juntarDataHora(l.data, l.inicio);
        payload.data_fim_real = juntarDataHora(l.data, l.fim);

        await apiService.post(`/cotacoes/chamados/${chamado.id}/apontamentos`, payload);
        sucesso++;
      } catch (e) {
        falhas.push(`${l.data}: ${e.message || "erro"}`);
      }
    }

    setSalvando(false);

    if (falhas.length === 0) {
      await carregarSessoes();
      onAtualizarResumo?.();
      voltarParaLista();
    } else {
      setErro(
        `${sucesso} sessão(ões) salva(s). Falhas: ${falhas.join(" · ")}. ` +
        `Recarregue a lista para ver o que já foi.`
      );
      await carregarSessoes();
      onAtualizarResumo?.();
    }
  }

  function abrirNovaSessao() {
    setSessaoEditando(null);
    setLinhas([novaLinha(item.qtd_pessoas_planejada || 1)]);
    setObservacoes("");
    setErro(null);
    setModo("form");
  }

  function voltarParaLista() {
    setModo("lista");
    setSessaoEditando(null);
    setLinhas([novaLinha(item.qtd_pessoas_planejada || 1)]);
    setObservacoes("");
    setErro(null);
  }

  async function cancelarSessao(sessao) {
    const motivo = window.prompt("Motivo do cancelamento desta sessão (opcional):");
    if (motivo === null) return;
    setSalvando(true);
    try {
      await apiService.delete(`/cotacoes/chamados/apontamentos/${sessao.id}`, {
        motivo: motivo?.trim() || null,
      });
      await carregarSessoes();
      onAtualizarResumo?.();
    } catch (e) {
      setErro(e.message || "Erro ao cancelar sessão");
    } finally {
      setSalvando(false);
    }
  }

  async function toggleConclusaoManual() {
    setSalvando(true);
    try {
      const novoEstado = !resumo?.servico_concluido_manual;
      await apiService.put(
        `/cotacoes/chamados/${chamado.id}/servicos/${item.id}/concluir-manual`,
        { concluido: novoEstado }
      );
      await carregarSessoes();
      onAtualizarResumo?.();
    } catch (e) {
      setErro(e.message || "Erro ao alterar conclusão manual");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090",
                  display: "flex", alignItems: "center",
                  justifyContent: "center", zIndex: 340, padding: 20 }}>
      <div style={{ ...s.card, width: 700, maxWidth: "100%",
                    maxHeight: "90vh", display: "flex", flexDirection: "column" }}>

        {/* Cabeçalho */}
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                {modo === "lista" && "Apontamento de execução"}
                {modo === "form" && (sessaoEditando ? "Editar sessão" : "Nova sessão de execução")}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                {chamado?.numero} · {item.nome}
              </div>
            </div>
            <button onClick={onFechar}
              style={{ background: "transparent", border: "none",
                       color: C.muted, fontSize: 20, cursor: "pointer",
                       lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Corpo */}
        <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>

          {/* ══════════════ MODO LISTA ══════════════ */}
          {modo === "lista" && (
            <>
              {resumo && (
                <div style={{ background: C.bg, borderRadius: 6,
                              padding: "12px 14px", marginBottom: 14, fontSize: 11 }}>
                  <div style={{ display: "flex", justifyContent: "space-between",
                                alignItems: "center", marginBottom: 8 }}>
                    <div style={{ color: C.muted, fontSize: 10, letterSpacing: "0.08em" }}>
                      RESUMO
                    </div>
                    {resumo.servico_concluido_manual ? (
                      <span style={{ ...s.tag(C.success), fontSize: 9 }}>✅ CONCLUÍDO MANUALMENTE</span>
                    ) : resumo.servico_concluido ? (
                      <span style={{ ...s.tag(C.success), fontSize: 9 }}>✅ CONCLUÍDO</span>
                    ) : (
                      <span style={{ ...s.tag(C.warn), fontSize: 9 }}>🟡 EM EXECUÇÃO</span>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
                                gap: 8, marginBottom: 8 }}>
                    <div>
                      <div style={{ color: C.muted, fontSize: 10 }}>PLANEJADO</div>
                      <div style={{ color: C.text, fontWeight: 600 }}>
                        {resumo.horas_planejadas != null ? `${resumo.horas_planejadas}h-homem` : "—"}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: C.muted, fontSize: 10 }}>APONTADO</div>
                      <div style={{ color: C.accent, fontWeight: 600 }}>{resumo.total}h-homem</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, fontSize: 10, color: C.muted,
                                flexWrap: "wrap" }}>
                    {resumo.diurnas > 0 && <span>☀️ {resumo.diurnas}h diurnas</span>}
                    {resumo.noturnas > 0 && <span>🌙 {resumo.noturnas}h noturnas</span>}
                    {resumo.excepcionais > 0 && <span>📅 {resumo.excepcionais}h excepcionais</span>}
                    {resumo.extras_diurnas > 0 && <span>➕ {resumo.extras_diurnas}h extra diurna</span>}
                    {resumo.extras_noturnas > 0 && <span>➕ {resumo.extras_noturnas}h extra noturna</span>}
                  </div>
                </div>
              )}

              {carregando ? (
                <div style={{ color: C.muted, textAlign: "center", padding: 20 }}>
                  Carregando sessões...
                </div>
              ) : sessoes.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 10px",
                              background: C.bg, borderRadius: 8, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    Nenhuma sessão lançada ainda.
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em",
                                marginBottom: 8 }}>
                    SESSÕES ({sessoes.length})
                  </div>
                  {sessoes.map(sessao => (
                    <div key={sessao.id} style={{
                      background: C.bg, border: `1px solid ${C.border}`,
                      borderRadius: 6, padding: "10px 12px", marginBottom: 6,
                      opacity: sessao.status === "cancelado" ? 0.4 : 1,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between",
                                    alignItems: "flex-start", marginBottom: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>
                            {calcularTotalSessao(sessao)}h · {sessao.pessoas_reais} pessoa(s)
                            {sessao.calculo_automatico && (
                              <span style={{ ...s.tag(C.accent), fontSize: 8, marginLeft: 6 }}>AUTO</span>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                            {fmtHorasSessao(sessao)}
                          </div>
                          <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                            {fmtData(sessao.lancado_em)}
                          </div>
                        </div>
                        {sessao.status === "cancelado" ? (
                          <span style={{ ...s.tag("#ef4444"), fontSize: 9 }}>CANCELADA</span>
                        ) : (
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button onClick={() => cancelarSessao(sessao)}
                              disabled={salvando}
                              style={{ background: "transparent", border: "none",
                                       color: "#ef4444", fontSize: 10,
                                       cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                              Cancelar
                            </button>
                          </div>
                        )}
                      </div>
                      {sessao.observacoes && (
                        <div style={{ fontSize: 10, color: C.textSub,
                                      fontStyle: "italic", marginTop: 4 }}>
                          {sessao.observacoes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {erro && (
                <div style={{ padding: "10px 12px", background: "#ef444415",
                              border: "1px solid #ef444440", borderRadius: 6,
                              fontSize: 11, color: "#ef4444", marginBottom: 14 }}>
                  ⚠ {erro}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap",
                            paddingTop: 8, borderTop: `1px dashed ${C.border}` }}>
                <button onClick={abrirNovaSessao}
                  style={{ ...s.btn(true), flex: 1, padding: "8px 16px", fontSize: 12 }}>
                  + Nova sessão
                </button>
                {sessoes.length > 0 && (
                  <button onClick={toggleConclusaoManual} disabled={salvando}
                    style={{ ...s.btn(false), padding: "8px 16px", fontSize: 12,
                             borderColor: resumo?.servico_concluido_manual ? "#ef4444" : C.success,
                             color: resumo?.servico_concluido_manual ? "#ef4444" : C.success }}>
                    {resumo?.servico_concluido_manual ? "↩ Reabrir serviço" : "✅ Marcar concluído"}
                  </button>
                )}
              </div>
            </>
          )}

          {/* ══════════════ MODO FORM (em lote) ══════════════ */}
          {modo === "form" && (
            <>
              <div style={{ marginBottom: 16, padding: "10px 12px",
                            background: C.bg, borderRadius: 6,
                            fontSize: 11, color: C.muted }}>
                Informe <strong>data, pessoas, início e fim</strong> de cada sessão.
                O sistema calcula automaticamente as categorias (diurnas, noturnas,
                excepcionais, extras).
              </div>

              {/* Linhas */}
              {linhas.map((linha, idx) => (
                <div key={linha._id} style={{
                  background: C.bg, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: "12px 14px", marginBottom: 10,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between",
                                alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>
                      {linhas.length > 1 ? `Dia ${idx + 1}` : "Sessão"}
                    </div>
                    {linhas.length > 1 && (
                      <button onClick={() => removerLinha(linha._id)}
                        disabled={salvando}
                        style={{ background: "transparent", border: "none",
                                 color: "#ef4444", fontSize: 12,
                                 cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                        ×
                      </button>
                    )}
                  </div>

                  <div style={{ display: "grid",
                                gridTemplateColumns: "130px 80px 1fr 1fr",
                                gap: 8, marginBottom: 10 }}>
                    <div>
                      <label style={{ ...s.label, fontSize: 10 }}>DATA *</label>
                      <input type="date" value={linha.data}
                        onChange={e => atualizarEAgendar(linha._id, "data", e.target.value)}
                        style={s.input} />
                    </div>
                    <div>
                      <label style={{ ...s.label, fontSize: 10 }}>PESSOAS *</label>
                      <input type="number" min="1" value={linha.pessoas_reais}
                        onChange={e => atualizarEAgendar(linha._id, "pessoas_reais", e.target.value)}
                        style={{ ...s.input, textAlign: "center" }} />
                    </div>
                    <div>
                      <label style={{ ...s.label, fontSize: 10 }}>INÍCIO *</label>
                      <input type="time" value={linha.inicio}
                        onChange={e => atualizarEAgendar(linha._id, "inicio", e.target.value)}
                        style={s.input} />
                    </div>
                    <div>
                      <label style={{ ...s.label, fontSize: 10 }}>FIM *</label>
                      <input type="time" value={linha.fim}
                        onChange={e => atualizarEAgendar(linha._id, "fim", e.target.value)}
                        style={s.input} />
                    </div>
                  </div>

                  {/* Preview inline (só no modo janela) */}
                      {linha.calculando && (
                        <div style={{ fontSize: 10, color: C.muted,
                                      fontStyle: "italic", marginTop: 4 }}>
                          Calculando...
                        </div>
                      )}
                      {!linha.calculando && linha.preview && (
                        <div style={{ fontSize: 10, color: C.accent, marginTop: 4 }}>
                          → {linha.preview.total}h por pessoa:
                          {linha.preview.normais_diurnas > 0 && ` ☀️ ${linha.preview.normais_diurnas}h`}
                          {linha.preview.normais_noturnas > 0 && ` 🌙 ${linha.preview.normais_noturnas}h`}
                          {linha.preview.excepcionais > 0 && ` 📅 ${linha.preview.excepcionais}h`}
                          {linha.preview.extras_diurnas > 0 && ` ➕ ${linha.preview.extras_diurnas}h (extra)`}
                          {linha.preview.extras_noturnas > 0 && ` ➕ ${linha.preview.extras_noturnas}h (extra not.)`}
                          {linha.preview.minutos_intervalo_descontados > 0
                            && ` · ${linha.preview.minutos_intervalo_descontados}min almoço`}
                        </div>
                      )}
                      {!linha.calculando && linha.erroLinha && (
                        <div style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }}>
                          ⚠ {linha.erroLinha}
                        </div>
                      )}
                </div>
              ))}

              <button onClick={adicionarLinha} disabled={salvando}
                style={{ background: "transparent", border: `1px dashed ${C.border}`,
                         borderRadius: 8, padding: "10px 14px", width: "100%",
                         color: C.accent, fontSize: 11, fontWeight: 600,
                         cursor: "pointer", fontFamily: "inherit", marginBottom: 14 }}>
                + Adicionar outro dia
              </button>

              <div style={{ marginBottom: 14 }}>
                <label style={s.label}>
                  OBSERVAÇÕES {linhas.length > 1 ? "(APLICADAS A TODAS AS SESSÕES)" : ""}
                </label>
                <textarea value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                  placeholder="Ex: primeira metade do serviço concluída, aguardando peça..."
                  style={{ ...s.input, minHeight: 60, resize: "vertical" }} />
              </div>

              {erro && (
                <div style={{ padding: "10px 12px", background: "#ef444415",
                              border: "1px solid #ef444440", borderRadius: 6,
                              fontSize: 11, color: "#ef4444", marginBottom: 14 }}>
                  ⚠ {erro}
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={voltarParaLista} disabled={salvando}
                  style={{ ...s.btn(false), flex: 1, padding: "8px 16px" }}>
                  Cancelar
                </button>
                <button onClick={salvarTudo} disabled={salvando}
                  style={{ ...s.btn(true), flex: 1, padding: "8px 16px",
                           opacity: salvando ? 0.5 : 1 }}>
                  {salvando
                    ? "Salvando..."
                    : `Lançar ${linhas.length} sessão${linhas.length > 1 ? "s" : ""}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}