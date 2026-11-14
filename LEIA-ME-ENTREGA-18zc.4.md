# Entrega 18zc.4 — lembretes só em dia útil (inclui a 18zc.3)

**Base:** origin/main 84f433e. Esta entrega **inclui a 18zc.3** (contrato não é emitido sem ninguém para aceitar); use este zip no lugar dela. Sem migration. Suba todos os arquivos, inclusive o `backend/verificar-entrega.js`, e reinicie o backend.

## O que muda
- **Dia útil** é de segunda a sexta, fora os feriados cadastrados da empresa (os mesmos da frota e do fiscal).
- **Aviso do envio automático da medição:** sai no último dia útil antes do envio. Se o envio é na terça e a segunda é feriado, o aviso sai na sexta: "Na ter 01/12/2026 a medição … vai sozinha".
- **Lembretes ao cliente** (medição aguardando aprovação, inspeção atrasada): só em dia útil. Se caírem num fim de semana ou feriado, saem no próximo dia útil.
- **Da 18zc.3:** os acessos aparecem antes do documento, e o 📄 Emitir sem acesso pergunta "Quem vai aceitar este contrato?".

## Conferir
1. Confira se os feriados da empresa estão cadastrados, no mesmo lugar do calendário da frota.
2. Em ✎ Editar → 📏 Medição de um contrato, o texto do envio automático diz "No dia útil anterior ao envio…".
