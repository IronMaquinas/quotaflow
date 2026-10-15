// components/portal/TelaFornecedorSpot.jsx
import { useState, useEffect } from 'react';
import apiService from '../../services/apiService';

function tempoAtras(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  const dias = Math.floor(diff / 86400);
  return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}

// ─── Situação da demanda do ponto de vista do fornecedor ───
const UMA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

const SITUACOES = {
  nao_respondida: { label: 'Resposta não enviada',        curto: 'Não respondidas',    cor: '#f59e0b', emoji: '🟡' },
  respondida:     { label: 'Resposta enviada',            curto: 'Respondidas',        cor: '#22c55e', emoji: '🟢' },
  sem_retorno:    { label: 'Sem retorno há +7 dias',      curto: 'Sem retorno +7d',    cor: '#ef4444', emoji: '🔴' }, // resposta enviada e comprador ainda não encerrou
  escolhido:      { label: 'Você foi escolhido',          curto: 'Escolhido',          cor: '#eab308', emoji: '🏆' },
  encerrada:      { label: 'Encerrada',                   curto: 'Encerradas',         cor: '#000000', emoji: '⚫' },
};

function situacaoFornecedor(d) {
  const mi = d.meu_interesse;
  if (d.status === 'encerrada') return mi?.status === 'escolhido' ? 'escolhido' : 'encerrada';
  if (!mi) return 'nao_respondida';
  const passouUmaSemana = mi.criado_em && (Date.now() - new Date(mi.criado_em).getTime()) > UMA_SEMANA_MS;
  return passouUmaSemana ? 'sem_retorno' : 'respondida';
}

// Etiqueta curta para demandas encerradas (sem expor quem venceu)
function rotuloEncerrada(d) {
  if (d.encerramento_motivo === 'nao_necessario') return 'Cancelada pelo comprador';
  if (d.encerramento_motivo === 'comprado_canal' || d.encerramento_motivo === 'comprado_fora') return 'Não selecionado';
  return 'Encerrada';
}

function textoEncerramento(d) {
  if (d.meu_interesse?.status === 'escolhido') {
    return 'O comprador escolheu a sua proposta. Combine os detalhes da entrega diretamente com ele.';
  }
  switch (d.encerramento_motivo) {
    case 'nao_necessario':
      return 'O comprador cancelou a demanda: o item não é mais necessário.';
    case 'comprado_canal':
    case 'comprado_fora':
      return 'O comprador optou por outro fornecedor desta vez. Obrigado pela proposta!';
    default:
      return 'O comprador encerrou esta demanda.';
  }
}

function TagSituacao({ d, situacao, s }) {
  const info = SITUACOES[situacao];
  if (situacao === 'encerrada') {
    return (
      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: '#000', color: '#fff', border: '1px solid #555', whiteSpace: 'nowrap' }}>
        {rotuloEncerrada(d)}
      </span>
    );
  }
  return <span style={{ ...s.tag(info.cor), whiteSpace: 'nowrap' }}>{info.emoji} {info.label}</span>;
}

// minúsculas + sem acento
const normalizar = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// só letras e números (para número e part number com hífen/espaço)
const soAlfanum = (v) => normalizar(v).replace(/[^a-z0-9]/g, '');

const numeroDemanda = (d) => d.numero || `DSP-${String(d.id).padStart(4, '0')}`;

const formatarReais = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;

