# Entrega 18b.3 — Tarefas do Comercial com resultado

Sem migration. Copie o zip por cima do projeto e rode `cd backend && node verificar-entrega.js` → "Todos os 214 arquivos".

## O que mudou
- Concluir uma ⏰ tarefa (rodapé do Funil ou ficha do BID) pede **"O que aconteceu?"**. Sem resultado, não conclui.
- O resultado fica na tarefa com quem concluiu, e aparece na linha do tempo do BID e no Cliente 360°. "desfazer" tira o resultado e reabre.
- No rodapé, cada tarefa tem o botão **📝 BID · cliente**, que abre a ficha.

## Arquivos
- backend: services/bids.js, routes/comercial.js, verificar-entrega.js
- frontend: components/comercial/ConcluirTarefa.jsx (novo), TelaComercial.jsx, FichaBid.jsx
- readme.md
