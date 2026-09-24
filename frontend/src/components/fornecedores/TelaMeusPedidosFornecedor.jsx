// components/fornecedores/TelaMeusPedidosFornecedor.jsx
//
// M1 — Hub do fornecedor logado: lista e detalhe das OCs emitidas pra ele.
// Read-only. Confirmação e upload de XML entram em M2.

import { useState, useEffect, useRef } from 'react';
import apiService from '../../services/apiService';
import { fmtBRL, fmtD } from '../../utils/formatters';

function normalizarBusca(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function TelaMeusPedidosFornecedor({ C, s, usuario }) {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState('');
  const [modalDetalhe, setModalDetalhe] = useState(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  // M2 — Anexo de NF-e
  const [modalAnexarNfe, setModalAnexarNfe] = useState(false);
  const [enviandoNfe, setEnviandoNfe] = useState(false);
  const [resultadoAnexo, setResultadoAnexo] = useState(null); // { status, validacao, ... } ou null
  const [erroAnexo, setErroAnexo] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await apiService.get('/fornecedor/meus-pedidos');
        setPedidos(data.pedidos || []);
      } catch (e) {
        setErro(e.message || 'Erro ao carregar pedidos');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const abrirDetalhe = async (p) => {
    setCarregandoDetalhe(true);
    try {
      const data = await apiService.get(`/fornecedor/meus-pedidos/${p.ordem_venda_id}`);
      setModalDetalhe(data);
    } catch (e) {
      alert('Erro ao carregar detalhes: ' + e.message);
    } finally {
      setCarregandoDetalhe(false);
    }
  };

  // ─── Anexar NF-e ──────────────────────────────────────────
  const abrirModalAnexar = () => {
    setResultadoAnexo(null);
    setErroAnexo(null);
    setModalAnexarNfe(true);
    // Sem auto-click — o usuário clica no botão "Selecionar arquivo XML"
    // quando estiver pronto. Auto-abrir o finder do SO é agressivo e o
    // usuário perde o contexto do modal.
  };

  const handleAnexarNfe = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xml')) {
      setErroAnexo('Envie o arquivo XML original da NF-e.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErroAnexo('Arquivo acima de 2MB. Envie o XML original da SEFAZ.');
      return;
    }

    setEnviandoNfe(true);
    setErroAnexo(null);
    setResultadoAnexo(null);

    try {
      const form = new FormData();
      form.append('arquivo', file);

      const resp = await apiService.upload(
        `/fornecedor/meus-pedidos/${modalDetalhe.cabecalho.ordem_venda_id}/anexar-nfe`,
        form
      );
      setResultadoAnexo(resp);

      // Recarrega o detalhe pra o banner aparecer com a NF nova
      const detalheAtualizado = await apiService.get(
        `/fornecedor/meus-pedidos/${modalDetalhe.cabecalho.ordem_venda_id}`
      );
      setModalDetalhe(detalheAtualizado);
    } catch (e) {
      setErroAnexo(e.message || 'Erro ao enviar NF-e');
    } finally {
      setEnviandoNfe(false);
    }
  };

  const handleBaixarXml = async () => {
    try {
      const { url } = await apiService.get(
        `/fornecedor/meus-pedidos/${modalDetalhe.cabecalho.ordem_venda_id}/nfe/${modalDetalhe.nfe_atual.id}`
      );
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      alert('Erro ao baixar XML: ' + e.message);
    }
  };

  const fecharModalAnexar = () => {
    setModalAnexarNfe(false);
    setResultadoAnexo(null);
    setErroAnexo(null);
  };

  const filtrados = pedidos.filter(p => {
    if (!busca.trim()) return true;
    const q = normalizarBusca(busca);
    const haystack = normalizarBusca(
      `${p.numero} ${p.empresa_nome} ${p.cotacao_numero || ''} ${p.chamado_numero || ''}`
    );
    return haystack.includes(q);
  });

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
        Carregando seus pedidos...
      </div>
    );
  }

  return (
    <div style={{ padding: '22px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em', marginBottom: 4 }}>
          MEUS PEDIDOS
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>
          {usuario?.nome ? `Olá, ${usuario.nome}` : 'Ordens de Compra'}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
          Acompanhe suas ordens de compra emitidas — e futuramente anexe a NF-e direto por aqui.
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

      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Buscar por OC, empresa ou RC..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ ...s.input, maxWidth: 380, padding: '6px 12px', fontSize: 12 }}
        />
      </div>

      {filtrados.length === 0 ? (
        <div style={{
          ...s.card, padding: '40px 20px', textAlign: 'center',
          color: C.muted, fontSize: 12,
        }}>
          {pedidos.length === 0
            ? 'Você ainda não recebeu nenhuma ordem de compra.'
            : 'Nenhum pedido corresponde ao filtro.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtrados.map(p => (
            <div
              key={p.ordem_venda_id}
              onClick={() => abrirDetalhe(p)}
              style={{
                ...s.card, padding: '14px 18px',
                display: 'grid',
                gridTemplateColumns: '1fr 200px 140px',
                gap: 16, alignItems: 'center',
                cursor: 'pointer',
                transition: 'border-color .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; }}
            >
              <div>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: C.text,
                  fontFamily: "'IBM Plex Mono', monospace",
                  marginBottom: 2,
                }}>
                  {p.numero}
                </div>
                <div style={{ fontSize: 12, color: C.textSub }}>
                  {p.empresa_nome}
                  {p.chamado_numero && (
                    <span style={{ color: C.muted }}> · {p.chamado_numero}</span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                  {p.total_itens} {p.total_itens === 1 ? 'item' : 'itens'} · Emitida em {fmtD(p.criado_em)}
                </div>
              </div>

              <div>
                <span style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 4,
                  background: `${p.status_cor}22`,
                  color: p.status_cor,
                  border: `1px solid ${p.status_cor}55`,
                  fontWeight: 600,
                }}>
                  {p.status_badge}
                </span>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                  {fmtBRL(p.valor_total)}
                </div>
                {p.prazo_entrega && (
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                    Prazo {p.prazo_entrega}d
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE DETALHE */}
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
              ...s.card, width: 820, maxWidth: '100%', maxHeight: '88vh',
              display: 'flex', flexDirection: 'column', padding: 0,
              overflow: 'hidden',
            }}
          >
            {carregandoDetalhe && !modalDetalhe ? (
              <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>
                Carregando pedido...
              </div>
            ) : (
              <>
                {/* Header com business card */}
                <div style={{
                  padding: '18px 22px',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 24,
                  alignItems: 'flex-start',
                  position: 'relative',
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.08em', marginBottom: 4 }}>
                      ORDEM DE COMPRA
                    </div>
                    <div style={{
                      fontSize: 18, fontWeight: 700, color: C.text,
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}>
                      {modalDetalhe.cabecalho.numero}
                    </div>
                    {modalDetalhe.cabecalho.chamado_numero && (
                      <div style={{
                        fontSize: 12, color: C.muted, marginTop: 4,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}>
                        {modalDetalhe.cabecalho.chamado_numero}
                      </div>
                    )}
                  </div>

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
                        <div style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                            href={`mailto:${modalDetalhe.contato.email}?subject=${encodeURIComponent(`Sobre a OC ${modalDetalhe.cabecalho.numero}`)}`}
                            style={{
                              flex: 1, textAlign: 'center', padding: '4px 10px', borderRadius: 6,
                              background: 'transparent', border: `1px solid ${C.border}`,
                              color: C.accent, fontSize: 11, fontWeight: 600, textDecoration: 'none',
                            }}
                          >
                            ✉️ Email
                          </a>
                        )}
                        {modalDetalhe.contato.telefone && (
                          <a
                            href={`https://wa.me/${modalDetalhe.contato.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá, sobre a OC ${modalDetalhe.cabecalho.numero}`)}`}
                            target="_blank" rel="noopener noreferrer"
                            style={{
                              flex: 1, textAlign: 'center', padding: '4px 10px', borderRadius: 6,
                              background: 'transparent', border: `1px solid ${C.border}`,
                              color: C.success, fontSize: 11, fontWeight: 600, textDecoration: 'none',
                            }}
                          >
                            💬 WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  )}

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
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
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
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.05em', marginBottom: 4 }}>EMITIDA EM</div>
                    <div style={{ fontSize: 12, color: C.text }}>{fmtD(modalDetalhe.cabecalho.criado_em)}</div>
                  </div>
                  {modalDetalhe.cabecalho.prazo_entrega && (
                    <div>
                      <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.05em', marginBottom: 4 }}>PRAZO</div>
                      <div style={{ fontSize: 12, color: C.text }}>{modalDetalhe.cabecalho.prazo_entrega} dias</div>
                    </div>
                  )}
                  {modalDetalhe.cabecalho.condicao_pagamento && (
                    <div>
                      <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.05em', marginBottom: 4 }}>PAGAMENTO</div>
                      <div style={{ fontSize: 12, color: C.text }}>{modalDetalhe.cabecalho.condicao_pagamento}</div>
                    </div>
                  )}
                </div>

                {/* Banner da NF-e anexada */}
                {modalDetalhe.nfe_atual && (
                  <div style={{
                    margin: '14px 22px 0',
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: `1px solid ${modalDetalhe.nfe_atual.status === 'ok' ? C.success + '55' : '#f59e0b55'}`,
                    background: modalDetalhe.nfe_atual.status === 'ok' ? '#0f2f1a' : '#2e1c0c',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: 20 }}>📄</span>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: modalDetalhe.nfe_atual.status === 'ok' ? C.success : '#f59e0b',
                      }}>
                        NF-e {modalDetalhe.nfe_atual.numero_nf || '—'}
                        {modalDetalhe.nfe_atual.status === 'ok'
                          ? ' · ✅ Validada'
                          : ` · ⚠️ ${modalDetalhe.nfe_atual.divergencias_count} divergência(s)`}
                      </div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 3, fontFamily: "'IBM Plex Mono', monospace" }}>
                        {modalDetalhe.nfe_atual.chave_acesso}
                      </div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                        Anexada em {fmtD(modalDetalhe.nfe_atual.enviado_em)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={handleBaixarXml}
                        style={{
                          ...s.btn(false, C.muted),
                          padding: '5px 12px', fontSize: 11,
                        }}
                      >
                        ⬇ Baixar XML
                      </button>
                      {modalDetalhe.cabecalho.status_recebimento !== 'concluido' && (
                        <button
                          onClick={abrirModalAnexar}
                          title="Substituir a NF-e atual (a anterior fica no histórico)"
                          style={{
                            ...s.btn(false, '#f59e0b'),
                            padding: '5px 12px', fontSize: 11,
                          }}
                        >
                          🔄 Substituir
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Endereço de entrega */}
                {modalDetalhe.cabecalho.endereco_entrega && (
                  <div style={{
                    padding: '10px 22px',
                    borderBottom: `1px solid ${C.border}`,
                    fontSize: 11,
                    color: C.textSub,
                  }}>
                    <span style={{ color: C.muted, letterSpacing: '0.05em', marginRight: 8 }}>📍 ENDEREÇO DE ENTREGA:</span>
                    {modalDetalhe.cabecalho.endereco_entrega}
                  </div>
                )}

                {/* Tabela de itens */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 60px 110px 110px 120px',
                    padding: '10px 22px',
                    background: C.bg,
                    borderBottom: `1px solid ${C.border}`,
                    fontSize: 10, color: C.muted,
                    letterSpacing: '0.05em', fontWeight: 600, gap: 8,
                  }}>
                    <span>ITEM</span>
                    <span>QTD</span>
                    <span style={{ textAlign: 'right' }}>VL. UNIT.</span>
                    <span style={{ textAlign: 'right' }}>VL. TOTAL</span>
                    <span style={{ textAlign: 'right' }}>RECEBIDO</span>
                  </div>

                  {modalDetalhe.itens.length === 0 ? (
                    <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 12 }}>
                      Nenhum item.
                    </div>
                  ) : modalDetalhe.itens.map((it, idx) => (
                    <div
                      key={it.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 60px 110px 110px 120px',
                        padding: '12px 22px',
                        borderBottom: idx < modalDetalhe.itens.length - 1 ? `1px solid ${C.border}22` : 'none',
                        fontSize: 12, gap: 8, alignItems: 'center',
                      }}
                    >
                      <div style={{ color: C.text }}>{it.nome}</div>
                      <span style={{ color: C.textSub }}>{it.quantidade} {it.unidade_medida}</span>
                      <span style={{ textAlign: 'right', color: C.text }}>{fmtBRL(it.valor_unitario)}</span>
                      <span style={{ textAlign: 'right', color: C.text, fontWeight: 600 }}>{fmtBRL(it.valor_total)}</span>
                      <span style={{
                        textAlign: 'right',
                        color: it.quantidade_recebida >= it.quantidade ? C.success : C.muted,
                        fontWeight: 600,
                      }}>
                        {it.quantidade_recebida} / {it.quantidade}
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
                  <div>
                    <strong style={{ color: C.text, fontSize: 16 }}>
                      {fmtBRL(modalDetalhe.cabecalho.valor_total)}
                    </strong>
                    {modalDetalhe.cabecalho.valor_frete > 0 && (
                      <span style={{ marginLeft: 8, fontSize: 11 }}>
                        (frete: {fmtBRL(modalDetalhe.cabecalho.valor_frete)})
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {!modalDetalhe.nfe_atual && modalDetalhe.cabecalho.status_recebimento !== 'concluido' && (
                      <button
                        onClick={abrirModalAnexar}
                        style={{
                          ...s.btn(true, C.accent),
                          padding: '6px 16px', fontSize: 12,
                        }}
                      >
                        📄 Anexar NF-e
                      </button>
                    )}
                    <button
                      onClick={() => setModalDetalhe(null)}
                      style={{ ...s.btn(false, C.muted), padding: '6px 16px', fontSize: 12 }}
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: ANEXAR NF-e ────────────────────────────────── */}
      {modalAnexarNfe && (
        <div
          onClick={enviandoNfe ? undefined : fecharModalAnexar}
          style={{
            position: 'fixed', inset: 0, background: '#000000c0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 700, padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              ...s.card, width: 620, maxWidth: '100%',
              maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0,
            }}
          >
            <div style={{
              padding: '18px 22px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                  📄 Anexar NF-e
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  OC {modalDetalhe?.cabecalho?.numero}
                </div>
              </div>
              {!enviandoNfe && (
                <button
                  onClick={fecharModalAnexar}
                  style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}
                >
                  ×
                </button>
              )}
            </div>

            <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
              {!resultadoAnexo && !enviandoNfe && (
                <>
                  <div style={{
                    background: '#0f1e35',
                    border: '1px solid #3b82f633',
                    borderRadius: 8,
                    padding: '12px 16px',
                    fontSize: 12,
                    color: '#d1d5db',
                    lineHeight: 1.7,
                    marginBottom: 16,
                  }}>
                    <strong style={{ color: '#3b82f6' }}>Envie o XML original da SEFAZ.</strong><br />
                    O sistema vai:
                    <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                      <li>Validar CNPJ emitente e destinatário</li>
                      <li>Conferir item por item contra a OC</li>
                      <li>Notificar o comprador automaticamente</li>
                    </ul>
                  </div>

                  {erroAnexo && (
                    <div style={{
                      padding: '10px 14px',
                      background: '#2a0f0f',
                      border: '1px solid #ef444455',
                      borderRadius: 6,
                      fontSize: 12, color: '#ef4444', marginBottom: 16,
                    }}>
                      ⚠️ {erroAnexo}
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xml,application/xml,text/xml"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleAnexarNfe(f);
                      e.target.value = '';
                    }}
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      ...s.btn(true, C.accent),
                      width: '100%', padding: '14px',
                      fontSize: 13, fontWeight: 600,
                    }}
                  >
                    📁 Selecionar arquivo XML
                  </button>
                </>
              )}

              {enviandoNfe && (
                <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
                  <div>Enviando e validando NF-e...</div>
                </div>
              )}

              {resultadoAnexo && (
                <>
                  <div style={{
                    padding: 16,
                    borderRadius: 8,
                    background: resultadoAnexo.idempotente
                      ? '#0f1e35'
                      : (resultadoAnexo.status === 'ok' ? '#0f2f1a' : '#2e1c0c'),
                    border: `1px solid ${
                      resultadoAnexo.idempotente
                        ? '#3b82f655'
                        : (resultadoAnexo.status === 'ok' ? '#22c55e55' : '#f59e0b55')
                    }`,
                    marginBottom: 16,
                  }}>
                    <div style={{
                      fontSize: 16, fontWeight: 700,
                      color: resultadoAnexo.idempotente
                        ? '#3b82f6'
                        : (resultadoAnexo.status === 'ok' ? C.success : '#f59e0b'),
                      marginBottom: 6,
                    }}>
                      {resultadoAnexo.idempotente
                        ? 'ℹ️ Esta NF-e já está anexada'
                        : (resultadoAnexo.status === 'ok'
                          ? '✅ NF-e validada com sucesso'
                          : `⚠️ ${resultadoAnexo.divergencias_count ?? 0} divergência(s)`)}
                    </div>
                    <div style={{ fontSize: 12, color: C.textSub }}>
                      {resultadoAnexo.idempotente ? (
                        <>
                          Esta NF-e (<strong>{resultadoAnexo.numero_nf || '—'}</strong>) já estava anexada
                          à OC <strong>{modalDetalhe.cabecalho.numero}</strong>. Nada foi alterado —
                          pra enviar uma NF-e diferente, emita uma nova nota com chave nova na SEFAZ.
                        </>
                      ) : (
                        <>
                          NF-e <strong>{resultadoAnexo.numero_nf || '—'}</strong> anexada à OC <strong>{modalDetalhe.cabecalho.numero}</strong>.
                          {resultadoAnexo.status === 'ok'
                            ? ' O comprador foi notificado e já pode receber.'
                            : ' Revise as pendências abaixo.'}
                        </>
                      )}
                    </div>
                  </div>

                  {resultadoAnexo.validacao && (
                    <div style={{
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      padding: 14,
                      fontSize: 12,
                    }}>
                      <div style={{ fontWeight: 600, color: C.text, marginBottom: 10, fontSize: 11, letterSpacing: '0.05em' }}>
                        RESULTADO DA VALIDAÇÃO
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        <span>{resultadoAnexo.validacao.cnpj_status === 'ok' ? '✅' : '❌'}</span>
                        <span style={{ color: C.textSub }}>{resultadoAnexo.validacao.cnpj}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                        <span>{resultadoAnexo.validacao.cnpj_destinatario?.includes('✅') ? '✅' : '❌'}</span>
                        <span style={{ color: C.textSub }}>{resultadoAnexo.validacao.cnpj_destinatario}</span>
                      </div>
                      <div style={{ borderTop: `1px solid ${C.border}44`, paddingTop: 10 }}>
                        {(resultadoAnexo.validacao.itens || []).map((v, i) => (
                          <div key={i} style={{
                            display: 'flex', gap: 8, alignItems: 'flex-start',
                            padding: '6px 0',
                            borderBottom: i < resultadoAnexo.validacao.itens.length - 1 ? `1px solid ${C.border}22` : 'none',
                          }}>
                            <span>{v.status === 'ok' ? '✅' : '⚠️'}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ color: C.text, fontWeight: 500 }}>{v.item}</div>
                              <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{v.mensagem}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{
              padding: '14px 22px',
              borderTop: `1px solid ${C.border}`,
              display: 'flex', justifyContent: 'flex-end', gap: 8,
            }}>
              {resultadoAnexo ? (
                <button
                  onClick={fecharModalAnexar}
                  style={{ ...s.btn(true, C.accent), padding: '8px 20px', fontSize: 12 }}
                >
                  Fechar
                </button>
              ) : (
                <button
                  onClick={fecharModalAnexar}
                  disabled={enviandoNfe}
                  style={{ ...s.btn(false, C.muted), padding: '8px 20px', fontSize: 12 }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}