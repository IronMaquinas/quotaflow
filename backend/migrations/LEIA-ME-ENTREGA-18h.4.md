# Entrega 18h.4 — 📊 indicadores das ocorrências e disponibilidade

**Sem migration.** Base: 18h.4c (commit 7a782f4).

## Onde
📑 Contratos → ⚠️ Ocorrências → **📊 Indicadores** (filtro de período; 📄 Relatório A4 e ⬇ CSV).

## Arquivos
**Novos**
- `frontend/src/components/ocorrencias/IndicadoresOcorrencias.jsx` — painel
- `frontend/src/utils/gerarRelatorioOcorrencias.js` — relatório A4 + CSV

**Alterados**
- `backend/services/ocorrencias.js` — `indicadores()` (disponibilidade por equipamento/contrato, resolução, dias parados, perda estimada só gestor/admin)
- `backend/routes/ocorrencias.js` — `GET /api/ocorrencias/indicadores?de=&ate=`
- `frontend/src/components/ocorrencias/PainelOcorrencias.jsx` — botão 📊 Indicadores
- `backend/verificar-entrega.js` (256 arquivos), `readme.md`

## Para os números baterem
- Disponibilidade e perda usam a **data de início/devolução** e o **valor mensal** de cada equipamento no contrato (📑 Contratos → contrato → equipamento). Sem valor mensal, a perda aparece com *.
- Ocorrência só conta como **parada** se estiver marcada ⛔ parado; a responsabilidade **Cliente** tira os dias da conta da locadora.
