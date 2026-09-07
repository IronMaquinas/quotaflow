import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

// Função helper para validar matematicamente a Chave de Acesso (Módulo 11)
function validarChaveAcessoNFe(chave) {
  if (chave.length !== 44 || !/^\d+$/.test(chave)) return false;

  const multiplicadores = [
    2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5, 6, 7, 8, 9, 2,
    3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4,
  ];

  let soma = 0;
  
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
  const detectadoRef = useRef(false);
  const inputUsbRef = useRef(null);
  const [chaveManual, setChaveManual] = useState("");
  const [erro, setErro] = useState(false); // 🚨 NOVO: Estado para controlar a validação visual

  // Handler compartilhado para finalizar com sucesso de forma segura
  const finalizarSucesso = (chaveValida) => {
    if (detectadoRef.current) return;
    detectadoRef.current = true;

    setErro(false);
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

  // Escuta a entrada do leitor USB ou digitação manual
  const handleInputChange = (e) => {
    const valorApenasNumeros = e.target.value.replace(/\D/g, "");
    setChaveManual(valorApenasNumeros);

    // Se limpou o campo ou está digitando, remove o estado de erro visual
    if (valorApenasNumeros.length < 44) {
      setErro(false);
      return;
    }

    // Quando chega exatamente a 44 dígitos (seja via digitação, colagem ou leitor USB)
    if (valorApenasNumeros.length === 44) {
      if (validarChaveAcessoNFe(valorApenasNumeros)) {
        finalizarSucesso(valorApenasNumeros);
      } else {
        // 🚨 Ativa o erro se os 44 dígitos falharem no cálculo matemático
        setErro(true);
        console.warn("⚠️ Chave manual/USB matemática inválida:", valorApenasNumeros);
      }
    }
  };

  const handleKeyDown = (e) => {
    // Tratamento caso o leitor USB envie o "Enter" no final
    if (e.key === "Enter") {
      e.preventDefault();
      const chaveLimpa = chaveManual.trim();
      if (validarChaveAcessoNFe(chaveLimpa)) {
        finalizarSucesso(chaveLimpa);
      } else {
        setErro(true);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    const scannerId = "qr-reader";

    if (inputUsbRef.current) {
      inputUsbRef.current.focus();
    }

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

    html5Qrcode
      .start(
        { facingMode: "environment" },
        configuracao,
        (decodedText) => {
          const chaveAcesso = decodedText.trim();

          // Validação da câmera continua silenciosa em background para não assustar o usuário
          if (!validarChaveAcessoNFe(chaveAcesso)) {
            console.warn("⚠️ Chave de câmera inválida/incompleta ignorada:", chaveAcesso);
            return; 
          }

          finalizarSucesso(chaveAcesso);
        },
        () => {}
      )
      .then(() => {
        if (!isMounted) return;

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
                  .applyConstraints({ advanced: [{ zoom: zoomIdeal }] })
                  .catch((err) => console.log("Ajuste de zoom ignorado:", err));
              }
            }
          }
        }
      })
      .catch((err) => {
        console.error("Erro ao iniciar a câmera:", err);
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

        {/* Campo de Input com validação visual dinâmica */}
        <div style={{ marginBottom: 16 }}>
          <input
            ref={inputUsbRef}
            type="text"
            maxLength={44}
            value={chaveManual}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            autoFocus
            placeholder="Aponte a pistola USB, digite ou cole a chave"
            style={{
              width: "95%",
              padding: "10px 12px",
              borderRadius: 6,
              // 🚨 MUDANÇA: Se houver erro de validação, a borda fica vermelha rígida
              border: `1px solid ${erro ? "#ef4444" : C.border}`,
              background: C.background || "#fff",
              // 🚨 MUDANÇA: O texto digitado também ganha a cor vermelha em caso de erro
              color: erro ? "#ef4444" : C.text,
              fontSize: 13,
              textAlign: "center",
              letterSpacing: "1px",
              boxShadow: erro ? "0 0 0 1px #ef4444" : "none",
              transition: "all 0.2s ease"
            }}
          />
          {/* 🚨 NOVO: Mensagem auxiliar em vermelho abaixo do campo */}
          {erro && (
            <div style={{ color: "#ef4444", fontSize: 11, marginTop: 4, textAlign: "center", fontWeight: 500 }}>
              ❌ Chave de acesso inválida (falha no dígito verificador).
            </div>
          )}
        </div>

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
