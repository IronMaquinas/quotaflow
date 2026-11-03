# Entrega 18e — Relatório completo da viagem

**Sem migration.**

## Arquivos
- `backend/services/execucoes.js` — `relatorioViagem()`
- `backend/routes/programacao.js` — `GET /execucoes/:id/relatorio`
- `frontend/src/utils/gerarRelatorioViagem.js` (novo)
- `frontend/src/components/programacao/FichaAT.jsx` — botão "📑 Relatório da viagem"
- `backend/verificar-entrega.js`, `readme.md`

## Como testar
1. Abra uma AT já iniciada ou concluída em 🚚 Programação.
2. Clique em **📑 Relatório da viagem**: abre em nova aba, pronto para imprimir/salvar em PDF.
3. Confira o fluxo (horários, quem, GPS clicável), a inspeção reprovada com a liberação e as fotos.
4. `cd backend && node verificar-entrega.js`
