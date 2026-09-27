// components/fornecedores/ModalDetalheNCFornecedor.jsx
//
// Detalhe de uma NC para o fornecedor: cabeçalho + thread de eventos
// visíveis + anexos + 3 ações (aceitar / contestar / resolver).
// Também aceita upload de evidência e envio de mensagem na thread.

import { useState, useRef } from 'react';
import apiService from '../../services/apiService';
import { fmtD } from '../../utils/formatters';

const STATUS_TRATATIVA = {
  nao_notificado:       { l: 'Aguardando ciência', c: '#9ca3af', icon: '⏳' },
  notificado:           { l: 'Aguardando você',    c: '#f59e0b', icon: '🔔' },
  aceita:               { l: 'Aceita por você',    c: '#10b981', icon: '✅' },
  contestada:           { l: 'Contestada',         c: '#ef4444', icon: '✋' },
  resolvida_fornecedor: { l: 'Resolvida',          c: '#3b82f6', icon: '✔️' },
};

export default function ModalDetalheNCFornecedor({ C, s, detalhe, carregando, onFechar, onAtualizar }) {
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [respondendo, setRespondendo] = useState(false);
  const [motivoResposta, setMotivoResposta] = useState('');
  const [mostrarResponder, setMostrarResponder] = useState(null); // 'aceita' | 'contestada' | 'resolvida_fornecedor'
  const [fotoAberta, setFotoAberta] = useState(null);
  const fileRef = useRef(null);

  if (carregando || !detalhe) {
    return (
      <div onClick={onFechar} style={{
        position: 'fixed', inset: 0, background: '#00000090',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 500, padding: 20,
      }}>
        <div onClick={e => e.stopPropagation()} style={{ ...s.card, padding: 60, color: C.muted }}>
          Carregando...
        </div>
      </div>
    );
  }

  const { cabecalho, descricao_problema, motivo_recusa, eventos, anexos } = detalhe;
  const cfg = STATUS_TRATATIVA[cabecalho.fornecedor_tratativa_status] || { l: '—', c: '#6b7280', icon: '⚪' };
  const podeResponder = ['nao_notificado', 'notificado'].includes(cabecalho.fornecedor_tratativa_status);

  const enviarMensagem = async () => {
    if (!mensagem.trim()) return;
    setEnviando(true);
    try {
      await apiService.post(`/fornecedor/nao-conformidades/${cabecalho.id}/mensagem`, {
        descricao: mensagem.trim(),
      });
      setMensagem('');
      onAtualizar();
    } catch (e) {
      alert('Erro: ' + e.message);
    } finally {
      setEnviando(false);
    }
  };

  const enviarAnexo = async (file) => {
    if (!file) return;
    setEnviando(true);
    try {
      const form = new FormData();
      form.append('arquivo', file);
      await apiService.upload(`/fornecedor/nao-conformidades/${cabecalho.id}/anexo`, form);
      onAtualizar();
    } catch (e) {
      alert('Erro ao enviar anexo: ' + e.message);
    } finally {
      setEnviando(false);
    }
  };

  const responder = async () => {
    if (!mostrarResponder) return;
    if (mostrarResponder === 'contestada' && !motivoResposta.trim()) {
      alert('Descreva o motivo da contestação.');
      return;
    }
    setRespondendo(true);
    try {
      await apiService.put(`/fornecedor/nao-conformidades/${cabecalho.id}/responder`, {
        resposta: mostrarResponder,
        observacao: motivoResposta.trim() || null,
      });
      setMostrarResponder(null);
      setMotivoResposta('');
      onAtualizar();
    } catch (e) {
      alert('Erro: ' + e.message);
    } finally {
      setRespondendo(false);
    }
  };

  return (
    <div onClick={onFechar} style={{
      position: 'fixed', inset: 0, background: '#00000090',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 500, padding: 20,
    }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          ...s.card, width: 820, maxWidth: '100%', maxHeight: '92vh',
          display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          position: 'relative',
        }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.08em', marginBottom: 4 }}>
              NÃO CONFORMIDADE
            </div>
            <div style={{
              fontSize: 18, fontWeight: 700, color: C.text,
              fontFamily: "'IBM Plex Mono', monospace",
            }}>
              {cabecalho.numero_nc}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
              {cabecalho.numero_pedido && `${cabecalho.numero_pedido} · `}
              {cabecalho.numero_nota_fiscal && `NF ${cabecalho.numero_nota_fiscal} · `}
              Registrada em {fmtD(cabecalho.criado_em)}
            </div>
            <div style={{ marginTop: 10 }}>
              <span style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 4,
                background: `${cfg.c}22`, color: cfg.c,
                border: `1px solid ${cfg.c}55`, fontWeight: 600,
              }}>
                {cfg.icon} {cfg.l}
              </span>
            </div>
          </div>
          <button
            onClick={onFechar}
            style={{
              background: 'transparent', border: 'none', color: C.muted,
              fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>

          {/* Motivo */}
          <div style={{
            background: '#2e1c0c',
            border: '1px solid #f59e0b55',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 10, color: '#f59e0b', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>
              MOTIVO DA RECUSA
            </div>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>
              {descricao_problema || motivo_recusa || '—'}
            </div>
            {cabecalho.quantidade && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
                Quantidade recusada: {cabecalho.quantidade} {cabecalho.unidade_medida || 'UN'}
                {cabecalho.lote && ` · Lote ${cabecalho.lote}`}
                {cabecalho.numero_serie && ` · Série ${cabecalho.numero_serie}`}
              </div>
            )}
          </div>

          {/* Anexos — thumbnails com lightbox (mesmo padrão do modal do
              comprador, ModalDetalheNC.jsx). Sem abrir nova aba. */}
          {anexos && anexos.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 }}>
                📎 EVIDÊNCIAS ({anexos.length})
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {anexos.map(a => (
                  <div key={a.id} style={{ position: 'relative' }}>
                    <img
                      src={a.url}
                      alt={a.nome_arquivo}
                      onClick={() => setFotoAberta(a)}
                      title={`${a.nome_arquivo} · ${Math.round((a.tamanho_bytes || 0) / 1024)} KB`}
                      style={{
                        width: 100, height: 100, objectFit: 'cover',
                        borderRadius: 6, cursor: 'pointer',
                        border: `1px solid ${C.border}`,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 }}>
              📋 HISTÓRICO
            </div>
            {(!eventos || eventos.length === 0) ? (
              <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic' }}>
                Nenhum evento registrado.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {eventos.map(ev => (
                  <div
                    key={ev.id}
                    style={{
                      background: '#0f172a',
                      border: `1px solid ${C.border}44`,
                      borderRadius: 6,
                      padding: '8px 12px',
                    }}
                  >
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>
                      {ev.criado_por_nome || 'Sistema'} · {new Date(ev.criado_em).toLocaleString('pt-BR')}
                      {ev.autor_tipo === 'fornecedor' && (
                        <span style={{ marginLeft: 6, color: C.accent }}>(você)</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: C.text }}>
                      {ev.descricao}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Novo comentário */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>
              ADICIONAR MENSAGEM
            </div>
            <textarea
              value={mensagem}
              onChange={e => setMensagem(e.target.value)}
              placeholder="Escreva uma mensagem para o comprador..."
              rows={2}
              style={{ ...s.input, width: '100%', resize: 'vertical', fontSize: 12 }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) enviarAnexo(f); e.target.value = ''; }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={enviando}
                style={{ ...s.btn(false, C.muted), padding: '6px 12px', fontSize: 11 }}
              >
                📎 Anexar
              </button>
              <button
                onClick={enviarMensagem}
                disabled={!mensagem.trim() || enviando}
                style={{
                  ...s.btn(true, C.accent), padding: '6px 16px', fontSize: 11,
                  opacity: (!mensagem.trim() || enviando) ? 0.5 : 1,
                }}
              >
                {enviando ? 'Enviando...' : 'Enviar mensagem'}
              </button>
            </div>
          </div>

          {/* Ações de resposta */}
          {podeResponder && (
            <div style={{
              background: '#0f1e35', border: '1px solid #3b82f633',
              borderRadius: 8, padding: '12px 16px', marginTop: 12,
            }}>
              <div style={{ fontSize: 11, color: C.accent, letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 }}>
                RESPONDER OFICIALMENTE
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setMostrarResponder('aceita')}
                  style={{ ...s.btn(true, '#10b981'), padding: '8px 14px', fontSize: 12 }}
                >
                  ✅ Aceitar NC
                </button>
                <button
                  onClick={() => setMostrarResponder('contestada')}
                  style={{ ...s.btn(true, '#ef4444'), padding: '8px 14px', fontSize: 12 }}
                >
                  ✋ Contestar
                </button>
                <button
                  onClick={() => setMostrarResponder('resolvida_fornecedor')}
                  style={{ ...s.btn(true, '#3b82f6'), padding: '8px 14px', fontSize: 12 }}
                >
                  ✔️ Resolver
                </button>
              </div>

              {mostrarResponder && (
                <div style={{ marginTop: 12, padding: 12, background: '#0f172a', borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>
                    {mostrarResponder === 'aceita' && 'Você aceita a não conformidade. Opcional: observação.'}
                    {mostrarResponder === 'contestada' && 'Descreva o motivo da contestação (obrigatório).'}
                    {mostrarResponder === 'resolvida_fornecedor' && 'Você marca como resolvida. Descreva a solução.'}
                  </div>
                  <textarea
                    value={motivoResposta}
                    onChange={e => setMotivoResposta(e.target.value)}
                    placeholder={mostrarResponder === 'contestada' ? 'Ex: peça foi testada antes do envio, anexo laudo técnico' : 'Observação (opcional)'}
                    rows={3}
                    style={{ ...s.input, width: '100%', resize: 'vertical', fontSize: 12 }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      onClick={() => { setMostrarResponder(null); setMotivoResposta(''); }}
                      style={{ ...s.btn(false, C.muted), padding: '6px 14px', fontSize: 11 }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={responder}
                      disabled={respondendo}
                      style={{ ...s.btn(true, C.accent), padding: '6px 14px', fontSize: 11 }}
                    >
                      {respondendo ? 'Enviando...' : 'Confirmar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px', borderTop: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button
            onClick={onFechar}
            style={{ ...s.btn(false, C.muted), padding: '8px 20px', fontSize: 12 }}
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {fotoAberta && (
        <div
          onClick={(e) => { e.stopPropagation(); setFotoAberta(null); }}
          style={{
            position: 'fixed', inset: 0, background: '#000000ee',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 900, cursor: 'zoom-out', padding: 30,
          }}
        >
          <img
            src={fotoAberta.url}
            alt={fotoAberta.nome_arquivo}
            style={{ maxWidth: '95%', maxHeight: '95%', borderRadius: 8 }}
          />
          <div style={{
            position: 'absolute', bottom: 20, color: 'white',
            fontSize: 11, opacity: 0.7,
          }}>
            {fotoAberta.nome_arquivo} · clique para fechar
          </div>
        </div>
      )}
    </div>
  );
}