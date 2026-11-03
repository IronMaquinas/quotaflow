# Entrega 18c.4 — Pré-seletores de período nas Inspeções

Sem migration. Copie o zip por cima do projeto (inclusive o `backend/verificar-entrega.js`). Depois rode `cd backend && node verificar-entrega.js` → "Todos os 220 arquivos".

## O que mudou
- **📊 Cumprimento:** botões Mês corrente (padrão) · Últimos 3 meses · Acumulado do ano · Período. O cumprimento recarrega sozinho ao trocar o período, sem o botão Atualizar. O 🖨 Relatório usa o período escolhido.
- **📋 Inspeções (histórico):** os mesmos botões, mais "Tudo" (padrão), com a quantidade de inspeções no filtro.

## Como testar
1. Em 🔍 Inspeções → 📊 Cumprimento, troque entre os botões de período. Os números devem mudar sem clicar em nada além do botão.
2. Em 📋 Inspeções, escolha "Mês corrente". A lista e a contagem devem mudar.

Arquivos: frontend/src/components/shared/FiltroPeriodo.jsx (novo), components/inspecoes/TelaInspecoes.jsx, components/inspecoes/RotinasLocacao.jsx, backend/verificar-entrega.js, readme.md
