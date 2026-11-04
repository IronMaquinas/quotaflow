# Entrega 18g.2.5 — documentos fiscais pela AT + inclusão de condutor

**Sem migration.**

## Arquivos
- `backend/services/tarefasFiscais.js` — substituir/evento a partir do anexo da AT; inclusão de condutor; divergência considera o condutor incluído
- `backend/routes/programacao.js` — `POST /execucoes/:id/anexos/:anexo/substituir` · `/evento` · `POST /execucoes/:id/mdfe/inclusao-condutor`
- `frontend/src/components/programacao/AcaoDocFiscal.jsx` (novo) — modal das três ações
- `frontend/src/components/programacao/FichaAT.jsx` — botões 🔁 / ＋ nos documentos e o botão no aviso de divergência
- `backend/verificar-entrega.js`, `readme.md`

## Como testar
1. 🚛 ATs › abra uma AT com documentos vindos da tarefa: em Documentos fiscais, **🔁** (substituir) e **＋** (evento) em cada um; o ✕ só aparece no que foi anexado direto na AT.
2. 🔁 › motivo › PDF novo → o documento fica **v2** na AT e na tarefa (histórico: "pela AT-…").
3. ✏ Editar › troque o motorista → aparece "Motorista da AT ≠ condutor do MDF-e" com **＋ Registrar inclusão de condutor (MDF-e)** → anexe o PDF do evento → o aviso some.
4. `cd backend && node verificar-entrega.js`
