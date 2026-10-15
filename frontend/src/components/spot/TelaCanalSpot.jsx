import { useState, useEffect } from 'react';
import apiService from '../../services/apiService';

// Reduz a imagem no navegador antes do upload: lado maior até 1280px, JPEG ~70%.
// Uma foto de celular de 4–8 MB costuma cair para 150–400 KB.
async function comprimirImagem(arquivo, ladoMax = 1280, qualidade = 0.7) {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Não foi possível ler a imagem'));
      i.src = url;
    });

    const escala = Math.min(1, ladoMax / Math.max(img.width, img.height));
    const w = Math.round(img.width * escala);
    const h = Math.round(img.height * escala);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // fundo branco para PNG com transparência
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', qualidade));
    if (!blob) throw new Error('Falha ao comprimir a imagem');

    // Se por acaso ficou maior que o original (imagem já pequena), mantém o original
    if (blob.size >= arquivo.size) return arquivo;

    const nome = arquivo.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nome, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

const LIMITE_ORIGINAL_MB = 20; // limite da foto antes de comprimir

// ─── Situação da demanda (calculada a partir de status, respostas e idade) ───
const UMA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

const SITUACOES = {
  sem_resposta:          { label: 'Sem resposta',            curto: 'Sem resposta',      cor: '#f59e0b', emoji: '🟡' },
  com_resposta:          { label: 'Com resposta',            curto: 'Com resposta',      cor: '#22c55e', emoji: '🟢' },
  sem_resposta_atrasada: { label: 'Sem resposta há +7 dias', curto: 'Sem resposta +7d',  cor: '#ef4444', emoji: '🔴' },
  com_resposta_antiga:   { label: 'Com resposta há +7 dias', curto: 'Com resposta +7d',  cor: '#a855f7', emoji: '🟣' },
  encerrada:             { label: 'Encerrada',               curto: 'Encerradas',        cor: '#000000', emoji: '⚫' },
};

function situacaoDemanda(d) {
  if (d.status === 'encerrada') return 'encerrada';
  const temResposta = (d.total_interesses || 0) > 0;
  const passouUmaSemana = d.criado_em && (Date.now() - new Date(d.criado_em).getTime()) > UMA_SEMANA_MS;
  if (temResposta) return passouUmaSemana ? 'com_resposta_antiga' : 'com_resposta';
  return passouUmaSemana ? 'sem_resposta_atrasada' : 'sem_resposta';
}

// Etiqueta da situação. A preta tem estilo próprio para ficar legível em tema escuro.
function TagSituacao({ situacao, s }) {
  const info = SITUACOES[situacao];
  if (situacao === 'encerrada') {
    return (
      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: '#000', color: '#fff', border: '1px solid #555', whiteSpace: 'nowrap' }}>
        {info.label}
      </span>
    );
  }
  return <span style={{ ...s.tag(info.cor), whiteSpace: 'nowrap' }}>{info.label}</span>;
}

const MOTIVOS_ENCERRAMENTO = {
  comprado_canal: 'Comprado de um fornecedor interessado',
  comprado_fora: 'Comprado fora do Canal Spot',
  nao_necessario: 'Não é mais necessário',
  outro: 'Outro motivo',
};

