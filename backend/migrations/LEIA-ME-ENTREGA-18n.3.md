# Entrega 18n.3 — 🔔 quanto tempo a notificação fica

**Base:** origin/main a4364a8 (18o). Sem migration.

Copie os arquivos e rode `cd backend && node verificar-entrega.js`. Tem que dar "✓ Todos".

## Como funciona
- **Clicou:** abre o assunto e a notificação fica lida (apagadinha). Ela continua na lista como histórico.
- **Some da lista:**
  - lidas, 30 dias depois da leitura;
  - não lidas, depois de 90 dias.
- **Lista do 🔔:** cabem umas 5 visíveis e o resto rola, até as 30 mais recentes. O topo com "marcar todas como lidas" fica fixo.
- **Limpeza no banco:** todo dia às 3h, se `CRON_INTERNO=1`. Sem ele a tela só esconde o que passou do prazo.

## Testar
Abra o 🔔 com várias notificações e role a lista: o topo fica parado.
