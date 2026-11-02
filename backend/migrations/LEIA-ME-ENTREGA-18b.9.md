# Entrega 18b.9 — Detalhe "vivo" dos cards da visão do dono

Sem migration. Copie o zip por cima do projeto (inclusive o `backend/verificar-entrega.js`). Depois rode `cd backend && node verificar-entrega.js` → "Todos os 215 arquivos".

## O que mudou
- Os 4 cards do topo do Funil (Carteira · Receita do ano · Em jogo · Perdido) ganharam:
  - texto curto;
  - destaque sutil (filete colorido + "ver detalhe ›");
  - um modal com a composição item a item. Cada item abre o BID, o pedido ou o contrato.
- Os outros cards continuam só informativos.

## Arquivos
- backend: services/bids.js, verificar-entrega.js
- frontend: components/comercial/DetalheExecutivo.jsx (novo), TelaComercial.jsx
- readme.md
