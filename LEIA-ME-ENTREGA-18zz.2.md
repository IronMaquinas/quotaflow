# Entrega 18zz.2 — 📣 procedimentos para os colaboradores lerem

## 1. Rode no Supabase
`backend/migrations/096_gestao_distribuicao.sql` (pode rodar mais de uma vez).

## 2. Na gestão (📁 Documentos → 📘 Gestão → Editar)
- **📣 Leitura obrigatória dos colaboradores**, num botão liga/desliga, com duas opções: **Todos** ou **só estas funções**.
- A lista mostra o selo "📣 todos" ou "📣 N função(ões)".
- No **👁 Ver** aparece "colaboradores: **X de Y**" e **⏳ Faltam ler: nomes**. Contam os colaboradores ativos, com login, que o documento alcança.

## 3. No app do colaborador (login de colaborador)
- Nova aba **📘 Procedimentos**: mostra os documentos vigentes distribuídos para ele, com os **não lidos primeiro**.
- O documento abre em A4, com a logo e as assinaturas, e tem o botão **✓ Li e entendi**.
- **Nova revisão pede nova leitura.**

## Arquivos
- backend/migrations/096_gestao_distribuicao.sql (novo) · backend/routes/meusProcedimentos.js (novo)
- backend/services/documentosGestao.js · backend/routes/pessoas.js · backend/server.js · backend/middleware/tenantMiddleware.js
- frontend/src/components/pessoas/MeusProcedimentos.jsx (novo) · DocumentosGestao.jsx · frontend/src/App.jsx
- backend/verificar-entrega.js · readme.md

⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