export default function TelaFornecedorSpot({ C, s, usuario }) {
  const [demandas, setDemandas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [filtroSituacao, setFiltroSituacao] = useState('todas');
  const [busca, setBusca] = useState('');
  const [valorEstimado, setValorEstimado] = useState('');
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = async () => {
    try {
      const data = await apiService.get('/spot/fornecedor/demandas');
      setDemandas(Array.isArray(data) ? data : []);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const abrir = async (d) => {
    setDetalhe(d);
    setValorEstimado('');
    setObservacao('');
    // marca visualização (silencioso)
    if (!d.visto_por_mim) {
      try {
        await apiService.post(`/spot/fornecedor/demandas/${d.id}/visualizar`, {});
        setDemandas(lista => lista.map(x => x.id === d.id ? { ...x, visto_por_mim: new Date().toISOString() } : x));
      } catch (e) { /* ignora */ }
    }
  };

  const formatarMoedaInput = (v) => {
    const digitos = String(v).replace(/\D/g, '');
    if (!digitos) return '';
    const num = Number(digitos) / 100;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseMoeda = (v) => {
    const digitos = String(v).replace(/\D/g, '');
    if (!digitos) return null;
    return Number(digitos) / 100;
  };

  const enviarInteresse = async (d) => {
    setEnviando(true);
    try {
      await apiService.post('/spot/fornecedor/interesse', {
        demanda_id: d.id,
        mensagem: '',
        valor_estimado: parseMoeda(valorEstimado),
        observacao_fornecedor: observacao || null,
      });
      setValorEstimado('');
      setObservacao('');
      setDetalhe(null);
      carregar();
    } catch (e) {
      alert('Erro: ' + e.message);
    } finally {
      setEnviando(false);
    }
  };

  // ─── Filtros ───
  const contagem = { todas: demandas.length };
  for (const d of demandas) {
    const sit = situacaoFornecedor(d);
    contagem[sit] = (contagem[sit] || 0) + 1;
  }

  const daSituacao = filtroSituacao === 'todas'
    ? demandas
    : demandas.filter(d => situacaoFornecedor(d) === filtroSituacao);

  const termo = busca.trim();
  const termoNorm = normalizar(termo);
  const termoAlfa = soAlfanum(termo);
  const filtradas = !termo ? daSituacao : daSituacao.filter(d => {
    const textos = [d.componente, d.descricao_equipamento, d.marca_modelo, d.empresa_nome, d.cliente_nome];
    if (textos.some(v => v && normalizar(v).includes(termoNorm))) return true;
    // número e PN: casam também ignorando hífens, pontos e espaços
    return [numeroDemanda(d), d.part_number].some(v =>
      v && (normalizar(v).includes(termoNorm) || (termoAlfa && soAlfanum(v).includes(termoAlfa)))
    );
  });

  // Abertas primeiro (mais novas no topo); encerradas no fim
  const ordenadas = [...filtradas].sort((a, b) => {
    const ea = a.status === 'encerrada' ? 1 : 0;
    const eb = b.status === 'encerrada' ? 1 : 0;
    if (ea !== eb) return ea - eb;
    const da = new Date((ea ? a.encerrada_em : a.criado_em) || 0).getTime();
    const db = new Date((eb ? b.encerrada_em : b.criado_em) || 0).getTime();
    return db - da;
  });

  // Mostra só os filtros que têm demandas (menos poluição); o ativo sempre aparece
  const chips = ['todas', ...Object.keys(SITUACOES).filter(k => contagem[k] > 0 || filtroSituacao === k)];

  if (loading) return <div style={{ padding: 40, color: C.muted }}>Carregando...</div>;
  if (erro) return <div style={{ padding: 40, color: '#ef4444' }}>⚠ {erro}</div>;

  return (
    <div style={{ padding: '22px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em' }}>OPORTUNIDADES SPOT</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>
          Olá, {usuario?.nome || 'Fornecedor'}
        </div>
      </div>

      {/* Filtros por situação */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {chips.map(sit => {
          const ativo = filtroSituacao === sit;
          const rotulo = sit === 'todas' ? 'Todas' : `${SITUACOES[sit].emoji} ${SITUACOES[sit].curto}`;
          return (
            <button key={sit} onClick={() => setFiltroSituacao(sit)}
              title={sit === 'todas' ? '' : SITUACOES[sit].label}
              style={{ background: ativo ? C.accent : 'transparent', border: `1px solid ${ativo ? C.accent : C.border}`, borderRadius: 6, padding: '6px 12px', color: ativo ? 'white' : C.muted, fontSize: 11, cursor: 'pointer' }}>
              {rotulo} <span style={{ opacity: 0.7 }}>({contagem[sit] || 0})</span>
            </button>
          );
        })}
      </div>

      {/* Busca única */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setBusca(''); }}
            autoFocus
            placeholder="Buscar por número, item, part number, equipamento ou cliente..."
            style={{ ...s.input, width: '100%', paddingLeft: 32, paddingRight: busca ? 30 : undefined, boxSizing: 'border-box' }}
          />
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: C.muted, pointerEvents: 'none' }}>🔍</span>
          {busca && (
            <button
              onClick={() => setBusca('')}
              title="Limpar busca"
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: C.muted, fontSize: 16, cursor: 'pointer', lineHeight: 1 }}
            >
              ×
            </button>
          )}
        </div>
        {termo && (
          <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>
            {filtradas.length} de {daSituacao.length}
          </span>
        )}
      </div>

      {/* Lista */}
      {ordenadas.length === 0 ? (
        <div style={{ ...s.card, padding: 40, textAlign: 'center', color: C.muted }}>
          {termo
            ? `Nenhuma demanda encontrada para "${termo}"`
            : demandas.length === 0 ? 'Nenhuma demanda spot no momento.' : 'Nenhuma demanda nesta situação.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ordenadas.map(d => {
            const sit = situacaoFornecedor(d);
            const urgente = d.urgencia === 'alta' && d.status !== 'encerrada';
            const novo = sit === 'nao_respondida' && !d.visto_por_mim;
            return (
              <div
                key={d.id}
                onClick={() => abrir(d)}
                style={{
                  ...s.card,
                  padding: '16px 20px',
                  cursor: 'pointer',
                  borderLeft: `4px solid ${SITUACOES[sit].cor}`,
                  background: novo ? '#151d2e' : C.surface,
                  opacity: sit === 'encerrada' ? 0.7 : 1,
                }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {d.foto_url && (
                    <img
                      src={d.foto_url}
                      alt=""
                      style={{
                        width: 110, height: 110, objectFit: 'cover',
                        borderRadius: 6, border: `1px solid ${C.border}`,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: C.accent, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.05em' }}>
                          {numeroDemanda(d)}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                          {d.componente}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {urgente && (
                          <span style={{
                            fontSize: 9, padding: '2px 6px', borderRadius: 3,
                            background: '#ef444422', color: '#ef4444',
                            border: '1px solid #ef444455', fontWeight: 700,
                          }}>
                            URGENTE
                          </span>
                        )}
                        <TagSituacao d={d} situacao={sit} s={s} />
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                      {d.descricao_equipamento}
                      {d.marca_modelo && ` · ${d.marca_modelo}`}
                      {d.part_number && ` · PN ${d.part_number}`}
                    </div>
                    {d.empresa_nome && (
                      <div style={{ fontSize: 11, color: C.accent, marginTop: 6, fontWeight: 500 }}>
                        🏢 {d.empresa_nome}{d.cliente_nome ? ` · ${d.cliente_nome}` : ''}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                      {d.quantidade} unidade(s)
                      {d.meu_interesse?.valor_estimado != null && ` · sua proposta: ${formatarReais(d.meu_interesse.valor_estimado)}`}
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                      <span style={{ color: C.muted }}>🕐 publicada {tempoAtras(d.criado_em)}</span>
                      {d.meu_interesse ? (
                        <span style={{ color: C.muted }}>✓ respondida {tempoAtras(d.meu_interesse.criado_em)}</span>
                      ) : d.visto_por_mim ? (
                        <span style={{ color: C.muted }}>👁 Você visualizou</span>
                      ) : (
                        <span style={{ color: C.accent, fontWeight: 600 }}>● Nova</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL - Detalhe */}
      {detalhe && (() => {
        // pega a versão mais recente da lista (ex.: após recarregar)
        const d = demandas.find(x => x.id === detalhe.id) || detalhe;
        const sit = situacaoFornecedor(d);
        const encerrada = d.status === 'encerrada';
        const mi = d.meu_interesse;

        return (
          <div
            onClick={() => setDetalhe(null)}
            style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ ...s.card, width: 520, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            >
              {/* Cabeçalho */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '18px 22px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: C.accent, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.05em' }}>
                    {numeroDemanda(d)}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{d.componente}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <TagSituacao d={d} situacao={sit} s={s} />
                  <button onClick={() => setDetalhe(null)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
                </div>
              </div>

              {/* Corpo (rolável) */}
              <div style={{ overflowY: 'auto' }}>
                {/* Resultado (demanda encerrada) */}
                {encerrada && (
                  <div style={{
                    margin: '16px 22px 0', padding: '12px 14px', borderRadius: 6, fontSize: 12,
                    background: sit === 'escolhido' ? '#eab30815' : C.bg,
                    border: `1px solid ${sit === 'escolhido' ? '#eab30866' : C.border}`,
                    borderLeft: `4px solid ${sit === 'escolhido' ? '#eab308' : '#000'}`,
                    color: C.text,
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                      {sit === 'escolhido' ? '🏆 Parabéns, você foi escolhido!' : `⚫ ${rotuloEncerrada(d)}`}
                    </div>
                    <div style={{ color: C.textSub }}>{textoEncerramento(d)}</div>
                    {d.encerrada_em && (
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>Encerrada {tempoAtras(d.encerrada_em)}</div>
                    )}
                  </div>
                )}

                {/* Solicitante */}
                <div style={{ padding: '14px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.05em', marginBottom: 2 }}>
                    SOLICITANTE
                  </div>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>
                    🏢 {d.empresa_nome || '—'}
                  </div>
                  <div style={{ fontSize: 12, color: C.textSub }}>
                    👤 {d.cliente_nome || '—'}
                  </div>
                  {d.cliente_email && (
                    <div style={{ fontSize: 11, color: C.muted }}>📧 {d.cliente_email}</div>
                  )}
                  {d.cliente_telefone && (
                    <div style={{ fontSize: 11, color: C.muted }}>📞 {d.cliente_telefone}</div>
                  )}
                  {(d.cliente_email || d.cliente_telefone) && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      {d.cliente_email && (
                        <a
                          href={`mailto:${d.cliente_email}?subject=${encodeURIComponent(`${numeroDemanda(d)} · ${d.componente}`)}`}
                          style={{
                            flex: 1, textAlign: 'center', padding: '6px 10px', borderRadius: 6,
                            background: 'transparent', border: `1px solid ${C.border}`,
                            color: C.accent, fontSize: 11, fontWeight: 600, textDecoration: 'none',
                          }}
                        >
                          ✉️ Email
                        </a>
                      )}
                      {d.cliente_telefone && (
                        <a
                          href={`https://wa.me/${d.cliente_telefone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá, sobre a demanda spot ${numeroDemanda(d)}: ${d.componente}`)}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{
                            flex: 1, textAlign: 'center', padding: '6px 10px', borderRadius: 6,
                            background: 'transparent', border: `1px solid ${C.border}`,
                            color: C.success, fontSize: 11, fontWeight: 600, textDecoration: 'none',
                          }}
                        >
                          💬 WhatsApp
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Dados do item */}
                <div style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: d.foto_url ? '1fr 220px' : '1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{d.descricao_equipamento}</div>
                    {d.marca_modelo && <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{d.marca_modelo}</div>}
                    {d.part_number && <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>PN: {d.part_number}</div>}
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
                      {d.quantidade} unidade(s) · urgência {d.urgencia}
                    </div>
                    {d.comentarios && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.05em', marginBottom: 4 }}>
                          COMENTÁRIOS:
                        </div>
                        <div style={{ fontSize: 12, color: C.text, background: C.bg, padding: 10, borderRadius: 6, border: `1px solid ${C.border}` }}>
                          {d.comentarios}
                        </div>
                      </div>
                    )}
                  </div>
                  {d.foto_url && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                      <img
                        src={d.foto_url}
                        alt=""
                        onClick={() => setFotoAmpliada(d.foto_url)}
                        style={{
                          width: '100%', maxHeight: 260, objectFit: 'cover',
                          borderRadius: 8, border: `1px solid ${C.border}`,
                          cursor: 'zoom-in',
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Minha resposta (já enviada) */}
                {mi && (
                  <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.05em', marginBottom: 6 }}>SUA RESPOSTA</div>
                    <div style={{ fontSize: 12, color: C.text }}>
                      {mi.valor_estimado != null ? formatarReais(mi.valor_estimado) : 'Sem valor informado'}
                      <span style={{ color: C.muted }}> · enviada {tempoAtras(mi.criado_em)}</span>
                    </div>
                    {mi.observacao_fornecedor && (
                      <div style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>📝 {mi.observacao_fornecedor}</div>
                    )}
                    {!encerrada && (
                      <div style={{ fontSize: 11, marginTop: 8, color: sit === 'sem_retorno' ? '#ef4444' : C.muted }}>
                        {sit === 'sem_retorno'
                          ? 'Há mais de 7 dias sem decisão do comprador. Vale a pena chamá-lo pelos botões acima.'
                          : 'Aguardando a decisão do comprador.'}
                      </div>
                    )}
                  </div>
                )}

                {/* Formulário de interesse */}
                {!mi && !encerrada && (
                  <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={{ ...s.label, fontSize: 10 }}>VALOR ESTIMADO (OPCIONAL)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={valorEstimado}
                        onChange={e => setValorEstimado(formatarMoedaInput(e.target.value))}
                        placeholder="0,00"
                        style={s.input}
                      />
                    </div>
                    <div>
                      <label style={{ ...s.label, fontSize: 10 }}>OBSERVAÇÃO (OPCIONAL)</label>
                      <textarea
                        value={observacao}
                        onChange={e => setObservacao(e.target.value)}
                        rows={2}
                        placeholder="Ex: Tenho pronta entrega, peça original"
                        style={{ ...s.input, resize: 'none' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Rodapé */}
              <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setDetalhe(null)} style={{ ...s.btn(false), padding: '8px 18px' }}>Fechar</button>
                {!mi && !encerrada && (
                  <button onClick={() => enviarInteresse(d)} disabled={enviando} style={{ ...s.btn(true, C.accent), padding: '8px 18px' }}>
                    {enviando ? 'Enviando...' : 'Tenho interesse →'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {fotoAmpliada && detalhe && (
        <div
          onClick={() => setFotoAmpliada(null)}
          style={{ position: 'fixed', inset: 0, background: '#000000ee', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}
        >
          <img
            src={fotoAmpliada}
            alt=""
            style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain' }}
          />
        </div>
      )}
    </div>
  );
}