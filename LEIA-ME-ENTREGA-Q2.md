# Entrega Q2 — 🧪 Fluxos centrais, parte 2 (entrega parcial, NC × estoque, endereços, cotação)
Base: Q1 (d50fb21)

DEPLOY: backend (Render) + frontend (Netlify) — 1 deploy de cada. Rode antes a migration 131 no Supabase.

1. Supabase → SQL Editor → `backend/migrations/131_recebimento_parcial_nc_estoque.sql` (só colunas; pode rodar 2x).
2. Copie os arquivos do zip por cima; `cd backend && node verificar-entrega.js`.
3. git add -A && commit && push.
4. Teste rápido:
   - OC de 10 → NF de 6: fiscal, contagem 6, entrada → o item volta para "fiscal" (faltam 4) → NF de 4 → completa.
   - Cotação com 2 itens e 2 fornecedores → OCs com o preço de CADA item.
   - Incluir fornecedor numa cotação já enviada → o link dele abre e ele consegue responder.
   - Remover um item da cotação → some do portal e a OC sai sem ele.
   - NC do recebimento encerrada com "uso como está" → o material entra no estoque.
   - Retirada aprovada → o saldo do endereço também baixa.
