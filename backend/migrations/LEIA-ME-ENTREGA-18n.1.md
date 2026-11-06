# Entrega 18n.1 — ajuste de layout das conversas no Canal Spot

**Base:** origin/main f26a0cc (18n). Sem migration.

Copie os arquivos por cima e rode `cd backend && node verificar-entrega.js`. Tem que dar "✓ Todos os 274 arquivos".
O `verificar-entrega.js` novo também corrige os 5 ✗ da 18n.

## O que testar
1. **Canal Spot → card da demanda:** o resumo das conversas aparece à direita, ao lado de "Com resposta há…". Exemplo: "⏳ 1 conversa aguardando resposta".
2. **Modal da demanda:** os botões 💬 Conversar · ✉️ Email · 💬 WhatsApp voltam a ficar alinhados como antes. A situação da conversa fica numa faixa abaixo de cada fornecedor: "💬 Conversa: ⏳ Aguardando resposta há 1 h · leu".
