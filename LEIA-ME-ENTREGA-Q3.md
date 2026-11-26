# Entrega Q3 — 🧪 Ciclo de compra com vários fornecedores + bloqueio da RM
Base: Q2 (d9e5622)

DEPLOY: backend (Render) + frontend (Netlify) — 1 deploy de cada. Rode antes a migration 132 no Supabase.

1. Supabase → SQL Editor → `backend/migrations/132_rc_solicitante.sql` (2 colunas; pode rodar 2x).
2. Copie os arquivos do zip por cima; `cd backend && node verificar-entrega.js`.
3. git add -A && commit && push.
4. Teste rápido:
   - Requisitante cria uma RC → o comprador recebe 🔔 "Nova requisição" e vê "pedida por …" em Compras.
   - Renegociar um item deixando outro fornecedor mais barato → o monitor passa a sugerir esse fornecedor.
   - Remover um item da cotação e emitir as OCs → emite sem erro, sem o item removido.
   - OS → aplicar material com origem "RM" antes de aprovar a retirada → aviso de RM não aprovada.
