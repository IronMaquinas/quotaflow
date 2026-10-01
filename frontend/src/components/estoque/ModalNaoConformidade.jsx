// components/estoque/ModalNaoConformidade.jsx
//
// Modal padrão QuotaFlow (tema escuro) pra registrar uma Não Conformidade
// durante o recebimento. Substitui o `window.prompt` que era usado antes
// e adiciona upload de evidências (fotos / PDF).
//
// Uso:
//   <ModalNaoConformidade
//     C={C} s={s}
//     titulo="Registrar Não Conformidade"
//     onFechar={() => setModalNC(null)}
//     onConfirmar={async ({ motivo, anexos }) => { ... }}
//   />

import { useState, useRef } from 'react';

// Comprime imagem antes de mandar como base64. Assinatura IDÊNTICA à
// do ModalDetalheNC.jsx — mesmo comportamento de redimensionamento,
// mesma qualidade, mesmo shape de retorno. Arquivos não-imagem
// (PDF) são rejeitados (erro claro) em vez de tentar comprimir.
function comprimirImagem(file, { maxDim = 1200, quality = 0.75 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Arquivo não é uma imagem'));
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
        const tamanhoBytes = Math.round((dataUri.length - 22) * 0.75);
        resolve({ dataUri, mime_type: 'image/jpeg', tamanho_bytes: tamanhoBytes });
      };
      img.src = ev.target.result;
    };
    leitor.readAsDataURL(file);
  });
}

