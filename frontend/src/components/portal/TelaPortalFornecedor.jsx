// components/portal/TelaPortalFornecedor.jsx
import React, { useState, useEffect } from 'react';
import { usePortal } from '../../hooks/usePortal';
import { fmtBRL, fmtD } from '../../utils/formatters';

const C = {
  bg: "#0a0e14",
  surface: "#111722",
  border: "#1e2535",
  accent: "#3b82f6",
  success: "#22c55e",
  warn: "#f59e0b",
  danger: "#ef4444",
  muted: "#64748b",
  text: "#e2e8f0",
  textSub: "#94a3b8",
};

const s = {
  card: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 },
  input: { width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "9px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
  btn: (enabled = true, color = C.accent) => ({ background: enabled ? color : C.surface, border: `1px solid ${enabled ? color : C.border}`, borderRadius: 7, padding: "9px 18px", color: enabled ? "#fff" : C.muted, fontSize: 13, fontWeight: 600, cursor: enabled ? "pointer" : "not-allowed", fontFamily: "inherit", transition: "all .15s" }),
  tag: (c) => ({ fontSize: 10, background: `${c}22`, border: `1px solid ${c}44`, borderRadius: 4, padding: "2px 8px", color: c, letterSpacing: "0.06em", fontWeight: 600, whiteSpace: "nowrap" }),
  label: { fontSize: 11, color: C.muted, letterSpacing: "0.08em", display: "block", marginBottom: 5, fontWeight: 600, textTransform: "uppercase" },
};

const URG_CONFIG = {
  alta: { c: '#ef4444', l: '🔥 Alta' },
  media: { c: '#f59e0b', l: '⚡ Média' },
  baixa: { c: '#3b82f6', l: '✓ Baixa' },
};

