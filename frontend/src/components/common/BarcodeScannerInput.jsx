// frontend/src/components/common/BarcodeScannerInput.jsx
//
// Motor de leitura genérico. NÃO sabe o que é NF-e nem número de série —
// só entrega string. Toda validação de formato pertence a quem usa este
// componente (ver validarSerialPeca em TelaOrdemServico.jsx). Foi extraído
// do leitor de NF-e que já existia no módulo de recebimento; aquele
// mantém sua própria validação (chave 44 dígitos, DV módulo 11), este
// aqui aceita qualquer string curta sem checksum.
import { useState, useRef, useEffect } from "react";

export default function BarcodeScannerInput({
  value, onChange, placeholder, autoFocus, disabled,
  onDecoded, maxLength = 64, style: styleOverride,
}) {
  const [scanning, setScanning] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // No primeiro decode válido, fecha a câmera. Sem isso, um técnico
  // apontando a câmera pra peça com vários códigos próximos (etiqueta do
  // fabricante + código de barras do SN) gera 5 leituras em 2s e o campo
  // vira sopa de strings concatenadas.
  function handleDecoded(raw) {
    const limpo = String(raw || "").trim();
    if (!limpo) return;
    // Substitui, nunca concatena. O técnico vê o valor novo e confirma.
    onChange(limpo);
    setScanning(false);
    inputRef.current?.focus();
    onDecoded?.(limpo);
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        autoFocus={autoFocus}
        style={{ flex: 1, fontFamily: "'IBM Plex Mono',monospace", ...styleOverride }}
      />
      <button
        type="button"
        title={scanning ? "Fechar leitor" : "Ler código de barras"}
        onClick={() => setScanning(s => !s)}
        disabled={disabled}
        style={{
          background: scanning ? "#22c55e" : "transparent",
          border: `1px solid ${scanning ? "#22c55e" : "#374151"}`,
          borderRadius: 6, color: scanning ? "white" : "#9ca3af",
          cursor: disabled ? "not-allowed" : "pointer",
          padding: "0 10px", fontSize: 14, fontFamily: "inherit",
        }}
      >📷</button>

      {scanning && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500,
                      background: "#000000ee", display: "flex",
                      alignItems: "center", justifyContent: "center" }}>
          <div ref={containerRef} style={{ width: "min(90vw, 500px)" }}>
            {/* Aqui entra seu leitor atual (QuaggaJS/Zxing/html5-qrcode).
                Mantido genérico: o componente filho só precisa chamar
                handleDecoded(string) no primeiro frame decodificado. */}
            <LeitorCamera onDecode={handleDecoded} />
            <button onClick={() => setScanning(false)}
              style={{ marginTop: 12, width: "100%", padding: 10,
                       background: "transparent", border: "1px solid #374151",
                       borderRadius: 6, color: "#9ca3af",
                       cursor: "pointer", fontFamily: "inherit" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}