# Entrega 18y.1 — 📏 painel de Medições mais claro

**Base:** origin/main d3f64d9 (18y). Sem migration.

Copie os arquivos e rode `cd backend && node verificar-entrega.js`. Tem que dar "✓ Todos".

## Testar (📑 Contratos → 📏 Medições)
1. **"Valor mensal em locação (mês cheio)":** clique no cartão. Aparece a lista por contrato e equipamento: desde quando e valor mensal (o total de R$ 25 mil).
2. **"Medição de out/2026":** clique no cartão. Aparece o cálculo por equipamento: período, dias/dias do mês, valor mensal, previsto e situação. Exemplo: R$ 25.000 × 7/31 = R$ 5.645,16.
3. **Medição vazia:** o "CL-2026-0001 · out/2026 · R$ 0,00 · pronta — revisar e fechar" some de "Para agir" e do histórico. Era uma medição em preparação sem nenhum equipamento no mês, e é descartada sozinha.
