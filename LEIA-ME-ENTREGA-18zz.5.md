# Entrega 18zz.5 — 🔗 cruzando pendências de leitura (inclui a 18zz.4)

**Rode no Supabase:** `backend/migrations/097_treinamento_procedimentos.sql` (idempotente).
(Se a 096 da 18zz.2 já rodou, só a 097 é nova.)

## O que muda
- **Ficha do colaborador:** "📣 Leituras pendentes: N de M" — informativo, fora do %. Cada item abre o documento em 📁 Documentos → 📘 Gestão.
- **Treinamento → "📘 Procedimentos de apoio"** (até 10 documentos vigentes). Selo "📘 N proc." no catálogo.
- **Aula do colaborador:** "📘 Leia também" → abre direto o documento na aba 📘 Procedimentos (pode ler e confirmar "Li e entendi" mesmo sem distribuição para a função dele, por estar inscrito no treinamento).
- Inclui todos os arquivos da **18zz.4** (Todos · Perfis · Funções + contagem de leitura), que ainda não estava no GitHub.

## Conferir
`cd backend && node verificar-entrega.js`

Suba **todos** os arquivos do zip, inclusive `backend/verificar-entrega.js`.
