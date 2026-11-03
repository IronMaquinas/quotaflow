# Entrega 18g.1 — 🧾 Tarefa fiscal automática por trecho (NF-e → CT-e → averbação → MDF-e)

## ⚠️ Migration
Rode `backend/migrations/066_fiscal_transporte.sql` no SQL Editor do Supabase (idempotente), **depois da 065**. Sem ela nenhuma tarefa fiscal é criada.

## Arquivos
- Backend: `migrations/066_fiscal_transporte.sql` (novo), `services/tarefasFiscais.js` (novo), `services/tarefas.js`, `routes/tarefas.js`, `routes/programacao.js`, `routes/configuracoes.js`, `routes/usuarios.js` (perfil fiscal), `services/pedidosVenda.js` (cria as tarefas no aceite)
- Frontend: `components/plano/ChecklistFiscal.jsx` (novo), `components/configuracoes/ConfigFiscal.jsx` (novo), `components/plano/TelaPlanoAcaoNova.jsx`, `components/programacao/MesaProgramacao.jsx`, `App.jsx`, `components/usuarios/TelaUsuariosNova.jsx`, `components/configuracoes/TelaConfiguracoes.jsx`
- `backend/verificar-entrega.js`, `readme.md`

## Como testar
1. Abra o ✅ Plano (ou a Mesa): cada trecho de transporte dos pedidos abertos ganha uma **TSK-TR** "🧾 Documentos fiscais — PV-… · trecho", prazo D-2 úteis.
2. No card, **🧾 0/4** → registre a NF-e (PDF + XML se tiver), o CT-e, a averbação (nº) e o MDF-e. Com os 4 ✓ a tarefa conclui sozinha.
3. Na 🚚 Mesa, o trecho mostra **🧾 fiscal n/4**; clique para abrir a tarefa. Na AT do trecho os PDFs aparecem nos anexos.
4. ⚙️ Configurações › Empresa › **🧾 Documentos fiscais**: mude a antecedência.
5. 👥 Usuários: crie um usuário com o perfil **Fiscal** — ele vê o Início e o ✅ Plano (abre em 🚚 Transporte).
6. `cd backend && node verificar-entrega.js`
