// frontend/src/components/naoConformidades/ModalGerarPdfNC.jsx
//
// M4.5: modal de geração de PDF. Aceita 2 versões:
//   - 'interno'    → relatório completo (causa raiz e trilha opcionais)
//   - 'fornecedor' → relatório externo (tratativa sempre visível;
//                     histórico de devoluções opcional; sem dados internos)

import { useState } from 'react';
import { gerarHtmlRelatorioNC } from '../../utils/gerarPdfNC';

export default function ModalGerarPdfNC({
  C, s, nc, tenant, usuario, versao = 'interno', onFechar,
}) {
  const ehFornecedor = versao === 'fornecedor';

  const [incluirCausaRaiz, setIncluirCausaRaiz] = useState(false);
  const [incluirTrilha, setIncluirTrilha] = useState(false);
  const [incluirDevolucoes, setIncluirDevolucoes] = useState(false);

  const temCausaRaiz = !!(
    (Array.isArray(nc.cinco_porques) && nc.cinco_porques.filter(Boolean).length > 0)
    || nc.causa_raiz
  );
  const temTrilha = Array.isArray(nc.eventos) && nc.eventos.length > 0;

  // Devoluções só existem na versão fornecedor (vêm dos eventos visíveis).
  const temDevolucoes = ehFornecedor
    && Array.isArray(nc.eventos)
    && nc.eventos.some(ev => ev.tipo === 'devolucao_fornecedor');

  function gerar() {
    const html = gerarHtmlRelatorioNC({
      nc, tenant, usuario, versao,
      incluirCausaRaiz: incluirCausaRaiz && temCausaRaiz,
      incluirTrilha: incluirTrilha && temTrilha,
      incluirDevolucoes: incluirDevolucoes && temDevolucoes,
    });

    // M4.5-fix: usa Blob URL em vez de window.open('') + document.write.
    // document.write com HTML grande (~600KB quando tem fotos em base64)
    // corrompe o charset em alguns navegadores, gerando lixo Unicode no
    // topo da página 1. Blob é mais robusto e mais rápido.
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');

    if (!win) {
      URL.revokeObjectURL(url);
      alert('O navegador bloqueou a abertura da aba. Autorize popups para gerar o PDF.');
      return;
    }

    // Libera a memória do Blob depois de um tempo (a aba já carregou).
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    onFechar();
  }

  return (
    <div onClick={onFechar}
      style={{ position: 'fixed', inset: 0, background: '#00000090',
               display: 'flex', alignItems: 'center', justifyContent: 'center',
               zIndex: 500, padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ ...s.card, width: 520, maxWidth: '100%', padding: 0,
                 display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
              🖨 Gerar relatório de NC
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              {nc.numero_nc}
              {ehFornecedor && (
                <span style={{ marginLeft: 8, color: '#f59e0b' }}>
                  · versão fornecedor
                </span>
              )}
            </div>
          </div>
          <button onClick={onFechar}
            style={{ background: 'transparent', border: 'none',
                     color: C.muted, fontSize: 22, cursor: 'pointer',
                     lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6, marginBottom: 14 }}>
            Você está prestes a gerar um PDF com o relatório desta Não Conformidade.
            Ele será aberto em nova aba — imprima ou salve como PDF pelo navegador.
          </div>

          <div style={{
            fontSize: 11, color: C.muted, lineHeight: 1.5,
            padding: '8px 10px', background: C.bg,
            border: `1px solid ${C.border}55`, borderRadius: 4,
            marginBottom: 14,
          }}>
            💡 <strong>Dica:</strong> nas opções de impressão, ative
            &nbsp;<em>Cabeçalhos e rodapés</em>&nbsp; pra incluir a numeração
            de páginas automaticamente.
          </div>

          {/* Checkboxes por versão */}
          {!ehFornecedor && (temCausaRaiz || temTrilha) && (
            <>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.08em',
                            textTransform: 'uppercase', fontWeight: 600,
                            marginBottom: 10 }}>
                Conteúdo adicional (opcional)
              </div>

              {temCausaRaiz && (
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start',
                                padding: '10px 12px', background: C.bg,
                                border: `1px solid ${C.border}`, borderRadius: 6,
                                marginBottom: 8, cursor: 'pointer' }}>
                  <input type="checkbox"
                    checked={incluirCausaRaiz}
                    onChange={e => setIncluirCausaRaiz(e.target.checked)}
                    style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>
                      Análise de causa raiz (5 porquês)
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>
                      ⚠ Pode conter hipóteses preliminares ainda em investigação.
                      Evite compartilhar fora da empresa antes do encerramento.
                    </div>
                  </div>
                </label>
              )}

              {temTrilha && (
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start',
                                padding: '10px 12px', background: C.bg,
                                border: `1px solid ${C.border}`, borderRadius: 6,
                                marginBottom: 8, cursor: 'pointer' }}>
                  <input type="checkbox"
                    checked={incluirTrilha}
                    onChange={e => setIncluirTrilha(e.target.checked)}
                    style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>
                      Trilha de auditoria (histórico completo)
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>
                      Útil para auditoria ISO. Mostra quem fez o quê e quando.
                    </div>
                  </div>
                </label>
              )}
            </>
          )}

          {ehFornecedor && temDevolucoes && (
            <>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.08em',
                            textTransform: 'uppercase', fontWeight: 600,
                            marginBottom: 10 }}>
                Conteúdo adicional (opcional)
              </div>

              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start',
                              padding: '10px 12px', background: C.bg,
                              border: `1px solid ${C.border}`, borderRadius: 6,
                              marginBottom: 8, cursor: 'pointer' }}>
                <input type="checkbox"
                  checked={incluirDevolucoes}
                  onChange={e => setIncluirDevolucoes(e.target.checked)}
                  style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>
                    Histórico de devoluções
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>
                    Motivos das devoluções anteriores (rodada + observação).
                  </div>
                </div>
              </label>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`,
                      display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onFechar}
            style={{ ...s.btn(false, C.muted), padding: '8px 20px', fontSize: 12 }}>
            Cancelar
          </button>
          <button onClick={gerar}
            style={{ ...s.btn(true, '#3b82f6'), padding: '8px 22px', fontSize: 12,
                     background: '#3b82f6', border: '1px solid #3b82f6' }}>
            🖨 Gerar PDF
          </button>
        </div>
      </div>
    </div>
  );
}