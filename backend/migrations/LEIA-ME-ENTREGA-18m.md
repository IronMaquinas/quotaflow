# Entrega 18m — ⏳ prazo de 30 dias da demanda spot · 🚪 fornecedor desiste · rodapé alinhado

**Migration 073** — rodar `backend/migrations/073_spot_prazo_desistencia.sql` no SQL Editor (idempotente) antes de subir o backend. Base: 18l (commit c7cd555).

## Arquivos
**Novos** — `backend/migrations/073_spot_prazo_desistencia.sql`, `backend/services/prazoSpot.js`
**Alterados** — `backend/routes/spot.js` (prazo nas listas, renovar, desistir), `backend/routes/fornecedor.js` (painel do portal sem as expiradas), `frontend/src/components/spot/TelaCanalSpot.jsx` (⏳ Expirada, 🔄 Renovar, desistentes apagados, rodapé, sem alert/confirm), `frontend/src/components/portal/TelaFornecedorSpot.jsx` (🚪 Desistir, sem alert), `backend/verificar-entrega.js` (270 arquivos), `readme.md`

## Como testar
1. Comprador → 📌 Canal Spot: uma demanda aberta há 30+ dias aparece como **⏳ Expirada** (filtro "Expiradas"), com **🔄 Renovar +30 dias** no rodapé.
2. Portal do fornecedor: a expirada não aparece mais. Renove no comprador → ela volta.
3. Fornecedor, numa demanda que respondeu → **🚪 Desistir da demanda** → confirme (motivo opcional) → sai da lista dele.
4. Comprador: o interesse aparece apagado no fim, com a data e o motivo, fora do menor valor.
