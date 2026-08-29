// components/estoque/TelaRetiradaConsumiveis.jsx
import { useState, useEffect, useRef } from 'react';
import apiService from '../../services/apiService';

const fmtD = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  return isNaN(date) ? "—" : date.toLocaleDateString("pt-BR");
};

export default function TelaRetiradaConsumiveis({ C, s, fmtD, fmtBRL }) {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState('');
  const [retirando, setRetirando] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const inputRef = useRef(null);
  const [minhasSolicitacoes, setMinhasSolicitacoes] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");

  // No TelaRetiradaConsumiveis.jsx
  const carregarSolicitacoes = async () => {
    try {
      // 🔥 Pegue o ID do usuário logado do localStorage (ou de onde você salva)
      const user = JSON.parse(localStorage.getItem('usuario'));
      const userId = user?.id; // ou user?.user_id
      
      if (!userId) {
        console.warn('Usuário não encontrado no localStorage');
        return;
      }

      // Passe o ID na URL
    const data = await apiService.get(`/estoque/solicitacoes/minhas-solicitacoes?userId=${userId}`);      setMinhasSolicitacoes(data || []);
    } catch (err) {
      console.error('Erro ao carregar solicitações:', err);
    }
  };

  // Carregar itens de consumo
  useEffect(() => {
    carregarItens();
    carregarSolicitacoes();  
  }, []);

  const solicitacoesFiltradas = minhasSolicitacoes.filter(sol => {
    // Filtro por status
    const matchStatus = filtroStatus === "todos" || sol.status === filtroStatus;
    
    // Filtro por texto (nome do item, motivo ou quantidade)
    const termo = searchTerm.toLowerCase();
    const matchSearch = !termo || 
      (sol.item_nome && sol.item_nome.toLowerCase().includes(termo)) || 
      (sol.motivo && sol.motivo.toLowerCase().includes(termo)) ||
      (sol.quantidade && String(sol.quantidade).includes(termo));

    return matchStatus && matchSearch;
  });

  const carregarItens = async () => {
    try {
      const data = await apiService.get('/estoque/itens');
      setItens(data || []);
    } catch (err) {
      console.error('Erro ao carregar itens:', err);
    } finally {
      setLoading(false);
    }
  };

  // Buscar sugestões ao digitar
  useEffect(() => {
    if (busca.length < 2) {
      setSugestoes([]);
      setShowSugestoes(false);
      return;
    }

    const termo = busca.toLowerCase();
    const filtrados = itens
      .filter(item => 
        item.ativo !== false &&
        (item.nome.toLowerCase().includes(termo) ||
         item.sku?.toLowerCase().includes(termo))
      )
      .slice(0, 8);
    setSugestoes(filtrados);
    setShowSugestoes(filtrados.length > 0);
  }, [busca, itens]);

  // Selecionar um item
  const selecionarItem = (item) => {
    setItemSelecionado(item);
    setBusca(item.nome);
    setShowSugestoes(false);
  };

  // Fechar sugestões ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (inputRef.current && !inputRef.current.contains(e.target)) {
        setShowSugestoes(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Realizar retirada
  const realizarRetirada = async () => {
    if (!itemSelecionado) {
      setMensagem({ tipo: 'erro', texto: 'Selecione um item' });
      return;
    }

    const qtd = parseFloat(quantidade);
    if (!qtd || qtd <= 0) {
      setMensagem({ tipo: 'erro', texto: 'Informe uma quantidade válida' });
      return;
    }

    if (qtd > (itemSelecionado.saldo_atual || 0)) {
      setMensagem({ tipo: 'erro', texto: `Saldo insuficiente. Disponível: ${itemSelecionado.saldo_atual} ${itemSelecionado.unidade_medida || 'UN'}` });
      return;
    }

    if (!motivo.trim()) {
      setMensagem({ tipo: 'erro', texto: 'Informe o motivo da retirada' });
      return;
    }

    setRetirando(true);
    setMensagem(null);

    try {
    const response = await apiService.post('/estoque/movimentacoes', {
      item_consumo_id: itemSelecionado.id,
      tipo: 'saida',
      quantidade: qtd,
      observacao: motivo
    });

    // 🔥 VERIFICA SE É UMA SOLICITAÇÃO (APROVAÇÃO) OU MOVIMENTAÇÃO DIRETA
    if (response.status === 'pendente') {
      setMensagem({ 
        tipo: 'sucesso', 
        texto: `✅ Solicitação de retirada enviada para aprovação! ID: ${response.solicitacao_id}` 
      });
    } else {
      setMensagem({ 
        tipo: 'sucesso', 
        texto: `✅ Retirada realizada com sucesso! Novo saldo: ${response.novo_saldo.toFixed(2)} ${itemSelecionado.unidade_medida || 'UN'}` 
      });
    }

    // Limpar formulário
    setBusca('');
    setItemSelecionado(null);
    setQuantidade('');
    setMotivo('');
    
    // Recarregar itens
    carregarItens();

  } catch (err) {
    setMensagem({ tipo: 'erro', texto: '❌ Erro ao realizar retirada: ' + err.message });
  } finally {
    setRetirando(false);
  }
};

  if (loading) return <div style={{ padding: 20, color: C.muted }}>Carregando...</div>;

  return (
    <div style={{ padding: '22px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em' }}>ESTOQUE</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Retirada de Consumíveis</div>
        </div>
        <div style={{ fontSize: 12, color: C.muted }}>
          Saldo total: {itens.reduce((s, i) => s + (i.saldo_atual || 0), 0).toFixed(2)} unidades
        </div>
      </div>

      {/* MENSAGEM DE FEEDBACK */}
      {mensagem && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 16,
          background: mensagem.tipo === 'sucesso' ? '#0f2f1a' : '#3f0f0f',
          border: `1px solid ${mensagem.tipo === 'sucesso' ? C.success : C.danger}`,
          color: mensagem.tipo === 'sucesso' ? C.success : C.danger,
          fontSize: 13
        }}>
          {mensagem.texto}
        </div>
      )}

      <div style={{ ...s.card, padding: '24px', maxWidth: 520, margin: '0 auto' }}>
        {/* CAMPO DE BUSCA COM AUTOCOMPLETE */}
        <div style={{ marginBottom: 16, position: 'relative' }} ref={inputRef}>
          <label style={s.label}>ITEM *</label>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onFocus={() => {
              if (sugestoes.length > 0) setShowSugestoes(true);
            }}
            placeholder="Digite o nome ou SKU do item..."
            style={s.input}
            autoComplete="off"
          />
          {showSugestoes && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              zIndex: 100,
              maxHeight: 200,
              overflowY: 'auto',
              marginTop: 4,
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
            }}>
              {sugestoes.map(item => (
                <div
                  key={item.id}
                  onClick={() => selecionarItem(item)}
                  style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    borderBottom: `1px solid ${C.border}22`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#1a2233'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <div style={{ fontSize: 13, color: C.text }}>{item.nome}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{item.sku || '—'} · {item.localizacao || 'Sem local'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{item.saldo_atual || 0} {item.unidade_medida || 'UN'}</div>
                    <div style={{ fontSize: 9, color: C.muted }}>disponível</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* EXIBIÇÃO DO ITEM SELECIONADO */}
        {itemSelecionado && (
          <div style={{
            background: C.bg,
            borderRadius: 6,
            padding: '12px 16px',
            marginBottom: 16,
            border: `1px solid ${C.accent}44`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{itemSelecionado.nome}</div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  SKU: {itemSelecionado.sku || '—'} · {itemSelecionado.localizacao || 'Sem local'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{itemSelecionado.saldo_atual || 0}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{itemSelecionado.unidade_medida || 'UN'} disponível</div>
              </div>
            </div>
          </div>
        )}

        {/* QUANTIDADE */}
        <div style={{ marginBottom: 16 }}>
          <label style={s.label}>QUANTIDADE *</label>
          <input
            type="number"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            placeholder="Ex: 5"
            style={s.input}
            min="0.01"
            step="0.01"
            disabled={!itemSelecionado}
          />
        </div>

        {/* MOTIVO */}
        <div style={{ marginBottom: 16 }}>
          <label style={s.label}>MOTIVO DA RETIRADA *</label>
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: Manutenção preventiva, Uso diário, etc."
            style={s.input}
            disabled={!itemSelecionado}
          />
        </div>

        {/* BOTÃO RETIRAR */}
        <button
          onClick={realizarRetirada}
          disabled={!itemSelecionado || !quantidade || !motivo || retirando}
          style={{
            ...s.btn(true),
            width: '100%',
            padding: '12px',
            fontSize: 15,
            fontWeight: 600,
            background: (itemSelecionado && quantidade && motivo && !retirando) ? C.accent : C.surface,
            opacity: (itemSelecionado && quantidade && motivo && !retirando) ? 1 : 0.5,
            cursor: (itemSelecionado && quantidade && motivo && !retirando) ? 'pointer' : 'not-allowed'
          }}
        >
          {retirando ? '⏳ Processando...' : '📤 Retirar do Estoque'}
        </button>
      </div>

      {/* HISTÓRICO COM FILTROS E BUSCA */}
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: 14,
          paddingTop: 20,
          borderTop: `1px solid ${C.border}`
        }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em' }}>
            📋 HISTÓRICO DE RETIRADAS
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            {solicitacoesFiltradas.length} registro(s)
          </div>
        </div>

        {/* Botões de filtro (Estilo Menu) */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {[
            { id: 'pendente', label: '⏳ Pendentes' },
            { id: 'rejeitado', label: '❌ Rejeitadas' },
            { id: 'aprovado', label: '✅ Aprovadas' },
            { id: 'todos', label: '📂 Todas' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFiltroStatus(f.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: `1px solid ${filtroStatus === f.id ? C.accent : C.border}`,
                background: filtroStatus === f.id ? '#1e2a3f' : 'transparent',
                color: filtroStatus === f.id ? C.accent : C.muted,
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Campo de busca */}
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="🔍 Pesquisar por item, motivo ou quantidade..."
          style={{ ...s.input, marginBottom: 14 }}
        />

        {/* Lista filtrada */}
        {solicitacoesFiltradas.length === 0 && (
          <div style={{ ...s.card, padding: 24, textAlign: 'center', color: C.muted, fontSize: 13 }}>
            Nenhuma solicitação encontrada com esses filtros.
          </div>
        )}

        {solicitacoesFiltradas.map(sol => {
          const statusCfg = {
            pendente: { l: "⏳ Pendente", c: "#f59e0b" },
            aprovado: { l: "✅ Aprovado", c: "#22c55e" },
            rejeitado: { l: "❌ Rejeitado", c: "#ef4444" },
          }[sol.status] || { l: sol.status, c: C.muted };

          return (
            <div key={sol.id} style={{ 
              ...s.card, 
              padding: '14px 16px', 
              marginBottom: 10,
              borderLeft: `3px solid ${statusCfg.c}` 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{sol.item_nome}</div>
                <span style={{ 
                  ...s.tag(statusCfg.c), 
                  fontSize: 13, 
                  padding: '4px 10px',
                  fontWeight: 700,
                  borderRadius: 6
                }}>
                  {statusCfg.l}
                </span>
              </div>
              
              <div style={{ fontSize: 11, color: C.muted }}>
                Qtd: {sol.quantidade} {sol.unidade_medida || 'UN'} · Solicitado em {fmtD(sol.criado_em)}
              </div>

              {sol.solicitante_nome && (
                <div style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>
                  Solicitado por: <strong style={{ color: C.text }}>{sol.solicitante_nome}</strong>
                </div>
              )}
              
              {sol.motivo && (
                <div style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>Motivo: "{sol.motivo}"</div>
              )}

              {sol.status === 'rejeitado' && sol.observacao_rejeicao && (
                <div style={{ 
                  marginTop: 8, 
                  padding: '6px 10px', 
                  background: '#2d1515', 
                  borderRadius: 5, 
                  fontSize: 11, 
                  color: '#ef4444',
                  border: '1px solid #ef444433'
                }}>
                  <strong>Motivo da rejeição:</strong> {sol.observacao_rejeicao}
                </div>
              )}

              {sol.status === 'aprovado' && (sol.aprovado_nome || sol.aprovador_nome) && (
                <div style={{ marginTop: 6, fontSize: 11, color: C.muted }}>
                  Aprovado por: <strong style={{ color: C.text }}>{sol.aprovado_nome || sol.aprovador_nome}</strong>
                </div>
              )}

              {sol.status === 'rejeitado' && (sol.aprovado_nome || sol.rejeitado_nome) && (
                <div style={{ marginTop: 6, fontSize: 11, color: C.muted }}>
                  Rejeitado por: <strong style={{ color: C.text }}>{sol.aprovado_nome || sol.rejeitado_nome}</strong>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}