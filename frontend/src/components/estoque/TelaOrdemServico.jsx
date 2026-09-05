// components/estoque/TelaOrdemServico.jsx
import { useState, useEffect } from 'react';
import apiService from '../../services/apiService';

export default function TelaOrdemServico({ C, s, fmtD, equipamentos }) {
  const [ordens, setOrdens] = useState([]);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);

  // Estados Novos
  const [usuarios, setUsuarios] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [buscaItem, setBuscaItem] = useState('');
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [showSugestoesItem, setShowSugestoesItem] = useState(false);
  const [retiradaGerada, setRetiradaGerada] = useState(null);
  const [chamadoGerado, setChamadoGerado] = useState(null);

  // Estado do formulário
  const [form, setForm] = useState({
    equipamento_id: '',
    tecnico_id: '',
    tecnico_nome: '',
    descricao: '',
    tipo_manutencao: 'corretiva',
    urgencia: 'media',
    servico_nome: '',
    criado_por_id: '',
    criado_por_nome: '',
    itens: []
  });

  const [novoItem, setNovoItem] = useState({
    item_nome: '',
    item_catalogo_id: null,
    sku: '',
    quantidade: 1,
    unidade_medida: 'UN',
    tipo_item: 'consumivel'
  });

  // 🔥 ESTADOS PARA DOCUMENTOS FILHOS
  const [osVisualizando, setOsVisualizando] = useState(null);
  const [documentosFilhos, setDocumentosFilhos] = useState(null); // null | "carregando" | "aberto"
  const [retiradasDaOS, setRetiradasDaOS] = useState([]);
  const [chamadosDaOS, setChamadosDaOS] = useState([]);
  const [ovsDaOS, setOvsDaOS] = useState([]);
  const [recebimentosDaOS, setRecebimentosDaOS] = useState([]);

  // ─── FUNÇÕES DE CARREGAMENTO ──────────────────────────────
  const carregarOrdens = async () => {
    try {
      const data = await apiService.get('/estoque/ordem-servico');
      setOrdens(data || []);
    } catch (err) {
      console.error('Erro ao carregar OS:', err);
    } finally {
      setLoading(false);
    }
  };

  const carregarUsuarios = async () => {
    try {
      const data = await apiService.get('/usuarios');
      setUsuarios(data || []);
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    }
  };

  const carregarCatalogo = async () => {
    try {
      const data = await apiService.get('/estoque/itens');
      setCatalogo(data || []);
    } catch (err) {
      console.error('Erro ao carregar catálogo:', err);
    }
  };

  // ─── useEffect INICIAL ──────────────────────────────────
  useEffect(() => {
    carregarOrdens();
    carregarUsuarios();
    carregarCatalogo();

    // 🔥 Preencher "Criada Por" com o usuário logado
    const user = JSON.parse(localStorage.getItem('usuario'));
    setForm(f => ({ 
      ...f, 
      criado_por_id: user?.id || '', 
      criado_por_nome: user?.nome || '' 
    }));
  }, []);

  // ─── FUNÇÕES DO FORMULÁRIO ─────────────────────────────────
  const adicionarItem = () => {
    if (!novoItem.item_nome) return;
    setForm(f => ({ ...f, itens: [...f.itens, novoItem] }));
    setNovoItem({ 
      item_nome: '', 
      item_catalogo_id: null, 
      sku: '', 
      quantidade: 1, 
      unidade_medida: 'UN', 
      tipo_item: 'consumivel' 
    });
    setBuscaItem('');
    setItemSelecionado(null);
    setShowSugestoesItem(false);
  };

  const removerItem = (index) => {
    setForm(f => ({ ...f, itens: f.itens.filter((_, i) => i !== index) }));
  };

  const salvarOS = async () => {
    if (!form.tecnico_nome || form.itens.length === 0) {
      alert('Preencha o técnico responsável e pelo menos 1 item');
      return;
    }

    try {
      const response = await apiService.post('/estoque/ordem-servico', form);
      alert(`✅ Ordem de Serviço ${response.numero} criada com sucesso!`);
      setModal(null);
      setForm({ 
        equipamento_id: '', 
        tecnico_id: '', 
        tecnico_nome: '', 
        descricao: '', 
        tipo_manutencao: 'corretiva',
        criado_por_id: '',
        criado_por_nome: '',
        itens: [] 
      });
      carregarOrdens();
    } catch (err) {
      alert('Erro ao criar OS: ' + err.message);
    }
  };

  // ─── FUNÇÃO PARA VISUALIZAR OS ────────────────────────────
  const abrirVisualizacao = (os) => {
    setOsVisualizando(os);
    setDocumentosFilhos(null); // Inicia sem documentos
  };

  // ─── FUNÇÃO PARA CARREGAR DOCUMENTOS FILHOS ──────────────
  const carregarDocumentosFilhos = async (osId) => {
    setDocumentosFilhos('carregando');
    try {
      // Buscar retiradas vinculadas à OS
      const retiradas = await apiService.get(`/estoque/solicitacoes?origem_os_id=${osId}`);
      setRetiradasDaOS(retiradas || []);

      // Buscar chamados vinculados à OS
      const chamados = await apiService.get(`/cotacoes/chamados?origem_os_id=${osId}`);
      setChamadosDaOS(chamados || []);

      // Buscar OVs vinculadas à OS
      const ovs = await apiService.get(`/ordens-venda?origem_os_id=${osId}`);
      setOvsDaOS(ovs || []);

      // Buscar recebimentos vinculados à OS
      const recebimentos = await apiService.get(`/estoque/movimentacoes?origem_os_id=${osId}`);
      setRecebimentosDaOS(recebimentos || []);

      setDocumentosFilhos('aberto');
    } catch (err) {
      console.error('Erro ao carregar documentos filhos:', err);
      setDocumentosFilhos(null);
      alert('Erro ao carregar documentos filhos: ' + err.message);
    }
  };

  // ─── FUNÇÕES DE GERAÇÃO GLOBAL ─────────────────────────────
  const gerarRetiradaGlobal = async () => {
    try {
      const response = await apiService.post(`/estoque/ordem-servico/${osVisualizando.id}/gerar-retirada`);
      setRetiradaGerada(response);
      alert(`✅ Retirada ${response.numero} gerada com ${response.quantidade_itens} itens!`);
    } catch (err) {
      alert('Erro ao gerar retirada: ' + err.message);
    }
  };

  const gerarChamadoGlobal = async () => {
    try {
      const response = await apiService.post(`/estoque/ordem-servico/${osVisualizando.id}/gerar-chamado`);
      setChamadoGerado(response);
      alert(`✅ Chamado ${response.numero} gerado com ${response.quantidade_itens} itens!`);
    } catch (err) {
      alert('Erro ao gerar chamado: ' + err.message);
    }
  };

  // ─── FUNÇÃO DE VISUALIZAÇÃO ─────────────────────────────────
  const abrirTelaRetirada = () => {
    window.location.hash = `#/retirada?numero=${retiradaGerada.numero}`;
  };

  const abrirTelaChamado = () => {
    window.location.hash = `#/cotacoes?numero=${chamadoGerado.numero}`;
  };

  if (loading) return <div style={{ padding: 20, color: C.muted }}>Carregando...</div>;

  // ─── RENDER ─────────────────────────────────────────────────
  return (
    <div style={{ padding: '22px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em' }}>MANUTENÇÃO</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Ordens de Serviço</div>
        </div>
        <button onClick={() => setModal('nova')} style={{ ...s.btn(true), padding: '9px 18px' }}>
          + Nova OS
        </button>
      </div>

      {/* LISTA DE OS (com botão visualizar) */}
      <div style={{ ...s.card, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 1fr 1fr 130px', padding: '10px 18px', background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, letterSpacing: '0.08em' }}>
          <span>NÚMERO</span>
          <span>EQUIPAMENTO</span>
          <span>TÉCNICO</span>
          <span>ITENS</span>
          <span>VISUALIZAR</span>
        </div>
        {ordens.map((os) => (
          <div key={os.id} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 1fr 1fr 130px', padding: '13px 18px', borderBottom: `1px solid ${C.border}22`, alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: C.accent, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600 }}>
              {os.numero}
            </div>
            <div style={{ fontSize: 12, color: C.text }}>
              {os.equipamento_nome || '—'}
            </div>
            <div style={{ fontSize: 12, color: C.text }}>
              {os.tecnico_nome || '—'}
            </div>
            <div style={{ fontSize: 12, color: C.text }}>
              {os.itens?.length || 0} itens
            </div>
            <div>
              <button onClick={() => abrirVisualizacao(os)} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 5, padding: '4px 8px', color: C.muted, fontSize: 11, cursor: 'pointer' }}>
                👁️ Visualizar
              </button>
            </div>
          </div>
        ))}
        {ordens.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Nenhuma OS criada</div>}
      </div>

      {/* MODAL DE CRIAÇÃO */}
      {modal === 'nova' && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ ...s.card, width: 600, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Nova Ordem de Serviço</div>
            </div>
            <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
              
              {/* EQUIPAMENTO */}
              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>EQUIPAMENTO</label>
                <select value={form.equipamento_id} onChange={e => setForm(f => ({ ...f, equipamento_id: e.target.value }))} style={{ ...s.input, appearance: 'none' }}>
                  <option value="">— Sem equipamento —</option>
                  {equipamentos?.map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.tag} - {eq.nome}</option>
                  ))}
                </select>
              </div>

              {/* TIPO DE MANUTENÇÃO (BOTÕES) */}
              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>TIPO DE MANUTENÇÃO</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { id: 'preventiva', label: '🛡️ Preventiva', color: '#22c55e' },
                    { id: 'corretiva', label: '🔧 Corretiva', color: '#f59e0b' },
                    { id: 'preditiva', label: '📊 Preditiva', color: '#3b82f6' }
                  ].map(tipo => (
                    <button
                      key={tipo.id}
                      onClick={() => setForm(f => ({ ...f, tipo_manutencao: tipo.id }))}
                      style={{
                        background: form.tipo_manutencao === tipo.id 
                          ? `${tipo.color}22` 
                          : C.surface,
                        border: form.tipo_manutencao === tipo.id 
                          ? `1px solid ${tipo.color}66` 
                          : `1px solid ${C.border}`,
                        borderRadius: 6,
                        padding: '10px 16px',
                        fontSize: 12,
                        fontWeight: 600,
                        color: form.tipo_manutencao === tipo.id ? tipo.color : C.muted,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        flex: 1
                      }}
                      onMouseEnter={e => {
                        if (form.tipo_manutencao !== tipo.id) e.currentTarget.style.background = '#1a2233';
                      }}
                      onMouseLeave={e => {
                        if (form.tipo_manutencao !== tipo.id) e.currentTarget.style.background = C.surface;
                      }}
                    >
                      {tipo.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* TÉCNICO RESPONSÁVEL */}
              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>TÉCNICO RESPONSÁVEL *</label>
                <select value={form.tecnico_id} onChange={e => {
                  // 🔥 NÃO use parseInt! O ID é um UUID (string)
                  const tecnico = usuarios.find(u => u.id === e.target.value);
                  console.log('🔍 Técnico selecionado:', tecnico); // ADICIONE ESSE LOG PARA VERIFICAR
                  setForm(f => ({ ...f, tecnico_id: tecnico?.id, tecnico_nome: tecnico?.nome }));
                }} style={{ ...s.input, appearance: 'none' }}>
                  <option value="">— Selecione o técnico —</option>
                  {usuarios.filter(u => u.perfil === 'tecnico').map(u => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
              </div>

              {/* CRIADA POR */}
              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>CRIADA POR</label>
                <input 
                  value={form.criado_por_nome} 
                  readOnly 
                  style={{ ...s.input, background: C.bg, color: C.muted }} 
                />
              </div>

              {/* DESCRIÇÃO */}
              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>DESCRIÇÃO</label>
                <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descreva o serviço..." style={{ ...s.input, resize: 'none', height: 60 }} />
              </div>

              {/* SERVIÇO (NOME DO SERVIÇO) */}
              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>NOME DO SERVIÇO</label>
                <input 
                  value={form.servico_nome} 
                  onChange={e => setForm(f => ({ ...f, servico_nome: e.target.value }))} 
                  placeholder="Ex: Revisão 10.000km" 
                  style={s.input} 
                />
              </div>

              {/* URGÊNCIA */}
              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>URGÊNCIA</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { id: 'alta', label: '🔴 Alta', color: '#ef4444' },
                    { id: 'media', label: '🟡 Média', color: '#f59e0b' },
                    { id: 'baixa', label: '🟢 Baixa', color: '#22c55e' }
                  ].map(u => (
                    <button
                      key={u.id}
                      onClick={() => setForm(f => ({ ...f, urgencia: u.id }))}
                      style={{
                        background: form.urgencia === u.id ? `${u.color}22` : C.surface,
                        border: form.urgencia === u.id ? `1px solid ${u.color}66` : `1px solid ${C.border}`,
                        borderRadius: 6,
                        padding: '10px 16px',
                        fontSize: 12,
                        fontWeight: 600,
                        color: form.urgencia === u.id ? u.color : C.muted,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        flex: 1
                      }}
                      onMouseEnter={e => {
                        if (form.urgencia !== u.id) e.currentTarget.style.background = '#1a2233';
                      }}
                      onMouseLeave={e => {
                        if (form.urgencia !== u.id) e.currentTarget.style.background = C.surface;
                      }}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* LISTA DE ITENS */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>ITENS DA OS</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <input 
                    value={buscaItem} 
                    onChange={e => setBuscaItem(e.target.value)}
                    onFocus={() => setShowSugestoesItem(true)}
                    placeholder="Digite o nome, SKU ou código de barras..."
                    style={{ ...s.input, flex: 2, minWidth: 150 }} 
                  />
                  
                  {showSugestoesItem && buscaItem.length > 1 && (
                    <div style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, marginTop: -6, maxHeight: 150, overflowY: 'auto' }}>
                      {catalogo.filter(i => 
                        i.nome.toLowerCase().includes(buscaItem.toLowerCase()) ||
                        i.sku?.toLowerCase().includes(buscaItem.toLowerCase()) ||
                        i.codigo_barras?.toLowerCase().includes(buscaItem.toLowerCase())
                      ).slice(0, 5).map(item => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setItemSelecionado(item);
                            setBuscaItem(item.nome);
                            setShowSugestoesItem(false);
                            setNovoItem(i => ({ 
                              ...i, 
                              item_nome: item.nome, 
                              item_catalogo_id: item.id, 
                              sku: item.sku || '', 
                              unidade_medida: item.unidade_medida || 'UN' 
                            }));
                          }}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${C.border}22` }}
                        >
                          <div style={{ fontSize: 12, color: C.text }}>{item.nome}</div>
                          <div style={{ fontSize: 10, color: C.muted }}>{item.sku || '—'} · {item.localizacao || '—'}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <input type="number" value={novoItem.quantidade} onChange={e => setNovoItem(i => ({ ...i, quantidade: e.target.value }))} style={{ ...s.input, width: 70 }} />
                  <select value={novoItem.unidade_medida} onChange={e => setNovoItem(i => ({ ...i, unidade_medida: e.target.value }))} style={{ ...s.input, width: 70 }}>
                    <option value="UN">UN</option>
                    <option value="L">L</option>
                    <option value="KG">KG</option>
                  </select>
                  <select value={novoItem.tipo_item} onChange={e => setNovoItem(i => ({ ...i, tipo_item: e.target.value }))} style={{ ...s.input, width: 120 }}>
                    <option value="consumivel">Consumível</option>
                    <option value="compra">Compra</option>
                  </select>
                  <button onClick={adicionarItem} style={{ ...s.btn(true), padding: '8px 12px' }}>+</button>
                </div>

                {form.itens.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {form.itens.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 12, color: C.text, flex: 1 }}>
                          {item.item_nome} - {item.quantidade} {item.unidade_medida}
                        </span>
                        <span style={{ ...s.tag(item.tipo_item === 'consumivel' ? '#22c55e' : '#3b82f6'), fontSize: 9 }}>
                          {item.tipo_item === 'consumivel' ? 'Consumível' : 'Compra'}
                        </span>
                        <button onClick={() => removerItem(idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: 14, cursor: 'pointer' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => setModal(null)} style={{ ...s.btn(false), flex: 1 }}>Cancelar</button>
              <button onClick={salvarOS} style={{ ...s.btn(true), flex: 1 }}>Salvar OS</button>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 MODAL DE VISUALIZAÇÃO (COM DOCUMENTOS FILHOS) */}
      {osVisualizando && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ ...s.card, width: 700, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                🛠️ OS {osVisualizando.numero}
              </div>
              <button onClick={() => setOsVisualizando(null)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
              {/* BOTÕES GLOBAIS */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {osVisualizando.itens?.some(i => i.tipo_item === 'consumivel') && (
                  <button
                    onClick={gerarRetiradaGlobal}
                    style={{
                      background: retiradaGerada ? C.success + '22' : C.success + '22',
                      border: retiradaGerada ? `1px solid ${C.success}` : `1px solid ${C.success}66`,
                      borderRadius: 6,
                      padding: '10px 16px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: C.success,
                      cursor: 'pointer',
                      flex: 1
                    }}
                  >
                    {retiradaGerada ? `✅ Retirada gerada (${retiradaGerada.numero})` : `📤 Gerar Retirada (${osVisualizando.itens.filter(i => i.tipo_item === 'consumivel').length} itens)`}
                  </button>
                )}

                {osVisualizando.itens?.some(i => i.tipo_item === 'compra') && (
                  <button
                    onClick={gerarChamadoGlobal}
                    style={{
                      background: chamadoGerado ? C.accent + '22' : C.accent + '22',
                      border: chamadoGerado ? `1px solid ${C.accent}` : `1px solid ${C.accent}66`,
                      borderRadius: 6,
                      padding: '10px 16px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: C.accent,
                      cursor: 'pointer',
                      flex: 1
                    }}
                  >
                    {chamadoGerado ? `✅ Chamado gerado (${chamadoGerado.numero})` : `📋 Gerar Chamado (${osVisualizando.itens.filter(i => i.tipo_item === 'compra').length} itens)`}
                  </button>
                )}
              </div>

              {/* BOTÕES DE VISUALIZAR (SE GERADO) */}
              {(retiradaGerada || chamadoGerado) && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  {retiradaGerada && (
                    <button
                      onClick={abrirTelaRetirada}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${C.success}`,
                        borderRadius: 6,
                        padding: '8px 12px',
                        fontSize: 11,
                        color: C.success,
                        cursor: 'pointer'
                      }}
                    >
                      👁️ Visualizar Retirada
                    </button>
                  )}
                  {chamadoGerado && (
                    <button
                      onClick={abrirTelaChamado}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${C.accent}`,
                        borderRadius: 6,
                        padding: '8px 12px',
                        fontSize: 11,
                        color: C.accent,
                        cursor: 'pointer'
                      }}
                    >
                      👁️ Visualizar Chamado
                    </button>
                  )}
                </div>
              )}

              {/* BOTÃO PARA CARREGAR DOCUMENTOS FILHOS */}
              <button
                onClick={() => carregarDocumentosFilhos(osVisualizando.id)}
                style={{
                  background: 'transparent',
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 11,
                  color: C.muted,
                  cursor: 'pointer',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                📦 Ver Documentos Gerados
              </button>

              {/* DETALHES DA OS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 10, color: C.muted }}>EQUIPAMENTO</div>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>
                    {osVisualizando.equipamento_nome || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.muted }}>TÉCNICO</div>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>
                    {osVisualizando.tecnico_nome || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.muted }}>TIPO</div>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>
                    {osVisualizando.tipo_manutencao || 'corretiva'}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: C.muted }}>DESCRIÇÃO</div>
                <div style={{ fontSize: 13, color: C.text }}>
                  {osVisualizando.descricao || '—'}
                </div>
              </div>

              {/* LISTA DE ITENS */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.08em', marginBottom: 12 }}>
                  ITENS DA OS ({osVisualizando.itens?.length || 0})
                </div>

                {osVisualizando.itens?.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.bg, borderRadius: 6, border: `1px solid ${C.border}`, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                        {item.item_nome}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted }}>
                        Qtd: {item.quantidade} {item.unidade_medida} · {item.tipo_item === 'consumivel' ? 'Consumível' : 'Compra'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {item.tipo_item === 'consumivel' && (
                        <div style={{ fontSize: 10, color: C.success }}>📤 Consumível</div>
                      )}
                      {item.tipo_item === 'compra' && (
                        <div style={{ fontSize: 10, color: C.accent }}>📋 Compra</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* MODAL DE DOCUMENTOS FILHOS (EMBUTIDO) */}
            {documentosFilhos === 'carregando' && (
              <div style={{ padding: '20px', textAlign: 'center', color: C.muted }}>
                Carregando documentos...
              </div>
            )}

            {documentosFilhos === 'aberto' && (
              <div style={{ padding: '20px 22px', borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 12 }}>
                  📦 DOCUMENTOS GERADOS
                </div>

                {/* RETIRADAS */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.08em', marginBottom: 6 }}>RETIRADAS</div>
                  {retiradasDaOS.length === 0 && <div style={{ fontSize: 11, color: C.muted }}>Nenhuma retirada gerada</div>}
                  {retiradasDaOS.map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: C.bg, borderRadius: 6, border: `1px solid ${C.border}`, marginBottom: 4 }}>
                      <div style={{ fontSize: 11, color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>{r.numero_solicitacao || '—'}</div>
                      <div style={{ fontSize: 11, color: C.text }}>{r.item_nome}</div>
                      <div style={{ marginLeft: 'auto' }}>
                        <span style={{ ...s.tag(r.status === 'aprovado' ? '#22c55e' : '#f59e0b'), fontSize: 9 }}>
                          {r.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* CHAMADOS */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.08em', marginBottom: 6 }}>CHAMADOS</div>
                  {chamadosDaOS.length === 0 && <div style={{ fontSize: 11, color: C.muted }}>Nenhum chamado gerado</div>}
                  {chamadosDaOS.map(ch => (
                    <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: C.bg, borderRadius: 6, border: `1px solid ${C.border}`, marginBottom: 4 }}>
                      <div style={{ fontSize: 11, color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>{ch.numero}</div>
                      <div style={{ fontSize: 11, color: C.text }}>{ch.descricao || '—'}</div>
                      <div style={{ marginLeft: 'auto' }}>
                        <span style={{ ...s.tag(ch.status === 'finalizado' ? '#22c55e' : '#3b82f6'), fontSize: 9 }}>
                          {ch.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* OVS */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.08em', marginBottom: 6 }}>ORDENS DE VENDA</div>
                  {ovsDaOS.length === 0 && <div style={{ fontSize: 11, color: C.muted }}>Nenhuma OV gerada</div>}
                  {ovsDaOS.map(ov => (
                    <div key={ov.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: C.bg, borderRadius: 6, border: `1px solid ${C.border}`, marginBottom: 4 }}>
                      <div style={{ fontSize: 11, color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>{ov.numero}</div>
                      <div style={{ fontSize: 11, color: C.text }}>{ov.valor_total ? `R$ ${ov.valor_total.toFixed(2)}` : '—'}</div>
                      <div style={{ marginLeft: 'auto' }}>
                        <span style={{ ...s.tag(ov.status === 'recebido' ? '#22c55e' : '#f59e0b'), fontSize: 9 }}>
                          {ov.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* RECEBIMENTOS */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.08em', marginBottom: 6 }}>RECEBIMENTOS</div>
                  {recebimentosDaOS.length === 0 && <div style={{ fontSize: 11, color: C.muted }}>Nenhum recebimento gerado</div>}
                  {recebimentosDaOS.map(rec => (
                    <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: C.bg, borderRadius: 6, border: `1px solid ${C.border}`, marginBottom: 4 }}>
                      <div style={{ fontSize: 11, color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>{rec.numero_recebimento || '—'}</div>
                      <div style={{ fontSize: 11, color: C.text }}>{rec.item_nome}</div>
                      <div style={{ marginLeft: 'auto' }}>
                        <span style={{ ...s.tag('#22c55e'), fontSize: 9 }}>Entrada</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}