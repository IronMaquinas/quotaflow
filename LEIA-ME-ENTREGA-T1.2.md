# Entrega T1.2 — 🚌 A viagem em uma tela só (abas)
Base: T1.1 (b522618)

DEPLOY: backend (Render) + frontend (Netlify) — 1 deploy de cada. Rode antes a migration 130 no Supabase.

1. Supabase → SQL Editor → `backend/migrations/130_turismo_foto_cracha.sql` (1 coluna; pode rodar 2x).
2. Copie os arquivos do zip por cima; `cd backend && node verificar-entrega.js`.
3. git add -A && commit && push.
4. Teste: abrir uma viagem → abas 🧭 Viagem (editar e Salvar alterações; toggle 🪪 Foto obrigatória) → 👥 Passageiros (＋ Grupo/família sem poltrona, filtros) → 🚌 Veículos (placa + motorista no card; ＋ Veículo) → 💺 Poltronas (⚡ Distribuir).
