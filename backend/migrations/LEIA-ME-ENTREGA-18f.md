# Entrega 18f — Pesquisa do histórico de ATs + dias operacionais da frota

## ⚠️ Migration
Rode `backend/migrations/064_frota_dias_operacao.sql` no SQL Editor do Supabase (idempotente). Sem ela a tela de dias da frota avisa e vale o padrão seg a sáb.

## Arquivos
- `backend/migrations/064_frota_dias_operacao.sql` (novo)
- `backend/services/frotaCalendario.js` (novo) — dias operacionais (base da 18f.1)
- `backend/routes/configuracoes.js` — `GET/PUT /frota-dias`
- `frontend/src/components/configuracoes/DiasFrota.jsx` (novo)
- `frontend/src/components/configuracoes/TelaConfiguracoes.jsx` — card na aba Jornada
- `frontend/src/components/programacao/TelaProgramacao.jsx` — pesquisa na aba 🚛 ATs
- `backend/verificar-entrega.js`, `readme.md`

## Como testar
1. 🚚 Programação › 🚛 ATs: clique **Acumulado do ano** — aparecem também as concluídas.
2. Escolha um **motorista** e/ou um **equipamento**; digite um nº de série ou AT na busca.
3. **⬇ CSV** baixa exatamente o que está na lista.
4. ⚙️ Configurações › Jornada de trabalho › **🚛 Dias operacionais da frota**: desmarque/marque dias e salve.
5. `cd backend && node verificar-entrega.js`
