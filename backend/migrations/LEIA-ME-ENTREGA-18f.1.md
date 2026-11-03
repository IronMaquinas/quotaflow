# Entrega 18f.1 — 📊 Utilização × alocação da frota e dos motoristas

**Sem migration** (usa a 064 da 18f).

## Arquivos
- `backend/services/utilizacaoFrota.js` (novo) — cálculo
- `backend/services/frotaCalendario.js` — texto do calendário
- `backend/routes/programacao.js` — `GET /utilizacao?de&ate` (receita só admin/gestor)
- `frontend/src/components/programacao/PainelUtilizacao.jsx` (novo)
- `frontend/src/utils/gerarRelatorioUtilizacao.js` (novo) — relatório detalhado
- `frontend/src/components/programacao/TelaProgramacao.jsx` — aba 📊 Utilização
- `backend/verificar-entrega.js`, `readme.md`

## Como testar
1. 🚚 Programação › **📊 Utilização**: "Este mês" mostra o realizado até hoje e o reservado até o fim do mês.
2. Alterne **🚛 Equipamentos / 👤 Motoristas**; teste "Últimos 30 dias" (só realizado) e "Próximos 30 dias" (só alocação).
3. Como gestor/admin aparecem receita realizada, reservada e perdida; entrando como operação, não.
4. **📑 Relatório detalhado** abre em nova aba (imprimir em A4 paisagem).
5. `cd backend && node verificar-entrega.js`
