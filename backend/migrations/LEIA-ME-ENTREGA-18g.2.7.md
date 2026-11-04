# Entrega 18g.2.7 — um MDF-e por AT · adicional × substituir · retirar por engano

**Sem migration.**

## Arquivos
- `backend/services/execucoes.js` — trava no anexar (1 MDF-e; NF-e/CT-e a mais confirmando), retirar por engano
- `backend/services/tarefasFiscais.js` — retirado sai do checklist da tarefa
- `backend/routes/programacao.js` — `POST /execucoes/:id/anexos/:anexo/retirar`
- `frontend/src/components/programacao/FichaAT.jsx`, `AcaoDocFiscal.jsx`
- `backend/verificar-entrega.js`, `readme.md`

## Como testar (na sua AT-2026-0001)
1. Aparece "⚠️ 2 MDF-e nesta AT" e o botão "＋ MDF-e" sumiu.
2. No MDF-e errado ("Relatório de Não Conformidade"), clique **⊘** › motivo › Retirar → fica riscado "⊘ retirado" e o aviso some.
3. "＋ NF-e" com uma NF-e já anexada → o sistema pergunta: **🔁 Substituir o atual** ou **＋ É adicional**.
4. `cd backend && node verificar-entrega.js`
