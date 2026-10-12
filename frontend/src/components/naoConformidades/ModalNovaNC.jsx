// frontend/src/components/naoConformidades/ModalNovaNC.jsx
//
// M4.5: abertura manual de Não Conformidade. Substitui o "em construção"
// do botão "➕ Nova NC" da TelaNaoConformidades.
//
// Identidade visual alinhada ao ModalDetalheNC:
//   • Mesmos labels (s.label)
//   • Grid 2 colunas com gap 10
//   • Evidências em miniatura 100x100 com botão × vermelho no canto
//   • Botões "📷 Câmera" e "🖼 Galeria" no header da seção
//   • Lightbox pra ver imagem grande
//
// Fluxo:
//   1. Usuário preenche tudo (contexto, item, data/hora, rastreabilidade, anexos).
//   2. Anexos ficam em memória (data URI local) com preview.
//   3. Ao clicar em "Registrar NC":
//      a. POST /nao-conformidades com o payload
//      b. Em sequência, POST /:id/anexos com cada arquivo (base64 → Storage)
//   4. Fecha e chama onAtualizar() da lista.
//
// Autocomplete de item reaproveita o endpoint /catalogo/buscar-item (mesmo
// padrão da TelaOrdemServico — debounce 350ms, cancelamento por chamada
// obsoleta, mínimo 2 chars).

import { useState, useRef, useEffect } from 'react';
import apiService from '../../services/apiService';

const LIMITE_ANEXO_BYTES = 50 * 1024 * 1024; // 50MB por arquivo

const ORIGENS = [
  { id: 'inspecao', label: '🔎 Inspeção' },
  { id: 'os_material', label: '📦 Material na OS' },
  { id: 'os_servico', label: '🛠 Serviço na OS' },
  { id: 'recebimento', label: '📥 Recebimento' },
  { id: 'pos_venda', label: '📞 Pós-venda' },
];

const UNIDADES = ['UN', 'KG', 'L', 'M', 'CX', 'PC', 'PAR', 'M²', 'M³'];

// Abre um data URI numa nova aba via Blob URL. Necessário porque
// navegadores bloqueiam navegação direta pra `data:` (proteção anti-
// phishing). O Blob é local, do próprio navegador — não sobe pra lugar
// nenhum.
function abrirAnexoEmNovaAba(dataUri, mimeType, nomeArquivo) {
  try {
    const [meta, base64] = dataUri.split(',');
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    // M4.5-fix: SEM `noopener`/`noreferrer` no window.open. Eles são
    // boa prática de segurança, mas com Blob URL de PDF quebram o viewer
    // inline em Safari e Chrome — o navegador abre a aba vazia E baixa
    // o arquivo. Sem as flags, o PDF renderiza direto na aba nova.
    const w = window.open(url, '_blank');
    if (!w) {
      // Popup bloqueado — fallback: download
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo || 'anexo';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    // M4.5-fix: NÃO revoga o Blob URL por timeout. Se o navegador estiver
    // lento pra renderizar o PDF, o revoke mata a URL antes — e ele cai
    // no download de novo. Deixa o navegador liberar quando fechar a aba
    // (GC cuida sozinho).
  } catch (e) {
    console.warn('Falha ao abrir anexo em nova aba:', e);
  }
}

// ── Compressão de imagem client-side (mesmo padrão do ModalDetalheNC) ──
function comprimirImagem(file, { maxDim = 1200, quality = 0.75 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Arquivo não é imagem'));
      return;
    }
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Erro ao ler arquivo'));
    leitor.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Erro ao processar imagem'));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height >= width && height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUri = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUri.split(',')[1] || '';
        const tamanhoBytes = Math.round((base64.length * 3) / 4);
        resolve({ dataUri, base64, mime_type: 'image/jpeg', tamanho_bytes: tamanhoBytes });
      };
      img.src = ev.target.result;
    };
    leitor.readAsDataURL(file);
  });
}

// Lê PDF (ou qualquer não-imagem) direto pro base64, sem compressão.
function lerBase64(file) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Erro ao ler arquivo'));
    leitor.onload = (ev) => {
      const dataUri = ev.target.result;
      const base64 = dataUri.split(',')[1] || '';
      const tamanhoBytes = Math.round((base64.length * 3) / 4);
      resolve({ dataUri, base64, mime_type: file.type, tamanho_bytes: tamanhoBytes });
    };
    leitor.readAsDataURL(file);
  });
}

