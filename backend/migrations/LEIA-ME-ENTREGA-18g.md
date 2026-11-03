# Entrega 18g — 🔗 Rastreabilidade das tarefas (TSK-<tipo>-<ano>-<nnnn>)

## ⚠️ Migration
Rode `backend/migrations/065_tarefas_rastreabilidade.sql` no SQL Editor do Supabase (idempotente). Ela cria o número das tarefas que já existem (pela data de criação) e o gatilho que numera as novas. Sem ela o Plano continua funcionando como antes, sem número.

## Arquivos
- `backend/migrations/065_tarefas_rastreabilidade.sql` (novo)
- `backend/services/tarefas.js` (novo) — número, tipo, histórico, evidências, vínculos
- `backend/routes/tarefas.js` — passa a usar o serviço (+ `/tipos`, `/:id`, `/:id/anexos`)
- `backend/services/multas.js`, `backend/services/autuacoes.js` — gravam a origem (tipo HR / NC)
- `frontend/src/components/plano/TelaPlanoAcaoNova.jsx` — ambientes por tipo, nº, 📎, 📜, 🔗
- `backend/verificar-entrega.js`, `readme.md` (com o desenho completo dos documentos fiscais)

## Como testar
1. ✅ Plano: as tarefas antigas aparecem com número (TSK-GN-…, TSK-CM-… das prospecções).
2. Clique nos chips **🚚 Transporte · ⚠️ NC · 🔎 Auditoria…** — "+ Nova tarefa" já vem no tipo do chip.
3. Abra **📎** e anexe um PDF; abra **📜** e veja o histórico (mude situação/prazo e confira de → para).
4. Edite o tipo de uma tarefa: o número não muda e aparece "reclassificada" no histórico.
5. Cancelar pede confirmação no modal; tarefa numerada não tem ✕ (excluir).
6. `cd backend && node verificar-entrega.js`
