import { useEffect, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

// Função helper para validar matematicamente a Chave de Acesso (Módulo 11)
function validarChaveAcessoNFe(chave) {
  if (chave.length !== 44 || !/^\d+$/.test(chave)) return false;

  // Multiplicadores oficiais da SEFAZ para o cálculo do dígito
  const multiplicadores = [
    2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5, 6, 7, 8, 9, 2,
    3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4,
  ];

  let soma = 0;
  
  // Calcula a soma ponderada dos primeiros 43 dígitos (de trás para frente)
  for (let i = 0; i < 43; i++) {
    const digito = parseInt(chave.charAt(42 - i), 10);
    soma += digito * multiplicadores[i];
  }

  const resto = soma % 11;
  const digitoVerificadorCalculado = resto === 0 || resto === 1 ? 0 : 11 - resto;
  const digitoVerificadorInformado = parseInt(chave.charAt(43), 10);

  return digitoVerificadorCalculado === digitoVerificadorInformado;
}

export function LeitorCodigoBarras({ onDetectado, onFechar, C, s }) {
  const html5QrcodeRef = useRef(null);
  const detectadoRef = useRef(false); // Evita chamadas duplicadas após a primeira detecção válida

  useEffect(() => {
    let isMounted = true;
    const scannerId = "qr-reader";

    // Instancia o leitor
    const html5Qrcode = new Html5Qrcode(scannerId);
    html5QrcodeRef.current = html5Qrcode;

    const configuracao = {
      fps: 15,
      videoConstraints: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      formatsToSupport: [Html5QrcodeSupportedFormats.CODE_128],
    };

    // Inicia a câmera
    html5Qrcode
      .start(
        { facingMode: "environment" },
        configuracao,
        (decodedText) => {
          // Se já detectou com sucesso antes, ignora leituras do loop
          if (detectadoRef.current) return;

          const chaveAcesso = decodedText.trim();

          // 🚨 VALIDAÇÃO COMPLETA: Verifica tamanho e aplica a matemática do dígito verificador
          if (!validarChaveAcessoNFe(chaveAcesso)) {
            console.warn("⚠️ Chave inválida ou incompleta ignorada:", chaveAcesso);
            return; // Descarta o frame e o leitor continua tentando ler na mesma hora
          }

          // Se passou no teste matemático, avança para o sucesso
          console.log("✅ Chave de acesso 100% válida detectada:", chaveAcesso);
          detectadoRef.current = true;

          onDetectado(chaveAcesso);

          // Para a câmera imediatamente e fecha
          if (html5Qrcode.isScanning) {
            html5Qrcode
              .stop()
              .then(() => onFechar())
              .catch(() => onFechar());
          } else {
            onFechar();
          }
        },
        () => {
          /* Silenciar erros de scan por frame */
        }
      )
      .then(() => {
        if (!isMounted) return;

        // Ajuste dinâmico de zoom usando elementos nativos do navegador
        const elementoVideo = document.querySelector(`#${scannerId} video`);

        if (elementoVideo && elementoVideo.srcObject) {
          const stream = elementoVideo.srcObject;
          const tracks = stream.getVideoTracks();

          if (tracks && tracks.length > 0) {
            const track = tracks[0];

            if (typeof track.getCapabilities === "function") {
              const capabilities = track.getCapabilities();

              if (capabilities.zoom) {
                const zoomIdeal = Math.min(2.0, capabilities.zoom.max);
                track
                  .applyConstraints({
                    advanced: [{ zoom: zoomIdeal }],
                  })
                  .catch((err) => console.log("Ajuste de zoom ignorado:", err));
              }
            }
          }
        }
      })
      .catch((err) => {
        console.error("Erro ao iniciar a câmera:", err);
      });

    // Cleanup robusto ao desmontar o componente
    return () => {
      isMounted = false;
      if (html5Qrcode.isScanning) {
        html5Qrcode.stop().catch(() => console.log("Câmera já parada"));
      }
    };
  }, [onDetectado, onFechar]);

  const fecharEParar = () => {
    if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
      html5QrcodeRef.current.stop().then(onFechar).catch(onFechar);
    } else {
      onFechar();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#00000090",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 400,
        padding: 20,
      }}
    >
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 20,
          maxWidth: 450,
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
            📱 Escanear Código de Barras
          </div>
          <button
            onClick={fecharEParar}
            style={{
              background: "transparent",
              border: "none",
              color: C.muted,
              fontSize: 20,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {/* Container da câmera em formato de leitor de barras */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: 180,
            borderRadius: 8,
            overflow: "hidden",
            marginBottom: 16,
            background: "#000",
          }}
        >
          <div id="qr-reader" style={{ width: "100%", height: "100%" }} />

          {/* Linha vermelha guia */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "5%",
              width: "90%",
              height: "2px",
              background: "rgba(255, 0, 0, 0.6)",
              boxShadow: "0 0 4px red",
              zIndex: 10,
              pointerEvents: "none",
            }}
          />
        </div>

        <div style={{ fontSize: 11, color: C.muted, textAlign: "center" }}>
          Alinhe o código de barras horizontalmente na linha vermelha.
        </div>
      </div>
    </div>
  );
}