function fmtBytes(b) {
  if (b == null) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function truncarNome(nome, max = 14) {
  if (!nome || nome.length <= max) return nome;
  const ext = nome.includes('.') ? nome.slice(nome.lastIndexOf('.')) : '';
  const base = nome.slice(0, nome.length - ext.length);
  return `${base.slice(0, max - ext.length - 1)}…${ext}`;
}

export default function ModalNovaNC({ C, s, onFechar, onAtualizar }) {
  // ── Contexto ──
  const [origem, setOrigem] = useState('inspecao');
  const [descricao, setDescricao] = useState('');
  const [acaoImediata, setAcaoImediata] = useState('');
  // M4.5-fix: disposição e custo estimado removidos da abertura.
  // Disposição entra no fluxo interno (registrar-disposicao);
  // custo entra por valor do item + horas (etapa futura).

  // ── Item (autocomplete do catálogo) ──
  const [itemTexto, setItemTexto] = useState('');
  const [itemSku, setItemSku] = useState('');
  const [itemCatalogoId, setItemCatalogoId] = useState(null);
  const [itemConsumoId, setItemConsumoId] = useState(null);
  const [itemSugestoes, setItemSugestoes] = useState([]);
  const [itemShowSugestoes, setItemShowSugestoes] = useState(false);
  const [itemBuscando, setItemBuscando] = useState(false);
  const buscaItemRef = useRef({ timer: null, ultimaChamadaId: 0 });

  // ── Rastreabilidade ──
  const [quantidade, setQuantidade] = useState('');
  const [unidade, setUnidade] = useState('UN');
  const [lote, setLote] = useState('');
  const [numeroSerie, setNumeroSerie] = useState('');
  const [validade, setValidade] = useState('');
  const [numeroNotaFiscal, setNumeroNotaFiscal] = useState('');

  // ── Data da ocorrência (D2 + checkbox "Agora") ──
  const [dataOcorrencia, setDataOcorrencia] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [horaOcorrencia, setHoraOcorrencia] = useState('');
  const [agora, setAgora] = useState(true);

  // ── Anexos (multi, com preview via data URI local) ──
  const [anexos, setAnexos] = useState([]);
  // cada: { id_local, nome, mime_type, tamanho_bytes, base64, dataUri }
  const [fotoAberta, setFotoAberta] = useState(null);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const cameraInputRef = useRef(null);
  const galeriaInputRef = useRef(null);

  // ── Estado geral ──
  const [salvando, setSalvando] = useState(false);
  const [progressoAnexo, setProgressoAnexo] = useState(null);
  const [erro, setErro] = useState(null);

  // Auto-preenche hora quando "Agora" está marcado
  useEffect(() => {
    if (agora) {
      const d = new Date();
      setDataOcorrencia(d.toISOString().slice(0, 10));
      setHoraOcorrencia(
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      );
    }
  }, [agora]);

  // ── Busca de item (mesmo padrão da TelaOrdemServico) ──
  function buscarSugestoesItem(termo) {
    const ctrl = buscaItemRef.current;
    if (ctrl.timer) clearTimeout(ctrl.timer);

    if (termo.trim().length < 2) {
      ctrl.ultimaChamadaId += 1;
      setItemSugestoes([]);
      setItemShowSugestoes(false);
      setItemBuscando(false);
      return;
    }

    setItemBuscando(true);
    ctrl.timer = setTimeout(async () => {
      const chamadaId = ++ctrl.ultimaChamadaId;
      try {
        const resp = await apiService.get('/nao-conformidades/buscar-item', { termo, limit: 8 });
        if (chamadaId !== ctrl.ultimaChamadaId) return;
        const resultados = resp?.resultados || [];
        setItemSugestoes(resultados);
        setItemShowSugestoes(resultados.length > 0);
      } catch (err) {
        if (chamadaId !== ctrl.ultimaChamadaId) return;
        console.warn('⚠ /catalogo/buscar-item indisponível:', err.message);
        setItemSugestoes([]);
        setItemShowSugestoes(false);
      } finally {
        if (chamadaId === ctrl.ultimaChamadaId) setItemBuscando(false);
      }
    }, 350);
  }

  function selecionarSugestaoItem(sug) {
    setItemTexto(sug.nome || '');
    setItemSku(sug.sku || '');
    // M4.5: o backend já resolveu qual é o item. Guarda os vínculos
    // que vierem — o usuário não escolhe.
    setItemCatalogoId(sug.catalogo_item_id || null);
    setItemConsumoId(sug.item_consumo_id || null);
    setItemSugestoes([]);
    setItemShowSugestoes(false);
  }

  // ── Anexos ──
  async function onArquivosSelecionados(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';
    setErro(null);
    setEnviandoAnexo(true);
    const novos = [];
    for (const file of files) {
      if (file.size > LIMITE_ANEXO_BYTES) {
        setErro(`Arquivo "${file.name}" excede o limite de ${fmtBytes(LIMITE_ANEXO_BYTES)}.`);
        continue;
      }
      try {
        const ehImagem = file.type.startsWith('image/');
        const { dataUri, base64, mime_type, tamanho_bytes } = ehImagem
          ? await comprimirImagem(file)
          : await lerBase64(file);
        novos.push({
          id_local: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          nome: file.name,
          mime_type,
          tamanho_bytes,
          base64,
          dataUri,
        });
      } catch (err) {
        setErro(`Falha ao processar "${file.name}": ${err.message}`);
      }
    }
    setEnviandoAnexo(false);
    if (novos.length > 0) setAnexos(prev => [...prev, ...novos]);
  }

  function removerAnexoLocal(idLocal) {
    const alvo = anexos.find(a => a.id_local === idLocal);
    const nome = alvo?.nome || 'este anexo';
    if (!window.confirm(`Remover "${nome}"?\n\nEssa ação não pode ser desfeita.`)) return;
    setAnexos(prev => prev.filter(a => a.id_local !== idLocal));
  }

  // ── Submit ──
  async function salvar() {
    if (descricao.trim().length < 10) {
      setErro('A descrição do problema precisa ter pelo menos 10 caracteres.');
      return;
    }
    if (itemTexto.trim().length === 0) {
      setErro('Informe o item (nome ou descrição do que apresentou o problema).');
      return;
    }
    if (agora === false && (!dataOcorrencia || !horaOcorrencia)) {
      setErro('Informe a data e a hora da ocorrência, ou marque "Agora".');
      return;
    }

    setSalvando(true);
    setErro(null);

    let dataOcorrenciaIso = null;
    if (dataOcorrencia && horaOcorrencia) {
      try {
        dataOcorrenciaIso = new Date(`${dataOcorrencia}T${horaOcorrencia}:00`).toISOString();
      } catch (_) {
        dataOcorrenciaIso = null;
      }
    }

    const payload = {
      origem,
      descricao_problema: descricao.trim(),
      acao_imediata: acaoImediata.trim() || null,
      // M4.5-fix: disposição e custo estimado NÃO vão daqui. Backend cai
      // no default "pendente" pra disposição e null pro custo.
      quantidade_afetada: quantidade !== '' ? parseFloat(quantidade) : null,
      item_catalogo_id: itemCatalogoId || null,
      item_consumo_id: itemConsumoId || null,
      item_nome_avulso: !itemCatalogoId && !itemConsumoId ? itemTexto.trim() : null,
      numero_nota_fiscal: numeroNotaFiscal.trim() || null,
      unidade_medida: unidade || null,
      lote: lote.trim() || null,
      numero_serie: numeroSerie.trim() || null,
      validade: validade || null,
      data_ocorrencia: dataOcorrenciaIso,
    };

    try {
      const r = await apiService.post('/nao-conformidades', payload);
      const ncCriadaId = r?.nc?.id;
      if (!ncCriadaId) throw new Error('Backend não devolveu o id da NC criada');

      if (anexos.length > 0) {
        const total = anexos.length;
        const falhas = [];
        for (let i = 0; i < total; i++) {
          setProgressoAnexo({ atual: i + 1, total });
          const a = anexos[i];
          try {
            await apiService.post(`/nao-conformidades/${ncCriadaId}/anexos`, {
              base64: a.base64,
              mime_type: a.mime_type,
              nome_arquivo: a.nome,
            });
          } catch (err) {
            falhas.push(`${a.nome}: ${err.message}`);
          }
        }
        setProgressoAnexo(null);
        if (falhas.length > 0) {
          alert(`NC ${r?.nc?.numero_nc || ''} registrada, mas ${falhas.length} anexo(s) falharam:\n\n${falhas.join('\n')}\n\nVocê pode anexar de novo pelo detalhe da NC.`);
        }
      }

      onAtualizar?.();
      onFechar?.();
    } catch (e) {
      setErro(e.message || 'Erro ao registrar NC');
      setSalvando(false);
      setProgressoAnexo(null);
    }
  }

  const podeSalvar = !salvando && descricao.trim().length >= 10 && itemTexto.trim().length > 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000090',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 400, padding: 20 }}>
      <div style={{ ...s.card, width: 880, maxWidth: '100%', maxHeight: '92vh',
                    display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
              ⚠️ Nova Não Conformidade
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              Registro manual — qualquer área pode abrir
            </div>
          </div>
          <button onClick={onFechar} disabled={salvando}
            style={{ background: 'transparent', border: 'none',
                     color: C.muted, fontSize: 22, cursor: 'pointer',
                     lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>

          {erro && (
            <div style={{ padding: '10px 12px', background: '#ef444415',
                          border: '1px solid #ef444440', borderRadius: 6,
                          fontSize: 12, color: '#ef4444', marginBottom: 14 }}>
              ⚠ {erro}
            </div>
          )}

          {/* Linha 1: origem + data/hora da ocorrência */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={s.label}>ORIGEM *</label>
              <select value={origem} onChange={e => setOrigem(e.target.value)}
                style={{ ...s.input, appearance: 'none' }}>
                {ORIGENS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>
                DATA E HORA DA OCORRÊNCIA *
                <span style={{ marginLeft: 8, fontSize: 10, color: C.muted, fontWeight: 400 }}>
                  <input type="checkbox" checked={agora}
                    onChange={e => setAgora(e.target.checked)}
                    style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Agora
                </span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8 }}>
                <input type="date" value={dataOcorrencia}
                  onChange={e => { setDataOcorrencia(e.target.value); setAgora(false); }}
                  disabled={agora} style={s.input} />
                <input type="time" value={horaOcorrencia}
                  onChange={e => { setHoraOcorrencia(e.target.value); setAgora(false); }}
                  disabled={agora} style={s.input} />
              </div>
            </div>
          </div>

          {/* Linha 2: item (autocomplete) + part number */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 14 }}>
            <div style={{ position: 'relative' }}>
              <label style={s.label}>ITEM *</label>
              <div style={{ position: 'relative' }}>
                <input type="text" value={itemTexto}
                  onChange={e => {
                    setItemTexto(e.target.value);
                    setItemCatalogoId(null);
                    buscarSugestoesItem(e.target.value);
                  }}
                  onFocus={() => { if (itemSugestoes.length > 0) setItemShowSugestoes(true); }}
                  onBlur={() => setTimeout(() => setItemShowSugestoes(false), 200)}
                  placeholder="Ex: Rolamento SKF 6205"
                  style={s.input} />

                {itemBuscando && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0,
                                background: C.bg, border: `1px solid ${C.border}`,
                                borderTop: 'none', borderRadius: '0 0 6px 6px',
                                zIndex: 100, padding: '8px 12px', fontSize: 11, color: C.muted }}>
                    Buscando...
                  </div>
                )}
                {!itemBuscando && itemShowSugestoes && itemSugestoes.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0,
                                background: C.bg, border: `1px solid ${C.border}`,
                                borderTop: 'none', borderRadius: '0 0 6px 6px',
                                zIndex: 100, maxHeight: 220, overflowY: 'auto',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                    {itemSugestoes.map((sug, i) => {
                      const partesInfo = [];
                      if (sug.sku) partesInfo.push(`PN: ${sug.sku}`);

                      return (
                        <div key={`${sug.item_consumo_id || sug.catalogo_item_id || i}`}
                          onClick={() => selecionarSugestaoItem(sug)}
                          style={{ padding: '10px 12px', cursor: 'pointer',
                                   borderBottom: `1px solid ${C.border}22`, fontSize: 12,
                                   display: 'flex', alignItems: 'center', gap: 8 }}
                          onMouseEnter={e => e.currentTarget.style.background = '#1e2a3f'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: C.text, fontWeight: 500 }}>{sug.nome}</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                              {partesInfo.join(' · ')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {!itemCatalogoId && !itemConsumoId && itemTexto.trim().length > 0 && (
                <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>
                  ⚠ Item em texto livre — a Qualidade vai revisar e vincular depois.
                </div>
              )}
            </div>
            <div>
              <label style={s.label}>PART NUMBER</label>
              <input type="text" value={itemSku} onChange={e => setItemSku(e.target.value)}
                placeholder="Ex: SKF-6205" style={s.input} />
            </div>
          </div>

          {/* Linha 3: qtd + unidade + NF */}
          <div style={{ display: 'grid', gridTemplateColumns: '90px 90px 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={s.label}>QTD</label>
              <input type="number" min="0" step="any" value={quantidade}
                onChange={e => setQuantidade(e.target.value)}
                style={{ ...s.input, textAlign: 'center' }} />
            </div>
            <div>
              <label style={s.label}>UNIDADE</label>
              <select value={unidade} onChange={e => setUnidade(e.target.value)}
                style={{ ...s.input, appearance: 'none' }}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>NÚMERO DA NF</label>
              <input type="text" value={numeroNotaFiscal}
                onChange={e => setNumeroNotaFiscal(e.target.value)}
                placeholder="Ex: 12345" style={s.input} />
            </div>
          </div>

          {/* Linha 4: lote + série + validade */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={s.label}>LOTE</label>
              <input type="text" value={lote} onChange={e => setLote(e.target.value)}
                placeholder="Ex: L2026-09" style={s.input} />
            </div>
            <div>
              <label style={s.label}>NÚMERO DE SÉRIE</label>
              <input type="text" value={numeroSerie} onChange={e => setNumeroSerie(e.target.value)}
                placeholder="Ex: SN-12345" style={s.input} />
            </div>
            <div>
              <label style={s.label}>VALIDADE</label>
              <input type="date" value={validade} onChange={e => setValidade(e.target.value)}
                style={s.input} />
            </div>
          </div>

          {/* Descrição do problema */}
          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>DESCRIÇÃO DO PROBLEMA *</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder="Descreva o problema: o que, onde, quando, como foi detectado."
              style={{ ...s.input, minHeight: 90, resize: 'vertical' }} />
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
              Mínimo 10 caracteres · {descricao.length} digitados
            </div>
          </div>

          {/* Ação imediata */}
          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>AÇÃO IMEDIATA / CONTENÇÃO</label>
            <textarea value={acaoImediata} onChange={e => setAcaoImediata(e.target.value)}
              placeholder="Ex: Peça isolada e identificada com fita vermelha. Lote separado pra análise."
              style={{ ...s.input, minHeight: 70, resize: 'vertical' }} />
          </div>

          {/* M4.5-fix: Disposição e Custo Estimado REMOVIDOS daqui.
              Disposição é decisão pós-análise (responsável da área).
              Custo entra pelo valor do item + horas associadas, em etapa
              própria. Quem abre NC só descreve o problema. */}

          {/* ── Evidências ── */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.08em',
                            fontWeight: 600 }}>
                EVIDÊNCIAS ({anexos.length})
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input ref={cameraInputRef} type="file" accept="image/*"
                  capture="environment" multiple
                  style={{ display: 'none' }}
                  onChange={onArquivosSelecionados} />
                <input ref={galeriaInputRef} type="file" accept="image/*,application/pdf"
                  multiple
                  style={{ display: 'none' }}
                  onChange={onArquivosSelecionados} />
                <button type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={enviandoAnexo || salvando}
                  style={{ background: 'transparent', border: 'none',
                           color: C.accent, fontSize: 11, cursor: 'pointer',
                           fontFamily: 'inherit', padding: 0,
                           opacity: (enviandoAnexo || salvando) ? 0.5 : 1 }}>
                  {enviandoAnexo ? 'Processando...' : '📷 Câmera'}
                </button>
                <button type="button"
                  onClick={() => galeriaInputRef.current?.click()}
                  disabled={enviandoAnexo || salvando}
                  style={{ background: 'transparent', border: 'none',
                           color: C.accent, fontSize: 11, cursor: 'pointer',
                           fontFamily: 'inherit', padding: 0,
                           opacity: (enviandoAnexo || salvando) ? 0.5 : 1 }}>
                  🖼 Galeria / PDF
                </button>
              </div>
            </div>

            {anexos.length === 0 ? (
              <div style={{ fontSize: 11, color: C.muted }}>
                Nenhuma evidência anexada. Aceita imagens e PDF até {fmtBytes(LIMITE_ANEXO_BYTES)} por arquivo.
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {anexos.map(a => {
                  const ehImagem = a.mime_type?.startsWith('image/');
                  return (
                    <div key={a.id_local} style={{ position: 'relative' }}>
                      {ehImagem ? (
                        <img src={a.dataUri} alt={a.nome}
                          onClick={() => setFotoAberta(a)}
                          style={{ width: 100, height: 100, objectFit: 'cover',
                                   borderRadius: 6, cursor: 'pointer',
                                   border: `1px solid ${C.border}` }} />
                      ) : (
                        <div
                          onClick={() => abrirAnexoEmNovaAba(a.dataUri, a.mime_type, a.nome)}
                          title={`Abrir ${a.nome} em nova aba`}
                          style={{ width: 100, height: 100,
                                   borderRadius: 6, cursor: 'pointer',
                                   border: `1px solid ${C.border}`,
                                   background: C.bg,
                                   display: 'flex', flexDirection: 'column',
                                   alignItems: 'center', justifyContent: 'center',
                                   gap: 4, padding: 6, textAlign: 'center' }}>
                          <span style={{ fontSize: 28 }}>📄</span>
                          <span style={{ fontSize: 9, color: C.accent,
                                         textDecoration: 'underline',
                                         overflow: 'hidden', textOverflow: 'ellipsis',
                                         whiteSpace: 'nowrap', maxWidth: '100%' }}>
                            Abrir
                          </span>
                        </div>
                      )}
                      <button type="button"
                        onClick={() => removerAnexoLocal(a.id_local)}
                        title="Remover"
                        disabled={salvando}
                        style={{ position: 'absolute', top: -6, right: -6,
                                 width: 20, height: 20, borderRadius: '50%',
                                 background: '#ef4444', color: 'white',
                                 border: 'none', cursor: 'pointer',
                                 fontSize: 12, lineHeight: 1, padding: 0 }}>
                        ×
                      </button>
                      <div style={{ fontSize: 9, color: C.muted, marginTop: 3,
                                    maxWidth: 100, overflow: 'hidden',
                                    textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                           title={a.nome}>
                        {truncarNome(a.nome, 16)} · {fmtBytes(a.tamanho_bytes)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Progresso de upload */}
          {progressoAnexo && (
            <div style={{ padding: '10px 12px', background: '#3b82f615',
                          border: '1px solid #3b82f655', borderRadius: 6,
                          fontSize: 12, color: C.text, marginBottom: 14 }}>
              📤 Enviando anexo {progressoAnexo.atual} de {progressoAnexo.total}...
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`,
                      display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onFechar} disabled={salvando}
            style={{ ...s.btn(false, C.muted), padding: '8px 20px', fontSize: 12 }}>
            Cancelar
          </button>
          <button onClick={salvar} disabled={!podeSalvar}
            style={{ ...s.btn(true, '#f59e0b'), padding: '8px 22px', fontSize: 12,
                     background: '#f59e0b', border: '1px solid #f59e0b',
                     opacity: podeSalvar ? 1 : 0.5,
                     cursor: podeSalvar ? 'pointer' : 'not-allowed' }}>
            {salvando ? '⏳ Registrando...' : '⚠ Registrar NC'}
          </button>
        </div>
      </div>

      {/* Lightbox (mesmo padrão do ModalDetalheNC) */}
      {fotoAberta && (
        <div onClick={() => setFotoAberta(null)}
          style={{ position: 'fixed', inset: 0, background: '#000000ee',
                   display: 'flex', alignItems: 'center', justifyContent: 'center',
                   zIndex: 20, cursor: 'zoom-out', padding: 30 }}>
          {fotoAberta.mime_type?.startsWith('image/') ? (
            <img src={fotoAberta.dataUri} alt={fotoAberta.nome}
              style={{ maxWidth: '95%', maxHeight: '95%', borderRadius: 8 }} />
          ) : (
            <div style={{ color: 'white', textAlign: 'center', maxWidth: 500 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
              <div style={{ fontSize: 14, marginBottom: 16 }}>{fotoAberta.nome}</div>
              <button
                onClick={e => {
                  e.stopPropagation();
                  abrirAnexoEmNovaAba(fotoAberta.dataUri, fotoAberta.mime_type, fotoAberta.nome);
                }}
                style={{ background: '#3b82f6', color: '#fff',
                         padding: '8px 18px', borderRadius: 6,
                         border: 'none', cursor: 'pointer',
                         fontSize: 12, fontFamily: 'inherit' }}>
                🔗 Abrir em nova aba
              </button>
            </div>
          )}
          <div style={{ position: 'absolute', bottom: 20, color: 'white',
                        fontSize: 11, opacity: 0.7 }}>
            {fotoAberta.nome} · clique para fechar
          </div>
        </div>
      )}
    </div>
  );
}