import { useEffect, useRef, useState } from "react";
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
  const detectadoRef = useRef(false); // Evita chamadas duplicadas/concorrentes
  const inputUsbRef = useRef(null); // Referência para garantir foco no leitor USB
  const [chaveManual, setChaveManual] = useState("");

  // Handler compartilhado para finalizar com sucesso
  const finalizarSucesso = (chaveValida) => {
    if (detectadoRef.current) return;
    detectadoRef.current = true;

    console.log("✅ Chave de acesso 100% válida aceita:", chaveValida);
    onDetectado(chaveValida);

    setTimeout(() => {
      if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
        html5QrcodeRef.current.stop()
          .then(() => onFechar())
          .catch(() => onFechar());
      } else {
        onFechar();
      }
    }, 100); 
  };


  // Escuta a entrada do leitor USB (Pistola física) ou digitação manual
  const handleInputChange = (e) => {
    const valorApenasNumeros = e.target.value.replace(/\D/g, "");
    setChaveManual(valorApenasNumeros);

    // Se o leitor USB preencher os 44 números direto, já valida e fecha
    if (valorApenasNumeros.length === 44) {
      if (validarChaveAcessoNFe(valorApenasNumeros)) {
        finalizarSucesso(valorApenasNumeros);
      } else {
        console.warn("⚠️ Chave USB/Manual matemática inválida:", valorApenasNumeros);
      }
    }
  };

  const handleKeyDown = (e) => {
    // Leitores USB costumam injetar um "Enter" ou "Tab" após a leitura
    if (e.key === "Enter") {
      e.preventDefault();
      const chaveLimpa = chaveManual.trim();
      if (validarChaveAcessoNFe(chaveLimpa)) {
        finalizarSucesso(chaveLimpa);
      } else {
        alert("Chave de acesso inválida ou incompleta.");
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    const scannerId = "qr-reader";

    // Garante foco no input assim que a modal abrir (útil para leitores USB de balcão)
    if (inputUsbRef.current) {
      inputUsbRef.current.focus();
    }

    // Instancia o leitor de câmera
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
          const chaveAcesso = decodedText.trim();

          // Validação completa por frame da câmera
          if (!validarChaveAcessoNFe(chaveAcesso)) {
            console.warn("⚠️ Chave de câmera inválida/incompleta ignorada:", chaveAcesso);
            return; 
          }

          finalizarSucesso(chaveAcesso);
        },
        () => { /* Silenciar erros de scan por frame */ }
      )
      .then(() => {
        if (!isMounted) return;

        // Ajuste dinâmico de zoom usando elementos nativos
        const elementoVideo = document.querySelector(`#${scannerId} video`);

        if (elementoVideo && elementoVideo.srcObject) {
          const stream = elementoVideo.srcObject;
          const tracks = stream.getVideoTracks();

          if (tracks && tracks.length > 0) {
            const track = tracks[0]; // Fix: Seleciona o primeiro track ativo

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
        console.error("Erro ao iniciar a câmera (ignorado se rodar em PC sem webcam):", err);
      });

    return () => {
      isMounted = false;
      if (html5Qrcode.isScanning) {
        html5Qrcode.stop().catch(() => console.log("Câmera já parada"));
      }
    };
  }, [onFechar]);

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
        {/* Cabeçalho da Modal */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
            📦 Recebimento Fiscal Híbrido
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

        {/* Input focado para Leitores USB e Digitação Manual */}
        <div style={{ marginBottom: 16 }}>
          <input
            ref={inputUsbRef}
            type="text"
            maxLength={44}
            value={chaveManual}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            autoFocus
            placeholder="Aponte a pistola USB ou digite a chave"
            style={{
              width: "95%",
              padding: "10px 12px",
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: C.background || "#fff",
              color: C.text,
              fontSize: 13,
              textAlign: "center",
              letterSpacing: "1px"
            }}
          />
        </div>

        {/* Container da câmera em formato de leitor de barras deitado */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: 160,
            borderRadius: 8,
            overflow: "hidden",
            marginBottom: 16,
            background: "#000",
          }}
        >
          <div id="qr-reader" style={{ width: "100%", height: "100%" }} />

          {/* Linha vermelha guia estilo scanner profissional */}
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

        <div style={{ fontSize: 11, color: C.muted, textAlign: "center", lineHeight: "1.4" }}>
          Bipe com a pistola USB, digite acima ou use a linha vermelha para ler com a câmera do celular.
        </div>
      </div>
    </div>
  );
}
