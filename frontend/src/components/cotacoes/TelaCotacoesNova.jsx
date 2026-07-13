// components/cotacoes/TelaCotacoesNova.jsx
import { useState, useEffect } from "react";
import { useCotacoes } from "../../hooks/useCotacoes";
import { useFornecedores } from "../../hooks/useFornecedores";
import { useChamados } from "../../hooks/useChamados";
import { useEmail } from "../../hooks/useEmail";

export default function TelaCotacoesNova({ fmtBRL, fmtD, C, s }) {
  // ✅ Usar hooks internos
  const { cotacoes, loading, erro, carregar: listarCotacoes, criar: criarCotacao, aprovar: aprovarFornecedor } = useCotacoes();
  const { fornecedores } = useFornecedores();
  const { chamados } = useChamados();
  const { enviarCotacao } = useEmail();

  const cotacoesSeguro = cotacoes || [];
  const fornecedoresSeguro = fornecedores || [];
  const chamadosSeguro = chamados || [];

  const [telaAtual, setTelaAtual] = useState("lista");
  const [cotacaoSel, setCotacaoSel] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    chamadoId: "",
    fornecedorIds: [],
  });
  const [enviando, setEnviando] = useState(false);
  const [aprovando, setAprovando] = useState(false);

  // Carregar cotações ao montar
  useEffect(() => {
    listarCotacoes();
  }, []);

  // Filtrar cotações
  const cotacoesFiltered = cotacoesSeguro
    .filter(c => filtro === "todos" || c.status === filtro)
    .filter(c => {
      const chamado = chamadosSeguro.find(ch => ch.id === c.chamadoId);
      return !busca || 
             (chamado && chamado.peca && chamado.peca.toLowerCase().includes(busca.toLowerCase())) ||
             (chamado && chamado.codigo && chamado.codigo.toLowerCase().includes(busca.toLowerCase()));
    });

  // ─── CRIAR COTAÇÃO ──────────────────────────────────────
  const handleCriarCotacao = async () => {
    if (!form.chamadoId || form.fornecedorIds.length === 0) {
      alert("Selecione chamado e pelo menos 1 fornecedor");
      return;
    }

    setEnviando(true);
    try {
      // Usar o método criar do hook (que já faz fetch)
      const novaCotacao = await criarCotacao({
        chamado_id: form.chamadoId,
        fornecedor_ids: form.fornecedorIds,
      });

      // Enviar e-mail para cada fornecedor
      for (const fornId of form.fornecedorIds) {
        const forn = fornecedoresSeguro.find(f => f.id === fornId);
        if (forn?.email && typeof enviarCotacao === "function") {
          await enviarCotacao({
            cotacaoId: novaCotacao.id,
            fornecedorId: fornId,
            email: forn.email,
          });
        }
      }

      await listarCotacoes();
      setModal(null);
      setForm({ chamadoId: "", fornecedorIds: [] });
      alert("Cotação criada e enviada com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao criar cotação: " + e.message);
    } finally {
      setEnviando(false);
    }
  };

  // ─── APROVAR FORNECEDOR ────────────────────────────────
  const handleAprovarFornecedor = async (cotacaoId, fornecedorId) => {
    if (!window.confirm("Confirma aprovação deste fornecedor como vencedor?")) return;

    setAprovando(true);
    try {
      await aprovarFornecedor(cotacaoId, fornecedorId);
      await listarCotacoes();
      setCotacaoSel(null);
      alert("Fornecedor aprovado com sucesso!");
    } catch (e) {
      alert("Erro: " + e.message);
    } finally {
      setAprovando(false);
    }
  };

  // ─── MODAL ──────────────────────────────────────────────
  if (modal === "nova") {
    const chamadosSemCotacao = chamadosSeguro.filter(
      ch => !cotacoesSeguro.some(c => c.chamadoId === ch.id && c.status !== "finalizado")
    );

    return (
      <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
        <div style={{ ...s.card, width: 560, maxWidth: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 48px #00000060" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Nova Cotação</div>
            <button onClick={() => setModal(null)} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>

          <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
            {/* Seleção do chamado */}
            <div style={{ marginBottom: 18 }}>
              <label style={s.label}>CHAMADO *</label>
              <select 
                value={form.chamadoId}
                onChange={e => setForm(f => ({ ...f, chamadoId: e.target.value }))}
                style={{ ...s.input, appearance: "none" }}
              >
                <option value="">Selecione um chamado</option>
                {chamadosSemCotacao.map(ch => {
                  const primeiroItem = ch.itens?.[0]?.item_nome || ch.peca || 'Sem item';
                  return (
                    <option key={ch.id} value={ch.id}>
                      {ch.numero} - {primeiroItem} ({ch.urgencia || 'média'})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Seleção de fornecedores */}
            <div style={{ marginBottom: 18 }}>
              <label style={s.label}>FORNECEDORES *</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 250, overflowY: "auto" }}>
                {fornecedoresSeguro.filter(f => f.ativo).map(forn => (
                  <label key={forn.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: C.bg, borderRadius: 6, cursor: "pointer" }}>
                    <input 
                      type="checkbox"
                      checked={form.fornecedorIds.includes(forn.id)}
                      onChange={e => setForm(f => ({
                        ...f,
                        fornecedorIds: e.target.checked 
                          ? [...f.fornecedorIds, forn.id]
                          : f.fornecedorIds.filter(id => id !== forn.id)
                      }))}
                      style={{ cursor: "pointer" }}
                    />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>{forn.nome}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{forn.email}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ fontSize: 11, color: C.muted, background: C.bg, borderRadius: 6, padding: "10px 12px", marginBottom: 18 }}>
              ℹ️ Será enviado um email com link único para cada fornecedor responder
            </div>
          </div>

          {/* Ações do modal */}
          <div style={{ display: "flex", gap: 10, padding: "14px 22px", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
            <button onClick={() => setModal(null)} style={{ ...s.btn(false), flex: 1, padding: "8px 16px" }}>Cancelar</button>
            <button 
              onClick={handleCriarCotacao}
              disabled={enviando || !form.chamadoId || form.fornecedorIds.length === 0}
              style={{
                ...s.btn(true),
                flex: 1,
                padding: "8px 16px",
                opacity: enviando || !form.chamadoId || form.fornecedorIds.length === 0 ? 0.5 : 1,
                cursor: enviando || !form.chamadoId || form.fornecedorIds.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              {enviando ? "Enviando..." : "Criar e Enviar"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── LISTA ──────────────────────────────────────────────
  if (telaAtual === "lista") {
    return (
      <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>GERENCIAMENTO</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Cotações</div>
          </div>
          <button 
            onClick={() => setModal("nova")}
            style={{ ...s.btn(true), padding: "9px 20px", fontSize: 12 }}
          >
            ➕ Nova Cotação
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          <input 
            type="text"
            placeholder="Buscar peça ou código..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ ...s.input, flex: 1, minWidth: 200, padding: "8px 12px", fontSize: 12 }}
          />
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { id: "todos", label: "Todas" },
              { id: "em_curso", label: "Em Curso" },
              { id: "respondida", label: "Respondida" },
              { id: "finalizado", label: "Finalizado" },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                style={{
                  background: filtro === f.id ? C.accent : "transparent",
                  border: `1px solid ${filtro === f.id ? C.accent : C.border}`,
                  borderRadius: 6,
                  padding: "6px 14px",
                  color: filtro === f.id ? "white" : C.muted,
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

        {!loading && cotacoesFiltered.length === 0 ? (
          <div style={{ ...s.card, padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, color: C.text, fontWeight: 500, marginBottom: 4 }}>Nenhuma cotação</div>
            <div style={{ fontSize: 12, color: C.muted }}>Crie uma nova cotação para começar</div>
          </div>
        ) : (
          <div style={{ ...s.card, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "120px 2fr 2fr 120px 100px 80px 100px", padding: "10px 18px", background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, letterSpacing: "0.08em" }}>
              <span>COTAÇÃO</span>
              <span>PEÇA</span>
              <span>CHAMADO</span>
              <span>DATA ENVIO</span>
              <span>FORNECEDORES</span>
              <span>STATUS</span>
              <span></span>
            </div>
            {cotacoesFiltered.map((cot, i) => {
              const chamado = chamadosSeguro.find(c => c.id === cot.chamadoId);
              const statusCfg = {
                em_curso: { l: "Em Curso", c: C.warn },
                respondida: { l: "Respondida", c: C.success },
                finalizado: { l: "Finalizado", c: C.accent },
              }[cot.status] || { l: cot.status, c: C.muted };

              const primeiroItem = chamado?.itens?.[0]?.item_nome || chamado?.peca || "—";

              return (
                <div 
                  key={cot.id}
                  style={{ display: "grid", gridTemplateColumns: "120px 2fr 2fr 120px 100px 80px 100px", padding: "13px 18px", borderBottom: i < cotacoesFiltered.length - 1 ? `1px solid ${C.border}22` : "none", alignItems: "center" }}
                >
                  <div style={{ fontSize: 11, color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>
                    {cot.numero || cot.id}
                  </div>
                  <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{primeiroItem}</div>
                  <div style={{ fontSize: 11, color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>
                    {chamado?.numero || "—"}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>{fmtD(cot.enviado_em)}</div>
                  <div style={{ fontSize: 11, color: C.text, fontWeight: 500 }}>
                    {(cot.fornecedores || []).length} forn.
                  </div>
                  <div style={{ ...s.tag(statusCfg.c), fontSize: 10 }}>{statusCfg.l}</div>
                  <button 
                    onClick={() => { setCotacaoSel(cot); setTelaAtual("detalhe"); }}
                    style={{ ...s.btn(true), padding: "4px 10px", fontSize: 10 }}
                  >
                    Ver
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── DETALHE ──────────────────────────────────────────────
  if (telaAtual === "detalhe" && cotacaoSel) {
    const chamado = chamadosSeguro.find(c => c.id === cotacaoSel.chamadoId);
    const fornecedores_respostas = cotacaoSel.fornecedores || [];

    const comValor = fornecedores_respostas.filter(f => f.valor != null);
    const melhor = comValor.length > 0 ? comValor.reduce((a, b) => (a.valor + (a.valorFrete || 0)) < (b.valor + (b.valorFrete || 0)) ? a : b) : null;

    return (
      <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
        <button 
          onClick={() => { setTelaAtual("lista"); setCotacaoSel(null); }}
          style={{ background: "transparent", border: "none", color: C.accent, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 16 }}
        >
          ← Voltar para cotações
        </button>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>DETALHES</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                {cotacaoSel.numero || cotacaoSel.id}
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>
                Chamado: {chamado?.numero || "—"} · {chamado?.peca || "—"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>ENVIADO EM</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{fmtD(cotacaoSel.enviado_em)}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <div style={{ ...s.card, padding: "16px 18px" }}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", marginBottom: 12 }}>INFORMAÇÕES DO CHAMADO</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: C.muted }}>URGÊNCIA</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: chamado?.urgencia === "alta" ? "#ef4444" : chamado?.urgencia === "media" ? C.warn : C.success }}>
                  {chamado?.urgencia?.toUpperCase()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.muted }}>CATEGORIA</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{chamado?.categoria?.toUpperCase()}</div>
              </div>
            </div>
          </div>
          <div style={{ ...s.card, padding: "16px 18px" }}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", marginBottom: 12 }}>STATUS DA COTAÇÃO</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: C.muted }}>FORNECEDORES CONVIDADOS</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.accent }}>{fornecedores_respostas.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.muted }}>RESPOSTAS RECEBIDAS</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.success }}>
                  {fornecedores_respostas.filter(f => f.status === "respondido").length}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.muted }}>TAXA DE RESPOSTA</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                  {fornecedores_respostas.length > 0 ? Math.round((fornecedores_respostas.filter(f => f.status === "respondido").length / fornecedores_respostas.length) * 100) : 0}%
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...s.card, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ padding: "14px 18px", background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: "0.08em" }}>
            RESPOSTAS DOS FORNECEDORES
          </div>
          {fornecedores_respostas.length === 0 ? (
            <div style={{ padding: "30px 20px", textAlign: "center", color: C.muted }}>Nenhum fornecedor convidado ainda</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ padding: "10px 15px", textAlign: "left", fontSize: 11, color: C.muted, fontWeight: 600 }}>FORNECEDOR</th>
                    <th style={{ padding: "10px 15px", textAlign: "center", fontSize: 11, color: C.muted, fontWeight: 600 }}>VALOR</th>
                    <th style={{ padding: "10px 15px", textAlign: "center", fontSize: 11, color: C.muted, fontWeight: 600 }}>FRETE</th>
                    <th style={{ padding: "10px 15px", textAlign: "center", fontSize: 11, color: C.muted, fontWeight: 600 }}>TOTAL</th>
                    <th style={{ padding: "10px 15px", textAlign: "center", fontSize: 11, color: C.muted, fontWeight: 600 }}>PRAZO</th>
                    <th style={{ padding: "10px 15px", textAlign: "center", fontSize: 11, color: C.muted, fontWeight: 600 }}>STATUS</th>
                    <th style={{ padding: "10px 15px", textAlign: "right", fontSize: 11, color: C.muted, fontWeight: 600 }}>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {fornecedores_respostas.map((forn, i) => {
                    const total = (forn.valor || 0) + (forn.valorFrete || 0);
                    const isMelhor = melhor && forn.fornecedorId === melhor.fornecedorId;
                    const statusCfg = {
                      respondido: { l: "Respondido", c: C.success },
                      pendente: { l: "Pendente", c: C.warn },
                      sem_resposta: { l: "Sem resposta", c: "#ef4444" },
                    }[forn.status] || { l: forn.status, c: C.muted };

                    return (
                      <tr 
                        key={forn.fornecedorId}
                        style={{ 
                          borderBottom: `1px solid ${C.border}22`,
                          background: isMelhor ? C.accent + "10" : "transparent",
                        }}
                      >
                        <td style={{ padding: "12px 15px", fontSize: 12, color: C.text, fontWeight: 500 }}>
                          {forn.nome}
                          {isMelhor && <span style={{ color: C.success, fontSize: 10, marginLeft: 6 }}>★ Melhor oferta</span>}
                        </td>
                        <td style={{ padding: "12px 15px", fontSize: 12, color: C.text, textAlign: "center", fontWeight: 600 }}>
                          {forn.valor != null ? fmtBRL(forn.valor) : "—"}
                        </td>
                        <td style={{ padding: "12px 15px", fontSize: 12, color: C.text, textAlign: "center" }}>
                          {forn.frete ? `${forn.frete} ${forn.valorFrete > 0 ? fmtBRL(forn.valorFrete) : "Grátis"}` : "—"}
                        </td>
                        <td style={{ padding: "12px 15px", fontSize: 12, color: C.text, textAlign: "center", fontWeight: 700 }}>
                          {forn.valor != null ? fmtBRL(total) : "—"}
                        </td>
                        <td style={{ padding: "12px 15px", fontSize: 12, color: C.muted, textAlign: "center" }}>
                          {forn.prazo ? `${forn.prazo}d` : "—"}
                        </td>
                        <td style={{ padding: "12px 15px", textAlign: "center" }}>
                          <span style={{ ...s.tag(statusCfg.c), fontSize: 10 }}>{statusCfg.l}</span>
                        </td>
                        <td style={{ padding: "12px 15px", textAlign: "right" }}>
                          {forn.status === "respondido" && (
                            <button 
                              onClick={() => handleAprovarFornecedor(cotacaoSel.id, forn.fornecedorId)}
                              disabled={aprovando}
                              style={{
                                background: C.success,
                                border: "none",
                                borderRadius: 5,
                                padding: "5px 12px",
                                color: "white",
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: aprovando ? "not-allowed" : "pointer",
                                opacity: aprovando ? 0.5 : 1,
                                fontFamily: "inherit",
                              }}
                            >
                              {aprovando ? "..." : "Aprovar"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}