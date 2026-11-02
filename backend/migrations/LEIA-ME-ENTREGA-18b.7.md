# Entrega 18b.7 — Cliente 360°: perdido, contratos clicáveis e histórico

Sem migration. Copie o zip por cima do projeto (inclusive o `backend/verificar-entrega.js`). Depois rode `cd backend && node verificar-entrega.js` → "Todos os 214 arquivos".

## O que mudou no Cliente 360°
- Novo indicador **PERDIDO**, com o valor e a quantidade de BIDs perdidos.
- **Contratos de locação** logo abaixo dos Pedidos de venda. Ao clicar, o contrato abre em 📑 Contratos (para quem tem acesso a essa tela).
- **HISTÓRICO DE ATIVIDADES** mostra as 10 mais recentes. "Ver mais (N)" abre um modal com o histórico completo.

## Arquivos
- backend: services/bids.js, verificar-entrega.js
- frontend: App.jsx, components/comercial/TelaComercial.jsx, components/contratos/TelaContratos.jsx
- readme.md
