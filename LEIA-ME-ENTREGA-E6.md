# Entrega E6 — 🔎 Inspeção de campo como produto (qualquer tipo de inspeção)
Base: E5.1 (89add7b). **Rode a migration 127** no Supabase antes de subir o backend.
DEPLOY: **Render (backend) e Netlify (tela)**.
DEPOIS: no Console, marque o módulo **"Inspeção de campo"** nos planos/empresas que têm lista de módulos e que usam a Foto com cartão (ela saiu do módulo "Inspeções e relatórios").
- backend/migrations/127_inspecao_config.sql (NOVO) · backend/services/inspecaoConfig.js (NOVO) · backend/services/modulos.js, roteiroInicial.js, fotoCartao.js, reparos.js, relatorioInspecao.js · backend/routes/fotoCartao.js
- frontend/src/utils/vocabInspecao.js (NOVO) · frontend/src/components/fotoCartao/TelaFotoCartao.jsx, Defeitos.jsx, Reparos.jsx, MapaFotos.jsx, BotaoRelatorio.jsx · frontend/src/utils/relatorioFotoCartao.js · frontend/src/App.jsx
- backend/verificar-entrega.js, readme.md
