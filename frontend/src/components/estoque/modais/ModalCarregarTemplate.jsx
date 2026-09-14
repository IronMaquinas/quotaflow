// frontend/src/components/estoque/modais/ModalCarregarTemplate.jsx
//
// Modal de carregar modelo de manutenção em uma OS nova. Extraído do
// TelaOrdemServico.jsx na Rodada 3 da quebra.
//
// Dois estágios:
//   1) Lista com abas "Meus modelos" / "Banco de modelos" + busca + filtros
//   2) Preview com checkboxes por item, botão "Carregar N de M itens"
//
// Busca do banco global é server-side com fuzzy (pg_trgm no backend) e
// debounce de 350ms. Modelos privados ficam em memória (lista curta).

import { useState, useEffect, useCallback, useRef } from "react";
import apiService from "../../../services/apiService";
import { novoMaterial, novoServico, categoriaCfgMap, urgenciaCfgMap } from "../helpers";

export default function ModalCarregarTemplate({
  qtdItensExistentes, onCancelar, onConfirmar, s, C,
}) {
  // ── Aba ativa: "meus" (privados) | "globais" (biblioteca SaaS) ──
  const [abaTemplate, setAbaTemplate] = useState("meus");

  // ── Modelos privados ──
  const [templatesPrivados, setTemplatesPrivados] = useState([]);
  const [carregandoPrivados, setCarregandoPrivados] = useState(false);
  const [buscaTemplate, setBuscaTemplate] = useState("");

  // ── Modelos globais ──
  const [templatesGlobais, setTemplatesGlobais] = useState([]);
  const [carregandoGlobais, setCarregandoGlobais] = useState(false);
  const [buscaGlobal, setBuscaGlobal] = useState("");
  const [filtroTipoEquip, setFiltroTipoEquip] = useState("");
  const [filtroMarca, setFiltroMarca] = useState("");
  const [filtrosDisponiveis, setFiltrosDisponiveis] = useState({
    tipos_equipamento: [],
    marcas: [],
  });

  // ── Preview (estágio 2) ──
  const [templateSelecionado, setTemplateSelecionado] = useState(null);
  const [carregandoItens, setCarregandoItens] = useState(false);
  const [itensSelecionados, setItensSelecionados] = useState({});

  const buscaGlobalTimerRef = useRef(null);

  // ── Carrega modelos privados na abertura ──
  useEffect(() => {
    setCarregandoPrivados(true);
    apiService.get("/cotacoes/chamados/templates")
      .then(lista => setTemplatesPrivados(Array.isArray(lista) ? lista : []))
      .catch(() => setTemplatesPrivados([]))
      .finally(() => setCarregandoPrivados(false));
  }, []);

  // ── Carrega filtros disponíveis do banco global ──
  useEffect(() => {
    apiService.get("/cotacoes/chamados/templates-globais-meta/filtros")
      .then(f => {
        if (f && typeof f === "object") setFiltrosDisponiveis(f);
      })
      .catch(() => {});
  }, []);

  // ── Busca server-side do banco global, com debounce ──
  const carregarTemplatesGlobais = useCallback(async () => {
    setCarregandoGlobais(true);
    try {
      const params = {};
      if (buscaGlobal.trim()) params.q = buscaGlobal.trim();
      if (filtroTipoEquip) params.tipo_equipamento = filtroTipoEquip;
      if (filtroMarca) params.marca = filtroMarca;

      const lista = await apiService.get("/cotacoes/chamados/templates-globais", params);
      setTemplatesGlobais(Array.isArray(lista) ? lista : []);
    } catch (e) {
      setTemplatesGlobais([]);
    } finally {
      setCarregandoGlobais(false);
    }
  }, [buscaGlobal, filtroTipoEquip, filtroMarca]);

  useEffect(() => {
    if (abaTemplate !== "globais") return;
    if (buscaGlobalTimerRef.current) clearTimeout(buscaGlobalTimerRef.current);
    buscaGlobalTimerRef.current = setTimeout(() => {
      carregarTemplatesGlobais();
    }, 350);
    return () => {
      if (buscaGlobalTimerRef.current) clearTimeout(buscaGlobalTimerRef.current);
    };
  }, [buscaGlobal, filtroTipoEquip, filtroMarca, abaTemplate, carregarTemplatesGlobais]);

  // ── Helpers ──
  function toggleItem(chave) {
    setItensSelecionados(prev => ({ ...prev, [chave]: !prev[chave] }));
  }

  async function abrirPreview(templateResumo, origem) {
    setCarregandoItens(true);
    try {
      const url = origem === "global"
        ? `/cotacoes/chamados/templates-globais/${templateResumo.id}`
        : `/cotacoes/chamados/templates/${templateResumo.id}`;
      const completo = await apiService.get(url);
      setTemplateSelecionado({ ...completo, _origem: origem });

      const mapa = {};
      (completo.itens || []).forEach((it, i) => {
        mapa[it.id != null ? `id_${it.id}` : `idx_${i}`] = true;
      });
      setItensSelecionados(mapa);
    } catch (e) {
      alert("Erro ao carregar itens do modelo: " + (e.message || "erro"));
    } finally {
      setCarregandoItens(false);
    }
  }

  function voltarParaLista() {
    setTemplateSelecionado(null);
    setItensSelecionados({});
  }

  function confirmarCarregamento() {
    const itensFiltrados = (templateSelecionado.itens || []).filter((it, i) => {
      const chave = it.id != null ? `id_${it.id}` : `idx_${i}`;
      return !!itensSelecionados[chave];
    });

    const itensDoTemplate = itensFiltrados.map(it => {
      if (it.tipo === "material") {
        return {
          ...novoMaterial("planejado"),
          item_nome: it.item_nome || "",
          codigo: it.codigo || "",
          item_catalogo_id: it.item_catalogo_id || null,
          quantidade: it.quantidade || 1,
          tipo_item: it.tipo_item || "",
          descricao: it.descricao || "",
          serializado: !!it.serializado,
        };
      }
      return {
        ...novoServico("planejado"),
        nome: it.item_nome || "",
        descricao: it.descricao || "",
        qtd_pessoas_planejada: it.qtd_pessoas_planejada || 1,
      };
    });

    onConfirmar({
      itens: itensDoTemplate,
      template: templateSelecionado,
      totalDisponivel: (templateSelecionado.itens || []).length,
      totalSelecionado: itensDoTemplate.length,
    });
  }

  const totalSelecionado = Object.values(itensSelecionados).filter(Boolean).length;
  const totalDisponivel = (templateSelecionado?.itens || []).length;

  const templatesPrivadosFiltrados = templatesPrivados.filter(t => {
    if (!buscaTemplate.trim()) return true;
    const termo = buscaTemplate.toLowerCase();
    return (t.nome || "").toLowerCase().includes(termo)
        || (t.descricao || "").toLowerCase().includes(termo);
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090",
                  display: "flex", alignItems: "center",
                  justifyContent: "center", zIndex: 380, padding: 20 }}>
      <div style={{ ...s.card, width: 640, maxWidth: "100%",
                    maxHeight: "85vh", display: "flex", flexDirection: "column" }}>

        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                {templateSelecionado ? "Confirmar carregamento" : "Modelos de manutenção"}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                {templateSelecionado
                  ? templateSelecionado.nome
                  : "Selecione um modelo para carregar os itens nesta OS"}
              </div>
            </div>
            {templateSelecionado && (
              <button onClick={voltarParaLista}
                style={{ background: "transparent", border: "none", color: C.accent,
                         fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                         padding: 0 }}>
                ← Voltar
              </button>
            )}
          </div>
        </div>

        {/* ═══════════════ ETAPA 1: LISTA ═══════════════ */}
        {!templateSelecionado && (
          <>
            <div style={{ padding: "14px 22px 0 22px",
                          borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[
                  { id: "meus", label: "📋 Meus modelos" },
                  { id: "globais", label: "🌎 Banco de modelos" },
                ].map(tab => (
                  <button key={tab.id}
                    onClick={() => {
                      setAbaTemplate(tab.id);
                      setTemplateSelecionado(null);
                      setItensSelecionados({});
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      borderBottom: abaTemplate === tab.id
                        ? `2px solid ${C.accent}`
                        : "2px solid transparent",
                      color: abaTemplate === tab.id ? C.text : C.muted,
                      fontSize: 12,
                      fontWeight: abaTemplate === tab.id ? 600 : 400,
                      cursor: "pointer",
                      padding: "8px 14px 10px 14px",
                      fontFamily: "inherit",
                      marginBottom: -1,
                    }}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: "14px 22px 0 22px" }}>
              <input
                type="text"
                value={abaTemplate === "meus" ? buscaTemplate : buscaGlobal}
                onChange={e => {
                  if (abaTemplate === "meus") setBuscaTemplate(e.target.value);
                  else setBuscaGlobal(e.target.value);
                }}
                placeholder={abaTemplate === "meus"
                  ? "Buscar nos seus modelos..."
                  : "Buscar no banco (tolerante a erros de digitação)..."}
                autoFocus
                style={{ ...s.input, padding: "8px 12px", fontSize: 12 }} />

              {abaTemplate === "globais" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
                              gap: 8, marginTop: 8 }}>
                  <select value={filtroTipoEquip}
                    onChange={e => setFiltroTipoEquip(e.target.value)}
                    style={{ ...s.input, padding: "8px 12px", fontSize: 12,
                             appearance: "none" }}>
                    <option value="">Todos os tipos de equipamento</option>
                    {filtrosDisponiveis.tipos_equipamento.map(t => (
                      <option key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </select>
                  <select value={filtroMarca}
                    onChange={e => setFiltroMarca(e.target.value)}
                    style={{ ...s.input, padding: "8px 12px", fontSize: 12,
                             appearance: "none" }}>
                    <option value="">Todas as marcas</option>
                    {filtrosDisponiveis.marcas.map(m => (
                      <option key={m} value={m}>
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ padding: "14px 22px", overflowY: "auto", flex: 1 }}>
              {/* ═══ Aba "Meus modelos" ═══ */}
              {abaTemplate === "meus" && (
                carregandoPrivados ? (
                  <div style={{ color: C.muted, textAlign: "center", padding: 20 }}>
                    Carregando modelos...
                  </div>
                ) : templatesPrivados.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 20px",
                                background: C.bg, borderRadius: 8 }}>
                    <div style={{ fontSize: 30, marginBottom: 10 }}>📋</div>
                    <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>
                      Nenhum modelo cadastrado ainda
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      Abra uma OS existente e clique em "Salvar como modelo" para
                      criar seu primeiro modelo reutilizável.
                    </div>
                  </div>
                ) : templatesPrivadosFiltrados.length === 0 ? (
                  <div style={{ color: C.muted, textAlign: "center",
                                padding: 20, fontSize: 12 }}>
                    Nenhum modelo encontrado para "{buscaTemplate}"
                  </div>
                ) : (
                  templatesPrivadosFiltrados.map(t => (
                    <div key={t.id}
                      onClick={() => abrirPreview(t, "privado")}
                      style={{ background: C.bg, border: `1px solid ${C.border}`,
                               borderRadius: 8, padding: "14px 16px",
                               marginBottom: 8, cursor: "pointer",
                               transition: "background 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#1e2a3f"}
                      onMouseLeave={e => e.currentTarget.style.background = C.bg}>
                      <div style={{ display: "flex", justifyContent: "space-between",
                                    alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                          📋 {t.nome}
                        </div>
                        <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>
                          {t.total_itens} item(ns)
                        </span>
                      </div>
                      {t.descricao && (
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>
                          {t.descricao}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, fontSize: 10 }}>
                        {t.categoria && (
                          <span style={{ color: categoriaCfgMap[t.categoria]?.c || C.muted }}>
                            {categoriaCfgMap[t.categoria]?.l || t.categoria}
                          </span>
                        )}
                        {t.urgencia && (
                          <span style={{ color: urgenciaCfgMap[t.urgencia]?.c || C.muted }}>
                            · Urgência {urgenciaCfgMap[t.urgencia]?.l || t.urgencia}
                          </span>
                        )}
                        {t.criado_por_nome && (
                          <span style={{ color: C.muted, marginLeft: "auto" }}>
                            por {t.criado_por_nome}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )
              )}

              {/* ═══ Aba "Banco de modelos" ═══ */}
              {abaTemplate === "globais" && (
                carregandoGlobais ? (
                  <div style={{ color: C.muted, textAlign: "center", padding: 20 }}>
                    Buscando no banco de modelos...
                  </div>
                ) : templatesGlobais.length === 0 ? (
                  <div style={{ color: C.muted, textAlign: "center",
                                padding: 20, fontSize: 12 }}>
                    {(buscaGlobal || filtroTipoEquip || filtroMarca)
                      ? "Nenhum modelo encontrado para esta busca."
                      : "Nenhum modelo publicado ainda. Novos modelos são adicionados periodicamente."}
                  </div>
                ) : (
                  templatesGlobais.map(t => (
                    <div key={t.id}
                      onClick={() => abrirPreview(t, "global")}
                      style={{ background: C.bg, border: `1px solid ${C.border}`,
                               borderRadius: 8, padding: "14px 16px",
                               marginBottom: 8, cursor: "pointer",
                               transition: "background 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#1e2a3f"}
                      onMouseLeave={e => e.currentTarget.style.background = C.bg}>
                      <div style={{ display: "flex", justifyContent: "space-between",
                                    alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                          📋 {t.nome}
                        </div>
                        <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>
                          {t.total_itens} item(ns)
                        </span>
                      </div>
                      {t.descricao && (
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>
                          {t.descricao}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 6, fontSize: 10,
                                    flexWrap: "wrap", alignItems: "center" }}>
                        {t.tipo_equipamento && (
                          <span style={{ ...s.tag(C.accent), fontSize: 9 }}>
                            {t.tipo_equipamento}
                          </span>
                        )}
                        {t.marca && (
                          <span style={{ ...s.tag("#a855f7"), fontSize: 9 }}>
                            {t.marca}{t.modelo ? ` ${t.modelo}` : ""}
                          </span>
                        )}
                        {t.categoria && (
                          <span style={{ color: categoriaCfgMap[t.categoria]?.c || C.muted }}>
                            {categoriaCfgMap[t.categoria]?.l || t.categoria}
                          </span>
                        )}
                        {t.intervalo_descricao && (
                          <span style={{ color: C.muted }}>
                            · {t.intervalo_descricao}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </>
        )}

        {/* ═══════════════ ETAPA 2: PREVIEW ═══════════════ */}
        {templateSelecionado && (
          <>
            <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
              <div style={{ background: C.bg, borderRadius: 6,
                            padding: "10px 12px", marginBottom: 14, fontSize: 11 }}>
                {templateSelecionado.descricao && (
                  <div style={{ color: C.text, marginBottom: 6 }}>
                    {templateSelecionado.descricao}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {templateSelecionado.categoria && (
                    <span style={{ color: categoriaCfgMap[templateSelecionado.categoria]?.c || C.muted }}>
                      {categoriaCfgMap[templateSelecionado.categoria]?.l || templateSelecionado.categoria}
                    </span>
                  )}
                  {templateSelecionado.urgencia && (
                    <span style={{ color: urgenciaCfgMap[templateSelecionado.urgencia]?.c || C.muted }}>
                      Urgência {urgenciaCfgMap[templateSelecionado.urgencia]?.l || templateSelecionado.urgencia}
                    </span>
                  )}
                  <span style={{ color: C.muted }}>
                    · {totalDisponivel} item(ns)
                  </span>
                </div>
              </div>

              {templateSelecionado._origem === "global" && (
                <div style={{
                  background: `${C.accent}10`,
                  border: `1px solid ${C.accent}30`,
                  borderRadius: 6,
                  padding: "10px 12px",
                  marginBottom: 14,
                  fontSize: 11,
                  color: C.text,
                }}>
                  🌎 <strong>Modelo do Banco QuotaFlow</strong>
                  <div style={{ color: C.muted, marginTop: 4, fontSize: 10 }}>
                    Os materiais virão sem vínculo com seu catálogo — você pode
                    associar cada um ao item correto depois de carregar a OS.
                  </div>
                </div>
              )}

              <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em",
                            marginBottom: 10 }}>
                ITENS QUE SERÃO CARREGADOS ({totalSelecionado} de {totalDisponivel})
              </div>

              {(templateSelecionado.itens || []).map((it, idx) => {
                const isMaterial = it.tipo === "material";
                const chave = it.id != null ? `id_${it.id}` : `idx_${idx}`;
                const selecionado = !!itensSelecionados[chave];

                return (
                  <div key={it.id || idx}
                    onClick={() => toggleItem(chave)}
                    style={{
                      background: C.bg,
                      border: `1px solid ${selecionado ? C.accent : C.border}`,
                      borderRadius: 6,
                      padding: "10px 12px",
                      marginBottom: 6,
                      fontSize: 11,
                      opacity: selecionado ? 1 : 0.5,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8,
                                  marginBottom: 4, flexWrap: "wrap" }}>
                      <input type="checkbox"
                        checked={selecionado}
                        onChange={() => {}}
                        style={{ flexShrink: 0, cursor: "pointer" }} />
                      <span style={{ fontSize: 11, fontWeight: 700,
                                     color: C.accent,
                                     fontFamily: "'IBM Plex Mono',monospace" }}>
                        #{it.numero_base ?? idx + 1}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                        {isMaterial ? "📦" : "🛠"} {it.item_nome}
                      </span>
                      {it.codigo && (
                        <span style={{ fontSize: 10, color: C.muted,
                                       fontFamily: "'IBM Plex Mono',monospace" }}>
                          {it.codigo}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 10, color: C.muted,
                                  paddingLeft: 26 }}>
                      {isMaterial ? (
                        <>
                          <span>Qtd: {it.quantidade}</span>
                          {it.serializado && (
                            <span style={{ color: "#a855f7" }}>🔢 serializado</span>
                          )}
                        </>
                      ) : (
                        <span>{it.qtd_pessoas_planejada || 1} pessoa(s) planejada(s)</span>
                      )}
                      {it.descricao && <span>· {it.descricao}</span>}
                    </div>
                  </div>
                );
              })}

              {qtdItensExistentes > 0 && (
                <div style={{ marginTop: 14, padding: "10px 12px",
                              background: "#f59e0b15", border: "1px solid #f59e0b40",
                              borderRadius: 6, fontSize: 11, color: "#f59e0b" }}>
                  ⚠ Esta OS já tem {qtdItensExistentes} item(ns). Ao confirmar, eles
                  serão <strong>substituídos</strong> pelos itens selecionados acima.
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, padding: "14px 22px",
                          borderTop: `1px solid ${C.border}` }}>
              <button onClick={voltarParaLista}
                style={{ ...s.btn(false), flex: 1, padding: "8px 16px" }}>
                ← Voltar
              </button>
              <button
                disabled={totalSelecionado === 0}
                onClick={confirmarCarregamento}
                style={{ ...s.btn(true), flex: 1, padding: "8px 16px",
                         opacity: totalSelecionado === 0 ? 0.5 : 1,
                         cursor: totalSelecionado === 0 ? "not-allowed" : "pointer" }}>
                ✅ Carregar {totalSelecionado} de {totalDisponivel} item(ns)
              </button>
            </div>
          </>
        )}

        {/* Rodapé só na Etapa 1 */}
        {!templateSelecionado && (
          <div style={{ display: "flex", gap: 10, padding: "14px 22px",
                        borderTop: `1px solid ${C.border}` }}>
            <button onClick={onCancelar}
              style={{ ...s.btn(false), flex: 1, padding: "8px 16px" }}>
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}