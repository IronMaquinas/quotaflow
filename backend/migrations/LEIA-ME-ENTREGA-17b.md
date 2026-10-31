# Entrega 17b — 🚦 Multa × programação (provável condutor)

Copie por cima. Sem SQL. Reinicie o backend. `cd backend && node verificar-entrega.js` → 205 ✓.

## Como testar
1. 👷 Pessoas → 🚦 Multas → **Nova multa**. Escolha o **veículo** (ex.: ABC-333, que está numa AT) e a **data** de uma viagem programada ou feita (ex.: 20/11/2026). Se quiser, a hora.
2. Abaixo de Data / Hora / Local aparece: **"🚛 Provável motorista em operação: Ana Beatriz… — AT-2026-0002 · BID-2026-0001 · item 2"**, com a rota e o período ("horário real da viagem" quando ela passou pelo fluxo; senão "horário previsto").
3. **Usar como motorista** preenche o Motorista responsável.
4. **abrir AT-… ↗** (para admin, gestor e operação) leva à 🚛 Programação com a ficha da AT aberta.
5. Veículo e data sem viagem: "Nenhuma AT com este veículo em operação neste dia".
