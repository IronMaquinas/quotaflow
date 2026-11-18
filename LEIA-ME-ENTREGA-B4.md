# Entrega B4 — 🎤🔊 voz da Beta (gestor/admin)
Base: B3 (0008310). Sem migration. Funciona já com a voz do navegador (nada para configurar).
- backend/services/betaVoz.js (NOVO) — adaptador de voz
- backend/routes/beta.js — GET /voz, POST /voz/falar, /voz/ouvir
- frontend/src/components/beta/vozBeta.js (NOVO) e Beta.jsx — 🎤 e 🔊
- backend/verificar-entrega.js, readme.md
Para a voz neural depois: no Render, VOZ_PROVEDOR=openai e VOZ_API_KEY=<chave> (opcional VOZ_NOME, VOZ_LIMITE_DIA).
Suba todos os arquivos, inclusive backend/verificar-entrega.js.
