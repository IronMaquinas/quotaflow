# Entrega N1 — ⭐ NPS (pesquisa de satisfação do cliente)
Base: R1 (5c68d4c). **Rode a migration 112** no Supabase antes de subir o backend.
DEPLOY: **Render (backend) e Netlify (tela)**.
- backend/migrations/112_nps.sql (NOVO), backend/services/nps.js (NOVO), backend/routes/nps.js (NOVO), backend/routes/npsLink.js (NOVO), backend/server.js
- backend/services/pedidosVenda.js e execucoes.js (gatilho: pedido concluído → pesquisa)
- frontend/src/TelaNpsPublica.jsx (NOVO), frontend/src/main.jsx, frontend/src/components/nps/TelaNps.jsx (NOVO), frontend/src/App.jsx
- backend/verificar-entrega.js, readme.md
Suba todos os arquivos, inclusive backend/verificar-entrega.js.
