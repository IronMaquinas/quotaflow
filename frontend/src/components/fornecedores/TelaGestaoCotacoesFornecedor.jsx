// components/fornecedores/TelaGestaoCotacoesFornecedor.jsx
//
// Hub do fornecedor logado — lista todas as cotações que ele participou,
// com status derivado (aguardando resposta / em análise / venceu / não
// selecionada / cancelada).
//
// Reaproveita o mesmo padrão visual da TelaPortalFornecedor (tema escuro),
// mas é uma tela diferente — o TelaPortalFornecedor continua existindo
// pro link tokenizado (anônimo).

import { useState, useEffect } from 'react';
import apiService from '../../services/apiService';
import { fmtBRL, fmtD } from '../../utils/formatters';
import ModalResponderCotacao from './ModalResponderCotacao';

const FILTROS = [
  { id: 'todas',       label: 'Todas' },
  { id: 'aguardando',  label: 'Aguardando você' },
  { id: 'analise',     label: 'Em análise' },
  { id: 'encerradas',  label: 'Encerradas' },
];

export default function TelaGestaoCotacoesFornecedor({ C, s, usuario }) {
  const [cotacoes, setCotacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [filtro, setFiltro] = useState('todas');
  const [busca, setBusca] = useState('');
  const [modalDetalhe, setModalDetalhe] = useState(null);   // { cabecalho, itens }
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  // Fase "modal inline": em vez de abrir nova aba com token, o hub
  // abre o form num modal autenticado por JWT. Quando o envio termina,
  // fecha e recarrega a lista (badge muda de "Aguardando você" pra
  // "Em análise" na hora).
  const [modalResponderId, setModalResponderId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await apiService.get('/fornecedor/minhas-cotacoes');
        setCotacoes(data.cotacoes || []);
      } catch (e) {
        setErro(e.message || 'Erro ao carregar cotações');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const abrirDetalhe = async (c) => {
    setCarregandoDetalhe(true);
    try {
      const data = await apiService.get(
        `/fornecedor/minhas-cotacoes/${c.cotacao_fornecedor_id}`
      );
      setModalDetalhe(data);
    } catch (e) {
      alert('Erro ao carregar detalhes: ' + e.message);
    } finally {
      setCarregandoDetalhe(false);
    }
  };

  const filtradas = cotacoes.filter(c => {
    // Filtro por status
    if (filtro === 'aguardando' && c.status_badge !== 'Aguardando você') return false;
    if (filtro === 'analise' && c.status_badge !== 'Em análise') return false;
    if (filtro === 'encerradas' &&
        !['Você venceu', 'Não selecionada', 'Cancelada'].includes(c.status_badge)) return false;

    // Busca livre
    if (busca.trim()) {
      const q = busca.toLowerCase();
      const haystack = `${c.cotacao_numero} ${c.chamado_numero} ${c.empresa_nome}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // Contadores pros badges dos filtros
  const counts = {
    todas: cotacoes.length,
    aguardando: cotacoes.filter(c => c.status_badge === 'Aguardando você').length,
    analise: cotacoes.filter(c => c.status_badge === 'Em análise').length,
    encerradas: cotacoes.filter(c =>
      ['Você venceu', 'Não selecionada', 'Cancelada'].includes(c.status_badge)
    ).length,
  };

  const abrirResponder = (c) => {
    if (!c.token_acesso) {
      alert('Link de resposta indisponível. Contate o comprador.');
      return;
    }
    // Abre a tela de resposta tokenizada em nova aba (mesmo componente
    // que o fornecedor receberia por email — reaproveita tudo).
    const url = `${window.location.origin}/#/portal/cotacao/${c.cotacao_id}/${c.token_acesso}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
        Carregando suas cotações...
      </div>
    );
  }

  return (
    <div style={{ padding: '22px 24px', overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em', marginBottom: 4 }}>
          GESTÃO DE COTAÇÕES
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>
          {usuario?.nome ? `Olá, ${usuario.nome}` : 'Minhas cotações'}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
          Acompanhe suas participações em tempo real — sem esperar email.
        </div>
      </div>

      {erro && (
        <div style={{
          padding: '10px 12px', background: '#ef444415',
          border: '1px solid #ef444440', borderRadius: 6,
          fontSize: 12, color: '#ef4444', marginBottom: 16,
        }}>
          ⚠ {erro}
        </div>
      )}

      {/* Filtros + busca */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 16,
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        {FILTROS.map(f => {
          const ativo = filtro === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              style={{
                background: ativo ? `${C.accent}22` : 'transparent',
                border: `1px solid ${ativo ? C.accent : C.border}`,
                borderRadius: 6,
                color: ativo ? C.accent : C.muted,
                fontSize: 12,
                fontWeight: ativo ? 600 : 400,
                padding: '6px 14px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {f.label}
              {counts[f.id] > 0 && (
                <span style={{
                  marginLeft: 6, fontSize: 10,
                  background: ativo ? C.accent : C.border,
                  color: ativo ? '#fff' : C.muted,
                  borderRadius: 10, padding: '1px 6px',
                }}>
                  {counts[f.id]}
                </span>
              )}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <input
          type="text"
          placeholder="Buscar por COT, RC ou empresa..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{
            ...s.input, maxWidth: 260, padding: '6px 12px', fontSize: 12,
          }}
        />
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div style={{
          ...s.card, padding: '40px 20px', textAlign: 'center',
          color: C.muted, fontSize: 12,
        }}>
          {cotacoes.length === 0
            ? 'Você ainda não participou de nenhuma cotação.'
            : 'Nenhuma cotação corresponde ao filtro.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtradas.map(c => (
            <div
              key={c.cotacao_fornecedor_id}
              onClick={() => abrirDetalhe(c)}
              style={{
                ...s.card, padding: '14px 18px',
                display: 'grid',
                gridTemplateColumns: '1fr 220px 160px',
                gap: 16, alignItems: 'center',
                cursor: 'pointer',
                transition: 'border-color .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border }}
            >
              {/* Coluna 1: números + empresa */}
              <div>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: C.text,
                  fontFamily: "'IBM Plex Mono', monospace",
                  marginBottom: 2,
                }}>
                  {c.cotacao_numero}
                </div>
                <div style={{ fontSize: 12, color: C.textSub }}>
                  {c.empresa_nome}
                  {c.chamado_numero && (
                    <span style={{ color: C.muted }}>
                      {' '}· RC {c.chamado_numero}
                    </span>
                  )}
                </div>
                {c.respondida_em && (
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                    Você respondeu em {fmtD(c.respondida_em)}
                  </div>
                )}
              </div>

              {/* Coluna 2: status */}
              <div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 4,
                    background: `${c.status_cor}22`,
                    color: c.status_cor,
                    border: `1px solid ${c.status_cor}55`,
                    fontWeight: 600,
                  }}>
                    {c.status_badge}
                  </span>
                  {c.tem_renegociacao && (
                    <span
                      title="O comprador renegociou os valores desta proposta"
                      style={{
                        fontSize: 10, padding: '3px 8px', borderRadius: 4,
                        background: '#f59e0b22',
                        color: '#f59e0b',
                        border: '1px solid #f59e0b55',
                        fontWeight: 600,
                        letterSpacing: '0.03em',
                      }}
                    >
                      🔄 Renegociado
                    </span>
                  )}
                </div>

                {/* Validade com cor por urgência — só quando a proposta
                    está viva (pendente ou em análise). A cor comunica
                    "você tem tempo" vs "corre". */}
                {c.validade_em && ['Aguardando você', 'Em análise'].includes(c.status_badge) && (
                  <div style={{
                    fontSize: 10,
                    marginTop: 4,
                    color:
                      c.validade_status === 'vencida' ? '#ef4444'
                      : c.validade_status === 'urgente' ? '#ef4444'
                      : c.validade_status === 'proxima' ? '#f59e0b'
                      : '#6b7280',
                    fontWeight: c.validade_status === 'vencida' ? 700 : 500,
                  }}>
                    {c.validade_status === 'vencida' ? '⚫ Vencida' :
                     c.validade_status === 'urgente' ? '🔴 ' :
                     c.validade_status === 'proxima' ? '🟡 ' :
                     '🟢 '}
                    {c.validade_status === 'vencida'
                      ? `há ${Math.abs(c.validade_dias_restantes)} dia(s)`
                      : c.validade_dias_restantes === 0
                        ? 'vence hoje'
                        : c.validade_dias_restantes === 1
                          ? 'vence amanhã'
                          : `vence em ${c.validade_dias_restantes} dias`}
                  </div>
                )}
              </div>

              {/* Coluna 3: ação */}
              <div style={{ textAlign: 'right' }}>
                {c.status_badge === 'Aguardando você' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setModalResponderId(c.cotacao_fornecedor_id);
                    }}
                    style={{
                      ...s.btn(true, C.accent),
                      padding: '8px 16px', fontSize: 12,
                    }}
                  >
                    Responder agora →
                  </button>
                )}
                {c.status_badge === 'Em análise' && (
                  <span style={{ fontSize: 11, color: C.muted }}>
                    Aguardando decisão do comprador
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── MODAL: DETALHE DA COTAÇÃO ─────────────────────────── */}
      {(modalDetalhe || carregandoDetalhe) && (
        <div
          onClick={() => { if (!carregandoDetalhe) setModalDetalhe(null); }}
          style={{
            position: 'fixed', inset: 0, background: '#00000090',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 500, padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              ...s.card, width: 780, maxWidth: '100%', maxHeight: '88vh',
              display: 'flex', flexDirection: 'column', padding: 0,
              overflow: 'hidden',
            }}
          >
            {carregandoDetalhe && !modalDetalhe ? (
              <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>
                Carregando detalhes...
              </div>
            ) : (
              <>
                {/* Cabeçalho — grid 2 colunas: número da cotação à
                    esquerda, business card do comprador à direita.
                    Quando a cotação morreu (cancelada/finalizada) o
                    backend manda contato: null e o lado direito fica
                    vazio (só a coluna esquerda). */}
                <div style={{
                  padding: '18px 22px',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 24,
                  alignItems: 'flex-start',
                  position: 'relative',
                }}>
                  {/* Coluna esquerda — número */}
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.08em', marginBottom: 4 }}>
                      COTAÇÃO
                    </div>
                    <div style={{
                      fontSize: 18, fontWeight: 700, color: C.text,
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}>
                      {modalDetalhe.cabecalho.cotacao_numero}
                    </div>
                    <div style={{
                      fontSize: 12, color: C.muted, marginTop: 4,
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}>
                      {modalDetalhe.cabecalho.chamado_numero || 'Sem RC vinculada'}
                    </div>
                  </div>

                  {/* Coluna direita — business card do comprador (só se
                      a cotação está viva). Mais espaço à direita pro
                      botão fechar ficar absoluto no canto. */}
                  {modalDetalhe.contato && (
                    <div style={{
                      background: '#0f1e35',
                      border: `1px solid ${C.border}`,
                      borderRadius: 10,
                      padding: '10px 14px',
                      minWidth: 240,
                      maxWidth: 300,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      marginRight: 32,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14 }}>👤</span>
                        <span style={{ fontSize: 13, color: C.text, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {modalDetalhe.contato.nome || '—'}
                        </span>
                      </div>
                      {modalDetalhe.contato.email && (
                        <div style={{
                          fontSize: 11, color: C.muted,
                          whiteSpace: 'nowrap', overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          📧 {modalDetalhe.contato.email}
                        </div>
                      )}
                      {modalDetalhe.contato.telefone && (
                        <div style={{ fontSize: 11, color: C.muted }}>
                          📞 {modalDetalhe.contato.telefone}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        {modalDetalhe.contato.email && (
                          <a
                            href={`mailto:${modalDetalhe.contato.email}?subject=${encodeURIComponent(
                              `Sobre a cotação ${modalDetalhe.cabecalho.cotacao_numero}` +
                              (modalDetalhe.cabecalho.chamado_numero ? ` (${modalDetalhe.cabecalho.chamado_numero})` : '')
                            )}`}
                            title="Enviar email para o comprador"
                            style={{
                              flex: 1, textAlign: 'center',
                              padding: '4px 10px', borderRadius: 6,
                              background: 'transparent',
                              border: `1px solid ${C.border}`,
                              color: C.accent,
                              fontSize: 11, fontWeight: 600,
                              textDecoration: 'none',
                            }}
                          >
                            ✉️ Email
                          </a>
                        )}
                        {modalDetalhe.contato.telefone && (
                          <a
                            href={`https://wa.me/${modalDetalhe.contato.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(
                              `Olá, sobre a cotação ${modalDetalhe.cabecalho.cotacao_numero}` +
                              (modalDetalhe.cabecalho.chamado_numero ? ` (${modalDetalhe.cabecalho.chamado_numero})` : '')
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Falar no WhatsApp"
                            style={{
                              flex: 1, textAlign: 'center',
                              padding: '4px 10px', borderRadius: 6,
                              background: 'transparent',
                              border: `1px solid ${C.border}`,
                              color: C.success,
                              fontSize: 11, fontWeight: 600,
                              textDecoration: 'none',
                            }}
                          >
                            💬 WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Botão fechar — absoluto no canto superior direito */}
                  <button
                    onClick={() => setModalDetalhe(null)}
                    style={{
                      position: 'absolute', top: 14, right: 16,
                      background: 'transparent', border: 'none',
                      color: C.muted, fontSize: 22, cursor: 'pointer',
                      lineHeight: 1, padding: 0,
                    }}
                    title="Fechar"
                  >
                    ×
                  </button>
                </div>

                {/* Metadados */}
                <div style={{
                  padding: '14px 22px',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 1fr',
                  gap: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.05em', marginBottom: 4 }}>STATUS</div>
                    <span style={{
                      fontSize: 11, padding: '3px 10px', borderRadius: 4,
                      background: `${modalDetalhe.cabecalho.status_cor}22`,
                      color: modalDetalhe.cabecalho.status_cor,
                      border: `1px solid ${modalDetalhe.cabecalho.status_cor}55`,
                      fontWeight: 600,
                    }}>
                      {modalDetalhe.cabecalho.status_badge}
                    </span>
                  </div>
                  {modalDetalhe.cabecalho.respondida_em && (
                    <div>
                      <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.05em', marginBottom: 4 }}>RESPONDIDA EM</div>
                      <div style={{ fontSize: 12, color: C.text }}>{fmtD(modalDetalhe.cabecalho.respondida_em)}</div>
                    </div>
                  )}
                  {modalDetalhe.cabecalho.validade_em && (
                    <div>
                      <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.05em', marginBottom: 4 }}>VALIDADE</div>
                      <div style={{ fontSize: 12, color: C.text }}>{fmtD(modalDetalhe.cabecalho.validade_em)}</div>
                    </div>
                  )}
                  {modalDetalhe.cabecalho.prazo_entrega && (
                    <div>
                      <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.05em', marginBottom: 4 }}>PRAZO</div>
                      <div style={{ fontSize: 12, color: C.text }}>{modalDetalhe.cabecalho.prazo_entrega} dias</div>
                    </div>
                  )}
                </div>

                {/* Tabela de itens */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '44px 1fr 50px 100px 60px 100px 100px 100px',
                    padding: '10px 22px',
                    background: C.bg,
                    borderBottom: `1px solid ${C.border}`,
                    fontSize: 10, color: C.muted,
                    letterSpacing: '0.05em', fontWeight: 600, gap: 8,
                  }}>
                    <span>#</span>
                    <span>ITEM</span>
                    <span>QTD</span>
                    <span style={{ textAlign: 'right' }}>MEU VALOR</span>
                    <span>MODAL.</span>
                    <span style={{ textAlign: 'right' }}>MEU FRETE</span>
                    <span style={{ textAlign: 'right' }}>VL. RENEG.</span>
                    <span style={{ textAlign: 'right' }}>FRETE RENEG.</span>
                  </div>

                  {modalDetalhe.itens.length === 0 ? (
                    <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 12 }}>
                      Nenhum item visível.
                    </div>
                  ) : modalDetalhe.itens.map((it, idx) => (
                    <div
                      key={it.cotacao_item_id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '44px 1fr 50px 100px 60px 100px 100px 100px',
                        padding: '12px 22px',
                        borderBottom: idx < modalDetalhe.itens.length - 1 ? `1px solid ${C.border}22` : 'none',
                        fontSize: 12, gap: 8, alignItems: 'center',
                        opacity: it.eu_respondi ? 1 : 0.75,
                      }}
                    >
                      <span style={{
                        color: C.accent, fontWeight: 700,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}>
                        {it.numero_base != null ? `#${it.numero_base}` : '—'}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: C.text, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {it.nome}
                        </div>
                        {it.codigo && (
                          <div style={{
                            fontSize: 10, color: C.muted,
                            fontFamily: "'IBM Plex Mono', monospace",
                          }}>
                            {it.codigo}
                          </div>
                        )}
                      </div>
                      <span style={{ color: C.textSub }}>{it.quantidade}x</span>
                      <span style={{
                        textAlign: 'right',
                        color: it.eu_respondi ? C.text : C.muted,
                        fontWeight: 600,
                      }}>
                        {it.eu_respondi ? fmtBRL(it.meu_valor) : '—'}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: it.minha_modalidade === 'CIF' ? C.success
                          : it.minha_modalidade === 'FOB' ? C.warn
                          : C.muted,
                      }}>
                        {it.minha_modalidade || '—'}
                      </span>
                      <span style={{
                        textAlign: 'right',
                        color: it.minha_modalidade === 'FOB' && it.meu_frete ? C.warn : C.muted,
                        fontWeight: 600,
                      }}>
                        {it.minha_modalidade === 'FOB' && it.meu_frete ? fmtBRL(it.meu_frete) : '—'}
                      </span>
                      {/* VL. RENEG. — coluna separada */}
                      <span style={{
                        textAlign: 'right',
                        color: it.meu_valor_renegociado != null ? C.warn : C.muted,
                        fontWeight: 600,
                      }}>
                        {it.meu_valor_renegociado != null ? fmtBRL(it.meu_valor_renegociado) : '—'}
                      </span>
                      {/* FRETE RENEG. — coluna separada. Se a modalidade é
                          CIF, frete sempre é 0/nulo por definição. */}
                      <span style={{
                        textAlign: 'right',
                        color: it.meu_frete_renegociado != null ? C.warn : C.muted,
                        fontWeight: 600,
                      }}>
                        {it.minha_modalidade === 'FOB' && it.meu_frete_renegociado != null
                          ? fmtBRL(it.meu_frete_renegociado)
                          : '—'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Rodapé */}
                <div style={{
                  padding: '14px 22px',
                  borderTop: `1px solid ${C.border}`,
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', fontSize: 12, color: C.muted,
                }}>
                  <span>
                    <strong style={{ color: C.text }}>
                      {modalDetalhe.cabecalho.total_respondidos}
                    </strong>
                    {' '}de{' '}
                    <strong style={{ color: C.text }}>
                      {modalDetalhe.cabecalho.total_itens}
                    </strong>
                    {' '}itens respondidos
                  </span>
                  {modalDetalhe.cabecalho.minha_obs && (
                    <span style={{ fontSize: 11, fontStyle: 'italic' }}>
                      Obs: {modalDetalhe.cabecalho.minha_obs}
                    </span>
                  )}
                  <button
                    onClick={() => setModalDetalhe(null)}
                    style={{
                      ...s.btn(false, C.muted),
                      padding: '6px 16px', fontSize: 12,
                    }}
                  >
                    Fechar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal inline de resposta (JWT) — substitui a nova aba tokenizada */}
      {modalResponderId && (
        <ModalResponderCotacao
          cotacaoFornecedorId={modalResponderId}
          onFechar={() => setModalResponderId(null)}
          onSucesso={() => {
            // Recarrega a lista pra o badge mudar de "Aguardando você"
            // pra "Em análise" na hora, sem precisar F5.
            apiService.get('/fornecedor/minhas-cotacoes')
              .then(data => setCotacoes(data.cotacoes || []))
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}