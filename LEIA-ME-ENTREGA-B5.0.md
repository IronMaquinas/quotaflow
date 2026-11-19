# Entrega B5.0 — 💲 custo da IA por empresa + interruptores da voz
Base: B4 (67f21ed). **Rode a migration 111** no Supabase antes de subir o backend.
- backend/migrations/111_ia_config_empresa.sql (NOVO)
- backend/services/custoIa.js (NOVO) — preços, câmbio, teto, painel
- backend/services/betaVoz.js, backend/routes/beta.js, backend/routes/plataforma.js
- frontend/src/plataforma/CustoIa.jsx (NOVO), ConsolePlataforma.jsx — aba IA → 💲 Custo de IA
- frontend/src/components/beta/Beta.jsx — 🔊 some do chat (volta se ligar no Console); 🎤 sempre voz do navegador
- backend/verificar-entrega.js, readme.md
Render (opcional): USD_BRL=5.5 · IA_PRECOS (JSON) para ajustar preços sem deploy.
Suba todos os arquivos, inclusive backend/verificar-entrega.js.
