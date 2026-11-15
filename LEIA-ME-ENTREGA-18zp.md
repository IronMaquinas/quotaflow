# Entrega 18zp — 💾 o parecer da IA fica guardado

Sem migração nova: usa as colunas da migration 091, que precisa estar rodada.

## Como fica
- Gerou o parecer do mês: ele **fica guardado**. Reabrir a prévia, sair da tela e o **e-mail do dia 1** usam o mesmo texto, **sem pagar de novo**.
- A prévia mostra **"💾 Parecer guardado — gerado em dd/mm hh:mm"**. O e-mail diz "gerado em … com os dados daquele momento".
- Se ninguém gerou antes, o envio do dia 1 gera uma vez e guarda.
- **🔄 Gerar de novo** é só para gestor ou admin e pede confirmação, porque tem custo e substitui o texto guardado. O limite é de **3 gerações por empresa por mês**; para mudar, use `IA_LIMITE_PARECER_MES`. Para "1 por mês", defina `IA_LIMITE_PARECER_MES=1`.
- Se a nova geração falhar, o parecer guardado **continua valendo**.
- Cada mês tem o seu próprio parecer.

## Arquivos
- backend/services/analistaMensal.js · backend/routes/inspecoes.js
- frontend/src/components/inspecoes/AnalistaRotina.jsx
- backend/verificar-entrega.js · readme.md

⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
