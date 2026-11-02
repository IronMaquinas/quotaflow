# Entrega 18b.8 — Funil com a visão do dono

Sem migration. Copie o zip por cima do projeto (inclusive o `backend/verificar-entrega.js`). Depois rode `cd backend && node verificar-entrega.js` → "Todos os 214 arquivos".

## O que mudou
- **Pré-seletores de período:** Mês corrente · Últimos 3 meses (padrão) · Acumulado do ano · Período (datas).
- **Nova primeira linha** (só receita; o custo entra depois):
  - **Carteira contratada:** locações ativas (valor mensal × meses até o fim previsto; sem fim previsto, conta 12 meses) + pedidos de venda em curso.
  - **Receita do ano:**
    - realizado = BIDs aceitos no ano + locação já corrida;
    - previsto = locação até 31/12 + BIDs abertos com decisão no ano × conversão.
  - **Em jogo:** BIDs em andamento, também ponderado pela conversão.
  - **Perdido no período:** valor, quantidade e motivo mais comum.
- **SWOT comercial** anotado no roadmap da IA (readme, item 21).

## Arquivos
- backend: services/bids.js, verificar-entrega.js
- frontend: components/comercial/TelaComercial.jsx
- readme.md