export default function ModalNaoConformidade({
  C,
  s,
  titulo = 'Registrar Não Conformidade',
  labelMotivo = 'MOTIVO *',
  placeholder = 'Descreva o problema (ex: produto com avaria, conteúdo incorreto, quantidade divergente...)',
  corBotao = '#ef4444',
  labelBotao = 'Registrar NC',
  permiteAnexos = true,
  // FIX M4.3: valores do item que veio do modal de contagem. Se o
  // comprador digitou "1 UN" lá, o valor vem pré-preenchido aqui.
  // Editável — ele pode ajustar (ex: recebeu 10, 3 com defeito).
  quantidadeInicial = '',
  unidadeInicial = 'UN',
  mostraRastreabilidade = false,
  onFechar,
  onConfirmar,
}) {
  const [motivo, setMotivo] = useState('');
  const [quantidade, setQuantidade] = useState(String(quantidadeInicial ?? ''));
  const [unidade, setUnidade] = useState(unidadeInicial);
  const [anexos, setAnexos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [fotoAberta, setFotoAberta] = useState(null);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  const adicionarArquivo = async (file) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setErro(`Arquivo "${file.name}" > 8MB. Reduza antes de enviar.`);
      return;
    }
    setErro(null);
    try {
      const { dataUri, mime_type, tamanho_bytes } = await comprimirImagem(file);
      setAnexos(prev => [...prev, {
        nome_arquivo: file.name,
        url: dataUri,
        mime_type,
        tamanho_bytes,
      }]);
    } catch (e) {
      setErro('Falha ao processar arquivo: ' + e.message);
    }
  };

  const removerAnexo = (idx) => {
    setAnexos(prev => prev.filter((_, i) => i !== idx));
  };

  const confirmar = async () => {
    if (!motivo.trim()) {
      setErro('Motivo é obrigatório.');
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      await onConfirmar({
        motivo: motivo.trim(),
        anexos,
        quantidade: quantidade ? parseFloat(String(quantidade).replace(',', '.')) : null,
        unidade,
      });
    } catch (e) {
      setErro(e.message || 'Erro ao registrar');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div
      onClick={carregando ? undefined : onFechar}
      style={{
        position: 'fixed', inset: 0, background: '#00000090',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 700, padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          ...s.card, width: 560, maxWidth: '100%',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0,
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
            {titulo}
          </div>
          {!carregando && (
            <button
              onClick={onFechar}
              style={{
                background: 'transparent', border: 'none',
                color: C.muted, fontSize: 20, cursor: 'pointer',
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
          {erro && (
            <div style={{
              background: '#2a0f0f', border: '1px solid #ef444455',
              borderRadius: 6, padding: '8px 12px', marginBottom: 14,
              fontSize: 11, color: '#ef4444',
            }}>
              ⚠ {erro}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{
              fontSize: 11, color: C.muted, letterSpacing: '0.06em',
              fontWeight: 600, display: 'block', marginBottom: 6,
            }}>
              {labelMotivo}
            </label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder={placeholder}
              rows={4}
              autoFocus
              style={{
                ...s.input, width: '100%', resize: 'vertical',
                fontSize: 13, minHeight: 90,
              }}
            />
          </div>

          {mostraRastreabilidade && (
            <div style={{ marginBottom: 16 }}>
              <label style={{
                fontSize: 11, color: C.muted, letterSpacing: '0.06em',
                fontWeight: 600, display: 'block', marginBottom: 6,
              }}>
                QUANTIDADE AFETADA
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={quantidade}
                  onChange={e => setQuantidade(e.target.value)}
                  placeholder="Ex: 1"
                  style={{ ...s.input, flex: 1, fontSize: 13 }}
                />
                <select
                  value={unidade}
                  onChange={e => setUnidade(e.target.value)}
                  style={{ ...s.input, width: 120, appearance: 'none', fontSize: 13 }}
                >
                  <option value="UN">UN</option>
                  <option value="L">L</option>
                  <option value="KG">KG</option>
                  <option value="M">M</option>
                  <option value="CX">CX</option>
                  <option value="RL">RL</option>
                  <option value="GL">GL</option>
                </select>
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                Pré-preenchido com o que você digitou na contagem. Ajuste se parte do lote está OK.
              </div>
            </div>
          )}

          {permiteAnexos && (
            <div style={{ marginBottom: 8 }}>
              <label style={{
                fontSize: 11, color: C.muted, letterSpacing: '0.06em',
                fontWeight: 600, display: 'block', marginBottom: 6,
              }}>
                📎 EVIDÊNCIAS (OPCIONAL)
              </label>

              {anexos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {anexos.map((a, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <img
                        src={a.url}
                        alt={a.nome_arquivo}
                        onClick={() => setFotoAberta(a)}
                        title={`${a.nome_arquivo} — ${Math.round((a.tamanho_bytes || 0) / 1024)} KB`}
                        style={{
                          width: 90, height: 90, objectFit: 'cover',
                          borderRadius: 6, cursor: 'pointer',
                          border: `1px solid ${C.border}`,
                        }}
                      />
                      <button
                        onClick={() => removerAnexo(idx)}
                        title="Remover"
                        style={{
                          position: 'absolute', top: -6, right: -6,
                          width: 20, height: 20, borderRadius: '50%',
                          background: '#ef4444', color: 'white',
                          border: 'none', cursor: 'pointer',
                          fontSize: 12, lineHeight: 1, padding: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 2 inputs: um força câmera (mobile), outro permite
                  escolher da galeria. Padrão do ModalDetalheNC. */}
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={e => {
                  const files = Array.from(e.target.files || []);
                  files.forEach(f => adicionarArquivo(f));
                  e.target.value = '';
                }}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={e => {
                  const files = Array.from(e.target.files || []);
                  files.forEach(f => adicionarArquivo(f));
                  e.target.value = '';
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => cameraRef.current?.click()}
                  disabled={carregando}
                  style={{ ...s.btn(false, C.muted), padding: '6px 14px', fontSize: 11 }}
                >
                  📷 Câmera
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={carregando}
                  style={{ ...s.btn(false, C.muted), padding: '6px 14px', fontSize: 11 }}
                >
                  🖼 Galeria
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px', borderTop: `1px solid ${C.border}`,
          display: 'flex', gap: 10, justifyContent: 'flex-end',
        }}>
          <button
            onClick={onFechar}
            disabled={carregando}
            style={{ ...s.btn(false, C.muted), padding: '8px 18px', fontSize: 12 }}
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={carregando || !motivo.trim()}
            style={{
              ...s.btn(true, corBotao),
              padding: '8px 18px', fontSize: 12,
              opacity: (carregando || !motivo.trim()) ? 0.5 : 1,
            }}
          >
            {carregando ? 'Registrando...' : labelBotao}
          </button>
        </div>
      </div>

      {/* Lightbox — clique na thumbnail pra ampliar */}
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