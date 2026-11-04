# Entrega 18g.2 — 🚚 A AT espelha o MDF-e

**Sem migration.**

## Arquivos
- `backend/services/tarefasFiscais.js` — programar AT do MDF-e, vínculo MDF-e ↔ AT, divergência, encerramento
- `backend/routes/tarefas.js` — `POST /:id/fiscal/mdfe/:entrada/programar`, `POST /:id/fiscal/encerramento`
- `backend/routes/programacao.js` — divergência nos cards da Mesa
- `backend/services/execucoes.js` — divergência na ficha da AT
- `frontend/src/components/plano/ChecklistFiscal.jsx` — botão "Programar AT deste MDF-e", link para a AT, passo 🏁 Encerrar MDF-e
- `frontend/src/components/programacao/FichaAT.jsx`, `MesaProgramacao.jsx`, `frontend/src/components/plano/TelaPlanoAcaoNova.jsx`
- `backend/verificar-entrega.js`, `readme.md`

## Como testar (com os XMLs de exemplo)
1. Num trecho **sem AT**: registre o MDF-e com `mdfe-exemplo-89.xml` (placas ABC333 + ABC123) + um PDF.
2. Clique **🚚 Programar AT deste MDF-e** → a AT aparece na 🧩 Mesa como 💾 rascunho, já com cavalo, reboque e motorista (se a placa/CPF estiverem cadastrados — senão vem o aviso do que faltou). Programe.
3. Na AT programada: NF-e, CT-e e MDF-e nos anexos e no 📲 link do motorista.
4. Troque o motorista ou o cavalo da AT → a ficha e a Mesa mostram "🧾 AT diferente do MDF-e".
5. Conclua a AT → a tarefa fiscal volta para "em andamento" com **🏁 Encerrar MDF-e**; registre (protocolo opcional) → concluída.
6. `cd backend && node verificar-entrega.js`