export default function TelaCanalSpot({ C, s, fmtD }) {
  const [demandas, setDemandas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroSituacao, setFiltroSituacao] = useState('todas');
  // Encerramento: { demandaId, motivo, fornecedor_vencedor_id, observacao } | null
  const [encerrando, setEncerrando] = useState(null);
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [modal, setModal] = useState(null); // <- FALTAVA: null | 'nova' | id da demanda
  const [form, setForm] = useState({
    descricao_equipamento: '',
    marca_modelo: '',
    componente: '',
    part_number: '',
    quantidade: 1,
    comentarios: '',
    urgencia: 'media'
  });

  const [fotoArquivo, setFotoArquivo] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  // Busca
  const [busca, setBusca] = useState('');

  // minúsculas + sem acento, para "valvula" achar "Válvula"
  const normalizar = (v) => String(v ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // só letras e números, para "dsp20260001" ou "6ES7 214" acharem o código com hífen/espaço
  const soAlfanum = (v) => normalizar(v).replace(/[^a-z0-9]/g, '');

  const numeroDemanda = (d) => d.numero || `DSP-${String(d.id).padStart(4, '0')}`;

  const camposPorTipo = {
    numero: (d) => [numeroDemanda(d)],
    item: (d) => [d.componente],
    part_number: (d) => [d.part_number],
    equipamento: (d) => [d.descricao_equipamento, d.marca_modelo],
  };

  // Contagem por situação (para os botões de filtro)
  const contagemSituacao = { todas: demandas.length };
  for (const d of demandas) {
    const sit = situacaoDemanda(d);
    contagemSituacao[sit] = (contagemSituacao[sit] || 0) + 1;
  }

  // 1º filtra pela situação, depois pela busca
  const demandasDaSituacao = filtroSituacao === 'todas'
    ? demandas
    : demandas.filter(d => situacaoDemanda(d) === filtroSituacao);

  const termo = busca.trim();
  const demandasFiltradas = !termo ? demandasDaSituacao : demandasDaSituacao.filter(d => {
    const termoNorm = normalizar(termo);
    const termoAlfa = soAlfanum(termo);
    // procura em todos os campos de uma vez: número, item, part number e equipamento
    return Object.entries(camposPorTipo).some(([tipo, pegarValores]) =>
      pegarValores(d).some(valor => {
        if (!valor) return false;
        if (normalizar(valor).includes(termoNorm)) return true;
        // número e PN também casam ignorando hífens, pontos e espaços
        return (tipo === 'numero' || tipo === 'part_number') && termoAlfa && soAlfanum(valor).includes(termoAlfa);
      })
    );
  });

  // Encerrar / reabrir
  const confirmarEncerramento = async () => {
    if (!encerrando?.motivo) return;
    if (encerrando.motivo === 'comprado_canal' && !encerrando.fornecedor_vencedor_id) return;
    setSalvandoStatus(true);
    try {
      await apiService.post(`/spot/demandas/${encerrando.demandaId}/encerrar`, {
        motivo: encerrando.motivo,
        fornecedor_vencedor_id: encerrando.motivo === 'comprado_canal' ? encerrando.fornecedor_vencedor_id : null,
        observacao: encerrando.observacao || null,
      });
      setEncerrando(null);
      await carregarDemandas();
    } catch (e) {
      alert('Erro ao encerrar demanda: ' + e.message);
    } finally {
      setSalvandoStatus(false);
    }
  };

  const reabrirDemanda = async (demandaId) => {
    if (!window.confirm('Reabrir esta demanda? Ela volta a aparecer para os fornecedores.')) return;
    setSalvandoStatus(true);
    try {
      await apiService.post(`/spot/demandas/${demandaId}/reabrir`, {});
      await carregarDemandas();
    } catch (e) {
      alert('Erro ao reabrir demanda: ' + e.message);
    } finally {
      setSalvandoStatus(false);
    }
  };

  const placeholderBusca = 'Buscar por número, item, part number ou equipamento...';

  // Upload de foto para uma demanda que já existe (usado no modal de detalhe)
  const enviarFotoDemanda = async (demandaId, arquivo) => {
    if (!arquivo) return;
    if (!arquivo.type.startsWith('image/')) {
      alert('Selecione um arquivo de imagem.');
      return;
    }
    if (arquivo.size > LIMITE_ORIGINAL_MB * 1024 * 1024) {
      alert(`Imagem maior que ${LIMITE_ORIGINAL_MB} MB. Escolha uma menor.`);
      return;
    }
    setEnviandoFoto(true);
    try {
      const comprimida = await comprimirImagem(arquivo);
      const fd = new FormData();
      fd.append('foto', comprimida);
      await apiService.upload(`/spot/demandas/${demandaId}/foto`, fd);
      await carregarDemandas(); // recarrega para trazer a foto_url nova
    } catch (e) {
      alert('Falha ao enviar a foto: ' + e.message);
    } finally {
      setEnviandoFoto(false);
    }
  };

  const carregarDemandas = async () => {
    try {
      const data = await apiService.get('/spot/demandas');
      setDemandas(data);
    } catch (err) {
      console.error('Erro ao carregar demandas:', err);
    } finally {
      setLoading(false);
    }
  };

  // Carrega uma vez; os filtros são aplicados aqui no frontend
  useEffect(() => {
    carregarDemandas();
  }, []);

  const criarDemanda = async () => {
    try {
      const res = await apiService.post('/spot/demandas', form);
      const demandaId = res?.demanda?.id;

      if (fotoArquivo && demandaId) {
        const fd = new FormData();
        fd.append('foto', fotoArquivo);
        try {
          await apiService.upload(`/spot/demandas/${demandaId}/foto`, fd);
        } catch (e) {
          alert('Demanda criada, mas falhou o upload da foto: ' + e.message);
        }
      }

      setModal(null);
      setForm({ descricao_equipamento: '', marca_modelo: '', componente: '', part_number: '', quantidade: 1, comentarios: '', urgencia: 'media' });
      setFotoArquivo(null);
      setFotoPreview(null);
      carregarDemandas();
    } catch (err) {
      alert('Erro ao criar demanda: ' + err.message);
    }
  };

  if (loading) return <div style={{ padding: 20, color: C.muted }}>Carregando...</div>;

  return (
    <div style={{ padding: '22px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em' }}>COMPRAS SPOT</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Canal Spot</div>
        </div>
        <button onClick={() => setModal('nova')} style={{ ...s.btn(true), padding: '9px 18px' }}>+ Nova Demanda Spot</button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {['todas', ...Object.keys(SITUACOES)].map(sit => {
          const ativo = filtroSituacao === sit;
          const rotulo = sit === 'todas' ? 'Todas' : `${SITUACOES[sit].emoji} ${SITUACOES[sit].curto}`;
          return (
            <button key={sit} onClick={() => setFiltroSituacao(sit)}
              title={sit === 'todas' ? '' : SITUACOES[sit].label}
              style={{ background: ativo ? C.accent : 'transparent', border: `1px solid ${ativo ? C.accent : C.border}`, borderRadius: 6, padding: '6px 12px', color: ativo ? 'white' : C.muted, fontSize: 11, cursor: 'pointer' }}>
              {rotulo} <span style={{ opacity: 0.7 }}>({contagemSituacao[sit] || 0})</span>
            </button>
          );
        })}
      </div>

      {/* Busca */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setBusca(''); }}
            autoFocus
            placeholder={placeholderBusca}
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
            {demandasFiltradas.length} de {demandasDaSituacao.length}
          </span>
        )}
      </div>

      {/* Lista de demandas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {demandasFiltradas.length === 0 && (
          <div style={{ ...s.card, padding: 40, textAlign: 'center', color: C.muted }}>
            {termo ? `Nenhuma demanda encontrada para "${termo}"` : 'Nenhuma demanda spot encontrada'}
          </div>
        )}
        {demandasFiltradas.map(d => {
          const sit = situacaoDemanda(d);
          return (
          <div key={d.id} onClick={() => setModal(d.id)} style={{ ...s.card, padding: '16px 20px', cursor: 'pointer', borderLeft: `4px solid ${SITUACOES[sit].cor}`, opacity: sit === 'encerrada' ? 0.75 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {d.foto_url && (
                    <img
                      src={d.foto_url}
                      alt=""
                      style={{
                        width: 66, height: 66, objectFit: 'cover',
                        borderRadius: 6, border: `1px solid ${C.border}`,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div>
                    <div style={{ fontSize: 11, color: C.accent, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, marginBottom: 2 }}>
                      {d.numero || `DSP-${String(d.id).padStart(4, '0')}`}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{d.componente}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{d.descricao_equipamento}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{d.quantidade} unidade(s) · {fmtD(d.criado_em)}</div>
                    {d.interesses && d.interesses.length > 0 && (
                      <div style={{ fontSize: 11, color: C.success, marginTop: 4, fontWeight: 500 }}>
                        🏢 {d.interesses.map(i => i.fornecedor_nome).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <TagSituacao situacao={sit} s={s} />
                <span style={{ fontSize: 12, color: d.total_interesses > 0 ? C.success : C.muted, fontWeight: d.total_interesses > 0 ? 600 : 400 }}>
                  {d.total_interesses > 0 ? `${d.total_interesses} interesse(s)` : 'Sem interesses'}
                </span>
                {d.total_visualizacoes > 0 ? (
                  <span
                    style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}
                    title={d.visualizada_em ? `1ª visualização em ${fmtD(d.visualizada_em)}` : ''}
                  >
                    👁 {d.total_visualizacoes} {d.total_visualizacoes === 1 ? 'visualização' : 'visualizações'}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: C.muted }}>
                    👁 Sem visualizações
                  </span>
                )}
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* MODAL - Detalhe da Demanda */}
      {modal && modal !== 'nova' && (() => {
        const d = demandas.find(x => x.id === modal);
        if (!d) return null;
        const valores = (d.interesses || [])
          .map(i => i.valor_estimado != null ? Number(i.valor_estimado) : null)
          .filter(v => v != null);
        const menorValor = valores.length > 1 ? Math.min(...valores) : null;
        const sit = situacaoDemanda(d);
        const vencedor = d.fornecedor_vencedor_id
          ? (d.interesses || []).find(i => i.fornecedor_id === d.fornecedor_vencedor_id)
          : null;

        return (
          <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
            <div style={{ ...s.card, width: 560, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              {/* Cabeçalho */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 10, color: C.accent, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.05em' }}>
                    {d.numero || `DSP-${String(d.id).padStart(4, '0')}`}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{d.componente}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <TagSituacao situacao={sit} s={s} />
                  <button onClick={() => setModal(null)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
                </div>
              </div>

              {/* Corpo (rolável) */}
              <div style={{ padding: '18px 22px', overflowY: 'auto' }}>
                {/* Resumo do encerramento */}
                {sit === 'encerrada' && (
                  <div style={{ fontSize: 12, color: C.text, background: C.bg, border: `1px solid ${C.border}`, borderLeft: '4px solid #000', borderRadius: 6, padding: '10px 12px', marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>
                      ⚫ Encerrada{d.encerrada_em ? ` em ${fmtD(d.encerrada_em)}` : ''}
                    </div>
                    {d.encerramento_motivo && (
                      <div style={{ color: C.muted }}>
                        {MOTIVOS_ENCERRAMENTO[d.encerramento_motivo] || d.encerramento_motivo}
                        {vencedor ? `: ${vencedor.fornecedor_nome}` : ''}
                      </div>
                    )}
                    {d.encerramento_observacao && (
                      <div style={{ color: C.muted, marginTop: 4, fontStyle: 'italic' }}>"{d.encerramento_observacao}"</div>
                    )}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{d.descricao_equipamento}</div>
                    {d.marca_modelo && <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{d.marca_modelo}</div>}
                    {d.part_number && <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>PN: {d.part_number}</div>}
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
                      {d.quantidade} unidade(s) · urgência {d.urgencia}
                    </div>
                    {d.comentarios && (
                      <div style={{ fontSize: 12, color: C.text, background: C.bg, padding: 10, borderRadius: 6, marginBottom: 16, border: `1px solid ${C.border}` }}>
                        {d.comentarios}
                      </div>
                    )}
                  </div>
                  {/* Área da foto: mostra a imagem com opção de trocar, ou o espaço para adicionar */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {d.foto_url ? (
                      <>
                        <img
                          src={d.foto_url}
                          alt=""
                          onClick={() => setFotoAmpliada(d.foto_url)}
                          style={{
                            width: '100%', maxHeight: 260, objectFit: 'cover',
                            borderRadius: 8, border: `1px solid ${C.border}`,
                            cursor: 'zoom-in', opacity: enviandoFoto ? 0.5 : 1,
                          }}
                        />
                        <label style={{
                          textAlign: 'center', fontSize: 11, color: C.accent, fontWeight: 600,
                          padding: '5px 0', border: `1px solid ${C.border}`, borderRadius: 5,
                          cursor: enviandoFoto ? 'wait' : 'pointer',
                        }}>
                          {enviandoFoto ? 'Enviando...' : '🔄 Trocar imagem'}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={enviandoFoto}
                            style={{ display: 'none' }}
                            onChange={e => {
                              enviarFotoDemanda(d.id, e.target.files?.[0]);
                              e.target.value = ''; // permite escolher o mesmo arquivo de novo
                            }}
                          />
                        </label>
                      </>
                    ) : (
                      <label style={{
                        height: 160, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 6,
                        border: `2px dashed ${C.border}`, borderRadius: 8,
                        color: C.muted, fontSize: 12, textAlign: 'center',
                        cursor: enviandoFoto ? 'wait' : 'pointer',
                      }}>
                        <span style={{ fontSize: 26 }}>{enviandoFoto ? '⏳' : '📷'}</span>
                        <span style={{ fontWeight: 600, color: C.accent }}>
                          {enviandoFoto ? 'Enviando...' : 'Adicionar imagem'}
                        </span>
                        {!enviandoFoto && <span style={{ fontSize: 10 }}>JPG ou PNG</span>}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={enviandoFoto}
                          style={{ display: 'none' }}
                          onChange={e => {
                            enviarFotoDemanda(d.id, e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.08em', marginBottom: 10 }}>
                  FORNECEDORES INTERESSADOS ({d.interesses?.length || 0})
                </div>

                {(!d.interesses || d.interesses.length === 0) ? (
                  <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: 20 }}>
                    Nenhum fornecedor manifestou interesse ainda.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {d.interesses.map(i => {
                      const ehMenor = menorValor != null && i.valor_estimado != null && Number(i.valor_estimado) === menorValor;
                      return (
                        <div key={i.id} style={{ background: C.bg, border: ehMenor ? '1px solid #22c55e55' : `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>🏢 {i.fornecedor_nome}</span>
                              {i.valor_estimado != null && (
                                <span style={{
                                  fontSize: 13, fontWeight: 700, color: C.success,
                                  background: '#22c55e22', border: '1px solid #22c55e55',
                                  padding: '2px 8px', borderRadius: 4,
                                }}>
                                  R$ {Number(i.valor_estimado).toFixed(2).replace('.', ',')}
                                </span>
                              )}
                              {ehMenor && (
                                <span title="Menor valor entre os interessados" style={{ fontSize: 11 }}>
                                  🏆 menor
                                </span>
                              )}
                            </div>
                            {i.observacao_fornecedor && (
                              <div style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>
                                📝 {i.observacao_fornecedor}
                              </div>
                            )}
                            {i.mensagem && (
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontStyle: 'italic' }}>
                                "{i.mensagem}"
                              </div>
                            )}
                            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                              {fmtD(i.criado_em)}
                            </div>
                          </div>
                          {(i.fornecedor_email || i.fornecedor_telefone || i.fornecedor_whatsapp) && (() => {
                            const numDem = d.numero || `DSP-${String(d.id).padStart(4, '0')}`;
                            const assunto = `${numDem} · ${d.componente}`;
                            const corpoEmail = [
                              `Olá, ${i.fornecedor_nome}.`,
                              '',
                              `Gostaria de conversar sobre a compra do item "${d.componente}"${d.part_number ? ` (PN: ${d.part_number})` : ''}, que você demonstrou interesse.`,
                              '',
                              `Referência: ${numDem}`,
                              '',
                              `Detalhes da demanda:`,
                              `• Equipamento: ${d.descricao_equipamento || '—'}`,
                              d.marca_modelo ? `• Marca/Modelo: ${d.marca_modelo}` : null,
                              d.part_number ? `• Part Number: ${d.part_number}` : null,
                              `• Quantidade: ${d.quantidade} unidade(s)`,
                              `• Urgência: ${d.urgencia}`,
                              '',
                              `Aguardo seu retorno.`,
                              '',
                              `Atenciosamente,`,
                              `${d.empresa_nome || 'Equipe de Compras'}`,
                            ].filter(v => v !== null).join('\n');
                            const textoWhats = [
                              `Olá, ${i.fornecedor_nome}!`,
                              '',
                              `Sobre a ${numDem}:`,
                              `Gostaria de conversar sobre a compra do item "${d.componente}"${d.part_number ? ` (PN: ${d.part_number})` : ''}, que você demonstrou interesse.`,
                              d.marca_modelo ? `Equipamento: ${d.descricao_equipamento} - ${d.marca_modelo}` : `Equipamento: ${d.descricao_equipamento || '—'}`,
                              `Quantidade: ${d.quantidade} unidade(s)`,
                            ].filter(v => v !== null).join('\n');
                            return (
                              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                {i.fornecedor_email && (
                                  <a href={`mailto:${i.fornecedor_email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpoEmail)}`}
                                     onClick={e => e.stopPropagation()}
                                     title={`Enviar email para ${i.fornecedor_email}`}
                                     style={{ padding: '5px 10px', borderRadius: 5, border: `1px solid ${C.border}`, color: C.accent, fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
                                    ✉️ Email
                                  </a>
                                )}
                                {(i.fornecedor_whatsapp || i.fornecedor_telefone) && (
                                  <a href={`https://wa.me/${(i.fornecedor_whatsapp || i.fornecedor_telefone).replace(/\D/g, '')}?text=${encodeURIComponent(textoWhats)}`}
                                     target="_blank" rel="noopener noreferrer"
                                     title={`WhatsApp: ${i.fornecedor_whatsapp || i.fornecedor_telefone}`}
                                     style={{ padding: '5px 10px', borderRadius: 5, border: `1px solid ${C.border}`, color: C.success, fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
                                    💬 WhatsApp
                                  </a>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* fim do corpo */}

              {/* Rodapé */}
              <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                {sit === 'encerrada' ? (
                  <button
                    onClick={() => reabrirDemanda(d.id)}
                    disabled={salvandoStatus}
                    style={{ ...s.btn(false), padding: '8px 18px' }}
                  >
                    ↩️ Reabrir demanda
                  </button>
                ) : (
                  <button
                    onClick={() => setEncerrando({ demandaId: d.id, motivo: '', fornecedor_vencedor_id: null, observacao: '' })}
                    disabled={salvandoStatus}
                    style={{ padding: '8px 18px', borderRadius: 6, border: '1px solid #555', background: '#000', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    ⚫ Encerrar demanda
                  </button>
                )}
                <button onClick={() => setModal(null)} style={{ ...s.btn(false), padding: '8px 18px' }}>Fechar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL - Encerrar demanda */}
      {encerrando && (() => {
        const d = demandas.find(x => x.id === encerrando.demandaId);
        if (!d) return null;
        const interessados = d.interesses || [];
        const podeConfirmar = encerrando.motivo && (encerrando.motivo !== 'comprado_canal' || encerrando.fornecedor_vencedor_id);
        const atualizar = (campos) => setEncerrando(e => ({ ...e, ...campos }));
        // Uma opção clicável (cartão). Um clique já define o desfecho.
        const opcao = ({ chave, selecionado, aoEscolher, titulo, detalhe }) => (
          <div
            key={chave}
            onClick={aoEscolher}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 6, cursor: 'pointer',
              border: `1px solid ${selecionado ? C.accent : C.border}`,
              background: selecionado ? `${C.accent}1a` : 'transparent',
            }}
          >
            <span style={{
              width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${selecionado ? C.accent : C.muted}`,
              background: selecionado ? C.accent : 'transparent',
              boxShadow: selecionado ? `inset 0 0 0 2px ${C.card || '#111'}` : 'none',
            }} />
            <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: selecionado ? 600 : 400 }}>{titulo}</span>
            {detalhe && <span style={{ fontSize: 12, color: C.success, fontWeight: 600 }}>{detalhe}</span>}
          </div>
        );

        return (
          <div style={{ position: 'fixed', inset: 0, background: '#000000a0', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 350, padding: 20 }}>
            <div style={{ ...s.card, width: 460, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{numeroDemanda(d)}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Encerrar demanda</div>
              </div>

              <div style={{ padding: '18px 22px', overflowY: 'auto' }}>
                <label style={s.label}>Quem forneceu o item? *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {interessados.length > 0 && (
                    <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.05em', marginTop: 2 }}>FORNECEDORES QUE RESPONDERAM</div>
                  )}
                  {interessados.map(i => opcao({
                    chave: `f${i.fornecedor_id}`,
                    selecionado: encerrando.motivo === 'comprado_canal' && encerrando.fornecedor_vencedor_id === i.fornecedor_id,
                    aoEscolher: () => atualizar({ motivo: 'comprado_canal', fornecedor_vencedor_id: i.fornecedor_id }),
                    titulo: `🏢 ${i.fornecedor_nome}`,
                    detalhe: i.valor_estimado != null ? `R$ ${Number(i.valor_estimado).toFixed(2).replace('.', ',')}` : 'sem valor',
                  }))}

                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.05em', marginTop: interessados.length ? 8 : 2 }}>
                    {interessados.length ? 'NENHUM DELES' : 'NENHUM FORNECEDOR RESPONDEU'}
                  </div>
                  {[
                    ['comprado_fora', '🛒 Comprei de um fornecedor fora do Canal Spot'],
                    ['nao_necessario', '🚫 Não preciso mais do item'],
                    ['outro', '✏️ Outro motivo'],
                  ].map(([motivo, titulo]) => opcao({
                    chave: motivo,
                    selecionado: encerrando.motivo === motivo,
                    aoEscolher: () => atualizar({ motivo, fornecedor_vencedor_id: null }),
                    titulo,
                  }))}
                </div>

                {interessados.length > 0 && (
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
                    🔒 Cada fornecedor verá apenas se foi escolhido ou não. Nome e preço do vencedor não são mostrados aos demais.
                  </div>
                )}
                <label style={s.label}>Observação (opcional)</label>
                <textarea
                  value={encerrando.observacao}
                  onChange={e => atualizar({ observacao: e.target.value })}
                  rows={2}
                  placeholder="Ex.: prazo de entrega melhor, peça original..."
                  style={{ ...s.input, resize: 'none' }}
                />

                <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>
                  Depois de encerrada, a demanda não recebe novos interesses. Você pode reabri-la quando quiser.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid ${C.border}` }}>
                <button onClick={() => setEncerrando(null)} disabled={salvandoStatus} style={{ ...s.btn(false), flex: 1 }}>Cancelar</button>
                <button
                  onClick={confirmarEncerramento}
                  disabled={!podeConfirmar || salvandoStatus}
                  style={{ flex: 1, padding: '8px 18px', borderRadius: 6, border: '1px solid #555', background: '#000', color: '#fff', fontSize: 12, fontWeight: 600, cursor: podeConfirmar && !salvandoStatus ? 'pointer' : 'not-allowed', opacity: podeConfirmar && !salvandoStatus ? 1 : 0.5 }}
                >
                  {salvandoStatus ? 'Encerrando...' : 'Confirmar encerramento'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {fotoAmpliada && (
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

      {/* MODAL - Nova Demanda */}
      {modal === 'nova' && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ ...s.card, width: 520, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Nova Demanda Spot</div>
              <button onClick={() => setModal(null)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
              <div style={{ marginBottom: 12 }}><label style={s.label}>Descrição do Equipamento *</label><input value={form.descricao_equipamento} onChange={e => setForm(f => ({ ...f, descricao_equipamento: e.target.value }))} style={s.input} /></div>
              <div style={{ marginBottom: 12 }}><label style={s.label}>Marca / Modelo</label><input value={form.marca_modelo} onChange={e => setForm(f => ({ ...f, marca_modelo: e.target.value }))} style={s.input} /></div>
              <div style={{ marginBottom: 12 }}><label style={s.label}>Componente *</label><input value={form.componente} onChange={e => setForm(f => ({ ...f, componente: e.target.value }))} style={s.input} autoComplete="off" name="componente_spot" /></div>
              <div style={{ marginBottom: 12 }}><label style={s.label}>Part Number</label><input value={form.part_number} onChange={e => setForm(f => ({ ...f, part_number: e.target.value }))} style={s.input} /></div>
              <div style={{ marginBottom: 12 }}><label style={s.label}>Quantidade *</label><input type="number" min="1" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: parseInt(e.target.value) || 1 }))} style={s.input} /></div>
              <div style={{ marginBottom: 12 }}><label style={s.label}>Comentários</label><textarea value={form.comentarios} onChange={e => setForm(f => ({ ...f, comentarios: e.target.value }))} rows={2} style={{ ...s.input, resize: 'none' }} /></div>
              <div style={{ marginBottom: 12 }}>
                <label style={s.label}>Urgência</label>
                <select value={form.urgencia} onChange={e => setForm(f => ({ ...f, urgencia: e.target.value }))} style={{ ...s.input, appearance: 'none' }}>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={s.label}>Foto do item (opcional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async e => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    if (f.size > LIMITE_ORIGINAL_MB * 1024 * 1024) {
                      alert(`Imagem maior que ${LIMITE_ORIGINAL_MB} MB. Escolha uma menor.`);
                      return;
                    }
                    try {
                      const comprimida = await comprimirImagem(f);
                      setFotoArquivo(comprimida);
                      setFotoPreview(URL.createObjectURL(comprimida));
                    } catch (err) {
                      alert(err.message);
                    }
                  }}
                  style={{ ...s.input, padding: 6 }}
                />
                {fotoPreview && (
                  <div style={{ marginTop: 8, position: 'relative', display: 'inline-block' }}>
                    <img
                      src={fotoPreview}
                      alt="preview"
                      style={{ maxHeight: 120, borderRadius: 6, border: `1px solid ${C.border}` }}
                    />
                    <button
                      onClick={() => {
                        setFotoArquivo(null);
                        setFotoPreview(null);
                      }}
                      style={{
                        position: 'absolute', top: 4, right: 4,
                        background: '#000000aa', border: 'none', color: '#fff',
                        width: 22, height: 22, borderRadius: '50%', cursor: 'pointer',
                        fontSize: 12, lineHeight: 1,
                      }}
                      title="Remover foto"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => setModal(null)} style={{ ...s.btn(false), flex: 1 }}>Cancelar</button>
              <button onClick={criarDemanda} disabled={!form.descricao_equipamento || !form.componente} style={{ ...s.btn(true), flex: 1 }}>Publicar Demanda</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}