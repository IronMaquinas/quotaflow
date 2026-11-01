# Entrega 18b.2 — Prospecção com início, meio e fim

## Como aplicar
1. Rode no Supabase: `backend/migrations/061_prospeccao_oportunidades.sql` (idempotente). Ela também **apaga as ⏰ tarefas automáticas antigas** do calendário comercial (as do rodapé do Funil).
2. Copie os arquivos do zip por cima do projeto (inclui `readme.md` e `backend/verificar-entrega.js`).
3. `cd backend && node verificar-entrega.js` → "Todos os 213 arquivos".

## O que mudou
- **Sem tarefa automática** no rodapé do Funil.
- **Faixa do topo** com o andamento; com 2+ eventos vira acordeão.
- **Painel 📣:** por cliente — ✓ Registrar contato, 👤 delegar, ✕ cancelar (motivo obrigatório), ↩ reabrir. No topo — 👤 Delegar evento e 🔕 Não prospectar (cancela o ano).
- **A oportunidade só se encerra com BID criado ou cancelamento.**
- **Delegar cria tarefa no ✅ Plano** que se encerra sozinha (concluída com o BID; cancelada com o motivo). No Plano ela não pode ser concluída/excluída na mão e tem o link "📣 Abrir no Comercial".

## Arquivos
- backend: migrations/061_prospeccao_oportunidades.sql (novo), services/calendarioComercial.js, services/bids.js, routes/comercial.js, routes/tarefas.js, verificar-entrega.js
- frontend: App.jsx, components/comercial/PainelProspeccao.jsx, TelaComercial.jsx, CalendarioComercial.jsx, components/plano/TelaPlanoAcaoNova.jsx
- readme.md
