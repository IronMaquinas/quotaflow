# Entrega 18zj — 🧠 Analista da rotina de inspeção (Bloco 5, 1ª parte)

Nova aba **🧠 Analista** em 🔍 Inspeções, com período de 6, 12 ou 24 meses:
- **Indicadores:** cumprimento · reprovadas · dias da reprovação à liberação (média) · OS abertas pelas inspeções.
- **🔎 O que o analista viu:** achados calculados por regra, do mais grave ao bom.
  - Queda (ou alta) do cumprimento nos últimos 3 meses.
  - Locatários × sua equipe (diferença de 15 pontos ou mais).
  - Equipamento abaixo do previsto em 3 meses ou mais.
  - Mesmo item falhando 2–3× em 60 dias no mesmo equipamento ("avaliar causa raiz ou substituição").
  - Reprovado sem inspeção aprovada há mais de 7 dias.
  - Liberação lenta (média acima de 5 dias).
- **📈 Mês a mês**, **👥 Quem cumpre**, **🔧 Itens que mais falham**, **⛔ Reprovados sem liberação** e **🚜 Por equipamento**. Clicar no equipamento abre o histórico de inspeções dele.

## IA: ligar e desligar sem perder nada
Tudo nesta tela é calculado pelos dados, **sem IA**. Na próxima etapa entra o **e-mail mensal ao gestor**, com o parecer do Analista Sênior escrito pela IA em cima destes achados. A IA vai passar por um **adaptador**: hoje Claude, trocável por outro provedor ou desligada. Desligada ou fora do ar, o e-mail sai só com os achados por regra.

## Arquivos
- backend/services/analistaRotina.js (novo) · backend/services/rotinasInspecao.js · backend/routes/inspecoes.js
- frontend/src/components/inspecoes/AnalistaRotina.jsx (novo) · TelaInspecoes.jsx
- backend/verificar-entrega.js · readme.md

Sem migração. ⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
