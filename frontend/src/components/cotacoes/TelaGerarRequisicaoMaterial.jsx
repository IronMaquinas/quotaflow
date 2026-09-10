// components/cotacoes/TelaGerarRequisicaoMaterial.jsx
//
// Fase C da separação OS / RM / RC (ver decisão registrada no projeto):
// tela independente de "fila de compras" — lista toda OS que tem pelo
// menos 1 material ainda sem Requisição de Material (RM) gerada, e deixa
// o comprador revisar item a item (com o saldo de estoque AO VIVO, não um
// status salvo — status_estoque nunca é persistido em chamado_itens, é só
// um cálculo feito na hora em que a OS foi montada) antes de confirmar
// quais entram na RM e em que quantidade.
//
// Não decide nada sozinha: o comprador sempre revisa e confirma
// manualmente (aprovação automática por configuração é possível no
// futuro, mas ainda não existe — ver pendências do projeto).

import { useState, useEffect, useCallback } from "react";
import apiService from "../../services/apiService";

export default function TelaGerarRequisicaoMaterial({ C, s, fmtD }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [osComPendencia, setOsComPendencia] = useState([]);
  const [busca, setBusca] = useState("");
  const [osExpandidaId, setOsExpandidaId] = useState(null);

  // Estado do item dentro da OS expandida: { [itemId]: { selecionado, quantidade, saldo, carregandoSaldo } }
  const [estadoItens, setEstadoItens] = useState({});
  const [gerando, setGerando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  const carregarFila = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const data = await apiService.get("/cotacoes/chamados?tipo_documento=os");
      const lista = (data || [])
        .map((os) => {
          const pendentes = (os.itens || []).filter(
            (it) => it.tipo === "material" && it.status === "ativo" && !it.requisicao_material
          );
          return { ...os, _pendentes: pendentes };
        })
        .filter((os) => os._pendentes.length > 0)
        // Urgência alta primeiro, depois OS mais antiga primeiro (fila de trabalho).
        .sort((a, b) => {
          const peso = { alta: 0, media: 1, baixa: 2 };
          const pa = peso[a.urgencia] ?? 1;
          const pb = peso[b.urgencia] ?? 1;
          if (pa !== pb) return pa - pb;
          return new Date(a.aberto_em || 0) - new Date(b.aberto_em || 0);
        });
      setOsComPendencia(lista);
    } catch (err) {
      console.error("❌ Erro ao carregar fila de requisições:", err);
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarFila();
  }, [carregarFila]);

  const osFiltradas = osComPendencia.filter((os) => {
    if (!busca.trim()) return true;
    const termo = busca.toLowerCase();
    return (
      (os.numero || "").toLowerCase().includes(termo) ||
      (os.servico_nome || "").toLowerCase().includes(termo) ||
      (os.descricao || "").toLowerCase().includes(termo)
    );
  });

  // Ao expandir uma OS, busca o saldo ao vivo de cada item com item_catalogo_id
  // (item sem catálogo não tem como verificar saldo — sempre precisa comprar).
  const expandirOS = async (os) => {
    if (osExpandidaId === os.id) {
      setOsExpandidaId(null);
      return;
    }
    setOsExpandidaId(os.id);
    setMensagem(null);

    // Item sem item_catalogo_id (nunca teve vínculo de catálogo) já nasce
    // pré-selecionado com a quantidade toda planejada — não tem como checar
    // estoque, então a única opção segura é comprar tudo. Item COM
    // item_catalogo_id fica com carregandoSaldo=true até a checagem
    // resolver (sucesso OU 404 "sem_estoque" — ver abaixo).
    const novoEstado = {};
    os._pendentes.forEach((item) => {
      const temCatalogo = !!item.item_catalogo_id;
      novoEstado[item.id] = {
        selecionado: !temCatalogo,
        quantidade: item.quantidade || 1,
        saldo: null,
        carregandoSaldo: temCatalogo,
      };
    });
    setEstadoItens((prev) => ({ ...prev, ...novoEstado }));

    for (const item of os._pendentes) {
      if (!item.item_catalogo_id) continue;
      try {
        const saldo = await apiService.get(`/estoque/saldo?item_catalogo_id=${item.item_catalogo_id}`);
        const disponivel = saldo?.disponivel ?? null;
        const sugerida =
          disponivel !== null ? Math.max((item.quantidade || 0) - disponivel, 0) : item.quantidade || 1;
        const quantidadeFinal = Math.min(Math.max(sugerida, sugerida > 0 ? 1 : 0), item.quantidade || 1);

        setEstadoItens((prev) => ({
          ...prev,
          [item.id]: {
            ...prev[item.id],
            saldo,
            carregandoSaldo: false,
            quantidade: quantidadeFinal || item.quantidade || 1,
            // Só pré-seleciona se sobrar algo pra comprar depois de olhar o estoque.
            selecionado: quantidadeFinal > 0,
          },
        }));
      } catch (err) {
        // 404 aqui é o caso normal "peça de catálogo sem contrapartida
        // física no almoxarifado" (ver GET /estoque/saldo) — NÃO é uma
        // falha de rede/servidor, é a mesma situação de "sem_estoque" que
        // um item sem item_catalogo_id já trata acima: pré-seleciona com a
        // quantidade toda, porque não tem como comprar "parte" de algo que
        // o sistema não consegue verificar. Erro de verdade (rede, 500)
        // ainda cai aqui, mas a UI não distingue os dois — tratar como
        // "sem info de estoque, assume que precisa comprar tudo" é seguro
        // nos dois casos (pior cenário é sugerir comprar demais, não de
        // menos).
        console.error(`❌ Erro ao buscar saldo do item ${item.item_catalogo_id}:`, err);
        setEstadoItens((prev) => ({
          ...prev,
          [item.id]: {
            ...prev[item.id],
            carregandoSaldo: false,
            saldo: { semEstoque: true },
            quantidade: item.quantidade || 1,
            selecionado: true,
          },
        }));
      }
    }
  };

  const toggleSelecionado = (itemId) => {
    setEstadoItens((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], selecionado: !prev[itemId]?.selecionado },
    }));
  };

  const atualizarQuantidade = (itemId, valor) => {
    setEstadoItens((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantidade: valor },
    }));
  };

  const gerarRM = async (os) => {
    const itensSelecionados = os._pendentes
      .filter((item) => estadoItens[item.id]?.selecionado)
      .map((item) => ({
        chamado_item_id: item.id,
        quantidade: parseInt(estadoItens[item.id]?.quantidade) || 0,
      }))
      .filter((it) => it.quantidade > 0);

    if (itensSelecionados.length === 0) {
      setMensagem({ tipo: "erro", texto: "Selecione ao menos 1 item com quantidade válida." });
      return;
    }

    setGerando(true);
    setMensagem(null);
    try {
      const resposta = await apiService.post(`/cotacoes/chamados/${os.id}/gerar-requisicao-material`, {
        itens: itensSelecionados,
      });
      setMensagem({
        tipo: "sucesso",
        texto: `✅ ${resposta.requisicao_material?.numero || "RM"} gerada com ${itensSelecionados.length} ${
          itensSelecionados.length === 1 ? "item" : "itens"
        }.`,
      });
      setOsExpandidaId(null);
      await carregarFila();
    } catch (err) {
      console.error("❌ Erro ao gerar RM:", err);
      setMensagem({ tipo: "erro", texto: "❌ Erro ao gerar RM: " + err.message });
    } finally {
      setGerando(false);
    }
  };

  if (carregando) {
    return <div style={{ padding: 20, color: C.muted }}>Carregando fila de requisições...</div>;
  }

  return (
    <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>COMPRAS</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>Gerar Requisição de Material</div>
        </div>
        <div style={{ fontSize: 12, color: C.muted }}>
          {osComPendencia.length} OS com material pendente
        </div>
      </div>

      {erro && (
        <div style={{ ...s.card, padding: "12px 16px", marginBottom: 16, border: `1px solid ${C.danger || "#ef4444"}`, color: C.danger || "#ef4444", fontSize: 13 }}>
          Erro ao carregar: {erro}
        </div>
      )}

      {mensagem && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            marginBottom: 16,
            background: mensagem.tipo === "sucesso" ? "#0f2f1a" : "#3f0f0f",
            border: `1px solid ${mensagem.tipo === "sucesso" ? C.success : C.danger}`,
            color: mensagem.tipo === "sucesso" ? C.success : C.danger,
            fontSize: 13,
          }}
        >
          {mensagem.texto}
        </div>
      )}

      <input
        type="text"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="🔍 Pesquisar por número da OS ou descrição..."
        style={{ ...s.input, width: "100%", marginBottom: 16 }}
      />

      {osFiltradas.length === 0 && (
        <div style={{ ...s.card, padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>
            Nenhuma OS com material pendente
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>
            Toda OS com material a comprar já teve sua RM gerada.
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {osFiltradas.map((os) => {
          const expandida = osExpandidaId === os.id;
          const urgenciaCfg = { alta: { c: "#ef4444", l: "Alta" }, media: { c: "#f59e0b", l: "Média" }, baixa: { c: "#22c55e", l: "Baixa" } };
          const uCfg = urgenciaCfg[os.urgencia] || urgenciaCfg.media;

          return (
            <div key={os.id} style={{ ...s.card, overflow: "hidden" }}>
              <div
                onClick={() => expandirOS(os)}
                style={{
                  padding: "14px 18px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderLeft: `3px solid ${uCfg.c}`,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>{os.numero}</div>
                  <div style={{ fontSize: 13, color: C.text, marginTop: 2 }}>
                    {os.servico_nome || os.descricao || "Sem descrição"}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    Aberta em {fmtD(os.aberto_em)} · Urgência: <span style={{ color: uCfg.c, fontWeight: 600 }}>{uCfg.l}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ ...s.tag(C.warn || "#f59e0b"), fontSize: 11, padding: "4px 10px" }}>
                    {os._pendentes.length} {os._pendentes.length === 1 ? "item pendente" : "itens pendentes"}
                  </span>
                  <span style={{ color: C.muted, fontSize: 14 }}>{expandida ? "▲" : "▼"}</span>
                </div>
              </div>

              {expandida && (
                <div style={{ padding: "0 18px 18px", borderTop: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                    {os._pendentes.map((item) => {
                      const est = estadoItens[item.id] || {};
                      const disponivel = est.saldo?.disponivel;
                      return (
                        <div
                          key={item.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "10px 12px",
                            background: est.selecionado ? C.accent + "11" : C.bg,
                            border: `1px solid ${est.selecionado ? C.accent : C.border}44`,
                            borderRadius: 6,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={!!est.selecionado}
                            onChange={() => toggleSelecionado(item.id)}
                            style={{ cursor: "pointer", width: 16, height: 16 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.item_nome}</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                              Planejado na OS: {item.quantidade} {item.unidade_medida || "UN"}
                              {item.item_catalogo_id ? (
                                est.carregandoSaldo ? (
                                  <> · verificando saldo...</>
                                ) : est.saldo?.semEstoque ? (
                                  <> · sem controle de estoque no almoxarifado (compra integral sugerida)</>
                                ) : disponivel !== undefined ? (
                                  <>
                                    {" "}
                                    · Disponível em estoque: <strong style={{ color: C.text }}>{disponivel}</strong>
                                  </>
                                ) : null
                              ) : (
                                <> · sem cadastro no catálogo (compra integral sugerida)</>
                              )}
                            </div>
                          </div>
                          <div>
                            <input
                              type="number"
                              min="1"
                              max={item.quantidade}
                              value={est.quantidade ?? ""}
                              onChange={(e) => atualizarQuantidade(item.id, e.target.value)}
                              disabled={!est.selecionado}
                              style={{ ...s.input, width: 80, fontSize: 12, padding: "6px 8px", opacity: est.selecionado ? 1 : 0.5 }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                    <button
                      onClick={() => gerarRM(os)}
                      disabled={gerando}
                      style={{
                        ...s.btn(true, C.accent),
                        padding: "10px 18px",
                        fontSize: 12,
                        opacity: gerando ? 0.5 : 1,
                      }}
                    >
                      {gerando ? "Gerando..." : "📦 Gerar Requisição de Material"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
