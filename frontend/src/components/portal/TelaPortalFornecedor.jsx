// components/portal/TelaPortalFornecedor.jsx
import { useState, useEffect, useMemo } from 'react';
import { usePortal } from '../../hooks/usePortal';
import { fmtBRL, fmtD } from '../../utils/formatters';

// Configuração de urgência (para tags)
const URG_CONFIG = {
  alta: { c: '#ef4444', l: '🔥 Alta' },
  media: { c: '#f59e0b', l: '⚡ Média' },
  baixa: { c: '#3b82f6', l: '✓ Baixa' },
};

// Estilos auxiliares
const inputStyle = {
  background: '#0f172a',
  border: '1px solid #2d3748',
  borderRadius: 6,
  color: '#f3f4f6',
  padding: '8px 12px',
  fontSize: 13,
  width: '100%',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border .2s',
};

export default function TelaPortalFornecedor() {
  // Pega o token da URL (ex: /portal/tok_xxx)
  const hashParts = window.location.hash.split('/');
  const token = hashParts[hashParts.length - 1];

  const { cotacao, loading, erro, respondendo, respostaEnviada, enviarResposta } = usePortal(token);

  // Estado para os valores preenchidos pelo fornecedor
  const [linhas, setLinhas] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [prazoGeral, setPrazoGeral] = useState('');
  const [obs, setObs] = useState('');
  const [step, setStep] = useState('preencher'); // preencher | revisar | enviado

  // Inicializar linhas quando cotacao carregar
  useEffect(() => {
    if (cotacao && cotacao.itens) {
      const initialLinhas = cotacao.itens.map((item) => ({
        id: item.id,
        valor: '',
        frete: 'CIF',
        grupo: null,
        valorFreteInd: '',
      }));
      setLinhas(initialLinhas);
    }
  }, [cotacao]);

  // Se estiver carregando
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ fontSize: 18, color: '#6b7280' }}>Carregando cotação...</div>
      </div>
    );
  }

  // Se houve erro
  if (erro) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column' }}>
        <div style={{ fontSize: 18, color: '#ef4444', marginBottom: 12 }}>❌ Erro ao carregar cotação</div>
        <div style={{ fontSize: 14, color: '#6b7280' }}>{erro}</div>
      </div>
    );
  }

  // Se não há cotação
  if (!cotacao) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ fontSize: 18, color: '#6b7280' }}>Cotação não encontrada</div>
      </div>
    );
  }

  // Funções auxiliares
  const setLinha = (id, campo, val) =>
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, [campo]: val } : l)));

  const addGrupo = () => {
    const ids = grupos.map((g) => parseInt(g.id.replace('G', '')) || 0);
    const next = Math.max(...ids, 0) + 1;
    setGrupos((prev) => [...prev, { id: `G${next}`, nome: `Volume ${next}`, valorFrete: '' }]);
  };

  const removeGrupo = (gid) => {
    setGrupos((prev) => prev.filter((g) => g.id !== gid));
    setLinhas((prev) => prev.map((l) => (l.grupo === gid ? { ...l, grupo: null } : l)));
  };

  const setGrupoFrete = (gid, val) =>
    setGrupos((prev) => prev.map((g) => (g.id === gid ? { ...g, valorFrete: val } : g)));

  // Função para calcular frete rateado
  const freteRateado = (linha) => {
    if (!linha) return 0;
    if (linha.frete === 'CIF') return 0;
    if (!linha.grupo) return parseFloat(linha.valorFreteInd || 0);
    const grupo = grupos.find((g) => g.id === linha.grupo);
    if (!grupo?.valorFrete) return 0;
    const membros = linhas.filter((l) => l.grupo === linha.grupo && l.valor);
    const totalGrupo = membros.reduce((s, l) => s + parseFloat(l.valor || 0), 0);
    if (!totalGrupo) return 0;
    const proporcao = parseFloat(linha.valor || 0) / totalGrupo;
    return parseFloat(grupo.valorFrete) * proporcao;
  };

  // Função para calcular custo total
  const custoItem = (linha) => {
    if (!linha) return null;
    const val = parseFloat(linha.valor || 0);
    if (!val) return null;
    return val + freteRateado(linha);
  };

  // Validação
  const linhasOK = linhas.filter((l) => l.valor);
  const podeRevisar = linhasOK.length === linhas.length && prazoGeral && prazoGeral > 0;

  // Totais
  const totalPecas = linhas.reduce((s, l) => s + parseFloat(l.valor || 0), 0);
  const totalFrete =
    grupos.reduce((s, g) => s + parseFloat(g.valorFrete || 0), 0) +
    linhas
      .filter((l) => l.frete === 'FOB' && !l.grupo)
      .reduce((s, l) => s + parseFloat(l.valorFreteInd || 0), 0);
  const totalGeral = totalPecas + totalFrete;

  // Handler para enviar resposta
  const handleEnviar = async () => {
    // Monta payload no formato esperado pelo backend
    const payload = {
      itens: linhas.map((l) => {
        const itemOriginal = cotacao.itens.find((i) => i.id === l.id);
        return {
          item_id: l.id,
          nome: itemOriginal?.peca || itemOriginal?.nome || '',
          quantidade: itemOriginal?.quantidade || 1,
          valor_unitario: parseFloat(l.valor || 0),
          frete: l.frete,
          valor_frete: l.frete === 'FOB' ? (l.grupo ? null : parseFloat(l.valorFreteInd || 0)) : 0,
          grupo_frete: l.grupo || null,
        };
      }),
      prazo_entrega: parseInt(prazoGeral),
      observacoes: obs,
      // Também envia grupos para referência (opcional)
      grupos_frete: grupos.map((g) => ({
        id: g.id,
        nome: g.nome,
        valor_frete: parseFloat(g.valorFrete || 0),
      })),
    };

    try {
      await enviarResposta(payload);
      setStep('enviado');
    } catch (err) {
      alert('Erro ao enviar proposta: ' + err.message);
    }
  };

  // --- TELA DE ENVIADO ---
  if (step === 'enviado') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 20, padding: 40 }}>
        <div style={{ fontSize: 52 }}>🎉</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1f2937' }}>Proposta enviada com sucesso!</div>
        <div style={{ background: '#1e293b', padding: '20px 28px', borderRadius: 12, minWidth: 320 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12, letterSpacing: '0.08em' }}>
            RESUMO — {cotacao.numero_cotacao || cotacao.id}
          </div>
          {cotacao.itens.map((it, i) => {
            const l = linhas.find((l) => l.id === it.id);
            const ct = custoItem(l) || 0;
            return (
              <div
                key={it.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: '1px solid #2d3748',
                  fontSize: 13,
                }}
              >
                <span style={{ color: '#d1d5db' }}>{it.peca || it.nome}</span>
                <span style={{ color: '#10b981', fontWeight: 600 }}>{fmtBRL(ct)}</span>
              </div>
            );
          })}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 10,
              paddingTop: 10,
              borderTop: '1px solid #2d3748',
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            <span style={{ color: '#f3f4f6' }}>Total do pedido</span>
            <span style={{ color: '#10b981' }}>{fmtBRL(totalGeral)}</span>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Prazo: {prazoGeral} dias úteis</div>
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', maxWidth: 360 }}>
          Um e-mail de confirmação foi enviado para você com todos os dados desta proposta.
        </div>
      </div>
    );
  }

  // --- TELA DE REVISÃO ---
  if (step === 'revisar') {
    return (
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '32px 20px', overflowY: 'auto' }}>
        <div
          style={{
            background: '#1e293b',
            borderRadius: 12,
            padding: '14px 20px',
            marginBottom: 20,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <div style={{ width: 4, height: 28, background: '#10b981', borderRadius: 2 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f3f4f6' }}>
              {cotacao.empresa || 'Fornecedor'} · {cotacao.numero_cotacao || cotacao.id}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>Revise sua proposta antes de enviar</div>
          </div>
        </div>

        <div style={{ background: '#1e293b', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #2d3748', fontSize: 11, color: '#6b7280', letterSpacing: '0.08em' }}>
            ITENS DA PROPOSTA
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 80px 80px 80px 80px 100px',
              padding: '9px 18px',
              background: '#0f172a',
              borderBottom: '1px solid #2d3748',
              fontSize: 10,
              color: '#6b7280',
              letterSpacing: '0.07em',
            }}
          >
            <span>ITEM</span>
            <span>QTD</span>
            <span>VL UNIT.</span>
            <span>FRETE</span>
            <span>GRUPO</span>
            <span style={{ textAlign: 'right' }}>CUSTO TOTAL</span>
          </div>
          {cotacao.itens.map((it, i) => {
            const l = linhas.find((l) => l.id === it.id);
            const fr = freteRateado(l);
            const ct = custoItem(l);
            const g = grupos.find((g) => g.id === l.grupo);
            return (
              <div
                key={it.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 80px 80px 80px 80px 100px',
                  padding: '11px 18px',
                  borderBottom: i < cotacao.itens.length - 1 ? '1px solid #2d3748' : 'none',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, color: '#f3f4f6', fontWeight: 500 }}>{it.peca || it.nome}</div>
                  <div style={{ fontSize: 10, color: '#6b7280' }}>{it.codigo}</div>
                </div>
                <span style={{ fontSize: 12, color: '#d1d5db' }}>{it.quantidade}x</span>
                <span style={{ fontSize: 13, color: '#f3f4f6', fontWeight: 600 }}>{fmtBRL(parseFloat(l.valor))}</span>
                <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: l.frete === 'CIF' ? '#0f2f1a' : '#3f2a0a', color: l.frete === 'CIF' ? '#10b981' : '#f59e0b' }}>
                  {l.frete}
                </span>
                <span style={{ fontSize: 11, color: '#6b7280' }}>
                  {g ? g.nome : l.frete === 'FOB' ? `Individual${l.valorFreteInd ? ` (${fmtBRL(parseFloat(l.valorFreteInd))})` : ''}` : '—'}
                </span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>{fmtBRL(ct)}</div>
                  {fr > 0 && <div style={{ fontSize: 10, color: '#6b7280' }}>+{fmtBRL(fr)} frete</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Totais */}
        <div style={{ background: '#1e293b', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: '#d1d5db' }}>Subtotal peças</span>
            <span style={{ color: '#f3f4f6' }}>{fmtBRL(totalPecas)}</span>
          </div>
          {grupos
            .filter((g) => g.valorFrete)
            .map((g) => (
              <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#d1d5db' }}>Frete {g.nome}</span>
                <span style={{ color: '#f59e0b' }}>{fmtBRL(parseFloat(g.valorFrete))}</span>
              </div>
            ))}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 16,
              fontWeight: 700,
              paddingTop: 10,
              marginTop: 6,
              borderTop: '1px solid #2d3748',
            }}
          >
            <span style={{ color: '#f3f4f6' }}>Total do pedido</span>
            <span style={{ color: '#10b981' }}>{fmtBRL(totalGeral)}</span>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>Prazo: {prazoGeral} dias úteis</div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setStep('preencher')}
            style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#2d3748', color: '#d1d5db', border: 'none', fontSize: 14, cursor: 'pointer' }}
          >
            ← Editar
          </button>
          <button
            onClick={handleEnviar}
            disabled={respondendo}
            style={{ flex: 2, padding: 10, borderRadius: 8, background: '#10b981', color: '#fff', border: 'none', fontSize: 15, cursor: 'pointer', fontWeight: 600 }}
          >
            {respondendo ? 'Enviando...' : '✓ Confirmar e enviar proposta'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 10 }}>
          Sua proposta é confidencial. Outros fornecedores não têm acesso aos seus valores.
        </div>
      </div>
    );
  }

  // --- TELA PRINCIPAL DE PREENCHIMENTO ---
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px', overflowY: 'auto' }}>
      {/* Header */}
      <div
        style={{
          background: '#1e293b',
          borderRadius: 12,
          padding: '14px 20px',
          marginBottom: 16,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ width: 4, height: 28, background: '#10b981', borderRadius: 2 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f3f4f6' }}>
              {cotacao.empresa || 'Fornecedor'}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>
              Cotação {cotacao.numero_cotacao || cotacao.id} · Responder até {fmtD(cotacao.prazo_resposta || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))}
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: 10,
            padding: '4px 10px',
            borderRadius: 4,
            background: '#3f2a0a',
            color: '#f59e0b',
          }}
        >
          {cotacao.itens?.filter((i) => i.urgencia === 'alta').length || 0} item(ns) urgente(s)
        </span>
      </div>

      {/* Instrução */}
      <div
        style={{
          background: '#0f1e35',
          border: '1px solid #3b82f633',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          fontSize: 12,
          color: '#d1d5db',
          lineHeight: 1.8,
        }}
      >
        <span style={{ color: '#3b82f6', fontWeight: 600 }}>ℹ Instruções de preenchimento: </span>
        Para cada item informe o valor unitário e a modalidade de frete.
        <strong style={{ color: '#f3f4f6' }}> CIF</strong> = frete incluso no preço.
        <strong style={{ color: '#f3f4f6' }}> FOB</strong> = frete cobrado à parte.
        Se múltiplos itens compartilham o mesmo volume de entrega, agrupe-os e informe o frete do grupo — o sistema rateia automaticamente pelo valor de cada item.
      </div>

      {/* Tabela de itens */}
      <div style={{ background: '#1e293b', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #2d3748',
            fontSize: 11,
            color: '#6b7280',
            letterSpacing: '0.08em',
          }}
        >
          ITENS SOLICITADOS — {cotacao.itens.length} SKU(s)
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 50px 120px 130px 160px 110px',
            padding: '9px 16px',
            background: '#0f172a',
            borderBottom: '1px solid #2d3748',
            fontSize: 10,
            color: '#6b7280',
            letterSpacing: '0.07em',
            gap: 8,
          }}
        >
          <span>ITEM / CÓDIGO</span>
          <span>QTD</span>
          <span>VALOR UNIT. (R$)</span>
          <span>MODALIDADE</span>
          <span>GRUPO DE FRETE</span>
          <span style={{ textAlign: 'right' }}>CUSTO TOTAL</span>
        </div>
        {cotacao.itens.map((it, i) => {
          const l = linhas.find((l) => l.id === it.id);
          const ct = custoItem(l);
          const fr = freteRateado(l);
          return (
            <div
              key={it.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 50px 120px 130px 160px 110px',
                padding: '12px 16px',
                borderBottom: i < cotacao.itens.length - 1 ? '1px solid #2d3748' : 'none',
                alignItems: 'center',
                gap: 8,
                background: l?.valor ? 'transparent' : '#0d111a',
              }}
            >
              <div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: 9,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: URG_CONFIG[it.urgencia]?.c + '22',
                      color: URG_CONFIG[it.urgencia]?.c || '#6b7280',
                    }}
                  >
                    {URG_CONFIG[it.urgencia]?.l || it.urgencia}
                  </span>
                  <span style={{ fontSize: 13, color: '#f3f4f6', fontWeight: 500 }}>{it.peca || it.nome}</span>
                </div>
                <div style={{ fontSize: 10, color: '#3b82f6', marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {it.codigo} · {it.equipamento || ''}
                </div>
              </div>
              <span style={{ fontSize: 13, color: '#d1d5db', fontWeight: 600 }}>{it.quantidade}x</span>
              <input
                type="number"
                value={l?.valor || ''}
                onChange={(e) => setLinha(it.id, 'valor', e.target.value)}
                placeholder="0,00"
                style={{
                  ...inputStyle,
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '7px 10px',
                  border: `1px solid ${l?.valor ? '#10b981' : '#2d3748'}`,
                  background: l?.valor ? '#0f2f1a' : '#0f172a',
                }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                {['CIF', 'FOB'].map((op) => (
                  <div
                    key={op}
                    onClick={() => setLinha(it.id, 'frete', op)}
                    style={{
                      flex: 1,
                      padding: '6px 4px',
                      borderRadius: 6,
                      border: `1px solid ${l?.frete === op ? (op === 'CIF' ? '#10b981' : '#f59e0b') : '#2d3748'}`,
                      background: l?.frete === op ? (op === 'CIF' ? '#0f2f1a' : '#3f2a0a') : '#0f172a',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all .1s',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: l?.frete === op ? (op === 'CIF' ? '#10b981' : '#f59e0b') : '#6b7280',
                      }}
                    >
                      {op}
                    </div>
                    <div style={{ fontSize: 9, color: '#6b7280' }}>{op === 'CIF' ? 'incluso' : 'à parte'}</div>
                  </div>
                ))}
              </div>
              <div>
                {l?.frete === 'FOB' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <select
                      value={l?.grupo || ''}
                      onChange={(e) => setLinha(it.id, 'grupo', e.target.value || null)}
                      style={{ ...inputStyle, padding: '7px 8px', fontSize: 12, appearance: 'none' }}
                    >
                      <option value="">Individual</option>
                      {grupos.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nome}
                        </option>
                      ))}
                    </select>
                    {!l?.grupo && (
                      <input
                        type="number"
                        value={l?.valorFreteInd || ''}
                        onChange={(e) => setLinha(it.id, 'valorFreteInd', e.target.value)}
                        placeholder="Frete R$ 0,00"
                        style={{
                          ...inputStyle,
                          padding: '6px 8px',
                          fontSize: 12,
                          border: `1px solid ${l?.valorFreteInd ? '#f59e0b' : '#2d3748'}`,
                          background: l?.valorFreteInd ? '#3f2a0a' : '#0f172a',
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: '#6b7280' }}>— (CIF incluso)</span>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                {ct != null ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>{fmtBRL(ct)}</div>
                    {fr > 0 && <div style={{ fontSize: 10, color: '#6b7280' }}>+{fmtBRL(fr)} frete</div>}
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: '#2d3748' }}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grupos de frete */}
      <div style={{ background: '#1e293b', borderRadius: 12, padding: '16px 18px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.08em' }}>🚚 GRUPOS DE FRETE (FOB)</div>
          <button
            onClick={addGrupo}
            style={{
              background: '#1e2a3f',
              border: '1px solid #3b82f6',
              borderRadius: 6,
              padding: '5px 12px',
              color: '#3b82f6',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + Adicionar grupo
          </button>
        </div>
        {grupos.length === 0 && (
          <div style={{ fontSize: 12, color: '#6b7280' }}>Nenhum grupo criado. Crie grupos para ratear o frete entre itens do mesmo volume.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {grupos.map((g) => {
            const membros = linhas.filter((l) => l.grupo === g.id);
            const totalMembros = membros.reduce((s, l) => s + parseFloat(l.valor || 0), 0);
            return (
              <div key={g.id} style={{ background: '#0f172a', border: '1px solid #2d3748', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6', minWidth: 80 }}>{g.nome}</span>
                  <div style={{ flex: 1, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {membros.length === 0 ? (
                      <span style={{ fontSize: 11, color: '#6b7280' }}>Nenhum item — selecione "Grupo" na linha do item</span>
                    ) : (
                      membros.map((l) => {
                        const it = cotacao.itens.find((i) => i.id === l.id);
                        return (
                          <span key={l.id} style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: '#3f2a0a', color: '#f59e0b' }}>
                            {it?.codigo}
                          </span>
                        );
                      })
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>Frete total:</span>
                    <input
                      type="number"
                      value={g.valorFrete}
                      onChange={(e) => setGrupoFrete(g.id, e.target.value)}
                      placeholder="R$ 0,00"
                      style={{ ...inputStyle, width: 100, padding: '5px 8px', fontSize: 13 }}
                    />
                    {totalMembros > 0 && g.valorFrete && (
                      <span style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {((parseFloat(g.valorFrete) / totalMembros) * 100).toFixed(0)}% do subtotal
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeGrupo(g.id)}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: 14, cursor: 'pointer', flexShrink: 0 }}
                  >
                    ✕
                  </button>
                </div>
                {membros.length > 0 && g.valorFrete && totalMembros > 0 && (
                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: '1px solid #2d3748',
                      display: 'flex',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    {membros.map((l) => {
                      const it = cotacao.itens.find((i) => i.id === l.id);
                      const prop = parseFloat(l.valor || 0) / totalMembros;
                      const frItem = parseFloat(g.valorFrete) * prop;
                      return (
                        <div key={l.id} style={{ fontSize: 11, color: '#6b7280' }}>
                          <span style={{ color: '#d1d5db' }}>{it?.codigo}</span>: {fmtBRL(frItem)} ({Math.round(prop * 100)}%)
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Prazo geral + obs */}
      <div style={{ background: '#1e293b', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.08em', marginBottom: 4, display: 'block' }}>
              PRAZO DE ENTREGA (DIAS ÚTEIS) *
            </label>
            <input
              type="number"
              value={prazoGeral}
              onChange={(e) => setPrazoGeral(e.target.value)}
              placeholder="Ex: 3"
              style={{ ...inputStyle, fontSize: 16, fontWeight: 600 }}
            />
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Prazo único para todos os itens</div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.08em', marginBottom: 4, display: 'block' }}>
              OBSERVAÇÕES GERAIS (OPCIONAL)
            </label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
              placeholder="Condições de pagamento, validade da proposta, marcas alternativas..."
              style={{ ...inputStyle, resize: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* Totalizador e botão */}
      <div
        style={{
          background: '#1e293b',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>SUBTOTAL PEÇAS</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f3f4f6' }}>{fmtBRL(totalPecas)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>TOTAL FRETE</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>{fmtBRL(totalFrete)}</div>
          </div>
          <div style={{ borderLeft: '1px solid #2d3748', paddingLeft: 24 }}>
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>TOTAL DO PEDIDO</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{fmtBRL(totalGeral)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'right' }}>
            {linhasOK.length}/{linhas.length} itens preenchidos
            {!prazoGeral && ' · prazo obrigatório'}
          </div>
          <button
            onClick={() => podeRevisar && setStep('revisar')}
            disabled={!podeRevisar}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              background: podeRevisar ? '#10b981' : '#2d3748',
              color: podeRevisar ? '#fff' : '#6b7280',
              border: 'none',
              fontSize: 14,
              cursor: podeRevisar ? 'pointer' : 'default',
              whiteSpace: 'nowrap',
            }}
          >
            Revisar proposta →
          </button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center' }}>
        Sua proposta é confidencial. Outros fornecedores não têm acesso aos seus valores.
      </div>
    </div>
  );
}