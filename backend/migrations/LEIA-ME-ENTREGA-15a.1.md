# Entrega 15a.1 — ajustes na ficha do BID

Base: **15a** aplicada (verificador 177 ✓).

## O que muda
- O subtotal do trecho não some mais ao ⧉ duplicar ou ＋ adicionar um item. Ele soma os itens que já têm valor.
- O botão do PDF do rascunho agora se chama **👁 rascunho**. Com uma versão fechada e sem mudanças depois dela, o botão mostra **📄 PDF vN**.

## Como aplicar
1. Na pasta `backend`, rode `node verificar-entrega.js --antes` com o verificador **deste zip**. Tem que dar ✓ nos 2 arquivos.
2. Copie os arquivos do zip por cima do projeto e rode `node verificar-entrega.js`. Tem que dar ✓ nos 177 arquivos.
3. Faça o commit e o push. Não há migration.

## Arquivos
```
backend/services/bids.js
backend/verificar-entrega.js
frontend/src/components/comercial/FichaBid.jsx
readme.md
```
