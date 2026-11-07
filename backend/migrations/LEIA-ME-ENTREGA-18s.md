# Entrega 18s — 🧩 bloqueio na API do Spot e das Cotações + admin fora da rotina

**Base:** origin/main 442f3c2 (18r). Sem migration. Só backend.

Copie os arquivos e rode `cd backend && node verificar-entrega.js`. Tem que dar "✓ Todos".

## Testar
1. **Admin fora da rotina:** faça uma solicitação de retirada. Só o gestor recebe o 🔔; o admin não recebe, mesmo se estiver na configuração de ocorrências.
2. **Bloqueio do Spot:** no Console, desligue "Cotações e Canal Spot" de uma empresa de demonstração. A API do Canal Spot passa a responder 409 com "O módulo … não está no plano da empresa".
3. **Bloqueio das Cotações:** com "Compras" ligado e "Cotações" desligado:
   - requisição e cotação interna continuam funcionando;
   - enviar para fornecedor dá 409.
4. **Sem mudança:** com todos os módulos ligados (padrão), tudo funciona como antes.
