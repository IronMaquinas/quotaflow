# Entrega 18g.2.8 — 📜 histórico dos documentos na ficha da AT

**Sem migration.**

## Arquivos
- `backend/services/tarefasFiscais.js` — `historicoDocsAT` (anexado, substituído vN, retirado, evento — direto na AT ou vindo da tarefa)
- `backend/services/execucoes.js` — histórico na ficha e no relatório da viagem
- `frontend/src/components/programacao/FichaAT.jsx` — "📜 Histórico dos documentos"
- `frontend/src/utils/gerarRelatorioViagem.js` — tabela no relatório
- `backend/verificar-entrega.js`, `readme.md`

## Como testar (AT-2026-0002)
1. Clique ⊘ no MDF-e que não vale (motivo) → o aviso de 2 MDF-e some.
2. Abra **📜 Histórico dos documentos**: aparece o anexado, a substituição v1 → v2 com o motivo e a retirada.
3. **📑 Relatório da viagem** → seção "Histórico dos documentos".
4. `cd backend && node verificar-entrega.js`
