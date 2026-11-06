# Entrega 18o — 🧭 menu lateral na tela do cliente (locatário)

**Base:** origin/main 3a1d4b0 (18n.1). Sem migration.

Este zip **já inclui a 18n.2** ("lida pelo fornecedor"). Se você já copiou a 18n.2, é só copiar este por cima.

Copie os arquivos e rode `cd backend && node verificar-entrega.js`. Tem que dar "✓ Todos".

## Testar (entrar como cliente/locatário)
1. **Computador:** o menu fica à esquerda: 📑 Contratos e inspeções · 📏 Medições · ⚠️ Ocorrências.
   - O número vermelho mostra as medições esperando aprovação e as ocorrências abertas.
   - Clicar troca o conteúdo.
2. **Celular:** no topo aparece o botão ☰ com o item atual e a soma dos outros contadores. Tocar abre o menu por cima; escolher um item fecha o menu.
3. O link do e-mail de medição (#medicoes) e o atalho da inspeção para a ocorrência continuam abrindo no item certo.
4. Com o módulo de medição ou de ocorrências desligado, o item correspondente some do menu.
