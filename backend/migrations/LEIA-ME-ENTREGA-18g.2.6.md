# Entrega 18g.2.6 — documento fiscal anexado direto na AT também tem versão

**Sem migration.**

## Arquivos
- `backend/services/execucoes.js` — substituir / evento em anexo direto da AT; NF-e/CT-e/MDF-e sem remoção fora do rascunho
- `backend/services/tarefasFiscais.js` — encaminha para a AT quando o documento não veio da tarefa; evento não vira documento na tarefa
- `frontend/src/components/programacao/FichaAT.jsx`, `AcaoDocFiscal.jsx`
- `backend/verificar-entrega.js`, `readme.md`

## Como testar
1. Abra a **AT-2026-0002**: os MDF-e anexados direto agora têm **🔁** e **＋** (sem ✕).
2. 🔁 › motivo "Arquivo errado anexado" (ex.: era o ASO) › PDF novo → v2; a versão antiga continua guardada.
3. Anexos "Outro" e rascunhos continuam com ✕.
4. `cd backend && node verificar-entrega.js`
