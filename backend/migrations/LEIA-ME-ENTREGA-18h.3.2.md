# Entrega 18h.3.2 — tarefa TSK-MT ligada à ocorrência · conversa atualiza sozinha

**Sem migration.** Base: 18h.3.1 (commit e8e0fbf).

## Arquivos
- `backend/services/ocorrencias.js` — mudar a situação do SIN atualiza a tarefa (encerrada → concluída; em análise/atendimento → em andamento)
- `frontend/src/components/plano/TelaPlanoAcaoNova.jsx` — vínculo SIN clicável
- `frontend/src/App.jsx` — abre a ocorrência vinda da tarefa
- `frontend/src/components/contratos/TelaContratos.jsx` — abre a aba ⚠️ Ocorrências no SIN
- `frontend/src/components/ocorrencias/PainelOcorrencias.jsx` — conversa relê a cada 15 s
- `backend/verificar-entrega.js`, `readme.md`

## Ajuste da tarefa da SIN-2026-0002 (encerrada antes desta versão) — rodar uma vez no SQL Editor
```sql
update tarefas set status = 'concluida'
 where origem = 'ocorrencia' and status in ('pendente','em_andamento')
   and origem_ref in (select id::text from ocorrencias where status = 'encerrada');
```
