# Entrega T1 — 🚌 Viagens e embarque (mapa de poltronas)
Base: E6 (5a3ce7f)

DEPLOY: backend (Render) + frontend (Netlify) — 1 deploy de cada. Rode antes a migration 128 no Supabase.

1. Supabase → SQL Editor → `backend/migrations/128_turismo_viagens.sql` (pode rodar 2x).
2. Copie os arquivos do zip por cima do projeto; `cd backend && node verificar-entrega.js`.
3. git add -A && commit && push.
4. Console da plataforma: ligue o módulo "Viagens e embarque — mapa de poltronas" na empresa de turismo (ou segmento 🚌 Turismo / fretamento).
5. Teste: menu 🚌 Viagens e embarque → Mapas de poltronas (usar modelo como base) → Viagens → ＋ Nova viagem → ＋ Ônibus → tocar poltronas / "3 juntos" → reservar grupo → mudar poltrona → 📥 importar planilha → 🖨 lista.