export default function TelaPortalFornecedor() {
  console.log('🔍 [TelaPortalFornecedor] Componente montado!');

  const [interesses, setInteresses] = useState({});
  const usuarioLogado = JSON.parse(localStorage.getItem('usuario') || '{}');
  const fornecedorId = usuarioLogado?.id || null;
  console.log('🔍 fornecedorId:', fornecedorId);

  const hashParts = window.location.hash.split('/');
  const isCotacaoRoute = hashParts.includes('cotacao') && hashParts.length >= 5;
  const token = isCotacaoRoute ? hashParts[hashParts.length - 1] : null;
  console.log('🔍 token:', token);
  console.log('🔍 isCotacaoRoute:', isCotacaoRoute);

  const { cotacao, loading, erro, respondendo, respostaEnviada, enviarResposta } = usePortal(token);

  const [linhas, setLinhas] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [prazoGeral, setPrazoGeral] = useState('');
  const [obs, setObs] = useState('');
  const [step, setStep] = useState('preencher');
  const [abaAtiva, setAbaAtiva] = useState('oportunidades');
  const [demandasSpot, setDemandasSpot] = useState([]);
  const [buscaSpot, setBuscaSpot] = useState('');

  const [buscaCatalogo, setBuscaCatalogo] = useState('');
  const [itensCatalogo, setItensCatalogo] = useState([]);
  const [modalCatalogo, setModalCatalogo] = useState(false);
  const [formCatalogo, setFormCatalogo] = useState({ item_catalogo_id: '', preco_unitario: '', estoque_status: 'disponivel' });
  const [catalogoDisponivel, setCatalogoDisponivel] = useState([]);

  useEffect(() => {
    if (cotacao && cotacao.itens) {
      setLinhas(cotacao.itens.map(item => ({ id: item.id, valor: '', frete: 'CIF', grupo: null, valorFreteInd: '' })));
      setGrupos([{ id: 'G1', nome: 'Volume 1', valorFrete: '' }]);
    }
  }, [cotacao]);

  useEffect(() => {
    console.log('🔍 [useEffect] Carregando demandas spot...');
    fetch('http://localhost:3001/api/spot/publicas')
      .then(res => {
        console.log('🔍 [fetch] Status da resposta:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('📦 [fetch] Demandas spot carregadas:', data);
        setDemandasSpot(data);
      })
      .catch(err => console.error('❌ Erro ao carregar demandas:', err));
  }, []);

  useEffect(() => {
    console.log('🔍 [useEffect] cotacao mudou:', cotacao);
    if (cotacao) setAbaAtiva('cotacoes');
  }, [cotacao]);

  // Carregar catálogo do fornecedor
  useEffect(() => {
    const carregarCatalogo = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch('http://localhost:3001/api/fornecedor/catalogo', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setItensCatalogo(data || []);
      } catch (err) {
        console.error('Erro ao carregar catálogo:', err);
      }
    };
    carregarCatalogo();
  }, []);

  // Dentro do return, antes do <h1>, adicione:
  console.log('🔍 demandasSpot.length:', demandasSpot.length);
  console.log('🔍 abaAtiva:', abaAtiva);

  const demandasFiltradas = demandasSpot.filter(d =>
    d.componente.toLowerCase().includes(buscaSpot.toLowerCase()) ||
    d.descricao_equipamento.toLowerCase().includes(buscaSpot.toLowerCase()) ||
    (d.part_number && d.part_number.toLowerCase().includes(buscaSpot.toLowerCase()))
  );

  const manifestarInteresse = async (demandaId) => {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const fornecedorId = usuario?.id;

    if (!fornecedorId) {
      alert('Você precisa estar logado como fornecedor para manifestar interesse.');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/fornecedor/interesse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          demanda_id: demandaId,
          mensagem: 'Tenho interesse em fornecer este item.'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.erro || 'Erro ao registrar interesse');
      }

      setInteresses(prev => ({ ...prev, [demandaId]: true }));
      alert('✅ Interesse registrado com sucesso! O comprador será notificado.');
    } catch (err) {
      console.error('❌ Erro ao manifestar interesse:', err);
      alert('❌ Erro ao registrar interesse: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.muted, fontSize: 16 }}>Carregando...</div>
      </div>
    );
  }

  if (erro) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.danger, fontSize: 18, marginBottom: 8 }}>❌ Erro ao carregar cotação</div>
        <div style={{ color: C.muted, fontSize: 14 }}>{erro}</div>
      </div>
    );
  }

  // ─── SEMPRE RENDERIZA O PORTAL COM ABAS ───
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px', overflowY: 'auto' }}>
      {/* Cabeçalho do Portal */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f3f4f6' }}>🏢 Portal do Fornecedor</h1>
        <p style={{ color: '#6b7280', fontSize: 14 }}>Gerencie suas cotações e veja novas oportunidades de negócio.</p>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 24, overflowX: 'auto' }}>
        <button
          onClick={() => setAbaAtiva('cotacoes')}
          style={{
            padding: '10px 20px',
            background: 'transparent',
            border: 'none',
            color: abaAtiva === 'cotacoes' ? C.accent : '#6b7280',
            borderBottom: abaAtiva === 'cotacoes' ? `2px solid ${C.accent}` : 'none',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: 'nowrap'
          }}
        >
          📋 Minhas Cotações
        </button>
        <button
          onClick={() => setAbaAtiva('oportunidades')}
          style={{
            padding: '10px 20px',
            background: 'transparent',
            border: 'none',
            color: abaAtiva === 'oportunidades' ? C.accent : '#6b7280',
            borderBottom: abaAtiva === 'oportunidades' ? `2px solid ${C.accent}` : 'none',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: 'nowrap'
          }}
        >
          ⚡ Oportunidades Spot
          {demandasSpot.length > 0 && (
            <span style={{ marginLeft: 6, background: '#ef4444', borderRadius: 10, padding: '1px 8px', fontSize: 10, color: '#fff' }}>
              {demandasSpot.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setAbaAtiva('catalogo')}
          style={{
            padding: '10px 20px',
            background: 'transparent',
            border: 'none',
            color: abaAtiva === 'catalogo' ? C.accent : '#6b7280',
            borderBottom: abaAtiva === 'catalogo' ? `2px solid ${C.accent}` : 'none',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: 'nowrap'
          }}
        >
          📦 Catálogo
        </button>
      </div>

      {/* CONTEÚDO DAS ABAS */}
      {abaAtiva === 'cotacoes' && (
        cotacao ? (
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            {/* Header da cotação */}
            <div style={{ background: '#1e293b', borderRadius: 12, padding: '14px 20px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 4, height: 28, background: '#10b981', borderRadius: 2 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f3f4f6' }}>{cotacao?.empresa || 'Fornecedor'}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Cotação {cotacao?.numero_cotacao || cotacao?.id} · Responder até {fmtD(cotacao?.prazo_resposta || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))}</div>
                </div>
              </div>
              <span style={{ fontSize: 10, padding: '4px 10px', borderRadius: 4, background: '#3f2a0a', color: '#f59e0b' }}>
                {cotacao?.itens?.filter((i) => i.urgencia === 'alta').length || 0} item(ns) urgente(s)
              </span>
            </div>
            {/* Instrução */}
            <div style={{ background: '#0f1e35', border: '1px solid #3b82f633', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#d1d5db', lineHeight: 1.8 }}>
              <span style={{ color: '#3b82f6', fontWeight: 600 }}>ℹ Instruções de preenchimento: </span>
              Para cada item informe o valor unitário e a modalidade de frete.
              <strong style={{ color: '#f3f4f6' }}> CIF</strong> = frete incluso no preço.
              <strong style={{ color: '#f3f4f6' }}> FOB</strong> = frete cobrado à parte.
              Se múltiplos itens compartilham o mesmo volume de entrega, agrupe-os e informe o frete do grupo — o sistema rateia automaticamente pelo valor de cada item.
            </div>
            {/* TODO: AQUI VOCÊ COPIA TODO O RESTO DO FORMULÁRIO DE COTAÇÃO */}
            <div style={{ background: '#1e293b', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
              <p style={{ color: '#f3f4f6' }}>📋 Formulário de cotação completo aqui...</p>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 16, color: C.text }}>Nenhuma cotação ativa no momento.</div>
            <div style={{ fontSize: 13, color: C.muted }}>Você não tem cotações pendentes para responder.</div>
          </div>
        )
      )}

      {abaAtiva === 'oportunidades' && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#f3f4f6', marginBottom: 16 }}>
            📋 Demandas Spot Abertas
          </h3>
          {demandasSpot.length === 0 && <p style={{ color: '#6b7280' }}>Nenhuma demanda aberta no momento.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {demandasSpot.map(d => (
              <div key={d.id} style={{ background: '#0f172a', border: `1px solid #1e293b`, borderRadius: 8, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#f3f4f6' }}>{d.componente}</div>
                    <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{d.descricao_equipamento}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      {d.quantidade} unidade(s) · {d.empresa_nome} · {new Date(d.criado_em).toLocaleDateString('pt-BR')}
                    </div>
                    {d.comentarios && (
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>
                        “{d.comentarios}”
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => manifestarInteresse(d.id)}
                    disabled={interesses[d.id]}
                    style={{
                      ...s.btn(true),
                      padding: '8px 16px',
                      fontSize: 12,
                      background: interesses[d.id] ? C.success : C.accent,
                      cursor: interesses[d.id] ? 'default' : 'pointer',
                      opacity: interesses[d.id] ? 0.7 : 1,
                    }}
                  >
                    {interesses[d.id] ? '✅ Interesse registrado' : 'Tenho interesse'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {abaAtiva === 'catalogo' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text }}>📦 Meu Catálogo de Produtos</h3>
            <button 
              onClick={() => setModalCatalogo(true)} 
              style={{ ...s.btn(true), padding: '8px 16px', fontSize: 12 }}
            >
              + Adicionar Produto
            </button>
          </div>
          <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>
            Gerencie os produtos que você oferece. Quanto mais completo seu catálogo, mais recomendações você receberá.
          </p>

          <input
            type="text"
            placeholder="🔍 Buscar no catálogo..."
            value={buscaCatalogo}
            onChange={e => setBuscaCatalogo(e.target.value)}
            style={{ ...s.input, marginBottom: 16 }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {itensCatalogo.length === 0 && (
              <div style={{ ...s.card, padding: 40, textAlign: 'center', color: C.muted }}>
                Você ainda não tem produtos cadastrados no catálogo.
              </div>
            )}
            {itensCatalogo.map(item => (
              <div key={item.id} style={{ ...s.card, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: C.text }}>{item.nome}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{item.codigo} · {item.categoria}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.success }}>{fmtBRL(item.preco_unitario)}</span>
                  <span style={{ ...s.tag(item.estoque_status === 'disponivel' ? C.success : C.warn), fontSize: 10 }}>
                    {item.estoque_status === 'disponivel' ? 'Disponível' : 'Sob consulta'}
                  </span>
                  <button 
                    onClick={() => removerItemCatalogo(item.id)} 
                    style={{ background: 'transparent', border: 'none', color: C.danger, cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}