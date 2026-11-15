# Entrega 18zi — 🚛📦 AT na saída do pátio

No **📤 Registrar saída** do pátio há o campo novo **🚛 AT — se a sua empresa levou (opcional)**:
- Lista as ATs da Programação que estão programadas, em execução ou concluídas, de 30 dias atrás até 15 dias à frente. Cada opção mostra nº · data · status · motorista · conjunto.
- Ao escolher uma AT, o **motorista** e a **placa do cavalo** entram em "quem retirou" e "placa", se esses campos estiverem vazios.
- Se o cliente ou um terceiro retirou, deixe "— nenhuma".
- A AT aparece na ficha do equipamento e no **comprovante de saída**.

A lista funciona para quem usa o pátio mesmo sem acesso à 🚛 Programação.

## Arquivos
- backend/services/patio.js · backend/routes/patio.js
- frontend/src/components/patio/TelaPatio.jsx
- backend/verificar-entrega.js · readme.md

Sem migração. ⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
