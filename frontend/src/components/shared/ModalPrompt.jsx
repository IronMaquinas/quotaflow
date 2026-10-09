// frontend/src/components/shared/ModalPrompt.jsx
//
// M4.4-etapa-9e: substitui window.prompt por modal padrão do SaaS.
// Uso:
//   <ModalPrompt
//     aberto={!!promptConfig}
//     titulo="Motivo da devolução"
//     descricao="Explique ao fornecedor por que está devolvendo."
//     label="MOTIVO"
//     placeholder="Ex: valor não confere com a NF"
//     obrigatorio
//     valor={motivo}
//     onChange={setMotivo}
//     onConfirmar={executarDevolucao}
//     onCancelar={() => setPromptConfig(null)}
//     salvando={salvando}
//     C={C} s={s}
//   />
import { useEffect, useRef } from 'react';

export default function ModalPrompt({
  aberto, titulo, descricao, label = 'VALOR', placeholder = '',
  obrigatorio = false, valor = '', onChange, onConfirmar, onCancelar,
  salvando = false, C, s, confirmarTexto = 'Confirmar', corBotao,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (aberto) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e) => { if (e.key === 'Escape') onCancelar?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, onCancelar]);

  if (!aberto) return null;

  const cor = corBotao || C.accent || '#3b82f6';
  const disabled = salvando || (obrigatorio && !String(valor || '').trim());

  return (
    <div
      onClick={onCancelar}
      style={{ position: 'fixed', inset: 0, background: '#00000090',
               display: 'flex', alignItems: 'center', justifyContent: 'center',
               zIndex: 900, padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ ...s.card, width: 480, maxWidth: '100%', padding: 22 }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>
          {titulo}
        </div>
        {descricao && (
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>
            {descricao}
          </div>
        )}

        <label style={{ ...s.label, fontSize: 11, color: C.muted }}>{label}</label>
        <textarea
          ref={inputRef}
          value={valor}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          rows={4}
          style={{ ...s.input, width: '100%', resize: 'vertical', fontSize: 13, marginTop: 4 }}
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancelar}
            disabled={salvando}
            style={{ ...s.btn(false, C.muted), padding: '8px 16px', fontSize: 12 }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={disabled}
            style={{
              ...s.btn(true, cor),
              padding: '8px 18px', fontSize: 12,
              background: cor, border: `1px solid ${cor}`,
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {salvando ? 'Enviando...' : confirmarTexto}
          </button>
        </div>
      </div>
    </div>
  );
}