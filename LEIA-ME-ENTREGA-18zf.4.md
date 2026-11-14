# Entrega 18zf.4 — ⏱ contrato e checklist conversando sobre o horímetro

Quando o contrato cobra **por hora** ou tem **franquia de horas**, o sistema agora confere se o checklist de inspeção do equipamento pede o horímetro. Ele considera o checklist das rotinas ativas (do cliente ou da sua equipe) e o checklist padrão do equipamento.

## Onde aparece
- **📑 Contrato → 🚜 Equipamentos:** um aviso embaixo das rotinas do equipamento quando nenhum checklist dele pede horímetro.
- **📏 Medição:** um aviso na linha "sem leitura de horímetro no ciclo", com o mesmo motivo e a mesma ação. Se o checklist já pede, a linha mostra **onde e por quem** as horas são informadas.

## As ações
- **O checklist não pede horímetro:** botão **⏱ Ligar horímetro no checklist "X"**, com confirmação. O horímetro passa a ser obrigatório em toda inspeção que usa esse checklist, em qualquer equipamento.
- **O equipamento não tem checklist:** link **Definir checklist em 🔍 Inspeções ›**.

Leituras antigas não aparecem sozinhas. A cobrança automática começa no ciclo que tiver 2 leituras; até lá, as horas continuam sendo digitadas na medição.

## Arquivos
- backend/services/cobrancaLocacao.js (diagHorimetro) · backend/services/medicoes.js · backend/routes/contratos.js
- frontend/src/components/contratos/AvisoHorimetro.jsx (novo) · TelaContratos.jsx · MedicaoModal.jsx
- backend/verificar-entrega.js · readme.md

Sem migração. ⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
