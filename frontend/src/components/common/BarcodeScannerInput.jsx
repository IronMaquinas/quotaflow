// frontend/src/components/common/BarcodeScannerInput.jsx
//
// Motor de leitura genérico. NÃO sabe o que é NF-e nem número de série —
// só entrega string. Toda validação de formato pertence a quem usa este
// componente (ver validarSerialPeca em TelaOrdemServico.jsx). Foi extraído
// do leitor de NF-e que já existia no módulo de recebimento; aquele
// mantém sua própria validação (chave 44 dígitos, DV módulo 11), este
// aqui aceita qualquer string curta sem checksum.
import { useState, useRef, useEffect } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

// Q1: o leitor de câmera que este campo chamava nunca existiu (📷 quebrava a tela da OS). Leitor genérico:
//   código de barras 1D e QR, câmera traseira, entrega a 1ª leitura e para a câmera.
const FORMATOS = [Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39, Html5QrcodeSupportedFormats.CODE_93, Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8, Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E, Html5QrcodeSupportedFormats.ITF, Html5QrcodeSupportedFormats.CODABAR, Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.DATA_MATRIX];
function LeitorCamera({ onDecode }) {
  const idRef = useRef(`leitor-${Math.random().toString(36).slice(2)}`); const [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true; let lido = false; const leitor = new Html5Qrcode(idRef.current, { formatsToSupport: FORMATOS, verbose: false });
    leitor.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 280, height: 140 } },
      (texto) => { if (lido || !vivo) return; lido = true; leitor.stop().catch(() => {}).finally(() => onDecode(texto)); }, () => {})
      .catch((e) => { if (vivo) setErro(String(e?.message || e).includes("Permission") ? "Permita o uso da câmera para ler o código." : "Não consegui abrir a câmera. Digite o código no campo."); });
    return () => { vivo = false; if (leitor.isScanning) leitor.stop().catch(() => {}); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div style={{ background: "#111", borderRadius: 8, overflow: "hidden" }}>
    <div id={idRef.current} style={{ width: "100%" }} />
    {erro && <div style={{ color: "#fca5a5", padding: 12, fontSize: 13 }}>{erro}</div>}
  </div>;
}

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