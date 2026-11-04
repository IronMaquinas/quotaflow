# Entrega 18g.2b — 📑 Relatório das tarefas por período (+ modo auditoria) · autocomplete de pessoa

**Sem migration.**

## Arquivos
- `frontend/src/utils/gerarRelatorioTarefas.js` (novo) — resumo, relatório, modo auditoria, CSV
- `frontend/src/components/plano/TelaPlanoAcaoNova.jsx` — período, responsável, resumo e botões de exportação
- `frontend/src/components/shared/CampoPessoa.jsx` — só abre a lista depois da 1ª letra
- `backend/verificar-entrega.js`, `readme.md`

## Como testar
1. ✅ Plano › **Acumulado do ano**: a situação passa para "Todas" e aparecem as tarefas abertas no ano + a faixa de resumo.
2. Troque "pela data de abertura" por "pelo prazo" / "pela data de conclusão"; filtre um responsável.
3. **📑 Relatório** (tabela para imprimir) · **🔎 Modo auditoria** (com a ficha de cada tarefa: histórico, evidências, vínculos) · **⬇ CSV**.
4. Nova tarefa › Responsável: clicar no campo não abre nada; ao digitar a 1ª letra aparecem as sugestões.
5. `cd backend && node verificar-entrega.js`
