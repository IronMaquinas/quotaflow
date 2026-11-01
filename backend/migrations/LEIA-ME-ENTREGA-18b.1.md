# Entrega 18b.1 — Lembrete de prospecção sem duplicar

Sem migration. Copie o zip por cima do projeto e rode `cd backend && node verificar-entrega.js` (210 arquivos).

**Causa:** ao abrir o Funil, `/comercial/funil` e `/comercial/tarefas` rodavam o gerador de lembretes ao mesmo tempo, e cada chamada criava a tarefa.
**Correção:** trava por empresa e reserva no evento antes de criar a tarefa.

**Limpar a tarefa repetida que já existe (Supabase):**
```sql
delete from bid_atividades a
using comercial_eventos e
where a.tenant_id = e.tenant_id
  and a.tipo = 'tarefa'
  and a.usuario_nome = 'QuotaFlow · 📅 calendário comercial'
  and a.concluida_em is null
  and a.texto like '%' || e.nome || '%'
  and (e.lembretes ->> '2026') is not null
  and a.id::text <> (e.lembretes ->> '2026');
```

Arquivos: backend/services/calendarioComercial.js, backend/verificar-entrega.js, readme.md
