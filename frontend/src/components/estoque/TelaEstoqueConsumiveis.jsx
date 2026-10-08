// components/estoque/TelaEstoqueConsumiveis.jsx
import { useState, useEffect } from 'react';
import apiService from '../../services/apiService';

export default function TelaEstoqueConsumiveis({ C, s, fmtBRL, fmtD }) {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [modal, setModal] = useState(null);
  const [modalConfig, setModalConfig] = useState(false);
  const [config, setConfig] = useState({ fluxo_aprovacao: false, notificar_recompra: true });
  const [form, setForm] = useState({
    nome: '',
    sku: '',
    numero_serie: '',
    unidade_medida: 'UN',
    saldo_atual: 0,
    limite_inferior_controle: '',
    limite_recompra: '',
    lote_minimo_compra: '',
    quantidade_lotes_automatico: 1,
    fornecedor_preferencial_id: '',
    localizacao: '',
    fabricante: '',
    lote: '',
    validade: '',
    codigo_barras: '',
    ativo: true
  });
  // M4.4-etapa-6: estado do modal de transferência entre endereços.
  const [itemTransferindo, setItemTransferindo] = useState(null);
  // M4.4-etapa-6d: painel lateral (master-detail). Guarda o item clicado
  // na lista — null = painel fechado.
  const [itemSelecionado, setItemSelecionado] = useState(null);
  // M4.4-etapa-8: hover da linha (feedback visual de "clicável")
  const [hoverId, setHoverId] = useState(null);
  // Reseta abas e trajetória quando troca o item selecionado
  useEffect(() => {
    if (itemSelecionado) {
      setAbaDetalhe('enderecos');
      setTrajetoria(null);
      setFiltroTrajetoria('todos');
    }
  }, [itemSelecionado?.id]);
  // M4.4-etapa-8: modal de detalhe com abas (Endereços | Trajetória)
  const [abaDetalhe, setAbaDetalhe] = useState('enderecos');
  const [trajetoria, setTrajetoria] = useState(null);
  const [carregandoTrajetoria, setCarregandoTrajetoria] = useState(false);
  const [filtroTrajetoria, setFiltroTrajetoria] = useState('todos');
  const [formTransf, setFormTransf] = useState({
    endereco_origem: '',
    endereco_destino: '',
    quantidade: '',
    observacao: '',
  });
  const [salvandoTransferencia, setSalvandoTransferencia] = useState(false);
  // M4.4-etapa-6f: toast in-place (substitui alert() em ações de
  // transferência — não bloqueia, some sozinho).
  const [toast, setToast] = useState(null);
  // M4.4-etapa-6g: modal de gerenciar endereços (cadastro + edição).
  const [modalEnderecos, setModalEnderecos] = useState(false);
  const [enderecosLista, setEnderecosLista] = useState([]);
  const [carregandoEnderecos, setCarregandoEnderecos] = useState(false);
  // `null` = lista; objeto = form aberto (criar/editar)
  const [editandoEndereco, setEditandoEndereco] = useState(null);
  const [salvandoEndereco, setSalvandoEndereco] = useState(false);
  // M4.4-etapa-6g: busca na lista de endereços (código ou localização)
  const [buscaEndereco, setBuscaEndereco] = useState('');

  // ─── CARREGAR ITENS ──────────────────────────────────────────
  const carregarItens = async () => {
    try {
      const data = await apiService.get('/estoque/itens');
      setItens(data || []);
      return data || [];   // M4.4-etapa-6e: retorna pra quem precisar
    } catch (err) {
      console.error('Erro ao carregar itens:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // ─── CARREGAR CONFIGURAÇÕES ─────────────────────────────────
  const carregarConfig = async () => {
    try {
      const data = await apiService.get('/estoque/configuracoes');
      setConfig(data);
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
    }
  };

  useEffect(() => {
    carregarItens();
    carregarConfig();
  }, []);

  // M4.4-etapa-8: reseta abas e trajetória quando troca o item selecionado.
  useEffect(() => {
    if (itemSelecionado) {
      setAbaDetalhe('enderecos');
      setTrajetoria(null);
      setFiltroTrajetoria('todos');
    }
  }, [itemSelecionado?.id]);

  // M4.4-etapa-6f: limpa o toast depois de 4s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ─── SALVAR CONFIGURAÇÕES ───────────────────────────────────
const salvarConfig = async () => {
  try {
    await apiService.put('/estoque/configuracoes', {
      fluxo_aprovacao: config.fluxo_aprovacao,
      notificar_recompra: config.notificar_recompra
    });
    
    // 🔥 RECARREGA A CONFIGURAÇÃO DO BANCO PARA GARANTIR QUE O ESTADO ESTÁ SINCRONIZADO
    const data = await apiService.get('/estoque/configuracoes');
    setConfig(data);
    
    setModalConfig(false);
    alert('Configurações salvas!');
  } catch (err) {
    alert('Erro ao salvar configurações: ' + err.message);
  }
};

  // ─── M4.4-etapa-6g: GERENCIAR ENDEREÇOS ─────────────────────
  const carregarEnderecos = async () => {
    setCarregandoEnderecos(true);
    try {
      const lista = await apiService.get('/estoque/enderecos?incluir_inativos=true');
      setEnderecosLista(lista || []);
      return lista || [];
    } catch (err) {
      setToast({ tipo: 'error', texto: err.message || 'Erro ao carregar endereços' });
      return [];
    } finally {
      setCarregandoEnderecos(false);
    }
  };

  const abrirModalEnderecos = async () => {
    setModalConfig(false);           // fecha Configurações
    setModalEnderecos(true);
    setEditandoEndereco(null);       // abre na lista
    await carregarEnderecos();
  };

  const fecharModalEnderecos = () => {
    setModalEnderecos(false);
    setEditandoEndereco(null);
    setBuscaEndereco('');
  };

  const abrirFormEndereco = (endereco = null) => {
    if (endereco) {
      setEditandoEndereco({
        id: endereco.id,
        codigo: endereco.codigo,        // imutável — só leitura
        descricao: endereco.descricao || '',
        tipo: endereco.tipo || 'armazem',
        ativo: endereco.ativo !== false,
        _novo: false,
      });
    } else {
      setEditandoEndereco({
        id: null,
        codigo: '',
        descricao: '',
        tipo: 'armazem',
        ativo: true,
        _novo: true,
      });
    }
  };

  const fecharFormEndereco = () => {
    setEditandoEndereco(null);
  };

  const salvarEndereco = async () => {
    if (!editandoEndereco) return;

    const { _novo, id, codigo, descricao, tipo, ativo } = editandoEndereco;

    if (_novo) {
      const codigoNorm = String(codigo || '').trim().toUpperCase();
      if (!codigoNorm) {
        setToast({ tipo: 'error', texto: 'Código é obrigatório' });
        return;
      }
      if (!/^[A-Z0-9_-]{1,30}$/.test(codigoNorm)) {
        setToast({ tipo: 'error', texto: 'Código: até 30 caracteres (letras maiúsculas, números, _ ou -)' });
        return;
      }
    }

    setSalvandoEndereco(true);
    try {
      if (_novo) {
        await apiService.post('/estoque/enderecos', {
          codigo: String(codigo).trim().toUpperCase(),
          descricao: String(descricao || '').trim(),
          tipo,
        });
        setToast({ tipo: 'success', texto: `Endereço "${String(codigo).trim().toUpperCase()}" criado.` });
      } else {
        await apiService.put(`/estoque/enderecos/${id}`, {
          descricao: String(descricao || '').trim(),
          tipo,
          ativo,
        });
        setToast({ tipo: 'success', texto: 'Endereço atualizado.' });
      }
      setEditandoEndereco(null);
      await carregarEnderecos();
    } catch (err) {
      const msg = err.body?.erro || err.message || 'Erro ao salvar endereço';
      setToast({ tipo: 'error', texto: msg });
    } finally {
      setSalvandoEndereco(false);
    }
  };

  // M4.4-etapa-8: carrega a trajetória do item selecionado.
  const carregarTrajetoria = async (itemId) => {
    setCarregandoTrajetoria(true);
    try {
      const resp = await apiService.get(`/estoque/movimentacoes/item/${itemId}/trajetoria`);
      setTrajetoria(resp || null);
    } catch (err) {
      setToast({ tipo: 'error', texto: err.message || 'Erro ao carregar trajetória' });
      setTrajetoria(null);
    } finally {
      setCarregandoTrajetoria(false);
    }
  };

  // ─── SALVAR ITEM ─────────────────────────────────────────────
    const salvarItem = async () => {
    if (!form.nome) {
      alert('Nome é obrigatório');
      return;
    }

    try {
      // 🔥 CORREÇÃO 1: Adicione os campos que estavam faltando
      const dadosParaSalvar = {
        ...form,
        ativo: form.ativo ? true : false, // 🔥 Envia o toggle corretamente
        saldo_atual: form.saldo_atual === '' ? 0 : parseFloat(form.saldo_atual),
        limite_inferior_controle: form.limite_inferior_controle === '' ? null : parseFloat(form.limite_inferior_controle),
        limite_recompra: form.limite_recompra === '' ? null : parseFloat(form.limite_recompra),
        lote_minimo_compra: form.lote_minimo_compra === '' ? null : parseFloat(form.lote_minimo_compra),
        quantidade_lotes_automatico: form.quantidade_lotes_automatico === '' ? null : parseInt(form.quantidade_lotes_automatico),
        fornecedor_preferencial_id: form.fornecedor_preferencial_id === '' ? null : parseInt(form.fornecedor_preferencial_id),
        codigo_barras: form.codigo_barras || null // 🔥 Envia o código de barras
      };

      if (modal === 'novo') {
        await apiService.post('/estoque/itens', dadosParaSalvar);
      } else {
        await apiService.put(`/estoque/itens/${modal}`, dadosParaSalvar);
      }
      setModal(null);
      setForm({
        nome: '',
        sku: '',
        numero_serie: '',
        unidade_medida: 'UN',
        saldo_atual: 0,
        limite_inferior_controle: '',
        limite_recompra: '',
        lote_minimo_compra: '',
        quantidade_lotes_automatico: 1,
        fornecedor_preferencial_id: '',
        localizacao: '',
        fabricante: '',
        lote: '',
        validade: '',
        codigo_barras: '',
        ativo: true
      });
      carregarItens();
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    }
  };

  const abrirEditar = (item) => {
    setForm({
      nome: item.nome || '',
      sku: item.sku || '',
      numero_serie: item.numero_serie || '',
      unidade_medida: item.unidade_medida || 'UN',
      saldo_atual: item.saldo_atual || 0,
      limite_inferior_controle: item.limite_inferior_controle || '',
      limite_recompra: item.limite_recompra || '',
      lote_minimo_compra: item.lote_minimo_compra || '',
      quantidade_lotes_automatico: item.quantidade_lotes_automatico || 1,
      fornecedor_preferencial_id: item.fornecedor_preferencial_id || '',
      localizacao: item.localizacao || '',
      fabricante: item.fabricante || '',
      lote: item.lote || '',
      validade: item.validade || '',
      codigo_barras: item.codigo_barras || '',
      ativo: item.ativo !== false
    });
    setModal(item.id);
  };

  // M4.4-etapa-6f: `enderecoSugerido` (opcional) pré-seleciona a origem
  // quando o usuário clica no 🚚 de um endereço específico. Sem isso,
  // a origem era sempre o endereço com mais saldo — o que confundia
  // quem clicou no 🚚 do A01 e viu o modal abrir com B02 selecionado.
  const abrirTransferir = (item, enderecoSugerido = null) => {
    const enderecos = item.enderecos || [];
    const origemInicial = enderecoSugerido && enderecos.find(e => e.endereco === enderecoSugerido)
      ? enderecoSugerido
      : (enderecos[0]?.endereco || '');
    setItemTransferindo(item);
    setFormTransf({
      endereco_origem: origemInicial,
      endereco_destino: '',
      quantidade: '',
      observacao: '',
    });
  };

  const fecharTransferir = () => {
    setItemTransferindo(null);
    setFormTransf({ endereco_origem: '', endereco_destino: '', quantidade: '', observacao: '' });
  };

  const executarTransferencia = async () => {
    if (!itemTransferindo) return;

    const enderecoOrigem = formTransf.endereco_origem;
    const enderecoDestino = formTransf.endereco_destino.trim();
    const qtd = parseFloat(formTransf.quantidade);

    if (!enderecoOrigem) return alert('Selecione o endereço de origem.');
    if (!enderecoDestino) return alert('Informe o endereço de destino.');
    if (enderecoDestino === enderecoOrigem) return alert('Destino deve ser diferente da origem.');
    if (!qtd || qtd <= 0) return alert('Quantidade deve ser maior que zero.');

    setSalvandoTransferencia(true);
    try {
      const resp = await apiService.post('/estoque/movimentacoes/transferir', {
        item_consumo_id: itemTransferindo.id,
        quantidade: qtd,
        endereco_origem: enderecoOrigem,
        endereco_destino: enderecoDestino,
        observacao: formTransf.observacao.trim() || null,
      });
      setToast({ tipo: 'success', texto: `${resp.mensagem} (${resp.numero_movimento})` });
      const idItemTransferido = itemTransferindo.id;
      fecharTransferir();

      // M4.4-etapa-6e: recarrega a lista e, se o modal de detalhe ainda
      // estiver aberto pro mesmo item, reflete os saldos novos — sem
      // isso, o funcionário vê o saldo velho e acha que não transferiu.
      const listaAtualizada = await carregarItens();
      if (itemSelecionado?.id === idItemTransferido) {
        const fresco = (listaAtualizada || []).find(i => i.id === idItemTransferido);
        if (fresco) setItemSelecionado(fresco);
      }
    } catch (err) {
      // M4.3-al: apiService anexa `.body` no erro — pega a lista de
      // endereços disponíveis se a rota devolveu 400 com metadados.
      const msg = err.body?.erro || err.message || 'Erro ao transferir';
      setToast({ tipo: 'error', texto: msg });
    } finally {
      setSalvandoTransferencia(false);
    }
  };

  const deletarItem = async (id) => {
    if (!confirm('Tem certeza?')) return;
    try {
      await apiService.delete(`/estoque/itens/${id}`);
      carregarItens();
    } catch (err) {
      alert('Erro ao deletar: ' + err.message);
    }
  };

  const getStatus = (item) => {
    const saldo = item.saldo_atual || 0;
    const limite = item.limite_recompra;
    const controle = item.limite_inferior_controle;

    if (!limite && !controle) return { label: 'Sem limite', color: C.muted };
    if (limite && saldo < limite) return { label: '⚠️ CRÍTICO', color: C.danger };
    if (controle && saldo < controle) return { label: '🟡 ATENÇÃO', color: C.warn };
    return { label: '✅ OK', color: C.success };
  };

  // M4.4-etapa-6g: endereços filtrados pela busca (código ou localização)
  const enderecosFiltrados = enderecosLista.filter(e => {
    const q = buscaEndereco.trim().toLowerCase();
    if (!q) return true;
    return (e.codigo || '').toLowerCase().includes(q)
        || (e.descricao || '').toLowerCase().includes(q);
  });

  const itensFiltrados = itens.filter(item => {
    const matchBusca = !busca || 
      item.nome.toLowerCase().includes(busca.toLowerCase()) ||
      item.sku?.toLowerCase().includes(busca.toLowerCase());
    const status = getStatus(item);
    if (filtroStatus === 'critico') return matchBusca && status.color === C.danger;
    if (filtroStatus === 'atencao') return matchBusca && status.color === C.warn;
    if (filtroStatus === 'ok') return matchBusca && status.color === C.success;
    return matchBusca;
  });

  if (loading) return <div style={{ padding: 20, color: C.muted }}>Carregando...</div>;

  // ─── RENDER ──────────────────────────────────────────────────
  return (
    <div style={{ padding: '22px 24px', overflowY: 'auto', height: '100%' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em' }}>ESTOQUE</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Itens de Consumo</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setModalConfig(true)} style={{ ...s.btn(false), padding: '8px 14px', fontSize: 12 }}>
            ⚙️
          </button>
          {/* M4.4-etapa-6g: ação operacional — fica visível, não dentro
              das configurações (o operador usa toda semana pra cadastrar
              endereço novo antes de receber material). */}
          <button
            onClick={abrirModalEnderecos}
            style={{ ...s.btn(false), padding: '8px 14px', fontSize: 12 }}
            title="Gerenciar endereços de estoque"
          >
            📍 Endereços
          </button>
          <button onClick={() => { setModal('novo'); setForm({ ...form, nome: '', sku: '', saldo_atual: 0 }); }} style={{ ...s.btn(true), padding: '9px 18px' }}>
            + Novo Item
          </button>
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar por nome ou SKU..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ ...s.input, flex: 1, minWidth: 200, padding: '8px 12px', fontSize: 12 }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {['todos', 'critico', 'atencao', 'ok'].map(f => (
            <button
              key={f}
              onClick={() => setFiltroStatus(f)}
              style={{
                background: filtroStatus === f ? C.accent : 'transparent',
                border: `1px solid ${filtroStatus === f ? C.accent : C.border}`,
                borderRadius: 6,
                padding: '6px 14px',
                color: filtroStatus === f ? 'white' : C.muted,
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {f === 'todos' ? 'Todos' : f === 'critico' ? '⚠️ Crítico' : f === 'atencao' ? '🟡 Atenção' : '✅ OK'}
            </button>
          ))}
        </div>
      </div>

      {/* TABELA */}
      <div style={{ ...s.card, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 100px 80px', padding: '10px 18px', background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, letterSpacing: '0.08em' }}>
          <span>ITEM / SKU</span>
          <span>SALDO</span>
          <span>LIMITE RECOMPRA</span>
          <span>CONTROLE</span>
          <span>STATUS</span>
          <span></span>
        </div>
        {itensFiltrados.map((item) => {
          const status = getStatus(item);
          const selecionado = itemSelecionado?.id === item.id;
          return (
            <div 
              key={item.id} 
              onClick={() => setItemSelecionado(item)}
              onMouseEnter={() => setHoverId(item.id)}
              onMouseLeave={() => setHoverId(null)}
              style={{ 
                display: 'grid', 
                gridTemplateColumns: '2fr 1fr 1fr 1fr 100px 80px', 
                padding: '13px 18px', 
                borderBottom: `1px solid ${C.border}22`, 
                alignItems: 'center',
                cursor: 'pointer',
                background: selecionado 
                  ? `${C.accent}15` 
                  : hoverId === item.id 
                    ? `${C.accent}20` 
                    : 'transparent',
                borderLeft: selecionado ? `3px solid ${C.accent}` : '3px solid transparent',
                transition: 'background .15s',
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{item.nome}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{item.sku || '—'}</div>
                {/* M4.4-etapa-6: endereços com saldo */}
                {item.enderecos && item.enderecos.length > 0 && (
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 3, fontFamily: "'IBM Plex Mono', monospace" }}>
                    📍 {item.enderecos.map(e => `${e.endereco}: ${e.saldo}`).join(' · ')}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{item.saldo_atual || 0} {item.unidade_medida || 'UN'}</div>
              <div style={{ fontSize: 12, color: C.textSub }}>{item.limite_recompra || '—'}</div>
              <div style={{ fontSize: 12, color: C.textSub }}>{item.limite_inferior_controle || '—'}</div>
              <div><span style={{ ...s.tag(status.color), fontSize: 10 }}>{status.label}</span></div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {/* M4.4-etapa-6: transferir entre endereços — só se tem saldo */}
                {item.enderecos && item.enderecos.length > 0 && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); abrirTransferir(item); }} 
                    title="Transferir entre endereços"
                    style={{ background: 'transparent', border: `1px solid ${C.accent}55`, borderRadius: 5, padding: '4px 8px', color: C.accent, fontSize: 11, cursor: 'pointer' }}
                  >
                    🚚
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); abrirEditar(item); }} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 5, padding: '4px 8px', color: C.muted, fontSize: 11, cursor: 'pointer' }}>✏</button>
                <button onClick={(e) => { e.stopPropagation(); deletarItem(item.id); }} style={{ background: 'transparent', border: `1px solid #ef444433`, borderRadius: 5, padding: '4px 8px', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}>🗑</button>
              </div>
            </div>
          );
        })}
        {itensFiltrados.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Nenhum item cadastrado</div>}
      </div>

            {/* ─── M4.4-etapa-6d: MODAL DE DETALHE DO ITEM ───────────────
          Substituiu o painel lateral — o painel empurrava a tabela
          (que tem 6 colunas) e criava efeito de reflow. O modal mantém
          a lista intacta por baixo. */}
      {itemSelecionado && (
        <div
          onClick={() => setItemSelecionado(null)}
          style={{ position: 'fixed', inset: 0, background: '#00000090',
                   display: 'flex', alignItems: 'center', justifyContent: 'center',
                   zIndex: 300, padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ ...s.card, width: 540, maxWidth: '100%', maxHeight: '85vh',
                     display: 'flex', flexDirection: 'column' }}
          >
            {/* Cabeçalho */}
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{itemSelecionado.nome}</div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
                  {itemSelecionado.sku || '—'} · {itemSelecionado.unidade_medida || 'UN'}
                </div>
              </div>
              <button
                onClick={() => setItemSelecionado(null)}
                style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* M4.4-etapa-8: abas (Endereços | Trajetória) */}
            <div style={{ display: 'flex', gap: 2, padding: '0 22px', borderBottom: `1px solid ${C.border}` }}>
              <button
                onClick={() => setAbaDetalhe('enderecos')}
                style={{
                  background: 'transparent', border: 'none',
                  borderBottom: abaDetalhe === 'enderecos' ? `2px solid ${C.accent}` : '2px solid transparent',
                  color: abaDetalhe === 'enderecos' ? C.text : C.muted,
                  fontSize: 12, fontWeight: abaDetalhe === 'enderecos' ? 600 : 400,
                  cursor: 'pointer', padding: '10px 14px',
                  fontFamily: 'inherit', marginBottom: -1,
                }}
              >
                📍 Endereços
              </button>
              <button
                onClick={() => {
                  setAbaDetalhe('trajetoria');
                  if (!trajetoria && itemSelecionado) carregarTrajetoria(itemSelecionado.id);
                }}
                style={{
                  background: 'transparent', border: 'none',
                  borderBottom: abaDetalhe === 'trajetoria' ? `2px solid ${C.accent}` : '2px solid transparent',
                  color: abaDetalhe === 'trajetoria' ? C.text : C.muted,
                  fontSize: 12, fontWeight: abaDetalhe === 'trajetoria' ? 600 : 400,
                  cursor: 'pointer', padding: '10px 14px',
                  fontFamily: 'inherit', marginBottom: -1,
                }}
              >
                📜 Trajetória
              </button>
            </div>

            {/* Corpo — condicional (endereços OU trajetória) */}
            <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>
              {abaDetalhe === 'enderecos' && (
                <>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>SALDO POR ENDEREÇO</div>

              {(!itemSelecionado.enderecos || itemSelecionado.enderecos.length === 0) ? (
                <div style={{ padding: 24, textAlign: 'center', color: C.muted, fontSize: 12,
                              border: `1px dashed ${C.border}`, borderRadius: 6 }}>
                  📭 Nenhum endereço com saldo
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {itemSelecionado.enderecos.map(e => (
                    <div
                      key={e.endereco}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 14px', borderRadius: 6,
                        background: C.bg, border: `1px solid ${C.border}55`,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: "'IBM Plex Mono', monospace" }}>
                          📍 {e.endereco}
                        </div>
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                          saldo disponível
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>
                          {e.saldo} {itemSelecionado.unidade_medida || 'UN'}
                        </span>
                        <button
                          onClick={() => abrirTransferir(itemSelecionado, e.endereco)}
                          title={`Mover saldo de ${e.endereco}`}
                          style={{
                            background: 'transparent', border: `1px solid ${C.accent}55`,
                            borderRadius: 5, padding: '4px 8px', color: C.accent,
                            fontSize: 11, cursor: 'pointer',
                          }}
                        >
                          🚚
                        </button>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 8, fontSize: 12, color: C.muted, textAlign: 'right' }}>
                    Total: <strong style={{ color: C.text }}>{itemSelecionado.saldo_atual || 0} {itemSelecionado.unidade_medida || 'UN'}</strong>
                  </div>
                </div>
              )}
                </>
              )}

              {/* ─── M4.4-etapa-8: ABA TRAJETÓRIA ─────────────────── */}
              {abaDetalhe === 'trajetoria' && (
                <>
                  {carregandoTrajetoria ? (
                    <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 12 }}>
                      Carregando trajetória...
                    </div>
                  ) : !trajetoria || !trajetoria.eventos || trajetoria.eventos.length === 0 ? (
                    <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 12,
                                  border: `1px dashed ${C.border}`, borderRadius: 6 }}>
                      📭 Nenhuma movimentação registrada para este item
                    </div>
                  ) : (() => {
                    const eventos = trajetoria.eventos;
                    const tipos = [
                      { id: 'todos', label: 'Todos', icon: '📋' },
                      { id: 'entrada', label: 'Entradas', icon: '📥' },
                      { id: 'transferencia', label: 'Transferências', icon: '🚚' },
                      { id: 'saida', label: 'Saídas', icon: '📤' },
                      { id: 'bloqueio', label: 'Bloqueios', icon: '🚫' },
                    ];
                    const contagem = tipos.reduce((acc, t) => {
                      acc[t.id] = t.id === 'todos'
                        ? eventos.length
                        : eventos.filter(e => e.tipo === t.id).length;
                      return acc;
                    }, {});
                    const eventosFiltrados = filtroTrajetoria === 'todos'
                      ? eventos
                      : eventos.filter(e => e.tipo === filtroTrajetoria);

                    const cfgTipo = {
                      entrada:       { icon: '📥', label: 'Entrada',       cor: C.success || '#10b981' },
                      transferencia: { icon: '🚚', label: 'Transferência', cor: '#f59e0b' },
                      saida:         { icon: '📤', label: 'Saída',         cor: C.danger  || '#ef4444' },
                      bloqueio:      { icon: '🚫', label: 'Bloqueio',      cor: C.muted   || '#6b7280' },
                    };

                    return (
                      <>
                        {/* Chips de filtro */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                          {tipos.map(t => {
                            const ativo = filtroTrajetoria === t.id;
                            return (
                              <button
                                key={t.id}
                                onClick={() => setFiltroTrajetoria(t.id)}
                                style={{
                                  background: ativo ? `${C.accent}22` : 'transparent',
                                  border: `1px solid ${ativo ? C.accent : C.border}`,
                                  color: ativo ? C.accent : C.muted,
                                  borderRadius: 999, padding: '4px 12px',
                                  fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                                  fontWeight: ativo ? 600 : 400,
                                }}
                              >
                                {t.icon} {t.label} <span style={{ opacity: 0.7 }}>({contagem[t.id]})</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Timeline */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {eventosFiltrados.length === 0 ? (
                            <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 12,
                                          border: `1px dashed ${C.border}`, borderRadius: 6 }}>
                              📭 Nenhum evento deste tipo
                            </div>
                          ) : eventosFiltrados.map(e => {
                            const cfg = cfgTipo[e.tipo] || { icon: '⚪', label: e.tipo, cor: C.muted };
                            const data = e.criado_em
                              ? new Date(String(e.criado_em).replace(' ', 'T')).toLocaleString('pt-BR')
                              : '—';

                            // Texto do "de → para" conforme o tipo
                            let rotaTexto = null;
                            if (e.tipo === 'entrada' && e.endereco_destino) {
                              rotaTexto = `→ ${e.endereco_destino}`;
                            } else if (e.tipo === 'transferencia' && e.endereco_origem && e.endereco_destino) {
                              rotaTexto = `${e.endereco_origem} → ${e.endereco_destino}`;
                            } else if (e.tipo === 'saida' && e.endereco_origem) {
                              rotaTexto = `← ${e.endereco_origem}`;
                            }

                            return (
                              <div key={e.id} style={{
                                borderLeft: `3px solid ${cfg.cor}`,
                                background: C.bg, borderRadius: 6,
                                padding: '10px 14px',
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
                                  <div style={{ fontSize: 11, color: cfg.cor, fontWeight: 600 }}>
                                    {cfg.icon} {cfg.label}
                                    {e.numero_movimento && <span style={{ marginLeft: 8, color: C.muted, fontWeight: 400, fontFamily: "'IBM Plex Mono', monospace" }}>{e.numero_movimento}</span>}
                                  </div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: C.text, fontFamily: "'IBM Plex Mono', monospace" }}>
                                    {(e.tipo === 'saida' || e.tipo === 'bloqueio') ? '−' : '+'}{e.quantidade} {trajetoria.item?.unidade_medida || 'UN'}
                                  </div>
                                </div>
                                <div style={{ fontSize: 11, color: C.muted, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
                                  📅 {data}
                                </div>
                                {(rotaTexto || e.oc_numero || e.os_numero || e.fornecedor_nome) && (
                                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    {rotaTexto && <span>📍 {rotaTexto}</span>}
                                    {e.oc_numero && <span>📄 {e.oc_numero}</span>}
                                    {e.os_numero && <span>🔧 {e.os_numero}</span>}
                                    {e.chamado_item_numero && (
                                      <span>📌 #{e.chamado_item_numero}{e.chamado_item_nome ? ` — ${e.chamado_item_nome}` : ''}</span>
                                    )}
                                    {e.fornecedor_nome && <span>🏢 {e.fornecedor_nome}</span>}
                                  </div>
                                )}
                                {/* M4.4-etapa-8b: saldo acumulado após este movimento */}
                                {typeof e.saldo_apos === 'number' && (
                                  <div style={{
                                    fontSize: 11, color: C.text, marginTop: 6,
                                    fontFamily: "'IBM Plex Mono', monospace",
                                    padding: '4px 8px',
                                    background: `${C.accent}15`,
                                    border: `1px solid ${C.accent}33`,
                                    borderRadius: 4,
                                    display: 'inline-block',
                                  }}>
                                    📦 Saldo após: <strong style={{ color: C.accent }}>{e.saldo_apos} {trajetoria.item?.unidade_medida || 'UN'}</strong>
                                  </div>
                                )}

                                {/* M4.4-etapa-8d: esconde a observação técnica antiga
                                    ("Aplicação em OS (chamado X, item Y)") — o
                                    card já mostra OS + #N — Nome nas linhas acima. */}
                                {e.observacao && !/^Aplicação em OS \(chamado \d+, item \d+\)$/.test(e.observacao) && (
                                  <div style={{ fontSize: 10, color: C.muted, marginTop: 4, fontStyle: 'italic' }}>
                                    {e.observacao}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>

            {/* Rodapé */}
            <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`,
                          display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => abrirTransferir(itemSelecionado)}
                  disabled={!itemSelecionado.enderecos || itemSelecionado.enderecos.length === 0}
                  style={{ ...s.btn(true), padding: '8px 14px', fontSize: 12,
                           opacity: (!itemSelecionado.enderecos || itemSelecionado.enderecos.length === 0) ? 0.5 : 1 }}
                >
                  🚚 Mover saldo
                </button>
                <button
                  onClick={() => abrirEditar(itemSelecionado)}
                  style={{ ...s.btn(false), padding: '8px 14px', fontSize: 12 }}
                >
                  ✏ Editar item
                </button>
              </div>
              <button
                onClick={() => setItemSelecionado(null)}
                style={{ ...s.btn(false), padding: '8px 14px', fontSize: 12 }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── M4.4-etapa-6: MODAL DE TRANSFERÊNCIA ENTRE ENDEREÇOS ─── */}
      {itemTransferindo && (
        <div 
          onClick={fecharTransferir}
          style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{ ...s.card, width: 480, maxWidth: '100%' }}
          >
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                🚚 Transferir — {itemTransferindo.nome}
              </div>
              <button onClick={fecharTransferir} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={s.label}>ENDEREÇO DE ORIGEM</label>
                <select
                  value={formTransf.endereco_origem}
                  onChange={e => setFormTransf(f => ({ ...f, endereco_origem: e.target.value }))}
                  style={{ ...s.input, width: '100%', appearance: 'none' }}
                >
                  {(itemTransferindo.enderecos || []).map(e => (
                    <option key={e.endereco} value={e.endereco}>
                      {e.endereco} — {e.saldo} {itemTransferindo.unidade_medida || 'UN'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={s.label}>ENDEREÇO DE DESTINO</label>
                <input
                  type="text"
                  value={formTransf.endereco_destino}
                  onChange={e => setFormTransf(f => ({ ...f, endereco_destino: e.target.value }))}
                  placeholder="Ex: A01, Prateleira B, Corredor 3"
                  style={{ ...s.input, width: '100%' }}
                />
              </div>

              <div>
                <label style={s.label}>QUANTIDADE</label>
                <input
                  type="number"
                  value={formTransf.quantidade}
                  onChange={e => setFormTransf(f => ({ ...f, quantidade: e.target.value }))}
                  placeholder="Digite a quantidade..."
                  min="0"
                  step="0.01"
                  style={{ ...s.input, width: '100%' }}
                  onWheel={e => e.target.blur()}
                />
                <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                  Disponível em {formTransf.endereco_origem}: {(itemTransferindo.enderecos || []).find(e => e.endereco === formTransf.endereco_origem)?.saldo || 0} {itemTransferindo.unidade_medida || 'UN'}
                </div>
              </div>

              <div>
                <label style={s.label}>OBSERVAÇÃO (OPCIONAL)</label>
                <textarea
                  value={formTransf.observacao}
                  onChange={e => setFormTransf(f => ({ ...f, observacao: e.target.value }))}
                  placeholder="Ex: Separação para montagem"
                  rows={2}
                  style={{ ...s.input, width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button 
                onClick={fecharTransferir} 
                disabled={salvandoTransferencia}
                style={{ ...s.btn(false), padding: '8px 16px' }}
              >
                Cancelar
              </button>
              <button 
                onClick={executarTransferencia}
                disabled={salvandoTransferencia}
                style={{ ...s.btn(true), padding: '8px 16px', opacity: salvandoTransferencia ? 0.5 : 1 }}
              >
                {salvandoTransferencia ? 'Transferindo...' : '🚚 Transferir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE CONFIGURAÇÕES ─── */}
      {modalConfig && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ ...s.card, width: 420, maxWidth: '100%' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>⚙️ Configurações</div>
              <button onClick={() => setModalConfig(false)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '20px 22px' }}>
              {/* Toggle: Fluxo de aprovação */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Fluxo de aprovação</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Exige aprovação do gestor para retiradas</div>
                </div>
                <button
                  onClick={() => setConfig(f => ({ ...f, fluxo_aprovacao: !f.fluxo_aprovacao }))}
                  style={{
                    width: 48,
                    height: 28,
                    borderRadius: 14,
                    background: config.fluxo_aprovacao ? C.success : C.border,
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background .2s',
                    border: 'none',
                    flexShrink: 0
                  }}
                >
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 3,
                    left: config.fluxo_aprovacao ? 23 : 3,
                    transition: 'left .2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }} />
                </button>
              </div>

              {/* Toggle: Notificar recompra */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Notificar recompra automática</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Envia alerta quando estoque atinge o limite</div>
                </div>
                <button
                  onClick={() => setConfig(f => ({ ...f, notificar_recompra: !f.notificar_recompra }))}
                  style={{
                    width: 48,
                    height: 28,
                    borderRadius: 14,
                    background: config.notificar_recompra ? C.success : C.border,
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background .2s',
                    border: 'none',
                    flexShrink: 0
                  }}
                >
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 3,
                    left: config.notificar_recompra ? 23 : 3,
                    transition: 'left .2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button onClick={() => setModalConfig(false)} style={{ ...s.btn(false), flex: 1 }}>Cancelar</button>
                <button onClick={salvarConfig} style={{ ...s.btn(true), flex: 1 }}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── M4.4-etapa-6g: MODAL DE GERENCIAR ENDEREÇOS ────────── */}
      {modalEnderecos && (
        <div
          onClick={fecharModalEnderecos}
          style={{ position: 'fixed', inset: 0, background: '#00000090',
                   display: 'flex', alignItems: 'center', justifyContent: 'center',
                   zIndex: 320, padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ ...s.card, width: 720, maxWidth: '100%', maxHeight: '85vh',
                     display: 'flex', flexDirection: 'column' }}
          >
            {/* Cabeçalho */}
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                {editandoEndereco
                  ? (editandoEndereco._novo ? '📍 Novo Endereço' : `📍 Editar — ${editandoEndereco.codigo}`)
                  : '📍 Endereços de Estoque'}
              </div>
              <button
                onClick={editandoEndereco ? fecharFormEndereco : fecharModalEnderecos}
                style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Corpo */}
            <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
              {editandoEndereco ? (
                /* ── FORM (criar/editar) ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={s.label}>CÓDIGO</label>
                    <input
                      type="text"
                      value={editandoEndereco.codigo}
                      onChange={e => setEditandoEndereco(p => ({ ...p, codigo: e.target.value.toUpperCase() }))}
                      placeholder="Ex: A01, B02, RECEBIMENTO"
                      disabled={!editandoEndereco._novo}
                      style={{
                        ...s.input, width: '100%',
                        fontFamily: "'IBM Plex Mono', monospace",
                        opacity: editandoEndereco._novo ? 1 : 0.6,
                        cursor: editandoEndereco._novo ? 'text' : 'not-allowed',
                      }}
                    />
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                      {editandoEndereco._novo
                        ? 'Letras maiúsculas, números, _ ou -. Até 30 caracteres. Não pode ser editado depois.'
                        : 'Código é imutável (preserva histórico de movimentações).'}
                    </div>
                  </div>

                  <div>
                    <label style={s.label}>LOCALIZAÇÃO / DESCRIÇÃO</label>
                    <input
                      type="text"
                      value={editandoEndereco.descricao}
                      onChange={e => setEditandoEndereco(p => ({ ...p, descricao: e.target.value }))}
                      placeholder="Ex: Prateleira A, corredor 1 / Doca sul"
                      style={{ ...s.input, width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={s.label}>TIPO</label>
                    <select
                      value={editandoEndereco.tipo}
                      onChange={e => setEditandoEndereco(p => ({ ...p, tipo: e.target.value }))}
                      style={{ ...s.input, width: '100%', appearance: 'none' }}
                    >
                      <option value="recebimento">📥 Recebimento (doca padrão)</option>
                      <option value="armazem">📦 Armazém (prateleira, corredor)</option>
                      <option value="expedicao">📤 Expedição (saída)</option>
                      <option value="nc">❌ Não Conformidade (segregação)</option>
                      <option value="transito">🚚 Trânsito (entre endereços)</option>
                    </select>
                  </div>

                  {!editandoEndereco._novo && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '10px 12px', background: C.bg, borderRadius: 6 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Ativo</div>
                        <div style={{ fontSize: 11, color: C.muted }}>
                          Endereços inativos não aparecem nas sugestões de transferência
                        </div>
                      </div>
                      <button
                        onClick={() => setEditandoEndereco(p => ({ ...p, ativo: !p.ativo }))}
                        style={{
                          width: 48, height: 28, borderRadius: 14,
                          background: editandoEndereco.ativo ? C.success : C.border,
                          cursor: 'pointer', position: 'relative', transition: 'background .2s',
                          border: 'none', flexShrink: 0,
                        }}
                      >
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%', background: '#fff',
                          position: 'absolute', top: 3,
                          left: editandoEndereco.ativo ? 23 : 3,
                          transition: 'left .2s',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        }} />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* ── LISTA ── */
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Buscar por código ou localização..."
                      value={buscaEndereco}
                      onChange={e => setBuscaEndereco(e.target.value)}
                      style={{ ...s.input, flex: 1, minWidth: 200, maxWidth: 320, padding: '6px 12px', fontSize: 12 }}
                    />
                    <div style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>
                      {enderecosLista.filter(e => e.ativo).length} ativo(s) · {enderecosLista.length} total
                    </div>
                    <button
                      onClick={() => abrirFormEndereco(null)}
                      style={{ ...s.btn(true), padding: '6px 12px', fontSize: 11 }}
                    >
                      + Novo Endereço
                    </button>
                  </div>

                  {carregandoEnderecos ? (
                    <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 12 }}>
                      Carregando...
                    </div>
                  ) : enderecosFiltrados.length === 0 ? (
                    <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 12,
                                  border: `1px dashed ${C.border}`, borderRadius: 6 }}>
                      {buscaEndereco.trim()
                        ? `📭 Nenhum endereço encontrado para "${buscaEndereco}"`
                        : '📭 Nenhum endereço cadastrado'}
                    </div>
                  ) : (
                    <div style={{ ...s.card, overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 130px 90px 60px',
                                    padding: '10px 14px', background: C.bg,
                                    borderBottom: `1px solid ${C.border}`,
                                    fontSize: 10, color: C.muted, letterSpacing: '0.08em' }}>
                        <span>CÓDIGO</span>
                        <span>LOCALIZAÇÃO</span>
                        <span>TIPO</span>
                        <span>STATUS</span>
                        <span></span>
                      </div>
                      {enderecosFiltrados.map(e => (
                        <div key={e.id} style={{
                          display: 'grid', gridTemplateColumns: '140px 1fr 130px 90px 60px',
                          padding: '12px 14px', borderBottom: `1px solid ${C.border}22`,
                          alignItems: 'center', opacity: e.ativo ? 1 : 0.5,
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: "'IBM Plex Mono', monospace" }}>
                            {e.codigo}
                          </div>
                          <div style={{ fontSize: 12, color: C.textSub }}>
                            {e.descricao || '—'}
                          </div>
                          <div style={{ fontSize: 11, color: C.muted }}>
                            {e.tipo === 'recebimento' ? '📥 Recebimento'
                              : e.tipo === 'armazem' ? '📦 Armazém'
                              : e.tipo === 'expedicao' ? '📤 Expedição'
                              : e.tipo === 'nc' ? '❌ NC'
                              : e.tipo === 'transito' ? '🚚 Trânsito'
                              : e.tipo}
                          </div>
                          <div>
                            <span style={{
                              ...s.tag(e.ativo ? C.success : C.muted),
                              fontSize: 10,
                              background: (e.ativo ? C.success : C.muted) + '22',
                            }}>
                              {e.ativo ? '● ativo' : '● inativo'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => abrirFormEndereco(e)}
                              style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 5,
                                       padding: '4px 8px', color: C.muted, fontSize: 11, cursor: 'pointer' }}
                            >
                              ✏
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Rodapé */}
            <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`,
                          display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              {editandoEndereco ? (
                <>
                  <button
                    onClick={fecharFormEndereco}
                    disabled={salvandoEndereco}
                    style={{ ...s.btn(false), padding: '8px 16px', fontSize: 12 }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={salvarEndereco}
                    disabled={salvandoEndereco}
                    style={{ ...s.btn(true), padding: '8px 16px', fontSize: 12,
                             opacity: salvandoEndereco ? 0.5 : 1 }}
                  >
                    {salvandoEndereco ? 'Salvando...' : (editandoEndereco._novo ? 'Criar endereço' : 'Salvar alterações')}
                  </button>
                </>
              ) : (
                <button
                  onClick={fecharModalEnderecos}
                  style={{ ...s.btn(false), padding: '8px 16px', fontSize: 12 }}
                >
                  Fechar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* M4.4-etapa-6f: toast flutuante (sucesso/erro) */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 24, right: 24,
          zIndex: 600,
          background: toast.tipo === 'error' ? '#7f1d1d' : '#0f2f1a',
          border: `1px solid ${toast.tipo === 'error' ? '#ef4444' : '#10b981'}66`,
          color: toast.tipo === 'error' ? '#fca5a5' : '#6ee7b7',
          padding: '12px 18px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          boxShadow: '0 4px 12px #00000055',
          maxWidth: 380,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>{toast.tipo === 'error' ? '⚠️' : '✅'}</span>
          <span style={{ flex: 1 }}>{toast.texto}</span>
          <button
            onClick={() => setToast(null)}
            style={{ background: 'transparent', border: 'none',
                     color: 'inherit', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      {/* ─── MODAL DE ITEM (NOVO/EDITAR) ─── */}
      {(modal === 'novo' || modal) && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ ...s.card, width: 520, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{modal === 'novo' ? 'Novo Item' : 'Editar Item'}</div>
            </div>
            <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
              {/* CAMPOS DO FORMULÁRIO */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.label}>NOME DO ITEM *</label>
                  <input value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))} style={s.input} />
                </div>
                <div>
                  <label style={s.label}>SKU / CÓDIGO</label>
                  <input value={form.sku} onChange={e => setForm(f => ({...f, sku: e.target.value}))} style={s.input} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.label}>FABRICANTE</label>
                  <input value={form.fabricante} onChange={e => setForm(f => ({...f, fabricante: e.target.value}))} placeholder="Ex: SKF, Bosch..." style={s.input} />
                </div>
                <div>
                  <label style={s.label}>UNIDADE DE MEDIDA *</label>
                  <select value={form.unidade_medida} onChange={e => setForm(f => ({...f, unidade_medida: e.target.value}))} style={{...s.input, appearance: 'none'}}>
                    <option value="UN">UN (Unidade)</option>
                    <option value="L">L (Litro)</option>
                    <option value="KG">KG (Quilograma)</option>
                    <option value="CX">CX (Caixa)</option>
                    <option value="RL">RL (Rolo)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.label}>LOTE</label>
                  <input value={form.lote} onChange={e => setForm(f => ({...f, lote: e.target.value}))} placeholder="Ex: L2024-08" style={s.input} />
                </div>
                <div>
                  <label style={s.label}>VALIDADE</label>
                  <input type="date" value={form.validade} onChange={e => setForm(f => ({...f, validade: e.target.value}))} style={s.input} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.label}>LOCALIZAÇÃO (BIN)</label>
                  <input value={form.localizacao} onChange={e => setForm(f => ({...f, localizacao: e.target.value}))} placeholder="Ex: Prateleira A, Corredor 2" style={s.input} />
                </div>
                <div>
                  <label style={s.label}>CÓDIGO DE BARRAS (EAN)</label>
                  <input value={form.codigo_barras} onChange={e => setForm(f => ({...f, codigo_barras: e.target.value}))} placeholder="Ex: 7891234567890" style={s.input} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.label}>SALDO ATUAL</label>
                  <input type="number" value={form.saldo_atual} onChange={e => setForm(f => ({...f, saldo_atual: e.target.value}))} style={s.input} />
                </div>
                <div>
                  <label style={s.label}>LIMITE INFERIOR</label>
                  <input type="number" value={form.limite_inferior_controle} onChange={e => setForm(f => ({...f, limite_inferior_controle: e.target.value}))} style={s.input} />
                </div>
                <div>
                  <label style={s.label}>LIMITE DE RECOMPRA</label>
                  <input type="number" value={form.limite_recompra} onChange={e => setForm(f => ({...f, limite_recompra: e.target.value}))} style={s.input} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.label}>LOTE MÍNIMO DE COMPRA</label>
                  <input type="number" value={form.lote_minimo_compra} onChange={e => setForm(f => ({...f, lote_minimo_compra: e.target.value}))} style={s.input} />
                </div>
                <div>
                  <label style={s.label}>QUANTIDADE LOTES AUTO</label>
                  <input type="number" value={form.quantidade_lotes_automatico} onChange={e => setForm(f => ({...f, quantidade_lotes_automatico: e.target.value}))} style={s.input} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                <div>
                  <label style={s.label}>FORNECEDOR</label>
                  <input 
                    value={form.fornecedor_preferencial_id} 
                    onChange={e => setForm(f => ({...f, fornecedor_preferencial_id: e.target.value}))} 
                    placeholder="Ex: SKF, Bosch, Mercedes..." 
                    style={s.input} 
                  />
                </div>
              </div>

              {/* Toggle: Ativo */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Item Ativo</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Permite que este item seja usado em operações</div>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}
                  style={{
                    width: 48,
                    height: 28,
                    borderRadius: 14,
                    background: form.ativo ? C.success : C.border,
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background .2s',
                    border: 'none',
                    flexShrink: 0
                  }}
                >
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 3,
                    left: form.ativo ? 23 : 3,
                    transition: 'left .2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }} />
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => setModal(null)} style={{ ...s.btn(false), flex: 1 }}>Cancelar</button>
              <button onClick={salvarItem} style={{ ...s.btn(true), flex: 1 }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}