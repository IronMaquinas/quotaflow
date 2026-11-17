# Entrega B1.7 — ⚡ Beta: consultas rápidas + 🏖 Férias com regras do país, resumo e bloqueio legal + ⚠ faltas
Base: B1 (e4c1b12). **Inclui a B1.5 e a B1.6** (que não chegaram a subir) — suba só esta.

1. Rode no Supabase, nesta ordem: `105_colaborador_ferias.sql` e `106_ferias_regras_faltas.sql` (idempotentes).
2. Copie os arquivos e rode `cd backend && node verificar-entrega.js`.

Testar:
- Ficha do colaborador: 📅 admissão + tempo de casa, 🏖 saldo, ⚠ registrar falta injustificada.
- Pessoas → 🏖 Férias: 📊 Saldo de férias (filtro "precisam de atenção"); "Lançar férias" → resumo ao escolher o funcionário; ❌ erro da lei bloqueia o Salvar.
- Início: alertas de férias vencidas/vencendo.
- 👋 Beta: "Quando vence a CNH do …?", "Quem está de férias?", "Férias da …?", "A carreta … está livre?", "Cotação 12?", "BID da …?", "Quem tem a peça …?".
- Console da Plataforma → Módulos da empresa → País (Brasil — CLT).
