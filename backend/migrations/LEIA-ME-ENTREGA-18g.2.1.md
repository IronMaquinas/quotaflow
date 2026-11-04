# Entrega 18g.2.1 — rascunho da AT abre o editor da Mesa

**Sem migration.**

## Arquivos
- `frontend/src/components/programacao/TelaProgramacao.jsx` — link de rascunho → editor da Mesa
- `frontend/src/components/programacao/MesaProgramacao.jsx` — abre o editor de um rascunho vindo de fora
- `frontend/src/components/programacao/FichaAT.jsx` — "✏ Continuar programação" no rascunho
- `backend/services/tarefasFiscais.js` — divergência do motorista pelo CPF ou pelo nome
- `backend/verificar-entrega.js`, `readme.md`

## Como testar
1. Na tarefa fiscal, clique em **🔗 💾 rascunho da AT** → abre a 🧩 Mesa com o editor do rascunho (motorista/conjunto já preenchidos) → **🚛 Programar ›**.
2. Depois de programada, ela aparece em 🚛 ATs (filtro "Ativas").
3. `cd backend && node verificar-entrega.js`
