# Entrega E1 — 📸 Foto com cartão (cartão de registro gravado na foto)
Base: R2.5 (0768ee1). **Rode a migration 121** no Supabase antes de subir o backend.
DEPLOY: **Render (backend) e Netlify (tela)**.
- backend/migrations/121_fotos_cartao.sql (NOVO), backend/services/fotoCartao.js (NOVO), backend/routes/fotoCartao.js (NOVO)
- backend/server.js, backend/services/modulos.js
- frontend/src/components/fotoCartao/TelaFotoCartao.jsx (NOVO), CameraCartao.jsx (NOVO) · frontend/src/utils/cartaoFoto.js (NOVO), filaFotosCartao.js (NOVO) · frontend/src/App.jsx
- backend/verificar-entrega.js, readme.md
A câmera do navegador só abre em https (Netlify ok). No iPhone: Safari; no Android: Chrome.
