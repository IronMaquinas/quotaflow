# Entrega 18g.2.3 — 🔒 Trava TSK ↔ AT + documentos no rascunho + aviso de não salvo

**Sem migration.**

## Arquivos
- `backend/services/tarefasFiscais.js` — espelho também no rascunho; trava de remoção com AT no trecho
- `backend/services/execucoes.js` — documento vindo da tarefa não sai pela AT; descartar o rascunho não apaga o arquivo da tarefa
- `frontend/src/components/plano/ChecklistFiscal.jsx` — faixa 🔒, sem 🗑 quando travado, aviso de documento não salvo
- `backend/verificar-entrega.js`, `readme.md`

## Como testar
1. Abra a 🧩 Mesa (ela sincroniza) → o rascunho da TSK-TR-2026-0002 mostra ✓ NF-e / ✓ MDF-e no kit do motorista.
2. Na tarefa: aparece "🔒 Documentos travados — já estão na rascunho da AT" e somem as 🗑.
3. Descarte o rascunho na Mesa → na tarefa as 🗑 voltam (o arquivo continua lá).
4. Na tarefa, abra "＋ Registrar" do CT-e, escolha um arquivo e, sem salvar, clique em 🚚 Programar AT → aparece o aviso.
5. `cd backend && node verificar-entrega.js`
