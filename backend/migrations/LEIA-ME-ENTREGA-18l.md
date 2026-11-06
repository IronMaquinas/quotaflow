# Entrega 18l — 💬 conversa na demanda spot (comprador ↔ fornecedor, em tempo real)

**Migration 072** — rodar `backend/migrations/072_spot_mensagens.sql` no SQL Editor (idempotente) antes de subir o backend. Base: 18k (commit b9345cb).

## Arquivos
**Novos** — `backend/migrations/072_spot_mensagens.sql`, `backend/services/chatSpot.js`, `frontend/src/components/spot/ChatSpot.jsx`
**Alterados** — `backend/routes/spot.js` (rotas da conversa + contadores nas listas), `frontend/src/components/spot/TelaCanalSpot.jsx` (💬 Conversar em cada interessado), `frontend/src/components/portal/TelaFornecedorSpot.jsx` (💬 Conversar com o comprador), `backend/verificar-entrega.js` (268 arquivos), `readme.md`

## Como testar (duas janelas lado a lado)
1. Janela 1: entre como comprador → 📌 Canal Spot → abra uma demanda com fornecedor interessado → **💬 Conversar**.
2. Janela 2 (anônima): entre no portal como esse fornecedor → Spot → a demanda → **💬 Conversar com o comprador**.
3. Escreva de um lado: aparece **na hora** do outro, sem recarregar. Feche e veja o "(N novas)" no botão e no card.
4. Encerre a demanda: a conversa fica só para consulta.
