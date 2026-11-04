# Entrega 18g.2a — 👤 Responsável da tarefa escolhido do cadastro

## ⚠️ Migration
Rode `backend/migrations/067_tarefa_responsavel.sql` no SQL Editor do Supabase (idempotente), depois da 066. Sem ela o campo continua funcionando, mas grava só o nome.

## Arquivos
- `backend/migrations/067_tarefa_responsavel.sql` (novo)
- `backend/services/tarefas.js`, `backend/routes/tarefas.js` — `GET /api/tarefas/pessoas`, `responsavel_ref`
- `frontend/src/components/shared/CampoPessoa.jsx` (novo) — busca de pessoa enquanto digita
- `frontend/src/components/plano/TelaPlanoAcaoNova.jsx` — campo novo + filtro "👤 Minhas"
- `backend/verificar-entrega.js`, `readme.md`

## Como testar
1. ✅ Plano › **+ Nova tarefa** › Responsável: digite parte do nome (ou a função, ex.: "motorista") — a lista aparece; ↑ ↓ Enter ou clique.
2. Abaixo do campo: "✓ Motorista · com login" quando ligado; "texto livre" se você digitar alguém que não está no cadastro.
3. Crie a tarefa para você mesmo e clique em **👤 Minhas**.
4. `cd backend && node verificar-entrega.js`
