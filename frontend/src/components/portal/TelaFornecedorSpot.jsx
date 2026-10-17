// components/portal/TelaFornecedorSpot.jsx
import { useState, useEffect } from 'react';
import apiService from '../../services/apiService';
import { useOpcoesAtuacao, nomeAtuacao } from '../shared/SeletorAtuacao';

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

// ─── Abas ───
// Prazos de exibição do histórico (o backend usa os mesmos valores e nem envia o que passou disso).
const DIAS_VENCIDAS = 90;
const DIAS_NAO_VENCIDAS = 30;

const ABAS = {
  andamento:    { label: 'Em andamento' },
  vencidas:     { label: '🏆 Vencidas' },
  nao_vencidas: { label: 'Não vencidas' },
  canceladas:   { label: 'Canceladas' },
};

function abaDe(d) {
  if (d.status !== 'encerrada') return 'andamento';
  if (d.meu_interesse?.status === 'escolhido') return 'vencidas';
  if (d.encerramento_motivo === 'nao_necessario') return 'canceladas';
  return 'nao_vencidas';
}

// Situações (cores) que aparecem como filtro dentro da aba "Em andamento"
const SITUACOES_ANDAMENTO = ['nao_respondida', 'respondida', 'sem_retorno'];

// Match Score (etapa 6) — faixas calculadas no backend (services/matchSpot.js).
// Nunca mostramos porcentagem: só a faixa e o porquê.
const FAIXAS_MATCH = {
  combina_muito:   { label: '⭐ Combina muito', cor: '#22c55e' },
  combina:         { label: 'Combina',          cor: '#3b82f6' },
  pode_interessar: { label: 'Pode interessar',  cor: '#94a3b8' },
};
// Comprador editou a demanda depois que este fornecedor respondeu?
const editadaDepoisDaResposta = (d) => !!(d.editada_em && d.meu_interesse &&
  new Date(d.editada_em).getTime() > new Date(d.meu_interesse.criado_em).getTime());

// Recomendada = combina com o perfil E ainda não foi respondida
const ehRecomendada = (d) => !!(d.match && d.match.faixa && !d.meu_interesse && d.status !== 'encerrada');

function TagMatch({ match }) {
  const f = match && FAIXAS_MATCH[match.faixa];
  if (!f) return null;
  return (
    <span style={{
      fontSize: 9, padding: '2px 7px', borderRadius: 10, fontWeight: 700, whiteSpace: 'nowrap',
      background: `${f.cor}22`, color: f.cor, border: `1px solid ${f.cor}55`,
    }}>
      {f.label}
    </span>
  );
}

function MotivosMatch({ match, C }) {
  if (!match || !match.motivos || !match.motivos.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
      {match.motivos.map((m, i) => (
        <span key={i} style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 10,
          background: C.bg, color: C.muted, border: `1px solid ${C.border}`,
        }}>
          {m.tipo === 'pn' ? '🎯 ' : '✓ '}{m.texto}
        </span>
      ))}
    </div>
  );
}

