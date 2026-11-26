# Entrega T1.1 — 🚌 Viagem planejada de uma vez
Base: T1 (aa8721b)

DEPLOY: backend (Render) + frontend (Netlify) — 1 deploy de cada. Rode antes a migration 129 no Supabase.

1. Supabase → SQL Editor → `backend/migrations/129_turismo_planejamento.sql` (só acrescenta colunas; pode rodar 2x).
2. Copie os arquivos do zip por cima; `cd backend && node verificar-entrega.js`.
3. git add -A && commit && push.
4. Teste: ＋ Nova viagem → origem/destino (📍 Mapa) → saída/retorno → pessoas esperadas → ✨ Sugerir → ＋ Parada → toggles 💲 pagamentos e 📍 embarques → Criar viagem → ✎ Veículo (placa + 2 motoristas) → reservar grupo com pagamento parcial e embarque na parada → 🖨 lista.