export default function TelaFornecedorSpot({ C, s, usuario }) {
  const [demandas, setDemandas] = useState([]);
  const { opcoes: opcoesAtuacao } = useOpcoesAtuacao(); // nomes de segmento/sistema/oferta (etapa 4)
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [aba, setAba] = useState('andamento');
  const [filtroSituacao, setFiltroSituacao] = useState('todas'); // só na aba Em andamento
  const [busca, setBusca] = useState('');
  const [valorEstimado, setValorEstimado] = useState('');
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  // null = ainda não sabe; false = fornecedor não preencheu nada de atuação
  const [temAtuacao, setTemAtuacao] = useState(null);
  const [avisoAtuacaoFechado, setAvisoAtuacaoFechado] = useState(false);
  const [planoPro, setPlanoPro] = useState(null); // null = ainda não sabe (etapa 8)

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

  // Perfil de atuação vazio → aviso para preencher (sem ele não há recomendação)
  useEffect(() => {
    apiService.get('/fornecedor/me')
      .then(r => {
        const f = r?.fornecedor || {};
        const n = (v) => (Array.isArray(v) ? v.length : 0);
        setTemAtuacao(n(f.atuacao_segmentos) + n(f.atuacao_sistemas) + n(f.atuacao_marcas) > 0);
        setPlanoPro(f.plano === 'pro' && (!f.plano_valido_ate || new Date(f.plano_valido_ate) >= new Date()));
      })
      .catch(() => setTemAtuacao(null));
  }, []);

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

  // ─── Busca (vale para todas as abas) ───
  const termo = busca.trim();
  const termoNorm = normalizar(termo);
  const termoAlfa = soAlfanum(termo);
  const casaBusca = (d) => {
    if (!termo) return true;
    const textos = [d.componente, d.descricao_equipamento, d.marca_modelo, d.empresa_nome, d.cliente_nome];
    if (textos.some(v => v && normalizar(v).includes(termoNorm))) return true;
    // número e PN: casam também ignorando hífens, pontos e espaços
    return [numeroDemanda(d), d.part_number].some(v =>
      v && (normalizar(v).includes(termoNorm) || (termoAlfa && soAlfanum(v).includes(termoAlfa)))
    );
  };
  const encontradas = demandas.filter(casaBusca);

  // Quantidade por aba (já considerando a busca)
  const porAba = { andamento: [], vencidas: [], nao_vencidas: [], canceladas: [] };
  for (const d of encontradas) porAba[abaDe(d)].push(d);

  // Dentro de "Em andamento": filtro por cor
  const contagemSit = { todas: porAba.andamento.length };
  for (const d of porAba.andamento) {
    const sit = situacaoFornecedor(d);
    contagemSit[sit] = (contagemSit[sit] || 0) + 1;
  }
  const chips = ['todas', ...SITUACOES_ANDAMENTO.filter(k => contagemSit[k] > 0 || filtroSituacao === k)];

  let daAba = porAba[aba];
  if (aba === 'andamento' && filtroSituacao !== 'todas') {
    daAba = daAba.filter(d => situacaoFornecedor(d) === filtroSituacao);
  }

  // Em andamento: recomendadas no topo (mais pontos primeiro), depois as demais, mais novas no topo.
  // Histórico: encerradas mais recentemente no topo.
  const dataOrdem = (d) => new Date((aba === 'andamento' ? d.criado_em : (d.encerrada_em || d.criado_em)) || 0).getTime();
  const ordenadas = [...daAba].sort((a, b) => {
    if (aba === 'andamento') {
      const ra = ehRecomendada(a), rb = ehRecomendada(b);
      if (ra !== rb) return ra ? -1 : 1;
      if (ra && rb && a.match.pontos !== b.match.pontos) return b.match.pontos - a.match.pontos;
    }
    return dataOrdem(b) - dataOrdem(a);
  });
  const totalRecomendadas = aba === 'andamento' ? ordenadas.filter(ehRecomendada).length : 0;

  // Resumo da aba Vencidas
  const totalVencido = porAba.vencidas.reduce((soma, d) => soma + (Number(d.meu_interesse?.valor_estimado) || 0), 0);

  const mensagemVazia = termo
    ? `Nenhuma demanda encontrada para "${termo}" nesta aba`
    : aba === 'andamento'
      ? (filtroSituacao === 'todas' ? 'Nenhuma demanda spot em aberto no momento.' : 'Nenhuma demanda nesta situação.')
      : aba === 'vencidas'
        ? `Nenhuma demanda vencida nos últimos ${DIAS_VENCIDAS} dias.`
        : aba === 'canceladas'
          ? `Nenhuma demanda cancelada nos últimos ${DIAS_NAO_VENCIDAS} dias.`
          : `Nenhuma demanda não vencida nos últimos ${DIAS_NAO_VENCIDAS} dias.`;

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

      {/* Busca única (procura em todas as abas) */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
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

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 14, overflowX: 'auto' }}>
        {Object.entries(ABAS).map(([chave, info]) => {
          const ativa = aba === chave;
          const qtd = porAba[chave].length;
          return (
            <button
              key={chave}
              onClick={() => setAba(chave)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                padding: '9px 14px', marginBottom: -1, fontSize: 13,
                fontWeight: ativa ? 700 : 500,
                color: ativa ? C.text : C.muted,
                borderBottom: `2px solid ${ativa ? C.accent : 'transparent'}`,
              }}
            >
              {info.label}{' '}
              <span style={{
                fontSize: 11, padding: '1px 7px', borderRadius: 10, marginLeft: 2,
                background: ativa ? C.accent : C.border, color: ativa ? '#fff' : C.muted,
                opacity: qtd === 0 ? 0.5 : 1,
              }}>
                {qtd}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filtros por cor (só em andamento) */}
      {aba === 'andamento' && porAba.andamento.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {chips.map(sit => {
            const ativo = filtroSituacao === sit;
            const rotulo = sit === 'todas' ? 'Todas' : `${SITUACOES[sit].emoji} ${SITUACOES[sit].curto}`;
            return (
              <button key={sit} onClick={() => setFiltroSituacao(sit)}
                title={sit === 'todas' ? '' : SITUACOES[sit].label}
                style={{ background: ativo ? C.accent : 'transparent', border: `1px solid ${ativo ? C.accent : C.border}`, borderRadius: 6, padding: '5px 12px', color: ativo ? 'white' : C.muted, fontSize: 11, cursor: 'pointer' }}>
                {rotulo} <span style={{ opacity: 0.7 }}>({contagemSit[sit] || 0})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Resumo / aviso do histórico */}
      {aba === 'vencidas' && porAba.vencidas.length > 0 && (
        <div style={{ fontSize: 12, color: C.text, marginBottom: 14 }}>
          🏆 <b>{porAba.vencidas.length}</b> {porAba.vencidas.length === 1 ? 'demanda vencida' : 'demandas vencidas'}
          {totalVencido > 0 && <> · <b style={{ color: C.success }}>{formatarReais(totalVencido)}</b> em propostas</>}
          <span style={{ color: C.muted }}> · últimos {DIAS_VENCIDAS} dias</span>
        </div>
      )}
      {(aba === 'nao_vencidas' || aba === 'canceladas') && (
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
          {aba === 'canceladas'
            ? 'Demandas que o comprador cancelou por não precisar mais do item.'
            : 'Demandas em que o comprador optou por outro fornecedor.'}
          {' '}Mostrando as encerradas nos últimos {DIAS_NAO_VENCIDAS} dias.
        </div>
      )}

      {/* Aviso: sem perfil de atuação não há recomendação */}
      {aba === 'andamento' && temAtuacao === false && !avisoAtuacaoFechado && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
          padding: '10px 14px', marginBottom: 14, borderRadius: 6, fontSize: 12,
          background: `${C.accent}12`, border: `1px solid ${C.accent}44`, color: C.text,
        }}>
          <span>
            ⭐ <b>Receba recomendações:</b> diga com o que você trabalha (segmentos, sistemas e marcas) em
            {' '}<b>Meus Dados → Atuação</b>. As demandas que combinam com você passam a aparecer no topo.
          </span>
          <button onClick={() => setAvisoAtuacaoFechado(true)} title="Fechar"
            style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Lista */}
      {ordenadas.length === 0 ? (
        <div style={{ ...s.card, padding: 40, textAlign: 'center', color: C.muted }}>
          {mensagemVazia}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ordenadas.map((d, idx) => {
            const recomendada = aba === 'andamento' && ehRecomendada(d);
            // títulos de seção: "Recomendadas para você" / "Outras demandas"
            const tituloSecao = aba !== 'andamento' || totalRecomendadas === 0 ? null
              : idx === 0 && recomendada ? `⭐ Recomendadas para você (${totalRecomendadas})`
              : idx === totalRecomendadas ? 'Outras demandas'
              : null;
            const sit = situacaoFornecedor(d);
            const urgente = d.urgencia === 'alta' && d.status !== 'encerrada';
            const novo = sit === 'nao_respondida' && !d.visto_por_mim;
            return (
              <div key={d.id}>
              {tituloSecao && (
                <div style={{ fontSize: 11, fontWeight: 700, color: recomendada ? C.text : C.muted, letterSpacing: '0.06em', margin: idx === 0 ? '0 0 8px' : '14px 0 8px' }}>
                  {tituloSecao.toUpperCase()}
                </div>
              )}
              {idx === 0 && recomendada && planoPro === false && (
                <div style={{ fontSize: 11, color: C.muted, margin: '-2px 0 10px' }}>
                  📧 Quer receber estas oportunidades por e-mail, antes dos concorrentes? Conheça o <b style={{ color: C.text }}>plano Pro</b> em Meus Dados.
                </div>
              )}
              <div
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
                        {recomendada && <TagMatch match={d.match} />}
                        <TagSituacao d={d} situacao={sit} s={s} />
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                      {d.descricao_equipamento}
                      {d.marca_modelo && ` · ${d.marca_modelo}`}
                      {d.part_number && ` · PN ${d.part_number}`}
                    </div>
                    {d.uf && (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>📍 Precisa em {d.uf}</div>
                    )}
                    {editadaDepoisDaResposta(d) ? (
                      <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4, fontWeight: 600 }}>
                        ⚠ O comprador editou a demanda depois da sua resposta ({tempoAtras(d.editada_em)})
                      </div>
                    ) : d.editada_em && d.status !== 'encerrada' ? (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontStyle: 'italic' }}>✏ editada {tempoAtras(d.editada_em)}</div>
                    ) : null}
                    {d.empresa_nome && (
                      <div style={{ fontSize: 11, color: C.accent, marginTop: 6, fontWeight: 500 }}>
                        🏢 {d.empresa_nome}{d.cliente_nome ? ` · ${d.cliente_nome}` : ''}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                      {d.quantidade} unidade(s)
                      {d.meu_interesse?.valor_estimado != null && ` · sua proposta: ${formatarReais(d.meu_interesse.valor_estimado)}`}
                    </div>
                    {recomendada && <MotivosMatch match={d.match} C={C} />}
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

                {/* Por que recomendamos (Match Score) */}
                {!encerrada && d.match && d.match.motivos && d.match.motivos.length > 0 && (
                  <div style={{ padding: '14px 22px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, color: C.muted, letterSpacing: '0.05em' }}>POR QUE COMBINA COM VOCÊ</span>
                      <TagMatch match={d.match} />
                    </div>
                    <MotivosMatch match={d.match} C={C} />
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
                    {(d.segmento || d.sistema) && (
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                        {[d.segmento && nomeAtuacao(opcoesAtuacao, 'segmento', d.segmento), d.sistema && nomeAtuacao(opcoesAtuacao, 'sistema', d.sistema)].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {(d.ofertas_aceitas || []).length > 0 && (
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                        Aceita: {d.ofertas_aceitas.map(o => nomeAtuacao(opcoesAtuacao, 'oferta', o)).join(', ')}
                      </div>
                    )}
                    {d.uf && <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>📍 Precisa em {d.uf}</div>}
                    {editadaDepoisDaResposta(d) && (
                      <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 4, fontWeight: 600 }}>
                        ⚠ Editada depois da sua resposta — confira se sua proposta ainda vale.
                      </div>
                    )}
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
